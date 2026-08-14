import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const env = loadEnv(mode, root, 'VITE_');
  const runtimeConfig = loadPublicRuntimeConfig(root);
  const configuredAssetBase = env.VITE_ASSET_BASE_URL?.trim();
  const devApiTarget = env.VITE_DEV_API_TARGET?.trim() || runtimeConfig.apiBaseUrl?.trim();
  const devApiOrigin = devApiTarget ? new URL(devApiTarget).origin : '';
  const assetBase = configuredAssetBase
    ? `${configuredAssetBase.replace(/\/+$/, '')}/`
    : '/';

  return {
  base: assetBase,
  root,
  appType: 'spa',
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: devApiTarget ? {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyRequest) => {
            // A browser JSON POST includes the local development Origin header.
            // Present the target origin to the API so its production CORS policy
            // does not reject an otherwise same-origin development proxy request.
            proxyRequest.setHeader('Origin', devApiOrigin);
          });
        },
      },
    } : undefined,
  },
  build: {
    manifest: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (normalizedId.includes('/node_modules/echarts/') || normalizedId.includes('/node_modules/zrender/')) {
            return 'echarts';
          }
          if (normalizedId.includes('/node_modules/china-geojson/')) {
            return 'china-map';
          }
          if (/\/node_modules\/(vue|vue-router|pinia|vue-i18n|@vue|@intlify)\//.test(normalizedId)) {
            return 'vue';
          }
          return undefined;
        },
      },
    },
  },
  };
});

function loadPublicRuntimeConfig(root: string) {
  const sandbox: { window: { __SYSTEMPRO_PUBLIC_CONFIG__?: { apiBaseUrl?: string } } } = { window: {} };
  const configPath = fileURLToPath(new URL('./public/app-config.js', new URL(`file:///${root.replace(/\\/g, '/')}/`)));
  runInNewContext(readFileSync(configPath, 'utf8'), sandbox, { filename: configPath });
  return sandbox.window.__SYSTEMPRO_PUBLIC_CONFIG__ ?? {};
}
