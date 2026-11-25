/**
 * Faz 3.2: şehir deposu kurma ve arayüz kartı.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { getCityDepotPlan, listCityDepots, CITY_DEPOT_LOOKBACK_DAYS } from '../../engine/CityDepot';
import { shopLogisticsRoute } from '../../engine/CityEconomy';
import { CITY_DEPOT_COST, LOGISTICS_DEPOT_DISCOUNT } from '../../data/cityBalance';
import { CityDepotCard } from '../../components/game/turkeyMap/CityDepotCard';
import { CityShopsScreen } from '../../components/game/turkeyMap/CityShopsScreen';
import { restockShops } from '../balance/restockBot';

const fmt = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;
const noop = () => {};

/** Ankara merkezli, Samsun'da (uzak, limanlı) bir dükkânı olan ve birkaç gün sipariş vermiş oyuncu. */
function engineWithRemoteShop(seed = 880401) {
  const eng = new SimulationEngine(seed, 3_000_000);
  assert.equal(eng.chooseStartCity('ankara').success, true);
  assert.equal(eng.openShop({ shopType: 'BUFE', cityId: 'ankara' }).success, true);
  const res = eng.openShop({ shopType: 'MANAV', cityId: 'samsun' });
  assert.equal(res.success, true, res.message);
  for (let d = 0; d < 6; d++) {
    restockShops(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
  }
  return eng;
}

test('Depo teklifi: dükkânı olmayan şehirde kurulamaz, gerekçesi yazılır', () => {
  const eng = engineWithRemoteShop();
  const plan = getCityDepotPlan(eng.getState(), 'izmir');
  assert.equal(plan.canBuild, false);
  assert.equal(plan.blockReason, 'NO_SHOP');
  assert.equal(plan.shopCount, 0);
});

test('Depo teklifi gerçek nakliyeden hesaplanır: son 30 günün nakliyesi ve tahmini tasarruf', () => {
  const eng = engineWithRemoteShop();
  const st = eng.getState();
  const samsunShop = st.tradeState!.shops.find((s) => s.cityId === 'samsun')!;
  const expectedShipping = st.tradeState!.procurementOrders
    .filter(
      (o) =>
        o.targetDestinationId === samsunShop.shopId &&
        o.createdDay > st.day - CITY_DEPOT_LOOKBACK_DAYS &&
        o.status !== 'CANCELLED'
    )
    .reduce((a, o) => a + o.shippingCost, 0);
  assert.ok(expectedShipping > 0, 'Samsun dükkânına sipariş verildi');

  const plan = getCityDepotPlan(st, 'samsun');
  assert.equal(plan.canBuild, true);
  assert.equal(plan.cost, CITY_DEPOT_COST);
  assert.equal(plan.shippingLast30Days, Math.round(expectedShipping));
  assert.equal(plan.discountNowPct, 15, 'Samsun limanı');
  assert.equal(plan.discountWithDepotPct, 35);
  // (1 − 0,35) / (1 − 0,15) → tasarruf payı ~%23,5
  const share = 1 - (1 - 0.35) / (1 - 0.15);
  assert.ok(Math.abs(plan.estimatedSaving30Days - expectedShipping * share) <= 1);
  assert.ok(plan.paybackDays !== null && plan.paybackDays > 0);
});

test('Depo kurulur: bedel birebir düşer, depo şehre yazılır, nakliye indirimi başlar; ikinci kez kurulmaz', () => {
  const eng = engineWithRemoteShop();
  const st = eng.getState();
  const shop = st.tradeState!.shops.find((s) => s.cityId === 'samsun')!;
  const validBefore = eng.runFinancialIntegrityAuditNonMutating().financialIntegrityReport.valid;
  const before = shopLogisticsRoute(st, shop, 10);
  assert.equal(before.depot, false);
  const cash0 = st.cash;

  const res = eng.buildCityDepot('samsun');
  assert.equal(res.success, true, res.message);
  assert.ok(Math.abs(cash0 - eng.getState().cash - CITY_DEPOT_COST) < 0.01, 'tam bedel düştü');

  const depots = listCityDepots(eng.getState());
  assert.equal(depots.length, 1);
  assert.equal(depots[0].cityId, 'samsun');
  assert.equal(depots[0].usedUnits, 0);

  const after = shopLogisticsRoute(eng.getState(), shop, 10);
  assert.equal(after.depot, true);
  assert.ok(Math.abs(after.discount - (before.discount + LOGISTICS_DEPOT_DISCOUNT)) < 1e-9);
  assert.ok(after.multiplier < before.multiplier);

  // İkinci kez: para düşmez
  const cash1 = eng.getState().cash;
  const again = eng.buildCityDepot('samsun');
  assert.equal(again.success, false);
  assert.equal(again.duplicate, true);
  assert.equal(eng.getState().cash, cash1);
  assert.equal(listCityDepots(eng.getState()).length, 1);

  // Defter tutarlı
  const report = eng.runFinancialIntegrityAuditNonMutating().financialIntegrityReport;
  assert.equal(report.valid, validBefore, JSON.stringify(report.ledgerBalanceMismatches));

  // Kayıt → yükleme: depo korunur
  const restored = SimulationEngine.deserializeState(eng.serializeState());
  assert.equal(listCityDepots(restored.getState())[0]?.cityId, 'samsun');
});

test('Parası yetmeyen oyuncu depo kuramaz, para düşmez', () => {
  const eng = engineWithRemoteShop(880402);
  const st = eng.getState();
  const saved = st.cash;
  (st as { cash: number }).cash = CITY_DEPOT_COST - 1; // yalnızca test: sahte durum
  try {
    const res = eng.buildCityDepot('samsun');
    assert.equal(res.success, false);
    assert.equal(eng.getState().cash, CITY_DEPOT_COST - 1);
    assert.equal(listCityDepots(eng.getState()).length, 0);
  } finally {
    (st as { cash: number }).cash = saved;
  }
});

test('Depo kartı: dükkânlı şehirde bedel, tasarruf ve kurma düğmesi; kurulunca doluluk', () => {
  const eng = engineWithRemoteShop();
  const html = renderToStaticMarkup(
    React.createElement(CityDepotCard, {
      cityId: 'samsun',
      state: eng.getState(),
      formatCurrency: fmt,
      onBuildDepot: noop,
    })
  );
  assert.match(html, /data-testid="city-depot-card"/);
  assert.match(html, /data-testid="city-depot-cost"/);
  assert.match(html, /data-testid="city-depot-saving"/);
  assert.match(html, /data-testid="city-depot-payback"/);
  assert.match(html, /data-testid="city-depot-build-btn"/);

  // Dükkânı olmayan şehirde kart hiç çizilmez
  const none = renderToStaticMarkup(
    React.createElement(CityDepotCard, { cityId: 'izmir', state: eng.getState(), formatCurrency: fmt })
  );
  assert.equal(none, '');

  eng.buildCityDepot('samsun');
  const screen = renderToStaticMarkup(
    React.createElement(CityShopsScreen, {
      cityId: 'samsun',
      state: eng.getState(),
      formatCurrency: fmt,
      onBackToMap: noop,
      onManageShop: noop,
      onBuildDepot: noop,
    })
  );
  assert.match(screen, /data-depot-exists="true"/);
  assert.match(screen, /data-testid="city-depot-status"/);
  assert.doesNotMatch(screen, /city-depot-build-btn/);
});
