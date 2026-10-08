import { ApiError, type ApiResponse } from './contracts';
import { fetchResource, requestLocale, transportError, type TransportOptions } from './transport';
import { apiBaseUrl } from '@/core/config/app-runtime';

export function getApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

export async function fetchApi<T>(path: string, init: RequestInit = {}, options: TransportOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Accept-Language', requestLocale());
  headers.set('X-Request-Id', createRequestId());
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  return fetchResource(getApiUrl(path), { ...init, headers }, async (response) => {
    const requestId = response.headers.get('X-Request-Id') || headers.get('X-Request-Id') || undefined;
    if (response.ok && response.status === 204) return undefined as T;
    const payload = await readPayload<T>(response, requestId);
    if (!response.ok || payload.code !== 'OK') {
      throw new ApiError(payload.message || '请求处理失败', payload.code || 'HTTP_ERROR', response.status, requestId);
    }
    return payload.data;
  }, options);
}

async function readPayload<T>(response: Response, requestId?: string): Promise<ApiResponse<T>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw transportError(response.status, requestId);
    throw new ApiError(requestLocale() === 'en-US' ? 'The service returned an invalid response.' : '服务返回了无法识别的响应', 'INVALID_RESPONSE', response.status, requestId);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof (payload as ApiResponse<T>).code !== 'string') {
    if (!response.ok) throw transportError(response.status, requestId);
    throw new ApiError(requestLocale() === 'en-US' ? 'The service returned an invalid response.' : '服务返回了无法识别的响应', 'INVALID_RESPONSE', response.status, requestId);
  }
  return payload as ApiResponse<T>;
}

export function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
