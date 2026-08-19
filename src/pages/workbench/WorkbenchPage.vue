<script setup lang="ts">
import {
  Aim, Bell, Connection, DataAnalysis, Grid, Lightning,
  Monitor, TrendCharts, UserFilled,
} from '@element-plus/icons-vue';
import { computed, onActivated, onMounted, ref, watch, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { appName, isDemoMode } from '@/core/config/app-runtime';
import { auditActionLabel } from '@/core/i18n/business-labels';
import { useActiveLocaleDataRefresh } from '@/core/i18n/use-active-locale-data-refresh';
import { useRouter } from 'vue-router';
import chinaGeoJson from 'china-geojson/src/geojson/china.json';
import bannerUrl from '@/assets/images/workbench/banner.webp';
import bannerDarkUrl from '@/assets/images/workbench/banner-dark.webp';
import { preloadImage, preloadImageWhenIdle } from '@/core/assets/image-preload';
import { useAuthStore } from '@/core/auth/auth.store';
import { useThemeStore } from '@/core/theme/theme.store';
import DsChart from '@/design-system/components/DsChart.vue';
import { echarts } from '@/design-system/charts/echarts-runtime';
import type { OperationAudit } from '@/domain/platform/settings/api/settings.api';
import {
  loadBusinessSnapshot,
  loadLoginRegions,
  loadRealSnapshot,
  type WorkbenchRealSnapshot,
} from '@/domain/platform/workbench/services/workbench.service';
import {
  displayLoginRegionName,
  isUnknownLoginRegion,
  normalizeChinaRegionName,
} from '@/domain/platform/workbench/china-region';
import type { EnergyKpi, WorkbenchBusinessSnapshot } from '@/domain/platform/workbench/types';

type AnalysisMode = 'energy' | 'device' | 'alarm';

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const { locale, t } = useI18n();
const loading = ref(true);
const loadError = ref('');
const analysisMode = ref<AnalysisMode>('energy');
const loginRange = ref<1 | 7 | 30>(7);
const business = ref<WorkbenchBusinessSnapshot | null>(null);
const real = ref<WorkbenchRealSnapshot>({ auditSummary: null, recentOperations: [], loginRegions: null });
const isZh = computed(() => locale.value.startsWith('zh'));
const isDark = computed(() => themeStore.theme === 'dark');
const bannerImage = ref(isDark.value ? bannerDarkUrl : bannerUrl);
const bannerImageLoading = ref(false);
let bannerImageRequest = 0;

watch(isDark, async (dark) => {
  const request = ++bannerImageRequest;
  const nextUrl = dark ? bannerDarkUrl : bannerUrl;
  bannerImageLoading.value = true;
  try {
    await preloadImage(nextUrl);
    if (request === bannerImageRequest) bannerImage.value = nextUrl;
  } finally {
    if (request === bannerImageRequest) bannerImageLoading.value = false;
  }
});

echarts.registerMap('china', chinaGeoJson as never);

function greeting() {
  const hour = new Date().getHours();
  if (isZh.value) return hour < 11 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

const copy = computed(() => {
  const text = (key: string) => t(`workbenchPage.${key}`);
  return {
    platform: text('platform'), welcome: text('welcome'), subtitle: text('subtitle'), demo: text('demo'), real: text('real'), limited: text('limited'),
    role: text('role'), scope: text('scope'), allData: text('allData'), items: text('items'), health: text('health'), normal: text('normal'), minor: text('minor'), serious: text('serious'), healthUnit: text('healthUnit'),
    operations: text('operations'), successRate: text('successRate'), failedLogin: text('failedLogin'), actors: text('actors'), regionTitle: text('regionTitle'), totalLogins: text('totalLogins'), activeRegions: text('activeRegions'), activeCities: text('activeCities'), cityRank: text('cityRank'), geoCredit: text('geoCredit'),
    analysis: text('analysis'), analysisSub: text('analysisSub'), energy: text('energy'), device: text('device'), alarm: text('alarm'), today: text('today'), recent7: text('recent7'), pv: text('pv'), grid: text('grid'), total: text('total'), online: text('online'), offline: text('offline'), pending: text('pending'), alarmTotal: text('alarmTotal'), unhandled: text('unhandled'), handled: text('handled'), handleRate: text('handleRate'),
    audit: text('audit'), auditSub: text('auditSub'), actor: text('actor'), action: text('action'), module: text('module'), time: text('time'), ip: text('ip'), more: text('more'), quick: text('quick'), quickSub: text('quickSub'), noAudit: text('noAudit'), success: text('success'), failure: text('failure'), disabled: text('disabled'),
    kpis: { consumption: text('kpis.consumption'), grid: text('kpis.grid'), pv: text('kpis.pv'), device: text('kpis.device'), meter: text('kpis.meter'), alarm: text('kpis.alarm') },
    unitDevice: text('unitDevice'), unitAlarm: text('unitAlarm'), empty: text('empty'),
  };
});

const kpiIcons: Record<EnergyKpi['key'], Component> = {
  consumption: Lightning, grid: Connection, pv: TrendCharts, device: Monitor, meter: Grid, alarm: Bell,
};

const displayKpis = computed(() => business.value?.kpis.filter((item) => item.key !== 'meter') ?? []);
const currentRoles = computed(() => {
  const roleNames: Record<string, string> = isZh.value ? {
    admin: '系统管理员', system_admin: '系统管理员', user: '游客',
    demo_viewer: '演示访客',
    ops_engineer: '运维工程师', data_analyst: '数据分析师', report_viewer: '财务查看员',
  } : {
    admin: 'System administrator', system_admin: 'System administrator', user: 'Guest',
    demo_viewer: 'Demo viewer',
    ops_engineer: 'Operations engineer', data_analyst: 'Data analyst', report_viewer: 'Report viewer',
  };
  const names = authStore.account?.roles
    ?.map((role) => {
      const code = role.code?.toLowerCase();
      const name = role.name?.toLowerCase();
      return roleNames[code] || roleNames[name] || role.name;
    })
    .filter(Boolean) ?? [];
  if (names.length) return names.join(' / ');
  const codes = authStore.userContext?.roles ?? [];
  return codes.map((code) => roleNames[code.toLowerCase()] || code).join(' / ')
    || (isZh.value ? '角色信息同步中' : 'Role data syncing');
});

const healthScore = computed<number | null>(() => {
  const summary = real.value.auditSummary;
  if (!summary) return null;
  return Math.max(0, Math.min(100, Math.round(summary.successRate - Math.min(summary.loginFailures, 12) * 0.8)));
});

const healthLegend = computed(() => {
  if (healthScore.value === null) return [];
  const normal = healthScore.value;
  const minor = Math.min(100 - normal, 8);
  return [
    { label: copy.value.normal, value: normal, tone: 'normal' },
    { label: copy.value.minor, value: minor, tone: 'minor' },
    { label: copy.value.serious, value: Math.max(0, 100 - normal - minor), tone: 'serious' },
  ];
});

const healthOption = computed(() => ({
  series: [{
    type: 'gauge', startAngle: 205, endAngle: -25, min: 0, max: 100,
    center: ['50%', '56%'], radius: '79%', pointer: { show: false },
    progress: { show: true, width: 11, roundCap: true, itemStyle: { color: isDark.value ? '#5d8fe9' : '#2f6bcb' } },
    axisLine: { lineStyle: { width: 11, color: [[1, isDark.value ? '#283750' : '#e8edf5']] } },
    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
    title: { show: true, offsetCenter: [0, '34%'], color: isDark.value ? '#9ba9c7' : '#7a8699', fontSize: 11 },
    detail: { offsetCenter: [0, '-5%'], formatter: healthScore.value === null ? '--' : '{value}', color: isDark.value ? '#eaf0ff' : '#172033', fontSize: 30, fontWeight: 700 },
    data: [{ value: healthScore.value ?? 0, name: healthScore.value === null ? copy.value.limited : copy.value.healthUnit }],
  }],
}));


function kpiSecondary(item: EnergyKpi) {
  const kpis = business.value?.kpis;
  const device = business.value?.device;
  const alarm = business.value?.alarm;
  const map: Record<EnergyKpi['key'], Array<{ label: string; value: string | number }>> = {
    consumption: [{ label: copy.value.pv, value: kpis?.[2]?.value ?? '--' }, { label: copy.value.grid, value: kpis?.[1]?.value ?? '--' }],
    grid: [{ label: isZh.value ? '供电正常' : 'Available', value: '100%' }],
    pv: [{ label: isZh.value ? '清洁能源占比' : 'Clean share', value: `${Math.round(((kpis?.[2]?.value ?? 0) / Math.max(kpis?.[0]?.value ?? 1, 1)) * 100)}%` }],
    device: [{ label: copy.value.online, value: device?.online ?? '--' }, { label: copy.value.offline, value: device?.offline ?? '--' }],
    meter: [],
    alarm: [{ label: copy.value.unhandled, value: alarm?.unhandled ?? '--' }, { label: copy.value.handled, value: alarm?.handled ?? '--' }],
  };
  return map[item.key];
}

const analysisTabs = computed<Array<{ key: AnalysisMode; label: string }>>(() => [
  { key: 'energy', label: copy.value.energy },
  { key: 'device', label: copy.value.device },
  { key: 'alarm', label: copy.value.alarm },
]);

const analysisStats = computed(() => {
  if (analysisMode.value === 'device') return [
    { label: copy.value.online, value: business.value?.device.online ?? '--', unit: copy.value.unitDevice },
    { label: copy.value.offline, value: business.value?.device.offline ?? '--', unit: copy.value.unitDevice },
    { label: copy.value.pending, value: business.value?.device.pending ?? '--', unit: copy.value.unitDevice },
  ];
  if (analysisMode.value === 'alarm') return [
    { label: copy.value.alarmTotal, value: business.value?.alarm.today ?? '--', unit: copy.value.unitAlarm },
    { label: copy.value.unhandled, value: business.value?.alarm.unhandled ?? '--', unit: copy.value.unitAlarm },
    { label: copy.value.handleRate, value: business.value ? `${business.value.alarm.handleRate}%` : '--', unit: '' },
  ];
  return [
    { label: copy.value.total, value: business.value?.kpis[0]?.value.toLocaleString() ?? '--', unit: 'kWh' },
    { label: copy.value.grid, value: business.value?.kpis[1]?.value.toLocaleString() ?? '--', unit: 'kWh' },
    { label: copy.value.pv, value: business.value?.kpis[2]?.value.toLocaleString() ?? '--', unit: 'kWh' },
  ];
});

const loginRegionStats = computed(() => [
  { label: copy.value.totalLogins, value: real.value.loginRegions?.totalLogins ?? '--' },
  { label: copy.value.actors, value: real.value.loginRegions?.activeAccounts ?? '--' },
  { label: copy.value.activeRegions, value: real.value.loginRegions?.activeRegions ?? '--' },
]);

const loginMapOption = computed(() => {
  const totalsByRegion = new Map<string, number>();
  for (const item of real.value.loginRegions?.regions ?? []) {
    const name = normalizeChinaRegionName(item.name);
    if (name) totalsByRegion.set(name, (totalsByRegion.get(name) ?? 0) + item.loginCount);
  }
  const values = [...totalsByRegion].map(([name, value]) => ({ name, value }));
  // Regions without data use series.itemStyle. Keep the visual scale above zero so
  // even a single login remains visibly highlighted instead of blending into it.
  const max = Math.max(2, ...values.map((item) => item.value));
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value?: number | number[] }) => {
        const rawValue = Array.isArray(params.value) ? params.value[params.value.length - 1] : params.value;
        const count = Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0;
        return `${params.name}<br/>${copy.value.totalLogins}：${count}`;
      },
    },
    visualMap: {
      show: false, min: 1, max,
      inRange: { color: isDark.value ? ['#2a4f7a', '#34689e', '#4081c8', '#5a98ff'] : ['#9dbcf2', '#79a3e8', '#5687db', '#2f6bcb'] },
    },
    series: [{
      type: 'map', map: 'china', roam: false, selectedMode: false,
      layoutCenter: ['50%', '49%'], layoutSize: '97%',
      label: { show: false },
      itemStyle: { areaColor: isDark.value ? '#1a2a44' : '#eef3fb', borderColor: isDark.value ? '#0b1220' : '#fff', borderWidth: 1 },
      emphasis: { label: { show: true, color: isDark.value ? '#eaf0ff' : '#1f2b40', fontSize: 10 }, itemStyle: { areaColor: isDark.value ? '#3f7bc8' : '#5f8fd8' } },
      data: values,
    }],
  };
});

function formatLoginCity(regionName: string, cityName: string) {
  const normalizedRegion = normalizeChinaRegionName(regionName);
  const normalizedCity = normalizeChinaRegionName(cityName);
  const parts = [
    isUnknownLoginRegion(regionName) ? null : displayLoginRegionName(regionName, isZh.value),
    isUnknownLoginRegion(cityName) || (normalizedRegion && normalizedCity === normalizedRegion) ? null : cityName,
  ].filter((value): value is string => Boolean(value));
  return [...new Set(parts)].join(' · ');
}

const visibleTopLoginCities = computed(() => real.value.loginRegions?.topCities
  .filter((city) => !isUnknownLoginRegion(city.regionName) || !isUnknownLoginRegion(city.cityName)) ?? []);

const analysisOption = computed(() => {
  if (analysisMode.value === 'device') return {
    color: ['#3f73d7'], tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '4%', right: '8%', top: 16, bottom: 20, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: isDark.value ? '#9ba9c7' : '#8b95a7' }, splitLine: { lineStyle: { color: isDark.value ? '#25334b' : '#edf1f6', type: 'dashed' } } },
    yAxis: { type: 'category', inverse: true, data: business.value?.deviceTypes.map((item) => item.name), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: isDark.value ? '#b8c4dc' : '#5f6b7e', fontSize: 11 } },
    series: [{ type: 'bar', barWidth: 15, showBackground: true, backgroundStyle: { color: isDark.value ? '#22314a' : '#edf2f8', borderRadius: 8 }, itemStyle: { borderRadius: [0, 8, 8, 0] }, label: { show: true, position: 'right', color: isDark.value ? '#dce6f8' : '#344157', fontWeight: 600 }, data: business.value?.deviceTypes.map((item) => item.value) }],
  };
  if (analysisMode.value === 'alarm') return {
    color: ['#315fad', '#d58b34', '#3b9a72'], tooltip: { trigger: 'axis' },
    legend: { bottom: 3, left: 'center', itemWidth: 16, itemHeight: 7, itemGap: 22, textStyle: { color: isDark.value ? '#9ba9c7' : '#697386', fontSize: 11 } },
    grid: { left: '4%', right: '3%', top: 20, bottom: 46, containLabel: true },
    xAxis: { type: 'category', data: business.value?.alarmTrend.map((item) => item.day), axisTick: { show: false }, axisLabel: { color: isDark.value ? '#9ba9c7' : '#8b95a7' }, axisLine: { lineStyle: { color: isDark.value ? '#2a3953' : '#e5eaf1' } } },
    yAxis: { type: 'value', axisLabel: { color: isDark.value ? '#9ba9c7' : '#8b95a7' }, splitLine: { lineStyle: { color: isDark.value ? '#25334b' : '#edf1f6', type: 'dashed' } } },
    series: [
      { name: copy.value.alarmTotal, type: 'line', smooth: true, symbolSize: 5, lineStyle: { width: 2.2 }, areaStyle: { opacity: 0.06 }, data: business.value?.alarmTrend.map((item) => item.total) },
      { name: copy.value.unhandled, type: 'line', smooth: true, symbolSize: 5, data: business.value?.alarmTrend.map((item) => item.unhandled) },
      { name: copy.value.handled, type: 'line', smooth: true, symbolSize: 5, data: business.value?.alarmTrend.map((item) => item.handled) },
    ],
  };
  const pvColor = isDark.value ? '#48c79a' : '#35a979';
  const gridColor = isDark.value ? '#45b7d1' : '#2999b5';
  const loadColor = isDark.value ? '#6f9cff' : '#315fad';
  const trend = business.value?.trend ?? [];
  const lastCollectedIndex = trend.reduce((latest, item, index) => item.load === null ? latest : index, 0);
  const collectedUntil = trend[lastCollectedIndex]?.hour ?? '00:00';
  return {
    color: [pvColor, gridColor, loadColor], tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: isDark.value ? '#34445f' : '#52647f' } },
      formatter: (params: Array<{ axisValue: string; marker: string; seriesName: string; value: number | null }>) => {
        const available = params.filter((item) => item.value !== null && item.value !== undefined);
        if (!available.length) return `${params[0]?.axisValue ?? ''}<br/>${isZh.value ? '暂无采集数据' : 'No collected data'}`;
        return [`<b>${available[0].axisValue}</b>`, ...available.map((item) => `${item.marker}${item.seriesName}：${Math.abs(Number(item.value)).toFixed(1)} kW`)].join('<br/>');
      },
    },
    legend: { bottom: 3, left: 'center', itemWidth: 16, itemHeight: 7, itemGap: 22, textStyle: { color: isDark.value ? '#9ba9c7' : '#697386', fontSize: 11 } },
    grid: { left: '4%', right: '3%', top: 20, bottom: 46, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: business.value?.trend.map((item) => item.hour), axisLabel: { interval: 2, color: isDark.value ? '#9ba9c7' : '#8b95a7' }, axisLine: { lineStyle: { color: isDark.value ? '#2a3953' : '#e5eaf1' } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: isDark.value ? '#9ba9c7' : '#8b95a7' }, splitLine: { lineStyle: { color: isDark.value ? '#25334b' : '#edf1f6', type: 'dashed' } } },
    series: [
      { name: copy.value.pv, type: 'line', smooth: 0.28, showSymbol: false, lineStyle: { width: 2.1, color: pvColor }, areaStyle: { color: pvColor, opacity: 0.13 }, data: business.value?.trend.map((item) => item.pv) },
      { name: copy.value.grid, type: 'line', smooth: 0.28, showSymbol: false, lineStyle: { width: 2.1, color: gridColor }, areaStyle: { color: gridColor, opacity: 0.1 }, data: business.value?.trend.map((item) => item.grid === null ? null : -item.grid) },
      {
        name: copy.value.total, type: 'line', smooth: 0.28, showSymbol: false,
        lineStyle: { width: 2.5, color: loadColor }, areaStyle: { color: loadColor, opacity: 0.08 },
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { color: isDark.value ? '#60708a' : '#9aa7b8', type: 'dashed', width: 1 },
          label: { show: true, formatter: `${isZh.value ? '已采集至' : 'Collected to'} ${collectedUntil}`, color: isDark.value ? '#aebbd2' : '#6d788b', fontSize: 10, position: 'insideEndTop' },
          data: [{ xAxis: collectedUntil }],
        },
        markArea: lastCollectedIndex < trend.length - 1 ? {
          silent: true,
          itemStyle: { color: isDark.value ? 'rgba(96,112,138,.08)' : 'rgba(122,134,153,.05)' },
          label: { show: true, formatter: isZh.value ? '待采集' : 'Pending collection', color: isDark.value ? '#73819a' : '#a0a9b7', fontSize: 10, position: 'insideTop' },
          data: [[{ xAxis: collectedUntil }, { xAxis: trend[trend.length - 1]?.hour ?? '24:00' }]],
        } : undefined,
        data: trend.map((item) => item.load),
      },
    ],
  };
});

function actionLabel(row: OperationAudit) {
  return auditActionLabel(t, row.actionCode);
}

function moduleLabel(resourceType?: string) {
  const normalized = resourceType?.trim().toUpperCase();
  const labels: Record<string, string> = isZh.value ? {
    ACCOUNT: '账号管理', ROLE: '角色权限', MENU: '菜单权限', TENANT: '租户档案',
    POSITION: '部门岗位', ORGANIZATION: '组织架构', PROJECT: '项目管理', SPACE: '空间层级',
    DICTIONARY: '数据字典', PARAMETER: '基础参数', BILL: '账单管理', ALARM: '告警管理',
  } : {
    ACCOUNT: 'Accounts', ROLE: 'Roles', MENU: 'Menus', TENANT: 'Tenants',
    POSITION: 'Positions', ORGANIZATION: 'Organization', PROJECT: 'Projects', SPACE: 'Spaces',
    DICTIONARY: 'Dictionary', PARAMETER: 'Parameters', BILL: 'Billing', ALARM: 'Alarms',
  };
  return normalized ? (labels[normalized] || (isZh.value ? '平台管理' : 'Platform')) : '-';
}

function formatTime(value: string) { return value ? value.replace('T', ' ').slice(0, 16) : '-'; }
function kpiUnit(item: EnergyKpi) {
  if (item.unit) return item.unit;
  return item.key === 'device' ? copy.value.unitDevice : item.key === 'alarm' ? copy.value.unitAlarm : '';
}
async function changeLoginRange(days: 1 | 7 | 30) {
  if (loginRange.value === days || !authStore.can('platform:audit:log:view')) return;
  loginRange.value = days;
  try {
    real.value.loginRegions = await loadLoginRegions(days);
  } catch {
    real.value.loginRegions = null;
  }
}
async function load() {
  if (loading.value && business.value) return;
  loading.value = true;
  loadError.value = '';
  const clientId = authStore.client?.id || authStore.userContext?.clientId || 1;
  try {
    const [nextBusiness, nextReal] = await Promise.all([
      loadBusinessSnapshot(clientId),
      loadRealSnapshot(authStore.can('platform:audit:log:view')),
    ]);
    business.value = nextBusiness;
    real.value = nextReal;
  } catch {
    loadError.value = business.value
      ? (isZh.value ? '数据刷新失败，当前保留上次成功结果' : 'Refresh failed. Showing the last successful result.')
      : (isZh.value ? '工作台数据暂时不可用' : 'Workbench data is temporarily unavailable.');
  } finally {
    loading.value = false;
  }
}

useActiveLocaleDataRefresh(load);
onMounted(() => {
  void load();
  preloadImageWhenIdle(isDark.value ? bannerUrl : bannerDarkUrl);
});
onActivated(() => { if (business.value) void load(); });
</script>

<template>
  <section class="workbench" :class="{ 'is-refreshing': loading && business, 'is-dark': isDark }" :aria-busy="loading">
    <div v-if="loading && !business" class="workbench-skeleton" role="status" :aria-label="isZh ? '正在加载工作台' : 'Loading workbench'">
      <i v-for="index in 10" :key="index" />
    </div>
    <div v-else-if="loadError && !business" class="workbench-error" role="alert">
      <strong>{{ isZh ? '工作台暂时无法加载' : 'Workbench is unavailable' }}</strong>
      <span>{{ loadError }}</span>
      <button type="button" @click="load">{{ isZh ? '重新加载' : 'Retry' }}</button>
    </div>
    <div v-else class="dashboard-grid">
      <section
        class="hero"
        :class="{ 'is-theme-image-loading': bannerImageLoading }"
        :style="{ backgroundImage: bannerImageLoading ? 'none' : `url(${bannerImage})` }"
      >
        <div class="hero__content">
          <p class="hero__eyebrow">{{ appName }}</p>
          <h1>{{ greeting() }}，{{ authStore.displayName || authStore.account?.username }}</h1>
          <strong>{{ isZh ? `欢迎使用 ${appName}` : `Welcome to ${appName}` }}</strong>
          <span>{{ copy.subtitle }}</span>
          <div class="hero__meta">
            <article><el-icon><UserFilled /></el-icon><div><small>{{ copy.role }}</small><b>{{ currentRoles }}</b></div></article>
            <article><el-icon><Aim /></el-icon><div><small>{{ copy.scope }}</small><b>{{ authStore.dataScopes.length ? `${authStore.dataScopes.length} ${copy.items}` : copy.allData }}</b></div></article>
          </div>
        </div>
      </section>

      <article class="surface-card health-card">
        <header class="rail-header"><h2>{{ copy.health }}</h2></header>
        <div class="health-body">
          <div class="health-chart"><DsChart :option="healthOption" /></div>
          <div v-if="healthLegend.length" class="health-legend">
            <span v-for="item in healthLegend" :key="item.label"><i :class="item.tone" />{{ item.label }}<b>{{ item.value }}%</b></span>
          </div>
          <p v-else class="health-limited">{{ copy.noAudit }}</p>
        </div>
      </article>

      <section class="surface-card metrics-panel">
        <div class="metrics-heading"><div><h2>{{ isZh ? '经营概览' : 'Business overview' }}</h2><p>{{ isZh ? '核心业务指标 · 未接入领域使用演示数据' : 'Core metrics · demo data only for domains not yet connected' }}</p></div></div>
        <div class="metric-cells">
        <article v-for="item in displayKpis" :key="item.key" class="metric-card" :class="`metric-${item.key}`">
          <header><span class="kpi-icon"><el-icon><component :is="kpiIcons[item.key]" /></el-icon></span><b>{{ copy.kpis[item.key] }}</b><em>{{ copy.demo }}</em></header>
          <div class="kpi-value">{{ item.value.toLocaleString() }}<small>{{ kpiUnit(item) }}</small></div>
          <footer><span v-for="detail in kpiSecondary(item)" :key="detail.label">{{ detail.label }} <b>{{ detail.value }}</b></span></footer>
        </article>
        </div>
      </section>

      <article class="surface-card analysis-card">
        <header class="card-header analysis-header">
          <div><h2>{{ copy.analysis }} <em>{{ copy.demo }}</em></h2><p>{{ copy.analysisSub }}</p></div>
          <div class="analysis-tabs" role="tablist">
            <button v-for="tab in analysisTabs" :key="tab.key" type="button" :class="{ active: analysisMode === tab.key }" @click="analysisMode = tab.key">{{ tab.label }}</button>
          </div>
        </header>
        <div class="analysis-stats">
          <span v-for="item in analysisStats" :key="item.label"><small>{{ item.label }}</small><strong>{{ item.value }}</strong><i>{{ item.unit }}</i></span>
        </div>
        <div class="analysis-chart"><DsChart :option="analysisOption" /></div>
      </article>

      <aside class="surface-card region-card">
        <header class="rail-header region-header">
          <div><h2>{{ copy.regionTitle }}</h2></div>
          <div class="range-tabs">
            <button v-for="days in ([1, 7, 30] as const)" :key="days" type="button" :class="{ active: loginRange === days }" @click="changeLoginRange(days)">{{ days === 1 ? (isZh ? '今日' : 'Today') : `${days}${isZh ? '天' : 'd'}` }}</button>
          </div>
        </header>
        <div class="region-stats"><span v-for="item in loginRegionStats" :key="item.label"><small>{{ item.label }}</small><b>{{ item.value }}</b></span></div>
        <div class="region-map"><DsChart :option="loginMapOption" /></div>
        <div class="city-ranking">
          <div class="city-ranking__title"><strong>{{ copy.cityRank }}</strong></div>
          <ol v-if="visibleTopLoginCities.length">
            <li v-for="(city, index) in visibleTopLoginCities" :key="`${city.regionName}-${city.cityName}`"><i>{{ index + 1 }}</i><span :title="formatLoginCity(city.regionName, city.cityName)">{{ formatLoginCity(city.regionName, city.cityName) }}</span><b>{{ city.loginCount }}</b></li>
          </ol>
          <div v-else class="region-empty">{{ authStore.can('platform:audit:log:view') ? copy.empty : copy.noAudit }}</div>
          <a class="geo-credit" href="https://db-ip.com" target="_blank" rel="noreferrer">{{ copy.geoCredit }}</a>
        </div>
      </aside>

      <article class="surface-card audit-card">
        <header class="card-header">
          <div>
            <h2>{{ copy.audit }} <em :class="{ 'is-real': !isDemoMode }">{{ isDemoMode ? copy.demo : copy.real }}</em></h2>
            <p>{{ isDemoMode ? (isZh ? '接口模式下展示当前授权范围内的审计记录' : 'Authorized audit records are available in API mode') : copy.auditSub }}</p>
          </div>
          <button v-if="authStore.can('platform:audit:log:view')" type="button" @click="router.push('/settings/audit-log')">{{ copy.more }} →</button>
        </header>
        <div v-if="real.recentOperations.length" class="audit-scroll">
          <div class="audit-table">
            <div class="audit-head"><span>{{ copy.actor }}</span><span>{{ copy.action }}</span><span>{{ copy.module }}</span><span>{{ copy.time }}</span><span>{{ copy.ip }}</span></div>
            <div v-for="row in real.recentOperations" :key="row.id" class="audit-row">
              <span><b>{{ row.actorName || '-' }}</b></span>
              <span><b>{{ actionLabel(row) }}</b><small>{{ moduleLabel(row.resourceType) }}</small></span>
              <span>{{ moduleLabel(row.resourceType) }}</span><time>{{ formatTime(row.occurredAt) }}</time><span>--</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-state"><el-icon><DataAnalysis /></el-icon><span>{{ authStore.can('platform:audit:log:view') ? copy.empty : copy.noAudit }}</span></div>
      </article>
    </div>
    <span v-if="loadError && business" class="workbench-toast" role="status">{{ loadError }}</span>
  </section>
</template>

<style scoped>
.workbench {
  --wb-gap: clamp(14px, 1.1cqw, 18px);
  --wb-radius: 10px;
  width: 100%;
  min-width: 0;
  container: workbench / inline-size;
}
.workbench.is-refreshing::before { position: fixed; z-index: 45; top: 0; left: 0; width: 28%; height: 2px; background: var(--color-primary-500); content: ''; animation: workbench-refresh 900ms ease-in-out infinite; }
.workbench-skeleton { display: grid; min-height: calc(100vh - 130px); grid-template-columns: minmax(0, 1fr) clamp(290px, 22cqw, 326px); grid-template-rows: 258px 200px 360px; gap: var(--wb-gap); }
.workbench-skeleton i { background: linear-gradient(90deg, var(--color-bg-muted, #eef2f7) 24%, var(--color-bg-surface, #fff) 42%, var(--color-bg-muted, #eef2f7) 62%); background-size: 300% 100%; border: 1px solid var(--color-border-default); border-radius: var(--wb-radius); animation: workbench-skeleton 1.25s ease infinite; }
.workbench-skeleton i:nth-child(3), .workbench-skeleton i:nth-child(6), .workbench-skeleton i:nth-child(n+7) { grid-column: 1 / -1; }
.workbench-error { display: flex; min-height: 420px; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: var(--color-text-secondary); background: var(--color-bg-surface); border: 1px solid var(--color-border-default); border-radius: var(--wb-radius); }
.workbench-error strong { color: var(--color-text-primary); font-size: 18px; }.workbench-error button { height: 34px; padding: 0 16px; color: #fff; background: var(--color-primary-500); border: 0; border-radius: 6px; cursor: pointer; }
.workbench-toast { position: fixed; z-index: 45; bottom: 18px; left: 50%; padding: 8px 14px; color: #7a5720; background: #fff8e8; border: 1px solid #ead8af; border-radius: 6px; box-shadow: 0 6px 18px rgb(45 55 70 / 12%); font-size: 12px; transform: translateX(-50%); }
.dashboard-grid {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) clamp(290px, 22cqw, 326px);
  grid-template-areas: "hero health" "metrics metrics" "analysis region" "audit audit";
  gap: var(--wb-gap);
  align-items: stretch;
}
.surface-card {
  min-width: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e3e8f0;
  border-radius: var(--wb-radius);
  box-shadow: 0 6px 18px rgb(30 50 90 / 4%);
}
.hero {
  grid-area: hero;
  min-height: 258px;
  overflow: hidden;
  background-color: #f4f7fd;
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  border: 1px solid #dfe7f3;
  border-radius: var(--wb-radius);
  transition: background-image 120ms ease, background-color 120ms ease;
}
.hero__content { display: flex; width: min(42%, 470px); min-width: 350px; height: 100%; flex-direction: column; justify-content: center; padding: 30px 36px; }
.hero__eyebrow { margin: 0 0 14px; color: #1f62d8; font-size: 13px; font-weight: 700; }
.hero h1 { margin: 0 0 9px; color: #172033; font-size: clamp(26px, 2.15cqw, 34px); line-height: 1.2; }
.hero strong { margin-bottom: 5px; color: #263247; font-size: 14px; }.hero__content > span { color: #6d788b; font-size: 12px; }
.hero__meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }
.hero__meta article { display: flex; min-width: 0; min-height: 52px; align-items: center; gap: 11px; padding: 7px 12px; background: rgb(255 255 255 / 78%); border: 1px solid rgb(215 224 239 / 88%); border-radius: 8px; backdrop-filter: blur(4px); }
.hero__meta .el-icon { width: 20px; height: 20px; flex: 0 0 auto; color: #315fad; font-size: 15px; }
.hero__meta div { display: flex; min-width: 0; flex-direction: column; justify-content: center; gap: 2px; }.hero__meta small { display: block; margin: 0; color: #7a8699; font-size: 10px; line-height: 16px; }.hero__meta b { display: block; overflow: hidden; color: #29364c; font-size: 11px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }

.health-card { min-height: 258px; height: 100%; grid-area: health; }.rail-header, .card-header { display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid #e7ebf2; }
.rail-header { min-height: 58px; padding: 13px 16px; }.rail-header h2, .card-header h2 { margin: 0; color: #1d293d; font-size: 15px; line-height: 22px; }.rail-header p, .card-header p { margin: 2px 0 0; color: #7a8699; font-size: 10px; }
.rail-header > span, .card-header h2 em { display: inline-flex; min-height: 20px; flex: 0 0 auto; align-items: center; padding: 0 7px; color: #277554; background: #f0f7f3; border: 1px solid #dcece4; border-radius: 4px; font-size: 8px; font-style: normal; font-weight: 600; }.rail-header > span.muted { color: #697386; background: #f3f5f8; border-color: #e4e8ee; }.card-header h2 em { margin-left: 6px; color: #53698e; background: #f2f5fa; border-color: #e2e8f1; vertical-align: 2px; }.card-header h2 em.is-real { color: #277554; background: #f0f7f3; border-color: #dcece4; }
.health-body { display: grid; height: calc(100% - 58px); grid-template-columns: minmax(145px, .95fr) minmax(115px, 1fr); align-items: center; padding: 8px 14px 14px 8px; }
.health-chart { height: 158px; min-width: 0; }
.health-legend { display: flex; min-width: 0; flex-direction: column; }
.health-legend span { display: grid; min-height: 39px; grid-template-columns: 7px minmax(0, 1fr) auto; align-items: center; gap: 8px; color: #647084; border-bottom: 1px solid #edf0f5; font-size: 10px; }
.health-legend span:last-child { border-bottom: 0; }
.health-legend i { width: 7px; height: 7px; border-radius: 50%; }.health-legend .normal { background: #35ae79; }.health-legend .minor { background: #dfa23d; }.health-legend .serious { background: #df5e64; }
.health-legend b { color: #253147; font-size: 11px; }.health-limited { margin: 0; color: #8b95a7; font-size: 10px; line-height: 1.7; }

.metrics-panel { grid-area: metrics; }
.metrics-heading { display: flex; min-height: 58px; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 18px; border-bottom: 1px solid #e7ebf2; }
.metrics-heading h2 { margin: 0; color: #1d293d; font-size: 15px; }.metrics-heading p { margin: 3px 0 0; color: #7a8699; font-size: 10px; }.metrics-heading > span { padding: 3px 7px; color: #4b67a5; background: #edf2fb; border-radius: 4px; font-size: 8px; font-weight: 700; }
.metric-cells { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); align-items: stretch; }
.metric-card { display: flex; min-width: 0; min-height: 142px; flex-direction: column; justify-content: space-between; padding: 16px 18px; border-right: 1px solid #e7ebf2; }.metric-card:last-child { border-right: 0; }
.metric-card header { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; align-items: center; gap: 9px; }.kpi-icon { display: grid; width: 18px; height: 18px; place-items: center; color: #315fad; font-size: 15px; }.metric-card header > b { overflow: hidden; color: #3c475a; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }.metric-card header em { color: #8b95a7; font-size: 8px; font-style: normal; }.kpi-value { margin: 13px 0 10px; color: #18243a; font-size: clamp(24px, 1.8cqw, 30px); font-weight: 700; line-height: 1; }.kpi-value small { margin-left: 4px; color: #7b8798; font-size: 9px; font-weight: 400; }.metric-card footer { display: flex; min-height: 18px; flex-wrap: wrap; gap: 5px 12px; color: #7a8699; font-size: 9px; }.metric-card footer b { color: #3d495d; }

.analysis-card { display: flex; min-height: 520px; height: 100%; grid-area: analysis; flex-direction: column; }.card-header { min-height: 68px; padding: 13px 18px; }.card-header button { flex: 0 0 auto; min-height: 32px; padding: 0 12px; color: #526077; background: #fff; border: 1px solid #dfe5ee; border-radius: 6px; cursor: pointer; font-size: 10px; }
.analysis-header { align-items: center; }.analysis-tabs { display: inline-flex; flex: 0 0 auto; padding: 3px; background: #f2f5f9; border-radius: 7px; }.analysis-tabs button { min-width: 64px; border: 0; background: transparent; }.analysis-tabs button.active { color: #245fcb; background: #fff; box-shadow: 0 1px 5px rgb(30 60 110 / 10%); font-weight: 600; }
.analysis-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 20px 22px 8px; }.analysis-stats span { position: relative; min-width: 0; padding: 0 24px; }.analysis-stats span + span::before { position: absolute; top: 8%; bottom: 8%; left: 0; width: 1px; background: #e7ebf2; content: ''; }.analysis-stats small { display: block; margin-bottom: 7px; color: #7a8699; font-size: 10px; }.analysis-stats strong { color: #1d293d; font-size: 24px; }.analysis-stats i { margin-left: 4px; color: #7a8699; font-size: 9px; font-style: normal; }.analysis-chart { min-height: 325px; flex: 1; padding: 0 12px 12px; }

.region-card { display: flex; min-height: 520px; height: 100%; grid-area: region; flex-direction: column; }
.region-header { align-items: flex-start; }.range-tabs { display: inline-flex; flex: 0 0 auto; padding: 2px; background: #f1f4f8; border-radius: 6px; }
.range-tabs button { min-width: 34px; height: 25px; padding: 0 7px; color: #718096; background: transparent; border: 0; border-radius: 5px; cursor: pointer; font-size: 8px; }.range-tabs button.active { color: #245fcb; background: #fff; box-shadow: 0 1px 4px rgb(35 55 90 / 10%); font-weight: 600; }
.region-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 13px 12px 11px; border-bottom: 1px solid #edf0f5; }
.region-stats span { min-width: 0; padding: 0 9px; border-right: 1px solid #e7ebf2; }.region-stats span:last-child { border: 0; }.region-stats small { display: block; overflow: hidden; margin-bottom: 5px; color: #7a8699; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }.region-stats b { color: #1f2b40; font-size: 18px; }
.region-map { min-height: 205px; height: 205px; flex: 0 0 auto; padding: 4px 9px 0; }
.city-ranking { min-height: 0; flex: 1; padding: 10px 16px 12px; border-top: 1px solid #edf0f5; }.city-ranking__title { display: flex; min-height: 26px; align-items: center; }.city-ranking__title strong { color: #344157; font-size: 10px; }
.city-ranking ol { display: grid; margin: 3px 0 0; padding: 0; list-style: none; }.city-ranking li { display: grid; min-height: 25px; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: center; gap: 7px; color: #657187; border-bottom: 1px solid #f0f2f6; font-size: 9px; }.city-ranking li:last-child { border: 0; }.city-ranking li i { display: grid; width: 17px; height: 17px; place-items: center; color: #5574a8; background: #eef3fb; border-radius: 4px; font-size: 8px; font-style: normal; }.city-ranking li span { min-width: 0; overflow: hidden; word-break: keep-all; text-overflow: ellipsis; white-space: nowrap; }.city-ranking li b { color: #2c3950; }.region-empty { display: grid; min-height: 80px; place-items: center; color: #98a2b3; font-size: 9px; }
.geo-credit { display: inline-flex; margin-top: 6px; color: #77849a; font-size: 8px; line-height: 16px; text-decoration: none; }.geo-credit:hover { color: #2f6bcb; text-decoration: underline; }

.audit-card { min-height: 350px; grid-area: audit; }.audit-scroll { width: 100%; overflow-x: auto; padding: 0 0 14px; }.audit-table { width: 100%; min-width: 920px; }.audit-head, .audit-row { display: grid; width: 100%; grid-template-columns: 150px minmax(260px, 1fr) 140px 150px 100px; align-items: center; gap: 16px; padding: 0 18px; }.audit-head { min-height: 42px; color: #6b778b; background: #f7f9fc; border-bottom: 1px solid #e4e9f1; font-size: 10px; }.audit-row { min-height: 50px; border-bottom: 1px solid #e8ecf2; font-size: 10px; }.audit-row:last-child { border-bottom: 0; }.audit-row > span:first-child { display: flex; min-width: 0; align-items: center; }.audit-row > span:nth-child(2) { display: flex; min-width: 0; flex-direction: column; gap: 2px; }.audit-row b, .audit-row small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.audit-row small, .audit-row time, .audit-row > span:nth-child(n+3) { color: #7a8699; font-size: 9px; }.empty-state { display: flex; min-height: 260px; align-items: center; justify-content: center; gap: 8px; color: #98a2b3; font-size: 11px; }
@keyframes workbench-refresh { from { transform: translateX(-110%); } to { transform: translateX(470%); } }
@keyframes workbench-skeleton { from { background-position: 100% 0; } to { background-position: 0 0; } }

.workbench.is-dark { color-scheme: dark; }
.workbench.is-dark .surface-card { background: #111a2e; border-color: #22314a; box-shadow: 0 8px 22px rgb(0 0 0 / 20%); }
.workbench.is-dark .hero { background-color: #081225; border-color: #22314a; box-shadow: 0 8px 22px rgb(0 0 0 / 20%); }
.workbench.is-dark .hero__eyebrow { color: #65a0ff; }
.workbench.is-dark .hero h1,
.workbench.is-dark .hero strong,
.workbench.is-dark .rail-header h2,
.workbench.is-dark .card-header h2,
.workbench.is-dark .metrics-heading h2,
.workbench.is-dark .metric-card header > b,
.workbench.is-dark .kpi-value,
.workbench.is-dark .analysis-stats strong,
.workbench.is-dark .region-stats b,
.workbench.is-dark .city-ranking__title strong,
.workbench.is-dark .city-ranking li b,
.workbench.is-dark .audit-row b,
.workbench.is-dark .health-legend b { color: #eaf0ff; }
.workbench.is-dark .hero__content > span,
.workbench.is-dark .hero__meta small,
.workbench.is-dark .rail-header p,
.workbench.is-dark .card-header p,
.workbench.is-dark .metrics-heading p,
.workbench.is-dark .metric-card footer,
.workbench.is-dark .kpi-value small,
.workbench.is-dark .analysis-stats small,
.workbench.is-dark .analysis-stats i,
.workbench.is-dark .region-stats small,
.workbench.is-dark .city-ranking li,
.workbench.is-dark .geo-credit,
.workbench.is-dark .audit-head,
.workbench.is-dark .audit-row small,
.workbench.is-dark .audit-row time,
.workbench.is-dark .audit-row > span:nth-child(n+3),
.workbench.is-dark .health-legend span,
.workbench.is-dark .health-limited { color: #9ba9c7; }
.workbench.is-dark .hero__meta article { background: rgb(17 26 46 / 78%); border-color: #2a3b58; }
.workbench.is-dark .hero__meta b { color: #eaf0ff; }
.workbench.is-dark .hero__meta .el-icon,
.workbench.is-dark .kpi-icon { color: #78a8ff; }
.workbench.is-dark .rail-header,
.workbench.is-dark .card-header,
.workbench.is-dark .metrics-heading,
.workbench.is-dark .metric-card,
.workbench.is-dark .region-stats,
.workbench.is-dark .region-stats span,
.workbench.is-dark .city-ranking,
.workbench.is-dark .city-ranking li,
.workbench.is-dark .audit-head,
.workbench.is-dark .audit-row { border-color: #22314a; }
.workbench.is-dark .audit-head { background: #162033; }
.workbench.is-dark .analysis-tabs,
.workbench.is-dark .range-tabs { background: #162033; }
.workbench.is-dark .analysis-tabs button,
.workbench.is-dark .range-tabs button { color: #9ba9c7; }
.workbench.is-dark .analysis-tabs button.active,
.workbench.is-dark .range-tabs button.active { color: #78a8ff; background: #22314a; box-shadow: none; }
.workbench.is-dark .rail-header > span,
.workbench.is-dark .card-header h2 em,
.workbench.is-dark .metrics-heading > span { min-height: 20px; color: #8ba3c8; background: #182438; border: 1px solid #293950; box-shadow: none; }
.workbench.is-dark .rail-header > span:not(.muted),
.workbench.is-dark .card-header h2 em.is-real { color: #6cbb91; background: #152a24; border-color: #284439; }
.workbench.is-dark .rail-header > span.muted { color: #919db2; background: #192337; border-color: #2a374d; }
.workbench.is-dark .card-header button { color: #b8c4dc; background: #162033; border-color: #2b3c59; }
.workbench.is-dark .region-map { background: #0f182a; }
.workbench.is-dark .health-legend span { border-color: #22314a; }
.workbench.is-dark .analysis-stats span + span::before { background: #22314a; }
.workbench.is-dark .city-ranking li i { color: #78a8ff; background: #182c4f; }

@container workbench (max-width: 1120px) {
  .dashboard-grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "hero" "health" "metrics" "analysis" "region" "audit"; }
  .health-card { min-height: 230px; }.health-body { grid-template-columns: minmax(170px, .7fr) minmax(180px, 1fr); }.health-chart { height: 150px; }.health-legend { max-width: 320px; }
  .region-card { min-height: 520px; }.region-map { height: 260px; }
}
@container workbench (max-width: 880px) {
  .hero { min-height: 240px; background-position: 58% center; }.hero__content { width: 55%; min-width: 320px; padding: 24px; }
  .metric-cells { grid-template-columns: repeat(3, minmax(0, 1fr)); }.metric-card { min-height: 140px; border-bottom: 1px solid #e7ebf2; }.metric-card:nth-child(3) { border-right: 0; }.metric-card:nth-child(n+4) { border-bottom: 0; }
  .analysis-header { align-items: flex-start; flex-direction: column; }.analysis-tabs { width: 100%; }.analysis-tabs button { flex: 1; }
}
@container workbench (max-width: 620px) {
  .hero { background-position: 64% center; }.hero__content { width: 100%; min-width: 0; background: linear-gradient(90deg, rgb(245 248 254 / 96%) 0%, rgb(245 248 254 / 84%) 64%, transparent 100%); }.hero__meta { grid-template-columns: 1fr; }
  .metric-cells { grid-template-columns: repeat(2, minmax(0, 1fr)); }.metric-card:nth-child(3) { border-right: 1px solid #e7ebf2; }.metric-card:nth-child(2n) { border-right: 0; }.metric-card:nth-child(n+4) { border-bottom: 1px solid #e7ebf2; }.metric-card:last-child { border-bottom: 0; }
  .analysis-stats span { padding: 0 10px; }.analysis-stats strong { font-size: 20px; }.health-body { grid-template-columns: 1fr; }.health-legend { display: grid; grid-template-columns: repeat(3, 1fr); max-width: none; }.analysis-chart { min-height: 270px; }.region-map { height: 230px; }
}
</style>
