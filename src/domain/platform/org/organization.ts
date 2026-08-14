export type OrganizationType = 'group' | 'company' | 'center' | 'business' | 'department';
export type OrganizationStatus = 'enabled' | 'disabled';

export interface OrganizationNode {
  /** 节点唯一标识（6位字母数字，全局唯一） */
  id: string;
  /** 所属管理方 ID（平台方三层模型关键字段） */
  clientId?: number;
  /** 父节点 ID，根节点为 null */
  parentId: string | null;
  /** 节点名称（如 华能集团） */
  name: string;
  code: string;
  /** 节点描述 */
  description?: string;
  /** 节点类型 */
  type: OrganizationType;
  manager: string;
  leaderAccountId?: string;
  phone: string;
  city: string;
  address: string;
  projectCount: number;
  stationCount: number;
  remark: string;
  /** 下属账号总数（含子节点递归统计） */
  accountCount: number;
  /** 状态 */
  status: OrganizationStatus;
  /** 子节点 */
  children?: OrganizationNode[];
  createdAt?: string;
  updatedAt?: string;
}

export type OrganizationDraft = Omit<
  OrganizationNode,
  'children' | 'clientId' | 'createdAt' | 'updatedAt'
>;

export const organizationTypeLabels: Record<OrganizationType, string> = {
  group: '集团',
  company: '公司',
  center: '中心',
  business: '事业部',
  department: '部门',
};

export const organizationStatusLabels: Record<OrganizationStatus, string> = {
  enabled: '启用',
  disabled: '停用',
};
