/**
 * Türkiye haritasının KOMŞU ÜLKE zeminini üretir: src/data/turkeyMapGeometry.ts (`TURKEY_NEIGHBORS_PATH`).
 * Türkiye'nin kendisi (81 il poligonu) ayrı üretilir: scripts/build-turkey-provinces.ts → src/data/turkeyProvinceGeometry.ts.
 *
 * Kaynak: Natural Earth (kamu malı) — "world-atlas" paketinin countries-10m.json dosyası (TopoJSON).
 * Kullanım:  npx tsx scripts/build-turkey-map.ts <countries-10m.json yolu>
 *   (ör. npm install world-atlas --prefix /tmp/atlas; ... /tmp/atlas/node_modules/world-atlas/countries-10m.json)
 *
 * Çizim, şehir noktalarının `mapPosition` değerleriyle AYNI izdüşümü (cityDefinitions.projectToMapPrecise) kullanır;
 * bu yüzden işaretler kıyı çizgisine göre doğru yerde durur. Ağ isteği yapılmaz; üretilen dosya depoya eklenir.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { MAP_HEIGHT, projectToMapPrecise } from '../src/data/cityDefinitions';
import { MAP_WIDTH } from '../src/data/cityBalance';

type Pt = [number, number];
interface Topo {
  transform: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: { countries: { geometries: Array<{ id: string; properties: { name: string }; type: string; arcs: any }> } };
}

const input = process.argv[2];
if (!input) throw new Error('Kullanım: npx tsx scripts/build-turkey-map.ts <countries-10m.json>');
const topo = JSON.parse(readFileSync(input, 'utf8')) as Topo;

// --- TopoJSON çözücü ---
const { scale, translate } = topo.transform;
const decodedArcs: Pt[][] = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as Pt;
  });
});
function ring(indices: number[]): Pt[] {
  const pts: Pt[] = [];
  for (const i of indices) {
    const a = i >= 0 ? decodedArcs[i] : [...decodedArcs[~i]].reverse();
    pts.push(...(pts.length ? a.slice(1) : a));
  }
  return pts;
}
function polygons(g: { type: string; arcs: any }): Pt[][][] {
  if (g.type === 'Polygon') return [g.arcs.map((r: number[]) => ring(r))];
  if (g.type === 'MultiPolygon') return g.arcs.map((poly: number[][]) => poly.map((r) => ring(r)));
  return [];
}

// --- Yardımcılar ---
const MARGIN = 80;
function clipRing(pts: Pt[]): Pt[] {
  // Sutherland–Hodgman: [-MARGIN, W+MARGIN] x [-MARGIN, H+MARGIN]
  const edges: Array<(p: Pt) => number> = [
    (p) => p[0] + MARGIN, (p) => MAP_WIDTH + MARGIN - p[0],
    (p) => p[1] + MARGIN, (p) => MAP_HEIGHT + MARGIN - p[1],
  ];
  let out = pts;
  for (const d of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const da = d(a), db = d(b);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    if (out.length === 0) return [];
  }
  return out;
}
function dp(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  const first = pts[0], last = pts[pts.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    // Kapalı halka: başlangıç = bitiş olduğu için doğrudan sadeleştirilemez; en uzak noktadan ikiye böl.
    let m = 1, best = -1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i][0] - first[0], pts[i][1] - first[1]);
      if (d > best) { best = d; m = i; }
    }
    const a = dp(pts.slice(0, m + 1), tol);
    const b = dp(pts.slice(m), tol);
    return [...a, ...b.slice(1, -1)];
  }
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0, idx = -1;
    const [x1, y1] = pts[s], [x2, y2] = pts[e];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((y2 - y1) * pts[i][0] - (x2 - x1) * pts[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = true; stack.push([s, idx], [idx, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function area(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a / 2);
}
function toPath(rings: Pt[][]): string {
  return rings
    .map((r) => 'M' + r.map(([x, y]) => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`).join('L') + 'Z')
    .join('');
}
function build(ids: string[], tol: number, minArea: number): { path: string; points: number } {
  const out: Pt[][] = [];
  for (const g of topo.objects.countries.geometries) {
    if (!ids.includes(g.id)) continue;
    for (const poly of polygons(g)) {
      for (const r of poly) {
        const proj = r.map(([lon, lat]) => { const p = projectToMapPrecise(lat, lon); return [p.x, p.y] as Pt; });
        const clipped = clipRing(proj);
        if (clipped.length < 3) continue;
        const simp = dp(clipped, tol);
        if (simp.length >= 3 && area(simp) >= minArea) out.push(simp);
      }
    }
  }
  return { path: toPath(out), points: out.reduce((n, r) => n + r.length, 0) };
}

// Yunanistan, Bulgaristan, Gürcistan, Ermenistan, Azerbaycan, İran, Irak, Suriye, Kıbrıs, Romanya, Rusya, Ukrayna
const NEIGHBORS = ['300', '100', '268', '051', '031', '364', '368', '760', '196', '642', '643', '804'];

const neighbors = build(NEIGHBORS, 0.8, 8);

const src = `/**
 * OTOMATİK ÜRETİLDİ — elle düzenleme. Yeniden üretmek için: npx tsx scripts/build-turkey-map.ts <countries-10m.json>
 *
 * Kaynak: Natural Earth (kamu malı, https://www.naturalearthdata.com/about/terms-of-use/) —
 *   "world-atlas" 2.0.2 paketi (ISC lisansı, Mike Bostock), countries-10m.json.
 * Ayrıntı ve lisans notu: src/data/TURKEY_MAP_SOURCE.md
 *
 * Koordinatlar \`cityDefinitions.projectToMapPrecise\` ile aynı izdüşümdedir (genişlik ${MAP_WIDTH}, yükseklik ${MAP_HEIGHT}).
 */
export const TURKEY_NEIGHBORS_PATH =
  '${neighbors.path}';
`;
writeFileSync(new URL('../src/data/turkeyMapGeometry.ts', import.meta.url), src);
console.log(`Komşular: ${neighbors.points} nokta, ${neighbors.path.length} bayt`);
