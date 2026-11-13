/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Karar kartları: oyuncunun önüne arada bir çıkan, iki seçenekli küçük olaylar.
 */

export type DecisionEffect =
  | { kind: 'CASH'; amount: number } // kişisel nakit (+ gelir, − gider)
  | { kind: 'SATISFACTION'; delta: number } // dükkân müşteri memnuniyeti
  | { kind: 'DEMAND_BOOST'; multiplier: number; days: number } // geçici müşteri artışı/azalışı
  | { kind: 'DELAYED_CASH'; amount: number; inDays: number; chancePct: number }; // ileride gelecek para (şanslı)

export interface DecisionChoice {
  id: 'A' | 'B';
  labelTR: string;
  /** Oyuncuya gösterilecek kısa sonuç özeti (ör. "−₺3.000 · 4 gün +%25 müşteri") */
  hintTR: string;
  effects: DecisionEffect[];
}

export interface PendingDecision {
  eventId: string;
  templateId: string;
  day: number;
  expiresDay: number;
  emoji: string;
  titleTR: string;
  bodyTR: string;
  /** Etkinin uygulanacağı dükkân (varsa) */
  shopId?: string;
  choices: DecisionChoice[];
}

export interface DecisionHistoryItem {
  eventId: string;
  templateId: string;
  day: number;
  choiceId: 'A' | 'B' | 'EXPIRED';
  resultTR: string;
}

export interface ScheduledPayout {
  id: string;
  payDay: number;
  amount: number;
  /** Para gelecek mi? Karar anında belirlenir (deterministik). */
  willPay: boolean;
  labelTR: string;
}

export interface DecisionEventsState {
  pending: PendingDecision | null;
  lastEventDay: number;
  history: DecisionHistoryItem[];
  scheduledPayouts: ScheduledPayout[];
  /** Kart, karar verilmeden kapatıldıysa (daha sonra) — yalnızca arayüz bilgisi */
  snoozed?: boolean;
}
