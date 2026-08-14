/**
 * IoT 域 — 设备与能源
 *
 * 约束：
 * - 不可 import erp/ 下的模块
 * - 通过 core/metrics/ 暴露共用数据给 fusion/ 消费
 * - 域内逻辑闭环：API → types → repository → composables
 */
export const IOT_DOMAIN_BOUNDARY = 'iot' as const;
