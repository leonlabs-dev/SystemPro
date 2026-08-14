import { request } from '@/core/api/http-client';

export type EnergySystemType = 'HVAC' | 'LIGHTING' | 'PARKING' | 'CHARGING' | 'SOLAR' | 'STORAGE';
export type EnergyRole = 'CONSUMPTION' | 'GENERATION' | 'BIDIRECTIONAL';

export interface EnergyMeterBinding {
  id: number;
  purposeCode: string;
  energyRole: EnergyRole;
  sourceType: 'METER' | 'METERING_POINT' | 'DEVICE_ASSET';
  sourceId?: number;
  sourceCode?: string;
  sourceName?: string;
}

export interface EnergyTopologySystem {
  id: number;
  code: string;
  name: string;
  systemType: EnergySystemType;
  status: string;
  assetCount: number;
  serviceScopeSummary?: string;
  profileMode?: string;
  primaryCapacity?: number;
  meterBindings: EnergyMeterBinding[];
}

export interface EnergyMeteringRelation {
  id: number;
  parentPointId: number;
  parentPointCode: string;
  parentPointName: string;
  parentMeterName: string;
  childPointId: number;
  childPointCode: string;
  childPointName: string;
  childMeterName: string;
  energyType: string;
  unitSymbol: string;
  relationType: string;
  contributionFactor: number;
  status: string;
}

export interface EnergyTopology {
  generatedAt: string;
  dataQuality: 'CONFIGURATION_ONLY';
  summary: {
    activeSystemCount: number;
    assetCount: number;
    meterBindingCount: number;
    meteringRelationCount: number;
  };
  systems: EnergyTopologySystem[];
  meteringRelations: EnergyMeteringRelation[];
}

export const energyTopologyApi = {
  get: () => request<EnergyTopology>('/api/v1/energy-topology'),
};
