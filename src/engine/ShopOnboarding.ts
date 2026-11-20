/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * İLK DÜKKÂN ONBOARDING'İ (ShopOnboarding)
 *  - İlk kişisel dükkân BUFE ise oyuncu kendisi çalışır (çalışan 0, kapasite %65); "İlk çalışanını işe al" ücretlidir.
 *  - Dükkân açarken "önerilen işletme sermayesi" bilgisi ve kaç gün dayanacağı (engel değil, uyarı + ikinci onay).
 * Yalnızca modelleri, katalogu, denge sabitlerini ve alt motorları (cüzdan, defter) içe aktarır (döngü oluşmaz).
 */
import {
  FIRST_EMPLOYEE_HIRE_FEE_BUFE,
  OWNER_STAFF_CAPACITY,
  RECOMMENDED_WORKING_CAPITAL_BUFE,
  RECOMMENDED_WORKING_CAPITAL_SETUP_BASE,
} from '../data/gameBalance';
import { SHOP_TEMPLATES } from '../data/tradeCatalog';
import type { SimulationState } from '../models/simulation';
import type { ShopInstance, ShopType } from '../models/trade';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';
import { WalletEngine } from './WalletEngine';

/** Bu dükkân açılırken oyuncu kendisi çalışacak mı? (yalnızca oyuncunun ilk kişisel dükkânı ve BUFE ise) */
export function startsWithOwnerWorking(
  state: Pick<SimulationState, 'playerCompany'> & { tradeState?: { shops: ShopInstance[] } },
  shopType: ShopType
): boolean {
  return shopType === 'BUFE' && !state.playerCompany && (state.tradeState?.shops.length ?? 0) === 0;
}

/** Personel yeterlilik çarpanı (talebi çarpar). Oyuncu kendisi çalışıyorsa sabit %65. */
export function shopStaffRatio(shop: Pick<ShopInstance, 'staffCount' | 'minStaffRequired' | 'ownerWorks'>): number {
  if (shop.ownerWorks && shop.staffCount <= 0) return OWNER_STAFF_CAPACITY;
  return Math.min(1.25, shop.staffCount / Math.max(1, shop.minStaffRequired));
}

export interface FirstEmployeeQuote {
  allowed: boolean;
  reasonTR: string;
  fee: number;
  dailyWage: number;
}

export function getFirstEmployeeQuote(state: SimulationState, shop: ShopInstance, reservedCash: number): FirstEmployeeQuote {
  const tpl = SHOP_TEMPLATES[shop.shopType];
  const dailyWage = tpl?.staffDailyWagePerPerson ?? shop.staffDailyWagePerPerson;
  const fee = shop.shopType === 'BUFE' ? FIRST_EMPLOYEE_HIRE_FEE_BUFE : Math.round(dailyWage * 5);
  const base = { fee, dailyWage };
  if (!shop.ownerWorks || shop.staffCount > 0) {
    return { allowed: false, reasonTR: 'Bu dükkânda zaten çalışan var.', ...base };
  }
  const spendable = Math.max(0, state.cash - reservedCash);
  if (spendable < fee) {
    return { allowed: false, reasonTR: `İşe alma bedeli için ₺${fee.toLocaleString('tr-TR')} gerekir.`, ...base };
  }
  return { allowed: true, reasonTR: '', ...base };
}

/** "İlk çalışanını işe al": ücreti öder, çalışan sayısı normal gereksinime çıkar, ilk dükkândaki "ben çalışıyorum" hâli biter. */
export function hireFirstEmployee(
  state: SimulationState,
  shopId: string,
  reservedCash: number
): { success: boolean; message: string } {
  const shop = state.tradeState?.shops.find((s) => s.shopId === shopId);
  if (!shop) return { success: false, message: 'Dükkân bulunamadı.' };
  const q = getFirstEmployeeQuote(state, shop, reservedCash);
  if (!q.allowed) return { success: false, message: q.reasonTR };
  WalletEngine.spendBusiness(state, q.fee);
  CentralLedgerEngine.recordPostedAccountingEntry(state, {
    idempotencyKey: `FIRST-EMPLOYEE-${shop.shopId}-D${state.day}`,
    sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    destinationAccountId: ACCOUNT_IDS.PAYROLL_EXPENSE,
    amount: q.fee,
    category: 'PAYROLL_PAYMENT',
    description: `${shop.nameTR} için ilk çalışan işe alındı`,
    reservedOrderCash: reservedCash,
  });
  shop.staffCount = Math.max(1, shop.minStaffRequired);
  shop.ownerWorks = false;
  return {
    success: true,
    message: `${shop.nameTR} ilk çalışanını aldı. Artık dükkân tam kapasiteyle çalışıyor; günlük maaş ₺${q.dailyWage.toLocaleString('tr-TR')}.`,
  };
}

export interface OpeningAdvice {
  setupCost: number;
  /** Dükkân kasasına konacak işletme parası */
  workingCash: number;
  recommendedWorkingCapital: number;
  /** Açılıştan sonra dükkân kasası + cepte kalan serbest para */
  liquidAfterOpening: number;
  /** Önerilenin altında kalınıyor mu? (engel değil: güçlü uyarı + ikinci onay) */
  belowRecommended: boolean;
  dailyFixedCost: number;
  /** Rafları bir kez doldurmanın yaklaşık bedeli */
  firstStockCost: number;
  /** İlk stoktan sonra kalan para kira + maaşı kaç gün karşılar */
  runwayDays: number;
  ownerWorks: boolean;
}

/** Önerilen işletme sermayesi: BUFE için sabit, diğer türlerde kurulum maliyetiyle orantılı (bin ₺'ye yuvarlanır). */
export function recommendedWorkingCapital(shopType: ShopType): number {
  if (shopType === 'BUFE') return RECOMMENDED_WORKING_CAPITAL_BUFE;
  const tpl = SHOP_TEMPLATES[shopType];
  const setup = tpl.openingCost + tpl.decorationCost;
  return Math.round(((setup / RECOMMENDED_WORKING_CAPITAL_SETUP_BASE) * RECOMMENDED_WORKING_CAPITAL_BUFE) / 1000) * 1000;
}

export function getOpeningAdvice(
  state: SimulationState,
  shopType: ShopType,
  workingCashInput: number | undefined,
  reservedCash: number
): OpeningAdvice {
  const tpl = SHOP_TEMPLATES[shopType];
  const setupCost = Number((tpl.openingCost + tpl.decorationCost).toFixed(2));
  const workingCash = Number(Math.max(0, workingCashInput ?? Math.round(setupCost * 0.25)).toFixed(2));
  const personalAfter = Math.max(0, WalletEngine.freeCash(state) - reservedCash - Math.max(0, setupCost - WalletEngine.restrictedFund(state)) - workingCash);
  const liquidAfterOpening = Number((workingCash + personalAfter).toFixed(2));
  const ownerWorks = startsWithOwnerWorking(state, shopType);
  const staff = ownerWorks ? 0 : tpl.minStaffRequired;
  const dailyFixedCost = Number((tpl.dailyRentBase + 120 + staff * tpl.staffDailyWagePerPerson).toFixed(2));
  const grossShare = 1 - tpl.defaultGrossMarginPct / (100 + tpl.defaultGrossMarginPct);
  const firstStockCost = Math.round((tpl.baseCustomerCapacity * tpl.avgBasketValueTL * grossShare) / 100) * 100;
  const runwayDays = Math.max(0, Math.floor((liquidAfterOpening - firstStockCost) / Math.max(1, dailyFixedCost)));
  const recommended = recommendedWorkingCapital(shopType);
  return {
    setupCost,
    workingCash,
    recommendedWorkingCapital: recommended,
    liquidAfterOpening,
    belowRecommended: liquidAfterOpening < recommended,
    dailyFixedCost,
    firstStockCost,
    runwayDays,
    ownerWorks,
  };
}
