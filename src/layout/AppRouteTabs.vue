<script setup lang="ts">
import { Close, RefreshRight } from '@element-plus/icons-vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useRouteTabsStore, type RouteTabItem } from '@/core/navigation/route-tabs.store';
import { useNavigationStore } from '@/core/navigation/navigation.store';
import { getNavigationTitle } from '@/core/navigation/menu';

const router = useRouter();
const { t } = useI18n();
const routeTabsStore = useRouteTabsStore();
const navigationStore = useNavigationStore();

// ── Overflow management ──
const TAB_GAP = 8;
const moreDropdownVisible = ref(false);
const draggedPath = ref('');
let dragCandidate: { path: string; startX: number; startY: number; rect: DOMRect } | null = null;
let suppressClick = false;
let dragMoveFrame = 0;
let pendingDragPoint: { x: number; y: number } | null = null;
let dragSlotRects = new Map<string, DOMRect>();
const dragOffsetX = ref(0);
const dragOriginIndex = ref(-1);
const dragTargetIndex = ref(-1);
const dragTabWidth = ref(0);

const allTabs = computed(() => routeTabsStore.tabs);
const activePath = computed(() => routeTabsStore.activePath);

const layoutReady = ref(false);
const visiblePaths = ref<string[]>([]);
const visiblePathSet = computed(() => new Set(visiblePaths.value));
const displayedTabs = computed(() => (
  layoutReady.value ? allTabs.value.filter((tab) => visiblePathSet.value.has(tab.path)) : allTabs.value
));
const overflowTabs = computed(() => (
  layoutReady.value ? allTabs.value.filter((tab) => !visiblePathSet.value.has(tab.path)) : []
));
const overflowCount = computed(() => overflowTabs.value.length);
// Keep overflow controls mounted while widths are re-measured after sorting.
// Hiding them during the two-frame measurement cycle caused a visible flash on every drop.
const hasOverflow = computed(() => layoutReady.value && overflowCount.value > 0);

// ── DOM refs ──
const scrollerRef = ref<HTMLElement>();
const measureRef = ref<HTMLElement>();
const badgeMirrorRef = ref<HTMLElement>();
const moreMirrorRef = ref<HTMLElement>();

let resizeObserver: ResizeObserver | null = null;
let recalcFrame = 0;

/** 测量溢出元素的动态宽度（从隐藏镜像 DOM 读取） */
function getOverflowControlWidth(): number {
  const badgeW = badgeMirrorRef.value?.offsetWidth ?? 44;
  const moreW = moreMirrorRef.value?.offsetWidth ?? 76;
  return badgeW + moreW;
}

function getMeasuredTabWidths() {
  const widthMap = new Map<string, number>();
  const tabEls = measureRef.value?.querySelectorAll<HTMLElement>('[data-route-tab-path]');
  tabEls?.forEach((el) => {
    const path = el.dataset.routeTabPath;
    if (path) {
      widthMap.set(path, Math.ceil(el.getBoundingClientRect().width));
    }
  });
  return widthMap;
}

function sumVisibleWidth(indices: number[], widths: number[], withOverflow: boolean) {
  const tabWidth = indices.reduce((sum, index) => sum + widths[index], 0);
  const tabGaps = Math.max(0, indices.length - 1) * TAB_GAP;

  if (!withOverflow) {
    return tabWidth + tabGaps;
  }

  const controlGaps = indices.length > 0 ? TAB_GAP * 2 : TAB_GAP;
  return tabWidth + tabGaps + getOverflowControlWidth() + controlGaps;
}

function canFit(indices: number[], widths: number[], containerWidth: number) {
  return sumVisibleWidth(indices, widths, true) <= containerWidth;
}

function buildVisibleIndices(widths: number[], containerWidth: number) {
  const tabs = allTabs.value;
  const totalWidth = sumVisibleWidth(tabs.map((_, index) => index), widths, false);
  if (totalWidth <= containerWidth) {
    return tabs.map((_, index) => index);
  }

  const activeIndex = tabs.findIndex((tab) => tab.path === activePath.value);
  const seed = activeIndex >= 0 ? [activeIndex] : [0];

  if (!canFit(seed, widths, containerWidth)) {
    return [];
  }

  const selected = new Set(seed);

  for (let index = 0; index < tabs.length; index += 1) {
    if (selected.has(index)) continue;

    const next = Array.from(selected).concat(index).sort((a, b) => a - b);
    if (!canFit(next, widths, containerWidth)) {
      continue;
    }

    selected.add(index);
  }

  return Array.from(selected).sort((a, b) => a - b);
}

/** 核心布局计算：从隐藏测量层读取真实宽度，再生成不会挤压的可见集合。 */
function recalcLayout() {
  const scroller = scrollerRef.value;
  if (!scroller) {
    return;
  }

  const containerWidth = scroller.clientWidth;
  const tabs = allTabs.value;
  if (!tabs.length || containerWidth <= 0) {
    visiblePaths.value = [];
    layoutReady.value = false;
    return;
  }

  const measuredWidths = getMeasuredTabWidths();
  if (measuredWidths.size < tabs.length) {
    scheduleRecalc();
    return;
  }

  const widths = tabs.map((tab) => measuredWidths.get(tab.path) ?? 0);
  const nextVisiblePaths = buildVisibleIndices(widths, containerWidth).map((index) => tabs[index].path);

  if (nextVisiblePaths.join('|') !== visiblePaths.value.join('|')) {
    visiblePaths.value = nextVisiblePaths;
  }
  layoutReady.value = true;
}

/** 调度 recalcLayout：nextTick + 双 rAF，等 Vue 和浏览器布局都稳定后再测量。 */
function scheduleRecalc() {
  if (recalcFrame) {
    cancelAnimationFrame(recalcFrame);
  }

  nextTick(() => {
    recalcFrame = requestAnimationFrame(() => {
      recalcFrame = requestAnimationFrame(() => {
        recalcFrame = 0;
        recalcLayout();
      });
    });
  });
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => scheduleRecalc());
  if (scrollerRef.value) {
    resizeObserver.observe(scrollerRef.value);
  }
  if (measureRef.value) {
    resizeObserver.observe(measureRef.value);
  }

  scheduleRecalc();
  window.setTimeout(scheduleRecalc, 120);
});

onBeforeUnmount(() => {
  if (recalcFrame) {
    cancelAnimationFrame(recalcFrame);
  }
  resizeObserver?.disconnect();
  resizeObserver = null;
  stopDragging();
});

watch(
  () => [activePath.value, allTabs.value.map((tab) => `${tab.path}:${tabTitle(tab)}`).join('|')],
  () => scheduleRecalc(),
);

// ── Tab interactions ──
function tabTitle(tab: RouteTabItem) {
  const navigationItem = navigationStore.flatItems.find((item) => item.path === tab.path);
  if (navigationItem) return getNavigationTitle(navigationItem, t);
  return tab.titleKey ? t(tab.titleKey) : tab.title;
}

function openTab(tab: RouteTabItem) {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  router.push(tab.fullPath || tab.path);
}

function tabElements() {
  return Array.from(scrollerRef.value?.querySelectorAll<HTMLElement>('[data-visible-route-tab]') ?? []);
}

function startDrag(event: PointerEvent, tab: RouteTabItem) {
  if (!tab.closable || event.button !== 0) return;
  const element = event.currentTarget as HTMLElement;
  dragCandidate = {
    path: tab.path,
    startX: event.clientX,
    startY: event.clientY,
    rect: element.getBoundingClientRect(),
  };
  dragSlotRects = new Map(tabElements().map((item) => [item.dataset.visibleRouteTab || '', item.getBoundingClientRect()]));
  dragOriginIndex.value = allTabs.value.findIndex((item) => item.path === tab.path);
  dragTargetIndex.value = dragOriginIndex.value;
  dragTabWidth.value = element.getBoundingClientRect().width;
  window.addEventListener('pointermove', handleDragMove, { passive: false });
  window.addEventListener('pointerup', stopDragging, { once: true });
  window.addEventListener('pointercancel', stopDragging, { once: true });
}

function handleDragMove(event: PointerEvent) {
  if (!dragCandidate) return;
  const deltaX = event.clientX - dragCandidate.startX;
  const deltaY = event.clientY - dragCandidate.startY;
  if (!draggedPath.value && Math.hypot(deltaX, deltaY) < 5) return;
  event.preventDefault();
  if (!draggedPath.value) {
    draggedPath.value = dragCandidate.path;
    suppressClick = true;
  }
  pendingDragPoint = { x: event.clientX, y: event.clientY };
  if (dragMoveFrame) return;
  dragMoveFrame = requestAnimationFrame(processDragMove);
}

function processDragMove() {
  dragMoveFrame = 0;
  if (!dragCandidate || !pendingDragPoint) return;
  const { x } = pendingDragPoint;
  const deltaX = x - dragCandidate.startX;
  dragOffsetX.value = deltaX;
  const draggedCenter = dragCandidate.rect.left + dragCandidate.rect.width / 2 + deltaX;
  const candidates = tabElements()
    .map((element) => ({
      path: element.dataset.visibleRouteTab || '',
      rect: dragSlotRects.get(element.dataset.visibleRouteTab || '') || element.getBoundingClientRect(),
    }))
    .filter(({ path }) => path !== draggedPath.value && allTabs.value.find((tab) => tab.path === path)?.closable);
  const crossedLeft = candidates
    .map((candidate) => ({ ...candidate, index: allTabs.value.findIndex((tab) => tab.path === candidate.path) }))
    .filter((candidate) => candidate.index < dragOriginIndex.value && draggedCenter < candidate.rect.left + candidate.rect.width / 2)
    .map((candidate) => candidate.index);
  const crossedRight = candidates
    .map((candidate) => ({ ...candidate, index: allTabs.value.findIndex((tab) => tab.path === candidate.path) }))
    .filter((candidate) => candidate.index > dragOriginIndex.value && draggedCenter > candidate.rect.left + candidate.rect.width / 2)
    .map((candidate) => candidate.index);
  const nextIndex = crossedLeft.length
    ? Math.min(...crossedLeft)
    : crossedRight.length
      ? Math.max(...crossedRight)
      : dragOriginIndex.value;
  dragTargetIndex.value = nextIndex;
}

function dragStyle(tab: RouteTabItem) {
  if (!draggedPath.value) return undefined;
  const index = allTabs.value.findIndex((item) => item.path === tab.path);
  if (tab.path === draggedPath.value) {
    return { transform: `translate3d(${dragOffsetX.value}px, 0, 0) scale(1.018)` };
  }
  const shift = dragTabWidth.value + TAB_GAP;
  if (dragOriginIndex.value < dragTargetIndex.value && index > dragOriginIndex.value && index <= dragTargetIndex.value) {
    return { transform: `translate3d(${-shift}px, 0, 0)` };
  }
  if (dragOriginIndex.value > dragTargetIndex.value && index >= dragTargetIndex.value && index < dragOriginIndex.value) {
    return { transform: `translate3d(${shift}px, 0, 0)` };
  }
  return undefined;
}

function stopDragging() {
  window.removeEventListener('pointermove', handleDragMove);
  window.removeEventListener('pointerup', stopDragging);
  window.removeEventListener('pointercancel', stopDragging);
  if (dragMoveFrame) cancelAnimationFrame(dragMoveFrame);
  dragMoveFrame = 0;
  pendingDragPoint = null;
  if (draggedPath.value && dragTargetIndex.value >= 0) {
    routeTabsStore.moveToIndex(draggedPath.value, dragTargetIndex.value);
  }
  dragCandidate = null;
  draggedPath.value = '';
  dragOffsetX.value = 0;
  dragOriginIndex.value = -1;
  dragTargetIndex.value = -1;
  dragTabWidth.value = 0;
  dragSlotRects.clear();
  window.setTimeout(() => { suppressClick = false; }, 0);
}

function handleTabKeydown(event: KeyboardEvent, tab: RouteTabItem) {
  if (!event.altKey || !tab.closable || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  routeTabsStore.moveBy(tab.path, event.key === 'ArrowLeft' ? -1 : 1);
}

function closeTab(tab: RouteTabItem) {
  const fallback = routeTabsStore.close(tab.path);
  if (fallback && routeTabsStore.activePath === tab.path) {
    router.push(fallback.fullPath || fallback.path);
  }
}

function closeCurrent() {
  const fallback = routeTabsStore.closeCurrent();
  if (fallback) {
    router.push(fallback.fullPath || fallback.path);
  }
}

function closeAll() {
  const home = routeTabsStore.closeAll();
  if (home) {
    router.push(home.fullPath || home.path);
  }
}

function refreshCurrent() {
  router.replace({
    path: router.currentRoute.value.path,
    query: {
      ...router.currentRoute.value.query,
      _refresh: String(Date.now()),
    },
  });
}
</script>

<template>
  <nav v-if="allTabs.length" class="app-route-tabs" aria-label="opened pages">
    <div ref="scrollerRef" class="app-route-tabs__scroller">
      <!-- Visible tabs -->
      <button
        v-for="tab in displayedTabs"
        :key="tab.path"
        class="app-route-tab"
        :class="{ 'is-active': tab.path === activePath, 'is-dragging': tab.path === draggedPath, 'is-sorting': Boolean(draggedPath) }"
        :style="dragStyle(tab)"
        type="button"
        :data-visible-route-tab="tab.path"
        @click="openTab(tab)"
        @pointerdown="startDrag($event, tab)"
        @keydown="handleTabKeydown($event, tab)"
        @contextmenu.prevent="routeTabsStore.closeOthers(tab.path)"
      >
        <span class="app-route-tab__dot" />
        <span class="app-route-tab__text">{{ tabTitle(tab) }}</span>
        <span v-if="tab.closable" class="app-route-tab__close" @click.stop="closeTab(tab)">
          <el-icon><Close /></el-icon>
        </span>
      </button>

      <!-- Overflow: +N badge -->
      <span v-if="hasOverflow" class="app-route-tabs__overflow-badge">+{{ overflowCount }}</span>

      <!-- Overflow: ⋯ 更多 dropdown -->
      <el-dropdown
        v-if="hasOverflow"
        v-model:visible="moreDropdownVisible"
        trigger="click"
        placement="bottom-start"
      >
        <button class="app-route-tab app-route-tab--more" type="button">
          <span class="app-route-tab__text">⋯ {{ t('common.more') }}</span>
        </button>
        <template #dropdown>
          <el-dropdown-menu class="app-route-tabs__overflow-menu">
            <el-dropdown-item
              v-for="tab in overflowTabs"
              :key="tab.path"
              :class="{ 'is-active': tab.path === activePath }"
              @click="openTab(tab)"
            >
              <span class="app-route-tabs__overflow-item">
                <span class="app-route-tab__dot" />
                <span class="app-route-tabs__overflow-label">{{ tabTitle(tab) }}</span>
                <button
                  v-if="tab.closable"
                  class="app-route-tabs__overflow-close"
                  type="button"
                  @click.stop="closeTab(tab)"
                >
                  <el-icon><Close /></el-icon>
                </button>
              </span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div ref="measureRef" class="app-route-tabs__measure" aria-hidden="true">
      <button
        v-for="tab in allTabs"
        :key="tab.path"
        class="app-route-tab"
        :class="{ 'is-active': tab.path === activePath }"
        type="button"
        tabindex="-1"
        :data-route-tab-path="tab.path"
      >
        <span class="app-route-tab__dot" />
        <span class="app-route-tab__text">{{ tabTitle(tab) }}</span>
        <span v-if="tab.closable" class="app-route-tab__close">
          <el-icon><Close /></el-icon>
        </span>
      </button>
      <span ref="badgeMirrorRef" class="app-route-tabs__overflow-badge">+99</span>
      <span ref="moreMirrorRef" class="app-route-tab app-route-tab--more">
        <span class="app-route-tab__text">⋯ {{ t('common.more') }}</span>
      </span>
    </div>

    <!-- Fixed right-side action buttons -->
    <div class="app-route-tabs__actions">
      <button class="app-route-tabs__icon" type="button" :aria-label="t('common.refreshCurrent')" @click="refreshCurrent">
        <el-icon><RefreshRight /></el-icon>
      </button>
      <el-dropdown trigger="click" placement="bottom-end">
        <button class="app-route-tabs__icon" type="button" :aria-label="t('common.moreActions')">
          <el-icon><Close /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="closeCurrent">{{ t('common.closeCurrent') }}</el-dropdown-item>
            <el-dropdown-item @click="closeAll">{{ t('common.closeAll') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </nav>
</template>

<style scoped>
.app-route-tabs {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  margin: 0 0 12px;
}

.app-route-tabs__scroller {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  overflow: hidden;
}

/* ── Hidden measurement layer ── */
.app-route-tabs__measure {
  position: absolute !important;
  top: 0;
  right: 100%;
  left: auto;
  display: inline-flex;
  gap: 8px;
  visibility: hidden !important;
  pointer-events: none !important;
  z-index: -1 !important;
  white-space: nowrap;
}

/* ── Tab button ── */
.app-route-tab {
  display: inline-flex;
  width: 128px;
  max-width: 128px;
  height: 28px;
  flex: 0 0 128px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  position: relative;
  color: var(--color-text-secondary);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  line-height: 28px;
  user-select: none;
  touch-action: none;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    opacity 120ms ease,
    transform 190ms cubic-bezier(.2,.8,.2,1);
}

.app-route-tab:hover {
  color: var(--color-primary-500);
  border-color: color-mix(in srgb, var(--color-primary-500) 38%, var(--color-border-default));
}

.app-route-tab.is-active {
  color: var(--color-primary-500);
  background: color-mix(in srgb, var(--color-primary-500) 10%, var(--color-bg-surface));
  border-color: color-mix(in srgb, var(--color-primary-500) 34%, var(--color-border-default));
  box-shadow: 0 4px 10px rgb(37 99 235 / 8%);
}

.app-route-tab.is-dragging {
  z-index: 4;
  opacity: .96;
  box-shadow: 0 10px 24px rgb(15 23 42 / 18%);
  cursor: grabbing;
  transition: box-shadow 120ms ease;
}

.app-route-tab.is-sorting:not(.is-dragging) {
  pointer-events: none;
}

.app-route-tab--more {
  width: auto;
  flex-basis: auto;
  gap: 4px;
  padding: 0 10px;
  color: var(--color-text-secondary);
  background: var(--color-bg-muted);
  border-color: transparent;
}

.app-route-tab--more:hover {
  color: var(--color-primary-500);
  background: var(--color-bg-surface);
  border-color: var(--color-border-default);
}

/* ── Tab dot ── */
.app-route-tab__dot {
  display: none;
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-primary-500);
}

.app-route-tab.is-active .app-route-tab__dot {
  display: block;
}

.app-route-tab__text {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-route-tab__close {
  display: grid;
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--color-text-disabled);
  border-radius: 50%;
  font-size: 12px;
}

.app-route-tab__close:hover {
  color: var(--color-primary-500);
  background: color-mix(in srgb, var(--color-primary-500) 12%, transparent);
}

/* ── +N overflow badge ── */
.app-route-tabs__overflow-badge {
  display: inline-flex;
  min-width: 24px;
  height: 22px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  color: var(--color-white);
  background: var(--color-primary-500);
  border-radius: 11px;
  box-shadow: 0 6px 14px color-mix(in srgb, var(--color-primary-500) 22%, transparent);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

/* ── Action buttons ── */
.app-route-tabs__actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.app-route-tabs__icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.app-route-tabs__icon:hover {
  color: var(--color-primary-500);
  background: var(--color-bg-surface);
}

/* ── Overflow dropdown items ── */
.app-route-tabs__overflow-item {
  display: inline-flex;
  width: 100%;
  align-items: center;
  gap: 8px;
}

.app-route-tabs__overflow-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-route-tabs__overflow-close {
  display: grid;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  place-items: center;
  padding: 0;
  color: var(--color-text-disabled);
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.app-route-tabs__overflow-close:hover {
  color: var(--color-primary-500);
  background: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
}

:deep(.app-route-tabs__overflow-menu) {
  max-height: 320px;
  overflow-y: auto;
}

:deep(.app-route-tabs__overflow-menu .el-dropdown-menu__item.is-active) {
  color: var(--color-primary-500);
  background: color-mix(in srgb, var(--color-primary-500) 8%, transparent);
}

/* ── Responsive ── */
@media (max-width: 760px) {
  .app-route-tabs {
    align-items: stretch;
    flex-direction: column;
  }

  .app-route-tabs__actions {
    justify-content: flex-end;
  }
}
</style>
