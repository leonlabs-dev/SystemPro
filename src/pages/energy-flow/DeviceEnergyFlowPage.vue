<script setup lang="ts">
import {
  CircleCheck,
  Connection,
  DataAnalysis,
  Lightning,
  Link,
  Location,
  Monitor,
  Odometer,
  Operation,
  Refresh,
  SetUp,
  Sunny,
  TrendCharts,
} from '@element-plus/icons-vue';
import { computed, onActivated, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ApiError } from '@/core/api/contracts';
import { fetchAllPages } from '@/core/api/pagination';
import { useAuthStore } from '@/core/auth/auth.store';
import { useThemeStore } from '@/core/theme/theme.store';
import type { EChartsCoreOption } from '@/design-system/charts/echarts-runtime';
import DsChart from '@/design-system/components/DsChart.vue';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import {
  buildEnergyTrend,
  buildIntegratedEnergySnapshot,
  deviceSystemApi,
  deviceSystemPermissions,
  type DeviceSystem,
  type EnergyTrendPeriod,
} from '@/domain/iot/assets';

const { t, locale } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const solarPermissions = deviceSystemPermissions('SOLAR');
const storagePermissions = deviceSystemPermissions('STORAGE');
const canViewSolar = computed(() => authStore.can(solarPermissions.view));
const canViewStorage = computed(() => authStore.can(storagePermissions.view));
const loading = ref(true);
const loadError = ref('');
const solarSystems = ref<DeviceSystem[]>([]);
const storageSystems = ref<DeviceSystem[]>([]);
const selectedSolarId = ref('');
const trendPeriod = ref<EnergyTrendPeriod>('DAY');
const tick = ref(0);
let timer: number | undefined;

const selectedSolar = computed(() =>
  solarSystems.value.find(item => item.id === selectedSolarId.value) || solarSystems.value[0]);
const isDark = computed(() => themeStore.theme === 'dark');

const pairedStorage = computed(() => {
  const solar = selectedSolar.value;
  if (!solar) return storageSystems.value[0];
  const solarSpaceIds = new Set(solar.serviceScopes.map(scope => scope.spaceNodeId));
  return storageSystems.value.find(system =>
    system.serviceScopes.some(scope => solarSpaceIds.has(scope.spaceNodeId)))
    || storageSystems.value[0];
});

const snapshot = computed(() => {
  tick.value;
  return selectedSolar.value
    ? buildIntegratedEnergySnapshot(selectedSolar.value, pairedStorage.value)
    : null;
});

const trend = computed(() => {
  tick.value;
  return selectedSolar.value
    ? buildEnergyTrend(selectedSolar.value, pairedStorage.value, trendPeriod.value)
    : [];
});

const siteCapacity = computed(() => Number(selectedSolar.value?.profile.primaryCapacity || 0));
const storageCapacity = computed(() => Number(pairedStorage.value?.profile.secondaryCapacity || 0));
const serviceScope = computed(() =>
  selectedSolar.value?.serviceScopeSummary
  || selectedSolar.value?.installSpaceName
  || t('deviceSystemPage.overview.unassignedSpace'));
const gridImporting = computed(() => (snapshot.value?.gridPower || 0) < 0);
const storageCharging = computed(() => (snapshot.value?.storagePower || 0) < 0);
const hasStorage = computed(() => Boolean(pairedStorage.value));
const currentAssetCount = computed(() => selectedSolar.value?.assets.length || 0);
const activeAssetCount = computed(() =>
  selectedSolar.value?.assets.filter(asset => asset.status === 'ACTIVE').length || 0);
const storagePcsCount = computed(() =>
  pairedStorage.value?.assets.filter(asset => asset.subtype === 'PCS').length || 0);
const loadBranches = computed(() => {
  const total = snapshot.value?.loadPower || 0;
  return [
    {
      key: 'production',
      label: t('deviceSystemPage.overview.productionLoad'),
      power: total * 0.45,
      share: 45,
      icon: DataAnalysis,
    },
    {
      key: 'office',
      label: t('deviceSystemPage.overview.officeLoad'),
      power: total * 0.32,
      share: 32,
      icon: Monitor,
    },
    {
      key: 'other',
      label: t('deviceSystemPage.overview.otherLoad'),
      power: total * 0.23,
      share: 23,
      icon: Connection,
    },
  ];
});

function formatNumber(value: number | undefined, digits = 1) {
  return Number(value || 0).toLocaleString(locale.value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPower(value: number | undefined, signed = false) {
  const number = Number(value || 0);
  const sign = signed && number > 0 ? '+' : '';
  return `${sign}${formatNumber(number, 1)} kW`;
}

function formatEnergy(value: number | undefined, unit = 'kWh') {
  return `${formatNumber(value, 1)} ${unit}`;
}

function connector(
  name: string,
  coords: number[][],
  color: string,
  active = true,
  direction: 'one-way' | 'two-way' | 'none' = 'one-way',
  showEffect = true,
) {
  const symbol = !active
    ? ['none', 'none']
    : direction === 'two-way'
      ? ['arrow', 'arrow']
      : direction === 'one-way'
        ? ['none', 'arrow']
        : ['none', 'none'];
  return {
    name,
    type: 'lines',
    coordinateSystem: 'cartesian2d',
    z: 1,
    silent: true,
    polyline: true,
    data: [{ coords }],
    symbol,
    symbolSize: 11,
    lineStyle: {
      color,
      width: active ? 1.8 : 1.1,
      opacity: active ? 1 : 0.16,
      type: active ? 'solid' : 'dashed',
      cap: 'round',
      join: 'round',
    },
    effect: active && showEffect
      ? { show: true, constantSpeed: 28, trailLength: 0, symbol: 'arrow', symbolSize: 6, color, period: 4 }
      : { show: false },
  };
}

const flowOption = computed<EChartsCoreOption>(() => {
  const current = snapshot.value;
  if (!current) return {};
  const pvActive = current.pvPower > 0.05;
  // Stage height 350px. Node height 60px = 17.1%. echarts y is math convention
  // (0=bottom, 100=top); DOM-top% maps to echarts y = 100 - domTop%.
  //
  // DOM layout (top%/left%/width%/height in px@350px stage):
  //   PV       top:4%  h:60px w:14% left:43%   -> DOM bottom 21.1%, echarts y=78.9 (PV底)
  //   Bus      top:36% h:60px w:14% left:43%   -> DOM top 36%,    echarts y=64   (Bus顶)
  //                                              DOM bottom 53.1%, echarts y=46.9 (Bus底)
  //   Grid     left:5% top:36% w:14%           -> right edge x=19, center y=55.45
  //   Storage  right:5% top:36% w:14%          -> left edge x=81,  center y=55.45
  //   Bus left/right edges: x=43 / x=57 ; Bus center x=50
  //   Load     bottom:4% h:58px (16.6%)        -> DOM top 79.4%, echarts y=20.6 (Load顶)
  //     production left:15% w:14% -> center x=22
  //     office    left:43% w:14%  -> center x=50
  //     other     right:15% w:14% -> center x=78
  //
  // Effect flow direction follows current operating state:
  //   gridImporting=true  -> Grid -> Bus ; false -> Bus -> Grid
  //   storageCharging=true -> Bus -> Storage ; false -> Storage -> Bus
  // Arrows are two-way visually (per design), effect shows actual flow direction.
  const gridCoords = gridImporting.value
    ? [[19, 55.45], [43, 55.45]]
    : [[43, 55.45], [19, 55.45]];
  const storageCoords = storageCharging.value
    ? [[57, 55.45], [81, 55.45]]
    : [[81, 55.45], [57, 55.45]];
  return {
    animation: false,
    animationDurationUpdate: 0,
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    xAxis: { type: 'value', min: 0, max: 100, show: false },
    yAxis: { type: 'value', min: 0, max: 100, show: false },
    series: [
      // PV -> Bus (straight down, with effect)
      connector('pv-array', [[50, 78.9], [50, 64]], '#f5a623', pvActive, 'one-way', true),
      // Grid <-> Bus (two-way arrows, effect follows current direction)
      connector('grid', gridCoords, '#3478f6', Math.abs(current.gridPower) > 0.05, 'two-way', true),
      // Bus <-> Storage (two-way arrows, effect follows current direction)
      connector('storage', storageCoords, '#19a868', Math.abs(current.storagePower) > 0.05, 'two-way', true),
      // Bus -> Office load (single straight line from Bus bottom to Office top, with effect)
      connector('office-load', [[50, 46.9], [50, 20.6]], '#3478f6', current.loadPower > 0.05, 'one-way', true),
      // Branch -> Production load (left bend from trunk at y=35, with effect)
      connector('production-load', [[50, 35], [22, 35], [22, 20.6]], '#3478f6', current.loadPower > 0.05, 'one-way', true),
      // Branch -> Other load (right bend from trunk at y=35, with effect)
      connector('other-load', [[50, 35], [78, 35], [78, 20.6]], '#3478f6', current.loadPower > 0.05, 'one-way', true),
    ],
  };
});

const trendOption = computed<EChartsCoreOption>(() => {
  const points = trend.value;
  const axisUnit = trendPeriod.value === 'DAY' ? 'kW' : 'kWh';
  const textColor = isDark.value ? '#aebbd2' : '#667085';
  const axisColor = isDark.value ? '#53627a' : '#aab4c5';
  const splitColor = isDark.value ? '#25334b' : '#edf1f7';
  const series = [
    { key: 'pvPower', name: t('deviceSystemPage.overview.pvPower'), color: '#e6b400' },
    { key: 'loadPower', name: t('deviceSystemPage.overview.loadPower'), color: '#ff7a1a' },
    { key: 'storagePower', name: t('deviceSystemPage.overview.storagePower'), color: '#18a968' },
    { key: 'gridPower', name: t('deviceSystemPage.overview.gridPower'), color: '#23b7cf' },
  ] as const;
  const areaColor = (key: typeof series[number]['key']) => {
    if (key === 'loadPower') {
      return {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(255, 122, 26, .30)' },
          { offset: .62, color: 'rgba(255, 122, 26, .10)' },
          { offset: 1, color: 'rgba(255, 122, 26, .02)' },
        ],
      };
    }
    if (key === 'gridPower') {
      return {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(35, 183, 207, .02)' },
          { offset: .42, color: 'rgba(35, 183, 207, .12)' },
          { offset: 1, color: 'rgba(35, 183, 207, .34)' },
        ],
      };
    }
    if (key === 'pvPower') {
      return {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(230, 180, 0, .18)' },
          { offset: 1, color: 'rgba(230, 180, 0, 0)' },
        ],
      };
    }
    return {
      type: 'linear',
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: 'rgba(24, 169, 104, .10)' },
        { offset: 1, color: 'rgba(24, 169, 104, .02)' },
      ],
    };
  };
  return {
    animationDuration: 520,
    color: series.map(item => item.color),
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(19, 33, 55, .92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      valueFormatter: (value: unknown) => `${formatNumber(Number(value), 1)} ${axisUnit}`,
    },
    legend: {
      top: 2,
      left: 'center',
      icon: 'roundRect',
      itemWidth: 18,
      itemHeight: 3,
      itemGap: 24,
      textStyle: { color: textColor, fontSize: 11, padding: [0, 0, 0, 3] },
    },
    grid: { left: 54, right: 24, top: 44, bottom: 34, containLabel: false },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map(item => item.label),
      axisLine: { lineStyle: { color: axisColor } },
      axisTick: { show: false },
      axisLabel: {
        color: textColor,
        fontSize: 10,
        interval: trendPeriod.value === 'DAY' ? 11 : 'auto',
      },
    },
    yAxis: {
      type: 'value',
      name: axisUnit,
      nameTextStyle: { color: textColor, fontSize: 10, padding: [0, 0, 0, -20] },
      splitNumber: 6,
      splitLine: { lineStyle: { color: splitColor, width: 1 } },
      axisLabel: { color: textColor, fontSize: 10 },
    },
    series: series.map(item => ({
      name: item.name,
      type: 'line',
      data: points.map(point => point[item.key]),
      smooth: false,
      showSymbol: false,
      connectNulls: false,
      lineStyle: {
        width: item.key === 'loadPower' || item.key === 'gridPower' ? 1.65 : 1.25,
        color: item.color,
      },
      areaStyle: { color: areaColor(item.key), opacity: 1 },
      markLine: item.key === 'gridPower'
        ? { silent: true, symbol: 'none', lineStyle: { color: axisColor, width: 1.2 }, data: [{ yAxis: 0 }] }
        : undefined,
    })),
  };
});

async function load() {
  if (!canViewSolar.value) {
    solarSystems.value = [];
    storageSystems.value = [];
    selectedSolarId.value = '';
    loadError.value = t('deviceSystemPage.overview.permissionDescription');
    return;
  }
  loading.value = true;
  loadError.value = '';
  try {
    const [solar, storage] = await Promise.all([
      fetchAllPages((page, pageSize) => deviceSystemApi.page('SOLAR', { status: 'ACTIVE', page, pageSize })),
      canViewStorage.value
        ? fetchAllPages((page, pageSize) => deviceSystemApi.page('STORAGE', { status: 'ACTIVE', page, pageSize }))
        : Promise.resolve([]),
    ]);
    const [solarDetails, storageDetails] = await Promise.all([
      Promise.all(solar.map(item => deviceSystemApi.get('SOLAR', item.id))),
      Promise.all(storage.map(item => deviceSystemApi.get('STORAGE', item.id))),
    ]);
    solarSystems.value = solarDetails;
    storageSystems.value = storageDetails;
    if (!solarSystems.value.some(item => item.id === selectedSolarId.value)) {
      selectedSolarId.value = solarSystems.value[0]?.id || '';
    }
    tick.value += 1;
  } catch (error) {
    solarSystems.value = [];
    storageSystems.value = [];
    selectedSolarId.value = '';
    loadError.value = error instanceof ApiError
      ? error.message
      : t('deviceSystemPage.overview.loadFailedDescription');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
  timer = window.setInterval(() => { tick.value += 1; }, 10_000);
});

onActivated(() => {
  if (solarSystems.value.length > 0) {
    void load();
  }
});

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <section class="energy-overview" v-loading="loading">
    <header v-if="selectedSolar" class="site-header">
      <div class="site-header__identity">
        <span class="site-header__mark"><Sunny /></span>
        <div class="site-header__copy">
          <div class="site-header__title">
            <h1>{{ selectedSolar.name }}</h1>
            <DsTag type="success" dot>{{ t('deviceSystemPage.overview.onlineNormal') }}</DsTag>
          </div>
          <div class="site-header__meta">
            <span>{{ selectedSolar.code }}</span>
            <i />
            <span>{{ t(`deviceSystemPage.mode.${selectedSolar.profile.mode}`) }}</span>
            <i />
            <span>{{ formatNumber(siteCapacity, 2) }} kWp</span>
            <i />
            <span><el-icon><Location /></el-icon>{{ serviceScope }}</span>
            <i />
            <el-tooltip :content="t('deviceSystemPage.overview.realConfigHint')" placement="bottom">
              <DsTag type="warning">{{ t('deviceSystemPage.quality.simulated') }}</DsTag>
            </el-tooltip>
          </div>
        </div>
      </div>
      <div class="site-header__operations">
        <div class="site-header__updated">
          {{ t('deviceSystemPage.overview.dataUpdated') }}
          {{ snapshot ? new Date(snapshot.updatedAt).toLocaleString(locale) : '--' }}
        </div>
        <div class="site-header__actions">
          <el-select v-model="selectedSolarId" class="site-header__selector">
            <el-option v-for="system in solarSystems" :key="system.id" :label="system.name" :value="system.id" />
          </el-select>
          <el-button :icon="SetUp" @click="router.push('/assets/pv-equipment')">
            {{ t('deviceSystemPage.overview.assetArchive') }}
          </el-button>
          <el-button :icon="Refresh" @click="load">
            {{ t('deviceSystemPage.actions.refresh') }}
          </el-button>
        </div>
      </div>
    </header>

    <DsEmpty
      v-if="!loading && !selectedSolar"
      :title="loadError
        ? (canViewSolar ? t('deviceSystemPage.overview.loadFailedTitle') : t('deviceSystemPage.overview.permissionTitle'))
        : t('deviceSystemPage.flow.emptyTitle')"
      :description="loadError || t('deviceSystemPage.flow.emptyDescription')"
    />

    <template v-else-if="selectedSolar && snapshot">
      <div class="kpi-grid">
        <article class="kpi-card kpi-card--solar">
          <span class="kpi-card__icon"><Sunny /></span>
          <div><span>{{ t('deviceSystemPage.overview.pvPower') }}</span><strong>{{ formatPower(snapshot.pvPower) }}</strong><small>{{ t('deviceSystemPage.overview.installedCapacity') }} {{ formatNumber(siteCapacity, 2) }} kWp</small></div>
        </article>
        <article class="kpi-card kpi-card--load">
          <span class="kpi-card__icon"><Monitor /></span>
          <div><span>{{ t('deviceSystemPage.overview.loadPower') }}</span><strong>{{ formatPower(snapshot.loadPower) }}</strong><small>{{ t('deviceSystemPage.overview.todayPeak') }} {{ formatPower(snapshot.loadPower * 1.18) }}</small></div>
        </article>
        <article class="kpi-card kpi-card--grid">
          <span class="kpi-card__icon"><Connection /></span>
          <div><span>{{ t('deviceSystemPage.overview.gridPower') }}</span><strong :class="{ 'is-negative': snapshot.gridPower < 0 }">{{ formatPower(snapshot.gridPower, true) }}</strong><small>{{ gridImporting ? t('deviceSystemPage.overview.importing') : t('deviceSystemPage.overview.exporting') }}</small></div>
        </article>
        <article class="kpi-card kpi-card--storage">
          <span class="kpi-card__icon"><Lightning /></span>
          <div><span>{{ t('deviceSystemPage.overview.storagePower') }}</span><strong>{{ formatPower(snapshot.storagePower, true) }}</strong><small>{{ hasStorage ? (storageCharging ? t('deviceSystemPage.overview.charging') : t('deviceSystemPage.overview.discharging')) : t('deviceSystemPage.overview.notConfigured') }}</small></div>
        </article>
        <article class="kpi-card kpi-card--ratio">
          <span class="kpi-card__icon"><Odometer /></span>
          <div><span>{{ t('deviceSystemPage.overview.selfUseRate') }}</span><strong>{{ formatNumber(snapshot.selfUseRate, 1) }}%</strong><small>{{ t('deviceSystemPage.overview.selfUseEnergy') }} {{ formatEnergy(snapshot.pvToday - snapshot.gridExportToday) }}</small></div>
        </article>
        <article class="kpi-card kpi-card--energy">
          <span class="kpi-card__icon"><TrendCharts /></span>
          <div><span>{{ t('deviceSystemPage.overview.todayGeneration') }}</span><strong>{{ formatEnergy(snapshot.pvToday) }}</strong><small>{{ t('deviceSystemPage.overview.fullLoadHours') }} {{ formatNumber(snapshot.fullLoadHours, 2) }} h</small></div>
        </article>
      </div>

      <div class="dashboard-grid">
        <main class="dashboard-main">
          <section class="panel flow-panel">
            <div class="panel__heading flow-heading">
              <h2>{{ t('deviceSystemPage.overview.realtimeFlow') }}</h2>
              <div class="flow-heading__spacer" aria-hidden="true" />
              <el-tooltip :content="t('deviceSystemPage.overview.flowConvention')" placement="left">
                <el-button text :icon="Operation">{{ t('deviceSystemPage.overview.flowHelp') }}</el-button>
              </el-tooltip>
            </div>

            <div class="flow-stage">
              <DsChart class="flow-stage__chart" :option="flowOption" />
              <article class="flow-node flow-node--pv">
                <el-icon><Sunny /></el-icon>
                <div><span>{{ t('deviceSystemPage.overview.pvArray') }}</span><strong>{{ formatPower(snapshot.pvPower) }}</strong><small>{{ snapshot.pvPower > 0 ? t('deviceSystemPage.overview.generating') : t('deviceSystemPage.overview.noGeneration') }}</small></div>
              </article>
              <article class="flow-node flow-node--bus">
                <el-icon><SetUp /></el-icon>
                <div><span>{{ t('deviceSystemPage.overview.siteBus') }}</span><strong>{{ formatPower(snapshot.loadPower) }}</strong><small>380 V · 50.00 Hz</small></div>
              </article>
              <article class="flow-node flow-node--storage" :class="{ 'is-disabled': !hasStorage }">
                <el-icon><Lightning /></el-icon>
                <div><span>{{ t('deviceSystemPage.overview.storageSystem') }}</span><strong>{{ hasStorage ? formatPower(snapshot.storagePower, true) : '--' }}</strong><small>{{ hasStorage ? `${t('deviceSystemPage.overview.soc')} ${formatNumber(snapshot.storageSoc, 1)}% · ${storageCharging ? t('deviceSystemPage.overview.charging') : t('deviceSystemPage.overview.discharging')}` : t('deviceSystemPage.overview.notConfigured') }}</small></div>
              </article>
              <article class="flow-node flow-node--grid">
                <el-icon><Connection /></el-icon>
                <div><span>{{ t('deviceSystemPage.overview.publicGrid') }}</span><strong>{{ formatPower(snapshot.gridPower, true) }}</strong><small>{{ gridImporting ? t('deviceSystemPage.overview.importing') : t('deviceSystemPage.overview.exporting') }}</small></div>
              </article>
              <article
                v-for="branch in loadBranches"
                :key="branch.key"
                class="flow-node flow-node--branch"
                :class="`flow-node--branch-${branch.key}`"
              >
                <el-icon><component :is="branch.icon" /></el-icon>
                <div>
                  <span>{{ branch.label }}</span>
                  <strong>{{ formatPower(branch.power) }}</strong>
                  <small>{{ t('deviceSystemPage.overview.loadShare', { share: branch.share }) }}</small>
                </div>
              </article>
            </div>

            <div class="flow-legend">
              <span class="is-solar">{{ t('deviceSystemPage.overview.dcFlow') }}</span>
              <span class="is-load">{{ t('deviceSystemPage.overview.acSupply') }}</span>
              <span class="is-storage">{{ t('deviceSystemPage.overview.acLoad') }}</span>
              <span class="is-grid">{{ t('deviceSystemPage.overview.gridExport') }}</span>
            </div>
          </section>

          <section class="panel trend-panel">
            <div class="panel__heading">
              <div>
                <h2>{{ t('deviceSystemPage.overview.powerTrend') }}</h2>
                <p>{{ t('deviceSystemPage.overview.signedConvention') }}</p>
              </div>
              <el-radio-group v-model="trendPeriod" size="small">
                <el-radio-button label="DAY">{{ t('deviceSystemPage.overview.day') }}</el-radio-button>
                <el-radio-button label="MONTH">{{ t('deviceSystemPage.overview.month') }}</el-radio-button>
                <el-radio-button label="YEAR">{{ t('deviceSystemPage.overview.year') }}</el-radio-button>
              </el-radio-group>
            </div>
            <DsChart class="trend-chart" :option="trendOption" />
          </section>
        </main>

        <aside class="dashboard-aside">
          <section class="panel storage-panel">
            <div class="panel__heading"><h2>{{ t('deviceSystemPage.overview.storageStatus') }}</h2></div>
            <div v-if="hasStorage" class="storage-panel__content">
              <div class="soc-ring" :style="{ '--soc': `${snapshot.storageSoc * 3.6}deg` }">
                <span><strong>{{ formatNumber(snapshot.storageSoc, 0) }}%</strong><small>SOC</small></span>
              </div>
              <div class="storage-panel__details">
                <div class="storage-panel__metric storage-panel__metric--state">
                  <span>{{ t('deviceSystemPage.overview.runningState') }}</span>
                  <DsTag :type="storageCharging ? 'success' : 'primary'" dot>
                    {{ storageCharging ? t('deviceSystemPage.overview.charging') : t('deviceSystemPage.overview.discharging') }}
                  </DsTag>
                </div>
                <div class="storage-panel__metric">
                  <span>{{ t('deviceSystemPage.overview.storagePower') }}</span>
                  <strong>{{ formatPower(snapshot.storagePower, true) }}</strong>
                </div>
                <div class="storage-panel__metric">
                  <span>{{ t('deviceSystemPage.overview.availableCapacity') }}</span>
                  <strong>{{ formatEnergy(storageCapacity * snapshot.storageSoc / 100) }}</strong>
                </div>
                <div class="storage-panel__metric">
                  <span>{{ t('deviceSystemPage.overview.soh') }}</span>
                  <strong>{{ formatNumber(snapshot.storageSoh, 1) }}%</strong>
                </div>
                <div class="storage-panel__metric">
                  <span>{{ t('deviceSystemPage.overview.pcsOnline') }}</span>
                  <strong>{{ storagePcsCount }} / {{ storagePcsCount }}</strong>
                </div>
              </div>
            </div>
            <DsEmpty v-else :title="t('deviceSystemPage.overview.noStorageTitle')" :description="t('deviceSystemPage.overview.noStorageDescription')" />
          </section>

          <section class="panel status-panel">
            <div class="panel__heading"><h2>{{ t('deviceSystemPage.overview.runningStatus') }}</h2></div>
            <ul>
              <li><span class="status-icon is-solar"><el-icon><Sunny /></el-icon></span><div><span>{{ t('deviceSystemPage.overview.pvStatus') }}</span><strong>{{ snapshot.pvPower > 0 ? t('deviceSystemPage.overview.generating') : t('deviceSystemPage.overview.noGeneration') }}</strong></div><em>{{ formatPower(snapshot.pvPower) }}</em></li>
              <li><span class="status-icon is-storage"><el-icon><Lightning /></el-icon></span><div><span>{{ t('deviceSystemPage.overview.storageStatus') }}</span><strong>{{ hasStorage ? (storageCharging ? t('deviceSystemPage.overview.charging') : t('deviceSystemPage.overview.discharging')) : t('deviceSystemPage.overview.notConfigured') }}</strong></div><em>{{ hasStorage ? formatPower(snapshot.storagePower, true) : '--' }}</em></li>
              <li><span class="status-icon is-grid"><el-icon><Connection /></el-icon></span><div><span>{{ t('deviceSystemPage.overview.gridStatus') }}</span><strong>{{ gridImporting ? t('deviceSystemPage.overview.importing') : t('deviceSystemPage.overview.exporting') }}</strong></div><em>{{ formatPower(snapshot.gridPower, true) }}</em></li>
              <li><span class="status-icon is-load"><el-icon><Monitor /></el-icon></span><div><span>{{ t('deviceSystemPage.overview.loadStatus') }}</span><strong>{{ t('deviceSystemPage.overview.normalConsumption') }}</strong></div><em>{{ formatPower(snapshot.loadPower) }}</em></li>
            </ul>
          </section>

          <section class="panel today-panel">
            <div class="panel__heading"><h2>{{ t('deviceSystemPage.overview.todayStatistics') }}</h2></div>
            <dl>
              <div><dt>{{ t('deviceSystemPage.overview.todayGeneration') }}</dt><dd>{{ formatEnergy(snapshot.pvToday) }}</dd></div>
              <div><dt>{{ t('deviceSystemPage.overview.todayConsumption') }}</dt><dd>{{ formatEnergy(snapshot.loadToday) }}</dd></div>
              <div><dt>{{ t('deviceSystemPage.overview.gridPurchase') }}</dt><dd>{{ formatEnergy(snapshot.gridImportToday) }}</dd></div>
              <div><dt>{{ t('deviceSystemPage.overview.gridFeedIn') }}</dt><dd>{{ formatEnergy(snapshot.gridExportToday) }}</dd></div>
              <div><dt>{{ t('deviceSystemPage.overview.todayRevenue') }}</dt><dd>¥ {{ formatNumber(snapshot.revenueToday, 2) }}</dd></div>
              <div><dt>{{ t('deviceSystemPage.overview.fullLoadHours') }}</dt><dd>{{ formatNumber(snapshot.fullLoadHours, 2) }} h</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <div class="summary-grid">
        <article class="summary-card">
          <div class="summary-card__heading"><span class="summary-card__icon is-health"><CircleCheck /></span><h3>{{ t('deviceSystemPage.overview.deviceHealth') }}</h3></div>
          <div class="summary-card__metrics">
            <span><small>{{ t('deviceSystemPage.overview.assetsActiveLabel') }}</small><strong>{{ activeAssetCount }} / {{ currentAssetCount }}</strong></span>
            <span><small>{{ t('deviceSystemPage.overview.communicationAbnormal') }}</small><strong>0</strong></span>
            <span><small>{{ t('deviceSystemPage.overview.todayAlarm') }}</small><strong>0</strong></span>
            <span><small>{{ t('deviceSystemPage.overview.latestUpdate') }}</small><strong>{{ new Date(snapshot.updatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) }}</strong></span>
          </div>
        </article>
        <article class="summary-card">
          <div class="summary-card__heading"><span class="summary-card__icon is-benefit"><DataAnalysis /></span><h3>{{ t('deviceSystemPage.overview.benefitEmission') }}</h3></div>
          <div class="summary-card__metrics">
            <span><small>{{ t('deviceSystemPage.overview.todayRevenue') }}</small><strong>¥ {{ formatNumber(snapshot.revenueToday, 2) }}</strong></span>
            <span><small>{{ t('deviceSystemPage.overview.totalRevenue') }}</small><strong>¥ {{ formatNumber(snapshot.revenueTotal, 2) }}</strong></span>
            <span><small>CO₂ {{ t('deviceSystemPage.overview.reduction') }}</small><strong>{{ formatNumber(snapshot.carbonReduction, 2) }} t</strong></span>
            <span><small>{{ t('deviceSystemPage.overview.equivalentTrees') }}</small><strong>{{ snapshot.equivalentTrees }}</strong></span>
          </div>
        </article>
        <article class="summary-card">
          <div class="summary-card__heading"><span class="summary-card__icon is-quality"><Link /></span><h3>{{ t('deviceSystemPage.overview.runningQuality') }}</h3></div>
          <div class="summary-card__metrics">
            <span><small>{{ t('deviceSystemPage.overview.fullLoadHours') }}</small><strong>{{ formatNumber(snapshot.fullLoadHours, 2) }} h</strong></span>
            <span><small>{{ t('deviceSystemPage.overview.systemEfficiency') }}</small><strong>{{ formatNumber(snapshot.systemEfficiency, 1) }}%</strong></span>
            <span><small>{{ t('deviceSystemPage.overview.pvCoverage') }}</small><strong>{{ formatNumber(snapshot.selfUseRate, 1) }}%</strong></span>
            <span><small>{{ t('deviceSystemPage.overview.availability') }}</small><strong>{{ formatNumber(snapshot.availabilityRate, 1) }}%</strong></span>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.energy-overview {
  --ef-gap: clamp(12px, 1cqw, 16px);
  --ef-radius: 12px;
  width: 100%;
  min-width: 0;
  container: energy-overview / inline-size;
  color: var(--el-text-color-primary);
}

.site-header,
.site-header__identity,
.site-header__title,
.site-header__meta,
.site-header__actions,
.site-header__operations,
.panel__heading,
.summary-card__heading {
  display: flex;
  align-items: center;
}

.site-header {
  min-height: 64px;
  justify-content: space-between;
  gap: 24px;
  padding: 4px 0 12px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.site-header__identity { min-width: 0; flex: 1 1 auto; gap: 14px; }
.site-header__mark {
  display: grid;
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  place-items: center;
  border-radius: 14px;
  color: #d89f00;
  background: linear-gradient(135deg, #fff8d5, #ffefae);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #e6b400 15%, transparent);
}
.site-header__mark svg { width: 28px; }
.site-header__copy { min-width: 0; }
.site-header__title { gap: 10px; min-width: 0; }
.site-header h1 {
  max-width: min(560px, 40vw);
  margin: 0;
  overflow: hidden;
  font-size: clamp(20px, 1.45cqw, 22px);
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.site-header__meta { gap: 10px; margin-top: 6px; color: var(--el-text-color-secondary); font-size: 12px; white-space: nowrap; }
.site-header__meta i { width: 1px; height: 12px; background: var(--el-border-color); }
.site-header__meta span { display: inline-flex; align-items: center; gap: 4px; }
.site-header__operations {
  flex: 0 1 auto;
  align-items: flex-end;
  flex-direction: column;
  gap: 7px;
}
.site-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}
.site-header__actions > * { flex: 0 0 auto; }
.site-header__actions .el-button { margin-left: 0; }
.site-header__updated { padding-right: 2px; color: var(--el-text-color-secondary); font-size: 11px; white-space: nowrap; }
.site-header__selector {
  width: 200px;
  flex: 0 0 200px;
}
.site-header__selector :deep(.el-select__wrapper) {
  width: 100%;
  min-width: 0;
}
.site-header__selector :deep(.el-select__selected-item) {
  display: inline-flex;
  max-width: calc(100% - 28px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
.site-header__selector :deep(.el-select__placeholder) {
  max-width: calc(100% - 28px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--ef-gap);
  margin-top: var(--ef-gap);
}

.kpi-card {
  display: flex;
  min-width: 0;
  min-height: 88px;
  align-items: center;
  gap: 11px;
  padding: 12px 14px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-bg-color);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--el-color-primary) 4%, transparent);
}
.kpi-card__icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  place-items: center;
  border-radius: 50%;
}
.kpi-card__icon svg { width: 23px; }
.kpi-card > div { min-width: 0; }
.kpi-card span:not(.kpi-card__icon), .kpi-card small { display: block; overflow: hidden; color: var(--el-text-color-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.kpi-card strong { display: block; margin: 3px 0 2px; font-size: clamp(17px, 1.4cqw, 20px); font-weight: 700; line-height: 1.15; white-space: nowrap; }
.kpi-card strong.is-negative { color: var(--el-color-primary); }
.kpi-card--solar .kpi-card__icon { color: #d8a100; background: #fff6d4; }
.kpi-card--load .kpi-card__icon { color: #f57422; background: #fff0e5; }
.kpi-card--grid .kpi-card__icon { color: #276ce5; background: #eaf2ff; }
.kpi-card--storage .kpi-card__icon { color: #1aa466; background: #e7f8ef; }
.kpi-card--ratio .kpi-card__icon { color: #7653db; background: #f0ebff; }
.kpi-card--energy .kpi-card__icon { color: #0aa4c6; background: #e7f8fb; }

.dashboard-grid {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) clamp(264px, 22cqw, 304px);
  gap: var(--ef-gap);
  margin-top: var(--ef-gap);
  align-items: stretch;
}
.dashboard-main, .dashboard-aside { display: grid; gap: var(--ef-gap); min-width: 0; }
.dashboard-main {
  grid-template-rows: auto minmax(0, 1fr);
  align-content: stretch;
}
.dashboard-aside { align-content: stretch; }
.panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--ef-radius);
  background: var(--el-bg-color);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--el-color-primary) 3%, transparent);
}
.panel__heading {
  min-height: 48px;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px 8px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.panel__heading h2, .summary-card h3 { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.4; }
.panel__heading p { margin: 2px 0 0; color: var(--el-color-primary); font-size: 11px; }
.flow-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.flow-heading > h2 { margin: 0; }
.flow-heading__spacer { flex: 1 1 auto; }

.flow-panel { overflow: hidden; }
.flow-stage {
  position: relative;
  width: 100%;
  height: 350px;
  flex: 0 0 auto;
  overflow: hidden;
  background: var(--el-bg-color);
}
.flow-stage__chart { position: absolute; inset: 0; z-index: 1; }
.flow-node {
  position: absolute;
  z-index: 2;
  display: flex;
  width: clamp(120px, 14%, 160px);
  min-width: 118px;
  height: 60px;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border: 1px solid var(--el-border-color);
  border-radius: 9px;
  background: var(--el-bg-color);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--el-color-primary) 5%, transparent);
  transition: opacity .2s ease, filter .2s ease;
}
.flow-node .el-icon {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-size: 15px;
  line-height: 1;
  vertical-align: middle;
}
.flow-node .el-icon :deep(svg) {
  display: block;
  width: 15px;
  height: 15px;
  margin: auto;
}
.flow-node > div { min-width: 0; flex: 1 1 auto; }
.flow-node span, .flow-node small { display: block; overflow: hidden; color: var(--el-text-color-secondary); font-size: 9px; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.flow-node strong { display: block; margin: 1px 0; font-size: 14px; font-weight: 700; line-height: 1.2; white-space: nowrap; }
.flow-node--pv { left: 43%; top: 4%; border-color: #f5c163; background: linear-gradient(135deg, #fff7e0 0%, var(--el-bg-color) 100%); }
.flow-node--pv .el-icon { color: #f5a623; background: #fff1d2; }
.flow-node--bus { left: 43%; top: 36%; border-color: #7eabfb; background: linear-gradient(135deg, #eef4ff 0%, var(--el-bg-color) 100%); }
.flow-node--bus .el-icon, .flow-node--grid .el-icon { color: #246ee8; background: #eaf2ff; }
.flow-node--storage { right: 5%; top: 36%; border-color: #6dd4a0; background: linear-gradient(135deg, #ecfaf2 0%, var(--el-bg-color) 100%); }
.flow-node--storage .el-icon { color: #149b5d; background: #e8f8ef; }
.flow-node--grid { left: 5%; top: 36%; border-color: #7eabfb; background: linear-gradient(135deg, #eef4ff 0%, var(--el-bg-color) 100%); }
.flow-node--branch {
  width: clamp(120px, 14%, 160px);
  min-width: 118px;
  height: 58px;
  bottom: 4%;
  border-color: color-mix(in srgb, var(--el-color-primary) 34%, var(--el-border-color-light));
  background: var(--el-bg-color);
}
.flow-node--branch .el-icon { color: #246ee8; background: #eaf2ff; }
.flow-node--branch-production { left: 15%; }
.flow-node--branch-office { left: 43%; }
.flow-node--branch-other { right: 15%; }
.flow-node--branch strong { font-size: 13px; }
.flow-node.is-disabled { opacity: .48; filter: grayscale(.45); }
.flow-legend {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 22px;
  border-top: 1px solid var(--el-border-color-extra-light);
  color: var(--el-text-color-secondary);
  font-size: 10px;
}
.flow-legend span::before { display: inline-block; width: 16px; height: 2px; margin-right: 6px; vertical-align: middle; content: ''; border-radius: 2px; }
.flow-legend .is-solar::before { background: #f5a623; }
.flow-legend .is-load::before { background: #ff7a1a; }
.flow-legend .is-storage::before { background: #19a868; }
.flow-legend .is-grid::before { background: #3478f6; }

.trend-panel {
  min-height: 280px;
  flex: 1 1 auto;
}
.trend-panel > .panel__heading { flex: 0 0 auto; }
.trend-chart {
  min-height: 220px;
  height: 100%;
  flex: 1 1 auto;
  padding: 4px 6px 8px;
}

.storage-panel__content {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 8px 14px 14px;
}
.soc-ring {
  display: grid;
  width: 96px;
  height: 96px;
  margin: 4px auto;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(var(--el-color-success) var(--soc), var(--el-border-color-lighter) 0);
}
.soc-ring::before { width: 76px; height: 76px; border-radius: 50%; background: var(--el-bg-color); content: ''; }
.soc-ring > span { position: absolute; text-align: center; }
.soc-ring strong, .soc-ring small { display: block; }
.soc-ring strong { font-size: 20px; }
.soc-ring small { margin-top: 1px; color: var(--el-text-color-secondary); font-size: 10px; }
.storage-panel__details { min-width: 0; }
.storage-panel__metric {
  display: flex;
  min-height: 26px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.storage-panel__metric:last-child { border-bottom: 0; }
.storage-panel__metric > span { color: var(--el-text-color-secondary); font-size: 10px; }
.storage-panel__metric strong { font-size: 11px; white-space: nowrap; }
.storage-panel__metric--state { min-height: 32px; }
.summary-card__metrics span { min-width: 0; }

.status-panel ul { margin: 0; padding: 4px 14px 12px; list-style: none; }
.status-panel li { display: flex; align-items: center; gap: 8px; height: 50px; border-top: 1px solid var(--el-border-color-extra-light); }
.status-panel li:first-child { border-top: 0; }
.status-icon { width: 28px; height: 28px; flex: 0 0 28px; border-radius: 7px; overflow: hidden; }
.status-icon :deep(.el-icon) { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.status-icon :deep(svg) { width: 15px; height: 15px; }
.status-icon.is-solar { color: #d6a000; background: #fff6d8; }
.status-icon.is-storage { color: #149b5d; background: #e8f8ef; }
.status-icon.is-grid { color: #246ee8; background: #eaf2ff; }
.status-icon.is-load { color: #f1711e; background: #fff0e4; }
.status-panel li > div { flex: 1 1 auto; min-width: 0; }
.status-panel li span, .status-panel li strong { display: block; line-height: 1.35; }
.status-panel li span { color: var(--el-text-color-secondary); font-size: 10px; }
.status-panel li strong { margin-top: 0; font-size: 11px; }
.status-panel li em { flex: 0 0 auto; font-size: 11px; font-style: normal; white-space: nowrap; }

.today-panel dl { margin: 0; padding: 4px 14px 12px; }
.today-panel dl > div { display: flex; min-height: 28px; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; border-top: 1px dashed var(--el-border-color-extra-light); }
.today-panel dl > div:first-child { border-top: 0; }
.today-panel dt { color: var(--el-text-color-secondary); }
.today-panel dd { margin: 0; font-weight: 600; white-space: nowrap; }

.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--ef-gap); margin-top: var(--ef-gap); }
.summary-card { min-width: 0; padding: 12px 16px 14px; border: 1px solid var(--el-border-color-light); border-radius: var(--ef-radius); background: var(--el-bg-color); box-shadow: 0 4px 16px color-mix(in srgb, var(--el-color-primary) 3%, transparent); }
.summary-card__heading { gap: 9px; margin-bottom: 12px; }
.summary-card__icon { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 8px; }
.summary-card__icon svg { width: 16px; }
.summary-card__icon.is-health { color: #3279ef; background: #eaf2ff; }
.summary-card__icon.is-benefit { color: #18a765; background: #e8f8ef; }
.summary-card__icon.is-quality { color: #7c55df; background: #f0ebff; }
.summary-card__metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.summary-card__metrics span { display: grid; min-width: 0; padding: 8px 4px; border: 1px solid var(--el-border-color-extra-light); border-radius: 8px; background: var(--el-bg-color-page); }
.summary-card__metrics small, .summary-card__metrics strong { display: block; overflow: hidden; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.summary-card__metrics small { color: var(--el-text-color-secondary); font-size: 9px; }
.summary-card__metrics strong { margin-top: 4px; font-size: 13px; }

@media (max-width: 1480px) {
  .site-header__updated { display: none; }
  .site-header__selector { width: 170px; flex-basis: 170px; }
  .kpi-card { gap: 8px; padding-inline: 10px; }
  .kpi-card__icon { width: 38px; height: 38px; flex-basis: 38px; }
  .kpi-card strong { font-size: 17px; }
  .flow-node { min-width: 124px; padding: 9px; }
  .flow-node strong { font-size: 15px; }
}

@media (max-width: 1280px) {
  .dashboard-grid { grid-template-columns: minmax(0, 1fr) 280px; }
  .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .summary-card__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 1180px) {
  .site-header { align-items: flex-start; flex-direction: column; padding-bottom: 10px; }
  .site-header h1 { max-width: 68vw; }
  .site-header__operations { width: 100%; align-items: flex-start; }
  .site-header__actions { width: 100%; justify-content: flex-start; }
  .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .dashboard-grid { grid-template-columns: 1fr; }
  .dashboard-aside { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .summary-grid { grid-template-columns: 1fr; }
}

@media (max-width: 820px) {
  .site-header__meta i, .site-header__meta span:nth-of-type(2) { display: none; }
  .site-header__selector { width: min(54vw, 180px); flex: 1 1 180px; }
  .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .flow-stage { display: grid; height: auto; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 8px 12px 14px; }
  .flow-stage__chart, .flow-link-label { display: none; }
  .flow-node { position: static; width: auto; min-width: 0; }
  .dashboard-aside { grid-template-columns: 1fr; }
}
</style>
