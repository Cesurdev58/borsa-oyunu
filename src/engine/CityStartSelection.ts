/**
 * Yeni kariyerde başlangıç şehri seçimi (Faz 5).
 *
 * - Seçim kayda yazılır: `state.playerStartCityId` ve `state.headquartersCityId` (merkez = başlangıç şehri).
 * - Seçim yalnızca BİR KEZ uygulanır; ikinci çağrı (geri tuşu, çift dokunuş) hiçbir şeyi değiştirmez.
 * - Şehre kilit yoktur: 81 ilin hepsi seçilebilir (komşuluk şartı yok).
 * - Maliyet/gider rakamları `getCityOpeningQuote` ile motorun gerçek açılış tutarlarından gelir.
 *   NOT: Şehir çarpanları (kira, maaş…) henüz oyun içi giderleri değiştirmediği için burada da uygulanmaz (Faz 7).
 */
import type { CityDefinition, CityId } from '../models/cities';
import type { ShopType } from '../models/trade';
import type { SimulationState } from '../models/simulation';
import { SHOP_TEMPLATES } from '../data/tradeCatalog';
import { CITY_DEFINITIONS, isCityId } from '../data/cityDefinitions';
import { isCitySelectionPending } from './CityMigration';
import { getCityOpeningQuote, type CityOpeningQuote } from './CityOpeningQuote';
import { getOpeningAdvice } from './ShopOnboarding';

/** Yeni kariyer mi ve şehir henüz seçilmedi mi? (eski kayıtlar buraya girmez: onlar merkez seçimi/göç yolunu kullanır) */
export function needsStartCitySelection(state: SimulationState): boolean {
  if (isCityId(state.playerStartCityId) || isCityId(state.headquartersCityId)) return false;
  if (state.cityMigration) return false;
  if (isCitySelectionPending(state)) return false;
  if ((state.tradeState?.shops.length ?? 0) > 0) return false;
  return (state.day ?? 1) <= 1;
}

export interface StartCityChoiceResult {
  success: boolean;
  /** true = bu çağrıda uygulandı; false = zaten seçilmişti ya da geçersizdi. */
  applied: boolean;
  message: string;
}

export function chooseStartCity(state: SimulationState, cityId: string): StartCityChoiceResult {
  if (!isCityId(cityId)) {
    return { success: false, applied: false, message: 'Geçersiz şehir.' };
  }
  if (!needsStartCitySelection(state)) {
    return { success: true, applied: false, message: 'Başlangıç şehri zaten seçilmiş.' };
  }
  state.playerStartCityId = cityId;
  state.headquartersCityId = cityId;
  state.selectedMapCityId = cityId;
  return { success: true, applied: true, message: `${CITY_DEFINITIONS[cityId].nameTR} şehrinde başlıyorsun.` };
}

/** Şehre uygun önerilen ilk dükkân türü: ilk dükkân için uygun türler arasında şehir bonusu en yüksek olan. */
export function recommendedFirstShopType(city: CityDefinition): ShopType {
  const candidates: ShopType[] = ['BUFE', 'MANAV', 'KAFE'];
  let best: ShopType = 'BUFE';
  let bestBonus = city.shopBonuses.BUFE ?? 0;
  for (const t of candidates) {
    const b = city.shopBonuses[t] ?? 0;
    if (b > bestBonus + 1e-9) { best = t; bestBonus = b; }
  }
  return best;
}

export interface StartCitySummary {
  cityId: CityId;
  difficulty: CityDefinition['difficulty'];
  recommendedShopType: ShopType;
  recommendedShopNameTR: string;
  quote: CityOpeningQuote;
  /** İlk 7 günün sabit gideri (kira + işletme + maaş), motorun kendi hesabıyla. */
  sevenDayRunningCost: number;
  /** Açılıştan sonra elde kalan serbest para (peşin tutar düşülmüş). */
  cashAfterOpening: number;
  /** Zor şehir uyarısı (boşsa uyarı yok). */
  warningTR: string | null;
  /** Şehir çarpanları oyun içi giderlere henüz yansımıyor (Faz 7); arayüz bunu açıkça söyler. */
  cityPricingApplied: false;
}

export function getStartCitySummary(state: SimulationState, cityId: CityId, reservedCash = 0): StartCitySummary {
  const city = CITY_DEFINITIONS[cityId];
  const type = recommendedFirstShopType(city);
  const quote = getCityOpeningQuote(state, cityId, type, reservedCash);
  const advice = getOpeningAdvice(state, type, undefined, reservedCash);
  const sevenDay = Math.round(advice.dailyFixedCost * 7);
  const cashAfter = Math.max(0, Math.round(quote.spendableCash - quote.totalUpfrontCost));
  const warningTR =
    city.difficulty === 'HARD'
      ? `${city.nameTR} zor bir başlangıç: ${city.disadvantagesTR.slice(0, 2).join('; ')}. İstersen yine de seçebilirsin.`
      : null;
  return {
    cityId,
    difficulty: city.difficulty,
    recommendedShopType: type,
    recommendedShopNameTR: SHOP_TEMPLATES[type].nameTR,
    quote,
    sevenDayRunningCost: sevenDay,
    cashAfterOpening: cashAfter,
    warningTR,
    cityPricingApplied: false,
  };
}
