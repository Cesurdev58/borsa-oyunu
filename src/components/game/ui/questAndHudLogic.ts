/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HUD PARA KISALTMA, TEK HEDEFLİ İLK GÖREV ŞERİDİ, REACT KEY GÜVENLİĞİ VE
 * TEK SEFERLİK CANLI ŞEHİR OLAY İZLEYİCİSİ (PURE LOGIC MODÜLÜ)
 */

import { MarketSession, SimulationState } from '../../../models/simulation';
import { CityBuildingId } from '../gameTypes';
import { buildCareerGoals, goalReward } from '../../../engine/CareerGoals';
import { PROGRESSION_RULES } from '../../../engine/ProgressionRules';


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
  /** Ödül yazısı, ör. "Ödül: ₺5.000" */
  rewardLabel: string;
  /** Gerçek para ödülü (TL); "Ödülü al" ile kişisel nakde girer */
  reward: number;
  targetBuildingId: CityBuildingId;
  /** Hedef tamamlandı mı (ödül alınmış ya da alınmaya hazır) */
  completed: boolean;
  /** Ödülü alındı mı */
  claimed: boolean;
}

export interface CityQuestStripModel {
  /** Görev şeridinde aynı anda gösterilecek TEK ana hedef (ödülü alınmamış ilk hedef) */
  activeQuest: CityQuestItem;
  /** Görev panelinde listelenecek tüm görevler */
  allQuests: CityQuestItem[];
  /** Ödülü alınan hedef sayısı */
  completedCount: number;
  totalCount: number;
  /** Bugüne kadar alınan toplam hedef ödülü (TL) */
  totalRewardsEarned: number;
  /** Sıradaki hedef tamamlandı, ödül alınmayı bekliyor */
  activeReadyToClaim: boolean;
}

/**
 * Hedef şeridi modeli. Hedefler ve ödüller motorda tanımlıdır (engine/CareerGoals.ts);
 * burası yalnızca arayüz için biçimlendirir. Motor durumu yerinde değiştirdiği için önbellek tutulmaz.
 */
export function deriveCityQuestStripModel(
  state: SimulationState,
  hasOpenedBorsaBuilding: boolean = false
): CityQuestStripModel {
  const model = buildCareerGoals(state, {
    hasOpenedBorsa: hasOpenedBorsaBuilding,
    companyNetWorth: PROGRESSION_RULES.entrepreneurNetWorth,
  });
  const allQuests: CityQuestItem[] = model.goals.map((g) => ({
    id: g.def.id,
    stepNumber: g.stepNumber,
    title: g.def.title,
    progressText: g.progress.text,
    progressPct: g.progress.pct,
    rewardLabel: `Ödül: ₺${goalReward(state, g.def).toLocaleString('tr-TR')}`,
    reward: goalReward(state, g.def),
    targetBuildingId: g.def.target as CityBuildingId,
    completed: g.claimed || g.progress.done,
    claimed: g.claimed,
  }));
  const activeQuest =
    allQuests.find((q) => !q.claimed) ?? allQuests[allQuests.length - 1];
  return {
    activeQuest,
    allQuests,
    completedCount: model.claimedCount,
    totalCount: model.total,
    totalRewardsEarned: model.totalRewards,
    activeReadyToClaim: !activeQuest.claimed && activeQuest.completed,
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
