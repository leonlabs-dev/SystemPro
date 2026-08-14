import type { DataState } from '@/design-system/types/state';
import type { RealtimeNode } from '@/domain/shared';

export type { RealtimeNode };

export interface KpiMetric {
  key: string;
  labelKey: string;
  value: string;
  unitKey?: string;
  trend: number;
  state: DataState;
  lastUpdatedAt: number;
}

export interface BusinessEntry {
  key: string;
  labelKey: string;
  routeName: string;
}

export interface AlarmItem {
  id: string;
  titleKey: string;
  level: 'error' | 'warning' | 'info';
  time: string;
}

export interface SystemLog {
  id: string;
  contentKey: string;
  time: string;
}

export interface LoadAnalysisItem {
  nameKey: string;
  value: number;
}
