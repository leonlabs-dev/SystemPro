<script setup lang="ts">
import { Operation } from '@element-plus/icons-vue';
import { computed, KeepAlive, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { localeTransitionVisible } from '@/core/i18n/locale-runtime';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/core/auth/auth.store';
import { useNavigationStore } from '@/core/navigation/navigation.store';
import { useLayoutStore } from '@/core/layout/layout.store';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';
import { getActiveRootNavigation } from '@/core/navigation/menu';
import AppRouteTabs from './AppRouteTabs.vue';
import AppSidebar from './AppSidebar.vue';
import AppTopbar from './AppTopbar.vue';
import PersonalSettingsDrawer from './PersonalSettingsDrawer.vue';
import ThemeSettingsDrawer from './ThemeSettingsDrawer.vue';
import { appName, appVersion } from '@/core/config/app-runtime';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const navigationStore = useNavigationStore();
const layoutStore = useLayoutStore();
const runtimeSettings = useRuntimeSettingsStore();
const settingsVisible = ref(false);
const profileVisible = ref(false);
const activeRoot = computed(() => getActiveRootNavigation(route.path));
const isImmersiveRoute = computed(() => route.meta.immersive === true);
const showRouteTabs = computed(() => layoutStore.showHeader && !isImmersiveRoute.value);
const shouldShowSidebar = computed(() => {
  if (!layoutStore.showMenu || layoutStore.navMode === 'top') {
    return false;
  }

  if (layoutStore.navMode === 'mix') {
    return Boolean(activeRoot.value?.children?.length);
  }

  return true;
});
let authorizationTimer: number | undefined;
async function syncAuthorization(force = false) {
  await authStore.refreshAuthorization(force);
  if (!navigationStore.canAccessPath(route.path)) {
    await router.replace(navigationStore.firstPath || '/login');
  }
}
function syncOnFocus() { void syncAuthorization(true).catch(() => undefined); }
function syncOnVisibility() {
  if (document.visibilityState === 'visible') syncOnFocus();
}
onMounted(() => {
  runtimeSettings.load().catch(() => undefined);
  authorizationTimer = window.setInterval(() => { void syncAuthorization().catch(() => undefined); }, 5_000);
  window.addEventListener('focus', syncOnFocus);
  document.addEventListener('visibilitychange', syncOnVisibility);
});
onBeforeUnmount(() => {
  window.clearInterval(authorizationTimer);
  window.removeEventListener('focus', syncOnFocus);
  document.removeEventListener('visibilitychange', syncOnVisibility);
});
</script>

<template>
  <div
    class="app-layout"
    :class="{
      'has-fixed-header': layoutStore.fixedHeader,
      'has-fixed-sidebar': layoutStore.fixedSidebar,
      'is-content-fixed': layoutStore.contentWidth === 'fixed',
      'has-hidden-header': !layoutStore.showHeader,
      'is-top-nav': layoutStore.navMode === 'top',
      'is-mix-nav': layoutStore.navMode === 'mix',
      'is-immersive-route': isImmersiveRoute,
    }"
  >
    <AppTopbar v-if="layoutStore.showHeader" @open-settings="settingsVisible = true" @open-profile="profileVisible = true" />
    <div class="app-layout__body">
      <AppSidebar v-if="shouldShowSidebar" />
      <main class="app-layout__content">
        <div class="app-layout__content-inner">
          <AppRouteTabs v-if="showRouteTabs" />
          <div class="app-layout__route-view">
            <RouterView v-slot="{ Component, route: viewRoute }">
              <KeepAlive>
                <component
                  :is="Component"
                  v-if="Component && viewRoute.meta.keepAlive !== false"
                  :key="`${String(viewRoute.name || viewRoute.path)}:${String(viewRoute.query._refresh || '')}`"
                />
              </KeepAlive>
              <component
                :is="Component"
                v-if="Component && viewRoute.meta.keepAlive === false"
                :key="`${String(viewRoute.name || viewRoute.path)}:${String(viewRoute.query._refresh || '')}`"
              />
            </RouterView>
            <Transition name="locale-curtain">
              <div
                v-if="localeTransitionVisible"
                class="app-layout__locale-curtain"
                role="status"
                aria-live="polite"
              >
                <span class="app-layout__locale-progress" />
                <span class="app-layout__locale-message">{{ t('i18nManagement.applying') }}</span>
              </div>
            </Transition>
          </div>
          <footer v-if="layoutStore.showFooter && !isImmersiveRoute" class="app-layout__footer">
            {{ appName }} · v{{ appVersion }}
          </footer>
        </div>
      </main>
    </div>
    <el-tooltip :content="t('userMenu.theme')" placement="left">
      <button class="app-layout__settings-trigger" type="button" :aria-label="t('userMenu.theme')" @click="settingsVisible = true">
        <el-icon><Operation /></el-icon>
      </button>
    </el-tooltip>
    <ThemeSettingsDrawer v-model="settingsVisible" />
    <PersonalSettingsDrawer v-model="profileVisible" @open-theme-settings="profileVisible = false; settingsVisible = true" />
  </div>
</template>

<style scoped>
.app-layout {
  display: grid;
  grid-template-rows: var(--layout-topbar-height) minmax(0, 1fr);
  width: 100%;
  height: 100vh;
  min-width: 0;
  min-height: 100vh;
  overflow: hidden;
  background: var(--color-bg-default);
}

.has-hidden-header {
  grid-template-rows: minmax(0, 1fr);
}

.has-fixed-header :deep(.app-topbar) {
  position: sticky;
  top: 0;
  z-index: 30;
}

.app-layout__body {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.has-fixed-sidebar :deep(.app-sidebar) {
  position: sticky;
  top: var(--layout-topbar-height);
  align-self: flex-start;
}

.app-layout__content {
  position: relative;
  width: 100%;
  min-width: 0;
  flex: 1 1 0;
  padding: 12px 24px 24px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-color: var(--ds-scrollbar-thumb) transparent;
  scrollbar-width: thin;
}

.app-layout__content::-webkit-scrollbar {
  width: var(--ds-scrollbar-size);
}

.app-layout__content::-webkit-scrollbar-track {
  background: transparent;
}

.app-layout__content::-webkit-scrollbar-thumb {
  background: var(--ds-scrollbar-thumb);
  border-radius: var(--radius-pill);
}

.app-layout__content::-webkit-scrollbar-thumb:hover {
  background: var(--ds-scrollbar-thumb-hover);
}

.app-layout__content::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

.is-top-nav .app-layout__content {
  padding: 12px 24px 24px;
}

.is-mix-nav .app-layout__content {
  padding: 12px 24px 24px;
}

.app-layout__content-inner {
  width: 100%;
  min-width: 0;
  max-width: none;
  margin: 0;
}

.app-layout__route-view {
  position: relative;
  min-height: calc(100vh - var(--layout-topbar-height) - 108px);
}

.is-immersive-route .app-layout__content-inner,
.is-immersive-route .app-layout__route-view {
  min-height: 0;
}

.is-immersive-route .app-layout__content-inner {
  max-width: none !important;
}

.app-layout__locale-curtain {
  position: absolute;
  z-index: 35;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-bg-default) 88%, transparent);
  backdrop-filter: blur(3px);
}

.app-layout__locale-message {
  padding: 8px 14px;
  color: var(--color-text-secondary);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-soft);
  font-size: 13px;
  line-height: 20px;
}

.app-layout__locale-progress {
  position: absolute;
  top: 0;
  left: 0;
  width: 38%;
  height: 2px;
  background: var(--color-primary-500);
  border-radius: var(--radius-pill);
  animation: locale-progress 900ms ease-in-out infinite;
}

.locale-curtain-enter-active,
.locale-curtain-leave-active {
  transition: opacity 140ms ease;
}

.locale-curtain-enter-from,
.locale-curtain-leave-to {
  opacity: 0;
}

@keyframes locale-progress {
  from { transform: translateX(-110%); }
  to { transform: translateX(375%); }
}

@media (prefers-reduced-motion: reduce) {
  .app-layout__locale-progress { animation: none; }
  .locale-curtain-enter-active,
  .locale-curtain-leave-active { transition: none; }
}

.is-content-fixed .app-layout__content-inner {
  max-width: 1280px;
  margin: 0 auto;
}

.is-top-nav .app-layout__content-inner,
.is-mix-nav .app-layout__content-inner {
  max-width: none;
}

.is-content-fixed.is-top-nav .app-layout__content-inner,
.is-content-fixed.is-mix-nav .app-layout__content-inner {
  max-width: 1280px;
  margin: 0 auto;
}

.app-layout__footer {
  padding: var(--space-6) 0 var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  text-align: center;
}

.app-layout__settings-trigger {
  position: fixed;
  top: 50%;
  right: 0;
  z-index: 80;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  padding: 0;
  color: var(--color-white);
  background: var(--color-primary-500);
  border: 0;
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  box-shadow: var(--shadow-panel);
  cursor: pointer;
  transform: translateY(-50%);
}

.app-layout__settings-trigger:hover {
  background: var(--color-primary-600);
}

</style>
