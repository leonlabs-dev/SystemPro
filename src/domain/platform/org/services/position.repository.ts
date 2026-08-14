import type { Position } from '../position';

export function queryPositionsByOrg(source: Position[], orgNodeId: string): Position[] {
  return source.filter((position) => position.orgNodeId === orgNodeId);
}
