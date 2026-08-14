<script setup lang="ts">
import {
  BellFilled, Briefcase, DataAnalysis, LocationFilled,
  Monitor, OfficeBuilding, Opportunity, TrendCharts,
} from '@element-plus/icons-vue';
import chinaGeoJson from 'china-geojson/src/geojson/china.json';
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue';
import DsChart from '@/design-system/components/DsChart.vue';
import { echarts, type EChartsCoreOption } from '@/design-system/charts/echarts-runtime';
import { operationsCockpitApi } from '@/domain/cockpit/operations-cockpit.api';
import type { OperationsCockpitOverview } from '@/domain/cockpit/operations-cockpit.types';
import OperationsPanel from './components/OperationsPanel.vue';

echarts.registerMap('operations-china', chinaGeoJson as never);

const loading = ref(true);
const error = ref('');
const overview = ref<OperationsCockpitOverview | null>(null);
const now = ref(new Date());
let clockTimer = 0;
let refreshTimer = 0;

const empty: OperationsCockpitOverview = {
  summary: { projectCount: 0, provinceCount: 0, cityCount: 0, deviceCount: 0, enabledRate: 0, occurredTodayAlarmCount: 0, currentRiskCount: 0 },
  projects: { planning: 0, delivery: 0, operating: 0, completed: 0, tenantCount: 0, serviceAreaSquareMeters: 0 },
  projectTypes: [], regions: [], mapPoints: [],
  finance: { billedAmount: 0, receivedAmount: 0, outstandingAmount: 0, collectionRate: 0 },
  risks: [], devices: { enabledDevices: 0, unavailableDevices: 0, alarmAffectedDevices: 0, openWorkOrders: 0 },
  projectTrend: [], alarmTrend: [], energyTrend: [],
  energyMetadata: { currentPeriod: '近 7 个自然日', comparisonPeriod: '各自然日向前 7 天同期', sourceUnit: 'kWh', displayUnit: '万 kWh', displayDivisor: 10_000 },
  generatedAt: '',
};
const data = computed(() => overview.value ?? empty);
const initialLoading = computed(() => loading.value && !overview.value);
const generatedAt = computed(() => {
  const raw = overview.value?.generatedAt;
  if (!raw) return '尚未完成首次同步';
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? raw : value.toLocaleString('zh-CN', { hour12: false });
});
const number = new Intl.NumberFormat('zh-CN');
const money = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function escapeTooltipText(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}

const kpis = computed<Array<{ label: string; value: string; unit: string; note: string; icon: Component; tone: string }>>(() => [
  { label: '项目总数', value: number.format(data.value.summary.projectCount), unit: '个', note: '纳入运营视图的项目', icon: OfficeBuilding, tone: 'blue' },
  { label: '覆盖省份', value: number.format(data.value.summary.provinceCount), unit: '个', note: `覆盖城市 ${data.value.summary.cityCount} 个`, icon: LocationFilled, tone: 'cyan' },
  { label: '服务租户', value: number.format(data.value.projects.tenantCount), unit: '家', note: '有效项目空间 / 服务关系去重', icon: Briefcase, tone: 'indigo' },
  { label: '设备总数', value: number.format(data.value.summary.deviceCount), unit: '台', note: '已纳入设备资产台账', icon: Monitor, tone: 'blue' },
  { label: '设备启用率', value: data.value.summary.enabledRate.toFixed(2), unit: '%', note: '启用设备 / 设备总数', icon: TrendCharts, tone: 'cyan' },
  { label: '今日发生告警', value: number.format(data.value.summary.occurredTodayAlarmCount), unit: '起', note: '今日 00:00–24:00 按发生时间', icon: BellFilled, tone: 'red' },
]);

const projectStages = computed(() => [
  ['规划中', data.value.projects.planning, '#397cf0'], ['交付中', data.value.projects.delivery, '#30b9c2'],
  ['运营中', data.value.projects.operating, '#6557ed'], ['已完成', data.value.projects.completed, '#f2a431'],
] as const);
const displayedRegions = computed(() => data.value.regions);

const projectTypeOption = computed<EChartsCoreOption>(() => ({
  color: ['#2f78ee','#27c2b0','#7456ec','#f2a431','#8aa1ce','#68a4f7'],
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 个 · {d}%' },
  legend: { type:'scroll', orient:'vertical', right:8, top:'middle', itemWidth:8, itemHeight:8, textStyle:{color:'#57709b',fontSize:11}, formatter:(name:string) => name },
  series: [{ type:'pie', radius:['48%','70%'], center:['30%','52%'], avoidLabelOverlap:true, label:{show:false}, emphasis:{scaleSize:4}, data:data.value.projectTypes.map(item=>({name:item.name,value:item.count})) }],
}));

const regionMax = computed(() => Math.max(1, ...data.value.regions.map(item => item.count)));

const mapOption = computed<EChartsCoreOption>(() => ({
  tooltip: { trigger:'item', backgroundColor:'rgba(255,255,255,.98)', borderColor:'#b7cff8', textStyle:{color:'#23416f'}, formatter:(params:any) => {
    if (params.seriesType !== 'effectScatter') return escapeTooltipText(params.name);
    const point = params.data ?? {};
    const projectName = escapeTooltipText(point.projectName || point.name);
    const provinceName = escapeTooltipText(point.provinceName);
    const cityName = escapeTooltipText(point.cityName);
    const location = [provinceName, cityName].filter(Boolean).join(' · ');
    return `<strong>${projectName}</strong><br/>${location}<br/>设备 ${number.format(Number(point.deviceCount || 0))} 台 · 租户 ${number.format(Number(point.tenantCount || 0))} 家`;
  } },
  geo: { map:'operations-china', roam:false, left:'12%', right:'2%', top:'2%', bottom:'2%', label:{show:false}, itemStyle:{areaColor:'#e7f0ff',borderColor:'#a9c7fb',borderWidth:1}, emphasis:{itemStyle:{areaColor:'#d8e8ff'},label:{show:false}} },
  series: [{ type:'effectScatter', coordinateSystem:'geo', symbolSize:(value:any[]) => Math.max(8, Math.min(22, 8 + Number(value[2] || 0) * 1.4)), rippleEffect:{scale:2.8,brushType:'stroke'}, itemStyle:{color:'#317cf3',shadowBlur:10,shadowColor:'rgba(49,124,243,.6)'}, data:data.value.mapPoints.map(item=>({ name:item.projectName, value:[item.longitude,item.latitude,item.deviceCount], ...item })) }],
}));

const riskOption = computed<EChartsCoreOption>(() => ({
  color:['#ff5a52','#f4a72c','#397cf0','#9aafd2'], tooltip:{trigger:'item'},
  legend:{orient:'vertical',right:18,top:'middle',itemWidth:9,itemHeight:9,textStyle:{color:'#587098',fontSize:11}},
  series:[{type:'pie',radius:['52%','72%'],center:['30%','52%'],label:{show:false},data:data.value.risks.map(item=>({name:item.name,value:item.count}))}],
}));

function dates<T extends { date: string }>(rows:T[]) { return rows.map(row=>row.date.slice(5)); }
const energyAvailability = computed(() => {
  const rows = data.value.energyTrend;
  const hasCurrent = rows.some(item => item.currentAvailability === 'AVAILABLE');
  const hasPrevious = rows.some(item => item.previousAvailability === 'AVAILABLE');
  if (!hasCurrent && !hasPrevious) return 'MISSING';
  if (!hasCurrent) return 'CURRENT_MISSING';
  if (!hasPrevious) return 'PREVIOUS_MISSING';
  return 'AVAILABLE';
});
const energyAvailabilityMessage = computed(() => {
  if (energyAvailability.value === 'CURRENT_MISSING') return '本期暂无计量数据';
  if (energyAvailability.value === 'PREVIOUS_MISSING') return '同期暂无计量数据';
  return '';
});
const projectTrendOption = computed<EChartsCoreOption>(() => ({
  color:['#2f78ee','#29bca9'], tooltip:{trigger:'axis'}, legend:{right:8,top:0,itemWidth:10,itemHeight:6,textStyle:{color:'#677da3',fontSize:10}}, grid:{left:34,right:34,top:34,bottom:24}, xAxis:{type:'category',data:dates(data.value.projectTrend),axisLine:{lineStyle:{color:'#ccd9ec'}},axisLabel:{color:'#7c8fad',fontSize:10}}, yAxis:[{type:'value',splitLine:{lineStyle:{color:'#edf2fa'}},axisLabel:{color:'#91a1bb',fontSize:9}},{type:'value',splitLine:{show:false},axisLabel:{color:'#91a1bb',fontSize:9}}], series:[{name:'新增项目',type:'bar',barWidth:18,data:data.value.projectTrend.map(i=>i.value),itemStyle:{borderRadius:[3,3,0,0]}},{name:'累计项目',type:'line',yAxisIndex:1,smooth:true,symbolSize:5,data:data.value.projectTrend.map(i=>i.cumulativeValue)}]
}));
const alarmTrendOption = computed<EChartsCoreOption>(() => ({
  color:['#347cf1'], tooltip:{trigger:'axis'}, grid:{left:38,right:18,top:22,bottom:24}, xAxis:{type:'category',boundaryGap:false,data:dates(data.value.alarmTrend),axisLine:{lineStyle:{color:'#ccd9ec'}},axisLabel:{color:'#7c8fad',fontSize:10}},yAxis:{type:'value',minInterval:1,splitLine:{lineStyle:{color:'#edf2fa'}},axisLabel:{color:'#91a1bb',fontSize:9}},series:[{type:'line',smooth:true,symbolSize:6,lineStyle:{width:2},areaStyle:{color:'rgba(52,124,241,.08)'},data:data.value.alarmTrend.map(i=>i.value)}]
}));
const energyTrendOption = computed<EChartsCoreOption>(() => ({
  color:['#2f78ee','#28bea9'],
  tooltip:{trigger:'axis',valueFormatter:(value:unknown)=>value==null?'暂无计量数据':`${Number(value).toLocaleString('zh-CN',{maximumFractionDigits:2})} ${data.value.energyMetadata.displayUnit}`},
  legend:{right:8,top:0,itemWidth:10,itemHeight:6,textStyle:{color:'#677da3',fontSize:10}},
  grid:{left:12,right:12,top:34,bottom:20,containLabel:true},
  xAxis:{type:'category',data:dates(data.value.energyTrend),axisLine:{lineStyle:{color:'#ccd9ec'}},axisLabel:{color:'#7c8fad',fontSize:10}},
  yAxis:{type:'value',splitNumber:4,splitLine:{lineStyle:{color:'#edf2fa'}},axisLabel:{color:'#91a1bb',fontSize:9,formatter:(value:number)=>Number(value).toLocaleString('zh-CN',{maximumFractionDigits:1})}},
  series:[
    {name:'本期能耗',type:'bar',barWidth:16,itemStyle:{borderRadius:[3,3,0,0]},data:data.value.energyTrend.map(i=>i.currentAvailability==='MISSING'?null:Number((Number(i.currentQuantity)/data.value.energyMetadata.displayDivisor).toFixed(2)))},
    {name:'同期能耗',type:'bar',barWidth:16,itemStyle:{borderRadius:[3,3,0,0]},data:data.value.energyTrend.map(i=>i.previousAvailability==='MISSING'?null:Number((Number(i.previousQuantity)/data.value.energyMetadata.displayDivisor).toFixed(2)))},
  ],
}));

async function load() {
  if (loading.value && overview.value) return;
  loading.value = true;
  error.value = '';
  try {
    overview.value = await operationsCockpitApi.overview();
  } catch {
    error.value = '运营数据暂时无法更新，已保留上次成功结果';
  } finally {
    loading.value = false;
  }
}
onMounted(() => { load(); clockTimer=window.setInterval(()=>now.value=new Date(),1000); refreshTimer=window.setInterval(load,60_000); });
onBeforeUnmount(()=>{window.clearInterval(clockTimer);window.clearInterval(refreshTimer)});
</script>

<template>
  <main class="operations-cockpit" :class="{ 'is-refreshing': loading && overview }" :aria-busy="loading">
    <header class="operations-title">
      <div><span>企业运营中心</span><h1>综合运营看板</h1></div>
      <div class="operations-title__meta">
        <span>数据更新：{{ generatedAt }}</span>
        <time>{{ now.toLocaleDateString('zh-CN') }} {{ now.toLocaleTimeString('zh-CN', { hour12: false }) }}</time>
      </div>
    </header>

    <div v-if="initialLoading" class="operations-skeleton" role="status" aria-label="正在加载运营数据">
      <i v-for="index in 12" :key="index" />
    </div>

    <div v-else-if="error && !overview" class="operations-error" role="alert">
      <strong>运营数据暂时不可用</strong><span>请检查服务状态后重试，页面不会使用零值冒充真实数据。</span><button type="button" @click="load">重新加载</button>
    </div>

    <section v-show="!initialLoading && overview" class="kpi-grid">
      <article v-for="item in kpis" :key="item.label" class="kpi-card" :class="`is-${item.tone}`">
        <span class="kpi-card__icon"><component :is="item.icon" /></span>
        <div><small>{{ item.label }}</small><strong>{{ item.value }}<em>{{ item.unit }}</em></strong><p>{{ item.note }}</p></div>
      </article>
    </section>

    <section v-show="!initialLoading && overview" class="main-grid">
      <div class="panel-stack left-stack">
        <OperationsPanel title="项目概览">
          <div class="stage-grid"><div v-for="stage in projectStages" :key="stage[0]"><i :style="{background:stage[2]}" /><span>{{ stage[0] }}</span><strong>{{ stage[1] }}<em> 个</em></strong></div></div>
        </OperationsPanel>
        <OperationsPanel title="项目类型分布">
          <div class="donut-chart"><DsChart :option="projectTypeOption" /><div class="donut-chart__center"><strong>{{ number.format(data.summary.projectCount) }}</strong><span>项目总数</span></div></div>
        </OperationsPanel>
        <OperationsPanel title="项目区域 Top 5" compact>
          <div class="region-bars"><div v-for="item in displayedRegions" :key="item.code"><span>{{ item.name }}</span><b><i :style="{width:`${item.count/regionMax*100}%`}" /></b><strong>{{ item.count }}</strong></div></div>
        </OperationsPanel>
      </div>

      <OperationsPanel title="全国项目分布" class="map-panel">
        <div class="map-summary">
          <header><span>重点项目</span><small>按纳管设备数</small></header>
          <ol>
            <li v-for="item in data.mapPoints.slice(0, 5)" :key="item.projectId"><span><b>{{ item.projectName }}</b><small>{{ item.provinceName }} · {{ item.cityName }}</small></span><strong>{{ item.deviceCount }}<em> 台</em></strong></li>
          </ol>
          <p v-if="!data.mapPoints.length">项目档案尚未配置经纬度</p>
        </div>
        <DsChart :option="mapOption" />
        <div v-if="!data.mapPoints.length" class="map-empty">项目档案尚未配置经纬度</div>
      </OperationsPanel>

      <div class="panel-stack right-stack">
        <OperationsPanel title="经营效益">
          <div class="finance-grid">
            <div><span>账单金额</span><strong>{{ money.format(data.finance.billedAmount) }}</strong><em>元</em></div>
            <div><span>已收金额</span><strong>{{ money.format(data.finance.receivedAmount) }}</strong><em>元</em></div>
            <div><span>应收余额</span><strong>{{ money.format(data.finance.outstandingAmount) }}</strong><em>元</em></div>
            <div><span>回款率</span><strong>{{ data.finance.collectionRate.toFixed(2) }}</strong><em>%</em></div>
          </div>
        </OperationsPanel>
        <OperationsPanel title="当前风险预警">
          <div class="donut-chart"><DsChart :option="riskOption" /><div class="donut-chart__center"><strong>{{ number.format(data.summary.currentRiskCount) }}</strong><span>活动中 / 已确认</span></div></div>
        </OperationsPanel>
        <OperationsPanel title="设备运营" compact>
          <div class="device-grid">
            <div><Monitor/><span>启用设备<strong>{{ data.devices.enabledDevices }}</strong></span></div>
            <div><DataAnalysis/><span>异常 / 停用<strong>{{ data.devices.unavailableDevices }}</strong></span></div>
            <div><BellFilled/><span>告警设备<strong>{{ data.devices.alarmAffectedDevices }}</strong></span></div>
            <div><Opportunity/><span>待办工单<strong>{{ data.devices.openWorkOrders }}</strong></span></div>
          </div>
        </OperationsPanel>
      </div>
    </section>

    <section v-show="!initialLoading && overview" class="bottom-grid">
      <OperationsPanel title="近 7 日项目趋势" compact><DsChart :option="projectTrendOption" /></OperationsPanel>
      <OperationsPanel title="近 7 日告警趋势" compact><DsChart :option="alarmTrendOption" /></OperationsPanel>
      <OperationsPanel title="能耗分析" compact>
        <template #header><small class="energy-period">{{ data.energyMetadata.currentPeriod }} · 同期：{{ data.energyMetadata.comparisonPeriod }} · {{ data.energyMetadata.sourceUnit }} ÷ {{ number.format(data.energyMetadata.displayDivisor) }} = {{ data.energyMetadata.displayUnit }}</small></template>
        <DsChart v-if="energyAvailability !== 'MISSING'" :option="energyTrendOption" />
        <div v-else class="energy-empty">暂无计量数据</div>
        <div v-if="energyAvailability !== 'MISSING' && energyAvailabilityMessage" class="energy-partial">{{ energyAvailabilityMessage }}</div>
      </OperationsPanel>
    </section>
    <div v-if="error && overview" class="operations-toast" role="status">{{ error }}</div>
  </main>
</template>

<style scoped>
.operations-cockpit { box-sizing:border-box; width:100vw; height:100dvh; min-width:1180px; min-height:700px; overflow:hidden; padding:18px 24px 20px; display:grid; grid-template-rows:52px 96px minmax(0,1fr) 190px; gap:12px; color:#203554; font-family:"Microsoft YaHei","PingFang SC",sans-serif; background:#f3f6fa; }
.operations-title { position:relative; display:flex; min-width:0; align-items:center; justify-content:space-between; padding:0 2px 8px; border-bottom:1px solid #dfe6ef; }
.operations-title>div:first-child{display:flex;align-items:baseline;gap:14px}.operations-title>div:first-child>span{color:#6f7f95;font-size:12px;font-weight:600;letter-spacing:.08em}.operations-title h1 { margin:0; color:#1c2d46; font-size:25px; line-height:1; letter-spacing:.04em; font-weight:700; }
.operations-title__meta{display:flex;align-items:center;gap:16px;color:#75849a;font-size:11px}.operations-title time{font-variant-numeric:tabular-nums}.operations-title button{display:inline-flex;height:30px;align-items:center;gap:6px;padding:0 11px;color:#42536a;background:#fff;border:1px solid #d7e0eb;border-radius:5px;cursor:pointer}.operations-title button:disabled{cursor:default;opacity:.55}.operations-title button svg{width:14px}
.operations-cockpit.is-refreshing::before{position:fixed;z-index:20;top:0;left:0;width:24%;height:2px;background:#2f6fcb;content:'';animation:operations-refresh 1s ease-in-out infinite}.operations-skeleton{grid-row:2/5;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:96px repeat(2,minmax(0,1fr));gap:12px}.operations-skeleton i{background:linear-gradient(90deg,#e9eef5 25%,#f7f9fc 40%,#e9eef5 58%);background-size:300% 100%;border:1px solid #e1e7ef;border-radius:7px;animation:operations-skeleton 1.3s ease infinite}.operations-skeleton i:nth-child(n+7){grid-column:span 2}.operations-error{grid-row:2/5;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:#65758a;background:#fff;border:1px solid #dfe6ef;border-radius:8px}.operations-error strong{color:#263950;font-size:18px}.operations-error button{height:34px;padding:0 16px;color:#fff;background:#2f6fcb;border:0;border-radius:5px}.operations-toast{position:fixed;z-index:20;bottom:18px;left:50%;padding:7px 14px;color:#7a5720;background:#fff8e8;border:1px solid #ead8af;border-radius:5px;font-size:11px;transform:translateX(-50%)}
.kpi-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:14px; }
.kpi-card { min-width:0; height:100%; box-sizing:border-box; display:flex; align-items:center; gap:12px; padding:10px 16px; overflow:hidden; border:1px solid #e0e6ee; border-radius:7px; background:#fff; box-shadow:0 3px 10px rgba(35,55,80,.035); }
.kpi-card__icon { width:34px; height:34px; flex:0 0 34px; display:grid; place-items:center; border-radius:5px; color:#376fbf; background:#edf3fb; }
.kpi-card__icon :deep(svg){width:20px;height:20px}.kpi-card small{display:block;color:#61728b;font-size:12px}.kpi-card strong{display:block;margin-top:4px;color:#203554;font-size:24px;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}.kpi-card em{margin-left:6px;color:#7b899c;font-size:10px;font-style:normal;font-weight:500}.kpi-card p{margin:5px 0 0;color:#8793a4;font-size:9px;white-space:nowrap}.kpi-card.is-cyan .kpi-card__icon{color:#258a98;background:#eaf6f7}.kpi-card.is-indigo .kpi-card__icon{color:#5c61a9;background:#f0f0f8}.kpi-card.is-red .kpi-card__icon{color:#c8484d;background:#fbeff0}.kpi-card.is-red strong{color:#b83c42}
.main-grid { min-height:0; display:grid; grid-template-columns:minmax(0,24fr) minmax(0,48fr) minmax(0,28fr); gap:14px; }
.panel-stack { min-height:0; display:grid; gap:12px; }.left-stack{grid-template-rows:1.08fr 1fr .86fr}.right-stack{grid-template-rows:1.08fr 1fr .86fr}.bottom-grid{display:grid;grid-template-columns:minmax(0,36fr) minmax(0,36fr) minmax(0,28fr);gap:14px;min-height:0}.bottom-grid>*{min-width:0}
.donut-chart{position:relative;width:100%;height:100%}.donut-chart .ds-chart{position:absolute;inset:0}.donut-chart__center{position:absolute;z-index:2;left:30%;top:52%;min-height:34px;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;white-space:nowrap}.donut-chart__center strong{color:#17346d;font-size:19px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums}.donut-chart__center span{margin-top:5px;color:#7b90b4;font-size:10px;line-height:1}
.stage-grid,.finance-grid,.device-grid{height:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:8px 10px;padding:10px 14px;box-sizing:border-box}.stage-grid>div,.finance-grid>div,.device-grid>div{min-width:0;min-height:0;border:0;border-radius:7px;background:#f5f8fc}.stage-grid>div{position:relative;display:flex;flex-direction:column;justify-content:center;padding:7px 14px}.stage-grid i{position:absolute;left:13px;top:50%;width:7px;height:7px;border-radius:50%;transform:translateY(-17px)}.stage-grid span{display:block;padding-left:16px;color:#60759b;font-size:11px;line-height:1.3}.stage-grid strong{display:block;margin-top:5px;color:#17346d;font-size:20px;line-height:1}.stage-grid em{font-size:10px;font-style:normal;font-weight:500;color:#8998b3}
.map-panel :deep(.operations-panel__body){display:flex}.map-panel .ds-chart{position:absolute;inset:0}.map-summary{z-index:2;width:176px;margin:14px 0 14px 14px;align-self:stretch;display:flex;flex-direction:column;border:1px solid #e1e7ef;border-radius:7px;background:rgba(255,255,255,.96);box-shadow:0 5px 16px rgba(42,62,88,.05)}.map-summary header{display:flex;height:38px;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid #e8edf3}.map-summary header span{color:#2a3b52;font-size:11px;font-weight:700}.map-summary header small{color:#8a96a8;font-size:9px}.map-summary ol{min-height:0;margin:0;padding:4px 10px;overflow:hidden;list-style:none}.map-summary li{display:flex;min-height:42px;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid #edf1f5}.map-summary li:last-child{border:0}.map-summary li>span{display:flex;min-width:0;flex-direction:column}.map-summary li b{overflow:hidden;color:#435168;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.map-summary li small{overflow:hidden;color:#8a96a8;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.map-summary li strong{color:#304d76;font-size:13px}.map-summary li em{color:#8a96a8;font-size:8px;font-style:normal;font-weight:400}.map-summary p{margin:auto;padding:12px;color:#8a96a8;font-size:10px;text-align:center}.map-empty{z-index:3;position:absolute;left:58%;bottom:18px;transform:translateX(-50%);padding:6px 12px;border-radius:4px;background:#edf3fa;color:#718096;font-size:10px}
.finance-grid>div{display:grid;grid-template-columns:minmax(0,1fr) auto;align-content:center;padding:7px 12px}.finance-grid span{grid-column:1/-1;display:block;color:#667ca1;font-size:10px;line-height:1.3}.finance-grid strong{min-width:0;margin-top:6px;overflow:hidden;text-overflow:ellipsis;color:#18356e;font-size:17px;line-height:1;white-space:nowrap}.finance-grid em{align-self:end;margin:0 0 1px 4px;color:#8192ad;font-size:9px;font-style:normal;line-height:1}.region-bars{display:flex;flex-direction:column;justify-content:center;height:100%;gap:4px;padding:10px 15px;box-sizing:border-box}.region-bars>div{min-height:0;display:grid;grid-template-columns:58px 1fr 28px;align-items:center;gap:8px;color:#63799c;font-size:10px;line-height:1.2}.region-bars b{height:6px;border-radius:3px;background:#e9eef6;overflow:hidden}.region-bars b i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#327cf0,#6ea5f7)}.region-bars strong{text-align:right;color:#294b83}
.device-grid{grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:minmax(0,1fr);padding:10px 12px}.device-grid>div{display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 6px}.device-grid svg{width:20px;color:#2f7cf0}.device-grid>div:nth-child(3) svg{color:#ef585b}.device-grid span{color:#7184a4;font-size:9px;line-height:1.35}.device-grid strong{display:block;margin-top:4px;color:#1f4b88;font-size:15px;line-height:1}
.energy-period{min-width:0;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8495b1;font-size:9px;font-weight:400}.energy-empty{position:absolute;inset:0;display:grid;place-items:center;color:#7d8fac;font-size:11px;background:#fff}.energy-partial{position:absolute;right:10px;bottom:7px;z-index:2;padding:3px 7px;border-radius:10px;color:#7d8fac;font-size:9px;line-height:1;background:rgba(255,255,255,.92);box-shadow:0 1px 5px rgba(42,78,128,.08);pointer-events:none}
@keyframes operations-refresh{from{transform:translateX(-110%)}to{transform:translateX(520%)}}@keyframes operations-skeleton{0%{background-position:100% 0}100%{background-position:0 0}}
@media(max-width:1380px),(max-height:780px),(max-width:1600px) and (max-height:850px){.operations-cockpit{padding:8px 16px 12px;grid-template-rows:38px 82px minmax(0,1fr) 150px;gap:9px}.operations-title h1{font-size:25px}.kpi-grid,.main-grid,.bottom-grid{gap:9px}.panel-stack{gap:8px}.kpi-card{gap:8px;padding:7px 11px}.kpi-card__icon{width:42px;height:42px;flex-basis:42px}.kpi-card strong{font-size:20px}.kpi-card p{font-size:9px}.stage-grid,.finance-grid{padding:5px 9px;gap:5px 7px}.stage-grid>div,.finance-grid>div{padding:4px 9px}.stage-grid i{left:9px;transform:translateY(-14px)}.stage-grid span{padding-left:14px;font-size:10px;line-height:1.15}.stage-grid strong{margin-top:4px;font-size:15px;line-height:1.15}.finance-grid span{font-size:9px;line-height:1.15}.finance-grid strong{margin-top:4px;font-size:15px;line-height:1.15}.finance-grid em{line-height:1.15}.donut-chart__center{min-height:32px}.donut-chart__center strong{font-size:17px}.donut-chart__center span{margin-top:3px;font-size:9px}.region-bars{gap:3px;padding:6px 10px}.region-bars>div{font-size:9px;line-height:1}.device-grid{padding:6px 8px}.map-summary{margin-top:52px;margin-bottom:16px}}
</style>
