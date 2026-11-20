/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * YÜKSELTME NAKİT GÜVENLİK REZERVİ
 *
 *   upgradeSafetyReserve = nextSevenDaysRent + nextSevenDaysWages + recommendedStockOrder
 *
 * Oyuncu bir dükkân yükseltmesi almadan önce, yükseltmeden SONRA elinde kalacak nakdin bu rezervi karşılayıp
 * karşılamadığı hesaplanır. Yükseltme ASLA engellenmez (engel yok); rezerv altında kalınıyorsa güçlü uyarı verilir.
 * Bu dosya hiçbir şeyi değiştirmez (yalnızca hesap). Kalan nakit, `ShopUpgrades.buyShopUpgrade` ile aynı kaynaklardan
 * ödendiği için aynı biçimde sayılır: dükkân kasası + kişisel nakit (rezerve emir nakdi hariç, işletme kredisi dahil).
 *
 * Eşikler (kalan nakdin kaç günlük gideri karşıladığına göre; ayarlar `gameBalance.ts`):
 *   YEŞİL ≥ 14 gün · SARI 7–13 gün · KIRMIZI < 7 gün · KRİTİK = yükseltmeden sonra stok yenileme parası kalmıyor.
 */
import {
  UPGRADE_RESERVE_DAYS,
  UPGRADE_RESERVE_GREEN_DAYS,
  UPGRADE_RESERVE_YELLOW_DAYS,
} from '../data/gameBalance';
import { SHOP_UPGRADES } from '../data/shopUpgrades';
import type { SimulationState } from '../models/simulation';
import type { ShopInstance } from '../models/trade';
import { activeCargoFee, activeInsurancePremium, solarOpexMultiplier } from './CityServices';
import { oneDayStockCost } from './ShopOnboarding';
import { planShopRestock } from './ShopRestockPlanner';
import { shopUpgradeCost } from './ShopUpgrades';

export type UpgradeReserveLevel = 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL';

export interface UpgradeCashAssessment {
  shopId: string;
  upgradeId: string;
  cost: number;
  /** Yükseltmeden önce harcanabilir nakit (dükkân kasası + kişisel; rezerve emir nakdi hariç) */
  cashBefore: number;
  /** Yükseltmeden sonra kalacak nakit (negatifse yükseltme alınamaz) */
  cashAfter: number;
  /** Nakit yükseltmeye yetiyor mu? (yetmiyorsa satın alma zaten reddedilir; bu bir "engel uyarısı" değildir) */
  affordable: boolean;
  /** Bir günlük kira + işletme gideri */
  dailyRent: number;
  /** Bir günlük maaş (çalışan + müdür sabit maaşı + sigorta primi) */
  dailyWages: number;
  nextSevenDaysRent: number;
  nextSevenDaysWages: number;
  /** nextSevenDaysRent + nextSevenDaysWages */
  nextSevenDaysExpenses: number;
  /** Önerilen stok siparişi: rafların eksiği (yoldaki siparişler sayılır, en ucuz toptancı) ile bir günlük satış stokunun küçüğü */
  recommendedStockOrder: number;
  upgradeSafetyReserve: number;
  /** Kalan nakdin kaç günlük kira + maaşı karşıladığı (aşağı yuvarlı, en az 0) */
  coverageDays: number;
  level: UpgradeReserveLevel;
  /** Kalan nakit rezervin altında mı → güçlü uyarı gösterilir (alım yine de serbesttir) */
  belowReserve: boolean;
  /** Yükseltmeden sonra stok yenileme parası kalıyor mu? */
  stockRefillPossible: boolean;
  /** Arayüz ve bildirim için hazır Türkçe uyarı; rezervin altında değilse boş */
  warningTR: string;
}

const r2 = (v: number) => Number(v.toFixed(2));
const tl = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;

/** Seviyeyi, kalan nakdin karşıladığı gün ve stok durumundan belirler (saf fonksiyon, test edilir). */
export function upgradeReserveLevel(coverageDays: number, stockRefillPossible: boolean): UpgradeReserveLevel {
  if (!stockRefillPossible) return 'CRITICAL';
  if (coverageDays >= UPGRADE_RESERVE_GREEN_DAYS) return 'GREEN';
  if (coverageDays >= UPGRADE_RESERVE_YELLOW_DAYS) return 'YELLOW';
  return 'RED';
}

/** Dükkânın bir günlük kira + işletme gideri (günlük kapanıştaki formülle aynı). */
export function shopDailyRentAndOpex(shop: ShopInstance): number {
  return r2((shop.dailyRent + shop.level * 120) * solarOpexMultiplier(shop) + activeCargoFee(shop));
}

/** Dükkânın bir günlük maaş gideri: çalışanlar + müdür sabit maaşı + sigorta primi (müdür primi kâra bağlı, hariç). */
export function shopDailyWages(shop: ShopInstance): number {
  return r2(
    shop.staffCount * shop.staffDailyWagePerPerson +
      (shop.manager ? shop.manager.dailyWage : 0) +
      (shop.isCompanyBranch ? 0 : activeInsurancePremium(shop))
  );
}

/**
 * Yükseltme sonrası nakit güvenliğini hesaplar. Dükkân/yükseltme bulunamazsa ya da şube/zaten-alınmış gibi
 * değerlendirilemeyecek durumdaysa null döner.
 */
export function assessUpgradeCash(
  state: SimulationState,
  shopId: string,
  upgradeId: string,
  reservedOrderCash: number
): UpgradeCashAssessment | null {
  const shop = state.tradeState?.shops.find((s) => s.shopId === shopId);
  const def = SHOP_UPGRADES.find((u) => u.id === upgradeId);
  if (!shop || !def || shop.isCompanyBranch) return null;

  const cost = shopUpgradeCost(shop, def);
  const cashBefore = r2(shop.cashAccountBalance + Math.max(0, state.cash - reservedOrderCash));
  const cashAfter = r2(cashBefore - cost);

  const dailyRent = shopDailyRentAndOpex(shop);
  const dailyWages = shopDailyWages(shop);
  const nextSevenDaysRent = r2(dailyRent * UPGRADE_RESERVE_DAYS);
  const nextSevenDaysWages = r2(dailyWages * UPGRADE_RESERVE_DAYS);
  const nextSevenDaysExpenses = r2(nextSevenDaysRent + nextSevenDaysWages);
  // Önerilen stok siparişi: rafları tamamen doldurmanın bedeli, ama bir günlük satışa yetecek stoktan fazla değil
  // (boş raflı bir büfede "bütün rafları doldur" ~50.000 ₺ çıkıyordu; rezerv bu yüzden hep kritik görünürdü).
  const recommendedStockOrder = r2(
    Math.min(planShopRestock(state, shop.shopId, Number.MAX_SAFE_INTEGER).totalCost, oneDayStockCost(shop.shopType))
  );
  const upgradeSafetyReserve = r2(nextSevenDaysRent + nextSevenDaysWages + recommendedStockOrder);

  const dailyExpense = dailyRent + dailyWages;
  const coverageDays = cashAfter <= 0 ? 0 : Math.floor(cashAfter / Math.max(1, dailyExpense));
  const stockRefillPossible = cashAfter >= recommendedStockOrder;
  const level = upgradeReserveLevel(coverageDays, stockRefillPossible);
  const belowReserve = cashAfter < upgradeSafetyReserve;

  const warningTR = belowReserve
    ? `Bu yükseltmeden sonra yalnızca ${tl(Math.max(0, cashAfter))} serbest nakdin kalacak. ` +
      `Önerilen işletme rezervi: ${tl(upgradeSafetyReserve)}. ` +
      `Önümüzdeki ${UPGRADE_RESERVE_DAYS} günlük tahmin: ${tl(nextSevenDaysExpenses)} gider` +
      (stockRefillPossible ? '.' : ' ve stok yenilemeye para kalmıyor.')
    : '';

  return {
    shopId,
    upgradeId,
    cost,
    cashBefore,
    cashAfter,
    affordable: cashAfter >= 0,
    dailyRent,
    dailyWages,
    nextSevenDaysRent,
    nextSevenDaysWages,
    nextSevenDaysExpenses,
    recommendedStockOrder,
    upgradeSafetyReserve,
    coverageDays,
    level,
    belowReserve,
    stockRefillPossible,
    warningTR,
  };
}
