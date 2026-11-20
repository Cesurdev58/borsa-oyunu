/**
 * Bir şehirde dükkân açmanın GERÇEK maliyeti (Faz 4 bilgi paneli için).
 *
 * Rakamlar uydurma değildir: kurulum ve işletme kasası `ShopOnboarding.getOpeningAdvice` (yani `openShop`un
 * gerçekten düşeceği tutar), ilk stok bedeli aynı fonksiyondan, teslimat süresi ise gerçek toptancı tekliflerinden gelir.
 * Not: şehir çarpanları (kira, ücret…) henüz açılış bedelini değiştirmiyor; bu yüzden teklif şehirden bağımsızdır
 * ve `cityId` yalnızca sonucun hangi şehir için istendiğini taşır (şehre göre fiyat Faz 7'de gelir).
 */
import type { CityId } from '../models/cities';
import type { ShopType } from '../models/trade';
import type { SimulationState } from '../models/simulation';
import { SHOP_TEMPLATES } from '../data/tradeCatalog';
import { getCityExpansionQuote } from './CityExpansionQuote';
import type { CityExpansionQuote } from '../models/cities';

export interface CityOpeningQuote {
  cityId: CityId;
  shopType: ShopType;
  shopNameTR: string;
  /** Kurulum + dekorasyon (peşin düşer). */
  setupCost: number;
  /** Dükkân kasasına konan işletme parası (dükkânın kendi parasıdır, harcanmaz). */
  workingCash: number;
  /** Peşin çıkacak toplam (merkezi teklifin toplamı: kurulum + depozito + ruhsat + hat − indirim + işletme kasası). */
  totalUpfrontCost: number;
  /** Rafları bir kez doldurmanın yaklaşık bedeli. */
  firstStockCost: number;
  /** İlk siparişin tahmini varış süresi (gün; mesafe dahil). */
  estimatedDeliveryDays: number | null;
  /** Oyuncunun şu an harcayabileceği para yetiyor mu? */
  affordable: boolean;
  spendableCash: number;
  /** Merkezi teklifin tamamı (şehir kirası, ruhsat, indirim, uyarılar…) */
  expansion: CityExpansionQuote;
}

/**
 * Harita paneli için teklif: `CityExpansionQuote` (tek merkezi hesap) üzerinden okunur; `openShop` aynı tutarı düşer.
 */
export function getCityOpeningQuote(
  state: SimulationState,
  cityId: CityId,
  shopType: ShopType = 'BUFE',
  reservedCash = 0
): CityOpeningQuote {
  const tpl = SHOP_TEMPLATES[shopType];
  const q = getCityExpansionQuote(state, cityId, shopType, { reservedCash });
  return {
    cityId,
    shopType,
    shopNameTR: tpl.nameTR,
    setupCost: q.baseSetupCost,
    workingCash: q.workingCash,
    totalUpfrontCost: q.totalUpfrontCost,
    firstStockCost: q.initialStockCost,
    estimatedDeliveryDays: q.estimatedDeliveryDays,
    affordable: q.affordable,
    spendableCash: q.spendableCash,
    expansion: q,
  };
}

/** Bir şehirdeki kişisel dükkânların özeti (panelde gösterilir). */
export interface CityShopSummary {
  shopCount: number;
  /** Biten günün satışı/kârı (dükkân kartlarındaki "Dün" ile aynı kaynak). */
  yesterdayRevenue: number;
  yesterdayNetProfit: number;
  /** Raf boş ve yolda mal yok ya da dükkânın bildirdiği ana sorunu olan dükkân sayısı. */
  issueCount: number;
}

export function getCityShopSummary(state: SimulationState, cityId: CityId): CityShopSummary {
  const shops = (state.tradeState?.shops ?? []).filter((s) => s.cityId === cityId);
  let revenue = 0;
  let profit = 0;
  let issues = 0;
  for (const s of shops) {
    revenue += s.todaySalesRevenue ?? 0;
    profit += s.todayNetProfit ?? 0;
    if (shopHasIssue(s, state.day)) issues += 1;
  }
  return {
    shopCount: shops.length,
    yesterdayRevenue: Math.round(revenue),
    yesterdayNetProfit: Math.round(profit),
    issueCount: issues,
  };
}

/** Haritadaki kırmızı halkayı doğuran gerçek operasyon sorunları. */
export type ShopIssueKind = 'STOCK_OUT' | 'LOSS' | 'STAFF_SHORT' | 'MANAGER_CASH';

export const SHOP_ISSUE_LABEL_TR: Record<ShopIssueKind, string> = {
  STOCK_OUT: 'Raflar boş, yolda mal yok',
  LOSS: 'Dün zarar etti',
  STAFF_SHORT: 'Çalışan eksik',
  MANAGER_CASH: 'Müdürün kasası boş',
};

/** Yeni açılan dükkân ilk günlerde zarar sayılmaz (kira + kurulum dönemi). */
export const SHOP_LOSS_GRACE_DAYS = 2;
/** Küsurat farkı zarar sayılmasın diye eşik (₺). */
const SHOP_LOSS_THRESHOLD_TL = 1;

export interface ShopIssueInput {
  inventoryBatches: Array<{ availableQuantity: number }>;
  pendingDeliveriesCount?: number;
  manager?: { lowCash?: boolean } | null;
  staffCount?: number;
  minStaffRequired?: number;
  ownerWorks?: boolean;
  /** Biten günün net kârı (dükkân kartlarındaki "Dün" ile aynı kaynak). */
  todayNetProfit?: number;
  openedDay?: number;
}

/**
 * Bir dükkândaki gerçek operasyon sorunları (yalnızca durumdan türetilir, kayıtta tutulmaz):
 *  - STOCK_OUT: rafta mal yok ve yolda sipariş de yok
 *  - LOSS: biten gün net zarar (`day` verilirse ve dükkân en az SHOP_LOSS_GRACE_DAYS gündür açıksa)
 *  - STAFF_SHORT: çalışan sayısı gereken en azın altında (sahip çalışırken sayılmaz)
 *  - MANAGER_CASH: müdürün kasası boş, mal alamıyor
 */
export function shopIssueKinds(s: ShopIssueInput, day?: number): ShopIssueKind[] {
  const kinds: ShopIssueKind[] = [];
  const stock = s.inventoryBatches.reduce((sum, b) => sum + b.availableQuantity, 0);
  if (stock <= 0 && (s.pendingDeliveriesCount ?? 0) === 0) kinds.push('STOCK_OUT');
  if (
    day !== undefined &&
    s.openedDay !== undefined &&
    day - s.openedDay >= SHOP_LOSS_GRACE_DAYS &&
    Number.isFinite(s.todayNetProfit) &&
    (s.todayNetProfit as number) < -SHOP_LOSS_THRESHOLD_TL
  ) {
    kinds.push('LOSS');
  }
  if (
    s.staffCount !== undefined &&
    s.minStaffRequired !== undefined &&
    !s.ownerWorks &&
    s.staffCount < s.minStaffRequired
  ) {
    kinds.push('STAFF_SHORT');
  }
  if (s.manager?.lowCash) kinds.push('MANAGER_CASH');
  return kinds;
}

/** "Sorun var" kuralı: `shopIssueKinds` boş değilse. `day` verilmezse zarar kuralı atlanır. */
export function shopHasIssue(s: ShopIssueInput, day?: number): boolean {
  return shopIssueKinds(s, day).length > 0;
}

/** Şehirde sorunlu en az bir dükkân var mı? (kırmızı halka) */
export function cityHasIssue(state: SimulationState, cityId: CityId): boolean {
  return (state.tradeState?.shops ?? []).some((s) => s.cityId === cityId && shopHasIssue(s, state.day));
}
