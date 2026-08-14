import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { registerActiveLocaleDataRefresher } from './locale-runtime';

/**
 * Registers a page data reload only while that KeepAlive page is active.
 * Locale switching keeps its route shield visible until every active reload
 * completes, so static UI and API-resolved business names become visible as
 * one coherent language state.
 */
export function useActiveLocaleDataRefresh(refresh: () => void | Promise<void>) {
  const { locale } = useI18n();
  let unregister: (() => void) | undefined;
  let refreshedLocale = locale.value;

  const runRefresh = async () => {
    const targetLocale = locale.value;
    await refresh();
    if (locale.value === targetLocale) refreshedLocale = targetLocale;
  };

  const activate = () => {
    if (!unregister) unregister = registerActiveLocaleDataRefresher(runRefresh);
    if (refreshedLocale !== locale.value) {
      void runRefresh().catch((error) => console.warn('Unable to refresh activated localized page', error));
    }
  };
  const deactivate = () => {
    unregister?.();
    unregister = undefined;
  };

  onMounted(activate);
  onActivated(activate);
  onDeactivated(deactivate);
  onBeforeUnmount(deactivate);
}
