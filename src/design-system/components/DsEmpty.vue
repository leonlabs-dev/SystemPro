<script setup lang="ts">
defineProps<{
  description: string;
  actionLabel?: string;
}>();

defineEmits<{
  retry: [];
}>();
</script>

<template>
  <div class="ds-empty">
    <el-empty :description="description">
      <el-button v-if="actionLabel" type="primary" @click="$emit('retry')">
        {{ actionLabel }}
      </el-button>
    </el-empty>
  </div>
</template>

<style scoped>
.ds-empty {
  display: grid;
  min-height: 160px;
  place-items: center;
}
</style>
