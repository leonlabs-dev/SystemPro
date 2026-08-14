# 架构说明

> 本文档承接 README 的精简工程架构，展开说明 systemPro 前端工程的分层设计与目录职责。

## 一、分层设计

前端采用「领域分层 + 页面入口」架构，按职责划分为五层：

| 层 | 职责 |
| --- | --- |
| `core` | 平台基础能力：API 客户端、鉴权、运行时配置、权限、国际化、菜单、导航、主题 |
| `design-system` | 统一设计体系：通用组件、图表运行时、设计令牌、通用样式与组合式函数 |
| `domain` | 业务领域模块：能源、设备、财务、组织、权限等领域模型与 API 适配 |
| `pages` | 页面入口：只负责页面装配与交互，业务逻辑下沉到 `domain` |
| `router` / `store` | 应用基础设施：路由装配与全局状态 |

## 二、目录结构

```
src/
├── core/                             平台基础能力
│   ├── api/                          HTTP 客户端、契约与分页抽象
│   ├── auth/                         鉴权 API、登录态与 Session 管理
│   ├── config/                       运行时配置
│   ├── error/                        错误反馈
│   ├── freshness/                    数据新鲜度
│   ├── i18n/                         国际化词条与业务/枚举标签
│   ├── layout/                       布局状态
│   ├── menu/                         菜单资源工厂
│   ├── metrics/                      能源计量指标（光伏/储能/电网/负荷）
│   ├── navigation/                   菜单、导航与路由页签
│   ├── org/                          组织状态
│   ├── permission/                   权限指令、权限状态与类型
│   ├── settings/                     运行时设置
│   └── theme/                        主题
├── design-system/                    统一设计体系
│   ├── charts/                       ECharts 运行时
│   ├── components/                   通用组件（Ds*）
│   ├── composables/                  通用组合式函数
│   ├── styles/                       通用样式
│   ├── tokens/                       设计令牌（颜色/间距/图表）
│   └── types/                        状态类型契约
├── domain/                           业务领域模块
│   ├── cockpit/                      双碳 / 运营驾驶舱
│   ├── energy/                       能源拓扑
│   ├── fusion/                       融合看板
│   ├── iot/                          设备资产、电表、水表、告警、工单、能源流、监控
│   └── platform/                     组织、用户权限、平台设置、工作台
├── pages/                            页面入口
│   ├── auth/                         登录
│   ├── home/                         首页
│   ├── cockpit/                      驾驶舱页面
│   ├── assets/                       设备资产管理（电表/水表/空调/照明/停车/充电/光伏/储能）
│   ├── energy-flow/                  能源流向
│   ├── metering/                     能源计量
│   ├── monitoring/                   实时监控
│   ├── finance/                      财务账单
│   ├── organization/                 组织架构
│   ├── user-permission/              用户与权限
│   ├── alarm-work-order/             告警工单
│   ├── settings/                     平台设置
│   ├── reports/                      报表
│   └── workbench/                    工作台
├── layout/                           应用布局（顶栏 / 侧栏 / 页签）
├── router/                           路由装配
├── store/                            全局状态
├── App.vue                           应用根组件
└── main.ts                           应用入口
```

## 三、平台架构

平台采用四层架构，将现场设备、接入协议、业务能力与用户入口解耦：

```text
设备层        电表 / 水表 / 空调 / 照明 / 停车 / 充电 / 光伏 / 储能
      ↓
数据接入层    MQTT / Modbus / REST API
      ↓
业务能力层    能源 / 设备 / 财务 / 权限
      ↓
应用层        驾驶舱 / 运营后台 / 移动端
```

- **设备层**：接入现场的电表、水表、空调、照明、停车、充电、光伏、储能等设备资产。
- **数据接入层**：通过 MQTT、Modbus 与 REST API 等协议统一汇聚设备数据。
- **业务能力层**：沉淀能源计量、设备管理、财务结算与权限治理等可复用能力。
- **应用层**：面向管理层、运营方与现场人员提供驾驶舱、运营后台与移动端入口。

## 四、后端技术栈

后端为独立仓库 `systempro-backend-java`，基于 Java 微服务架构：

| 层 | 技术 |
| --- | --- |
| 运行时 | Java 17 · Spring Boot 3 |
| 持久层 | MyBatis-Plus · MySQL 8 · Liquibase |
| 缓存 | Redis |
| 接入 | MQTT · Modbus · REST API |
| 安全 | Spring Security · OAuth2 / JWT |
