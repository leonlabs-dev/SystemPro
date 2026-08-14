import type { AlarmTrendItem, EnergyTrendPoint, WorkbenchBusinessSnapshot } from '../types';

function seededVariation(seed: number, index: number) {
  const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildTrend(seed: number): EnergyTrendPoint[] {
  const currentHour = new Date().getHours();
  return Array.from({ length: 25 }, (_, hour) => {
    const isFuture = hour > currentHour || hour === 24;
    const daylight = hour >= 6 && hour <= 18 ? Math.sin(((hour - 6) / 12) * Math.PI) : 0;
    const morningPeak = Math.exp(-((hour - 10) ** 2) / 18);
    const eveningPeak = Math.exp(-((hour - 19) ** 2) / 12);
    const load = 92 + morningPeak * 36 + eveningPeak * 48 + seededVariation(seed, hour) * 9;
    const pv = daylight * (72 + seededVariation(seed, hour + 30) * 12);
    const grid = Math.max(load - pv, 0);
    return {
      hour: `${String(hour).padStart(2, '0')}:00`,
      pv: isFuture ? null : round(pv),
      grid: isFuture ? null : round(grid),
      load: isFuture ? null : round(load),
    };
  });
}

function buildAlarmTrend(seed: number): AlarmTrendItem[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const total = 8 + Math.round(seededVariation(seed, index + 120) * 17);
    const unhandled = Math.max(1, Math.round(total * (0.12 + seededVariation(seed, index + 140) * 0.2)));
    return {
      day: `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      total,
      unhandled,
      handled: total - unhandled,
    };
  });
}

export function createEnergyMockSnapshot(clientId: number): WorkbenchBusinessSnapshot {
  const today = new Date();
  const daySeed = clientId * 10_000 + today.getFullYear() * 400 + (today.getMonth() + 1) * 31 + today.getDate();
  const trend = buildTrend(daySeed);
  const pv = round(trend.reduce((sum, item) => sum + (item.pv ?? 0), 0));
  const grid = round(trend.reduce((sum, item) => sum + (item.grid ?? 0), 0));
  const load = round(trend.reduce((sum, item) => sum + (item.load ?? 0), 0));
  const deviceTotal = 286 + (clientId % 7) * 8;
  const deviceOffline = 12 + (clientId % 5);
  const devicePending = 7 + (clientId % 4);
  const deviceOnline = deviceTotal - deviceOffline - devicePending;
  const alarms = 5 + (clientId % 4);
  const unhandled = 1 + (clientId % 3);

  return {
    source: 'MOCK',
    generatedAt: today.toISOString(),
    kpis: [
      { key: 'consumption', value: load, unit: 'kWh', change: 5.1, tone: 'blue' },
      { key: 'grid', value: grid, unit: 'kWh', change: -3.2, tone: 'cyan' },
      { key: 'pv', value: pv, unit: 'kWh', change: 8.6, tone: 'green' },
      { key: 'device', value: deviceTotal, unit: '', change: 0.8, tone: 'purple' },
      { key: 'meter', value: 86 + (clientId % 5) * 2, unit: '', change: 2.4, tone: 'orange' },
      { key: 'alarm', value: alarms, unit: '', change: -18.2, tone: 'red' },
    ],
    trend,
    alarmTrend: buildAlarmTrend(daySeed),
    spaceEnergy: ['万达公寓楼', '综合管理中心', '信息技术部门', '游客中心部', '公共区域'].map((name, index) => ({
      name,
      value: Math.round((720 - index * 108) * (0.92 + seededVariation(daySeed, index + 80) * 0.16)),
      change: round(-4 + seededVariation(daySeed, index + 90) * 12),
    })),
    device: { total: deviceTotal, online: deviceOnline, offline: deviceOffline, pending: devicePending },
    deviceTypes: [
      { name: '变压器', value: 126 },
      { name: '电表', value: 98 },
      { name: '配电柜', value: 42 },
      { name: '充电桩', value: 36 },
      { name: '其他', value: 24 },
    ],
    alarm: { today: alarms, unhandled, handled: alarms - unhandled, handleRate: round(((alarms - unhandled) / alarms) * 100) },
  };
}
