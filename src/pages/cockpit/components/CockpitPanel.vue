<script setup lang="ts">
defineProps<{ title: string; action?: string }>();
</script>

<template>
  <section class="cockpit-panel">
    <header class="cockpit-panel__header">
      <h2>{{ title }}</h2>
      <span v-if="action" class="cockpit-panel__action">{{ action }}</span>
    </header>
    <div class="cockpit-panel__body"><slot /></div>
  </section>
</template>

<style scoped>
.cockpit-panel {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  background: #061a35;
  border: 1px solid rgb(53 94 136 / 44%);
  border-radius: 3px;
  box-shadow: none;
}
.cockpit-panel__header {
  position: relative;
  display: flex;
  height: clamp(34px, 4vh, 46px);
  flex: 0 0 clamp(34px, 4vh, 46px);
  align-items: center;
  gap: 9px;
  padding: 0 clamp(12px, 1vw, 18px);
  background: #082342;
  border-bottom: 1px solid rgb(53 94 136 / 42%);
}
.cockpit-panel__header::before { width: 3px; height: 15px; background: #3f86d9; border-radius: 1px; content: ''; }
.cockpit-panel__header h2 { margin: 0; color: #dcecff; font-size: clamp(13px, .88vw, 17px); font-weight: 600; letter-spacing: .02em; }
.cockpit-panel__action { margin-left: auto; color: #7294bd; font-size: 12px; }
.cockpit-panel__body { width: 100%; min-height: 0; box-sizing: border-box; flex: 1; padding: clamp(10px, .78vw, 15px); overflow: hidden; }
@media (max-width: 1450px), (max-height: 800px) { .cockpit-panel__body { padding: 7px; } }
</style>
