export interface ParkingMonitoringResponse {
  generatedAt: string;
  dataQuality: 'CONFIGURATION_AND_BUSINESS_EVENTS';
  telemetryConnected: boolean;
  summary: ParkingMonitoringSummary;
  systems: ParkingMonitoringSystem[];
  alarms: ParkingMonitoringAlarm[];
}

export interface ParkingMonitoringSummary {
  activeSystemCount: number;
  configuredParkingSpaceCount: number;
  configuredLaneCount: number;
  activeAssetCount: number;
  serviceSpaceCount: number;
  activeAlarmCount: number;
}

export interface ParkingMonitoringSystem {
  id: number;
  code: string;
  name: string;
  status: string;
  operationMode?: string;
  configuredParkingSpaceCount: number;
  configuredLaneCount: number;
  serviceScopeSummary?: string;
  assets: ParkingMonitoringAsset[];
}

export interface ParkingMonitoringAsset {
  id: number;
  code: string;
  name: string;
  subtype: string;
  roleCode?: string;
  installSpaceName?: string;
  status: string;
  accessMode?: string;
  protocolTemplate?: string;
  gatewayName?: string;
  accessStatus?: string;
}

export interface ParkingMonitoringAlarm {
  id: number;
  code: string;
  assetId?: number;
  assetCode?: string;
  assetName?: string;
  title: string;
  severity: string;
  status: string;
  description?: string;
  occurredAt: string;
  workOrderCode?: string;
}

export type SimulatedSpaceStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CHARGING' | 'FAULT' | 'ACCESSIBLE';
export type ParkingZone = 'A' | 'B' | 'C' | 'D';

export interface SimulatedParkingSpace {
  id: string;
  label: string;
  zone: ParkingZone;
  x: number;
  y: number;
  width: number;
  height: number;
  status: SimulatedSpaceStatus;
}

export interface SimulatedParkingRuntime {
  quality: 'SIMULATED';
  updatedAt: string;
  occupied: number;
  available: number;
  reserved: number;
  charging: number;
  fault: number;
  accessible: number;
  occupancyRate: number;
  todayEntries: number;
  todayExits: number;
  averageStayMinutes: number;
  sampleSpaces: SimulatedParkingSpace[];
  assetRuntime: Record<number, 'ONLINE' | 'OFFLINE' | 'WARNING'>;
}
