<script setup lang="ts">
defineProps<{ title: string; compact?: boolean }>();
</script>

<template>
  <section class="operations-panel" :class="{ 'is-compact': compact }">
    <header class="operations-panel__header">
      <i />
      <h2>{{ title }}</h2>
      <slot name="header" />
    </header>
    <div class="operations-panel__body"><slot /></div>
  </section>
</template>

<style scoped>
.operations-panel { min-width:0; min-height:0; display:flex; flex-direction:column; overflow:hidden; border:1px solid #e0e6ee; border-radius:7px; background:#fff; box-shadow:0 3px 10px rgba(35,55,80,.035); }
.operations-panel__header { height:39px; flex:0 0 39px; display:flex; align-items:center; gap:9px; padding:0 14px; border-bottom:1px solid #edf1f5; }
.operations-panel__header i { width:3px; height:14px; border-radius:2px; background:#376fbf; }
.operations-panel__header h2 { margin:0; color:#263950; font-size:14px; line-height:1; font-weight:700; letter-spacing:.01em; }
.operations-panel__body { min-width:0; min-height:0; flex:1; position:relative; overflow:hidden; }
.is-compact .operations-panel__header { height:37px; flex-basis:37px; }
@media (max-width:1380px), (max-height:780px), (max-width:1600px) and (max-height:850px) {
  .operations-panel__header { height:34px; flex-basis:34px; padding:0 11px; }
  .operations-panel__header h2 { font-size:14px; }
  .operations-panel__header i { height:16px; }
  .is-compact .operations-panel__header { height:33px; flex-basis:33px; }
}
</style>
