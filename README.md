<p align="center">
  <img src="./logo.png" width="88" alt="systemPro" />
</p>

<h1 align="center">SystemPro</h1>

<p align="center">
  English | <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <b>Open-source Vue 3 Console for IoT and Energy Operations</b><br />
  <sub>Device Management · Energy Metering · HVAC Operations · Alarms & Work Orders · Billing</sub>
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
  <a href="https://systempro.site"><b>Official Website</b></a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://console.systempro.site"><b>Live Demo</b></a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#quick-start"><b>Quick Start</b></a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="./docs/public-edition-boundary.md"><b>Edition Scope</b></a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://github.com/leonlabs-dev/SystemPro/issues"><b>Issues</b></a><br/><br/>
  <b>Username</b>&nbsp;<code>system</code>&nbsp;&nbsp;&nbsp;<b>Password</b>&nbsp;<code>12345678</code><br/><br/>
  <b>Repository</b>&nbsp;&nbsp;<a href="https://github.com/leonlabs-dev/SystemPro">GitHub</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="https://gitee.com/sitepulse/system-pro">Gitee Mirror</a>
</p>

<p align="center"><sub>The demo account is a public, read-only account. Its credentials are always visible in the page source and network requests and are not sensitive production credentials.</sub></p>

<p align="center">
  <img src="./assets/readme/systempro-platform-overview-en.png" width="100%" alt="SystemPro platform overview from device connectivity to energy operations and billing" />
</p>

<p align="center"><sub>From a single meter to a tenant bill, SystemPro connects devices, data, operations, and settlement in one coherent flow.</sub></p>

SystemPro is a Vue 3 and TypeScript administration console for enterprise IoT and energy operations. It provides production-style interfaces for device assets, energy metering, centralized HVAC management, alarms, work orders, billing, multi-tenant access control, and an extensible AI assistant. It is designed for campuses, commercial buildings, factories, and other environments that need one operational view across previously isolated systems.

> **Repository scope:** this repository contains the public SystemPro **frontend console**. It includes the UI, local read-only demo mode, runtime API configuration, and integration contracts. The production Java backend, database schema, device protocol services, and secrets are not included. You can run the interface without a backend or connect it to your own compatible API.

<br/>

## Take a Quick Look

Prefer to see it working first? Take a 25-second tour through operations, metering, HVAC, and the AI assistant.

<p align="center">
  <a href="https://console.systempro.site">
    <img src="./assets/demo/systempro-demo.gif" width="800" alt="SystemPro IoT and energy operations product preview" />
  </a>
</p>

<p align="center">
  <sub>25-second product tour: operations cockpit, carbon/solar/storage/charging dashboard, energy topology, metering, HVAC, and AI assistant. <a href="./assets/demo/systempro-demo.mp4">Watch the MP4 version</a>.</sub>
</p>

<br/>

## What Is Included

| Included in this repository | Integrate with your own services |
| --- | --- |
| Vue 3 + TypeScript management console | Authentication, tenants, projects, and data permissions |
| Responsive layouts, light/dark themes, and i18n | IoT ingestion through MQTT, Modbus, or gateways |
| Local read-only demo mode and public demo endpoint | Energy readings, tariffs, bills, alarms, and work orders |
| Runtime API endpoint configuration | AI orchestration and model credentials on the server |
| AI assistant page and draggable floating entry | Production persistence, auditing, and rate limiting |

<br/>

## Core Capabilities

| Capability | Description |
| --- | --- |
| Unified energy operations cockpit | An integrated carbon, solar, storage, and charging dashboard that presents business and energy KPIs in a single view |
| Unified records for eight device categories | Centralized asset records for electricity meters, water meters, HVAC, lighting, parking, charging, solar, and energy storage equipment |
| Centralized HVAC control | Unified management of central air conditioning, VRF systems, and fresh-air systems with zone control and scenario-based automation |
| Subitem metering and loss analysis | Real power-distribution topology and subitem metering definitions, with energy accounts traceable to spaces and tenants |
| Closed-loop alarm-to-work-order processing | Rule configuration, work-order conversion, and historical statistics for a complete and traceable handling workflow |
| End-to-end financial operations | Bank connectivity, receipt reconciliation, adjustments, refunds, and invoice management with connected business and financial data |
| Multi-tenant access control | Organization structures, spatial hierarchies, RBAC permissions, and SSO bindings |
| Deployment without rebuilding | Runtime API endpoint configuration for switching environments without rebuilding the frontend |

<br/><br/>

## Feature Tour

### Overview

#### Platform Home

The welcome page and module directory provide a unified entry point with overviews and navigation for devices, energy, finance, and platform capabilities.

<p align="center">
  <img src="./assets/screenshots/欢迎.png" width="760" alt="Platform home" />
</p>

<br/>

#### Integrated Operations Dashboard

The integrated operations dashboard brings together project, device, energy, alarm, and operational data, helping managers understand the platform's overall operating status in a single view.

<p align="center">
  <img src="./assets/screenshots/综合运营看板.png" width="760" alt="Integrated operations dashboard" />
</p>

#### AI Assistant

Provides one AI assistant page, a draggable floating entry, and an integration approach. The community edition does not connect to a model service by default; deployers can configure model credentials on their own server and expose a compatible API.

<p align="center">
  <img src="./assets/screenshots/ai助手.png" width="49%" alt="SystemPro AI assistant page" />
  <img src="./assets/screenshots/ai悬浮框.png" width="49%" alt="SystemPro AI assistant floating window" />
</p>

<br/><br/>

### Devices and Energy

#### HVAC Devices · Centralized Control

Unified management and centralized control for HVAC systems, including central air conditioning, split units, VRF systems, and fresh-air systems. Device connectivity records, operating status, and system ownership are presented together, while building-wide zoning strategies and scenario-based automation are configured centrally. This transforms isolated device management into centralized control with coordinated scenarios.

**Device Overview**

The centralized control console presents HVAC device inventories, online status, and operating data. It supports filtering by system, space, and record status, as well as batch command delivery.

<p align="center">
  <img src="./assets/screenshots/空调卡片.png" width="760" alt="HVAC device overview" />
</p>

<br/>

**Add an HVAC Device**

Maintain the connectivity parameters, owning system, and operational record for an individual HVAC device. Its space and system assignments are recorded in the same workflow.

<p align="center">
  <img src="./assets/screenshots/新增空调2.png" width="760" alt="Add an HVAC device" />
</p>

<br/>

**Add an HVAC System**

Configure the composition, control strategy, and zone assignment of an HVAC system, with unified records for system types such as VRF.

<p align="center">
  <img src="./assets/screenshots/新增空调系统.png" width="760" alt="Add an HVAC system" />
</p>

<br/>

#### Device Assets

Maintain unified asset records for eight device categories: electricity meters, water meters, HVAC, lighting, parking, charging, solar, and energy storage. The records cover parent-child meter relationships, multipliers, collection status, common scenarios such as prepaid electricity meters, and lighting zones and scenario-based automation.

<p align="center">
  <img src="./assets/screenshots/电表.png" width="760" alt="Electricity meter management" />
</p>

<br/>

#### Energy Flow

The energy topology displays the real-time energy balance among solar generation, energy storage, loads, and the public grid.

<p align="center">
  <img src="./assets/screenshots/能源拓扑.png" width="760" alt="Energy topology" />
</p>

<br/>

#### Energy Metering

Maintain parent-child meter topologies and subitem metering definitions, manage tariff plans and billing activation, and trace energy accounts to spaces and tenants.

<p align="center">
  <img src="./assets/screenshots/计费开通.png" width="760" alt="Billing activation" />
</p>

<br/>

#### Operations Monitoring

Centralized operational monitoring covers real-time device status, gateway and link status, grid-connected and off-grid switching, and video surveillance integration.

<p align="center">
  <img src="./assets/screenshots/并离网切换状态.png" width="760" alt="Grid-connected and off-grid switching status" />
</p>

<br/>

#### Alarms and Work Orders

Configure alarm rules, convert alarms into work orders, and review historical alarm statistics through a complete and traceable handling workflow.

<p align="center">
  <img src="./assets/screenshots/告警.png" width="760" alt="Historical alarm statistics" />
</p>

<br/><br/>

### Finance and Billing

#### Finance Center

Connect banks, reconcile receipts, process adjustments and refunds, and manage invoices. Real bank transactions are automatically matched and reconciled with accounts receivable.

<p align="center">
  <img src="./assets/screenshots/银企直连.png" width="760" alt="Finance center · Bank connectivity" />
</p>

<br/>

#### Billing Management

Generate traceable bills from frozen usage and effective rates, and track payment, invoicing, overdue, and closed states.

<p align="center">
  <img src="./assets/screenshots/账单.png" width="760" alt="Billing management" />
</p>

<br/><br/>

### Platform Capabilities

#### Users and Permissions

Accounts, roles, menus, actions, and data permissions form an enterprise RBAC system with permission granularity down to button-level operations.

<p align="center">
  <img src="./assets/screenshots/角色权限.png" width="760" alt="Role permissions" />
</p>

<br/>

#### Organizations and Projects

Manage organization trees, departments and positions, spatial hierarchies, and tenant/customer records while keeping physical spaces decoupled from organizational relationships.

<p align="center">
  <img src="./assets/screenshots/组织项目.png" width="760" alt="Organizations and projects" />
</p>

<br/>

#### System Settings

Manage basic parameters, data dictionaries, and internationalization, with support for light and dark themes and customizable navigation layouts.

<p align="center">
  <img src="./assets/screenshots/基础参数.png" width="760" alt="Basic parameters" />
</p>

<br/><br/>

## More Screens

<table>
<tr>
<td align="center" width="33%"><img src="./assets/screenshots/光储充能源概览.png" width="220" alt="Solar, storage, and charging overview" /><br/><sub>Solar, Storage, and Charging Overview</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/新增计费方案.png" width="220" alt="Add a tariff plan" /><br/><sub>Add a Tariff Plan</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/新增计费开通1.png" width="220" alt="Add billing activation" /><br/><sub>Add Billing Activation</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="./assets/screenshots/停车场监控.png" width="220" alt="Parking lot monitoring" /><br/><sub>Parking Lot Monitoring</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/菜单权限.png" width="220" alt="Menu permissions" /><br/><sub>Menu Permissions</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/操作权限.png" width="220" alt="Action permissions" /><br/><sub>Action Permissions</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="./assets/screenshots/数据权限.png" width="220" alt="Data permissions" /><br/><sub>Data Permissions</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/菜单按钮级权限.png" width="220" alt="Menu and button-level permissions" /><br/><sub>Menu and Button-Level Permissions</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/空间层级.png" width="220" alt="Spatial hierarchy" /><br/><sub>Spatial Hierarchy</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="./assets/screenshots/多语言管理.png" width="220" alt="Internationalization" /><br/><sub>Internationalization</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/照明设备.png" width="220" alt="Lighting devices" /><br/><sub>Lighting Devices</sub></td>
<td align="center" width="33%"><img src="./assets/screenshots/驾驶舱.png" width="220" alt="Integrated carbon, solar, storage, and charging cockpit" /><br/><sub>Energy Operations Cockpit</sub></td>
</tr>
</table>

<br/><br/>

## Quick Start

Prefer to explore first and read the details later? Get it running with a few commands.

Requirements: Node.js 18 or later (an LTS release is recommended)

```bash
npm install
npm run dev
```

The development server is available at `http://127.0.0.1:5173` by default. If that port is already in use, Vite automatically selects another port; refer to the terminal output for the actual address.

```bash
npm run build
npm run preview
```

Production assets are written to `dist/` and can be deployed directly to Nginx or any static file server.

The API endpoint is managed at runtime through `public/app-config.js`. The file is copied unchanged to `dist/app-config.js` during the build, allowing deployment environments to use different API endpoints without rebuilding the frontend.

```js
window.__SYSTEMPRO_PUBLIC_CONFIG__ = {
  apiBaseUrl: 'https://your-backend-domain.com',
}
```

For local development, set `apiBaseUrl` to your own backend or use the official demo backend at `https://console.systempro.site` to explore read-only data with the account shown above.

<br/>

## Technology Stack

<p align="left">
  <img src="https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vuedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-4.x-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Element%20Plus-UI-409EFF" />
  <img src="https://img.shields.io/badge/Pinia-State-FFD859" />
  <img src="https://img.shields.io/badge/ECharts-Visualization-AA344D" />
</p>

| Layer | Technologies |
| --- | --- |
| Frontend | Vue 3 · TypeScript · Vite · Pinia · Element Plus · ECharts · vue-i18n |
| API integration | REST API · runtime endpoint configuration · SSE streaming |
| Quality | vue-tsc · repository safety checks · theme/UI contracts · performance budget |

The production SystemPro architecture uses Java 17, Spring Boot 3, MySQL, Liquibase, Redis, MQTT, and Modbus behind the frontend. Those server-side components are integration targets and are not part of this public repository.

<br/>

## Build It With Us

If you are building for campuses, buildings, IoT, or energy operations, share the real scenario behind the request through [GitHub Issues](https://github.com/leonlabs-dev/SystemPro/issues) or [Gitee Issues](https://gitee.com/sitepulse/system-pro/issues). Concrete workflows are usually more valuable than a generic feature wish.

We especially welcome reproducible bugs, accessibility and integration improvements, device or metering scenarios, and ideas that make the public console easier to extend.

If SystemPro saves you from rebuilding another admin console or helps you avoid an energy-domain pitfall, consider giving the project a Star so other teams working on similar systems can find it.

<br/>

## License

This project is open source under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

---

<p align="center"><sub>SystemPro — Clarity and control for complex operations.</sub></p>
