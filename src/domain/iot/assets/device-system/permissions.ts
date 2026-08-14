import type { DeviceSystemType } from './types';

const prefixes: Record<DeviceSystemType, string> = {
  HVAC: 'platform:hvac:system:',
  LIGHTING: 'platform:lighting:system:',
  PARKING: 'platform:parking:system:',
  CHARGING: 'platform:charging:piles:',
  SOLAR: 'platform:pv:equipment:',
  STORAGE: 'platform:storage:equipment:',
};

export function deviceSystemPermissions(type: DeviceSystemType) {
  const prefix = prefixes[type];
  return {
    view: `${prefix}view`,
    create: `${prefix}create`,
    update: `${prefix}update`,
    delete: `${prefix}delete`,
    control: `${prefix}control`,
  } as const;
}

const devicePrefixes:Record<DeviceSystemType,string>={
  HVAC:'platform:hvac:device:',LIGHTING:'platform:lighting:device:',PARKING:'platform:parking:device:',
  CHARGING:'platform:charging:device:',SOLAR:'platform:pv:device:',STORAGE:'platform:storage:device:',
};

export function deviceAssetPermissions(type:DeviceSystemType){
  const prefix=devicePrefixes[type];
  return {view:`${prefix}view`,update:`${prefix}update`,control:`${prefix}control`,export:`${prefix}export`} as const;
}
