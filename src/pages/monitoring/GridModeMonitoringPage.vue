<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Connection, Lightning, MostlyCloudy, Refresh, Sunny } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import DsDataTable, { type DsTableColumn } from '@/design-system/components/DsDataTable.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsPrimaryCell from '@/design-system/components/DsPrimaryCell.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';
import { enumLabel } from '@/core/i18n/enum-labels';
import MonitoringKpiStrip from './components/MonitoringKpiStrip.vue';
import { operationsMonitoringApi, type GridMonitoringPage, type MonitoringGridNode } from '@/domain/iot/operations-monitoring';

const {t,locale}=useI18n(); const runtimeSettings=useRuntimeSettingsStore(); const loading=ref(true); const error=ref(''); const data=ref<GridMonitoringPage>();
const selected=ref<MonitoringGridNode>(); const drawerVisible=ref(false);
const page=ref(1); const pageSize=ref(runtimeSettings.pageSize);
const configured=computed(()=>data.value?.configuredCount||0);
const solarCount=computed(()=>data.value?.solarCount||0);
const storageCount=computed(()=>data.value?.storageCount||0);
const columns=computed<DsTableColumn[]>(()=>[
  {prop:'systemName',label:'系统名称 / 编码',minWidth:240,slot:'identity'},
  {prop:'systemType',label:'系统类型',width:110,slot:'systemType'},
  {prop:'configuredMode',label:'配置模式',minWidth:180,slot:'configured'},
  {prop:'runtimeMode',label:'运行模式',width:135,slot:'runtime'},
  {prop:'gridAvailability',label:'电网 / 联锁',width:160,slot:'state'},
  {prop:'lastTransitionAt',label:'最近切换',width:135,slot:'time'},
]);
const metrics=computed(()=>[
  {key:'runtime',label:'运行模式',value:t('operationsMonitoring.common.noTelemetry'),tone:'muted' as const},
  {key:'switch',label:'切换状态',value:t('operationsMonitoring.common.noTelemetry'),tone:'muted' as const},
  {key:'systems',label:t('operationsMonitoring.grid.systems'),value:data.value?.summary.total||0},
  {key:'configured',label:t('operationsMonitoring.grid.configured'),value:configured.value,tone:'primary' as const},
  {key:'grid',label:t('operationsMonitoring.grid.grid'),value:t('operationsMonitoring.common.noTelemetry'),tone:'muted' as const},
  {key:'exceptions',label:'异常切换',value:'—',tone:'muted' as const},
]);
const checks=[['电网电压','未接入遥测'],['频率','未接入遥测'],['储能 SOC','未接入遥测'],['PCS 状态','未接入遥测'],['关键负荷允许','未评估'],['通信状态','未接入遥测']];
const parameters=[['电网电压','—'],['频率','—'],['园区总负荷','—'],['光伏功率','—'],['储能功率','—'],['储能 SOC','—']];
let loadSequence=0;const ready=ref(false);
async function load(){const sequence=++loadSequence;loading.value=true;error.value='';try{const result=await operationsMonitoringApi.gridModes({page:page.value,pageSize:pageSize.value});if(sequence===loadSequence)data.value=result;}catch{if(sequence===loadSequence)error.value=t('operationsMonitoring.grid.loadFailed');}finally{if(sequence===loadSequence)loading.value=false;}}
function open(row:MonitoringGridNode){selected.value=row;drawerVisible.value=true;}
function label(domain:Parameters<typeof enumLabel>[0],value?:string){return enumLabel(domain,value,locale.value);}
function formatTime(value?:string){return value?new Intl.DateTimeFormat(locale.value==='en-US'?'en-US':'zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';}
watch([page,pageSize],()=>{if(ready.value)void load();});
watch(()=>runtimeSettings.pageSize,value=>{pageSize.value=value;});
onMounted(async()=>{await runtimeSettings.load().catch(()=>undefined);pageSize.value=runtimeSettings.pageSize;ready.value=true;await load();});
</script>

<template>
  <DsListPageShell :title="t('operationsMonitoring.grid.title')" :subtitle="t('operationsMonitoring.grid.subtitle')" :loading="loading" :error="error" page-class="monitor-grid-page">
    <template #header-extra><span v-if="data?.generatedAt" class="ds-list-page__meta">{{t('operationsMonitoring.common.generatedAt',{time:formatTime(data.generatedAt)})}}</span><DsTag type="info">只读监视</DsTag></template>
    <template #primary-action><el-button class="ds-list-page__primary-action" :icon="Refresh" :loading="loading" @click="load">{{t('operationsMonitoring.common.refresh')}}</el-button></template>
    <MonitoringKpiStrip :metrics="metrics" />
    <section class="grid-dashboard-scroll">
      <section class="grid-dashboard-top">
        <article class="grid-panel grid-switch-overview">
          <header><strong>切换状态总览</strong><span>配置关系 · 当前状态未接入</span></header>
          <div class="switch-map">
            <div class="switch-source"><section><el-icon><MostlyCloudy /></el-icon><span><small>公共电网</small><strong>未接入遥测</strong></span></section><section class="is-standby"><el-icon><Lightning /></el-icon><span><small>备用电源</small><strong>未配置</strong></span></section></div>
            <div class="switch-link"><i /><em>未接入遥测</em></div>
            <div class="switch-ats"><el-icon><Connection /></el-icon><strong>并 / 离网连接点</strong><span>{{t('operationsMonitoring.common.noTelemetry')}}</span><small>联锁条件未评估</small></div>
            <div class="switch-link is-output"><i /></div>
            <div class="switch-targets">
              <section v-for="item in data?.systems||[]" :key="item.systemId"><el-icon><Sunny v-if="item.systemType==='SOLAR'"/><Lightning v-else/></el-icon><span><strong>{{item.systemName}}</strong><small>{{label('systemType',item.systemType)}} · {{item.configuredMode?label('systemMode',item.configuredMode):'未配置模式'}}</small></span></section>
              <section class="is-load"><el-icon><Lightning /></el-icon><span><strong>园区负荷</strong><small>实时功率未接入</small></span></section>
            </div>
          </div>
          <footer><span>配置模式 <strong>{{configured}} / {{data?.total||0}}</strong></span><span>光伏系统 <strong>{{solarCount}}</strong></span><span>储能系统 <strong>{{storageCount}}</strong></span><span>运行状态 <strong>未接入遥测</strong></span></footer>
        </article>
        <article class="grid-panel grid-checks"><header><strong>切换条件校验</strong><span>只读</span></header><ul><li v-for="item in checks" :key="item[0]"><span>{{item[0]}}</span><em>{{item[1]}}</em></li></ul></article>
        <article class="grid-panel grid-parameters"><header><strong>当前关键参数</strong><span>遥测快照</span></header><dl><div v-for="item in parameters" :key="item[0]"><dt>{{item[0]}}</dt><dd>{{item[1]}}</dd></div></dl></article>
      </section>
      <section class="grid-dashboard-middle">
        <article class="grid-panel grid-process"><header><strong>切换过程记录</strong><span>尚未接入切换事件流</span></header><div class="process-line"><section><i>1</i><strong>状态采集</strong><small>等待遥测</small></section><span/><section><i>2</i><strong>条件校验</strong><small>未评估</small></section><span/><section><i>3</i><strong>切换执行</strong><small>无事件</small></section><span/><section><i>4</i><strong>结果确认</strong><small>无快照</small></section></div></article>
        <article class="grid-panel grid-distribution"><header><strong>运行状态分布</strong><span>系统：{{data?.total||0}}</span></header><div><span class="distribution-ring"><strong>{{data?.total||0}}</strong><small>未接入</small></span><p><i/>{{t('operationsMonitoring.common.noTelemetry')}}<strong>{{data?.total||0}}</strong></p></div></article>
      </section>
      <section class="ds-list-embedded-section grid-system-table"><header><strong>并 / 离网系统清单</strong><span>资产配置与最近运行快照</span></header>
        <section class="ds-list-table-shell ds-list-table-shell--embedded">
        <DsDataTable :rows="(data?.systems || []) as unknown as Record<string,unknown>[]" :columns="columns" row-key="systemId" :loading="loading" :action-width="72">
          <template #identity="{row}"><DsPrimaryCell :primary="row.systemName" :secondary="row.systemCode" /></template>
          <template #systemType="{row}">{{label('systemType',row.systemType)}}</template>
          <template #configured="{row}">{{row.configuredMode?label('systemMode',row.configuredMode):'—'}}</template>
          <template #runtime><DsTag size="small" type="neutral" dot>{{t('operationsMonitoring.common.noTelemetry')}}</DsTag></template>
          <template #state>未接入遥测 / 未评估</template>
          <template #time="{row}">{{formatTime(row.lastTransitionAt)}}</template>
          <template #actions="{row}"><el-button link type="primary" @click="open(row)">{{t('operationsMonitoring.common.detail')}}</el-button></template>
        </DsDataTable>
        <footer class="ds-list-table-footer ds-list-table-footer--pagination-only"><DsPagination v-model:page="page" v-model:page-size="pageSize" :total="data?.total||0" /></footer>
        </section>
      </section>
    </section>
  </DsListPageShell>
  <el-drawer v-model="drawerVisible" class="monitor-drawer" size="420px" :title="selected?.systemName||t('operationsMonitoring.common.detail')"><template v-if="selected"><section class="monitor-drawer__section"><h3>系统配置</h3><dl><div><dt>系统编码</dt><dd>{{selected.systemCode}}</dd></div><div><dt>系统类型</dt><dd>{{label('systemType',selected.systemType)}}</dd></div><div><dt>配置模式</dt><dd>{{selected.configuredMode?label('systemMode',selected.configuredMode):'—'}}</dd></div><div><dt>资产数量</dt><dd>{{selected.assetCount}}</dd></div><div><dt>配置状态</dt><dd>{{label('assetStatus',selected.status)}}</dd></div><div><dt>档案更新时间</dt><dd>{{formatTime(selected.catalogUpdatedAt)}}</dd></div></dl></section><section class="monitor-drawer__section"><h3>{{t('operationsMonitoring.common.runtimeSnapshot')}}</h3><dl><div><dt>运行模式</dt><dd>{{t('operationsMonitoring.common.noTelemetry')}}</dd></div><div><dt>电网可用</dt><dd>未接入遥测</dd></div><div><dt>联锁状态</dt><dd>未评估</dd></div><div><dt>最近切换</dt><dd>{{formatTime(selected.lastTransitionAt)}}</dd></div></dl></section><section class="monitor-drawer__section"><el-alert type="info" :closable="false" show-icon :title="t('operationsMonitoring.grid.safety')"/></section></template></el-drawer>
</template>

<style scoped>
.grid-dashboard-scroll{min-height:0;margin:var(--space-3) var(--ds-page-inset) var(--space-6)}.grid-dashboard-top{display:grid;min-height:260px;grid-template-columns:minmax(0,1.55fr) minmax(190px,.55fr) minmax(190px,.55fr);gap:8px}.grid-panel{min-width:0;overflow:hidden;border:1px solid var(--color-border-default);border-radius:8px;background:var(--color-bg-surface)}.grid-panel>header,.grid-system-table>header{display:flex;min-height:40px;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid var(--color-border-default)}.grid-panel>header strong,.grid-system-table>header strong{font-size:12px}.grid-panel>header span,.grid-system-table>header span{color:var(--color-text-tertiary);font-size:8px}
.grid-switch-overview{display:flex;flex-direction:column}.switch-map{display:grid;min-height:0;flex:1;grid-template-columns:minmax(105px,.9fr) 48px minmax(145px,1.1fr) 48px minmax(155px,1.25fr);align-items:center;padding:12px;background:linear-gradient(180deg,var(--color-bg-muted),var(--color-bg-surface))}.switch-source,.switch-targets{display:grid;gap:8px}.switch-source section,.switch-targets section{display:flex;min-width:0;min-height:48px;align-items:center;gap:8px;padding:7px 9px;border:1px solid var(--color-border-default);border-radius:6px;background:var(--color-bg-surface)}.switch-source section.is-standby{border-style:dashed}.switch-source .el-icon,.switch-targets .el-icon{flex:0 0 auto;color:var(--color-primary-500)}.switch-source span,.switch-targets span{min-width:0}.switch-source small,.switch-source strong,.switch-targets small,.switch-targets strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.switch-source small,.switch-targets small{color:var(--color-text-secondary);font-size:8px}.switch-source strong,.switch-targets strong{margin-top:2px;font-size:10px}.switch-ats{display:grid;min-height:96px;place-items:center;align-content:center;border:1px solid color-mix(in srgb,var(--color-primary-500) 58%,var(--color-border-default));border-radius:7px;background:var(--color-bg-surface)}.switch-ats .el-icon{color:var(--color-primary-500);font-size:18px}.switch-ats strong{margin-top:5px;font-size:11px}.switch-ats span{margin-top:3px;color:var(--color-text-secondary);font-size:9px}.switch-ats small{margin-top:5px;color:var(--color-warning-default);font-size:8px}.switch-link{position:relative;height:2px;background:color-mix(in srgb,var(--color-primary-500) 42%,var(--color-border-default))}.switch-link::before,.switch-link i{position:absolute;top:50%;width:6px;height:6px;border-radius:50%;background:var(--color-primary-400);content:'';transform:translateY(-50%)}.switch-link::before{left:-1px}.switch-link i{right:-1px}.switch-link em{position:absolute;top:-19px;left:50%;color:var(--color-text-secondary);font-size:8px;font-style:normal;white-space:nowrap;transform:translateX(-50%)}.switch-link.is-output{background:repeating-linear-gradient(90deg,var(--color-primary-400) 0 7px,transparent 7px 11px)}.grid-switch-overview>footer{display:flex;min-height:36px;align-items:center;justify-content:center;gap:22px;border-top:1px solid var(--color-border-default)}.grid-switch-overview>footer span{color:var(--color-text-secondary);font-size:8px}.grid-switch-overview>footer strong{margin-left:3px;color:var(--color-text-primary);font-size:9px}
.grid-checks ul{margin:0;padding:0 12px;list-style:none}.grid-checks li{display:flex;min-height:36px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--color-border-default);font-size:9px}.grid-checks li:last-child{border-bottom:0}.grid-checks em{min-width:48px;height:20px;border-radius:4px;color:var(--color-text-secondary);font-size:8px;font-style:normal;line-height:20px;text-align:center;background:var(--color-bg-muted)}.grid-parameters dl{margin:0;padding:0 12px}.grid-parameters dl div{display:flex;min-height:36px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--color-border-default)}.grid-parameters dl div:last-child{border-bottom:0}.grid-parameters dt{color:var(--color-text-secondary);font-size:9px}.grid-parameters dd{margin:0;font-size:10px;font-variant-numeric:tabular-nums}
.grid-dashboard-middle{display:grid;min-height:112px;grid-template-columns:minmax(0,1.8fr) minmax(240px,.7fr);gap:8px;margin-top:8px}.grid-process{display:flex;flex-direction:column}.process-line{display:flex;min-height:0;flex:1;align-items:center;padding:8px 30px}.process-line section{display:grid;min-width:74px;place-items:center}.process-line section i{display:grid;width:22px;height:22px;place-items:center;border:1px solid var(--color-primary-300);border-radius:50%;color:var(--color-primary-500);font-size:8px;font-style:normal;background:var(--color-primary-50)}.process-line section strong{margin-top:5px;font-size:9px}.process-line section small{margin-top:2px;color:var(--color-text-tertiary);font-size:8px}.process-line>span{height:2px;min-width:28px;flex:1;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--color-primary-500) 48%,var(--color-border-default)) 0 7px,transparent 7px 11px)}.grid-distribution>div{display:flex;height:calc(100% - 40px);align-items:center;justify-content:center;gap:25px}.distribution-ring{display:grid;width:64px;height:64px;place-items:center;align-content:center;border:8px solid color-mix(in srgb,var(--color-text-tertiary) 35%,var(--color-border-default));border-radius:50%}.distribution-ring strong{font-size:16px}.distribution-ring small{color:var(--color-text-secondary);font-size:8px}.grid-distribution p{display:flex;align-items:center;gap:6px;margin:0;color:var(--color-text-secondary);font-size:8px}.grid-distribution p i{width:8px;height:8px;border-radius:2px;background:var(--color-text-tertiary)}.grid-distribution p strong{margin-left:8px;color:var(--color-text-primary);font-size:11px}
.grid-system-table{margin-top:8px}.grid-system-table :deep(.ds-list-table-shell){border:0;border-radius:0}
@media(max-width:1180px){.grid-dashboard-top{grid-template-columns:minmax(0,1.5fr) minmax(165px,.55fr) minmax(165px,.55fr)}.switch-map{grid-template-columns:minmax(90px,.9fr) 28px minmax(130px,1fr) 28px minmax(130px,1.15fr);padding:8px}.grid-switch-overview>footer{gap:10px}.process-line{padding-right:15px;padding-left:15px}}
@media(max-height:760px){.grid-dashboard-top{height:214px;min-height:214px}.grid-panel>header{min-height:34px}.grid-dashboard-middle{height:82px;min-height:82px}.switch-map{padding:5px 8px}.switch-source,.switch-targets{gap:5px}.switch-source section,.switch-targets section{height:30px;min-height:30px;box-sizing:border-box;padding:3px 6px}.switch-source small,.switch-targets small{display:none}.switch-ats{min-height:72px}.grid-switch-overview>footer{min-height:30px}.grid-checks li,.grid-parameters dl div{height:30px;min-height:30px}.process-line{padding-top:3px;padding-bottom:3px}.process-line section i{width:18px;height:18px}.process-line section strong{margin-top:2px}.process-line section small{margin-top:0}.distribution-ring{width:40px;height:40px;border-width:5px}.grid-distribution>div{height:calc(100% - 34px)}}
:deep(.monitor-kpis article:first-child strong){font-size:15px;white-space:nowrap}
</style>
