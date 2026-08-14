export type TenantStatus = 'active' | 'vacated' | 'arrears' | 'expiring';

export interface TenantRecord {
  id: string;
  /** 所属管理方 ID（平台方三层模型关键字段） */
  clientId?: number;
  code: string;
  name: string;
  contactPerson: string;
  contactPhone: string;
  contractStartDate: string;
  contractEndDate: string;
  status: TenantStatus;
  remark?: string;
  resourceNodeIds?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface TenantQuery {
  keyword?: string;
  status?: TenantStatus | '';
  buildingNodeId?: string;
}

export interface TenantDraft {
  code: string;
  name: string;
  contactPerson: string;
  contactPhone: string;
  resourceNodeIds: string[];
  contractStartDate: string;
  contractEndDate: string;
  status: TenantStatus;
  remark?: string;
}

export const tenantStatusLabels: Record<TenantStatus, string> = {
  active: '在租',
  vacated: '已退租',
  arrears: '欠费',
  expiring: '即将到期',
};
