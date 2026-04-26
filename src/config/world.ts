import type { Position } from '../types';

export const WORLD_WIDTH = 16000;
export const WORLD_HEIGHT = 16000;
export const GRID_SIZE = 200;
export const MAJOR_GRID_SIZE = 1000;
export const POSITION_SCALE = 0.3;

export const STATIC_WATER_PARTICLE_COUNT = 3500;
export const WIND_PARTICLE_COUNT = 2400;
export const CURRENT_PARTICLE_COUNT = 1600;
export const TRAIL_POOL_SIZE = 180;

export const MINIMAP_SIZE = 200;

export const WIND_ALPHA_BUCKETS = [0.2, 0.35, 0.5];
export const CURRENT_ALPHA_BUCKETS = [0.15, 0.25, 0.4];

export const BUOYS: Position[] = [
  { x: WORLD_WIDTH / 2 + 1500, y: WORLD_HEIGHT / 2 - 1500 },
  { x: WORLD_WIDTH / 2 - 1500, y: WORLD_HEIGHT / 2 - 1500 },
  { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 + 2000 },
  { x: WORLD_WIDTH / 2 + 3000, y: WORLD_HEIGHT / 2 + 1000 },
  { x: WORLD_WIDTH / 2 - 3000, y: WORLD_HEIGHT / 2 + 1000 },
];
