<script setup lang="ts">
export interface DsQuickFilterOption {
  label: string;
  value: string;
  count?: number;
}

defineProps<{
  modelValue: string;
  options: DsQuickFilterOption[];
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <div class="ds-quick-filter" role="list">
    <button
      v-for="option in options"
      :key="option.value"
      class="ds-quick-filter__item"
      :class="{ 'is-active': modelValue === option.value }"
      type="button"
      role="listitem"
      @click="$emit('update:modelValue', option.value)"
    >
      <span>{{ option.label }}</span>
      <strong v-if="typeof option.count === 'number'">{{ option.count }}</strong>
    </button>
  </div>
</template>

<style scoped>
.ds-quick-filter {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.ds-quick-filter__item {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-3);
  color: var(--color-text-secondary);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-body);
  line-height: 32px;
}

.ds-quick-filter__item:hover {
  color: var(--color-primary-500);
  border-color: color-mix(in srgb, var(--color-primary-500) 40%, var(--color-border-default));
}

.ds-quick-filter__item.is-active {
  color: var(--color-primary-500);
  background: color-mix(in srgb, var(--color-primary-500) 9%, var(--color-bg-surface));
  border-color: var(--color-primary-500);
}

.ds-quick-filter__item strong {
  color: inherit;
  font-size: var(--font-caption);
  font-weight: 600;
}
</style>
