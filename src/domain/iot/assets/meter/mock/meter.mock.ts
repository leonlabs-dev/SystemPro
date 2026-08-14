import type { MeterAsset, MeterDemoSnapshot, MeterLocale } from '../types';

/**
 * The only meter mock boundary in the frontend.
 *
 * Asset identity, Tenant/Space ownership and CRUD are always loaded from Java.
 * This file supplies preview-only telemetry, prepaid and command snapshots until
 * the Go device gateway and their authoritative backend domains are connected.
 * Removing this directory must not affect meter asset CRUD.
 */
export function buildMeterDemoSnapshot(meter: MeterAsset, locale: MeterLocale): MeterDemoSnapshot {
  const online = meter.status === 'active' && meter.communicationStatus === 'online';
  const factor = stableFactor(meter.id);
  const now = Date.now();
  const text = locale === 'en-US'
    ? { voltage: 'Voltage fluctuation recovered', delay: 'Telemetry collection delayed', read: 'Immediate reading' }
    : { voltage: '电压短时波动已恢复', delay: '采集数据延迟', read: '立即抄表' };

  return {
    metrics: [
      { key: 'voltage', value: online ? round(228 + factor * 4.2, 1) : 0, unit: 'V' },
      { key: 'current', value: online ? round(12 + factor * 26, 2) : 0, unit: 'A' },
      { key: 'activePower', value: online ? round(5 + factor * 18, 2) : 0, unit: 'kW' },
      { key: 'powerFactor', value: online ? round(0.92 + factor * 0.06, 3) : 0, unit: '' },
      { key: 'todayEnergy', value: round(80 + factor * 260, 2), unit: 'kWh' },
      { key: 'totalEnergy', value: round(12000 + factor * 98000, 2), unit: 'kWh' },
    ],
    balance: round(240 + factor * 1200, 2),
    prepaidStatus: factor < 0.16 ? 'low-balance' : 'normal',
    relayState: 'closed',
    alarmCount: meter.communicationStatus === 'warning' ? 2 : 0,
    recentEvents: [
      { id: `${meter.id}-event-1`, title: text.voltage, occurredAt: new Date(now - 6 * 60 * 60_000).toISOString(), status: 'resolved' },
      { id: `${meter.id}-event-2`, title: text.delay, occurredAt: new Date(now - 30 * 60 * 60_000).toISOString(), status: 'acknowledged' },
    ],
    recentCommands: [
      { id: `${meter.id}-command-1`, title: text.read, occurredAt: new Date(now - 12 * 60_000).toISOString(), status: 'succeeded' },
    ],
  };
}

function stableFactor(value: string) {
  const hash = [...value].reduce((result, char) => (result * 31 + char.charCodeAt(0)) % 997, 17);
  return 0.2 + (hash / 997) * 0.75;
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}
