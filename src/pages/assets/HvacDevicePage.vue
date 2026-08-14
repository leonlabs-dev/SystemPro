<script setup lang="ts">
import {
  ArrowDown, ArrowUp, Grid, List, MoreFilled, Refrigerator, Search, SwitchButton, WindPower,
} from '@element-plus/icons-vue';
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { ApiError } from '@/core/api/contracts';
import { fetchAllPages } from '@/core/api/pagination';
import HVAC_DEVICE_IMAGE from '@/assets/images/air/air-display.webp';
import { useAuthStore } from '@/core/auth/auth.store';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsDataTable from '@/design-system/components/DsDataTable.vue';
import DsDeviceCommandConsole from '@/design-system/components/DsDeviceCommandConsole.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import {
  deviceAssetApi, deviceAssetPermissions, deviceSystemApi, deviceSystemPermissions,
  type DeviceAsset, type DeviceAssetListItem,
} from '@/domain/iot/assets/device-system';

type Communication = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'MAINTENANCE';
type HvacRuntime = {
  communication: Communication;
  currentTemperature: number | null;
  targetTemperature: number | null;
  humidity: number | null;
  mode: 'COOLING' | 'HEATING' | 'FAN' | 'AUTO' | '--';
  fanSpeed: 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH' | '--';
  todayEnergy: number;
  updatedAt: string;
};
type HvacRow = DeviceAsset & {
  systemId: string;
  systemName: string;
  systemMode: string;
  runtime: HvacRuntime;
};

const router = useRouter();
const auth = useAuthStore();
const runtimeSettings = useRuntimeSettingsStore();
const { t, te } = useI18n();
const permissions = deviceAssetPermissions('HVAC');
const systemPermissions = deviceSystemPermissions('HVAC');
const loading = ref(true);
const rows = ref<HvacRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(runtimeSettings.pageSize);
const selectedIds = ref<number[]>([]);
const keyword = ref('');
const status = ref('');
const subtype = ref('');
const systemId = ref('');
const viewMode = ref<'card' | 'list'>('card');
const batchTemperature = ref(24);
const batchMode = ref('COOLING');
const batchFanSpeed = ref('AUTO');
const pendingAction = ref('');
const consoleExpanded = ref(false);
const systemOptions = ref<Array<[string, string]>>([]);
let keywordTimer: number | undefined;

const canControl = computed(() => auth.can(permissions.control));
const canExploreEdit = computed(() => auth.canEnterAll([permissions.update, systemPermissions.update]));
const canExploreControl = computed(() => auth.canEnter(permissions.control));
const systems = computed(() => systemOptions.value);
const subtypes = [
  'CHILLER', 'CHILLED_WATER_PUMP', 'AIR_HANDLING_UNIT',
  'FAN_COIL', 'FRESH_AIR_UNIT', 'INDOOR_UNIT',
];
const filtered = computed(() => rows.value.filter(row => {
  return !status.value || row.runtime.communication === status.value;
}));
const pagedRows = filtered;
const selectedRows = computed(() => rows.value.filter(row => selectedIds.value.includes(Number(row.id))));
const allFilteredSelected = computed(() => filtered.value.length > 0 && filtered.value.every(row => selectedIds.value.includes(Number(row.id))));
const onlineCount = computed(() => rows.value.filter(row => row.runtime.communication === 'ONLINE').length);
const exceptionCount = computed(() => rows.value.filter(row => ['WARNING', 'MAINTENANCE'].includes(row.runtime.communication)).length);

function buildRuntime(asset: DeviceAsset): HvacRuntime {
  const seed = Number(asset.id) * 37 + asset.name.length * 11;
  const disabled = asset.status !== 'ACTIVE';
  const communication: Communication = disabled ? 'OFFLINE' : seed % 13 === 0 ? 'MAINTENANCE' : seed % 9 === 0 ? 'WARNING' : seed % 7 === 0 ? 'OFFLINE' : 'ONLINE';
  const reachable = communication === 'ONLINE' || communication === 'WARNING';
  return {
    communication,
    currentTemperature: reachable ? Number((21.6 + (seed % 67) / 10).toFixed(1)) : null,
    targetTemperature: reachable ? 22 + seed % 6 : null,
    humidity: reachable ? 42 + seed % 19 : null,
    mode: reachable ? (['COOLING', 'HEATING', 'FAN', 'AUTO'] as const)[seed % 4] : '--',
    fanSpeed: reachable ? (['AUTO', 'LOW', 'MEDIUM', 'HIGH'] as const)[seed % 4] : '--',
    todayEnergy: reachable ? Number((2.1 + (seed % 135) / 10).toFixed(1)) : 0,
    updatedAt: reachable ? `${String(8 + seed % 3).padStart(2, '0')}:${String(seed % 60).padStart(2, '0')}` : '--',
  };
}

function enrich(item: DeviceAssetListItem): HvacRow {
  return {
    ...item.asset,
    systemId: item.systemId || '',
    systemName: item.systemName || '',
    systemMode: item.systemMode || '',
    runtime: buildRuntime(item.asset),
  };
}

function systemModeLabel(value: string) {
  const key = `deviceSystemPage.mode.${value}`;
  return value && te(key) ? t(key) : value || '--';
}

function subtypeLabel(value: string) {
  const key = `deviceSystemPage.subtype.${value}`;
  return te(key) ? t(key) : value;
}

function statusLabel(value: Communication) {
  return value === 'MAINTENANCE' ? t('deviceSystemPage.hvacConsole.maintenance') : t(`deviceSystemPage.communication.${value}`);
}
function modeLabel(value: string) { return value === '--' ? value : t(`deviceSystemPage.hvacConsole.modes.${value}`); }
function fanLabel(value: string) { return value === '--' ? value : t(`deviceSystemPage.hvacConsole.fans.${value}`); }

function statusTone(value: Communication) {
  return value === 'ONLINE' ? 'success' : value === 'WARNING' ? 'error' : value === 'MAINTENANCE' ? 'warning' : 'neutral';
}

async function load() {
  if (!auth.can(permissions.view)) return;
  loading.value = true;
  try {
    const result = await deviceAssetApi.page('HVAC', {
      keyword: keyword.value.trim() || undefined, subtype: subtype.value || undefined,
      systemId: systemId.value || undefined, page: page.value, pageSize: pageSize.value,
    });
    rows.value = result.items.map(enrich);
    total.value = result.total;
    selectedIds.value = selectedIds.value.filter(id => rows.value.some(row => Number(row.id) === id));
  } catch (error) {
    ElMessage.error(error instanceof ApiError ? error.message : t('deviceSystemPage.hvacConsole.messages.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function loadSystems() {
  const rows = await fetchAllPages((page, pageSize) => deviceSystemApi.page('HVAC', { page, pageSize }));
  systemOptions.value = rows.map(item => [item.id, item.name]);
}

function switchView(mode: 'card' | 'list') {
  viewMode.value = mode;
}

function toggleAllFiltered() {
  const ids = filtered.value.map(row => Number(row.id));
  selectedIds.value = allFilteredSelected.value
    ? selectedIds.value.filter(id => !ids.includes(id))
    : [...new Set([...selectedIds.value, ...ids])];
}

function toggleSelection(id: number, checked: boolean) {
  selectedIds.value = checked ? [...new Set([...selectedIds.value, id])] : selectedIds.value.filter(item => item !== id);
}

function requireSelection() {
  if (!selectedRows.value.length) {
    ElMessage.warning(t('deviceSystemPage.deviceAsset.control.selectFirst'));
    return false;
  }
  return true;
}

function chooseBatchAction(action: string) {
  if (!canExploreControl.value || !requireSelection()) return;
  pendingAction.value = pendingAction.value === action ? '' : action;
}

function applyBatchCommand() {
  if (!canControl.value || !requireSelection() || !pendingAction.value) return;
  const detail = pendingAction.value === 'TEMPERATURE' ? `${batchTemperature.value}℃`
    : pendingAction.value === 'MODE' ? modeLabel(batchMode.value)
      : pendingAction.value === 'FAN' ? fanLabel(batchFanSpeed.value) : '';
  const action = `${t(`deviceSystemPage.hvacConsole.actions.${pendingAction.value}`)}${detail ? ` · ${detail}` : ''}`;
  ElMessage.success(t('deviceSystemPage.hvacConsole.messages.recorded', { count: selectedRows.value.length, action }));
  pendingAction.value = '';
}

function singleCommand(row: HvacRow, action: string) {
  if (!canControl.value) return;
  ElMessage.info(t('deviceSystemPage.deviceAsset.control.singleCommand', { name: row.name, action }));
}

function editDevice(row: HvacRow) {
  if (!canExploreEdit.value) return;
  router.push({ path: '/assets/hvac', query: { edit: row.systemId } });
}

function resetFilters() {
  keyword.value = '';
  status.value = '';
  subtype.value = '';
  systemId.value = '';
}

onMounted(async () => {
  await runtimeSettings.load();
  pageSize.value = runtimeSettings.pageSize;
  viewMode.value = runtimeSettings.deviceDefaultView === 'LIST' ? 'list' : 'card';
  await loadSystems();
});
onActivated(load);
watch(() => runtimeSettings.pageSize, value => { pageSize.value = value; page.value = 1; });
watch([page, pageSize, subtype, systemId], () => load());
watch(keyword, () => {
  window.clearTimeout(keywordTimer);
  keywordTimer = window.setTimeout(() => { page.value = 1; load(); }, 300);
});
</script>

<template>
  <DsListPageShell :title="t('deviceSystemPage.deviceAsset.title.HVAC')" page-class="hvac-device-page ds-domain-dense" :loading="auth.can(permissions.view) && loading">
    <DsDeviceCommandConsole class="ds-device-console--device-standard" :class="{ 'is-expanded': consoleExpanded }">
      <template #heading>
        <div>
          <span class="device-console-title">{{ t('deviceSystemPage.hvacConsole.consoleTitle') }}</span>
          <span>{{ t('deviceSystemPage.deviceAsset.control.selected',{selected:selectedRows.length,total}) }}</span>
          <el-button class="device-console-toggle" link type="primary" @click="consoleExpanded=!consoleExpanded">
            {{ t(consoleExpanded?'deviceSystemPage.hvacConsole.collapse':'deviceSystemPage.hvacConsole.expand') }}
            <el-icon><ArrowUp v-if="consoleExpanded" /><ArrowDown v-else /></el-icon>
          </el-button>
        </div>
        <el-button link type="primary" :disabled="!selectedRows.length" @click="selectedIds=[]">{{ t('deviceSystemPage.hvacConsole.clear') }}</el-button>
      </template>
      <template #actions>
        <div class="command-block">
          <label>{{ t('deviceSystemPage.hvacConsole.batchActions') }}</label>
          <div class="command-buttons">
            <button v-permission.preview="permissions.control" :class="{active:pendingAction==='POWER_ON'}" :disabled="!selectedRows.length" @click="chooseBatchAction('POWER_ON')"><el-icon><SwitchButton /></el-icon>{{ t('deviceSystemPage.hvacConsole.powerOn') }}</button>
            <button v-permission.preview="permissions.control" :class="{active:pendingAction==='POWER_OFF'}" :disabled="!selectedRows.length" @click="chooseBatchAction('POWER_OFF')"><el-icon><SwitchButton /></el-icon>{{ t('deviceSystemPage.hvacConsole.powerOff') }}</button>
            <button v-permission.preview="permissions.control" :class="{active:pendingAction==='TEMPERATURE'}" :disabled="!selectedRows.length" @click="chooseBatchAction('TEMPERATURE')"><el-icon><Refrigerator /></el-icon>{{ t('deviceSystemPage.hvacConsole.setTemperature') }}</button>
            <button v-permission.preview="permissions.control" :class="{active:pendingAction==='MODE'}" :disabled="!selectedRows.length" @click="chooseBatchAction('MODE')"><el-icon><Refrigerator /></el-icon>{{ t('deviceSystemPage.hvacConsole.setMode') }}</button>
            <button v-permission.preview="permissions.control" :class="{active:pendingAction==='FAN'}" :disabled="!selectedRows.length" @click="chooseBatchAction('FAN')"><el-icon><WindPower /></el-icon>{{ t('deviceSystemPage.hvacConsole.setFan') }}</button>
            <button disabled :title="t('deviceSystemPage.hvacConsole.scheduleDeferred')">{{ t('deviceSystemPage.hvacConsole.schedule') }}</button>
          </div>
        </div>
      </template>
      <template #parameters>
          <div class="hvac-command-parameters">
            <div class="temperature-setting"><label>{{ t('deviceSystemPage.hvacConsole.temperature') }}</label><div class="temperature-input"><el-input-number v-model="batchTemperature" :min="16" :max="30" :disabled="pendingAction!=='TEMPERATURE'" controls-position="right" /><span>℃</span></div></div>
            <div class="choice-setting"><label>{{ t('deviceSystemPage.hvacConsole.mode') }}</label><el-radio-group v-model="batchMode" :disabled="pendingAction!=='MODE'"><el-radio-button v-for="value in ['COOLING','HEATING','FAN','AUTO']" :key="value" :label="value">{{ t(`deviceSystemPage.hvacConsole.modes.${value}`) }}</el-radio-button></el-radio-group></div>
            <div class="choice-setting"><label>{{ t('deviceSystemPage.hvacConsole.fan') }}</label><el-radio-group v-model="batchFanSpeed" :disabled="pendingAction!=='FAN'"><el-radio-button v-for="value in ['AUTO','LOW','MEDIUM','HIGH']" :key="value" :label="value">{{ t(`deviceSystemPage.hvacConsole.fans.${value}`) }}</el-radio-button></el-radio-group></div>
          </div>
      </template>
      <template #confirm>
        <div class="hvac-confirm">
          <el-button v-permission="permissions.control" class="apply-button" type="primary" :disabled="!selectedRows.length || !canControl || !pendingAction" @click="applyBatchCommand">{{ t('deviceSystemPage.hvacConsole.apply') }}</el-button>
        </div>
      </template>
    </DsDeviceCommandConsole>

    <section class="filter-panel ds-list-filter ds-list-filter--adaptive">
      <div class="filter-fields">
      <el-select v-model="systemId" clearable :placeholder="t('deviceSystemPage.hvacConsole.filters.systems')"><el-option v-for="item in systems" :key="item[0]" :label="item[1]" :value="item[0]" /></el-select>
      <el-select v-model="subtype" clearable :placeholder="t('deviceSystemPage.hvacConsole.filters.subtypes')"><el-option v-for="item in subtypes" :key="item" :label="subtypeLabel(item)" :value="item" /></el-select>
      <el-select v-model="status" clearable :placeholder="t('deviceSystemPage.hvacConsole.filters.status')"><el-option :label="statusLabel('ONLINE')" value="ONLINE" /><el-option :label="statusLabel('OFFLINE')" value="OFFLINE" /><el-option :label="statusLabel('WARNING')" value="WARNING" /><el-option :label="statusLabel('MAINTENANCE')" value="MAINTENANCE" /></el-select>
      <el-input v-model="keyword" :prefix-icon="Search" clearable :placeholder="t('deviceSystemPage.hvacConsole.filters.keyword')" />
      <el-button @click="resetFilters">{{ t('deviceSystemPage.actions.reset') }}</el-button>
      </div>
      <div class="view-toggle"><el-button-group><el-button :type="viewMode==='card'?'primary':'default'" :icon="Grid" @click="switchView('card')" /><el-button :type="viewMode==='list'?'primary':'default'" :icon="List" @click="switchView('list')" /></el-button-group></div>
    </section>

    <section class="ds-list-table-shell hvac-device-results">
      <div class="device-content">
        <div class="selection-toolbar">
          <el-checkbox :model-value="allFilteredSelected" @change="toggleAllFiltered" />
          <span>{{ t('deviceSystemPage.hvacConsole.selectedSummary',{count:selectedRows.length}) }}</span>
          <small>{{ t('deviceSystemPage.hvacConsole.dataSummary',{total,online:onlineCount,exception:exceptionCount}) }}</small>
          <el-button link type="primary" @click="selectedIds=[]">{{ t('deviceSystemPage.hvacConsole.clear') }}</el-button>
        </div>
        <div v-if="viewMode==='card' && pagedRows.length" class="device-grid">
          <article v-for="row in pagedRows" :key="row.id" class="device-card" :class="{ selected: selectedIds.includes(Number(row.id)), offline: row.runtime.communication==='OFFLINE' }">
            <header>
              <el-checkbox :model-value="selectedIds.includes(Number(row.id))" :aria-label="t('deviceSystemPage.hvacConsole.selectDevice',{name:row.name})" @change="toggleSelection(Number(row.id), Boolean($event))" />
              <div class="card-title"><strong :title="row.name">{{ row.name }}</strong><small>{{ row.code }}</small></div>
              <span class="status-dot" :class="`status-dot--${row.runtime.communication.toLowerCase()}`">{{ statusLabel(row.runtime.communication) }}</span>
            </header>
            <div class="device-control">
              <div class="device-visual"><img :src="HVAC_DEVICE_IMAGE" :alt="t('deviceSystemPage.deviceAsset.title.HVAC')" loading="lazy" decoding="async" /><small>{{ subtypeLabel(row.subtype) }} · {{ systemModeLabel(row.systemMode) }}</small></div>
              <div class="current-temperature"><span>{{ t('deviceSystemPage.hvacConsole.labels.currentTemperature') }}</span><strong :class="{ alarm: row.runtime.communication==='WARNING' }">{{ row.runtime.currentTemperature ?? '--' }}<small>℃</small></strong></div>
              <div class="target-temperature"><span>{{ t('deviceSystemPage.hvacConsole.labels.targetTemperature') }}</span><button :disabled="row.runtime.targetTemperature===null || !canControl" @click="singleCommand(row, '+1℃')">⌃</button><strong>{{ row.runtime.targetTemperature ?? '--' }}<small>℃</small></strong><button :disabled="row.runtime.targetTemperature===null || !canControl" @click="singleCommand(row, '-1℃')">⌄</button></div>
            </div>
            <div class="runtime-details">
              <span>{{ t('deviceSystemPage.hvacConsole.labels.mode') }} <em>{{ modeLabel(row.runtime.mode) }}</em></span>
              <span>{{ t('deviceSystemPage.hvacConsole.labels.fan') }} <i class="fan-bars"><b v-for="n in 5" :key="n" :class="{ active: row.runtime.fanSpeed!=='--' && n <= ['LOW','MEDIUM','HIGH','AUTO'].indexOf(row.runtime.fanSpeed)+2 }" /></i></span>
              <span>{{ t('deviceSystemPage.hvacConsole.labels.humidity') }} <em>{{ row.runtime.humidity === null ? '--' : `${row.runtime.humidity}%` }}</em></span>
              <span>{{ t('deviceSystemPage.hvacConsole.labels.todayEnergy') }} <em>{{ row.runtime.todayEnergy }} kWh</em></span>
              <span>{{ t('deviceSystemPage.hvacConsole.labels.updated') }} <em>{{ row.runtime.updatedAt }}</em></span>
            </div>
            <footer class="ds-card-actions">
              <button :disabled="!canControl" @click="singleCommand(row,t('deviceSystemPage.hvacConsole.actions.power'))"><el-icon><SwitchButton /></el-icon>{{ t('deviceSystemPage.hvacConsole.actions.power') }}</button>
              <button :disabled="!canControl" @click="singleCommand(row,t('deviceSystemPage.hvacConsole.actions.mode'))"><el-icon><Refrigerator /></el-icon>{{ t('deviceSystemPage.hvacConsole.actions.mode') }}</button>
              <el-dropdown trigger="click"><button><el-icon><MoreFilled /></el-icon>{{ t('deviceSystemPage.hvacConsole.actions.more') }}</button><template #dropdown><el-dropdown-menu><el-dropdown-item :disabled="!canControl" @click="singleCommand(row,t('deviceSystemPage.hvacConsole.actions.fan'))"><el-icon><WindPower /></el-icon>{{ t('deviceSystemPage.hvacConsole.actions.fan') }}</el-dropdown-item><el-dropdown-item v-if="auth.canShowAll([permissions.update, systemPermissions.update])" :disabled="!row.systemId || !canExploreEdit" @click="editDevice(row)">{{ t('deviceSystemPage.hvacConsole.actions.editProfile') }}</el-dropdown-item><el-dropdown-item disabled divided>{{ row.systemName }}</el-dropdown-item><el-dropdown-item disabled>{{ row.installSpaceName }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
            </footer>
          </article>
        </div>

        <DsDataTable v-else-if="viewMode==='list'" :rows="pagedRows as unknown as Record<string,unknown>[]" :columns="[]" table-layout="fixed">
          <el-table-column width="46"><template #default="{row}"><el-checkbox :model-value="selectedIds.includes(Number(row.id))" @change="toggleSelection(Number(row.id), Boolean($event))" /></template></el-table-column>
          <el-table-column :label="t('deviceSystemPage.deviceAsset.labels.device')" min-width="190" show-overflow-tooltip><template #default="{row}"><div class="table-primary"><strong>{{ row.name }}</strong><small>{{ row.code }}</small></div></template></el-table-column>
          <el-table-column :label="t('deviceSystemPage.hvacConsole.labels.typeMode')" min-width="150"><template #default="{row}"><div class="table-primary"><strong>{{ subtypeLabel(row.subtype) }}</strong><small>{{ systemModeLabel(row.systemMode) }}</small></div></template></el-table-column>
          <el-table-column prop="systemName" :label="t('deviceSystemPage.deviceAsset.labels.system')" min-width="200" show-overflow-tooltip />
          <el-table-column prop="installSpaceName" :label="t('deviceSystemPage.deviceAsset.labels.installSpace')" min-width="150" show-overflow-tooltip />
          <el-table-column :label="t('deviceSystemPage.hvacConsole.labels.currentTarget')" width="130"><template #default="{row}">{{ row.runtime.currentTemperature ?? '--' }}℃ / {{ row.runtime.targetTemperature ?? '--' }}℃</template></el-table-column>
          <el-table-column :label="t('deviceSystemPage.hvacConsole.labels.modeFan')" width="130"><template #default="{row}">{{ modeLabel(row.runtime.mode) }} / {{ fanLabel(row.runtime.fanSpeed) }}</template></el-table-column>
          <el-table-column :label="t('deviceSystemPage.deviceAsset.labels.communication')" width="90"><template #default="{row}"><DsTag :type="statusTone(row.runtime.communication)">{{ statusLabel(row.runtime.communication) }}</DsTag></template></el-table-column>
          <el-table-column :label="t('deviceSystemPage.deviceAsset.labels.operation')" fixed="right" width="176"><template #default="{row}"><div class="ds-row-actions"><el-button v-permission.preview="[permissions.update, systemPermissions.update]" link type="primary" :disabled="!row.systemId" @click="editDevice(row)">{{ t('deviceSystemPage.hvacConsole.actions.edit') }}</el-button><el-button v-permission="permissions.control" link :disabled="!canControl" @click="singleCommand(row,t('deviceSystemPage.hvacConsole.actions.power'))">{{ t('deviceSystemPage.hvacConsole.actions.simulated') }}</el-button></div></template></el-table-column>
        </DsDataTable>
        <DsEmpty v-if="!loading && !pagedRows.length" :title="t('deviceSystemPage.hvacConsole.empty.title')" :description="t('deviceSystemPage.hvacConsole.empty.description')" />
      </div>
      <footer v-if="total" class="ds-list-table-footer ds-list-table-footer--pagination-only"><DsPagination v-model:page="page" v-model:page-size="pageSize" :total="total" /></footer>
    </section>
  </DsListPageShell>
</template>

<style scoped>
.page-actions{display:flex;align-items:center;gap:8px}.page-actions :deep(.el-input){width:230px}.control-console,.filter-panel,.device-workspace{margin:10px 16px 0;border:1px solid var(--color-border-default);border-radius:var(--radius-md);background:var(--color-bg-surface);overflow:hidden}.section-heading{display:flex;height:40px;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid var(--color-border-default)}.section-heading>div{display:flex;align-items:center;gap:8px}.section-heading .el-icon{color:var(--color-primary-500);font-size:18px}.section-heading span{color:var(--color-text-secondary);font-size:12px}.console-body{display:grid;grid-template-columns:190px minmax(0,1fr);padding:10px}.selection-card{display:flex;flex-direction:column;justify-content:space-between;padding:12px;border:1px solid var(--color-border-default);border-radius:var(--radius-sm);background:var(--color-bg-muted)}.selection-count{display:flex;align-items:baseline;gap:5px;color:var(--color-text-secondary)}.selection-count strong{color:var(--color-primary-500);font-size:30px;line-height:1}.segmented{display:grid;grid-template-columns:repeat(3,1fr);margin:12px 0;border:1px solid var(--color-border-default);border-radius:var(--radius-sm);overflow:hidden}.segmented button,.selection-scope button{height:28px;border:0;color:var(--color-text-secondary);background:transparent;cursor:pointer}.segmented button.active{color:#fff;background:var(--color-primary-500)}.selection-scope{display:flex;align-items:center;justify-content:space-between;color:var(--color-text-secondary);font-size:12px}.selection-scope button{color:var(--color-primary-500)}.command-board{min-width:0;margin-left:10px;border:1px solid var(--color-border-default);border-radius:var(--radius-sm);overflow:hidden}.command-row{display:flex;align-items:flex-end;gap:12px;padding:10px 12px}.command-row--primary{justify-content:space-between;border-bottom:1px solid var(--color-border-default);background:color-mix(in srgb,var(--color-bg-muted) 46%,var(--color-bg-surface))}.command-block{min-width:0}.command-block label,.temperature-setting label,.choice-setting label{display:block;margin-bottom:6px;color:var(--color-text-secondary);font-size:11px}.command-buttons{display:flex;flex-wrap:wrap;gap:6px}.command-buttons button{display:flex;min-width:82px;height:40px;align-items:center;justify-content:center;gap:4px;border:1px solid var(--color-border-default);border-radius:var(--radius-sm);color:var(--color-text-primary);background:var(--color-bg-surface);cursor:pointer}.command-buttons button.active{border-color:var(--color-primary-500);color:var(--color-primary-500);background:var(--color-primary-soft)}.command-buttons button:disabled{border-color:var(--color-border-default);color:var(--color-text-disabled);background:var(--color-bg-muted);cursor:not-allowed}.console-status{display:grid;grid-template-columns:1fr auto;min-width:230px;max-width:300px;gap:5px 8px;padding:8px 10px;border-left:1px solid var(--color-border-default)}.console-status>span{font-size:12px;font-weight:600}.console-status small{grid-column:1/-1;overflow:hidden;color:var(--color-text-secondary);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.command-row--settings{display:grid;grid-template-columns:150px max-content max-content minmax(190px,220px);align-items:end;justify-content:start;column-gap:14px}.temperature-input{display:flex;width:150px;align-items:stretch}.temperature-setting :deep(.el-input-number){width:118px}.temperature-input>span{display:grid;width:32px;place-items:center;border:1px solid var(--el-border-color);border-left:0;border-radius:0 var(--el-border-radius-base) var(--el-border-radius-base) 0;color:var(--color-text-secondary);background:var(--color-bg-muted)}.temperature-setting :deep(.el-input__wrapper){border-radius:var(--el-border-radius-base) 0 0 var(--el-border-radius-base)}.choice-setting :deep(.el-radio-button__inner){padding:8px 11px}.command-confirm{display:grid;gap:6px}.command-confirm small{overflow:hidden;color:var(--color-text-secondary);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.apply-button{width:100%;min-width:190px}.filter-panel{padding:9px 10px;display:flex;align-items:flex-start;gap:8px}.filter-fields{min-width:0;display:grid;grid-template-columns:180px 180px 180px minmax(260px,420px) 68px;gap:8px}.filter-fields>*{min-width:0}.view-toggle{min-width:78px;margin-left:auto;flex:0 0 78px;display:flex;justify-content:flex-end}.view-toggle :deep(.el-button){width:39px;min-width:39px;padding:0}.device-workspace{margin-bottom:16px}.selection-toolbar{display:flex;height:36px;align-items:center;gap:8px;padding:0 10px;color:var(--color-text-secondary);background:var(--color-primary-soft);font-size:12px}.selection-toolbar strong{color:var(--color-primary-500)}.selection-toolbar small{flex:1}.device-content{min-height:200px}.device-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:8px}.device-card{min-width:0;border:1px solid var(--color-border-default);border-radius:var(--radius-sm);background:var(--color-bg-surface);overflow:hidden;transition:border-color .15s ease}.device-card.selected{border-color:var(--color-primary-500)}.device-card.offline{opacity:.62}.device-card>header{display:flex;align-items:flex-start;gap:7px;padding:8px 9px 4px}.card-title{display:flex;min-width:0;flex:1;flex-direction:column}.card-title strong,.card-title small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.card-title strong{font-size:13px}.card-title small{color:var(--color-text-secondary);font-size:10px}.status-dot{position:relative;padding-left:10px;color:var(--color-text-secondary);font-size:11px;white-space:nowrap}.status-dot::before{position:absolute;top:5px;left:0;width:6px;height:6px;border-radius:50%;background:var(--color-text-tertiary);content:''}.status-dot--online{color:var(--color-success-default)}.status-dot--online::before{background:var(--color-success-default)}.status-dot--warning{color:var(--color-danger-default)}.status-dot--warning::before{background:var(--color-danger-default)}.status-dot--maintenance{color:var(--color-warning-default)}.status-dot--maintenance::before{background:var(--color-warning-default)}.device-control{display:grid;grid-template-columns:minmax(90px,1fr) auto 54px;align-items:center;gap:7px;padding:3px 9px 6px}.device-visual{display:flex;min-width:0;flex-direction:column;align-items:center}.device-visual img{width:92px;height:40px;object-fit:contain;mix-blend-mode:multiply}.device-visual small{max-width:100%;overflow:hidden;color:var(--color-text-secondary);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.current-temperature{display:flex;flex-direction:column;align-items:center}.current-temperature>span,.target-temperature>span{color:var(--color-text-secondary);font-size:10px}.current-temperature>strong{font-size:25px;line-height:1.15}.current-temperature>strong.alarm{color:var(--color-danger-default)}.current-temperature small,.target-temperature small{margin-left:1px;font-size:10px;font-weight:400}.target-temperature{display:grid;grid-template-rows:auto 22px auto 22px;place-items:center}.target-temperature button{width:32px;height:21px;border:0;border-radius:4px;color:var(--color-primary-500);background:var(--color-primary-soft);cursor:pointer}.target-temperature button:disabled{color:var(--color-text-disabled);cursor:not-allowed}.target-temperature strong{font-size:17px}.runtime-details{display:grid;grid-template-columns:repeat(3,auto);gap:5px 8px;padding:4px 9px 7px;color:var(--color-text-secondary);font-size:10px}.runtime-details span:nth-last-child(2),.runtime-details span:last-child{grid-column:auto / span 1}.runtime-details em{margin-left:3px;color:var(--color-text-primary);font-style:normal}.fan-bars{display:inline-flex;height:12px;align-items:flex-end;gap:2px;margin-left:4px}.fan-bars b{width:3px;height:4px;border-radius:2px;background:var(--color-border-strong)}.fan-bars b:nth-child(2){height:6px}.fan-bars b:nth-child(3){height:8px}.fan-bars b:nth-child(4){height:10px}.fan-bars b:nth-child(5){height:12px}.fan-bars b.active{background:var(--color-primary-500)}.device-card>footer{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:6px 7px;border-top:1px solid var(--color-border-default)}.device-card>footer button{display:flex;width:100%;height:26px;align-items:center;justify-content:center;gap:3px;border:1px solid var(--color-border-default);border-radius:4px;color:var(--color-text-primary);background:var(--color-bg-surface);font-size:10px;cursor:pointer}.device-card>footer button:disabled{color:var(--color-text-disabled);cursor:not-allowed}.table-primary{display:flex;min-width:0;flex-direction:column}.table-primary strong,.table-primary small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.table-primary small{color:var(--color-text-secondary);font-size:11px}.table-actions{display:flex;align-items:center;gap:4px;white-space:nowrap}.dark .device-visual img{mix-blend-mode:screen;opacity:.78}@media(max-width:1500px){.command-row--settings{grid-template-columns:150px max-content max-content 190px}.choice-setting :deep(.el-radio-button__inner){padding:8px}.filter-fields{grid-template-columns:repeat(3,minmax(0,1fr))}.device-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:1280px){.console-status{display:none}.command-row--settings{grid-template-columns:repeat(2,minmax(0,1fr))}.command-confirm{align-self:end}.filter-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.device-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.page-actions :deep(.el-input){display:none}}@media(max-width:900px){.console-body{grid-template-columns:1fr}.selection-card{display:grid;grid-template-columns:auto 240px auto;align-items:center}.command-board{margin:8px 0 0}.device-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.command-row--primary,.command-buttons{flex-wrap:wrap}.command-row--settings{grid-template-columns:1fr}.filter-fields{grid-template-columns:1fr}.device-grid{grid-template-columns:1fr}.selection-toolbar small{display:none}}
@media(min-width:1501px){.device-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(min-width:1201px) and (max-width:1500px){.device-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(min-width:901px) and (max-width:1200px){.device-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(min-width:761px) and (max-width:900px){.device-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}

.device-card>footer.ds-card-actions{padding:8px 10px}

.hvac-device-results{margin-top:10px}
.hvac-device-results .selection-toolbar{border-bottom:1px solid var(--ds-list-divider)}
.device-control{grid-template-columns:minmax(112px,1fr) auto 54px}
.device-visual{overflow:hidden}
.device-visual img{width:118px;height:54px;object-fit:cover;object-position:center;mix-blend-mode:normal;filter:drop-shadow(0 4px 5px rgba(28,45,72,.14))}
</style>

<style>
html[data-theme='dark'] .hvac-device-page .device-visual img{filter:brightness(.86) contrast(1.08) drop-shadow(0 4px 6px rgba(0,0,0,.28));mix-blend-mode:normal;opacity:1}
</style>
