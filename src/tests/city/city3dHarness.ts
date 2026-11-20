/**
 * 3D şehir QA testleri için Node tarafı yardımcıları: sahte tarayıcı (canvas, img), diskten gerçek model yükleyici.
 * Test dosyası değildir (`*.test.ts` değil), `npm test` yalnızca testleri çalıştırır.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AssetLoaderLike } from '../../components/game/city3d/assets';
import type { AuditFs } from '../../components/game/city3d/assetAudit';

export const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public');

type Listener = () => void;

function fakeContext2d() {
  const grad = { addColorStop() {} };
  return new Proxy(
    {
      measureText: () => ({ width: 10 }),
      createLinearGradient: () => grad,
      createRadialGradient: () => grad,
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    } as Record<string, unknown>,
    {
      get: (t, k: string) => (k in t ? t[k] : () => undefined),
      set: () => true,
    }
  );
}

function fakeCanvas() {
  return { width: 0, height: 0, style: {}, getContext: () => fakeContext2d(), addEventListener() {}, removeEventListener() {} };
}

function fakeImage() {
  const listeners = new Map<string, Listener[]>();
  const img = {
    width: 16,
    height: 16,
    naturalWidth: 16,
    naturalHeight: 16,
    complete: true,
    style: {},
    addEventListener(type: string, fn: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn));
    },
    set src(_v: string) {
      setTimeout(() => (listeners.get('load') ?? []).slice().forEach((f) => (f as (this: unknown) => void).call(img)), 0);
    },
    get src() {
      return '';
    },
  };
  return img;
}

/** Tarayıcı olmadan three'nin canvas/img kullanan kısımlarını çalıştırır. Birden çok çağrıda güvenlidir. */
export function installDomStubs(): void {
  const g = globalThis as Record<string, unknown>;
  if (g.__city3dStubs) return;
  g.__city3dStubs = true;
  g.document = {
    createElement: (tag: string) => (tag === 'canvas' ? fakeCanvas() : { style: {}, setAttribute() {}, addEventListener() {}, appendChild() {} }),
    createElementNS: (_ns: string, tag: string) => (tag === 'img' ? fakeImage() : fakeCanvas()),
    body: { appendChild() {} },
  };
  if (!g.self) g.self = g;
  if (!g.ProgressEvent) {
    g.ProgressEvent = class ProgressEvent {
      constructor(public type: string, init: Record<string, unknown> = {}) {
        Object.assign(this, init);
      }
    };
  }
}

/** Diskteki gerçek model dosyalarını yükler (url `${base}models/...`; base = '/'). */
export function diskLoader(publicDir = PUBLIC_DIR): AssetLoaderLike {
  const gltf = new GLTFLoader();
  const toDataUri = (file: string, mime: string) => `data:${mime};base64,${readFileSync(file).toString('base64')}`;
  return {
    load(url, onLoad, _p, onError) {
      const fail = (e: unknown) => onError?.(e);
      try {
        const rel = url.replace(/^\//, '');
        const file = join(publicDir, rel);
        if (!existsSync(file)) return fail(new Error(`dosya yok: ${file}`));
        const dir = dirname(file);
        if (file.endsWith('.glb')) {
          const buf = readFileSync(file);
          const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
          gltf.parse(ab, `${dirname(url)}/`, (g) => onLoad(g), fail);
          return;
        }
        const json = JSON.parse(readFileSync(file, 'utf8')) as {
          buffers?: Array<{ uri?: string }>;
          images?: Array<{ uri?: string }>;
        };
        for (const b of json.buffers ?? []) {
          if (b.uri && !b.uri.startsWith('data:')) {
            const f = join(dir, decodeURIComponent(b.uri));
            if (!existsSync(f)) return fail(new Error(`buffer dosyası yok: ${f}`));
            b.uri = toDataUri(f, 'application/octet-stream');
          }
        }
        for (const im of json.images ?? []) {
          if (im.uri && !im.uri.startsWith('data:')) {
            const f = join(dir, decodeURIComponent(im.uri));
            if (!existsSync(f)) return fail(new Error(`doku dosyası yok: ${f}`));
            im.uri = toDataUri(f, 'image/png');
          }
        }
        gltf.parse(JSON.stringify(json), `${dirname(url)}/`, (g) => onLoad(g), fail);
      } catch (e) {
        fail(e);
      }
    },
  };
}

/** Gerçek dosya sistemi üzerinden denetim */
export const nodeAuditFs: AuditFs = {
  exists: (p) => existsSync(p) && statSync(p).isFile(),
  read: (p) => new Uint8Array(readFileSync(p)),
};

/** Bellekte sahte dosya sistemi (yol → bayt ya da metin) */
export function memoryAuditFs(files: Record<string, string | Uint8Array>): AuditFs {
  const enc = new TextEncoder();
  return {
    exists: (p) => p in files,
    read: (p) => {
      const v = files[p];
      if (v === undefined) throw new Error(`dosya yok: ${p}`);
      return typeof v === 'string' ? enc.encode(v) : v;
    },
  };
}
