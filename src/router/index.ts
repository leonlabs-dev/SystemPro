import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/core/auth/auth.store';
import { getFirstNavigationPath, navigationItems, type NavigationItem } from '@/core/navigation/menu';
import { useRouteTabsStore } from '@/core/navigation/route-tabs.store';
import { useNavigationStore } from '@/core/navigation/navigation.store';
import { routeLoading } from '@/core/navigation/route-loading';

const AppLayout = () => import('@/layout/AppLayout.vue');
const LoginPage = () => import('@/pages/auth/LoginPage.vue');
const ModulePlaceholder = () => import('@/pages/placeholder/ModulePlaceholder.vue');
const CarbonCockpitPage = () => import('@/pages/cockpit/CarbonCockpitPage.vue');
const OperationsCockpitPage = () => import('@/pages/cockpit/OperationsCockpitPage.vue');

const pageComponentMap: Record<string, RouteRecordRaw['component']> = {
  welcome: () => import('@/pages/home/HomePage.vue'),
  workbench: () => import('@/pages/workbench/WorkbenchPage.vue'),
  'meter-management': () => import('@/pages/assets/MeterManagementPage.vue'),
  'water-meter-management': () => import('@/pages/assets/WaterMeterManagementPage.vue'),
  'hvac-system': () => import('@/pages/assets/HvacSystemPage.vue'),
  'hvac-device': () => import('@/pages/assets/HvacDevicePage.vue'),
  'lighting-system': () => import('@/pages/assets/LightingSystemPage.vue'),
  'lighting-device': () => import('@/pages/assets/LightingDevicePage.vue'),
  'parking-system': () => import('@/pages/assets/ParkingSystemPage.vue'),
  'parking-device': () => import('@/pages/assets/ParkingDevicePage.vue'),
  'charging-piles': () => import('@/pages/assets/ChargingSystemPage.vue'),
  'charging-device': () => import('@/pages/assets/ChargingDevicePage.vue'),
  'pv-equipment': () => import('@/pages/assets/SolarSystemPage.vue'),
  'pv-device': () => import('@/pages/assets/SolarDevicePage.vue'),
  'storage-equipment': () => import('@/pages/assets/StorageSystemPage.vue'),
  'storage-device': () => import('@/pages/assets/StorageDevicePage.vue'),
  'alarm-rules': () => import('@/pages/alarm-work-order/AlarmRulesPage.vue'),
  'alarm-to-ticket': () => import('@/pages/alarm-work-order/AlarmTransferPage.vue'),
  'ticket-center': () => import('@/pages/alarm-work-order/TicketCenterPage.vue'),
  'alarm-statistics': () => import('@/pages/alarm-work-order/AlarmStatisticsPage.vue'),
  'pv-flow': () => import('@/pages/energy-flow/PvEnergyFlowPage.vue'),
  'energy-topology': () => import('@/pages/energy-flow/EnergyTopologyPage.vue'),
  'parking-monitoring': () => import('@/pages/monitoring/ParkingMonitoringPage.vue'),
  'device-realtime-monitor': () => import('@/pages/monitoring/DeviceRealtimeMonitoringPage.vue'),
  'gateway-link-status': () => import('@/pages/monitoring/GatewayLinkStatusPage.vue'),
  'grid-switching': () => import('@/pages/monitoring/GridModeMonitoringPage.vue'),
  'video-monitoring': () => import('@/pages/monitoring/VideoMonitoringPage.vue'),
  'metering-overview': () => import('@/pages/metering/EnterpriseMeteringOverviewPage.vue'),
  'physical-metering-topology': () => import('@/pages/metering/PhysicalMeteringTopologyPage.vue'),
  'subitem-metering-overview': () => import('@/pages/metering/SubitemMeteringPage.vue'),
  'energy-usage-analysis': () => import('@/pages/metering/UsageAnalysisPage.vue'),
  'loss-analysis': () => import('@/pages/metering/LossAnalysisPage.vue'),
  'metering-data-quality': () => import('@/pages/metering/MeteringDataQualityPage.vue'),
  'energy-relations': () => import('@/pages/metering/EnergyRelationsPage.vue'),
  'tariff-plans': () => import('@/pages/metering/TariffPlansPage.vue'),
  'bank-connection': () => import('@/pages/finance/BankConnectionPage.vue'),
  'receipt-reconciliation': () => import('@/pages/finance/ReceiptReconciliationPage.vue'),
  'adjustment-refund': () => import('@/pages/finance/AdjustmentRefundPage.vue'),
  'invoice-management': () => import('@/pages/finance/InvoiceManagementPage.vue'),
  'bill-generation': () => import('@/pages/finance/BillGenerationPage.vue'),
  'bill-review': () => import('@/pages/finance/BillReviewPage.vue'),
  'bill-tracking': () => import('@/pages/finance/BillTrackingPage.vue'),
  'account-list': () => import('@/pages/user-permission/AccountListPage.vue'),
  'role-permission': () => import('@/pages/user-permission/RolePermissionPage.vue'),
  'menu-permission': () => import('@/pages/user-permission/MenuPermissionPage.vue'),
  'sso-binding': () => import('@/pages/user-permission/SsoBindingPage.vue'),
  'tenant-customer': () => import('@/pages/organization/TenantListPage.vue'),
  'organization-tree': () => import('@/pages/organization/OrganizationTreePage.vue'),
  'department-position': () => import('@/pages/organization/DepartmentPositionPage.vue'),
  'project-station-relation': () => import('@/pages/organization/ResourceOwnershipPage.vue'),
  'basic-parameters': () => import('@/pages/settings/BasicParametersPage.vue'),
  'data-dictionary': () => import('@/pages/settings/DataDictionaryPage.vue'),
  'audit-log': () => import('@/pages/settings/AuditLogPage.vue'),
  'language-management': () => import('@/pages/settings/LanguageManagementPage.vue'),
  'ai-chat': () => import('@/pages/ai/AiChatPage.vue'),
};

function createNavigationRoutes(items: NavigationItem[]): RouteRecordRaw[] {
  return items.flatMap((item) => {
    if (item.children?.length) {
      return [
        {
          path: item.path.replace(/^\//, ''),
          redirect: getFirstNavigationPath(item),
        },
        ...createNavigationRoutes(item.children),
      ];
    }

    if (item.openMode === 'new-window') return [];
    const normalizedPath = item.path.replace(/^\//, '');
    const pageComponent = pageComponentMap[item.id];
    return [
      {
        path: normalizedPath,
        name: item.id,
        component: pageComponent || ModulePlaceholder,
        meta: {
          titleKey: item.titleKey,
          descKey: item.descKey,
          immersive: item.id === 'welcome' || item.id === 'workbench' || item.id === 'pv-flow' || item.id === 'energy-topology',
          // Placeholder routes all reuse the same lightweight component and
          // have no state worth preserving. Caching every placeholder under a
          // different URL can evict a vnode before an async navigation has
          // finished mounting it, leaving KeepAlive with a null component.
          keepAlive: Boolean(pageComponent),
        },
      },
    ];
  });
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/index.html', redirect: '/' },
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'login', component: LoginPage },
    {
      path: '/cockpit/carbon',
      name: 'carbon-cockpit',
      component: CarbonCockpitPage,
      meta: {
        authorizationPath: '/cockpit/carbon',
        standalone: true,
        keepAlive: false,
      },
    },
    {
      path: '/cockpit/operations',
      name: 'operations-dashboard',
      component: OperationsCockpitPage,
      meta: {
        authorizationPath: '/cockpit/operations',
        standalone: true,
        keepAlive: false,
      },
    },
    // Legacy redirects after navigation taxonomy restructuring.
    { path: '/alarm-work-order/realtime', redirect: '/monitoring/parking' },
    { path: '/monitoring/alarm-stream', redirect: '/monitoring/parking' },
    { path: '/energy-flow/grid-switching', redirect: '/monitoring/grid-mode' },
    { path: '/energy-flow/storage', redirect: '/energy-flow/pv' },
    {
      path: '/',
      component: AppLayout,
      children: [
        ...createNavigationRoutes(navigationItems),
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  routeLoading.start();
  const authStore = useAuthStore();
  const navigationStore = useNavigationStore();
  await authStore.restore();

  if (to.path === '/login') {
    if (authStore.isAuthenticated && navigationStore.firstPath) {
      return navigationStore.firstPath;
    }
    return true;
  }

  if (!authStore.isAuthenticated) {
    return {
      path: '/login',
      query: to.fullPath === '/login' ? undefined : { redirect: to.fullPath },
    };
  }

  // Authorization is hydrated before the application becomes interactive and
  // every API still enforces permissions server-side. Refreshing the menu grant
  // must therefore not block a client-side route switch: on a high-latency
  // connection the previous page could remain visible for several seconds while
  // Element Plus had already highlighted the newly clicked menu item.
  void authStore.refreshAuthorization(true).catch(() => undefined);

  const authorizationPath = typeof to.meta.authorizationPath === 'string'
    ? to.meta.authorizationPath
    : to.path;
  if (!navigationStore.canAccessPath(authorizationPath)) {
    return navigationStore.firstPath || '/login';
  }

  return true;
});

router.afterEach((to) => {
  routeLoading.finish();
  if (to.path === '/login' || to.meta.standalone === true) {
    return;
  }

  const routeTabsStore = useRouteTabsStore();
  routeTabsStore.addRoute(to);

  // 平铺布局下，滚动容器为 .app-layout__content，路由切换时须复位到顶部
  const contentEl = document.querySelector('.app-layout__content');
  if (contentEl) {
    contentEl.scrollTop = 0;
  }
});

router.onError(() => routeLoading.finish());
