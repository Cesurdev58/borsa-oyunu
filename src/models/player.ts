/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SectorId } from './market';

export type NPCFundStrategyType =
  | 'VALUE' // Değer Fonu (Düşük F/K ve EV/FAVÖK arar)
  | 'GROWTH' // Büyüme Fonu (Yüksek ciro/FAVÖK büyümesi ve Ar-Ge arar)
  | 'DIVIDEND' // Temettü Fonu (Yüksek temettü verimi arar)
  | 'INDEX' // Endeks Fonu (Piyasa ağırlıklı dengeli sepet)
  | 'MOMENTUM' // Momentum Fonu (Pozitif trend ve haber duyarlılığı takip eder)
  | 'VENTURE'; // Riskli Yatırım Fonu (IPO ve yüksek beta teknoloji/biyoteknoloji)

export interface PortfolioPosition {
  ticker: string;
  shares: number;
  averageCost: number;
  totalDividendCollected: number;
  lastPurchaseDay: number;
}

export interface PlayerFinancialState {
  cash: number;
  portfolioMarketValue: number;
  playerCompanyEquityValue: number;
  accruedDividendsReceivable: number;
  shortTermDebt: number;
  longTermDebt: number;
  totalDebt: number;
  netWorth: number;
}

export interface InstitutionalFund {
  id: string;
  name: string;
  strategyType: NPCFundStrategyType;
  availableCapital: number;
  riskAppetite: number; // 0.20 - 0.95
  preferredSectors: SectorId[];
  maxPositionPct: number; // Fon toplam varlığının tek hissede maksimum oranı (örn. 0.25)
  targetPeMax: number;
  minDividendYield: number;
  holdings: Record<string, number>;
  lastTradeDay: number;
  totalVolumeTraded: number;
}
