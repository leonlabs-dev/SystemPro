import type { ParkingZone, SimulatedParkingSpace } from './types';

export const PARKING_MAP_WIDTH = 1536;
export const PARKING_MAP_HEIGHT = 1024;

interface RowDefinition {
  zone: ParkingZone;
  x: number;
  y: number;
  count: number;
  step: number;
  width: number;
  height: number;
  vertical?: boolean;
}

const ROWS: RowDefinition[] = [
  { zone: 'A', x: 184, y: 160, count: 5, step: 33, width: 28, height: 49 },
  { zone: 'A', x: 414, y: 160, count: 6, step: 31, width: 26, height: 49 },
  { zone: 'A', x: 652, y: 160, count: 6, step: 32, width: 27, height: 49 },
  { zone: 'A', x: 893, y: 160, count: 5, step: 32, width: 27, height: 49 },
  { zone: 'A', x: 1090, y: 160, count: 6, step: 34, width: 29, height: 49 },
  { zone: 'B', x: 380, y: 368, count: 7, step: 31, width: 27, height: 47 },
  { zone: 'C', x: 860, y: 368, count: 14, step: 31.5, width: 27, height: 47 },
  { zone: 'B', x: 381, y: 474, count: 7, step: 31, width: 27, height: 42 },
  { zone: 'C', x: 860, y: 474, count: 15, step: 31.3, width: 27, height: 42 },
  { zone: 'B', x: 268, y: 562, count: 16, step: 31, width: 27, height: 47 },
  { zone: 'C', x: 764, y: 562, count: 16, step: 31, width: 27, height: 47 },
  { zone: 'D', x: 225, y: 685, count: 35, step: 31.4, width: 27, height: 50 },
  { zone: 'D', x: 140, y: 811, count: 6, step: 34, width: 29, height: 39 },
  { zone: 'D', x: 375, y: 811, count: 7, step: 31.5, width: 27, height: 39 },
  { zone: 'D', x: 611, y: 811, count: 7, step: 31.5, width: 27, height: 39 },
  { zone: 'D', x: 852, y: 811, count: 6, step: 32, width: 28, height: 39 },
  { zone: 'D', x: 1072, y: 811, count: 7, step: 31, width: 27, height: 39 },
  { zone: 'D', x: 1299, y: 811, count: 4, step: 32, width: 28, height: 39 },
  { zone: 'B', x: 139, y: 266, count: 17, step: 32, width: 39, height: 27, vertical: true },
  { zone: 'C', x: 1381, y: 632, count: 5, step: 30, width: 43, height: 25, vertical: true },
];

export const PARKING_ZONES: Array<{ code: ParkingZone; x: number; y: number }> = [
  { code: 'A', x: 700, y: 270 },
  { code: 'B', x: 260, y: 525 },
  { code: 'C', x: 1160, y: 525 },
  { code: 'D', x: 700, y: 765 },
];

export const PARKING_BAY_LAYOUT: Omit<SimulatedParkingSpace, 'status'>[] = ROWS.flatMap((row, rowIndex) =>
  Array.from({ length: row.count }, (_, index) => ({
    id: `SIM-${String(rowIndex + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
    label: `${row.zone}${String(index + 1).padStart(3, '0')}`,
    zone: row.zone,
    x: row.x + (row.vertical ? 0 : index * row.step),
    y: row.y + (row.vertical ? index * row.step : 0),
    width: row.width,
    height: row.height,
  })),
);
