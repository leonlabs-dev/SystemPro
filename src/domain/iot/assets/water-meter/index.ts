export * from './types';
export * from './water-meter.api';
export const waterMeterPermissions={
  view:'platform:water-meter:management:view',
  create:'platform:water-meter:management:create',
  update:'platform:water-meter:management:update',
  delete:'platform:water-meter:management:delete',
} as const;
