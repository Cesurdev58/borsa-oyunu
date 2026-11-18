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
  PRESTIGE_MAX_STARS,
  PRESTIGE_MIN_NET_WORTH,
  PRESTIGE_REWARD_PCT_PER_STAR,
  PRESTIGE_STAR_THRESHOLDS,
  PRESTIGE_START_CASH_PER_STAR,
} from '../data/gameBalance';
import type { SimulationState } from '../models/simulation';

export interface PrestigeState {
  stars: number;
  /** Kaç kez yeni şehre geçildi */
  cities: number;
  /** Bırakılan en büyük servet */
  bestNetWorth: number;
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

export function prestigeBonuses(stars: number): { startCash: number; customerMult: number; rewardMult: number } {
  const s = Math.max(0, Math.min(PRESTIGE_MAX_STARS, stars));
  return {
    startCash: BASE_START_CASH + s * PRESTIGE_START_CASH_PER_STAR,
    customerMult: 1 + (s * PRESTIGE_CUSTOMER_PCT_PER_STAR) / 100,
    rewardMult: 1 + (s * PRESTIGE_REWARD_PCT_PER_STAR) / 100,
  };
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
  };
  const seed = ((old.seed ?? 1) * 31 + 7919 * next.cities) >>> 0 || 1;
  const engine = makeEngine(seed, prestigeBonuses(next.stars).startCash);
  const st = engine.getState();
  st.prestige = next;
  st.realMinutesPerGameDay = old.realMinutesPerGameDay;
  st.fastStartTempo = old.fastStartTempo;
  return {
    success: true,
    message: `Yeni şehir! ${earned > 0 ? `+${earned} yıldız kazandın, ` : ''}toplam ${next.stars} yıldız.`,
    engine,
    starsEarned: earned,
  };
}
