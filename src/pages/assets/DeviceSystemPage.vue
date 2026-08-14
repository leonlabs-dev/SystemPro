<script setup lang="ts">
import {
  Delete, EditPen, Grid, List, Plus, Refresh, Search, View,
} from '@element-plus/icons-vue';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import HVAC_SYSTEM_IMAGE from '@/assets/images/air/air-display.webp';
import LIGHTING_SYSTEM_IMAGE from '@/assets/images/lighting/light-display.webp';
import PARKING_SYSTEM_IMAGE from '@/assets/images/car/carDvc-display.webp';
import CHARGING_SYSTEM_IMAGE from '@/assets/images/car/charging-display.webp';
import SOLAR_SYSTEM_IMAGE from '@/assets/images/pv/pv-display.webp';
import STORAGE_SYSTEM_IMAGE from '@/assets/images/pv/storage-display.webp';
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
  buildDeviceRuntime,
  deviceAssetApi,
  deviceSystemApi,
  deviceSystemPermissions,
  meterPermissions,
  meterRepository,
  meteringApi,
  meteringPermissions,
  type DeviceAsset,
  type DeviceAssetInput,
  type DeviceMeterBindingInput,
  type DeviceRuntimeSnapshot,
  type DeviceSystem,
  type DeviceSystemInput,
  type DeviceSystemStatistics,
  type DeviceSystemType,
  type DeviceSystemViewMode,
  type MeterAsset,
  type MeteringPoint,
} from '@/domain/iot/assets';
import { fetchSpaceTree } from '@/domain/platform/org/api/space.api';
import { fetchTenants } from '@/domain/platform/org/api/tenant.api';
import type { TenantRecord } from '@/domain/platform/org';
import { flattenResources, getResourceBreadcrumb, type ResourceNode } from '@/domain/platform/org/resource';

const props = defineProps<{ systemType: DeviceSystemType }>();
const { t, locale } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const runtimeSettings = useRuntimeSettingsStore();
const permissions = computed(() => deviceSystemPermissions(props.systemType));
const canView = computed(() => authStore.can(permissions.value.view));
const canCreate = computed(() => authStore.can(permissions.value.create));
const canUpdate = computed(() => authStore.can(permissions.value.update));
const canDelete = computed(() => authStore.can(permissions.value.delete));
const canControl = computed(() => authStore.can(permissions.value.control));

const loading = ref(true);
const saving = ref(false);
const systems = ref<DeviceSystem[]>([]);
const total = ref(0);
const statistics = ref<DeviceSystemStatistics>({ total: 0, active: 0, disabled: 0, assetCount: 0, serviceSpaceCount: 0 });
const keyword = ref('');
const status = ref('');
const page = ref(1);
const pageSize = ref(runtimeSettings.pageSize);
const viewMode = ref<DeviceSystemViewMode>('card');
const spaces = ref<ResourceNode[]>([]);
const tenants = ref<TenantRecord[]>([]);
const meters = ref<MeterAsset[]>([]);
const meteringPoints = ref<MeteringPoint[]>([]);
const runtimeTick = ref(0);
let runtimeTimer: number | undefined;

const detailVisible = ref(false);
const detailLoading = ref(false);
const detailTab = ref('overview');
const selectedSystem = ref<DeviceSystem | null>(null);
const formVisible = ref(false);
const formStep = ref(0);
const editingId = ref('');
const unassignedAssets = ref<DeviceAsset[]>([]);
const unassignedSelectionId = ref('');

const title = computed(() => t(`deviceSystemPage.title.${props.systemType}`));
const flatSpaces = computed(() => flattenResources(spaces.value));
const kpis = computed(() => [
  { key: 'total', label: t('deviceSystemPage.kpi.total'), value: statistics.value.total, tone: 'primary' },
  { key: 'active', label: t('deviceSystemPage.kpi.active'), value: statistics.value.active, tone: 'success' },
  { key: 'assets', label: t('deviceSystemPage.kpi.assets'), value: statistics.value.assetCount, tone: 'primary' },
  { key: 'spaces', label: t('deviceSystemPage.kpi.spaces'), value: statistics.value.serviceSpaceCount, tone: 'warning' },
  { key: 'disabled', label: t('deviceSystemPage.kpi.disabled'), value: statistics.value.disabled, tone: 'neutral' },
]);
const runtimeById = computed(() => {
  runtimeTick.value;
  return new Map(systems.value.map(system => [system.id, buildDeviceRuntime(system)]));
});
const detailRuntime = computed(() => {
  runtimeTick.value;
  return selectedSystem.value ? buildDeviceRuntime(selectedSystem.value) : null;
});

const modes: Record<DeviceSystemType, string[]> = {
  HVAC: ['CENTRAL', 'SPLIT', 'VRF', 'FRESH_AIR'],
  LIGHTING: ['CENTRALIZED', 'DISTRIBUTED', 'HYBRID'],
  PARKING: ['SELF_OPERATED', 'OUTSOURCED'],
  CHARGING: ['PUBLIC', 'PRIVATE', 'FLEET'],
  SOLAR: ['SELF_USE', 'SELF_USE_SURPLUS_EXPORT', 'FULL_EXPORT'],
  STORAGE: ['GRID_CONNECTED', 'OFF_GRID', 'HYBRID'],
};
const defaultModes: Record<DeviceSystemType, string> = {
  HVAC: 'CENTRAL', LIGHTING: 'CENTRALIZED', PARKING: 'SELF_OPERATED',
  CHARGING: 'PUBLIC', SOLAR: 'SELF_USE_SURPLUS_EXPORT', STORAGE: 'GRID_CONNECTED',
};
const subtypeOptions: Record<DeviceSystemType, string[]> = {
  HVAC: ['CHILLER', 'CHILLED_WATER_PUMP', 'COOLING_WATER_PUMP', 'COOLING_TOWER', 'AHU', 'FCU', 'OUTDOOR_UNIT', 'INDOOR_UNIT', 'FRESH_AIR_UNIT', 'CONTROLLER', 'COLD_METER'],
  LIGHTING: ['DISTRIBUTION_CABINET', 'LIGHTING_CIRCUIT', 'LIGHT_CONTROLLER', 'LUMINAIRE_GROUP', 'CEILING_LIGHT', 'LINEAR_LIGHT', 'DOWNLIGHT', 'PENDANT_LIGHT', 'SPOTLIGHT', 'INDUSTRIAL_LIGHT', 'WALL_LIGHT', 'STREET_LIGHT'],
  PARKING: ['BARRIER_GATE', 'LANE_CONTROLLER', 'CAMERA', 'SPACE_DETECTOR'],
  CHARGING: ['CHARGER', 'CONNECTOR', 'POWER_CONTROLLER'],
  SOLAR: ['PV_ARRAY', 'INVERTER', 'COMBINER_BOX', 'GRID_CONNECTION_CABINET'],
  STORAGE: ['PCS', 'BMS', 'BATTERY_CLUSTER', 'BATTERY_PACK', 'CONTROLLER'],
};
const roleOptions: Record<DeviceSystemType, string[]> = {
  HVAC: ['SOURCE', 'CIRCULATION', 'HEAT_REJECTION', 'DISTRIBUTION', 'TERMINAL', 'CONTROL', 'METERING'],
  LIGHTING: ['PANEL', 'CIRCUIT', 'CONTROL', 'LOAD', 'METERING'],
  PARKING: ['ENTRY', 'EXIT', 'CONTROL', 'DETECTION', 'METERING'],
  CHARGING: ['STATION', 'CONNECTOR', 'CONTROL', 'METERING'],
  SOLAR: ['GENERATION', 'CONVERSION', 'GRID_CONNECTION', 'METERING'],
  STORAGE: ['CONVERSION', 'BATTERY', 'CONTROL', 'SAFETY', 'METERING'],
};
const purposeOptions: Record<DeviceSystemType, string[]> = {
  HVAC: ['ELECTRICITY_INPUT', 'COOLING_OUTPUT'],
  LIGHTING: ['LIGHTING_INPUT'],
  PARKING: ['PARKING_INPUT'],
  CHARGING: ['CHARGING_INPUT'],
  SOLAR: ['PV_GENERATION', 'GRID_IMPORT', 'GRID_EXPORT'],
  STORAGE: ['STORAGE_CHARGE', 'STORAGE_DISCHARGE'],
};
const systemImages: Record<DeviceSystemType, string> = {
  HVAC: HVAC_SYSTEM_IMAGE,
  LIGHTING: LIGHTING_SYSTEM_IMAGE,
  PARKING: PARKING_SYSTEM_IMAGE,
  CHARGING: CHARGING_SYSTEM_IMAGE,
  SOLAR: SOLAR_SYSTEM_IMAGE,
  STORAGE: STORAGE_SYSTEM_IMAGE,
};
const systemImage = computed(() => systemImages[props.systemType]);
const form = reactive<DeviceSystemInput>(emptyForm());

function emptyForm(): DeviceSystemInput {
  return {
    code: '', name: '', ownerTenantId: '', installSpaceNodeId: '', status: 'ACTIVE', remark: '',
    profile: { mode: defaultModes[props.systemType], primaryCapacity: 0, secondaryCapacity: 0, designArea: 0, quantity: 0 },
    assets: [], serviceSpaceNodeIds: [], meterBindings: [],
  };
}

function newAsset(): DeviceAssetInput {
  const subtype = subtypeOptions[props.systemType][0];
  return {
    code: '', name: nextAssetName(subtype), subtype,
    roleCode: roleOptions[props.systemType][0], ownerTenantId: form.ownerTenantId,
    installSpaceNodeId: form.installSpaceNodeId || form.serviceSpaceNodeIds[0] || '',
    manufacturer: '', model: '', serialNumber: '', capacityValue: 0, capacityUnit: 'kW',
    installedAt: '', status: 'ACTIVE', remark: '',
    access: { accessMode: '', protocolTemplate: '', deviceIdentifier: '', gatewayName: '', channelCode: '', heartbeatSeconds: 60, firmwareVersion: '' },
  };
}

function nextAssetName(subtype: string) {
  const typeName = t(`deviceSystemPage.subtype.${subtype}`);
  const scope = form.installSpaceNodeId || form.serviceSpaceNodeIds[0];
  const scopeLabel = scope ? (spaceName(scope).split(' / ').pop() || '') : '';
  const base = `${scopeLabel ? `${scopeLabel} ` : ''}${typeName}`;
  const existing = new Set(form.assets.map(asset => asset.name.trim().toLowerCase()));
  let index = 1;
  let candidate = `${base} ${index}号`;
  while (existing.has(candidate.toLowerCase())) candidate = `${base} ${++index}号`;
  return candidate;
}

function addAsset() {
  form.assets.push(newAsset());
}

async function loadUnassignedAssets() {
  try {
    const rows = await fetchAllPages((page, pageSize) =>
      deviceAssetApi.unassigned(props.systemType, { page, pageSize }));
    unassignedAssets.value = rows.map(item => item.asset);
    unassignedSelectionId.value = '';
  } catch (error) {
    showError(error, 'deviceSystemPage.messages.loadFailed');
  }
}

function adoptUnassignedAsset() {
  const asset = unassignedAssets.value.find(item => item.id === unassignedSelectionId.value);
  if (!asset || form.assets.some(item => item.id === asset.id)) return;
  form.assets.push({
    id: asset.id, version: asset.version, code: asset.code, name: asset.name, subtype: asset.subtype,
    roleCode: roleOptions[props.systemType][0], ownerTenantId: asset.ownerTenantId || '',
    installSpaceNodeId: asset.installSpaceNodeId, manufacturer: asset.manufacturer || '',
    model: asset.model || '', serialNumber: asset.serialNumber || '', capacityValue: asset.capacityValue,
    capacityUnit: asset.capacityUnit || '', installedAt: asset.installedAt?.slice(0, 19) || '',
    status: asset.status, remark: asset.remark || '', access: { ...(asset.access || {}) },
  });
  unassignedAssets.value = unassignedAssets.value.filter(item => item.id !== asset.id);
  unassignedSelectionId.value = '';
}

function onAssetSubtypeChange(asset: DeviceAssetInput) {
  if (!asset.id) asset.name = nextAssetName(asset.subtype);
}

function newBinding(): DeviceMeterBindingInput {
  const purpose = purposeOptions[props.systemType].find(item => !form.meterBindings.some(binding => binding.purposeCode === item))
    || purposeOptions[props.systemType][0];
  return {
    purposeCode: purpose,
    energyRole: props.systemType === 'SOLAR' ? 'GENERATION' : props.systemType === 'STORAGE' ? 'BIDIRECTIONAL' : 'CONSUMPTION',
    sourceType: 'METER',
    sourceId: '',
    sourceCode: '',
  };
}

async function loadWorkspace(resetPage = false) {
  if (!canView.value) return;
  if (resetPage) page.value = 1;
  loading.value = true;
  try {
    const [result, nextStatistics] = await Promise.all([
      deviceSystemApi.page(props.systemType, { keyword: keyword.value.trim(), status: status.value, page: page.value, pageSize: pageSize.value }),
      deviceSystemApi.statistics(props.systemType),
    ]);
    systems.value = result.items;
    total.value = result.total;
    statistics.value = nextStatistics;
  } catch (error) {
    showError(error, 'deviceSystemPage.messages.loadFailed');
  } finally {
    loading.value = false;
  }
}

async function loadFoundations() {
  if (!canView.value) return;
  const requests: Array<Promise<unknown>> = [
    fetchSpaceTree().then(result => { spaces.value = result; }),
    fetchAllPages((page, pageSize) => fetchTenants({ page, pageSize }))
      .then(result => { tenants.value = result; }),
  ];
  if (authStore.can(meterPermissions.view)) {
    requests.push(fetchAllPages((page, pageSize) => meterRepository.page({ page, pageSize }))
      .then(result => { meters.value = result; }));
  }
  if (authStore.can(meteringPermissions.view)) {
    requests.push(meteringApi.points().then(result => { meteringPoints.value = result; }));
  }
  try {
    await Promise.all(requests);
  } catch (error) {
    showError(error, 'deviceSystemPage.messages.loadFailed');
  }
}

function switchView(mode: DeviceSystemViewMode) {
  viewMode.value = mode;
}

function runtime(system: DeviceSystem): DeviceRuntimeSnapshot {
  return runtimeById.value.get(system.id) || buildDeviceRuntime(system);
}

function runtimeLabel() {
  return props.systemType === 'HVAC' ? 'deviceSystemPage.labels.assetCount'
    : props.systemType === 'LIGHTING' ? 'deviceSystemPage.runtime.lightingRate'
    : props.systemType === 'STORAGE' ? 'deviceSystemPage.runtime.soc'
      : props.systemType === 'PARKING' ? 'deviceSystemPage.runtime.occupancy'
        : props.systemType === 'CHARGING' ? 'deviceSystemPage.runtime.utilization'
          : 'deviceSystemPage.runtime.power';
}

function runtimeUnit() {
  return props.systemType === 'HVAC' ? t('deviceSystemPage.units.devices')
    : ['LIGHTING', 'STORAGE', 'PARKING', 'CHARGING'].includes(props.systemType) ? '%' : 'kW';
}

function primaryRuntimeValue(system: DeviceSystem) {
  if (props.systemType === 'HVAC') return system.assetCount;
  return runtime(system).communicationStatus === 'OFFLINE' ? '--' : runtime(system).currentValue;
}

function profileCapacity(system: DeviceSystem) {
  const primary = system.profile.primaryCapacity;
  if (primary == null) return '--';
  return props.systemType === 'SOLAR' ? `${primary} kWp`
    : props.systemType === 'STORAGE' && system.profile.secondaryCapacity != null
      ? `${primary} kW / ${system.profile.secondaryCapacity} kWh`
      : `${primary} kW`;
}

function openCreate() {
  if (!authStore.canEnter(permissions.value.create)) return;
  editingId.value = '';
  Object.assign(form, emptyForm());
  formStep.value = 0;
  formVisible.value = true;
  void loadUnassignedAssets();
}

async function openEdit(system: Pick<DeviceSystem, 'id'>) {
  if (!authStore.canEnter(permissions.value.update)) return;
  saving.value = true;
  try {
    const detail = await deviceSystemApi.get(props.systemType, system.id);
    editingId.value = detail.id;
    Object.assign(form, {
      code: detail.code,
      name: detail.name,
      ownerTenantId: detail.ownerTenantId || '',
      installSpaceNodeId: detail.installSpaceNodeId || '',
      status: detail.status,
      remark: detail.remark || '',
      profile: { ...detail.profile },
      assets: detail.assets.map(asset => ({
        id: asset.id, version: asset.version, code: asset.code, name: asset.name, subtype: asset.subtype,
        roleCode: asset.roleCode, ownerTenantId: asset.ownerTenantId || '',
        installSpaceNodeId: asset.installSpaceNodeId, manufacturer: asset.manufacturer || '',
        model: asset.model || '', serialNumber: asset.serialNumber || '',
        capacityValue: asset.capacityValue, capacityUnit: asset.capacityUnit || '',
        installedAt: asset.installedAt?.slice(0, 19) || '', status: asset.status,
        remark: asset.remark || '', access: { ...(asset.access || {}) },
      })),
      serviceSpaceNodeIds: detail.serviceScopes.map(scope => scope.spaceNodeId),
      meterBindings: detail.meterBindings.map(binding => ({
        purposeCode: binding.purposeCode, energyRole: binding.energyRole,
        sourceType: binding.sourceType, sourceId: binding.sourceId, sourceCode: binding.sourceCode,
      })),
      version: detail.version,
    });
    formStep.value = 0;
    formVisible.value = true;
    await loadUnassignedAssets();
  } catch (error) {
    showError(error, 'deviceSystemPage.messages.loadFailed');
  } finally {
    saving.value = false;
  }
}

async function openDetail(system: DeviceSystem) {
  detailVisible.value = true;
  detailLoading.value = true;
  detailTab.value = 'overview';
  try {
    selectedSystem.value = await deviceSystemApi.get(props.systemType, system.id);
  } catch (error) {
    detailVisible.value = false;
    showError(error, 'deviceSystemPage.messages.loadFailed');
  } finally {
    detailLoading.value = false;
  }
}

function validateStep(step: number) {
  if (step === 0 && !form.name.trim()) {
    ElMessage.warning(t('deviceSystemPage.validation.basic'));
    return false;
  }
  if (step === 1 && form.status === 'ACTIVE') {
    const invalid = !form.assets.length || form.assets.some(asset => !asset.name.trim() || !asset.subtype || !asset.roleCode || !asset.installSpaceNodeId);
    if (invalid) {
      ElMessage.warning(t('deviceSystemPage.validation.assets'));
      return false;
    }
    const normalizedNames = form.assets.map(asset => asset.name.trim().toLowerCase());
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      ElMessage.warning(t('deviceSystemPage.validation.duplicateAssetName'));
      return false;
    }
  }
  if (step === 2 && form.status === 'ACTIVE' && !form.serviceSpaceNodeIds.length) {
    ElMessage.warning(t('deviceSystemPage.validation.scopes'));
    return false;
  }
  if (step === 3) {
    const invalid = form.meterBindings.some(binding => !binding.purposeCode || !binding.energyRole || !binding.sourceType
      || (binding.sourceType === 'DEVICE_ASSET' ? !binding.sourceCode : !binding.sourceId));
    if (invalid) {
      ElMessage.warning(t('deviceSystemPage.validation.binding'));
      return false;
    }
  }
  return true;
}

function nextStep() {
  if (validateStep(formStep.value)) formStep.value = Math.min(4, formStep.value + 1);
}

async function saveSystem() {
  if (!(editingId.value ? canUpdate.value : canCreate.value)) return;
  for (let step = 0; step < 4; step += 1) {
    if (!validateStep(step)) {
      formStep.value = step;
      return;
    }
  }
  saving.value = true;
  try {
    if (editingId.value) await deviceSystemApi.update(props.systemType, editingId.value, form);
    else await deviceSystemApi.create(props.systemType, form);
    formVisible.value = false;
    await loadWorkspace();
    ElMessage.success(t(editingId.value ? 'deviceSystemPage.messages.updated' : 'deviceSystemPage.messages.created'));
  } catch (error) {
    showError(error, 'deviceSystemPage.messages.saveFailed');
  } finally {
    saving.value = false;
  }
}

async function removeSystem(system: DeviceSystem) {
  if (!canDelete.value) return;
  try {
    const preview = await deviceSystemApi.deletionPreview(props.systemType, system.id);
    await ElMessageBox.confirm(
      t('deviceSystemPage.dialog.deletePreview', {
        name: preview.systemName,
        assets: preview.assetCount,
        spaces: preview.serviceScopeCount,
        bindings: preview.meterBindingCount,
        unassigned: preview.unassignedAssetCount,
      }),
      t('deviceSystemPage.dialog.deleteTitle'),
      { type: 'warning' },
    );
    await deviceSystemApi.delete(props.systemType, system.id, system.version);
    await loadWorkspace();
    ElMessage.success(t('deviceSystemPage.messages.deleted'));
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    showError(error, 'deviceSystemPage.messages.deleteFailed');
  }
}

function simulateControl() {
  if (!canControl.value) return;
  ElMessage.info(t('deviceSystemPage.messages.controlSimulated'));
}

function removeAsset(index: number) {
  form.assets.splice(index, 1);
}

function removeBinding(index: number) {
  form.meterBindings.splice(index, 1);
}

function sourceOptions(binding: DeviceMeterBindingInput) {
  if (binding.sourceType === 'METER') return meters.value.map(item => ({ value: item.id, label: `${item.name} · ${item.serialNumber}` }));
  if (binding.sourceType === 'METERING_POINT') return meteringPoints.value.map(item => ({ value: String(item.id), label: `${item.name} · ${item.energyType}` }));
  return form.assets.filter(item => item.code).map(item => ({ value: item.code || '', label: `${item.name} · ${item.code}` }));
}

function onSourceTypeChange(binding: DeviceMeterBindingInput) {
  binding.sourceId = '';
  binding.sourceCode = '';
}

function spaceName(id?: string) {
  return id ? getResourceBreadcrumb(spaces.value, id) : '--';
}

function showError(error: unknown, fallbackKey: string) {
  if (error instanceof ApiError) {
    ElMessage.error(error.message);
    return;
  }
  ElMessage.error(t(fallbackKey));
}

function formatDateTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat(locale.value === 'en-US' ? 'en-US' : 'zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}

onMounted(async () => {
  if (!canView.value) return;
  await runtimeSettings.load();
  pageSize.value = runtimeSettings.pageSize;
  viewMode.value = runtimeSettings.deviceDefaultView === 'LIST' ? 'list' : 'card';
  await loadFoundations();
  await loadWorkspace();
  const createRequested = route.query.create === '1';
  const editId = typeof route.query.edit === 'string' ? route.query.edit : '';
  if (createRequested && authStore.canEnter(permissions.value.create)) openCreate();
  else if (editId && authStore.canEnter(permissions.value.update)) await openEdit({ id: editId });
  runtimeTimer = window.setInterval(() => { runtimeTick.value += 1; }, 30_000);
});
onBeforeUnmount(() => { if (runtimeTimer) window.clearInterval(runtimeTimer); });
watch([page, pageSize], () => void loadWorkspace());
watch(() => runtimeSettings.pageSize, value => { if (pageSize.value !== value) pageSize.value = value; });
</script>

<template>
  <DsListPageShell :title="title" :loading="canView && loading" page-class="device-system-page ds-domain-dense">
    <template #primary-action>
      <div class="device-system-page__header-actions">
        <el-button :icon="Refresh" :loading="loading" :disabled="!canView" @click="loadWorkspace()">{{ t('deviceSystemPage.actions.refresh') }}</el-button>
        <el-button v-permission.preview="permissions.create" type="primary" :icon="Plus" @click="openCreate">{{ t('deviceSystemPage.actions.create') }}</el-button>
      </div>
    </template>

    <template v-if="canView">
      <section class="device-kpis">
        <article v-for="item in kpis" :key="item.key" :class="`is-${item.tone}`">
          <span>{{ item.label }}</span><strong>{{ item.value }}</strong>
        </article>
      </section>

      <section class="device-toolbar ds-list-filter">
        <el-input v-model="keyword" class="ds-list-filter__keyword" clearable :placeholder="t('deviceSystemPage.filters.keyword')" @keyup.enter="loadWorkspace(true)" @clear="loadWorkspace(true)">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="status" class="ds-list-filter__select" clearable :placeholder="t('deviceSystemPage.filters.status')" @change="loadWorkspace(true)">
          <el-option :label="t('deviceSystemPage.status.ACTIVE')" value="ACTIVE" />
          <el-option :label="t('deviceSystemPage.status.DISABLED')" value="DISABLED" />
        </el-select>
        <div class="device-query-actions">
          <el-button type="primary" @click="loadWorkspace(true)">{{ t('deviceSystemPage.actions.search') }}</el-button>
          <el-button @click="keyword=''; status=''; loadWorkspace(true)">{{ t('deviceSystemPage.actions.reset') }}</el-button>
        </div>
        <el-button-group class="device-view-switch" :aria-label="t('deviceSystemPage.viewMode.label')">
          <el-button :type="viewMode==='card'?'primary':'default'" :icon="Grid" :title="t('deviceSystemPage.viewMode.card')" @click="switchView('card')" />
          <el-button :type="viewMode==='list'?'primary':'default'" :icon="List" :title="t('deviceSystemPage.viewMode.list')" @click="switchView('list')" />
        </el-button-group>
      </section>

      <section class="device-results ds-list-table-shell">
        <div v-if="viewMode==='card' && systems.length" class="device-card-grid">
          <article v-for="system in systems" :key="system.id" class="device-card">
            <header>
              <div class="device-card__identity">
                <strong :title="system.name">{{ system.name }}</strong>
                <span>{{ system.code }}</span>
              </div>
              <DsTag :type="runtime(system).communicationStatus==='ONLINE'?'success':runtime(system).communicationStatus==='WARNING'?'warning':'neutral'" size="small" dot>
                {{ t(`deviceSystemPage.communication.${runtime(system).communicationStatus}`) }}
              </DsTag>
            </header>
            <div class="device-card__runtime">
              <div class="device-visual" :class="`is-${systemType.toLowerCase()}`">
                <img :src="systemImage" :alt="`${title} · ${system.name}`" loading="lazy" decoding="async" />
              </div>
              <div class="device-primary-metric">
                <span>{{ t(runtimeLabel()) }}</span>
                <strong>{{ primaryRuntimeValue(system) }}<small>{{ runtimeUnit() }}</small></strong>
              </div>
              <div class="device-setpoint">
                <span>{{ t('deviceSystemPage.labels.livePower') }}</span>
                <strong>{{ runtime(system).livePower }}<small> kW</small></strong>
              </div>
            </div>
            <dl>
              <div><dt>{{ t('deviceSystemPage.labels.profileMode') }}</dt><dd>{{ t(`deviceSystemPage.mode.${system.profile.mode}`) }}</dd></div>
              <div><dt>{{ t('deviceSystemPage.labels.primaryCapacity') }}</dt><dd>{{ profileCapacity(system) }}</dd></div>
              <div><dt>{{ t('deviceSystemPage.labels.serviceScope') }}</dt><dd :title="system.serviceScopeSummary">{{ system.serviceScopeSummary || '--' }}</dd></div>
              <div><dt>{{ t('deviceSystemPage.labels.assetCount') }}</dt><dd>{{ system.assetCount }}</dd></div>
              <div><dt>{{ t('deviceSystemPage.labels.todayEnergy') }}</dt><dd>{{ runtime(system).todayEnergy }} kWh</dd></div>
              <div><dt>{{ t('deviceSystemPage.labels.updatedAt') }}</dt><dd>{{ formatDateTime(runtime(system).updatedAt) }}</dd></div>
            </dl>
            <footer>
              <DsTag type="warning" size="small">{{ t('deviceSystemPage.quality.simulated') }}</DsTag>
              <div class="card-actions">
                <el-button text type="primary" :icon="View" @click="openDetail(system)">{{ t('deviceSystemPage.actions.view') }}</el-button>
                <el-button v-permission.preview="permissions.update" text :icon="EditPen" @click="openEdit(system)">{{ t('deviceSystemPage.actions.edit') }}</el-button>
                <el-dropdown trigger="click">
                  <el-button text>{{ t('deviceSystemPage.actions.more') }}</el-button>
                  <template #dropdown><el-dropdown-menu>
                    <el-dropdown-item :disabled="!canControl" @click="simulateControl">{{ t('deviceSystemPage.actions.mockControl') }}</el-dropdown-item>
                    <el-dropdown-item divided :disabled="!canDelete" @click="removeSystem(system)">{{ t('deviceSystemPage.actions.delete') }}</el-dropdown-item>
                  </el-dropdown-menu></template>
                </el-dropdown>
              </div>
            </footer>
          </article>
        </div>

        <DsDataTable v-else-if="systems.length" :rows="systems as unknown as Record<string,unknown>[]" :columns="[]" class="device-table">
          <el-table-column :label="t('deviceSystemPage.table.system')" min-width="210">
            <template #default="{row}"><div class="stack-cell"><strong :title="row.name">{{ row.name }}</strong><small>{{ row.code }}</small></div></template>
          </el-table-column>
          <el-table-column :label="t('deviceSystemPage.table.profile')" min-width="170">
            <template #default="{row}"><div class="stack-cell"><span>{{ t(`deviceSystemPage.mode.${row.profile.mode}`) }}</span><small>{{ profileCapacity(row) }}</small></div></template>
          </el-table-column>
          <el-table-column :label="t('deviceSystemPage.table.serviceScope')" min-width="210" show-overflow-tooltip prop="serviceScopeSummary" />
          <el-table-column :label="t('deviceSystemPage.table.assets')" width="130">
            <template #default="{row}">{{ row.assetCount }} / {{ row.meterBindingCount }}</template>
          </el-table-column>
          <el-table-column :label="t('deviceSystemPage.table.status')" width="110">
            <template #default="{row}"><DsTag :type="row.status==='ACTIVE'?'success':'neutral'" size="small">{{ t(`deviceSystemPage.status.${row.status}`) }}</DsTag></template>
          </el-table-column>
          <el-table-column :label="t('deviceSystemPage.table.actions')" width="176" fixed="right">
            <template #default="{row}"><div class="ds-row-actions">
              <el-button text type="primary" @click="openDetail(row)">{{ t('deviceSystemPage.actions.view') }}</el-button>
              <el-button v-permission.preview="permissions.update" text @click="openEdit(row)">{{ t('deviceSystemPage.actions.edit') }}</el-button>
              <el-dropdown trigger="click"><el-button text>{{ t('deviceSystemPage.actions.more') }}</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item :disabled="!canControl" @click="simulateControl">{{ t('deviceSystemPage.actions.mockControl') }}</el-dropdown-item><el-dropdown-item divided :disabled="!canDelete" @click="removeSystem(row)">{{ t('deviceSystemPage.actions.delete') }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
            </div></template>
          </el-table-column>
        </DsDataTable>
        <DsEmpty v-else :description="t('deviceSystemPage.empty.description')" />
      <footer class="device-pagination ds-list-table-footer ds-list-table-footer--pagination-only"><DsPagination v-model:page="page" v-model:page-size="pageSize" :total="total" /></footer>
      </section>
    </template>
    <DsEmpty v-else :description="t('deviceSystemPage.empty.permissionDenied')" />

    <template #overlays>
      <el-dialog v-model="formVisible" width="min(1120px, 94vw)" top="5vh" class="device-system-dialog" :close-on-click-modal="false"
        :title="t(editingId?'deviceSystemPage.dialog.edit':'deviceSystemPage.dialog.create',{type:title})">
        <el-steps :active="formStep" align-center finish-status="success" class="device-form-steps">
          <el-step v-for="key in ['basic','assets','scopes','metering','confirm']" :key="key" :title="t(`deviceSystemPage.steps.${key}`)" />
        </el-steps>
        <div class="device-form-body">
          <el-form v-if="formStep===0" label-position="top">
            <div class="form-grid">
              <el-form-item :label="t('deviceSystemPage.labels.code')"><el-input v-model="form.code" :disabled="!!editingId" :placeholder="t('deviceSystemPage.hints.code')" /></el-form-item>
              <el-form-item :label="t('deviceSystemPage.labels.name')" required><el-input v-model="form.name" maxlength="128" /></el-form-item>
              <el-form-item :label="t('deviceSystemPage.labels.owner')">
                <el-select v-model="form.ownerTenantId" clearable filterable><el-option v-for="tenant in tenants" :key="tenant.id" :label="tenant.name" :value="tenant.id" /></el-select>
                <small class="field-hint">{{ t('deviceSystemPage.hints.owner') }}</small>
              </el-form-item>
              <el-form-item :label="t('deviceSystemPage.labels.installSpace')">
                <el-tree-select v-model="form.installSpaceNodeId" :data="spaces" node-key="id" check-strictly clearable filterable :props="{label:'name',children:'children',value:'id'}" />
                <small class="field-hint">{{ t('deviceSystemPage.hints.installSpace') }}</small>
              </el-form-item>
              <el-form-item :label="t('deviceSystemPage.labels.profileMode')">
                <el-select v-model="form.profile.mode"><el-option v-for="mode in modes[systemType]" :key="mode" :label="t(`deviceSystemPage.mode.${mode}`)" :value="mode" /></el-select>
              </el-form-item>
              <el-form-item :label="t('deviceSystemPage.labels.status')"><el-select v-model="form.status"><el-option :label="t('deviceSystemPage.status.ACTIVE')" value="ACTIVE" /><el-option :label="t('deviceSystemPage.status.DISABLED')" value="DISABLED" /></el-select></el-form-item>
              <el-form-item :label="t('deviceSystemPage.labels.primaryCapacity')"><el-input-number v-model="form.profile.primaryCapacity" :min="0" :precision="2" /><span class="unit-hint">{{ systemType==='SOLAR'?'kWp':'kW' }}</span></el-form-item>
              <el-form-item v-if="['HVAC','STORAGE'].includes(systemType)" :label="t('deviceSystemPage.labels.secondaryCapacity')"><el-input-number v-model="form.profile.secondaryCapacity" :min="0" :precision="2" /><span class="unit-hint">{{ systemType==='STORAGE'?'kWh':'kW' }}</span></el-form-item>
              <el-form-item v-if="systemType==='HVAC'" :label="t('deviceSystemPage.labels.designArea')"><el-input-number v-model="form.profile.designArea" :min="0" :precision="2" /><span class="unit-hint">m²</span></el-form-item>
              <el-form-item v-if="['LIGHTING','PARKING','CHARGING'].includes(systemType)" :label="t('deviceSystemPage.labels.quantity')"><el-input-number v-model="form.profile.quantity" :min="0" :precision="0" /></el-form-item>
              <el-form-item v-if="['SOLAR','PARKING'].includes(systemType)" :label="t('deviceSystemPage.labels.extra')"><el-input v-model="form.profile.extra" /></el-form-item>
            </div>
            <el-form-item :label="t('deviceSystemPage.labels.remark')"><el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit /></el-form-item>
          </el-form>

          <section v-else-if="formStep===1" class="asset-editor">
            <header><div><strong>{{ t('deviceSystemPage.steps.assets') }}</strong><span>{{ t('deviceSystemPage.hints.assetLifecycle') }}</span></div><div class="asset-editor__actions"><el-select v-model="unassignedSelectionId" clearable filterable :placeholder="t('deviceSystemPage.lifecycle.unassignedPool')"><el-option v-for="asset in unassignedAssets" :key="asset.id" :value="asset.id" :label="`${asset.name} · ${asset.code}`" /></el-select><el-button :disabled="!unassignedSelectionId" @click="adoptUnassignedAsset">{{ t('deviceSystemPage.lifecycle.assignToSystem') }}</el-button><el-button type="primary" plain :icon="Plus" @click="addAsset">{{ t('deviceSystemPage.actions.addAsset') }}</el-button></div></header>
            <article v-for="(asset,index) in form.assets" :key="asset.id||index" class="asset-editor__item">
              <header><strong>{{ index+1 }}. {{ asset.name || t('deviceSystemPage.labels.assetName') }}</strong><el-button text type="danger" :icon="Delete" @click="removeAsset(index)" /></header>
              <div class="asset-grid">
                <el-form-item :label="t('deviceSystemPage.labels.assetCode')"><el-input v-model="asset.code" :disabled="!!asset.id" /></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.assetName')" required><el-input v-model="asset.name" /></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.subtype')" required><el-select v-model="asset.subtype" @change="onAssetSubtypeChange(asset)"><el-option v-for="option in subtypeOptions[systemType]" :key="option" :label="t(`deviceSystemPage.subtype.${option}`)" :value="option" /></el-select></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.roleCode')" required><el-select v-model="asset.roleCode"><el-option v-for="option in roleOptions[systemType]" :key="option" :label="t(`deviceSystemPage.role.${option}`)" :value="option" /></el-select></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.assetInstallSpace')" required><el-tree-select v-model="asset.installSpaceNodeId" :data="spaces" node-key="id" check-strictly filterable :props="{label:'name',children:'children',value:'id'}" /></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.owner')"><el-select v-model="asset.ownerTenantId" clearable filterable><el-option v-for="tenant in tenants" :key="tenant.id" :label="tenant.name" :value="tenant.id" /></el-select></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.manufacturer')"><el-input v-model="asset.manufacturer" /></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.model')"><el-input v-model="asset.model" /></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.serialNumber')"><el-input v-model="asset.serialNumber" /></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.capacity')"><div class="capacity-field"><el-input-number v-model="asset.capacityValue" :min="0" :precision="2" /><el-input v-model="asset.capacityUnit" /></div></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.accessMode')"><el-input v-model="asset.access!.accessMode" /></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.protocol')"><el-input v-model="asset.access!.protocolTemplate" /></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.identifier')"><el-input v-model="asset.access!.deviceIdentifier" /></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.gateway')"><el-input v-model="asset.access!.gatewayName" /></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.channel')"><el-input v-model="asset.access!.channelCode" /></el-form-item>
                <el-form-item :label="t('deviceSystemPage.labels.firmware')"><el-input v-model="asset.access!.firmwareVersion" /></el-form-item>
              </div>
            </article>
            <DsEmpty v-if="!form.assets.length" :description="t('deviceSystemPage.validation.assets')" />
          </section>

          <section v-else-if="formStep===2" class="scope-editor">
            <p>{{ t('deviceSystemPage.hints.serviceScope') }}</p>
            <el-tree-select class="service-scope-select" v-model="form.serviceSpaceNodeIds" :data="spaces" node-key="id" multiple show-checkbox check-strictly filterable collapse-tags collapse-tags-tooltip :max-collapse-tags="1" :props="{label:'name',children:'children',value:'id'}" />
            <div class="selected-scopes"><DsTag v-for="id in form.serviceSpaceNodeIds" :key="id" type="primary" :title="spaceName(id)">{{ spaceName(id) }}</DsTag></div>
          </section>

          <section v-else-if="formStep===3" class="binding-editor">
            <header><div><strong>{{ t('deviceSystemPage.steps.metering') }}</strong><span>{{ t('deviceSystemPage.hints.metering') }}</span></div><el-button type="primary" plain :icon="Plus" @click="form.meterBindings.push(newBinding())">{{ t('deviceSystemPage.actions.addBinding') }}</el-button></header>
            <article v-for="(binding,index) in form.meterBindings" :key="index" class="binding-row">
              <el-select v-model="binding.purposeCode"><el-option v-for="option in purposeOptions[systemType]" :key="option" :label="t(`deviceSystemPage.purpose.${option}`)" :value="option" /></el-select>
              <el-select v-model="binding.energyRole"><el-option v-for="option in ['CONSUMPTION','GENERATION','BIDIRECTIONAL']" :key="option" :label="t(`deviceSystemPage.energyRole.${option}`)" :value="option" /></el-select>
              <el-select v-model="binding.sourceType" @change="onSourceTypeChange(binding)"><el-option v-for="option in ['METER','METERING_POINT','DEVICE_ASSET']" :key="option" :label="t(`deviceSystemPage.sourceType.${option}`)" :value="option" /></el-select>
              <el-select v-if="binding.sourceType==='DEVICE_ASSET'" v-model="binding.sourceCode" filterable><el-option v-for="option in sourceOptions(binding)" :key="option.value" :label="option.label" :value="option.value" /></el-select>
              <el-select v-else v-model="binding.sourceId" filterable><el-option v-for="option in sourceOptions(binding)" :key="option.value" :label="option.label" :value="option.value" /></el-select>
              <el-button text type="danger" :icon="Delete" @click="removeBinding(index)" />
            </article>
            <DsEmpty v-if="!form.meterBindings.length" :description="t('deviceSystemPage.hints.metering')" />
          </section>

          <section v-else class="confirm-panel">
            <h3>{{ form.name }}</h3><p>{{ form.code || t('deviceSystemPage.hints.code') }}</p>
            <div class="confirm-grid">
              <article><span>{{ t('deviceSystemPage.labels.profileMode') }}</span><strong>{{ t(`deviceSystemPage.mode.${form.profile.mode}`) }}</strong></article>
              <article><span>{{ t('deviceSystemPage.labels.assetCount') }}</span><strong>{{ form.assets.length }}</strong></article>
              <article><span>{{ t('deviceSystemPage.labels.serviceScope') }}</span><strong>{{ form.serviceSpaceNodeIds.length }}</strong></article>
              <article><span>{{ t('deviceSystemPage.labels.bindingCount') }}</span><strong>{{ form.meterBindings.length }}</strong></article>
            </div>
            <p class="mock-boundary">{{ t('deviceSystemPage.hints.mock') }}</p>
          </section>
        </div>
        <template #footer>
          <el-button @click="formVisible=false">{{ t('deviceSystemPage.actions.cancel') }}</el-button>
          <el-button v-if="formStep>0" @click="formStep-=1">{{ t('deviceSystemPage.actions.previous') }}</el-button>
          <el-button v-if="formStep<4" type="primary" @click="nextStep">{{ t('deviceSystemPage.actions.next') }}</el-button>
          <el-button v-else v-permission="editingId ? permissions.update : permissions.create" type="primary" :loading="saving" :disabled="editingId?!canUpdate:!canCreate" @click="saveSystem">{{ t('deviceSystemPage.actions.save') }}</el-button>
        </template>
      </el-dialog>

      <el-drawer v-model="detailVisible" size="min(1080px, 88vw)" destroy-on-close>
        <template #header><div class="drawer-title"><div><h2>{{ selectedSystem?.name }}</h2><p>{{ selectedSystem?.code }} · {{ selectedSystem?.serviceScopeSummary }}</p></div><el-button v-permission.preview="permissions.update" :disabled="!selectedSystem" :icon="EditPen" @click="selectedSystem&&openEdit(selectedSystem)">{{ t('deviceSystemPage.actions.edit') }}</el-button></div></template>
        <div v-loading="detailLoading">
          <p class="mock-boundary">{{ t('deviceSystemPage.hints.mock') }}</p>
          <el-tabs v-if="selectedSystem" v-model="detailTab">
            <el-tab-pane :label="t('deviceSystemPage.tabs.overview')" name="overview">
              <div class="runtime-grid">
                <article><span>{{ t(runtimeLabel()) }}</span><strong>{{ selectedSystem ? primaryRuntimeValue(selectedSystem) : '--' }} {{ runtimeUnit() }}</strong></article>
                <article><span>{{ t('deviceSystemPage.labels.livePower') }}</span><strong>{{ detailRuntime?.livePower }} kW</strong></article>
                <article><span>{{ t('deviceSystemPage.labels.todayEnergy') }}</span><strong>{{ detailRuntime?.todayEnergy }} kWh</strong></article>
                <article><span>{{ t('deviceSystemPage.labels.updatedAt') }}</span><strong>{{ formatDateTime(detailRuntime?.updatedAt) }}</strong></article>
              </div>
              <el-descriptions :column="2" border>
                <el-descriptions-item :label="t('deviceSystemPage.labels.profileMode')">{{ t(`deviceSystemPage.mode.${selectedSystem.profile.mode}`) }}</el-descriptions-item>
                <el-descriptions-item :label="t('deviceSystemPage.labels.owner')">{{ selectedSystem.ownerTenantName || '--' }}</el-descriptions-item>
                <el-descriptions-item :label="t('deviceSystemPage.labels.installSpace')">{{ selectedSystem.installSpaceName || '--' }}</el-descriptions-item>
                <el-descriptions-item :label="t('deviceSystemPage.labels.status')">{{ t(`deviceSystemPage.status.${selectedSystem.status}`) }}</el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>
            <el-tab-pane :label="t('deviceSystemPage.tabs.assets')" name="assets">
              <el-table :data="selectedSystem.assets">
                <el-table-column prop="name" :label="t('deviceSystemPage.labels.assetName')" min-width="170" show-overflow-tooltip />
                <el-table-column :label="t('deviceSystemPage.labels.subtype')" min-width="140"><template #default="{row}">{{ t(`deviceSystemPage.subtype.${row.subtype}`) }}</template></el-table-column>
                <el-table-column prop="installSpaceName" :label="t('deviceSystemPage.labels.assetInstallSpace')" min-width="180" show-overflow-tooltip />
                <el-table-column prop="model" :label="t('deviceSystemPage.labels.model')" min-width="120" show-overflow-tooltip />
                <el-table-column prop="access.deviceIdentifier" :label="t('deviceSystemPage.labels.identifier')" min-width="150" show-overflow-tooltip />
              </el-table>
            </el-tab-pane>
            <el-tab-pane :label="t('deviceSystemPage.tabs.scopes')" name="scopes">
              <el-table :data="selectedSystem.serviceScopes"><el-table-column prop="spaceName" :label="t('deviceSystemPage.labels.serviceScope')" min-width="220" /><el-table-column prop="revisionNo" :label="t('deviceSystemPage.labels.revision')" width="100" /><el-table-column :label="t('deviceSystemPage.labels.effective')" min-width="170"><template #default="{row}">{{ formatDateTime(row.validFrom) }}</template></el-table-column></el-table>
            </el-tab-pane>
            <el-tab-pane :label="t('deviceSystemPage.tabs.metering')" name="metering">
              <el-table :data="selectedSystem.meterBindings"><el-table-column :label="t('deviceSystemPage.labels.purpose')" min-width="160"><template #default="{row}">{{ t(`deviceSystemPage.purpose.${row.purposeCode}`) }}</template></el-table-column><el-table-column prop="sourceName" :label="t('deviceSystemPage.labels.source')" min-width="200" show-overflow-tooltip /><el-table-column :label="t('deviceSystemPage.labels.energyRole')" width="130"><template #default="{row}">{{ t(`deviceSystemPage.energyRole.${row.energyRole}`) }}</template></el-table-column></el-table>
            </el-tab-pane>
            <el-tab-pane :label="t('deviceSystemPage.tabs.history')" name="history">
              <el-table :data="selectedSystem.history"><el-table-column prop="revisionNo" :label="t('deviceSystemPage.labels.revision')" width="90" /><el-table-column prop="relationType" :label="t('deviceSystemPage.labels.type')" width="150" /><el-table-column prop="summary" :label="t('deviceSystemPage.labels.remark')" min-width="220" show-overflow-tooltip /><el-table-column :label="t('deviceSystemPage.labels.effective')" min-width="170"><template #default="{row}">{{ formatDateTime(row.validFrom) }}</template></el-table-column><el-table-column :label="t('deviceSystemPage.labels.ended')" min-width="170"><template #default="{row}">{{ formatDateTime(row.validTo) }}</template></el-table-column></el-table>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-drawer>
    </template>
  </DsListPageShell>
</template>

<style scoped>
.device-system-page__header-actions{margin-left:auto;display:flex;gap:8px}
.device-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin:10px 14px 0;border:1px solid var(--color-border-default);border-radius:var(--radius-md);overflow:hidden}
.device-kpis article{height:54px;padding:7px 12px;display:grid;align-content:center;border-right:1px solid var(--color-border-default)}
.device-kpis article:last-child{border-right:0}.device-kpis span{color:var(--color-text-secondary);font-size:var(--font-caption)}.device-kpis strong{font-size:18px;line-height:1.2}
.device-kpis .is-primary strong{color:var(--color-primary-500)}.device-kpis .is-success strong{color:var(--color-success-default)}.device-kpis .is-warning strong{color:var(--color-warning-default)}
.device-toolbar{margin:10px 14px 0;padding:0;display:grid;grid-template-columns:minmax(280px,420px) 160px auto minmax(24px,1fr) 76px;gap:10px;align-items:center}
.device-query-actions{display:inline-flex;align-items:center;gap:10px;white-space:nowrap}.device-query-actions :deep(.el-button){min-width:76px;margin:0}
.device-view-switch{grid-column:5;justify-self:end}.device-view-switch :deep(.el-button){width:38px;padding:0}
.device-results{min-height:220px;margin:10px 14px 0}.device-pagination{margin:10px 14px 14px;padding-top:10px;border-top:1px solid var(--color-border-default)}
.device-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:10px}
.device-card{min-width:0;border:1px solid var(--color-border-default);border-radius:var(--radius-md);background:var(--color-bg-surface);transition:border-color .18s ease,box-shadow .18s ease}
.device-card:hover{border-color:color-mix(in srgb,var(--color-primary-500) 38%,var(--color-border-default));box-shadow:var(--shadow-sm)}
.device-card>header{min-height:52px;padding:9px 11px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;border-bottom:1px solid var(--color-border-default)}
.device-card__identity{min-width:0;display:grid;gap:3px}.device-card__identity strong,.device-card__identity span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.device-card__identity span{color:var(--color-text-secondary);font-size:var(--font-caption)}
.device-card__runtime{min-height:92px;padding:10px 12px;display:grid;grid-template-columns:76px minmax(0,1fr) minmax(88px,.8fr);align-items:center;gap:12px;background:color-mix(in srgb,var(--color-primary-50) 55%,var(--color-bg-surface))}
.device-visual{width:72px;height:64px;display:grid;place-items:center;overflow:hidden}
.device-visual img{display:block;width:72px;height:60px;object-fit:contain;filter:drop-shadow(0 7px 9px rgb(15 23 42 / 16%))}
.device-visual.is-hvac img{height:42px;object-fit:cover}
html[data-theme="dark"] .device-visual img{filter:drop-shadow(0 8px 10px rgb(0 0 0 / 36%))}
.device-primary-metric,.device-setpoint{display:grid;gap:5px}.device-primary-metric span,.device-setpoint span{color:var(--color-text-secondary);font-size:var(--font-caption)}
.device-primary-metric strong{font-size:25px;color:var(--color-primary-500)}.device-setpoint strong{font-size:16px}.device-primary-metric small,.device-setpoint small{font-size:12px;font-weight:400}
.device-card dl{margin:0;padding:5px 11px;display:grid;grid-template-columns:1fr 1fr;column-gap:14px}.device-card dl div{min-width:0;padding:6px 0;border-bottom:1px dashed var(--color-border-default)}
.device-card dt{color:var(--color-text-secondary);font-size:var(--font-caption)}.device-card dd{margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--ds-datatable-font)}
.device-card footer{min-height:42px;padding:0 8px 0 11px;display:flex;align-items:center;justify-content:space-between;gap:8px}.card-actions{display:flex;align-items:center;white-space:nowrap}.card-actions :deep(.el-button){margin:0;padding:0 5px;font-size:var(--ds-datatable-font)}
.device-table{font-size:var(--ds-datatable-font)}.stack-cell{min-width:0;display:grid;gap:2px}.stack-cell strong,.stack-cell small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stack-cell small{color:var(--color-text-secondary)}.table-actions{display:flex;gap:0;white-space:nowrap}.table-actions :deep(.el-button){margin:0;padding:0 4px}
.device-form-steps{padding:0 8px 14px;border-bottom:1px solid var(--color-border-default)}.device-form-steps :deep(.el-step__title){font-size:13px}.device-form-body{height:min(64vh,650px);min-width:0;padding:16px 4px 4px;overflow-x:hidden;overflow-y:auto}
.form-grid,.asset-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.form-grid :deep(.el-select),.form-grid :deep(.el-tree-select),.asset-grid :deep(.el-select),.asset-grid :deep(.el-tree-select){width:100%}.field-hint{display:block;margin-top:5px;color:var(--color-text-secondary);font-size:var(--font-caption);line-height:1.4}.unit-hint{margin-left:8px;color:var(--color-text-secondary)}
.asset-editor>header,.binding-editor>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:10px}.asset-editor>header>div:first-child,.binding-editor>header>div:first-child{display:grid;gap:3px}.asset-editor>header span,.binding-editor>header span{color:var(--color-text-secondary);font-size:var(--font-caption)}.asset-editor__actions{display:flex;align-items:center;gap:8px}.asset-editor__actions :deep(.el-select){width:270px}
.asset-editor__item{margin-bottom:10px;padding:0 12px 4px;border:1px solid var(--color-border-default);border-radius:var(--radius-md)}.asset-editor__item>header{min-height:42px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--color-border-default)}.asset-grid{padding-top:10px}.capacity-field{display:grid;grid-template-columns:1fr 80px;gap:8px}
.scope-editor{min-width:0;max-width:100%;overflow:hidden}.scope-editor>p{margin:0 0 14px;color:var(--color-text-secondary);overflow-wrap:anywhere}.scope-editor .service-scope-select{width:min(400px,100%);min-width:0;max-width:100%}.selected-scopes{max-width:100%;max-height:128px;margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;overflow:auto}.selected-scopes :deep(.ds-tag){min-width:0;max-width:100%}.selected-scopes :deep(.ds-tag__content){display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.binding-row{display:grid;grid-template-columns:1.1fr .9fr .9fr 1.5fr 36px;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--color-border-default)}
.confirm-panel{text-align:center}.confirm-panel h3{margin:18px 0 4px;font-size:22px}.confirm-panel>p{color:var(--color-text-secondary)}.confirm-grid{max-width:760px;margin:24px auto;display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--color-border-default);border-radius:var(--radius-md);overflow:hidden}.confirm-grid article{padding:18px 10px;display:grid;gap:6px;border-right:1px solid var(--color-border-default)}.confirm-grid article:last-child{border-right:0}.confirm-grid span{color:var(--color-text-secondary);font-size:var(--font-caption)}.confirm-grid strong{font-size:20px}
.mock-boundary{padding:8px 12px;color:var(--color-text-secondary);background:var(--color-bg-muted);border-radius:var(--radius-sm);font-size:var(--font-caption)}.drawer-title{width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px}.drawer-title h2,.drawer-title p{margin:0}.drawer-title p{margin-top:3px;color:var(--color-text-secondary);font-size:var(--font-caption)}
.form-grid :deep(.el-input-number),.asset-grid :deep(.el-input-number){width:100%}.scope-editor :deep(.el-select__wrapper){min-height:32px;overflow:hidden}.scope-editor :deep(.el-tag){max-width:calc(100% - 34px)}.scope-editor :deep(.el-tag__content){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.runtime-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.runtime-grid article{padding:14px;border:1px solid var(--color-border-default);border-radius:var(--radius-md)}.runtime-grid span{color:var(--color-text-secondary);font-size:var(--font-caption)}.runtime-grid strong{display:block;margin-top:6px;font-size:19px}
@media(max-width:1200px){.device-toolbar{grid-template-columns:minmax(220px,1fr) 150px auto 76px}.device-view-switch{grid-column:4}.device-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:900px){.device-toolbar{grid-template-columns:minmax(0,1fr) 150px}.device-query-actions{grid-column:1}.device-view-switch{grid-column:2;grid-row:2}.device-card-grid{grid-template-columns:1fr}}
</style>
