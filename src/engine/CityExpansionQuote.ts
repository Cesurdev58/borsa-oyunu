/**
 * MERKEZİ AÇILIŞ TEKLİFİ (Faz 7): herhangi bir şehirde dükkân açmanın bedelini TEK yerde hesaplar.
 *
 * `ShopOperations.openShop` bu fonksiyonun `totalUpfrontCost` değerini birebir tahsil eder; harita paneli, başlangıç
 * şehri ekranı ve testler de aynı fonksiyonu okur. Bu yüzden ekranda yazan tutarla defterden düşen tutar ayrışmaz.
 *
 * Bileşenler: kurulum (+ dekorasyon) · şehir kira depozitosu · bölgesel ruhsat · lojistik hat kurulumu · indirim
 * (ilk dükkânda prestij %20, sonraki uygun dükkânda kilometre taşı %10; ikisi aynı dükkânda birleşmez, kullanılmayan
 * kilometre taşı hakkı korunur) · dükkân kasasına konan işletme parası. Ayrıca 7 günlük güvenlik rezervi ve uyarılar.
 *
 * Engel yalnızca gerçekten yetersiz nakitte vardır; rezervin altında kalmak ikinci onay ister, yasaklamaz.
 */
import type { CityExpansionQuote, CityId, ExpansionWarningLevel } from '../models/cities';
import type { ShopType } from '../models/trade';
import type { SimulationState } from '../models/simulation';
import { SHOP_TEMPLATES } from '../data/tradeCatalog';
import { getCityDefinition, isCityId } from '../data/cityDefinitions';
import {
  MILESTONE_NET_WORTH_THRESHOLDS,
  MILESTONE_OPENING_DISCOUNT,
  OPENING_LOGISTICS_SETUP_RATE,
  OPENING_PERMIT_RATE,
  OPENING_RENT_DEPOSIT_DAYS,
  OPENING_RESERVE_DAYS,
  PRESTIGE_OPENING_DISCOUNT,
} from '../data/cityBalance';
import { getOpeningAdvice } from './ShopOnboarding';
import { WalletEngine } from './WalletEngine';
import {
  cityRentFactor,
  cityWageFactor,
  computeLogisticsRoute,
  distanceDeliveryExtraDays,
  DISTANCE_LABEL_TR,
  supplyHubCityId,
} from './CityEconomy';
import { TradeProcurement } from './TradeProcurement';

const r2 = (n: number) => Number((Number.isFinite(n) ? n : 0).toFixed(2));
const tl = (n: number) => `₺${Math.round(n).toLocaleString('tr-TR')}`;

/** Net değerin geçtiği kilometre taşı eşiği sayısı. */
export function milestonesReachedByNetWorth(netWorth: number): number {
  if (!Number.isFinite(netWorth)) return 0;
  return MILESTONE_NET_WORTH_THRESHOLDS.filter((t) => netWorth >= t).length;
}

/** Kazanılmış ama kullanılmamış kilometre taşı indirimi hakkı (kayıtlı yüksek su seviyesi ile şimdiki net değerden büyüğü). */
export function milestoneDiscountsAvailable(state: SimulationState): number {
  const earned = Math.max(state.cityExpansion?.milestonesEarned ?? 0, milestonesReachedByNetWorth(state.netWorth));
  const used = state.cityExpansion?.milestonesUsed ?? 0;
  return Math.max(0, earned - used);
}

/** Kazanılan hakları kayda geçirir (net değer sonradan düşse bile hak kaybolmaz). Gün kapanışı ve açılış çağırır. */
export function syncMilestoneDiscounts(state: SimulationState): void {
  const earned = Math.max(state.cityExpansion?.milestonesEarned ?? 0, milestonesReachedByNetWorth(state.netWorth));
  state.cityExpansion = { milestonesEarned: earned, milestonesUsed: state.cityExpansion?.milestonesUsed ?? 0 };
}

export interface QuoteOptions {
  /** Dükkân kasasına konacak işletme parası (verilmezse kurulumun %25'i, `openShop` ile aynı varsayılan) */
  workingCash?: number;
  /** Bekleyen emirlere ayrılmış nakit */
  reservedCash?: number;
}

export function getCityExpansionQuote(
  state: SimulationState,
  cityId: CityId,
  shopType: ShopType,
  opts: QuoteOptions = {}
): CityExpansionQuote {
  const tpl = SHOP_TEMPLATES[shopType];
  const reservedCash = opts.reservedCash ?? 0;
  const ts = state.tradeState;
  const isFirstShop = (ts?.shops.length ?? 0) === 0;
  const isCompany = state.playerCompany !== null && state.playerCompany !== undefined;

  const advice = getOpeningAdvice(state, shopType, opts.workingCash, reservedCash);
  const baseSetupCost = advice.setupCost;
  const workingCash = advice.workingCash;

  // Mal çıkış noktası: merkez şehir. Henüz merkez ya da başlangıç şehri seçilmemişse (başlangıç ekranı) seçilen şehrin kendisi.
  const hubChosen = isCityId(state.headquartersCityId) || isCityId(state.playerStartCityId);
  const routeState = {
    headquartersCityId: hubChosen ? supplyHubCityId(state) : cityId,
    playerStartCityId: hubChosen ? state.playerStartCityId : cityId,
    tradeState: state.tradeState,
  };
  const route = computeLogisticsRoute(routeState, cityId, {});

  const rentFactor = cityRentFactor(cityId);
  const wageFactor = cityWageFactor(cityId);
  const cityRentPerDay = tpl.dailyRentBase * rentFactor;
  // İlk dükkânda depozito alınmaz: oyunun ilk dakikalarındaki ince nakit akışı (ilk yükseltme ~18 dk) bozulmasın.
  const cityRentDeposit = isFirstShop && !isCompany ? 0 : r2(cityRentPerDay * OPENING_RENT_DEPOSIT_DAYS);
  const regionalPermitCost = r2(baseSetupCost * OPENING_PERMIT_RATE * Math.max(0, (route.distance - 1) / 0.5));
  const initialStockCost = advice.firstStockCost;
  const initialLogisticsCost = r2(initialStockCost * OPENING_LOGISTICS_SETUP_RATE * Math.max(0, route.multiplier - 1));

  const costBeforeDiscount = r2(baseSetupCost + cityRentDeposit + regionalPermitCost + initialLogisticsCost);

  // İndirim: ilk dükkânda prestij; sonraki uygun dükkânda kilometre taşı. Aynı dükkânda birleşmez.
  let prestigeDiscount = 0;
  let milestoneDiscount = 0;
  let discountKind: CityExpansionQuote['discountKind'] = 'NONE';
  if (!isCompany) {
    const stars = state.prestige?.stars ?? 0;
    if (isFirstShop && stars > 0) {
      prestigeDiscount = r2(costBeforeDiscount * PRESTIGE_OPENING_DISCOUNT);
      discountKind = 'PRESTIGE';
    } else if (!isFirstShop && milestoneDiscountsAvailable(state) > 0) {
      milestoneDiscount = r2(costBeforeDiscount * MILESTONE_OPENING_DISCOUNT);
      discountKind = 'MILESTONE';
    }
  }

  const businessCost = r2(costBeforeDiscount - prestigeDiscount - milestoneDiscount);
  const totalUpfrontCost = r2(businessCost + workingCash);

  // Gider ve rezerv
  const staff = advice.ownerWorks ? 0 : tpl.minStaffRequired;
  const dailyFixedCost = r2(cityRentPerDay + 120 + staff * tpl.staffDailyWagePerPerson * wageFactor);
  const recommendedReserve = r2(dailyFixedCost * OPENING_RESERVE_DAYS);

  // Teslimat süresi: en yavaş ilk mal toptancısı + mesafe gecikmesi
  let days = 0;
  for (const rid of tpl.allowedResourceIds) {
    const best = TradeProcurement.getSupplierOffers(state, rid)
      .filter((o) => o.maxAvailableQuantity >= o.minOrderQuantity)
      .sort((a, b) => a.unitPrice + a.shippingCostPerUnit - (b.unitPrice + b.shippingCostPerUnit))[0];
    if (best) days = Math.max(days, best.deliveryDays);
  }
  const estimatedDeliveryDays = Math.max(1, days || 1) + distanceDeliveryExtraDays(route.kind);

  // Nakit: openShop ile aynı kurallar
  let spendableCash: number;
  let affordable: boolean;
  let cashAfterOpening: number;
  if (isCompany && state.playerCompany) {
    spendableCash = Math.max(0, r2(state.playerCompany.financials.cash));
    affordable = spendableCash >= totalUpfrontCost;
    cashAfterOpening = r2(Math.max(0, spendableCash - totalUpfrontCost));
  } else {
    spendableCash = Math.max(0, r2(state.cash - reservedCash));
    const restrictedUsed = Math.min(WalletEngine.restrictedFund(state), businessCost);
    const freeNeeded = r2(totalUpfrontCost - restrictedUsed);
    const freeAvailable = Math.max(0, r2(WalletEngine.freeCash(state) - reservedCash));
    affordable = spendableCash >= totalUpfrontCost && freeAvailable >= freeNeeded;
    cashAfterOpening = r2(workingCash + Math.max(0, spendableCash - totalUpfrontCost));
  }

  // Rezerv uyarısı: ilk stok alındıktan sonra elde kalan para, 7 günlük gidere göre
  const afterStock = cashAfterOpening - (isCompany ? 0 : initialStockCost);
  let warningLevel: ExpansionWarningLevel = 'NONE';
  if (afterStock < recommendedReserve) warningLevel = 'YELLOW';
  if (afterStock < recommendedReserve * 0.5) warningLevel = 'RED';
  if (afterStock < dailyFixedCost) warningLevel = 'CRITICAL';

  const def = getCityDefinition(cityId);
  const warningsTR: string[] = [];
  const extra = r2(regionalPermitCost + initialLogisticsCost);
  if (route.kind !== 'SAME_CITY' && extra > 0) {
    warningsTR.push(
      `${def.nameTR} merkezinden ${DISTANCE_LABEL_TR[route.kind].toLowerCase()} mesafede: ruhsat ve hat kurulumu için ${tl(extra)} ek maliyet var, mal ${estimatedDeliveryDays} günde gelir.`
    );
  }
  if (route.kind === 'FAR_REGION') {
    warningsTR.push('Uzak bölge: nakliye pahalı ve yavaş. Liman ya da şehir deposu bu yükü azaltır.');
  }
  if (rentFactor >= 1.2) {
    warningsTR.push(`Kira bu şehirde Ankara'dan %${Math.round((rentFactor - 1) * 100)} pahalı.`);
  }
  if (isFirstShop && !isCompany) warningsTR.push('İlk dükkânına kira depozitosu alınmaz.');
  if (discountKind === 'PRESTIGE') warningsTR.push(`Prestij indirimi: ${tl(prestigeDiscount)} (ilk dükkâna özel).`);
  if (discountKind === 'MILESTONE') warningsTR.push(`Kilometre taşı indirimi: ${tl(milestoneDiscount)}.`);
  if (!affordable) {
    warningsTR.push(`Nakdin yetmiyor: ${tl(totalUpfrontCost)} gerekir, kullanılabilir ${tl(spendableCash)}.`);
  } else if (warningLevel === 'YELLOW') {
    warningsTR.push(`Açılıştan sonra ${tl(Math.max(0, afterStock))} kalır; 7 günlük güvenlik rezervi ${tl(recommendedReserve)}. Biraz dar.`);
  } else if (warningLevel === 'RED') {
    warningsTR.push(`Dikkat: açılıştan sonra ${tl(Math.max(0, afterStock))} kalır, önerilen rezervin yarısından az (${tl(recommendedReserve)}).`);
  } else if (warningLevel === 'CRITICAL') {
    warningsTR.push(`KRİTİK: açılıştan sonra kalan para bir günlük gideri bile karşılamıyor (${tl(dailyFixedCost)}/gün).`);
  }

  return {
    cityId,
    shopType,
    baseSetupCost,
    cityRentDeposit,
    regionalPermitCost,
    initialStockCost,
    initialLogisticsCost,
    prestigeDiscount,
    milestoneDiscount,
    totalUpfrontCost,
    recommendedReserve,
    estimatedDeliveryDays,
    warningsTR,
    workingCash,
    costBeforeDiscount,
    discountKind,
    dailyFixedCost,
    cashAfterOpening,
    spendableCash,
    affordable,
    warningLevel,
    needsSecondConfirmation: affordable && warningLevel !== 'NONE',
    distanceKind: route.kind,
    distanceFactor: route.distance,
    logisticsMultiplier: route.multiplier,
    logisticsNotesTR: route.explanationTR,
    rentFactor,
    wageFactor,
  };
}
