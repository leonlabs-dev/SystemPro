<script setup lang="ts">
defineProps<{
  primary?: string | number;
  secondary?: string | number;
}>();
</script>

<template>
  <span class="ds-primary-cell">
    <el-tooltip :content="String(primary ?? '—')" placement="top" :show-after="400">
      <strong class="ds-primary-cell__primary">{{ primary ?? '—' }}</strong>
    </el-tooltip>
    <el-tooltip v-if="secondary !== undefined && secondary !== ''" :content="String(secondary)" placement="top" :show-after="400">
      <small class="ds-primary-cell__secondary">{{ secondary }}</small>
    </el-tooltip>
  </span>
</template>

<style scoped>
.ds-primary-cell {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.ds-primary-cell__primary,
.ds-primary-cell__secondary {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-primary-cell__primary {
  color: var(--color-text-primary);
  font-size: var(--ds-datatable-font);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-body);
}

.ds-primary-cell__secondary {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-caption);
}
</style>
