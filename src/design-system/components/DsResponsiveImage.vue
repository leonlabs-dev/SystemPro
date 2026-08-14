<script setup lang="ts">
import { Picture } from '@element-plus/icons-vue';
import { watch, ref } from 'vue';

const props = withDefaults(defineProps<{
  src: string;
  alt: string;
  srcset?: string;
  sizes?: string;
  loading?: 'eager' | 'lazy';
  fetchpriority?: 'high' | 'low' | 'auto';
  fallbackText?: string;
}>(), {
  srcset: undefined,
  sizes: undefined,
  loading: 'lazy',
  fetchpriority: 'auto',
  fallbackText: '图片暂时无法加载',
});

const emit = defineEmits<{ load: []; error: [] }>();
const failed = ref(false);

watch(() => props.src, () => { failed.value = false; });

function handleError() {
  failed.value = true;
  emit('error');
}
</script>

<template>
  <img
    v-if="!failed"
    class="ds-responsive-image"
    :src="src"
    :alt="alt"
    :srcset="srcset"
    :sizes="sizes"
    :loading="loading"
    decoding="async"
    :fetchpriority="fetchpriority"
    @load="emit('load')"
    @error="handleError"
  />
  <div v-else class="ds-responsive-image ds-responsive-image--fallback" role="img" :aria-label="`${alt}：${fallbackText}`">
    <el-icon aria-hidden="true"><Picture /></el-icon>
    <span>{{ fallbackText }}</span>
  </div>
</template>

<style scoped>
.ds-responsive-image--fallback { display: flex; box-sizing: border-box; align-items: center; justify-content: center; flex-direction: column; gap: 8px; color: var(--el-text-color-secondary); background: var(--el-fill-color-light); }
.ds-responsive-image--fallback .el-icon { font-size: 28px; }
.ds-responsive-image--fallback span { font-size: 12px; }
</style>
