<script setup lang="ts">
import {Connection,DataAnalysis,List} from '@element-plus/icons-vue';
import {computed} from 'vue';

interface ViewOption {value:string;label:string;description?:string;icon?:'flow'|'analysis'|'list'}

const props=defineProps<{modelValue:string;options:ViewOption[]}>();
const emit=defineEmits<{ 'update:modelValue':[value:string] }>();
const iconMap={flow:Connection,analysis:DataAnalysis,list:List};
const selectedLabel=computed(()=>props.options.find(item=>item.value===props.modelValue)?.label||'');
</script>

<template>
  <div class="enterprise-view-switch" role="tablist" :aria-label="`当前视图：${selectedLabel}`">
    <button
      v-for="item in options"
      :key="item.value"
      type="button"
      role="tab"
      :aria-selected="modelValue===item.value"
      :class="{'is-active':modelValue===item.value}"
      @click="emit('update:modelValue',item.value)"
    >
      <el-icon v-if="item.icon"><component :is="iconMap[item.icon]"/></el-icon>
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.enterprise-view-switch{display:inline-flex;max-width:100%;padding:3px;border:1px solid var(--color-border-default);border-radius:10px;background:var(--color-bg-muted)}
.enterprise-view-switch button{display:inline-flex;min-width:0;align-items:center;justify-content:center;gap:6px;padding:7px 13px;border:0;border-radius:7px;background:transparent;color:var(--color-text-secondary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;transition:background-color .16s,color .16s,box-shadow .16s}
.enterprise-view-switch button:hover{color:var(--color-text-primary)}
.enterprise-view-switch button.is-active{background:var(--color-bg-surface);color:var(--color-primary-default);box-shadow:0 1px 3px rgb(15 23 42 / 10%);font-weight:600}
.enterprise-view-switch button:focus-visible{outline:2px solid var(--color-primary-default);outline-offset:1px}
@media(max-width:620px){.enterprise-view-switch{width:100%}.enterprise-view-switch button{flex:1;padding-inline:8px}}
</style>
