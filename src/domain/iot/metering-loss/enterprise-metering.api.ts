import { request } from '@/core/api/http-client';

export interface MeteringModelVersion {
  id:number;code:string;name:string;energyMedium:string;status:string;
  effectiveFrom:string;effectiveTo?:string;publishedAt?:string;version:number;
}

export interface EnterpriseMeteringOverview {
  physicalNodeCount:number;meteredNodeCount:number;accountingNodeCount:number;coveredNodeCount:number;
  coverageRate:number;subitemRate:number;unexplainedQuantity:number;unexplainedRate:number;
  qualityIssueCount:number;unitSymbol:string;sourceBoundary:string;
  topologyVersion:MeteringModelVersion;accountingVersion:MeteringModelVersion;
}

export interface PhysicalMeteringNode {
  id:number;code:string;name:string;typeCode:string;typeName:string;role:string;
  meteringPointId?:number;meteringPointName?:string;spaceNodeId?:number;spaceName?:string;
  tenantId?:number;tenantName?:string;status:string;sortOrder:number;version:number;
}

export interface PhysicalMeteringEdge {
  id:number;fromNodeId:number;toNodeId:number;connectionType:string;status:string;sortOrder:number;version:number;
}

export interface PhysicalNodeTypeOption {code:string;name:string;role:string;modelDomain:string}
export interface PhysicalNodeInput {code:string;name:string;typeCode:string;meteringPointId?:number;spaceNodeId?:number;tenantId?:number;sortOrder:number;remark?:string;version?:number}
export interface PhysicalEdgeInput {fromNodeId:number;toNodeId:number;connectionType:string;sortOrder:number;remark?:string}

export interface PhysicalMeteringTopology {
  version:MeteringModelVersion;nodes:PhysicalMeteringNode[];edges:PhysicalMeteringEdge[];validationIssues:string[];
}

export interface AccountingMeteringNode {
  id:number;parentId?:number;code:string;name:string;dimensionType:string;calculationMethod:string;
  meteringPointId?:number;meteringPointName?:string;contributionFactor:number;usage:number;shareRate:number;
  coverageRequired:boolean;unitSymbol:string;qualityStatus:string;status:string;sortOrder:number;version:number;
  children:AccountingMeteringNode[];
}

export interface MeteringPointOption {
  id:number;code:string;name:string;unitSymbol:string;spaceName?:string;status:string;
}

export interface AccountingVersionInput {
  name:string;effectiveFrom:string;copyFromVersionId?:number;remark?:string;
}

export interface AccountingNodeInput {
  parentId?:number;code:string;name:string;dimensionType:string;calculationMethod:string;
  meteringPointId?:number;contributionFactor:number;coverageRequired:boolean;sortOrder:number;
  remark?:string;version?:number;
}

export interface MeteringValidationResult {valid:boolean;issues:string[]}

export interface AccountingMeteringTree {
  version:MeteringModelVersion;nodeCount:number;measuredNodeCount:number;coveredNodeCount:number;
  coverageRate:number;subitemRate:number;unexplainedQuantity:number;unexplainedRate:number;
  sourceBoundary:string;validationIssues:string[];roots:AccountingMeteringNode[];
}

export interface BalanceMeteringRow {
  id:number;code:string;name:string;inputQuantity:number;outputQuantity:number;inputAdjustment:number;
  outputAdjustment:number;balanceDifference:number;recognizedTechnicalLoss:number;unexplainedQuantity:number;
  unexplainedRate:number;warningRate:number;criticalRate:number;unitSymbol:string;status:string;
  inputMemberCount:number;outputMemberCount:number;
}

export interface BalanceMeteringAnalysis {
  periodStart:string;periodEnd:string;sourceBoundary:string;totalInput:number;totalOutput:number;
  totalApprovedAdjustments:number;totalUnexplained:number;overallUnexplainedRate:number;rows:BalanceMeteringRow[];
}

export interface BoundaryAdjustmentRecord {
  id:number;balanceGroupId:number;balanceGroupName:string;code:string;adjustmentType:string;
  balanceSide:string;quantity:number;unitSymbol:string;periodStart:string;periodEnd:string;
  sourceType:string;reason:string;evidenceReference:string;approvalStatus:string;
  requestedBy:number;approvedBy?:number;approvedAt?:string;reviewComment?:string;
  version:number;createdAt:string;
}

export interface BoundaryAdjustmentInput {
  balanceGroupId:number;adjustmentType:string;balanceSide:string;quantity:number;
  periodStart:string;periodEnd:string;sourceType:string;reason:string;evidenceReference:string;
}

export interface MeteringUsageRow {
  nodeId:number;nodeName:string;dimensionType:string;calculationMethod:string;usage:number;
  shareRate:number;unitSymbol:string;qualityStatus:string;
}

export interface MeteringUsageAnalysis {
  periodStart:string;periodEnd:string;totalUsage:number;unitSymbol:string;sourceBoundary:string;rows:MeteringUsageRow[];
}

export interface MeteringQualityRow {
  intervalEnergyId?:number;meteringPointId:number;pointCode:string;pointName:string;meterName?:string;intervalStart?:string;intervalEnd?:string;
  rawQuantity:number;correctedQuantity:number;settlementQuantity:number;correctionQuantity:number;unitSymbol:string;
  sourceType:string;qualityStatus:string;correctionId?:number;correctionType?:string;correctionStatus?:string;
  correctionRequestedBy?:number;correctionVersion?:number;evidenceReference?:string;
}

export interface ReadingCorrectionRecord {
  id:number;intervalEnergyId:number;correctionType:string;beforeQuantity:number;afterQuantity:number;
  reason:string;evidenceReference:string;approvalStatus:string;requestedBy:number;approvedBy?:number;
  approvedAt?:string;reviewComment?:string;version:number;createdAt:string;
}

export interface MeteringQualityPage {
  total:number;page:number;pageSize:number;goodCount:number;correctedCount:number;estimatedCount:number;
  issueCount:number;rows:MeteringQualityRow[];
}

function query(path:string,params:Record<string,string|number|undefined>){
  const search=new URLSearchParams();
  Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!=='')search.set(key,String(value));});
  const suffix=search.toString();return suffix?`${path}?${suffix}`:path;
}

export const enterpriseMeteringApi={
  topologyVersions:()=>request<MeteringModelVersion[]>('/api/v1/enterprise-metering/topology-versions'),
  physicalNodeTypeOptions:()=>request<PhysicalNodeTypeOption[]>('/api/v1/enterprise-metering/physical-node-type-options'),
  createTopologyVersion:(body:AccountingVersionInput)=>request<MeteringModelVersion>('/api/v1/enterprise-metering/topology-versions',{method:'POST',body:JSON.stringify(body)}),
  createPhysicalNode:(versionId:number,body:PhysicalNodeInput)=>request<PhysicalMeteringTopology>(`/api/v1/enterprise-metering/topology-versions/${versionId}/nodes`,{method:'POST',body:JSON.stringify(body)}),
  updatePhysicalNode:(versionId:number,nodeId:number,body:PhysicalNodeInput)=>request<PhysicalMeteringTopology>(`/api/v1/enterprise-metering/topology-versions/${versionId}/nodes/${nodeId}`,{method:'PUT',body:JSON.stringify(body)}),
  disablePhysicalNode:(versionId:number,nodeId:number,version:number)=>request<PhysicalMeteringTopology>(`/api/v1/enterprise-metering/topology-versions/${versionId}/nodes/${nodeId}?version=${version}`,{method:'DELETE'}),
  createPhysicalEdge:(versionId:number,body:PhysicalEdgeInput)=>request<PhysicalMeteringTopology>(`/api/v1/enterprise-metering/topology-versions/${versionId}/edges`,{method:'POST',body:JSON.stringify(body)}),
  disablePhysicalEdge:(versionId:number,edgeId:number,version:number)=>request<PhysicalMeteringTopology>(`/api/v1/enterprise-metering/topology-versions/${versionId}/edges/${edgeId}?version=${version}`,{method:'DELETE'}),
  validateTopologyVersion:(versionId:number)=>request<MeteringValidationResult>(`/api/v1/enterprise-metering/topology-versions/${versionId}/validate`,{method:'POST'}),
  publishTopologyVersion:(versionId:number,body:{version:number;effectiveFrom:string})=>request<MeteringModelVersion>(`/api/v1/enterprise-metering/topology-versions/${versionId}/publish`,{method:'POST',body:JSON.stringify(body)}),
  accountingVersions:()=>request<MeteringModelVersion[]>('/api/v1/enterprise-metering/accounting-versions'),
  accountingPointOptions:()=>request<MeteringPointOption[]>('/api/v1/enterprise-metering/accounting-point-options'),
  createAccountingVersion:(body:AccountingVersionInput)=>request<MeteringModelVersion>('/api/v1/enterprise-metering/accounting-versions',{method:'POST',body:JSON.stringify(body)}),
  createAccountingNode:(versionId:number,body:AccountingNodeInput)=>request<AccountingMeteringTree>(`/api/v1/enterprise-metering/accounting-versions/${versionId}/nodes`,{method:'POST',body:JSON.stringify(body)}),
  updateAccountingNode:(versionId:number,nodeId:number,body:AccountingNodeInput)=>request<AccountingMeteringTree>(`/api/v1/enterprise-metering/accounting-versions/${versionId}/nodes/${nodeId}`,{method:'PUT',body:JSON.stringify(body)}),
  disableAccountingNode:(versionId:number,nodeId:number,version:number)=>request<AccountingMeteringTree>(`/api/v1/enterprise-metering/accounting-versions/${versionId}/nodes/${nodeId}?version=${version}`,{method:'DELETE'}),
  validateAccountingVersion:(versionId:number)=>request<MeteringValidationResult>(`/api/v1/enterprise-metering/accounting-versions/${versionId}/validate`,{method:'POST'}),
  publishAccountingVersion:(versionId:number,body:{version:number;effectiveFrom:string})=>request<MeteringModelVersion>(`/api/v1/enterprise-metering/accounting-versions/${versionId}/publish`,{method:'POST',body:JSON.stringify(body)}),
  overview:(params:Record<string,string|number|undefined>)=>request<EnterpriseMeteringOverview>(query('/api/v1/enterprise-metering/overview',params)),
  physicalTopology:(versionId?:number)=>request<PhysicalMeteringTopology>(query('/api/v1/enterprise-metering/physical-topology',{versionId})),
  accountingTree:(params:Record<string,string|number|undefined>)=>request<AccountingMeteringTree>(query('/api/v1/enterprise-metering/accounting-tree',params)),
  usage:(params:Record<string,string|number|undefined>)=>request<MeteringUsageAnalysis>(query('/api/v1/enterprise-metering/usage-analysis',params)),
  balance:(params:Record<string,string|number|undefined>)=>request<BalanceMeteringAnalysis>(query('/api/v1/enterprise-metering/balance',params)),
  boundaryAdjustments:(params:Record<string,string|number|undefined>)=>request<BoundaryAdjustmentRecord[]>(query('/api/v1/enterprise-metering/boundary-adjustments',params)),
  createBoundaryAdjustment:(body:BoundaryAdjustmentInput)=>request<BoundaryAdjustmentRecord>('/api/v1/enterprise-metering/boundary-adjustments',{method:'POST',body:JSON.stringify(body)}),
  reviewBoundaryAdjustment:(id:number,body:{decision:string;comment?:string;version:number})=>request<BoundaryAdjustmentRecord>(`/api/v1/enterprise-metering/boundary-adjustments/${id}/review`,{method:'POST',body:JSON.stringify(body)}),
  quality:(params:Record<string,string|number|undefined>)=>request<MeteringQualityPage>(query('/api/v1/enterprise-metering/data-quality',params)),
  createReadingCorrection:(body:{intervalEnergyId:number;correctionType:string;afterQuantity:number;reason:string;evidenceReference:string})=>request<ReadingCorrectionRecord>('/api/v1/enterprise-metering/reading-corrections',{method:'POST',body:JSON.stringify(body)}),
  reviewReadingCorrection:(id:number,body:{decision:string;comment?:string;version:number})=>request<ReadingCorrectionRecord>(`/api/v1/enterprise-metering/reading-corrections/${id}/review`,{method:'POST',body:JSON.stringify(body)}),
};
