import { meterApiRepository } from './meter.api';
import type { MeterRepository } from './types';

export const meterRepository: MeterRepository = meterApiRepository;
export const meterDataSource = 'api' as const;
