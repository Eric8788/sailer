import type { Application, Container, Graphics, Text } from 'pixi.js';

export interface BoatConfig {
  name: string;
  crew: number;
  length: number;
  mass: number;
  dragCoeff: number;
  driveCoeff: number;
  heelCoeff: number;
  turnCoeff: number;
  maxRudder: number;
  capsizeAngle: number;
  noGoMin: number;
  noGoMax: number;
  hullScale: number;
  sailLength: number;
  mastY: number;
  hikingPower: number;
  hasSails: string[];
}

export interface Position {
  x: number;
  y: number;
}

export interface EnvironmentState {
  tws: number;
  twd: number;
  currentSpeed: number;
  currentDir: number;
}

export interface ControlState {
  turnLeft: boolean;
  turnRight: boolean;
  trimIn: boolean;
  easeOut: boolean;
  crewLeft: boolean;
  crewRight: boolean;
  boardDown: boolean;
  boardUp: boolean;
}

export interface GameState {
  boatId: string;
  boatPosition: Position;
  boatHeading: number;
  boatSpeed: number;
  heelAngle: number;
  rudderAngle: number;
  sailTrim: number;
  crewWeightOffset: number;
  currentSailAngle: number;
  centerboardDown: number;
  prevRudderAngle: number;
  capsize: boolean;
}

export interface HudSnapshot {
  boatName: string;
  twd: number;
  tws: number;
  boatPosition: Position;
  awaRelativeToBoat: number;
  aws: number;
  currentSpeed: number;
  currentDir: number;
  leewayAngle: number;
  boatHeading: number;
  boatSpeed: number;
  heelAngle: number;
  sailTrim: number;
  rudderAngle: number;
  crewWeightOffset: number;
  centerboardDown: number;
}

export type VectorKey = 'awa' | 'drive' | 'drag' | 'heel' | 'total' | 'crew';

export type VectorVisibility = Record<VectorKey, boolean>;

export interface RenderSnapshot {
  boatPosition: Position;
  boatHeading: number;
  boatSpeed: number;
  tws: number;
  currentSpeed: number;
  heelAngle: number;
  heelScale: number;
  rudderAngle: number;
  sailTrim: number;
  sailAngleDeg: number;
  crewWeightOffset: number;
  windFlowRad: number;
  currentFlowRad: number;
  headingRad: number;
  aws: number;
  awaRelativeToBoat: number;
  driveForce: number;
  waterResistance: number;
  heelingForce: number;
  tackSign: number;
  leewayAngle: number;
  moveRad: number;
  crewForceX: number;
  capsize: boolean;
}

export interface PhysicsStepResult {
  nextState: GameState;
  hud: HudSnapshot;
  render: RenderSnapshot;
}

export interface Particle {
  x: number;
  y: number;
  len: number;
  speed: number;
  bucket: number;
}

export interface TrailNode {
  graphics: Graphics;
  life: number;
  active: boolean;
  baseAlpha: number;
}

export interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayLayout {
  viewportLeft: number;
  viewportRight: number;
  viewportCenterX: number;
  minimapRect: OverlayRect | null;
  compassRect: OverlayRect | null;
}

export interface SceneRefs {
  app: Application;
  boat: BoatConfig;
  worldContainer: Container;
  boatContainer: Container;
  boatGraphics: Graphics;
  tillerGraphics: Graphics;
  crewGraphics: Graphics;
  sailGraphics: Graphics;
  vectorGraphics: Record<VectorKey, Graphics>;
  vectorLabels: Record<VectorKey, Text>;
  windCompassContainer: Container;
  compassArrow: Graphics;
  minimapContainer: Container;
  mmBoat: Graphics;
  capsizeText: Text;
  windParticles: Particle[];
  currentParticles: Particle[];
  windStreakLayers: Graphics[];
  currentStreakLayers: Graphics[];
  trailPool: TrailNode[];
  trailCursor: number;
}
