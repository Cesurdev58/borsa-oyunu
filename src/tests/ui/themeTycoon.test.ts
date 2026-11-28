/**
 * Çift tema (Sıcak Tycoon / Gece Patronu) ve tasarım dilinin ekranlara yayılması (Faz 1 ve Faz 4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

test('İki tema renkleri index.css içinde tanımlı; gece temasında sabit beyaz/gri sınıflar tema rengine bağlı', () => {
  const css = read('src/index.css');
  assert.match(css, /:root\[data-theme='night'\]\s*\{[^}]*--g-bg: #0b1226/);
  assert.match(css, /:root\[data-theme='warm'\]\s*\{[^}]*--g-bg: #fbf7ee/);
  for (const v of ['#ffffff', '#e7dec8', '#1c1917', '#78716c', '#f59e0b', '#10b981']) assert.ok(css.includes(v), v);
  for (const v of ['#131e3a', '#24335a', '#f8fafc', '#94a3b8', '#fbbf24', '#34d399']) assert.ok(css.includes(v), v);
  assert.match(css, /:root\[data-theme='night'\] \.bg-white \{ background-color: var\(--g-surface\); \}/);
  // 3D dokunsal düğme: kalın alt gölge + basınca çökme
  assert.match(css, /\.g-btn-gold \{[^}]*box-shadow: 0 4px 0 var\(--g-gold-dark\)/);
  assert.match(css, /\.g-btn:active:not\(:disabled\) \{ transform: translateY\(2px\); \}/);
});

test('Tema seçici Ayarlar penceresinin en üstünde; tema uygulanır ve durum çubuğu temaya uyar', () => {
  const view = read('src/components/game/TycoonGameView.tsx');
  assert.ok(view.includes('settings-theme-${t.id}'));
  assert.ok(view.includes("id: 'warm', label: '☀️ Sıcak Tycoon'"));
  assert.ok(view.includes("id: 'night', label: '🌙 Gece Patronu'"));
  assert.ok(view.indexOf('settings-group-theme') < view.indexOf('settings-group-tempo'), 'tema en üstte');
  assert.match(view, /applyTheme\(uiSettings\.theme\)/);
  assert.match(read('src/components/game/ui/theme.ts'), /document\.documentElement\.dataset\.theme = t/);
  const sb = read('src/nativeStatusBar.ts');
  assert.match(sb, /warm: '#1e293b', night: '#0b1226'/);
  assert.match(sb, /Capacitor\.isNativePlatform\(\)/);
  assert.match(read('src/main.tsx'), /applyTheme\(UISettingsStore\.loadSettings\(\)\.theme\)/);
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

test('Oyun bileşenlerinde sabit "bg-white" ve koyu gri yazı yok (tema değişkenleri kullanılır)', () => {
  const offenders: string[] = [];
  for (const f of walk(path.join(root, 'src/components/game'))) {
    const s = readFileSync(f, 'utf8');
    if (/(?<=[\s"'`{])(bg-white|text-slate-900|text-slate-800|bg-slate-50|bg-slate-100)(?=[\s"'`}])/.test(s)) offenders.push(path.relative(root, f));
  }
  assert.deepEqual(offenders, []);
});

test('Banka ve Şirket ekranlarında ham açılır kutu yok; dokunsal seçim hapları var', () => {
  for (const f of ['src/components/game/buildings/BankaPanel.tsx', 'src/components/game/buildings/SirketMerkeziPanel.tsx']) {
    const s = read(f);
    assert.doesNotMatch(s, /<select/, f);
    assert.match(s, /<ChoicePills/, f);
  }
  for (const id of ['loan-type-select', 'xfer-source-select', 'xfer-dest-select', 'xfer-category-select']) {
    assert.ok(read('src/components/game/buildings/BankaPanel.tsx').includes(`testId="${id}"`), id);
  }
});

test('Şehir Mağazaları ve dükkân kartlarında yıldız rozeti; rehberde yıldız maddesi', () => {
  assert.match(read('src/components/game/turkeyMap/CityShopsScreen.tsx'), /city-shop-stars-/);
  assert.match(read('src/components/game/buildings/ShopDashboard.tsx'), /shop-card-stars-/);
  assert.match(read('src/components/game/HowToPlayModal.tsx'), /Her dükkânın 1–5 arası bir yıldızı var/);
});
