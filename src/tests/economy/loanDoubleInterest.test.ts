/**
 * ÇİFT FAİZ REGRESYON TESTİ (BankLoanEngine + DayCloseProcessor)
 *
 * Kural: Bir kredinin faizi YALNIZCA bir kez ödenir. Günlük faiz tahakkuku (`accruedInterestUnpaid`) bilgi amaçlıdır;
 * taksitin içindeki faiz (kalan anapara × dönem faizi) zaten aynı faizdir. İkisi birlikte nakitten çıkmamalıdır.
 *
 * A) Taksit tutarı tahakkuktan bağımsızdır (tahakkuk sıfır da olsa, dev bir sayı da olsa aynı nakit çıkar).
 * B) Kredinin ömrü boyunca nakitten çıkan toplam = teklifteki taksit toplamı; ödenen faiz = teklifteki toplam faiz.
 * C) Merkezi defterde kredi için yalnızca taksit ve kullandırım hareketi vardır (ek faiz kalemi yoktur).
 * D) Gün kapanışı (DayCloseProcessor): aynı tohumlu, kredisiz ikizle karşılaştırınca, hiç taksit ödenmeyen
 *    ACTIVE / DELINQUENT / DEFAULTED krediler günlük borç faiziyle ek nakit kaybettirmez.
 * E) Banka kredisi olmayan borç aynen faizlenir; tahakkuk eden kredi faizi onun matrahını azaltmaz.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { BankLoanEngine } from '../../engine/BankLoanEngine';
import { buildAmortizationPlan, installmentBreakdown, loanPeriodRate } from '../../engine/LoanAmortization';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { WalletEngine } from '../../engine/WalletEngine';
import type { LoanContract } from '../../models/finance';

const r2 = (v: number) => Number(v.toFixed(2));
const CENT = 0.011;

function setCash(engine: SimulationEngine, amount: number): void {
  WalletEngine.setBalance(engine.getState(), amount);
  engine.getState().investmentCash = amount;
}

function takeLoan(
  engine: SimulationEngine,
  principal: number,
  term: number,
  loanType: 'WORKING_CAPITAL' | 'REVOLVING_CREDIT' = 'WORKING_CAPITAL'
): LoanContract {
  const res = engine.takeOutBankLoan({ loanType, principal, termInGameDays: term });
  assert.equal(res.success, true, res.message);
  const loan = (engine.getState().activeLoans ?? []).find((l) => l.loanId === res.loan!.loanId);
  assert.ok(loan);
  return loan;
}

// ---------------------------------------------------------------------------
// A) Saf hesap: taksitin faizi tek kaynaktan gelir
// ---------------------------------------------------------------------------
test('A1) Amortisman planı: her taksitin faizi yalnızca kalan anapara × dönem faizidir; toplamlar tutarlı', () => {
  const rates = [0, 0.12, 0.35, 0.8];
  const freqs = [7, 15, 30];
  const counts = [1, 2, 3, 6, 12];
  for (const annual of rates) {
    for (const freq of freqs) {
      for (const n of counts) {
        const principal = 123_456.78;
        const plan = buildAmortizationPlan(principal, annual, freq, n);
        const rate = loanPeriodRate(annual, freq);
        let balance = principal;
        let interestSum = 0;
        let principalSum = 0;
        let paymentSum = 0;
        for (const row of plan.rows) {
          assert.ok(Math.abs(row.interest - r2(balance * rate)) <= CENT, `faiz = kalan × oran (${annual}/${freq}/${n})`);
          assert.ok(Math.abs(row.payment - (row.interest + row.principal)) <= CENT, 'taksit = faiz + anapara');
          balance = r2(balance - row.principal);
          interestSum += row.interest;
          principalSum += row.principal;
          paymentSum += row.payment;
        }
        assert.ok(Math.abs(principalSum - principal) <= CENT, 'anapara toplamı kredi tutarı');
        assert.ok(Math.abs(plan.totalInterest - interestSum) <= 0.05, 'plan faiz toplamı satırların toplamı');
        assert.ok(Math.abs(plan.totalInstallmentPayments - paymentSum) <= 0.05);
        assert.ok(
          Math.abs(plan.totalInstallmentPayments - (principal + plan.totalInterest)) <= 0.05,
          'toplam geri ödeme = anapara + faiz (üçüncü bir kalem yok)'
        );
        assert.equal(balance, 0, 'son taksitten sonra bakiye sıfır');
      }
    }
  }
});

test('A2) installmentBreakdown günlük tahakkuka bakmaz: yalnızca kalan anapara, oran ve taksite bağlıdır', () => {
  const rate = loanPeriodRate(0.4, 30);
  const a = installmentBreakdown(100_000, rate, 36_000, false);
  const b = installmentBreakdown(100_000, rate, 36_000, false);
  assert.deepEqual(a, b);
  assert.ok(Math.abs(a.interest - r2(100_000 * rate)) <= CENT);
  assert.ok(Math.abs(a.payment - 36_000) <= CENT, 'normal taksit standart tutardır');
});

// ---------------------------------------------------------------------------
// A3) Taksit nakdi, günlük tahakkuk ne olursa olsun aynıdır
// ---------------------------------------------------------------------------
test('A3) Tahakkuk 0 ya da 1.000.000 olsa da taksit için nakitten çıkan tutar aynıdır', () => {
  const charged: number[] = [];
  for (const injectedAccrual of [0, 4_321.09, 1_000_000]) {
    const engine = new SimulationEngine(20281101, 5_000_000);
    const loan = takeLoan(engine, 200_000, 90);
    const quote = loan.installmentAmount;
    engine.getState().day = loan.nextPaymentGameDay;
    loan.accruedInterestUnpaid = injectedAccrual;
    const before = engine.getState().cash;
    const res = engine.payLoanInstallment(loan.loanId, `A3-${injectedAccrual}`);
    assert.equal(res.success, true, res.message);
    const out = r2(before - engine.getState().cash);
    charged.push(out);
    assert.ok(Math.abs(out - quote) <= CENT, `taksit ${quote}, çıkan ${out} (tahakkuk ${injectedAccrual})`);
    assert.ok(Math.abs(res.interestPaid + res.principalReduced - out) <= CENT, 'faiz + anapara = çıkan nakit');
  }
  assert.equal(new Set(charged).size, 1, 'üç senaryoda çıkan nakit birebir aynı');
});

// ---------------------------------------------------------------------------
// B + C) Tüm ömür: nakit, faiz ve defter
// ---------------------------------------------------------------------------
test('B/C) 30 tohum × tür × vade: toplam nakit çıkışı = teklif taksit toplamı, ödenen faiz = teklif faizi, defterde ek faiz yok', () => {
  const terms = [30, 60, 90, 180, 360];
  const types = ['WORKING_CAPITAL', 'REVOLVING_CREDIT'] as const;
  let checked = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const engine = new SimulationEngine(20281200 + seed, 9_000_000);
    const loanType = types[seed % 2];
    const term = terms[seed % terms.length];
    const principal = 40_000 + seed * 7_919.37;
    const quote = engine.getLoanOfferQuote({ loanType, requestedPrincipal: principal, customTermDays: term });
    assert.equal(quote.approved, true, quote.rejectionReason);
    const loan = takeLoan(engine, principal, term, loanType);

    const cashAfterLoan = engine.getState().cash;
    const startDay = engine.getState().day;
    let accruedSeenPositive = false;
    for (let d = 1; d <= term + 40 && loan.status !== 'PAID_OFF'; d++) {
      engine.getState().day = startDay + d;
      BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
      if (loan.accruedInterestUnpaid > 0) accruedSeenPositive = true;
    }
    assert.equal(loan.status, 'PAID_OFF', `seed ${seed}: kredi kapanmalı`);
    assert.ok(accruedSeenPositive, 'tahakkuk gerçekten işledi (test anlamlı)');

    const cashOut = r2(cashAfterLoan - engine.getState().cash);
    assert.ok(
      Math.abs(cashOut - quote.totalInstallmentPayments) <= 1,
      `seed ${seed}: nakit çıkışı ${cashOut}, teklif ${quote.totalInstallmentPayments} (tahakkuk eklenmiş olabilir)`
    );
    assert.ok(Math.abs(loan.totalInterestPaid - quote.totalInterest) <= 1, `seed ${seed}: faiz ${loan.totalInterestPaid} vs ${quote.totalInterest}`);
    assert.ok(Math.abs(loan.totalPrincipalPaid - principal) <= 1);
    assert.equal(loan.paidInstallmentCount, loan.installmentCount, 'taksit sayısı tam; fazladan tahsilat yok');
    assert.equal(loan.accruedInterestUnpaid, 0);

    const txs = (engine.getState().centralLedger?.transactions ?? []).filter((t) => t.relatedLoanId === loan.loanId);
    const byCategory: Record<string, number> = {};
    for (const t of txs) byCategory[t.category] = r2((byCategory[t.category] ?? 0) + t.amount);
    assert.deepEqual(
      Object.keys(byCategory).sort(),
      ['LOAN_DISBURSEMENT', 'LOAN_INSTALLMENT_PAYMENT'],
      `seed ${seed}: kredi için yalnızca kullandırım ve taksit hareketi olmalı (${Object.keys(byCategory).join(',')})`
    );
    assert.ok(Math.abs(byCategory.LOAN_INSTALLMENT_PAYMENT - quote.totalInstallmentPayments) <= 1);
    checked += 1;
  }
  assert.equal(checked, 30);
});

test('B2) Taksitler arasında günlük tahakkuk büyür ama taksit ödenince anaparaya/faize ikinci kez yazılmaz', () => {
  const engine = new SimulationEngine(20281301, 5_000_000);
  const loan = takeLoan(engine, 300_000, 120);
  const start = engine.getState().day;
  const interestPerInstallment: number[] = [];
  let lastPaid = 0;
  let lastInterest = 0;
  for (let d = 1; d <= 130 && loan.status !== 'PAID_OFF'; d++) {
    engine.getState().day = start + d;
    BankLoanEngine.stepDailyLoansAndInterest(engine.getState(), 0);
    if ((loan.paidInstallmentCount ?? 0) > lastPaid) {
      interestPerInstallment.push(r2(loan.totalInterestPaid - lastInterest));
      lastInterest = loan.totalInterestPaid;
      lastPaid = loan.paidInstallmentCount ?? 0;
    }
  }
  const plan = buildAmortizationPlan(300_000, loan.annualInterestRate, loan.installmentFrequency, loan.installmentCount!);
  assert.equal(interestPerInstallment.length, plan.rows.length);
  plan.rows.forEach((row, i) => {
    assert.ok(
      Math.abs(interestPerInstallment[i] - row.interest) <= CENT,
      `${i + 1}. taksit faizi ${interestPerInstallment[i]}, plan ${row.interest}`
    );
  });
});

// ---------------------------------------------------------------------------
// D) Gün kapanışı (DayCloseProcessor): kredisiz ikizle karşılaştırma
// ---------------------------------------------------------------------------
function twinCashDifference(forcedStatus: 'ACTIVE' | 'DELINQUENT' | 'DEFAULTED', days: number): number {
  const withLoan = new SimulationEngine(20281401, 5_000_000);
  const twin = new SimulationEngine(20281401, 5_000_000);
  const loan = takeLoan(withLoan, 200_000, 90);
  // Nakit taksitin altında: hiçbir taksit tahsil edilemez, kredi yalnızca tahakkuk eder.
  setCash(withLoan, 40_000);
  setCash(twin, 40_000);
  if (forcedStatus !== 'ACTIVE') {
    loan.status = forcedStatus;
    loan.missedPaymentCount = forcedStatus === 'DEFAULTED' ? 3 : 1;
  }
  for (let d = 0; d < days; d++) {
    withLoan.closeCurrentDay();
    twin.closeCurrentDay();
  }
  assert.equal(loan.paidInstallmentCount, 0, 'senaryoda hiç taksit ödenmemeli (nakit yetersiz)');
  assert.ok(loan.accruedInterestUnpaid > 0, 'günlük tahakkuk işledi');
  return r2(withLoan.getState().cash - twin.getState().cash);
}

test('D1) Gün kapanışı: ACTIVE kredi tahakkuk ederken ek nakit kaybettirmez', () => {
  assert.equal(twinCashDifference('ACTIVE', 25), 0);
});

test('D2) Gün kapanışı: DELINQUENT kredi için ikinci günlük borç faizi kesilmez', () => {
  assert.equal(twinCashDifference('DELINQUENT', 25), 0);
});

test('D3) Gün kapanışı: DEFAULTED kredinin anaparasına ikinci günlük borç faizi kesilmez (eski hata: 20 günde −2.522,88 ₺)', () => {
  assert.equal(twinCashDifference('DEFAULTED', 25), 0);
});

test('D4) Uzun vadede de: temerrüde düşen kredi gün kapanışlarıyla ilerlerken hiçbir gün yedek faiz kesilmez', () => {
  const withLoan = new SimulationEngine(20281402, 5_000_000);
  const twin = new SimulationEngine(20281402, 5_000_000);
  const loan = takeLoan(withLoan, 200_000, 90);
  setCash(withLoan, 40_000);
  setCash(twin, 40_000);
  let wentDefault = false;
  for (let d = 0; d < 110; d++) {
    withLoan.closeCurrentDay();
    twin.closeCurrentDay();
    if (loan.status === 'DEFAULTED') wentDefault = true;
    assert.equal(
      r2(withLoan.getState().cash - twin.getState().cash),
      0,
      `gün ${withLoan.getState().day}: kredi (${loan.status}) nakitten ek faiz çekti`
    );
  }
  assert.ok(wentDefault, 'kredi gerçekten temerrüde düştü (test anlamlı)');
});

// ---------------------------------------------------------------------------
// E) Banka dışı borç aynen faizlenir
// ---------------------------------------------------------------------------
test('E1) playerDebtOutsideBankLoans: kredi anaparası ve tahakkuk ne olursa olsun yalnızca banka dışı borcu verir', () => {
  const engine = new SimulationEngine(20281501, 5_000_000);
  const state = engine.getState();
  assert.equal(BankLoanEngine.playerDebtOutsideBankLoans(state), 0);

  const loan = takeLoan(engine, 200_000, 90);
  assert.equal(BankLoanEngine.playerDebtOutsideBankLoans(state), 0, 'yalnızca banka kredisi varken banka dışı borç yok');

  // Banka dışı 50.000 borç ekle
  state.shortTermDebt = r2(state.shortTermDebt + 50_000);
  state.totalDebt = r2(state.shortTermDebt + state.longTermDebt);

  for (const status of ['ACTIVE', 'DELINQUENT', 'DEFAULTED'] as const) {
    for (const accrued of [0, 12_345.67, 900_000]) {
      loan.status = status;
      loan.accruedInterestUnpaid = accrued;
      loan.accruedLateFeeUnpaid = accrued / 10;
      assert.equal(
        BankLoanEngine.playerDebtOutsideBankLoans(state),
        50_000,
        `durum ${status}, tahakkuk ${accrued}: banka dışı borç tam 50.000 kalmalı`
      );
    }
  }

  loan.status = 'PAID_OFF';
  loan.remainingPrincipal = 0;
  state.shortTermDebt = r2(state.shortTermDebt - 200_000);
  state.totalDebt = r2(state.shortTermDebt + state.longTermDebt);
  assert.equal(BankLoanEngine.playerDebtOutsideBankLoans(state), 50_000, 'kredi kapanınca da aynı');
});

test('E2) Gün kapanışı: banka dışı borcun günlük faizi, aynı borçlu kredisiz ikizle birebir aynıdır', () => {
  const withLoan = new SimulationEngine(20281502, 5_000_000);
  const twin = new SimulationEngine(20281502, 5_000_000);
  const noDebt = new SimulationEngine(20281502, 5_000_000);
  const loan = takeLoan(withLoan, 200_000, 90);
  for (const e of [withLoan, twin]) {
    const st = e.getState();
    st.shortTermDebt = r2(st.shortTermDebt + 50_000);
    st.totalDebt = r2(st.shortTermDebt + st.longTermDebt);
  }
  // İkizin 200.000'lik kredi borcu yok; yalnızca 50.000 banka dışı borç var
  twin.getState().shortTermDebt = 50_000;
  twin.getState().totalDebt = 50_000;
  for (const e of [withLoan, twin, noDebt]) setCash(e, 40_000);
  for (let d = 0; d < 15; d++) {
    withLoan.closeCurrentDay();
    twin.closeCurrentDay();
    noDebt.closeCurrentDay();
  }
  assert.ok(loan.accruedInterestUnpaid > 0);
  assert.equal(loan.paidInstallmentCount, 0, 'senaryoda taksit ödenmedi');
  assert.equal(
    r2(withLoan.getState().cash),
    r2(twin.getState().cash),
    'banka dışı borç faizi kredili ve kredisiz ikizde aynı çıkmalı'
  );
  assert.ok(
    r2(noDebt.getState().cash - twin.getState().cash) > 0,
    'banka dışı borcun faizi gerçekten kesildi (test anlamlı)'
  );
}
);
