<script setup lang="ts">
import {
  Delete,
  OfficeBuilding,
  Plus,
  RefreshRight,
  Search,
} from '@element-plus/icons-vue';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
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
  findOrganization,
  flattenOrganizations,
  type OrganizationDraft,
  type OrganizationNode,
  type OrganizationStatus,
  type OrganizationType,
  type Position,
} from '@/domain/platform/org';
import type { AccountDirectoryRecord } from '@/domain/platform/user-permission';
import { fetchAccountDirectory } from '@/domain/platform/user-permission/api/account.api';
import { fetchAllPages } from '@/core/api/pagination';
import { fetchPositions } from '@/domain/platform/org/api/position.api';
import {
  createOrganization,
  deleteOrganization,
  updateOrganization,
} from '@/domain/platform/org/api/organization.api';

interface OrgTreeInstance {
  setCurrentKey(key: string): void;
  store?: { nodesMap: Record<string, { expanded: boolean }> };
}

const orgStore = useOrgStore();
const { t } = useI18n();
const accounts = ref<AccountDirectoryRecord[]>([]);
const positions = ref<Position[]>([]);
const treeRef = ref<OrgTreeInstance>();
const keyword = ref('');
const activeTab = ref('base');
const activeOrgId = ref(orgStore.tree[0]?.id || '');
const dialogVisible = ref(false);
const savingDialog = ref(false);
const tabContentVersion = ref(0);
const loading = ref(true);
let loadSequence = 0;
const {
  expandedKeys,
  onNodeExpand,
  onNodeCollapse,
  ensureExpanded,
  restore: restoreExpansion,
} = useTreeExpansionState();

const emptyDraft = (): OrganizationDraft => ({
  id: '',
  code: '',
  name: '',
  type: 'department',
  status: 'enabled',
  parentId: '',
  manager: '',
  leaderAccountId: '',
  phone: '',
  city: '',
  address: '',
  projectCount: 0,
  stationCount: 0,
  accountCount: 0,
  remark: '',
});

const draft = reactive<OrganizationDraft>(emptyDraft());
const form = reactive<OrganizationDraft>(emptyDraft());

const flatOrganizations = computed(() => flattenOrganizations(orgStore.tree));
const activeOrg = computed(() => findOrganization(orgStore.tree, activeOrgId.value) || flatOrganizations.value[0] || null);
const filteredTree = computed(() => filterOrganizations(orgStore.tree, keyword.value));
const children = computed(() => activeOrg.value?.children || []);
const isDirty = computed(() => {
  const source = activeOrg.value;
  if (!source) return false;
  return source.code !== draft.code
    || source.name !== draft.name
    || source.type !== draft.type
    || source.status !== draft.status
    || source.parentId !== draft.parentId
    || source.manager !== draft.manager
    || source.leaderAccountId !== draft.leaderAccountId
    || source.phone !== draft.phone
    || source.city !== draft.city
    || source.address !== draft.address
    || source.remark !== draft.remark;
});

const parentOptions = computed(() => [
  { label: t('orgPage.tree.root'), value: '' },
  ...flatOrganizations.value
    .filter((item) => item.id !== draft.id)
    .map((item) => ({ label: item.name, value: item.id })),
]);

const dialogParentOptions = computed(() => [
  { label: t('orgPage.tree.root'), value: '' },
  ...flatOrganizations.value
    .filter((item) => item.id !== form.id)
    .map((item) => ({ label: item.name, value: item.id })),
]);

const typeOptions = computed<Array<{ label: string; value: OrganizationType }>>(() => [
  { label: t('orgPage.type.group'), value: 'group' },
  { label: t('orgPage.type.company'), value: 'company' },
  { label: t('orgPage.type.center'), value: 'center' },
  { label: t('orgPage.type.business'), value: 'business' },
  { label: t('orgPage.type.department'), value: 'department' },
]);

const statusOptions = computed<Array<{ label: string; value: OrganizationStatus }>>(() => [
  { label: t('orgPage.status.enabled'), value: 'enabled' },
  { label: t('orgPage.status.disabled'), value: 'disabled' },
]);

const breadcrumb = computed(() => {
  const names: string[] = [];
  let current: OrganizationNode | null = activeOrg.value;
  while (current) {
    names.unshift(current.name);
    current = current.parentId ? findOrganization(orgStore.tree, current.parentId) || null : null;
  }
  return names.join(' / ') || t('orgPage.savebar.notSelected');
});

function collectNodeIds(org: OrganizationNode | null): string[] {
  if (!org) return [];
  return [org.id, ...flattenOrganizations(org.children || []).map((item) => item.id)];
}

function countAccounts(org: OrganizationNode | null): number {
  const ids = new Set(collectNodeIds(org));
  return accounts.value.filter((account) => ids.has(account.orgNodeId)).length;
}

function listAccounts(org: OrganizationNode | null) {
  const ids = new Set(collectNodeIds(org));
  return accounts.value.filter((account) => ids.has(account.orgNodeId));
}

function listPositions(org: OrganizationNode | null): Position[] {
  const ids = new Set(collectNodeIds(org));
  return positions.value.filter((position) => ids.has(position.orgNodeId));
}

const activeAccounts = computed(() => listAccounts(activeOrg.value));
const activePositions = computed(() => listPositions(activeOrg.value));

function cloneDraft(org: OrganizationNode | null): OrganizationDraft {
  return org ? {
    id: org.id,
    code: org.code,
    name: org.name,
    type: org.type,
    status: org.status,
    parentId: org.parentId || '',
    manager: org.manager,
    leaderAccountId: org.leaderAccountId || '',
    phone: org.phone,
    city: org.city,
    address: org.address,
    projectCount: org.projectCount,
    stationCount: org.stationCount,
    accountCount: org.accountCount,
    remark: org.remark,
  } : emptyDraft();
}

function typeTagType(type: OrganizationType): 'primary' | 'info' | 'warning' | 'neutral' {
  const map: Record<OrganizationType, 'primary' | 'info' | 'warning' | 'neutral'> = {
    group: 'primary',
    company: 'info',
    center: 'info',
    business: 'warning',
    department: 'neutral',
  };
  return map[type];
}

function statusTagType(status: OrganizationStatus): 'success' | 'neutral' {
  return status === 'enabled' ? 'success' : 'neutral';
}

async function selectOrg(org: OrganizationNode) {
  if (org.id === activeOrgId.value) return;
  if (isDirty.value) {
    await ElMessageBox.confirm(
      t('orgPage.messages.unsavedConfirm'),
      t('orgPage.messages.switchTitle'),
      {
        type: 'warning',
        confirmButtonText: t('orgPage.messages.continueSwitch'),
        cancelButtonText: t('orgPage.messages.cancel'),
      },
    );
  }
  activeOrgId.value = org.id;
  activeTab.value = 'base';
}

function resetWorkspace() {
  Object.assign(draft, cloneDraft(activeOrg.value));
  ElMessage.success(t('orgPage.messages.workspaceReset'));
}

async function saveWorkspace() {
  if (!activeOrg.value) return;
  if (!draft.name.trim() || !draft.code.trim()) {
    ElMessage.warning(t('orgPage.messages.fillRequired'));
    return;
  }

  const saved = await updateOrganization(activeOrg.value.id, {
    ...draft,
    name: draft.name.trim(),
    code: draft.code.trim(),
    accountCount: activeAccounts.value.length,
  });
  orgStore.updateNode(saved);
  restoreExpansion(treeRef.value);
  Object.assign(draft, cloneDraft(activeOrg.value));
  ElMessage.success(t('orgPage.messages.orgSaved'));
}

function openCreateDialog(parentId: string | null = '') {
  Object.assign(form, {
    ...emptyDraft(),
    id: `pending-${crypto.randomUUID()}`,
    code: createBusinessCode('ORG'),
    parentId: parentId || '',
    type: parentId ? 'department' : 'company',
    status: 'enabled',
  });
  dialogVisible.value = true;
}

async function saveDialog() {
  if (!form.name.trim() || !form.code.trim()) {
    ElMessage.warning(t('orgPage.messages.fillRequired'));
    return;
  }

  savingDialog.value = true;
  try {
    const node = await createOrganization({ ...form, name: form.name.trim(), code: form.code.trim() });
    orgStore.insertNode(node);
    ensureExpanded(node.parentId);
    restoreExpansion(treeRef.value);
    activeOrgId.value = node.id;
    dialogVisible.value = false;
    ElMessage.success(t('orgPage.messages.orgCreated'));
  } finally {
    savingDialog.value = false;
  }
}

async function deleteCurrentOrg() {
  const org = activeOrg.value;
  if (!org) return;
  if (org.children?.length) {
    ElMessage.warning(t('orgPage.messages.deleteChildrenFirst'));
    return;
  }
  if (activeAccounts.value.length || activePositions.value.length) {
    ElMessage.warning(t('orgPage.messages.orgInUse'));
    return;
  }

  await ElMessageBox.confirm(
    t('orgPage.messages.deleteConfirm', { name: org.name }),
    t('orgPage.messages.deleteTitle'),
    {
      type: 'warning',
      confirmButtonText: t('orgPage.messages.delete'),
      cancelButtonText: t('orgPage.messages.cancel'),
    },
  );
  await deleteOrganization(org.id);
  orgStore.deleteNode(org.id);
  restoreExpansion(treeRef.value);
  activeOrgId.value = flatOrganizations.value[0]?.id || '';
  ElMessage.success(t('orgPage.messages.orgDeleted'));
}

watch(activeOrg, (org) => {
  Object.assign(draft, cloneDraft(org));
  nextTick(() => {
    if (org) treeRef.value?.setCurrentKey(org.id);
  });
}, { immediate: true });

watch(activeTab, async () => {
  tabContentVersion.value += 1;
  await nextTick();
});

async function loadPageData() {
  const sequence = ++loadSequence;
  const previousOrgId = activeOrgId.value;
  await orgStore.load();
  const [accountRows, positionRows] = await Promise.all([
    fetchAllPages((page, pageSize) => fetchAccountDirectory({ page, pageSize })),
    fetchPositions(),
  ]);
  if (sequence !== loadSequence) return;
  accounts.value = accountRows;
  positions.value = positionRows;
  activeOrgId.value = previousOrgId && orgStore.byId.has(previousOrgId)
    ? previousOrgId
    : orgStore.tree[0]?.id || '';
  ensureExpanded(activeOrgId.value);
}

useActiveLocaleDataRefresh(loadPageData);
onMounted(async () => {
  try { await loadPageData(); } finally { loading.value = false; }
});
onBeforeUnmount(() => { loadSequence += 1; });
</script>

<template>
  <DsListPageShell :title="t('orgPage.title')" :loading="loading" page-class="organization-tree-page">
    <template #header-extra>
      <span class="org-page-subtitle">{{ t('orgPage.subtitle') }}</span>
    </template>
    <template #primary-action>
      <el-button v-permission.preview="'platform:organization:tree:create'" class="ds-list-page__primary-action" type="primary" :icon="Plus" @click="openCreateDialog('')">{{ t('orgPage.addOrg') }}</el-button>
    </template>

    <section class="org-workspace-shell">
      <div class="org-workspace">
        <aside class="org-directory">
          <div class="org-directory__tools">
            <el-input
              v-model="keyword"
              class="org-directory__search"
              clearable
              :placeholder="t('orgPage.searchPlaceholder')"
              :prefix-icon="Search"
            />
          </div>

          <el-tree
            v-if="filteredTree.length"
            ref="treeRef"
            class="org-tree"
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
              <span class="org-tree-node">
                <span class="org-tree-node__main">
                  <el-icon v-if="!data.parentId || data.children?.length" class="org-tree-node__icon"><OfficeBuilding /></el-icon>
                  <span class="org-tree-node__name">{{ data.name }}</span>
                </span>
                <span class="org-tree-node__meta">
                  <span>{{ countAccounts(data) }}</span>
                  <DsTag v-if="data.status === 'disabled'" size="small" type="neutral">{{ t('orgPage.tree.disabledTag') }}</DsTag>
                </span>
              </span>
            </template>
          </el-tree>
          <DsEmpty v-else :description="t('orgPage.noMatchingOrg')" :action-label="t('orgPage.clearSearch')" @retry="keyword = ''" />

          <footer class="org-directory__footer">
            <button v-permission.preview="'platform:organization:tree:create'" type="button" class="org-dir-action" :disabled="!activeOrg" @click="activeOrg && openCreateDialog(activeOrg.parentId)">
              <el-icon><Plus /></el-icon>
              <span>{{ t('orgPage.addSibling') }}</span>
            </button>
            <button v-permission.preview="'platform:organization:tree:create'" type="button" class="org-dir-action" :disabled="!activeOrg" @click="activeOrg && openCreateDialog(activeOrg.id)">
              <el-icon><Plus /></el-icon>
              <span>{{ t('orgPage.addChild') }}</span>
            </button>
            <button v-permission="'platform:organization:tree:delete'" type="button" class="org-dir-action is-danger" :disabled="!activeOrg" @click="deleteCurrentOrg">
              <el-icon><Delete /></el-icon>
              <span>{{ t('orgPage.delete') }}</span>
            </button>
          </footer>
        </aside>

        <section v-if="activeOrg" class="org-detail">
          <el-tabs :key="`${activeOrgId}-${tabContentVersion}`" v-model="activeTab" class="org-tabs">
            <el-tab-pane :label="t('orgPage.tabs.baseInfo')" name="base">
              <div class="org-tab-panel">
                <section class="org-form-surface">
                  <div class="org-form-grid">
                    <label class="org-field">
                      <span>{{ t('orgPage.form.name') }}</span>
                      <el-input v-model="draft.name" />
                    </label>
                    <label class="org-field">
                      <span>{{ t('orgPage.form.code') }}</span>
                      <el-input v-model="draft.code" disabled />
                    </label>
                    <label class="org-field">
                      <span>{{ t('orgPage.form.type') }}</span>
                      <el-select v-model="draft.type">
                        <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
                      </el-select>
                    </label>
                    <label class="org-field">
                      <span>{{ t('orgPage.form.status') }}</span>
                      <el-select v-model="draft.status">
                        <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
                      </el-select>
                    </label>
                    <label class="org-field">
                      <span>{{ t('orgPage.form.parentOrg') }}</span>
                      <el-select :model-value="draft.parentId ?? ''" :disabled="!activeOrg?.parentId" @update:model-value="draft.parentId = String($event || '')">
                        <el-option v-for="item in parentOptions" :key="item.value" :label="item.label" :value="item.value" />
                      </el-select>
                    </label>
                    <label class="org-field">
                      <span>{{ t('orgPage.form.leader') }}</span>
                      <el-select v-model="draft.leaderAccountId" clearable filterable :placeholder="t('orgPage.form.leaderPlaceholder')">
                        <el-option v-for="account in accounts" :key="account.id" :label="account.name" :value="account.id" />
                      </el-select>
                    </label>
                    <label class="org-field">
                      <span>{{ t('orgPage.form.phone') }}</span>
                      <el-input v-model="draft.phone" />
                    </label>
                    <label class="org-field">
                      <span>{{ t('orgPage.form.city') }}</span>
                      <el-input v-model="draft.city" />
                    </label>
                    <label class="org-field is-wide">
                      <span>{{ t('orgPage.form.address') }}</span>
                      <el-input v-model="draft.address" />
                    </label>
                    <label class="org-field is-wide">
                      <span>{{ t('orgPage.form.remark') }}</span>
                      <el-input v-model="draft.remark" type="textarea" :rows="3" maxlength="200" show-word-limit />
                    </label>
                  </div>
                </section>

              </div>
            </el-tab-pane>

            <el-tab-pane :label="t('orgPage.tabs.members') + ` (${activeAccounts.length})`" name="members">
              <div class="org-tab-panel">
                <div v-if="activeAccounts.length" class="org-member-grid">
                  <div v-for="account in activeAccounts" :key="account.id" class="org-member-card">
                    <strong>{{ account.name }}</strong>
                    <span>{{ account.username }}</span>
                  </div>
                </div>
                <DsEmpty v-else class="org-empty-state" :description="t('orgPage.members.empty')" />
              </div>
            </el-tab-pane>

            <el-tab-pane :label="t('orgPage.tabs.positions') + ` (${activePositions.length})`" name="positions">
              <div class="org-tab-panel">
                <div class="org-row-list">
                  <div v-for="position in activePositions" :key="position.id" class="org-row">
                    <div class="org-row__main">
                      <strong>{{ position.name }}</strong>
                      <span>{{ position.code }} / {{ position.description }}</span>
                    </div>
                    <span class="org-row__metric">{{ t('orgPage.positions.headcount') }} {{ position.headcount ?? 0 }}</span>
                    <span class="org-row__metric">{{ t('orgPage.positions.onDuty') }} {{ position.currentCount }}</span>
                    <DsTag size="small" :type="position.status === 'enabled' ? 'success' : 'neutral'">{{ position.status === 'enabled' ? t('orgPage.positions.enabled') : t('orgPage.positions.disabled') }}</DsTag>
                  </div>
                  <DsEmpty v-if="!activePositions.length" :description="t('orgPage.positions.empty')" />
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="t('orgPage.tabs.children') + ` (${children.length})`" name="children">
              <div class="org-tab-panel">
                <div class="org-row-list">
                  <div v-for="child in children" :key="child.id" class="org-row">
                    <div class="org-row__main">
                      <strong>{{ child.name }}</strong>
                      <span>{{ child.code }} / {{ child.manager || t('orgPage.children.noManagerSet') }}</span>
                    </div>
                    <DsTag size="small" :type="typeTagType(child.type)">{{ t(`orgPage.type.${child.type}`) }}</DsTag>
                    <DsTag size="small" :type="statusTagType(child.status)">{{ t(`orgPage.status.${child.status}`) }}</DsTag>
                    <el-button text size="small" @click="selectOrg(child)">{{ t('orgPage.view') }}</el-button>
                  </div>
                  <DsEmpty v-if="!children.length" :description="t('orgPage.children.empty')" :action-label="t('orgPage.children.addChild')" @retry="openCreateDialog(activeOrg.id)" />
                </div>
              </div>
            </el-tab-pane>

          </el-tabs>
        </section>

        <section v-else class="org-detail org-detail--empty">
          <DsEmpty :description="t('orgPage.emptyState.noOrg')" :action-label="t('orgPage.addOrg')" @retry="openCreateDialog('')" />
        </section>
      </div>

      <footer class="org-savebar">
        <div class="org-savebar__meta">
          <span>{{ t('orgPage.savebar.currentOrg') }}{{ activeOrg?.name || t('orgPage.savebar.notSelected') }}</span>
          <i :class="{ 'is-dirty': isDirty }" />
          <span>{{ isDirty ? t('orgPage.savebar.modified') : t('orgPage.savebar.unmodified') }}</span>
        </div>
        <div class="org-savebar__actions">
          <el-button :disabled="!isDirty" @click="resetWorkspace">{{ t('orgPage.actions.cancel') }}</el-button>
          <el-button :icon="RefreshRight" :disabled="!isDirty" @click="resetWorkspace">{{ t('orgPage.actions.reset') }}</el-button>
          <el-button v-permission="'platform:organization:tree:update'" type="primary" :disabled="!activeOrg || !isDirty" @click="saveWorkspace">{{ t('orgPage.actions.save') }}</el-button>
        </div>
      </footer>
    </section>

    <template #overlays>
      <el-dialog v-model="dialogVisible" class="org-dialog" :title="t('orgPage.dialog.addTitle')" width="560px" destroy-on-close>
        <div class="org-dialog-form">
          <label class="org-field">
            <span>{{ t('orgPage.form.name') }}</span>
            <el-input v-model="form.name" :placeholder="t('orgPage.dialog.namePlaceholder')" />
          </label>
          <label class="org-field">
            <span>{{ t('orgPage.form.code') }}</span>
            <el-input v-model="form.code" disabled />
          </label>
          <label class="org-field">
            <span>{{ t('orgPage.form.type') }}</span>
            <el-select v-model="form.type">
              <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label class="org-field">
            <span>{{ t('orgPage.form.parentOrg') }}</span>
            <el-select :model-value="form.parentId ?? ''" @update:model-value="form.parentId = String($event || '')">
              <el-option v-for="item in dialogParentOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label class="org-field">
            <span>{{ t('orgPage.form.leader') }}</span>
            <el-select v-model="form.leaderAccountId" clearable filterable :placeholder="t('orgPage.form.leaderPlaceholder')">
              <el-option v-for="account in accounts" :key="account.id" :label="account.name" :value="account.id" />
            </el-select>
          </label>
          <label class="org-field">
            <span>{{ t('orgPage.form.city') }}</span>
            <el-input v-model="form.city" />
          </label>
        </div>
        <template #footer>
          <div class="org-dialog__footer">
            <el-button @click="dialogVisible = false">{{ t('orgPage.dialog.cancel') }}</el-button>
            <el-button v-permission="'platform:organization:tree:create'" type="primary" :loading="savingDialog" @click="saveDialog">{{ t('orgPage.dialog.save') }}</el-button>
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

.org-directory__footer {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.org-dir-action.is-danger {
  color: var(--color-error-default);
}

.org-dir-action:disabled {
  cursor: not-allowed;
  opacity: .45;
}

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

.org-form-surface {
  display: grid;
  gap: var(--space-4);
}

.org-section-title {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.org-section-title strong {
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
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

.org-row-list {
  display: grid;
  align-content: start;
  border-top: 1px solid var(--ds-list-divider);
}

.org-row {
  display: grid;
  min-height: 62px;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
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

.org-member-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}

.org-member-card {
  display: grid;
  min-height: 58px;
  align-content: center;
  gap: 2px;
  padding: 0 var(--space-4);
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-bg-muted) 52%, var(--color-bg-surface));
}

.org-member-card strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-member-card span {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-empty-state {
  min-height: 320px;
  place-self: stretch;
}

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
}
</style>
