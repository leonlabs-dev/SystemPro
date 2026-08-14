export type MeterLocale = 'zh-CN' | 'en-US';
export type MeterAssetStatus = 'active' | 'disabled';
export type MeterCommunicationStatus = 'online' | 'offline' | 'warning';
export type MeterCategory = 'total' | 'sub';
export type MeterPhaseMode = 'single_phase' | 'three_phase_three_wire' | 'three_phase_four_wire';
export type MeterViewMode = 'card' | 'list';

export interface MeterAsset {
  id: string;
  ownerTenantId: string;
  ownerTenantName: string;
  spaceNodeId: string;
  spaceName: string;
  code: string;
  name: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  category: MeterCategory;
  phaseMode: MeterPhaseMode;
  ratedCurrent: string;
  accuracyClass: string;
  multiplier: number;
  protocolTemplate: string;
  accessMode: string;
  deviceIdentifier: string;
  simNumber: string;
  gatewayName: string;
  heartbeatSeconds?: number;
  firmwareVersion: string;
  communicationStatus: MeterCommunicationStatus;
  lastSeenAt?: string;
  installedAt?: string;
  status: MeterAssetStatus;
  remark: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MeterStatistics {
  total: number;
  active: number;
  disabled: number;
  online: number;
  offline: number;
  warning: number;
}

export interface MeterPageResult {
  items: MeterAsset[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MeterListQuery {
  keyword?: string;
  status?: MeterAssetStatus | '';
  communicationStatus?: MeterCommunicationStatus | '';
  ownerTenantId?: string;
  spaceNodeId?: string;
  page?: number;
  pageSize?: number;
}

export interface MeterMutationInput {
  code?: string;
  name: string;
  serialNumber: string;
  spaceNodeId: string;
  ownerTenantId?: string;
  manufacturer?: string;
  model: string;
  category: MeterCategory;
  phaseMode: MeterPhaseMode;
  ratedCurrent?: string;
  accuracyClass?: string;
  multiplier: number;
  protocolTemplate?: string;
  accessMode?: string;
  deviceIdentifier?: string;
  simNumber?: string;
  gatewayName?: string;
  heartbeatSeconds?: number;
  firmwareVersion?: string;
  installedAt?: string;
  status: MeterAssetStatus;
  remark?: string;
  version?: number;
}

export interface MeterMetric {
  key: 'voltage' | 'current' | 'activePower' | 'powerFactor' | 'todayEnergy' | 'totalEnergy';
  value: number;
  unit: string;
}

export interface MeterDemoSnapshot {
  metrics: MeterMetric[];
  balance: number;
  prepaidStatus: 'normal' | 'low-balance' | 'overdraft';
  relayState: 'closed' | 'open';
  alarmCount: number;
  recentEvents: Array<{ id: string; title: string; occurredAt: string; status: string }>;
  recentCommands: Array<{ id: string; title: string; occurredAt: string; status: string }>;
}

export interface MeterRepository {
  page(query?: MeterListQuery): Promise<MeterPageResult>;
  statistics(): Promise<MeterStatistics>;
  getById(id: string): Promise<MeterAsset>;
  create(input: MeterMutationInput): Promise<MeterAsset>;
  update(id: string, input: MeterMutationInput): Promise<MeterAsset>;
  delete(id: string, version: number): Promise<void>;
}
