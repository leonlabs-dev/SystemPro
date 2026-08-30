<script setup lang="ts">
import { ArrowDown, Delete, Download, Key, Loading, Plus, RefreshRight, Search } from '@element-plus/icons-vue';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import DsBatchBar from '@/design-system/components/DsBatchBar.vue';
import DsDataTable, { type DsTableColumn } from '@/design-system/components/DsDataTable.vue';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsTableDensityToggle from '@/design-system/components/DsTableDensityToggle.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useListPageState } from '@/design-system/composables/useListPageState';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';
import {
  type AccountDraft,
  type AccountRecord,
  type AccountRole,
  type AccountStatus,
} from '@/domain/platform/user-permission';
import {
  batchDeleteAccounts as batchDeleteAccountsApi,
  batchUpdateAccountStatus as batchUpdateAccountStatusApi,
  createAccount as createAccountApi,
  deleteAccount as deleteAccountApi,
  fetchAccounts,
  fetchAccountLoginLogs,
  fetchAccountRoleOptions,
  resetAccountPassword,
  type AccountLoginLog,
  type AccountSaveInput,
  updateAccount as updateAccountApi,
  updateAccountStatus as updateAccountStatusApi,
} from '@/domain/platform/user-permission/api/account.api';
import { useOrgStore } from '@/core/org/org.store';
import { useActiveLocaleDataRefresh } from '@/core/i18n/use-active-locale-data-refresh';
import { useAuthStore } from '@/core/auth/auth.store';
import { queryPositionsByOrg, type Position } from '@/domain/platform/org';
import { fetchPositions } from '@/domain/platform/org/api/position.api';

type AccountForm = AccountDraft & {
  id?: string;
  password?: string;
};

const orgStore = useOrgStore();
const authStore = useAuthStore();
const { t, te } = useI18n();
const runtimeSettings = useRuntimeSettingsStore();
const positions = ref<Position[]>([]);

const roleOptions = ref<Array<{ label: string; value: AccountRole }>>([]);

function defaultRoleValue(): AccountRole {
  return roleOptions.value.find((item) => item.value === 'user')?.value
    || roleOptions.value.find((item) => item.value !== 'admin')?.value
    || roleOptions.value[0]?.value
    || '';
}

const statusOptions = computed<Array<{ label: string; value: AccountStatus }>>(() => [
  { label: t('business.accountStatus.active'), value: 'active' },
  { label: t('business.accountStatus.disabled'), value: 'disabled' },
  { label: t('business.accountStatus.pending'), value: 'pending' },
  { label: t('business.accountStatus.locked'), value: 'locked' },
]);

const columns = computed<DsTableColumn[]>(() => [
  { prop: 'account', label: t('accountPage.columns.account'), minWidth: 170, slot: 'account' },
  { prop: 'name', label: t('accountPage.columns.name'), minWidth: 80, showOverflowTooltip: true },
  { prop: 'role', label: t('accountPage.columns.role'), minWidth: 100, slot: 'role' },
  { prop: 'department', label: t('accountPage.columns.department'), minWidth: 110, slot: 'department', showOverflowTooltip: true },
  { prop: 'position', label: t('accountPage.columns.position'), minWidth: 100, slot: 'position', showOverflowTooltip: true },
  { prop: 'status', label: t('accountPage.columns.status'), minWidth: 80, slot: 'status' },
  { prop: 'lastLoginAt', label: t('accountPage.columns.lastLoginAt'), minWidth: 126, slot: 'lastLoginAt' },
  { prop: 'createdAt', label: t('accountPage.columns.createdAt'), minWidth: 126, showOverflowTooltip: true },
]);

const accounts = ref<AccountRecord[]>([]);
const total = ref(0);
const loading = ref(true);
const resetting = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref('');
const loginLogVisible = ref(false);
const loginLogLoading = ref(false);
const loginLogAccount = ref<AccountRecord | null>(null);
const loginLogs = ref<AccountLoginLog[]>([]);
const loginLogPage = ref(1);
const loginLogPageSize = ref(runtimeSettings.pageSize);
const loginLogTotal = ref(0);
const secondaryActionLoadingId = ref('');
let loginLogRequestVersion = 0;
let loginLogLoadTimer: number | undefined;

const filters = reactive<{
  keyword: string;
  status: AccountStatus | '';
  role: AccountRole | '';
  orgNodeId: string;
  createdRange?: [string, string];
}>({
  keyword: '',
  status: '',
  role: '',
  orgNodeId: '',
  createdRange: undefined,
});

const form = reactive<AccountForm>({
  username: '',
  email: '',
  name: '',
  role: '',
  department: '',
  orgNodeId: '',
  positionId: '',
  status: 'active',
  password: '',
});

const orgDepartments = computed(() => orgStore.enabledOrgs.map((org) => ({
  label: org.name,
  value: org.id,
})));
const availablePositions = computed(() => {
  if (!form.orgNodeId) return [];
  return queryPositionsByOrg(positions.value, form.orgNodeId)
    .filter((p) => p.status === 'enabled')
    .map((p) => ({ label: p.name, value: p.id }));
});

const dialogTitle = computed(() => (editingId.value ? t('accountPage.editAccount') : t('accountPage.newAccount')));

const filteredRows = computed(() => accounts.value);

const {
  page,
  pageSize,
  selectedRows,
  selectedCount,
  tableRows,
  updateSelected,
  clearSelectedRows,
} = useListPageState<AccountRecord>({
  rows: filteredRows,
  server: true,
});

function roleTagType(role?: AccountRole) {
  const map: Record<string, 'primary' | 'info' | 'warning' | 'neutral'> = {
    admin: 'primary',
    ops: 'info',
    analyst: 'primary',
    finance: 'warning',
    user: 'neutral',
  };
  return role ? map[role] || 'neutral' : 'neutral';
}

function roleLabel(role?: AccountRole) {
  if (!role) return '—';
  const label = roleOptions.value.find((item) => item.value === role)?.label;
  if (label) return label;
  const tKey = `accountPage.roles.${role}`;
  return te(tKey) ? t(tKey) : role;
}

function statusTagType(status?: AccountStatus) {
  const map: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
    active: 'success',
    pending: 'warning',
    disabled: 'error',
    locked: 'neutral',
  };
  return status ? map[status] || 'neutral' : 'neutral';
}

function statusLabel(status?: AccountStatus) {
  if (!status) return '—';
  const tKey = `business.accountStatus.${status}`;
  return te(tKey) ? t(tKey) : status;
}

function initials(account: AccountRecord) {
  const source = account.username.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (!source) {
    return account.name.slice(0, 1);
  }

  return source.length <= 3 ? source : source.slice(0, 2);
}

function avatarStyle(account: AccountRecord) {
  const palette = ['#5B7FA5', '#6A859C', '#4A6D8C', '#7A8FA0', '#4F7396', '#5C829E'];
  const index = account.username.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return { background: palette[index] };
}

function secondaryActionLabel(account: AccountRecord) {
  if (account.status === 'disabled') return t('accountPage.enable');
  if (account.status === 'pending') return t('accountPage.activateAndReset');
  if (account.status === 'locked') return t('accountPage.unlock');
  return t('accountPage.resetPassword');
}

function secondaryActionPermission(account: AccountRecord) {
  return ['disabled', 'locked'].includes(account.status)
    ? 'platform:account:list:disable'
    : 'platform:account:list:reset-password';
}

function resetForm() {
  editingId.value = '';
  Object.assign(form, {
    id: undefined,
    username: '',
    email: '',
    name: '',
    role: defaultRoleValue(),
    department: '',
    orgNodeId: '',
    positionId: '',
    status: 'active',
    password: '',
  });
}

function openCreateDialog() {
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(account: AccountRecord) {
  editingId.value = account.id;
  Object.assign(form, {
    id: account.id,
    username: account.username,
    email: account.email,
    name: account.name,
    role: account.role,
    department: account.department,
    orgNodeId: account.orgNodeId,
    positionId: account.positionId,
    status: account.status,
    password: '',
  });
  dialogVisible.value = true;
}

async function saveAccount() {
  if (!form.username || !form.name || !form.role || !form.orgNodeId) {
    ElMessage.warning(t('accountPage.fillRequired'));
    return;
  }

  // 从 orgStore 同步部门名称快照
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    ElMessage.warning(t('accountPage.invalidEmail'));
    return;
  }

  const username = form.username.trim();
  const displayName = form.name.trim();
  if (username.length < 3 || username.length > 12) {
    ElMessage.warning(t('accountPage.usernameLength'));
    return;
  }
  if (displayName.length > 12) {
    ElMessage.warning(t('accountPage.nameLength'));
    return;
  }

  const org = orgStore.findNode(form.orgNodeId);
  const displayDept = org?.name || '';
  const displayPos = positions.value.find((p) => p.id === form.positionId)?.name || '';

  saving.value = true;
  try {
    const defaultTenantId = authStore.account?.defaultTenantId ?? authStore.userContext?.tenantId;
    if (!defaultTenantId) {
      ElMessage.error(t('accountPage.noDefaultTenant'));
      return;
    }
    const payload: AccountSaveInput = {
      username,
      email: form.email,
      name: displayName,
      role: form.role,
      department: displayDept,
      orgNodeId: form.orgNodeId,
      positionId: form.positionId,
      status: form.status,
      defaultTenantId,
    };
    if (editingId.value) {
      const saved = await updateAccountApi(editingId.value, { ...payload, password: form.password });
      if (Number(saved.id) === authStore.account?.id) {
        await authStore.refreshAuthorization(true);
      }
      ElMessage.success(t('accountPage.accountUpdated'));
    } else {
      if (!form.password || form.password.length < 8) {
        ElMessage.warning(t('accountPage.passwordMinLength'));
        return;
      }
      await createAccountApi({ ...payload, password: form.password });
      ElMessage.success(t('accountPage.accountCreated'));
    }
    dialogVisible.value = false;
    resetForm();
    await loadAccounts();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('accountPage.saveFailed'));
  } finally {
    saving.value = false;
  }
}

async function loadLoginLogs() {
  const accountId = loginLogAccount.value?.id;
  if (!accountId) return;
  const requestVersion = ++loginLogRequestVersion;
  loginLogLoading.value = true;
  try {
    const result = await fetchAccountLoginLogs(accountId, loginLogPage.value, loginLogPageSize.value);
    if (requestVersion !== loginLogRequestVersion || loginLogAccount.value?.id !== accountId) return;
    loginLogs.value = result.items;
    loginLogTotal.value = result.total;
  } finally {
    if (requestVersion === loginLogRequestVersion) loginLogLoading.value = false;
  }
}

async function openLoginLogs(account: AccountRecord) {
  loginLogRequestVersion += 1;
  loginLogAccount.value = account;
  loginLogPage.value = 1;
  loginLogPageSize.value = runtimeSettings.pageSize;
  loginLogTotal.value = 0;
  loginLogs.value = [];
  loginLogVisible.value = true;
  await loadLoginLogs();
}

function scheduleLoginLogLoad() {
  window.clearTimeout(loginLogLoadTimer);
  loginLogLoadTimer = window.setTimeout(() => {
    if (loginLogVisible.value) void loadLoginLogs();
  }, 0);
}

function changeLoginLogPage(nextPage: number) {
  if (loginLogPage.value === nextPage) return;
  loginLogPage.value = nextPage;
  scheduleLoginLogLoad();
}

function changeLoginLogPageSize(nextPageSize: number) {
  if (loginLogPageSize.value === nextPageSize) return;
  loginLogPageSize.value = nextPageSize;
  loginLogPage.value = 1;
  scheduleLoginLogLoad();
}

function loginResultLabel(result: AccountLoginLog['result']) {
  return result === 'SUCCESS' ? t('accountPage.success') : t('accountPage.failure');
}

async function updateAccountStatus(account: AccountRecord, status: AccountStatus) {
  await updateAccountStatusApi(account.id, status);
  await loadAccounts();
  ElMessage.success(status === 'active' ? t('accountPage.accountEnabled') : t('accountPage.accountDisabled'));
}

async function runSecondaryAction(account: AccountRecord) {
  if (account.status === 'disabled' || account.status === 'locked') {
    secondaryActionLoadingId.value = account.id;
    try {
      await updateAccountStatus(account, 'active');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : t('accountPage.enableAccountFailed'));
    } finally {
      secondaryActionLoadingId.value = '';
    }
    return;
  }

  const pending = account.status === 'pending';
  let temporaryPassword = '';
  try {
    const result = await ElMessageBox.prompt(
      pending
        ? t('accountPage.confirmActivateAndReset', { name: account.username })
        : t('accountPage.confirmResetPassword', { name: account.username }),
      pending ? t('accountPage.activateAndResetTitle') : t('accountPage.resetPasswordTitle'),
      {
        type: 'warning',
        inputType: 'password',
        inputPlaceholder: t('accountPage.resetPasswordPlaceholder'),
        inputPattern: /^.{8,}$/,
        inputErrorMessage: t('accountPage.passwordMinLength'),
        confirmButtonText: t('accountPage.confirmReset'),
        cancelButtonText: t('accountPage.cancel'),
      },
    );
    temporaryPassword = result.value;
  } catch {
    return;
  }
  secondaryActionLoadingId.value = account.id;
  try {
    await resetAccountPassword(account.id, temporaryPassword);
    if (pending) await updateAccountStatus(account, 'active');
    ElMessage.success(t('accountPage.passwordResetSuccess'));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('accountPage.passwordResetFailed'));
  } finally {
    secondaryActionLoadingId.value = '';
  }
}

async function batchSetStatus(status: AccountStatus) {
  if (!selectedRows.value.length) {
    ElMessage.warning(t('accountPage.selectAccountFirst'));
    return;
  }

  const ids = selectedRows.value.map((item) => item.id);
  await batchUpdateAccountStatusApi(ids, status);
  clearSelectedRows();
  await loadAccounts();
  ElMessage.success(status === 'active' ? t('accountPage.batchEnabled') : t('accountPage.batchDisabled'));
}

async function deleteAccount(account: AccountRecord) {
  await ElMessageBox.confirm(t('accountPage.confirmDelete', { name: account.username }), t('accountPage.deleteTitle'), {
    type: 'warning',
    confirmButtonText: t('accountPage.delete'),
    cancelButtonText: t('accountPage.cancel'),
  });
  await deleteAccountApi(account.id);
  await loadAccounts();
  ElMessage.success(t('accountPage.accountDeleted'));
}

async function batchDelete() {
  if (!selectedRows.value.length) {
    ElMessage.warning(t('accountPage.selectAccountFirst'));
    return;
  }

  await ElMessageBox.confirm(t('accountPage.confirmBatchDelete', { count: selectedRows.value.length }), t('accountPage.batchDeleteTitle'), {
    type: 'warning',
    confirmButtonText: t('accountPage.delete'),
    cancelButtonText: t('accountPage.cancel'),
  });
  const ids = selectedRows.value.map((item) => item.id);
  await batchDeleteAccountsApi(ids);
  clearSelectedRows();
  await loadAccounts();
  ElMessage.success(t('accountPage.batchDeleted'));
}

async function resetFilters() {
  resetting.value = true;
  try {
  filters.keyword = '';
  filters.status = '';
  filters.role = '';
  filters.orgNodeId = '';
  filters.createdRange = undefined;
  await nextTick();
  } finally {
    resetting.value = false;
  }
}

async function loadAccounts() {
  loading.value = true;
  try {
    const accountPage = await fetchAccounts({
      keyword: filters.keyword.trim(), status: filters.status, role: filters.role,
      orgNodeId: filters.orgNodeId,
      createdFrom: filters.createdRange?.[0], createdTo: filters.createdRange?.[1],
      page: page.value, pageSize: pageSize.value,
    });
    accounts.value = accountPage.items;
    total.value = accountPage.total;
    const maxPage = Math.max(1, Math.ceil(accountPage.total / pageSize.value));
    if (page.value > maxPage) page.value = maxPage;
  } finally {
    loading.value = false;
  }
}

async function loadPageData() {
  loading.value = true;
  try {
    const [orgResult, positionResult, roleResult] = await Promise.allSettled([
      orgStore.load(),
      fetchPositions(),
      fetchAccountRoleOptions(),
    ]);
    if (orgResult.status === 'rejected') {
      throw orgResult.reason;
    }
    if (positionResult.status === 'fulfilled') {
      positions.value = positionResult.value;
    }
    if (roleResult.status === 'fulfilled') {
      roleOptions.value = roleResult.value.map((role) => ({
        label: role.name,
        value: role.code.toLowerCase(),
      }));
      if (!roleOptions.value.some((item) => item.value === form.role)) {
        form.role = defaultRoleValue();
      }
    }
    const accountPage = await fetchAccounts({
      keyword: filters.keyword.trim(), status: filters.status, role: filters.role,
      orgNodeId: filters.orgNodeId,
      createdFrom: filters.createdRange?.[0], createdTo: filters.createdRange?.[1],
      page: page.value, pageSize: pageSize.value,
    });
    accounts.value = accountPage.items;
    total.value = accountPage.total;
  } finally {
    loading.value = false;
  }
}

let loadTimer: number | undefined;
const ready = ref(false);
function scheduleLoad() {
  if (!ready.value) return;
  window.clearTimeout(loadTimer);
  loadTimer = window.setTimeout(() => { void loadAccounts(); }, 220);
}
watch(() => [filters.keyword, filters.status, filters.role, filters.orgNodeId, filters.createdRange?.join(',')], () => {
  if (page.value !== 1) page.value = 1;
  else scheduleLoad();
});
watch([page, pageSize], scheduleLoad);
useActiveLocaleDataRefresh(loadPageData);
onMounted(async () => { await loadPageData(); ready.value = true; });
</script>

<template>
  <DsListPageShell :title="$t('accountPage.title')" :loading="loading" page-class="account-page">
    <template #header-extra>
      <DsTableDensityToggle />
    </template>
    <template #primary-action>
      <el-button v-permission.preview="'platform:account:list:create'" class="ds-list-page__primary-action" type="primary" :icon="Plus" @click="openCreateDialog">{{ $t('accountPage.newAccount') }}</el-button>
    </template>

      <div class="account-filter ds-list-filter ds-list-filter--adaptive" :aria-label="$t('accountPage.title')">
        <el-input
          v-model="filters.keyword"
          class="ds-list-filter__keyword"
          clearable
          :placeholder="$t('accountPage.searchPlaceholder')"
          :prefix-icon="Search"
        />
        <el-select v-model="filters.status" class="ds-list-filter__select ds-list-filter__select--short" clearable :placeholder="$t('accountPage.statusPlaceholder')">
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.role" class="ds-list-filter__select" clearable :placeholder="$t('accountPage.rolePlaceholder')">
          <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.orgNodeId" class="ds-list-filter__select" clearable :placeholder="$t('accountPage.departmentPlaceholder')">
          <el-option v-for="org in orgStore.enabledOrgs" :key="org.id" :label="org.name" :value="org.id" />
        </el-select>
        <el-date-picker
          v-model="filters.createdRange"
          class="ds-list-filter__date"
          type="daterange"
          placement="bottom-end"
          popper-class="account-date-range-popper"
          :range-separator="$t('accountPage.dateRangeSeparator')"
          :start-placeholder="$t('accountPage.startDate')"
          :end-placeholder="$t('accountPage.endDate')"
          value-format="YYYY-MM-DD"
          :clearable="true"
        />
        <span class="ds-list-filter__spacer" aria-hidden="true" />
        <div class="ds-list-filter__actions">
          <el-button class="ds-list-filter__button" :icon="RefreshRight" :loading="resetting" :disabled="resetting" @click="resetFilters">{{ $t('accountPage.reset') }}</el-button>
          <el-button v-permission="'platform:account:list:export'" class="ds-list-filter__button" :icon="Download">{{ $t('accountPage.export') }}</el-button>
        </div>
      </div>

      <section class="ds-list-table-shell">
        <DsDataTable
          row-key="id"
          :rows="tableRows"
          :columns="columns"
          :loading="loading"
          selectable
          :action-title="$t('accountPage.operation')"
          :action-width="208"
          @selection-change="updateSelected"
        >
          <template #account="{ row }">
            <div class="account-cell">
              <span class="account-cell__avatar" :style="avatarStyle(row as AccountRecord)">
                {{ initials(row as AccountRecord) }}
              </span>
              <span class="account-cell__meta">
                <el-tooltip :content="(row as AccountRecord).username" placement="top" :show-after="400">
                  <button class="account-cell__name" type="button" @click="openEditDialog(row as AccountRecord)">
                    {{ (row as AccountRecord).username }}
                  </button>
                </el-tooltip>
                <el-tooltip :content="(row as AccountRecord).email" placement="top" :show-after="250">
                  <span class="account-cell__email">{{ (row as AccountRecord).email }}</span>
                </el-tooltip>
              </span>
            </div>
          </template>
          <template #role="{ row }">
            <DsTag size="small" :type="roleTagType((row as AccountRecord).role)">
              {{ roleLabel((row as AccountRecord).role) }}
            </DsTag>
          </template>
          <template #department="{ row }">
            <span>{{ orgStore.byId.get((row as AccountRecord).orgNodeId)?.name || (row as AccountRecord).department || '—' }}</span>
          </template>
          <template #position="{ row }">
            <span>{{ positions.find((p) => p.id === (row as AccountRecord).positionId)?.name || '—' }}</span>
          </template>
          <template #status="{ row }">
            <DsTag size="small" :type="statusTagType((row as AccountRecord).status)" dot>
              {{ statusLabel((row as AccountRecord).status) }}
            </DsTag>
          </template>
          <template #lastLoginAt="{ row }">
            <span class="text-muted">{{ (row as AccountRecord).lastLoginAt || '—' }}</span>
          </template>
          <template #actions="{ row }">
            <div class="row-actions">
              <button v-permission.preview="'platform:account:list:update'" type="button" @click="openEditDialog(row as AccountRecord)">{{ $t('accountPage.edit') }}</button>
              <button
                v-permission="secondaryActionPermission(row as AccountRecord)"
                type="button"
                :disabled="secondaryActionLoadingId === (row as AccountRecord).id"
                @click="runSecondaryAction(row as AccountRecord)"
              >
                <el-icon v-if="secondaryActionLoadingId === (row as AccountRecord).id" class="is-loading"><Loading /></el-icon>
                {{ secondaryActionLabel(row as AccountRecord) }}
              </button>
              <el-dropdown trigger="click">
                <button class="row-actions__more" type="button" :aria-label="$t('accountPage.more')">
                  <span>{{ $t('accountPage.more') }}</span>
                  <el-icon><ArrowDown /></el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :icon="Key" @click="openLoginLogs(row as AccountRecord)">{{ $t('accountPage.viewLoginLogs') }}</el-dropdown-item>
                    <el-dropdown-item v-if="authStore.canShow('platform:account:list:delete')" :disabled="!authStore.can('platform:account:list:delete')" :icon="Delete" @click="deleteAccount(row as AccountRecord)">{{ $t('accountPage.deleteAccount') }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
          <template #empty>
            <DsEmpty :description="$t('accountPage.empty')" :action-label="$t('accountPage.clearFilter')" @retry="resetFilters" />
          </template>
        </DsDataTable>

        <footer class="ds-list-table-footer">
          <DsBatchBar :selected-count="selectedCount">
            <el-button v-permission="'platform:account:list:disable'" :disabled="!selectedCount" @click="batchSetStatus('active')">{{ $t('accountPage.batchEnable') }}</el-button>
            <el-button v-permission="'platform:account:list:disable'" :disabled="!selectedCount" @click="batchSetStatus('disabled')">{{ $t('accountPage.batchDisable') }}</el-button>
            <el-button v-permission="'platform:account:list:delete'" :disabled="!selectedCount" type="danger" plain @click="batchDelete">{{ $t('accountPage.batchDelete') }}</el-button>
          </DsBatchBar>
          <DsPagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :total="total"
          />
        </footer>
      </section>
    <template #overlays>
      <el-dialog
        v-model="dialogVisible"
        class="account-dialog"
        :title="dialogTitle"
        width="640px"
        align-center
        destroy-on-close
      >
        <el-form class="account-form" label-position="top" autocomplete="off" @submit.prevent>
          <div class="account-form__grid">
            <el-form-item :label="$t('accountPage.form.accountLabel')" required>
              <el-input v-model="form.username" name="managed-account-username" autocomplete="off" maxlength="12" show-word-limit :placeholder="$t('accountPage.form.accountPlaceholder')" />
            </el-form-item>
            <el-form-item :label="$t('accountPage.form.nameLabel')" required>
              <el-input v-model="form.name" maxlength="12" show-word-limit :placeholder="$t('accountPage.form.namePlaceholder')" />
            </el-form-item>
            <el-form-item :label="$t('accountPage.form.emailLabel')">
              <el-input v-model="form.email" name="managed-account-email" autocomplete="off" :placeholder="$t('accountPage.form.emailPlaceholder')" />
            </el-form-item>
            <el-form-item v-if="!editingId" :label="$t('accountPage.form.passwordLabel')" required>
              <el-input v-model="form.password" name="managed-account-new-password" autocomplete="new-password" type="password" show-password :placeholder="$t('accountPage.form.passwordPlaceholder')" />
            </el-form-item>
            <el-form-item :label="$t('accountPage.form.roleLabel')" required>
              <el-select v-model="form.role" :placeholder="$t('accountPage.form.rolePlaceholder')">
                <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item :label="$t('accountPage.form.departmentLabel')" required>
              <el-select v-model="form.orgNodeId" filterable :placeholder="$t('accountPage.form.departmentPlaceholder')" @change="form.positionId = ''">
                <el-option
                  v-for="org in orgStore.leafNodes"
                  :key="org.id"
                  :label="org.name"
                  :value="org.id"
                  :disabled="org.status === 'disabled'"
                >
                  <span>{{ org.name }}</span>
                  <DsTag v-if="org.status === 'disabled'" size="small" type="neutral" style="margin-left:8px">{{ $t('accountPage.disabledTag') }}</DsTag>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item :label="$t('accountPage.form.positionLabel')">
              <el-select v-model="form.positionId" clearable :placeholder="$t('accountPage.form.positionPlaceholder')" :disabled="!form.orgNodeId">
                <el-option
                  v-for="pos in availablePositions"
                  :key="pos.value"
                  :label="pos.label"
                  :value="pos.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="$t('accountPage.form.statusLabel')">
              <el-radio-group v-model="form.status">
                <el-radio-button v-for="item in statusOptions" :key="item.value" :label="item.value">
                  {{ item.label }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
          </div>
        </el-form>
        <template #footer>
          <div class="account-dialog__footer">
            <el-button @click="dialogVisible = false">{{ $t('accountPage.cancel') }}</el-button>
            <el-button v-permission="editingId ? 'platform:account:list:update' : 'platform:account:list:create'" type="primary" :loading="saving" @click="saveAccount">{{ $t('accountPage.save') }}</el-button>
          </div>
        </template>
      </el-dialog>

      <el-dialog
        v-model="loginLogVisible"
        class="account-login-log-dialog"
        :title="$t('accountPage.loginLogTitle', { name: loginLogAccount?.username || '' })"
        width="min(1080px, calc(100vw - 32px))"
        align-center
        destroy-on-close
      >
        <div v-loading="loginLogLoading" class="login-log-content">
          <el-table v-if="loginLogs.length" :data="loginLogs" table-layout="fixed">
            <el-table-column :label="$t('accountPage.loginTime')" width="166">
              <template #default="{ row }">{{ row.occurredAt.replace('T', ' ').slice(0, 19) }}</template>
            </el-table-column>
            <el-table-column :label="$t('accountPage.result')" width="90">
              <template #default="{ row }">
                <DsTag size="small" :type="row.result === 'SUCCESS' ? 'success' : 'error'">
                  {{ loginResultLabel(row.result) }}
                </DsTag>
              </template>
            </el-table-column>
            <el-table-column prop="ipAddress" :label="$t('accountPage.ipAddress')" width="132" show-overflow-tooltip />
            <el-table-column :label="$t('accountPage.loginCity')" min-width="210" show-overflow-tooltip>
              <template #default="{ row }"><span class="login-location-cell">{{ [row.ipCountry, row.ipRegion, row.ipCity].filter(Boolean).join(' / ') || (['127.0.0.1', '::1'].includes(row.ipAddress) ? $t('accountPage.localDevice') : $t('accountPage.unknown')) }}</span></template>
            </el-table-column>
            <el-table-column prop="userAgent" :label="$t('accountPage.client')" min-width="230" show-overflow-tooltip />
            <el-table-column prop="failureCode" :label="$t('accountPage.failureReason')" width="150" show-overflow-tooltip />
          </el-table>
          <DsEmpty v-else-if="!loginLogLoading" :description="$t('accountPage.loginLogEmpty')" />
        </div>
        <template #footer>
          <div class="login-log-dialog__footer">
            <DsPagination
              v-if="loginLogTotal"
              :page="loginLogPage"
              :page-size="loginLogPageSize"
              :total="loginLogTotal"
              @update:page="changeLoginLogPage"
              @update:page-size="changeLoginLogPageSize"
            />
            <el-button @click="loginLogVisible = false">{{ $t('accountPage.close') }}</el-button>
          </div>
        </template>
      </el-dialog>
    </template>
  </DsListPageShell>
</template>

<style scoped>
:global(.account-page) {
  --ds-filter-keyword-width: 300px;
  --ds-filter-select-short-width: 112px;
  --ds-filter-select-width: 140px;
  --ds-filter-date-width: 280px;
}

.account-filter > .ds-list-filter__keyword {
  flex-basis: 240px;
}

.account-filter .ds-list-filter__actions {
  min-height: var(--ds-control-h);
  flex-wrap: nowrap;
}

:global(.account-date-range-popper.el-picker__popper) {
  width: min(646px, calc(100vw - 32px));
}

:global(.account-date-range-popper .el-picker-panel__body-wrapper),
:global(.account-date-range-popper .el-picker-panel__body) {
  width: 100%;
}

:global(.account-date-range-popper .el-date-range-picker__content) {
  box-sizing: border-box;
}

.account-cell {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-2);
}

.account-cell__avatar {
  display: grid;
  width: var(--ds-avatar-size, 30px);
  height: var(--ds-avatar-size, 30px);
  flex: 0 0 auto;
  place-items: center;
  color: var(--color-white);
  border-radius: 50%;
  font-size: var(--ds-avatar-font, var(--font-caption));
  font-weight: var(--font-weight-bold);
  letter-spacing: 0;
}

.account-cell__meta {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.account-cell__name {
  max-width: 150px;
  padding: 0;
  overflow: hidden;
  color: var(--color-primary-500);
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: var(--ds-datatable-font);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-caption);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-cell__name:hover {
  color: var(--color-primary-600);
}

.account-cell__email,
.text-muted {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
  white-space: nowrap;
}

.row-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0;
  color: var(--color-primary-500);
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: var(--ds-datatable-font);
  line-height: var(--line-body);
}

.row-actions button:hover {
  color: var(--color-primary-600);
}

.row-actions__more {
  gap: var(--space-1);
}

.account-form {
  display: grid;
  gap: var(--space-4);
}

.account-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-5);
}

.account-form :deep(.el-select) {
  width: 100%;
}

.account-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.login-location-cell {
  display: block;
  min-width: 0;
  overflow: hidden;
  word-break: keep-all;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.login-log-content {
  min-height: 260px;
  max-height: min(58vh, 520px);
  overflow: auto;
}

:global(.account-login-log-dialog.el-dialog) {
  max-height: 82vh;
  display: flex;
  flex-direction: column;
}

:global(.account-login-log-dialog .el-dialog__body) {
  min-height: 0;
  overflow: hidden;
}

.login-log-content :deep(.ds-empty) {
  min-height: 260px;
}

.login-log-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.login-log-dialog__footer :deep(.ds-pagination) {
  flex: 1;
  justify-content: flex-start;
}

@media (max-width: 760px) {
  :global(.account-dialog) {
    width: calc(100vw - 32px) !important;
  }

  .account-form__grid {
    grid-template-columns: 1fr;
  }

  .login-log-dialog__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .login-log-dialog__footer > .el-button {
    align-self: flex-end;
  }
}

</style>
