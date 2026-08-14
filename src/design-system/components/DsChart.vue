<script setup lang="ts">
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { echarts, type ECharts, type EChartsCoreOption } from '@/design-system/charts/echarts-runtime';

const props = defineProps<{
  option: EChartsCoreOption;
}>();
const emit = defineEmits<{
  click: [params: unknown];
}>();

const chartRef = ref<HTMLDivElement | null>(null);
let chart: ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;
let resizeFrame = 0;
let pendingRender: number | null = null;

function containerReady() {
  const el = chartRef.value;
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function renderChart() {
  const el = chartRef.value;
  if (!el) return;
  if (!containerReady()) {
    // Container is hidden or zero-sized (e.g. keep-alive deactivated, parent
    // display:none). Skip until the next resize tick.
    if (pendingRender === null) {
      pendingRender = window.requestAnimationFrame(() => {
        pendingRender = null;
        if (containerReady()) renderChart();
      });
    }
    return;
  }
  if (!chart) {
    chart = echarts.init(el);
    chart.on('click', (params) => emit('click', params));
  } else {
    chart.resize();
  }
  chart.setOption(props.option, true);
}

function resizeChart() {
  if (pendingRender !== null) {
    window.cancelAnimationFrame(pendingRender);
    pendingRender = null;
  }
  resizeFrame = requestAnimationFrame(() => renderChart());
}

onMounted(() => {
  renderChart();
  window.addEventListener('resize', resizeChart);
  if (chartRef.value) {
    resizeObserver = new ResizeObserver(resizeChart);
    resizeObserver.observe(chartRef.value);
  }
  nextTick(resizeChart);
});

onActivated(() => {
  // keep-alive restores the DOM but the canvas may be detached/zero-sized;
  // force a fresh init + resize on the next tick.
  if (chart) {
    chart.dispose();
    chart = null;
  }
  nextTick(renderChart);
});

onDeactivated(() => {
  // Defer the dispose to the next tick so any pending resize doesn't
  // call drawImage on a detached canvas.
  nextTick(() => {
    chart?.dispose();
    chart = null;
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart);
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (pendingRender !== null) {
    window.cancelAnimationFrame(pendingRender);
    pendingRender = null;
  }
  cancelAnimationFrame(resizeFrame);
  chart?.dispose();
  chart = null;
});

watch(() => props.option, () => nextTick(renderChart), { deep: true, flush: 'post' });
</script>

<template>
  <div ref="chartRef" class="ds-chart" />
</template>

<style scoped>
.ds-chart {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
</style>
