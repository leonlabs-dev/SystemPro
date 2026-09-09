# Backend Integration Guide

简体中文：[INTEGRATION.zh-CN.md](./INTEGRATION.zh-CN.md)

This guide defines the minimum HTTP contract required to connect the public SystemPro console to your own backend. It is based on the current frontend client code; it is not a promise that every product-domain endpoint is part of the public repository.

## 1. Choose the runtime mode

Edit `public/app-config.js` before development or edit `dist/app-config.js` after building:

```js
window.__SYSTEMPRO_PUBLIC_CONFIG__ = {
  appMode: 'api',
  apiBaseUrl: 'https://api.example.com',
  publicDemoAccount: {
    enabled: false,
    username: '',
    password: '',
  },
}
```

- `appMode: 'api'` enables HTTP authentication and domain APIs.
- `apiBaseUrl` is an origin, without `/api` and without a trailing slash.
- An empty `apiBaseUrl` uses same-origin `/api/...` requests in production.
- `appMode: 'demo'` uses the limited browser-local walkthrough and does not call your backend.
- Everything in this file is public. Never put database passwords, model keys, tokens, or private endpoints here.

During `npm run dev`, Vite proxies `/api` to `VITE_DEV_API_TARGET` or to the `apiBaseUrl` declared above. Restart Vite after changing the target.

## 2. Use the standard response envelope

Every JSON endpoint used by the shared client returns this shape:

```json
{
  "code": "OK",
  "message": "Success",
  "data": {},
  "timestamp": "2026-09-07T10:00:00+08:00"
}
```

`code` must equal `OK` for a successful JSON response. The frontend treats a non-2xx status or any other code as an error. A successful endpoint with no response body may return HTTP `204`.

Example error:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "The meter code already exists",
  "data": null,
  "timestamp": "2026-09-07T10:00:00+08:00"
}
```

Use an appropriate HTTP status as well as a stable application code. Do not return HTTP 200 for failed authentication or authorization.

## 3. Support the common request headers

The frontend sends:

| Header | Meaning |
| --- | --- |
| `Accept: application/json` | JSON response expected |
| `Content-Type: application/json` | Sent when a request has a body |
| `Accept-Language: zh-CN` or `en-US` | Preferred response language |
| `X-Request-Id` | Client-generated trace identifier |
| `Authorization: Bearer <accessToken>` | Sent by authenticated requests |

Echo `X-Request-Id` in the response when practical. The frontend attaches the returned identifier to API errors, which makes support and log correlation easier.

For a separate production API origin, allow the console origin, the headers above, and the required HTTP methods in CORS. A same-origin reverse proxy is usually simpler.

## 4. Implement the authentication bootstrap

The smallest useful API integration implements these endpoints first:

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/settings/parameters/login-policy` | No | Configure login options |
| `POST` | `/api/v1/auth/login` | No | Exchange credentials for tokens |
| `POST` | `/api/v1/auth/refresh` | No | Rotate a refresh token |
| `POST` | `/api/v1/auth/logout` | No | Revoke the refresh token |
| `GET` | `/api/v1/accounts/current` | Bearer | Load the current account |
| `GET` | `/api/v1/clients/current` | Bearer | Load the current client context |
| `GET` | `/api/v1/navigation` | Bearer | Load menus, permissions, and data scopes |

Login request:

```json
{
  "username": "operator",
  "password": "example-password",
  "captchaId": "optional-challenge-id",
  "captchaCode": "optional-answer"
}
```

The `data` of a successful login or refresh response has this shape:

```json
{
  "accessToken": "short-lived-access-token",
  "refreshToken": "rotated-refresh-token",
  "tokenType": "Bearer",
  "accessTokenExpiresAt": "2026-09-07T10:15:00+08:00",
  "refreshTokenExpiresAt": "2026-09-14T10:00:00+08:00",
  "user": {
    "accountId": 1001,
    "clientId": 10,
    "clientCode": "PARK_A",
    "tenantId": null,
    "tenantIds": [],
    "username": "operator",
    "displayName": "Park Operator",
    "roles": ["OPERATOR"],
    "forceChangePassword": false
  }
}
```

Refresh and logout requests use:

```json
{
  "refreshToken": "current-refresh-token"
}
```

Access tokens remain in memory. The refresh token is stored in `sessionStorage` by default or in `localStorage` when the user chooses a persistent login. When an authenticated request returns HTTP 401, the client attempts one refresh and retries the original request once.

The navigation response is authoritative for page entry and UI actions:

```json
{
  "menus": [
    {
      "id": 1,
      "code": "ENERGY",
      "name": "Energy",
      "type": "CATALOG",
      "path": "/energy",
      "keepAlive": false,
      "children": []
    }
  ],
  "permissions": ["meter:read"],
  "dataScopes": ["project:100"]
}
```

Frontend visibility is not a security boundary. Validate the authenticated client, tenant, project, resource ownership, permission, and workflow state again on every protected backend operation.

## 5. Follow the pagination contract

List endpoints use one-based `page` and a `pageSize` query parameter. Their `data` is:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

Keep filtering and pagination on the server for operational datasets. Reference selectors may deliberately request successive pages until `items.length >= total`.

## 6. Integrate one domain slice before the whole console

Meters are a useful first vertical slice because they exercise list, detail, create, update, optimistic versioning, and delete behavior:

| Method | Path | Expected result |
| --- | --- | --- |
| `GET` | `/api/v1/meters?page=1&pageSize=12` | Paginated meter records |
| `GET` | `/api/v1/meters/statistics` | Meter summary |
| `GET` | `/api/v1/meters/{id}` | One meter record |
| `POST` | `/api/v1/meters` | Created meter record |
| `PUT` | `/api/v1/meters/{id}` | Updated meter record |
| `DELETE` | `/api/v1/meters/{id}?version={version}` | HTTP 204 or an `OK` envelope |

The current DTO and mapping are in `src/domain/iot/assets/meter/meter.api.ts`. Treat the TypeScript API modules under `src/domain/**/api` and `*.api.ts` as the executable reference for fields while integrating a domain.

## 7. Verify the connection

1. Open `/api/v1/settings/parameters/login-policy` and confirm an `OK` envelope.
2. Sign in and verify that account, client, and navigation requests succeed.
3. Confirm that a protected request carries a Bearer token.
4. Expire an access token and verify one refresh plus one retry.
5. Verify that a forbidden cross-client or cross-project resource returns HTTP 403.
6. Exercise one domain list, detail, create, update, and delete flow.
7. Run `npm run build` and `npm run test:ui-contracts` before deployment.

For runtime configuration and data-safety rules, also read [CONFIGURATION.md](./CONFIGURATION.md) and [DATA_BOUNDARIES.md](./DATA_BOUNDARIES.md).

