import { request } from '@/core/api/http-client';
import type { OrganizationDraft, OrganizationNode, OrganizationStatus, OrganizationType } from '../organization';

interface OrganizationDto {
  id: number;
  parentId: number;
  code: string;
  name: string;
  type: string;
  status: string;
  leaderName?: string;
  leaderAccountId?: number;
  contactPhone?: string;
  city?: string;
  address?: string;
  remark?: string;
  accountCount: number;
  positionCount: number;
  children: OrganizationDto[];
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchOrganizations(): Promise<OrganizationNode[]> {
  const rows = await request<OrganizationDto[]>('/api/v1/organizations/tree');
  return rows.map(toOrganizationNode);
}

export async function createOrganization(input: OrganizationDraft): Promise<OrganizationNode> {
  const dto = await request<OrganizationDto>('/api/v1/organizations', {
    method: 'POST', body: JSON.stringify(toPayload(input)),
  });
  return toOrganizationNode(dto);
}

export async function updateOrganization(id: string, input: OrganizationDraft): Promise<OrganizationNode> {
  const dto = await request<OrganizationDto>(`/api/v1/organizations/${id}`, {
    method: 'PUT', body: JSON.stringify(toPayload(input)),
  });
  return toOrganizationNode(dto);
}

export function deleteOrganization(id: string) {
  return request<void>(`/api/v1/organizations/${id}`, { method: 'DELETE' });
}

function toOrganizationNode(dto: OrganizationDto): OrganizationNode {
  return {
    id: String(dto.id),
    parentId: dto.parentId ? String(dto.parentId) : null,
    name: dto.name,
    code: dto.code,
    description: dto.remark || '',
    type: dto.type.toLowerCase() as OrganizationType,
    manager: dto.leaderName || '',
    leaderAccountId: dto.leaderAccountId ? String(dto.leaderAccountId) : '',
    phone: dto.contactPhone || '',
    city: dto.city || '',
    address: dto.address || '',
    projectCount: 0,
    stationCount: 0,
    remark: dto.remark || '',
    accountCount: dto.accountCount,
    status: (dto.status === 'ACTIVE' ? 'enabled' : 'disabled') as OrganizationStatus,
    children: (dto.children || []).map(toOrganizationNode),
    createdAt: formatDateTime(dto.createdAt),
    updatedAt: formatDateTime(dto.updatedAt),
  };
}

function toPayload(input: OrganizationDraft) {
  return {
    parentId: input.parentId ? Number(input.parentId) : 0,
    code: input.code,
    name: input.name,
    type: input.type.toUpperCase(),
    status: input.status === 'enabled' ? 'ACTIVE' : 'DISABLED',
    leaderAccountId: input.leaderAccountId ? Number(input.leaderAccountId) : null,
    contactPhone: input.phone || null,
    city: input.city || null,
    address: input.address || null,
    remark: input.remark || input.description || null,
    sortOrder: 0,
  };
}

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '';
}
