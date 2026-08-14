/**
 * 储能充放电量 — 统一数据服务
 *
 * 覆盖储能柜的充电量、放电量和 SOC 时序。
 * 能源流向、计量与损耗、数据分析三个模块共用此接口。
 *
 * @module core/metrics/storage-flow
 */

export interface StorageFlowQuery {
  /** 储能设备 ID */
  deviceId?: string;
  /** 起始时间 (ISO 8601) */
  start: string;
  /** 结束时间 (ISO 8601) */
  end: string;
  granularity: '5min' | '15min' | 'hour' | 'day' | 'month';
}

export interface StorageFlowPoint {
  timestamp: string;
  /** 充电量 (kWh) */
  charge: number;
  /** 放电量 (kWh) */
  discharge: number;
  /** SOC (%) */
  soc: number;
}

export interface StorageFlowResult {
  deviceId: string;
  /** 周期内总充电量 (kWh) */
  totalCharge: number;
  /** 周期内总放电量 (kWh) */
  totalDischarge: number;
  points: StorageFlowPoint[];
}

export async function queryStorageFlow(
  query: StorageFlowQuery,
): Promise<StorageFlowResult> {
  return {
    deviceId: query.deviceId ?? 'default',
    totalCharge: 0,
    totalDischarge: 0,
    points: [],
  };
}
