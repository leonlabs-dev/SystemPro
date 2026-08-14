<script setup lang="ts">
import {CircleCheck,Delete,Edit,Plus,Promotion,Refresh,Search} from '@element-plus/icons-vue';
import {computed,onMounted,ref,watch} from 'vue';
import {ElMessage,ElMessageBox} from 'element-plus';
import {ApiError} from '@/core/api/contracts';
import {useAuthStore} from '@/core/auth/auth.store';
import {enumLabel} from '@/core/i18n/enum-labels';
import DsDataTable from '@/design-system/components/DsDataTable.vue';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import {useListPageState} from '@/design-system/composables/useListPageState';
import {
  enterpriseMeteringApi,
  type AccountingMeteringNode,
  type AccountingMeteringTree,
  type AccountingNodeInput,
  type MeteringModelVersion,
  type MeteringPointOption,
} from '@/domain/iot/metering-loss';
import AccountingFlowGraph from './components/AccountingFlowGraph.vue';
import EnterpriseViewSwitch from './components/EnterpriseViewSwitch.vue';
import './enterprise-metering.css';

const auth=useAuthStore();
const managePermission='platform:enterprise-metering:accounting:manage';
const publishPermission='platform:enterprise-metering:accounting:publish';
const loading=ref(true),saving=ref(false),ready=ref(false),activeView=ref('flow');
const viewOptions=[{value:'flow',label:'电量分解',icon:'analysis' as const},{value:'list',label:'口径清单',icon:'list' as const}];
const versions=ref<MeteringModelVersion[]>([]),versionId=ref<number>();
const dates=ref<[string,string]>(defaultRange()),tree=ref<AccountingMeteringTree>();
const selected=ref<AccountingMeteringNode>(),points=ref<MeteringPointOption[]>([]);
const versionDialog=ref(false),nodeDialog=ref(false),editingNodeId=ref<number>();
const versionForm=ref({name:'',effectiveFrom:localDateTime(new Date()),copyFromVersionId:undefined as number|undefined,remark:''});
const nodeForm=ref<AccountingNodeInput>(emptyNode());

function localDate(value:Date){return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function localDateTime(value:Date){return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,19)}
function defaultRange():[string,string]{const end=new Date(),start=new Date(end.getFullYear(),end.getMonth(),1);return[localDate(start),localDate(end)]}
function params(){return{versionId:versionId.value,periodStart:`${dates.value[0]}T00:00:00`,periodEnd:`${dates.value[1]}T23:59:59`}}
function flatten(nodes:AccountingMeteringNode[],depth=0):Array<AccountingMeteringNode&{depth:number}>{return nodes.flatMap(node=>[{...node,depth},...flatten(node.children,depth+1)])}
function emptyNode():AccountingNodeInput{return{code:'',name:'',dimensionType:'END_USE',calculationMethod:'MEASURED',contributionFactor:1,coverageRequired:true,sortOrder:10,remark:''}}
const rows=computed(()=>flatten(tree.value?.roots||[]));
const currentVersion=computed(()=>versions.value.find(item=>item.id===versionId.value));
const isDraft=computed(()=>currentVersion.value?.status==='DRAFT');
const canManage=computed(()=>auth.can(managePermission));
const canShowManage=computed(()=>auth.canShow(managePermission));
const canPublish=computed(()=>auth.can(publishPermission));
const parentOptions=computed(()=>rows.value.filter(row=>row.id!==editingNodeId.value&&row.calculationMethod!=='RESIDUAL'));
const {page,pageSize,pagedRows}=useListPageState({rows,resetDeps:()=>[versionId.value,dates.value[0],dates.value[1]]});
const methodLabel=(value:string)=>enumLabel('calculationMethod',value);
const dimensionLabel=(value:string)=>enumLabel('dimensionType',value);
function qualityTone(value:string){return value==='GOOD'?'success':value==='CORRECTED'?'primary':value==='CALCULATED'?'info':'warning'}
const qualityLabel=(value:string)=>enumLabel('qualityStatus',value);
function statusTone(value?:string){return value==='PUBLISHED'?'success':value==='DRAFT'?'warning':'info'}
function statusLabel(value?:string){return({PUBLISHED:'已发布',DRAFT:'草稿',RETIRED:'已退役'} as Record<string,string>)[value||'']||value}
function errorMessage(error:unknown,fallback:string){return error instanceof ApiError?error.message:fallback}

async function loadVersions(preferredId?:number){
  versions.value=await enterpriseMeteringApi.accountingVersions();
  versionId.value=preferredId??versionId.value??versions.value[0]?.id;
}
async function load(){
  if(!versionId.value)return;
  loading.value=true;
  try{
    tree.value=await enterpriseMeteringApi.accountingTree(params());
    const previous=selected.value?.id;
    selected.value=rows.value.find(item=>item.id===previous)||tree.value.roots[0];
  }catch(error){ElMessage.error(errorMessage(error,'分项计量加载失败'))}finally{loading.value=false}
}
async function ensurePoints(){if(!points.value.length)points.value=await enterpriseMeteringApi.accountingPointOptions()}
function openVersionDialog(){
  if(!auth.canEnter(managePermission))return;
  const next=Math.max(0,...versions.value.map(item=>Number(item.name.match(/V(\d+)/i)?.[1]||0)))+1;
  versionForm.value={name:`电力分项计量 V${next}`,effectiveFrom:localDateTime(new Date()),copyFromVersionId:currentVersion.value?.id,remark:'从当前版本复制后调整，发布前执行拓扑校验'};
  versionDialog.value=true;
}
async function createVersion(){
  if(!canManage.value)return;
  if(!versionForm.value.name.trim()||!versionForm.value.effectiveFrom){ElMessage.warning('请填写版本名称和生效时间');return}
  saving.value=true;
  try{
    const created=await enterpriseMeteringApi.createAccountingVersion(versionForm.value);
    versionDialog.value=false;ready.value=false;await loadVersions(created.id);ready.value=true;await load();
    ElMessage.success('草稿计量树已创建，已发布版本未受影响');
  }catch(error){ElMessage.error(errorMessage(error,'创建草稿失败'))}finally{saving.value=false}
}
async function openCreateNode(parent?:AccountingMeteringNode){
  await ensurePoints();editingNodeId.value=undefined;
  nodeForm.value={...emptyNode(),parentId:parent?.id,sortOrder:(parent?.children.length||0)*10+10};
  nodeDialog.value=true;
}
async function openEditNode(node:AccountingMeteringNode){
  await ensurePoints();editingNodeId.value=node.id;
  nodeForm.value={parentId:node.parentId,code:node.code,name:node.name,dimensionType:node.dimensionType,
    calculationMethod:node.calculationMethod,meteringPointId:node.meteringPointId,
    contributionFactor:node.contributionFactor,coverageRequired:node.coverageRequired,
    sortOrder:node.sortOrder,version:node.version,remark:''};
  nodeDialog.value=true;
}
function methodChanged(value:string){
  if(value!=='MEASURED'){nodeForm.value.meteringPointId=undefined;nodeForm.value.coverageRequired=false}
  if(value==='MEASURED'){nodeForm.value.coverageRequired=true;if(nodeForm.value.dimensionType==='RESIDUAL')nodeForm.value.dimensionType='END_USE'}
  if(value==='RESIDUAL')nodeForm.value.dimensionType='RESIDUAL';
}
async function saveNode(){
  if(!canManage.value)return;
  if(!versionId.value||!nodeForm.value.code.trim()||!nodeForm.value.name.trim()){ElMessage.warning('请填写节点编码和名称');return}
  saving.value=true;
  try{
    tree.value=editingNodeId.value
      ?await enterpriseMeteringApi.updateAccountingNode(versionId.value,editingNodeId.value,nodeForm.value)
      :await enterpriseMeteringApi.createAccountingNode(versionId.value,nodeForm.value);
    nodeDialog.value=false;
    selected.value=rows.value.find(item=>item.id===editingNodeId.value)||selected.value||tree.value.roots[0];
    await loadVersions(versionId.value);ElMessage.success(editingNodeId.value?'节点已更新':'节点已新增');
  }catch(error){ElMessage.error(errorMessage(error,'保存节点失败'))}finally{saving.value=false}
}
async function disableNode(node:AccountingMeteringNode){
  if(!versionId.value)return;
  try{
    await ElMessageBox.confirm(`确定停用草稿节点“${node.name}”吗？仅允许停用没有下级的节点。`,'停用节点',{type:'warning',confirmButtonText:'停用',cancelButtonText:'取消'});
    tree.value=await enterpriseMeteringApi.disableAccountingNode(versionId.value,node.id,node.version);
    selected.value=tree.value.roots[0];await loadVersions(versionId.value);ElMessage.success('节点已停用');
  }catch(error){if(error!=='cancel'&&error!=='close')ElMessage.error(errorMessage(error,'停用节点失败'))}
}
async function validateVersion(showSuccess=true){
  if(!versionId.value)return false;
  try{
    const result=await enterpriseMeteringApi.validateAccountingVersion(versionId.value);
    if(result.valid){if(showSuccess)ElMessage.success('版本校验通过：单根、无环、无重复计量点，算法语义完整');return true}
    await ElMessageBox.alert(result.issues.map((item,index)=>`${index+1}. ${item}`).join('\n'),'版本校验未通过',{type:'warning'});return false;
  }catch(error){ElMessage.error(errorMessage(error,'版本校验失败'));return false}
}
async function publishVersion(){
  if(!versionId.value||!currentVersion.value)return;
  if(!await validateVersion(false))return;
  try{
    await ElMessageBox.confirm('发布后当前草稿将成为新的核算口径，原已发布版本会按生效时间退役且保留历史。是否继续？','发布计量树',{type:'warning',confirmButtonText:'发布',cancelButtonText:'取消'});
    const published=await enterpriseMeteringApi.publishAccountingVersion(versionId.value,{version:currentVersion.value.version,effectiveFrom:currentVersion.value.effectiveFrom});
    ready.value=false;await loadVersions(published.id);ready.value=true;await load();ElMessage.success('计量树已发布');
  }catch(error){if(error!=='cancel'&&error!=='close')ElMessage.error(errorMessage(error,'发布失败'))}
}

watch(versionId,(next,previous)=>{if(ready.value&&next&&next!==previous)load()});
onMounted(async()=>{try{await loadVersions();ready.value=true;await load()}catch(error){ElMessage.error(errorMessage(error,'分项计量初始化失败'))}});
</script>

<template>
  <DsListPageShell title="电力分项计量" subtitle="版本化核算树：实表、汇总与未解释差额共同表达空间、租户、分项和系统用电" page-class="enterprise-metering-page" :loading="loading">
    <template #header-extra><DsTag v-if="currentVersion" :type="statusTone(currentVersion.status)">{{ statusLabel(currentVersion.status) }} · {{ currentVersion.code }}</DsTag></template>
    <div v-if="tree" class="enterprise-content">
      <section class="enterprise-query-bar enterprise-query-bar--subitems">
        <div class="enterprise-query-bar__field"><label>核算版本</label><el-select v-model="versionId" placeholder="计量树版本"><el-option v-for="item in versions" :key="item.id" :label="`${item.name}（${statusLabel(item.status)}）`" :value="item.id"/></el-select></div>
        <div class="enterprise-query-bar__field enterprise-query-bar__field--date"><label>统计周期</label><el-date-picker v-model="dates" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期"/></div>
        <div class="enterprise-query-bar__actions"><el-button type="primary" :icon="Search" @click="load">查询</el-button><el-button :icon="Refresh" @click="load">刷新</el-button><el-button v-if="canShowManage" v-permission.preview="managePermission" :icon="Plus" @click="openVersionDialog">新建计量树</el-button></div>
      </section>
      <section class="enterprise-kpis"><article><span>计量节点</span><strong>{{ tree.nodeCount }}</strong><small>核算节点与物理节点解耦</small></article><article><span>已覆盖节点</span><strong>{{ tree.coveredNodeCount }} / {{ tree.measuredNodeCount }}</strong><small>覆盖率 {{ tree.coverageRate }}%</small></article><article><span>当前分项率</span><strong>{{ tree.subitemRate }}%</strong><small>按根节点直接差额计算</small></article><article><span>未解释差额</span><strong :class="{'enterprise-warning':tree.unexplainedRate>=3}">{{ Number(tree.unexplainedQuantity).toLocaleString('zh-CN',{maximumFractionDigits:3}) }} kWh</strong><small>占输入 {{ tree.unexplainedRate }}%</small></article></section>
      <section class="enterprise-panel">
        <header class="enterprise-panel__header"><EnterpriseViewSwitch v-model="activeView" :options="viewOptions"/><DsTag class="enterprise-validation-tag" :type="tree.validationIssues.length?'warning':'success'">{{ tree.validationIssues.length?`${tree.validationIssues.length} 项校验问题`:'拓扑校验通过' }}</DsTag></header>
        <div v-if="isDraft&&canShowManage" class="enterprise-editor-actions"><el-button v-permission="managePermission" :icon="CircleCheck" @click="validateVersion()">校验版本</el-button><el-button v-permission.preview="managePermission" :icon="Plus" :disabled="!selected||selected.calculationMethod==='RESIDUAL'" @click="selected&&openCreateNode(selected)">添加下级</el-button><el-button v-if="selected" v-permission.preview="managePermission" :icon="Edit" @click="selected&&openEditNode(selected)">编辑节点</el-button><el-button v-if="selected" v-permission="managePermission" :icon="Delete" type="danger" plain @click="selected&&disableNode(selected)">停用节点</el-button><el-button v-if="auth.canShow(publishPermission)" v-permission="publishPermission" :icon="Promotion" type="primary" :disabled="!canPublish" @click="publishVersion">发布版本</el-button></div>
        <div v-if="activeView==='flow'" class="enterprise-visual-layout"><div class="enterprise-visual-board"><AccountingFlowGraph :roots="tree.roots" :selected-id="selected?.id" @select="selected=$event"/><DsEmpty v-if="!tree.roots.length" description="草稿暂无节点，请新增根节点"/></div><aside class="enterprise-tree-detail"><template v-if="selected"><p class="enterprise-detail-eyebrow">选中核算节点</p><h3>{{ selected.name }}</h3><dl class="enterprise-detail-list"><div><dt>节点编码</dt><dd>{{ selected.code }}</dd></div><div><dt>核算维度</dt><dd>{{ dimensionLabel(selected.dimensionType) }}</dd></div><div><dt>计算方式</dt><dd><DsTag :type="selected.calculationMethod==='RESIDUAL'?'warning':'primary'">{{ methodLabel(selected.calculationMethod) }}</DsTag></dd></div><div><dt>计量点</dt><dd>{{ selected.meteringPointName||'系统计算，不绑定计量点' }}</dd></div><div><dt>本期电量</dt><dd><strong>{{ Number(selected.usage).toLocaleString('zh-CN',{maximumFractionDigits:3}) }} {{ selected.unitSymbol }}</strong></dd></div><div><dt>占上级</dt><dd>{{ selected.shareRate }}%</dd></div><div><dt>数据质量</dt><dd><DsTag :type="qualityTone(selected.qualityStatus)">{{ qualityLabel(selected.qualityStatus) }}</DsTag></dd></div></dl><div v-if="selected.calculationMethod==='RESIDUAL'" class="enterprise-detail-callout is-warning"><strong>未解释差额</strong><span>父级输入与已计量下级合计的差额。</span></div></template><DsEmpty v-else description="点击流量图节点查看详情"/></aside></div>
        <section v-else class="ds-list-table-shell ds-list-table-shell--embedded enterprise-table-shell"><DsDataTable :rows="pagedRows as unknown as Record<string,unknown>[]" :columns="[]" table-layout="fixed"><el-table-column label="计量节点" min-width="230"><template #default="{row}"><div class="enterprise-primary-cell" :style="{paddingLeft:`${row.depth*14}px`}"><strong>{{ row.name }}</strong><small>{{ row.code }}</small></div></template></el-table-column><el-table-column label="核算维度" width="110"><template #default="{row}">{{ dimensionLabel(row.dimensionType) }}</template></el-table-column><el-table-column label="计算方式" width="120"><template #default="{row}"><DsTag :type="row.calculationMethod==='RESIDUAL'?'warning':'primary'">{{ methodLabel(row.calculationMethod) }}</DsTag></template></el-table-column><el-table-column label="计量点" min-width="170" show-overflow-tooltip><template #default="{row}">{{ row.meteringPointName||'--' }}</template></el-table-column><el-table-column label="本期电量" width="140" align="right"><template #default="{row}"><strong>{{ Number(row.usage).toLocaleString('zh-CN',{maximumFractionDigits:3}) }} {{ row.unitSymbol }}</strong></template></el-table-column><el-table-column label="占上级" width="92" align="right"><template #default="{row}">{{ row.shareRate }}%</template></el-table-column><el-table-column label="数据质量" width="100"><template #default="{row}"><DsTag :type="qualityTone(row.qualityStatus)">{{ qualityLabel(row.qualityStatus) }}</DsTag></template></el-table-column><el-table-column v-if="isDraft&&canShowManage" label="操作" width="120" fixed="right"><template #default="{row}"><div class="ds-row-actions"><el-button v-permission.preview="managePermission" link type="primary" @click="openEditNode(row)">编辑</el-button><el-button v-if="row.calculationMethod!=='RESIDUAL'" v-permission.preview="managePermission" link @click="openCreateNode(row)">下级</el-button></div></template></el-table-column><template #empty><DsEmpty description="当前版本暂无核算节点"/></template></DsDataTable><footer v-if="rows.length" class="ds-list-table-footer ds-list-table-footer--pagination-only"><DsPagination v-model:page="page" v-model:page-size="pageSize" :total="rows.length"/></footer></section>
      </section>
    </div>

    <el-dialog v-model="versionDialog" title="新建计量树草稿" width="620px" destroy-on-close>
      <el-form label-position="top"><el-form-item label="版本名称" required><el-input v-model="versionForm.name" maxlength="128"/></el-form-item><el-form-item label="计划生效时间" required><el-date-picker v-model="versionForm.effectiveFrom" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%"/></el-form-item><el-form-item label="复制来源"><el-select v-model="versionForm.copyFromVersionId" clearable placeholder="不复制，创建空草稿" style="width:100%"><el-option v-for="item in versions" :key="item.id" :label="`${item.name}（${statusLabel(item.status)}）`" :value="item.id"/></el-select></el-form-item><el-form-item label="说明"><el-input v-model="versionForm.remark" type="textarea" :rows="3" maxlength="500" show-word-limit/></el-form-item></el-form>
      <template #footer><el-button @click="versionDialog=false">取消</el-button><el-button v-permission="managePermission" type="primary" :loading="saving" :disabled="!canManage" @click="createVersion">创建草稿</el-button></template>
    </el-dialog>

    <el-dialog v-model="nodeDialog" :title="editingNodeId?'编辑计量节点':'新增计量节点'" width="680px" destroy-on-close>
      <el-form label-position="top" class="enterprise-node-form"><el-form-item label="上级节点"><el-select v-model="nodeForm.parentId" clearable placeholder="留空表示根节点" style="width:100%"><el-option v-for="item in parentOptions" :key="item.id" :label="`${'　'.repeat(item.depth)}${item.name}`" :value="item.id"/></el-select></el-form-item><el-form-item label="节点编码" required><el-input v-model="nodeForm.code" :disabled="Boolean(editingNodeId)" maxlength="64" placeholder="例如 MPT-QH-A-LIGHT"/></el-form-item><el-form-item label="节点名称" required><el-input v-model="nodeForm.name" maxlength="128"/></el-form-item><el-form-item label="核算维度" required><el-select v-model="nodeForm.dimensionType" style="width:100%"><el-option v-for="(label,value) in dimensionLabel" :key="value" :label="label" :value="value"/></el-select></el-form-item><el-form-item label="计算方式" required><el-select v-model="nodeForm.calculationMethod" style="width:100%" @change="methodChanged"><el-option v-for="(label,value) in methodLabel" :key="value" :label="label" :value="value"/></el-select></el-form-item><el-form-item v-if="nodeForm.calculationMethod==='MEASURED'" label="电力计量点" required><el-select v-model="nodeForm.meteringPointId" filterable style="width:100%" placeholder="选择真实或已标识来源的计量点"><el-option v-for="item in points" :key="item.id" :label="`${item.name} · ${item.code}${item.spaceName?` · ${item.spaceName}`:''}`" :value="item.id"/></el-select></el-form-item><el-form-item label="折算系数"><el-input-number v-model="nodeForm.contributionFactor" :min="0.000001" :precision="6" :step="0.1"/></el-form-item><el-form-item label="排序"><el-input-number v-model="nodeForm.sortOrder" :min="0" :step="10"/></el-form-item><el-form-item v-if="nodeForm.calculationMethod==='MEASURED'" label="覆盖要求"><el-switch v-model="nodeForm.coverageRequired" active-text="纳入覆盖率" inactive-text="辅助计量"/></el-form-item><el-form-item label="说明"><el-input v-model="nodeForm.remark" type="textarea" :rows="2" maxlength="500"/></el-form-item></el-form>
      <template #footer><el-button @click="nodeDialog=false">取消</el-button><el-button v-permission="managePermission" type="primary" :loading="saving" :disabled="!canManage" @click="saveNode">保存节点</el-button></template>
    </el-dialog>
  </DsListPageShell>
</template>

<style scoped>
.accounting-tree-root{display:flex;justify-content:center;margin:0;padding:0;list-style:none}
.enterprise-editor-actions{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--el-border-color-lighter);background:var(--el-fill-color-extra-light);flex-wrap:wrap}
.enterprise-node-form{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.enterprise-node-form :deep(.el-form-item:first-child),.enterprise-node-form :deep(.el-form-item:last-child){grid-column:1/-1}
@media(max-width:900px){.enterprise-node-form{grid-template-columns:1fr}.enterprise-node-form :deep(.el-form-item){grid-column:1}}
</style>
