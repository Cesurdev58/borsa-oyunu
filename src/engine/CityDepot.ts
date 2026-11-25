/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞEHİR DEPOSU (Faz 3.2) — kurma ve özet hesapları.
 *
 * Lojistik indirimi zaten `CityEconomy.computeLogisticsRoute` içinde bağlıdır: o şehirde boş yeri olan bir depo
 * (`Warehouse.cityId`) varsa o şehre giden kişisel dükkân siparişlerinin nakliyesi `LOGISTICS_DEPOT_DISCOUNT`
 * kadar ucuzlar (liman indirimiyle toplanır, en çok `LOGISTICS_DISCOUNT_CAP`, rota başına bir kez). Bu dosya
 * yalnızca deponun kurulmasını ve arayüzde gösterilecek gerçek rakamları (son 30 günün nakliyesi, tahmini
 * tasarruf, geri dönüş süresi) hesaplar. Yalnızca veri, modeller ve alt motorları içe aktarır (döngü yok).
 */
import type { SimulationState } from '../models/simulation';
import type { Warehouse } from '../models/trade';
import type { CityId } from '../models/cities';
import { getCityDefinition, isCityId } from '../data/cityDefinitions';
import {
  CITY_DEPOT_CAPACITY_UNITS,
  CITY_DEPOT_COST,
  LOGISTICS_DEPOT_DISCOUNT,
  LOGISTICS_DISCOUNT_CAP,
  LOGISTICS_PORT_DISCOUNT,
} from '../data/cityBalance';
import { cityDepotId, cityHasPort } from './CityEconomy';
import { WalletEngine } from './WalletEngine';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';
import { TradeUniverse } from './TradeUniverse';

/** Tasarruf tahmini için geriye bakılan gün sayısı. */
export const CITY_DEPOT_LOOKBACK_DAYS = 30;

export type CityDepotBlockReason = 'INVALID_CITY' | 'EXISTS' | 'NO_SHOP' | 'NO_CASH';

export interface CityDepotPlan {
  cityId: CityId;
  cityNameTR: string;
  cost: number;
  capacityUnits: number;
  exists: boolean;
  /** Bu şehirdeki kişisel dükkân sayısı (depo yalnızca bunlara indirim verir). */
  shopCount: number;
  spendableCash: number;
  /** Şu an rotaya uygulanan indirim (liman) ve depo kurulunca olacak indirim (yüzde, 0–100). */
  discountNowPct: number;
  discountWithDepotPct: number;
  /** Son 30 günde bu şehirdeki dükkânlara verilen siparişlerin nakliyesi (₺). */
  shippingLast30Days: number;
  /** Depo o 30 günde olsaydı nakliyeden düşecek tutar (₺). */
  estimatedSaving30Days: number;
  /** Kurulum bedelinin bu tasarrufla kaç günde çıkacağı (tasarruf yoksa null). */
  paybackDays: number | null;
  canBuild: boolean;
  blockReason?: CityDepotBlockReason;
  blockReasonTR?: string;
}

export interface CityDepotSummary {
  warehouseId: string;
  cityId: CityId;
  cityNameTR: string;
  usedUnits: number;
  maxUnits: number;
  usedPct: number;
}

function r2(v: number): number {
  return Number(v.toFixed(2));
}

function personalShopsIn(state: SimulationState, cityId: string) {
  return (state.tradeState?.shops ?? []).filter((s) => !s.isCompanyBranch && s.cityId === cityId);
}

function hasDepot(state: SimulationState, cityId: string): boolean {
  return (state.tradeState?.warehouses ?? []).some((w) => w.cityId === cityId);
}

/** Bir şehir için depo teklifi: bedel, mevcut durum ve son 30 günün nakliyesinden tahmini tasarruf. */
export function getCityDepotPlan(
  state: SimulationState,
  cityId: string,
  reservedCash = 0
): CityDepotPlan {
  const valid = isCityId(cityId);
  const id = (valid ? cityId : 'ankara') as CityId;
  const cityNameTR = valid ? getCityDefinition(id).nameTR : String(cityId);
  const shops = valid ? personalShopsIn(state, id) : [];
  const shopIds = new Set(shops.map((s) => s.shopId));
  const exists = valid && hasDepot(state, id);

  const port = valid && cityHasPort(id);
  const now = Math.min(LOGISTICS_DISCOUNT_CAP, port ? LOGISTICS_PORT_DISCOUNT : 0);
  const withDepot = Math.min(LOGISTICS_DISCOUNT_CAP, now + LOGISTICS_DEPOT_DISCOUNT);

  // Son 30 günün gerçek nakliyesi (yalnızca bu şehirdeki kişisel dükkânlara verilen siparişler)
  const fromDay = state.day - CITY_DEPOT_LOOKBACK_DAYS;
  const shipping = (state.tradeState?.procurementOrders ?? [])
    .filter(
      (o) =>
        o.targetDestinationType === 'SHOP' &&
        shopIds.has(o.targetDestinationId) &&
        o.createdDay > fromDay &&
        o.status !== 'CANCELLED'
    )
    .reduce((sum, o) => sum + Math.max(0, o.shippingCost), 0);
  // Nakliye (1 − indirim) ile orantılıdır: depolu tutar = şimdiki × (1 − depolu) / (1 − şimdiki)
  const saving = exists ? 0 : shipping * (1 - (1 - withDepot) / (1 - now));
  const dailySaving = saving / CITY_DEPOT_LOOKBACK_DAYS;
  const paybackDays = dailySaving > 0 ? Math.ceil(CITY_DEPOT_COST / dailySaving) : null;

  const spendable = Math.max(0, state.cash - reservedCash);
  let blockReason: CityDepotBlockReason | undefined;
  let blockReasonTR: string | undefined;
  if (!valid) {
    blockReason = 'INVALID_CITY';
    blockReasonTR = 'Şehir bulunamadı.';
  } else if (exists) {
    blockReason = 'EXISTS';
    blockReasonTR = `${cityNameTR} şehrinde zaten deponun var.`;
  } else if (shops.length === 0) {
    blockReason = 'NO_SHOP';
    blockReasonTR = `Depo yalnızca dükkânlarına indirim verir: önce ${cityNameTR} şehrinde dükkân aç.`;
  } else if (spendable < CITY_DEPOT_COST) {
    blockReason = 'NO_CASH';
    blockReasonTR = `Depo için ${Math.round(CITY_DEPOT_COST).toLocaleString('tr-TR')} ₺ gerekiyor.`;
  }

  return {
    cityId: id,
    cityNameTR,
    cost: CITY_DEPOT_COST,
    capacityUnits: CITY_DEPOT_CAPACITY_UNITS,
    exists,
    shopCount: shops.length,
    spendableCash: r2(spendable),
    discountNowPct: Math.round(now * 100),
    discountWithDepotPct: Math.round(withDepot * 100),
    shippingLast30Days: Math.round(shipping),
    estimatedSaving30Days: Math.round(saving),
    paybackDays,
    canBuild: blockReason === undefined,
    blockReason,
    blockReasonTR,
  };
}

/**
 * Şehre depo kurar. İşletme harcamasıdır (dükkân açılışı gibi): bedel önce kısıtlı işletme kredisi bakiyesinden,
 * sonra serbest nakitten düşer; merkezi defterde ayrı satır (`CITY-DEPOT-<şehir>`) yazılır.
 * Aynı şehirde ikinci kez kurulmaz (`duplicate: true`, para düşmez).
 */
export function buildCityDepot(
  state: SimulationState,
  cityId: string,
  reservedCash = 0
): { success: boolean; message: string; duplicate?: boolean } {
  const plan = getCityDepotPlan(state, cityId, reservedCash);
  if (plan.blockReason === 'EXISTS') {
    return { success: false, duplicate: true, message: plan.blockReasonTR ?? 'Depo zaten var.' };
  }
  if (!plan.canBuild) {
    return { success: false, message: plan.blockReasonTR ?? 'Depo kurulamadı.' };
  }
  const ts = TradeUniverse.ensureTradeUniverseState(state);
  WalletEngine.spendBusiness(state, plan.cost);
  CentralLedgerEngine.recordPostedAccountingEntry(state, {
    idempotencyKey: `CITY-DEPOT-${plan.cityId}`,
    sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    destinationAccountId: ACCOUNT_IDS.OPERATING_EXPENSE,
    amount: plan.cost,
    category: 'OPERATING_EXPENSE_PAYMENT',
    description: `Şehir deposu kuruldu: ${plan.cityNameTR}`,
    reservedOrderCash: reservedCash,
  });
  const depot: Warehouse = {
    warehouseId: cityDepotId(plan.cityId),
    nameTR: `${plan.cityNameTR} Şehir Deposu`,
    type: 'DISTRIBUTION',
    level: 1,
    maxCapacityUnits: plan.capacityUnits,
    usedCapacityUnits: 0,
    dailyOperatingCost: 0,
    dailyStorageCostPerUnit: 0,
    spoilageProtectionFactor: 1,
    batches: [],
    cityId: plan.cityId,
  };
  ts.warehouses.push(depot);
  return {
    success: true,
    message: `${plan.cityNameTR} şehir deposu kuruldu: buradaki dükkânlarına giden malın nakliyesi %${plan.discountWithDepotPct - plan.discountNowPct} daha ucuz.`,
  };
}

/** Oyuncunun şehir depoları (şehri yazılı depolar), doluluklarıyla. */
export function listCityDepots(state: SimulationState): CityDepotSummary[] {
  return (state.tradeState?.warehouses ?? [])
    .filter((w) => isCityId(w.cityId))
    .map((w) => {
      const cityId = w.cityId as CityId;
      return {
        warehouseId: w.warehouseId,
        cityId,
        cityNameTR: getCityDefinition(cityId).nameTR,
        usedUnits: w.usedCapacityUnits,
        maxUnits: w.maxCapacityUnits,
        usedPct: w.maxCapacityUnits > 0 ? Math.round((w.usedCapacityUnits / w.maxCapacityUnits) * 100) : 0,
      };
    });
}
