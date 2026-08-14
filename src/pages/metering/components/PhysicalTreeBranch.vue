<script setup lang="ts">
import DsTag from '@/design-system/components/DsTag.vue';
import {enumLabel} from '@/core/i18n/enum-labels';
import type { PhysicalMeteringNode } from '@/domain/iot/metering-loss';

defineOptions({name:'PhysicalTreeBranch'});
interface PhysicalTreeNode extends PhysicalMeteringNode{children:PhysicalTreeNode[]}
defineProps<{node:PhysicalTreeNode;selectedId?:number}>();
const emit=defineEmits<{select:[node:PhysicalMeteringNode]}>();
const roleTone=(role:string)=>role==='SOURCE'?'primary':role==='CONSUMER'?'success':role==='STORAGE'?'warning':'info';
const roleLabel=(value:string)=>enumLabel('physicalRole',value);
</script>

<template>
  <li class="physical-branch">
    <button type="button" class="physical-card" :class="{selected:selectedId===node.id}" @click="emit('select',node)">
      <span class="physical-card__heading"><strong>{{ node.name }}</strong><DsTag :type="roleTone(node.role)" size="small">{{ roleLabel(node.role) }}</DsTag></span>
      <small>{{ node.typeName }} · {{ node.code }}</small>
      <span class="physical-card__point">{{ node.meteringPointName||'未绑定计量点' }}</span>
    </button>
    <ul v-if="node.children.length" class="physical-children">
      <PhysicalTreeBranch v-for="child in node.children" :key="child.id" :node="child" :selected-id="selectedId" @select="emit('select',$event)" />
    </ul>
  </li>
</template>

<style scoped>
.physical-branch{position:relative;display:flex;flex-direction:column;align-items:center;padding:0 9px;list-style:none}.physical-card{position:relative;z-index:1;width:198px;min-height:96px;padding:11px;text-align:left;border:1px solid var(--color-border-default);border-radius:var(--radius-lg);background:var(--color-bg-surface);color:var(--color-text-primary);box-shadow:var(--shadow-xs);cursor:pointer}.physical-card:hover,.physical-card.selected{border-color:var(--color-primary-default);box-shadow:0 0 0 2px color-mix(in srgb,var(--color-primary-default) 12%,transparent)}.physical-card__heading{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}.physical-card__heading strong{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.physical-card small,.physical-card__point{display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-tertiary);font-size:11px}.physical-card__point{color:var(--color-text-secondary)}.physical-children{position:relative;display:flex;justify-content:center;margin:28px 0 0;padding:0;list-style:none}.physical-children:before{content:"";position:absolute;top:-15px;left:50%;height:15px;border-left:1px solid var(--color-border-default)}.physical-children>.physical-branch:before{content:"";position:absolute;top:-14px;left:0;right:0;border-top:1px solid var(--color-border-default)}.physical-children>.physical-branch:first-child:before{left:50%}.physical-children>.physical-branch:last-child:before{right:50%}.physical-children>.physical-branch:after{content:"";position:absolute;top:-14px;left:50%;height:14px;border-left:1px solid var(--color-border-default)}
</style>
