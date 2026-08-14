<p align="center">
  <img src="./logo.png" width="96" alt="systemPro" />
</p>

<h1 align="center">systemPro</h1>
<p align="center">面向光储充行业的一体化能源运营平台</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vuedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-4.x-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Element%20Plus-UI-409EFF" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey" />
</p>

<p align="center">
  <a href="http://console.systempro.site">在线体验</a> ·
  <a href="http://systempro.site">官网</a> ·
  <a href="#快速开始">快速开始</a>
</p>

---

## 目录

- [体验地址](#体验地址)
- [核心特性](#核心特性)
- [界面速览](#界面速览)
- [快速开始](#快速开始)
- [功能模块导览](#功能模块导览)
  - 总览
  - 设备与能源
  - 财务账单
  - 平台能力
- [技术栈](#技术栈)
- [License](#license)

---

## 体验地址

| | |
| --- | --- |
| 体验地址 | [console.systempro.site](http://console.systempro.site) |
| 体验账号 | `system` |
| 体验密码 | `12345678` |

> 演示账号为公开只读账号，账号密码在页面源码和请求中始终可见，不涉及真实安全凭据。

官网：[systempro.site](http://systempro.site)

---

## 核心特性

systemPro 面向园区、楼宇、工厂和能源项目，提供设备接入、能源计量、告警工单、财务中心、账单管理与多租户权限管理的一体化运营能力。

| 能力 | 说明 |
| --- | --- |
| 多维度驾驶舱 | 双碳·光储充一体化驾驶舱与综合运营看板，管理层一屏看懂经营与能源状况 |
| 全设备资产管理 | 电表、水表、空调、照明、停车、充电、光伏、储能，八大类设备统一建档 |
| 分项计量与损耗分析 | 真实供电拓扑加分项计量口径，用能账目可追溯到每一处空间和租户 |
| 告警转工单闭环 | 从规则配置、转工单到历史统计，形成完整处理闭环 |
| 财务全流程 | 银企直连、收款核销、调账退款、开票管理，业务与财务数据打通 |
| 多租户与权限体系 | 组织架构、空间层级、RBAC 角色权限、SSO 绑定，企业级多租户基础设施 |
| 部署无需重新打包 | 接口地址通过运行时配置文件管理，切换部署环境无需重新构建前端 |

---

## 界面速览

<p align="center">
  <img src="./assets/screenshots/欢迎.png" width="800" alt="欢迎页" />
</p>

<p align="center"><i>systemPro 企业数智运营平台 —— 融合 ERP 业务管理与 IoT 设备连接</i></p>

---

## 快速开始

**环境要求**

- Node.js ≥ 18（建议使用 LTS 版本）
- npm / pnpm 均可

**本地开发**

```bash
npm install
npm run dev
```

启动后默认访问 `http://127.0.0.1:5173`；端口被占用时 Vite 会自动切换到下一个可用端口，以终端输出为准。

**生产构建**

```bash
npm run build
npm run preview
```

构建产物输出至 `dist/` 目录，可直接部署至 Nginx 或任意静态资源服务器。

**接口配置**

接口地址通过运行时配置文件 `public/app-config.js` 管理，构建时原样复制到 `dist/app-config.js`——切换部署环境的接口地址无需重新打包前端。

```js
window.__SYSTEMPRO_PUBLIC_CONFIG__ = {
  apiBaseUrl: 'https://your-backend-domain.com', // 仅填写源地址，具体接口路径由应用自动拼接
}
```

本地开发时可将 `apiBaseUrl` 指向自己的后端服务；也可以直接使用官方演示后端 `http://console.systempro.site` 体验只读数据，演示账号见上方"体验地址"。

---

## 功能模块导览

### 总览

<table>
<tr>
<td width="55%">

**欢迎**

平台概览、模块索引、系统架构和接入路线的统一入口。

</td>
<td width="45%"><img src="./assets/screenshots/欢迎.png" width="360"/></td>
</tr>
</table>

<table>
<tr>
<td width="55%">

**双碳·光储充一体化驾驶舱**

融合双碳指标、光伏、储能与充电运营数据的一体化能源驾驶舱，独立窗口打开，一屏掌握园区能源全貌。

</td>
<td width="45%"><img src="./assets/screenshots/驾驶舱.png" width="360"/></td>
</tr>
</table>

<table>
<tr>
<td width="55%">

**综合运营看板**

跨 IoT、能源和经营指标的综合运营看板，项目分布、经营效益、风险预警一目了然。

</td>
<td width="45%"><img src="./assets/screenshots/综合运营看板.png" width="360"/></td>
</tr>
</table>

### 设备与能源

<table>
<tr>
<td width="55%">

**设备资产**

统一管理电表、水表、空调、照明、停车、充电、光伏和储能资产档案，覆盖多联机空调、电表预付费等常见场景，照明分区与场景联动同样纳入统一档案。

</td>
<td width="45%"><img src="./assets/screenshots/新增空调2.png" width="360"/></td>
</tr>
</table>

<details>
<summary>查看更多设备资产截图</summary>
<p align="center">
  <img src="./assets/screenshots/电表.png" width="480"/>
  <img src="./assets/screenshots/新增空调系统.png" width="480"/>
</p>
</details>

<table>
<tr>
<td width="55%">

**能源流向**

能源拓扑图与光储能源概览，实时呈现光伏、储能、负载和公共电网的能量平衡。

</td>
<td width="45%"><img src="./assets/screenshots/能源拓扑.png" width="360"/></td>
</tr>
</table>

<details>
<summary>查看更多能源流向截图</summary>
<p align="center">
  <img src="./assets/screenshots/光储充能源概览.png" width="480"/>
</p>
</details>

<table>
<tr>
<td width="55%">

**能源计量**

维护总分表拓扑与分项计量口径，管理计费方案与计费开通，用能账目可追溯到每一个空间和租户。

</td>
<td width="45%"><img src="./assets/screenshots/计费开通.png" width="360"/></td>
</tr>
</table>

<details>
<summary>查看更多能源计量截图</summary>
<p align="center">
  <img src="./assets/screenshots/新增计费方案.png" width="480"/>
  <img src="./assets/screenshots/新增计费开通1.png" width="480"/>
</p>
</details>

<table>
<tr>
<td width="55%">

**运营监控**

设备实时监控、网关/链路状态、并离网切换与视频监控接入，运行状态一屏统管。

</td>
<td width="45%"><img src="./assets/screenshots/并离网切换状态.png" width="360"/></td>
</tr>
</table>

<details>
<summary>查看更多运营监控截图</summary>
<p align="center">
  <img src="./assets/screenshots/停车场监控.png" width="480"/>
</p>
</details>

<table>
<tr>
<td width="55%">

**告警工单**

从告警规则配置、告警转工单到历史告警统计，形成闭环处理机制，告警不再石沉大海。

</td>
<td width="45%"><img src="./assets/screenshots/告警.png" width="360"/></td>
</tr>
</table>

### 财务账单

<table>
<tr>
<td width="55%">

**财务中心**

银企直连、收款核销、调账退款与开票管理，真实银行流水与应收账单自动匹配核销。

</td>
<td width="45%"><img src="./assets/screenshots/银企直连.png" width="360"/></td>
</tr>
</table>

<table>
<tr>
<td width="55%">

**账单管理**

依据冻结用量和生效费率生成可追溯账单，跟踪账单支付、开票、逾期和关闭状态。

</td>
<td width="45%"><img src="./assets/screenshots/账单.png" width="360"/></td>
</tr>
</table>

### 平台能力

<table>
<tr>
<td width="55%">

**用户权限**

账号、角色、菜单权限、操作权限、数据权限与 SSO 绑定，企业级 RBAC 权限体系。

</td>
<td width="45%"><img src="./assets/screenshots/角色权限.png" width="360"/></td>
</tr>
</table>

<details>
<summary>查看更多用户权限截图</summary>
<p align="center">
  <img src="./assets/screenshots/菜单权限.png" width="480"/>
  <img src="./assets/screenshots/菜单按钮级权限.png" width="480"/>
  <img src="./assets/screenshots/操作权限.png" width="480"/>
  <img src="./assets/screenshots/数据权限.png" width="480"/>
</p>
</details>

<table>
<tr>
<td width="55%">

**组织项目**

组织架构树、部门岗位、空间层级与租户客户档案，物理空间与组织关系解耦管理。

</td>
<td width="45%"><img src="./assets/screenshots/组织项目.png" width="360"/></td>
</tr>
</table>

<details>
<summary>查看更多组织项目截图</summary>
<p align="center">
  <img src="./assets/screenshots/空间层级.png" width="480"/>
</p>
</details>

<table>
<tr>
<td width="55%">

**系统设置**

基础参数、数据字典、多语言管理与操作日志审计，支持深浅色主题与导航布局自定义。

</td>
<td width="45%"><img src="./assets/screenshots/基础参数.png" width="360"/></td>
</tr>
</table>

<details>
<summary>查看更多系统设置截图</summary>
<p align="center">
  <img src="./assets/screenshots/多语言管理.png" width="480"/>
  <img src="./assets/screenshots/风格设置.png" width="480"/>
  <img src="./assets/screenshots/导航设置.png" width="480"/>
</p>
</details>

---

## 技术栈

<p align="left">
  <img src="https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vuedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-4.x-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Element%20Plus-UI-409EFF" />
</p>

| 技术 | 用途 |
| --- | --- |
| Vue 3 + TypeScript | 核心框架，组合式 API |
| Vite 4 | 构建与开发服务器 |
| Pinia + Vue Router | 状态管理与路由 |
| Element Plus | 组件库 |
| ECharts | 数据可视化（能源流向、驾驶舱图表） |
| vue-i18n | 国际化 |

---

## License

<!-- 待补充：许可证类型 -->

---

<p align="center"><sub>systemPro —— 让能源数据说人话</sub></p>
