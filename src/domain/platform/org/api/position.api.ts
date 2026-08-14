import { request } from '@/core/api/http-client';
import type { Position, PositionDraft, PositionStatus } from '../position';

interface PositionDto {
  id: number;
  orgNodeId: number;
  code: string;
  name: string;
  responsibilities?: string;
  level?: string;
  headcount: number;
  currentCount: number;
  status: string;
  relatedPermissions: string[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchPositions(orgNodeId?: string): Promise<Position[]> {
  const query = orgNodeId ? `?orgNodeId=${encodeURIComponent(orgNodeId)}` : '';
  const rows = await request<PositionDto[]>(`/api/v1/positions${query}`);
  return rows.map(toPosition);
}

export async function createPosition(input: PositionDraft): Promise<Position> {
  const dto = await request<PositionDto>('/api/v1/positions', {
    method: 'POST', body: JSON.stringify(toPayload(input)),
  });
  return toPosition(dto);
}

export async function updatePosition(id: string, input: PositionDraft): Promise<Position> {
  const dto = await request<PositionDto>(`/api/v1/positions/${id}`, {
    method: 'PUT', body: JSON.stringify(toPayload(input)),
  });
  return toPosition(dto);
}

export function deletePosition(id: string) {
  return request<void>(`/api/v1/positions/${id}`, { method: 'DELETE' });
}

function toPosition(dto: PositionDto): Position {
  return {
    id: String(dto.id),
    name: dto.name,
    code: dto.code,
    orgNodeId: String(dto.orgNodeId),
    description: dto.responsibilities || '',
    headcount: dto.headcount,
    currentCount: dto.currentCount,
    status: (dto.status === 'ACTIVE' ? 'enabled' : 'disabled') as PositionStatus,
    level: dto.level || '',
    relatedPermissions: dto.relatedPermissions || [],
    createdAt: formatDateTime(dto.createdAt),
    updatedAt: formatDateTime(dto.updatedAt),
  };
}

function toPayload(input: PositionDraft) {
  return {
    orgNodeId: Number(input.orgNodeId),
    code: input.code,
    name: input.name,
    responsibilities: input.description || null,
    level: input.level || null,
    headcount: input.headcount || 0,
    sortOrder: 0,
    status: input.status === 'enabled' ? 'ACTIVE' : 'DISABLED',
    relatedPermissions: input.relatedPermissions || [],
  };
}

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '';
}
