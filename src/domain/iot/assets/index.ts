/**
 * 设备资产域 — 对应 05 设备资产
 *
 * 覆盖：电表、水表、空调、照明、停车、充电桩、光伏设备、储能设备
 */
export const DEVICE_ASSETS_DOMAIN = 'assets' as const;

export * from './meter';
export * from './device-system';
