/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ŞEHİR 3D DENEME — oyuna bağlı DEĞİL.
 * Mahallenin bir köşesini gerçek 3D olarak gösteren bağımsız bir deneme sahnesidir.
 * Binalar burada kodla üretilen basit modellerdir (proje kuralının bilinçli istisnası, yalnızca deneme için).
 * Açmak için: `npm run dev` ve tarayıcıda `/3d-deneme.html`.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ---------- Yardımcılar ----------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(2026);

const stdMat = (color: string | number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, flatShading: true, ...extra });

const texCache = new Map<string, THREE.CanvasTexture>();

/** Pencereli cephe dokusu (2x2 pencere). Aynı ayar tekrar istenirse önbellekten gelir. */
function facadeTexture(wall: string, glass: string, frame: string, brick = false): THREE.CanvasTexture {
  const key = `${wall}|${glass}|${frame}|${brick}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = wall;
  g.fillRect(0, 0, 256, 256);
  if (brick) {
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (let y = 0; y < 256; y += 8) g.fillRect(0, y, 256, 1.5);
    for (let y = 0; y < 256; y += 16) for (let x = (y / 16) % 2 ? 0 : 8; x < 256; x += 16) g.fillRect(x, y, 1.5, 8);
  } else {
    g.fillStyle = 'rgba(0,0,0,0.045)';
    for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 256, 1);
  }
  const cols = 2;
  const rows = 2;
  const cw = 256 / cols;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const wx = k * cw + cw * 0.2;
      const wy = r * rh + rh * 0.16;
      const ww = cw * 0.6;
      const wh = rh * 0.6;
      g.fillStyle = frame;
      g.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      const grd = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
      grd.addColorStop(0, glass);
      grd.addColorStop(1, '#2b3a4a');
      g.fillStyle = grd;
      g.fillRect(wx, wy, ww, wh);
      g.fillStyle = frame;
      g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      g.fillRect(wx, wy + wh * 0.45, ww, 4);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(wx + 4, wy + 4, ww * 0.28, wh * 0.18);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(wx - 6, wy + wh + 6, ww + 12, 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  texCache.set(key, tex);
  return tex;
}

function signTexture(text: string, bg: string, fg: string, w = 256, h = 96): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = fg;
  g.font = `800 ${Math.floor(h * 0.56)}px system-ui, Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function stripeTexture(a: string, b: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? a : b;
    g.fillRect(i * 16, 0, 16, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mark<T extends THREE.Object3D>(o: T, cast = true, receive = true): T {
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
  return o;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// ---------- Bina üreticileri ----------

interface BodySpec {
  w: number;
  h: number;
  d: number;
  wall: string;
  glass?: string;
  frame?: string;
  roof?: string;
  brick?: boolean;
  parapet?: boolean;
  units?: number;
}

/** Pencereli gövde + (isteğe bağlı) çatı korkuluğu ve çatı üstü cihazlar. Kökü zemin ortasındadır. */
function makeBody(s: BodySpec): THREE.Group {
  const g = new THREE.Group();
  const base = facadeTexture(s.wall, s.glass ?? '#7fa6c4', s.frame ?? '#f1ead7', s.brick ?? false);
  const tx = base.clone();
  tx.needsUpdate = true;
  tx.repeat.set(Math.max(1, Math.round(s.d / 6.4)), Math.max(1, Math.round(s.h / 6.4)));
  const tz = base.clone();
  tz.needsUpdate = true;
  tz.repeat.set(Math.max(1, Math.round(s.w / 6.4)), Math.max(1, Math.round(s.h / 6.4)));
  const side = (t: THREE.Texture) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, flatShading: true });
  const roofMat = stdMat(s.roof ?? '#6b6a63');
  const mats = [side(tx), side(tx), roofMat, roofMat, side(tz), side(tz)];
  const body = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), mats);
  body.position.y = s.h / 2;
  g.add(body);
  if (s.parapet !== false) {
    const pm = stdMat(s.frame ?? '#d9d2bf');
    const t = 0.7;
    const ph = 0.9;
    g.add(box(s.w + 0.2, ph, t, pm, 0, s.h + ph / 2, s.d / 2 - t / 2));
    g.add(box(s.w + 0.2, ph, t, pm, 0, s.h + ph / 2, -s.d / 2 + t / 2));
    g.add(box(t, ph, s.d, pm, s.w / 2 - t / 2, s.h + ph / 2, 0));
    g.add(box(t, ph, s.d, pm, -s.w / 2 + t / 2, s.h + ph / 2, 0));
  }
  const n = s.units ?? 3;
  const um = stdMat('#8d9296');
  for (let i = 0; i < n; i++) {
    const uw = 1.6 + rnd() * 1.6;
    const ud = 1.4 + rnd() * 1.4;
    const ux = (rnd() - 0.5) * (s.w - uw - 3);
    const uz = (rnd() - 0.5) * (s.d - ud - 3);
    g.add(box(uw, 1.1, ud, um, ux, s.h + 0.55, uz));
    g.add(box(uw * 0.55, 0.3, ud * 0.55, stdMat('#4e5459'), ux, s.h + 1.2, uz));
  }
  return g;
}

/** Üçgen kesitli beşik çatı (sırt Z ekseni boyunca). */
function gabledRoof(w: number, d: number, rise: number, color: string): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return new THREE.Mesh(geo, stdMat(color));
}

function makeWarehouse(w: number, d: number, h: number, wall: string, roof: string, ridgeAlongX: boolean): THREE.Group {
  const g = new THREE.Group();
  const wallMat = stdMat(wall);
  g.add(box(w, h, d, wallMat, 0, h / 2, 0));
  const r = ridgeAlongX ? gabledRoof(d + 1.4, w + 1.4, h * 0.42, roof) : gabledRoof(w + 1.4, d + 1.4, h * 0.42, roof);
  if (ridgeAlongX) r.rotation.y = Math.PI / 2;
  r.position.y = h;
  g.add(r);
  // büyük kapı ve küçük pencereler
  const door = box(w * 0.28, h * 0.62, 0.3, stdMat('#6b3a2e'), 0, h * 0.31, d / 2 + 0.05);
  g.add(door);
  for (let i = -1; i <= 1; i += 2) g.add(box(2.4, 1.4, 0.3, stdMat('#3b4a57'), i * w * 0.34, h * 0.62, d / 2 + 0.05));
  // baca
  g.add(box(1.6, 3, 1.6, stdMat('#9c6a52'), w * 0.2, h + h * 0.25, -d * 0.15));
  return g;
}

function makeColumns(count: number, width: number, h: number, z: number, y0 = 0, color = '#f3efe4'): THREE.Group {
  const g = new THREE.Group();
  const mat = stdMat(color);
  for (let i = 0; i < count; i++) {
    const x = -width / 2 + (width * i) / (count - 1);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, h, 8), mat);
    c.position.set(x, y0 + h / 2, z);
    g.add(c);
  }
  return g;
}

function makeClassical(w: number, d: number, h: number, wall: string, trim: string, signText: string, signBg: string): THREE.Group {
  const g = new THREE.Group();
  g.add(makeBody({ w, h, d, wall, frame: trim, glass: '#6d93b3', brick: wall.startsWith('#8') || wall === '#9b3d33', parapet: false, units: 0 }));
  const trimMat = stdMat(trim);
  // çatı saçağı ve çatı
  g.add(box(w + 1.6, 0.9, d + 1.6, trimMat, 0, h + 0.45, 0));
  const hip = gabledRoof(d + 1.2, w + 1.2, 3.2, '#efece2');
  hip.rotation.y = Math.PI / 2;
  hip.position.y = h + 0.9;
  g.add(hip);
  // sütunlu giriş
  const pw = w * 0.62;
  g.add(box(pw, 0.6, 3.6, trimMat, 0, 0.3, d / 2 + 1.8));
  g.add(makeColumns(6, pw - 1.4, h * 0.72, d / 2 + 3, 0.6, trim));
  g.add(box(pw + 0.8, 1.1, 4.2, trimMat, 0, 0.6 + h * 0.72 + 0.55, d / 2 + 1.7));
  const pedGroup = new THREE.Group();
  const pedMesh = gabledRoof(pw + 1.4, 0.8, 2.6, trim);
  pedMesh.position.y = 0;
  pedGroup.add(pedMesh);
  pedGroup.position.set(0, 0.6 + h * 0.72 + 1.1, d / 2 + 3.6);
  g.add(pedGroup);
  // kapı
  g.add(box(2.6, h * 0.42, 0.3, stdMat('#4a2f26'), 0, h * 0.21 + 0.6, d / 2 + 0.1));
  // tabela
  // tabela: üçgen alınlığın önünde, sütunların üstünde
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 1.7),
    new THREE.MeshBasicMaterial({ map: signTexture(signText, signBg, '#ffffff', 320, 84) })
  );
  sign.position.set(0, 0.6 + h * 0.72 + 1.1 + 1.0, d / 2 + 3.65);
  g.add(sign);
  return g;
}

function makeHotel(): THREE.Group {
  const g = new THREE.Group();
  const w = 13;
  const d = 15;
  const h = 24;
  g.add(makeBody({ w, h, d, wall: '#cdb88c', frame: '#efe3c3', glass: '#7497b6', parapet: true, units: 2 }));
  // yan sütun şeritleri
  const strip = stdMat('#8a6a45');
  for (const x of [-3.2, 3.2]) g.add(box(1.4, h * 0.98, 0.9, strip, x, h * 0.49, d / 2 + 0.45));
  g.add(box(1.8, h * 0.98, 1.2, strip, -w / 2 + 0.3, h * 0.49, d / 2 + 0.2));
  g.add(box(1.8, h * 0.98, 1.2, strip, w / 2 - 0.3, h * 0.49, d / 2 + 0.2));
  // giriş saçağı
  const aw = box(6.4, 0.5, 3, stdMat('#c8924d'), 0, 4.2, d / 2 + 1.5);
  aw.rotation.x = 0.12;
  g.add(aw);
  g.add(box(2.4, 3.4, 0.3, stdMat('#4a352a'), 0, 1.8, d / 2 + 0.1));
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 2.4),
    new THREE.MeshBasicMaterial({ map: signTexture('OTEL', '#8a5a2e', '#fff4d6', 320, 90) })
  );
  sign.position.set(0, h - 4, d / 2 + 0.9);
  g.add(sign);
  return g;
}

function makeCafe(): THREE.Group {
  const g = new THREE.Group();
  const w = 14;
  const d = 10;
  const h = 7.5;
  g.add(makeBody({ w, h, d, wall: '#d9c79c', frame: '#f5ecd2', glass: '#6f93ae', parapet: true, units: 2, roof: '#8a7d62' }));
  // yeşil çizgili tente
  const stripe = new THREE.MeshStandardMaterial({ map: stripeTexture('#2f6b3a', '#f2f0e4'), roughness: 0.9 });
  for (const x of [-3.6, 3.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.35, 2.6), stripe);
    t.position.set(x, 3.8, d / 2 + 1.2);
    t.rotation.x = 0.35;
    g.add(t);
    g.add(box(4.6, 2.6, 0.3, stdMat('#3a4a57'), x, 1.9, d / 2 + 0.05));
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 1.6),
    new THREE.MeshBasicMaterial({ map: signTexture('KAFE', '#2f6b3a', '#fff7e0', 256, 72) })
  );
  sign.position.set(0, h - 1.2, d / 2 + 0.2);
  g.add(sign);
  // teras masaları
  const tm = stdMat('#6b4a2f');
  for (let i = 0; i < 3; i++) {
    g.add(box(1.6, 0.14, 1.6, tm, -4.5 + i * 4.5, 1.05, d / 2 + 4.2));
    g.add(box(0.2, 1, 0.2, tm, -4.5 + i * 4.5, 0.5, d / 2 + 4.2));
  }
  return g;
}

function makeHospital(): THREE.Group {
  const g = new THREE.Group();
  const main = makeBody({ w: 28, h: 12, d: 17, wall: '#f1f1ec', frame: '#ffffff', glass: '#7ea2c0', parapet: true, units: 4, roof: '#dcdcd6' });
  g.add(main);
  const wing = makeBody({ w: 11, h: 8, d: 17, wall: '#f1f1ec', frame: '#ffffff', glass: '#7ea2c0', parapet: true, units: 2, roof: '#dcdcd6' });
  wing.position.set(-19.5, 0, 0);
  g.add(wing);
  // yeşil bahçe şeridi
  g.add(box(28, 0.8, 1.6, stdMat('#6aa84f'), 0, 0.4, 9.4));
  // giriş saçağı + sütunlar
  g.add(box(10, 0.7, 5, stdMat('#ffffff'), 3, 5.2, 11));
  g.add(makeColumns(4, 8, 4.6, 12.5, 0.4, '#ffffff'));
  g.add(box(4.6, 3.6, 0.3, stdMat('#4a6d86'), 3, 1.9, 8.6));
  // kırmızı haç
  const cross = new THREE.Group();
  const red = new THREE.MeshBasicMaterial({ color: '#d63a2f' });
  cross.add(new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 0.3), red));
  cross.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.6, 0.3), red));
  cross.position.set(3, 9.4, 8.7);
  g.add(cross);
  return g;
}

function makeMarket(): THREE.Group {
  const g = new THREE.Group();
  const w = 28;
  const d = 17;
  const h = 7;
  g.add(makeBody({ w, h, d, wall: '#cfc8b8', frame: '#e6e0d0', glass: '#6f93ae', parapet: true, units: 5, roof: '#7a7770' }));
  // vitrin şeridi
  g.add(box(w * 0.82, 3.2, 0.3, stdMat('#38546b'), 0, 2.1, d / 2 + 0.08));
  // kırmızı tente
  const stripe = new THREE.MeshStandardMaterial({ map: stripeTexture('#c53a32', '#f4f1e6'), roughness: 0.9 });
  const aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.4, 3), stripe);
  aw.position.set(0, 4.1, d / 2 + 1.4);
  aw.rotation.x = 0.28;
  g.add(aw);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 2.4),
    new THREE.MeshBasicMaterial({ map: signTexture('MARKET', '#c53a32', '#ffffff', 320, 72) })
  );
  sign.position.set(0, h - 1.4, d / 2 + 0.2);
  g.add(sign);
  return g;
}

function makeTree(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.4 * scale, 2.2 * scale, 6), stdMat('#7a5636'));
  trunk.position.y = 1.1 * scale;
  g.add(trunk);
  const greens = ['#4f9a3c', '#5aa844', '#3f8a35', '#66b04a'];
  const col = greens[Math.floor(rnd() * greens.length)];
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9 * scale, 0), stdMat(col));
  crown.position.y = 3.6 * scale;
  crown.scale.set(1, 1.08, 1);
  crown.rotation.y = rnd() * 3;
  g.add(crown);
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 * scale, 0), stdMat(col));
  top.position.set(0.2 * scale, 4.9 * scale, 0.1 * scale);
  g.add(top);
  return g;
}

function makeCar(color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(box(4.2, 0.95, 2, stdMat(color, { roughness: 0.5, metalness: 0.2 }), 0, 0.85, 0));
  g.add(box(2.3, 0.85, 1.8, stdMat('#26323f', { roughness: 0.3 }), -0.2, 1.7, 0));
  g.add(box(2.1, 0.55, 1.84, stdMat(color, { roughness: 0.5 }), -0.2, 2.08, 0));
  const wm = stdMat('#1d1f22');
  for (const x of [-1.4, 1.4]) {
    for (const z of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.4, 10), wm);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.46, z);
      g.add(w);
    }
  }
  return g;
}

function makeLamp(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6, 6), stdMat('#4b5258')));
  g.children[0].position.y = 3;
  g.add(box(1.6, 0.18, 0.3, stdMat('#4b5258'), 0.7, 6, 0));
  g.add(box(0.7, 0.2, 0.5, stdMat('#f6e7a8', { emissive: '#f6e7a8', emissiveIntensity: 0.25 }), 1.4, 5.9, 0));
  return g;
}

// ---------- Sahne ----------

const container = document.getElementById('sahne')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfe3f3');
scene.fog = new THREE.Fog('#cfe3f3', 260, 520);

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 1, 1200);
camera.position.set(120, 115, 150);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 4, 5);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.46;
controls.minDistance = 40;
controls.maxDistance = 420;
// Adres çubuğundan kamera: ?kamera=x,y,z,hedefX,hedefY,hedefZ
const camParam = new URLSearchParams(window.location.search).get('kamera');
if (camParam) {
  const v = camParam.split(',').map(Number);
  if (v.length === 6 && v.every((n) => Number.isFinite(n))) {
    camera.position.set(v[0], v[1], v[2]);
    controls.target.set(v[3], v[4], v[5]);
  }
}
controls.update();

scene.add(new THREE.HemisphereLight('#d6e8ff', '#8c8470', 1.25));
const sun = new THREE.DirectionalLight('#fff0d6', 2.7);
sun.position.set(-90, 130, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera as THREE.OrthographicCamera;
sc.left = -125;
sc.right = 125;
sc.top = 125;
sc.bottom = -125;
sc.near = 10;
sc.far = 400;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun);

// zemin: çimen + asfalt
const grass = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), stdMat('#86bd55'));
grass.rotation.x = -Math.PI / 2;
grass.position.y = -0.05;
grass.receiveShadow = true;
scene.add(grass);

const asphaltMat = stdMat('#4c5056', { flatShading: false, roughness: 0.95 });
const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(166, 166), asphaltMat);
asphalt.rotation.x = -Math.PI / 2;
asphalt.position.y = 0.02;
asphalt.receiveShadow = true;
scene.add(asphalt);

// yol çizgileri
const white = new THREE.MeshBasicMaterial({ color: '#f4f4ee' });
const yellow = new THREE.MeshBasicMaterial({ color: '#e8c648' });
const ROADS = [-75, -25, 25, 75];
for (const r of ROADS) {
  for (let t = -80; t < 80; t += 6) {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.35), yellow);
    a.rotation.x = -Math.PI / 2;
    a.position.set(t + 1.5, 0.05, r);
    scene.add(a);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3), yellow);
    b.rotation.x = -Math.PI / 2;
    b.position.set(r, 0.05, t + 1.5);
    scene.add(b);
  }
}
// yaya geçitleri
for (const rx of ROADS) {
  for (const rz of ROADS) {
    for (const s of [-1, 1]) {
      for (let k = -3; k <= 3; k++) {
        const a = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.6), white);
        a.rotation.x = -Math.PI / 2;
        a.position.set(rx + s * 8.2, 0.06, rz + k * 1.3);
        if (Math.abs(rx) < 80 && Math.abs(rz) < 80) scene.add(a);
        const b = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), white);
        b.rotation.x = -Math.PI / 2;
        b.position.set(rx + k * 1.3, 0.06, rz + s * 8.2);
        if (Math.abs(rx) < 80 && Math.abs(rz) < 80) scene.add(b);
      }
    }
  }
}

// blok yerleşimi
const BLOCKS: { cx: number; cz: number; lot: string; build: (g: THREE.Group) => void }[] = [];
const place = (g: THREE.Group, o: THREE.Object3D, x: number, z: number, rotY = 0) => {
  o.position.set(x, 0.5, z);
  o.rotation.y = rotY;
  g.add(o);
};

BLOCKS.push({
  cx: -50, cz: -50, lot: '#b9b2a3',
  build: (g) => {
    place(g, makeWarehouse(20, 17, 8, '#a8392e', '#4b6b3a', false), -5, -6);
    place(g, makeWarehouse(14, 13, 10, '#9c3a30', '#456336', true), 10, 9);
    place(g, makeBody({ w: 8, h: 4.5, d: 8, wall: '#cfc6b0', frame: '#eee6d0', units: 1, roof: '#6a6860' }), -11, 10);
  },
});
BLOCKS.push({
  cx: 0, cz: -50, lot: '#c3bcae',
  build: (g) => {
    place(g, makeHotel(), -8, -3);
    place(g, makeClassical(15, 15, 11, '#9b3d33', '#f2eee3', 'BELEDİYE', '#7a2a24'), 9, -2);
  },
});
BLOCKS.push({
  cx: 50, cz: -50, lot: '#c3bcae',
  build: (g) => {
    place(g, makeCafe(), -3, 8);
    place(g, makeBody({ w: 13, h: 21, d: 13, wall: '#c8924d', frame: '#f0dfb8', brick: true, units: 3, roof: '#6b6258' }), 6, -9);
  },
});
BLOCKS.push({
  cx: -50, cz: 0, lot: '#c3bcae',
  build: (g) => {
    place(g, makeBody({ w: 24, h: 14, d: 20, wall: '#d7c9a6', frame: '#f4ecd6', units: 4, roof: '#756f63' }), 0, -3);
    const stripe = new THREE.MeshStandardMaterial({ map: stripeTexture('#c53a32', '#f4f1e6'), roughness: 0.9 });
    const aw = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35, 2.6), stripe);
    aw.position.set(-5, 3.9, 8.2);
    aw.rotation.x = 0.32;
    g.add(aw);
    const aw2 = aw.clone();
    aw2.position.x = 6;
    g.add(aw2);
  },
});
BLOCKS.push({
  cx: 0, cz: 0, lot: '#8fc65a',
  build: (g) => {
    // Finans Meydanı: yollar, gölet, anıt
    const pave = stdMat('#e2dccd');
    g.add(box(34, 0.12, 4.4, pave, 0, 0.56, 0));
    g.add(box(4.4, 0.12, 34, pave, 0, 0.56, 0));
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.3, 28), stdMat('#5db8e8', { flatShading: false, roughness: 0.15, metalness: 0.1 }));
    pond.position.set(0, 0.62, 0);
    g.add(pond);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.55, 6, 28), stdMat('#d8d1bf'));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 0.7, 0);
    g.add(rim);
    const mon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 4.6, 8), stdMat('#e8e2d2'));
    mon.position.set(0, 2.9, 0);
    g.add(mon);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), stdMat('#e0b84a', { metalness: 0.5, roughness: 0.35 }));
    orb.position.set(0, 5.9, 0);
    g.add(orb);
    for (const [x, z] of [[-11, -11], [11, -11], [-11, 11], [11, 11], [-14, 0], [14, 0], [0, -14], [0, 14]]) {
      place(g, makeTree(1.05), x, z);
    }
    const bench = stdMat('#8a5a35');
    for (const [x, z, r] of [[-5, 9, 0], [5, 9, 0], [-5, -9, Math.PI], [5, -9, Math.PI]] as [number, number, number][]) {
      const b = new THREE.Group();
      b.add(box(3, 0.25, 0.9, bench, 0, 0.7, 0));
      b.add(box(3, 0.7, 0.2, bench, 0, 1.2, -0.4));
      place(g, b, x, z, r);
    }
  },
});
BLOCKS.push({
  cx: 50, cz: 0, lot: '#bdb7a8',
  build: (g) => {
    place(g, makeBody({ w: 20, h: 10, d: 14, wall: '#a9a498', frame: '#d9d4c4', glass: '#6d8397', units: 5, roof: '#6e6c66' }), -5, -7);
    place(g, makeBody({ w: 18, h: 8, d: 12, wall: '#b3ae9f', frame: '#dedacb', glass: '#6d8397', units: 4, roof: '#6e6c66' }), 6, 9);
    place(g, makeBody({ w: 9, h: 6, d: 8, wall: '#9e9a8e', frame: '#d0ccbd', glass: '#6d8397', units: 2, roof: '#6e6c66' }), 10, -9);
  },
});
BLOCKS.push({
  cx: -50, cz: 50, lot: '#c3bcae',
  build: (g) => {
    place(g, makeHospital(), 4, -2);
  },
});
BLOCKS.push({
  cx: 0, cz: 50, lot: '#b3b1aa',
  build: (g) => {
    place(g, makeMarket(), 0, -5);
    // otopark çizgileri
    const line = new THREE.MeshBasicMaterial({ color: '#f1f1ea' });
    for (let i = -5; i <= 5; i++) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 4), line);
      l.rotation.x = -Math.PI / 2;
      l.position.set(i * 2.8, 0.52, 10.6);
      g.add(l);
    }
  },
});
BLOCKS.push({
  cx: 50, cz: 50, lot: '#c9c3b5',
  build: (g) => {
    place(g, makeClassical(20, 16, 12, '#e9e2cf', '#ffffff', 'BANKA', '#1f4f8f'), 0, -4);
  },
});

for (const b of BLOCKS) {
  const grp = new THREE.Group();
  grp.position.set(b.cx, 0, b.cz);
  // kaldırım plakası + iç parsel
  const slab = box(40, 0.4, 40, stdMat('#d6d0c2'), 0, 0.2, 0);
  grp.add(slab);
  const lot = box(34, 0.1, 34, stdMat(b.lot), 0, 0.45, 0);
  grp.add(lot);
  b.build(grp);
  mark(grp);
  scene.add(grp);
}

// kaldırım ağaçları ve lambalar
const treeSpots: [number, number][] = [];
for (const b of BLOCKS) {
  for (const [dx, dz] of [[-18.5, -18.5], [18.5, -18.5], [-18.5, 18.5], [18.5, 18.5], [0, 18.8], [0, -18.8]]) {
    treeSpots.push([b.cx + dx, b.cz + dz]);
  }
}
for (const [x, z] of treeSpots) {
  const t = makeTree(0.85 + rnd() * 0.3);
  t.position.set(x, 0.4, z);
  mark(t);
  scene.add(t);
}
for (const b of BLOCKS) {
  for (const [dx, dz, ry] of [[-19.4, -8, 0], [19.4, 8, Math.PI], [8, 19.4, -Math.PI / 2]] as [number, number, number][]) {
    const l = makeLamp();
    l.position.set(b.cx + dx, 0.4, b.cz + dz);
    l.rotation.y = ry;
    mark(l);
    scene.add(l);
  }
}
// dış ağaç kuşağı
for (let i = 0; i < 140; i++) {
  const a = rnd() * Math.PI * 2;
  const r = 95 + rnd() * 70;
  const t = makeTree(1.2 + rnd() * 0.9);
  t.position.set(Math.cos(a) * r * 1.12, 0, Math.sin(a) * r * 1.12);
  mark(t);
  scene.add(t);
}

// arabalar
interface Lane { axis: 'x' | 'z'; fixed: number; dir: 1 | -1; pos: number; speed: number; car: THREE.Group; }
const lanes: Lane[] = [];
const colors = ['#d94a3a', '#3a79c9', '#f0c63a', '#e0709a', '#47b0c9', '#9a6bd6', '#7aa84a', '#f08a30', '#d8d8d2'];
let ci = 0;
for (const r of [-25, 25, -75, 75]) {
  for (const dir of [1, -1] as const) {
    for (let k = 0; k < 2; k++) {
      const car = mark(makeCar(colors[ci++ % colors.length]));
      scene.add(car);
      lanes.push({ axis: 'x', fixed: r + (dir === 1 ? 2.6 : -2.6), dir, pos: -80 + rnd() * 160, speed: 7 + rnd() * 5, car });
      const car2 = mark(makeCar(colors[ci++ % colors.length]));
      scene.add(car2);
      lanes.push({ axis: 'z', fixed: r + (dir === 1 ? -2.6 : 2.6), dir, pos: -80 + rnd() * 160, speed: 7 + rnd() * 5, car: car2 });
    }
  }
}

function placeCars(dt: number) {
  for (const l of lanes) {
    l.pos += l.dir * l.speed * dt;
    if (l.pos > 82) l.pos = -82;
    if (l.pos < -82) l.pos = 82;
    if (l.axis === 'x') {
      l.car.position.set(l.pos, 0.05, l.fixed);
      l.car.rotation.y = l.dir === 1 ? 0 : Math.PI;
    } else {
      l.car.position.set(l.fixed, 0.05, l.pos);
      l.car.rotation.y = l.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
    }
  }
}
placeCars(0);

// park etmiş arabalar (marketin önü)
for (let i = 0; i < 4; i++) {
  const car = mark(makeCar(colors[(i * 2 + 1) % colors.length]));
  car.position.set(-4.2 + i * 5.6, 0.55, 50 + 10.6);
  car.rotation.y = Math.PI / 2;
  scene.add(car);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  placeCars(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
