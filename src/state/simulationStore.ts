/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 10 & ZAMAN SÜRÜMÜ: KALICI KAYIT, MİGRATION VE HATA RAPORLAMA STORE (simulationStore)
 * - Simülasyon durumunu (seed, randomState, oyun saati, piyasa seansı, bekleyen emirler,
 *   oyuncu, portföy, 16 NPC şirket bilançosu, oyuncu şirketi, NPC fonlar, haberler,
 *   makroekonomi, işlem geçmişi ve aşama kilitleri) tarayıcı localStorage üzerinde saklar.
 * - Eski v2 kayıtlarını silmeden v3 şemasına güvenli biçimde yükseltir (Migration).
 * - save error, parse error, migration error, restore error ve quota error durumlarını
 *   yapılandırılmış olarak raporlar.
 */

import { ensureDecisionState } from '../engine/DecisionEventEngine';
import { CentralLedgerEngine } from '../engine/CentralLedgerEngine';
import { CompanyEngine } from '../engine/CompanyEngine';
import { EconomyEngine } from '../engine/EconomyEngine';
import { GameClockEngine } from '../engine/GameClockEngine';
import { ProgressionRules } from '../engine/ProgressionRules';
import { SimulationEngine, SimulationState } from '../engine/SimulationEngine';
import { TradeAndShopEngine } from '../engine/TradeAndShopEngine';

export type StoreErrorCategory =
  | 'SAVE_ERROR'
  | 'PARSE_ERROR'
  | 'MIGRATION_ERROR'
  | 'RESTORE_ERROR'
  | 'QUOTA_ERROR';

export interface StoreErrorReport {
  category: StoreErrorCategory;
  message: string;
  timestampISO: string;
  technicalDetail?: string;
}

export interface SavedSimulationEnvelope {
  schemaVersion: number;
  savedAtISO: string;
  seed: number;
  randomState: number;
  state: SimulationState;
}

export interface MigrationStats {
  migratedFromVersion: number;
  migratedToVersion: number;
  duplicateTransactionsFixedCount: number;
  duplicateOrdersFixedCount: number;
  totalTransactionsMigrated: number;
  legacyTechMultiplierBefore?: number;
  legacyTechMultiplierAfter?: number;
  companyValuationRebalanced?: boolean;
}

export class SimulationStore {
  public static readonly STORAGE_KEY = 'borsa_holding_simulator_save_v2';
  public static readonly BACKUP_V4_KEY = 'borsa_holding_simulator_save_v4_backup';
  public static readonly CURRENT_SCHEMA_VERSION =
    SimulationEngine.CURRENT_SCHEMA_VERSION; // 5

  private static lastError: StoreErrorReport | null = null;
  private static lastMigrationStats: MigrationStats | null = null;

  public static getLastError(): StoreErrorReport | null {
    return SimulationStore.lastError;
  }

  public static getLastMigrationStats(): MigrationStats | null {
    return SimulationStore.lastMigrationStats;
  }

  public static clearLastError(): void {
    SimulationStore.lastError = null;
  }

  private static reportError(
    category: StoreErrorCategory,
    message: string,
    err?: unknown
  ): StoreErrorReport {
    const technicalDetail =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : typeof err === 'string'
        ? err
        : undefined;
    const report: StoreErrorReport = {
      category,
      message,
      timestampISO: new Date().toISOString(),
      technicalDetail,
    };
    SimulationStore.lastError = report;
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(
        `[SimulationStore:${category}] ${message}`,
        technicalDetail || ''
      );
    }
    return report;
  }

  private static isQuotaExceededError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const domErr = err as { name?: string; code?: number };
    return (
      domErr.name === 'QuotaExceededError' ||
      domErr.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      domErr.code === 22 ||
      domErr.code === 1014
    );
  }

  public static deriveOrMigrateCityState(
    st: Partial<SimulationState>,
    currentDay: number = 1
  ): NonNullable<SimulationState['cityState']> {
    const existing = st.cityState;
    const pc = st.playerCompany ?? null;
    const hasCompany = Boolean(pc);
    const netWorth = typeof st.netWorth === 'number' ? st.netWorth : 100_000;
    const isStage2 = ProgressionRules.hasEntrepreneurAccess(st);
    const isStage4 = ProgressionRules.isHoldingStage(st);

    const unlockedDistricts = new Set<string>([
      'FINANS_BOLGESI',
      'TICARET_BOLGESI',
      'YASAM_HIZMET_BOLGESI',
    ]);
    if (isStage2) {
      unlockedDistricts.add('SANAYI_BOLGESI');
      unlockedDistricts.add('TEKNOLOJI_BOLGESI');
    }
    if (ProgressionRules.qualifiesForExpansionDistricts(st)) {
      unlockedDistricts.add('KILITLI_GENISLEME_ALANLARI');
    }
    if (existing?.unlockedDistricts) {
      for (const d of existing.unlockedDistricts) {
        unlockedDistricts.add(d);
      }
    }

    const portfolioCount = st.portfolio
      ? Object.values(st.portfolio).filter((p) => p && p.shares > 0).length
      : 0;
    const borsaLevel = portfolioCount >= 4 ? 3 : portfolioCount >= 1 ? 2 : 1;
    const bankaLevel =
      (st.activeLoans?.filter((l) => l.status !== 'PAID_OFF').length ?? 0) >= 2
        ? 3
        : (st.totalDebt ?? 0) > 0
        ? 2
        : 1;
    const sirketLevel = hasCompany
      ? pc!.isPubliclyListed || pc!.staffCount >= 60 || pc!.productionCapacity >= 200
        ? 3
        : pc!.staffCount >= 25 || pc!.productionCapacity >= 110
        ? 2
        : 1
      : 1;
    const fabrikaLevel = hasCompany
      ? pc!.productionCapacity >= 150
        ? 3
        : pc!.productionCapacity >= 80
        ? 2
        : 1
      : 1;
    const argeLevel = hasCompany
      ? pc!.techQualityMultiplier >= 1.25
        ? 3
        : pc!.techQualityMultiplier >= 1.08
        ? 2
        : 1
      : 1;
    const holdingLevel =
      (st.controlledSubsidiaries?.length ?? 0) >= 2 || (st.stage ?? 1) >= 4
        ? 3
        : isStage4
        ? 2
        : 1;

    const buildingVisualLevels: Record<string, number> = {
      ...(existing?.buildingVisualLevels || {}),
      BORSA: Math.max(existing?.buildingVisualLevels?.BORSA ?? 1, borsaLevel),
      BANKA: Math.max(existing?.buildingVisualLevels?.BANKA ?? 1, bankaLevel),
      HABER_MERKEZI: 2,
      OYUNCU_OFISI: Math.max(1, Math.min(3, st.stage ?? 1)),
      SIRKET_MERKEZI: Math.max(
        existing?.buildingVisualLevels?.SIRKET_MERKEZI ?? 1,
        sirketLevel
      ),
      FABRIKA: Math.max(
        existing?.buildingVisualLevels?.FABRIKA ?? 1,
        fabrikaLevel
      ),
      ARGE_MERKEZI: Math.max(
        existing?.buildingVisualLevels?.ARGE_MERKEZI ?? 1,
        argeLevel
      ),
      HOLDING_MERKEZI: Math.max(
        existing?.buildingVisualLevels?.HOLDING_MERKEZI ?? 1,
        holdingLevel
      ),
    };

    const rawProjects = pc?.investmentProjects ?? [];
    const activeConstructions = rawProjects
      .filter((p) => p.status === 'IN_PROGRESS')
      .map((p) => {
        const totalDays = Math.max(1, p.estimatedEndDay - p.startDay);
        const elapsedDays = Math.max(0, currentDay - p.startDay);
        const progressPct = Math.max(
          5,
          Math.min(
            95,
            typeof p.progressPct === 'number' && p.progressPct > 0
              ? Math.round(p.progressPct)
              : Math.round((elapsedDays / totalDays) * 100)
          )
        );
        const stage:
          | 'PARCEL_PREP'
          | 'FOUNDATION_SCAFFOLD'
          | 'NEAR_COMPLETION'
          | 'COMPLETED' =
          progressPct < 34
            ? 'PARCEL_PREP'
            : progressPct < 75
            ? 'FOUNDATION_SCAFFOLD'
            : 'NEAR_COMPLETION';
        return {
          projectId: p.projectId,
          buildingId: 'FABRIKA',
          stage,
          progressPct,
          estimatedCompletionDay: p.estimatedEndDay,
        };
      });

    const hasFactoryConstruction = activeConstructions.some(
      (c) => c.buildingId === 'FABRIKA'
    );
    const hasArgeConstruction = activeConstructions.some(
      (c) => c.buildingId === 'ARGE_MERKEZI'
    );

    const parcelStates: Record<
      string,
      'LOCKED' | 'UNLOCKED' | 'UNDER_CONSTRUCTION' | 'BUILT'
    > = {
      ...(existing?.parcelStates || {}),
      PARCEL_SIRKET_MERKEZI: hasCompany
        ? 'BUILT'
        : isStage2
        ? 'UNLOCKED'
        : 'LOCKED',
      PARCEL_FABRIKA: hasFactoryConstruction
        ? 'UNDER_CONSTRUCTION'
        : hasCompany
        ? 'BUILT'
        : 'LOCKED',
      PARCEL_ARGE: hasArgeConstruction
        ? 'UNDER_CONSTRUCTION'
        : hasCompany
        ? 'BUILT'
        : 'LOCKED',
      PARCEL_HOLDING: isStage4 ? 'BUILT' : 'LOCKED',
      PARCEL_EXPANSION_NORTH_WEST: unlockedDistricts.has(
        'KILITLI_GENISLEME_ALANLARI'
      )
        ? 'UNLOCKED'
        : 'LOCKED',
      PARCEL_EXPANSION_SOUTH_WEST: unlockedDistricts.has(
        'KILITLI_GENISLEME_ALANLARI'
      )
        ? 'UNLOCKED'
        : 'LOCKED',
      PARCEL_EXPANSION_SOUTH_EAST: unlockedDistricts.has(
        'KILITLI_GENISLEME_ALANLARI'
      )
        ? 'UNLOCKED'
        : 'LOCKED',
    };

    return {
      unlockedDistricts: Array.from(unlockedDistricts),
      buildingVisualLevels,
      activeConstructions,
      parcelStates,
      lastCameraPanX:
        typeof existing?.lastCameraPanX === 'number' &&
        Number.isFinite(existing.lastCameraPanX)
          ? Math.round(existing.lastCameraPanX)
          : 0,
      lastCameraPanY:
        typeof existing?.lastCameraPanY === 'number' &&
        Number.isFinite(existing.lastCameraPanY)
          ? Math.round(existing.lastCameraPanY)
          : 0,
      lastZoomPreset:
        existing?.lastZoomPreset === 'CLOSER' ||
        existing?.lastZoomPreset === 'OVERVIEW' ||
        existing?.lastZoomPreset === 'NORMAL'
          ? existing.lastZoomPreset
          : 'NORMAL',
      graphicsQuality:
        existing?.graphicsQuality === 'LOW' ||
        existing?.graphicsQuality === 'HIGH' ||
        existing?.graphicsQuality === 'MEDIUM'
          ? existing.graphicsQuality
          : 'MEDIUM',
    };
  }

  /**
   * Mevcut SimulationEngine durumunu localStorage'a kaydeder.
   * Kayıt sırasında `lastRealTimestampISO` ve `lastAutosaveTimestampISO` alanlarını günceller.
   */
  public static saveToStorage(
    engine: SimulationEngine,
    customTimestampISO?: string
  ): SavedSimulationEnvelope | null {
    try {
      SimulationStore.clearLastError();
      const nowISO = customTimestampISO || new Date().toISOString();
      const state = engine.getState();
      state.randomState = engine.getRandomState();
      state.schemaVersion = SimulationStore.CURRENT_SCHEMA_VERSION;
      state.lastRealTimestampISO = nowISO;
      state.lastAutosaveTimestampISO = nowISO;
      state.cityState = SimulationStore.deriveOrMigrateCityState(
        state,
        state.day
      );

      const envelope: SavedSimulationEnvelope = {
        schemaVersion: SimulationStore.CURRENT_SCHEMA_VERSION,
        savedAtISO: nowISO,
        seed: state.seed,
        randomState: state.randomState,
        state: JSON.parse(JSON.stringify(state)) as SimulationState,
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          SimulationStore.STORAGE_KEY,
          JSON.stringify(envelope)
        );
      }
      return envelope;
    } catch (err) {
      if (SimulationStore.isQuotaExceededError(err)) {
        SimulationStore.reportError(
          'QUOTA_ERROR',
          'Tarayıcı depolama alanı (localStorage kotası) dolduğu için kayıt yazılamadı.',
          err
        );
      } else {
        SimulationStore.reportError(
          'SAVE_ERROR',
          'Simülasyon durumu kaydedilirken beklenmeyen bir hata oluştu.',
          err
        );
      }
      return null;
    }
  }

  /**
   * Eski v2, v3 veya v4 kayıtlarını güncel v5 şemasına güvenli ve idempotent biçimde yükseltir.
   * - Kayıp zaman alanlarına güvenli varsayılan değerler atar.
   * - `transactionSequence` ve `orderSequence` sayaçlarını başlatır; duplicate transaction/order ID'leri düzeltir.
   * - Eski kayıtlardaki şişmiş `techQualityMultiplier` ve değerleme çarpanlarını deterministik biçimde normalize eder.
   * - Yeni v5 banka, kredi, merkezi muhasebe defteri ve envanter alanlarını veri kaybı olmadan oluşturur.
   */
  public static migrateIfNeeded(raw: unknown): SavedSimulationEnvelope | null {
    try {
      if (!raw || typeof raw !== 'object') {
        SimulationStore.reportError(
          'MIGRATION_ERROR',
          'Kayıt verisi geçerli bir nesne değil.'
        );
        return null;
      }

      const candidate = raw as Partial<SavedSimulationEnvelope>;
      if (!candidate.state || typeof candidate.state !== 'object') {
        SimulationStore.reportError(
          'MIGRATION_ERROR',
          'Kayıt zarfı içinde geçerli bir state alanı bulunamadı.'
        );
        return null;
      }

      const st = JSON.parse(
        JSON.stringify(candidate.state)
      ) as Partial<SimulationState>;
      if (
        typeof st.cash !== 'number' ||
        !Number.isFinite(st.cash) ||
        !Array.isArray(st.stocks) ||
        st.stocks.length === 0
      ) {
        SimulationStore.reportError(
          'MIGRATION_ERROR',
          'Kayıtlı oyunda temel nakit veya hisse senedi listesi eksik/bozuk.'
        );
        return null;
      }

      const firstStock = st.stocks[0];
      if (!firstStock || !firstStock.financials || !firstStock.valuation) {
        SimulationStore.reportError(
          'MIGRATION_ERROR',
          'Eski kayıtta şirket finansal tabloları veya değerleme modeli bulunamadı.'
        );
        return null;
      }

      const sourceVersion =
        typeof st.schemaVersion === 'number'
          ? st.schemaVersion
          : typeof candidate.schemaVersion === 'number'
          ? candidate.schemaVersion
          : 2;

      const day =
        typeof st.day === 'number' && Number.isFinite(st.day) && st.day >= 1
          ? Math.floor(st.day)
          : 1;
      const minutesIntoDay = GameClockEngine.normalizeMinuteOfDay(
        typeof st.minutesIntoCurrentDay === 'number'
          ? st.minutesIntoCurrentDay
          : 0
      );
      const clock = GameClockEngine.computeClockFields(minutesIntoDay);
      const fallbackTimestamp =
        candidate.savedAtISO ||
        st.lastRealTimestampISO ||
        '2026-01-01T00:00:00.000Z';

      const sanitized =
        SimulationEngine.sanitizeAndMigrateTransactionsAndOrders(st);

      let legacyTechMultiplierBefore: number | undefined;
      let legacyTechMultiplierAfter: number | undefined;
      let companyValuationRebalanced = false;

      const macroState = st.macro || EconomyEngine.createInitialMacroState();
      if (st.playerCompany) {
        legacyTechMultiplierBefore = st.playerCompany.techQualityMultiplier;
        CompanyEngine.ensureCompanyV5Fields(st.playerCompany, macroState);
        legacyTechMultiplierAfter = st.playerCompany.techQualityMultiplier;
        if (
          typeof legacyTechMultiplierBefore === 'number' &&
          typeof legacyTechMultiplierAfter === 'number' &&
          Math.abs(legacyTechMultiplierBefore - legacyTechMultiplierAfter) >
            0.0001
        ) {
          companyValuationRebalanced = true;
        }
      }

      const cleanCash = Number(Math.max(0, st.cash).toFixed(2));
      const cleanPersonalCash =
        typeof st.personalCash === 'number' &&
        Number.isFinite(st.personalCash) &&
        st.personalCash >= 0
          ? Number(Math.min(cleanCash, st.personalCash).toFixed(2))
          : 0;
      const cleanInvestmentCash = Number(
        Math.max(0, cleanCash - cleanPersonalCash).toFixed(2)
      );
      const cleanHoldingCash =
        typeof st.holdingCash === 'number' &&
        Number.isFinite(st.holdingCash) &&
        st.holdingCash >= 0
          ? Number(st.holdingCash.toFixed(2))
          : 0;

      const totalElapsedGameMinutes =
        typeof st.totalElapsedGameMinutes === 'number' &&
        Number.isFinite(st.totalElapsedGameMinutes)
          ? st.totalElapsedGameMinutes
          : (day - 1) * GameClockEngine.MINUTES_PER_GAME_DAY +
            clock.minutesIntoCurrentDay;

      const centralLedger =
        st.centralLedger &&
        st.centralLedger.accounts &&
        Array.isArray(st.centralLedger.transactions)
          ? st.centralLedger
          : CentralLedgerEngine.createInitialLedgerState({
              initialPersonalCash: cleanPersonalCash,
              initialInvestmentCash: cleanInvestmentCash,
              reservedInvestmentCash: 0,
              day,
              companyTicker: st.playerCompany?.ticker,
              companyCash: st.playerCompany?.financials.cash ?? 0,
              companyInventory: st.playerCompany?.financials.inventory ?? 0,
              companyFixedAssets:
                st.playerCompany?.financials.fixedAssets ?? 0,
              companyEquityCapital:
                st.playerCompany?.financials.paidInCapital ?? 0,
              totalLoanDebt:
                (st.totalDebt ?? 0) +
                (st.playerCompany?.financials.totalLiabilities ?? 0),
            });

      SimulationStore.lastMigrationStats = {
        migratedFromVersion: sourceVersion,
        migratedToVersion: SimulationStore.CURRENT_SCHEMA_VERSION,
        duplicateTransactionsFixedCount:
          sanitized.duplicateTransactionsFixedCount,
        duplicateOrdersFixedCount: sanitized.duplicateOrdersFixedCount,
        totalTransactionsMigrated: sanitized.transactions.length,
        legacyTechMultiplierBefore,
        legacyTechMultiplierAfter,
        companyValuationRebalanced,
      };

      const migratedState: SimulationState = {
        ...(st as SimulationState),
        schemaVersion: SimulationStore.CURRENT_SCHEMA_VERSION,
        seed:
          typeof st.seed === 'number'
            ? st.seed
            : typeof candidate.seed === 'number'
            ? candidate.seed
            : SimulationEngine.DEFAULT_SEED,
        randomState:
          typeof st.randomState === 'number'
            ? st.randomState
            : typeof candidate.randomState === 'number'
            ? candidate.randomState
            : SimulationEngine.DEFAULT_SEED,
        day,
        currentGameMinute: clock.currentGameMinute,
        currentGameHour: clock.currentGameHour,
        minutesIntoCurrentDay: clock.minutesIntoCurrentDay,
        totalElapsedGameMinutes,
        realMinutesPerGameDay: GameClockEngine.sanitizeRealMinutesPerDay(
          st.realMinutesPerGameDay ??
            GameClockEngine.DEFAULT_REAL_MINUTES_PER_GAME_DAY
        ),
        timeScale: GameClockEngine.sanitizeTimeScale(st.timeScale ?? 1),
        isPaused:
          typeof st.isPaused === 'boolean' ? st.isPaused : st.timeScale === 0,
        marketSession: clock.marketSession,
        lastRealTimestampISO:
          typeof st.lastRealTimestampISO === 'string' && st.lastRealTimestampISO
            ? st.lastRealTimestampISO
            : fallbackTimestamp,
        lastAutosaveTimestampISO:
          typeof st.lastAutosaveTimestampISO === 'string' &&
          st.lastAutosaveTimestampISO
            ? st.lastAutosaveTimestampISO
            : fallbackTimestamp,
        intradaySubstepBufferMinutes:
          typeof st.intradaySubstepBufferMinutes === 'number' &&
          Number.isFinite(st.intradaySubstepBufferMinutes)
            ? st.intradaySubstepBufferMinutes
            : 0,
        intradayStepsProcessedToday:
          typeof st.intradayStepsProcessedToday === 'number' &&
          Number.isFinite(st.intradayStepsProcessedToday)
            ? st.intradayStepsProcessedToday
            : 0,
        intradayMarketStepsCompletedToday:
          typeof st.intradayMarketStepsCompletedToday === 'number' &&
          Number.isFinite(st.intradayMarketStepsCompletedToday)
            ? st.intradayMarketStepsCompletedToday
            : 0,
        cash: cleanCash,
        personalCash: cleanPersonalCash,
        investmentCash: cleanInvestmentCash,
        holdingCash: cleanHoldingCash,
        transactions: sanitized.transactions,
        transactionSequence: sanitized.transactionSequence,
        pendingOrders: sanitized.pendingOrders,
        orderSequence: sanitized.orderSequence,
        newsFeed: sanitized.newsFeed,
        lastOfflineSummary: st.lastOfflineSummary ?? null,
        lastOfflineProcessedTimestampISO:
          typeof st.lastOfflineProcessedTimestampISO === 'string' &&
          st.lastOfflineProcessedTimestampISO
            ? st.lastOfflineProcessedTimestampISO
            : fallbackTimestamp,
        lastOfflineSummaryDismissed:
          typeof st.lastOfflineSummaryDismissed === 'boolean'
            ? st.lastOfflineSummaryDismissed
            : true,
        centralLedger,
        activeLoans: Array.isArray(st.activeLoans) ? st.activeLoans : [],
        collaterals: Array.isArray(st.collaterals) ? st.collaterals : [],
        loanSequence:
          typeof st.loanSequence === 'number' &&
          Number.isFinite(st.loanSequence)
            ? Math.floor(st.loanSequence)
            : 0,
        projectSequence:
          typeof st.projectSequence === 'number' &&
          Number.isFinite(st.projectSequence)
            ? Math.floor(st.projectSequence)
            : 0,
        lastSimulationTickId:
          typeof st.lastSimulationTickId === 'string' && st.lastSimulationTickId
            ? st.lastSimulationTickId
            : `TICK-D${day}-M${totalElapsedGameMinutes}`,
        lastProcessedGameMinuteTotal:
          typeof st.lastProcessedGameMinuteTotal === 'number' &&
          Number.isFinite(st.lastProcessedGameMinuteTotal)
            ? st.lastProcessedGameMinuteTotal
            : totalElapsedGameMinutes,
        lastProcessedDayClose:
          typeof st.lastProcessedDayClose === 'number' &&
          Number.isFinite(st.lastProcessedDayClose)
            ? st.lastProcessedDayClose
            : Math.max(0, day - 1),
        lastFinancialIntegrityReport: st.lastFinancialIntegrityReport ?? null,
        cityState: SimulationStore.deriveOrMigrateCityState(st, day),
        tradeState: st.tradeState,
        decisionEvents: st.decisionEvents,
        wealthTax: st.wealthTax,
        balanceVersion: st.balanceVersion,
      };

      TradeAndShopEngine.ensureTradeUniverseState(migratedState);
      ensureDecisionState(migratedState);

      return {
        schemaVersion: SimulationStore.CURRENT_SCHEMA_VERSION,
        savedAtISO: fallbackTimestamp,
        seed: migratedState.seed,
        randomState: migratedState.randomState,
        state: migratedState,
      };
    } catch (err) {
      SimulationStore.reportError(
        'MIGRATION_ERROR',
        'Kayıt şeması yeni sürüme (v5) yükseltilirken hata oluştu.',
        err
      );
      return null;
    }
  }

  /**
   * localStorage'dan kayıtlı simülasyonu yükler; kayıt yoksa veya bozuksa mevcut kaydı silmeden null döndürür.
   */
  public static loadFromStorage(): SimulationEngine | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    let rawJson: string | null = null;
    try {
      rawJson = window.localStorage.getItem(SimulationStore.STORAGE_KEY);
    } catch (err) {
      SimulationStore.reportError(
        'RESTORE_ERROR',
        'Tarayıcı localStorage erişimi reddedildi.',
        err
      );
      return null;
    }

    if (!rawJson) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      SimulationStore.reportError(
        'PARSE_ERROR',
        'Kayıtlı oyun JSON verisi çözümlenemedi.',
        err
      );
      return null;
    }

    const migrated = SimulationStore.migrateIfNeeded(parsed);
    if (!migrated) {
      return null;
    }

    try {
      const stats = SimulationStore.lastMigrationStats;
      // Eski şemadan (v2/v3/v4) v5'e geçişten önce orijinal kaydın yedeğini oluştur
      if (
        stats &&
        stats.migratedFromVersion < SimulationStore.CURRENT_SCHEMA_VERSION
      ) {
        try {
          if (!window.localStorage.getItem(SimulationStore.BACKUP_V4_KEY)) {
            window.localStorage.setItem(SimulationStore.BACKUP_V4_KEY, rawJson);
          }
        } catch {
          // Yedekleme kotası hatası ana yüklemeyi engellememeli
        }
      }

      const engine = new SimulationEngine(
        migrated.seed,
        SimulationEngine.DEFAULT_INITIAL_CASH
      );
      engine.restoreFromSavedState(migrated.state);

      if (
        stats &&
        (stats.migratedFromVersion < SimulationStore.CURRENT_SCHEMA_VERSION ||
          stats.duplicateTransactionsFixedCount > 0 ||
          stats.duplicateOrdersFixedCount > 0 ||
          stats.companyValuationRebalanced)
      ) {
        const syncedEnvelope: SavedSimulationEnvelope = {
          ...migrated,
          state: JSON.parse(JSON.stringify(engine.getState())) as SimulationState,
        };
        try {
          window.localStorage.setItem(
            SimulationStore.STORAGE_KEY,
            JSON.stringify(syncedEnvelope)
          );
        } catch {
          // Depolama yazma hatası yüklemeyi engellememelidir
        }
      }

      return engine;
    } catch (err) {
      SimulationStore.reportError(
        'RESTORE_ERROR',
        'Kayıtlı simülasyon motoru durumu geri yüklenirken hata oluştu.',
        err
      );
      return null;
    }
  }

  private static sharedEngine: SimulationEngine | null = null;
  private static sharedCreationCount: number = 0;

  /**
   * Uygulama genelinde (hem PLAYER_GAME hem DEVELOPER_DASHBOARD ve StrictMode altında)
   * tek bir SimulationEngine örneği kullanılmasını garanti eder.
   */
  public static getSharedEngine(): SimulationEngine {
    if (!SimulationStore.sharedEngine) {
      const loaded = SimulationStore.loadFromStorage();
      if (loaded) {
        SimulationStore.sharedEngine = loaded;
      } else {
        const fresh = new SimulationEngine(
          SimulationEngine.DEFAULT_SEED,
          SimulationEngine.DEFAULT_INITIAL_CASH
        );
        SimulationStore.saveToStorage(fresh);
        SimulationStore.sharedEngine = fresh;
      }
      SimulationStore.sharedCreationCount += 1;
    }
    return SimulationStore.sharedEngine;
  }

  public static resetSharedEngine(): SimulationEngine {
    SimulationStore.clearStorage();
    const fresh = new SimulationEngine(
      SimulationEngine.DEFAULT_SEED,
      SimulationEngine.DEFAULT_INITIAL_CASH
    );
    SimulationStore.saveToStorage(fresh);
    SimulationStore.sharedEngine = fresh;
    SimulationStore.sharedCreationCount = 1;
    return fresh;
  }

  public static getSharedEngineCreationCount(): number {
    return SimulationStore.sharedCreationCount;
  }

  /**
   * Kayıtlı oyunu yalnızca kullanıcı açıkça sıfırlamak istediğinde localStorage'dan siler.
   */
  public static clearStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(SimulationStore.STORAGE_KEY);
      }
    } catch (err) {
      SimulationStore.reportError(
        'SAVE_ERROR',
        'Kayıtlı oyun sıfırlanırken depolama erişim hatası oluştu.',
        err
      );
    }
  }

  public static hasSavedGame(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      return Boolean(window.localStorage.getItem(SimulationStore.STORAGE_KEY));
    } catch {
      return false;
    }
  }
}

