/**
 * Tempo ve ilk 30 dakika (plan Bölüm 1): ilk dükkân kapısı, ilk çalışan, işletme sermayesi uyarısı, sessiz ilk günler.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { firstShopGateStatus } from '../../engine/FirstShopGate';
import { CAREER_GOALS, migrateCareerGoalsForLegacySave } from '../../engine/CareerGoals';
import { getOpeningAdvice, recommendedWorkingCapital } from '../../engine/ShopOnboarding';
import { restockShops } from '../balance/restockBot';
import {
  FIRST_EMPLOYEE_HIRE_FEE_BUFE,
  FIRST_SHOP_MIN_NET_WORTH,
  ONBOARDING_QUIET_DAYS,
  OWNER_STAFF_CAPACITY,
  RECOMMENDED_WORKING_CAPITAL_BUFE,
} from '../../data/gameBalance';

/** Üç borsa adımını yapar, bir oyun günü bekler; ilk dükkân kapısı açılır. */
function passGate(eng: SimulationEngine): void {
  const stocks = eng.getState().stocks;
  const a = stocks[0];
  const b = stocks.find((s) => s.sector !== a.sector)!;
  assert.equal(eng.buyStock(a.ticker, 10).success, true);
  assert.equal(eng.buyStock(b.ticker, 10).success, true);
  assert.equal(eng.sellStock(a.ticker, 5).success, true);
  eng.advanceDaysWithoutPlayerDecisions(1, true);
}

function openFirstBufe(seed = 20261104): { eng: SimulationEngine; shopId: string } {
  const eng = new SimulationEngine(seed, 100_000);
  passGate(eng);
  const r = eng.openShop({ shopType: 'BUFE' });
  assert.equal(r.success, true, r.message);
  return { eng, shopId: r.shop!.shopId };
}

test('Kapı: dört adım var, alıp aynı dakikada çıkmak yetmez, bir gün geçince açılır', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const stocks = eng.getState().stocks;
  const a = stocks[0];
  const b = stocks.find((s) => s.sector !== a.sector)!;
  eng.buyStock(a.ticker, 10);
  eng.buyStock(b.ticker, 10);
  eng.sellStock(a.ticker, 5);
  let gate = firstShopGateStatus(eng.getState());
  assert.equal(gate.steps.length, 4);
  assert.deepEqual(
    gate.steps.map((s) => [s.id, s.done]),
    [['buy', true], ['two-sectors', true], ['sell', true], ['market-day', false]]
  );
  assert.equal(gate.open, false);
  eng.advanceDaysWithoutPlayerDecisions(1, true);
  gate = firstShopGateStatus(eng.getState());
  assert.equal(gate.open, true);
  assert.equal(gate.pct, 100);
});

test('Kapı: eski kayıt (dükkânı olan) ve zengin kısayolu bütün adımları tamamlanmış sayar', () => {
  const rich = new SimulationEngine(20261104, FIRST_SHOP_MIN_NET_WORTH + 1);
  const g1 = firstShopGateStatus(rich.getState());
  assert.equal(g1.open, true);
  assert.ok(g1.steps.every((s) => s.done));
  const { eng } = openFirstBufe();
  const raw = JSON.parse(eng.serializeState());
  raw.transactions = []; // işlem geçmişi olmayan eski kayıt
  const back = SimulationEngine.deserializeState(JSON.stringify(raw));
  assert.equal(firstShopGateStatus(back.getState()).open, true, 'dükkânı olan oyuncu kapıya takılmaz');
});

test('İlk dükkân BUFE: oyuncu kendisi çalışır (çalışan 0), ücretsiz çalışan gelmez', () => {
  const { eng, shopId } = openFirstBufe();
  const shop = eng.getState().tradeState!.shops.find((s) => s.shopId === shopId)!;
  assert.equal(shop.staffCount, 0);
  assert.equal(shop.ownerWorks, true);
  assert.equal(shop.staffDailyWagePerPerson, 380, 'günlük ücret mevcut değerden sürer');
  // Elle çalışan ayarlamak ücretsiz çalışan almak olurdu: reddedilir
  const free = eng.configureShopParameters({ shopId, staffDelta: 1 });
  assert.equal(free.success, false);
  assert.equal(eng.getState().tradeState!.shops[0].staffCount, 0);
});

test('Sahip çalışırken satış, çalışanlı dükkânın yaklaşık %65\'i kadardır', () => {
  const run = (hire: boolean) => {
    const { eng, shopId } = openFirstBufe();
    if (hire) assert.equal(eng.hireFirstEmployee(shopId).success, true);
    let revenue = 0;
    for (let d = 0; d < 12; d++) {
      restockShops(eng);
      eng.advanceDaysWithoutPlayerDecisions(1, true);
      revenue += eng.getState().tradeState!.shops[0].todaySalesRevenue;
    }
    return revenue;
  };
  const owner = run(false);
  const staffed = run(true);
  assert.ok(owner > 0);
  const ratio = owner / staffed;
  assert.ok(ratio > OWNER_STAFF_CAPACITY - 0.15 && ratio < OWNER_STAFF_CAPACITY + 0.15, `oran ${ratio.toFixed(2)}`);
});

test('"İlk çalışanını işe al": bedel 2.000 ₺ düşer, çalışan 1 olur, ikinci kez alınamaz', () => {
  const { eng, shopId } = openFirstBufe();
  const before = eng.getState().cash;
  const r = eng.hireFirstEmployee(shopId);
  assert.equal(r.success, true, r.message);
  const shop = eng.getState().tradeState!.shops[0];
  assert.equal(shop.staffCount, 1);
  assert.equal(shop.ownerWorks, false);
  assert.equal(FIRST_EMPLOYEE_HIRE_FEE_BUFE, 2_000);
  assert.equal(Number((before - eng.getState().cash).toFixed(2)), FIRST_EMPLOYEE_HIRE_FEE_BUFE);
  const again = eng.hireFirstEmployee(shopId);
  assert.equal(again.success, false);
  assert.equal(Number((before - eng.getState().cash).toFixed(2)), FIRST_EMPLOYEE_HIRE_FEE_BUFE, 'ikinci kez ücret alınmaz');
  // Artık normal çalışan ayarı çalışır
  assert.equal(eng.configureShopParameters({ shopId, staffDelta: 1 }).success, true);
  assert.equal(eng.getState().tradeState!.shops[0].staffCount, 2);
});

test('Parası yetmeyen oyuncu ilk çalışanı alamaz ve para değişmez', () => {
  const { eng, shopId } = openFirstBufe();
  eng.getState().cash = 500;
  const r = eng.hireFirstEmployee(shopId);
  assert.equal(r.success, false);
  assert.equal(eng.getState().cash, 500);
  assert.equal(eng.getState().tradeState!.shops[0].ownerWorks, true);
});

test('Diğer dükkânların açılışı değişmedi: 2. dükkân ve BUFE dışı ilk dükkân çalışanla açılır', () => {
  const { eng } = openFirstBufe();
  eng.getState().cash += 200_000;
  const second = eng.openShop({ shopType: 'MANAV' });
  assert.equal(second.success, true, second.message);
  assert.equal(second.shop!.ownerWorks, undefined);
  assert.equal(second.shop!.staffCount, second.shop!.minStaffRequired);
  const manavFirst = new SimulationEngine(20261104, 100_000);
  passGate(manavFirst);
  const m = manavFirst.openShop({ shopType: 'MANAV' });
  assert.equal(m.success, true, m.message);
  assert.equal(m.shop!.staffCount, m.shop!.minStaffRequired, 'plan yalnızca ilk BUFE için sahip çalışır kuralı ister');
});

test('Dükkân seviyesi yükselince normal personel gerekir ve "sahip çalışıyor" hâli biter', () => {
  const { eng, shopId } = openFirstBufe();
  eng.getState().cash += 100_000;
  assert.equal(eng.upgradeShopLevel(shopId).success, true);
  const shop = eng.getState().tradeState!.shops[0];
  assert.ok(shop.staffCount >= shop.minStaffRequired);
  assert.notEqual(shop.ownerWorks, true);
});

test('Kayıt: sahip çalışıyor bilgisi kaydedilip yüklenince korunur; alanı olmayan eski kayıt çalışanlı sayılır', () => {
  const { eng } = openFirstBufe();
  const back = SimulationEngine.deserializeState(eng.serializeState());
  assert.equal(back.getState().tradeState!.shops[0].ownerWorks, true);
  assert.equal(back.getState().tradeState!.shops[0].staffCount, 0);
  const raw = JSON.parse(eng.serializeState());
  delete raw.tradeState.shops[0].ownerWorks;
  raw.tradeState.shops[0].staffCount = 1;
  const old = SimulationEngine.deserializeState(JSON.stringify(raw));
  assert.equal(old.hireFirstEmployee(old.getState().tradeState!.shops[0].shopId).success, false);
  assert.equal(old.getState().tradeState!.shops[0].staffCount, 1);
});

test('İşletme sermayesi uyarısı: BUFE için önerilen 15.000 ₺, açılıştan sonra elde kalan ve kaç gün yeter', () => {
  assert.equal(RECOMMENDED_WORKING_CAPITAL_BUFE, 15_000);
  assert.equal(recommendedWorkingCapital('BUFE'), 15_000);
  const eng = new SimulationEngine(20261104, 100_000);
  passGate(eng);
  const roomy = eng.getShopOpeningAdvice('BUFE');
  assert.equal(roomy.recommendedWorkingCapital, 15_000);
  assert.equal(roomy.setupCost, 35_000);
  assert.equal(roomy.belowRecommended, false);
  assert.equal(roomy.ownerWorks, true);
  assert.ok(roomy.runwayDays >= 1);
  // Cepte ve kasada az para kalacaksa uyarı çıkar
  eng.getState().cash = 40_000;
  const tight = getOpeningAdvice(eng.getState(), 'BUFE', 2_000, 0);
  assert.equal(tight.belowRecommended, true);
  assert.equal(tight.liquidAfterOpening, 40_000 - 35_000); // kasaya konan 2.000 + cepte kalan 3.000
  assert.ok(tight.runwayDays < roomy.runwayDays);
});

test('İşletme sermayesi uyarısı engel değildir: motor düşük sermayeyle de dükkânı açar', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  passGate(eng);
  eng.getState().cash = 40_000;
  assert.equal(eng.getShopOpeningAdvice('BUFE', 2_000).belowRecommended, true);
  const r = eng.openShop({ shopType: 'BUFE', initialCashFloat: 2_000 });
  assert.equal(r.success, true, r.message);
});

test('Kariyer hedefi: "ilk çalışanını işe al" küçük yükseltmeden sonra gelir, çalışan alınınca tamamlanır', () => {
  const ids = CAREER_GOALS.map((g) => g.id);
  assert.equal(ids.indexOf('goal-first-employee'), ids.indexOf('goal-first-upgrade') + 1);
  const goal = CAREER_GOALS.find((g) => g.id === 'goal-first-employee')!;
  assert.ok(goal.reward > 0);
  const { eng, shopId } = openFirstBufe();
  assert.equal(goal.progress(eng.getState(), {}).done, false);
  eng.hireFirstEmployee(shopId);
  assert.equal(goal.progress(eng.getState(), {}).done, true);
});

test('Eski kayıt göçü: zincirde sonraki hedef alınmışsa yeni "ilk çalışan" hedefi ödülsüz alınmış sayılır', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const st = eng.getState();
  const upto = CAREER_GOALS.map((g) => g.id).filter((id) => id !== 'goal-first-employee');
  st.careerGoals = { claimed: upto.slice(0, upto.indexOf('goal-shop-profit-10k') + 1), totalRewards: 0 };
  migrateCareerGoalsForLegacySave(st, { hasOpenedBorsa: true });
  assert.ok(st.careerGoals.claimed.includes('goal-first-employee'));
  assert.equal(st.careerGoals.totalRewards, 0);
});

test('Sessiz ilk günler: ilk ONBOARDING_QUIET_DAYS oyun gününde karar kartı çıkmaz (20 tohum)', () => {
  assert.equal(ONBOARDING_QUIET_DAYS, 5);
  for (let seed = 100; seed < 120; seed++) {
    const eng = new SimulationEngine(seed, 100_000);
    for (let d = 1; d <= ONBOARDING_QUIET_DAYS - 1; d++) {
      eng.advanceDaysWithoutPlayerDecisions(1, true);
      const ds = eng.getState().decisionEvents;
      assert.equal(ds?.pending ?? null, null, `seed ${seed}, gün ${eng.getState().day}`);
      assert.equal(ds?.history.length ?? 0, 0);
    }
  }
});

// ---- Arayüz (sunucuda çizilen kart) ----
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EsnafAndTradePanel } from '../../components/game/EsnafAndTradePanel';
import { FirstShopGateCard } from '../../components/game/ui/FirstShopGateCard';

const noop = () => {};
function renderPanel(eng: SimulationEngine, extra: Record<string, unknown>): string {
  return renderToStaticMarkup(
    React.createElement(EsnafAndTradePanel, {
      state: eng.getState(),
      spendableCash: eng.getSpendableCash(),
      formatCurrency: (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`,
      onOpenShop: noop,
      onUpgradeShopLevel: noop,
      onTransferShopCash: noop,
      onConfigureShop: noop,
      onPlaceProcurementOrder: noop,
      onCancelProcurementOrder: noop,
      onCreatePurchaseContract: noop,
      onExecuteRecipeProduction: noop,
      onPurchaseLogisticsVehicle: noop,
      onDispatchWarehouseToShop: noop,
      onAcceptCommercialContract: noop,
      onDeliverCommercialContract: noop,
      onIncorporateShopsIntoCompany: noop,
      onHireFirstEmployee: noop,
      ...extra,
    } as never)
  );
}

test('Arayüz: dükkân açılış ekranı önerilen sermayeyi, elde kalan parayı ve kaç gün yeteceğini gösterir', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  passGate(eng);
  const html = renderPanel(eng, {});
  assert.ok(html.includes('data-testid="shop-opening-advice"'));
  assert.ok(html.includes('Önerilen işletme sermayesi'));
  assert.ok(html.includes('₺15.000'));
  assert.ok(html.includes('data-testid="shop-opening-runway"'));
  assert.ok(html.includes('data-testid="shop-opening-owner-note"'), 'ilk BUFE için "sen çalışırsın" notu');
  assert.ok(!html.includes('data-testid="shop-opening-low-cash-warning"'), 'uyarı ancak ilk basıştan sonra çıkar');
});

test('Arayüz: çalışanlar ekranında "İlk çalışanını işe al" kartı yalnızca sahip çalışırken görünür', () => {
  const { eng, shopId } = openFirstBufe();
  const before = renderPanel(eng, { initialActionTab: 'MANAGE_STAFF' });
  assert.ok(before.includes('data-testid="shop-first-hire-card"'));
  assert.ok(before.includes('data-testid="shop-first-hire-btn"'));
  assert.ok(before.includes('dükkânı sen yürütüyorsun'));
  eng.hireFirstEmployee(shopId);
  const after = renderPanel(eng, { initialActionTab: 'MANAGE_STAFF' });
  assert.ok(!after.includes('data-testid="shop-first-hire-card"'));
  assert.ok(after.includes('data-testid="shop-hire-1-btn"'));
});

test('Arayüz: ilk dükkân kapısı kartı dört adımı ve "Piyasayı bir gün izle" satırını gösterir', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const html = renderToStaticMarkup(React.createElement(FirstShopGateCard, { state: eng.getState() }));
  assert.ok(html.includes('İlk dükkânın için 4 adım'));
  assert.ok(html.includes('data-testid="first-shop-gate-step-market-day"'));
  assert.ok(html.includes('Piyasayı bir gün izle'));
});
