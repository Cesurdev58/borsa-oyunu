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
import {
  MANAGER_MIN_SHOP_LEVEL,
  MANAGER_NEEDED_UNMET_SHARE,
  WAREHOUSE_FULL_SHARE,
} from '../data/gameBalance';

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
    if (shopIssueKindsInState(state, s).length > 0) issues += 1;
  }
  return {
    shopCount: shops.length,
    yesterdayRevenue: Math.round(revenue),
    yesterdayNetProfit: Math.round(profit),
    issueCount: issues,
  };
}

/** Haritadaki kırmızı halkayı doğuran gerçek operasyon sorunları (dükkân başına). */
export type ShopIssueKind =
  | 'STOCK_OUT'
  | 'LOSS'
  | 'STAFF_SHORT'
  | 'MANAGER_CASH'
  | 'RENT_SHORT'
  | 'MANAGER_NEEDED';

export const SHOP_ISSUE_LABEL_TR: Record<ShopIssueKind, string> = {
  STOCK_OUT: 'Raflar boş, yolda mal yok',
  LOSS: 'Dün zarar etti',
  STAFF_SHORT: 'Çalışan eksik',
  MANAGER_CASH: 'Müdürün kasası boş',
  RENT_SHORT: 'Kira ve maaşa para yetmiyor',
  MANAGER_NEEDED: 'Müdür gerekli: raflar gün içinde boşalıyor',
};

/** Şehir düzeyindeki sorunlar (bir dükkâna değil şehre bağlı). */
export type CityIssueKind = 'LOAN_OVERDUE' | 'WAREHOUSE_FULL';

export const CITY_ISSUE_LABEL_TR: Record<CityIssueKind, string> = {
  LOAN_OVERDUE: 'Kredi taksiti gecikti',
  WAREHOUSE_FULL: 'Depo kapasitesi dolu',
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
  isCompanyBranch?: boolean;
  level?: number;
  cashAccountBalance?: number;
  /** Biten günün maaş ve kira/işletme gideri (yarın da aşağı yukarı bu kadar düşecek). */
  todayPayrollCost?: number;
  todayRentAndOpex?: number;
  /** Biten günün satılan ve rafta bulunamadığı için satılamayan birimleri. */
  todayUnitsSold?: number;
  todayUnmetCustomerDemand?: number;
}

/** Dükkân dışı bilgi (oyuncunun cebi). Verilmezse bu bilgiye dayanan kural atlanır. */
export interface ShopIssueContext {
  /** Oyuncunun kişisel nakdi: dükkân kasası yetmezse gider buradan, o da yetmezse borçtan ödenir. */
  personalCash?: number;
}

/**
 * Bir dükkândaki gerçek operasyon sorunları (yalnızca durumdan türetilir, kayıtta tutulmaz):
 *  - STOCK_OUT: rafta mal yok ve yolda sipariş de yok
 *  - LOSS: biten gün net zarar (`day` verilirse ve dükkân en az SHOP_LOSS_GRACE_DAYS gündür açıksa)
 *  - STAFF_SHORT: çalışan sayısı gereken en azın altında (sahip çalışırken sayılmaz)
 *  - MANAGER_CASH: müdürün kasası boş, mal alamıyor
 *  - RENT_SHORT: kişisel dükkânın kasası bir günlük kira + maaşı karşılamıyor ve oyuncunun cebi de
 *    açığı kapatamıyor (gün kapanışında açık kısa vadeli borca yazılır). `ctx.personalCash` gerekir.
 *  - MANAGER_NEEDED: müdür tutulabilecek seviyede, müdürü olmayan kişisel dükkân dün satabileceği
 *    malın en az `MANAGER_NEEDED_UNMET_SHARE` kadarını raf boşaldığı için satamadı (`day` gerekir).
 */
export function shopIssueKinds(
  s: ShopIssueInput,
  day?: number,
  ctx?: ShopIssueContext
): ShopIssueKind[] {
  const kinds: ShopIssueKind[] = [];
  const stock = s.inventoryBatches.reduce((sum, b) => sum + b.availableQuantity, 0);
  if (stock <= 0 && (s.pendingDeliveriesCount ?? 0) === 0) kinds.push('STOCK_OUT');
  const pastGrace =
    day !== undefined && s.openedDay !== undefined && day - s.openedDay >= SHOP_LOSS_GRACE_DAYS;
  if (
    pastGrace &&
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

  if (!s.isCompanyBranch && ctx?.personalCash !== undefined) {
    const fixed = (s.todayPayrollCost ?? 0) + (s.todayRentAndOpex ?? 0);
    const till = Math.max(0, s.cashAccountBalance ?? 0);
    if (fixed > 0 && till < fixed && Math.max(0, ctx.personalCash) < fixed - till) {
      kinds.push('RENT_SHORT');
    }
  }

  if (
    pastGrace &&
    !s.isCompanyBranch &&
    !s.manager &&
    (s.level ?? 1) >= MANAGER_MIN_SHOP_LEVEL
  ) {
    const sold = Math.max(0, s.todayUnitsSold ?? 0);
    const unmet = Math.max(0, s.todayUnmetCustomerDemand ?? 0);
    if (unmet > 0 && unmet / (sold + unmet) >= MANAGER_NEEDED_UNMET_SHARE) {
      kinds.push('MANAGER_NEEDED');
    }
  }
  return kinds;
}

/** Oyun durumundan dükkânın sorunları (kişisel nakit dahil bütün kurallar). Arayüz bunu kullanır. */
export function shopIssueKindsInState(state: SimulationState, s: ShopIssueInput): ShopIssueKind[] {
  return shopIssueKinds(s, state.day, { personalCash: state.cash });
}

/** "Sorun var" kuralı: `shopIssueKinds` boş değilse. `day` verilmezse zarar kuralı atlanır. */
export function shopHasIssue(s: ShopIssueInput, day?: number, ctx?: ShopIssueContext): boolean {
  return shopIssueKinds(s, day, ctx).length > 0;
}

/** Oyuncunun merkez şehri (şirket merkezi; yoksa başlangıç şehri). */
function headquartersCity(state: SimulationState): string | undefined {
  return state.headquartersCityId ?? state.playerStartCityId;
}

/**
 * Şehir düzeyindeki sorunlar:
 *  - LOAN_OVERDUE: gecikmiş (DELINQUENT/DEFAULTED) bir banka kredisi varsa merkez şehirde
 *  - WAREHOUSE_FULL: şehirdeki bir depo (şehri yazılı olmayan depo merkez şehirde sayılır)
 *    kapasitesinin en az `WAREHOUSE_FULL_SHARE` kadar dolu
 */
export function cityLevelIssueKinds(state: SimulationState, cityId: CityId): CityIssueKind[] {
  const kinds: CityIssueKind[] = [];
  const hq = headquartersCity(state);
  if (
    hq === cityId &&
    (state.activeLoans ?? []).some((l) => l.status === 'DELINQUENT' || l.status === 'DEFAULTED')
  ) {
    kinds.push('LOAN_OVERDUE');
  }
  const full = (state.tradeState?.warehouses ?? []).some(
    (w) =>
      (w.cityId ?? hq) === cityId &&
      w.maxCapacityUnits > 0 &&
      w.usedCapacityUnits >= w.maxCapacityUnits * WAREHOUSE_FULL_SHARE
  );
  if (full) kinds.push('WAREHOUSE_FULL');
  return kinds;
}

/** Şehirde sorunlu en az bir dükkân ya da şehir düzeyinde bir sorun var mı? (kırmızı halka) */
export function cityHasIssue(state: SimulationState, cityId: CityId): boolean {
  if (cityLevelIssueKinds(state, cityId).length > 0) return true;
  return (state.tradeState?.shops ?? []).some(
    (s) => s.cityId === cityId && shopIssueKindsInState(state, s).length > 0
  );
}

/** Şehrin bütün sorunları, oyuncuya gösterilecek yazılarla (tekrarsız). */
export function cityIssueLabels(state: SimulationState, cityId: CityId): string[] {
  const labels = cityLevelIssueKinds(state, cityId).map((k) => CITY_ISSUE_LABEL_TR[k]);
  for (const s of state.tradeState?.shops ?? []) {
    if (s.cityId !== cityId) continue;
    for (const k of shopIssueKindsInState(state, s)) labels.push(SHOP_ISSUE_LABEL_TR[k]);
  }
  return Array.from(new Set(labels));
}
