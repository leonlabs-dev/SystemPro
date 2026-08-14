import { computed, onBeforeUnmount, ref, type Ref } from 'vue';
import { appConfig } from '@/core/config/app.config';

export type FreshnessState = 'fresh' | 'stale-warning' | 'stale-error';

export interface FreshnessResult {
  state: Ref<FreshnessState>;
  elapsedSeconds: Ref<number>;
  isStale: Ref<boolean>;
}

export function useDataFreshness(lastUpdatedAt: Ref<number>): FreshnessResult {
  const now = ref(Date.now());
  const timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1_000);

  onBeforeUnmount(() => {
    window.clearInterval(timer);
  });

  const elapsedMs = computed(() => Math.max(0, now.value - lastUpdatedAt.value));
  const elapsedSeconds = computed(() => Math.floor(elapsedMs.value / 1000));
  const state = computed<FreshnessState>(() => {
    if (elapsedMs.value <= appConfig.dataFreshness.freshMs) return 'fresh';
    if (elapsedMs.value <= appConfig.dataFreshness.staleWarningMs) return 'stale-warning';
    return 'stale-error';
  });
  const isStale = computed(() => state.value !== 'fresh');

  return {
    state,
    elapsedSeconds,
    isStale,
  };
}
