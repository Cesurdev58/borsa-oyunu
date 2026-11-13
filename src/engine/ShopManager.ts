/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DÜKKÂN MÜDÜRÜ
 * - Dükkân en az MANAGER_MIN_SHOP_LEVEL seviyesindeyse müdür tutulabilir (kişisel nakitten işe alma ücreti).
 * - Müdürün maaşı dükkânın günlük personel giderine eklenir (TradeAndShopEngine, todayPayrollCost).
 * - Her gün kapanışında (DayCloseProcessor, ticaret adımından sonra) müdür:
 *     1. Rafları "Rafları doldur" planıyla, YALNIZCA dükkân kasasındaki parayla doldurur
 *        (kasada birkaç günlük gider payı bırakır; oyuncunun cebine dokunmaz).
 *     2. Kasa çok birikirse fazlasını oyuncuya aktarır (isteğe bağlı).
 * - Para hareketleri mevcut motor fonksiyonlarıyla yapılır (sipariş: TradeProcurement, aktarma: ShopOperations).
 */

import type { SimulationState } from '../models/simulation';
import type { ShopInstance } from '../models/trade';
import {
  MANAGER_CASH_RESERVE_DAYS,
  MANAGER_HIRE_FEE_DAYS,
  MANAGER_MIN_SHOP_LEVEL,
  MANAGER_SWEEP_TRIGGER_MULT,
  MANAGER_WAGE_MULTIPLIER,
} from '../data/gameBalance';
import { SHOP_TEMPLATES } from '../data/tradeCatalog';
import { planShopRestock } from './ShopRestockPlanner';
import { TradeProcurement } from './TradeProcurement';
import { ShopOperations } from './ShopOperations';
import { WalletEngine } from './WalletEngine';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';

export interface ManagerQuote {
  allowed: boolean;
  reasonTR: string;
  dailyWage: number;
  hireFee: number;
  /** Müdürün rahat çalışması için dükkân kasasında olması önerilen para */
  recommendedFloat: number;
  /** İşe alırken cebinden kasaya konacak ek para (önerilenden eksik olan kadar) */
  topUp: number;
}

/** Kasada olması önerilen işletme parası: birkaç günlük gider + rafları bir kez doldurma bedeli. */
export function recommendedWorkingCash(state: SimulationState, shop: ShopInstance, dailyWage: number): number {
  const fixed =
    shop.dailyRent + shop.level * 120 + shop.staffCount * shop.staffDailyWagePerPerson + dailyWage;
  const fullRestock = planShopRestock(state, shop.shopId, Number.MAX_SAFE_INTEGER).totalCost;
  return Math.ceil((fixed * MANAGER_CASH_RESERVE_DAYS * 2 + fullRestock) / 1000) * 1000;
}

export function getManagerQuote(state: SimulationState, shop: ShopInstance, reservedCash: number): ManagerQuote {
  const tpl = SHOP_TEMPLATES[shop.shopType];
  const dailyWage = Math.round(((tpl?.staffDailyWagePerPerson ?? shop.staffDailyWagePerPerson) * MANAGER_WAGE_MULTIPLIER) / 10) * 10;
  const hireFee = dailyWage * MANAGER_HIRE_FEE_DAYS;
  const recommendedFloat = recommendedWorkingCash(state, shop, dailyWage);
  const topUp = Math.max(0, Math.ceil(recommendedFloat - shop.cashAccountBalance));
  const base = { dailyWage, hireFee, recommendedFloat, topUp };
  if (shop.manager) return { allowed: false, reasonTR: 'Bu dükkânın zaten müdürü var.', ...base };
  if (shop.isCompanyBranch) {
    return { allowed: false, reasonTR: 'Şirket şubeleri zaten otomatik beslenir.', ...base };
  }
  if (shop.level < MANAGER_MIN_SHOP_LEVEL) {
    return { allowed: false, reasonTR: `Müdür için dükkân en az ${MANAGER_MIN_SHOP_LEVEL}. seviye olmalı.`, ...base };
  }
  const spendable = Math.max(0, (state.investmentCash ?? state.cash) - reservedCash);
  if (spendable < hireFee + topUp) {
    return { allowed: false, reasonTR: 'İşe alma ücreti ve kasa parası için paran yetmiyor.', ...base };
  }
  return { allowed: true, reasonTR: '', ...base };
}

export function hireManager(
  state: SimulationState,
  shopId: string,
  reservedCash: number
): { success: boolean; message: string } {
  const shop = state.tradeState?.shops.find((s) => s.shopId === shopId);
  if (!shop) return { success: false, message: 'Dükkân bulunamadı.' };
  const q = getManagerQuote(state, shop, reservedCash);
  if (!q.allowed) return { success: false, message: q.reasonTR };
  WalletEngine.spend(state, q.hireFee);
  CentralLedgerEngine.recordPostedAccountingEntry(state, {
    idempotencyKey: `MGR-HIRE-${shop.shopId}-D${state.day}`,
    sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    destinationAccountId: ACCOUNT_IDS.PAYROLL_EXPENSE,
    amount: q.hireFee,
    category: 'PAYROLL_PAYMENT',
    description: `${shop.nameTR} için müdür işe alındı`,
    reservedOrderCash: reservedCash,
  });
  if (q.topUp > 0) {
    ShopOperations.transferBetweenPersonalAndShopCash(state, {
      shopId: shop.shopId,
      amount: q.topUp,
      direction: 'PERSONAL_TO_SHOP',
      reservedOrderCash: reservedCash,
    });
  }
  shop.manager = {
    hiredDay: state.day,
    dailyWage: q.dailyWage,
    sweepProfits: true,
    lastActionTR: 'Yeni başladı',
    totalSweptToPlayer: 0,
    totalRestockSpent: 0,
  };
  return {
    success: true,
    message:
      q.topUp > 0
        ? `${shop.nameTR} artık müdürle çalışıyor. Kasaya ₺${q.topUp.toLocaleString('tr-TR')} işletme parası kondu.`
        : `${shop.nameTR} artık müdürle çalışıyor.`,
  };
}

export function fireManager(state: SimulationState, shopId: string): { success: boolean; message: string } {
  const shop = state.tradeState?.shops.find((s) => s.shopId === shopId);
  if (!shop || !shop.manager) return { success: false, message: 'Bu dükkânda müdür yok.' };
  delete shop.manager;
  return { success: true, message: `${shop.nameTR} müdürü ayrıldı; dükkânı yine sen yönetiyorsun.` };
}

export function setManagerSweep(state: SimulationState, shopId: string, on: boolean): { success: boolean; message: string } {
  const shop = state.tradeState?.shops.find((s) => s.shopId === shopId);
  if (!shop || !shop.manager) return { success: false, message: 'Bu dükkânda müdür yok.' };
  shop.manager.sweepProfits = on;
  return { success: true, message: on ? 'Müdür fazla kârı sana gönderecek.' : 'Kâr dükkân kasasında birikecek.' };
}

/** Dükkânın bir günlük sabit gideri (kira + maaşlar + müdür) */
export function dailyFixedCost(shop: ShopInstance): number {
  return (
    shop.dailyRent +
    shop.level * 120 +
    shop.staffCount * shop.staffDailyWagePerPerson +
    (shop.manager?.dailyWage ?? 0)
  );
}

/** Gün kapanışında bütün müdürlü dükkânları çalıştırır; bildirim mesajları döndürür. */
export function runManagers(state: SimulationState, reservedCash: number): string[] {
  const shops = state.tradeState?.shops ?? [];
  const messages: string[] = [];
  for (const shop of shops) {
    const m = shop.manager;
    if (!m) continue;
    const reserve = dailyFixedCost(shop) * MANAGER_CASH_RESERVE_DAYS;
    const parts: string[] = [];

    // 1. Rafları yalnızca dükkân kasasıyla doldur
    const budget = Math.max(0, (shop.cashAccountBalance - reserve) * 0.97);
    if (budget > 0) {
      const plan = planShopRestock(state, shop.shopId, budget);
      let spent = 0;
      for (const o of plan.orders) {
        if (o.estimatedCost > shop.cashAccountBalance - reserve) continue;
        const before = shop.cashAccountBalance;
        const res = TradeProcurement.placeProcurementOrder(state, {
          supplierId: o.supplierId,
          resourceId: o.resourceId,
          quantity: o.quantity,
          targetDestinationType: 'SHOP',
          targetDestinationId: shop.shopId,
          paymentMethod: 'CASH',
          reservedOrderCash: reservedCash,
          idempotencyKey: `MGR-ORD-${shop.shopId}-D${state.day}-${o.resourceId}`,
        });
        if (res.success) spent += Math.max(0, before - shop.cashAccountBalance);
      }
      if (spent > 0) {
        m.totalRestockSpent = Number((m.totalRestockSpent + spent).toFixed(2));
        parts.push(`₺${Math.round(spent).toLocaleString('tr-TR')} mal aldı`);
      }
    }

    // 2. Fazla kârı oyuncuya aktar
    if (m.sweepProfits && shop.cashAccountBalance > reserve * MANAGER_SWEEP_TRIGGER_MULT) {
      const amount = Math.floor(shop.cashAccountBalance - reserve * 2);
      if (amount > 0) {
        const res = ShopOperations.transferBetweenPersonalAndShopCash(state, {
          shopId: shop.shopId,
          amount,
          direction: 'SHOP_TO_PERSONAL',
          reservedOrderCash: reservedCash,
        });
        if (res.success) {
          m.totalSweptToPlayer = Number((m.totalSweptToPlayer + amount).toFixed(2));
          parts.push(`₺${amount.toLocaleString('tr-TR')} kâr gönderdi`);
        }
      }
    }

    const shelfUnits = shop.inventoryBatches.reduce((a, b) => a + b.quantity, 0);
    if (budget <= 0 && shelfUnits < shop.shelfCapacity * 0.25) {
      m.lowCash = true;
      parts.push('kasa boş, mal alamıyor');
    } else {
      m.lowCash = false;
    }
    m.lastActionTR = parts.length ? parts.join(' · ') : 'Her şey yolunda';
    if (parts.length) messages.push(`${shop.nameTR} müdürü: ${m.lastActionTR}`);
  }
  return messages;
}
