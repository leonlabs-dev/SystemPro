export type WorkbenchDataSource = 'MOCK' | 'REAL';

export interface EnergyKpi {
  key: 'consumption' | 'grid' | 'pv' | 'device' | 'meter' | 'alarm';
  value: number;
  unit: string;
  change: number;
  tone: 'blue' | 'cyan' | 'green' | 'orange' | 'purple' | 'red';
}

export interface EnergyTrendPoint {
  hour: string;
  pv: number | null;
  grid: number | null;
  load: number | null;
}

export interface SpaceEnergyItem { name: string; value: number; change: number }

export interface AlarmTrendItem {
  day: string;
  total: number;
  unhandled: number;
  handled: number;
}

export interface WorkbenchBusinessSnapshot {
  source: WorkbenchDataSource;
  generatedAt: string;
  kpis: EnergyKpi[];
  trend: EnergyTrendPoint[];
  alarmTrend: AlarmTrendItem[];
  spaceEnergy: SpaceEnergyItem[];
  device: { total: number; online: number; offline: number; pending: number };
  deviceTypes: Array<{ name: string; value: number }>;
  alarm: { today: number; unhandled: number; handled: number; handleRate: number };
}
