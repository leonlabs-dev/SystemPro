<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Grid, List, Refresh } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsDataTable, { type DsTableColumn } from '@/design-system/components/DsDataTable.vue';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPrimaryCell from '@/design-system/components/DsPrimaryCell.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';
import MonitoringKpiStrip from './components/MonitoringKpiStrip.vue';
import MonitoringVideoPlaceholder from './components/MonitoringVideoPlaceholder.vue';
import { operationsMonitoringApi, type MonitoringConsistency, type MonitoringVideoChannel, type VideoMonitoringPage } from '@/domain/iot/operations-monitoring';

const { t, locale } = useI18n(); const runtimeSettings = useRuntimeSettingsStore();
const loading = ref(true); const error = ref(''); const data = ref<VideoMonitoringPage>();
const keyword = ref(''); const consistency = ref<MonitoringConsistency | ''>(''); const viewMode = ref<'cards'|'list'>('cards');
const page = ref(1); const pageSize = ref(runtimeSettings.pageSize);
const drawerVisible = ref(false); const selected = ref<MonitoringVideoChannel>();
const columns = computed<DsTableColumn[]>(() => [
  { prop: 'assetName', label: '摄像机名称 / 编码', minWidth: 190, slot: 'identity' },
  { prop: 'systemName', label: t('operationsMonitoring.common.system'), minWidth: 150, showOverflowTooltip: true },
  { prop: 'installSpaceName', label: t('operationsMonitoring.common.space'), minWidth: 130, slot: 'space' },
  { prop: 'gatewayName', label: t('operationsMonitoring.common.gateway'), minWidth: 130, slot: 'gateway' },
  { prop: 'channelCode', label: t('operationsMonitoring.common.channel'), width: 120, slot: 'channel' },
  { prop: 'consistencyState', label: '接入状态', width: 120, slot: 'config' },
  { prop: 'streamState', label: '视频流', width: 120, slot: 'stream' },
]);
const metrics = computed(() => [
  { key:'total',label:t('operationsMonitoring.video.total'),value:data.value?.summary.total || 0 },
  { key:'configured',label:t('operationsMonitoring.video.configured'),value:data.value?.summary.configured || 0,tone:'success' as const },
  { key:'unconfigured',label:t('operationsMonitoring.video.unconfigured'),value:data.value?.summary.unconfigured || 0,tone:'muted' as const },
  { key:'attention',label:t('operationsMonitoring.video.attention'),value:data.value?.summary.attention || 0,tone:'warning' as const },
  { key:'streams',label:t('operationsMonitoring.video.streams'),value:0,tone:'muted' as const },
]);
let loadSequence=0;let loadTimer:number|undefined;const ready=ref(false);
async function load(){const sequence=++loadSequence;loading.value=true;error.value='';try{const result=await operationsMonitoringApi.videoChannels({keyword:keyword.value.trim(),consistency:consistency.value,page:page.value,pageSize:pageSize.value});if(sequence===loadSequence)data.value=result;}catch{if(sequence===loadSequence)error.value=t('operationsMonitoring.video.loadFailed');}finally{if(sequence===loadSequence)loading.value=false;}}
function scheduleLoad(){if(!ready.value)return;window.clearTimeout(loadTimer);loadTimer=window.setTimeout(()=>{void load();},220);}
function open(row:MonitoringVideoChannel){selected.value=row;drawerVisible.value=true;}
function reset(){keyword.value='';consistency.value='';page.value=1;}
function placeholder(row:MonitoringVideoChannel){return row.consistencyState==='ALIGNED' ? {state:'empty' as const,title:t('operationsMonitoring.video.noStreamTitle'),description:t('operationsMonitoring.video.noStreamDescription')} : {state:'unconfigured' as const,title:t('operationsMonitoring.video.notConfiguredTitle'),description:t('operationsMonitoring.video.notConfiguredDescription')};}
function formatTime(value?:string){return value?new Intl.DateTimeFormat(locale.value==='en-US'?'en-US':'zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value)):'—';}
function consistencyLabel(value?: string){return value?t(`operationsMonitoring.common.consistency.${value}`):'—';}
watch([keyword,consistency],()=>{if(page.value!==1)page.value=1;else scheduleLoad();});
watch([page,pageSize],scheduleLoad);
watch(()=>runtimeSettings.pageSize,value=>{pageSize.value=value;});
onMounted(async()=>{await runtimeSettings.load().catch(()=>undefined);pageSize.value=runtimeSettings.pageSize;ready.value=true;await load();});
</script>

<template>
  <DsListPageShell :title="t('operationsMonitoring.video.title')" :subtitle="t('operationsMonitoring.video.subtitle')" :loading="loading" :error="error" page-class="monitor-video-page">
    <template #header-extra><span v-if="data?.generatedAt" class="ds-list-page__meta">{{t('operationsMonitoring.common.generatedAt',{time:formatTime(data.generatedAt)})}}</span></template>
    <template #primary-action><el-button class="ds-list-page__primary-action" :icon="Refresh" :loading="loading" @click="load">{{t('operationsMonitoring.common.refresh')}}</el-button></template>
    <MonitoringKpiStrip :metrics="metrics" />
      <div class="ds-list-filter ds-list-filter--adaptive">
        <el-input v-model="keyword" class="ds-list-filter__keyword" clearable :placeholder="t('operationsMonitoring.video.keyword')" />
        <el-select v-model="consistency" class="ds-list-filter__select" clearable :placeholder="t('operationsMonitoring.video.allStates')"><el-option v-for="item in ['ALIGNED','NO_ACCESS','ACCESS_DISABLED','INCOMPLETE']" :key="item" :label="t(`operationsMonitoring.common.consistency.${item}`)" :value="item" /></el-select>
        <span /><span />
        <div class="ds-list-filter__actions"><el-button class="ds-list-filter__button" @click="reset">{{ t('operationsMonitoring.common.reset') }}</el-button><el-radio-group v-model="viewMode" size="small"><el-radio-button label="cards"><el-icon><Grid /></el-icon><span>{{ t('operationsMonitoring.video.cards') }}</span></el-radio-button><el-radio-button label="list"><el-icon><List /></el-icon><span>{{ t('operationsMonitoring.video.list') }}</span></el-radio-button></el-radio-group></div>
      </div>
      <section class="ds-list-table-shell">
      <div v-if="viewMode==='cards'" class="video-card-grid">
        <article v-for="item in data?.channels || []" :key="item.assetId" class="video-channel-card">
          <header><div><strong>{{ item.assetName }}</strong><span>{{ item.assetCode }} · {{ item.installSpaceName || '—' }}</span></div><DsTag size="small" :type="item.consistencyState==='ALIGNED'?'success':'warning'">{{ consistencyLabel(item.consistencyState) }}</DsTag></header>
          <MonitoringVideoPlaceholder v-bind="placeholder(item)" />
          <footer><span><small>{{ t('operationsMonitoring.common.gateway') }}</small><strong>{{ item.gatewayName || '—' }}</strong></span><span><small>{{ t('operationsMonitoring.common.channel') }}</small><strong>{{ item.channelCode || '—' }}</strong></span><el-button link type="primary" @click="open(item)">{{ t('operationsMonitoring.video.preview') }}</el-button></footer>
        </article>
        <DsEmpty v-if="!loading&&!data?.total" :description="t('operationsMonitoring.video.empty')" />
      </div>
      <DsDataTable v-else :rows="(data?.channels || []) as unknown as Record<string,unknown>[]" :columns="columns" row-key="assetId" :loading="loading" :action-width="84">
        <template #identity="{row}"><DsPrimaryCell :primary="row.assetName" :secondary="row.assetCode" /></template>
        <template #space="{row}">{{row.installSpaceName||'—'}}</template>
        <template #gateway="{row}">{{row.gatewayName||'—'}}</template>
        <template #channel="{row}">{{row.channelCode||'—'}}</template>
        <template #config="{row}"><DsTag size="small" :type="row.consistencyState==='ALIGNED'?'success':'warning'">{{consistencyLabel(row.consistencyState)}}</DsTag></template>
        <template #stream><DsTag size="small" type="neutral" dot>未连接</DsTag></template>
        <template #actions="{row}"><el-button link type="primary" @click="open(row)">{{t('operationsMonitoring.common.detail')}}</el-button></template>
      </DsDataTable>
      <footer class="ds-list-table-footer ds-list-table-footer--pagination-only"><DsPagination v-model:page="page" v-model:page-size="pageSize" :total="data?.total || 0" /></footer>
      </section>
  </DsListPageShell>

  <el-drawer v-model="drawerVisible" class="monitor-drawer" size="460px" :title="selected?.assetName || t('operationsMonitoring.common.detail')">
    <template v-if="selected"><MonitoringVideoPlaceholder v-bind="placeholder(selected)" />
      <section class="monitor-drawer__section"><h3>{{t('operationsMonitoring.common.assetMaster')}}</h3><dl><div><dt>资产名称</dt><dd>{{selected.assetName}}</dd></div><div><dt>资产编码</dt><dd>{{selected.assetCode}}</dd></div><div><dt>{{t('operationsMonitoring.common.system')}}</dt><dd>{{selected.systemName}}</dd></div><div><dt>{{t('operationsMonitoring.common.space')}}</dt><dd>{{selected.installSpaceName||'—'}}</dd></div></dl></section>
      <section class="monitor-drawer__section"><h3>{{t('operationsMonitoring.common.accessConfig')}}</h3><dl><div><dt>{{t('operationsMonitoring.common.gateway')}}</dt><dd>{{selected.gatewayName||'—'}}</dd></div><div><dt>{{t('operationsMonitoring.common.channel')}}</dt><dd>{{selected.channelCode||'—'}}</dd></div><div><dt>{{t('operationsMonitoring.common.protocol')}}</dt><dd>{{selected.protocolTemplate||'—'}}</dd></div><div><dt>视频流状态</dt><dd>NOT_CONNECTED</dd></div></dl></section>
      <section class="monitor-drawer__section"><div class="monitor-policy">{{t('operationsMonitoring.video.secureHint')}}</div><el-alert v-if="selected.consistencyState!=='ALIGNED'" style="margin-top:10px" type="warning" :closable="false" show-icon :title="consistencyLabel(selected.consistencyState)" /></section>
    </template>
  </el-drawer>
</template>

<style scoped>
.ds-list-filter .el-radio-button span{margin-left:4px}.video-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:12px;align-content:start}.video-channel-card{min-width:0;overflow:hidden;border:1px solid var(--color-border-default);border-radius:10px;background:var(--color-bg-surface);transition:border-color .18s,box-shadow .18s}.video-channel-card:hover{border-color:color-mix(in srgb,var(--color-primary-500) 35%,var(--color-border-default));box-shadow:var(--shadow-soft)}.video-channel-card>header{display:flex;min-height:48px;align-items:center;justify-content:space-between;gap:8px;padding:7px 11px;border-bottom:1px solid var(--color-border-default)}.video-channel-card>header div{min-width:0}.video-channel-card>header strong,.video-channel-card>header span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.video-channel-card>header strong{font-size:12px}.video-channel-card>header span{margin-top:3px;color:var(--color-text-secondary);font-size:9px}.video-channel-card :deep(.video-placeholder){min-height:150px}.video-channel-card>footer{display:grid;min-height:52px;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px 11px;border-top:1px solid var(--color-border-default)}.video-channel-card>footer small,.video-channel-card>footer strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.video-channel-card>footer small{color:var(--color-text-secondary);font-size:8px}.video-channel-card>footer strong{margin-top:2px;font-size:10px}
@media(max-width:1200px){.video-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-height:760px){.video-channel-card :deep(.video-placeholder){min-height:124px}.video-card-grid{gap:9px;padding:9px}}
</style>
