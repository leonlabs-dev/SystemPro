<script setup lang="ts">
import {
  Box,
  Connection,
  FullScreen,
  Lightning,
  Location,
  Minus,
  Odometer,
  Plus,
  Refresh,
  Sunny,
  Van,
  WindPower,
} from '@element-plus/icons-vue';
import { computed, onActivated, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ApiError } from '@/core/api/contracts';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import {
  energyTopologyApi,
  type EnergyRole,
  type EnergySystemType,
  type EnergyTopology,
  type EnergyTopologySystem,
} from '@/domain/energy/topology/energy-topology.api';

interface BranchGroup {
  key: 'environment' | 'lighting' | 'mobility';
  types: EnergySystemType[];
  systems: EnergyTopologySystem[];
  center: number;
}

interface SourceCard {
  key: 'grid' | 'solar' | 'storage';
  x: number;
  name: string;
  code: string;
  metric: string;
  system?: EnergyTopologySystem;
  icon: typeof Connection;
}

interface LoadLayout {
  branch: BranchGroup;
  system: EnergyTopologySystem;
  x: number;
}

const { t, locale } = useI18n();
const router = useRouter();
const systemTypes: EnergySystemType[] = ['HVAC', 'LIGHTING', 'PARKING', 'CHARGING', 'SOLAR', 'STORAGE'];
const selectedTypes = ref<EnergySystemType[]>([...systemTypes]);
const data = ref<EnergyTopology>();
const selectedKey = ref('overview');
const loading = ref(true);
const loadError = ref('');
const zoom = ref(recommendedZoom());
let sequence = 0;

const visibleSystems = computed(() => data.value?.systems.filter(item => selectedTypes.value.includes(item.systemType)) || []);
const consumerSystems = computed(() => visibleSystems.value.filter(item => !['SOLAR', 'STORAGE'].includes(item.systemType)));
const solarSystem = computed(() => visibleSystems.value.find(item => item.systemType === 'SOLAR'));
const storageSystem = computed(() => visibleSystems.value.find(item => item.systemType === 'STORAGE'));
const firstConsumptionBinding = computed(() => data.value?.systems
  .flatMap(system => system.meterBindings)
  .find(binding => binding.energyRole === 'CONSUMPTION'));
const selectedSystem = computed(() => {
  if (!selectedKey.value.startsWith('system:')) return undefined;
  const id = Number(selectedKey.value.slice('system:'.length));
  return data.value?.systems.find(item => item.id === id);
});
const unmeteredCount = computed(() => visibleSystems.value.filter(item => !item.meterBindings.length).length);
const boundSystemCount = computed(() => visibleSystems.value.length - unmeteredCount.value);
const gridRelation = computed(() => data.value?.meteringRelations[0]);
const branchDefinitions: Array<Omit<BranchGroup, 'systems'>> = [
  { key: 'environment', types: ['HVAC'], center: 170 },
  { key: 'lighting', types: ['LIGHTING'], center: 500 },
  { key: 'mobility', types: ['PARKING', 'CHARGING'], center: 830 },
];

const branchGroups = computed<BranchGroup[]>(() => branchDefinitions.map(definition => ({
  ...definition,
  systems: consumerSystems.value.filter(system => definition.types.includes(system.systemType)),
})));

const selectedBranch = computed(() => {
  if (!selectedKey.value.startsWith('branch:')) return undefined;
  return branchGroups.value.find(item => item.key === selectedKey.value.slice('branch:'.length));
});

const sourceCards = computed<SourceCard[]>(() => {
  const gridName = gridRelation.value?.parentPointName || firstConsumptionBinding.value?.sourceName || t('energyTopology.gridEntry');
  const gridCode = gridRelation.value?.parentPointCode || firstConsumptionBinding.value?.sourceCode || '--';
  return [
    { key: 'grid', x: 180, name: t('energyTopology.gridEntry'), code: gridName, metric: gridCode, icon: Connection },
    {
      key: 'solar', x: 500, name: t('energyTopology.solarEntry'),
      code: solarSystem.value?.name || '--', metric: capacityLabel(solarSystem.value), system: solarSystem.value, icon: Sunny,
    },
    {
      key: 'storage', x: 820, name: t('energyTopology.storageEntry'),
      code: storageSystem.value?.name || '--', metric: capacityLabel(storageSystem.value), system: storageSystem.value, icon: Box,
    },
  ];
});

const loadLayouts = computed<LoadLayout[]>(() => branchGroups.value.flatMap(branch => {
  const count = branch.systems.length;
  if (!count) return [];
  const span = count === 1 ? 0 : Math.min(250, 118 * (count - 1));
  return branch.systems.map((system, index) => ({
    branch,
    system,
    x: count === 1 ? branch.center : branch.center - span / 2 + span * index / (count - 1),
  }));
}));

const branchCount = computed(() => branchGroups.value.filter(item => item.systems.length).length);
const selectedSource = computed(() => sourceCards.value.find(item => selectedKey.value === `source:${item.key}`));
const detailTitle = computed(() => {
  if (selectedSystem.value) return selectedSystem.value.name;
  if (selectedBranch.value) return t(`energyTopology.branch.${selectedBranch.value.key}`);
  if (selectedSource.value) return selectedSource.value.name;
  return selectedKey.value === 'hub' ? t('energyTopology.energyHub') : t('energyTopology.overview');
});
const selectedBindings = computed(() => {
  if (selectedSystem.value) return selectedSystem.value.meterBindings;
  if (selectedBranch.value) return selectedBranch.value.systems.flatMap(item => item.meterBindings);
  if (selectedSource.value?.system) return selectedSource.value.system.meterBindings;
  return [];
});
const diagramStyle = computed(() => ({ transform: `scale(${zoom.value})`, transformOrigin: 'top center' }));

function dominantRole(system: EnergyTopologySystem): EnergyRole {
  if (system.meterBindings.some(item => item.energyRole === 'BIDIRECTIONAL')) return 'BIDIRECTIONAL';
  if (system.meterBindings.some(item => item.energyRole === 'GENERATION')) return 'GENERATION';
  return 'CONSUMPTION';
}

function iconFor(type: EnergySystemType) {
  return { HVAC: WindPower, LIGHTING: Sunny, PARKING: Van, CHARGING: Lightning, SOLAR: Sunny, STORAGE: Box }[type];
}

function capacityLabel(system?: EnergyTopologySystem) {
  if (system?.primaryCapacity == null) return t('energyTopology.telemetryNotConnected');
  const unit = system.systemType === 'SOLAR' ? 'kWp' : 'kW';
  return `${Number(system.primaryCapacity).toLocaleString(locale.value)} ${unit}`;
}

function systemDisplayName(system: EnergyTopologySystem) {
  if (system.systemType === 'HVAC') return t('energyTopology.nodeLabel.hvac');
  if (system.systemType === 'PARKING') return t('energyTopology.nodeLabel.parking');
  if (system.systemType === 'CHARGING') return t('energyTopology.nodeLabel.charging');
  if (system.systemType === 'LIGHTING') {
    if (system.name.includes('景观')) return t('energyTopology.nodeLabel.landscapeLighting');
    if (system.name.includes('B 座') || system.name.includes('B座')) return t('energyTopology.nodeLabel.bBuildingLighting');
    if (system.name.includes('A 座') || system.name.includes('A座')) return t('energyTopology.nodeLabel.aBuildingLighting');
  }
  return t(`energyTopology.systemType.${system.systemType}`);
}

function roleTone(role: EnergyRole) {
  return role === 'GENERATION' ? 'warning' : role === 'BIDIRECTIONAL' ? 'success' : 'primary';
}

function formatTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function selectSystem(system: EnergyTopologySystem) {
  selectedKey.value = `system:${system.id}`;
}

function selectSource(source: SourceCard) {
  selectedKey.value = `source:${source.key}`;
}

function selectBranch(branch: BranchGroup) {
  selectedKey.value = `branch:${branch.key}`;
}

function resetFilters() {
  selectedTypes.value = [...systemTypes];
}

function zoomOut() {
  zoom.value = Math.max(.42, Number((zoom.value - .08).toFixed(2)));
}

function zoomIn() {
  zoom.value = Math.min(.95, Number((zoom.value + .08).toFixed(2)));
}

function fitCanvas() {
  zoom.value = recommendedZoom();
}

function recommendedZoom() {
  if (typeof window === 'undefined') return 1;
  const widthScale = window.innerWidth <= 1300 ? .68 : window.innerWidth <= 1500 ? .76 : .9;
  const heightScale = (window.innerHeight - 396) / 650;
  return Number(Math.max(.42, Math.min(.9, widthScale, heightScale)).toFixed(2));
}

function openSystem(system: EnergyTopologySystem) {
  const paths: Record<EnergySystemType, string> = {
    HVAC: '/assets/hvac', LIGHTING: '/assets/lighting', PARKING: '/assets/parking',
    CHARGING: '/assets/charging-piles', SOLAR: '/assets/pv-equipment', STORAGE: '/assets/storage-equipment',
  };
  router.push({ path: paths[system.systemType], query: { systemId: String(system.id) } });
}

function openSelectedSystem() {
  const system = selectedSystem.value || selectedSource.value?.system;
  if (system) openSystem(system);
}

async function load() {
  const current = ++sequence;
  loading.value = true;
  loadError.value = '';
  try {
    const result = await energyTopologyApi.get();
    if (current !== sequence) return;
    data.value = result;
    const selectedStillExists = selectedKey.value === 'overview' || selectedKey.value === 'hub'
      || selectedKey.value.startsWith('source:') || selectedBranch.value || selectedSystem.value;
    if (!selectedStillExists) selectedKey.value = 'overview';
  } catch (error) {
    if (current === sequence) loadError.value = error instanceof ApiError && error.status === 403
      ? t('energyTopology.permissionDenied')
      : error instanceof Error ? error.message : String(error);
  } finally {
    if (current === sequence) loading.value = false;
  }
}

onMounted(() => {
  window.addEventListener('resize', fitCanvas);
  void load();
});
onActivated(load);
onBeforeUnmount(() => window.removeEventListener('resize', fitCanvas));
</script>

<template>
  <section v-loading="loading" class="energy-topology-page">
    <header class="topology-header">
      <div class="topology-header__copy">
        <h1>{{ t('energyTopology.title') }}</h1>
        <p>{{ t('energyTopology.subtitle') }}</p>
      </div>
      <div class="topology-header__actions">
        <DsTag type="warning" dot>{{ t('energyTopology.configurationOnly') }}</DsTag>
        <span v-if="data">{{ t('energyTopology.updatedAt', { time: formatTime(data.generatedAt) }) }}</span>
        <el-button :icon="Refresh" @click="load">{{ t('energyTopology.refresh') }}</el-button>
      </div>
    </header>

    <section v-if="data" class="topology-kpis" aria-label="Energy topology summary">
      <article><span>{{ t('energyTopology.summary.sources') }}</span><strong>3</strong></article>
      <article><span>{{ t('energyTopology.summary.systems') }}</span><strong>{{ data.summary.activeSystemCount }}</strong></article>
      <article><span>{{ t('energyTopology.summary.assets') }}</span><strong>{{ data.summary.assetCount }}</strong></article>
      <article><span>{{ t('energyTopology.summary.bindings') }}</span><strong>{{ data.summary.meterBindingCount }}</strong></article>
      <article><span>{{ t('energyTopology.summary.relations') }}</span><strong>{{ data.summary.meteringRelationCount }}</strong></article>
      <article><span>{{ t('energyTopology.summary.unmetered') }}</span><strong :class="{ 'is-warning': unmeteredCount }">{{ unmeteredCount }}</strong></article>
      <article><span>{{ t('energyTopology.summary.quality') }}</span><strong class="is-text">{{ t('energyTopology.configurationOnly') }}</strong></article>
    </section>

    <div v-if="loadError" class="topology-state">
      <DsEmpty :title="t('energyTopology.loadFailed')" :description="loadError" />
      <el-button type="primary" :icon="Refresh" @click="load">{{ t('energyTopology.retry') }}</el-button>
    </div>

    <div v-else-if="data" class="topology-workspace">
      <aside class="topology-sidebar">
        <section class="hierarchy-panel">
          <h2><el-icon><Connection /></el-icon>{{ t('energyTopology.hierarchy') }}</h2>
          <button type="button" class="tree-root" :class="{ 'is-selected': selectedKey === 'overview' }" @click="selectedKey = 'overview'">
            <el-icon><Odometer /></el-icon><span>{{ t('energyTopology.overview') }}</span><strong>{{ data.summary.activeSystemCount }}</strong>
          </button>

          <div class="tree-section">
            <h3>{{ t('energyTopology.energySources') }}</h3>
            <button v-for="source in sourceCards" :key="source.key" type="button" :class="{ 'is-selected': selectedKey === `source:${source.key}` }" @click="selectSource(source)">
              <el-icon><component :is="source.icon" /></el-icon><span :title="source.name">{{ source.name }}</span><small :title="source.code">{{ source.code }}</small>
            </button>
          </div>

          <div class="tree-section">
            <h3>{{ t('energyTopology.businessLoads') }}</h3>
            <div v-for="branch in branchGroups" :key="branch.key" class="tree-branch">
              <button type="button" class="tree-branch__title" :class="{ 'is-selected': selectedKey === `branch:${branch.key}` }" @click="selectBranch(branch)">
                <span>{{ t(`energyTopology.branch.${branch.key}`) }}</span><strong>{{ branch.systems.length }}</strong>
              </button>
            </div>
          </div>
        </section>

      </aside>

      <main class="topology-canvas">
        <div class="canvas-heading">
          <div><h2>{{ t('energyTopology.canvasTitle') }}</h2><p>{{ t('energyTopology.canvasHint') }}</p></div>
          <DsTag type="neutral">{{ t('energyTopology.telemetryUnavailable') }}</DsTag>
        </div>

        <div class="topology-viewport">
          <div class="topology-diagram" :style="diagramStyle">
            <svg class="topology-links" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                <marker id="arrow-orange" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                <marker id="arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
              </defs>
              <path class="line-grid" d="M180 122 V156 H500 V190" marker-end="url(#arrow-blue)" />
              <path class="line-solar" d="M500 122 V190" marker-end="url(#arrow-orange)" />
              <path class="line-storage" d="M820 122 V156 H500 V190" marker-end="url(#arrow-green)" />
              <path class="line-load" d="M500 292 V320 H170 V350 M500 320 V350 M500 320 H830 V350" marker-end="url(#arrow-blue)" />
              <path
                v-for="layout in loadLayouts"
                :key="`line:${layout.system.id}`"
                :class="layout.system.meterBindings.length ? 'line-load' : 'line-unmetered'"
                :d="`M${layout.branch.center} 440 V474 H${layout.x} V505`"
                :marker-end="layout.system.meterBindings.length ? 'url(#arrow-blue)' : 'url(#arrow-muted)'"
              />
            </svg>

            <button
              v-for="source in sourceCards"
              :key="source.key"
              type="button"
              class="diagram-source"
              :class="[`is-${source.key}`, { 'is-selected': selectedKey === `source:${source.key}` }]"
              :style="{ left: `${source.x / 10}%` }"
              @click="selectSource(source)"
            >
              <span class="node-icon"><el-icon><component :is="source.icon" /></el-icon></span>
              <span class="node-copy"><strong :title="source.name">{{ source.name }}</strong><small :title="source.code">{{ source.code }}</small><b>{{ source.metric }}</b></span>
              <span class="node-status"><i />{{ t('energyTopology.configured') }}</span>
            </button>

            <button type="button" class="diagram-hub" :class="{ 'is-selected': selectedKey === 'hub' }" @click="selectedKey = 'hub'">
              <span class="node-icon"><el-icon><Connection /></el-icon></span>
              <span class="node-copy"><strong>{{ t('energyTopology.energyHub') }}</strong><small>{{ t('energyTopology.energyHubHint') }}</small></span>
              <dl>
                <div><dt>{{ t('energyTopology.summary.systems') }}</dt><dd>{{ visibleSystems.length }}</dd></div>
                <div><dt>{{ t('energyTopology.summary.bindings') }}</dt><dd>{{ data.summary.meterBindingCount }}</dd></div>
                <div><dt>{{ t('energyTopology.summary.relations') }}</dt><dd>{{ data.summary.meteringRelationCount }}</dd></div>
              </dl>
            </button>

            <button
              v-for="branch in branchGroups"
              :key="branch.key"
              type="button"
              class="diagram-branch"
              :class="{ 'is-selected': selectedKey === `branch:${branch.key}`, 'is-empty': !branch.systems.length }"
              :style="{ left: `${branch.center / 10}%` }"
              @click="selectBranch(branch)"
            >
              <strong>{{ t(`energyTopology.branch.${branch.key}`) }}</strong>
              <span>{{ t('energyTopology.branchSummary', { systems: branch.systems.length, bindings: branch.systems.reduce((sum, item) => sum + item.meterBindings.length, 0) }) }}</span>
              <small>{{ t('energyTopology.businessLoadGroup') }}</small>
            </button>

            <button
              v-for="layout in loadLayouts"
              :key="layout.system.id"
              type="button"
              class="diagram-load"
              :class="[{ 'is-selected': selectedKey === `system:${layout.system.id}`, 'is-unmetered': !layout.system.meterBindings.length }, `is-${layout.system.systemType.toLowerCase()}`]"
              :style="{ left: `${layout.x / 10}%` }"
              @click="selectSystem(layout.system)"
            >
              <el-icon><component :is="iconFor(layout.system.systemType)" /></el-icon>
              <strong :title="layout.system.name">{{ systemDisplayName(layout.system) }}</strong>
              <span>{{ layout.system.assetCount }} {{ t('energyTopology.assetUnit') }}</span>
              <small><i />{{ layout.system.meterBindings.length ? t('energyTopology.metered') : t('energyTopology.noBinding') }}</small>
            </button>
          </div>

          <div class="canvas-tools">
            <el-button-group size="small">
              <el-button :icon="Minus" :disabled="zoom <= .42" :aria-label="t('energyTopology.zoomOut')" :title="t('energyTopology.zoomOut')" @click="zoomOut" />
              <el-button disabled>{{ Math.round(zoom * 100) }}%</el-button>
              <el-button :icon="Plus" :disabled="zoom >= .95" :aria-label="t('energyTopology.zoomIn')" :title="t('energyTopology.zoomIn')" @click="zoomIn" />
              <el-button :icon="FullScreen" :aria-label="t('energyTopology.fitCanvas')" :title="t('energyTopology.fitCanvas')" @click="fitCanvas" />
            </el-button-group>
          </div>
        </div>

        <footer class="canvas-footer">
          <div class="canvas-filter">
            <strong>{{ t('energyTopology.systemFilter') }}</strong>
            <el-checkbox-group v-model="selectedTypes">
              <el-checkbox v-for="type in systemTypes" :key="type" :label="type">
                <el-icon><component :is="iconFor(type)" /></el-icon>{{ t(`energyTopology.systemType.${type}`) }}
              </el-checkbox>
            </el-checkbox-group>
            <el-button class="filter-reset" text :icon="Refresh" @click="resetFilters">{{ t('energyTopology.reset') }}</el-button>
          </div>
        </footer>
      </main>

      <aside class="topology-detail">
        <header><h2>{{ t('energyTopology.nodeDetails') }}</h2><DsTag type="success" dot>{{ t('energyTopology.configured') }}</DsTag></header>
        <div class="topology-detail__body">
          <section class="detail-identity">
            <span class="detail-identity__icon"><el-icon><component :is="selectedSystem ? iconFor(selectedSystem.systemType) : selectedSource?.icon || Odometer" /></el-icon></span>
            <div><strong :title="detailTitle">{{ detailTitle }}</strong><small>{{ selectedSystem?.code || selectedSource?.code || t('energyTopology.configurationNode') }}</small></div>
          </section>

          <dl v-if="selectedSystem" class="detail-facts">
          <div><dt>{{ t('energyTopology.type') }}</dt><dd>{{ t(`energyTopology.systemType.${selectedSystem.systemType}`) }}</dd></div>
          <div><dt>{{ t('energyTopology.mode') }}</dt><dd>{{ selectedSystem.profileMode || '--' }}</dd></div>
          <div><dt>{{ t('energyTopology.scope') }}</dt><dd :title="selectedSystem.serviceScopeSummary">{{ selectedSystem.serviceScopeSummary || '--' }}</dd></div>
          <div><dt>{{ t('energyTopology.capacity') }}</dt><dd>{{ capacityLabel(selectedSystem) }}</dd></div>
          <div><dt>{{ t('energyTopology.summary.assets') }}</dt><dd>{{ selectedSystem.assetCount }}</dd></div>
          <div><dt>{{ t('energyTopology.livePower') }}</dt><dd>--</dd></div>
          </dl>

          <dl v-else-if="selectedBranch" class="detail-facts">
          <div><dt>{{ t('energyTopology.nodeKind') }}</dt><dd>{{ t('energyTopology.businessLoadGroup') }}</dd></div>
          <div><dt>{{ t('energyTopology.summary.systems') }}</dt><dd>{{ selectedBranch.systems.length }}</dd></div>
          <div><dt>{{ t('energyTopology.summary.assets') }}</dt><dd>{{ selectedBranch.systems.reduce((sum, item) => sum + item.assetCount, 0) }}</dd></div>
          <div><dt>{{ t('energyTopology.summary.bindings') }}</dt><dd>{{ selectedBindings.length }}</dd></div>
          <div><dt>{{ t('energyTopology.livePower') }}</dt><dd>--</dd></div>
          </dl>

          <dl v-else-if="selectedSource" class="detail-facts">
          <div><dt>{{ t('energyTopology.nodeKind') }}</dt><dd>{{ t('energyTopology.energySource') }}</dd></div>
          <div><dt>{{ t('energyTopology.code') }}</dt><dd>{{ selectedSource.code }}</dd></div>
          <div><dt>{{ t('energyTopology.capacity') }}</dt><dd>{{ selectedSource.metric }}</dd></div>
          <div><dt>{{ t('energyTopology.livePower') }}</dt><dd>--</dd></div>
          <div><dt>{{ t('energyTopology.telemetryStatus') }}</dt><dd>{{ t('energyTopology.telemetryNotConnected') }}</dd></div>
          </dl>

          <dl v-else class="detail-facts">
          <div><dt>{{ t('energyTopology.nodeKind') }}</dt><dd>{{ selectedKey === 'hub' ? t('energyTopology.configurationHub') : t('energyTopology.siteOverview') }}</dd></div>
          <div><dt>{{ t('energyTopology.summary.systems') }}</dt><dd>{{ visibleSystems.length }}</dd></div>
          <div><dt>{{ t('energyTopology.summary.assets') }}</dt><dd>{{ data.summary.assetCount }}</dd></div>
          <div><dt>{{ t('energyTopology.summary.bindings') }}</dt><dd>{{ data.summary.meterBindingCount }}</dd></div>
          <div><dt>{{ t('energyTopology.configuredBranches') }}</dt><dd>{{ branchCount }}</dd></div>
          <div><dt>{{ t('energyTopology.boundSystems') }}</dt><dd>{{ boundSystemCount }}/{{ visibleSystems.length }}</dd></div>
          </dl>

          <section v-if="selectedBranch" class="detail-systems">
          <h3>{{ t('energyTopology.businessSystems') }}</h3>
          <button v-for="system in selectedBranch.systems" :key="system.id" type="button" @click="selectSystem(system)">
            <el-icon><component :is="iconFor(system.systemType)" /></el-icon><span><strong>{{ system.name }}</strong><small>{{ system.assetCount }} {{ t('energyTopology.assetUnit') }}</small></span>
          </button>
          </section>

          <section v-if="selectedBindings.length" class="detail-bindings">
          <h3>{{ t('energyTopology.bindings') }}</h3>
          <article v-for="binding in selectedBindings" :key="binding.id">
            <header><strong>{{ binding.sourceName || binding.sourceCode || `#${binding.sourceId}` }}</strong><DsTag :type="roleTone(binding.energyRole)">{{ t(`energyTopology.energyRole.${binding.energyRole}`) }}</DsTag></header>
            <p>{{ t(`energyTopology.sourceType.${binding.sourceType}`) }} · {{ binding.sourceCode || '--' }}</p>
            <small>{{ t('energyTopology.purpose') }}：{{ binding.purposeCode }}</small>
          </article>
          </section>

          <section v-if="selectedSystem && !selectedSystem.meterBindings.length" class="detail-warning">
            <strong>{{ t('energyTopology.noBinding') }}</strong><p>{{ t('energyTopology.noBindingHint') }}</p>
          </section>

          <el-button v-if="selectedSystem || selectedSource?.system" type="primary" plain :icon="Location" @click="openSelectedSystem">{{ t('energyTopology.openSystem') }}</el-button>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.energy-topology-page {
  --topology-gap: clamp(10px, .8cqw, 14px);
  --topology-radius: 12px;
  width: 100%;
  height: calc(100dvh - 100px);
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  container: energy-topology / inline-size;
  color: var(--el-text-color-primary);
}

.topology-header {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 4px 0 12px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  flex: 0 0 auto;
}
.topology-header__copy { min-width: 0; }
.topology-header h1 { margin: 0; font-size: clamp(20px, 1.45cqw, 22px); line-height: 1.3; }
.topology-header p { margin: 5px 0 0; color: var(--el-text-color-secondary); font-size: 12px; }
.topology-header__actions { display: flex; align-items: center; gap: 10px; }
.topology-header__actions > span { color: var(--el-text-color-secondary); font-size: 11px; white-space: nowrap; }

.topology-kpis {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin-top: var(--topology-gap);
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--topology-radius);
  background: var(--el-bg-color);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--el-color-primary) 3%, transparent);
  flex: 0 0 auto;
}
.topology-kpis article { min-width: 0; padding: 12px 16px; border-right: 1px solid var(--el-border-color-extra-light); }
.topology-kpis article:last-child { border-right: 0; }
.topology-kpis span { display: block; overflow: hidden; color: var(--el-text-color-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.topology-kpis strong { display: block; margin-top: 4px; font-size: 21px; line-height: 1.2; white-space: nowrap; }
.topology-kpis strong.is-warning { color: var(--el-color-warning); }
.topology-kpis strong.is-text { overflow: hidden; color: var(--el-color-warning); font-size: 14px; line-height: 25px; text-overflow: ellipsis; }

.topology-workspace {
  display: grid;
  min-width: 0;
  grid-template-columns: clamp(190px, 14.5cqw, 232px) minmax(560px, 1fr) clamp(248px, 18.5cqw, 300px);
  gap: var(--topology-gap);
  height: auto;
  max-height: 780px;
  flex: 1 1 auto;
  margin-top: var(--topology-gap);
  align-items: stretch;
  overflow: hidden;
}
.topology-sidebar,
.topology-canvas,
.topology-detail {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--topology-radius);
  background: var(--el-bg-color);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--el-color-primary) 3%, transparent);
}

.topology-sidebar { display: flex; height: 100%; flex-direction: column; }
.topology-sidebar > section { padding: 12px; border-bottom: 1px solid var(--el-border-color-extra-light); }
.topology-sidebar > section:last-child { border-bottom: 0; }
.hierarchy-panel {
  min-height: 0;
  flex: 1 1 auto;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: color-mix(in srgb, var(--el-color-primary) 58%, transparent) transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}
.topology-sidebar h2,
.topology-detail h2 { display: flex; margin: 0; align-items: center; gap: 7px; font-size: 14px; }
.topology-sidebar button { width: 100%; min-width: 0; border: 0; color: var(--el-text-color-primary); background: transparent; cursor: pointer; }
.tree-root,
.tree-section > button {
  display: grid;
  min-height: 38px;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 7px !important;
  font-size: 12px;
  text-align: left;
}
.tree-root { margin-top: 10px; }
.tree-root span,
.tree-section button span,
.tree-section button small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-root:hover,
.tree-root.is-selected,
.tree-section button:hover,
.tree-section button.is-selected { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.tree-section { position: relative; margin-top: 12px; padding: 0; border: 0; }
.tree-section h3 { margin: 0 0 5px; color: var(--el-text-color-secondary); font-size: 10px; font-weight: 500; letter-spacing: .06em; }
.tree-section > button small { display: none; }
.tree-branch { position: relative; padding: 0; }
.tree-branch::before { display: none; }
.tree-branch__title { display: grid; min-height: 32px; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; padding: 5px 7px; border-radius: 7px !important; text-align: left; }
.tree-branch__title span { padding-left: 20px; font-size: 11px; text-decoration: none; }
.tree-branch__title span::before { position: absolute; left: 8px; color: var(--el-color-primary); content: '›'; }
.tree-branch__title strong { color: var(--el-color-primary); font-size: 11px; }
.topology-canvas { display: flex; height: 100%; min-height: 0; flex-direction: column; }
.canvas-heading { display: flex; min-height: 58px; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--el-border-color-extra-light); }
.canvas-heading h2 { margin: 0; font-size: 14px; }
.canvas-heading p { margin: 3px 0 0; color: var(--el-text-color-secondary); font-size: 10px; }
.canvas-heading :deep(.ds-tag) { max-width: 46%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.topology-viewport { position: relative; min-width: 0; min-height: 0; flex: 1 1 auto; overflow: hidden; background: color-mix(in srgb, var(--el-bg-color-page) 55%, var(--el-bg-color)); }
.topology-diagram { position: absolute; top: 0; left: 0; width: 100%; min-width: 540px; height: 650px; transition: transform .18s ease; }
.topology-links { position: absolute; inset: 0; z-index: 0; width: 100%; height: 650px; overflow: visible; }
.topology-links path { fill: none; stroke-width: 2; vector-effect: non-scaling-stroke; }
.topology-links marker path { fill: context-stroke; stroke: none; }
.line-grid { stroke: #3478f6; stroke-dasharray: 6 5; }
.line-solar { stroke: #f5a623; stroke-dasharray: 6 5; }
.line-storage { stroke: #19a868; stroke-dasharray: 6 5; }
.line-load { stroke: #3478f6; }
.line-unmetered { stroke: var(--el-text-color-placeholder); stroke-dasharray: 5 5; }

.diagram-source,
.diagram-hub,
.diagram-branch,
.diagram-load {
  position: absolute;
  z-index: 1;
  min-width: 0;
  border: 1px solid var(--el-border-color-light);
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--el-color-primary) 5%, transparent);
  cursor: pointer;
  transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
}
.diagram-source:hover,
.diagram-hub:hover,
.diagram-branch:hover,
.diagram-load:hover { border-color: var(--el-color-primary-light-3); }
.diagram-source.is-selected,
.diagram-hub.is-selected,
.diagram-branch.is-selected,
.diagram-load.is-selected { border-color: var(--el-color-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-primary) 18%, transparent), 0 8px 20px color-mix(in srgb, var(--el-color-primary) 8%, transparent); }
.diagram-source,
.diagram-branch,
.diagram-load { transform: translateX(-50%); }
.diagram-source.is-selected,
.diagram-branch.is-selected,
.diagram-load.is-selected { transform: translateX(-50%) translateY(-1px); }

.diagram-source { top: 24px; display: grid; width: 24%; max-width: 220px; height: 98px; grid-template-columns: 44px minmax(0, 1fr); align-items: center; gap: 10px; padding: 13px 14px; border-radius: 10px; text-align: left; }
.diagram-source.is-grid { border-color: color-mix(in srgb, #3478f6 55%, var(--el-border-color-light)); background: linear-gradient(135deg, color-mix(in srgb, #3478f6 9%, var(--el-bg-color)) 0%, var(--el-bg-color) 62%); }
.diagram-source.is-solar { border-color: color-mix(in srgb, #f5a623 58%, var(--el-border-color-light)); background: linear-gradient(135deg, color-mix(in srgb, #f5a623 10%, var(--el-bg-color)) 0%, var(--el-bg-color) 62%); }
.diagram-source.is-storage { border-color: color-mix(in srgb, #19a868 58%, var(--el-border-color-light)); background: linear-gradient(135deg, color-mix(in srgb, #19a868 10%, var(--el-bg-color)) 0%, var(--el-bg-color) 62%); }
.node-icon { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 9px; color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.node-icon .el-icon { font-size: 24px; }
.is-solar .node-icon { color: #d98908; background: color-mix(in srgb, #f5a623 15%, var(--el-bg-color)); }
.is-storage .node-icon { color: #16985f; background: color-mix(in srgb, #19a868 14%, var(--el-bg-color)); }
.node-copy { display: grid; min-width: 0; gap: 2px; }
.node-copy strong,
.node-copy small,
.node-copy b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-copy strong { font-size: 12px; }
.node-copy small { color: var(--el-text-color-secondary); font-size: 9px; }
.node-copy b { margin-top: 2px; font-size: 11px; }
.node-status { position: absolute; right: 10px; bottom: 7px; display: flex; align-items: center; gap: 4px; color: var(--el-color-success); font-size: 9px; }
.node-status i,
.diagram-load small i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

.diagram-hub { top: 190px; left: 18%; display: grid; width: 64%; height: 102px; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 14px 18px; border-color: color-mix(in srgb, #3478f6 62%, var(--el-border-color-light)); border-radius: 10px; text-align: left; background: linear-gradient(135deg, color-mix(in srgb, #3478f6 8%, var(--el-bg-color)) 0%, var(--el-bg-color) 60%); }
.diagram-hub dl { display: grid; min-width: 230px; margin: 0; grid-template-columns: repeat(3, minmax(62px, 1fr)); }
.diagram-hub dl div { padding: 0 14px; border-left: 1px solid var(--el-border-color-extra-light); }
.diagram-hub dt { color: var(--el-text-color-secondary); font-size: 9px; }
.diagram-hub dd { margin: 4px 0 0; color: var(--el-color-primary); font-size: 17px; font-weight: 700; }

.diagram-branch { top: 350px; display: grid; width: 25%; max-width: 220px; height: 90px; align-content: center; gap: 4px; padding: 10px 12px; border-color: color-mix(in srgb, #3478f6 42%, var(--el-border-color-light)); border-radius: 9px; text-align: center; }
.diagram-branch strong { overflow: hidden; color: var(--el-color-primary); font-size: 12px; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
.diagram-branch span { color: var(--el-text-color-primary); font-size: 9px; }
.diagram-branch small { color: var(--el-text-color-secondary); font-size: 9px; }
.diagram-branch.is-empty { opacity: .45; }

.diagram-load { top: 505px; display: grid; width: 11%; max-width: 124px; height: 118px; justify-items: center; align-content: center; gap: 5px; padding: 10px 6px; border-radius: 9px; text-align: center; }
.diagram-load > .el-icon { color: var(--el-color-primary); font-size: 22px; }
.diagram-load strong { width: 100%; overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.diagram-load span { color: var(--el-text-color-secondary); font-size: 9px; }
.diagram-load small { display: flex; align-items: center; gap: 4px; color: var(--el-color-success); font-size: 9px; }
.diagram-load.is-unmetered { border-style: dashed; }
.diagram-load.is-unmetered small { color: var(--el-text-color-placeholder); }
.diagram-load.is-lighting > .el-icon { color: #d89b08; }
.diagram-load.is-parking > .el-icon,
.diagram-load.is-charging > .el-icon { color: #7357d9; }

.canvas-footer { display: flex; min-height: 46px; align-items: center; padding: 6px 12px; overflow: hidden; border-top: 1px solid var(--el-border-color-extra-light); }
.canvas-filter { display: flex; width: 100%; min-width: 0; align-items: center; gap: 14px; }
.canvas-filter > strong { flex: 0 0 auto; font-size: 11px; white-space: nowrap; }
.canvas-filter :deep(.el-checkbox-group) { display: flex; min-width: 0; flex: 1 1 auto; align-items: center; justify-content: flex-start; gap: 14px; overflow: hidden; }
.canvas-filter :deep(.el-checkbox) { min-width: 0; height: 28px; flex: 0 0 auto; margin: 0; }
.canvas-filter :deep(.el-checkbox__label) { display: flex; min-width: 0; align-items: center; gap: 4px; padding-left: 5px; font-size: 10px; white-space: nowrap; }
.canvas-filter :deep(.filter-reset) { height: 28px; flex: 0 0 auto; padding-inline: 7px; margin-left: auto; }
.canvas-tools { position: absolute; right: 12px; bottom: 12px; z-index: 4; overflow: hidden; border: 1px solid var(--el-border-color-light); border-radius: 7px; box-shadow: 0 4px 14px color-mix(in srgb, var(--el-color-primary) 8%, transparent); }
.canvas-tools :deep(.el-button) { width: 28px; height: 28px; padding: 0; }
.canvas-tools :deep(.el-button:nth-child(2)) { width: 42px; }
.canvas-tools :deep(.el-button.is-disabled:nth-child(2)) { color: var(--el-text-color-primary); background: var(--el-bg-color); }

.topology-detail { display: flex; height: 100%; min-height: 0; flex-direction: column; overflow: hidden; }
.topology-detail > header { display: flex; min-height: 48px; align-items: center; justify-content: space-between; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--el-border-color-extra-light); }
.topology-detail__body {
  min-height: 0;
  flex: 1 1 auto;
  margin-right: 18px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: color-mix(in srgb, var(--el-color-primary) 58%, transparent) transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}
.hierarchy-panel::-webkit-scrollbar,
.topology-detail__body::-webkit-scrollbar { width: 6px; }
.hierarchy-panel::-webkit-scrollbar-track,
.topology-detail__body::-webkit-scrollbar-track { background: transparent; }
.hierarchy-panel::-webkit-scrollbar-thumb,
.topology-detail__body::-webkit-scrollbar-thumb { border-radius: 999px; background: color-mix(in srgb, var(--el-color-primary) 58%, transparent); }
.detail-identity { display: grid; grid-template-columns: 42px minmax(0, 1fr); align-items: center; gap: 10px; padding: 16px 14px; }
.detail-identity__icon { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 9px; color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.detail-identity__icon .el-icon { font-size: 22px; }
.detail-identity > div { display: grid; min-width: 0; gap: 3px; }
.detail-identity strong,
.detail-identity small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-identity strong { font-size: 13px; }
.detail-identity small { color: var(--el-text-color-secondary); font-size: 10px; }
.detail-facts { display: grid; margin: 0; padding: 0 14px 14px; gap: 10px; }
.detail-facts > div { display: grid; min-width: 0; grid-template-columns: 84px minmax(0, 1fr); gap: 8px; }
.detail-facts dt { color: var(--el-text-color-secondary); font-size: 10px; }
.detail-facts dd { min-width: 0; margin: 0; overflow: hidden; font-size: 11px; font-weight: 600; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.detail-systems,
.detail-bindings,
.detail-warning { padding: 13px 14px; border-top: 1px solid var(--el-border-color-extra-light); }
.detail-systems h3,
.detail-bindings h3 { margin: 0 0 9px; font-size: 12px; }
.detail-systems button { display: grid; width: 100%; min-width: 0; min-height: 38px; grid-template-columns: 22px minmax(0, 1fr); align-items: center; gap: 7px; padding: 5px 7px; border: 0; border-radius: 7px; color: var(--el-text-color-primary); text-align: left; background: transparent; cursor: pointer; }
.detail-systems button:hover { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.detail-systems button span { display: grid; min-width: 0; gap: 2px; }
.detail-systems button strong,
.detail-systems button small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-systems button strong { font-size: 10px; }
.detail-systems button small { color: var(--el-text-color-secondary); font-size: 9px; }
.detail-bindings { overflow: visible; }
.detail-bindings article { padding: 9px; margin-bottom: 7px; border: 1px solid var(--el-border-color-extra-light); border-radius: 8px; background: var(--el-bg-color-page); }
.detail-bindings article:last-child { margin-bottom: 0; }
.detail-bindings article header { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.detail-bindings article strong { min-width: 0; overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.detail-bindings article p,
.detail-bindings article small { display: block; margin: 4px 0 0; color: var(--el-text-color-secondary); font-size: 9px; }
.detail-warning { color: var(--el-color-warning-dark-2); background: var(--el-color-warning-light-9); }
.detail-warning strong { font-size: 11px; }
.detail-warning p { margin: 5px 0 0; font-size: 9px; line-height: 1.5; }
.topology-detail__body > :deep(.el-button) { width: calc(100% - 28px); margin: 14px; }
.topology-state { display: grid; min-height: 430px; place-items: center; align-content: center; gap: 12px; }

@container energy-topology (max-width: 1320px) {
  .topology-workspace { grid-template-columns: 190px minmax(540px, 1fr) 248px; }
  .topology-kpis article { padding-inline: 10px; }
  .topology-kpis strong { font-size: 18px; }
  .diagram-source { width: 25%; padding-inline: 10px; }
  .diagram-source .node-icon { width: 38px; height: 38px; }
  .diagram-hub { left: 14%; width: 72%; padding-inline: 13px; }
  .diagram-hub dl { min-width: 200px; }
  .diagram-hub dl div { padding-inline: 9px; }
  .diagram-load { width: 11%; }
  .canvas-filter { gap: 9px; }
  .canvas-filter :deep(.el-checkbox-group) { gap: 9px; }
  .canvas-filter :deep(.el-checkbox__label) { gap: 3px; padding-left: 4px; font-size: 9px; }
}

@container energy-topology (max-width: 1050px) {
  .topology-workspace { grid-template-columns: 170px minmax(460px, 1fr) 220px; }
  .topology-sidebar > section { padding: 8px; }
  .topology-detail > header,
  .detail-identity { padding-inline: 10px; }
  .detail-facts { padding-inline: 10px; }
  .topology-sidebar h2 { overflow: hidden; font-size: 12px; line-height: 17px; text-overflow: ellipsis; white-space: nowrap; }
  .tree-root { margin-top: 6px; }
  .tree-root,
  .tree-section > button { min-height: 26px; padding-block: 2px; }
  .tree-section { margin-top: 5px; }
  .tree-section h3 { margin-bottom: 3px; font-size: 9px; }
  .tree-branch__title { min-height: 24px; padding-block: 2px; }
  .canvas-footer { padding-inline: 8px; }
  .canvas-filter { gap: 7px; }
  .canvas-filter > strong { font-size: 10px; }
  .canvas-filter :deep(.el-checkbox-group) { gap: 7px; }
  .canvas-filter :deep(.el-checkbox__label) { gap: 2px; padding-left: 3px; font-size: 8px; }
  .canvas-filter :deep(.el-checkbox__inner) { width: 12px; height: 12px; }
  .canvas-filter :deep(.filter-reset > span) { display: none; }
  .canvas-heading p { display: none; }
}

@container energy-topology (max-width: 760px) {
  .topology-header { align-items: flex-start; flex-direction: column; }
  .topology-header__actions { flex-wrap: wrap; }
  .topology-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .topology-kpis article { border-bottom: 1px solid var(--el-border-color-extra-light); }
  .topology-workspace { grid-template-columns: 142px minmax(360px, 1fr) 184px; }
  .topology-sidebar h2,
  .topology-detail h2 { font-size: 12px; }
  .canvas-filter > strong { display: none; }
  .canvas-heading p { display: none; }
}
</style>
