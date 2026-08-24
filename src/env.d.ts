/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: 'demo' | 'api';
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_DESCRIPTION?: string;
  readonly VITE_PROJECT_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ASSET_BASE_URL?: string;
  readonly VITE_DEV_API_TARGET?: string;
  readonly VITE_AI_ASSISTANT_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type SystemProPublicRuntimeConfig = {
  appMode?: 'demo' | 'api';
  appName?: string;
  appDescription?: string;
  projectUrl?: string;
  apiBaseUrl?: string;
  aiAssistantEnabled?: boolean;
  publicDemoAccount?: {
    enabled?: boolean;
    username?: string;
    password?: string;
  };
};

interface Window {
  __SYSTEMPRO_PUBLIC_CONFIG__?: SystemProPublicRuntimeConfig;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
