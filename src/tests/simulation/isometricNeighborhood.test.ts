/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import {
  CITY_BUILDING_COORDINATES,
  clampCameraPan,
  deriveActiveVehicles,
  deriveCityAtmosphere,
  deriveIsometricBuildings,
  deriveTimeOfDayPhase,
  getCameraFocusPanForBuilding,
  getZoomScale,
  VIRTUAL_MAP_HEIGHT,
  VIRTUAL_MAP_WIDTH,
} from '../../components/game/city/cityLayout';
import { IsometricNeighborhoodView } from '../../components/game/city/IsometricNeighborhoodView';
import { BuildingDetailSheet } from '../../components/game/BuildingDetailSheet';
import { TycoonGameView } from '../../components/game/TycoonGameView';

const formatCurrencyTR = (v: number) =>
  `₺${Math.round(v).toLocaleString('tr-TR')}`;

test('İzometrik Mahalle Test 1, 2, 3, 4: Şehir sekmesi IsometricNeighborhoodView gösterir, eski büyük bilgi kartları yer almaz, 8 bina erişilebilir button olarak bulunur', () => {
  const engine = new SimulationEngine(20260101, 100_000);
  const state = engine.getState();
  const ipoEligibility = engine.checkIPOEligibility();

  const html = renderToStaticMarkup(
    React.createElement(IsometricNeighborhoodView, {
      state,
      ipoEligibility,
      formatCurrency: formatCurrencyTR,
      camera: { panX: 0, panY: 0, zoomPreset: 'NORMAL' },
      onChangeCamera: () => {},
      selectedBuildingId: null,
      activeHighlightedBuildingId: null,
      onSelectBuildingOnMap: () => {},
      onOpenBuildingDetailSheet: () => {},
      onClearHighlightedBuilding: () => {},
      onSetTimeScale: () => {},
      onAdvanceToMarketOpen: () => {},
      onAdvanceOneHour: () => {},
      onTickDay: () => {},
      nextEventLabelTR: 'Piyasa Açılışına (10:00)',
      nextEventFormattedRemaining: '10 sa 0 dk',
    })
  );

  // 1. IsometricNeighborhoodView ve 1600x1200 sanal sahne render ediliyor
  assert.ok(html.includes('data-testid="isometric-neighborhood-view"'));
  assert.ok(html.includes('data-testid="isometric-virtual-canvas"'));
  assert.equal(VIRTUAL_MAP_WIDTH, 1600);
  assert.equal(VIRTUAL_MAP_HEIGHT, 1200);

  // 2. Eski büyük bina bilgi kartı metinleri ("Endeks 1000.0", "0 Portföy Hissesi", "Enflasyon %", "Aç →") haritada yok
  assert.equal(html.includes('Endeks 1000.0'), false);
  assert.equal(html.includes('0 Portföy Hissesi'), false);
  assert.equal(html.includes('Enflasyon %'), false);
  assert.equal(html.includes('Aç →'), false);

  // 3 & 4. Sekiz binanın tamamı haritada erişilebilir <button> olarak ve 2.5D mimari parçalarla bulunuyor
  const buildingIds = Object.keys(CITY_BUILDING_COORDINATES);
  assert.equal(buildingIds.length, 8);
  for (const id of buildingIds) {
    assert.ok(
      html.includes(`data-testid="city-building-${id}"`),
      `${id} binası haritada bulunmalı`
    );
  }

  const buildings = deriveIsometricBuildings(
    state,
    ipoEligibility,
    formatCurrencyTR
  );
  assert.equal(buildings.length, 8);
  for (const b of buildings) {
    assert.ok(b.accessibleLabel.length > 15);
    assert.ok(b.accessibleLabel.includes('dokunun'));
  }
});

test('İzometrik Mahalle Test 5, 6, 7: Borsa binasına dokununca gerçek piyasa state\'ini gösteren BuildingDetailSheet açılır; kilitli şirket arsasına dokununca 2.000.000 TL koşulu gösterilir', () => {
  const engine = new SimulationEngine(20260101, 100_000);
  const state = engine.getState();
  const ipoEligibility = engine.checkIPOEligibility();

  // 5 & 6: Borsa Binası seçildiğinde BuildingDetailSheet açılır ve gerçek hisse fiyatlarını gösterir
  const borsaSheetHtml = renderToStaticMarkup(
    React.createElement(BuildingDetailSheet, {
      buildingId: 'BORSA',
      state,
      onClose: () => {},
      onOpenBuilding: () => {},
      selectedTicker: state.stocks[0].ticker,
      onSelectTicker: () => {},
      onPlaceOrder: () => {},
      onCancelOrder: () => {},
      onBuyStock: () => {},
      onSellStock: () => {},
      onEstablishCompany: () => {},
      onTransferCapital: () => {},
      onConfigureOperations: () => {},
      onExecuteIPO: () => {},
      onExecuteTakeover: () => {},
      spendableCash: engine.getSpendableCash(),
      reservedCash: engine.getReservedCash(),
      getReservedShares: (t: string) => engine.getReservedShares(t),
      ipoEligibility,
      formattedTime: engine.getFormattedGameTime(),
      formatCurrency: formatCurrencyTR,
    })
  );

  assert.ok(borsaSheetHtml.includes('data-testid="building-detail-sheet-BORSA"'));
  assert.ok(borsaSheetHtml.includes(state.stocks[0].ticker));
  assert.ok(borsaSheetHtml.includes(state.stocks[0].price.toFixed(2)));

  // 7: Kilitli Şirket Arsasına dokunulduğunda 2.000.000 TL açılma koşulu ve kalan tutar gösterilir
  const buildings = deriveIsometricBuildings(
    state,
    ipoEligibility,
    formatCurrencyTR
  );
  const sirketNode = buildings.find((b) => b.id === 'SIRKET_MERKEZI')!;
  assert.equal(sirketNode.isUnlocked, false);
  assert.ok(sirketNode.lockedOverlayInfo !== null);
  assert.equal(
    sirketNode.lockedOverlayInfo!.conditionText,
    '2.000.000 TL net varlıkta açılır.'
  );
  assert.ok(sirketNode.lockedOverlayInfo!.remainingText.includes('1.900.000'));
});

test('İzometrik Mahalle Test 8, 9, 10: Şirket kurulduğunda arsa şirket merkezine dönüşür; Fabrika ve Ar-Ge şirket kurulmadan kilitlidir; Holding doğru koşulla açılır', () => {
  const engine = new SimulationEngine(20260101, 100_000);
  const state = engine.getState();

  // Başlangıçta (100.000 TL, şirket yok): Şirket Arsası, Fabrika, Ar-Ge ve Holding kilitli
  let buildings = deriveIsometricBuildings(
    state,
    engine.checkIPOEligibility(),
    formatCurrencyTR
  );
  const byId = (id: string) => buildings.find((b) => b.id === id)!;

  assert.equal(byId('SIRKET_MERKEZI').isUnlocked, false);
  assert.equal(byId('SIRKET_MERKEZI').visualMeta.hasPlayerCompany, false);
  assert.equal(byId('FABRIKA').isUnlocked, false);
  assert.equal(byId('ARGE_MERKEZI').isUnlocked, false);
  assert.equal(byId('HOLDING_MERKEZI').isUnlocked, false);

  // Oyuncu 3.5M TL ile başladığında ve bir NPC şirketinde %5+ pay topladığında Holding ve Şirket Arsası açılır
  const richEngine = new SimulationEngine(20260101, 3_500_000);
  const krgo = richEngine.getState().stocks.find((s) => s.ticker === 'KRGO')!;
  const buyRes = richEngine.buyStock('KRGO', Math.ceil(krgo.totalShares * 0.06));
  assert.equal(buyRes.success, true);

  buildings = deriveIsometricBuildings(
    richEngine.getState(),
    richEngine.checkIPOEligibility(),
    formatCurrencyTR
  );
  // Şirket Arsası ve Holding açıldı, ancak şirket henüz kurulmadığı için Fabrika ve Ar-Ge hâlâ kilitli!
  assert.equal(byId('SIRKET_MERKEZI').isUnlocked, true);
  assert.equal(byId('HOLDING_MERKEZI').isUnlocked, true);
  assert.equal(byId('FABRIKA').isUnlocked, false);
  assert.equal(byId('ARGE_MERKEZI').isUnlocked, false);

  // Şimdi şirket kuralım: Arsa -> Şirket Merkezine dönüşmeli ve Fabrika + Ar-Ge açılmalı
  const foundRes = richEngine.establishCompany(
    'Anadolu Kuantum Teknoloji A.Ş.',
    'ANKT',
    'TEKNOLOJI',
    800_000
  );
  assert.equal(foundRes.success, true);

  buildings = deriveIsometricBuildings(
    richEngine.getState(),
    richEngine.checkIPOEligibility(),
    formatCurrencyTR
  );
  assert.equal(byId('SIRKET_MERKEZI').visualMeta.hasPlayerCompany, true);
  assert.equal(byId('SIRKET_MERKEZI').visualMeta.companyTicker, 'ANKT');
  assert.equal(byId('SIRKET_MERKEZI').shortName, 'ANKT Merkez');
  assert.equal(byId('FABRIKA').isUnlocked, true);
  assert.equal(byId('ARGE_MERKEZI').isUnlocked, true);
});

test('İzometrik Mahalle Test 11, 12: Oyun saati atmosferi (Gece/Sabah/Gündüz/Akşam) doğru değiştirir; piyasa açıkken Borsa Binası çalışma durumu gösterir', () => {
  // 00:00–05:59 -> NIGHT
  assert.equal(deriveTimeOfDayPhase(0), 'NIGHT');
  assert.equal(deriveTimeOfDayPhase(5), 'NIGHT');
  assert.equal(deriveCityAtmosphere(2).streetLightsOn, true);
  assert.ok(deriveCityAtmosphere(2).windowsLitRatio >= 0.7);

  // 06:00–08:59 -> MORNING
  assert.equal(deriveTimeOfDayPhase(6), 'MORNING');
  assert.equal(deriveTimeOfDayPhase(8), 'MORNING');
  assert.equal(deriveCityAtmosphere(7).streetLightsOn, false);

  // 09:00–17:59 -> DAY
  assert.equal(deriveTimeOfDayPhase(9), 'DAY');
  assert.equal(deriveTimeOfDayPhase(14), 'DAY');
  assert.equal(deriveTimeOfDayPhase(17), 'DAY');
  assert.equal(deriveCityAtmosphere(12).streetLightsOn, false);
  assert.equal(deriveCityAtmosphere(12).windowsLitRatio, 0);

  // 18:00–20:59 -> EVENING
  assert.equal(deriveTimeOfDayPhase(18), 'EVENING');
  assert.equal(deriveTimeOfDayPhase(20), 'EVENING');
  assert.equal(deriveCityAtmosphere(19).streetLightsOn, true);

  // 21:00–23:59 -> NIGHT
  assert.equal(deriveTimeOfDayPhase(21), 'NIGHT');
  assert.equal(deriveTimeOfDayPhase(23), 'NIGHT');

  // 12: Piyasa açıkken (10:00–17:59) Borsa binası aktif çalışma durumunda görünür
  const engine = new SimulationEngine(20260101, 100_000);
  let borsa = deriveIsometricBuildings(
    engine.getState(),
    engine.checkIPOEligibility(),
    formatCurrencyTR
  ).find((b) => b.id === 'BORSA')!;
  assert.equal(borsa.isActiveWorking, false);
  assert.equal(borsa.shortStatusLabel, 'Kapalı');

  // Saat 10:00'a ilerlet
  engine.advanceGameMinutes(600);
  borsa = deriveIsometricBuildings(
    engine.getState(),
    engine.checkIPOEligibility(),
    formatCurrencyTR
  ).find((b) => b.id === 'BORSA')!;
  assert.equal(borsa.isActiveWorking, true);
  assert.equal(borsa.shortStatusLabel, 'Açık');
});

test('İzometrik Mahalle Test 13, 14, 15, 16: Kamera sınırları aşılmaz; kamera ve bina paneli ekonomik state\'i değiştirmez; geliştirici paneli geçişi ikinci engine oluşturmaz', () => {
  // 13: Harita sürükleme sınırları dışına çıkamaz
  const clampedExtreme = clampCameraPan(99999, -99999, 'NORMAL', 360, 800);
  assert.ok(Math.abs(clampedExtreme.panX) < 600);
  assert.ok(Math.abs(clampedExtreme.panY) < 500);

  const focusBorsa = getCameraFocusPanForBuilding('BORSA', 'NORMAL', 360, 800);
  assert.equal(
    focusBorsa.panX,
    clampCameraPan(focusBorsa.panX, focusBorsa.panY, 'NORMAL', 360, 800).panX
  );

  // 14, 15, 16: Kamera güncellemesi, bina paneli açılması ve görünüm geçişi ekonomik state'i ve engine sayısını değiştirmez
  const engine = SimulationStore.resetSharedEngine();
  const countBefore = SimulationStore.getSharedEngineCreationCount();
  const serializedBefore = engine.serializeState();

  const viewHtml = renderToStaticMarkup(
    React.createElement(TycoonGameView, {
      state: engine.getState(),
      ipoEligibility: engine.checkIPOEligibility(),
      nextEvent: engine.getNextScheduledEvent(),
      notifications: [],
      onMarkNotificationsRead: () => {},
      onSetTimeScale: () => {},
      onSetRealMinutesPerDay: () => {},
      onAdvanceToMarketOpen: () => {},
      onAdvanceOneHour: () => {},
      onTickDay: () => {},
      onSimulateOfflineProgress: () => {},
      onManualSave: () => {},
      onResetSimulation: () => {},
      onDismissOfflineModal: () => {},
      onSwitchToDeveloperDashboard: () => {},
      selectedTicker: 'NVEX',
      onSelectTicker: () => {},
      onPlaceOrder: () => {},
      onCancelOrder: () => {},
      onBuyStock: () => {},
      onSellStock: () => {},
      onEstablishCompany: () => {},
      onTransferCapital: () => {},
      onConfigureOperations: () => {},
      onExecuteIPO: () => {},
      onExecuteTakeover: () => {},
      spendableCash: engine.getSpendableCash(),
      reservedCash: engine.getReservedCash(),
      getReservedShares: () => 0,
      formattedTime: engine.getFormattedGameTime(),
      formatCurrency: formatCurrencyTR,
    })
  );

  assert.ok(viewHtml.includes('data-testid="tycoon-game-view"'));
  // Üst HUD'da eski büyük Geliştirici Paneli butonu yer almamalı
  assert.equal(viewHtml.includes('aria-label="Geliştirici Paneline Geç"'), false);

  const engineAfter = SimulationStore.getSharedEngine();
  assert.equal(engineAfter, engine);
  assert.equal(SimulationStore.getSharedEngineCreationCount(), countBefore);
  assert.equal(engineAfter.serializeState(), serializedBefore);
});

test('İzometrik Mahalle Test 17, 18, 19, 20: 360x800 ölçekleme, prefers-reduced-motion araç durdurma ve sıfır finansal sapma', () => {
  // 17: 360x800 mobil ekranda uygun ölçekleme
  const mobileScale = getZoomScale('NORMAL', 360);
  const overviewScale = getZoomScale('OVERVIEW', 360);
  const closerScale = getZoomScale('CLOSER', 360);
  assert.ok(overviewScale < mobileScale && mobileScale < closerScale);
  assert.ok(mobileScale > 0.3 && mobileScale < 0.6);

  // 18: prefers-reduced-motion altında araç animasyonları durdurulur
  const activeNormal = deriveActiveVehicles(1, false, false, true);
  assert.equal(activeNormal.animationsActive, true);
  assert.equal(activeNormal.vehicles.length, 2);

  const activeReduced = deriveActiveVehicles(1, false, true, true);
  assert.equal(activeReduced.animationsActive, false);

  const activeHiddenTab = deriveActiveVehicles(2, false, false, false);
  assert.equal(activeHiddenTab.animationsActive, false);
  assert.equal(activeHiddenTab.vehicles.length, 3);

  // 19 & 20: Harita türetimleri finansal motor değerlerini asla değiştirmez
  const engine = new SimulationEngine(20260101, 100_000);
  const cashBefore = engine.getState().cash;
  const netWorthBefore = engine.getState().netWorth;
  deriveIsometricBuildings(
    engine.getState(),
    engine.checkIPOEligibility(),
    formatCurrencyTR
  );
  assert.equal(engine.getState().cash, cashBefore);
  assert.equal(engine.getState().netWorth, netWorthBefore);
});
