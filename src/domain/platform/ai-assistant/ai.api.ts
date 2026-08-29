import { getApiUrl } from '@/core/api/base-client';
import { request } from '@/core/api/http-client';
import { authSession } from '@/core/auth/session.manager';
import { ApiError } from '@/core/api/contracts';
import type { AiMessage, AiSession, AiStreamEvent, AiVisitor, PageResult } from './types';

export const aiApi = {
  createVisitor: () => request<AiVisitor>('/api/v1/ai/visitors', { method: 'POST' }),
  sessions: (visitorToken: string) => request<PageResult<AiSession>>(`/api/v1/ai/sessions?visitorToken=${encodeURIComponent(visitorToken)}&page=1&pageSize=100`),
  messages: (sessionId: number, visitorToken: string) => request<AiMessage[]>(`/api/v1/ai/sessions/${sessionId}/messages?visitorToken=${encodeURIComponent(visitorToken)}`),
  archive: (sessionId: number, visitorToken: string) => request<void>(`/api/v1/ai/sessions/${sessionId}/archive?visitorToken=${encodeURIComponent(visitorToken)}`, { method: 'POST' }),
  feedback: (payload: Record<string, unknown>) => request<{ id: number; businessNo: string }>('/api/v1/ai/feedback', { method: 'POST', body: JSON.stringify(payload) }),
  lead: (payload: Record<string, unknown>) => request<{ id: number; businessNo: string }>('/api/v1/ai/leads', { method: 'POST', body: JSON.stringify(payload) }),
};

export async function streamAiChat(payload: Record<string, unknown>, onEvent: (event: AiStreamEvent) => void) {
  let token = await authSession.ensureAccessToken();
  if (!token) throw new ApiError('登录状态已失效', 'UNAUTHORIZED', 401);
  let response = await fetchStream(token, payload);
  if (response.status === 401) {
    token = (await authSession.refresh()).accessToken;
    response = await fetchStream(token, payload);
  }
  if (!response.ok || !response.body) {
    let message = 'AI 助手暂时不可用';
    let code = 'AI_STREAM_FAILED';
    try {
      const errorBody = await response.json() as { code?: string; message?: string };
      code = errorBody.code || code;
      message = errorBody.message || message;
    } catch { /* stream error without JSON */ }
    if (response.status === 429 || code === 'AI_DAILY_QUOTA_EXCEEDED') {
      code = 'AI_DAILY_QUOTA_EXCEEDED';
      message = '已达到今日对话限制，明天可继续提问';
    }
    throw new ApiError(message, code, response.status);
  }
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/); buffer = frames.pop() || '';
    frames.forEach((frame) => dispatchStreamFrame(frame, onEvent));
    if (done) {
      dispatchStreamFrame(buffer, onEvent);
      break;
    }
  }
}

function dispatchStreamFrame(frame: string, onEvent: (event: AiStreamEvent) => void) {
  if (!frame.trim()) return;
  const lines = frame.split(/\r?\n/);
  const eventName = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n');
  if (!data) return;
  try {
    const parsed = JSON.parse(data) as AiStreamEvent;
    onEvent({ ...parsed, type: parsed.type || eventName || 'status' });
  } catch {
    onEvent({ type: eventName || 'status', message: data });
  }
}

function fetchStream(token: string, payload: Record<string, unknown>) {
  return fetch(getApiUrl('/api/v1/ai/chat/stream'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'text/event-stream', 'Accept-Language': localStorage.getItem('systempro.locale') === 'en-US' ? 'en-US' : 'zh-CN', 'X-Request-Id': typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}` },
    body: JSON.stringify(payload),
  });
}
