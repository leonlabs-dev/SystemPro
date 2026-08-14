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
  View,
} from '@element-plus/icons-vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
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
  buildMeterDemoSnapshot,
  energyRelationApi,
  energyRelationPermissions,
  meterPermissions,
  meterRepository,
  usageBillingApi,
  usageBillingPermissions,
  type EnergyRelation,
  type MeterAsset,
  type MeterAssetStatus,
  type MeterCommunicationStatus,
  type MeterDemoSnapshot,
  type MeterMutationInput,
  type MeterStatistics,
  type MeterViewMode,
  type UsageBill,
} from '@/domain/iot/assets/meter';
import { fetchSpaceTree } from '@/domain/platform/org/api/space.api';
import { fetchTenants } from '@/domain/platform/org/api/tenant.api';
import type { TenantRecord } from '@/domain/platform/org';
import { getResourceBreadcrumb, type ResourceNode } from '@/domain/platform/org/resource';
import { enumLabel } from '@/core/i18n/enum-labels';

type DetailTab = 'overview' | 'asset' | 'telemetry' | 'prepaid' | 'operations';

const authStore = useAuthStore();
const runtimeSettings = useRuntimeSettingsStore();
const { locale, t } = useI18n();
const router = useRouter();

const loading = ref(true);
const saving = ref(false);
const meters = ref<MeterAsset[]>([]);
const total = ref(0);
const statistics = ref<MeterStatistics>({ total: 0, active: 0, disabled: 0, online: 0, offline: 0, warning: 0 });
const tenants = ref<TenantRecord[]>([]);
const relations = ref<EnergyRelation[]>([]);
const currentBills = ref<UsageBill[]>([]);
const spaceTree = ref<ResourceNode[]>([]);
const catalogCollapsed = ref(localStorage.getItem('systempro.meter.catalog-collapsed') === 'true');
const catalogWidth = ref(Math.min(380, Math.max(220, Number(localStorage.getItem('systempro.meter.catalog-width')) || 248)));
const selectedSpaceId = ref('');
const keyword = ref('');
const status = ref<MeterAssetStatus | ''>('');
const communicationStatus = ref<MeterCommunicationStatus | ''>('');
const page = ref(1);
const pageSize = ref(runtimeSettings.pageSize);
const viewMode = ref<MeterViewMode>('card');
const detailVisible = ref(false);
const detailLoading = ref(false);
const selectedMeter = ref<MeterAsset | null>(null);
const demoSnapshot = ref<MeterDemoSnapshot | null>(null);
const activeTab = ref<DetailTab>('overview');
const formVisible = ref(false);
const editingId = ref('');
const form = reactive<MeterMutationInput>(emptyForm());

const canView = computed(() => authStore.can(meterPermissions.view));
const canEdit = computed(() => authStore.can(meterPermissions.update));
const canDelete = computed(() => authStore.can(meterPermissions.delete));
const canViewMetering = computed(() => authStore.can(energyRelationPermissions.view));
const canConfigureMetering = computed(() => canViewMetering.value && authStore.canEnter(energyRelationPermissions.create));
const activeMutationPermission = computed(() => editingId.value ? meterPermissions.update : meterPermissions.create);
const currentLocale = computed(() => locale.value === 'en-US' ? 'en-US' : 'zh-CN');
const selectedSpaceName = computed(() => selectedSpaceId.value
  ? getResourceBreadcrumb(spaceTree.value, selectedSpaceId.value)
  : t('meterPage.catalog.spaceTree.all'));
const ownerTenantOptions = computed(() => tenants.value);
const relationByMeter = computed(() => new Map(relations.value.filter(item => item.status === 'ACTIVE' && item.meterId).map(item => [String(item.meterId), item])));
const billByRelation = computed(() => new Map(currentBills.value.map(item => [item.relationId, item])));

const kpis = computed(() => [
  { key: 'total', label: t('meterPage.catalog.kpi.total'), value: statistics.value.total, tone: 'primary' },
  { key: 'active', label: t('meterPage.catalog.kpi.active'), value: statistics.value.active, tone: 'success' },
  { key: 'online', label: t('meterPage.catalog.kpi.online'), value: statistics.value.online, tone: 'success' },
  { key: 'offline', label: t('meterPage.catalog.kpi.offline'), value: statistics.value.offline, tone: 'neutral' },
  { key: 'warning', label: t('meterPage.catalog.kpi.warning'), value: statistics.value.warning, tone: 'warning' },
  { key: 'disabled', label: t('meterPage.catalog.kpi.disabled'), value: statistics.value.disabled, tone: 'neutral' },
]);

const detailTabs = computed<Array<{ name: DetailTab; label: string }>>(() => [
  { name: 'overview', label: t('meterPage.catalog.tabs.overview') },
  { name: 'asset', label: t('meterPage.catalog.tabs.assetCommunication') },
  { name: 'telemetry', label: t('meterPage.catalog.tabs.telemetry') },
  { name: 'prepaid', label: t('meterPage.catalog.tabs.prepaid') },
  { name: 'operations', label: t('meterPage.catalog.tabs.operationsAudit') },
]);

function activityStatusLabel(value: string) {
  const labels: Record<string, Record<string, string>> = {
    'zh-CN': { resolved: '已恢复', acknowledged: '已确认', succeeded: '执行成功' },
    'en-US': { resolved: 'Resolved', acknowledged: 'Acknowledged', succeeded: 'Succeeded' },
  };
  return labels[currentLocale.value][value] || (currentLocale.value === 'zh-CN' ? '待维护' : value);
}

function emptyForm(): MeterMutationInput {
  return {
    code: '', name: '', serialNumber: '', spaceNodeId: '', ownerTenantId: '', manufacturer: '', model: '',
    category: 'sub', phaseMode: 'three_phase_four_wire', ratedCurrent: '', accuracyClass: '',
    multiplier: 1, protocolTemplate: '', accessMode: '4G', deviceIdentifier: '', simNumber: '',
    gatewayName: '', heartbeatSeconds: 60, firmwareVersion: '', installedAt: '', status: 'active', remark: '',
  };
}

async function loadWorkspace(resetPage = false) {
  if (!canView.value) return;
  if (resetPage) page.value = 1;
  loading.value = true;
  try {
    const [result, nextStatistics, relationRows, billRows] = await Promise.all([
      meterRepository.page({
        keyword: keyword.value.trim(), status: status.value, communicationStatus: communicationStatus.value,
        spaceNodeId: selectedSpaceId.value, page: page.value, pageSize: pageSize.value,
      }),
      meterRepository.statistics(),
      canViewMetering.value ? energyRelationApi.list() : Promise.resolve([]),
      authStore.can(usageBillingPermissions.view) ? usageBillingApi.current() : Promise.resolve([]),
    ]);
    meters.value = result.items;
    total.value = result.total;
    statistics.value = nextStatistics;
    relations.value = relationRows;
    currentBills.value = billRows;
  } catch (error) {
    showApiError(error, 'meterPage.catalog.messages.loadFailed');
  } finally {
    loading.value = false;
  }
}

async function loadFoundations() {
  if (!canView.value) return;
  try {
    const [spaces, tenantRows] = await Promise.all([
      fetchSpaceTree(), fetchAllPages((page, pageSize) => fetchTenants({ page, pageSize })),
    ]);
    spaceTree.value = spaces;
    tenants.value = tenantRows;
  } catch (error) {
    showApiError(error, 'meterPage.catalog.messages.foundationFailed');
  }
}

function selectSpace(node?: ResourceNode) {
  selectedSpaceId.value = node?.id || '';
  loadWorkspace(true);
}

function spaceContains(rootId: string, candidateId: string) {
  const find = (nodes: ResourceNode[]): ResourceNode | undefined => {
    for (const node of nodes) {
      if (node.id === rootId) return node;
      const nested = find(node.children || []);
      if (nested) return nested;
    }
    return undefined;
  };
  const includes = (node: ResourceNode): boolean => node.id === candidateId || (node.children || []).some(includes);
  const root = find(spaceTree.value);
  return !!root && includes(root);
}

function switchView(mode: MeterViewMode) {
  viewMode.value = mode;
}

function relationFor(meter:MeterAsset){return relationByMeter.value.get(meter.id)}
function billFor(meter:MeterAsset){const relation=relationFor(meter);return relation?billByRelation.value.get(relation.id):undefined}
function meteringState(meter:MeterAsset){if(!canViewMetering.value)return t('meterPage.catalog.meteringState.restricted');const relation=relationFor(meter);if(!relation)return t('meterPage.catalog.meteringState.unconfigured');if(relation.dataQualityStatus!=='HEALTHY')return t('meterPage.catalog.meteringState.paused');return t(`meterPage.catalog.meteringState.${relation.relationType.toLowerCase()}`)}
function meteringTone(meter:MeterAsset){const relation=relationFor(meter);if(!relation)return 'neutral';return relation.dataQualityStatus==='HEALTHY'?'success':'warning'}
function meteringObject(meter:MeterAsset){if(!canViewMetering.value)return '--';const relation=relationFor(meter);return relation?.tenantName||relation?.usageItemName||t('meterPage.catalog.publicUsage')}
function openMetering(meter:MeterAsset){if(!canConfigureMetering.value)return;router.push({name:'energy-relations',query:{meterId:meter.id}})}
function handleMore(meter:MeterAsset,command:string){if(command==='metering'){openMetering(meter);return}if(command==='edit'&&authStore.canEnter(meterPermissions.update)){openEdit(meter);return}if(command==='delete'&&canDelete.value)removeMeter(meter)}
function toggleCatalog(){catalogCollapsed.value=!catalogCollapsed.value;localStorage.setItem('systempro.meter.catalog-collapsed',String(catalogCollapsed.value))}
function startCatalogResize(event:PointerEvent){
  if(catalogCollapsed.value)return;const startX=event.clientX;const startWidth=catalogWidth.value;
  const move=(next:PointerEvent)=>{catalogWidth.value=Math.min(380,Math.max(220,startWidth+next.clientX-startX))};
  const stop=()=>{localStorage.setItem('systempro.meter.catalog-width',String(catalogWidth.value));document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',stop)};
  document.addEventListener('pointermove',move);document.addEventListener('pointerup',stop);
}

async function openDetail(meter: MeterAsset) {
  detailVisible.value = true;
  detailLoading.value = true;
  activeTab.value = 'overview';
  try {
    selectedMeter.value = await meterRepository.getById(meter.id);
    demoSnapshot.value = buildMeterDemoSnapshot(selectedMeter.value, currentLocale.value);
  } catch (error) {
    detailVisible.value = false;
    showApiError(error, 'meterPage.catalog.messages.loadFailed');
  } finally {
    detailLoading.value = false;
  }
}

function openCreate() {
  if (!authStore.canEnter(meterPermissions.create)) return;
  editingId.value = '';
  Object.assign(form, emptyForm(), { spaceNodeId: selectedSpaceId.value });
  formVisible.value = true;
}

function openEdit(meter: MeterAsset) {
  if (!authStore.canEnter(meterPermissions.update)) return;
  editingId.value = meter.id;
  Object.assign(form, {
    code: meter.code,
    name: meter.name,
    serialNumber: meter.serialNumber,
    ownerTenantId: meter.ownerTenantId,
    spaceNodeId: meter.spaceNodeId,
    manufacturer: meter.manufacturer,
    model: meter.model,
    category: meter.category,
    phaseMode: meter.phaseMode,
    ratedCurrent: meter.ratedCurrent,
    accuracyClass: meter.accuracyClass,
    multiplier: meter.multiplier,
    protocolTemplate: meter.protocolTemplate,
    accessMode: meter.accessMode,
    deviceIdentifier: meter.deviceIdentifier,
    simNumber: meter.simNumber,
    gatewayName: meter.gatewayName,
    heartbeatSeconds: meter.heartbeatSeconds,
    firmwareVersion: meter.firmwareVersion,
    installedAt: meter.installedAt?.slice(0, 19) || '',
    status: meter.status,
    remark: meter.remark,
    version: meter.version,
  });
  formVisible.value = true;
}

function editSelectedMeter() {
  if (selectedMeter.value) openEdit(selectedMeter.value);
}

async function saveMeter() {
  if (!authStore.can(activeMutationPermission.value)) return;
  if (!form.name.trim() || !form.serialNumber.trim() || !form.model.trim() || !form.spaceNodeId) {
    ElMessage.warning(t('meterPage.catalog.messages.requiredFields'));
    return;
  }
  saving.value = true;
  try {
    const payload = { ...form };
    const saved = editingId.value
      ? await meterRepository.update(editingId.value, payload)
      : await meterRepository.create(payload);
    formVisible.value = false;
    await loadWorkspace();
    if (detailVisible.value && selectedMeter.value?.id === saved.id) await openDetail(saved);
    ElMessage.success(t(editingId.value ? 'meterPage.catalog.messages.updated' : 'meterPage.catalog.messages.created'));
  } catch (error) {
    showApiError(error, 'meterPage.catalog.messages.saveFailed');
  } finally {
    saving.value = false;
  }
}

async function removeMeter(meter: MeterAsset) {
  if (!canDelete.value) return;
  try {
    await ElMessageBox.confirm(
      t('meterPage.catalog.dialog.deleteConfirm', { name: meter.name }),
      t('meterPage.catalog.dialog.deleteTitle'),
      { type: 'warning', confirmButtonText: t('meterPage.catalog.actions.delete'), cancelButtonText: t('meterPage.catalog.actions.cancel') },
    );
    await meterRepository.delete(meter.id, meter.version);
    if (selectedMeter.value?.id === meter.id) detailVisible.value = false;
    await loadWorkspace();
    ElMessage.success(t('meterPage.catalog.messages.deleted'));
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    showApiError(error, 'meterPage.catalog.messages.deleteFailed');
  }
}

function showApiError(error: unknown, fallbackKey: string) {
  if (error instanceof ApiError) {
    const known = new Set([
      'METER_CODE_EXISTS', 'METER_SERIAL_EXISTS', 'METER_VERSION_CONFLICT',
      'METER_SPACE_INVALID', 'TENANT_NOT_AVAILABLE', 'METER_IN_USE',
    ]);
    ElMessage.error(known.has(error.code) ? t(`meterPage.catalog.errors.${error.code}`) : error.message);
    return;
  }
  ElMessage.error(t(fallbackKey));
}

function formatDateTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat(currentLocale.value, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}

function statusTone(value: MeterAssetStatus) {
  return value === 'active' ? 'success' : 'neutral';
}

function communicationTone(value: MeterCommunicationStatus) {
  return value === 'online' ? 'success' : value === 'warning' ? 'warning' : 'neutral';
}

onMounted(async () => {
  if (!canView.value) return;
  await runtimeSettings.load();
  pageSize.value = runtimeSettings.pageSize;
  viewMode.value = runtimeSettings.deviceDefaultView === 'LIST' ? 'list' : 'card';
  await loadFoundations();
  await loadWorkspace();
});
watch([page, pageSize], () => void loadWorkspace());
watch(() => runtimeSettings.pageSize, (value) => {
  if (pageSize.value !== value) pageSize.value = value;
});
</script>

<template>
  <DsListPageShell :title="t('meterPage.catalog.title')" page-class="meter-page ds-domain-dense" :loading="canView && loading">
    <template #primary-action>
      <div class="meter-page__header-actions">
        <el-button :icon="Refresh" :loading="loading" :disabled="!canView" @click="loadWorkspace()">
          {{ t('meterPage.catalog.actions.refresh') }}
        </el-button>
        <el-button v-permission.preview="meterPermissions.create" type="primary" :icon="Plus" @click="openCreate">
          {{ t('meterPage.catalog.actions.create') }}
        </el-button>
      </div>
    </template>

    <div v-if="canView" class="meter-catalog ds-list-master-detail" :class="{ 'is-collapsed': catalogCollapsed }" :style="{ '--catalog-width': `${catalogWidth}px` }">
      <aside class="space-panel">
        <header>
          <div v-if="!catalogCollapsed"><strong>{{ t('meterPage.catalog.spaceTree.title') }}</strong><span>{{ t('meterPage.catalog.spaceTree.subtitle') }}</span></div>
          <el-button text class="catalog-toggle" :title="t(catalogCollapsed?'meterPage.catalog.spaceTree.expand':'meterPage.catalog.spaceTree.collapse')" @click="toggleCatalog">{{ catalogCollapsed?'»':'«' }}</el-button>
        </header>
        <template v-if="!catalogCollapsed">
        <button type="button" class="space-panel__all" :class="{ 'is-active': !selectedSpaceId }" @click="selectSpace()">
          <Collection /><span>{{ t('meterPage.catalog.spaceTree.all') }}</span><strong>{{ statistics.total }}</strong>
        </button>
        <el-tree
          :data="spaceTree"
          node-key="id"
          :props="{ label: 'name', children: 'children' }"
          :expand-on-click-node="false"
          default-expand-all
          highlight-current
          @node-click="selectSpace"
        />
        </template>
        <div v-if="!catalogCollapsed" class="catalog-resizer" @pointerdown="startCatalogResize" />
      </aside>

      <main class="meter-content ds-list-master-detail__content">
        <section class="meter-kpis" aria-label="Meter statistics">
          <article v-for="item in kpis" :key="item.key" :class="`is-${item.tone}`">
            <span>{{ item.label }}</span><strong>{{ item.value }}</strong>
          </article>
        </section>

        <section class="meter-toolbar">
          <div class="meter-toolbar__context">
            <strong>{{ selectedSpaceName }}</strong>
            <span>{{ t('meterPage.catalog.list.count', { count: total }) }}</span>
          </div>
          <div class="meter-toolbar__filters ds-list-filter ds-list-filter--adaptive ds-list-filter--nested">
            <el-input v-model="keyword" clearable :placeholder="t('meterPage.catalog.filters.keyword')" @keyup.enter="loadWorkspace(true)" @clear="loadWorkspace(true)">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-select v-model="status" clearable :placeholder="t('meterPage.catalog.filters.assetStatus')" @change="loadWorkspace(true)">
              <el-option :label="t('meterPage.catalog.assetStatus.active')" value="active" />
              <el-option :label="t('meterPage.catalog.assetStatus.disabled')" value="disabled" />
            </el-select>
            <el-select v-model="communicationStatus" clearable :placeholder="t('meterPage.catalog.filters.communication')" @change="loadWorkspace(true)">
              <el-option :label="t('meterPage.catalog.communicationStatus.online')" value="online" />
              <el-option :label="t('meterPage.catalog.communicationStatus.offline')" value="offline" />
              <el-option :label="t('meterPage.catalog.communicationStatus.warning')" value="warning" />
            </el-select>
            <el-button class="filter-action" type="primary" @click="loadWorkspace(true)">{{ t('meterPage.catalog.actions.search') }}</el-button>
            <el-button class="filter-action" @click="keyword = ''; status = ''; communicationStatus = ''; loadWorkspace(true)">{{ t('meterPage.catalog.actions.reset') }}</el-button>
            <el-button-group class="view-switch" :aria-label="t('meterPage.catalog.viewMode.label')">
              <el-button :type="viewMode === 'card' ? 'primary' : 'default'" :icon="Grid" :aria-label="t('meterPage.catalog.viewMode.card')" :title="t('meterPage.catalog.viewMode.card')" @click="switchView('card')" />
              <el-button :type="viewMode === 'list' ? 'primary' : 'default'" :icon="List" :aria-label="t('meterPage.catalog.viewMode.list')" :title="t('meterPage.catalog.viewMode.list')" @click="switchView('list')" />
            </el-button-group>
          </div>
        </section>

        <section class="meter-results ds-list-table-shell ds-list-table-shell--embedded">
          <div v-if="viewMode === 'card' && meters.length" class="meter-card-grid">
            <article v-for="meter in meters" :key="meter.id" class="meter-card">
              <header>
                <div><strong>{{ meter.name }}</strong><span>{{ meter.code }}</span></div>
                <DsTag :type="communicationTone(meter.communicationStatus)" size="small" dot>
                  {{ t(`meterPage.catalog.communicationStatus.${meter.communicationStatus}`) }}
                </DsTag>
              </header>
              <dl>
                <div><dt>{{ t('meterPage.catalog.labels.serialNumber') }}</dt><dd>{{ meter.serialNumber }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.model') }}</dt><dd>{{ meter.model }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.space') }}</dt><dd>{{ meter.spaceName }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.owner') }}</dt><dd>{{ meter.ownerTenantName || t('meterPage.catalog.ownerUnassigned') }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.meteringStatus') }}</dt><dd><DsTag :type="meteringTone(meter)" size="small">{{ meteringState(meter) }}</DsTag></dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.meteringEstimate') }}</dt><dd>{{ meteringObject(meter) }}<span v-if="billFor(meter)"> · {{ billFor(meter)?.usageQuantity.toFixed(2) }} kWh / ¥{{ billFor(meter)?.amount.toFixed(2) }}</span></dd></div>
              </dl>
              <footer>
                <DsTag :type="statusTone(meter.status)" size="small">{{ t(`meterPage.catalog.assetStatus.${meter.status}`) }}</DsTag>
                <div class="card-actions">
                  <el-button text type="primary" :icon="View" @click="openDetail(meter)">{{ t('meterPage.catalog.actions.view') }}</el-button>
                  <el-dropdown trigger="click" @command="handleMore(meter,$event)"><el-button text>{{ t('meterPage.catalog.actions.more') }}</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-if="authStore.canShow(energyRelationPermissions.create)" command="metering" :disabled="!canConfigureMetering">{{ t('meterPage.catalog.actions.configureMetering') }}</el-dropdown-item><el-dropdown-item v-if="authStore.canShow(meterPermissions.update)" command="edit" :disabled="!authStore.canEnter(meterPermissions.update)" :icon="EditPen">{{ t('meterPage.catalog.actions.edit') }}</el-dropdown-item><el-dropdown-item v-if="authStore.canShow(meterPermissions.delete)" command="delete" :disabled="!canDelete" :icon="Delete" divided>{{ t('meterPage.catalog.actions.deleteDevice') }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
                </div>
              </footer>
            </article>
          </div>

          <DsDataTable v-else-if="meters.length" :rows="meters as unknown as Record<string,unknown>[]" :columns="[]" row-key="id" class="meter-table">
            <el-table-column prop="name" :label="t('meterPage.catalog.form.name')" min-width="220">
              <template #default="{ row }"><div class="primary-cell"><strong>{{ row.name }}</strong><small>{{ row.code }}</small></div></template>
            </el-table-column>
            <el-table-column prop="serialNumber" :label="t('meterPage.catalog.labels.serialNumber')" min-width="126" />
            <el-table-column prop="model" :label="t('meterPage.catalog.labels.model')" min-width="110" />
            <el-table-column prop="spaceName" :label="t('meterPage.catalog.labels.space')" min-width="126" show-overflow-tooltip />
            <el-table-column :label="t('meterPage.catalog.filters.communication')" width="86">
              <template #default="{ row }"><DsTag :type="communicationTone(row.communicationStatus)" size="small" dot>{{ t(`meterPage.catalog.communicationStatus.${row.communicationStatus}`) }}</DsTag></template>
            </el-table-column>
            <el-table-column :label="t('meterPage.catalog.form.status')" width="68">
              <template #default="{ row }"><DsTag :type="statusTone(row.status)" size="small">{{ t(`meterPage.catalog.assetStatus.${row.status}`) }}</DsTag></template>
            </el-table-column>
            <el-table-column :label="t('meterPage.catalog.labels.meteringRelation')" min-width="136"><template #default="{row}"><div class="stack-cell"><DsTag :type="meteringTone(row)" size="small">{{ meteringState(row) }}</DsTag><small>{{ meteringObject(row) }}</small></div></template></el-table-column>
            <el-table-column :label="t('meterPage.catalog.labels.currentEstimate')" min-width="126"><template #default="{row}"><span v-if="billFor(row)">{{ billFor(row)?.usageQuantity.toFixed(2) }} kWh / ¥{{ billFor(row)?.amount.toFixed(2) }}</span><span v-else>--</span></template></el-table-column>
            <el-table-column :label="t('meterPage.catalog.table.actions')" width="120" fixed="right">
              <template #default="{ row }">
                <div class="ds-row-actions"><el-button text type="primary" @click="openDetail(row)">{{ t('meterPage.catalog.actions.view') }}</el-button><el-dropdown trigger="click" @command="handleMore(row,$event)"><el-button text>{{ t('meterPage.catalog.actions.more') }}</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-if="authStore.canShow(energyRelationPermissions.create)" command="metering" :disabled="!canConfigureMetering">{{ t('meterPage.catalog.actions.configureMetering') }}</el-dropdown-item><el-dropdown-item v-if="authStore.canShow(meterPermissions.update)" command="edit" :disabled="!authStore.canEnter(meterPermissions.update)">{{ t('meterPage.catalog.actions.edit') }}</el-dropdown-item><el-dropdown-item v-if="authStore.canShow(meterPermissions.delete)" command="delete" :disabled="!canDelete" :icon="Delete" divided>{{ t('meterPage.catalog.actions.deleteDevice') }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div>
              </template>
            </el-table-column>
          </DsDataTable>

          <DsEmpty v-if="!loading && !meters.length" :description="t('meterPage.catalog.list.empty')" />
        <footer v-if="total" class="ds-list-table-footer ds-list-table-footer--pagination-only">
          <DsPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
        </footer>
        </section>
      </main>
    </div>

    <DsEmpty v-else :description="t('meterPage.catalog.permissionDenied')" />

    <template #overlays>
      <el-drawer v-model="detailVisible" size="min(960px, 78vw)" class="meter-detail-drawer" destroy-on-close>
        <template #header>
          <div v-if="selectedMeter" class="drawer-title">
            <div><h2>{{ selectedMeter.name }}</h2><p>{{ selectedMeter.code }} / {{ selectedMeter.serialNumber }}</p></div>
            <div><DsTag :type="communicationTone(selectedMeter.communicationStatus)" dot>{{ t(`meterPage.catalog.communicationStatus.${selectedMeter.communicationStatus}`) }}</DsTag></div>
          </div>
        </template>

        <div v-if="selectedMeter" v-loading="detailLoading" class="meter-detail-body">
          <div class="detail-context">
            <span>{{ selectedMeter.ownerTenantName || t('meterPage.catalog.ownerUnassigned') }}</span><i>/</i><span>{{ selectedMeter.spaceName }}</span>
          </div>
          <el-tabs v-model="activeTab" class="meter-detail-tabs">
            <el-tab-pane v-for="tab in detailTabs" :key="tab.name" :label="tab.label" :name="tab.name" />
          </el-tabs>

          <section v-if="activeTab === 'overview' && demoSnapshot" class="detail-section">
            <div class="demo-boundary">{{ t('meterPage.catalog.demoBoundary') }}</div>
            <div class="metric-grid">
              <article v-for="metric in demoSnapshot.metrics" :key="metric.key">
                <span>{{ t(`meterPage.catalog.metrics.${metric.key}`) }}</span>
                <strong>{{ metric.value }} <small>{{ metric.unit }}</small></strong>
              </article>
            </div>
          </section>

          <section v-else-if="activeTab === 'asset'" class="detail-section detail-columns">
            <article>
              <h3>{{ t('meterPage.catalog.sections.assetProfile') }}</h3>
              <dl class="property-list">
                <div><dt>{{ t('meterPage.catalog.labels.manufacturer') }}</dt><dd>{{ selectedMeter.manufacturer || '--' }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.model') }}</dt><dd>{{ selectedMeter.model }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.category') }}</dt><dd>{{ t(`meterPage.catalog.category.${selectedMeter.category}`) }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.wiringMode') }}</dt><dd>{{ t(`meterPage.catalog.phaseMode.${selectedMeter.phaseMode}`) }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.ratedCurrent') }}</dt><dd>{{ selectedMeter.ratedCurrent || '--' }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.accuracyClass') }}</dt><dd>{{ selectedMeter.accuracyClass || '--' }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.multiplier') }}</dt><dd>{{ selectedMeter.multiplier }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.installedAt') }}</dt><dd>{{ formatDateTime(selectedMeter.installedAt) }}</dd></div>
              </dl>
            </article>
            <article>
              <h3>{{ t('meterPage.catalog.sections.communicationProfile') }}</h3>
              <dl class="property-list">
                <div><dt>{{ t('meterPage.catalog.labels.protocolTemplate') }}</dt><dd>{{ selectedMeter.protocolTemplate || '--' }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.accessMode') }}</dt><dd>{{ enumLabel('accessMode', selectedMeter.accessMode, currentLocale) }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.deviceIdentifier') }}</dt><dd>{{ selectedMeter.deviceIdentifier || '--' }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.simNumber') }}</dt><dd>{{ selectedMeter.simNumber || '--' }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.gateway') }}</dt><dd>{{ selectedMeter.gatewayName || '--' }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.heartbeat') }}</dt><dd>{{ selectedMeter.heartbeatSeconds ? `${selectedMeter.heartbeatSeconds}s` : '--' }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.firmware') }}</dt><dd>{{ selectedMeter.firmwareVersion || '--' }}</dd></div>
                <div><dt>{{ t('meterPage.catalog.labels.lastSeen') }}</dt><dd>{{ formatDateTime(selectedMeter.lastSeenAt) }}</dd></div>
              </dl>
            </article>
          </section>

          <section v-else-if="activeTab === 'telemetry' && demoSnapshot" class="detail-section">
            <div class="demo-boundary">{{ t('meterPage.catalog.demoBoundary') }}</div>
            <div class="metric-grid">
              <article v-for="metric in demoSnapshot.metrics" :key="metric.key"><span>{{ t(`meterPage.catalog.metrics.${metric.key}`) }}</span><strong>{{ metric.value }} <small>{{ metric.unit }}</small></strong></article>
            </div>
          </section>

          <section v-else-if="activeTab === 'prepaid' && demoSnapshot" class="detail-section">
            <div class="demo-boundary">{{ t('meterPage.catalog.demoBoundary') }}</div>
            <div class="prepaid-line"><span>{{ t('meterPage.catalog.labels.balance') }}</span><strong>¥{{ demoSnapshot.balance.toFixed(2) }}</strong></div>
            <div class="prepaid-line"><span>{{ t('meterPage.catalog.labels.prepaidStatus') }}</span><DsTag type="success">{{ t(`meterPage.catalog.prepaidStatus.${demoSnapshot.prepaidStatus}`) }}</DsTag></div>
            <div class="prepaid-line"><span>{{ t('meterPage.catalog.labels.relayState') }}</span><DsTag type="success">{{ t(`meterPage.catalog.relayState.${demoSnapshot.relayState}`) }}</DsTag></div>
          </section>

          <section v-else-if="activeTab === 'operations' && demoSnapshot" class="detail-section detail-columns">
            <article><h3>{{ t('meterPage.catalog.sections.alarmHistory') }}</h3><div v-for="item in demoSnapshot.recentEvents" :key="item.id" class="audit-row"><div><strong>{{ item.title }}</strong><span>{{ formatDateTime(item.occurredAt) }}</span></div><DsTag type="success" size="small">{{ activityStatusLabel(item.status) }}</DsTag></div></article>
            <article><h3>{{ t('meterPage.catalog.sections.commandAudit') }}</h3><div v-for="item in demoSnapshot.recentCommands" :key="item.id" class="audit-row"><div><strong>{{ item.title }}</strong><span>{{ formatDateTime(item.occurredAt) }}</span></div><DsTag type="success" size="small">{{ activityStatusLabel(item.status) }}</DsTag></div></article>
          </section>
        </div>

        <template #footer>
          <el-button v-if="selectedMeter" v-permission.preview="meterPermissions.update" :icon="EditPen" @click="editSelectedMeter">{{ t('meterPage.catalog.actions.edit') }}</el-button>
        </template>
      </el-drawer>

      <el-dialog v-model="formVisible" :title="t(editingId ? 'meterPage.catalog.dialog.editTitle' : 'meterPage.catalog.dialog.createTitle')" width="760px" destroy-on-close>
        <el-form label-position="top" class="meter-form">
          <div class="form-grid">
            <el-form-item :label="t('meterPage.catalog.form.code')"><el-input v-model="form.code" :disabled="!!editingId" :placeholder="t('meterPage.catalog.form.autoCode')" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.form.name')" required><el-input v-model="form.name" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.form.serialNumber')" required><el-input v-model="form.serialNumber" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.form.spaceName')" required>
              <el-tree-select v-model="form.spaceNodeId" :data="spaceTree" node-key="id" :props="{ label: 'name', children: 'children' }" check-strictly default-expand-all />
            </el-form-item>
            <el-form-item :label="t('meterPage.catalog.form.ownerOptional')"><el-select v-model="form.ownerTenantId" clearable filterable><el-option v-for="item in ownerTenantOptions" :key="item.id" :label="item.name" :value="item.id" /></el-select><small class="field-hint">{{ t('meterPage.catalog.form.ownerLedgerHint') }}</small></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.manufacturer')"><el-input v-model="form.manufacturer" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.form.model')" required><el-input v-model="form.model" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.category')"><el-select v-model="form.category"><el-option :label="t('meterPage.catalog.category.total')" value="total" /><el-option :label="t('meterPage.catalog.category.sub')" value="sub" /></el-select></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.wiringMode')"><el-select v-model="form.phaseMode"><el-option :label="t('meterPage.catalog.phaseMode.single_phase')" value="single_phase" /><el-option :label="t('meterPage.catalog.phaseMode.three_phase_three_wire')" value="three_phase_three_wire" /><el-option :label="t('meterPage.catalog.phaseMode.three_phase_four_wire')" value="three_phase_four_wire" /></el-select></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.ratedCurrent')"><el-input v-model="form.ratedCurrent" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.accuracyClass')"><el-input v-model="form.accuracyClass" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.multiplier')"><el-input-number v-model="form.multiplier" :min="0.0001" :precision="4" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.form.status')"><el-select v-model="form.status"><el-option :label="t('meterPage.catalog.assetStatus.active')" value="active" /><el-option :label="t('meterPage.catalog.assetStatus.disabled')" value="disabled" /></el-select></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.protocolTemplate')"><el-input v-model="form.protocolTemplate" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.accessMode')"><el-input v-model="form.accessMode" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.deviceIdentifier')"><el-input v-model="form.deviceIdentifier" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.simNumber')"><el-input v-model="form.simNumber" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.gateway')"><el-input v-model="form.gatewayName" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.heartbeat')"><el-input-number v-model="form.heartbeatSeconds" :min="1" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.firmware')"><el-input v-model="form.firmwareVersion" /></el-form-item>
            <el-form-item :label="t('meterPage.catalog.labels.installedAt')"><el-date-picker v-model="form.installedAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
          </div>
          <el-form-item :label="t('meterPage.catalog.form.remark')"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
        </el-form>
        <template #footer><el-button @click="formVisible = false">{{ t('meterPage.catalog.actions.cancel') }}</el-button><el-button v-permission="activeMutationPermission" type="primary" :loading="saving" @click="saveMeter">{{ t('meterPage.catalog.actions.save') }}</el-button></template>
      </el-dialog>
    </template>
  </DsListPageShell>
</template>

<style scoped>
.meter-page__header-actions { margin-left: auto; display: flex; gap: var(--space-2); }
.meter-catalog { display: grid; grid-template-columns: var(--catalog-width, 248px) minmax(0, 1fr); min-height: var(--ds-list-workspace-h); }
.meter-catalog.is-collapsed { grid-template-columns: 44px minmax(0, 1fr); }
.space-panel { position: relative; min-width: 0; border-right: 1px solid var(--color-border-default); padding: 12px; overflow: auto; }
.space-panel header { min-height: 34px; padding-bottom: 8px; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; border-bottom: 1px solid var(--color-border-default); }
.meter-catalog.is-collapsed .space-panel { padding: 6px; overflow: hidden; }
.meter-catalog.is-collapsed .space-panel header { justify-content: center; border-bottom: 0; }
.catalog-toggle { flex: 0 0 auto; min-width: 28px; font-size: 17px; }
.catalog-resizer { position: absolute; z-index: 3; top: 0; right: -3px; bottom: 0; width: 7px; cursor: col-resize; }
.catalog-resizer:hover { background: color-mix(in srgb, var(--color-primary-500) 18%, transparent); }
.space-panel header div { display: grid; gap: 3px; }
.space-panel header span { color: var(--color-text-secondary); font-size: var(--font-caption); }
.space-panel__all { width: 100%; height: 32px; margin: 8px 0 4px; padding: 0 8px; display: grid; grid-template-columns: 16px 1fr auto; align-items: center; gap: 6px; border: 0; border-radius: var(--radius-sm); color: var(--color-text-secondary); background: transparent; text-align: left; cursor: pointer; font-size:var(--ds-datatable-font); }
.space-panel__all svg { width: 16px; }
.space-panel__all.is-active { color: var(--color-primary-500); background: var(--color-primary-50); }
.space-panel :deep(.el-tree-node__content){height:30px;font-size:var(--ds-datatable-font)}
.meter-content { min-width: 0; padding: 8px; }
.meter-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); border: 1px solid var(--color-border-default); border-radius: var(--radius-md); background: var(--color-bg-surface); }
.meter-kpis article { min-width: 0; height: 46px; padding: 5px 10px; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid var(--color-border-default); }
.meter-kpis article:last-child { border-right: 0; }
.meter-kpis span { color: var(--color-text-secondary); font-size: var(--font-caption); }
.meter-kpis strong { margin-top: 1px; font-size: 17px; line-height: 1; }
.meter-kpis .is-primary strong { color: var(--color-primary-500); }
.meter-kpis .is-success strong { color: var(--color-success-default); }
.meter-kpis .is-warning strong { color: var(--color-warning-default); }
.meter-toolbar { margin-top: 6px; padding: 5px 0; display: grid; gap: 5px; border-bottom: 1px solid var(--color-border-default); }
.meter-toolbar__context { min-width: 0; display: grid; grid-template-columns: minmax(0, auto) auto; justify-content: start; align-items: baseline; gap: var(--space-2); }
.meter-toolbar__context strong { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meter-toolbar__context span { color: var(--color-text-secondary); font-size: var(--font-caption); }
.meter-toolbar__filters { width: 100%; display: grid; grid-template-columns: minmax(210px, 320px) 124px 124px 68px 68px minmax(0, 1fr) 72px; align-items: center; gap: 6px; }
.meter-toolbar__filters :deep(.el-input), .meter-toolbar__filters :deep(.el-select) { width: 100%; min-width: 0; }
.filter-action { width: 68px; margin: 0; }
.view-switch { grid-column: 7; justify-self: end; width: 72px; margin: 0; display: inline-flex; flex-wrap: nowrap; white-space: nowrap; }
.view-switch :deep(.el-button) { width: 36px; min-width: 36px; flex: 0 0 36px; margin: 0; padding: 0; }
.meter-results { min-height: 300px; padding-top: 6px; }
.meter-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.meter-card { min-width: 0; border: 1px solid var(--color-border-default); border-radius: var(--radius-md); background: var(--color-bg-surface); transition: border-color .16s ease, box-shadow .16s ease; }
.meter-card:hover { border-color: color-mix(in srgb, var(--color-primary-500) 38%, var(--color-border-default)); box-shadow: var(--shadow-sm); }
.meter-card > header { min-height: 50px; padding: 8px 10px; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; border-bottom: 1px solid var(--color-border-default); }
.meter-card > header div { min-width: 0; display: grid; gap: 3px; }
.meter-card > header strong, .meter-card > header span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meter-card > header span { color: var(--color-text-secondary); font-size: var(--font-caption); }
.meter-card dl { margin: 0; padding: 6px 10px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; }
.meter-card dl div { min-width: 0; padding: 5px 0; border-bottom: 1px dashed var(--color-border-default); }
.meter-card dt { color: var(--color-text-secondary); font-size: var(--font-caption); }
.meter-card dd { margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--ds-datatable-font); }
.meter-card footer { min-height: 38px; padding: 0 8px 0 10px; display: flex; align-items: center; justify-content: space-between; }
.meter-card footer div { display: flex; }
.meter-card .card-actions { min-width:96px;align-items:center;justify-content:flex-end;gap:2px;flex-wrap:nowrap;white-space:nowrap; }
.meter-card .card-actions :deep(.el-button) { margin:0;padding:0 5px;font-size:var(--ds-datatable-font); }
.stack-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; }
.primary-cell { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 1px; }
.primary-cell strong, .primary-cell small { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stack-cell small { max-width: 100%; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meter-table strong, .meter-table small { display: block; }
.meter-table small { margin-top: 0; color: var(--color-text-secondary); line-height: 16px; }
.meter-table{font-size:var(--ds-datatable-font)}
.meter-table__actions { display: flex; align-items: center; justify-content: flex-start; gap:0; flex-wrap: nowrap; white-space: nowrap; }
.meter-table__actions :deep(.el-button) { margin:0;padding:0 3px;font-size:var(--ds-datatable-font); }
.drawer-title { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.drawer-title h2, .drawer-title p { margin: 0; }
.drawer-title p { margin-top: 3px; color: var(--color-text-secondary); font-size: var(--font-caption); }
.detail-context { display: flex; gap: var(--space-2); color: var(--color-text-secondary); font-size: var(--font-body-sm); }
.detail-context i { font-style: normal; color: var(--color-border-strong); }
.meter-detail-tabs { margin-top: var(--space-2); }
.detail-section { padding-top: var(--space-2); }
.demo-boundary { margin-bottom: var(--space-3); padding: 8px 12px; border-left: 3px solid var(--color-warning-default); color: var(--color-text-secondary); background: var(--color-warning-bg); font-size: var(--font-caption); }
.metric-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--space-2); }
.metric-grid article { min-width: 0; padding: var(--space-3); border: 1px solid var(--color-border-default); border-radius: var(--radius-sm); }
.metric-grid span { color: var(--color-text-secondary); font-size: var(--font-caption); }
.metric-grid strong { margin-top: 6px; display: block; font-size: 21px; }
.metric-grid small { color: var(--color-text-secondary); font-size: var(--font-caption); font-weight: 400; }
.detail-columns { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.detail-columns > article { min-width: 0; }
.detail-columns h3 { margin: 0; padding-bottom: var(--space-3); border-bottom: 1px solid var(--color-border-default); font-size: var(--font-heading-sm); }
.property-list { margin: 0; display: grid; grid-template-columns: 1fr 1fr; column-gap: var(--space-4); }
.property-list div { min-width: 0; padding: 12px 0; border-bottom: 1px solid var(--color-border-default); }
.property-list dt { color: var(--color-text-secondary); font-size: var(--font-caption); }
.property-list dd { margin: 4px 0 0; overflow-wrap: anywhere; }
.prepaid-line { min-height: 54px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-border-default); }
.prepaid-line span { color: var(--color-text-secondary); }
.prepaid-line strong { font-size: 22px; }
.audit-row { min-height: 62px; padding: var(--space-2) 0; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); border-bottom: 1px solid var(--color-border-default); }
.audit-row div { display: grid; gap: 3px; }
.audit-row span { color: var(--color-text-secondary); font-size: var(--font-caption); }
.form-context { margin-bottom: var(--space-4); padding: var(--space-3); display: grid; grid-template-columns: auto 1fr; gap: 3px var(--space-3); border: 1px solid var(--color-border-default); border-radius: var(--radius-sm); background: var(--color-bg-muted); }
.form-context span, .form-context small { color: var(--color-text-secondary); }
.form-context small { grid-column: 2; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--space-4); }
.form-grid :deep(.el-select), .form-grid :deep(.el-tree-select), .form-grid :deep(.el-date-editor) { width: 100%; }
.field-hint { margin-top: 6px; display: block; color: var(--color-text-secondary); line-height: 1.45; }
@media (max-width: 1380px) { .meter-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .meter-toolbar__filters { grid-template-columns: minmax(200px, 1fr) 124px 124px 72px 72px minmax(0, 1fr) 80px; } .filter-action { width:72px; } }
@media (max-width: 1100px) { .meter-catalog:not(.is-collapsed) { grid-template-columns: 240px minmax(0, 1fr); } .meter-kpis { grid-template-columns: repeat(3, 1fr); } .meter-kpis article:nth-child(3) { border-right: 0; } .meter-kpis article:nth-child(-n + 3) { border-bottom: 1px solid var(--color-border-default); } .metric-grid { grid-template-columns: repeat(3, 1fr); } }
</style>
