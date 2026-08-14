import type {
  DeviceRuntimeSnapshot,
  DeviceSystem,
  EnergyFlowSnapshot,
  EnergyTrendPeriod,
  EnergyTrendPoint,
  IntegratedEnergySnapshot,
} from './types';

function seed(value: string) {
  return [...value].reduce((result, character) => (result * 31 + character.charCodeAt(0)) >>> 0, 17);
}

function wave(base: number, amplitude: number, phase: number) {
  return base + Math.sin(Date.now() / 45_000 + phase) * amplitude;
}

export function buildDeviceRuntime(system: DeviceSystem): DeviceRuntimeSnapshot {
  const value = seed(system.id);
  const status = system.status === 'DISABLED'
    ? 'OFFLINE'
    : value % 9 === 0 ? 'WARNING' : value % 7 === 0 ? 'OFFLINE' : 'ONLINE';
  const current = system.systemType === 'HVAC'
    ? wave(24.5, 2.8, value)
    : system.systemType === 'STORAGE'
      ? wave(63, 18, value)
      : wave(72, 22, value);
  return {
    communicationStatus: status,
    mode: system.profile.mode || '--',
    currentValue: Number(current.toFixed(1)),
    targetValue: system.systemType === 'HVAC' ? 24 : 80,
    secondaryValue: Number(wave(51, 8, value / 3).toFixed(1)),
    todayEnergy: Number((12 + value % 30 + Math.max(0, new Date().getHours() - 6) * 2.3).toFixed(1)),
    livePower: status === 'OFFLINE' ? 0 : Number(wave(18 + value % 40, 6, value / 5).toFixed(1)),
    updatedAt: new Date().toISOString(),
    quality: 'SIMULATED',
  };
}

export function buildEnergyFlow(system: DeviceSystem, storagePower = 0): EnergyFlowSnapshot {
  const value = seed(system.id);
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const capacity = Number(system.profile.primaryCapacity || 300);
  const pvPower = Number((capacity * daylight * (0.72 + (value % 12) / 100)).toFixed(2));
  const loadPower = Number((capacity * (0.38 + 0.12 * Math.sin(Date.now() / 120_000 + value))).toFixed(2));
  const signedStorage = Number(storagePower.toFixed(2));
  const lossPower = Number((Math.max(pvPower, loadPower) * 0.012).toFixed(2));
  // Same-timestamp balance: generation + import + discharge =
  // load + export + charge + modeled line/conversion loss.
  const rawGrid = loadPower + lossPower + Math.max(0, signedStorage)
    - pvPower - Math.max(0, -signedStorage);
  const gridPower = Number(rawGrid.toFixed(2));
  const balanceError = Number((
    pvPower + Math.max(gridPower, 0) + Math.max(-signedStorage, 0)
    - loadPower - Math.max(-gridPower, 0) - Math.max(signedStorage, 0) - lossPower
  ).toFixed(2));
  const elapsedDaylight = Math.max(0, hour - 6);
  return {
    pvPower,
    gridPower,
    loadPower,
    storagePower: signedStorage,
    lossPower,
    balanceError,
    pvToday: Number((pvPower * Math.max(1, elapsedDaylight) * 0.55).toFixed(1)),
    gridImportToday: Number((Math.max(gridPower, 0) * Math.max(hour, 1) * 0.62).toFixed(1)),
    gridExportToday: Number((Math.max(-gridPower, 0) * Math.max(hour - 8, 0) * 0.48).toFixed(1)),
    loadToday: Number((loadPower * Math.max(hour, 1) * 0.68).toFixed(1)),
    updatedAt: new Date().toISOString(),
    stale: false,
    quality: 'SIMULATED',
  };
}

function energyAt(
  solar: DeviceSystem,
  storage: DeviceSystem | undefined,
  at: Date,
  sampleIndex = 0,
) {
  const solarSeed = seed(solar.id);
  const storageSeed = storage ? seed(storage.id) : 0;
  const hour = at.getHours() + at.getMinutes() / 60;
  const capacity = Math.max(1, Number(solar.profile.primaryCapacity || 330));
  const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const cloudFactor = 0.78
    + Math.sin(sampleIndex * 0.73 + solarSeed / 29) * 0.055
    + Math.sin(sampleIndex * 0.17 + solarSeed / 11) * 0.025
    + Math.sin(sampleIndex * 2.37 + solarSeed / 19) * 0.018
    + Math.sin(sampleIndex * 4.91 + solarSeed / 7) * 0.011;
  const pvPower = Math.max(0, capacity * daylight * cloudFactor);
  const loadCurve = 0.58
    + 0.18 * Math.sin(((hour - 7.5) / 15) * Math.PI)
    + 0.035 * Math.sin(sampleIndex * 0.41 + solarSeed)
    + 0.026 * Math.sin(sampleIndex * 2.11 + solarSeed / 13)
    + 0.014 * Math.sin(sampleIndex * 5.03 + solarSeed / 5);
  const loadPower = Math.max(capacity * 0.34, capacity * loadCurve);

  let storagePower = 0;
  if (storage?.status === 'ACTIVE') {
    const ratedPower = Math.max(1, Number(storage.profile.primaryCapacity || capacity * 0.4));
    if (hour >= 10 && hour < 15 && pvPower > loadPower * 0.82) {
      storagePower = -Math.min(ratedPower * 0.72, Math.max(0, pvPower - loadPower * 0.72));
    } else if (hour >= 17 && hour < 22) {
      storagePower = Math.min(ratedPower * 0.76, loadPower * 0.34);
    } else if (hour < 6 || hour >= 23) {
      storagePower = -ratedPower * (0.22 + 0.05 * Math.sin(sampleIndex + storageSeed));
    }
  }

  // Signed convention: grid > 0 is export, grid < 0 is import;
  // storage > 0 is discharge, storage < 0 is charge.
  // The signed balance is pv + storage - load - loss - grid = 0.
  const lossPower = Math.max(loadPower, pvPower) * 0.012;
  const gridPower = pvPower + storagePower - loadPower - lossPower;
  return {
    pvPower: Number(pvPower.toFixed(2)),
    loadPower: Number(loadPower.toFixed(2)),
    storagePower: Number(storagePower.toFixed(2)),
    gridPower: Number(gridPower.toFixed(2)),
  };
}

export function buildIntegratedEnergySnapshot(
  solar: DeviceSystem,
  storage: DeviceSystem | undefined,
  at = new Date(),
): IntegratedEnergySnapshot {
  const current = energyAt(solar, storage, at, Math.floor(at.getTime() / 30_000));
  const hour = at.getHours() + at.getMinutes() / 60;
  const samples = Array.from({ length: Math.max(1, Math.floor(hour * 6) + 1) }, (_, index) => {
    const sample = new Date(at);
    sample.setHours(0, index * 10, 0, 0);
    return energyAt(solar, storage, sample, index);
  });
  const intervalHours = 1 / 6;
  const pvToday = samples.reduce((sum, item) => sum + item.pvPower * intervalHours, 0);
  const loadToday = samples.reduce((sum, item) => sum + item.loadPower * intervalHours, 0);
  const gridImportToday = samples.reduce((sum, item) => sum + Math.max(0, -item.gridPower) * intervalHours, 0);
  const gridExportToday = samples.reduce((sum, item) => sum + Math.max(0, item.gridPower) * intervalHours, 0);
  const selfUseRate = pvToday <= 0 ? 0 : Math.max(0, Math.min(100, (pvToday - gridExportToday) / pvToday * 100));
  const storageSeed = storage ? seed(storage.id) : seed(solar.id);
  const storageSoc = storage
    ? Math.max(18, Math.min(96, 63 + Math.sin((hour - 8) / 24 * Math.PI * 2 + storageSeed) * 17))
    : 0;
  const lossPower = Math.max(current.loadPower, current.pvPower) * 0.012;
  const balanceError = current.pvPower + current.storagePower
    - current.loadPower - lossPower - current.gridPower;
  const revenueToday = pvToday * 0.68 + gridExportToday * 0.31;
  const mode = current.pvPower > current.loadPower && current.storagePower < 0
    ? 'PV_PRIORITY_STORAGE'
    : current.gridPower > 0
      ? 'PV_PRIORITY_EXPORT'
      : current.storagePower > 0
        ? 'STORAGE_DISCHARGE'
        : 'GRID_SUPPORT';

  return {
    ...current,
    mode,
    lossPower: Number(lossPower.toFixed(2)),
    balanceError: Number(balanceError.toFixed(2)),
    pvToday: Number(pvToday.toFixed(2)),
    loadToday: Number(loadToday.toFixed(2)),
    gridImportToday: Number(gridImportToday.toFixed(2)),
    gridExportToday: Number(gridExportToday.toFixed(2)),
    storageSoc: Number(storageSoc.toFixed(1)),
    storageSoh: storage ? Number((96.2 + (storageSeed % 22) / 20).toFixed(1)) : 0,
    selfUseRate: Number(selfUseRate.toFixed(1)),
    systemEfficiency: Number((96.8 + (seed(solar.id) % 13) / 10).toFixed(1)),
    availabilityRate: Number((98.1 + (seed(solar.id) % 17) / 10).toFixed(1)),
    fullLoadHours: Number((pvToday / Math.max(1, Number(solar.profile.primaryCapacity || 330))).toFixed(2)),
    revenueToday: Number(revenueToday.toFixed(2)),
    revenueTotal: Number((revenueToday * (186 + seed(solar.id) % 24)).toFixed(2)),
    carbonReduction: Number((pvToday * 0.0005703).toFixed(2)),
    equivalentTrees: Math.round(pvToday * 0.00118),
    updatedAt: at.toISOString(),
    stale: false,
    quality: 'SIMULATED',
  };
}

export function buildEnergyTrend(
  solar: DeviceSystem,
  storage: DeviceSystem | undefined,
  period: EnergyTrendPeriod,
  at = new Date(),
): EnergyTrendPoint[] {
  if (period === 'DAY') {
    const currentMinute = at.getHours() * 60 + at.getMinutes();
    return Array.from({ length: 145 }, (_, index) => {
      const minute = index * 10;
      const sample = new Date(at);
      sample.setHours(0, minute, 0, 0);
      const value = energyAt(solar, storage, sample, index);
      const visible = minute <= currentMinute;
      return {
        label: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
        pvPower: visible ? value.pvPower : null,
        loadPower: visible ? value.loadPower : null,
        storagePower: visible ? value.storagePower : null,
        gridPower: visible ? value.gridPower : null,
      };
    });
  }

  const count = period === 'MONTH' ? 30 : 12;
  return Array.from({ length: count }, (_, index) => {
    const seasonal = period === 'YEAR'
      ? 0.72 + Math.sin((index - 2) / 12 * Math.PI * 2) * 0.22
      : 0.86 + Math.sin(index * 0.63) * 0.12;
    const sample = new Date(at);
    sample.setHours(12, 0, 0, 0);
    sample.setDate(Math.max(1, index + 1));
    const value = energyAt(solar, storage, sample, index);
    const scale = seasonal * (period === 'MONTH' ? 5.4 : 142);
    return {
      label: period === 'MONTH' ? `${index + 1}日` : `${index + 1}月`,
      pvPower: Number((value.pvPower * scale).toFixed(1)),
      loadPower: Number((value.loadPower * scale).toFixed(1)),
      storagePower: Number((value.storagePower * scale).toFixed(1)),
      gridPower: Number((value.gridPower * scale).toFixed(1)),
    };
  });
}
