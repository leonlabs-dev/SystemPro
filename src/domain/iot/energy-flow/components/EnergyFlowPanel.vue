<script setup lang="ts">
import type { RealtimeNode } from '@/domain/shared';

defineProps<{
  nodes: RealtimeNode[];
}>();
</script>

<template>
  <div class="energy-flow">
    <div class="energy-flow__center">EMS</div>
    <div
      v-for="node in nodes"
      :key="node.id"
      class="energy-flow__node"
      :class="[`is-${node.state}`, `node-${node.id}`]"
    >
      <span>{{ node.name }}</span>
      <strong>{{ node.value.toFixed(1) }}</strong>
      <em>{{ node.unit }}</em>
    </div>
  </div>
</template>

<style scoped>
.energy-flow {
  position: relative;
  min-height: 260px;
  background:
    linear-gradient(90deg, transparent 24px, var(--color-border-default) 25px, transparent 26px),
    linear-gradient(0deg, transparent 24px, var(--color-border-default) 25px, transparent 26px);
  background-size: 52px 52px;
  border-radius: var(--radius-lg);
}

.energy-flow__center,
.energy-flow__node {
  position: absolute;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-soft);
}

.energy-flow__center {
  top: 50%;
  left: 50%;
  width: 72px;
  height: 72px;
  transform: translate(-50%, -50%);
  border-radius: var(--radius-lg);
  color: var(--color-bg-surface);
  background: var(--color-primary-500);
  font-weight: 700;
}

.energy-flow__node {
  width: 118px;
  min-height: 74px;
  padding: var(--space-2);
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg);
}

.energy-flow__node::after {
  position: absolute;
  width: 68px;
  height: 1px;
  background: currentColor;
  content: "";
}

.energy-flow__node span,
.energy-flow__node em {
  color: var(--color-text-secondary);
  font-size: var(--font-caption);
  font-style: normal;
  line-height: var(--line-caption);
}

.energy-flow__node strong {
  color: var(--color-text-primary);
  font-size: var(--font-h3);
  line-height: var(--line-h3);
}

.energy-flow__node.is-online {
  color: var(--color-success-default);
}

.energy-flow__node.is-warning {
  color: var(--color-warning-default);
}

.energy-flow__node.is-offline {
  color: var(--color-error-default);
}

.node-pv {
  top: 24px;
  left: 24px;
}

.node-pv::after {
  top: 50%;
  left: 100%;
}

.node-storage {
  bottom: 24px;
  left: 24px;
}

.node-storage::after {
  top: 50%;
  left: 100%;
}

.node-grid {
  top: 24px;
  right: 24px;
}

.node-grid::after {
  top: 50%;
  right: 100%;
}

.node-charge {
  right: 24px;
  bottom: 24px;
}

.node-charge::after {
  top: 50%;
  right: 100%;
}
</style>
