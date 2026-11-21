/**
 * 81 il sınırını üretir: src/data/turkeyProvinceGeometry.ts
 *
 * Kaynak: Natural Earth 1:10m "Admin 1 – States, Provinces" (kamu malı / public domain,
 *   https://www.naturalearthdata.com/about/terms-of-use/), GeoJSON sürümü:
 *   https://github.com/nvkelso/natural-earth-vector (geojson/ne_10m_admin_1_states_provinces.geojson).
 * Kullanım:  npx tsx scripts/build-turkey-provinces.ts <ne_10m_admin_1_states_provinces.geojson>
 *
 * İl = Natural Earth `iso_3166_2` ("TR-06") → plaka kodu → `CITY_DEFINITIONS[…].plateCode` → CityId.
 * Poligonlar elle çizilmez; yalnızca izdüşüm (cityDefinitions.projectToMapPrecise, şehir noktalarıyla AYNI) ve
 * Douglas–Peucker sadeleştirme uygulanır. Ağ isteği yalnızca bu script çalışırken (geliştirmede) olur;
 * üretilen dosya depoya eklenir, oyun çalışırken harici istek yoktur.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CITY_DEFINITIONS, CITY_IDS, MAP_HEIGHT, projectToMapPrecise } from '../src/data/cityDefinitions';
import { MAP_WIDTH } from '../src/data/cityBalance';
import type { CityId } from '../src/models/cities';

type Pt = [number, number];
const TOL = 0.12; // harita birimi (1000 genişlikte): sınırlar komşuyla boşluk bırakmayacak kadar ince
const MIN_AREA = 0.25;

const input = process.argv[2];
if (!input) throw new Error('Kullanım: npx tsx scripts/build-turkey-provinces.ts <ne_10m_admin_1_states_provinces.geojson>');
const gj = JSON.parse(readFileSync(input, 'utf8')) as { features: Array<{ properties: Record<string, any>; geometry: { type: string; coordinates: any } }> };

const byPlate = new Map<number, CityId>();
for (const id of CITY_IDS) byPlate.set(CITY_DEFINITIONS[id].plateCode, id);

function area(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a / 2);
}
function dp(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 4) return pts;
  const closed = pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  const open = closed ? pts.slice(0, -1) : pts;
  // Halkayı en uzak iki noktadan ikiye bölüp ayrı ayrı sadeleştir (kapalı halka için güvenli).
  let a = 0, b = 0, best = -1;
  for (let i = 0; i < open.length; i += Math.max(1, Math.floor(open.length / 60)))
    for (let j = i + 1; j < open.length; j += Math.max(1, Math.floor(open.length / 60))) {
      const d = Math.hypot(open[i][0] - open[j][0], open[i][1] - open[j][1]);
      if (d > best) { best = d; a = i; b = j; }
    }
  const half = (arr: Pt[]): Pt[] => {
    const keep = new Array(arr.length).fill(false);
    keep[0] = keep[arr.length - 1] = true;
    const st: Array<[number, number]> = [[0, arr.length - 1]];
    while (st.length) {
      const [s, e] = st.pop()!;
      const [x1, y1] = arr[s], [x2, y2] = arr[e];
      const len = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
      let md = 0, idx = -1;
      for (let i = s + 1; i < e; i++) {
        const d = Math.abs((y2 - y1) * arr[i][0] - (x2 - x1) * arr[i][1] + x2 * y1 - y2 * x1) / len;
        if (d > md) { md = d; idx = i; }
      }
      if (md > tol && idx > 0) { keep[idx] = true; st.push([s, idx], [idx, e]); }
    }
    return arr.filter((_, i) => keep[i]);
  };
  const first = open.slice(a, b + 1);
  const second = [...open.slice(b), ...open.slice(0, a + 1)];
  return [...half(first), ...half(second).slice(1, -1)];
}
const r1 = (n: number) => Math.round(n * 10) / 10;

const paths = {} as Record<CityId, string>;
let points = 0;
for (const f of gj.features) {
  const iso: string | undefined = f.properties.iso_3166_2;
  if (f.properties.adm0_a3 !== 'TUR' || !iso) continue;
  const id = byPlate.get(Number(iso.split('-')[1]));
  if (!id) throw new Error('Plaka eşleşmedi: ' + iso);
  const polys: number[][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings: Pt[][] = [];
  let largest: Pt[] | undefined;
  for (const poly of polys) {
    for (const ring of poly) {
      const proj = (ring as number[][]).map(([lon, lat]) => { const p = projectToMapPrecise(lat, lon); return [p.x, p.y] as Pt; });
      const s = dp(proj, TOL);
      if (s.length < 3) continue;
      if (!largest || area(s) > area(largest)) largest = s;
      if (area(s) >= MIN_AREA) rings.push(s);
    }
  }
  if (rings.length === 0 && largest) rings.push(largest);
  paths[id] = rings.map((r) => 'M' + r.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z').join('');
  points += rings.reduce((n, r) => n + r.length, 0);
}
const missing = CITY_IDS.filter((id) => !paths[id]);
if (missing.length) throw new Error('İl poligonu eksik: ' + missing.join(', '));

const body = CITY_IDS.map((id) => `  ${id}: '${paths[id]}',`).join('\n');
const src = `/**
 * OTOMATİK ÜRETİLDİ — elle düzenleme. Yeniden üretmek için:
 *   npx tsx scripts/build-turkey-provinces.ts <ne_10m_admin_1_states_provinces.geojson>
 *
 * Kaynak: Natural Earth 1:10m Admin 1 – States, Provinces (kamu malı / public domain,
 *   https://www.naturalearthdata.com/about/terms-of-use/). Ayrıntı: src/data/TURKEY_MAP_SOURCE.md
 *
 * 81 ilin gerçek sınır poligonları; anahtar = CityId. Koordinatlar \`cityDefinitions.projectToMapPrecise\` ile aynı
 * izdüşümdedir (genişlik ${MAP_WIDTH}, yükseklik ${MAP_HEIGHT}). Çok parçalı iller (ör. ada/enklav) tek yolda birleşir; fillRule evenodd.
 */
import type { CityId } from '../models/cities';

export const TURKEY_PROVINCE_PATHS: Readonly<Record<CityId, string>> = {
${body}
};
`;
writeFileSync(new URL('../src/data/turkeyProvinceGeometry.ts', import.meta.url), src);
console.log(`81 il, ${points} nokta, ${src.length} bayt`);
