<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DataState } from '@/design-system/types/state';

const props = defineProps<{
  state: DataState;
}>();

const { t } = useI18n();

const label = computed(() => {
  const map: Record<DataState, string> = {
    loading: 'status.loading',
    empty: 'status.empty',
    error: 'status.error',
    success: 'status.success',
    stale: 'status.stale',
  };

  return t(map[props.state]);
});
</script>

<template>
  <span class="ds-status-tag" :class="`is-${state}`">
    <i class="ds-status-tag__dot" />
    {{ label }}
  </span>
</template>

<style scoped>
.ds-status-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  max-width: 100%;
  padding: 1px var(--space-2);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
  white-space: nowrap;
}

.ds-status-tag__dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: currentColor;
}

.ds-status-tag.is-success {
  color: var(--color-success-default);
  background: var(--color-success-bg);
}

.ds-status-tag.is-error {
  color: var(--color-error-default);
  background: var(--color-error-bg);
}

.ds-status-tag.is-stale,
.ds-status-tag.is-empty {
  color: var(--color-text-disabled);
  background: var(--color-border-default);
}

.ds-status-tag.is-loading {
  color: var(--color-info-default);
  background: var(--color-info-bg);
}
</style>
