export type DeviceSystemType = 'HVAC' | 'LIGHTING' | 'PARKING' | 'CHARGING' | 'SOLAR' | 'STORAGE';
export type DeviceSystemStatus = 'ACTIVE' | 'DISABLED';
export type DeviceSystemViewMode = 'card' | 'list';
export type EnergyRole = 'CONSUMPTION' | 'GENERATION' | 'BIDIRECTIONAL';
export type BindingSourceType = 'METER' | 'METERING_POINT' | 'DEVICE_ASSET';

export interface DeviceSystemProfile {
  mode: string;
  primaryCapacity?: number;
  secondaryCapacity?: number;
  designArea?: number;
  quantity?: number;
  extra?: string;
}

export interface DeviceAccessProfile {
  accessMode?: string;
  protocolTemplate?: string;
  deviceIdentifier?: string;
  gatewayName?: string;
  channelCode?: string;
  heartbeatSeconds?: number;
  firmwareVersion?: string;
  status?: string;
  version?: number;
}

export interface DeviceAsset {
  id: string;
  code: string;
  name: string;
  assetType: DeviceSystemType;
  subtype: string;
  roleCode: string;
  ownerTenantId?: string;
  ownerTenantName?: string;
  installSpaceNodeId: string;
  installSpaceName: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  capacityValue?: number;
  capacityUnit?: string;
  installedAt?: string;
  status: DeviceSystemStatus;
  remark?: string;
  version: number;
  access?: DeviceAccessProfile;
}

export interface DeviceServiceScope {
  id: string;
  spaceNodeId: string;
  spaceName: string;
  scopeMode: string;
  revisionNo: number;
  validFrom: string;
  validTo?: string;
  status: string;
}

export interface DeviceMeterBinding {
  id: string;
  purposeCode: string;
  energyRole: EnergyRole;
  sourceType: BindingSourceType;
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  revisionNo: number;
  validFrom: string;
  validTo?: string;
  status: string;
}

export interface DeviceRelationHistory {
  relationType: string;
  revisionNo: number;
  validFrom: string;
  validTo?: string;
  status: string;
  summary: string;
}

export interface DeviceSystem {
  id: string;
  code: string;
  name: string;
  systemType: DeviceSystemType;
  ownerTenantId?: string;
  ownerTenantName?: string;
  installSpaceNodeId?: string;
  installSpaceName?: string;
  status: DeviceSystemStatus;
  remark?: string;
  version: number;
  assetCount: number;
  serviceScopeCount: number;
  meterBindingCount: number;
  serviceScopeSummary?: string;
  createdAt: string;
  updatedAt: string;
  profile: DeviceSystemProfile;
  assets: DeviceAsset[];
  serviceScopes: DeviceServiceScope[];
  meterBindings: DeviceMeterBinding[];
  history: DeviceRelationHistory[];
}

export interface DeviceSystemStatistics {
  total: number;
  active: number;
  disabled: number;
  assetCount: number;
  serviceSpaceCount: number;
}

export interface DeviceSystemPage {
  items: DeviceSystem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DeviceAssetListItem {
  systemId?: string;
  systemName?: string;
  systemMode?: string;
  systemStatus?: DeviceSystemStatus;
  asset: DeviceAsset;
}

export interface DeviceSystemDeletionPreview {
  systemId: string;
  systemName: string;
  assetCount: number;
  serviceScopeCount: number;
  meterBindingCount: number;
  unassignedAssetCount: number;
}

export interface DeviceAssetPage {
  items: DeviceAssetListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DeviceAssetInput {
  id?: string;
  version?: number;
  code?: string;
  name: string;
  subtype: string;
  roleCode: string;
  ownerTenantId?: string;
  installSpaceNodeId: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  capacityValue?: number;
  capacityUnit?: string;
  installedAt?: string;
  status: DeviceSystemStatus;
  remark?: string;
  access?: DeviceAccessProfile;
}

export interface DeviceMeterBindingInput {
  purposeCode: string;
  energyRole: EnergyRole;
  sourceType: BindingSourceType;
  sourceId?: string;
  sourceCode?: string;
}

export interface DeviceSystemInput {
  code?: string;
  name: string;
  ownerTenantId?: string;
  installSpaceNodeId?: string;
  status: DeviceSystemStatus;
  remark?: string;
  profile: DeviceSystemProfile;
  assets: DeviceAssetInput[];
  serviceSpaceNodeIds: string[];
  meterBindings: DeviceMeterBindingInput[];
  version?: number;
}

export interface DeviceRuntimeSnapshot {
  communicationStatus: 'ONLINE' | 'OFFLINE' | 'WARNING';
  mode: string;
  currentValue: number;
  targetValue: number;
  secondaryValue: number;
  todayEnergy: number;
  livePower: number;
  updatedAt: string;
  quality: 'SIMULATED';
}

export interface EnergyFlowSnapshot {
  pvPower: number;
  gridPower: number;
  loadPower: number;
  storagePower: number;
  lossPower: number;
  balanceError: number;
  pvToday: number;
  gridImportToday: number;
  gridExportToday: number;
  loadToday: number;
  updatedAt: string;
  stale: boolean;
  quality: 'SIMULATED';
}

export type EnergyTrendPeriod = 'DAY' | 'MONTH' | 'YEAR';

export interface EnergyTrendPoint {
  label: string;
  pvPower: number | null;
  loadPower: number | null;
  storagePower: number | null;
  gridPower: number | null;
}

export interface IntegratedEnergySnapshot extends EnergyFlowSnapshot {
  mode: 'PV_PRIORITY_STORAGE' | 'PV_PRIORITY_EXPORT' | 'GRID_SUPPORT' | 'STORAGE_DISCHARGE';
  storageSoc: number;
  storageSoh: number;
  selfUseRate: number;
  systemEfficiency: number;
  availabilityRate: number;
  fullLoadHours: number;
  revenueToday: number;
  revenueTotal: number;
  carbonReduction: number;
  equivalentTrees: number;
}
