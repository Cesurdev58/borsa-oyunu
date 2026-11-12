/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 3D şehir için ortak yapı taşları: dokular, malzemeler, bina gövdesi, çatı, sütun, ağaç, araç, lamba.
 * Bütün modeller kodla üretilen basit alçak-poligon modellerdir. Orijin her zaman zemin ortasıdır, ön yüz +z yönündedir.
 */

import * as THREE from 'three';

export type Rng = () => number;

/** Yazıdan sabit tohum üretir; aynı bina her seferinde aynı çıkar. */
export function createRng(seedText: string): Rng {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let seed = h >>> 0;
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Malzeme ve doku kayıtları ----------

const textureCache = new Map<string, THREE.CanvasTexture>();
const glowMaterials = new Set<THREE.MeshStandardMaterial>();
const lampMaterials = new Set<THREE.MeshStandardMaterial>();

/** Gece pencere ışığını ayarlar (0 = kapalı, 1 = tam). */
export function setWindowGlow(v: number): void {
  glowMaterials.forEach((m) => {
    m.emissiveIntensity = v;
  });
}

/** Sokak lambası ışığını ayarlar. */
export function setLampGlow(v: number): void {
  lampMaterials.forEach((m) => {
    m.emissiveIntensity = v;
  });
}

/** Sahne kapanırken önbellekleri temizler. */
export function disposeKit(): void {
  textureCache.forEach((t) => t.dispose());
  textureCache.clear();
  glowMaterials.clear();
  lampMaterials.clear();
}

/** Bir nesne ağacındaki geometri ve malzemeleri serbest bırakır. */
export function disposeObject(o: THREE.Object3D): void {
  o.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      glowMaterials.delete(sm);
      lampMaterials.delete(sm);
      sm.dispose();
    }
  });
}

export const stdMat = (
  color: string | number,
  extra: Partial<THREE.MeshStandardMaterialParameters> = {}
) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.02,
    flatShading: true,
    ...extra,
  });

// ---------- Dokular ----------

function facadeTextures(wall: string, glass: string, frame: string, brick: boolean) {
  const key = `${wall}|${glass}|${frame}|${brick}`;
  const hit = textureCache.get(key);
  const hitGlow = textureCache.get(`${key}|glow`);
  if (hit && hitGlow) return { map: hit, glow: hitGlow };

  const make = (glowOnly: boolean) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = glowOnly ? '#000000' : wall;
    g.fillRect(0, 0, 256, 256);
    if (!glowOnly) {
      if (brick) {
        g.fillStyle = 'rgba(0,0,0,0.10)';
        for (let y = 0; y < 256; y += 8) g.fillRect(0, y, 256, 1.5);
        for (let y = 0; y < 256; y += 16)
          for (let x = (y / 16) % 2 ? 0 : 8; x < 256; x += 16) g.fillRect(x, y, 1.5, 8);
      } else {
        g.fillStyle = 'rgba(0,0,0,0.045)';
        for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 256, 1);
      }
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
        if (glowOnly) {
          g.fillStyle = '#ffffff';
          g.fillRect(wx, wy, ww, wh);
          continue;
        }
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
    tex.colorSpace = glowOnly ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  };
  const map = make(false);
  const glow = make(true);
  textureCache.set(key, map);
  textureCache.set(`${key}|glow`, glow);
  return { map, glow };
}

export function signTexture(text: string, bg: string, fg: string, w = 256, h = 96): THREE.CanvasTexture {
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
  let size = Math.floor(h * 0.56);
  g.font = `800 ${size}px system-ui, Arial, sans-serif`;
  while (g.measureText(text).width > w - 28 && size > 12) {
    size -= 2;
    g.font = `800 ${size}px system-ui, Arial, sans-serif`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function stripeTexture(a: string, b: string): THREE.CanvasTexture {
  const key = `stripe|${a}|${b}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
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
  textureCache.set(key, tex);
  return tex;
}

// ---------- Temel şekiller ----------

export function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function cyl(
  rTop: number,
  rBot: number,
  h: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  seg = 8
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}

export function sign(text: string, bg: string, fg: string, w: number, h: number, px = 320): THREE.Mesh {
  const pxH = Math.round((px * h) / w);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: signTexture(text, bg, fg, px, pxH) })
  );
  return m;
}

export function mark<T extends THREE.Object3D>(o: T, cast = true, receive = true): T {
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
  return o;
}

// ---------- Bina parçaları ----------

export interface BodySpec {
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

/** Pencereli gövde + çatı korkuluğu + çatı üstü cihazlar. */
export function makeBody(s: BodySpec, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const { map, glow } = facadeTextures(s.wall, s.glass ?? '#7fa6c4', s.frame ?? '#f1ead7', s.brick ?? false);
  const make = (rx: number, ry: number) => {
    const t = map.clone();
    t.needsUpdate = true;
    t.repeat.set(rx, ry);
    const gl = glow.clone();
    gl.needsUpdate = true;
    gl.repeat.set(rx, ry);
    const m = new THREE.MeshStandardMaterial({
      map: t,
      emissiveMap: gl,
      emissive: new THREE.Color('#ffd58a'),
      emissiveIntensity: 0,
      roughness: 0.9,
      flatShading: true,
    });
    glowMaterials.add(m);
    return m;
  };
  const ry = Math.max(1, Math.round(s.h / 6.4));
  const mx = make(Math.max(1, Math.round(s.d / 6.4)), ry);
  const mz = make(Math.max(1, Math.round(s.w / 6.4)), ry);
  const roofMat = stdMat(s.roof ?? '#6b6a63');
  const body = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), [mx, mx, roofMat, roofMat, mz, mz]);
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
  const n = s.units ?? 2;
  const um = stdMat('#8d9296');
  const um2 = stdMat('#4e5459');
  for (let i = 0; i < n; i++) {
    const uw = 1.4 + rng() * 1.4;
    const ud = 1.2 + rng() * 1.2;
    const ux = (rng() - 0.5) * Math.max(0.1, s.w - uw - 3);
    const uz = (rng() - 0.5) * Math.max(0.1, s.d - ud - 3);
    g.add(box(uw, 1.1, ud, um, ux, s.h + 0.55, uz));
    g.add(box(uw * 0.55, 0.3, ud * 0.55, um2, ux, s.h + 1.2, uz));
  }
  return g;
}

/** Üçgen kesitli beşik çatı; sırt Z ekseni boyunca uzanır. */
export function gabledRoof(w: number, d: number, rise: number, color: string): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return new THREE.Mesh(geo, stdMat(color));
}

export function makeColumns(count: number, width: number, h: number, z: number, y0 = 0, color = '#f3efe4'): THREE.Group {
  const g = new THREE.Group();
  const mat = stdMat(color);
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? 0 : -width / 2 + (width * i) / (count - 1);
    g.add(cyl(0.55, 0.62, h, mat, x, y0 + h / 2, z));
  }
  return g;
}

export function awning(w: number, colorA: string, colorB: string, x: number, y: number, z: number): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ map: stripeTexture(colorA, colorB), roughness: 0.9 });
  const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 2.6), mat);
  t.position.set(x, y, z);
  t.rotation.x = 0.32;
  return t;
}

export function makeTree(scale: number, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.28 * scale, 0.4 * scale, 2.2 * scale, stdMat('#7a5636'), 0, 1.1 * scale, 0, 6));
  const greens = ['#4f9a3c', '#5aa844', '#3f8a35', '#66b04a'];
  const col = greens[Math.floor(rng() * greens.length)];
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9 * scale, 0), stdMat(col));
  crown.position.y = 3.6 * scale;
  crown.scale.set(1, 1.08, 1);
  crown.rotation.y = rng() * 3;
  g.add(crown);
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 * scale, 0), stdMat(col));
  top.position.set(0.2 * scale, 4.9 * scale, 0.1 * scale);
  g.add(top);
  return g;
}

export function makePine(scale: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.25 * scale, 0.35 * scale, 1.6 * scale, stdMat('#6b4a2f'), 0, 0.8 * scale, 0, 6));
  const m = stdMat('#2f7a3a');
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry((2.2 - i * 0.5) * scale, 2.4 * scale, 7), m);
    c.position.y = (2.4 + i * 1.5) * scale;
    g.add(c);
  }
  return g;
}

export function makeBush(scale: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 * scale, 0), stdMat('#5a9f40'));
  m.position.y = 0.7 * scale;
  m.scale.set(1.2, 0.8, 1);
  return m;
}

export function makeCar(color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(box(4.2, 0.95, 2, stdMat(color, { roughness: 0.5, metalness: 0.2 }), 0, 0.85, 0));
  g.add(box(2.3, 0.85, 1.8, stdMat('#26323f', { roughness: 0.3 }), -0.2, 1.7, 0));
  g.add(box(2.1, 0.55, 1.84, stdMat(color, { roughness: 0.5 }), -0.2, 2.08, 0));
  const wm = stdMat('#1d1f22');
  for (const x of [-1.4, 1.4]) {
    for (const z of [-1, 1]) {
      const w = cyl(0.46, 0.46, 0.4, wm, x, 0.46, z, 10);
      w.rotation.x = Math.PI / 2;
      g.add(w);
    }
  }
  return g;
}

export function makeTruck(color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(box(6.2, 2.7, 2.3, stdMat('#e8e6df'), -1, 2.2, 0));
  g.add(box(2, 2.1, 2.2, stdMat(color, { roughness: 0.5 }), 3, 1.9, 0));
  g.add(box(0.3, 1, 2, stdMat('#26323f'), 4.05, 2.3, 0));
  const wm = stdMat('#1d1f22');
  for (const x of [-3, 0, 3]) {
    for (const z of [-1.1, 1.1]) {
      const w = cyl(0.62, 0.62, 0.5, wm, x, 0.62, z, 10);
      w.rotation.x = Math.PI / 2;
      g.add(w);
    }
  }
  return g;
}

export function makeLamp(): THREE.Group {
  const g = new THREE.Group();
  const pole = cyl(0.14, 0.18, 6, stdMat('#4b5258'), 0, 3, 0, 6);
  g.add(pole);
  g.add(box(1.6, 0.18, 0.3, stdMat('#4b5258'), 0.7, 6, 0));
  const headMat = stdMat('#f6e7a8', { emissive: new THREE.Color('#ffe9a0'), emissiveIntensity: 0 });
  lampMaterials.add(headMat);
  g.add(box(0.8, 0.22, 0.55, headMat, 1.4, 5.9, 0));
  return g;
}

let glowTex: THREE.CanvasTexture | null = null;
/** Lambanın yere düşen yumuşak ışık lekesi. */
export function makeLampPool(): THREE.Mesh {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,226,140,0.85)');
    grd.addColorStop(1, 'rgba(255,226,140,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 11),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(1.4, 0.06, 0);
  m.name = 'lampPool';
  return m;
}

/** Basit düşük poligonlu yaya. Bacaklar "legL"/"legR" adıyla yürüme animasyonu için bulunabilir. */
export function makePerson(shirt: string, skin = '#e8b894'): THREE.Group {
  const g = new THREE.Group();
  const pants = stdMat('#2f3a4a');
  const legL = new THREE.Group();
  legL.name = 'legL';
  legL.position.set(0, 0.95, -0.2);
  legL.add(box(0.28, 0.95, 0.28, pants, 0, -0.47, 0));
  const legR = new THREE.Group();
  legR.name = 'legR';
  legR.position.set(0, 0.95, 0.2);
  legR.add(box(0.28, 0.95, 0.28, pants, 0, -0.47, 0));
  g.add(legL, legR);
  g.add(box(0.4, 0.8, 0.8, stdMat(shirt), 0, 1.35, 0));
  g.add(box(0.36, 0.38, 0.38, stdMat(skin), 0, 2.0, 0));
  g.add(box(0.4, 0.14, 0.4, stdMat('#3b2b20'), -0.02, 2.22, 0));
  return g;
}
