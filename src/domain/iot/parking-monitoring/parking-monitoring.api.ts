import { request } from '@/core/api/http-client';
import type { ParkingMonitoringResponse } from './types';

export const parkingMonitoringApi = {
  get() {
    return request<ParkingMonitoringResponse>('/api/v1/parking-monitoring');
  },
};
