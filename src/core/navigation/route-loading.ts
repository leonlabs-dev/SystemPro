import { readonly, ref } from 'vue';

const active = ref(false);
const pending = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let routePending = false;
let requestCount = 0;

function updateVisibility() {
  const hasPendingWork = routePending || requestCount > 0;
  pending.value = hasPendingWork;
  clearTimeout(timer);
  if (!hasPendingWork) {
    active.value = false;
    return;
  }
  if (!active.value) {
    timer = setTimeout(() => { active.value = true; }, 100);
  }
}

export const routeLoading = {
  active: readonly(active),
  pending: readonly(pending),
  start() {
    routePending = true;
    updateVisibility();
  },
  finish() {
    routePending = false;
    updateVisibility();
  },
  beginRequest() {
    requestCount += 1;
    updateVisibility();
  },
  endRequest() {
    requestCount = Math.max(0, requestCount - 1);
    updateVisibility();
  },
};
