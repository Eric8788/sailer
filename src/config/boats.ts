import type { BoatConfig } from '../types';

export const DEFAULT_BOAT_ID = 'ilca7';

export const BOAT_CONFIGS: Record<string, BoatConfig> = {
  ilca7: {
    name: 'ILCA 7 (Laser)',
    crew: 1,
    length: 4.23,
    mass: 15,
    dragCoeff: 0.05,
    driveCoeff: 0.18,
    heelCoeff: 0.5,
    turnCoeff: 0.004,
    maxRudder: 35,
    capsizeAngle: 45,
    noGoMin: 25,
    noGoMax: 45,
    hullScale: 1,
    sailLength: 90,
    mastY: -20,
    hikingPower: 8,
    hasSails: ['mainsail'],
  },
  '420c': {
    name: '420c',
    crew: 2,
    length: 4.2,
    mass: 18,
    dragCoeff: 0.045,
    driveCoeff: 0.22,
    heelCoeff: 0.45,
    turnCoeff: 0.005,
    maxRudder: 35,
    capsizeAngle: 50,
    noGoMin: 25,
    noGoMax: 42,
    hullScale: 1.05,
    sailLength: 85,
    mastY: -18,
    hikingPower: 10,
    hasSails: ['mainsail', 'jib'],
  },
};
