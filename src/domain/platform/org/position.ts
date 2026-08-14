export type PositionStatus = 'enabled' | 'disabled';

export interface Position {
  id: string;
  /** Owning Client id. */
  clientId?: number;
  name: string;
  code: string;
  orgNodeId: string;
  description: string;
  headcount?: number;
  currentCount: number;
  status: PositionStatus;
  level: string;
  relatedPermissions: string[];
  createdAt: string;
  updatedAt: string;
}

export type PositionDraft = Omit<
  Position,
  'id' | 'clientId' | 'createdAt' | 'updatedAt' | 'currentCount'
>;

export const positionStatusLabels: Record<PositionStatus, string> = {
  enabled: '启用',
  disabled: '停用',
};
