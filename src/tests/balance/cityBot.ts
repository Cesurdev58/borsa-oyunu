/**
 * Şehir ölçüm robotları (`npm run city-balance`, `npm run city-audit`).
 *
 * - `measureShopEbitda`: aynı dükkân türünü bir şehirde açıp düzenli sipariş vererek günlük EBITDA'sını ölçer
 *   (EBITDA = satış − mal maliyeti − maaş − kira ve işletme; amortisman/vergi yok).
 * - `runCityCareer`: bir şehirde sıfırdan başlayan "makul oyuncu" (kariyer robotunun sadeleşmiş hâli, şirketsiz).
 */
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SHOP_TEMPLATES } from '../../engine/TradeAndShopEngine';
import { firstShopGateStatus } from '../../engine/FirstShopGate';
import { PROGRESSION_RULES } from '../../engine/ProgressionRules';
import { FIRST_EMPLOYEE_HIRE_FEE_BUFE } from '../../data/gameBalance';
import { listShopUpgrades } from '../../engine/ShopUpgrades';
import type { ShopType } from '../../models/trade';
import { restockShops } from './restockBot';
import { answerDecisionSensibly } from './decisionBot';

export const SHOP_ORDER: ShopType[] = [
  'BUFE', 'MANAV', 'KAFE', 'GIYIM_MAGAZASI', 'ELEKTRONIK_MAGAZASI', 'MOBILYA_MAGAZASI', 'MARKET', 'OTOMOBIL_GALERISI',
];

const likitRezerv = (shopCount: number) => 5_000 + 3_000 * shopCount;

// ---------------------------------------------------------------------------
// Aynı dükkân türü, farklı şehir: EBITDA
// ---------------------------------------------------------------------------

export interface ShopEbitdaResult {
  revenuePerDay: number;
  ebitdaPerDay: number;
  /** zarar eden gün oranı (0–1) */
  lossDayShare: number;
}

/** Bir şehirde tek dükkân (2. seviye, çalışanlı) açar; ilk `warmup` günden sonraki `days` günün (varsayılan bir tam yıl: mevsimler dengelensin) ortalamasını verir. */
export function measureShopEbitda(
  cityId: string,
  shopType: ShopType,
  seed: number,
  opts: { warmup?: number; days?: number } = {}
): ShopEbitdaResult {
  const warmup = opts.warmup ?? 10;
  const days = opts.days ?? 365;
  const eng = new SimulationEngine(seed, 20_000_000);
  eng.chooseStartCity(cityId);
  const r = eng.openShop({ shopType, cityId });
  if (!r.success || !r.shop) throw new Error(`Dükkân açılamadı (${cityId}/${shopType}): ${r.message}`);
  const shopId = r.shop.shopId;
  if (r.shop.ownerWorks) eng.hireFirstEmployee(shopId);
  let rev = 0;
  let ebitda = 0;
  let loss = 0;
  let counted = 0;
  for (let d = 1; d <= warmup + days; d++) {
    restockShops(eng);
    answerDecisionSensibly(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
    if (d <= warmup) continue;
    const s = eng.getState().tradeState!.shops.find((x) => x.shopId === shopId)!;
    const day = s.todaySalesRevenue - s.todayCogs - s.todayPayrollCost - s.todayRentAndOpex;
    rev += s.todaySalesRevenue;
    ebitda += day;
    if (day < 0) loss++;
    counted++;
  }
  return { revenuePerDay: rev / counted, ebitdaPerDay: ebitda / counted, lossDayShare: loss / counted };
}

// ---------------------------------------------------------------------------
// Şehirde başlayan makul oyuncu
// ---------------------------------------------------------------------------

export interface CityCareerResult {
  cityId: string;
  seed: number;
  startNetWorth: number;
  finalNetWorth: number;
  /** başlangıca göre değişim yüzdesi */
  growthPct: number;
  firstShopDay: number | null;
  secondShopDay: number | null;
  firstUpgradeDay: number | null;
  /** ilk seviye yükseltmesinden hemen sonraki cep + kasa nakdi */
  cashAfterFirstUpgrade: number | null;
  millionDay: number | null;
  companyGateDay: number | null;
  /** zararda biten gün oranı (en az bir dükkânı olan günler arasında, tüm dükkânların toplam günlük kârı < 0) */
  lossDayShare: number;
  minCash: number;
  shops: number;
  /** belirli oyun günlerindeki net varlık (90 = 3. saat, 150 = 5. saat, 300 = 10. saat) */
  netWorthAt: Record<number, number>;
}

export const CAREER_CHECKPOINT_DAYS = [90, 150, 300];

export function runCityCareer(cityId: string, seed: number, maxDays: number): CityCareerResult {
  const eng = new SimulationEngine(seed, 100_000);
  eng.chooseStartCity(cityId);
  const start = eng.getState().netWorth;
  const stocks = eng.getState().stocks;
  const budget = eng.getSpendableCash() * 0.45;
  for (const s of stocks) {
    const sh = Math.floor(budget / stocks.length / (s.price * 1.01));
    if (sh > 0) eng.buyStock(s.ticker, sh);
  }
  const first = Object.entries(eng.getState().portfolio).find(([, p]) => p.shares > 1);
  if (first) eng.sellStock(first[0], 1);

  let firstShopDay: number | null = null;
  let secondShopDay: number | null = null;
  let firstUpgradeDay: number | null = null;
  let cashAfterFirstUpgrade: number | null = null;
  let millionDay: number | null = null;
  let companyGateDay: number | null = null;
  let activeDays = 0;
  let lossDays = 0;
  let minCash = Infinity;
  let hireDay = Infinity;
  const netWorthAt: Record<number, number> = {};

  for (let d = 1; d <= maxDays; d++) {
    const st = eng.getState();
    const shops = st.tradeState?.shops ?? [];
    if (shops.length === 0 && firstShopGateStatus(st).open) {
      for (const [t, p] of Object.entries(st.portfolio)) if (p.shares > 0) eng.sellStock(t, p.shares);
    }
    for (const sh of shops) {
      const extra = Math.floor(sh.cashAccountBalance - 25_000);
      if (extra > 1_000) eng.transferBetweenPersonalAndShopCash({ shopId: sh.shopId, direction: 'FROM_SHOP', amount: extra });
    }
    // Yeni tür dükkân (hep aynı şehirde: oyuncu merkezinde büyür)
    for (let guard = 0; guard < 3; guard++) {
      const s2 = eng.getState();
      const owned = new Set((s2.tradeState?.shops ?? []).map((x) => x.shopType));
      const next = SHOP_ORDER.find((t) => !owned.has(t));
      if (!next) break;
      const q = eng.getCityExpansionQuote(cityId as never, next);
      if (eng.getSpendableCash() < q.totalUpfrontCost + likitRezerv(owned.size) + 8_000) break;
      if (!eng.openShop({ shopType: next, cityId }).success) break;
    }
    // İlk çalışan ve yükseltmeler
    for (const sh of eng.getState().tradeState?.shops ?? []) {
      if (sh.ownerWorks && (sh.dailyProfitHistory30 ?? []).filter((v) => v > 0).length >= 3 &&
          eng.getSpendableCash() >= FIRST_EMPLOYEE_HIRE_FEE_BUFE + likitRezerv(1)) {
        if (eng.hireFirstEmployee(sh.shopId).success) hireDay = d;
      }
    }
    {
      const s3 = eng.getState();
      const hasEvidence = (s3.tradeState?.shops ?? []).some((x) => (x.dailyProfitHistory30 ?? []).filter((v) => v > 0).length >= 2);
      const offers = (s3.tradeState?.shops ?? [])
        .flatMap((sh) => listShopUpgrades(sh).filter((u) => u.status === 'AVAILABLE').map((u) => ({ sh, u })))
        .sort((a, b) => a.u.cost - b.u.cost);
      for (const { sh, u } of offers) {
        const cash = eng.getSpendableCash();
        if (hasEvidence && u.cost < cash * 0.2 && cash - u.cost >= likitRezerv(s3.tradeState?.shops.length ?? 1)) {
          eng.buyShopUpgrade(sh.shopId, u.def.id);
        }
      }
      for (const sh of eng.getState().tradeState?.shops ?? []) {
        const cost = SHOP_TEMPLATES[sh.shopType].levelUpgradeCosts[sh.level - 1];
        if (cost !== undefined && sh.level === 1 && !sh.ownerWorks && d >= hireDay + 3 &&
            eng.getSpendableCash() >= cost + likitRezerv(eng.getState().tradeState?.shops.length ?? 1)) {
          if (eng.upgradeShopLevel(sh.shopId).success && firstUpgradeDay === null) {
            firstUpgradeDay = d;
            const a = eng.getState();
            cashAfterFirstUpgrade = a.cash + (a.tradeState?.shops ?? []).reduce((s, x) => s + x.cashAccountBalance, 0);
          }
        }
      }
    }
    restockShops(eng);
    answerDecisionSensibly(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);

    const after = eng.getState();
    const list = after.tradeState?.shops ?? [];
    if (list.length >= 1 && firstShopDay === null) firstShopDay = d;
    if (list.length >= 2 && secondShopDay === null) secondShopDay = d;
    if (after.netWorth >= 1_000_000 && millionDay === null) millionDay = d;
    if (after.netWorth >= PROGRESSION_RULES.entrepreneurNetWorth && companyGateDay === null) companyGateDay = d;
    if (list.length > 0) {
      activeDays++;
      const total = list.reduce((s, x) => s + (x.todayNetProfit ?? 0), 0);
      if (total < 0) lossDays++;
    }
    minCash = Math.min(minCash, after.cash);
    if (CAREER_CHECKPOINT_DAYS.includes(d)) netWorthAt[d] = after.netWorth;
  }
  const fin = eng.getState();
  return {
    cityId,
    seed,
    startNetWorth: start,
    finalNetWorth: fin.netWorth,
    growthPct: ((fin.netWorth - start) / Math.max(1, start)) * 100,
    firstShopDay,
    secondShopDay,
    firstUpgradeDay,
    cashAfterFirstUpgrade,
    millionDay,
    companyGateDay,
    lossDayShare: activeDays > 0 ? lossDays / activeDays : 0,
    minCash: Number.isFinite(minCash) ? minCash : 0,
    shops: fin.tradeState?.shops.length ?? 0,
    netWorthAt,
  };
}
