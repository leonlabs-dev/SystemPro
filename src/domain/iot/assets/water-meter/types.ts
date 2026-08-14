import type { MeterAssetStatus, MeterCategory, MeterCommunicationStatus, MeterStatistics } from '../meter';

export interface WaterMeterAsset {
  id:string;ownerTenantId:string;ownerTenantName:string;spaceNodeId:string;spaceName:string;
  code:string;name:string;serialNumber:string;manufacturer:string;model:string;category:MeterCategory;
  nominalDiameter:string;measurementMedium:'cold_water'|'hot_water'|'reclaimed_water';
  meteringClass:string;pressureRating:string;pulseConstant?:number;
  installationDirection:'horizontal'|'vertical'|'any';valveControlSupported:boolean;
  remoteValveStatus:string;protocolTemplate:string;accessMode:string;deviceIdentifier:string;
  gatewayName:string;heartbeatSeconds?:number;communicationStatus:MeterCommunicationStatus;
  lastSeenAt?:string;installedAt?:string;status:MeterAssetStatus;remark:string;version:number;
  createdAt:string;updatedAt:string;
}
export interface WaterMeterMutationInput {
  code?:string;name:string;serialNumber:string;ownerTenantId?:string;spaceNodeId:string;
  manufacturer?:string;model:string;category:MeterCategory;nominalDiameter?:string;
  measurementMedium:WaterMeterAsset['measurementMedium'];meteringClass?:string;pressureRating?:string;
  pulseConstant?:number;installationDirection:WaterMeterAsset['installationDirection'];
  valveControlSupported:boolean;protocolTemplate?:string;accessMode?:string;deviceIdentifier?:string;
  gatewayName?:string;heartbeatSeconds?:number;installedAt?:string;status:MeterAssetStatus;
  remark?:string;version?:number;
}
export interface WaterMeterQuery {
  keyword?:string;status?:MeterAssetStatus|'';communicationStatus?:MeterCommunicationStatus|'';
  ownerTenantId?:string;spaceNodeId?:string;page?:number;pageSize?:number;
}
export interface WaterMeterPage {items:WaterMeterAsset[];total:number;page:number;pageSize:number}
export interface WaterMeterRepository {
  page(query?:WaterMeterQuery):Promise<WaterMeterPage>;statistics():Promise<MeterStatistics>;
  getById(id:string):Promise<WaterMeterAsset>;create(input:WaterMeterMutationInput):Promise<WaterMeterAsset>;
  update(id:string,input:WaterMeterMutationInput):Promise<WaterMeterAsset>;delete(id:string,version:number):Promise<void>;
}
