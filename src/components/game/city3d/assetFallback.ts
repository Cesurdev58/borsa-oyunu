/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hazır model yüklenemediğinde (dosya yok, bozuk, sınır kutusu sıfır/NaN) gösterilen ANLAMLI yedek model.
 * Eskiden eksik model boş bir grup döndürürdü: ağaç, ev ya da araba haritadan sessizce kaybolurdu.
 * Şimdi modelin ADINDAN türü çıkarılır ve aynı türden basit, kodla çizilmiş bir şey konur:
 * ağaç yerine ağaç, ev yerine çatılı ev, gökdelen yerine uzun kule, araba yerine araba.
 *
 * Yalnızca düz malzemeli kutu/silindir kullanır (canvas dokusu yok), bu yüzden tarayıcı olmadan da çalışır.
 * Orijin zemin ortasıdır, taban y=0'dadır, ön yüz +z yönündedir (hazır modellerle aynı sözleşme).
 */
import * as THREE from 'three';
import { box, createRng, cyl, gabledRoof, makeBush, makeCar, makeLamp, makePine, makeTree, stdMat } from './kit';

export type FallbackKind =
  | 'tree'
  | 'pine'
  | 'bush'
  | 'car'
  | 'streetlight'
  | 'skyscraper'
  | 'tower'
  | 'office'
  | 'house'
  | 'lowrise'
  | 'road'
  | 'park'
  | 'ground'
  | 'watertower'
  | 'prop';

/** Modelin adından türünü çıkarır (kural sırası önemlidir). */
export function fallbackKind(name: string): FallbackKind {
  if (/^tree[-_](large|small)$/.test(name)) return 'pine';
  if (/^tree/.test(name)) return 'tree';
  if (/^bush/.test(name)) return 'bush';
  if (/^car_/.test(name)) return 'car';
  if (/^streetlight/.test(name)) return 'streetlight';
  if (/^building-skyscraper/.test(name)) return 'skyscraper';
  if (/^low-detail-building/.test(name)) return 'lowrise';
  if (/^building-type-/.test(name)) return 'house';
  if (/^building_[AB]$/.test(name)) return 'office';
  if (/^building_/.test(name)) return 'tower';
  if (/^building-/.test(name)) return 'office';
  if (/^road_/.test(name)) return 'road';
  if (/^park_/.test(name)) return 'park';
  if (name === 'base') return 'ground';
  if (name === 'watertower') return 'watertower';
  return 'prop';
}

const WALL_TONES = ['#d9d2c3', '#cfd6dd', '#e0c9b0', '#c9d3c4'];

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

/** Düz renkli pencere şeritleri (canvas gerektirmez) */
function windowBands(w: number, h: number, d: number, floors: number): THREE.Group {
  const g = new THREE.Group();
  const glass = stdMat('#7fa6c4', { roughness: 0.4 });
  for (let i = 0; i < floors; i++) {
    const y = ((i + 0.55) / floors) * h;
    g.add(box(w * 0.82, (h / floors) * 0.32, d + 0.06, glass, 0, y, 0));
    g.add(box(w + 0.06, (h / floors) * 0.32, d * 0.82, glass, 0, y, 0));
  }
  return g;
}

function blockBuilding(w: number, h: number, d: number, floors: number, wall: string, roof = '#6b6a63'): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, h, d, stdMat(wall), 0, h / 2, 0));
  g.add(windowBands(w, h, d, floors));
  g.add(box(w + 0.2, 0.25, d + 0.2, stdMat(roof), 0, h + 0.12, 0));
  return g;
}

function ground(w: number, d: number, color: string): THREE.Mesh {
  return box(w, 0.2, d, stdMat(color), 0, 0.1, 0);
}

/** Modelin türüne uygun, kodla çizilmiş yedek. Aynı ad her zaman aynı görünür (adından tohumlanır). */
export function makeFallbackModel(name: string): THREE.Group {
  const rng = createRng(`yedek:${name}`);
  const kind = fallbackKind(name);
  const g = new THREE.Group();
  g.name = `fallback:${name}`;
  g.userData.fallbackKind = kind;
  switch (kind) {
    case 'tree':
      g.add(makeTree(0.9, rng));
      break;
    case 'pine':
      g.add(makePine(0.9));
      break;
    case 'bush':
      g.add(makeBush(1));
      break;
    case 'car': {
      const color = /taxi/.test(name) ? '#f2c230' : /police/.test(name) ? '#2f4f9a' : pick(['#c0392b', '#2d7d9a', '#7f8c8d', '#3b6b3f'], rng);
      g.add(makeCar(color));
      break;
    }
    case 'streetlight':
      g.add(makeLamp());
      break;
    case 'skyscraper':
      g.add(blockBuilding(6, 26, 6, 9, pick(WALL_TONES, rng), '#4b5258'));
      break;
    case 'tower':
      g.add(blockBuilding(6, 14, 6, 5, pick(WALL_TONES, rng)));
      break;
    case 'office':
      g.add(blockBuilding(7, 9, 6, 3, pick(WALL_TONES, rng)));
      break;
    case 'lowrise':
      g.add(blockBuilding(6, 5, 6, 2, pick(WALL_TONES, rng)));
      break;
    case 'house': {
      const wall = pick(['#efe3cf', '#e6d3b3', '#d7e0d0', '#dcc7c0'], rng);
      g.add(box(6, 3.2, 5, stdMat(wall), 0, 1.6, 0));
      const roof = gabledRoof(6.6, 5.6, 2.2, pick(['#a64b3c', '#7a5a46', '#5b6b7a'], rng));
      roof.position.y = 3.2;
      g.add(roof);
      g.add(box(1, 1.8, 0.12, stdMat('#6b4a2f'), 0, 0.9, 2.55));
      break;
    }
    case 'road':
      g.add(ground(4, 4, '#4b5057'));
      g.add(box(0.2, 0.04, 3.6, stdMat('#e8c648'), 0, 0.22, 0));
      break;
    case 'park': {
      g.add(ground(4, 4, '#86c94a'));
      const t = makeTree(0.6, rng);
      t.position.set(0.8, 0.2, -0.6);
      g.add(t);
      break;
    }
    case 'ground':
      g.add(ground(4, 4, '#9aa08f'));
      break;
    case 'watertower':
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) g.add(box(0.25, 5, 0.25, stdMat('#6b7280'), x, 2.5, z));
      g.add(cyl(2, 2, 2.4, stdMat('#9aa4ad'), 0, 6.2, 0, 10));
      g.add(cyl(0, 2.1, 1, stdMat('#6b7280'), 0, 7.9, 0, 10));
      break;
    default:
      g.add(box(1.2, 1.2, 1.2, stdMat('#9aa4ad'), 0, 0.6, 0));
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
