import { request } from '@/core/api/http-client';
import type { MeterStatistics } from '../meter';
import type { WaterMeterAsset,WaterMeterMutationInput,WaterMeterPage,WaterMeterQuery,WaterMeterRepository } from './types';

type Dto=Omit<WaterMeterAsset,'id'|'ownerTenantId'|'spaceNodeId'|'category'|'measurementMedium'|'installationDirection'|'status'|'communicationStatus'|'pulseConstant'> & {
  id:number;ownerTenantId?:number;spaceNodeId:number;category:string;measurementMedium:string;
  installationDirection:string;status:string;communicationStatus:string;pulseConstant?:number;
};
interface PageDto<T>{items:T[];total:number;page:number;pageSize:number}
const base='/api/v1/water-meters';
export const waterMeterRepository:WaterMeterRepository={
  async page(query:WaterMeterQuery={}):Promise<WaterMeterPage>{
    const params=new URLSearchParams();
    if(query.keyword)params.set('keyword',query.keyword);
    if(query.status)params.set('status',query.status.toUpperCase());
    if(query.communicationStatus)params.set('communicationStatus',query.communicationStatus.toUpperCase());
    if(query.ownerTenantId)params.set('ownerTenantId',query.ownerTenantId);
    if(query.spaceNodeId)params.set('spaceNodeId',query.spaceNodeId);
    params.set('page',String(query.page||1));params.set('pageSize',String(query.pageSize||20));
    const result=await request<PageDto<Dto>>(`${base}?${params}`);
    return {...result,items:result.items.map(toAsset)};
  },
  statistics:()=>request<MeterStatistics>(`${base}/statistics`),
  async getById(id){return toAsset(await request<Dto>(`${base}/${id}`));},
  async create(input){return toAsset(await request<Dto>(base,{method:'POST',body:JSON.stringify(payload(input))}));},
  async update(id,input){return toAsset(await request<Dto>(`${base}/${id}`,{method:'PUT',body:JSON.stringify(payload(input))}));},
  delete:(id,version)=>request<void>(`${base}/${id}?version=${version}`,{method:'DELETE'}),
};
function toAsset(dto:Dto):WaterMeterAsset{return {
  ...dto,id:String(dto.id),ownerTenantId:dto.ownerTenantId?String(dto.ownerTenantId):'',
  ownerTenantName:dto.ownerTenantName||'',spaceNodeId:String(dto.spaceNodeId),
  category:dto.category.toLowerCase() as WaterMeterAsset['category'],
  measurementMedium:dto.measurementMedium.toLowerCase() as WaterMeterAsset['measurementMedium'],
  installationDirection:dto.installationDirection.toLowerCase() as WaterMeterAsset['installationDirection'],
  communicationStatus:dto.communicationStatus.toLowerCase() as WaterMeterAsset['communicationStatus'],
  status:dto.status.toLowerCase() as WaterMeterAsset['status'],pulseConstant:dto.pulseConstant?Number(dto.pulseConstant):undefined,
};}
function payload(input:WaterMeterMutationInput){return {
  ...input,code:input.code||null,ownerTenantId:input.ownerTenantId?Number(input.ownerTenantId):null,
  spaceNodeId:Number(input.spaceNodeId),category:input.category.toUpperCase(),
  measurementMedium:input.measurementMedium.toUpperCase(),installationDirection:input.installationDirection.toUpperCase(),
  status:input.status.toUpperCase(),installedAt:input.installedAt||null,heartbeatSeconds:input.heartbeatSeconds||null,
};}
