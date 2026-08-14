<script setup lang="ts">
import { computed } from 'vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { enumLabel } from '@/core/i18n/enum-labels';
import type { AccountingMeteringNode } from '@/domain/iot/metering-loss';

defineOptions({name:'AccountingTreeNode'});
const props=defineProps<{node:AccountingMeteringNode;selectedId?:number}>();
const emit=defineEmits<{select:[node:AccountingMeteringNode]}>();
const tone=computed(()=>props.node.calculationMethod==='RESIDUAL'?'warning':props.node.qualityStatus==='GOOD'?'success':props.node.qualityStatus==='CORRECTED'?'primary':'warning');
const methodLabel=(value:string)=>enumLabel('calculationMethod',value);
</script>

<template>
  <li class="accounting-tree-node">
    <button class="accounting-node-card" :class="{selected:selectedId===node.id,residual:node.calculationMethod==='RESIDUAL'}" type="button" @click="emit('select',node)">
      <span class="accounting-node-card__heading"><strong>{{ node.name }}</strong><DsTag :type="tone" size="small">{{ methodLabel(node.calculationMethod) }}</DsTag></span>
      <small>{{ node.code }}</small>
      <span class="accounting-node-card__metric"><b>{{ Number(node.usage).toLocaleString('zh-CN',{maximumFractionDigits:3}) }}</b> {{ node.unitSymbol }}</span>
      <span class="accounting-node-card__share">占上级 {{ Number(node.shareRate).toFixed(1) }}%</span>
    </button>
    <ul v-if="node.children.length" class="accounting-tree-children">
      <AccountingTreeNode v-for="child in node.children" :key="child.id" :node="child" :selected-id="selectedId" @select="emit('select',$event)" />
    </ul>
  </li>
</template>

<style scoped>
.accounting-tree-node{position:relative;display:flex;flex-direction:column;align-items:center;padding:0 10px;list-style:none}.accounting-node-card{position:relative;z-index:1;width:218px;min-height:118px;padding:12px;text-align:left;border:1px solid var(--color-border-default);border-radius:var(--radius-lg);background:var(--color-bg-surface);color:var(--color-text-primary);box-shadow:var(--shadow-xs);cursor:pointer;transition:.16s ease}.accounting-node-card:hover,.accounting-node-card.selected{border-color:var(--color-primary-default);box-shadow:0 0 0 2px color-mix(in srgb,var(--color-primary-default) 12%,transparent)}.accounting-node-card.residual{border-color:color-mix(in srgb,var(--color-warning-default) 56%,var(--color-border-default));background:color-mix(in srgb,var(--color-warning-default) 6%,var(--color-bg-surface))}.accounting-node-card__heading{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}.accounting-node-card__heading strong{max-width:122px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.accounting-node-card small{display:block;margin-top:4px;color:var(--color-text-tertiary)}.accounting-node-card__metric{display:block;margin-top:10px;color:var(--color-text-secondary)}.accounting-node-card__metric b{color:var(--color-text-primary);font-size:16px}.accounting-node-card__share{position:absolute;right:12px;bottom:10px;color:var(--color-primary-default);font-size:12px}.accounting-tree-children{position:relative;display:flex;justify-content:center;margin:28px 0 0;padding:0}.accounting-tree-children:before{content:"";position:absolute;top:-15px;left:50%;height:15px;border-left:1px solid var(--color-border-default)}.accounting-tree-children>.accounting-tree-node:before{content:"";position:absolute;top:-14px;left:0;right:0;border-top:1px solid var(--color-border-default)}.accounting-tree-children>.accounting-tree-node:first-child:before{left:50%}.accounting-tree-children>.accounting-tree-node:last-child:before{right:50%}.accounting-tree-children>.accounting-tree-node:after{content:"";position:absolute;top:-14px;left:50%;height:14px;border-left:1px solid var(--color-border-default)}
</style>
