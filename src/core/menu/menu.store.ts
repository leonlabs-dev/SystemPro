// ============================================================
// 共享菜单资源状态 Store
//
// 职责：
//   1. 持久化 MenuPermissionPage 的完整菜单树（含按钮权限）
//   2. 维护每个菜单节点的启用/停用、可见/隐藏状态
//   3. MenuPermissionPage 写入，RolePermissionPage / 侧边栏读取
// ============================================================
import { defineStore } from 'pinia';

export interface MenuResourceState {
  id: string;
  status: 'enabled' | 'disabled';
  visible: 'visible' | 'hidden';
}

export interface MenuResourceInitItem {
  id: string;
  status?: 'enabled' | 'disabled';
  visible?: 'visible' | 'hidden';
}

/** 按钮权限的持久化形态 */
export interface PersistedButton {
  id: string;
  name: string;
  code: string;
  action: string;
  status: 'enabled' | 'disabled';
}

/** 菜单节点的持久化形态 */
export interface PersistedMenuNode {
  id: string;
  title: string;
  routeName: string;
  path: string;
  componentPath: string;
  permissionCode: string;
  activeTab: string;
  icon: string;
  parentId: string;
  type: 'catalog' | 'menu';
  status: 'enabled' | 'disabled';
  visible: 'visible' | 'hidden';
  keepAlive: boolean;
  external: boolean;
  sort: number;
  remark: string;
  buttonPermissions: PersistedButton[];
  children?: PersistedMenuNode[];
}

function flattenMenuTree(nodes: PersistedMenuNode[]): PersistedMenuNode[] {
  return nodes.flatMap((node) => [node, ...flattenMenuTree(node.children || [])]);
}

function cloneMenuTree(nodes: PersistedMenuNode[]): PersistedMenuNode[] {
  return nodes.map((node) => ({
    ...node,
    buttonPermissions: node.buttonPermissions.map((button) => ({ ...button })),
    children: node.children ? cloneMenuTree(node.children) : undefined,
  }));
}

export const useMenuStore = defineStore('core.menu', {
  state: () => ({
    /** 菜单节点资源状态: id → MenuResourceState */
    registry: new Map<string, MenuResourceState>(),
    /** 完整菜单树持久化（MenuPermissionPage 的编辑结果） */
    menuTree: null as PersistedMenuNode[] | null,
  }),

  getters: {
    /** 完整菜单树的扁平视图 */
    flatMenuTree(): PersistedMenuNode[] {
      return this.menuTree ? flattenMenuTree(this.menuTree) : [];
    },

    /** 获取全部已停用的菜单 id */
    disabledIds(): string[] {
      return Array.from(this.registry.values())
        .filter((s) => s.status === 'disabled')
        .map((s) => s.id);
    },

    /** 获取全部已隐藏的菜单 id */
    hiddenIds(): string[] {
      return Array.from(this.registry.values())
        .filter((s) => s.visible === 'hidden')
        .map((s) => s.id);
    },
  },

  actions: {
    /** 初始化默认菜单树，仅当当前尚无编辑结果时生效 */
    ensureTree(defaultTree: PersistedMenuNode[]) {
      if (!this.menuTree) {
        this.replaceTree(defaultTree);
      }
    },

    /** 全量替换菜单树，并同步节点状态索引 */
    replaceTree(tree: PersistedMenuNode[]) {
      this.menuTree = cloneMenuTree(tree);
      this.registry.clear();
      this.initFromNodes(flattenMenuTree(this.menuTree).map((node) => ({
        id: node.id,
        status: node.status,
        visible: node.visible,
      })));
    },

    /** 批量初始化菜单节点状态 */
    initFromNodes(nodes: MenuResourceInitItem[]) {
      for (const node of nodes) {
        this.registry.set(node.id, {
          id: node.id,
          status: node.status ?? 'enabled',
          visible: node.visible ?? 'visible',
        });
      }
    },

    /** 更新单个菜单节点状态 */
    setNodeState(id: string, state: Partial<Omit<MenuResourceState, 'id'>>) {
      const existing = this.registry.get(id);
      if (existing) {
        Object.assign(existing, state);
      } else {
        this.registry.set(id, {
          id,
          status: 'enabled',
          visible: 'visible',
          ...state,
        });
      }
    },

    /** 移除菜单节点 */
    removeNode(id: string) {
      this.registry.delete(id);
    },
  },
});
