import { describe, expect, it } from 'vitest';

import { BOAT_CONFIGS, DEFAULT_BOAT_ID } from '../src/config/boats';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../src/config/world';
import { computeNoGoFactor, sampleFrame, stepPhysics } from '../src/game/physics';
import { createInitialEnvironment, createInitialGameState } from '../src/game/state';

describe('physics helpers', () => {
  it('detects port and starboard apparent wind correctly', () => {
    const portState = createInitialGameState(DEFAULT_BOAT_ID);
    portState.boatHeading = 0;

    const portEnvironment = createInitialEnvironment();
    portEnvironment.twd = 270;

    const portFrame = sampleFrame(portState, portEnvironment);
    expect(portFrame.hud.awaRelativeToBoat).toBeLessThan(0);
    expect(portFrame.render.tackSign).toBe(1);

    const starboardEnvironment = createInitialEnvironment();
    starboardEnvironment.twd = 90;

    const starboardFrame = sampleFrame(portState, starboardEnvironment);
    expect(starboardFrame.hud.awaRelativeToBoat).toBeGreaterThan(0);
    expect(starboardFrame.render.tackSign).toBe(-1);
  });

  it('blends through the no-go zone progressively', () => {
    const boat = BOAT_CONFIGS[DEFAULT_BOAT_ID];

    expect(computeNoGoFactor(10, boat)).toBe(0);
    expect(computeNoGoFactor(boat.noGoMin, boat)).toBe(0);
    expect(computeNoGoFactor((boat.noGoMin + boat.noGoMax) / 2, boat)).toBeCloseTo(0.5);
    expect(computeNoGoFactor(boat.noGoMax + 5, boat)).toBe(1);
  });

  it('applies stronger leeway when the centerboard is raised', () => {
    const boardDownState = createInitialGameState(DEFAULT_BOAT_ID);
    boardDownState.boatHeading = 0;
    boardDownState.boatSpeed = 3;
    boardDownState.centerboardDown = 100;

    const boardUpState = createInitialGameState(DEFAULT_BOAT_ID);
    boardUpState.boatHeading = 0;
    boardUpState.boatSpeed = 3;
    boardUpState.centerboardDown = 0;

    const environment = createInitialEnvironment();
    environment.twd = 270;
    environment.tws = 20;
    environment.currentSpeed = 0;

    const controls = {
      turnLeft: false,
      turnRight: false,
      trimIn: false,
      easeOut: false,
      crewLeft: false,
      crewRight: false,
      boardDown: false,
      boardUp: false,
    };

    const boardDownResult = stepPhysics(boardDownState, controls, environment, 1);
    const boardUpResult = stepPhysics(boardUpState, controls, environment, 1);

    const boardDownDrift = boardDownResult.nextState.boatPosition.x - boardDownState.boatPosition.x;
    const boardUpDrift = boardUpResult.nextState.boatPosition.x - boardUpState.boatPosition.x;

    expect(Math.abs(boardUpDrift)).toBeGreaterThan(Math.abs(boardDownDrift));
  });

  it('adds current drift independently from boat drive', () => {
    const stillState = createInitialGameState(DEFAULT_BOAT_ID);
    stillState.boatHeading = 0;
    stillState.boatSpeed = 0;

    const calmEnvironment = createInitialEnvironment();
    calmEnvironment.tws = 0;
    calmEnvironment.currentSpeed = 0;

    const currentEnvironment = createInitialEnvironment();
    currentEnvironment.tws = 0;
    currentEnvironment.currentSpeed = 1;
    currentEnvironment.currentDir = 90;

    const controls = {
      turnLeft: false,
      turnRight: false,
      trimIn: false,
      easeOut: false,
      crewLeft: false,
      crewRight: false,
      boardDown: false,
      boardUp: false,
    };

    const calmResult = stepPhysics(stillState, controls, calmEnvironment, 1);
    const currentResult = stepPhysics(stillState, controls, currentEnvironment, 1);
    const driftDifference = currentResult.nextState.boatPosition.x - calmResult.nextState.boatPosition.x;

    expect(driftDifference).toBeCloseTo(0.3);
  });

  it('clamps rudder angle and world bounds', () => {
    const state = createInitialGameState(DEFAULT_BOAT_ID);
    state.rudderAngle = 34.8;
    state.boatHeading = 315;
    state.boatSpeed = 8;
    state.boatPosition = { x: 1, y: 1 };

    const environment = createInitialEnvironment();
    environment.tws = 0;
    environment.currentSpeed = 0;

    const result = stepPhysics(
      state,
      {
        turnLeft: true,
        turnRight: false,
        trimIn: false,
        easeOut: false,
        crewLeft: false,
        crewRight: false,
        boardDown: false,
        boardUp: false,
      },
      environment,
      10,
    );

    expect(result.nextState.rudderAngle).toBeLessThanOrEqual(BOAT_CONFIGS[DEFAULT_BOAT_ID].maxRudder);
    expect(result.nextState.boatPosition.x).toBeGreaterThanOrEqual(0);
    expect(result.nextState.boatPosition.y).toBeGreaterThanOrEqual(0);
    expect(result.nextState.boatPosition.x).toBeLessThanOrEqual(WORLD_WIDTH);
    expect(result.nextState.boatPosition.y).toBeLessThanOrEqual(WORLD_HEIGHT);
  });
});
