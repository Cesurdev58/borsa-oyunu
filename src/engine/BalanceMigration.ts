/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DENGE GÖÇÜ: eski kayıtları yeni geç oyun dengesine bir kez taşır (state.balanceVersion).
 * Sürüm 2: rakip (NPC) şirketler NPC_SCALE katı büyüdü. Hisse fiyatı aynı kalır, böylece
 * oyuncunun elindeki hisselerin değeri değişmez; yalnızca sahiplik yüzdesi küçülür.
 * Eski kayıtta "devralınmış" rakipler, eskiden çok ucuza alındığı için ödenen bedel iade edilerek serbest bırakılır.
 */

import { NPC_COMPANY_BLUEPRINTS } from '../data/npcCompanies';
import { NPC_SCALE } from '../data/gameBalance';
import type { SimulationState } from '../models/simulation';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';
import { CompanyOperations } from './CompanyOperations';
import { MarketEngine } from './MarketEngine';
import { baseSectorMarketUnits } from './SectorMarket';
import { ValuationEngine } from './ValuationEngine';
import { WalletEngine } from './WalletEngine';

export const CURRENT_BALANCE_VERSION = 2;

/** Ölçeklenmeyen (birim başına) bilanço alanları */
const PER_UNIT_FIELDS = new Set([
  'dividendPerShare',
  'dividendPayoutRatio',
  'unitSellingPrice',
  'unitProductionCost',
]);

export function migrateBalance(state: SimulationState): string[] {
  const messages: string[] = [];
  if ((state.balanceVersion ?? 1) >= CURRENT_BALANCE_VERSION) return messages;

  for (const stock of state.stocks ?? []) {
    if (stock.isPlayerCompany) continue;
    const bp = NPC_COMPANY_BLUEPRINTS.find((b) => b.ticker === stock.ticker);
    // Zaten büyük ise (yeni oyun ya da yarım kalmış göç) dokunma
    if (!bp || stock.totalShares >= bp.totalShares * NPC_SCALE * 0.5) continue;

    // Eski kayıtta devralınmış rakip: ödenen bedeli iade et, kontrolü bırak
    const pos = state.portfolio?.[stock.ticker];
    if (stock.isControlledByPlayer && pos && pos.shares > 0) {
      const refund = Number((pos.shares * pos.averageCost).toFixed(2));
      if (refund > 0) {
        WalletEngine.earn(state, refund);
        CentralLedgerEngine.recordPostedAccountingEntry(state, {
          idempotencyKey: `BALANCE-V2-REFUND-${stock.ticker}`,
          sourceAccountId: ACCOUNT_IDS.HOLDING_MAIN,
          destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
          amount: refund,
          category: 'HOLDING_CAPITAL_TRANSFER',
          description: `${stock.ticker} devralma bedeli iadesi (yeni denge)`,
          relatedCompanyId: stock.ticker,
          reservedOrderCash: 0,
        });
      }
      delete state.portfolio[stock.ticker];
      stock.isControlledByPlayer = false;
      state.controlledSubsidiaries = (state.controlledSubsidiaries ?? []).filter((t) => t !== stock.ticker);
      messages.push(
        `${stock.name} artık çok daha büyük bir şirket. Eskiden ödediğin ₺${Math.round(refund).toLocaleString('tr-TR')} iade edildi; istersen yeni fiyattan yeniden devralabilirsin.`
      );
    }

    stock.totalShares = stock.totalShares * NPC_SCALE;
    const fin = stock.financials as unknown as Record<string, unknown>;
    for (const key of Object.keys(fin)) {
      const v = fin[key];
      if (typeof v === 'number' && Number.isFinite(v) && !PER_UNIT_FIELDS.has(key)) {
        fin[key] = Number((v * NPC_SCALE).toFixed(2));
      }
    }
    stock.ebitdaAnnual = stock.financials.EBITDA;
    stock.equityValue = Number((stock.price * stock.totalShares).toFixed(2));
    stock.enterpriseValue = Number(
      (stock.equityValue + stock.financials.totalLiabilities - stock.financials.cash).toFixed(2)
    );
    stock.valuation = ValuationEngine.computeCompanyValuation(stock.financials, stock.sector, state.macro, 1.0);
    stock.fundamentalPrice = stock.valuation.fairValuePerShare;

    const owned = state.portfolio?.[stock.ticker]?.shares ?? 0;
    stock.playerOwnershipPct = Number(((owned / stock.totalShares) * 100).toFixed(2));
    stock.controlLevel = MarketEngine.computeControlLevel(stock.playerOwnershipPct);
  }

  const pc = state.playerCompany;
  if (pc && !pc.isBankrupt && pc.operations) {
    // Eski dengede sınırsız büyüyen şirketi yeni pazara göre küçült: satılamayacak üretim ve fazla personel zarar ettirir
    const market = baseSectorMarketUnits(pc.sector);
    const rivals = state.stocks
      .filter((s) => !s.isPlayerCompany && !s.isControlledByPlayer && s.sector === pc.sector)
      .reduce((sum, s) => sum + Math.max(0, s.financials.dailyUnitsSold ?? 0), 0);
    const room = Math.max(market * 0.05, market - rivals) * 0.85;
    const producing = Math.max(pc.operations.actualProduction ?? 0, pc.operations.actualSalesUnits ?? 0);
    if (producing > room * 1.1) {
      const eff = Math.max(0.5, pc.workforcePlan?.workforceEfficiency ?? 1);
      const oldStaff = pc.staffCount;
      const targetStaff = Math.max(5, Math.ceil((room * 1.15) / (2.5 * eff)));
      CompanyOperations.configureOperations(pc, {
        targetStaffCount: Math.min(oldStaff, targetStaff),
        plannedProductionUnits: Math.round(room * 1.05),
      });
      messages.push(
        `Yeni dengede her sektörün pazarı sınırlı. Şirketin artık günde yaklaşık ${Math.round(room).toLocaleString('tr-TR')} birim satabilir; zarar etmesin diye çalışan sayısı ${oldStaff.toLocaleString('tr-TR')} kişiden ${pc.staffCount.toLocaleString('tr-TR')} kişiye indirildi. Daha çok satmak için rakipleri devralabilirsin.`
      );
    } else {
      messages.push(
        'Yeni dengede her sektörün pazarı sınırlı: daha çok satmak için rakip şirketleri devralabilirsin.'
      );
    }
  }
  state.balanceVersion = CURRENT_BALANCE_VERSION;
  return messages;
}
