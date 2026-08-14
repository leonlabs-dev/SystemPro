import { request } from '@/core/api/http-client';
import type { RoleDataScope, RoleDraft, RoleRecord } from '../types';

interface RoleDto {
  id: number;
  clientId: number;
  code: string;
  name: string;
  builtIn: boolean;
  description?: string;
  status: string;
  userCount: number;
  dataScopeType: string;
  dataScopeValue?: string;
  menuIds: number[];
  menuPaths: string[];
  permissionIds: number[];
  permissionCodes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RoleSaveInput extends RoleDraft {
  menuIds: number[];
  permissionIds: number[];
  dataScopeValue?: string;
}

export async function fetchRoles(): Promise<RoleRecord[]> {
  const rows = await request<RoleDto[]>('/api/v1/roles');
  return rows.map(toRoleRecord);
}

export async function createRole(input: RoleSaveInput): Promise<RoleRecord> {
  const dto = await request<RoleDto>('/api/v1/roles', {
    method: 'POST',
    body: JSON.stringify(toRolePayload(input)),
  });
  return toRoleRecord(dto);
}

export async function updateRole(id: string, input: RoleSaveInput): Promise<RoleRecord> {
  const dto = await request<RoleDto>(`/api/v1/roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toRolePayload(input)),
  });
  return toRoleRecord(dto);
}

export function deleteRole(id: string) {
  return request<void>(`/api/v1/roles/${id}`, { method: 'DELETE' });
}

function toRoleRecord(dto: RoleDto): RoleRecord {
  return {
    id: String(dto.id),
    clientId: dto.clientId,
    code: dto.code.toLowerCase(),
    name: dto.name,
    description: dto.description || '',
    status: dto.status === 'ACTIVE' ? 'enabled' : 'disabled',
    userCount: dto.userCount,
    menuPaths: dto.menuPaths,
    actionPermissions: dto.permissionCodes,
    dataScope: toDataScope(dto.dataScopeType),
    createdAt: formatDateTime(dto.createdAt),
    updatedAt: formatDateTime(dto.updatedAt),
  };
}

function toRolePayload(input: RoleSaveInput) {
  return {
    code: input.code.toUpperCase(),
    name: input.name,
    description: input.description,
    status: input.status === 'enabled' ? 'ACTIVE' : 'DISABLED',
    dataScopeType: fromDataScope(input.dataScope),
    dataScopeValue: input.dataScopeValue || null,
    menuIds: input.menuIds,
    permissionIds: input.permissionIds,
  };
}

function toDataScope(value: string): RoleDataScope {
  const values: Record<string, RoleDataScope> = {
    ALL_CLIENT: 'all', ORG_AND_CHILDREN: 'org', DEPARTMENT: 'department', SELF: 'self', CUSTOM: 'custom',
  };
  return values[value] || 'self';
}

function fromDataScope(value: RoleDataScope) {
  return { all: 'ALL_CLIENT', org: 'ORG_AND_CHILDREN', department: 'DEPARTMENT', self: 'SELF', custom: 'CUSTOM' }[value];
}

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '';
}
