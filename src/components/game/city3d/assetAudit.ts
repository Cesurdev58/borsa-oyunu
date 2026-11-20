/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 3D model denetimi (`npm run asset-audit`). Tarayıcı ve doku yükleyici gerektirmez: .gltf / .glb dosyasının
 * JSON kısmını okuyup şunları kontrol eder:
 *   - `assetManifest.ts` içindeki her model dosyası gerçekten var ve boş değil
 *   - dosya geçerli glTF 2.0 (JSON ya da GLB başlığı, parça uzunlukları)
 *   - .gltf'in dışarıdan çağırdığı her `buffer` (.bin) ve `image` (.png/.jpg) dosyası var, boyutu yeterli,
 *     görüntünün başlığı gerçekten PNG/JPEG
 *   - erişimci (accessor) / bufferView aralıkları buffer'ın dışına taşmıyor
 *   - sahnenin dünya sınır kutusu SONLU ve her eksende SIFIRDAN BÜYÜK (NaN / sıfır boyutlu model yok)
 * Her sorun TAM dosya yoluyla raporlanır. Oyun aynı kuralı (`boundsProblem`) çalışma anında da uygular ve sorunlu
 * modelin yerine adına uygun yedek model koyar (`assetFallback.ts`).
 *
 * Dosya sistemi dışarıdan verilir (`AuditFs`) → testler sahte dosya sistemiyle çalışır.
 */
import * as THREE from 'three';
import { ASSET_MANIFEST, boundsProblem, type AssetManifestEntry } from './assetManifest';

export interface AuditFs {
  /** Mutlak yolun dosya olarak var olup olmadığı */
  exists(absPath: string): boolean;
  /** Dosyanın bayt içeriği (yoksa hata fırlatır) */
  read(absPath: string): Uint8Array;
}

export type AssetIssueKind =
  | 'MISSING_FILE'
  | 'EMPTY_FILE'
  | 'BAD_FORMAT'
  | 'MISSING_BUFFER'
  | 'BUFFER_TOO_SMALL'
  | 'MISSING_IMAGE'
  | 'BAD_IMAGE'
  | 'BAD_ACCESSOR'
  | 'NO_GEOMETRY'
  | 'BAD_BOUNDS';

export interface AssetIssue {
  name: string;
  kind: AssetIssueKind;
  /** Sorunlu dosyanın TAM yolu (model dosyası ya da onun çağırdığı .bin / .png) */
  file: string;
  message: string;
}

export interface AssetAuditEntryResult {
  name: string;
  file: string;
  ok: boolean;
  issues: AssetIssue[];
  /** Ölçülebildiyse sahnenin dünya sınır kutusu boyutu */
  size?: { x: number; y: number; z: number };
}

export interface AssetAuditReport {
  checked: number;
  ok: number;
  failed: number;
  results: AssetAuditEntryResult[];
  issues: AssetIssue[];
  /** Manifest'te olmayan ve hiçbir model tarafından da çağrılmayan dosyalar (bilgi; hata sayılmaz) */
  orphanFiles: string[];
}

const dirOf = (p: string) => p.replace(/[\\/][^\\/]*$/, '');
const join = (dir: string, rel: string) => `${dir.replace(/[\\/]+$/, '')}/${rel.replace(/^[\\/]+/, '')}`;

interface Gltf {
  asset?: { version?: string };
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: Array<{
    mesh?: number;
    children?: number[];
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }>;
  meshes?: Array<{ primitives?: Array<{ attributes?: Record<string, number>; indices?: number }> }>;
  accessors?: Array<{
    bufferView?: number;
    byteOffset?: number;
    componentType?: number;
    count?: number;
    type?: string;
    min?: number[];
    max?: number[];
    sparse?: unknown;
  }>;
  bufferViews?: Array<{ buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }>;
  buffers?: Array<{ uri?: string; byteLength: number }>;
  images?: Array<{ uri?: string; bufferView?: number; mimeType?: string }>;
  textures?: Array<{ source?: number }>;
  materials?: Array<Record<string, unknown>>;
}

const COMPONENT_BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function parseGlb(bytes: Uint8Array): { json: Gltf; binLength: number } | string {
  if (bytes.length < 20) return `GLB çok kısa (${bytes.length} bayt)`;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) return 'GLB başlığı geçersiz (glTF sihirli sayısı yok)';
  if (dv.getUint32(4, true) !== 2) return `GLB sürümü 2 değil (${dv.getUint32(4, true)})`;
  const total = dv.getUint32(8, true);
  if (total !== bytes.length) return `GLB uzunluğu uyuşmuyor (başlık ${total}, dosya ${bytes.length}) — dosya kesilmiş olabilir`;
  let off = 12;
  let json: Gltf | null = null;
  let binLength = 0;
  while (off + 8 <= bytes.length) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (start + len > bytes.length) return 'GLB parçası dosyanın dışına taşıyor';
    if (type === 0x4e4f534a) {
      try {
        json = JSON.parse(new TextDecoder().decode(bytes.subarray(start, start + len))) as Gltf;
      } catch (e) {
        return `GLB JSON parçası okunamadı: ${(e as Error).message}`;
      }
    } else if (type === 0x004e4942) {
      binLength = len;
    }
    off = start + len; // GLB parça uzunlukları zaten 4 bayta hizalıdır
  }
  return json ? { json, binLength } : 'GLB içinde JSON parçası yok';
}

function imageMagicOk(bytes: Uint8Array): boolean {
  const png = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
  return png || jpg;
}

function localMatrix(n: NonNullable<Gltf['nodes']>[number]): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  if (n.matrix && n.matrix.length === 16) return m.fromArray(n.matrix);
  const t = n.translation ?? [0, 0, 0];
  const r = n.rotation ?? [0, 0, 0, 1];
  const s = n.scale ?? [1, 1, 1];
  return m.compose(new THREE.Vector3(t[0], t[1], t[2]), new THREE.Quaternion(r[0], r[1], r[2], r[3]), new THREE.Vector3(s[0], s[1], s[2]));
}

/** Sahnenin dünya sınır kutusunu POSITION erişimcilerinin min/max değerlerinden hesaplar. */
function sceneBounds(gltf: Gltf, problems: string[]): THREE.Box3 | null {
  const nodes = gltf.nodes ?? [];
  const roots = gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? nodes.map((_, i) => i).filter((i) => !nodes.some((n) => n.children?.includes(i)));
  const box = new THREE.Box3();
  let any = false;
  const visit = (index: number, parent: THREE.Matrix4, depth: number) => {
    if (depth > 64 || !nodes[index]) return;
    const world = new THREE.Matrix4().multiplyMatrices(parent, localMatrix(nodes[index]));
    const meshIndex = nodes[index].mesh;
    if (meshIndex !== undefined) {
      for (const prim of gltf.meshes?.[meshIndex]?.primitives ?? []) {
        const accIndex = prim.attributes?.POSITION;
        const acc = accIndex === undefined ? undefined : gltf.accessors?.[accIndex];
        if (!acc || !acc.min || !acc.max || acc.min.length < 3 || acc.max.length < 3) {
          problems.push(`mesh ${meshIndex}: POSITION erişimcisinde min/max yok`);
          continue;
        }
        const lo = acc.min;
        const hi = acc.max;
        for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
          box.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(world));
          any = true;
        }
      }
    }
    for (const c of nodes[index].children ?? []) visit(c, world, depth + 1);
  };
  for (const r of roots) visit(r, new THREE.Matrix4(), 0);
  return any ? box : null;
}

/** Bir modelin denetimi. `publicDir` = projedeki `public` klasörünün mutlak yolu. */
export function auditAsset(entry: AssetManifestEntry, publicDir: string, fs: AuditFs): AssetAuditEntryResult {
  const file = join(publicDir, entry.path);
  const issues: AssetIssue[] = [];
  const add = (kind: AssetIssueKind, f: string, message: string) => issues.push({ name: entry.name, kind, file: f, message });
  const finish = (size?: AssetAuditEntryResult['size']): AssetAuditEntryResult => ({ name: entry.name, file, ok: issues.length === 0, issues, size });

  if (!fs.exists(file)) {
    add('MISSING_FILE', file, 'model dosyası yok');
    return finish();
  }
  let bytes: Uint8Array;
  try {
    bytes = fs.read(file);
  } catch (e) {
    add('MISSING_FILE', file, `okunamadı: ${(e as Error).message}`);
    return finish();
  }
  if (bytes.length === 0) {
    add('EMPTY_FILE', file, 'model dosyası boş (0 bayt)');
    return finish();
  }

  let gltf: Gltf;
  let glbBinLength = 0;
  if (entry.format === 'glb') {
    const r = parseGlb(bytes);
    if (typeof r === 'string') {
      add('BAD_FORMAT', file, r);
      return finish();
    }
    gltf = r.json;
    glbBinLength = r.binLength;
  } else {
    try {
      gltf = JSON.parse(new TextDecoder().decode(bytes)) as Gltf;
    } catch (e) {
      add('BAD_FORMAT', file, `glTF JSON okunamadı: ${(e as Error).message}`);
      return finish();
    }
  }
  if (gltf.asset?.version !== '2.0') add('BAD_FORMAT', file, `glTF sürümü 2.0 değil (${gltf.asset?.version ?? 'yok'})`);

  const dir = dirOf(file);
  const bufferLengths: number[] = [];
  (gltf.buffers ?? []).forEach((b, i) => {
    bufferLengths[i] = b.byteLength;
    if (b.uri === undefined) {
      // GLB'nin gömülü BIN parçası
      if (entry.format === 'glb') {
        if (glbBinLength < b.byteLength) add('BUFFER_TOO_SMALL', file, `buffer ${i}: gömülü BIN parçası ${glbBinLength} bayt, beklenen ${b.byteLength}`);
      } else {
        add('MISSING_BUFFER', file, `buffer ${i}: uri yok (.gltf dışarıdan .bin göstermeli)`);
      }
      return;
    }
    if (b.uri.startsWith('data:')) return;
    const p = join(dir, decodeURIComponent(b.uri));
    if (!fs.exists(p)) {
      add('MISSING_BUFFER', p, `buffer ${i}: "${b.uri}" dosyası yok`);
      return;
    }
    const size = fs.read(p).length;
    if (size < b.byteLength) add('BUFFER_TOO_SMALL', p, `buffer ${i}: dosya ${size} bayt, beklenen en az ${b.byteLength} (kesilmiş)`);
  });

  (gltf.images ?? []).forEach((img, i) => {
    if (img.uri === undefined) {
      if (img.bufferView === undefined) add('BAD_IMAGE', file, `image ${i}: ne uri ne bufferView var`);
      return;
    }
    if (img.uri.startsWith('data:')) return;
    const p = join(dir, decodeURIComponent(img.uri));
    if (!fs.exists(p)) {
      add('MISSING_IMAGE', p, `image ${i}: "${img.uri}" dokusu yok`);
      return;
    }
    const data = fs.read(p);
    if (data.length === 0) add('BAD_IMAGE', p, `image ${i}: doku dosyası boş`);
    else if (!imageMagicOk(data)) add('BAD_IMAGE', p, `image ${i}: PNG/JPEG başlığı geçersiz (bozuk ya da yanlış uzantı)`);
  });

  (gltf.textures ?? []).forEach((t, i) => {
    if (t.source !== undefined && !(gltf.images ?? [])[t.source]) add('BAD_IMAGE', file, `texture ${i}: image ${t.source} listede yok`);
  });

  (gltf.bufferViews ?? []).forEach((v, i) => {
    const len = bufferLengths[v.buffer];
    if (len === undefined) add('BAD_ACCESSOR', file, `bufferView ${i}: buffer ${v.buffer} yok`);
    else if ((v.byteOffset ?? 0) + v.byteLength > len) add('BAD_ACCESSOR', file, `bufferView ${i}: buffer'ın dışına taşıyor`);
  });
  (gltf.accessors ?? []).forEach((a, i) => {
    if (a.bufferView === undefined || a.sparse) return;
    const v = gltf.bufferViews?.[a.bufferView];
    const cb = COMPONENT_BYTES[a.componentType ?? 0];
    const nc = TYPE_COMPONENTS[a.type ?? ''];
    if (!v || !cb || !nc || a.count === undefined) {
      add('BAD_ACCESSOR', file, `accessor ${i}: bufferView/tür/sayı eksik`);
      return;
    }
    const need = (a.byteOffset ?? 0) + (v.byteStride ? v.byteStride * (a.count - 1) + cb * nc : a.count * cb * nc);
    if (need > v.byteLength) add('BAD_ACCESSOR', file, `accessor ${i}: bufferView ${a.bufferView} aralığının dışına taşıyor`);
  });

  const hasPrimitive = (gltf.meshes ?? []).some((m) => (m.primitives ?? []).length > 0);
  if (!hasPrimitive) {
    add('NO_GEOMETRY', file, 'dosyada hiç mesh/primitive yok');
    return finish();
  }
  const boundsNotes: string[] = [];
  const box = sceneBounds(gltf, boundsNotes);
  for (const n of boundsNotes) add('BAD_BOUNDS', file, n);
  if (!box) {
    if (boundsNotes.length === 0) add('BAD_BOUNDS', file, 'sahne sınır kutusu hesaplanamadı');
    return finish();
  }
  const size = box.getSize(new THREE.Vector3());
  const problem = boundsProblem(size.x, size.y, size.z);
  if (problem) add('BAD_BOUNDS', file, problem);
  return finish({ x: size.x, y: size.y, z: size.z });
}

/** Bütün listeyi denetler. `listFiles` verilirse manifest dışı dosyalar "yetim" olarak raporlanır. */
export function auditAssets(
  publicDir: string,
  fs: AuditFs,
  options: { manifest?: readonly AssetManifestEntry[]; listFiles?: (dir: string) => string[] } = {}
): AssetAuditReport {
  const manifest = options.manifest ?? ASSET_MANIFEST;
  const results = manifest.map((e) => auditAsset(e, publicDir, fs));
  const issues = results.flatMap((r) => r.issues);
  const used = new Set<string>(manifest.map((e) => join(publicDir, e.path)));
  // Modellerin çağırdığı .bin / .png dosyaları da "kullanılıyor" sayılır
  for (const e of manifest) {
    const file = join(publicDir, e.path);
    if (!fs.exists(file)) continue;
    try {
      const bytes = fs.read(file);
      let json: Gltf | null = null;
      if (e.format === 'glb') {
        const r = parseGlb(bytes);
        json = typeof r === 'string' ? null : r.json;
      } else {
        json = JSON.parse(new TextDecoder().decode(bytes)) as Gltf;
      }
      const dir = dirOf(file);
      for (const b of json?.buffers ?? []) if (b.uri && !b.uri.startsWith('data:')) used.add(join(dir, decodeURIComponent(b.uri)));
      for (const im of json?.images ?? []) if (im.uri && !im.uri.startsWith('data:')) used.add(join(dir, decodeURIComponent(im.uri)));
    } catch {
      /* bozuk dosya zaten sorun olarak raporlandı */
    }
  }
  const orphanFiles = options.listFiles
    ? options
        .listFiles(join(publicDir, 'models'))
        .filter((f) => /\.(gltf|glb|bin|png|jpg|jpeg)$/i.test(f) && !used.has(f))
        .sort()
    : [];
  return {
    checked: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    issues,
    orphanFiles,
  };
}
