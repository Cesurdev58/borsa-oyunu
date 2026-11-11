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

import { createInitialNpcFunds } from '../data/npcCompanies';
import { SECTOR_CONFIGS } from '../data/sectors';
import {
  FinancialStatement,
  PlayerCompany,
  QuarterlyFinancialReport,
  ValuationBreakdown,
} from '../models/company';
import { EconomicCyclePhase, MacroEconomyState } from '../models/economy';
import {
  ControlThresholdLevel,
  MarketStock,
  SectorId,
  SectorMetadata,
} from '../models/market';
import { NewsEvent } from '../models/news';
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
import { AccountingEngine } from './AccountingEngine';
import { BankLoanEngine, LOAN_TYPE_CATALOG } from './BankLoanEngine';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';
import { CompanyEngine, EstablishCompanyParams } from './CompanyEngine';
import { EconomyEngine } from './EconomyEngine';
import { GameClockEngine } from './GameClockEngine';
import { IPOEngine } from './IPOEngine';
import { MarketEngine } from './MarketEngine';
import { MergerAcquisitionEngine } from './MergerAcquisitionEngine';
import { NewsEngine } from './NewsEngine';
import { NPCFundEngine } from './NPCFundEngine';
import { RandomEngine } from './RandomEngine';
import {
  DEFAULT_ROUTES,
  RECIPE_CATALOG,
  RESOURCE_CATALOG,
  SHOP_TEMPLATES,
  SUPPLIER_CATALOG,
  TradeAndShopEngine,
  VEHICLE_CATALOG,
} from './TradeAndShopEngine';
import { ValuationEngine } from './ValuationEngine';

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

  private state: SimulationState;
  private rng: RandomEngine;
  private pendingDailyActions: string[] = [];
  private maxProcessedOfflineTimestampMs: number = 0;
  private intradayTracking = {
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

  private computeDateISO(day: number): string {
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
  private createFreshInitialState(
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
    const rawTransactions: TransactionRecord[] = Array.isArray(state.transactions)
      ? state.transactions
      : [];
    const seenTxIds = new Set<string>();
    let duplicateTransactionsFixedCount = 0;
    let maxExtractedTxSeq = 0;
    let allTxCanonical = true;

    for (const tx of rawTransactions) {
      const idStr = typeof tx?.id === 'string' ? tx.id : '';
      if (!idStr || seenTxIds.has(idStr)) {
        duplicateTransactionsFixedCount += 1;
      } else {
        seenTxIds.add(idStr);
      }

      const canonicalMatch = /^TX-D\d+-S(\d+)$/.exec(idStr);
      if (canonicalMatch) {
        const seqVal = Number(canonicalMatch[1]);
        if (Number.isFinite(seqVal) && seqVal > maxExtractedTxSeq) {
          maxExtractedTxSeq = seqVal;
        }
      } else {
        allTxCanonical = false;
        const legacyMatch =
          /^TX-D\d+-(\d+)$/.exec(idStr) || /^TX-(\d+)$/.exec(idStr);
        if (legacyMatch) {
          const legVal = Number(legacyMatch[1]);
          if (Number.isFinite(legVal) && legVal > maxExtractedTxSeq) {
            maxExtractedTxSeq = legVal;
          }
        }
      }
    }

    const hasValidTxSeq =
      typeof state.transactionSequence === 'number' &&
      Number.isFinite(state.transactionSequence) &&
      state.transactionSequence >= 0;

    const existingTxSeq = hasValidTxSeq
      ? Math.floor(state.transactionSequence!)
      : 0;

    const txCount = rawTransactions.length;
    const needsTxMigration =
      !hasValidTxSeq ||
      duplicateTransactionsFixedCount > 0 ||
      !allTxCanonical;

    let migratedTransactions: TransactionRecord[];
    let nextTransactionSequence: number;

    if (needsTxMigration) {
      // Oluşum sırasına (en eski kayıt index = txCount - 1 -> 1, en yeni kayıt index = 0 -> txCount) göre yeniden kimliklendir
      migratedTransactions = rawTransactions.map((tx, idx) => {
        const formationSeq = txCount - idx;
        const txDay =
          typeof tx.day === 'number' && Number.isFinite(tx.day) && tx.day >= 1
            ? Math.floor(tx.day)
            : 1;
        return {
          ...tx,
          id: `TX-D${txDay}-S${String(formationSeq).padStart(8, '0')}`,
        };
      });
      nextTransactionSequence = Math.max(
        existingTxSeq,
        maxExtractedTxSeq,
        txCount
      );
    } else {
      migratedTransactions = rawTransactions.map((tx) => ({ ...tx }));
      nextTransactionSequence = Math.max(
        existingTxSeq,
        maxExtractedTxSeq,
        txCount
      );
    }

    // PendingOrders için aynı deterministik ve idempotent benzersizlik denetimi
    const rawOrders: PendingOrder[] = Array.isArray(state.pendingOrders)
      ? state.pendingOrders
      : [];
    const seenOrderIds = new Set<string>();
    let duplicateOrdersFixedCount = 0;
    let maxExtractedOrderSeq = 0;
    let allOrdersCanonical = true;

    for (const ord of rawOrders) {
      const idStr = typeof ord?.id === 'string' ? ord.id : '';
      if (!idStr || seenOrderIds.has(idStr)) {
        duplicateOrdersFixedCount += 1;
      } else {
        seenOrderIds.add(idStr);
      }

      const canonicalOrdMatch = /^ORD-D\d+-S(\d+)$/.exec(idStr);
      if (canonicalOrdMatch) {
        const seqVal = Number(canonicalOrdMatch[1]);
        if (Number.isFinite(seqVal) && seqVal > maxExtractedOrderSeq) {
          maxExtractedOrderSeq = seqVal;
        }
      } else {
        allOrdersCanonical = false;
        const legacyOrdMatch =
          /^ORD-D\d+-(\d+)$/.exec(idStr) || /^ORD-(\d+)$/.exec(idStr);
        if (legacyOrdMatch) {
          const legVal = Number(legacyOrdMatch[1]);
          if (Number.isFinite(legVal) && legVal > maxExtractedOrderSeq) {
            maxExtractedOrderSeq = legVal;
          }
        }
      }
    }

    const hasValidOrderSeq =
      typeof state.orderSequence === 'number' &&
      Number.isFinite(state.orderSequence) &&
      state.orderSequence >= 0;
    const existingOrderSeq = hasValidOrderSeq
      ? Math.floor(state.orderSequence!)
      : 0;
    const orderCount = rawOrders.length;
    const needsOrderMigration =
      !hasValidOrderSeq ||
      duplicateOrdersFixedCount > 0 ||
      !allOrdersCanonical;

    let migratedOrders: PendingOrder[];
    let nextOrderSequence: number;

    if (needsOrderMigration) {
      migratedOrders = rawOrders.map((ord, idx) => {
        const formationSeq = orderCount - idx;
        const ordDay =
          typeof ord.createdDay === 'number' &&
          Number.isFinite(ord.createdDay) &&
          ord.createdDay >= 1
            ? Math.floor(ord.createdDay)
            : 1;
        return {
          ...ord,
          id: `ORD-D${ordDay}-S${String(formationSeq).padStart(8, '0')}`,
        };
      });
      nextOrderSequence = Math.max(
        existingOrderSeq,
        maxExtractedOrderSeq,
        orderCount
      );
    } else {
      migratedOrders = rawOrders.map((ord) => ({ ...ord }));
      nextOrderSequence = Math.max(
        existingOrderSeq,
        maxExtractedOrderSeq,
        orderCount
      );
    }

    // NewsFeed içinde olası çakışmaları da idempotent biçimde denetle
    const rawNews: NewsEvent[] = Array.isArray(state.newsFeed)
      ? state.newsFeed
      : [];
    const seenNewsIds = new Set<string>();
    const migratedNews: NewsEvent[] = rawNews.map((n, idx) => {
      const baseId =
        typeof n?.id === 'string' && n.id
          ? n.id
          : `NEWS-D${n?.day ?? 1}-S${String(rawNews.length - idx).padStart(4, '0')}`;
      if (!seenNewsIds.has(baseId)) {
        seenNewsIds.add(baseId);
        return { ...n, id: baseId };
      }
      const dedupId = `${baseId}-S${String(rawNews.length - idx).padStart(4, '0')}`;
      seenNewsIds.add(dedupId);
      return { ...n, id: dedupId };
    });

    return {
      transactions: migratedTransactions,
      transactionSequence: nextTransactionSequence,
      pendingOrders: migratedOrders,
      orderSequence: nextOrderSequence,
      newsFeed: migratedNews,
      duplicateTransactionsFixedCount,
      duplicateOrdersFixedCount,
    };
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
    if (
      typeof expectedDayToClose === 'number' &&
      this.state.day !== expectedDayToClose
    ) {
      return this.state.dailyLogs[this.state.dailyLogs.length - 1];
    }

    const hadIntradaySteps =
      this.state.intradayStepsProcessedToday > 0 ||
      this.state.intradayMarketStepsCompletedToday > 0;

    // Eğer gün içinde piyasa seansı henüz tamamlanmadıysa açık emirleri seans başlangıcında değerlendir
    if (
      this.state.intradayMarketStepsCompletedToday <
        GameClockEngine.MARKET_OPEN_SUBSTEPS_PER_DAY &&
      this.state.pendingOrders.length > 0
    ) {
      const prevSession = this.state.marketSession;
      this.state.marketSession = 'MARKET_OPEN';
      this.processPendingOrders();
      this.state.marketSession = prevSession;
    }

    // 1. Yeni Gün Başlangıcı ve Saat Sıfırlaması (00:00)
    this.state.day += 1;
    const currentDay = this.state.day;
    this.state.dateISO = this.computeDateISO(currentDay);
    this.state.minutesIntoCurrentDay = 0;
    this.state.currentGameHour = 0;
    this.state.currentGameMinute = 0;
    this.state.marketSession = GameClockEngine.getMarketSession(0);

    let dividendsReceivedToday = 0;
    let holdingSynergyReceivedToday = 0;

    // Önceki günden tahakkuk etmiş temettü alacağı varsa nakde tahsil et
    if (this.state.accruedDividendsReceivable > 0) {
      const collected = this.state.accruedDividendsReceivable;
      this.state.cash = Number((this.state.cash + collected).toFixed(2));
      this.state.accruedDividendsReceivable = 0;
      dividendsReceivedToday = Number(
        (dividendsReceivedToday + collected).toFixed(2)
      );
    }

    // 2. Makroekonomik Göstergeleri Güncelle
    this.state.macro = EconomyEngine.updateMacroIndicators(
      this.state.macro,
      currentDay,
      this.rng
    );

    // 3. Yeni Haberleri Üret ve 4. Mevcut Haberlerin Etkisini Azalt
    const decayedFeed = NewsEngine.decayExistingNews(
      this.state.newsFeed,
      currentDay
    );
    const newNewsEvent = NewsEngine.generateDailyNews(
      currentDay,
      this.state.stocks,
      this.rng
    );
    this.state.newsFeed = [newNewsEvent, ...decayedFeed.slice(0, 39)];
    this.intradayTracking.newsGenerated += 1;
    NewsEngine.updateStockSentimentsFromNews(
      this.state.stocks,
      this.state.newsFeed,
      currentDay
    );

    // 5. Oyuncu Şirketi Operasyonlarını Tamamla (Çift sayımı önleyerek!)
    if (this.state.playerCompany) {
      const pc = this.state.playerCompany;
      const sectorStocks = this.state.stocks.filter(
        (s) => s.sector === pc.sector
      );
      const avgSectorSentiment =
        sectorStocks.reduce((acc, s) => acc + s.sentimentScore, 0) /
        Math.max(1, sectorStocks.length);

      if (!hadIntradaySteps) {
        CompanyEngine.stepPlayerCompanyOneDay(
          pc,
          this.state.macro,
          avgSectorSentiment,
          currentDay,
          this.state.totalElapsedGameMinutes
        );
        this.intradayTracking.productionCompleted += pc.dailyUnitsProduced;
        this.intradayTracking.revenueGenerated += pc.dailyRevenue;
        this.intradayTracking.expensesPaid += pc.dailyOpex;
      } else {
        const remainingSubsteps = Math.max(
          0,
          GameClockEngine.SUBSTEPS_PER_DAY -
            this.state.intradayStepsProcessedToday
        );
        if (remainingSubsteps > 0) {
          const remFraction =
            remainingSubsteps / GameClockEngine.SUBSTEPS_PER_DAY;
          const stepDelta = CompanyEngine.stepPlayerCompanyIntraday(
            pc,
            this.state.macro,
            avgSectorSentiment,
            remFraction,
            this.state.totalElapsedGameMinutes
          );
          this.intradayTracking.productionCompleted +=
            stepDelta.unitsProducedDelta;
          this.intradayTracking.revenueGenerated += stepDelta.revenueDelta;
          this.intradayTracking.expensesPaid += stepDelta.expensesDelta;
          this.intradayTracking.researchProgress += stepDelta.rdIncrement;
        }
        pc.operatingDays += 1;
        if (pc.financials.EBITDA > 0) {
          pc.corporateGovernanceScore = Number(
            Math.min(98, pc.corporateGovernanceScore + 0.6).toFixed(1)
          );
        }
        pc.revenueHistory.push(pc.annualizedRevenue);
        pc.ebitdaHistory.push(pc.annualizedEbitda);
        pc.valuationHistory.push(pc.equityValue);
        if (pc.revenueHistory.length > 90) {
          pc.revenueHistory.shift();
          pc.ebitdaHistory.shift();
          pc.valuationHistory.shift();
        }
        if (currentDay % 30 === 0) {
          pc.quarterlyReports.push(
            AccountingEngine.createQuarterlyReport(
              pc.financials,
              currentDay,
              this.state.macro.corporateTaxRate
            )
          );
        }
      }

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

      // Günlük şirket faaliyet gelir ve giderlerini Merkezi Muhasebe Defterine (idempotent olarak) işle
      const compBankId = ACCOUNT_IDS.companyBank(pc.ticker);
      if (pc.dailyRevenue > 0) {
        CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
          idempotencyKey: `COMP-REV-${pc.ticker}-D${currentDay}`,
          sourceAccountId: ACCOUNT_IDS.OPERATING_REVENUE,
          destinationAccountId: compBankId,
          amount: pc.dailyRevenue,
          category: 'OPERATING_REVENUE_RECEIPT',
          description: `${pc.ticker} Gün ${currentDay} ürün satış cirosu tahsilatı`,
          relatedCompanyId: pc.ticker,
          reservedOrderCash: this.getReservedCash(),
        });
      }
      const inc = pc.incomeBreakdown;
      const dailyPayroll = inc
        ? Number(((inc.salariesExpense + inc.socialBenefitsExpense) / 252).toFixed(2))
        : Number((pc.dailyOpex * 0.35).toFixed(2));
      if (dailyPayroll > 0) {
        CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
          idempotencyKey: `COMP-PAYROLL-${pc.ticker}-D${currentDay}`,
          sourceAccountId: compBankId,
          destinationAccountId: ACCOUNT_IDS.PAYROLL_EXPENSE,
          amount: dailyPayroll,
          category: 'PAYROLL_PAYMENT',
          description: `${pc.ticker} Gün ${currentDay} personel ve maaş bordro ödemesi`,
          relatedCompanyId: pc.ticker,
          reservedOrderCash: this.getReservedCash(),
        });
      }
      const dailyOpsAndRd = Math.max(0, Number((pc.dailyOpex - dailyPayroll).toFixed(2)));
      if (dailyOpsAndRd > 0) {
        CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
          idempotencyKey: `COMP-OPEX-${pc.ticker}-D${currentDay}`,
          sourceAccountId: compBankId,
          destinationAccountId: ACCOUNT_IDS.OPERATING_EXPENSE,
          amount: dailyOpsAndRd,
          category: 'OPERATING_EXPENSE_PAYMENT',
          description: `${pc.ticker} Gün ${currentDay} üretim, stok depolama ve Ar-Ge gideri`,
          relatedCompanyId: pc.ticker,
          reservedOrderCash: this.getReservedCash(),
        });
      }
      const dailyTax = inc ? Number((inc.taxExpense / 252).toFixed(2)) : 0;
      if (dailyTax > 0) {
        CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
          idempotencyKey: `COMP-TAX-${pc.ticker}-D${currentDay}`,
          sourceAccountId: compBankId,
          destinationAccountId: ACCOUNT_IDS.TAX_LIABILITY,
          amount: dailyTax,
          category: 'TAX_PAYMENT',
          description: `${pc.ticker} Gün ${currentDay} kurumlar vergisi karşılığı`,
          relatedCompanyId: pc.ticker,
          reservedOrderCash: this.getReservedCash(),
        });
      }
    }

    // 5B. Esnaf Dükkânları, Ticaret Evreni, Sevkiyatlar, Mağaza Satışları ve Sözleşmeleri İşle
    TradeAndShopEngine.stepDailyTradeAndShops(
      this.state,
      this.rng,
      this.getReservedCash()
    );
    const todayTradeSummary = this.state.tradeState?.todaySummary;
    if (todayTradeSummary) {
      this.intradayTracking.revenueGenerated +=
        todayTradeSummary.shopSalesRevenue +
        todayTradeSummary.wholesaleAndContractRevenue;
      this.intradayTracking.expensesPaid +=
        todayTradeSummary.shopOpex + todayTradeSummary.logisticsCost;
    }

    // 6. NPC Şirket Kararlarını ve Günlük Bilanço/Değerlemelerini İşle
    for (const stock of this.state.stocks) {
      if (stock.isPlayerCompany) continue;

      stock.financials = AccountingEngine.stepCompanyFinancialsOneDay(
        stock.financials,
        stock.sector,
        this.state.macro,
        stock.sentimentScore,
        1.0
      );
      stock.ebitdaAnnual = stock.financials.EBITDA;
      stock.valuation = ValuationEngine.computeCompanyValuation(
        stock.financials,
        stock.sector,
        this.state.macro,
        1.0
      );
      stock.fundamentalPrice = stock.valuation.fairValuePerShare;

      if (stock.integrationDaysRemaining > 0) {
        stock.integrationDaysRemaining -= 1;
      }
    }

    // 7. NPC Fon Emirlerini Üret (İkincil Piyasa İşlemleri)
    NPCFundEngine.stepSecondaryMarketFundTrading(
      this.state.institutionalFunds,
      this.state.stocks,
      this.state.macro,
      currentDay,
      this.rng
    );

    // 8. Banka Kredileri (Günlük Tekil Faiz Tahakkuku ve Taksit Tahsilatı) + Kalan Oyuncu Borçları
    const loanDaySummary = BankLoanEngine.stepDailyLoansAndInterest(
      this.state,
      this.getReservedCash()
    );
    if (
      loanDaySummary.installmentsPaidCount > 0 ||
      loanDaySummary.delinquentLoansCount > 0
    ) {
      this.pendingDailyActions.push(
        `Banka Kredi Özeti: ${loanDaySummary.installmentsPaidCount} taksit ödendi, ${loanDaySummary.delinquentLoansCount} gecikme, ${loanDaySummary.totalInterestAccruedToday.toLocaleString('tr-TR')} TL günlük faiz tahakkuk etti.`
      );
    }

    const activePlayerBankLoanDebt = (this.state.activeLoans || [])
      .filter(
        (l) =>
          (l.status === 'ACTIVE' || l.status === 'DELINQUENT') &&
          (l.borrowerType === 'PLAYER' || l.borrowerType === 'HOLDING')
      )
      .reduce(
        (sum, l) => sum + l.remainingPrincipal + l.accruedInterestUnpaid,
        0
      );
    const nonBankPlayerDebt = Math.max(
      0,
      this.state.totalDebt - activePlayerBankLoanDebt
    );

    if (nonBankPlayerDebt > 0) {
      const dailyDebtInterest = Number(
        (
          (nonBankPlayerDebt *
            Math.max(0.1, this.state.macro.policyInterestRate * 0.65)) /
          252
        ).toFixed(2)
      );
      if (this.state.cash >= dailyDebtInterest) {
        this.state.cash = Number(
          (this.state.cash - dailyDebtInterest).toFixed(2)
        );
      } else {
        this.state.shortTermDebt = Number(
          (this.state.shortTermDebt + dailyDebtInterest).toFixed(2)
        );
      }
    }

    // 9. Piyasa Fiyatlarını Güncelle (Gün içinde 96 adım tamamlandıysa iki kez çalıştırma!)
    if (!hadIntradaySteps) {
      MarketEngine.stepMarketPricesOneDay(
        this.state.stocks,
        this.state.macro,
        this.rng
      );
      if (this.state.pendingOrders.length > 0) {
        const prevSession = this.state.marketSession;
        this.state.marketSession = 'MARKET_OPEN';
        this.processPendingOrders();
        this.state.marketSession = prevSession;
      }
    } else {
      const remainingMarketSubsteps = Math.max(
        0,
        GameClockEngine.MARKET_OPEN_SUBSTEPS_PER_DAY -
          this.state.intradayMarketStepsCompletedToday
      );
      if (remainingMarketSubsteps > 0) {
        MarketEngine.stepMarketPricesIntraday(
          this.state.stocks,
          this.state.macro,
          this.rng,
          remainingMarketSubsteps /
            GameClockEngine.MARKET_OPEN_SUBSTEPS_PER_DAY
        );
        if (this.state.pendingOrders.length > 0) {
          const prevSession = this.state.marketSession;
          this.state.marketSession = 'MARKET_OPEN';
          this.processPendingOrders();
          this.state.marketSession = prevSession;
        }
      }
      // Gün sonu kapanış fiyatını priceHistory'e kaydet ve yeni gün için previousPrice güncelle
      for (const stock of this.state.stocks) {
        stock.priceHistory.push(stock.price);
        if (stock.priceHistory.length > 120) {
          stock.priceHistory.shift();
        }
        stock.previousPrice = stock.price;
        stock.netOrderFlowLots = 0;
      }
    }

    // Gün içi sayaçları sıfırla
    this.state.intradayStepsProcessedToday = 0;
    this.state.intradayMarketStepsCompletedToday = 0;

    // Süresi dolan (expired) bekleyen emirlerin rezervlerini serbest bırak
    this.expireOutdatedOrders(currentDay);

    // 10. Temettü ve Holding Sinerjilerini Dağıt
    for (const stock of this.state.stocks) {
      if (currentDay % stock.dividendPeriodDays === 0) {
        stock.lastExDividendDay = currentDay;
        const pos = this.state.portfolio[stock.ticker];
        if (pos && pos.shares > 0 && pos.lastPurchaseDay < currentDay) {
          const periodYield =
            stock.dividendYieldAnnual / (252 / stock.dividendPeriodDays);
          const dividendPerShare = Math.min(
            stock.price * periodYield,
            Math.max(0, stock.financials.cash * 0.25) / stock.totalShares
          );
          const totalCompanyDividend = Number(
            (dividendPerShare * stock.totalShares).toFixed(2)
          );
          const playerPayout = Number(
            (pos.shares * dividendPerShare).toFixed(2)
          );

          if (
            playerPayout > 0 &&
            stock.financials.cash >= totalCompanyDividend
          ) {
            stock.financials.cash = Number(
              (stock.financials.cash - totalCompanyDividend).toFixed(2)
            );
            stock.financials.totalAssets = Number(
              (stock.financials.totalAssets - totalCompanyDividend).toFixed(2)
            );
            stock.financials.retainedEarnings = Number(
              (
                stock.financials.retainedEarnings - totalCompanyDividend
              ).toFixed(2)
            );
            stock.financials.shareholdersEquity = Number(
              (
                stock.financials.totalAssets - stock.financials.totalLiabilities
              ).toFixed(2)
            );

            this.state.cash = Number(
              (this.state.cash + playerPayout).toFixed(2)
            );
            pos.totalDividendCollected = Number(
              (pos.totalDividendCollected + playerPayout).toFixed(2)
            );
            dividendsReceivedToday = Number(
              (dividendsReceivedToday + playerPayout).toFixed(2)
            );
            this.state.totalDividendsEarned = Number(
              (this.state.totalDividendsEarned + playerPayout).toFixed(2)
            );
            this.intradayTracking.dividendsCollected = Number(
              (
                this.intradayTracking.dividendsCollected + playerPayout
              ).toFixed(2)
            );

            this.recordTransaction({
              type: 'DIVIDEND',
              ticker: stock.ticker,
              shares: pos.shares,
              executionPrice: Number(dividendPerShare.toFixed(4)),
              grossAmount: playerPayout,
              commission: 0,
              slippageBps: 0,
              cashDelta: playerPayout,
              description: `${stock.ticker} dönemsel temettü ödemesi (+${this.formatCurrency(playerPayout)})`,
            });

            CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
              idempotencyKey: `MKT-DIV-${stock.ticker}-D${currentDay}`,
              sourceAccountId: ACCOUNT_IDS.DIVIDEND_PAYABLE,
              destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
              amount: playerPayout,
              category: 'LEGAL_DIVIDEND',
              description: `${stock.ticker} dönemsel temettü tahsilatı`,
              relatedCompanyId: stock.ticker,
              reservedOrderCash: this.getReservedCash(),
            });
          }
        }
      }

      if (
        stock.isControlledByPlayer &&
        !stock.isPlayerCompany &&
        stock.integrationDaysRemaining === 0
      ) {
        const dailyPositiveEbitda = Math.max(0, stock.financials.EBITDA / 252);
        const synergyPayout = Number(
          (
            dailyPositiveEbitda *
            0.12 *
            (stock.playerOwnershipPct / 100)
          ).toFixed(2)
        );
        if (synergyPayout > 0 && stock.financials.cash > synergyPayout * 3) {
          stock.financials.cash = Number(
            (stock.financials.cash - synergyPayout).toFixed(2)
          );
          stock.financials.totalAssets = Number(
            (stock.financials.totalAssets - synergyPayout).toFixed(2)
          );
          stock.financials.retainedEarnings = Number(
            (stock.financials.retainedEarnings - synergyPayout).toFixed(2)
          );
          stock.financials.shareholdersEquity = Number(
            (
              stock.financials.totalAssets - stock.financials.totalLiabilities
            ).toFixed(2)
          );

          this.state.cash = Number(
            (this.state.cash + synergyPayout).toFixed(2)
          );
          holdingSynergyReceivedToday = Number(
            (holdingSynergyReceivedToday + synergyPayout).toFixed(2)
          );
          this.state.totalSynergyEarned = Number(
            (this.state.totalSynergyEarned + synergyPayout).toFixed(2)
          );

          CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
            idempotencyKey: `HOLD-SYNERGY-${stock.ticker}-D${currentDay}`,
            sourceAccountId: ACCOUNT_IDS.HOLDING_MAIN,
            destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
            amount: synergyPayout,
            category: 'HOLDING_CAPITAL_TRANSFER',
            description: `${stock.ticker} bağlı ortaklık sinerji nakit akışı`,
            relatedCompanyId: stock.ticker,
            reservedOrderCash: this.getReservedCash(),
          });
        }
      }
    }

    // 11. Ay / Çeyrek Kapanışlarını Yap
    if (currentDay % 30 === 0) {
      for (const stock of this.state.stocks) {
        if (!stock.isPlayerCompany) {
          stock.quarterlyReports.push(
            AccountingEngine.createQuarterlyReport(
              stock.financials,
              currentDay,
              this.state.macro.corporateTaxRate
            )
          );
          if (stock.quarterlyReports.length > 16) {
            stock.quarterlyReports.shift();
          }
        }
      }
    }

    this.state.lastProcessedDayClose = currentDay;
    this.state.lastProcessedGameMinuteTotal = this.state.totalElapsedGameMinutes;
    this.state.lastSimulationTickId = `TICK-D${currentDay}-M${this.state.totalElapsedGameMinutes}`;

    // 12. Oyuncu Net Varlığını Hesapla ve 13. Aşama Kilitlerini Kontrol Et
    this.recalculateFinancialsAndStages();
    CentralLedgerEngine.recordBalanceSnapshot(this.state);

    // 14. Muhasebe Bütünlüğünü Doğrula
    const audit = AccountingEngine.auditSimulationIntegrity(this.state);
    this.state.lastIntegrityAudit = audit;
    this.state.randomState = this.rng.getState();

    // 15. Gün Sonu Snapshot Oluştur
    const logActions = [...this.pendingDailyActions];
    if (dividendsReceivedToday > 0) {
      logActions.push(
        `Temettü tahsilatı: +${this.formatCurrency(dividendsReceivedToday)}`
      );
    }
    if (holdingSynergyReceivedToday > 0) {
      logActions.push(
        `Holding bağlı ortaklık sinerji nakit akışı: +${this.formatCurrency(holdingSynergyReceivedToday)}`
      );
    }
    if (logActions.length === 0) {
      logActions.push(
        'Piyasa fiyatlaması, bilançolar ve portföy değerlemesi güncellendi.'
      );
    }
    this.pendingDailyActions = [];

    const privateEquityVal = Number(
      (
        (this.state.playerCompany && !this.state.playerCompany.isPubliclyListed
          ? this.state.playerCompany.equityValue
          : 0) + TradeAndShopEngine.computeNonIncorporatedShopsEquity(this.state)
      ).toFixed(2)
    );

    const entry: DailyLogEntry = {
      day: currentDay,
      dateISO: this.state.dateISO,
      stage: this.state.stage,
      cash: this.state.cash,
      portfolioMarketValue: this.state.portfolioValue,
      privateCompanyEquityValue: privateEquityVal,
      accruedDividends: this.state.accruedDividendsReceivable,
      totalDebt: this.state.totalDebt,
      netWorth: this.state.netWorth,
      marketIndexValue: this.state.marketIndex,
      dividendsReceivedToday,
      holdingSynergyReceivedToday,
      headlineNews: newNewsEvent.headline,
      actionsTaken: logActions,
      integrityValid: audit.valid,
    };

    this.state.dailyLogs.push(entry);
    if (this.state.dailyLogs.length > 400) {
      this.state.dailyLogs.shift();
    }

    return entry;
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
    const { ticker, orderType, requestedShares, limitPrice, expiresInDays } =
      params;

    const stock = this.state.stocks.find((s) => s.ticker === ticker);
    if (!stock) {
      return {
        success: false,
        message: `${ticker} kodlu hisse bulunamadı.`,
        order: null,
      };
    }

    if (
      !Number.isFinite(requestedShares) ||
      Math.floor(requestedShares) !== requestedShares ||
      requestedShares <= 0
    ) {
      return {
        success: false,
        message: 'Emir lot miktarı pozitif bir tam sayı olmalıdır.',
        order: null,
      };
    }

    const isLimit = orderType === 'LIMIT_BUY' || orderType === 'LIMIT_SELL';
    if (
      isLimit &&
      (typeof limitPrice !== 'number' ||
        !Number.isFinite(limitPrice) ||
        limitPrice <= 0)
    ) {
      return {
        success: false,
        message: 'Limit emirler için geçerli ve pozitif bir limit fiyat girilmelidir.',
        order: null,
      };
    }

    const side: PendingOrderSide =
      orderType === 'MARKET_BUY' || orderType === 'LIMIT_BUY' ? 'BUY' : 'SELL';

    let reservedCash = 0;
    let reservedShares = 0;

    if (side === 'BUY') {
      const currentOwned = this.state.portfolio[ticker]?.shares || 0;
      const maxBuyable = Math.max(0, stock.totalShares - currentOwned);
      if (requestedShares > maxBuyable) {
        return {
          success: false,
          message: `Piyasada alınabilir maksimum ${maxBuyable.toLocaleString('tr-TR')} lot bulunmaktadır.`,
          order: null,
        };
      }

      reservedCash = MarketEngine.estimateBuyOrderReservation(
        stock,
        requestedShares,
        isLimit ? limitPrice : undefined
      );
      const spendableCash = this.getSpendableCash();
      if (reservedCash > spendableCash) {
        return {
          success: false,
          message: `Yetersiz kullanılabilir nakit. Gereken Rezerv: ${this.formatCurrency(reservedCash)}, Kullanılabilir (Rezerv Dışı) Nakit: ${this.formatCurrency(spendableCash)}`,
          order: null,
        };
      }
    } else {
      if (BankLoanEngine.isStockPledgedAsCollateral(this.state, ticker)) {
        return {
          success: false,
          message: `${ticker} hissesi aktif bir banka kredisinde teminat olarak kilitlidir; satabilmek için önce ilgili krediyi kapatmalısınız.`,
          order: null,
        };
      }
      const availableShares = this.getAvailableShares(ticker);
      if (requestedShares > availableShares) {
        return {
          success: false,
          message: `Yetersiz kullanılabilir hisse. İstenen: ${requestedShares} lot, Kullanılabilir (Rezerv Dışı): ${availableShares} lot.`,
          order: null,
        };
      }
      reservedShares = requestedShares;
    }

    const ttlDays =
      typeof expiresInDays === 'number' && Number.isFinite(expiresInDays)
        ? Math.max(1, Math.floor(expiresInDays))
        : 5;

    const nextOrderSeq =
      (typeof this.state.orderSequence === 'number' &&
      Number.isFinite(this.state.orderSequence) &&
      this.state.orderSequence >= 0
        ? Math.floor(this.state.orderSequence)
        : this.state.pendingOrders.length) + 1;
    this.state.orderSequence = nextOrderSeq;

    const order: PendingOrder = {
      id: `ORD-D${this.state.day}-S${String(nextOrderSeq).padStart(8, '0')}`,
      createdDay: this.state.day,
      createdGameMinute: this.state.minutesIntoCurrentDay,
      ticker,
      orderType,
      side,
      requestedShares,
      remainingShares: requestedShares,
      limitPrice: isLimit ? Number(limitPrice!.toFixed(2)) : undefined,
      status: 'PENDING',
      executedShares: 0,
      averageExecutionPrice: 0,
      reservedCash,
      reservedShares,
      expiresAtDay: this.state.day + ttlDays,
      transactionIds: [],
    };

    this.state.pendingOrders.unshift(order);
    CentralLedgerEngine.syncLedgerWithState(this.state, this.getReservedCash());

    // Eğer piyasa şu anda açıksa uygun emirleri hemen çalıştır
    if (this.state.marketSession === 'MARKET_OPEN') {
      this.processPendingOrders();
    }

    const statusText =
      order.status === 'FILLED'
        ? `hemen gerçekleşti (@ ${order.averageExecutionPrice.toFixed(2)} TL)`
        : `kuyruğa alındı (${GameClockEngine.getMarketSessionLabelTR(this.state.marketSession)})`;

    return {
      success: true,
      message: `${ticker} için ${requestedShares.toLocaleString('tr-TR')} lot ${orderType} emri ${statusText}.`,
      order,
    };
  }

  /**
   * Bekleyen bir emri iptal eder ve bloke edilen nakit veya hisse rezervini serbest bırakır.
   */
  public cancelOrder(orderId: string): {
    success: boolean;
    message: string;
    order: PendingOrder | null;
  } {
    const order = this.state.pendingOrders.find((o) => o.id === orderId);
    if (!order) {
      return {
        success: false,
        message: `${orderId} numaralı emir bulunamadı.`,
        order: null,
      };
    }

    if (order.status !== 'PENDING' && order.status !== 'PARTIALLY_FILLED') {
      return {
        success: false,
        message: `${orderId} emri zaten ${order.status} durumunda olduğu için iptal edilemez.`,
        order,
      };
    }

    order.status = 'CANCELLED';
    order.reservedCash = 0;
    order.reservedShares = 0;
    CentralLedgerEngine.syncLedgerWithState(this.state, this.getReservedCash());

    return {
      success: true,
      message: `${order.ticker} (${order.orderType}) emri iptal edildi ve rezervler serbest bırakıldı.`,
      order,
    };
  }

  /**
   * Piyasa açıkken (MARKET_OPEN) bekleyen emirleri fiyat koşullarına göre çalıştırır.
   */
  public processPendingOrders(): {
    executedOrdersCount: number;
    executedOrderIds: string[];
  } {
    if (this.state.marketSession !== 'MARKET_OPEN') {
      return { executedOrdersCount: 0, executedOrderIds: [] };
    }

    let executedOrdersCount = 0;
    const executedOrderIds: string[] = [];

    // Emirleri oluşturulma sırasına göre (eskiden yeniye) işle
    const activeOrders = [...this.state.pendingOrders]
      .filter((o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED')
      .reverse();

    for (const order of activeOrders) {
      const stock = this.state.stocks.find((s) => s.ticker === order.ticker);
      if (!stock || order.remainingShares <= 0) continue;

      let canExecute = false;
      if (order.orderType === 'MARKET_BUY' || order.orderType === 'MARKET_SELL') {
        canExecute = true;
      } else if (
        order.orderType === 'LIMIT_BUY' &&
        typeof order.limitPrice === 'number'
      ) {
        canExecute =
          stock.price <= order.limitPrice || stock.askPrice <= order.limitPrice;
      } else if (
        order.orderType === 'LIMIT_SELL' &&
        typeof order.limitPrice === 'number'
      ) {
        canExecute =
          stock.price >= order.limitPrice || stock.bidPrice >= order.limitPrice;
      }

      if (!canExecute) continue;

      const netWorthBefore = this.state.netWorth;

      if (order.side === 'BUY') {
        const otherReservedCash = Math.max(
          0,
          this.getReservedCash() - order.reservedCash
        );
        const availableForThisOrder = Number(
          Math.max(0, this.state.cash - otherReservedCash).toFixed(2)
        );

        const { result, newCash } = MarketEngine.executeBuyOrder({
          stock,
          sharesToBuy: order.remainingShares,
          availableCash: availableForThisOrder,
          portfolio: this.state.portfolio,
          currentDay: this.state.day,
          maxLimitPrice:
            order.orderType === 'LIMIT_BUY' ? order.limitPrice : undefined,
        });

        if (result.success) {
          this.state.cash = Number(
            (newCash + otherReservedCash).toFixed(2)
          );
          order.executedShares += result.sharesExecuted;
          order.remainingShares = 0;
          order.averageExecutionPrice = result.executionPrice;
          order.status = 'FILLED';
          order.reservedCash = 0;

          if (
            this.state.playerCompany &&
            this.state.playerCompany.ticker === stock.ticker
          ) {
            this.state.playerCompany.playerOwnedShares =
              this.state.portfolio[stock.ticker]?.shares || 0;
            this.state.playerCompany.playerOwnershipPct =
              stock.playerOwnershipPct;
          }

          this.recalculateFinancialsAndStages();
          const txId = this.recordTransaction({
            type: 'BUY',
            ticker: stock.ticker,
            shares: result.sharesExecuted,
            executionPrice: result.executionPrice,
            grossAmount: result.grossAmount,
            commission: result.commission,
            slippageBps: result.slippageBps,
            cashDelta: -result.totalCost,
            netWorthBefore,
            netWorthAfter: this.state.netWorth,
            description: `[${order.orderType}] ${result.message}`,
          });
          order.transactionIds.push(txId);
          CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
            idempotencyKey: `ORD-BUY-${order.id}-${txId}`,
            sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
            destinationAccountId: ACCOUNT_IDS.EQUITY_CAPITAL,
            amount: result.totalCost,
            category: 'STOCK_PURCHASE_COST',
            description: `[${order.orderType}] ${result.message}`,
            relatedCompanyId: stock.ticker,
            reservedOrderCash: this.getReservedCash(),
          });
          this.pendingDailyActions.push(`[${order.orderType}] ${result.message}`);
          executedOrdersCount += 1;
          executedOrderIds.push(order.id);
          this.intradayTracking.ordersExecuted += 1;
        }
      } else {
        const { result, newCash } = MarketEngine.executeSellOrder({
          stock,
          sharesToSell: order.remainingShares,
          availableCash: this.state.cash,
          portfolio: this.state.portfolio,
          minLimitPrice:
            order.orderType === 'LIMIT_SELL' ? order.limitPrice : undefined,
        });

        if (result.success) {
          this.state.cash = newCash;
          order.executedShares += result.sharesExecuted;
          order.remainingShares = 0;
          order.averageExecutionPrice = result.executionPrice;
          order.status = 'FILLED';
          order.reservedShares = 0;

          if (
            this.state.playerCompany &&
            this.state.playerCompany.ticker === stock.ticker
          ) {
            this.state.playerCompany.playerOwnedShares =
              this.state.portfolio[stock.ticker]?.shares || 0;
            this.state.playerCompany.playerOwnershipPct =
              stock.playerOwnershipPct;
          }

          this.recalculateFinancialsAndStages();
          const txId = this.recordTransaction({
            type: 'SELL',
            ticker: stock.ticker,
            shares: result.sharesExecuted,
            executionPrice: result.executionPrice,
            grossAmount: result.grossAmount,
            commission: result.commission,
            slippageBps: result.slippageBps,
            cashDelta: result.netProceeds,
            netWorthBefore,
            netWorthAfter: this.state.netWorth,
            description: `[${order.orderType}] ${result.message}`,
          });
          order.transactionIds.push(txId);
          CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
            idempotencyKey: `ORD-SELL-${order.id}-${txId}`,
            sourceAccountId: ACCOUNT_IDS.EQUITY_CAPITAL,
            destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
            amount: result.netProceeds,
            category: 'STOCK_SALE_PROCEEDS',
            description: `[${order.orderType}] ${result.message}`,
            relatedCompanyId: stock.ticker,
            reservedOrderCash: this.getReservedCash(),
          });
          this.pendingDailyActions.push(`[${order.orderType}] ${result.message}`);
          executedOrdersCount += 1;
          executedOrderIds.push(order.id);
          this.intradayTracking.ordersExecuted += 1;
        }
      }
    }

    return { executedOrdersCount, executedOrderIds };
  }

  private expireOutdatedOrders(currentDay: number): void {
    for (const order of this.state.pendingOrders) {
      if (
        (order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED') &&
        currentDay >= order.expiresAtDay
      ) {
        order.status = 'EXPIRED';
        order.reservedCash = 0;
        order.reservedShares = 0;
        this.intradayTracking.ordersExpired += 1;
      }
    }
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
    const startNetWorth = this.state.netWorth;
    const warnings: string[] = [];

    const effectiveLastISO =
      lastTimestampISO || this.state.lastRealTimestampISO;
    const effectiveCurrentISO =
      currentTimestampISO || new Date().toISOString();

    const parsedDiff = GameClockEngine.parseAndValidateTimestampDiff(
      effectiveLastISO,
      effectiveCurrentISO
    );

    if (!parsedDiff.valid) {
      if (parsedDiff.warning) warnings.push(parsedDiff.warning);
      const emptySummary: OfflineProgressSummary = {
        realSecondsElapsed: 0,
        gameMinutesAdvanced: 0,
        gameDaysAdvanced: 0,
        ordersExecuted: 0,
        ordersExpired: 0,
        productionCompleted: 0,
        revenueGenerated: 0,
        expensesPaid: 0,
        researchProgress: 0,
        dividendsCollected: 0,
        newsGenerated: 0,
        startNetWorth,
        endNetWorth: this.state.netWorth,
        warnings,
      };
      this.state.lastOfflineSummary = emptySummary;
      return emptySummary;
    }

    const currentMs = Date.parse(effectiveCurrentISO);
    const lastMs = Date.parse(effectiveLastISO);

    // Aynı zaman aralığının iki kez işlenmesini engelle
    if (
      this.maxProcessedOfflineTimestampMs > 0 &&
      currentMs <= this.maxProcessedOfflineTimestampMs
    ) {
      warnings.push(
        'Bu çevrimdışı zaman aralığı daha önce işlendi; mükerrer ilerleme engellendi.'
      );
      const duplicateSummary: OfflineProgressSummary = {
        realSecondsElapsed: 0,
        gameMinutesAdvanced: 0,
        gameDaysAdvanced: 0,
        ordersExecuted: 0,
        ordersExpired: 0,
        productionCompleted: 0,
        revenueGenerated: 0,
        expensesPaid: 0,
        researchProgress: 0,
        dividendsCollected: 0,
        newsGenerated: 0,
        startNetWorth,
        endNetWorth: this.state.netWorth,
        warnings,
      };
      this.state.lastOfflineSummary = duplicateSummary;
      return duplicateSummary;
    }

    const effectiveStartMs =
      this.maxProcessedOfflineTimestampMs > lastMs
        ? this.maxProcessedOfflineTimestampMs
        : lastMs;
    const effectiveRealSeconds = Math.max(
      0,
      (currentMs - effectiveStartMs) / 1000
    );

    const { cappedGameMinutes, wasCapped } =
      GameClockEngine.computeCappedOfflineGameMinutes(
        effectiveRealSeconds,
        this.state.realMinutesPerGameDay,
        GameClockEngine.MAX_OFFLINE_GAME_DAYS
      );

    if (wasCapped) {
      warnings.push(
        `Çevrimdışı ilerleme maksimum ${GameClockEngine.MAX_OFFLINE_GAME_DAYS} oyun günü (${GameClockEngine.MAX_OFFLINE_GAME_MINUTES} oyun dakikası) ile sınırlandırıldı.`
      );
    }

    // İzleme sayaçlarını sıfırla
    this.intradayTracking = {
      ordersExecuted: 0,
      ordersExpired: 0,
      productionCompleted: 0,
      revenueGenerated: 0,
      expensesPaid: 0,
      researchProgress: 0,
      dividendsCollected: 0,
      newsGenerated: 0,
    };

    const advanceRes =
      cappedGameMinutes > 0
        ? this.advanceGameMinutes(cappedGameMinutes)
        : { gameMinutesAdvanced: 0, daysClosed: 0 };

    this.maxProcessedOfflineTimestampMs = currentMs;
    this.state.lastRealTimestampISO = effectiveCurrentISO;
    this.state.lastOfflineProcessedTimestampISO = effectiveCurrentISO;

    const summary: OfflineProgressSummary = {
      realSecondsElapsed: Number(effectiveRealSeconds.toFixed(2)),
      gameMinutesAdvanced: advanceRes.gameMinutesAdvanced,
      gameDaysAdvanced: advanceRes.daysClosed,
      ordersExecuted: this.intradayTracking.ordersExecuted,
      ordersExpired: this.intradayTracking.ordersExpired,
      productionCompleted: Number(
        this.intradayTracking.productionCompleted.toFixed(2)
      ),
      revenueGenerated: Number(
        this.intradayTracking.revenueGenerated.toFixed(2)
      ),
      expensesPaid: Number(this.intradayTracking.expensesPaid.toFixed(2)),
      researchProgress: Number(
        this.intradayTracking.researchProgress.toFixed(4)
      ),
      dividendsCollected: Number(
        this.intradayTracking.dividendsCollected.toFixed(2)
      ),
      newsGenerated: this.intradayTracking.newsGenerated,
      startNetWorth,
      endNetWorth: this.state.netWorth,
      warnings,
    };

    this.state.lastOfflineSummary = summary;
    this.state.lastOfflineSummaryDismissed = advanceRes.gameMinutesAdvanced === 0;
    return summary;
  }

  private syncPlayerCashBuckets(): void {
    const cleanTotalCash = Number(Math.max(0, this.state.cash).toFixed(2));
    this.state.cash = cleanTotalCash;
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
    this.syncPlayerCashBuckets();

    let portfolioVal = 0;
    for (const stock of this.state.stocks) {
      const pos = this.state.portfolio[stock.ticker];
      const sharesOwned = pos ? pos.shares : 0;
      stock.playerOwnershipPct = Number(
        ((sharesOwned / stock.totalShares) * 100).toFixed(2)
      );
      stock.controlLevel = MarketEngine.computeControlLevel(
        stock.playerOwnershipPct
      );
      if (sharesOwned > 0) {
        portfolioVal += sharesOwned * stock.price;
      }
    }
    this.state.portfolioValue = Number(portfolioVal.toFixed(2));

    if (this.state.playerCompany) {
      CompanyEngine.ensureCompanyV5Fields(
        this.state.playerCompany,
        this.state.macro
      );
      this.state.playerCompany.creditScore = BankLoanEngine.computeCreditScore(
        this.state
      );
    }

    const nonIncorporatedShopEquity =
      TradeAndShopEngine.computeNonIncorporatedShopsEquity(this.state);
    const privateCompanyEquity = Number(
      (
        (this.state.playerCompany && !this.state.playerCompany.isPubliclyListed
          ? this.state.playerCompany.equityValue
          : 0) + nonIncorporatedShopEquity
      ).toFixed(2)
    );

    this.state.totalDebt = Number(
      (this.state.shortTermDebt + this.state.longTermDebt).toFixed(2)
    );

    const totalPlayerAndHoldingCash = Number(
      (this.state.cash + (this.state.holdingCash || 0)).toFixed(2)
    );

    this.state.netWorth = Number(
      (
        totalPlayerAndHoldingCash +
        this.state.portfolioValue +
        privateCompanyEquity +
        this.state.accruedDividendsReceivable -
        this.state.totalDebt
      ).toFixed(2)
    );

    this.state.playerFinancials = {
      cash: this.state.cash,
      portfolioMarketValue: this.state.portfolioValue,
      playerCompanyEquityValue: privateCompanyEquity,
      accruedDividendsReceivable: this.state.accruedDividendsReceivable,
      shortTermDebt: this.state.shortTermDebt,
      longTermDebt: this.state.longTermDebt,
      totalDebt: this.state.totalDebt,
      netWorth: this.state.netWorth,
    };

    const benchmarkStocks = this.state.stocks.filter((s) => !s.isPlayerCompany);
    const avgPrice =
      benchmarkStocks.reduce((sum, s) => sum + s.price, 0) /
      Math.max(1, benchmarkStocks.length);
    this.state.marketIndex = Number(((avgPrice / 92.6375) * 1000).toFixed(2));

    if (this.state.marketIndexHistory.length < this.state.day) {
      this.state.marketIndexHistory.push(this.state.marketIndex);
      this.state.netWorthHistory.push(this.state.netWorth);
    } else {
      this.state.marketIndexHistory[this.state.marketIndexHistory.length - 1] =
        this.state.marketIndex;
      this.state.netWorthHistory[this.state.netWorthHistory.length - 1] =
        this.state.netWorth;
    }

    const incorpCheck = TradeAndShopEngine.checkIncorporationEligibility(
      this.state
    );
    if (
      this.state.netWorth >= SimulationEngine.STAGE_2_NET_WORTH_THRESHOLD ||
      this.state.playerCompany !== null ||
      incorpCheck.eligible
    ) {
      this.state.stageUnlocks.stage2Entrepreneur = true;
    }

    TradeAndShopEngine.ensureTradeUniverseState(this.state);

    const ipoCheck = IPOEngine.checkEligibility(this.state.playerCompany);
    if (
      ipoCheck.eligible ||
      (this.state.playerCompany && this.state.playerCompany.isPubliclyListed)
    ) {
      this.state.stageUnlocks.stage3Ipo = true;
    }

    const hasSignificantStakeOrControl =
      this.state.controlledSubsidiaries.length > 0 ||
      this.state.stocks.some(
        (s) => !s.isPlayerCompany && s.playerOwnershipPct >= 5.0
      ) ||
      (this.state.playerCompany !== null &&
        this.state.playerCompany.isPubliclyListed);

    if (hasSignificantStakeOrControl) {
      this.state.stageUnlocks.stage4Holding = true;
    }

    if (this.state.controlledSubsidiaries.length > 0) {
      this.state.stage = SimulationStage.STAGE_4_HOLDING_MONOPOLY;
    } else if (
      this.state.playerCompany &&
      this.state.playerCompany.isPubliclyListed
    ) {
      this.state.stage = SimulationStage.STAGE_3_IPO_PUBLIC;
    } else if (
      this.state.stageUnlocks.stage2Entrepreneur ||
      this.state.playerCompany !== null
    ) {
      this.state.stage = SimulationStage.STAGE_2_ENTREPRENEUR;
    } else {
      this.state.stage = SimulationStage.STAGE_1_RETAIL_INVESTOR;
    }

    BankLoanEngine.syncCollateralPool(this.state);
    const reservedCashNow = this.getReservedCash();
    CentralLedgerEngine.syncLedgerWithState(this.state, reservedCashNow);

    this.state.lastIntegrityAudit =
      AccountingEngine.auditSimulationIntegrity(this.state);
    this.state.lastFinancialIntegrityReport =
      CentralLedgerEngine.runFinancialIntegrityAudit(
        this.state,
        reservedCashNow
      );
  }

  private recordTransaction(
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
    const stock = this.state.stocks.find((s) => s.ticker === ticker);
    if (!stock) {
      return {
        success: false,
        message: `${ticker} kodlu hisse bulunamadı.`,
        totalCost: 0,
      };
    }

    const reservedCash = this.getReservedCash();
    const spendableCash = this.getSpendableCash();
    const netWorthBefore = this.state.netWorth;
    const { result, newCash } = MarketEngine.executeBuyOrder({
      stock,
      sharesToBuy,
      availableCash: spendableCash,
      portfolio: this.state.portfolio,
      currentDay: this.state.day,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.message,
        totalCost: 0,
      };
    }

    this.state.cash = Number((newCash + reservedCash).toFixed(2));
    if (
      this.state.playerCompany &&
      this.state.playerCompany.ticker === ticker
    ) {
      this.state.playerCompany.playerOwnedShares =
        this.state.portfolio[ticker]?.shares || 0;
      this.state.playerCompany.playerOwnershipPct = stock.playerOwnershipPct;
    }

    this.recalculateFinancialsAndStages();
    this.pendingDailyActions.push(result.message);
    const buyTxId = this.recordTransaction({
      type: 'BUY',
      ticker,
      shares: result.sharesExecuted,
      executionPrice: result.executionPrice,
      grossAmount: result.grossAmount,
      commission: result.commission,
      slippageBps: result.slippageBps,
      cashDelta: -result.totalCost,
      netWorthBefore,
      netWorthAfter: this.state.netWorth,
      description: result.message,
    });
    CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
      idempotencyKey: `DIRECT-BUY-${buyTxId}`,
      sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      destinationAccountId: ACCOUNT_IDS.EQUITY_CAPITAL,
      amount: result.totalCost,
      category: 'STOCK_PURCHASE_COST',
      description: result.message,
      relatedCompanyId: ticker,
      reservedOrderCash: this.getReservedCash(),
    });

    return {
      success: true,
      message: result.message,
      totalCost: result.totalCost,
      executionPrice: result.executionPrice,
      commission: result.commission,
      slippageBps: result.slippageBps,
    };
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
    const stock = this.state.stocks.find((s) => s.ticker === ticker);
    if (!stock) {
      return {
        success: false,
        message: `${ticker} kodlu hisse bulunamadı.`,
        netProceeds: 0,
        realizedPnL: 0,
      };
    }

    if (BankLoanEngine.isStockPledgedAsCollateral(this.state, ticker)) {
      return {
        success: false,
        message: `${ticker} hissesi aktif bir banka kredisinde teminat olarak kilitlidir; satabilmek için önce ilgili krediyi kapatmalısınız.`,
        netProceeds: 0,
        realizedPnL: 0,
      };
    }

    const availableUnreservedShares = this.getAvailableShares(ticker);
    if (sharesToSell > availableUnreservedShares) {
      return {
        success: false,
        message: `Portföyde satılabilir (rezerv dışı) yeterli ${ticker} hissesi bulunmuyor (Kullanılabilir: ${availableUnreservedShares} lot).`,
        netProceeds: 0,
        realizedPnL: 0,
      };
    }

    const netWorthBefore = this.state.netWorth;
    const { result, newCash } = MarketEngine.executeSellOrder({
      stock,
      sharesToSell,
      availableCash: this.state.cash,
      portfolio: this.state.portfolio,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.message,
        netProceeds: 0,
        realizedPnL: 0,
      };
    }

    this.state.cash = newCash;
    if (
      this.state.playerCompany &&
      this.state.playerCompany.ticker === ticker
    ) {
      this.state.playerCompany.playerOwnedShares =
        this.state.portfolio[ticker]?.shares || 0;
      this.state.playerCompany.playerOwnershipPct = stock.playerOwnershipPct;
    }

    this.recalculateFinancialsAndStages();
    this.pendingDailyActions.push(result.message);
    const sellTxId = this.recordTransaction({
      type: 'SELL',
      ticker,
      shares: result.sharesExecuted,
      executionPrice: result.executionPrice,
      grossAmount: result.grossAmount,
      commission: result.commission,
      slippageBps: result.slippageBps,
      cashDelta: result.netProceeds,
      netWorthBefore,
      netWorthAfter: this.state.netWorth,
      description: result.message,
    });
    CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
      idempotencyKey: `DIRECT-SELL-${sellTxId}`,
      sourceAccountId: ACCOUNT_IDS.EQUITY_CAPITAL,
      destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      amount: result.netProceeds,
      category: 'STOCK_SALE_PROCEEDS',
      description: result.message,
      relatedCompanyId: ticker,
      reservedOrderCash: this.getReservedCash(),
    });

    return {
      success: true,
      message: result.message,
      netProceeds: result.netProceeds,
      realizedPnL: result.realizedPnL,
      executionPrice: result.executionPrice,
      commission: result.commission,
    };
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
    if (this.state.playerCompany) {
      return {
        success: false,
        message: 'Zaten kurulmuş bir şirketiniz bulunuyor.',
      };
    }

    const reservedCash = this.getReservedCash();
    const spendableCash = this.getSpendableCash();
    const netWorthBefore = this.state.netWorth;
    const res = CompanyEngine.establishPlayerCompany({
      input: {
        name,
        ticker,
        sector,
        initialCapital,
        initialStaffCount: options?.initialStaffCount,
        initialRdBudget: options?.initialRdBudget,
        initialCapacity: options?.initialCapacity,
      },
      playerCash: spendableCash,
      playerNetWorth: this.state.netWorth,
      currentDay: this.state.day,
      existingTickers: this.state.stocks.map((s) => s.ticker),
      macro: this.state.macro,
    });

    if (!res.success || !res.company) {
      return { success: false, message: res.message };
    }

    this.state.cash = Number((res.newPlayerCash + reservedCash).toFixed(2));
    this.state.playerCompany = res.company;
    this.recalculateFinancialsAndStages();
    this.pendingDailyActions.push(res.message);

    const foundTxId = this.recordTransaction({
      type: 'COMPANY_FOUNDING',
      ticker: res.company.ticker,
      grossAmount: initialCapital,
      commission: 0,
      slippageBps: 0,
      cashDelta: -(netWorthBefore - this.state.cash),
      netWorthBefore,
      netWorthAfter: this.state.netWorth,
      description: res.message,
    });
    CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
      idempotencyKey: `FOUND-COMPANY-${res.company.ticker}-${foundTxId}`,
      sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      destinationAccountId: ACCOUNT_IDS.companyBank(res.company.ticker),
      amount: initialCapital,
      category: 'CAPITAL_INJECTION',
      description: `${res.company.name} kuruluş sermayesi aktarımı`,
      relatedCompanyId: res.company.ticker,
      reservedOrderCash: this.getReservedCash(),
    });

    return {
      success: true,
      message: res.message,
      company: res.company,
    };
  }

  /**
   * Aşama 2: Çift Kayıt Sermaye Aktarımı (Kişisel Nakit -> Şirket Özkaynağı)
   */
  public transferCapitalToCompany(amount: number): {
    success: boolean;
    message: string;
  } {
    if (!this.state.playerCompany) {
      return {
        success: false,
        message: 'Aktif bir oyuncu şirketi bulunmuyor.',
      };
    }

    if (this.state.playerCompany.isPubliclyListed) {
      return {
        success: false,
        message:
          'Halka açık şirketlere doğrudan kişisel sermaye aktarımı yapılamaz; borsadan pay alabilirsiniz.',
      };
    }

    const reservedCash = this.getReservedCash();
    const spendableCash = this.getSpendableCash();
    const netWorthBefore = this.state.netWorth;
    const res = CompanyEngine.injectCapital({
      company: this.state.playerCompany,
      amount,
      playerCash: spendableCash,
    });

    if (!res.success) {
      return { success: false, message: res.message };
    }

    this.state.cash = Number((res.newPlayerCash + reservedCash).toFixed(2));
    this.recalculateFinancialsAndStages();
    this.pendingDailyActions.push(res.message);

    const capTxId = this.recordTransaction({
      type: 'CAPITAL_INJECTION',
      ticker: this.state.playerCompany.ticker,
      grossAmount: amount,
      commission: 0,
      slippageBps: 0,
      cashDelta: -amount,
      netWorthBefore,
      netWorthAfter: this.state.netWorth,
      description: res.message,
    });
    CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
      idempotencyKey: `CAP-INJ-${this.state.playerCompany.ticker}-${capTxId}`,
      sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      destinationAccountId: ACCOUNT_IDS.companyBank(
        this.state.playerCompany.ticker
      ),
      amount,
      category: 'CAPITAL_INJECTION',
      description: res.message,
      relatedCompanyId: this.state.playerCompany.ticker,
      reservedOrderCash: this.getReservedCash(),
    });

    return { success: true, message: res.message };
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
    if (!this.state.playerCompany) {
      return {
        success: false,
        message: 'Yönetilecek şirket bulunamadı.',
        capitalSpent: 0,
      };
    }

    const pc = this.state.playerCompany;
    CompanyEngine.ensureCompanyV5Fields(pc, this.state.macro);
    const staffBefore = pc.staffCount;
    const capBefore = pc.productionCapacity;
    const netWorthBefore = this.state.netWorth;

    const res = CompanyEngine.configureOperations(pc, params);
    if (!res.success) {
      return res;
    }

    this.recalculateFinancialsAndStages();

    const hiredCount = Math.max(0, pc.staffCount - staffBefore);
    const capGain = Math.max(0, pc.productionCapacity - capBefore);

    if (res.capitalSpent > 0) {
      const txDesc =
        hiredCount > 0
          ? `${pc.name}: +${hiredCount} yeni çalışan işe alındı (Toplam: ${pc.staffCount} çalışan)`
          : capGain > 0
          ? `${pc.name}: +${capGain} br/gün üretim tesisi yatırımı`
          : res.message;

      const opsTxId = this.recordTransaction({
        type: 'CAPITAL_INJECTION',
        ticker: pc.ticker,
        grossAmount: res.capitalSpent,
        commission: 0,
        slippageBps: 0,
        cashDelta: 0,
        netWorthBefore,
        netWorthAfter: this.state.netWorth,
        description: txDesc,
      });

      CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
        idempotencyKey: `OPS-CFG-${pc.ticker}-${opsTxId}`,
        sourceAccountId: ACCOUNT_IDS.companyBank(pc.ticker),
        destinationAccountId:
          hiredCount > 0 ? ACCOUNT_IDS.PAYROLL_EXPENSE : ACCOUNT_IDS.FIXED_ASSET,
        amount: res.capitalSpent,
        category: hiredCount > 0 ? 'PAYROLL_PAYMENT' : 'CAPEX_INVESTMENT',
        description: txDesc,
        relatedCompanyId: pc.ticker,
        reservedOrderCash: this.getReservedCash(),
      });
    }

    this.pendingDailyActions.push(res.message);
    return res;
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
    const netWorthBefore = this.state.netWorth;
    const res = CentralLedgerEngine.executeTransfer(
      this.state,
      {
        idempotencyKey:
          params.idempotencyKey ||
          `XFER-D${this.state.day}-M${this.state.totalElapsedGameMinutes}-${params.sourceAccountId}-${params.destinationAccountId}-${params.amount.toFixed(2)}`,
        sourceAccountId: params.sourceAccountId,
        destinationAccountId: params.destinationAccountId,
        amount: params.amount,
        category: params.category,
        description: params.description,
        relatedCompanyId: this.state.playerCompany?.ticker,
      },
      this.getReservedCash()
    );

    this.recalculateFinancialsAndStages();

    if (res.success && res.transaction) {
      this.pendingDailyActions.push(res.message);
      this.recordTransaction({
        type: 'CAPITAL_INJECTION',
        ticker: this.state.playerCompany?.ticker || 'FINANS',
        grossAmount: params.amount,
        commission: res.taxWithheld,
        slippageBps: 0,
        cashDelta:
          params.destinationAccountId === 'PLAYER_PERSONAL_CASH' ||
          params.destinationAccountId === 'PLAYER_INVESTMENT_CASH'
            ? res.netAmountTransferred
            : params.sourceAccountId === 'PLAYER_PERSONAL_CASH' ||
              params.sourceAccountId === 'PLAYER_INVESTMENT_CASH'
            ? -params.amount
            : 0,
        netWorthBefore,
        netWorthAfter: this.state.netWorth,
        description: res.message,
      });
    }

    return res;
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
    if (!this.state.playerCompany) {
      return {
        success: false,
        message: 'Yatırım başlatmak için aktif bir şirketiniz olmalıdır.',
        project: null,
      };
    }

    const upcomingLoanInstallments = (this.state.activeLoans || [])
      .filter(
        (l) =>
          (l.status === 'ACTIVE' || l.status === 'DELINQUENT') &&
          l.borrowerType === 'COMPANY' &&
          l.nextPaymentGameDay - this.state.day <= 15
      )
      .reduce((sum, l) => sum + l.installmentAmount, 0);

    const nextProjSeq = (this.state.projectSequence || 0) + 1;

    if (params.fundingSource === 'BANK_LOAN') {
      const quote = CompanyEngine.computeInvestmentProjectQuote(
        this.state.playerCompany,
        params.packageType,
        {
          customCapacityGain: params.customCapacityGain,
          budgetMaxMode: params.budgetMaxMode,
          upcomingLoanInstallments,
        }
      );
      if (quote.totalCost > this.state.playerCompany.financials.cash) {
        const neededLoan = Math.ceil(
          quote.totalCost -
            this.state.playerCompany.financials.cash +
            25_000
        );
        const loanRes = this.takeOutBankLoan({
          loanType:
            params.packageType === 'NEW_FACTORY'
              ? 'FACTORY_INVESTMENT'
              : 'MACHINE_EQUIPMENT',
          principal: neededLoan,
          termInGameDays: 90,
          idempotencyKey: `INV-LOAN-D${this.state.day}-P${nextProjSeq}`,
        });
        if (!loanRes.success) {
          return {
            success: false,
            message: `Yatırım kredisi onaylanmadı: ${loanRes.message}`,
            project: null,
          };
        }
      }
    }

    const res = CompanyEngine.startInvestmentProject(this.state.playerCompany, {
      packageType: params.packageType,
      currentDay: this.state.day,
      projectSeq: nextProjSeq,
      customCapacityGain: params.customCapacityGain,
      budgetMaxMode: params.budgetMaxMode,
      upcomingLoanInstallments,
      facilityLocation: params.facilityLocation,
    });

    if (res.success && res.project) {
      this.state.projectSequence = nextProjSeq;
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
      CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
        idempotencyKey: `CAPEX-${res.project.projectId}`,
        sourceAccountId: ACCOUNT_IDS.companyBank(
          this.state.playerCompany.ticker
        ),
        destinationAccountId: ACCOUNT_IDS.FIXED_ASSET,
        amount: res.project.totalCost,
        category: 'CAPEX_INVESTMENT',
        description: `${res.project.title} yatırım projesi ödemesi`,
        relatedCompanyId: this.state.playerCompany.ticker,
        relatedContractId: res.project.projectId,
        reservedOrderCash: this.getReservedCash(),
      });
    }

    return res;
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
    if (!this.state.playerCompany) {
      return {
        success: false,
        message: 'Aktif şirket bulunamadı.',
        unitsSold: 0,
        cashProceeds: 0,
        cashGenerated: 0,
      };
    }
    const res = CompanyEngine.liquidateExcessInventory(
      this.state.playerCompany,
      unitsToLiquidate,
      discountRatio
    );
    if (res.success) {
      this.recalculateFinancialsAndStages();
      this.pendingDailyActions.push(res.message);
      CentralLedgerEngine.recordPostedAccountingEntry(this.state, {
        idempotencyKey: `INV-LIQ-${this.state.playerCompany.ticker}-D${this.state.day}-M${this.state.totalElapsedGameMinutes}-${res.unitsSold}`,
        sourceAccountId: ACCOUNT_IDS.INVENTORY_ASSET,
        destinationAccountId: ACCOUNT_IDS.companyBank(
          this.state.playerCompany.ticker
        ),
        amount: res.cashProceeds,
        category: 'OPERATING_REVENUE_RECEIPT',
        description: res.message,
        relatedCompanyId: this.state.playerCompany.ticker,
        reservedOrderCash: this.getReservedCash(),
      });
    }
    return {
      ...res,
      cashGenerated: res.cashProceeds,
    };
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
    if (!this.state.playerCompany) {
      return {
        success: false,
        message: 'Halka arz edilecek bir şirketiniz bulunmuyor.',
        ticker: '',
        offerPrice: 0,
        priceRangeMin: 0,
        priceRangeMax: 0,
        fairPricePerShare: 0,
        primaryNewSharesIssued: 0,
        secondaryExistingSharesSold: 0,
        offeredShares: 0,
        subscribedShares: 0,
        institutionalDemandShares: 0,
        retailDemandShares: 0,
        oversubscriptionMultiple: 0,
        grossProceeds: 0,
        underwritingFee: 0,
        netProceedsToPlayerCash: 0,
        netProceedsToCompanyTreasury: 0,
        newTotalShares: 0,
        remainingPlayerOwnershipPct: 0,
        firstDayClosingPrice: 0,
        fundParticipations: [],
      };
    }

    const netWorthBefore = this.state.netWorth;
    const { result, newPlayerCash } = IPOEngine.executeCompanyIPO({
      company: this.state.playerCompany,
      publicFloatRatio,
      discountRatio,
      primaryShareIssueRatio,
      macro: this.state.macro,
      stocks: this.state.stocks,
      funds: this.state.institutionalFunds,
      portfolio: this.state.portfolio,
      playerCash: this.state.cash,
      currentDay: this.state.day,
    });

    if (!result.success) {
      return result;
    }

    this.state.cash = newPlayerCash;
    this.recalculateFinancialsAndStages();
    this.pendingDailyActions.push(result.message);

    this.recordTransaction({
      type: 'IPO_PROCEEDS',
      ticker: result.ticker,
      shares: result.subscribedShares,
      executionPrice: result.offerPrice,
      grossAmount: result.grossProceeds,
      commission: result.underwritingFee,
      slippageBps: 0,
      cashDelta: result.netProceedsToPlayerCash,
      netWorthBefore,
      netWorthAfter: this.state.netWorth,
      description: result.message,
    });

    return result;
  }

  /**
   * Aşama 4: Düşmanca Devralma (Hostile Takeover)
   */
  public executeHostileTakeover(
    ticker: string,
    options?: { targetOwnershipPct?: number; useDebtFinancing?: boolean }
  ): TakeoverResult {
    const stock = this.state.stocks.find((s) => s.ticker === ticker);
    if (!stock) {
      return {
        success: false,
        message: `${ticker} kodlu şirket bulunamadı.`,
        ticker,
        companyName: '',
        previousOwnershipPct: 0,
        newOwnershipPct: 0,
        controlLevelBefore: 'NONE',
        controlLevelAfter: 'NONE',
        sharesAcquiredInTender: 0,
        tenderOfferPrice: 0,
        controlPremiumPct: 0,
        defenseTriggered: false,
        rivalBidOccurred: false,
        rivalBidPremiumPct: 0,
        debtFinancingUsed: 0,
        interestRateOnFinancing: 0,
        integrationCostPaid: 0,
        totalTenderCost: 0,
        estimatedDailySynergyDividend: 0,
      };
    }

    const reservedCash = this.getReservedCash();
    const spendableCash = this.getSpendableCash();
    const netWorthBefore = this.state.netWorth;
    const { result, newPlayerCash, newPlayerLongTermDebt } =
      MergerAcquisitionEngine.executeTakeoverTenderOffer({
        stock,
        targetOwnershipPct: options?.targetOwnershipPct ?? 51.0,
        useDebtFinancing: options?.useDebtFinancing ?? false,
        playerCash: spendableCash,
        playerLongTermDebt: this.state.longTermDebt,
        portfolio: this.state.portfolio,
        controlledSubsidiaries: this.state.controlledSubsidiaries,
        macro: this.state.macro,
        currentDay: this.state.day,
        rng: this.rng,
      });

    if (!result.success) {
      return result;
    }

    this.state.cash = Number((newPlayerCash + reservedCash).toFixed(2));
    this.state.longTermDebt = newPlayerLongTermDebt;
    this.recalculateFinancialsAndStages();
    this.pendingDailyActions.push(result.message);

    this.recordTransaction({
      type: 'TAKEOVER_TENDER',
      ticker,
      shares: result.sharesAcquiredInTender,
      executionPrice: result.tenderOfferPrice,
      grossAmount: result.totalTenderCost,
      commission: result.integrationCostPaid,
      slippageBps: 0,
      cashDelta: -(result.totalTenderCost - result.debtFinancingUsed),
      netWorthBefore,
      netWorthAfter: this.state.netWorth,
      description: result.message,
    });

    return result;
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
    return this.run30DaySimulation(true, days, silentConsole);
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
    const consoleLines: string[] = [];
    const printLine = (line: string) => {
      consoleLines.push(line);
      if (!silentConsole) {
        console.log(line);
      }
    };

    const startDay = this.state.day;
    const startNetWorth = this.state.netWorth;
    const startCash = this.state.cash;
    const startPortfolioValue = this.state.portfolioValue;
    const startTxSequence = this.state.transactionSequence;
    const startDividends = this.state.totalDividendsEarned;
    const startSynergy = this.state.totalSynergyEarned;
    const startCompanyRev = this.state.playerCompany?.annualizedRevenue || 0;
    const startCompanyEbitda = this.state.playerCompany?.annualizedEbitda || 0;

    const initialStockPrices: Record<string, number> = {};
    for (const s of this.state.stocks) {
      initialStockPrices[s.ticker] = s.price;
    }

    const ipoEvents: string[] = [];
    const takeoverEvents: string[] = [];
    const integrityErrors: string[] = [];

    printLine(
      '================================================================================'
    );
    printLine(
      `  BORSA VE HOLDİNG SİMÜLATÖRÜ - ${daysToRun} GÜNLÜK ${enableStrategyAutomation ? 'OTOMATİK STRES SENARYOSU' : 'SAF ZAMAN İLERLETMESİ'}`
    );
    printLine(
      '================================================================================'
    );
    printLine(
      `[BAŞLANGIÇ GÜN ${String(startDay).padStart(2, '0')}] Aşama: ${this.state.stage} | Nakit: ${this.formatCurrency(this.state.cash)} | Portföy: ${this.formatCurrency(this.state.portfolioValue)} | Net Varlık: ${this.formatCurrency(this.state.netWorth)}`
    );

    for (let step = 1; step <= daysToRun; step++) {
      if (enableStrategyAutomation) {
        for (const pos of Object.values(this.state.portfolio)) {
          const st = this.state.stocks.find((s) => s.ticker === pos.ticker);
          if (
            st &&
            !st.isPlayerCompany &&
            !st.isControlledByPlayer &&
            st.bidPrice > pos.averageCost * 1.07 &&
            pos.shares >= 20
          ) {
            this.sellStock(
              st.ticker,
              Math.max(10, Math.floor(pos.shares * 0.4))
            );
          }
        }

        if (this.getSpendableCash() > 12_000) {
          const candidates = [...this.state.stocks]
            .filter((s) => !s.isPlayerCompany)
            .sort((a, b) => {
              const scoreA =
                a.fundamentalPrice / a.price + a.sentimentScore * 8;
              const scoreB =
                b.fundamentalPrice / b.price + b.sentimentScore * 8;
              return scoreB - scoreA;
            });

          const topPick = candidates[0];
          if (topPick) {
            const budget = this.getSpendableCash() * 0.35;
            const lots = Math.min(
              500,
              Math.floor(budget / (topPick.askPrice * 1.002))
            );
            if (lots >= 10) {
              this.buyStock(topPick.ticker, lots);
            }
          }
        }

        if (
          !this.state.playerCompany &&
          this.state.netWorth >= SimulationEngine.STAGE_2_NET_WORTH_THRESHOLD &&
          this.getSpendableCash() >= 400_000
        ) {
          this.establishCompany(
            'Turkuaz Kuantum & Bulut Sistemleri A.Ş.',
            'TRKZ',
            'TEKNOLOJI',
            Math.min(this.getSpendableCash() * 0.65, 1_200_000)
          );
        } else if (
          this.state.playerCompany &&
          !this.state.playerCompany.isPubliclyListed
        ) {
          const pc = this.state.playerCompany;
          if (pc.financials.cash > 300_000) {
            this.configureCompanyOperations({
              targetStaffCount: Math.min(180, pc.staffCount + 6),
              targetProductionCapacity: Math.min(
                220,
                pc.productionCapacity + 8
              ),
              dailyRdBudget: Math.min(75_000, pc.dailyRdBudget + 5_000),
            });
          }

          const ipoEligibility = this.checkIPOEligibility();
          if (ipoEligibility.eligible) {
            const ipoRes = this.executeIPO(0.3, 0.12, 0.35);
            if (ipoRes.success) {
              ipoEvents.push(ipoRes.message);
            }
          }
        }

        if (
          this.state.playerCompany?.isPubliclyListed &&
          this.state.controlledSubsidiaries.length === 0
        ) {
          const smallestNpc = [...this.state.stocks]
            .filter((s) => !s.isPlayerCompany && !s.isControlledByPlayer)
            .sort((a, b) => a.equityValue - b.equityValue)[0];
          if (
            smallestNpc &&
            this.getSpendableCash() > smallestNpc.equityValue * 0.68
          ) {
            const toRes = this.executeHostileTakeover(smallestNpc.ticker);
            if (toRes.success) {
              takeoverEvents.push(toRes.message);
            }
          }
        }
      }

      const log = this.tickDay();
      if (!log.integrityValid) {
        integrityErrors.push(
          `Gün ${log.day}: ${this.state.lastIntegrityAudit.errors.join(', ')}`
        );
      }

      printLine(
        `[GÜN ${String(log.day).padStart(2, '0')} | ${log.dateISO}] Aşama ${log.stage} | Nakit: ${this.formatCurrency(log.cash)} | Portföy: ${this.formatCurrency(log.portfolioMarketValue)} | Net Varlık: ${this.formatCurrency(log.netWorth)} | Endeks: ${log.marketIndexValue.toFixed(1)}`
      );
      printLine(`   Haber: "${log.headlineNews}"`);
      for (const act of log.actionsTaken) {
        printLine(`   -> ${act}`);
      }
    }

    const endNetWorth = this.state.netWorth;
    const netWorthChange = Number((endNetWorth - startNetWorth).toFixed(2));
    const netWorthChangePct = Number(
      ((netWorthChange / Math.max(1, startNetWorth)) * 100).toFixed(2)
    );

    const stockPerformances = this.state.stocks.map((s) => {
      const baseP = initialStockPrices[s.ticker] || s.previousPrice || s.price;
      const returnPct = Number((((s.price - baseP) / baseP) * 100).toFixed(2));
      return { ticker: s.ticker, name: s.name, returnPct };
    });

    const sortedByReturn = [...stockPerformances].sort(
      (a, b) => b.returnPct - a.returnPct
    );

    const summary: BatchSimulationSummary = {
      daysSimulated: daysToRun,
      startDay,
      endDay: this.state.day,
      startNetWorth,
      endNetWorth,
      netWorthChange,
      netWorthChangePct,
      startCash,
      endCash: this.state.cash,
      cashChange: Number((this.state.cash - startCash).toFixed(2)),
      startPortfolioValue,
      endPortfolioValue: this.state.portfolioValue,
      portfolioChange: Number(
        (this.state.portfolioValue - startPortfolioValue).toFixed(2)
      ),
      totalDividendsCollected: Number(
        (this.state.totalDividendsEarned - startDividends).toFixed(2)
      ),
      totalSynergyCollected: Number(
        (this.state.totalSynergyEarned - startSynergy).toFixed(2)
      ),
      executedTransactionsCount: Math.max(
        0,
        this.state.transactionSequence - startTxSequence
      ),
      bestPerformingStocks: sortedByReturn.slice(0, 3),
      worstPerformingStocks: [...sortedByReturn].reverse().slice(0, 3),
      generatedNewsCount: daysToRun,
      ipoEvents,
      takeoverEvents,
      companyRevenueDelta: Number(
        (
          (this.state.playerCompany?.annualizedRevenue || 0) - startCompanyRev
        ).toFixed(2)
      ),
      companyEbitdaDelta: Number(
        (
          (this.state.playerCompany?.annualizedEbitda || 0) - startCompanyEbitda
        ).toFixed(2)
      ),
      integrityErrors,
    };

    this.state.lastBatchSummary = summary;

    printLine(
      '================================================================================'
    );
    printLine(
      `  ${daysToRun} GÜNLÜK SİMÜLASYON ÖZETİ: Başlangıç Net Varlık: ${this.formatCurrency(startNetWorth)} -> Bitiş Net Varlık: ${this.formatCurrency(endNetWorth)} (${netWorthChange >= 0 ? '+' : ''}${netWorthChangePct}%) | Bütünlük Hatası: ${integrityErrors.length}`
    );
    printLine(
      '================================================================================'
    );

    return {
      logs: this.state.dailyLogs,
      consoleLines,
      summary,
      finalState: this.state,
    };
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

