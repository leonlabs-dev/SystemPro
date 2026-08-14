<script setup lang="ts">
import { Refresh, Search } from '@element-plus/icons-vue';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { ApiError } from '@/core/api/contracts';
import DsDataTable from '@/design-system/components/DsDataTable.vue';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useListPageState } from '@/design-system/composables/useListPageState';
import { enterpriseMeteringApi, type MeteringUsageAnalysis } from '@/domain/iot/metering-loss';
import { enumLabel } from '@/core/i18n/enum-labels';
import './enterprise-metering.css';

const loading = ref(true);
const dates = ref<[string, string]>(defaultRange());
const dimension = ref('ALL');
const result = ref<MeteringUsageAnalysis>({
  periodStart: '', periodEnd: '', totalUsage: 0, unitSymbol: 'kWh', sourceBoundary: '', rows: [],
});

function localDate(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function defaultRange(): [string, string] {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return [localDate(start), localDate(end)];
}

function format(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

const rows = computed(() => (
  dimension.value === 'ALL'
    ? result.value.rows
    : result.value.rows.filter((row) => row.dimensionType === dimension.value)
));
const { page, pageSize, pagedRows } = useListPageState({
  rows,
  resetDeps: () => [dimension.value, dates.value[0], dates.value[1]],
});

async function load() {
  loading.value = true;
  try {
    result.value = await enterpriseMeteringApi.usage({
      periodStart: `${dates.value[0]}T00:00:00`,
      periodEnd: `${dates.value[1]}T23:59:59`,
    });
  } catch (error) {
    ElMessage.error(error instanceof ApiError ? error.message : '用能分析加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <DsListPageShell
    title="用能分析"
    subtitle="按空间、租户、用能分项和设备系统统一分析"
    page-class="enterprise-metering-page"
    :loading="loading"
  >
    <div class="enterprise-content">
      <section class="enterprise-query-bar">
        <div class="enterprise-query-bar__field enterprise-query-bar__field--date">
          <label>统计周期</label>
          <el-date-picker v-model="dates" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" />
        </div>
        <div class="enterprise-query-bar__summary">
          <span>统计范围</span>
          <strong>当前已发布计量方案中的末级用能对象</strong>
          <small>支持空间、租户、用能分项和设备系统维度</small>
        </div>
        <div class="enterprise-query-bar__actions">
          <el-button type="primary" :icon="Search" @click="load">查询</el-button>
          <el-button :icon="Refresh" @click="load">刷新</el-button>
        </div>
      </section>

      <section class="enterprise-kpis">
        <article><span>核算总电量</span><strong>{{ format(result.totalUsage) }} {{ result.unitSymbol }}</strong><small>来自已入库的区间计量数据</small></article>
        <article><span>用能对象</span><strong>{{ result.rows.length }}</strong><small>当前方案末级节点</small></article>
        <article><span>最大用能项</span><strong>{{ result.rows[0]?.shareRate || 0 }}%</strong><small>{{ result.rows[0]?.nodeName || '--' }}</small></article>
        <article><span>数据来源</span><strong style="font-size: 16px">{{ enumLabel('sourceBoundary', result.sourceBoundary) }}</strong><small>查询仅汇总现有数据，不临时补算</small></article>
      </section>

      <section class="enterprise-panel">
        <header class="enterprise-panel__header">
          <div><h2>用能构成</h2><p>同一计量点可按当前计量方案归入空间、租户或用能分项，实际设备连接关系不受影响。</p></div>
          <el-select v-model="dimension" style="width: 160px">
            <el-option label="全部维度" value="ALL" /><el-option label="空间" value="SPACE" /><el-option label="用能分项" value="END_USE" /><el-option label="设备系统" value="SYSTEM" /><el-option label="租户" value="TENANT" />
          </el-select>
        </header>
        <div class="enterprise-content">
          <div v-for="row in rows" :key="row.nodeId" class="enterprise-progress-row">
            <span>{{ row.nodeName }}</span><el-progress :percentage="Math.min(100, Number(row.shareRate))" :show-text="false" /><b>{{ row.shareRate }}%</b>
          </div>
        </div>
        <section class="ds-list-table-shell ds-list-table-shell--embedded enterprise-table-shell">
          <DsDataTable :rows="pagedRows as unknown as Record<string, unknown>[]" :columns="[]" table-layout="fixed">
            <el-table-column prop="nodeName" label="用能对象" min-width="220" />
            <el-table-column label="核算维度" width="120"><template #default="{ row }">{{ enumLabel('dimensionType', row.dimensionType) }}</template></el-table-column>
            <el-table-column prop="calculationMethod" label="计量方式" width="120"><template #default="{ row }"><DsTag type="primary">{{ enumLabel('calculationMethod', row.calculationMethod) }}</DsTag></template></el-table-column>
            <el-table-column label="本期电量" min-width="150" align="right"><template #default="{ row }"><strong>{{ format(row.usage) }} {{ row.unitSymbol }}</strong></template></el-table-column>
            <el-table-column label="占比" width="100" align="right"><template #default="{ row }">{{ row.shareRate }}%</template></el-table-column>
            <el-table-column label="数据质量" width="100"><template #default="{ row }"><DsTag :type="row.qualityStatus === 'GOOD' ? 'success' : row.qualityStatus === 'CORRECTED' ? 'primary' : 'warning'">{{ enumLabel('qualityStatus', row.qualityStatus) }}</DsTag></template></el-table-column>
            <template #empty><DsEmpty description="当前条件没有用能核算结果" /></template>
          </DsDataTable>
          <footer v-if="rows.length" class="ds-list-table-footer ds-list-table-footer--pagination-only">
            <DsPagination v-model:page="page" v-model:page-size="pageSize" :total="rows.length" />
          </footer>
        </section>
      </section>
    </div>
  </DsListPageShell>
</template>
