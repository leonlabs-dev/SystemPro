export type AccountStatus = 'active' | 'disabled' | 'pending' | 'locked';
export type BuiltInRoleCode = 'admin' | 'ops' | 'analyst' | 'finance' | 'user';
export type RoleCode = string;
export type AccountRole = RoleCode;
export type RoleStatus = 'enabled' | 'disabled';
export type RoleDataScope = 'all' | 'org' | 'department' | 'self' | 'custom';

export interface AccountRecord {
  id: string;
  /** 所属管理方 ID（平台方三层模型关键字段） */
  clientId: number;
  username: string;
  email: string;
  name: string;
  /** Denormalized organization label used by list and export views. */
  department?: string;
  role: AccountRole;
  roles?: AccountRole[];
  /** 外键：所属部门（OrgNode.id），来自组织架构树 */
  orgNodeId: string;
  /** 外键：岗位（Position.id），来自部门/岗位库 */
  positionId: string;
  status: AccountStatus;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type AccountDraft = Omit<
  AccountRecord,
  'id' | 'clientId' | 'createdAt' | 'updatedAt' | 'lastLoginAt'
>;

export interface AccountQuery {
  keyword?: string;
  status?: AccountStatus | '';
  role?: AccountRole | '';
  orgNodeId?: string;
  department?: string;
}

export interface RoleRecord {
  id: string;
  /** 所属管理方 ID（平台方三层模型关键字段） */
  clientId: number;
  code: RoleCode;
  name: string;
  description: string;
  status: RoleStatus;
  userCount: number;
  menuPaths: string[];
  /** 操作权限标识列表（菜单按钮权限点 code，格式 platform:{menu-id}:{action}） */
  actionPermissions: string[];
  dataScope: RoleDataScope;
  createdAt: string;
  updatedAt: string;
}

export type RoleDraft = Omit<
  RoleRecord,
  'id' | 'clientId' | 'userCount' | 'createdAt' | 'updatedAt'
>;

export interface RoleQuery {
  keyword?: string;
  status?: RoleStatus | '';
  dataScope?: RoleDataScope | '';
}

export const accountRoleLabels: Record<BuiltInRoleCode, string> = {
  admin: '系统管理员',
  ops: '运维工程师',
  analyst: '数据分析师',
  finance: '财务查看员',
  user: '普通用户',
};

export const accountStatusLabels: Record<AccountStatus, string> = {
  active: '正常',
  disabled: '停用',
  pending: '待激活',
  locked: '锁定',
};

export const roleStatusLabels: Record<RoleStatus, string> = {
  enabled: '启用',
  disabled: '停用',
};

export const roleDataScopeLabels: Record<RoleDataScope, string> = {
  all: '全部数据',
  org: '本组织及下级',
  department: '本部门',
  self: '仅本人',
  custom: '自定义范围',
};
