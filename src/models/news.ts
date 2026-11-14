/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SectorId } from './market';

export interface NewsEvent {
  id: string;
  day: number;
  headline: string;
  summary: string;
  sector: SectorId | 'GENEL';
  targetTicker?: string;
  initialImpact: number;
  sentimentImpact: number; // Güncel yaşlandırılmış etki: initialImpact * exp(-decayRate * age)
  decayRate: number;
  /** Haberin ilk okunuşta beklenen etkisi (gerçek etki farklı olabilir; eski kayıtlarda yoktur) */
  expectedImpact?: number;
  /** Piyasa tepkisi: zaten bekleniyordu (etki küçük) ya da ters tepki */
  reaction?: 'PRICED_IN' | 'REVERSAL';
  /** Olağanüstü olaydan geldiyse olayın kimliği */
  worldEventId?: string;
}
