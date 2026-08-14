<script setup lang="ts">
import { ArrowDown, Connection, Link, MoreFilled, Moon, Operation, SwitchButton, User, UserFilled, Sunny } from '@element-plus/icons-vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/core/auth/auth.store';
import {
  enabledRuntimeLocales,
  ensureEnabledApplicationLocale,
  loadRuntimeLocaleDefinitions,
  localeSwitching,
  switchApplicationLocale,
} from '@/core/i18n/locale-runtime';
import { useLayoutStore } from '@/core/layout/layout.store';
import { getActiveRootNavigation, getFirstNavigationPath, getNavigationTitle, isNavigationItemActive, type NavigationItem } from '@/core/navigation/menu';
import { useNavigationStore } from '@/core/navigation/navigation.store';
import { openNavigationItem } from '@/core/navigation/open-navigation';
import { useThemeStore } from '@/core/theme/theme.store';
import { menuIconMap } from './menu-icons';
import { isDemoMode, projectUrl } from '@/core/config/app-runtime';

const logoUrl = new URL('../../logo.png', import.meta.url).href;
const emit = defineEmits<{
  'open-settings': [];
  'open-profile': [];
}>();
const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const layoutStore = useLayoutStore();
const navigationStore = useNavigationStore();
const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth);
const topMenuVisible = computed(() => layoutStore.showMenu && layoutStore.navMode !== 'side');
const isMixTopMenu = computed(() => layoutStore.navMode === 'mix');
const visibleTopCount = computed(() => {
  if (viewportWidth.value >= 1760) return 8;
  if (viewportWidth.value >= 1500) return 7;
  if (viewportWidth.value >= 1280) return 6;
  if (viewportWidth.value >= 1080) return 5;
  return 3;
});
const visibleTopItems = computed(() => navigationStore.items.slice(0, visibleTopCount.value));
const overflowTopItems = computed(() => navigationStore.items.slice(visibleTopCount.value));
const topMenuActive = computed(() => {
  if (!isMixTopMenu.value) {
    return route.path;
  }

  const activeRoot = getActiveRootNavigation(route.path, navigationStore.items);
  return activeRoot ? getFirstNavigationPath(activeRoot) : route.path;
});

async function toggleLocale() {
  if (localeSwitching.value || enabledRuntimeLocales.value.length <= 1) return;
  const currentIndex = enabledRuntimeLocales.value.findIndex((item) => item.code === locale.value);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % enabledRuntimeLocales.value.length;
  await switchApplicationLocale(enabledRuntimeLocales.value[nextIndex].code);
}

function syncViewportWidth() {
  viewportWidth.value = window.innerWidth;
}

function openProductSite() {
  window.open(projectUrl, '_blank', 'noopener,noreferrer');
}

async function handleUserCommand(command: string) {
  if (command === 'profile') {
    emit('open-profile');
  }
  if (command === 'theme') {
    emit('open-settings');
  }
  if (command === 'logout') {
    try {
      await authStore.logout();
    } finally {
      await router.replace('/login');
    }
  }
}

function isTopItemActive(item: NavigationItem) {
  return isMixTopMenu.value
    ? getFirstNavigationPath(item) === topMenuActive.value
    : isNavigationItemActive(item, route.path);
}

onMounted(async () => {
  syncViewportWidth();
  window.addEventListener('resize', syncViewportWidth);
  try {
    await loadRuntimeLocaleDefinitions();
    await ensureEnabledApplicationLocale();
  } catch {
    // 语言策略加载失败时保留当前语言，不阻断主界面。
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewportWidth);
});
</script>

<template>
  <header class="app-topbar">
    <div class="app-topbar__inner">
      <div v-if="layoutStore.showMenuHeader" class="app-topbar__brand">
        <img :src="logoUrl" alt="systemPro logo" />
        <strong>{{ t('app.name') }}</strong>
      </div>

      <div v-if="topMenuVisible" class="app-topbar__nav">
        <nav class="app-topbar__menu" :aria-label="t('app.primaryNav')">
          <template v-for="item in visibleTopItems" :key="item.id">
            <el-dropdown
              v-if="!isMixTopMenu && item.children?.length"
              class="app-topbar__nav-dropdown"
              trigger="hover"
              popper-class="app-topbar-sub-popper"
            >
              <button
                class="app-topbar__nav-item"
                :class="{ 'is-active': isTopItemActive(item) }"
                type="button"
                @click="openNavigationItem(item, router)"
              >
                <span class="app-topbar__nav-content">
                  <el-icon v-if="item.icon && menuIconMap[item.icon]">
                    <component :is="menuIconMap[item.icon]" />
                  </el-icon>
                  <span>{{ getNavigationTitle(item, t) }}</span>
                </span>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="child in item.children"
                    :key="child.id"
                    @click="openNavigationItem(child, router)"
                  >
                    {{ getNavigationTitle(child, t) }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <button
              v-else
              class="app-topbar__nav-item"
              :class="{ 'is-active': isTopItemActive(item) }"
              type="button"
              @click="openNavigationItem(item, router)"
            >
              <span class="app-topbar__nav-content">
                <el-icon v-if="item.icon && menuIconMap[item.icon]">
                  <component :is="menuIconMap[item.icon]" />
                </el-icon>
                <span>{{ getNavigationTitle(item, t) }}</span>
              </span>
            </button>
          </template>
        </nav>

        <el-dropdown v-if="overflowTopItems.length" trigger="hover" popper-class="app-topbar-more-popper">
          <button class="top-icon app-topbar__more" type="button" :aria-label="t('actions.more')">
            <el-icon><MoreFilled /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="item in overflowTopItems"
                :key="item.id"
                @click="openNavigationItem(item, router)"
              >
                <el-icon v-if="item.icon && menuIconMap[item.icon]">
                  <component :is="menuIconMap[item.icon]" />
                </el-icon>
                {{ getNavigationTitle(item, t) }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div class="app-topbar__actions">
        <span v-if="isDemoMode" class="demo-mode-indicator"><i />{{ t('app.demoMode') }}</span>
        <el-tooltip :content="t('topbar.link')" placement="bottom">
        <button class="top-icon is-optional" type="button" :aria-label="t('topbar.link')" @click="openProductSite">
          <el-icon><Link /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip :content="t('topbar.repository')" placement="bottom">
        <button class="top-icon is-optional" type="button" :aria-label="t('topbar.repository')" @click="openProductSite">
          <el-icon><Connection /></el-icon>
        </button>
      </el-tooltip>
      <button
        class="app-topbar__locale"
        type="button"
        :disabled="localeSwitching || enabledRuntimeLocales.length <= 1"
        :aria-busy="localeSwitching"
        @click="toggleLocale"
      >{{ locale }}</button>
      <el-tooltip :content="t('actions.switchTheme')" placement="bottom">
        <button class="top-icon" type="button" :aria-label="t('actions.switchTheme')" @click="emit('open-settings')">
          <el-icon>
            <Sunny v-if="themeStore.theme === 'light'" />
            <Moon v-else />
          </el-icon>
        </button>
      </el-tooltip>

      <el-dropdown trigger="click" @command="handleUserCommand">
        <button class="user-entry" type="button">
          <span class="user-entry__avatar"><el-icon><UserFilled /></el-icon></span>
          <span class="user-entry__name">{{ authStore.displayName || t('app.admin') }}</span>
          <el-icon class="user-entry__chevron"><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu class="user-menu">
            <el-dropdown-item command="profile" :icon="User">{{ t('userMenu.profile') }}</el-dropdown-item>
            <el-dropdown-item command="theme" :icon="Operation">{{ t('userMenu.theme') }}</el-dropdown-item>
            <el-dropdown-item divided command="logout" :icon="SwitchButton">{{ t('userMenu.logout') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-topbar {
  width: 100%;
  height: var(--layout-topbar-height);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border-default);
  box-shadow: 0 1px 0 rgb(0 0 0 / 2%);
}

.app-topbar__inner {
  display: flex;
  width: 100%;
  max-width: none;
  height: 100%;
  align-items: center;
  gap: var(--space-5);
  padding: 0 var(--space-6);
  margin: 0;
}

.app-topbar__brand {
  display: inline-flex;
  width: 190px;
  flex: 0 0 190px;
  align-items: center;
  gap: var(--space-2);
}

.app-topbar__brand img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.app-topbar__brand strong {
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 650;
  line-height: 24px;
}

.app-topbar__nav {
  display: flex;
  width: 0;
  min-width: 0;
  flex: 1 1 0;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
}

.app-topbar__menu {
  display: flex;
  min-width: 0;
  height: var(--layout-topbar-height);
  flex: 0 1 auto;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  overflow: visible;
}

.app-topbar__nav-item {
  appearance: none;
  position: relative;
  display: inline-flex;
  height: 40px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 40px;
  border-radius: var(--radius-md);
  text-decoration: none;
  white-space: nowrap;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.app-topbar__nav-item::after {
  display: none;
}

.app-topbar__nav-item.is-active,
.app-topbar__nav-item:hover {
  color: var(--color-primary-500);
}

.app-topbar__nav-item.is-active {
  background: color-mix(in srgb, var(--color-primary-500) 8%, transparent);
}

.app-topbar__nav-item:hover {
  background: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
}

.app-topbar__nav-item.is-active:hover {
  background: color-mix(in srgb, var(--color-primary-500) 14%, transparent);
}

.app-topbar__nav-dropdown {
  display: inline-flex;
}

.app-topbar__nav-content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.app-topbar__nav-content :deep(.el-icon) {
  width: 16px;
  height: 16px;
  margin: 0;
  font-size: 16px;
}

.app-topbar__nav-content span {
  display: inline-flex;
  align-items: center;
}

.app-topbar__actions {
  display: flex;
  flex: 0 0 auto;
  min-width: max-content;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;
}

.demo-mode-indicator {
  display: inline-flex;
  height: 24px;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  color: var(--color-warning-default);
  border: 1px solid color-mix(in srgb, var(--color-warning-default) 35%, var(--color-border-default));
  border-radius: 4px;
  font-size: 11px;
  line-height: 22px;
  white-space: nowrap;
}

.demo-mode-indicator i {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  background: var(--color-warning-default);
  border-radius: 50%;
}

.app-topbar__more {
  flex: 0 0 auto;
  margin-left: var(--space-1);
}

.top-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  place-items: center;
  color: var(--color-text-primary);
  background: var(--color-bg-surface);
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.top-icon:hover,
.app-topbar__locale:hover,
.user-entry:hover {
  background: var(--color-bg-default);
}

@media (max-width: 1360px) {
  .top-icon.is-optional {
    display: none;
  }
}

.app-topbar__locale {
  width: 68px;
  height: 32px;
  flex: 0 0 68px;
  padding: 0 var(--space-3);
  color: var(--color-text-primary);
  background: transparent;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-body);
  font-weight: 500;
}

.user-entry {
  display: inline-flex;
  width: auto;
  min-width: 136px;
  max-width: 190px;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  height: 34px;
  padding: 0 4px 0 6px;
  color: var(--color-text-primary);
  background: transparent;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.user-entry__avatar {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  place-items: center;
  color: var(--color-bg-surface);
  background: var(--color-primary-500);
  border-radius: 50%;
  font-size: 13px;
}

.user-entry__name {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: 500;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-entry__chevron {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

:global(.app-topbar-sub-popper .el-dropdown-menu) {
  min-width: 168px;
  padding: 6px;
}

:global(.app-topbar-sub-popper .el-dropdown-menu__item) {
  height: 36px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 36px;
}

:global(.app-topbar-sub-popper .el-dropdown-menu__item:hover) {
  color: var(--color-primary-500);
  background: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
}
</style>
