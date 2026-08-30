import { request } from '@/core/api/http-client';
import type {
  AccountDirectoryRecord,
  AccountDraft,
  AccountRecord,
  AccountRole,
  AccountStatus,
} from '../types';

interface AccountDto {
  id: number;
  clientId: number;
  defaultTenantId?: number;
  username: string;
  email?: string;
  phone?: string;
  displayName: string;
  status: string;
  forceChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  roleCodes: string[];
  orgNodeId?: number;
  positionId?: number;
}

interface AccountDirectoryDto {
  id: number;
  username: string;
  displayName: string;
  status: string;
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

export interface AccountLoginLog {
  id: number;
  loginName: string;
  authType: string;
  result: 'SUCCESS' | 'FAILURE';
    failureCode?: string;
    ipAddress?: string;
    ipCountry?: string;
    ipRegion?: string;
    ipCity?: string;
    userAgent?: string;
  occurredAt: string;
}

export interface AccountSaveInput extends AccountDraft {
  password?: string;
  defaultTenantId?: number;
}

export async function fetchAccounts(params: {
  keyword?: string;
  status?: AccountStatus | '';
  role?: string;
  orgNodeId?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<AccountPage> {
  const query = new URLSearchParams();
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.status) query.set('status', toApiStatus(params.status));
  if (params.role) query.set('roleCode', params.role.toUpperCase());
  if (params.orgNodeId) query.set('orgNodeId', params.orgNodeId);
  if (params.createdFrom) query.set('createdFrom', params.createdFrom);
  if (params.createdTo) query.set('createdTo', params.createdTo);
  query.set('page', String(params.page || 1));
  query.set('pageSize', String(params.pageSize || 20));
  const result = await request<PageDto<AccountDto>>(`/api/v1/accounts?${query}`);
  return { ...result, items: result.items.map(toAccountRecord) };
}

export function fetchAccountRoleOptions() {
  return request<AccountRoleOption[]>('/api/v1/accounts/role-options');
}

export async function fetchAccountDirectory(params: {
  page?: number;
  pageSize?: number;
} = {}): Promise<PageDto<AccountDirectoryRecord>> {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 100),
  });
  const result = await request<PageDto<AccountDirectoryDto>>(`/api/v1/accounts/directory?${query}`);
  return { ...result, items: result.items.map(toAccountDirectoryRecord) };
}

export function fetchAccountLoginLogs(id: string, page = 1, pageSize = 10) {
  return request<PageDto<AccountLoginLog>>(
    `/api/v1/accounts/${id}/login-logs?page=${page}&pageSize=${pageSize}`,
  );
}

export async function createAccount(input: AccountSaveInput): Promise<AccountRecord> {
  const dto = await request<AccountDto>('/api/v1/accounts', {
    method: 'POST',
    body: JSON.stringify(toAccountPayload(input, true)),
  });
  return toAccountRecord(dto);
}

export async function updateAccount(id: string, input: AccountSaveInput): Promise<AccountRecord> {
  const dto = await request<AccountDto>(`/api/v1/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toAccountPayload(input, false)),
  });
  return toAccountRecord(dto);
}

export async function updateAccountStatus(id: string, status: AccountStatus): Promise<AccountRecord> {
  const dto = await request<AccountDto>(`/api/v1/accounts/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: toApiStatus(status) }),
  });
  return toAccountRecord(dto);
}

export function resetAccountPassword(id: string, password: string) {
  return request<void>(`/api/v1/accounts/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function batchUpdateAccountStatus(ids: string[], status: AccountStatus) {
  return request<void>('/api/v1/accounts/batch/status', {
    method: 'PATCH',
    body: JSON.stringify({ ids: ids.map(Number), status: toApiStatus(status) }),
  });
}

export function deleteAccount(id: string) {
  return request<void>(`/api/v1/accounts/${id}`, { method: 'DELETE' });
}

export function batchDeleteAccounts(ids: string[]) {
  return request<void>('/api/v1/accounts/batch-delete', {
    method: 'POST',
    body: JSON.stringify({ ids: ids.map(Number) }),
  });
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

function toAccountDirectoryRecord(dto: AccountDirectoryDto): AccountDirectoryRecord {
  return {
    id: String(dto.id),
    username: dto.username,
    name: dto.displayName,
    role: (dto.roleCodes[0] || 'USER').toLowerCase() as AccountRole,
    roles: dto.roleCodes.map((code) => code.toLowerCase()),
    orgNodeId: dto.orgNodeId ? String(dto.orgNodeId) : '',
    positionId: dto.positionId ? String(dto.positionId) : '',
    status: dto.status.toLowerCase() as AccountStatus,
  };
}

function toAccountPayload(input: AccountSaveInput, creating: boolean) {
  return {
    username: input.username,
    email: input.email,
    phone: null,
    displayName: input.name,
    password: creating ? input.password : input.password || null,
    roleCodes: [input.role.toUpperCase()],
    defaultTenantId: input.defaultTenantId ?? null,
    tenantIds: input.defaultTenantId ? [input.defaultTenantId] : [],
    orgNodeId: input.orgNodeId ? Number(input.orgNodeId) : null,
    positionId: input.positionId ? Number(input.positionId) : null,
    status: toApiStatus(input.status),
    forceChangePassword: creating,
  };
}

function toApiStatus(status: AccountStatus) {
  return status.toUpperCase();
}

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '';
}
