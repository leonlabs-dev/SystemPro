<script setup lang="ts">
import { Close, Lock, Moon, Operation, Sunny, User } from '@element-plus/icons-vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/core/auth/auth.store';
import { enabledRuntimeLocales, switchApplicationLocale } from '@/core/i18n/locale-runtime';
import { useLayoutStore, type NavMode, type TableDensity } from '@/core/layout/layout.store';
import { useThemeStore } from '@/core/theme/theme.store';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'open-theme-settings': [];
}>();

const { locale } = useI18n();
const authStore = useAuthStore();
const layoutStore = useLayoutStore();
const themeStore = useThemeStore();
const isZh = computed(() => locale.value.startsWith('zh'));
const account = computed(() => authStore.account);
const initials = computed(() => (authStore.displayName || account.value?.username || 'U').trim().slice(0, 1).toUpperCase());
const roleNames = computed(() => account.value?.roles.map((role) => role.name).filter(Boolean).join(' / ') || '--');
const scopeText = computed(() => authStore.dataScopes.length
  ? (isZh.value ? `${authStore.dataScopes.length} 项授权范围` : `${authStore.dataScopes.length} granted scopes`)
  : (isZh.value ? '当前 Client 全部授权数据' : 'All authorized data in the current client'));

function close() { emit('update:modelValue', false); }
function setDensity(value: string | number | boolean | Record<string, unknown>) { layoutStore.setTableDensity(value as TableDensity); }
function setNavMode(value: string | number | boolean | Record<string, unknown>) { layoutStore.setNavMode(value as NavMode); }
async function setLocale(value: string | number | boolean | Record<string, unknown>) {
  await switchApplicationLocale(String(value));
}
function setThemeMode(value: 'light' | 'dark') {
  if (layoutStore.weakMode) layoutStore.setWeakMode(false);
  themeStore.setTheme(value);
}
</script>

<template>
  <el-drawer
    class="personal-settings"
    :model-value="modelValue"
    size="420px"
    :with-header="false"
    :modal="true"
    append-to-body
    destroy-on-close
    :close-on-click-modal="true"
    :lock-scroll="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="profile-shell">
      <header class="profile-header">
        <div><p>{{ isZh ? '账户与偏好' : 'Account & preferences' }}</p><h2>{{ isZh ? '个人设置' : 'Profile settings' }}</h2></div>
        <button type="button" :aria-label="isZh ? '关闭' : 'Close'" @click="close"><el-icon><Close /></el-icon></button>
      </header>

      <section class="identity-card">
        <span class="identity-avatar">{{ initials }}</span>
        <div><strong>{{ authStore.displayName || account?.username || '--' }}</strong><span>@{{ account?.username || '--' }}</span></div>
        <span class="identity-status" :class="{ 'is-active': account?.status === 'ACTIVE' }">
          {{ account?.status === 'ACTIVE' ? (isZh ? '正常' : 'Active') : (account?.status || '--') }}
        </span>
      </section>

      <section class="profile-section">
        <header><el-icon><User /></el-icon><h3>{{ isZh ? '账户信息' : 'Account information' }}</h3></header>
        <dl>
          <div><dt>{{ isZh ? '邮箱' : 'Email' }}</dt><dd>{{ account?.email || (isZh ? '未设置' : 'Not set') }}</dd></div>
          <div><dt>{{ isZh ? '所属组织' : 'Organization' }}</dt><dd>{{ authStore.client?.clientName || '--' }}</dd></div>
          <div><dt>{{ isZh ? '当前角色' : 'Roles' }}</dt><dd>{{ roleNames }}</dd></div>
          <div><dt>{{ isZh ? '数据范围' : 'Data scope' }}</dt><dd>{{ scopeText }}</dd></div>
        </dl>
      </section>

      <section class="profile-section preference-section">
        <header><el-icon><Operation /></el-icon><h3>{{ isZh ? '显示偏好' : 'Display preferences' }}</h3><span>{{ isZh ? '即时保存' : 'Saved instantly' }}</span></header>
        <label><span>{{ isZh ? '界面语言' : 'Language' }}</span><el-select :model-value="locale" size="small" @change="setLocale"><el-option v-for="item in enabledRuntimeLocales" :key="item.code" :label="isZh ? item.nativeName : item.englishName" :value="item.code" /></el-select></label>
        <label><span>{{ isZh ? '表格密度' : 'Table density' }}</span><el-select :model-value="layoutStore.tableDensity" size="small" @change="setDensity"><el-option :label="isZh ? '紧凑' : 'Compact'" value="compact" /><el-option :label="isZh ? '舒适' : 'Comfortable'" value="comfortable" /></el-select></label>
        <label><span>{{ isZh ? '导航模式' : 'Navigation' }}</span><el-select :model-value="layoutStore.navMode" size="small" @change="setNavMode"><el-option :label="isZh ? '侧边导航' : 'Side'" value="side" /><el-option :label="isZh ? '顶部导航' : 'Top'" value="top" /><el-option :label="isZh ? '混合导航' : 'Mixed'" value="mix" /></el-select></label>
        <div class="theme-switch"><span>{{ isZh ? '外观模式' : 'Appearance' }}</span><div><button type="button" :class="{ active: themeStore.theme === 'light' }" @click="setThemeMode('light')"><el-icon><Sunny /></el-icon>{{ isZh ? '浅色' : 'Light' }}</button><button type="button" :class="{ active: themeStore.theme === 'dark' }" @click="setThemeMode('dark')"><el-icon><Moon /></el-icon>{{ isZh ? '深色' : 'Dark' }}</button></div></div>
        <button class="advanced-button" type="button" @click="emit('open-theme-settings')">{{ isZh ? '打开完整外观与布局设置' : 'Open full appearance and layout settings' }}</button>
      </section>

      <section class="security-note"><el-icon><Lock /></el-icon><div><strong>{{ isZh ? '安全说明' : 'Security' }}</strong><span>{{ isZh ? '账户资料、密码和角色由管理员按现有 RBAC 流程维护，个人偏好仅保存在当前浏览器。' : 'Account details, passwords, and roles remain managed by administrators through the existing RBAC process. Preferences are stored only in this browser.' }}</span></div></section>
    </div>
  </el-drawer>
</template>

<style scoped>
.profile-shell { min-height: 100%; color: var(--color-text-primary); background: var(--color-bg-surface); }
.profile-header { display: flex; min-height: 76px; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--color-border-default); }.profile-header p { margin: 0 0 2px; color: var(--color-text-tertiary); font-size: 11px; }.profile-header h2 { margin: 0; font-size: 19px; }.profile-header button { display: grid; width: 30px; height: 30px; place-items: center; color: var(--color-text-secondary); background: transparent; border: 0; border-radius: 6px; cursor: pointer; }.profile-header button:hover { background: var(--color-bg-default); }
.identity-card { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: center; gap: 12px; margin: 18px 20px 8px; padding: 16px; background: var(--color-bg-default); border: 1px solid var(--color-border-default); border-radius: 9px; }.identity-avatar { display: grid; width: 48px; height: 48px; place-items: center; color: #fff; background: var(--color-primary-500); border-radius: 50%; font-size: 18px; font-weight: 650; }.identity-card div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }.identity-card strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.identity-card div span { color: var(--color-text-secondary); font-size: 12px; }.identity-status { display: inline-flex; align-items: center; gap: 6px; color: var(--color-text-secondary); font-size: 12px; line-height: 18px; white-space: nowrap; }.identity-status::before { width: 6px; height: 6px; flex: 0 0 auto; background: var(--color-text-disabled); border-radius: 50%; content: ''; }.identity-status.is-active { color: var(--color-success-default); }.identity-status.is-active::before { background: var(--color-success-default); }
.profile-section { padding: 18px 20px; border-bottom: 1px solid var(--color-border-default); }.profile-section > header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }.profile-section > header .el-icon { color: var(--color-primary-500); }.profile-section h3 { margin: 0; font-size: 14px; }.profile-section > header span { margin-left: auto; color: var(--color-text-tertiary); font-size: 10px; }.profile-section dl { display: grid; gap: 0; margin: 0; }.profile-section dl div { display: grid; min-height: 42px; grid-template-columns: 92px minmax(0, 1fr); align-items: center; border-bottom: 1px solid var(--color-border-subtle, var(--color-border-default)); }.profile-section dl div:last-child { border-bottom: 0; }.profile-section dt { color: var(--color-text-secondary); font-size: 12px; }.profile-section dd { min-width: 0; margin: 0; overflow: hidden; font-size: 12px; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.preference-section > label, .theme-switch { display: flex; min-height: 42px; align-items: center; justify-content: space-between; gap: 14px; color: var(--color-text-secondary); font-size: 12px; }.preference-section .el-select { width: 148px; }.theme-switch > div { display: grid; grid-template-columns: 1fr 1fr; padding: 2px; background: var(--color-bg-default); border-radius: 6px; }.theme-switch button { display: flex; height: 28px; align-items: center; gap: 5px; padding: 0 10px; color: var(--color-text-secondary); background: transparent; border: 0; border-radius: 5px; cursor: pointer; font-size: 11px; }.theme-switch button.active { color: var(--color-primary-500); background: var(--color-bg-surface); box-shadow: 0 1px 4px rgb(20 40 75 / 10%); }.advanced-button { width: 100%; height: 36px; margin-top: 12px; color: var(--color-primary-500); background: transparent; border: 1px solid var(--color-border-default); border-radius: 6px; cursor: pointer; }.advanced-button:hover { border-color: var(--color-primary-500); }
.security-note { display: flex; gap: 10px; margin: 18px 20px; padding: 13px 14px; color: var(--color-text-secondary); background: var(--color-bg-default); border: 1px solid var(--color-border-default); border-radius: 8px; }.security-note .el-icon { margin-top: 2px; flex: 0 0 auto; color: var(--color-primary-500); }.security-note div { display: flex; flex-direction: column; gap: 4px; }.security-note strong { color: var(--color-text-primary); font-size: 12px; }.security-note span { font-size: 11px; line-height: 1.7; }
:deep(.el-drawer__body) { padding: 0; }
@media (max-width: 520px) { :global(.personal-settings.el-drawer) { width: min(100vw, 420px) !important; } }
</style>
