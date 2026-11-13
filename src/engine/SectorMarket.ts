/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SEKTÖR PAZARI
 * Her sektörün sınırlı bir günlük pazarı (birim/gün) vardır. Pazarın bir kısmını adı bilinen rakipler
 * (NPC şirketleri), kalanını küçük firmalar tutar. Oyuncu şirketi yalnızca rakiplerin bıraktığı boşluğa
 * satabilir; büyüdükçe rakiplerden müşteri çeker, rakip devralınca o rakip artık oyuncuyla yarışmaz.
 * Yalnızca veri ve model içe aktarır (döngü oluşturmaz).
 */

import { NPC_COMPANY_BLUEPRINTS } from '../data/npcCompanies';
import {
  MARKET_REACH_BASE,
  NPC_SCALE,
  RIVAL_PRESSURE,
  RIVAL_START_SHARE,
} from '../data/gameBalance';
import { SectorId } from '../models/market';
import { SimulationState } from '../models/simulation';

/** Rakiplerin kapasitesinin normalde satılan kısmı (NPC talep formülündeki ~0,84 × makro ~0,95) */
const RIVAL_SELL_THROUGH = 0.8;

const marketCache: Partial<Record<SectorId, number>> = {};

/** Sektörün temel günlük pazarı (birim/gün), makro dalgalanma hariç */
export function baseSectorMarketUnits(sector: SectorId): number {
  const cached = marketCache[sector];
  if (cached) return cached;
  const rivalCap = NPC_COMPANY_BLUEPRINTS.filter((b) => b.sector === sector).reduce(
    (sum, b) => sum + b.productionCapacityUnits,
    0
  );
  const units = Math.round(
    (Math.max(100, rivalCap) * NPC_SCALE * RIVAL_SELL_THROUGH) / RIVAL_START_SHARE
  );
  marketCache[sector] = units;
  return units;
}

export interface PlayerMarketContext {
  marketUnits: number;
  uncontrolledRivalUnits: number;
  controlledRivalUnits: number;
}

/** Oyuncu şirketinin sektöründeki rakip satışlarını okur ve şirkete yazar (gün kapanışı ve gün içi adımdan önce). */
export function refreshPlayerMarketContext(state: SimulationState): void {
  const pc = state.playerCompany;
  if (!pc || !pc.operations) return;
  let uncontrolled = 0;
  let controlled = 0;
  for (const s of state.stocks) {
    if (s.isPlayerCompany || s.sector !== pc.sector) continue;
    const sold = Math.max(0, s.financials?.dailyUnitsSold ?? 0);
    if (s.isControlledByPlayer) controlled += sold;
    else uncontrolled += sold;
  }
  pc.operations.sectorMarketUnits = baseSectorMarketUnits(pc.sector);
  pc.operations.rivalUnitsInMarket = Math.round(uncontrolled);
  pc.operations.controlledRivalUnits = Math.round(controlled);
}

/** Kayıtta bağlam yoksa (eski kayıt ya da doğrudan motor testi) varsayılan: rakipler başlangıç payında. */
export function readMarketContext(
  sector: SectorId,
  ops: { sectorMarketUnits?: number; rivalUnitsInMarket?: number; controlledRivalUnits?: number }
): PlayerMarketContext {
  const marketUnits = ops.sectorMarketUnits ?? baseSectorMarketUnits(sector);
  return {
    marketUnits,
    uncontrolledRivalUnits: ops.rivalUnitsInMarket ?? marketUnits * RIVAL_START_SHARE,
    controlledRivalUnits: ops.controlledRivalUnits ?? 0,
  };
}

/**
 * Oyuncunun bugün satabileceği en fazla birim.
 * rawDemand: şirketin kendi kapasitesi ve çekiciliğinden gelen ham talep (eski formül).
 * Boş pazar dolarken satış yumuşakça tavana yaklaşır (yumuşak en-küçük); küçük şirket bunu hissetmez.
 */
export function saturatedPlayerDemand(params: {
  rawDemand: number;
  demandShare: number;
  macroFactor: number;
  context: PlayerMarketContext;
}): { units: number; roomUnits: number; marketUnits: number } {
  const { rawDemand, demandShare, macroFactor, context } = params;
  const marketUnits = Math.max(1, context.marketUnits * macroFactor);
  const reach = Math.max(0.6, Math.min(1, MARKET_REACH_BASE + demandShare));
  const freeRoom = Math.max(marketUnits * 0.05, marketUnits - context.uncontrolledRivalUnits);
  const room = freeRoom * reach;
  if (rawDemand <= 0) return { units: 0, roomUnits: room, marketUnits };
  // Yumuşak tavan: talep boşluğun yarısındayken neredeyse hiç fark edilmez, boşluğa yaklaştıkça tavana dayanır
  const units = rawDemand / Math.pow(1 + Math.pow(rawDemand / room, 4), 0.25);
  return { units: Math.max(0, Math.round(units)), roomUnits: room, marketUnits };
}

/** Rakibin talep çarpanı: oyuncu aynı sektörde büyüdükçe rakip müşteri kaybeder. Kontrol edilen rakip etkilenmez. */
export function rivalDemandMultiplier(state: SimulationState, sector: SectorId, controlled: boolean): number {
  const pc = state.playerCompany;
  if (controlled || !pc || pc.sector !== sector || !pc.operations) return 1;
  const market = pc.operations.sectorMarketUnits ?? baseSectorMarketUnits(sector);
  const share = Math.max(0, Math.min(1, (pc.operations.actualSalesUnits ?? 0) / Math.max(1, market)));
  return Math.max(0.3, 1 - RIVAL_PRESSURE * share);
}
