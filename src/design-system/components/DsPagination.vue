<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  page: number;
  pageSize: number;
  total: number;
  pageSizes?: number[];
}>(), {
  pageSizes: () => [10, 20, 50, 100],
});

const effectivePageSizes = computed(() =>
  [...new Set([...props.pageSizes, props.pageSize])].sort((left, right) => left - right),
);

defineEmits<{
  'update:page': [value: number];
  'update:pageSize': [value: number];
}>();
</script>

<template>
  <div class="ds-pagination">
    <el-pagination
      :current-page="page"
      :page-size="pageSize"
      :page-sizes="effectivePageSizes"
      :total="total"
      background
      layout="total, sizes, prev, pager, next, jumper"
      @update:current-page="$emit('update:page', $event)"
      @update:page-size="$emit('update:pageSize', $event)"
    />
  </div>
</template>

<style scoped>
.ds-pagination {
  display: flex;
  min-height: var(--ds-pagination-item-size);
  align-items: center;
  justify-content: flex-end;
  color: var(--color-text-secondary);
  font-size: var(--ds-pagination-font);
}

.ds-pagination :deep(.el-pagination) {
  --el-pagination-bg-color: var(--color-bg-surface);
  --el-pagination-button-bg-color: var(--color-bg-surface);
  --el-pagination-button-color: var(--color-text-secondary);
  --el-pagination-button-disabled-bg-color: var(--color-bg-muted);
  --el-pagination-button-disabled-color: var(--color-text-disabled);
  --el-pagination-hover-color: var(--color-primary-500);
  --el-pagination-font-size: var(--ds-pagination-font);
  --el-pagination-button-width: var(--ds-pagination-item-size);
  --el-pagination-button-height: var(--ds-pagination-item-size);
  gap: 8px;
}

.ds-pagination :deep(.el-pagination__total),
.ds-pagination :deep(.el-pagination__goto),
.ds-pagination :deep(.el-pagination__classifier) {
  color: var(--color-text-secondary);
  font-size: var(--ds-pagination-font);
  line-height: var(--ds-pagination-item-size);
}

.ds-pagination :deep(.el-select .el-select__wrapper) {
  min-height: var(--ds-pagination-select-h);
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-border-default) 72%, transparent) inset;
}

.ds-pagination :deep(.el-select .el-select__placeholder),
.ds-pagination :deep(.el-select .el-select__selected-item) {
  font-size: var(--ds-pagination-font);
}

.ds-pagination :deep(.el-pagination__editor.el-input .el-input__wrapper) {
  min-height: var(--ds-pagination-select-h);
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-border-default) 72%, transparent) inset;
}

.ds-pagination :deep(.el-pagination__editor.el-input .el-input__inner) {
  font-size: var(--ds-pagination-font);
}

.ds-pagination :deep(.el-pager li),
.ds-pagination :deep(.btn-prev),
.ds-pagination :deep(.btn-next) {
  min-width: var(--ds-pagination-item-size);
  height: var(--ds-pagination-item-size);
  border-radius: var(--radius-sm);
}

.ds-pagination :deep(.el-pager li.is-active) {
  color: var(--color-white);
  background: var(--color-primary-500);
}

@media (max-width: 760px) {
  .ds-pagination {
    justify-content: flex-start;
  }

  .ds-pagination :deep(.el-pagination) {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
