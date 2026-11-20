/**
 * ŞEHİR QA — ortak kaynakların güvenli bırakılması: bir bina silinirken (ya da sahne kapanırken) başka binaların
 * kullandığı malzeme, geometri ve dokulara DOKUNULMAZ; gece pencere ışığı kaydı bozulmaz; yalnızca binaya özel
 * kaynaklar serbest kalır.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadCityAssets, mergeByLook, mergeStatic, type CityAssets } from '../../components/game/city3d/assets';
import {
  disposeKit,
  disposeObject,
  isGlowMaterial,
  isSharedResource,
  kitStats,
  makeBody,
  createRng,
  markSharedResource,
  retainKit,
  setWindowGlow,
} from '../../components/game/city3d/kit';
import { diskLoader, installDomStubs } from './city3dHarness';

let assets: CityAssets;

before(async () => {
  installDomStubs();
  assets = await loadCityAssets({
    fresh: true,
    loader: diskLoader(),
    only: ['building_A', 'building_C', 'tree_A', 'building-type-a', 'building-skyscraper-a'],
  });
  assert.equal(assets.failures().size, 0);
});

function materialsOf(o: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out = new Set<THREE.MeshStandardMaterial>();
  o.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) out.add(mat as THREE.MeshStandardMaterial);
  });
  return [...out];
}
function geometriesOf(o: THREE.Object3D): THREE.BufferGeometry[] {
  const out = new Set<THREE.BufferGeometry>();
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) out.add((m as THREE.Mesh).geometry);
  });
  return [...out];
}
/** Nesnenin 'dispose' olayını sayar */
function spy(target: THREE.EventDispatcher<{ dispose: object }>): { count: number } {
  const s = { count: 0 };
  target.addEventListener('dispose', () => s.count++);
  return s;
}

test('Ortak kaynaklar: hazır model kopyası silinince başka kopyanın geometri, malzeme ve dokusu serbest kalmaz', () => {
  const a = assets.clone('building_A');
  const b = assets.clone('building_A');
  const mats = materialsOf(b);
  const geos = geometriesOf(b);
  const texs = mats.flatMap((m) => [m.map, m.emissiveMap]).filter((t): t is THREE.Texture => !!t);
  assert.ok(mats.length > 0 && geos.length > 0 && texs.length > 0, 'test modeli doku içermeli');
  for (const m of mats) assert.ok(isSharedResource(m), 'hazır model malzemesi ortak işaretli olmalı');
  for (const g of geos) assert.ok(isSharedResource(g));
  for (const t of texs) assert.ok(isSharedResource(t));
  const spies = [...mats, ...geos, ...texs].map((x) => spy(x as unknown as THREE.EventDispatcher<{ dispose: object }>));

  const freed = disposeObject(a);
  assert.equal(freed, 0, 'ortak kaynak serbest bırakıldı');
  assert.deepEqual(spies.map((s) => s.count), spies.map(() => 0), 'ortak kaynaklara dispose çağrıldı');
  // Aynı model sonradan da kullanılabilir
  const c = assets.clone('building_A');
  assert.ok(materialsOf(c).every((m) => mats.includes(m)), 'yeni kopya aynı ortak malzemeyi kullanmalı');
});

test('Ortak kaynaklar: bina silinince gece pencere ışığı kaydı bozulmaz, başka binanın pencereleri yanmaya devam eder', () => {
  const a = assets.clone('building_C');
  const b = assets.clone('building_C');
  const glow = materialsOf(b).filter((m) => isGlowMaterial(m));
  assert.ok(glow.length > 0, 'hazır bina modelinde yanan pencere malzemesi olmalı');
  disposeObject(a);
  for (const m of glow) assert.equal(isGlowMaterial(m), true, 'silme, pencere ışığı kaydını sildi');
  setWindowGlow(1);
  for (const m of glow) assert.equal(m.emissiveIntensity, 1);
  setWindowGlow(0);
  // Hazır modelin pencere ışık haritası (doku) hâlâ ortak ve serbest bırakılmamış
  for (const m of glow) assert.ok(m.emissiveMap && isSharedResource(m.emissiveMap));
});

test('Ortak kaynaklar: birleştirilmiş (mergeByLook / mergeStatic) çıktı silinince yeni geometri gider, ortak malzeme ve doku kalır', () => {
  const src = assets.clone('building-type-a');
  const shared = materialsOf(src);
  const sharedSpies = shared.map((m) => spy(m as unknown as THREE.EventDispatcher<{ dispose: object }>));
  const merged = mergeByLook(src);
  const mergedGeos = geometriesOf(merged);
  assert.ok(mergedGeos.length > 0);
  assert.ok(mergedGeos.every((g) => !isSharedResource(g)), 'birleştirme yeni (özel) geometri üretmeli');
  const geoSpies = mergedGeos.map((g) => spy(g as unknown as THREE.EventDispatcher<{ dispose: object }>));
  const freed = disposeObject(merged);
  assert.equal(freed, mergedGeos.length, 'yalnızca birleştirmede oluşan geometriler serbest kalmalı');
  assert.ok(geoSpies.every((s) => s.count === 1));
  assert.deepEqual(sharedSpies.map((s) => s.count), sharedSpies.map(() => 0));

  const stat = mergeStatic([assets.clone('tree_A'), assets.clone('tree_A')], false, 0);
  disposeObject(stat);
  assert.deepEqual(sharedSpies.map((s) => s.count), sharedSpies.map(() => 0));
  assert.ok(materialsOf(assets.clone('tree_A')).every((m) => isSharedResource(m)));
});

test('Ortak kaynaklar: tam sahne silme yolu (üst grubu silmek) hazır model kaynaklarına dokunmaz', () => {
  const scene = new THREE.Scene();
  const parts = ['building_A', 'building_C', 'tree_A', 'building-skyscraper-a'].map((n) => assets.clone(n));
  parts.forEach((p) => scene.add(p));
  const mats = parts.flatMap(materialsOf);
  const geos = parts.flatMap(geometriesOf);
  const spies = [...mats, ...geos].map((x) => spy(x as unknown as THREE.EventDispatcher<{ dispose: object }>));
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial())); // özel kaynak
  const freed = disposeObject(scene);
  assert.equal(freed, 2, 'yalnızca özel kutunun geometri + malzemesi serbest kalmalı');
  assert.deepEqual(spies.map((s) => s.count), spies.map(() => 0));
});

test('Özel kaynaklar: koddan çizilen binanın malzeme ve kendi dokuları serbest kalır, ortak doku önbelleği kalır', () => {
  retainKit();
  try {
    const rng = createRng('test');
    const a = makeBody({ w: 6, h: 10, d: 6, wall: '#d8d0c0' }, rng);
    const b = makeBody({ w: 6, h: 10, d: 6, wall: '#d8d0c0' }, rng);
    const aMats = materialsOf(a);
    const bMats = materialsOf(b);
    assert.ok(aMats.length > 0);
    const aSpies = aMats.map((m) => spy(m as unknown as THREE.EventDispatcher<{ dispose: object }>));
    const aTexs = aMats.flatMap((m) => [m.map, m.emissiveMap]).filter((t): t is THREE.Texture => !!t);
    const aTexSpies = aTexs.map((t) => spy(t as unknown as THREE.EventDispatcher<{ dispose: object }>));
    const bMapSpies = bMats.flatMap((m) => [m.map, m.emissiveMap]).filter((t): t is THREE.Texture => !!t).map((t) => spy(t as unknown as THREE.EventDispatcher<{ dispose: object }>));
    const glowBefore = bMats.filter((m) => isGlowMaterial(m)).length;
    assert.ok(glowBefore > 0);

    disposeObject(a);
    assert.ok(aSpies.every((s) => s.count === 1), 'binanın kendi malzemeleri serbest kalmalı');
    assert.ok(aTexSpies.every((s) => s.count === 1), 'binanın kendi doku kopyaları serbest kalmalı');
    assert.ok(aMats.every((m) => !isGlowMaterial(m)), 'silinen binanın pencere kaydı temizlenmeli');
    // Aynı gövde şablonundan çizilen DİĞER bina etkilenmez
    assert.ok(bMapSpies.every((s) => s.count === 0), 'diğer binanın dokusu serbest kaldı');
    assert.equal(bMats.filter((m) => isGlowMaterial(m)).length, glowBefore, 'diğer binanın pencere kaydı bozuldu');
    disposeObject(b);
  } finally {
    disposeKit();
  }
});

test('Ortak kaynaklar: doku önbelleği yalnızca SON sahne kapanınca temizlenir (iki sahne üst üste açılırsa)', () => {
  // Önbelleği bir cisimle doldur
  retainKit();
  retainKit();
  const base = kitStats();
  assert.equal(base.users, 2);
  makeBody({ w: 5, h: 8, d: 5, wall: '#cfd8dc' }, createRng('x'));
  assert.ok(kitStats().textures > 0);
  disposeKit(); // birinci sahne kapandı, ikincisi hâlâ açık
  assert.equal(kitStats().users, 1);
  assert.ok(kitStats().textures > 0, 'açık sahne varken doku önbelleği silindi');
  disposeKit(); // son sahne
  assert.equal(kitStats().users, 0);
  assert.equal(kitStats().textures, 0, 'son sahne kapanınca önbellek temizlenmeli');
  disposeKit(); // fazladan çağrı hata vermez
  assert.equal(kitStats().users, 0);
});

test('Ortak kaynaklar: elle ortak işaretlenen kaynak hiçbir silmede serbest kalmaz', () => {
  const mat = markSharedResource(new THREE.MeshStandardMaterial())!;
  const geo = markSharedResource(new THREE.BoxGeometry(1, 1, 1))!;
  const ms = spy(mat as unknown as THREE.EventDispatcher<{ dispose: object }>);
  const gs = spy(geo as unknown as THREE.EventDispatcher<{ dispose: object }>);
  const holder = new THREE.Group();
  holder.add(new THREE.Mesh(geo, mat), new THREE.Mesh(geo, mat));
  assert.equal(disposeObject(holder), 0);
  assert.equal(ms.count + gs.count, 0);
});
