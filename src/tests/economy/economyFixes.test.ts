/**
 * EKONOMİ TUTARLILIĞI VE EXPLOIT DÜZELTMELERİ (ai-workflow/DUZELTME_PLANI.md, Bölüm 2)
 *
 * 1. Kredi → hisse → sat → krediyi kapat döngüsü sonsuz para üretmez
 * 2. 100 farklı tohum × 360 oyun günü: teklif edilen toplam ile gerçek tahsilat en çok 1 TL farklı
 * 3. Fiyat adil fiyatın 10 katı: sürekli pozitif dükkân kârı oluşmaz
 * 4. Aynı idempotency anahtarıyla taksit 10 kez çağrılınca tek tahsilat
 * 5. Aynı vade için yetersiz bakiye 10 kez çağrılınca missedPaymentCount yalnızca bir artar
 * 6. Son taksitte remainingPrincipal ve accruedInterestUnpaid sıfırlanır
 * 7. Rezerve emir nakdi kredi ödemesi veya yükseltme tarafından harcanmaz
 * + işletme kredisi kısıtı, 365 gün standardı, eski kayıt göçü
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { BankLoanEngine, LOAN_TYPE_CATALOG } from '../../engine/BankLoanEngine';
import {
  buildAmortizationPlan,
  migrateLegacyLoanContract,
} from '../../engine/LoanAmortization';
import { priceDemandMultiplier } from '../../engine/ShopSales';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { WalletEngine } from '../../engine/WalletEngine';
import {
  DEBT_INTEREST_DAYS_PER_YEAR,
  LOAN_DEFAULT_MISSED_DUE_DATES,
} from '../../data/gameBalance';
import type { LoanContract } from '../../models/finance';
import { restockShops } from '../balance/restockBot';

const r2 = (v: number) => Number(v.toFixed(2));

function getLoan(engine: SimulationEngine, loanId: string): LoanContract {
  const loan = (engine.getState().activeLoans ?? []).find((l) => l.loanId === loanId);
  assert.ok(loan, `${loanId} sözleşmesi bulunamadı`);
  return loan;
}

// ---------------------------------------------------------------------------
// 1. Kredi → hisse → sat → kapat döngüsü
// ---------------------------------------------------------------------------
test('1) Aynı gün kredi çek, hisse al, sat, krediyi kapat: net değer artışıyla sonsuz para oluşmaz', () => {
  const engine = new SimulationEngine(20261120, 1_000_000);
  const ticker = engine.getState().stocks[0].ticker;
  const startNet = engine.getState().netWorth;

  for (let cycle = 0; cycle < 20; cycle++) {
    const loan = engine.takeOutBankLoan({ loanType: 'WORKING_CAPITAL', principal: 400_000, termInGameDays: 90 });
    assert.equal(loan.success, true, loan.message);

    // Kredi paraları KISITLIDIR: hisse alımında kullanılabilir nakit yalnızca serbest kısımdır
    const free = engine.getFreeSpendableCash();
    assert.ok(
      free <= engine.getState().cash - WalletEngine.restrictedFund(engine.getState()) + 0.01,
      'Serbest nakit kısıtlı kredi bakiyesini içermemeli'
    );
    const stock = engine.getState().stocks.find((s) => s.ticker === ticker)!;
    const tooMany = Math.floor((free + 50_000) / (stock.askPrice * 1.002)) + 1;
    const blocked = engine.buyStock(ticker, tooMany);
    assert.equal(blocked.success, false, 'Kredi parasıyla hisse alınamaz');

    // Serbest nakitle normal alım-satım serbesttir
    const affordable = Math.floor((free * 0.5) / (stock.askPrice * 1.002));
    if (affordable > 0) {
      assert.equal(engine.buyStock(ticker, affordable).success, true);
      const owned = engine.getState().portfolio[ticker]?.shares ?? 0;
      if (owned > 0) engine.sellStock(ticker, owned);
    }

    const payoff = engine.payOffLoanEarly(loan.loan!.loanId);
    assert.equal(payoff.success, true, payoff.message);
  }

  const endNet = engine.getState().netWorth;
  assert.ok(
    endNet <= startNet + 1,
    `Kredi-hisse döngüsü net değeri artıramaz (başlangıç ${startNet}, son ${endNet})`
  );
  assert.equal(WalletEngine.restrictedFund(engine.getState()), 0, 'Kapanan kredinin kısıtlı bakiyesi nakitle erimiş olmalı ya da sıfırlanmalı');
});

test('İşletme kredisi kısıtı: stok/yükseltme/açılışta kullanılır, hisse-lüks-kasa aktarımında kullanılamaz', () => {
  const engine = new SimulationEngine(20261121, 120_000);
  assert.equal(engine.openShop({ shopType: 'BUFE' }).success, true);
  const loan = engine.takeOutBankLoan({ loanType: 'WORKING_CAPITAL', principal: 80_000, termInGameDays: 90 });
  assert.equal(loan.success, true, loan.message);
  const st = engine.getState();
  const restricted = WalletEngine.restrictedFund(st);
  assert.ok(restricted > 70_000, `net kullandırım kısıtlı bakiyeye yatmalı (${restricted})`);
  assert.ok(restricted <= st.cash);
  const free = engine.getFreeSpendableCash();
  assert.ok(free < 100_000, `serbest nakit kısıtlı krediyi içermemeli (${free})`);
  assert.ok(st.cash - free >= restricted - 0.01);

  // Kasa aktarımı serbest nakitle sınırlı: kısıtlı tutar kasaya aktarılamaz (toplam nakit yetse bile)
  const shop = engine.getState().tradeState!.shops[0];
  const move = engine.transferBetweenPersonalAndShopCash({
    shopId: shop.shopId,
    amount: free + 1_000,
    direction: 'TO_SHOP',
  });
  assert.equal(move.success, false, 'Kısıtlı bakiye kasaya aktarılamaz');
  assert.ok(st.cash - 0 >= free + 1_000, 'toplam nakit yeterli olsa da reddedildi');

  // Lüks harcama serbest nakitle sınırlı: 150.000 TL'lik daire, toplam nakit yetse de alınamaz
  const lux = engine.buyLifestyleItem('daire');
  assert.ok(engine.getState().cash >= 150_000, 'toplam nakit dairenin fiyatını karşılıyor');
  assert.equal(lux.success, false, 'kısıtlı kredi parasıyla lüks alınamaz');

  // Hisse alımı: toplam nakit yetse de serbest nakit sınırı geçerli
  const stock = engine.getState().stocks[0];
  const shares = Math.floor((free + 20_000) / (stock.askPrice * 1.002)) + 1;
  assert.equal(engine.buyStock(stock.ticker, shares).success, false);

  // Dükkân yükseltmesi (işletme harcaması) kısıtlı bakiyeyi kullanabilir ve onu azaltır
  shop.cashAccountBalance = 0;
  const before = WalletEngine.restrictedFund(engine.getState());
  const up = engine.buyShopUpgrade(shop.shopId, 'tabela');
  assert.equal(up.success, true, up.message);
  assert.ok(
    WalletEngine.restrictedFund(engine.getState()) < before,
    'İşletme harcaması kısıtlı bakiyeden düşer'
  );
});

test('Eski kayıtta kısıtlı bakiye alanı yoksa sıfırdan başlar', () => {
  const engine = new SimulationEngine(20261122, 500_000);
  const json = JSON.parse(engine.serializeState());
  const target = json.state ?? json;
  delete target.businessLoanFund;
  const back = SimulationEngine.deserializeState(JSON.stringify(json));
  assert.equal(back.getState().businessLoanFund ?? 0, 0);
  assert.equal(back.getFreeSpendableCash(), back.getSpendableCash());
});

// ---------------------------------------------------------------------------
// 2. 100 seed × 360 gün amortisman
// ---------------------------------------------------------------------------
test('2) 100 tohum ve 360 oyun günü: teklif edilen toplam ile gerçek tahsilat en çok 1 TL farklı', () => {
  const types = Object.keys(LOAN_TYPE_CATALOG) as Array<keyof typeof LOAN_TYPE_CATALOG>;
  const terms = [60, 90, 120, 180, 360];
  let worstDiff = 0;
  let executed = 0;

  for (let seed = 1; seed <= 100; seed++) {
    const engine = new SimulationEngine(20270000 + seed, 9_000_000);
    const st = engine.getState();
    // Şirketsiz oyuncu: teminatsız türler
    const loanType = (['WORKING_CAPITAL', 'REVOLVING_CREDIT'] as const)[seed % 2];
    void types;
    const term = terms[seed % terms.length];
    const principal = 50_000 + (seed % 10) * 23_456.78;

    const quote = engine.getLoanOfferQuote({ loanType, requestedPrincipal: principal, customTermDays: term });
    assert.equal(quote.approved, true, `seed ${seed}: ${quote.rejectionReason}`);
    executed += 1;

    const startDay = st.day;
    const res = engine.takeOutBankLoan({ loanType, principal, termInGameDays: term });
    assert.equal(res.success, true, res.message);
    const loan = getLoan(engine, res.loan!.loanId);

    assert.equal(r2(quote.totalInstallmentPayments), quote.totalRepayment);
    assert.equal(
      r2(quote.totalLoanCost),
      r2(quote.totalInterest + quote.originationFee),
      'toplam maliyet = toplam faiz + peşin ücret'
    );
    assert.equal(quote.netDisbursement, r2(quote.requestedPrincipal - quote.originationFee));

    const cashAfterLoan = engine.getState().cash;
    for (let d = 1; d <= 360 && loan.status !== 'PAID_OFF'; d++) {
      engine.getState().day = startDay + d;
      BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
    }

    assert.equal(loan.status, 'PAID_OFF', `seed ${seed}: kredi 360 günde kapanmalı`);
    const collected = r2(loan.totalInterestPaid + loan.totalPrincipalPaid);
    const cashPaid = r2(cashAfterLoan - engine.getState().cash);
    const diffPlan = Math.abs(collected - quote.totalInstallmentPayments);
    const diffCash = Math.abs(cashPaid - quote.totalInstallmentPayments);
    worstDiff = Math.max(worstDiff, diffPlan, diffCash);
    assert.ok(diffPlan <= 1, `seed ${seed}: plan farkı ${diffPlan} TL`);
    assert.ok(diffCash <= 1, `seed ${seed}: nakit farkı ${diffCash} TL`);
    assert.equal(loan.remainingPrincipal, 0);
    assert.equal(loan.accruedInterestUnpaid, 0);
    assert.equal(loan.missedPaymentCount, 0, 'bakiye yeterliyken gecikme olmaz');
  }
  assert.equal(executed, 100, '100 tohumun hepsi gerçekten işlendi');
  assert.ok(worstDiff <= 1, `en kötü fark ${worstDiff} TL`);
});

test('Amortisman planı: son taksit kuruş farkını temizler, sıfır faizde P/n', () => {
  const plan = buildAmortizationPlan(100_000, 0.36, 30, 12);
  const last = plan.rows[plan.rows.length - 1];
  assert.equal(last.balanceAfter, 0);
  assert.equal(
    r2(plan.rows.reduce((a, b) => a + b.principal, 0)),
    100_000,
    'anapara toplamı tam P'
  );
  const zero = buildAmortizationPlan(120_000, 0, 30, 12);
  assert.equal(zero.installmentAmount, 10_000);
  assert.equal(zero.totalInterest, 0);
});

// ---------------------------------------------------------------------------
// 3. Aşırı fiyat
// ---------------------------------------------------------------------------
test('Fiyat talebi kademeleri: 1.5 üstü sert düşer, 3 üstü sıfır, geçersiz fiyat 0', () => {
  assert.ok(priceDemandMultiplier(1.0) >= 1);
  assert.ok(priceDemandMultiplier(1.5) > 0.3, 'elastik bölge korunur');
  assert.ok(priceDemandMultiplier(1.8) <= 0.05);
  assert.ok(priceDemandMultiplier(2.0) <= 0.05);
  assert.ok(priceDemandMultiplier(2.5) <= 0.01);
  assert.ok(priceDemandMultiplier(3.0) <= 0.01);
  assert.equal(priceDemandMultiplier(3.01), 0);
  assert.equal(priceDemandMultiplier(10), 0);
  assert.equal(priceDemandMultiplier(Number.NaN), 0);
  assert.equal(priceDemandMultiplier(Number.POSITIVE_INFINITY), 0);
  assert.equal(priceDemandMultiplier(-2), 0);
});

test('3) Fiyat adil fiyatın 10 katı olunca sürekli pozitif dükkân kârı oluşmaz', () => {
  const engine = new SimulationEngine(20261123, 2_000_000);
  assert.equal(engine.openShop({ shopType: 'BUFE' }).success, true);
  const shopId = engine.getState().tradeState!.shops[0].shopId;
  const resIds = Object.keys(engine.getState().tradeState!.shops[0].sellingPrices);
  const multipliers: Record<string, number> = {};
  for (const id of resIds) multipliers[id] = 10;
  engine.configureShopParameters({ shopId, priceMultipliers: multipliers });

  let profitableDays = 0;
  let totalRevenue = 0;
  let netProfit = 0;
  for (let d = 0; d < 40; d++) {
    restockShops(engine);
    engine.advanceDaysWithoutPlayerDecisions(1, true);
    const shop = engine.getState().tradeState!.shops[0];
    totalRevenue += shop.todaySalesRevenue;
    netProfit += shop.todayNetProfit ?? 0;
    if ((shop.todayNetProfit ?? 0) > 0) profitableDays += 1;
  }
  assert.equal(totalRevenue, 0, '10 kat fiyatta normal talep sıfır: satış olmaz');
  assert.equal(profitableDays, 0, 'sürekli pozitif kâr oluşmamalı');
  assert.ok(netProfit <= 0);
});

test('Negatif, NaN ve sonsuz satış fiyatı reddedilir; eski fiyat korunur', () => {
  const engine = new SimulationEngine(20261124, 1_000_000);
  assert.equal(engine.openShop({ shopType: 'BUFE' }).success, true);
  const shop = engine.getState().tradeState!.shops[0];
  const resId = Object.keys(shop.sellingPrices)[0];
  const original = shop.sellingPrices[resId];
  for (const bad of [-5, 0, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    engine.configureShopParameters({ shopId: shop.shopId, resourceIdForPrice: resId, newSellingPrice: bad });
    assert.equal(engine.getState().tradeState!.shops[0].sellingPrices[resId], original, `${bad} reddedilmeli`);
  }
});

// ---------------------------------------------------------------------------
// 4-5. İdempotency ve temerrüt
// ---------------------------------------------------------------------------
function loanAtDueDay(seed: number, cash = 5_000_000) {
  const engine = new SimulationEngine(seed, cash);
  const res = engine.takeOutBankLoan({ loanType: 'WORKING_CAPITAL', principal: 200_000, termInGameDays: 90 });
  assert.equal(res.success, true, res.message);
  const loan = getLoan(engine, res.loan!.loanId);
  return { engine, loan };
}

test('4) Aynı idempotency anahtarıyla taksit 10 kez çağrılınca tek tahsilat olur', () => {
  const { engine, loan } = loanAtDueDay(20261125);
  engine.getState().day = loan.nextPaymentGameDay;
  const cashBefore = engine.getState().cash;
  const results = Array.from({ length: 10 }, () => engine.payLoanInstallment(loan.loanId, 'SAME-KEY-1'));
  assert.equal(results.filter((r) => r.success).length, 1, 'tek başarılı tahsilat');
  assert.equal(results.filter((r) => r.duplicate).length, 9, 'dokuzu mükerrer olarak yutuldu');
  assert.equal(loan.paidInstallmentCount, 1);
  assert.equal(loan.missedPaymentCount, 0, 'mükerrer çağrı gecikme yaratmaz');
  const paid = r2(cashBefore - engine.getState().cash);
  assert.ok(Math.abs(paid - loan.installmentAmount) <= 1, `tek taksit çekildi (${paid} vs ${loan.installmentAmount})`);

  // Anahtarsız tekrar çağrılar da aynı gün için tek tahsilat
  const again = Array.from({ length: 5 }, () => engine.payLoanInstallment(loan.loanId));
  assert.equal(again.filter((r) => r.success).length, 0);
});

test('5) Aynı vade için yetersiz bakiye 10 kez çağrılınca missedPaymentCount yalnızca bir artar', () => {
  const { engine, loan } = loanAtDueDay(20261126);
  engine.getState().day = loan.nextPaymentGameDay;
  // Nakdi erit: taksit ödenemez
  WalletEngine.setBalance(engine.getState(), 10);
  engine.getState().investmentCash = 10;
  for (let i = 0; i < 10; i++) {
    const res = engine.payLoanInstallment(loan.loanId);
    assert.equal(res.success, false);
  }
  assert.equal(loan.missedPaymentCount, 1, 'aynı vade tek gecikme sayılır');
  assert.equal(loan.status, 'DELINQUENT');
  assert.notEqual(loan.status as string, 'DEFAULTED', 'aynı vadenin tekrarları temerrüt yaratmaz');

  // Aynı günün gün sonu işleme tekrarları da sayacı artırmaz
  for (let i = 0; i < 5; i++) BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
  assert.equal(loan.missedPaymentCount, 1);
});

test('Üç FARKLI vade ödenmeden geçince DEFAULTED olur; vade ilerlemeden olmaz', () => {
  const { engine, loan } = loanAtDueDay(20261127);
  const due = loan.nextPaymentGameDay;
  const freq = loan.installmentFrequency;
  WalletEngine.setBalance(engine.getState(), 10);
  engine.getState().investmentCash = 10;

  engine.getState().day = due;
  BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
  assert.equal(loan.missedPaymentCount, 1);
  assert.equal(loan.status, 'DELINQUENT');

  // Vade ilerlemeden günlerce geçse de yeni vade sayılmaz
  for (let d = due + 1; d < due + freq; d++) {
    engine.getState().day = d;
    BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
  }
  assert.equal(loan.missedPaymentCount, 1, 'aynı vade içinde sayaç artmaz');

  engine.getState().day = due + freq;
  BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
  assert.equal(loan.missedPaymentCount, 2);
  assert.equal(loan.status, 'DELINQUENT');

  engine.getState().day = due + 2 * freq;
  BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
  assert.equal(loan.missedPaymentCount, LOAN_DEFAULT_MISSED_DUE_DATES);
  assert.equal(loan.status, 'DEFAULTED');

  // Temerrüt sonrası tekrar işleme sayacı şişirmez
  for (let i = 0; i < 4; i++) BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
  assert.equal(loan.missedPaymentCount, LOAN_DEFAULT_MISSED_DUE_DATES);
});

test('Vadesi gelmemiş (erken) başarısız ödeme denemesi gecikme sayılmaz', () => {
  const { engine, loan } = loanAtDueDay(20261128);
  WalletEngine.setBalance(engine.getState(), 10);
  engine.getState().investmentCash = 10;
  for (let i = 0; i < 5; i++) assert.equal(engine.payLoanInstallment(loan.loanId).success, false);
  assert.equal(loan.missedPaymentCount, 0);
  assert.equal(loan.status, 'ACTIVE');
});

// ---------------------------------------------------------------------------
// 6. Son taksit
// ---------------------------------------------------------------------------
test('6) Son taksitte remainingPrincipal ve accruedInterestUnpaid sıfırlanır', () => {
  const { engine, loan } = loanAtDueDay(20261129);
  const start = engine.getState().day;
  const count = loan.installmentCount!;
  for (let d = 1; d <= 120 && loan.status !== 'PAID_OFF'; d++) {
    engine.getState().day = start + d;
    BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
  }
  assert.equal(loan.status, 'PAID_OFF');
  assert.equal(loan.paidInstallmentCount, count);
  assert.equal(loan.remainingPrincipal, 0);
  assert.equal(loan.accruedInterestUnpaid, 0);
  assert.equal(loan.accruedLateFeeUnpaid ?? 0, 0);
  assert.equal(r2(loan.totalPrincipalPaid), loan.principal, 'anapara tam kapanır');
});

// ---------------------------------------------------------------------------
// 7. Rezerve emir nakdi
// ---------------------------------------------------------------------------
test('7) Rezerve emir nakdi kredi ödemesi veya yükseltme tarafından harcanmaz', () => {
  const engine = new SimulationEngine(20261130, 1_000_000);
  assert.equal(engine.openShop({ shopType: 'BUFE' }).success, true);
  const loanRes = engine.takeOutBankLoan({ loanType: 'WORKING_CAPITAL', principal: 100_000, termInGameDays: 90 });
  assert.equal(loanRes.success, true, loanRes.message);
  const loan = getLoan(engine, loanRes.loan!.loanId);

  // Bekleyen alış emriyle nakdin neredeyse tamamını rezerve et (emir gerçekleşmesin)
  const stock = engine.getState().stocks[0];
  const spendable = engine.getFreeSpendableCash();
  const reserveShares = Math.max(1, Math.floor((spendable - 5_000) / (stock.askPrice * 1.05)));
  const placed = engine.placeOrder({
    ticker: stock.ticker,
    orderType: 'LIMIT_BUY',
    requestedShares: reserveShares,
    limitPrice: Math.max(0.01, stock.price * 0.2),
  });
  assert.equal(placed.success, true, placed.message);
  const reserved = engine.getReservedCash();
  assert.ok(reserved > 0);

  // Kullanılabilir nakit taksiti karşılamıyor
  const free = engine.getSpendableCash();
  assert.ok(free < loan.installmentAmount + 1_000_000);
  // Nakdi, rezerve + taksitten az serbest kalacak şekilde sınırla
  WalletEngine.setBalance(engine.getState(), reserved + Math.max(0, loan.installmentAmount - 1_000));
  engine.getState().investmentCash = engine.getState().cash;

  engine.getState().day = loan.nextPaymentGameDay;
  const cashBefore = engine.getState().cash;
  const pay = engine.payLoanInstallment(loan.loanId);
  assert.equal(pay.success, false, 'rezerve nakitle taksit ödenemez');
  assert.equal(engine.getState().cash, cashBefore, 'başarısız ödeme nakde dokunmaz');
  assert.equal(engine.getReservedCash(), reserved, 'rezerve nakit korunur');

  // Dükkân yükseltmesi de rezerve nakdi kullanamaz (serbest nakdi yükseltme bedelinin çok altına indir)
  const shop = engine.getState().tradeState!.shops[0];
  shop.cashAccountBalance = 0;
  WalletEngine.setBalance(engine.getState(), reserved + 50);
  engine.getState().investmentCash = engine.getState().cash;
  const up = engine.buyShopUpgrade(shop.shopId, 'tabela');
  assert.equal(up.success, false, 'rezerve nakitle yükseltme yapılamaz');
  assert.equal(engine.getReservedCash(), reserved);
});

// ---------------------------------------------------------------------------
// 365 gün standardı ve eski kayıt göçü
// ---------------------------------------------------------------------------
test('Borç faizi 365 gün standardını kullanır (eski /252 yok)', () => {
  assert.equal(DEBT_INTEREST_DAYS_PER_YEAR, 365);
  const engine = new SimulationEngine(20261131, 5_000_000);
  const res = engine.takeOutBankLoan({ loanType: 'WORKING_CAPITAL', principal: 120_000, termInGameDays: 90 });
  assert.equal(res.success, true, res.message);
  const loan = getLoan(engine, res.loan!.loanId);
  engine.getState().day += 1;
  const out = BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
  const expected = r2((loan.remainingPrincipal * loan.annualInterestRate) / 365);
  assert.equal(out.totalInterestAccruedToday, expected);
});

test('Eski modelle yazılmış kredi göçte patlamaz: kalan anapara aynı, taksit yeniden hesaplanır, kapanabilir', () => {
  const engine = new SimulationEngine(20261132, 5_000_000);
  const res = engine.takeOutBankLoan({ loanType: 'WORKING_CAPITAL', principal: 90_000, termInGameDays: 90 });
  assert.equal(res.success, true, res.message);
  const loan = getLoan(engine, res.loan!.loanId);

  // Eski kayıt şekline çevir: yeni alanlar yok, taksit eski formülle (faiz bastan eklenmiş)
  delete loan.amortizationModel;
  delete loan.installmentCount;
  delete loan.paidInstallmentCount;
  delete loan.accruedLateFeeUnpaid;
  const periodRate = (loan.annualInterestRate * loan.installmentFrequency) / 365;
  const oldInstallment = r2((loan.principal + loan.principal * periodRate * 3) / 3);
  loan.installmentAmount = oldInstallment;

  const remainingBefore = loan.remainingPrincipal;
  migrateLegacyLoanContract(loan);
  assert.equal(loan.amortizationModel, 'ANNUITY_V2');
  assert.equal(loan.remainingPrincipal, remainingBefore, 'borç bakiyesi göçte değişmez');
  assert.ok(loan.installmentAmount <= oldInstallment + 1, 'yeni taksit eskisinden yüksek olmaz (faiz çift sayılmaz)');
  migrateLegacyLoanContract(loan); // idempotent
  assert.equal(loan.installmentCount, 3);

  const start = engine.getState().day;
  for (let d = 1; d <= 120 && loan.status !== 'PAID_OFF'; d++) {
    engine.getState().day = start + d;
    BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
  }
  assert.equal(loan.status, 'PAID_OFF');
  assert.equal(loan.remainingPrincipal, 0);
});
