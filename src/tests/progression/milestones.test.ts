/** Orta oyun kilometre taşları: sayaçlar, ödüller (müşteri bonusu, eğitim, indirim), eski kayıt göçü. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import {
  CAREER_GOALS,
  buildCareerGoals,
  claimCareerGoal,
  migrateCareerGoalsForLegacySave,
} from '../../engine/CareerGoals';
import { defaultMilestones, milestoneCustomerMultiplier, sanitizeMilestones, trackMilestonesDayClose } from '../../engine/Milestones';
import { trainShopStaff } from '../../engine/CityServices';
import { SimulationStore } from '../../state/simulationStore';

const goal = (id: string) => CAREER_GOALS.find((g) => g.id === id)!;
function richEngine() {
  const eng = new SimulationEngine(20261120, 2_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  return eng;
}
function fakeDay(eng: SimulationEngine, day: number, revenue: number, profit: number, customers: number) {
  const st = eng.getState();
  st.day = day;
  const sh = st.tradeState!.shops[0];
  sh.todaySalesRevenue = revenue;
  sh.todayNetProfit = profit;
  sh.todayServedCustomers = customers;
  trackMilestonesDayClose(st);
}
/** Hedefi sıraya getirir: önceki hedefleri ödülsüz alınmış sayar */
function reachGoal(eng: SimulationEngine, id: string) {
  const st = eng.getState();
  const idx = CAREER_GOALS.findIndex((g) => g.id === id);
  st.careerGoals = { claimed: CAREER_GOALS.slice(0, idx).map((g) => g.id), totalRewards: 0 };
}

test('Ara hedefler eski hedeflerin sırasını bozmadan, ikinci dükkândan önce araya girer', () => {
  const ids = CAREER_GOALS.map((g) => g.id);
  const pos = (id: string) => ids.indexOf(id);
  assert.equal(ids.length, 37);
  const order = [
    'goal-shop-profit-10k',
    'goal-ms-profit-7days',
    'goal-ms-daily-5k',
    'goal-ms-customers-100',
    'goal-ms-active-30',
    'goal-ms-second-shop-prep',
    'goal-second-shop',
  ];
  for (let i = 1; i < order.length; i++) assert.ok(pos(order[i - 1]) < pos(order[i]), `${order[i - 1]} < ${order[i]}`);
  // Eski hedeflerin kendi aralarındaki sırası değişmedi (kariyer hızı ölçümü buna bağlı)
  const old = ids.filter((id) => !id.startsWith('goal-ms-'));
  assert.deepEqual(
    old.slice(old.indexOf('goal-shop-profit-10k'), old.indexOf('goal-six-upgrades') + 1),
    ['goal-shop-profit-10k', 'goal-second-shop', 'goal-shop-profit-50k', 'goal-shop-level-2', 'goal-first-manager', 'quest-07-networth-250k', 'goal-six-upgrades']
  );
  assert.equal(new Set(ids).size, ids.length, 'kimlikler tekil');
});

test('Sayaçlar: kârlı gün serisi zarar gününde sıfırlanır, ciro/müşteri birikir, aynı gün iki kez sayılmaz', () => {
  const eng = richEngine();
  const m = () => eng.getState().milestones!;
  for (let d = 2; d <= 8; d++) fakeDay(eng, d, 3000, 500, 20);
  assert.equal(m().profitStreak, 7);
  assert.equal(m().totalCustomers, 140);
  fakeDay(eng, 8, 3000, 500, 20); // aynı gün tekrar
  assert.equal(m().profitStreak, 7);
  fakeDay(eng, 9, 6000, -100, 20);
  assert.equal(m().profitStreak, 0);
  assert.equal(m().bestProfitStreak, 7);
  assert.equal(m().bestDailyRevenue, 6000);
  assert.equal(m().activeStreak, 8);
  fakeDay(eng, 10, 0, 0, 0);
  assert.equal(m().activeStreak, 0, 'satış yapılmayan gün faaliyet serisini sıfırlar');
});

test('7 kârlı gün: 7.500 ₺ + 7 gün geçici müşteri bonusu', () => {
  const eng = richEngine();
  for (let d = 2; d <= 8; d++) fakeDay(eng, d, 3000, 500, 20);
  const st = eng.getState();
  reachGoal(eng, 'goal-ms-profit-7days');
  const before = st.cash;
  const r = claimCareerGoal(st, 'goal-ms-profit-7days', { hasOpenedBorsa: true }, 0);
  assert.equal(r.success, true);
  assert.equal(st.cash - before, 7_500);
  const boost = st.tradeState!.shops[0].demandBoost!;
  assert.ok(boost.multiplier > 1 && boost.untilDay >= st.day + 6);
});

test('Günlük 5.000 ₺ ciro hedefi 10.000 ₺ verir; 4.999 ₺ yetmez', () => {
  const eng = richEngine();
  fakeDay(eng, 2, 4_999, 100, 10);
  reachGoal(eng, 'goal-ms-daily-5k');
  assert.equal(buildCareerGoals(eng.getState(), { hasOpenedBorsa: true }).active!.progress.done, false);
  fakeDay(eng, 3, 5_000, 100, 10);
  const st = eng.getState();
  const before = st.cash;
  assert.equal(claimCareerGoal(st, 'goal-ms-daily-5k', { hasOpenedBorsa: true }, 0).success, true);
  assert.equal(st.cash - before, 10_000);
});

test('100 müşteri: nakit yok, kalıcı +%2 müşteri çarpanı', () => {
  const eng = richEngine();
  for (let d = 2; d <= 6; d++) fakeDay(eng, d, 1000, 100, 20);
  const st = eng.getState();
  reachGoal(eng, 'goal-ms-customers-100');
  const before = st.cash;
  assert.equal(milestoneCustomerMultiplier(st), 1);
  assert.equal(claimCareerGoal(st, 'goal-ms-customers-100', { hasOpenedBorsa: true }, 0).success, true);
  assert.equal(st.cash, before);
  assert.ok(Math.abs(milestoneCustomerMultiplier(st) - 1.02) < 1e-9);
});

test('İlk müdür: 1 ücretsiz eğitim; Akademi bir kez ücretsiz çalışır, ikincisi ücretlidir', () => {
  const eng = richEngine();
  const st = eng.getState();
  const shop = st.tradeState!.shops[0];
  shop.staffCount = 3;
  shop.trainedStaff = 0;
  shop.ownerWorks = false;
  reachGoal(eng, 'goal-first-manager');
  shop.manager = { hiredDay: st.day } as never;
  const cash0 = st.cash;
  assert.equal(claimCareerGoal(st, 'goal-first-manager', { hasOpenedBorsa: true }, 0).success, true);
  assert.equal(st.cash, cash0, 'para ödülü yok');
  assert.equal(st.milestones!.freeTrainings, 1);
  const free = trainShopStaff(st, shop.shopId, 0);
  assert.equal(free.success, true);
  assert.equal(free.cost, 0);
  assert.equal(st.milestones!.freeTrainings, 0);
  shop.staffCount = 5; // yeni eğitimsiz çalışanlar
  const paid = trainShopStaff(st, shop.shopId, 0);
  assert.equal(paid.success, true);
  assert.ok(paid.cost > 0, 'hak bitince eğitim ücretli');
});

test('250 bin ₺: 15.000 ₺ + vitrin rafı (kalıcı küçük müşteri artışı), ikinci kez verilmez', () => {
  const eng = richEngine();
  const st = eng.getState();
  reachGoal(eng, 'quest-07-networth-250k');
  st.netWorth = 300_000;
  const before = st.cash;
  assert.equal(claimCareerGoal(st, 'quest-07-networth-250k', { hasOpenedBorsa: true }, 0).success, true);
  assert.equal(st.cash - before, 15_000);
  assert.deepEqual(st.milestones!.decorations, ['vitrin-rafi']);
  assert.ok(milestoneCustomerMultiplier(st) > 1);
});

test('30 gün üst üste faaliyet: 20.000 ₺ işletme sermayesi', () => {
  const eng = richEngine();
  for (let d = 2; d <= 31; d++) fakeDay(eng, d, 500, 50, 5);
  const st = eng.getState();
  assert.equal(st.milestones!.activeStreak, 30);
  reachGoal(eng, 'goal-ms-active-30');
  const before = st.cash;
  assert.equal(claimCareerGoal(st, 'goal-ms-active-30', { hasOpenedBorsa: true }, 0).success, true);
  assert.equal(st.cash - before, 20_000);
});

test('İkinci dükkân hazırlığı: yeterli serbest nakitle biter, sonraki açılış %10 ucuz ve indirim bir kez kullanılır', () => {
  const eng = new SimulationEngine(20261120, 2_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const st = eng.getState();
  reachGoal(eng, 'goal-ms-second-shop-prep');
  assert.equal(buildCareerGoals(st, { hasOpenedBorsa: true }).active!.progress.done, true);
  assert.equal(claimCareerGoal(st, 'goal-ms-second-shop-prep', { hasOpenedBorsa: true }, 0).success, true);
  assert.equal(st.milestones!.shopOpenDiscountPct, 10);

  const cashBefore = st.cash;
  const r = eng.openShop({ shopType: 'MANAV', initialCashFloat: 0 });
  assert.equal(r.success, true);
  const full = 35_000 + 12_000; // MANAV kurulum + dekorasyon (tradeCatalog)
  const spent = cashBefore - st.cash;
  assert.ok(Math.abs(spent - full * 0.9) < 1, `indirimli ödendi: ${spent}`);
  assert.equal(st.milestones!.shopOpenDiscountPct, 0);

  const c2 = st.cash;
  assert.equal(eng.openShop({ shopType: 'MANAV', initialCashFloat: 0 }).success, true);
  assert.ok(Math.abs(c2 - st.cash - full) < 1, 'ikinci açılışta indirim yok');
});

test('Sermaye hazırlığı hedefi dükkân yokken (paran çok olsa da) tamamlanmış sayılmaz', () => {
  const eng = new SimulationEngine(20261120, 5_000_000);
  reachGoal(eng, 'goal-ms-second-shop-prep');
  const a = buildCareerGoals(eng.getState(), { hasOpenedBorsa: true }).active!;
  assert.equal(a.def.id, 'goal-ms-second-shop-prep');
  assert.equal(a.progress.done, false);
});

test('Eski kayıt göçü: sonradan eklenen hedefler ödül/bonus vermeden alınmış sayılır; milestones eksik alan sıfırlanır', () => {
  const eng = richEngine();
  const st = eng.getState();
  // Eski zincir: yeni hedefler olmadan, "goal-networth-500k" kadar ilerlemiş oyuncu
  const legacy = CAREER_GOALS.filter((g) => !g.id.startsWith('goal-ms-')).map((g) => g.id);
  st.careerGoals = { claimed: legacy.slice(0, legacy.indexOf('goal-networth-500k') + 1), totalRewards: 123 };
  delete (st as { milestones?: unknown }).milestones;
  migrateCareerGoalsForLegacySave(st, { hasOpenedBorsa: true });
  for (const id of ['goal-ms-profit-7days', 'goal-ms-second-shop-prep', 'goal-ms-daily-5k', 'goal-ms-customers-100', 'goal-ms-active-30']) {
    assert.ok(st.careerGoals.claimed.includes(id), id);
  }
  assert.equal(st.careerGoals.totalRewards, 123, 'ödül toplamı değişmez');
  // Eskiden var olan hedefin sırası değişse de ödülü kaybolmaz: alınmamışsa alınmamış kalır
  const eng2 = richEngine();
  const st2 = eng2.getState();
  st2.careerGoals = { claimed: ['quest-01-open-borsa', 'goal-second-shop'], totalRewards: 0 };
  migrateCareerGoalsForLegacySave(st2, { hasOpenedBorsa: true });
  assert.ok(!st2.careerGoals.claimed.includes('quest-02-first-order'), 'eski hedef ödülsüz geçilmez');
  assert.ok(st2.careerGoals.claimed.includes('goal-ms-daily-5k'), 'yeni hedef geçilir');
  assert.deepEqual(sanitizeMilestones(undefined), defaultMilestones());
  assert.equal(sanitizeMilestones({ profitStreak: -5, customerBonusPct: 'x' }).profitStreak, 0);
});

test('Kayıt yükleme gidiş-dönüşü milestones alanını korur', () => {
  const eng = richEngine();
  fakeDay(eng, 2, 4000, 400, 12);
  eng.getState().milestones!.customerBonusPct = 2;
  const env = JSON.parse(JSON.stringify({ schemaVersion: SimulationStore.CURRENT_SCHEMA_VERSION, savedAtISO: new Date().toISOString(), seed: eng.getState().seed, randomState: eng.getRandomState(), state: eng.getState() }));
  const migrated = SimulationStore.migrateIfNeeded(env)!;
  const eng2 = new SimulationEngine(migrated.seed, 100_000);
  eng2.restoreFromSavedState(migrated.state);
  assert.equal(eng2.getState().milestones!.totalCustomers, 12);
  assert.equal(eng2.getState().milestones!.customerBonusPct, 2);
});
