/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * VERGİ KURALLARI (yalnızca hesap; para hareketi yapmaz)
 * - Kademeli kurumlar vergisi (oyuncu şirketi)
 * - Servet vergisi tutarı
 */

import {
  CORPORATE_TAX_BRACKETS,
  WEALTH_TAX_ANNUAL_RATE,
  WEALTH_TAX_FREE_AMOUNT,
  WEALTH_TAX_PERIOD_DAYS,
} from '../data/gameBalance';

/** Günlük vergi öncesi kâra dilimli vergi. İlk dilim temel orandır, üst dilimlere ek oran eklenir. */
export function progressiveCorporateTax(dailyPreTax: number, baseRate: number): number {
  if (!(dailyPreTax > 0)) return 0;
  let tax = 0;
  let lower = 0;
  for (const b of CORPORATE_TAX_BRACKETS) {
    const upper = b.upToDaily;
    if (dailyPreTax <= lower) break;
    const slice = Math.min(dailyPreTax, upper) - lower;
    tax += slice * (baseRate + b.extraRate);
    lower = upper;
  }
  return tax;
}

/** Ortalama (etkin) kurumlar vergisi oranı, arayüzde göstermek için */
export function effectiveCorporateTaxRate(dailyPreTax: number, baseRate: number): number {
  if (!(dailyPreTax > 0)) return baseRate;
  return progressiveCorporateTax(dailyPreTax, baseRate) / dailyPreTax;
}

/**
 * Servet vergisi matrahı: nakit + hisse senetleri + holding kasası + şirkete verilen ortak borcu
 * + kişisel dükkân kasaları − borç. Şirketin kendi kasası ve dükkânların değeri dahil değildir.
 * (Vergi gününden önce parayı dükkân kasasına ya da ortak borcuna park edip kaçmak işe yaramaz.)
 */
export function wealthTaxBase(st: {
  cash: number;
  portfolioValue: number;
  totalDebt: number;
  holdingCash?: number;
  playerCompany?: { shareholderLoanBalance?: number } | null;
  tradeState?: { shops: { isCompanyBranch: boolean; cashAccountBalance: number }[] } | null;
}): number {
  const shopCash = (st.tradeState?.shops ?? [])
    .filter((s) => !s.isCompanyBranch)
    .reduce((sum, s) => sum + Math.max(0, s.cashAccountBalance || 0), 0);
  return Math.max(
    0,
    (st.cash || 0) +
      (st.portfolioValue || 0) +
      (st.holdingCash || 0) +
      Math.max(0, st.playerCompany?.shareholderLoanBalance ?? 0) +
      shopCash -
      (st.totalDebt || 0)
  );
}

/** Bir dönemlik (30 gün) servet vergisi */
export function wealthTaxForPeriod(base: number): number {
  const taxable = Math.max(0, base - WEALTH_TAX_FREE_AMOUNT);
  return Math.round(taxable * WEALTH_TAX_ANNUAL_RATE * (WEALTH_TAX_PERIOD_DAYS / 360));
}
