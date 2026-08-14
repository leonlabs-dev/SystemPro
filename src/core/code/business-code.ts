export type BusinessCodePrefix = 'ORG' | 'POS' | 'SPACE' | 'ROLE' | 'TNT' | 'IDP';

export const permissionActionOptions = [
  { value: 'view', label: '查看', labelKey: 'common.actions.view' },
  { value: 'create', label: '新增', labelKey: 'common.actions.create' },
  { value: 'update', label: '编辑', labelKey: 'common.actions.update' },
  { value: 'delete', label: '删除', labelKey: 'common.actions.delete' },
  { value: 'disable', label: '停用', labelKey: 'common.actions.disable' },
  { value: 'enable', label: '启用', labelKey: 'common.actions.enable' },
  { value: 'assign', label: '分配', labelKey: 'common.actions.assign' },
  { value: 'export', label: '导出', labelKey: 'common.actions.export' },
  { value: 'import', label: '导入', labelKey: 'common.actions.import' },
  { value: 'sync', label: '同步', labelKey: 'common.actions.sync' },
  { value: 'sort', label: '排序', labelKey: 'common.actions.sort' },
  { value: 'approve', label: '审批', labelKey: 'common.actions.approve' },
  { value: 'publish', label: '发布', labelKey: 'common.actions.publish' },
  { value: 'archive', label: '归档', labelKey: 'common.actions.archive' },
  { value: 'config', label: '配置', labelKey: 'common.actions.config' },
  { value: 'reset-password', label: '重置密码', labelKey: 'common.actions.resetPassword' },
] as const;

export type PermissionAction = typeof permissionActionOptions[number]['value'];

export function createBusinessCode(prefix: BusinessCodePrefix): string {
  return `${prefix}_${randomToken().toUpperCase()}`;
}

export function createMenuCode(): string {
  return `menu-${randomToken()}`;
}

export function createPermissionCode(menuCode: string, action: PermissionAction | string): string {
  const namespace = menuCode.toLowerCase().replace(/[^a-z0-9]+/g, ':');
  return `platform:${namespace}:${action.toLowerCase()}`;
}

export function nextPermissionAction(actions: string[]): PermissionAction | undefined {
  return permissionActionOptions.find((item) => !actions.includes(item.value))?.value;
}

function randomToken(): string {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('').slice(0, 10);
}
