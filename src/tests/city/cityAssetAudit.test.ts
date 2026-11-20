/**
 * ŞEHİR QA — 3D model denetimi (`npm run asset-audit`) ve yükleme hatasında yedek model:
 *  - gerçek dosyalar: 88 modelin hepsi var, tam, sınır kutuları sonlu ve sıfırdan büyük
 *  - sahte dosya sistemiyle her bozulma türü yakalanır ve TAM dosya yoluyla bildirilir
 *  - yüklenemeyen / sıfır boyutlu model yerine adına uygun yedek model döner (boş grup değil), günlük TAM yolu içerir
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ASSET_FILES, ASSET_MANIFEST, assetUrl, boundsProblem, type AssetManifestEntry } from '../../components/game/city3d/assetManifest';
import { auditAsset, auditAssets } from '../../components/game/city3d/assetAudit';
import { fitModel, loadCityAssets } from '../../components/game/city3d/assets';
import { fallbackKind, makeFallbackModel } from '../../components/game/city3d/assetFallback';
import { PUBLIC_DIR, installDomStubs, memoryAuditFs, nodeAuditFs } from './city3dHarness';

installDomStubs();

test('Model denetimi: gerçek dosyaların hepsi var ve geçerli (88 model)', () => {
  const report = auditAssets(PUBLIC_DIR, nodeAuditFs);
  assert.equal(report.checked, ASSET_MANIFEST.length);
  assert.ok(report.checked >= 88);
  assert.deepEqual(
    report.issues.map((i) => `${i.kind} ${i.file}: ${i.message}`),
    [],
    'gerçek model dosyalarında sorun var'
  );
  for (const r of report.results) {
    assert.ok(r.size && Number.isFinite(r.size.x) && r.size.x > 0 && r.size.y > 0 && r.size.z > 0, `${r.name}: sınır kutusu geçersiz`);
  }
});

test('Model denetimi: liste tutarlı (benzersiz ad ve yol, assets.ts ile aynı kaynak)', () => {
  const names = new Set(ASSET_MANIFEST.map((e) => e.name));
  const paths = new Set(ASSET_MANIFEST.map((e) => e.path));
  assert.equal(names.size, ASSET_MANIFEST.length);
  assert.equal(paths.size, ASSET_MANIFEST.length);
  assert.equal(Object.keys(ASSET_FILES).length, ASSET_MANIFEST.length);
  assert.equal(assetUrl('tree_A', '/'), '/models/kaykit/tree_A.gltf');
  assert.equal(assetUrl('building-a', '/oyun/'), '/oyun/models/kenney-commercial/building-a.glb');
  assert.equal(boundsProblem(1, 2, 3), null);
  assert.ok(boundsProblem(0, 2, 3)?.includes('sıfır'));
  assert.ok(boundsProblem(NaN, 2, 3)?.includes('NaN'));
  assert.ok(boundsProblem(1, Infinity, 3)?.includes('NaN'));
});

// ---------- Sahte dosya sistemiyle bozulmalar ----------
const PUB = '/proje/public';
const ENTRY: AssetManifestEntry = { name: 'deneme', pack: 'kaykit', path: 'models/kaykit/deneme.gltf', format: 'gltf' };
const FILE = `${PUB}/models/kaykit/deneme.gltf`;
const BIN = `${PUB}/models/kaykit/deneme.bin`;
const PNG = `${PUB}/models/kaykit/doku.png`;
const GOOD_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function gltf(over: Record<string, unknown> = {}, min = [0, 0, 0], max = [1, 2, 3]): string {
  return JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min, max }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    buffers: [{ uri: 'deneme.bin', byteLength: 36 }],
    images: [{ uri: 'doku.png' }],
    textures: [{ source: 0 }],
    ...over,
  });
}
const goodFiles = (): Record<string, string | Uint8Array> => ({ [FILE]: gltf(), [BIN]: new Uint8Array(36), [PNG]: GOOD_PNG });
const audit = (files: Record<string, string | Uint8Array>) => auditAsset(ENTRY, PUB, memoryAuditFs(files));

test('Model denetimi (sahte dosya sistemi): sağlam model temiz çıkar, boyutu ölçülür', () => {
  const r = audit(goodFiles());
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.size, { x: 1, y: 2, z: 3 });
});

test('Model denetimi: eksik model dosyası TAM yolla bildirilir', () => {
  const f = goodFiles();
  delete f[FILE];
  const r = audit(f);
  assert.equal(r.ok, false);
  assert.equal(r.issues[0].kind, 'MISSING_FILE');
  assert.equal(r.issues[0].file, FILE);
});

test('Model denetimi: eksik .bin, kesik .bin, eksik/bozuk doku ayrı ayrı ve çağrılan dosyanın TAM yoluyla bildirilir', () => {
  let f = goodFiles();
  delete f[BIN];
  let r = audit(f);
  assert.ok(r.issues.some((i) => i.kind === 'MISSING_BUFFER' && i.file === BIN), JSON.stringify(r.issues));

  f = goodFiles();
  f[BIN] = new Uint8Array(10);
  r = audit(f);
  assert.ok(r.issues.some((i) => i.kind === 'BUFFER_TOO_SMALL' && i.file === BIN));

  f = goodFiles();
  delete f[PNG];
  r = audit(f);
  assert.ok(r.issues.some((i) => i.kind === 'MISSING_IMAGE' && i.file === PNG));

  f = goodFiles();
  f[PNG] = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  r = audit(f);
  assert.ok(r.issues.some((i) => i.kind === 'BAD_IMAGE' && i.file === PNG));

  f = goodFiles();
  f[PNG] = new Uint8Array(0);
  assert.ok(audit(f).issues.some((i) => i.kind === 'BAD_IMAGE' && i.file === PNG));
});

test('Model denetimi: sıfır ve NaN/sonsuz sınır kutuları, geometrisiz dosya, bozuk JSON yakalanır', () => {
  let r = audit({ ...goodFiles(), [FILE]: gltf({}, [1, 1, 1], [1, 1, 1]) });
  assert.ok(r.issues.some((i) => i.kind === 'BAD_BOUNDS' && /sıfır/.test(i.message) && i.file === FILE), JSON.stringify(r.issues));

  // JSON'da NaN yazılamaz; 1e999 Infinity'ye çözülür
  r = audit({ ...goodFiles(), [FILE]: gltf().replace('"max":[1,2,3]', '"max":[1,1e999,3]') });
  assert.ok(r.issues.some((i) => i.kind === 'BAD_BOUNDS' && /NaN|sonsuz/.test(i.message)), JSON.stringify(r.issues));

  r = audit({ ...goodFiles(), [FILE]: gltf({ meshes: [] , nodes: [{}] }) });
  assert.ok(r.issues.some((i) => i.kind === 'NO_GEOMETRY'));

  r = audit({ ...goodFiles(), [FILE]: '{ bozuk json' });
  assert.ok(r.issues.some((i) => i.kind === 'BAD_FORMAT' && i.file === FILE));

  r = audit({ ...goodFiles(), [FILE]: new Uint8Array(0) });
  assert.ok(r.issues.some((i) => i.kind === 'EMPTY_FILE'));

  r = audit({ ...goodFiles(), [FILE]: gltf({ accessors: [{ bufferView: 0, componentType: 5126, count: 99, type: 'VEC3', min: [0, 0, 0], max: [1, 2, 3] }] }) });
  assert.ok(r.issues.some((i) => i.kind === 'BAD_ACCESSOR'), 'bufferView dışına taşan erişimci yakalanmalı');
});

test('Model denetimi: GLB başlığı ve uzunluğu denetlenir (kesik GLB yakalanır)', () => {
  const json = new TextEncoder().encode(gltf({ buffers: [{ byteLength: 36 }], images: [], textures: [] }));
  const pad = (4 - (json.length % 4)) % 4;
  const jsonChunk = new Uint8Array(json.length + pad).fill(0x20);
  jsonChunk.set(json);
  const bin = new Uint8Array(36);
  const total = 12 + 8 + jsonChunk.length + 8 + bin.length;
  const glb = new Uint8Array(total);
  const dv = new DataView(glb.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonChunk.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  glb.set(jsonChunk, 20);
  const o = 20 + jsonChunk.length;
  dv.setUint32(o, bin.length, true);
  dv.setUint32(o + 4, 0x004e4942, true);
  glb.set(bin, o + 8);
  const entry: AssetManifestEntry = { name: 'g', pack: 'kenney-commercial', path: 'models/kenney-commercial/g.glb', format: 'glb' };
  const file = `${PUB}/${entry.path}`;
  assert.deepEqual(auditAsset(entry, PUB, memoryAuditFs({ [file]: glb })).issues, []);
  const cut = glb.slice(0, total - 20);
  const r = auditAsset(entry, PUB, memoryAuditFs({ [file]: cut }));
  assert.ok(r.issues.some((i) => i.kind === 'BAD_FORMAT' && i.file === file && /kesilmiş|uyuşmuyor/.test(i.message)), JSON.stringify(r.issues));
  const wrongMagic = glb.slice();
  wrongMagic[0] = 0;
  assert.ok(auditAsset(entry, PUB, memoryAuditFs({ [file]: wrongMagic })).issues.some((i) => i.kind === 'BAD_FORMAT'));
});

test('Model denetimi: rapor sayıları ve yetim dosyalar', () => {
  const manifest: AssetManifestEntry[] = [ENTRY, { ...ENTRY, name: 'yok', path: 'models/kaykit/yok.gltf' }];
  const files = { ...goodFiles(), [`${PUB}/models/kaykit/kullanilmayan.png`]: GOOD_PNG };
  const fs = memoryAuditFs(files);
  const rep = auditAssets(PUB, fs, { manifest, listFiles: () => Object.keys(files) });
  assert.equal(rep.checked, 2);
  assert.equal(rep.ok, 1);
  assert.equal(rep.failed, 1);
  assert.deepEqual(rep.orphanFiles, [`${PUB}/models/kaykit/kullanilmayan.png`]);
});

// ---------- Çalışma anında yedek model ----------
function boxScene(w: number, h: number, d: number): { scene: THREE.Group } {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ name: 'm' })));
  return { scene: g };
}

test('Yedek model: yüklenemeyen ve sıfır boyutlu modeller TAM yolla günlüğe yazılır, adına uygun yedek döner', async () => {
  const logs: string[] = [];
  const names = ['tree_A', 'bush_A', 'building_A', 'car_taxi', 'building-skyscraper-a'];
  const assets = await loadCityAssets({
    fresh: true,
    only: names,
    log: (m) => logs.push(m),
    loader: {
      load(url, onLoad, _p, onError) {
        if (url.endsWith('tree_A.gltf')) onError?.(new Error('404 Not Found'));
        else if (url.endsWith('bush_A.gltf')) onLoad(boxScene(0, 1, 1)); // sıfır genişlik
        else if (url.endsWith('car_taxi.gltf')) onLoad(boxScene(NaN, 1, 1)); // NaN
        else onLoad(boxScene(2, 3, 2)); // sağlam
      },
    },
  });
  const f = assets.failures();
  assert.deepEqual([...f.keys()].sort(), ['bush_A', 'car_taxi', 'tree_A']);
  assert.equal(f.get('tree_A')!.url, '/models/kaykit/tree_A.gltf');
  assert.ok(/404/.test(f.get('tree_A')!.reason));
  assert.ok(/sıfır/.test(f.get('bush_A')!.reason));
  assert.ok(/NaN/.test(f.get('car_taxi')!.reason));
  for (const [name, p] of [['tree_A', '/models/kaykit/tree_A.gltf'], ['bush_A', '/models/kaykit/bush_A.gltf'], ['car_taxi', '/models/kaykit/car_taxi.gltf']]) {
    assert.ok(logs.some((l) => l.includes(p) && l.includes('Yedek')), `${name}: günlük TAM yolu içermeli`);
  }
  // Sağlam modeller gerçek kalır; yedekler gerçek sayılmaz (kodla çizilmiş binalar yedeğe tercih edilir)
  assert.equal(assets.has('building_A'), true);
  assert.equal(assets.isFallback('building_A'), false);
  for (const n of ['tree_A', 'bush_A', 'car_taxi']) {
    assert.equal(assets.has(n), false);
    assert.equal(assets.isFallback(n), true);
  }
  // Yedekler boş değil ve türüne uygun
  const kinds: Record<string, string> = { tree_A: 'tree', bush_A: 'bush', car_taxi: 'car' };
  for (const [n, k] of Object.entries(kinds)) {
    const c = assets.clone(n);
    const bb = new THREE.Box3().setFromObject(c);
    assert.ok(!bb.isEmpty(), `${n}: yedek model boş`);
    const sz = bb.getSize(new THREE.Vector3());
    assert.ok(sz.x > 0.1 && sz.y > 0.1 && sz.z > 0.1, `${n}: yedek boyutu sıfır`);
    assert.equal(c.userData.fallbackKind, k);
    const s = assets.size(n);
    assert.ok(s.x > 0 && s.y > 0 && s.z > 0);
  }
  // Ortak kullanımdaki fitModel de yedekle çalışır
  const fitted = fitModel(assets, 'tree_A', 4);
  const fs = new THREE.Box3().setFromObject(fitted).getSize(new THREE.Vector3());
  assert.ok(Math.abs(Math.max(fs.x, fs.z) - 4) < 0.05, `fitModel yedekte yanlış ölçekledi: ${fs.x}`);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(fitted).min.y) < 1e-6, 'taban y=0 olmalı');
});

test('Yedek model: model türüne göre anlamlı (gökdelen uzun, ev çatılı, ağaç ağaç) ve listede olmayan ad bile boş dönmez', () => {
  const height = (n: string) => new THREE.Box3().setFromObject(makeFallbackModel(n)).getSize(new THREE.Vector3()).y;
  assert.equal(fallbackKind('building-skyscraper-c'), 'skyscraper');
  assert.equal(fallbackKind('building-type-h'), 'house');
  assert.equal(fallbackKind('low-detail-building-wide-a'), 'lowrise');
  assert.equal(fallbackKind('tree-large'), 'pine');
  assert.equal(fallbackKind('car_police'), 'car');
  assert.equal(fallbackKind('road_tsplit'), 'road');
  assert.equal(fallbackKind('watertower'), 'watertower');
  assert.ok(height('building-skyscraper-a') > height('building-type-a') * 4, 'gökdelen evden çok daha uzun olmalı');
  assert.ok(height('building_C') > height('low-detail-building-a'));
  for (const e of ASSET_MANIFEST) {
    const bb = new THREE.Box3().setFromObject(makeFallbackModel(e.name));
    const s = bb.getSize(new THREE.Vector3());
    assert.ok(!bb.isEmpty() && s.x > 0 && s.y > 0 && s.z > 0, `${e.name}: yedek model geçersiz`);
    assert.ok(Math.abs(bb.min.y) < 0.25, `${e.name}: yedek taban zeminde değil (min.y=${bb.min.y})`);
  }
  const unknown = makeFallbackModel('hic-bilinmeyen-model');
  assert.ok(!new THREE.Box3().setFromObject(unknown).isEmpty());
  assert.equal(unknown.userData.fallbackKind, 'prop');
});
