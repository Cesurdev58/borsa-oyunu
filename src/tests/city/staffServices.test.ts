import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { restockShops } from '../balance/restockBot';
import { planShopRestock } from '../../engine/ShopRestockPlanner';
import {
  activeCargoFee,
  cargoDailyFee,
  insuranceDailyPremium,
  trainedStaffCount,
  trainingBasketMultiplier,
  trainingCostPerPerson,
  untrainedStaffCount,
} from '../../engine/CityServices';
import { CARGO_SHIPPING_CUT, INSURANCE_BLOCKED_DECISIONS, INSURANCE_PREMIUM_RATE, TRAINING_BASKET_PCT } from '../../data/cityServices';

function withShop(type = 'MANAV', seed = 20261104) {
  const eng = new SimulationEngine(seed, 2_000_000);
  assert.equal(eng.openShop({ shopType: type as never }).success, true);
  return eng;
}

test('Dükkân yokken eğitim ve sigorta alınamaz', () => {
  const eng = new SimulationEngine(20261104, 2_000_000);
  assert.equal(eng.trainShopStaff('yok').success, false);
  assert.equal(eng.setStaffInsurance('yok', true).success, false);
});

test('Akademi: eğitim bütün eğitimsiz çalışanları eğitir, sepeti büyütür', () => {
  const eng = withShop();
  const shop = () => eng.getState().tradeState!.shops[0];
  const staff = shop().staffCount;
  assert.equal(trainingBasketMultiplier(shop()), 1);
  const cost = untrainedStaffCount(shop()) * trainingCostPerPerson(shop());
  const before = shop().cashAccountBalance + eng.getState().cash;
  const r = eng.trainShopStaff(shop().shopId);
  assert.equal(r.success, true, r.message);
  assert.equal(trainedStaffCount(shop()), staff);
  assert.ok(Math.abs(before - (shop().cashAccountBalance + eng.getState().cash) - cost) < 1, 'eğitim ücreti ödendi');
  assert.ok(Math.abs(trainingBasketMultiplier(shop()) - (1 + TRAINING_BASKET_PCT / 100)) < 1e-9);
  assert.equal(eng.trainShopStaff(shop().shopId).success, false, 'ikinci kez gerekmez');
});

test('Akademi: yeni çalışan eğitimsiz gelir, çalışan azalınca eğitimli sayısı da azalır', () => {
  const eng = withShop();
  const shop = () => eng.getState().tradeState!.shops[0];
  eng.trainShopStaff(shop().shopId);
  const staff = shop().staffCount;
  eng.configureShopParameters({ shopId: shop().shopId, targetStaffCount: staff + 1 });
  assert.equal(untrainedStaffCount(shop()), 1);
  assert.ok(trainingBasketMultiplier(shop()) < 1 + TRAINING_BASKET_PCT / 100);
  eng.configureShopParameters({ shopId: shop().shopId, targetStaffCount: 1 });
  assert.equal(shop().trainedStaff, 1);
  eng.configureShopParameters({ shopId: shop().shopId, targetStaffCount: staff });
  assert.equal(trainedStaffCount(shop()), 1, 'kovulan eğitimli geri gelmez');
});

test('Akademi: eğitimli dükkân aynı günlerde daha çok satar', () => {
  const run = (train: boolean) => {
    const eng = withShop('KAFE');
    const id = eng.getState().tradeState!.shops[0].shopId;
    if (train) eng.trainShopStaff(id);
    let rev = 0;
    for (let d = 0; d < 20; d++) {
      restockShops(eng);
      eng.advanceDaysWithoutPlayerDecisions(1, true);
      rev += eng.getState().tradeState!.shops[0].todaySalesRevenue;
    }
    return rev;
  };
  assert.ok(run(true) > run(false));
});

test('Sağlık Merkezi: prim her gün maaşla birlikte düşer, müşteri artar, kapatılabilir', () => {
  const run = (insure: boolean) => {
    const eng = withShop('KAFE');
    const id = eng.getState().tradeState!.shops[0].shopId;
    if (insure) assert.equal(eng.setStaffInsurance(id, true).success, true);
    let customers = 0;
    let payroll = 0;
    for (let d = 0; d < 20; d++) {
      restockShops(eng);
      eng.advanceDaysWithoutPlayerDecisions(1, true);
      const sh = eng.getState().tradeState!.shops[0];
      customers += sh.todayWalkInCustomers;
      payroll = sh.todayPayrollCost;
    }
    return { eng, id, customers, payroll };
  };
  const a = run(false);
  const b = run(true);
  const sh = b.eng.getState().tradeState!.shops[0];
  assert.equal(insuranceDailyPremium(sh), Math.round(sh.staffCount * sh.staffDailyWagePerPerson * INSURANCE_PREMIUM_RATE));
  assert.ok(Math.abs(b.payroll - a.payroll - insuranceDailyPremium(sh)) < 1, 'prim personel giderinde');
  assert.ok(b.customers > a.customers, 'sigortalı dükkâna daha çok müşteri');
  assert.equal(b.eng.setStaffInsurance(b.id, true).success, false);
  assert.equal(b.eng.setStaffInsurance(b.id, false).success, true);
  assert.equal(sh.staffInsurance, false);
});

test('Sağlık Merkezi: sigortalı dükkânda zam ve rakibe kaçma kartları çıkmaz', () => {
  const cards = (insure: boolean) => {
    const eng = new SimulationEngine(20261104, 5_000_000);
    eng.openShop({ shopType: 'BUFE' });
    eng.openShop({ shopType: 'MANAV' });
    if (insure) for (const s of eng.getState().tradeState!.shops) eng.setStaffInsurance(s.shopId, true);
    const seen: string[] = [];
    for (let d = 0; d < 400; d++) {
      const p = eng.getState().decisionEvents?.pending;
      if (p) {
        seen.push(p.templateId);
        eng.resolveDecisionEvent('A');
      }
      eng.advanceDaysWithoutPlayerDecisions(1, true);
    }
    return seen;
  };
  const without = cards(false);
  assert.ok(without.some((t) => INSURANCE_BLOCKED_DECISIONS.includes(t)), 'sigortasız oyuncuda bu kartlar çıkar');
  const insured = cards(true);
  assert.ok(insured.length > 0);
  assert.ok(!insured.some((t) => INSURANCE_BLOCKED_DECISIONS.includes(t)));
});

test('Eğitim ve sigorta kayıttan geri yüklenir', () => {
  const eng = withShop();
  const id = eng.getState().tradeState!.shops[0].shopId;
  eng.trainShopStaff(id);
  eng.setStaffInsurance(id, true);
  const back = SimulationEngine.deserializeState(eng.serializeState());
  const shop = back.getState().tradeState!.shops[0];
  assert.equal(shop.staffInsurance, true);
  assert.equal(trainedStaffCount(shop), shop.staffCount);
});

// ---------------------------------------------------------------------------
// Lojistik: kargo anlaşması
// ---------------------------------------------------------------------------

test('Lojistik: anlaşmalı dükkânın siparişi yarı nakliyeyle ve 1 gün erken gelir, ücret giderlere eklenir', () => {
  const order = (contract: boolean) => {
    const eng = withShop('MANAV');
    const shop = eng.getState().tradeState!.shops[0];
    if (contract) assert.equal(eng.setCargoContract(shop.shopId, true).success, true);
    const plan = planShopRestock(eng.getState(), shop.shopId, 1_000_000);
    const o = plan.orders[0];
    const r = eng.placeProcurementOrder({
      supplierId: o.supplierId,
      resourceId: o.resourceId,
      quantity: o.quantity,
      destinationType: 'SHOP',
      destinationId: shop.shopId,
      paymentTermType: 'CASH',
    });
    assert.equal(r.success, true, r.message);
    const po = eng.getState().tradeState!.procurementOrders[0];
    return { eng, po, day: eng.getState().day };
  };
  const a = order(false);
  const b = order(true);
  assert.ok(Math.abs(b.po.shippingCost - a.po.shippingCost * (1 - CARGO_SHIPPING_CUT)) <= 0.05 * a.po.orderedQuantity);
  const da = a.po.estimatedArrivalDay - a.day;
  const db = b.po.estimatedArrivalDay - b.day;
  assert.equal(db, Math.max(1, da - 1));
  b.eng.advanceDaysWithoutPlayerDecisions(1, true);
  const sh = b.eng.getState().tradeState!.shops[0];
  assert.ok(sh.todayRentAndOpex >= cargoDailyFee(sh), 'ücret işletme giderinde');
  assert.equal(b.eng.setCargoContract(sh.shopId, false).success, true);
  assert.equal(activeCargoFee(sh), 0);
});
