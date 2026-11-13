/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  SimulationEngine,
  SimulationStage,
  SectorId,
  GameClockEngine,
  PendingOrderType,
  RealMinutesPerGameDayOption,
  TimeScaleOption,
  AccountingAuditResult,
} from './engine/SimulationEngine';
import {
  BankLoanBorrower,
  BankLoanType,
  CollateralAssetType,
  FinancialIntegrityAuditReport,
  InvestmentPackageType,
  LedgerAccountId,
  LedgerTransactionCategory,
} from './models/finance';
import {
  PaymentTermType,
  ShopType,
  VehicleTypeId,
} from './models/trade';
import { SimulationStore } from './state/simulationStore';
import { MarketTerminalView } from './components/MarketTerminalView';
import { CompanyIpoView } from './components/CompanyIpoView';
import { TakeoverHoldingView } from './components/TakeoverHoldingView';
import { MathAndSimulationLabView } from './components/MathAndSimulationLabView';
import { TycoonGameView } from './components/game/TycoonGameView';
import {
  AppViewMode,
  GameNotificationCategory,
  GameNotificationItem,
} from './components/game/gameTypes';
import {
  Clock,
  Compass,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  Save,
} from 'lucide-react';

type ActiveDeveloperTab = 'market' | 'company' | 'takeover' | 'math';

// React StrictMode altında gerçek zaman döngüsünün iki kez çalışmasını engelleyen modül kilidi
let activeRealtimeIntervalToken: number | null = null;

export default function App() {
  // Tekil (Singleton) SimulationEngine örneği: Görünüm geçişlerinde veya yeniden render'da asla ikinci örnek oluşturmaz
  const engineRef = useRef<SimulationEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = SimulationStore.getSharedEngine();
  }

  const [, setTickVersion] = useState(0);
  const [viewMode, setViewMode] = useState<AppViewMode>('PLAYER_GAME');
  const [activeTab, setActiveTab] = useState<ActiveDeveloperTab>('market');
  const [selectedTicker, setSelectedTicker] = useState<string>('NVEX');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  }>(() => {
    const st = engineRef.current!.getState();
    return {
      type: 'info',
      text: `Gün ${st.day} (${st.dateISO}) · Saat ${engineRef.current!.getFormattedGameTime()} · Toplam Net Varlık: ${engineRef.current!.formatCurrency(st.netWorth)} · Nakit: ${engineRef.current!.formatCurrency(st.cash)} · Otomatik kayıt aktif.`,
    };
  });
  const [consoleOutputLines, setConsoleOutputLines] = useState<string[]>([]);
  const [lastNonMutatingAuditResult, setLastNonMutatingAuditResult] = useState<{
    accountingAudit: AccountingAuditResult;
    financialIntegrityReport: FinancialIntegrityAuditReport;
  } | null>(null);
  const [notifications, setNotifications] = useState<GameNotificationItem[]>(
    () => {
      const st = engineRef.current!.getState();
      return [
        {
          id: 'INIT-WELCOME',
          category: 'NEW_DAY',
          title: 'Finans Şehrine Hoş Geldiniz',
          message: `Gün ${st.day} başladı. Başlangıç sermayeniz: ${engineRef.current!.formatCurrency(st.cash)}.`,
          day: st.day,
          gameTime: engineRef.current!.getFormattedGameTime(),
          severity: 'info',
          important: true,
          read: false,
        },
      ];
    }
  );

  const lastRealTickMsRef = useRef<number>(Date.now());
  const lastAutosaveRealMsRef = useRef<number>(Date.now());
  const notificationSeqRef = useRef<number>(1);

  // Engine olay farklarını (diff) izleyerek UI bildirimlerini otomatik üreten referans
  const prevSnapshotRef = useRef<{
    day: number;
    marketSession: string;
    stage2: boolean;
    stage3: boolean;
    stage4: boolean;
    newsTopId: string;
    dividendsTotal: number;
    orderStatuses: Record<string, string>;
    lowCashWarnedDay: number;
  }>({
    day: engineRef.current.getState().day,
    marketSession: engineRef.current.getState().marketSession,
    stage2: engineRef.current.getState().stageUnlocks.stage2Entrepreneur,
    stage3: engineRef.current.getState().stageUnlocks.stage3Ipo,
    stage4: engineRef.current.getState().stageUnlocks.stage4Holding,
    newsTopId: engineRef.current.getState().newsFeed[0]?.id || '',
    dividendsTotal: engineRef.current.getState().totalDividendsEarned,
    orderStatuses: Object.fromEntries(
      engineRef.current
        .getState()
        .pendingOrders.map((o) => [o.id, o.status])
    ),
    lowCashWarnedDay: 0,
  });

  const pushNotification = useCallback(
    (params: {
      category: GameNotificationCategory;
      title: string;
      message: string;
      severity: 'info' | 'success' | 'warning' | 'error';
      important?: boolean;
    }) => {
      const eng = engineRef.current!;
      const st = eng.getState();
      notificationSeqRef.current += 1;
      const seqStr = String(notificationSeqRef.current).padStart(8, '0');
      const item: GameNotificationItem = {
        id: `NOTIF-D${st.day}-M${st.totalElapsedGameMinutes}-S${seqStr}`,
        category: params.category,
        title: params.title,
        message: params.message,
        day: st.day,
        gameTime: eng.getFormattedGameTime(),
        severity: params.severity,
        important: params.important ?? true,
        read: false,
      };
      setNotifications((prev) => [item, ...prev.slice(0, 49)]);
    },
    []
  );

  const syncEngineEventsToNotifications = useCallback(() => {
    const eng = engineRef.current!;
    const st = eng.getState();
    const prev = prevSnapshotRef.current;
    const newItems: GameNotificationItem[] = [];
    const timeStr = eng.getFormattedGameTime();

    const addItem = (
      category: GameNotificationCategory,
      title: string,
      message: string,
      severity: 'info' | 'success' | 'warning' | 'error',
      important = true
    ) => {
      notificationSeqRef.current += 1;
      const seqStr = String(notificationSeqRef.current).padStart(8, '0');
      newItems.push({
        id: `EVT-D${st.day}-M${st.totalElapsedGameMinutes}-S${seqStr}`,
        category,
        title,
        message,
        day: st.day,
        gameTime: timeStr,
        severity,
        important,
        read: false,
      });
    };

    // 1. Yeni gün başlangıcı
    if (st.day > prev.day) {
      addItem(
        'NEW_DAY',
        `Yeni İş Günü (Gün ${st.day})`,
        `Gün ${st.day} (${st.dateISO}) başladı. Net Varlık: ${eng.formatCurrency(st.netWorth)}`,
        'info'
      );
      prev.day = st.day;
    }

    // 2. Emir durum değişimleri (FILLED, PARTIALLY_FILLED, CANCELLED, EXPIRED) - En üst öncelik
    for (const ord of st.pendingOrders) {
      const oldStatus = prev.orderStatuses[ord.id];
      if (oldStatus !== ord.status) {
        if (ord.status === 'FILLED') {
          addItem(
            'ORDER_FILLED',
            `Emir Gerçekleşti (${ord.ticker})`,
            `${ord.ticker} için ${ord.executedShares} lot ${ord.orderType} emri @ ${ord.averageExecutionPrice.toFixed(2)} TL fiyattan tamamlandı.`,
            'success'
          );
        } else if (ord.status === 'PARTIALLY_FILLED') {
          addItem(
            'ORDER_PARTIAL',
            `Kısmi Emir Dolumu (${ord.ticker})`,
            `${ord.ticker} emrinin ${ord.executedShares} lotluk kısmı gerçekleşti.`,
            'info'
          );
        } else if (ord.status === 'CANCELLED' && oldStatus !== undefined) {
          addItem(
            'ORDER_CANCELLED',
            `Emir İptal Edildi (${ord.ticker})`,
            `${ord.ticker} (${ord.orderType}) emri iptal edildi ve rezerv serbest bırakıldı.`,
            'warning'
          );
        } else if (ord.status === 'EXPIRED') {
          addItem(
            'ORDER_EXPIRED',
            `Emir Süresi Doldu (${ord.ticker})`,
            `${ord.ticker} (${ord.orderType}) emrinin vadesi doldu; bloke rezerv iade edildi.`,
            'warning'
          );
        }
        prev.orderStatuses[ord.id] = ord.status;
      }
    }

    // 3. Piyasa açılış / kapanış geçişleri
    if (st.marketSession !== prev.marketSession) {
      if (st.marketSession === 'MARKET_OPEN') {
        addItem(
          'MARKET_OPENED',
          'Piyasa ve Borsa Seansı Açıldı (10:00)',
          'Piyasa açıldı; Borsa İstanbul seansı ve bekleyen uygun emirler eşleştiriliyor.',
          'success'
        );
      } else if (
        prev.marketSession === 'MARKET_OPEN' &&
        st.marketSession === 'AFTER_HOURS'
      ) {
        addItem(
          'MARKET_CLOSED',
          'Piyasa ve Borsa Seansı Kapandı (18:00)',
          'Gün içi piyasa seansı tamamlandı; kapanış sonrası işlemlere geçildi.',
          'info'
        );
      }
      prev.marketSession = st.marketSession;
    }

    // 4. Temettü tahsilatı
    if (st.totalDividendsEarned > prev.dividendsTotal) {
      const delta = st.totalDividendsEarned - prev.dividendsTotal;
      addItem(
        'DIVIDEND_RECEIVED',
        'Temettü Tahsil Edildi',
        `Portföy hisselerinizden +${eng.formatCurrency(delta)} nakit temettü hesabınıza geçti.`,
        'success'
      );
      prev.dividendsTotal = st.totalDividendsEarned;
    }

    // 5. Yeni haber oluşumu
    const topNews = st.newsFeed[0];
    if (topNews && topNews.id !== prev.newsTopId) {
      addItem(
        'NEW_NEWS',
        `Yeni Bülten (${topNews.sector})`,
        topNews.headline,
        topNews.sentimentImpact >= 0 ? 'info' : 'warning',
        false
      );
      prev.newsTopId = topNews.id;
    }

    // 6. Aşama kilitlerinin açılması
    if (!prev.stage2 && st.stageUnlocks.stage2Entrepreneur) {
      addItem(
        'STAGE_UNLOCKED',
        'Aşama 2 Kilidi Açıldı: Girişimci!',
        'Şirket Arsası açıldı! Artık kendi anonim şirketinizi kurabilirsiniz.',
        'success'
      );
      prev.stage2 = true;
    }
    if (!prev.stage3 && st.stageUnlocks.stage3Ipo) {
      addItem(
        'STAGE_UNLOCKED',
        'Aşama 3 Kilidi Açıldı: Halka Arz (IPO)!',
        'Şirketiniz Borsa İstanbul’da halka arz edilmeye hak kazandı!',
        'success'
      );
      prev.stage3 = true;
    }
    if (!prev.stage4 && st.stageUnlocks.stage4Holding) {
      addItem(
        'STAGE_UNLOCKED',
        'Aşama 4 Kilidi Açıldı: Holding & Tekel!',
        'Holding Merkezi açıldı! Rakip şirketleri devralabilirsiniz.',
        'success'
      );
      prev.stage4 = true;
    }

    // 7. Şirket nakdi kritik seviye uyarısı
    if (
      st.playerCompany &&
      st.playerCompany.financials.cash < st.playerCompany.dailyOpex * 2 &&
      prev.lowCashWarnedDay !== st.day
    ) {
      addItem(
        'COMPANY_LOW_CASH',
        'Şirket Nakdi Kritik Seviyede!',
        `${st.playerCompany.name} kasasında yalnızca ${eng.formatCurrency(st.playerCompany.financials.cash)} kaldı.`,
        'warning'
      );
      prev.lowCashWarnedDay = st.day;
    }

    // 8. Muhasebe bütünlük uyarısı
    if (!st.lastIntegrityAudit.valid) {
      addItem(
        'ACCOUNTING_WARNING',
        'Muhasebe Bütünlük Uyarısı',
        st.lastIntegrityAudit.errors[0] || 'Bilanço denklik uyarısı tespit edildi.',
        'error'
      );
    }

    if (newItems.length > 0) {
      setNotifications((old) => [...newItems, ...old].slice(0, 50));
    }
  }, []);

  const refreshUIOnly = useCallback(() => {
    syncEngineEventsToNotifications();
    setTickVersion((v) => v + 1);
  }, [syncEngineEventsToNotifications]);

  const persistAndRefreshUI = useCallback(() => {
    const eng = engineRef.current!;
    SimulationStore.saveToStorage(eng);
    lastAutosaveRealMsRef.current = Date.now();
    syncEngineEventsToNotifications();
    setTickVersion((v) => v + 1);
  }, [syncEngineEventsToNotifications]);

  // Kontrollü Gerçek Zaman Döngüsü (React StrictMode Çift Çalışma Korumalı)
  useEffect(() => {
    const myToken = Date.now() + Math.random();
    activeRealtimeIntervalToken = myToken;
    lastRealTickMsRef.current = Date.now();

    const intervalId = window.setInterval(() => {
      if (activeRealtimeIntervalToken !== myToken) {
        return;
      }
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        return;
      }

      const engine = engineRef.current!;
      const st = engine.getState();
      const nowMs = Date.now();
      const deltaRealSeconds = Math.max(
        0,
        (nowMs - lastRealTickMsRef.current) / 1000
      );
      lastRealTickMsRef.current = nowMs;

      if (st.isPaused || st.timeScale === 0 || deltaRealSeconds <= 0) {
        return;
      }

      const { gameMinutesAdvanced, daysClosed } =
        engine.advanceRealSeconds(deltaRealSeconds);

      if (gameMinutesAdvanced > 0) {
        if (
          daysClosed > 0 ||
          nowMs - lastAutosaveRealMsRef.current >= 30_000
        ) {
          SimulationStore.saveToStorage(engine);
          lastAutosaveRealMsRef.current = nowMs;
        }
        syncEngineEventsToNotifications();
        setTickVersion((v) => v + 1);
      }
    }, 1000);

    const handleVisibilityChange = () => {
      const engine = engineRef.current!;
      if (document.visibilityState === 'hidden') {
        SimulationStore.saveToStorage(engine);
        lastAutosaveRealMsRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        lastRealTickMsRef.current = Date.now();
      }
    };

    const handleBeforeUnload = () => {
      SimulationStore.saveToStorage(engineRef.current!);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (activeRealtimeIntervalToken === myToken) {
        activeRealtimeIntervalToken = null;
      }
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [syncEngineEventsToNotifications]);

  const engine = engineRef.current!;
  const state = engine.getState();
  const formattedTime = engine.getFormattedGameTime();

  const handleMarkNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleDismissOfflineModal = useCallback(() => {
    engine.acknowledgeOfflineSummary();
    persistAndRefreshUI();
  }, [engine, persistAndRefreshUI]);

  const handleSetTimeScale = useCallback(
    (scale: TimeScaleOption) => {
      lastRealTickMsRef.current = Date.now();
      if (scale === 0) {
        engine.pauseSimulation();
        setStatusBanner({
          type: 'info',
          text: `Oyun saati duraklatıldı (Gün ${state.day} · Saat ${engine.getFormattedGameTime()}).`,
        });
      } else {
        engine.setTimeScale(scale);
        setStatusBanner({
          type: 'info',
          text: `Oyun hızı ${scale}x olarak ayarlandı (1 Oyun Günü = ${state.realMinutesPerGameDay} gerçek dk).`,
        });
      }
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI, state.day, state.realMinutesPerGameDay]
  );

  const handleSetRealMinutesPerDay = useCallback(
    (mins: RealMinutesPerGameDayOption) => {
      lastRealTickMsRef.current = Date.now();
      engine.setRealMinutesPerGameDay(mins);
      setStatusBanner({
        type: 'info',
        text: `1 oyun günü süresi ${mins} gerçek dakika olarak güncellendi.`,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleAdvanceToMarketOpen = useCallback(() => {
    lastRealTickMsRef.current = Date.now();
    const currentMin = engine.getState().minutesIntoCurrentDay;
    const deltaToOpen =
      currentMin < GameClockEngine.MARKET_OPEN_START_MINUTE
        ? GameClockEngine.MARKET_OPEN_START_MINUTE - currentMin
        : GameClockEngine.MINUTES_PER_GAME_DAY -
          currentMin +
          GameClockEngine.MARKET_OPEN_START_MINUTE;
    engine.advanceGameMinutes(deltaToOpen);
    setStatusBanner({
      type: 'success',
      text: `Oyun saati piyasa açılışına (${engine.getFormattedGameTime()} · PİYASA AÇIK) ilerletildi; bekleyen uygun emirler işlendi.`,
    });
    persistAndRefreshUI();
  }, [engine, persistAndRefreshUI]);

  const handleAdvanceOneHour = useCallback(() => {
    lastRealTickMsRef.current = Date.now();
    engine.advanceGameMinutes(60);
    setStatusBanner({
      type: 'info',
      text: `Oyun saati +1 saat ilerletildi → Gün ${engine.getState().day} · Saat ${engine.getFormattedGameTime()} (${GameClockEngine.getMarketSessionLabelTR(engine.getState().marketSession)}).`,
    });
    persistAndRefreshUI();
  }, [engine, persistAndRefreshUI]);

  const handleSimulateOfflineProgress = useCallback(() => {
    lastRealTickMsRef.current = Date.now();
    const curState = engine.getState();
    const baseMs = Math.max(
      Date.parse(curState.lastRealTimestampISO) || 0,
      Date.parse(curState.lastOfflineProcessedTimestampISO || '') || 0,
      Date.now()
    );
    const startISO = new Date(baseMs).toISOString();
    const endISO = new Date(
      baseMs + curState.realMinutesPerGameDay * 60 * 1000
    ).toISOString();
    const summary = engine.processOfflineProgress(startISO, endISO);
    setStatusBanner({
      type: 'success',
      text: `Çevrimdışı ilerleme tamamlandı: +${summary.gameMinutesAdvanced} oyun dk (${summary.gameDaysAdvanced} gün) · Gerçekleşen Emir: ${summary.ordersExecuted} · Net Varlık: ${engine.formatCurrency(summary.startNetWorth)} → ${engine.formatCurrency(summary.endNetWorth)}`,
    });
    persistAndRefreshUI();
  }, [engine, persistAndRefreshUI]);

  const handleTickDay = useCallback(() => {
    lastRealTickMsRef.current = Date.now();
    const log = engine.tickDay();
    setStatusBanner({
      type: 'info',
      text: `Gün ${log.day} (${log.dateISO}) tamamlandı · Manşet: "${log.headlineNews}" · Net Varlık: ${engine.formatCurrency(log.netWorth)}`,
    });
    persistAndRefreshUI();
  }, [engine, persistAndRefreshUI]);

  const handleTick5Days = useCallback(() => {
    lastRealTickMsRef.current = Date.now();
    const res = engine.advanceDaysWithoutPlayerDecisions(5, true);
    setStatusBanner({
      type: 'info',
      text: `5 İşlem Günü oyuncu adına otomatik karar verilmeden ilerletildi (Gün ${res.summary.endDay}) · Net Varlık: ${engine.formatCurrency(res.summary.endNetWorth)}`,
    });
    persistAndRefreshUI();
  }, [engine, persistAndRefreshUI]);

  const handlePlaceOrder = useCallback(
    (params: {
      ticker: string;
      orderType: PendingOrderType;
      requestedShares: number;
      limitPrice?: number;
    }) => {
      const res = engine.placeOrder(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      if (!res.success) {
        pushNotification({
          category: 'ORDER_CANCELLED',
          title: 'Emir Reddedildi',
          message: res.message,
          severity: 'error',
        });
      } else if (res.order && res.order.status === 'PENDING') {
        pushNotification({
          category: 'ORDER_PARTIAL',
          title: `Emir Kuyruğa Alındı (${res.order.ticker})`,
          message: res.message,
          severity: 'info',
        });
      }
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI, pushNotification]
  );

  const handleCancelOrder = useCallback(
    (orderId: string) => {
      const res = engine.cancelOrder(orderId);
      setStatusBanner({
        type: res.success ? 'info' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleBuyStock = useCallback(
    (ticker: string, shares: number) => {
      const res = engine.buyStock(ticker, shares);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      if (res.success) {
        pushNotification({
          category: 'ORDER_FILLED',
          title: `Hisse Alımı (${ticker})`,
          message: res.message,
          severity: 'success',
        });
      }
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI, pushNotification]
  );

  const handleSellStock = useCallback(
    (ticker: string, shares: number) => {
      const res = engine.sellStock(ticker, shares);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      if (res.success) {
        pushNotification({
          category: 'ORDER_FILLED',
          title: `Hisse Satışı (${ticker})`,
          message: res.message,
          severity: 'info',
        });
      }
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI, pushNotification]
  );

  const handleEstablishCompany = useCallback(
    (
      name: string,
      ticker: string,
      sector: SectorId,
      initialCapital: number,
      options: {
        initialStaffCount: number;
        initialRdBudget: number;
        initialCapacity: number;
      }
    ) => {
      const res = engine.establishCompany(
        name,
        ticker,
        sector,
        initialCapital,
        options
      );
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleTransferCapital = useCallback(
    (amount: number) => {
      const res = engine.transferCapitalToCompany(amount);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleConfigureOperations = useCallback(
    (params: {
      targetStaffCount?: number;
      targetProductionCapacity?: number;
      dailyRdBudget?: number;
      dailyMarketingBudget?: number;
      borrowLoanAmount?: number;
      unitSalePrice?: number;
      unitSellingPrice?: number;
      plannedProductionUnits?: number;
      shiftCount?: 1 | 2 | 3;
      shifts?: 1 | 2 | 3;
      salaryTier?: 'ECONOMY' | 'STANDARD' | 'COMPETITIVE';
      autoHireEnabled?: boolean;
      storageCapacityTarget?: number;
      workerCount?: number;
      engineerCount?: number;
      managerCount?: number;
      salesStaffCount?: number;
      averageMonthlyWage?: number;
      hrTrainingBudget?: number;
    }) => {
      const res = engine.configureCompanyOperations(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleExecuteMoneyTransfer = useCallback(
    (params: {
      sourceAccountId: LedgerAccountId;
      destinationAccountId: LedgerAccountId;
      amount: number;
      category: LedgerTransactionCategory;
      description: string;
      idempotencyKey?: string;
    }) => {
      const res = engine.executeMoneyTransfer(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleTakeOutBankLoan = useCallback(
    (params: {
      loanType: BankLoanType;
      principal: number;
      termInGameDays?: number;
      collateralIds?: string[];
      idempotencyKey?: string;
    }) => {
      const res = engine.takeOutBankLoan(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handlePayLoanInstallment = useCallback(
    (loanId: string) => {
      const res = engine.payLoanInstallment(loanId);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handlePayOffLoanEarly = useCallback(
    (loanId: string) => {
      const res = engine.payOffLoanEarly(loanId);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleStartInvestmentProject = useCallback(
    (params: {
      packageType: InvestmentPackageType;
      customCapacityGain?: number;
      budgetMaxMode?: boolean;
      fundingSource?: 'COMPANY_CASH' | 'BANK_LOAN';
    }) => {
      const res = engine.startCompanyInvestmentProject(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleCancelInvestmentProject = useCallback(
    (projectId: string) => {
      const res = engine.cancelCompanyInvestmentProject(projectId);
      setStatusBanner({
        type: res.success ? 'info' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleLiquidateInventory = useCallback(
    (unitsToSell: number, discountFraction: number) => {
      const res = engine.liquidateCompanyInventory(
        unitsToSell,
        discountFraction
      );
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleOpenShop = useCallback(
    (params: {
      shopType: ShopType;
      customName?: string;
      districtLabel?: string;
      initialCashFloat?: number;
    }) => {
      const res = engine.openShop(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleResolveDecision = useCallback(
    (choiceId: 'A' | 'B') => {
      const res = engine.resolveDecisionEvent(choiceId);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleShopManagerResult = useCallback(
    (res: { success: boolean; message: string }) => {
      setStatusBanner({ type: res.success ? 'success' : 'error', text: res.message });
      persistAndRefreshUI();
    },
    [persistAndRefreshUI]
  );
  const handleHireShopManager = useCallback(
    (shopId: string) => handleShopManagerResult(engine.hireShopManager(shopId)),
    [engine, handleShopManagerResult]
  );
  const handleFireShopManager = useCallback(
    (shopId: string) => handleShopManagerResult(engine.fireShopManager(shopId)),
    [engine, handleShopManagerResult]
  );
  const handleSetShopManagerSweep = useCallback(
    (shopId: string, on: boolean) => handleShopManagerResult(engine.setShopManagerSweep(shopId, on)),
    [engine, handleShopManagerResult]
  );

  const handleUpgradeShopLevel = useCallback(
    (shopId: string) => {
      const res = engine.upgradeShopLevel(shopId);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleTransferShopCash = useCallback(
    (params: {
      shopId: string;
      direction: 'TO_SHOP' | 'FROM_SHOP';
      amount: number;
    }) => {
      const res = engine.transferBetweenPersonalAndShopCash(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleConfigureShopParameters = useCallback(
    (params: {
      shopId: string;
      staffDelta?: number;
      priceMultipliers?: Record<string, number>;
      marketingBudgetDaily?: number;
    }) => {
      const res = engine.configureShopParameters(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handlePlaceProcurementOrder = useCallback(
    (params: {
      supplierId: string;
      resourceId: string;
      quantity: number;
      destinationType: 'WAREHOUSE' | 'SHOP';
      destinationId: string;
      paymentTermType: PaymentTermType;
    }) => {
      const res = engine.placeProcurementOrder(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleCancelProcurementOrder = useCallback(
    (orderId: string) => {
      const res = engine.cancelProcurementOrder(orderId);
      setStatusBanner({
        type: res.success ? 'info' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleCreatePurchaseContract = useCallback(
    (params: {
      supplierId: string;
      resourceId: string;
      dailyQuantity: number;
      durationDays: number;
      destinationType: 'WAREHOUSE' | 'SHOP';
      destinationId: string;
    }) => {
      const res = engine.createPurchaseContract(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleExecuteRecipeProduction = useCallback(
    (params: { recipeId: string; batchesCount: number }) => {
      const res = engine.executeRecipeProduction(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handlePurchaseLogisticsVehicle = useCallback(
    (vehicleType: VehicleTypeId) => {
      const res = engine.purchaseLogisticsVehicle(vehicleType);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleDispatchWarehouseToShop = useCallback(
    (params: {
      sourceWarehouseId: string;
      destinationShopId: string;
      resourceId: string;
      quantity: number;
      useOwnFleet?: boolean;
    }) => {
      const res = engine.dispatchWarehouseToShopShipment(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleAcceptCommercialContract = useCallback(
    (contractId: string) => {
      const res = engine.acceptCommercialContract(contractId);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleDeliverCommercialContract = useCallback(
    (params: {
      contractId: string;
      quantity: number;
      sourceType: 'WAREHOUSE' | 'SHOP';
      sourceId: string;
    }) => {
      const res = engine.deliverToCommercialContract(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleIncorporateShops = useCallback(
    (params: {
      companyName: string;
      ticker: string;
      sector: SectorId;
      additionalCashCapital?: number;
    }) => {
      const res = engine.incorporateShopsIntoCompany(params);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleRunNonMutatingEconomicAudit = useCallback(() => {
    const audit = engine.runFinancialIntegrityAuditNonMutating();
    setLastNonMutatingAuditResult(audit);
    setStatusBanner({
      type:
        audit.accountingAudit.valid && audit.financialIntegrityReport.valid
          ? 'success'
          : 'error',
      text: `Ekonomik Denetim Tamamlandı (Kaydı Değiştirmedi): Bilanço=${audit.accountingAudit.valid ? 'GEÇERLİ' : 'HATA'} · Merkezi Defter=${audit.financialIntegrityReport.valid ? 'GEÇERLİ' : 'HATA'} · Para Arzı=${engine.formatCurrency(audit.financialIntegrityReport.totalMoneySupply)}`,
    });
  }, [engine]);

  const handleExecuteIPO = useCallback(
    (floatRatio: number, discountRatio: number, primaryRatio: number) => {
      const res = engine.executeIPO(floatRatio, discountRatio, primaryRatio);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      if (res.success) {
        setSelectedTicker(res.ticker);
      }
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleExecuteTakeover = useCallback(
    (
      ticker: string,
      options: { targetOwnershipPct: number; useDebtFinancing: boolean }
    ) => {
      const res = engine.executeHostileTakeover(ticker, options);
      setStatusBanner({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      persistAndRefreshUI();
    },
    [engine, persistAndRefreshUI]
  );

  const handleRun30DaySimulation = useCallback(() => {
    const result = engine.runAutomatedStressScenario(30, false);
    setConsoleOutputLines(result.consoleLines);
    setStatusBanner({
      type: 'success',
      text: `30 Günlük Simülasyon tamamlandı (Gün ${result.summary.startDay} → ${result.summary.endDay})! Net Varlık: ${engine.formatCurrency(result.summary.startNetWorth)} → ${engine.formatCurrency(result.summary.endNetWorth)} (${result.summary.netWorthChange >= 0 ? '+' : ''}${result.summary.netWorthChangePct}%)`,
    });
    setActiveTab('math');
    persistAndRefreshUI();
  }, [engine, persistAndRefreshUI]);

  const handleManualSave = useCallback(() => {
    SimulationStore.saveToStorage(engineRef.current!);
    lastAutosaveRealMsRef.current = Date.now();
    setStatusBanner({
      type: 'success',
      text: `Oyun durumu (Gün ${engine.getState().day}, Saat ${engine.getFormattedGameTime()}, Net Varlık: ${engine.formatCurrency(engine.getState().netWorth)}) kalıcı olarak kaydedildi.`,
    });
    refreshUIOnly();
  }, [engine, refreshUIOnly]);

  const handleResetSimulation = useCallback(() => {
    const fresh = SimulationStore.resetSharedEngine();
    engineRef.current = fresh;
    lastRealTickMsRef.current = Date.now();
    lastAutosaveRealMsRef.current = Date.now();
    prevSnapshotRef.current = {
      day: 1,
      marketSession: 'MARKET_CLOSED',
      stage2: false,
      stage3: false,
      stage4: false,
      newsTopId: fresh.getState().newsFeed[0]?.id || '',
      dividendsTotal: 0,
      orderStatuses: {},
      lowCashWarnedDay: 0,
    };
    setConsoleOutputLines([]);
    setSelectedTicker('NVEX');
    notificationSeqRef.current += 1;
    const resetSeqStr = String(notificationSeqRef.current).padStart(8, '0');
    setNotifications([
      {
        id: `NOTIF-RESET-S${resetSeqStr}`,
        category: 'NEW_DAY',
        title: 'Yeni Oyun Başlatıldı',
        message:
          'Gün 1 · Saat 00:00 · Başlangıç Nakdi: ₺100.000 · Net Varlık: ₺100.000.',
        day: 1,
        gameTime: '00:00',
        severity: 'info',
        important: true,
        read: false,
      },
    ]);
    setStatusBanner({
      type: 'info',
      text: 'Yeni oyun başlatıldı: Gün 1 · Saat 00:00 · Nakit: ₺100.000 · Portföy: ₺0 · Toplam Net Varlık: ₺100.000 (Aşama 2, 3 ve 4 kilitli).',
    });
    setTickVersion((v) => v + 1);
  }, []);

  // 1. VARSAYILAN ANA OYUNCU GÖRÜNÜMÜ (PLAYER_GAME - Beyaz Mobil Tycoon Arayüzü)
  if (viewMode === 'PLAYER_GAME') {
    return (
      <TycoonGameView
        state={state}
        ipoEligibility={engine.checkIPOEligibility()}
        nextEvent={engine.getNextScheduledEvent()}
        notifications={notifications}
        onResolveDecision={handleResolveDecision}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        onSetTimeScale={handleSetTimeScale}
        onSetRealMinutesPerDay={handleSetRealMinutesPerDay}
        onAdvanceToMarketOpen={handleAdvanceToMarketOpen}
        onAdvanceOneHour={handleAdvanceOneHour}
        onTickDay={handleTickDay}
        onSimulateOfflineProgress={handleSimulateOfflineProgress}
        onManualSave={handleManualSave}
        onResetSimulation={handleResetSimulation}
        onDismissOfflineModal={handleDismissOfflineModal}
        onSwitchToDeveloperDashboard={() => setViewMode('DEVELOPER_DASHBOARD')}
        selectedTicker={selectedTicker}
        onSelectTicker={setSelectedTicker}
        onPlaceOrder={handlePlaceOrder}
        onCancelOrder={handleCancelOrder}
        onBuyStock={handleBuyStock}
        onSellStock={handleSellStock}
        onEstablishCompany={handleEstablishCompany}
        onTransferCapital={handleTransferCapital}
        onConfigureOperations={handleConfigureOperations}
        onExecuteIPO={handleExecuteIPO}
        onExecuteTakeover={handleExecuteTakeover}
        onExecuteMoneyTransfer={handleExecuteMoneyTransfer}
        onTakeOutBankLoan={handleTakeOutBankLoan}
        onPayLoanInstallment={handlePayLoanInstallment}
        onPayOffLoanEarly={handlePayOffLoanEarly}
        onStartInvestmentProject={handleStartInvestmentProject}
        onCancelInvestmentProject={handleCancelInvestmentProject}
        onLiquidateInventory={handleLiquidateInventory}
        onOpenShop={handleOpenShop}
        onUpgradeShopLevel={handleUpgradeShopLevel}
        onTransferShopCash={handleTransferShopCash}
        onConfigureShop={handleConfigureShopParameters}
        onPlaceProcurementOrder={handlePlaceProcurementOrder}
        onCancelProcurementOrder={handleCancelProcurementOrder}
        onCreatePurchaseContract={handleCreatePurchaseContract}
        onExecuteRecipeProduction={handleExecuteRecipeProduction}
        onPurchaseLogisticsVehicle={handlePurchaseLogisticsVehicle}
        onDispatchWarehouseToShop={handleDispatchWarehouseToShop}
        onAcceptCommercialContract={handleAcceptCommercialContract}
        onDeliverCommercialContract={handleDeliverCommercialContract}
        onIncorporateShopsIntoCompany={handleIncorporateShops}
        onHireShopManager={handleHireShopManager}
        onFireShopManager={handleFireShopManager}
        onSetShopManagerSweep={handleSetShopManagerSweep}
        spendableCash={engine.getSpendableCash()}
        reservedCash={engine.getReservedCash()}
        getReservedShares={(t) => engine.getReservedShares(t)}
        formattedTime={formattedTime}
        formatCurrency={(v) => engine.formatCurrency(v)}
      />
    );
  }

  // 2. GELİŞTİRİCİ PANELİ GÖRÜNÜMÜ (DEVELOPER_DASHBOARD - Mevcut Koyu Arayüz Korundu)
  const stagesList = [
    {
      id: SimulationStage.STAGE_1_RETAIL_INVESTOR,
      unlocked: state.stageUnlocks.stage1Retail,
      title: '01. Bireysel Yatırımcı',
      desc: '100.000 TL Başlangıç · GBM + Haber Duyarlılığı · Temettü',
    },
    {
      id: SimulationStage.STAGE_2_ENTREPRENEUR,
      unlocked: state.stageUnlocks.stage2Entrepreneur,
      title: '02. Girişimci (2M+ TL)',
      desc: 'Şirket Kurma · Çift Kayıt Sermaye · Ar-Ge & Üretim',
    },
    {
      id: SimulationStage.STAGE_3_IPO_PUBLIC,
      unlocked: state.stageUnlocks.stage3Ipo,
      title: '03. Halka Arz (IPO)',
      desc: '6 Kurumsal NPC Fon Talebi · Borsaya Kote Olma',
    },
    {
      id: SimulationStage.STAGE_4_HOLDING_MONOPOLY,
      unlocked: state.stageUnlocks.stage4Holding,
      title: '04. Holding & Tekel',
      desc: '%51+ Düşmanca Devralma (Takeover) · Sinerji Nakdi',
    },
  ];

  const privateCompanyEquity =
    state.playerCompany && !state.playerCompany.isPubliclyListed
      ? state.playerCompany.equityValue
      : 0;

  return (
    <div
      data-testid="developer-dashboard-view"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col"
    >
      {/* Top Bar Contract: Zone 1 (Brand) — Zone 2 (Nav Links) — Zone 3 (Primary Action) */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-900/90">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('market');
          }}
          className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          Borsa & Holding Simülatörü
        </a>

        <nav
          aria-label="Ana Navigasyon"
          className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400"
        >
          <button
            type="button"
            onClick={() => setActiveTab('market')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'market'
                ? 'text-slate-100 border-emerald-500'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Borsa & Portföy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'company'
                ? 'text-slate-100 border-emerald-500'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Şirket & Halka Arz
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('takeover')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'takeover'
                ? 'text-slate-100 border-emerald-500'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Holding & Devralma
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('math')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'math'
                ? 'text-slate-100 border-emerald-500'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            30 Günlük Simülasyon & Kod
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            data-testid="switch-to-player-game-btn"
            onClick={() => setViewMode('PLAYER_GAME')}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-500 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Oyun Dünyası</span>
          </button>
        </div>
      </header>

      {/* Ana İçerik Alanı */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Mobil Navigasyon Sekmeleri */}
        <div className="flex md:hidden items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('market')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
              activeTab === 'market'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400'
            }`}
          >
            Borsa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
              activeTab === 'company'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400'
            }`}
          >
            Şirket & IPO
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('takeover')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
              activeTab === 'takeover'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400'
            }`}
          >
            Devralma
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('math')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
              activeTab === 'math'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400'
            }`}
          >
            30 Gün Simülasyon
          </button>
        </div>

        {/* 4 Aşamalı İlerleme, Gerçek Zamanlı Saat ve Simülasyon Kontrol Çubuğu */}
        <section
          aria-label="Aşama İlerlemesi ve Finansal Özet"
          className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stagesList.map((st) => {
              const isCurrent = state.stage === st.id;
              const isUnlocked = st.unlocked;
              return (
                <div
                  key={st.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    isCurrent
                      ? 'bg-emerald-950/30 border-emerald-500/60'
                      : isUnlocked
                      ? 'bg-slate-950/80 border-slate-800'
                      : 'bg-slate-950/40 border-slate-800/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span
                      className={
                        isCurrent ? 'text-emerald-400' : 'text-slate-200'
                      }
                    >
                      {st.title}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {isCurrent ? 'AKTİF' : isUnlocked ? 'AÇIK' : 'KİLİTLİ'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{st.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Oyun Saati, Piyasa Seansı ve Hız Kontrol Alanı */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
              <span className="inline-flex items-center gap-1.5 text-slate-200 font-semibold">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                Tarih: {state.dateISO}
              </span>
              <span>·</span>
              <span
                className="text-slate-100 font-bold"
                data-testid="game-clock-display"
              >
                Saat: {formattedTime}
              </span>
              <span>·</span>
              <span
                data-testid="market-session-badge"
                className={`font-semibold ${
                  state.marketSession === 'MARKET_OPEN'
                    ? 'text-emerald-400'
                    : state.marketSession === 'PRE_OPEN'
                    ? 'text-sky-400'
                    : 'text-amber-400'
                }`}
              >
                {GameClockEngine.getMarketSessionLabelTR(state.marketSession)}
              </span>
              <span>·</span>
              <span className="text-slate-400">
                Hız: {state.isPaused ? 'DURAKLATILDI' : `${state.timeScale}x`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSetTimeScale(0)}
                className={`px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${
                  state.isPaused
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Pause className="w-3 h-3" />
                Duraklat
              </button>
              {([1, 2] as TimeScaleOption[]).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => handleSetTimeScale(sc)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold ${
                    !state.isPaused && state.timeScale === sc
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {sc}x
                </button>
              ))}

              <select
                aria-label="1 Oyun Günü Gerçek Dakika Süresi"
                value={state.realMinutesPerGameDay}
                onChange={(e) =>
                  handleSetRealMinutesPerDay(
                    Number(e.target.value) as RealMinutesPerGameDayOption
                  )
                }
                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono"
              >
                <option value={15}>1 Gün = 15 dk</option>
                <option value={30}>1 Gün = 30 dk</option>
                <option value={45}>1 Gün = 45 dk</option>
                <option value={60}>1 Gün = 60 dk</option>
              </select>

              <button
                type="button"
                onClick={handleAdvanceToMarketOpen}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded text-xs font-medium"
              >
                Piyasa Açılışına İlerlet (10:00)
              </button>
              <button
                type="button"
                onClick={handleAdvanceOneHour}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium"
              >
                +1 Saat
              </button>
              <button
                type="button"
                onClick={handleSimulateOfflineProgress}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-xs font-medium"
              >
                Çevrimdışı İlerleme Simüle Et
              </button>
            </div>
          </div>

          {/* Finansal KPI Strip & Hızlı Simülasyon Aksiyonları */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 text-xs flex-1">
              <div>
                <span className="text-slate-400">Simülasyon Günü</span>
                <div className="text-base font-bold font-mono tabular-nums text-slate-100 mt-0.5">
                  Gün {state.day}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Toplam Net Varlık</span>
                <div
                  data-testid="dev-net-worth"
                  className="text-base font-bold font-mono tabular-nums text-emerald-400 mt-0.5"
                >
                  {engine.formatCurrency(state.netWorth)}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Kullanılabilir Nakit</span>
                <div
                  data-testid="dev-cash"
                  className="text-base font-bold font-mono tabular-nums text-slate-100 mt-0.5"
                >
                  {engine.formatCurrency(state.cash)}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Portföy Piyasa Değeri</span>
                <div
                  data-testid="dev-portfolio-value"
                  className="text-base font-bold font-mono tabular-nums text-sky-400 mt-0.5"
                >
                  {engine.formatCurrency(state.portfolioValue)}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Özel Şirket Özkaynağı</span>
                <div className="text-base font-bold font-mono tabular-nums text-slate-200 mt-0.5">
                  {engine.formatCurrency(privateCompanyEquity)}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Temettü + Sinerji</span>
                <div className="text-base font-bold font-mono tabular-nums text-amber-400 mt-0.5">
                  {engine.formatCurrency(
                    state.totalDividendsEarned + state.totalSynergyEarned
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTickDay}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                +1 Gün İlerlet (tickDay)
              </button>
              <button
                type="button"
                onClick={handleTick5Days}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FastForward className="w-3.5 h-3.5" />
                +5 Gün İlerlet
              </button>
              <button
                type="button"
                onClick={handleRun30DaySimulation}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                30 Günlük Simülasyonu Koştur (Konsol)
              </button>
              <button
                type="button"
                onClick={handleManualSave}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                Kaydet
              </button>
              <button
                type="button"
                onClick={handleResetSimulation}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Sıfırla
              </button>
            </div>
          </div>
        </section>

        {/* Durum ve İşlem Bildirim Çubuğu */}
        <div
          role="status"
          className={`px-4 py-2.5 rounded-lg border text-xs flex items-center justify-between gap-4 ${
            statusBanner.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-800/70 text-emerald-200'
              : statusBanner.type === 'error'
              ? 'bg-rose-950/30 border-rose-800/70 text-rose-200'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <span>{statusBanner.text}</span>
          <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
            Endeks: {state.marketIndex.toFixed(1)}
          </span>
        </div>

        {/* Aktif Sekme Görünümü */}
        {activeTab === 'market' && (
          <MarketTerminalView
            stocks={state.stocks}
            portfolio={state.portfolio}
            pendingOrders={state.pendingOrders}
            cash={state.cash}
            spendableCash={engine.getSpendableCash()}
            reservedCash={engine.getReservedCash()}
            marketSession={state.marketSession}
            formattedGameTime={formattedTime}
            macro={state.macro}
            newsFeed={state.newsFeed}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onBuyStock={handleBuyStock}
            onSellStock={handleSellStock}
            onPlaceOrder={handlePlaceOrder}
            onCancelOrder={handleCancelOrder}
            getReservedShares={(t) => engine.getReservedShares(t)}
            formatCurrency={(v) => engine.formatCurrency(v)}
          />
        )}

        {activeTab === 'company' && (
          <CompanyIpoView
            playerCompany={state.playerCompany}
            ipoEligibility={engine.checkIPOEligibility()}
            cash={engine.getSpendableCash()}
            netWorth={state.netWorth}
            institutionalFunds={state.institutionalFunds}
            onEstablishCompany={handleEstablishCompany}
            onTransferCapital={handleTransferCapital}
            onConfigureOperations={handleConfigureOperations}
            onExecuteIPO={handleExecuteIPO}
            formatCurrency={(v) => engine.formatCurrency(v)}
          />
        )}

        {activeTab === 'takeover' && (
          <TakeoverHoldingView
            stocks={state.stocks}
            portfolio={state.portfolio}
            cash={engine.getSpendableCash()}
            totalDebt={state.totalDebt}
            controlledSubsidiaries={state.controlledSubsidiaries}
            totalSynergyEarned={state.totalSynergyEarned}
            onExecuteTakeover={handleExecuteTakeover}
            onBuyToeholdStake={handleBuyStock}
            formatCurrency={(v) => engine.formatCurrency(v)}
          />
        )}

        {activeTab === 'math' && (
          <MathAndSimulationLabView
            state={state}
            dailyLogs={state.dailyLogs}
            batchSummary={state.lastBatchSummary}
            integrityAudit={state.lastIntegrityAudit}
            consoleOutputLines={consoleOutputLines}
            onRun30DaySimulation={handleRun30DaySimulation}
            onRunFinancialIntegrityAudit={handleRunNonMutatingEconomicAudit}
            lastNonMutatingAuditResult={lastNonMutatingAuditResult}
            formatCurrency={(v) => engine.formatCurrency(v)}
          />
        )}
      </main>

      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500">
        Borsa & Holding Simülatörü · 16 NPC Şirketi · 8 Sektör · Gerçek Zamanlı Saat, Bekleyen Emirler, Çift Kayıt Bilanço, 5-Yöntem Değerleme ve Halka Arz (IPO)
      </footer>
    </div>
  );
}
