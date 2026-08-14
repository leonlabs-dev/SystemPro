<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useLayoutStore } from '@/core/layout/layout.store';

const props = defineProps<{
  title: string;
  pageClass?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
}>();

const layoutStore = useLayoutStore();
const isCompact = computed(() => layoutStore.tableDensity === 'compact');
const contentReady = ref(props.loading !== true);
let readyFrame = 0;

watch(() => props.loading, (loading) => {
  if (!loading) contentReady.value = true;
});

onMounted(() => {
  if (props.loading !== false) return;
  readyFrame = requestAnimationFrame(() => {
    if (!props.loading) contentReady.value = true;
  });
});

onBeforeUnmount(() => { if (readyFrame) cancelAnimationFrame(readyFrame); });
</script>

<template>
  <section
    class="ds-list-page"
    :class="[pageClass, { 'is-compact': isCompact, 'is-refreshing': loading && contentReady }]"
    :aria-busy="loading ? 'true' : 'false'"
  >
    <section class="ds-list-page-card">
      <header class="ds-list-page__header">
        <h1>{{ title }}</h1>
        <p v-if="subtitle" class="ds-list-page__subtitle">{{ subtitle }}</p>
        <slot name="header-extra" />
        <slot name="primary-action" />
      </header>

      <div class="ds-list-page__divider" />

      <el-alert
        v-if="error"
        class="ds-list-page__alert"
        type="error"
        :title="error"
        :closable="false"
        show-icon
      />

      <div v-if="!contentReady" class="ds-list-page__skeleton" role="status" aria-label="正在加载">
        <div class="ds-list-page__skeleton-kpis">
          <el-skeleton-item v-for="index in 5" :key="index" variant="rect" />
        </div>
        <div class="ds-list-page__skeleton-toolbar">
          <el-skeleton-item variant="rect" />
          <el-skeleton-item variant="rect" />
          <el-skeleton-item variant="rect" />
        </div>
        <div class="ds-list-page__skeleton-table">
          <el-skeleton-item variant="rect" />
          <el-skeleton-item v-for="index in 6" :key="index" variant="text" />
        </div>
      </div>
      <slot v-else />
    </section>

    <slot name="overlays" />
  </section>
</template>

<style scoped>
.ds-list-page-card {
  position: relative;
}

.ds-list-page.is-refreshing .ds-list-page-card::before {
  position: absolute;
  z-index: 8;
  top: 0;
  left: 0;
  width: 28%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-primary-500), transparent);
  content: '';
  animation: ds-page-refresh 1.05s ease-in-out infinite;
}

.ds-list-page__skeleton {
  display: grid;
  min-height: 460px;
  gap: 16px;
  padding: 14px 20px 20px;
}

.ds-list-page__skeleton-kpis {
  display: grid;
  height: 64px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  background: var(--color-border-default);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
}

.ds-list-page__skeleton-kpis .el-skeleton__item {
  height: 100%;
  border-radius: 0;
}

.ds-list-page__skeleton-toolbar {
  display: grid;
  height: 36px;
  grid-template-columns: minmax(220px, 1.6fr) minmax(140px, .7fr) 96px;
  gap: 10px;
}

.ds-list-page__skeleton-toolbar .el-skeleton__item,
.ds-list-page__skeleton-table > .el-skeleton__item:first-child {
  height: 100%;
  border-radius: var(--radius-sm);
}

.ds-list-page__skeleton-table {
  display: grid;
  align-content: start;
  gap: 20px;
  padding: 0 16px 20px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
}

.ds-list-page__skeleton-table > .el-skeleton__item:first-child {
  height: 42px;
  margin: 0 -16px 2px;
  width: calc(100% + 32px);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.ds-list-page__skeleton-table > .el-skeleton__item:not(:first-child) {
  height: 18px;
}

@keyframes ds-page-refresh {
  from { transform: translateX(-110%); }
  to { transform: translateX(460%); }
}

@media (prefers-reduced-motion: reduce) {
  .ds-list-page.is-refreshing .ds-list-page-card::before { animation: none; }
}
</style>
