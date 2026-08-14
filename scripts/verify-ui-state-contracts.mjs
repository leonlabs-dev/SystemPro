import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const checks = [
  ['列表壳首屏不提前显示空态', 'src/design-system/components/DsListPageShell.vue', 'ref(props.loading !== true)'],
  ['数据表首屏不提前显示空态', 'src/design-system/components/DsDataTable.vue', 'ref(props.loading !== true)'],
  ['工作台首屏有骨架态', 'src/pages/workbench/WorkbenchPage.vue', 'loading && !business'],
  ['工作台刷新保留上次成功结果', 'src/pages/workbench/WorkbenchPage.vue', '数据刷新失败，当前保留上次成功结果'],
  ['运营看板初始加载有独立状态', 'src/pages/cockpit/OperationsCockpitPage.vue', 'const initialLoading'],
  ['运营看板告警口径是客户文案', 'src/pages/cockpit/OperationsCockpitPage.vue', '活动中 / 已确认'],
  ['运营看板能耗空态互斥', 'src/pages/cockpit/OperationsCockpitPage.vue', '<div v-else class="energy-empty">'],
  ['双碳看板首屏不展示模拟回退值', 'src/pages/cockpit/CarbonCockpitPage.vue', 'v-show="hasLoaded"'],
  ['双碳看板刷新失败保留历史结果', 'src/pages/cockpit/CarbonCockpitPage.vue', '刷新失败，当前保留上次成功结果'],
  ['个人设置入口已接通', 'src/layout/AppTopbar.vue', "emit('open-profile')"],
  ['个人设置遵循 Client 数据范围', 'src/layout/PersonalSettingsDrawer.vue', '当前 Client 全部授权数据'],
  ['停车平面图使用优化资源', 'src/pages/monitoring/ParkingMonitoringPage.vue', 'car-display.webp'],
  ['水表卡片行按内容高度排列', 'src/pages/assets/WaterMeterManagementPage.vue', 'grid-auto-rows:max-content;align-items:start'],
  ['RBAC 菜单树等待节点注册后回显', 'src/pages/user-permission/RolePermissionPage.vue', 'menuTreeSyncRevision'],
  ['RBAC 菜单树首帧携带默认权限', 'src/pages/user-permission/RolePermissionPage.vue', ':default-checked-keys="draft.menuPaths"'],
  ['RBAC 菜单树挂载后再次校准权限', 'src/pages/user-permission/RolePermissionPage.vue', 'watch(treeRef'],
  ['筛选器定义关键词标准宽度', 'src/design-system/styles/list-page.css', '--ds-filter-keyword-width: 340px'],
  ['筛选器定义短枚举标准宽度', 'src/design-system/styles/list-page.css', '--ds-filter-select-short-width: 132px'],
  ['筛选器定义日期范围标准宽度', 'src/design-system/styles/list-page.css', '--ds-filter-date-width: 300px'],
  ['计量质量状态使用短枚举规格', 'src/pages/metering/MeteringDataQualityPage.vue', 'enterprise-query-bar__field--short'],
  ['正式版能力占位使用统一组件', 'src/pages/placeholder/ModulePlaceholder.vue', 'placeholder.publicEditionTitle'],
  ['计量来源边界有客户标签', 'src/core/i18n/enum-labels.ts', "STORED_INTERVAL_ENERGY: '已入库的区间计量数据'"],
  ['未知中文业务枚举不泄漏英文码', 'src/core/i18n/enum-labels.ts', "locale === 'en-US' ? readableEnglish(value) : '待维护'"],
];

const failures = checks.filter(([, file, expected]) => !read(file).includes(expected));
if (failures.length) {
  for (const [name, file, expected] of failures) console.error(`FAIL ${name}: ${file} missing ${expected}`);
  process.exit(1);
}
for (const [name] of checks) console.log(`PASS ${name}`);
