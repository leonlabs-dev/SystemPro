import { ApiError } from './contracts';

export const QUERY_TIMEOUT_MS = 30_000;
export const MUTATION_TIMEOUT_MS = 120_000;
export const EXPORT_TIMEOUT_MS = 120_000;

export interface TransportOptions {
  /** Zero disables the application timeout; a caller's AbortSignal still applies. */
  timeoutMs?: number;
}

export function requestLocale(): 'zh-CN' | 'en-US' {
  try {
    return localStorage.getItem('systempro.locale') === 'en-US' ? 'en-US' : 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

export function defaultTimeout(init: RequestInit) {
  return !init.method || /^(GET|HEAD)$/i.test(init.method) ? QUERY_TIMEOUT_MS : MUTATION_TIMEOUT_MS;
}

export function transportError(status: number, requestId?: string): ApiError {
  const en = requestLocale() === 'en-US';
  const unavailable = status === 502 || status === 503 || status === 504;
  const message = unavailable
    ? (en ? 'The service is temporarily unavailable. Please try again later.' : '服务暂时不可用，请稍后重试')
    : status === 401
      ? (en ? 'Your session has expired. Please sign in again.' : '登录状态已失效，请重新登录')
      : (en ? `Request failed (HTTP ${status}).` : `请求处理失败（HTTP ${status}）`);
  return new ApiError(message, unavailable ? 'SERVICE_UNAVAILABLE' : 'HTTP_ERROR', status, requestId);
}

/** Keep timeout/cancellation active until the response body has been consumed. */
export async function fetchResource<T>(
  url: string,
  init: RequestInit,
  consume: (response: Response) => Promise<T>,
  options: TransportOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? defaultTimeout(init);
  let timedOut = false;
  const abort = () => controller.abort();
  const timer = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs)
    : undefined;
  init.signal?.addEventListener('abort', abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  try {
    // Do not send an already-cancelled request (particularly important for writes).
    if (controller.signal.aborted) throw new Error('Request aborted');
    const response = await fetch(url, { ...init, signal: controller.signal });
    return await consume(response);
  } catch (error) {
    const en = requestLocale() === 'en-US';
    if (timedOut) {
      const query = !init.method || /^(GET|HEAD)$/i.test(init.method);
      throw new ApiError(
        query
          ? (en ? 'The request timed out. Please try again.' : '请求超时，请稍后重试')
          : (en ? 'The request timed out. Check the operation result before submitting again.' : '请求等待超时，请先确认操作结果，避免重复提交'),
        'REQUEST_TIMEOUT', 0,
      );
    }
    if (controller.signal.aborted) {
      throw new ApiError(en ? 'Request cancelled.' : '请求已取消', 'REQUEST_ABORTED', 0);
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(en ? 'Unable to connect to SystemPro.' : '无法连接 SystemPro 服务', 'NETWORK_ERROR', 0);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}
