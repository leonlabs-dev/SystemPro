import { ApiError, type ApiResponse } from './contracts';
import { apiBaseUrl } from '@/core/config/app-runtime';

export function getApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

export async function fetchApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Accept-Language', localStorage.getItem('systempro.locale') === 'en-US' ? 'en-US' : 'zh-CN');
  headers.set('X-Request-Id', createRequestId());
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(getApiUrl(path), { ...init, headers });
  } catch {
    throw new ApiError('无法连接 SystemPro 服务', 'NETWORK_ERROR', 0);
  }

  const requestId = response.headers.get('X-Request-Id') || undefined;
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = await readPayload<T>(response, requestId);
  if (!response.ok || payload.code !== 'OK') {
    throw new ApiError(payload.message || '请求处理失败', payload.code || 'HTTP_ERROR', response.status, requestId);
  }
  return payload.data;
}

async function readPayload<T>(response: Response, requestId?: string): Promise<ApiResponse<T>> {
  try {
    return await response.json() as ApiResponse<T>;
  } catch {
    throw new ApiError('服务返回了无法识别的响应', 'INVALID_RESPONSE', response.status, requestId);
  }
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
