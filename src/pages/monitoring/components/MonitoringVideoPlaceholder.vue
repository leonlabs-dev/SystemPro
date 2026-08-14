<script setup lang="ts">
import { VideoCamera } from '@element-plus/icons-vue';
defineProps<{ title: string; description: string; state?: 'empty' | 'unconfigured' | 'failed' }>();
</script>
<template>
  <div class="video-placeholder" :class="`is-${state || 'empty'}`">
    <div class="video-placeholder__stage" aria-hidden="true">
      <span class="video-placeholder__grid" /><span class="video-placeholder__focus" />
      <span class="video-placeholder__camera"><el-icon><VideoCamera /></el-icon></span>
      <i class="video-placeholder__line is-one" /><i class="video-placeholder__line is-two" />
    </div>
    <strong>{{ title }}</strong><p>{{ description }}</p>
  </div>
</template>
