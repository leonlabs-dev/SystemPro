import { request } from '@/core/api/http-client';
import type { TenantRecord, TenantStatus } from '../types';

interface TenantDto {
  id: number;
  code: string;
  name: string;
  contactName?: string;
  contactPhone?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  status: string;
  remark?: string;
  spaceIds: number[];
  createdAt: string;
  updatedAt: string;
}

interface PageDto<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchTenants(params: {
  keyword?: string;
  status?: TenantStatus | '';
  spaceNodeId?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const query = new URLSearchParams();
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.status) query.set('status', params.status.toUpperCase());
  if (params.spaceNodeId) query.set('spaceNodeId', params.spaceNodeId);
  query.set('page', String(params.page || 1));
  query.set('pageSize', String(params.pageSize || 20));
  const result = await request<PageDto<TenantDto>>(`/api/v1/tenants?${query}`);
  return { ...result, items: result.items.map(toTenantRecord) };
}

function toTenantRecord(dto: TenantDto): TenantRecord {
  return {
    id: String(dto.id),
    code: dto.code,
    name: dto.name,
    contactPerson: dto.contactName || '',
    contactPhone: dto.contactPhone || '',
    contractStartDate: dto.contractStartDate || '',
    contractEndDate: dto.contractEndDate || '',
    status: dto.status.toLowerCase() as TenantStatus,
    remark: dto.remark || '',
    resourceNodeIds: (dto.spaceIds || []).map(String),
    createdAt: formatDateTime(dto.createdAt),
    updatedAt: formatDateTime(dto.updatedAt),
  };
}

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 19) : '';
}
