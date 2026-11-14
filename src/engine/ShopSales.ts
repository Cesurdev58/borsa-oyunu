/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dükkân satışları gün içinde, dükkânın açık saatlerine yayılarak parça parça gerçekleşir.
 *
 * - Gün içi adım (`stepShopsIntraday`) açık saatlerin geçen kısmı kadar satış yapar; satış parası
 *   kişisel dükkânın kasasına hemen girer (şirket şubelerinde gün sonunda şirkete yazılır).
 * - Gün kapanışı (`finishShopDay`) günün kalan kısmını tamamlar (hızlı ilerletme/çevrimdışı ilerlemede
 *   bütün gün burada satılır) ve günün toplamını döndürür. Giderler gece düşer.
 * - Günlük toplam talep eskisiyle aynı formüldür; yalnızca saatlere bölünür, denge değişmez.
 *
 * Bu dosya ön yüzü (TradeAndShopEngine) içe aktarmaz; yalnızca alt modülleri kullanır.
 */

import { SHOP_SAME_TYPE_CROWDING } from '../data/gameBalance';
import { RESOURCE_CATALOG, SHOP_TEMPLATES } from '../data/tradeCatalog';
import { shopHoursFor } from '../data/shopHours';
import type { SimulationState } from '../models/simulation';
import type { ShopInstance, ShopLiveDay, TradeUniverseState } from '../models/trade';
import { TradeInventory } from './TradeInventory';

const r2 = (v: number) => Number(v.toFixed(2));

/** Dışarıdan (ör. olağanüstü olaylar) dükkân talebine eklenecek çarpan. */
export type ShopDemandHook = (state: SimulationState, shop: ShopInstance) => number;
let extraDemandHook: ShopDemandHook | null = null;
export function setShopDemandHook(hook: ShopDemandHook | null): void {
  extraDemandHook = hook;
}

export function emptyLiveDay(day: number): ShopLiveDay {
  return {
    day,
    processedFrac: 0,
    walkIn: 0,
    served: 0,
    unmet: 0,
    units: 0,
    revenue: 0,
    cogs: 0,
    creditedRevenue: 0,
    carry: {},
  };
}

/** Gün içi dakikada (0–1440) dükkânın açık saatlerinin ne kadarı geçti (0–1). */
export function openFractionElapsed(shopType: string, minutesIntoDay: number): number {
  const h = shopHoursFor(shopType);
  const open = h.open * 60;
  const close = h.close * 60;
  const m = Math.max(0, Math.min(1440, minutesIntoDay));
  if (m <= open) return 0;
  if (m >= close) return 1;
  return (m - open) / (close - open);
}

function ensureLive(shop: ShopInstance, day: number): ShopLiveDay {
  if (!shop.live || shop.live.day !== day) shop.live = emptyLiveDay(day);
  return shop.live;
}

interface DailyDemand {
  customers: number;
  items: Array<{ resId: string; units: number; price: number }>;
}

/** Bir günün toplam talebi (eski günlük formülün aynısı; o anki raf çeşidine göre). */
export function computeShopDailyDemand(
  state: SimulationState,
  ts: TradeUniverseState,
  shop: ShopInstance
): DailyDemand {
  const tpl = SHOP_TEMPLATES[shop.shopType];
  const stockedResourceIds = Array.from(
    new Set(
      shop.inventoryBatches.filter((b) => b.availableQuantity > 0).map((b) => b.resourceId)
    )
  );
  shop.specificState.activeCategoryCount = stockedResourceIds.length;

  const staffAdequacyRatio = Math.min(1.25, shop.staffCount / Math.max(1, shop.minStaffRequired));
  const satisfactionFactor = 0.65 + (shop.customerSatisfaction / 100) * 0.55;
  const reputationFactor = 0.75 + (ts.tradeReputationScore / 100) * 0.45;
  const macroFactor = Math.max(
    0.75,
    Math.min(1.25, 0.95 + (state.macro.gdpGrowthRate - 0.025) * 1.5)
  );

  let eventDemandMult = 1.0;
  for (const ev of ts.activeTradeEvents) {
    if (ev.isActive) eventDemandMult *= ev.demandImpactMultiplier;
  }
  if (!(Number.isFinite(eventDemandMult) && eventDemandMult > 0)) eventDemandMult = 1;

  let mechanicDemandMultiplier = 1.0;
  if (shop.shopType === 'MARKET') {
    mechanicDemandMultiplier = 0.85 + Math.min(5, stockedResourceIds.length) * 0.12;
  } else if (shop.shopType === 'KAFE') {
    const tableFactor = Math.min(1.6, (shop.specificState.tableCount || 12) / 12);
    mechanicDemandMultiplier = 0.9 * tableFactor;
  } else if (shop.shopType === 'GIYIM_MAGAZASI') {
    const isHighSeason = state.day % 14 < 8;
    shop.specificState.seasonalCollectionActive = isHighSeason;
    mechanicDemandMultiplier = isHighSeason ? 1.22 : 0.92;
  } else if (shop.shopType === 'ELEKTRONIK_MAGAZASI') {
    mechanicDemandMultiplier = 1.0 + (shop.specificState.warrantySatisfactionBonus || 8) * 0.015;
  } else if (shop.shopType === 'MOBILYA_MAGAZASI') {
    mechanicDemandMultiplier = 0.95 + (shop.specificState.deliveryServiceCapacity || 10) * 0.02;
  } else if (shop.shopType === 'OTOMOBIL_GALERISI') {
    mechanicDemandMultiplier = 0.85 + (shop.specificState.showroomSlots || 6) * 0.04;
  }

  const sameTypeCount = ts.shops.filter((x) => x.shopType === shop.shopType).length;
  const crowdingFactor = 1 / (1 + SHOP_SAME_TYPE_CROWDING * Math.max(0, sameTypeCount - 1));
  const hookMult = extraDemandHook ? extraDemandHook(state, shop) : 1;
  const customers = Math.max(
    1,
    Math.round(
      shop.maxCustomerCapacity *
        0.68 *
        crowdingFactor *
        staffAdequacyRatio *
        satisfactionFactor *
        reputationFactor *
        macroFactor *
        eventDemandMult *
        mechanicDemandMultiplier *
        (shop.demandBoost && shop.demandBoost.untilDay >= state.day ? shop.demandBoost.multiplier : 1) *
        (Number.isFinite(hookMult) && hookMult > 0 ? hookMult : 1)
    )
  );

  const items: DailyDemand['items'] = [];
  for (const resId of stockedResourceIds) {
    const resDef = RESOURCE_CATALOG[resId];
    if (!resDef) continue;
    const fairRetailPrice = r2(resDef.baseMarketPrice * (1 + tpl.defaultGrossMarginPct / 100));
    const actualSellPrice = shop.sellingPrices[resId] ?? fairRetailPrice;
    const priceRatio = actualSellPrice / Math.max(1, fairRetailPrice);
    const priceElasticity =
      priceRatio <= 1.0
        ? Math.min(1.35, 1 + (1 - priceRatio) * 0.8)
        : Math.max(0.08, Math.pow(1 / priceRatio, 2.3));
    const shareOfCustomers = 1 / Math.max(1, stockedResourceIds.length);
    // Müşteri başına sepet tutarı (TL) ürünler arasında eşit bölünür.
    const unitsPerCustomer = tpl.avgBasketValueTL / Math.max(1, fairRetailPrice);
    const units = Math.max(
      1,
      Math.round(customers * shareOfCustomers * unitsPerCustomer * priceElasticity)
    );
    items.push({ resId, units, price: actualSellPrice });
  }
  return { customers, items };
}

/**
 * Günün `frac` kadarlık dilimini sat (0–1). Satış parası kişisel dükkânda kasaya hemen girer.
 * Raflar boşsa talep "karşılanamayan müşteri" olarak birikir.
 */
function sellSlice(
  state: SimulationState,
  ts: TradeUniverseState,
  shop: ShopInstance,
  live: ShopLiveDay,
  frac: number,
  creditCash: boolean
): void {
  if (frac <= 0) return;
  const demand = computeShopDailyDemand(state, ts, shop);
  const custCarryKey = '__customers';
  const custExact = demand.customers * frac + (live.carry[custCarryKey] ?? 0);
  const custWhole = Math.max(0, Math.round(custExact));
  live.carry[custCarryKey] = custExact - custWhole;
  live.walkIn += custWhole;

  if (demand.items.length === 0) {
    // Eski davranış: raf boşken bütün müşteriler karşılanamaz
    live.unmet += custWhole;
    return;
  }

  let sliceRevenue = 0;
  for (const it of demand.items) {
    const exact = it.units * frac + (live.carry[it.resId] ?? 0);
    const want = Math.max(0, Math.round(exact));
    live.carry[it.resId] = exact - want;
    if (want <= 0) continue;
    const avail = TradeInventory.getAvailableResourceUnits(shop.inventoryBatches, it.resId);
    const sold = Math.min(avail, want);
    live.unmet += Math.max(0, want - sold);
    if (sold <= 0) continue;
    const consumed = TradeInventory.consumeFromInventoryBatches(shop.inventoryBatches, it.resId, sold);
    const rev = r2(consumed.consumedUnits * it.price);
    live.units += consumed.consumedUnits;
    live.served += consumed.consumedUnits;
    live.revenue = r2(live.revenue + rev);
    live.cogs = r2(live.cogs + consumed.totalCostBasis);
    sliceRevenue += rev;
  }
  shop.inventoryBatches = shop.inventoryBatches.filter((b) => b.quantity > 0);

  if (creditCash && sliceRevenue > 0 && !shop.isCompanyBranch) {
    shop.cashAccountBalance = r2(shop.cashAccountBalance + sliceRevenue);
    live.creditedRevenue = r2(live.creditedRevenue + sliceRevenue);
  }
}

/**
 * Gün içi adım: her dükkân, açık saatlerinin geçen kısmı kadar satar.
 * `minutesIntoDay` günün o anki dakikasıdır (0–1440).
 */
export function stepShopsIntraday(state: SimulationState, minutesIntoDay: number): void {
  const ts = state.tradeState;
  if (!ts || !ts.shops || ts.shops.length === 0) return;
  for (const shop of ts.shops) {
    const live = ensureLive(shop, state.day);
    const target = openFractionElapsed(shop.shopType, minutesIntoDay);
    const delta = target - live.processedFrac;
    if (delta <= 1e-6) continue;
    sellSlice(state, ts, shop, live, delta, true);
    live.processedFrac = target;
  }
}

export interface ShopDayTotals {
  walkIn: number;
  served: number;
  unmet: number;
  units: number;
  revenue: number;
  cogs: number;
  /** Gün içinde kasaya girmemiş, gün sonunda yazılacak satış */
  uncreditedRevenue: number;
}

/**
 * Gün kapanışı: biten günün kalan kısmını sat ve günün toplamını döndür; canlı sayaçları sıfırla.
 * `closedDay` biten gündür (kapanışta `state.day` zaten bir sonraki güne geçmiştir).
 */
export function finishShopDay(
  state: SimulationState,
  ts: TradeUniverseState,
  shop: ShopInstance,
  closedDay: number
): ShopDayTotals {
  const live = ensureLive(shop, closedDay);
  const remaining = 1 - live.processedFrac;
  if (remaining > 1e-6) {
    // Kalan dilimde para kasaya ayrıca yazılmaz; gün sonu hesabı toplamı kasaya geçirir.
    sellSlice(state, ts, shop, live, remaining, false);
    live.processedFrac = 1;
  }
  const totals: ShopDayTotals = {
    walkIn: live.walkIn,
    served: Math.min(live.served, Math.max(1, live.walkIn)),
    unmet: live.unmet,
    units: live.units,
    revenue: r2(live.revenue),
    cogs: r2(live.cogs),
    uncreditedRevenue: r2(live.revenue - live.creditedRevenue),
  };
  shop.live = emptyLiveDay(state.day);
  return totals;
}

/** Arayüz için: bugün şu ana kadarki satış ve tahmini kâr (giderler açık saatlere orantılı). */
export function liveShopToday(
  shop: ShopInstance,
  day: number,
  minutesIntoDay: number
): { revenue: number; profit: number; customers: number } {
  const live = shop.live && shop.live.day === day ? shop.live : emptyLiveDay(day);
  const expenses =
    shop.staffCount * shop.staffDailyWagePerPerson +
    (shop.manager ? shop.manager.dailyWage : 0) +
    shop.dailyRent +
    shop.level * 120;
  const dayFrac = Math.max(0, Math.min(1, minutesIntoDay / 1440));
  return {
    revenue: r2(live.revenue),
    profit: r2(live.revenue - live.cogs - expenses * dayFrac),
    customers: Math.min(live.served, live.walkIn),
  };
}
