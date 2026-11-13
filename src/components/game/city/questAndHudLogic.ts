/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HUD PARA KISALTMA, TEK HEDEFLİ İLK GÖREV ŞERİDİ, REACT KEY GÜVENLİĞİ VE
 * TEK SEFERLİK CANLI ŞEHİR OLAY İZLEYİCİSİ (PURE LOGIC MODÜLÜ)
 */

import { MarketSession, SimulationState } from '../../../models/simulation';
import { CityBuildingId } from '../gameTypes';
import { FIRST_SHOP_MIN_NET_WORTH } from '../../../data/gameBalance';
import { PROGRESSION_RULES } from '../../../engine/ProgressionRules';

function formatGoalTL(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} milyon ₺`;
  return `${Math.round(v / 1000).toLocaleString('tr-TR')} bin ₺`;
}

export interface FormattedHudCurrency {
  /** Kısa gösterim: 106.328 TL, 7,64 Mn TL, 33,24 Mn TL, 1,20 Mr TL */
  compactText: string;
  abbreviated: string;
  /** Tam gösterim: 7.641.143 TL */
  fullText: string;
  full: string;
  /** Erişilebilir etiket: Nakit: 41.555 TL */
  accessibleLabel: string;
  ariaLabel: string;
  /** Değerin kısaltılıp kısaltılmadığı */
  isAbbreviated: boolean;
}

/**
 * Üst HUD için uzun para değerlerini Türk sayı formatında kısaltır:
 * - < 1.000.000 -> "106.328 TL" / "41.555 TL"
 * - >= 1.000.000 ve < 1.000.000.000 -> "7,64 Mn TL" / "33,24 Mn TL"
 * - >= 1.000.000.000 -> "1,20 Mr TL"
 * Tam değer her zaman `fullText` ve `accessibleLabel` içinde korunur.
 */
export function formatHudCurrencyTR(
  amount: number,
  labelPrefix: string = 'Tutar'
): FormattedHudCurrency {
  const safeVal = Number.isFinite(amount) ? amount : 0;
  const sign = safeVal < 0 ? '-' : '';
  const absVal = Math.abs(safeVal);
  const roundedInt = Math.round(absVal);
  const fullFormattedNumber = roundedInt.toLocaleString('tr-TR');
  const fullText = `${sign}${fullFormattedNumber} TL`;

  let compactText = fullText;
  let isAbbreviated = false;

  if (absVal >= 1_000_000_000) {
    const billions = (absVal / 1_000_000_000).toFixed(2).replace('.', ',');
    compactText = `${sign}${billions} Mr TL`;
    isAbbreviated = true;
  } else if (absVal >= 1_000_000) {
    const millions = (absVal / 1_000_000).toFixed(2).replace('.', ',');
    compactText = `${sign}${millions} Mn TL`;
    isAbbreviated = true;
  }

  const accessibleLabel = `${labelPrefix}: ${fullText}`;

  return {
    compactText,
    abbreviated: compactText,
    fullText,
    full: fullText,
    accessibleLabel,
    ariaLabel: accessibleLabel,
    isAbbreviated,
  };
}

export interface CityQuestItem {
  /** Deterministik görev kimliği */
  id: string;
  stepNumber: number;
  title: string;
  progressText: string;
  progressPct: number;
  rewardLabel: string;
  reputationPoints: number;
  targetBuildingId: CityBuildingId;
  completed: boolean;
}

export interface CityQuestStripModel {
  /** Görev şeridinde aynı anda gösterilecek TEK ana hedef */
  activeQuest: CityQuestItem;
  /** Görev panelinde listelenecek tüm görevler */
  allQuests: CityQuestItem[];
  completedCount: number;
  totalCount: number;
  earnedReputationPoints: number;
}

/**
 * Ekonomik dengeyi bozacak para ödülü vermeden, oyuncunun sıradaki tek ana hedefini
 * gerçek SimulationState üzerinden deterministik olarak türetir.
 */
export function deriveCityQuestStripModel(
  state: SimulationState,
  hasOpenedBorsaBuilding: boolean = false
): CityQuestStripModel {
  const totalOrdersCount = state.pendingOrders.length;
  const filledLimitOrdersCount = state.pendingOrders.filter(
    (o) =>
      o.status === 'FILLED' &&
      (o.orderType === 'LIMIT_BUY' || o.orderType === 'LIMIT_SELL')
  ).length;
  const hasAnyTradeOrOrder =
    totalOrdersCount > 0 || state.transactions.length > 0;
  const hasBorsaOpened = hasOpenedBorsaBuilding || hasAnyTradeOrOrder;

  const activePositions = Object.values(state.portfolio).filter(
    (p) => p.shares > 0
  );
  const ownedSectors = new Set<string>();
  for (const pos of activePositions) {
    const st = state.stocks.find((s) => s.ticker === pos.ticker);
    if (st) {
      ownedSectors.add(st.sector);
    }
  }
  const distinctSectorsCount = ownedSectors.size;

  const portfolioTarget = 125_000;
  const currentPortfolioAndCashProgress = Math.max(
    state.portfolioValue,
    state.netWorth > 100_000 ? state.netWorth : state.portfolioValue
  );
  const portfolioPct = Math.min(
    100,
    Math.floor((currentPortfolioAndCashProgress / portfolioTarget) * 100)
  );

  const netWorth250kPct = Math.min(
    100,
    Math.floor((state.netWorth / 250_000) * 100)
  );
  const netWorth2mPct = Math.min(
    100,
    Math.floor((state.netWorth / PROGRESSION_RULES.entrepreneurNetWorth) * 100)
  );
  const shopsList = state.tradeState?.shops ?? [];
  const hasShopProfit = shopsList.some(
    (sh) => (sh.cumulativeNetProfit ?? 0) > 0 || (sh.todayNetProfit ?? 0) > 0
  );
  const firstShopGatePct = Math.min(
    100,
    Math.floor((state.netWorth / FIRST_SHOP_MIN_NET_WORTH) * 100)
  );

  const allQuests: CityQuestItem[] = [
    {
      id: 'quest-01-open-borsa',
      stepNumber: 1,
      title: 'Borsa Binasını aç',
      progressText: hasBorsaOpened ? '1 / 1' : '0 / 1',
      progressPct: hasBorsaOpened ? 100 : 0,
      rewardLabel: '+100 İtibar · Borsa Rozeti',
      reputationPoints: 100,
      targetBuildingId: 'BORSA',
      completed: hasBorsaOpened,
    },
    {
      id: 'quest-02-first-order',
      stepNumber: 2,
      title: 'İlk hisse emrini oluştur',
      progressText: hasAnyTradeOrOrder ? '1 / 1' : '0 / 1',
      progressPct: hasAnyTradeOrOrder ? 100 : 0,
      rewardLabel: '+150 İtibar · Yatırımcı Rozeti',
      reputationPoints: 150,
      targetBuildingId: 'BORSA',
      completed: hasAnyTradeOrOrder,
    },
    {
      id: 'quest-03-two-sectors',
      stepNumber: 3,
      title: 'İki farklı sektörden hisse al',
      progressText: `${Math.min(2, distinctSectorsCount)} / 2`,
      progressPct: Math.min(100, distinctSectorsCount * 50),
      rewardLabel: '+200 İtibar · Sektör Uzmanı',
      reputationPoints: 200,
      targetBuildingId: 'BORSA',
      completed: distinctSectorsCount >= 2 || shopsList.length > 0 || state.stage >= 2,
    },
    {
      id: 'quest-04-first-shop-gate',
      stepNumber: 4,
      title: `Net varlığını ${formatGoalTL(FIRST_SHOP_MIN_NET_WORTH)} yap`,
      progressText: `%${firstShopGatePct}`,
      progressPct: firstShopGatePct,
      rewardLabel: '+250 İtibar · Dükkân izni',
      reputationPoints: 250,
      targetBuildingId: 'BORSA',
      completed: state.netWorth >= FIRST_SHOP_MIN_NET_WORTH || shopsList.length > 0,
    },
    {
      id: 'quest-05-open-first-shop',
      stepNumber: 5,
      title: 'İlk dükkânını aç',
      progressText: shopsList.length > 0 ? '1 / 1' : '0 / 1',
      progressPct: shopsList.length > 0 ? 100 : 0,
      rewardLabel: '+300 İtibar · Esnaf Rozeti',
      reputationPoints: 300,
      targetBuildingId: 'OYUNCU_OFISI',
      completed: shopsList.length > 0 || state.playerCompany !== null,
    },
    {
      id: 'quest-06-first-shop-profit',
      stepNumber: 6,
      title: 'Dükkânından ilk kârını al',
      progressText: hasShopProfit ? '1 / 1' : '0 / 1',
      progressPct: hasShopProfit ? 100 : 0,
      rewardLabel: '+350 İtibar · Kasa Rozeti',
      reputationPoints: 350,
      targetBuildingId: 'OYUNCU_OFISI',
      completed: hasShopProfit || state.playerCompany !== null,
    },
    {
      id: 'quest-07-networth-250k',
      stepNumber: 7,
      title: `Net varlığını ${formatGoalTL(250_000)} yap`,
      progressText: `%${netWorth250kPct}`,
      progressPct: netWorth250kPct,
      rewardLabel: '+400 İtibar · Prestij Peyzajı',
      reputationPoints: 400,
      targetBuildingId: 'OYUNCU_OFISI',
      completed: state.netWorth >= 250_000,
    },
    {
      id: 'quest-08-company-2m',
      stepNumber: 8,
      title: `Şirket kur (${formatGoalTL(PROGRESSION_RULES.entrepreneurNetWorth)})`,
      progressText: `%${netWorth2mPct}`,
      progressPct: netWorth2mPct,
      rewardLabel: '+500 İtibar · Girişimci Plaketi',
      reputationPoints: 500,
      targetBuildingId: 'SIRKET_MERKEZI',
      completed:
        state.stageUnlocks.stage2Entrepreneur ||
        state.playerCompany !== null ||
        state.netWorth >= PROGRESSION_RULES.entrepreneurNetWorth,
    },
  ];

  const firstIncomplete =
    allQuests.find((q) => !q.completed) || allQuests[allQuests.length - 1];
  const completedCount = allQuests.filter((q) => q.completed).length;
  const earnedReputationPoints = allQuests
    .filter((q) => q.completed)
    .reduce((sum, q) => sum + q.reputationPoints, 0);

  return {
    activeQuest: firstIncomplete,
    allQuests,
    completedCount,
    totalCount: allQuests.length,
    earnedReputationPoints,
  };
}

export interface KeyedTextItem {
  id: string;
  text: string;
}

/**
 * IPO uygunluk nedenlerini görünen ham metin (`key={r}`) veya sıra (`key={idx}`) yerine
 * deterministik kural kimlikleriyle eşleştirir. Aynı metin tekrar etse bile çakışmaz.
 */
export function deriveDeterministicIpoReasonItems(
  reasons: string[]
): KeyedTextItem[] {
  const seenCounts = new Map<string, number>();

  return reasons.map((text) => {
    let ruleCode = 'general';
    if (text.includes('henüz kurulmadı')) ruleCode = 'no-company';
    else if (text.includes('zaten borsada')) ruleCode = 'already-listed';
    else if (text.includes('Faaliyet süresi')) ruleCode = 'operating-days';
    else if (text.includes('Yıllıklandırılmış ciro')) ruleCode = 'annual-revenue';
    else if (text.includes('FAVÖK')) ruleCode = 'ebitda';
    else if (text.includes('Kurumsal yönetişim')) ruleCode = 'governance-score';
    else if (text.includes('Net Borç')) ruleCode = 'debt-to-ebitda';
    else {
      // Deterministik ASCII kod özeti
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
      }
      ruleCode = `rule-${hash.toString(16)}`;
    }

    const baseId = `ipo-reason-${ruleCode}`;
    const prevCount = seenCounts.get(baseId) || 0;
    seenCounts.set(baseId, prevCount + 1);
    const uniqueId = prevCount === 0 ? baseId : `${baseId}-dup-${prevCount + 1}`;

    return {
      id: uniqueId,
      text,
    };
  });
}

/**
 * Çevrimdışı ilerleme uyarılarını görünen ham metin (`key={w}`) veya index yerine
 * deterministik bileşik kimliklerle eşleştirir.
 */
export function deriveDeterministicOfflineWarningItems(
  warnings: string[],
  startDay: number,
  endDay: number
): KeyedTextItem[] {
  const seenCounts = new Map<string, number>();

  return warnings.map((text) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
    }
    const baseId = `offline-warn-d${startDay}-d${endDay}-h${hash.toString(16)}`;
    const prevCount = seenCounts.get(baseId) || 0;
    seenCounts.set(baseId, prevCount + 1);
    const uniqueId = prevCount === 0 ? baseId : `${baseId}-dup-${prevCount + 1}`;

    return {
      id: uniqueId,
      text,
    };
  });
}

export interface CityVisualEventPulse {
  eventId: string;
  kind:
    | 'MARKET_OPENED_PULSE'
    | 'MARKET_CLOSED_PULSE'
    | 'ORDER_FILLED_PULSE'
    | 'NEW_NEWS_PULSE'
    | 'IPO_CELEBRATION_PULSE'
    | 'HOLDING_UNLOCK_PULSE';
  buildingId: CityBuildingId;
  labelTR: string;
}

export interface CityVisualEventTrackerState {
  lastMarketSession: MarketSession;
  seenNewsIds: Set<string>;
  seenOrderFillIds: Set<string>;
  seenIpoCompanyTickers: Set<string>;
  hasSeenHoldingUnlock: boolean;
}

export function createInitialCityVisualTracker(
  state: SimulationState
): CityVisualEventTrackerState {
  const seenNewsIds = new Set<string>(state.newsFeed.map((n) => n.id));
  const seenOrderFillIds = new Set<string>();
  for (const ord of state.pendingOrders) {
    if (ord.status === 'FILLED') {
      seenOrderFillIds.add(ord.id);
    }
  }
  for (const tx of state.transactions) {
    if (tx.type === 'BUY' || tx.type === 'SELL') {
      seenOrderFillIds.add(tx.id);
    }
  }
  const seenIpoCompanyTickers = new Set<string>();
  if (state.playerCompany?.isPubliclyListed) {
    seenIpoCompanyTickers.add(state.playerCompany.ticker);
  }

  return {
    lastMarketSession: state.marketSession,
    seenNewsIds,
    seenOrderFillIds,
    seenIpoCompanyTickers,
    hasSeenHoldingUnlock: Boolean(state.stageUnlocks.stage4Holding),
  };
}

/**
 * SimulationState değişimlerini izleyerek şehir üzerindeki tek seferlik görsel olayları üretir.
 * - Aynı haber ID'si için yalnızca 1 kez NEW_NEWS_PULSE üretir.
 * - Aynı gerçekleşen emir/işlem ID'si için yalnızca 1 kez ORDER_FILLED_PULSE üretir.
 * - Sayfa ilk yüklendiğinde mevcut IPO veya Holding durumu için tekrar kutlama oynatmaz.
 * - SimulationEngine zamanını veya finansal state'i asla değiştirmez.
 */
export function consumeNewCityVisualPulses(
  tracker: CityVisualEventTrackerState,
  state: SimulationState
): CityVisualEventPulse[] {
  const pulses: CityVisualEventPulse[] = [];

  // 1. Piyasa açılış / kapanış geçişi
  if (state.marketSession !== tracker.lastMarketSession) {
    if (state.marketSession === 'MARKET_OPEN') {
      pulses.push({
        eventId: `pulse-market-open-d${state.day}-m${state.totalElapsedGameMinutes}`,
        kind: 'MARKET_OPENED_PULSE',
        buildingId: 'BORSA',
        labelTR: 'Borsa Seansı Açıldı',
      });
    } else if (
      tracker.lastMarketSession === 'MARKET_OPEN' &&
      state.marketSession === 'AFTER_HOURS'
    ) {
      pulses.push({
        eventId: `pulse-market-close-d${state.day}-m${state.totalElapsedGameMinutes}`,
        kind: 'MARKET_CLOSED_PULSE',
        buildingId: 'BORSA',
        labelTR: 'Seans Kapandı',
      });
    }
    tracker.lastMarketSession = state.marketSession;
  }

  // 2. Yeni haber oluşumu (aynı haber ID için yalnızca 1 kez)
  const topNews = state.newsFeed[0];
  if (topNews && !tracker.seenNewsIds.has(topNews.id)) {
    tracker.seenNewsIds.add(topNews.id);
    pulses.push({
      eventId: `pulse-news-${topNews.id}`,
      kind: 'NEW_NEWS_PULSE',
      buildingId: 'HABER_MERKEZI',
      labelTR: `Yeni Bülten: ${topNews.sector}`,
    });
  }

  // 3. Emir gerçekleşmesi (aynı emir veya işlem ID için yalnızca 1 kez)
  for (const ord of state.pendingOrders) {
    if (ord.status === 'FILLED' && !tracker.seenOrderFillIds.has(ord.id)) {
      tracker.seenOrderFillIds.add(ord.id);
      pulses.push({
        eventId: `pulse-order-fill-${ord.id}`,
        kind: 'ORDER_FILLED_PULSE',
        buildingId: 'BORSA',
        labelTR: `Emir gerçekleşti (${ord.ticker})`,
      });
    }
  }
  const latestTx = state.transactions[0];
  if (
    latestTx &&
    (latestTx.type === 'BUY' || latestTx.type === 'SELL') &&
    !tracker.seenOrderFillIds.has(latestTx.id)
  ) {
    tracker.seenOrderFillIds.add(latestTx.id);
    // Eğer aynı anda pendingOrder üzerinden zaten pulse üretilmediyse ekle
    if (!pulses.some((p) => p.kind === 'ORDER_FILLED_PULSE')) {
      pulses.push({
        eventId: `pulse-tx-fill-${latestTx.id}`,
        kind: 'ORDER_FILLED_PULSE',
        buildingId: 'BORSA',
        labelTR: 'Emir gerçekleşti',
      });
    }
  }

  // 4. IPO kutlaması (yalnızca ilk kez halka açıldığında 1 kez)
  if (
    state.playerCompany &&
    state.playerCompany.isPubliclyListed &&
    !tracker.seenIpoCompanyTickers.has(state.playerCompany.ticker)
  ) {
    tracker.seenIpoCompanyTickers.add(state.playerCompany.ticker);
    pulses.push({
      eventId: `pulse-ipo-${state.playerCompany.ticker}`,
      kind: 'IPO_CELEBRATION_PULSE',
      buildingId: 'SIRKET_MERKEZI',
      labelTR: `${state.playerCompany.ticker} Halka Arz Edildi!`,
    });
  }

  // 5. Holding açılışı (yalnızca ilk kez açıldığında 1 kez)
  if (state.stageUnlocks.stage4Holding && !tracker.hasSeenHoldingUnlock) {
    tracker.hasSeenHoldingUnlock = true;
    pulses.push({
      eventId: `pulse-holding-unlock-d${state.day}`,
      kind: 'HOLDING_UNLOCK_PULSE',
      buildingId: 'HOLDING_MERKEZI',
      labelTR: 'Holding Kulesi Açıldı!',
    });
  }

  return pulses;
}
