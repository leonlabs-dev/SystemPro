import { fetchApi } from '@/core/api/base-client';
import type { AuthTokenResponse, AuthUserContext } from './auth.types';

const LOCAL_REFRESH_KEY = 'systempro.auth.refresh.local';
const SESSION_REFRESH_KEY = 'systempro.auth.refresh.session';
const SESSION_SYNC_CHANNEL = 'systempro.auth.session-sync';

let accessToken = '';
let userContext: AuthUserContext | null = null;
let refreshPromise: Promise<AuthTokenResponse> | null = null;

type SessionSyncMessage = {
  type: 'refresh-token';
  refreshToken: string;
  persistent: boolean;
};

const sessionSyncChannel = createSessionSyncChannel();

export const authSession = {
  getAccessToken() {
    return accessToken;
  },

  getUserContext() {
    return userContext;
  },

  hasRefreshToken() {
    return Boolean(readRefreshToken());
  },

  commit(tokens: AuthTokenResponse, persistent: boolean) {
    accessToken = tokens.accessToken;
    userContext = tokens.user;
    writeRefreshToken(tokens.refreshToken, persistent);
  },

  /**
   * Transfers a non-persistent login to a same-origin standalone window.
   *
   * sessionStorage is intentionally scoped to one top-level browsing context,
   * so a new cockpit window cannot restore the current login by itself. The
   * refresh token is copied directly into the child window's sessionStorage;
   * it is never persisted or exposed in the URL.
   */
  handoffToWindow(targetWindow: Window) {
    const refreshToken = readRefreshToken();
    if (!refreshToken) return;
    if (safeGet(localStorage, LOCAL_REFRESH_KEY) === refreshToken) return;
    safeSet(targetWindow.sessionStorage, SESSION_REFRESH_KEY, refreshToken);
  },

  clear() {
    accessToken = '';
    userContext = null;
    safeRemove(localStorage, LOCAL_REFRESH_KEY);
    safeRemove(sessionStorage, SESSION_REFRESH_KEY);
  },

  async ensureAccessToken() {
    if (accessToken) return accessToken;
    if (!readRefreshToken()) return '';
    return (await refresh()).accessToken;
  },

  refresh,

  async logout() {
    const refreshToken = readRefreshToken();
    try {
      if (refreshToken) {
        await fetchApi<void>('/api/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } finally {
      this.clear();
    }
  },
};

sessionSyncChannel?.addEventListener('message', (event: MessageEvent<SessionSyncMessage>) => {
  const message = event.data;
  if (message?.type !== 'refresh-token' || !message.refreshToken) return;
  writeRefreshToken(message.refreshToken, message.persistent, false);
});

async function refresh(): Promise<AuthTokenResponse> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = readRefreshToken();
  if (!refreshToken) {
    throw new Error('当前没有可刷新的登录会话');
  }
  const persistent = safeGet(localStorage, LOCAL_REFRESH_KEY) === refreshToken;

  refreshPromise = fetchApi<AuthTokenResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
    .then((tokens) => {
      accessToken = tokens.accessToken;
      userContext = tokens.user;
      writeRefreshToken(tokens.refreshToken, persistent);
      return tokens;
    })
    .catch((error) => {
      authSession.clear();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function readRefreshToken() {
  return safeGet(localStorage, LOCAL_REFRESH_KEY) || safeGet(sessionStorage, SESSION_REFRESH_KEY);
}

function writeRefreshToken(token: string, persistent: boolean, notifyPeers = true) {
  const target = persistent ? localStorage : sessionStorage;
  const other = persistent ? sessionStorage : localStorage;
  safeSet(target, persistent ? LOCAL_REFRESH_KEY : SESSION_REFRESH_KEY, token);
  safeRemove(other, persistent ? SESSION_REFRESH_KEY : LOCAL_REFRESH_KEY);
  if (notifyPeers) {
    sessionSyncChannel?.postMessage({
      type: 'refresh-token',
      refreshToken: token,
      persistent,
    } satisfies SessionSyncMessage);
  }
}

function createSessionSyncChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(SESSION_SYNC_CHANNEL);
  } catch {
    return null;
  }
}

function safeGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Private browsing can disable storage; the in-memory access token still works for this page.
  }
}

function safeRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage is best-effort; clearing the in-memory token remains authoritative.
  }
}
