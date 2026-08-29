<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/core/auth/auth.store';
import AiChatPanel from './AiChatPanel.vue';
import idle from '@/assets/ai-assistant/mascot/idle.webp';
import blink from '@/assets/ai-assistant/mascot/idle_blink.webp';

const auth = useAuthStore();
const route = useRoute();
const open = ref(false);
const blinking = ref(false);
const panel = ref<HTMLElement>();
const trigger = ref<HTMLElement>();
const dragging = ref(false);
const triggerDragging = ref(false);
const panelPosition = ref<{ x: number; y: number }>();
const triggerPosition = ref<{ x: number; y: number }>();
let blinkTimer: number | undefined;
let dragFrame: number | undefined;
let triggerFrame: number | undefined;
let dragOffsetX = 0;
let dragOffsetY = 0;
let triggerOffsetX = 0;
let triggerOffsetY = 0;
let triggerStartX = 0;
let triggerStartY = 0;
let triggerWasDragged = false;
let suppressTriggerClickUntil = 0;
const visible = computed(() => auth.isAuthenticated && route.path !== '/ai/chat');
const panelStyle = computed(() => panelPosition.value ? {
  left: `${panelPosition.value.x}px`, top: `${panelPosition.value.y}px`, right: 'auto', bottom: 'auto', transform: 'none',
} : undefined);
const widgetStyle = computed(() => triggerPosition.value ? {
  left: `${triggerPosition.value.x}px`, top: `${triggerPosition.value.y}px`, right: 'auto', bottom: 'auto',
} : undefined);

function toggle() {
  if (performance.now() < suppressTriggerClickUntil) return;
  blinking.value = true;
  if (blinkTimer) window.clearTimeout(blinkTimer);
  blinkTimer = window.setTimeout(() => { blinking.value = false; open.value = !open.value; }, 180);
}
function clampTrigger(x: number, y: number) {
  const rect = trigger.value?.getBoundingClientRect();
  const width = rect?.width ?? 76; const height = rect?.height ?? 88; const gap = 10;
  return { x: Math.min(Math.max(gap, x), Math.max(gap, window.innerWidth - width - gap)), y: Math.min(Math.max(gap, y), Math.max(gap, window.innerHeight - height - gap)) };
}
function clamp(x: number, y: number) {
  const rect = panel.value?.getBoundingClientRect();
  const width = rect?.width ?? 440; const height = rect?.height ?? 650; const gap = 12;
  return { x: Math.min(Math.max(gap, x), Math.max(gap, window.innerWidth - width - gap)), y: Math.min(Math.max(gap, y), Math.max(gap, window.innerHeight - height - gap)) };
}
function movePanel(event: PointerEvent) {
  if (!dragging.value) return;
  if (dragFrame) window.cancelAnimationFrame(dragFrame);
  dragFrame = window.requestAnimationFrame(() => { panelPosition.value = clamp(event.clientX - dragOffsetX, event.clientY - dragOffsetY); });
}
function stopDragging() {
  if (!dragging.value) return;
  dragging.value = false;
  window.removeEventListener('pointermove', movePanel);
  window.removeEventListener('pointerup', stopDragging);
  window.removeEventListener('pointercancel', stopDragging);
}
function startDragging(event: PointerEvent) {
  if (window.innerWidth <= 560 || event.button !== 0 || !panel.value) return;
  const rect = panel.value.getBoundingClientRect();
  dragOffsetX = event.clientX - rect.left; dragOffsetY = event.clientY - rect.top;
  panelPosition.value = { x: rect.left, y: rect.top };
  dragging.value = true;
  window.addEventListener('pointermove', movePanel, { passive: true });
  window.addEventListener('pointerup', stopDragging, { once: true });
  window.addEventListener('pointercancel', stopDragging, { once: true });
  event.preventDefault();
}
function moveTrigger(event: PointerEvent) {
  if (!triggerDragging.value) return;
  if (Math.hypot(event.clientX - triggerStartX, event.clientY - triggerStartY) < 4 && !triggerWasDragged) return;
  triggerWasDragged = true;
  if (triggerFrame) window.cancelAnimationFrame(triggerFrame);
  triggerFrame = window.requestAnimationFrame(() => { triggerPosition.value = clampTrigger(event.clientX - triggerOffsetX, event.clientY - triggerOffsetY); });
}
function stopTriggerDragging() {
  if (!triggerDragging.value) return;
  if (triggerWasDragged) suppressTriggerClickUntil = performance.now() + 240;
  triggerWasDragged = false;
  triggerDragging.value = false;
  window.removeEventListener('pointermove', moveTrigger);
  window.removeEventListener('pointerup', stopTriggerDragging);
  window.removeEventListener('pointercancel', stopTriggerDragging);
}
function startTriggerDragging(event: PointerEvent) {
  if (window.innerWidth <= 560 || event.button !== 0 || !trigger.value) return;
  const rect = trigger.value.getBoundingClientRect();
  triggerOffsetX = event.clientX - rect.left; triggerOffsetY = event.clientY - rect.top;
  triggerStartX = event.clientX; triggerStartY = event.clientY;
  triggerWasDragged = false;
  triggerPosition.value = { x: rect.left, y: rect.top };
  triggerDragging.value = true;
  window.addEventListener('pointermove', moveTrigger, { passive: true });
  window.addEventListener('pointerup', stopTriggerDragging, { once: true });
  window.addEventListener('pointercancel', stopTriggerDragging, { once: true });
  trigger.value.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}
function keepWidgetInViewport() {
  if (triggerPosition.value) {
    triggerPosition.value = clampTrigger(triggerPosition.value.x, triggerPosition.value.y);
  }
  if (panelPosition.value) {
    panelPosition.value = clamp(panelPosition.value.x, panelPosition.value.y);
  }
}
watch(open, async (value) => { if (value) { panelPosition.value = undefined; await nextTick(); } else stopDragging(); });
onMounted(() => window.addEventListener('resize', keepWidgetInViewport));
onBeforeUnmount(() => {
  if (blinkTimer) window.clearTimeout(blinkTimer);
  if (dragFrame) window.cancelAnimationFrame(dragFrame);
  if (triggerFrame) window.cancelAnimationFrame(triggerFrame);
  window.removeEventListener('resize', keepWidgetInViewport);
  stopDragging();
  stopTriggerDragging();
});
</script>

<template>
  <div v-if="visible" class="ai-widget" :class="{ open, 'trigger-dragging': triggerDragging }" :style="widgetStyle">
    <Transition name="ai-panel">
      <div v-if="open" ref="panel" class="ai-widget__panel" :class="{ dragging }" :style="panelStyle"><AiChatPanel compact closable @drag-start="startDragging" @close="open = false" /></div>
    </Transition>
    <button ref="trigger" class="ai-widget__trigger" type="button" :aria-expanded="open" aria-label="打开 SystemPro AI 助手" @pointerdown="startTriggerDragging" @dragstart.prevent @click="toggle">
      <img :src="blinking ? blink : idle" alt="" draggable="false" /><span>AI 助手</span>
    </button>
  </div>
</template>

<style scoped>
.ai-widget { position:fixed; z-index:85; right:24px; bottom:20px; pointer-events:none; }
.ai-widget__trigger { position:relative; display:grid; grid-template-rows:64px 22px; width:76px; height:88px; justify-items:center; align-items:center; padding:0; pointer-events:auto; touch-action:none; user-select:none; background:transparent; border:0; cursor:grab; filter:drop-shadow(0 9px 14px rgba(21,51,116,.24)); transition:transform 160ms ease; }
.ai-widget__trigger:hover { transform:translateY(-3px); }.trigger-dragging .ai-widget__trigger{cursor:grabbing;transform:none}.ai-widget__trigger img { width:64px; height:64px; object-fit:contain; pointer-events:none; -webkit-user-drag:none; }.ai-widget__trigger span { display:block; min-width:58px; padding:3px 10px; color:#fff; text-align:center; pointer-events:none; background:linear-gradient(135deg,var(--color-primary-600),var(--color-primary-500)); border:1px solid color-mix(in srgb,#fff 24%,transparent); border-radius:999px; font-size:10px; line-height:16px; box-shadow:0 5px 14px rgba(33,91,224,.24); }
.ai-widget__panel { position:fixed; right:88px; bottom:64px; width:min(440px,calc(100vw - 32px)); height:min(650px,calc(100vh - 96px)); overflow:hidden; pointer-events:auto; background:var(--color-bg-surface); border:1px solid var(--color-border-default); border-radius:22px; box-shadow:0 24px 70px rgba(22,39,82,.24); will-change:left,top; }
.ai-widget__panel.dragging { user-select:none; box-shadow:0 30px 80px rgba(22,39,82,.31); }
.ai-panel-enter-active,.ai-panel-leave-active { transition:opacity 160ms ease; }.ai-panel-enter-from,.ai-panel-leave-to { opacity:0; }
@media (prefers-reduced-motion:reduce){.ai-widget__trigger,.ai-panel-enter-active,.ai-panel-leave-active{transition:none}}
@media (max-width:560px){.ai-widget{right:12px;bottom:12px}.ai-widget__panel{inset:8px!important;width:auto;height:auto;transform:none!important;border-radius:16px}.ai-widget.open .ai-widget__trigger{display:none}}
</style>
