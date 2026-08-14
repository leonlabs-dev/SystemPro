/**
 * 光伏发电量 — 统一数据服务
 *
 * 这是跨模块共用核心指标。能源流向、计量与损耗、数据分析三个模块
 * 的发电量查询必须收敛到此接口，确保同一时间窗口的数字一致。
 *
 * @module core/metrics/pv-generation
 */

export interface PvGenerationQuery {
  /** 电站/项目 ID */
  stationId?: string;
  /** 起始时间 (ISO 8601) */
  start: string;
  /** 结束时间 (ISO 8601) */
  end: string;
  /** 时间粒度 */
  granularity: '5min' | '15min' | 'hour' | 'day' | 'month';
}

export interface PvGenerationPoint {
  timestamp: string;
  /** 发电量 (kWh) */
  value: number;
}

export interface PvGenerationResult {
  stationId: string;
  /** 查询周期内的总发电量 (kWh) */
  total: number;
  /** 时序数据点 */
  points: PvGenerationPoint[];
}

/**
 * 当前为骨架实现，返回空结构。
 * 接入真实数据源时，在此处切换为后端 API 调用或 MQTT 实时流。
 *
 * TODO: 替换为真实 repository 实现
 */
export async function queryPvGeneration(
  query: PvGenerationQuery,
): Promise<PvGenerationResult> {
  // Placeholder — 接入真实数据源时在此处替换
  return {
    stationId: query.stationId ?? 'default',
    total: 0,
    points: [],
  };
}

/**
 * 约束规则（团队规范）：
 *
 * - 能源流向、计量与损耗、数据分析三个模块的发电量查询，
 *   必须通过此接口获取，不得各自绕过直接查后端/数采。
 * - 如需新增聚合维度（按设备类型 / 按区域 / 按时间段），
 *   在此文件扩展 query 参数，不要在调用方各自实现。
 * - 变更此接口类型前，需要确认三个消费方的兼容性。
 */
