/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ANA SİMÜLASYON KOORDİNATÖRÜ (SimulationEngine)
 * Tüm alt motorları (RandomEngine, GameClockEngine, EconomyEngine, NewsEngine,
 * AccountingEngine, ValuationEngine, MarketEngine, CompanyEngine, NPCFundEngine,
 * IPOEngine, MergerAcquisitionEngine) hem gün içi (intraday) gerçek zamanlı saatle
 * hem de kontrollü gün sonu kapanışıyla (closeCurrentDay / tickDay) koordine eder.
 */

import { CURRENT_BALANCE_VERSION, migrateBalance } from './BalanceMigration';
import * as SectorMarket from './SectorMarket';
import * as DecisionEventEngine from './DecisionEventEngine';
import * as ShopManager from './ShopManager';
import {
  createInitialNpcFunds,
} from '../data/npcCompanies';
import {
  SECTOR_CONFIGS,
} from '../data/sectors';
import {
  FinancialStatement,
  PlayerCompany,
  QuarterlyFinancialReport,
  ValuationBreakdown,
} from '../models/company';
import {
  EconomicCyclePhase,
  MacroEconomyState,
} from '../models/economy';
import {
  ControlThresholdLevel,
  MarketStock,
  SectorId,
  SectorMetadata,
} from '../models/market';
import {
  NewsEvent,
} from '../models/news';
import {
  InstitutionalFund,
  NPCFundStrategyType,
  PlayerFinancialState,
  PortfolioPosition,
} from '../models/player';
import {
  AccountingAuditResult,
  BatchSimulationSummary,
  DailyLogEntry,
  IPOEligibilityResult,
  IPOExecutionResult,
  MarketSession,
  OfflineProgressSummary,
  RealMinutesPerGameDayOption,
  SimulationStage,
  SimulationState,
  StageUnlockStatus,
  TakeoverResult,
  TimeScaleOption,
} from '../models/simulation';
import {
  Account,
  AccountId,
  BankLoanType,
  CentralLedgerState,
  CollateralItem,
  CompanyOperationsState,
  DetailedIncomeBreakdown,
  FinancialIntegrityAuditReport,
  InvestmentPackageType,
  InvestmentProject,
  LedgerEntry,
  LedgerTransaction,
  LoanContract,
  LoanOfferQuote,
  MoneyTransfer,
  TransactionCategory,
  WorkforcePlan,
} from '../models/finance';
import {
  OrderExecutionResult,
  PendingOrder,
  PendingOrderSide,
  PendingOrderStatus,
  PendingOrderType,
  TransactionRecord,
  TransactionType,
} from '../models/transactions';
import {
  CareerStage,
  CommercialContract,
  IncorporationEligibilityResult,
  InventoryBatch,
  LogisticsRoute,
  LogisticsVehicle,
  PaymentTermType,
  ProcurementOrder,
  ProductionOrder,
  PurchaseContract,
  RecipeDefinition,
  ResourceDefinition,
  SalesChannel,
  Shipment,
  ShopInstance,
  ShopTemplate,
  ShopType,
  Supplier,
  SupplierOffer,
  TradeEvent,
  TradeIntegrityAuditReport,
  TradeInvoice,
  TradePayment,
  TradeUniverseState,
  VehicleTypeId,
  Warehouse,
} from '../models/trade';
import {
  AccountingEngine,
} from './AccountingEngine';
import {
  BankLoanEngine,
  LOAN_TYPE_CATALOG,
} from './BankLoanEngine';
import {
  CentralLedgerEngine,
} from './CentralLedgerEngine';
import {
  CompanyEngine,
  EstablishCompanyParams,
} from './CompanyEngine';
import {
  EconomyEngine,
} from './EconomyEngine';
import {
  GameClockEngine,
} from './GameClockEngine';
import {
  IPOEngine,
} from './IPOEngine';
import {
  MarketEngine,
} from './MarketEngine';
import {
  MergerAcquisitionEngine,
} from './MergerAcquisitionEngine';
import {
  NewsEngine,
} from './NewsEngine';
import {
  NPCFundEngine,
} from './NPCFundEngine';
import {
  RandomEngine,
} from './RandomEngine';
import {
  DEFAULT_ROUTES,
  RECIPE_CATALOG,
  RESOURCE_CATALOG,
  SHOP_TEMPLATES,
  SUPPLIER_CATALOG,
  TradeAndShopEngine,
  VEHICLE_CATALOG,
} from './TradeAndShopEngine';
import {
  WalletEngine,
} from './WalletEngine';
import * as SimulationPersistence from './SimulationPersistence';
import * as DayCloseProcessor from './DayCloseProcessor';
import * as OrderBookProcessor from './OrderBookProcessor';
import * as StageProcessor from './StageProcessor';
import * as PlayerCompanyActions from './PlayerCompanyActions';
import * as SimulationScenarios from './SimulationScenarios';

import {
  ValuationEngine,
} from './ValuationEngine';

export {
  SECTOR_CONFIGS,
  SimulationStage,
  RandomEngine,
  GameClockEngine,
  EconomyEngine,
  NewsEngine,
  AccountingEngine,
  ValuationEngine,
  MarketEngine,
  CompanyEngine,
  NPCFundEngine,
  IPOEngine,
  MergerAcquisitionEngine,
  CentralLedgerEngine,
  BankLoanEngine,
  LOAN_TYPE_CATALOG,
  TradeAndShopEngine,
  RESOURCE_CATALOG,
  RECIPE_CATALOG,
  SUPPLIER_CATALOG,
  SHOP_TEMPLATES,
  VEHICLE_CATALOG,
  DEFAULT_ROUTES,
};

export type {
  SectorId,
  SectorMetadata,
  ControlThresholdLevel,
  MarketStock,
  NewsEvent,
  PortfolioPosition,
  PlayerFinancialState,
  InstitutionalFund,
  NPCFundStrategyType,
  FinancialStatement,
  ValuationBreakdown,
  QuarterlyFinancialReport,
  PlayerCompany,
  MacroEconomyState,
  EconomicCyclePhase,
  MarketSession,
  RealMinutesPerGameDayOption,
  TimeScaleOption,
  OfflineProgressSummary,
  StageUnlockStatus,
  IPOEligibilityResult,
  IPOExecutionResult,
  TakeoverResult,
  AccountingAuditResult,
  DailyLogEntry,
  BatchSimulationSummary,
  SimulationState,
  TransactionRecord,
  TransactionType,
  OrderExecutionResult,
  PendingOrder,
  PendingOrderType,
  PendingOrderSide,
  PendingOrderStatus,
  EstablishCompanyParams,
  Account,
  AccountId,
  BankLoanType,
  CentralLedgerState,
  CollateralItem,
  CompanyOperationsState,
  DetailedIncomeBreakdown,
  FinancialIntegrityAuditReport,
  InvestmentPackageType,
  InvestmentProject,
  LedgerEntry,
  LedgerTransaction,
  LoanContract,
  LoanOfferQuote,
  MoneyTransfer,
  TransactionCategory,
  WorkforcePlan,
  CareerStage,
  CommercialContract,
  IncorporationEligibilityResult,
  InventoryBatch,
  LogisticsRoute,
  LogisticsVehicle,
  PaymentTermType,
  ProcurementOrder,
  ProductionOrder,
  PurchaseContract,
  RecipeDefinition,
  ResourceDefinition,
  SalesChannel,
  Shipment,
  ShopInstance,
  ShopTemplate,
  ShopType,
  Supplier,
  SupplierOffer,
  TradeEvent,
  TradeIntegrityAuditReport,
  TradeInvoice,
  TradePayment,
  TradeUniverseState,
  VehicleTypeId,
  Warehouse,
};

export class SimulationEngine {
  public static readonly CURRENT_SCHEMA_VERSION = 5;
  public static readonly DEFAULT_SEED = 20261104;
  public static readonly DEFAULT_INITIAL_CASH = 100_000;
  public static readonly STAGE_2_NET_WORTH_THRESHOLD =
    CompanyEngine.STAGE_2_NET_WORTH_THRESHOLD;
  public static readonly STAGE_3_IPO_REVENUE_THRESHOLD =
    IPOEngine.MIN_ANNUAL_REVENUE;
  public static readonly COMMISSION_RATE = MarketEngine.COMMISSION_RATE;
  public static readonly INTRADAY_SUBSTEP_MINUTES =
    GameClockEngine.INTRADAY_SUBSTEP_MINUTES;

  public state: SimulationState;
  public rng: RandomEngine;
  public pendingDailyActions: string[] = [];
  /** Kayıt yeni dengeye taşınırken oyuncuya bir kez gösterilecek notlar */
  public migrationNotices: string[] = [];

  public consumeMigrationNotices(): string[] {
    const out = this.migrationNotices;
    this.migrationNotices = [];
    return out;
  }
  public maxProcessedOfflineTimestampMs: number = 0;
  public intradayTracking = {
    ordersExecuted: 0,
    ordersExpired: 0,
    productionCompleted: 0,
    revenueGenerated: 0,
    expensesPaid: 0,
    researchProgress: 0,
    dividendsCollected: 0,
    newsGenerated: 0,
  };

  constructor(
    seed: number = SimulationEngine.DEFAULT_SEED,
    initialCash: number = SimulationEngine.DEFAULT_INITIAL_CASH
  ) {
    this.rng = new RandomEngine(seed);
    this.state = this.createFreshInitialState(seed, initialCash);
  }

  public computeDateISO(day: number): string {
    const baseDate = new Date(Date.UTC(2026, 0, 1));
    baseDate.setUTCDate(baseDate.getUTCDate() + (day - 1));
    return baseDate.toISOString().slice(0, 10);
  }

  /**
   * Yeni oyunun başlangıç durumunu oluşturur:
   * - Saat: 00:00 (MARKET_CLOSED)
   * - 1 oyun günü = 45 gerçek dakika (varsayılan)
   * - Nakit: 100.000 TL (varsayılan)
   * - Portföy: 0 TL
   * - Oyuncu şirketi: null (yok)
   * - Borç: 0 TL
   * - Toplam net varlık: 100.000 TL
   * - Girişimci, IPO ve Holding aşamaları: kilitli (eğer initialCash < 2.000.000 TL ise)
   */
  public createFreshInitialState(
    seed: number,
    initialCash: number
  ): SimulationState {
    const cleanInitialCash = Number(Math.max(0, initialCash).toFixed(2));
    const macro = EconomyEngine.createInitialMacroState();
    const initialStocks = MarketEngine.createInitialMarketStocks(macro);
    const initialFunds = createInitialNpcFunds();
    const initialNews: NewsEvent = {
      id: 'NEWS-DAY-1',
      day: 1,
      headline:
        'Borsa İstanbul Endeksi Yeni Döneme Dengeli Likidite İle Başladı',
      summary:
        '8 ana sektörde faaliyet gösteren 16 şirket için finansal tablolar ve değerleme çarpanları açıklandı.',
      sector: 'GENEL',
      initialImpact: 0.002,
      sentimentImpact: 0.002,
      decayRate: 0.3,
    };

    const isStage2UnlockedInitially =
      cleanInitialCash >= SimulationEngine.STAGE_2_NET_WORTH_THRESHOLD;

    const stageUnlocks: StageUnlockStatus = {
      stage1Retail: true,
      stage2Entrepreneur: isStage2UnlockedInitially,
      stage3Ipo: false,
      stage4Holding: false,
    };

    const playerFinancials: PlayerFinancialState = {
      cash: cleanInitialCash,
      portfolioMarketValue: 0,
      playerCompanyEquityValue: 0,
      accruedDividendsReceivable: 0,
      shortTermDebt: 0,
      longTermDebt: 0,
      totalDebt: 0,
      netWorth: cleanInitialCash,
    };

    const initialClock = GameClockEngine.computeClockFields(0);
    const defaultTimestampISO = '2026-01-01T00:00:00.000Z';
    const initialLedger = CentralLedgerEngine.createInitialLedgerState({
      initialPersonalCash: 0,
      initialInvestmentCash: cleanInitialCash,
      reservedInvestmentCash: 0,
      day: 1,
    });

    const initialState: SimulationState = {
      schemaVersion: SimulationEngine.CURRENT_SCHEMA_VERSION,
      seed: this.rng.getSeed(),
      randomState: this.rng.getState(),
      day: 1,
      dateISO: this.computeDateISO(1),
      currentGameMinute: initialClock.currentGameMinute,
      currentGameHour: initialClock.currentGameHour,
      minutesIntoCurrentDay: initialClock.minutesIntoCurrentDay,
      totalElapsedGameMinutes: 0,
      realMinutesPerGameDay:
        GameClockEngine.DEFAULT_REAL_MINUTES_PER_GAME_DAY,
      timeScale: 1,
      isPaused: false,
      marketSession: initialClock.marketSession,
      lastRealTimestampISO: defaultTimestampISO,
      lastAutosaveTimestampISO: defaultTimestampISO,
      intradaySubstepBufferMinutes: 0,
      intradayStepsProcessedToday: 0,
      intradayMarketStepsCompletedToday: 0,
      stage: isStage2UnlockedInitially
        ? SimulationStage.STAGE_2_ENTREPRENEUR
        : SimulationStage.STAGE_1_RETAIL_INVESTOR,
      stageUnlocks,
      cash: cleanInitialCash,
      personalCash: 0,
      investmentCash: cleanInitialCash,
      holdingCash: 0,
      shortTermDebt: 0,
      longTermDebt: 0,
      totalDebt: 0,
      accruedDividendsReceivable: 0,
      netWorth: cleanInitialCash,
      portfolioValue: 0,
      playerFinancials,
      totalDividendsEarned: 0,
      totalSynergyEarned: 0,
      marketIndex: 1000.0,
      marketIndexHistory: [1000.0],
      netWorthHistory: [cleanInitialCash],
      macro,
      stocks: initialStocks,
      balanceVersion: CURRENT_BALANCE_VERSION,
      portfolio: {},
      pendingOrders: [],
      playerCompany: null,
      institutionalFunds: initialFunds,
      newsFeed: [initialNews],
      transactions: [],
      transactionSequence: 0,
      orderSequence: 0,
      controlledSubsidiaries: [],
      dailyLogs: [
        {
          day: 1,
          dateISO: this.computeDateISO(1),
          stage: isStage2UnlockedInitially
            ? SimulationStage.STAGE_2_ENTREPRENEUR
            : SimulationStage.STAGE_1_RETAIL_INVESTOR,
          cash: cleanInitialCash,
          portfolioMarketValue: 0,
          privateCompanyEquityValue: 0,
          accruedDividends: 0,
          totalDebt: 0,
          netWorth: cleanInitialCash,
          marketIndexValue: 1000.0,
          dividendsReceivedToday: 0,
          holdingSynergyReceivedToday: 0,
          headlineNews: initialNews.headline,
          actionsTaken: [
            `Yeni simülasyon ₺${cleanInitialCash.toLocaleString('tr-TR')} başlangıç sermayesi ile başlatıldı.`,
          ],
          integrityValid: true,
        },
      ],
      lastBatchSummary: null,
      lastOfflineSummary: null,
      lastOfflineProcessedTimestampISO: defaultTimestampISO,
      lastOfflineSummaryDismissed: true,
      lastIntegrityAudit: {
        valid: true,
        checkedDay: 1,
        playerNetWorthEquationValid: true,
        companyBalanceSheetsValid: true,
        pricesValid: true,
        errors: [],
      },
      centralLedger: initialLedger,
      activeLoans: [],
      collaterals: [],
      loanSequence: 0,
      projectSequence: 0,
      lastSimulationTickId: 'TICK-D1-M0',
      lastProcessedDayClose: 0,
      lastProcessedGameMinuteTotal: 0,
      lastFinancialIntegrityReport: null,
      tradeState: TradeAndShopEngine.createInitialTradeUniverseState(),
    };

    TradeAndShopEngine.ensureTradeUniverseState(initialState);
    initialState.lastIntegrityAudit =
      AccountingEngine.auditSimulationIntegrity(initialState);
    initialState.lastFinancialIntegrityReport =
      CentralLedgerEngine.runFinancialIntegrityAudit(initialState, 0);
    return initialState;
  }

  public getState(): SimulationState {
    return this.state;
  }

  public getRandomState(): number {
    return this.rng.getState();
  }

  public getFormattedGameTime(): string {
    return GameClockEngine.formatGameTime(
      this.state.currentGameHour,
      this.state.currentGameMinute
    );
  }

  /**
   * Eski (v2/v3) veya duplicate ID içeren işlem geçmişini (`transactions`), bekleyen emirleri (`pendingOrders`)
   * ve haber akışını (`newsFeed`) veri kaybı olmadan deterministik ve idempotent biçimde benzersiz kimliklere dönüştürür.
   * - `transactions` dizisi en yeni işlem 0. indekste, en eski işlem (N-1). indekste olacak şekilde saklanır.
   * - Oluşum sırasına (eskiden yeniye) göre her işleme kalıcı `TX-D<gün>-S<8 haneli sıra>` kimliği atanır.
   * - Aynı migration ikinci kez çalıştığında mevcut benzersiz kanonik ID'ler ve sayaç asla değiştirilmez (Idempotent).
   */
  public static sanitizeAndMigrateTransactionsAndOrders(
    state: Partial<SimulationState>
  ): {
    transactions: TransactionRecord[];
    transactionSequence: number;
    pendingOrders: PendingOrder[];
    orderSequence: number;
    newsFeed: NewsEvent[];
    duplicateTransactionsFixedCount: number;
    duplicateOrdersFixedCount: number;
  } {
    return SimulationPersistence.sanitizeAndMigrateTransactionsAndOrders(state);
  }

  /**
   * Kaydedilmiş bir simülasyon durumunu (v2, v3, v4 veya v5) ve deterministik PRNG state'ini geri yükler.
   */
  public restoreFromSavedState(saved: SimulationState): void {
    const cloned = JSON.parse(JSON.stringify(saved)) as Partial<SimulationState>;
    this.rng = new RandomEngine(cloned.seed || SimulationEngine.DEFAULT_SEED);
    if (typeof cloned.randomState === 'number') {
      this.rng.restoreState(cloned.randomState);
    }

    const minutesIntoDay = GameClockEngine.normalizeMinuteOfDay(
      typeof cloned.minutesIntoCurrentDay === 'number'
        ? cloned.minutesIntoCurrentDay
        : 0
    );
    const clockFields = GameClockEngine.computeClockFields(minutesIntoDay);
    const day =
      typeof cloned.day === 'number' && cloned.day >= 1
        ? Math.floor(cloned.day)
        : 1;

    const sanitizedCollections =
      SimulationEngine.sanitizeAndMigrateTransactionsAndOrders(cloned);

    const cleanCash =
      typeof cloned.cash === 'number' && Number.isFinite(cloned.cash)
        ? Number(Math.max(0, cloned.cash).toFixed(2))
        : SimulationEngine.DEFAULT_INITIAL_CASH;
    const cleanPersonalCash =
      typeof cloned.personalCash === 'number' &&
      Number.isFinite(cloned.personalCash) &&
      cloned.personalCash >= 0
        ? Number(Math.min(cleanCash, cloned.personalCash).toFixed(2))
        : 0;
    const cleanInvestmentCash = Number(
      Math.max(0, cleanCash - cleanPersonalCash).toFixed(2)
    );
    const cleanHoldingCash =
      typeof cloned.holdingCash === 'number' &&
      Number.isFinite(cloned.holdingCash) &&
      cloned.holdingCash >= 0
        ? Number(cloned.holdingCash.toFixed(2))
        : 0;

    const macroState =
      cloned.macro || EconomyEngine.createInitialMacroState();

    if (cloned.playerCompany) {
      CompanyEngine.ensureCompanyV5Fields(cloned.playerCompany, macroState);
    }

    const totalElapsedMinutes =
      typeof cloned.totalElapsedGameMinutes === 'number' &&
      Number.isFinite(cloned.totalElapsedGameMinutes)
        ? cloned.totalElapsedGameMinutes
        : (day - 1) * GameClockEngine.MINUTES_PER_GAME_DAY +
          clockFields.minutesIntoCurrentDay;

    const initialOrRestoredLedger =
      cloned.centralLedger &&
      cloned.centralLedger.accounts &&
      Array.isArray(cloned.centralLedger.transactions)
        ? cloned.centralLedger
        : CentralLedgerEngine.createInitialLedgerState({
            initialPersonalCash: cleanPersonalCash,
            initialInvestmentCash: cleanInvestmentCash,
            reservedInvestmentCash: 0,
            day,
            companyTicker: cloned.playerCompany?.ticker,
            companyCash: cloned.playerCompany?.financials.cash ?? 0,
            companyInventory: cloned.playerCompany?.financials.inventory ?? 0,
            companyFixedAssets:
              cloned.playerCompany?.financials.fixedAssets ?? 0,
            companyEquityCapital:
              cloned.playerCompany?.financials.paidInCapital ?? 0,
            totalLoanDebt:
              (cloned.totalDebt ?? 0) +
              (cloned.playerCompany?.financials.totalLiabilities ?? 0),
          });

    const restored: SimulationState = {
      ...(cloned as SimulationState),
      schemaVersion: SimulationEngine.CURRENT_SCHEMA_VERSION,
      day,
      dateISO: cloned.dateISO || this.computeDateISO(day),
      currentGameMinute: clockFields.currentGameMinute,
      currentGameHour: clockFields.currentGameHour,
      minutesIntoCurrentDay: clockFields.minutesIntoCurrentDay,
      totalElapsedGameMinutes: totalElapsedMinutes,
      realMinutesPerGameDay: GameClockEngine.sanitizeRealMinutesPerDay(
        cloned.realMinutesPerGameDay ??
          GameClockEngine.DEFAULT_REAL_MINUTES_PER_GAME_DAY
      ),
      timeScale: GameClockEngine.sanitizeTimeScale(cloned.timeScale ?? 1),
      isPaused:
        typeof cloned.isPaused === 'boolean'
          ? cloned.isPaused
          : cloned.timeScale === 0,
      marketSession: clockFields.marketSession,
      lastRealTimestampISO:
        typeof cloned.lastRealTimestampISO === 'string' &&
        cloned.lastRealTimestampISO
          ? cloned.lastRealTimestampISO
          : '2026-01-01T00:00:00.000Z',
      lastAutosaveTimestampISO:
        typeof cloned.lastAutosaveTimestampISO === 'string' &&
        cloned.lastAutosaveTimestampISO
          ? cloned.lastAutosaveTimestampISO
          : '2026-01-01T00:00:00.000Z',
      intradaySubstepBufferMinutes:
        typeof cloned.intradaySubstepBufferMinutes === 'number' &&
        Number.isFinite(cloned.intradaySubstepBufferMinutes)
          ? cloned.intradaySubstepBufferMinutes
          : 0,
      intradayStepsProcessedToday:
        typeof cloned.intradayStepsProcessedToday === 'number' &&
        Number.isFinite(cloned.intradayStepsProcessedToday)
          ? cloned.intradayStepsProcessedToday
          : 0,
      intradayMarketStepsCompletedToday:
        typeof cloned.intradayMarketStepsCompletedToday === 'number' &&
        Number.isFinite(cloned.intradayMarketStepsCompletedToday)
          ? cloned.intradayMarketStepsCompletedToday
          : 0,
      cash: cleanCash,
      personalCash: cleanPersonalCash,
      investmentCash: cleanInvestmentCash,
      holdingCash: cleanHoldingCash,
      transactions: sanitizedCollections.transactions,
      transactionSequence: sanitizedCollections.transactionSequence,
      pendingOrders: sanitizedCollections.pendingOrders,
      orderSequence: sanitizedCollections.orderSequence,
      newsFeed: sanitizedCollections.newsFeed,
      lastOfflineSummary: cloned.lastOfflineSummary ?? null,
      lastOfflineProcessedTimestampISO:
        typeof cloned.lastOfflineProcessedTimestampISO === 'string'
          ? cloned.lastOfflineProcessedTimestampISO
          : cloned.lastRealTimestampISO || '2026-01-01T00:00:00.000Z',
      lastOfflineSummaryDismissed:
        typeof cloned.lastOfflineSummaryDismissed === 'boolean'
          ? cloned.lastOfflineSummaryDismissed
          : true,
      centralLedger: initialOrRestoredLedger,
      activeLoans: Array.isArray(cloned.activeLoans) ? cloned.activeLoans : [],
      collaterals: Array.isArray(cloned.collaterals) ? cloned.collaterals : [],
      loanSequence:
        typeof cloned.loanSequence === 'number' &&
        Number.isFinite(cloned.loanSequence)
          ? Math.floor(cloned.loanSequence)
          : 0,
      projectSequence:
        typeof cloned.projectSequence === 'number' &&
        Number.isFinite(cloned.projectSequence)
          ? Math.floor(cloned.projectSequence)
          : 0,
      lastSimulationTickId:
        typeof cloned.lastSimulationTickId === 'string' &&
        cloned.lastSimulationTickId
          ? cloned.lastSimulationTickId
          : `TICK-D${day}-M${totalElapsedMinutes}`,
      lastProcessedGameMinuteTotal:
        typeof cloned.lastProcessedGameMinuteTotal === 'number' &&
        Number.isFinite(cloned.lastProcessedGameMinuteTotal)
          ? cloned.lastProcessedGameMinuteTotal
          : totalElapsedMinutes,
      lastProcessedDayClose:
        typeof cloned.lastProcessedDayClose === 'number' &&
        Number.isFinite(cloned.lastProcessedDayClose)
          ? cloned.lastProcessedDayClose
          : Math.max(0, day - 1),
      lastFinancialIntegrityReport: cloned.lastFinancialIntegrityReport ?? null,
      tradeState: cloned.tradeState,
      decisionEvents: cloned.decisionEvents,
      wealthTax: cloned.wealthTax,
      lastDayReport: cloned.lastDayReport,
      balanceVersion: cloned.balanceVersion,
    };

    const parsedLastTs = Date.parse(restored.lastRealTimestampISO);
    const parsedOfflineTs = Date.parse(
      restored.lastOfflineProcessedTimestampISO || ''
    );
    const bestTs = Math.max(
      Number.isFinite(parsedLastTs) ? parsedLastTs : 0,
      Number.isFinite(parsedOfflineTs) ? parsedOfflineTs : 0
    );
    if (bestTs > Date.parse('2026-01-01T00:00:00.000Z')) {
      this.maxProcessedOfflineTimestampMs = bestTs;
    }

    this.state = restored;
    TradeAndShopEngine.ensureTradeUniverseState(this.state);
    // Eski kayıtları yeni geç oyun dengesine taşı (bir kez)
    for (const msg of migrateBalance(this.state)) {
      this.pendingDailyActions.push(`[Denge] ${msg}`);
      this.migrationNotices.push(msg);
    }
    this.recalculateFinancialsAndStages();
  }

  public getNextScheduledEvent(): {
    eventLabelTR: string;
    remainingGameMinutes: number;
    formattedRemaining: string;
  } {
    return GameClockEngine.getNextScheduledEvent(
      this.state.minutesIntoCurrentDay
    );
  }

  public acknowledgeOfflineSummary(): void {
    this.state.lastOfflineSummaryDismissed = true;
    this.state.lastOfflineSummary = null;
  }

  public serializeState(): string {
    this.state.randomState = this.rng.getState();
    return JSON.stringify(this.state);
  }

  public static deserializeState(serializedJson: string): SimulationEngine {
    const parsed = JSON.parse(serializedJson) as SimulationState;
    const engine = new SimulationEngine(
      parsed.seed || SimulationEngine.DEFAULT_SEED,
      SimulationEngine.DEFAULT_INITIAL_CASH
    );
    engine.restoreFromSavedState(parsed);
    return engine;
  }

  public checkIPOEligibility(): IPOEligibilityResult {
    return IPOEngine.checkEligibility(this.state.playerCompany);
  }

  // ============================================================================
  // ZAMAN VE HIZ KONTROLLERİ (GameClockEngine Entegrasyonu)
  // ============================================================================

  public setRealMinutesPerGameDay(minutes: RealMinutesPerGameDayOption): void {
    this.state.realMinutesPerGameDay =
      GameClockEngine.sanitizeRealMinutesPerDay(minutes);
  }

  public setTimeScale(scale: TimeScaleOption): void {
    const cleanScale = GameClockEngine.sanitizeTimeScale(scale);
    this.state.timeScale = cleanScale;
    this.state.isPaused = cleanScale === 0;
  }

  public pauseSimulation(): void {
    this.state.isPaused = true;
  }

  public resumeSimulation(scale?: TimeScaleOption): void {
    this.state.isPaused = false;
    if (typeof scale === 'number' && scale > 0) {
      this.state.timeScale = GameClockEngine.sanitizeTimeScale(scale);
    } else if (this.state.timeScale === 0) {
      this.state.timeScale = 1;
    }
  }

  /**
   * Gerçek saniye farkını mevcut `realMinutesPerGameDay`, `timeScale` ve `isPaused`
   * durumuna göre oyun dakikasına çevirir ve ilerletir.
   */
  public advanceRealSeconds(seconds: number): {
    gameMinutesAdvanced: number;
    daysClosed: number;
  } {
    if (
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      this.state.isPaused ||
      this.state.timeScale === 0
    ) {
      return { gameMinutesAdvanced: 0, daysClosed: 0 };
    }

    const rawGameMinutes = GameClockEngine.realSecondsToGameMinutes(
      seconds,
      this.state.realMinutesPerGameDay,
      this.state.timeScale,
      this.state.isPaused
    );

    const totalBuffered =
      this.state.intradaySubstepBufferMinutes + rawGameMinutes;
    const wholeMinutesToAdvance = Math.floor(totalBuffered + 1e-9);
    this.state.intradaySubstepBufferMinutes = Number(
      Math.max(0, totalBuffered - wholeMinutesToAdvance).toFixed(6)
    );

    if (wholeMinutesToAdvance <= 0) {
      return { gameMinutesAdvanced: 0, daysClosed: 0 };
    }

    return this.advanceGameMinutes(wholeMinutesToAdvance);
  }

  /**
   * Oyun saatini verilen `minutes` kadar güvenli ve deterministik biçimde ilerletir:
   * - Negatif, NaN veya Infinity değerleri reddeder.
   * - Büyük süreleri gün sınırlarına ve 5 dakikalık alt adımlara bölerek sırayla işler.
   * - Gün sınırı (1440. dakika) geçildiğinde `closeCurrentDay()` yalnızca bir kez çağrılır.
   */
  public advanceGameMinutes(minutes: number): {
    gameMinutesAdvanced: number;
    daysClosed: number;
  } {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return { gameMinutesAdvanced: 0, daysClosed: 0 };
    }

    const totalWholeMinutes = Math.floor(minutes + 1e-9);
    if (totalWholeMinutes <= 0) {
      return { gameMinutesAdvanced: 0, daysClosed: 0 };
    }

    let remaining = totalWholeMinutes;
    let daysClosed = 0;
    const stepSize = SimulationEngine.INTRADAY_SUBSTEP_MINUTES; // 5 dk

    while (remaining > 0) {
      const currentMin = this.state.minutesIntoCurrentDay;
      const nextSubstepTarget =
        Math.floor(currentMin / stepSize) * stepSize + stepSize;
      const minutesToNextBoundary = Math.min(
        remaining,
        nextSubstepTarget - currentMin,
        GameClockEngine.MINUTES_PER_GAME_DAY - currentMin
      );

      this.state.minutesIntoCurrentDay += minutesToNextBoundary;
      this.state.totalElapsedGameMinutes += minutesToNextBoundary;
      remaining -= minutesToNextBoundary;

      // Eğer 5 dakikalık alt adım sınırına ulaşıldıysa gün içi alt adımı çalıştır
      if (this.state.minutesIntoCurrentDay % stepSize === 0) {
        this.processIntradayStep(stepSize);
      }

      // Eğer gün sonu (1440. dakika = 24:00) sınırına ulaşıldıysa günü kontrollü kapat
      if (
        this.state.minutesIntoCurrentDay >=
        GameClockEngine.MINUTES_PER_GAME_DAY
      ) {
        this.closeCurrentDay();
        daysClosed += 1;
      } else {
        const clock = GameClockEngine.computeClockFields(
          this.state.minutesIntoCurrentDay
        );
        this.state.currentGameHour = clock.currentGameHour;
        this.state.currentGameMinute = clock.currentGameMinute;
        this.state.marketSession = clock.marketSession;

        // Piyasa açık seansına (10:00) girildiği anda bekleyen emirleri kontrol et
        if (this.state.marketSession === 'MARKET_OPEN') {
          this.processPendingOrders();
        }
      }
    }

    this.state.randomState = this.rng.getState();
    return {
      gameMinutesAdvanced: totalWholeMinutes,
      daysClosed,
    };
  }

  /**
   * 5 Oyun Dakikalık Gün İçi Alt Adım (processIntradayStep):
   * - Piyasa açıkken (MARKET_OPEN: 10:00–17:59) bekleyen emirleri işler,
   *   gün içi dt ölçekli fiyatları günceller ve limit emir koşullarını tekrar denetler.
   * - Oyuncu şirketi varsa üretim, satış, personel gideri, Ar-Ge ve pazarlama giderlerini
   *   gün içine orantılı (gameMinutes / 1440) dağıtır.
   */
  public processIntradayStep(
    gameMinutes: number = SimulationEngine.INTRADAY_SUBSTEP_MINUTES
  ): void {
    if (!Number.isFinite(gameMinutes) || gameMinutes <= 0) return;

    // 5 dakikalık dilimin başlangıç dakikasına göre seansı kontrol et
    const stepStartMinute = Math.max(
      0,
      this.state.minutesIntoCurrentDay - gameMinutes
    );
    const activeSession = GameClockEngine.getMarketSession(stepStartMinute);
    this.state.marketSession = GameClockEngine.getMarketSession(
      this.state.minutesIntoCurrentDay < GameClockEngine.MINUTES_PER_GAME_DAY
        ? this.state.minutesIntoCurrentDay
        : 0
    );

    if (activeSession === 'MARKET_OPEN') {
      // 1. Seans başında bekleyen piyasa ve uygun limit emirlerini çalıştır
      this.processPendingOrders();

      // 2. Gün içi fiyat hareketini (dt = (1/252) * (gameMinutes / 480)) çalıştır
      const tradingDayFraction =
        gameMinutes /
        (GameClockEngine.MARKET_OPEN_END_MINUTE -
          GameClockEngine.MARKET_OPEN_START_MINUTE);
      MarketEngine.stepMarketPricesIntraday(
        this.state.stocks,
        this.state.macro,
        this.rng,
        tradingDayFraction
      );
      this.state.intradayMarketStepsCompletedToday += 1;

      // 3. Yeni oluşan fiyatlarla tetiklenen limit emirleri çalıştır
      this.processPendingOrders();
    }

    // 4. Oyuncu Şirketi Gün İçi Operasyonları (Üretim, Satış, Personel, Ar-Ge, Pazarlama)
    SectorMarket.refreshPlayerMarketContext(this.state);
    if (this.state.playerCompany) {
      const pc = this.state.playerCompany;
      const sectorStocks = this.state.stocks.filter(
        (s) => s.sector === pc.sector
      );
      const avgSectorSentiment =
        sectorStocks.reduce((acc, s) => acc + s.sentimentScore, 0) /
        Math.max(1, sectorStocks.length);

      const dayFraction = gameMinutes / GameClockEngine.MINUTES_PER_GAME_DAY;
      const stepDelta = CompanyEngine.stepPlayerCompanyIntraday(
        pc,
        this.state.macro,
        avgSectorSentiment,
        dayFraction,
        this.state.totalElapsedGameMinutes
      );

      this.intradayTracking.productionCompleted = Number(
        (
          this.intradayTracking.productionCompleted +
          stepDelta.unitsProducedDelta
        ).toFixed(2)
      );
      this.intradayTracking.revenueGenerated = Number(
        (
          this.intradayTracking.revenueGenerated + stepDelta.revenueDelta
        ).toFixed(2)
      );
      this.intradayTracking.expensesPaid = Number(
        (this.intradayTracking.expensesPaid + stepDelta.expensesDelta).toFixed(
          2
        )
      );
      this.intradayTracking.researchProgress = Number(
        (
          this.intradayTracking.researchProgress + stepDelta.rdIncrement
        ).toFixed(6)
      );

      if (pc.isPubliclyListed) {
        const listedStock = this.state.stocks.find(
          (s) => s.ticker === pc.ticker
        );
        if (listedStock) {
          listedStock.financials = pc.financials;
          listedStock.valuation = pc.valuation;
          listedStock.ebitdaAnnual = pc.annualizedEbitda;
          listedStock.fundamentalPrice = pc.valuation.fairValuePerShare;
        }
      }
    }

    this.state.intradayStepsProcessedToday += 1;
    this.state.lastProcessedGameMinuteTotal = this.state.totalElapsedGameMinutes;
    this.state.lastSimulationTickId = `TICK-D${this.state.day}-M${this.state.totalElapsedGameMinutes}`;
    this.recalculateFinancialsAndStages();
  }

  /**
   * Kontrollü Gün Sonu Kapanışı (closeCurrentDay):
   * - Gün içi adımlarda işlenmiş işlemleri ASLA iki kez çalıştırmaz!
   * - Eğer gün doğrudan `tickDay()` ile tek adımda kapatılıyorsa (`intradayStepsProcessedToday === 0`),
   *   tam günlük şirket ve piyasa adımlarını çalıştırır.
   * - Eğer gün `advanceGameMinutes` ile gün içi adımlarla ilerlediyse, yalnızca kalan kesirleri tamamlar
   *   ve gün sonu makro, haber, NPC bilanço, temettü, vadesi dolan emir ve muhasebe denetimini 1 kez yapar.
   */
  public closeCurrentDay(expectedDayToClose?: number): DailyLogEntry {
    return DayCloseProcessor.closeCurrentDay(this, expectedDayToClose);
  }

  /**
   * Geliştirici araçları ve mevcut testler için kontrollü gün sonu ilerletme fonksiyonu.
   */
  public tickDay(): DailyLogEntry {
    const remainingMinutesInDay =
      GameClockEngine.MINUTES_PER_GAME_DAY - this.state.minutesIntoCurrentDay;
    this.state.totalElapsedGameMinutes += remainingMinutesInDay;
    return this.closeCurrentDay();
  }

  // ============================================================================
  // BEKLEYEN EMİRLER VE REZERVASYON SİSTEMİ (placeOrder / cancelOrder / processPendingOrders)
  // ============================================================================

  /**
   * Aktif bekleyen alış emirleri tarafından bloke (rezerve) edilmiş toplam nakit tutarını döndürür.
   */
  public getReservedCash(): number {
    let reserved = 0;
    for (const ord of this.state.pendingOrders) {
      if (ord.status === 'PENDING' || ord.status === 'PARTIALLY_FILLED') {
        reserved += ord.reservedCash;
      }
    }
    return Number(reserved.toFixed(2));
  }

  /**
   * Belirli bir hissede aktif bekleyen satış emirleri tarafından bloke (rezerve) edilmiş toplam lot miktarını döndürür.
   */
  public getReservedShares(ticker: string): number {
    let reserved = 0;
    for (const ord of this.state.pendingOrders) {
      if (
        ord.ticker === ticker &&
        (ord.status === 'PENDING' || ord.status === 'PARTIALLY_FILLED')
      ) {
        reserved += ord.reservedShares;
      }
    }
    return reserved;
  }

  public getSpendableCash(): number {
    return Number(
      Math.max(0, this.state.cash - this.getReservedCash()).toFixed(2)
    );
  }

  public getAvailableShares(ticker: string): number {
    if (BankLoanEngine.isStockPledgedAsCollateral(this.state, ticker)) {
      return 0;
    }
    const owned = this.state.portfolio[ticker]?.shares || 0;
    return Math.max(0, owned - this.getReservedShares(ticker));
  }

  /**
   * Bekleyen Borsa Emri Oluşturur (MARKET_BUY, MARKET_SELL, LIMIT_BUY, LIMIT_SELL):
   * - Nakit veya hisse rezervasyonunu atomik olarak yapar.
   * - Piyasa açıksa (MARKET_OPEN) ve fiyat koşulu sağlanıyorsa emri hemen işler;
   *   piyasa kapalıysa (MARKET_CLOSED, PRE_OPEN, AFTER_HOURS) veya limit koşulu henüz oluşmadıysa
   *   emir PENDING durumunda bekler.
   */
  public placeOrder(params: {
    ticker: string;
    orderType: PendingOrderType;
    requestedShares: number;
    limitPrice?: number;
    expiresInDays?: number;
  }): {
    success: boolean;
    message: string;
    order: PendingOrder | null;
  } {
    return OrderBookProcessor.placeOrder(this, params);
  }

  /**
   * Bekleyen bir emri iptal eder ve bloke edilen nakit veya hisse rezervini serbest bırakır.
   */
  public cancelOrder(orderId: string): {
    success: boolean;
    message: string;
    order: PendingOrder | null;
  } {
    return OrderBookProcessor.cancelOrder(this, orderId);
  }

  /**
   * Piyasa açıkken (MARKET_OPEN) bekleyen emirleri fiyat koşullarına göre çalıştırır.
   */
  public processPendingOrders(): {
    executedOrdersCount: number;
    executedOrderIds: string[];
  } {
    return OrderBookProcessor.processPendingOrders(this);
  }

  public expireOutdatedOrders(currentDay: number): void {
    return OrderBookProcessor.expireOutdatedOrders(this, currentDay);
  }

  // ============================================================================
  // ÇEVRİMDIŞI İLERLEME (processOfflineProgress)
  // ============================================================================

  /**
   * Uygulama kapalıyken geçen gerçek süreyi hesaplar, maksimum 3 oyun günü (4320 oyun dakikası)
   * sınırını uygular ve simülasyonu deterministik adımlarla ilerletir.
   * - Cihaz saati geriye alınmışsa negatif süreyi işlemez.
   * - Aynı zaman aralığının iki kez işlenmesini kesin olarak engeller.
   */
  public processOfflineProgress(
    lastTimestampISO?: string,
    currentTimestampISO?: string
  ): OfflineProgressSummary {
    return DayCloseProcessor.processOfflineProgress(this, lastTimestampISO, currentTimestampISO);
  }

  public syncPlayerCashBuckets(): void {
    const cleanTotalCash = Number(Math.max(0, this.state.cash).toFixed(2));
    WalletEngine.setBalance(this.state, cleanTotalCash);
    const personal = Number(
      Math.max(0, this.state.personalCash || 0).toFixed(2)
    );
    const investment = Number(
      Math.max(0, this.state.investmentCash || 0).toFixed(2)
    );
    if (Math.abs(personal + investment - cleanTotalCash) > 0.01) {
      if (personal <= cleanTotalCash) {
        this.state.personalCash = personal;
        this.state.investmentCash = Number(
          Math.max(0, cleanTotalCash - personal).toFixed(2)
        );
      } else {
        this.state.personalCash = cleanTotalCash;
        this.state.investmentCash = 0;
      }
    } else {
      this.state.personalCash = personal;
      this.state.investmentCash = investment;
    }
    this.state.holdingCash = Number(
      Math.max(0, this.state.holdingCash || 0).toFixed(2)
    );
  }

  /**
   * Oyuncunun Net Varlık Denklemini ve Aşama Kilitlerini Hesaplar:
   * toplamNetVarlik = nakit + holdingNakit + portföyPiyasaDegeri + oyuncuSirketDegeri + temettuAlacagi - borclar
   */
  public recalculateFinancialsAndStages(): void {
    return StageProcessor.recalculateFinancialsAndStages(this);
  }

  public recordTransaction(
    params: Omit<
      TransactionRecord,
      'id' | 'day' | 'netWorthBefore' | 'netWorthAfter'
    > & { netWorthBefore?: number; netWorthAfter?: number }
  ): string {
    const nextSeq =
      (typeof this.state.transactionSequence === 'number' &&
      Number.isFinite(this.state.transactionSequence) &&
      this.state.transactionSequence >= 0
        ? Math.floor(this.state.transactionSequence)
        : 0) + 1;
    this.state.transactionSequence = nextSeq;
    const id = `TX-D${this.state.day}-S${String(nextSeq).padStart(8, '0')}`;
    const record: TransactionRecord = {
      id,
      day: this.state.day,
      type: params.type,
      ticker: params.ticker,
      shares: params.shares,
      executionPrice: params.executionPrice,
      grossAmount: params.grossAmount,
      commission: params.commission,
      slippageBps: params.slippageBps,
      cashDelta: params.cashDelta,
      netWorthBefore: params.netWorthBefore ?? this.state.netWorth,
      netWorthAfter: params.netWorthAfter ?? this.state.netWorth,
      description: params.description,
    };
    this.state.transactions.unshift(record);
    if (this.state.transactions.length > 250) {
      this.state.transactions.pop();
    }
    return id;
  }

  /**
   * Doğrudan Borsa Hisse Alım İşlemi (Geliştirici Paneli ve Geriye Uyumluluk İçin Korundu).
   * Rezerve edilmiş nakdi dikkate alır.
   */
  public buyStock(
    ticker: string,
    sharesToBuy: number
  ): {
    success: boolean;
    message: string;
    totalCost: number;
    executionPrice?: number;
    commission?: number;
    slippageBps?: number;
  } {
    return OrderBookProcessor.buyStock(this, ticker, sharesToBuy);
  }

  /**
   * Doğrudan Borsa Hisse Satış İşlemi (Geliştirici Paneli ve Geriye Uyumluluk İçin Korundu).
   * Açık satış emirlerinde rezerve edilmiş ve teminat gösterilmiş hisseleri dikkate alır.
   */
  public sellStock(
    ticker: string,
    sharesToSell: number
  ): {
    success: boolean;
    message: string;
    netProceeds: number;
    realizedPnL: number;
    executionPrice?: number;
    commission?: number;
  } {
    return OrderBookProcessor.sellStock(this, ticker, sharesToSell);
  }

  /**
   * Aşama 2: Oyuncu Şirketi Kurulumu
   */
  public establishCompany(
    name: string,
    ticker: string,
    sector: SectorId,
    initialCapital: number,
    options?: {
      initialStaffCount?: number;
      initialRdBudget?: number;
      initialCapacity?: number;
    }
  ): { success: boolean; message: string; company?: PlayerCompany } {
    return PlayerCompanyActions.establishCompany(this, name, ticker, sector, initialCapital, options);
  }

  /**
   * Aşama 2: Çift Kayıt Sermaye Aktarımı (Kişisel Nakit -> Şirket Özkaynağı)
   */
  public transferCapitalToCompany(amount: number): {
    success: boolean;
    message: string;
  } {
    return PlayerCompanyActions.transferCapitalToCompany(this, amount);
  }

  /**
   * Aşama 2: Şirket Operasyonlarını Yapılandırma
   */
  public configureCompanyOperations(params: {
    targetStaffCount?: number;
    targetProductionCapacity?: number;
    dailyRdBudget?: number;
    dailyMarketingBudget?: number;
    borrowLoanAmount?: number;
    unitSalePrice?: number;
    unitSellingPrice?: number;
    plannedProductionUnits?: number;
    qualityTarget?: number;
    shiftCount?: 1 | 2 | 3;
    shifts?: 1 | 2 | 3;
    salaryTier?: 'ECONOMY' | 'STANDARD' | 'COMPETITIVE';
    overtimeEnabled?: boolean;
    salaryPolicyMultiplier?: number;
    autoHireEnabled?: boolean;
    maxStorageUnits?: number;
  }): { success: boolean; message: string; capitalSpent: number } {
    return PlayerCompanyActions.configureCompanyOperations(this, params);
  }

  // ============================================================================
  // AŞAMA 2, 3, 6 VE 7: MERKEZİ DEFTER, FİNANS MERKEZİ TRANSFERLERİ, BANKA KREDİLERİ VE ÖLÇEKLENEBİLİR YATIRIMLAR
  // ============================================================================

  public getMaxSafeTransferAmount(sourceAccountId: AccountId): {
    rawBalance: number;
    reservedAmount: number;
    upcomingLoanInstallment: number;
    minWorkingCapitalBuffer: number;
    unpaidPayrollAndTax: number;
    maxSafeTransferable: number;
  } {
    return CentralLedgerEngine.computeMaxSafeTransferAmount(
      this.state,
      sourceAccountId,
      this.getReservedCash()
    );
  }

  public executeMoneyTransfer(params: {
    sourceAccountId: AccountId;
    destinationAccountId: AccountId;
    amount: number;
    category: TransactionCategory;
    description: string;
    idempotencyKey?: string;
  }): {
    success: boolean;
    message: string;
    transaction: LedgerTransaction | null;
    rejectedTransfer?: MoneyTransfer;
    netAmountTransferred: number;
    taxWithheld: number;
  } {
    return PlayerCompanyActions.executeMoneyTransfer(this, params);
  }

  public getLoanOfferQuote(params: {
    loanType: BankLoanType;
    requestedPrincipal?: number;
    customTermDays?: number;
    selectedCollateralIds?: string[];
  }): LoanOfferQuote {
    return BankLoanEngine.computeLoanOfferQuote(this.state, {
      loanType: params.loanType,
      requestedPrincipal: params.requestedPrincipal,
      customTermDays: params.customTermDays,
      selectedCollateralIds: params.selectedCollateralIds,
    });
  }

  public takeOutBankLoan(params: {
    loanType: BankLoanType;
    principal: number;
    termInGameDays?: number;
    collateralIds?: string[];
    idempotencyKey?: string;
  }): {
    success: boolean;
    message: string;
    loan: LoanContract | null;
  } {
    const res = BankLoanEngine.takeOutBankLoan(
      this.state,
      {
        loanType: params.loanType,
        principal: params.principal,
        termInGameDays: params.termInGameDays,
        collateralIds: params.collateralIds,
        idempotencyKey: params.idempotencyKey,
      },
      this.getReservedCash()
    );
    this.recalculateFinancialsAndStages();
    if (res.success) {
      this.pendingDailyActions.push(res.message);
    }
    return res;
  }

  public payLoanInstallment(
    loanId: string,
    idempotencyKey?: string
  ): {
    success: boolean;
    message: string;
    principalReduced: number;
    interestPaid: number;
  } {
    const res = BankLoanEngine.payLoanInstallment(
      this.state,
      loanId,
      this.getReservedCash(),
      idempotencyKey
    );
    this.recalculateFinancialsAndStages();
    if (res.success) {
      this.pendingDailyActions.push(res.message);
    }
    return res;
  }

  public payOffLoanEarly(
    loanId: string,
    idempotencyKey?: string
  ): {
    success: boolean;
    message: string;
    totalPaid: number;
    earlyFeePaid: number;
  } {
    const res = BankLoanEngine.payOffLoanEarly(
      this.state,
      loanId,
      this.getReservedCash(),
      idempotencyKey
    );
    this.recalculateFinancialsAndStages();
    if (res.success) {
      this.pendingDailyActions.push(res.message);
    }
    return res;
  }

  public getInvestmentProjectQuote(params: {
    packageType: InvestmentPackageType;
    customCapacityGain?: number;
    budgetMaxMode?: boolean;
  }): ReturnType<typeof CompanyEngine.computeInvestmentProjectQuote> | null {
    if (!this.state.playerCompany) return null;
    const upcomingLoanInstallments = (this.state.activeLoans || [])
      .filter(
        (l) =>
          (l.status === 'ACTIVE' || l.status === 'DELINQUENT') &&
          l.borrowerType === 'COMPANY' &&
          l.nextPaymentGameDay - this.state.day <= 15
      )
      .reduce((sum, l) => sum + l.installmentAmount, 0);
    return CompanyEngine.computeInvestmentProjectQuote(
      this.state.playerCompany,
      params.packageType,
      {
        customCapacityGain: params.customCapacityGain,
        budgetMaxMode: params.budgetMaxMode,
        upcomingLoanInstallments,
      }
    );
  }

  public startCompanyInvestmentProject(params: {
    packageType: InvestmentPackageType;
    customCapacityGain?: number;
    budgetMaxMode?: boolean;
    fundingSource?: 'COMPANY_CASH' | 'BANK_LOAN';
    facilityLocation?: string;
  }): {
    success: boolean;
    message: string;
    project: InvestmentProject | null;
  } {
    return PlayerCompanyActions.startCompanyInvestmentProject(this, params);
  }

  public cancelCompanyInvestmentProject(projectId: string): {
    success: boolean;
    message: string;
    refundedAmount: number;
    penaltyPaid: number;
    cancellationPenalty: number;
  } {
    if (!this.state.playerCompany) {
      return {
        success: false,
        message: 'Aktif şirket bulunamadı.',
        refundedAmount: 0,
        penaltyPaid: 0,
        cancellationPenalty: 0,
      };
    }
    const res = CompanyEngine.cancelInvestmentProject(
      this.state.playerCompany,
      projectId
    );
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return {
      ...res,
      cancellationPenalty: res.penaltyPaid,
    };
  }

  public liquidateCompanyInventory(
    unitsToLiquidate: number,
    discountRatio: number = 0.25
  ): {
    success: boolean;
    message: string;
    unitsSold: number;
    cashProceeds: number;
    cashGenerated: number;
  } {
    return PlayerCompanyActions.liquidateCompanyInventory(this, unitsToLiquidate, discountRatio);
  }

  /**
   * Geliştirici görünümündeki "Ekonomik Denetim Çalıştır" butonu için:
   * Gerçek oyuncu durumunu DEĞİŞTİRMEDEN (klon üzerinde) muhasebe ve bütünlük denetimi çalıştırır.
   */
  public runFinancialIntegrityAuditNonMutating(): {
    accountingAudit: AccountingAuditResult;
    financialIntegrityReport: FinancialIntegrityAuditReport;
  } {
    const clonedState = JSON.parse(
      JSON.stringify(this.state)
    ) as SimulationState;
    const reservedCash = this.getReservedCash();
    CentralLedgerEngine.syncLedgerWithState(clonedState, reservedCash);
    const accountingAudit =
      AccountingEngine.auditSimulationIntegrity(clonedState);
    const financialIntegrityReport =
      CentralLedgerEngine.runFinancialIntegrityAudit(clonedState, reservedCash);
    return {
      accountingAudit,
      financialIntegrityReport,
    };
  }

  /**
   * Aşama 3: Halka Arz (IPO)
   */
  public executeIPO(
    publicFloatRatio: number = 0.3,
    discountRatio: number = 0.12,
    primaryShareIssueRatio: number = 0.35
  ): IPOExecutionResult {
    return PlayerCompanyActions.executeIPO(this, publicFloatRatio, discountRatio, primaryShareIssueRatio);
  }

  /**
   * Aşama 4: Düşmanca Devralma (Hostile Takeover)
   */
  public executeHostileTakeover(
    ticker: string,
    options?: { targetOwnershipPct?: number; useDebtFinancing?: boolean }
  ): TakeoverResult {
    return PlayerCompanyActions.executeHostileTakeover(this, ticker, options);
  }

  // ============================================================================
  // TOPLU GÜN İLERLETME VE GELİŞTİRİCİ STRES SENARYOSU AYRIMI
  // ============================================================================

  /**
   * Normal Zaman İlerletme (`advanceDaysWithoutPlayerDecisions`):
   * - Oyuncu adına HİÇBİR yeni yatırım kararı vermez (hisse alıp satmaz, şirket kurmaz,
   *   IPO yapmaz, takeover başlatmaz).
   * - Yalnızca oyuncunun mevcut açık emirlerini, mevcut şirket ayarlarını ve NPC dünyasını ilerletir.
   */
  public advanceDaysWithoutPlayerDecisions(
    days: number = 30,
    silentConsole: boolean = true
  ): {
    logs: DailyLogEntry[];
    consoleLines: string[];
    summary: BatchSimulationSummary;
    finalState: SimulationState;
  } {
    return this.run30DaySimulation(false, days, silentConsole);
  }

  /**
   * Geliştirici Stres Senaryosu (`runAutomatedStressScenario`):
   * - Yalnızca geliştirici testi ve stres laboratuvarı için otomatik al-sat ve aşama geçişlerini dener.
   */
  public runAutomatedStressScenario(
    days: number = 30,
    silentConsole: boolean = false
  ): {
    logs: DailyLogEntry[];
    consoleLines: string[];
    summary: BatchSimulationSummary;
    finalState: SimulationState;
  } {
    return SimulationScenarios.runAutomatedStressScenario(this, days, silentConsole);
  }

  /**
   * 30 Günlük (veya N Günlük) Gerçek Simülasyon Koşturucu:
   * - Hiçbir şekilde bedava para, melek yatırım hilesi veya gizli avantaj EKLEMEZ!
   */
  public run30DaySimulation(
    enableStrategyAutomation: boolean = true,
    daysToRun: number = 30,
    silentConsole: boolean = false
  ): {
    logs: DailyLogEntry[];
    consoleLines: string[];
    summary: BatchSimulationSummary;
    finalState: SimulationState;
  } {
    return SimulationScenarios.run30DaySimulation(this, enableStrategyAutomation, daysToRun, silentConsole);
  }

  // ============================================================================
  // ESNAF, DÜKKÂN, TİCARET EVRENİ, REÇETE ÜRETİMİ VE ŞİRKETLEŞME API'LERİ
  // ============================================================================

  public getTradeUniverseState(): TradeUniverseState {
    return TradeAndShopEngine.ensureTradeUniverseState(this.state);
  }

  public openShop(params: {
    shopType: ShopType;
    customName?: string;
    cityBuildingId?: string;
    districtLabel?: string;
    initialCashFloat?: number;
  }): { success: boolean; message: string; shop?: ShopInstance } {
    const res = TradeAndShopEngine.openShop(this.state, {
      shopType: params.shopType,
      customNameTR: params.customName,
      cityBlockId: params.cityBuildingId,
      initialWorkingCash: params.initialCashFloat,
      reservedOrderCash: this.getReservedCash(),
    });
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return {
      success: res.success,
      message: res.message,
      shop: res.shop ?? undefined,
    };
  }

  /** Dükkâna müdür tutar (seviye kapısı ve işe alma ücreti ShopManager'da). */
  public hireShopManager(shopId: string): { success: boolean; message: string } {
    const res = ShopManager.hireManager(this.state, shopId, this.getReservedCash());
    if (res.success) this.recalculateFinancialsAndStages();
    return res;
  }

  public fireShopManager(shopId: string): { success: boolean; message: string } {
    return ShopManager.fireManager(this.state, shopId);
  }

  public setShopManagerSweep(shopId: string, on: boolean): { success: boolean; message: string } {
    return ShopManager.setManagerSweep(this.state, shopId, on);
  }

  /** Bekleyen karar kartında A ya da B seçeneğini uygular. */
  public resolveDecisionEvent(choiceId: 'A' | 'B'): { success: boolean; message: string } {
    const res = DecisionEventEngine.resolveDecision(this.state, choiceId, this.getReservedCash());
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(`[Karar] ${res.message}`);
    }
    return res;
  }

  public upgradeShopLevel(shopId: string): {
    success: boolean;
    message: string;
    newLevel?: number;
  } {
    const res = TradeAndShopEngine.upgradeShopLevel(
      this.state,
      shopId,
      this.getReservedCash()
    );
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return res;
  }

  public transferBetweenPersonalAndShopCash(params: {
    shopId: string;
    direction: 'TO_SHOP' | 'FROM_SHOP';
    amount: number;
  }): { success: boolean; message: string } {
    const res = TradeAndShopEngine.transferBetweenPersonalAndShopCash(
      this.state,
      {
        shopId: params.shopId,
        direction:
          params.direction === 'TO_SHOP'
            ? 'PERSONAL_TO_SHOP'
            : 'SHOP_TO_PERSONAL',
        amount: params.amount,
        reservedOrderCash: this.getReservedCash(),
      }
    );
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return res;
  }

  public configureShopParameters(params: {
    shopId: string;
    staffDelta?: number;
    targetStaffCount?: number;
    priceMultipliers?: Record<string, number>;
    resourceIdForPrice?: string;
    newSellingPrice?: number;
    autoReplenishEnabled?: boolean;
    marketingBudgetDaily?: number;
  }): { success: boolean; message: string } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(this.state);
    const shop = ts.shops.find((s) => s.shopId === params.shopId);
    let targetStaffCount = params.targetStaffCount;
    if (
      typeof targetStaffCount !== 'number' &&
      typeof params.staffDelta === 'number' &&
      shop
    ) {
      targetStaffCount = Math.max(1, shop.staffCount + params.staffDelta);
    }

    let resourceIdForPrice = params.resourceIdForPrice;
    let newSellingPrice = params.newSellingPrice;
    if (params.priceMultipliers && shop) {
      const entries = Object.entries(params.priceMultipliers);
      for (const [resId, mult] of entries) {
        const resDef = RESOURCE_CATALOG[resId];
        const tpl = SHOP_TEMPLATES[shop.shopType];
        if (resDef && tpl && Number.isFinite(mult) && mult > 0) {
          const baseFair =
            resDef.baseMarketPrice * (1 + tpl.defaultGrossMarginPct / 100);
          shop.sellingPrices[resId] = Number((baseFair * mult).toFixed(2));
          resourceIdForPrice = resId;
          newSellingPrice = shop.sellingPrices[resId];
        }
      }
    }

    const res = TradeAndShopEngine.configureShopParameters(this.state, {
      shopId: params.shopId,
      targetStaffCount,
      resourceIdForPrice,
      newSellingPrice,
      autoReplenishEnabled: params.autoReplenishEnabled,
    });
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return res;
  }

  public getSupplierOffers(filterResourceId?: string): SupplierOffer[] {
    return TradeAndShopEngine.getSupplierOffers(this.state, filterResourceId);
  }

  public placeProcurementOrder(params: {
    supplierId: string;
    resourceId: string;
    quantity: number;
    destinationType: 'WAREHOUSE' | 'SHOP';
    destinationId: string;
    paymentTermType: PaymentTermType;
  }): {
    success: boolean;
    message: string;
    order?: ProcurementOrder;
    shipment?: Shipment;
  } {
    const res = TradeAndShopEngine.placeProcurementOrder(this.state, {
      supplierId: params.supplierId,
      resourceId: params.resourceId,
      quantity: params.quantity,
      targetDestinationType: params.destinationType,
      targetDestinationId: params.destinationId,
      paymentMethod: params.paymentTermType,
      reservedOrderCash: this.getReservedCash(),
    });
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return {
      success: res.success,
      message: res.message,
      order: res.order ?? undefined,
      shipment: res.shipment ?? undefined,
    };
  }

  public cancelProcurementOrder(orderId: string): {
    success: boolean;
    message: string;
  } {
    const res = TradeAndShopEngine.cancelProcurementOrder(this.state, orderId);
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return res;
  }

  public createPurchaseContract(params: {
    supplierId: string;
    resourceId: string;
    dailyQuantity: number;
    durationDays: number;
    destinationType: 'WAREHOUSE' | 'SHOP';
    destinationId: string;
    periodDays?: number;
  }): { success: boolean; message: string; contract?: PurchaseContract } {
    const res = TradeAndShopEngine.createPurchaseContract(this.state, {
      supplierId: params.supplierId,
      resourceId: params.resourceId,
      targetDestinationType: params.destinationType,
      targetDestinationId: params.destinationId,
      periodDays: params.periodDays ?? 7,
      orderQuantityPerTrigger: params.dailyQuantity,
      durationDays: params.durationDays,
    });
    if (res.success) {
      this.pendingDailyActions.push(res.message);
    }
    return {
      success: res.success,
      message: res.message,
      contract: res.contract ?? undefined,
    };
  }

  public executeRecipeProduction(params: {
    recipeId: string;
    batchesCount: number;
  }): {
    success: boolean;
    message: string;
    productionOrder?: ProductionOrder;
  } {
    const res = TradeAndShopEngine.executeRecipeProduction(this.state, {
      recipeId: params.recipeId,
      requestedBatches: params.batchesCount,
    });
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return {
      success: res.success,
      message: res.message,
      productionOrder: res.productionOrder ?? undefined,
    };
  }

  public purchaseLogisticsVehicle(vehicleType: VehicleTypeId): {
    success: boolean;
    message: string;
    vehicle?: LogisticsVehicle;
  } {
    const res = TradeAndShopEngine.purchaseLogisticsVehicle(
      this.state,
      vehicleType,
      this.getReservedCash()
    );
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return {
      success: res.success,
      message: res.message,
      vehicle: res.vehicle ?? undefined,
    };
  }

  public dispatchWarehouseToShopShipment(params: {
    sourceWarehouseId: string;
    destinationShopId: string;
    resourceId: string;
    quantity: number;
    useOwnFleet?: boolean;
  }): { success: boolean; message: string; shipment?: Shipment } {
    const res = TradeAndShopEngine.dispatchWarehouseToShopShipment(this.state, {
      warehouseId: params.sourceWarehouseId,
      shopId: params.destinationShopId,
      resourceId: params.resourceId,
      quantity: params.quantity,
    });
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return {
      success: res.success,
      message: res.message,
      shipment: res.shipment ?? undefined,
    };
  }

  public acceptCommercialContract(contractId: string): {
    success: boolean;
    message: string;
  } {
    const res = TradeAndShopEngine.acceptCommercialContract(
      this.state,
      contractId
    );
    if (res.success) {
      this.pendingDailyActions.push(res.message);
    }
    return res;
  }

  public deliverToCommercialContract(params: {
    contractId: string;
    quantity: number;
    sourceType?: 'WAREHOUSE' | 'SHOP';
    sourceId?: string;
  }): { success: boolean; message: string } {
    const res = TradeAndShopEngine.deliverToCommercialContract(
      this.state,
      params.contractId,
      params.quantity
    );
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return res;
  }

  public checkIncorporationEligibility(): IncorporationEligibilityResult {
    return TradeAndShopEngine.checkIncorporationEligibility(this.state);
  }

  public incorporateShopsIntoCompany(params: {
    companyName: string;
    ticker: string;
    sector: SectorId;
    additionalCashCapital?: number;
  }): { success: boolean; message: string } {
    const res = TradeAndShopEngine.incorporateShopsIntoCompany(this.state, {
      companyName: params.companyName,
      ticker: params.ticker,
      sector: params.sector,
      additionalCashFromPlayer: params.additionalCashCapital,
      reservedOrderCash: this.getReservedCash(),
    });
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
    }
    return res;
  }

  public runTradeIntegrityAuditNonMutating(): TradeIntegrityAuditReport {
    const cloned = JSON.parse(JSON.stringify(this.state)) as SimulationState;
    return TradeAndShopEngine.runTradeIntegrityAudit(cloned);
  }

  public formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0,
    }).format(amount);
  }
}

export function runThirtyDayConsoleSimulation(
  seed: number = SimulationEngine.DEFAULT_SEED
) {
  const engine = new SimulationEngine(
    seed,
    SimulationEngine.DEFAULT_INITIAL_CASH
  );
  return engine.runAutomatedStressScenario(30, false);
}

