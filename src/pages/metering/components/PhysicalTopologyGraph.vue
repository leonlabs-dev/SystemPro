<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref} from 'vue';
import {useThemeStore} from '@/core/theme/theme.store';
import type {EChartsCoreOption} from '@/design-system/charts/echarts-runtime';
import DsChart from '@/design-system/components/DsChart.vue';
import {enumLabel} from '@/core/i18n/enum-labels';
import type {PhysicalMeteringEdge,PhysicalMeteringNode} from '@/domain/iot/metering-loss';

const props=defineProps<{nodes:PhysicalMeteringNode[];edges:PhysicalMeteringEdge[];selectedId?:number}>();
const emit=defineEmits<{select:[node:PhysicalMeteringNode]}>();
const theme=useThemeStore();
const viewportWidth=ref(typeof window==='undefined'?1440:window.innerWidth);
const roleColor:Record<string,string>={SOURCE:'#2F6BFF',TRANSFER:'#0EA5E9',STORAGE:'#16A34A',CONSUMER:'#7C3AED',METER:'#14B8A6',BOUNDARY:'#D97706'};
const roleOptions=Object.keys(roleColor).map(value=>({value,label:enumLabel('physicalRole',value)}));
const cardSymbol='path://M6 0H94Q100 0 100 6V34Q100 40 94 40H6Q0 40 0 34V6Q0 0 6 0Z';
function updateViewport(){viewportWidth.value=window.innerWidth}
onMounted(()=>window.addEventListener('resize',updateViewport));
onBeforeUnmount(()=>window.removeEventListener('resize',updateViewport));

function graphLayout(){
  const nodeIds=new Set(props.nodes.map(node=>node.id));
  const incoming=new Map<number,number>(),children=new Map<number,number[]>();
  props.nodes.forEach(node=>{incoming.set(node.id,0);children.set(node.id,[])});
  props.edges.forEach(edge=>{if(!nodeIds.has(edge.fromNodeId)||!nodeIds.has(edge.toNodeId))return;incoming.set(edge.toNodeId,(incoming.get(edge.toNodeId)||0)+1);children.get(edge.fromNodeId)?.push(edge.toNodeId)});
  const depth=new Map<number,number>(),queue=props.nodes.filter(node=>(incoming.get(node.id)||0)===0).map(node=>node.id);
  if(!queue.length&&props.nodes[0])queue.push(props.nodes[0].id);
  queue.forEach(id=>depth.set(id,0));
  for(let index=0;index<queue.length;index+=1){const current=queue[index],nextDepth=(depth.get(current)||0)+1;for(const child of children.get(current)||[]){if(!depth.has(child)||nextDepth>(depth.get(child)||0)){depth.set(child,nextDepth);queue.push(child)}}}
  props.nodes.forEach(node=>{if(!depth.has(node.id))depth.set(node.id,Math.max(0,...depth.values())+1)});
  const layers=new Map<number,PhysicalMeteringNode[]>();
  props.nodes.forEach(node=>{const level=depth.get(node.id)||0;layers.set(level,[...(layers.get(level)||[]),node])});
  layers.forEach(items=>items.sort((a,b)=>a.sortOrder-b.sortOrder||a.id-b.id));
  return {layers,depth};
}
const chartHeight=computed(()=>{
  const maxRows=Math.max(1,...[...graphLayout().layers.values()].map(items=>items.length));
  return Math.max(viewportWidth.value<760?640:660,Math.min(800,maxRows*68+160));
});

const option=computed<EChartsCoreOption>(()=>{
  const dark=theme.theme==='dark';
  const {layers,depth}=graphLayout(),narrow=viewportWidth.value<1200,compact=viewportWidth.value<1600,maxDepth=Math.max(1,...depth.values());
  const nodeHeight=narrow?54:compact?60:62;
  const nodeWidth=narrow?126:compact?144:160;
  const chartNodes=props.nodes.map(node=>{
    const layer=layers.get(depth.get(node.id)||0)||[node],row=layer.findIndex(item=>item.id===node.id);
    const color=roleColor[node.role]||'#64748B',selected=node.id===props.selectedId;
    const level=depth.get(node.id)||0,y=layer.length===1?50:6+row*(88/(layer.length-1));
    return{
      id:String(node.id),name:node.name,value:[level*(100/maxDepth),y],x:level*(100/maxDepth),y,
      symbol:cardSymbol,symbolSize:[nodeWidth,nodeHeight],draggable:true,
      itemStyle:{color:selected?(dark?'#17233B':'#F7F9FF'):dark?'#172033':'#FFFFFF',borderColor:selected?'#2F6BFF':dark?'#3A485E':'#C9D2DF',borderWidth:selected?2:1,shadowBlur:selected?5:0,shadowOffsetY:selected?2:0,shadowColor:selected?'rgba(47,107,255,.16)':'transparent'},
      label:{show:true,position:'inside',align:'center',verticalAlign:'middle',formatter:`{role|● }{name|${node.name}}\n{meta|${node.code} · ${node.typeName}}\n{meter|${node.meteringPointName?'计量：已绑定':'计量：未绑定'}}`,rich:{role:{color,fontSize:8,lineHeight:17},name:{width:nodeWidth-36,align:'center',color:dark?'#F1F5F9':'#182230',fontSize:narrow?10:11,fontWeight:650,lineHeight:17,overflow:'truncate'},meta:{width:nodeWidth-18,align:'center',color:dark?'#AAB7CD':'#667085',fontSize:narrow?9:10,lineHeight:15,overflow:'truncate'},meter:{width:nodeWidth-18,align:'center',color:node.meteringPointName?(dark?'#4ADE80':'#168A46'):dark?'#8A98AE':'#7D8999',fontSize:narrow?9:10,lineHeight:15,overflow:'truncate'}}},
      tooltip:{formatter:`<b>${node.name}</b><br/>${node.code} · ${node.typeName}<br/>固定角色：${enumLabel('physicalRole',node.role)}<br/>计量点：${node.meteringPointName||'未绑定'}`},
      originalId:node.id,
    };
  });
  return{
    animationDuration:280,animationDurationUpdate:220,
    grid:{left:narrow?72:compact?82:96,right:narrow?72:compact?82:96,top:58,bottom:106,containLabel:false},
    xAxis:{type:'value',min:0,max:100,show:false},yAxis:{type:'value',min:0,max:100,inverse:true,show:false},
    dataZoom:[
      {type:'slider',xAxisIndex:0,start:0,end:100,bottom:48,height:14,showDetail:false,brushSelect:false,filterMode:'none',borderColor:dark?'#34445F':'#D7DEE9',backgroundColor:dark?'#111827':'#F4F7FB',fillerColor:dark?'rgba(47,107,255,.22)':'rgba(47,107,255,.14)',handleStyle:{color:'#2F6BFF',borderColor:'#2F6BFF'},moveHandleStyle:{color:'#2F6BFF'},dataBackground:{lineStyle:{color:dark?'#56657A':'#A7B2C3'},areaStyle:{color:dark?'#233047':'#DCE4EF'}}},
    ],
    tooltip:{trigger:'item',confine:true,backgroundColor:dark?'#172033':'#FFFFFF',borderColor:dark?'#34445F':'#D7DEE9',textStyle:{color:dark?'#E7EDF7':'#182230'}},
    series:[{type:'graph',coordinateSystem:'cartesian2d',layout:'none',roam:'move',data:chartNodes,
      links:props.edges.map(edge=>({source:String(edge.fromNodeId),target:String(edge.toNodeId),value:edge.connectionType,lineStyle:{color:edge.connectionType==='BACKUP'?'#C98A2E':dark?'#66758B':'#A5B0BF',width:edge.connectionType==='PARALLEL'?2:1.5,type:edge.connectionType==='BACKUP'?'dashed':'solid',curveness:edge.connectionType==='PARALLEL'?.12:0,opacity:.76},label:{show:edge.connectionType!=='SUPPLY',formatter:enumLabel('connectionType',edge.connectionType),color:dark?'#AAB7CD':'#667085',fontSize:10,backgroundColor:dark?'#111827':'#F8FAFC',padding:[2,4],borderRadius:3}})),
      edgeSymbol:['none','arrow'],edgeSymbolSize:[0,7],edgeLabel:{position:'middle'},emphasis:{focus:'none',itemStyle:{borderColor:'#2F6BFF',borderWidth:1.5},lineStyle:{width:2,opacity:.9}},select:{disabled:true}}],
  };
});

function handleClick(params:unknown){const id=Number((params as {data?:{originalId?:number}})?.data?.originalId);const node=props.nodes.find(item=>item.id===id);if(node)emit('select',node)}
</script>

<template>
  <div class="physical-graph" :style="{height:`${chartHeight}px`}">
    <div class="physical-graph__guide" aria-hidden="true"><span>上游电源</span><i/><span>输配变换</span><i/><span>馈线 / 回路</span><i/><span>计量与负荷</span></div>
    <DsChart :option="option" @click="handleClick"/>
    <div class="physical-graph__legend"><span v-for="item in roleOptions" :key="item.value"><i :style="{background:roleColor[item.value]}"/>{{ item.label }}</span><small>拖拽节点或画布 · 底部导航轴缩放与定位</small></div>
  </div>
</template>

<style scoped>
.physical-graph{position:relative;width:100%;min-width:0;background:var(--color-bg-surface)}
.physical-graph__guide{position:absolute;z-index:2;top:14px;left:24px;right:24px;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--color-text-tertiary);font-size:11px;pointer-events:none}.physical-graph__guide i{width:36px;height:1px;background:var(--color-border-default)}
.physical-graph__legend{position:absolute;z-index:2;right:16px;bottom:12px;left:16px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;color:var(--color-text-secondary);font-size:10px;pointer-events:none}.physical-graph__legend span{display:inline-flex;align-items:center;gap:5px}.physical-graph__legend i{width:7px;height:7px;border-radius:50%}.physical-graph__legend small{margin-left:auto;color:var(--color-text-tertiary)}
@media(max-width:760px){.physical-graph__guide{display:none}.physical-graph__legend small{display:none}}
</style>
