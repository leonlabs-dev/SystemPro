<script setup lang="ts">
import { computed } from 'vue';
import type { PhysicalMeteringEdge,PhysicalMeteringNode } from '@/domain/iot/metering-loss';
import PhysicalTreeBranch from './PhysicalTreeBranch.vue';

interface PhysicalTreeNode extends PhysicalMeteringNode{children:PhysicalTreeNode[]}

const props=defineProps<{nodes:PhysicalMeteringNode[];edges:PhysicalMeteringEdge[];selectedId?:number}>();
const emit=defineEmits<{select:[node:PhysicalMeteringNode]}>();
const roots=computed(()=>{
  const map=new Map<number,PhysicalTreeNode>(props.nodes.map(node=>[node.id,{...node,children:[]}]))
  const childIds=new Set<number>();
  props.edges.forEach(edge=>{const parent=map.get(edge.fromNodeId),child=map.get(edge.toNodeId);if(parent&&child){parent.children.push(child);childIds.add(child.id)}});
  map.forEach(node=>node.children.sort((a,b)=>a.sortOrder-b.sortOrder));
  return [...map.values()].filter(node=>!childIds.has(node.id)).sort((a,b)=>a.sortOrder-b.sortOrder);
});
</script>

<template><ul class="physical-tree-root"><PhysicalTreeBranch v-for="node in roots" :key="node.id" :node="node" :selected-id="selectedId" @select="emit('select',$event)" /></ul></template>
<style scoped>.physical-tree-root{display:flex;justify-content:center;margin:0;padding:0;list-style:none}</style>
