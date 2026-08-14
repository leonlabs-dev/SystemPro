import { request } from '@/core/api/http-client';
import type { PersistedMenuNode } from '@/core/menu/menu.store';

interface MenuDto {
  id: number;
  parentId: number;
  code: string;
  name: string;
  type: string;
  path: string;
  component?: string;
  icon?: string;
  permissionCode?: string;
  sortOrder: number;
  visible: boolean;
  keepAlive: boolean;
  status: string;
  remark?: string;
  buttonPermissions: Array<{ id: number; code: string; name: string; action: string; status: string }>;
  children: MenuDto[];
}

export async function fetchMenuTree(): Promise<PersistedMenuNode[]> {
  const rows = await request<MenuDto[]>('/api/v1/menus/tree');
  return rows.map(toMenuNode);
}

export async function createMenu(input: PersistedMenuNode): Promise<PersistedMenuNode> {
  const dto = await request<MenuDto>('/api/v1/menus', {
    method: 'POST', body: JSON.stringify(toPayload(input)),
  });
  return toMenuNode(dto);
}

export async function updateMenu(id: string, input: PersistedMenuNode): Promise<PersistedMenuNode> {
  const dto = await request<MenuDto>(`/api/v1/menus/${id}`, {
    method: 'PUT', body: JSON.stringify(toPayload(input)),
  });
  return toMenuNode(dto);
}

export function deleteMenu(id: string) {
  return request<void>(`/api/v1/menus/${id}`, { method: 'DELETE' });
}

function toMenuNode(dto: MenuDto): PersistedMenuNode {
  return {
    id: String(dto.id),
    title: dto.name,
    routeName: dto.code,
    path: dto.path,
    componentPath: dto.component || '',
    permissionCode: dto.permissionCode || '',
    activeTab: dto.code,
    icon: dto.icon || '',
    parentId: dto.parentId ? String(dto.parentId) : '',
    type: dto.type.toLowerCase() as 'catalog' | 'menu',
    status: dto.status === 'ACTIVE' ? 'enabled' : 'disabled',
    visible: dto.visible ? 'visible' : 'hidden',
    keepAlive: dto.keepAlive,
    external: false,
    sort: dto.sortOrder,
    remark: dto.remark || '',
    buttonPermissions: (dto.buttonPermissions || []).map((button) => ({
      id: String(button.id), name: button.name, code: button.code,
      action: button.action,
      status: button.status === 'ACTIVE' ? 'enabled' : 'disabled',
    })),
    children: (dto.children || []).map(toMenuNode),
  };
}

function toPayload(input: PersistedMenuNode) {
  return {
    parentId: input.parentId ? Number(input.parentId) : 0,
    code: input.routeName.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name: input.title,
    type: input.type.toUpperCase(),
    path: input.path,
    component: input.componentPath || null,
    icon: input.icon || null,
    permissionCode: input.permissionCode || null,
    sortOrder: input.sort,
    visible: input.visible === 'visible',
    keepAlive: input.keepAlive,
    status: input.status === 'enabled' ? 'ACTIVE' : 'DISABLED',
    remark: input.remark || null,
    buttonPermissions: input.buttonPermissions.map((button) => ({
      id: /^\d+$/.test(button.id) ? Number(button.id) : null,
      code: button.code,
      name: button.name,
      action: button.action,
      status: button.status === 'enabled' ? 'ACTIVE' : 'DISABLED',
    })),
  };
}
