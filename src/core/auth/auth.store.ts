import { defineStore } from 'pinia';
import { authApi } from './auth.api';
import { authSession } from './session.manager';
import type {
  AuthTokenResponse,
  AuthUserContext,
  CurrentAccount,
  CurrentClient,
  LoginCredentials,
} from './auth.types';
import { useNavigationStore } from '@/core/navigation/navigation.store';
import { useRouteTabsStore } from '@/core/navigation/route-tabs.store';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';
import { isDemoMode } from '@/core/config/app-runtime';
import {
  demoAccount,
  demoClient,
  demoNavigationGrant,
  demoUserContext,
} from '@/core/demo/demo-session';

type AuthStatus = 'idle' | 'restoring' | 'authenticated' | 'anonymous';

let restorePromise: Promise<void> | null = null;
let authorizationRequestVersion = 0;
const AUTHORIZATION_CACHE_MS = 5_000;
const AUTHORIZATION_UPDATED_EVENT = 'systempro:authorization-updated';

function notifyAuthorizationUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTHORIZATION_UPDATED_EVENT));
  }
}

export const useAuthStore = defineStore('core.auth', {
  state: () => ({
    status: 'idle' as AuthStatus,
    initialized: false,
    account: null as CurrentAccount | null,
    client: null as CurrentClient | null,
    userContext: null as AuthUserContext | null,
    grantedPermissions: [] as string[],
    dataScopes: [] as string[],
    authorizationLoadedAt: 0,
  }),
  getters: {
    isAuthenticated: (state) => state.status === 'authenticated',
    displayName: (state) => state.account?.displayName || state.userContext?.displayName || '',
  },
  actions: {
    async login(credentials: LoginCredentials, persistent: boolean) {
      if (isDemoMode) {
        this.activateDemoSession();
        return;
      }
      const tokens = await authApi.login(credentials);
      await this.establishSession(tokens, persistent);
    },

    async establishSession(tokens: AuthTokenResponse, persistent: boolean) {
      authSession.commit(tokens, persistent);
      this.userContext = tokens.user;
      try {
        await this.hydrate();
      } catch (error) {
        authSession.clear();
        this.reset();
        throw error;
      }
    },

    async restore() {
      if (this.initialized) return;
      if (restorePromise) return restorePromise;

      restorePromise = this.restoreSession().finally(() => {
        restorePromise = null;
      });
      return restorePromise;
    },

    async restoreSession() {
      this.status = 'restoring';
      if (isDemoMode) {
        this.activateDemoSession();
        return;
      }
      try {
        const accessToken = await authSession.ensureAccessToken();
        if (!accessToken) {
          this.reset();
          return;
        }
        this.userContext = authSession.getUserContext();
        await this.hydrate();
      } catch {
        authSession.clear();
        this.reset();
      }
    },

    async hydrate() {
      const requestVersion = ++authorizationRequestVersion;
      const [account, client, navigation] = await Promise.all([
        authApi.currentAccount(),
        authApi.currentClient(),
        authApi.navigation(),
      ]);
      if (requestVersion !== authorizationRequestVersion) return;
      this.account = account;
      this.client = client;
      this.grantedPermissions = [...navigation.permissions];
      this.dataScopes = [...navigation.dataScopes];
      this.authorizationLoadedAt = Date.now();
      const navigationStore = useNavigationStore();
      navigationStore.replaceFromGrant(navigation.menus);
      const routeTabsStore = useRouteTabsStore();
      routeTabsStore.activateScope(
        this.userContext?.clientId ?? account.clientId,
        this.userContext?.tenantId ?? account.defaultTenantId,
        this.userContext?.accountId ?? account.id,
      );
      routeTabsStore.retainAllowed(navigationStore.flatItems.map((item) => item.path));
      this.status = 'authenticated';
      this.initialized = true;
      notifyAuthorizationUpdated();
    },

    async refreshAuthorization(force = false) {
      if (!this.isAuthenticated) return;
      if (isDemoMode) return;
      if (!force && Date.now() - this.authorizationLoadedAt < AUTHORIZATION_CACHE_MS) return;
      const requestVersion = ++authorizationRequestVersion;
      const navigation = await authApi.navigation(true);
      if (requestVersion !== authorizationRequestVersion) return;
      this.grantedPermissions = [...navigation.permissions];
      this.dataScopes = [...navigation.dataScopes];
      this.authorizationLoadedAt = Date.now();
      const navigationStore = useNavigationStore();
      navigationStore.replaceFromGrant(navigation.menus);
      useRouteTabsStore().retainAllowed(navigationStore.flatItems.map((item) => item.path));
      notifyAuthorizationUpdated();
    },

    can(permissionCode: string) {
      return this.grantedPermissions.includes(permissionCode);
    },

    canAll(permissionCodes: string[]) {
      return permissionCodes.every((permissionCode) => this.can(permissionCode));
    },

    canEnter(permissionCode: string) {
      return this.can(permissionCode) || useRuntimeSettingsStore().readonlyActionMode === 'PREVIEW';
    },

    canEnterAll(permissionCodes: string[]) {
      return this.canAll(permissionCodes) || useRuntimeSettingsStore().readonlyActionMode === 'PREVIEW';
    },

    canShow(permissionCode: string) {
      return this.can(permissionCode) || useRuntimeSettingsStore().readonlyActionMode !== 'HIDDEN';
    },

    canShowAll(permissionCodes: string[]) {
      return this.canAll(permissionCodes) || useRuntimeSettingsStore().readonlyActionMode !== 'HIDDEN';
    },

    async logout() {
      if (isDemoMode) {
        this.activateDemoSession();
        return;
      }
      try {
        await authSession.logout();
      } finally {
        this.reset();
      }
    },

    reset() {
      authorizationRequestVersion += 1;
      this.status = 'anonymous';
      this.initialized = true;
      this.account = null;
      this.client = null;
      this.userContext = null;
      this.grantedPermissions = [];
      this.dataScopes = [];
      this.authorizationLoadedAt = 0;
      useNavigationStore().clear();
      useRouteTabsStore().releaseScope();
    },

    activateDemoSession() {
      authorizationRequestVersion += 1;
      this.status = 'authenticated';
      this.initialized = true;
      this.account = { ...demoAccount, roles: demoAccount.roles.map((role) => ({ ...role })) };
      this.client = { ...demoClient };
      this.userContext = { ...demoUserContext, tenantIds: [], roles: [...demoUserContext.roles] };
      this.grantedPermissions = [];
      this.dataScopes = [...demoNavigationGrant.dataScopes];
      this.authorizationLoadedAt = Date.now();
      const navigationStore = useNavigationStore();
      navigationStore.replaceFromGrant(demoNavigationGrant.menus);
      const routeTabsStore = useRouteTabsStore();
      routeTabsStore.activateScope(demoUserContext.clientId, demoUserContext.tenantId, demoUserContext.accountId);
      routeTabsStore.retainAllowed(navigationStore.flatItems.map((item) => item.path));
      notifyAuthorizationUpdated();
    },
  },
});
