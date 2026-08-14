import { request } from '@/core/api/http-client';
import type { ResourceNode, ResourceNodeStatus, ResourceNodeType } from '../resource';

interface SpaceDto {
  id: number;
  parentId: number;
  code: string;
  name: string;
  type: string;
  status: string;
  remark?: string;
  sortOrder: number;
  tenantIds: number[];
  projectType?: string;
  projectPhase?: 'PLANNING' | 'DELIVERY' | 'OPERATING' | 'COMPLETED';
  provinceName?: string;
  cityName?: string;
  longitude?: number;
  latitude?: number;
  serviceAreaSquareMeters?: number;
  children: SpaceDto[];
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchSpaceTree(): Promise<ResourceNode[]> {
  const rows = await request<SpaceDto[]>('/api/v1/spaces/tree');
  return rows.map(toResourceNode);
}

export async function createSpace(input: ResourceNode): Promise<ResourceNode> {
  const dto = await request<SpaceDto>('/api/v1/spaces', {
    method: 'POST', body: JSON.stringify(toPayload(input)),
  });
  return toResourceNode(dto);
}

export async function updateSpace(id: string, input: ResourceNode): Promise<ResourceNode> {
  const dto = await request<SpaceDto>(`/api/v1/spaces/${id}`, {
    method: 'PUT', body: JSON.stringify(toPayload(input)),
  });
  return toResourceNode(dto);
}

export function deleteSpace(id: string) {
  return request<void>(`/api/v1/spaces/${id}`, { method: 'DELETE' });
}

function toResourceNode(dto: SpaceDto): ResourceNode {
  return {
    id: String(dto.id),
    parentId: dto.parentId ? String(dto.parentId) : '',
    code: dto.code,
    name: dto.name,
    type: (dto.type === 'ROOT' ? 'project' : dto.type.toLowerCase()) as ResourceNodeType,
    status: ({ ACTIVE: 'enabled', DISABLED: 'disabled', DEPRECATED: 'deprecated' }[dto.status] || 'disabled') as ResourceNodeStatus,
    remark: dto.remark || '',
    tenantIds: (dto.tenantIds || []).map(String),
    projectType: dto.projectType,
    projectPhase: dto.projectPhase,
    provinceName: dto.provinceName,
    cityName: dto.cityName,
    longitude: dto.longitude,
    latitude: dto.latitude,
    serviceAreaSquareMeters: dto.serviceAreaSquareMeters,
    children: (dto.children || []).map(toResourceNode),
    createdAt: formatDateTime(dto.createdAt),
    updatedAt: formatDateTime(dto.updatedAt),
  };
}

function toPayload(input: ResourceNode) {
  return {
    parentId: input.parentId ? Number(input.parentId) : 0,
    code: input.code || `SPACE_${Date.now()}`,
    name: input.name,
    type: input.type.toUpperCase(),
    status: ({ enabled: 'ACTIVE', disabled: 'DISABLED', deprecated: 'DEPRECATED' })[input.status],
    remark: input.remark || null,
    sortOrder: 0,
    tenantIds: (input.tenantIds || []).map(Number),
    projectType: input.projectType || null,
    projectPhase: input.projectPhase || null,
    provinceName: input.provinceName || null,
    cityName: input.cityName || null,
    longitude: input.longitude ?? null,
    latitude: input.latitude ?? null,
    serviceAreaSquareMeters: input.serviceAreaSquareMeters ?? null,
  };
}

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '';
}
