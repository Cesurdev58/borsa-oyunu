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
import { isGlowMaterial, markSharedMaterial, markSharedResource, markWindowGlowMaterial } from './kit';
import { ASSET_FILES, assetUrl, boundsProblem } from './assetManifest';
import { makeFallbackModel } from './assetFallback';

const BASE: string = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

/** Kısa ad → dosya yolu (public/models altına göre). Liste `assetManifest.ts` içindedir (denetim de oradan okur). */
const FILES: Record<string, string> = { ...ASSET_FILES };

export type AssetName = keyof typeof FILES & string;

export interface AssetFailure {
  name: string;
  /** Oyunun istediği tam adres (BASE_URL + yol); günlükte ve denetimde görünen budur */
  url: string;
  reason: string;
}

export interface CityAssets {
  /** Gerçek (yüklenmiş ve geçerli) model var mı? Yedek model için `true` DÖNMEZ: eski kodla çizilmiş binalar yedeğe tercih edilir. */
  has(name: string): boolean;
  /**
   * Modelin kopyası (geometri ve malzeme paylaşılır). Model yüklenememişse boş grup DEĞİL, adına uygun
   * (ağaç, ev, araba…) kodla çizilmiş yedek döner; böylece hiçbir şey haritadan sessizce kaybolmaz.
   */
  clone(name: string): THREE.Group;
  size(name: string): THREE.Vector3;
  /** Yüklenemeyen ya da geçersiz çıkan modeller (ad → ayrıntı) */
  failures(): ReadonlyMap<string, AssetFailure>;
  /** Bu ad için yedek model mi kullanılıyor? */
  isFallback(name: string): boolean;
}

interface Entry {
  scene: THREE.Group;
  size: THREE.Vector3;
}

/** Yükleyici sözleşmesi (testlerde sahte yükleyici verilebilir). */
export interface AssetLoaderLike {
  load(url: string, onLoad: (gltf: { scene: THREE.Group }) => void, onProgress?: unknown, onError?: (err: unknown) => void): void;
}

export interface LoadCityAssetsOptions {
  loader?: AssetLoaderLike;
  base?: string;
  /** Hata günlüğü (varsayılan: console.error) */
  log?: (message: string) => void;
  /** Önbelleği yok sayıp yeniden yükle (testler için) */
  fresh?: boolean;
  /** Yalnızca bu adları yükle (testler için; varsayılan: bütün liste) */
  only?: readonly string[];
}

/** Sınır kutusu kullanılabilir mi? (sonlu, sıfır olmayan genişlik ve yükseklik) */
export function validateBounds(size: THREE.Vector3): string | null {
  return boundsProblem(size.x, size.y, size.z);
}

/** Paket (klasör) + malzeme adı → ortak malzeme. Her dosya aynı dokuyu ayrı kopya olarak getirir;
 *  ortak malzemeye bağlayınca birleştirme bir paketin bütün parçalarını tek çizimde toplayabilir. */
const SHARED_MATS = new Map<string, THREE.Material>();

// ---------- Gece yanan pencereler (hazır modeller) ----------
// Hazır paketler renk kartelası dokusu kullanır: her renk dokuda bir kutudur. Binaların camı belli kutulardan
// gelir; o kutular beyaz, gerisi siyah bir ışık haritası (emissiveMap) üretilir. Gece `setWindowGlow` ile yanar.
// Kutular dokunun ızgarasıyla (sütun, satır; satır 0 = dokunun üstü) verilir. Ekran görüntüsüyle bulundu:
// KayKit'te pencere çerçeveleri (1,0) kutusundadır (camın kendisi dokusuz, karanlık); çerçeve yanınca pencere yanmış
// görünür. Kenney paketlerinde cam açık mavi (10–11, 2–3) kutulardır. Kenney "low-detail" binalarda cam yoktur.
const GLASS_CELLS: Record<string, { cols: number; rows: number; cells: Array<[number, number]> }> = {
  kaykit: { cols: 8, rows: 4, cells: [[1, 0]] },
  'kenney-commercial': { cols: 16, rows: 8, cells: [[10, 2], [10, 3], [11, 2], [11, 3]] },
  'kenney-suburban': { cols: 16, rows: 8, cells: [[10, 2], [10, 3], [11, 2], [11, 3]] },
};

/** Pencereleri gece yanacak modeller: binalar (ağaç, araba, yol parçası değil) */
function isBuildingFile(file: string): boolean {
  return /^(building|low-detail-building)/.test(file);
}

const glowMapCache = new Map<string, THREE.Texture | null>();

function glassGlowMap(kit: string, map: THREE.Texture | null | undefined): THREE.Texture | null {
  const spec = GLASS_CELLS[kit];
  const img = map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!spec || !img || !img.width || typeof document === 'undefined') return null;
  const key = `${kit}:${map!.uuid}`;
  if (glowMapCache.has(key)) return glowMapCache.get(key)!;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  const cw = c.width / spec.cols;
  const ch = c.height / spec.rows;
  for (const [col, row] of spec.cells) {
    // Kenarlardan biraz içeride çiz: komşu renge taşmasın
    g.fillStyle = '#fff';
    g.fillRect(col * cw + 1, row * ch + 1, cw - 2, ch - 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = map!.flipY;
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  markSharedResource(tex);
  glowMapCache.set(key, tex);
  return tex;
}

function prepare(root: THREE.Object3D, kit: string, file: string): void {
  const building = isBuildingFile(file);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    if (!Array.isArray(m.material)) {
      // Binalar aynı dokunun "gece yanan pencereli" kopyasını paylaşır (araba ve ağaçlar yanmaz)
      const key = `${kit}:${m.material.name}${building ? ':glow' : ''}`;
      const shared = SHARED_MATS.get(key);
      if (shared) {
        m.material.dispose();
        m.material = shared;
        markSharedResource(m.geometry);
        return;
      }
      if (building) {
        const sm = m.material as THREE.MeshStandardMaterial;
        const gm = glassGlowMap(kit, sm.map);
        if (gm) {
          sm.emissiveMap = gm;
          sm.emissive = new THREE.Color('#ffd58a');
          sm.emissiveIntensity = 0;
          markWindowGlowMaterial(sm);
        }
      }
      SHARED_MATS.set(key, m.material);
    }
    markSharedResource(m.geometry);
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (sm.map) {
        sm.map.colorSpace = THREE.SRGBColorSpace;
        sm.map.anisotropy = 4;
      }
      markSharedMaterial(sm);
      // Hazır paketler parlak plastik gibi görünmesin: mat, sıcak "oyun" yüzeyi
      sm.roughness = Math.max(sm.roughness ?? 1, 0.75);
      sm.metalness = 0;
    }
  });
}

let loading: Promise<CityAssets> | null = null;

/** Modeli doğrular; yüklenemeyen ya da geçersiz çıkanlar yedek modele döner ve TAM dosya yoluyla günlüğe yazılır. */
function buildLibrary(
  results: Array<{ name: string; url: string; scene: THREE.Group | null; error?: string }>,
  log: (m: string) => void
): CityAssets {
  const lib = new Map<string, Entry>();
  const failed = new Map<string, AssetFailure>();
  const fallbackSize = new Map<string, THREE.Vector3>();
  for (const r of results) {
    let reason: string | null = r.scene ? null : (r.error ?? 'bilinmeyen hata');
    let size: THREE.Vector3 | null = null;
    if (r.scene) {
      const bb = new THREE.Box3().setFromObject(r.scene);
      size = bb.getSize(new THREE.Vector3());
      reason = validateBounds(size);
    }
    if (!reason && r.scene && size) {
      lib.set(r.name, { scene: r.scene, size });
    } else {
      failed.set(r.name, { name: r.name, url: r.url, reason: reason ?? 'bilinmeyen hata' });
      log(`[city3d] Model kullanılamıyor: ${r.url} — ${reason}. Yedek (${r.name} için kodla çizilmiş) model gösterilecek.`);
    }
  }
  const fallbackFor = (n: string) => {
    let sz = fallbackSize.get(n);
    if (!sz) {
      sz = new THREE.Box3().setFromObject(makeFallbackModel(n)).getSize(new THREE.Vector3());
      fallbackSize.set(n, sz);
    }
    return sz;
  };
  return {
    has: (n) => lib.has(n),
    clone: (n) => {
      const e = lib.get(n);
      if (e) return e.scene.clone(true) as THREE.Group;
      // Listede olmayan ya da yüklenemeyen ad: boş grup değil, adına uygun yedek
      return makeFallbackModel(n);
    },
    size: (n) => (lib.get(n)?.size.clone() ?? fallbackFor(n).clone()),
    failures: () => failed,
    isFallback: (n) => !lib.has(n),
  };
}

/** Bütün şehir modellerini bir kez yükler (sonraki çağrılar aynı sözü döndürür). */
export function loadCityAssets(options: LoadCityAssetsOptions = {}): Promise<CityAssets> {
  if (loading && !options.fresh) return loading;
  const loader: AssetLoaderLike = options.loader ?? (new GLTFLoader() as unknown as AssetLoaderLike);
  const base = options.base ?? BASE;
  const log = options.log ?? ((m: string) => console.error(m));
  const names = options.only ?? Object.keys(FILES);
  const p = Promise.all(
    names.map(
      (name) =>
        new Promise<{ name: string; url: string; scene: THREE.Group | null; error?: string }>((resolve) => {
          const path = FILES[name];
          const url = assetUrl(name, base);
          if (!path) {
            resolve({ name, url, scene: null, error: 'model listede (assetManifest.ts) yok' });
            return;
          }
          try {
            loader.load(
              url,
              (gltf) => {
                try {
                  prepare(gltf.scene, path.split('/')[1], name);
                  resolve({ name, url, scene: gltf.scene });
                } catch (err) {
                  resolve({ name, url, scene: null, error: `işlenemedi: ${String((err as Error)?.message ?? err)}` });
                }
              },
              undefined,
              (err) => resolve({ name, url, scene: null, error: `yüklenemedi: ${String((err as Error)?.message ?? err)}` })
            );
          } catch (err) {
            resolve({ name, url, scene: null, error: `yükleyici hata verdi: ${String((err as Error)?.message ?? err)}` });
          }
        })
    )
  ).then((results) => buildLibrary(results, log));
  if (!options.fresh) loading = p;
  return p;
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
  const multi: THREE.Mesh[] = [];
  for (const root of objects) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (Array.isArray(m.material)) {
        multi.push(m);
        return;
      }
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
  // Çok malzemeli parçalar birleştirilmeden, dünya konumunda eklenir
  for (const m of multi) {
    const c = new THREE.Mesh(m.geometry, m.material);
    m.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    c.castShadow = castShadow;
    c.receiveShadow = true;
    out.add(c);
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
    const m = o as THREE.Mesh;
    // Çok malzemeli parçalar (ör. yüzleri farklı dokulu bina gövdesi) birleştirilemez: olduğu gibi kalır.
    // Eskiden atlanıyordu; Ar-Ge, laboratuvar gibi binaların gövdesi görünmüyordu.
    if (o !== root && (keep(o) || (m.isMesh && Array.isArray(m.material)))) {
      kept.push(o);
      return;
    }
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
