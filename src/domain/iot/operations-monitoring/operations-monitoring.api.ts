import { request } from '@/core/api/http-client';
import type { DeviceMonitoringPage, GatewayChannelMonitoringPage, GatewayMonitoringPage, GridMonitoringPage, VideoMonitoringPage } from './types';

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  return search.toString();
}

export const operationsMonitoringApi = {
  devices: (params: { keyword?: string; systemType?: string; consistency?: string; page: number; pageSize: number }) =>
    request<DeviceMonitoringPage>(`/api/v1/operations-monitoring/devices?${query(params)}`),
  gateways: (params: { keyword?: string; page: number; pageSize: number }) =>
    request<GatewayMonitoringPage>(`/api/v1/operations-monitoring/gateways?${query(params)}`),
  gatewayChannels: (params: { gatewayName: string; keyword?: string; consistency?: string; page: number; pageSize: number }) =>
    request<GatewayChannelMonitoringPage>(`/api/v1/operations-monitoring/gateway-channels?${query(params)}`),
  gridModes: (params: { page: number; pageSize: number }) =>
    request<GridMonitoringPage>(`/api/v1/operations-monitoring/grid-modes?${query(params)}`),
  videoChannels: (params: { keyword?: string; consistency?: string; page: number; pageSize: number }) =>
    request<VideoMonitoringPage>(`/api/v1/operations-monitoring/video-channels?${query(params)}`),
};
