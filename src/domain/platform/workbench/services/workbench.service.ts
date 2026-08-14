import { fetchAuditSummary, fetchOperationAudits, type AuditSummary, type OperationAudit } from '@/domain/platform/settings/api/settings.api';
import { request } from '@/core/api/http-client';
import { createEnergyMockSnapshot } from '../providers/energyMockProvider';

export interface WorkbenchLoginRegion {
  name: string;
  loginCount: number;
  accountCount: number;
}

export interface WorkbenchLoginCity {
  regionName: string;
  cityName: string;
  loginCount: number;
}

export interface WorkbenchLoginRegionSummary {
  days: number;
  totalLogins: number;
  activeAccounts: number;
  activeRegions: number;
  activeCities: number;
  unknownLogins: number;
  regions: WorkbenchLoginRegion[];
  topCities: WorkbenchLoginCity[];
}

export interface WorkbenchRealSnapshot {
  auditSummary: AuditSummary | null;
  recentOperations: OperationAudit[];
  loginRegions: WorkbenchLoginRegionSummary | null;
}

export function loadBusinessSnapshot(clientId: number) {
  return Promise.resolve(createEnergyMockSnapshot(clientId));
}

export function loadLoginRegions(days: 1 | 7 | 30) {
  return request<WorkbenchLoginRegionSummary>(`/api/v1/workbench/login-regions?days=${days}`);
}

export async function loadRealSnapshot(canViewAudit: boolean): Promise<WorkbenchRealSnapshot> {
  const [summary, operations, loginRegions] = await Promise.allSettled([
    canViewAudit ? fetchAuditSummary() : Promise.resolve(null),
    canViewAudit ? fetchOperationAudits({ page: 1, pageSize: 5 }) : Promise.resolve(null),
    canViewAudit ? loadLoginRegions(7) : Promise.resolve(null),
  ]);
  return {
    auditSummary: summary.status === 'fulfilled' ? summary.value : null,
    recentOperations: operations.status === 'fulfilled' && operations.value ? operations.value.items : [],
    loginRegions: loginRegions.status === 'fulfilled' ? loginRegions.value : null,
  };
}
