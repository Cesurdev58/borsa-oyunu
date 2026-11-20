/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hazır 3D modellerin TEK listesi (saf veri: `three` ve tarayıcı yok).
 * Hem oyun (`assets.ts`) hem de `npm run asset-audit` (`assetAudit.ts`) buradan okur; böylece
 * "oyunun istediği dosya" ile "denetimin baktığı dosya" hiçbir zaman ayrışmaz.
 */

export type AssetPack = 'kaykit' | 'kenney-commercial' | 'kenney-suburban';

export interface AssetManifestEntry {
  /** Kısa ad (kodda kullanılan: 'tree_A', 'building-type-c' …) */
  name: string;
  pack: AssetPack;
  /** `public/` altına göre yol, ör. `models/kaykit/tree_A.gltf` */
  path: string;
  format: 'gltf' | 'glb';
}

const KAYKIT = [
  'building_A', 'building_B', 'building_C', 'building_D', 'building_E', 'building_F', 'building_G', 'building_H',
  'base', 'tree_A', 'tree_B', 'tree_C', 'tree_D', 'tree_E', 'bush_A', 'bush_B', 'bush_C',
  'streetlight', 'trafficlight_A', 'bench', 'car_hatchback', 'car_police', 'car_sedan', 'car_stationwagon', 'car_taxi',
  'road_straight', 'road_junction', 'road_corner_curved', 'road_tsplit', 'road_straight_crossing',
  'park_base_decorated_trees', 'park_road_junction_decorated_A', 'park_road_junction_decorated_C',
  'watertower', 'firehydrant', 'trash_A', 'dumpster',
];
const KENNEY_COMMERCIAL = [
  'building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c', 'building-skyscraper-d', 'building-skyscraper-e',
  'building-a', 'building-c', 'building-g', 'building-k', 'building-n',
  ...'abcdefghijklmn'.split('').map((c) => `low-detail-building-${c}`),
  'low-detail-building-wide-a', 'low-detail-building-wide-b',
];
const KENNEY_SUBURBAN = [
  ...'abcdefghijklmnopqrstu'.split('').map((c) => `building-type-${c}`),
  'tree-large', 'tree-small', 'fence-2x2', 'planter',
];

export const ASSET_MANIFEST: readonly AssetManifestEntry[] = [
  ...KAYKIT.map((name): AssetManifestEntry => ({ name, pack: 'kaykit', path: `models/kaykit/${name}.gltf`, format: 'gltf' })),
  ...KENNEY_COMMERCIAL.map((name): AssetManifestEntry => ({ name, pack: 'kenney-commercial', path: `models/kenney-commercial/${name}.glb`, format: 'glb' })),
  ...KENNEY_SUBURBAN.map((name): AssetManifestEntry => ({ name, pack: 'kenney-suburban', path: `models/kenney-suburban/${name}.glb`, format: 'glb' })),
];

/** Kısa ad → `public/` altı yol */
export const ASSET_FILES: Readonly<Record<string, string>> = Object.fromEntries(ASSET_MANIFEST.map((e) => [e.name, e.path]));

/** Tarayıcıdan istenen tam adres (BASE_URL + yol). Hata günlüklerinde ve denetimde "tam dosya yolu" budur. */
export function assetUrl(name: string, base = '/'): string {
  const p = ASSET_FILES[name];
  return p ? `${base}${p}` : `${base}models/?bilinmeyen-model=${name}`;
}

/** Sınır kutusu boyutu kullanılabilir mi? (sonlu, her eksende sıfırdan büyük). Sorun yoksa null, varsa açıklama. */
export function boundsProblem(x: number, y: number, z: number): string | null {
  if (![x, y, z].every(Number.isFinite)) return `sınır kutusu NaN/sonsuz (${x}, ${y}, ${z})`;
  if (x <= 1e-6 || y <= 1e-6 || z <= 1e-6) return `sınır kutusu sıfır (${x}, ${y}, ${z})`;
  return null;
}
