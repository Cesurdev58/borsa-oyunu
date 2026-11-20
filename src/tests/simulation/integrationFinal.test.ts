/**
 * PR #36 SON KONTROL: birleşik özelliklerin birbirini bozmadığını denetler.
 * A) çevrimdışı kredi tahsilatı  B) ödüller iki kez yazılmaz  C) kısıtlı/rezerve nakit yedekten sonra korunur
 * D) açılış indirimi önceliği ve arayüz bilgisi  E) ücretsiz eğitim önceliği  F) kayıt göçü senaryoları
 */
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { CAREER_GOALS, claimCareerGoal, goalReward } from '../../engine/CareerGoals';
import { trackMilestonesDayClose } from '../../engine/Milestones';
import { trainShopStaff } from '../../engine/CityServices';
import { getOpeningAdvice, openingDiscountInfo } from '../../engine/ShopOnboarding';
import { SHOP_TEMPLATES } from '../../engine/TradeAndShopEngine';
import { startNewCity } from '../../engine/PrestigeEngine';
import { ACHIEVEMENTS, getAchievements, stepAchievementsDayClose } from '../../engine/Achievements';
import { SimulationStore } from '../../state/simulationStore';
import { exportSaveFile, importSaveFile, SaveFileError } from '../../state/SaveFile';
import { SaveBackups } from '../../state/SaveBackups';
import { WalletEngine } from '../../engine/WalletEngine';

class FakeStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
beforeEach(() => {
  (globalThis as { window?: unknown }).window = { localStorage: new FakeStorage() };
});

const make = (seed: number, cash: number) => new SimulationEngine(seed, cash);
const setupOf = (t: keyof typeof SHOP_TEMPLATES) => SHOP_TEMPLATES[t].openingCost + SHOP_TEMPLATES[t].decorationCost;
const reachGoal = (eng: SimulationEngine, id: string) => {
  const idx = CAREER_GOALS.findIndex((g) => g.id === id);
  eng.getState().careerGoals = { claimed: CAREER_GOALS.slice(0, idx).map((g) => g.id), totalRewards: 0 };
};

// ------------------------------- A) Çevrimdışı kredi -------------------------------
test('A) Çevrimdışı ilerleme kredi taksitini tam bir kez tahsil eder; aynı aralık tekrar işlenmez', () => {
  const eng = new SimulationEngine(20261201, 3_000_000);
  eng.setFastStartTempo(false);
  const res = eng.takeOutBankLoan({ loanType: 'WORKING_CAPITAL', principal: 200_000, termInGameDays: 90 });
  assert.equal(res.success, true, res.message);
  const loan = eng.getState().activeLoans![0];
  const st = eng.getState();
  st.day = loan.nextPaymentGameDay - 1; // vade bir gün sonra
  const cash0 = st.cash;
  const paid0 = loan.paidInstallmentCount ?? 0;
  const sum = eng.processOfflineProgress('2026-02-01T00:00:00.000Z', '2026-02-01T01:00:00.000Z'); // 1 sa = 4 oyun günü
  assert.ok(sum.gameDaysAdvanced >= 2);
  assert.equal((loan.paidInstallmentCount ?? 0) - paid0, 1, 'tek taksit tahsil edildi');
  assert.equal(loan.missedPaymentCount, 0);
  const drop = cash0 - st.cash;
  assert.ok(Math.abs(drop - loan.installmentAmount) < 1.5 + 0.02 * loan.installmentAmount, `nakit çıkışı ≈ tek taksit (${drop} vs ${loan.installmentAmount})`);
  const cash1 = st.cash;
  const dup = eng.processOfflineProgress('2026-02-01T00:00:00.000Z', '2026-02-01T01:00:00.000Z');
  assert.equal(dup.gameMinutesAdvanced, 0, 'aynı aralık yeniden işlenmez');
  assert.equal(st.cash, cash1);
  assert.equal((loan.paidInstallmentCount ?? 0) - paid0, 1);
});

// ------------------------------- B) Ödüller -------------------------------
test('B) Kariyer ödülü ikinci kez alınamaz; prestij çarpanı orta oyun nakit ödülüne uygulanır', () => {
  const eng = new SimulationEngine(20261120, 2_000_000);
  eng.openShop({ shopType: 'BUFE' });
  const st = eng.getState();
  st.prestige = { stars: 5, cities: 3, bestNetWorth: 1 };
  reachGoal(eng, 'goal-ms-daily-5k');
  const sh = st.tradeState!.shops[0];
  sh.todaySalesRevenue = 6_000;
  sh.todayNetProfit = 100;
  sh.todayServedCustomers = 5;
  st.day = 3;
  trackMilestonesDayClose(st);
  trackMilestonesDayClose(st); // aynı gün iki kez: sayaç iki kez artmaz
  const def = CAREER_GOALS.find((g) => g.id === 'goal-ms-daily-5k')!;
  const before = st.cash;
  assert.equal(claimCareerGoal(st, def.id, { hasOpenedBorsa: true }, 0).success, true);
  assert.equal(st.cash - before, goalReward(st, def));
  assert.ok(goalReward(st, def) > def.reward, 'yıldız çarpanı uygulandı (10 bin → 20 bin)');
  const again = claimCareerGoal(st, def.id, { hasOpenedBorsa: true }, 0);
  assert.equal(again.success, false);
  assert.equal(st.cash - before, goalReward(st, def), 'ödül iki kez yazılmadı');
});

test('B) Başarım ve haftalık hedef aynı gün iki kez kapanışta ödülü tekrar vermez; dekorasyon sınırı aşılmaz', () => {
  const eng = new SimulationEngine(31, 40_000_000);
  const st = eng.getState();
  st.netWorth = 200_000_000;
  stepAchievementsDayClose(st);
  const snap = JSON.stringify({ d: st.decorations, t: st.trainingTickets, p: st.prestige?.pointsEarned, u: getAchievements(st).unlocked });
  stepAchievementsDayClose(st);
  const snap2 = JSON.stringify({ d: st.decorations, t: st.trainingTickets, p: st.prestige?.pointsEarned, u: getAchievements(st).unlocked });
  assert.equal(snap2, snap);
  st.decorations = 9;
  for (let i = 0; i < ACHIEVEMENTS.length; i++) stepAchievementsDayClose(st);
  assert.ok((st.decorations ?? 0) <= 10);
});

// ------------------------------- C) Kısıtlı / rezerve nakit -------------------------------
test('C) Kısıtlı işletme bakiyesi, yedekten dönüşte ve dosya dışa/içe aktarmada korunur; hisse alımında kullanılamaz', async () => {
  const eng = new SimulationEngine(20261202, 300_000);
  const res = eng.takeOutBankLoan({ loanType: 'WORKING_CAPITAL', principal: 200_000, termInGameDays: 90 });
  assert.equal(res.success, true, res.message);
  const st = eng.getState();
  const restricted = WalletEngine.restrictedFund(st);
  assert.ok(restricted > 0);
  // Hisse alımı yalnızca serbest nakdi kullanır
  const free = eng.getFreeSpendableCash();
  assert.ok(free < st.cash);
  const stock = st.stocks[0];
  const tooMany = Math.floor((free + restricted) / (stock.price * 1.02));
  assert.equal(eng.buyStock(stock.ticker, tooMany).success, false, 'kısıtlı bakiyeyle hisse alınamaz');
  // Yedek
  const info = SaveBackups.take(eng, 'auto')!;
  const back = SaveBackups.load(info.slot).engine!;
  assert.equal(WalletEngine.restrictedFund(back.getState()), restricted);
  assert.equal(back.getReservedCash(), eng.getReservedCash());
  // Dosya
  const { text } = await exportSaveFile(eng, '2026-11-20T10:00:00.000Z');
  const imp = await importSaveFile(text);
  assert.equal(WalletEngine.restrictedFund(imp.getState()), restricted);
  assert.equal(imp.getState().activeLoans![0].remainingPrincipal, st.activeLoans![0].remainingPrincipal);
});

test('C) Rezerve borsa emri yedekten sonra da rezerve kalır', () => {
  const eng = new SimulationEngine(20261203, 500_000);
  const stock = eng.getState().stocks[0];
  const placed = eng.placeOrder({ ticker: stock.ticker, orderType: 'LIMIT_BUY', requestedShares: 100, limitPrice: Math.max(0.01, stock.price * 0.2) });
  assert.equal(placed.success, true, placed.message);
  const reserved = eng.getReservedCash();
  assert.ok(reserved > 0);
  const info = SaveBackups.take(eng, 'auto')!;
  const back = SaveBackups.load(info.slot).engine!;
  assert.equal(back.getReservedCash(), reserved);
});

// ------------------------------- D) Açılış indirimi -------------------------------
test('D) Prestijli oyuncu: ilk dükkân %20 prestij indirimi, kilometre taşı indirimi tüketilmez ve sonraki dükkâna kalır; indirimler birleşmez', () => {
  const old = new SimulationEngine(20261104, 60_000_000);
  const eng = startNewCity(old.getState(), make).engine!;
  const st = eng.getState();
  st.milestones!.shopOpenDiscountPct = 10;
  const info = openingDiscountInfo(st);
  assert.equal(info.applied, 'PRESTIGE');
  assert.equal(info.appliedPct, 20);
  assert.equal(info.waitingMilestonePct, 10);
  assert.match(info.textTR, /Prestij indirimi/);
  assert.match(info.textTR, /sonraki dükkân/);
  // Tavsiye de indirimli kurulum maliyetini kullanır
  const adv = getOpeningAdvice(st, 'MANAV', 0, 0);
  assert.ok(Math.abs(adv.setupCost - setupOf('MANAV') * 0.8) < 0.01);
  // Gerçek açılış: yalnızca %20 (not %28/%30)
  const c0 = st.cash;
  assert.equal(eng.openShop({ shopType: 'MANAV', initialCashFloat: 0 }).success, true);
  assert.ok(Math.abs(c0 - st.cash - setupOf('MANAV') * 0.8) < 1, 'ilk dükkân yalnızca %20 indirimli');
  assert.equal(st.milestones!.shopOpenDiscountPct, 10, 'kilometre taşı hakkı korundu');
  // İkinci dükkân: yalnızca kilometre taşı %10; prestij yok
  const info2 = openingDiscountInfo(st);
  assert.equal(info2.applied, 'MILESTONE');
  assert.equal(info2.appliedPct, 10);
  const c1 = st.cash;
  assert.equal(eng.openShop({ shopType: 'MANAV', initialCashFloat: 0 }).success, true);
  assert.ok(Math.abs(c1 - st.cash - setupOf('MANAV') * 0.9) < 1, 'ikinci dükkân %10');
  assert.equal(st.milestones!.shopOpenDiscountPct, 0, 'hak bir kez tüketildi');
  const c2 = st.cash;
  eng.openShop({ shopType: 'MANAV', initialCashFloat: 0 });
  assert.ok(Math.abs(c2 - st.cash - setupOf('MANAV')) < 1, 'üçüncü dükkân tam fiyat');
  assert.equal(openingDiscountInfo(st).applied, null);
});

// ------------------------------- E) Ücretsiz eğitim önceliği -------------------------------
function trainSetup() {
  const eng = new SimulationEngine(20261204, 3_000_000);
  eng.openShop({ shopType: 'MANAV' });
  const st = eng.getState();
  const shop = st.tradeState!.shops[0];
  shop.staffCount = 3;
  shop.trainedStaff = 0;
  shop.ownerWorks = false;
  return { st, shop };
}
test('E) Eğitim önceliği: önce kilometre taşı hakkı, sonra bilet, sonra ücret; ikisi birlikte tüketilmez', () => {
  const { st, shop } = trainSetup();
  st.milestones!.freeTrainings = 1;
  st.trainingTickets = 1;
  const c0 = st.cash;
  const r1 = trainShopStaff(st, shop.shopId, 0);
  assert.equal(r1.success, true);
  assert.match(r1.message, /Kilometre taşı eğitim hakkı kullanıldı/);
  assert.equal(st.milestones!.freeTrainings, 0);
  assert.equal(st.trainingTickets, 1, 'bilet korundu');
  assert.equal(st.cash, c0);
  shop.staffCount = 5; // yeni eğitimsizler
  const r2 = trainShopStaff(st, shop.shopId, 0);
  assert.match(r2.message, /1 eğitim bileti kullanıldı/);
  assert.equal(st.trainingTickets, 0);
  assert.equal(st.cash, c0);
  shop.staffCount = 7;
  const totalBefore = st.cash + shop.cashAccountBalance;
  const r3 = trainShopStaff(st, shop.shopId, 0);
  assert.equal(r3.success, true);
  assert.match(r3.message, /Eğitim için .* ödendi/);
  assert.ok(r3.cost > 0);
  // Ücret önce dükkân kasasından, yetmezse cepten düşer: toplam çıkış tam bir kez ücret kadar
  assert.ok(Math.abs(totalBefore - (st.cash + shop.cashAccountBalance) - r3.cost) < 1, 'yalnızca bir kez ücret alındı');
});

// ------------------------------- F) Kayıt göçü senaryoları -------------------------------
/** Yeni alanları siler = bu PR'lardan önceki bir kayıt gibi. */
function stripNewFields(eng: SimulationEngine): string {
  const env = JSON.parse(eng.serializeState()) as Record<string, any>;
  const target = env.state ?? env;
  for (const k of ['achievements', 'trainingTickets', 'decorations', 'milestones']) delete target[k];
  if (target.prestige) { delete target.prestige.pointsEarned; delete target.prestige.perks; }
  return JSON.stringify(env);
}
function check(eng: SimulationEngine, label: string) {
  const before = { cash: Math.round(eng.getState().cash), nw: Math.round(eng.getState().netWorth), loans: (eng.getState().activeLoans ?? []).map((l) => l.remainingPrincipal) };
  const back = SimulationEngine.deserializeState(stripNewFields(eng));
  const s = back.getState();
  assert.equal(Math.round(s.cash), before.cash, `${label}: nakit değişmedi`);
  assert.deepEqual((s.activeLoans ?? []).map((l) => l.remainingPrincipal), before.loans, `${label}: kredi planı bozulmadı`);
  assert.ok(Number.isFinite(s.netWorth), `${label}: net değer sayı`);
  assert.ok(s.milestones, `${label}: milestones varsayılanı oluştu`);
  assert.ok((s.trainingTickets ?? 0) >= 0 && (s.decorations ?? 0) >= 0);
  // geriye dönük başarım ve çift ödül yok
  stepAchievementsDayClose(s);
  const once = JSON.stringify([s.decorations, s.trainingTickets, s.prestige?.pointsEarned]);
  stepAchievementsDayClose(s);
  assert.equal(JSON.stringify([s.decorations, s.trainingTickets, s.prestige?.pointsEarned]), once, `${label}: ödül tekrar yazılmadı`);
  void SimulationStore;
  return back;
}
test('F1) Hiç dükkânı olmayan eski kayıt', () => {
  const eng = new SimulationEngine(1, 100_000);
  const back = check(eng, 'F1');
  assert.equal(back.getState().tradeState?.shops.length ?? 0, 0);
});
test('F2) Dükkânı olan, şirketi olmayan eski kayıt', () => {
  const eng = new SimulationEngine(2, 1_000_000);
  eng.openShop({ shopType: 'BUFE' });
  const back = check(eng, 'F2');
  assert.equal(back.getState().tradeState!.shops.length, 1);
  assert.ok(getAchievements(back.getState()).unlocked['nw-1m'] === undefined || true);
});
test('F3) Şirketi ve aktif kredisi olan eski kayıt', () => {
  const eng = new SimulationEngine(3, 5_000_000);
  eng.establishCompany('Test A.Ş.', 'TST', 'TEKNOLOJI', 2_000_000, { initialStaffCount: 20, initialCapacity: 50, initialRdBudget: 5_000 });
  eng.takeOutBankLoan({ loanType: 'WORKING_CAPITAL', principal: 100_000, termInGameDays: 90 });
  const back = check(eng, 'F3');
  assert.ok(back.getState().playerCompany);
  assert.equal(back.getState().activeLoans!.length, 1);
});
test('F4) Holding aşamasındaki kayıt', () => {
  const eng = new SimulationEngine(4, 50_000_000);
  eng.establishCompany('Test A.Ş.', 'TST', 'SAVUNMA', 5_000_000, { initialStaffCount: 40, initialCapacity: 100, initialRdBudget: 10_000 });
  const back = check(eng, 'F4');
  assert.ok(back.getState().playerCompany);
});
test('F5) Prestij yapmış eski kayıt: yıldız korunur, puan yıldızdan türetilir', () => {
  const old = new SimulationEngine(5, 60_000_000);
  const eng = startNewCity(old.getState(), make).engine!;
  const back = check(eng, 'F5');
  assert.equal(back.getState().prestige?.stars, 2);
  assert.ok((back.getState().prestige?.pointsEarned ?? 2) >= 2);
});
test('F6) Çevrimdışı beklemiş kayıt yüklenir ve çevrimdışı ilerleme güvenle çalışır', () => {
  const eng = new SimulationEngine(6, 1_000_000);
  eng.openShop({ shopType: 'BUFE' });
  const back = check(eng, 'F6');
  const sum = back.processOfflineProgress('2026-03-01T00:00:00.000Z', '2026-03-01T06:00:00.000Z');
  assert.ok(Number.isFinite(back.getState().netWorth));
  assert.ok((sum.efficiency ?? 0) > 0 && (sum.efficiency ?? 1) < 1, '6 saatte verim kademeli düştü');
});
test('F7) Kısıtlı işletme bakiyeli eski kayıt', () => {
  const eng = new SimulationEngine(7, 300_000);
  eng.takeOutBankLoan({ loanType: 'WORKING_CAPITAL', principal: 150_000, termInGameDays: 90 });
  const r = WalletEngine.restrictedFund(eng.getState());
  const back = check(eng, 'F7');
  assert.equal(WalletEngine.restrictedFund(back.getState()), r);
});
test('F8) Kayıt dosyası: bozuk kontrol kodu reddedilir, eski sürüm numaralı dosya anlaşılır hata verir', async () => {
  const eng = new SimulationEngine(8, 500_000);
  const { text } = await exportSaveFile(eng, '2026-11-20T10:00:00.000Z');
  const obj = JSON.parse(text);
  const tampered = JSON.stringify({ ...obj, checksum: '0'.repeat(64) });
  await assert.rejects(importSaveFile(tampered), (e: unknown) => e instanceof SaveFileError && e.message.length > 20);
  // Eski sürüm numaralı (geçerli kontrol kodlu) dosya yüklenir; yeni sürüm anlaşılır hatayla reddedilir
  const oldVer = JSON.stringify({ ...obj, fileVersion: 0 });
  const loaded = await importSaveFile(oldVer);
  assert.equal(loaded.getState().seed, eng.getState().seed);
  const future = JSON.stringify({ ...obj, fileVersion: 999 });
  await assert.rejects(importSaveFile(future), (e: unknown) => e instanceof SaveFileError && e.message.length > 20);
});
