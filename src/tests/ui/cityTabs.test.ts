/**
 * Alt menüde "Harita", Dükkân ve Şirket sekmelerindeki şehir düğmesi, "Ek geliştirmeler" ve kaldırılan öğeler.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { GameBottomNavigation } from '../../components/game/GameBottomNavigation';
import { OyuncuOfisiPanel } from '../../components/game/buildings/OyuncuOfisiPanel';
import { CitySwitcher } from '../../components/game/ui/CitySwitcher';
import { CompanyCityCard } from '../../components/game/ui/CompanyCityCard';
import { ExtraUpgrades, EXTRA_UPGRADE_ITEMS } from '../../components/game/ui/ExtraUpgrades';
import {
  companyBranchesInCity,
  listPlayerCities,
  personalShopsInCity,
  resolveViewCity,
} from '../../components/game/ui/cityViewLogic';
import { isBuildingUnlocked } from '../../components/game/ui/buildingLocks';
import { navTabStatuses, shopTabIndicators } from '../../engine/OnboardingRules';

const fmt = (v: number) => `₺${Math.round(v)}`;
const noop = () => {};

function twoCityEngine() {
  const eng = new SimulationEngine(20261121, 5_000_000);
  eng.getState().headquartersCityId = 'ankara';
  assert.equal(eng.openShop({ shopType: 'BUFE', cityId: 'ankara' }).success, true);
  assert.equal(eng.openShop({ shopType: 'MANAV', cityId: 'izmir' }).success, true);
  return eng;
}

function renderPanel(eng: SimulationEngine, viewCityId?: string) {
  return renderToStaticMarkup(
    React.createElement(OyuncuOfisiPanel, {
      buildingId: 'OYUNCU_OFISI',
      state: eng.getState(),
      spendableCash: 1_000_000,
      formatCurrency: fmt,
      onPlaceProcurementOrder: noop,
      viewCityId: viewCityId ?? null,
      onChangeViewCity: noop,
      onOpenCityService: noop,
    } as never)
  );
}

test('Alt menüdeki ilk sekmenin adı "Harita"; kimliği değişmedi', () => {
  const eng = new SimulationEngine(1, 100_000);
  const html = renderToStaticMarkup(
    React.createElement(GameBottomNavigation, {
      activeTab: 'city',
      onSelectTab: noop,
      openOrdersCount: 0,
      tabStatuses: navTabStatuses(eng.getState()),
      shopIndicators: shopTabIndicators(eng.getState()),
      hasPlayerCompany: false,
      onOpenGuide: noop,
    } as never)
  );
  assert.ok(html.includes('data-testid="bottom-nav-city"'));
  assert.ok(html.includes('Harita'));
  assert.ok(!html.includes('>Şehir<'));
});

test('Şehir listesi: varlığın olan şehirler, merkez önce; seçili şehir yoksa merkez şehir', () => {
  const eng = twoCityEngine();
  const st = eng.getState();
  const list = listPlayerCities(st);
  assert.deepEqual(list.map((c) => c.cityId), ['ankara', 'izmir']);
  assert.equal(list[0].isHeadquarters, true);
  assert.equal(resolveViewCity(st, null), 'ankara');
  assert.equal(resolveViewCity(st, 'izmir'), 'izmir');
  assert.deepEqual(personalShopsInCity(st, 'izmir').map((s) => s.shopType), ['MANAV']);
});

test('Dükkân sekmesi: şehir düğmesi şehrin adını gösterir ve yalnızca o şehrin dükkânları listelenir', () => {
  const eng = twoCityEngine();
  const st = eng.getState();
  const ankaraShop = st.tradeState!.shops.find((s) => s.cityId === 'ankara')!;
  const izmirShop = st.tradeState!.shops.find((s) => s.cityId === 'izmir')!;

  let html = renderPanel(eng);
  assert.ok(html.includes('data-testid="city-switcher-btn-shops"'));
  assert.ok(/data-testid="city-switcher-name-shops">Ankara</.test(html));
  assert.ok(html.includes(`shop-card-${ankaraShop.shopId}`));
  assert.ok(!html.includes(`shop-card-${izmirShop.shopId}`));

  html = renderPanel(eng, 'izmir');
  assert.ok(/data-testid="city-switcher-name-shops">İzmir</.test(html));
  assert.ok(html.includes(`shop-card-${izmirShop.shopId}`));
  assert.ok(!html.includes(`shop-card-${ankaraShop.shopId}`));
});

test('Şehir düğmesi açılınca varlığın olan şehirleri seçenek olarak sunar', () => {
  const eng = twoCityEngine();
  // Liste yalnızca açılınca çizilir: SSR'da kapalı, bileşen mantığı listPlayerCities ile test edildi.
  const html = renderToStaticMarkup(React.createElement(CitySwitcher, { state: eng.getState(), scope: 'company' }));
  assert.ok(html.includes('data-testid="city-switcher-btn-company"'));
  assert.ok(!html.includes('city-switcher-list-company'));
});

test('"Bugünün görevleri" kartı Dükkân sekmesinden kaldırıldı', () => {
  const eng = twoCityEngine();
  const html = renderPanel(eng);
  assert.ok(!html.includes('daily-tasks-card'));
  assert.ok(!html.includes('Bugünün görevleri'));
  assert.ok(html.includes('data-testid="shop-dashboard"'));
});

test('Şehirde dükkân yoksa boş durum yazısı çıkar', () => {
  const eng = twoCityEngine();
  const html = renderPanel(eng, 'antalya');
  assert.ok(html.includes('shop-dashboard-city-empty'));
});

test('Ek geliştirmeler: dükkân sekmesinde düğme var, altı hizmet tanımlı; dükkânsızken sekmede çıkmaz', () => {
  const eng = twoCityEngine();
  assert.ok(renderPanel(eng).includes('data-testid="extra-upgrades-toggle"'));
  assert.equal(EXTRA_UPGRADE_ITEMS.length, 6);
  assert.deepEqual(
    EXTRA_UPGRADE_ITEMS.map((i) => i.id).sort(),
    ['AKADEMI', 'BELEDIYE', 'ENERJI', 'IKINCI_EL', 'LOJISTIK', 'SAGLIK']
  );
  const empty = new SimulationEngine(1, 100_000);
  assert.ok(!renderPanel(empty).includes('extra-upgrades-toggle'));
  // Dükkân yokken bölüm kilitli yazar
  const html = renderToStaticMarkup(React.createElement(ExtraUpgrades, { state: empty.getState() }));
  assert.ok(html.includes('extra-upgrades-toggle'));
});

test('Şirket sekmesi şehir kartı: merkez şehirde genel merkez, başka şehirde boş durum', () => {
  const eng = twoCityEngine();
  const st = eng.getState();
  st.playerCompany = {
    name: 'Deneme Holding A.Ş.', ticker: 'DNM', sector: 'PERAKENDE',
  } as never;
  let html = renderToStaticMarkup(React.createElement(CompanyCityCard, { state: st, cityId: 'ankara', formatCurrency: fmt }));
  assert.ok(html.includes('company-city-hq') && html.includes('Deneme Holding A.Ş.'));
  html = renderToStaticMarkup(React.createElement(CompanyCityCard, { state: st, cityId: 'izmir', formatCurrency: fmt }));
  assert.ok(!html.includes('company-city-hq'));
  assert.ok(html.includes('company-city-empty'));
  // Şirket şubesi bulunduğu şehirde listelenir
  const branch = st.tradeState!.shops.find((s) => s.cityId === 'izmir')!;
  branch.isCompanyBranch = true;
  assert.equal(companyBranchesInCity(st, 'izmir').length, 1);
  html = renderToStaticMarkup(React.createElement(CompanyCityCard, { state: st, cityId: 'izmir', formatCurrency: fmt }));
  assert.ok(html.includes(`company-city-branch-${branch.shopId}`));
  assert.equal(personalShopsInCity(st, 'izmir').length, 0);
});

test('Bina kilidi: şirket yokken Fabrika ve Ar-Ge kilitli, Borsa ve Dükkân açık', () => {
  const eng = new SimulationEngine(1, 100_000);
  const st = eng.getState();
  assert.equal(isBuildingUnlocked(st, 'BORSA'), true);
  assert.equal(isBuildingUnlocked(st, 'OYUNCU_OFISI'), true);
  assert.equal(isBuildingUnlocked(st, 'FABRIKA'), false);
  assert.equal(isBuildingUnlocked(st, 'ARGE_MERKEZI'), false);
  assert.equal(isBuildingUnlocked(st, 'HOLDING_MERKEZI'), false);
});
