<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { welcomeHeroImages } from '@/assets/images/home';
import { preloadImage, preloadImageWhenIdle } from '@/core/assets/image-preload';
import { useThemeStore } from '@/core/theme/theme.store';
import { getFirstNavigationPath, getNavigationTitle, navigationItems } from '@/core/navigation/menu';
import { useNavigationStore } from '@/core/navigation/navigation.store';
import { appName, isDemoMode } from '@/core/config/app-runtime';

const { t, locale } = useI18n();
const themeStore = useThemeStore();
const navigationStore = useNavigationStore();
const { theme } = storeToRefs(themeStore);

const welcomeHeroUrl = ref(welcomeHeroImages[theme.value]);
const welcomeHeroLoading = ref(false);
let welcomeHeroRequest = 0;

watch(theme, async (nextTheme) => {
  const request = ++welcomeHeroRequest;
  const nextUrl = welcomeHeroImages[nextTheme];
  welcomeHeroLoading.value = true;
  try {
    await preloadImage(nextUrl);
    if (request === welcomeHeroRequest) welcomeHeroUrl.value = nextUrl;
  } finally {
    if (request === welcomeHeroRequest) welcomeHeroLoading.value = false;
  }
});

const moduleRows = computed(() =>
  (navigationStore.items.length ? navigationStore.items : navigationItems).map((item) => ({
    id: item.id,
    label: getNavigationTitle(item, t),
    path: getFirstNavigationPath(item),
    count: item.children?.length || item.sections?.length || 0,
    scope: item.children?.length ? 'menu.children' : 'page.sections',
  })),
);

const routeCode = `// src/core/navigation/menu.ts is the single source of truth for navigation and route metadata
export const navigationItems: NavigationItem[] = [
  { id: 'welcome', path: '/welcome', sections: [...] },
  { id: 'workbench', path: '/workbench', sections: [...] },
  { id: 'user-permission', path: '/user-permission', children: [...] },
  { id: 'organization-project', path: '/organization', children: [...] },
  { id: 'system-settings', path: '/settings', children: [...] },
  // Other operations, device, energy, finance, billing, and AI groups
];

// src/router/index.ts binds registered navigation entries to route-level components
const pageComponentMap = {
  'account-list': AccountListPage,
  'role-permission': RolePermissionPage,
  'organization-tree': OrganizationTreePage,
  'tenant-customer': TenantListPage,
  'basic-parameters': BasicParametersPage,
  'data-dictionary': DataDictionaryPage,
  'audit-log': AuditLogPage,
};`;

const projectTree = `systempro-console/
├─ src/
│  ├─ core/                     # 平台服务（auth、theme、i18n、layout、permission）
│  │  ├─ auth/auth.store.ts     # 认证状态
│  │  ├─ config/app.config.ts   # 应用配置
│  │  ├─ freshness/             # 数据时效管理（IoT 场景实时数据容错）
│  │  ├─ i18n/                  # 国际化（zh-CN / en-US）
│  │  ├─ layout/                # 布局状态
│  │  ├─ metrics/               # 共享指标数据服务层（pv/storage/grid/load）
│  │  ├─ navigation/menu.ts     # 菜单与路由单一数据源
│  │  ├─ permission/            # 权限类型定义
│  │  └─ theme/                 # 主题切换
│  ├─ design-system/            # 设计系统原语
│  │  ├─ components/            # DsPanel / DsChart / DsDataTable / DsKpiCard / DsStatusTag / DsEmpty
│  │  ├─ styles/base.css        # 全局复位与基础样式
│  │  ├─ tokens/                # color / spacing / radius / chart
│  │  └─ types/state.ts         # 统一数据状态协议（loading/empty/error/success/stale）
│  ├─ domain/                   # 业务域（四域分离）
│  │  ├─ iot/                   # IoT域 — 设备与能源
│  │  │  ├─ assets/             # 设备资产
│  │  │  ├─ energy-flow/        # 能源流向（组件骨架预留）
│  │  │  ├─ metering-loss/      # 企业计量、拓扑、用能、损耗与数据质量
│  │  │  ├─ monitor/            # 停车、网关、视频和设备实时监控
│  │  │  └─ alarm/              # 告警工单
│  │  ├─ finance/               # 财务账单 — 银企直连、核销、调账、开票与账单流程
│  │  ├─ fusion/                # 融合层 — 跨域聚合消费
│  │  │  └─ dashboard/          # 运营驾驶舱（真实 API→repository 链路）
│  │  └─ platform/              # 平台底座
│  │     ├─ org/                # 组织项目、部门岗位与资源归属
│  │     ├─ user-permission/    # 用户权限（标准化试点）
│  │     ├─ settings/           # 基础参数、数据字典和审计 API
│  │     ├─ workbench/          # 工作台聚合指标与审计摘要
│  │     └─ ai-assistant/       # AI 智能助手
│  ├─ layout/                   # 布局组件（AppLayout / Sidebar / Topbar）
│  ├─ pages/                    # 页面组合层（只做路由承载，不持有核心业务逻辑）
│  │  ├─ home/HomePage.vue      # 欢迎与模块索引
│  │  ├─ organization/          # 组织、岗位、空间和租户页面
│  │  ├─ settings/              # 基础参数、数据字典和操作审计页面
│  │  ├─ user-permission/       # 账号、角色、菜单和登录源页面
│  │  └─ placeholder/           # 明确标识的规划中页面（不伪造业务数据）
│  ├─ router/index.ts           # 路由（由 menu.ts 自动生成）
│  ├─ store/index.ts            # Pinia 仓库入口
│  ├─ App.vue                   # 应用入口组件
│  └─ main.ts                   # 应用启动入口
├─ package.json                 # 依赖与脚本（engines.node >= 14.21.0）
└─ vite.config.ts               # Vite 构建配置`;

const commands = `# 环境要求: Node >= 14.21.0  |  npm >= 6.14.0  |  推荐 Node 18/20 LTS
npm install       # 安装依赖（Vue 3.3 / Element Plus 2.4 / ECharts 5.4）
npm run dev       # 启动开发服务器 → http://127.0.0.1:5173
npm run test:ui-contracts # 校验首屏加载、数据状态与个人设置契约
npm run build     # 类型检查 + 生产构建 → dist/
npm run preview   # 预览生产构建产物`;

const noticeItems = [
  'Node 版本要求 >= 14.21.0，npm >= 6.14.0。推荐使用 Node 18 LTS 或 20 LTS 以获得最佳开发体验。依赖项已固定版本（Vue 3.3、Element Plus 2.4、ECharts 5.4），请勿随意升级大版本。',
  '本项目不提交 .nvmrc、.node-version 或 Volta 配置，避免自动切换使用者本地 Node 版本。如使用 nvm / fnm，可自行在项目根目录创建 .nvmrc（已加入 .gitignore 模板）。',
  'dist、node_modules、dev-server-*.log 均属于本地运行/构建产物，不作为源码交付内容。',
  '欢迎页、菜单结构和 UI 规范变更后，需要同步维护工程文档，确保页面说明与实际能力一致。',
  '新增页面或组件前必须先确认兼容个人设置与整体风格设置：语言、亮色/暗色、主题色、导航模式、侧边菜单类型、内容宽度、固定区域、内容区开关、表格密度（舒适/紧凑）。',
  '列表与数据页首屏必须先表达加载状态，不能短暂显示空数据；后台刷新保留上次成功结果，并明确错误、空数据、缺数和无权限状态。',
  '新增业务优先进入 src/domain，再由 src/pages 组合展示，避免页面层堆积核心业务逻辑。',
  '表格密度系统已全局落地：通过 Pinia store（layoutStore.tableDensity）驱动 `.is-compact` CSS 级联覆盖，所有 `--ds-*` 密度敏感 token 按比例缩放。新建列表页必须绑定 `:class="{ \'is-compact\': layoutStore.tableDensity === \'compact\' }"` 并引用 `--ds-*` token。',
];

const faqItems = [
  {
    question: '如何启动开发环境？',
    answer: '确认本机 Node >= 14.21.0 且 npm >= 6.14.0（推荐 Node 18/20 LTS），执行 npm install 安装依赖，然后运行 npm run dev。开发服务默认绑定 127.0.0.1:5173。',
  },
  {
    question: 'Node 版本不兼容怎么办？',
    answer: '本项目 engine 声明为 node >= 14.21.0。如使用 nvm (Windows) 或 fnm，执行 nvm install 18 然后 nvm use 18 即可。可在项目根目录自行创建 .nvmrc 文件，但不会提交到仓库。',
  },
  {
    question: '如何接入或调整真实接口？',
    answer: '接口请求集中在 src/domain/* 的 API、repository 和 composable 中。调整后端契约时优先修改 domain 内 repository 的数据来源，页面层不直接写请求逻辑。',
  },
  {
    question: '如何修改主题色？',
    answer: '优先维护 src/design-system/tokens/primary.ts 与 light.css / dark.css 中的 token；开发时可通过右上角主题设置抽屉预览效果。',
  },
  {
    question: '如何添加新页面？',
    answer: '在 src/pages 或对应业务 domain 中创建页面/组件，在 src/core/navigation/menu.ts 增加菜单项，并在 src/core/i18n/locales 中补齐菜单名称与说明。',
  },
  {
    question: '如何添加全局状态？',
    answer: '跨页面通用状态放入 src/core/* 或 Pinia store；业务域状态优先放在 src/domain/*/composables 内，避免所有状态集中到一个大 store。',
  },
  {
    question: '如何部署？',
    answer: '运行 npm run build 生成 dist 目录，将 dist 部署到任意静态服务器即可；非根目录部署时需要同步检查 Vite base 与后端静态资源路径。',
  },
  {
    question: '如何扩展 OpenAPI 代码生成？',
    answer: '当前项目尚未接入 OpenAPI 生成链路。后续建议在 tools/ 或 src/services/ 下统一管理生成结果，并让 domain repository 通过明确接口调用生成代码。',
  },
];

const englishProjectTree = `systempro-console/
├─ src/
│  ├─ core/                     # Authentication, i18n, layout, navigation, permissions, and theme
│  ├─ design-system/            # Tokens and reusable UI primitives
│  ├─ domain/                   # IoT, finance, fusion, and platform business domains
│  ├─ layout/                   # Application shell, sidebar, and top bar
│  ├─ pages/                    # Route-level composition only
│  ├─ router/index.ts           # Routes generated from navigation metadata
│  ├─ store/index.ts            # Pinia store entry
│  ├─ App.vue                   # Root component
│  └─ main.ts                   # Application bootstrap
├─ package.json                 # Dependencies and scripts
└─ vite.config.ts               # Vite configuration`;

const englishCommands = `npm install
npm run dev       # http://127.0.0.1:5173
npm run test:ui-contracts
npm run build
npm run preview`;

const pageCopy = computed(() => locale.value === 'en-US' ? {
  kicker: `${appName} / Public Product Experience`, title: `Welcome to ${appName}`, separator: ':',
  subtitle: 'An integrated operations platform for parks, buildings, factories, and energy projects, covering device connectivity, energy metering, alarm work orders, finance, billing, and AI assistance.',
  intro: 'Capabilities', quickStart: 'Quick Start', structure: 'Project Structure', routes: 'Routes And Navigation', modules: 'Module Registry', boundary: 'Platform Boundary', notices: 'Important Notes', faq: 'FAQ',
  quickStartDesc: isDemoMode
    ? 'Demo mode is active. Run the frontend directly without a private backend or shared account; all visible metrics are walkthrough data.'
    : 'API mode is active. Data and permissions are supplied by the deployer-owned backend configured through local environment variables.',
  structureDesc: 'The layered structure keeps business domains, the design system, platform services, and page composition independently maintainable.',
  routesDesc: `${navigationItems.length} parent navigation entries share one metadata source. Routes, permissions, tabs, and localized titles are derived from the same registry.`,
  features: [
    ['Operations cockpit', 'Carbon, PV-storage-charging, and integrated operations dashboards.'],
    ['Devices and energy', 'Device assets, energy flow, subitem metering, loss analysis, and abnormal-consumption detection.'],
    ['Alarm work orders', 'Realtime alarms, rules, alarm-to-ticket conversion, and historical statistics.'],
    ['Platform capabilities', 'Users, RBAC, organizations, positions, spaces, client isolation, settings, dictionaries, and read-only audit.'],
  ],
  boundaryRows: [['IoT', 'Devices, gateways, alarms, video, energy flow, and realtime data.'], ['Finance', 'Banking, reconciliation, adjustments, invoices, bills, and audit.'], ['AI', 'Operations Q&A, alarm diagnosis, energy analysis, reporting, and knowledge base.']],
  noticesList: [
    'Use Node 18 or 20 LTS and keep major dependency upgrades under explicit review.',
    'Generated folders and local logs are runtime artifacts and are not source deliverables.',
    'New pages must support light/dark themes, navigation layouts, content widths, and table density.',
    'Business logic belongs in domains; pages only compose routes, layouts, and design-system components.',
  ],
  faqList: [
    ['How do I start development?', 'Run npm install and npm run dev. The development server uses the configured Vite port.'],
    ['How are APIs integrated?', 'Requests live in domain APIs, repositories, and composables. Route pages do not issue ad-hoc requests.'],
    ['How do I add a page?', 'Add the domain capability first, then register navigation metadata, routes, permissions, and both locale resources.'],
    ['How do I deploy?', 'Run npm run build and deploy dist to a static server with the matching API proxy configuration.'],
  ],
  projectTree: englishProjectTree, commands: englishCommands,
} : {
  kicker: `${appName} / 公开产品体验`, title: `欢迎使用 ${appName}`, separator: '：',
  subtitle: 'systemPro 面向园区、楼宇、工厂和能源项目，提供设备接入、能源计量、告警工单、财务中心、账单管理与 AI 辅助的一体化运营管理能力。',
  intro: '功能介绍', quickStart: '快速开始', structure: '目录结构', routes: '路由与菜单', modules: '模块注册表', boundary: '平台边界', notices: '注意事项', faq: 'FAQ',
  quickStartDesc: isDemoMode
    ? '当前为演示模式：无需私有后端或共享账号即可进入；页面指标仅用于产品能力演示，不代表真实生产数据。'
    : '当前为接口模式：数据与权限来自部署方自行配置的后端服务和本地环境变量。',
  structureDesc: '目录结构体现工程分层，便于扩展业务模块、维护设计系统和接入后端接口。',
  routesDesc: `${navigationItems.length} 个一级菜单项统一由 menu.ts 驱动；路由、权限、页签与中英文标题共享同一份注册信息。`,
  features: [['运营驾驶舱', '覆盖综合运营、双碳与光储充看板，统一呈现项目、设备、告警、能耗与经营指标。'], ['设备与能源', '承载设备资产、运营监控、能源流向、企业计量、损耗分析与计量数据质量。'], ['财务与账单', '支持银企直连、收款核销、调账退款、开票和账单全生命周期。'], ['平台能力', '覆盖账号权限、组织岗位、项目空间、租户档案、系统设置、数据字典和操作审计。']],
  boundaryRows: [['设备与能源', '设备、网关、告警、视频、能源流向、计量关系和实时数据。'], ['财务与账单', '银行流水、收款核销、调账退款、发票、账单和审计。'], ['平台与智能辅助', 'Client/Tenant 隔离、RBAC、组织权限、运营问答、告警诊断和报表辅助。']],
  noticesList: noticeItems,
  faqList: faqItems.map((item) => [item.question, item.answer]),
  projectTree, commands,
});

const localizedTocItems = computed(() => [
  { id: 'intro', text: pageCopy.value.intro }, { id: 'quickstart', text: pageCopy.value.quickStart },
  { id: 'structure', text: pageCopy.value.structure }, { id: 'routes', text: pageCopy.value.routes },
  { id: 'modules', text: pageCopy.value.modules }, { id: 'boundary', text: pageCopy.value.boundary },
  { id: 'notices', text: pageCopy.value.notices }, { id: 'faq', text: pageCopy.value.faq },
]);

const activeTocId = ref(localizedTocItems.value[0].id);
let scrollContainer: HTMLElement | null = null;

function updateActiveToc() {
  const containerTop = scrollContainer?.getBoundingClientRect().top || 0;
  const threshold = containerTop + 112;
  let currentId = localizedTocItems.value[0].id;

  localizedTocItems.value.forEach((item) => {
    const section = document.getElementById(item.id);
    if (section && section.getBoundingClientRect().top <= threshold) {
      currentId = item.id;
    }
  });

  activeTocId.value = currentId;
}

onMounted(() => {
  preloadImageWhenIdle(welcomeHeroImages[theme.value === 'dark' ? 'light' : 'dark']);
  nextTick(() => {
    scrollContainer = document.querySelector('.app-layout__content');
    scrollContainer?.addEventListener('scroll', updateActiveToc, { passive: true });
    window.addEventListener('resize', updateActiveToc);
    updateActiveToc();
  });
});

onBeforeUnmount(() => {
  scrollContainer?.removeEventListener('scroll', updateActiveToc);
  window.removeEventListener('resize', updateActiveToc);
});
</script>

<template>
  <div class="welcome-doc-page">
    <main class="doc-main">
      <header class="doc-header">
        <p class="doc-kicker">{{ pageCopy.kicker }}</p>
        <h1>{{ pageCopy.title }}</h1>
        <p class="doc-subtitle">{{ pageCopy.subtitle }}</p>
        <img
          class="doc-hero"
          :class="{ 'is-loading': welcomeHeroLoading }"
          :src="welcomeHeroUrl"
          :alt="t('welcome.heroImageAlt')"
          decoding="async"
          fetchpriority="high"
        />
      </header>

      <section id="intro" class="doc-section">
        <h2>{{ pageCopy.intro }}</h2>
        <ul class="feature-list">
          <li v-for="feature in pageCopy.features" :key="feature[0]"><strong>{{ feature[0] }}{{ pageCopy.separator }}</strong><span>{{ feature[1] }}</span></li>
        </ul>
      </section>

      <section id="quickstart" class="doc-section">
        <h2>{{ pageCopy.quickStart }}</h2>
        <p>{{ pageCopy.quickStartDesc }}</p>
        <pre class="code-block"><code>{{ pageCopy.commands }}</code></pre>
      </section>

      <section id="structure" class="doc-section">
        <h2>{{ pageCopy.structure }}</h2>
        <p>{{ pageCopy.structureDesc }}</p>
        <pre class="code-block"><code>{{ pageCopy.projectTree }}</code></pre>
      </section>

      <section id="routes" class="doc-section">
        <h2>{{ pageCopy.routes }}</h2>
        <p>{{ pageCopy.routesDesc }}</p>
        <pre class="code-block"><code>{{ routeCode }}</code></pre>
      </section>

      <section id="modules" class="doc-section">
        <h2>{{ pageCopy.modules }}</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">id</th>
                <th scope="col">label</th>
                <th scope="col">path</th>
                <th scope="col">count</th>
                <th scope="col">scope</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in moduleRows" :key="item.id">
                <th scope="row"><code>{{ item.id }}</code></th>
                <td>{{ item.label }}</td>
                <td><code>{{ item.path }}</code></td>
                <td>{{ item.count }}</td>
                <td><code>{{ item.scope }}</code></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="boundary" class="doc-section">
        <h2>{{ pageCopy.boundary }}</h2>
        <div class="boundary-table">
          <div v-for="row in pageCopy.boundaryRows" :key="row[0]"><strong>{{ row[0] }}</strong><span>{{ row[1] }}</span></div>
        </div>
      </section>

      <section id="notices" class="doc-section">
        <h2>{{ pageCopy.notices }}</h2>
        <ul class="notice-list">
          <li v-for="item in pageCopy.noticesList" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section id="faq" class="doc-section">
        <h2>{{ pageCopy.faq }}</h2>
        <div class="faq-list">
          <article v-for="item in pageCopy.faqList" :key="item[0]">
            <h3>Q: {{ item[0] }}</h3>
            <p>A: {{ item[1] }}</p>
          </article>
        </div>
      </section>
    </main>

    <aside class="doc-anchor" aria-label="Page outline">
      <p class="doc-anchor__label">{{ t('welcome.tocTitle') }}</p>
      <nav class="doc-anchor__nav">
        <a
          v-for="item in localizedTocItems"
          :key="item.id"
          class="doc-anchor__link"
          :class="{ 'is-active': activeTocId === item.id }"
          :href="`#${item.id}`"
          @click="activeTocId = item.id"
        >
          {{ item.text }}
        </a>
      </nav>
    </aside>
  </div>
</template>

<style scoped>
.welcome-doc-page {
  display: grid;
  grid-template-columns: minmax(0, 760px) 220px;
  gap: 34px;
  width: 100%;
  max-width: 1040px;
  margin: 0 auto 0 0;
  padding: 0 0 36px;
}

:global(.is-top-nav .welcome-doc-page),
:global(.is-mix-nav .welcome-doc-page) {
  max-width: 1180px;
  grid-template-columns: minmax(0, 760px) 220px;
  justify-content: center;
  margin-right: auto;
  margin-left: auto;
}

:global(.is-top-nav:not(.is-content-fixed) .welcome-doc-page),
:global(.is-mix-nav:not(.is-content-fixed) .welcome-doc-page) {
  max-width: 1280px;
  grid-template-columns: minmax(0, 820px) 220px;
}

.doc-main {
  min-width: 0;
}

.doc-header,
.doc-section {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  box-shadow: 0 14px 38px rgb(15 23 42 / 5%);
}

.doc-header {
  padding: 20px 22px 22px;
}

.doc-kicker {
  margin: 0 0 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 20px;
}

.doc-header h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 28px;
  font-weight: var(--font-weight-bold);
  line-height: 38px;
}

.doc-subtitle,
.doc-section p,
.feature-list span,
.boundary-table span,
.faq-list p {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 24px;
}

.doc-hero {
  display: block;
  width: 100%;
  height: 214px;
  margin-top: 16px;
  object-fit: cover;
  object-position: center;
  border: 0;
  border-radius: var(--radius-sm);
  opacity: 1;
  transition: opacity 120ms ease;
}

.doc-hero.is-loading {
  opacity: 0;
}

.doc-section {
  margin-top: 16px;
  padding: 20px 22px 22px;
  scroll-margin-top: 24px;
}

.doc-section h2 {
  margin: 0 0 12px;
  color: var(--color-text-primary);
  font-size: 20px;
  font-weight: var(--font-weight-bold);
  line-height: 30px;
}

.feature-list,
.notice-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 18px;
}

.feature-list li,
.notice-list li {
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 24px;
}

.feature-list strong {
  font-weight: var(--font-weight-bold);
}

.code-block {
  width: 100%;
  max-width: 100%;
  margin: 12px 0 0;
  padding: 16px;
  overflow: auto;
  color: var(--color-text-primary);
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  font-family: 'Cascadia Code', 'SF Mono', Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 22px;
  white-space: pre-wrap;
}

.code-block code {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
}

.table-wrap {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

th,
td {
  padding: 10px 11px;
  border-top: 1px solid var(--color-border-default);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 20px;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

thead th {
  color: var(--color-text-secondary);
  background: var(--color-bg-muted);
  border-top: 0;
  font-weight: var(--font-weight-bold);
}

th:nth-child(1),
td:nth-child(1) {
  width: 25%;
}

th:nth-child(2),
td:nth-child(2) {
  width: 18%;
}

th:nth-child(3),
td:nth-child(3) {
  width: 22%;
}

th:nth-child(4),
td:nth-child(4) {
  width: 10%;
}

th:nth-child(5),
td:nth-child(5) {
  width: 25%;
}

tbody th {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-bold);
}

code {
  color: var(--color-text-primary);
  font-family: 'Cascadia Code', 'SF Mono', Consolas, Monaco, monospace;
  font-size: 12px;
  white-space: normal;
  word-break: break-word;
}

.boundary-table {
  overflow: hidden;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
}

.boundary-table div {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  border-top: 1px solid var(--color-border-default);
}

.boundary-table div:first-child {
  border-top: 0;
}

.boundary-table strong,
.boundary-table span {
  margin: 0;
  padding: 12px 14px;
}

.boundary-table strong {
  color: var(--color-text-primary);
  background: var(--color-bg-muted);
  font-size: 13px;
  line-height: 22px;
}

.faq-list {
  display: grid;
  gap: 12px;
}

.faq-list article {
  padding: 12px 14px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
}

.faq-list h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 24px;
}

.doc-anchor {
  position: sticky;
  top: 24px;
  align-self: start;
  padding-left: 12px;
  border-left: 1px solid var(--color-border-default);
}

.doc-anchor__label {
  margin: 0 0 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: var(--font-weight-regular);
  line-height: 20px;
}

.doc-anchor__nav {
  display: grid;
  gap: 0;
}

.doc-anchor__link {
  position: relative;
  display: block;
  margin-left: -13px;
  padding: 5px 0 5px 12px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 22px;
  text-decoration: none;
}

.doc-anchor__link.is-active::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 1px;
  height: 12px;
  background: var(--color-text-primary);
  transform: translateY(-50%);
  content: '';
}

.doc-anchor__link:hover {
  color: var(--color-text-primary);
}

.doc-anchor__link.is-active {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

@media (max-width: 1100px) {
  .welcome-doc-page {
    grid-template-columns: 1fr;
    margin-left: 0;
  }

  .doc-anchor {
    position: static;
    order: -1;
    margin-bottom: 4px;
    padding-left: 0;
    border-left: 0;
  }

  .doc-anchor__nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
  }

  .doc-anchor__link {
    margin-left: 0;
    padding: 0;
    font-size: 12px;
    line-height: 20px;
  }

  .doc-anchor__link.is-active::before {
    display: none;
  }

  .doc-anchor__link.is-active {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

@media (max-width: 720px) {
  .doc-header,
  .doc-section {
    padding: 16px;
  }

  .doc-hero {
    height: 170px;
  }

  .boundary-table div {
    grid-template-columns: 1fr;
  }
}
</style>
