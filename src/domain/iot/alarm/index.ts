/**
 * 告警工单域 — 对应 08 告警工单
 *
 * 只负责流程语义：告警规则配置、告警转工单、工单处理中心、历史统计。
 * 不当"当前告警"的展示入口——实时告警流在 monitor/ 域。
 */
export const ALARM_WORK_ORDER_DOMAIN = 'alarm' as const;
