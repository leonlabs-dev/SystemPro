<script setup lang="ts">
import { Delete, Plus, Refresh } from '@element-plus/icons-vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { ApiError } from '@/core/api/contracts';
import { useAuthStore } from '@/core/auth/auth.store';
import DsEmpty from '@/design-system/components/DsEmpty.vue';
import DsDataTable from '@/design-system/components/DsDataTable.vue';
import DsListPageShell from '@/design-system/components/DsListPageShell.vue';
import DsPagination from '@/design-system/components/DsPagination.vue';
import DsTag from '@/design-system/components/DsTag.vue';
import { useListPageState } from '@/design-system/composables/useListPageState';
import {
  meteringApi,
  tariffPlanPermissions,
  type TariffPeriodRate,
  type TariffPeriodType,
  type TariffPlan,
  type TariffTimeRule,
} from '@/domain/iot/assets/meter';

interface TariffForm {
  code:string;name:string;energyType:'ELECTRICITY'|'WATER';billingMode:'FLAT'|'TIME_OF_USE';unitPrice:number;effectiveFrom:string;
  effectiveTo:string;status:string;remark:string;version?:number;
  periodRates:TariffPeriodRate[];timeRules:TariffTimeRule[];
}

const auth=useAuthStore();
const loading=ref(true);const saving=ref(false);const dialogVisible=ref(false);
const editingId=ref<number>();const tariffs=ref<TariffPlan[]>([]);
const keyword=ref('');const statusFilter=ref('');
const form=reactive<TariffForm>(emptyForm());
const canView=computed(()=>auth.can(tariffPlanPermissions.view));
const activeMutationPermission=computed(()=>editingId.value?tariffPlanPermissions.update:tariffPlanPermissions.create);
const filteredTariffs=computed(()=>tariffs.value.filter(item=>{
  const normalized=keyword.value.trim().toLowerCase();
  return (!normalized||[item.name,item.code].some(value=>String(value||'').toLowerCase().includes(normalized)))&&(!statusFilter.value||item.status===statusFilter.value);
}));
const {page,pageSize,pagedRows:pagedTariffs}=useListPageState({rows:filteredTariffs,resetDeps:()=>[keyword.value,statusFilter.value]});
const periodOptions:Array<{value:TariffPeriodType;label:string}>= [
  {value:'SHARP_PEAK',label:'尖峰'},{value:'PEAK',label:'高峰'},{value:'FLAT',label:'平段'},
  {value:'VALLEY',label:'低谷'},{value:'DEEP_VALLEY',label:'深谷'},
];

function defaultRates():TariffPeriodRate[]{return [
  {periodType:'SHARP_PEAK',unitPrice:1.35},{periodType:'PEAK',unitPrice:1.05},
  {periodType:'FLAT',unitPrice:.72},{periodType:'VALLEY',unitPrice:.42},{periodType:'DEEP_VALLEY',unitPrice:.28},
]}
function defaultRules():TariffTimeRule[]{return [
  rule('深谷时段',0,420,'DEEP_VALLEY',10),rule('早高峰',420,600,'PEAK',20),
  rule('上午平段',600,720,'FLAT',30),rule('午间低谷',720,840,'VALLEY',40),
  rule('下午平段',840,1080,'FLAT',50),rule('晚间尖峰',1080,1260,'SHARP_PEAK',60),
  rule('夜间高峰',1260,1380,'PEAK',70),rule('夜间深谷',1380,1440,'DEEP_VALLEY',80),
]}
function rule(name:string,startMinute:number,endMinute:number,periodType:TariffPeriodType,priority:number):TariffTimeRule{
  return {ruleName:name,seasonCode:'ALL_YEAR',monthFrom:1,monthTo:12,dayType:'ALL_DAYS',startMinute,endMinute,periodType,priority};
}
function emptyForm():TariffForm{return {code:'',name:'',energyType:'ELECTRICITY',billingMode:'TIME_OF_USE',unitPrice:.72,effectiveFrom:new Date().toISOString().slice(0,10),effectiveTo:'',status:'ACTIVE',remark:'',periodRates:defaultRates(),timeRules:defaultRules()}}

async function load(){if(!canView.value)return;loading.value=true;try{tariffs.value=await meteringApi.tariffs()}catch(e){showError(e,'计费方案加载失败')}finally{loading.value=false}}
function openCreate(){if(!auth.canEnter(tariffPlanPermissions.create))return;editingId.value=undefined;Object.assign(form,emptyForm());dialogVisible.value=true}
function openEdit(item:TariffPlan){
  if(!auth.canEnter(tariffPlanPermissions.update))return;
  editingId.value=item.id;Object.assign(form,{code:item.code,name:item.name,energyType:item.energyType,billingMode:item.billingMode,unitPrice:item.unitPrice,
    effectiveFrom:item.effectiveFrom,effectiveTo:item.effectiveTo||'',status:item.status,remark:item.remark||'',version:item.version,
    periodRates:item.periodRates.map(x=>({...x})),timeRules:item.timeRules.map(x=>({...x}))});dialogVisible.value=true;
}
function addRule(){if(!auth.canEnter(activeMutationPermission.value))return;const last=form.timeRules[form.timeRules.length-1];const start=last?.endMinute||0;form.timeRules.push(rule(`时段 ${form.timeRules.length+1}`,start,Math.min(1440,start+60),'FLAT',(form.timeRules.length+1)*10))}
function removeRule(index:number){if(!auth.canEnter(activeMutationPermission.value))return;form.timeRules.splice(index,1)}
function minuteLabel(value:number){const hour=Math.floor(value/60);const minute=value%60;return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`}
function modeLabel(mode:string){return mode==='TIME_OF_USE'?'分时电价':'单一电价'}
function unit(item:{energyType:string}){return item.energyType==='WATER'?'m³':'kWh'}
function onEnergyChange(){if(form.energyType==='WATER')form.billingMode='FLAT'}
function rateFor(item:TariffPlan,type:TariffPeriodType){return item.periodRates.find(x=>x.periodType===type)?.unitPrice}

async function save(){
  if(!auth.can(activeMutationPermission.value))return;
  if(!form.name.trim()){ElMessage.warning('请填写方案名称');return}
  const payload={...form,currency:'CNY',effectiveTo:form.effectiveTo||null,
    periodRates:form.billingMode==='TIME_OF_USE'?form.periodRates:[],timeRules:form.billingMode==='TIME_OF_USE'?form.timeRules:[]};
  saving.value=true;try{
    if(editingId.value)await meteringApi.updateTariff(editingId.value,payload);else await meteringApi.createTariff(payload);
    dialogVisible.value=false;await load();ElMessage.success(editingId.value?'计费方案已更新':'计费方案已创建');
  }catch(e){showError(e,'计费方案保存失败')}finally{saving.value=false}
}
async function remove(item:TariffPlan){if(!auth.can(tariffPlanPermissions.delete))return;try{await ElMessageBox.confirm(`确认删除“${item.name}”？已被用能关系引用的方案不会被删除。`,'删除计费方案',{type:'warning'});await meteringApi.deleteTariff(item.id,item.version);await load();ElMessage.success('已删除')}catch(e){if(e==='cancel'||e==='close')return;showError(e,'删除失败')}}
function showError(error:unknown,fallback:string){if(error instanceof ApiError){ElMessage.error(error.message);return}ElMessage.error(fallback)}
onMounted(load);
</script>

<template>
  <DsListPageShell title="计费方案" page-class="tariff-page ds-flow-list-page">
    <template #primary-action><div class="header-actions"><el-button :icon="Refresh" :loading="loading" :disabled="!canView" @click="load">刷新</el-button><el-button v-permission.preview="tariffPlanPermissions.create" type="primary" :icon="Plus" @click="openCreate">新增方案</el-button></div></template>

    <div v-if="canView" v-loading="loading" class="tariff-content ds-list-embedded-section metering-list-workspace">
      <div class="tariff-filter ds-list-filter ds-list-filter--adaptive"><el-input v-model="keyword" class="ds-list-filter__keyword" clearable placeholder="搜索方案名称 / 编码" /><el-select v-model="statusFilter" class="ds-list-filter__select ds-list-filter__select--short" clearable placeholder="全部状态"><el-option label="启用" value="ACTIVE" /><el-option label="停用" value="DISABLED" /></el-select><span class="ds-list-filter__spacer" aria-hidden="true"/><div class="ds-list-filter__actions"><el-button class="ds-list-filter__button filter-action" @click="keyword='';statusFilter=''">重置</el-button></div></div>
      <section class="ds-list-table-shell ds-list-table-shell--embedded">
      <DsDataTable v-if="filteredTariffs.length" :rows="pagedTariffs as unknown as Record<string,unknown>[]" :columns="[]" row-key="id" class="tariff-table">
        <el-table-column label="方案" min-width="210"><template #default="{row}"><div class="primary-cell"><strong>{{ row.name }}</strong><span>{{ row.code }}</span></div></template></el-table-column>
        <el-table-column label="能源" width="72"><template #default="{row}">{{ row.energyType==='WATER'?'水':'电' }}</template></el-table-column>
        <el-table-column label="计价模式" width="112"><template #default="{row}"><DsTag :type="row.billingMode==='TIME_OF_USE'?'primary':'neutral'">{{ modeLabel(row.billingMode) }}</DsTag></template></el-table-column>
        <el-table-column label="价格" min-width="340"><template #default="{row}"><div v-if="row.billingMode==='TIME_OF_USE'" class="rate-line"><span v-for="option in periodOptions" :key="option.value"><i>{{ option.label }}</i><b>{{ rateFor(row,option.value)?.toFixed(4) ?? '--' }}</b></span></div><span v-else>{{ Number(row.unitPrice).toFixed(4) }} 元/{{ unit(row) }}</span></template></el-table-column>
        <el-table-column label="生效区间" min-width="155"><template #default="{row}">{{ row.effectiveFrom }} 至 {{ row.effectiveTo||'长期' }}</template></el-table-column>
        <el-table-column label="状态" width="84"><template #default="{row}"><DsTag :type="row.status==='ACTIVE'?'success':'neutral'">{{ row.status==='ACTIVE'?'启用':'停用' }}</DsTag></template></el-table-column>
        <el-table-column label="操作" width="132" fixed="right"><template #default="{row}"><div class="ds-row-actions tariff-row-actions"><el-button v-permission.preview="tariffPlanPermissions.update" text @click="openEdit(row)">编辑</el-button><el-button v-permission="tariffPlanPermissions.delete" text type="danger" @click="remove(row)">删除</el-button></div></template></el-table-column>
      </DsDataTable>
      <footer v-if="filteredTariffs.length" class="ds-list-table-footer ds-list-table-footer--pagination-only">
        <DsPagination v-model:page="page" v-model:page-size="pageSize" :total="filteredTariffs.length" />
      </footer>
      <DsEmpty v-else-if="!loading" :description="tariffs.length?'没有符合筛选条件的计费方案。':'暂无计费方案，请先建立结算价格。'" />
      </section>
    </div>
    <DsEmpty v-else description="当前角色未获得查看计费方案的权限" />

    <template #overlays>
      <el-dialog v-model="dialogVisible" :title="editingId?'编辑计费方案':'新增计费方案'" width="min(860px, calc(100vw - 32px))" align-center destroy-on-close class="tariff-plan-dialog">
        <el-alert v-if="editingId" type="info" :closable="false" show-icon title="如果方案已被用能关系引用，系统会拒绝覆盖价格；请新建方案并在用能关系中执行换价。" />
        <el-form label-position="top" class="tariff-form">
          <div class="form-grid">
            <el-form-item label="方案编码"><el-input v-model="form.code" :disabled="!!editingId" placeholder="留空自动生成" /></el-form-item>
            <el-form-item label="方案名称" required><el-input v-model="form.name" placeholder="例如：上海商业五段电价 2026" /></el-form-item>
            <el-form-item label="能源类型" required><el-radio-group v-model="form.energyType" :disabled="!!editingId" @change="onEnergyChange"><el-radio-button label="ELECTRICITY">电</el-radio-button><el-radio-button label="WATER">水</el-radio-button></el-radio-group></el-form-item>
            <el-form-item label="计价模式" required><el-radio-group v-model="form.billingMode"><el-radio-button label="TIME_OF_USE" :disabled="form.energyType!=='ELECTRICITY'">分时电价</el-radio-button><el-radio-button label="FLAT">单一价格</el-radio-button></el-radio-group></el-form-item>
            <el-form-item v-if="form.billingMode==='FLAT'" :label="`单价（元/${form.energyType==='WATER'?'m³':'kWh'}）`" required><el-input-number v-model="form.unitPrice" :min="0" :precision="6" :step=".01" /></el-form-item>
            <el-form-item label="生效日期" required><el-date-picker v-model="form.effectiveFrom" type="date" value-format="YYYY-MM-DD" /></el-form-item>
            <el-form-item label="结束日期"><el-date-picker v-model="form.effectiveTo" type="date" value-format="YYYY-MM-DD" clearable /></el-form-item>
          </div>

          <section v-if="form.billingMode==='TIME_OF_USE'" class="config-section">
            <header><div><h3>五段价格</h3><p>未使用的时段仍保留价格定义，便于政策切换和历史版本比对。</p></div></header>
            <div class="rate-editor"><el-form-item v-for="(item,index) in form.periodRates" :key="item.periodType" :label="periodOptions.find(x=>x.value===item.periodType)?.label"><el-input-number v-model="form.periodRates[index].unitPrice" :min="0" :precision="6" :step=".01" controls-position="right" /></el-form-item></div>
          </section>

          <section v-if="form.billingMode==='TIME_OF_USE'" class="config-section">
            <header><div><h3>全年日时段</h3><p>规则必须从 00:00 连续覆盖至 24:00，不重叠、不留空。</p></div><el-button v-permission.preview="activeMutationPermission" :icon="Plus" @click="addRule">增加时段</el-button></header>
            <el-table :data="form.timeRules" size="small" class="rule-table">
              <el-table-column label="时段名称" min-width="150"><template #default="{row}"><el-input v-model="row.ruleName" /></template></el-table-column>
              <el-table-column label="开始（分钟）" width="126"><template #default="{row}"><el-input-number v-model="row.startMinute" :min="0" :max="1439" :controls="false" /><small>{{ minuteLabel(row.startMinute) }}</small></template></el-table-column>
              <el-table-column label="结束（分钟）" width="126"><template #default="{row}"><el-input-number v-model="row.endMinute" :min="1" :max="1440" :controls="false" /><small>{{ minuteLabel(row.endMinute) }}</small></template></el-table-column>
              <el-table-column label="电价时段" width="132"><template #default="{row}"><el-select v-model="row.periodType"><el-option v-for="item in periodOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select><small class="rule-cell-placeholder" aria-hidden="true">&nbsp;</small></template></el-table-column>
              <el-table-column label="操作" width="52" align="center"><template #default="{$index}"><el-button v-permission.preview="activeMutationPermission" text type="danger" :icon="Delete" @click="removeRule($index)" /></template></el-table-column>
            </el-table>
          </section>
          <el-form-item label="状态"><el-select v-model="form.status"><el-option label="启用" value="ACTIVE" /><el-option label="停用" value="DISABLED" /></el-select></el-form-item>
          <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit /></el-form-item>
        </el-form>
        <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button v-permission="activeMutationPermission" type="primary" :loading="saving" @click="save">保存方案</el-button></template>
      </el-dialog>
    </template>
  </DsListPageShell>
</template>

<style scoped>
.header-actions,.row-actions{display:flex;align-items:center;gap:var(--space-2);white-space:nowrap}
.boundary{display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--color-border-default);background:var(--color-bg-muted)}
.boundary strong{font-size:var(--ds-datatable-font)}
.boundary span{color:var(--color-text-secondary);font-size:var(--font-caption)}
.tariff-filter{display:flex;justify-content:flex-start;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--color-border-default);flex-wrap:wrap}
.tariff-filter :deep(.el-input),.tariff-filter :deep(.el-select){width:100%;min-width:0}
.filter-action{width:64px;margin:0}
.primary-cell{display:flex;flex-direction:column;gap:2px}
.primary-cell span{color:var(--color-text-secondary);font-size:12px}
.rate-line{display:grid;grid-template-columns:repeat(5,minmax(58px,1fr));gap:6px}
.rate-line span{display:flex;flex-direction:column;gap:2px}
.rate-line i{font-style:normal;color:var(--color-text-secondary);font-size:11px}
.rate-line b{font-weight:600}
.tariff-table{font-size:var(--ds-datatable-font)}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}
.tariff-form :deep(.el-form-item){margin-bottom:10px}
.tariff-form :deep(.el-input-number),.tariff-form :deep(.el-date-editor),.tariff-form :deep(.el-select){width:100%}
.config-section{margin:6px 0 10px;padding:10px;border:1px solid var(--color-border-default);border-radius:var(--radius-md);background:var(--color-bg-surface)}
.config-section>header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px}
.config-section h3,.config-section p{margin:0}
.config-section h3{font-size:15px}
.config-section p{margin-top:3px;color:var(--color-text-secondary);font-size:12px}
.rate-editor{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.rate-editor :deep(.el-form-item){margin-bottom:0}
.rule-table{border:1px solid var(--color-border-default);border-radius:var(--radius-sm)}
.rule-table :deep(.el-input-number),.rule-table :deep(.el-select){width:100%}
.rule-table :deep(.el-input__wrapper){min-height:32px}
.rule-table :deep(.el-table__cell){padding:4px 0;vertical-align:top}
.rule-table small{display:block;margin-top:2px;color:var(--color-text-secondary);font-size:11px;line-height:1.2}
.rule-cell-placeholder{visibility:hidden}
.tariff-row-actions{width:100%;justify-content:flex-start;flex-wrap:nowrap;gap:0}
.tariff-row-actions :deep(.el-button){flex:0 0 auto;margin:0;padding:0 3px;font-size:var(--ds-datatable-font)}
:global(.tariff-plan-dialog .el-dialog__body){max-height:calc(100vh - 150px);padding-top:12px;overflow:auto}
:global(.tariff-plan-dialog .el-dialog__footer){padding-top:8px}
:global(.tariff-plan-dialog .el-input__wrapper),:global(.tariff-plan-dialog .el-select__wrapper),:global(.tariff-plan-dialog .el-input-number){min-height:30px;height:30px;font-size:12px}
@media(max-width:1000px){.rate-editor{grid-template-columns:repeat(3,1fr)}.form-grid{grid-template-columns:1fr}.boundary{align-items:flex-start;flex-direction:column;gap:4px}}
</style>
