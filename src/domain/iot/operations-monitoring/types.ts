export type MonitoringDataQuality = 'CONFIGURATION_ONLY';
export type MonitoringRuntimeStatus = 'NO_TELEMETRY';
export type MonitoringConsistency = 'ALIGNED' | 'NO_ACCESS' | 'ACCESS_DISABLED' | 'INCOMPLETE';

export interface MonitoringSummary { total: number; configured: number; unconfigured: number; attention: number }
export interface MonitoringEnvelope { generatedAt: string; dataQuality: MonitoringDataQuality; telemetryConnected: boolean; summary: MonitoringSummary }
export interface MonitoringPageEnvelope { total: number; page: number; pageSize: number }

export interface MonitoringDevice {
  id: number; code: string; name: string; systemType: string; systemId: number; systemName: string;
  subtype: string; roleCode?: string; installSpaceName?: string; assetStatus: string; assetVersion: number;
  accessMode?: string; protocolTemplate?: string; deviceIdentifier?: string; gatewayName?: string;
  channelCode?: string; heartbeatSeconds?: number; firmwareVersion?: string; accessStatus?: string;
  accessVersion?: number; runtimeStatus: MonitoringRuntimeStatus; lastSeenAt?: string;
  consistencyState: MonitoringConsistency; displayNameSource: 'ASSET_MASTER'; catalogUpdatedAt: string;
}
export interface DeviceMonitoringPage extends MonitoringEnvelope, MonitoringPageEnvelope { systemTypes: string[]; devices: MonitoringDevice[] }

export interface MonitoringGatewayChannel {
  assetId: number; assetCode: string; assetName: string; systemType: string; protocolTemplate?: string;
  channelCode?: string; accessStatus?: string; runtimeStatus: MonitoringRuntimeStatus; consistencyState: MonitoringConsistency;
}
export interface MonitoringGateway { name: string; runtimeStatus: MonitoringRuntimeStatus; lastSeenAt?: string; configuredDeviceCount: number; incompleteDeviceCount: number }
export interface GatewayMonitoringPage extends MonitoringEnvelope, MonitoringPageEnvelope { unboundDeviceCount: number; boundDeviceCount: number; incompleteDeviceCount: number; gateways: MonitoringGateway[] }
export interface GatewayChannelMonitoringPage extends MonitoringPageEnvelope { generatedAt: string; dataQuality: MonitoringDataQuality; telemetryConnected: boolean; gatewayName: string; channels: MonitoringGatewayChannel[] }

export interface MonitoringGridNode {
  systemId: number; systemCode: string; systemName: string; systemType: 'SOLAR' | 'STORAGE'; configuredMode?: string;
  runtimeMode: 'NO_TELEMETRY'; gridAvailability: 'UNKNOWN'; interlockState: 'NOT_EVALUATED'; lastTransitionAt?: string;
  status: string; assetCount: number; catalogUpdatedAt: string;
}
export interface GridMonitoringPage extends MonitoringEnvelope, MonitoringPageEnvelope { configuredCount: number; solarCount: number; storageCount: number; systems: MonitoringGridNode[] }

export interface MonitoringVideoChannel {
  assetId: number; assetCode: string; assetName: string; systemName: string; installSpaceName?: string;
  gatewayName?: string; channelCode?: string; protocolTemplate?: string; assetStatus: string; accessStatus?: string;
  streamState: 'NOT_CONNECTED'; lastFrameAt?: string; placeholderState: 'NO_LIVE_STREAM'; consistencyState: MonitoringConsistency;
}
export interface VideoMonitoringPage extends MonitoringEnvelope, MonitoringPageEnvelope { channels: MonitoringVideoChannel[] }
