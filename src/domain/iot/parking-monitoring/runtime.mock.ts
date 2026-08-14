import type {
  ParkingMonitoringAsset,
  SimulatedParkingRuntime,
  SimulatedParkingSpace,
  SimulatedSpaceStatus,
} from './types';
import { PARKING_BAY_LAYOUT } from './parking-map-layout';

function hash(value: string) {
  return [...value].reduce((result, character) => (result * 33 + character.charCodeAt(0)) >>> 0, 5381);
}

function statusAt(seed: number, index: number): SimulatedSpaceStatus {
  const value = (seed + index * 17) % 100;
  if (value < 3) return 'FAULT';
  if (value < 8) return 'RESERVED';
  if (value < 13) return 'CHARGING';
  if (value < 16) return 'ACCESSIBLE';
  if (value < 71) return 'OCCUPIED';
  return 'AVAILABLE';
}

export function buildParkingRuntime(
  systemKey: string,
  configuredSpaces: number,
  assets: ParkingMonitoringAsset[],
  at = new Date(),
): SimulatedParkingRuntime {
  const minuteBucket = Math.floor(at.getTime() / 300_000);
  const seed = hash(`${systemKey}:${minuteBucket}`);
  const total = Math.max(0, configuredSpaces);
  const reserved = total ? Math.max(1, Math.round(total * 0.025)) : 0;
  const charging = total ? Math.max(0, Math.round(total * 0.015)) : 0;
  const fault = total ? Math.max(0, Math.round(total * 0.008)) : 0;
  const accessible = total ? Math.max(0, Math.round(total * 0.02)) : 0;
  const occupancyWave = 0.58 + Math.sin((at.getHours() + at.getMinutes() / 60 - 8) / 12 * Math.PI) * 0.16;
  const occupied = total ? Math.min(total - reserved - charging - fault - accessible, Math.max(0, Math.round(total * occupancyWave))) : 0;
  const available = Math.max(0, total - occupied - reserved - charging - fault - accessible);
  const hour = at.getHours() + at.getMinutes() / 60;
  const sampleSpaces: SimulatedParkingSpace[] = PARKING_BAY_LAYOUT.map((space, index) => ({
    ...space,
    status: statusAt(seed, index),
  }));
  return {
    quality: 'SIMULATED',
    updatedAt: at.toISOString(),
    occupied,
    available,
    reserved,
    charging,
    fault,
    accessible,
    occupancyRate: total ? Number((occupied / total * 100).toFixed(1)) : 0,
    todayEntries: Math.max(0, Math.round(hour * 21 + seed % 37)),
    todayExits: Math.max(0, Math.round(hour * 18 + seed % 29)),
    averageStayMinutes: 84 + seed % 73,
    sampleSpaces,
    assetRuntime: Object.fromEntries(assets.map((asset, index) => {
      const value = (hash(asset.code) + seed + index) % 20;
      return [asset.id, value === 0 ? 'OFFLINE' : value < 3 ? 'WARNING' : 'ONLINE'];
    })),
  };
}
