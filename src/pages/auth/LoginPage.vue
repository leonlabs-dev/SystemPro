<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Lock, Message, User, View } from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/core/auth/auth.store';
import { authApi } from '@/core/auth/auth.api';
import type { LoginPolicy } from '@/core/auth/auth.types';
import { useNavigationStore } from '@/core/navigation/navigation.store';
import { appName, publicDemoAccount } from '@/core/config/app-runtime';

type LoginProvider = {
  code: 'wechat' | 'alipay';
  label: string;
  color: string;
  viewBox: string;
  path: string;
};

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { t } = useI18n();
const navigationStore = useNavigationStore();
const logoUrl = new URL('../../../logo.png', import.meta.url).href;
const loginBgUrl = new URL('../../assets/images/auth/login-bg.webp', import.meta.url).href;
const REMEMBER_LOGIN_KEY = 'systempro.login.remember';
const REMEMBERED_USERNAME_KEY = 'systempro.login.username';
const defaultLoginPolicy: LoginPolicy = {
  captchaRequired: false,
  showForgotPassword: false,
  showSmsLogin: false,
  showWechat: false,
  showAlipay: false,
  showTrialRegistration: false,
  showExperience: publicDemoAccount.enabled,
  experienceUsername: publicDemoAccount.username,
};

const activeTab = ref<'account' | 'sms'>('account');
const passwordVisible = ref(false);
const remember = ref(readRememberPreference());
const loading = ref(false);
const loginPolicy = ref<LoginPolicy>(defaultLoginPolicy);
const captchaLoading = ref(false);
const captchaImage = ref('');
const captchaId = ref('');
const trialVisible = ref(false);
const trialLoading = ref(false);
const trialCaptchaImage = ref('');
const trialCaptchaId = ref('');

const rememberedUsername = readRememberedUsername();
const accountForm = reactive({
  username: rememberedUsername || publicDemoAccount.username,
  password: rememberedUsername ? '' : publicDemoAccount.password,
  captchaCode: '',
});

const trialForm = reactive({ username: '', password: '', email: '', captchaCode: '', agreementAccepted: false });

const smsForm = reactive({
  phone: '',
  code: '',
});

const thirdPartyProviders = computed<LoginProvider[]>(() => {
  const providers: LoginProvider[] = [
  {
    code: 'wechat',
    label: t('loginPage.wechat'),
    color: '#07c160',
    viewBox: '0 0 24 24',
    path: 'M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z',
  },
  {
    code: 'alipay',
    label: t('loginPage.alipay'),
    color: '#1677ff',
    viewBox: '0 0 24 24',
    path: 'M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181-4.75 0-6.361-4.19-4.112-6.949.49-.602 1.324-1.175 2.617-1.497 2.025-.502 5.247.313 8.266 1.317a16.796 16.796 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.453 19.453 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869-1.83 1.608-.735 4.55 2.968 4.55 2.151 0 4.301-1.388 5.99-3.61-2.403-1.182-4.438-2.028-6.637-1.809',
  },
  ];
  return providers.filter((provider) => provider.code === 'wechat'
    ? loginPolicy.value.showWechat
    : loginPolicy.value.showAlipay);
});

const canSubmit = computed(() => {
  if (activeTab.value === 'sms') {
    return Boolean(smsForm.phone.trim() && smsForm.code.trim());
  }
  return Boolean(accountForm.username.trim() && accountForm.password.trim()
    && (!loginPolicy.value.captchaRequired || (accountForm.captchaCode.trim() && captchaId.value)));
});

function switchTab(tab: 'account' | 'sms') {
  activeTab.value = tab;
}

function handleSendCode() {
  ElMessage.info(t('loginPage.codeComing'));
}

function handleForgotPassword() {
  ElMessage.info(t('loginPage.recoveryComing'));
}

async function refreshCaptcha(target: 'login' | 'trial' = 'login') {
  if (target === 'login' && !loginPolicy.value.captchaRequired) return;
  captchaLoading.value = true;
  try {
    const captcha = await authApi.captcha();
    if (target === 'login') {
      captchaId.value = captcha.captchaId;
      captchaImage.value = captcha.imageDataUrl;
      accountForm.captchaCode = '';
    } else {
      trialCaptchaId.value = captcha.captchaId;
      trialCaptchaImage.value = captcha.imageDataUrl;
      trialForm.captchaCode = '';
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('loginPage.captchaFailed'));
  } finally {
    captchaLoading.value = false;
  }
}

function handleTrialApply() {
  trialVisible.value = true;
  if (!trialCaptchaId.value) refreshCaptcha('trial');
}

async function submitTrial() {
  if (!trialForm.username.trim() || !trialForm.password || !trialForm.captchaCode.trim()) {
    ElMessage.warning(t('loginPage.fillTrial'));
    return;
  }
  if (trialForm.password.length < 8) {
    ElMessage.warning(t('loginPage.passwordMin'));
    return;
  }
  if (!trialForm.agreementAccepted) {
    ElMessage.warning(t('loginPage.acceptAgreement'));
    return;
  }
  trialLoading.value = true;
  try {
    const result = await authApi.registerTrial({
      username: trialForm.username.trim(), password: trialForm.password, email: trialForm.email.trim() || undefined,
      captchaId: trialCaptchaId.value, captchaCode: trialForm.captchaCode, agreementAccepted: true,
    });
    persistRememberPreference(result.username);
    await authStore.establishSession(result.authentication, remember.value);
    trialVisible.value = false;
    trialForm.password = '';
    ElMessage.success(t('loginPage.trialSuccess'));
    await router.replace(navigationStore.firstPath || '/welcome');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('loginPage.trialFailed'));
    await refreshCaptcha('trial');
  } finally {
    trialLoading.value = false;
  }
}

function handleProviderLogin(provider: LoginProvider) {
  ElMessage.info(t('loginPage.providerComing', { provider: provider.label }));
}

async function handleLogin() {
  if (!canSubmit.value) {
    ElMessage.warning(activeTab.value === 'sms' ? t('loginPage.fillSms') : t('loginPage.fillAccount'));
    return;
  }

  loading.value = true;
  try {
    await authStore.login({
      username: accountForm.username.trim(),
      password: accountForm.password,
      captchaId: loginPolicy.value.captchaRequired ? captchaId.value : undefined,
      captchaCode: loginPolicy.value.captchaRequired ? accountForm.captchaCode : undefined,
    }, remember.value);
    persistRememberPreference(accountForm.username.trim());
    ElMessage.success(t('loginPage.signInSuccess'));
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
    await router.replace(redirect || navigationStore.firstPath || '/login');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('loginPage.signInFailed'));
    if (loginPolicy.value.captchaRequired) await refreshCaptcha();
  } finally {
    loading.value = false;
  }
}

async function loadLoginPolicy() {
  try {
    const backendPolicy = await authApi.loginPolicy();
    loginPolicy.value = {
      ...backendPolicy,
      showExperience: publicDemoAccount.enabled || backendPolicy.showExperience,
      experienceUsername: publicDemoAccount.username || backendPolicy.experienceUsername,
    };
  } catch {
    loginPolicy.value = defaultLoginPolicy;
  }
  if (!loginPolicy.value.showSmsLogin) activeTab.value = 'account';
  if (!rememberedUsername) {
    accountForm.username = publicDemoAccount.username || loginPolicy.value.experienceUsername || '';
    accountForm.password = publicDemoAccount.password;
  }
  if (loginPolicy.value.captchaRequired) await refreshCaptcha();
}

function readRememberPreference() {
  try {
    return localStorage.getItem(REMEMBER_LOGIN_KEY) === 'true';
  } catch {
    return false;
  }
}

function readRememberedUsername() {
  try {
    return localStorage.getItem(REMEMBER_LOGIN_KEY) === 'true'
      ? localStorage.getItem(REMEMBERED_USERNAME_KEY) || ''
      : '';
  } catch {
    return '';
  }
}

function persistRememberPreference(username: string) {
  try {
    if (remember.value) {
      localStorage.setItem(REMEMBER_LOGIN_KEY, 'true');
      localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
    } else {
      localStorage.removeItem(REMEMBER_LOGIN_KEY);
      localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    }
  } catch {
    // Storage can be unavailable in private browsing; the active session still works.
  }
}

onMounted(loadLoginPolicy);
</script>

<template>
  <main class="login-page" :style="{ '--login-bg': `url(${loginBgUrl})` }">
    <header class="login-header" :aria-label="t('loginPage.headerAria')">
      <div class="login-brand" :aria-label="appName">
        <img :src="logoUrl" :alt="`${appName} logo`" />
        <strong>{{ appName }}</strong>
      </div>
    </header>

    <section class="login-panel" :aria-label="t('loginPage.formAria')">
      <div class="login-card">
        <header class="login-card__header">
          <h1>{{ t('loginPage.welcome') }} <span>{{ appName }}</span></h1>
          <p>{{ t('loginPage.subtitle') }}</p>
        </header>

        <div v-if="loginPolicy.showSmsLogin" class="login-tabs" role="tablist" :aria-label="t('loginPage.method')">
          <button
            class="login-tabs__item"
            :class="{ 'is-active': activeTab === 'account' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'account'"
            @click="switchTab('account')"
          >
            {{ t('loginPage.accountLogin') }}
          </button>
          <button
            v-if="loginPolicy.showSmsLogin"
            class="login-tabs__item"
            :class="{ 'is-active': activeTab === 'sms' }"
            type="button"
            role="tab"
            :aria-selected="activeTab === 'sms'"
            @click="switchTab('sms')"
          >
            {{ t('loginPage.smsLogin') }}
          </button>
        </div>

        <form class="login-form" @submit.prevent="handleLogin">
          <template v-if="activeTab === 'account'">
            <label class="login-field" :aria-label="t('loginPage.account')">
              <el-icon><User /></el-icon>
              <input v-model="accountForm.username" autocomplete="username" :placeholder="t('loginPage.accountPlaceholder')" />
            </label>
            <label class="login-field" :aria-label="t('loginPage.password')">
              <el-icon><Lock /></el-icon>
              <input
                v-model="accountForm.password"
                :type="passwordVisible ? 'text' : 'password'"
                autocomplete="current-password"
                :placeholder="t('loginPage.passwordPlaceholder')"
              />
              <button class="login-field__icon" type="button" :aria-label="t('loginPage.togglePassword')" @click="passwordVisible = !passwordVisible">
                <el-icon><View /></el-icon>
              </button>
            </label>
            <div v-if="loginPolicy.captchaRequired" class="login-captcha-row">
              <label class="login-field" :aria-label="t('loginPage.captcha')">
                <el-icon><Message /></el-icon>
                <input v-model="accountForm.captchaCode" autocomplete="off" maxlength="4" :placeholder="t('loginPage.captchaPlaceholder')" />
              </label>
              <button class="login-captcha" type="button" :disabled="captchaLoading" :title="t('loginPage.refreshCaptcha')" @click="refreshCaptcha()">
                <img v-if="captchaImage" :src="captchaImage" :alt="t('loginPage.captcha')" />
                <span v-else>{{ t('loginPage.loading') }}</span>
              </button>
            </div>
            <div v-if="publicDemoAccount.enabled" class="login-public-demo" role="note">
              <span>{{ t('loginPage.publicDemo') }}</span>
              <strong>{{ publicDemoAccount.username }} / {{ publicDemoAccount.password }}</strong>
              <small>{{ t('loginPage.publicDemoNotice') }}</small>
            </div>
          </template>

          <template v-else>
            <label class="login-field" :aria-label="t('loginPage.phone')">
              <el-icon><User /></el-icon>
              <input v-model="smsForm.phone" autocomplete="tel" :placeholder="t('loginPage.phonePlaceholder')" />
            </label>
            <div class="login-code-row">
              <label class="login-field" :aria-label="t('loginPage.code')">
                <el-icon><Message /></el-icon>
                <input v-model="smsForm.code" inputmode="numeric" :placeholder="t('loginPage.codePlaceholder')" />
              </label>
              <button class="login-code-row__send" type="button" @click="handleSendCode">{{ t('loginPage.sendCode') }}</button>
            </div>
          </template>

          <div class="login-options">
            <label class="login-check">
              <input v-model="remember" type="checkbox" />
              <span>{{ t('loginPage.remember') }}</span>
            </label>
            <button v-if="loginPolicy.showForgotPassword" class="login-link" type="button" @click="handleForgotPassword">{{ t('loginPage.forgot') }}</button>
          </div>

          <button class="login-submit" type="submit" :disabled="loading">
            {{ loading ? t('loginPage.signingIn') : t('loginPage.signIn') }}
          </button>
        </form>

        <button v-if="loginPolicy.showTrialRegistration" class="login-trial" type="button" @click="handleTrialApply">{{ t('loginPage.trial') }}</button>

        <div v-if="thirdPartyProviders.length" class="login-divider">
          <span>{{ t('loginPage.otherMethods') }}</span>
        </div>

        <div v-if="thirdPartyProviders.length" class="login-providers" :aria-label="t('loginPage.thirdParty')">
          <button
            v-for="provider in thirdPartyProviders"
            :key="provider.code"
            class="login-provider"
            type="button"
            :aria-label="provider.label"
            :title="provider.label"
            :style="{ '--provider-color': provider.color }"
            @click="handleProviderLogin(provider)"
          >
            <svg aria-hidden="true" :viewBox="provider.viewBox" focusable="false">
              <path :d="provider.path" />
            </svg>
          </button>
        </div>

      </div>
    </section>

    <el-dialog v-model="trialVisible" class="trial-dialog" :title="t('loginPage.trialTitle')" width="min(520px, calc(100vw - 32px))" align-center :close-on-click-modal="false">
      <p class="trial-dialog__hint">{{ t('loginPage.trialHint') }}</p>
      <el-form label-position="top" autocomplete="off">
        <el-form-item :label="t('loginPage.account')" required><el-input v-model="trialForm.username" name="trial-account-username" autocomplete="off" maxlength="12" show-word-limit :placeholder="t('loginPage.trialAccountPlaceholder')" /></el-form-item>
        <el-form-item :label="t('loginPage.password')" required><el-input v-model="trialForm.password" name="trial-account-new-password" autocomplete="new-password" type="password" show-password :placeholder="t('loginPage.trialPasswordPlaceholder')" /></el-form-item>
        <el-form-item :label="t('loginPage.captcha')" required>
          <div class="trial-dialog__captcha"><el-input v-model="trialForm.captchaCode" name="trial-account-captcha" autocomplete="off" maxlength="4" :placeholder="t('loginPage.codePlaceholder')" /><button type="button" @click="refreshCaptcha('trial')"><img v-if="trialCaptchaImage" :src="trialCaptchaImage" :alt="t('loginPage.captcha')" /></button></div>
        </el-form-item>
        <el-form-item :label="t('loginPage.emailOptional')"><el-input v-model="trialForm.email" name="trial-account-email" autocomplete="off" :placeholder="t('loginPage.emailPlaceholder')" /></el-form-item>
        <el-checkbox v-model="trialForm.agreementAccepted">{{ t('loginPage.agreement') }}</el-checkbox>
      </el-form>
      <template #footer><el-button @click="trialVisible = false">{{ t('actions.cancel') }}</el-button><el-button type="primary" :loading="trialLoading" @click="submitTrial">{{ t('loginPage.trial') }}</el-button></template>
    </el-dialog>

    <footer class="login-footer" :aria-label="t('loginPage.copyrightAria')">
      <span>{{ t('loginPage.copyright') }}</span>
      <span class="login-footer__divider">|</span>
      <button type="button">{{ t('loginPage.privacy') }}</button>
      <span class="login-footer__divider">|</span>
      <button type="button">{{ t('loginPage.terms') }}</button>
      <span class="login-footer__divider">|</span>
      <button type="button">{{ t('loginPage.help') }}</button>
    </footer>
  </main>
</template>

<style scoped>
.login-page {
  position: relative;
  min-width: 0;
  height: 100vh;
  min-height: 640px;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgb(245 249 255 / 0%) 0%, rgb(245 249 255 / 6%) 48%, rgb(247 251 255 / 72%) 100%),
    var(--login-bg) left center / cover no-repeat,
    #f6faff;
}

.login-header {
  position: absolute;
  top: clamp(28px, 4.4vh, 52px);
  right: clamp(52px, 6vw, 78px);
  left: clamp(52px, 6vw, 78px);
  z-index: 2;
  display: flex;
  align-items: center;
  pointer-events: none;
}

.login-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: #101828;
  font-size: clamp(19px, 1.35vw, 24px);
  font-weight: 800;
  letter-spacing: 0;
  pointer-events: auto;
}

.login-brand img {
  width: clamp(30px, 2vw, 38px);
  height: clamp(30px, 2vw, 38px);
  object-fit: contain;
}

.login-panel {
  position: absolute;
  top: calc(50% - 18px);
  right: clamp(72px, 8vw, 130px);
  z-index: 1;
  width: clamp(468px, 31vw, 580px);
  transform: translateY(-50%);
}

.login-card {
  box-sizing: border-box;
  width: 100%;
  padding: clamp(32px, 4vh, 44px) clamp(44px, 3.2vw, 58px) clamp(30px, 3.4vh, 38px);
  background: rgb(255 255 255 / 94%);
  border: 1px solid rgb(229 235 245 / 92%);
  border-radius: 12px;
  box-shadow:
    0 24px 64px rgb(32 56 97 / 13%),
    0 8px 20px rgb(45 84 154 / 6%);
  backdrop-filter: blur(12px);
}

.login-card__header {
  text-align: center;
}

.login-card__header h1 {
  margin: 0;
  color: #142033;
  font-size: clamp(24px, 1.85vw, 30px);
  font-weight: 800;
  line-height: 1.28;
  letter-spacing: 0;
}

.login-card__header h1 span {
  color: var(--color-primary-500);
}

.login-card__header p {
  margin: 10px 0 0;
  color: #637083;
  font-size: 14px;
  line-height: 22px;
}

.login-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: clamp(22px, 2.8vh, 32px);
  border-bottom: 1px solid rgb(218 226 239 / 88%);
}

.login-tabs__item {
  position: relative;
  height: 38px;
  padding: 0;
  color: #526074;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
}

.login-tabs__item::after {
  position: absolute;
  right: clamp(24px, 3.3vw, 48px);
  bottom: -1px;
  left: clamp(24px, 3.3vw, 48px);
  height: 2px;
  background: transparent;
  content: "";
}

.login-tabs__item.is-active {
  color: var(--color-primary-500);
}

.login-tabs__item.is-active::after {
  background: var(--color-primary-500);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: clamp(28px, 3.2vh, 36px);
}

.login-tabs + .login-form { margin-top: 20px; }

.login-field {
  box-sizing: border-box;
  display: flex;
  height: 54px;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  background: #fff;
  border: 1px solid #d9e3f2;
  border-radius: 8px;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.login-field:focus-within {
  background: rgb(255 255 255 / 88%);
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 10%, transparent);
}

.login-field .el-icon {
  flex: 0 0 auto;
  color: #8c9ab0;
  font-size: 20px;
}

.login-field input {
  width: 0;
  min-width: 0;
  flex: 1 1 0;
  color: #172033;
  background: transparent;
  border: 0;
  outline: none;
  font-size: 15px;
  line-height: 22px;
}

.login-field input::placeholder {
  color: #9da8bb;
}

.login-field__icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: #8c9ab0;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.login-code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  gap: 10px;
}

.login-captcha-row { display: grid; grid-template-columns: minmax(0, 1fr) 128px; gap: 10px; }
.login-captcha { height: 48px; overflow: hidden; padding: 0; background: #f6f8ff; border: 1px solid rgb(216 226 242 / 92%); border-radius: 6px; cursor: pointer; }
.login-captcha img { display: block; width: 100%; height: 100%; object-fit: cover; }
.trial-dialog__hint { margin: 0 0 18px; color: #667085; line-height: 22px; }
.trial-dialog__captcha { display: grid; width: 100%; grid-template-columns: minmax(0, 1fr) 128px; gap: 10px; }
.trial-dialog__captcha button { height: 32px; padding: 0; overflow: hidden; background: #f6f8ff; border: 1px solid #d8e2f2; border-radius: 4px; cursor: pointer; }
.trial-dialog__captcha img { display: block; width: 100%; height: 100%; object-fit: cover; }

.login-code-row__send {
  box-sizing: border-box;
  height: 48px;
  color: var(--color-primary-500);
  background: rgb(255 255 255 / 60%);
  border: 1px solid rgb(216 226 242 / 92%);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
}

.login-options {
  display: flex;
  min-height: 24px;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
  color: #526074;
  font-size: 14px;
}

.login-public-demo {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: baseline;
  gap: 4px 10px;
  padding: 10px 12px;
  color: #526074;
  background: #f7f9fc;
  border: 1px solid #e1e7f0;
  border-radius: 6px;
  font-size: 13px;
  line-height: 20px;
}

.login-public-demo strong {
  color: #172033;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-weight: 700;
}

.login-public-demo small {
  grid-column: 1 / -1;
  color: #7a8699;
  font-size: 12px;
}

.login-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.login-check input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary-500);
}

.login-link {
  color: #526074;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 14px;
}

.login-link:hover {
  color: var(--color-primary-500);
}

.login-submit {
  box-sizing: border-box;
  height: 50px;
  margin-top: 6px;
  color: var(--color-white);
  background: linear-gradient(135deg, #2f6bff, #1760ff);
  border: 0;
  border-radius: 6px;
  box-shadow: 0 14px 30px rgb(47 107 255 / 20%);
  cursor: pointer;
  font-size: 15px;
  font-weight: 800;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    opacity 160ms ease;
}

.login-submit:hover {
  box-shadow: 0 16px 34px rgb(47 107 255 / 24%);
  transform: translateY(-1px);
}

.login-submit:disabled {
  cursor: not-allowed;
  opacity: 0.72;
  transform: none;
}

.login-divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  margin-top: 22px;
  color: #7a8699;
  font-size: 13px;
}

.login-divider::before,
.login-divider::after {
  height: 1px;
  background: rgb(218 226 239 / 88%);
  content: "";
}

.login-providers {
  display: flex;
  justify-content: center;
  gap: 18px;
  margin-top: 14px;
}

.login-provider {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: var(--provider-color);
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(218 226 239 / 86%);
  border-radius: 999px;
  cursor: pointer;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.login-provider:hover {
  background: #fff;
  border-color: color-mix(in srgb, var(--provider-color) 28%, #d8e2f2);
  box-shadow: 0 10px 20px color-mix(in srgb, var(--provider-color) 14%, transparent);
  transform: translateY(-1px);
}

.login-provider svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.login-trial {
  box-sizing: border-box;
  width: 100%;
  height: 48px;
  margin-top: 18px;
  color: var(--color-primary-500);
  background: rgb(255 255 255 / 62%);
  border: 1px solid rgb(216 226 242 / 92%);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
}

.login-trial:hover,
.login-code-row__send:hover {
  background: rgb(255 255 255 / 90%);
  border-color: color-mix(in srgb, var(--color-primary-500) 24%, #d8e2f2);
}

.login-trial:disabled { cursor: not-allowed; opacity: .68; }
.login-footer {
  position: absolute;
  right: 0;
  bottom: clamp(24px, 3.4vh, 36px);
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #7a8699;
  font-size: 13px;
  line-height: 20px;
  pointer-events: none;
}

.login-footer span,
.login-footer button {
  white-space: nowrap;
}

.login-footer button {
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  pointer-events: auto;
}

.login-footer button:hover {
  color: var(--color-primary-500);
}

.login-footer__divider {
  color: #9aa4b5;
}

@media (max-width: 1440px) {
  .login-page {
    min-height: 600px;
  }

  .login-panel {
    right: clamp(48px, 8vw, 100px);
    width: 468px;
  }

  .login-card {
    padding: 38px 42px 34px;
  }

  .login-tabs {
    margin-top: 34px;
  }
}

@media (max-width: 1180px) {
  .login-page {
    background:
      linear-gradient(90deg, rgb(245 249 255 / 12%) 0%, rgb(247 251 255 / 82%) 58%, rgb(247 251 255 / 96%) 100%),
      var(--login-bg) 22% center / cover no-repeat,
      #f6faff;
  }

  .login-panel {
    right: clamp(28px, 5vw, 60px);
    width: 440px;
  }
}

@media (max-width: 860px) {
  .login-page {
    min-height: 100vh;
    overflow-y: auto;
    background:
      linear-gradient(180deg, rgb(247 251 255 / 82%) 0%, rgb(247 251 255 / 96%) 58%, #fff 100%),
      var(--login-bg) 31% center / cover no-repeat,
      #f6faff;
  }

  .login-header {
    position: relative;
    top: auto;
    right: auto;
    left: auto;
    padding: 20px 20px 0;
  }

  .login-panel {
    position: relative;
    top: auto;
    right: auto;
    width: min(420px, calc(100vw - 32px));
    margin: 44px auto 92px;
    transform: none;
  }

  .login-card {
    padding: 34px 24px 28px;
    background: rgb(255 255 255 / 94%);
    border-radius: 12px;
  }

  .login-card__header h1 {
    font-size: 24px;
  }

  .login-tabs {
    margin-top: 30px;
  }

  .login-code-row {
    grid-template-columns: 1fr;
  }

  .login-captcha-row, .trial-dialog__captcha { grid-template-columns: 1fr; }

  .login-footer {
    position: relative;
    bottom: auto;
    flex-wrap: wrap;
    gap: 6px 10px;
    padding: 0 20px 18px;
    font-size: 12px;
  }

  .login-footer span:first-child {
    flex-basis: 100%;
    text-align: center;
  }
}
</style>
