/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CelebrationOverlay } from './CelebrationOverlay';
import { FirstRunGuide } from './FirstRunGuide';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Code2,
  Compass,
  Gauge,
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
  GraphicsQualityLevel,
  UISettingsState,
  UISettingsStore,
} from '../../state/uiSettingsStore';
import {
  BuildingDetailActions,
  BuildingDetailContent,
  BuildingDetailSheet,
} from './BuildingDetailSheet';
import { CityNeighborhoodView } from './city3d/CityNeighborhoodView';
import { deriveIsometricBuildings } from './city/cityLayout';
import {
  CityCameraState,
  CompanySubTabRoute,
} from './city/cityVisualTypes';
import { CityQuestStrip } from './CityQuestStrip';
import { EventNotificationPanel } from './EventNotificationPanel';
import { GameBottomNavigation } from './GameBottomNavigation';
import { GameTopBar } from './GameTopBar';
import {
  CityBuildingId,
  GameBottomTab,
  GameNotificationItem,
} from './gameTypes';
import { OfflineProgressModal } from './OfflineProgressModal';

interface TycoonGameViewProps extends BuildingDetailActions {
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
  onMarkNotificationsRead,
  onSetTimeScale,
  onSetRealMinutesPerDay,
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
  spendableCash,
  reservedCash,
  getReservedShares,
  formattedTime,
  formatCurrency,
}) => {
  const [showFactoryDetails, setShowFactoryDetails] = useState(false);
  const [activeBottomTab, setActiveBottomTab] =
    useState<GameBottomTab>('city');
  const [selectedBuildingId, setSelectedBuildingId] =
    useState<CityBuildingId | null>(null);
  const [highlightedBuildingId, setHighlightedBuildingId] =
    useState<CityBuildingId | null>(null);
  const [initialCompanySubTab, setInitialCompanySubTab] =
    useState<CompanySubTabRoute>('OZET');
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] =
    useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Kalıcı UI Ayarları (Grafik Kalitesi, Ses Yöneticisi, Kamera Konumu ve İlk Görev Takibi — ekonomik state'ten bağımsız)
  const [uiSettings, setUiSettings] = useState<UISettingsState>(() =>
    UISettingsStore.loadSettings()
  );

  // Kamera konumu sekme değişimlerinde ve sayfa yenilemelerinde korunur, ekonomik state'i değiştirmez
  const [cameraState, setCameraState] = useState<CityCameraState>(() => ({
    panX: uiSettings.lastCameraPanX ?? state.cityState?.lastCameraPanX ?? 0,
    panY: uiSettings.lastCameraPanY ?? state.cityState?.lastCameraPanY ?? 0,
    zoomPreset:
      uiSettings.lastZoomPreset ??
      state.cityState?.lastZoomPreset ??
      'NORMAL',
  }));

  const handleUpdateCameraState = useCallback((next: CityCameraState) => {
    setCameraState(next);
    const updated = UISettingsStore.updateCameraState(next);
    setUiSettings(updated);
  }, []);

  // Panel açıkken isteğe bağlı otomatik duraklatma ayarı (Varsayılan: kapalı)
  const [autoPauseOnSheetOpen, setAutoPauseOnSheetOpen] = useState(false);
  const prevScaleBeforeSheetRef = useRef<TimeScaleOption | null>(null);

  const cityBuildings = useMemo(
    () => deriveIsometricBuildings(state, ipoEligibility, formatCurrency),
    [state, ipoEligibility, formatCurrency]
  );

  const activePendingOrders = useMemo(
    () =>
      state.pendingOrders.filter(
        (o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED'
      ),
    [state.pendingOrders]
  );

  const portfolioPositionsCount = useMemo(
    () =>
      Object.values(state.portfolio).filter((pos) => pos.shares > 0).length,
    [state.portfolio]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleSetGraphicsQuality = useCallback(
    (quality: GraphicsQualityLevel) => {
      const next = UISettingsStore.setGraphicsQuality(quality);
      setUiSettings(next);
    },
    []
  );

  const handleUpdateAudioSetting = useCallback(
    (patch: Partial<UISettingsState['audio']>) => {
      const next = UISettingsStore.updateAudio(patch);
      setUiSettings(next);
    },
    []
  );

  const handleOpenBuildingDetailSheet = useCallback(
    (id: CityBuildingId, companySubTab?: CompanySubTabRoute) => {
      setHighlightedBuildingId(id);
      if (companySubTab) {
        setInitialCompanySubTab(companySubTab);
      }
      const bNode = cityBuildings.find((b) => b.id === id);
      // Bölüm 31.A.7: Kilitli binalar açılma koşulunu seçim kartında gösterir, işlem ekranını açmaz
      if (bNode && !bNode.isUnlocked) {
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
      cityBuildings,
      onSetTimeScale,
      state.isPaused,
      state.timeScale,
    ]
  );

  const handleSelectBuildingOnMap = useCallback(
    (id: CityBuildingId, companySubTab?: CompanySubTabRoute) => {
      handleOpenBuildingDetailSheet(id, companySubTab);
    },
    [handleOpenBuildingDetailSheet]
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

  const handleClearHighlightedBuilding = useCallback(() => {
    setHighlightedBuildingId(null);
  }, []);

  const handleOpenNotifications = useCallback(() => {
    setIsNotificationDrawerOpen(true);
    onMarkNotificationsRead();
  }, [onMarkNotificationsRead]);

  const handleCloseNotifications = useCallback(() => {
    setIsNotificationDrawerOpen(false);
  }, []);

  const offlineModalOpen = Boolean(
    state.lastOfflineSummary &&
      !state.lastOfflineSummaryDismissed &&
      state.lastOfflineSummary.gameMinutesAdvanced > 0
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
    spendableCash,
    reservedCash,
    getReservedShares,
    ipoEligibility,
    formattedTime,
    formatCurrency,
  };

  return (
    <div
      data-testid="tycoon-game-view"
      className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-sky-100 via-emerald-50 to-amber-50 text-slate-900 flex flex-col justify-between"
    >
      <CelebrationOverlay
        shopCount={state.tradeState?.shops.length ?? 0}
        stage={state.stage}
      />
      <FirstRunGuide
        day={state.day}
        formatCurrency={formatCurrency}
        onGoToMarket={() => setActiveBottomTab('market')}
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
        onOpenNotifications={handleOpenNotifications}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onSwitchToDeveloperDashboard={onSwitchToDeveloperDashboard}
        formatCurrency={formatCurrency}
      />

      {/* 2. ORTA ANA OYUN ALANI (Tek Hedefli Görev Şeridi + İzometrik 2.5D Mahalle veya Seçili Sekme) */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-2 sm:px-4 py-2 space-y-2">
        {/* Tek Hedefli Görev / İlerleme Şeridi */}
        <CityQuestStrip
          state={state}
          hasOpenedBorsaBuilding={uiSettings.hasOpenedBorsaBuilding}
          onOpenBuilding={handleOpenBuildingDetailSheet}
        />

        {activeBottomTab === 'city' ? (
          <CityNeighborhoodView
            state={state}
            ipoEligibility={ipoEligibility}
            formatCurrency={formatCurrency}
            camera={cameraState}
            onChangeCamera={handleUpdateCameraState}
            selectedBuildingId={selectedBuildingId}
            activeHighlightedBuildingId={highlightedBuildingId}
            graphicsQuality={uiSettings.graphicsQuality}
            onSelectBuildingOnMap={handleSelectBuildingOnMap}
            onOpenBuildingDetailSheet={handleOpenBuildingDetailSheet}
            onClearHighlightedBuilding={handleClearHighlightedBuilding}
            onSetTimeScale={onSetTimeScale}
            onAdvanceToMarketOpen={onAdvanceToMarketOpen}
            onAdvanceOneHour={onAdvanceOneHour}
            onTickDay={onTickDay}
            nextEventLabelTR={nextEvent.eventLabelTR}
            nextEventFormattedRemaining={nextEvent.formattedRemaining}
          />
        ) : (
          <section
            aria-label={`Aktif Sekme: ${activeBottomTab}`}
            className="rounded-3xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                {activeBottomTab === 'market' && '📈 Borsa'}
                {activeBottomTab === 'company' &&
                  '🏢 Şirketim'}
                {activeBottomTab === 'news' && '📰 Haberler'}
                {activeBottomTab === 'portfolio' &&
                  '🏪 Dükkânlarım & Varlıklarım'}
              </h2>
              <button
                type="button"
                onClick={() => setActiveBottomTab('city')}
                className="min-h-[38px] px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5 text-sky-600" />
                <span>Şehre dön</span>
              </button>
            </div>

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
                      className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-slate-700 to-slate-600 text-white font-extrabold text-sm shadow-md active:scale-95"
                    >
                      {showFactoryDetails
                        ? '▲ Fabrika ve Ar-Ge ayrıntılarını gizle'
                        : '🏭 Fabrika, Depo ve Ar-Ge ayrıntıları'}
                    </button>
                    <div className={showFactoryDetails ? 'space-y-4' : 'hidden'}>
                      <div className="pt-3 border-t border-slate-200">
                        <h3 className="text-base font-extrabold text-slate-900 mb-2">
                          🏭 Fabrika Üretim Durumu
                        </h3>
                        <BuildingDetailContent
                          {...sharedActions}
                          buildingId="FABRIKA"
                          state={state}
                        />
                      </div>
                      <div className="pt-3 border-t border-slate-200">
                        <h3 className="text-base font-extrabold text-slate-900 mb-2">
                          🔬 Ar-Ge & Teknoloji Kalitesi
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

      {/* 4. ALT MOBİL NAVİGASYON (Şehir, Borsa, Şirket, Haberler, Portföy) */}
      <GameBottomNavigation
        activeTab={activeBottomTab}
        onSelectTab={setActiveBottomTab}
        openOrdersCount={activePendingOrders.length}
        portfolioPositionsCount={portfolioPositionsCount}
        hasPlayerCompany={state.playerCompany !== null}
      />

      {/* 5. BİNA YÖNETİM PANELİ (Bottom Sheet / Modal) */}
      <BuildingDetailSheet
        {...sharedActions}
        buildingId={selectedBuildingId}
        state={state}
        initialCompanySubTab={initialCompanySubTab}
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
          onClick={() => setIsSettingsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-3xl border border-slate-200 shadow-2xl p-4 sm:p-5 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">
                  Oyun Ayarları
                </h2>
              </div>
              <button
                type="button"
                aria-label="Ayarları Kapat"
                onClick={() => setIsSettingsModalOpen(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grafik Kalitesi (Performans Modu) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-sky-600" />
                  <span>Grafik Kalitesi (Performans Modu)</span>
                </label>
                <span className="text-[13px] tabular-nums text-slate-500">
                  Varsayılan: Orta
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'LOW', label: 'Düşük', sub: 'Maks 6 Araç · 0 Yaya' },
                    { id: 'MEDIUM', label: 'Orta', sub: 'Maks 12 Araç · 2 Yaya' },
                    { id: 'HIGH', label: 'Yüksek', sub: 'Maks 18 Araç · 4 Yaya' },
                  ] as const
                ).map((item) => {
                  const active = uiSettings.graphicsQuality === item.id;
                  return (
                    <button
                      key={`graphics-mode-${item.id}`}
                      type="button"
                      data-testid={`graphics-quality-${item.id}`}
                      aria-pressed={active}
                      onClick={() => handleSetGraphicsQuality(item.id)}
                      className={`min-h-[46px] p-2 rounded-xl border text-center transition-colors ${
                        active
                          ? 'bg-sky-600 text-white border-sky-700'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-bold">{item.label}</div>
                      <div
                        className={`text-[13px] tabular-nums ${
                          active ? 'text-sky-100' : 'text-slate-500'
                        }`}
                      >
                        {item.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ses Yöneticisi (UI Audio Infrastructure) */}
            <div className="space-y-2.5 pt-2.5 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
                  {uiSettings.audio.isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>Ses Ayarları</span>
                </div>
                <button
                  type="button"
                  data-testid="audio-mute-toggle"
                  aria-pressed={uiSettings.audio.isMuted}
                  onClick={() =>
                    handleUpdateAudioSetting({
                      isMuted: !uiSettings.audio.isMuted,
                    })
                  }
                  className={`min-h-[32px] px-2.5 rounded-lg text-[13px] font-bold border ${
                    uiSettings.audio.isMuted
                      ? 'bg-rose-600 text-white border-rose-700'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {uiSettings.audio.isMuted ? 'Sessizde (Aç)' : 'Sessize Al'}
                </button>
              </div>

              <div className="space-y-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="audio-master-volume"
                    className="text-[13px] text-slate-700 font-medium w-24"
                  >
                    Ana Ses (%{uiSettings.audio.masterVolume})
                  </label>
                  <input
                    id="audio-master-volume"
                    data-testid="audio-master-volume"
                    type="range"
                    min={0}
                    max={100}
                    value={uiSettings.audio.masterVolume}
                    onChange={(e) =>
                      handleUpdateAudioSetting({
                        masterVolume: Number(e.target.value),
                      })
                    }
                    className="flex-1 accent-emerald-600"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="audio-effects-volume"
                    className="text-[13px] text-slate-700 font-medium w-24"
                  >
                    Efekt Sesi (%{uiSettings.audio.effectsVolume})
                  </label>
                  <input
                    id="audio-effects-volume"
                    data-testid="audio-effects-volume"
                    type="range"
                    min={0}
                    max={100}
                    value={uiSettings.audio.effectsVolume}
                    onChange={(e) =>
                      handleUpdateAudioSetting({
                        effectsVolume: Number(e.target.value),
                      })
                    }
                    className="flex-1 accent-emerald-600"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="audio-music-volume"
                    className="text-[13px] text-slate-700 font-medium w-24"
                  >
                    Müzik Sesi (%{uiSettings.audio.musicVolume})
                  </label>
                  <input
                    id="audio-music-volume"
                    data-testid="audio-music-volume"
                    type="range"
                    min={0}
                    max={100}
                    value={uiSettings.audio.musicVolume}
                    onChange={(e) =>
                      handleUpdateAudioSetting({
                        musicVolume: Number(e.target.value),
                      })
                    }
                    className="flex-1 accent-emerald-600"
                  />
                </div>
                <div
                  data-testid="audio-asset-status-note"
                  className="text-[13px] text-slate-500 pt-1 border-t border-slate-200/70"
                >
                  Durum: Ses yöneticisi altyapısı aktif — ses dosyaları daha sonra
                  eklenecek.
                </div>
              </div>
            </div>

            {/* 1 Oyun Günü Gerçek Süre Karşılığı */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block font-semibold text-slate-800">
                1 Oyun Günü Gerçek Süre Karşılığı
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([15, 30, 45, 60] as RealMinutesPerGameDayOption[]).map((mins) => (
                  <button
                    key={`day-duration-${mins}m`}
                    type="button"
                    onClick={() => onSetRealMinutesPerDay(mins)}
                    className={`min-h-[40px] rounded-xl tabular-nums font-bold border ${
                      state.realMinutesPerGameDay === mins
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    {mins} dk
                  </button>
                ))}
              </div>
            </div>

            {/* Bina Paneli Açıkken Otomatik Duraklatma Seçeneği */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <div>
                <div className="font-semibold text-slate-800">
                  Panel Açıkken Otomatik Duraklat
                </div>
                <div className="text-[13px] text-slate-500">
                  Bina yönetim penceresi açıldığında oyun saatini duraklatır
                </div>
              </div>
              <button
                type="button"
                data-testid="toggle-autopause-sheet-btn"
                aria-pressed={autoPauseOnSheetOpen}
                onClick={() => setAutoPauseOnSheetOpen((prev) => !prev)}
                className={`min-h-[38px] px-3 rounded-xl font-bold border ${
                  autoPauseOnSheetOpen
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {autoPauseOnSheetOpen ? 'Açık' : 'Kapalı'}
              </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="font-semibold text-slate-800">
                Kayıt ve Geliştirici Araçları
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onManualSave();
                    setIsSettingsModalOpen(false);
                  }}
                  className="min-h-[42px] px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Oyunu Kaydet</span>
                </button>
                <button
                  type="button"
                  data-testid="tycoon-simulate-offline-btn"
                  onClick={() => {
                    onSimulateOfflineProgress();
                    setIsSettingsModalOpen(false);
                  }}
                  className="min-h-[42px] px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-4 h-4" />
                  <span>Çevrimdışı Simüle Et</span>
                </button>
              </div>

              <button
                type="button"
                data-testid="settings-switch-developer-btn"
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  onSwitchToDeveloperDashboard();
                }}
                className="w-full min-h-[42px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center justify-center gap-2"
              >
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span>Geliştirici Araçları (Ayrıntılı Geliştirici Paneli)</span>
              </button>

              <button
                type="button"
                data-testid="tycoon-reset-game-btn"
                onClick={() => {
                  onResetSimulation();
                  setIsSettingsModalOpen(false);
                }}
                className="w-full min-h-[42px] px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Oyunu Sıfırla (Yeni Oyun: ₺100.000)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
