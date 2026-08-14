<script setup lang="ts">
import {computed} from 'vue';
import {useThemeStore} from '@/core/theme/theme.store';
import type {EChartsCoreOption} from '@/design-system/charts/echarts-runtime';
import DsChart from '@/design-system/components/DsChart.vue';
import {enumLabel} from '@/core/i18n/enum-labels';
import type {AccountingMeteringNode} from '@/domain/iot/metering-loss';

const props=defineProps<{roots:AccountingMeteringNode[];selectedId?:number}>();
const emit=defineEmits<{select:[node:AccountingMeteringNode]}>();
const theme=useThemeStore();
const dimensionColor:Record<string,string>={SPACE:'#2F6BFF',TENANT:'#0EA5E9',END_USE:'#7C3AED',SYSTEM:'#14B8A6',DEVICE:'#16A34A',CUSTOM:'#64748B',RESIDUAL:'#D97706'};
const methodLabel=(value:string)=>enumLabel('calculationMethod',value);

function flatten(nodes:AccountingMeteringNode[]):AccountingMeteringNode[]{return nodes.flatMap(node=>[node,...flatten(node.children)])}
const allNodes=computed(()=>flatten(props.roots));
const option=computed<EChartsCoreOption>(()=>{
  const dark=theme.theme==='dark',byId=new Map(allNodes.value.map(node=>[node.id,node]));
  const data=allNodes.value.map(node=>({
    name:`${node.id}`,
    displayName:node.name,
    value:Math.max(.001,Math.abs(Number(node.usage)||0)),
    originalId:node.id,
    itemStyle:{color:node.calculationMethod==='RESIDUAL'?'#D97706':dimensionColor[node.dimensionType]||'#64748B',borderColor:node.id===props.selectedId?'#182230':dark?'#34445F':'#FFFFFF',borderWidth:node.id===props.selectedId?3:1},
  }));
  const links=allNodes.value.filter(node=>node.parentId&&byId.has(node.parentId)).map(node=>({source:String(node.parentId),target:String(node.id),value:Math.max(.001,Math.abs(Number(node.usage)||0)),lineStyle:{color:node.calculationMethod==='RESIDUAL'?'#D97706':'source',opacity:node.calculationMethod==='RESIDUAL'?.52:.3}}));
  return{
    animationDuration:320,
    tooltip:{trigger:'item',confine:true,backgroundColor:dark?'#172033':'#FFFFFF',borderColor:dark?'#34445F':'#D7DEE9',textStyle:{color:dark?'#E7EDF7':'#182230'},formatter:(params:{dataType?:string;data?:{originalId?:number}})=>{const node=byId.get(Number(params.data?.originalId));if(!node)return '';return `<b>${node.name}</b><br/>${methodLabel(node.calculationMethod)}<br/>本期电量：${Number(node.usage).toLocaleString('zh-CN',{maximumFractionDigits:3})} ${node.unitSymbol}<br/>占上级：${node.shareRate}%`; }},
    series:[{type:'sankey',left:30,right:136,top:62,bottom:48,nodeWidth:12,nodeGap:14,nodeAlign:'justify',layoutIterations:64,draggable:true,emphasis:{focus:'adjacency'},data,links,
      label:{color:dark?'#DCE5F2':'#344054',fontSize:11,distance:8,formatter:(params:{data?:{displayName?:string;originalId?:number}})=>{const node=byId.get(Number(params.data?.originalId));if(!node)return params.data?.displayName||'';return `${node.name}\n${Number(node.usage).toLocaleString('zh-CN',{maximumFractionDigits:1})} ${node.unitSymbol}`;}},
      lineStyle:{curveness:.52,opacity:.32},levels:[{depth:0,itemStyle:{borderWidth:2}},{depth:1,itemStyle:{borderWidth:1}},{depth:2,itemStyle:{borderWidth:1}},{depth:3,itemStyle:{borderWidth:1}}]}],
  };
});
function handleClick(params:unknown){const id=Number((params as {data?:{originalId?:number}})?.data?.originalId);const node=allNodes.value.find(item=>item.id===id);if(node)emit('select',node)}
</script>

<template>
  <div class="accounting-flow">
    <div class="accounting-flow__heading"><strong>电量分解路径</strong><span>连线宽度代表本期电量，节点可拖拽调整位置</span></div>
    <div class="accounting-flow__stages" aria-hidden="true"><span>总量入口</span><i/><span>一级分区</span><i/><span>分项与差额</span></div>
    <DsChart :option="option" @click="handleClick"/>
    <div class="accounting-flow__legend"><span><i class="is-measured"/>已计量 / 已汇总</span><span><i class="is-residual"/>未解释差额</span><small>点击节点查看口径、计量点和数据质量</small></div>
  </div>
</template>

<style scoped>
.accounting-flow{position:relative;width:100%;height:540px;min-width:0;background:linear-gradient(180deg,color-mix(in srgb,var(--color-primary-default) 3%,var(--color-bg-surface)),var(--color-bg-surface) 56%);cursor:grab}.accounting-flow:active{cursor:grabbing}
.accounting-flow__heading{position:absolute;z-index:2;top:14px;left:18px;display:flex;align-items:baseline;gap:10px;pointer-events:none}.accounting-flow__heading strong{color:var(--color-text-primary);font-size:12px}.accounting-flow__heading span{color:var(--color-text-tertiary);font-size:10px}
.accounting-flow__stages{position:absolute;z-index:2;top:38px;right:88px;left:88px;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--color-text-tertiary);font-size:10px;pointer-events:none}.accounting-flow__stages i{min-width:28px;max-width:84px;height:1px;background:var(--color-border-default);flex:1}
.accounting-flow__legend{position:absolute;z-index:2;right:16px;bottom:10px;left:16px;display:flex;align-items:center;gap:14px;color:var(--color-text-secondary);font-size:10px;pointer-events:none}.accounting-flow__legend span{display:inline-flex;align-items:center;gap:5px}.accounting-flow__legend i{width:10px;height:10px;border-radius:2px}.is-measured{background:#2F6BFF}.is-residual{background:#D97706}.accounting-flow__legend small{margin-left:auto;color:var(--color-text-tertiary)}
@media(max-width:760px){.accounting-flow{height:480px}.accounting-flow__heading span,.accounting-flow__legend small,.accounting-flow__stages{display:none}}
</style>
