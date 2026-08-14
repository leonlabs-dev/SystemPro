<script setup lang="ts">
import { Check, Close, CopyDocument, RefreshLeft } from '@element-plus/icons-vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLayoutStore, type ContentWidth, type NavMode, type SideMenuType } from '@/core/layout/layout.store';
import { useThemeStore } from '@/core/theme/theme.store';
import { primarySwatches } from '@/design-system/tokens/primary';

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const { t } = useI18n();
const themeStore = useThemeStore();
const layoutStore = useLayoutStore();

const colors = primarySwatches;
const styleOptions = [
  { key: 'light', labelKey: 'settings.lightStyle' },
  { key: 'dark', labelKey: 'settings.darkStyle' },
] as const;
const navModeOptions: Array<{ key: NavMode; labelKey: string }> = [
  { key: 'side', labelKey: 'settings.sideNav' },
  { key: 'top', labelKey: 'settings.topNav' },
  { key: 'mix', labelKey: 'settings.mixNav' },
];
const menuTypeOptions: Array<{ key: SideMenuType; labelKey: string }> = [
  { key: 'classic', labelKey: 'settings.classicMenu' },
  { key: 'grouped', labelKey: 'settings.groupedMenu' },
];

const settingsJson = computed(() => JSON.stringify({
  theme: themeStore.theme,
  primaryColor: themeStore.primaryColor,
  layout: {
    navMode: layoutStore.navMode,
    menuType: layoutStore.menuType,
    contentWidth: layoutStore.contentWidth,
    fixedHeader: layoutStore.fixedHeader,
    fixedSidebar: layoutStore.fixedSidebar,
    splitMenu: layoutStore.splitMenu,
    showHeader: layoutStore.showHeader,
    showFooter: layoutStore.showFooter,
    showMenu: layoutStore.showMenu,
    showMenuHeader: layoutStore.showMenuHeader,
    weakMode: layoutStore.weakMode,
  },
}, null, 2));

function closeDrawer() {
  emit('update:modelValue', false);
}

async function copySettings() {
  await navigator.clipboard?.writeText(settingsJson.value);
  ElMessage.success(t('settings.copySuccess'));
}

function resetSettings() {
  themeStore.setTheme('light');
  themeStore.setPrimaryColor('blue');
  layoutStore.resetPreference();
  ElMessage.success(t('settings.resetSuccess'));
}

function setContentWidth(value: string | number | boolean | Record<string, unknown>) {
  layoutStore.setContentWidth(value as ContentWidth);
}

function setTableDensity(value: string | number | boolean | Record<string, unknown>) {
  layoutStore.setTableDensity(value as 'comfortable' | 'compact');
}

function setThemeMode(value: 'light' | 'dark') {
  if (layoutStore.weakMode) {
    layoutStore.setWeakMode(false);
  }
  themeStore.setTheme(value);
}

function setWeakMode(value: string | number | boolean) {
  layoutStore.setWeakMode(value === true);
}
</script>

<template>
  <el-drawer
    class="theme-settings"
    :model-value="modelValue"
    size="380px"
    :with-header="false"
    :modal="true"
    append-to-body
    destroy-on-close
    :close-on-click-modal="true"
    :lock-scroll="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="settings-shell">
      <header class="settings-header">
        <div>
          <p>{{ t('settings.panelEyebrow') }}</p>
          <h2>{{ t('settings.title') }}</h2>
        </div>
        <button class="settings-icon-button" type="button" :aria-label="t('actions.cancel')" @click="closeDrawer">
          <el-icon><Close /></el-icon>
        </button>
      </header>

      <section class="settings-section">
        <h3>{{ t('settings.overallStyle') }}</h3>
        <div class="preview-grid">
          <button
            v-for="option in styleOptions"
            :key="option.key"
            class="preview-card"
            :class="[`is-${option.key}`, { 'is-active': themeStore.theme === option.key }]"
            type="button"
            :title="t(option.labelKey)"
            @click="setThemeMode(option.key)"
          >
            <span class="preview-card__body" />
            <el-icon v-if="themeStore.theme === option.key"><Check /></el-icon>
          </button>
        </div>
      </section>

      <section class="settings-section">
        <h3>{{ t('settings.primaryColor') }}</h3>
        <div class="color-grid">
          <button
            v-for="color in colors"
            :key="color.key"
            class="color-swatch"
            :class="{ 'is-active': themeStore.primaryColor === color.key }"
            :style="{ backgroundColor: color.value }"
            type="button"
            :title="color.key"
            @click="themeStore.setPrimaryColor(color.key)"
          >
            <el-icon v-if="themeStore.primaryColor === color.key"><Check /></el-icon>
          </button>
        </div>
      </section>

      <section class="settings-section">
        <h3>{{ t('settings.navMode') }}</h3>
        <div class="preview-grid is-three">
          <button
            v-for="option in navModeOptions"
            :key="option.key"
            class="preview-card"
            :class="[`is-nav-${option.key}`, { 'is-active': layoutStore.navMode === option.key }]"
            type="button"
            :title="t(option.labelKey)"
            @click="layoutStore.setNavMode(option.key)"
          >
            <span class="preview-card__body" />
            <el-icon v-if="layoutStore.navMode === option.key"><Check /></el-icon>
          </button>
        </div>
      </section>

      <section
        class="settings-section"
        :class="{ 'is-disabled': layoutStore.navMode !== 'side' }"
      >
        <h3>{{ t('settings.menuType') }}</h3>
        <div class="preview-grid">
          <button
            v-for="option in menuTypeOptions"
            :key="option.key"
            class="preview-card"
            :class="[`is-menu-${option.key}`, { 'is-active': layoutStore.menuType === option.key }]"
            type="button"
            :title="t(option.labelKey)"
            :disabled="layoutStore.navMode !== 'side'"
            @click="layoutStore.setMenuType(option.key)"
          >
            <span class="preview-card__body" />
            <el-icon v-if="layoutStore.menuType === option.key"><Check /></el-icon>
          </button>
        </div>
      </section>

      <section class="settings-section settings-list">
        <div class="setting-row">
          <span>{{ t('settings.tableDensity') }}</span>
          <el-select :model-value="layoutStore.tableDensity" size="small" @change="setTableDensity">
            <el-option :label="t('settings.tableDensityCompact')" value="compact" />
            <el-option :label="t('settings.tableDensityDefault')" value="comfortable" />
          </el-select>
        </div>
        <div class="setting-row">
          <span>{{ t('settings.contentWidth') }}</span>
          <el-select :model-value="layoutStore.contentWidth" size="small" @change="setContentWidth">
            <el-option :label="t('settings.fluid')" value="fluid" />
            <el-option :label="t('settings.fixed')" value="fixed" />
          </el-select>
        </div>
        <label class="setting-row">
          <span>{{ t('settings.fixedHeader') }}</span>
          <el-switch v-model="layoutStore.fixedHeader" size="small" @change="layoutStore.persist" />
        </label>
        <label class="setting-row">
          <span>{{ t('settings.fixedSidebar') }}</span>
          <el-switch v-model="layoutStore.fixedSidebar" size="small" :disabled="layoutStore.navMode === 'top'" @change="layoutStore.persist" />
        </label>
        <label class="setting-row">
          <span>{{ t('settings.splitMenu') }}</span>
          <el-switch v-model="layoutStore.splitMenu" size="small" :disabled="layoutStore.navMode !== 'mix'" @change="layoutStore.persist" />
        </label>
      </section>

      <section class="settings-section settings-list">
        <h3>{{ t('settings.contentArea') }}</h3>
        <label class="setting-row">
          <span>{{ t('settings.header') }}</span>
          <el-switch v-model="layoutStore.showHeader" size="small" @change="layoutStore.persist" />
        </label>
        <label class="setting-row">
          <span>{{ t('settings.footer') }}</span>
          <el-switch v-model="layoutStore.showFooter" size="small" @change="layoutStore.persist" />
        </label>
        <label class="setting-row">
          <span>{{ t('settings.menu') }}</span>
          <el-switch v-model="layoutStore.showMenu" size="small" @change="layoutStore.persist" />
        </label>
        <label class="setting-row">
          <span>{{ t('settings.menuHeader') }}</span>
          <el-switch v-model="layoutStore.showMenuHeader" size="small" @change="layoutStore.persist" />
        </label>
      </section>

      <section class="settings-section settings-list">
        <h3>{{ t('settings.other') }}</h3>
        <label class="setting-row">
          <span>{{ t('settings.weakMode') }}</span>
          <el-switch :model-value="layoutStore.weakMode" size="small" @change="setWeakMode" />
        </label>
      </section>

      <div class="settings-actions">
        <el-button :icon="RefreshLeft" @click="resetSettings">{{ t('settings.reset') }}</el-button>
        <el-button type="primary" :icon="CopyDocument" @click="copySettings">{{ t('settings.copy') }}</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.settings-shell {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}

.settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-4) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--color-border-default);
}

.settings-header p {
  margin: 0 0 2px;
  color: var(--color-text-disabled);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.settings-header h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-h3);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-h3);
}

.settings-icon-button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.settings-icon-button:hover {
  color: var(--color-primary-500);
  background: var(--color-bg-default);
}

.settings-section {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border-default);
}

.settings-section h3 {
  margin: 0 0 var(--space-3);
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-body);
}

.settings-section.is-disabled {
  opacity: var(--opacity-disabled);
}

.preview-grid,
.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.preview-grid.is-three {
  gap: var(--space-3);
}

.preview-card {
  position: relative;
  width: 56px;
  height: 42px;
  padding: 0;
  overflow: hidden;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  box-shadow: none;
  cursor: pointer;
}

.preview-card:disabled {
  cursor: not-allowed;
}

.preview-card.is-active {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary-500) 12%, transparent);
}

.preview-card__body {
  position: absolute;
  inset: 0;
}

.preview-card.is-light .preview-card__body {
  background: linear-gradient(90deg, var(--preview-light-panel) 0 100%);
}

.preview-card.is-dark .preview-card__body {
  background: linear-gradient(90deg, var(--preview-dark-panel) 0 45%, var(--preview-dark-panel-soft) 45% 100%);
}

.preview-card.is-nav-side .preview-card__body {
  background: linear-gradient(90deg, var(--preview-dark-panel) 0 28%, var(--preview-light-panel) 28% 100%);
}

.preview-card.is-nav-top .preview-card__body {
  background: linear-gradient(180deg, var(--preview-dark-panel) 0 28%, var(--preview-light-panel) 28% 100%);
}

.preview-card.is-nav-mix .preview-card__body {
  background:
    linear-gradient(180deg, var(--preview-dark-panel) 0 28%, transparent 28%),
    linear-gradient(90deg, var(--preview-dark-panel) 0 28%, var(--preview-light-panel) 28% 100%);
}

.preview-card.is-menu-classic .preview-card__body {
  background: linear-gradient(90deg, var(--preview-dark-panel) 0 34%, var(--preview-muted-panel) 34% 100%);
}

.preview-card.is-menu-classic .preview-card__body::after,
.preview-card.is-menu-grouped .preview-card__body::after {
  position: absolute;
  left: 10px;
  top: 9px;
  width: 14px;
  height: 24px;
  border-radius: var(--radius-xs);
  background: rgb(255 255 255 / 18%);
  content: "";
}

.preview-card.is-menu-grouped .preview-card__body {
  background:
    linear-gradient(90deg, var(--preview-dark-panel) 0 34%, var(--preview-light-panel) 34% 100%),
    repeating-linear-gradient(180deg, transparent 0 8px, var(--preview-muted-line) 8px 9px);
}

.preview-card.is-menu-grouped .preview-card__body::after {
  background: rgb(255 255 255 / 24%);
}

.preview-card .el-icon {
  position: absolute;
  right: 6px;
  bottom: 5px;
  color: var(--color-primary-500);
  font-size: var(--font-body);
}

.color-swatch {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  color: var(--color-white);
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.color-swatch.is-active {
  box-shadow: 0 0 0 2px var(--color-bg-surface), 0 0 0 4px var(--color-primary-500);
}

.color-swatch .el-icon {
  font-size: 13px;
}

.settings-list {
  display: grid;
  gap: var(--space-3);
}

.setting-row {
  display: flex;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-text-primary);
  font-size: var(--font-body);
  line-height: var(--line-body);
}

.setting-row .el-select {
  width: 112px;
}

.settings-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  padding: var(--space-4);
  margin-top: auto;
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-border-default);
}

:deep(.el-drawer__body) {
  padding: 0;
}

@media (max-width: 520px) {
  :global(.theme-settings.el-drawer) {
    width: min(100vw, 380px) !important;
  }
}
</style>
