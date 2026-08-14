export interface CockpitSystemSummary {
  total: number;
  active: number;
  disabled: number;
  assetCount: number;
  serviceSpaceCount: number;
  primarySystemId?: string;
  primarySystemCode?: string;
  primarySystemName?: string;
  serviceScope?: string;
  mode?: string;
  primaryCapacity?: number;
  secondaryCapacity?: number;
}

export interface CockpitAlarmItem {
  code: string;
  title: string;
  assetName?: string;
  severity: string;
  status: string;
  occurredAt: string;
}

export interface CockpitAlarmSummary {
  openEventCount: number;
  criticalOpenEventCount: number;
  affectedAssetCount: number;
  solarAffectedAssetCount: number;
  storageAffectedAssetCount: number;
  chargingAffectedAssetCount: number;
}

export interface CarbonCockpitOverview {
  siteName: string;
  solar: CockpitSystemSummary;
  storage: CockpitSystemSummary;
  charging: CockpitSystemSummary;
  alarms: CockpitAlarmSummary;
  telemetryQuality: 'REALTIME' | 'PARTIAL' | 'SIMULATED';
  recentAlarms: CockpitAlarmItem[];
  generatedAt: string;
}
