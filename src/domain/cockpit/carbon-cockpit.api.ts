import { request } from '@/core/api/http-client';
import type { CarbonCockpitOverview, CockpitAlarmSummary } from './carbon-cockpit.types';

type CarbonCockpitOverviewWire = Omit<CarbonCockpitOverview, 'alarms' | 'telemetryQuality'> & {
  alarms?: CockpitAlarmSummary;
  telemetryQuality?: CarbonCockpitOverview['telemetryQuality'];
  activeAlarmCount?: number;
  criticalAlarmCount?: number;
};

function normalizeOverview(payload: CarbonCockpitOverviewWire): CarbonCockpitOverview {
  const legacyOpenEventCount = Math.max(0, payload.activeAlarmCount ?? 0);
  return {
    ...payload,
    alarms: payload.alarms ?? {
      openEventCount: legacyOpenEventCount,
      criticalOpenEventCount: Math.max(0, payload.criticalAlarmCount ?? 0),
      // The legacy contract has no distinct-asset or source breakdown. Do not
      // fabricate per-source counts while an old backend instance is draining.
      affectedAssetCount: 0,
      solarAffectedAssetCount: 0,
      storageAffectedAssetCount: 0,
      chargingAffectedAssetCount: 0,
    },
    telemetryQuality: payload.telemetryQuality ?? 'SIMULATED',
  };
}

export const carbonCockpitApi = {
  async overview() {
    const payload = await request<CarbonCockpitOverviewWire>(
      '/api/v1/cockpit/carbon',
      {},
      { trackRouteLoading: false },
    );
    return normalizeOverview(payload);
  },
};
