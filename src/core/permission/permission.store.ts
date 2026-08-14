// ============================================================
// 统一权限字典 Store（资源字典 — 全局唯一数据源）
//
// 职责：
//   1. 维护所有权限点的注册表（菜单按钮权限）
//   2. 提供权限点的 CRUD 查询接口
//   3. MenuPermissionPage 写入，RolePermissionPage 读取
// ============================================================
import { defineStore } from 'pinia';
import type { PermissionEntry } from './permission.types';

export const usePermissionStore = defineStore('core.permission', {
  state: () => ({
    /** 全部权限点注册表: code → PermissionEntry */
    registry: new Map<string, PermissionEntry>(),
  }),

  getters: {
    /** 所有权限点列表 */
    allPermissions(): PermissionEntry[] {
      return Array.from(this.registry.values());
    },

    /** 仅启用的权限点 */
    enabledPermissions(): PermissionEntry[] {
      return this.allPermissions.filter((p) => p.status === 'enabled');
    },
  },

  actions: {
    /** 注册一个权限点到字典 */
    register(entry: PermissionEntry) {
      this.registry.set(entry.code, { ...entry });
    },

    /** 按来源全量替换权限点，自动清理已经删除或改名的旧 code */
    replaceBySource(source: PermissionEntry['source'], entries: PermissionEntry[]) {
      const nextCodes = new Set(entries.map((entry) => entry.code));
      for (const entry of this.registry.values()) {
        if (entry.source === source && !nextCodes.has(entry.code)) {
          this.registry.delete(entry.code);
        }
      }
      entries.forEach((entry) => {
        this.registry.set(entry.code, { ...entry });
      });
    },

    /** 注销一个权限点 */
    unregister(code: string) {
      this.registry.delete(code);
    },

    /** 更新单个权限点的状态 */
    setStatus(code: string, status: PermissionEntry['status']) {
      const entry = this.registry.get(code);
      if (entry) {
        entry.status = status;
      }
    },

    /** 更新单个权限点的名称 */
    setName(code: string, name: string) {
      const entry = this.registry.get(code);
      if (entry) {
        entry.name = name;
      }
    },

    /** 更新单个权限点的分组 */
    setCategory(code: string, category: PermissionEntry['category']) {
      const entry = this.registry.get(code);
      if (entry) {
        entry.category = category;
      }
    },

    /** 根据权限标识获取权限点信息 */
    get(code: string): PermissionEntry | undefined {
      return this.registry.get(code);
    },

    /** 检查权限标识是否已注册 */
    has(code: string): boolean {
      return this.registry.has(code);
    },

    /** 获取一组权限标识中已启用的子集（运行时判断） */
    filterEnabled(codes: string[]): string[] {
      return codes.filter((code) => this.registry.get(code)?.status === 'enabled');
    },

    /** 运行时按钮可见性判定：角色已授予且权限点仍启用 */
    canUse(grantedCodes: string[], code: string): boolean {
      return grantedCodes.includes(code) && this.registry.get(code)?.status === 'enabled';
    },
  },
});
