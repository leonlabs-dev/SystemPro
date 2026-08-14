import { defineStore } from 'pinia';
import { primaryPalette } from '@/design-system/tokens/primary';
import type { ThemeName } from './theme.types';

const STORAGE_KEY = 'systempro.theme';
const PRIMARY_STORAGE_KEY = 'systempro.primaryColor';

function isThemeName(val: unknown): val is ThemeName {
  return val === 'light' || val === 'dark';
}

function readStored<T>(key: string, fallback: T, validate?: (val: unknown) => val is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    if (validate && !validate(raw)) return fallback;
    return (raw as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export const useThemeStore = defineStore('core.theme', {
  state: () => ({
    theme: readStored<ThemeName>(STORAGE_KEY, 'light', isThemeName),
    primaryColor: readStored<string>(PRIMARY_STORAGE_KEY, 'blue'),
  }),
  actions: {
    setTheme(theme: ThemeName) {
      this.theme = theme;
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch { /* storage unavailable, ignore */ }
      this.applyTheme();
    },
    toggleTheme() {
      this.setTheme(this.theme === 'light' ? 'dark' : 'light');
    },
    setPrimaryColor(color: string) {
      this.primaryColor = color;
      try {
        localStorage.setItem(PRIMARY_STORAGE_KEY, color);
      } catch { /* storage unavailable, ignore */ }
      this.applyPrimaryColor();
    },
    applyPrimaryColor() {
      const palette = primaryPalette[this.primaryColor] || primaryPalette.blue;
      document.documentElement.style.setProperty('--color-primary-500', palette.base);
      document.documentElement.style.setProperty('--color-primary-600', palette.hover);
      document.documentElement.style.setProperty('--color-primary-700', palette.active);
      document.documentElement.style.setProperty('--el-color-primary', palette.base);
      document.documentElement.style.setProperty('--el-color-primary-light-3', palette.hover);
      document.documentElement.style.setProperty('--el-color-primary-dark-2', palette.active);
    },
    applyTheme() {
      document.documentElement.dataset.theme = this.theme;
      this.applyPrimaryColor();
    },
  },
});
