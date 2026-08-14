import { request } from '@/core/api/http-client';

export type AlarmSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
export type AlarmStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'SUPPRESSED' | 'RECOVERED';

export interface AlarmEvent {
  id: number;
  code: string;
  ruleId?: number;
  assetId?: number;
  assetCode: string;
  assetName: string;
  sourceType: string;
  title: string;
  severity: AlarmSeverity;
  status: AlarmStatus;
  measuredValue?: number;
  thresholdValue?: number;
  valueUnit?: string;
  description?: string;
  occurredAt: string;
  acknowledgedAt?: string;
  recoveredAt?: string;
  workOrderId?: number;
  workOrderCode?: string;
  version: number;
}

export interface NamedCount {
  name: string;
  value: number;
}

export interface AlarmRanking {
  name: string;
  secondary?: string;
  total: number;
  critical: number;
  active: number;
  averageMinutes?: number;
}

export interface AlarmTrend {
  day: string;
  total: number;
  critical: number;
  recovered: number;
}

export interface AlarmStatistics {
  days: number;
  summary: {
    total: number;
    active: number;
    critical: number;
    converted: number;
    recovered: number;
    conversionRate: number;
    averageRecoveryMinutes: number;
  };
  trend: AlarmTrend[];
  severityDistribution: NamedCount[];
  sourceDistribution: NamedCount[];
  statusDistribution: NamedCount[];
  eventTotal: number;
  eventPage: number;
  eventPageSize: number;
  recentEvents: AlarmEvent[];
  severityRanking: AlarmRanking[];
  durationRanking: AlarmRanking[];
  assetRanking: AlarmRanking[];
  ruleRanking: AlarmRanking[];
}

function toQuery(input: Record<string, unknown>) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const alarmStatisticsApi = {
  statistics: (filters: Record<string, unknown>) =>
    request<AlarmStatistics>(`/api/v1/alarm-statistics${toQuery(filters)}`),
};
