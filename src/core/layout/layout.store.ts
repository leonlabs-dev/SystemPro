import { defineStore } from 'pinia';

const STORAGE_KEY = 'systempro.layout';
const LAYOUT_VERSION = 5;

export type NavMode = 'side' | 'top' | 'mix';
export type SideMenuType = 'classic' | 'grouped';
export type ContentWidth = 'fluid' | 'fixed';
export type TableDensity = 'comfortable' | 'compact';

interface LayoutPreference {
  sidebarCollapsed: boolean;
  fixedHeader: boolean;
  fixedSidebar: boolean;
  splitMenu: boolean;
  showHeader: boolean;
  showFooter: boolean;
  showMenu: boolean;
  showMenuHeader: boolean;
  contentWidth: ContentWidth;
  navMode: NavMode;
  menuType: SideMenuType;
  weakMode: boolean;
  tableDensity: TableDensity;
  version: number;
}

const defaultPreference: LayoutPreference = {
  sidebarCollapsed: false,
  fixedHeader: true,
  fixedSidebar: true,
  splitMenu: false,
  showHeader: true,
  showFooter: false,
  showMenu: true,
  showMenuHeader: true,
  contentWidth: 'fluid',
  navMode: 'side',
  menuType: 'grouped',
  weakMode: false,
  tableDensity: 'compact',
  version: LAYOUT_VERSION,
};

type StoredLayoutPreference = Partial<Omit<LayoutPreference, 'menuType'>> & {
  menuType?: string;
};

function normalizePreference(parsed: StoredLayoutPreference): LayoutPreference {
  const migratedMenuType: SideMenuType = parsed.menuType === 'main' || parsed.menuType === 'classic'
    ? 'classic'
    : 'grouped';
  const shouldResetFooter = !parsed.version || parsed.version < 4;
  // v4 and earlier applied a persisted saturation filter to the layout root.
  // Do not carry that global visual state across the migration boundary.
  const shouldResetLegacyWeakMode = !parsed.version || parsed.version < 5;
  const normalized = {
    ...defaultPreference,
    ...parsed,
    showFooter: shouldResetFooter ? false : parsed.showFooter ?? defaultPreference.showFooter,
    menuType: migratedMenuType,
    weakMode: shouldResetLegacyWeakMode
      ? false
      : (typeof parsed.weakMode === 'boolean' ? parsed.weakMode : defaultPreference.weakMode),
    version: LAYOUT_VERSION,
  };

  if (normalized.navMode === 'mix') {
    normalized.sidebarCollapsed = false;
    normalized.splitMenu = true;
  }

  return normalized;
}

function readPreference(): LayoutPreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultPreference;
    }
    const parsed = JSON.parse(raw);
    return normalizePreference(parsed);
  } catch {
    return defaultPreference;
  }
}

export const useLayoutStore = defineStore('core.layout', {
  state: () => readPreference(),
  actions: {
    persist() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sidebarCollapsed: this.sidebarCollapsed,
          fixedHeader: this.fixedHeader,
          fixedSidebar: this.fixedSidebar,
          splitMenu: this.splitMenu,
          showHeader: this.showHeader,
          showFooter: this.showFooter,
          showMenu: this.showMenu,
          showMenuHeader: this.showMenuHeader,
          contentWidth: this.contentWidth,
          navMode: this.navMode,
          menuType: this.menuType,
          weakMode: this.weakMode,
          tableDensity: this.tableDensity,
          version: LAYOUT_VERSION,
        }),
      );
    },
    toggleSidebar() {
      if (this.navMode === 'mix') {
        this.sidebarCollapsed = false;
        this.persist();
        return;
      }

      this.sidebarCollapsed = !this.sidebarCollapsed;
      this.persist();
    },
    setContentWidth(value: ContentWidth) {
      this.contentWidth = value;
      this.persist();
    },
    setNavMode(value: NavMode) {
      this.navMode = value;
      if (value === 'mix') {
        this.splitMenu = true;
        this.sidebarCollapsed = false;
      }
      this.persist();
    },
    setMenuType(value: SideMenuType) {
      if (this.navMode !== 'side') {
        return;
      }

      this.menuType = value;
      this.persist();
    },
    setTableDensity(value: TableDensity) {
      this.tableDensity = value;
      this.persist();
    },
    setWeakMode(value: boolean) {
      this.weakMode = value;
      this.applyVisualPreference();
      this.persist();
    },
    applyVisualPreference() {
      if (this.weakMode) {
        document.documentElement.dataset.visualA11y = 'color-weak';
      } else {
        delete document.documentElement.dataset.visualA11y;
      }
    },
    resetPreference() {
      this.sidebarCollapsed = defaultPreference.sidebarCollapsed;
      this.fixedHeader = defaultPreference.fixedHeader;
      this.fixedSidebar = defaultPreference.fixedSidebar;
      this.splitMenu = defaultPreference.splitMenu;
      this.showHeader = defaultPreference.showHeader;
      this.showFooter = defaultPreference.showFooter;
      this.showMenu = defaultPreference.showMenu;
      this.showMenuHeader = defaultPreference.showMenuHeader;
      this.contentWidth = defaultPreference.contentWidth;
      this.navMode = defaultPreference.navMode;
      this.menuType = defaultPreference.menuType;
      this.weakMode = defaultPreference.weakMode;
      this.tableDensity = defaultPreference.tableDensity;
      this.version = defaultPreference.version;
      this.applyVisualPreference();
      this.persist();
    },
  },
});
