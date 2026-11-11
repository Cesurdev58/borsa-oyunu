/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlayerCompany } from './company';
import { MacroEconomyState } from './economy';
import {
  CentralLedgerState,
  CollateralItem,
  FinancialIntegrityAuditReport,
  LoanContract,
} from './finance';
import { ControlThresholdLevel, MarketStock } from './market';
import { NewsEvent } from './news';
import { InstitutionalFund, PlayerFinancialState, PortfolioPosition } from './player';
import { TradeUniverseState } from './trade';
import { PendingOrder, TransactionRecord } from './transactions';

export enum SimulationStage {
  STAGE_1_RETAIL_INVESTOR = 1,
  STAGE_2_ENTREPRENEUR = 2,
  STAGE_3_IPO_PUBLIC = 3,
  STAGE_4_HOLDING_MONOPOLY = 4,
}

export type MarketSession =
  | 'MARKET_CLOSED'
  | 'PRE_OPEN'
  | 'MARKET_OPEN'
  | 'AFTER_HOURS';

export type RealMinutesPerGameDayOption = 30 | 45 | 60;

export type TimeScaleOption = 0 | 1 | 2 | 4;

export interface OfflineProgressSummary {
  realSecondsElapsed: number;
  gameMinutesAdvanced: number;
  gameDaysAdvanced: number;
  ordersExecuted: number;
  ordersExpired: number;
  productionCompleted: number;
  revenueGenerated: number;
  expensesPaid: number;
  researchProgress: number;
  dividendsCollected: number;
  newsGenerated: number;
  startNetWorth: number;
  endNetWorth: number;
  warnings: string[];
}

export interface StageUnlockStatus {
  stage1Retail: boolean;
  stage2Entrepreneur: boolean;
  stage3Ipo: boolean;
  stage4Holding: boolean;
}

export interface IPOEligibilityResult {
  eligible: boolean;
  minOperatingDaysRequired: number;
  currentOperatingDays: number;
  minAnnualRevenueRequired: number;
  currentAnnualRevenue: number;
  minEbitdaRequired: number;
  currentEbitda: number;
  minEquityRequired: number;
  currentEquity: number;
  minGovernanceScoreRequired: number;
  currentGovernanceScore: number;
  maxDebtToEbitdaAllowed: number;
  currentDebtToEbitda: number;
  reasons: string[];
}

export interface IPOExecutionResult {
  success: boolean;
  message: string;
  ticker: string;
  offerPrice: number;
  priceRangeMin: number;
  priceRangeMax: number;
  fairPricePerShare: number;
  primaryNewSharesIssued: number;
  secondaryExistingSharesSold: number;
  offeredShares: number;
  subscribedShares: number;
  institutionalDemandShares: number;
  retailDemandShares: number;
  oversubscriptionMultiple: number;
  grossProceeds: number;
  underwritingFee: number;
  netProceedsToPlayerCash: number;
  netProceedsToCompanyTreasury: number;
  newTotalShares: number;
  remainingPlayerOwnershipPct: number;
  firstDayClosingPrice: number;
  fundParticipations: Array<{
    fundName: string;
    strategyType: string;
    sharesAllocated: number;
    capitalCommitted: number;
  }>;
}

export interface TakeoverResult {
  success: boolean;
  message: string;
  ticker: string;
  companyName: string;
  previousOwnershipPct: number;
  newOwnershipPct: number;
  controlLevelBefore: ControlThresholdLevel;
  controlLevelAfter: ControlThresholdLevel;
  sharesAcquiredInTender: number;
  tenderOfferPrice: number;
  controlPremiumPct: number;
  defenseTriggered: boolean;
  rivalBidOccurred: boolean;
  rivalBidPremiumPct: number;
  debtFinancingUsed: number;
  interestRateOnFinancing: number;
  integrationCostPaid: number;
  totalTenderCost: number;
  estimatedDailySynergyDividend: number;
}

export interface AccountingAuditResult {
  valid: boolean;
  checkedDay: number;
  playerNetWorthEquationValid: boolean;
  companyBalanceSheetsValid: boolean;
  pricesValid: boolean;
  errors: string[];
}

export interface DailyLogEntry {
  day: number;
  dateISO: string;
  stage: SimulationStage;
  cash: number;
  portfolioMarketValue: number;
  privateCompanyEquityValue: number;
  accruedDividends: number;
  totalDebt: number;
  netWorth: number;
  marketIndexValue: number;
  dividendsReceivedToday: number;
  holdingSynergyReceivedToday: number;
  headlineNews: string;
  actionsTaken: string[];
  integrityValid: boolean;
}

export interface BatchSimulationSummary {
  daysSimulated: number;
  startDay: number;
  endDay: number;
  startNetWorth: number;
  endNetWorth: number;
  netWorthChange: number;
  netWorthChangePct: number;
  startCash: number;
  endCash: number;
  cashChange: number;
  startPortfolioValue: number;
  endPortfolioValue: number;
  portfolioChange: number;
  totalDividendsCollected: number;
  totalSynergyCollected: number;
  executedTransactionsCount: number;
  bestPerformingStocks: Array<{ ticker: string; name: string; returnPct: number }>;
  worstPerformingStocks: Array<{ ticker: string; name: string; returnPct: number }>;
  generatedNewsCount: number;
  ipoEvents: string[];
  takeoverEvents: string[];
  companyRevenueDelta: number;
  companyEbitdaDelta: number;
  integrityErrors: string[];
}

export interface CitySavedState {
  unlockedDistricts: string[];
  buildingVisualLevels: Record<string, number>;
  activeConstructions: Array<{
    projectId: string;
    buildingId: string;
    stage: 'PARCEL_PREP' | 'FOUNDATION_SCAFFOLD' | 'NEAR_COMPLETION' | 'COMPLETED';
    progressPct: number;
    estimatedCompletionDay: number;
  }>;
  parcelStates: Record<string, 'LOCKED' | 'UNLOCKED' | 'UNDER_CONSTRUCTION' | 'BUILT'>;
  lastCameraPanX: number;
  lastCameraPanY: number;
  lastZoomPreset: 'CLOSER' | 'NORMAL' | 'OVERVIEW';
  graphicsQuality: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SimulationState {
  schemaVersion: number;
  seed: number;
  randomState: number;
  day: number;
  dateISO: string;
  currentGameMinute: number;
  currentGameHour: number;
  minutesIntoCurrentDay: number;
  totalElapsedGameMinutes: number;
  realMinutesPerGameDay: RealMinutesPerGameDayOption;
  timeScale: TimeScaleOption;
  isPaused: boolean;
  marketSession: MarketSession;
  lastRealTimestampISO: string;
  lastAutosaveTimestampISO: string;
  intradaySubstepBufferMinutes: number;
  intradayStepsProcessedToday: number;
  intradayMarketStepsCompletedToday: number;
  stage: SimulationStage;
  stageUnlocks: StageUnlockStatus;
  cash: number;
  shortTermDebt: number;
  longTermDebt: number;
  totalDebt: number;
  accruedDividendsReceivable: number;
  netWorth: number;
  portfolioValue: number;
  playerFinancials: PlayerFinancialState;
  totalDividendsEarned: number;
  totalSynergyEarned: number;
  marketIndex: number;
  marketIndexHistory: number[];
  netWorthHistory: number[];
  macro: MacroEconomyState;
  stocks: MarketStock[];
  portfolio: Record<string, PortfolioPosition>;
  pendingOrders: PendingOrder[];
  playerCompany: PlayerCompany | null;
  institutionalFunds: InstitutionalFund[];
  newsFeed: NewsEvent[];
  transactions: TransactionRecord[];
  transactionSequence: number;
  orderSequence?: number;
  controlledSubsidiaries: string[];
  dailyLogs: DailyLogEntry[];
  lastBatchSummary: BatchSimulationSummary | null;
  lastOfflineSummary: OfflineProgressSummary | null;
  lastOfflineProcessedTimestampISO?: string;
  lastOfflineSummaryDismissed?: boolean;
  lastIntegrityAudit: AccountingAuditResult;

  // v5 Merkezi Muhasebe, Banka/Kredi, Ayrı Hesaplar ve Teşhis Alanları
  personalCash?: number;
  investmentCash?: number;
  holdingCash?: number;
  centralLedger?: CentralLedgerState;
  activeLoans?: LoanContract[];
  collaterals?: CollateralItem[];
  loanSequence?: number;
  projectSequence?: number;
  lastSimulationTickId?: string;
  lastProcessedGameMinuteTotal?: number;
  lastProcessedDayClose?: number;
  lastFinancialIntegrityReport?: FinancialIntegrityAuditReport | null;

  // v6 İzometrik Tycoon Şehri Kalıcı Durumu
  cityState?: CitySavedState;

  // v7 Ticaret Evreni, Esnaf/Dükkânlar, Tedarik Zinciri, Depo ve Lojistik Durumu
  tradeState?: TradeUniverseState;
}


