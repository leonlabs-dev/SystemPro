<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { EChartsCoreOption } from '@/design-system/charts/echarts-runtime';
import DsChart from '@/design-system/components/DsChart.vue';
import { carbonCockpitApi } from '@/domain/cockpit/carbon-cockpit.api';
import { buildCockpitRuntime } from '@/domain/cockpit/carbon-cockpit.runtime';
import type { CarbonCockpitOverview } from '@/domain/cockpit/carbon-cockpit.types';
import CockpitIcon from './components/CockpitIcon.vue';
import CockpitPanel from './components/CockpitPanel.vue';
import EnergyFlowStage from './components/EnergyFlowStage.vue';
import { preloadImage } from '@/core/assets/image-preload';

const headerFrame = new URL('../../assets/images/pv/cockpit-header-frame.webp', import.meta.url).href;
const deviceAssets = {
  solar: new URL('../../assets/images/pv/cockpit-solar.webp', import.meta.url).href,
  storage: new URL('../../assets/images/pv/cockpit-storage.webp', import.meta.url).href,
  charging: new URL('../../assets/images/pv/cockpit-charging-load.webp', import.meta.url).href,
};
const now = ref(new Date());
const source = ref<CarbonCockpitOverview>(fallbackOverview());
const loadState = ref<'loading' | 'ready' | 'error'>('loading');
const hasLoaded = ref(false);
let clockTimer = 0;
let refreshTimer = 0;
let disposed = false;
let previousTitle = '';
let previousOverflow = '';

const runtime = computed(() => buildCockpitRuntime(source.value, now.value));
const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const dateTime = computed(() => {
  const date = now.value;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}  ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
});

const kpis = computed(() => [
  { key: 'load', icon: 'grid', label: '实时总负荷', value: runtime.value.snapshot.loadPower, unit: 'kW', tone: 'blue', delta: '8.6%' },
  { key: 'pv', icon: 'solar', label: '光伏实时功率', value: runtime.value.snapshot.pvPower, unit: 'kW', tone: 'amber', delta: '12.4%' },
  { key: 'soc', icon: 'storage', label: '储能 SOC', value: runtime.value.snapshot.storageSoc, unit: '%', tone: 'cyan', delta: '3.2%' },
  { key: 'charge', icon: 'charging', label: '充电实时负荷', value: runtime.value.chargingPower, unit: 'kW', tone: 'green', delta: '9.1%' },
  { key: 'carbon', icon: 'carbon', label: '今日减碳量', value: runtime.value.carbonToday, unit: 'tCO₂e', tone: 'green', delta: '15.2%' },
  { key: 'revenue', icon: 'revenue', label: '综合收益', value: runtime.value.snapshot.revenueTotal, unit: '元', tone: 'purple', delta: '11.3%', currency: true },
]);

const energyStructureOption = computed<EChartsCoreOption>(() => {
  const snapshot = runtime.value.snapshot;
  const values = [
    { name: '光伏发电', value: Math.max(1, snapshot.pvToday), itemStyle: { color: '#f8b62c' } },
    { name: '储能放电', value: Math.max(1, Math.max(0, snapshot.storagePower) * 3.8), itemStyle: { color: '#1789ff' } },
    { name: '市电购电', value: Math.max(1, snapshot.gridImportToday), itemStyle: { color: '#4f6cf6' } },
    { name: '充电负荷', value: Math.max(1, runtime.value.chargingEnergyToday), itemStyle: { color: '#23d3c6' } },
    { name: '其他负荷', value: Math.max(1, snapshot.loadToday * 0.16), itemStyle: { color: '#748ab4' } },
  ];
  const total = values.reduce((sum, item) => sum + item.value, 0);
  return {
    animationDuration: 700,
    tooltip: { trigger: 'item', backgroundColor: 'rgba(3,24,56,.94)', borderColor: '#176fc1', textStyle: { color: '#d9ebff' }, formatter: '{b}<br/>{c} kWh · {d}%' },
    legend: { type: 'plain', orient: 'vertical', right: '1%', top: 'center', itemWidth: 9, itemHeight: 9, itemGap: 10, textStyle: { color: '#9eb8d7', fontSize: 11 }, formatter: (name: string) => {
      const item = values.find((entry) => entry.name === name);
      const percent = item ? item.value / total * 100 : 0;
      return `${name}  ${percent.toFixed(1)}%`;
    } },
    series: [{ type: 'pie', radius: ['53%', '75%'], center: ['29%', '53%'], minAngle: 4, avoidLabelOverlap: true, itemStyle: { borderColor: '#051b3c', borderWidth: 2 }, label: { show: false }, data: values }],
    graphic: [{ type: 'group', left: '29%', top: '53%', bounding: 'raw', children: [
      { type: 'text', x: 0, y: -22, style: { text: '总能量', fill: '#8faecc', font: '500 11px "Microsoft YaHei"', textAlign: 'center', textVerticalAlign: 'middle' } },
      { type: 'text', x: 0, y: 0, style: { text: Math.round(total).toLocaleString(), fill: '#e2f1ff', font: '600 17px Bahnschrift', textAlign: 'center', textVerticalAlign: 'middle' } },
      { type: 'text', x: 0, y: 21, style: { text: 'kWh', fill: '#7898b8', font: '500 10px Bahnschrift', textAlign: 'center', textVerticalAlign: 'middle' } },
    ] }],
  };
});

const carbonTrendOption = computed<EChartsCoreOption>(() => {
  const points = runtime.value.trend.filter((_, index) => index % 12 === 0);
  return {
    animationDuration: 500,
    grid: { top: 14, right: 9, bottom: 25, left: 38 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(3,24,56,.94)', borderColor: '#176fc1', textStyle: { color: '#d9ebff' } },
    xAxis: { type: 'category', boundaryGap: false, data: points.map((item) => item.label), axisLine: { lineStyle: { color: '#27517a' } }, axisLabel: { color: '#7899bb', fontSize: 10, interval: 1 }, axisTick: { show: false } },
    yAxis: { type: 'value', name: 'tCO₂e', nameTextStyle: { color: '#6f91b7', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(64,119,170,.18)', type: 'dashed' } }, axisLabel: { color: '#7899bb', fontSize: 10 } },
    series: [{ type: 'line', smooth: true, showSymbol: false, data: points.map((item) => Number(((item.pvPower || 0) * 0.0005703).toFixed(2))), lineStyle: { width: 2, color: '#25dad5' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(30,217,216,.42)' }, { offset: 1, color: 'rgba(30,217,216,0)' }] } } }],
  };
});

const benefitDays = computed(() => Array.from({ length: 7 }, (_, index) => {
  const factor = .68 + Math.sin(index * .82 + 1.4) * .13 + index * .035;
  const date = new Date(now.value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (6 - index));
  const label = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  return { label, value: Number((runtime.value.carbonToday * factor).toFixed(2)) };
}));
const maxBenefit = computed(() => Math.max(...benefitDays.value.map((item) => item.value), 1));

const severityText: Record<string, string> = { CRITICAL: '严重', MAJOR: '重要', MINOR: '一般', WARNING: '预警', INFO: '提示' };
function alarmTime(value: string) { return value ? value.slice(11, 16) : '--:--'; }
function number(value: number, currency = false) {
  const digits = currency ? 2 : value >= 100 ? 1 : value < 10 ? 2 : 1;
  return value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

async function loadOverview() {
  if (loadState.value === 'loading' && hasLoaded.value) return;
  loadState.value = 'loading';
  try {
    const result = await carbonCockpitApi.overview();
    if (!disposed) {
      source.value = result;
      hasLoaded.value = true;
      loadState.value = 'ready';
    }
  } catch {
    if (!disposed) loadState.value = 'error';
  }
}

onMounted(() => {
  previousTitle = document.title;
  previousOverflow = document.body.style.overflow;
  document.title = '双碳·光储充一体化能源驾驶舱';
  document.body.style.overflow = 'hidden';
  clockTimer = window.setInterval(() => { now.value = new Date(); }, 1_000);
  refreshTimer = window.setInterval(loadOverview, 30_000);
  void Promise.all([headerFrame, ...Object.values(deviceAssets)].map((url) => preloadImage(url))).catch(() => undefined);
  void loadOverview();
});

onBeforeUnmount(() => {
  disposed = true;
  window.clearInterval(clockTimer);
  window.clearInterval(refreshTimer);
  document.title = previousTitle;
  document.body.style.overflow = previousOverflow;
});

function fallbackOverview(): CarbonCockpitOverview {
  return {
    siteName: '智慧零碳园区',
    solar: { total: 1, active: 1, disabled: 0, assetCount: 12, serviceSpaceCount: 1, primarySystemId: 'solar-cockpit', primaryCapacity: 860, mode: 'SELF_USE_SURPLUS_EXPORT' },
    storage: { total: 1, active: 1, disabled: 0, assetCount: 8, serviceSpaceCount: 1, primarySystemId: 'storage-cockpit', primaryCapacity: 520, secondaryCapacity: 1040, mode: 'GRID_CONNECTED' },
    charging: { total: 1, active: 1, disabled: 0, assetCount: 16, serviceSpaceCount: 1, primarySystemId: 'charging-cockpit', primaryCapacity: 420, mode: 'PUBLIC' },
    alarms: {
      openEventCount: 0,
      criticalOpenEventCount: 0,
      affectedAssetCount: 0,
      solarAffectedAssetCount: 0,
      storageAffectedAssetCount: 0,
      chargingAffectedAssetCount: 0,
    },
    telemetryQuality: 'SIMULATED',
    recentAlarms: [],
    generatedAt: new Date().toISOString(),
  };
}
</script>

<template>
  <main class="carbon-cockpit" :class="[`is-${loadState}`, { 'has-data': hasLoaded }]" :aria-busy="loadState === 'loading'">
    <header class="cockpit-header">
      <img class="cockpit-header__frame" :src="headerFrame" alt="" decoding="async" fetchpriority="high" />
      <div class="cockpit-header__meta">数据更新 {{ source.generatedAt ? new Date(source.generatedAt).toLocaleString('zh-CN', { hour12: false }) : '尚未同步' }}</div>
      <div class="cockpit-header__title"><h1>双碳 · 光储充一体化能源驾驶舱</h1><p>Carbon Neutrality · PV–Storage–Charging Smart Energy Cockpit</p></div>
      <div class="cockpit-header__status"><time>{{ dateTime }}</time><span class="cockpit-header__weekday">{{ weekdays[now.getDay()] }}</span><span class="system-state"><i />运行正常</span></div>
    </header>

    <div v-if="loadState === 'loading' && !hasLoaded" class="carbon-skeleton" role="status" aria-label="正在加载能源运行数据"><i v-for="index in 15" :key="index" /></div>
    <div v-else-if="loadState === 'error' && !hasLoaded" class="carbon-error" role="alert"><strong>能源运行数据暂时不可用</strong><span>请检查数据服务后重试，系统不会用虚构零值替代真实结果。</span><button type="button" @click="loadOverview">重新加载</button></div>

    <section v-show="hasLoaded" class="cockpit-kpis" aria-label="核心指标">
      <article v-for="item in kpis" :key="item.key" class="cockpit-kpi" :class="[`is-${item.tone}`, { 'is-revenue': item.currency }]">
        <span class="cockpit-kpi__icon"><CockpitIcon :name="item.icon as any" /></span>
        <div class="cockpit-kpi__content"><span>{{ item.label }}</span><strong><template v-if="item.currency">¥ </template>{{ number(item.value, item.currency) }}<small>{{ item.unit }}</small></strong><em>较昨日同期 <i>▲</i> {{ item.delta }}</em></div>
      </article>
    </section>

    <section v-show="hasLoaded" class="cockpit-grid">
      <div class="cockpit-column cockpit-column--left">
        <CockpitPanel title="双碳总览">
          <div class="carbon-summary">
            <div><span>今日碳排放</span><strong>{{ number(runtime.snapshot.loadToday * .00057) }}</strong><small>tCO₂e</small></div>
            <div><span>累计减碳</span><strong>{{ number(runtime.carbonTotal) }}</strong><small>tCO₂e</small></div>
            <div><span>绿电占比</span><strong>{{ number(runtime.snapshot.selfUseRate) }}</strong><small>%</small></div>
            <div><span>碳强度</span><strong>{{ number(runtime.snapshot.loadToday ? runtime.snapshot.loadToday * .00018 : 0) }}</strong><small>tCO₂e/MWh</small></div>
          </div>
        </CockpitPanel>
        <CockpitPanel title="能源结构"><DsChart :option="energyStructureOption" /></CockpitPanel>
        <CockpitPanel title="近24小时碳排趋势"><DsChart :option="carbonTrendOption" /></CockpitPanel>
      </div>

      <div class="cockpit-column cockpit-column--center">
        <section class="energy-flow-panel">
          <EnergyFlowStage
            :pv-power="runtime.snapshot.pvPower"
            :grid-power="runtime.snapshot.gridPower"
            :storage-power="runtime.snapshot.storagePower"
            :building-power="runtime.buildingPower"
            :other-power="runtime.otherPower"
            :charging-power="runtime.chargingPower"
          />
        </section>
        <CockpitPanel title="节能收益与减碳成效（今日）">
          <div class="benefit-panel">
            <div class="benefit-panel__metric is-carbon"><span class="benefit-panel__icon"><CockpitIcon name="carbon" /></span><span>减碳量<strong>{{ number(runtime.carbonToday) }}<small> tCO₂e</small></strong><em>≈ 种植树木 {{ runtime.trees }} 棵</em></span></div>
            <div class="benefit-panel__metric is-money"><span class="benefit-panel__icon"><CockpitIcon name="revenue" /></span><span>节能收益<strong>¥ {{ number(runtime.snapshot.revenueToday, true) }}</strong><em>较昨日 <b>▲ 11.3%</b></em></span></div>
            <div class="benefit-panel__trend"><header>近7日减碳量趋势 <small>tCO₂e</small></header><div class="benefit-bars"><div v-for="item in benefitDays" :key="item.label" class="benefit-bar"><span>{{ item.value }}</span><i :style="{ height: `${Math.max(18, item.value / maxBenefit * 86)}%` }" /><em>{{ item.label }}</em></div></div></div>
          </div>
        </CockpitPanel>
      </div>

      <div class="cockpit-column cockpit-column--right">
        <CockpitPanel title="设备运行概览">
          <div class="device-overview">
            <article><img class="device-overview__asset" :src="deviceAssets.solar" alt="" decoding="async" /><div><span>光伏逆变器</span><strong>{{ source.solar.assetCount }}<small> 台</small></strong><em>正常 {{ Math.max(0, source.solar.assetCount - source.alarms.solarAffectedAssetCount) }}　/　告警 {{ source.alarms.solarAffectedAssetCount }}</em></div></article>
            <article><img class="device-overview__asset" :src="deviceAssets.storage" alt="" decoding="async" /><div><span>储能柜</span><strong>{{ source.storage.assetCount }}<small> 台</small></strong><em>正常 {{ Math.max(0, source.storage.assetCount - source.alarms.storageAffectedAssetCount) }}　/　告警 {{ source.alarms.storageAffectedAssetCount }}</em></div></article>
            <article><img class="device-overview__asset" :src="deviceAssets.charging" alt="" decoding="async" /><div><span>充电桩</span><strong>{{ source.charging.assetCount }}<small> 台</small></strong><em>正常 {{ Math.max(0, source.charging.assetCount - source.alarms.chargingAffectedAssetCount) }}　/　告警 {{ source.alarms.chargingAffectedAssetCount }}</em></div></article>
            <article><span class="device-overview__icon is-red"><CockpitIcon name="alarm" /></span><div><span>告警设备</span><strong>{{ source.alarms.affectedAssetCount }}<small> 台</small></strong><em>当前未恢复告警涉及设备</em></div></article>
          </div>
        </CockpitPanel>
        <CockpitPanel title="充电运营">
          <div class="charging-ops">
            <div><span>充电桩总数</span><strong>{{ source.charging.assetCount }}<small> 台</small></strong></div><div><span>空闲 / 充电中</span><strong>{{ Math.max(0, source.charging.assetCount - Math.ceil(source.charging.assetCount * .52)) }} / {{ Math.ceil(source.charging.assetCount * .52) }}<small> 台</small></strong></div><div><span>今日充电次数</span><strong>{{ runtime.chargingToday }}<small> 次</small></strong></div><div><span>今日充电量</span><strong>{{ number(runtime.chargingEnergyToday, true) }}<small> kWh</small></strong></div>
          </div>
        </CockpitPanel>
        <CockpitPanel title="告警中心">
          <div v-if="source.recentAlarms.length" class="alarm-list">
            <article v-for="alarm in source.recentAlarms" :key="alarm.code"><span class="alarm-list__level" :class="`is-${alarm.severity.toLowerCase()}`">{{ severityText[alarm.severity] || '提示' }}</span><div><strong>{{ alarm.title }}</strong><small>{{ alarm.assetName || alarm.code }}</small></div><time>{{ alarmTime(alarm.occurredAt) }}</time></article>
          </div>
          <div v-else class="alarm-empty"><strong>当前无活动告警</strong><small>设备与链路运行状态正常</small></div>
        </CockpitPanel>
      </div>
    </section>

    <span v-if="loadState === 'error' && hasLoaded" class="cockpit-data-state">刷新失败，当前保留上次成功结果并自动重试</span>
  </main>
</template>

<style scoped>
:global(html), :global(body), :global(#app) { width: 100%; height: 100%; margin: 0; }
.carbon-cockpit { --header-height: clamp(62px, 7.2vh, 78px); --kpi-height: clamp(96px, 10.8vh, 116px); position: relative; width: 100vw; height: 100dvh; min-width: 1024px; min-height: 650px; overflow: hidden; color: #dbeeff; background: #031124; font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; }
.carbon-cockpit::before { position: absolute; inset: 0; background: linear-gradient(180deg, rgb(20 61 105 / 10%), transparent 28%); content: ''; pointer-events: none; }
.carbon-cockpit__ambient { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, rgb(0 62 145 / 19%), transparent 52%); pointer-events: none; }
.cockpit-header { position: relative; z-index: 3; height: var(--header-height); box-sizing: border-box; background: #061a35; border-bottom: 1px solid rgb(53 94 136 / 48%); }
.cockpit-header__frame { position: absolute; z-index: 0; inset: 0; width: 100%; height: 100%; object-fit: fill; pointer-events: none; }
.cockpit-header__meta { position: absolute; z-index: 1; top: 0; left: clamp(18px, 1.5vw, 30px); display: flex; height: 64%; align-items: center; color: #7899bb; font-size: clamp(9px, .6vw, 12px); white-space: nowrap; }
.cockpit-header__title { position: absolute; z-index: 1; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; text-align: center; pointer-events: none; }.cockpit-header__title h1 { margin: 0; color: #edf7ff; font-family: "Microsoft YaHei", sans-serif; font-size: clamp(20px, 1.5vw, 29px); font-weight: 650; letter-spacing: .08em; line-height: 1.15; text-shadow: 0 0 14px rgb(71 145 255 / 48%); }.cockpit-header__title p { margin: 3px 0 0; color: #7fa6ce; font-size: clamp(8px, .53vw, 10px); line-height: 1; letter-spacing: .04em; }
.cockpit-header__status { position: absolute; z-index: 2; top: 0; right: clamp(18px, 1.5vw, 30px); display: flex; height: 64%; align-items: center; gap: clamp(8px, .7vw, 14px); color: #7899bb; font-size: clamp(9px, .6vw, 12px); white-space: nowrap; }.cockpit-header__status time { color: #b9cce1; font-family: Bahnschrift, monospace; font-variant-numeric: tabular-nums; }.system-state { display: flex; align-items: center; gap: 6px; color: #4fc394; }.system-state i { width: 7px; height: 7px; background: #35b47f; border-radius: 50%; }
.carbon-skeleton { position: relative; z-index: 2; display: grid; height: calc(100dvh - var(--header-height)); box-sizing: border-box; grid-template-columns: repeat(6, minmax(0, 1fr)); grid-template-rows: var(--kpi-height) repeat(3, minmax(0, 1fr)); gap: clamp(8px, .7vw, 14px); padding: 10px clamp(18px, 1.5vw, 30px) 18px; }.carbon-skeleton i { background: linear-gradient(90deg,#08203d 25%,#0d2a4c 42%,#08203d 62%); background-size:300% 100%; border:1px solid rgb(53 94 136 / 38%); border-radius:3px; animation:carbon-shimmer 1.3s ease infinite}.carbon-skeleton i:nth-child(n+7){grid-column:span 2}.carbon-error { position: relative; z-index: 2; display:flex; height:calc(100dvh - var(--header-height)); align-items:center; justify-content:center; flex-direction:column; gap:10px; color:#7f9fbe}.carbon-error strong{color:#dbe9f6;font-size:18px}.carbon-error button{height:34px;padding:0 16px;color:#fff;background:#286db3;border:0;border-radius:4px;cursor:pointer}@keyframes carbon-shimmer{from{background-position:100% 0}to{background-position:0 0}}
.cockpit-kpis { position: relative; z-index: 2; display: grid; height: var(--kpi-height); min-height: 0; box-sizing: border-box; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: clamp(8px, .65vw, 13px); padding: 8px clamp(18px, 1.5vw, 30px) 12px; }
.cockpit-kpi { display: flex; min-width: 0; min-height: 0; box-sizing: border-box; align-items: center; gap: clamp(8px, .7vw, 14px); overflow: hidden; padding: 10px clamp(10px, .8vw, 16px); background: linear-gradient(135deg, rgb(5 37 75 / 92%), rgb(2 20 48 / 88%)); border-radius: 5px; box-shadow: inset 0 0 22px rgb(0 105 218 / 8%), 0 8px 24px rgb(0 5 18 / 16%); }.cockpit-kpi__icon { display: grid; width: clamp(44px, 3.2vw, 60px); height: clamp(44px, 3.2vw, 60px); box-sizing: border-box; flex: 0 0 clamp(44px, 3.2vw, 60px); place-items: center; padding: 8px; color: #23a9ff; background: radial-gradient(circle, rgb(4 95 183 / 48%), rgb(2 26 63 / 72%) 65%); border-radius: 50%; box-shadow: inset 0 0 12px rgb(25 144 255 / 28%); }.cockpit-kpi.is-amber .cockpit-kpi__icon { color: #ffb623; }.cockpit-kpi.is-green .cockpit-kpi__icon { color: #2ce2bd; }.cockpit-kpi.is-purple .cockpit-kpi__icon { color: #8e83ff; }
.cockpit-kpi__content { display: flex; min-width: 0; flex: 1; flex-direction: column; }.cockpit-kpi__content > span { overflow: hidden; color: #c5d9ee; font-size: clamp(11px, .72vw, 14px); text-overflow: ellipsis; white-space: nowrap; }.cockpit-kpi strong { display: flex; min-width: 0; align-items: baseline; color: #d8ecff; font-family: Bahnschrift, "DIN Alternate", sans-serif; font-size: clamp(20px, 1.65vw, 31px); font-weight: 500; letter-spacing: .05em; line-height: 1.25; white-space: nowrap; }.cockpit-kpi.is-revenue strong { font-size: clamp(16px, 1.32vw, 25px); letter-spacing: .02em; }.cockpit-kpi small { margin-left: 6px; flex: 0 0 auto; color: #89a7c5; font-size: clamp(9px, .6vw, 12px); font-weight: 400; letter-spacing: 0; }.cockpit-kpi em { color: #7393b5; font-size: clamp(9px, .58vw, 11px); font-style: normal; white-space: nowrap; }.cockpit-kpi em i { color: #25ddc8; font-style: normal; }
.cockpit-grid { position: relative; z-index: 2; display: grid; height: calc(100dvh - var(--header-height) - var(--kpi-height)); min-height: 0; box-sizing: border-box; grid-template-columns: minmax(260px, 22fr) minmax(570px, 54fr) minmax(300px, 26fr); gap: clamp(10px, .75vw, 15px); padding: 0 clamp(18px, 1.5vw, 30px) clamp(14px, 1.4vh, 18px); }
.cockpit-column { display: grid; min-width: 0; min-height: 0; gap: clamp(8px, .7vh, 11px); }.cockpit-column--left { grid-template-rows: .9fr 1.05fr 1fr; }.cockpit-column--center { grid-template-rows: minmax(0, 2.6fr) minmax(146px, 1fr); }.cockpit-column--right { grid-template-rows: 1.08fr .82fr 1fr; }.energy-flow-panel { min-width: 0; min-height: 0; overflow: hidden; }
.carbon-summary { display: grid; height: 100%; min-height: 0; grid-template-columns: 1fr 1fr; gap: 9px; }.carbon-summary div { display: grid; min-width: 0; min-height: 0; box-sizing: border-box; grid-template-columns: 1fr auto; grid-template-rows: auto 1fr; align-items: end; padding: 9px 12px; background: linear-gradient(135deg, rgb(6 43 82 / 70%), rgb(5 28 61 / 42%)); border-radius: 4px; }.carbon-summary span { grid-column: 1 / 3; color: #819fbe; font-size: clamp(10px, .67vw, 13px); }.carbon-summary strong { color: #2be0d8; font-family: Bahnschrift, sans-serif; font-size: clamp(19px, 1.45vw, 27px); font-weight: 500; }.carbon-summary small { padding-bottom: 4px; color: #83a4c4; font-size: 10px; white-space: nowrap; }
.benefit-panel { display: grid; height: 100%; grid-template-columns: .82fr .96fr 2.2fr; align-items: stretch; gap: clamp(8px, .8vw, 16px); }.benefit-panel__metric { display: flex; align-items: center; gap: 9px; padding: 4px 8px; }.benefit-panel__icon { width: clamp(34px, 2.8vw, 52px); height: clamp(34px, 2.8vw, 52px); flex: 0 0 clamp(34px, 2.8vw, 52px); padding: 7px; color: #25dfc0; background: radial-gradient(circle, rgb(11 105 121 / 55%), transparent 68%); border-radius: 50%; }.benefit-panel__metric.is-money .benefit-panel__icon { color: #f4b735; }.benefit-panel__metric > span:last-child { display: flex; flex-direction: column; color: #85a3c3; font-size: 11px; }.benefit-panel__metric strong { margin-top: 2px; color: #d9edff; font-family: Bahnschrift, sans-serif; font-size: clamp(16px, 1.25vw, 24px); font-weight: 500; white-space: nowrap; }.benefit-panel__metric strong small { color: #80a0c2; font-size: 10px; }.benefit-panel__metric em { color: #6f91b4; font-size: 10px; font-style: normal; white-space: nowrap; }.benefit-panel__metric em b { color: #2be0c4; font-weight: 500; }.benefit-panel__trend { display: flex; min-width: 0; flex-direction: column; }.benefit-panel__trend header { display: flex; justify-content: space-between; color: #9cb7d4; font-size: 11px; }.benefit-panel__trend header small { color: #6386ab; }.benefit-bars { display: flex; min-height: 0; flex: 1; align-items: end; justify-content: space-around; border-bottom: 1px solid rgb(40 111 175 / 30%); }.benefit-bar { display: flex; width: 11%; height: 100%; align-items: center; justify-content: flex-end; flex-direction: column; gap: 3px; }.benefit-bar span { color: #9ebcdb; font-family: Bahnschrift, sans-serif; font-size: 9px; }.benefit-bar i { width: 52%; max-width: 20px; min-height: 8px; background: linear-gradient(180deg, #23dcb1, #096fe1 72%, rgb(5 70 151 / 18%)); border-radius: 2px 2px 0 0; box-shadow: 0 0 8px rgb(21 143 255 / 28%); }.benefit-bar em { color: #5e7da0; font-size: 9px; font-style: normal; white-space: nowrap; }
.device-overview { display: grid; height: 100%; min-height: 0; box-sizing: border-box; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 10px; }.device-overview article { display: flex; min-width: 0; min-height: 0; box-sizing: border-box; align-items: center; gap: 10px; padding: 8px 10px; background: linear-gradient(135deg, rgb(5 44 84 / 62%), rgb(4 27 59 / 38%)); border-radius: 4px; }.device-overview__asset { width: clamp(40px, 3.4vw, 62px); height: clamp(40px, 3.4vw, 62px); flex: 0 0 clamp(40px, 3.4vw, 62px); object-fit: contain; filter: drop-shadow(0 4px 8px rgb(0 104 222 / 20%)); }.device-overview__icon { width: clamp(32px, 2.7vw, 49px); height: clamp(32px, 2.7vw, 49px); flex: 0 0 clamp(32px, 2.7vw, 49px); padding: 6px; color: #25aaff; background: radial-gradient(circle, rgb(5 103 192 / 45%), transparent 70%); }.device-overview__icon.is-red { color: #ff5662; }.device-overview article div { display: flex; min-width: 0; flex-direction: column; }.device-overview article div > span { overflow: hidden; color: #9ab6d3; font-size: clamp(10px, .67vw, 13px); text-overflow: ellipsis; white-space: nowrap; }.device-overview strong { color: #2aaeff; font-family: Bahnschrift, sans-serif; font-size: clamp(18px, 1.35vw, 25px); font-weight: 500; }.device-overview strong small { color: #7c9abb; font-size: 10px; }.device-overview em { overflow: hidden; color: #7694b3; font-size: 9px; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.charging-ops { display: grid; height: 100%; grid-template-columns: 1fr 1fr; }.charging-ops div { display: flex; align-items: center; justify-content: center; flex-direction: column; border-right: 1px solid rgb(42 111 176 / 24%); border-bottom: 1px solid rgb(42 111 176 / 24%); }.charging-ops div:nth-child(2n) { border-right: 0; }.charging-ops div:nth-child(n+3) { border-bottom: 0; }.charging-ops span { color: #8ba8c6; font-size: clamp(10px, .68vw, 13px); }.charging-ops strong { color: #2bdbd0; font-family: Bahnschrift, sans-serif; font-size: clamp(17px, 1.35vw, 25px); font-weight: 500; }.charging-ops small { color: #7797b8; font-size: 9px; }
.alarm-list { display: grid; height: 100%; min-height: 0; box-sizing: border-box; grid-template-rows: repeat(4, minmax(0, 1fr)); padding: 2px 8px 4px; }.alarm-list article { display: grid; min-height: 0; box-sizing: border-box; grid-template-columns: 38px minmax(0, 1fr) 42px; align-items: center; gap: 10px; padding: 5px 1px; border-bottom: 1px solid rgb(50 111 167 / 21%); }.alarm-list article:last-child { border-bottom: 0; }.alarm-list__level { display: grid; width: 38px; height: 22px; box-sizing: border-box; place-items: center; color: #ffd35c; background: rgb(142 100 0 / 35%); border: 1px solid rgb(235 174 29 / 50%); border-radius: 12px; font-size: 9px; }.alarm-list__level.is-critical { color: #ff7e86; background: rgb(142 16 26 / 30%); border-color: rgb(240 70 79 / 55%); }.alarm-list article div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }.alarm-list strong { overflow: hidden; color: #c6d7e8; font-size: clamp(10px, .68vw, 13px); font-weight: 500; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }.alarm-list small { overflow: hidden; color: #6686a7; font-size: clamp(9px, .54vw, 10px); line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }.alarm-list time { color: #7594b2; font-family: Bahnschrift, sans-serif; font-size: 10px; font-variant-numeric: tabular-nums; text-align: right; }.alarm-empty { display: flex; height: 100%; align-items: center; justify-content: center; flex-direction: column; gap: 5px; color: #38dfaa; }.alarm-empty span { display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid rgb(55 216 169 / 50%); border-radius: 50%; box-shadow: inset 0 0 12px rgb(28 204 151 / 24%); font-size: 21px; }.alarm-empty strong { color: #a9c9c8; font-size: 13px; font-weight: 500; }.alarm-empty small { color: #5b7e91; font-size: 10px; }
.cockpit-data-state { position: fixed; z-index: 5; bottom: 5px; left: 50%; padding: 3px 10px; color: #dcae52; background: rgb(53 31 5 / 75%); border: 1px solid rgb(182 122 18 / 35%); border-radius: 11px; font-size: 10px; transform: translateX(-50%); }
.cockpit-kpi { background: #061a35; border: 1px solid rgb(53 94 136 / 44%); border-radius: 3px; box-shadow: none; }.cockpit-kpi__icon { width: clamp(36px, 2.7vw, 48px); height: clamp(36px, 2.7vw, 48px); flex-basis: clamp(36px, 2.7vw, 48px); padding: 7px; color: #4c8fd5; background: #092747; border: 1px solid rgb(57 105 151 / 45%); border-radius: 4px; box-shadow: none; }.cockpit-kpi.is-amber .cockpit-kpi__icon { color: #d4a743; }.cockpit-kpi.is-green .cockpit-kpi__icon { color: #45b997; }.cockpit-kpi.is-purple .cockpit-kpi__icon { color: #8d82d8; }
.carbon-summary div, .device-overview article { background: #08213f; border: 1px solid rgb(53 94 136 / 28%); border-radius: 3px; }
.device-overview__asset { filter: none; }.device-overview__icon { background: #092747; border-radius: 4px; }
.alarm-empty span { display: none; }
@media (max-width: 1450px) { .cockpit-grid { grid-template-columns: minmax(245px, 22fr) minmax(550px, 55fr) minmax(270px, 25fr); }.cockpit-kpi__content strong { letter-spacing: .02em; }.cockpit-header__status { gap: 7px; }.cockpit-header__meta { display: none; }.benefit-panel { grid-template-columns: .8fr .92fr 2fr; }.benefit-panel__metric { gap: 5px; padding: 2px 3px; } }
@media (max-width: 1180px) { .cockpit-header__weekday { display: none; }.cockpit-header__title h1 { font-size: 19px; letter-spacing: .04em; }.cockpit-header__title p { display: none; } }
@media (max-height: 800px) { .carbon-cockpit { --header-height: 72px; --kpi-height: 102px; }.cockpit-kpis { padding-top: 6px; padding-bottom: 9px; }.carbon-summary { gap: 5px; }.carbon-summary div { padding: 5px 8px; }.device-overview { gap: 5px; }.device-overview article { gap: 5px; padding: 4px 6px; }.alarm-list article { padding: 3px 2px; }.benefit-panel__icon { width: 32px; height: 32px; flex-basis: 32px; } }
</style>
