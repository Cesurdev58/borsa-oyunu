/**
 * PR5 (Faz 10–11): harita filtreleri, gerçek sorun halkası, varsayılan harita ve rehber.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import { TycoonGameView } from '../../components/game/TycoonGameView';
import { TurkeyMapScreen, buildMapMarkers } from '../../components/game/turkeyMap/TurkeyMapScreen';
import {
  DEFAULT_MAP_FILTER,
  MAP_FILTERS,
  cityMatchesFilter,
  factoryCityIds,
  mapFilterCounts,
  warehouseCityIds,
} from '../../components/game/turkeyMap/mapFilters';
import { CITY_IDS } from '../../data/cityDefinitions';
import { SHOP_ISSUE_LABEL_TR, SHOP_LOSS_GRACE_DAYS, cityHasIssue, shopHasIssue, shopIssueKinds } from '../../engine/CityOpeningQuote';
import { GUIDE_STEPS, resolveGuideTarget } from '../../components/game/FirstRunGuide';
import { firstShopGateStatus } from '../../engine/FirstShopGate';
import type { SimulationState } from '../../models/simulation';

const fmt = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;
const noop = () => {};
const SIZE = { width: 390, height: 560 };

function richEngine(seed = 777001) {
  const eng = new SimulationEngine(seed, 5_000_000);
  eng.getState().headquartersCityId = 'izmir';
  return eng;
}

const healthyShop = {
  inventoryBatches: [{ availableQuantity: 10 }],
  pendingDeliveriesCount: 0,
  staffCount: 2,
  minStaffRequired: 2,
  ownerWorks: false,
  todayNetProfit: 500,
  openedDay: 1,
};

// ---------------------------------------------------------------------------
// Faz 10 — gerçek operasyon sorunları
// ---------------------------------------------------------------------------

test('Sorun kuralı: sağlıklı dükkânda sorun yok', () => {
  assert.deepEqual(shopIssueKinds(healthyShop, 30), []);
  assert.equal(shopHasIssue(healthyShop, 30), false);
});

test('Sorun kuralı: stok bitti (yolda mal varsa sorun değil)', () => {
  assert.deepEqual(shopIssueKinds({ ...healthyShop, inventoryBatches: [] }, 30), ['STOCK_OUT']);
  assert.deepEqual(shopIssueKinds({ ...healthyShop, inventoryBatches: [{ availableQuantity: 0 }] }, 30), ['STOCK_OUT']);
  assert.deepEqual(shopIssueKinds({ ...healthyShop, inventoryBatches: [], pendingDeliveriesCount: 1 }, 30), []);
});

test('Sorun kuralı: zarar yalnızca yeni dükkân tolerans süresini geçince ve gerçek zararda sayılır', () => {
  const losing = { ...healthyShop, todayNetProfit: -900, openedDay: 10 };
  assert.deepEqual(shopIssueKinds(losing, 10 + SHOP_LOSS_GRACE_DAYS), ['LOSS']);
  assert.deepEqual(shopIssueKinds(losing, 10 + SHOP_LOSS_GRACE_DAYS - 1), [], 'ilk günlerde zarar sayılmaz');
  assert.deepEqual(shopIssueKinds({ ...losing, todayNetProfit: -0.4 }, 30), [], 'küsurat zarar sayılmaz');
  assert.deepEqual(shopIssueKinds({ ...losing, todayNetProfit: Number.NaN }, 30), []);
  assert.deepEqual(shopIssueKinds(losing), [], 'gün verilmezse zarar kuralı atlanır');
});

test('Sorun kuralı: çalışan eksik; sahip çalışırken eksik sayılmaz', () => {
  assert.deepEqual(shopIssueKinds({ ...healthyShop, staffCount: 1 }, 30), ['STAFF_SHORT']);
  assert.deepEqual(shopIssueKinds({ ...healthyShop, staffCount: 0, ownerWorks: true }, 30), []);
});

test('Sorun kuralı: müdürün kasası boşsa sorun; etiketler Türkçe ve boş değil', () => {
  assert.deepEqual(shopIssueKinds({ ...healthyShop, manager: { lowCash: true } }, 30), ['MANAGER_CASH']);
  for (const label of Object.values(SHOP_ISSUE_LABEL_TR)) assert.ok(label.length > 3);
  const many = shopIssueKinds({ ...healthyShop, inventoryBatches: [], staffCount: 0, todayNetProfit: -5000, manager: { lowCash: true } }, 30);
  assert.deepEqual([...many].sort(), ['LOSS', 'MANAGER_CASH', 'STAFF_SHORT', 'STOCK_OUT']);
});

test('Gerçek durumda halka: zarar eden ve çalışanı eksik dükkân şehri sorunlu olur, düzelince halka kalkar', () => {
  const eng = richEngine();
  assert.ok(eng.openShop({ shopType: 'BUFE', cityId: 'bursa' }).success);
  const st = eng.getState();
  const shop = st.tradeState!.shops.find((s) => s.cityId === 'bursa')!;
  // Rafı dolu göster: yalnızca stok dışı kurallar denensin
  shop.inventoryBatches = [{ availableQuantity: 50, quantity: 50 } as never];
  shop.ownerWorks = false;
  shop.staffCount = shop.minStaffRequired;
  shop.todayNetProfit = 100;
  st.day = shop.openedDay + 10;
  assert.equal(cityHasIssue(st, 'bursa'), false);
  assert.equal(buildMapMarkers(st).find((m) => m.cityId === 'bursa')!.hasIssue, false);

  shop.todayNetProfit = -2_000;
  assert.equal(cityHasIssue(st, 'bursa'), true);
  shop.todayNetProfit = 100;
  shop.staffCount = Math.max(0, shop.minStaffRequired - 1);
  assert.equal(cityHasIssue(st, 'bursa'), true);
  shop.staffCount = shop.minStaffRequired;
  assert.equal(cityHasIssue(st, 'bursa'), false);
});

// ---------------------------------------------------------------------------
// Faz 10 — filtreler
// ---------------------------------------------------------------------------

test('Filtreler: tam altı filtre var, etiketler Türkçe', () => {
  assert.deepEqual(
    MAP_FILTERS.map((f) => f.labelTR),
    ['Tüm şehirler', 'Mağazalarım', 'Fabrikalarım', 'Depolarım', 'Merkezim', 'Sorunlu işletmeler']
  );
  assert.equal(DEFAULT_MAP_FILTER, 'ALL');
});

test('Filtreler: her filtre gerçek durumdan hesaplanır (mağaza, merkez, sorun, depo, fabrika)', () => {
  const eng = richEngine();
  assert.ok(eng.openShop({ shopType: 'BUFE', cityId: 'izmir' }).success);
  assert.ok(eng.openShop({ shopType: 'MANAV', cityId: 'bursa' }).success);
  const st = eng.getState();
  const match = (id: string, f: Parameters<typeof cityMatchesFilter>[2]) => cityMatchesFilter(st, id as never, f);

  assert.ok(CITY_IDS.every((id) => match(id, 'ALL')));
  assert.equal(match('izmir', 'SHOPS'), true);
  assert.equal(match('bursa', 'SHOPS'), true);
  assert.equal(match('ankara', 'SHOPS'), false);
  assert.equal(match('izmir', 'HQ'), true);
  assert.equal(match('bursa', 'HQ'), false);
  // Yeni açılan dükkânların rafı boş: ikisi de sorunlu
  assert.equal(match('bursa', 'ISSUES'), true);
  assert.equal(match('ankara', 'ISSUES'), false);

  // Depo: şehri olmayan depo merkez depodur; şehri olan depo kendi şehrinde
  assert.deepEqual(warehouseCityIds(st), ['izmir']);
  st.tradeState!.warehouses.push({ ...st.tradeState!.warehouses[0], warehouseId: 'W-X', cityId: 'mersin' });
  assert.deepEqual([...warehouseCityIds(st)].sort(), ['izmir', 'mersin']);
  assert.equal(match('mersin', 'WAREHOUSES'), true);
  assert.equal(match('bursa', 'WAREHOUSES'), false);

  // Fabrika: şirket yoksa hiçbir şehirde yok; şirket kurulunca yalnızca merkez şehirde
  assert.deepEqual(factoryCityIds(st), []);
  assert.equal(match('izmir', 'FACTORIES'), false);
  st.playerCompany = { productionCapacity: 100 } as never;
  assert.deepEqual(factoryCityIds(st), ['izmir']);
  assert.equal(match('izmir', 'FACTORIES'), true);
  assert.equal(match('bursa', 'FACTORIES'), false);
  st.playerCompany = { productionCapacity: 0 } as never;
  assert.deepEqual(factoryCityIds(st), []);
});

test('Filtreler: sayılar doğru; merkezi olmayan (bekleyen) kayıtta çökmez', () => {
  const eng = richEngine();
  assert.ok(eng.openShop({ shopType: 'BUFE', cityId: 'bursa' }).success);
  const st = eng.getState();
  const counts = mapFilterCounts(st, CITY_IDS);
  assert.equal(counts.ALL, 81);
  assert.equal(counts.SHOPS, 1); // yalnızca Bursa'da dükkân var (merkez İzmir'de dükkân yok)
  assert.equal(counts.HQ, 1);
  st.headquartersCityId = undefined;
  const c2 = mapFilterCounts(st, CITY_IDS);
  assert.equal(c2.HQ, 0);
  assert.equal(c2.FACTORIES, 0);
  assert.equal(c2.WAREHOUSES, 0);
});

test('Filtre harita durumunu bozmaz: kamera, seçili şehir ve oyun kaydı aynı kalır', () => {
  const eng = richEngine();
  assert.ok(eng.openShop({ shopType: 'BUFE', cityId: 'bursa' }).success);
  const st = eng.getState();
  st.selectedMapCityId = 'bursa';
  st.turkeyMapView = { zoom: 2.2, panX: 700, panY: 400 };
  const before = JSON.stringify({ v: st.turkeyMapView, s: st.selectedMapCityId, all: eng.serializeState() });
  for (const f of MAP_FILTERS) {
    const markers = buildMapMarkers(st, f.id);
    assert.equal(markers.length, 81);
    const dimmed = markers.filter((m) => m.dimmed).length;
    assert.equal(dimmed, 81 - mapFilterCounts(st, CITY_IDS)[f.id]);
  }
  const after = JSON.stringify({ v: st.turkeyMapView, s: st.selectedMapCityId, all: eng.serializeState() });
  assert.equal(before, after);
});

test('Filtre çubuğu çizilir; seçili filtrede uymayan şehir soluk ama yine tıklanabilir; halka ile işaret rengi ayrı kalır', () => {
  const eng = richEngine();
  assert.ok(eng.openShop({ shopType: 'MANAV', cityId: 'bursa' }).success);
  const st = eng.getState();
  const html = renderToStaticMarkup(
    React.createElement(TurkeyMapScreen, {
      state: st,
      formatCurrency: fmt,
      onSetMapView: noop,
      onSelectMapCity: noop,
      onOpenShopInCity: noop,
      onGoToCity: noop,
      filter: 'SHOPS',
      fixedSize: SIZE,
    })
  );
  assert.ok(html.includes('data-testid="map-filter-bar"'));
  for (const f of MAP_FILTERS) assert.ok(html.includes(`data-testid="map-filter-${f.id}"`), f.id);
  assert.ok(/data-testid="map-filter-SHOPS"[^>]*aria-pressed="true"/.test(html) || /aria-pressed="true"[^>]*data-testid="map-filter-SHOPS"/.test(html));
  const g = (id: string) => html.match(new RegExp(`<g[^>]*data-testid="turkey-city-marker-${id}"[^>]*>([\\s\\S]*?)</g>`))![0];
  assert.ok(g('ankara').includes('data-dimmed="true"'));
  assert.ok(!g('ankara').includes('disabled'));
  assert.ok(g('ankara').includes('role="button"'));
  const bursa = g('bursa');
  assert.ok(bursa.includes('data-dimmed="false"'));
  // Sorunlu il: beyaz dolgu (is-owned) + kırmızı kenarlık üst katmanda
  assert.ok(bursa.includes('is-owned'));
  assert.ok(html.includes('data-testid="turkey-city-issue-bursa"'));
  // Merkez il: altın kenarlık üst katmanda
  assert.ok(html.includes('data-testid="turkey-city-hq-izmir"') && html.includes('var(--g-gold'));
});

// ---------------------------------------------------------------------------
// Faz 11 — varsayılan harita
// ---------------------------------------------------------------------------

function renderGameView(engine: SimulationEngine, withMapProps: boolean) {
  return renderToStaticMarkup(
    React.createElement(TycoonGameView, {
      state: engine.getState(),
      ipoEligibility: engine.checkIPOEligibility(),
      nextEvent: engine.getNextScheduledEvent(),
      notifications: [],
      onMarkNotificationsRead: noop,
      onSetTimeScale: noop,
      onSetRealMinutesPerDay: noop,
      onAdvanceToMarketOpen: noop,
      onAdvanceOneHour: noop,
      onTickDay: noop,
      onSimulateOfflineProgress: noop,
      onManualSave: noop,
      onResetSimulation: noop,
      onDismissOfflineModal: noop,
      onSwitchToDeveloperDashboard: noop,
      selectedTicker: 'NVEX',
      onSelectTicker: noop,
      onPlaceOrder: noop,
      onCancelOrder: noop,
      onBuyStock: noop,
      onSellStock: noop,
      onEstablishCompany: noop,
      onTransferCapital: noop,
      onConfigureOperations: noop,
      onExecuteIPO: noop,
      onExecuteTakeover: noop,
      spendableCash: engine.getSpendableCash(),
      reservedCash: engine.getReservedCash(),
      getReservedShares: () => 0,
      formattedTime: engine.getFormattedGameTime(),
      formatCurrency: fmt,
      ...(withMapProps
        ? { onSetTurkeyMapView: noop, onSelectMapCity: noop, onOpenShopInCity: noop }
        : {}),
    } as never)
  );
}

test('Şehir sekmesi doğrudan Türkiye haritasını açar; klasik şehir ve eski düğmeler yoktur', () => {
  const engine = SimulationStore.resetSharedEngine();
  engine.getState().headquartersCityId = 'ankara';
  const html = renderGameView(engine, true);
  assert.ok(html.includes('data-testid="turkey-map-flow"'), 'harita açık');
  assert.ok(html.includes('data-testid="turkey-map-screen"'));
  assert.ok(html.includes('data-testid="map-filter-bar"'));
  assert.equal(html.includes('city-open-turkey-map-btn'), false, 'klasik ekrandaki geçiş düğmesi yok');
  assert.equal(html.includes('turkey-map-exit-btn'), false, '"Klasik Şehre Dön" düğmesi yok');
  assert.equal(html.includes('turkey-map-mine-btn'), false, '"Mağazalarıma Git" düğmesi yok');
  assert.equal(html.includes('city-neighborhood'), false);
});

test('Harita bağlantısı verilmezse oyun çökmez, kısa bir uyarı gösterilir (klasik şehre düşülmez)', () => {
  const engine = SimulationStore.resetSharedEngine();
  const html = renderGameView(engine, false);
  assert.ok(html.includes('data-testid="turkey-map-unavailable"'));
  assert.equal(html.includes('city-neighborhood'), false);
});

// ---------------------------------------------------------------------------
// Faz 11 — rehber
// ---------------------------------------------------------------------------

test('Rehber: dükkân kapısı sonrası adımlar Şehir sekmesi → şehre dokun → ilk dükkânı aç sırasıyla gelir', () => {
  const ids = GUIDE_STEPS.map((s) => s.id);
  const i = (id: string) => ids.indexOf(id);
  assert.ok(i('market-day') < i('city-tab') && i('city-tab') < i('map-pick-city'));
  assert.ok(i('map-pick-city') < i('opening-capital') && i('opening-capital') < i('first-order'));
  assert.equal(ids.includes('shop-tab'), false, 'eski Dükkân sekmesi adımı kalktı');
});

test('Rehber halkası harita noktasına ve panel düğmesine oturur', () => {
  const eng = richEngine();
  const st = eng.getState() as SimulationState;
  const gate = firstShopGateStatus(st);
  const step = (id: string) => GUIDE_STEPS.find((s) => s.id === id)!;
  const ctx = (activeTab: string) => ({ state: st, activeTab: activeTab as never, gate });

  assert.equal(resolveGuideTarget(step('city-tab'), ctx('market')), '[data-testid="bottom-nav-city"]');
  // Şehir sekmesinde halka başlangıç şehrinin noktasına
  assert.equal(resolveGuideTarget(step('map-pick-city'), ctx('city')), '[data-testid="turkey-city-marker-izmir"]');
  // Başka sekmedeyken önce Şehir sekmesini gösterir
  assert.equal(resolveGuideTarget(step('map-pick-city'), ctx('market')), '[data-testid="bottom-nav-city"]');
  // Şehir seçili değilse nokta, seçiliyse panel düğmesi
  st.selectedMapCityId = undefined;
  assert.equal(resolveGuideTarget(step('opening-capital'), ctx('city')), '[data-testid="turkey-city-marker-izmir"]');
  st.selectedMapCityId = 'izmir';
  assert.equal(resolveGuideTarget(step('opening-capital'), ctx('city')), '[data-testid="city-open-first-shop-btn"]');
  // Adımlar dükkân yokken ve kapı açıkken görünür; dükkân açılınca biter
  const avail = (id: string) => step(id).available!(ctx('city'));
  assert.equal(avail('map-pick-city'), gate.open);
  assert.ok(eng.openShop({ shopType: 'BUFE', cityId: 'izmir' }).success);
  assert.equal(step('opening-capital').done!(ctx('city')), true);
  assert.equal(step('map-pick-city').done!(ctx('city')), true);
});
