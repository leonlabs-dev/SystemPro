<script setup lang="ts">
import { Key, Lock, RefreshRight, Setting, User, Warning } from '@element-plus/icons-vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useActiveLocaleDataRefresh } from '@/core/i18n/use-active-locale-data-refresh';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useAuthStore } from '@/core/auth/auth.store';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';
import {
  fetchSystemParameters, resetSystemParameters, updateSystemParameters,
  type SystemParameter,
} from '@/domain/platform/settings/api/settings.api';

type Category = SystemParameter['category'];
const authStore = useAuthStore();
const runtimeSettings = useRuntimeSettingsStore();
const { locale, t } = useI18n();
const categories = computed<Array<{ value: Category; label: string; description: string; icon: object }>>(() => [
  { value: 'GENERAL', label: t('settingsBasic.general'), description: t('settingsBasic.systemNameTimeZoneAndDisplayPreferences'), icon: Setting },
  { value: 'ACCOUNT', label: t('settingsBasic.accountPolicy'), description: t('settingsBasic.defaultBehaviorForNewAccounts'), icon: User },
  { value: 'SECURITY', label: t('settingsBasic.securityPolicy'), description: t('settingsBasic.passwordLockoutAndSessionBaselines'), icon: Lock },
  { value: 'LOGIN', label: t('settingsBasic.loginPage'), description: t('settingsBasic.loginPageVisibilityAndExperienceAccess'), icon: Key },
]);
const activeCategory = ref<Category>('GENERAL');
const parameters = ref<SystemParameter[]>([]);
const original = ref<Record<string, string>>({});
const loading = ref(true);
const saving = ref(false);
const resetting = ref(false);
const canView = computed(() => authStore.can('platform:basic:parameters:view'));
const canUpdate = computed(() => authStore.can('platform:basic:parameters:update'));
const activeMeta = computed(() => categories.value.find((item) => item.value === activeCategory.value)!);
const activeItems = computed(() => parameters.value.filter((item) => item.category === activeCategory.value));
const dirtyKeys = computed(() => parameters.value.filter((item) => original.value[item.key] !== item.value).map((item) => item.key));
const dirtyCount = (category: Category) => parameters.value.filter((item) => item.category === category && original.value[item.key] !== item.value).length;
const parameterEnglish: Record<string, { name: string; description: string }> = {
  'GENERAL.SYSTEM_NAME': { name: 'System name', description: 'Name displayed in the management console title and basic information' },
  'GENERAL.TIME_ZONE': { name: 'Default time zone', description: 'Default display time zone for new business data' },
  'GENERAL.DATE_FORMAT': { name: 'Date format', description: 'Default date format used in lists and details' },
  'GENERAL.PAGE_SIZE': { name: 'Default page size', description: 'Default number of rows per page when opening a list (10–100)' },
  'GENERAL.DEVICE_DEFAULT_VIEW': { name: 'Default device view', description: 'Default card or list view used when opening a device module' },
  'GENERAL.READONLY_ACTION_MODE': { name: 'Read-only action experience', description: 'Controls whether users without write permission can see or explore operation flows; RBAC enforcement is unchanged' },
  'ACCOUNT.DEFAULT_STATUS': { name: 'Default account status', description: 'Default status used when creating an account' },
  'ACCOUNT.FORCE_PASSWORD_CHANGE': { name: 'Change password on first login', description: 'Require new accounts to change the initial password after first login' },
  'SECURITY.PASSWORD_MIN_LENGTH': { name: 'Minimum password length', description: 'Minimum number of account-password characters (8–32)' },
  'SECURITY.LOGIN_FAILURE_LIMIT': { name: 'Login failure threshold', description: 'Lock the account after this many consecutive failures (3–20)' },
  'SECURITY.LOCK_MINUTES': { name: 'Account lock duration', description: 'Security lock duration in minutes (5–1440)' },
  'SECURITY.SESSION_TIMEOUT_MINUTES': { name: 'Session idle timeout', description: 'Idle session timeout in minutes (15–1440)' },
  'SECURITY.CAPTCHA_REQUIRED': { name: 'Login captcha', description: 'Require a graphical captcha for password login as a security baseline' },
  'LOGIN.SHOW_FORGOT_PASSWORD': { name: 'Show forgot password', description: 'Show the password recovery entry on the login page' },
  'LOGIN.SHOW_SMS_LOGIN': { name: 'Show verification-code login', description: 'Show the SMS verification-code login tab' },
  'LOGIN.SHOW_WECHAT': { name: 'Show WeChat login', description: 'Show the WeChat login provider' },
  'LOGIN.SHOW_ALIPAY': { name: 'Show Alipay login', description: 'Show the Alipay login provider' },
  'LOGIN.SHOW_TRIAL_REGISTRATION': { name: 'Show trial registration', description: 'Show the trial registration entry and registration form' },
  'LOGIN.SHOW_EXPERIENCE': { name: 'Show experience credentials', description: 'Show the fixed experience account credentials below the sign-in form' },
  'LOGIN.EXPERIENCE_USERNAME': { name: 'Experience account', description: 'Pre-filled on first visit; a remembered user account always takes precedence' },
};
const parameterChinese: Record<string, { name: string; description: string }> = {
  'GENERAL.READONLY_ACTION_MODE': { name: '只读角色操作体验', description: '控制无写权限角色是否显示并体验操作流程，不改变角色权限、数据权限和后端鉴权' },
  'LOGIN.SHOW_TRIAL_REGISTRATION': { name: '显示注册体验', description: '显示注册体验入口并打开体验账号注册表单' },
  'LOGIN.SHOW_EXPERIENCE': { name: '显示体验入口', description: '体验能力由部署方后端控制；前端不内置账号或密码' },
  'LOGIN.EXPERIENCE_USERNAME': { name: '体验账号', description: '可由后端策略提供账号提示；公开构建不会预置凭据' },
};
const parameterName = (item: SystemParameter) => locale.value === 'en-US'
  ? parameterEnglish[item.key]?.name || item.name
  : parameterChinese[item.key]?.name || item.name;
const parameterDescription = (item: SystemParameter) => locale.value === 'en-US'
  ? parameterEnglish[item.key]?.description || item.description
  : parameterChinese[item.key]?.description || item.description;
function optionLabel(value: string, label: string) {
  if (locale.value !== 'en-US') return label;
  return ({ ACTIVE: 'Active', PENDING: 'Pending activation', CARD: 'Card', LIST: 'List', HIDDEN: 'Hide actions', DISABLED: 'Show without drill-down', PREVIEW: 'Explore flow; disable final action', 'Asia/Shanghai': 'China Standard Time UTC+8', UTC: 'Coordinated Universal Time UTC' } as Record<string, string>)[value] || label;
}

async function load() {
  if (!canView.value) {
    parameters.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    parameters.value = await fetchSystemParameters();
    original.value = Object.fromEntries(parameters.value.map((item) => [item.key, item.value]));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('settingsBasic.failedToLoadBasicParameters'));
  } finally {
    loading.value = false;
  }
}
function discard() {
  parameters.value.forEach((item) => { item.value = original.value[item.key] ?? item.value; });
}
async function save() {
  if (!dirtyKeys.value.length || !canUpdate.value) return;
  saving.value = true;
  try {
    const changed = parameters.value.filter((item) => dirtyKeys.value.includes(item.key));
    parameters.value = await updateSystemParameters(changed.map(({ key, value, version }) => ({ key, value, version })));
    original.value = Object.fromEntries(parameters.value.map((item) => [item.key, item.value]));
    await runtimeSettings.load(true);
    ElMessage.success(t('settingsBasic.basicParametersSaved'));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('settingsBasic.saveFailed'));
  } finally {
    saving.value = false;
  }
}
async function resetCategory() {
  if (!canUpdate.value) return;
  await ElMessageBox.confirm(t('settingsBasic.confirmResetGroup', { group: activeMeta.value.label }), t('settingsBasic.resetDefaults'), {
    type: 'warning', confirmButtonText: t('settingsBasic.reset'), cancelButtonText: t('settingsBasic.cancel'),
  });
  resetting.value = true;
  try {
    parameters.value = await resetSystemParameters(activeCategory.value);
    original.value = Object.fromEntries(parameters.value.map((item) => [item.key, item.value]));
    await runtimeSettings.load(true);
    ElMessage.success(t('settingsBasic.groupDefaultsRestored'));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('settingsBasic.resetFailed'));
  } finally {
    resetting.value = false;
  }
}
function integerLimits(key: string) {
  if (key === 'SECURITY.PASSWORD_MIN_LENGTH') return { min: 8, max: 32 };
  if (key === 'SECURITY.LOGIN_FAILURE_LIMIT') return { min: 3, max: 20 };
  if (key === 'SECURITY.LOCK_MINUTES' || key === 'SECURITY.SESSION_TIMEOUT_MINUTES') return { min: 5, max: 1440 };
  return { min: 10, max: 100 };
}
useActiveLocaleDataRefresh(() => dirtyKeys.value.length ? undefined : load());
onMounted(load);
</script>

<template>
  <DsListPageShell :title="t('settingsBasic.basicParameters')" :loading="canView && loading" page-class="settings-parameter-page">
    <template #header-extra>
      <span class="parameter-subtitle">{{ t('settingsBasic.manageClientLevelGeneralAccountAndSecurityPolicies') }}</span>
    </template>
    <template #primary-action>
      <el-button v-permission="'platform:basic:parameters:update'" type="primary" :loading="saving"
        :disabled="!dirtyKeys.length || !canUpdate" @click="save">{{ t('settingsBasic.save') }} {{ dirtyKeys.length ? `(${dirtyKeys.length})` : '' }}</el-button>
    </template>

    <section v-if="canView" class="parameter-workspace">
      <aside class="parameter-nav">
        <button v-for="category in categories" :key="category.value" type="button"
          class="parameter-nav__item" :class="{ 'is-active': activeCategory === category.value }"
          @click="activeCategory = category.value">
          <el-icon><component :is="category.icon" /></el-icon>
          <span><strong>{{ category.label }}</strong><small>{{ category.description }}</small></span>
          <i v-if="dirtyCount(category.value)">{{ dirtyCount(category.value) }}</i>
        </button>
        <div class="parameter-nav__notice">
          <el-icon><Warning /></el-icon>
          <span>{{ t('settingsBasic.changesAreRecordedInTheAuditLogAndOnlyAffectTheCurrentClient') }}</span>
        </div>
      </aside>

      <section class="parameter-detail">
        <header class="parameter-detail__header">
          <div><h2>{{ activeMeta.label }}</h2><p>{{ activeMeta.description }}</p></div>
          <DsTag type="info">{{ activeItems.length }} {{ t('settingsBasic.settings') }}</DsTag>
        </header>
        <div class="parameter-grid">
          <label v-for="item in activeItems" :key="item.key" class="parameter-field"
            :class="{ 'is-wide': item.valueType === 'TEXT' }">
            <span class="parameter-field__label">
              <strong>{{ parameterName(item) }}</strong>
              <DsTag v-if="!item.editable" type="neutral" size="small">{{ t('settingsBasic.securityBaseline') }}</DsTag>
            </span>
            <el-input v-if="item.valueType === 'TEXT'" v-model="item.value" maxlength="100"
              :disabled="!item.editable || !canUpdate" />
            <el-input-number v-else-if="item.valueType === 'INTEGER'" :model-value="Number(item.value)"
              @update:model-value="item.value = String($event)"
              :min="integerLimits(item.key).min" :max="integerLimits(item.key).max"
              controls-position="right" :disabled="!item.editable || !canUpdate" />
            <el-select v-else-if="item.valueType === 'SELECT'" v-model="item.value"
              :disabled="!item.editable || !canUpdate">
              <el-option v-for="option in item.options" :key="option.value" :label="optionLabel(option.value, option.label)" :value="option.value" />
            </el-select>
            <el-switch v-else v-model="item.value" active-value="true" inactive-value="false"
              :active-text="t('settingsBasic.on')" :inactive-text="t('settingsBasic.off')" :disabled="!item.editable || !canUpdate" />
            <small>{{ parameterDescription(item) }}</small>
          </label>
        </div>
      </section>
    </section>
    <section v-else class="settings-no-access">
      <DsEmpty :description="t('settingsBasic.theCurrentRoleDoesNotHavePermissionToViewBasicParameters')" />
    </section>

    <footer v-if="canView" class="parameter-savebar">
      <span><i :class="{ 'is-dirty': dirtyKeys.length }" />{{ dirtyKeys.length ? t('settingsBasic.unsavedChanges', { count: dirtyKeys.length }) : t('settingsBasic.allChangesSaved') }}</span>
      <div>
        <el-button :disabled="!dirtyKeys.length" @click="discard">{{ t('settingsBasic.discardChanges') }}</el-button>
        <el-button v-permission="'platform:basic:parameters:update'" :icon="RefreshRight"
          :loading="resetting" :disabled="!canUpdate" @click="resetCategory">{{ t('settingsBasic.resetCurrentGroup') }}</el-button>
        <el-button v-permission="'platform:basic:parameters:update'" type="primary" :loading="saving"
          :disabled="!dirtyKeys.length || !canUpdate" @click="save">{{ t('settingsBasic.saveChanges') }}</el-button>
      </div>
    </footer>
  </DsListPageShell>
</template>

<style scoped>
.parameter-subtitle { color: var(--color-text-secondary); font-size: var(--font-caption); }
.parameter-workspace { display: grid; height: calc(var(--ds-list-workspace-h) - 66px); min-height: 520px; grid-template-columns: var(--ds-master-pane-width) minmax(0, 1fr); margin: var(--ds-page-filter-py-top) var(--ds-page-inset) 0; border-top: 1px solid var(--ds-list-divider); }
.parameter-nav { display: grid; min-height: 0; align-content: start; gap: var(--space-2); padding: var(--space-5) var(--space-5) var(--space-4) 0; border-right: 1px solid var(--ds-list-divider); }
.parameter-nav__item { position: relative; display: grid; min-height: 68px; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: var(--space-3); padding: 0 42px 0 var(--space-4); border: 1px solid transparent; border-radius: var(--radius-md); background: transparent; color: var(--color-text-primary); cursor: pointer; text-align: left; }
.parameter-nav__item:hover { background: var(--color-bg-subtle); }
.parameter-nav__item.is-active { border-color: color-mix(in srgb, var(--color-primary-500) 24%, var(--color-border-default)); background: color-mix(in srgb, var(--color-primary-500) 8%, transparent); color: var(--color-primary-600); }
.parameter-nav__item > span { display: grid; gap: 4px; }
.parameter-nav__item strong { font-size: var(--font-body); }
.parameter-nav__item small { color: var(--color-text-secondary); font-size: var(--font-caption); }
.parameter-nav__item i { position: absolute; top: 10px; right: 10px; display: inline-flex; min-width: 18px; height: 18px; align-items: center; justify-content: center; padding: 0 5px; border-radius: 9px; background: var(--color-warning-default); color: #fff; font-size: 10px; font-style: normal; line-height: 18px; }
.parameter-nav__notice { display: flex; align-items: flex-start; gap: var(--space-2); margin-top: auto; padding: var(--space-3); border-top: 1px solid var(--ds-list-divider); color: var(--color-text-secondary); font-size: var(--font-caption); line-height: 1.6; }
.parameter-detail { min-width: 0; min-height: 0; overflow: auto; padding: var(--space-5) 0 var(--space-6) var(--space-6); }
.parameter-detail__header { display: flex; align-items: center; justify-content: space-between; padding-bottom: var(--space-4); border-bottom: 1px solid var(--ds-list-divider); }
.parameter-detail__header h2 { margin: 0 0 4px; font-size: 18px; }
.parameter-detail__header p { margin: 0; color: var(--color-text-secondary); font-size: var(--font-caption); }
.parameter-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-6); padding-top: var(--space-5); }
.parameter-field { display: grid; align-content: start; gap: var(--space-2); }
.parameter-field.is-wide { grid-column: 1 / -1; }
.parameter-field__label { display: flex; align-items: center; gap: var(--space-2); }
.parameter-field__label strong { font-size: var(--font-body); font-weight: var(--font-weight-medium); }
.parameter-field > small { color: var(--color-text-secondary); font-size: var(--font-caption); line-height: 1.5; }
.parameter-field :deep(.el-select), .parameter-field :deep(.el-input-number) { width: 100%; }
.parameter-savebar { display: flex; min-height: 66px; align-items: center; justify-content: space-between; gap: var(--space-4); margin: 0 var(--ds-page-inset); border-top: 1px solid var(--ds-list-divider); }
.parameter-savebar > span { display: flex; align-items: center; gap: var(--space-2); color: var(--color-text-secondary); font-size: var(--font-caption); }
.parameter-savebar i { width: 7px; height: 7px; border-radius: 50%; background: var(--color-success-default); }
.parameter-savebar i.is-dirty { background: var(--color-warning-default); }
.parameter-savebar > div { display: flex; gap: var(--space-2); }
.settings-no-access { display: grid; min-height: var(--ds-list-workspace-h); place-items: center; margin: 0 var(--ds-page-inset); }
@media (max-width: 960px) { .parameter-workspace { grid-template-columns: var(--ds-master-pane-width-compact) minmax(0, 1fr); } .parameter-grid { grid-template-columns: 1fr; } }
</style>
