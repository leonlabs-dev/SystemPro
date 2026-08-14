export default {
  common: {
    refresh: 'Refresh', exportExcel: 'Export Excel', search: 'Search', reset: 'Reset',
    start: 'Start time', end: 'End time', range: 'to', unboundMeter: 'No meter bound',
    simulatedReading: 'Simulated reading', save: 'Save', cancel: 'Cancel', edit: 'Edit', endAction: 'End',
    active: 'Active', ended: 'Ended', longTerm: 'Ongoing', operation: 'Actions', status: 'Status',
  },
  relation: { TOTAL_SUB: 'Main / Sub Meter', INPUT_OUTPUT: 'Input / Output', VIRTUAL_AGGREGATION: 'Virtual Aggregation' },
  submetering: {
    title: 'Electricity Submetering', create: 'New Topology', edit: 'Edit Topology', keyword: 'Point / meter name', allRelations: 'All relations', electricity: 'Electricity', allStatus: 'All statuses',
    kpi: { total: 'Topologies', active: 'Active', parent: 'Main Points', child: 'Subitem Points', available: 'Available Electricity Points' },
    columns: { parent: 'Main Metering Point', child: 'Subitem Metering Point', relation: 'Relation', factor: 'Factor', validFrom: 'Effective From' },
    form: { parent: 'Main Metering Point', child: 'Subitem Metering Point', relation: 'Relation', factor: 'Factor', validFrom: 'Effective From', remark: 'Remark', selectParent: 'Select a main metering point', parentFirst: 'Select a main point first', selectChild: 'Select a subitem metering point' },
    empty: { title: 'No metering topology', description: 'Generate metering points from usage relations, then create an authoritative main/sub-meter topology.' },
    messages: { loadFailed: 'Failed to load submetering data', optionFailed: 'Failed to load available metering points', saveFailed: 'Failed to save topology', endFailed: 'Failed to end topology', selectPoints: 'Select both main and subitem metering points', saved: 'Submetering topology saved', ended: 'Topology ended', endTitle: 'End Topology', endConfirm: 'The effective-dated history will be retained. End this main/sub-meter relation?' },
  },
  loss: {
    title: 'Electricity Loss Analysis', boundary: 'Reading Boundary', boundaryHint: 'Electricity topology and usage relations come from real APIs; current usage values are controlled simulations.',
    kpi: { input: 'Main Meter Usage', allocated: 'Allocated Submeter Usage', loss: 'Line Loss', rate: 'Overall Loss Rate' },
    columns: { parent: 'Main Metering Point', children: 'Submeters', input: 'Main Usage', allocated: 'Allocated Usage', difference: 'Difference', rate: 'Loss Rate' },
    status: { NORMAL: 'Normal', WARNING: 'Attention', ABNORMAL: 'Abnormal' },
    empty: { title: 'No topology to analyze', description: 'Create an active main/sub-meter relation in Submetering first.' },
    messages: { loadFailed: 'Failed to load analysis', exportFailed: 'Export failed' },
  },
  report: {
    title: 'Subitem Energy Report',
    kpi: { parent: 'Main Metering Points', subitem: 'Subitem Points', usage: 'Adjusted Usage', source: 'Reading Source' },
    columns: { parent: 'Main Metering Point', subitem: 'Subitem Metering Point', relation: 'Topology', factor: 'Factor', raw: 'Raw Usage', adjusted: 'Adjusted Usage', validity: 'Validity' },
    empty: { title: 'No subitem usage data', description: 'Create an active electricity main/sub-meter topology in Submetering first.' },
    messages: { loadFailed: 'Failed to load the subitem energy report', exportFailed: 'Failed to export the report' },
  },
};
