import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { defineStore } from 'pinia';

const STORAGE_KEY_PREFIX = 'systempro.route-tabs.v2';
const DEFAULT_HOME_PATH = '/welcome';

export interface RouteTabItem {
  path: string;
  fullPath: string;
  titleKey?: string;
  title: string;
  closable: boolean;
}

function storageKey(scope: string) {
  return `${STORAGE_KEY_PREFIX}:${scope}`;
}

function readTabs(scope: string): RouteTabItem[] {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createTab(route: RouteLocationNormalizedLoaded): RouteTabItem {
  return {
    path: route.path,
    fullPath: route.fullPath,
    titleKey: typeof route.meta.titleKey === 'string' ? route.meta.titleKey : undefined,
    title: typeof route.name === 'string' ? route.name : route.path,
    closable: route.path !== DEFAULT_HOME_PATH,
  };
}

export const useRouteTabsStore = defineStore('core.route-tabs', {
  state: () => ({
    tabs: [] as RouteTabItem[],
    activePath: '',
    persistenceScope: '',
  }),
  getters: {
    activeTab(state) {
      return state.tabs.find((tab) => tab.path === state.activePath);
    },
  },
  actions: {
    persist() {
      if (!this.persistenceScope) return;
      localStorage.setItem(storageKey(this.persistenceScope), JSON.stringify(this.tabs));
    },
    activateScope(clientId: number, tenantId: number | null, accountId: number) {
      const nextScope = `${clientId}:${tenantId ?? 'platform'}:${accountId}`;
      if (this.persistenceScope === nextScope) return;
      this.persistenceScope = nextScope;
      this.tabs = readTabs(nextScope);
      this.activePath = '';
    },
    releaseScope() {
      this.tabs = [];
      this.activePath = '';
      this.persistenceScope = '';
    },
    addRoute(route: RouteLocationNormalizedLoaded) {
      if (!route.meta.titleKey || route.path === '/') {
        return;
      }

      this.activePath = route.path;
      const next = createTab(route);
      const current = this.tabs.find((tab) => tab.path === next.path);

      if (current) {
        current.fullPath = next.fullPath;
        current.titleKey = next.titleKey;
        current.title = next.title;
        current.closable = next.closable;
      } else {
        this.tabs.push(next);
      }

      this.persist();
    },
    retainAllowed(paths: string[]) {
      const allowed = new Set(paths);
      this.tabs = this.tabs.filter((tab) => allowed.has(tab.path));
      if (!allowed.has(this.activePath)) {
        this.activePath = '';
      }
      this.persist();
    },
    clear() {
      this.tabs = [];
      this.activePath = '';
      this.persist();
    },
    close(path: string) {
      const tab = this.tabs.find((item) => item.path === path);
      if (!tab?.closable) {
        return this.activeTab;
      }

      const deletedIndex = this.tabs.findIndex((item) => item.path === path);
      this.tabs = this.tabs.filter((item) => item.path !== path);
      this.persist();

      if (this.activePath !== path) {
        return this.activeTab;
      }

      // 删除后数组缩短，被删位置原后一个元素现在占据 deletedIndex 位置
      const fallbackIndex = Math.min(deletedIndex, this.tabs.length - 1);
      return this.tabs[fallbackIndex] || this.tabs[0];
    },
    closeCurrent() {
      return this.close(this.activePath);
    },
    closeOthers(path?: string) {
      const targetPath = path || this.activePath;
      this.tabs = this.tabs.filter((tab) => !tab.closable || tab.path === targetPath);
      this.persist();
    },
    closeAll() {
      this.tabs = this.tabs.filter((tab) => !tab.closable);
      this.activePath = this.tabs[0]?.path || '';
      this.persist();
      return this.tabs[0];
    },
    move(path: string, targetPath: string) {
      if (path === targetPath) return;
      const from = this.tabs.findIndex((tab) => tab.path === path);
      const to = this.tabs.findIndex((tab) => tab.path === targetPath);
      if (from < 0 || to < 0 || !this.tabs[from]?.closable || !this.tabs[to]?.closable) return;
      const next = [...this.tabs];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      this.tabs = next;
      this.persist();
    },
    moveToIndex(path: string, targetIndex: number) {
      const from = this.tabs.findIndex((tab) => tab.path === path);
      if (from < 0 || !this.tabs[from]?.closable) return;
      const nextIndex = Math.max(1, Math.min(targetIndex, this.tabs.length - 1));
      if (from === nextIndex) return;
      const next = [...this.tabs];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(nextIndex, 0, moved);
      this.tabs = next;
      this.persist();
    },
    moveBy(path: string, offset: -1 | 1) {
      const index = this.tabs.findIndex((tab) => tab.path === path);
      const target = this.tabs[index + offset];
      if (index < 0 || !this.tabs[index]?.closable || !target?.closable) return;
      this.move(path, target.path);
    },
  },
});
