<script setup lang="ts">
import {
  Aim,
  FullScreen,
  Minus,
  Plus,
  Refresh,
  Van,
} from '@element-plus/icons-vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import parkingPlan from '@/assets/images/car/car-display.webp';
import parkingPlan768 from '@/assets/images/car/car-display-768.webp';
import parkingPlan1152 from '@/assets/images/car/car-display-1152.webp';
import DsResponsiveImage from '@/design-system/components/DsResponsiveImage.vue';
import { useAuthStore } from '@/core/auth/auth.store';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import {
  buildParkingRuntime,
  PARKING_BAY_LAYOUT,
  PARKING_MAP_HEIGHT,
  PARKING_MAP_WIDTH,
  PARKING_ZONES,
  parkingMonitoringApi,
  type ParkingMonitoringResponse,
  type ParkingZone,
  type SimulatedSpaceStatus,
} from '@/domain/iot/parking-monitoring';

const { t, locale } = useI18n();
const authStore = useAuthStore();
const canView = computed(() => authStore.can('platform:parking:monitoring:view'));
const loading = ref(true);
const error = ref('');
const data = ref<ParkingMonitoringResponse>();
const runtimeTick = ref(new Date());
const mapShell = ref<HTMLElement>();
const mapViewport = ref<HTMLElement>();
const scale = ref(1);
const fitScale = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
const dragging = ref(false);
const selectedZones = ref<ParkingZone[]>(['A', 'B', 'C', 'D']);
const selectedStatuses = ref<SimulatedSpaceStatus[]>([
  'AVAILABLE', 'OCCUPIED', 'RESERVED', 'CHARGING', 'FAULT', 'ACCESSIBLE',
]);
let runtimeTimer: number | undefined;
let requestPending = false;
let resizeObserver: ResizeObserver | undefined;
let dragPointerId: number | undefined;
let dragStartX = 0;
let dragStartY = 0;
let dragOriginX = 0;
let dragOriginY = 0;

const selectedSystem = computed(() => data.value?.systems[0]);
const configuredSpaces = computed(() => selectedSystem.value?.configuredParkingSpaceCount || 0);
const monitoredSpaces = computed(() => configuredSpaces.value || PARKING_BAY_LAYOUT.length);
const assets = computed(() => selectedSystem.value?.assets || []);
const activeAssets = computed(() => assets.value.filter(asset => asset.status === 'ACTIVE').length);
const activeAlarms = computed(() => data.value?.summary.activeAlarmCount || 0);
const runtime = computed(() => buildParkingRuntime(
  selectedSystem.value?.code || 'PARKING', monitoredSpaces.value, assets.value, runtimeTick.value,
));
const mapTransform = computed(() => ({
  width: `${PARKING_MAP_WIDTH}px`,
  height: `${PARKING_MAP_HEIGHT}px`,
  transform: `translate3d(${offsetX.value}px, ${offsetY.value}px, 0) scale(${scale.value})`,
}));
const scaleLabel = computed(() => `${Math.round(scale.value * 100)}%`);
const allZonesSelected = computed({
  get: () => selectedZones.value.length === PARKING_ZONES.length,
  set: (checked: boolean) => { selectedZones.value = checked ? PARKING_ZONES.map(zone => zone.code) : []; },
});
const visibleSpaces = computed(() => runtime.value.sampleSpaces.filter(space =>
  selectedZones.value.includes(space.zone) && selectedStatuses.value.includes(space.status),
));
const zoneSummaries = computed(() => PARKING_ZONES.map(zone => {
  const spaces = runtime.value.sampleSpaces.filter(space => space.zone === zone.code);
  return {
    ...zone,
    total: spaces.length,
    available: spaces.filter(space => space.status === 'AVAILABLE').length,
    visible: selectedZones.value.includes(zone.code),
  };
}));
const topMetrics = computed(() => [
  {
    key: 'total',
    label: t(configuredSpaces.value ? 'parkingMonitoring.kpi.total' : 'parkingMonitoring.kpi.illustrativeTotal'),
    value: monitoredSpaces.value,
    tone: '',
  },
  { key: 'available', label: t('parkingMonitoring.kpi.available'), value: runtime.value.available, tone: 'success' },
  { key: 'occupied', label: t('parkingMonitoring.kpi.occupied'), value: runtime.value.occupied, tone: '' },
  { key: 'reserved', label: t('parkingMonitoring.kpi.reserved'), value: runtime.value.reserved, tone: 'reserved' },
  { key: 'fault', label: t('parkingMonitoring.kpi.fault'), value: runtime.value.fault, tone: 'danger' },
  { key: 'rate', label: t('parkingMonitoring.kpi.utilization'), value: `${runtime.value.occupancyRate}%`, tone: '' },
]);
const statusOptions: SimulatedSpaceStatus[] = [
  'AVAILABLE', 'OCCUPIED', 'RESERVED', 'CHARGING', 'FAULT', 'ACCESSIBLE',
];

function formatTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat(locale.value === 'en-US' ? 'en-US' : 'zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function translatedStatus(status: SimulatedSpaceStatus) {
  return t(`parkingMonitoring.status.${status}`);
}

function resetFilters() {
  selectedZones.value = ['A', 'B', 'C', 'D'];
  selectedStatuses.value = [...statusOptions];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampPosition() {
  const viewport = mapViewport.value;
  if (!viewport) return;
  const visibleEdge = 72;
  const canvasWidth = PARKING_MAP_WIDTH * scale.value;
  const canvasHeight = PARKING_MAP_HEIGHT * scale.value;
  offsetX.value = clamp(offsetX.value, visibleEdge - canvasWidth, viewport.clientWidth - visibleEdge);
  offsetY.value = clamp(offsetY.value, visibleEdge - canvasHeight, viewport.clientHeight - visibleEdge);
}

function fitMap() {
  const viewport = mapViewport.value;
  if (!viewport?.clientWidth || !viewport.clientHeight) return;
  const padding = 24;
  fitScale.value = Math.min(
    (viewport.clientWidth - padding * 2) / PARKING_MAP_WIDTH,
    (viewport.clientHeight - padding * 2) / PARKING_MAP_HEIGHT,
  );
  scale.value = fitScale.value;
  offsetX.value = (viewport.clientWidth - PARKING_MAP_WIDTH * scale.value) / 2;
  offsetY.value = (viewport.clientHeight - PARKING_MAP_HEIGHT * scale.value) / 2;
}

function zoomAt(targetScale: number, anchorX?: number, anchorY?: number) {
  const viewport = mapViewport.value;
  if (!viewport) return;
  const nextScale = clamp(targetScale, Math.max(.22, fitScale.value * .72), 2.4);
  const x = anchorX ?? viewport.clientWidth / 2;
  const y = anchorY ?? viewport.clientHeight / 2;
  const ratio = nextScale / scale.value;
  offsetX.value = x - (x - offsetX.value) * ratio;
  offsetY.value = y - (y - offsetY.value) * ratio;
  scale.value = nextScale;
  clampPosition();
}

function onWheel(event: WheelEvent) {
  event.preventDefault();
  const rect = mapViewport.value?.getBoundingClientRect();
  if (!rect) return;
  zoomAt(scale.value * Math.exp(-event.deltaY * .00135), event.clientX - rect.left, event.clientY - rect.top);
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  dragging.value = true;
  dragPointerId = event.pointerId;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  dragOriginX = offsetX.value;
  dragOriginY = offsetY.value;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== dragPointerId) return;
  offsetX.value = dragOriginX + event.clientX - dragStartX;
  offsetY.value = dragOriginY + event.clientY - dragStartY;
}

function onPointerUp(event: PointerEvent) {
  if (event.pointerId !== dragPointerId) return;
  dragging.value = false;
  dragPointerId = undefined;
  clampPosition();
}

async function toggleFullscreen() {
  if (!mapShell.value) return;
  if (document.fullscreenElement) await document.exitFullscreen();
  else await mapShell.value.requestFullscreen();
  await nextTick();
  window.setTimeout(fitMap, 80);
}

async function load() {
  if (!canView.value || requestPending) return;
  requestPending = true;
  loading.value = true;
  error.value = '';
  try {
    data.value = await parkingMonitoringApi.get();
    runtimeTick.value = new Date();
    await nextTick();
    fitMap();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('parkingMonitoring.messages.loadFailed');
  } finally {
    requestPending = false;
    loading.value = false;
  }
}

watch(canView, value => { if (value && !data.value) void load(); });

onMounted(() => {
  if (canView.value) void load();
  runtimeTimer = window.setInterval(() => { runtimeTick.value = new Date(); }, 60_000);
  resizeObserver = new ResizeObserver(() => fitMap());
  if (mapViewport.value) resizeObserver.observe(mapViewport.value);
});

onBeforeUnmount(() => {
  if (runtimeTimer) window.clearInterval(runtimeTimer);
  resizeObserver?.disconnect();
});
</script>

<template>
  <section class="parking-monitoring-page">
    <DsEmpty v-if="!canView" class="parking-state" :description="t('parkingMonitoring.permissionDenied')" />

    <template v-else>
      <header class="parking-header">
        <div class="parking-header__identity">
          <div>
            <h1>{{ t('parkingMonitoring.title') }}</h1>
            <p>{{ selectedSystem?.name || t('parkingMonitoring.messages.loadingSystem') }}</p>
          </div>
        </div>
        <div class="parking-header__actions">
          <span>{{ t('parkingMonitoring.runtime.updatedAt') }} {{ formatTime(runtime.updatedAt) }}</span>
          <el-button :icon="Refresh" :loading="loading" @click="load">{{ t('parkingMonitoring.actions.refresh') }}</el-button>
        </div>
      </header>

      <el-alert v-if="error" class="parking-alert" type="error" :closable="false" show-icon>
        <template #title>{{ t('parkingMonitoring.messages.loadFailed') }}</template>
        <el-button link type="primary" @click="load">{{ t('parkingMonitoring.actions.retry') }}</el-button>
      </el-alert>

      <el-skeleton v-if="loading && !data" class="parking-state" :rows="8" animated />
      <DsEmpty v-else-if="!data?.systems.length && !error" class="parking-state" :description="t('parkingMonitoring.messages.empty')" />

      <template v-else-if="data && selectedSystem">
        <section class="parking-metrics" :aria-label="t('parkingMonitoring.kpi.summary')">
          <article v-for="metric in topMetrics" :key="metric.key">
            <span>{{ metric.label }}</span>
            <strong :class="metric.tone ? `is-${metric.tone}` : ''">{{ metric.value }}</strong>
          </article>
        </section>

        <section class="parking-workspace">
          <aside class="filter-panel">
            <section>
              <h2>{{ t('parkingMonitoring.filters.floor') }}</h2>
              <button class="floor-button is-active" type="button"><span>B1</span><small>{{ t('parkingMonitoring.filters.current') }}</small></button>
              <button class="floor-button" type="button" disabled><span>B2</span><small>{{ t('parkingMonitoring.filters.notConfigured') }}</small></button>
              <button class="floor-button" type="button" disabled><span>B3</span><small>{{ t('parkingMonitoring.filters.notConfigured') }}</small></button>
            </section>

            <section>
              <h2>{{ t('parkingMonitoring.filters.zone') }}</h2>
              <el-checkbox v-model="allZonesSelected">{{ t('parkingMonitoring.filters.allZones') }}</el-checkbox>
              <el-checkbox-group v-model="selectedZones">
                <el-checkbox v-for="zone in PARKING_ZONES" :key="zone.code" :label="zone.code">{{ zone.code }}{{ t('parkingMonitoring.filters.zoneSuffix') }}</el-checkbox>
              </el-checkbox-group>
            </section>

            <section class="status-filter">
              <h2>{{ t('parkingMonitoring.filters.status') }}</h2>
              <el-checkbox-group v-model="selectedStatuses">
                <el-checkbox v-for="status in statusOptions" :key="status" :label="status">
                  <i class="status-swatch" :class="`is-${status.toLowerCase()}`" />
                  {{ translatedStatus(status) }}
                </el-checkbox>
              </el-checkbox-group>
            </section>

            <section class="system-facts">
              <div><span>{{ t('parkingMonitoring.kpi.configuredLanes') }}</span><strong>{{ selectedSystem.configuredLaneCount }}</strong></div>
              <div><span>{{ t('parkingMonitoring.kpi.activeDevices') }}</span><strong>{{ activeAssets }}</strong></div>
              <div><span>{{ t('parkingMonitoring.kpi.activeAlarms') }}</span><strong :class="{ 'is-danger': activeAlarms }">{{ activeAlarms }}</strong></div>
            </section>

            <el-button class="reset-filter" :icon="Refresh" @click="resetFilters">{{ t('parkingMonitoring.filters.reset') }}</el-button>
          </aside>

          <main ref="mapShell" class="map-shell">
            <div class="map-heading">
              <div>
                <h2>{{ selectedSystem.name }} · B1</h2>
                <p>{{ selectedSystem.serviceScopeSummary || t('parkingMonitoring.system.notConfigured') }}</p>
              </div>
            </div>

            <div
              ref="mapViewport"
              class="map-viewport"
              :class="{ 'is-dragging': dragging }"
              @wheel="onWheel"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="onPointerUp"
            >
              <div class="map-canvas" :style="mapTransform">
                <DsResponsiveImage
                  class="map-plan"
                  :src="parkingPlan"
                  :srcset="`${parkingPlan768} 768w, ${parkingPlan1152} 1152w, ${parkingPlan} 1536w`"
                  sizes="(max-width: 1280px) 768px, (max-width: 1920px) 1152px, 1536px"
                  :alt="t('parkingMonitoring.map.planAlt')"
                  fallback-text="停车场平面图加载失败"
                  loading="lazy"
                  fetchpriority="low"
                  draggable="false"
                />

                <el-tooltip
                  v-for="space in visibleSpaces"
                  :key="space.id"
                  :content="`${space.label} · ${translatedStatus(space.status)}`"
                  :show-after="280"
                >
                  <span
                    class="parking-bay"
                    :class="`is-${space.status.toLowerCase()}`"
                    :style="{ left: `${space.x}px`, top: `${space.y}px`, width: `${space.width}px`, height: `${space.height}px` }"
                  />
                </el-tooltip>

                <div
                  v-for="zone in zoneSummaries"
                  v-show="zone.visible"
                  :key="zone.code"
                  class="zone-badge"
                  :style="{ left: `${zone.x}px`, top: `${zone.y}px` }"
                >
                  <strong>{{ zone.code }}{{ t('parkingMonitoring.filters.zoneSuffix') }}</strong>
                  <span>{{ t('parkingMonitoring.map.zoneAvailable', { count: zone.available }) }}</span>
                </div>

                <article class="lane-card is-entry">
                  <el-icon><Van /></el-icon>
                  <div><strong>{{ t('parkingMonitoring.map.entry') }}</strong><span>{{ t('parkingMonitoring.map.todayEntries', { count: runtime.todayEntries }) }}</span><small><i />{{ t('parkingMonitoring.map.normal') }}</small></div>
                </article>
                <article class="lane-card is-exit">
                  <el-icon><Van /></el-icon>
                  <div><strong>{{ t('parkingMonitoring.map.exit') }}</strong><span>{{ t('parkingMonitoring.map.todayExits', { count: runtime.todayExits }) }}</span><small><i />{{ t('parkingMonitoring.map.normal') }}</small></div>
                </article>
              </div>

              <div class="map-legend">
                <span v-for="status in statusOptions" :key="status"><i class="status-swatch" :class="`is-${status.toLowerCase()}`" />{{ translatedStatus(status) }}</span>
              </div>

              <div class="map-tools" @pointerdown.stop>
                <el-tooltip :content="t('parkingMonitoring.map.zoomIn')" placement="left"><button type="button" :aria-label="t('parkingMonitoring.map.zoomIn')" :title="t('parkingMonitoring.map.zoomIn')" @click="zoomAt(scale * 1.18)"><el-icon><Plus /></el-icon></button></el-tooltip>
                <el-tooltip :content="t('parkingMonitoring.map.zoomOut')" placement="left"><button type="button" :aria-label="t('parkingMonitoring.map.zoomOut')" :title="t('parkingMonitoring.map.zoomOut')" @click="zoomAt(scale / 1.18)"><el-icon><Minus /></el-icon></button></el-tooltip>
                <span>{{ scaleLabel }}</span>
                <el-tooltip :content="t('parkingMonitoring.map.fit')" placement="left"><button type="button" :aria-label="t('parkingMonitoring.map.fit')" :title="t('parkingMonitoring.map.fit')" @click="fitMap"><el-icon><Aim /></el-icon></button></el-tooltip>
                <el-tooltip :content="t('parkingMonitoring.map.fullscreen')" placement="left"><button type="button" :aria-label="t('parkingMonitoring.map.fullscreen')" :title="t('parkingMonitoring.map.fullscreen')" @click="toggleFullscreen"><el-icon><FullScreen /></el-icon></button></el-tooltip>
              </div>

            </div>
          </main>
        </section>
      </template>
    </template>
  </section>
</template>

<style scoped>
.parking-monitoring-page {
  --parking-gap: clamp(8px, .75cqw, 12px);
  width: 100%;
  height: calc(100dvh - 126px);
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  container: parking-monitor / inline-size;
  color: var(--el-text-color-primary);
}
.parking-header { display: flex; min-height: 54px; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 18px; padding: 2px 0 8px; border-bottom: 1px solid var(--el-border-color-extra-light); }
.parking-header__identity, .parking-header__actions { display: flex; min-width: 0; align-items: center; gap: 8px; }
.parking-header__identity > div { min-width: 0; margin-right: 4px; }
.parking-header h1 { margin: 0; font-size: 20px; line-height: 25px; }
.parking-header p { max-width: 340px; margin: 2px 0 0; overflow: hidden; color: var(--el-text-color-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.parking-header__actions > span { color: var(--el-text-color-secondary); font-size: 11px; white-space: nowrap; }
.parking-alert { margin-top: var(--parking-gap); }
.parking-state { min-height: 400px; margin-top: var(--parking-gap); border: 1px solid var(--el-border-color-light); border-radius: 12px; background: var(--el-bg-color); }
.parking-metrics { display: grid; flex: 0 0 auto; grid-template-columns: repeat(6, minmax(0, 1fr)); margin-top: var(--parking-gap); overflow: hidden; border: 1px solid var(--el-border-color-light); border-radius: 11px; background: var(--el-bg-color); box-shadow: 0 4px 16px color-mix(in srgb, var(--el-color-primary) 3%, transparent); }
.parking-metrics article { display: flex; min-width: 0; height: 58px; align-items: center; justify-content: center; gap: clamp(7px, 1cqw, 16px); padding: 0 12px; border-right: 1px solid var(--el-border-color-extra-light); }
.parking-metrics article:last-child { border-right: 0; }
.parking-metrics span { overflow: hidden; color: var(--el-text-color-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.parking-metrics strong { font-size: 20px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.parking-metrics strong.is-success { color: var(--el-color-success); }
.parking-metrics strong.is-reserved { color: #8258dc; }
.parking-metrics strong.is-danger { color: var(--el-color-danger); }
.parking-workspace { display: grid; min-width: 0; min-height: 0; flex: 1 1 auto; grid-template-columns: clamp(158px, 12.5cqw, 188px) minmax(0, 1fr); gap: var(--parking-gap); margin-top: var(--parking-gap); overflow: hidden; }
.filter-panel, .map-shell { min-width: 0; min-height: 0; overflow: hidden; border: 1px solid var(--el-border-color-light); border-radius: 11px; background: var(--el-bg-color); box-shadow: 0 4px 16px color-mix(in srgb, var(--el-color-primary) 3%, transparent); }
.filter-panel { display: flex; height: 100%; flex-direction: column; overflow-y: auto; scrollbar-color: color-mix(in srgb, var(--el-color-primary) 55%, transparent) transparent; scrollbar-width: thin; }
.filter-panel > section { padding: 10px 12px; border-bottom: 1px solid var(--el-border-color-extra-light); }
.filter-panel h2 { margin: 0 0 7px; font-size: 12px; line-height: 18px; }
.floor-button { display: flex; width: 100%; height: 30px; align-items: center; justify-content: space-between; margin: 2px 0; padding: 0 9px; border: 0; border-radius: 6px; color: var(--el-text-color-secondary); background: transparent; font-size: 12px; text-align: left; }
.floor-button.is-active { color: var(--el-color-primary); background: var(--el-color-primary-light-9); cursor: pointer; }
.floor-button small { color: var(--el-text-color-placeholder); font-size: 9px; }
.filter-panel :deep(.el-checkbox) { display: flex; height: 26px; margin-right: 0; align-items: center; }
.filter-panel :deep(.el-checkbox__label) { display: inline-flex; align-items: center; gap: 7px; padding-left: 7px; font-size: 11px; }
.filter-panel :deep(.el-checkbox-group) { display: grid; }
.status-swatch { display: inline-block; width: 17px; height: 10px; flex: 0 0 auto; border: 1px solid; border-radius: 2px; background: transparent; }
.status-swatch.is-available, .parking-bay.is-available { border-color: #78a965; background: color-mix(in srgb, #8ec37a 25%, transparent); }
.status-swatch.is-occupied, .parking-bay.is-occupied { border-color: #82a6d5; background: color-mix(in srgb, #8facd2 26%, transparent); }
.status-swatch.is-reserved, .parking-bay.is-reserved { border-color: #a989e7; background: color-mix(in srgb, #aa8de2 28%, transparent); }
.status-swatch.is-charging, .parking-bay.is-charging { border-color: #2ab7cf; background: color-mix(in srgb, #2bc4dc 26%, transparent); }
.status-swatch.is-fault, .parking-bay.is-fault { border-color: #ef8b34; background: color-mix(in srgb, #f19a48 18%, transparent); }
.status-swatch.is-accessible { border-color: var(--el-border-color); background: repeating-linear-gradient(135deg, transparent 0 3px, var(--el-border-color) 3px 4px); }
.parking-bay.is-accessible { border-color: #aeb5c0; background: repeating-linear-gradient(135deg, rgba(255,255,255,.28) 0 4px, rgba(151,160,174,.32) 4px 6px); }
.system-facts { display: grid; gap: 6px; margin-top: auto; }
.system-facts div { display: flex; align-items: center; justify-content: space-between; color: var(--el-text-color-secondary); font-size: 10px; }
.system-facts strong { color: var(--el-text-color-primary); font-size: 12px; }
.system-facts strong.is-danger { color: var(--el-color-danger); }
.reset-filter { width: calc(100% - 24px); margin: 10px 12px 12px; flex: 0 0 auto; }
.map-shell { display: flex; height: 100%; flex-direction: column; }
.map-shell:fullscreen { width: 100vw; height: 100vh; border: 0; border-radius: 0; background: var(--el-bg-color-page); }
.map-heading { display: flex; min-height: 48px; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 12px; border-bottom: 1px solid var(--el-border-color-extra-light); }
.map-heading h2 { margin: 0; font-size: 13px; line-height: 18px; }
.map-heading p { max-width: 600px; margin: 2px 0 0; overflow: hidden; color: var(--el-text-color-secondary); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.map-heading > span { display: inline-flex; align-items: center; gap: 5px; color: var(--el-text-color-secondary); font-size: 10px; white-space: nowrap; }
.map-viewport { position: relative; min-width: 0; min-height: 0; flex: 1 1 auto; overflow: hidden; touch-action: none; user-select: none; background: color-mix(in srgb, var(--el-bg-color-page) 70%, var(--el-bg-color)); cursor: grab; }
.map-viewport.is-dragging { cursor: grabbing; }
.map-canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; will-change: transform; }
.map-plan { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; pointer-events: none; filter: contrast(1.03) brightness(1.01); }
.map-plan.ds-responsive-image--fallback { filter: none; }
.parking-bay { position: absolute; z-index: 2; box-sizing: border-box; border-width: 1.5px; border-style: solid; border-radius: 2px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.38); pointer-events: auto; transition: opacity .14s ease, filter .14s ease; }
.parking-bay:hover { z-index: 3; filter: saturate(1.35) brightness(.94); }
.zone-badge { position: absolute; z-index: 4; display: flex; min-width: 104px; height: 36px; align-items: center; gap: 8px; padding: 0 11px; border: 1px solid rgba(104,116,135,.3); border-radius: 8px; background: rgba(255,255,255,.9); box-shadow: 0 4px 12px rgba(33,43,54,.13); backdrop-filter: blur(5px); }
.zone-badge strong { font-size: 13px; }
.zone-badge span { color: #1aa367; font-size: 11px; white-space: nowrap; }
.lane-card { position: absolute; z-index: 4; display: grid; width: 116px; min-height: 72px; grid-template-columns: 25px 1fr; gap: 7px; padding: 10px; border: 1px solid rgba(54,108,207,.25); border-radius: 9px; background: rgba(255,255,255,.92); box-shadow: 0 5px 14px rgba(31,44,62,.14); backdrop-filter: blur(6px); }
.lane-card > .el-icon { margin-top: 1px; color: var(--el-color-primary); font-size: 20px; }
.lane-card strong, .lane-card span, .lane-card small { display: block; white-space: nowrap; }
.lane-card strong { font-size: 12px; }
.lane-card span { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 9px; }
.lane-card small { margin-top: 4px; color: #1aa367; font-size: 9px; }
.lane-card small i { display: inline-block; width: 6px; height: 6px; margin-right: 4px; border-radius: 50%; background: currentColor; }
.lane-card.is-entry { top: 188px; right: 30px; }
.lane-card.is-exit { right: 27px; bottom: 120px; }
.map-legend { position: absolute; z-index: 8; bottom: 12px; left: 12px; display: flex; max-width: calc(100% - 86px); align-items: center; flex-wrap: wrap; gap: 11px; padding: 8px 12px; border: 1px solid var(--el-border-color-light); border-radius: 8px; color: var(--el-text-color-secondary); background: color-mix(in srgb, var(--el-bg-color) 92%, transparent); box-shadow: 0 4px 14px rgba(20,35,55,.1); font-size: 10px; backdrop-filter: blur(8px); }
.map-legend span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.map-legend .status-swatch { width: 16px; height: 9px; }
.map-tools { position: absolute; z-index: 9; right: 12px; bottom: 12px; display: grid; width: 38px; overflow: hidden; border: 1px solid var(--el-border-color-light); border-radius: 8px; background: var(--el-bg-color); box-shadow: 0 4px 15px rgba(20,35,55,.13); }
.map-tools button { display: grid; width: 38px; height: 35px; place-items: center; border: 0; border-bottom: 1px solid var(--el-border-color-extra-light); color: var(--el-text-color-primary); background: transparent; cursor: pointer; }
.map-tools button:hover { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.map-tools > span { height: 23px; border-bottom: 1px solid var(--el-border-color-extra-light); color: var(--el-text-color-secondary); font-size: 9px; line-height: 23px; text-align: center; }
:global(html[data-theme='dark']) .map-plan { opacity: .72; filter: invert(.89) hue-rotate(180deg) saturate(.55) contrast(.95); }
:global(html[data-theme='dark']) .zone-badge,
:global(html[data-theme='dark']) .lane-card { background: rgba(29,34,43,.9); }

@container parking-monitor (max-width: 1180px) {
  .parking-workspace { grid-template-columns: 154px minmax(0, 1fr); }
  .parking-metrics article { gap: 6px; padding: 0 7px; }
  .parking-metrics span { font-size: 10px; }
  .parking-metrics strong { font-size: 17px; }
  .map-heading > span { display: none; }
}
@media (max-height: 760px) {
  .parking-header { min-height: 46px; }
  .parking-header h1 { font-size: 18px; }
  .parking-header p { display: none; }
  .parking-metrics article { height: 48px; }
  .filter-panel > section { padding-top: 7px; padding-bottom: 7px; }
  .filter-panel :deep(.el-checkbox) { height: 23px; }
  .system-facts { display: none; }
  .map-heading { min-height: 42px; }
}
</style>
