<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Connection, Refresh, Search } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsDataTable, { type DsTableColumn } from '@/design-system/components/DsDataTable.vue';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPrimaryCell from '@/design-system/components/DsPrimaryCell.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';
import { enumLabel } from '@/core/i18n/enum-labels';
import MonitoringKpiStrip from './components/MonitoringKpiStrip.vue';
import { operationsMonitoringApi, type GatewayChannelMonitoringPage, type GatewayMonitoringPage, type MonitoringGateway } from '@/domain/iot/operations-monitoring';

const { t, locale } = useI18n(); const runtimeSettings = useRuntimeSettingsStore();
const loading = ref(true); const error = ref(''); const data = ref<GatewayMonitoringPage>();
const channelData = ref<GatewayChannelMonitoringPage>();
const selectedName = ref(''); const keyword = ref(''); const consistency = ref('');
const page = ref(1); const pageSize = ref(runtimeSettings.pageSize);
const selected = computed<MonitoringGateway | undefined>(() => data.value?.gateways.find(item => item.name === selectedName.value));
const columns = computed<DsTableColumn[]>(() => [
  { prop: 'assetName', label: '设备名称 / 编码', minWidth: 180, slot: 'identity' },
  { prop: 'systemType', label: t('operationsMonitoring.common.system'), width: 96, slot: 'systemType' },
  { prop: 'channelCode', label: t('operationsMonitoring.common.channel'), minWidth: 130, slot: 'channel' },
  { prop: 'protocolTemplate', label: t('operationsMonitoring.common.protocol'), minWidth: 116, slot: 'protocol' },
  { prop: 'consistencyState', label: '接入配置', width: 112, slot: 'config' },
  { prop: 'runtimeStatus', label: '链路状态', width: 112, slot: 'runtime' },
]);
const metrics = computed(() => [
  {key:'total',label:t('operationsMonitoring.gateway.total'),value:data.value?.summary.total||0},
  {key:'devices',label:t('operationsMonitoring.gateway.devices'),value:data.value?.boundDeviceCount||0,tone:'primary' as const},
  {key:'incomplete',label:t('operationsMonitoring.gateway.incomplete'),value:data.value?.incompleteDeviceCount||0,tone:'warning' as const},
  {key:'unbound',label:t('operationsMonitoring.gateway.unbound'),value:data.value?.unboundDeviceCount||0,tone:'muted' as const},
  {key:'telemetry',label:t('operationsMonitoring.gateway.telemetry'),value:0,tone:'muted' as const},
]);
function formatTime(value?:string){return value?new Intl.DateTimeFormat(undefined,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value)):'—';}
function consistencyLabel(value?: string){return value?t(`operationsMonitoring.common.consistency.${value}`):'—';}
let loadSequence=0;let channelSequence=0;let loadTimer:number|undefined;const ready=ref(false);
async function loadDirectories(){const first=await operationsMonitoringApi.gateways({page:1,pageSize:100});const gateways=[...first.gateways];for(let current=2;gateways.length<first.total;current+=1){const next=await operationsMonitoringApi.gateways({page:current,pageSize:100});if(!next.gateways.length)break;gateways.push(...next.gateways);}data.value={...first,gateways,page:1,pageSize:gateways.length||first.pageSize};}
async function loadChannels(){if(!selectedName.value){channelData.value=undefined;return;}const sequence=++channelSequence;const result=await operationsMonitoringApi.gatewayChannels({gatewayName:selectedName.value,keyword:keyword.value.trim(),consistency:consistency.value,page:page.value,pageSize:pageSize.value});if(sequence===channelSequence)channelData.value=result;}
async function load(){const sequence=++loadSequence;loading.value=true;error.value='';try{await loadDirectories();if(sequence===loadSequence)await loadChannels();}catch{if(sequence===loadSequence)error.value=t('operationsMonitoring.gateway.loadFailed');}finally{if(sequence===loadSequence)loading.value=false;}}
function scheduleChannels(){if(!ready.value)return;window.clearTimeout(loadTimer);loadTimer=window.setTimeout(()=>{void loadChannels();},220);}
function reset(){keyword.value='';consistency.value='';page.value=1;}
watch(()=>data.value?.gateways,items=>{if(!items?.some(item=>item.name===selectedName.value))selectedName.value=items?.[0]?.name||'';},{immediate:true});
watch([selectedName,keyword,consistency],()=>{if(page.value!==1)page.value=1;else scheduleChannels();});
watch([page,pageSize],scheduleChannels);
watch(()=>runtimeSettings.pageSize,value=>{pageSize.value=value;});
onMounted(async()=>{await runtimeSettings.load().catch(()=>undefined);pageSize.value=runtimeSettings.pageSize;ready.value=true;await load();});
</script>

<template>
  <DsListPageShell :title="t('operationsMonitoring.gateway.title')" :subtitle="t('operationsMonitoring.gateway.subtitle')" :loading="loading" :error="error" page-class="monitor-gateway-page">
    <template #header-extra><span v-if="data?.generatedAt" class="ds-list-page__meta">{{t('operationsMonitoring.common.generatedAt',{time:formatTime(data.generatedAt)})}}</span></template>
    <template #primary-action><el-button class="ds-list-page__primary-action" :icon="Refresh" :loading="loading" @click="load">{{t('operationsMonitoring.common.refresh')}}</el-button></template>
    <MonitoringKpiStrip :metrics="metrics" />
    <section class="ds-list-master-detail gateway-catalog">
      <aside class="ds-list-master-detail__master gateway-catalog__nav">
        <header><div><strong>{{t('operationsMonitoring.gateway.select')}}</strong><span>按接入网关筛选</span></div><small>{{data?.gateways.length||0}}</small></header>
        <button v-for="item in data?.gateways||[]" :key="item.name" type="button" :class="{'is-active':selectedName===item.name}" @click="selectedName=item.name">
          <el-icon><Connection /></el-icon><span><strong>{{item.name}}</strong><small>{{t('operationsMonitoring.gateway.deviceCount',{count:item.configuredDeviceCount})}}</small></span><em>{{item.incompleteDeviceCount}}</em>
        </button>
        <DsEmpty v-if="!loading&&!data?.gateways.length" :description="t('operationsMonitoring.gateway.empty')" />
      </aside>
      <section class="ds-list-master-detail__detail gateway-catalog__content">
        <header class="gateway-context"><div><strong>{{selected?.name||'—'}}</strong><span>{{selected?t('operationsMonitoring.gateway.channelCount',{count:channelData?.total||0}):'—'}}</span></div><DsTag size="small" type="neutral" dot>{{t('operationsMonitoring.common.noTelemetry')}}</DsTag></header>
        <div class="ds-list-filter ds-list-filter--nested"><el-input v-model="keyword" class="ds-list-filter__keyword" clearable :prefix-icon="Search" placeholder="设备名称 / 编码 / 通道" /><el-select v-model="consistency" class="ds-list-filter__select" clearable placeholder="全部接入状态"><el-option v-for="item in ['ALIGNED','NO_ACCESS','ACCESS_DISABLED','INCOMPLETE']" :key="item" :label="t(`operationsMonitoring.common.consistency.${item}`)" :value="item" /></el-select><span/><div class="ds-list-filter__actions"><el-button class="ds-list-filter__button" @click="reset">{{t('operationsMonitoring.common.reset')}}</el-button></div></div>
        <section class="ds-list-table-shell ds-list-table-shell--embedded gateway-table-shell">
        <DsDataTable class="gateway-table" :rows="(channelData?.channels || []) as unknown as Record<string,unknown>[]" :columns="columns" row-key="assetId" :loading="loading">
          <template #identity="{row}"><DsPrimaryCell :primary="row.assetName" :secondary="row.assetCode" /></template>
          <template #systemType="{row}">{{ enumLabel('systemType', row.systemType, locale) }}</template>
          <template #channel="{row}">{{row.channelCode||'—'}}</template>
          <template #protocol="{row}">{{row.protocolTemplate||'—'}}</template>
          <template #config="{row}"><DsTag size="small" :type="row.consistencyState==='ALIGNED'?'success':'warning'">{{consistencyLabel(row.consistencyState)}}</DsTag></template>
          <template #runtime><DsTag size="small" type="neutral" dot>{{t('operationsMonitoring.common.noTelemetry')}}</DsTag></template>
        </DsDataTable>
        <footer class="ds-list-table-footer ds-list-table-footer--pagination-only"><DsPagination v-model:page="page" v-model:page-size="pageSize" :total="channelData?.total || 0" /></footer>
        </section>
      </section>
    </section>
  </DsListPageShell>
</template>

<style scoped>
.gateway-catalog{grid-template-columns:210px minmax(0,1fr)}
.gateway-catalog__nav{min-height:0;border-right:1px solid var(--color-border-default);padding:12px 10px}.gateway-catalog__nav>header{display:flex;min-height:44px;align-items:flex-start;justify-content:space-between;margin-bottom:10px;padding:2px 6px 10px;border-bottom:1px solid var(--color-border-default)}.gateway-catalog__nav>header strong,.gateway-catalog__nav>header span{display:block}.gateway-catalog__nav>header strong{font-size:11px}.gateway-catalog__nav>header span,.gateway-catalog__nav>header small{margin-top:3px;color:var(--color-text-secondary);font-size:8px}.gateway-catalog__nav>button{display:grid;width:100%;height:52px;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:8px;margin:0 0 8px;padding:0 9px;border:0;border-radius:5px;color:var(--color-text-secondary);text-align:left;background:transparent;cursor:pointer}.gateway-catalog__nav>button:hover{background:var(--color-bg-muted)}.gateway-catalog__nav>button.is-active{color:var(--color-primary-600);background:var(--color-primary-50)}.gateway-catalog__nav>button>span{min-width:0}.gateway-catalog__nav>button strong,.gateway-catalog__nav>button small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gateway-catalog__nav>button strong{font-size:10px}.gateway-catalog__nav>button small{margin-top:3px;color:var(--color-text-secondary);font-size:8px}.gateway-catalog__nav>button em{min-width:18px;color:var(--color-text-tertiary);font-size:9px;font-style:normal;text-align:right}
.gateway-catalog__content{gap:0}.gateway-context{display:flex;min-height:44px;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid var(--color-border-default)}.gateway-context>div strong,.gateway-context>div span{display:inline-block}.gateway-context>div strong{font-size:var(--font-body)}.gateway-context>div span{margin-left:8px;color:var(--color-text-secondary);font-size:var(--font-caption)}.gateway-table-shell{margin:0 12px 12px}.gateway-table{min-height:auto;flex:none}
@media(max-width:1100px){.gateway-catalog{grid-template-columns:190px minmax(0,1fr)}}
</style>
