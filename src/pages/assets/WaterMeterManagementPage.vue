<script setup lang="ts">
import {
  Collection,
  Delete,
  EditPen,
  Grid,
  List,
  Plus,
  Refresh,
  Search,
  Setting,
} from '@element-plus/icons-vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ApiError } from '@/core/api/contracts';
import { fetchAllPages } from '@/core/api/pagination';
import { useAuthStore } from '@/core/auth/auth.store';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsDataTable from '@/design-system/components/DsDataTable.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import {
  waterMeterPermissions,
  waterMeterRepository,
  type WaterMeterAsset,
  type WaterMeterMutationInput,
} from '@/domain/iot/assets/water-meter';
import {
  energyRelationPermissions,
  type MeterStatistics,
  type MeterViewMode,
} from '@/domain/iot/assets/meter';
import { fetchSpaceTree } from '@/domain/platform/org/api/space.api';
import { fetchTenants } from '@/domain/platform/org/api/tenant.api';
import type { TenantRecord } from '@/domain/platform/org';
import {
  flattenResources,
  getResourceBreadcrumb,
  type ResourceNode,
} from '@/domain/platform/org/resource';

const auth = useAuthStore();
const runtimeSettings = useRuntimeSettingsStore();
const router = useRouter();
const { locale } = useI18n();

const loading = ref(true);
const saving = ref(false);
const visible = ref(false);
const editingId = ref('');
const rows = ref<WaterMeterAsset[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(runtimeSettings.pageSize);
const stats = ref<MeterStatistics>({ total: 0, active: 0, disabled: 0, online: 0, offline: 0, warning: 0 });
const spaces = ref<ResourceNode[]>([]);
const tenants = ref<TenantRecord[]>([]);
const selectedSpaceId = ref('');
const keyword = ref('');
const status = ref('');
const communication = ref('');
const viewMode = ref<MeterViewMode>('card');
const form = reactive<WaterMeterMutationInput>(emptyForm());

const canView = computed(() => auth.can(waterMeterPermissions.view));
const spaceOptions = computed(() => flattenResources(spaces.value).filter((item) => item.status === 'enabled'));
const copy = computed(() => locale.value === 'en-US' ? en : zh);
const activePermission = computed(() => editingId.value ? waterMeterPermissions.update : waterMeterPermissions.create);
const selectedSpaceName = computed(() => selectedSpaceId.value
  ? getResourceBreadcrumb(spaces.value, selectedSpaceId.value)
  : copy.value.allSpaces);
const kpis = computed(() => [
  [copy.value.total, stats.value.total, 'primary'],
  [copy.value.active, stats.value.active, 'success'],
  [copy.value.online, stats.value.online, 'success'],
  [copy.value.offline, stats.value.offline, 'neutral'],
  [copy.value.warning, stats.value.warning, 'warning'],
  [copy.value.disabled, stats.value.disabled, 'neutral'],
]);

const zh = {
  title: '水表管理', add: '新增水表', refresh: '刷新', search: '查询', reset: '重置',
  keyword: '名称 / 编码 / 表号 / 型号', total: '水表总数', active: '启用资产', online: '在线',
  offline: '离线', warning: '通信告警', disabled: '已停用', name: '水表名称', serial: '表号',
  model: '设备型号', space: '安装空间', owner: '设备所有方', medium: '介质', diameter: '口径',
  communication: '通信状态', assetStatus: '资产状态', action: '操作', edit: '编辑', delete: '删除',
  configure: '配置计费', allStatus: '全部状态', allCommunication: '全部通信', empty: '暂无水表资产',
  basic: '资产与归属', access: '计量与接入', code: '资产编码', manufacturer: '制造商',
  category: '表计类别', totalMeter: '总表', subMeter: '分表', cold: '冷水', hot: '热水',
  reclaimed: '中水', meteringClass: '计量等级', pressure: '压力等级', pulse: '脉冲常数',
  direction: '安装方向', any: '不限方向', horizontal: '水平', vertical: '垂直',
  protocol: '协议模板', accessMode: '接入方式', identifier: '设备标识', gateway: '网关',
  heartbeat: '心跳秒数', valve: '支持远程阀控（真实控制尚未接入）', installed: '安装时间',
  remark: '备注', cancel: '取消', save: '保存', required: '请完整填写名称、表号、型号和安装空间',
  saved: '水表已保存', deleted: '水表已删除', deleteConfirm: '删除后不可用于新关系，确认删除该水表？',
  loadFailed: '水表数据加载失败', saveFailed: '水表保存失败', directory: '安装空间目录',
  directoryHint: '按安装位置筛选', allSpaces: '全部空间', count: (value: number) => `共 ${value} 块水表`,
  cardView: '卡片模式', listView: '列表模式', unassignedOwner: '平台 / 未指定', more: '更多',
};
const en = {
  ...zh, title: 'Water meters', add: 'Add water meter', refresh: 'Refresh', search: 'Search',
  reset: 'Reset', keyword: 'Name / code / serial / model', total: 'Total', active: 'Active',
  online: 'Online', offline: 'Offline', warning: 'Warning', disabled: 'Disabled', name: 'Meter name',
  serial: 'Serial no.', model: 'Model', space: 'Installed space', owner: 'Asset owner', medium: 'Medium',
  diameter: 'Diameter', communication: 'Communication', assetStatus: 'Asset status', action: 'Actions',
  edit: 'Edit', delete: 'Delete', configure: 'Configure billing', empty: 'No water meters',
  basic: 'Asset and ownership', access: 'Metering and access', code: 'Asset code', manufacturer: 'Manufacturer',
  category: 'Category', totalMeter: 'Total meter', subMeter: 'Submeter', cold: 'Cold water', hot: 'Hot water',
  reclaimed: 'Reclaimed water', meteringClass: 'Metering class', pressure: 'Pressure rating',
  pulse: 'Pulse constant', direction: 'Installation', any: 'Any', horizontal: 'Horizontal', vertical: 'Vertical',
  protocol: 'Protocol template', accessMode: 'Access mode', identifier: 'Device identifier', gateway: 'Gateway',
  heartbeat: 'Heartbeat seconds', valve: 'Remote valve capable (commands remain simulated)',
  installed: 'Installed at', remark: 'Remark', cancel: 'Cancel', save: 'Save',
  required: 'Complete name, serial, model and installed space', saved: 'Water meter saved',
  deleted: 'Water meter deleted', deleteConfirm: 'Delete this water meter?', loadFailed: 'Failed to load water meters',
  saveFailed: 'Failed to save water meter', directory: 'Installation spaces', directoryHint: 'Filter by location',
  allSpaces: 'All spaces', count: (value: number) => `${value} water meters`, cardView: 'Card view',
  listView: 'List view', unassignedOwner: 'Platform / unassigned', more: 'More',
};

function emptyForm(): WaterMeterMutationInput {
  return {
    code: '', name: '', serialNumber: '', ownerTenantId: '', spaceNodeId: '', manufacturer: '', model: '',
    category: 'sub', nominalDiameter: 'DN20', measurementMedium: 'cold_water', meteringClass: '2级',
    pressureRating: 'PN16', pulseConstant: 1, installationDirection: 'any', valveControlSupported: false,
    protocolTemplate: 'SIMULATED_WATER', accessMode: 'MANUAL', deviceIdentifier: '', gatewayName: '',
    heartbeatSeconds: 300, installedAt: '', status: 'active', remark: '',
  };
}

function mediumLabel(value: string) {
  return ({ cold_water: copy.value.cold, hot_water: copy.value.hot, reclaimed_water: copy.value.reclaimed } as Record<string, string>)[value] || value;
}
function statusLabel(value: string) {
  return ({ active: copy.value.active, disabled: copy.value.disabled, online: copy.value.online, offline: copy.value.offline, warning: copy.value.warning } as Record<string, string>)[value] || value;
}
function tone(value: string) {
  return value === 'active' || value === 'online' ? 'success' : value === 'warning' ? 'warning' : 'neutral';
}
function showError(error: unknown, fallback: string) {
  ElMessage.error(error instanceof ApiError ? error.message : fallback);
}
async function load(resetPage = false) {
  if (!canView.value) return;
  if (resetPage) page.value = 1;
  loading.value = true;
  try {
    const [result, nextStats] = await Promise.all([
      waterMeterRepository.page({
        keyword: keyword.value.trim(),
        status: status.value as WaterMeterAsset['status'] | '',
        communicationStatus: communication.value as WaterMeterAsset['communicationStatus'] | '',
        spaceNodeId: selectedSpaceId.value,
        page: page.value,
        pageSize: pageSize.value,
      }),
      waterMeterRepository.statistics(),
    ]);
    rows.value = result.items;
    total.value = result.total;
    stats.value = nextStats;
  } catch (error) {
    showError(error, copy.value.loadFailed);
  } finally {
    loading.value = false;
  }
}
async function loadFoundations() {
  try {
    const [spaceRows, tenantRows] = await Promise.all([
      fetchSpaceTree(), fetchAllPages((page, pageSize) => fetchTenants({ page, pageSize })),
    ]);
    spaces.value = spaceRows;
    tenants.value = tenantRows;
  } catch (error) {
    showError(error, copy.value.loadFailed);
  }
}
function selectSpace(node?: ResourceNode) {
  selectedSpaceId.value = node?.id || '';
  void load(true);
}
function switchView(mode: MeterViewMode) {
  viewMode.value = mode;
}
function reset() {
  keyword.value = '';
  status.value = '';
  communication.value = '';
  void load(true);
}
function openCreate() {
  if (!auth.canEnter(waterMeterPermissions.create)) return;
  editingId.value = '';
  Object.assign(form, emptyForm());
  visible.value = true;
}
function openEdit(row: WaterMeterAsset) {
  if (!auth.canEnter(waterMeterPermissions.update)) return;
  editingId.value = row.id;
  Object.assign(form, { ...row, installedAt: row.installedAt?.slice(0, 19) || '' });
  visible.value = true;
}
async function save() {
  if (!auth.can(activePermission.value)) return;
  if (!form.name.trim() || !form.serialNumber.trim() || !form.model.trim() || !form.spaceNodeId) {
    ElMessage.warning(copy.value.required);
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) await waterMeterRepository.update(editingId.value, form);
    else await waterMeterRepository.create(form);
    visible.value = false;
    ElMessage.success(copy.value.saved);
    await load();
  } catch (error) {
    showError(error, copy.value.saveFailed);
  } finally {
    saving.value = false;
  }
}
async function remove(row: WaterMeterAsset) {
  if (!auth.can(waterMeterPermissions.delete)) return;
  try {
    await ElMessageBox.confirm(copy.value.deleteConfirm, copy.value.delete, { type: 'warning' });
    await waterMeterRepository.delete(row.id, row.version);
    ElMessage.success(copy.value.deleted);
    await load();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') showError(error, copy.value.saveFailed);
  }
}
function configure(row: WaterMeterAsset) {
  if (!auth.can(energyRelationPermissions.view) || !auth.canEnter(energyRelationPermissions.create)) return;
  router.push({ name: 'energy-relations', query: { meterId: row.id, energyType: 'WATER' } });
}
function handleRowAction(command: string, row: WaterMeterAsset) {
  if (command === 'edit' && auth.canEnter(waterMeterPermissions.update)) openEdit(row);
  if (command === 'delete' && auth.can(waterMeterPermissions.delete)) void remove(row);
}

onMounted(async () => {
  await runtimeSettings.load();
  pageSize.value = runtimeSettings.pageSize;
  viewMode.value = runtimeSettings.deviceDefaultView === 'LIST' ? 'list' : 'card';
  await Promise.all([loadFoundations(), load()]);
});
watch([page, pageSize], () => void load());
watch(() => runtimeSettings.pageSize, (value) => {
  if (pageSize.value !== value) pageSize.value = value;
});
</script>

<template>
  <DsListPageShell :title="copy.title" page-class="ds-domain-dense water-page" :loading="canView && loading">
    <template #primary-action>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="load()">{{ copy.refresh }}</el-button>
        <el-button v-permission.preview="waterMeterPermissions.create" type="primary" :icon="Plus" @click="openCreate">{{ copy.add }}</el-button>
      </div>
    </template>

    <div v-if="canView" class="water-catalog-layout ds-list-master-detail">
      <aside class="water-space-panel">
        <header><strong>{{ copy.directory }}</strong><span>{{ copy.directoryHint }}</span></header>
        <button type="button" class="all-spaces" :class="{ active: !selectedSpaceId }" @click="selectSpace()">
          <Collection /><span>{{ copy.allSpaces }}</span><b>{{ stats.total }}</b>
        </button>
        <el-tree
          :data="spaces"
          node-key="id"
          :props="{ label: 'name', children: 'children' }"
          :expand-on-click-node="false"
          default-expand-all
          highlight-current
          @node-click="selectSpace"
        />
      </aside>

      <main class="water-content ds-list-master-detail__content">
        <section class="compact-kpis">
          <article v-for="item in kpis" :key="String(item[0])">
            <span>{{ item[0] }}</span><strong :class="String(item[2])">{{ item[1] }}</strong>
          </article>
        </section>

        <section class="water-toolbar">
          <div class="water-toolbar__context">
            <el-tooltip :content="selectedSpaceName" placement="top" :show-after="300">
              <strong>{{ selectedSpaceName }}</strong>
            </el-tooltip>
            <span>{{ copy.count(total) }}</span>
          </div>
          <div class="water-filter ds-list-filter ds-list-filter--adaptive ds-list-filter--nested">
            <el-input v-model="keyword" :placeholder="copy.keyword" clearable :prefix-icon="Search" @keyup.enter="load(true)" @clear="load(true)" />
            <el-select v-model="status" :placeholder="copy.assetStatus" clearable @change="load(true)">
              <el-option :label="copy.active" value="active" />
              <el-option :label="copy.disabled" value="disabled" />
            </el-select>
            <el-select v-model="communication" :placeholder="copy.communication" clearable @change="load(true)">
              <el-option :label="copy.online" value="online" />
              <el-option :label="copy.offline" value="offline" />
              <el-option :label="copy.warning" value="warning" />
            </el-select>
            <el-button type="primary" @click="load(true)">{{ copy.search }}</el-button>
            <el-button @click="reset">{{ copy.reset }}</el-button>
            <el-button-group class="view-switch">
              <el-button :type="viewMode === 'card' ? 'primary' : 'default'" :icon="Grid" :title="copy.cardView" :aria-label="copy.cardView" @click="switchView('card')" />
              <el-button :type="viewMode === 'list' ? 'primary' : 'default'" :icon="List" :title="copy.listView" :aria-label="copy.listView" @click="switchView('list')" />
            </el-button-group>
          </div>
        </section>

        <section class="water-results ds-list-table-shell ds-list-table-shell--embedded">
          <div v-if="viewMode === 'card' && rows.length" class="water-card-grid">
            <article v-for="row in rows" :key="row.id" class="water-card">
              <header>
                <div>
                  <el-tooltip :content="row.name" placement="top" :show-after="300"><strong>{{ row.name }}</strong></el-tooltip>
                  <el-tooltip :content="row.code" placement="top" :show-after="300"><span>{{ row.code }}</span></el-tooltip>
                </div>
                <DsTag :type="tone(row.communicationStatus)" size="small" dot>{{ statusLabel(row.communicationStatus) }}</DsTag>
              </header>
              <dl>
                <div><dt>{{ copy.serial }}</dt><el-tooltip :content="row.serialNumber" placement="top" :show-after="300"><dd>{{ row.serialNumber }}</dd></el-tooltip></div>
                <div><dt>{{ copy.model }}</dt><el-tooltip :content="row.model" placement="top" :show-after="300"><dd>{{ row.model }}</dd></el-tooltip></div>
                <div><dt>{{ copy.space }}</dt><el-tooltip :content="row.spaceName" placement="top" :show-after="300"><dd>{{ row.spaceName }}</dd></el-tooltip></div>
                <div><dt>{{ copy.owner }}</dt><el-tooltip :content="row.ownerTenantName || copy.unassignedOwner" placement="top" :show-after="300"><dd>{{ row.ownerTenantName || copy.unassignedOwner }}</dd></el-tooltip></div>
                <div><dt>{{ copy.medium }}</dt><dd>{{ mediumLabel(row.measurementMedium) }}</dd></div>
                <div><dt>{{ copy.diameter }}</dt><dd>{{ row.nominalDiameter || '--' }}</dd></div>
              </dl>
              <footer>
                <DsTag :type="tone(row.status)" size="small">{{ statusLabel(row.status) }}</DsTag>
                <div class="card-actions">
                  <el-button v-permission.preview="energyRelationPermissions.create" text type="primary" :icon="Setting" :disabled="!auth.can(energyRelationPermissions.view)" @click="configure(row)">{{ copy.configure }}</el-button>
                  <el-dropdown trigger="click" @command="(command: string) => handleRowAction(command, row)">
                    <el-button text>{{ copy.more }}</el-button>
                    <template #dropdown><el-dropdown-menu>
                      <el-dropdown-item v-if="auth.canShow(waterMeterPermissions.update)" command="edit" :disabled="!auth.canEnter(waterMeterPermissions.update)" :icon="EditPen">{{ copy.edit }}</el-dropdown-item>
                      <el-dropdown-item v-if="auth.canShow(waterMeterPermissions.delete)" command="delete" :disabled="!auth.can(waterMeterPermissions.delete)" :icon="Delete" divided>{{ copy.delete }}</el-dropdown-item>
                    </el-dropdown-menu></template>
                  </el-dropdown>
                </div>
              </footer>
            </article>
          </div>

          <DsDataTable v-else-if="rows.length" :rows="rows as unknown as Record<string,unknown>[]" :columns="[]" table-layout="fixed" class="water-table">
            <el-table-column :label="copy.name" min-width="180" show-overflow-tooltip>
              <template #default="{ row }"><div class="primary-cell"><strong>{{ row.name }}</strong><small>{{ row.code }}</small></div></template>
            </el-table-column>
            <el-table-column prop="serialNumber" :label="copy.serial" min-width="138" show-overflow-tooltip />
            <el-table-column prop="model" :label="copy.model" min-width="120" show-overflow-tooltip />
            <el-table-column prop="spaceName" :label="copy.space" min-width="136" show-overflow-tooltip />
            <el-table-column :label="copy.owner" min-width="148" show-overflow-tooltip><template #default="{ row }">{{ row.ownerTenantName || copy.unassignedOwner }}</template></el-table-column>
            <el-table-column :label="copy.medium" width="82"><template #default="{ row }">{{ mediumLabel(row.measurementMedium) }}</template></el-table-column>
            <el-table-column prop="nominalDiameter" :label="copy.diameter" width="74" />
            <el-table-column :label="copy.communication" width="92"><template #default="{ row }"><DsTag :type="tone(row.communicationStatus)" dot>{{ statusLabel(row.communicationStatus) }}</DsTag></template></el-table-column>
            <el-table-column :label="copy.assetStatus" width="76"><template #default="{ row }"><DsTag :type="tone(row.status)">{{ statusLabel(row.status) }}</DsTag></template></el-table-column>
            <el-table-column :label="copy.action" width="232" fixed="right">
              <template #default="{ row }"><div class="ds-row-actions">
                <el-button v-permission.preview="energyRelationPermissions.create" link type="primary" :icon="Setting" :disabled="!auth.can(energyRelationPermissions.view)" @click="configure(row)">{{ copy.configure }}</el-button>
                <el-dropdown trigger="click" @command="(command: string) => handleRowAction(command, row)">
                  <el-button link>{{ copy.more }}</el-button>
                  <template #dropdown><el-dropdown-menu>
                    <el-dropdown-item v-if="auth.canShow(waterMeterPermissions.update)" command="edit" :disabled="!auth.canEnter(waterMeterPermissions.update)" :icon="EditPen">{{ copy.edit }}</el-dropdown-item>
                    <el-dropdown-item v-if="auth.canShow(waterMeterPermissions.delete)" command="delete" :disabled="!auth.can(waterMeterPermissions.delete)" :icon="Delete" divided>{{ copy.delete }}</el-dropdown-item>
                  </el-dropdown-menu></template>
                </el-dropdown>
              </div></template>
            </el-table-column>
          </DsDataTable>

          <DsEmpty v-if="!loading && !rows.length" :description="copy.empty" />
        <footer v-if="total" class="ds-list-table-footer ds-list-table-footer--pagination-only">
          <DsPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
        </footer>
        </section>
      </main>
    </div>
    <DsEmpty v-else :description="copy.empty" />

    <template #overlays>
      <el-dialog v-model="visible" :title="editingId ? copy.edit : copy.add" width="min(880px,94vw)" destroy-on-close>
        <section class="form-section"><h3>{{ copy.basic }}</h3><el-form label-position="top" class="form-grid">
          <el-form-item :label="copy.name" required><el-input v-model="form.name" /></el-form-item>
          <el-form-item :label="copy.code"><el-input v-model="form.code" :disabled="!!editingId" /></el-form-item>
          <el-form-item :label="copy.serial" required><el-input v-model="form.serialNumber" /></el-form-item>
          <el-form-item :label="copy.model" required><el-input v-model="form.model" /></el-form-item>
          <el-form-item :label="copy.manufacturer"><el-input v-model="form.manufacturer" /></el-form-item>
          <el-form-item :label="copy.category"><el-select v-model="form.category"><el-option :label="copy.totalMeter" value="total" /><el-option :label="copy.subMeter" value="sub" /></el-select></el-form-item>
          <el-form-item :label="copy.space" required><el-select v-model="form.spaceNodeId" filterable><el-option v-for="item in spaceOptions" :key="item.id" :label="getResourceBreadcrumb(spaces, item.id)" :value="item.id" /></el-select></el-form-item>
          <el-form-item :label="copy.owner"><el-select v-model="form.ownerTenantId" filterable clearable><el-option v-for="item in tenants" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
        </el-form></section>
        <section class="form-section"><h3>{{ copy.access }}</h3><el-form label-position="top" class="form-grid">
          <el-form-item :label="copy.medium"><el-select v-model="form.measurementMedium"><el-option :label="copy.cold" value="cold_water" /><el-option :label="copy.hot" value="hot_water" /><el-option :label="copy.reclaimed" value="reclaimed_water" /></el-select></el-form-item>
          <el-form-item :label="copy.diameter"><el-input v-model="form.nominalDiameter" /></el-form-item>
          <el-form-item :label="copy.meteringClass"><el-input v-model="form.meteringClass" /></el-form-item>
          <el-form-item :label="copy.pressure"><el-input v-model="form.pressureRating" /></el-form-item>
          <el-form-item :label="copy.pulse"><el-input-number v-model="form.pulseConstant" :min="0.000001" :precision="6" /></el-form-item>
          <el-form-item :label="copy.direction"><el-select v-model="form.installationDirection"><el-option :label="copy.any" value="any" /><el-option :label="copy.horizontal" value="horizontal" /><el-option :label="copy.vertical" value="vertical" /></el-select></el-form-item>
          <el-form-item :label="copy.protocol"><el-input v-model="form.protocolTemplate" /></el-form-item>
          <el-form-item :label="copy.accessMode"><el-input v-model="form.accessMode" /></el-form-item>
          <el-form-item :label="copy.identifier"><el-input v-model="form.deviceIdentifier" /></el-form-item>
          <el-form-item :label="copy.gateway"><el-input v-model="form.gatewayName" /></el-form-item>
          <el-form-item :label="copy.heartbeat"><el-input-number v-model="form.heartbeatSeconds" :min="1" /></el-form-item>
          <el-form-item :label="copy.installed"><el-date-picker v-model="form.installedAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
          <el-form-item class="full"><el-checkbox v-model="form.valveControlSupported">{{ copy.valve }}</el-checkbox></el-form-item>
          <el-form-item :label="copy.remark" class="full"><el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" /></el-form-item>
        </el-form></section>
        <template #footer><el-button @click="visible = false">{{ copy.cancel }}</el-button><el-button v-permission="activePermission" type="primary" :loading="saving" @click="save">{{ copy.save }}</el-button></template>
      </el-dialog>
    </template>
  </DsListPageShell>
</template>

<style scoped>
.header-actions,.row-actions,.card-actions{display:flex;align-items:center;gap:6px;white-space:nowrap}.header-actions{margin-left:auto}.row-actions{gap:0}.row-actions :deep(.el-button),.card-actions :deep(.el-button){flex:none;margin:0;padding:0 4px;font-size:12px}
.water-catalog-layout{display:grid;grid-template-columns:252px minmax(0,1fr);min-height:var(--ds-list-workspace-h)}
.water-space-panel{min-width:0;padding:10px 10px 12px;border-right:1px solid var(--color-border-default);overflow:auto}.water-space-panel header{display:flex;flex-direction:column;padding:0 2px 9px;border-bottom:1px solid var(--color-border-default)}.water-space-panel header strong{font-size:14px}.water-space-panel header span{margin-top:2px;color:var(--color-text-secondary);font-size:11px}.all-spaces{display:grid;grid-template-columns:18px minmax(0,1fr) auto;align-items:center;gap:7px;width:100%;height:34px;margin:7px 0 5px;padding:0 9px;border:0;border-radius:var(--radius-sm);color:var(--color-text-secondary);background:transparent;text-align:left;cursor:pointer}.all-spaces svg{width:15px}.all-spaces b{font-size:12px}.all-spaces.active{color:var(--color-primary-500);background:var(--color-primary-50)}.water-space-panel :deep(.el-tree-node__content){height:30px;border-radius:var(--radius-sm);font-size:12px}
.water-content{display:flex;min-width:0;flex-direction:column}.compact-kpis{display:grid;grid-template-columns:repeat(6,1fr);margin:8px 10px;border:1px solid var(--color-border-default);border-radius:var(--radius-md);overflow:hidden}.compact-kpis article{min-height:48px;padding:5px 10px;border-right:1px solid var(--color-border-default)}.compact-kpis article:last-child{border:0}.compact-kpis span{display:block;color:var(--color-text-secondary);font-size:11px}.compact-kpis strong{display:block;font-size:18px;line-height:22px}.compact-kpis .primary{color:var(--color-primary-500)}.compact-kpis .success{color:var(--color-success-default)}.compact-kpis .warning{color:var(--color-warning-default)}
.water-toolbar{padding:0 10px 8px;border-bottom:1px solid var(--color-border-default)}.water-toolbar__context{display:flex;align-items:center;gap:7px;height:30px;min-width:0}.water-toolbar__context strong{max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.water-toolbar__context span{color:var(--color-text-secondary);font-size:12px}.water-filter{display:grid;grid-template-columns:minmax(240px,340px) 126px 126px 64px 64px minmax(72px,1fr);gap:6px}.water-filter :deep(.el-input),.water-filter :deep(.el-select){width:100%;min-width:0}.water-filter :deep(.el-button){margin:0}.view-switch{justify-self:end;width:72px;margin:0;display:inline-flex;flex-wrap:nowrap;white-space:nowrap}.view-switch :deep(.el-button){width:36px;min-width:36px;flex:0 0 36px;margin:0;padding:0}
.water-results{flex:1;min-height:340px;padding:8px 10px}.water-table{font-size:var(--ds-datatable-font)}.primary-cell{display:flex;min-width:0;flex-direction:column}.primary-cell strong,.primary-cell small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.primary-cell small{color:var(--color-text-secondary);font-size:11px}
.water-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.water-card{min-width:0;border:1px solid var(--color-border-default);border-radius:var(--radius-md);background:var(--color-bg-surface);overflow:hidden}.water-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:9px 10px;border-bottom:1px solid var(--color-border-default)}.water-card>header>div{min-width:0}.water-card>header strong,.water-card>header span{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.water-card>header strong{font-size:13px}.water-card>header span{margin-top:2px;color:var(--color-text-secondary);font-size:11px}.water-card dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px;margin:0;padding:6px 10px}.water-card dl>div{min-width:0;padding:5px 0;border-bottom:1px dashed var(--color-border-default)}.water-card dt{color:var(--color-text-secondary);font-size:11px}.water-card dd{margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.water-card>footer{display:flex;align-items:center;justify-content:space-between;padding:7px 10px}
.form-section{padding:0 2px}.form-section+.form-section{margin-top:10px;padding-top:10px;border-top:1px solid var(--color-border-default)}.form-section h3{margin:0 0 10px;font-size:14px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:18px}.form-grid :deep(.el-select),.form-grid :deep(.el-input-number),.form-grid :deep(.el-date-editor){width:100%}.form-grid .full{grid-column:1/-1}
@media(max-width:1180px){.water-catalog-layout{grid-template-columns:220px minmax(0,1fr)}.water-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.water-filter{grid-template-columns:minmax(220px,1fr) 120px 120px 64px 64px minmax(72px,1fr)}}
@media(max-width:900px){.water-catalog-layout{grid-template-columns:1fr}.water-space-panel{display:none}.compact-kpis{grid-template-columns:repeat(3,1fr)}.water-filter{grid-template-columns:1fr 1fr}.view-switch{grid-column:2}.water-card-grid{grid-template-columns:1fr}.form-grid{grid-template-columns:1fr}.form-grid .full{grid-column:auto}}
.water-card-grid{grid-auto-rows:max-content;align-items:start}
</style>
