<script setup lang="ts">
import en from 'element-plus/es/locale/lang/en';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView } from 'vue-router';
import { useThemeStore } from './core/theme/theme.store';
import { useLayoutStore } from './core/layout/layout.store';
import { routeLoading } from './core/navigation/route-loading';

const themeStore = useThemeStore();
const layoutStore = useLayoutStore();
const routeLoadingActive = routeLoading.active;
const { locale } = useI18n();
const elementLocale = computed(() => locale.value === 'en-US' ? en : zhCn);

onMounted(() => {
  themeStore.applyTheme();
  layoutStore.applyVisualPreference();
  document.documentElement.lang = locale.value;
});

watch(locale, (value) => { document.documentElement.lang = value; });

watch(
  () => themeStore.theme,
  () => themeStore.applyTheme(),
);

watch(
  () => themeStore.primaryColor,
  () => themeStore.applyPrimaryColor(),
);

watch(
  () => layoutStore.weakMode,
  () => layoutStore.applyVisualPreference(),
);
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <div class="route-progress" :class="{ 'is-active': routeLoadingActive }" aria-hidden="true">
      <i />
    </div>
    <RouterView />
  </el-config-provider>
</template>

<style scoped>
.route-progress {
  position: fixed;
  z-index: 10000;
  top: 0;
  right: 0;
  left: 0;
  height: 2px;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease;
}

.route-progress.is-active { opacity: 1; }

.route-progress i {
  display: block;
  width: 42%;
  height: 100%;
  background: var(--color-primary-500);
  transform: translateX(-110%);
}

.route-progress.is-active i { animation: route-progress 1.05s ease-in-out infinite; }

@keyframes route-progress {
  55% { transform: translateX(125%); }
  100% { transform: translateX(245%); }
}
</style>
