import { request } from '@/core/api/http-client';
import type {
  MeterAsset,
  MeterAssetStatus,
  MeterCategory,
  MeterCommunicationStatus,
  MeterListQuery,
  MeterMutationInput,
  MeterPageResult,
  MeterPhaseMode,
  MeterRepository,
  MeterStatistics,
} from './types';

interface MeterDto {
  id: number;
  ownerTenantId?: number;
  ownerTenantName?: string;
  spaceNodeId: number;
  spaceName: string;
  code: string;
  name: string;
  serialNumber: string;
  manufacturer?: string;
  model: string;
  category: string;
  phaseMode: string;
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
  communicationStatus: string;
  lastSeenAt?: string;
  installedAt?: string;
  status: string;
  remark?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface PageDto<T> { items: T[]; total: number; page: number; pageSize: number }

export const meterApiRepository: MeterRepository = {
  async page(query: MeterListQuery = {}): Promise<MeterPageResult> {
    const params = new URLSearchParams();
    if (query.keyword) params.set('keyword', query.keyword);
    if (query.status) params.set('status', query.status.toUpperCase());
    if (query.communicationStatus) params.set('communicationStatus', query.communicationStatus.toUpperCase());
    if (query.spaceNodeId) params.set('spaceNodeId', query.spaceNodeId);
    if (query.ownerTenantId) params.set('ownerTenantId', query.ownerTenantId);
    params.set('page', String(query.page || 1));
    params.set('pageSize', String(query.pageSize || 12));
    const result = await request<PageDto<MeterDto>>(`/api/v1/meters?${params}`);
    return { ...result, items: result.items.map(toMeterAsset) };
  },

  statistics() {
    return request<MeterStatistics>('/api/v1/meters/statistics');
  },

  async getById(id: string) {
    return toMeterAsset(await request<MeterDto>(`/api/v1/meters/${id}`));
  },

  async create(input: MeterMutationInput) {
    return toMeterAsset(await request<MeterDto>('/api/v1/meters', {
      method: 'POST', body: JSON.stringify(toPayload(input)),
    }));
  },

  async update(id: string, input: MeterMutationInput) {
    return toMeterAsset(await request<MeterDto>(`/api/v1/meters/${id}`, {
      method: 'PUT', body: JSON.stringify(toPayload(input)),
    }));
  },

  delete(id: string, version: number) {
    return request<void>(`/api/v1/meters/${id}?version=${version}`, { method: 'DELETE' });
  },
};

function toMeterAsset(dto: MeterDto): MeterAsset {
  return {
    id: String(dto.id),
    ownerTenantId: dto.ownerTenantId ? String(dto.ownerTenantId) : '',
    ownerTenantName: dto.ownerTenantName || '',
    spaceNodeId: String(dto.spaceNodeId),
    spaceName: dto.spaceName,
    code: dto.code,
    name: dto.name,
    serialNumber: dto.serialNumber,
    manufacturer: dto.manufacturer || '',
    model: dto.model,
    category: dto.category.toLowerCase() as MeterCategory,
    phaseMode: dto.phaseMode.toLowerCase() as MeterPhaseMode,
    ratedCurrent: dto.ratedCurrent || '',
    accuracyClass: dto.accuracyClass || '',
    multiplier: Number(dto.multiplier),
    protocolTemplate: dto.protocolTemplate || '',
    accessMode: dto.accessMode || '',
    deviceIdentifier: dto.deviceIdentifier || '',
    simNumber: dto.simNumber || '',
    gatewayName: dto.gatewayName || '',
    heartbeatSeconds: dto.heartbeatSeconds,
    firmwareVersion: dto.firmwareVersion || '',
    communicationStatus: dto.communicationStatus.toLowerCase() as MeterCommunicationStatus,
    lastSeenAt: dto.lastSeenAt,
    installedAt: dto.installedAt,
    status: dto.status.toLowerCase() as MeterAssetStatus,
    remark: dto.remark || '',
    version: dto.version,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function toPayload(input: MeterMutationInput) {
  return {
    ...input,
    spaceNodeId: Number(input.spaceNodeId),
    ownerTenantId: input.ownerTenantId ? Number(input.ownerTenantId) : null,
    code: input.code || null,
    category: input.category.toUpperCase(),
    phaseMode: input.phaseMode.toUpperCase(),
    status: input.status.toUpperCase(),
    installedAt: input.installedAt || null,
    heartbeatSeconds: input.heartbeatSeconds || null,
  };
}
