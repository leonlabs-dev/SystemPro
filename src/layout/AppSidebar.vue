<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
} from '@element-plus/icons-vue';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useLayoutStore } from '@/core/layout/layout.store';
import { getActiveRootNavigation, type NavigationItem } from '@/core/navigation/menu';
import { useNavigationStore } from '@/core/navigation/navigation.store';
import AppMenuItem from './AppMenuItem.vue';
import './sidebar-collapsed.css';

const { t } = useI18n();
const route = useRoute();
const layoutStore = useLayoutStore();
const navigationStore = useNavigationStore();
const isMixMode = computed(() => layoutStore.navMode === 'mix');
const isSidebarCollapsed = computed(() => !isMixMode.value && layoutStore.sidebarCollapsed);

const scrollbarRef = ref<InstanceType<typeof import('element-plus')['ElScrollbar']> | null>(null);

function handleToggle() {
  layoutStore.toggleSidebar();
}

/** 将当前选中的菜单项滚动到侧边栏可视区域 */
function scrollActiveIntoView() {
  nextTick(() => {
    const wrap = scrollbarRef.value?.$el?.querySelector('.el-scrollbar__wrap') as HTMLElement | null;
    if (!wrap) return;
    const activeItem = wrap.querySelector('.el-menu-item.is-active') as HTMLElement | null;
    if (!activeItem) return;

    const wrapRect = wrap.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();

    // 选中项在可视区域下方 → 向下滚动使其可见
    if (itemRect.bottom > wrapRect.bottom) {
      wrap.scrollTop += itemRect.bottom - wrapRect.bottom + 12;
    }
    // 选中项在可视区域上方 → 向上滚动使其可见
    else if (itemRect.top < wrapRect.top) {
      wrap.scrollTop -= wrapRect.top - itemRect.top + 12;
    }
  });
}

// 路由变化时自动滚动
watch(() => route.path, scrollActiveIntoView, { immediate: true });

// 侧边栏展开/折叠可能导致选中项偏移
watch(isSidebarCollapsed, () => {
  nextTick(scrollActiveIntoView);
});

/**
 * 将平铺的 navigationItems 按 group 字段分段，
 * 相邻同 group 的项归入一组，组间插入 group 标签伪项。
 */
interface RenderedItem {
  kind: 'group' | 'menu';
  groupKey?: string;
  item?: NavigationItem;
}

const renderedItems = computed<RenderedItem[]>(() => {
  const result: RenderedItem[] = [];
  let currentGroup = '';
  const useGroupLabels = layoutStore.menuType === 'grouped' && !isSidebarCollapsed.value;
  const activeRoot = getActiveRootNavigation(route.path, navigationStore.items);
  const sidebarItems = isMixMode.value
    ? activeRoot?.children || []
    : navigationStore.items;

  for (const item of sidebarItems) {
    const group = isMixMode.value ? item.sectionGroup : item.group;
    if (useGroupLabels && group && group !== currentGroup) {
      result.push({ kind: 'group', groupKey: group });
      currentGroup = group;
    }
    result.push({ kind: 'menu', item });
  }

  return result;
});
</script>

<template>
  <aside
    class="app-sidebar"
    :class="{
      'is-collapsed': isSidebarCollapsed,
      'is-mix-sidebar': isMixMode,
      'is-classic': layoutStore.menuType === 'classic',
      'is-grouped': layoutStore.menuType === 'grouped',
    }"
  >
    <el-scrollbar ref="scrollbarRef" class="app-sidebar__scrollbar">
      <el-menu
        class="app-sidebar__menu"
        :collapse="isSidebarCollapsed"
        :collapse-transition="false"
        :default-active="$route.path"
        router
      >
        <template v-for="entry in renderedItems" :key="entry.kind === 'group' ? entry.groupKey : entry.item!.id">
          <div
            v-if="entry.kind === 'group'"
            class="app-sidebar__group-label"
            :aria-label="t(entry.groupKey!)"
          >
            {{ t(entry.groupKey!) }}
          </div>
          <AppMenuItem v-else :item="entry.item!" />
        </template>
      </el-menu>
    </el-scrollbar>

    <button
      v-if="!isMixMode"
      class="app-sidebar__toggle"
      type="button"
      :aria-label="t(layoutStore.sidebarCollapsed ? 'actions.expandMenu' : 'actions.collapseMenu')"
      @click="handleToggle"
    >
      <el-icon>
        <ArrowRight v-if="layoutStore.sidebarCollapsed" />
        <ArrowLeft v-else />
      </el-icon>
    </button>
  </aside>
</template>

<style scoped>
.app-sidebar {
  --sidebar-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --sidebar-active-bg: color-mix(in srgb, var(--color-primary-500) 10%, var(--color-bg-surface));
  --sidebar-hover-bg: color-mix(in srgb, var(--color-primary-500) 7%, var(--color-bg-surface));
  position: relative;
  z-index: 20;
  display: flex;
  width: var(--layout-sidebar-expanded);
  height: calc(100vh - var(--layout-topbar-height));
  min-height: 0;
  flex: 0 0 var(--layout-sidebar-expanded);
  flex-direction: column;
  padding: var(--space-2);
  overflow: visible;
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border-default);
  transition:
    width var(--sidebar-transition-duration, 220ms) var(--sidebar-ease),
    flex-basis var(--sidebar-transition-duration, 220ms) var(--sidebar-ease),
    padding var(--sidebar-transition-duration, 220ms) var(--sidebar-ease);
}

.app-sidebar.is-collapsed {
  width: var(--layout-sidebar-collapsed);
  flex-basis: var(--layout-sidebar-collapsed);
  padding: var(--space-3) var(--space-1);
}

.app-sidebar__scrollbar {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.app-sidebar__scrollbar:deep(.el-scrollbar__bar.is-vertical) {
  width: var(--ds-scrollbar-size);
  right: 3px;
}

.app-sidebar__scrollbar:deep(.el-scrollbar__thumb) {
  background-color: var(--ds-scrollbar-thumb);
  opacity: 0.86;
}

.app-sidebar__scrollbar:deep(.el-scrollbar__thumb:hover) {
  background-color: var(--ds-scrollbar-thumb-hover);
  opacity: 1;
}

.app-sidebar__menu {
  min-height: 100%;
  padding-bottom: var(--space-8);
  border: 0;
  background: transparent;
}

.app-sidebar__menu:not(.el-menu--collapse) {
  width: 100%;
}

.app-sidebar__menu:deep(.el-menu-item),
.app-sidebar__menu:deep(.el-sub-menu__title) {
  height: 38px;
  margin: 3px 0;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 38px;
}

.app-sidebar__menu:deep(.el-menu-item > span),
.app-sidebar__menu:deep(.el-sub-menu__title > span) {
  display: inline-block;
  overflow: hidden;
  max-width: 168px;
  opacity: 1;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

/* Label fade: on collapse, hide immediately; on expand, fade in with delay */
.app-sidebar.is-collapsed .app-sidebar__menu:deep(.el-menu-item > span),
.app-sidebar.is-collapsed .app-sidebar__menu:deep(.el-sub-menu__title > span) {
  max-width: 0;
  opacity: 0;
  transition:
    opacity 0ms 0ms,
    max-width 0ms 0ms;
}

.app-sidebar:not(.is-collapsed) .app-sidebar__menu:deep(.el-menu-item > span),
.app-sidebar:not(.is-collapsed) .app-sidebar__menu:deep(.el-sub-menu__title > span) {
  transition:
    opacity var(--label-transition-duration, 140ms) var(--sidebar-ease) var(--label-transition-delay, 120ms),
    max-width var(--label-transition-duration, 140ms) var(--sidebar-ease) var(--label-transition-delay, 120ms);
}

.app-sidebar.is-collapsed .app-sidebar__menu:deep(.el-sub-menu__icon-arrow) {
  width: 0;
  margin: 0;
  opacity: 0;
}

.app-sidebar__menu:deep(.el-menu-item.is-active),
.app-sidebar__menu:deep(.el-menu-item:hover),
.app-sidebar__menu:deep(.el-sub-menu__title:hover) {
  color: var(--color-primary-500);
  background: var(--sidebar-hover-bg);
}

.app-sidebar__menu:deep(.el-menu-item.is-active) {
  background: var(--sidebar-active-bg);
}

.app-sidebar__menu:deep(.el-sub-menu .el-menu-item) {
  min-width: 0;
  height: 36px;
  margin: 3px 0;
  padding-left: 42px !important;
  line-height: 36px;
}

.app-sidebar__menu:deep(.el-sub-menu .el-menu) {
  padding: 2px 0 4px;
  background: transparent;
}

/* Collapsed: el-menu--collapse lives on .app-sidebar__menu itself, not inside it */
.app-sidebar.is-collapsed .app-sidebar__menu {
  --el-menu-icon-width: 16px;
  --el-menu-base-level-padding: 0px;
  display: flex;
  width: 100% !important;
  flex-direction: column;
  align-items: center;
  border: 0;
}

.app-sidebar.is-collapsed .app-sidebar__menu > :deep(.el-menu-item),
.app-sidebar.is-collapsed .app-sidebar__menu > :deep(.el-sub-menu) {
  display: flex;
  width: 100%;
  justify-content: center;
  margin: 0 0 var(--space-1);
}

.app-sidebar.is-collapsed .app-sidebar__menu > :deep(.el-menu-item),
.app-sidebar.is-collapsed .app-sidebar__menu > :deep(.el-sub-menu > .el-sub-menu__title) {
  position: relative;
  display: inline-flex !important;
  width: 40px !important;
  height: 40px !important;
  align-items: center;
  justify-content: center;
  margin: 0 !important;
  padding: 0 !important;
  border-radius: var(--radius-md);
  line-height: 1 !important;
}

.app-sidebar.is-collapsed .app-sidebar__menu > :deep(.el-sub-menu) {
  flex-direction: column;
  align-items: center;
}

.app-sidebar.is-collapsed .app-sidebar__menu :deep(.el-menu-item .el-icon),
.app-sidebar.is-collapsed .app-sidebar__menu :deep(.el-sub-menu__title .el-icon) {
  width: 16px;
  height: 16px;
  margin: 0 !important;
  font-size: 16px;
}

.app-sidebar.is-collapsed .app-sidebar__menu :deep(.el-sub-menu__icon-arrow) {
  display: none !important;
}

.app-sidebar.is-collapsed .app-sidebar__menu :deep(.el-menu-item > span),
.app-sidebar.is-collapsed .app-sidebar__menu :deep(.el-sub-menu__title > span) {
  position: absolute;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none;
}

.app-sidebar.is-collapsed .app-sidebar__menu :deep(.el-menu-item.is-active),
.app-sidebar.is-collapsed .app-sidebar__menu :deep(.el-menu-item:hover),
.app-sidebar.is-collapsed .app-sidebar__menu :deep(.el-sub-menu.is-active > .el-sub-menu__title),
.app-sidebar.is-collapsed .app-sidebar__menu :deep(.el-sub-menu__title:hover) {
  color: var(--color-primary-500);
  background: var(--sidebar-hover-bg);
}

.app-sidebar.is-collapsed .app-sidebar__menu :deep(.el-menu-item.is-active),
.app-sidebar.is-collapsed .app-sidebar__menu :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  background: var(--sidebar-active-bg);
}

.app-sidebar__toggle {
  position: absolute;
  top: var(--space-5);
  right: -11px;
  z-index: 60;
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--color-text-disabled);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: 50%;
  box-shadow: var(--shadow-soft);
  cursor: pointer;
  line-height: 0;
}

.app-sidebar__toggle :deep(.el-icon) {
  display: inline-flex;
  width: 12px;
  height: 12px;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
}

.app-sidebar__toggle :deep(.el-icon svg) {
  display: block;
  width: 1em;
  height: 1em;
}

.app-sidebar__toggle:hover {
  color: var(--color-primary-500);
}

/* ---- Group labels ---- */
.app-sidebar__group-label {
  padding: 14px 14px 6px;
  color: var(--color-text-disabled);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 16px;
  text-transform: uppercase;
  cursor: default;
  user-select: none;
}

.app-sidebar.is-collapsed .app-sidebar__group-label {
  height: 0;
  padding: 0;
  overflow: hidden;
  opacity: 0;
}

:global(.has-hidden-header) .app-sidebar {
  height: 100vh;
}

@media (prefers-reduced-motion: reduce) {
  .app-sidebar,
  .app-sidebar__menu:deep(.el-menu-item > span),
  .app-sidebar__menu:deep(.el-sub-menu__title > span) {
    transition: none !important;
  }
}
</style>
