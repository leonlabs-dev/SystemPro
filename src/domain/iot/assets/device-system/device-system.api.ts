import { request, requestBlob } from '@/core/api/http-client';
import type {
  DeviceAsset,
  DeviceAssetPage,
  DeviceMeterBinding,
  DeviceRelationHistory,
  DeviceServiceScope,
  DeviceSystem,
  DeviceSystemInput,
  DeviceSystemPage,
  DeviceSystemStatistics,
  DeviceSystemDeletionPreview,
  DeviceSystemType,
} from './types';

interface PageDto<T> { items: T[]; total: number; page: number; pageSize: number }

export const deviceSystemApi = {
  async page(type: DeviceSystemType, query: { keyword?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<DeviceSystemPage> {
    const params = new URLSearchParams();
    if (query.keyword) params.set('keyword', query.keyword);
    if (query.status) params.set('status', query.status);
    params.set('page', String(query.page || 1));
    params.set('pageSize', String(query.pageSize || 10));
    const result = await request<PageDto<DeviceSystemDto>>(`/api/v1/device-systems/${type.toLowerCase()}?${params}`);
    return { ...result, items: result.items.map(toDeviceSystem) };
  },

  statistics(type: DeviceSystemType) {
    return request<DeviceSystemStatistics>(`/api/v1/device-systems/${type.toLowerCase()}/statistics`);
  },

  async get(type: DeviceSystemType, id: string) {
    return toDeviceSystem(await request<DeviceSystemDto>(`/api/v1/device-systems/${type.toLowerCase()}/${id}`));
  },

  async create(type: DeviceSystemType, input: DeviceSystemInput) {
    return toDeviceSystem(await request<DeviceSystemDto>(`/api/v1/device-systems/${type.toLowerCase()}`, {
      method: 'POST',
      body: JSON.stringify(toPayload(input)),
    }));
  },

  async update(type: DeviceSystemType, id: string, input: DeviceSystemInput) {
    return toDeviceSystem(await request<DeviceSystemDto>(`/api/v1/device-systems/${type.toLowerCase()}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toPayload(input)),
    }));
  },

  delete(type: DeviceSystemType, id: string, version: number) {
    return request<void>(`/api/v1/device-systems/${type.toLowerCase()}/${id}?version=${version}`, {
      method: 'DELETE',
    });
  },

  async deletionPreview(type: DeviceSystemType, id: string): Promise<DeviceSystemDeletionPreview> {
    const result = await request<Omit<DeviceSystemDeletionPreview, 'systemId'> & { systemId: number }>(
      `/api/v1/device-systems/${type.toLowerCase()}/${id}/deletion-preview`,
    );
    return { ...result, systemId: String(result.systemId) };
  },
};

export const deviceAssetApi = {
  async page(type: DeviceSystemType, query: { keyword?: string; status?: string; subtype?: string; systemId?: string; spaceId?: string; page?: number; pageSize?: number } = {}): Promise<DeviceAssetPage> {
    const params = new URLSearchParams();
    if (query.keyword) params.set('keyword', query.keyword);
    if (query.status) params.set('status', query.status);
    if (query.subtype) params.set('subtype', query.subtype);
    if (query.systemId) params.set('systemId', query.systemId);
    if (query.spaceId) params.set('spaceId', query.spaceId);
    params.set('page', String(query.page || 1));
    params.set('pageSize', String(query.pageSize || 20));
    const result = await request<PageDto<DeviceAssetListDto>>(`/api/v1/device-assets/${type.toLowerCase()}?${params}`);
    return {
      ...result,
      items: result.items.map(item => ({
        ...item,
        systemId: item.systemId == null ? undefined : String(item.systemId),
        systemStatus: item.systemStatus as DeviceSystem['status'] | undefined,
        asset: toDeviceAsset(item.asset),
      })),
    };
  },
  async unassigned(type: DeviceSystemType, query: { keyword?: string; status?: string; subtype?: string; spaceId?: string; page?: number; pageSize?: number } = {}): Promise<DeviceAssetPage> {
    const params = new URLSearchParams();
    if (query.keyword) params.set('keyword', query.keyword);
    if (query.status) params.set('status', query.status);
    if (query.subtype) params.set('subtype', query.subtype);
    if (query.spaceId) params.set('spaceId', query.spaceId);
    params.set('page', String(query.page || 1));
    params.set('pageSize', String(query.pageSize || 20));
    const result = await request<PageDto<DeviceAssetListDto>>(`/api/v1/device-assets/${type.toLowerCase()}/unassigned?${params}`);
    return {
      ...result,
      items: result.items.map(item => ({
        ...item,
        systemId: item.systemId == null ? undefined : String(item.systemId),
        systemStatus: item.systemStatus as DeviceSystem['status'] | undefined,
        asset: toDeviceAsset(item.asset),
      })),
    };
  },
  export(type: DeviceSystemType, query: { keyword?: string; status?: string; subtype?: string; systemId?: string } = {}) {
    const params = new URLSearchParams();
    if (query.keyword) params.set('keyword', query.keyword);
    if (query.status) params.set('status', query.status);
    if (query.subtype) params.set('subtype', query.subtype);
    if (query.systemId) params.set('systemId', query.systemId);
    return requestBlob(`/api/v1/device-assets/${type.toLowerCase()}/export?${params}`);
  },
};

interface DeviceAssetListDto {
  systemId?: number;
  systemName?: string;
  systemMode?: string;
  systemStatus?: string;
  asset: DeviceAssetDto;
}

interface DeviceSystemDto {
  id: number;
  code: string;
  name: string;
  systemType: DeviceSystemType;
  ownerTenantId?: number;
  ownerTenantName?: string;
  installSpaceNodeId?: number;
  installSpaceName?: string;
  status: string;
  remark?: string;
  version: number;
  assetCount: number;
  serviceScopeCount: number;
  meterBindingCount: number;
  serviceScopeSummary?: string;
  createdAt: string;
  updatedAt: string;
  profile?: DeviceSystem['profile'];
  assets?: Array<Omit<DeviceAsset, 'id' | 'ownerTenantId' | 'installSpaceNodeId'> & {
    id: number;
    ownerTenantId?: number;
    installSpaceNodeId: number;
  }>;
  serviceScopes?: Array<Omit<DeviceServiceScope, 'id' | 'spaceNodeId'> & { id: number; spaceNodeId: number }>;
  meterBindings?: Array<Omit<DeviceMeterBinding, 'id' | 'sourceId'> & { id: number; sourceId?: number }>;
  history?: DeviceRelationHistory[];
}

type DeviceAssetDto = NonNullable<DeviceSystemDto['assets']>[number];

function toDeviceSystem(dto: DeviceSystemDto): DeviceSystem {
  return {
    ...dto,
    id: String(dto.id),
    ownerTenantId: dto.ownerTenantId ? String(dto.ownerTenantId) : '',
    installSpaceNodeId: dto.installSpaceNodeId ? String(dto.installSpaceNodeId) : '',
    status: dto.status as DeviceSystem['status'],
    profile: dto.profile || { mode: '' },
    assets: (dto.assets || []).map(toDeviceAsset),
    serviceScopes: (dto.serviceScopes || []).map(scope => ({
      ...scope,
      id: String(scope.id),
      spaceNodeId: String(scope.spaceNodeId),
    })),
    meterBindings: (dto.meterBindings || []).map(binding => ({
      ...binding,
      id: String(binding.id),
      sourceId: binding.sourceId ? String(binding.sourceId) : '',
    })),
    history: dto.history || [],
  };
}

function toDeviceAsset(asset: DeviceAssetDto): DeviceAsset {
  return {
    ...asset,
    id: String(asset.id),
    ownerTenantId: asset.ownerTenantId ? String(asset.ownerTenantId) : '',
    installSpaceNodeId: String(asset.installSpaceNodeId),
    status: asset.status as DeviceAsset['status'],
  };
}

function toPayload(input: DeviceSystemInput) {
  return {
    ...input,
    ownerTenantId: input.ownerTenantId ? Number(input.ownerTenantId) : null,
    installSpaceNodeId: input.installSpaceNodeId ? Number(input.installSpaceNodeId) : null,
    serviceSpaceNodeIds: input.serviceSpaceNodeIds.map(Number),
    assets: input.assets.map(asset => ({
      ...asset,
      id: asset.id ? Number(asset.id) : null,
      ownerTenantId: asset.ownerTenantId ? Number(asset.ownerTenantId) : null,
      installSpaceNodeId: Number(asset.installSpaceNodeId),
      installedAt: asset.installedAt || null,
      capacityValue: asset.capacityValue ?? null,
      access: asset.access || null,
    })),
    meterBindings: input.meterBindings.map(binding => ({
      ...binding,
      sourceId: binding.sourceId ? Number(binding.sourceId) : null,
    })),
  };
}
