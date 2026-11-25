import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import { needsStartCitySelection, chooseStartCity, getStartCitySummary, recommendedFirstShopType } from '../../engine/CityStartSelection';
import { getCityOpeningQuote } from '../../engine/CityOpeningQuote';
import { CITY_DEFINITIONS, CITY_IDS } from '../../data/cityDefinitions';
import { StartCityScreen } from '../../components/game/turkeyMap/StartCityScreen';
import { CityShopsScreen } from '../../components/game/turkeyMap/CityShopsScreen';
import { TurkeyMapFlow } from '../../components/game/turkeyMap/TurkeyMapFlow';
import { attachMapBackHandler, type WindowLike } from '../../components/game/turkeyMap/mapBackController';
import {
  MAP_ROOT, canGoToCity, goToCity, resolveBack, shopsInCity, summarizeCityShops, type MapNavState,
} from '../../components/game/turkeyMap/mapNavigation';
import type { CityId } from '../../models/cities';

const SIZE = { width: 390, height: 560 };
const fmt = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;
const noop = () => {};
const fresh = (seed = 880001) => new SimulationEngine(seed, 5_000_000);

// ---------------------------------------------------------------------------
// Faz 5 — başlangıç şehri
// ---------------------------------------------------------------------------

test('Yeni kariyerde şehir seçimi gerekir; Ankara dahil hiçbir şehir kendiliğinden seçilmez', () => {
  const eng = fresh();
  const st = eng.getState();
  assert.equal(eng.needsStartCitySelection(), true);
  assert.equal(st.playerStartCityId, undefined);
  assert.equal(st.headquartersCityId, undefined);
});

test('81 ilin hepsi başlangıç şehri olarak seçilebilir (komşuluk/merkez şartı yok) ve seçim uygulanır', () => {
  for (const id of CITY_IDS) {
    const eng = fresh(880100);
    const r = eng.chooseStartCity(id);
    assert.ok(r.success && r.applied, id);
    assert.equal(eng.getState().playerStartCityId, id);
    assert.equal(eng.getState().headquartersCityId, id);
    assert.equal(eng.needsStartCitySelection(), false);
  }
});

test('Seçim bir kez uygulanır: ikinci çağrı (geri tuşu/çift dokunuş) hiçbir şeyi değiştirmez; geçersiz şehir reddedilir', () => {
  const eng = fresh();
  assert.equal(eng.chooseStartCity('konya').applied, true);
  const before = JSON.stringify(eng.getState().playerStartCityId) + eng.getState().cash;
  const again = eng.chooseStartCity('trabzon');
  assert.equal(again.applied, false);
  assert.equal(eng.getState().playerStartCityId, 'konya');
  assert.equal(JSON.stringify(eng.getState().playerStartCityId) + eng.getState().cash, before);
  const bad = fresh().chooseStartCity('atlantis');
  assert.equal(bad.success, false);
  assert.equal(bad.applied, false);
});

test('Eski kayıtlar (gün > 1 ya da dükkânı olan) şehir seçimine zorlanmaz', () => {
  const a = fresh();
  a.getState().day = 5;
  assert.equal(needsStartCitySelection(a.getState()), false);
  const b = fresh(880002);
  assert.ok(b.openShop({ shopType: 'BUFE' }).success);
  assert.equal(needsStartCitySelection(b.getState()), false);
});

test('Seçilen şehir kayda yazılır ve ilk dükkân o şehirde açılır', () => {
  const store = new Map<string, string>();
  const g = globalThis as any;
  const prev = g.window;
  g.window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) } };
  try {
    const eng = fresh(880003);
    eng.chooseStartCity('gaziantep');
    SimulationStore.saveToStorage(eng);
    const reopened = SimulationStore.loadFromStorage()!;
    assert.equal(reopened.getState().playerStartCityId, 'gaziantep');
    assert.equal(reopened.getState().headquartersCityId, 'gaziantep');
    assert.equal(reopened.needsStartCitySelection(), false, 'Yeniden açılınca tekrar sorulmaz');
    const res = reopened.openShop({ shopType: 'BUFE' });
    assert.ok(res.success, res.message);
    assert.equal(res.shop?.cityId, 'gaziantep');
  } finally {
    if (prev === undefined) delete g.window; else g.window = prev;
  }
});

test('Başlangıç özeti motorun gerçek açılış maliyetinden gelir; zor şehirde uyarı var, kolayda yok', () => {
  const eng = fresh();
  const st = eng.getState();
  const hard = CITY_IDS.find((id) => CITY_DEFINITIONS[id].difficulty === 'HARD')!;
  const easy = CITY_IDS.find((id) => CITY_DEFINITIONS[id].difficulty === 'EASY')!;
  for (const id of [hard, easy]) {
    const sum = getStartCitySummary(st, id);
    const q = getCityOpeningQuote(st, id, recommendedFirstShopType(CITY_DEFINITIONS[id]));
    assert.equal(sum.quote.totalUpfrontCost, q.totalUpfrontCost);
    assert.ok(sum.sevenDayRunningCost > 0);
    assert.ok(sum.cashAfterOpening <= st.cash);
  }
  assert.ok(getStartCitySummary(st, hard).warningTR);
  assert.equal(getStartCitySummary(st, easy).warningTR, null);
});

test('Başlangıç ekranı: hiçbir şehir seçili gelmez, kilitli/pasif şehir yok; onay adımı maliyet ve risk özetini gösterir', () => {
  const eng = fresh();
  const base = { state: eng.getState(), formatCurrency: fmt, onConfirm: noop, fixedSize: SIZE };
  const html = renderToStaticMarkup(React.createElement(StartCityScreen, base));
  assert.ok(html.includes('Nereden başlayacaksın?'));
  assert.equal((html.match(/data-testid="turkey-city-marker-/g) ?? []).length, 81);
  assert.ok(!html.includes('aria-pressed="true"'), 'Ankara dahil hiçbiri seçili olmamalı');
  assert.ok(!html.includes('aria-disabled') && !/\sdisabled/.test(html));
  assert.ok(!html.includes('data-testid="city-info-sheet"'));

  // Şehir seçilince bilgi paneli "Bu Şehirde Başla" ile gelir
  const picked = renderToStaticMarkup(React.createElement(StartCityScreen, { ...base, initialCityId: 'ankara' }));
  assert.ok(picked.includes('data-testid="city-start-here-btn"') && picked.includes('Bu Şehirde Başla'));
  assert.ok(!picked.includes('data-testid="city-open-first-shop-btn"'));

  // Onay adımı
  const hard = CITY_IDS.find((id) => CITY_DEFINITIONS[id].difficulty === 'HARD')!;
  const conf = renderToStaticMarkup(React.createElement(StartCityScreen, { ...base, initialCityId: hard, initialConfirm: true }));
  for (const id of ['start-city-confirm', 'start-city-setup', 'start-city-seven-day', 'start-city-cash-after', 'start-city-hard-warning', 'start-city-confirm-btn', 'start-city-cancel-btn']) {
    assert.ok(conf.includes(`data-testid="${id}"`), id);
  }
  const easy = CITY_IDS.find((id) => CITY_DEFINITIONS[id].difficulty === 'EASY')!;
  const confEasy = renderToStaticMarkup(React.createElement(StartCityScreen, { ...base, initialCityId: easy, initialConfirm: true }));
  assert.ok(!confEasy.includes('start-city-hard-warning'));
});

// ---------------------------------------------------------------------------
// Faz 6 — Şehir Mağazaları
// ---------------------------------------------------------------------------

function worldWithShops() {
  const eng = fresh(880010);
  eng.chooseStartCity('izmir');
  assert.ok(eng.openShop({ shopType: 'BUFE', cityId: 'izmir' }).success);
  assert.ok(eng.openShop({ shopType: 'MANAV', cityId: 'izmir' }).success);
  assert.ok(eng.openShop({ shopType: 'KAFE', cityId: 'bursa' }).success);
  return eng;
}

test('Mağaza süzgeci yalnızca cityId ile eşleşenleri verir; başka şehrin mağazası karışmaz', () => {
  const st = worldWithShops().getState();
  const izmir = shopsInCity(st, 'izmir');
  const bursa = shopsInCity(st, 'bursa');
  assert.equal(izmir.length, 2);
  assert.equal(bursa.length, 1);
  assert.ok(izmir.every((s) => s.cityId === 'izmir'));
  assert.equal(shopsInCity(st, 'ankara').length, 0);
  assert.equal(summarizeCityShops(st, 'izmir').shopCount, 2);
  assert.equal(summarizeCityShops(st, 'ankara').shopCount, 0);
});

test('"Şehre Git" yalnızca dükkân varken çalışır; dükkânsız şehirde gezinme değişmez', () => {
  const st = worldWithShops().getState();
  assert.equal(canGoToCity(st, 'izmir'), true);
  assert.equal(canGoToCity(st, 'ankara'), false);
  assert.equal(canGoToCity(st, undefined), false);
  assert.deepEqual(goToCity(MAP_ROOT, st, 'ankara'), MAP_ROOT);
  assert.deepEqual(goToCity(MAP_ROOT, st, 'izmir'), { screen: 'CITY_SHOPS', cityId: 'izmir' });
});

test('Şehir Mağazaları ekranı: yalnızca o şehrin mağazaları, üst özet, sabit "Haritaya Dön" (44px, güvenli alan)', () => {
  const eng = worldWithShops();
  const st = eng.getState();
  const html = renderToStaticMarkup(React.createElement(CityShopsScreen, { cityId: 'izmir', state: st, formatCurrency: fmt, onBackToMap: noop, onManageShop: noop }));
  const izmirIds = shopsInCity(st, 'izmir').map((s) => s.shopId);
  const bursaId = shopsInCity(st, 'bursa')[0].shopId;
  for (const id of izmirIds) assert.ok(html.includes(`data-testid="city-shop-card-${id}"`));
  assert.ok(!html.includes(bursaId), 'Bursa mağazası İzmir ekranında görünmemeli');
  assert.equal((html.match(/data-shop-city="/g) ?? []).length, 2);
  assert.ok(!html.includes('data-shop-city="bursa"'));
  for (const id of ['city-shops-count', 'city-shops-revenue', 'city-shops-profit', 'city-shops-staff', 'city-shops-stock', 'city-shops-reputation']) assert.ok(html.includes(`data-testid="${id}"`), id);
  assert.ok(/data-testid="city-shops-count">2</.test(html));
  const btn = html.match(/<button[^>]*data-testid="city-shops-back-btn"[^>]*>/)![0];
  assert.ok(btn.includes('min-h-[44px]') && btn.includes('min-w-[44px]'));
  assert.ok(btn.includes('safe-area-inset-left'));
  // Düğme ekranın kendi üstüne yapışıktır (sayfaya sabitlenmez: üst çubuğun/hedef şeridinin üstüne binmesin)
  assert.ok(!btn.includes('fixed'));
  assert.match(html, /<div class="sticky top-0 z-30 h-0"><button[^>]*data-testid="city-shops-back-btn"/);
  assert.ok(html.includes('Haritaya Dön'));
  for (const a of ['Yönet', 'Stok Sipariş Et', 'Yükselt', 'Çalışanlar', 'Müdür', 'Muhasebe']) assert.ok(html.includes(a), a);
  // Rafsız yeni dükkânlar sorun sayılır
  assert.ok(html.includes('data-testid="city-shops-issues"'));
});

test('Boş durum: şehirde mağaza yoksa "Bu şehirde henüz mağazan yok" ve haritaya dön eylemi', () => {
  const st = worldWithShops().getState();
  const html = renderToStaticMarkup(React.createElement(CityShopsScreen, { cityId: 'ankara', state: st, formatCurrency: fmt, onBackToMap: noop, onManageShop: noop }));
  assert.ok(html.includes('Bu şehirde henüz mağazan yok'));
  assert.ok(html.includes('data-testid="city-shops-empty-back-btn"'));
  assert.ok(!html.includes('data-testid="city-shops-list"'));
});

// ---------------------------------------------------------------------------
// Geri tuşu sırası ve gezinme
// ---------------------------------------------------------------------------

test('Geri tuşu sırası: 1) detay kapanır 2) şehir mağazalarından haritaya 3) panel kapanır 4) çıkış onayı', () => {
  const shops: MapNavState = { screen: 'CITY_SHOPS', cityId: 'izmir' };
  assert.deepEqual(resolveBack({ nav: shops, detailOpen: true, sheetOpen: true }), { kind: 'CLOSE_DETAIL' });
  assert.deepEqual(resolveBack({ nav: shops, detailOpen: false, sheetOpen: true }), { kind: 'TO_MAP', nav: MAP_ROOT });
  assert.deepEqual(resolveBack({ nav: MAP_ROOT, detailOpen: false, sheetOpen: true }), { kind: 'CLOSE_SHEET' });
  assert.deepEqual(resolveBack({ nav: MAP_ROOT, detailOpen: false, sheetOpen: false }), { kind: 'EXIT_CONFIRM' });
});

/** Sahte tarayıcı geçmişi: gerçek geri tuşu gibi çalışır (popstate yayar). */
function fakeWindow() {
  const stack: unknown[] = [null];
  let idx = 0;
  const listeners: Array<() => void> = [];
  const win: WindowLike & { press(): void; stack: unknown[]; idx(): number } = {
    history: {
      get state() { return stack[idx]; },
      pushState(s: unknown) { stack.splice(idx + 1); stack.push(s); idx = stack.length - 1; },
      back() { if (idx > 0) { idx -= 1; setTimeout(() => {}, 0); listeners.slice().forEach((l) => l()); } },
    } as any,
    addEventListener: (_t, fn) => { listeners.push(fn); },
    removeEventListener: (_t, fn) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
    press() { this.history.back(); },
    stack,
    idx: () => idx,
  };
  return win;
}

test('Android geri tuşu: haritaya dönüş "Haritaya Dön" düğmesiyle aynı sonucu verir ve kamera/seçim korunur', () => {
  const eng = worldWithShops();
  const st = eng.getState();
  eng.setTurkeyMapView({ panX: 600, panY: 222, zoom: 3 });
  eng.setSelectedMapCity('izmir');
  const camBefore = JSON.stringify(st.turkeyMapView);

  // Akış durumu (arayüzdeki runBack ile aynı kural)
  let nav: MapNavState = goToCity(MAP_ROOT, st, 'izmir');
  let sheetOpen = true;
  let exitConfirm = 0;
  const runBack = () => {
    const out = resolveBack({ nav, detailOpen: false, sheetOpen });
    if (out.kind === 'TO_MAP') nav = out.nav;
    else if (out.kind === 'CLOSE_SHEET') sheetOpen = false;
    else if (out.kind === 'EXIT_CONFIRM') { exitConfirm += 1; return 'exit-confirm' as const; }
    return 'handled' as const;
  };

  const win = fakeWindow();
  const detach = attachMapBackHandler(win, runBack);
  assert.equal((win.history.state as any).mapFlow, true, 'Nöbetçi kayıt konmalı');
  assert.equal(nav.screen, 'CITY_SHOPS');

  win.press(); // geri tuşu
  assert.equal(nav.screen, 'MAP', 'Geri tuşu haritaya dönmeli');
  assert.equal(sheetOpen, true, 'Panel (seçili şehir) korunur');
  assert.equal(JSON.stringify(st.turkeyMapView), camBefore, 'Kamera durumu kaybolmamalı');
  assert.equal(st.selectedMapCityId, 'izmir');
  assert.equal((win.history.state as any).mapFlow, true, 'Nöbetçi yeniden konmalı: sayfadan çıkılmaz');

  // Düğme yolu aynı kuralı çalıştırır → aynı sonuç
  let nav2: MapNavState = goToCity(MAP_ROOT, st, 'izmir');
  const out = resolveBack({ nav: nav2, detailOpen: false, sheetOpen: true });
  assert.deepEqual(out.kind === 'TO_MAP' ? out.nav : null, nav);

  win.press(); // 2. geri: panel kapanır
  assert.equal(sheetOpen, false);
  win.press(); // 3. geri: çıkış onayı
  assert.equal(exitConfirm, 1);
  win.press(); // onay açıkken tekrar: yine onay, sayfadan çıkmaz
  assert.equal(exitConfirm, 2);
  assert.equal((win.history.state as any).mapFlow, true);
  detach();
  assert.ok(!(win.history.state as any)?.mapFlow, 'Ayrılınca nöbetçi kayıt temizlenir');
});

test('Açık pencere (mağaza detayı) varken geri tuşu gezinmeyi bozmaz: pencereyi o kapatır', () => {
  const win = fakeWindow();
  let calls = 0;
  const detach = attachMapBackHandler(win, () => { calls += 1; return 'handled'; });
  win.history.pushState({ gameOverlay: true }, ''); // detay paneli açıldı
  win.press(); // geri → nöbetçi kayda döner, harita akışı karışmaz
  assert.equal(calls, 0);
  assert.equal((win.history.state as any).mapFlow, true);
  win.press(); // ikinci geri → artık gezinme kuralı
  assert.equal(calls, 1);
  detach();
});

test('Harita akışı ilk açılışta harita ekranıdır ve "Şehre Git" yalnızca mağazalı şehirde çıkar', () => {
  const eng = worldWithShops();
  eng.setSelectedMapCity('izmir');
  const props = { formatCurrency: fmt, onSetMapView: noop, onSelectMapCity: noop, onOpenShopInCity: noop, onManageShop: noop, onExit: noop, fixedSize: SIZE };
  let html = renderToStaticMarkup(React.createElement(TurkeyMapFlow, { ...props, state: eng.getState() }));
  assert.ok(html.includes('data-screen="MAP"') && html.includes('data-testid="turkey-map"'));
  assert.ok(html.includes('data-testid="city-go-btn"'));
  assert.ok(!html.includes('data-testid="city-shops-screen"'));
  eng.setSelectedMapCity('ankara');
  html = renderToStaticMarkup(React.createElement(TurkeyMapFlow, { ...props, state: eng.getState() }));
  assert.ok(!html.includes('data-testid="city-go-btn"') && html.includes('data-testid="city-open-first-shop-btn"'));
});
