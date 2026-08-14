/**
 * 融合层 — 跨域聚合消费
 *
 * 约束：
 * - 只能 import iot/ 和 erp/ 暴露的只读查询接口
 * - 不能被 iot/ 或 erp/ 反向依赖
 * - 负责驾驶舱类跨域聚合视图
 */
export const FUSION_DOMAIN_BOUNDARY = 'fusion' as const;
