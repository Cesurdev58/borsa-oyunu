import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { planShopRestock } from '../../engine/ShopRestockPlanner';

test('Rafları doldur planı: bütçeyi aşmaz, uygulanınca ikinci plan boş kalır', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const shopId = eng.getState().tradeState!.shops[0].shopId;

  const budget = eng.getSpendableCash();
  const plan = planShopRestock(eng.getState(), shopId, budget);
  assert.ok(plan.orders.length > 0, 'boş rafta sipariş önerilmeli');
  assert.ok(plan.totalCost <= budget, 'plan bütçeyi aşmamalı');

  for (const o of plan.orders) {
    const r = eng.placeProcurementOrder({
      supplierId: o.supplierId,
      resourceId: o.resourceId,
      quantity: o.quantity,
      destinationType: 'SHOP',
      destinationId: shopId,
      paymentTermType: 'CASH',
    });
    assert.equal(r.success, true, r.message);
  }

  const again = planShopRestock(eng.getState(), shopId, eng.getSpendableCash());
  assert.equal(again.orders.length, 0, 'yoldaki siparişler sayılmalı, tekrar sipariş verilmemeli');
});

test('Rafları doldur planı: bütçe sıfırsa sipariş önermez', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  eng.openShop({ shopType: 'BUFE' });
  const shopId = eng.getState().tradeState!.shops[0].shopId;
  assert.equal(planShopRestock(eng.getState(), shopId, 0).orders.length, 0);
});
