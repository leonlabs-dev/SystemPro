import { request,requestBlob } from '@/core/api/http-client';
import type { EnergyType,MeteringPoint } from '@/domain/iot/assets/meter';

export type TopologyRelationType='TOTAL_SUB'|'INPUT_OUTPUT'|'VIRTUAL_AGGREGATION';
export interface MeteringTopology {
  id:number;parentPointId:number;parentPointCode:string;parentPointName:string;parentMeterName?:string;
  childPointId:number;childPointCode:string;childPointName:string;childMeterName?:string;
  energyType:EnergyType;unitSymbol:string;relationType:TopologyRelationType;contributionFactor:number;
  validFrom:string;validTo?:string;status:string;remark?:string;version:number;createdAt:string;updatedAt:string;
}
export interface TopologyInput {
  parentPointId:number;childPointId:number;relationType:TopologyRelationType;contributionFactor:number;
  validFrom:string;remark?:string|null;version?:number;
}
export interface LossRow {
  parentPointId:number;parentPointName:string;parentMeterName?:string;energyType:EnergyType;unitSymbol:string;
  childCount:number;parentUsage:number;childUsage:number;lossQuantity:number;lossRate:number;status:string;
}
export interface LossAnalysis {
  periodStart:string;periodEnd:string;sourceType:string;totalInput:number;totalAllocated:number;
  totalLoss:number;overallLossRate:number;rows:LossRow[];
}
export interface SubitemEnergyReport {
  periodStart:string;periodEnd:string;energyType:EnergyType;sourceType:string;
  totalUsage:number;parentPointCount:number;subitemPointCount:number;rows:SubitemEnergyRow[];
}
export interface SubitemEnergyRow {
  topologyId:number;parentPointId:number;parentPointName:string;parentMeterName?:string;
  subitemPointId:number;subitemPointName:string;subitemMeterName?:string;relationType:TopologyRelationType;
  contributionFactor:number;rawUsage:number;adjustedUsage:number;unitSymbol:string;
  validFrom:string;validTo?:string;status:string;
}
export const submeteringApi={
  list:()=>request<MeteringTopology[]>('/api/v1/submetering/topologies'),
  availablePoints:()=>request<MeteringPoint[]>('/api/v1/submetering/topologies/available-points'),
  create:(body:TopologyInput)=>request<MeteringTopology>('/api/v1/submetering/topologies',{method:'POST',body:JSON.stringify(body)}),
  update:(id:number,body:TopologyInput)=>request<MeteringTopology>(`/api/v1/submetering/topologies/${id}`,{method:'PUT',body:JSON.stringify(body)}),
  end:(id:number,version:number)=>request<MeteringTopology>(`/api/v1/submetering/topologies/${id}/end?version=${version}`,{method:'POST'}),
};
function query(base:string,start?:string,end?:string,energyType?:string){const p=new URLSearchParams();if(start)p.set('periodStart',start);if(end)p.set('periodEnd',end);if(energyType)p.set('energyType',energyType);return `${base}?${p}`;}
export const lossAnalysisApi={
  analyze:(start?:string,end?:string,energyType?:string)=>request<LossAnalysis>(query('/api/v1/loss-analysis',start,end,energyType)),
  export:(start?:string,end?:string,energyType?:string)=>requestBlob(query('/api/v1/loss-analysis/export',start,end,energyType)),
};
export const subitemReportApi={
  report:(start?:string,end?:string,energyType?:string)=>request<SubitemEnergyReport>(query('/api/v1/subitem-energy-report',start,end,energyType)),
  export:(start?:string,end?:string,energyType?:string)=>requestBlob(query('/api/v1/subitem-energy-report/export',start,end,energyType)),
};
