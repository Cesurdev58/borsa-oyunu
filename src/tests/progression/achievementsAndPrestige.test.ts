import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { ACHIEVEMENTS, getAchievements, pickWeeklyGoals, stepAchievementsDayClose, weekOf } from '../../engine/Achievements';
import { addPrestigePoints, buyPerk, bonusesFor, firstShopCostMultiplier, pointsAvailable, prestigeBonuses, startNewCity } from '../../engine/PrestigeEngine';
import { SHOP_TEMPLATES } from '../../engine/TradeAndShopEngine';
import { PRESTIGE_MIN_NET_WORTH } from '../../data/gameBalance';

const make = (seed: number, cash: number) => new SimulationEngine(seed, cash);

test('Prestij ödülleri: 1 yıldız = 150 bin başlangıç, +%8 müşteri, +%5 gelir, %20 ilk dükkân indirimi', () => {
  const b = prestigeBonuses(1);
  assert.equal(b.startCash, 150_000);
  assert.ok(Math.abs(b.customerMult - 1.08) < 1e-9);
  assert.ok(Math.abs(b.shopRevenueMult - 1.05) < 1e-9);
  assert.ok(Math.abs(b.firstShopCostMult - 0.8) < 1e-9);
  assert.equal(prestigeBonuses(0).firstShopCostMult, 1);
  assert.ok(PRESTIGE_MIN_NET_WORTH >= 10_000_000 && PRESTIGE_MIN_NET_WORTH <= 15_000_000);
});

test('Prestij: yeni şehirde ilk dükkân %20 ucuz, ikincisi tam fiyat; puanla avantaj alınır', () => {
  const old = new SimulationEngine(20261104, 60_000_000);
  const r = startNewCity(old.getState(), make);
  const eng = r.engine!;
  const st = eng.getState();
  assert.equal(pointsAvailable(st.prestige!), 2);
  assert.ok(Math.abs(firstShopCostMultiplier(st) - 0.8) < 1e-9);
  assert.equal(buyPerk(st, 'cash').success, true);
  assert.equal(pointsAvailable(st.prestige!), 1);
  assert.equal(buyPerk(st, 'decor').success, false, 'puan yetmez (2 puan ister)');
  assert.equal(bonusesFor(st).startCash, 100_000 + 2 * 50_000 + 25_000);
  addPrestigePoints(st, 3);
  assert.equal(pointsAvailable(st.prestige!), 4);
  const back = SimulationEngine.deserializeState(eng.serializeState());
  assert.equal(back.getState().prestige?.perks?.cash, 1);
  assert.ok(SHOP_TEMPLATES.BUFE.openingCost > 0);
});

test('Başarımlar: 18 tane, ödüller para değil; kayıtta kalır', () => {
  assert.equal(ACHIEVEMENTS.length, 18);
  for (const d of ACHIEVEMENTS) assert.ok(['TICKET', 'DECOR', 'POINT'].includes(d.reward.kind));
  const eng = new SimulationEngine(31, 40_000_000);
  const st = eng.getState();
  st.netWorth = 20_000_000;
  const msgs = stepAchievementsDayClose(st);
  assert.ok(msgs.some((m) => m.includes('İlk milyon')));
  assert.ok(msgs.some((m) => m.includes('On milyonluk')));
  assert.equal(getAchievements(st).unlocked['nw-1m'] !== undefined, true);
  // ikinci kez aynı ödül verilmez
  const before = (st.decorations ?? 0) + (st.prestige?.pointsEarned ?? 0);
  stepAchievementsDayClose(st);
  assert.equal((st.decorations ?? 0) + (st.prestige?.pointsEarned ?? 0), before);
  const back = SimulationEngine.deserializeState(eng.serializeState());
  assert.equal(back.getState().achievements?.unlocked['nw-1m'], getAchievements(st).unlocked['nw-1m']);
});

test('Başarım: 30 gün zarar etmeden ve 3 dükkân', () => {
  const eng = new SimulationEngine(32, 5_000_000);
  const st = eng.getState();
  for (const t of ['BUFE', 'MANAV', 'KAFE'] as const) eng.openShop({ shopType: t });
  assert.equal(st.tradeState!.shops.length, 3);
  for (const sh of st.tradeState!.shops) sh.todayNetProfit = 100;
  for (let i = 0; i < 30; i++) {
    st.day += 1;
    stepAchievementsDayClose(st);
  }
  const a = getAchievements(st);
  assert.ok(a.unlocked['streak-30'] !== undefined);
  assert.ok(a.unlocked['three-shops'] !== undefined);
});

test('Haftalık hedefler: 3 hedef, aynı tohum+hafta aynı sonuç, hafta dönünce yenilenir, ödül para değil', () => {
  const eng = new SimulationEngine(33, 1_000_000);
  const st = eng.getState();
  const a = pickWeeklyGoals(st, 0);
  const b = pickWeeklyGoals(st, 0);
  assert.equal(a.length, 3);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((g) => g.id)).size, 3);
  stepAchievementsDayClose(st);
  assert.equal(getAchievements(st).weekly?.week, weekOf(st.day));
  const week1 = getAchievements(st).weekly!.goals.map((g) => g.id).join();
  st.day += 7;
  stepAchievementsDayClose(st);
  assert.equal(getAchievements(st).weekly?.week, weekOf(st.day));
  assert.ok(['TICKET', 'DECOR', 'POINT'].includes(getAchievements(st).weekly!.goals[0].reward.kind));
  assert.ok(week1.length > 0);
});

test('Eğitim bileti: Akademi eğitimi bedava olur ve bilet azalır', () => {
  const eng = new SimulationEngine(34, 3_000_000);
  eng.openShop({ shopType: 'MANAV' });
  const st = eng.getState();
  st.trainingTickets = 1;
  const shop = st.tradeState!.shops[0];
  shop.trainedStaff = 0;
  const cashBefore = st.cash;
  const res = eng.trainShopStaff(shop.shopId);
  assert.equal(res.success, true, res.message);
  assert.equal(st.trainingTickets, 0);
  assert.equal(st.cash, cashBefore);
});
