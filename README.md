# SystemPro Admin Frontend

SystemPro 管理端是 Client 侧企业数字运营控制台，覆盖账号权限、组织空间、租户、系统设置、审计及 ERP + IoT 业务入口。它不是 Platform 跨 Client 运营后台；普通管理方只能访问当前 Client 数据。

## 技术栈

- Vue 3 + TypeScript
- Vite 4
- Pinia + Vue Router
- vue-i18n
- Element Plus
- ECharts

## 已有能力

- 登录、图形验证码、体验账号、会话刷新和账号记忆
- 账号、角色 / RBAC、菜单权限、第三方身份源
- 组织架构、岗位、空间层级、租户 / 客户档案
- 基础参数、业务数据字典、操作与登录审计
- 工作台、亮暗主题、侧边/顶部/混合导航和中英文切换
- 按菜单、操作权限和数据范围控制页面能力

能源、设备、计量和告警域尚未全部接入真实业务接口。工作台仅在这些未闭环区域使用隔离 Provider 演示数据，并明确标识；账号、权限、审计和登录地域等已有能力使用真实后端数据。

## 本地启动

```powershell
cd D:\AstraOS\systempro-admin-frontend
npm install
npm run dev
```

Vite 首选 `http://127.0.0.1:5173`；端口占用时会选择后续端口，以终端输出为准。

生产构建：

```powershell
npm run build
npm run preview
```

## 后端联调

后端默认地址为 `http://127.0.0.1:8080`。先启动 `systempro-backend-java`，并确认：

- `http://127.0.0.1:8080/actuator/health`
- `http://127.0.0.1:8080/swagger-ui.html`

后端数据库密码只通过环境变量提供：

```powershell
$env:SYSTEMPRO_DB_PASSWORD = '<your-mysql-password>'
```

不要把真实密码、Token 或第三方 Secret 写进 `.env` 示例、代码或文档。

## 工程约束

- 静态文案使用 vue-i18n；业务枚举与动态名称由后端按 `Accept-Language` 本地化。
- 页面复用 `src/design-system`、领域 service/provider 和权限能力，不在单页复制组件。
- 亮色、暗色、中文、英文、侧栏展开/收起及 1440×900、1920×1080 均需验证。
- 无操作权限的按钮保持可见并禁用；后端仍进行最终鉴权。
- 提交前执行 `npm run build`，并对关键真实 API 做浏览器冒烟测试。

内部架构、UI 规范、启动部署和交接文档位于同级 `systempro-docs`，不在公开仓库维护实现过程文档。
