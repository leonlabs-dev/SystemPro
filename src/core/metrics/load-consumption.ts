/**
 * 负荷用电量 — 统一数据服务
 *
 * 覆盖总负荷及各分项（空调、照明、动力等）用电量。
 * 能源计量、运营监控与财务账单按授权共用此接口。
 *
 * @module core/metrics/load-consumption
 */

export interface LoadConsumptionQuery {
  stationId?: string;
  /** 分项类型: total | hvac | lighting | power | charging | other */
  category?: 'total' | 'hvac' | 'lighting' | 'power' | 'charging' | 'other';
  start: string;
  end: string;
  granularity: '15min' | 'hour' | 'day' | 'month';
}

export interface LoadConsumptionPoint {
  timestamp: string;
  /** 用电量 (kWh) */
  value: number;
}

export interface LoadConsumptionResult {
  stationId: string;
  category: string;
  /** 周期内总用电量 (kWh) */
  total: number;
  /** 最大需量 (kW) */
  maxDemand: number;
  points: LoadConsumptionPoint[];
}

export async function queryLoadConsumption(
  query: LoadConsumptionQuery,
): Promise<LoadConsumptionResult> {
  return {
    stationId: query.stationId ?? 'default',
    category: query.category ?? 'total',
    total: 0,
    maxDemand: 0,
    points: [],
  };
}
