<script lang="ts">
export interface DsTableColumn {
  prop: string;
  label: string;
  width?: number | string;
  minWidth?: number | string;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
  slot?: string;
  showOverflowTooltip?: boolean;
}
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { locale, t } = useI18n();

const props = defineProps<{
  rows: Record<string, unknown>[];
  columns?: DsTableColumn[];
  rowKey?: string;
  loading?: boolean;
  selectable?: boolean;
  actionWidth?: number | string;
  actionTitle?: string;
  actionFixed?: boolean;
  tableLayout?: 'fixed' | 'auto';
  height?: number | string;
  emptyText?: string;
}>();

const tableReady = ref(props.loading !== true);
let readyFrame = 0;
watch(() => props.loading, (loading) => {
  if (!loading) tableReady.value = true;
});
onMounted(() => {
  if (props.loading !== false) return;
  readyFrame = requestAnimationFrame(() => {
    if (!props.loading) tableReady.value = true;
  });
});
onBeforeUnmount(() => { if (readyFrame) cancelAnimationFrame(readyFrame); });

defineEmits<{
  selectionChange: [rows: Record<string, unknown>[]];
  rowDblclick: [row: Record<string, unknown>];
}>();
</script>

<template>
  <div class="ds-data-table" :class="{ 'is-refreshing': loading && tableReady }" :aria-busy="loading ? 'true' : 'false'">
    <div v-if="!tableReady" class="ds-data-table__skeleton" role="status" aria-label="正在加载">
      <el-skeleton-item variant="rect" />
      <el-skeleton-item v-for="index in 5" :key="index" variant="text" />
    </div>
    <el-table
      v-else
      :data="rows"
      :row-key="rowKey"
      :table-layout="tableLayout"
      :height="height"
      :empty-text="emptyText"
      size="default"
      @selection-change="$emit('selectionChange', $event)"
      @row-dblclick="$emit('rowDblclick', $event)"
    >
      <el-table-column
        v-if="selectable"
        type="selection"
        width="42"
        align="center"
        fixed="left"
      />
      <slot />
      <template v-for="column in columns" :key="`${column.prop}-${locale}`">
        <el-table-column
          v-if="column.slot"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :align="column.align || 'left'"
          :fixed="column.fixed"
        >
          <template #default="scope">
            <slot :name="column.slot" v-bind="scope">
              {{ scope.row[column.prop] }}
            </slot>
          </template>
        </el-table-column>
        <el-table-column
          v-else
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :align="column.align || 'left'"
          :fixed="column.fixed"
          :show-overflow-tooltip="column.showOverflowTooltip"
        >
          <template #default="scope">
            <span class="ds-data-table__text">{{ scope.row[column.prop] }}</span>
          </template>
        </el-table-column>
      </template>
      <el-table-column v-if="$slots.actions" :width="actionWidth || 190" align="left" :fixed="actionFixed === false ? undefined : 'right'">
        <template #header>
          <span class="ds-data-table__action-title">{{ actionTitle || t('common.operation') }}</span>
        </template>
        <template #default="scope">
          <slot name="actions" v-bind="scope" />
        </template>
      </el-table-column>
      <template v-if="$slots.empty" #empty>
        <slot name="empty" />
      </template>
    </el-table>
  </div>
</template>

<style scoped>
.ds-data-table {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
}

/* Fill the entire header row area — covers gaps between cells and at container edges */
.ds-data-table :deep(.el-table__header-wrapper),
.ds-data-table :deep(.el-table__fixed-header-wrapper) {
  background: var(--color-bg-muted);
}

.ds-data-table :deep(.el-table__header th),
.ds-data-table :deep(.el-table__fixed-right .el-table__header th) {
  height: var(--ds-datatable-header-h);
  padding: 0;
  background: var(--color-bg-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-semibold);
}

.ds-data-table :deep(.el-table__row td),
.ds-data-table :deep(.el-table__fixed-right .el-table__row td) {
  height: var(--ds-datatable-row-h);
  padding: 0;
  color: var(--color-text-primary);
  font-size: var(--ds-datatable-font);
}

/* Fixed-right gutter patch: fills gap between fixed header and scrollbar area */
.ds-data-table :deep(.el-table__fixed-right-patch) {
  background: var(--color-bg-muted);
}

.ds-data-table :deep(.cell) {
  display: flex;
  align-items: center;
  min-height: var(--ds-datatable-header-h);
  gap: var(--space-1);
  overflow: hidden;
  padding: 0 var(--ds-datatable-cell-px);
}

.ds-data-table :deep(.el-table__row .cell) {
  min-height: var(--ds-datatable-row-h);
}

/* Native text span: shrinkable with ellipsis in flex container */
.ds-data-table :deep(.ds-data-table__text) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-data-table :deep(.el-table__row:hover td),
.ds-data-table :deep(.el-table__fixed-right .el-table__row:hover td) {
  background: var(--color-bg-subtle);
}

.ds-data-table :deep(.el-table__empty-block) {
  min-height: 180px;
}

.ds-data-table__action-title {
  color: var(--color-text-secondary);
}
</style>

<style>
/* Table scrollbar follows theme primary color (EP 2.4 uses el-scrollbar, not native) */
.ds-data-table .el-scrollbar__thumb {
  background-color: var(--ds-scrollbar-thumb) !important;
}

.ds-data-table.is-refreshing::before {
  position: absolute;
  z-index: 6;
  top: 0;
  left: 0;
  width: 24%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-primary-500), transparent);
  content: '';
  animation: ds-table-refresh 1.05s ease-in-out infinite;
}

.ds-data-table__skeleton {
  display: grid;
  min-height: 250px;
  align-content: start;
  gap: 24px;
  padding: 0 16px 20px;
}

.ds-data-table__skeleton > .el-skeleton__item:first-child {
  width: calc(100% + 32px);
  height: var(--ds-datatable-header-h);
  margin: 0 -16px 2px;
  border-radius: 0;
}

.ds-data-table__skeleton > .el-skeleton__item:not(:first-child) { height: 18px; }

@keyframes ds-table-refresh {
  from { transform: translateX(-110%); }
  to { transform: translateX(520%); }
}

@media (prefers-reduced-motion: reduce) {
  .ds-data-table.is-refreshing::before { animation: none; }
}

.ds-data-table .el-scrollbar__thumb:hover {
  background-color: var(--ds-scrollbar-thumb-hover) !important;
}
</style>
