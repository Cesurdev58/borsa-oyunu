/**
 * Faz 3.4 (ek): "Rafları doldur" teslim süresini sayar.
 * Mal ancak gün kapanınca (teslim süresi sonunda) rafa gelir; çok satan dükkânda raf hedefi teslim süresine
 * yetmiyor, raf gün içinde boşalıyordu. Planlayıcı artık dünkü talebe göre teslim süresi + 1 günlük mal
 * bulundurur; raf + depo kapasitesini aşmaz, raf hedefi alt sınırdır.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { planShopRestock } from '../../engine/ShopRestockPlanner';
import { SHOP_TEMPLATES } from '../../data/tradeCatalog';

function emptyMarket() {
  const eng = new SimulationEngine(20261128, 5_000_000);
  assert.equal(eng.openShop({ shopType: 'MARKET' }).success, true);
  const shop = eng.getState().tradeState!.shops[0];
  shop.inventoryBatches = [];
  return { eng, shop };
}

test('Az satan dükkânda hedef raf doluluğudur (eski davranış)', () => {
  const { eng, shop } = emptyMarket();
  shop.todayUnitsSold = 0;
  shop.todayUnmetCustomerDemand = 0;
  const n = SHOP_TEMPLATES.MARKET.allowedResourceIds.length;
  const plan = planShopRestock(eng.getState(), shop.shopId, 1e9);
  for (const o of plan.orders) {
    assert.ok(o.quantity <= Math.floor((shop.shelfCapacity * 0.9) / n), `${o.resourceId}: ${o.quantity}`);
  }
});

test('Çok satan dükkânda teslim süresine yetecek kadar, ama raf + depo kapasitesini aşmadan sipariş', () => {
  const { eng, shop } = emptyMarket();
  const n = SHOP_TEMPLATES.MARKET.allowedResourceIds.length;
  const shelfTarget = Math.floor((shop.shelfCapacity * 0.9) / n);
  const capCeiling = Math.floor(((shop.shelfCapacity + shop.backroomCapacity) * 0.9) / n);
  // Dün raf hedefinin iki katı satıldı/satılamadı
  shop.todayUnitsSold = shelfTarget * n * 2;
  shop.todayUnmetCustomerDemand = 0;
  const plan = planShopRestock(eng.getState(), shop.shopId, 1e9);
  assert.ok(plan.orders.length > 0);
  assert.ok(plan.orders.some((o) => o.quantity > shelfTarget), 'raf hedefinin üstünde sipariş');
  for (const o of plan.orders) assert.ok(o.quantity <= capCeiling, `${o.resourceId}: ${o.quantity} ≤ ${capCeiling}`);
});
