export interface OperationsCockpitOverview {
  summary: { projectCount: number; provinceCount: number; cityCount: number; deviceCount: number; enabledRate: number; occurredTodayAlarmCount: number; currentRiskCount: number };
  projects: { planning: number; delivery: number; operating: number; completed: number; tenantCount: number; serviceAreaSquareMeters: number };
  projectTypes: DistributionItem[];
  regions: DistributionItem[];
  mapPoints: OperationsMapPoint[];
  finance: { billedAmount: number; receivedAmount: number; outstandingAmount: number; collectionRate: number };
  risks: DistributionItem[];
  devices: { enabledDevices: number; unavailableDevices: number; alarmAffectedDevices: number; openWorkOrders: number };
  projectTrend: DailyTrend[];
  alarmTrend: DailyTrend[];
  energyTrend: EnergyTrend[];
  energyMetadata: { currentPeriod: string; comparisonPeriod: string; sourceUnit: string; displayUnit: string; displayDivisor: number };
  generatedAt: string;
}

export interface DistributionItem { code: string; name: string; count: number }
export interface OperationsMapPoint { projectId: number; projectName: string; projectType: string; projectPhase: string; provinceName: string; cityName: string; longitude: number; latitude: number; deviceCount: number; tenantCount: number }
export interface DailyTrend { date: string; value: number; cumulativeValue: number }
export interface EnergyTrend { date: string; currentQuantity: number; previousQuantity: number; currentAvailability: 'AVAILABLE' | 'MISSING'; previousAvailability: 'AVAILABLE' | 'MISSING'; currentQualityStatus: EnergyQualityStatus; previousQualityStatus: EnergyQualityStatus }
export type EnergyQualityStatus = 'GOOD' | 'CORRECTED' | 'ESTIMATED' | 'SUSPECT' | 'MISSING';
