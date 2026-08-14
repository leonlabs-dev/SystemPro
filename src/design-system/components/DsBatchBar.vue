<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
withDefaults(defineProps<{
  selectedCount: number;
}>(), {
  selectedCount: 0,
});
</script>

<template>
  <div class="ds-batch-bar" :class="{ 'is-empty': selectedCount === 0 }">
    <span>{{ t('common.selectedItems', { count: selectedCount }) }}</span>
    <div class="ds-batch-bar__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ds-batch-bar {
  display: flex;
  min-height: var(--ds-batchbar-min-h);
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--ds-batchbar-font);
}

.ds-batch-bar__actions {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: var(--space-2);
}

.ds-batch-bar.is-empty .ds-batch-bar__actions {
  opacity: 0.72;
}

@media (max-width: 760px) {
  .ds-batch-bar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
