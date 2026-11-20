/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PRESTİJ: YENİ ŞEHİRDE BAŞLA (PrestigeEngine)
 * Tycoon oyunlarının uzun ömür döngüsü: imparatorluğu bırak, yeni bir şehirde sıfırdan başla,
 * kalıcı yıldızlarla daha hızlı büyü. Ayarlar `data/gameBalance.ts` → PRESTIGE_*.
 * Kayıtta `state.prestige` (eski kayıtlarda yoktur = yıldız yok). Yeni şehirde yalnızca prestij,
 * gün uzunluğu ve hızlı başlangıç ayarı taşınır; dükkânlar, şirket, hisseler, hedefler eski şehirde kalır.
 * Yıldız etkileri: başlangıç parası (burada), dükkân müşterisi (`ShopSales`), hedef ödülü (`CareerGoals`).
 * Yalnızca veri ve modelleri içe aktarır; yeni motoru oluşturan `startNewCity` SimulationEngine'i
 * çağıran tarafa bırakır (döngü olmasın diye fabrika fonksiyonu parametre alır).
 */
import {
  PRESTIGE_CUSTOMER_PCT_PER_STAR,
  PRESTIGE_FIRST_SHOP_DISCOUNT_PCT,
  PRESTIGE_POINTS_PER_STAR,
  PRESTIGE_SHOP_REVENUE_PCT_PER_STAR,
  PRESTIGE_MAX_STARS,
  PRESTIGE_MIN_NET_WORTH,
  PRESTIGE_REWARD_PCT_PER_STAR,
  PRESTIGE_STAR_THRESHOLDS,
  PRESTIGE_START_CASH_PER_STAR,
} from '../data/gameBalance';
import { PERK_CUSTOMER_PCT_PER_LEVEL, PERK_START_CASH_PER_LEVEL, PRESTIGE_PERKS } from '../data/prestigePerks';
import type { SimulationState } from '../models/simulation';

export interface PrestigeState {
  stars: number;
  /** Kaç kez yeni şehre geçildi */
  cities: number;
  /** Bırakılan en büyük servet */
  bestNetWorth: number;
  pointsEarned?: number;
  perks?: Record<string, number>;
}

export const BASE_START_CASH = 100_000;

export function getPrestige(state: Pick<SimulationState, 'prestige'>): PrestigeState {
  return state.prestige ?? { stars: 0, cities: 0, bestNetWorth: 0 };
}

/** Bu servetle yeni şehre geçilirse kazanılacak yıldız (toplam sınır hesaba katılır). */
export function starsEarnedFor(netWorth: number, currentStars: number): number {
  let earned = 0;
  for (const [min, s] of PRESTIGE_STAR_THRESHOLDS) if (netWorth >= min) earned = s;
  return Math.max(0, Math.min(earned, PRESTIGE_MAX_STARS - currentStars));
}

export function canStartNewCity(state: Pick<SimulationState, 'netWorth'>): boolean {
  return state.netWorth >= PRESTIGE_MIN_NET_WORTH;
}

export function perkLevel(p: PrestigeState, id: string): number {
  return Math.max(0, Math.floor(p.perks?.[id] ?? 0));
}

/** Kazanılan toplam puan (eski kayıtta alan yoksa yıldız sayısı kadar). */
export function pointsEarned(p: PrestigeState): number {
  return p.pointsEarned ?? p.stars * PRESTIGE_POINTS_PER_STAR;
}

export function pointsSpent(p: PrestigeState): number {
  let sum = 0;
  for (const perk of PRESTIGE_PERKS) sum += perkLevel(p, perk.id) * perk.cost;
  return sum;
}

export function pointsAvailable(p: PrestigeState): number {
  return Math.max(0, pointsEarned(p) - pointsSpent(p));
}

export function prestigeBonuses(
  stars: number,
  p?: PrestigeState
): { startCash: number; customerMult: number; shopRevenueMult: number; rewardMult: number; firstShopCostMult: number } {
  const s = Math.max(0, Math.min(PRESTIGE_MAX_STARS, stars));
  const cashLv = p ? perkLevel(p, 'cash') : 0;
  const decorLv = p ? perkLevel(p, 'decor') : 0;
  return {
    startCash: BASE_START_CASH + s * PRESTIGE_START_CASH_PER_STAR + cashLv * PERK_START_CASH_PER_LEVEL,
    customerMult: 1 + (s * PRESTIGE_CUSTOMER_PCT_PER_STAR + decorLv * PERK_CUSTOMER_PCT_PER_LEVEL) / 100,
    shopRevenueMult: 1 + (s * PRESTIGE_SHOP_REVENUE_PCT_PER_STAR) / 100,
    rewardMult: 1 + (s * PRESTIGE_REWARD_PCT_PER_STAR) / 100,
    firstShopCostMult: s > 0 ? 1 - PRESTIGE_FIRST_SHOP_DISCOUNT_PCT / 100 : 1,
  };
}

/** Durumdan kısayol: müşteri ve gelir çarpanları dahil bütün kalıcı çarpanlar. */
export function bonusesFor(state: Pick<SimulationState, 'prestige'>) {
  const p = getPrestige(state);
  return prestigeBonuses(p.stars, p);
}

/** İlk kişisel dükkânın kurulum maliyeti çarpanı (yalnızca yıldızı olan oyuncuda ve ilk dükkânda 0,8). */
export function firstShopCostMultiplier(state: Pick<SimulationState, 'prestige' | 'tradeState'>): number {
  const hasShop = (state.tradeState?.shops ?? []).some((x) => !x.isCompanyBranch);
  return hasShop ? 1 : bonusesFor(state).firstShopCostMult;
}

/** Puanla avantaj al. */
export function buyPerk(state: SimulationState, perkId: string): { success: boolean; message: string } {
  const perk = PRESTIGE_PERKS.find((x) => x.id === perkId);
  if (!perk) return { success: false, message: 'Bilinmeyen avantaj.' };
  const cur = getPrestige(state);
  const lv = perkLevel(cur, perk.id);
  if (lv >= perk.maxLevel) return { success: false, message: 'Bu avantaj en üst seviyede.' };
  if (pointsAvailable(cur) < perk.cost) return { success: false, message: 'Yeterli prestij puanın yok.' };
  state.prestige = { ...cur, perks: { ...(cur.perks ?? {}), [perk.id]: lv + 1 } };
  return { success: true, message: `${perk.name} seviye ${lv + 1} oldu.` };
}

/** Haftalık hedef gibi kaynaklardan prestij puanı ekler (en çok 100 puan birikir). */
export function addPrestigePoints(state: SimulationState, points: number): void {
  if (!(points > 0)) return;
  const cur = getPrestige(state);
  state.prestige = { ...cur, pointsEarned: Math.min(100, pointsEarned(cur) + Math.floor(points)) };
}

/**
 * Yeni şehir: eski durumdan prestiji hesaplar, `makeEngine(seed, cash)` ile yeni oyunu kurar ve
 * prestij + ayarları yeni duruma yazar. Yeni şehrin tohumu farklıdır (piyasa ve olaylar değişir).
 */
export function startNewCity<E extends { getState(): SimulationState }>(
  old: SimulationState,
  makeEngine: (seed: number, cash: number) => E
): { success: boolean; message: string; engine?: E; starsEarned: number } {
  if (!canStartNewCity(old)) {
    return {
      success: false,
      message: `Yeni şehre geçmek için toplam varlığın en az ₺${PRESTIGE_MIN_NET_WORTH.toLocaleString('tr-TR')} olmalı.`,
      starsEarned: 0,
    };
  }
  const cur = getPrestige(old);
  const earned = starsEarnedFor(old.netWorth, cur.stars);
  const next: PrestigeState = {
    stars: cur.stars + earned,
    cities: cur.cities + 1,
    bestNetWorth: Math.max(cur.bestNetWorth, Math.round(old.netWorth)),
    pointsEarned: pointsEarned(cur) + earned * PRESTIGE_POINTS_PER_STAR,
    perks: { ...(cur.perks ?? {}) },
  };
  const seed = ((old.seed ?? 1) * 31 + 7919 * next.cities) >>> 0 || 1;
  const engine = makeEngine(seed, prestigeBonuses(next.stars, next).startCash);
  const st = engine.getState();
  st.prestige = next;
  const tickets = perkLevel(next, 'ticket');
  if (tickets > 0) st.trainingTickets = tickets;
  st.realMinutesPerGameDay = old.realMinutesPerGameDay;
  st.fastStartTempo = old.fastStartTempo;
  return {
    success: true,
    message: `Yeni şehir! ${earned > 0 ? `+${earned} yıldız kazandın, ` : ''}toplam ${next.stars} yıldız.`,
    engine,
    starsEarned: earned,
  };
}
