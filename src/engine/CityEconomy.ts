/**
 * ŞEHİR EKONOMİSİ (Faz 8–9): şehir çarpanlarının talebe, kiraya, ücrete ve lojistiğe TEK yerden bağlandığı dosya.
 *
 * Kurallar:
 * - Her çarpan burada `safeMultiplier` ile sıkıştırılır (NaN, sonsuz, negatif → 1; sınırlar `cityBalance.ts`).
 * - Çarpanlar Ankara'ya oranlanır (`CITY_REFERENCE_ID`): oyunun bütün eski dengesi Ankara'da ölçüldü,
 *   Ankara'da her şey 1,0'dır; İstanbul daha pahalı, Konya daha ucuz olur.
 * - Şehri olmayan (eski) dükkân tarafsızdır: bütün çarpanlar 1.
 * - Bu dosya yalnızca saf hesap yapar. Gün kapanışı, gün içi satış, çevrimdışı ilerleme, canlı kâr ve arayüz
 *   AYNI fonksiyonları çağırır; bu yüzden çevrimiçi ve çevrimdışı sonuç ayrışmaz.
 */
import type { CityId, TurkeyRegion } from '../models/cities';
import type { ShopInstance, ShopType, Warehouse } from '../models/trade';
import type { SimulationState } from '../models/simulation';
import { clampCityBonus, clampCityMultiplier, getCityDefinition, isCityId } from '../data/cityDefinitions';
import {
  CITY_COMPETITION_EXPONENT,
  CITY_DEPOT_CAPACITY_UNITS,
  CITY_DEPOT_COST,
  CITY_PURCHASING_POWER_EXPONENT,
  CITY_REFERENCE_ID,
  CITY_RETAIL_BONUS_SHARE,
  CITY_SEASON_AMPLITUDE,
  CITY_SEASON_DAYS,
  CITY_SEASON_PEAK_DAY,
  CITY_SEASON_SHOP_WEIGHT,
  DISTANCE_FACTOR_FAR_REGION,
  DISTANCE_FACTOR_NEIGHBOR_REGION,
  DISTANCE_FACTOR_SAME_CITY,
  DISTANCE_FACTOR_SAME_REGION,
  LOGISTICS_DEPOT_DISCOUNT,
  LOGISTICS_DISCOUNT_CAP,
  LOGISTICS_HIGHWAY_DISCOUNT,
  LOGISTICS_PORT_DISCOUNT,
  PORT_CITY_IDS,
  REGION_NEIGHBORS,
} from '../data/cityBalance';

/** NaN / sonsuz / negatif / sıfır → yedek değer; aksi hâlde şehir çarpan sınırlarına sıkıştırılır. */
export function safeMultiplier(value: unknown, fallback = 1): number {
  const n = typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return clampCityMultiplier(n);
}

type ProfileKey =
  | 'demandMultiplier'
  | 'rentMultiplier'
  | 'wageMultiplier'
  | 'logisticsMultiplier'
  | 'competitionMultiplier'
  | 'purchasingPowerMultiplier';

/** Şehir çarpanı ÷ Ankara çarpanı. Şehir bilinmiyorsa 1. */
function relativeMultiplier(cityId: string | undefined | null, key: ProfileKey): number {
  if (!isCityId(cityId)) return 1;
  const ref = safeMultiplier(getCityDefinition(CITY_REFERENCE_ID)[key]);
  const own = safeMultiplier(getCityDefinition(cityId)[key]);
  const out = own / ref;
  return Number.isFinite(out) && out > 0 ? out : 1;
}

// ---------------------------------------------------------------------------
// Gider çarpanları
// ---------------------------------------------------------------------------

export function cityRentFactor(cityId: string | undefined | null): number {
  return relativeMultiplier(cityId, 'rentMultiplier');
}

export function cityWageFactor(cityId: string | undefined | null): number {
  return relativeMultiplier(cityId, 'wageMultiplier');
}

/** Şehre göre günlük kira (dükkânın temel kirası × şehir kira çarpanı). */
export function effectiveDailyRent(shop: Pick<ShopInstance, 'dailyRent' | 'cityId'>): number {
  return shop.dailyRent * cityRentFactor(shop.cityId);
}

/** Şehre göre kişi başı günlük maaş. */
export function effectiveWagePerPerson(shop: Pick<ShopInstance, 'staffDailyWagePerPerson' | 'cityId'>): number {
  return shop.staffDailyWagePerPerson * cityWageFactor(shop.cityId);
}

// ---------------------------------------------------------------------------
// Talep katmanları
// ---------------------------------------------------------------------------

export interface CityDemandLayers {
  /** şehir talep çarpanı (Ankara'ya oranlı) */
  demand: number;
  /** rekabet: müşteri sayısını böler */
  competition: number;
  /** dükkân türü bonusu */
  shopBonus: number;
  /** perakende sektör bonusu (yerel) */
  sectorBonus: number;
  /** mevsim */
  season: number;
  /** müşteri sayısına giren toplam çarpan */
  customers: number;
  /** satın alma gücü: sepet tutarına giren çarpan */
  basket: number;
}

const NEUTRAL_LAYERS: CityDemandLayers = {
  demand: 1,
  competition: 1,
  shopBonus: 1,
  sectorBonus: 1,
  season: 1,
  customers: 1,
  basket: 1,
};

/** Oyun günü için mevsim çarpanı (şehrin genliği ve dükkân türü ağırlığıyla; ortalaması 1). */
export function citySeasonFactor(cityId: string | undefined | null, shopType: ShopType, day: number): number {
  if (!isCityId(cityId)) return 1;
  const amp = CITY_SEASON_AMPLITUDE[cityId] ?? 0;
  if (amp <= 0 || !Number.isFinite(day)) return 1;
  const weight = CITY_SEASON_SHOP_WEIGHT[shopType] ?? 1;
  const phase = (2 * Math.PI * (day - CITY_SEASON_PEAK_DAY + CITY_SEASON_DAYS / 4)) / CITY_SEASON_DAYS;
  const v = 1 + amp * weight * Math.sin(phase);
  return Number.isFinite(v) && v > 0.3 ? v : 1;
}

export function cityDemandLayers(
  cityId: string | undefined | null,
  shopType: ShopType,
  day: number
): CityDemandLayers {
  if (!isCityId(cityId)) return NEUTRAL_LAYERS;
  const def = getCityDefinition(cityId);
  const demand = relativeMultiplier(cityId, 'demandMultiplier');
  const competition = Math.pow(relativeMultiplier(cityId, 'competitionMultiplier'), CITY_COMPETITION_EXPONENT);
  // Bonuslar da Ankara'ya oranlanır (eski denge Ankara'da ölçüldü): Ankara'nın kendi bonusu 1,0 sayılır.
  const ref = getCityDefinition(CITY_REFERENCE_ID);
  const shopBonus =
    (1 + clampCityBonus(def.shopBonuses[shopType] ?? 0)) / (1 + clampCityBonus(ref.shopBonuses[shopType] ?? 0));
  const sectorBonus =
    (1 + clampCityBonus((def.sectorBonuses.PERAKENDE ?? 0) * CITY_RETAIL_BONUS_SHARE)) /
    (1 + clampCityBonus((ref.sectorBonuses.PERAKENDE ?? 0) * CITY_RETAIL_BONUS_SHARE));
  const season = citySeasonFactor(cityId, shopType, day);
  const customers = (demand / competition) * shopBonus * sectorBonus * season;
  const basket = Math.pow(relativeMultiplier(cityId, 'purchasingPowerMultiplier'), CITY_PURCHASING_POWER_EXPONENT);
  const out: CityDemandLayers = { demand, competition, shopBonus, sectorBonus, season, customers, basket };
  for (const k of Object.keys(out) as Array<keyof CityDemandLayers>) {
    if (!Number.isFinite(out[k]) || out[k] <= 0) out[k] = 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lojistik ve mesafe
// ---------------------------------------------------------------------------

export type DistanceKind = 'SAME_CITY' | 'SAME_REGION' | 'NEIGHBOR_REGION' | 'FAR_REGION';

export const DISTANCE_LABEL_TR: Record<DistanceKind, string> = {
  SAME_CITY: 'Aynı şehir',
  SAME_REGION: 'Aynı bölge',
  NEIGHBOR_REGION: 'Komşu bölge',
  FAR_REGION: 'Uzak bölge',
};

function regionOf(cityId: CityId): TurkeyRegion {
  return getCityDefinition(cityId).region;
}

export function distanceKind(from: string | undefined | null, to: string | undefined | null): DistanceKind {
  if (!isCityId(from) || !isCityId(to) || from === to) return 'SAME_CITY';
  const a = regionOf(from);
  const b = regionOf(to);
  if (a === b) return 'SAME_REGION';
  if ((REGION_NEIGHBORS[a] ?? []).includes(b)) return 'NEIGHBOR_REGION';
  return 'FAR_REGION';
}

export function distanceFactor(from: string | undefined | null, to: string | undefined | null): number {
  switch (distanceKind(from, to)) {
    case 'SAME_CITY':
      return DISTANCE_FACTOR_SAME_CITY;
    case 'SAME_REGION':
      return DISTANCE_FACTOR_SAME_REGION;
    case 'NEIGHBOR_REGION':
      return DISTANCE_FACTOR_NEIGHBOR_REGION;
    default:
      return DISTANCE_FACTOR_FAR_REGION;
  }
}

/** Mal çıkış noktası: merkez şehir; yoksa başlangıç şehri; o da yoksa Ankara. */
export function supplyHubCityId(state: Pick<SimulationState, 'headquartersCityId' | 'playerStartCityId'>): CityId {
  if (isCityId(state.headquartersCityId)) return state.headquartersCityId;
  if (isCityId(state.playerStartCityId)) return state.playerStartCityId;
  return CITY_REFERENCE_ID;
}

export function cityHasPort(cityId: string | undefined | null): boolean {
  return typeof cityId === 'string' && PORT_CITY_IDS.has(cityId);
}

/** O şehirde, `qty` birimi daha taşıyacak boş yeri olan bir şehir deposu var mı? (yoksa null) */
export function findCityDepot(
  warehouses: readonly Warehouse[] | undefined,
  cityId: string | undefined | null,
  qty = 0
): Warehouse | null {
  if (!isCityId(cityId)) return null;
  for (const w of warehouses ?? []) {
    if (w.cityId !== cityId) continue;
    if (w.usedCapacityUnits + Math.max(0, qty) <= w.maxCapacityUnits) return w;
  }
  return null;
}

export interface LogisticsRoute {
  fromCityId: CityId;
  toCityId: CityId | null;
  kind: DistanceKind;
  /** mesafe çarpanı (1,00 / 1,10 / 1,25 / 1,50) */
  distance: number;
  /** şehrin kendi lojistik çarpanı (Ankara'ya oranlı) */
  cityFactor: number;
  port: boolean;
  depot: boolean;
  highway: boolean;
  /** toplam indirim oranı (0–0,35); her rota için bir kez */
  discount: number;
  /** nakliyenin taban ücretine çarpılacak son sayı */
  multiplier: number;
  explanationTR: string[];
}

export interface LogisticsContext {
  /** Dükkânın kargo anlaşması (otoyol/lojistik yükseltmesi) var mı? */
  highway?: boolean;
  /** Bu sevkiyatın birim sayısı (şehir deposunun boş yerini denetlemek için) */
  quantity?: number;
}

/**
 * Hedef şehre mal taşımanın çarpanı = şehir lojistik çarpanı × mesafe × (1 − indirim).
 * İndirimler (liman %15, şehir deposu %20, otoyol/kargo anlaşması %10) toplanır, en çok %35; aynı rotada bir kez.
 */
export function computeLogisticsRoute(
  state: Pick<SimulationState, 'headquartersCityId' | 'playerStartCityId' | 'tradeState'>,
  toCityId: string | undefined | null,
  ctx: LogisticsContext = {}
): LogisticsRoute {
  const from = supplyHubCityId(state);
  const to = isCityId(toCityId) ? toCityId : null;
  if (!to) {
    return {
      fromCityId: from,
      toCityId: null,
      kind: 'SAME_CITY',
      distance: 1,
      cityFactor: 1,
      port: false,
      depot: false,
      highway: false,
      discount: 0,
      multiplier: 1,
      explanationTR: [],
    };
  }
  const kind = distanceKind(from, to);
  const distance = distanceFactor(from, to);
  const cityFactor = relativeMultiplier(to, 'logisticsMultiplier');
  const port = cityHasPort(to);
  const depot = findCityDepot(state.tradeState?.warehouses, to, ctx.quantity ?? 0) !== null;
  const highway = Boolean(ctx.highway);
  const discount = Math.min(
    LOGISTICS_DISCOUNT_CAP,
    (port ? LOGISTICS_PORT_DISCOUNT : 0) + (depot ? LOGISTICS_DEPOT_DISCOUNT : 0) + (highway ? LOGISTICS_HIGHWAY_DISCOUNT : 0)
  );
  const raw = cityFactor * distance * (1 - discount);
  const multiplier = Number.isFinite(raw) && raw > 0 ? raw : 1;
  const name = getCityDefinition(to).nameTR;
  const hubName = getCityDefinition(from).nameTR;
  const lines: string[] = [];
  lines.push(
    kind === 'SAME_CITY'
      ? `${name} merkez şehrinle aynı: mesafe farkı yok (×1,00).`
      : `${hubName} → ${name}: ${DISTANCE_LABEL_TR[kind].toLowerCase()} (×${distance.toFixed(2).replace('.', ',')}).`
  );
  if (port) lines.push(`${name} limanı var: nakliye %${Math.round(LOGISTICS_PORT_DISCOUNT * 100)} ucuz.`);
  if (depot) lines.push(`${name} şehir deponu kullanıyorsun: nakliye %${Math.round(LOGISTICS_DEPOT_DISCOUNT * 100)} ucuz.`);
  if (highway) lines.push(`Kargo anlaşman var: nakliye %${Math.round(LOGISTICS_HIGHWAY_DISCOUNT * 100)} ucuz.`);
  if (!port && !depot && kind !== 'SAME_CITY') lines.push(`Liman ya da ${name} şehir deposu olsaydı nakliye daha ucuz olurdu.`);
  return { fromCityId: from, toCityId: to, kind, distance, cityFactor, port, depot, highway, discount, multiplier, explanationTR: lines };
}

/** Dükkâna giden bir sevkiyatın lojistik rotası (kargo anlaşması otoyol indirimi sayılır). */
export function shopLogisticsRoute(
  state: Pick<SimulationState, 'headquartersCityId' | 'playerStartCityId' | 'tradeState'>,
  shop: Pick<ShopInstance, 'cityId' | 'cargoContract' | 'isCompanyBranch'> | undefined | null,
  quantity = 0
): LogisticsRoute {
  // Kargo anlaşması (Lojistik Merkezi) zaten kendi %50 nakliye indirimini ayrıca verir (`cargoAdjust`);
  // otoyol indirimi onun üstüne İKİNCİ KEZ eklenmez. Bu yüzden burada highway kapalı tutulur.
  const route = computeLogisticsRoute(state, shop?.cityId, { highway: false, quantity });
  if (shop?.cargoContract && !shop.isCompanyBranch) {
    route.explanationTR.push('Kargo anlaşman var: nakliye ayrıca %50 ucuz (Lojistik Merkezi).');
  }
  return route;
}

/** Sevkiyat tahmini teslim süresine eklenecek gün (uzak şehirde yavaşlık). Yalnızca teklifte gösterilir. */
export function distanceDeliveryExtraDays(kind: DistanceKind): number {
  switch (kind) {
    case 'SAME_CITY':
      return 0;
    case 'SAME_REGION':
      return 0;
    case 'NEIGHBOR_REGION':
      return 1;
    default:
      return 2;
  }
}

// ---------------------------------------------------------------------------
// Şehir deposu
// ---------------------------------------------------------------------------

export interface CityDepotResult {
  success: boolean;
  message: string;
}

export function cityDepotQuote(state: SimulationState, cityId: string): { cost: number; exists: boolean } {
  return {
    cost: CITY_DEPOT_COST,
    exists: isCityId(cityId) && (state.tradeState?.warehouses ?? []).some((w) => w.cityId === cityId),
  };
}

export function cityDepotId(cityId: string): string {
  return `WH_CITY_${cityId.toUpperCase()}`;
}

/** Şehre depo (dağıtım deposu) kurar. Kişisel dükkânı olan oyuncu kişisel nakitten öder (tek seferlik, defter kaydı ayrı). */
export function describeDepotAdvantageTR(cityId: string): string {
  const name = isCityId(cityId) ? getCityDefinition(cityId).nameTR : 'Bu şehir';
  return `${name} şehir deposu: ${name}'deki dükkânlara giden malın nakliyesi %${Math.round(LOGISTICS_DEPOT_DISCOUNT * 100)} ucuzlar (kapasite ${CITY_DEPOT_CAPACITY_UNITS.toLocaleString('tr-TR')} birim).`;
}
