<script setup lang="ts">
import {Refresh,Search} from '@element-plus/icons-vue';
import {onMounted,ref} from 'vue';
import {ElMessage} from 'element-plus';
import {ApiError} from '@/core/api/contracts';
import DsDataTable from '@/design-system/components/DsDataTable.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import {enterpriseMeteringApi,type BalanceMeteringAnalysis,type EnterpriseMeteringOverview} from '@/domain/iot/metering-loss';
import {enumLabel} from '@/core/i18n/enum-labels';
import './enterprise-metering.css';

const loading=ref(true);const dates=ref<[string,string]>(defaultRange());
const overview=ref<EnterpriseMeteringOverview>();const balance=ref<BalanceMeteringAnalysis>();
function localDate(value:Date){return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function defaultRange():[string,string]{const end=new Date(),start=new Date(end.getFullYear(),end.getMonth(),1);return[localDate(start),localDate(end)]}
function params(){return{periodStart:`${dates.value[0]}T00:00:00`,periodEnd:`${dates.value[1]}T23:59:59`}}
function format(value?:number,digits=2){return Number(value||0).toLocaleString('zh-CN',{minimumFractionDigits:digits,maximumFractionDigits:digits})}
function tone(status:string){return status==='NORMAL'?'success':status==='WARNING'?'warning':'error'}
async function load(){loading.value=true;try{[overview.value,balance.value]=await Promise.all([enterpriseMeteringApi.overview(params()),enterpriseMeteringApi.balance(params())])}catch(error){ElMessage.error(error instanceof ApiError?error.message:'计量总览加载失败')}finally{loading.value=false}}
onMounted(load);
</script>

<template>
  <DsListPageShell title="计量总览" subtitle="企业电力计量覆盖、数据质量和边界平衡的统一入口" page-class="enterprise-metering-page" :loading="loading">
    <div v-if="overview" class="enterprise-content">
      <section class="enterprise-query-bar"><div class="enterprise-query-bar__field enterprise-query-bar__field--date"><label>统计周期</label><el-date-picker v-model="dates" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期"/></div><div class="enterprise-query-bar__summary"><span>数据口径</span><strong>区间电量 · 已发布计量版本</strong><small>{{ enumLabel('sourceBoundary', overview.sourceBoundary) }}</small></div><div class="enterprise-query-bar__actions"><el-button type="primary" :icon="Search" @click="load">查询</el-button><el-button :icon="Refresh" @click="load">刷新</el-button></div></section>
      <section class="enterprise-kpis"><article><span>物理节点 / 已计量</span><strong>{{ overview.meteredNodeCount }} / {{ overview.physicalNodeCount }}</strong><small>{{ overview.topologyVersion.name }}</small></article><article><span>计量覆盖率</span><strong>{{ overview.coverageRate }}%</strong><small>{{ overview.coveredNodeCount }} 个节点有区间电量</small></article><article><span>当前分项率</span><strong>{{ overview.subitemRate }}%</strong><small>{{ overview.accountingVersion.name }}</small></article><article><span>未解释差额</span><strong :class="{'enterprise-warning':overview.unexplainedRate>=3}">{{ format(overview.unexplainedQuantity,3) }} {{ overview.unitSymbol }}</strong><small>占输入 {{ overview.unexplainedRate }}%</small></article></section>
      <div class="enterprise-two-columns">
        <section class="enterprise-summary-card"><h2>计量模型状态</h2><dl class="enterprise-detail-list"><div><dt>配电拓扑</dt><dd>{{ overview.topologyVersion.name }} · {{ enumLabel('modelStatus', overview.topologyVersion.status) }}</dd></div><div><dt>核算树</dt><dd>{{ overview.accountingVersion.name }} · {{ enumLabel('modelStatus', overview.accountingVersion.status) }}</dd></div><div><dt>核算节点</dt><dd>{{ overview.accountingNodeCount }} 个</dd></div><div><dt>质量问题</dt><dd :class="{'enterprise-warning':overview.qualityIssueCount}">{{ overview.qualityIssueCount }} 条</dd></div></dl></section>
        <section class="enterprise-summary-card"><h2>平衡边界</h2><div v-for="row in balance?.rows" :key="row.id" class="enterprise-progress-row"><span>{{ row.name }}</span><el-progress :percentage="Math.min(100,Number(row.unexplainedRate))" :show-text="false" :status="row.status==='CRITICAL'?'exception':row.status==='WARNING'?'warning':'success'"/><b>{{ row.unexplainedRate }}%</b></div></section>
      </div>
      <section class="enterprise-panel enterprise-table-shell"><header class="enterprise-panel__header"><div><h2>平衡结果摘要</h2><p>差额不自动等同于线损；未配置经验证的技术损耗模型时全部保留为未解释差额。</p></div></header><DsDataTable :rows="(balance?.rows||[]) as unknown as Record<string,unknown>[]" :columns="[]" table-layout="fixed"><el-table-column prop="name" label="平衡组" min-width="180"/><el-table-column label="输入电量" min-width="130" align="right"><template #default="{row}">{{ format(row.inputQuantity,3) }} {{ row.unitSymbol }}</template></el-table-column><el-table-column label="输出电量" min-width="130" align="right"><template #default="{row}">{{ format(row.outputQuantity,3) }} {{ row.unitSymbol }}</template></el-table-column><el-table-column label="批准边界调整" min-width="130" align="right"><template #default="{row}">{{ format(row.inputAdjustment+row.outputAdjustment,3) }} {{ row.unitSymbol }}</template></el-table-column><el-table-column label="未解释差额" min-width="130" align="right"><template #default="{row}"><strong>{{ format(row.unexplainedQuantity,3) }} {{ row.unitSymbol }}</strong></template></el-table-column><el-table-column label="差额率" width="90" align="right"><template #default="{row}">{{ row.unexplainedRate }}%</template></el-table-column><el-table-column label="状态" width="92"><template #default="{row}"><DsTag :type="tone(row.status)">{{ row.status==='NORMAL'?'正常':row.status==='WARNING'?'关注':'异常' }}</DsTag></template></el-table-column></DsDataTable></section>
    </div>
  </DsListPageShell>
</template>
