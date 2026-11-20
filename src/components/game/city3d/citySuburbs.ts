/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Çevre mahallelerinin YERLEŞİM kuralları (saf hesap, `three` yok): halka ve çıkış yolları boyunca ev/apartman yerleri
 * ve aralarındaki koru yerleri. Sahne bu yerlere model koyar; QA testi aynı fonksiyonu çağırıp her yerin ortak şehir
 * ızgarasındaki bütün yollardan uzak olduğunu denetler.
 *
 * `visit` geri çağrısı sahnenin kendi rastgele sayılarını (model seçimi) aynı üretecten tüketebilir; yer seçimi bu
 * tüketimden etkilendiği için sahnedeki görünüm, QA'nın boş geri çağrıyla bulduğu yerlerden farklı olabilir.
 * Kural ise iki durumda da aynıdır (her yer `squareClearOfRoads` ile doğrulanır).
 */
import {
  CITY_GRID,
  RING1,
  RING2,
  ROAD_CLEARANCE_PREFERRED,
  SUBURB_ROADS,
  distanceToRoadCenterline,
  type CityRoadSegment,
} from '../city/CityGridDefinition';
import { polygonSegmentDistance, rectPolygon } from '../city/cityGeometry';

/** Mahalle binalarının (apartman 9, ev 8) en büyük yarı boyutu */
export const SUBURB_BUILDING_HALF = 4.5;
/** Evin yola uzaklığı (kendi yolunun merkez çizgisinden) */
export const SUBURB_SETBACK = 9.5;

export interface SuburbSpot {
  x: number;
  z: number;
  /** Yol çizgisi yönü ve yola dik yön (binanın ön yüzü yola bakar) */
  ux: number;
  uz: number;
  nx: number;
  nz: number;
  rot: number;
  /** İç halkaya yakın mı (apartman çıkabilir) */
  close: boolean;
}

/** Merkez (x,z), yarı boyutu `half` olan eksene hizalı kare, bütün yolların asfaltından en az `margin` uzak mı? */
export function squareClearOfRoads(
  x: number,
  z: number,
  half: number,
  margin = ROAD_CLEARANCE_PREFERRED,
  roads: readonly CityRoadSegment[] = CITY_GRID.roads
): boolean {
  const sq = rectPolygon(x, z, half, half);
  return roads.every((r) => polygonSegmentDistance(sq, { x: r.x1, z: r.z1 }, { x: r.x2, z: r.z2 }) - r.width / 2 >= margin);
}

const inCore = (x: number, z: number) => Math.abs(x) < 80 && z > -60 && z < 64;

/** Halka/çıkış yolları boyunca ev yerleri. `visit` her kabul edilen yer için çağrılır; `placed` konumları döner. */
export function walkSuburbSpots(rng: () => number, visit: (spot: SuburbSpot) => void): Array<[number, number]> {
  const placed: Array<[number, number]> = [];
  for (const r of SUBURB_ROADS) {
    const dx = r.x2 - r.x1;
    const dz = r.z2 - r.z1;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    for (const side of [-1, 1]) {
      const nx = -uz * side;
      const nz = ux * side;
      for (let d = 8; d < len - 8; d += 11 + rng() * 2) {
        const x = r.x1 + ux * d + nx * SUBURB_SETBACK;
        const z = r.z1 + uz * d + nz * SUBURB_SETBACK;
        if (inCore(x, z) || !squareClearOfRoads(x, z, SUBURB_BUILDING_HALF) || placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 9.5)) continue;
        if (Math.abs(x) > RING2.x + 4 || z < RING2.zN - 4 || z > RING2.zS + 4) continue;
        placed.push([x, z]);
        const rot = Math.atan2(-nx, -nz); // ön yüz yola baksın (modellerin önü +z)
        const close = Math.abs(x) <= RING1.x + 14 && z >= RING1.zN - 14 && z <= RING1.zS + 14;
        visit({ x, z, ux, uz, nx, nz, rot, close });
      }
    }
  }
  return placed;
}

/** Mahalle aralarındaki korular: `visit(x, z, i)` kabul edilen her yer için çağrılır. */
export function walkGroveSpots(rng: () => number, placed: ReadonlyArray<readonly [number, number]>, visit: (x: number, z: number, i: number) => void): void {
  for (let i = 0; i < 110; i++) {
    const x = -RING2.x + rng() * RING2.x * 2;
    const z = RING2.zN + rng() * (RING2.zS - RING2.zN);
    if (inCore(x, z) || CITY_GRID.roads.some((r) => distanceToRoadCenterline(x, z, r) < 6) || placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 7.5)) continue;
    visit(x, z, i);
  }
}
