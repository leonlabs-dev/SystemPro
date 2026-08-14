<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info';
  size?: 'small' | 'default';
  dot?: boolean;
}>(), {
  type: 'neutral',
  size: 'default',
  dot: false,
});
</script>

<template>
  <span class="ds-tag" :class="[`is-${type}`, `is-${size}`, { 'has-dot': dot }]">
    <i v-if="dot" class="ds-tag__dot" />
    <span class="ds-tag__content"><slot /></span>
  </span>
</template>

<style scoped>
.ds-tag {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: var(--space-1);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.ds-tag.is-default {
  min-height: var(--ds-tag-default-min-h);
  padding: 1px var(--ds-tag-default-px);
  font-size: var(--font-caption);
  line-height: 18px;
}

.ds-tag.is-small {
  min-height: var(--ds-tag-small-min-h);
  padding: 0 var(--ds-tag-small-px);
  font-size: var(--font-caption);
  line-height: 18px;
}

.ds-tag__dot {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: currentColor;
}

.ds-tag__content {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-tag.is-neutral {
  color: var(--color-text-secondary);
  background: var(--color-bg-muted);
  border-color: var(--color-border-default);
}

.ds-tag.is-primary,
.ds-tag.is-info {
  color: var(--color-primary-500);
  background: color-mix(in srgb, var(--color-primary-500) 10%, var(--color-bg-surface));
  border-color: color-mix(in srgb, var(--color-primary-500) 20%, var(--color-border-default));
}

.ds-tag.is-accent {
  color: #7c3aed;
  background: color-mix(in srgb, #7c3aed 10%, var(--color-bg-surface));
  border-color: color-mix(in srgb, #7c3aed 22%, var(--color-border-default));
}

.ds-tag.is-success {
  color: var(--color-success-default);
  background: var(--color-success-bg);
  border-color: color-mix(in srgb, var(--color-success-default) 18%, transparent);
}

.ds-tag.is-warning {
  color: var(--color-warning-default);
  background: var(--color-warning-bg);
  border-color: color-mix(in srgb, var(--color-warning-default) 22%, transparent);
}

.ds-tag.is-error {
  color: var(--color-error-default);
  background: var(--color-error-bg);
  border-color: color-mix(in srgb, var(--color-error-default) 18%, transparent);
}
</style>
