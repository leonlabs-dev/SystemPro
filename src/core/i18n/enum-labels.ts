export type EnumLabelDomain =
  | 'systemType'
  | 'deviceSubtype'
  | 'accessMode'
  | 'systemMode'
  | 'assetStatus'
  | 'modelStatus'
  | 'connectionType'
  | 'purposeType'
  | 'calculationMethod'
  | 'sourceBoundary'
  | 'dimensionType'
  | 'qualityStatus'
  | 'correctionType'
  | 'meteringSourceType'
  | 'approvalStatus'
  | 'adjustmentType'
  | 'physicalRole';

type LabelCatalog = Record<EnumLabelDomain, Record<string, string>>;

const zhCN: LabelCatalog = {
  systemType: {
    HVAC: '空调系统', LIGHTING: '照明系统', PARKING: '停车系统', CHARGING: '充电系统',
    SOLAR: '光伏系统', STORAGE: '储能系统',
  },
  deviceSubtype: {
    CHILLER: '冷水机组', CHILLED_WATER_PUMP: '冷冻水泵', COOLING_WATER_PUMP: '冷却水泵',
    COOLING_TOWER: '冷却塔', AHU: '空调箱', AIR_HANDLING_UNIT: '空调箱', FCU: '风机盘管',
    FAN_COIL: '风机盘管', OUTDOOR_UNIT: '室外机', INDOOR_UNIT: '室内机',
    FRESH_AIR_UNIT: '新风机组', CONTROLLER: '控制器', COLD_METER: '冷量表',
    DISTRIBUTION_CABINET: '配电柜', LIGHTING_CIRCUIT: '照明回路', LIGHT_CONTROLLER: '照明控制器',
    LUMINAIRE_GROUP: '灯具组', LUMINAIRE: '灯具', CEILING_LIGHT: '吸顶灯', LINEAR_LIGHT: '线性灯',
    DOWNLIGHT: '筒灯', PENDANT_LIGHT: '吊灯', SPOTLIGHT: '射灯', INDUSTRIAL_LIGHT: '工矿灯',
    WALL_LIGHT: '壁灯', STREET_LIGHT: '路灯', BARRIER_GATE: '道闸', LANE_CONTROLLER: '车道控制器',
    CAMERA: '识别相机', SPACE_DETECTOR: '车位检测器', VEHICLE_DETECTOR: '车辆检测器',
    CHARGER: '充电桩', CONNECTOR: '充电枪', POWER_CONTROLLER: '功率控制器',
    PV_ARRAY: '光伏方阵', INVERTER: '逆变器', COMBINER_BOX: '汇流箱',
    GRID_CONNECTION_CABINET: '并网柜', PCS: '储能变流器', BMS: '电池管理系统',
    BATTERY_CLUSTER: '电池簇', BATTERY_PACK: '电池包',
  },
  accessMode: {
    GATEWAY: '网关接入', DIRECT: '设备直连', MANUAL: '人工维护', '4G': '4G 蜂窝网络',
    NB_IOT: 'NB-IoT', MQTT: 'MQTT 接入', MODBUS: 'Modbus 接入', API: '接口接入',
  },
  systemMode: {
    CENTRAL: '中央空调', SPLIT: '分体空调', VRF: '多联机', FRESH_AIR: '新风系统',
    CENTRALIZED: '集中控制', DISTRIBUTED: '分布控制', HYBRID: '混合模式',
    SELF_OPERATED: '自主运营', OUTSOURCED: '委托运营', PUBLIC: '公共充电站',
    PRIVATE: '专用充电站', FLEET: '车队充电站', SELF_USE: '自发自用',
    SELF_USE_SURPLUS_EXPORT: '自发自用、余电上网', FULL_EXPORT: '全额上网',
    GRID_CONNECTED: '并网运行', OFF_GRID: '离网运行',
  },
  assetStatus: { ACTIVE: '启用', DISABLED: '停用', ENABLED: '启用', INACTIVE: '停用' },
  modelStatus: { PUBLISHED: '已发布', DRAFT: '草稿', RETIRED: '已退役' },
  connectionType: { SUPPLY: '常态供电', TRANSFER: '能量转移', PARALLEL: '并联', BACKUP: '备用供电' },
  purposeType: {
    TENANT: '租户用能', COMMON: '公共区域', SYSTEM: '设备系统', CHARGING: '充电服务',
    GENERATION: '发电计量', STORAGE: '储能计量',
  },
  calculationMethod: {
    MEASURED: '实表计量', SUM: '下级汇总', DIFFERENCE: '差额计算',
    RATIO_ALLOCATION: '比例分摊', FORMULA: '受控公式', MANUAL_ESTIMATE: '审批估算',
    RESIDUAL: '未解释差额',
  },
  sourceBoundary: { STORED_INTERVAL_ENERGY: '已入库的区间计量数据' },
  dimensionType: {
    SPACE: '空间', TENANT: '租户', END_USE: '用能分项', SYSTEM: '设备系统', DEVICE: '设备',
    CUSTOM: '自定义', RESIDUAL: '未解释差额',
  },
  qualityStatus: {
    GOOD: '正常', CORRECTED: '已修正', ESTIMATED: '估算', SUSPECT: '可疑', MISSING: '缺失',
    CALCULATED: '系统计算',
  },
  correctionType: {
    MULTIPLIER: 'CT/PT 倍率修正', METER_REPLACEMENT: '换表衔接', ROLLOVER: '清零或翻转',
    DIRECTION: '正反向修正', TIME_ALIGNMENT: '时间对齐', MISSING_ESTIMATE: '缺失估算',
    DEDUPLICATION: '重复去重', OUTLIER: '异常突变修正',
  },
  meteringSourceType: {
    DEMO_IMPORT: '批量导入', MANUAL_IMPORT: '批量导入', MQTT: 'MQTT 采集', MODBUS: 'Modbus 采集',
    API: '接口采集', WORK_ORDER: '工单', METER_EVENT: '表计事件', SETTLEMENT_DOCUMENT: '结算凭证',
    IMPORT_DOCUMENT: '导入凭证',
  },
  approvalStatus: { PENDING: '待审批', APPROVED: '已批准', REJECTED: '已驳回' },
  adjustmentType: {
    TEMPORARY_BYPASS: '临时旁路跨界', BOUNDARY_CHANGEOVER: '计量边界切换',
    EXTERNAL_TRANSFER: '外送、转供或反送', DOCUMENTED_AUXILIARY_LOAD: '有凭证辅助用电',
  },
  physicalRole: {
    SOURCE: '电源入口', TRANSFER: '输配节点', STORAGE: '储能单元', CONSUMER: '用电负荷',
    METER: '计量节点', BOUNDARY: '计量边界',
  },
};

const enUS: LabelCatalog = {
  systemType: { HVAC: 'HVAC', LIGHTING: 'Lighting', PARKING: 'Parking', CHARGING: 'Charging', SOLAR: 'Solar PV', STORAGE: 'Energy storage' },
  deviceSubtype: {},
  accessMode: { GATEWAY: 'Gateway', DIRECT: 'Direct', MANUAL: 'Manual', '4G': '4G cellular', NB_IOT: 'NB-IoT', MQTT: 'MQTT', MODBUS: 'Modbus', API: 'API' },
  systemMode: {},
  assetStatus: { ACTIVE: 'Active', DISABLED: 'Disabled', ENABLED: 'Enabled', INACTIVE: 'Inactive' },
  modelStatus: { PUBLISHED: 'Published', DRAFT: 'Draft', RETIRED: 'Retired' },
  connectionType: { SUPPLY: 'Supply', TRANSFER: 'Transfer', PARALLEL: 'Parallel', BACKUP: 'Backup supply' },
  purposeType: { TENANT: 'Tenant usage', COMMON: 'Common area', SYSTEM: 'Device system', CHARGING: 'Charging service', GENERATION: 'Generation', STORAGE: 'Energy storage' },
  calculationMethod: { MEASURED: 'Metered', SUM: 'Child total', DIFFERENCE: 'Difference', RATIO_ALLOCATION: 'Ratio allocation', FORMULA: 'Controlled formula', MANUAL_ESTIMATE: 'Approved estimate', RESIDUAL: 'Unexplained difference' },
  sourceBoundary: { STORED_INTERVAL_ENERGY: 'Stored interval metering data' },
  dimensionType: { SPACE: 'Space', TENANT: 'Tenant', END_USE: 'End use', SYSTEM: 'Device system', DEVICE: 'Device', CUSTOM: 'Custom', RESIDUAL: 'Unexplained difference' },
  qualityStatus: { GOOD: 'Good', CORRECTED: 'Corrected', ESTIMATED: 'Estimated', SUSPECT: 'Suspect', MISSING: 'Missing', CALCULATED: 'Calculated' },
  correctionType: {},
  meteringSourceType: { DEMO_IMPORT: 'Batch import', MANUAL_IMPORT: 'Batch import', MQTT: 'MQTT', MODBUS: 'Modbus', API: 'API', WORK_ORDER: 'Work order', METER_EVENT: 'Meter event', SETTLEMENT_DOCUMENT: 'Settlement document', IMPORT_DOCUMENT: 'Import document' },
  approvalStatus: { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' },
  adjustmentType: {},
  physicalRole: { SOURCE: 'Power source', TRANSFER: 'Transfer node', STORAGE: 'Storage', CONSUMER: 'Load', METER: 'Metering node', BOUNDARY: 'Metering boundary' },
};

function readableEnglish(value: string) {
  return value.toLowerCase().split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

export function enumLabel(domain: EnumLabelDomain, value?: string | null, locale = 'zh-CN') {
  if (!value) return '—';
  const normalized = value.trim().toUpperCase();
  const catalog = locale === 'en-US' ? enUS : zhCN;
  const translated = catalog[domain][normalized];
  if (translated) return translated;
  return locale === 'en-US' ? readableEnglish(value) : '待维护';
}
