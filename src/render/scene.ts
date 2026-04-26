import { Application, Container, Graphics, Text } from 'pixi.js';

import {
  BUOYS,
  CURRENT_ALPHA_BUCKETS,
  CURRENT_PARTICLE_COUNT,
  GRID_SIZE,
  MAJOR_GRID_SIZE,
  STATIC_WATER_PARTICLE_COUNT,
  TRAIL_POOL_SIZE,
  WIND_ALPHA_BUCKETS,
  WIND_PARTICLE_COUNT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/world';
import type {
  BoatConfig,
  OverlayLayout,
  Particle,
  RenderSnapshot,
  SceneRefs,
  TrailNode,
  VectorKey,
  VectorVisibility,
} from '../types';

const TRAIL_LIFE = 120;
const FORCE_SCALE = 15;
const VECTOR_LABELS: Record<VectorKey, { text: string; color: number; width: number }> = {
  awa: { text: 'AWA', color: 0x00ffff, width: 2 },
  drive: { text: 'Drive', color: 0x4caf50, width: 4 },
  drag: { text: 'Drag', color: 0x9c27b0, width: 3 },
  heel: { text: 'Heel', color: 0xf44336, width: 3 },
  total: { text: 'Total', color: 0xffeb3b, width: 3 },
  crew: { text: 'Crew', color: 0xff9800, width: 3 },
};

interface RenderSceneOptions {
  cameraZoom: number;
  dt: number;
  layout: OverlayLayout;
  vectorVisibility: VectorVisibility;
}

function createParticleLayers(parent: Container, alphaBuckets: number[]) {
  return alphaBuckets.map(() => {
    const layer = new Graphics();
    parent.addChild(layer);
    return layer;
  });
}

function createParticles(count: number, bucketCount: number, minLen: number, lenSpread: number, minSpeed: number, speedSpread: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    len: Math.random() * lenSpread + minLen,
    speed: Math.random() * speedSpread + minSpeed,
    bucket: Math.floor(Math.random() * bucketCount),
  }));
}

function wrapCoordinate(value: number, max: number): number {
  if (value < 0) {
    return value + max;
  }

  if (value > max) {
    return value - max;
  }

  return value;
}

function updateParticleLayers(
  layers: Graphics[],
  particles: Particle[],
  angle: number,
  flowX: number,
  flowY: number,
  dt: number,
  color: number,
  width: number,
  alphaBuckets: number[],
  isWind: boolean = false,
) {
  for (const layer of layers) {
    layer.clear();
  }

  for (const particle of particles) {
    particle.x = wrapCoordinate(particle.x + flowX * particle.speed * dt, WORLD_WIDTH);
    particle.y = wrapCoordinate(particle.y + flowY * particle.speed * dt, WORLD_HEIGHT);

    const layer = layers[particle.bucket];
    
    if (isWind) {
      // Wind style: Short, soft "puffs" or wisps
      // We use a small randomized offset to make it look less uniform (less like rain)
      const jitter = (Math.random() - 0.5) * 0.2;
      const puffAngle = angle + jitter;
      const puffLen = particle.len * 0.3; // Much shorter
      
      const endX = particle.x + Math.sin(puffAngle) * puffLen;
      const endY = particle.y - Math.cos(puffAngle) * puffLen;
      
      layer.moveTo(particle.x, particle.y);
      layer.lineTo(endX, endY);
    } else {
      const endX = particle.x + Math.sin(angle) * particle.len;
      const endY = particle.y - Math.cos(angle) * particle.len;
      layer.moveTo(particle.x, particle.y);
      layer.lineTo(endX, endY);
    }
  }

  for (let index = 0; index < layers.length; index += 1) {
    layers[index].stroke({
      width,
      color,
      alpha: alphaBuckets[index],
    });
  }
}

function createVectorLabel(text: string, color: number, parent: Container): Text {
  const label = new Text({
    text,
    style: {
      fontFamily: 'Inter',
      fontSize: 12,
      fill: color,
      fontWeight: 'bold',
    },
  });
  label.anchor.set(0.5);
  parent.addChild(label);
  return label;
}

function drawBoatHull(graphics: Graphics, boat: BoatConfig) {
  graphics.clear();
  graphics.moveTo(0, -70);
  graphics.quadraticCurveTo(30, -30, 26, 0);
  graphics.lineTo(20, 50);
  graphics.lineTo(-20, 50);
  graphics.lineTo(-26, 0);
  graphics.quadraticCurveTo(-30, -30, 0, -70);
  graphics.fill({ color: 0xeeeeee });
  graphics.stroke({ width: 3, color: 0xaaaaaa });
  graphics.circle(0, boat.mastY, 5);
  graphics.fill({ color: 0x333333 });
}

function drawArrow(
  graphics: Graphics,
  label: Text,
  dx: number,
  dy: number,
  headingRad: number,
  color: number,
  width: number,
  visible: boolean,
) {
  graphics.clear();

  if (!visible) {
    label.visible = false;
    return;
  }

  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.1) {
    label.visible = false;
    return;
  }

  label.visible = true;
  label.rotation = -headingRad;

  graphics.moveTo(0, 0);
  graphics.lineTo(dx, dy);
  graphics.stroke({ width, color });

  const angle = Math.atan2(dy, dx);
  const headLength = 8;
  graphics.moveTo(dx, dy);
  graphics.lineTo(
    dx - headLength * Math.cos(angle - Math.PI / 6),
    dy - headLength * Math.sin(angle - Math.PI / 6),
  );
  graphics.moveTo(dx, dy);
  graphics.lineTo(
    dx - headLength * Math.cos(angle + Math.PI / 6),
    dy - headLength * Math.sin(angle + Math.PI / 6),
  );
  graphics.stroke({ width, color });

  label.x = dx + 15 * Math.cos(angle);
  label.y = dy + 15 * Math.sin(angle);
}

function createTrailPool(parent: Container): TrailNode[] {
  return Array.from({ length: TRAIL_POOL_SIZE }, () => {
    const graphics = new Graphics();
    graphics.visible = false;
    parent.addChild(graphics);
    return {
      graphics,
      life: 0,
      active: false,
      baseAlpha: 0.4,
    };
  });
}

function activateTrail(scene: SceneRefs, x: number, y: number, radius: number, color: number, alpha: number) {
  const node = scene.trailPool[scene.trailCursor];
  scene.trailCursor = (scene.trailCursor + 1) % scene.trailPool.length;

  node.graphics.clear();
  node.graphics.circle(0, 0, radius);
  node.graphics.fill({ color, alpha });
  node.graphics.x = x;
  node.graphics.y = y;
  node.graphics.alpha = alpha;
  node.graphics.visible = true;
  node.life = TRAIL_LIFE;
  node.active = true;
  node.baseAlpha = alpha;
}

function updateTrailPool(scene: SceneRefs, dt: number) {
  for (const node of scene.trailPool) {
    if (!node.active) {
      continue;
    }

    node.life -= dt;
    if (node.life <= 0) {
      node.active = false;
      node.graphics.visible = false;
      continue;
    }

    node.graphics.alpha = (node.life / TRAIL_LIFE) * node.baseAlpha;
  }
}

function drawSail(scene: SceneRefs, snapshot: RenderSnapshot) {
  const { sailGraphics, boat } = scene;
  const originY = boat.mastY;
  const sailAngleRad = snapshot.sailAngleDeg * Math.PI / 180;
  const endX = -boat.sailLength * Math.sin(sailAngleRad);
  const endY = originY + boat.sailLength * Math.cos(sailAngleRad);
  const curveDepth = 30 * (snapshot.boatSpeed > 1 ? 1 : 0.2);
  const bulgeDirection = snapshot.sailAngleDeg > 0 ? 1 : -1;
  const midX = endX / 2 - curveDepth * Math.cos(sailAngleRad) * bulgeDirection;
  const midY = (originY + endY) / 2 - curveDepth * Math.sin(sailAngleRad) * bulgeDirection;

  sailGraphics.clear();
  sailGraphics.moveTo(0, originY);
  sailGraphics.lineTo(endX, endY);
  sailGraphics.stroke({ width: 3, color: 0x888888 });
  sailGraphics.moveTo(0, originY);
  sailGraphics.quadraticCurveTo(midX, midY, endX, endY);
  sailGraphics.stroke({ width: 4, color: 0xffffff });
  sailGraphics.scale.set(Math.max(0.5, snapshot.heelScale), 1);
}

function drawTiller(scene: SceneRefs, snapshot: RenderSnapshot) {
  const tillerAngleRad = -snapshot.rudderAngle * Math.PI / 180;
  scene.tillerGraphics.clear();
  scene.tillerGraphics.moveTo(0, 50);
  scene.tillerGraphics.lineTo(
    -25 * Math.sin(tillerAngleRad),
    50 - 25 * Math.cos(tillerAngleRad),
  );
  scene.tillerGraphics.stroke({ width: 4, color: 0x8b4513 });
  scene.tillerGraphics.moveTo(0, 50);
  scene.tillerGraphics.lineTo(
    25 * Math.sin(tillerAngleRad),
    50 + 25 * Math.cos(tillerAngleRad),
  );
  scene.tillerGraphics.stroke({ width: 5, color: 0x5c3317 });
  scene.tillerGraphics.scale.set(scene.boat.hullScale * Math.max(0.5, snapshot.heelScale), scene.boat.hullScale);
}

function drawForceVectors(scene: SceneRefs, snapshot: RenderSnapshot, visibility: VectorVisibility) {
  const actualHeelForce = snapshot.heelingForce * snapshot.tackSign;
  const awaFlowRad = snapshot.awaRelativeToBoat * Math.PI / 180 + Math.PI;
  const awaDrawLength = Math.min(80, snapshot.aws * 3);

  drawArrow(
    scene.vectorGraphics.awa,
    scene.vectorLabels.awa,
    awaDrawLength * Math.sin(awaFlowRad),
    -awaDrawLength * Math.cos(awaFlowRad),
    snapshot.headingRad,
    VECTOR_LABELS.awa.color,
    VECTOR_LABELS.awa.width,
    visibility.awa,
  );
  drawArrow(
    scene.vectorGraphics.drive,
    scene.vectorLabels.drive,
    0,
    -snapshot.driveForce * FORCE_SCALE,
    snapshot.headingRad,
    VECTOR_LABELS.drive.color,
    VECTOR_LABELS.drive.width,
    visibility.drive,
  );
  drawArrow(
    scene.vectorGraphics.drag,
    scene.vectorLabels.drag,
    0,
    snapshot.waterResistance * FORCE_SCALE,
    snapshot.headingRad,
    VECTOR_LABELS.drag.color,
    VECTOR_LABELS.drag.width,
    visibility.drag,
  );
  drawArrow(
    scene.vectorGraphics.heel,
    scene.vectorLabels.heel,
    actualHeelForce * FORCE_SCALE,
    0,
    snapshot.headingRad,
    VECTOR_LABELS.heel.color,
    VECTOR_LABELS.heel.width,
    visibility.heel,
  );
  drawArrow(
    scene.vectorGraphics.total,
    scene.vectorLabels.total,
    actualHeelForce * FORCE_SCALE,
    -snapshot.driveForce * FORCE_SCALE,
    snapshot.headingRad,
    VECTOR_LABELS.total.color,
    VECTOR_LABELS.total.width,
    visibility.total,
  );
  drawArrow(
    scene.vectorGraphics.crew,
    scene.vectorLabels.crew,
    snapshot.crewForceX,
    0,
    snapshot.headingRad,
    VECTOR_LABELS.crew.color,
    VECTOR_LABELS.crew.width,
    visibility.crew,
  );
}

export function createScene(app: Application, boat: BoatConfig): SceneRefs {
  const worldContainer = new Container();
  app.stage.addChild(worldContainer);

  const gridGraphics = new Graphics();
  worldContainer.addChild(gridGraphics);
  for (let x = 0; x <= WORLD_WIDTH; x += GRID_SIZE) {
    gridGraphics.moveTo(x, 0);
    gridGraphics.lineTo(x, WORLD_HEIGHT);
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += GRID_SIZE) {
    gridGraphics.moveTo(0, y);
    gridGraphics.lineTo(WORLD_WIDTH, y);
  }
  gridGraphics.stroke({ width: 2, color: 0xffffff, alpha: 0.08 });
  for (let x = 0; x <= WORLD_WIDTH; x += MAJOR_GRID_SIZE) {
    gridGraphics.moveTo(x, 0);
    gridGraphics.lineTo(x, WORLD_HEIGHT);
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += MAJOR_GRID_SIZE) {
    gridGraphics.moveTo(0, y);
    gridGraphics.lineTo(WORLD_WIDTH, y);
  }
  gridGraphics.stroke({ width: 3, color: 0xffffff, alpha: 0.18 });

  const staticWater = new Graphics();
  worldContainer.addChild(staticWater);
  staticWater.fill({ color: 0xffffff, alpha: 0.28 });
  for (let index = 0; index < STATIC_WATER_PARTICLE_COUNT; index += 1) {
    staticWater.circle(
      Math.random() * WORLD_WIDTH,
      Math.random() * WORLD_HEIGHT,
      Math.random() * 1.5 + 1,
    );
  }

  const windStreakLayers = createParticleLayers(worldContainer, WIND_ALPHA_BUCKETS);
  const currentStreakLayers = createParticleLayers(worldContainer, CURRENT_ALPHA_BUCKETS);

  const borderGraphics = new Graphics();
  worldContainer.addChild(borderGraphics);
  borderGraphics.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  borderGraphics.stroke({ width: 10, color: 0xff0000, alpha: 0.5 });

  const trailContainer = new Container();
  worldContainer.addChild(trailContainer);

  for (const buoy of BUOYS) {
    const buoyGraphic = new Graphics();
    buoyGraphic.circle(0, 0, 15);
    buoyGraphic.fill({ color: 0xff8800 });
    buoyGraphic.stroke({ width: 2, color: 0xffffff });
    buoyGraphic.x = buoy.x;
    buoyGraphic.y = buoy.y;
    worldContainer.addChild(buoyGraphic);
  }

  const boatContainer = new Container();
  worldContainer.addChild(boatContainer);

  const boatGraphics = new Graphics();
  drawBoatHull(boatGraphics, boat);
  boatContainer.addChild(boatGraphics);

  const tillerGraphics = new Graphics();
  boatContainer.addChild(tillerGraphics);

  const crewGraphics = new Graphics();
  crewGraphics.circle(0, 0, 8);
  crewGraphics.fill({ color: 0xff3333 });
  crewGraphics.stroke({ width: 2, color: 0xffffff });
  boatContainer.addChild(crewGraphics);

  const sailGraphics = new Graphics();
  boatContainer.addChild(sailGraphics);

  const vectorContainer = new Container();
  boatContainer.addChild(vectorContainer);

  const vectorGraphics = Object.fromEntries(
    (Object.keys(VECTOR_LABELS) as VectorKey[]).map((key) => {
      const graphic = new Graphics();
      vectorContainer.addChild(graphic);
      return [key, graphic];
    }),
  ) as Record<VectorKey, Graphics>;

  const vectorLabels = Object.fromEntries(
    (Object.keys(VECTOR_LABELS) as VectorKey[]).map((key) => [
      key,
      createVectorLabel(VECTOR_LABELS[key].text, VECTOR_LABELS[key].color, vectorContainer),
    ]),
  ) as Record<VectorKey, Text>;

  const capsizeText = new Text({
    text: 'CAPSIZE (翻船)',
    style: { fontFamily: 'Inter, sans-serif', fontSize: 72, fill: 0xff0000, fontWeight: 'bold' },
  });
  capsizeText.anchor.set(0.5);
  capsizeText.visible = false;
  app.stage.addChild(capsizeText);

  return {
    app,
    boat,
    worldContainer,
    boatContainer,
    boatGraphics,
    tillerGraphics,
    crewGraphics,
    sailGraphics,
    vectorGraphics,
    vectorLabels,
    capsizeText,
    windParticles: createParticles(WIND_PARTICLE_COUNT * 1.5, WIND_ALPHA_BUCKETS.length, 15, 10, 1.6, 0.4),
    currentParticles: createParticles(CURRENT_PARTICLE_COUNT, CURRENT_ALPHA_BUCKETS.length, 12, 12, 0.8, 0.4),
    windStreakLayers,
    currentStreakLayers,
    trailPool: createTrailPool(trailContainer),
    trailCursor: 0,
  };
}

export function renderScene(scene: SceneRefs, snapshot: RenderSnapshot, options: RenderSceneOptions) {
  const { app, boat } = scene;

  const windFlowX = Math.sin(snapshot.windFlowRad) * snapshot.tws * 0.6;
  const windFlowY = -Math.cos(snapshot.windFlowRad) * snapshot.tws * 0.6;
  updateParticleLayers(
    scene.windStreakLayers,
    scene.windParticles,
    snapshot.windFlowRad,
    windFlowX,
    windFlowY,
    options.dt,
    0xffffff,
    2.5, // Thicker but shorter
    WIND_ALPHA_BUCKETS,
    true,
  );

  const currentFlowX = Math.sin(snapshot.currentFlowRad) * snapshot.currentSpeed * 2.2;
  const currentFlowY = -Math.cos(snapshot.currentFlowRad) * snapshot.currentSpeed * 2.2;
  updateParticleLayers(
    scene.currentStreakLayers,
    scene.currentParticles,
    snapshot.currentFlowRad,
    currentFlowX,
    currentFlowY,
    options.dt,
    0x00e5ff, // More vibrant cyan
    3.5, // Thicker for current
    CURRENT_ALPHA_BUCKETS,
  );

  const viewportCenterX = Math.min(
    Math.max(options.layout.viewportCenterX, options.layout.viewportLeft),
    options.layout.viewportRight,
  );

  scene.worldContainer.scale.set(options.cameraZoom);
  scene.worldContainer.x = viewportCenterX - snapshot.boatPosition.x * options.cameraZoom;
  scene.worldContainer.y = app.screen.height / 2 - snapshot.boatPosition.y * options.cameraZoom;

  scene.boatContainer.x = snapshot.boatPosition.x;
  scene.boatContainer.y = snapshot.boatPosition.y;
  scene.boatContainer.rotation = snapshot.headingRad;

  scene.boatGraphics.scale.set(boat.hullScale * Math.max(0.5, snapshot.heelScale), boat.hullScale);
  scene.crewGraphics.scale.set(boat.hullScale * Math.max(0.5, snapshot.heelScale), boat.hullScale);
  scene.crewGraphics.x = (snapshot.crewWeightOffset / 100) * 28 * boat.hullScale;
  scene.crewGraphics.y = 10 * boat.hullScale;

  drawSail(scene, snapshot);
  drawTiller(scene, snapshot);
  drawForceVectors(scene, snapshot, options.vectorVisibility);

  if (Math.abs(snapshot.boatSpeed) > 0.5 && Math.random() < 0.06) {
    const tailMoveRad = snapshot.moveRad + Math.PI;
    activateTrail(
      scene,
      snapshot.boatPosition.x + 25 * Math.sin(tailMoveRad),
      snapshot.boatPosition.y - 25 * Math.cos(tailMoveRad),
      2,
      0xffffff,
      0.4,
    );

    if (Math.abs(snapshot.leewayAngle) > 0.5) {
      const tailHeadingRad = snapshot.headingRad + Math.PI;
      activateTrail(
        scene,
        snapshot.boatPosition.x + 25 * Math.sin(tailHeadingRad),
        snapshot.boatPosition.y - 25 * Math.cos(tailHeadingRad),
        1.5,
        0xffaa00,
        0.5,
      );
    }
  }

  updateTrailPool(scene, options.dt);

  scene.capsizeText.x = viewportCenterX;
  scene.capsizeText.y = app.screen.height / 2;
  scene.capsizeText.visible = snapshot.capsize;
}
