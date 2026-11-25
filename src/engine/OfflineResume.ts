/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Arka plandan dönüş / sayfa açılışı → çevrimdışı ilerleme.
 *
 * Mobil tarayıcıda oyun arka plana atılınca gerçek zaman döngüsü durur. Oyuncu geri döndüğünde
 * aradaki süre `OFFLINE_RESUME_MIN_REAL_SECONDS` eşiğini aşıyorsa `processOfflineProgress` çalışır ve
 * "Tekrar hoş geldin" penceresi (`OfflineProgressModal`) açılır.
 *
 * Korumalar:
 * - Duraklatılmış oyunda (ya da hız 0'da) ilerleme yok.
 * - Başlangıç şehri / merkez şehir seçimi bekleniyorsa ilerleme yok.
 * - Çift tetiklenme: süre, son işlenen çevrimdışı zamandan (`maxProcessedOfflineTimestampMs`) itibaren
 *   ölçülür; aynı dönüşte ikinci çağrı (ör. hem `visibilitychange` hem `pageshow`, ya da sayfa açılışı
 *   + görünürlük) eşiğin altında kalır ve hiçbir şey yapmaz.
 * - Henüz kapatılmamış bir "Tekrar hoş geldin" özeti varsa yenisi onun üstüne toplanır (kaybolmaz).
 *
 * Bu dosya `SimulationEngine`'i yalnızca tip olarak içe aktarır (döngü yok).
 */

import type { SimulationEngine } from './SimulationEngine';
import type { OfflineProgressSummary } from '../models/simulation';
import { OFFLINE_RESUME_MIN_REAL_SECONDS } from '../data/gameBalance';

export type OfflineResumeSkipReason =
  | 'INVALID_TIME'
  | 'PAUSED'
  | 'CITY_SELECTION'
  | 'BELOW_THRESHOLD';

export interface OfflineResumeDecision {
  process: boolean;
  /** Son işlenen andan bu yana geçen gerçek saniye */
  awaySeconds: number;
  reason?: OfflineResumeSkipReason;
}

/** Saf karar: çevrimdışı ilerleme işlenmeli mi? */
export function evaluateOfflineResume(
  engine: SimulationEngine,
  awayFromISO: string | null | undefined,
  nowISO: string
): OfflineResumeDecision {
  const state = engine.getState();
  const awayMs = Date.parse(awayFromISO || state.lastRealTimestampISO || '');
  const nowMs = Date.parse(nowISO);
  if (!Number.isFinite(awayMs) || !Number.isFinite(nowMs)) {
    return { process: false, awaySeconds: 0, reason: 'INVALID_TIME' };
  }
  const fromMs = Math.max(awayMs, engine.maxProcessedOfflineTimestampMs || 0);
  const awaySeconds = Math.max(0, (nowMs - fromMs) / 1000);

  if (state.isPaused || state.timeScale === 0) {
    return { process: false, awaySeconds, reason: 'PAUSED' };
  }
  if (engine.isCitySelectionPending() || engine.needsStartCitySelection()) {
    return { process: false, awaySeconds, reason: 'CITY_SELECTION' };
  }
  if (awaySeconds < OFFLINE_RESUME_MIN_REAL_SECONDS) {
    return { process: false, awaySeconds, reason: 'BELOW_THRESHOLD' };
  }
  return { process: true, awaySeconds };
}

function isPendingSummary(
  summary: OfflineProgressSummary | null | undefined,
  dismissed: boolean | undefined
): summary is OfflineProgressSummary {
  return Boolean(summary && !dismissed && summary.gameMinutesAdvanced > 0);
}

function mergeSummaries(
  older: OfflineProgressSummary,
  newer: OfflineProgressSummary
): OfflineProgressSummary {
  const sum = (a: number, b: number, digits = 2) => Number((a + b).toFixed(digits));
  return {
    realSecondsElapsed: sum(older.realSecondsElapsed, newer.realSecondsElapsed),
    gameMinutesAdvanced: older.gameMinutesAdvanced + newer.gameMinutesAdvanced,
    gameDaysAdvanced: older.gameDaysAdvanced + newer.gameDaysAdvanced,
    ordersExecuted: older.ordersExecuted + newer.ordersExecuted,
    ordersExpired: older.ordersExpired + newer.ordersExpired,
    productionCompleted: sum(older.productionCompleted, newer.productionCompleted),
    revenueGenerated: sum(older.revenueGenerated, newer.revenueGenerated),
    expensesPaid: sum(older.expensesPaid, newer.expensesPaid),
    researchProgress: sum(older.researchProgress, newer.researchProgress, 4),
    dividendsCollected: sum(older.dividendsCollected, newer.dividendsCollected),
    newsGenerated: older.newsGenerated + newer.newsGenerated,
    startNetWorth: older.startNetWorth,
    endNetWorth: newer.endNetWorth,
    warnings: Array.from(new Set([...older.warnings, ...newer.warnings])),
  };
}

/**
 * Eşik aşıldıysa çevrimdışı ilerlemeyi işler ve "Tekrar hoş geldin" özetini hazırlar.
 * İşlem yapılmadıysa `null` döner (oyun durumu değişmez).
 */
export function resumeOfflineProgress(
  engine: SimulationEngine,
  awayFromISO: string | null | undefined,
  nowISO: string = new Date().toISOString()
): OfflineProgressSummary | null {
  const decision = evaluateOfflineResume(engine, awayFromISO, nowISO);
  if (!decision.process) return null;

  const state = engine.getState();
  const previous = isPendingSummary(state.lastOfflineSummary, state.lastOfflineSummaryDismissed)
    ? state.lastOfflineSummary
    : null;

  const summary = engine.processOfflineProgress(
    awayFromISO || state.lastRealTimestampISO,
    nowISO
  );
  const after = engine.getState();

  if (summary.gameMinutesAdvanced <= 0) {
    // Hiç ilerleme olmadıysa bekleyen eski özet ekranda kalsın
    if (previous) {
      after.lastOfflineSummary = previous;
      after.lastOfflineSummaryDismissed = false;
    }
    return null;
  }

  if (previous) {
    const merged = mergeSummaries(previous, summary);
    after.lastOfflineSummary = merged;
    after.lastOfflineSummaryDismissed = false;
    return merged;
  }
  return summary;
}
