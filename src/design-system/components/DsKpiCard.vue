<script setup lang="ts">
import { computed } from 'vue';
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import DsStatusTag from './DsStatusTag.vue';
import type { DataState } from '@/design-system/types/state';
import { useDataFreshness } from '@/core/freshness/useDataFreshness';

const props = defineProps<{
  label: string;
  value: string;
  unit?: string;
  trend: number;
  state?: DataState;
  lastUpdatedAt?: number;
}>();

const { t } = useI18n();
const lastUpdatedAt = computed(() => props.lastUpdatedAt || Date.now());
const freshness = useDataFreshness(lastUpdatedAt);
const trendClass = computed(() => (props.trend >= 0 ? 'is-up' : 'is-down'));
const displayState = computed<DataState>(() => (freshness.isStale.value ? 'stale' : props.state || 'success'));
</script>

<template>
  <article class="ds-kpi-card" :class="[`state-${displayState}`]">
    <div class="ds-kpi-card__top">
      <span class="ds-kpi-card__label">{{ label }}</span>
      <DsStatusTag :state="displayState" />
    </div>
    <div class="ds-kpi-card__value">
      <strong>{{ value }}</strong>
      <span v-if="unit">{{ unit }}</span>
    </div>
    <div class="ds-kpi-card__trend" :class="trendClass">
      <el-icon>
        <ArrowUp v-if="trend >= 0" />
        <ArrowDown v-else />
      </el-icon>
      <span>{{ Math.abs(trend).toFixed(1) }}%</span>
    </div>
    <small v-if="freshness.isStale.value" class="ds-kpi-card__freshness">
      {{ t('home.lastUpdate', { seconds: freshness.elapsedSeconds.value }) }}
    </small>
  </article>
</template>

<style scoped>
.ds-kpi-card {
  display: flex;
  min-width: 0;
  min-height: 118px;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
}

.ds-kpi-card__top,
.ds-kpi-card__trend {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.ds-kpi-card__label {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-kpi-card__value {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  color: var(--color-text-primary);
}

.ds-kpi-card__value strong {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.ds-kpi-card__value span {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
}

.ds-kpi-card__trend {
  justify-content: flex-start;
  color: var(--color-success-default);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}

.ds-kpi-card__trend.is-down {
  color: var(--color-error-default);
}

.state-stale {
  filter: grayscale(0.2);
}

.ds-kpi-card__freshness {
  color: var(--color-text-disabled);
  font-size: var(--font-caption);
  line-height: var(--line-caption);
}
</style>
