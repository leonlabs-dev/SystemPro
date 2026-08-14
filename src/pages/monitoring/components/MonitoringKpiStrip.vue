<script setup lang="ts">
export interface MonitoringMetric { key: string; label: string; value: string | number; tone?: 'success' | 'warning' | 'danger' | 'primary' | 'muted'; note?: string }
defineProps<{ metrics: MonitoringMetric[] }>();
</script>
<template>
  <section class="monitor-kpis">
    <article v-for="metric in metrics" :key="metric.key">
      <span>{{ metric.label }}</span><strong :class="metric.tone ? `is-${metric.tone}` : ''">{{ metric.value }}</strong><small v-if="metric.note">{{ metric.note }}</small>
    </article>
  </section>
</template>
<style src="../monitoring-pages.css"></style>
