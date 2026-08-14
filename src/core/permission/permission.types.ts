// ============================================================
// 统一权限点字典（资源字典 — 全局唯一数据源）
//
// 命名规范：platform:{menu-namespace}:{action}
//   {menu-namespace} = 菜单节点 id 中的 - 替换为 :
//   {action} = 操作类型（create / update / delete / export / view / disable / assign-permission）
//
// 来源：菜单按钮权限（MenuPermissionPage 动态注册）→ source: 'menu-button'
//       权限点生命周期由 MenuPermissionPage 管理：新增菜单 → 注册；删除菜单 → 注销。
//       RolePermissionPage 仅读取，不写入。
//
// 位置：放在 core/ 而非 domain/，因为 menu-resource.factory（core/）和
//       permission.store（core/）都需要引用此类型，core 不应依赖 domain。
// ============================================================

/** 权限点来源类型 */
export type PermissionSource = 'menu-button';

/** 业务分组（对应菜单权限页面中的菜单名称） */
export type PermissionCategory = string;

/** 统一权限点条目 */
export interface PermissionEntry {
  /** 权限标识，格式 platform:{ns}:{action} */
  code: string;
  /** 中文名称（来自按钮名称） */
  name: string;
  /** 启用/停用状态 */
  status: 'enabled' | 'disabled';
  /** 业务分组（所属菜单名称） */
  category: PermissionCategory;
  /** 所属菜单节点 id */
  menuId: string;
  /** 所属菜单路由 */
  menuPath: string;
  /** 操作动作 */
  action: string;
  /** 权限来源 */
  source: PermissionSource;
}
