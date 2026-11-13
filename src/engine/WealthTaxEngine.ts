/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SERVET VERGİSİ: her 30 günde bir, nakit + hisse − borç toplamının eşiği aşan kısmından alınır.
 * Para tek cüzdandan (WalletEngine) çıkar ve merkezi deftere vergi ödemesi olarak yazılır.
 * Nakit yetmezse kalan kısım kişisel kısa vadeli borca eklenir (faizi işler).
 */

import { WEALTH_TAX_PERIOD_DAYS } from '../data/gameBalance';
import type { SimulationState } from '../models/simulation';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';
import { wealthTaxBase, wealthTaxForPeriod } from './TaxRules';
import { WalletEngine } from './WalletEngine';

export function chargeWealthTaxIfDue(state: SimulationState, reservedCash: number): string | null {
  if (state.day <= 0 || state.day % WEALTH_TAX_PERIOD_DAYS !== 0) return null;
  if (state.wealthTax && state.wealthTax.lastDay === state.day) return null;
  const base = wealthTaxBase(state);
  const due = wealthTaxForPeriod(base);
  const record = state.wealthTax ?? { totalPaid: 0, lastDay: 0, lastAmount: 0, lastBase: 0 };
  record.lastDay = state.day;
  record.lastBase = Math.round(base);
  record.lastAmount = due;
  state.wealthTax = record;
  if (due <= 0) return null;

  const spendable = Math.max(0, (state.investmentCash ?? state.cash) - reservedCash);
  const pay = Math.min(due, spendable);
  if (pay > 0) {
    WalletEngine.spend(state, pay);
    CentralLedgerEngine.recordPostedAccountingEntry(state, {
      idempotencyKey: `WEALTH-TAX-D${state.day}`,
      sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      destinationAccountId: ACCOUNT_IDS.TAX_LIABILITY,
      amount: pay,
      category: 'TAX_PAYMENT',
      description: `Gün ${state.day} servet vergisi`,
      reservedOrderCash: reservedCash,
    });
  }
  const unpaid = Number((due - pay).toFixed(2));
  if (unpaid > 0) {
    state.shortTermDebt = Number(((state.shortTermDebt ?? 0) + unpaid).toFixed(2));
    state.totalDebt = Number(((state.totalDebt ?? 0) + unpaid).toFixed(2));
  }
  record.totalPaid = Number((record.totalPaid + due).toFixed(2));
  return unpaid > 0
    ? `Servet vergisi: ₺${Math.round(due).toLocaleString('tr-TR')} (₺${Math.round(unpaid).toLocaleString('tr-TR')} nakit yetmediği için borca yazıldı).`
    : `Servet vergisi ödendi: ₺${Math.round(due).toLocaleString('tr-TR')}.`;
}
