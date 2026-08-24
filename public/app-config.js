/**
 * SystemPro public runtime configuration.
 *
 * This file is delivered to every browser and must never contain a secret.
 * It is copied to dist/app-config.js unchanged, so a deployer can replace these
 * values after building without rebuilding the frontend bundle.
 */
window.__SYSTEMPRO_PUBLIC_CONFIG__ = {
  appMode: 'api',
  appName: 'SystemPro',
  appDescription: 'SystemPro enterprise operations platform for IoT, energy and business workflows.',
  projectUrl: 'https://gitee.com/sitepulse/system-pro',

  // Use the origin only. API paths such as /api/v1/auth/login are appended by the application.
  apiBaseUrl: 'https://console.systempro.site',

  // The browser never contains a model key. Turn this on only after apiBaseUrl
  // points to a backend whose AI service and server-side model key are ready.
  aiAssistantEnabled: false,

  // Public demonstration credentials. These values are intentionally visible
  // in page source and browser requests; they are not security credentials.
  publicDemoAccount: {
    enabled: true,
    username: 'system',
    password: '12345678',
  },
};
