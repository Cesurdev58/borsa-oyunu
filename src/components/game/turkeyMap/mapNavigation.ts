/**
 * Harita ↔ Şehir Mağazaları gezinmesi (Faz 6) — saf kurallar, arayüzden bağımsız.
 *
 * Akış:  Türkiye Haritası → Şehir Bilgi Paneli → Şehre Git → Şehir Mağazaları → Mağaza Yönetimi
 * Geri:  Mağaza Yönetimi → Şehir Mağazaları → Türkiye Haritası
 * Android geri tuşu sırası: (1) mağaza detayı açıksa kapat, (2) şehir mağazalarındaysa haritaya dön,
 * (3) bilgi paneli açıksa kapat, (4) ana haritadaysa çıkış onayı göster. "Haritaya Dön" düğmesi (2)'nin aynısıdır.
 */
import type { CityId } from '../../../models/cities';
import type { ShopInstance } from '../../../models/trade';
import type { SimulationState } from '../../../models/simulation';
import { isCityId } from '../../../data/cityDefinitions';
import { liveShopToday } from '../../../engine/ShopSales';
import { shopIssueKindsInState } from '../../../engine/CityOpeningQuote';

export type MapScreen = 'MAP' | 'CITY_SHOPS';

export interface MapNavState {
  screen: MapScreen;
  /** CITY_SHOPS ekranında hangi şehir (cityId ile süzülür). */
  cityId?: CityId;
}

export const MAP_ROOT: MapNavState = { screen: 'MAP' };

/** Bir şehirdeki oyuncu dükkânları — YALNIZCA cityId eşleşenler. */
export function shopsInCity(state: SimulationState, cityId: CityId): ShopInstance[] {
  return (state.tradeState?.shops ?? []).filter((s) => s.cityId === cityId);
}

/** "Şehre Git" yalnızca o şehirde en az bir dükkân varken etkindir. */
export function canGoToCity(state: SimulationState, cityId: CityId | undefined): boolean {
  return isCityId(cityId) && shopsInCity(state, cityId).length > 0;
}

/** Şehre git: dükkân yoksa gezinme değişmez (boş ekran açılmaz). */
export function goToCity(nav: MapNavState, state: SimulationState, cityId: CityId): MapNavState {
  return canGoToCity(state, cityId) ? { screen: 'CITY_SHOPS', cityId } : nav;
}

export type BackOutcome =
  | { kind: 'CLOSE_DETAIL' }
  | { kind: 'TO_MAP'; nav: MapNavState }
  | { kind: 'CLOSE_SHEET' }
  | { kind: 'EXIT_CONFIRM' };

export function resolveBack(input: { nav: MapNavState; detailOpen: boolean; sheetOpen: boolean }): BackOutcome {
  if (input.detailOpen) return { kind: 'CLOSE_DETAIL' };
  if (input.nav.screen === 'CITY_SHOPS') return { kind: 'TO_MAP', nav: MAP_ROOT };
  if (input.sheetOpen) return { kind: 'CLOSE_SHEET' };
  return { kind: 'EXIT_CONFIRM' };
}

export interface CityShopsSummary {
  shopCount: number;
  dailyRevenue: number;
  dailyNetProfit: number;
  staffCount: number;
  /** 0–100: raflardaki malın toplam raf kapasitesine oranı. */
  stockHealthPct: number;
  issueCount: number;
}

export function summarizeCityShops(state: SimulationState, cityId: CityId): CityShopsSummary {
  const shops = shopsInCity(state, cityId);
  const nowMin = state.minutesIntoCurrentDay ?? 0;
  let revenue = 0, profit = 0, staff = 0, used = 0, cap = 0, issues = 0;
  for (const s of shops) {
    const t = liveShopToday(s, state.day, nowMin);
    revenue += t.revenue;
    profit += t.profit;
    staff += s.staffCount + (s.ownerWorks ? 1 : 0);
    used += s.inventoryBatches.reduce((a, b) => a + b.quantity, 0);
    cap += Math.max(1, s.shelfCapacity);
    if (shopIssueKindsInState(state, s).length > 0) issues += 1;
  }
  return {
    shopCount: shops.length,
    dailyRevenue: Math.round(revenue),
    dailyNetProfit: Math.round(profit),
    staffCount: staff,
    stockHealthPct: shops.length ? Math.min(100, Math.round((used / cap) * 100)) : 0,
    issueCount: issues,
  };
}
