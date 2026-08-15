<p align="center">
  <img src="./logo.png" width="88" alt="systemPro" />
</p>

<h1 align="center">systemPro</h1>

<p align="center">
  <b>企业级能源物联网运营平台</b><br />
  <sub>设备物联 · 能源计量 · 暖通集中控制 · 财务结算 · 权限治理</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vuedotjs&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Vite-4.x-646CFF?logo=vite&logoColor=white" alt="Vite 4" />
  <img src="https://img.shields.io/badge/Element%20Plus-UI-409EFF" alt="Element Plus" />
  <img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg?logo=apache&logoColor=white" alt="Apache License 2.0" />
</p>

<br/>

<p align="center">
  <b>在线体验</b>&nbsp;&nbsp;<a href="http://console.systempro.site">console.systempro.site</a><br/><br/>
  <b>账号</b>&nbsp;<code>system</code>&nbsp;&nbsp;&nbsp;<b>密码</b>&nbsp;<code>12345678</code><br/><br/>
  <b>官网</b>&nbsp;&nbsp;<a href="http://systempro.site">systempro.site</a><br/><br/>
  <b>源码仓库</b>&nbsp;&nbsp;<a href="https://gitee.com/sitepulse/system-pro">gitee.com/sitepulse/system-pro</a>
</p>

<p align="center"><sub>演示账号为公开只读账号，账号密码在页面源码和请求中始终可见，不涉及真实安全凭据。</sub></p>

<br/>

systemPro 是一套面向光储充（光伏 · 储能 · 充电）行业的 IoT 能源管理 SaaS 平台，服务园区、楼宇、工厂等场景的能源运营。从设备接入、分项计量、暖通集中控制，到财务结算与组织权限治理，systemPro 将原本分散在不同系统中的设备、能源、账目与人员统一收敛至同一平台，支撑运营方由「设备分散、账目不清」向「集中可控、账实一致」演进。

<br/>

## 核心能力

| 能力域 | 说明 |
| --- | --- |
| 一体化能源驾驶舱 | 双碳指标与光储充一体化看板，经营与能源指标一屏总览 |
| 八类设备统一建档 | 电表、水表、空调、照明、停车、充电、光伏、储能资产档案统一纳管 |
| 空调集中控制 | 中央空调、多联机与新风系统统一纳管，分区控制与场景联动 |
| 分项计量与损耗分析 | 真实供电拓扑与分项计量口径，用能账目追溯至空间与租户 |
| 告警转工单闭环 | 规则配置、转工单与历史统计，形成完整处理闭环 |
| 财务全流程 | 银企直连、收款核销、调账退款与开票管理，业务与财务数据互通 |
| 多租户与权限体系 | 组织架构、空间层级、RBAC 权限与 SSO 绑定 |
| 部署无需重新打包 | 接口地址运行时配置，切换环境无需重新构建前端 |

<br/><br/>

## 功能导览

### 总览

#### 平台首页

欢迎与模块索引是平台的统一入口，聚合设备、能源、财务与平台能力各业务模块的概览与导航。

<p align="center">
  <img src="./assets/screenshots/欢迎.png" width="760" alt="平台首页" />
</p>

<br/>

#### 能源驾驶舱

双碳·光储充一体化驾驶舱，融合经营、能源与 IoT 指标，支撑经营与能源指标一屏总览。

<p align="center">
  <img src="./assets/screenshots/驾驶舱.png" width="760" alt="双碳·光储充一体化驾驶舱" />
</p>

<br/><br/>

### 设备与能源

#### 空调设备 · 集中控制

面向空调系统的统一纳管与集中控制：覆盖中央空调、分体空调、多联机与新风系统，单台设备的接入档案、运行状态与所属系统完整呈现；整栋楼宇的分区策略与场景联动集中配置，由「单机分散管理」演进为「集中可控、场景联动」。

**设备总览**

集中控制台统一展示空调设备清单、在线状态与运行数据，支持按系统、空间和档案状态筛选，批量下发控制指令。

<p align="center">
  <img src="./assets/screenshots/空调卡片.png" width="760" alt="空调设备总览" />
</p>

<br/>

**新增空调设备**

维护单台空调设备的接入参数、所属系统与运行档案，设备与所属空间、系统的归属关系一次录入。

<p align="center">
  <img src="./assets/screenshots/新增空调2.png" width="760" alt="新增空调设备" />
</p>

<br/>

**新增空调系统**

配置空调系统的组成、控制策略与所属分区，支持多联机等多种系统形态的统一建档。

<p align="center">
  <img src="./assets/screenshots/新增空调系统.png" width="760" alt="新增空调系统" />
</p>

<br/>

#### 设备资产

电表、水表、空调、照明、停车、充电、光伏、储能八类设备资产统一建档，维护总表分表关系、倍率与采集状态，覆盖电表预付费等常见场景，照明分区与场景联动同样纳入统一档案。

<p align="center">
  <img src="./assets/screenshots/电表.png" width="760" alt="电表管理" />
</p>

<br/>

#### 能源流向

能源拓扑图实时呈现光伏、储能、负载与公共电网的能量平衡。

<p align="center">
  <img src="./assets/screenshots/能源拓扑.png" width="760" alt="能源拓扑图" />
</p>

<br/>

#### 能源计量

维护总分表拓扑与分项计量口径，管理计费方案与计费开通，用能账目可追溯至空间与租户。

<p align="center">
  <img src="./assets/screenshots/计费开通.png" width="760" alt="计费开通" />
</p>

<br/>

#### 运营监控

设备实时监控、网关/链路状态、并离网切换与视频监控接入，运行状态集中管控。

<p align="center">
  <img src="./assets/screenshots/并离网切换状态.png" width="760" alt="并离网切换状态" />
</p>

<br/>

#### 告警工单

覆盖告警规则配置、告警转工单与历史告警统计，形成闭环处理机制，处理全程可追溯。

<p align="center">
  <img src="./assets/screenshots/告警.png" width="760" alt="历史告警统计" />
</p>

<br/><br/>

### 财务账单

#### 财务中心

银企直连、收款核销、调账退款与开票管理，真实银行流水与应收账单自动匹配核销。

<p align="center">
  <img src="./assets/screenshots/银企直连.png" width="760" alt="财务中心 · 银企直连" />
</p>

<br/>

#### 账单管理

依据冻结用量和生效费率生成可追溯账单，跟踪账单支付、开票、逾期和关闭状态。

<p align="center">
  <img src="./assets/screenshots/账单.png" width="760" alt="账单管理" />
</p>

<br/><br/>

### 平台能力

#### 用户权限

账号、角色、菜单、操作与数据权限构成企业级 RBAC 体系，权限粒度细化至按钮级操作。

<p align="center">
  <img src="./assets/screenshots/角色权限.png" width="760" alt="角色权限" />
</p>

<br/>

#### 组织项目

组织架构树、部门岗位、空间层级与租户客户档案，物理空间与组织关系解耦管理。

<p align="center">
  <img src="./assets/screenshots/组织项目.png" width="760" alt="组织项目" />
</p>

<br/>

#### 系统设置

基础参数、数据字典与国际化，支持深浅色主题与导航布局自定义。

<p align="center">
  <img src="./assets/screenshots/基础参数.png" width="760" alt="基础参数" />
</p>

<br/><br/>

## 更多界面

<table>
<tr>
<td align="center" width="33%"><img src="./assets/screenshots/综合运营看板.png" width="220" alt="综合运营看板" /><br/><sub>综合运营看板</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/光储充能源概览.png" width="220" alt="光储充能源概览" /><br/><sub>光储充能源概览</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/新增计费方案.png" width="220" alt="新增计费方案" /><br/><sub>新增计费方案</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="./assets/screenshots/新增计费开通1.png" width="220" alt="新增计费开通" /><br/><sub>新增计费开通</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/停车场监控.png" width="220" alt="停车场监控" /><br/><sub>停车场监控</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/菜单权限.png" width="220" alt="菜单权限" /><br/><sub>菜单权限</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="./assets/screenshots/操作权限.png" width="220" alt="操作权限" /><br/><sub>操作权限</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/数据权限.png" width="220" alt="数据权限" /><br/><sub>数据权限</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/菜单按钮级权限.png" width="220" alt="菜单按钮级权限" /><br/><sub>菜单按钮级权限</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="./assets/screenshots/空间层级.png" width="220" alt="空间层级" /><br/><sub>空间层级</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/多语言管理.png" width="220" alt="国际化" /><br/><sub>国际化</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/照明设备.png" width="220" alt="照明设备" /><br/><sub>照明设备</sub></td>
</tr>
</table>

<br/><br/>

## 快速开始

环境要求：Node.js ≥ 18（建议使用 LTS 版本）

```bash
npm install
npm run dev
```

启动后默认访问 `http://127.0.0.1:5173`；端口被占用时 Vite 自动切换，以终端输出为准。

```bash
npm run build
npm run preview
```

构建产物输出至 `dist/`，可直接部署至 Nginx 或任意静态资源服务器。

接口地址通过 `public/app-config.js` 运行时配置管理，构建时原样复制到 `dist/app-config.js`，切换部署环境的接口地址无需重新打包前端。

```js
window.__SYSTEMPRO_PUBLIC_CONFIG__ = {
  apiBaseUrl: 'https://your-backend-domain.com',
}
```

本地开发可将 `apiBaseUrl` 指向自有后端，或使用官方演示后端 `http://console.systempro.site` 体验只读数据（账号见文首）。

<br/>

## 技术栈

<p align="left">
  <img src="https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vuedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-4.x-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Element%20Plus-UI-409EFF" />
  <img src="https://img.shields.io/badge/Java-17-007396?logo=openjdk&logoColor=white" />
  <img src="https://img.shields.io/badge/Spring%20Boot-3.x-6DB33F?logo=springboot&logoColor=white" />
  <img src="https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-7.x-DC382D?logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/MQTT-IoT-660066" />
</p>

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3 · TypeScript · Vite · Pinia · Element Plus · ECharts · vue-i18n |
| 后端 | Java 17 · Spring Boot 3 · MyBatis-Plus |
| 数据 | MySQL 8 · Liquibase（版本化迁移） |
| 缓存 | Redis |
| IoT | MQTT · Modbus · REST API |
| 安全 | Spring Security · OAuth2 / JWT |

<br/>

## License

本项目基于 [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) 许可证开源。

---

<p align="center"><sub>systemPro —— 让每一度电、每一笔账，都说得清楚。</sub></p>
