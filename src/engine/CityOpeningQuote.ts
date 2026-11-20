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
import { getOpeningAdvice } from './ShopOnboarding';
import { WalletEngine } from './WalletEngine';
import { TradeAndShopEngine } from './TradeAndShopEngine';

export interface CityOpeningQuote {
  cityId: CityId;
  shopType: ShopType;
  shopNameTR: string;
  /** Kurulum + dekorasyon (peşin düşer). */
  setupCost: number;
  /** Dükkân kasasına konan işletme parası (dükkânın kendi parasıdır, harcanmaz). */
  workingCash: number;
  /** Peşin çıkacak toplam: kurulum + işletme kasası. */
  totalUpfrontCost: number;
  /** Rafları bir kez doldurmanın yaklaşık bedeli. */
  firstStockCost: number;
  /** İlk siparişin tahmini varış süresi (gün); toptancı teklifi bulunamazsa null. */
  estimatedDeliveryDays: number | null;
  /** Oyuncunun şu an harcayabileceği para yetiyor mu? */
  affordable: boolean;
  spendableCash: number;
}

export function getCityOpeningQuote(
  state: SimulationState,
  cityId: CityId,
  shopType: ShopType = 'BUFE',
  reservedCash = 0
): CityOpeningQuote {
  const tpl = SHOP_TEMPLATES[shopType];
  const advice = getOpeningAdvice(state, shopType, undefined, reservedCash);
  const totalUpfrontCost = Number((advice.setupCost + advice.workingCash).toFixed(2));

  let days: number | null = null;
  for (const rid of tpl.allowedResourceIds) {
    const best = TradeAndShopEngine.getSupplierOffers(state, rid)
      .filter((o) => o.maxAvailableQuantity >= o.minOrderQuantity)
      .sort((a, b) => a.unitPrice + a.shippingCostPerUnit - (b.unitPrice + b.shippingCostPerUnit))[0];
    if (best) days = Math.max(days ?? 0, best.deliveryDays);
  }

  const spendableCash = Math.max(0, Number((WalletEngine.freeCash(state) - reservedCash).toFixed(2)));
  return {
    cityId,
    shopType,
    shopNameTR: tpl.nameTR,
    setupCost: advice.setupCost,
    workingCash: advice.workingCash,
    totalUpfrontCost,
    firstStockCost: advice.firstStockCost,
    estimatedDeliveryDays: days,
    affordable: spendableCash >= totalUpfrontCost,
    spendableCash,
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
    if (shopHasIssue(s)) issues += 1;
  }
  return {
    shopCount: shops.length,
    yesterdayRevenue: Math.round(revenue),
    yesterdayNetProfit: Math.round(profit),
    issueCount: issues,
  };
}

/** "Sorun var" kuralı: rafı boş ve yolda malı yok, ya da kasası boş (müdürün `lowCash` uyarısı). */
export function shopHasIssue(s: {
  inventoryBatches: Array<{ availableQuantity: number }>;
  pendingDeliveriesCount?: number;
  manager?: { lowCash?: boolean } | null;
}): boolean {
  const stock = s.inventoryBatches.reduce((sum, b) => sum + b.availableQuantity, 0);
  if (stock <= 0 && (s.pendingDeliveriesCount ?? 0) === 0) return true;
  return Boolean(s.manager?.lowCash);
}

/** Şehirde sorunlu en az bir dükkân var mı? (kırmızı halka) */
export function cityHasIssue(state: SimulationState, cityId: CityId): boolean {
  return (state.tradeState?.shops ?? []).some((s) => s.cityId === cityId && shopHasIssue(s));
}
