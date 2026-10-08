import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = process.cwd();
const tests = [];
const test = (name, run) => tests.push([name, run]);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };
const tokens = (id) => ({ accessToken: id + '-a', refreshToken: id + '-r', user: { accountId: id, clientId: 1 } });

class TestHeaders {
  constructor(initial = {}) {
    this.values = new Map(initial instanceof TestHeaders ? initial.values : Object.entries(initial).map(([k, v]) => [k.toLowerCase(), String(v)]));
  }
  set(k, v) { this.values.set(k.toLowerCase(), String(v)); }
  get(k) { return this.values.get(k.toLowerCase()) ?? null; }
  has(k) { return this.values.has(k.toLowerCase()); }
}
class TestSignal {
  aborted = false;
  listeners = new Set();
  addEventListener(type, listener) { if (type === 'abort') this.listeners.add(listener); }
  removeEventListener(type, listener) { if (type === 'abort') this.listeners.delete(listener); }
}
class TestController {
  signal = new TestSignal();
  abort() {
    if (this.signal.aborted) return;
    this.signal.aborted = true;
    for (const listener of [...this.signal.listeners]) listener();
  }
}
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};
function response(data, status = 200, headers = {}) {
  return { status, ok: status >= 200 && status < 300, headers: new TestHeaders(headers),
    json: async () => { if (data instanceof Error) throw data; return data; },
    blob: async () => data,
  };
}
const ok = (data) => response({ code: 'OK', message: '', data });
function harness(overrides = {}) {
  let clock = 0, timerId = 0;
  const timers = new Map(), cache = new Map(), unmount = [], calls = [], channels = [];
  const vue = { ref: (value) => ({ value }), readonly: (value) => value,
    onBeforeUnmount: (fn) => unmount.push(fn) };
  const env = {
    console, Headers: TestHeaders, AbortController: TestController,
    localStorage: storage(), sessionStorage: storage(), __testEnv: { VITE_API_BASE_URL: '' },
    window: { dispatchEvent() {} }, CustomEvent: class {}, crypto: undefined,
    BroadcastChannel: class {
      listeners = [];
      constructor() { channels.push(this); }
      addEventListener(type, fn) { this.listeners.push(fn); }
      postMessage() {}
    },
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: clock + ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
    fetch: async (...args) => { calls.push(args); return overrides.fetch ? overrides.fetch(...args) : ok(null); },
  };
  const context = vm.createContext(env);
  const moduleOverrides = { vue, '@/core/config/app-runtime': { apiBaseUrl: '', isDemoMode: false }, ...overrides.modules };
  function load(file) {
    const absolute = path.resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    let source = fs.readFileSync(absolute, 'utf8').replace(/import\.meta\.env/g, '__testEnv');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const module = { exports: {} };
    cache.set(absolute, module);
    const resolveImport = (name) => {
      if (name in moduleOverrides) return moduleOverrides[name];
      if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(absolute), name + '.ts')));
      return require(name);
    };
    const fn = vm.runInContext('(function(require, module, exports) {' + output + '\n})', context, { filename: file });
    fn(resolveImport, module, module.exports);
    return module.exports;
  }
  return { env, calls, channels, unmount, load, timers, context,
    advance(ms) {
      clock += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= clock) { timers.delete(id); timer.fn(); }
      }
    },
  };
}
function abortable(init) {
  return new Promise((resolve, reject) => {
    const rejectAbort = () => reject(new Error('aborted'));
    if (init.signal.aborted) rejectAbort();
    else init.signal.addEventListener('abort', rejectAbort);
  });
}
async function rejectsCode(promise, code) { await assert.rejects(promise, (error) => error.code === code); }

test('JSON success, business error, 204 and language/header compatibility', async () => {
  const h = harness({ fetch: async (url) => url === '/empty' ? response(null, 204) : url === '/bad' ? response({ code: 'BAD_INPUT', message: 'invalid', data: null }, 400) : ok({ value: 3 }) });
  h.env.localStorage.setItem('systempro.locale', 'en-US');
  const api = h.load('src/core/api/base-client.ts');
  assert.equal((await api.fetchApi('/good')).value, 3);
  assert.equal(await api.fetchApi('/empty'), undefined);
  await rejectsCode(api.fetchApi('/bad'), 'BAD_INPUT');
  assert.equal(h.calls[0][1].headers.get('Accept-Language'), 'en-US');
  assert.ok(h.calls[0][1].headers.get('X-Request-Id'));
  assert.equal(h.timers.size, 0);
});
test('HTML 502/503/504 preserves HTTP status and request id', async () => {
  for (const status of [502, 503, 504]) {
    const h = harness({ fetch: async () => response(new SyntaxError('HTML'), status, { 'X-Request-Id': 'trace' }) });
    await assert.rejects(h.load('src/core/api/base-client.ts').fetchApi('/query'), (error) => error.code === 'SERVICE_UNAVAILABLE' && error.status === status && error.requestId === 'trace');
  }
});
test('successful malformed JSON and null envelopes are invalid responses', async () => {
  for (const payload of [new SyntaxError('bad'), null, [], {}, { code: 0 }]) {
    const h = harness({ fetch: async () => response(payload) });
    await rejectsCode(h.load('src/core/api/base-client.ts').fetchApi('/query'), 'INVALID_RESPONSE');
  }
});
test('blocked locale storage does not break API requests', async () => {
  const h = harness();
  h.env.localStorage.getItem = () => { throw new Error('storage blocked'); };
  await h.load('src/core/api/base-client.ts').fetchApi('/query');
  assert.equal(h.calls[0][1].headers.get('Accept-Language'), 'zh-CN');
});
test('network failure is distinct from timeout', async () => {
  const h = harness({ fetch: async () => { throw new Error('offline'); } });
  await rejectsCode(h.load('src/core/api/base-client.ts').fetchApi('/query'), 'NETWORK_ERROR');
  assert.equal(h.timers.size, 0);
});
test('query default timeout is 30 seconds and configurable', async () => {
  for (const configured of [undefined, 7]) {
    const h = harness({ fetch: (url, init) => abortable(init) });
    const pending = h.load('src/core/api/base-client.ts').fetchApi('/query', {}, { timeoutMs: configured });
    const checked = rejectsCode(pending, 'REQUEST_TIMEOUT');
    const timeout = configured ?? 30000;
    h.advance(timeout - 1);
    assert.equal(h.calls[0][1].signal.aborted, false);
    h.advance(1);
    await checked;
    assert.equal(h.timers.size, 0);
  }
});
test('timeout covers response-body reading, not just response headers', async () => {
  const h = harness({ fetch: async (url, init) => ({ ...ok(null), json: () => abortable(init) }) });
  const checked = rejectsCode(h.load('src/core/api/base-client.ts').fetchApi('/query', {}, { timeoutMs: 10 }), 'REQUEST_TIMEOUT');
  await tick();
  h.advance(10);
  await checked;
});
test('write timeout warns of uncertain result and never auto-retries', async () => {
  const h = harness({ fetch: (url, init) => abortable(init) });
  const pending = h.load('src/core/api/base-client.ts').fetchApi('/save', { method: 'POST', body: '{}' });
  const checked = assert.rejects(pending, (error) => error.code === 'REQUEST_TIMEOUT' && error.message.includes('避免重复提交'));
  h.advance(30000);
  assert.equal(h.calls[0][1].signal.aborted, false);
  h.advance(90000);
  await checked;
  assert.equal(h.calls.length, 1);
});
test('pre-cancelled requests never reach fetch; cancellation removes listeners', async () => {
  const h = harness({ fetch: (url, init) => abortable(init) });
  const api = h.load('src/core/api/base-client.ts'), controller = new TestController();
  controller.abort();
  await rejectsCode(api.fetchApi('/save', { method: 'POST', signal: controller.signal }), 'REQUEST_ABORTED');
  assert.equal(h.calls.length, 0);
  assert.equal(controller.signal.listeners.size, 0);
  const next = new TestController();
  const checked = rejectsCode(api.fetchApi('/query', { signal: next.signal }), 'REQUEST_ABORTED');
  next.abort();
  await checked;
  assert.equal(next.signal.listeners.size, 0);
  assert.equal(h.timers.size, 0);
});
test('timeout opt-out retains caller cancellation', async () => {
  const h = harness({ fetch: (url, init) => abortable(init) }), controller = new TestController();
  const checked = rejectsCode(h.load('src/core/api/base-client.ts').fetchApi('/query', { signal: controller.signal }, { timeoutMs: 0 }), 'REQUEST_ABORTED');
  assert.equal(h.timers.size, 0);
  controller.abort();
  await checked;
});

test('concurrent refresh requests share one request', async () => {
  const d = deferred(), h = harness({ fetch: () => d.promise });
  const session = h.load('src/core/auth/session.manager.ts').authSession;
  session.commit(tokens('old'), true);
  const a = session.refresh(), b = session.refresh();
  assert.equal(h.calls.length, 1);
  d.resolve(ok(tokens('new')));
  assert.equal((await a).accessToken, 'new-a');
  assert.equal((await b).accessToken, 'new-a');
});
test('logout immediately invalidates refresh; late success cannot restore session', async () => {
  const refresh = deferred(), logout = deferred();
  const h = harness({ fetch: (url) => url.endsWith('/refresh') ? refresh.promise : logout.promise });
  const session = h.load('src/core/auth/session.manager.ts').authSession;
  session.commit(tokens('old'), true);
  const checked = rejectsCode(session.refresh(), 'SESSION_CHANGED');
  const pendingLogout = session.logout();
  assert.equal(session.getAccessToken(), '');
  assert.equal(session.hasRefreshToken(), false);
  refresh.resolve(ok(tokens('late')));
  await checked;
  logout.resolve(ok(null));
  await pendingLogout;
  assert.equal(session.getAccessToken(), '');
  h.channels[0].listeners[0]({ data: { type: 'refresh-token', refreshToken: 'late-r', persistent: true } });
  assert.equal(session.hasRefreshToken(), false);
});
test('old refresh failure and logout completion cannot clear a new login', async () => {
  const refresh = deferred(), logout = deferred();
  const h = harness({ fetch: (url) => url.endsWith('/refresh') ? refresh.promise : logout.promise });
  const session = h.load('src/core/auth/session.manager.ts').authSession;
  session.commit(tokens('old'), true);
  const old = rejectsCode(session.refresh(), 'UNAUTHORIZED');
  const pendingLogout = session.logout();
  session.commit(tokens('new'), false);
  refresh.resolve(response({ code: 'UNAUTHORIZED', message: 'expired' }, 401));
  await old;
  logout.resolve(ok(null));
  await pendingLogout;
  assert.equal(session.getAccessToken(), 'new-a');
  assert.equal(h.env.sessionStorage.getItem('systempro.auth.refresh.session'), 'new-r');
});
test('old refresh finalizer cannot detach a newer in-flight refresh', async () => {
  const first = deferred(), second = deferred();
  let count = 0;
  const h = harness({ fetch: () => (++count === 1 ? first.promise : second.promise) });
  const session = h.load('src/core/auth/session.manager.ts').authSession;
  session.commit(tokens('old'), true);
  const a = rejectsCode(session.refresh(), 'SESSION_CHANGED');
  session.commit(tokens('new'), true);
  const b = session.refresh();
  first.resolve(ok(tokens('obsolete')));
  await a;
  const c = session.refresh();
  assert.equal(h.calls.length, 2);
  second.resolve(ok(tokens('fresh')));
  await b; await c;
});
test('transient refresh outage retains token for recovery; invalid token is cleared', async () => {
  const h = harness({ fetch: async () => response(new SyntaxError('HTML'), 503) });
  const session = h.load('src/core/auth/session.manager.ts').authSession;
  session.commit(tokens('old'), true);
  await rejectsCode(session.refresh(), 'SERVICE_UNAVAILABLE');
  assert.equal(session.getAccessToken(), 'old-a');
  assert.equal(session.hasRefreshToken(), true);
  h.env.fetch = async () => response({ code: 'UNAUTHORIZED', message: 'expired' }, 401);
  await rejectsCode(session.refresh(), 'UNAUTHORIZED');
  assert.equal(session.hasRefreshToken(), false);
});
test('persistent and temporary storage and standalone-window handoff stay compatible', async () => {
  const h = harness(), session = h.load('src/core/auth/session.manager.ts').authSession;
  session.commit(tokens('persistent'), true);
  const target = { sessionStorage: storage() };
  session.handoffToWindow(target);
  assert.equal(target.sessionStorage.getItem('systempro.auth.refresh.session'), null);
  session.commit(tokens('temporary'), false);
  session.handoffToWindow(target);
  assert.equal(target.sessionStorage.getItem('systempro.auth.refresh.session'), 'temporary-r');
  assert.equal(h.env.localStorage.getItem('systempro.auth.refresh.local'), null);
});

for (const blob of [false, true]) {
  test((blob ? 'export' : 'JSON request') + ': delayed 401 reuses refreshed token instead of refreshing twice', async () => {
    const delayed = deferred();
    const h = harness({ fetch: async (url, init) => {
      if (url.endsWith('/refresh')) return ok(tokens('fresh'));
      if (url === '/delayed' && init.headers.get('Authorization') === 'Bearer old-a') return delayed.promise;
      if (url === '/first' && init.headers.get('Authorization') === 'Bearer old-a') return response({ code: 'UNAUTHORIZED' }, 401);
      return blob ? response('file') : ok('data');
    } });
    const session = h.load('src/core/auth/session.manager.ts').authSession;
    session.commit(tokens('old'), true);
    const client = h.load('src/core/api/http-client.ts'), send = blob ? client.requestBlob : client.request;
    const a = send('/first'), b = send('/delayed');
    await a;
    delayed.resolve(response({ code: 'UNAUTHORIZED' }, 401));
    await b;
    assert.equal(h.calls.filter(([url]) => url.endsWith('/refresh')).length, 1);
    assert.equal(h.load('src/core/navigation/route-loading.ts').routeLoading.pending.value, false);
    assert.equal(h.timers.size, 0);
  });
  test((blob ? 'export' : 'JSON request') + ': previous-session response is discarded', async () => {
    const d = deferred(), h = harness({ fetch: () => d.promise });
    const session = h.load('src/core/auth/session.manager.ts').authSession;
    session.commit(tokens('old'), true);
    const client = h.load('src/core/api/http-client.ts');
    const checked = rejectsCode((blob ? client.requestBlob : client.request)('/query'), 'SESSION_CHANGED');
    await tick();
    session.commit(tokens('new'), true);
    d.resolve(blob ? response('private file') : ok('private data'));
    await checked;
    assert.equal(session.getAccessToken(), 'new-a');
    assert.equal(h.load('src/core/navigation/route-loading.ts').routeLoading.pending.value, false);
  });
}
test('export has a separate 120-second budget including blob reading', async () => {
  const h = harness({ fetch: async (url, init) => ({ ...ok(null), blob: () => abortable(init) }) });
  h.load('src/core/auth/session.manager.ts').authSession.commit(tokens('old'), true);
  const checked = rejectsCode(h.load('src/core/api/http-client.ts').requestBlob('/export'), 'REQUEST_TIMEOUT');
  await tick();
  h.advance(30000);
  assert.equal(h.calls[0][1].signal.aborted, false);
  h.advance(90000);
  await checked;
  assert.equal(h.load('src/core/navigation/route-loading.ts').routeLoading.pending.value, false);
  assert.equal(h.timers.size, 0);
});
test('export allows cancellation and per-call timeout override', async () => {
  const h = harness({ fetch: (url, init) => abortable(init) }), controller = new TestController();
  h.load('src/core/auth/session.manager.ts').authSession.commit(tokens('old'), true);
  const checked = rejectsCode(h.load('src/core/api/http-client.ts').requestBlob('/export', { signal: controller.signal }, { timeoutMs: 5 }), 'REQUEST_ABORTED');
  await tick(); controller.abort(); await checked;
  assert.equal(controller.signal.listeners.size, 0);
  assert.equal(h.timers.size, 0);
});
test('authenticated write returning 503 is not retried', async () => {
  const h = harness({ fetch: async () => response(new SyntaxError('HTML'), 503) });
  h.load('src/core/auth/session.manager.ts').authSession.commit(tokens('old'), true);
  await rejectsCode(h.load('src/core/api/http-client.ts').request('/save', { method: 'POST', body: '{}' }), 'SERVICE_UNAVAILABLE');
  assert.equal(h.calls.length, 1);
});

const pages = [
  ['src/pages/assets/MeterManagementPage.vue', 'loadWorkspace', 'meters'],
  ['src/pages/assets/WaterMeterManagementPage.vue', 'load', 'rows'],
  ['src/pages/metering/MeteringDataQualityPage.vue', 'load', 'result'],
  ['src/pages/metering/UsageAnalysisPage.vue', 'load', 'result'],
  ['src/pages/metering/EnterpriseMeteringOverviewPage.vue', 'load', 'overview'],
  ['src/pages/metering/LossAnalysisPage.vue', 'load', 'result'],
  ['src/pages/metering/EnergyAnalysisWorkspace.vue', 'load', 'result'],
];
function pageHarness(file, name, target) {
  const h = harness(), loading = { value: true }, errors = [], old = deferred(), next = deferred();
  const env = { loading, canView: { value: true }, canViewMetering: { value: true },
    page: { value: 1 }, pageSize: { value: 10 }, keyword: { value: '' },
    status: { value: '' }, communication: { value: '' }, communicationStatus: { value: '' },
    selectedSpaceId: { value: '' }, dates: { value: ['2026-01-01', '2026-01-02'] },
    meters: { value: [] }, rows: { value: [] }, statistics: {}, stats: {}, total: {},
    relations: {}, currentBills: {}, result: { value: { marker: 'retained' } }, overview: {}, balance: {}, adjustments: {},
    copy: { value: { loadFailed: 'failed' } }, query: 'old', queryCount: 0,
    t: (v) => v, queryRange: () => ['', ''], params: () => ({}), periodParams: () => ({}),
    authStore: { can: () => true }, usageBillingPermissions: { view: '' },
    showApiError: (e) => errors.push(e), showError: (e) => errors.push(e),
    ElMessage: { error: (e) => errors.push(e) }, errorMessage: (e) => e.message,
    ApiError: h.load('src/core/api/contracts.ts').ApiError,
    runLatest: h.load('src/core/api/useLatestRequest.ts').useLatestRequest(loading).run };
  const query = () => { h.env.queryCount += 1; return (h.env.query === 'old' ? old : next).promise; };
  const related = () => (h.env.query === 'old' ? old : next).promise;
  env.meterRepository = { page: query, statistics: related };
  env.waterMeterRepository = { page: query, statistics: related };
  env.energyRelationApi = { list: related }; env.usageBillingApi = { current: related };
  env.enterpriseMeteringApi = { quality: query, usage: query, overview: query, balance: related, boundaryAdjustments: related };
  env.lossAnalysisApi = { analyze: query };
  Object.assign(h.env, env);
  const script = fs.readFileSync(path.resolve(root, file), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const parsed = ts.createSourceFile(file + '.ts', script, ts.ScriptTarget.Latest, true);
  const declaration = parsed.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  assert.ok(declaration, file + ': loader function exists');
  const code = ts.transpileModule(declaration.getText(parsed) + '\n globalThis.loadPage = ' + name + ';', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInContext(code, h.context);
  return { ...h, old, next, loading, errors, data: () => h.env[target].value,
    setQuery: (value) => { h.env.query = value; }, run: (...args) => h.env.loadPage(...args) };
}
const pageData = (marker) => ({ marker, items: [marker], total: 1, rows: [marker] });
for (const [file, name, target] of pages) {
  test(path.basename(file) + ': late old success cannot overwrite latest query', async () => {
    const h = pageHarness(file, name, target), a = h.run();
    h.setQuery('next'); const b = h.run();
    h.next.resolve(pageData('next')); await b;
    h.old.resolve(pageData('old')); await a;
    assert.equal(Array.isArray(h.data()) ? h.data()[0] : h.data().marker, 'next');
    assert.equal(h.loading.value, false);
  });
  test(path.basename(file) + ': stale failure cannot show error or close current loading', async () => {
    const h = pageHarness(file, name, target), a = h.run();
    h.setQuery('next'); const b = h.run();
    h.old.reject(new Error('old failure')); await a;
    assert.equal(h.loading.value, true);
    assert.equal(h.errors.length, 0);
    h.next.resolve(pageData('next')); await b;
    assert.equal(h.loading.value, false);
  });
  test(path.basename(file) + ': current failure preserves previous successful data', async () => {
    const h = pageHarness(file, name, target);
    h.old.resolve(pageData('old')); await h.run();
    h.setQuery('next'); const b = h.run();
    h.next.reject(new Error('current failure')); await b;
    assert.equal(Array.isArray(h.data()) ? h.data()[0] : h.data().marker, 'old');
    assert.equal(h.errors.length, 1);
    assert.equal(h.loading.value, false);
  });
  test(path.basename(file) + ': unmounted page ignores outstanding response', async () => {
    const h = pageHarness(file, name, target), before = h.data(), a = h.run();
    h.unmount.forEach((fn) => fn());
    h.old.resolve(pageData('old')); await a;
    assert.equal(h.data(), before);
  });
}
for (const [file, name, target] of pages.slice(0, 3)) {
  test(path.basename(file) + ': resetting page uses one watcher-owned query', async () => {
    const h = pageHarness(file, name, target);
    let page = 2;
    h.env.page = { get value() { return page; }, set value(next) { page = next; Promise.resolve().then(() => h.run()); } };
    h.old.resolve(pageData('old'));
    await h.run(true); await tick();
    assert.equal(h.env.page.value, 1);
    assert.equal(h.env.queryCount, 1);
  });
}


function authStoreHarness(fetch) {
  let currentAccount = async () => ({ id: 1, clientId: 1, defaultTenantId: null });
  const h = harness({ fetch, modules: {
    pinia: { defineStore: (id, options) => {
      const state = options.state();
      for (const [key, action] of Object.entries(options.actions)) state[key] = action.bind(state);
      for (const [key, getter] of Object.entries(options.getters)) Object.defineProperty(state, key, { get: () => getter(state) });
      return () => state;
    } },
    './auth.api': { authApi: {
      currentAccount: () => currentAccount(),
      currentClient: async () => ({ id: 1 }),
      navigation: async () => ({ permissions: [], dataScopes: [], menus: [] }),
    } },
    '@/core/navigation/navigation.store': { useNavigationStore: () => ({ replaceFromGrant() {}, clear() {}, flatItems: [] }) },
    '@/core/navigation/route-tabs.store': { useRouteTabsStore: () => ({ activateScope() {}, retainAllowed() {}, clear() {}, releaseScope() {} }) },
    '@/core/settings/runtime-settings.store': { useRuntimeSettingsStore: () => ({ readonlyActionMode: 'PREVIEW' }) },
    '@/core/demo/demo-session': {},
  } });
  const store = h.load('src/core/auth/auth.store.ts').useAuthStore();
  return { ...h, store, session: h.load('src/core/auth/session.manager.ts').authSession,
    setAccountLoader: (fn) => { currentAccount = fn; } };
}
test('auth store clears UI immediately; late logout cannot reset a newer login', async () => {
  const d = deferred(), h = authStoreHarness(() => d.promise);
  await h.store.establishSession(tokens('old'), true);
  const pending = h.store.logout();
  assert.equal(h.store.status, 'anonymous');
  assert.equal(h.store.account, null);
  await h.store.establishSession(tokens('new'), false);
  d.resolve(ok(null)); await pending;
  assert.equal(h.store.status, 'authenticated');
  assert.equal(h.store.userContext.accountId, 'new');
});
test('old hydration failure cannot reset or erase a newer login', async () => {
  const old = deferred(), h = authStoreHarness();
  h.setAccountLoader(() => old.promise);
  const checked = assert.rejects(h.store.establishSession(tokens('old'), true));
  h.setAccountLoader(async () => ({ id: 2, clientId: 1 }));
  await h.store.establishSession(tokens('new'), true);
  old.reject(new Error('old hydrate failed')); await checked;
  assert.equal(h.store.status, 'authenticated');
  assert.equal(h.store.account.id, 2);
  assert.equal(h.session.getAccessToken(), 'new-a');
});
test('old hydration success cannot overwrite a newer account', async () => {
  const old = deferred(), h = authStoreHarness();
  h.setAccountLoader(() => old.promise);
  const pending = h.store.establishSession(tokens('old'), true);
  h.setAccountLoader(async () => ({ id: 2, clientId: 1 }));
  await h.store.establishSession(tokens('new'), true);
  old.resolve({ id: 1, clientId: 1 }); await pending;
  assert.equal(h.store.account.id, 2);
  assert.equal(h.store.userContext.accountId, 'new');
});
test('old restore completion cannot reset a newer login', async () => {
  const old = deferred(), h = authStoreHarness(() => old.promise);
  h.env.localStorage.setItem('systempro.auth.refresh.local', 'old-r');
  const pending = h.store.restoreSession();
  await h.store.establishSession(tokens('new'), true);
  old.resolve(ok(tokens('old'))); await pending;
  assert.equal(h.store.status, 'authenticated');
  assert.equal(h.session.getAccessToken(), 'new-a');
});
test('restore during temporary outage retains refresh token for next attempt', async () => {
  const h = authStoreHarness(async () => response(new SyntaxError('HTML'), 503));
  h.env.localStorage.setItem('systempro.auth.refresh.local', 'old-r');
  await h.store.restoreSession();
  assert.equal(h.store.status, 'anonymous');
  assert.equal(h.session.hasRefreshToken(), true);
});
test('restore with rejected refresh token clears account and token', async () => {
  const h = authStoreHarness(async () => response({ code: 'UNAUTHORIZED' }, 401));
  h.env.localStorage.setItem('systempro.auth.refresh.local', 'old-r');
  await h.store.restoreSession();
  assert.equal(h.store.status, 'anonymous');
  assert.equal(h.session.hasRefreshToken(), false);
});


test('restore with forbidden account hydration clears credentials', async () => {
  const h = authStoreHarness();
  h.session.commit(tokens('old'), true);
  const { ApiError } = h.load('src/core/api/contracts.ts');
  h.setAccountLoader(async () => { throw new ApiError('forbidden', 'FORBIDDEN', 403); });
  await h.store.restoreSession();
  assert.equal(h.store.status, 'anonymous');
  assert.equal(h.session.hasRefreshToken(), false);
  assert.equal(h.session.getAccessToken(), '');
});
test('restore hydration transport failure keeps credentials for recovery', async () => {
  const h = authStoreHarness();
  h.session.commit(tokens('old'), true);
  const { ApiError } = h.load('src/core/api/contracts.ts');
  h.setAccountLoader(async () => { throw new ApiError('unavailable', 'SERVICE_UNAVAILABLE', 503); });
  await h.store.restoreSession();
  assert.equal(h.store.status, 'anonymous');
  assert.equal(h.session.hasRefreshToken(), true);
});
test('two failed authentication attempts do not loop refresh endlessly', async () => {
  const h = harness({ fetch: async (url) => url.endsWith('/refresh') ? ok(tokens('fresh')) : response({ code: 'UNAUTHORIZED' }, 401) });
  h.load('src/core/auth/session.manager.ts').authSession.commit(tokens('old'), true);
  await rejectsCode(h.load('src/core/api/http-client.ts').request('/query'), 'UNAUTHORIZED');
  assert.equal(h.calls.filter(([url]) => url.endsWith('/refresh')).length, 1);
  assert.equal(h.calls.filter(([url]) => url === '/query').length, 2);
});
test('concurrent authenticated requests clean route loading only after all settle', async () => {
  const a = deferred(), b = deferred(), h = harness({ fetch: (url) => url === '/a' ? a.promise : b.promise });
  h.load('src/core/auth/session.manager.ts').authSession.commit(tokens('old'), true);
  const client = h.load('src/core/api/http-client.ts'), route = h.load('src/core/navigation/route-loading.ts').routeLoading;
  const first = client.request('/a'), second = client.request('/b');
  await tick(); a.resolve(ok('first')); await first;
  assert.equal(route.pending.value, true);
  b.resolve(ok('second')); await second;
  assert.equal(route.pending.value, false);
});
test('trackRouteLoading opt-out remains compatible', async () => {
  const d = deferred(), h = harness({ fetch: () => d.promise });
  h.load('src/core/auth/session.manager.ts').authSession.commit(tokens('old'), true);
  const client = h.load('src/core/api/http-client.ts'), route = h.load('src/core/navigation/route-loading.ts').routeLoading;
  const pending = client.request('/query', {}, { trackRouteLoading: false });
  await tick(); assert.equal(route.pending.value, false);
  d.resolve(ok(null)); await pending;
});

test('a cleared page cannot restore from a peer token written after logout', async () => {
  const h = harness(), session = h.load('src/core/auth/session.manager.ts').authSession;
  session.commit(tokens('old'), true);
  session.clear();
  // localStorage is shared between real browser tabs, unlike sessionStorage.
  h.env.localStorage.setItem('systempro.auth.refresh.local', 'peer-r');
  h.channels[0].listeners[0]({ data: { type: 'refresh-token', refreshToken: 'peer-r', persistent: true } });
  assert.equal(session.hasRefreshToken(), false);
  assert.equal(await session.ensureAccessToken(), '');
  assert.equal(h.calls.length, 0);
  session.commit(tokens('new'), false);
  assert.equal(session.hasRefreshToken(), true);
  assert.equal(await session.ensureAccessToken(), 'new-a');
});

test('login hydration resets the UI when its session has already been rejected', async () => {
  const h = authStoreHarness(), { ApiError } = h.load('src/core/api/contracts.ts');
  h.setAccountLoader(async () => {
    h.session.clear();
    throw new ApiError('expired', 'UNAUTHORIZED', 401);
  });
  await rejectsCode(h.store.establishSession(tokens('old'), true), 'UNAUTHORIZED');
  assert.equal(h.store.status, 'anonymous');
  assert.equal(h.store.userContext, null);
  assert.equal(h.session.hasRefreshToken(), false);
});

let failed = 0;
for (const [name, run] of tests) {
  let watchdog;
  try {
    await Promise.race([run(), new Promise((resolve, reject) => {
      watchdog = setTimeout(() => reject(new Error('Test did not settle within 5 seconds')), 5000);
    })]);
    console.log('PASS ' + name);
  }
  catch (error) { failed += 1; console.error('FAIL ' + name); console.error(error); }
  finally { clearTimeout(watchdog); }
}
console.log(`\nReliability checks: ${tests.length - failed}/${tests.length} passed.`);
if (failed) process.exitCode = 1;
