import packageMetadata from '../../../package.json';

export type AppMode = 'demo' | 'api';

export type PublicDemoAccount = {
  enabled: boolean;
  username: string;
  password: string;
};

function readEnv(name: keyof ImportMetaEnv) {
  return String(import.meta.env[name] ?? '').trim();
}

function readRuntimeConfig() {
  if (typeof window === 'undefined') return {} as SystemProPublicRuntimeConfig;
  return window.__SYSTEMPRO_PUBLIC_CONFIG__ ?? {};
}

function readText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOrigin(value: string) {
  return value.replace(/\/+$/, '');
}

const runtimeConfig = readRuntimeConfig();
const configuredMode = readText(runtimeConfig.appMode || readEnv('VITE_APP_MODE')).toLowerCase();
const configuredPublicAccount = runtimeConfig.publicDemoAccount;
const configuredAiAssistantEnabled = runtimeConfig.aiAssistantEnabled ?? readEnv('VITE_AI_ASSISTANT_ENABLED');

export const appMode: AppMode = configuredMode === 'api' ? 'api' : 'demo';
export const isDemoMode = appMode === 'demo';
export const appName = readText(runtimeConfig.appName) || readEnv('VITE_APP_NAME') || 'SystemPro';
export const appDescription = readText(runtimeConfig.appDescription) || readEnv('VITE_APP_DESCRIPTION')
  || 'SystemPro enterprise operations platform for IoT, energy and business workflows.';
export const appVersion = packageMetadata.version;
export const projectUrl = readText(runtimeConfig.projectUrl) || readEnv('VITE_PROJECT_URL')
  || 'https://gitee.com/sitepulse/system-pro';
const configuredApiBaseUrl = normalizeOrigin(readText(runtimeConfig.apiBaseUrl) || readEnv('VITE_API_BASE_URL'));
// Development requests stay same-origin and are forwarded by Vite to the API
// origin declared in public/app-config.js. Production uses the configured origin.
export const apiBaseUrl = import.meta.env.DEV ? '' : configuredApiBaseUrl;
export const aiAssistantEnabled = configuredAiAssistantEnabled === true
  || String(configuredAiAssistantEnabled).trim().toLowerCase() === 'true';
export const publicDemoAccount: PublicDemoAccount = {
  enabled: appMode === 'api'
    && configuredPublicAccount?.enabled === true
    && Boolean(readText(configuredPublicAccount.username))
    && Boolean(readText(configuredPublicAccount.password)),
  username: readText(configuredPublicAccount?.username),
  password: readText(configuredPublicAccount?.password),
};
