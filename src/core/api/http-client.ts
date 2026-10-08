import { ApiError } from './contracts';
import { createRequestId, fetchApi, getApiUrl } from './base-client';
import { EXPORT_TIMEOUT_MS, fetchResource, requestLocale, transportError, type TransportOptions } from './transport';
import { authSession } from '@/core/auth/session.manager';
import { routeLoading } from '@/core/navigation/route-loading';

export interface RequestOptions extends TransportOptions {
  trackRouteLoading?: boolean;
}

export async function request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  // Register before the first await so route transitions never flash an empty state.
  const trackRouteLoading = options.trackRouteLoading !== false;
  const version = authSession.getVersion();
  if (trackRouteLoading) routeLoading.beginRequest();
  try {
    let token = await authSession.ensureAccessToken();
    authSession.assertVersion(version);
    if (!token) throw new ApiError('登录状态已失效', 'UNAUTHORIZED', 401);
    let data: T;
    try {
      data = await requestWithToken<T>(path, token, init, options);
    } catch (error) {
      authSession.assertVersion(version);
      if (!(error instanceof ApiError) || error.status !== 401 || init.signal?.aborted) throw error;
      // Another request may already have refreshed while this old-token 401 was in flight.
      token = authSession.getAccessToken() !== token && authSession.getAccessToken()
        ? authSession.getAccessToken()
        : (await authSession.refresh()).accessToken;
      authSession.assertVersion(version);
      data = await requestWithToken<T>(path, token, init, options);
    }
    authSession.assertVersion(version);
    return data;
  } finally {
    if (trackRouteLoading) routeLoading.endRequest();
  }
}

export async function requestBlob(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<Blob> {
  const version = authSession.getVersion();
  const trackRouteLoading = options.trackRouteLoading !== false;
  if (trackRouteLoading) routeLoading.beginRequest();
  const exportOptions = { ...options, timeoutMs: options.timeoutMs ?? EXPORT_TIMEOUT_MS };
  try {
    let token = await authSession.ensureAccessToken();
    authSession.assertVersion(version);
    if (!token) throw new ApiError('登录状态已失效', 'UNAUTHORIZED', 401);
    let data: Blob;
    try {
      data = await requestBlobWithToken(path, token, init, exportOptions);
    } catch (error) {
      authSession.assertVersion(version);
      if (!(error instanceof ApiError) || error.status !== 401 || init.signal?.aborted) throw error;
      token = authSession.getAccessToken() !== token && authSession.getAccessToken()
        ? authSession.getAccessToken()
        : (await authSession.refresh()).accessToken;
      authSession.assertVersion(version);
      data = await requestBlobWithToken(path, token, init, exportOptions);
    }
    authSession.assertVersion(version);
    return data;
  } finally {
    if (trackRouteLoading) routeLoading.endRequest();
  }
}

function requestBlobWithToken(path: string, token: string, init: RequestInit, options: TransportOptions): Promise<Blob> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept-Language', requestLocale());
  headers.set('X-Request-Id', createRequestId());
  return fetchResource(getApiUrl(path), { ...init, headers }, async (response) => {
    if (!response.ok) {
      throw transportError(response.status, response.headers.get('X-Request-Id') || headers.get('X-Request-Id') || undefined);
    }
    return response.blob();
  }, options);
}

function requestWithToken<T>(path: string, token: string, init: RequestInit, options: TransportOptions) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetchApi<T>(path, { ...init, headers }, options);
}
