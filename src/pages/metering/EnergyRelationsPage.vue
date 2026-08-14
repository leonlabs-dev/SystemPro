<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Plus, Refresh, Setting } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ApiError } from '@/core/api/contracts';
import { fetchAllPages } from '@/core/api/pagination';
import { useAuthStore } from '@/core/auth/auth.store';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsDataTable from '@/design-system/components/DsDataTable.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useListPageState } from '@/design-system/composables/useListPageState';
import MeteringConfigurationPanel from '@/pages/assets/MeteringConfigurationPanel.vue';
import {
  energyRelationApi,
  energyRelationPermissions,
  meterRepository,
  meteringApi,
  meteringPermissions,
  type EnergyRelation,
  type EnergyRelationSetup,
  type EnergyRelationSetupPreview,
  type EnergyRelationType,
  type MeterAsset,
  type TariffPlan,
} from '@/domain/iot/assets/meter';
import { waterMeterPermissions, waterMeterRepository, type WaterMeterAsset } from '@/domain/iot/assets/water-meter';
import { fetchSpaceTree } from '@/domain/platform/org/api/space.api';
import { fetchTenants } from '@/domain/platform/org/api/tenant.api';
import type { TenantRecord } from '@/domain/platform/org';
import { flattenResources, getResourceBreadcrumb, type ResourceNode } from '@/domain/platform/org/resource';
import { fetchRuntimeDictionary, type DictionaryItem } from '@/domain/platform/settings/api/settings.api';

type WizardMode='create'|'change';
type MeterEnergyType='ELECTRICITY'|'WATER';
type RelationMeter={
  id:string;name:string;code:string;serialNumber:string;spaceNodeId:string;spaceName:string;
  ownerTenantId?:string;ownerTenantName?:string;
  protocolTemplate:string;communicationStatus:string;energyType:MeterEnergyType;
};
const auth=useAuthStore();
const route=useRoute();
const { t }=useI18n();
const loading=ref(true);const saving=ref(false);const dialogVisible=ref(false);const step=ref(0);
const advancedVisible=ref(false);
const mode=ref<WizardMode>('create');const relations=ref<EnergyRelation[]>([]);const tenants=ref<TenantRecord[]>([]);
const spaces=ref<ResourceNode[]>([]);const electricMeters=ref<MeterAsset[]>([]);const meters=ref<RelationMeter[]>([]);const tariffs=ref<TariffPlan[]>([]);
const usagePurposes=ref<DictionaryItem[]>([]);
const preview=ref<EnergyRelationSetupPreview|null>(null);const editing=ref<EnergyRelation|null>(null);
const form=reactive<any>(emptyForm());
const meterEnergyFilter=ref<MeterEnergyType>('ELECTRICITY');
const canView=computed(()=>auth.can(energyRelationPermissions.view));
const canSelectWaterMeters=computed(()=>auth.can(waterMeterPermissions.view));
const canAdvancedWorkspace=computed(()=>canView.value&&auth.canEnter(energyRelationPermissions.advanced)&&auth.can(meteringPermissions.view));
const activeMutationPermission=computed(()=>mode.value==='create'?energyRelationPermissions.create:energyRelationPermissions.change);
const energyRoleLabel=computed(()=>form.usagePurpose==='GENERATION'?'发电 / 输出':form.usagePurpose==='STORAGE'?'双向 / 充放电':'消耗 / 输入');

const allSpaces=computed(()=>flattenResources(spaces.value).filter(node=>node.status==='enabled'));
const selectedTenant=computed(()=>tenants.value.find(item=>item.id===String(form.tenantId)));
const availableSpaces=computed(()=>{
  if(form.relationType!=='CUSTOMER'||!selectedTenant.value)return allSpaces.value;
  const roots=selectedTenant.value.resourceNodeIds||[];
  return allSpaces.value.filter(node=>roots.some(root=>spaceContains(root,node.id)));
});
const spaceLocked=computed(()=>form.relationType==='CUSTOMER'&&(selectedTenant.value?.resourceNodeIds||[]).length===1);
const availableMeters=computed(()=>meters.value.filter(item=>item.energyType===meterEnergyFilter.value));
const meterEnergyCounts=computed(()=>({
  ELECTRICITY:meters.value.filter(item=>item.energyType==='ELECTRICITY').length,
  WATER:meters.value.filter(item=>item.energyType==='WATER').length,
}));
const currentMeter=computed(()=>meters.value.find(item=>item.id===String(form.meterId)));
const currentEnergyType=computed<MeterEnergyType>(()=>currentMeter.value?.energyType||(editing.value?.energyType==='WATER'?'WATER':meterEnergyFilter.value));
const activeTariffs=computed(()=>tariffs.value.filter(item=>item.energyType===currentEnergyType.value&&item.status==='ACTIVE'));
const usagePurposeOptions=computed(()=>usagePurposes.value.filter(item=>item.status==='ACTIVE'));
const currentTariff=computed(()=>tariffs.value.find(item=>item.id===Number(form.tariffPlanId)));
const keyword=ref('');const relationTypeFilter=ref('');const qualityFilter=ref('');
const filteredRelations=computed(()=>relations.value.filter(item=>{
  const normalized=keyword.value.trim().toLowerCase();
  const matchesKeyword=!normalized||[item.name,item.code,item.tenantName,item.spaceName,item.meterName].some(value=>String(value||'').toLowerCase().includes(normalized));
  return matchesKeyword&&(!relationTypeFilter.value||item.relationType===relationTypeFilter.value)&&(!qualityFilter.value||item.dataQualityStatus===qualityFilter.value);
}));
const {page,pageSize,pagedRows:pagedRelations}=useListPageState({rows:filteredRelations,resetDeps:()=>[keyword.value,relationTypeFilter.value,qualityFilter.value]});
const summary=computed(()=>({
  total:relations.value.length,
  active:relations.value.filter(item=>item.status==='ACTIVE').length,
  customer:relations.value.filter(item=>item.relationType==='CUSTOMER'&&item.status==='ACTIVE').length,
  common:relations.value.filter(item=>item.relationType!=='CUSTOMER'&&item.status==='ACTIVE').length,
  paused:relations.value.filter(item=>item.status==='ACTIVE'&&item.dataQualityStatus!=='HEALTHY').length,
}));

function emptyForm(){return {relationType:'CUSTOMER' as EnergyRelationType,tenantId:'',spaceNodeId:'',meterId:'',usagePurpose:'TENANT',readingSourceCode:'',tariffPlanId:'',settlementMode:'POSTPAID',billingCycle:'MONTHLY',initialReading:0,effectiveFrom:nowValue(),remark:'',changeReason:'',version:0};}
function nowValue(){const value=new Date(Date.now()-new Date().getTimezoneOffset()*60000);return value.toISOString().slice(0,19);}
function spaceContains(rootId:string,candidateId:string){
  const map=new Map(allSpaces.value.map(node=>[node.id,node]));let current=map.get(candidateId);
  while(current){if(current.id===rootId)return true;current=current.parentId?map.get(current.parentId):undefined;}return false;
}
function relationTypeLabel(value:string){return ({CUSTOMER:'客户用能',COMMON:'公共区域',SYSTEM:'设备系统'} as Record<string,string>)[value]||value;}
function relationTypeTone(value:string){return value==='CUSTOMER'?'primary':value==='SYSTEM'?'accent':'neutral';}
function relationDisplayName(row:EnergyRelation){
  if(row.relationType==='CUSTOMER')return [row.tenantName,row.spaceName,purposeLabel(row.usagePurpose||'TENANT')].filter(Boolean).join(' / ');
  return row.name;
}
function statusLabel(value?:string){return ({ACTIVE:'运行中',ENDED:'已终止',UNIQUE_MATCH:'已匹配',MULTIPLE_MATCHES:'待选择',PARTIAL_MATCH:'部分匹配',NO_MATCH:'无匹配',HEALTHY:'数据正常',STALE:'数据陈旧',MANUAL_REVIEW:'待复核'} as Record<string,string>)[value||'']||value||'--';}
function statusTone(value?:string){if(['ACTIVE','UNIQUE_MATCH','HEALTHY'].includes(value||''))return 'success';if(['PARTIAL_MATCH','MULTIPLE_MATCHES','STALE','MANUAL_REVIEW'].includes(value||''))return 'warning';if(['ENDED','NO_MATCH'].includes(value||''))return 'error';return 'neutral';}
function purposeLabel(value:string){return usagePurposes.value.find(item=>item.value===value)?.label||({TENANT:'客户用能',COMMON:'公共用能',HVAC:'空调系统能耗',LIGHTING:'照明系统能耗',PARKING:'停车场系统能耗',CHARGING:'充电桩能耗',GENERATION:'光伏发电',STORAGE:'储能',OTHER:'综合用能'} as Record<string,string>)[value]||value;}
function settlementLabel(value?:string){return ({PREPAID:'预付费',POSTPAID:'后付费',INTERNAL:'内部核算'} as Record<string,string>)[value||'']||value||'--';}
function sourceLabel(value?:string){return ({TOTAL_ACTIVE_ENERGY:'累计有功电能总',INTERVAL_ACTIVE_ENERGY:'15分钟有功电能曲线',TOU_5_PERIOD_REGISTERS:'尖峰平谷深谷寄存器组',TOTAL_WATER_VOLUME:'累计水量'} as Record<string,string>)[value||'']||value||'--';}
function unitSymbol(){return currentEnergyType.value==='WATER'?'m³':'kWh';}
function resetFilters(){keyword.value='';relationTypeFilter.value='';qualityFilter.value='';}
function formatDate(value?:string){return value?value.replace('T',' ').slice(0,16):'--';}
function spaceName(id:string){return id?getResourceBreadcrumb(spaces.value,id):'--';}

async function load(){if(!canView.value)return;loading.value=true;try{const [relationRows,tenantRows,spaceRows,meterRows,waterRows,tariffRows,purposeRows]=await Promise.all([energyRelationApi.list(),fetchAllPages((page,pageSize)=>fetchTenants({page,pageSize})),fetchSpaceTree(),fetchAllPages((page,pageSize)=>meterRepository.page({page,pageSize})),auth.can(waterMeterPermissions.view)?fetchAllPages((page,pageSize)=>waterMeterRepository.page({page,pageSize})):Promise.resolve([] as WaterMeterAsset[]),meteringApi.tariffs(),fetchRuntimeDictionary('ENERGY_USAGE_PURPOSE')]);relations.value=relationRows;tenants.value=tenantRows;spaces.value=spaceRows;electricMeters.value=meterRows;meters.value=[...meterRows.map(item=>({...item,energyType:'ELECTRICITY' as const})),...waterRows.map(item=>({...item,energyType:'WATER' as const}))];tariffs.value=tariffRows;usagePurposes.value=purposeRows;}catch(error){showError(error,'用能关系加载失败');}finally{loading.value=false;}}
function onRelationTypeChange(){form.tenantId='';form.spaceNodeId='';form.meterId='';form.usagePurpose=form.relationType==='CUSTOMER'?'TENANT':form.relationType==='COMMON'?'COMMON':'OTHER';preview.value=null;}
function onTenantChange(){const roots=selectedTenant.value?.resourceNodeIds||[];form.spaceNodeId=roots.length===1?roots[0]:'';preview.value=null;}
function onSpaceChange(){preview.value=null;}
function selectMeterEnergy(value:MeterEnergyType){
  if(meterEnergyFilter.value===value)return;
  meterEnergyFilter.value=value;
  if(currentMeter.value?.energyType!==value){form.meterId='';form.tariffPlanId='';preview.value=null;}
}
function openCreate(preferredEnergy:MeterEnergyType='ELECTRICITY'){if(!auth.canEnter(energyRelationPermissions.create))return;mode.value='create';editing.value=null;meterEnergyFilter.value=preferredEnergy;Object.assign(form,emptyForm());step.value=0;preview.value=null;dialogVisible.value=true;}
function openChange(row:EnergyRelation){if(!auth.canEnter(energyRelationPermissions.change))return;mode.value='change';editing.value=row;Object.assign(form,emptyForm(),{relationType:row.relationType,tenantId:row.tenantId?String(row.tenantId):'',spaceNodeId:String(row.spaceNodeId),meterId:row.meterId?String(row.meterId):'',usagePurpose:row.usagePurpose||(row.relationType==='CUSTOMER'?'TENANT':row.relationType==='COMMON'?'COMMON':'OTHER'),readingSourceCode:row.readingSourceCode||'',tariffPlanId:row.tariffPlanId?String(row.tariffPlanId):'',settlementMode:row.settlementMode||'POSTPAID',billingCycle:row.billingCycle||'MONTHLY',initialReading:row.initialReading||0,effectiveFrom:nowValue(),changeReason:'',version:row.version});meterEnergyFilter.value=row.energyType==='WATER'?'WATER':'ELECTRICITY';step.value=1;preview.value=null;dialogVisible.value=true;}
function openAdvanced(){if(!canAdvancedWorkspace.value)return;advancedVisible.value=true;}
function validateStep(index:number){
  if(index===0){if(!form.relationType)throw new Error('请选择计量对象类型');if(form.relationType==='CUSTOMER'&&!form.tenantId)throw new Error('请选择客户档案');if(!form.spaceNodeId)throw new Error('请选择使用空间');}
  if(index===1&&!form.meterId)throw new Error('请选择物理表计');
  if(index===2){if(!form.tariffPlanId)throw new Error('请选择计费方案');if(!form.settlementMode||!form.billingCycle)throw new Error('请完整设置结算方式');if(mode.value==='change'&&!form.changeReason.trim())throw new Error('请填写变更原因');}
}
function payload():EnergyRelationSetup{return {relationType:form.relationType,tenantId:form.relationType==='CUSTOMER'?Number(form.tenantId):null,spaceNodeId:Number(form.spaceNodeId),meterId:Number(form.meterId),usagePurpose:form.usagePurpose,readingSourceCode:form.readingSourceCode||null,tariffPlanId:Number(form.tariffPlanId),settlementMode:form.settlementMode,billingCycle:form.billingCycle,initialReading:Number(form.initialReading||0),effectiveFrom:form.effectiveFrom,remark:form.remark||null};}
async function next(){if(step.value===2&&!auth.can(activeMutationPermission.value))return;try{validateStep(step.value);if(step.value===2){await refreshPreview();step.value=3;return;}step.value=Math.min(3,step.value+1);}catch(error){ElMessage.warning(error instanceof Error?error.message:'请完整填写当前步骤');}}
async function refreshPreview(){preview.value=await energyRelationApi.preview(payload());if(preview.value.recommendedSourceCode)form.readingSourceCode=preview.value.recommendedSourceCode;}
async function chooseSource(){try{await refreshPreview();}catch(error){showError(error,'读数来源校验失败');}}
async function submit(){if(!auth.can(activeMutationPermission.value))return;if(!preview.value?.canActivate){ElMessage.warning(preview.value?.blockingReason||'当前配置不能开通');return;}saving.value=true;try{if(mode.value==='create')await energyRelationApi.create(payload());else if(editing.value)await energyRelationApi.change(editing.value.id,{meterId:Number(form.meterId),readingSourceCode:form.readingSourceCode||null,tariffPlanId:Number(form.tariffPlanId),settlementMode:form.settlementMode,billingCycle:form.billingCycle,initialReading:Number(form.initialReading||0),effectiveFrom:form.effectiveFrom,changeReason:form.changeReason.trim(),version:form.version});ElMessage.success(mode.value==='create'?'用能关系已开通':'关系新版本已生效，历史版本已保留');dialogVisible.value=false;await load();}catch(error){showError(error,mode.value==='create'?'开通失败':'变更失败');}finally{saving.value=false;}}
function validateEndReason(value:string){const normalized=value?.trim()||'';if(normalized.length<4||normalized.length>500||!/\p{L}/u.test(normalized))return '请输入 4 至 500 个字符，不能只填写数字或符号';return true;}
async function endRelation(row:EnergyRelation){if(!auth.can(energyRelationPermissions.end))return;try{const result=await ElMessageBox.prompt('终止后保留历史用量和计费快照，请填写退租或终止原因。','终止计费开通',{confirmButtonText:'确认终止',cancelButtonText:'取消',inputValidator:validateEndReason});await energyRelationApi.end(row.id,{effectiveTo:nowValue(),reason:result.value.trim(),version:row.version});ElMessage.success('计费开通已终止，历史版本已保留');await load();}catch(error:any){if(error==='cancel'||error==='close')return;showError(error,'终止失败');}}
function meterCompatible(item:RelationMeter){return form.relationType!=='CUSTOMER'||!form.tenantId||!item.ownerTenantId||item.ownerTenantId===String(form.tenantId);}
function meterStateTone(item:RelationMeter){return item.communicationStatus==='online'?'success':item.communicationStatus==='warning'?'warning':'neutral';}
function meterStateLabel(item:RelationMeter){const prefix=item.protocolTemplate?.toUpperCase().includes('SIMULATED')?'演示':'';return `${prefix}${item.communicationStatus==='online'?'在线':item.communicationStatus==='warning'?'告警':'离线'}`;}
function meterStateHint(item:RelationMeter){if(item.protocolTemplate?.toUpperCase().includes('SIMULATED'))return '当前读数来自隔离演示协议，不作为正式结算依据';if(item.communicationStatus!=='online')return '当前未取得在线状态；可预配置，确认启用前必须通过读数样本校验';return '';}
function showError(error:unknown,fallback:string){ElMessage.error(error instanceof ApiError?error.message:error instanceof Error?error.message:fallback);}
let handledIntent='';
function handleRouteIntent(){
  if(!auth.canEnter(energyRelationPermissions.create)||handledIntent===route.fullPath)return;
  const meterId=Array.isArray(route.query.meterId)?route.query.meterId[0]:route.query.meterId;
  const tenantId=Array.isArray(route.query.tenantId)?route.query.tenantId[0]:route.query.tenantId;
  if(!meterId&&!tenantId)return;
  const requestedEnergy=Array.isArray(route.query.energyType)?route.query.energyType[0]:route.query.energyType;
  openCreate(requestedEnergy==='WATER'?'WATER':'ELECTRICITY');
  const tenant=tenants.value.find(item=>item.id===tenantId);
  if(tenant){form.tenantId=tenant.id;onTenantChange();}
  const meter=meters.value.find(item=>item.id===meterId);
  if(meter){meterEnergyFilter.value=meter.energyType;form.meterId=meter.id;}
  handledIntent=route.fullPath;
}
onMounted(async()=>{
  if(!canView.value)return;
  await load();
  handleRouteIntent();
});
watch(()=>route.fullPath,()=>handleRouteIntent());
</script>

<template>
  <DsListPageShell title="计费开通" page-class="energy-relations-page ds-flow-list-page">
    <template #primary-action><div class="header-actions"><el-button :icon="Refresh" :loading="loading" :disabled="!canView" @click="load">刷新</el-button><el-button v-permission.preview="energyRelationPermissions.advanced" :icon="Setting" :disabled="!canAdvancedWorkspace" :title="t('energyRelations.advancedHint')" @click="openAdvanced">{{ t('energyRelations.advanced') }}</el-button><el-button v-permission.preview="energyRelationPermissions.create" type="primary" :icon="Plus" @click="openCreate()">新增计费开通</el-button></div></template>

    <template v-if="canView">
    <section class="relation-kpis"><article><span>关系总数</span><strong>{{ summary.total }}</strong></article><article><span>运行中</span><strong class="success">{{ summary.active }}</strong></article><article><span>客户用能</span><strong>{{ summary.customer }}</strong></article><article><span>公区 / 系统</span><strong>{{ summary.common }}</strong></article><article><span>结算暂停</span><strong :class="{ warning: summary.paused }">{{ summary.paused }}</strong></article></section>

    <section v-loading="loading" class="relation-table-card ds-list-embedded-section metering-list-workspace">
      <div class="relation-filter ds-list-filter ds-list-filter--adaptive"><el-input v-model="keyword" class="ds-list-filter__keyword" clearable placeholder="搜索用能对象 / 客户 / 空间 / 表计" /><el-select v-model="relationTypeFilter" class="ds-list-filter__select ds-list-filter__select--short" clearable placeholder="全部类型"><el-option label="客户用能" value="CUSTOMER" /><el-option label="公共区域" value="COMMON" /><el-option label="设备系统" value="SYSTEM" /></el-select><el-select v-model="qualityFilter" class="ds-list-filter__select" clearable placeholder="全部质量状态"><el-option label="数据正常" value="HEALTHY" /><el-option label="待复核" value="MANUAL_REVIEW" /><el-option label="数据陈旧" value="STALE" /></el-select><span class="ds-list-filter__spacer" aria-hidden="true"/><div class="ds-list-filter__actions"><el-button class="ds-list-filter__button filter-action" @click="resetFilters">重置</el-button></div></div>
      <section class="ds-list-table-shell ds-list-table-shell--embedded">
      <DsDataTable v-if="filteredRelations.length" :rows="pagedRelations as unknown as Record<string,unknown>[]" :columns="[]" row-key="id" class="relation-table">
        <el-table-column label="用能对象" min-width="160"><template #default="{ row }"><div class="primary-cell"><el-tooltip :content="relationDisplayName(row)" placement="top" :show-after="300"><strong class="cell-ellipsis">{{ relationDisplayName(row) }}</strong></el-tooltip><el-tooltip :content="row.code" placement="top" :show-after="300"><span class="cell-ellipsis">{{ row.code }}</span></el-tooltip></div></template></el-table-column>
        <el-table-column label="类型" width="82"><template #default="{ row }"><DsTag :type="relationTypeTone(row.relationType)" size="small">{{ relationTypeLabel(row.relationType) }}</DsTag></template></el-table-column>
        <el-table-column label="客户 / 空间" min-width="145"><template #default="{ row }"><div class="stack-cell"><el-tooltip :content="row.tenantName || '平台公共用能'" placement="top" :show-after="300"><span class="cell-ellipsis">{{ row.tenantName || '平台公共用能' }}</span></el-tooltip><el-tooltip :content="row.spaceName" placement="top" :show-after="300"><small class="cell-ellipsis">{{ row.spaceName }}</small></el-tooltip></div></template></el-table-column>
        <el-table-column label="表计 / 读数来源" min-width="155"><template #default="{ row }"><div class="stack-cell"><el-tooltip :content="row.meterName || '--'" placement="top" :show-after="300"><span class="cell-ellipsis">{{ row.meterName || '--' }}</span></el-tooltip><el-tooltip :content="sourceLabel(row.readingSourceCode)" placement="top" :show-after="300"><small class="cell-ellipsis">{{ sourceLabel(row.readingSourceCode) }}</small></el-tooltip></div></template></el-table-column>
        <el-table-column label="计费结算" min-width="132"><template #default="{ row }"><div class="stack-cell"><el-tooltip :content="row.tariffPlanName || '--'" placement="top" :show-after="300"><span class="cell-ellipsis">{{ row.tariffPlanName || '--' }}</span></el-tooltip><small class="cell-ellipsis">{{ settlementLabel(row.settlementMode) }} · {{ row.billingCycle==='MONTHLY'?'按月结算':row.billingCycle }}</small></div></template></el-table-column>
        <el-table-column label="质量状态" width="92"><template #default="{ row }"><DsTag :type="statusTone(row.dataQualityStatus)" size="small" dot>{{ statusLabel(row.dataQualityStatus) }}</DsTag></template></el-table-column>
        <el-table-column label="版本 / 生效" min-width="108"><template #default="{ row }"><div class="stack-cell"><span>版本 {{ row.revisionNo || '--' }}</span><small>{{ formatDate(row.validFrom) }}</small></div></template></el-table-column>
        <el-table-column label="状态" width="74"><template #default="{ row }"><DsTag :type="statusTone(row.status)" size="small">{{ statusLabel(row.status) }}</DsTag></template></el-table-column>
        <el-table-column label="操作" width="132" fixed="right"><template #default="{ row }"><div class="ds-row-actions"><el-button v-if="row.status==='ACTIVE'" v-permission.preview="energyRelationPermissions.change" text type="primary" @click="openChange(row)">变更</el-button><el-button v-if="row.status==='ACTIVE'" v-permission="energyRelationPermissions.end" text type="danger" @click="endRelation(row)">终止</el-button><span v-else>--</span></div></template></el-table-column>
      </DsDataTable>
      <footer v-if="filteredRelations.length" class="ds-list-table-footer ds-list-table-footer--pagination-only">
        <DsPagination v-model:page="page" v-model:page-size="pageSize" :total="filteredRelations.length" />
      </footer>
      <DsEmpty v-else-if="!loading" :description="relations.length?'没有符合筛选条件的用能关系。':'暂无用能关系。点击“开通用能关系”完成客户、公区或系统计量。'" />
      </section>
    </section>
    </template>
    <DsEmpty v-else :description="t('energyRelations.permissionDenied')" />

    <template #overlays>
      <el-dialog v-model="dialogVisible" width="min(980px, 92vw)" :close-on-click-modal="false" destroy-on-close class="relation-wizard-dialog">
        <template #header><div class="dialog-heading"><div><h2>{{ mode==='create'?'新增计费开通':'变更计费开通' }}</h2><p>{{ mode==='create'?'建立付费主体、空间、表计和费率的唯一结算关系':'换表或换价会追加新版本，不覆盖历史' }}</p></div><DsTag v-if="mode==='change'" type="warning">历史可追溯</DsTag></div></template>
        <div class="wizard-steps"><div v-for="(label,index) in ['计量对象','计量设备','计费结算','确认开通']" :key="label" :class="{active:step===index,done:step>index}"><strong>{{ index+1 }}</strong><span>{{ label }}</span></div></div>

        <section v-if="step===0" class="wizard-panel"><header><h3>选择计费主体与使用空间</h3><p>资产所有方只是台账归属；本向导是计费绑定的唯一写入入口。</p></header><el-form label-position="top" class="form-grid"><el-form-item label="计量对象"><el-radio-group v-model="form.relationType" :disabled="mode==='change'" @change="onRelationTypeChange"><el-radio-button label="CUSTOMER">客户用能</el-radio-button><el-radio-button label="COMMON">公共区域</el-radio-button><el-radio-button label="SYSTEM">设备系统</el-radio-button></el-radio-group></el-form-item><el-form-item v-if="form.relationType==='CUSTOMER'" label="客户档案" required><el-select v-model="form.tenantId" :disabled="mode==='change'" filterable placeholder="选择现有客户档案" @change="onTenantChange"><el-option v-for="item in tenants" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item><el-form-item label="使用空间" required><el-select v-model="form.spaceNodeId" :disabled="mode==='change'||spaceLocked" filterable placeholder="选择实际使用空间" @change="onSpaceChange"><el-option v-for="item in availableSpaces" :key="item.id" :label="getResourceBreadcrumb(spaces,item.id)" :value="item.id" /></el-select><small v-if="spaceLocked" class="field-hint">已按客户档案授权范围自动带入</small></el-form-item><el-form-item v-if="form.relationType==='SYSTEM'" label="计量用途" required><el-select v-model="form.usagePurpose"><el-option v-for="item in usagePurposeOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select><small class="field-hint">能源角色：{{ energyRoleLabel }}</small></el-form-item><el-form-item label="生效时间" required><el-date-picker v-model="form.effectiveFrom" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" :disabled="mode==='change'&&step===0" /></el-form-item></el-form></section>

        <section v-else-if="step===1" class="wizard-panel"><header><h3>选择物理表计</h3><p>安装空间是设备物理位置，服务空间是实际计量区域，两者可以不同。</p></header><div class="meter-energy-tabs" role="tablist" aria-label="表计能源类型"><button type="button" role="tab" :aria-selected="meterEnergyFilter==='ELECTRICITY'" :class="{active:meterEnergyFilter==='ELECTRICITY'}" @click="selectMeterEnergy('ELECTRICITY')"><span>电表</span><small>{{ meterEnergyCounts.ELECTRICITY }}</small></button><button v-if="canSelectWaterMeters" type="button" role="tab" :aria-selected="meterEnergyFilter==='WATER'" :class="{active:meterEnergyFilter==='WATER'}" @click="selectMeterEnergy('WATER')"><span>水表</span><small>{{ meterEnergyCounts.WATER }}</small></button></div><div class="meter-choice-grid"><button v-for="item in availableMeters" :key="item.id" type="button" :disabled="!meterCompatible(item)" :class="{selected:String(form.meterId)===item.id}" @click="form.meterId=item.id;form.tariffPlanId='';preview=null"><div><strong>{{ item.name }}</strong><DsTag :type="meterStateTone(item)" size="small" dot>{{ meterStateLabel(item) }}</DsTag></div><span>{{ item.code }} · {{ item.serialNumber }}</span><small>安装：{{ item.spaceName }} · {{ item.protocolTemplate || '未声明协议能力' }}</small><small v-if="meterStateHint(item)" class="meter-state-hint">{{ meterStateHint(item) }}</small><small v-if="!meterCompatible(item)" class="conflict-hint">资产所有方为 {{ item.ownerTenantName }}，不能绑定当前客户</small></button></div><DsEmpty v-if="!availableMeters.length" :description="meterEnergyFilter==='ELECTRICITY'?'暂无可用电表，请先登记电表资产。':'暂无可用水表，请先登记水表资产。'" /></section>

        <section v-else-if="step===2" class="wizard-panel"><header><h3>设置计费与结算</h3></header><el-form label-position="top" class="form-grid"><el-form-item label="计费方案" required><el-select v-model="form.tariffPlanId" filterable placeholder="选择同能源类型的有效计费方案"><el-option v-for="item in activeTariffs" :key="item.id" :label="`${item.name} · ${item.billingMode==='TIME_OF_USE'?'分时':'单一价格'}`" :value="String(item.id)" /></el-select></el-form-item><el-form-item label="结算方式" required><el-select v-model="form.settlementMode"><el-option label="后付费" value="POSTPAID" /><el-option label="预付费" value="PREPAID" /><el-option label="内部核算" value="INTERNAL" /></el-select></el-form-item><el-form-item label="账单周期" required><el-select v-model="form.billingCycle"><el-option label="每月" value="MONTHLY" /><el-option label="每两月" value="BIMONTHLY" /><el-option label="每季度" value="QUARTERLY" /></el-select></el-form-item><el-form-item :label="`初始表底 (${unitSymbol()})`" required><el-input-number v-model="form.initialReading" :min="0" :precision="3" controls-position="right" /></el-form-item><el-form-item v-if="mode==='change'" label="变更原因" required class="full"><el-input v-model="form.changeReason" maxlength="500" show-word-limit placeholder="例如：更换故障表计 / 执行新价格" /></el-form-item><el-form-item label="备注" class="full"><el-input v-model="form.remark" maxlength="500" show-word-limit placeholder="可选" /></el-form-item></el-form></section>

        <section v-else class="wizard-panel review-panel"><header><h3>确认用能关系</h3><p>确认后内部对象自动生成；读数匹配失败时不允许启用结算。</p></header><div v-if="preview" class="review-card"><dl><div><dt>计量对象</dt><dd>{{ relationTypeLabel(preview.relationType) }}</dd></div><div><dt>客户</dt><dd>{{ preview.tenantName || '平台公共用能' }}</dd></div><div><dt>使用空间</dt><dd>{{ preview.spaceName }}</dd></div><div><dt>物理表计</dt><dd>{{ preview.meterName }}</dd></div><div><dt>计费方案</dt><dd>{{ preview.tariffPlanName }}</dd></div><div><dt>结算方式</dt><dd>{{ settlementLabel(form.settlementMode) }}</dd></div></dl><div class="match-result"><div><span>来源匹配</span><DsTag :type="statusTone(preview.sourceMatchStatus)" dot>{{ statusLabel(preview.sourceMatchStatus) }}</DsTag></div><div><span>样本验证</span><DsTag :type="preview.sampleValidationStatus==='PASSED'?'success':'warning'" dot>{{ preview.sampleValidationStatus==='PASSED'?'已通过':'待验证' }}</DsTag></div><div><span>数据质量</span><DsTag :type="statusTone(preview.dataQualityStatus)" dot>{{ statusLabel(preview.dataQualityStatus) }}</DsTag></div></div><el-form-item v-if="preview.readingSources.length>1" label="选择读数来源"><el-select v-model="form.readingSourceCode" @change="chooseSource"><el-option v-for="item in preview.readingSources" :key="item.code" :label="item.name" :value="item.code" /></el-select></el-form-item><div v-else class="recommended-source"><span>读数来源</span><strong>{{ sourceLabel(preview.recommendedSourceCode) }}</strong></div><el-alert v-if="!preview.canActivate" :title="preview.blockingReason||'当前配置无法开通'" type="warning" :closable="false" show-icon /></div></section>

        <template #footer><div class="dialog-footer"><el-button v-if="step>0" @click="step--">上一步</el-button><span /><el-button @click="dialogVisible=false">取消</el-button><el-button v-if="step<3" type="primary" :disabled="step===2&&!auth.can(activeMutationPermission)" :title="step===2&&!auth.can(activeMutationPermission)?'当前账号没有执行该操作的权限':''" @click="next">下一步</el-button><el-button v-else v-permission="activeMutationPermission" type="primary" :loading="saving" :disabled="!preview?.canActivate" @click="submit">{{ mode==='create'?'确认开通计量':'确认变更并生效' }}</el-button></div></template>
      </el-dialog>
      <el-drawer v-model="advancedVisible" :title="t('energyRelations.advancedTitle')" size="min(1180px, 92vw)" destroy-on-close>
        <MeteringConfigurationPanel v-if="advancedVisible" :space-tree="spaces" :tenants="tenants" :meters="electricMeters" />
      </el-drawer>
    </template>
  </DsListPageShell>
</template>

<style scoped>
.header-actions,.row-actions,.dialog-footer{display:flex;align-items:center;gap:var(--space-2);white-space:nowrap}
.row-actions{justify-content:flex-start;gap:0}
.row-actions :deep(.el-button){margin:0;padding:0 3px;font-size:var(--ds-datatable-font)}
.relation-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin:8px 16px;border:1px solid var(--color-border-default);border-radius:var(--radius-md);background:var(--color-bg-surface);overflow:hidden}
.relation-kpis article{min-height:46px;padding:5px 10px;border-right:1px solid var(--color-border-default)}
.relation-kpis article:last-child{border:0}
.relation-kpis span{display:block;color:var(--color-text-secondary);font-size:var(--font-caption)}
.relation-kpis strong{display:block;margin-top:1px;color:var(--color-text-primary);font-size:17px;line-height:1}
.relation-kpis .success{color:var(--color-success-default)}
.relation-kpis .warning{color:var(--color-warning-default)}
.relation-filter{display:flex;justify-content:flex-start;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--color-border-default);background:var(--color-bg-muted);flex-wrap:wrap}
.relation-filter :deep(.el-input),.relation-filter :deep(.el-select){width:100%;min-width:0}
.filter-action{width:64px;margin:0}
.tenant-select-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;width:100%}
.primary-cell,.stack-cell{display:flex;flex-direction:column;gap:0;min-width:0}
.primary-cell>*,.stack-cell>*{min-width:0;max-width:100%}
.cell-ellipsis{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.primary-cell span,.stack-cell small{color:var(--color-text-secondary);font-size:11px;line-height:16px}
.relation-table{font-size:var(--ds-datatable-font)}
.dialog-heading{display:flex;align-items:flex-start;justify-content:space-between;padding-right:26px}
.dialog-heading h2{margin:0;font-size:18px}
.dialog-heading p{margin:4px 0 0;color:var(--color-text-secondary);font-size:12px}
.wizard-steps{display:grid;grid-template-columns:repeat(4,1fr);padding:6px 24px 14px;border-bottom:1px solid var(--color-border-default)}
.wizard-steps>div{position:relative;display:flex;align-items:center;gap:7px;color:var(--color-text-secondary);font-size:13px}
.wizard-steps>div:not(:last-child)::after{content:'';position:absolute;left:24px;right:10px;top:50%;height:1px;background:var(--color-border-default)}
.wizard-steps strong{z-index:1;display:grid;place-items:center;width:20px;height:20px;border:1px solid var(--color-border-default);border-radius:50%;background:var(--color-bg-surface);font-size:11px}
.wizard-steps span{z-index:1;padding-right:6px;background:var(--color-bg-surface)}
.wizard-steps .active,.wizard-steps .done{color:var(--color-primary-500)}
.wizard-steps .active strong,.wizard-steps .done strong{color:#fff;border-color:var(--color-primary-500);background:var(--color-primary-500)}
.wizard-steps .active::after,.wizard-steps .done::after{background:var(--color-primary-500)!important}
.wizard-panel{min-height:340px;padding:18px 24px}
.wizard-panel header{margin-bottom:16px}
.wizard-panel h3{margin:0;font-size:16px}
.wizard-panel header p{margin:4px 0 0;color:var(--color-text-secondary);font-size:12px}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 20px}
.form-grid :deep(.el-select),.form-grid :deep(.el-date-editor),.form-grid :deep(.el-input-number){width:100%}
.form-grid .full{grid-column:1/-1}
.field-hint{display:block;margin-top:4px;color:var(--color-success-default)}
.meter-energy-tabs{display:flex;align-items:center;width:max-content;margin-bottom:10px;padding:2px;border:1px solid var(--color-border-default);border-radius:var(--radius-md);background:var(--color-bg-muted)}
.meter-energy-tabs button{display:flex;align-items:center;gap:7px;min-width:94px;height:30px;padding:0 12px;border:0;border-radius:calc(var(--radius-md) - 2px);color:var(--color-text-secondary);background:transparent;cursor:pointer}
.meter-energy-tabs button.active{color:var(--color-primary-600);background:var(--color-bg-surface);box-shadow:0 1px 2px color-mix(in srgb,var(--color-text-primary) 10%,transparent)}
.meter-energy-tabs small{display:grid;place-items:center;min-width:18px;height:18px;padding:0 4px;border-radius:9px;color:inherit;background:var(--color-bg-muted);font-size:11px}
.meter-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.meter-choice-grid button{padding:12px;text-align:left;border:1px solid var(--color-border-default);border-radius:var(--radius-md);background:var(--color-bg-surface);cursor:pointer}
.meter-choice-grid button:hover,.meter-choice-grid button.selected{border-color:var(--color-primary-500);box-shadow:0 0 0 2px var(--color-primary-50)}
.meter-choice-grid button:disabled{cursor:not-allowed;opacity:.62}
.meter-choice-grid button>div{display:flex;align-items:center;justify-content:space-between;gap:10px}
.meter-choice-grid button>span,.meter-choice-grid button>small{display:block;margin-top:4px;color:var(--color-text-secondary);font-size:12px}
.meter-choice-grid .meter-state-hint{color:var(--color-warning-default)}
.meter-choice-grid .conflict-hint{color:var(--color-danger-500)}
.review-card{border:1px solid var(--color-border-default);border-radius:var(--radius-md);padding:14px}
.review-card dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0}
.review-card dt{color:var(--color-text-secondary);font-size:12px}
.review-card dd{margin:3px 0 0;font-weight:600}
.match-result{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0;padding:10px;background:var(--color-bg-muted);border-radius:var(--radius-md)}
.match-result>div{display:flex;align-items:center;justify-content:space-between;gap:8px}
.recommended-source{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:9px 12px;border:1px solid var(--color-border-default);border-radius:var(--radius-md)}
.dialog-footer span{flex:1}
@media(max-width:1180px){.relation-kpis{grid-template-columns:repeat(3,1fr)}.review-card dl{grid-template-columns:repeat(2,1fr)}}
</style>
