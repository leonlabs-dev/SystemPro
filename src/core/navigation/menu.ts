export interface NavigationItem {
  id: string;
  titleKey: string;
  title?: string;
  descKey: string;
  path: string;
  icon?: string;
  /** 菜单分组标签。相邻同 group 的项归入同一组，渲染时在组首插入不可点击的分组标题。 */
  group?: string;
  /** 业务域内的视觉分组。仅 grouped 导航显示，RBAC 仍保持直接叶子节点。 */
  sectionGroup?: string;
  children?: NavigationItem[];
  sections?: string[];
  /** View permission returned by the navigation API for permission-aware placeholder pages. */
  viewPermission?: string;
  /** Open a standalone experience without changing the current admin route. */
  openMode?: 'same-window' | 'new-window';
}

export function getNavigationTitle(item: NavigationItem, translate: (key: string) => string): string {
  // Navigation names are configurable business data. The API-resolved title
  // is authoritative; the static locale remains a safe fallback for bootstrap
  // and for menu records that do not yet have a translation.
  if (item.title?.trim()) return item.title;
  if (item.titleKey) {
    const translated = translate(item.titleKey);
    if (translated && translated !== item.titleKey) return translated;
  }
  return item.id;
}

/**
 * Sidebar 一级导航，按四层心智分组：
 *   总览 → 设备与运维 → 财务账单 → 平台能力
 *
 * 分组标签通过 `group` 字段声明，Sidebar 渲染时注入分组标题。
 */
export const navigationItems: NavigationItem[] = [
  // ========== 总览 ==========
  {
    id: 'welcome',
    titleKey: 'routes.welcome',
    descKey: 'routeDescriptions.welcome',
    path: '/welcome',
    icon: 'welcome',
    group: 'navGroup.overview',
    sections: ['平台概览', '模块索引', '系统架构', '接入路线'],
  },
  {
    id: 'workbench',
    titleKey: 'routes.workbench',
    descKey: 'routeDescriptions.workbench',
    path: '/workbench',
    icon: 'workbench',
    group: 'navGroup.overview',
    sections: ['能源总览卡片', '经营摘要', '实时能耗趋势', '告警动态', '待办事项', '快捷入口'],
  },
  {
    id: 'cockpit',
    titleKey: 'routes.cockpit',
    descKey: 'routeDescriptions.cockpit',
    path: '/cockpit',
    icon: 'cockpit',
    group: 'navGroup.overview',
    children: [
      { id: 'carbon-cockpit',              titleKey: 'routes.carbonCockpit',              descKey: 'routeDescriptions.carbonCockpit',              path: '/cockpit/carbon', viewPermission: 'platform:carbon:cockpit:view', openMode: 'new-window' },
      { id: 'operations-dashboard',        titleKey: 'routes.operationsDashboard',        descKey: 'routeDescriptions.operationsDashboard',        path: '/cockpit/operations', viewPermission: 'platform:operations:cockpit:view', openMode: 'new-window' },
    ],
  },

  // ========== 设备与能源 (IoT) ==========
  {
    id: 'device-assets',
    titleKey: 'routes.deviceAssets',
    descKey: 'routeDescriptions.deviceAssets',
    path: '/assets',
    icon: 'assets',
    group: 'navGroup.deviceEnergy',
    children: [
      { id: 'meter-management',       titleKey: 'routes.meterManagement',       descKey: 'routeDescriptions.meterManagement',       path: '/assets/meters' },
      { id: 'water-meter-management', titleKey: 'routes.waterMeterManagement',  descKey: 'routeDescriptions.waterMeterManagement',  path: '/assets/water-meters' },
      { id: 'hvac-system',            titleKey: 'routes.hvacSystem',            descKey: 'routeDescriptions.hvacSystem',            path: '/assets/hvac', sectionGroup:'assetGroup.hvac' },
      { id: 'hvac-device',            titleKey: 'routes.hvacDevice',            descKey: 'routeDescriptions.hvacDevice',            path: '/assets/hvac-devices', sectionGroup:'assetGroup.hvac' },
      { id: 'lighting-system',        titleKey: 'routes.lightingSystem',        descKey: 'routeDescriptions.lightingSystem',        path: '/assets/lighting', sectionGroup:'assetGroup.lighting' },
      { id: 'lighting-device',        titleKey: 'routes.lightingDevice',        descKey: 'routeDescriptions.lightingDevice',        path: '/assets/lighting-devices', sectionGroup:'assetGroup.lighting' },
      { id: 'parking-system',         titleKey: 'routes.parkingSystem',         descKey: 'routeDescriptions.parkingSystem',         path: '/assets/parking', sectionGroup:'assetGroup.parking' },
      { id: 'parking-device',         titleKey: 'routes.parkingDevice',         descKey: 'routeDescriptions.parkingDevice',         path: '/assets/parking-devices', sectionGroup:'assetGroup.parking' },
      { id: 'charging-piles',         titleKey: 'routes.chargingStation',       descKey: 'routeDescriptions.chargingStation',       path: '/assets/charging-piles', sectionGroup:'assetGroup.charging' },
      { id: 'charging-device',        titleKey: 'routes.chargingDevice',        descKey: 'routeDescriptions.chargingDevice',        path: '/assets/charging-devices', sectionGroup:'assetGroup.charging' },
      { id: 'pv-equipment',           titleKey: 'routes.pvSystem',              descKey: 'routeDescriptions.pvSystem',              path: '/assets/pv-equipment', sectionGroup:'assetGroup.pv' },
      { id: 'pv-device',              titleKey: 'routes.pvDevice',              descKey: 'routeDescriptions.pvDevice',              path: '/assets/pv-devices', sectionGroup:'assetGroup.pv' },
      { id: 'storage-equipment',      titleKey: 'routes.storageSystem',         descKey: 'routeDescriptions.storageSystem',         path: '/assets/storage-equipment', sectionGroup:'assetGroup.storage' },
      { id: 'storage-device',         titleKey: 'routes.storageDevice',         descKey: 'routeDescriptions.storageDevice',         path: '/assets/storage-devices', sectionGroup:'assetGroup.storage' },
    ],
  },
  {
    id: 'energy-flow',
    titleKey: 'routes.energyFlow',
    descKey: 'routeDescriptions.energyFlow',
    path: '/energy-flow',
    icon: 'energy',
    group: 'navGroup.deviceEnergy',
    children: [
      { id: 'energy-topology', titleKey: 'routes.energyTopology', descKey: 'routeDescriptions.energyTopology', path: '/energy-flow/topology' },
      { id: 'pv-flow',         titleKey: 'routes.pvFlow',         descKey: 'routeDescriptions.pvFlow',         path: '/energy-flow/pv' },
    ],
  },
  {
    id: 'metering-loss',
    titleKey: 'routes.meteringLoss',
    descKey: 'routeDescriptions.meteringLoss',
    path: '/metering-loss',
    icon: 'metering',
    group: 'navGroup.deviceEnergy',
    children: [
      { id: 'metering-overview', titleKey: 'routes.meteringOverview', descKey: 'routeDescriptions.meteringOverview', path: '/metering-loss/overview' },
      { id: 'physical-metering-topology', titleKey: 'routes.physicalMeteringTopology', descKey: 'routeDescriptions.physicalMeteringTopology', path: '/metering-loss/physical-topology' },
      { id: 'subitem-metering-overview', titleKey: 'routes.subitemMetering', descKey: 'routeDescriptions.subitemMetering', path: '/metering-loss/subitems' },
      { id: 'energy-usage-analysis', titleKey: 'routes.energyUsageAnalysis', descKey: 'routeDescriptions.energyUsageAnalysis', path: '/metering-loss/usage-analysis' },
      { id: 'loss-analysis', titleKey: 'routes.lossAnalysis', descKey: 'routeDescriptions.lossAnalysis', path: '/metering-loss/loss-analysis' },
      { id: 'metering-data-quality', titleKey: 'routes.meteringDataQuality', descKey: 'routeDescriptions.meteringDataQuality', path: '/metering-loss/data-quality' },
      { id: 'tariff-plans', titleKey: 'routes.tariffPlans', descKey: 'routeDescriptions.tariffPlans', path: '/metering-loss/tariffs' },
      { id: 'energy-relations', titleKey: 'routes.energyRelations', descKey: 'routeDescriptions.energyRelations', path: '/metering-loss/relations' },
    ],
  },

  // ========== 设备与运维（续） ==========
  {
    id: 'operations-monitoring',
    titleKey: 'routes.operationsMonitoring',
    descKey: 'routeDescriptions.operationsMonitoring',
    path: '/monitoring',
    icon: 'monitor',
    group: 'navGroup.deviceEnergy',
    children: [
      { id: 'device-realtime-monitor', titleKey: 'routes.deviceRealtimeMonitor', descKey: 'routeDescriptions.deviceRealtimeMonitor', path: '/monitoring/devices', viewPermission: 'platform:monitoring:device:view' },
      { id: 'gateway-link-status',      titleKey: 'routes.gatewayLinkStatus',      descKey: 'routeDescriptions.gatewayLinkStatus',      path: '/monitoring/gateway-links', viewPermission: 'platform:monitoring:gateway:view' },
      { id: 'grid-switching',           titleKey: 'routes.gridSwitching',          descKey: 'routeDescriptions.gridSwitching',          path: '/monitoring/grid-mode', viewPermission: 'platform:monitoring:grid:view' },
      { id: 'video-monitoring',         titleKey: 'routes.videoMonitoring',         descKey: 'routeDescriptions.videoMonitoring',         path: '/monitoring/video', viewPermission: 'platform:monitoring:video:view' },
      { id: 'parking-monitoring',        titleKey: 'routes.parkingMonitoring',      descKey: 'routeDescriptions.parkingMonitoring',      path: '/monitoring/parking', viewPermission: 'platform:parking:monitoring:view' },
    ],
  },
  {
    id: 'alarm-work-order',
    titleKey: 'routes.alarmWorkOrder',
    descKey: 'routeDescriptions.alarmWorkOrder',
    path: '/alarm-work-order',
    icon: 'alarm',
    group: 'navGroup.deviceEnergy',
    children: [
      { id: 'alarm-rules',      titleKey: 'routes.alarmRules',      descKey: 'routeDescriptions.alarmRules',      path: '/alarm-work-order/rules' },
      { id: 'alarm-to-ticket',  titleKey: 'routes.alarmToTicket',   descKey: 'routeDescriptions.alarmToTicket',   path: '/alarm-work-order/transfer' },
      { id: 'ticket-center',    titleKey: 'routes.ticketCenter',    descKey: 'routeDescriptions.ticketCenter',    path: '/alarm-work-order/tickets' },
      { id: 'alarm-statistics', titleKey: 'routes.alarmStatistics', descKey: 'routeDescriptions.alarmStatistics', path: '/alarm-work-order/statistics' },
    ],
  },

  // ========== 财务账单 ==========
  {
    id: 'finance-processing',
    titleKey: 'routes.financeProcessing',
    descKey: 'routeDescriptions.financeProcessing',
    path: '/finance',
    icon: 'settlement',
    group: 'navGroup.business',
    children: [
      { id: 'bank-connection', titleKey: 'routes.bankConnection', descKey: 'routeDescriptions.bankConnection', path: '/finance/bank-connection' },
      { id: 'receipt-reconciliation', titleKey: 'routes.receiptReconciliation', descKey: 'routeDescriptions.receiptReconciliation', path: '/finance/receipts' },
      { id: 'adjustment-refund', titleKey: 'routes.adjustmentRefund', descKey: 'routeDescriptions.adjustmentRefund', path: '/finance/adjustments' },
      { id: 'invoice-management', titleKey: 'routes.invoiceManagement', descKey: 'routeDescriptions.invoiceManagement', path: '/finance/invoices' },
    ],
  },
  {
    id: 'billing-management',
    titleKey: 'routes.billingManagement',
    descKey: 'routeDescriptions.billingManagement',
    path: '/billing',
    icon: 'report',
    group: 'navGroup.business',
    children: [
      { id: 'bill-generation', titleKey: 'routes.billGeneration', descKey: 'routeDescriptions.billGeneration', path: '/billing/generation' },
      { id: 'bill-review', titleKey: 'routes.billReview', descKey: 'routeDescriptions.billReview', path: '/billing/review' },
      { id: 'bill-tracking', titleKey: 'routes.billTracking', descKey: 'routeDescriptions.billTracking', path: '/billing/tracking' },
    ],
  },

  // ========== 平台能力 ==========
  {
    id: 'user-permission',
    titleKey: 'routes.userPermission',
    descKey: 'routeDescriptions.userPermission',
    path: '/user-permission',
    icon: 'user',
    group: 'navGroup.platform',
    children: [
      { id: 'account-list',    titleKey: 'routes.accountList',    descKey: 'routeDescriptions.accountList',    path: '/user-permission/accounts' },
      { id: 'role-permission', titleKey: 'routes.rolePermission', descKey: 'routeDescriptions.rolePermission', path: '/user-permission/roles' },
      { id: 'menu-permission', titleKey: 'routes.menuPermission', descKey: 'routeDescriptions.menuPermission', path: '/user-permission/menus' },
      { id: 'sso-binding',     titleKey: 'routes.ssoBinding',     descKey: 'routeDescriptions.ssoBinding',     path: '/user-permission/sso' },
    ],
  },
  {
    id: 'organization-project',
    titleKey: 'routes.organizationProject',
    descKey: 'routeDescriptions.organizationProject',
    path: '/organization',
    icon: 'organization',
    group: 'navGroup.platform',
    children: [
      { id: 'organization-tree',         titleKey: 'routes.organizationTree',         descKey: 'routeDescriptions.organizationTree',         path: '/organization/tree' },
      { id: 'department-position',       titleKey: 'routes.departmentPosition',       descKey: 'routeDescriptions.departmentPosition',       path: '/organization/departments' },
      { id: 'project-station-relation',  titleKey: 'routes.projectStationRelation',    descKey: 'routeDescriptions.projectStationRelation',  path: '/organization/projects' },
      { id: 'tenant-customer',           titleKey: 'routes.tenantCustomer',           descKey: 'routeDescriptions.tenantCustomer',           path: '/organization/tenants' },
    ],
  },
  {
    id: 'system-settings',
    titleKey: 'routes.systemSettings',
    descKey: 'routeDescriptions.systemSettings',
    path: '/settings',
    icon: 'settings',
    group: 'navGroup.platform',
    children: [
      { id: 'basic-parameters',          titleKey: 'routes.basicParameters',          descKey: 'routeDescriptions.basicParameters',          path: '/settings/basic' },
      { id: 'data-dictionary',           titleKey: 'routes.dataDictionary',           descKey: 'routeDescriptions.dataDictionary',           path: '/settings/dictionary' },
      { id: 'language-management',        titleKey: 'routes.languageManagement',        descKey: 'routeDescriptions.languageManagement',        path: '/settings/i18n' },
      { id: 'audit-log',                 titleKey: 'routes.auditLog',                 descKey: 'routeDescriptions.auditLog',                 path: '/settings/audit-log' },
    ],
  },
  {
    id: 'ai-assistant',
    titleKey: 'routes.aiAssistant',
    descKey: 'routeDescriptions.aiAssistant',
    path: '/ai',
    icon: 'ai',
    group: 'navGroup.platform',
    children: [
      { id: 'operations-chat',              titleKey: 'routes.operationsChat',              descKey: 'routeDescriptions.operationsChat',              path: '/ai/operations-chat' },
      { id: 'alarm-diagnosis',              titleKey: 'routes.alarmDiagnosis',              descKey: 'routeDescriptions.alarmDiagnosis',              path: '/ai/alarm-diagnosis' },
      { id: 'energy-analysis-assistant',    titleKey: 'routes.energyAnalysisAssistant',     descKey: 'routeDescriptions.energyAnalysisAssistant',    path: '/ai/energy-analysis' },
      { id: 'report-generation-assistant',  titleKey: 'routes.reportGenerationAssistant',   descKey: 'routeDescriptions.reportGenerationAssistant',  path: '/ai/report-generation' },
      { id: 'knowledge-base',               titleKey: 'routes.knowledgeBase',               descKey: 'routeDescriptions.knowledgeBase',               path: '/ai/knowledge-base' },
    ],
  },
];

export function getFirstNavigationPath(item: NavigationItem): string {
  return item.children?.length ? getFirstNavigationPath(item.children[0]) : item.path;
}

export function flattenNavigation(items: NavigationItem[] = navigationItems): NavigationItem[] {
  return items.flatMap((item) => [item, ...flattenNavigation(item.children || [])]);
}

export function isNavigationItemActive(item: NavigationItem, path: string): boolean {
  if (item.path === path || getFirstNavigationPath(item) === path) {
    return true;
  }

  return Boolean(item.children?.some((child) => isNavigationItemActive(child, path)));
}

export function getActiveRootNavigation(path: string, items: NavigationItem[] = navigationItems): NavigationItem | undefined {
  return items.find((item) => isNavigationItemActive(item, path));
}
