# Configuration

SystemPro uses one public runtime entry: `public/app-config.js`.
The file is copied unchanged to `dist/app-config.js`, so API origins, public demo credentials, and product metadata can be replaced after `npm run build` without rebuilding JavaScript bundles.

```js
window.__SYSTEMPRO_PUBLIC_CONFIG__ = {
  appMode: 'api',
  appName: 'SystemPro',
  appDescription: '...',
  projectUrl: '...',
  apiBaseUrl: 'https://your-api.example.com',
  publicDemoAccount: {
    enabled: true,
    username: 'your-public-demo-user',
    password: 'your-public-demo-password',
  },
};
```

`apiBaseUrl` contains only the origin. The application appends paths such as `/api/v1/auth/login`. An empty value uses same-origin `/api` requests.

All values in this file are downloaded by every visitor. They are configuration, not secrets. A public demo account must therefore be isolated, non-administrative, rate-limited, prohibited from accessing customer data, and safe to reset at any time. Client/Tenant and RBAC enforcement remains the backend's responsibility.

## Local start

```bash
npm install
npm run dev
```

The checked-in runtime configuration connects to the hosted public demonstration service. During `npm run dev`, Vite reads the same `public/app-config.js` and proxies same-origin `/api` requests to its `apiBaseUrl`, avoiding browser CORS restrictions without duplicating the API address. Restart Vite after changing the runtime configuration.

For a separately hosted production frontend, either serve `/api` through the same-origin reverse proxy or allow that exact frontend origin in the backend CORS policy. To use a different compatible backend, edit only `public/app-config.js`.

## Offline demo mode

Set `appMode` to `demo` in `public/app-config.js` when the application must start without any backend. The application creates a browser-local, read-only session that exposes only the public Welcome and Workbench routes. Those local values are product walkthrough data, not production measurements.

## Build-time fallbacks

`.env.example` documents optional build and development fallbacks. `VITE_DEV_API_TARGET` is useful for a local Vite proxy; `VITE_ASSET_BASE_URL` controls the compiled asset base. Runtime API and public account changes should normally be made in `app-config.js`.

The compatible backend, database, and Liquibase lifecycle are intentionally not part of this frontend repository.
