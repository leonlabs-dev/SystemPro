/**
 * 并网购售电量 — 统一数据服务
 *
 * 覆盖与电网的购电、售电和净交换量。
 * 能源流向、运营监控与财务账单按授权共用此接口。
 *
 * @module core/metrics/grid-exchange
 */

export interface GridExchangeQuery {
  stationId?: string;
  start: string;
  end: string;
  granularity: '15min' | 'hour' | 'day' | 'month';
}

export interface GridExchangePoint {
  timestamp: string;
  /** 从电网购电 (kWh) */
  import_: number;
  /** 向电网售电 (kWh) */
  export_: number;
}

export interface GridExchangeResult {
  stationId: string;
  /** 周期内净购电 = import - export (kWh)，正值=净购电，负值=净售电 */
  netImport: number;
  totalImport: number;
  totalExport: number;
  points: GridExchangePoint[];
}

export async function queryGridExchange(
  query: GridExchangeQuery,
): Promise<GridExchangeResult> {
  return {
    stationId: query.stationId ?? 'default',
    netImport: 0,
    totalImport: 0,
    totalExport: 0,
    points: [],
  };
}
