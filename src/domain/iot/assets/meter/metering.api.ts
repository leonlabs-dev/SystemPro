import { request, requestBlob } from '@/core/api/http-client';

export type MeteringAreaType = 'TENANT' | 'COMMON' | 'GENERATION' | 'STORAGE';
export type EnergyType = 'ELECTRICITY' | 'WATER' | 'COOLING' | 'HEATING' | 'GAS';
export type TariffPeriodType = 'SHARP_PEAK' | 'PEAK' | 'FLAT' | 'VALLEY' | 'DEEP_VALLEY';
export interface TariffPeriodRate { periodType:TariffPeriodType;unitPrice:number }
export interface TariffTimeRule { ruleName:string;seasonCode:string;monthFrom:number;monthTo:number;dayType:'ALL_DAYS'|'WORKDAY'|'WEEKEND'|'HOLIDAY';startMinute:number;endMinute:number;periodType:TariffPeriodType;priority:number }
export interface MeteringArea { id:number;code:string;name:string;areaType:MeteringAreaType;rootSpaceNodeId:number;rootSpaceName:string;tenantId?:number;tenantName?:string;effectiveFrom?:string;status:string;remark?:string;version:number }
export interface TariffPlan { id:number;code:string;name:string;energyType:EnergyType;billingMode:'FLAT'|'TIME_OF_USE';unitPrice:number;currency:string;regionCode?:string;customerCategory?:string;voltageLevel?:string;effectiveFrom:string;effectiveTo?:string;status:string;remark?:string;periodRates:TariffPeriodRate[];timeRules:TariffTimeRule[];version:number }
export interface MeteringPoint { id:number;code:string;name:string;meteringAreaId:number;meteringAreaName:string;spaceNodeId:number;spaceName:string;energyType:EnergyType;purposeType:string;flowDirection:string;settlementMode:string;unitSymbol:string;tariffPlanId?:number;tariffPlanName?:string;meterId?:number;meterName?:string;meterCategory?:'TOTAL'|'SUB';channelCode?:string;energyRelationId?:number;status:string;remark?:string;version:number }
export interface MeteringOverview { areaCount:number;pointCount:number;tariffCount:number;boundPointCount:number;tenantAreaCount:number;commonAreaCount:number }
export interface CustomerMeteringSetup { tenantId:number;rootSpaceNodeId:number;areaName:string;pointName:string;meterId:number;channelCode:string;tariffPlanId:number;settlementMode:string;remark?:string }
export interface CustomerMeteringSetupResult { area:MeteringArea;point:MeteringPoint }

export type EnergyRelationType='CUSTOMER'|'COMMON'|'SYSTEM';
export type SourceMatchStatus='UNIQUE_MATCH'|'MULTIPLE_MATCHES'|'PARTIAL_MATCH'|'NO_MATCH';
export type DataQualityStatus='HEALTHY'|'STALE'|'GAP'|'ROLLBACK'|'SPIKE'|'CLOCK_SKEW'|'MANUAL_REVIEW';
export interface ReadingSourceOption { code:string;name:string;sourceType:string;recommended:boolean }
export interface EnergyRelationSetup {
  relationType:EnergyRelationType;tenantId?:number|null;spaceNodeId:number;meterId:number;
  usagePurpose:string;readingSourceCode?:string|null;tariffPlanId:number;settlementMode:string;
  billingCycle:string;initialReading:number;effectiveFrom:string;remark?:string|null;
}
export interface EnergyRelationSetupPreview {
  relationType:EnergyRelationType;tenantId?:number;tenantName?:string;spaceNodeId:number;spaceName:string;
  meterId:number;meterName:string;energyType:EnergyType;unitSymbol:string;tariffPlanId:number;tariffPlanName:string;
  sourceMatchStatus:SourceMatchStatus;sampleValidationStatus:string;dataQualityStatus:DataQualityStatus;
  readingSources:ReadingSourceOption[];recommendedSourceCode?:string;canActivate:boolean;blockingReason?:string;
}
export interface EnergyRelation {
  id:number;code:string;name:string;relationType:EnergyRelationType;energyType:EnergyType;
  usagePurpose:string;
  tenantId?:number;tenantName?:string;spaceNodeId:number;spaceName:string;meteringAreaId:number;
  meteringPointId:number;usageItemName:string;relationVersionId?:number;revisionNo?:number;
  meterId?:number;meterName?:string;readingSourceCode?:string;tariffPlanId?:number;tariffPlanName?:string;
  settlementMode?:string;billingCycle?:string;initialReading?:number;sourceMatchStatus?:SourceMatchStatus;
  dataQualityStatus?:DataQualityStatus;validFrom?:string;validTo?:string;status:string;remark?:string;
  version:number;createdAt:string;updatedAt:string;
}
export interface EnergyRelationChange {
  meterId:number;readingSourceCode?:string|null;tariffPlanId:number;settlementMode:string;
  billingCycle:string;initialReading:number;effectiveFrom:string;changeReason:string;version:number;
}
export interface UsagePeriodBreakdown { periodType:TariffPeriodType;usageQuantity:number;unitPrice:number;amount:number }
export interface UsageBill {
  snapshotId?:number;billCode?:string;relationId:number;relationVersionId:number;relationName:string;
  relationType:EnergyRelationType;energyType:EnergyType;unitSymbol:string;tenantName?:string;spaceName:string;meterName:string;tariffPlanName:string;
  periodStart:string;periodEnd:string;startReading:number;endReading:number;usageQuantity:number;amount:number;
  currency:string;billStatus:string;sourceType:string;dataQualityStatus:DataQualityStatus;
  breakdown:UsagePeriodBreakdown[];
}

const base='/api/v1/metering';
export const meteringApi={
  overview:()=>request<MeteringOverview>(`${base}/overview`), areas:()=>request<MeteringArea[]>(`${base}/areas`), tariffs:()=>request<TariffPlan[]>(`${base}/tariffs`), points:()=>request<MeteringPoint[]>(`${base}/points`),
  createArea:(body:unknown)=>request<MeteringArea>(`${base}/areas`,{method:'POST',body:JSON.stringify(body)}), updateArea:(id:number,body:unknown)=>request<MeteringArea>(`${base}/areas/${id}`,{method:'PUT',body:JSON.stringify(body)}), deleteArea:(id:number,version:number)=>request<void>(`${base}/areas/${id}?version=${version}`,{method:'DELETE'}),
  createTariff:(body:unknown)=>request<TariffPlan>(`${base}/tariffs`,{method:'POST',body:JSON.stringify(body)}), updateTariff:(id:number,body:unknown)=>request<TariffPlan>(`${base}/tariffs/${id}`,{method:'PUT',body:JSON.stringify(body)}), deleteTariff:(id:number,version:number)=>request<void>(`${base}/tariffs/${id}?version=${version}`,{method:'DELETE'}),
  createPoint:(body:unknown)=>request<MeteringPoint>(`${base}/points`,{method:'POST',body:JSON.stringify(body)}), updatePoint:(id:number,body:unknown)=>request<MeteringPoint>(`${base}/points/${id}`,{method:'PUT',body:JSON.stringify(body)}), deletePoint:(id:number,version:number)=>request<void>(`${base}/points/${id}?version=${version}`,{method:'DELETE'}),
  setupCustomer:(body:CustomerMeteringSetup)=>request<CustomerMeteringSetupResult>(`${base}/customer-setups`,{method:'POST',body:JSON.stringify(body)}),
};

const relationBase='/api/v1/energy-relations';
export const energyRelationApi={
  list:()=>request<EnergyRelation[]>(relationBase),
  get:(id:number)=>request<EnergyRelation>(`${relationBase}/${id}`),
  preview:(body:EnergyRelationSetup)=>request<EnergyRelationSetupPreview>(`${relationBase}/setup-preview`,{method:'POST',body:JSON.stringify(body)}),
  create:(body:EnergyRelationSetup)=>request<EnergyRelation>(relationBase,{method:'POST',body:JSON.stringify(body)}),
  change:(id:number,body:EnergyRelationChange)=>request<EnergyRelation>(`${relationBase}/${id}/versions`,{method:'POST',body:JSON.stringify(body)}),
  end:(id:number,body:{effectiveTo:string;reason:string;version:number})=>request<EnergyRelation>(`${relationBase}/${id}/end`,{method:'POST',body:JSON.stringify(body)}),
};

const billBase='/api/v1/usage-bills';
export const usageBillingApi={
  current:()=>request<UsageBill[]>(`${billBase}/current`),
  snapshots:()=>request<UsageBill[]>(`${billBase}/snapshots`),
  createSnapshot:(relationId:number)=>request<UsageBill>(`${billBase}/relations/${relationId}/snapshots`,{method:'POST'}),
  export:(type:'current'|'snapshots')=>requestBlob(`${billBase}/export?type=${type}`),
};
