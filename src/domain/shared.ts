/** 跨领域共享类型。iot、erp、fusion 均可安全 import。 */

/** 设备 / 节点实时摘要，用于能流面板和看板仪表盘 */
export interface RealtimeNode {
  id: string;
  name: string;
  value: number;
  unit: string;
  state: 'online' | 'warning' | 'offline';
}
