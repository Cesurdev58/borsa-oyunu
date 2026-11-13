import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import { getManagerQuote } from '../../engine/ShopManager';
import { MANAGER_MIN_SHOP_LEVEL } from '../../data/gameBalance';

function setup(level2 = true) {
  const eng = new SimulationEngine(20261104, 3_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const id = eng.getState().tradeState!.shops[0].shopId;
  if (level2) assert.equal(eng.upgradeShopLevel(id).success, true);
  return { eng, id, shop: () => eng.getState().tradeState!.shops[0] };
}

test(`Müdür ${MANAGER_MIN_SHOP_LEVEL}. seviyeden önce tutulamaz`, () => {
  const { eng, id } = setup(false);
  const res = eng.hireShopManager(id);
  assert.equal(res.success, false);
  assert.ok(res.message.includes('seviye'));
});

test('Müdür tutmak işe alma ücreti + kasa parası kadar nakit düşürür', () => {
  const { eng, id, shop } = setup();
  const q = getManagerQuote(eng.getState(), shop(), eng.getReservedCash());
  assert.equal(q.allowed, true);
  const cashBefore = eng.getState().cash;
  const shopBefore = shop().cashAccountBalance;
  assert.equal(eng.hireShopManager(id).success, true);
  assert.ok(Math.abs(cashBefore - eng.getState().cash - (q.hireFee + q.topUp)) < 0.02);
  assert.ok(Math.abs(shop().cashAccountBalance - (shopBefore + q.topUp)) < 0.02);
  assert.ok(shop().manager);
  assert.equal(eng.hireShopManager(id).success, false, 'ikinci müdür tutulamaz');
});

test('Müdür rafları kendi doldurur, kâr eder ve fazlasını oyuncuya gönderir', () => {
  const { eng, id, shop } = setup();
  eng.hireShopManager(id);
  const cashAfterHire = eng.getState().cash;
  let profitDays = 0;
  for (let d = 1; d <= 40; d++) {
    eng.advanceDaysWithoutPlayerDecisions(1, true);
    if (d > 10 && shop().todayNetProfit > 0) profitDays++;
  }
  const stock = shop().inventoryBatches.reduce((a, b) => a + b.quantity, 0);
  assert.ok(stock > 0, 'raflar boş kalmamalı');
  assert.ok(profitDays >= 20, `müdürlü dükkân çoğu gün kâr etmeli (${profitDays}/30)`);
  assert.ok((shop().manager!.totalSweptToPlayer ?? 0) > 0, 'fazla kâr oyuncuya aktarılmalı');
  assert.ok(eng.getState().cash > cashAfterHire, 'oyuncunun cebi büyümeli');
  assert.equal(shop().manager!.lowCash ?? false, false);
});

test('Müdür oyuncunun cebinden mal almaz (aktarma kapalıyken cep sabit kalır)', () => {
  const { eng, id, shop } = setup();
  eng.hireShopManager(id);
  eng.setShopManagerSweep(id, false);
  const cash0 = eng.getState().cash;
  for (let d = 0; d < 10; d++) eng.advanceDaysWithoutPlayerDecisions(1, true);
  // Borsa hareketi yok (hisse yok); fark yalnızca faiz/olay kaynaklı küçük oynamalar olabilir
  assert.ok(Math.abs(eng.getState().cash - cash0) < 1_000, 'müdür kişisel nakdi harcamamalı');
  assert.ok(shop().manager!.totalRestockSpent > 0, 'müdür kasadan mal almalı');
});

test('Müdür kayıtta korunur; görevden alınınca dükkân oyuncuya döner', () => {
  const { eng, id, shop } = setup();
  eng.hireShopManager(id);
  const env = SimulationStore.saveToStorage(eng);
  const migrated = SimulationStore.migrateIfNeeded(JSON.parse(JSON.stringify(env)));
  assert.ok(migrated?.state.tradeState?.shops[0].manager);
  assert.equal(eng.fireShopManager(id).success, true);
  assert.equal(shop().manager, undefined);
});
