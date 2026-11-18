/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OYUN TEMPOSU (TempoRules)
 * "Şu an bir oyun günü kaç gerçek dakika sürüyor?" sorusunun tek cevap yeri.
 * Kariyerin başında günler kısa (hızlı başlangıç), imparatorluk büyüdükçe oyuncunun seçtiği uzunluğa çıkar.
 * Ayarlar `data/gameBalance.ts` içinde TEMPO_* ve OFFLINE_* sabitleri.
 * Yalnızca modelleri ve denge sabitlerini içe aktarır (döngü oluşmaz).
 */
import {
  OFFLINE_MAX_GAME_DAYS_CAP,
  OFFLINE_MAX_REAL_MINUTES,
  TEMPO_COMPANY_MINUTES,
  TEMPO_EARLY_MINUTES,
} from '../data/gameBalance';
import { SimulationStage } from '../models/simulation';
import type { SimulationState } from '../models/simulation';

export type TempoPhase = 'EARLY' | 'COMPANY' | 'NORMAL';

type TempoInput = Pick<SimulationState, 'realMinutesPerGameDay' | 'stage'> &
  Partial<Pick<SimulationState, 'playerCompany' | 'fastStartTempo'>>;

/** Hızlı başlangıç açık mı? (Eski kayıtlarda alan yoktur → açık.) */
export function isFastStartOn(state: Partial<Pick<SimulationState, 'fastStartTempo'>>): boolean {
  return state.fastStartTempo !== false;
}

export function tempoPhase(state: TempoInput): TempoPhase {
  if (!isFastStartOn(state)) return 'NORMAL';
  if (!state.playerCompany) return 'EARLY';
  if ((state.stage ?? SimulationStage.STAGE_1_RETAIL_INVESTOR) < SimulationStage.STAGE_3_IPO_PUBLIC) return 'COMPANY';
  return 'NORMAL';
}

/** Şu anki bir oyun gününün gerçek dakika cinsinden uzunluğu (1x hızda). */
export function effectiveRealMinutesPerGameDay(state: TempoInput): number {
  const chosen = state.realMinutesPerGameDay || 15;
  const phase = tempoPhase(state);
  if (phase === 'EARLY') return Math.min(chosen, TEMPO_EARLY_MINUTES);
  if (phase === 'COMPANY') return Math.min(chosen, TEMPO_COMPANY_MINUTES);
  return chosen;
}

/** Çevrimdışı en fazla kaç oyun günü işlenir: gerçek süre sınırı / gün uzunluğu (en az 8, en çok 60). */
export function maxOfflineGameDays(state: TempoInput): number {
  const perDay = effectiveRealMinutesPerGameDay(state);
  return Math.max(8, Math.min(OFFLINE_MAX_GAME_DAYS_CAP, Math.round(OFFLINE_MAX_REAL_MINUTES / perDay)));
}
