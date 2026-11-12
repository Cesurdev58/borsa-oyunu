/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Oyundaki 8 ana bina ve 22 şehir bloğunun 3D modelleri.
 * Her model zemin ortasında durur, ön yüzü +z yönündedir ve oyun durumuna (kilit, seviye, dükkân türü) göre değişir.
 */

import * as THREE from 'three';
import type {
  CityUrbanBlockNode,
  IsometricBuildingNode,
} from '../city/cityVisualTypes';
import {
  awning,
  box,
  createRng,
  cyl,
  gabledRoof,
  makeBody,
  makeBush,
  makeCar,
  makeColumns,
  makeTree,
  makeTruck,
  Rng,
  sign,
  stdMat,
  stripeTexture,
} from './kit';

/** Harita birimi → dünya birimi (bina ayak izi için küçültme payıyla). */
const FOOT = 0.085;

// ---------- Ortak modeller ----------

function makeLot(w: number, d: number, label: string, rng: Rng, grass = false, crane = true): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.14, d, stdMat(grass ? '#8fbf64' : '#b9ae9a'), 0, 0.07, 0));
  // çit
  const post = stdMat('#8a8f94');
  const rail = stdMat('#e8892b');
  const step = 2.4;
  for (let x = -w / 2; x <= w / 2 + 0.01; x += step) {
    g.add(box(0.22, 1.3, 0.22, post, x, 0.75, d / 2));
    g.add(box(0.22, 1.3, 0.22, post, x, 0.75, -d / 2));
  }
  for (let z = -d / 2; z <= d / 2 + 0.01; z += step) {
    g.add(box(0.22, 1.3, 0.22, post, w / 2, 0.75, z));
    g.add(box(0.22, 1.3, 0.22, post, -w / 2, 0.75, z));
  }
  g.add(box(w, 0.14, 0.14, rail, 0, 1.2, d / 2));
  g.add(box(w, 0.14, 0.14, rail, 0, 1.2, -d / 2));
  g.add(box(0.14, 0.14, d, rail, w / 2, 1.2, 0));
  g.add(box(0.14, 0.14, d, rail, -w / 2, 1.2, 0));
  // vinç
  if (crane) {
    const yellow = stdMat('#e6b422');
    const cx = -w * 0.22;
    const cz = -d * 0.18;
    g.add(box(0.6, 11, 0.6, yellow, cx, 5.6, cz));
    g.add(box(9, 0.5, 0.5, yellow, cx + 2.6, 11.2, cz));
    g.add(box(2, 1.2, 1.2, stdMat('#6b7076'), cx - 2, 10.8, cz));
    g.add(box(0.1, 3, 0.1, stdMat('#222'), cx + 6, 9.6, cz));
    g.add(box(1.0, 0.6, 0.8, stdMat('#d9d6cc'), cx + 0.5, 10.4, cz + 0.5));
  }
  // malzeme yığınları
  const bricks = stdMat('#a65a3a');
  const pallets = stdMat('#c9b98e');
  for (let i = 0; i < 3; i++) {
    g.add(box(1.6 + rng(), 0.8 + rng() * 0.6, 1.2, i % 2 ? bricks : pallets, w * 0.18 + i * 1.7, 0.6, d * 0.1 + rng()));
  }
  // tabela
  const board = sign(label, '#d9822b', '#ffffff', Math.min(w * 0.85, 8.2), 1.9, 360);
  board.position.set(0, 2.4, d / 2 + 0.2);
  g.add(board);
  g.add(box(0.2, 2, 0.2, post, -Math.min(w * 0.4, 4), 1.2, d / 2 + 0.15));
  g.add(box(0.2, 2, 0.2, post, Math.min(w * 0.4, 4), 1.2, d / 2 + 0.15));
  return g;
}

function makeClassical(
  w: number,
  d: number,
  h: number,
  wall: string,
  trim: string,
  signText: string,
  signBg: string,
  rng: Rng,
  brick = false
): THREE.Group {
  const g = new THREE.Group();
  g.add(makeBody({ w, h, d, wall, frame: trim, glass: '#6d93b3', brick, parapet: false, units: 0 }, rng));
  const trimMat = stdMat(trim);
  g.add(box(w + 1.2, 0.8, d + 1.2, trimMat, 0, h + 0.4, 0));
  const hip = gabledRoof(d + 0.8, w + 0.8, Math.min(3.2, h * 0.28), '#efece2');
  hip.rotation.y = Math.PI / 2;
  hip.position.y = h + 0.8;
  g.add(hip);
  const pw = w * 0.64;
  const colH = h * 0.7;
  g.add(box(pw, 0.5, 3.2, trimMat, 0, 0.25, d / 2 + 1.6));
  g.add(makeColumns(6, pw - 1.2, colH, d / 2 + 2.7, 0.5, trim));
  g.add(box(pw + 0.6, 1, 3.8, trimMat, 0, 0.5 + colH + 0.5, d / 2 + 1.5));
  const ped = gabledRoof(pw + 1.2, 0.8, 2.2, trim);
  ped.position.set(0, 0.5 + colH + 1, d / 2 + 3.2);
  g.add(ped);
  g.add(box(2.2, h * 0.4, 0.3, stdMat('#4a2f26'), 0, h * 0.2 + 0.5, d / 2 + 0.1));
  const board = sign(signText, signBg, '#ffffff', Math.min(pw * 0.75, 6.4), 1.6, 320);
  board.position.set(0, 0.5 + colH + 2.0, d / 2 + 3.65);
  g.add(board);
  return g;
}

function makeWarehouse(w: number, d: number, h: number, wall: string, roof: string, label: string, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, h, d, stdMat(wall), 0, h / 2, 0));
  const r = gabledRoof(w + 1.2, d + 1.2, h * 0.38, roof);
  r.position.y = h;
  g.add(r);
  const dockMat = stdMat('#5b6670');
  const n = Math.max(2, Math.round(w / 3.6));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / n;
    g.add(box(2, h * 0.52, 0.3, dockMat, x, h * 0.26, d / 2 + 0.05));
  }
  g.add(box(1.4, 2.6, 1.4, stdMat('#9c6a52'), w * 0.3, h + h * 0.3, -d * 0.2));
  if (label) {
    const board = sign(label, '#35506b', '#ffffff', Math.min(w * 0.8, 7), 1.5, 320);
    board.position.set(0, h - 0.9, d / 2 + 0.2);
    g.add(board);
  }
  void rng;
  return g;
}

function makeHospital(w: number, d: number, h: number, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  g.add(makeBody({ w, h, d, wall: '#f1f1ec', frame: '#ffffff', glass: '#7ea2c0', units: 3, roof: '#dcdcd6' }, rng));
  const wing = makeBody({ w: w * 0.4, h: h * 0.66, d, wall: '#f1f1ec', frame: '#ffffff', glass: '#7ea2c0', units: 1, roof: '#dcdcd6' }, rng);
  wing.position.set(-w * 0.7, 0, 0);
  g.add(wing);
  g.add(box(w * 0.4, 0.5, 3, stdMat('#ffffff'), w * 0.1, 3.8, d / 2 + 1.5));
  g.add(makeColumns(3, w * 0.34, 3.4, d / 2 + 2.6, 0.2, '#ffffff'));
  const red = new THREE.MeshBasicMaterial({ color: '#d63a2f' });
  const cross = new THREE.Group();
  cross.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.25), red));
  cross.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.25), red));
  cross.position.set(w * 0.1, h * 0.72, d / 2 + 0.15);
  g.add(cross);
  return g;
}

function makeTower(
  w: number,
  d: number,
  h: number,
  wall: string,
  glass: string,
  frame: string,
  label: string,
  signBg: string,
  rng: Rng,
  steps = 2
): THREE.Group {
  const g = new THREE.Group();
  let cw = w;
  let cd = d;
  let y = 0;
  const per = h / steps;
  for (let i = 0; i < steps; i++) {
    const b = makeBody({ w: cw, h: per, d: cd, wall, glass, frame, units: i === steps - 1 ? 2 : 0, roof: '#5f6770', parapet: true }, rng);
    b.position.y = y;
    g.add(b);
    y += per;
    cw *= 0.78;
    cd *= 0.78;
  }
  const mast = cyl(0.12, 0.2, 6, stdMat('#8d9296'), 0, y + 3.4, 0, 6);
  g.add(mast);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3b30' })));
  g.children[g.children.length - 1].position.set(0, y + 6.5, 0);
  if (label) {
    const board = sign(label, signBg, '#ffffff', Math.min(w * 0.8, 7.4), 1.8, 360);
    board.position.set(0, 3.6, d / 2 + 0.2);
    g.add(board);
  }
  return g;
}

// ---------- 8 ana bina ----------

const LOT_LABEL: Record<string, string> = {
  SIRKET_MERKEZI: 'ŞİRKET ARSASI',
  FABRIKA: 'FABRİKA ARSASI',
  ARGE_MERKEZI: 'AR-GE ARSASI',
  HOLDING_MERKEZI: 'HOLDİNG ARSASI',
};


/** Ana binalara ayrıntı: giriş basamakları, çalılar, çatı donanımı, bayrak direği, helikopter pisti, güneş paneli, yükleme rampası. */
function addCoreDetails(g: THREE.Group, node: IsometricBuildingNode, w: number, d: number, lvl: number, rng: Rng): void {
  const front = d * 0.4 + 1.2;
  const stone = stdMat('#cfcabb');
  const metal = stdMat('#9aa1a8', { metalness: 0.4, roughness: 0.5 });
  const acUnit = (x: number, y: number, z: number): void => {
    g.add(box(1.8, 0.9, 1.2, metal, x, y + 0.45, z));
    g.add(cyl(0.45, 0.45, 0.12, stdMat('#4b5258'), x, y + 0.96, z, 8));
  };
  const flag = (x: number, z: number, color: string): void => {
    g.add(cyl(0.1, 0.1, 7, stdMat('#d8d8d8', { metalness: 0.5 }), x, 3.5, z, 6));
    g.add(box(2, 1.2, 0.08, stdMat(color), x + 1.05, 6.3, z));
  };
  const steps = (width: number): void => {
    g.add(box(width, 0.35, 1.8, stone, 0, 0.18, front));
    g.add(box(width - 0.8, 0.35, 1.2, stone, 0, 0.5, front - 0.2));
  };
  const bushes = (spread: number): void => {
    for (const sx of [-1, 1]) {
      const b = makeBush(0.9 + rng() * 0.3);
      b.position.set(sx * spread, 0.5, front + 0.4);
      g.add(b);
    }
  };

  switch (node.id) {
    case 'BORSA':
      steps(w * 0.5);
      bushes(w * 0.38);
      flag(-w * 0.43, front - 0.4, '#c4422f');
      flag(w * 0.43, front - 0.4, '#c4422f');
      break;
    case 'BANKA':
      steps(w * 0.45);
      bushes(w * 0.36);
      flag(w * 0.43, front - 0.4, '#1f4f8f');
      break;
    case 'HABER_MERKEZI': {
      const top = 14 + lvl * 2;
      g.add(cyl(0.12, 0.2, 9, metal, -w * 0.22, top + 4.5, -d * 0.1, 6));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), stdMat('#ff3b30', { emissive: '#ff3b30', emissiveIntensity: 1.2 })).translateX(-w * 0.22).translateY(top + 9.2).translateZ(-d * 0.1));
      acUnit(w * 0.1, top, -d * 0.2);
      acUnit(-w * 0.05, top, d * 0.1);
      steps(w * 0.4);
      bushes(w * 0.3);
      break;
    }
    case 'OYUNCU_OFISI': {
      const top = 8 + lvl * 1.6;
      acUnit(w * 0.2, top, -d * 0.1);
      acUnit(-w * 0.2, top, d * 0.05);
      steps(w * 0.45);
      bushes(w * 0.32);
      break;
    }
    case 'SIRKET_MERKEZI': {
      const top = 16 + lvl * 3;
      acUnit(w * 0.15, top, -d * 0.15);
      acUnit(-w * 0.15, top, d * 0.1);
      g.add(cyl(0.1, 0.1, 5, metal, 0, top + 2.5, 0, 6));
      steps(w * 0.4);
      bushes(w * 0.3);
      break;
    }
    case 'FABRIKA': {
      const h = 7 + lvl * 0.8;
      const dockZ = d * 0.4 + 1.4;
      g.add(box(w * 0.5, 0.9, 2.4, stdMat('#8c8f93'), -w * 0.22, 0.45, dockZ));
      for (let i = 0; i < 5; i++) {
        g.add(box(1.1, 0.9, 1.1, stdMat(i % 2 ? '#b98a4e' : '#a6763d'), -w * 0.35 + i * 1.4, 1.35, dockZ));
      }
      g.add(box(w * 0.5, 0.18, 2.6, stdMat('#6e6b63'), -w * 0.22, 0.95, dockZ));
      acUnit(w * 0.1, h, -d * 0.2);
      break;
    }
    case 'ARGE_MERKEZI': {
      const h = 9 + lvl * 1.5;
      const panel = stdMat('#1d3a63', { metalness: 0.5, roughness: 0.25 });
      for (let i = 0; i < 4; i++) {
        const p = box(1.8, 0.12, 1.2, panel, w * 0.02 + i * 2.1, h + 0.7, -d * 0.18);
        p.rotation.x = -0.35;
        g.add(p);
      }
      steps(w * 0.4);
      bushes(w * 0.3);
      break;
    }
    case 'HOLDING_MERKEZI': {
      const top = 24 + lvl * 3;
      g.add(cyl(3.2, 3.2, 0.3, stdMat('#4a4f55'), 0, top + 0.15, 0, 18));
      const h = sign('H', '#4a4f55', '#ffd23f', 3.6, 3.6, 128);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, top + 0.34, 0);
      g.add(h);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), stdMat('#ffb020', { emissive: '#ffb020', emissiveIntensity: 1.2 })).translateX(Math.cos(a) * 3.1).translateY(top + 0.4).translateZ(Math.sin(a) * 3.1));
      }
      steps(w * 0.38);
      bushes(w * 0.28);
      flag(-w * 0.4, front - 0.4, '#7c3aed');
      break;
    }
    default:
      break;
  }
}

export function buildCore(node: IsometricBuildingNode): THREE.Group {
  const rng = createRng(`core-${node.id}`);
  const w = node.width * FOOT;
  const d = node.height * FOOT;
  const lvl = Math.max(1, node.level || 1);
  const g = new THREE.Group();

  if (!node.isUnlocked && LOT_LABEL[node.id]) {
    g.add(makeLot(w, d, LOT_LABEL[node.id], rng));
    return g;
  }

  switch (node.id) {
    case 'BORSA': {
      const c = makeClassical(w * 0.9, d * 0.78, 12 + lvl * 1.2, '#ece7d8', '#ffffff', 'BORSA', '#1c4f9a', rng);
      g.add(c);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(3.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        stdMat('#d6b24a', { metalness: 0.5, roughness: 0.35 })
      );
      dome.position.y = 12 + lvl * 1.2 + 3.4;
      g.add(dome);
      g.add(cyl(3.6, 3.8, 1.6, stdMat('#efece2'), 0, 12 + lvl * 1.2 + 1.2, 0, 14));
      break;
    }
    case 'BANKA': {
      g.add(makeClassical(w * 0.9, d * 0.8, 11 + lvl, '#efe6cf', '#ffffff', 'MERKEZ BANKASI', '#1f4f8f', rng));
      break;
    }
    case 'HABER_MERKEZI': {
      g.add(makeTower(w * 0.8, d * 0.8, 14 + lvl * 2, '#5d7d99', '#9fd0ee', '#d7e6f0', 'HABER', '#c4422f', rng, 2));
      const dish = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), stdMat('#e9ecef'));
      dish.rotation.x = -0.9;
      dish.position.set(w * 0.2, 14 + lvl * 2 + 1.2, d * 0.1);
      g.add(dish);
      break;
    }
    case 'OYUNCU_OFISI': {
      const h = 8 + lvl * 1.6;
      g.add(makeBody({ w: w * 0.85, h, d: d * 0.8, wall: '#e5d6b4', frame: '#f6efd9', glass: '#6f93ae', units: 2, roof: '#756f63' }, rng));
      g.add(awning(w * 0.5, '#c53a32', '#f4f1e6', 0, 3.7, d * 0.4 + 1.4));
      const board = sign('OFİS', '#2f6b8f', '#ffffff', 5.2, 1.5, 256);
      board.position.set(0, h - 1.1, d * 0.4 + 0.15);
      g.add(board);
      break;
    }
    case 'SIRKET_MERKEZI': {
      const t = node.visualMeta.companyTicker;
      g.add(makeTower(w * 0.8, d * 0.8, 16 + lvl * 3, '#6a8fb5', '#9fd0ee', '#dfe9f2', t ? t : 'ŞİRKET', '#2a5d8f', rng, 3));
      break;
    }
    case 'FABRIKA': {
      const h = 7 + lvl * 0.8;
      g.add(box(w * 0.92, h, d * 0.8, stdMat('#a7a399'), 0, h / 2, 0));
      const teeth = 4;
      for (let i = 0; i < teeth; i++) {
        const r = gabledRoof(d * 0.82, (w * 0.92) / teeth, 2.4, '#7d8a93');
        r.rotation.y = Math.PI / 2;
        r.position.set(-w * 0.46 + ((i + 0.5) * (w * 0.92)) / teeth, h, 0);
        g.add(r);
      }
      for (const x of [-w * 0.3, w * 0.28]) g.add(cyl(0.9, 1.2, 12, stdMat('#9c6a52'), x, h + 5, -d * 0.2, 8));
      for (let i = 0; i < 3; i++) g.add(cyl(1.6, 1.6, 4.6, stdMat('#c9ccd0', { metalness: 0.3 }), w * 0.34, 2.3, d * 0.42 - i * 3.6, 10));
      const door = box(4.2, h * 0.6, 0.3, stdMat('#5b6670'), 0, h * 0.3, d * 0.4 + 0.05);
      g.add(door);
      const board = sign('FABRİKA', '#7a4a1c', '#ffffff', 6.6, 1.6, 320);
      board.position.set(0, h - 1, d * 0.4 + 0.2);
      g.add(board);
      if (node.visualMeta.isFactoryProducing) {
        const smoke = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshStandardMaterial({ color: '#e4e4e0', transparent: true, opacity: 0.7, flatShading: true }));
        smoke.position.set(-w * 0.3, h + 12.5, -d * 0.2);
        smoke.name = 'smoke';
        g.add(smoke);
      }
      break;
    }
    case 'ARGE_MERKEZI': {
      const h = 9 + lvl * 1.5;
      g.add(makeBody({ w: w * 0.85, h, d: d * 0.8, wall: '#eef2f4', frame: '#ffffff', glass: '#59a8d6', units: 2, roof: '#d9dde0' }, rng));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), stdMat('#cfe6f5', { transparent: true, opacity: 0.85 }));
      dome.position.set(-w * 0.18, h + 0.9, 0);
      g.add(dome);
      g.add(cyl(0.12, 0.18, 7, stdMat('#8d9296'), w * 0.22, h + 3.5, 0, 6));
      const board = sign('AR-GE', '#1f8a8a', '#ffffff', 5, 1.5, 256);
      board.position.set(0, h - 1.1, d * 0.4 + 0.15);
      g.add(board);
      break;
    }
    case 'HOLDING_MERKEZI': {
      g.add(makeTower(w * 0.78, d * 0.78, 24 + lvl * 3, '#3c5f86', '#7fb4e0', '#c8d6e4', 'HOLDİNG', '#7c3aed', rng, 4));
      break;
    }
    default:
      g.add(makeBody({ w, h: 10, d, wall: '#cccccc' }, rng));
  }

  addCoreDetails(g, node, w, d, lvl, rng);

  if (node.constructionInfo) {
    const lot = makeLot(w * 0.45, d * 0.45, 'GENİŞLETME', rng);
    lot.position.set(w * 0.55, 0, d * 0.1);
    g.add(lot);
  }
  return g;
}

// ---------- Dükkân türleri ----------

function shopModel(type: string, w: number, d: number, lvl: number, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const up = 1 + Math.min(4, lvl - 1) * 0.12;
  switch (type) {
    case 'MARKET': {
      const h = 6 * up;
      g.add(makeBody({ w, h, d, wall: '#cfc8b8', frame: '#e6e0d0', glass: '#6f93ae', units: 3, roof: '#7a7770' }, rng));
      g.add(box(w * 0.82, 2.8, 0.3, stdMat('#38546b'), 0, 1.9, d / 2 + 0.08));
      g.add(awning(w * 0.82, '#c53a32', '#f4f1e6', 0, 3.7, d / 2 + 1.3));
      const board = sign('MARKET', '#c53a32', '#ffffff', Math.min(w * 0.7, 7), 1.7, 320);
      board.position.set(0, h - 1.1, d / 2 + 0.2);
      g.add(board);
      break;
    }
    case 'KAFE': {
      const h = 6.4 * up;
      g.add(makeBody({ w, h, d, wall: '#d9c79c', frame: '#f5ecd2', glass: '#6f93ae', units: 2, roof: '#8a7d62' }, rng));
      for (const x of [-w * 0.25, w * 0.25]) {
        g.add(awning(w * 0.4, '#2f6b3a', '#f2f0e4', x, 3.5, d / 2 + 1.2));
        g.add(box(w * 0.34, 2.4, 0.3, stdMat('#3a4a57'), x, 1.7, d / 2 + 0.05));
      }
      const board = sign('KAFE', '#2f6b3a', '#fff7e0', Math.min(w * 0.5, 5), 1.4, 256);
      board.position.set(0, h - 1, d / 2 + 0.2);
      g.add(board);
      const tm = stdMat('#6b4a2f');
      for (let i = 0; i < 2; i++) {
        g.add(box(1.5, 0.14, 1.5, tm, -w * 0.2 + i * w * 0.4, 1.0, d / 2 + 3.4));
        g.add(box(0.2, 1, 0.2, tm, -w * 0.2 + i * w * 0.4, 0.5, d / 2 + 3.4));
      }
      break;
    }
    case 'BUFE': {
      const h = 3.8;
      g.add(makeBody({ w: w * 0.7, h, d: d * 0.7, wall: '#e9d36a', frame: '#fff6c8', glass: '#6f93ae', units: 1, roof: '#7a6a2a' }, rng));
      g.add(awning(w * 0.6, '#d94a3a', '#f6f3e8', 0, 2.9, (d * 0.7) / 2 + 1.1));
      const board = sign('BÜFE', '#d94a3a', '#ffffff', 4, 1.2, 256);
      board.position.set(0, h + 0.2, (d * 0.7) / 2 + 0.1);
      g.add(board);
      break;
    }
    case 'MANAV': {
      const h = 5 * up;
      g.add(makeBody({ w, h, d: d * 0.85, wall: '#d8e4c0', frame: '#f4f8ea', glass: '#6f93ae', units: 1, roof: '#6c7a4e' }, rng));
      g.add(awning(w * 0.9, '#2f8f3a', '#f4f1e6', 0, 3.2, (d * 0.85) / 2 + 1.2));
      const crate = stdMat('#a9794a');
      const fruit = ['#d9392b', '#f0a62b', '#6cc24a', '#f0d12b'];
      for (let i = 0; i < 4; i++) {
        const x = -w * 0.34 + i * (w * 0.22);
        g.add(box(1.5, 0.7, 1.2, crate, x, 0.5, (d * 0.85) / 2 + 1.9));
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), stdMat(fruit[i % 4]));
        f.position.set(x, 1.05, (d * 0.85) / 2 + 1.9);
        g.add(f);
      }
      const board = sign('MANAV', '#2f8f3a', '#ffffff', 5, 1.3, 256);
      board.position.set(0, h - 0.9, (d * 0.85) / 2 + 0.15);
      g.add(board);
      break;
    }
    case 'GIYIM_MAGAZASI': {
      const h = 7 * up;
      g.add(makeBody({ w, h, d, wall: '#ecd3da', frame: '#fff5f7', glass: '#8aa6c4', units: 2, roof: '#8a7580' }, rng));
      g.add(box(w * 0.7, 3.2, 0.3, stdMat('#4c3f55'), 0, 2.0, d / 2 + 0.08));
      const board = sign('GİYİM', '#b8456b', '#ffffff', Math.min(w * 0.6, 6), 1.5, 256);
      board.position.set(0, h - 1, d / 2 + 0.2);
      g.add(board);
      break;
    }
    case 'ELEKTRONIK_MAGAZASI': {
      const h = 7.5 * up;
      g.add(makeBody({ w, h, d, wall: '#3a4658', frame: '#9ab4d1', glass: '#7fd0f0', units: 2, roof: '#2d3643' }, rng));
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 2.6), new THREE.MeshBasicMaterial({ color: '#3fb6ff' }));
      screen.position.set(0, h * 0.5, d / 2 + 0.12);
      g.add(screen);
      const board = sign('ELEKTRONİK', '#1d6fd1', '#ffffff', Math.min(w * 0.8, 7.4), 1.5, 360);
      board.position.set(0, h - 1, d / 2 + 0.2);
      g.add(board);
      break;
    }
    case 'MOBILYA_MAGAZASI': {
      const h = 6.4 * up;
      g.add(makeBody({ w, h, d, wall: '#e0c9a6', frame: '#f6ead2', glass: '#7fa6c4', units: 3, roof: '#8d7a5a' }, rng));
      g.add(box(w * 0.8, 3, 0.3, stdMat('#43607a'), 0, 1.9, d / 2 + 0.08));
      const sofa = stdMat('#a14b3a');
      g.add(box(2.4, 0.8, 1.1, sofa, -1.4, 0.5, d / 2 + 1.7));
      g.add(box(2.4, 0.9, 0.3, sofa, -1.4, 1.1, d / 2 + 1.25));
      const board = sign('MOBİLYA', '#8a5a2e', '#ffffff', Math.min(w * 0.8, 7), 1.5, 320);
      board.position.set(0, h - 1, d / 2 + 0.2);
      g.add(board);
      break;
    }
    case 'OTOMOBIL_GALERISI': {
      const h = 5 * up;
      g.add(box(w, h, d, new THREE.MeshStandardMaterial({ color: '#8fc7e8', transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.3 }), 0, h / 2, 0));
      g.add(box(w + 0.6, 0.6, d + 0.6, stdMat('#2d3643'), 0, h + 0.3, 0));
      for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(box(0.4, h, 0.4, stdMat('#2d3643'), x, h / 2, z));
      const car = makeCar('#d94a3a');
      car.scale.setScalar(0.85);
      car.position.set(-w * 0.18, 0.2, 0);
      g.add(car);
      const car2 = makeCar('#e8e6df');
      car2.scale.setScalar(0.85);
      car2.position.set(w * 0.2, 0.2, 0);
      g.add(car2);
      const board = sign('GALERİ', '#2d3643', '#ffd54a', Math.min(w * 0.7, 6), 1.4, 256);
      board.position.set(0, h + 1.4, d / 2 + 0.1);
      g.add(board);
      break;
    }
    default:
      g.add(makeBody({ w, h: 5, d, wall: '#cfc8b8' }, rng));
  }
  return g;
}

function makeHotel(w: number, d: number, h: number, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  g.add(makeBody({ w, h, d, wall: '#cdb88c', frame: '#efe3c3', glass: '#7497b6', units: 2 }, rng));
  const strip = stdMat('#8a6a45');
  for (const x of [-w * 0.22, w * 0.22]) g.add(box(1.1, h * 0.98, 0.8, strip, x, h * 0.49, d / 2 + 0.4));
  const aw = box(w * 0.5, 0.5, 2.6, stdMat('#c8924d'), 0, 3.6, d / 2 + 1.3);
  aw.rotation.x = 0.12;
  g.add(aw);
  const board = sign('BUTİK OTEL', '#8a5a2e', '#fff4d6', Math.min(w * 0.9, 7), 1.7, 320);
  board.position.set(0, h - 1.6, d / 2 + 0.7);
  g.add(board);
  return g;
}

// ---------- Şehir blokları ----------

export const SHOP_SLOT_IDS = new Set(['urban-ticaret-magaza-1', 'urban-ticaret-kafe-2', 'urban-ticaret-otel-5']);

export function buildBlock(block: CityUrbanBlockNode): THREE.Group {
  const rng = createRng(`block-${block.id}`);
  const w = block.width * FOOT * 1.05;
  const d = block.height * FOOT * 1.05;
  const lvl = Math.max(1, block.level ?? 1);
  const h = 3.6 + block.floors * 3.1;
  const g = new THREE.Group();

  if (SHOP_SLOT_IDS.has(block.id)) {
    if (block.activeShopType) {
      g.add(shopModel(block.activeShopType, w, d, lvl, rng));
    } else if (block.id === 'urban-ticaret-otel-5') {
      g.add(makeHotel(w * 0.9, d * 0.9, 13, rng));
    } else {
      const lot = makeLot(w, d, 'DÜKKÂN AÇ', rng, true, false);
      g.add(lot);
    }
    return g;
  }

  switch (block.category) {
    case 'TRADE_CENTER': {
      if (block.id.includes('clearing')) {
        g.add(makeClassical(w * 0.85, d * 0.7, 8, '#e9e2cf', '#ffffff', 'TAKAS', '#35506b', rng));
      } else if (block.id.includes('audit')) {
        g.add(makeTower(w * 0.7, d * 0.7, 18, '#7b8794', '#a8cfe8', '#dfe6ec', 'DENETİM', '#4a5568', rng, 2));
      } else {
        g.add(makeBody({ w, h: 9 + lvl, d, wall: '#cda476', frame: '#f2e3c4', glass: '#6f93ae', brick: true, units: 2, roof: '#6b6258' }, rng));
        g.add(awning(w * 0.7, '#35506b', '#f4f1e6', 0, 3.6, d / 2 + 1.2));
        const board = sign('TİCARET HANI', '#35506b', '#ffffff', Math.min(w * 0.9, 7.6), 1.5, 360);
        board.position.set(0, 8 + lvl, d / 2 + 0.2);
        g.add(board);
      }
      break;
    }
    case 'WHOLESALE_DEPOT':
      g.add(makeWarehouse(w, d * 0.9, 6.6, '#b8a58a', '#59687a', 'TOPTANCI', rng));
      break;
    case 'WAREHOUSE_LINK':
      g.add(makeWarehouse(w * 0.9, d * 0.85, 5.4, '#a9b0b6', '#6b7a88', 'DEPO', rng));
      break;
    case 'INDUSTRIAL_WAREHOUSE':
      g.add(makeWarehouse(w, d * 0.95, 7.6, '#9aa4ab', '#4f6a52', 'MAMUL DEPOSU', rng));
      break;
    case 'LOGISTICS_YARD': {
      g.add(box(w, 0.14, d, stdMat('#a9a79f'), 0, 0.07, 0));
      const cols = ['#c0392b', '#2e86c1', '#d68910', '#27ae60', '#7d3c98'];
      for (let i = 0; i < 6; i++) {
        const lvlStack = 1 + (i % 2);
        for (let k = 0; k < lvlStack; k++) {
          g.add(box(2.6, 1.3, 1.1, stdMat(cols[(i + k) % cols.length]), -w * 0.3 + (i % 3) * 3.0, 0.8 + k * 1.3, -d * 0.3 + Math.floor(i / 3) * 1.5));
        }
      }
      const office = makeBody({ w: 3.6, h: 3.2, d: 3, wall: '#e8e6df', frame: '#ffffff', units: 0 }, rng);
      office.position.set(w * 0.3, 0, -d * 0.2);
      g.add(office);
      const truck = makeTruck('#e6a23a');
      truck.scale.setScalar(0.75);
      truck.position.set(0, 0.1, d * 0.28);
      g.add(truck);
      const board = sign('LOJİSTİK', '#8a5a1c', '#ffffff', 5.6, 1.4, 256);
      board.position.set(0, 2.6, d / 2 - 0.1);
      g.add(board);
      break;
    }
    case 'ENERGY_SUBSTATION': {
      g.add(box(w, 0.14, d, stdMat('#9aa09a'), 0, 0.07, 0));
      const gray = stdMat('#7d868e');
      for (let i = 0; i < 3; i++) {
        g.add(box(2.4, 2.4, 2, gray, -w * 0.28 + i * 3.4, 1.4, -d * 0.1));
        for (let k = 0; k < 3; k++) g.add(cyl(0.22, 0.22, 1.5, stdMat('#d8d2c4'), -w * 0.28 + i * 3.4 - 0.7 + k * 0.7, 3.2, -d * 0.1, 6));
      }
      const metal = stdMat('#8e979e');
      for (const x of [-w * 0.4, w * 0.4]) {
        g.add(box(0.3, 9, 0.3, metal, x, 4.5, d * 0.28));
        g.add(box(3.2, 0.25, 0.25, metal, x, 8.4, d * 0.28));
      }
      g.add(box(w * 0.8, 0.12, 0.12, stdMat('#2d3036'), 0, 8.3, d * 0.28));
      const board = sign('TRAFO', '#d4a017', '#2a2a2a', 4.4, 1.2, 256);
      board.position.set(0, 2.2, d / 2 - 0.1);
      g.add(board);
      break;
    }
    case 'FUTURE_FACTORY_PARCEL': {
      g.add(makeLot(w, d, block.isUnlocked ? '2. ETAP' : 'FABRİKA GENİŞLEME', rng));
      break;
    }
    case 'TECH_OFFICE': {
      g.add(makeTower(w * 0.85, d * 0.8, h + 4, '#55789a', '#a6d4f0', '#d9e6f1', 'VERİ KAMPÜSÜ', '#2a5d8f', rng, 2));
      break;
    }
    case 'INNOVATION_LAB': {
      g.add(makeBody({ w: w * 0.9, h: h * 0.8, d: d * 0.85, wall: '#eef2f4', frame: '#ffffff', glass: '#59a8d6', units: 1, roof: '#d9dde0' }, rng));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), stdMat('#cfe6f5', { transparent: true, opacity: 0.85 }));
      dome.position.set(0, h * 0.8 + 0.9, 0);
      g.add(dome);
      const board = sign('LAB', '#1f8a8a', '#ffffff', 3.6, 1.3, 256);
      board.position.set(0, 3.6, (d * 0.85) / 2 + 0.15);
      g.add(board);
      break;
    }
    case 'AUTOMATION_HUB': {
      g.add(makeBody({ w, h: h * 0.85, d: d * 0.9, wall: '#5c7fa6', frame: '#dce7f2', glass: '#8cc4e6', units: 2, roof: '#46586b' }, rng));
      const arm = stdMat('#e6842b');
      const top = h * 0.85;
      g.add(box(0.9, 1.2, 0.9, arm, w * 0.15, top + 0.6, 0));
      g.add(box(0.5, 3.4, 0.5, arm, w * 0.15, top + 2.4, 0));
      g.add(box(3.2, 0.5, 0.5, arm, w * 0.15 + 1.3, top + 4.1, 0));
      const board = sign('ROBOTİK', '#e6842b', '#ffffff', 5, 1.3, 256);
      board.position.set(0, 3.6, (d * 0.9) / 2 + 0.15);
      g.add(board);
      break;
    }
    case 'TECH_ACADEMY': {
      g.add(makeBody({ w, h: h * 0.8, d: d * 0.85, wall: '#a8473a', frame: '#f2eee3', glass: '#7fa6c4', brick: true, units: 1, roof: '#6b6258' }, rng));
      const tw = makeBody({ w: 2.6, h: h * 0.8 + 4, d: 2.6, wall: '#a8473a', frame: '#f2eee3', brick: true, units: 0, parapet: false }, rng);
      tw.position.set(w * 0.28, 0, d * 0.1);
      g.add(tw);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2, 2.6, 4), stdMat('#3d4a55'));
      roof.position.set(w * 0.28, h * 0.8 + 5.2, d * 0.1);
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
      const board = sign('AKADEMİ', '#5b2a8a', '#ffffff', 5.4, 1.3, 256);
      board.position.set(-w * 0.12, 3.4, (d * 0.85) / 2 + 0.15);
      g.add(board);
      break;
    }
    case 'RESIDENTIAL_APARTMENT': {
      const tint = block.id.endsWith('17') ? '#c8924d' : '#b58b6a';
      g.add(makeBody({ w, h: h + 2, d, wall: tint, frame: '#f0dfb8', glass: '#7497b6', brick: true, units: 2, roof: '#6b6258' }, rng));
      g.add(box(w * 0.34, 0.45, 2, stdMat('#8a6a45'), 0, 3.2, d / 2 + 1));
      break;
    }
    case 'CITY_HOSPITAL':
      g.add(makeHospital(w * 0.75, d * 0.8, 9, rng));
      break;
    case 'MUNICIPAL_HALL':
      g.add(makeClassical(w * 0.85, d * 0.8, 9.5, '#9b3d33', '#f2eee3', 'BELEDİYE', '#7a2a24', rng, true));
      break;
    case 'LOCKED_EXPANSION_PARCEL': {
      g.add(box(w, 0.14, d, stdMat('#9fd36a'), 0, 0.07, 0));
      const post = stdMat('#8a8f94');
      for (let x = -w / 2; x <= w / 2 + 0.01; x += 2.4) {
        g.add(box(0.2, 1.1, 0.2, post, x, 0.65, d / 2));
        g.add(box(0.2, 1.1, 0.2, post, x, 0.65, -d / 2));
      }
      for (let z = -d / 2; z <= d / 2 + 0.01; z += 2.4) {
        g.add(box(0.2, 1.1, 0.2, post, w / 2, 0.65, z));
        g.add(box(0.2, 1.1, 0.2, post, -w / 2, 0.65, z));
      }
      const board = sign('KİLİTLİ ARSA', '#6b7580', '#ffffff', 6, 1.5, 320);
      board.position.set(0, 2.2, d / 2 + 0.15);
      g.add(board);
      g.add(makeBush(1.1));
      g.children[g.children.length - 1].position.set(-w * 0.25, 0.6, -d * 0.1);
      const t = makeTree(0.8, rng);
      t.position.set(w * 0.25, 0, -d * 0.1);
      g.add(t);
      break;
    }
    default:
      g.add(makeBody({ w, h, d, wall: '#cfc8b8' }, rng));
  }
  return g;
}

/** Kilitli (henüz açılmamış) bölgedeki blokları soluk gösterir. */
export function tintLocked(group: THREE.Object3D): void {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const sm = m as THREE.MeshStandardMaterial;
      if (sm.color) sm.color.multiply(new THREE.Color('#dde1e6'));
    }
  });
}

export { stripeTexture };
