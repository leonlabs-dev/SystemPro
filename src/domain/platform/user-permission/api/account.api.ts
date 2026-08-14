import { request } from '@/core/api/http-client';
import type { AccountRecord, AccountRole, AccountStatus } from '../types';

interface AccountDto {
  id: number;
  clientId: number;
  username: string;
  email?: string;
  displayName: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  roleCodes: string[];
  orgNodeId?: number;
  positionId?: number;
}

interface PageDto<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AccountPage {
  items: AccountRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AccountRoleOption {
  id: number;
  code: string;
  name: string;
}

export async function fetchAccounts(params: {
  keyword?: string;
  status?: AccountStatus | '';
  role?: string;
  orgNodeId?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<AccountPage> {
  const query = new URLSearchParams();
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.status) query.set('status', params.status.toUpperCase());
  if (params.role) query.set('roleCode', params.role.toUpperCase());
  if (params.orgNodeId) query.set('orgNodeId', params.orgNodeId);
  query.set('page', String(params.page || 1));
  query.set('pageSize', String(params.pageSize || 20));
  const result = await request<PageDto<AccountDto>>(`/api/v1/accounts?${query}`);
  return { ...result, items: result.items.map(toAccountRecord) };
}

export function fetchAccountRoleOptions() {
  return request<AccountRoleOption[]>('/api/v1/accounts/role-options');
}

function toAccountRecord(dto: AccountDto): AccountRecord {
  return {
    id: String(dto.id),
    clientId: dto.clientId,
    username: dto.username,
    email: dto.email || '',
    name: dto.displayName,
    role: (dto.roleCodes[0] || 'USER').toLowerCase() as AccountRole,
    roles: dto.roleCodes.map((code) => code.toLowerCase()),
    orgNodeId: dto.orgNodeId ? String(dto.orgNodeId) : '',
    positionId: dto.positionId ? String(dto.positionId) : '',
    status: dto.status.toLowerCase() as AccountStatus,
    lastLoginAt: formatDateTime(dto.lastLoginAt),
    createdAt: formatDateTime(dto.createdAt),
    updatedAt: formatDateTime(dto.updatedAt),
  };
}

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '';
}
