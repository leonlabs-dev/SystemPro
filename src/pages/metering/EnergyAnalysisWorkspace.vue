<script setup lang="ts">
import { Download,Refresh,Search } from '@element-plus/icons-vue';
import { computed,onMounted,ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { ApiError } from '@/core/api/contracts';
import { useAuthStore } from '@/core/auth/auth.store';
import { lossAnalysisPermissions } from '@/domain/iot/assets/meter';
import { lossAnalysisApi,type LossAnalysis } from '@/domain/iot/metering-loss';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsDataTable from '@/design-system/components/DsDataTable.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useListPageState } from '@/design-system/composables/useListPageState';

const props=defineProps<{titleKey:string}>();
const {locale,t}=useI18n();
const auth=useAuthStore();
const loading=ref(true),exporting=ref(false);
const result=ref<LossAnalysis>({periodStart:'',periodEnd:'',sourceType:'SIMULATED_READING',totalInput:0,totalAllocated:0,totalLoss:0,overallLossRate:0,rows:[]});
const dates=ref<[string,string]>(defaultRange());
const analysisRows=computed(()=>result.value.rows);
const {page,pageSize,pagedRows}=useListPageState({rows:analysisRows,resetDeps:()=>[dates.value?.[0],dates.value?.[1]]});
const permission=computed(()=>lossAnalysisPermissions);
const canView=computed(()=>auth.can(permission.value.view));
function defaultRange():[string,string]{const end=new Date(),start=new Date(end.getFullYear(),end.getMonth(),1);return [localDate(start),localDate(end)];}
function localDate(value:Date){return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,10);}
function queryRange():[string,string]{return [`${dates.value[0]}T00:00:00`,`${dates.value[1]}T23:59:59`];}
function tone(value:string){return value==='NORMAL'?'success':value==='WARNING'?'warning':'error';}
function status(value:string){return t(`meteringPages.loss.status.${value}`);}
function format(value:number){return Number(value||0).toLocaleString(locale.value,{minimumFractionDigits:3,maximumFractionDigits:3});}
function showError(error:unknown,fallback:string){ElMessage.error(error instanceof ApiError?error.message:fallback);}
async function load(){if(!canView.value)return;loading.value=true;try{const [from,to]=queryRange();result.value=await lossAnalysisApi.analyze(from,to,'ELECTRICITY');}catch(error){showError(error,t('meteringPages.loss.messages.loadFailed'));}finally{loading.value=false;}}
async function exportFile(){if(!auth.can(permission.value.export))return;exporting.value=true;try{const [from,to]=queryRange();const blob=await lossAnalysisApi.export(from,to,'ELECTRICITY');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`systempro-loss-${new Date().toISOString().slice(0,10)}.xlsx`;link.click();URL.revokeObjectURL(url);}catch(error){showError(error,t('meteringPages.loss.messages.exportFailed'));}finally{exporting.value=false;}}
onMounted(load);
</script>

<template>
  <DsListPageShell :title="t(props.titleKey)" page-class="ds-flow-list-page analysis-page">
    <template #primary-action><div class="header-actions"><el-button :icon="Refresh" :loading="loading" @click="load">{{ t('meteringPages.common.refresh') }}</el-button><el-button v-permission="permission.export" :icon="Download" :loading="exporting" @click="exportFile">{{ t('meteringPages.common.exportExcel') }}</el-button></div></template>
    <section class="source-note"><strong>{{ t('meteringPages.loss.boundary') }}</strong><span>{{ t('meteringPages.loss.boundaryHint') }}</span><DsTag type="warning">SIMULATED_READING</DsTag></section>
    <section class="compact-kpis"><article><span>{{ t('meteringPages.loss.kpi.input') }}</span><strong>{{ format(result.totalInput) }} kWh</strong></article><article><span>{{ t('meteringPages.loss.kpi.allocated') }}</span><strong>{{ format(result.totalAllocated) }} kWh</strong></article><article><span>{{ t('meteringPages.loss.kpi.loss') }}</span><strong>{{ format(result.totalLoss) }} kWh</strong></article><article><span>{{ t('meteringPages.loss.kpi.rate') }}</span><strong :class="{warning:Math.abs(result.overallLossRate)>5}">{{ result.overallLossRate }}%</strong></article></section>
    <section class="ds-list-embedded-section metering-list-workspace">
      <div class="filters ds-list-filter ds-list-filter--adaptive"><el-date-picker v-model="dates" class="ds-list-filter__date" type="daterange" value-format="YYYY-MM-DD" :range-separator="t('meteringPages.common.range')" :start-placeholder="t('meteringPages.common.start')" :end-placeholder="t('meteringPages.common.end')" /><el-button type="primary" :icon="Search" @click="load">{{ t('meteringPages.common.search') }}</el-button></div>
      <section class="ds-list-table-shell ds-list-table-shell--embedded">
      <DsDataTable :rows="pagedRows as unknown as Record<string,unknown>[]" :columns="[]" :loading="loading" table-layout="fixed">
        <el-table-column :label="t('meteringPages.loss.columns.parent')" min-width="210" show-overflow-tooltip><template #default="{row}"><div class="primary-cell"><strong>{{ row.parentPointName }}</strong><small>{{ row.parentMeterName||t('meteringPages.common.unboundMeter') }}</small></div></template></el-table-column>
        <el-table-column prop="childCount" :label="t('meteringPages.loss.columns.children')" width="76" align="right" />
        <el-table-column :label="t('meteringPages.loss.columns.input')" min-width="132" align="right"><template #default="{row}">{{ format(row.parentUsage) }} {{ row.unitSymbol }}</template></el-table-column>
        <el-table-column :label="t('meteringPages.loss.columns.allocated')" min-width="145" align="right"><template #default="{row}">{{ format(row.childUsage) }} {{ row.unitSymbol }}</template></el-table-column>
        <el-table-column :label="t('meteringPages.loss.columns.difference')" min-width="128" align="right"><template #default="{row}">{{ format(row.lossQuantity) }} {{ row.unitSymbol }}</template></el-table-column>
        <el-table-column :label="t('meteringPages.loss.columns.rate')" width="92" align="right"><template #default="{row}">{{ row.lossRate }}%</template></el-table-column>
        <el-table-column :label="t('meteringPages.common.status')" width="82"><template #default="{row}"><DsTag :type="tone(row.status)">{{ status(row.status) }}</DsTag></template></el-table-column>
        <template #empty><DsEmpty :title="t('meteringPages.loss.empty.title')" :description="t('meteringPages.loss.empty.description')" /></template>
      </DsDataTable>
      <footer v-if="result.rows.length" class="ds-list-table-footer ds-list-table-footer--pagination-only">
        <DsPagination v-model:page="page" v-model:page-size="pageSize" :total="result.rows.length" />
      </footer>
      </section>
    </section>
  </DsListPageShell>
</template>

<style scoped>
.header-actions{display:flex;align-items:center;gap:6px;margin-left:auto;white-space:nowrap}.source-note{display:flex;align-items:center;gap:10px;margin:8px 16px;padding:6px 10px;border:1px solid color-mix(in srgb,var(--color-warning-default) 35%,var(--color-border-default));border-radius:var(--radius-md);background:color-mix(in srgb,var(--color-warning-default) 7%,var(--color-bg-surface));font-size:12px}.source-note span{flex:1;color:var(--color-text-secondary)}.compact-kpis{display:grid;grid-template-columns:repeat(4,1fr);margin:0 16px 8px;border:1px solid var(--color-border-default);border-radius:var(--radius-md);overflow:hidden;background:var(--color-bg-surface)}.compact-kpis article{padding:5px 10px;border-right:1px solid var(--color-border-default)}.compact-kpis article:last-child{border:0}.compact-kpis span{display:block;color:var(--color-text-secondary);font-size:11px}.compact-kpis strong{font-size:18px}.compact-kpis .warning{color:var(--color-warning-default)}.filters{display:grid;grid-template-columns:minmax(0,480px) auto;justify-content:start;gap:6px;padding:6px 8px;background:var(--color-bg-muted);border-bottom:1px solid var(--color-border-default)}.filters :deep(.el-date-editor){width:100%}.primary-cell{display:flex;flex-direction:column;min-width:0}.primary-cell strong,.primary-cell small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.primary-cell small{color:var(--color-text-secondary);font-size:11px}@media(max-width:900px){.source-note{align-items:flex-start;flex-direction:column}.compact-kpis{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:minmax(0,1fr) auto}}
</style>
