import type { Directive } from 'vue';
import { useAuthStore } from '@/core/auth/auth.store';
import { useRuntimeSettingsStore } from '@/core/settings/runtime-settings.store';

type DisableableElement = HTMLElement & { disabled: boolean };

interface PermissionState {
  permissionCodes: string[];
  denied: boolean;
  hidden: boolean;
  preview: boolean;
  previewEntry: boolean;
  restoreDisabled: boolean;
  originalDisplay: string;
  originalTitle: string | null;
  originalAriaDisabled: string | null;
  stopEvent: (event: Event) => void;
  refreshEvent: () => void;
  unsubscribe?: () => void;
  unsubscribeRuntime?: () => void;
}

const permissionStates = new WeakMap<HTMLElement, PermissionState>();

function isDisableable(el: HTMLElement): el is DisableableElement {
  return 'disabled' in el;
}

function releasePermissionOverride(el: HTMLElement, state: PermissionState) {
  if (state.denied) {
    if (isDisableable(el)) el.disabled = state.restoreDisabled;
    else if (state.restoreDisabled) el.setAttribute('disabled', '');
    else el.removeAttribute('disabled');
  }
  if (state.hidden) el.style.display = state.originalDisplay;
  el.classList.remove('is-permission-disabled');
  el.classList.remove('is-permission-preview');
  el.removeAttribute('data-permission-disabled');
  el.removeAttribute('data-permission-preview');
  if (state.originalAriaDisabled === null) el.removeAttribute('aria-disabled');
  else el.setAttribute('aria-disabled', state.originalAriaDisabled);
  if (state.originalTitle === null) el.removeAttribute('title');
  else el.setAttribute('title', state.originalTitle);
  state.denied = false;
  state.hidden = false;
  state.preview = false;
}

function applyPermission(el: HTMLElement, state: PermissionState) {
  const allowed = state.permissionCodes.length > 0 && useAuthStore().canAll(state.permissionCodes);
  if (allowed) {
    releasePermissionOverride(el, state);
    return;
  }

  const mode = useRuntimeSettingsStore().readonlyActionMode;
  releasePermissionOverride(el, state);

  if (mode === 'HIDDEN') {
    state.originalDisplay = el.style.display;
    state.hidden = true;
    el.style.display = 'none';
    return;
  }

  if (mode === 'PREVIEW' && state.previewEntry) {
    state.preview = true;
    el.classList.add('is-permission-preview');
    el.setAttribute('data-permission-preview', 'true');
    el.setAttribute('title', '体验模式：可操作至最终提交步骤');
    return;
  }

  state.restoreDisabled = isDisableable(el) ? el.disabled : el.hasAttribute('disabled');
  state.denied = true;
  if (isDisableable(el)) el.disabled = true;
  else el.setAttribute('disabled', '');
  el.classList.add('is-permission-disabled');
  el.setAttribute('data-permission-disabled', 'true');
  el.setAttribute('aria-disabled', 'true');
  el.setAttribute('title', '无操作权限');
}

function normalizePermissions(value: string | string[]) {
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

export const permissionDirective: Directive<HTMLElement, string | string[]> = {
  mounted(el, binding) {
    const state: PermissionState = {
      permissionCodes: normalizePermissions(binding.value),
      denied: false,
      hidden: false,
      preview: false,
      previewEntry: Boolean(binding.modifiers.preview),
      restoreDisabled: false,
      originalDisplay: el.style.display,
      originalTitle: el.getAttribute('title'),
      originalAriaDisabled: el.getAttribute('aria-disabled'),
      stopEvent(event) {
        if (!state.denied && !state.hidden) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      refreshEvent() {
        applyPermission(el, state);
      },
    };
    permissionStates.set(el, state);
    el.addEventListener('click', state.stopEvent, true);
    el.addEventListener('keydown', state.stopEvent, true);
    window.addEventListener('systempro:authorization-updated', state.refreshEvent);
    state.unsubscribe = useAuthStore().$subscribe(() => applyPermission(el, state), { detached: true });
    state.unsubscribeRuntime = useRuntimeSettingsStore().$subscribe(() => applyPermission(el, state), { detached: true });
    applyPermission(el, state);
  },
  beforeUpdate(el) {
    const state = permissionStates.get(el);
    if (state) releasePermissionOverride(el, state);
  },
  updated(el, binding) {
    const state = permissionStates.get(el);
    if (!state) return;
    state.permissionCodes = normalizePermissions(binding.value);
    state.previewEntry = Boolean(binding.modifiers.preview);
    applyPermission(el, state);
  },
  unmounted(el) {
    const state = permissionStates.get(el);
    if (!state) return;
    releasePermissionOverride(el, state);
    el.removeEventListener('click', state.stopEvent, true);
    el.removeEventListener('keydown', state.stopEvent, true);
    window.removeEventListener('systempro:authorization-updated', state.refreshEvent);
    state.unsubscribe?.();
    state.unsubscribeRuntime?.();
    permissionStates.delete(el);
  },
};
