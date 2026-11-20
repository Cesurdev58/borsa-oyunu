/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * İLK OYUNCU DENEYİMİ KURALLARI (plan Bölüm 4)
 * - Alt menüde hangi sekmenin açık / kilitli önizleme / gizli olduğu (durumdan türetilir, kayıt tutmaz).
 * - Dükkân sekmesi rozeti (stoğu biten dükkân sayısı, tahsil edilebilir kâr).
 * - Rehberin kayıtta tutulan durumu (`state.onboarding`) ve eski kayıt göçü.
 * Yalnızca modelleri, ayarları ve FirstShopGate'i içe aktarır (döngü oluşmaz).
 */
import { ONBOARDING_VERSION, SHOP_CASH_KEEP, SHOP_COLLECT_MIN } from '../data/gameBalance';
import type { SimulationState } from '../models/simulation';
import { firstShopGateStatus } from './FirstShopGate';

export type NavTabId = 'city' | 'market' | 'portfolio' | 'company' | 'news';
export type NavTabMode = 'active' | 'locked' | 'hidden';

export interface NavTabStatus {
  mode: NavTabMode;
  /** Kilitliyken dokununca gösterilen kısa açıklama */
  hint?: string;
}

type NavInput = Pick<SimulationState, 'transactions' | 'stocks' | 'netWorth' | 'playerCompany'> &
  Partial<Pick<SimulationState, 'day' | 'tradeState' | 'stageUnlocks'>>;

function personalShops(state: Pick<SimulationState, 'tradeState'>) {
  return (state.tradeState?.shops ?? []).filter((s) => !s.isCompanyBranch);
}

/** Alt menüdeki her sekmenin durumu. Eski kayıtlar kendiliğinden doğru çıkar (dükkânı varsa hepsi açık). */
export function navTabStatuses(state: NavInput): Record<NavTabId, NavTabStatus> {
  const gate = firstShopGateStatus(state);
  const hasBought = (state.transactions ?? []).some((t) => t.type === 'BUY');
  const shops = personalShops(state).length;
  const hasCompany = state.playerCompany !== null && state.playerCompany !== undefined;

  const news: NavTabStatus = hasBought || shops > 0 || hasCompany ? { mode: 'active' } : { mode: 'hidden' };
  // Dükkân ve Şirket sekmeleri her zaman görünür; ilk dükkân / şirket kurulana kadar kilitlidir.
  const portfolio: NavTabStatus =
    shops > 0 || hasCompany
      ? { mode: 'active' }
      : { mode: 'locked', hint: gate.open ? 'İlk dükkânını şehirden açınca bu ekran açılır.' : 'Önce borsa görevlerini bitir, sonra ilk dükkânını aç.' };
  const company: NavTabStatus = hasCompany
    ? { mode: 'active' }
    : { mode: 'locked', hint: 'Şirketini kurunca bu ekran açılır.' };

  return {
    city: { mode: 'active' },
    market: { mode: 'active' },
    news,
    portfolio,
    company,
  };
}

export interface ShopTabIndicators {
  ownedShopCount: number;
  /** Rafı boş ve yolda malı olmayan dükkân sayısı (kırmızı rozet) */
  emptyShopCount: number;
  /** Kasasında tahsil edilebilir kâr olan dükkân var mı (yeşil nokta) */
  hasCollectable: boolean;
}

/** Dükkân sekmesi rozeti: hisse pozisyon sayısı ASLA burada kullanılmaz. */
export function shopTabIndicators(state: Pick<SimulationState, 'tradeState'>): ShopTabIndicators {
  const shops = personalShops(state);
  let emptyShopCount = 0;
  let hasCollectable = false;
  for (const shop of shops) {
    const stock = shop.inventoryBatches.reduce((sum, b) => sum + b.availableQuantity, 0);
    if (stock <= 0 && (shop.pendingDeliveriesCount ?? 0) === 0) emptyShopCount += 1;
    if (Math.floor(shop.cashAccountBalance - SHOP_CASH_KEEP) >= SHOP_COLLECT_MIN) hasCollectable = true;
  }
  return { ownedShopCount: shops.length, emptyShopCount, hasCollectable };
}

// ---------------------------------------------------------------------------
// Rehberin kayıtlı durumu
// ---------------------------------------------------------------------------

export interface OnboardingState {
  version: typeof ONBOARDING_VERSION;
  completedSteps: string[];
  dismissed: boolean;
  firstMarketUpdateSeen: boolean;
}

export function defaultOnboarding(): OnboardingState {
  return { version: ONBOARDING_VERSION, completedSteps: [], dismissed: false, firstMarketUpdateSeen: false };
}

/**
 * Eski kayıtta `onboarding` yoksa üretir. Oyuncu zaten ilerlediyse (gün > 1, işlem ya da dükkân var)
 * ya da eski tarayıcı anahtarı rehberin bittiğini söylüyorsa rehber kapalı başlar.
 * `legacyGuideDone`: eski localStorage anahtarının değeri (yalnızca göç için okunur).
 */
export function migrateOnboarding(
  saved: unknown,
  ctx: { day: number; hasProgress: boolean; legacyGuideDone: boolean }
): OnboardingState {
  if (saved && typeof saved === 'object') {
    const o = saved as Partial<OnboardingState>;
    if (o.version === ONBOARDING_VERSION && Array.isArray(o.completedSteps)) {
      return {
        version: ONBOARDING_VERSION,
        completedSteps: o.completedSteps.filter((x) => typeof x === 'string'),
        dismissed: Boolean(o.dismissed),
        firstMarketUpdateSeen: Boolean(o.firstMarketUpdateSeen),
      };
    }
  }
  const alreadyPlaying = ctx.day > 1 || ctx.hasProgress || ctx.legacyGuideDone;
  return { ...defaultOnboarding(), dismissed: alreadyPlaying, firstMarketUpdateSeen: alreadyPlaying };
}

export function hasProgress(state: Partial<Pick<SimulationState, 'transactions' | 'tradeState' | 'playerCompany'>>): boolean {
  return (
    (state.transactions?.length ?? 0) > 0 ||
    (state.tradeState?.shops.length ?? 0) > 0 ||
    (state.playerCompany ?? null) !== null
  );
}

/** Saf güncelleyiciler; motor bunları state.onboarding üzerine uygular. */
export function withCompletedStep(o: OnboardingState, stepId: string): OnboardingState {
  return o.completedSteps.includes(stepId) ? o : { ...o, completedSteps: [...o.completedSteps, stepId] };
}
export function withDismissed(o: OnboardingState): OnboardingState {
  return { ...o, dismissed: true };
}
/** Rehber düğmesinden yeniden başlatma */
export function restartedOnboarding(o: OnboardingState): OnboardingState {
  return { ...defaultOnboarding(), firstMarketUpdateSeen: o.firstMarketUpdateSeen };
}

/** Eski sürümün tarayıcı anahtarı: yalnızca eski kayıt göçü için okunur, ana kaynak değildir. */
export const LEGACY_GUIDE_DONE_KEY = 'first_run_guide_done_v1';
export function readLegacyGuideDone(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(LEGACY_GUIDE_DONE_KEY) === '1';
  } catch {
    return false;
  }
}
