/**
 * 计量与损耗域 — 对应 07 计量与损耗
 *
 * 覆盖：分项计量、区域/租户/设备类型计量、总分表平衡、损耗分析、异常用能识别
 *
 * 数据依赖：本域计量数据来源于 energy-flow 的计量点位拓扑。
 * 两个域通过 core/metrics/ 共享数据，不直接跨域调用。
 */
export const METERING_LOSS_DOMAIN = 'metering-loss' as const;
export * from './submetering.api';
export * from './enterprise-metering.api';
