/**
 * ŞEHİR QA — gerçek modellerle yerleşim: her ana bina ve şehir bloğu (kilitli/açık, her dükkân türü ve seviyesi)
 * gerçek hazır modellerle çizilir, sahnenin kullandığı yerleştirme (`placeModelInParcel`) uygulanır ve sonuç
 *   - hiçbir yolun asfaltını kesmez (en az 0,5 birim boşluk),
 *   - parselin dışına taşmaz,
 *   - Borsa'nın giriş yoluna binmez
 * diye denetlenir. Tarayıcı yok: `city3dHarness.ts` sahte canvas/img ve diskten model yükleyici sağlar.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { deriveCityUrbanBlocks, deriveIsometricBuildings } from '../../components/game/city/cityLayout';
import type { CityUrbanBlockNode, IsometricBuildingNode } from '../../components/game/city/cityVisualTypes';
import {
  CITY_BLOCK_FOOT,
  CITY_CORE_FOOT,
  CITY_GRID,
  ROAD_CLEARANCE_MINIMUM,
  ROAD_CLEARANCE_PREFERRED,
  coreParcel,
  wx,
  wz,
  type WorldRect,
} from '../../components/game/city/CityGridDefinition';
import { convexOverlapDepth, rectPolygon } from '../../components/game/city/cityGeometry';
import { insideParcel, worstRoadClearance } from '../../components/game/city/cityClearance';
import { walkGroveSpots, walkSuburbSpots, squareClearOfRoads, SUBURB_BUILDING_HALF } from '../../components/game/city3d/citySuburbs';
import { loadCityAssets, type CityAssets } from '../../components/game/city3d/assets';
import { buildBlock, buildCore, setCityAssets, SHOP_SLOT_IDS } from '../../components/game/city3d/models';
import { mergeByLook } from '../../components/game/city3d/assets';
import { modelFootprintHull, placeModelInParcel } from '../../components/game/city3d/cityFit';
import { createRng } from '../../components/game/city3d/kit';
import { diskLoader, installDomStubs } from './city3dHarness';

const PARCEL_TOL = 0.3 + 1e-6;
const SHOP_TYPES = ['BUFE', 'MANAV', 'KAFE', 'GIYIM_MAGAZASI', 'ELEKTRONIK_MAGAZASI', 'MOBILYA_MAGAZASI', 'MARKET', 'OTOMOBIL_GALERISI'];
const fmt = (v: number) => String(v);

let assets: CityAssets;
let coreNodes: IsometricBuildingNode[] = [];
let blockNodes: CityUrbanBlockNode[] = [];

before(async () => {
  installDomStubs();
  const logs: string[] = [];
  assets = await loadCityAssets({ loader: diskLoader(), fresh: true, log: (m) => logs.push(m) });
  assert.equal(logs.length, 0, `gerçek modellerde yükleme sorunu olmamalı:\n${logs.join('\n')}`);
  setCityAssets(assets);
  const eng = new SimulationEngine(20261120, 5_000_000);
  coreNodes = deriveIsometricBuildings(eng.getState(), eng.checkIPOEligibility(), fmt);
  blockNodes = deriveCityUrbanBlocks(eng.getState());
});

interface Placed {
  label: string;
  hull: ReturnType<typeof modelFootprintHull>;
  parcel: WorldRect;
  scale: number;
  ok: boolean;
  problem?: string;
}

function place(label: string, built: THREE.Group, parcel: WorldRect): Placed {
  const root = new THREE.Group();
  root.position.set(parcel.cx, 0.26, parcel.cz);
  const model = mergeByLook(built, (o) => o.name === 'smoke');
  root.add(model);
  const res = placeModelInParcel(model, parcel);
  const hull = modelFootprintHull(model, parcel);
  return { label, hull, parcel, scale: res.scale, ok: res.ok, problem: res.problem };
}

function assertPlacement(p: Placed, minScale: number): void {
  assert.ok(p.hull.length >= 3, `${p.label}: ayak izi boş`);
  assert.ok(p.hull.every((q) => Number.isFinite(q.x) && Number.isFinite(q.z)), `${p.label}: ayak izinde NaN`);
  assert.equal(p.ok, true, `${p.label}: yerleştirme çözümü yok (${p.problem})`);
  const worst = worstRoadClearance(p.hull, ROAD_CLEARANCE_MINIMUM);
  assert.ok(worst && worst.violation <= 1e-6, `${p.label}: yol "${worst?.roadId}" ile boşluk ${worst?.gap.toFixed(2)} (en az ${ROAD_CLEARANCE_MINIMUM} olmalı)`);
  assert.ok(insideParcel(p.hull, p.parcel, PARCEL_TOL), `${p.label}: parsel dışına taşıyor`);
  assert.ok(p.scale >= minScale, `${p.label}: ölçek ${p.scale.toFixed(2)} (en az ${minScale}) — bina fazla küçüldü`);
}

test('Şehir QA: 8 ana bina (kilitli/açık, 1-5. seviye) hiçbir yolu kesmez ve parselde kalır', () => {
  assert.equal(coreNodes.length, 8);
  let n = 0;
  for (const base of coreNodes) {
    const parcel: WorldRect = { cx: wx(base.x), cz: wz(base.y), hw: (base.width * CITY_CORE_FOOT) / 2, hd: (base.height * CITY_CORE_FOOT) / 2 };
    const variants: IsometricBuildingNode[] = [
      base,
      { ...base, isUnlocked: false },
      ...[1, 3, 5].map((level) => ({ ...base, isUnlocked: true, level })),
    ];
    for (const node of variants) {
      assertPlacement(place(`${base.id}/${node.isUnlocked ? 'açık' : 'kilitli'}/L${node.level}`, buildCore(node), parcel), 0.7);
      n++;
    }
  }
  assert.ok(n >= 40);
});

test('Şehir QA: şehir blokları (boş arsa, her dükkân türü ve seviyesi) yolu kesmez ve parselde kalır', () => {
  assert.ok(blockNodes.length >= 22);
  let n = 0;
  for (const base of blockNodes) {
    const parcel: WorldRect = { cx: wx(base.x), cz: wz(base.y), hw: (base.width * CITY_BLOCK_FOOT) / 2, hd: (base.height * CITY_BLOCK_FOOT) / 2 };
    const variants: CityUrbanBlockNode[] = [base, { ...base, isUnlocked: true }];
    if (SHOP_SLOT_IDS.has(base.id)) {
      for (const t of SHOP_TYPES) for (const level of [1, 3, 5]) {
        variants.push({ ...base, isUnlocked: true, activeShopType: t as CityUrbanBlockNode['activeShopType'], activeShopId: `qa-${t}`, level, shopLot: false });
      }
      variants.push({ ...base, isUnlocked: true, activeShopType: undefined, activeShopId: undefined, shopLot: true });
    }
    for (const node of variants) {
      assertPlacement(place(`${base.id}/${node.activeShopType ?? (node.shopLot ? 'arsa' : node.isUnlocked ? 'açık' : 'kilitli')}/L${node.level ?? 1}`, buildBlock(node), parcel), 0.7);
      n++;
    }
  }
  assert.ok(n > 100, `yalnızca ${n} varyant denetlendi`);
});

test('Şehir QA: Borsa yalnızca giriş noktasında giriş yoluna yaklaşır, gövdesi yolun üstüne binmez', () => {
  const borsa = coreNodes.find((b) => b.id === 'BORSA')!;
  const parcel = coreParcel('BORSA');
  const drive = CITY_GRID.roads.find((r) => r.id === 'borsa-driveway')!;
  assert.equal(drive.kind, 'DRIVEWAY');
  for (const level of [1, 3, 5]) {
    const p = place(`BORSA/L${level}`, buildCore({ ...borsa, isUnlocked: true, level }), parcel);
    assertPlacement(p, 0.9);
    // Gövde, yolun dikdörtgeniyle kesişmez
    const half = drive.width / 2;
    const rect = rectPolygon((drive.x1 + drive.x2) / 2, (drive.z1 + drive.z2) / 2, half, Math.abs(drive.z2 - drive.z1) / 2);
    assert.ok(convexOverlapDepth(p.hull, rect) <= 1e-6, `Borsa L${level}: gövde giriş yolunun üstüne biniyor`);
    // Ayak izinin ön kenarı giriş noktasına (yolun ucu) yaklaşır: aradaki boşluk küçüktür
    const frontZ = Math.max(...p.hull.map((q) => q.z));
    assert.ok(frontZ <= drive.z2 + 1e-6, `Borsa L${level}: ön kenar (${frontZ.toFixed(2)}) giriş noktasını (${drive.z2.toFixed(2)}) aşıyor`);
    assert.ok(drive.z2 - frontZ < 2.5, `Borsa L${level}: bina girişten fazla uzakta (${(drive.z2 - frontZ).toFixed(2)})`);
  }
});

test('Şehir QA: hazır modeller yüklenemese bile bütün binalar yerleşir (kodla çizilmiş yedekler)', async () => {
  const logs: string[] = [];
  const broken = await loadCityAssets({
    fresh: true,
    log: (m) => logs.push(m),
    loader: { load: (_u, _l, _p, onError) => onError?.(new Error('404')) },
  });
  assert.ok(broken.failures().size >= 80, 'bütün modeller başarısız sayılmalı');
  assert.ok(logs.some((l) => l.includes('/models/kaykit/building_A.gltf')), 'günlük TAM dosya yolunu içermeli');
  setCityAssets(broken);
  try {
    for (const base of coreNodes) {
      const parcel: WorldRect = { cx: wx(base.x), cz: wz(base.y), hw: (base.width * CITY_CORE_FOOT) / 2, hd: (base.height * CITY_CORE_FOOT) / 2 };
      assertPlacement(place(`${base.id}/yedek`, buildCore({ ...base, isUnlocked: true, level: 3 }), parcel), 0.7);
    }
    for (const base of blockNodes) {
      const parcel: WorldRect = { cx: wx(base.x), cz: wz(base.y), hw: (base.width * CITY_BLOCK_FOOT) / 2, hd: (base.height * CITY_BLOCK_FOOT) / 2 };
      assertPlacement(place(`${base.id}/yedek`, buildBlock({ ...base, isUnlocked: true }), parcel), 0.7);
    }
  } finally {
    setCityAssets(assets);
  }
});

test('Şehir QA: çevre mahalle evleri ve korular hiçbir yolun asfaltına ya da kaldırımına binmez', () => {
  const spots: Array<[number, number]> = [];
  walkSuburbSpots(createRng('banliyo'), ({ x, z }) => spots.push([x, z]));
  assert.ok(spots.length > 40, `mahalle yeri sayısı beklenenden az: ${spots.length}`);
  for (const [x, z] of spots) {
    assert.ok(
      squareClearOfRoads(x, z, SUBURB_BUILDING_HALF, ROAD_CLEARANCE_PREFERRED),
      `ev (${x.toFixed(1)}, ${z.toFixed(1)}) bir yola ${ROAD_CLEARANCE_PREFERRED} birimden yakın`
    );
  }
  const groves: Array<[number, number]> = [];
  walkGroveSpots(createRng('koru'), spots, (x, z) => groves.push([x, z]));
  assert.ok(groves.length > 10);
  for (const [x, z] of groves) assert.ok(squareClearOfRoads(x, z, 2, 1.0), `koru (${x.toFixed(1)}, ${z.toFixed(1)}) yola çok yakın`);
});
