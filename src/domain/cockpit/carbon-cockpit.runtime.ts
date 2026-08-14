import { buildEnergyTrend, buildIntegratedEnergySnapshot } from '@/domain/iot/assets/device-system/runtime.mock';
import type { DeviceSystem, DeviceSystemType } from '@/domain/iot/assets/device-system/types';
import type { CarbonCockpitOverview, CockpitSystemSummary } from './carbon-cockpit.types';

function runtimeSystem(type: DeviceSystemType, summary: CockpitSystemSummary, fallbackCapacity: number): DeviceSystem {
  return {
    id: summary.primarySystemId || `${type.toLowerCase()}-runtime`,
    code: summary.primarySystemCode || `${type}-RUNTIME`,
    name: summary.primarySystemName || `${type} system`,
    systemType: type,
    status: summary.active > 0 ? 'ACTIVE' : 'DISABLED',
    version: 1,
    assetCount: summary.assetCount,
    serviceScopeCount: summary.serviceSpaceCount,
    meterBindingCount: 0,
    profile: {
      mode: summary.mode || '',
      primaryCapacity: summary.primaryCapacity || fallbackCapacity,
      secondaryCapacity: summary.secondaryCapacity,
    },
    assets: [],
    serviceScopes: [],
    meterBindings: [],
    history: [],
    createdAt: '',
    updatedAt: '',
  };
}

export function buildCockpitRuntime(source: CarbonCockpitOverview, at = new Date()) {
  const solar = runtimeSystem('SOLAR', source.solar, 860);
  const storage = runtimeSystem('STORAGE', source.storage, 520);
  const snapshot = buildIntegratedEnergySnapshot(solar, source.storage.total > 0 ? storage : undefined, at);
  const chargingBase = Math.max(96, source.charging.assetCount * 6.6);
  const minuteSeed = Math.floor(at.getTime() / 30_000);
  const chargingPower = Number((chargingBase * (0.42 + Math.sin(minuteSeed / 3) * 0.08)).toFixed(1));
  const buildingPower = Number(Math.max(0, snapshot.loadPower * 0.31).toFixed(1));
  const otherPower = Number(Math.max(0, snapshot.loadPower - buildingPower - chargingPower).toFixed(1));
  const carbonToday = Number((snapshot.pvToday * 0.0005703).toFixed(2));
  const carbonTotal = Number((carbonToday * 524.7).toFixed(1));

  return {
    snapshot,
    trend: buildEnergyTrend(solar, source.storage.total > 0 ? storage : undefined, 'DAY', at),
    chargingPower,
    buildingPower,
    otherPower,
    carbonToday,
    carbonTotal,
    trees: Math.max(1, Math.round(carbonToday * 71.5)),
    chargingToday: Math.round(Math.max(1, source.charging.assetCount) * (2.1 + at.getHours() / 18)),
    chargingEnergyToday: Number((chargingPower * Math.max(1, at.getHours()) * 0.63).toFixed(0)),
  };
}

export type CarbonCockpitRuntime = ReturnType<typeof buildCockpitRuntime>;
