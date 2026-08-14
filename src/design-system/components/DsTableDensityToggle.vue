<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLayoutStore, type TableDensity } from '@/core/layout/layout.store';

const layoutStore = useLayoutStore();
const { t } = useI18n();

const density = computed<TableDensity>(() => layoutStore.tableDensity);

function setDensity(value: TableDensity) {
  layoutStore.setTableDensity(value);
}
</script>

<template>
  <div class="ds-list-density-toggle" :aria-label="t('common.tableDensity')">
    <button
      class="ds-list-density-toggle__btn"
      :class="{ 'is-active': density === 'comfortable' }"
      type="button"
      :title="t('common.comfortableSpacing')"
      @click="setDensity('comfortable')"
    >{{ t('common.comfortable') }}</button>
    <button
      class="ds-list-density-toggle__btn"
      :class="{ 'is-active': density === 'compact' }"
      type="button"
      :title="t('common.compactSpacing')"
      @click="setDensity('compact')"
    >{{ t('common.compact') }}</button>
  </div>
</template>
