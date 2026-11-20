/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GÖSTERİŞ HARCAMALARI (LifestyleEngine)
 * Veri `data/lifestyle.ts`. Alınanlar `state.lifestyle.owned` (eski kayıtlarda yoktur).
 * Ödeme tek cüzdan kuralıyla (WalletEngine + merkezi defter). İtibar `tradeState.tradeReputationScore`'a eklenir.
 * Yalnızca veri, modeller ve alt motorları içe aktarır (döngü oluşmaz).
 */
import { LIFESTYLE_ITEMS, REPUTATION_MAX } from '../data/lifestyle';
import type { SimulationState } from '../models/simulation';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';
import { TradeUniverse } from './TradeUniverse';
import { WalletEngine } from './WalletEngine';

export function ownedLifestyle(state: Pick<SimulationState, 'lifestyle'>): string[] {
  return state.lifestyle?.owned ?? [];
}

export function buyLifestyleItem(
  state: SimulationState,
  itemId: string,
  reservedCash: number
): { success: boolean; message: string } {
  const def = LIFESTYLE_ITEMS.find((x) => x.id === itemId);
  if (!def) return { success: false, message: 'Böyle bir şey satılmıyor.' };
  const owned = ownedLifestyle(state);
  if (owned.includes(def.id)) return { success: false, message: `${def.name} zaten senin.` };
  // Kısıtlı işletme kredisi bakiyesi lüks harcamaya kullanılamaz
  const spendable = Math.max(0, WalletEngine.freeCash(state) - reservedCash);
  if (spendable < def.price) {
    return { success: false, message: `${def.name} için ₺${def.price.toLocaleString('tr-TR')} nakit gerekiyor.` };
  }
  WalletEngine.spend(state, def.price);
  CentralLedgerEngine.recordPostedAccountingEntry(state, {
    idempotencyKey: `LIFESTYLE-${def.id}`,
    sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    destinationAccountId: ACCOUNT_IDS.OPERATING_EXPENSE,
    amount: def.price,
    category: 'OPERATING_EXPENSE_PAYMENT',
    description: `Gösteriş harcaması: ${def.name}`,
    reservedOrderCash: reservedCash,
  });
  const ts = TradeUniverse.ensureTradeUniverseState(state);
  const before = ts.tradeReputationScore;
  ts.tradeReputationScore = Math.min(REPUTATION_MAX, Math.round((before + def.reputation) * 10) / 10);
  state.lifestyle = {
    owned: [...owned, def.id],
    spent: Math.round(((state.lifestyle?.spent ?? 0) + def.price) * 100) / 100,
  };
  return {
    success: true,
    message: `${def.name} artık senin! Ticari itibar ${Math.round(before)} → ${Math.round(ts.tradeReputationScore)}.`,
  };
}
