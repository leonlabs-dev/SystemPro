import { request } from '@/core/api/http-client';
import type { SsoProviderDraft, SsoProviderRecord } from '../sso';

interface SsoProviderDto {
  id: number;
  clientId: number;
  code: string;
  name: string;
  vendor: string;
  protocol: string;
  status: string;
  matchField: string;
  autoCreateAccount: boolean;
  syncEnabled: boolean;
  boundAccounts: number;
  lastSyncAt?: string;
  secretConfigured: boolean;
  appClientId?: string;
  issuer?: string;
  authUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  callbackUrl?: string;
  defaultRole?: string;
  unmatchedPolicy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchIdentityProviders(): Promise<SsoProviderRecord[]> {
  const rows = await request<SsoProviderDto[]>('/api/v1/identity-providers');
  return rows.map(toProviderRecord);
}

export async function createIdentityProvider(input: SsoProviderDraft): Promise<SsoProviderRecord> {
  const dto = await request<SsoProviderDto>('/api/v1/identity-providers', {
    method: 'POST', body: JSON.stringify(toPayload(input)),
  });
  return toProviderRecord(dto);
}

export async function updateIdentityProvider(id: string, input: SsoProviderDraft): Promise<SsoProviderRecord> {
  const dto = await request<SsoProviderDto>(`/api/v1/identity-providers/${id}`, {
    method: 'PUT', body: JSON.stringify(toPayload(input)),
  });
  return toProviderRecord(dto);
}

export function checkIdentityProvider(id: string) {
  return request<{ success: boolean; message: string }>(`/api/v1/identity-providers/${id}/connection-check`, {
    method: 'POST',
  });
}

export async function syncIdentityProvider(id: string): Promise<SsoProviderRecord> {
  const dto = await request<SsoProviderDto>(`/api/v1/identity-providers/${id}/sync`, { method: 'POST' });
  return toProviderRecord(dto);
}

export function deleteIdentityProvider(id: string) {
  return request<void>(`/api/v1/identity-providers/${id}`, { method: 'DELETE' });
}

function toProviderRecord(dto: SsoProviderDto): SsoProviderRecord {
  return {
    id: String(dto.id),
    clientId: dto.clientId,
    code: dto.code,
    name: dto.name,
    vendor: dto.vendor,
    protocol: dto.protocol.toLowerCase() as SsoProviderRecord['protocol'],
    status: ({ ACTIVE: 'enabled', DISABLED: 'disabled', DRAFT: 'draft' }[dto.status] || 'draft') as SsoProviderRecord['status'],
    appClientId: dto.appClientId || '',
    clientSecret: '',
    issuer: dto.issuer || '',
    authUrl: dto.authUrl || '',
    tokenUrl: dto.tokenUrl || '',
    userInfoUrl: dto.userInfoUrl || '',
    callbackUrl: dto.callbackUrl || '',
    matchField: dto.matchField.toLowerCase() === 'employee_no' ? 'employeeNo' : dto.matchField.toLowerCase() as SsoProviderRecord['matchField'],
    defaultRole: (dto.defaultRole || 'USER').toLowerCase(),
    unmatchedPolicy: (dto.unmatchedPolicy || 'REJECT').toLowerCase() as SsoProviderRecord['unmatchedPolicy'],
    autoCreateAccount: dto.autoCreateAccount,
    syncEnabled: dto.syncEnabled,
    boundAccounts: dto.boundAccounts,
    lastSyncAt: formatDateTime(dto.lastSyncAt) || '-',
    createdAt: formatDateTime(dto.createdAt),
    updatedAt: formatDateTime(dto.updatedAt),
  };
}

function toPayload(input: SsoProviderDraft) {
  return {
    code: input.code,
    name: input.name,
    vendor: input.vendor,
    protocol: input.protocol.toUpperCase(),
    status: ({ enabled: 'ACTIVE', disabled: 'DISABLED', draft: 'DRAFT' })[input.status],
    appClientId: input.appClientId || null,
    clientSecret: input.clientSecret || null,
    issuer: input.issuer || null,
    authUrl: input.authUrl || null,
    tokenUrl: input.tokenUrl || null,
    userInfoUrl: input.userInfoUrl || null,
    callbackUrl: input.callbackUrl || null,
    matchField: input.matchField === 'employeeNo' ? 'EMPLOYEE_NO' : input.matchField.toUpperCase(),
    defaultRole: input.defaultRole.toUpperCase(),
    unmatchedPolicy: input.unmatchedPolicy.toUpperCase(),
    autoCreateAccount: input.autoCreateAccount,
    syncEnabled: input.syncEnabled,
  };
}

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '';
}
