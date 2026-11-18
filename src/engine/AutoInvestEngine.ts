/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PORTFÖY YÖNETİCİSİ (AutoInvestEngine) — borsa otomasyonu
 * Oyuncu bir kez ücret ödeyip portföy yöneticisi tutar. Açıkken her gün kapanışında kenarda tutulacak
 * paranın (reserve) üstündeki kişisel nakit, borsadaki bütün şirketlere (oyuncunun kendi şirketi ve
 * devraldıkları hariç) eşit dağıtılır. Normal alım gibi komisyon ve fiyat etkisi vardır; borsadan
 * normal alımla sahiplik sınırı (%30) aşılmaz.
 * Kendi başına yapılabilecekten fazla kazandırmaz; boşta duran parayı çalıştırır (ölçüldü: "ucuz hisse
 * gösteren analist" fikri borsa getirisini ~2 katına çıkarıyordu, garanti kazanç olacağı için eklenmedi).
 * Kayıtta `state.autoInvest` (eski kayıtlarda yoktur). Ayarlar `data/gameBalance.ts` → AUTO_INVEST_*.
 * Bu dosya SimulationEngine'i yalnızca tip olarak içe aktarır (döngü oluşmaz).
 */
import { AUTO_INVEST_DEFAULT_RESERVE, AUTO_INVEST_HIRE_FEE, AUTO_INVEST_MIN_CHUNK } from '../data/gameBalance';
import type { SimulationEngine } from './SimulationEngine';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';
import { MarketEngine } from './MarketEngine';
import * as OrderBookProcessor from './OrderBookProcessor';
import { WalletEngine } from './WalletEngine';

export interface AutoInvestState {
  hired: boolean;
  enabled: boolean;
  reserve: number;
  /** Bugüne kadar yatırılan toplam (bilgi için) */
  totalInvested: number;
}

export function getAutoInvest(engine: SimulationEngine): AutoInvestState {
  return (
    engine.state.autoInvest ?? { hired: false, enabled: false, reserve: AUTO_INVEST_DEFAULT_RESERVE, totalInvested: 0 }
  );
}

export function hirePortfolioManager(engine: SimulationEngine): { success: boolean; message: string } {
  const cur = getAutoInvest(engine);
  if (cur.hired) return { success: false, message: 'Portföy yöneticin zaten var.' };
  if (engine.getSpendableCash() < AUTO_INVEST_HIRE_FEE) {
    return { success: false, message: `Portföy yöneticisi için ₺${AUTO_INVEST_HIRE_FEE.toLocaleString('tr-TR')} gerekiyor.` };
  }
  WalletEngine.spend(engine.state, AUTO_INVEST_HIRE_FEE);
  CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
    idempotencyKey: `AUTO-INVEST-HIRE-${engine.state.day}`,
    sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    destinationAccountId: ACCOUNT_IDS.OPERATING_EXPENSE,
    amount: AUTO_INVEST_HIRE_FEE,
    category: 'OPERATING_EXPENSE_PAYMENT',
    description: 'Portföy yöneticisi işe alındı',
    reservedOrderCash: engine.getReservedCash(),
  });
  engine.state.autoInvest = { ...cur, hired: true, enabled: true };
  return { success: true, message: 'Portföy yöneticisi işe alındı. Kenardaki paranın fazlasını her gün sonunda borsaya yatıracak.' };
}

export function configureAutoInvest(
  engine: SimulationEngine,
  params: { enabled?: boolean; reserve?: number }
): { success: boolean; message: string } {
  const cur = getAutoInvest(engine);
  if (!cur.hired) return { success: false, message: 'Önce portföy yöneticisi tutmalısın.' };
  const reserve =
    typeof params.reserve === 'number' && Number.isFinite(params.reserve)
      ? Math.max(0, Math.round(params.reserve))
      : cur.reserve;
  const enabled = typeof params.enabled === 'boolean' ? params.enabled : cur.enabled;
  engine.state.autoInvest = { ...cur, reserve, enabled };
  return {
    success: true,
    message: enabled
      ? `Portföy yöneticisi açık: ₺${reserve.toLocaleString('tr-TR')} kenarda kalacak, fazlası borsaya.`
      : 'Portföy yöneticisi durduruldu.',
  };
}

/** Gün kapanışında çağrılır: kenardaki paranın fazlasını eşit sepete yatırır. */
export function runAutoInvest(engine: SimulationEngine): string | null {
  const cur = engine.state.autoInvest;
  if (!cur || !cur.hired || !cur.enabled) return null;
  const excess = engine.getSpendableCash() - cur.reserve;
  if (excess < AUTO_INVEST_MIN_CHUNK) return null;
  const picks = engine.state.stocks.filter((s) => !s.isPlayerCompany && !s.isControlledByPlayer);
  if (picks.length === 0) return null;
  const per = (excess * 0.99) / picks.length;
  let spent = 0;
  for (const s of picks) {
    const owned = engine.state.portfolio[s.ticker]?.shares ?? 0;
    const room = MarketEngine.maxMarketBuyableShares(s, owned);
    const lots = Math.min(room, Math.floor(per / (s.price * 1.01)));
    if (lots <= 0) continue;
    const r = OrderBookProcessor.buyStock(engine, s.ticker, lots);
    if (r.success) spent += r.totalCost;
  }
  if (spent <= 0) return null;
  engine.state.autoInvest = { ...cur, totalInvested: Math.round((cur.totalInvested + spent) * 100) / 100 };
  return `Portföy yöneticisi ₺${Math.round(spent).toLocaleString('tr-TR')} borsaya yatırdı.`;
}
