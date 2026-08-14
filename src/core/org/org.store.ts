// ============================================================
// 共享组织架构 Store
//
// 职责：
//   1. 持久化组织架构树（OrganizationTreePage 写入）
//   2. 为部门/岗位页面提供部门下拉选项（DepartmentPositionPage 读取）
//   3. 为账号列表提供部门归属引用
//   4. 组织改名/停用时，其他页面通过 store 自动获取最新数据
// ============================================================
import { defineStore } from 'pinia';
import {
  deleteOrganization,
  findOrganization,
  flattenOrganizations,
  insertOrganization,
  updateOrganization,
  type OrganizationNode,
} from '@/domain/platform/org';
import { fetchOrganizations } from '@/domain/platform/org/api/organization.api';

let loadRequestVersion = 0;

export const useOrgStore = defineStore('core.org', {
  state: () => ({
    /** 组织架构树 */
    tree: [] as OrganizationNode[],
  }),

  getters: {
    /** 扁平化组织列表（用于下拉选择等场景） */
    flatList: (state): OrganizationNode[] => {
      return flattenOrganizations(state.tree);
    },

    /** 按 ID 快速查找 */
    byId: (state) => {
      const map = new Map<string, OrganizationNode>();
      for (const node of flattenOrganizations(state.tree)) {
        map.set(node.id, node);
      }
      return map;
    },

    /** 仅末端的叶子节点（用于部门/岗位页面的部门选择器） */
    leafNodes: (state): OrganizationNode[] => {
      return flattenOrganizations(state.tree).filter((n) => !n.children?.length);
    },

    /** 全部启用的组织 */
    enabledOrgs: (state): OrganizationNode[] => {
      return flattenOrganizations(state.tree).filter((n) => n.status === 'enabled');
    },
  },

  actions: {
    async load() {
      const version = ++loadRequestVersion;
      const tree = await fetchOrganizations();
      if (version === loadRequestVersion) this.tree = tree;
      return this.tree;
    },
    /** 更新单个组织节点（OrganizationTreePage 保存时调用） */
    updateNode(draft: Omit<OrganizationNode, 'children'>) {
      this.tree = updateOrganization(this.tree, draft);
    },

    /** 新增组织节点 */
    insertNode(node: OrganizationNode) {
      this.tree = insertOrganization(this.tree, node);
    },

    /** 删除组织节点 */
    deleteNode(id: string) {
      this.tree = deleteOrganization(this.tree, id);
    },

    /** 根据 ID 查找节点 */
    findNode(id: string): OrganizationNode | null {
      return findOrganization(this.tree, id);
    },

    /** 获取某个节点及其所有下级节点的 ID 列表（用于停用联动查询） */
    getNodeAndDescendantIds(id: string): string[] {
      const node = findOrganization(this.tree, id);
      if (!node) return [];
      const descendants = flattenOrganizations(node.children || []);
      return [node.id, ...descendants.map((n) => n.id)];
    },
  },
});
