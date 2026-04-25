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

const DOCK_GAP = 20;
const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_RUDDER_RANGE = 35;

interface SliderRefs {
  slider: HTMLInputElement;
  value: HTMLElement;
}

interface EnvironmentRefs {
  tws: SliderRefs;
  twd: SliderRefs;
  currentSpeed: SliderRefs;
  currentDir: SliderRefs;
  randomButton: HTMLButtonElement;
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
  compassLabel: HTMLElement;
  boatMarker: SVGGElement;
  zoom: SliderRefs;
}

interface DockRefs {
  dock: HTMLElement;
  panel: HTMLElement;
  toggle: HTMLButtonElement;
  isCollapsed(): boolean;
  setCollapsed(nextCollapsed: boolean): void;
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

function createDock(side: 'left' | 'right', label: string): DockRefs {
  let collapsed = false;

  const dock = createElement('aside', `hud-dock hud-dock--${side}`);
  const toggle = createElement('button', 'dock-toggle') as HTMLButtonElement;
  toggle.type = 'button';
  toggle.setAttribute('aria-label', label);

  const icon = createElement('span', 'dock-toggle-icon');
  const text = createElement('span', 'dock-toggle-label', label);
  toggle.append(icon, text);

  const panel = createElement('div', 'dock-panel');
  dock.append(toggle, panel);

  const sync = () => {
    dock.classList.toggle('is-collapsed', collapsed);
    icon.textContent = collapsed
      ? side === 'left' ? '›' : '‹'
      : side === 'left' ? '‹' : '›';
  };

  sync();

  return {
    dock,
    panel,
    toggle,
    isCollapsed: () => collapsed,
    setCollapsed(nextCollapsed: boolean) {
      collapsed = nextCollapsed;
      sync();
    },
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

function createProgressStatus(parent: HTMLElement, label: string): StatusMeterRefs {
  const row = createElement('div', 'status-row');
  const header = createElement('div', 'status-header');
  const labelEl = createElement('span', 'status-label', label);
  const valueEl = createElement('span', 'status-value');
  header.append(labelEl, valueEl);

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

function createCenteredStatus(parent: HTMLElement, label: string): StatusMeterRefs {
  const row = createElement('div', 'status-row');
  const header = createElement('div', 'status-header');
  const labelEl = createElement('span', 'status-label', label);
  const valueEl = createElement('span', 'status-value');
  header.append(labelEl, valueEl);

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
    { key: 'awa', label: '视风 AWA', color: '#00e5ff' },
    { key: 'drive', label: '推进力 Drive', color: '#40d97b' },
    { key: 'drag', label: '水阻力 Drag', color: '#c040ff' },
    { key: 'heel', label: '横倾力 Heel', color: '#ff5a5a' },
    { key: 'total', label: '合力 Total', color: '#ffe14f' },
    { key: 'crew', label: '扶正力 Crew', color: '#ffad33' },
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

function createMapView(parent: HTMLElement) {
  const wrap = createElement('div', 'map-widget');
  const toolbar = createElement('div', 'map-toolbar');

  const compass = createElement('div', 'compass-widget');
  const compassDial = createElement('div', 'compass-dial');
  const compassArrow = createElement('div', 'compass-arrow');
  const compassCenter = createElement('div', 'compass-center');
  const compassLabel = createElement('div', 'compass-label', 'Wind Flow 180°');
  compassDial.append(compassArrow, compassCenter);
  compass.append(compassDial, compassLabel);

  const zoomWrap = createElement('div', 'zoom-widget');
  const zoomTitle = createElement('div', 'zoom-title', '视角缩放');
  const zoom = createSliderRow(zoomWrap, '缩放', '0.3', '3', '0.05');
  zoom.slider.value = '1';
  zoomWrap.prepend(zoomTitle);

  toolbar.append(compass, zoomWrap);

  const minimapFrame = createElement('div', 'minimap-frame');
  const svg = createSvgElement('svg', {
    class: 'minimap-svg',
    viewBox: '0 0 200 200',
    role: 'img',
    'aria-label': '赛场小地图',
  }) as SVGSVGElement;
  const background = createSvgElement('rect', {
    x: '0',
    y: '0',
    width: '200',
    height: '200',
    rx: '16',
    fill: 'rgba(6, 28, 52, 0.94)',
    stroke: 'rgba(255,255,255,0.18)',
  });
  svg.appendChild(background);

  const labels = [
    { text: 'N', x: '100', y: '16', anchor: 'middle' },
    { text: 'S', x: '100', y: '194', anchor: 'middle' },
    { text: 'W', x: '14', y: '104', anchor: 'middle' },
    { text: 'E', x: '186', y: '104', anchor: 'middle' },
  ];
  for (const label of labels) {
    const text = createSvgElement('text', {
      x: label.x,
      y: label.y,
      'text-anchor': label.anchor,
      'font-size': '11',
      'font-weight': '700',
      fill: 'rgba(255,255,255,0.86)',
    });
    text.textContent = label.text;
    svg.appendChild(text);
  }

  for (const buoy of BUOYS) {
    const dot = createSvgElement('circle', {
      cx: (buoy.x / WORLD_WIDTH * 200).toFixed(2),
      cy: (buoy.y / WORLD_HEIGHT * 200).toFixed(2),
      r: '3.4',
      fill: '#ff8a00',
    });
    svg.appendChild(dot);
  }

  const boatMarker = createSvgElement('g') as SVGGElement;
  const boatShape = createSvgElement('polygon', {
    points: '0,-8 5,6 -5,6',
    fill: '#62ff3f',
  });
  boatMarker.appendChild(boatShape);
  svg.appendChild(boatMarker);

  minimapFrame.appendChild(svg);
  wrap.append(toolbar, minimapFrame);
  parent.appendChild(wrap);

  return {
    compassArrow,
    compassLabel,
    boatMarker,
    zoom,
  };
}

function formatAwa(snapshot: HudSnapshot): string {
  const side = snapshot.awaRelativeToBoat < 0 ? 'Port(左)' : 'Stbd(右)';
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
  refs.twd.slider.value = environment.twd.toString();
  refs.twd.value.textContent = `${environment.twd.toFixed(0)}°`;
  refs.currentSpeed.slider.value = environment.currentSpeed.toString();
  refs.currentSpeed.value.textContent = `${environment.currentSpeed.toFixed(1)} kts`;
  refs.currentDir.slider.value = environment.currentDir.toString();
  refs.currentDir.value.textContent = `${environment.currentDir.toFixed(0)}°`;
}

function createRandomEnvironment(): EnvironmentState {
  const tws = Math.round((5 + Math.random() * 20) * 2) / 2;
  const twd = Math.floor(Math.random() * 360);
  const windFlowDir = normalizeDegrees(twd + 180);
  const windDrivenCurrent = Math.random() < 0.65;

  const currentDir = windDrivenCurrent
    ? Math.round(normalizeDegrees(windFlowDir + (Math.random() * 140 - 70)))
    : Math.floor(Math.random() * 360);

  const currentSpeed = windDrivenCurrent
    ? Math.round(Math.min(2.2, 0.2 + tws * (0.02 + Math.random() * 0.04)) * 10) / 10
    : Math.round(Math.random() * 20) / 10;

  return { tws, twd, currentSpeed, currentDir };
}

function syncBodyDockState(leftDock: DockRefs, rightDock: DockRefs) {
  document.body.classList.toggle('left-dock-collapsed', leftDock.isCollapsed());
  document.body.classList.toggle('right-dock-collapsed', rightDock.isCollapsed());
}

export function createGameUi(options: CreateGameUiOptions): GameUi {
  let cameraZoom = 1;
  const vectorVisibility = { ...DEFAULT_VECTOR_VISIBILITY };

  const leftDock = createDock('left', '环境');
  const rightDock = createDock('right', '船与地图');
  document.body.append(leftDock.dock, rightDock.dock);

  const windCard = createCard(leftDock.panel, '风系统', '真实风与视风', '#00e5ff');
  const windInfo = createSection(windCard.body, '信息');
  const windMetrics = createElement('div', 'metric-grid');
  windInfo.appendChild(windMetrics);

  const hudRefs: HudValueRefs = {
    boatName: createElement('span'),
    twd: createMetric(windMetrics, '来风'),
    tws: createMetric(windMetrics, '风速'),
    awa: createMetric(windMetrics, '视风角'),
    aws: createMetric(windMetrics, '视风速'),
    currentSpeed: createElement('span'),
    currentDir: createElement('span'),
    leeway: createElement('span'),
    heading: createElement('span'),
    boatSpeed: createElement('span'),
    heel: createElement('span'),
  };
  windInfo.appendChild(createElement('p', 'card-note', '风向表示风从哪里来；视风是船上感受到的实际风。'));
  const windAdjust = createSection(windCard.body, '调整');
  const windSliders = createElement('div', 'slider-stack');
  windAdjust.appendChild(windSliders);

  const envRefs: EnvironmentRefs = {
    tws: createSliderRow(windSliders, '风速', '0', '30', '0.5'),
    twd: createSliderRow(windSliders, '来风', '0', '359', '1'),
    currentSpeed: { slider: createElement('input') as HTMLInputElement, value: createElement('span') },
    currentDir: { slider: createElement('input') as HTMLInputElement, value: createElement('span') },
    randomButton: createElement('button') as HTMLButtonElement,
  };

  const waterCard = createCard(leftDock.panel, '水系统', '水流与侧滑', '#4fc3f7');
  const waterInfo = createSection(waterCard.body, '信息');
  const waterMetrics = createElement('div', 'metric-grid metric-grid--single-third');
  waterInfo.appendChild(waterMetrics);
  hudRefs.currentSpeed = createMetric(waterMetrics, '流速');
  hudRefs.currentDir = createMetric(waterMetrics, '流向');
  hudRefs.leeway = createMetric(waterMetrics, '侧滑');
  waterInfo.appendChild(createElement('p', 'card-note', '流向表示水往哪边走。它常受潮汐、岸线和地形影响，不一定顺风。'));
  const waterAdjust = createSection(waterCard.body, '调整');
  const waterSliders = createElement('div', 'slider-stack');
  waterAdjust.appendChild(waterSliders);
  envRefs.currentSpeed = createSliderRow(waterSliders, '流速', '0', '3', '0.1');
  envRefs.currentDir = createSliderRow(waterSliders, '流向', '0', '359', '1');
  envRefs.randomButton = createElement('button', 'card-button', '随机环境') as HTMLButtonElement;
  envRefs.randomButton.type = 'button';
  waterAdjust.appendChild(envRefs.randomButton);

  const boatCard = createCard(rightDock.panel, '船系统', options.boatName, '#78ffac');
  hudRefs.boatName = boatCard.subtitle;
  const boatInfo = createSection(boatCard.body, '信息');
  const boatMetrics = createElement('div', 'metric-grid metric-grid--single-third');
  boatInfo.appendChild(boatMetrics);
  hudRefs.heading = createMetric(boatMetrics, '航向');
  hudRefs.boatSpeed = createMetric(boatMetrics, '船速');
  hudRefs.heel = createMetric(boatMetrics, '横倾');

  const boatAdjust = createSection(boatCard.body, '操控状态');
  const boatStatusWrap = createElement('div', 'status-list');
  boatAdjust.appendChild(boatStatusWrap);
  const boatStatusRefs: BoatStatusRefs = {
    sailTrim: createProgressStatus(boatStatusWrap, '帆角'),
    rudder: createCenteredStatus(boatStatusWrap, '舵角'),
    crew: createCenteredStatus(boatStatusWrap, '压舷'),
    centerboard: createProgressStatus(boatStatusWrap, '稳向板'),
  };
  boatAdjust.appendChild(createElement('p', 'card-note', '连续量用 bar 表示，受力显示保留勾选开关，便于训练和观察。'));

  const vectorSection = createSection(boatCard.body, '受力图层');
  const vectorRefs = createVectorList(vectorSection);

  const mapCard = createCard(rightDock.panel, '地图系统', '航向参考与位置态势', '#ffd166');
  const mapSection = createSection(mapCard.body, '视图');
  const mapRefs: MapRefs = createMapView(mapSection);

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

  const handleLeftToggle = () => {
    leftDock.setCollapsed(!leftDock.isCollapsed());
    syncBodyDockState(leftDock, rightDock);
  };

  const handleRightToggle = () => {
    rightDock.setCollapsed(!rightDock.isCollapsed());
    syncBodyDockState(leftDock, rightDock);
  };

  bindEnvironmentSlider(envRefs.tws, () => ({ ...options.environment }), (environment, value) => {
    environment.tws = value;
  });
  bindEnvironmentSlider(envRefs.twd, () => ({ ...options.environment }), (environment, value) => {
    environment.twd = value;
  });
  bindEnvironmentSlider(envRefs.currentSpeed, () => ({ ...options.environment }), (environment, value) => {
    environment.currentSpeed = value;
  });
  bindEnvironmentSlider(envRefs.currentDir, () => ({ ...options.environment }), (environment, value) => {
    environment.currentDir = value;
  });

  mapRefs.zoom.slider.addEventListener('input', handleZoomInput);
  window.addEventListener('wheel', handleWheel, { passive: true });
  leftDock.toggle.addEventListener('click', handleLeftToggle);
  rightDock.toggle.addEventListener('click', handleRightToggle);

  for (const key of Object.keys(vectorVisibility) as VectorKey[]) {
    vectorRefs[key].addEventListener('change', () => {
      vectorVisibility[key] = vectorRefs[key].checked;
    });
  }

  envRefs.randomButton.addEventListener('click', () => {
    const nextEnvironment = createRandomEnvironment();
    options.environment = nextEnvironment;
    options.onEnvironmentChange(nextEnvironment);
    syncEnvironmentRefs(envRefs, nextEnvironment);
  });

  syncBodyDockState(leftDock, rightDock);

  return {
    getZoom() {
      return cameraZoom;
    },
    getVectorVisibility() {
      return { ...vectorVisibility };
    },
    getLayout() {
      const leftRect = leftDock.isCollapsed()
        ? leftDock.toggle.getBoundingClientRect()
        : leftDock.panel.getBoundingClientRect();
      const rightRect = rightDock.isCollapsed()
        ? rightDock.toggle.getBoundingClientRect()
        : rightDock.panel.getBoundingClientRect();

      const viewportLeft = leftDock.isCollapsed()
        ? leftRect.right + 8
        : leftRect.right + DOCK_GAP;
      const viewportRight = rightDock.isCollapsed()
        ? rightRect.left - 8
        : rightRect.left - DOCK_GAP;

      return {
        viewportLeft,
        viewportRight,
        viewportCenterX: viewportLeft + Math.max(0, viewportRight - viewportLeft) / 2,
        minimapRect: null,
        compassRect: null,
      };
    },
    updateHud(snapshot) {
      hudRefs.boatName.textContent = snapshot.boatName;
      hudRefs.twd.textContent = `${snapshot.twd.toFixed(0)}°`;
      hudRefs.tws.textContent = `${snapshot.tws.toFixed(1)} kts`;
      hudRefs.awa.textContent = formatAwa(snapshot);
      hudRefs.aws.textContent = `${snapshot.aws.toFixed(1)} kts`;
      hudRefs.currentSpeed.textContent = `${snapshot.currentSpeed.toFixed(1)} kts`;
      hudRefs.currentDir.textContent = `${snapshot.currentDir.toFixed(0)}°`;
      hudRefs.leeway.textContent = `${snapshot.leewayAngle.toFixed(1)}°`;
      hudRefs.leeway.style.color = Math.abs(snapshot.leewayAngle) > 1 ? '#ffb347' : '#ffffff';
      hudRefs.heading.textContent = `${snapshot.boatHeading.toFixed(0)}°`;
      hudRefs.boatSpeed.textContent = `${snapshot.boatSpeed.toFixed(1)} kts`;
      hudRefs.heel.textContent = formatHeel(snapshot);

      if (boatStatusRefs.sailTrim.fill) {
        boatStatusRefs.sailTrim.fill.style.width = `${clamp(snapshot.sailTrim, 0, 100)}%`;
      }
      boatStatusRefs.sailTrim.value.textContent = `${snapshot.sailTrim.toFixed(0)}%`;

      if (boatStatusRefs.centerboard.fill) {
        boatStatusRefs.centerboard.fill.style.width = `${clamp(snapshot.centerboardDown, 0, 100)}%`;
      }
      boatStatusRefs.centerboard.value.textContent = `${snapshot.centerboardDown.toFixed(0)}%`;

      if (boatStatusRefs.rudder.thumb) {
        const rudderPosition = ((clamp(snapshot.rudderAngle, -DEFAULT_RUDDER_RANGE, DEFAULT_RUDDER_RANGE) + DEFAULT_RUDDER_RANGE) / (DEFAULT_RUDDER_RANGE * 2)) * 100;
        boatStatusRefs.rudder.thumb.style.left = `${rudderPosition}%`;
      }
      boatStatusRefs.rudder.value.textContent = `${snapshot.rudderAngle.toFixed(1)}°`;

      if (boatStatusRefs.crew.thumb) {
        const crewPosition = ((clamp(snapshot.crewWeightOffset, -100, 100) + 100) / 200) * 100;
        boatStatusRefs.crew.thumb.style.left = `${crewPosition}%`;
      }
      boatStatusRefs.crew.value.textContent = formatSignedPercent(snapshot.crewWeightOffset);

      const windFlowDegrees = normalizeDegrees(snapshot.twd + 180);
      mapRefs.compassArrow.style.transform = `translate(-50%, -92%) rotate(${windFlowDegrees}deg)`;
      mapRefs.compassLabel.textContent = `Wind Flow ${windFlowDegrees.toFixed(0)}°`;

      const mapX = snapshot.boatPosition.x / WORLD_WIDTH * 200;
      const mapY = snapshot.boatPosition.y / WORLD_HEIGHT * 200;
      mapRefs.boatMarker.setAttribute(
        'transform',
        `translate(${mapX.toFixed(2)} ${mapY.toFixed(2)}) rotate(${snapshot.boatHeading.toFixed(2)})`,
      );
    },
    syncEnvironment(environment) {
      options.environment = { ...environment };
      syncEnvironmentRefs(envRefs, environment);
    },
    destroy() {
      mapRefs.zoom.slider.removeEventListener('input', handleZoomInput);
      window.removeEventListener('wheel', handleWheel);
      leftDock.toggle.removeEventListener('click', handleLeftToggle);
      rightDock.toggle.removeEventListener('click', handleRightToggle);
      document.body.classList.remove('left-dock-collapsed', 'right-dock-collapsed');
      leftDock.dock.remove();
      rightDock.dock.remove();
    },
  };
}
