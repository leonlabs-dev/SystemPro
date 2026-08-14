export const meterPermissions = {
  view: 'platform:meter:management:view',
  create: 'platform:meter:management:create',
  update: 'platform:meter:management:update',
  delete: 'platform:meter:management:delete',
} as const;

export const meteringPermissions = {
  view: 'platform:metering:configuration:view',
  create: 'platform:metering:configuration:create',
  update: 'platform:metering:configuration:update',
  delete: 'platform:metering:configuration:delete',
} as const;

export const energyRelationPermissions = {
  view: 'platform:energy:relation:view',
  create: 'platform:energy:relation:create',
  change: 'platform:energy:relation:change',
  end: 'platform:energy:relation:end',
  advanced: 'platform:energy:relation:advanced',
} as const;

export const usageBillingPermissions = {
  view: 'platform:finance:bill:generation:view',
  snapshot: 'platform:finance:bill:generation:generate',
  export: 'platform:finance:bill:generation:export',
} as const;

export const tariffPlanPermissions = {
  view: 'platform:tariff:plan:view',
  create: 'platform:tariff:plan:create',
  update: 'platform:tariff:plan:update',
  delete: 'platform:tariff:plan:delete',
} as const;

export const submeteringPermissions = {
  view: 'platform:submetering:view',
  create: 'platform:submetering:create',
  update: 'platform:submetering:update',
  delete: 'platform:submetering:delete',
} as const;

export const lossAnalysisPermissions = {
  view: 'platform:loss:analysis:view',
  export: 'platform:loss:analysis:export',
} as const;

export const subitemReportPermissions = {
  view: 'platform:subitem:report:view',
  export: 'platform:subitem:report:export',
} as const;
