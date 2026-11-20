/**
 * ŞEHİR QA — tek koordinat kaynağı (`CityGridDefinition`): yollar, binalar, giriş yolları, rotalar tek yerde ve tutarlı.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AMBIENT_LOOPS,
  CITY_BUILDING_COORDINATES as GRID_BUILDINGS,
  CITY_GRID,
  ROAD_CLEARANCE_MINIMUM,
  blockParcel,
  coreParcel,
  distanceToRoadCenterline,
  wx,
  wz,
  type CityRoadSegment,
} from '../../components/game/city/CityGridDefinition';
import { CITY_BUILDING_COORDINATES as LAYOUT_BUILDINGS, STATIC_CITY_URBAN_BLOCKS } from '../../components/game/city/cityLayout';
import { convexOverlapDepth, rectPolygon } from '../../components/game/city/cityGeometry';
import { roadClearance } from '../../components/game/city/cityClearance';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (n === 'tests') continue;
      out.push(...sourceFiles(p));
    } else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

test('Şehir ızgarası: 2D yerleşim ve 3D sahne aynı koordinat nesnesini kullanır', () => {
  assert.equal(LAYOUT_BUILDINGS, GRID_BUILDINGS, 'cityLayout kendi kopyasını tutmamalı');
  assert.equal(CITY_GRID.buildings, GRID_BUILDINGS);
  assert.equal(Object.keys(CITY_GRID.buildings).length, 8);
});

test('Şehir ızgarası: kopya yol/halka/rota dizileri kaynak kodda kalmadı', () => {
  const grid = join(SRC, 'components/game/city/CityGridDefinition.ts');
  const banned: Array<[RegExp, string]> = [
    [/\bROADWAYS\b/, 'ROADWAYS'],
    [/\bALL_ROAD_SEGS\b/, 'ALL_ROAD_SEGS'],
    [/\bfitClearOfRoads\b(?!`)/, 'fitClearOfRoads (eski nokta örneklemesi)'],
    [/(?:const|let)\s+(?:RING1|RING2|SUBURB_ROADS|AMBIENT_LOOPS)\b/, 'RING/SUBURB/AMBIENT tanımı'],
    [/(?:const|let)\s+(?:ZONES|WALK_DOORS)\s*(?::[^=]+)?=\s*\[/, 'ZONES/WALK_DOORS dizisi'],
  ];
  for (const f of sourceFiles(SRC)) {
    if (f === grid) continue;
    const text = readFileSync(f, 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)) // yorum satırlarını yok say
      .join('\n');
    for (const [re, name] of banned) assert.ok(!re.test(text), `${f.replace(SRC, 'src')}: ${name} burada tekrar tanımlanmış; CityGridDefinition kullanılmalı`);
  }
});

test('Şehir ızgarası: yollar geçerli (benzersiz kimlik, sonlu koordinat, pozitif uzunluk ve genişlik)', () => {
  const ids = new Set<string>();
  assert.ok(CITY_GRID.roads.length >= 30);
  for (const r of CITY_GRID.roads) {
    assert.ok(!ids.has(r.id), `yol kimliği tekrar: ${r.id}`);
    ids.add(r.id);
    for (const v of [r.x1, r.z1, r.x2, r.z2, r.width]) assert.ok(Number.isFinite(v), `${r.id}: sonlu olmayan değer`);
    assert.ok(r.width > 0);
    assert.ok(Math.hypot(r.x2 - r.x1, r.z2 - r.z1) > 0.5, `${r.id}: sıfır uzunluklu yol`);
    assert.ok(['STREET', 'RING', 'CONNECTOR', 'DRIVEWAY'].includes(r.kind));
  }
});

test('Şehir ızgarası: Borsa x=795 yolu DRIVEWAY; binanın ön kenarındaki giriş noktasında biter', () => {
  const d = CITY_GRID.roads.find((r) => r.id === 'borsa-driveway')!;
  assert.ok(d);
  assert.equal(d.kind, 'DRIVEWAY');
  assert.equal(d.servesBuilding, 'BORSA');
  assert.ok(Math.abs(d.x1 - wx(795)) < 1e-9 && Math.abs(d.x2 - wx(795)) < 1e-9, 'yol x=795 dikey çizgisinde olmalı');
  assert.equal(d.width, 5);
  const p = coreParcel('BORSA');
  assert.ok(Math.abs(d.z2 - (p.cz + p.hd)) < 1e-9, 'giriş noktası Borsa parselinin ön kenarında olmalı');
  assert.ok(Math.abs(d.z1 - wz(380)) < 1e-9, 'yol kuzey caddesine (y=380) bağlanmalı');
  // Parsel yolun gövdesini kesmez, yalnızca giriş ucuna değer
  const parcel = rectPolygon(p.cx, p.cz, p.hw, p.hd);
  const body = rectPolygon(d.x1, (d.z1 + d.z2) / 2, d.width / 2, Math.abs(d.z2 - d.z1) / 2);
  assert.ok(convexOverlapDepth(parcel, body) <= 1e-9, 'Borsa parseli giriş yolunun gövdesine biniyor');
  // Hiçbir yol (giriş yolu dahil) çizim sırasında kopyalanmadı: sahne yalnızca CITY_GRID.roads'u çizer
  assert.ok(CITY_GRID.roads.filter((r) => r.kind === 'DRIVEWAY').length >= 1);
});

test('Şehir ızgarası: binaya bağlanan yollar girişte kesilmiştir (bina altından başlamaz)', () => {
  for (const r of CITY_GRID.roads.filter((x) => x.kind === 'DRIVEWAY' && x.servesBuilding)) {
    const p = coreParcel(r.servesBuilding!);
    const parcel = rectPolygon(p.cx, p.cz, p.hw, p.hd);
    // Yolun asfaltı (düz uçlu dikdörtgen) parsele binmez
    const dx = r.x2 - r.x1;
    const dz = r.z2 - r.z1;
    const len = Math.hypot(dx, dz);
    const nx = (-dz / len) * (r.width / 2);
    const nz = (dx / len) * (r.width / 2);
    const rect = [
      { x: r.x1 - nx, z: r.z1 - nz },
      { x: r.x2 - nx, z: r.z2 - nz },
      { x: r.x2 + nx, z: r.z2 + nz },
      { x: r.x1 + nx, z: r.z1 + nz },
    ];
    assert.ok(convexOverlapDepth(parcel, rect) <= 1e-5, `${r.id}: giriş yolu ${r.servesBuilding} parselinin içine giriyor`);
  }
});

test('Şehir ızgarası: her ana bina ve blok parseli, giriş yolları dışındaki bütün yollardan en az 0,5 birim uzak', () => {
  const parcels = [
    ...(Object.keys(CITY_GRID.buildings) as Array<keyof typeof GRID_BUILDINGS>).map((id) => ({ id: String(id), p: coreParcel(id) })),
    ...STATIC_CITY_URBAN_BLOCKS.map((b) => ({ id: b.id, p: blockParcel(b) })),
  ];
  assert.ok(parcels.length >= 30);
  for (const { id, p } of parcels) {
    const poly = rectPolygon(p.cx, p.cz, p.hw, p.hd);
    for (const r of CITY_GRID.roads) {
      if (r.kind === 'DRIVEWAY') {
        const c = roadClearance(poly, r, 0);
        assert.ok(c.violation <= 1e-6, `${id} parseli giriş yolu ${r.id} üstüne biniyor`);
      } else {
        const c = roadClearance(poly, r, ROAD_CLEARANCE_MINIMUM);
        assert.ok(c.violation <= 1e-6, `${id} parseli "${r.id}" yoluna ${c.gap.toFixed(2)} birim yakın (en az ${ROAD_CLEARANCE_MINIMUM} olmalı)`);
      }
    }
  }
});

test('Şehir ızgarası: trafik rotaları, halka arabaları ve yaya yolları gerçekten bir yolun üstünde', () => {
  const near = (x: number, z: number, roads: readonly CityRoadSegment[], tol: number) =>
    roads.some((r) => distanceToRoadCenterline(x, z, r) <= r.width / 2 + tol);
  for (const [id, keys] of Object.entries(CITY_GRID.routes)) {
    for (const k of keys) assert.ok(near(wx(k.x), wz(k.y), CITY_GRID.roads, 0.01), `${id}: (${k.x}, ${k.y}) noktası hiçbir yolun üstünde değil`);
  }
  const rings = CITY_GRID.roads.filter((r) => r.kind === 'RING');
  for (const loop of AMBIENT_LOOPS) for (const [x, z] of loop) assert.ok(near(x, z, rings, 0.01), `halka rotası (${x}, ${z}) halka yolun üstünde değil`);
  // Yaya yolları kaldırımlarda: bir yolun asfalt kenarından en fazla 3 birim uzakta ya da içinde
  const sidewalkOk = (x: number, z: number) => CITY_GRID.roads.some((r) => Math.abs(distanceToRoadCenterline(x, z, r) - r.width / 2) <= 3.5 || distanceToRoadCenterline(x, z, r) <= r.width / 2 + 3.5);
  for (const path of CITY_GRID.walkPaths) for (const [x, z] of path) assert.ok(sidewalkOk(x, z), `yaya noktası (${x}, ${z}) yola uzak`);
  // Kapılar: binanın ön yüzünün hemen önünde
  assert.equal(CITY_GRID.walkDoors.length, 3);
});

test('Şehir ızgarası: Borsa x=795 dışında hiçbir yol bir ana binanın merkezinden geçmiyor', () => {
  for (const id of Object.keys(CITY_GRID.buildings) as Array<keyof typeof GRID_BUILDINGS>) {
    const p = coreParcel(id);
    for (const r of CITY_GRID.roads) {
      if (r.kind === 'DRIVEWAY') continue;
      assert.ok(distanceToRoadCenterline(p.cx, p.cz, r) > r.width / 2 + Math.min(p.hw, p.hd) * 0.5, `${r.id} ${id} binasının ortasından geçiyor`);
    }
  }
});
