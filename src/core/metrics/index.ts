/**
 * core/metrics — 共享指标数据服务层
 *
 * 所有跨模块共用的基础指标（发电量、储能量、购售电、负荷）收敛到此层。
 * 页面只做展示和聚合维度切换，不各自查表。
 *
 * 使用规范（团队强制约束）：
 *   - iot/ 和 erp/ 通过此层暴露/消费共用数据，不互相 import 对方 domain 代码
 *   - fusion/ 只能通过此层消费 iot/ 和 erp/ 的数据
 *   - 新增指标前先确认是否已有同类接口，避免重复定义
 */

export {
  queryPvGeneration,
  type PvGenerationQuery,
  type PvGenerationPoint,
  type PvGenerationResult,
} from './pv-generation';

export {
  queryStorageFlow,
  type StorageFlowQuery,
  type StorageFlowPoint,
  type StorageFlowResult,
} from './storage-flow';

export {
  queryGridExchange,
  type GridExchangeQuery,
  type GridExchangePoint,
  type GridExchangeResult,
} from './grid-exchange';

export {
  queryLoadConsumption,
  type LoadConsumptionQuery,
  type LoadConsumptionPoint,
  type LoadConsumptionResult,
} from './load-consumption';
