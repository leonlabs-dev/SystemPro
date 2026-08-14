<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { Refresh, Search } from "@element-plus/icons-vue";
import { useI18n } from "vue-i18n";
import DsChart from "@/design-system/components/DsChart.vue";
import DsDataTable from "@/design-system/components/DsDataTable.vue";
import DsListPageShell from "@/design-system/components/DsListPageShell.vue";
import DsPagination from "@/design-system/components/DsPagination.vue";
import DsPrimaryCell from "@/design-system/components/DsPrimaryCell.vue";
import DsTag from "@/design-system/components/DsTag.vue";
import { useActiveLocaleDataRefresh } from "@/core/i18n/use-active-locale-data-refresh";
import { useRuntimeSettingsStore } from "@/core/settings/runtime-settings.store";
import { useThemeStore } from "@/core/theme/theme.store";
import {
  alarmStatisticsApi,
  type AlarmEvent,
  type AlarmStatistics,
  type NamedCount,
} from "@/domain/iot/alarm-work-order/api/alarm-statistics.api";
import type { EChartsCoreOption } from "@/design-system/charts/echarts-runtime";

type RankingRow = {
  name: string;
  secondary?: string;
  total: number;
  critical: number;
  active: number;
  averageMinutes?: number;
};
const { t, locale } = useI18n();
const theme = useThemeStore();
const runtimeSettings = useRuntimeSettingsStore();
const days = ref(30);
const loading = ref(true);
const error = ref("");
const activeTab = ref("details");
const page = ref(1);
const pageSize = ref(runtimeSettings.pageSize);
const detail = ref<AlarmEvent>();
const detailVisible = ref(false);
const filters = reactive({
  keyword: "",
  severity: "",
  sourceType: "",
  status: "",
});
const emptyData = (): AlarmStatistics => ({
  days: 30,
  summary: {
    total: 0,
    active: 0,
    critical: 0,
    converted: 0,
    recovered: 0,
    conversionRate: 0,
    averageRecoveryMinutes: 0,
  },
  trend: [],
  severityDistribution: [],
  sourceDistribution: [],
  statusDistribution: [],
  eventTotal: 0,
  eventPage: 1,
  eventPageSize: runtimeSettings.pageSize,
  recentEvents: [],
  severityRanking: [],
  durationRanking: [],
  assetRanking: [],
  ruleRanking: [],
});
const data = ref<AlarmStatistics>(emptyData());
const isDark = computed(() => theme.theme === "dark");
const palette = computed(() => ({
  text: isDark.value ? "#aebbd2" : "#596579",
  axis: isDark.value ? "#34435e" : "#dfe5ee",
  split: isDark.value ? "#273650" : "#edf0f5",
}));
const sourceOptions = [
  "HVAC",
  "LIGHTING",
  "PARKING",
  "CHARGING",
  "SOLAR",
  "STORAGE",
];
const severityOptions = ["CRITICAL", "MAJOR", "MINOR", "INFO"];
const statusOptions = ["ACTIVE", "ACKNOWLEDGED", "SUPPRESSED", "RECOVERED"];

const trendOption = computed<EChartsCoreOption>(() => ({
  color: ["#2f6bff", "#f25555", "#f4a62a"],
  tooltip: { trigger: "axis" },
  legend: {
    top: 0,
    right: 0,
    textStyle: { color: palette.value.text, fontSize: 10 },
  },
  grid: { left: 16, right: 12, top: 38, bottom: 10, containLabel: true },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: data.value.trend.map((v) => v.day.slice(5)),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: palette.value.axis } },
    axisLabel: { color: palette.value.text, fontSize: 9 },
  },
  yAxis: {
    type: "value",
    minInterval: 1,
    splitLine: { lineStyle: { color: palette.value.split } },
    axisLabel: { color: palette.value.text, fontSize: 9 },
  },
  series: [
    {
      name: t("alarmWorkOrder.statistics.total"),
      type: "line",
      smooth: true,
      symbol: "none",
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.08 },
      data: data.value.trend.map((v) => v.total),
    },
    {
      name: t("alarmWorkOrder.statistics.critical"),
      type: "line",
      smooth: true,
      symbol: "none",
      data: data.value.trend.map((v) => v.critical),
    },
    {
      name: t("alarmWorkOrder.statistics.recovered"),
      type: "line",
      smooth: true,
      symbol: "none",
      data: data.value.trend.map((v) => v.recovered),
    },
  ],
}));
const severityOption = computed<EChartsCoreOption>(() => {
  const total = Math.max(1, data.value.summary.total);
  const rows = data.value.severityDistribution.map((row) => ({
    name: label("severity", row.name),
    value: row.value,
    percentage: ((row.value / total) * 100).toFixed(1),
  }));
  return {
    color: ["#f25555", "#f4a62a", "#ffc342", "#3b82f6"],
    tooltip: { trigger: "item", formatter: "{b}<br/>{c} 起 · {d}%" },
    legend: {
      orient: "vertical",
      right: "4%",
      top: "center",
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 12,
      formatter: (name: string) => {
        const row = rows.find((item) => item.name === name);
        return row
          ? `{name|${name}}  {value|${row.value}}  {percent|${row.percentage}%}`
          : name;
      },
      textStyle: {
        color: palette.value.text,
        fontSize: 9,
        rich: {
          name: { width: 34, color: palette.value.text },
          value: {
            width: 20,
            color: palette.value.text,
            fontWeight: 700,
            align: "right",
          },
          percent: { width: 38, color: palette.value.text, align: "right" },
        },
      },
    },
    series: [
      {
        type: "pie",
        radius: ["54%", "74%"],
        center: ["34%", "52%"],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: { scale: true, scaleSize: 4 },
        itemStyle: {
          borderColor: isDark.value ? "#172033" : "#fff",
          borderWidth: 2,
          borderRadius: 3,
        },
        data: rows.map((row) => ({ name: row.name, value: row.value })),
      },
    ],
  };
});
const sourceOption = computed<EChartsCoreOption>(() => {
  const rows = [...data.value.sourceDistribution].slice(0, 10).reverse();
  return {
    color: ["#4385f5"],
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 12, right: 22, top: 12, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: palette.value.split } },
      axisLabel: { color: palette.value.text, fontSize: 9 },
    },
    yAxis: {
      type: "category",
      data: rows.map((row) => label("source", row.name)),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: palette.value.text, fontSize: 9 },
    },
    series: [
      {
        type: "bar",
        barWidth: 9,
        data: rows.map((row) => row.value),
        label: {
          show: true,
          position: "right",
          color: palette.value.text,
          fontSize: 9,
        },
        itemStyle: { borderRadius: [0, 4, 4, 0] },
      },
    ],
  };
});
const pageRows = computed(() => data.value.recentEvents);
const severityRows = computed<RankingRow[]>(() =>
  data.value.severityRanking.map((row) => ({ ...row, name: label("severity", row.name) })),
);
const sourceRows = computed<RankingRow[]>(() =>
  data.value.sourceDistribution.map((row) => ({
    name: label("source", row.name), total: row.value, critical: 0, active: 0,
  })),
);
const durationRows = computed<RankingRow[]>(() => data.value.durationRanking);
const assetRows = computed<RankingRow[]>(() => data.value.assetRanking);
const ruleRows = computed<RankingRow[]>(() =>
  data.value.ruleRanking.map((row) => ({
    ...row,
    name: row.name === "0"
      ? t("alarmWorkOrder.statistics.unlinkedRule")
      : t("alarmWorkOrder.statistics.ruleNumber", { id: row.name }),
  })),
);
function label(group: string, name: string) {
  const key = `alarmWorkOrder.${group}.${name}`;
  const value = t(key);
  return value === key ? name : value;
}
function severityType(v: string): "error" | "warning" | "info" {
  return v === "CRITICAL" ? "error" : v === "MAJOR" ? "warning" : "info";
}
function statusType(v: string): "error" | "warning" | "success" | "info" {
  return v === "ACTIVE"
    ? "error"
    : v === "ACKNOWLEDGED"
      ? "warning"
      : v === "RECOVERED"
        ? "success"
        : "info";
}
function sourceLabel(value?: string) {
  return value ? t(`alarmWorkOrder.source.${value}`) : "—";
}
function formatTime(v?: string) {
  if (!v) return "—";
  return new Intl.DateTimeFormat(locale.value === "en-US" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(v));
}
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const response = await alarmStatisticsApi.statistics({
      days: days.value,
      keyword: filters.keyword,
      severity: filters.severity,
      sourceType: filters.sourceType,
      status: filters.status,
      page: page.value,
      pageSize: pageSize.value,
    });
    data.value = response;
    if (page.value !== response.eventPage) page.value = response.eventPage;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}
function changeDays() {
  page.value = 1;
  void load();
}
function reset() {
  Object.assign(filters, {
    keyword: "",
    severity: "",
    sourceType: "",
    status: "",
  });
  page.value = 1;
}
function openDetail(row: AlarmEvent) {
  detail.value = row;
  detailVisible.value = true;
}
watch(
  () => [filters.keyword, filters.severity, filters.sourceType, filters.status],
  () => {
    page.value = 1;
    scheduleLoad();
  },
  { deep: true },
);
let loadTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleLoad() {
  if (loadTimer) clearTimeout(loadTimer);
  loadTimer = setTimeout(() => void load(), 180);
}
watch([page, pageSize], () => scheduleLoad());
watch(
  () => runtimeSettings.pageSize,
  (value) => {
    pageSize.value = value;
    page.value = 1;
    scheduleLoad();
  },
);
useActiveLocaleDataRefresh(load);
onMounted(async () => {
  await runtimeSettings.load().catch(() => undefined);
  pageSize.value = runtimeSettings.pageSize;
  await load();
});
</script>

<template>
  <DsListPageShell
    :title="t('alarmWorkOrder.statistics.title')"
    :subtitle="t('alarmWorkOrder.statistics.subtitle')"
    :loading="loading"
    :error="error"
    page-class="alarm-stat-page"
  >
    <template #header-extra
      ><el-radio-group v-model="days" size="small" @change="changeDays"
        ><el-radio-button :label="7">{{
          t("alarmWorkOrder.statistics.days7")
        }}</el-radio-button
        ><el-radio-button :label="30">{{
          t("alarmWorkOrder.statistics.days30")
        }}</el-radio-button
        ><el-radio-button :label="90">{{
          t("alarmWorkOrder.statistics.days90")
        }}</el-radio-button></el-radio-group
      ></template
    >
    <template #primary-action
      ><el-button
        class="ds-list-page__primary-action"
        :icon="Refresh"
        :loading="loading"
        @click="load"
        >{{ t("alarmWorkOrder.common.refresh") }}</el-button
      ></template
    >
    <section class="alarm-stat-kpis">
      <article>
        <span>{{ t("alarmWorkOrder.statistics.total") }}</span
        ><strong>{{ data.summary.total }}</strong
        ><small>{{ t("alarmWorkOrder.statistics.ledgerDays", { days }) }}</small>
      </article>
      <article>
        <span>{{ t("alarmWorkOrder.statistics.active") }}</span
        ><strong class="is-warning">{{ data.summary.active }}</strong
        ><small>{{ t("alarmWorkOrder.statistics.pendingHint") }}</small>
      </article>
      <article>
        <span>{{ t("alarmWorkOrder.statistics.recovered") }}</span
        ><strong class="is-success">{{ data.summary.recovered }}</strong
        ><small>{{ t("alarmWorkOrder.statistics.recoveredHint") }}</small>
      </article>
      <article>
        <span>{{ t("alarmWorkOrder.statistics.averageRecovery") }}</span
        ><strong>{{ data.summary.averageRecoveryMinutes }}<em> min</em></strong
        ><small>{{ t("alarmWorkOrder.statistics.recoveryHint") }}</small>
      </article>
      <article>
        <span>{{ t("alarmWorkOrder.statistics.converted") }}</span
        ><strong>{{ data.summary.converted }}</strong
        ><small>{{ t("alarmWorkOrder.statistics.conversionHint", { rate: data.summary.conversionRate }) }}</small>
      </article>
      <article>
        <span>{{ t("alarmWorkOrder.statistics.critical") }}</span
        ><strong class="is-danger">{{ data.summary.critical }}</strong
        ><small>{{ t("alarmWorkOrder.severity.CRITICAL") }}</small>
      </article>
    </section>
    <section class="alarm-stat-charts">
      <article>
        <header>
          <strong>{{ t("alarmWorkOrder.statistics.trend") }}</strong
          ><span>{{ t("alarmWorkOrder.statistics.eventUnit") }}</span>
        </header>
        <DsChart class="alarm-stat-chart" :option="trendOption" />
      </article>
      <article class="alarm-severity-card">
        <header>
          <strong>{{
            t("alarmWorkOrder.statistics.severityDistribution")
          }}</strong
          ><span>{{ t("alarmWorkOrder.statistics.currentWindow") }}</span>
        </header>
        <DsChart class="alarm-stat-chart" :option="severityOption" />
        <div class="alarm-donut-center">
          <strong>{{ data.summary.total }}</strong
          ><span>{{ t("alarmWorkOrder.statistics.total") }}</span>
        </div>
      </article>
      <article>
        <header>
          <strong
            >{{
              t("alarmWorkOrder.statistics.sourceDistribution")
            }}
            TOP10</strong
          ><span>{{ t("alarmWorkOrder.statistics.eventUnit") }}</span>
        </header>
        <DsChart class="alarm-stat-chart" :option="sourceOption" />
      </article>
    </section>
    <section class="ds-list-embedded-section alarm-stat-workspace">
      <el-tabs v-model="activeTab" class="alarm-stat-tabs">
        <el-tab-pane :label="t('alarmWorkOrder.statistics.detailsTab')" name="details" /><el-tab-pane
          :label="t('alarmWorkOrder.statistics.severityTab')"
          name="severity"
        /><el-tab-pane :label="t('alarmWorkOrder.statistics.durationTab')" name="duration" /><el-tab-pane
          :label="t('alarmWorkOrder.statistics.assetsTab')"
          name="assets"
        /><el-tab-pane :label="t('alarmWorkOrder.statistics.rulesTab')" name="rules" />
      </el-tabs>
      <div
        v-if="activeTab === 'details'"
        class="ds-list-filter ds-list-filter--adaptive alarm-stat-toolbar"
      >
        <el-input
          v-model="filters.keyword"
          class="ds-list-filter__keyword"
          clearable
          :prefix-icon="Search"
          :placeholder="t('alarmWorkOrder.statistics.keyword')"
        /><el-select
          v-model="filters.severity"
          class="ds-list-filter__select"
          clearable
          :placeholder="t('alarmWorkOrder.statistics.allSeverity')"
          ><el-option
            v-for="v in severityOptions"
            :key="v"
            :label="t(`alarmWorkOrder.severity.${v}`)"
            :value="v" /></el-select
        ><el-select
          v-model="filters.sourceType"
          class="ds-list-filter__select"
          clearable
          :placeholder="t('alarmWorkOrder.statistics.allSource')"
          ><el-option
            v-for="v in sourceOptions"
            :key="v"
            :label="t(`alarmWorkOrder.source.${v}`)"
            :value="v" /></el-select
        ><el-select
          v-model="filters.status"
          class="ds-list-filter__select"
          clearable
          :placeholder="t('alarmWorkOrder.statistics.allStatus')"
          ><el-option
            v-for="v in statusOptions"
            :key="v"
            :label="t(`alarmWorkOrder.alarmStatus.${v}`)"
            :value="v" /></el-select
        ><span />
        <div class="ds-list-filter__actions">
          <el-button class="ds-list-filter__button" @click="reset">{{
            t("alarmWorkOrder.common.reset")
          }}</el-button>
        </div>
      </div>
      <section class="ds-list-table-shell ds-list-table-shell--embedded">
        <DsDataTable
          v-if="activeTab === 'details'"
          :rows="pageRows as unknown as Record<string, unknown>[]"
          :columns="[]"
          row-key="id"
          :loading="loading"
          :empty-text="t('alarmWorkOrder.statistics.noEvents')"
        >
          <el-table-column :label="t('alarmWorkOrder.statistics.occurredAt')" width="154"
            ><template #default="{ row }">{{
              formatTime(row.occurredAt)
            }}</template></el-table-column
          ><el-table-column :label="t('alarmWorkOrder.common.severity')" width="84"
            ><template #default="{ row }"
              ><DsTag size="small" :type="severityType(row.severity)">{{
                t(`alarmWorkOrder.severity.${row.severity}`)
              }}</DsTag></template
            ></el-table-column
          ><el-table-column :label="t('alarmWorkOrder.statistics.content')" min-width="190"
            ><template #default="{ row }"
              ><DsPrimaryCell
                :primary="row.title"
                :secondary="row.code" /></template></el-table-column
          ><el-table-column :label="t('alarmWorkOrder.common.source')" width="90"
            ><template #default="{ row }">{{
              sourceLabel(row.sourceType)
            }}</template></el-table-column
          ><el-table-column :label="t('alarmWorkOrder.statistics.assetAndCode')" min-width="175"
            ><template #default="{ row }"
              ><DsPrimaryCell
                :primary="row.assetName"
                :secondary="row.assetCode" /></template></el-table-column
          ><el-table-column :label="t('alarmWorkOrder.common.status')" width="92"
            ><template #default="{ row }"
              ><DsTag size="small" :type="statusType(row.status)">{{
                t(`alarmWorkOrder.alarmStatus.${row.status}`)
              }}</DsTag></template
            ></el-table-column
          ><el-table-column :label="t('alarmWorkOrder.statistics.linkedTicket')" min-width="125"
            ><template #default="{ row }"
              ><router-link
                v-if="row.workOrderCode"
                class="alarm-stat-link"
                :to="{
                  path: '/alarm-work-order/tickets',
                  query: { keyword: row.workOrderCode },
                }"
                >{{ row.workOrderCode }}</router-link
              ><span v-else>—</span></template
            ></el-table-column
          ><el-table-column fixed="right" width="68"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="openDetail(row)"
                >{{ t("alarmWorkOrder.common.detail") }}</el-button
              ></template
            ></el-table-column
          >
        </DsDataTable>
        <DsDataTable
          v-else-if="activeTab === 'duration'"
          :rows="durationRows as unknown as Record<string, unknown>[]"
          :columns="[]"
          :empty-text="t('alarmWorkOrder.statistics.noRecovered')"
          ><el-table-column
            prop="name"
            :label="t('alarmWorkOrder.statistics.content')"
            min-width="220" /><el-table-column
            prop="secondary"
            :label="t('alarmWorkOrder.statistics.assetAndCode')"
            min-width="220" /><el-table-column
            prop="averageMinutes"
            :label="t('alarmWorkOrder.statistics.durationMinutes')"
            width="160"
            sortable
        /></DsDataTable>
        <DsDataTable
          v-else
          :rows="
            (activeTab === 'severity'
              ? severityRows
              : activeTab === 'assets'
                ? assetRows
                : ruleRows) as unknown as Record<string, unknown>[]
          "
          :columns="[]"
          :empty-text="t('alarmWorkOrder.statistics.noStatistics')"
          ><el-table-column
            prop="name"
            :label="
              activeTab === 'severity'
                ? t('alarmWorkOrder.common.severity')
                : activeTab === 'assets'
                  ? t('alarmWorkOrder.statistics.assetName')
                  : t('alarmWorkOrder.statistics.rule')
            "
            min-width="220" /><el-table-column
            v-if="activeTab === 'assets'"
            prop="secondary"
            :label="t('alarmWorkOrder.statistics.assetCode')"
            min-width="180" /><el-table-column
            prop="total"
            :label="t('alarmWorkOrder.statistics.alarmCount')"
            width="130"
            sortable /><el-table-column
            prop="critical"
            :label="t('alarmWorkOrder.statistics.critical')"
            width="130"
            sortable /><el-table-column
            prop="active"
            :label="t('alarmWorkOrder.statistics.activeCount')"
            width="130"
            sortable
        /></DsDataTable>
        <footer v-if="activeTab === 'details'" class="ds-list-table-footer">
          <span>{{ t("alarmWorkOrder.statistics.totalNote", { count: data.eventTotal }) }}</span
          ><DsPagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :total="data.eventTotal"
          />
        </footer>
      </section>
    </section>
  </DsListPageShell>
  <el-drawer
    v-model="detailVisible"
    size="460px"
    :title="detail?.title || t('alarmWorkOrder.statistics.detailTitle')"
    class="alarm-stat-drawer"
    ><dl v-if="detail">
      <div>
        <dt>{{ t("alarmWorkOrder.statistics.alarmCode") }}</dt>
        <dd>{{ detail.code }}</dd>
      </div>
      <div>
        <dt>{{ t("alarmWorkOrder.statistics.occurredAt") }}</dt>
        <dd>{{ formatTime(detail.occurredAt) }}</dd>
      </div>
      <div>
        <dt>{{ t("alarmWorkOrder.statistics.alarmAsset") }}</dt>
        <dd>{{ detail.assetName }} / {{ detail.assetCode }}</dd>
      </div>
      <div>
        <dt>{{ t("alarmWorkOrder.statistics.sourceSeverity") }}</dt>
        <dd>
          {{ sourceLabel(detail.sourceType) }} /
          {{ t(`alarmWorkOrder.severity.${detail.severity}`) }}
        </dd>
      </div>
      <div>
        <dt>{{ t("alarmWorkOrder.statistics.valueThreshold") }}</dt>
        <dd>
          {{ detail.measuredValue ?? "—" }}{{ detail.valueUnit || "" }} /
          {{ detail.thresholdValue ?? "—" }}{{ detail.valueUnit || "" }}
        </dd>
      </div>
      <div>
        <dt>{{ t("alarmWorkOrder.common.status") }}</dt>
        <dd>{{ t(`alarmWorkOrder.alarmStatus.${detail.status}`) }}</dd>
      </div>
      <div>
        <dt>{{ t("alarmWorkOrder.statistics.recoveredAt") }}</dt>
        <dd>{{ formatTime(detail.recoveredAt) }}</dd>
      </div>
      <div>
        <dt>{{ t("alarmWorkOrder.statistics.linkedTicket") }}</dt>
        <dd>
          <router-link
            v-if="detail.workOrderCode"
            class="alarm-stat-link"
            :to="{
              path: '/alarm-work-order/tickets',
              query: { keyword: detail.workOrderCode },
            }"
            >{{ detail.workOrderCode }}</router-link
          ><span v-else>—</span>
        </dd>
      </div>
      <div class="is-wide">
        <dt>{{ t("alarmWorkOrder.statistics.description") }}</dt>
        <dd>{{ detail.description || "—" }}</dd>
      </div>
    </dl></el-drawer
  >
</template>

<style scoped src="./alarm-statistics.css"></style>
