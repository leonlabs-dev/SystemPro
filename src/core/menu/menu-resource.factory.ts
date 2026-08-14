import type { NavigationItem } from '@/core/navigation/menu';
import type { PersistedButton, PersistedMenuNode } from '@/core/menu/menu.store';
import type { PermissionEntry } from '@/core/permission/permission.types';
import { createPermissionCode as createManagedPermissionCode } from '@/core/code/business-code';

type Translate = (key: string) => string;

export function createPermissionNamespace(menuId: string): string {
  return menuId.replace(/-/g, ':');
}

export function createPermissionCode(menuId: string, action: string): string {
  return createManagedPermissionCode(menuId, action);
}

export function createDefaultButtons(menuId: string): PersistedButton[] {
  return [
    { id: `${menuId}-create`, name: '新增', code: createPermissionCode(menuId, 'create'), action: 'create', status: 'enabled' },
    { id: `${menuId}-update`, name: '编辑', code: createPermissionCode(menuId, 'update'), action: 'update', status: 'enabled' },
    { id: `${menuId}-delete`, name: '删除', code: createPermissionCode(menuId, 'delete'), action: 'delete', status: 'enabled' },
    { id: `${menuId}-export`, name: '导出', code: createPermissionCode(menuId, 'export'), action: 'export', status: 'disabled' },
  ];
}

export function buildMenuResourceTree(items: NavigationItem[], t: Translate): PersistedMenuNode[] {
  return items.map((item, index) => toMenuResource(item, '', index + 1, t));
}

export function cloneMenuResourceTree(nodes: PersistedMenuNode[]): PersistedMenuNode[] {
  return nodes.map((node) => ({
    ...node,
    buttonPermissions: node.buttonPermissions.map((button) => ({ ...button })),
    children: node.children ? cloneMenuResourceTree(node.children) : undefined,
  }));
}

export function flattenMenuResources(nodes: PersistedMenuNode[]): PersistedMenuNode[] {
  return nodes.flatMap((node) => [node, ...flattenMenuResources(node.children || [])]);
}

export function createPermissionEntriesFromMenuTree(nodes: PersistedMenuNode[]): PermissionEntry[] {
  return flattenMenuResources(nodes).flatMap((menu) => (
    menu.buttonPermissions.map((button) => ({
      code: button.code,
      name: button.name,
      status: button.status,
      category: menu.title,
      menuId: menu.id,
      menuPath: menu.path,
      action: button.action,
      source: 'menu-button',
    }))
  ));
}

function toMenuResource(item: NavigationItem, parentId: string, sort: number, t: Translate): PersistedMenuNode {
  const title = t(item.titleKey);
  const hasChildren = Boolean(item.children?.length);

  return {
    id: item.id,
    title,
    routeName: toRouteName(item.id),
    path: item.path,
    componentPath: hasChildren ? '' : `views${item.path}/index.vue`,
    permissionCode: createPermissionCode(item.id, 'view'),
    activeTab: item.id,
    icon: hasChildren || !parentId ? item.icon || inferIcon(item.id) : '',
    parentId,
    type: hasChildren ? 'catalog' : 'menu',
    status: 'enabled',
    visible: 'visible',
    keepAlive: !hasChildren,
    external: false,
    sort,
    remark: `${title} 菜单配置，用于维护路由、显示规则与按钮权限。`,
    buttonPermissions: hasChildren ? [] : createDefaultButtons(item.id),
    children: item.children?.map((child, index) => toMenuResource(child, item.id, index + 1, t)),
  };
}

function toRouteName(id: string) {
  return id.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function inferIcon(id: string) {
  if (id.includes('permission')) return 'permission';
  if (id.includes('organization')) return 'organization';
  if (id.includes('setting')) return 'settings';
  if (id.includes('report')) return 'report';
  if (id.includes('alarm')) return 'alarm';
  if (id.includes('energy')) return 'energy';
  return 'menu';
}
