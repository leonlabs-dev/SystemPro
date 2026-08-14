<script setup lang="ts">
import {
  Connection,
  EditPen,
  Plus,
  RefreshRight,
  Search,
  SwitchButton,
} from '@element-plus/icons-vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useActiveLocaleDataRefresh } from '@/core/i18n/use-active-locale-data-refresh';
import { createBusinessCode } from '@/core/code/business-code';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import {
  type SsoAccountMatchField,
  type SsoProviderDraft,
  type SsoProviderProtocol,
  type SsoProviderRecord,
  type SsoProviderStatus,
  type SsoUnmatchedPolicy,
} from '@/domain/platform/user-permission/sso';
import { fetchAccountRoleOptions } from '@/domain/platform/user-permission/api/account.api';
import {
  checkIdentityProvider,
  createIdentityProvider,
  fetchIdentityProviders,
  syncIdentityProvider,
  updateIdentityProvider,
} from '@/domain/platform/user-permission/api/sso.api';

const { t } = useI18n();

const providers = ref<SsoProviderRecord[]>([]);
const roles = ref<Array<{ label: string; value: string }>>([]);
const providerKeyword = ref('');
const activeProviderId = ref(providers.value[0]?.id || '');
const dialogVisible = ref(false);
const editingProviderId = ref('');
const savingProvider = ref(false);
const loading = ref(true);

const draft = reactive<SsoProviderDraft>({
  code: createBusinessCode('IDP'),
  name: '',
  vendor: '',
  protocol: 'oauth2',
  status: 'draft',
  appClientId: '',
  clientSecret: '',
  issuer: '',
  authUrl: '',
  tokenUrl: '',
  userInfoUrl: '',
  callbackUrl: '',
  matchField: 'email',
  defaultRole: 'user',
  unmatchedPolicy: 'reject',
  autoCreateAccount: false,
  syncEnabled: false,
});

const form = reactive<SsoProviderDraft>({
  code: createBusinessCode('IDP'),
  name: '',
  vendor: '',
  protocol: 'oauth2',
  status: 'draft',
  appClientId: '',
  clientSecret: '',
  issuer: '',
  authUrl: '',
  tokenUrl: '',
  userInfoUrl: '',
  callbackUrl: '',
  matchField: 'email',
  defaultRole: 'user',
  unmatchedPolicy: 'reject',
  autoCreateAccount: false,
  syncEnabled: false,
});

const protocolOptions: SsoProviderProtocol[] = ['oauth2', 'oidc', 'saml', 'ldap'];
const statusOptions: SsoProviderStatus[] = ['enabled', 'disabled', 'draft'];
const matchFieldOptions: SsoAccountMatchField[] = ['email', 'phone', 'employeeNo'];
const unmatchedPolicyOptions: SsoUnmatchedPolicy[] = ['create', 'disable', 'reject'];
const roleOptions = computed(() => roles.value);

const filteredProviders = computed(() => {
  const keyword = providerKeyword.value.trim().toLowerCase();
  if (!keyword) return providers.value;
  return providers.value.filter((provider) => (
    provider.name.toLowerCase().includes(keyword)
    || provider.vendor.toLowerCase().includes(keyword)
    || provider.protocol.toLowerCase().includes(keyword)
  ));
});
const activeProvider = computed(() => providers.value.find((provider) => provider.id === activeProviderId.value) || null);
const enabledProviderCount = computed(() => providers.value.filter((provider) => provider.status === 'enabled').length);
const totalBoundAccounts = computed(() => providers.value.reduce((sum, provider) => sum + provider.boundAccounts, 0));
const dialogTitle = computed(() => (editingProviderId.value ? t('ssoPage.dialog.editTitle') : t('ssoPage.dialog.addTitle')));
const isDirty = computed(() => {
  const provider = activeProvider.value;
  if (!provider) return false;
  return provider.name !== draft.name
    || provider.vendor !== draft.vendor
    || provider.protocol !== draft.protocol
    || provider.status !== draft.status
    || provider.appClientId !== draft.appClientId
    || provider.clientSecret !== draft.clientSecret
    || provider.issuer !== draft.issuer
    || provider.authUrl !== draft.authUrl
    || provider.tokenUrl !== draft.tokenUrl
    || provider.userInfoUrl !== draft.userInfoUrl
    || provider.callbackUrl !== draft.callbackUrl
    || provider.matchField !== draft.matchField
    || provider.defaultRole !== draft.defaultRole
    || provider.unmatchedPolicy !== draft.unmatchedPolicy
    || provider.autoCreateAccount !== draft.autoCreateAccount
    || provider.syncEnabled !== draft.syncEnabled;
});

function cloneProvider(provider: SsoProviderRecord): SsoProviderRecord {
  return { ...provider };
}

function statusTagType(status: SsoProviderStatus) {
  if (status === 'enabled') return 'success';
  if (status === 'draft') return 'warning';
  return 'neutral';
}

function loadDraft(provider: SsoProviderRecord | null) {
  Object.assign(draft, provider ? toDraft(provider) : createEmptyDraft());
}

function toDraft(provider: SsoProviderRecord): SsoProviderDraft {
  return {
    code: provider.code,
    name: provider.name,
    vendor: provider.vendor,
    protocol: provider.protocol,
    status: provider.status,
    appClientId: provider.appClientId,
    clientSecret: provider.clientSecret,
    issuer: provider.issuer,
    authUrl: provider.authUrl,
    tokenUrl: provider.tokenUrl,
    userInfoUrl: provider.userInfoUrl,
    callbackUrl: provider.callbackUrl,
    matchField: provider.matchField,
    defaultRole: provider.defaultRole,
    unmatchedPolicy: provider.unmatchedPolicy,
    autoCreateAccount: provider.autoCreateAccount,
    syncEnabled: provider.syncEnabled,
  };
}

function createEmptyDraft(): SsoProviderDraft {
  return {
    code: createBusinessCode('IDP'),
    name: '',
    vendor: '',
    protocol: 'oauth2',
    status: 'draft',
    appClientId: '',
    clientSecret: '',
    issuer: '',
    authUrl: '',
    tokenUrl: '',
    userInfoUrl: '',
    callbackUrl: '',
    matchField: 'email',
    defaultRole: 'user',
    unmatchedPolicy: 'reject',
    autoCreateAccount: false,
    syncEnabled: false,
  };
}

async function selectProvider(provider: SsoProviderRecord) {
  if (provider.id === activeProviderId.value) return;
  if (isDirty.value) {
    await ElMessageBox.confirm(
      t('ssoPage.messages.unsavedConfirm'),
      t('ssoPage.messages.switchTitle'),
      {
        type: 'warning',
        confirmButtonText: t('ssoPage.messages.continueSwitch'),
        cancelButtonText: t('ssoPage.messages.cancel'),
      },
    );
  }
  activeProviderId.value = provider.id;
}

function openCreateDialog() {
  editingProviderId.value = '';
  Object.assign(form, createEmptyDraft());
  dialogVisible.value = true;
}

function openEditDialog(provider: SsoProviderRecord) {
  editingProviderId.value = provider.id;
  Object.assign(form, toDraft(provider));
  dialogVisible.value = true;
}

async function saveProviderFromDialog() {
  if (!form.name.trim() || !form.vendor.trim() || !form.appClientId.trim()) {
    ElMessage.warning(t('ssoPage.messages.fillRequired'));
    return;
  }

  if (form.name.trim().length > 12) {
    ElMessage.warning(t('ssoPage.messages.nameLength'));
    return;
  }

  savingProvider.value = true;
  try {
    if (editingProviderId.value) {
      const saved = await updateIdentityProvider(editingProviderId.value, { ...form });
      providers.value = providers.value.map((provider) => (provider.id === saved.id ? saved : provider));
      activeProviderId.value = editingProviderId.value;
      ElMessage.success(t('ssoPage.messages.providerUpdated'));
    } else {
      const nextProvider = await createIdentityProvider({ ...form });
      providers.value = [nextProvider, ...providers.value];
      activeProviderId.value = nextProvider.id;
      ElMessage.success(t('ssoPage.messages.providerCreated'));
    }

    dialogVisible.value = false;
  } finally {
    savingProvider.value = false;
  }
}

function resetWorkspace() {
  loadDraft(activeProvider.value);
  ElMessage.success(t('ssoPage.messages.workspaceReset'));
}

async function saveWorkspace() {
  const provider = activeProvider.value;
  if (!provider) return;
  if (!draft.name.trim() || draft.name.trim().length > 12) {
    ElMessage.warning(t('ssoPage.messages.nameLength'));
    return;
  }

  const saved = await updateIdentityProvider(provider.id, { ...draft });
  providers.value = providers.value.map((item) => (item.id === saved.id ? saved : item));
  loadDraft(activeProvider.value);
  ElMessage.success(t('ssoPage.messages.configSaved'));
}

async function testConnection() {
  if (!activeProvider.value) return;
  const result = await checkIdentityProvider(activeProvider.value.id);
  if (result.success) ElMessage.success(result.message || t('ssoPage.messages.connectionTestPass', { name: activeProvider.value.name }));
  else ElMessage.warning(result.message || t('ssoPage.messages.connectionIncomplete'));
}

async function syncAccounts() {
  const provider = activeProvider.value;
  if (!provider) return;
  if (!draft.syncEnabled) {
    ElMessage.warning(t('ssoPage.messages.enableSyncFirst'));
    return;
  }
  const saved = await syncIdentityProvider(provider.id);
  providers.value = providers.value.map((item) => (item.id === saved.id ? saved : item));
  ElMessage.success(t('ssoPage.messages.syncTriggered'));
}

watch(activeProvider, (provider) => {
  loadDraft(provider);
}, { immediate: true });

async function loadPageData() {
  const previousProviderId = activeProviderId.value;
  const [providerRows, roleRows] = await Promise.all([fetchIdentityProviders(), fetchAccountRoleOptions()]);
  providers.value = providerRows;
  roles.value = roleRows.map((role) => ({ label: role.name, value: role.code.toLowerCase() }));
  activeProviderId.value = previousProviderId && providerRows.some((provider) => provider.id === previousProviderId)
    ? previousProviderId
    : providerRows[0]?.id || '';
}

useActiveLocaleDataRefresh(loadPageData);
onMounted(async () => {
  try { await loadPageData(); } finally { loading.value = false; }
});
</script>

<template>
  <DsListPageShell :title="t('ssoPage.title')" :loading="loading" page-class="sso-binding-page">
    <template #primary-action>
      <el-button v-permission.preview="'platform:sso:binding:create'" class="ds-list-page__primary-action" type="primary" :icon="Plus" @click="openCreateDialog">{{ t('ssoPage.addProvider') }}</el-button>
    </template>

    <section class="sso-workspace-shell">
      <div class="sso-workspace">
        <aside class="sso-directory">
          <el-input
            v-model="providerKeyword"
            class="sso-directory__search"
            clearable
            :placeholder="t('ssoPage.searchPlaceholder')"
            :prefix-icon="Search"
          />

          <div v-if="filteredProviders.length" class="sso-directory__list">
            <button
              v-for="provider in filteredProviders"
              :key="provider.id"
              class="sso-source-card"
              :class="{ 'is-active': provider.id === activeProviderId }"
              type="button"
              @click="selectProvider(provider)"
            >
              <span class="sso-source-card__main">
                <strong>{{ provider.name }}</strong>
                <span>{{ provider.vendor }} · {{ t(`ssoPage.protocol.${provider.protocol}`) }}</span>
              </span>
              <span class="sso-source-card__meta">
                <DsTag size="small" :type="statusTagType(provider.status)">{{ t(`ssoPage.status.${provider.status}`) }}</DsTag>
                <span>{{ provider.boundAccounts }}{{ t('ssoPage.overview.accountsUnit') }}</span>
              </span>
            </button>
          </div>
          <DsEmpty v-else :description="t('ssoPage.noMatchingProvider')" :action-label="t('ssoPage.clearSearch')" @retry="providerKeyword = ''" />
        </aside>

        <section v-if="activeProvider" class="sso-config">
          <header class="sso-overview">
            <div>
              <span>{{ t('ssoPage.overview.enabledProviders') }}</span>
              <strong>{{ enabledProviderCount }} / {{ providers.length }}</strong>
            </div>
            <div>
              <span>{{ t('ssoPage.overview.boundAccounts') }}</span>
              <strong>{{ totalBoundAccounts }}{{ t('ssoPage.overview.accountsUnit') }}</strong>
            </div>
            <div>
              <span>{{ t('ssoPage.overview.currentProtocol') }}</span>
              <strong>{{ t(`ssoPage.protocol.${draft.protocol}`) }}</strong>
            </div>
            <div>
              <span>{{ t('ssoPage.overview.lastSync') }}</span>
              <strong>{{ activeProvider.lastSyncAt }}</strong>
            </div>
          </header>

          <el-tabs class="sso-tabs">
            <el-tab-pane :label="t('ssoPage.tabs.basicConfig')">
              <div class="sso-form-grid">
                <label class="sso-field">
                  <span>{{ t('ssoPage.form.code') }}</span>
                  <el-input v-model="draft.code" disabled />
                </label>
                <label class="sso-field">
                  <span>{{ t('ssoPage.form.name') }}</span>
                  <el-input v-model="draft.name" maxlength="12" show-word-limit />
                </label>
                <label class="sso-field">
                  <span>{{ t('ssoPage.form.vendor') }}</span>
                  <el-input v-model="draft.vendor" />
                </label>
                <label class="sso-field">
                  <span>{{ t('ssoPage.form.protocol') }}</span>
                  <el-select v-model="draft.protocol">
                    <el-option v-for="item in protocolOptions" :key="item" :label="t(`ssoPage.protocol.${item}`)" :value="item" />
                  </el-select>
                </label>
                <label class="sso-field">
                  <span>{{ t('ssoPage.form.status') }}</span>
                  <el-select v-model="draft.status">
                    <el-option v-for="item in statusOptions" :key="item" :label="t(`ssoPage.status.${item}`)" :value="item" />
                  </el-select>
                </label>
                <label class="sso-field">
                  <span>{{ t('ssoPage.form.clientId') }}</span>
                  <el-input v-model="draft.appClientId" />
                </label>
                <label class="sso-field">
                  <span>{{ t('ssoPage.form.clientSecret') }}</span>
                  <el-input v-model="draft.clientSecret" show-password />
                </label>
                <label class="sso-field is-wide">
                  <span>{{ t('ssoPage.form.issuer') }}</span>
                  <el-input v-model="draft.issuer" />
                </label>
                <label class="sso-field is-wide">
                  <span>{{ t('ssoPage.form.authUrl') }}</span>
                  <el-input v-model="draft.authUrl" />
                </label>
                <label class="sso-field is-wide">
                  <span>{{ t('ssoPage.form.tokenUrl') }}</span>
                  <el-input v-model="draft.tokenUrl" />
                </label>
                <label class="sso-field is-wide">
                  <span>{{ t('ssoPage.form.userInfoUrl') }}</span>
                  <el-input v-model="draft.userInfoUrl" />
                </label>
                <label class="sso-field is-wide">
                  <span>{{ t('ssoPage.form.callbackUrl') }}</span>
                  <el-input v-model="draft.callbackUrl" />
                </label>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="t('ssoPage.tabs.bindRules')">
              <div class="sso-rule-panel">
                <section class="sso-rule-row">
                  <div class="sso-rule-row__main">
                    <strong>{{ t('ssoPage.rules.matchField') }}</strong>
                    <span>{{ t('ssoPage.rules.matchFieldDesc') }}</span>
                  </div>
                  <div class="sso-rule-row__control">
                    <el-radio-group v-model="draft.matchField" class="sso-segmented">
                      <el-radio-button v-for="item in matchFieldOptions" :key="item" :label="item">{{ t(`ssoPage.matchField.${item}`) }}</el-radio-button>
                    </el-radio-group>
                  </div>
                </section>
                <section class="sso-rule-row">
                  <div class="sso-rule-row__main">
                    <strong>{{ t('ssoPage.rules.defaultRole') }}</strong>
                    <span>{{ t('ssoPage.rules.defaultRoleDesc') }}</span>
                  </div>
                  <div class="sso-rule-row__control">
                    <el-select v-model="draft.defaultRole" class="sso-rule-select">
                      <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
                    </el-select>
                  </div>
                </section>
                <section class="sso-rule-row">
                  <div class="sso-rule-row__main">
                    <strong>{{ t('ssoPage.rules.unmatchedPolicy') }}</strong>
                    <span>{{ t('ssoPage.rules.unmatchedPolicyDesc') }}</span>
                  </div>
                  <div class="sso-rule-row__control">
                    <el-select v-model="draft.unmatchedPolicy" class="sso-rule-select">
                      <el-option v-for="item in unmatchedPolicyOptions" :key="item" :label="t(`ssoPage.unmatchedPolicy.${item}`)" :value="item" />
                    </el-select>
                  </div>
                </section>
                <section class="sso-rule-row">
                  <div class="sso-rule-row__main">
                    <strong>{{ t('ssoPage.rules.autoCreateAccount') }}</strong>
                    <span>{{ t('ssoPage.rules.autoCreateAccountDesc') }}</span>
                  </div>
                  <div class="sso-rule-row__control">
                    <el-switch v-model="draft.autoCreateAccount" class="sso-rule-switch" inline-prompt :active-text="t('ssoPage.rules.switchOn')" :inactive-text="t('ssoPage.rules.switchOff')" />
                  </div>
                </section>
                <section class="sso-rule-row">
                  <div class="sso-rule-row__main">
                    <strong>{{ t('ssoPage.rules.accountSync') }}</strong>
                    <span>{{ t('ssoPage.rules.accountSyncDesc') }}</span>
                  </div>
                  <div class="sso-rule-row__control">
                    <el-switch v-model="draft.syncEnabled" class="sso-rule-switch" inline-prompt :active-text="t('ssoPage.rules.switchOn')" :inactive-text="t('ssoPage.rules.switchOff')" />
                  </div>
                </section>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="t('ssoPage.tabs.syncStatus')">
              <div class="sso-sync-table">
                <div class="sso-sync-table__head">
                  <span>{{ t('ssoPage.sync.headProject') }}</span>
                  <span>{{ t('ssoPage.sync.headValue') }}</span>
                  <span>{{ t('ssoPage.sync.headDesc') }}</span>
                </div>
                <div class="sso-sync-row">
                  <strong>{{ t('ssoPage.sync.boundAccounts') }}</strong>
                  <span>{{ activeProvider.boundAccounts }}{{ t('ssoPage.overview.accountsUnit') }}</span>
                  <span>{{ t('ssoPage.sync.boundAccountsDesc') }}</span>
                </div>
                <div class="sso-sync-row">
                  <strong>{{ t('ssoPage.sync.lastSync') }}</strong>
                  <span>{{ activeProvider.lastSyncAt }}</span>
                  <span>{{ t('ssoPage.sync.lastSyncDesc') }}</span>
                </div>
                <div class="sso-sync-row">
                  <strong>{{ t('ssoPage.sync.updateTime') }}</strong>
                  <span>{{ activeProvider.updatedAt }}</span>
                  <span>{{ t('ssoPage.sync.updateTimeDesc') }}</span>
                </div>
                <div class="sso-sync-row">
                  <strong>{{ t('ssoPage.sync.syncSwitch') }}</strong>
                  <span>{{ draft.syncEnabled ? t('ssoPage.sync.syncSwitchOn') : t('ssoPage.sync.syncSwitchOff') }}</span>
                  <span>{{ t('ssoPage.sync.syncSwitchDesc') }}</span>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </section>

        <section v-else class="sso-config sso-config--empty">
          <DsEmpty :description="t('ssoPage.noProvider')" :action-label="t('ssoPage.addProvider')" @retry="openCreateDialog" />
        </section>
      </div>

      <footer class="sso-savebar">
        <div class="sso-savebar__meta">
          <span>{{ t('ssoPage.savebar.currentProvider') }}{{ activeProvider?.name || t('ssoPage.savebar.notSelected') }}</span>
          <i :class="{ 'is-dirty': isDirty }" />
          <span>{{ isDirty ? t('ssoPage.savebar.modified') : t('ssoPage.savebar.unmodified') }}</span>
        </div>
        <div class="sso-savebar__actions">
          <el-button v-permission="'platform:sso:binding:update'" :icon="Connection" :disabled="!activeProvider" @click="testConnection">{{ t('ssoPage.actions.testConnection') }}</el-button>
          <el-button v-permission="'platform:sso:binding:sync'" :icon="SwitchButton" :disabled="!activeProvider" @click="syncAccounts">{{ t('ssoPage.actions.syncAccounts') }}</el-button>
          <el-button v-permission.preview="'platform:sso:binding:update'" :icon="EditPen" :disabled="!activeProvider" @click="activeProvider && openEditDialog(activeProvider)">{{ t('ssoPage.actions.editInfo') }}</el-button>
          <el-button :disabled="!isDirty" @click="resetWorkspace">{{ t('ssoPage.actions.cancel') }}</el-button>
          <el-button :icon="RefreshRight" :disabled="!isDirty" @click="resetWorkspace">{{ t('ssoPage.actions.reset') }}</el-button>
          <el-button v-permission="'platform:sso:binding:update'" type="primary" :disabled="!activeProvider || !isDirty" @click="saveWorkspace">{{ t('ssoPage.actions.save') }}</el-button>
        </div>
      </footer>
    </section>

    <template #overlays>
      <el-dialog
        v-model="dialogVisible"
        class="sso-dialog"
        :title="dialogTitle"
        width="720px"
        align-center
        destroy-on-close
      >
        <el-form class="sso-dialog-form" label-position="top" @submit.prevent>
          <div class="sso-dialog-form__grid">
            <el-form-item :label="t('ssoPage.form.code')">
              <el-input v-model="form.code" disabled />
            </el-form-item>
            <el-form-item :label="t('ssoPage.form.name')" required>
              <el-input v-model="form.name" maxlength="12" show-word-limit :placeholder="t('ssoPage.dialog.namePlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('ssoPage.form.vendor')" required>
              <el-input v-model="form.vendor" :placeholder="t('ssoPage.dialog.vendorPlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('ssoPage.form.protocol')">
              <el-select v-model="form.protocol">
                <el-option v-for="item in protocolOptions" :key="item" :label="t(`ssoPage.protocol.${item}`)" :value="item" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('ssoPage.form.status')">
              <el-select v-model="form.status">
                <el-option v-for="item in statusOptions" :key="item" :label="t(`ssoPage.status.${item}`)" :value="item" />
              </el-select>
            </el-form-item>
            <el-form-item label="Client ID / Bind DN" required>
              <el-input v-model="form.appClientId" />
            </el-form-item>
            <el-form-item label="Client Secret">
              <el-input v-model="form.clientSecret" show-password />
            </el-form-item>
          </div>
          <el-form-item label="Issuer / Server">
            <el-input v-model="form.issuer" />
          </el-form-item>
          <el-form-item :label="t('ssoPage.form.authUrl')">
            <el-input v-model="form.authUrl" />
          </el-form-item>
          <el-form-item :label="t('ssoPage.form.callbackUrl')">
            <el-input v-model="form.callbackUrl" />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="sso-dialog__footer">
            <el-button @click="dialogVisible = false">{{ t('ssoPage.dialog.cancel') }}</el-button>
            <el-button v-permission="editingProviderId ? 'platform:sso:binding:update' : 'platform:sso:binding:create'" type="primary" :loading="savingProvider" @click="saveProviderFromDialog">{{ t('ssoPage.dialog.save') }}</el-button>
          </div>
        </template>
      </el-dialog>
    </template>
  </DsListPageShell>
</template>

<style scoped>
.sso-workspace-shell {
  display: grid;
  height: var(--ds-list-workspace-h);
  grid-template-rows: minmax(0, 1fr) auto;
  margin: var(--ds-page-filter-py-top) var(--ds-page-inset) var(--space-6);
  overflow: hidden;
}

.sso-workspace {
  display: grid;
  min-height: 0;
  grid-template-columns: var(--ds-master-pane-width) minmax(0, 1fr);
  border-top: 1px solid var(--ds-list-divider);
}

.sso-directory {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  padding: var(--space-4) var(--space-5) var(--space-4) 0;
  border-right: 1px solid var(--ds-list-divider);
}

.sso-directory__search {
  margin-bottom: var(--space-3);
}

.sso-directory__list {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: var(--space-1);
  overflow: auto;
  padding-right: var(--space-1);
}

.sso-source-card {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  min-height: 58px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
}

.sso-source-card:hover,
.sso-source-card.is-active {
  border-color: var(--ds-list-divider);
  background: var(--color-bg-muted);
}

.sso-source-card__main,
.sso-source-card__meta {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.sso-source-card__main strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sso-source-card__main span,
.sso-source-card__meta span,
.sso-overview span,
.sso-savebar__meta,
.sso-savebar__actions,
.sso-field span,
.sso-rule-row span,
.sso-sync-row span {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.sso-source-card__meta {
  justify-items: end;
}

.sso-config {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-4);
  padding: var(--space-4) 0 var(--space-4) var(--space-5);
}

.sso-config--empty {
  place-items: center;
}

.sso-overview {
  display: grid;
  overflow: hidden;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-md);
}

.sso-overview div {
  display: grid;
  gap: 2px;
  min-height: 58px;
  align-content: center;
  padding: 0 var(--space-4);
  border-left: 1px solid var(--ds-list-divider);
}

.sso-overview div:first-child {
  border-left: 0;
}

.sso-overview strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sso-tabs {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.sso-tabs :deep(.el-tabs__header) {
  flex: 0 0 auto;
  margin: 0 0 var(--space-3);
}

.sso-tabs :deep(.el-tabs__content) {
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.sso-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: var(--ds-list-divider);
}

.sso-tabs :deep(.el-tabs__item) {
  height: 34px;
  padding: 0 var(--space-5);
  color: var(--color-text-primary);
  font-size: var(--font-body);
  line-height: 34px;
}

.sso-tabs :deep(.el-tabs__item.is-active) {
  color: var(--color-primary-500);
}

.sso-tabs :deep(.el-tabs__active-bar) {
  background-color: var(--color-primary-500);
}

.sso-tabs :deep(.el-tab-pane) {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding-right: var(--space-1);
}

.sso-form-grid {
  display: grid;
  align-content: start;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3) var(--space-4);
}

.sso-field {
  display: grid;
  min-width: 0;
  gap: var(--space-1);
}

.sso-field.is-wide {
  grid-column: 1 / -1;
}

.sso-field :deep(.el-select) {
  width: 100%;
}

.sso-rule-panel,
.sso-sync-table {
  display: grid;
  align-content: start;
  overflow: hidden;
  border: 1px solid var(--ds-list-divider);
  border-radius: var(--radius-md);
}

.sso-rule-row {
  display: grid;
  min-height: 62px;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-4);
  border-top: 1px solid var(--ds-list-divider);
}

.sso-rule-row:first-child {
  border-top: 0;
}

.sso-rule-row__main {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.sso-rule-row strong,
.sso-sync-row strong {
  color: var(--color-text-primary);
  font-size: var(--font-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-body);
}

.sso-rule-row__control {
  display: inline-flex;
  min-width: 220px;
  justify-content: flex-end;
}

.sso-rule-select {
  width: min(220px, 100%);
}

.sso-segmented {
  display: inline-grid;
  width: 192px;
  grid-template-columns: repeat(3, 64px);
}

.sso-segmented :deep(.el-radio-button),
.sso-segmented :deep(.el-radio-button__inner) {
  width: 64px;
}

.sso-segmented :deep(.el-radio-button__inner) {
  height: 30px;
  padding: 0;
  font-size: var(--font-caption);
  line-height: 28px;
}

.sso-rule-switch :deep(.el-switch__core) {
  width: 52px !important;
  min-width: 52px;
}

.sso-sync-table__head,
.sso-sync-row {
  display: grid;
  grid-template-columns: minmax(140px, 0.7fr) minmax(160px, 0.8fr) minmax(0, 1.5fr);
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-4);
}

.sso-sync-table__head {
  min-height: 40px;
  border-bottom: 1px solid var(--ds-list-divider);
  background: var(--color-bg-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.sso-sync-row {
  min-height: 46px;
  border-top: 1px solid color-mix(in srgb, var(--ds-list-divider) 62%, transparent);
}

.sso-sync-row:first-of-type {
  border-top: 0;
}

.sso-workspace-shell :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner),
.sso-workspace-shell :deep(.el-switch.is-checked .el-switch__core) {
  border-color: var(--color-primary-500);
  background-color: var(--color-primary-500);
}

.sso-savebar {
  display: flex;
  min-height: var(--ds-table-footer-min-h);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0 0;
  border-top: 1px solid var(--ds-list-divider);
}

.sso-savebar__meta,
.sso-savebar__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.sso-savebar__meta i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-disabled);
}

.sso-savebar__meta i.is-dirty {
  background: var(--color-warning-default);
}

.sso-savebar__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.sso-savebar__actions .el-button + .el-button {
  margin-left: 0;
}

.sso-dialog-form {
  display: grid;
  gap: var(--space-4);
}

.sso-dialog-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-5);
}

.sso-dialog-form :deep(.el-select) {
  width: 100%;
}

.sso-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (max-width: 1180px) {
  .sso-workspace {
    grid-template-columns: var(--ds-master-pane-width-compact) minmax(0, 1fr);
  }

  .sso-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sso-overview div:nth-child(3) {
    border-left: 0;
  }
}

@media (max-width: 820px) {
  .sso-workspace-shell {
    height: auto;
    min-height: var(--ds-list-workspace-h);
  }

  .sso-workspace,
  .sso-form-grid,
  .sso-dialog-form__grid,
  .sso-rule-row,
  .sso-sync-table__head,
  .sso-sync-row {
    grid-template-columns: 1fr;
  }

  .sso-directory {
    border-right: 0;
    border-bottom: 1px solid var(--ds-list-divider);
  }

  .sso-directory__list {
    max-height: 320px;
  }

  .sso-savebar {
    align-items: stretch;
    flex-direction: column;
  }

  .sso-rule-row__control {
    min-width: 0;
    justify-content: flex-start;
  }
}

@media (max-width: 760px) {
  :global(.sso-dialog) {
    width: calc(100vw - 32px) !important;
  }
}
</style>
