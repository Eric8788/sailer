import type {
  EnvironmentState,
  HudSnapshot,
  OverlayLayout,
  OverlayRect,
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

const DOCK_GAP = 16;

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
  sailTrim: HTMLElement;
  rudder: HTMLElement;
  crew: HTMLElement;
  centerboard: HTMLElement;
}

interface DockRefs {
  dock: HTMLElement;
  panel: HTMLElement;
  toggle: HTMLButtonElement;
  isCollapsed: () => boolean;
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

function createDock(side: 'left' | 'right', label: string): DockRefs {
  let collapsed = false;

  const dock = createElement('aside', `hud-dock hud-dock--${side}`);
  const toggle = createElement('button', 'dock-toggle') as HTMLButtonElement;
  toggle.type = 'button';
  toggle.setAttribute('aria-label', `${side === 'left' ? '左' : '右'}侧栏`);

  const toggleIcon = createElement('span', 'dock-toggle-icon');
  const toggleLabel = createElement('span', 'dock-toggle-label', label);
  toggle.append(toggleIcon, toggleLabel);

  const panel = createElement('div', 'dock-panel');
  dock.append(toggle, panel);

  const updateDockState = () => {
    dock.classList.toggle('is-collapsed', collapsed);
    toggleIcon.textContent = collapsed
      ? side === 'left' ? '›' : '‹'
      : side === 'left' ? '‹' : '›';
  };

  updateDockState();

  return {
    dock,
    panel,
    toggle,
    isCollapsed: () => collapsed,
    setCollapsed(nextCollapsed: boolean) {
      collapsed = nextCollapsed;
      updateDockState();
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

function readRect(element: HTMLElement | null): OverlayRect | null {
  if (!element || element.offsetParent === null) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
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

export function createGameUi(options: CreateGameUiOptions): GameUi {
  let cameraZoom = 1;
  const vectorVisibility = { ...DEFAULT_VECTOR_VISIBILITY };

  const leftDock = createDock('left', '风 / 水');
  const rightDock = createDock('right', '船 / 图');
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
    sailTrim: createElement('span'),
    rudder: createElement('span'),
    crew: createElement('span'),
    centerboard: createElement('span'),
  };

  windInfo.appendChild(createElement('p', 'card-note', '风向表示风从哪里来；视风则是船上实际感受到的风。'));
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
  const waterMetrics = createElement('div', 'metric-grid');
  waterInfo.appendChild(waterMetrics);
  hudRefs.currentSpeed = createMetric(waterMetrics, '流速');
  hudRefs.currentDir = createMetric(waterMetrics, '流向');
  hudRefs.leeway = createMetric(waterMetrics, '侧滑');
  waterInfo.appendChild(createElement('p', 'card-note', '流向表示水往哪边走。它可能受潮汐、岸线和海底地形影响，不一定顺风。'));
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
  const boatInfoGrid = createElement('div', 'metric-grid');
  boatInfo.appendChild(boatInfoGrid);
  hudRefs.heading = createMetric(boatInfoGrid, '航向');
  hudRefs.boatSpeed = createMetric(boatInfoGrid, '船速');
  hudRefs.heel = createMetric(boatInfoGrid, '横倾');

  const boatAdjust = createSection(boatCard.body, '调整');
  const boatAdjustGrid = createElement('div', 'metric-grid');
  boatAdjust.appendChild(boatAdjustGrid);
  hudRefs.sailTrim = createMetric(boatAdjustGrid, '帆角 ↑↓');
  hudRefs.rudder = createMetric(boatAdjustGrid, '舵角 A/D');
  hudRefs.crew = createMetric(boatAdjustGrid, '压舷 ←→');
  hudRefs.centerboard = createMetric(boatAdjustGrid, '稳向板 W/S');
  boatAdjust.appendChild(createElement('p', 'card-note', 'A/D 转舵，↑↓ 调帆，←→ 压舷，W/S 调整稳向板。'));

  const vectorSection = createSection(boatCard.body, '受力叠加');
  const vectorRefs = createVectorList(vectorSection);

  const mapCard = createCard(rightDock.panel, '地图系统', '航向参考与位置态势', '#ffd166');
  const mapInfo = createSection(mapCard.body, '视图');
  const mapStage = createElement('div', 'map-stage');
  const compassSlot = createElement('div', 'map-slot map-slot--compass');
  const minimapSlot = createElement('div', 'map-slot map-slot--minimap');
  mapStage.append(compassSlot, minimapSlot);
  mapInfo.appendChild(mapStage);
  mapInfo.appendChild(createElement('p', 'card-note', '右侧地图会随侧栏展开显示；收起侧栏时主画面将获得更大的操作视野。'));

  const { zoomBar, slider: zoomSlider } = (() => {
    const bar = createElement('div');
    bar.id = 'zoom-bar';

    const plus = createElement('label', undefined, '+');
    const slider = createElement('input') as HTMLInputElement;
    slider.id = 'zoom-slider';
    slider.type = 'range';
    slider.min = '0.3';
    slider.max = '3';
    slider.step = '0.05';
    slider.value = '1';

    const minus = createElement('label', undefined, '-');
    bar.append(plus, slider, minus);
    return { zoomBar: bar, slider };
  })();
  document.body.appendChild(zoomBar);

  syncEnvironmentRefs(envRefs, options.environment);

  const handleZoomInput = () => {
    cameraZoom = Number.parseFloat(zoomSlider.value);
  };

  const handleWheel = (event: WheelEvent) => {
    cameraZoom = Math.max(0.3, Math.min(3, cameraZoom - event.deltaY * 0.001));
    zoomSlider.value = cameraZoom.toString();
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

  const updateDockBodyClass = () => {
    document.body.classList.toggle('left-dock-collapsed', leftDock.isCollapsed());
    document.body.classList.toggle('right-dock-collapsed', rightDock.isCollapsed());
  };

  const handleLeftToggle = () => {
    leftDock.setCollapsed(!leftDock.isCollapsed());
    updateDockBodyClass();
  };

  const handleRightToggle = () => {
    rightDock.setCollapsed(!rightDock.isCollapsed());
    updateDockBodyClass();
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

  zoomSlider.addEventListener('input', handleZoomInput);
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

  updateDockBodyClass();

  return {
    getZoom() {
      return cameraZoom;
    },
    getVectorVisibility() {
      return { ...vectorVisibility };
    },
    getLayout() {
      const leftSourceRect = readRect(leftDock.isCollapsed() ? leftDock.toggle : leftDock.panel);
      const rightSourceRect = readRect(rightDock.isCollapsed() ? rightDock.toggle : rightDock.panel);

      const viewportLeft = leftSourceRect ? Math.max(0, leftSourceRect.x + leftSourceRect.width + DOCK_GAP) : DOCK_GAP;
      const viewportRight = rightSourceRect
        ? Math.min(window.innerWidth, rightSourceRect.x - DOCK_GAP)
        : window.innerWidth - DOCK_GAP;

      const safeLeft = Math.min(viewportLeft, viewportRight);
      const safeRight = Math.max(viewportLeft, viewportRight);

      return {
        viewportLeft: safeLeft,
        viewportRight: safeRight,
        viewportCenterX: safeLeft + Math.max(0, safeRight - safeLeft) / 2,
        minimapRect: rightDock.isCollapsed() ? null : readRect(minimapSlot),
        compassRect: rightDock.isCollapsed() ? null : readRect(compassSlot),
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
      hudRefs.sailTrim.textContent = `${snapshot.sailTrim.toFixed(0)}%`;
      hudRefs.rudder.textContent = `${snapshot.rudderAngle.toFixed(1)}°`;
      hudRefs.crew.textContent = `${snapshot.crewWeightOffset.toFixed(0)}%`;
      hudRefs.centerboard.textContent = `${snapshot.centerboardDown.toFixed(0)}%`;
    },
    syncEnvironment(environment) {
      options.environment = { ...environment };
      syncEnvironmentRefs(envRefs, environment);
    },
    destroy() {
      zoomSlider.removeEventListener('input', handleZoomInput);
      window.removeEventListener('wheel', handleWheel);
      leftDock.toggle.removeEventListener('click', handleLeftToggle);
      rightDock.toggle.removeEventListener('click', handleRightToggle);
      document.body.classList.remove('left-dock-collapsed', 'right-dock-collapsed');
      leftDock.dock.remove();
      rightDock.dock.remove();
      zoomBar.remove();
    },
  };
}
