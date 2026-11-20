/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Şehir yerleşimi için saf düzlem geometrisi (nokta, doğru parçası, dışbükey çokgen). `three` ve oyun verisi yok.
 */

export interface Pt {
  x: number;
  z: number;
}

const EPS = 1e-9;

// ---------------------------------------------------------------------------
// Temel geometri
// ---------------------------------------------------------------------------

/** Nokta kümesinin dışbükey zarfı (Andrew monotone chain), saat yönünün tersi. */
export function convexHull(points: readonly Pt[]): Pt[] {
  const pts = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z))
    .map((p) => ({ x: p.x, z: p.z }))
    .sort((a, b) => a.x - b.x || a.z - b.z);
  if (pts.length <= 2) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function pointSegDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const L2 = dx * dx + dz * dz;
  const t = L2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

function segmentsIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const o1 = o(a, b, c);
  const o2 = o(a, b, d);
  const o3 = o(c, d, a);
  const o4 = o(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function segSegDist(a: Pt, b: Pt, c: Pt, d: Pt): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(pointSegDist(a, c, d), pointSegDist(b, c, d), pointSegDist(c, a, b), pointSegDist(d, a, b));
}

/** Nokta dışbükey çokgenin içinde mi (kenar dahil)? Çokgen saat yönünün tersi. */
export function pointInConvex(p: Pt, poly: readonly Pt[]): boolean {
  if (poly.length < 3) return false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x) < -1e-9) return false;
  }
  return true;
}

/** Dışbükey çokgen ile doğru parçası arasındaki gerçek mesafe (kesişiyor ya da içindeyse 0). */
export function polygonSegmentDistance(poly: readonly Pt[], a: Pt, b: Pt): number {
  if (poly.length === 0) return Infinity;
  if (poly.length === 1) return pointSegDist(poly[0], a, b);
  if (poly.length === 2) return segSegDist(poly[0], poly[1], a, b);
  if (pointInConvex(a, poly) || pointInConvex(b, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    best = Math.min(best, segSegDist(poly[i], poly[(i + 1) % poly.length], a, b));
    if (best === 0) return 0;
  }
  return best;
}

/** İki dışbükey çokgenin kesişim derinliği (SAT; 0 = kesişmiyor ya da yalnızca değiyor). */
export function convexOverlapDepth(p: readonly Pt[], q: readonly Pt[]): number {
  let depth = Infinity;
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      let nx = -(b.z - a.z);
      let nz = b.x - a.x;
      const len = Math.hypot(nx, nz);
      if (len < EPS) continue;
      nx /= len;
      nz /= len;
      let pMin = Infinity, pMax = -Infinity, qMin = Infinity, qMax = -Infinity;
      for (const v of p) {
        const d = v.x * nx + v.z * nz;
        pMin = Math.min(pMin, d);
        pMax = Math.max(pMax, d);
      }
      for (const v of q) {
        const d = v.x * nx + v.z * nz;
        qMin = Math.min(qMin, d);
        qMax = Math.max(qMax, d);
      }
      const overlap = Math.min(pMax, qMax) - Math.max(pMin, qMin);
      if (overlap <= 1e-6) return 0;
      depth = Math.min(depth, overlap);
    }
  }
  return Number.isFinite(depth) ? depth : 0;
}


/** Dikdörtgen parseli (merkez + yarım boyut) saat yönünün tersi çokgen olarak verir. */
export function rectPolygon(cx: number, cz: number, hw: number, hd: number): Pt[] {
  return [
    { x: cx - hw, z: cz - hd },
    { x: cx + hw, z: cz - hd },
    { x: cx + hw, z: cz + hd },
    { x: cx - hw, z: cz + hd },
  ];
}
