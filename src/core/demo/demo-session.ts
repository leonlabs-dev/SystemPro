import type {
  AuthUserContext,
  CurrentAccount,
  CurrentClient,
  GrantedMenuNode,
  NavigationGrant,
} from '@/core/auth/auth.types';
import { navigationItems, type NavigationItem } from '@/core/navigation/menu';

const DEMO_MENU_IDS = new Set(['welcome', 'workbench', 'ai-assistant']);

export const demoUserContext: AuthUserContext = {
  accountId: 0,
  clientId: 0,
  clientCode: 'DEMO',
  tenantId: null,
  tenantIds: [],
  username: 'demo',
  displayName: 'Demo Viewer',
  roles: ['demo_viewer'],
  forceChangePassword: false,
};

export const demoAccount: CurrentAccount = {
  id: 0,
  clientId: 0,
  defaultTenantId: null,
  username: 'demo',
  email: null,
  displayName: 'Demo Viewer',
  status: 'ACTIVE',
  forceChangePassword: false,
  roles: [{ code: 'demo_viewer', name: 'Demo Viewer' }],
};

export const demoClient: CurrentClient = {
  id: 0,
  clientCode: 'DEMO',
  clientName: 'SystemPro Demo Workspace',
  clientType: 'DEMO',
  deployType: 'STANDALONE',
  status: 'ACTIVE',
};

export const demoNavigationGrant: NavigationGrant = {
  menus: navigationItems
    .filter((item) => DEMO_MENU_IDS.has(item.id))
    .map(toGrantedMenu),
  permissions: [],
  dataScopes: ['DEMO_ONLY'],
};

function toGrantedMenu(item: NavigationItem, index: number): GrantedMenuNode {
  return {
    id: index,
    code: item.id,
    name: '',
    type: item.children?.length ? 'CATALOG' : 'MENU',
    path: item.path,
    icon: item.icon,
    keepAlive: true,
    children: (item.children ?? []).map(toGrantedMenu),
  };
}
