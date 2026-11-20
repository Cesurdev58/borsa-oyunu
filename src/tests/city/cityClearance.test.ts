/**
 * ŞEHİR QA — yol boşluğu çözücüsü (saf geometri): gerçek mesafe, DRIVEWAY kuralı, parsel içinde kalma, determinizm.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildableArea,
  convexHull,
  convexOverlapDepth,
  fitFootprint,
  insideParcel,
  polygonSegmentDistance,
  roadClearance,
  worstRoadClearance,
  type Pt,
} from '../../components/game/city/cityClearance';
import { rectPolygon } from '../../components/game/city/cityGeometry';
import type { CityRoadSegment, WorldRect } from '../../components/game/city/CityGridDefinition';

const road = (id: string, x1: number, z1: number, x2: number, z2: number, width: number, kind: CityRoadSegment['kind'] = 'STREET'): CityRoadSegment => ({ id, kind, x1, z1, x2, z2, width });

/** Küçük sabit tohumlu sayı üreteci (kütüphane bağımsız) */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** Referans: doğru parçasını yoğun örnekleyip çokgene en yakın mesafe (yavaş ama bağımsız) */
function bruteDistance(poly: readonly Pt[], a: Pt, b: Pt): number {
  const inside = (p: Pt) => poly.every((v, i) => {
    const w = poly[(i + 1) % poly.length];
    return (w.x - v.x) * (p.z - v.z) - (w.z - v.z) * (p.x - v.x) >= -1e-9;
  });
  const edgeDist = (p: Pt) => Math.min(...poly.map((v, i) => {
    const w = poly[(i + 1) % poly.length];
    const dx = w.x - v.x, dz = w.z - v.z;
    const t = Math.max(0, Math.min(1, ((p.x - v.x) * dx + (p.z - v.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(p.x - (v.x + dx * t), p.z - (v.z + dz * t));
  }));
  let best = Infinity;
  const N = 6000;
  for (let i = 0; i <= N; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / N, z: a.z + ((b.z - a.z) * i) / N };
    best = Math.min(best, inside(p) ? 0 : edgeDist(p));
  }
  return best;
}

test('Boşluk: çokgen–doğru parçası mesafesi yoğun örnekleme ile uyuşur (rastgele 300 durum)', () => {
  const rnd = lcg(7);
  for (let i = 0; i < 300; i++) {
    const cx = rnd() * 20 - 10, cz = rnd() * 20 - 10;
    const poly = convexHull([
      { x: cx - rnd() * 5 - 0.5, z: cz - rnd() * 5 - 0.5 }, { x: cx + rnd() * 5 + 0.5, z: cz - rnd() * 5 - 0.5 },
      { x: cx + rnd() * 5 + 0.5, z: cz + rnd() * 5 + 0.5 }, { x: cx - rnd() * 5 - 0.5, z: cz + rnd() * 5 + 0.5 },
      { x: cx + rnd() * 2, z: cz + rnd() * 2 },
    ]);
    const a = { x: rnd() * 40 - 20, z: rnd() * 40 - 20 };
    const b = { x: rnd() * 40 - 20, z: rnd() * 40 - 20 };
    const got = polygonSegmentDistance(poly, a, b);
    const ref = bruteDistance(poly, a, b);
    assert.ok(Math.abs(got - ref) < 0.02, `durum ${i}: ${got.toFixed(4)} ≠ ${ref.toFixed(4)}`);
  }
});

test('Boşluk: eski 48 noktalı örnekleme ince engeli kaçırıyordu, yeni ölçüm kaçırmaz', () => {
  // 100 birimlik yatay yol (yarı genişlik 1). İnce engel (0,2 geniş) iki örnek noktasının tam ortasında,
  // asfaltın 0,4 ötesinde: 0,5 boşluk isteyen kurala 0,1 aykırı.
  const r = road('uzun', 0, 0, 100, 0, 2);
  const x = 100 / 48 / 2 + (100 / 48) * 24; // iki örnek arasının ortası
  const thin = rectPolygon(x, 2.4, 0.1, 1.0); // alt kenar z=1,4 → merkez çizgisine 1,4, asfalt kenarına 0,4
  assert.ok(Math.abs(roadClearance(thin, r, 0.5).violation - 0.1) < 1e-6, 'yeni ölçüm 0,1 ihlali bulmalı');
  // Eski yöntem (48 nokta, kutuya sıkıştırılmış en yakın nokta): kural r.w/2 + 0,5 = 1,5
  const oldHits = (poly: Pt[]) => {
    const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    let best = Infinity;
    for (let i = 0; i <= 48; i++) {
      const sx = (100 * i) / 48;
      best = Math.min(best, Math.hypot(Math.min(x1, Math.max(x0, sx)) - sx, Math.min(z1, Math.max(z0, 0)) - 0));
    }
    return best < 1.5;
  };
  assert.equal(oldHits(thin), false, 'eski yöntem bu ihlali göremiyordu');
});

test('Boşluk: bina yolun üstündeyse boşluk negatif, uzaktaysa pozitif; boşluk = mesafe − yarı genişlik', () => {
  const r = road('r', 0, 0, 40, 0, 4);
  assert.ok(roadClearance(rectPolygon(10, 0, 2, 2), r, 0.5).gap < 0);
  const c = roadClearance(rectPolygon(10, 6, 2, 2), r, 0.5); // alt kenar z=4 → mesafe 4, yarı genişlik 2
  assert.ok(Math.abs(c.gap - 2) < 1e-9);
  assert.equal(c.violation, 0);
  assert.ok(roadClearance(rectPolygon(10, 4.2, 2, 2), r, 1.0).violation > 0.5, 'istenen boşluk 1,0 iken 0,2 boşluk ihlaldir');
});

test('Boşluk: eğik (çapraz) yol binanın köşesini keserse yakalanır', () => {
  const diag = road('capraz', -20, -20, 20, 20, 2);
  assert.ok(roadClearance(rectPolygon(0, 0, 3, 3), diag, 0.5).violation > 1);
  assert.ok(roadClearance(rectPolygon(10, -10, 2, 2), diag, 0.5).violation === 0);
  // Yolun UÇ yuvarlağı: yol (0,0)'da biter; ucun hemen ötesindeki bina asfalt kapağına değebilir
  const stub = road('uc', -20, 0, 0, 0, 4);
  assert.ok(roadClearance(rectPolygon(3.5, 0, 1.5, 1.5), stub, 0).violation === 0, 'kapak yarıçapı 2: bina 2 birim ötede başlıyor');
  assert.ok(roadClearance(rectPolygon(2.5, 0, 1.5, 1.5), stub, 0).violation > 0.5, 'kapağın içine giren bina ihlaldir');
});

test('DRIVEWAY: bina giriş ucuna değebilir, gövdesine ve yan boşluğuna giremez', () => {
  // Yol z=0'dan z=10'a iner, giriş noktası (0,10). Bina z>10 tarafında.
  const d = road('girisyolu', 0, 0, 0, 10, 4, 'DRIVEWAY');
  const touching = rectPolygon(0, 15, 10, 5); // üst kenar z=10: yalnızca uca değiyor
  assert.equal(roadClearance(touching, d, 1.0).violation, 0);
  const overlapBody = rectPolygon(0, 14, 10, 5); // üst kenar z=9: yolun içine 1 birim biniyor
  assert.ok(roadClearance(overlapBody, d, 1.0).violation >= 0.9);
  // Yolun yanında, yan boşluktan (asfalt kenarı + 1) az mesafede duran bina
  const beside = rectPolygon(3.5, 5, 1, 2); // x aralığı 2.5..4.5; asfalt kenarı x=2 → boşluk 0,5 < 1
  assert.ok(roadClearance(beside, d, 1.0).violation > 0.4);
  assert.equal(roadClearance(beside, d, 0.5).violation, 0);
});

test('Çözücü: yoldan uzaktaki bina olduğu gibi kalır', () => {
  const parcel: WorldRect = { cx: 0, cz: 0, hw: 5, hd: 5 };
  const r = fitFootprint(rectPolygon(0, 0, 4, 4), parcel, { roads: [road('r', -50, 30, 50, 30, 4)] });
  assert.equal(r.ok, true);
  assert.equal(r.scale, 1);
  assert.equal(r.dx, 0);
  assert.equal(r.dz, 0);
  assert.equal(r.margin, 1.0, 'mümkünken tercih edilen kaldırım boşluğu (1,0) kullanılmalı');
});

test('Çözücü: yola taşan bina kaydırılır ve/veya küçültülür; sonuç boşluk ve parsel kurallarını sağlar', () => {
  const parcel: WorldRect = { cx: 0, cz: 0, hw: 8, hd: 8 };
  const roads = [road('batı', -9, -50, -9, 50, 4)]; // parselin sol kenarına 1 birim girer, sol 2 birimi yutar
  const hull = rectPolygon(0, 0, 8, 8);
  const r = fitFootprint(hull, parcel, { roads });
  assert.equal(r.ok, true);
  const placed = hull.map((p) => ({ x: p.x * r.scale + r.dx, z: p.z * r.scale + r.dz }));
  const w = worstRoadClearance(placed, r.margin, roads)!;
  assert.ok(w.violation <= 1e-6, `boşluk ${w.gap.toFixed(3)} < istenen ${r.margin}`);
  assert.ok(insideParcel(placed, parcel, 0.3), 'parsel dışına taşmamalı');
  assert.ok(r.scale < 1 || r.dx > 0, 'bir şey değişmeliydi');
  assert.ok(r.scale >= 0.5);
});

test('Çözücü: 1,0 mümkün değilse en az 0,5 boşlukla çözer; ikisi de mümkün değilse ok=false döner ve çökmez', () => {
  const parcel: WorldRect = { cx: 0, cz: 0, hw: 5, hd: 5 };
  // Sağda yol: asfalt kenarı x=4,3 (bina x∈[-5,5] içine 0,7 giriyor). Ölçek değişmezse en çok 0,3 kaydırılabilir → sağlanamaz.
  const tight = [road('sağ', 6.5, -50, 6.5, 50, 4.4)];
  const a = fitFootprint(rectPolygon(0, 0, 5, 5), parcel, { roads: tight, minScale: 1 });
  assert.equal(a.ok, false, 'ölçek değiştirmeden 1,0 de 0,5 de sağlanamaz');
  const b = fitFootprint(rectPolygon(0, 0, 5, 5), parcel, { roads: tight });
  assert.equal(b.ok, true);
  assert.equal(b.margin, 1.0, 'küçültünce tercih edilen 1,0 boşluk yine de sağlanabilir');
  // Küçültme sınırı 0,87'ye çekilirse 1,0 sağlanamaz (gerek ≈0,83 değil 0,88) ama 0,5 sağlanır
  const c0 = fitFootprint(rectPolygon(0, 0, 5, 5), parcel, { roads: tight, minScale: 0.86 });
  assert.equal(c0.ok, true);
  // Yol parselin tam ortasından geçiyor ve küçültme sınırlı → çözüm yok
  const through = [road('orta', 0, -50, 0, 50, 6)];
  const c = fitFootprint(rectPolygon(0, 0, 5, 5), parcel, { roads: through, minScale: 0.9 });
  assert.equal(c.ok, false);
  assert.equal(c.bestEffort, true);
  assert.ok(Number.isFinite(c.dx) && Number.isFinite(c.dz) && Number.isFinite(c.scale));
});

test('Çözücü: Borsa tipi giriş yolunda bina geri çekilir, yolun gövdesine binmez', () => {
  const parcel: WorldRect = { cx: 0, cz: 0, hw: 10, hd: 8 };
  const drive = road('giris', 0, 40, 0, 8, 5, 'DRIVEWAY'); // giriş ucu z=8 = parselin ön kenarı
  const flush = fitFootprint(rectPolygon(0, 0, 10, 8), parcel, { roads: [drive] });
  assert.equal(flush.ok, true);
  const bigger = fitFootprint(rectPolygon(0, 0.6, 10, 8), { ...parcel }, { roads: [drive] }); // ön yüzü z=8,6: girişe 0,6 biniyor
  assert.equal(bigger.ok, true);
  const placed = rectPolygon(0, 0.6, 10, 8).map((p) => ({ x: p.x * bigger.scale + bigger.dx, z: p.z * bigger.scale + bigger.dz }));
  assert.ok(Math.max(...placed.map((p) => p.z)) <= 8 + 1e-6, 'ön yüz giriş noktasını aşmamalı');
});

test('Çözücü: aynı girdi aynı çıktıyı verir (determinizm)', () => {
  const parcel: WorldRect = { cx: 3, cz: -2, hw: 7, hd: 6 };
  const roads = [road('a', -30, 5, 30, 5, 4), road('b', 12, -30, 12, 30, 4)];
  const hull = rectPolygon(3, -2, 8, 7);
  const a = fitFootprint(hull, parcel, { roads });
  const b = fitFootprint(hull, parcel, { roads });
  assert.deepEqual(a, b);
});

test('Yapılabilir alan: parsele taşan eksene paralel yol kenarı içeri çeker; uzaktaki yola dokunmaz', () => {
  const parcel: WorldRect = { cx: 0, cz: 0, hw: 10, hd: 10 };
  const ba = buildableArea(parcel, 0.5, [road('v', 10, -50, 10, 50, 4)]); // yol kenarı x=8, boşlukla 7,5
  assert.ok(Math.abs(ba.cx + ba.hw - 7.5) < 1e-9, `sağ kenar ${(ba.cx + ba.hw).toFixed(2)}`);
  assert.ok(Math.abs(ba.cx - ba.hw + 10) < 1e-9, 'sol kenar değişmemeli');
  const far = buildableArea(parcel, 0.5, [road('v', 40, -50, 40, 50, 4)]);
  assert.deepEqual(far, parcel);
  const horizontal = buildableArea(parcel, 0.5, [road('h', -50, -9, 50, -9, 4)]); // üst kenarı aşağı çeker
  assert.ok(Math.abs(horizontal.cz - horizontal.hd - (-9 + 2 + 0.5)) < 1e-9);
  // DRIVEWAY'ler yapılabilir alanı kesmez (SAT ayrıca denetler)
  assert.deepEqual(buildableArea(parcel, 0.5, [road('d', 0, -50, 0, 0, 5, 'DRIVEWAY')]), parcel);
});

test('Geometri: SAT kesişim derinliği', () => {
  assert.ok(convexOverlapDepth(rectPolygon(0, 0, 2, 2), rectPolygon(3, 0, 2, 2)) > 0.9);
  assert.equal(convexOverlapDepth(rectPolygon(0, 0, 2, 2), rectPolygon(4, 0, 2, 2)), 0, 'yalnızca değen kutular kesişmez');
  assert.equal(convexOverlapDepth(rectPolygon(0, 0, 2, 2), rectPolygon(9, 9, 1, 1)), 0);
});
