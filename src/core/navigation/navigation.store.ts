import { defineStore } from 'pinia';
import type { GrantedMenuNode } from '@/core/auth/auth.types';
import {
  flattenNavigation,
  getFirstNavigationPath,
  navigationItems,
  type NavigationItem,
} from './menu';

const staticItems = new Map(flattenNavigation(navigationItems).map((item) => [item.id, item]));

export const useNavigationStore = defineStore('core.navigation', {
  state: () => ({
    items: [] as NavigationItem[],
  }),
  getters: {
    flatItems(state): NavigationItem[] {
      return flattenNavigation(state.items);
    },
    firstPath(state): string {
      return state.items.length ? getFirstNavigationPath(state.items[0]) : '';
    },
  },
  actions: {
    replaceFromGrant(nodes: GrantedMenuNode[]) {
      this.items = nodes.map(mapGrantedMenu);
    },
    canAccessPath(path: string) {
      return this.flatItems.some((item) => item.path === path);
    },
    clear() {
      this.items = [];
    },
  },
});

function mapGrantedMenu(node: GrantedMenuNode): NavigationItem {
  const local = staticItems.get(node.code);
  return {
    id: node.code,
    titleKey: local?.titleKey || '',
    title: node.name,
    descKey: local?.descKey || '',
    path: node.path,
    icon: node.icon || local?.icon,
    group: local?.group,
    sectionGroup: local?.sectionGroup,
    sections: local?.sections,
    viewPermission: local?.viewPermission,
    openMode: local?.openMode,
    children: node.children?.map(mapGrantedMenu),
  };
}
