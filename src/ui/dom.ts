import { BUOYS, WORLD_HEIGHT, WORLD_WIDTH } from '../config/world';
import type {
  EnvironmentState,
  HudSnapshot,
  OverlayLayout,
  VectorKey,
  VectorVisibility,
} from '../types';

const DEFAULT_VECTOR_VISIBILITY: VectorVisibility = {
  awa: true,
  drive: true,
  drag: true,
  heel: true,
  total: true,
  crew: true,
};


const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_RUDDER_RANGE = 35;

interface SliderRefs {
  slider: HTMLInputElement;
  value: HTMLElement;
}

interface EnvironmentRefs {
  tws: SliderRefs;
  currentSpeed: SliderRefs;
  autoToggleBtn: HTMLButtonElement;
  difficultyBtns: HTMLButtonElement[];
}

interface HudValueRefs {
  boatName: HTMLElement;
  twd: HTMLElement;
  tws: HTMLElement;
  awa: HTMLElement;
  aws: HTMLElement;
  currentSpeed: HTMLElement;
  currentDir: HTMLElement;
  leeway: HTMLElement;
  heading: HTMLElement;
  boatSpeed: HTMLElement;
  heel: HTMLElement;
  sailTrim: HTMLElement;
  rudder: HTMLElement;
  crew: HTMLElement;
  centerboard: HTMLElement;
  vmg: HTMLElement;
  sog: HTMLElement;
  cog: HTMLElement;
  twa: HTMLElement;
}

interface StatusMeterRefs {
  value: HTMLElement;
  fill?: HTMLElement;
  thumb?: HTMLElement;
}

interface BoatStatusRefs {
  sailTrim: StatusMeterRefs;
  rudder: StatusMeterRefs;
  crew: StatusMeterRefs;
  centerboard: StatusMeterRefs;
}

interface MapRefs {
  compassArrow: HTMLElement;
  currentArrow: HTMLElement;
  compassLabel: HTMLElement;
  boatMarker: SVGGElement;
  boatSpeedVector: SVGLineElement;
  zoom: SliderRefs;
  windValue: HTMLElement;
  waterValue: HTMLElement;
  windHandle: HTMLElement;
  currentHandle: HTMLElement;
  windArrowValue: HTMLElement;
  currentArrowValue: HTMLElement;
}

interface DockRefs {
  dock: HTMLElement;
  panel: HTMLElement;
}

export interface GameUi {
  getZoom(): number;
  getVectorVisibility(): VectorVisibility;
  getLayout(): OverlayLayout;
  updateHud(snapshot: HudSnapshot): void;
  syncEnvironment(environment: EnvironmentState): void;
  destroy(): void;
}

interface CreateGameUiOptions {
  boatName: string;
  environment: EnvironmentState;
  onEnvironmentChange(nextEnvironment: EnvironmentState): void;
}

function normalizeDegrees(value: number): number {
  return (value % 360 + 360) % 360;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text) {
    element.textContent = text;
  }
  return element;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }
  return element;
}

function createDock(side: 'left' | 'right'): DockRefs {
  const dock = createElement('aside', `hud-dock hud-dock--${side}`);
  const panel = createElement('div', 'dock-panel');
  dock.appendChild(panel);

  return {
    dock,
    panel,
  };
}

function createCard(parent: HTMLElement, title: string, subtitle: string, accent: string) {
  const card = createElement('section', 'control-card');
  card.style.setProperty('--accent', accent);

  const header = createElement('header', 'card-header');
  const eyebrow = createElement('div', 'card-eyebrow', title);
  const sub = createElement('div', 'card-subtitle', subtitle);
  header.append(eyebrow, sub);

  const body = createElement('div', 'card-body');
  card.append(header, body);
  parent.appendChild(card);

  return { card, body, subtitle: sub };
}

function createSection(cardBody: HTMLElement, label: string) {
  const section = createElement('section', 'card-section');
  const title = createElement('div', 'section-title', label);
  section.appendChild(title);
  cardBody.appendChild(section);
  return section;
}

function createMetric(parent: HTMLElement, label: string) {
  const metric = createElement('div', 'metric');
  const labelEl = createElement('span', 'metric-label', label);
  const valueEl = createElement('span', 'metric-value');
  metric.append(labelEl, valueEl);
  parent.appendChild(metric);
  return valueEl;
}

function createSliderRow(parent: HTMLElement, label: string, min: string, max: string, step: string): SliderRefs {
  const row = createElement('div', 'slider-row');
  const labelEl = createElement('label', 'slider-label', label);
  const controlWrap = createElement('div', 'slider-control');
  const slider = createElement('input') as HTMLInputElement;
  slider.type = 'range';
  slider.min = min;
  slider.max = max;
  slider.step = step;

  const valueEl = createElement('span', 'slider-value');
  controlWrap.append(slider, valueEl);
  row.append(labelEl, controlWrap);
  parent.appendChild(row);

  return { slider, value: valueEl };
}

function createProgressStatus(parent: HTMLElement, label: string, keyHint?: string): StatusMeterRefs {
  const row = createElement('div', 'status-row');
  const header = createElement('div', 'status-header');
  
  const labelWrapper = createElement('div', 'status-label-wrapper');
  const labelEl = createElement('span', 'status-label', label);
  labelWrapper.appendChild(labelEl);
  if (keyHint) {
    const hintEl = createElement('span', 'status-key-hint', keyHint);
    labelWrapper.appendChild(hintEl);
  }
  
  const valueEl = createElement('span', 'status-value');
  header.append(labelWrapper, valueEl);

  const track = createElement('div', 'status-track');
  const fill = createElement('div', 'status-fill');
  track.appendChild(fill);

  row.append(header, track);
  parent.appendChild(row);

  return {
    value: valueEl,
    fill,
  };
}

function createCenteredStatus(parent: HTMLElement, label: string, keyHint?: string): StatusMeterRefs {
  const row = createElement('div', 'status-row');
  const header = createElement('div', 'status-header');
  
  const labelWrapper = createElement('div', 'status-label-wrapper');
  const labelEl = createElement('span', 'status-label', label);
  labelWrapper.appendChild(labelEl);
  if (keyHint) {
    const hintEl = createElement('span', 'status-key-hint', keyHint);
    labelWrapper.appendChild(hintEl);
  }
  
  const valueEl = createElement('span', 'status-value');
  header.append(labelWrapper, valueEl);

  const track = createElement('div', 'status-track status-track--centered');
  const center = createElement('div', 'status-centerline');
  const thumb = createElement('div', 'status-thumb');
  track.append(center, thumb);

  row.append(header, track);
  parent.appendChild(row);

  return {
    value: valueEl,
    thumb,
  };
}

function createVectorList(parent: HTMLElement) {
  const list = createElement('div', 'vector-list');
  parent.appendChild(list);

  const refs: Partial<Record<VectorKey, HTMLInputElement>> = {};
  const rows: Array<{ key: VectorKey; label: string; color: string }> = [
    { key: 'awa', label: '视风', color: '#00e5ff' },
    { key: 'drive', label: '推力', color: '#40d97b' },
    { key: 'drag', label: '阻力', color: '#c040ff' },
    { key: 'heel', label: '横倾', color: '#ff5a5a' },
    { key: 'total', label: '合力', color: '#ffe14f' },
    { key: 'crew', label: '扶正', color: '#ffad33' },
  ];

  for (const rowData of rows) {
    const row = createElement('label', 'vector-item');
    const checkbox = createElement('input') as HTMLInputElement;
    checkbox.type = 'checkbox';
    checkbox.checked = true;

    const dot = createElement('span', 'dot');
    dot.style.background = rowData.color;

    const text = createElement('span', 'vector-label', rowData.label);
    row.append(checkbox, dot, text);
    list.appendChild(row);
    refs[rowData.key] = checkbox;
  }

  return refs as Record<VectorKey, HTMLInputElement>;
}

function createCompass(parent: HTMLElement, options: { onWindChange?: (angle: number) => void; onCurrentChange?: (angle: number) => void } = {}) {
  const compass = createElement('div', 'compass-widget');
  const compassDial = createElement('div', 'compass-dial');
  
  // Outer Track (Wind)
  const windTrack = createElement('div', 'compass-track compass-track--wind');
  const windHandle = createElement('div', 'compass-handle compass-handle--wind');
  
  // Inner Track (Current)
  const currentTrack = createElement('div', 'compass-track compass-track--current');
  const currentHandle = createElement('div', 'compass-handle compass-handle--current');

  // Ticks for outer track
  for (let i = 0; i < 360; i += 10) {
    const isMajor = i % 90 === 0;
    const tick = createElement('div', `compass-tick${isMajor ? ' compass-tick--major' : ''}`);
    // Each tick is already positioned at center, we just need to rotate and move it out
    // Use a CSS variable for the translation so it can be updated via media queries
    tick.style.transform = `translate(-50%, -50%) rotate(${i}deg) translateY(var(--compass-tick-offset, -88px))`;
    if (isMajor) {
      const labelMap: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      const label = labelMap[i] || '';
      if (label) {
        const labelEl = createElement('div', 'compass-tick-label', label);
        labelEl.style.transform = `rotate(${-i}deg) translateY(var(--compass-label-offset, -14px))`;
        tick.appendChild(labelEl);
      }
    }
    windTrack.appendChild(tick);
  }

  const innerDial = createElement('div', 'compass-inner-dial');
  
  // Data Overlay
  const overlay = createElement('div', 'compass-data-overlay');
  const dataGroup = createElement('div', 'compass-data-group');
  
  const windItem = createElement('div', 'compass-data-item compass-data-item--wind');
  const windValue = createElement('div', 'compass-data-value', '0.0');
  const windLabel = createElement('div', 'compass-data-label', 'TWS');
  windItem.append(windValue, windLabel);
  
  const waterItem = createElement('div', 'compass-data-item compass-data-item--water');
  const waterValue = createElement('div', 'compass-data-value', '0.0');
  const waterLabel = createElement('div', 'compass-data-label', 'CUR');
  waterItem.append(waterValue, waterLabel);
  
  dataGroup.append(windItem, waterItem);
  overlay.append(dataGroup);

  const compassArrow = createElement('div', 'compass-arrow');
  const windArrowValue = createElement('div', 'compass-arrow-value', '0.0');
  compassArrow.appendChild(windArrowValue);

  const currentArrow = createElement('div', 'compass-current-arrow');
  const currentArrowValue = createElement('div', 'compass-arrow-value', '0.0');
  currentArrow.appendChild(currentArrowValue);

  const compassCenter = createElement('div', 'compass-center');
  const compassLabel = createElement('div', 'compass-label', 'Wind 0° | Current 0°');
  
  compassDial.append(
    windTrack, windHandle, 
    currentTrack, currentHandle,
    innerDial,
    compassArrow, currentArrow, 
    compassCenter, overlay
  );
  compass.append(compassDial, compassLabel);
  parent.appendChild(compass);

  // Interaction logic
  let activeArrow: 'wind' | 'current' | null = null;

  const updateFromEvent = (e: MouseEvent | TouchEvent) => {
    const rect = compassDial.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    
    let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    if (activeArrow === 'wind' && options.onWindChange) {
      options.onWindChange(angle);
    } else if (activeArrow === 'current' && options.onCurrentChange) {
      options.onCurrentChange(angle);
    }
  };

  const handleMouseDown = (e: MouseEvent | TouchEvent, type: 'wind' | 'current') => {
    e.stopPropagation();
    activeArrow = type;
    if (e.type === 'mousedown') {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    updateFromEvent(e);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (activeArrow) updateFromEvent(e);
  };

  const handleMouseUp = () => {
    activeArrow = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  windHandle.addEventListener('mousedown', (e) => handleMouseDown(e, 'wind'));
  currentHandle.addEventListener('mousedown', (e) => handleMouseDown(e, 'current'));

  // Also allow clicking the tracks
  windTrack.addEventListener('mousedown', (e) => handleMouseDown(e, 'wind'));
  currentTrack.addEventListener('mousedown', (e) => handleMouseDown(e, 'current'));

  // Touch support
  windHandle.addEventListener('touchstart', (e) => handleMouseDown(e, 'wind'), { passive: false });
  currentHandle.addEventListener('touchstart', (e) => handleMouseDown(e, 'current'), { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (activeArrow) updateFromEvent(e);
  }, { passive: false });

  window.addEventListener('touchend', () => {
    activeArrow = null;
  });

  return { 
    compassArrow, currentArrow, compassLabel, windValue, waterValue,
    windHandle, currentHandle, windArrowValue, currentArrowValue 
  };
}

function createZoomToolbarItem(parent: HTMLElement): SliderRefs {
  const zoomWrap = createElement('div', 'toolbar-zoom');
  const label = createElement('span', 'toolbar-zoom-label', '缩放');
  const slider = createElement('input') as HTMLInputElement;
  slider.type = 'range';
  slider.min = '0.3';
  slider.max = '3';
  slider.step = '0.05';
  slider.value = '1';

  const valueEl = createElement('span', 'toolbar-zoom-value', '1.00x');
  zoomWrap.append(label, slider, valueEl);
  parent.appendChild(zoomWrap);

  return { slider, value: valueEl };
}

function createMinimap(parent: HTMLElement) {
  const minimapFrame = createElement('div', 'minimap-container minimap-container--integrated');
  
  const svg = createSvgElement('svg', {
    class: 'minimap-svg',
    viewBox: '0 0 200 200',
    width: '100%',
    height: '100%',
  });

  // Background
  const bg = createSvgElement('rect', {
    width: '200',
    height: '200',
    fill: 'rgba(0, 0, 0, 0.2)',
    rx: '4',
  });
  svg.appendChild(bg);

  // Add Grid Lines
  for (let i = 40; i < 200; i += 40) {
    // Vertical
    svg.appendChild(createSvgElement('line', {
      x1: i.toString(), y1: '0', x2: i.toString(), y2: '200',
      stroke: 'rgba(255, 255, 255, 0.05)',
      'stroke-width': '1'
    }));
    // Horizontal
    svg.appendChild(createSvgElement('line', {
      x1: '0', y1: i.toString(), x2: '200', y2: i.toString(),
      stroke: 'rgba(255, 255, 255, 0.05)',
      'stroke-width': '1'
    }));
  }

  // Buoys
  for (const buoy of BUOYS) {
    const dot = createSvgElement('circle', {
      cx: (buoy.x / WORLD_WIDTH * 200).toFixed(1),
      cy: (buoy.y / WORLD_HEIGHT * 200).toFixed(1),
      r: '4',
      fill: '#ffc107',
    });
    svg.appendChild(dot);
  }

  // Speed Vector (Bottom Layer of boat)
  const boatSpeedVector = createSvgElement('line', {
    x1: '0', y1: '0', x2: '0', y2: '0',
    stroke: '#62ff3f',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    opacity: '0.6'
  }) as SVGLineElement;
  svg.appendChild(boatSpeedVector);

  const boatMarker = createSvgElement('g') as SVGGElement;
  const boatShape = createSvgElement('polygon', {
    points: '0,-8 5,6 -5,6',
    fill: '#62ff3f',
  });
  boatMarker.appendChild(boatShape);
  svg.appendChild(boatMarker);

  minimapFrame.appendChild(svg);
  parent.appendChild(minimapFrame);

  return { boatMarker, boatSpeedVector };
}

/**
 * Converts degrees to a 16-point cardinal direction string in Chinese.
 * @param degrees 0-360
 * @returns e.g. "东北", "北东北"
 */
function getCardinalDirection(degrees: number): string {
  const directions = [
    'N', 'NNE', 'NE', 'ENE', 
    'E', 'ESE', 'SE', 'SSE', 
    'S', 'SSW', 'SW', 'WSW', 
    'W', 'WNW', 'NW', 'NNW'
  ];
  // 360 / 16 = 22.5 degrees per point
  const index = Math.round(normalizeDegrees(degrees) / 22.5) % 16;
  return directions[index];
}

/**
 * Formats a direction for display: "Cardinal Degrees°"
 */
function formatDirection(degrees: number): string {
  const normalized = normalizeDegrees(degrees);
  return `${getCardinalDirection(normalized)} ${normalized.toFixed(0)}°`;
}

function formatAwa(snapshot: HudSnapshot): string {
  const side = snapshot.awaRelativeToBoat < 0 ? 'P' : 'S';
  return `${Math.abs(snapshot.awaRelativeToBoat).toFixed(0)}° ${side}`;
}

function formatHeel(snapshot: HudSnapshot): string {
  const side = snapshot.heelAngle < 0 ? '左倾' : '右倾';
  return `${Math.abs(snapshot.heelAngle).toFixed(1)}° ${side}`;
}

function formatSignedPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

function syncEnvironmentRefs(refs: EnvironmentRefs, environment: EnvironmentState) {
  refs.tws.slider.value = environment.tws.toString();
  refs.tws.value.textContent = `${environment.tws.toFixed(1)} kts`;
  
  refs.currentSpeed.slider.value = environment.currentSpeed.toString();
  refs.currentSpeed.value.textContent = `${environment.currentSpeed.toFixed(1)} kts`;
}



export function createGameUi(options: CreateGameUiOptions): GameUi {
  let cameraZoom = 1;
  const vectorVisibility = { ...DEFAULT_VECTOR_VISIBILITY };

  const header = createElement('header', 'app-header');
  const title = createElement('h1', 'app-title', 'Tactical Sailor');
  const version = createElement('div', 'app-version', 'v1.2.2');
  header.append(title, version);
  document.body.append(header);

  const leftDock = createDock('left');
  const rightDock = createDock('right');
  document.body.append(leftDock.dock, rightDock.dock);

  const bottomCenter = createElement('div', 'floating-bottom');
  document.body.append(bottomCenter);

  const hudRefs = {} as HudValueRefs;

  // --- Left Dock: Environment & Map ---
  const envCard = createCard(leftDock.panel, '环境控制', 'Environment Control', '#00e5ff');
  
  const envRefs: EnvironmentRefs = {
    tws: null as any,
    currentSpeed: null as any,
    autoToggleBtn: createElement('button', 'card-button auto-toggle-btn', '开启自动变动') as HTMLButtonElement,
    difficultyBtns: [],
  };

  const { 
    compassArrow, currentArrow, compassLabel, windValue, waterValue,
    windHandle, currentHandle, windArrowValue, currentArrowValue 
  } = createCompass(envCard.body, {
    onWindChange: (angle) => {
      options.environment.twd = normalizeDegrees(angle + 180);
      options.onEnvironmentChange(options.environment);
      syncEnvironmentRefs(envRefs, options.environment);
    },
    onCurrentChange: (angle) => {
      options.environment.currentDir = normalizeDegrees(angle);
      options.onEnvironmentChange(options.environment);
      syncEnvironmentRefs(envRefs, options.environment);
    }
  });
  
  const envAdjust = createSection(envCard.body, '环境调整');
  const envSliders = createElement('div', 'slider-stack');
  envAdjust.appendChild(envSliders);
  
  envRefs.tws = createSliderRow(envSliders, '风速', '0', '30', '0.5');
  envRefs.currentSpeed = createSliderRow(envSliders, '流速', '0', '3', '0.1');

  const autoPanel = createElement('div', 'auto-env-panel');
  const diffGroup = createElement('div', 'difficulty-selector');
  ['简单', '中等', '困难'].forEach((label, i) => {
    const btn = createElement('button', 'difficulty-btn', label) as HTMLButtonElement;
    if (i === 0) btn.classList.add('is-active');
    diffGroup.appendChild(btn);
    envRefs.difficultyBtns.push(btn);
  });
  autoPanel.append(diffGroup, envRefs.autoToggleBtn);
  envAdjust.appendChild(autoPanel);

  const mapCard = createCard(leftDock.panel, '战术地图', 'Tactical Map', '#ffd166');
  const { boatMarker, boatSpeedVector } = createMinimap(mapCard.body);

  // --- Right Dock: Boat System ---
  const boatCard = createCard(rightDock.panel, '船系统', options.boatName, '#78ffac');
  
  const boatInfo = createSection(boatCard.body, '船舶系统');
  const boatMetrics = createElement('div', 'metric-grid metric-grid--3col');
  boatInfo.appendChild(boatMetrics);
  
  // Basic Metrics
  hudRefs.heading = createMetric(boatMetrics, 'HDG (航向)');
  hudRefs.boatSpeed = createMetric(boatMetrics, 'STW (航水速)');
  hudRefs.heel = createMetric(boatMetrics, 'HEEL (横倾)');
  
  // Advanced Racing Metrics
  hudRefs.vmg = createMetric(boatMetrics, 'VMG (对风速)');
  hudRefs.sog = createMetric(boatMetrics, 'SOG (对地速)');
  hudRefs.cog = createMetric(boatMetrics, 'COG (对地向)');
  hudRefs.twa = createMetric(boatMetrics, 'TWA (真风角)');
  hudRefs.awa = createMetric(boatMetrics, 'AWA (表风角)');
  hudRefs.aws = createMetric(boatMetrics, 'AWS (表风速)');

  const boatAdjust = createSection(boatCard.body, '操控反馈');
  const boatStatusWrap = createElement('div', 'status-list');
  boatAdjust.appendChild(boatStatusWrap);
  const boatStatusRefs: BoatStatusRefs = {
    sailTrim: createProgressStatus(boatStatusWrap, '帆调 (Trim)', '↑ / ↓'),
    rudder: createCenteredStatus(boatStatusWrap, '舵角 (Rudder)', 'A / D'),
    crew: createCenteredStatus(boatStatusWrap, '重心 (Crew)', '← / →'),
    centerboard: createProgressStatus(boatStatusWrap, '板位 (Board)', 'W(↑) / S(↓)'),
  };
  hudRefs.sailTrim = boatStatusRefs.sailTrim.value;
  hudRefs.rudder = boatStatusRefs.rudder.value;
  hudRefs.crew = boatStatusRefs.crew.value;
  hudRefs.centerboard = boatStatusRefs.centerboard.value;
  hudRefs.boatName = boatCard.subtitle;

  // --- Floating Widgets ---
  const toolbar = createElement('div', 'bottom-toolbar');
  bottomCenter.appendChild(toolbar);

  const vectorRefs = createVectorList(toolbar);
  const divider = createElement('div', 'toolbar-divider');
  toolbar.appendChild(divider);
  const zoomWidget = createZoomToolbarItem(toolbar);

  const mapRefs: MapRefs = {
    compassArrow,
    currentArrow,
    compassLabel,
    boatMarker,
    boatSpeedVector,
    zoom: zoomWidget,
    windValue,
    waterValue,
    windHandle,
    currentHandle,
    windArrowValue,
    currentArrowValue,
  };

  syncEnvironmentRefs(envRefs, options.environment);
  mapRefs.zoom.value.textContent = '1.00x';

  const handleZoomInput = () => {
    cameraZoom = Number.parseFloat(mapRefs.zoom.slider.value);
    mapRefs.zoom.value.textContent = `${cameraZoom.toFixed(2)}x`;
  };

  const handleWheel = (event: WheelEvent) => {
    cameraZoom = Math.max(0.3, Math.min(3, cameraZoom - event.deltaY * 0.001));
    mapRefs.zoom.slider.value = cameraZoom.toString();
    mapRefs.zoom.value.textContent = `${cameraZoom.toFixed(2)}x`;
  };

  const bindEnvironmentSlider = (
    refs: SliderRefs,
    readValue: () => EnvironmentState,
    applyValue: (environment: EnvironmentState, value: number) => void,
  ) => {
    refs.slider.addEventListener('input', () => {
      const nextEnvironment = readValue();
      applyValue(nextEnvironment, Number.parseFloat(refs.slider.value));
      options.environment = nextEnvironment;
      options.onEnvironmentChange(nextEnvironment);
      syncEnvironmentRefs(envRefs, nextEnvironment);
    });
  };



  bindEnvironmentSlider(envRefs.tws, () => ({ ...options.environment }), (environment, value) => {
    environment.tws = value;
  });
  bindEnvironmentSlider(envRefs.currentSpeed, () => ({ ...options.environment }), (environment, value) => {
    environment.currentSpeed = value;
  });

  mapRefs.zoom.slider.addEventListener('input', handleZoomInput);
  window.addEventListener('wheel', handleWheel, { passive: true });

  for (const key of Object.keys(vectorVisibility) as VectorKey[]) {
    vectorRefs[key].addEventListener('change', () => {
      vectorVisibility[key] = vectorRefs[key].checked;
    });
  }

  // --- Environment Controls ---
  let autoEnvInterval: number | null = null;
  let difficultyMode: '简单' | '中等' | '困难' = '简单';

  const updateDifficulty = (newDiff: '简单' | '中等' | '困难') => {
    difficultyMode = newDiff;
    envRefs.difficultyBtns.forEach(btn => {
      btn.classList.toggle('is-active', btn.textContent === newDiff);
    });
  };

  envRefs.difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => updateDifficulty(btn.textContent as any));
  });

  envRefs.autoToggleBtn.addEventListener('click', () => {
    if (autoEnvInterval) {
      window.clearInterval(autoEnvInterval);
      autoEnvInterval = null;
      envRefs.autoToggleBtn.textContent = '开启自动变动';
      envRefs.autoToggleBtn.classList.remove('is-running');
    } else {
      envRefs.autoToggleBtn.textContent = '停止自动变动';
      envRefs.autoToggleBtn.classList.add('is-running');
      
      autoEnvInterval = window.setInterval(() => {
        const env = options.environment;
        let windNoise, dirNoise;
        
        if (difficultyMode === '简单') {
          windNoise = (Math.random() - 0.5) * 0.5;
          dirNoise = (Math.random() - 0.5) * 2;
        } else if (difficultyMode === '中等') {
          windNoise = (Math.random() - 0.5) * 1.5;
          dirNoise = (Math.random() - 0.5) * 5;
        } else {
          windNoise = (Math.random() - 0.5) * 4.0;
          dirNoise = (Math.random() - 0.5) * 15;
        }

        const nextEnvironment = {
          ...env,
          tws: Math.max(0, Math.min(30, env.tws + windNoise)),
          twd: (env.twd + dirNoise + 360) % 360,
        };
        options.environment = nextEnvironment;
        options.onEnvironmentChange(nextEnvironment);
        syncEnvironmentRefs(envRefs, nextEnvironment);
      }, 1000);
    }
  });



  return {
    getZoom() {
      return cameraZoom;
    },
    getVectorVisibility() {
      return { ...vectorVisibility };
    },
    getLayout() {
      const viewportLeft = 332;
      const viewportRight = window.innerWidth - 332;
      return {
        viewportLeft,
        viewportRight,
        viewportCenterX: (viewportLeft + viewportRight) / 2,
        minimapRect: null,
        compassRect: null,
      };
    },
    updateHud(snapshot) {
      try {
        if (!hudRefs.boatName) return;
        
        hudRefs.boatName.textContent = snapshot.boatName;
        
        // Update Compass Labels (Wind/Current text at bottom of compass)
        const windFlowDegrees = normalizeDegrees(snapshot.twd + 180);
        const currentFlowDegrees = normalizeDegrees(snapshot.currentDir);
        
        if (mapRefs.compassLabel) {
          const windStr = `Wind ${formatDirection(snapshot.twd)}`;
          const currentStr = `Current ${formatDirection(snapshot.currentDir)}`;
          mapRefs.compassLabel.textContent = `${windStr} | ${currentStr}`;
        }
        
        // Update Compass Overlay Values
        if (mapRefs.windValue) mapRefs.windValue.textContent = snapshot.tws.toFixed(1);
        if (mapRefs.waterValue) mapRefs.waterValue.textContent = snapshot.currentSpeed.toFixed(1);

        // Update Compass Arrows and Handles
        if (mapRefs.compassArrow) {
          mapRefs.compassArrow.style.transform = `translate(-50%, -92%) rotate(${windFlowDegrees}deg)`;
          if (mapRefs.windArrowValue) {
            mapRefs.windArrowValue.style.display = 'none'; // Hide speed on arrow
          }
        }
        if (mapRefs.windHandle) {
          mapRefs.windHandle.style.transform = `translate(-50%, -50%) rotate(${windFlowDegrees}deg) translateY(var(--wind-handle-offset, -88px))`;
        }

        if (mapRefs.currentArrow) {
          const currentScale = 0.4 + (snapshot.currentSpeed / 3) * 0.8;
          mapRefs.currentArrow.style.transform = `translate(-50%, -92%) rotate(${currentFlowDegrees}deg) scaleY(${currentScale})`;
          if (mapRefs.currentArrowValue) {
            mapRefs.currentArrowValue.style.display = 'none'; // Hide speed on arrow
          }
        }
        if (mapRefs.currentHandle) {
          mapRefs.currentHandle.style.transform = `translate(-50%, -50%) rotate(${currentFlowDegrees}deg) translateY(var(--current-handle-offset, -77px))`;
        }

        // Update Boat Metrics
        if (hudRefs.heading) hudRefs.heading.textContent = formatDirection(snapshot.boatHeading);
        if (hudRefs.boatSpeed) hudRefs.boatSpeed.textContent = `${snapshot.boatSpeed.toFixed(1)} kts`;
        if (hudRefs.heel) hudRefs.heel.textContent = formatHeel(snapshot);

        // Update Advanced Metrics
        if (hudRefs.vmg) hudRefs.vmg.textContent = `${snapshot.vmg.toFixed(1)} kts`;
        if (hudRefs.sog) hudRefs.sog.textContent = `${snapshot.sog.toFixed(1)} kts`;
        if (hudRefs.cog) hudRefs.cog.textContent = formatDirection(snapshot.cog);
        if (hudRefs.twa) hudRefs.twa.textContent = `${Math.abs(snapshot.twa).toFixed(0)}° ${snapshot.twa < 0 ? 'P' : 'S'}`;
        if (hudRefs.awa) hudRefs.awa.textContent = formatAwa(snapshot);
        if (hudRefs.aws) hudRefs.aws.textContent = `${snapshot.aws.toFixed(1)} kts`;

        // Update Control Feedback
        if (boatStatusRefs.sailTrim.value) {
          boatStatusRefs.sailTrim.value.textContent = `${snapshot.sailTrim.toFixed(0)}%`;
        }
        if (boatStatusRefs.sailTrim.fill) {
          boatStatusRefs.sailTrim.fill.style.width = `${clamp(snapshot.sailTrim, 0, 100)}%`;
        }

        if (boatStatusRefs.centerboard.value) {
          boatStatusRefs.centerboard.value.textContent = `${snapshot.centerboardDown.toFixed(0)}%`;
        }
        if (boatStatusRefs.centerboard.fill) {
          boatStatusRefs.centerboard.fill.style.width = `${clamp(snapshot.centerboardDown, 0, 100)}%`;
        }

        if (boatStatusRefs.rudder.thumb) {
          const rudderPosition = ((clamp(snapshot.rudderAngle, -DEFAULT_RUDDER_RANGE, DEFAULT_RUDDER_RANGE) + DEFAULT_RUDDER_RANGE) / (DEFAULT_RUDDER_RANGE * 2)) * 100;
          boatStatusRefs.rudder.thumb.style.left = `${rudderPosition}%`;
          if (boatStatusRefs.rudder.value) {
            boatStatusRefs.rudder.value.textContent = `${snapshot.rudderAngle.toFixed(1)}°`;
          }
        }

        if (boatStatusRefs.crew.thumb) {
          const crewPosition = ((clamp(snapshot.crewWeightOffset, -100, 100) + 100) / 200) * 100;
          boatStatusRefs.crew.thumb.style.left = `${crewPosition}%`;
          if (boatStatusRefs.crew.value) {
            boatStatusRefs.crew.value.textContent = formatSignedPercent(snapshot.crewWeightOffset);
          }
        }

        // Update Minimap
        if (mapRefs.boatMarker) {
          const mapX = snapshot.boatPosition.x / WORLD_WIDTH * 200;
          const mapY = snapshot.boatPosition.y / WORLD_HEIGHT * 200;
          
          mapRefs.boatMarker.setAttribute(
            'transform',
            `translate(${mapX.toFixed(2)} ${mapY.toFixed(2)}) rotate(${snapshot.boatHeading.toFixed(2)})`,
          );

          if (mapRefs.boatSpeedVector) {
            // Speed vector represents COG and SOG
            const vectorLength = snapshot.sog * 3; // Scale factor for visibility
            const cogRad = (snapshot.cog - 90) * (Math.PI / 180);
            const vx = Math.cos(cogRad) * vectorLength;
            const vy = Math.sin(cogRad) * vectorLength;

            mapRefs.boatSpeedVector.setAttribute('x1', mapX.toFixed(2));
            mapRefs.boatSpeedVector.setAttribute('y1', mapY.toFixed(2));
            mapRefs.boatSpeedVector.setAttribute('x2', (mapX + vx).toFixed(2));
            mapRefs.boatSpeedVector.setAttribute('y2', (mapY + vy).toFixed(2));
          }
        }
      } catch (e) {
        console.error('Error updating HUD:', e);
      }
    },
    syncEnvironment(environment) {
      options.environment = { ...environment };
      syncEnvironmentRefs(envRefs, environment);
    },
    destroy() {
      mapRefs.zoom.slider.removeEventListener('input', handleZoomInput);
      window.removeEventListener('wheel', handleWheel);
      leftDock.dock.remove();
      rightDock.dock.remove();
    },
  };
}
