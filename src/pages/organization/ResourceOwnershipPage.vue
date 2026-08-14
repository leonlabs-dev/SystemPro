<script setup lang="ts">
import {
  Delete,
  OfficeBuilding,
  Plus,
  RefreshRight,
  Search,
  Warning,
} from '@element-plus/icons-vue';
import type { ElTree } from 'element-plus';
import type { TreeNodeData } from 'element-plus/es/components/tree/src/tree.type';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useActiveLocaleDataRefresh } from '@/core/i18n/use-active-locale-data-refresh';
import { createBusinessCode } from '@/core/code/business-code';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useTreeExpansionState, type ExpansionTreeInstance } from '@/design-system/composables/useTreeExpansionState';
import {
  findResourceNode,
  flattenResources,
  getDirectChildren,
  getResourceBreadcrumb,
  resourceNodeStatusEnglishLabels,
  resourceNodeTypeLabels,
  resourceNodeTypeEnglishLabels,
  resourceNodeStatusLabels,
  type ResourceNode,
  type ResourceNodeStatus,
  type ResourceNodeType,
} from '@/domain/platform/org';
import type { TenantRecord } from '@/domain/platform/org';
import { fetchTenants } from '@/domain/platform/org/api/tenant.api';
import { fetchAllPages } from '@/core/api/pagination';
import {
  createSpace,
  deleteSpace,
  fetchSpaceTree,
  updateSpace,
} from '@/domain/platform/org/api/space.api';

// ==================== Resource tree ====================

const treeData = ref<ResourceNode[]>([]);
const tenants = ref<TenantRecord[]>([]);
const resourceRelations = computed(() => flattenResources(treeData.value).flatMap((node) => (
  (node.tenantIds || []).map((tenantId) => ({ resourceNodeId: node.id, tenantId, relationType: 'occupies' }))
)));
const treeFilter = ref('');
const loading = ref(true);
const treeRef = ref<InstanceType<typeof ElTree>>();
const {
  expandedKeys,
  onNodeExpand,
  onNodeCollapse,
  ensureExpanded,
  restore: restoreExpansion,
} = useTreeExpansionState();

const { t, locale } = useI18n();

function restoreTreeExpansion() {
  restoreExpansion(treeRef.value as unknown as ExpansionTreeInstance);
}

watch(treeFilter, (val) => {
  treeRef.value?.filter(val);
});

function filterNode(value: string, data: TreeNodeData): boolean {
  if (!value) return true;
  return String(data.name ?? '').toLowerCase().includes(value.toLowerCase());
}

const selectedNodeId = ref('');
const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null;
  return findResourceNode(treeData.value, selectedNodeId.value) ?? null;
});

function handleNodeClick(node: ResourceNode) {
  if (node.id === selectedNodeId.value) return;
  selectedNodeId.value = node.id;
  activeTab.value = 'base';
}

// ==================== Subtree helpers (matching OrganizationTreePage pattern) ====================

/** 递归收集节点自身及其所有子孙节点的 ID */
function collectResourceNodeIds(node: ResourceNode | null): string[] {
  if (!node) return [];
  return [node.id, ...flattenResources(node.children || []).map((item) => item.id)];
}

/** 统计子树下关联的唯一租户数 */
function countTenants(node: ResourceNode | null): number {
  if (!node) return 0;
  const ids = new Set(collectResourceNodeIds(node));
  const tenantIds = new Set(
    resourceRelations.value.filter((r) => ids.has(r.resourceNodeId)).map((r) => r.tenantId),
  );
  return tenantIds.size;
}

// ==================== Associated tenants (recursive subtree query) ====================

const associatedTenants = computed(() => {
  if (!selectedNode.value) return [];
  const ids = new Set(collectResourceNodeIds(selectedNode.value));
  const matched = resourceRelations.value.filter((r) => ids.has(r.resourceNodeId));
  // Deduplicate by tenantId, merge relationTypes
  const map = new Map<string, { tenant: TenantRecord; relationTypes: string[] }>();
  for (const rel of matched) {
    const tenant = tenants.value.find((t) => t.id === rel.tenantId);
    if (!tenant) continue;
    if (!map.has(rel.tenantId)) {
      map.set(rel.tenantId, { tenant, relationTypes: [] });
    }
    if (!map.get(rel.tenantId)!.relationTypes.includes(rel.relationType)) {
      map.get(rel.tenantId)!.relationTypes.push(rel.relationType);
    }
  }
  return [...map.values()];
});

const relationTypeLabels: Record<string, string> = {
  occupies: t('spacePage.relationTypes.occupies'),
  metered_by: t('spacePage.relationTypes.meteredBy'),
  owns: t('spacePage.relationTypes.owns'),
};

// ==================== Child nodes ====================

const children = computed(() => {
  if (!selectedNodeId.value) return [];
  return getDirectChildren(treeData.value, selectedNodeId.value);
});

// ==================== Breadcrumb & Tabs ====================

const activeTab = ref('base');

const breadcrumb = computed(() => {
  if (!selectedNode.value) return t('spacePage.savebar.notSelected');
  return getResourceBreadcrumb(treeData.value, selectedNode.value.id);
});

// ==================== Status helpers ====================

function statusTagType(status: ResourceNodeStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'enabled') return 'success';
  if (status === 'disabled') return 'warning';
  return 'neutral';
}

function typeTagType(type: ResourceNodeType): 'primary' | 'info' | 'warning' | 'neutral' {
  const map: Record<string, 'primary' | 'info' | 'warning' | 'neutral'> = {
    project: 'primary',
    building: 'info',
    floor: 'info',
    area: 'warning',
    system: 'info',
    equipment: 'neutral',
    meter: 'neutral',
    point: 'neutral',
    station: 'primary',
    charger: 'info',
    connector: 'neutral',
  };
  return map[type] ?? 'neutral';
}

// ==================== Draft / Edit form ====================

const emptyDraft = () => ({
  name: '',
  type: '' as ResourceNodeType | '',
  code: '',
  status: '' as ResourceNodeStatus | '',
  remark: '',
});

const draft = reactive(emptyDraft());

const isDirty = computed(() => {
  const source = selectedNode.value;
  if (!source) return false;
  return source.name !== draft.name
    || source.type !== draft.type
    || (source.code || '') !== draft.code
    || source.status !== draft.status
    || (source.remark || '') !== draft.remark;
});

function cloneDraft(node: ResourceNode | null) {
  return node
    ? {
        name: node.name,
        type: node.type,
        code: node.code || '',
        status: node.status,
        remark: node.remark || '',
      }
    : emptyDraft();
}

function resetWorkspace() {
  Object.assign(draft, cloneDraft(selectedNode.value));
  ElMessage.success(t('spacePage.messages.restored'));
}

async function saveWorkspace() {
  if (!selectedNode.value) return;
  if (!draft.name.trim()) { ElMessage.warning(t('spacePage.messages.enterName')); return; }
  const n = findResourceNode(treeData.value, selectedNode.value.id);
  if (!n) return;
  const saved = await updateSpace(n.id, {
    ...n,
    name: draft.name.trim(),
    type: draft.type as ResourceNodeType,
    code: draft.code || undefined,
    status: draft.status as ResourceNodeStatus,
    remark: draft.remark || undefined,
  });
  Object.assign(n, saved, { children: n.children });
  treeData.value = [...treeData.value];
  restoreTreeExpansion();
  Object.assign(draft, cloneDraft(selectedNode.value));
  ElMessage.success(t('spacePage.messages.nodeSaved'));
}

watch(selectedNode, (node) => {
  Object.assign(draft, cloneDraft(node));
  nextTick(() => {
    if (node) treeRef.value?.setCurrentKey(node.id);
  });
}, { immediate: true });

// ==================== Node type / status options ====================

// Physical resources and logical metering points have their own governed domains.
// Keep legacy nodes readable, but do not allow users to create duplicate meter/point records in the space tree.
const nodeTypeOptions = computed(() => Object.entries(
  locale.value === 'en-US' ? resourceNodeTypeEnglishLabels : resourceNodeTypeLabels,
)
  .filter(([value]) => !['meter', 'point'].includes(value))
  .map(([value, label]) => ({ value, label })));
const nodeStatusOptions = computed(() => Object.entries(
  locale.value === 'en-US' ? resourceNodeStatusEnglishLabels : resourceNodeStatusLabels,
).map(([value, label]) => ({ value, label })));

// ==================== Tree footer: add sibling / add child / deprecate / delete ====================

const dialogVisible = ref(false);
const savingDialog = ref(false);
const dialogMode = ref<'sibling' | 'child'>('child');
const form = reactive({ ...emptyDraft() });

function openCreateDialog(mode: 'sibling' | 'child') {
  if (!selectedNode.value) return;
  dialogMode.value = mode;
  Object.assign(form, {
    ...emptyDraft(),
    name: '',
    type: mode === 'child' ? 'area' : selectedNode.value.type,
    code: createBusinessCode('SPACE'),
    status: 'enabled',
    remark: '',
  });
  dialogVisible.value = true;
}

async function saveDialog() {
  if (!form.name.trim()) { ElMessage.warning(t('spacePage.messages.enterName')); return; }
  savingDialog.value = true;
  try {
    const parentId = dialogMode.value === 'child'
      ? selectedNode.value!.id
      : selectedNode.value!.parentId;
    const newNode = await createSpace({
      id: '',
      name: form.name.trim(),
      type: form.type as ResourceNodeType,
      code: form.code || undefined,
      status: form.status as ResourceNodeStatus,
      parentId,
      remark: form.remark || undefined,
      tenantIds: [],
    });
    const parent = findResourceNode(treeData.value, parentId);
    if (parent) {
      if (!parent.children) parent.children = [];
      parent.children.push(newNode);
      treeData.value = [...treeData.value];
      selectedNodeId.value = newNode.id;
    } else {
      treeData.value = [...treeData.value, newNode];
      selectedNodeId.value = newNode.id;
    }
    ensureExpanded(parentId);
    restoreTreeExpansion();
    dialogVisible.value = false;
    ElMessage.success(t('spacePage.messages.nodeCreated'));
  } finally {
    savingDialog.value = false;
  }
}

async function deprecateNode() {
  if (!selectedNode.value) return;
  const affectedTenants = countTenants(selectedNode.value);
  const msg = affectedTenants
    ? t('spacePage.messages.deprecateWithTenants', { name: selectedNode.value.name, count: affectedTenants })
    : t('spacePage.messages.confirmDeprecate', { name: selectedNode.value.name });
  await ElMessageBox.confirm(msg, t('spacePage.messages.deprecateTitle'), { confirmButtonText: t('spacePage.confirmButtonText.confirm'), cancelButtonText: t('spacePage.confirmButtonText.cancel'), type: 'warning' });
  const n = findResourceNode(treeData.value, selectedNode.value.id);
  if (!n) return;
  const saved = await updateSpace(n.id, { ...n, status: 'deprecated' });
  Object.assign(n, saved, { children: n.children });
  treeData.value = [...treeData.value];
  restoreTreeExpansion();
  ElMessage.success(t('spacePage.messages.nodeDeprecated'));
}

async function deleteNode() {
  if (!selectedNode.value) return;
  if (children.value.length) { ElMessage.warning(t('spacePage.messages.handleChildrenFirst')); return; }
  if (countTenants(selectedNode.value)) { ElMessage.warning(t('spacePage.messages.hasTenantsCannotDelete')); return; }
  await ElMessageBox.confirm(t('spacePage.messages.confirmDelete', { name: selectedNode.value.name }), t('spacePage.messages.deleteTitle'), {
    type: 'warning',
    confirmButtonText: t('spacePage.confirmButtonText.delete'),
    cancelButtonText: t('spacePage.confirmButtonText.cancel'),
  });
  await deleteSpace(selectedNode.value.id);
  const removeFromParent = (nodes: ResourceNode[], childId: string): boolean => {
    for (const node of nodes) {
      if (node.children) {
        const idx = node.children.findIndex((c) => c.id === childId);
        if (idx !== -1) { node.children.splice(idx, 1); return true; }
        if (removeFromParent(node.children, childId)) return true;
      }
    }
    return false;
  };
  removeFromParent(treeData.value, selectedNode.value.id);
  const flat = flattenResources(treeData.value);
  selectedNodeId.value = flat[0]?.id || '';
  treeData.value = [...treeData.value];
  restoreTreeExpansion();
  ElMessage.success(t('spacePage.messages.nodeDeleted'));
}

function selectChild(child: ResourceNode) {
  selectedNodeId.value = child.id;
  activeTab.value = 'base';
}

async function loadPageData() {
  const previousNodeId = selectedNodeId.value;
  const [spaces, tenantRows] = await Promise.all([
    fetchSpaceTree(),
    fetchAllPages((page, pageSize) => fetchTenants({ page, pageSize })),
  ]);
  treeData.value = spaces;
  tenants.value = tenantRows;
  const flattened = flattenResources(spaces);
  selectedNodeId.value = previousNodeId && flattened.some((node) => node.id === previousNodeId)
    ? previousNodeId
    : flattened[0]?.id || '';
  ensureExpanded(selectedNodeId.value);
}

useActiveLocaleDataRefresh(loadPageData);
onMounted(async () => {
  try { await loadPageData(); } finally { loading.value = false; }
});
</script>

<template>
  <DsListPageShell :title="t('spacePage.title')" :loading="loading" page-class="resource-ownership-page">
    <template #header-extra>
      <span class="org-page-subtitle">{{ t('spacePage.subtitle') }}</span>
    </template>
    <template #primary-action>
      <el-button v-permission.preview="'platform:project:station:relation:create'" class="ds-list-page__primary-action" type="primary" :icon="Plus" @click="openCreateDialog('child')">{{ t('spacePage.addNode') }}</el-button>
    </template>

    <section class="org-workspace-shell">
      <div class="org-workspace">
        <!-- ===== Left: Resource tree ===== -->
        <aside class="org-directory">
          <div class="org-directory__tools">
            <el-input
              v-model="treeFilter"
              class="org-directory__search"
              clearable
              :placeholder="t('spacePage.searchPlaceholder')"
              :prefix-icon="Search"
            />
          </div>

          <el-tree
            v-if="treeData.length"
            ref="treeRef"
            class="org-tree"
            node-key="id"
            :data="treeData"
            :props="{ label: 'name', children: 'children' }"
            :default-expanded-keys="expandedKeys"
            :expand-on-click-node="false"
            :filter-node-method="filterNode"
            highlight-current
            @node-click="handleNodeClick"
            @node-expand="onNodeExpand"
            @node-collapse="onNodeCollapse"
          >
            <template #default="{ data }">
              <span class="org-tree-node">
                <span class="org-tree-node__main">
                  <el-icon class="org-tree-node__icon"><OfficeBuilding /></el-icon>
                  <span class="org-tree-node__name">{{ data.name }}</span>
                </span>
                <span class="org-tree-node__meta">
                  <span v-if="countTenants(data)">{{ countTenants(data) }}</span>
                  <DsTag v-if="data.status === 'deprecated'" size="small" type="neutral">{{ t('spacePage.deprecated') }}</DsTag>
                  <DsTag v-else-if="data.status === 'disabled'" size="small" type="neutral">{{ t('spacePage.disabled') }}</DsTag>
                </span>
              </span>
            </template>
          </el-tree>
          <DsEmpty v-else :description="t('spacePage.noMatching')" :action-label="t('spacePage.clearSearch')" @retry="treeFilter = ''" />

          <footer class="org-directory__footer">
            <button v-permission.preview="'platform:project:station:relation:create'" type="button" class="org-dir-action" :disabled="!selectedNode" @click="selectedNode && openCreateDialog('sibling')">
              <el-icon><Plus /></el-icon>
              <span>{{ t('spacePage.addSibling') }}</span>
            </button>
            <button v-permission.preview="'platform:project:station:relation:create'" type="button" class="org-dir-action" :disabled="!selectedNode" @click="selectedNode && openCreateDialog('child')">
              <el-icon><Plus /></el-icon>
              <span>{{ t('spacePage.addChild') }}</span>
            </button>
            <button v-permission="'platform:project:station:relation:update'" type="button" class="org-dir-action is-warn" :disabled="!selectedNode" @click="deprecateNode">
              <el-icon><Warning /></el-icon>
              <span>{{ t('spacePage.deprecated') }}</span>
            </button>
            <button v-permission="'platform:project:station:relation:delete'" type="button" class="org-dir-action is-danger" :disabled="!selectedNode" @click="deleteNode">
              <el-icon><Delete /></el-icon>
              <span>{{ t('spacePage.delete') }}</span>
            </button>
          </footer>
        </aside>

        <!-- ===== Right: Detail with tabs ===== -->
        <section v-if="selectedNode" class="org-detail">
          <el-tabs v-model="activeTab" class="org-tabs">
            <el-tab-pane :label="t('spacePage.baseInfo')" name="base">
              <div class="org-tab-panel">
                <section class="org-form-surface">
                  <div class="org-form-grid">
                    <label class="org-field">
                      <span>{{ t('spacePage.formFields.name') }}</span>
                      <el-input v-model="draft.name" />
                    </label>
                    <label class="org-field">
                      <span>{{ t('spacePage.formFields.code') }}</span>
                      <el-input v-model="draft.code" disabled />
                    </label>
                    <label class="org-field">
                      <span>{{ t('spacePage.formFields.type') }}</span>
                      <el-select v-model="draft.type">
                        <el-option v-for="item in nodeTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                      </el-select>
                    </label>
                    <label class="org-field">
                      <span>{{ t('spacePage.formFields.status') }}</span>
                      <el-select v-model="draft.status">
                        <el-option v-for="item in nodeStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
                      </el-select>
                    </label>
                    <label class="org-field">
                      <span>{{ t('spacePage.formFields.path') }}</span>
                      <el-input :model-value="breadcrumb" disabled />
                    </label>
                    <label class="org-field is-wide">
                      <span>{{ t('spacePage.formFields.remark') }}</span>
                      <el-input v-model="draft.remark" type="textarea" :rows="3" maxlength="200" show-word-limit />
                    </label>
                  </div>
                </section>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="t('spacePage.associatedTenants', { count: associatedTenants.length })" name="tenants">
              <div class="org-tab-panel">
                <div v-if="associatedTenants.length" class="org-row-list">
                  <div v-for="item in associatedTenants" :key="item.tenant.id" class="org-row">
                    <div class="org-row__main">
                      <strong>{{ item.tenant.name }}</strong>
                      <span>{{ item.tenant.code }} / {{ item.tenant.contactPerson || t('spacePage.noContactPerson') }}</span>
                    </div>
                    <span class="org-row__metric">{{ item.tenant.contactPhone || '—' }}</span>
                    <DsTag size="small" :type="item.relationTypes.includes('occupies') ? 'info' : 'neutral'">
                      {{ item.relationTypes.map((t) => relationTypeLabels[t] || t).join(' + ') }}
                    </DsTag>
                  </div>
                </div>
                <DsEmpty v-else class="org-empty-state" :description="t('spacePage.noTenantsInSubtree')" />
              </div>
            </el-tab-pane>
          </el-tabs>
        </section>

        <section v-else class="org-detail org-detail--empty">
          <DsEmpty :description="t('spacePage.selectLeftNode')" :action-label="t('spacePage.addNode')" @retry="openCreateDialog('child')" />
        </section>
      </div>

      <!-- ===== Savebar ===== -->
      <footer class="org-savebar">
        <div class="org-savebar__meta">
          <span>{{ t('spacePage.savebar.currentNode') }}{{ selectedNode?.name || t('spacePage.savebar.notSelected') }}</span>
          <i :class="{ 'is-dirty': isDirty }" />
          <span>{{ isDirty ? t('spacePage.savebar.modified') : t('spacePage.savebar.unchanged') }}</span>
        </div>
        <div class="org-savebar__actions">
          <el-button :disabled="!isDirty" @click="resetWorkspace">{{ t('spacePage.savebar.cancel') }}</el-button>
          <el-button :icon="RefreshRight" :disabled="!isDirty" @click="resetWorkspace">{{ t('spacePage.savebar.reset') }}</el-button>
          <el-button v-permission="'platform:project:station:relation:update'" type="primary" :disabled="!selectedNode || !isDirty" @click="saveWorkspace">{{ t('spacePage.savebar.save') }}</el-button>
        </div>
      </footer>
    </section>

    <!-- ===== Dialog: Add node ===== -->
    <template #overlays>
      <el-dialog v-model="dialogVisible" class="org-dialog" :title="dialogMode === 'child' ? t('spacePage.dialogTitle.child') : t('spacePage.dialogTitle.sibling')" width="560px" destroy-on-close>
        <div class="org-dialog-form">
          <label class="org-field">
            <span>{{ t('spacePage.formFields.name') }}</span>
            <el-input v-model="form.name" :placeholder="t('spacePage.formFields.namePlaceholder')" />
          </label>
          <label class="org-field">
            <span>{{ t('spacePage.formFields.code') }}</span>
            <el-input v-model="form.code" disabled />
          </label>
          <label class="org-field">
            <span>{{ t('spacePage.formFields.type') }}</span>
            <el-select v-model="form.type">
              <el-option v-for="item in nodeTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label class="org-field">
            <span>{{ t('spacePage.formFields.status') }}</span>
            <el-select v-model="form.status">
              <el-option v-for="item in nodeStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label class="org-field is-wide">
            <span>{{ t('spacePage.formFields.remark') }}</span>
            <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="200" show-word-limit />
          </label>
        </div>
        <template #footer>
          <div class="org-dialog__footer">
            <el-button @click="dialogVisible = false">{{ t('spacePage.dialogCancel') }}</el-button>
            <el-button v-permission="'platform:project:station:relation:create'" type="primary" :loading="savingDialog" @click="saveDialog">{{ t('spacePage.dialogSave') }}</el-button>
          </div>
        </template>
      </el-dialog>
    </template>
  </DsListPageShell>
</template>

<style scoped>
.org-page-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

/* ===== Shell layout (matches OrganizationTreePage) ===== */

.org-workspace-shell {
  display: grid;
  height: var(--ds-list-workspace-h);
  grid-template-rows: minmax(0, 1fr) auto;
  margin: var(--ds-page-filter-py-top) var(--ds-page-inset) var(--space-6);
  overflow: hidden;
}

.org-workspace {
  display: grid;
  min-height: 0;
  grid-template-columns: var(--ds-master-pane-width) minmax(0, 1fr);
  border-top: 1px solid var(--ds-list-divider);
}

/* ===== Left: Directory ===== */

.org-directory {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: var(--space-4) var(--space-5) var(--space-4) 0;
  border-right: 1px solid var(--ds-list-divider);
}

.org-directory__tools {
  padding-bottom: var(--space-3);
}

.org-tree {
  min-height: 0;
  overflow: auto;
  background: transparent;
}

.org-tree :deep(.el-tree-node__content) {
  height: 36px;
  margin: 2px 0;
  border-radius: var(--radius-md);
}

.org-tree :deep(.el-tree-node__content:hover),
.org-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: color-mix(in srgb, var(--color-primary-500) 9%, transparent);
}

.org-tree-node {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  padding-right: var(--space-2);
  font-size: 13px;
}

.org-tree-node__main,
.org-tree-node__meta {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-2);
}

.org-tree-node__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-tree-node__icon {
  color: var(--color-text-secondary);
}

.org-tree-node__meta {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

/* ===== Directory footer ===== */

.org-directory__footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin-top: 0;
  padding-top: var(--space-3);
  border-top: 1px solid var(--ds-list-divider);
}

.org-dir-action {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-caption);
}

.org-dir-action:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-primary-500) 35%, var(--color-border-default));
  color: var(--color-primary-500);
}

.org-dir-action.is-warn {
  color: var(--color-warning-default);
}

.org-dir-action.is-warn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-warning-default) 35%, var(--color-border-default));
  color: var(--color-warning-hover);
}

.org-dir-action.is-danger {
  color: var(--color-error-default);
}

.org-dir-action.is-danger:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-error-default) 35%, var(--color-border-default));
  color: var(--color-error-hover);
}

.org-dir-action:disabled {
  cursor: not-allowed;
  opacity: .45;
}

/* ===== Right: Detail ===== */

.org-detail {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto;
  padding: var(--space-4) 0 var(--space-4) var(--space-5);
}

.org-detail--empty {
  place-items: center;
}

.org-tabs {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.org-tabs :deep(.el-tabs__header) {
  flex: 0 0 auto;
  margin: 0 0 var(--space-3);
}

.org-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: var(--ds-list-divider);
}

.org-tabs :deep(.el-tabs__content) {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
}

.org-tabs :deep(.el-tab-pane) {
  height: auto;
}

.org-tab-panel {
  display: grid;
  align-content: start;
  gap: var(--space-5);
  padding: 0 0 var(--space-6);
}

/* ===== Form ===== */

.org-form-surface {
  display: grid;
  gap: var(--space-4);
}

.org-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-6);
}

.org-field {
  display: grid;
  min-width: 0;
  gap: var(--space-1);
}

.org-field.is-wide {
  grid-column: 1 / -1;
}

.org-field span {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.org-field :deep(.el-select),
.org-field :deep(.el-input-number) {
  width: 100%;
}

/* ===== Row list (tenants / children) ===== */

.org-row-list {
  display: grid;
  align-content: start;
  border-top: 1px solid var(--ds-list-divider);
}

.org-row {
  display: grid;
  min-height: 62px;
  grid-template-columns: minmax(0, 1fr) auto auto auto auto;
  align-items: center;
  gap: var(--space-4);
  border-bottom: 1px solid var(--ds-list-divider);
}

.org-row > .ds-tag {
  justify-self: start;
}

.org-row__main {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.org-row__main strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-row__main span {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-row__metric {
  color: var(--color-text-primary);
  font-size: var(--font-caption);
  white-space: nowrap;
}

.org-empty-state {
  min-height: 320px;
  place-self: stretch;
}

/* ===== Savebar ===== */

.org-savebar {
  display: flex;
  min-height: 66px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0 0;
  border-top: 1px solid var(--ds-list-divider);
}

.org-savebar__meta,
.org-savebar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.org-savebar__meta {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.org-savebar__meta i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
}

.org-savebar__meta i.is-dirty {
  background: var(--color-warning-default);
}

/* ===== Dialog ===== */

.org-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.org-dialog-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3) var(--space-4);
}

/* ===== Responsive ===== */

@media (max-width: 1180px) {
  .org-workspace {
    grid-template-columns: var(--ds-master-pane-width-compact) minmax(0, 1fr);
  }

  .org-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .org-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}

@media (max-width: 820px) {
  .org-workspace-shell {
    height: auto;
    min-height: var(--ds-list-workspace-h);
  }

  .org-workspace,
  .org-form-grid,
  .org-dialog-form {
    grid-template-columns: 1fr;
  }

  .org-directory {
    border-right: 0;
    border-bottom: 1px solid var(--ds-list-divider);
  }

  .org-directory__footer {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
