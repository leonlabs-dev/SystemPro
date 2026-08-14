<script setup lang="ts">
defineProps<{
  title?: string;
  compact?: boolean;
}>();
</script>

<template>
  <section class="ds-panel" :class="{ 'is-compact': compact }">
    <header v-if="title || $slots.actions" class="ds-panel__header">
      <h2 v-if="title" class="ds-panel__title">{{ title }}</h2>
      <div v-if="$slots.actions" class="ds-panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="ds-panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.ds-panel {
  min-width: 0;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
}

.ds-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--row-default);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-border-default);
}

.ds-panel__title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-h3);
  font-weight: 600;
  line-height: var(--line-h3);
}

.ds-panel__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.ds-panel__body {
  padding: var(--space-4);
}

.ds-panel.is-compact .ds-panel__body {
  padding: var(--space-3);
}
</style>
