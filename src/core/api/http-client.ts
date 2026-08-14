import { ApiError } from './contracts';
import { fetchApi, getApiUrl } from './base-client';
import { authSession } from '@/core/auth/session.manager';
import { routeLoading } from '@/core/navigation/route-loading';

export interface RequestOptions {
  trackRouteLoading?: boolean;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  // 必须在第一个 await 之前登记；否则路由切换时会出现一帧“未加载但数据为空”。
  const trackRouteLoading = options.trackRouteLoading !== false;
  if (trackRouteLoading) routeLoading.beginRequest();
  try {
    let accessToken = await authSession.ensureAccessToken();
    if (!accessToken) {
      throw new ApiError('登录状态已失效', 'UNAUTHORIZED', 401);
    }

    try {
      return await requestWithToken<T>(path, accessToken, init);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      accessToken = (await authSession.refresh()).accessToken;
      return requestWithToken<T>(path, accessToken, init);
    }
  } finally {
    if (trackRouteLoading) routeLoading.endRequest();
  }
}

export async function requestBlob(path: string): Promise<Blob> {
  routeLoading.beginRequest();
  try {
    const token = await authSession.ensureAccessToken();
    if (!token) throw new ApiError('登录状态已失效', 'UNAUTHORIZED', 401);
    const response = await fetch(getApiUrl(path), { headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': localStorage.getItem('systempro.locale') === 'en-US' ? 'en-US' : 'zh-CN',
    } });
    if (!response.ok) throw new ApiError('文件导出失败', 'EXPORT_FAILED', response.status);
    return response.blob();
  } finally {
    routeLoading.endRequest();
  }
}

async function requestWithToken<T>(path: string, token: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetchApi<T>(path, { ...init, headers });
}
