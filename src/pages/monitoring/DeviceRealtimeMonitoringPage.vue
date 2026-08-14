<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsDataTable, { type DsTableColumn } from '@/design-system/components/DsDataTable.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPrimaryCell from '@/design-system/components/DsPrimaryCell.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';
import { enumLabel } from '@/core/i18n/enum-labels';
import MonitoringKpiStrip from './components/MonitoringKpiStrip.vue';
import { operationsMonitoringApi, type DeviceMonitoringPage, type MonitoringConsistency, type MonitoringDevice } from '@/domain/iot/operations-monitoring';

const { t, locale } = useI18n();
const runtimeSettings = useRuntimeSettingsStore();
const loading = ref(true);
const error = ref('');
const data = ref<DeviceMonitoringPage>();
const keyword = ref('');
const systemType = ref('');
const consistency = ref<MonitoringConsistency | ''>('');
const drawerVisible = ref(false);
const selected = ref<MonitoringDevice>();
const page = ref(1);
const pageSize = ref(runtimeSettings.pageSize);

const systemTypes = computed(() => data.value?.systemTypes || []);
const columns = computed<DsTableColumn[]>(() => [
  { prop: 'name', label: t('operationsMonitoring.device.codeName'), minWidth: 190, slot: 'identity' },
  { prop: 'systemName', label: t('operationsMonitoring.common.system'), minWidth: 150, showOverflowTooltip: true },
  { prop: 'systemType', label: t('operationsMonitoring.device.type'), width: 105, slot: 'systemType' },
  { prop: 'subtype', label: t('operationsMonitoring.device.subtype'), minWidth: 125, showOverflowTooltip: true, slot: 'subtype' },
  { prop: 'accessMode', label: t('operationsMonitoring.device.access'), minWidth: 135, slot: 'access' },
  { prop: 'consistencyState', label: t('operationsMonitoring.common.configState'), width: 120, slot: 'config' },
  { prop: 'runtimeStatus', label: t('operationsMonitoring.device.runtime'), width: 130, slot: 'runtime' },
  { prop: 'catalogUpdatedAt', label: t('operationsMonitoring.device.updated'), width: 145, slot: 'updated' },
]);
const metrics = computed(() => [
  { key: 'total', label: t('operationsMonitoring.device.total'), value: data.value?.summary.total || 0 },
  { key: 'configured', label: t('operationsMonitoring.device.configured'), value: data.value?.summary.configured || 0, tone: 'success' as const },
  { key: 'unconfigured', label: t('operationsMonitoring.device.unconfigured'), value: data.value?.summary.unconfigured || 0, tone: 'muted' as const },
  { key: 'attention', label: t('operationsMonitoring.device.attention'), value: data.value?.summary.attention || 0, tone: 'warning' as const },
  { key: 'telemetry', label: t('operationsMonitoring.device.telemetry'), value: 0, tone: 'muted' as const },
]);

async function load() {
  const sequence = ++loadSequence;
  loading.value = true;
  error.value = '';
  try {
    const result = await operationsMonitoringApi.devices({
      keyword: keyword.value.trim(), systemType: systemType.value,
      consistency: consistency.value, page: page.value, pageSize: pageSize.value,
    });
    if (sequence === loadSequence) data.value = result;
  }
  catch { error.value = t('operationsMonitoring.device.loadFailed'); }
  finally { if (sequence === loadSequence) loading.value = false; }
}
function reset() { keyword.value = ''; systemType.value = ''; consistency.value = ''; page.value = 1; }
function openDetail(row: MonitoringDevice) { selected.value = row; drawerVisible.value = true; }
function consistencyType(value: MonitoringConsistency): 'success' | 'info' | 'warning' { return value === 'ALIGNED' ? 'success' : value === 'NO_ACCESS' ? 'info' : 'warning'; }
function consistencyLabel(value?: MonitoringConsistency) { return value ? t(`operationsMonitoring.common.consistency.${value}`) : '—'; }
function label(domain: Parameters<typeof enumLabel>[0], value?: string) { return enumLabel(domain, value, locale.value); }
function formatTime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale.value === 'en-US' ? 'en-US' : 'zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
let loadSequence = 0;
let loadTimer: number | undefined;
const ready = ref(false);
function scheduleLoad() {
  if (!ready.value) return;
  window.clearTimeout(loadTimer);
  loadTimer = window.setTimeout(() => { void load(); }, 220);
}
watch([keyword, systemType, consistency], () => {
  if (page.value !== 1) page.value = 1;
  else scheduleLoad();
});
watch([page, pageSize], scheduleLoad);
watch(() => runtimeSettings.pageSize, (value) => { pageSize.value = value; });
onMounted(async () => {
  await runtimeSettings.load().catch(() => undefined);
  pageSize.value = runtimeSettings.pageSize;
  ready.value = true;
  await load();
});
</script>

<template>
  <DsListPageShell
    :title="t('operationsMonitoring.device.title')"
    :subtitle="t('operationsMonitoring.device.subtitle')"
    :loading="loading"
    :error="error"
    page-class="monitor-device-page"
  >
    <template #header-extra>
      <span v-if="data?.generatedAt" class="ds-list-page__meta">{{ t('operationsMonitoring.common.generatedAt', { time: formatTime(data.generatedAt) }) }}</span>
    </template>
    <template #primary-action>
      <el-button class="ds-list-page__primary-action" :icon="Refresh" :loading="loading" @click="load">{{ t('operationsMonitoring.common.refresh') }}</el-button>
    </template>
    <MonitoringKpiStrip :metrics="metrics" />
    <div class="ds-list-filter ds-list-filter--adaptive">
        <el-input v-model="keyword" class="ds-list-filter__keyword" clearable :placeholder="t('operationsMonitoring.device.keyword')" />
        <el-select v-model="systemType" class="ds-list-filter__select" clearable :placeholder="t('operationsMonitoring.device.systemType')">
          <el-option v-for="item in systemTypes" :key="item" :label="label('systemType', item)" :value="item" />
        </el-select>
        <el-select v-model="consistency" class="ds-list-filter__select" clearable :placeholder="t('operationsMonitoring.device.consistency')">
          <el-option v-for="item in ['ALIGNED','NO_ACCESS','ACCESS_DISABLED','INCOMPLETE']" :key="item" :label="t(`operationsMonitoring.common.consistency.${item}`)" :value="item" />
        </el-select>
        <span />
        <div class="ds-list-filter__actions"><el-button class="ds-list-filter__button" @click="reset">{{ t('operationsMonitoring.common.reset') }}</el-button></div>
    </div>
      <section class="ds-list-table-shell">
        <DsDataTable :rows="(data?.devices || []) as unknown as Record<string,unknown>[]" :columns="columns" row-key="id" :loading="loading" :action-width="76">
          <template #identity="{row}"><DsPrimaryCell :primary="row.name" :secondary="row.code" /></template>
          <template #systemType="{row}">{{ label('systemType', row.systemType) }}</template>
          <template #subtype="{row}">{{ label('deviceSubtype', row.subtype) }}</template>
          <template #access="{row}">{{ label('accessMode', row.accessMode) }}</template>
          <template #config="{row}"><DsTag size="small" :type="consistencyType(row.consistencyState)">{{consistencyLabel(row.consistencyState)}}</DsTag></template>
          <template #runtime><DsTag size="small" type="neutral" dot>{{t('operationsMonitoring.common.noTelemetry')}}</DsTag></template>
          <template #updated="{row}">{{formatTime(row.catalogUpdatedAt)}}</template>
          <template #actions="{row}"><el-button link type="primary" @click="openDetail(row)">{{t('operationsMonitoring.common.detail')}}</el-button></template>
        </DsDataTable>
        <footer class="ds-list-table-footer ds-list-table-footer--pagination-only"><DsPagination v-model:page="page" v-model:page-size="pageSize" :total="data?.total || 0" /></footer>
      </section>
  </DsListPageShell>

  <el-drawer v-model="drawerVisible" class="monitor-drawer" size="440px" :title="selected?.name || t('operationsMonitoring.common.detail')">
    <template v-if="selected">
      <section class="monitor-drawer__section"><h3>{{ t('operationsMonitoring.common.assetMaster') }}</h3><dl>
        <div><dt>{{ t('operationsMonitoring.common.masterValue') }}</dt><dd>{{ selected.name }}</dd></div><div><dt>{{ t('operationsMonitoring.common.version') }}</dt><dd>v{{ selected.assetVersion }}</dd></div>
        <div><dt>资产编码</dt><dd>{{ selected.code }}</dd></div><div><dt>{{ t('operationsMonitoring.common.space') }}</dt><dd>{{ selected.installSpaceName || '—' }}</dd></div>
        <div><dt>资产状态</dt><dd>{{ label('assetStatus', selected.assetStatus) }}</dd></div><div><dt>档案更新时间</dt><dd>{{ formatTime(selected.catalogUpdatedAt) }}</dd></div>
      </dl></section>
      <section class="monitor-drawer__section"><h3>{{ t('operationsMonitoring.common.accessConfig') }}</h3><dl>
        <div><dt>接入方式</dt><dd>{{ label('accessMode', selected.accessMode) }}</dd></div><div><dt>{{ t('operationsMonitoring.common.version') }}</dt><dd>{{ selected.accessVersion ? `v${selected.accessVersion}` : '—' }}</dd></div>
        <div><dt>{{ t('operationsMonitoring.common.gateway') }}</dt><dd>{{ selected.gatewayName || '—' }}</dd></div><div><dt>{{ t('operationsMonitoring.common.channel') }}</dt><dd>{{ selected.channelCode || '—' }}</dd></div>
        <div><dt>{{ t('operationsMonitoring.common.protocol') }}</dt><dd>{{ selected.protocolTemplate || '—' }}</dd></div><div><dt>设备标识</dt><dd>{{ selected.deviceIdentifier || '—' }}</dd></div>
      </dl></section>
      <section class="monitor-drawer__section"><h3>{{ t('operationsMonitoring.common.runtimeSnapshot') }}</h3><dl><div><dt>状态</dt><dd>{{ t('operationsMonitoring.common.noTelemetry') }}</dd></div><div><dt>最后在线</dt><dd>—</dd></div></dl></section>
      <section class="monitor-drawer__section"><div class="monitor-policy">{{ t('operationsMonitoring.common.driftPolicy') }}</div><el-alert v-if="selected.consistencyState !== 'ALIGNED'" style="margin-top:10px" type="warning" :closable="false" show-icon :title="consistencyLabel(selected.consistencyState)" /></section>
    </template>
  </el-drawer>
</template>
