/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞEHİR HİZMETLERİ (CityServices) — şehirdeki binaların kendi işleri.
 * Veri `data/cityServices.ts`.
 *  - İkinci El Pazarı: `sellShopStockSecondHand` (fazla malı alış maliyetinin %60'ına satar, para dükkân kasasına),
 *    `usedUpgradeOffers` + `buyUsedUpgrade` (günde 3 ilan; yenisinin yarı fiyatına, 60 gün dayanan küçük yükseltme;
 *    `ShopInstance.usedUpgrades`, süresi `stepCityServicesDayClose` ile biter).
 *  - Belediye: `fundCityProject` (sırayla açılan mahalle projeleri, `tradeState.cityProjects`; etkisi
 *    `cityProjectCustomerMultiplier` ile `ShopSales` müşteri hesabında).
 *  - Trafo: `buySolarPanel` (`ShopInstance.solarPanel`; etkisi `TradeAndShopEngine` kira + işletme giderinde).
 * Ödemeler: dükkân işleri önce dükkân kasasından, yetmezse kişisel nakitten (yükseltmelerle aynı); belediye
 * projeleri kişisel nakitten (WalletEngine + merkezi defter). İlanlar tohum + günden hesaplanır (sayı üretecine
 * dokunmaz; aynı kayıt aynı ilanları gösterir). Yalnızca veri, modeller ve alt motorları içe aktarır.
 */
import {
  CITY_PROJECTS,
  SECONDHAND_SELL_RATE,
  SOLAR_OPEX_CUT,
  SOLAR_PAYBACK_DAYS,
  USED_OFFERS_PER_DAY,
  USED_UPGRADE_DAYS,
  USED_UPGRADE_PRICE_SHARE,
  type CityProjectDef,
} from '../data/cityServices';
import { REPUTATION_MAX } from '../data/lifestyle';
import { RESOURCE_CATALOG } from '../data/tradeCatalog';
import { SHOP_UPGRADES, type ShopUpgradeDef } from '../data/shopUpgrades';
import type { SimulationState } from '../models/simulation';
import type { ShopInstance } from '../models/trade';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';
import { shopUpgradeCost } from './ShopUpgrades';
import { TradeInventory } from './TradeInventory';
import { TradeUniverse } from './TradeUniverse';
import { WalletEngine } from './WalletEngine';

type Result = { success: boolean; message: string };

const r2 = (v: number) => Math.round(v * 100) / 100;
const tl = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;

function personalShops(state: SimulationState): ShopInstance[] {
  return (state.tradeState?.shops ?? []).filter((s) => !s.isCompanyBranch);
}

/** Şehir hizmetleri ilk kişisel dükkân açılınca kullanılabilir */
export function cityServicesOpen(state: SimulationState): boolean {
  return personalShops(state).length > 0;
}

/** Önce dükkân kasasından, yetmezse kişisel nakitten öder. Yetmezse false. */
function payFromShopThenPlayer(state: SimulationState, shop: ShopInstance, cost: number, reservedCash: number): boolean {
  const spendablePlayer = Math.max(0, state.cash - reservedCash);
  if (shop.cashAccountBalance + spendablePlayer < cost) return false;
  const fromShop = Math.min(shop.cashAccountBalance, cost);
  const fromPlayer = r2(cost - fromShop);
  shop.cashAccountBalance = r2(shop.cashAccountBalance - fromShop);
  if (fromPlayer > 0) WalletEngine.spend(state, fromPlayer);
  shop.totalInvestedCapital = r2(shop.totalInvestedCapital + cost);
  return true;
}

// ---------------------------------------------------------------------------
// İKİNCİ EL PAZARI — fazla mal
// ---------------------------------------------------------------------------

export interface SecondHandStockLine {
  resourceId: string;
  name: string;
  units: number;
  /** Bu malın alış maliyeti toplamı */
  costValue: number;
  /** Hepsi satılınca kasaya girecek para */
  payout: number;
}

/** Dükkândaki satılabilir mallar ve ikinci el pazarının vereceği para */
export function secondHandStockLines(shop: ShopInstance): SecondHandStockLine[] {
  const by = new Map<string, { units: number; cost: number; name: string }>();
  for (const b of shop.inventoryBatches) {
    if (b.availableQuantity <= 0) continue;
    const e = by.get(b.resourceId) ?? { units: 0, cost: 0, name: RESOURCE_CATALOG[b.resourceId]?.nameTR ?? b.resourceNameTR };
    e.units += b.availableQuantity;
    e.cost += b.availableQuantity * b.unitCost;
    by.set(b.resourceId, e);
  }
  return [...by.entries()].map(([resourceId, e]) => ({
    resourceId,
    name: e.name,
    units: e.units,
    costValue: r2(e.cost),
    payout: Math.floor(e.cost * SECONDHAND_SELL_RATE),
  }));
}

/** Bir dükkândaki bir malın (units verilmezse hepsini) ikinci el pazarına satar. Para dükkân kasasına girer. */
export function sellShopStockSecondHand(
  state: SimulationState,
  shopId: string,
  resourceId: string,
  units?: number
): Result & { payout: number; units: number } {
  const shop = personalShops(state).find((s) => s.shopId === shopId);
  if (!shop) return { success: false, message: 'Dükkân bulunamadı.', payout: 0, units: 0 };
  const available = TradeInventory.getAvailableResourceUnits(shop.inventoryBatches, resourceId);
  const want = Math.min(available, Math.max(0, Math.floor(units ?? available)));
  if (want <= 0) return { success: false, message: 'Satılacak mal yok.', payout: 0, units: 0 };
  const used = TradeInventory.consumeFromInventoryBatches(shop.inventoryBatches, resourceId, want);
  const payout = Math.floor(used.totalCostBasis * SECONDHAND_SELL_RATE);
  shop.cashAccountBalance = r2(shop.cashAccountBalance + payout);
  const name = RESOURCE_CATALOG[resourceId]?.nameTR ?? resourceId;
  return {
    success: true,
    message: `${shop.nameTR}: ${used.consumedUnits} birim ${name} ikinci el pazarına satıldı, kasaya ${tl(payout)} girdi.`,
    payout,
    units: used.consumedUnits,
  };
}

// ---------------------------------------------------------------------------
// İKİNCİ EL PAZARI — süreli eşya ilanları
// ---------------------------------------------------------------------------

export interface UsedUpgradeOffer {
  key: string;
  shopId: string;
  shopName: string;
  def: ShopUpgradeDef;
  price: number;
  newPrice: number;
  days: number;
  /** Bugün alındı (ilan yerinde "Satıldı" görünür, yerine yenisi gelmez) */
  sold?: boolean;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bugünün ikinci el eşya ilanları (oyuncunun dükkânlarında olmayan, seviyesi yeten küçük yükseltmeler) */
export function usedUpgradeOffers(state: SimulationState): UsedUpgradeOffer[] {
  const candidates: UsedUpgradeOffer[] = [];
  for (const shop of personalShops(state)) {
    for (const def of SHOP_UPGRADES) {
      if ((shop.upgrades ?? []).includes(def.id)) continue;
      const until = shop.usedUpgrades?.[def.id];
      // Bugün alınan ilan listede "satıldı" olarak kalır; daha önce alınmış (hâlâ kullanılan) eşya ilan olmaz
      const soldToday = until !== undefined && until - USED_UPGRADE_DAYS === state.day;
      if (until !== undefined && !soldToday) continue;
      if (shop.level < def.minLevel) continue;
      const newPrice = shopUpgradeCost(shop, def);
      candidates.push({
        key: `${shop.shopId}:${def.id}`,
        shopId: shop.shopId,
        shopName: shop.nameTR,
        def,
        price: Math.max(500, Math.round((newPrice * USED_UPGRADE_PRICE_SHARE) / 500) * 500),
        newPrice,
        days: USED_UPGRADE_DAYS,
        sold: soldToday,
      });
    }
  }
  // Tohum + güne göre sırala, ilk birkaçını göster (aynı gün hep aynı ilanlar)
  const seed = `${state.seed}-${state.day}`;
  return candidates
    .map((c) => ({ c, h: hash(`${seed}-${c.key}`) }))
    .sort((a, b) => a.h - b.h)
    .slice(0, USED_OFFERS_PER_DAY)
    .map((x) => x.c);
}

export function buyUsedUpgrade(state: SimulationState, offerKey: string, reservedCash: number): Result {
  const offer = usedUpgradeOffers(state).find((o) => o.key === offerKey);
  if (!offer || offer.sold) return { success: false, message: 'Bu ilan artık yok.' };
  const shop = personalShops(state).find((s) => s.shopId === offer.shopId)!;
  if (!payFromShopThenPlayer(state, shop, offer.price, reservedCash)) {
    return { success: false, message: `${offer.def.name} için ${tl(offer.price)} gerekiyor.` };
  }
  shop.usedUpgrades = { ...(shop.usedUpgrades ?? {}), [offer.def.id]: state.day + offer.days };
  return {
    success: true,
    message: `${shop.nameTR}: ikinci el ${offer.def.name} kuruldu (${offer.def.effectLabel}, ${offer.days} gün dayanır).`,
  };
}

// ---------------------------------------------------------------------------
// BELEDİYE — mahalle projeleri
// ---------------------------------------------------------------------------

export function fundedCityProjects(state: SimulationState): string[] {
  return state.tradeState?.cityProjects ?? [];
}

/** Sıradaki (katkı verilebilecek) proje; hepsi bittiyse null */
export function nextCityProject(state: SimulationState): CityProjectDef | null {
  const done = new Set(fundedCityProjects(state));
  return CITY_PROJECTS.find((p) => !done.has(p.id)) ?? null;
}

/** Belediye projelerinin bütün kişisel dükkânlara verdiği müşteri çarpanı (1 = etkisiz) */
export function cityProjectCustomerMultiplier(projects: readonly string[] | undefined): number {
  let m = 1;
  for (const id of projects ?? []) {
    const def = CITY_PROJECTS.find((p) => p.id === id);
    if (def) m *= 1 + def.customersPct / 100;
  }
  return m;
}

export function fundCityProject(state: SimulationState, projectId: string, reservedCash: number): Result {
  if (!cityServicesOpen(state)) return { success: false, message: 'Belediye projeleri için önce bir dükkân aç.' };
  const next = nextCityProject(state);
  if (!next) return { success: false, message: 'Bütün mahalle projeleri bitti.' };
  if (next.id !== projectId) return { success: false, message: `Önce "${next.name}" projesi yapılmalı.` };
  const spendable = Math.max(0, state.cash - reservedCash);
  if (spendable < next.price) return { success: false, message: `${next.name} için ${tl(next.price)} nakit gerekiyor.` };
  WalletEngine.spend(state, next.price);
  CentralLedgerEngine.recordPostedAccountingEntry(state, {
    idempotencyKey: `CITY-PROJECT-${next.id}`,
    sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    destinationAccountId: ACCOUNT_IDS.OPERATING_EXPENSE,
    amount: next.price,
    category: 'OPERATING_EXPENSE_PAYMENT',
    description: `Belediye projesi: ${next.name}`,
    reservedOrderCash: reservedCash,
  });
  const ts = TradeUniverse.ensureTradeUniverseState(state);
  ts.cityProjects = [...(ts.cityProjects ?? []), next.id];
  ts.tradeReputationScore = Math.min(REPUTATION_MAX, Math.round((ts.tradeReputationScore + next.reputation) * 10) / 10);
  return {
    success: true,
    message: `${next.name} açıldı! Bütün dükkânlarına +%${next.customersPct} müşteri, +${next.reputation} itibar.`,
  };
}

// ---------------------------------------------------------------------------
// TRAFO — güneş paneli
// ---------------------------------------------------------------------------

/** Dükkânın bugünkü kira + işletme gideri (güneş paneli düşülmeden) */
function baseOpex(shop: ShopInstance): number {
  return shop.dailyRent + shop.level * 120;
}

/** Güneş panelinin günlük tasarrufu */
export function solarDailySaving(shop: ShopInstance): number {
  return Math.round(baseOpex(shop) * SOLAR_OPEX_CUT);
}

export function solarPanelCost(shop: ShopInstance): number {
  return Math.max(1_000, Math.round((solarDailySaving(shop) * SOLAR_PAYBACK_DAYS[shop.shopType]) / 500) * 500);
}

/** Güneş paneli varsa kira + işletme giderinin çarpanı */
export function solarOpexMultiplier(shop: Pick<ShopInstance, 'solarPanel'>): number {
  return shop.solarPanel ? 1 - SOLAR_OPEX_CUT : 1;
}

export function buySolarPanel(state: SimulationState, shopId: string, reservedCash: number): Result {
  const shop = personalShops(state).find((s) => s.shopId === shopId);
  if (!shop) return { success: false, message: 'Dükkân bulunamadı.' };
  if (shop.solarPanel) return { success: false, message: `${shop.nameTR} dükkânında zaten güneş paneli var.` };
  const cost = solarPanelCost(shop);
  if (!payFromShopThenPlayer(state, shop, cost, reservedCash)) {
    return { success: false, message: `Güneş paneli için ${tl(cost)} gerekiyor.` };
  }
  shop.solarPanel = true;
  return {
    success: true,
    message: `${shop.nameTR}: güneş paneli kuruldu. Günlük gider ${tl(solarDailySaving(shop))} azaldı.`,
  };
}

// ---------------------------------------------------------------------------
// Gün kapanışı
// ---------------------------------------------------------------------------

/** Süresi biten ikinci el eşyaları kaldırır; oyuncuya gösterilecek mesajları döner. */
export function stepCityServicesDayClose(state: SimulationState): string[] {
  const out: string[] = [];
  for (const shop of personalShops(state)) {
    if (!shop.usedUpgrades) continue;
    for (const [id, until] of Object.entries(shop.usedUpgrades)) {
      if (until >= state.day) continue;
      const rest: Record<string, number> = { ...shop.usedUpgrades };
      delete rest[id];
      shop.usedUpgrades = rest;
      const def = SHOP_UPGRADES.find((u) => u.id === id);
      out.push(`${shop.nameTR}: ikinci el ${def?.name ?? id} eskidi, etkisi bitti.`);
    }
  }
  return out;
}
