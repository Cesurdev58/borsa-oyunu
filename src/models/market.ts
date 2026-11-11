/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FinancialStatement, QuarterlyFinancialReport, ValuationBreakdown } from './company';

export type SectorId =
  | 'TEKNOLOJI'
  | 'ENERJI'
  | 'FINANS'
  | 'BIYOTEKNOLOJI'
  | 'SAVUNMA'
  | 'PERAKENDE'
  | 'LOJISTIK'
  | 'MADENCILIK';

export type ControlThresholdLevel =
  | 'NONE' // < %5
  | 'SIGNIFICANT_5' // >= %5 Önemli Pay Bildirimi
  | 'STRATEGIC_10' // >= %10 Stratejik Yatırımcı
  | 'MINORITY_25' // >= %25 Önemli Azınlık
  | 'BLOCKING_33' // >= %33 Bloke Edici Pay
  | 'MAJORITY_50' // > %50 Kontrol
  | 'SUPERMAJORITY_67' // >= %67 Güçlendirilmiş Kontrol
  | 'FULL_100'; // %100 Tam Sahiplik

export interface SectorMetadata {
  id: SectorId;
  name: string;
  baseEvMultiple: number;
  basePeMultiple: number;
  basePbMultiple: number;
  baseVolatility: number;
  baseDrift: number;
  unitPrice: number;
  unitCost: number;
  dailyStaffWage: number;
  unitCapacityCost: number;
  macroBeta: number;
}

export interface MarketStock {
  ticker: string;
  name: string;
  sector: SectorId;
  price: number;
  bidPrice: number;
  askPrice: number;
  spreadBps: number; // Alış-satış makası (baz puan, örn. 20 bps = %0.20)
  previousPrice: number;
  dailyChangePct: number;
  priceHistory: number[];
  muBase: number; // Yıllık baz beklenen getiri
  sigma: number; // Yıllıklandırılmış volatilite
  newsSensitivity: number; // Şirkete özgü haber duyarlılık katsayısı (0.6 - 1.5)
  sentimentScore: number; // Anlık kümülatif haber etkisi
  sentimentDecay: number; // Haber sönümlenme hızı
  liquidityDepthLots: number; // Günlük tahta derinliği (lot)
  netOrderFlowLots: number; // Günlük net alım-satım emir dengesi
  dividendYieldAnnual: number;
  dividendPeriodDays: number;
  lastExDividendDay: number;
  totalShares: number;
  freeFloatRatio: number;
  ebitdaAnnual: number;
  enterpriseValue: number;
  equityValue: number;
  fundamentalPrice: number;
  financials: FinancialStatement;
  valuation: ValuationBreakdown;
  quarterlyReports: QuarterlyFinancialReport[];
  isPlayerCompany: boolean;
  isControlledByPlayer: boolean;
  playerOwnershipPct: number;
  controlLevel: ControlThresholdLevel;
  poisonPillActive: boolean; // NPC yönetim savunması
  integrationDaysRemaining: number; // Devralma sonrası entegrasyon süresi
}
