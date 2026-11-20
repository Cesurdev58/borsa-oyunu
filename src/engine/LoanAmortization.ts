/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * KREDİ AMORTİSMAN PLANI (azalan bakiyeli annuite)
 *
 * Tek taksit modeli: teklif, sözleşme ve gerçek tahsilat AYNI plandan çıkar.
 *  - Dönem faizi:  r = yıllık faiz × taksit aralığı(gün) / 365
 *  - Taksit:       payment = P·r·(1+r)^n / ((1+r)^n − 1)   (r = 0 ise P / n)
 *  - Her ödemede:  faiz = kalanAnapara × r ;  anapara = min(kalanAnapara, taksit − faiz)
 *  - Son taksitte kuruş farkı temizlenir: kalan anapara tam sıfırlanır.
 *
 * Bu dosya yalnızca saf hesap içerir; başka motoru içe aktarmaz (döngü oluşturmaz).
 */

import { DEBT_INTEREST_DAYS_PER_YEAR } from '../data/gameBalance';
import type { LoanContract } from '../models/finance';

const r2 = (v: number) => Number(v.toFixed(2));

export interface AmortizationRow {
  /** 1'den başlayan taksit numarası */
  index: number;
  /** Bu taksitin toplam tutarı (faiz + anapara) */
  payment: number;
  interest: number;
  principal: number;
  /** Bu taksitten sonra kalan anapara */
  balanceAfter: number;
}

export interface AmortizationPlan {
  periodRate: number;
  installmentCount: number;
  /** Standart (son taksit hariç) taksit tutarı */
  installmentAmount: number;
  rows: AmortizationRow[];
  totalInterest: number;
  totalInstallmentPayments: number;
}

/** Dönem faiz oranı: yıllık oran × aralık / 365 */
export function loanPeriodRate(annualInterestRate: number, installmentFrequencyDays: number): number {
  const rate = Number.isFinite(annualInterestRate) ? Math.max(0, annualInterestRate) : 0;
  return (rate * installmentFrequencyDays) / DEBT_INTEREST_DAYS_PER_YEAR;
}

/** Annuite taksiti (kuruşa yuvarlı). r = 0 ise P / n. */
export function annuityPayment(principal: number, periodRate: number, installmentCount: number): number {
  const n = Math.max(1, Math.floor(installmentCount));
  if (!(principal > 0)) return 0;
  if (!(periodRate > 0)) return r2(principal / n);
  const growth = Math.pow(1 + periodRate, n);
  return r2((principal * periodRate * growth) / (growth - 1));
}

/**
 * Bir taksitin faiz/anapara dökümü. `isLast` ise kalan anaparanın tamamı kapanır (kuruş farkı temizlenir).
 */
export function installmentBreakdown(
  remainingPrincipal: number,
  periodRate: number,
  standardPayment: number,
  isLast: boolean
): { interest: number; principal: number; payment: number } {
  const remaining = Math.max(0, r2(remainingPrincipal));
  const interest = r2(remaining * periodRate);
  const principal = isLast ? remaining : r2(Math.min(remaining, Math.max(0, standardPayment - interest)));
  return { interest, principal, payment: r2(interest + principal) };
}

/** Tam amortisman planı: teklif ve tahsilat bu fonksiyondan beslenir. */
export function buildAmortizationPlan(
  principal: number,
  annualInterestRate: number,
  installmentFrequencyDays: number,
  installmentCount: number
): AmortizationPlan {
  const n = Math.max(1, Math.floor(installmentCount));
  const rate = loanPeriodRate(annualInterestRate, installmentFrequencyDays);
  const payment = annuityPayment(principal, rate, n);
  const rows: AmortizationRow[] = [];
  let balance = r2(Math.max(0, principal));
  let totalInterest = 0;
  let totalPayments = 0;
  for (let i = 1; i <= n; i++) {
    const b = installmentBreakdown(balance, rate, payment, i === n);
    balance = r2(balance - b.principal);
    rows.push({ index: i, payment: b.payment, interest: b.interest, principal: b.principal, balanceAfter: balance });
    totalInterest = r2(totalInterest + b.interest);
    totalPayments = r2(totalPayments + b.payment);
  }
  return {
    periodRate: rate,
    installmentCount: n,
    installmentAmount: payment,
    rows,
    totalInterest,
    totalInstallmentPayments: totalPayments,
  };
}

/**
 * Eski modelle yazılmış sözleşmeyi (toplam faiz taksite bastan eklenmis, odeme gununde tahakkuk yeniden
 * eklenmis) yeni annuite modeline cevirir. Kalan anapara AYNI kalir; yalnizca taksit tutari kalan anapara ve
 * kalan taksit sayisindan yeniden hesaplanir, bu yuzden eski kayitli krediler aniden patlamaz.
 * Zaten yeni modeldeki sozlesmeye dokunmaz (idempotent). Verilen nesne yerinde guncellenir.
 */
export function migrateLegacyLoanContract(loan: LoanContract): LoanContract {
  if (loan.amortizationModel === 'ANNUITY_V2') return loan;
  const freq = Math.max(1, loan.installmentFrequency || 30);
  const totalCount = Math.max(1, Math.floor((loan.termInGameDays || freq) / freq));
  const principal = Math.max(0, loan.principal);
  const paidShare = principal > 0 ? Math.min(1, Math.max(0, (principal - loan.remainingPrincipal) / principal)) : 1;
  const paidEstimate = Math.min(totalCount - 1, Math.round(paidShare * totalCount));
  const remainingCount = Math.max(1, totalCount - paidEstimate);
  const rate = loanPeriodRate(loan.annualInterestRate, freq);
  loan.amortizationModel = 'ANNUITY_V2';
  loan.installmentCount = totalCount;
  loan.paidInstallmentCount = totalCount - remainingCount;
  loan.accruedLateFeeUnpaid = loan.accruedLateFeeUnpaid ?? 0;
  loan.installmentAmount = annuityPayment(loan.remainingPrincipal, rate, remainingCount);
  return loan;
}
