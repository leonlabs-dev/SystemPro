<script setup lang="ts">
import {
  Delete,
  EditPen,
  OfficeBuilding,
  Plus,
  Search,
} from '@element-plus/icons-vue';
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useActiveLocaleDataRefresh } from '@/core/i18n/use-active-locale-data-refresh';
import { createBusinessCode } from '@/core/code/business-code';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useTreeExpansionState } from '@/design-system/composables/useTreeExpansionState';
import { useOrgStore } from '@/core/org/org.store';
import {
  filterOrganizations,
  flattenOrganizations,
  organizationStatusLabels,
  organizationTypeLabels,
  positionStatusLabels,
  type OrganizationNode,
  type Position,
  type PositionDraft,
} from '@/domain/platform/org';
import type { AccountDirectoryRecord } from '@/domain/platform/user-permission';
import { fetchAccountDirectory } from '@/domain/platform/user-permission/api/account.api';
import { fetchAllPages } from '@/core/api/pagination';
import {
  createPosition as createPositionApi,
  deletePosition as deletePositionApi,
  fetchPositions,
  updatePosition as updatePositionApi,
} from '@/domain/platform/org/api/position.api';

interface OrgTreeInstance {
  setCurrentKey(key: string): void;
  store?: { nodesMap: Record<string, { expanded: boolean }> };
}

const orgStore = useOrgStore();
const { t } = useI18n();
const treeRef = ref<OrgTreeInstance>();
const { expandedKeys, onNodeExpand, onNodeCollapse, ensureExpanded } = useTreeExpansionState();
const keyword = ref('');
const positions = ref<Position[]>([]);
const accounts = ref<AccountDirectoryRecord[]>([]);
const activeOrgId = ref(orgStore.tree[0]?.id || '');
const dialogVisible = ref(false);
const savingPosition = ref(false);
const editingPositionId = ref('');
const loading = ref(true);

const filteredTree = computed(() => filterOrganizations(orgStore.tree, keyword.value));
const activeOrg = computed(() => orgStore.findNode(activeOrgId.value) || orgStore.leafNodes[0] || null);
const activeOrgIds = computed(() => {
  if (!activeOrg.value) return [];
  return [activeOrg.value.id, ...flattenOrganizations(activeOrg.value.children || []).map((item) => item.id)];
});
const activePositions = computed(() => {
  const ids = new Set(activeOrgIds.value);
  return positions.value.filter((position) => ids.has(position.orgNodeId));
});
const activeLeafNodes = computed(() => {
  if (!activeOrg.value) return [];
  const nodes = [activeOrg.value, ...flattenOrganizations(activeOrg.value.children || [])];
  return nodes.filter((node) => !node.children?.length);
});
const isOrgDisabled = computed(() => activeOrg.value?.status === 'disabled');
const orgBreadcrumb = computed(() => {
  const names: string[] = [];
  let current: OrganizationNode | null = activeOrg.value;
  while (current) {
    names.unshift(current.name);
    current = current.parentId ? orgStore.findNode(current.parentId) : null;
  }
  return names.join(' / ') || t('deptPage.breadcrumbFallback');
});
const emptyDraft = (): PositionDraft => ({
  name: '',
  code: '',
  orgNodeId: '',
  description: '',
  headcount: 1,
  status: 'enabled',
  level: 'P1',
  relatedPermissions: [],
});

const form = reactive<PositionDraft>(emptyDraft());
const dialogTitle = computed(() => (editingPositionId.value ? t('deptPage.dialogTitle.edit') : t('deptPage.dialogTitle.create')));

function countAccounts(org: OrganizationNode): number {
  const ids = new Set([org.id, ...flattenOrganizations(org.children || []).map((item) => item.id)]);
  return accounts.value.filter((account) => ids.has(account.orgNodeId)).length;
}

function orgTypeTagType(type: OrganizationNode['type']): 'primary' | 'info' | 'warning' | 'neutral' {
  if (type === 'group') return 'primary';
  if (type === 'business') return 'warning';
  if (type === 'department') return 'neutral';
  return 'info';
}

function selectOrg(org: OrganizationNode) {
  activeOrgId.value = org.id;
  nextTick(() => treeRef.value?.setCurrentKey(org.id));
}

function defaultCreateOrgId(): string {
  if (activeOrg.value && !activeOrg.value.children?.length && activeOrg.value.status === 'enabled') {
    return activeOrg.value.id;
  }
  return activeLeafNodes.value.find((node) => node.status === 'enabled')?.id || orgStore.leafNodes.find((node) => node.status === 'enabled')?.id || '';
}

function openCreateDialog() {
  const orgNodeId = defaultCreateOrgId();
  if (!orgNodeId) {
    ElMessage.warning(t('deptPage.messages.needOrgFirst'));
    return;
  }
  editingPositionId.value = '';
  Object.assign(form, {
    ...emptyDraft(),
    orgNodeId,
    code: createBusinessCode('POS'),
  });
  dialogVisible.value = true;
}

function openEditDialog(position: Position) {
  editingPositionId.value = position.id;
  Object.assign(form, {
    name: position.name,
    code: position.code,
    orgNodeId: position.orgNodeId,
    description: position.description,
    headcount: position.headcount,
    status: position.status,
    level: position.level,
    relatedPermissions: [...position.relatedPermissions],
  });
  dialogVisible.value = true;
}

async function savePosition() {
  if (!form.name.trim() || !form.code.trim() || !form.orgNodeId) {
    ElMessage.warning(t('deptPage.messages.fillRequired'));
    return;
  }

  savingPosition.value = true;
  try {
    const draft = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim(),
    };
    if (editingPositionId.value) {
      const saved = await updatePositionApi(editingPositionId.value, draft);
      positions.value = positions.value.map((position) => (position.id === saved.id ? saved : position));
      ElMessage.success(t('deptPage.messages.positionUpdated'));
    } else {
      const saved = await createPositionApi(draft);
      positions.value = [saved, ...positions.value];
      ElMessage.success(t('deptPage.messages.positionCreated'));
    }
    dialogVisible.value = false;
  } finally {
    savingPosition.value = false;
  }
}

async function deleteCurrentPosition(position: Position) {
  if (accounts.value.some((account) => account.positionId === position.id)) {
    ElMessage.warning(t('deptPage.messages.positionReferenced'));
    return;
  }
  await ElMessageBox.confirm(t('deptPage.messages.confirmDelete', { name: position.name }), t('deptPage.messages.deleteTitle'), {
    type: 'warning',
    confirmButtonText: t('deptPage.delete'),
    cancelButtonText: t('deptPage.cancel'),
  });
  await deletePositionApi(position.id);
  positions.value = positions.value.filter((item) => item.id !== position.id);
  ElMessage.success(t('deptPage.messages.positionDeleted'));
}

async function loadPageData() {
  const previousOrgId = activeOrgId.value;
  await orgStore.load();
  const [positionRows, accountRows] = await Promise.all([
    fetchPositions(),
    fetchAllPages((page, pageSize) => fetchAccountDirectory({ page, pageSize })),
  ]);
  positions.value = positionRows;
  accounts.value = accountRows;
  activeOrgId.value = previousOrgId && orgStore.byId.has(previousOrgId)
    ? previousOrgId
    : orgStore.tree[0]?.id || '';
  ensureExpanded(activeOrgId.value);
}

useActiveLocaleDataRefresh(loadPageData);
onMounted(async () => {
  try { await loadPageData(); } finally { loading.value = false; }
});
</script>

<template>
  <DsListPageShell :title="t('deptPage.title')" :loading="loading" page-class="department-position-page">
    <template #header-extra>
      <span class="dp-page-subtitle">{{ t('deptPage.subtitle') }}</span>
    </template>
    <template #primary-action>
      <el-button v-permission.preview="'platform:department:position:create'" class="ds-list-page__primary-action" type="primary" :icon="Plus" @click="openCreateDialog">{{ t('deptPage.addPosition') }}</el-button>
    </template>

    <section class="dp-workspace-shell">
      <div class="dp-workspace">
        <aside class="dp-directory">
          <header class="dp-directory__header">
            <strong>{{ t('deptPage.orgDirectory') }}</strong>
            <DsTag size="small" type="neutral">{{ t('deptPage.nodeCount', { count: orgStore.flatList.length }) }}</DsTag>
          </header>

          <el-input
            v-model="keyword"
            class="dp-directory__search"
            clearable
            :placeholder="t('deptPage.searchOrg')"
            :prefix-icon="Search"
          />

          <el-tree
            v-if="filteredTree.length"
            ref="treeRef"
            class="dp-tree"
            node-key="id"
            :data="filteredTree"
            :props="{ label: 'name', children: 'children' }"
            :default-expanded-keys="expandedKeys"
            :expand-on-click-node="false"
            highlight-current
            @node-click="selectOrg"
            @node-expand="onNodeExpand"
            @node-collapse="onNodeCollapse"
          >
            <template #default="{ data }">
              <span class="dp-tree-node">
                <span class="dp-tree-node__main">
                  <el-icon v-if="!data.parentId || data.children?.length" class="dp-tree-node__icon"><OfficeBuilding /></el-icon>
                  <span class="dp-tree-node__name" :title="data.name">{{ data.name }}</span>
                </span>
                <span class="dp-tree-node__meta">
                  <span>{{ countAccounts(data) }}</span>
                  <DsTag v-if="data.status === 'disabled'" size="small" type="neutral">{{ t('deptPage.disabled') }}</DsTag>
                </span>
              </span>
            </template>
          </el-tree>
          <DsEmpty v-else :description="t('deptPage.noMatchingOrg')" :action-label="t('deptPage.clearSearch')" @retry="keyword = ''" />

        </aside>

        <section v-if="activeOrg" class="dp-detail">
          <div class="dp-position-panel">
            <div class="dp-toolbar">
              <span>{{ t('deptPage.currentDept') }}<strong>{{ orgBreadcrumb }}</strong></span>
            <el-button v-permission.preview="'platform:department:position:create'" size="small" :icon="Plus" :disabled="isOrgDisabled" @click="openCreateDialog">{{ t('deptPage.addPosition') }}</el-button>
            </div>

            <div class="dp-position-list">
              <div v-if="activePositions.length" class="dp-position-head">
                <span>{{ t('deptPage.positionTable.position') }}</span>
                <span>{{ t('deptPage.positionTable.code') }}</span>
                <span>{{ t('deptPage.positionTable.headcount') }}</span>
                <span>{{ t('deptPage.positionTable.currentCount') }}</span>
                <span>{{ t('deptPage.positionTable.status') }}</span>
                <span>{{ t('deptPage.positionTable.actions') }}</span>
              </div>
              <div v-for="position in activePositions" :key="position.id" class="dp-position-row">
                <div class="dp-position-row__main">
                  <strong :title="position.name">{{ position.name }}</strong>
                  <span :title="`${orgStore.byId.get(position.orgNodeId)?.name || t('deptPage.unknownDept')} · ${position.description}`">
                    {{ orgStore.byId.get(position.orgNodeId)?.name || t('deptPage.unknownDept') }} · {{ position.description }}
                  </span>
                </div>
                <span class="dp-position-row__code" :title="position.code">{{ position.code }}</span>
                <span class="dp-position-row__metric">{{ position.headcount ?? 0 }}</span>
                <span class="dp-position-row__metric">{{ position.currentCount }}</span>
                <DsTag size="small" :type="position.status === 'enabled' ? 'success' : 'neutral'">{{ positionStatusLabels[position.status] }}</DsTag>
                <div class="dp-position-row__actions">
                  <el-button v-permission.preview="'platform:department:position:update'" text size="small" :icon="EditPen" @click="openEditDialog(position)">{{ t('deptPage.edit') }}</el-button>
                  <el-button v-permission="'platform:department:position:delete'" text size="small" type="danger" :icon="Delete" @click="deleteCurrentPosition(position)">{{ t('deptPage.delete') }}</el-button>
                </div>
              </div>
              <DsEmpty v-if="!activePositions.length" class="dp-empty-state" :description="t('deptPage.noPositionInScope')" :action-label="t('deptPage.addPosition')" @retry="openCreateDialog" />
            </div>
          </div>
        </section>

        <section v-else class="dp-detail dp-detail--empty">
          <DsEmpty :description="t('deptPage.selectOrgFromLeft')" />
        </section>
      </div>
    </section>

    <template #overlays>
      <el-dialog v-model="dialogVisible" class="dp-dialog" :title="dialogTitle" width="600px" destroy-on-close>
        <div class="dp-dialog-form">
          <label class="dp-field">
            <span>{{ t('deptPage.formFields.name') }}</span>
            <el-input v-model="form.name" :placeholder="t('deptPage.formFields.namePlaceholder')" />
          </label>
          <label class="dp-field">
            <span>{{ t('deptPage.formFields.code') }}</span>
            <el-input v-model="form.code" disabled />
          </label>
          <label class="dp-field">
            <span>{{ t('deptPage.formFields.orgDept') }}</span>
            <el-select v-model="form.orgNodeId" filterable>
              <el-option
                v-for="org in orgStore.leafNodes"
                :key="org.id"
                :label="org.name"
                :value="org.id"
                :disabled="org.status === 'disabled'"
              >
                <span>{{ org.name }}</span>
                <DsTag v-if="org.status === 'disabled'" size="small" type="neutral" style="margin-left:8px">{{ t('deptPage.formFields.disabled') }}</DsTag>
              </el-option>
            </el-select>
          </label>
          <label class="dp-field">
            <span>{{ t('deptPage.formFields.level') }}</span>
            <el-select v-model="form.level">
              <el-option label="M3" value="M3" />
              <el-option label="P3" value="P3" />
              <el-option label="P2" value="P2" />
              <el-option label="P1" value="P1" />
            </el-select>
          </label>
          <label class="dp-field">
            <span>{{ t('deptPage.formFields.headcount') }}</span>
            <el-input-number v-model="form.headcount" :min="0" :max="999" controls-position="right" />
          </label>
          <label class="dp-field">
            <span>{{ t('deptPage.formFields.status') }}</span>
            <el-select v-model="form.status">
              <el-option :label="t('deptPage.formFields.enabled')" value="enabled" />
              <el-option :label="t('deptPage.formFields.disabled')" value="disabled" />
            </el-select>
          </label>
          <label class="dp-field is-wide">
            <span>{{ t('deptPage.formFields.description') }}</span>
            <el-input v-model="form.description" type="textarea" :rows="3" maxlength="200" show-word-limit :placeholder="t('deptPage.formFields.descriptionPlaceholder')" />
          </label>
        </div>
        <template #footer>
          <div class="dp-dialog__footer">
            <el-button @click="dialogVisible = false">{{ t('deptPage.cancel') }}</el-button>
            <el-button v-permission="editingPositionId ? 'platform:department:position:update' : 'platform:department:position:create'" type="primary" :loading="savingPosition" @click="savePosition">{{ t('deptPage.save') }}</el-button>
          </div>
        </template>
      </el-dialog>
    </template>
  </DsListPageShell>
</template>

<style scoped>
.dp-page-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.dp-workspace-shell {
  display: grid;
  height: var(--ds-list-workspace-h);
  margin: var(--ds-page-filter-py-top) var(--ds-page-inset) var(--space-6);
  overflow: hidden;
}

.dp-workspace {
  display: grid;
  min-height: 0;
  grid-template-columns: var(--ds-master-pane-width) minmax(0, 1fr);
  border-top: 1px solid var(--ds-list-divider);
}

.dp-directory {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto auto minmax(0, 1fr);
  padding: var(--space-4) var(--space-5) var(--space-4) 0;
  border-right: 1px solid var(--ds-list-divider);
}

.dp-directory__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.dp-directory__header strong {
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
}

.dp-directory__search {
  margin-bottom: var(--space-3);
}

.dp-tree {
  min-height: 0;
  overflow: auto;
  background: transparent;
}

.dp-tree :deep(.el-tree-node__content) {
  height: 36px;
  margin: 2px 0;
  border-radius: var(--radius-md);
}

.dp-tree :deep(.el-tree-node__content:hover),
.dp-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: color-mix(in srgb, var(--color-primary-500) 9%, transparent);
}

.dp-tree-node {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  padding-right: var(--space-2);
  font-size: 13px;
}

.dp-tree-node__main,
.dp-tree-node__meta {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-2);
}

.dp-tree-node__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dp-tree-node__icon {
  color: var(--color-text-secondary);
}

.dp-tree-node__meta {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.dp-detail {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto;
  padding: var(--space-4) 0 var(--space-4) var(--space-5);
}

.dp-detail--empty {
  place-items: center;
}

.dp-position-panel {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-4);
  padding: 0 0 var(--space-6);
}

.dp-toolbar {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.dp-toolbar strong {
  color: var(--color-text-primary);
}

.dp-position-list {
  display: grid;
  min-height: 0;
  align-content: start;
  overflow: auto;
  border-top: 1px solid var(--ds-list-divider);
}

.dp-position-head,
.dp-position-row {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 168px 72px 72px 72px 132px;
  align-items: center;
  column-gap: var(--space-5);
}

.dp-position-head {
  min-height: 40px;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.dp-position-head span:nth-child(n + 3),
.dp-position-row__metric {
  text-align: right;
}

.dp-position-head span:last-child {
  text-align: right;
}

.dp-position-row {
  min-height: 72px;
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--ds-list-divider);
}

.dp-position-row__main {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.dp-position-row__main strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dp-position-row__main span,
.dp-position-row__code {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dp-position-row__metric {
  color: var(--color-text-primary);
  font-size: var(--font-caption);
  white-space: nowrap;
}

.dp-position-row__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  justify-content: flex-end;
  justify-self: end;
}

.dp-position-row > .ds-tag {
  justify-self: start;
}

.dp-empty-state {
  min-height: 320px;
  place-self: stretch;
}

.dp-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.dp-dialog-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3) var(--space-4);
}

.dp-field {
  display: grid;
  min-width: 0;
  gap: var(--space-1);
}

.dp-field.is-wide {
  grid-column: 1 / -1;
}

.dp-field span {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.dp-field :deep(.el-select),
.dp-field :deep(.el-input-number) {
  width: 100%;
}

@media (max-width: 1180px) {
  .dp-workspace {
    grid-template-columns: var(--ds-master-pane-width-compact) minmax(0, 1fr);
  }

  .dp-position-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .dp-position-head {
    display: none;
  }
}

@media (max-width: 820px) {
  .dp-workspace-shell {
    height: auto;
    min-height: var(--ds-list-workspace-h);
  }

  .dp-workspace,
  .dp-dialog-form {
    grid-template-columns: 1fr;
  }

  .dp-directory {
    border-right: 0;
    border-bottom: 1px solid var(--ds-list-divider);
  }
}
</style>
