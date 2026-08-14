import { request } from '@/core/api/http-client';
import type { OperationsCockpitOverview } from './operations-cockpit.types';

export const operationsCockpitApi = {
  overview() {
    return request<OperationsCockpitOverview>('/api/v1/cockpit/operations', {}, { trackRouteLoading: false });
  },
};
