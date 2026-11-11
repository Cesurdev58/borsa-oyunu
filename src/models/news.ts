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
}
