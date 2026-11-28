import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

test('index.html: iPhone çentik alanı için viewport-fit=cover var', () => {
  const viewport = html.match(/<meta name="viewport" content="([^"]+)"/);
  assert.ok(viewport, 'viewport etiketi var');
  assert.match(viewport[1], /viewport-fit=cover/);
});

test('index.html: başlık ve paylaşım başlığı aynı ürün adı', () => {
  assert.match(html, /<title>Borsa Patronu<\/title>/);
  assert.match(html, /<meta property="og:title" content="Borsa Patronu" \/>/);
});

test('Favicon ve manifest dosyaları var, index.html bağlıyor, manifest geçerli', () => {
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\.\/favicon\.svg" \/>/);
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest" \/>/);
  assert.equal(existsSync(path.join(root, 'public/favicon.svg')), true);
  const manifest = JSON.parse(readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8')) as {
    name: string;
    short_name: string;
    display: string;
    theme_color: string;
    background_color: string;
    start_url: string;
    icons: { src: string }[];
  };
  assert.equal(manifest.name, 'Borsa Patronu');
  assert.ok(manifest.short_name);
  assert.equal(manifest.display, 'standalone');
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  // GitHub Pages alt yolunda kırılmasın diye manifest içi yollar göreli
  assert.equal(manifest.start_url.startsWith('/'), false);
  for (const icon of manifest.icons) assert.equal(icon.src.startsWith('/'), false);
});
