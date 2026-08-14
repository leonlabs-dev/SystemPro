import { computed, ref } from 'vue';
import { useAuthStore } from '@/core/auth/auth.store';
import { isDemoMode } from '@/core/config/app-runtime';
import { fetchRuntimeLocales, type LocaleDefinition } from '@/domain/platform/settings/api/settings.api';
import { i18n } from './index';

export type AppLocale = 'zh-CN' | 'en-US';

const fallbackLocales: LocaleDefinition[] = [
  { code: 'zh-CN', nativeName: '简体中文', englishName: 'Simplified Chinese', enabled: true, defaultLocale: true, fallbackLocale: 'zh-CN', sortOrder: 10 },
  { code: 'en-US', nativeName: 'English', englishName: 'English (United States)', enabled: true, defaultLocale: false, fallbackLocale: 'zh-CN', sortOrder: 20 },
];

export const localeSwitching = ref(false);
export const localeTransitionVisible = ref(false);
export const runtimeLocaleDefinitions = ref<LocaleDefinition[]>(fallbackLocales);
export const enabledRuntimeLocales = computed(() => runtimeLocaleDefinitions.value
  .filter((item) => item.enabled)
  .sort((left, right) => left.sortOrder - right.sortOrder));

let switchVersion = 0;
let switchQueue: Promise<void> = Promise.resolve();
const activeLocaleDataRefreshers = new Set<() => void | Promise<void>>();
const TRANSITION_MINIMUM_MS = 260;

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function normalizeLocale(code: string): AppLocale {
  return code === 'en-US' ? 'en-US' : 'zh-CN';
}

function applyLocale(code: AppLocale) {
  i18n.global.locale.value = code;
  localStorage.setItem('systempro.locale', code);
  document.documentElement.lang = code;
}

export function replaceRuntimeLocaleDefinitions(items: LocaleDefinition[]) {
  const enabled = items.filter((item) => item.enabled);
  runtimeLocaleDefinitions.value = enabled.length ? items : fallbackLocales;
}

export async function loadRuntimeLocaleDefinitions() {
  if (isDemoMode) return runtimeLocaleDefinitions.value;
  const items = await fetchRuntimeLocales();
  replaceRuntimeLocaleDefinitions(items);
  return items;
}

export function registerActiveLocaleDataRefresher(refresh: () => void | Promise<void>) {
  activeLocaleDataRefreshers.add(refresh);
  return () => activeLocaleDataRefreshers.delete(refresh);
}

async function refreshActiveLocaleData() {
  await Promise.all([...activeLocaleDataRefreshers].map(async (refresh) => {
    try {
      await refresh();
    } catch (error) {
      // Individual pages own their loading/error state. A failed secondary
      // refresh must not strand the whole application inside the locale shield.
      console.warn('Unable to refresh localized page data', error);
    }
  }));
}

export function switchApplicationLocale(target: string, force = false): Promise<void> {
  const request = switchQueue.then(
    () => performLocaleSwitch(target, force),
    () => performLocaleSwitch(target, force),
  );
  switchQueue = request.catch(() => undefined);
  return request;
}

async function performLocaleSwitch(target: string, force = false) {
  const nextLocale = normalizeLocale(target);
  const currentLocale = normalizeLocale(i18n.global.locale.value);
  if (!force && nextLocale === currentLocale) return;

  const requestVersion = ++switchVersion;
  const startedAt = performance.now();
  const previousStoredLocale = localStorage.getItem('systempro.locale');
  localeSwitching.value = true;
  localeTransitionVisible.value = true;
  // 后端动态名称依赖 Accept-Language，因此先只更新请求语言，待数据重载完成后再原子更新界面语言。
  localStorage.setItem('systempro.locale', nextLocale);
  try {
    const authStore = useAuthStore();
    // A locale change only needs localized authorization/navigation data.
    // Re-hydrating account and client state here used to replace several
    // reactive trees while KeepAlive was pruning route components, which
    // could leave Vue unmounting an already-disposed component instance.
    if (authStore.isAuthenticated) await authStore.refreshAuthorization(true);
    if (requestVersion !== switchVersion) return;
    applyLocale(nextLocale);
    if (authStore.isAuthenticated) await refreshActiveLocaleData();
  } catch (error) {
    if (requestVersion === switchVersion) {
      if (previousStoredLocale) localStorage.setItem('systempro.locale', previousStoredLocale);
      else localStorage.removeItem('systempro.locale');
    }
    throw error;
  } finally {
    if (requestVersion === switchVersion) {
      const remaining = Math.max(0, TRANSITION_MINIMUM_MS - (performance.now() - startedAt));
      if (remaining) await wait(remaining);
      await waitForPaint();
      localeSwitching.value = false;
      localeTransitionVisible.value = false;
    }
  }
}

export async function ensureEnabledApplicationLocale() {
  const enabled = enabledRuntimeLocales.value;
  if (!enabled.length) return;
  const current = normalizeLocale(i18n.global.locale.value);
  if (enabled.some((item) => item.code === current)) return;
  const target = enabled.find((item) => item.defaultLocale)?.code || enabled[0].code;
  await switchApplicationLocale(target);
}
