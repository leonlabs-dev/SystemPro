import type { Router } from 'vue-router';
import { authSession } from '@/core/auth/session.manager';
import { getFirstNavigationPath, type NavigationItem } from './menu';

/**
 * Performs a navigation item action while keeping standalone applications out
 * of the admin shell's route state. It must be called synchronously from the
 * click handler so browsers do not treat the new window as a popup.
 */
export function openNavigationItem(item: NavigationItem, router: Router) {
  const path = getFirstNavigationPath(item);
  if (item.openMode === 'new-window') {
    const targetUrl = router.resolve(path).href;
    const standaloneWindow = window.open('about:blank', '_blank');
    if (!standaloneWindow) return;

    // Complete the same-origin session handoff before severing the opener. This
    // preserves an ordinary (non-remembered) login without leaking credentials
    // through the URL or keeping the admin window accessible to the cockpit.
    authSession.handoffToWindow(standaloneWindow);
    standaloneWindow.opener = null;
    standaloneWindow.location.replace(targetUrl);
    return;
  }
  void router.push(path);
}
