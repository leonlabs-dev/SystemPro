# 后端接入指南

English: [INTEGRATION.md](./INTEGRATION.md)

本文给出公开版 SystemPro 管理端接入自有后端所需的最小 HTTP 契约。内容依据当前前端客户端代码整理；它不是正式产品全部业务接口的公开清单。

## 1. 选择运行模式

开发前修改 `public/app-config.js`，或在构建后修改 `dist/app-config.js`：

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

- `appMode: 'api'` 启用 HTTP 登录与领域接口。
- `apiBaseUrl` 只填写 Origin，不包含 `/api`，末尾不加 `/`。
- 生产环境中，空的 `apiBaseUrl` 表示使用同源 `/api/...`。
- `appMode: 'demo'` 使用浏览器本地的有限演示，不请求自有后端。
- 该文件中的所有内容都会被浏览器读取，禁止填写数据库密码、模型 Key、Token 或私有地址。

执行 `npm run dev` 时，Vite 会将 `/api` 代理到 `VITE_DEV_API_TARGET`，未设置时使用上述 `apiBaseUrl`。修改目标地址后需要重新启动 Vite。

## 2. 使用统一响应结构

公共请求客户端期望所有 JSON 接口返回：

```json
{
  "code": "OK",
  "message": "成功",
  "data": {},
  "timestamp": "2026-09-07T10:00:00+08:00"
}
```

成功响应的 `code` 必须是 `OK`。HTTP 非 2xx，或者 `code` 不是 `OK`，前端都会按失败处理。没有响应体的成功操作可以返回 HTTP `204`。

错误示例：

```json
{
  "code": "VALIDATION_ERROR",
  "message": "电表编码已存在",
  "data": null,
  "timestamp": "2026-09-07T10:00:00+08:00"
}
```

错误应同时使用正确的 HTTP 状态码和稳定的业务错误码。身份认证或权限失败不应包装成 HTTP 200。

## 3. 支持公共请求头

前端会发送：

| 请求头 | 含义 |
| --- | --- |
| `Accept: application/json` | 期望 JSON 响应 |
| `Content-Type: application/json` | 请求存在 Body 时发送 |
| `Accept-Language: zh-CN` 或 `en-US` | 响应语言 |
| `X-Request-Id` | 前端生成的请求追踪标识 |
| `Authorization: Bearer <accessToken>` | 受保护接口的访问令牌 |

建议在响应中原样返回 `X-Request-Id`。前端会把服务端返回的标识附加到 API 错误，便于关联日志和排查问题。

如果生产环境的 API 与前端不同源，CORS 需要允许前端 Origin、上述请求头以及实际使用的 HTTP 方法。条件允许时，使用同源反向代理更简单。

## 4. 先完成登录启动链路

最小可用接入应先实现以下接口：

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/settings/parameters/login-policy` | 无 | 获取登录页策略 |
| `POST` | `/api/v1/auth/login` | 无 | 使用账号密码换取令牌 |
| `POST` | `/api/v1/auth/refresh` | 无 | 轮换刷新令牌 |
| `POST` | `/api/v1/auth/logout` | 无 | 吊销刷新令牌 |
| `GET` | `/api/v1/accounts/current` | Bearer | 获取当前账号 |
| `GET` | `/api/v1/clients/current` | Bearer | 获取当前客户上下文 |
| `GET` | `/api/v1/navigation` | Bearer | 获取菜单、权限和数据范围 |

登录请求：

```json
{
  "username": "operator",
  "password": "example-password",
  "captchaId": "可选验证码标识",
  "captchaCode": "可选验证码答案"
}
```

登录与刷新成功后，响应中的 `data` 使用以下结构：

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
    "displayName": "园区运营人员",
    "roles": ["OPERATOR"],
    "forceChangePassword": false
  }
}
```

刷新和退出请求均使用：

```json
{
  "refreshToken": "current-refresh-token"
}
```

访问令牌只保存在内存中。刷新令牌默认保存在 `sessionStorage`；用户选择持久登录时保存在 `localStorage`。受保护请求返回 HTTP 401 后，客户端会尝试刷新一次，并将原请求重试一次。

导航响应是页面入口与前端操作权限的来源：

```json
{
  "menus": [
    {
      "id": 1,
      "code": "ENERGY",
      "name": "能源管理",
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

前端显隐不是安全边界。每一个受保护的后端操作仍须校验当前登录客户、租户、项目、资源归属、操作权限和业务状态。

## 5. 遵循分页契约

列表接口使用从 1 开始的 `page` 和 `pageSize` 查询参数，响应 `data` 为：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

运营数据应在服务端完成筛选和分页。关系编辑器等引用型数据可能连续读取多页，直到 `items.length >= total`。

## 6. 先接通一个领域闭环

电表适合作为第一个垂直闭环，因为它同时覆盖列表、详情、新增、修改、乐观锁版本和删除：

| 方法 | 路径 | 预期结果 |
| --- | --- | --- |
| `GET` | `/api/v1/meters?page=1&pageSize=12` | 电表分页数据 |
| `GET` | `/api/v1/meters/statistics` | 电表统计 |
| `GET` | `/api/v1/meters/{id}` | 单个电表 |
| `POST` | `/api/v1/meters` | 新增后的电表 |
| `PUT` | `/api/v1/meters/{id}` | 修改后的电表 |
| `DELETE` | `/api/v1/meters/{id}?version={version}` | HTTP 204 或 `OK` 响应 |

当前 DTO 与映射位于 `src/domain/iot/assets/meter/meter.api.ts`。接入其他领域时，以 `src/domain/**/api` 和 `*.api.ts` 中的 TypeScript 请求模块作为当前字段的可执行依据。

## 7. 验证接入结果

1. 打开 `/api/v1/settings/parameters/login-policy`，确认返回 `OK` 响应。
2. 登录并确认账号、客户上下文和导航请求全部成功。
3. 确认受保护请求携带 Bearer Token。
4. 让访问令牌过期，验证一次刷新和一次原请求重试。
5. 验证越过客户或项目范围访问资源时返回 HTTP 403。
6. 完成一个领域的列表、详情、新增、修改和删除流程。
7. 部署前执行 `npm run build` 和 `npm run test:ui-contracts`。

运行时配置和数据安全规则另见[运行时配置](./CONFIGURATION.md)与[数据边界](./DATA_BOUNDARIES.md)。

