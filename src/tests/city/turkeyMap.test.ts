import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
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
import { TURKEY_PROVINCE_PATHS } from '../../data/turkeyProvinceGeometry';
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

test('Harita: yerel SVG çizimi var, 81 il poligonu çizilir (nokta yok), dış ağ adresi yok', () => {
  const eng = richEngine();
  const html = renderMap(eng.getState());
  assert.equal((html.match(/data-testid="turkey-city-marker-/g) ?? []).length, 81);
  assert.equal((html.match(/<path[^>]*data-testid="turkey-province-[a-z]+"/g) ?? []).length, 81, 'Her il için bir poligon');
  assert.ok(!html.includes('turkey-city-hit-'), 'Eski görünmez dokunma karesi kalmamalı');
  assert.ok(!html.includes('<circle'), 'Gri/beyaz nokta işaretleri tamamen kaldırıldı (rozet yalnızca sorunlu ilde)');
  assert.ok(!html.includes('data-testid="turkey-outline"'), 'Tek parça yeşil silüet kalmamalı');
  assert.ok(!html.includes('#2f5a45'), 'Yeşil silüet rengi kalmamalı');
  assert.ok(!/https?:\/\//.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), 'Dış ağ adresi olmamalı');
});

/** "M x y L x y … Z" yolundaki halkaları ayrıştırır. */
function parseRings(d: string): Array<Array<[number, number]>> {
  return d.split('M').filter(Boolean).map((r) =>
    r.replace('Z', '').split('L').map((p) => p.trim().split(' ').map(Number) as [number, number])
  );
}
function inside(pt: [number, number], ring: Array<[number, number]>): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

test('İl poligonları: 81 ilin hepsi var, geçerli, sahne içinde ve il merkezi kendi poligonunun içinde', () => {
  assert.equal(Object.keys(TURKEY_PROVINCE_PATHS).length, 81);
  const seen = new Set<string>();
  let centersInside = 0;
  const outside: string[] = [];
  for (const id of CITY_IDS) {
    const d = TURKEY_PROVINCE_PATHS[id];
    assert.ok(d && d.startsWith('M') && d.endsWith('Z'), `${id}: yol geçersiz`);
    assert.ok(!seen.has(d), `${id}: başka bir ilin aynısı`);
    seen.add(d);
    const rings = parseRings(d);
    for (const r of rings) {
      assert.ok(r.length >= 3, `${id}: halka çok kısa`);
      for (const [x, y] of r) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), `${id}: sayı değil`);
        assert.ok(x >= -5 && x <= MAP_WIDTH + 5 && y >= -5 && y <= MAP_HEIGHT + 5, `${id}: sahne dışı (${x}, ${y})`);
      }
    }
    const { x, y } = CITY_DEFINITIONS[id].mapPosition;
    if (rings.some((r) => inside([x, y], r))) centersInside++;
    else outside.push(id);
  }
  // İl merkezi koordinatı kıyıda sadeleştirmeyle sınırın hemen dışında kalabilir; ama kimlik eşleşmesi yanlışsa çoğu dışarıda olur.
  assert.ok(centersInside >= 78, `Merkezi kendi poligonunda olmayan iller: ${outside.join(', ')}`);
});

test('Harita: dükkânsız şehir gri ve TIKLANABİLİR (disabled / aria-disabled yok)', () => {
  const eng = richEngine();
  const html = renderMap(eng.getState());
  const m = html.match(/<g[^>]*data-testid="turkey-city-marker-adana"[^>]*>/);
  assert.ok(m);
  assert.ok(m![0].includes('data-marker-state="EMPTY"'));
  assert.ok(m![0].includes('role="button"') && m![0].includes('tabindex="0"'));
  assert.ok(!html.includes('aria-disabled') && !/\sdisabled/.test(html));
  const province = html.match(/<path[^>]*data-testid="turkey-province-adana"[^>]*>/)![0];
  assert.ok(province.includes('is-empty') && !province.includes('is-owned'), 'Gri (mağazasız) il sınıfı');
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
  const prov = (id: string) => html.match(new RegExp(`<path[^>]*data-testid="turkey-province-${id}"[^>]*>`))![0];
  const outline = (id: string) => html.match(new RegExp(`<g data-testid="turkey-city-outline-${id}"[^>]*>([\\s\\S]*?)</g></g>|<g data-testid="turkey-city-outline-${id}"[^>]*>([\\s\\S]*?)</g>`))?.[0] ?? '';
  assert.ok(prov('bursa').includes('is-owned'), 'Mağazalı il beyaz dolgu');
  assert.ok(prov('izmir').includes('is-owned'), 'Merkez il de beyaz dolgu');
  assert.ok(prov('ankara').includes('is-empty'));
  assert.ok(outline('izmir').includes('var(--g-gold') && outline('izmir').includes('turkey-city-hq-izmir'), 'Merkez altın kenarlık');
  assert.ok(outline('bursa').includes('turkey-city-issue-bursa') && outline('bursa').includes('var(--g-red'), 'Sorunda kırmızı kenarlık');
  assert.ok(html.includes('data-testid="turkey-city-issue-badge-bursa"'), 'Sorunda il merkezinde küçük rozet');
  assert.equal(outline('ankara'), '', 'Mağazasız ilde özel kenarlık yok');
  assert.ok(!html.includes('turkey-city-hq-bursa'));

  // Rafı dolu olan dükkânda sorun kalkar
  const shop = st.tradeState!.shops.find((s) => s.cityId === 'bursa')!;
  assert.equal(shopHasIssue({ ...shop, inventoryBatches: [{ availableQuantity: 5 }] as any }), false);
  assert.equal(shopHasIssue({ ...shop, inventoryBatches: [], pendingDeliveriesCount: 2 }), false);
});

test('Harita: ilin kendisi dokunma alanıdır (data-city-id) ve il adı haritada yazılı durmaz', () => {
  const eng = richEngine();
  const st = eng.getState();
  const html0 = renderMap(st);
  for (const id of CITY_IDS) {
    assert.ok(new RegExp(`<g[^>]*data-city-id="${id}"`).test(html0), `${id}: dokunulabilir grup yok`);
  }
  // Sınır çizgisi yakınlaştırmada aynı kalınlıkta (non-scaling-stroke) olmalı: CSS kuralı var
  const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
  assert.ok(/\.turkey-province\s*\{[^}]*vector-effect:\s*non-scaling-stroke/.test(css));
  assert.ok(/\.turkey-province\.is-empty\s*\{\s*fill:/.test(css) && /\.turkey-province\.is-owned\s*\{\s*fill:\s*#ffffff/.test(css));
  assert.ok(/\.turkey-province[^{]*:hover/.test(css), 'Üzerine gelince hafif vurgu');
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

test('Harita ekranı: seçili şehir varsa panel açılır, yoksa kapalı; "Mağazalarıma Git" ve "Klasik Şehre Dön" düğmeleri yoktur', () => {
  const eng = richEngine(777005);
  const base = { formatCurrency: fmt, onSetMapView: noop, onSelectMapCity: noop, onOpenShopInCity: noop, onGoToCity: noop, fixedSize: SIZE };
  let html = renderToStaticMarkup(React.createElement(TurkeyMapScreen, { ...base, state: eng.getState() }));
  assert.ok(html.includes('data-testid="turkey-map"'));
  assert.ok(!html.includes('data-testid="city-info-sheet"'));
  assert.ok(html.includes('data-testid="turkey-map-recenter-btn"'));
  assert.ok(!html.includes('turkey-map-mine-btn') && !html.includes('turkey-map-exit-btn'));

  eng.setSelectedMapCity('antalya');
  eng.openShop({ shopType: 'BUFE', cityId: 'izmir' });
  html = renderToStaticMarkup(React.createElement(TurkeyMapScreen, { ...base, state: eng.getState() }));
  assert.ok(html.includes('data-testid="city-info-sheet"') && html.includes('data-city-id="antalya"'));
  assert.ok(!html.includes('turkey-map-mine-btn'), 'Mağazalarıma Git düğmesi kaldırıldı');
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
