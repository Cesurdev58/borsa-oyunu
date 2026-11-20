/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞEHİR IZGARASI — TEK KOORDİNAT KAYNAĞI
 *
 * Ana binaların yeri, bütün yollar (merkez caddeler, halka yollar, bağlantılar, Borsa giriş yolu), bölge zeminleri,
 * yaya yolları ve trafik rotaları yalnızca burada yazılır. `cityLayout.ts` (2D yerleşim ve veri) ile
 * `ThreeCityScene.ts` (3D sahne) buradan okur; aynı yolun iki yerde kopyası kalmaz.
 *
 * Birimler: ana yollar ve binalar "harita birimi" (1600×1200) ile yazılır; dünya birimine `wx` / `wz` çevirir
 * (1 harita birimi = 0,1 dünya birimi). Halka yollar doğrudan dünya birimindedir. `CITY_GRID.roads` her zaman
 * DÜNYA birimindedir (`x1,z1,x2,z2,width`), bu yüzden yerleşim denetimleri çevirme yapmaz.
 *
 * Bu dosya yalnızca veri ve saf hesap içerir; başka motoru ya da `three`'yi içe aktarmaz (döngü oluşmaz).
 */
import type { CityBuildingId } from '../gameTypes';
import { convexHull, convexOverlapDepth, rectPolygon, type Pt } from './cityGeometry';

// ---------------------------------------------------------------------------
// Ölçek
// ---------------------------------------------------------------------------
export const VIRTUAL_MAP_WIDTH = 1600;
export const VIRTUAL_MAP_HEIGHT = 1200;
export const VIRTUAL_MAP_CENTER_X = 800;
export const VIRTUAL_MAP_CENTER_Y = 600;

/** Harita birimi → dünya birimi */
export const CITY_WORLD_SCALE = 0.1;
export const wx = (mapX: number): number => (mapX - VIRTUAL_MAP_CENTER_X) * CITY_WORLD_SCALE;
export const wz = (mapY: number): number => (mapY - VIRTUAL_MAP_CENTER_Y) * CITY_WORLD_SCALE;

/** Ana bina ayak izi: harita birimi → dünya birimi (küçültme payıyla). Şehir blokları %5 büyük çizilir. */
export const CITY_CORE_FOOT = 0.085;
export const CITY_BLOCK_FOOT = 0.085 * 1.05;

// ---------------------------------------------------------------------------
// Ana binalar
// ---------------------------------------------------------------------------
export interface CityFootprintDef {
  /** Merkez (harita birimi) */
  x: number;
  y: number;
  /** Boyut (harita birimi) */
  width: number;
  height: number;
}

/**
 * 1600×1200 sanal şehir alanında 8 ana etkileşimli binanın yerleşimi.
 * Merkezde (800, 580) açık renkli Finans Meydanı ve park yer alır.
 *
 * Yerleşim, yolların asfaltına taşan parsel kalmayacak biçimde düzeltildi (QA: `cityGrid.test.ts`): eskiden Oyuncu Ofisi,
 * Şirket Merkezi, Banka, Fabrika, Ar-Ge ve Holding parselleri komşu caddeye 0,3–2,8 birim taşıyordu ve 3D sahnede
 * binalar yolu kesiyor ya da parçalı küçülüyordu. Eski → yeni: Haber y 275→265, Banka y 285→260, Oyuncu Ofisi x 305→340,
 * Şirket x 1275→1240, Fabrika y 940→1000 (yükseklik 195→155), Ar-Ge (805,965)→(795,1005) (yükseklik 185→165), Holding y 925→1025.
 */
export const CITY_BUILDING_COORDINATES: Record<CityBuildingId, CityFootprintDef> = {
  // SOL ÜST: Haber ve Ekonomi Merkezi
  HABER_MERKEZI: { x: 350, y: 265, width: 210, height: 185 },
  // ORTA ÜST: Borsa Binası
  BORSA: { x: 795, y: 215, width: 245, height: 205 },
  // SAĞ ÜST: Merkez Bankası ve Hazine
  BANKA: { x: 1245, y: 260, width: 225, height: 190 },
  // SOL ORTA: Oyuncu / Çalışan Ofisi (Ticaret Bölgesi)
  OYUNCU_OFISI: { x: 340, y: 605, width: 205, height: 180 },
  // SAĞ ORTA: Şirket Arsası veya Şirket Genel Merkezi (Teknoloji & Kurumsal Kampüs)
  SIRKET_MERKEZI: { x: 1240, y: 595, width: 230, height: 195 },
  // SOL ALT: Oyuncu Fabrikası (Sanayi Bölgesi)
  FABRIKA: { x: 365, y: 1000, width: 235, height: 155 },
  // ORTA ALT: Ar-Ge Merkezi (Teknoloji Bölgesi)
  ARGE_MERKEZI: { x: 795, y: 1005, width: 220, height: 165 },
  // SAĞ ALT: Holding Merkezi
  HOLDING_MERKEZI: { x: 1255, y: 1025, width: 235, height: 215 },
};

/** Parselin dünya birimindeki dikdörtgeni (merkez + yarım boyutlar). */
export interface WorldRect {
  cx: number;
  cz: number;
  hw: number;
  hd: number;
}

/** Bir ana binanın parseli (dünya birimi) */
export function coreParcel(id: CityBuildingId): WorldRect {
  const b = CITY_BUILDING_COORDINATES[id];
  return { cx: wx(b.x), cz: wz(b.y), hw: (b.width * CITY_CORE_FOOT) / 2, hd: (b.height * CITY_CORE_FOOT) / 2 };
}

/** Bir şehir bloğunun parseli (dünya birimi); bloklar `cityLayout`'taki x/y/width/height ile gelir. */
export function blockParcel(b: { x: number; y: number; width: number; height: number }): WorldRect {
  return { cx: wx(b.x), cz: wz(b.y), hw: (b.width * CITY_BLOCK_FOOT) / 2, hd: (b.height * CITY_BLOCK_FOOT) / 2 };
}

// ---------------------------------------------------------------------------
// Yollar
// ---------------------------------------------------------------------------
/**
 * STREET: merkez caddeler · RING: halka yollar · CONNECTOR: bağlantı ve çıkış yolları ·
 * DRIVEWAY: bir binanın girişine kadar gelen kısa yol (bina gövdesi üstüne binmez; yalnızca giriş noktasına yaklaşır).
 * Borsa'nın x=795 yolu ve Haber/Banka/Fabrika/Holding bağlantı yolları bu türdendir.
 */
export type CityRoadKind = 'STREET' | 'RING' | 'CONNECTOR' | 'DRIVEWAY';

export interface CityRoadSegment {
  id: string;
  kind: CityRoadKind;
  /** Uç noktalar, DÜNYA birimi */
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  /** Asfalt genişliği (dünya birimi) */
  width: number;
  /** DRIVEWAY: hizmet verdiği bina; (x2,z2) o binanın giriş noktasıdır */
  servesBuilding?: CityBuildingId;
}

/** Çizimde asfaltın iki yanına eklenen kaldırım payı (toplam genişlik = width + 2 × bu). */
export const ROAD_SIDEWALK_EXTRA = 0.8;
/**
 * Bina ile yol kenarı arasında bırakılacak en az boşluk (asfalt kenarından itibaren, dünya birimi).
 * Tercih edilen: 1,0; mutlak alt sınır: 0,5. Çözücü önce tercih edileni dener.
 */
export const ROAD_CLEARANCE_PREFERRED = 1.0;
export const ROAD_CLEARANCE_MINIMUM = 0.5;

/** Halka yollar (dünya birimi): merkezi saran iç ve dış halka. Aralarına mahalleler dizilir. */
export const RING1 = { x: 88, zN: -66, zS: 70 } as const;
export const RING2 = { x: 138, zN: -108, zS: 112 } as const;

interface MapRoad {
  id: string;
  kind: CityRoadKind;
  /** Harita birimi */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Dünya birimi */
  w: number;
}

// Eski yol çizgileriyle aynı koordinatlar (harita birimi); genişlik dünya birimidir.
const MAIN_ROADS: MapRoad[] = [
  { id: 'plaza-north', kind: 'STREET', x1: 510, y1: 380, x2: 1090, y2: 380, w: 5.6 },
  { id: 'plaza-east', kind: 'STREET', x1: 1090, y1: 380, x2: 1090, y2: 780, w: 5.6 },
  { id: 'plaza-south', kind: 'STREET', x1: 1090, y1: 780, x2: 510, y2: 780, w: 5.6 },
  { id: 'plaza-west', kind: 'STREET', x1: 510, y1: 780, x2: 510, y2: 380, w: 5.6 },
  { id: 'north-avenue', kind: 'STREET', x1: 210, y1: 380, x2: 1390, y2: 380, w: 5.2 },
  { id: 'haber-link', kind: 'CONNECTOR', x1: 355, y1: 320, x2: 535, y2: 415, w: 4.8 },
  { id: 'banka-link', kind: 'CONNECTOR', x1: 1240, y1: 330, x2: 1065, y2: 415, w: 4.8 },
  { id: 'west-avenue', kind: 'STREET', x1: 215, y1: 380, x2: 215, y2: 895, w: 4.6 },
  // Ticaret Merkezi bloğu (135,605) bu yolun tam üstündeydi; yol artık bloğun önünde biter (batı çıkış yolu)
  { id: 'west-exit', kind: 'CONNECTOR', x1: -80, y1: 605, x2: 30, y2: 605, w: 5 },
  { id: 'east-exit', kind: 'CONNECTOR', x1: 1375, y1: 595, x2: 1680, y2: 595, w: 5 },
  { id: 'east-avenue', kind: 'STREET', x1: 1375, y1: 380, x2: 1375, y2: 895, w: 4.6 },
  { id: 'south-avenue', kind: 'STREET', x1: 145, y1: 895, x2: 1465, y2: 895, w: 5.6 },
  { id: 'fabrika-link', kind: 'CONNECTOR', x1: 365, y1: 895, x2: 530, y2: 780, w: 4.8 },
  { id: 'arge-road', kind: 'CONNECTOR', x1: 925, y1: 1100, x2: 925, y2: 780, w: 4.8 },
  { id: 'holding-link', kind: 'CONNECTOR', x1: 1255, y1: 885, x2: 1070, y2: 780, w: 4.8 },
];

const RING_WIDTH = 5.2;
/** Halka yollar ve mahalleleri merkeze bağlayan çıkış yolları (dünya birimi). */
export const SUBURB_ROADS: readonly CityRoadSegment[] = [
  { id: 'ring1-north', kind: 'RING', x1: -RING1.x, z1: RING1.zN, x2: RING1.x, z2: RING1.zN, width: RING_WIDTH },
  { id: 'ring1-east', kind: 'RING', x1: RING1.x, z1: RING1.zN, x2: RING1.x, z2: RING1.zS, width: RING_WIDTH },
  { id: 'ring1-south', kind: 'RING', x1: RING1.x, z1: RING1.zS, x2: -RING1.x, z2: RING1.zS, width: RING_WIDTH },
  { id: 'ring1-west', kind: 'RING', x1: -RING1.x, z1: RING1.zS, x2: -RING1.x, z2: RING1.zN, width: RING_WIDTH },
  { id: 'ring2-north', kind: 'RING', x1: -RING2.x, z1: RING2.zN, x2: RING2.x, z2: RING2.zN, width: RING_WIDTH },
  { id: 'ring2-east', kind: 'RING', x1: RING2.x, z1: RING2.zN, x2: RING2.x, z2: RING2.zS, width: RING_WIDTH },
  { id: 'ring2-south', kind: 'RING', x1: RING2.x, z1: RING2.zS, x2: -RING2.x, z2: RING2.zS, width: RING_WIDTH },
  { id: 'ring2-west', kind: 'RING', x1: -RING2.x, z1: RING2.zS, x2: -RING2.x, z2: RING2.zN, width: RING_WIDTH },
  { id: 'suburb-nw', kind: 'CONNECTOR', x1: -RING2.x, z1: -22, x2: -59, z2: -22, width: 5 },
  { id: 'suburb-ne', kind: 'CONNECTOR', x1: 59, z1: -22, x2: RING2.x, z2: -22, width: 5 },
  { id: 'suburb-sw', kind: 'CONNECTOR', x1: -RING2.x, z1: 29.5, x2: -65.5, z2: 29.5, width: 5 },
  { id: 'suburb-se', kind: 'CONNECTOR', x1: 66.5, z1: 29.5, x2: RING2.x, z2: 29.5, width: 5 },
  { id: 'suburb-n', kind: 'CONNECTOR', x1: -0.5, z1: RING2.zN, x2: -0.5, z2: -52, width: 5 },
  { id: 'suburb-s', kind: 'CONNECTOR', x1: 12.5, z1: 50, x2: 12.5, z2: RING2.zS, width: 5 },
];

/** Halka yol ya da mahalle çıkış yolu mu? (merkez caddelerinden ayırmak için) */
export const isSuburbRoad = (r: CityRoadSegment): boolean => r.id.startsWith('ring') || r.id.startsWith('suburb');

/** Borsa giriş yolu genişliği (dünya birimi) */
const BORSA_DRIVEWAY_WIDTH = 5;

function mainRoadToWorld(r: MapRoad): CityRoadSegment {
  return { id: r.id, kind: r.kind, x1: wx(r.x1), z1: wz(r.y1), x2: wx(r.x2), z2: wz(r.y2), width: r.w };
}

/**
 * Bir bağlantı yolunun binanın parselinin içinden başlayan kısmını keser: yol artık binanın GİRİŞİNDE (parsel kenarında)
 * biter ve DRIVEWAY olur (yol parselin dışından başlıyorsa olduğu gibi kalır). Eskiden bu yollar binanın altından başlıyordu; bina yolun üstüne biniyor gibi görünüyor ve
 * yerleşim denetimi her seferinde binayı yoldan itmeye çalışıyordu. Giriş ucu (x2,z2) olacak şekilde yön çevrilir.
 */
function driveToEntrance(road: CityRoadSegment, building: CityBuildingId): CityRoadSegment {
  const p = coreParcel(building);
  const parcel = rectPolygon(p.cx, p.cz, p.hw, p.hd);
  const rectAt = (t: number): Pt[] => {
    const sx = road.x1 + (road.x2 - road.x1) * t;
    const sz = road.z1 + (road.z2 - road.z1) * t;
    const dx = road.x2 - sx;
    const dz = road.z2 - sz;
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * (road.width / 2);
    const nz = (dx / len) * (road.width / 2);
    return convexHull([
      { x: sx - nx, z: sz - nz }, { x: road.x2 - nx, z: road.z2 - nz },
      { x: road.x2 + nx, z: road.z2 + nz }, { x: sx + nx, z: sz + nz },
    ]);
  };
  let lo = 0;
  let hi = 1;
  // Yol zaten parselin dışından başlıyorsa (bina yoldan uzaklaştırıldı) giriş yolu değil, sıradan bağlantıdır
  if (convexOverlapDepth(rectAt(0), parcel) <= 1e-6) return road;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (convexOverlapDepth(rectAt(mid), parcel) <= 1e-6) hi = mid;
    else lo = mid;
  }
  const t = hi;
  return {
    ...road,
    kind: 'DRIVEWAY',
    servesBuilding: building,
    x1: road.x2,
    z1: road.z2,
    x2: road.x1 + (road.x2 - road.x1) * t,
    z2: road.z1 + (road.z2 - road.z1) * t,
  };
}

/** Binaların girişine bağlanan bağlantı yolları: yol id → hizmet verdiği bina */
const ENTRANCE_LINKS: Readonly<Record<string, CityBuildingId>> = {
  'haber-link': 'HABER_MERKEZI',
  'banka-link': 'BANKA',
  'fabrika-link': 'FABRIKA',
  'holding-link': 'HOLDING_MERKEZI',
};

/**
 * Borsa giriş yolu: Borsa'nın tam önünden (x=795) kuzey caddesine (y=380) iner. Yol, binanın ön kenarındaki
 * GİRİŞ NOKTASINDA biter; bina gövdesi yolun üstüne binmez, yalnızca bu uç noktaya yaklaşır.
 */
function borsaDriveway(): CityRoadSegment {
  const p = coreParcel('BORSA');
  const entranceZ = p.cz + p.hd; // ön yüz +z yönündedir
  return {
    id: 'borsa-driveway',
    kind: 'DRIVEWAY',
    x1: p.cx,
    z1: wz(380),
    x2: p.cx,
    z2: entranceZ,
    width: BORSA_DRIVEWAY_WIDTH,
    servesBuilding: 'BORSA',
  };
}

function mainRoad(r: MapRoad): CityRoadSegment {
  const w = mainRoadToWorld(r);
  const b = ENTRANCE_LINKS[r.id];
  return b ? driveToEntrance(w, b) : w;
}

/** Bütün yollar, dünya birimi. Tek kaynak: hem çizim hem yerleşim denetimi bunu okur. */
const ALL_ROADS: readonly CityRoadSegment[] = Object.freeze([
  ...MAIN_ROADS.slice(0, 5).map(mainRoad),
  borsaDriveway(),
  ...MAIN_ROADS.slice(5).map(mainRoad),
  ...SUBURB_ROADS,
]);

// ---------------------------------------------------------------------------
// Bölge zeminleri, yaya yolları, trafik rotaları
// ---------------------------------------------------------------------------
export interface CityZoneDef {
  /** Sol-üst köşe ve boyut (harita birimi) */
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

const ZONES: readonly CityZoneDef[] = [
  { x: 220, y: 105, w: 1150, h: 245, color: '#e9e4d6' },
  { x: 70, y: 410, w: 415, h: 375, color: '#e3d7c0' },
  { x: 1115, y: 410, w: 420, h: 375, color: '#94d26a' },
  { x: 75, y: 825, w: 545, h: 325, color: '#cfc7b8' },
  { x: 665, y: 825, w: 865, h: 325, color: '#9ed772' },
  { x: 65, y: 115, w: 135, h: 230, color: '#8ccf5c' },
  { x: 1395, y: 115, w: 140, h: 230, color: '#8ccf5c' },
];

/** Yaya yolları (dünya birimi): halka yolun dış ve iç kaldırımı, güney cadde kaldırımı. Kapalı halkalar başa döner. */
const WALK_PATHS: readonly (readonly [number, number][])[] = [
  [[-32.6, -25.6], [32.6, -25.6], [32.6, 21.6], [-32.6, 21.6], [-32.6, -25.6]],
  [[-25.4, -18.6], [25.4, -18.6], [25.4, 14.6], [-25.4, 14.6], [-25.4, -18.6]],
  [[-64, 26.4], [64, 26.4], [64, 32.7], [-64, 32.7], [-64, 26.4]],
];

/** Yayaların girip çıktığı binaların kapıları (dünya birimi): bina merkezi + ön yüz. */
const WALK_DOOR_BUILDINGS: readonly CityBuildingId[] = ['BORSA', 'BANKA', 'HABER_MERKEZI'];

export type CityGridRouteId =
  | 'FINANS_MEYDANI_ROTASI'
  | 'SANAYI_SIRKET_ROTASI'
  | 'TICARET_BULVARI_ROTASI'
  | 'KUZEY_GUNEY_ANAYOL_ROTASI';

export interface CityRouteKey {
  t: number;
  /** Harita birimi */
  x: number;
  y: number;
}

const ROUTES: Record<CityGridRouteId, readonly CityRouteKey[]> = {
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
    { t: 0.5, x: 215, y: 885 },
    { t: 1, x: 215, y: 385 },
  ],
  KUZEY_GUNEY_ANAYOL_ROTASI: [
    { t: 0, x: 380, y: 380 },
    { t: 0.5, x: 1220, y: 380 },
    { t: 1, x: 380, y: 380 },
  ],
};

function walkDoors(): [number, number][] {
  return WALK_DOOR_BUILDINGS.map((id) => {
    const p = coreParcel(id);
    // Eski formül: merkez + derinliğin %40'ı + 1,6 (kapı, binanın biraz önünde)
    return [p.cx, p.cz + p.hd * 0.8 + 1.6] as [number, number];
  });
}

// ---------------------------------------------------------------------------
// Ortak veri yapısı
// ---------------------------------------------------------------------------
export interface CityGridDefinition {
  scale: number;
  mapWidth: number;
  mapHeight: number;
  buildings: Record<CityBuildingId, CityFootprintDef>;
  /** Bütün yollar (dünya birimi) */
  roads: readonly CityRoadSegment[];
  rings: { inner: typeof RING1; outer: typeof RING2 };
  zones: readonly CityZoneDef[];
  walkPaths: readonly (readonly [number, number][])[];
  walkDoors: readonly [number, number][];
  routes: Record<CityGridRouteId, readonly CityRouteKey[]>;
}

export const CITY_GRID: CityGridDefinition = {
  scale: CITY_WORLD_SCALE,
  mapWidth: VIRTUAL_MAP_WIDTH,
  mapHeight: VIRTUAL_MAP_HEIGHT,
  buildings: CITY_BUILDING_COORDINATES,
  roads: ALL_ROADS,
  rings: { inner: RING1, outer: RING2 },
  zones: ZONES,
  walkPaths: WALK_PATHS,
  walkDoors: walkDoors(),
  routes: ROUTES,
};

/** Halka yollarda dolaşan arabaların rotaları (dünya birimi), kapalı halkalar. */
export const AMBIENT_LOOPS: readonly (readonly [number, number][])[] = [
  [[-RING1.x, RING1.zN], [RING1.x, RING1.zN], [RING1.x, RING1.zS], [-RING1.x, RING1.zS], [-RING1.x, RING1.zN]],
  [[-RING2.x, RING2.zN], [RING2.x, RING2.zN], [RING2.x, RING2.zS], [-RING2.x, RING2.zS], [-RING2.x, RING2.zN]],
];

/** Yolun bir uç noktasının (x,z) dünya konumu için en yakın yol parçasına uzaklık (asfalt kenarına göre değil, merkez çizgisine). */
export function distanceToRoadCenterline(x: number, z: number, r: CityRoadSegment): number {
  const dx = r.x2 - r.x1;
  const dz = r.z2 - r.z1;
  const L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (z - r.z1) * dz) / L2));
  return Math.hypot(x - (r.x1 + dx * t), z - (r.z1 + dz * t));
}

/** (x,z) noktası herhangi bir yolun asfaltının (+ `margin`) üstünde mi? Ağaç, lamba, mahalle yerleşimi bunu kullanır. */
export function isOnRoad(x: number, z: number, margin = 0, roads: readonly CityRoadSegment[] = CITY_GRID.roads): boolean {
  return roads.some((r) => distanceToRoadCenterline(x, z, r) < r.width / 2 + margin);
}
