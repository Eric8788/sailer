import { DEFAULT_BOAT_ID } from '../config/boats';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../config/world';
import type { EnvironmentState, GameState } from '../types';

export function createInitialEnvironment(): EnvironmentState {
  return {
    tws: 15,
    twd: 0,
    currentSpeed: 0.8,
    currentDir: 90,
  };
}

export function createInitialGameState(boatId = DEFAULT_BOAT_ID): GameState {
  return {
    boatId,
    boatPosition: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
    boatHeading: 90,
    boatSpeed: 0,
    heelAngle: 0,
    rudderAngle: 0,
    sailTrim: 50,
    crewWeightOffset: 0,
    currentSailAngle: 0,
    centerboardDown: 100,
    prevRudderAngle: 0,
    capsize: false,
  };
}
