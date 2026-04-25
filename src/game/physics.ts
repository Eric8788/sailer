import { BOAT_CONFIGS } from '../config/boats';
import { POSITION_SCALE, WORLD_HEIGHT, WORLD_WIDTH } from '../config/world';
import type {
  BoatConfig,
  ControlState,
  EnvironmentState,
  GameState,
  HudSnapshot,
  PhysicsStepResult,
  RenderSnapshot,
} from '../types';

const SAIL_SWING_SPEED = 4;

interface DerivedValues {
  aws: number;
  awaRelativeToBoat: number;
  absAwaRel: number;
  absTwaRel: number;
  tackSign: number;
  windFlowRad: number;
  currentFlowRad: number;
  headingRad: number;
  driveForceBase: number;
  heelingForce: number;
  waterResistance: number;
  leewayAngle: number;
  moveRad: number;
}

function resolveBoat(state: GameState): BoatConfig {
  return BOAT_CONFIGS[state.boatId];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeDegrees(value: number): number {
  return (value % 360 + 360) % 360;
}

export function computeRelativeAngle(angle: number, reference: number): number {
  return (angle - reference + 540) % 360 - 180;
}

export function computeNoGoFactor(absTwaRel: number, boat: BoatConfig): number {
  if (absTwaRel >= boat.noGoMax) {
    return 1;
  }

  if (absTwaRel > boat.noGoMin) {
    return (absTwaRel - boat.noGoMin) / (boat.noGoMax - boat.noGoMin);
  }

  return 0;
}

function deriveValues(state: GameState, environment: EnvironmentState, boat: BoatConfig): DerivedValues {
  const trueWindRad = environment.twd * Math.PI / 180;
  const windFlowRad = trueWindRad + Math.PI;
  const twx = environment.tws * Math.sin(windFlowRad);
  const twy = -environment.tws * Math.cos(windFlowRad);

  const headingRad = state.boatHeading * Math.PI / 180;
  const bvx = state.boatSpeed * Math.sin(headingRad);
  const bvy = -state.boatSpeed * Math.cos(headingRad);

  const awx = twx - bvx;
  const awy = twy - bvy;
  const aws = Math.sqrt(awx * awx + awy * awy);

  const apparentWindRad = Math.atan2(awy, awx);
  let awaFlowDirection = (apparentWindRad * 180 / Math.PI + 90) % 360;
  if (awaFlowDirection < 0) {
    awaFlowDirection += 360;
  }

  const apparentWindDirection = (awaFlowDirection + 180) % 360;
  const awaRelativeToBoat = computeRelativeAngle(apparentWindDirection, state.boatHeading);
  const absAwaRel = Math.abs(awaRelativeToBoat);

  const twaRelativeToBoat = computeRelativeAngle(environment.twd, state.boatHeading);
  const absTwaRel = Math.abs(twaRelativeToBoat);
  const tackSign = awaRelativeToBoat < 0 ? 1 : -1;

  const noGoFactor = computeNoGoFactor(absTwaRel, boat);
  let driveForceBase = 0;
  let heelingForce = 0;

  if (noGoFactor > 0) {
    let optimalTrim = 100;
    if (absAwaRel > 45) {
      optimalTrim = Math.max(0, 100 - ((absAwaRel - 45) / 135) * 100);
    }

    const trimError = Math.abs(state.sailTrim - optimalTrim);
    const trimEfficiency = Math.max(0, 1 - trimError / 40);

    driveForceBase = aws * trimEfficiency * boat.driveCoeff * noGoFactor;
    heelingForce =
      aws *
      trimEfficiency *
      Math.sin(absAwaRel * Math.PI / 180) *
      boat.heelCoeff *
      noGoFactor;
  } else {
    const backwindFactor = 1 - absTwaRel / boat.noGoMin;
    driveForceBase = -aws * 0.03 * backwindFactor * (state.sailTrim / 100);
  }

  const cbDragBonus = (state.centerboardDown / 100) * 0.008;
  const waterResistance = state.boatSpeed * Math.abs(state.boatSpeed) * (boat.dragCoeff + cbDragBonus);

  const cbResist = state.centerboardDown / 100;
  const leewayAngle = heelingForce * (1 - cbResist * 0.9) * 0.3;
  const moveRad = headingRad + leewayAngle * Math.PI / 180 * tackSign;

  return {
    aws,
    awaRelativeToBoat,
    absAwaRel,
    absTwaRel,
    tackSign,
    windFlowRad,
    currentFlowRad: environment.currentDir * Math.PI / 180,
    headingRad,
    driveForceBase,
    heelingForce,
    waterResistance,
    leewayAngle,
    moveRad,
  };
}

function buildHudSnapshot(
  state: GameState,
  environment: EnvironmentState,
  boat: BoatConfig,
  derived: DerivedValues,
): HudSnapshot {
  return {
    boatName: boat.name,
    twd: environment.twd,
    tws: environment.tws,
    boatPosition: { ...state.boatPosition },
    awaRelativeToBoat: derived.awaRelativeToBoat,
    aws: derived.aws,
    currentSpeed: environment.currentSpeed,
    currentDir: environment.currentDir,
    leewayAngle: derived.leewayAngle,
    boatHeading: state.boatHeading,
    boatSpeed: state.boatSpeed,
    heelAngle: state.heelAngle,
    sailTrim: state.sailTrim,
    rudderAngle: state.rudderAngle,
    crewWeightOffset: state.crewWeightOffset,
    centerboardDown: state.centerboardDown,
  };
}

function buildRenderSnapshot(
  state: GameState,
  environment: EnvironmentState,
  derived: DerivedValues,
  driveForce: number,
): RenderSnapshot {
  const heelScale = Math.cos(state.heelAngle * Math.PI / 180);

  return {
    boatPosition: { ...state.boatPosition },
    boatHeading: state.boatHeading,
    boatSpeed: state.boatSpeed,
    tws: environment.tws,
    currentSpeed: environment.currentSpeed,
    heelAngle: state.heelAngle,
    heelScale,
    rudderAngle: state.rudderAngle,
    sailTrim: state.sailTrim,
    sailAngleDeg: state.currentSailAngle,
    crewWeightOffset: state.crewWeightOffset,
    windFlowRad: derived.windFlowRad,
    currentFlowRad: derived.currentFlowRad,
    headingRad: derived.headingRad,
    aws: derived.aws,
    awaRelativeToBoat: derived.awaRelativeToBoat,
    driveForce,
    waterResistance: derived.waterResistance,
    heelingForce: derived.heelingForce,
    tackSign: derived.tackSign,
    leewayAngle: derived.leewayAngle,
    moveRad: derived.moveRad,
    crewForceX: (state.crewWeightOffset / 100) * 1.5 * 15,
    capsize: state.capsize,
  };
}

function buildSnapshot(state: GameState, environment: EnvironmentState, boat: BoatConfig, driveForce: number) {
  const derived = deriveValues(state, environment, boat);
  return {
    hud: buildHudSnapshot(state, environment, boat, derived),
    render: buildRenderSnapshot(state, environment, derived, driveForce),
  };
}

function applyControls(
  state: GameState,
  controls: ControlState,
  boat: BoatConfig,
  dt: number,
): void {
  if (controls.turnLeft) {
    state.rudderAngle += 1.5 * dt;
  }

  if (controls.turnRight) {
    state.rudderAngle -= 1.5 * dt;
  }

  state.rudderAngle = clamp(state.rudderAngle, -boat.maxRudder, boat.maxRudder);

  if (!controls.turnLeft && !controls.turnRight) {
    const waterCenterForce = state.boatSpeed * 0.002 * dt;
    if (Math.abs(state.rudderAngle) < waterCenterForce) {
      state.rudderAngle = 0;
    } else {
      state.rudderAngle -= Math.sign(state.rudderAngle) * waterCenterForce;
    }
  }

  if (controls.trimIn) {
    state.sailTrim = clamp(state.sailTrim + 1.5 * dt, 0, 100);
  }

  if (controls.easeOut) {
    state.sailTrim = clamp(state.sailTrim - 1.5 * dt, 0, 100);
  }

  if (controls.crewLeft) {
    state.crewWeightOffset = clamp(state.crewWeightOffset - 2 * dt, -100, 100);
  }

  if (controls.crewRight) {
    state.crewWeightOffset = clamp(state.crewWeightOffset + 2 * dt, -100, 100);
  }

  if (controls.boardDown) {
    state.centerboardDown = clamp(state.centerboardDown + 2 * dt, 0, 100);
  }

  if (controls.boardUp) {
    state.centerboardDown = clamp(state.centerboardDown - 2 * dt, 0, 100);
  }
}

function updateSailAngle(state: GameState, awaRelativeToBoat: number, dt: number): void {
  let targetSailAngleDeg = (100 - state.sailTrim) * 0.9;
  if (awaRelativeToBoat < 0) {
    targetSailAngleDeg = -targetSailAngleDeg;
  }

  const sailDiff = targetSailAngleDeg - state.currentSailAngle;
  const sailSwingSpeed = SAIL_SWING_SPEED * dt;
  if (Math.abs(sailDiff) <= sailSwingSpeed) {
    state.currentSailAngle = targetSailAngleDeg;
  } else {
    state.currentSailAngle += Math.sign(sailDiff) * sailSwingSpeed;
  }
}

export function sampleFrame(state: GameState, environment: EnvironmentState) {
  const boat = resolveBoat(state);
  return buildSnapshot(state, environment, boat, deriveValues(state, environment, boat).driveForceBase);
}

export function stepPhysics(
  state: GameState,
  controls: ControlState,
  environment: EnvironmentState,
  dt: number,
): PhysicsStepResult {
  const boat = resolveBoat(state);

  if (state.capsize) {
    const staticFrame = sampleFrame(state, environment);
    return {
      nextState: { ...state, boatPosition: { ...state.boatPosition } },
      hud: staticFrame.hud,
      render: staticFrame.render,
    };
  }

  const nextState: GameState = {
    ...state,
    boatPosition: { ...state.boatPosition },
  };

  applyControls(nextState, controls, boat, dt);

  const turnRate = -nextState.rudderAngle * (nextState.boatSpeed * boat.turnCoeff) * dt;
  nextState.boatHeading = normalizeDegrees(nextState.boatHeading + turnRate);

  const derived = deriveValues(nextState, environment, boat);

  const rudderAngularVel = dt > 0
    ? Math.abs(nextState.rudderAngle - nextState.prevRudderAngle) / dt
    : 0;
  nextState.prevRudderAngle = nextState.rudderAngle;

  let driveForce = derived.driveForceBase;
  if (nextState.boatSpeed < 2 && rudderAngularVel > 1) {
    driveForce += Math.min(rudderAngularVel * 0.01, 0.3);
  }

  const acceleration = (driveForce - derived.waterResistance) / boat.mass;
  nextState.boatSpeed += acceleration * dt;

  if (Math.abs(nextState.boatSpeed) < 0.05 && driveForce === 0) {
    nextState.boatSpeed = 0;
  }

  nextState.boatPosition.x += nextState.boatSpeed * Math.sin(derived.moveRad) * dt * POSITION_SCALE;
  nextState.boatPosition.y -= nextState.boatSpeed * Math.cos(derived.moveRad) * dt * POSITION_SCALE;

  nextState.boatPosition.x += environment.currentSpeed * Math.sin(derived.currentFlowRad) * dt * POSITION_SCALE;
  nextState.boatPosition.y -= environment.currentSpeed * Math.cos(derived.currentFlowRad) * dt * POSITION_SCALE;

  nextState.boatPosition.x = clamp(nextState.boatPosition.x, 0, WORLD_WIDTH);
  nextState.boatPosition.y = clamp(nextState.boatPosition.y, 0, WORLD_HEIGHT);

  const rightingMoment = (nextState.crewWeightOffset / 100) * boat.hikingPower;
  const targetHeel = (derived.heelingForce * derived.tackSign * 2) - (rightingMoment * derived.tackSign * 0.5);
  nextState.heelAngle += (targetHeel - nextState.heelAngle) * 0.1 * dt;

  updateSailAngle(nextState, derived.awaRelativeToBoat, dt);

  if (Math.abs(nextState.heelAngle) > boat.capsizeAngle) {
    nextState.capsize = true;
  }

  return {
    nextState,
    hud: buildHudSnapshot(nextState, environment, boat, derived),
    render: buildRenderSnapshot(nextState, environment, derived, driveForce),
  };
}
