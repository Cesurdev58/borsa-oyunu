/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { effectiveRealMinutesPerGameDay, isFastStartOn } from '../../engine/TempoRules';
import { TEMPO_COMPANY_MINUTES, TEMPO_EARLY_MINUTES } from '../../data/gameBalance';
import { planShopRestock } from '../../engine/ShopRestockPlanner';
import { CelebrationOverlay } from './CelebrationOverlay';
import { RichListModal } from './RichListModal';
import { LifestyleModal } from './LifestyleModal';
import { CityServicesModal, type CityServiceHandlers } from './CityServicesModal';
import type { CityServiceId } from '../../data/cityServices';
import { PrestigeModal } from './PrestigeModal';
import { buildRichList, founderNameForTicker } from '../../engine/RichListEngine';
import { FirstRunGuide, type OnboardingAction } from './FirstRunGuide';
import { navTabStatuses, shopTabIndicators } from '../../engine/OnboardingRules';
import { firstShopGateStatus } from '../../engine/FirstShopGate';
import { anyOverlayOpen, welcomeGuideMayShow, type OverlayFlags, type OverlayId } from './ui/overlayCoordinator';
import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Code2,
  Compass,
  RotateCcw,
  Save,
  Settings,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  IPOEligibilityResult,
  OfflineProgressSummary,
  RealMinutesPerGameDayOption,
  SimulationState,
  TimeScaleOption,
} from '../../models/simulation';
import {
  UISettingsState,
  UISettingsStore,
} from '../../state/uiSettingsStore';
import {
  BuildingDetailActions,
  BuildingDetailContent,
  BuildingDetailSheet,
} from './BuildingDetailSheet';
import { isBuildingUnlocked } from './ui/buildingLocks';
import { GameSpeedControl } from './GameSpeedControl';
import { BACK_PRIORITY, createExitGuard, exitNativeApp, registerBackHandler } from '../../nativeBackButton';
import { needsStartCitySelection } from '../../engine/CityStartSelection';
import { isCitySelectionPending } from '../../engine/CityMigration';
import { CitySwitcher } from './ui/CitySwitcher';
import { CompanyCityCard } from './ui/CompanyCityCard';
import { companyBranchesInCity, resolveViewCity } from './ui/cityViewLogic';
import { CityQuestStrip } from './CityQuestStrip';
import { EventNotificationPanel } from './EventNotificationPanel';
import { GameBottomNavigation } from './GameBottomNavigation';
import { HowToPlayModal } from './HowToPlayModal';
import { GameTopBar } from './GameTopBar';
import { TurkeyMapFlow } from './turkeyMap/TurkeyMapFlow';
import type { ShopManageTab } from './turkeyMap/CityShopsScreen';
import type { CityId, TurkeyMapViewState } from '../../models/cities';
import type { ShopType } from '../../models/trade';
import { DecisionCard } from './DecisionCard';
import { DayReportCard } from './DayReportCard';
import { WorldEventCard } from './WorldEventCard';
import { play, setFeedbackSettings, vibrate } from './ui/feedback';
import {
  CityBuildingId,
  CompanySubTabRoute,
  GameBottomTab,
  GameNotificationItem,
} from './gameTypes';
import { OfflineProgressModal } from './OfflineProgressModal';
import { wealthTaxBase } from '../../engine/TaxRules';
import { WEALTH_TAX_ANNUAL_RATE, WEALTH_TAX_FREE_AMOUNT } from '../../data/gameBalance';

interface TycoonGameViewProps extends BuildingDetailActions, CityServiceHandlers {
  onResolveDecision?: (choiceId: 'A' | 'B') => void;
  /** Gösteriş harcaması (engine/LifestyleEngine.ts) */
  onBuyLifestyleItem?: (itemId: string) => void;
  /** Prestij: yeni şehirde başla (engine/PrestigeEngine.ts) */
  onStartNewCity?: () => void;
  /** Kariyer hedefinin ödülünü al (engine/CareerGoals.ts) */
  onClaimCareerGoal?: (goalId: string, hasOpenedBorsa: boolean) => void;
  /** Rehberin kayıtlı durumunu günceller (adım bitti, atla, yeniden başlat) */
  onUpdateOnboarding?: (action: OnboardingAction) => void;
  onSetTurkeyMapView?: (view: TurkeyMapViewState) => void;
  onSelectMapCity?: (cityId: CityId | undefined) => void;
  onOpenShopInCity?: (cityId: CityId, shopType: ShopType) => void;
  /** Şehir deposu kur (Harita → Şehir Mağazaları). */
  onBuildCityDepot?: (cityId: CityId) => void;
  state: SimulationState;
  ipoEligibility: IPOEligibilityResult;
  nextEvent: {
    eventLabelTR: string;
    remainingGameMinutes: number;
    formattedRemaining: string;
  };
  notifications: GameNotificationItem[];
  onMarkNotificationsRead: () => void;
  onSetTimeScale: (scale: TimeScaleOption) => void;
  onSetRealMinutesPerDay: (mins: RealMinutesPerGameDayOption) => void;
  /** Hızlı başlangıcı aç/kapat (kariyerin başında kısa günler). Verilmezse ayar gizlenir. */
  onSetFastStartTempo?: (on: boolean) => void;
  onAdvanceToMarketOpen: () => void;
  onAdvanceOneHour: () => void;
  onTickDay: () => void;
  onSimulateOfflineProgress: () => void;
  onManualSave: () => void;
  onResetSimulation: () => void;
  onDismissOfflineModal: () => void;
  onSwitchToDeveloperDashboard: () => void;
}

export const TycoonGameView: React.FC<TycoonGameViewProps> = ({
  state,
  ipoEligibility,
  nextEvent,
  notifications,
  onResolveDecision,
  onClaimCareerGoal,
  onUpdateOnboarding,
  onSetTurkeyMapView,
  onSelectMapCity,
  onOpenShopInCity,
  onBuildCityDepot,
  onBuyLifestyleItem,
  onSellShopStock,
  onBuyUsedUpgrade,
  onFundProject,
  onBuySolar,
  onTrainStaff,
  onSetInsurance,
  onSetCargo,
  onStartNewCity,
  onMarkNotificationsRead,
  onSetTimeScale,
  onSetRealMinutesPerDay,
  onSetFastStartTempo,
  onAdvanceToMarketOpen,
  onAdvanceOneHour,
  onTickDay,
  onSimulateOfflineProgress,
  onManualSave,
  onResetSimulation,
  onDismissOfflineModal,
  onSwitchToDeveloperDashboard,
  selectedTicker,
  onSelectTicker,
  onPlaceOrder,
  onCancelOrder,
  onBuyStock,
  onSellStock,
  onEstablishCompany,
  onTransferCapital,
  onConfigureOperations,
  onExecuteIPO,
  onExecuteTakeover,
  onExecuteMoneyTransfer,
  onTakeOutBankLoan,
  onPayLoanInstallment,
  onPayOffLoanEarly,
  onStartInvestmentProject,
  onCancelInvestmentProject,
  onLiquidateInventory,
  onOpenShop,
  onUpgradeShopLevel,
  onTransferShopCash,
  onConfigureShop,
  onPlaceProcurementOrder,
  onCancelProcurementOrder,
  onCreatePurchaseContract,
  onExecuteRecipeProduction,
  onPurchaseLogisticsVehicle,
  onDispatchWarehouseToShop,
  onAcceptCommercialContract,
  onDeliverCommercialContract,
  onIncorporateShopsIntoCompany,
  onHireShopManager,
  onHireFirstEmployee,
  onBuyShopUpgrade,
  onHirePortfolioManager,
  onConfigureAutoInvest,
  onFireShopManager,
  onSetShopManagerSweep,
  spendableCash,
  freeSpendableCash,
  reservedCash,
  getReservedShares,
  formattedTime,
  formatCurrency,
}) => {
  const [showFactoryDetails, setShowFactoryDetails] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpenRaw] = useState(false);
  // Şehir Mağazaları ekranından belirli bir dükkânın yönetimini açma isteği.
  const [manageRequest, setManageRequest] = useState<{ shopId: string; tab?: ShopManageTab; nonce: number } | null>(null);
  const [activeBottomTab, setActiveBottomTab] =
    useState<GameBottomTab>('city');
  const [selectedBuildingId, setSelectedBuildingIdRaw] =
    useState<CityBuildingId | null>(null);
  // Dükkân ve Şirket sekmelerindeki şehir seçicinin seçili şehri (boşsa merkez şehir).
  const [viewCityId, setViewCityId] = useState<CityId | null>(null);
  const [initialCompanySubTab, setInitialCompanySubTab] =
    useState<CompanySubTabRoute>('OZET');
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpenRaw] =
    useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpenRaw] = useState(false);
  const [isRichListOpen, setIsRichListOpenRaw] = useState(false);
  const [isLifestyleOpen, setIsLifestyleOpenRaw] = useState(false);
  const [openCityService, setOpenCityServiceRaw] = useState<CityServiceId | null>(null);
  const [isPrestigeOpen, setIsPrestigeOpenRaw] = useState(false);

  // Pencere koordinasyonu (plan 4-H): biri açılırken diğerleri kapanır; üst üste açılmaz.
  const closeOverlaysExcept = (keep: OverlayId) => {
    if (keep !== 'guide') setIsGuideOpenRaw(false);
    if (keep !== 'settings') setIsSettingsModalOpenRaw(false);
    if (keep !== 'notifications') setIsNotificationDrawerOpenRaw(false);
    if (keep !== 'building') setSelectedBuildingIdRaw(null);
    if (keep !== 'richList') setIsRichListOpenRaw(false);
    if (keep !== 'lifestyle') setIsLifestyleOpenRaw(false);
    if (keep !== 'cityService') setOpenCityServiceRaw(null);
    if (keep !== 'prestige') setIsPrestigeOpenRaw(false);
  };
  const setIsGuideOpen = (v: boolean) => { if (v) closeOverlaysExcept('guide'); setIsGuideOpenRaw(v); };
  const setSelectedBuildingId = (v: CityBuildingId | null) => { if (v) closeOverlaysExcept('building'); setSelectedBuildingIdRaw(v); };
  const setIsNotificationDrawerOpen = (v: boolean) => { if (v) closeOverlaysExcept('notifications'); setIsNotificationDrawerOpenRaw(v); };
  const setIsSettingsModalOpen = (v: boolean) => { if (v) closeOverlaysExcept('settings'); setIsSettingsModalOpenRaw(v); };
  const setIsRichListOpen = (v: boolean) => { if (v) closeOverlaysExcept('richList'); setIsRichListOpenRaw(v); };
  const setIsLifestyleOpen = (v: boolean) => { if (v) closeOverlaysExcept('lifestyle'); setIsLifestyleOpenRaw(v); };
  const setOpenCityService = (v: CityServiceId | null) => { if (v) closeOverlaysExcept('cityService'); setOpenCityServiceRaw(v); };
  const setIsPrestigeOpen = (v: boolean) => { if (v) closeOverlaysExcept('prestige'); setIsPrestigeOpenRaw(v); };
  const overlayFlags: OverlayFlags = {
    guide: isGuideOpen,
    settings: isSettingsModalOpen,
    notifications: isNotificationDrawerOpen,
    building: selectedBuildingId !== null,
    richList: isRichListOpen,
    lifestyle: isLifestyleOpen,
    cityService: openCityService !== null,
    prestige: isPrestigeOpen,
  };
  const overlayOpen = anyOverlayOpen(overlayFlags);

  // Geri tuşu: açık pencereyi kapatır (sayfadan çıkmaz)
  const overlayPushedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (overlayOpen && !overlayPushedRef.current) {
      overlayPushedRef.current = true;
      window.history.pushState({ gameOverlay: true }, '');
    } else if (!overlayOpen && overlayPushedRef.current) {
      overlayPushedRef.current = false;
      if (window.history.state?.gameOverlay) window.history.back();
    }
  }, [overlayOpen]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      if (overlayPushedRef.current) {
        overlayPushedRef.current = false;
        closeOverlaysExcept('guide');
        setIsGuideOpenRaw(false);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
  // Android donanım geri tuşu kuralları (nativeBackButton.ts): pencere → harita (TurkeyMapFlow) → Harita sekmesi → çıkış
  const [exitToastVisible, setExitToastVisible] = useState(false);
  const exitGuardRef = useRef(createExitGuard());
  const exitToastTimerRef = useRef<number | null>(null);
  const nativeBackRef = useRef<Record<'overlay' | 'tab' | 'exit', () => boolean>>({
    overlay: () => false,
    tab: () => false,
    exit: () => false,
  });
  nativeBackRef.current = {
    overlay: () => {
      if (!overlayOpen) return false;
      setResetConfirmOpen(false);
      setIsGuideOpenRaw(false);
      setIsSettingsModalOpenRaw(false);
      setIsNotificationDrawerOpenRaw(false);
      setSelectedBuildingIdRaw(null);
      setIsRichListOpenRaw(false);
      setIsLifestyleOpenRaw(false);
      setOpenCityServiceRaw(null);
      setIsPrestigeOpenRaw(false);
      return true;
    },
    tab: () => {
      if (activeBottomTab === 'city') return false;
      handleSelectTab('city');
      return true;
    },
    exit: () => {
      if (exitGuardRef.current.press() === 'exit') {
        void exitNativeApp();
        return true;
      }
      setExitToastVisible(true);
      if (exitToastTimerRef.current !== null) window.clearTimeout(exitToastTimerRef.current);
      exitToastTimerRef.current = window.setTimeout(() => setExitToastVisible(false), 2000);
      return true;
    },
  };
  useEffect(() => {
    const offs = [
      registerBackHandler(BACK_PRIORITY.overlay, () => nativeBackRef.current.overlay()),
      registerBackHandler(BACK_PRIORITY.tab, () => nativeBackRef.current.tab()),
      registerBackHandler(BACK_PRIORITY.exit, () => nativeBackRef.current.exit()),
    ];
    return () => {
      offs.forEach((off) => off());
      if (exitToastTimerRef.current !== null) window.clearTimeout(exitToastTimerRef.current);
    };
  }, []);

  // Zenginler listesi sırası (her çizimde hesaplanır; 29 kişilik küçük liste)
  const richRank = buildRichList(state).playerRank;

  // Kalıcı UI Ayarları (Grafik Kalitesi, Ses Yöneticisi, Kamera Konumu ve İlk Görev Takibi — ekonomik state'ten bağımsız)
  const [uiSettings, setUiSettings] = useState<UISettingsState>(() =>
    UISettingsStore.loadSettings()
  );

  // Borsa sekmesine girmek de "Borsa binasını aç" hedefini tamamlar.
  useEffect(() => {
    if (activeBottomTab === 'market' && !uiSettings.hasOpenedBorsaBuilding) {
      setUiSettings(UISettingsStore.markBorsaBuildingOpened());
    }
  }, [activeBottomTab, uiSettings.hasOpenedBorsaBuilding]);

  // Ses/titreşim ayarlarını uygula; oyun düğmelerine basınca kısa "tık" sesi çal.
  useEffect(() => {
    setFeedbackSettings(uiSettings.audio);
  }, [uiSettings.audio]);
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('button, [role="button"]');
      if (!el || (el as HTMLButtonElement).disabled) return;
      if (el.classList.contains('g-btn-primary') || el.classList.contains('g-btn-gold')) {
        play('coin');
      } else {
        play('tap');
      }
      vibrate(6);
    };
    window.addEventListener('pointerdown', onPointer, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointer);
  }, []);

  // Panel açıkken isteğe bağlı otomatik duraklatma ayarı (Varsayılan: kapalı)
  const autoPauseOnSheetOpen = uiSettings.autoPauseOnSheetOpen === true;
  const prevScaleBeforeSheetRef = useRef<TimeScaleOption | null>(null);
  // Hız kapsülü: duraklatmadan önceki hızı hatırlar (state yerinde güncellendiği için ref ile)
  const lastRunningScaleRef = useRef<TimeScaleOption>(1);
  if (state.timeScale > 0) lastRunningScaleRef.current = state.timeScale;

  // Not: `state` bellekte yerinde güncellenir (aynı referans), bu yüzden useMemo kullanılmaz.
  const activePendingOrders = state.pendingOrders.filter(
    (o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED'
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Servet vergisi: nakit + hisse eşiğin %75'ini geçince ya da vergi ödenmişse bilgi göster
  const wealthBase = wealthTaxBase(state);
  const wealthTaxNote =
    wealthBase >= WEALTH_TAX_FREE_AMOUNT * 0.75 || (state.wealthTax?.totalPaid ?? 0) > 0
      ? `Servet vergisi: nakit ve hisselerinin ${formatCurrency(WEALTH_TAX_FREE_AMOUNT)} üstü için yılda %${Math.round(
          WEALTH_TAX_ANNUAL_RATE * 100
        )}, 30 günde bir alınır.${
          state.wealthTax?.lastAmount ? ` Son: ${formatCurrency(state.wealthTax.lastAmount)}.` : ''
        }`
      : undefined;

  const handleUpdateAudioSetting = useCallback(
    (patch: Partial<UISettingsState['audio']>) => {
      const next = UISettingsStore.updateAudio(patch);
      setUiSettings(next);
    },
    []
  );

  const handleOpenBuildingDetailSheet = useCallback(
    (id: CityBuildingId, companySubTab?: CompanySubTabRoute) => {
      if (companySubTab) {
        setInitialCompanySubTab(companySubTab);
      }
      // Banka artık alt menüde kendi sekmesidir; sekme görünürse bina paneli yerine ona geçilir.
      if (id === 'BANKA' && navTabStatuses(state).bank.mode === 'active') {
        setSelectedBuildingId(null);
        setActiveBottomTab('bank');
        return;
      }
      // Kilitli binalar işlem ekranını açmaz
      if (!isBuildingUnlocked(state, id)) {
        setSelectedBuildingId(null);
        return;
      }

      setSelectedBuildingId(id);
      if (id === 'BORSA') {
        const next = UISettingsStore.markBorsaBuildingOpened();
        setUiSettings(next);
      }
      if (autoPauseOnSheetOpen && !state.isPaused) {
        prevScaleBeforeSheetRef.current = state.timeScale;
        onSetTimeScale(0);
      }
    },
    [
      autoPauseOnSheetOpen,
      onSetTimeScale,
      state,
      state.isPaused,
      state.timeScale,
    ]
  );

  const handleCloseBuildingSheet = useCallback(() => {
    setSelectedBuildingId(null);
    if (
      autoPauseOnSheetOpen &&
      prevScaleBeforeSheetRef.current !== null &&
      prevScaleBeforeSheetRef.current > 0
    ) {
      onSetTimeScale(prevScaleBeforeSheetRef.current);
      prevScaleBeforeSheetRef.current = null;
    }
  }, [autoPauseOnSheetOpen, onSetTimeScale]);

  const handleOpenNotifications = useCallback(() => {
    setIsNotificationDrawerOpen(true);
    onMarkNotificationsRead();
  }, [onMarkNotificationsRead]);

  const handleCloseNotifications = useCallback(() => {
    setIsNotificationDrawerOpen(false);
  }, []);

  const tabStatuses = navTabStatuses(state);
  const shopIndicators = shopTabIndicators(state);
  const hasShop = shopIndicators.ownedShopCount > 0;
  const handleSelectTab = useCallback(
    (tab: GameBottomTab) => {
      // Kilitli ya da gizli sekme panel açmaz (eski çağrılar, rehber düğmeleri için de geçerli)
      if (tabStatuses[tab].mode !== 'active') return;
      setActiveBottomTab(tab);
    },
    [tabStatuses]
  );

  const offlineModalOpen = Boolean(
    state.lastOfflineSummary &&
      !state.lastOfflineSummaryDismissed &&
      state.lastOfflineSummary.gameMinutesAdvanced > 0
  );

  const handleRestockShop = useCallback(
    (shopId: string) => {
      const shop = state.tradeState?.shops.find((sh) => sh.shopId === shopId);
      if (!shop || !sharedActions.onPlaceProcurementOrder) return;
      const plan = planShopRestock(
        state,
        shopId,
        state.cash + shop.cashAccountBalance
      );
      for (const o of plan.orders) {
        sharedActions.onPlaceProcurementOrder({
          supplierId: o.supplierId,
          resourceId: o.resourceId,
          quantity: o.quantity,
          destinationType: 'SHOP',
          destinationId: shopId,
          paymentTermType: 'CASH',
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]
  );

  const sharedActions: BuildingDetailActions = {
    selectedTicker,
    onSelectTicker,
    onPlaceOrder,
    onCancelOrder,
    onBuyStock,
    onSellStock,
    onEstablishCompany,
    onTransferCapital,
    onConfigureOperations,
    onExecuteIPO,
    onExecuteTakeover,
    onExecuteMoneyTransfer,
    onTakeOutBankLoan,
    onPayLoanInstallment,
    onPayOffLoanEarly,
    onStartInvestmentProject,
    onCancelInvestmentProject,
    onLiquidateInventory,
    onOpenShop,
    onUpgradeShopLevel,
    onTransferShopCash,
    onConfigureShop,
    onPlaceProcurementOrder,
    onCancelProcurementOrder,
    onCreatePurchaseContract,
    onExecuteRecipeProduction,
    onPurchaseLogisticsVehicle,
    onDispatchWarehouseToShop,
    onAcceptCommercialContract,
    onDeliverCommercialContract,
    onIncorporateShopsIntoCompany,
  onHireShopManager,
  onHireFirstEmployee,
  onBuyShopUpgrade,
  onHirePortfolioManager,
  onConfigureAutoInvest,
  onFireShopManager,
  onSetShopManagerSweep,
    spendableCash,
    freeSpendableCash,
    reservedCash,
    getReservedShares,
    ipoEligibility,
    formattedTime,
    formatCurrency,
    viewCityId,
    onChangeViewCity: setViewCityId,
    onOpenCityService: setOpenCityService,
  };

  return (
    <div
      data-testid="tycoon-game-view"
      className="min-h-[100dvh] w-full overflow-x-clip bg-[var(--g-bg)] text-[var(--g-ink)] flex flex-col justify-between"
    >
      <CelebrationOverlay
        shopCount={state.tradeState?.shops.length ?? 0}
        stage={state.stage}
        richRank={richRank}
        takeovers={state.stocks
          .filter((s) => s.isControlledByPlayer && !s.isPlayerCompany)
          .map((s) => ({
            ticker: s.ticker,
            company: s.name.split(' ')[0],
            founder: founderNameForTicker(state.stocks, s.ticker) ?? 'Kurucusu',
          }))}
      />
      {/* "Tekrar hoş geldin" penceresi açıkken karar kartı onun üstüne binmez; kart kayıtta bekler */}
      {!offlineModalOpen && (
        <DecisionCard
          state={state}
          reservedCash={Math.max(0, state.cash - spendableCash)}
          onResolve={onResolveDecision}
        />
      )}
      <WorldEventCard
        worldEvents={state.worldEvents}
        day={state.day}
        onOpenNews={() => setActiveBottomTab('news')}
      />
      <DayReportCard
        report={state.lastDayReport}
        enabled={uiSettings.showDayReport !== false}
        formatCurrency={formatCurrency}
      />
      <FirstRunGuide
        state={state}
        activeTab={activeBottomTab}
        onboarding={state.onboarding}
        formatCurrency={formatCurrency}
        blocked={!welcomeGuideMayShow(overlayFlags, offlineModalOpen)}
        onAction={(a) => onUpdateOnboarding?.(a)}
        onSelectTab={handleSelectTab}
        timeScale={state.timeScale}
        onSetTimeScale={onSetTimeScale}
      />

      {/* 1. ÜST HUD (Aşama, Gün, Saat, Kısaltılmış Nakit & Net Varlık, Piyasa Durumu, Bildirim ve Ayarlar) */}
      <GameTopBar
        day={state.day}
        stage={state.stage}
        dateISO={state.dateISO}
        formattedTime={formattedTime}
        marketSession={state.marketSession}
        cash={state.cash}
        netWorth={state.netWorth}
        unreadNotificationsCount={unreadNotificationsCount}
        wealthTaxNote={wealthTaxNote}
        onOpenNotifications={handleOpenNotifications}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        simpleMode={!hasShop}
        richRank={hasShop ? richRank : undefined}
        onOpenRichList={() => setIsRichListOpen(true)}
        reputation={hasShop ? state.tradeState?.tradeReputationScore : undefined}
        onOpenLifestyle={() => setIsLifestyleOpen(true)}
        onSwitchToDeveloperDashboard={onSwitchToDeveloperDashboard}
        formatCurrency={formatCurrency}
      />

      {/* 2. ORTA ANA OYUN ALANI (Tek Hedefli Görev Şeridi + İzometrik 2.5D Mahalle veya Seçili Sekme) */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 pt-3 pb-4 space-y-3">
        {/* Tek Hedefli Görev / İlerleme Şeridi */}
        <CityQuestStrip
          state={state}
          hasOpenedBorsaBuilding={uiSettings.hasOpenedBorsaBuilding}
          onOpenBuilding={(id) =>
            (id as string) === 'LUKS' ? setIsLifestyleOpen(true) : handleOpenBuildingDetailSheet(id)
          }
          onClaimQuest={
            onClaimCareerGoal
              ? (id) => {
                  play('coin');
                  onClaimCareerGoal(id, Boolean(uiSettings.hasOpenedBorsaBuilding));
                }
              : undefined
          }
          onOpenRichList={() => setIsRichListOpen(true)}
        />
        <RichListModal
          open={isRichListOpen}
          state={state}
          onClose={() => setIsRichListOpen(false)}
          onOpenPrestige={() => {
            setIsRichListOpen(false);
            setIsPrestigeOpen(true);
          }}
        />
        <PrestigeModal
          open={isPrestigeOpen}
          state={state}
          formatCurrency={formatCurrency}
          onStartNewCity={onStartNewCity}
          onClose={() => setIsPrestigeOpen(false)}
        />
        <CityServicesModal
          service={openCityService}
          state={state}
          spendableCash={freeSpendableCash ?? spendableCash}
          formatCurrency={formatCurrency}
          onSellShopStock={onSellShopStock}
          onBuyUsedUpgrade={onBuyUsedUpgrade}
          onFundProject={onFundProject}
          onBuySolar={onBuySolar}
          onTrainStaff={onTrainStaff}
          onSetInsurance={onSetInsurance}
          onSetCargo={onSetCargo}
          onClose={() => setOpenCityService(null)}
        />
        <LifestyleModal
          open={isLifestyleOpen}
          state={state}
          spendableCash={freeSpendableCash ?? spendableCash}
          formatCurrency={formatCurrency}
          onBuy={onBuyLifestyleItem}
          onClose={() => setIsLifestyleOpen(false)}
        />

        {activeBottomTab === 'city' ? (
          onSetTurkeyMapView && onSelectMapCity && onOpenShopInCity ? (
            <TurkeyMapFlow
              state={state}
              formatCurrency={formatCurrency}
              reservedCash={reservedCash}
              detailOpen={selectedBuildingId !== null}
              onSetMapView={onSetTurkeyMapView}
              onSelectMapCity={onSelectMapCity}
              onOpenShopInCity={onOpenShopInCity}
              onBuildCityDepot={onBuildCityDepot}
              onManageShop={(shopId, tab) => {
                setManageRequest({ shopId, tab, nonce: Date.now() });
                setSelectedBuildingId('OYUNCU_OFISI');
              }}
            />
          ) : (
            <div data-testid="turkey-map-unavailable" className="g-card p-4 text-center font-bold text-[var(--g-muted)]">
              Harita şu an açılamıyor.
            </div>
          )
        ) : (
          <section
            key={activeBottomTab}
            aria-label={`Aktif Sekme: ${activeBottomTab}`}
            className="g-rise space-y-3"
          >
            <h2 className="g-display text-[26px] font-extrabold leading-none text-[var(--g-ink)] px-1 pt-1">
              {activeBottomTab === 'market' && 'Borsa'}
              {activeBottomTab === 'company' && 'Şirketim'}
              {activeBottomTab === 'bank' && 'Banka'}
              {activeBottomTab === 'news' && 'Haberler'}
              {activeBottomTab === 'portfolio' && 'Dükkânlarım'}
            </h2>

            {activeBottomTab === 'market' && (
              <BuildingDetailContent
                {...sharedActions}
                buildingId="BORSA"
                state={state}
                onOpenBuilding={handleOpenBuildingDetailSheet}
              />
            )}

            {activeBottomTab === 'company' && (
              <div className="space-y-4">
                {(state.playerCompany !== null ||
                  companyBranchesInCity(state, resolveViewCity(state, viewCityId)).length > 0) && (
                  <div className="space-y-2">
                    <CitySwitcher state={state} scope="company" value={viewCityId} onChange={setViewCityId} />
                    <CompanyCityCard
                      state={state}
                      cityId={resolveViewCity(state, viewCityId)}
                      formatCurrency={formatCurrency}
                    />
                  </div>
                )}
                <BuildingDetailContent
                  {...sharedActions}
                  buildingId="SIRKET_MERKEZI"
                  state={state}
                  initialCompanySubTab={initialCompanySubTab}
                  onOpenBuilding={handleOpenBuildingDetailSheet}
                />
                {state.playerCompany && (
                  <>
                    <button
                      type="button"
                      data-testid="company-factory-toggle"
                      onClick={() => setShowFactoryDetails((v) => !v)}
                      className="g-btn g-btn-secondary w-full"
                    >
                      {showFactoryDetails
                        ? '▲ Fabrika ve Ar-Ge ayrıntılarını gizle'
                        : 'Fabrika, depo ve Ar-Ge'}
                    </button>
                    <div className={showFactoryDetails ? 'space-y-4' : 'hidden'}>
                      <div className="pt-3 border-t border-slate-200">
                        <h3 className="g-section-title mb-2">
                          Fabrika
                        </h3>
                        <BuildingDetailContent
                          {...sharedActions}
                          buildingId="FABRIKA"
                          state={state}
                        />
                      </div>
                      <div className="pt-3 border-t border-slate-200">
                        <h3 className="g-section-title mb-2">
                          Ar-Ge
                        </h3>
                        <BuildingDetailContent
                          {...sharedActions}
                          buildingId="ARGE_MERKEZI"
                          state={state}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeBottomTab === 'bank' && (
              <BuildingDetailContent
                {...sharedActions}
                buildingId="BANKA"
                state={state}
              />
            )}

            {activeBottomTab === 'news' && (
              <BuildingDetailContent
                {...sharedActions}
                buildingId="HABER_MERKEZI"
                state={state}
              />
            )}

            {activeBottomTab === 'portfolio' && (
              <BuildingDetailContent
                {...sharedActions}
                buildingId="OYUNCU_OFISI"
                state={state}
              />
            )}
          </section>
        )}

        {/* 3. KOMPAKT OLAY / BİLDİRİM SATIRI */}
        <EventNotificationPanel
          notifications={notifications}
          isDrawerOpen={isNotificationDrawerOpen}
          onOpenDrawer={handleOpenNotifications}
          onCloseDrawer={handleCloseNotifications}
          onMarkAllRead={onMarkNotificationsRead}
        />
      </main>

      {exitToastVisible && (
        <div
          role="status"
          data-testid="exit-toast"
          className="fixed left-1/2 bottom-[96px] z-50 -translate-x-1/2 rounded-full bg-[var(--g-navy-900)] px-4 py-2.5 text-[14px] font-bold text-white shadow-lg"
        >
          Çıkmak için tekrar bas
        </div>
      )}
      <GameSpeedControl
        timeScale={state.timeScale}
        lastRunningScale={lastRunningScaleRef.current}
        disabled={needsStartCitySelection(state) || isCitySelectionPending(state)}
        onSetTimeScale={onSetTimeScale}
      />

      {/* 4. ALT MOBİL NAVİGASYON (Şehir, Borsa, Şirket, Haberler, Portföy) */}
      <GameBottomNavigation
        activeTab={activeBottomTab}
        onSelectTab={handleSelectTab}
        openOrdersCount={activePendingOrders.length}
        tabStatuses={tabStatuses}
        shopIndicators={shopIndicators}
        hasPlayerCompany={state.playerCompany !== null}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      <HowToPlayModal
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onGoTab={handleSelectTab}
        onRestartGuide={() => {
          setIsGuideOpen(false);
          onUpdateOnboarding?.({ type: 'restart' });
        }}
        onOpenBuilding={handleOpenBuildingDetailSheet}
        formatCurrency={formatCurrency}
      />

      {/* 5. BİNA YÖNETİM PANELİ (Bottom Sheet / Modal) */}
      <BuildingDetailSheet
        {...sharedActions}
        buildingId={selectedBuildingId}
        state={state}
        initialCompanySubTab={initialCompanySubTab}
        manageRequest={manageRequest}
        onClose={handleCloseBuildingSheet}
        onOpenBuilding={handleOpenBuildingDetailSheet}
      />

      {/* Çevrimdışı İlerleme Özeti Modalı */}
      <OfflineProgressModal
        summary={state.lastOfflineSummary as OfflineProgressSummary | null}
        isOpen={offlineModalOpen}
        onDismiss={onDismissOfflineModal}
        formatCurrency={formatCurrency}
      />

      {/* Ayarlar, Performans, Ses Yöneticisi & Geliştirici Araçları Modalı */}
      {isSettingsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Oyun Ayarları"
          data-testid="game-settings-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4"
          onClick={() => {
            setResetConfirmOpen(false);
            setIsSettingsModalOpen(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="g-rise w-full max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-[24px] shadow-2xl p-4 sm:p-5 space-y-5 text-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[var(--g-navy-600)]" />
                <h2 className="g-section-title">
                  Ayarlar
                </h2>
              </div>
              <button
                type="button"
                aria-label="Ayarları Kapat"
                onClick={() => {
                  setResetConfirmOpen(false);
                  setIsSettingsModalOpen(false);
                }}
                className="w-10 h-10 rounded-full bg-[var(--g-surface-2)] flex items-center justify-center text-[var(--g-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Oyun Hızı ve Süre */}
            <section className="g-card-soft p-3 space-y-3" data-testid="settings-group-tempo">
              <h3 className="font-extrabold text-[var(--g-ink)]">Oyun Hızı ve Süre</h3>
              <div className="space-y-2">
                <div className="text-[13px] font-bold text-slate-700">Bir oyun günü ne kadar sürsün?</div>
                <div className="grid grid-cols-4 gap-2">
                  {([15, 30, 45, 60] as RealMinutesPerGameDayOption[]).map((mins) => (
                    <button
                      key={`day-duration-${mins}m`}
                      type="button"
                      onClick={() => onSetRealMinutesPerDay(mins)}
                      data-active={state.realMinutesPerGameDay === mins ? 'true' : 'false'}
                      className="g-choice tabular-nums"
                    >
                      {mins} dk
                    </button>
                  ))}
                </div>
              </div>

              {onSetFastStartTempo && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <div>
                    <div className="font-extrabold text-[var(--g-ink)]">Hızlı başlangıç</div>
                    <div className="text-[13px] text-slate-500" data-testid="settings-fast-start-note">
                      {isFastStartOn(state)
                        ? `Şirket kurana kadar 1 gün ${TEMPO_EARLY_MINUTES} dk, halka arza kadar ${TEMPO_COMPANY_MINUTES} dk. Şu an: ${effectiveRealMinutesPerGameDay(state)} dk`
                        : `Kapalı: her zaman ${state.realMinutesPerGameDay} dk`}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="settings-fast-start-toggle"
                    aria-pressed={isFastStartOn(state)}
                    onClick={() => onSetFastStartTempo(!isFastStartOn(state))}
                    className={`g-btn ${isFastStartOn(state) ? 'g-btn-primary' : 'g-btn-secondary'} px-4 min-h-[44px]`}
                  >
                    {isFastStartOn(state) ? 'Açık' : 'Kapalı'}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <div>
                  <div className="font-extrabold text-[var(--g-ink)]">Panel Açıkken Otomatik Duraklat</div>
                  <div className="text-[13px] text-slate-500">
                    Bina yönetim penceresi açıldığında oyun saatini duraklatır
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="toggle-autopause-sheet-btn"
                  aria-pressed={autoPauseOnSheetOpen}
                  onClick={() =>
                    setUiSettings(
                      UISettingsStore.saveSettings({
                        ...UISettingsStore.loadSettings(),
                        autoPauseOnSheetOpen: !autoPauseOnSheetOpen,
                      })
                    )
                  }
                  className={`g-btn g-btn-sm shrink-0 ${autoPauseOnSheetOpen ? 'g-btn-primary' : 'g-btn-secondary'}`}
                >
                  {autoPauseOnSheetOpen ? 'Açık' : 'Kapalı'}
                </button>
              </div>
            </section>

            {/* Raporlar ve Bildirimler */}
            <section className="g-card-soft p-3 space-y-3" data-testid="settings-group-reports">
              <h3 className="font-extrabold text-[var(--g-ink)]">Raporlar ve Bildirimler</h3>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-[var(--g-ink)]">Gün sonu raporu</div>
                  <div className="text-[13px] text-[var(--g-muted)]">
                    Gün 00:00'da dönünce günün özeti hazır olur.
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="settings-day-report-toggle"
                  aria-pressed={uiSettings.showDayReport !== false}
                  onClick={() =>
                    setUiSettings(
                      UISettingsStore.saveSettings({
                        ...UISettingsStore.loadSettings(),
                        showDayReport: uiSettings.showDayReport === false,
                      })
                    )
                  }
                  className={`g-btn g-btn-sm shrink-0 ${
                    uiSettings.showDayReport !== false ? 'g-btn-primary' : 'g-btn-secondary'
                  }`}
                >
                  {uiSettings.showDayReport !== false ? 'Açık' : 'Kapalı'}
                </button>
              </div>
            </section>

            {/* Ses ve Titreşim */}
            <section className="g-card-soft p-3 space-y-3" data-testid="settings-group-audio">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[var(--g-ink)] inline-flex items-center gap-1.5">
                  {uiSettings.audio.isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>Ses ve Titreşim</span>
                </h3>
                <button
                  type="button"
                  data-testid="audio-mute-toggle"
                  aria-pressed={uiSettings.audio.isMuted}
                  onClick={() => handleUpdateAudioSetting({ isMuted: !uiSettings.audio.isMuted })}
                  className={`min-h-[32px] px-2.5 rounded-lg text-[13px] font-bold border ${
                    uiSettings.audio.isMuted
                      ? 'bg-rose-600 text-white border-rose-700'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {uiSettings.audio.isMuted ? 'Sessizde (Aç)' : 'Sessize Al'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="audio-master-volume" className="text-[13px] text-slate-700 font-medium w-24">
                  Genel (%{uiSettings.audio.masterVolume})
                </label>
                <input
                  id="audio-master-volume"
                  data-testid="audio-master-volume"
                  type="range"
                  min={0}
                  max={100}
                  value={uiSettings.audio.masterVolume}
                  onChange={(e) => handleUpdateAudioSetting({ masterVolume: Number(e.target.value) })}
                  className="flex-1 accent-[var(--g-green)]"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="audio-effects-volume" className="text-[13px] text-slate-700 font-medium w-24">
                  Efektler (%{uiSettings.audio.effectsVolume})
                </label>
                <input
                  id="audio-effects-volume"
                  data-testid="audio-effects-volume"
                  type="range"
                  min={0}
                  max={100}
                  value={uiSettings.audio.effectsVolume}
                  onChange={(e) => handleUpdateAudioSetting({ effectsVolume: Number(e.target.value) })}
                  className="flex-1 accent-[var(--g-green)]"
                />
              </div>
            </section>

            {/* Kayıt ve Veri */}
            <section className="g-card-soft p-3 space-y-2" data-testid="settings-group-data">
              <h3 className="font-extrabold text-[var(--g-ink)]">Kayıt ve Veri</h3>
              <button
                type="button"
                onClick={() => {
                  onManualSave();
                  setIsSettingsModalOpen(false);
                }}
                className="g-btn g-btn-secondary w-full"
              >
                <Save className="w-4 h-4" />
                <span>Oyunu Kaydet</span>
              </button>

              {!resetConfirmOpen ? (
                <button
                  type="button"
                  data-testid="tycoon-reset-game-btn"
                  onClick={() => setResetConfirmOpen(true)}
                  className="w-full min-h-[48px] px-3 rounded-2xl text-[var(--g-red)] font-extrabold inline-flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Oyunu Sıfırla (Yeni Oyun: ₺100.000)</span>
                </button>
              ) : (
                <div
                  className="rounded-2xl border border-rose-300 bg-rose-50 p-3 space-y-2"
                  data-testid="tycoon-reset-confirm"
                  role="alert"
                >
                  <div className="font-extrabold text-rose-700">Emin misin? Tüm ilerleme silinecek.</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="tycoon-reset-cancel-btn"
                      onClick={() => setResetConfirmOpen(false)}
                      className="g-btn g-btn-secondary"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      data-testid="tycoon-reset-confirm-btn"
                      onClick={() => {
                        setResetConfirmOpen(false);
                        onResetSimulation();
                        setIsSettingsModalOpen(false);
                      }}
                      className="g-btn bg-rose-600 text-white font-extrabold"
                    >
                      Evet, sıfırla
                    </button>
                  </div>
                </div>
              )}

              <details className="group rounded-2xl bg-[var(--g-surface-2)] px-3 py-2">
                <summary className="cursor-pointer list-none min-h-[40px] flex items-center justify-between text-[13px] font-extrabold text-[var(--g-muted)]">
                  Geliştirici araçları
                  <span className="transition-transform group-open:rotate-180">⌄</span>
                </summary>
                <div className="space-y-2 pb-1">
                  <button
                    type="button"
                    data-testid="tycoon-simulate-offline-btn"
                    onClick={() => {
                      onSimulateOfflineProgress();
                      setIsSettingsModalOpen(false);
                    }}
                    className="g-btn g-btn-secondary g-btn-sm w-full"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Çevrimdışı ilerlemeyi dene</span>
                  </button>
                  <button
                    type="button"
                    data-testid="settings-switch-developer-btn"
                    onClick={() => {
                      setIsSettingsModalOpen(false);
                      onSwitchToDeveloperDashboard();
                    }}
                    className="g-btn g-btn-secondary g-btn-sm w-full"
                  >
                    <Code2 className="w-4 h-4" />
                    <span>Geliştirici paneli</span>
                  </button>
                </div>
              </details>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
