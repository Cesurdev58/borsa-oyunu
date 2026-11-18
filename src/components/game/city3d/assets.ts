/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hazır 3D modeller (CC0): KayKit City Builder Bits, Kenney City Kit (Commercial / Suburban).
 * Dosyalar `public/models/` altında (kaynak ve lisans: `public/models/CREDITS.txt`).
 *
 * Modeller şehir sekmesi açılınca bir kez, arka planda yüklenir. Yüklenene kadar sahne eski
 * kodla çizilmiş binaları gösterir; yüklenince binalar hazır modellerle yeniden kurulur.
 * Her paket tek doku kullanır; bu yüzden durağan dekorlar (banliyö evleri, ağaçlar) paket başına
 * tek parçada birleştirilir (`mergeStatic`), telefonda çizim yükü düşük kalır.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { isGlowMaterial } from './kit';

const BASE: string = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

/** Kısa ad → dosya yolu (public/models altına göre) */
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

const FILES: Record<string, string> = {};
for (const n of KAYKIT) FILES[n] = `models/kaykit/${n}.gltf`;
for (const n of KENNEY_COMMERCIAL) FILES[n] = `models/kenney-commercial/${n}.glb`;
for (const n of KENNEY_SUBURBAN) FILES[n] = `models/kenney-suburban/${n}.glb`;

export type AssetName = keyof typeof FILES & string;

export interface CityAssets {
  has(name: string): boolean;
  /** Modelin kopyası (geometri ve malzeme paylaşılır). Boyutu: `size(name)` */
  clone(name: string): THREE.Group;
  size(name: string): THREE.Vector3;
}

interface Entry {
  scene: THREE.Group;
  size: THREE.Vector3;
}

/** Paket (klasör) + malzeme adı → ortak malzeme. Her dosya aynı dokuyu ayrı kopya olarak getirir;
 *  ortak malzemeye bağlayınca birleştirme bir paketin bütün parçalarını tek çizimde toplayabilir. */
const SHARED_MATS = new Map<string, THREE.Material>();

function prepare(root: THREE.Object3D, kit: string): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    if (!Array.isArray(m.material)) {
      const key = `${kit}:${m.material.name}`;
      const shared = SHARED_MATS.get(key);
      if (shared) {
        m.material.dispose();
        m.material = shared;
        return;
      }
      SHARED_MATS.set(key, m.material);
    }
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (sm.map) {
        sm.map.colorSpace = THREE.SRGBColorSpace;
        sm.map.anisotropy = 4;
      }
      // Hazır paketler parlak plastik gibi görünmesin: mat, sıcak "oyun" yüzeyi
      sm.roughness = Math.max(sm.roughness ?? 1, 0.75);
      sm.metalness = 0;
    }
  });
}

let loading: Promise<CityAssets> | null = null;

/** Bütün şehir modellerini bir kez yükler (sonraki çağrılar aynı sözü döndürür). */
export function loadCityAssets(): Promise<CityAssets> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  const lib = new Map<string, Entry>();
  loading = Promise.all(
    Object.entries(FILES).map(
      ([name, path]) =>
        new Promise<void>((resolve) => {
          loader.load(
            `${BASE}${path}`,
            (gltf) => {
              const scene = gltf.scene;
              prepare(scene, path.split('/')[1]);
              const bb = new THREE.Box3().setFromObject(scene);
              lib.set(name, { scene, size: bb.getSize(new THREE.Vector3()) });
              resolve();
            },
            undefined,
            () => resolve() // eksik model: o parça eski çizimle kalır
          );
        })
    )
  ).then(() => ({
    has: (n: string) => lib.has(n),
    clone: (n: string) => {
      const e = lib.get(n);
      return e ? (e.scene.clone(true) as THREE.Group) : new THREE.Group();
    },
    size: (n: string) => (lib.get(n)?.size.clone() ?? new THREE.Vector3(1, 1, 1)),
  }));
  return loading;
}

/**
 * Modeli verilen taban genişliğine sığacak şekilde büyütür, tabanını y=0'a oturtur ve ortalar.
 * `heightScale` yalnızca yüksekliği ayrıca çarpar (dükkân seviyesi yükseldikçe bina uzar).
 */
export function fitModel(assets: CityAssets, name: string, footprint: number, heightScale = 1, rotY = 0): THREE.Group {
  const model = assets.clone(name);
  const sz = assets.size(name);
  const s = footprint / Math.max(sz.x, sz.z, 0.001);
  const holder = new THREE.Group();
  model.scale.set(s, s * heightScale, s);
  const bb = new THREE.Box3().setFromObject(model);
  const c = bb.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -bb.min.y, -c.z);
  holder.add(model);
  holder.rotation.y = rotY;
  return holder;
}

/**
 * Durağan nesneleri (ev, ağaç, yol parçası…) malzemeye göre gruplayıp her malzeme için tek ağ yapar.
 * Hepsi aynı doku atlasını kullandığı için bir paketin yüzlerce parçası tek çizim çağrısı olur.
 * `chunk` verilirse nesneler konumlarına göre kare bölgelere ayrılır; her bölge ayrı birleştirilir,
 * böylece ekran dışında kalan bölgeler hiç çizilmez (telefonda büyük kazanç).
 */
export function mergeStatic(objects: THREE.Object3D[], castShadow = true, chunk = 0): THREE.Group {
  const out = new THREE.Group();
  if (chunk > 0) {
    const cells = new Map<string, THREE.Object3D[]>();
    for (const o of objects) {
      const k = `${Math.floor(o.position.x / chunk)}:${Math.floor(o.position.z / chunk)}`;
      const list = cells.get(k) ?? [];
      list.push(o);
      cells.set(k, list);
    }
    for (const list of cells.values()) out.add(mergeStatic(list, castShadow, 0));
    return out;
  }
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const root of objects) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      for (const key of Object.keys(g.attributes)) {
        if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
      }
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      // Hepsi dizinli olsun (köşe paylaşımı korunur, birleştirme dizinli yapılır)
      if (!g.index) {
        const n = g.attributes.position.count;
        const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
        for (let i = 0; i < n; i++) idx[i] = i;
        g.setIndex(new THREE.BufferAttribute(idx, 1));
      }
      const list = byMat.get(m.material) ?? [];
      list.push(g);
      byMat.set(m.material, list);
    });
  }
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    out.add(mesh);
  }
  return out;
}

function lookKey(m: THREE.Material): string {
  // Gece yanan pencere/lamba malzemeleri ışık ayarı için kendi kimliğiyle kalır
  if (isGlowMaterial(m)) return `glow:${m.uuid}`;
  const sm = m as THREE.MeshStandardMaterial & { color?: THREE.Color; emissive?: THREE.Color };
  return [
    m.type,
    sm.color?.getHexString() ?? '',
    sm.map?.uuid ?? '',
    sm.emissive?.getHexString() ?? '',
    sm.emissiveIntensity ?? '',
    sm.emissiveMap?.uuid ?? '',
    sm.alphaMap?.uuid ?? '',
    m.transparent ? `t${m.opacity}` : '',
    sm.metalness ?? '',
    sm.roughness ?? '',
    sm.flatShading ? 'f' : '',
    m.side,
    m.depthWrite ? '' : 'nd',
  ].join('|');
}

/**
 * Bir model ağacındaki parçaları görünüşe (renk, doku, saydamlık…) göre birleştirir: kodla çizilmiş
 * binalarda her kutu ayrı malzemeyle gelir, birleştirince çizim çağrısı onlarcadan birkaça iner.
 * `keep` doğru dönen nesneler (canlandırılan duman, ışık havuzu, tabela vb.) olduğu gibi bırakılır.
 */
export function mergeByLook(root: THREE.Object3D, keep: (o: THREE.Object3D) => boolean = () => false): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; shadow: boolean }>();
  const kept: THREE.Object3D[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o !== root && keep(o)) {
      kept.push(o);
      return;
    }
    const m = o as THREE.Mesh;
    if (m.isMesh && !Array.isArray(m.material) && m.visible) {
      const g = m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      for (const key of Object.keys(g.attributes)) {
        if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
      }
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      const ng = g.index ? g.toNonIndexed() : g;
      const k = lookKey(m.material) + (m.castShadow ? 's' : '');
      const e = groups.get(k) ?? { mat: m.material, geos: [], shadow: m.castShadow };
      e.geos.push(ng);
      groups.set(k, e);
    }
    o.children.forEach(visit);
  };
  visit(root);
  const out = new THREE.Group();
  out.position.copy(root.position);
  out.rotation.copy(root.rotation);
  out.scale.copy(root.scale);
  for (const { mat, geos, shadow } of groups.values()) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  for (const k of kept) {
    // Kalan nesneyi aynı yerde tut (kökün yerel uzayına taşı)
    const mw = new THREE.Matrix4().multiplyMatrices(inv, k.matrixWorld);
    k.removeFromParent();
    mw.decompose(k.position, k.quaternion, k.scale);
    out.add(k);
  }
  return out;
}
