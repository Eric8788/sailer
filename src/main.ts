import './style.css';

import { Application } from 'pixi.js';

import { BOAT_CONFIGS, DEFAULT_BOAT_ID } from './config/boats';
import { createKeyboardController } from './game/input';
import { sampleFrame, stepPhysics } from './game/physics';
import { createInitialEnvironment, createInitialGameState } from './game/state';
import { createScene, renderScene } from './render/scene';
import { createGameUi } from './ui/dom';

const boat = BOAT_CONFIGS[DEFAULT_BOAT_ID];

let gameState = createInitialGameState(DEFAULT_BOAT_ID);
let environment = createInitialEnvironment();

const app = new Application();
await app.init({
  resizeTo: window,
  backgroundColor: 0x1e88e5,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

document.getElementById('app')?.appendChild(app.canvas);

const scene = createScene(app, boat);
const keyboard = createKeyboardController();
const ui = createGameUi({
  boatName: boat.name,
  environment,
  onEnvironmentChange(nextEnvironment) {
    environment = nextEnvironment;
  },
});

const initialFrame = sampleFrame(gameState, environment);
ui.updateHud(initialFrame.hud);
renderScene(scene, initialFrame.render, {
  cameraZoom: ui.getZoom(),
  dt: 0,
  layout: ui.getLayout(),
  vectorVisibility: ui.getVectorVisibility(),
});

app.ticker.add(({ deltaTime }) => {
  const frame = stepPhysics(gameState, keyboard.getControlState(), environment, deltaTime);
  gameState = frame.nextState;
  ui.updateHud(frame.hud);
  renderScene(scene, frame.render, {
    cameraZoom: ui.getZoom(),
    dt: deltaTime,
    layout: ui.getLayout(),
    vectorVisibility: ui.getVectorVisibility(),
  });
});

window.addEventListener('beforeunload', () => {
  keyboard.destroy();
  ui.destroy();
});
