export type ResourceNodeType =
  | 'project'
  | 'park'
  | 'building'
  | 'floor'
  | 'room'
  | 'area'
  | 'common_area'
  | 'equipment_room'
  | 'parking'
  | 'system'
  | 'equipment'
  | 'meter'
  | 'point'
  | 'station'
  | 'charger'
  | 'connector';

export type ResourceNodeStatus = 'enabled' | 'disabled' | 'deprecated';

export interface ResourceNode {
  id: string;
  /** 所属管理方 ID（Platform / Client / Tenant 隔离的关键字段）。 */
  clientId?: number;
  name: string;
  type: ResourceNodeType;
  status: ResourceNodeStatus;
  code?: string;
  parentId: string;
  remark?: string;
  tenantIds?: string[];
  projectType?: string;
  projectPhase?: 'PLANNING' | 'DELIVERY' | 'OPERATING' | 'COMPLETED';
  provinceName?: string;
  cityName?: string;
  longitude?: number;
  latitude?: number;
  serviceAreaSquareMeters?: number;
  children?: ResourceNode[];
  createdAt?: string;
  updatedAt?: string;
}

/** 资源与租户的多对多关系。 */
export interface ResourceTenantRelation {
  id: string;
  resourceNodeId: string;
  tenantId: string;
  relationType: 'occupies' | 'metered_by' | 'owns';
}

/** 空间类型在当前中文管理端中的显示名称；接口枚举值不得直接展示给用户。 */
export const resourceNodeTypeLabels: Record<ResourceNodeType, string> = {
  project: '项目',
  park: '园区',
  building: '楼宇',
  floor: '楼层',
  room: '房间',
  area: '区域',
  common_area: '公共区域',
  equipment_room: '设备机房',
  parking: '停车区域',
  system: '系统',
  equipment: '设备',
  meter: '计量设备',
  point: '测点',
  station: '充电站',
  charger: '充电桩',
  connector: '枪口',
};

export const resourceNodeTypeEnglishLabels: Record<ResourceNodeType, string> = {
  project: 'Project',
  park: 'Park',
  building: 'Building',
  floor: 'Floor',
  room: 'Room',
  area: 'Area',
  common_area: 'Common area',
  equipment_room: 'Equipment room',
  parking: 'Parking area',
  system: 'System',
  equipment: 'Equipment',
  meter: 'Meter',
  point: 'Point',
  station: 'Charging station',
  charger: 'Charger',
  connector: 'Connector',
};

export const resourceNodeStatusLabels: Record<ResourceNodeStatus, string> = {
  enabled: '启用',
  disabled: '停用',
  deprecated: '废弃',
};

export const resourceNodeStatusEnglishLabels: Record<ResourceNodeStatus, string> = {
  enabled: 'Enabled',
  disabled: 'Disabled',
  deprecated: 'Deprecated',
};

/** 扁平化资源树。 */
export function flattenResources(nodes: ResourceNode[]): ResourceNode[] {
  return nodes.reduce<ResourceNode[]>((acc, node) => {
    acc.push(node);
    if (node.children?.length) {
      acc.push(...flattenResources(node.children));
    }
    return acc;
  }, []);
}

/** 递归查找节点。 */
export function findResourceNode(nodes: ResourceNode[], id: string): ResourceNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findResourceNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** 获取节点的面包屑路径。 */
export function getResourceBreadcrumb(nodes: ResourceNode[], id: string): string {
  const flat = flattenResources(nodes);
  const map = new Map(flat.map((node) => [node.id, node]));
  const parts: string[] = [];
  let current = map.get(id);
  while (current) {
    parts.unshift(current.name);
    current = current.parentId ? map.get(current.parentId) : undefined;
  }
  return parts.join(' / ');
}

/** 获取某节点下指定类型的全部后代节点。 */
export function getResourceNodesByType(
  nodes: ResourceNode[],
  parentId: string,
  type: ResourceNodeType,
): ResourceNode[] {
  const parent = findResourceNode(nodes, parentId);
  if (!parent) return [];
  return flattenResources(parent.children || []).filter((node) => node.type === type);
}

/** 获取某节点的直接子节点。 */
export function getDirectChildren(nodes: ResourceNode[], parentId: string): ResourceNode[] {
  const parent = findResourceNode(nodes, parentId);
  return parent?.children ?? [];
}

/** 根据资源节点 ID 反查关联租户。 */
export function findTenantsByResourceId(
  relations: ResourceTenantRelation[],
  resourceNodeId: string,
): ResourceTenantRelation[] {
  return relations.filter((relation) => relation.resourceNodeId === resourceNodeId);
}

/** 根据租户 ID 获取关联资源节点 ID。 */
export function findResourceIdsByTenantId(
  relations: ResourceTenantRelation[],
  tenantId: string,
): string[] {
  return relations.filter((relation) => relation.tenantId === tenantId).map((relation) => relation.resourceNodeId);
}
