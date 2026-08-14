export default {
  common: {
    refresh: '刷新', exportExcel: '导出 Excel', search: '查询', reset: '重置',
    start: '开始时间', end: '结束时间', range: '至', unboundMeter: '未绑定表计',
    simulatedReading: '演示读数', save: '保存', cancel: '取消', edit: '编辑', endAction: '终止',
    active: '有效', ended: '已终止', longTerm: '长期', operation: '操作', status: '状态',
  },
  relation: { TOTAL_SUB: '总表 / 分表', INPUT_OUTPUT: '输入 / 输出', VIRTUAL_AGGREGATION: '虚拟聚合' },
  submetering: {
    title: '电力分项计量', create: '新增拓扑', edit: '编辑拓扑', keyword: '计量点 / 表计名称', allRelations: '全部关系', electricity: '电力', allStatus: '全部状态',
    kpi: { total: '拓扑总数', active: '有效拓扑', parent: '总表计量点', child: '分表计量点', available: '可用电力计量点' },
    columns: { parent: '总表计量点', child: '分表计量点', relation: '关系类型', factor: '折算系数', validFrom: '生效时间' },
    form: { parent: '总表计量点', child: '分表计量点', relation: '关系类型', factor: '折算系数', validFrom: '生效时间', remark: '备注', selectParent: '请选择总表计量点', parentFirst: '请先选择总表计量点', selectChild: '请选择分表计量点' },
    empty: { title: '暂无总分表拓扑', description: '先通过用能关系生成计量点，再建立总表与分表之间的真实拓扑。' },
    messages: { loadFailed: '分项计量数据加载失败', optionFailed: '可选计量点加载失败', saveFailed: '拓扑保存失败', endFailed: '拓扑终止失败', selectPoints: '请选择总表和分表计量点', saved: '分项计量拓扑已保存', ended: '拓扑已终止', endTitle: '终止拓扑', endConfirm: '终止后保留历史有效期，确认终止该总分表关系？' },
  },
  loss: {
    title: '电力损耗分析', boundary: '电力读数边界', boundaryHint: '电力拓扑和用能关系来自真实接口；当前电量来自隔离演示读数。',
    kpi: { input: '总表电量', allocated: '分表折算电量', loss: '线损电量', rate: '综合线损率' },
    columns: { parent: '总表计量点', children: '分表数', input: '总表用量', allocated: '分表折算用量', difference: '差额', rate: '损耗率' },
    status: { NORMAL: '正常', WARNING: '关注', ABNORMAL: '异常' },
    empty: { title: '暂无可分析拓扑', description: '请先在“分项计量”建立有效的总分表关系。' },
    messages: { loadFailed: '分析数据加载失败', exportFailed: '导出失败' },
  },
  report: {
    title: '电力分项用能报表',
    kpi: { parent: '总表计量点', subitem: '分项计量点', usage: '折算后用量', source: '读数来源' },
    columns: { parent: '总表计量点', subitem: '分项计量点', relation: '拓扑关系', factor: '折算系数', raw: '原始用量', adjusted: '折算用量', validity: '有效期' },
    empty: { title: '暂无分项用能数据', description: '请先在分项计量中建立有效的电力总表 / 分表拓扑。' },
    messages: { loadFailed: '分项用能报表加载失败', exportFailed: '报表导出失败' },
  },
};
