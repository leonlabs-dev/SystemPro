<script setup lang="ts">
import { Download,Refresh,Search } from '@element-plus/icons-vue';
import { computed,onMounted,ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { ApiError } from '@/core/api/contracts';
import { useAuthStore } from '@/core/auth/auth.store';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsDataTable from '@/design-system/components/DsDataTable.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useListPageState } from '@/design-system/composables/useListPageState';
import { subitemReportPermissions } from '@/domain/iot/assets/meter';
import { subitemReportApi,type SubitemEnergyReport } from '@/domain/iot/metering-loss';

const auth=useAuthStore();
const {locale,t}=useI18n();
const loading=ref(true),exporting=ref(false),dates=ref<[string,string]>(defaultRange());
const result=ref<SubitemEnergyReport>({periodStart:'',periodEnd:'',energyType:'ELECTRICITY',sourceType:'SIMULATED_READING',totalUsage:0,parentPointCount:0,subitemPointCount:0,rows:[]});
const rows=computed(()=>result.value.rows);
const {page,pageSize,pagedRows}=useListPageState({rows,resetDeps:()=>[dates.value?.[0],dates.value?.[1]]});
function localDate(value:Date){return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,10);}
function defaultRange():[string,string]{const end=new Date(),start=new Date(end.getFullYear(),end.getMonth(),1);return [localDate(start),localDate(end)];}
function queryRange():[string,string]{return [`${dates.value[0]}T00:00:00`,`${dates.value[1]}T23:59:59`];}
function format(value:number,digits=2){return Number(value||0).toLocaleString(locale.value,{minimumFractionDigits:digits,maximumFractionDigits:digits});}
function relationLabel(value?:string){return value?t(`meteringPages.relation.${value}`,value):'--';}
function showError(error:unknown,fallback:string){ElMessage.error(error instanceof ApiError?error.message:fallback);}
async function load(){if(!auth.can(subitemReportPermissions.view))return;loading.value=true;try{const [from,to]=queryRange();result.value=await subitemReportApi.report(from,to,'ELECTRICITY');}catch(error){showError(error,t('meteringPages.report.messages.loadFailed'));}finally{loading.value=false;}}
async function exportFile(){if(!auth.can(subitemReportPermissions.export))return;exporting.value=true;try{const [from,to]=queryRange();const blob=await subitemReportApi.export(from,to,'ELECTRICITY');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`systempro-subitem-energy-${new Date().toISOString().slice(0,10)}.xlsx`;link.click();URL.revokeObjectURL(url);}catch(error){showError(error,t('meteringPages.report.messages.exportFailed'));}finally{exporting.value=false;}}
onMounted(load);
</script>

<template>
  <DsListPageShell :title="t('meteringPages.report.title')" page-class="ds-flow-list-page subitem-report-page">
    <template #primary-action><div class="header-actions"><el-button :icon="Refresh" :loading="loading" @click="load">{{ t('meteringPages.common.refresh') }}</el-button><el-button v-permission="subitemReportPermissions.export" :icon="Download" :loading="exporting" @click="exportFile">{{ t('meteringPages.common.exportExcel') }}</el-button></div></template>
    <section class="compact-kpis"><article><span>{{ t('meteringPages.report.kpi.parent') }}</span><strong>{{ result.parentPointCount }}</strong></article><article><span>{{ t('meteringPages.report.kpi.subitem') }}</span><strong>{{ result.subitemPointCount }}</strong></article><article><span>{{ t('meteringPages.report.kpi.usage') }}</span><strong>{{ format(result.totalUsage,3) }} kWh</strong></article><article><span>{{ t('meteringPages.report.kpi.source') }}</span><strong class="source-value">{{ t('meteringPages.common.simulatedReading') }}</strong></article></section>
    <section class="ds-list-embedded-section metering-list-workspace">
      <div class="filters ds-list-filter ds-list-filter--adaptive"><el-date-picker v-model="dates" class="ds-list-filter__date" type="daterange" value-format="YYYY-MM-DD" :range-separator="t('meteringPages.common.range')" :start-placeholder="t('meteringPages.common.start')" :end-placeholder="t('meteringPages.common.end')" /><el-button type="primary" :icon="Search" @click="load">{{ t('meteringPages.common.search') }}</el-button><DsTag type="warning">{{ t('meteringPages.common.simulatedReading') }}</DsTag></div>
      <section class="ds-list-table-shell ds-list-table-shell--embedded">
      <DsDataTable :rows="pagedRows as unknown as Record<string,unknown>[]" :columns="[]" :loading="loading" table-layout="fixed">
        <el-table-column :label="t('meteringPages.report.columns.parent')" min-width="190" show-overflow-tooltip><template #default="{row}"><div class="primary-cell"><strong>{{ row.parentPointName }}</strong><small>{{ row.parentMeterName||'--' }}</small></div></template></el-table-column>
        <el-table-column :label="t('meteringPages.report.columns.subitem')" min-width="210" show-overflow-tooltip><template #default="{row}"><div class="primary-cell"><strong>{{ row.subitemPointName }}</strong><small>{{ row.subitemMeterName||'--' }}</small></div></template></el-table-column>
        <el-table-column :label="t('meteringPages.report.columns.relation')" width="132"><template #default="{row}"><DsTag type="primary">{{ relationLabel(row.relationType) }}</DsTag></template></el-table-column>
        <el-table-column :label="t('meteringPages.report.columns.factor')" width="96" align="right"><template #default="{row}">{{ format(row.contributionFactor,4) }}</template></el-table-column>
        <el-table-column :label="t('meteringPages.report.columns.raw')" width="130" align="right"><template #default="{row}">{{ format(row.rawUsage,3) }} {{ row.unitSymbol }}</template></el-table-column>
        <el-table-column :label="t('meteringPages.report.columns.adjusted')" width="130" align="right"><template #default="{row}"><strong>{{ format(row.adjustedUsage,3) }} {{ row.unitSymbol }}</strong></template></el-table-column>
        <el-table-column :label="t('meteringPages.report.columns.validity')" width="180"><template #default="{row}"><div class="primary-cell"><strong>{{ row.validFrom.replace('T',' ').slice(0,16) }}</strong><small>{{ t('meteringPages.common.range') }} {{ row.validTo?row.validTo.replace('T',' ').slice(0,16):t('meteringPages.common.longTerm') }}</small></div></template></el-table-column>
        <template #empty><DsEmpty :title="t('meteringPages.report.empty.title')" :description="t('meteringPages.report.empty.description')" /></template>
      </DsDataTable>
      <footer v-if="rows.length" class="ds-list-table-footer ds-list-table-footer--pagination-only"><DsPagination v-model:page="page" v-model:page-size="pageSize" :total="rows.length" /></footer>
      </section>
    </section>
  </DsListPageShell>
</template>

<style scoped>
.header-actions{display:flex;align-items:center;gap:6px;margin-left:auto;white-space:nowrap}.compact-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:8px 16px;border:1px solid var(--color-border-default);border-radius:var(--radius-md);overflow:hidden;background:var(--color-bg-surface)}.compact-kpis article{padding:6px 10px;border-right:1px solid var(--color-border-default)}.compact-kpis article:last-child{border:0}.compact-kpis span{display:block;color:var(--color-text-secondary);font-size:11px}.compact-kpis strong{font-size:18px}.compact-kpis .source-value{color:var(--color-warning-default);font-size:14px}.filters{display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--color-bg-muted);border-bottom:1px solid var(--color-border-default)}.filters :deep(.el-date-editor){width:min(480px,48vw)}.primary-cell{display:flex;flex-direction:column;min-width:0}.primary-cell strong,.primary-cell small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.primary-cell small{color:var(--color-text-secondary);font-size:11px}@media(max-width:900px){.compact-kpis{grid-template-columns:repeat(2,1fr)}.compact-kpis article:nth-child(2){border-right:0}.filters{flex-wrap:wrap}.filters :deep(.el-date-editor){width:100%}}
</style>
