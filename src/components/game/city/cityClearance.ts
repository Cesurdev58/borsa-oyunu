/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BİNA – YOL BOŞLUĞU (saf geometri, `three` yok)
 *
 * Eskiden `fitClearOfRoads` her yolu 48 noktaya bölüp en yakın noktaya bakıyordu: nokta örneklemesi köşe ve
 * kenar çakışmalarını kaçırıyor, yolun uç yuvarlağını ve çapraz yolları kötü ölçüyordu. Burada:
 *  - Bina ayak izi dışbükey çokgendir (modelin parçalarının sınır kutularından, dönmüş olsa da doğru çıkar).
 *  - Normal yol: asfalt = yol ekseni etrafında `width/2` yarıçaplı hap (capsule); çokgenle eksen çizgisi arasındaki
 *    GERÇEK mesafe (kesişim = 0) hesaplanır. Boşluk = mesafe − width/2.
 *  - DRIVEWAY: uçlardan biri binanın GİRİŞ NOKTASIDIR; yol orada düz biter (hap yoktur), bina yalnızca bu uca
 *    değebilir, yan taraflarda yine boşluk ister.
 *  - Çözücü (`fitFootprint`): önce olduğu gibi dener; olmazsa parselin içinde kalarak kaydırır, gerekirse küçültür.
 *    Önce tercih edilen kaldırım boşluğu (1,0), olmazsa mutlak alt sınır (0,5) kullanılır.
 */
import {
  convexHull,
  convexOverlapDepth,
  polygonSegmentDistance,
  type Pt,
} from './cityGeometry';
import {
  CITY_GRID,
  ROAD_CLEARANCE_MINIMUM,
  ROAD_CLEARANCE_PREFERRED,
  type CityRoadSegment,
  type WorldRect,
} from './CityGridDefinition';

export { convexHull, convexOverlapDepth, pointInConvex, polygonSegmentDistance, type Pt } from './cityGeometry';

// ---------------------------------------------------------------------------
// Yol boşluğu
// ---------------------------------------------------------------------------

/** Yolun düz uçlu dikdörtgeni (yan taraflara `lateral` kadar genişletilmiş), saat yönünün tersi. */
function roadRect(r: CityRoadSegment, lateral: number): Pt[] {
  const dx = r.x2 - r.x1;
  const dz = r.z2 - r.z1;
  const len = Math.hypot(dx, dz) || 1;
  const nx = (-dz / len) * (r.width / 2 + lateral);
  const nz = (dx / len) * (r.width / 2 + lateral);
  const rect = [
    { x: r.x1 - nx, z: r.z1 - nz },
    { x: r.x2 - nx, z: r.z2 - nz },
    { x: r.x2 + nx, z: r.z2 + nz },
    { x: r.x1 + nx, z: r.z1 + nz },
  ];
  return convexHull(rect);
}

export interface RoadClearance {
  roadId: string;
  /** Çokgenin asfalt kenarına en yakın uzaklığı; negatifse yolun üstündedir. DRIVEWAY için: 0 = giriş ucuna değiyor. */
  gap: number;
  /** Gerekli boşluğun ne kadarı eksik (0 = yeterli). */
  violation: number;
}

/**
 * Bir ayak izinin bir yola göre boşluğu. `margin` asfalt kenarından itibaren istenen en az kaldırım boşluğudur.
 * DRIVEWAY'de yolun giriş ucu (x2,z2) düzdür: bina o uca değebilir ama yolun üstüne binemez ve yan boşluk ister.
 */
export function roadClearance(poly: readonly Pt[], road: CityRoadSegment, margin: number): RoadClearance {
  if (road.kind === 'DRIVEWAY') {
    const rect = roadRect(road, margin);
    const depth = convexOverlapDepth(poly, rect);
    if (depth > 0) return { roadId: road.id, gap: -depth, violation: depth };
    return { roadId: road.id, gap: 0, violation: 0 };
  }
  const d = polygonSegmentDistance(poly, { x: road.x1, z: road.z1 }, { x: road.x2, z: road.z2 });
  const gap = d - road.width / 2;
  return { roadId: road.id, gap, violation: Math.max(0, margin - gap) };
}

/** Ayak izinin bütün yollara göre en kötü durumu (QA ve çözücü bunu kullanır). */
export function worstRoadClearance(
  poly: readonly Pt[],
  margin: number,
  roads: readonly CityRoadSegment[] = CITY_GRID.roads
): RoadClearance | null {
  let worst: RoadClearance | null = null;
  for (const r of roads) {
    const c = roadClearance(poly, r, margin);
    if (!worst || c.violation > worst.violation || (c.violation === worst.violation && c.gap < worst.gap)) worst = c;
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Yapılabilir alan
// ---------------------------------------------------------------------------

/**
 * Parselin YOLLARDAN ARINDIRILMIŞ hâli. Oyun verisindeki bazı parseller (özellikle ana binalar ve şehir blokları)
 * komşu caddenin asfaltına birkaç birim taşar; bina parselin tamamını doldurursa yolu keser. Burada eksene paralel
 * (yatay/dikey) her yol için parselin o yandaki kenarı yolun kenarı + boşluk kadar içeri çekilir. Eğik yollar ve
 * DRIVEWAY'ler çözücüde (SAT) ayrıca denetlenir. Yolun uçları parselin içinde bitiyorsa (mahalle çıkış yolları gibi)
 * yalnızca o uç kadar uzunluk sayılır.
 */
export function buildableArea(
  parcel: WorldRect,
  margin: number,
  roads: readonly CityRoadSegment[] = CITY_GRID.roads
): WorldRect {
  let left = parcel.cx - parcel.hw;
  let right = parcel.cx + parcel.hw;
  let top = parcel.cz - parcel.hd;
  let bottom = parcel.cz + parcel.hd;
  const EDGE = 1e-6;
  for (const r of roads) {
    if (r.kind === 'DRIVEWAY') continue;
    const half = r.width / 2 + margin;
    const vertical = Math.abs(r.x1 - r.x2) < 1e-9;
    const horizontal = Math.abs(r.z1 - r.z2) < 1e-9;
    if (vertical) {
      const rx = r.x1;
      const zLo = Math.min(r.z1, r.z2);
      const zHi = Math.max(r.z1, r.z2);
      if (zHi <= top + EDGE || zLo >= bottom - EDGE) continue; // yol parselin z aralığına girmiyor
      if (rx + half <= left + EDGE || rx - half >= right - EDGE) continue; // yol parselin dışında
      // Merkezin hangi yanındaysa o kenar içeri çekilir; yol merkezdeyse geniş kalan taraf seçilir
      const mid = (left + right) / 2;
      const keepLeft = rx - half - left; // yolun solunda kalan genişlik
      const keepRight = right - (rx + half); // yolun sağında kalan genişlik
      if (rx < mid) left = Math.max(left, rx + half);
      else if (rx > mid) right = Math.min(right, rx - half);
      else if (keepRight >= keepLeft) left = Math.max(left, rx + half);
      else right = Math.min(right, rx - half);
    } else if (horizontal) {
      const rz = r.z1;
      const xLo = Math.min(r.x1, r.x2);
      const xHi = Math.max(r.x1, r.x2);
      if (xHi <= left + EDGE || xLo >= right - EDGE) continue;
      if (rz + half <= top + EDGE || rz - half >= bottom - EDGE) continue;
      const mid = (top + bottom) / 2;
      const keepTop = rz - half - top;
      const keepBottom = bottom - (rz + half);
      if (rz < mid) top = Math.max(top, rz + half);
      else if (rz > mid) bottom = Math.min(bottom, rz - half);
      else if (keepBottom >= keepTop) top = Math.max(top, rz + half);
      else bottom = Math.min(bottom, rz - half);
    }
  }
  // Yollar parseli neredeyse yok edecekse (veri hatası) özgün parsel kalır; çözücü o zaman en az kötüyü seçer
  if (right - left < 2 || bottom - top < 2) return parcel;
  return { cx: (left + right) / 2, cz: (top + bottom) / 2, hw: (right - left) / 2, hd: (bottom - top) / 2 };
}

// ---------------------------------------------------------------------------
// Çözücü
// ---------------------------------------------------------------------------

export interface FitOptions {
  /** Yol boşlukları denenirken sırayla kullanılır (önce tercih edilen, sonra mutlak alt sınır). */
  margins?: readonly number[];
  /** Parsel dışına taşmaya izin verilen pay (çit direği, tabela gibi ince taşmalar için). */
  parcelTolerance?: number;
  /** En küçük ölçek (1 = olduğu gibi). */
  minScale?: number;
  /** Aranacak ölçek adımı. */
  scaleStep?: number;
  /** Her eksende denenecek kaydırma adedi (tek sayı). */
  gridSteps?: number;
  roads?: readonly CityRoadSegment[];
}

export interface FitResult {
  /** Parsel merkezine göre kaydırma (dünya birimi) */
  dx: number;
  dz: number;
  /** Ölçek çarpanı (1 = değişmedi) */
  scale: number;
  /** Kullanılan kaldırım boşluğu */
  margin: number;
  /** Bütün yollardan istenen boşlukta ve parsel içinde mi? */
  ok: boolean;
  withinParcel: boolean;
  /** Çözümün en yakın yoldan boşluğu (DRIVEWAY'de 0) */
  minGap: number;
  /** Çözüm bulunamadıysa en az kötü aday döner (ok=false) */
  bestEffort: boolean;
}

function transform(poly: readonly Pt[], scale: number, dx: number, dz: number): Pt[] {
  return poly.map((p) => ({ x: p.x * scale + dx, z: p.z * scale + dz }));
}

function boundsOf(poly: readonly Pt[]) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ };
}

/** Ayak izi parselin içinde mi? (`hull` parsel merkezine göre değil, dünya koordinatındadır) */
export function insideParcel(poly: readonly Pt[], parcel: WorldRect, tolerance: number): boolean {
  const b = boundsOf(poly);
  return (
    b.minX >= parcel.cx - parcel.hw - tolerance - 1e-9 &&
    b.maxX <= parcel.cx + parcel.hw + tolerance + 1e-9 &&
    b.minZ >= parcel.cz - parcel.hd - tolerance - 1e-9 &&
    b.maxZ <= parcel.cz + parcel.hd + tolerance + 1e-9
  );
}

/**
 * Bir binanın ayak izini (`hull`, DÜNYA koordinatı, ölçek 1 ve kaydırma 0'da) parselin içinde kalarak yollardan
 * uzaklaştırır. Önce olduğu gibi dener, sonra kaydırır, sonra küçültür; en az kaydırma ve en az küçültme kazanır.
 */
export function fitFootprint(hull: readonly Pt[], parcel: WorldRect, options: FitOptions = {}): FitResult {
  const margins = options.margins ?? [ROAD_CLEARANCE_PREFERRED, ROAD_CLEARANCE_MINIMUM];
  const tol = options.parcelTolerance ?? 0.3;
  const minScale = options.minScale ?? 0.5;
  const step = options.scaleStep ?? 0.02;
  const n = options.gridSteps ?? 17;
  const roads = options.roads ?? CITY_GRID.roads;
  // Parselin yollara taşan kısmı çıkarılır; bina bu "yapılabilir alan" içinde kalır
  const nominal = parcel;
  parcel = buildableArea(nominal, margins[margins.length - 1], roads);
  const origin = { x: nominal.cx, z: nominal.cz };
  // Ölçek, parsel (varlık) merkezine göre uygulanır: hull'u merkeze göre yeniden ifade et
  const rel = hull.map((p) => ({ x: p.x - origin.x, z: p.z - origin.z }));
  const abs = (poly: readonly Pt[]) => poly.map((p) => ({ x: p.x + origin.x, z: p.z + origin.z }));

  // Parsele sığmayan ayak izi için başlangıç ölçeği
  const b0 = boundsOf(rel);
  const widthX = b0.maxX - b0.minX;
  const widthZ = b0.maxZ - b0.minZ;
  const startScale = Math.min(1, (2 * parcel.hw + 2 * tol) / Math.max(widthX, 1e-6), (2 * parcel.hd + 2 * tol) / Math.max(widthZ, 1e-6));

  // Yalnızca parsele yakın yollar önemlidir
  const reach = Math.max(parcel.hw, parcel.hd) * 2 + 8;
  const near = roads.filter((r) => {
    const minX = Math.min(r.x1, r.x2) - r.width - Math.max(...margins);
    const maxX = Math.max(r.x1, r.x2) + r.width + Math.max(...margins);
    const minZ = Math.min(r.z1, r.z2) - r.width - Math.max(...margins);
    const maxZ = Math.max(r.z1, r.z2) + r.width + Math.max(...margins);
    return maxX >= parcel.cx - reach && minX <= parcel.cx + reach && maxZ >= parcel.cz - reach && minZ <= parcel.cz + reach;
  });

  const clearAt = (scale: number, dx: number, dz: number, margin: number) => {
    const poly = abs(transform(rel, scale, dx, dz));
    if (!insideParcel(poly, parcel, tol)) return null;
    let minGap = Infinity;
    for (const r of near) {
      const c = roadClearance(poly, r, margin);
      if (c.violation > 1e-6) return null;
      if (r.kind !== 'DRIVEWAY') minGap = Math.min(minGap, c.gap);
    }
    return { minGap: Number.isFinite(minGap) ? minGap : Infinity };
  };

  for (const margin of margins) {
    for (let s = startScale; s >= minScale - 1e-9; s -= step) {
      const scale = Number(Math.max(minScale, s).toFixed(4));
      const sb = boundsOf(transform(rel, scale, 0, 0));
      // Parsel içinde kalma payı (kaydırma aralığı)
      const loX = parcel.cx - parcel.hw - tol - (sb.minX + origin.x);
      const hiX = parcel.cx + parcel.hw + tol - (sb.maxX + origin.x);
      const loZ = parcel.cz - parcel.hd - tol - (sb.minZ + origin.z);
      const hiZ = parcel.cz + parcel.hd + tol - (sb.maxZ + origin.z);
      if (loX > hiX + 1e-9 || loZ > hiZ + 1e-9) continue;
      const cands: Array<[number, number]> = [];
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const dx = n === 1 ? 0 : loX + ((hiX - loX) * i) / (n - 1);
          const dz = n === 1 ? 0 : loZ + ((hiZ - loZ) * j) / (n - 1);
          cands.push([dx, dz]);
        }
      }
      // Olduğu yerde (0,0) en başta; sonra merkeze en yakın olanlar
      const inRange = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
      cands.push([inRange(0, loX, hiX), inRange(0, loZ, hiZ)]);
      cands.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
      for (const [dx, dz] of cands) {
        const r = clearAt(scale, dx, dz, margin);
        if (r) {
          return { dx, dz, scale, margin, ok: true, withinParcel: true, minGap: r.minGap, bestEffort: false };
        }
      }
    }
  }

  // Çözüm yok: en az kötü adayı (en küçük ihlal) döndür
  let best = { dx: 0, dz: 0, scale: Math.min(1, startScale), violation: Infinity };
  const margin = Math.min(...margins);
  for (let s = startScale; s >= minScale - 1e-9; s -= step * 2) {
    const scale = Number(Math.max(minScale, s).toFixed(4));
    for (let i = -4; i <= 4; i++) {
      for (let j = -4; j <= 4; j++) {
        const dx = (i * parcel.hw) / 4;
        const dz = (j * parcel.hd) / 4;
        const poly = abs(transform(rel, scale, dx, dz));
        let violation = 0;
        for (const r of near) violation = Math.max(violation, roadClearance(poly, r, margin).violation);
        if (violation < best.violation) best = { dx, dz, scale, violation };
      }
    }
  }
  const poly = abs(transform(rel, best.scale, best.dx, best.dz));
  return {
    dx: best.dx,
    dz: best.dz,
    scale: best.scale,
    margin,
    ok: false,
    withinParcel: insideParcel(poly, parcel, tol),
    minGap: -best.violation,
    bestEffort: true,
  };
}
