import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import { TurkeyMap } from '../../components/game/turkeyMap/TurkeyMap';
import { TurkeyMapScreen, buildMapMarkers } from '../../components/game/turkeyMap/TurkeyMapScreen';
import { CityInfoSheet, formatMultiplier } from '../../components/game/turkeyMap/CityInfoSheet';
import {
  DEFAULT_MAP_VIEW,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MARKER_HIT_PX,
  clampMapView,
  fitViewToPoints,
  markerAriaLabel,
  panByPixels,
  viewBoxFor,
  zoomAtPoint,
} from '../../components/game/turkeyMap/mapView';
import { CITY_DEFINITIONS, CITY_IDS, MAP_HEIGHT } from '../../data/cityDefinitions';
import { MAP_WIDTH } from '../../data/cityBalance';
import { SHOP_TEMPLATES } from '../../data/tradeCatalog';
import { getCityOpeningQuote, getCityShopSummary, shopHasIssue } from '../../engine/CityOpeningQuote';
import { TURKEY_OUTLINE_PATH } from '../../data/turkeyMapGeometry';
import type { SimulationState } from '../../models/simulation';

const SIZE = { width: 390, height: 560 };
const fmt = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;
const noop = () => {};

/** Çok parayla başlayan oyun: ilk dükkân kapısı "zaten zengin" kısayoluyla açık. */
function richEngine(seed = 777001) {
  const eng = new SimulationEngine(seed, 5_000_000);
  eng.getState().headquartersCityId = 'izmir'; // şirket merkezi (yeni kayıtta merkez seçimi sonraki fazda gelir)
  return eng;
}

function renderMap(state: SimulationState, selected?: string, view = DEFAULT_MAP_VIEW) {
  return renderToStaticMarkup(
    React.createElement(TurkeyMap, {
      markers: buildMapMarkers(state),
      view,
      selectedCityId: selected as any,
      onViewCommit: noop,
      onSelectCity: noop,
      fixedSize: SIZE,
    })
  );
}

// ---------------------------------------------------------------------------
// Faz 3 — harita
// ---------------------------------------------------------------------------

test('Harita: yerel SVG çizimi var, 81 şehir için işaret çizilir, dış ağ adresi yok', () => {
  const eng = richEngine();
  const html = renderMap(eng.getState());
  assert.ok(TURKEY_OUTLINE_PATH.length > 1000, 'Türkiye ana hattı boş olmamalı');
  assert.ok(html.includes('data-testid="turkey-outline"'));
  assert.equal((html.match(/data-testid="turkey-city-marker-/g) ?? []).length, 81);
  assert.ok(!/https?:\/\//.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), 'Dış ağ adresi olmamalı');
});

test('Harita: dükkânsız şehir gri ve TIKLANABİLİR (disabled / aria-disabled yok)', () => {
  const eng = richEngine();
  const html = renderMap(eng.getState());
  const m = html.match(/<g[^>]*data-testid="turkey-city-marker-adana"[^>]*>/);
  assert.ok(m);
  assert.ok(m![0].includes('data-marker-state="EMPTY"'));
  assert.ok(m![0].includes('role="button"') && m![0].includes('tabindex="0"'));
  assert.ok(!html.includes('aria-disabled') && !/\sdisabled/.test(html));
  assert.ok(html.includes('fill="#9ca3af"'), 'Gri dolgu kullanılmalı');
});

test('Harita: mağazası olan şehir beyaz, şirket merkezi altın çerçeveli, sorunlu şehir kırmızı halkalı', () => {
  const eng = richEngine();
  assert.ok(eng.openShop({ shopType: 'BUFE', cityId: 'izmir' }).success);
  assert.ok(eng.openShop({ shopType: 'MANAV', cityId: 'bursa' }).success);
  const st = eng.getState();
  const markers = buildMapMarkers(st);
  const by = (id: string) => markers.find((m) => m.cityId === id)!;
  assert.equal(by('izmir').markerState, 'HEADQUARTERS');
  assert.equal(by('bursa').markerState, 'OWNED');
  assert.equal(by('ankara').markerState, 'EMPTY');
  // Yeni açılan dükkânın rafı boş ve yolda malı yok → sorun var
  assert.equal(by('bursa').hasIssue, true);

  const html = renderMap(st);
  const g = (id: string) => html.match(new RegExp(`<g[^>]*data-testid="turkey-city-marker-${id}"[^>]*>([\\s\\S]*?)</g>`))![0];
  assert.ok(g('bursa').includes('fill="#ffffff"'), 'Mağazalı şehir beyaz');
  assert.ok(g('izmir').includes('var(--g-gold'), 'Merkez altın çerçeveli');
  assert.ok(g('bursa').includes('data-testid="turkey-city-issue-bursa"') && g('bursa').includes('var(--g-red'), 'Sorunda kırmızı halka');
  assert.ok(!g('ankara').includes('var(--g-red') && !g('ankara').includes('var(--g-gold'));

  // Rafı dolu olan dükkânda sorun kalkar
  const shop = st.tradeState!.shops.find((s) => s.cityId === 'bursa')!;
  assert.equal(shopHasIssue({ ...shop, inventoryBatches: [{ availableQuantity: 5 }] as any }), false);
  assert.equal(shopHasIssue({ ...shop, inventoryBatches: [], pendingDeliveriesCount: 2 }), false);
});

test('Harita: her işaretin dokunma alanı en az 44×44 px ve şehir adı haritada yazılı durmaz', () => {
  const eng = richEngine();
  const st = eng.getState();
  for (const zoom of [1, 3, 8]) {
    const html = renderMap(st, undefined, { panX: 500, panY: 220, zoom });
    // 1 px kaç birim? viewBox genişliği / ekran genişliği
    const vb = viewBoxFor(clampMapView({ panX: 500, panY: 220, zoom }, SIZE.height / SIZE.width), SIZE.height / SIZE.width);
    const unitsPerPx = vb.w / SIZE.width;
    const rect = html.match(/<rect[^>]*data-testid="turkey-city-hit-ankara"[^>]*>/)![0];
    const w = Number(/width="([\d.]+)"/.exec(rect)![1]);
    const h = Number(/height="([\d.]+)"/.exec(rect)![1]);
    assert.ok(w / unitsPerPx >= MARKER_HIT_PX - 0.5, `zoom ${zoom}: genişlik ${w / unitsPerPx}px`);
    assert.ok(h / unitsPerPx >= MARKER_HIT_PX - 0.5, `zoom ${zoom}: yükseklik ${h / unitsPerPx}px`);
  }
  const html = renderMap(st);
  assert.ok(!html.includes('<text'), 'Haritada sürekli görünen yazı olmamalı');
  const stripped = html.replace(/aria-label="[^"]*"/g, '');
  for (const name of ['İstanbul', 'Ankara', 'Adana', 'Trabzon']) {
    assert.ok(!stripped.includes(name), `${name} yalnızca etiket içinde geçebilir`);
  }
  assert.ok(html.includes('aria-label="Ankara, henüz mağaza yok"'));
});

test('Harita: ekran okuyucu etiketi durumu söyler', () => {
  const base = { nameTR: 'Bursa', shopCount: 2, hasIssue: false };
  assert.equal(markerAriaLabel({ ...base, markerState: 'OWNED' }), 'Bursa, 2 mağaza');
  assert.equal(markerAriaLabel({ ...base, markerState: 'HEADQUARTERS', hasIssue: true }), 'Bursa, şirket merkezi, 2 mağaza, sorun var');
  assert.equal(markerAriaLabel({ ...base, markerState: 'EMPTY', shopCount: 0 }), 'Bursa, henüz mağaza yok');
});

test('Şehir noktaları kıyı çizgisiyle aynı izdüşümde: 81 şehir sahnenin içinde', () => {
  for (const id of CITY_IDS) {
    const p = CITY_DEFINITIONS[id].mapPosition;
    assert.ok(p.x >= 0 && p.x <= MAP_WIDTH && p.y >= 0, `${id} sahne dışında`);
  }
});

// ---------------------------------------------------------------------------
// Kamera (pan / zoom) — saf hesaplar
// ---------------------------------------------------------------------------

test('Kamera: yakınlaştırma sınırları, kaydırma sınırı ve imleç altındaki nokta sabitliği', () => {
  const aspect = SIZE.height / SIZE.width;
  assert.equal(clampMapView({ panX: 0, panY: 0, zoom: 99 }, aspect).zoom, MAP_MAX_ZOOM);
  assert.equal(clampMapView({ panX: 0, panY: 0, zoom: 0.1 }, aspect).zoom, MAP_MIN_ZOOM);
  // Bozuk kayıt varsayılana döner
  assert.deepEqual(clampMapView({ panX: NaN, panY: 1, zoom: 2 }, aspect), clampMapView(DEFAULT_MAP_VIEW, aspect));
  assert.deepEqual(clampMapView(undefined, aspect), clampMapView(DEFAULT_MAP_VIEW, aspect));

  const z = zoomAtPoint(clampMapView(DEFAULT_MAP_VIEW, aspect), aspect, 0.5, 0.5, 4);
  assert.equal(z.zoom, 4);
  // Çok uzağa kaydırmak haritanın dışına çıkarmaz
  const far = panByPixels(z, -1e6, -1e6, SIZE.width, aspect);
  const vb = viewBoxFor(far, aspect);
  assert.ok(vb.x + vb.w <= MAP_WIDTH + 30 + 1e-6);
  const far2 = panByPixels(z, 1e6, 1e6, SIZE.width, aspect);
  assert.ok(viewBoxFor(far2, aspect).x >= -30 - 1e-6);

  // Odak noktasının altındaki harita noktası yakınlaşırken yerinde kalır
  const start = clampMapView({ panX: 500, panY: 220, zoom: 2 }, aspect);
  const before = viewBoxFor(start, aspect);
  const pt = { x: before.x + 0.3 * before.w, y: before.y + 0.6 * before.h };
  const after = viewBoxFor(zoomAtPoint(start, aspect, 0.3, 0.6, 3), aspect);
  // Dikey eksende bütün Türkiye zaten sığıyorsa kamera ortada kalır; yatay eksende nokta sabit kalmalı.
  assert.ok(Math.abs(after.x + 0.3 * after.w - pt.x) < 1e-6);
});

test('Kamera: "Mağazalarıma Git" kamerası mağazalı şehirleri kapsar', () => {
  const aspect = SIZE.height / SIZE.width;
  const pts = [CITY_DEFINITIONS.izmir.mapPosition, CITY_DEFINITIONS.bursa.mapPosition];
  const v = fitViewToPoints(pts, aspect);
  const vb = viewBoxFor(v, aspect);
  for (const p of pts) {
    assert.ok(p.x >= vb.x && p.x <= vb.x + vb.w && p.y >= vb.y && p.y <= vb.y + vb.h);
  }
  assert.ok(v.zoom > 1);
  assert.deepEqual(fitViewToPoints([], aspect), DEFAULT_MAP_VIEW);
});

test('Kamera ve seçili şehir kayda yazılır, yeniden açılınca geri gelir', () => {
  const store = new Map<string, string>();
  const g = globalThis as any;
  const prev = g.window;
  g.window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) } };
  try {
    const eng = richEngine(777002);
    eng.setTurkeyMapView({ panX: 612.5, panY: 190.25, zoom: 3.5 });
    eng.setSelectedMapCity('konya');
    SimulationStore.saveToStorage(eng);
    const reopened = SimulationStore.loadFromStorage()!;
    const st = reopened.getState();
    assert.deepEqual(st.turkeyMapView, { panX: 612.5, panY: 190.25, zoom: 3.5 });
    assert.equal(st.selectedMapCityId, 'konya');
    // Geçersiz değerler kaydı bozmaz
    reopened.setTurkeyMapView({ panX: NaN, panY: 1, zoom: 2 });
    reopened.setSelectedMapCity('yok-boyle-sehir');
    assert.deepEqual(reopened.getState().turkeyMapView, { panX: 612.5, panY: 190.25, zoom: 3.5 });
    assert.equal(reopened.getState().selectedMapCityId, undefined);
  } finally {
    if (prev === undefined) delete g.window; else g.window = prev;
  }
});

// ---------------------------------------------------------------------------
// Faz 4 — bilgi paneli
// ---------------------------------------------------------------------------

function renderSheet(eng: SimulationEngine, cityId: any) {
  return renderToStaticMarkup(
    React.createElement(CityInfoSheet, {
      city: CITY_DEFINITIONS[cityId as keyof typeof CITY_DEFINITIONS],
      state: eng.getState(),
      formatCurrency: fmt,
      onClose: noop,
      onGoToCity: noop,
      onOpenShop: noop,
    })
  );
}

test('Panel (dükkânsız şehir): ekonomi, artı/eksi, gerçek maliyet ve "İlk Mağazanı Aç"; "Şehre Git" yok', () => {
  const eng = richEngine();
  const html = renderSheet(eng, 'trabzon');
  const c = CITY_DEFINITIONS.trabzon;
  assert.ok(html.includes('data-testid="city-info-sheet"') && html.includes('role="dialog"'));
  assert.ok(html.includes(c.nameTR));
  assert.ok(html.includes('data-testid="city-info-economy"'));
  for (const l of ['Müşteri talebi', 'Halkın alım gücü', 'Kira', 'Çalışan maaşı', 'Rekabet', 'Mal taşıma']) assert.ok(html.includes(l), l);
  for (const a of [...c.advantagesTR, ...c.disadvantagesTR]) assert.ok(html.includes(a.replace(/&/g, '&amp;')), a);
  assert.ok(html.includes('Burada henüz mağazan yok'));
  assert.ok(html.includes('data-testid="city-open-first-shop-btn"') && html.includes('İlk Mağazanı Aç'));
  assert.ok(html.includes('data-testid="city-costs-btn"'));
  assert.ok(!html.includes('data-testid="city-go-btn"') && !html.includes('Şehre Git'));
  assert.ok(html.includes('data-testid="city-info-close-btn"') && html.includes('aria-label="Paneli kapat"'));
  assert.ok(!html.includes('aria-disabled'));
});

test('Panel: gösterilen maliyet motorun gerçekten düşeceği tutarla aynıdır', () => {
  const eng = richEngine(777003);
  const st = eng.getState();
  const q = getCityOpeningQuote(st, 'konya', 'BUFE', 0);
  const tpl = SHOP_TEMPLATES.BUFE;
  assert.equal(q.setupCost, Number((tpl.openingCost + tpl.decorationCost).toFixed(2)));
  const x = q.expansion;
  assert.equal(
    q.totalUpfrontCost,
    Number((x.baseSetupCost + x.cityRentDeposit + x.regionalPermitCost + x.initialLogisticsCost - x.prestigeDiscount - x.milestoneDiscount + x.workingCash).toFixed(2))
  );
  assert.ok(q.firstStockCost > 0);
  assert.ok(q.estimatedDeliveryDays === null || q.estimatedDeliveryDays >= 1);

  const html = renderSheet(eng, 'konya');
  assert.ok(html.includes(fmt(q.totalUpfrontCost)));
  assert.ok(html.includes(fmt(q.setupCost)));

  const cashBefore = st.cash;
  const res = eng.openShop({ shopType: 'BUFE', cityId: 'konya' });
  assert.ok(res.success, res.message);
  assert.ok(Math.abs(cashBefore - eng.getState().cash - q.totalUpfrontCost) < 0.01, 'Düşen para teklifle aynı olmalı');
  assert.equal(res.shop?.cityId, 'konya');
});

test('Panel (mağazalı şehir): "Şehre Git", "Yeni Mağaza Aç", "Şehir İstatistikleri"; satış ve kâr özeti', () => {
  const eng = richEngine(777004);
  assert.ok(eng.openShop({ shopType: 'BUFE', cityId: 'izmir' }).success);
  const html = renderSheet(eng, 'izmir');
  assert.ok(html.includes('1 mağazan var'));
  assert.ok(html.includes('Şirket merkezi'));
  for (const id of ['city-go-btn', 'city-open-shop-btn', 'city-stats-btn', 'city-info-revenue', 'city-info-profit', 'city-info-issues']) {
    assert.ok(html.includes(`data-testid="${id}"`), id);
  }
  assert.ok(html.includes('Şehre Git') && html.includes('Yeni Mağaza Aç') && html.includes('Şehir İstatistikleri'));
  assert.ok(!html.includes('İlk Mağazanı Aç'));
  const sum = getCityShopSummary(eng.getState(), 'izmir');
  assert.equal(sum.shopCount, 1);
  assert.equal(sum.issueCount, 1, 'Yeni dükkân rafsız: 1 sorun');
});

test('Panel: şehir değişince içerik değişir; sayı biçimleri sade', () => {
  const eng = richEngine();
  const a = renderSheet(eng, 'istanbul');
  const b = renderSheet(eng, 'kars');
  assert.ok(a.includes('data-city-id="istanbul"') && b.includes('data-city-id="kars"'));
  assert.notEqual(a, b);
  assert.equal(formatMultiplier(1.12), '+%12');
  assert.equal(formatMultiplier(0.92), '−%8');
  assert.equal(formatMultiplier(1), 'Ortalama');
});

test('Harita ekranı: seçili şehir varsa panel açılır, yoksa kapalı; mağaza yokken "Mağazalarıma Git" gösterilmez', () => {
  const eng = richEngine(777005);
  const base = { formatCurrency: fmt, onSetMapView: noop, onSelectMapCity: noop, onOpenShopInCity: noop, onGoToCity: noop, fixedSize: SIZE };
  let html = renderToStaticMarkup(React.createElement(TurkeyMapScreen, { ...base, state: eng.getState() }));
  assert.ok(html.includes('data-testid="turkey-map"'));
  assert.ok(!html.includes('data-testid="city-info-sheet"'));
  assert.ok(html.includes('data-testid="turkey-map-recenter-btn"'));
  assert.ok(!html.includes('data-testid="turkey-map-mine-btn"'));

  eng.setSelectedMapCity('antalya');
  eng.openShop({ shopType: 'BUFE', cityId: 'izmir' });
  html = renderToStaticMarkup(React.createElement(TurkeyMapScreen, { ...base, state: eng.getState() }));
  assert.ok(html.includes('data-testid="city-info-sheet"') && html.includes('data-city-id="antalya"'));
  assert.ok(html.includes('data-testid="turkey-map-mine-btn"'));
  assert.ok(html.includes('aria-pressed="true"'));
});

test('Kayıtlı kamera haritaya yansır (yeniden açılışta aynı yer)', () => {
  const eng = richEngine(777006);
  eng.setTurkeyMapView({ panX: 600, panY: MAP_HEIGHT / 2, zoom: 3 });
  const html = renderToStaticMarkup(
    React.createElement(TurkeyMapScreen, {
      state: eng.getState(), formatCurrency: fmt, onSetMapView: noop, onSelectMapCity: noop,
      onOpenShopInCity: noop, onGoToCity: noop, fixedSize: SIZE,
    })
  );
  assert.ok(html.includes('data-zoom="3.000"'));
  assert.ok(html.includes('data-pan-x="600.0"') && html.includes(`data-pan-y="${(MAP_HEIGHT / 2).toFixed(1)}"`));
});
