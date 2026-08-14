<script setup lang="ts">
import {
  Close,
  CopyDocument,
  Delete,
  FullScreen,
  Plus,
  RefreshRight,
  Search,
} from '@element-plus/icons-vue';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useActiveLocaleDataRefresh } from '@/core/i18n/use-active-locale-data-refresh';
import { createBusinessCode } from '@/core/code/business-code';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { createPermissionEntriesFromMenuTree, flattenMenuResources } from '@/core/menu/menu-resource.factory';
import type { PersistedMenuNode } from '@/core/menu/menu.store';
import {
  roleStatusLabels,
  type AccountRecord,
  type RoleDataScope,
  type RoleDraft,
  type RoleRecord,
  type RoleStatus,
} from '@/domain/platform/user-permission';
import { fetchAccounts } from '@/domain/platform/user-permission/api/account.api';
import { fetchAllPages } from '@/core/api/pagination';
import {
  createRole as createRoleApi,
  deleteRole as deleteRoleApi,
  fetchRoles,
  updateRole as updateRoleApi,
  type RoleSaveInput,
} from '@/domain/platform/user-permission/api/role.api';
import { fetchMenuTree } from '@/domain/platform/user-permission/api/menu.api';
import { usePermissionStore } from '@/core/permission/permission.store';
import { useMenuStore } from '@/core/menu/menu.store';
import { useAuthStore } from '@/core/auth/auth.store';

interface PermissionGroup {
  title: string;
  /** 菜单路径，用于在菜单树中定位 */
  menuPath: string;
  permissions: string[];
}

interface MenuTreeNode {
  id: string;
  label: string;
  path: string;
  children?: MenuTreeNode[];
  disabled?: boolean;
}

interface RoleTreeInstance {
  setCheckedKeys(keys: string[], leafOnly?: boolean): void;
  getCheckedKeys(leafOnly?: boolean): Array<string | number>;
  store?: {
    nodesMap: Record<string, { expanded: boolean }>;
  };
}

type RoleForm = RoleDraft;

const builtInRoleCodes = new Set(['admin', 'ops', 'analyst', 'finance', 'user']);

const { t } = useI18n();

const dataScopeOptions = computed<Array<{ label: string; value: RoleDataScope; hint: string }>>(() => [
  { label: t('business.dataScope.all'), value: 'all', hint: t('rolePage.dataScopeHint.all') },
  { label: t('business.dataScope.org'), value: 'org', hint: t('rolePage.dataScopeHint.org') },
  { label: t('business.dataScope.department'), value: 'department', hint: t('rolePage.dataScopeHint.department') },
  { label: t('business.dataScope.self'), value: 'self', hint: t('rolePage.dataScopeHint.self') },
  { label: t('business.dataScope.custom'), value: 'custom', hint: t('rolePage.dataScopeHint.custom') },
]);

const focusGuideStorageKey = 'systempro:role-permission:focus-guide-dismissed';
const focusModeStorageKey = 'systempro:role-permission:focus-mode';

const permissionStore = usePermissionStore();
const menuStore = useMenuStore();
const authStore = useAuthStore();

const actionPermissionGroups = computed<PermissionGroup[]>(() => {
  const fromStore = permissionStore.allPermissions.filter((p) => p.source === 'menu-button');
  const groupMap = new Map<string, PermissionGroup>();
  for (const entry of fromStore) {
    let group = groupMap.get(entry.menuId);
    if (!group) {
      group = {
        title: entry.category,
        menuPath: entry.menuPath,
        permissions: [],
      };
      groupMap.set(entry.menuId, group);
    }
    group.permissions.push(entry.code);
  }

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      permissions: group.permissions.sort((a, b) => {
        const aEntry = permissionStore.get(a);
        const bEntry = permissionStore.get(b);
        return (aEntry?.action || a).localeCompare(bEntry?.action || b);
      }),
    }))
    .sort((a, b) => a.menuPath.localeCompare(b.menuPath));
});

const roles = ref<RoleRecord[]>([]);
const accounts = ref<AccountRecord[]>([]);
const roleKeyword = ref('');
const activeRoleId = ref(roles.value[0]?.id || '');
const activeTab = ref('menu');
const treeRef = ref<RoleTreeInstance>();
const dialogVisible = ref(false);
const savingRole = ref(false);
const editingRoleId = ref('');
const loading = ref(true);
const isFocusMode = ref(window.localStorage.getItem(focusModeStorageKey) !== 'standard');
const showFocusGuide = ref(!window.localStorage.getItem(focusGuideStorageKey));

const draft = reactive<{
  status: RoleStatus;
  dataScope: RoleDataScope;
  menuPaths: string[];
  actionPermissions: string[];
}>({
  status: 'enabled',
  dataScope: 'department',
  menuPaths: [],
  actionPermissions: [],
});

const roleForm = reactive<RoleForm>({
  code: '',
  name: '',
  description: '',
  status: 'enabled',
  dataScope: 'department',
  menuPaths: [],
  actionPermissions: [],
});

const menuTree = computed(() => (menuStore.menuTree || []).map(toMenuNode).filter(Boolean) as MenuTreeNode[]);
const flatMenuNodes = computed(() => flattenMenuNodes(menuTree.value));
const currentRole = computed(() => roles.value.find((role) => role.id === activeRoleId.value) || null);
const currentMembers = computed<AccountRecord[]>(() => (
  currentRole.value
    ? accounts.value.filter((account) => (account.roles || [account.role]).includes(currentRole.value!.code))
    : []
));

const filteredRoles = computed(() => {
  const keyword = roleKeyword.value.trim().toLowerCase();
  if (!keyword) return roles.value;

  return roles.value.filter((role) => (
    role.name.toLowerCase().includes(keyword)
    || role.code.toLowerCase().includes(keyword)
    || role.description.toLowerCase().includes(keyword)
  ));
});

const internalRoles = computed(() => filteredRoles.value.filter((role) => builtInRoleCodes.has(role.code)));
const customRoles = computed(() => filteredRoles.value.filter((role) => !builtInRoleCodes.has(role.code)));

const dialogTitle = computed(() => (editingRoleId.value ? t('rolePage.dialog.editTitle') : t('rolePage.dialog.createTitle')));

/** 检查权限点是否在字典中被停用 */
function isPermissionDisabled(code: string): boolean {
  return permissionStore.registry.get(code)?.status === 'disabled';
}

/** 解析权限点的显示名称 */
function permissionLabel(code: string): string {
  return permissionStore.registry.get(code)?.name ?? code;
}

function dismissFocusGuide() {
  showFocusGuide.value = false;
  window.localStorage.setItem(focusGuideStorageKey, '1');
}

function toggleFocusMode() {
  isFocusMode.value = !isFocusMode.value;
  window.localStorage.setItem(focusModeStorageKey, isFocusMode.value ? 'focus' : 'standard');
  if (!isFocusMode.value) {
    dismissFocusGuide();
  }
}

const isDirty = computed(() => {
  const role = currentRole.value;
  if (!role) return false;

  return role.status !== draft.status
    || role.dataScope !== draft.dataScope
    || !sameStringSet(role.menuPaths, draft.menuPaths)
    || !sameStringSet(role.actionPermissions, draft.actionPermissions);
});

function cloneRole(role: RoleRecord): RoleRecord {
  return {
    ...role,
    menuPaths: [...role.menuPaths],
    actionPermissions: [...role.actionPermissions],
  };
}

function toMenuNode(item: PersistedMenuNode): MenuTreeNode | null {
  const nodeState = menuStore.registry.get(item.id);
  if (nodeState?.status === 'disabled' || item.status === 'disabled') {
    return null;
  }

  const children = (item.children || []).map(toMenuNode).filter(Boolean) as MenuTreeNode[];
  return {
    id: item.id,
    label: item.title,
    path: item.path,
    disabled: nodeState?.visible === 'hidden' || item.visible === 'hidden',
    children,
  };
}

function flattenMenuNodes(nodes: MenuTreeNode[]): MenuTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenMenuNodes(node.children || [])]);
}

function sameStringSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  return b.every((item) => aSet.has(item));
}

function toRoleSaveInput(role: RoleDraft): RoleSaveInput {
  const menuNodes = flattenMenuResources(menuStore.menuTree || []);
  const pathSet = new Set(role.menuPaths);
  const permissionSet = new Set(role.actionPermissions);
  return {
    ...role,
    menuIds: menuNodes.filter((menu) => pathSet.has(menu.path)).map((menu) => Number(menu.id)),
    permissionIds: menuNodes.flatMap((menu) => menu.buttonPermissions)
      .filter((permission) => permissionSet.has(permission.code))
      .map((permission) => Number(permission.id)),
  };
}

function statusTagType(status: RoleStatus) {
  return status === 'enabled' ? 'success' : 'neutral';
}

function loadDraft(role: RoleRecord | null) {
  draft.status = role?.status || 'enabled';
  draft.dataScope = role?.dataScope || 'department';
  draft.menuPaths = role ? [...role.menuPaths] : [];
  draft.actionPermissions = role ? [...role.actionPermissions] : [];
  syncMenuTree();
}

let menuTreeSyncRevision = 0;

async function syncMenuTree() {
  const revision = ++menuTreeSyncRevision;

  // 角色、菜单与 el-tree 分别异步就绪。等待组件完成数据 diff 和节点注册，
  // 并用 revision 丢弃快速切换角色时已经过期的回显任务。
  await nextTick();
  await nextTick();
  if (revision !== menuTreeSyncRevision || activeTab.value !== 'menu' || !flatMenuNodes.value.length) return;

  treeRef.value?.setCheckedKeys([...draft.menuPaths], false);
}

async function selectRole(role: RoleRecord) {
  if (role.id === activeRoleId.value) return;

  if (isDirty.value) {
    await ElMessageBox.confirm(t('rolePage.message.unsavedConfirm'), t('rolePage.message.switchTitle'), {
      type: 'warning',
      confirmButtonText: t('rolePage.message.continueSwitch'),
      cancelButtonText: t('rolePage.message.cancel'),
    });
  }

  activeRoleId.value = role.id;
}

function handleMenuCheck(_node: MenuTreeNode, state: { checkedKeys: Array<string | number> }) {
  draft.menuPaths = state.checkedKeys.map(String);
}

function checkAllMenus() {
  draft.menuPaths = flatMenuNodes.value.map((node) => node.path);
  syncMenuTree();
}

function clearMenus() {
  draft.menuPaths = [];
  syncMenuTree();
}

function expandAllMenus(expanded: boolean) {
  const nodes = treeRef.value?.store?.nodesMap || {};
  Object.values(nodes).forEach((node) => {
    node.expanded = expanded;
  });
}

function resetWorkspace() {
  loadDraft(currentRole.value);
  ElMessage.success(t('rolePage.message.resetSuccess'));
}

async function saveWorkspace() {
  const role = currentRole.value;
  if (!role) return;

  const draftRole: RoleDraft = {
    code: role.code,
    name: role.name,
    description: role.description,
    status: draft.status,
    dataScope: draft.dataScope,
    menuPaths: [...draft.menuPaths],
    actionPermissions: [...draft.actionPermissions],
  };

  const saved = await updateRoleApi(role.id, toRoleSaveInput(draftRole));
  roles.value = roles.value.map((item) => (item.id === saved.id ? saved : item));
  loadDraft(currentRole.value);
  await authStore.refreshAuthorization(true);
  ElMessage.success(t('rolePage.message.saveSuccess'));
}

function resetRoleForm() {
  editingRoleId.value = '';
  Object.assign(roleForm, {
    code: createBusinessCode('ROLE'),
    name: '',
    description: '',
    status: 'enabled',
    dataScope: 'department',
    menuPaths: [],
    actionPermissions: [],
  });
}

function openCreateDialog() {
  resetRoleForm();
  dialogVisible.value = true;
}

function openEditDialog(role: RoleRecord) {
  editingRoleId.value = role.id;
  Object.assign(roleForm, {
    code: role.code,
    name: role.name,
    description: role.description,
    status: role.status,
    dataScope: role.dataScope,
    menuPaths: [...role.menuPaths],
    actionPermissions: [...role.actionPermissions],
  });
  dialogVisible.value = true;
}

function normalizeCode(code: string) {
  return code.trim().replace(/\s+/g, '-').toUpperCase();
}

function isCodeDuplicated(code: string) {
  return roles.value.some((role) => role.code.toUpperCase() === code && role.id !== editingRoleId.value);
}

async function saveRole() {
  const code = normalizeCode(roleForm.code);

  if (!code || !roleForm.name.trim() || !roleForm.description.trim()) {
    ElMessage.warning(t('rolePage.message.fillRequired'));
    return;
  }

  if (isCodeDuplicated(code)) {
    ElMessage.warning(t('rolePage.message.codeDuplicate'));
    return;
  }

  savingRole.value = true;
  const nextRole: RoleDraft = {
    code,
    name: roleForm.name.trim(),
    description: roleForm.description.trim(),
    status: roleForm.status,
    dataScope: roleForm.dataScope,
    menuPaths: [...roleForm.menuPaths],
    actionPermissions: [...roleForm.actionPermissions],
  };

  try {
    if (editingRoleId.value) {
      const saved = await updateRoleApi(editingRoleId.value, toRoleSaveInput(nextRole));
      roles.value = roles.value.map((item) => (item.id === saved.id ? saved : item));
      activeRoleId.value = editingRoleId.value;
      await authStore.refreshAuthorization(true);
      ElMessage.success(t('rolePage.message.roleUpdated'));
    } else {
      const saved = await createRoleApi(toRoleSaveInput(nextRole));
      roles.value = [saved, ...roles.value];
      activeRoleId.value = saved.id;
      ElMessage.success(t('rolePage.message.roleCreated'));
    }

    dialogVisible.value = false;
    resetRoleForm();
  } finally {
    savingRole.value = false;
  }
}

async function duplicateRole() {
  const role = currentRole.value;
  if (!role) return;

  const copyCode = createBusinessCode('ROLE');
  const copyDraft: RoleDraft = {
    code: copyCode,
    name: t('rolePage.message.copySuffix', { name: role.name }),
    description: role.description,
    status: 'enabled',
    dataScope: role.dataScope,
    menuPaths: [...draft.menuPaths],
    actionPermissions: [...draft.actionPermissions],
  };

  const saved = await createRoleApi(toRoleSaveInput(copyDraft));
  roles.value = [saved, ...roles.value];
  activeRoleId.value = saved.id;
  ElMessage.success(t('rolePage.message.roleCopied'));
}

async function deleteCurrentRole() {
  const role = currentRole.value;
  if (!role) return;

  if (builtInRoleCodes.has(role.code)) {
    ElMessage.warning(t('rolePage.message.builtinDeleteDenied'));
    return;
  }

  if (currentMembers.value.length > 0) {
    ElMessage.warning(t('rolePage.message.memberDeleteDenied'));
    return;
  }

  await ElMessageBox.confirm(t('rolePage.message.deleteConfirm', { name: role.name }), t('rolePage.message.deleteTitle'), {
    type: 'warning',
    confirmButtonText: t('rolePage.message.delete'),
    cancelButtonText: t('rolePage.message.cancel'),
  });

  await deleteRoleApi(role.id);
  roles.value = roles.value.filter((item) => item.id !== role.id);
  activeRoleId.value = roles.value[0]?.id || '';
  ElMessage.success(t('rolePage.message.roleDeleted'));
}

watch(currentRole, (role) => {
  loadDraft(role);
}, { immediate: true });

watch(activeTab, () => {
  if (activeTab.value === 'menu') {
    syncMenuTree();
  }
});

watch(
  () => flatMenuNodes.value.map((node) => node.path).join('\u0000'),
  () => syncMenuTree(),
  { flush: 'post' },
);

watch(treeRef, (tree) => {
  if (tree) syncMenuTree();
}, { flush: 'post' });

async function loadPageData() {
  const previousRoleId = activeRoleId.value;
  const [menuTree, roleRows] = await Promise.all([
    fetchMenuTree(),
    fetchRoles(),
  ]);
  menuStore.replaceTree(menuTree);
  permissionStore.replaceBySource('menu-button', createPermissionEntriesFromMenuTree(menuTree));
  roles.value = roleRows;
  activeRoleId.value = previousRoleId && roleRows.some((role) => role.id === previousRoleId)
    ? previousRoleId
    : roleRows[0]?.id || '';
  const accountResult = await Promise.allSettled([
    fetchAllPages((page, pageSize) => fetchAccounts({ page, pageSize })),
  ]);
  if (accountResult[0].status === 'fulfilled') {
    accounts.value = accountResult[0].value;
  }
}

useActiveLocaleDataRefresh(loadPageData);
onMounted(async () => {
  try { await loadPageData(); } finally { loading.value = false; }
});
</script>

<template>
  <DsListPageShell :title="t('rolePage.focusBar.title')" :loading="loading" page-class="role-page">
    <template #primary-action>
      <el-button v-permission.preview="'platform:role:permission:create'" class="ds-list-page__primary-action" type="primary" :icon="Plus" @click="openCreateDialog">{{ t('rolePage.empty.createRole') }}</el-button>
    </template>

      <section class="role-workspace-shell" :class="{ 'is-focus': isFocusMode }">
        <header class="permission-focusbar">
          <div class="permission-focusbar__main">
            <strong>{{ t('rolePage.focusBar.title') }}</strong>
            <span>{{ t('rolePage.focusBar.description') }}</span>
          </div>
          <div class="permission-focusbar__guide">
            {{ isFocusMode ? t('rolePage.focusBar.guideFocusActive') : t('rolePage.focusBar.guideViewStandard') }}
          </div>
          <div class="permission-focusbar__actions">
            <el-tooltip :content="isFocusMode ? t('rolePage.focusBar.tooltipExitFocus') : t('rolePage.focusBar.tooltipEnterFocus')" placement="bottom">
              <button
                class="focus-mode-toggle"
                type="button"
                @click="toggleFocusMode"
              >
                <el-icon>
                  <Close v-if="isFocusMode" />
                  <FullScreen v-else />
                </el-icon>
                <span>{{ isFocusMode ? t('rolePage.focusBar.toggleExitFocus') : t('rolePage.focusBar.toggleEnterFocus') }}</span>
              </button>
            </el-tooltip>
          </div>
        </header>
        <div v-if="isFocusMode && showFocusGuide" class="focus-guide-mask">
          <section class="focus-guide-card" :aria-label="t('rolePage.focusGuide.eyebrow')">
            <button class="focus-guide-card__close" type="button" :aria-label="t('rolePage.focusGuide.gotIt')" @click="dismissFocusGuide">
              <el-icon><Close /></el-icon>
            </button>
            <span class="focus-guide-card__eyebrow">{{ t('rolePage.focusGuide.eyebrow') }}</span>
            <h3>{{ t('rolePage.focusGuide.title') }}</h3>
            <p>{{ t('rolePage.focusGuide.description') }}</p>
            <div class="focus-guide-card__actions">
              <el-button size="small" type="primary" @click="dismissFocusGuide">{{ t('rolePage.focusGuide.gotIt') }}</el-button>
            </div>
          </section>
        </div>
        <div class="role-workspace">
          <aside class="role-directory">
            <el-input
              v-model="roleKeyword"
              class="role-directory__search"
              clearable
              :placeholder="t('rolePage.searchPlaceholder')"
              :prefix-icon="Search"
            />

            <div v-if="filteredRoles.length" class="role-directory__list">
              <section v-if="internalRoles.length" class="role-directory__group">
                <h2>{{ t('rolePage.roleGroup.builtIn') }}</h2>
                <button
                  v-for="role in internalRoles"
                  :key="role.id"
                  class="role-card"
                  :class="{ 'is-active': role.id === activeRoleId }"
                  type="button"
                  @click="selectRole(role)"
                >
                  <span class="role-card__main">
                    <span class="role-card__name">{{ role.name }}</span>
                    <span class="role-card__code">{{ role.code }}</span>
                  </span>
                  <span class="role-card__meta">
                    <span>{{ role.userCount }}{{ t('rolePage.userCountSuffix') }}</span>
                    <DsTag size="small" :type="statusTagType(role.status)">{{ roleStatusLabels[role.status] }}</DsTag>
                  </span>
                </button>
              </section>

              <section v-if="customRoles.length" class="role-directory__group">
                <h2>{{ t('rolePage.roleGroup.custom') }}</h2>
                <button
                  v-for="role in customRoles"
                  :key="role.id"
                  class="role-card"
                  :class="{ 'is-active': role.id === activeRoleId }"
                  type="button"
                  @click="selectRole(role)"
                >
                  <span class="role-card__main">
                    <span class="role-card__name">{{ role.name }}</span>
                    <span class="role-card__code">{{ role.code }}</span>
                  </span>
                  <span class="role-card__meta">
                    <span>{{ role.userCount }}{{ t('rolePage.userCountSuffix') }}</span>
                    <DsTag size="small" :type="statusTagType(role.status)">{{ roleStatusLabels[role.status] }}</DsTag>
                  </span>
                </button>
              </section>
            </div>

            <DsEmpty v-else class="role-directory__empty" :description="t('rolePage.empty.noMatching')" :action-label="t('rolePage.empty.clearSearch')" @retry="roleKeyword = ''" />

            <footer class="role-directory__footer">
              <el-button v-permission.preview="'platform:role:permission:update'" :disabled="!currentRole" @click="currentRole && openEditDialog(currentRole)">{{ t('rolePage.footer.edit') }}</el-button>
              <el-button v-permission.preview="'platform:role:permission:create'" :icon="CopyDocument" :disabled="!currentRole" @click="duplicateRole">{{ t('rolePage.footer.copy') }}</el-button>
              <el-button v-permission="'platform:role:permission:delete'" :icon="Delete" :disabled="!currentRole" @click="deleteCurrentRole">{{ t('rolePage.footer.delete') }}</el-button>
            </footer>
          </aside>

          <section v-if="currentRole" class="role-config">
            <el-tabs v-model="activeTab" class="role-tabs">
              <el-tab-pane :label="t('rolePage.tab.menu')" name="menu">
                <div class="permission-layout">
                  <section class="permission-main">
                    <div class="permission-toolbar">
                      <el-button @click="expandAllMenus(true)">{{ t('rolePage.menu.expandAll') }}</el-button>
                      <el-button @click="expandAllMenus(false)">{{ t('rolePage.menu.collapseAll') }}</el-button>
                      <el-button v-permission.preview="'platform:role:permission:assign'" @click="checkAllMenus">{{ t('rolePage.menu.selectAll') }}</el-button>
                      <el-button v-permission.preview="'platform:role:permission:assign'" @click="clearMenus">{{ t('rolePage.menu.clearAll') }}</el-button>
                    </div>
                    <el-tree
                      ref="treeRef"
                      class="menu-permission-tree"
                      node-key="path"
                      :data="menuTree"
                      :default-checked-keys="draft.menuPaths"
                      show-checkbox
                      :props="{ label: 'label', children: 'children' }"
                      @check="handleMenuCheck"
                    />
                  </section>
                </div>
              </el-tab-pane>

              <el-tab-pane :label="t('rolePage.tab.action')" name="action">
                <div class="action-permission-list">
                  <section v-for="group in actionPermissionGroups" :key="group.title" class="action-section">
                    <header class="action-section__header">
                      <strong>{{ group.title }}</strong>
                      <span>{{ group.menuPath }}</span>
                    </header>
                    <el-checkbox-group v-model="draft.actionPermissions" class="action-section__rows">
                      <template v-for="permission in group.permissions" :key="permission">
                        <label
                          v-if="!isPermissionDisabled(permission)"
                          class="permission-row"
                        >
                          <el-checkbox :label="permission">
                            {{ permissionLabel(permission) }}
                          </el-checkbox>
                          <span>{{ permission }}</span>
                        </label>
                        <label v-else class="permission-row permission-row--disabled">
                          <el-checkbox :label="permission" :disabled="true">
                            <s>{{ permissionLabel(permission) }}</s>
                          </el-checkbox>
                          <span class="permission-row__hint">{{ t('rolePage.action.dictionaryDisabled') }}</span>
                        </label>
                      </template>
                    </el-checkbox-group>
                  </section>
                </div>
              </el-tab-pane>

              <el-tab-pane :label="t('rolePage.tab.data')" name="data">
                <el-radio-group v-model="draft.dataScope" class="data-scope-list">
                  <label v-for="option in dataScopeOptions" :key="option.value" class="data-scope-row">
                    <el-radio :label="option.value">
                      <span>{{ option.label }}</span>
                    </el-radio>
                    <small>{{ option.hint }}</small>
                  </label>
                </el-radio-group>
              </el-tab-pane>

              <el-tab-pane :label="t('rolePage.tab.members')" name="members">
                <div v-if="currentMembers.length" class="member-list">
                  <div v-for="member in currentMembers" :key="member.id" class="member-row">
                    <span class="member-row__avatar">{{ member.name.slice(0, 1) }}</span>
                    <span class="member-row__main">
                      <strong>{{ member.name }}</strong>
                      <small>{{ member.username }} · {{ member.department }}</small>
                    </span>
                    <DsTag size="small" :type="member.status === 'active' ? 'success' : 'neutral'">
                      {{ member.status === 'active' ? t('rolePage.member.statusActive') : t('rolePage.member.statusInactive') }}
                    </DsTag>
                  </div>
                </div>
                <DsEmpty v-else :description="t('rolePage.member.empty')" />
              </el-tab-pane>

            </el-tabs>
          </section>

          <section v-else class="role-config role-config--empty">
            <DsEmpty :description="t('rolePage.empty.noRole')" :action-label="t('rolePage.empty.createRole')" @retry="openCreateDialog" />
          </section>
        </div>

        <footer class="role-savebar">
          <div class="role-savebar__meta">
            <span>{{ t('rolePage.savebar.currentRoleLabel') }}{{ currentRole?.name || t('rolePage.savebar.notSelected') }}</span>
            <i :class="{ 'is-dirty': isDirty }" />
            <span>{{ isDirty ? t('rolePage.savebar.modified') : t('rolePage.savebar.unmodified') }}</span>
          </div>
          <div class="role-savebar__actions">
            <el-button :disabled="!isDirty" @click="resetWorkspace">{{ t('rolePage.savebar.cancel') }}</el-button>
            <el-button :icon="RefreshRight" :disabled="!isDirty" @click="resetWorkspace">{{ t('rolePage.savebar.reset') }}</el-button>
            <el-button v-permission="'platform:role:permission:assign'" type="primary" :disabled="!currentRole || !isDirty" @click="saveWorkspace">{{ t('rolePage.savebar.save') }}</el-button>
          </div>
        </footer>
      </section>

    <template #overlays>
      <el-dialog
        v-model="dialogVisible"
        class="role-dialog"
        :title="dialogTitle"
        width="680px"
        align-center
        destroy-on-close
      >
        <el-form class="role-form" label-position="top" @submit.prevent>
          <div class="role-form__grid">
            <el-form-item :label="t('rolePage.dialog.code')" required>
              <el-input v-model="roleForm.code" disabled />
            </el-form-item>
            <el-form-item :label="t('rolePage.dialog.name')" required>
              <el-input v-model="roleForm.name" maxlength="12" show-word-limit :placeholder="t('rolePage.dialog.namePlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('rolePage.dialog.status')">
              <el-radio-group v-model="roleForm.status">
                <el-radio-button label="enabled">{{ t('common.enabled') }}</el-radio-button>
                <el-radio-button label="disabled">{{ t('common.disabled') }}</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item :label="t('rolePage.dialog.dataScope')">
              <el-select v-model="roleForm.dataScope">
                <el-option v-for="item in dataScopeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item :label="t('rolePage.dialog.description')" required>
            <el-input v-model="roleForm.description" type="textarea" :rows="3" :placeholder="t('rolePage.dialog.descriptionPlaceholder')" />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="role-dialog__footer">
            <el-button @click="dialogVisible = false">{{ t('rolePage.dialog.cancel') }}</el-button>
            <el-button v-permission="editingRoleId ? 'platform:role:permission:update' : 'platform:role:permission:create'" type="primary" :loading="savingRole" @click="saveRole">{{ t('rolePage.dialog.save') }}</el-button>
          </div>
        </template>
      </el-dialog>
    </template>
  </DsListPageShell>
</template>

<style scoped>
.role-workspace-shell {
  position: relative;
  display: grid;
  height: var(--ds-list-workspace-h);
  grid-template-rows: auto minmax(0, 1fr) auto;
  margin: var(--ds-page-filter-py-top) var(--ds-page-inset) var(--space-6);
  overflow: hidden;
  --font-body: 13px;
  --line-body: 20px;
}

.role-workspace-shell.is-focus {
  position: fixed;
  z-index: 200;
  inset: var(--layout-topbar-height) 0 0;
  height: auto;
  margin: 0;
  border-width: 1px 0 0;
  border-radius: 0;
  background: var(--color-bg-surface);
  box-shadow: none;
}

.role-workspace-shell.is-focus .role-workspace {
  padding: 0 20px;
}

.role-workspace-shell.is-focus .permission-focusbar {
  min-height: 46px;
  padding: 0 20px;
  border-bottom: 1px solid var(--ds-list-divider);
  background: color-mix(in srgb, var(--color-bg-surface) 96%, var(--color-bg-muted));
}

.permission-focusbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  min-height: 34px;
  align-items: center;
  gap: var(--space-4);
  padding: 0 0 var(--space-2);
}

.permission-focusbar__main {
  display: none;
  min-width: 0;
  align-items: baseline;
  gap: var(--space-3);
}

.role-workspace-shell.is-focus .permission-focusbar__main {
  display: flex;
}

.permission-focusbar__main strong {
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
}

.permission-focusbar__main span,
.permission-focusbar__guide {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.permission-focusbar__guide {
  position: relative;
  padding-left: var(--space-3);
}

.permission-focusbar__guide::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary-500);
  content: '';
  transform: translateY(-50%);
}

.permission-focusbar__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.focus-mode-toggle {
  display: inline-flex;
  height: 30px;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-3);
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-caption);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}

.focus-mode-toggle:hover {
  border-color: color-mix(in srgb, var(--color-primary-500) 42%, var(--ds-list-divider));
  background: color-mix(in srgb, var(--color-primary-500) 8%, var(--color-bg-surface));
  color: var(--color-primary-600);
}

.focus-guide-mask {
  position: absolute;
  z-index: 5;
  inset: 46px 0 0;
  background: rgb(15 23 42 / 32%);
}

.focus-guide-card {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: min(320px, calc(100vw - 48px));
  padding: var(--space-4);
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  box-shadow: var(--shadow-panel);
}

.focus-guide-card::before {
  position: absolute;
  top: -7px;
  right: 44px;
  width: 12px;
  height: 12px;
  border-top: 1px solid var(--ds-list-divider);
  border-left: 1px solid var(--ds-list-divider);
  background: var(--color-bg-surface);
  content: '';
  transform: rotate(45deg);
}

.focus-guide-card__close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.focus-guide-card__close:hover {
  background: var(--color-bg-muted);
  color: var(--color-text-primary);
}

.focus-guide-card__eyebrow {
  display: inline-flex;
  align-items: center;
  color: var(--color-primary-600);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-caption);
}

.focus-guide-card h3 {
  margin: var(--space-2) var(--space-6) var(--space-2) 0;
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-body);
}

.focus-guide-card p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-body);
}

.focus-guide-card__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-3);
}

.role-workspace {
  display: grid;
  min-height: 0;
  grid-template-columns: var(--ds-master-pane-width) minmax(0, 1fr);
  border-top: 1px solid var(--ds-list-divider);
}

.role-directory {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: var(--space-4) var(--space-5) var(--space-4) 0;
  border-right: 1px solid var(--ds-list-divider);
}

.role-directory__search {
  margin-bottom: var(--space-3);
}

.role-directory__list {
  min-height: 0;
  overflow: auto;
  padding-right: var(--space-1);
}

.role-directory__group {
  display: grid;
  gap: var(--space-1);
}

.role-directory__group + .role-directory__group {
  margin-top: var(--space-4);
}

.role-directory__group h2 {
  margin: 0 0 var(--space-1);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-caption);
}

.role-card {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  min-height: 56px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
}

.role-card:hover,
.role-card.is-active {
  border-color: var(--ds-list-divider);
  background: var(--color-bg-muted);
}

.role-card__main {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.role-card__name,
.role-card__code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-card__name {
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-body);
}

.role-card__code,
.role-card__meta {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.role-card__meta {
  display: grid;
  justify-items: end;
  gap: 2px;
}

.role-directory__empty {
  align-self: center;
}

.role-directory__footer {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--ds-list-divider);
}

.role-directory__footer .el-button + .el-button {
  margin-left: 0;
}

.role-config {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr);
  padding: var(--space-4) 0 var(--space-4) var(--space-5);
}

.role-config--empty {
  place-items: center;
}

.role-tabs {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.role-tabs :deep(.el-tabs__header) {
  flex: 0 0 auto;
  margin: 0 0 var(--space-3);
}

.role-tabs :deep(.el-tabs__content) {
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.role-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: var(--ds-list-divider);
}

.role-tabs :deep(.el-tabs__item) {
  height: 34px;
  padding: 0 var(--space-5);
  color: var(--color-text-primary);
  font-size: var(--font-body);
  line-height: 34px;
}

.role-tabs :deep(.el-tabs__item.is-active) {
  color: var(--color-primary-500);
}

.role-tabs :deep(.el-tabs__active-bar) {
  background-color: var(--color-primary-500);
}

.role-tabs :deep(.el-tab-pane) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.permission-layout,
.action-permission-list,
.data-scope-list,
.member-list {
  height: 100%;
  min-height: 0;
}

.permission-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}

.permission-main,
.member-list {
  overflow: auto;
}

.permission-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.menu-permission-tree {
  padding-bottom: var(--space-4);
  color: var(--color-text-primary);
  background: transparent;
}

.menu-permission-tree :deep(.el-tree-node__content) {
  min-height: 24px;
}

.role-workspace :deep(.el-checkbox__input.is-checked .el-checkbox__inner),
.role-workspace :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner),
.role-workspace :deep(.el-radio__input.is-checked .el-radio__inner) {
  border-color: var(--color-primary-500);
  background-color: var(--color-primary-500);
}

.role-workspace :deep(.el-checkbox__input.is-checked + .el-checkbox__label),
.role-workspace :deep(.el-radio__input.is-checked + .el-radio__label) {
  color: var(--color-text-primary);
}

.permission-note {
  align-self: start;
  padding: var(--space-4);
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
}

.permission-note h3 {
  margin: 0 0 var(--space-3);
  color: var(--color-text-primary);
  font-size: var(--font-body);
  line-height: var(--line-body);
}

.permission-note ul {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding-left: 18px;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.action-permission-list {
  display: grid;
  align-content: start;
  gap: var(--space-3);
  overflow: auto;
  padding-right: var(--space-1);
  padding-bottom: var(--space-2);
}

.action-section {
  display: grid;
  align-content: start;
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
}

.action-section__header {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--ds-list-divider);
  background: var(--color-bg-muted);
}

.action-section__header strong {
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-body);
}

.action-section__header span {
  margin: 2px 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.action-section__rows {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.permission-row {
  display: grid;
  min-height: 38px;
  grid-template-columns: minmax(0, 1fr) minmax(120px, auto);
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  border-top: 1px solid color-mix(in srgb, var(--ds-list-divider) 62%, transparent);
}

.permission-row--disabled {
  color: var(--color-text-disabled);
}

.permission-row--disabled .el-checkbox__label s {
  color: var(--color-text-disabled);
}

.permission-row__hint {
  font-size: var(--font-small, 11px);
  color: var(--color-warning-500);
  text-align: right;
}

.permission-row:nth-child(1),
.permission-row:nth-child(2) {
  border-top: 0;
}

.permission-row :deep(.el-checkbox) {
  height: auto;
  margin-right: 0;
}

.permission-row > span {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-scope-list {
  display: grid;
  align-content: start;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-md);
}

.data-scope-row {
  display: grid;
  min-height: 52px;
  grid-template-columns: 180px minmax(0, 1fr);
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-4);
  border-top: 1px solid var(--ds-list-divider);
  cursor: pointer;
}

.data-scope-row:first-child {
  border-top: 0;
}

.data-scope-row:hover {
  background: var(--color-bg-muted);
}

.data-scope-row :deep(.el-radio) {
  height: auto;
  margin-right: 0;
  font-weight: var(--font-weight-semibold);
}

.data-scope-row small {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.member-list {
  display: grid;
  align-content: start;
  gap: var(--space-2);
}

.member-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-md);
}

.member-row__avatar {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  color: var(--color-white);
  background: var(--color-primary-500);
  font-weight: var(--font-weight-semibold);
}

.member-row__main {
  display: grid;
  min-width: 0;
}

.member-row__main strong,
.member-row__main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-row__main small {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.role-savebar {
  display: flex;
  min-height: var(--ds-table-footer-min-h);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0 0;
  border-top: 1px solid var(--ds-list-divider);
}

.role-workspace-shell.is-focus .role-savebar {
  padding: var(--space-3) 20px 0;
}

.role-savebar__meta,
.role-savebar__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.role-savebar__meta i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-disabled);
}

.role-savebar__meta i.is-dirty {
  background: var(--color-warning-default);
}

.role-savebar__actions .el-button + .el-button {
  margin-left: 0;
}

.role-form {
  display: grid;
  gap: var(--space-4);
}

.role-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-5);
}

.role-form :deep(.el-select) {
  width: 100%;
}

.role-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (max-width: 1180px) {
  .role-workspace {
    grid-template-columns: var(--ds-master-pane-width-compact) minmax(0, 1fr);
  }

  .permission-layout {
    grid-template-columns: 1fr;
  }

}

@media (max-width: 820px) {
  .role-workspace-shell {
    height: auto;
    min-height: var(--ds-list-workspace-h);
  }

  .role-workspace {
    grid-template-columns: 1fr;
  }

  .role-directory {
    border-right: 0;
    border-bottom: 1px solid var(--ds-list-divider);
  }

  .role-directory__list {
    max-height: 320px;
  }

  .role-form__grid,
  .action-section__rows,
  .data-scope-row {
    grid-template-columns: 1fr;
  }

  .role-savebar {
    align-items: stretch;
    flex-direction: column;
  }

  .role-savebar__actions {
    justify-content: flex-end;
  }
}

@media (max-width: 760px) {
  :global(.role-dialog) {
    width: calc(100vw - 32px) !important;
  }
}
</style>
