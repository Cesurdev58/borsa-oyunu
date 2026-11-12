/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Şehrin gerçek 3D sahnesi (three). React'ten bağımsızdır: `update()` ile oyun verisi verilir,
 * tıklamalar `handlers` üzerinden geri gelir.
 *
 * Harita 1600×1200 sanal birimdir; dünyaya 0,1 ile çevrilir (x → x, y → z).
 * Zemin, yollar ve araç rotaları eski 2.5D görünümle aynı koordinatları kullanır.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { SimulationStage } from '../../../models/simulation';
import { GraphicsQualityLevel } from '../../../state/uiSettingsStore';
import { CityBuildingId } from '../gameTypes';
import { deriveCityTrafficFleet, STATIC_CITY_DECORATIONS } from '../city/cityLayout';
import {
  CityAtmosphereTheme,
  CityTrafficRouteId,
  CityUrbanBlockNode,
  CityZoomPreset,
  IsometricBuildingNode,
} from '../city/cityVisualTypes';
import {
  box,
  createRng,
  cyl,
  disposeKit,
  disposeObject,
  makeBush,
  makeCar,
  makePerson,
  makeLamp,
  makeLampPool,
  makePine,
  makeTree,
  makeTruck,
  mark,
  setLampGlow,
  setWindowGlow,
  sign,
  stdMat,
} from './kit';
import { buildBlock, buildCore, SHOP_SLOT_IDS, tintLocked } from './models';

const K = 0.1;
const wx = (x: number) => (x - 800) * K;
const wz = (y: number) => (y - 600) * K;
const BASE_Y = 0.26;

export interface CitySceneInputs {
  buildings: IsometricBuildingNode[];
  blocks: CityUrbanBlockNode[];
  atmosphere: CityAtmosphereTheme;
  stage: SimulationStage;
  isPaused: boolean;
  graphicsQuality: GraphicsQualityLevel;
  hasPlayerCompany: boolean;
  isProducing: boolean;
  inventoryUnits: number;
  inTransitShipmentsCount: number;
  selectedBuildingId: CityBuildingId | null;
  selectedBlockId: string | null;
}

export interface CitySceneHandlers {
  onPickBuilding: (id: CityBuildingId) => void;
  onPickBlock: (id: string) => void;
  onPickNothing: () => void;
}

interface Entity {
  kind: 'core' | 'block';
  id: string;
  modelSig: string;
  labelSig: string;
  root: THREE.Group;
  model: THREE.Group | null;
  label: CSS2DObject;
  labelCovered?: boolean;
  labelEl: HTMLDivElement;
  orb: THREE.Mesh | null;
  radius: number;
  top: number;
  labelShown: boolean;
}

interface RouteKey {
  t: number;
  x: number;
  y: number;
}

const ROUTES: Record<CityTrafficRouteId, RouteKey[]> = {
  FINANS_MEYDANI_ROTASI: [
    { t: 0, x: 520, y: 380 },
    { t: 0.25, x: 1070, y: 380 },
    { t: 0.5, x: 1070, y: 770 },
    { t: 0.75, x: 520, y: 770 },
    { t: 1, x: 520, y: 380 },
  ],
  SANAYI_SIRKET_ROTASI: [
    { t: 0, x: 240, y: 895 },
    { t: 0.5, x: 1340, y: 895 },
    { t: 1, x: 240, y: 895 },
  ],
  TICARET_BULVARI_ROTASI: [
    { t: 0, x: 215, y: 385 },
    { t: 0.35, x: 215, y: 885 },
    { t: 0.65, x: 510, y: 605 },
    { t: 1, x: 215, y: 385 },
  ],
  KUZEY_GUNEY_ANAYOL_ROTASI: [
    { t: 0, x: 380, y: 380 },
    { t: 0.5, x: 1220, y: 380 },
    { t: 1, x: 380, y: 380 },
  ],
};

/** Yaya yolları (dünya birimi): halka yolun dış ve iç kaldırımı, güney cadde kaldırımı. Kapalı halkalar başa döner. */
const WALK_PATHS: [number, number][][] = [
  [[-32.6, -25.6], [32.6, -25.6], [32.6, 21.6], [-32.6, 21.6], [-32.6, -25.6]],
  [[-25.4, -18.6], [25.4, -18.6], [25.4, 14.6], [-25.4, 14.6], [-25.4, -18.6]],
  [[-64, 26.4], [64, 26.4], [64, 32.7], [-64, 32.7], [-64, 26.4]],
];

function pathLength(path: [number, number][]): number {
  let t = 0;
  for (let i = 0; i < path.length - 1; i++) t += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
  return t;
}

interface Roadway {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
}

// Eski yol çizgileriyle aynı koordinatlar (harita birimi); genişlik dünya birimidir.
const ROADWAYS: Roadway[] = [
  { x1: 510, y1: 380, x2: 1090, y2: 380, w: 5.6 },
  { x1: 1090, y1: 380, x2: 1090, y2: 780, w: 5.6 },
  { x1: 1090, y1: 780, x2: 510, y2: 780, w: 5.6 },
  { x1: 510, y1: 780, x2: 510, y2: 380, w: 5.6 },
  { x1: 210, y1: 380, x2: 1390, y2: 380, w: 5.2 },
  { x1: 795, y1: 250, x2: 795, y2: 380, w: 5 },
  { x1: 355, y1: 320, x2: 535, y2: 415, w: 4.8 },
  { x1: 1240, y1: 330, x2: 1065, y2: 415, w: 4.8 },
  { x1: 215, y1: 380, x2: 215, y2: 895, w: 4.6 },
  { x1: 135, y1: 605, x2: 510, y2: 605, w: 5 },
  { x1: 1090, y1: 595, x2: 1465, y2: 595, w: 5 },
  { x1: 1375, y1: 380, x2: 1375, y2: 895, w: 4.6 },
  { x1: 145, y1: 895, x2: 1465, y2: 895, w: 5.6 },
  { x1: 365, y1: 895, x2: 530, y2: 780, w: 4.8 },
  { x1: 805, y1: 1100, x2: 805, y2: 780, w: 4.8 },
  { x1: 1255, y1: 885, x2: 1070, y2: 780, w: 4.8 },
];

const ZONES = [
  { x: 220, y: 105, w: 1150, h: 245, color: '#dedbd0' },
  { x: 70, y: 410, w: 415, h: 375, color: '#d8cdb8' },
  { x: 1115, y: 410, w: 420, h: 375, color: '#a9d98f' },
  { x: 75, y: 825, w: 545, h: 325, color: '#c2b6a4' },
  { x: 665, y: 825, w: 865, h: 325, color: '#c4e3a0' },
  { x: 65, y: 115, w: 135, h: 230, color: '#9fd36a' },
  { x: 1395, y: 115, w: 140, h: 230, color: '#9fd36a' },
];

const TONE_COLOR: Record<string, string> = {
  emerald: '#2ecc71',
  amber: '#f5a623',
  sky: '#38bdf8',
  slate: '#94a3b8',
  rose: '#f43f5e',
  violet: '#8b5cf6',
};

interface PhaseLook {
  sky: string;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  sun: string;
  sunI: number;
  sunPos: [number, number, number];
  grass: string;
  glow: number;
  lamps: number;
  exposure: number;
}

const LOOKS: Record<string, PhaseLook> = {
  MORNING: { sky: '#cfe3f5', hemiSky: '#d6e8ff', hemiGround: '#9a9078', hemi: 1.15, sun: '#ffe2b8', sunI: 2.3, sunPos: [-110, 95, 60], grass: '#9ccb6b', glow: 0.15, lamps: 0, exposure: 1.05 },
  DAY: { sky: '#bfdcf5', hemiSky: '#d6e8ff', hemiGround: '#8c8470', hemi: 1.25, sun: '#fff0d6', sunI: 2.8, sunPos: [-90, 130, 70], grass: '#86bd55', glow: 0, lamps: 0, exposure: 1.05 },
  EVENING: { sky: '#e6b08c', hemiSky: '#f3c9a8', hemiGround: '#6f6a5e', hemi: 0.85, sun: '#ffa862', sunI: 2.1, sunPos: [120, 55, 40], grass: '#7aa152', glow: 0.55, lamps: 1, exposure: 1.0 },
  NIGHT: { sky: '#1b2a44', hemiSky: '#6f8ac7', hemiGround: '#243a2e', hemi: 0.55, sun: '#8fa8e8', sunI: 0.75, sunPos: [-70, 120, 60], grass: '#2c4a36', glow: 1, lamps: 1, exposure: 0.95 },
};

const ZOOM_DISTANCE: Record<CityZoomPreset, number> = { CLOSER: 150, NORMAL: 205, OVERVIEW: 270 };
// Harita eski görünümdeki gibi neredeyse düz karşıdan bakılır (hafif sağdan).
const VIEW_DIR = new THREE.Vector3(0.22, 0.6, 0.78).normalize();
/** Bu mesafeden yakında bütün blok etiketleri açılır. */
const LABEL_NEAR = 165;

function mat(color: string | number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return stdMat(color, { flatShading: false, ...extra });
}

export class ThreeCityScene {
  private container: HTMLElement;
  private handlers: CitySceneHandlers;
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private labelPos = new THREE.Vector3();
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private grassMat: THREE.MeshStandardMaterial;
  private entities = new Map<string, Entity>();
  private decoGroup = new THREE.Group();
  private decoStage = -1;
  private vehicleGroup = new THREE.Group();
  private walkerGroup = new THREE.Group();
  private walkers: { obj: THREE.Group; path: number; offset: number; speed: number; legL?: THREE.Object3D; legR?: THREE.Object3D }[] = [];
  private vehicles: { obj: THREE.Group; route: CityTrafficRouteId; duration: number; delay: number }[] = [];
  private trafficKey = '';
  private selRing: THREE.Mesh;
  private hoverRing: THREE.Mesh;
  private lampPools: THREE.Object3D[] = [];
  private phase = '';
  private quality: GraphicsQualityLevel | '' = '';
  private paused = false;
  private elapsed = 0;
  private clock = new THREE.Clock();
  private raf = 0;
  private resizeObs: ResizeObserver;
  private tween: { kind: 'dist' | 'focus'; t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; fromLen: number; toLen: number } | null = null;
  private down = { x: 0, y: 0, time: 0, active: false };
  private hoverKey = '';
  private selectedKey = '';
  private lastHoverCheck = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private disposed = false;
  private lastInputs: CitySceneInputs | null = null;

  constructor(container: HTMLElement, handlers: CitySceneHandlers) {
    this.container = container;
    this.handlers = handlers;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block;';
    canvas.setAttribute('data-testid', 'city3d-canvas');
    container.appendChild(canvas);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    const le = this.labelRenderer.domElement;
    le.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    container.appendChild(le);

    this.camera = new THREE.PerspectiveCamera(32, w / h, 1, 1500);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minDistance = 55;
    this.controls.maxDistance = 400;
    this.controls.target.set(0, 2, 6);
    this.camera.position.copy(this.controls.target).addScaledVector(VIEW_DIR, ZOOM_DISTANCE.NORMAL);
    this.controls.update();

    this.hemi = new THREE.HemisphereLight('#d6e8ff', '#8c8470', 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d6', 2.7);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -125;
    sc.right = 125;
    sc.top = 125;
    sc.bottom = -125;
    sc.near = 10;
    sc.far = 420;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun);

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), mat('#86bd55'));
    this.grassMat = grass.material as THREE.MeshStandardMaterial;
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.05;
    grass.receiveShadow = true;
    this.scene.add(grass);

    this.buildGround();
    this.buildForestBelt();
    this.scene.add(this.decoGroup);
    this.scene.add(this.vehicleGroup);
    this.scene.add(this.walkerGroup);
    this.buildWalkers();

    const ringMat = (color: string, opacity: number) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 56), ringMat('#f5a623', 0.95));
    this.selRing.rotation.x = -Math.PI / 2;
    this.selRing.visible = false;
    this.selRing.renderOrder = 5;
    this.scene.add(this.selRing);
    this.hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 56), ringMat('#ffffff', 0.7));
    this.hoverRing.rotation.x = -Math.PI / 2;
    this.hoverRing.visible = false;
    this.hoverRing.renderOrder = 4;
    this.scene.add(this.hoverRing);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);

    this.clock.start();
    this.loop();
  }

  // ---------- Zemin, yollar, meydan ----------

  private buildGround(): void {
    const g = new THREE.Group();

    for (const z of ZONES) {
      const cx = wx(z.x + z.w / 2);
      const cz = wz(z.y + z.h / 2);
      const w = z.w * K;
      const d = z.h * K;
      const edge = box(w + 0.7, 0.2, d + 0.7, mat('#f1f1ea'), cx, 0.1, cz);
      const top = box(w, 0.24, d, mat(z.color), cx, 0.12, cz);
      edge.receiveShadow = true;
      top.receiveShadow = true;
      g.add(edge, top);
    }

    const shapeMesh = (pts: [number, number][], color: string, depth: number, y: number) => {
      const s = new THREE.Shape(pts.map(([x, yy]) => new THREE.Vector2(wx(x), -wz(yy))));
      const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat(color));
      m.position.y = y;
      m.receiveShadow = true;
      return m;
    };
    g.add(shapeMesh([[800, 455], [965, 540], [800, 625], [635, 540]], '#8fcd57', 0.2, 0.18));
    g.add(shapeMesh([[795, 435], [1015, 580], [795, 725], [575, 580]], '#e7e5de', 0.16, 0.2));
    g.add(shapeMesh([[795, 470], [960, 580], [795, 690], [630, 580]], '#86c94a', 0.2, 0.2));
    const pave = mat('#e7e5de');
    g.add(box(34, 0.1, 1.4, pave, 0, 0.42, wz(580) - 0));
    g.add(box(1.4, 0.1, 22, pave, 0, 0.42, wz(580)));

    // yollar: önce kaldırım, sonra asfalt, sonra çizgi
    const sidewalk = mat('#d6d3cb');
    const asphalt = mat('#4b5057', { roughness: 0.95 });
    const lineY = mat('#e8c648', { emissive: new THREE.Color('#000000') });
    for (const pass of ['side', 'asph', 'line'] as const) {
      for (const r of ROADWAYS) {
        const dx = wx(r.x2) - wx(r.x1);
        const dz = wz(r.y2) - wz(r.y1);
        const len = Math.hypot(dx, dz);
        const cx = (wx(r.x1) + wx(r.x2)) / 2;
        const cz = (wz(r.y1) + wz(r.y2)) / 2;
        const ang = Math.atan2(dz, dx);
        if (pass === 'side' || pass === 'asph') {
          const side = pass === 'side';
          const width = side ? r.w + 1.6 : r.w;
          const height = side ? 0.14 : 0.1;
          const y0 = side ? 0.3 : 0.36;
          const m = box(len, height, width, side ? sidewalk : asphalt, cx, y0 - height / 2 + 0.0, cz);
          m.rotation.y = -ang;
          m.receiveShadow = true;
          g.add(m);
          for (const [ex, ez] of [[r.x1, r.y1], [r.x2, r.y2]]) {
            const cap = cyl(width / 2, width / 2, height, side ? sidewalk : asphalt, wx(ex), y0 - height / 2, wz(ez), 18);
            cap.receiveShadow = true;
            g.add(cap);
          }
        } else {
          const dashes = Math.floor(len / 4);
          for (let i = 0; i < dashes; i++) {
            const tt = (i + 0.5) / dashes;
            const dash = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.28), lineY);
            dash.rotation.x = -Math.PI / 2;
            dash.rotation.z = ang;
            dash.position.set(wx(r.x1) + dx * tt, 0.375, wz(r.y1) + dz * tt);
            g.add(dash);
          }
        }
      }
    }
    this.scene.add(g);
  }

  private buildForestBelt(): void {
    const rng = createRng('forest-belt');
    const group = new THREE.Group();
    const spots: [number, number][] = [];
    for (let i = 0; i < 70; i++) {
      spots.push([-92 + rng() * 184, -68 - rng() * 22]);
      spots.push([-92 + rng() * 184, 68 + rng() * 22]);
    }
    for (let i = 0; i < 36; i++) {
      spots.push([-92 - rng() * 22, -66 + rng() * 132]);
      spots.push([92 + rng() * 22, -66 + rng() * 132]);
    }
    for (const [x, z] of spots) {
      const t = rng() < 0.3 ? makePine(1.1 + rng() * 0.8) : makeTree(1.2 + rng() * 0.9, rng);
      t.position.set(x, 0, z);
      mark(t);
      group.add(t);
    }
    this.scene.add(group);
  }

  // ---------- Dekorlar (aşamaya göre) ----------

  private rebuildDecorations(stage: number): void {
    if (stage === this.decoStage) return;
    this.decoStage = stage;
    this.decoGroup.children.slice().forEach((c) => {
      disposeObject(c);
      this.decoGroup.remove(c);
    });
    this.lampPools = [];
    const rng = createRng(`deco-${stage}`);
    for (const d of STATIC_CITY_DECORATIONS) {
      if (stage < d.minStage) continue;
      const x = wx(d.x);
      const z = wz(d.y);
      const sc = d.scale ?? 1;
      let o: THREE.Object3D | null = null;
      switch (d.kind) {
        case 'TREE':
          o = makeTree(0.9 * sc, rng);
          break;
        case 'PINE_TREE':
          o = makePine(0.95 * sc);
          break;
        case 'BUSH':
          o = makeBush(sc);
          break;
        case 'STREET_LAMP': {
          const l = makeLamp();
          const pool = makeLampPool();
          l.add(pool);
          this.lampPools.push(pool);
          o = l;
          break;
        }
        case 'PARK_BENCH': {
          const b = new THREE.Group();
          const m = stdMat('#8a5a35');
          b.add(box(3, 0.25, 0.9, m, 0, 0.7, 0), box(3, 0.7, 0.2, m, 0, 1.2, -0.4));
          o = b;
          break;
        }
        case 'PLAZA_FOUNTAIN': {
          const f = new THREE.Group();
          const pond = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.3, 28), mat('#5db8e8', { roughness: 0.15, metalness: 0.1 }));
          pond.position.y = 0.48;
          f.add(pond);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.55, 6, 28), stdMat('#d8d1bf'));
          rim.rotation.x = Math.PI / 2;
          rim.position.y = 0.6;
          f.add(rim);
          f.add(cyl(0.8, 1.2, 4, stdMat('#e8e2d2'), 0, 2.4, 0));
          const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), stdMat('#e0b84a', { metalness: 0.5, roughness: 0.35 }));
          orb.position.y = 5;
          f.add(orb);
          o = f;
          break;
        }
        case 'STAGE4_MONUMENT': {
          const m = new THREE.Group();
          m.add(box(3, 1, 3, stdMat('#e8e2d2'), 0, 0.5, 0));
          m.add(cyl(0.5, 1, 9, stdMat('#d6b24a', { metalness: 0.5, roughness: 0.35 }), 0, 5.5, 0, 4));
          o = m;
          break;
        }
        case 'STAGE3_FLAG': {
          const f = new THREE.Group();
          f.add(cyl(0.12, 0.14, 7, stdMat('#9aa0a6'), 0, 3.5, 0, 6));
          f.add(box(2.2, 1.3, 0.1, stdMat('#d63a2f'), 1.2, 6.2, 0));
          o = f;
          break;
        }
        case 'BUS_STOP': {
          const s = new THREE.Group();
          s.add(box(4, 0.2, 1.6, stdMat('#3a6ea5'), 0, 2.6, 0));
          s.add(box(0.2, 2.6, 0.2, stdMat('#4b5258'), -1.8, 1.3, 0));
          s.add(box(0.2, 2.6, 0.2, stdMat('#4b5258'), 1.8, 1.3, 0));
          s.add(box(3.6, 1.6, 0.1, new THREE.MeshStandardMaterial({ color: '#9fd0ee', transparent: true, opacity: 0.45 }), 0, 1.5, -0.7));
          o = s;
          break;
        }
        case 'TAXI_STAND': {
          const s = new THREE.Group();
          s.add(cyl(0.12, 0.14, 3.6, stdMat('#4b5258'), 0, 1.8, 0, 6));
          s.add(sign('TAKSİ', '#f2c230', '#222222', 2.4, 0.9, 200));
          s.children[1].position.set(0, 3.7, 0.1);
          o = s;
          break;
        }
        case 'FLOWER_BED': {
          const f = new THREE.Group();
          f.add(box(3, 0.4, 1.4, stdMat('#6b4a2f'), 0, 0.25, 0));
          const cols = ['#e5484d', '#f2c230', '#e86ab4'];
          for (let i = 0; i < 5; i++) {
            const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), stdMat(cols[i % 3]));
            fl.position.set(-1.1 + i * 0.55, 0.6, (i % 2) * 0.3 - 0.15);
            f.add(fl);
          }
          o = f;
          break;
        }
        case 'PARKING_LOT': {
          const p = new THREE.Group();
          p.add(box(8, 0.06, 5, stdMat('#8f949a'), 0, 0.3, 0));
          for (let i = -3; i <= 3; i++) p.add(box(0.12, 0.02, 3, stdMat('#f1f1ea'), i * 1.1, 0.34, 0));
          o = p;
          break;
        }
        default:
          break;
      }
      if (!o) continue;
      o.position.set(x, BASE_Y + (d.kind === 'PLAZA_FOUNTAIN' || d.kind === 'PARKING_LOT' ? 0 : 0), z);
      mark(o, d.kind !== 'PARKING_LOT', true);
      this.decoGroup.add(o);
    }
    if (this.lastInputs) this.applyPhase(this.lastInputs.atmosphere.phase, true);
  }

  // ---------- Işık ve atmosfer ----------

  private applyPhase(phase: string, force = false): void {
    if (!force && phase === this.phase) return;
    this.phase = phase;
    const look = LOOKS[phase] ?? LOOKS.DAY;
    this.scene.background = new THREE.Color(look.sky);
    this.scene.fog = new THREE.Fog(look.sky, 330, 720);
    this.hemi.color.set(look.hemiSky);
    this.hemi.groundColor.set(look.hemiGround);
    this.hemi.intensity = look.hemi;
    this.sun.color.set(look.sun);
    this.sun.intensity = look.sunI;
    this.sun.position.set(...look.sunPos);
    this.grassMat.color.set(look.grass);
    this.renderer.toneMappingExposure = look.exposure;
    setWindowGlow(look.glow);
    setLampGlow(look.lamps ? 1.4 : 0);
    this.lampPools.forEach((p) => (p.visible = look.lamps > 0));
  }

  private applyQuality(q: GraphicsQualityLevel): void {
    if (q === this.quality) return;
    this.quality = q;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.renderer.setPixelRatio(q === 'LOW' ? 1 : Math.min(dpr, q === 'HIGH' ? 2 : 1.5));
    this.renderer.shadowMap.enabled = q !== 'LOW';
    const size = q === 'HIGH' ? 4096 : 2048;
    this.sun.castShadow = q !== 'LOW';
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    (this.sun.shadow as THREE.LightShadow).map = null;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => (mm.needsUpdate = true));
    });
  }

  // ---------- Veri → sahne ----------

  update(inp: CitySceneInputs): void {
    if (this.disposed) return;
    this.lastInputs = inp;
    this.paused = inp.isPaused;
    this.applyQuality(inp.graphicsQuality);
    this.rebuildDecorations(inp.stage);
    this.applyPhase(inp.atmosphere.phase);

    const seen = new Set<string>();
    for (const b of inp.buildings) {
      const key = `core:${b.id}`;
      seen.add(key);
      const modelSig = JSON.stringify([b.isUnlocked, b.level, b.visualMeta.companyTicker, b.visualMeta.isFactoryProducing, Boolean(b.constructionInfo)]);
      const labelSig = JSON.stringify([b.shortName, b.shortStatusLabel, b.statusTone, b.badgeCount ?? 0, b.isUnlocked]);
      this.syncEntity(key, 'core', b.id, wx(b.x), wz(b.y), modelSig, labelSig, () => buildCore(b), (el) => this.fillCoreLabel(el, b), b.statusTone, !b.isUnlocked);
    }
    for (const bl of inp.blocks) {
      const key = `block:${bl.id}`;
      seen.add(key);
      const modelSig = JSON.stringify([bl.isUnlocked, bl.level ?? 1, bl.activeShopType ?? null, bl.floors, Boolean(bl.activeShopId)]);
      const labelSig = JSON.stringify([bl.shortTagTR, bl.isUnlocked, bl.stockWarning ?? false, bl.pendingDeliveryCount ?? 0, bl.hasStockToSell ?? false]);
      this.syncEntity(key, 'block', bl.id, wx(bl.x), wz(bl.y), modelSig, labelSig, () => buildBlock(bl), (el) => this.fillBlockLabel(el, bl), null, !bl.isUnlocked && !SHOP_SLOT_IDS.has(bl.id));
    }
    for (const [key, e] of this.entities) {
      if (!seen.has(key)) this.removeEntity(key, e);
    }

    this.updateSelection(inp);
    this.updateTraffic(inp);
  }

  private syncEntity(
    key: string,
    kind: 'core' | 'block',
    id: string,
    x: number,
    z: number,
    modelSig: string,
    labelSig: string,
    build: () => THREE.Group,
    fillLabel: (el: HTMLDivElement) => void,
    tone: string | null,
    faded: boolean
  ): void {
    let e = this.entities.get(key);
    if (!e) {
      const root = new THREE.Group();
      root.position.set(x, BASE_Y, z);
      root.userData.pick = { kind, id };
      const labelEl = document.createElement('div');
      labelEl.setAttribute('data-testid', `city3d-label-${id}`);
      const label = new CSS2DObject(labelEl);
      root.add(label);
      this.scene.add(root);
      e = { kind, id, modelSig: '', labelSig: '', root, model: null, label, labelEl, orb: null, radius: 6, top: 8, labelShown: true };
      this.entities.set(key, e);
    }
    if (e.modelSig !== modelSig) {
      if (e.model) {
        e.root.remove(e.model);
        disposeObject(e.model);
      }
      if (e.orb) {
        e.root.remove(e.orb);
        disposeObject(e.orb);
        e.orb = null;
      }
      const model = build();
      if (faded) tintLocked(model);
      mark(model);
      e.root.add(model);
      e.model = model;
      e.modelSig = modelSig;
      const bb = new THREE.Box3().setFromObject(model);
      const size = bb.getSize(new THREE.Vector3());
      e.radius = Math.max(size.x, size.z) / 2 + 1.2;
      e.top = Math.max(4, bb.max.y);
      e.label.position.set(0, kind === 'core' ? -e.radius * 0.35 : -e.radius * 0.3, e.radius * 0.55);
      e.label.position.y = 0.4;
      e.label.position.z = Math.max(size.z / 2 + 2.4, 3);
      if (tone) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8), new THREE.MeshBasicMaterial({ color: TONE_COLOR[tone] ?? '#94a3b8' }));
        orb.position.set(0, e.top + 3.2, 0);
        orb.name = 'orb';
        e.root.add(orb);
        e.orb = orb;
      }
    } else if (e.orb && tone) {
      (e.orb.material as THREE.MeshBasicMaterial).color.set(TONE_COLOR[tone] ?? '#94a3b8');
    }
    if (e.labelSig !== labelSig) {
      e.labelSig = labelSig;
      fillLabel(e.labelEl);
    }
  }

  private removeEntity(key: string, e: Entity): void {
    this.scene.remove(e.root);
    disposeObject(e.root);
    e.label.element.remove();
    this.entities.delete(key);
  }

  private fillCoreLabel(el: HTMLDivElement, b: IsometricBuildingNode): void {
    el.innerHTML = '';
    el.style.cssText =
      'position:absolute;display:flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,0.94);border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(15,23,42,0.25);font:700 11px system-ui,sans-serif;color:#0f172a;white-space:nowrap;';
    const dot = document.createElement('span');
    dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${TONE_COLOR[b.statusTone] ?? '#94a3b8'};display:inline-block;`;
    const name = document.createElement('span');
    name.textContent = b.isUnlocked ? b.shortName : `🔒 ${b.shortName}`;
    const st = document.createElement('span');
    st.style.cssText = 'font-weight:600;color:#475569;font-size:10px;';
    st.textContent = b.shortStatusLabel;
    el.append(dot, name, st);
    if ((b.badgeCount ?? 0) > 0) {
      const bd = document.createElement('span');
      bd.style.cssText = 'background:#f97316;color:#fff;border-radius:999px;padding:0 5px;font-size:10px;';
      bd.textContent = String(b.badgeCount);
      el.append(bd);
    }
  }

  private fillBlockLabel(el: HTMLDivElement, bl: CityUrbanBlockNode): void {
    el.innerHTML = '';
    el.style.cssText =
      'position:absolute;display:flex;flex-direction:column;align-items:center;gap:2px;font:700 9px system-ui,sans-serif;color:#1e293b;white-space:nowrap;';
    const pill = document.createElement('span');
    pill.style.cssText = 'padding:1px 6px;border-radius:7px;background:rgba(255,255,255,0.93);border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(15,23,42,0.2);';
    pill.textContent = bl.isUnlocked ? bl.shortTagTR : `🔒 ${bl.shortTagTR}`;
    el.append(pill);
    if (bl.isUnlocked && (bl.pendingDeliveryCount ?? 0) > 0) {
      const p = document.createElement('span');
      p.style.cssText = 'padding:0 6px;border-radius:999px;background:#0284c7;color:#fff;font-size:8px;';
      p.textContent = `Sevkiyat (${bl.pendingDeliveryCount})`;
      el.append(p);
    } else if (bl.isUnlocked && bl.stockWarning) {
      const p = document.createElement('span');
      p.style.cssText = 'padding:0 6px;border-radius:999px;background:#f59e0b;color:#0f172a;font-size:8px;';
      p.textContent = 'Stok Kritik';
      el.append(p);
    }
  }

  // ---------- Seçim ----------

  private updateSelection(inp: CitySceneInputs): void {
    this.selectedKey = inp.selectedBlockId ? `block:${inp.selectedBlockId}` : inp.selectedBuildingId ? `core:${inp.selectedBuildingId}` : '';
    let target: Entity | undefined;
    if (inp.selectedBlockId) target = this.entities.get(`block:${inp.selectedBlockId}`);
    else if (inp.selectedBuildingId) target = this.entities.get(`core:${inp.selectedBuildingId}`);
    if (target) {
      this.selRing.visible = true;
      this.selRing.position.set(target.root.position.x, 0.5, target.root.position.z);
      this.selRing.scale.setScalar(target.radius);
    } else {
      this.selRing.visible = false;
    }
  }

  // ---------- Trafik ----------

  private updateTraffic(inp: CitySceneInputs): void {
    const key = [inp.stage, inp.graphicsQuality, inp.hasPlayerCompany, inp.isProducing, Math.min(3, Math.floor(inp.inventoryUnits / 500)), inp.inTransitShipmentsCount].join('|');
    if (key === this.trafficKey) return;
    this.trafficKey = key;
    this.vehicles.forEach((v) => {
      this.vehicleGroup.remove(v.obj);
      disposeObject(v.obj);
    });
    this.vehicles = [];
    const fleet = deriveCityTrafficFleet({
      stage: inp.stage,
      isPaused: false,
      reducedMotion: false,
      isPageVisible: true,
      graphicsQuality: inp.graphicsQuality,
      hasPlayerCompany: inp.hasPlayerCompany,
      isProducing: inp.isProducing,
      inventoryUnits: inp.inventoryUnits,
      inTransitShipmentsCount: inp.inTransitShipmentsCount,
    });
    const colors: Record<string, string> = {
      CITY_CAR: '#3a79c9',
      TAXI: '#f0c63a',
      COMPANY_SHUTTLE: '#2f9e6b',
      DELIVERY_TRUCK: '#e6a23a',
      BUS: '#d94a3a',
      DELIVERY_VAN: '#8a6bd6',
      SERVICE_VEHICLE: '#47b0c9',
    };
    for (const v of fleet.vehicles) {
      const heavy = v.vehicleType === 'DELIVERY_TRUCK' || v.vehicleType === 'BUS' || v.isFactoryTruck;
      const obj = mark(heavy ? makeTruck(colors[v.vehicleType] ?? '#e6a23a') : makeCar(colors[v.vehicleType] ?? '#3a79c9'));
      obj.scale.setScalar(heavy ? 0.8 : 0.85);
      this.vehicleGroup.add(obj);
      this.vehicles.push({ obj, route: v.routeId, duration: Math.max(8, v.durationSec), delay: v.delaySec });
    }
  }

  private moveVehicles(): void {
    for (const v of this.vehicles) {
      const keys = ROUTES[v.route] ?? ROUTES.FINANS_MEYDANI_ROTASI;
      const tt = (((this.elapsed + v.delay) / v.duration) % 1 + 1) % 1;
      let i = 0;
      while (i < keys.length - 2 && tt > keys[i + 1].t) i++;
      const a = keys[i];
      const b = keys[i + 1];
      const f = b.t === a.t ? 0 : (tt - a.t) / (b.t - a.t);
      const x = wx(a.x + (b.x - a.x) * f);
      const z = wz(a.y + (b.y - a.y) * f);
      const dx = wx(b.x) - wx(a.x);
      const dz = wz(b.y) - wz(a.y);
      const len = Math.hypot(dx, dz) || 1;
      const lane = 1.45;
      v.obj.position.set(x + (-dz / len) * lane, 0.42, z + (dx / len) * lane);
      v.obj.rotation.y = Math.atan2(-dz, dx);
    }
  }

  // ---------- Yayalar ----------

  private buildWalkers(): void {
    const shirts = ['#d94a3a', '#3a79c9', '#f0c63a', '#2f9e6b', '#8a6bd6', '#e8e6df', '#e07a3a', '#47b0c9'];
    const rng = createRng('yayalar');
    WALK_PATHS.forEach((path, pi) => {
      const count = pi === 0 ? 7 : pi === 1 ? 6 : 5;
      for (let i = 0; i < count; i++) {
        const obj = mark(makePerson(shirts[Math.floor(rng() * shirts.length)]));
        obj.scale.setScalar(0.95);
        this.walkerGroup.add(obj);
        this.walkers.push({
          obj,
          path: pi,
          offset: rng() * pathLength(path),
          speed: (1.3 + rng() * 0.7) * (rng() < 0.5 ? 1 : -1),
          legL: obj.getObjectByName('legL') ?? undefined,
          legR: obj.getObjectByName('legR') ?? undefined,
        });
      }
    });
  }

  private moveWalkers(dt: number): void {
    for (const w of this.walkers) {
      const path = WALK_PATHS[w.path];
      const total = pathLength(path);
      w.offset = (((w.offset + w.speed * dt) % total) + total) % total;
      let d = w.offset;
      let i = 0;
      while (i < path.length - 1) {
        const segLen = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
        if (d <= segLen || i === path.length - 2) break;
        d -= segLen;
        i++;
      }
      const a = path[i];
      const b = path[i + 1];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const f = Math.min(1, d / segLen);
      const dirx = (b[0] - a[0]) / segLen;
      const dirz = (b[1] - a[1]) / segLen;
      const sign = w.speed < 0 ? -1 : 1;
      const swing = Math.sin(this.elapsed * 6 + w.offset) * 0.6;
      w.obj.position.set(a[0] + (b[0] - a[0]) * f, 0.2 + Math.abs(swing) * 0.06, a[1] + (b[1] - a[1]) * f);
      w.obj.rotation.y = Math.atan2(-dirz * sign, dirx * sign);
      if (w.legL) w.legL.rotation.z = swing;
      if (w.legR) w.legR.rotation.z = -swing;
    }
  }

  // ---------- Kamera ----------

  setZoomPreset(preset: CityZoomPreset): void {
    const toLen = ZOOM_DISTANCE[preset];
    const fromLen = this.camera.position.distanceTo(this.controls.target);
    if (Math.abs(fromLen - toLen) < 1) return;
    this.tween = { kind: 'dist', t: 0, dur: 0.6, from: new THREE.Vector3(), to: new THREE.Vector3(), fromLen, toLen };
  }

  focusMap(mapX: number, mapY: number): void {
    const to = new THREE.Vector3(wx(mapX), 2, wz(mapY));
    to.x = Math.max(-80, Math.min(80, to.x));
    to.z = Math.max(-62, Math.min(62, to.z));
    this.tween = { kind: 'focus', t: 0, dur: 0.7, from: this.controls.target.clone(), to, fromLen: 0, toLen: 0 };
  }

  resetView(preset: CityZoomPreset): void {
    const len = ZOOM_DISTANCE[preset];
    this.controls.target.set(0, 2, 6);
    this.camera.position.copy(this.controls.target).addScaledVector(VIEW_DIR, len);
    this.controls.update();
  }

  // ---------- Girdi ----------

  private onPointerDown = (e: PointerEvent): void => {
    this.down = { x: e.clientX, y: e.clientY, time: performance.now(), active: true };
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.down.active) return;
    this.down.active = false;
    const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
    if (moved > 6 || performance.now() - this.down.time > 600) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (!hit) {
      this.handlers.onPickNothing();
    } else if (hit.kind === 'core') {
      this.handlers.onPickBuilding(hit.id as CityBuildingId);
    } else {
      this.handlers.onPickBlock(hit.id);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const now = performance.now();
    if (now - this.lastHoverCheck < 60 || this.down.active) return;
    this.lastHoverCheck = now;
    const hit = this.pick(e.clientX, e.clientY);
    const key = hit ? `${hit.kind}:${hit.id}` : '';
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    const ent = hit ? this.entities.get(key) : undefined;
    if (ent) {
      this.hoverRing.visible = true;
      this.hoverRing.position.set(ent.root.position.x, 0.45, ent.root.position.z);
      this.hoverRing.scale.setScalar(ent.radius);
    } else {
      this.hoverRing.visible = false;
    }
  };

  private onPointerLeave = (): void => {
    this.hoverRing.visible = false;
    this.hoverKey = '';
  };

  private pick(clientX: number, clientY: number): { kind: 'core' | 'block'; id: string } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const roots = Array.from(this.entities.values()).map((e) => e.root);
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o && o.userData.pick) return o.userData.pick as { kind: 'core' | 'block'; id: string };
    }
    return null;
  }

  // ---------- Döngü ----------

  private resize(): void {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.paused) this.elapsed += dt;
    const time = performance.now() / 1000;

    if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const f = Math.min(1, tw.t / tw.dur);
      const e = f * f * (3 - 2 * f);
      if (tw.kind === 'focus') {
        const off = this.camera.position.clone().sub(this.controls.target);
        this.controls.target.lerpVectors(tw.from, tw.to, e);
        this.camera.position.copy(this.controls.target).add(off);
      } else {
        const dir = this.camera.position.clone().sub(this.controls.target).normalize();
        const len = tw.fromLen + (tw.toLen - tw.fromLen) * e;
        this.camera.position.copy(this.controls.target).addScaledVector(dir, len);
      }
      if (f >= 1) this.tween = null;
    }
    this.controls.target.x = Math.max(-85, Math.min(85, this.controls.target.x));
    this.controls.target.z = Math.max(-66, Math.min(66, this.controls.target.z));
    this.controls.update();

    this.moveVehicles();
    this.moveWalkers(this.paused ? 0 : dt);
    const near = this.camera.position.distanceTo(this.controls.target) < LABEL_NEAR;
    const vw = this.container.clientWidth;
    const vh = this.container.clientHeight;
    for (const [key, e] of this.entities) {
      if (e.kind === 'block') {
        const show = near || SHOP_SLOT_IDS.has(e.id) || key === this.selectedKey || key === this.hoverKey;
        if (show !== e.labelShown) {
          e.labelShown = show;
          e.label.visible = show;
        }
      }
      // Etiket, ekrandaki düğmelerin (sağ alt hız düğmeleri, üst bar) altına düşerse gizlenir.
      this.labelPos.setFromMatrixPosition(e.label.matrixWorld).project(this.camera);
      const sx = (this.labelPos.x * 0.5 + 0.5) * vw;
      const sy = (-this.labelPos.y * 0.5 + 0.5) * vh;
      const covered = (sy > vh - 78 && sx > vw - 300) || (sy < 62 && sx > vw - 330) || (sy < 52 && sx < 330) || (sy > vh - 56 && sx < 190);
      if (covered !== e.labelCovered) {
        e.labelCovered = covered;
        e.label.element.style.visibility = covered ? 'hidden' : 'visible';
      }
      if (e.orb) e.orb.position.y = e.top + 3.2 + Math.sin(time * 2 + e.root.position.x) * 0.35;
      const smoke = e.model?.getObjectByName('smoke');
      if (smoke) {
        const s = (time * 0.6) % 1;
        smoke.position.y = e.top - 4 + s * 5;
        smoke.scale.setScalar(0.6 + s * 0.8);
        ((smoke as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.7 * (1 - s);
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    const c = this.renderer.domElement;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerleave', this.onPointerLeave);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m?.dispose());
      }
    });
    disposeKit();
    this.renderer.dispose();
    c.remove();
    this.labelRenderer.domElement.remove();
  }
}
