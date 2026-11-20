/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ORTA OYUN KİLOMETRE TAŞLARI (20 dk – 3 saat)
 * İlk dükkândan şirketleşmeye kadar oyuncuyu sıkmayan ara hedeflerin sayaçları ve kalıcı ödülleri.
 *  - Sayaçlar (kârlı gün serisi, en yüksek günlük ciro, toplam müşteri, üst üste faaliyet) her gün kapanışında
 *    `trackMilestonesDayClose` ile güncellenir; biten günün `today*` dükkân sonuçlarını okur, ekonomiyi değiştirmez.
 *  - Ödüller (müşteri bonusu, ücretsiz eğitim, açılış indirimi, dekorasyon) hedef ödülü alınınca `grantBonus` ile verilir.
 * Kayıtta `state.milestones` (eski kayıtta yoktur, `ensureMilestones` ilk kullanımda sıfırdan kurar).
 * Yalnızca modelleri ve denge sabitlerini içe aktarır (döngü oluşmaz).
 */
import type { SimulationState } from '../models/simulation';
import {
  MILESTONE_CUSTOMER_BONUS_PCT,
  MILESTONE_DECORATION_BONUS_PCT,
  MILESTONE_SHOP_OPEN_DISCOUNT_PCT,
  MILESTONE_STREAK_BOOST_DAYS,
  MILESTONE_STREAK_BOOST_MULT,
} from '../data/gameBalance';

export interface MilestoneState {
  /** Ardışık kârlı gün sayısı (zarar ya da sıfır kâr günü seriyi sıfırlar) */
  profitStreak: number;
  bestProfitStreak: number;
  /** Kişisel dükkânların tek günde yaptığı en yüksek toplam satış (₺) */
  bestDailyRevenue: number;
  /** Kişisel dükkânlarda bugüne kadar ağırlanan toplam müşteri */
  totalCustomers: number;
  /** Ardışık "faaliyet" günü: en az bir kişisel dükkân o gün satış yaptı */
  activeStreak: number;
  bestActiveStreak: number;
  /** Sayacın en son işlendiği gün (aynı gün iki kez sayılmaz) */
  lastTrackedDay: number;
  // --- Kalıcı ödüller ---
  /** Kalıcı müşteri artışı (%), bütün kişisel dükkânlar */
  customerBonusPct: number;
  /** Akademide ücretsiz kullanılabilecek eğitim hakkı */
  freeTrainings: number;
  /** Bir sonraki kişisel dükkân açılışında uygulanacak indirim (%; 0 = yok) */
  shopOpenDiscountPct: number;
  /** Alınan dekorasyon/raf ödülleri */
  decorations: string[];
}

export type GoalBonus =
  | { kind: 'CUSTOMER_PCT'; pct: number }
  | { kind: 'FREE_TRAINING'; count: number }
  | { kind: 'SHOP_OPEN_DISCOUNT'; pct: number }
  | { kind: 'DECORATION'; id: string }
  | { kind: 'STREAK_BOOST' };

export function defaultMilestones(): MilestoneState {
  return {
    profitStreak: 0,
    bestProfitStreak: 0,
    bestDailyRevenue: 0,
    totalCustomers: 0,
    activeStreak: 0,
    bestActiveStreak: 0,
    lastTrackedDay: 0,
    customerBonusPct: 0,
    freeTrainings: 0,
    shopOpenDiscountPct: 0,
    decorations: [],
  };
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);

/** Kayıttan gelen (eksik/bozuk olabilen) alanı güvenli hâle getirir. */
export function sanitizeMilestones(raw: unknown): MilestoneState {
  const d = defaultMilestones();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<MilestoneState>;
  return {
    profitStreak: Math.floor(num(r.profitStreak)),
    bestProfitStreak: Math.floor(num(r.bestProfitStreak)),
    bestDailyRevenue: num(r.bestDailyRevenue),
    totalCustomers: Math.floor(num(r.totalCustomers)),
    activeStreak: Math.floor(num(r.activeStreak)),
    bestActiveStreak: Math.floor(num(r.bestActiveStreak)),
    lastTrackedDay: Math.floor(num(r.lastTrackedDay)),
    customerBonusPct: num(r.customerBonusPct),
    freeTrainings: Math.floor(num(r.freeTrainings)),
    shopOpenDiscountPct: Math.min(100, num(r.shopOpenDiscountPct)),
    decorations: Array.isArray(r.decorations) ? r.decorations.filter((x) => typeof x === 'string') : [],
  };
}

export function ensureMilestones(state: SimulationState): MilestoneState {
  if (!state.milestones) state.milestones = defaultMilestones();
  return state.milestones;
}

const personalShops = (state: SimulationState) => (state.tradeState?.shops ?? []).filter((s) => !s.isCompanyBranch);

/**
 * Gün kapanışında (ticaret adımından hemen sonra) sayaçları günceller. Dükkân sonuçları biten günündür.
 * Kişisel dükkân yoksa hiçbir şey saymaz (seriler kendiliğinden sıfırlanmaz ama zaten başlamamıştır).
 */
export function trackMilestonesDayClose(state: SimulationState): void {
  const m = ensureMilestones(state);
  if (m.lastTrackedDay >= state.day) return;
  m.lastTrackedDay = state.day;
  const shops = personalShops(state);
  if (shops.length === 0) return;

  const revenue = shops.reduce((a, s) => a + Math.max(0, s.todaySalesRevenue ?? 0), 0);
  const profit = shops.reduce((a, s) => a + (s.todayNetProfit ?? 0), 0);
  const customers = shops.reduce((a, s) => a + Math.max(0, s.todayServedCustomers ?? 0), 0);

  m.totalCustomers += Math.round(customers);
  m.bestDailyRevenue = Math.max(m.bestDailyRevenue, Math.round(revenue));

  m.profitStreak = profit > 0 ? m.profitStreak + 1 : 0;
  m.bestProfitStreak = Math.max(m.bestProfitStreak, m.profitStreak);

  m.activeStreak = revenue > 0 ? m.activeStreak + 1 : 0;
  m.bestActiveStreak = Math.max(m.bestActiveStreak, m.activeStreak);
}

/** Kalıcı müşteri artışının çarpanı (ShopSales müşteri hesabında) */
export function milestoneCustomerMultiplier(state: Pick<SimulationState, 'milestones'>): number {
  const pct = state.milestones?.customerBonusPct ?? 0;
  return pct > 0 ? 1 + pct / 100 : 1;
}

/** Hedef ödülündeki özel bonusu uygular; kısa Türkçe açıklama döner (yoksa boş). */
export function grantBonus(state: SimulationState, bonus: GoalBonus): string {
  const m = ensureMilestones(state);
  switch (bonus.kind) {
    case 'CUSTOMER_PCT':
      m.customerBonusPct = Math.round((m.customerBonusPct + bonus.pct) * 100) / 100;
      return `Kalıcı +%${bonus.pct} müşteri`;
    case 'FREE_TRAINING':
      m.freeTrainings += bonus.count;
      return `${bonus.count} ücretsiz eğitim hakkı (Akademi)`;
    case 'SHOP_OPEN_DISCOUNT':
      m.shopOpenDiscountPct = Math.max(m.shopOpenDiscountPct, bonus.pct);
      return `Sonraki dükkân açılışında %${bonus.pct} indirim`;
    case 'DECORATION':
      if (!m.decorations.includes(bonus.id)) {
        m.decorations.push(bonus.id);
        m.customerBonusPct = Math.round((m.customerBonusPct + MILESTONE_DECORATION_BONUS_PCT) * 100) / 100;
      }
      return `Yeni vitrin rafı (+%${MILESTONE_DECORATION_BONUS_PCT} müşteri)`;
    case 'STREAK_BOOST': {
      const until = state.day + MILESTONE_STREAK_BOOST_DAYS;
      for (const shop of personalShops(state)) {
        const cur = shop.demandBoost;
        if (cur && cur.untilDay >= state.day && cur.multiplier >= MILESTONE_STREAK_BOOST_MULT) {
          cur.untilDay = Math.max(cur.untilDay, until);
        } else {
          shop.demandBoost = { multiplier: MILESTONE_STREAK_BOOST_MULT, untilDay: until };
        }
      }
      return `${MILESTONE_STREAK_BOOST_DAYS} gün +%${Math.round((MILESTONE_STREAK_BOOST_MULT - 1) * 100)} müşteri`;
    }
  }
}

/** Açılış indirimi için: ödülü bir kez kullanır. İndirimli tutarı ve uygulanan yüzdeyi döner. */
export function consumeShopOpenDiscount(state: SimulationState, amount: number): { amount: number; pct: number } {
  const m = state.milestones;
  const pct = m?.shopOpenDiscountPct ?? 0;
  if (!m || pct <= 0) return { amount, pct: 0 };
  m.shopOpenDiscountPct = 0;
  return { amount: Number((amount * (1 - pct / 100)).toFixed(2)), pct };
}

/** İndirimi tüketmeden önizler (arayüz tavsiyesi için) */
export function previewShopOpenDiscount(state: Pick<SimulationState, 'milestones'>, amount: number): number {
  const pct = state.milestones?.shopOpenDiscountPct ?? 0;
  return pct > 0 ? Number((amount * (1 - pct / 100)).toFixed(2)) : amount;
}

export { MILESTONE_CUSTOMER_BONUS_PCT, MILESTONE_SHOP_OPEN_DISCOUNT_PCT };
