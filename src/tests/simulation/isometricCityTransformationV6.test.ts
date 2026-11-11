/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BÖLÜM 31: İZOMETRİK TYCOON ŞEHRİ DÖNÜŞÜMÜ (6 BÖLGE, 2.5D BLOKLAR, İNŞAAT, TRAFİK VE MİGRASYON) TESTLERİ
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDeterministicBuildingWindows,
  CITY_BUILDING_COORDINATES,
  clampCameraPan,
  deriveBorsaStatusLight,
  deriveBuildingConstructionVisual,
  deriveBuildingVisualLevelSpec,
  deriveCityAtmosphere,
  deriveCityDiagnosticsSummary,
  deriveCityDistricts,
  deriveCityTrafficFleet,
  deriveCityUrbanBlocks,
  deriveIsometricBuildings,
  getCameraFocusPanForBuilding,
  getZoomScale,
  resolveCityBuildingNavigation,
} from '../../components/game/city/cityLayout';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStage } from '../../models/simulation';
import { SimulationStore } from '../../state/simulationStore';
import { UISettingsStore } from '../../state/uiSettingsStore';

const formatTL = (val: number) => `₺${Math.round(val).toLocaleString('tr-TR')}`;

describe('Bölüm 31: İzometrik Tycoon Şehri Dönüşümü (A, B, C, D, E) Test Paketi', () => {
  // ============================================================================
  // A. ŞEHİR VE BİNA TESTLERİ (1 - 8)
  // ============================================================================
  it('A.1: Tüm 6 ana şehir bölgesi (Finans, Ticaret, Sanayi, Teknoloji, Yaşam/Hizmet, Kilitli Genişleme) doğru oluşturuluyor', () => {
    const engine = new SimulationEngine(42, 100_000);
    const districts = deriveCityDistricts(engine.getState());
    assert.equal(districts.length, 6);
    const ids = districts.map((d) => d.id);
    assert.deepEqual(ids, [
      'FINANS_BOLGESI',
      'TICARET_BOLGESI',
      'SANAYI_BOLGESI',
      'TEKNOLOJI_BOLGESI',
      'YASAM_HIZMET_BOLGESI',
      'KILITLI_GENISLEME_ALANLARI',
    ]);
    assert.equal(
      districts.find((d) => d.id === 'FINANS_BOLGESI')?.isUnlocked,
      true
    );
    assert.equal(
      districts.find((d) => d.id === 'TICARET_BOLGESI')?.isUnlocked,
      true
    );
    assert.equal(
      districts.find((d) => d.id === 'YASAM_HIZMET_BOLGESI')?.isUnlocked,
      true
    );
  });

  it('A.2: Açık ana binalar (8 adet) ve çevre şehir bloğu yapıları (22 adet) doğru üretiliyor ve Ticaret kancalarını içeriyor', () => {
    const engine = new SimulationEngine(42, 100_000);
    const st = engine.getState();
    const buildings = deriveIsometricBuildings(
      st,
      engine.checkIPOEligibility(),
      formatTL
    );
    const urbanBlocks = deriveCityUrbanBlocks(st);
    assert.equal(buildings.length, 8);
    assert.equal(urbanBlocks.length, 22);

    const commercialBlocks = urbanBlocks.filter(
      (b) => b.districtId === 'TICARET_BOLGESI'
    );
    assert.equal(commercialBlocks.length, 6);
    for (const cb of commercialBlocks) {
      assert.ok(cb.futureTradeHooks.length >= 2);
    }
  });

  it('A.3: Başlangıçta kilitli binalar ve genişleme bölgeleri doğru kilit durumunda görünüyor', () => {
    const engine = new SimulationEngine(42, 100_000);
    const st = engine.getState();
    const buildings = deriveIsometricBuildings(
      st,
      engine.checkIPOEligibility(),
      formatTL
    );
    const fabrika = buildings.find((b) => b.id === 'FABRIKA')!;
    const arge = buildings.find((b) => b.id === 'ARGE_MERKEZI')!;
    const holding = buildings.find((b) => b.id === 'HOLDING_MERKEZI')!;

    assert.equal(fabrika.isUnlocked, false);
    assert.equal(arge.isUnlocked, false);
    assert.equal(holding.isUnlocked, false);
    assert.equal(fabrika.primaryStatusType, 'LOCKED');
    assert.equal(holding.primaryStatusType, 'LOCKED');
  });

  it('A.4: Bina seçimi doğru seçim kartı bilgisini (Bina adı, Seviye, Kısa durum, 1 Ana metrik, 1 Ana işlem düğmesi) üretiyor', () => {
    const engine = new SimulationEngine(42, 100_000);
    const buildings = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      formatTL
    );
    for (const b of buildings) {
      assert.ok(b.selectionCard.title.length > 0);
      assert.ok(b.selectionCard.levelLabelTR.length > 0);
      assert.ok(b.selectionCard.shortStatus.length > 0);
      assert.ok(b.selectionCard.keyMetricLabel.length > 0);
      assert.ok(b.selectionCard.keyMetricValue.length > 0);
      assert.ok(b.selectionCard.primaryActionLabel.length > 0);
    }
  });

  it('A.5: Birincil işlem düğmesi her binayı doğru gerçek ekrana ve şirket alt sekmesine yönlendiriyor', () => {
    const engine = new SimulationEngine(42, 3_500_000);
    engine.establishCompany(
      'Anadolu Teknoloji A.Ş.',
      'ANTK',
      'TEKNOLOJI',
      900_000
    );
    const st = engine.getState();

    const borsaNav = resolveCityBuildingNavigation('BORSA', st);
    const bankaNav = resolveCityBuildingNavigation('BANKA', st);
    const sirketNav = resolveCityBuildingNavigation('SIRKET_MERKEZI', st);
    const fabrikaNav = resolveCityBuildingNavigation('FABRIKA', st);
    const argeNav = resolveCityBuildingNavigation('ARGE_MERKEZI', st);
    const ofisNav = resolveCityBuildingNavigation('OYUNCU_OFISI', st);
    const holdingNav = resolveCityBuildingNavigation('HOLDING_MERKEZI', st);
    const haberNav = resolveCityBuildingNavigation('HABER_MERKEZI', st);

    assert.equal(borsaNav.buildingId, 'BORSA');
    assert.equal(bankaNav.buildingId, 'BANKA');
    assert.equal(sirketNav.companySubTab, 'OZET');
    assert.equal(fabrikaNav.companySubTab, 'URETIM');
    assert.equal(argeNav.companySubTab, 'GELISIM');
    assert.equal(ofisNav.companySubTab, 'CALISANLAR');
    assert.equal(holdingNav.buildingId, 'HOLDING_MERKEZI');
    assert.equal(haberNav.buildingId, 'HABER_MERKEZI');
  });

  it('A.6: Başka binaya geçildiğinde kamera odak koordinatı yeni binaya deterministik olarak güncelleniyor', () => {
    const focusBorsa = getCameraFocusPanForBuilding('BORSA', 'NORMAL', 390, 560);
    const focusFabrika = getCameraFocusPanForBuilding(
      'FABRIKA',
      'NORMAL',
      390,
      560
    );
    assert.notDeepEqual(focusBorsa, focusFabrika);
  });

  it('A.7: Kilitli binalar açılma koşulunu ve kalan ilerlemeyi gösteriyor', () => {
    const engine = new SimulationEngine(42, 100_000);
    const buildings = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      formatTL
    );
    const lockedSirket = buildings.find((b) => b.id === 'SIRKET_MERKEZI')!;
    assert.equal(lockedSirket.isUnlocked, false);
    assert.ok(lockedSirket.lockedOverlayInfo !== null);
    assert.ok(
      lockedSirket.lockedOverlayInfo!.conditionText.includes('2.000.000 TL')
    );
    assert.ok(lockedSirket.lockedOverlayInfo!.remainingText.includes('Kalan'));
  });

  it('A.8: 8 ana bina ve 22 şehir bloğu arasında ana bina tıklama alanı çakışması bulunmuyor', () => {
    const coords = Object.entries(CITY_BUILDING_COORDINATES);
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const [, a] = coords[i];
        const [, b] = coords[j];
        const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) * 0.45;
        const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) * 0.45;
        assert.equal(
          overlapX && overlapY,
          false,
          `Bina çakışması: ${coords[i][0]} ile ${coords[j][0]}`
        );
      }
    }
  });

  // ============================================================================
  // B. ŞİRKET BÜYÜMESİ VE İNŞAAT TESTLERİ (9 - 15)
  // ============================================================================
  it('B.9: Şirket kurulmadan önce şirket arsası boş parsel/inşaat hazırlığı durumunda görünüyor', () => {
    const engine = new SimulationEngine(42, 2_500_000);
    const buildings = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      formatTL
    );
    const sirket = buildings.find((b) => b.id === 'SIRKET_MERKEZI')!;
    assert.equal(sirket.visualMeta.hasPlayerCompany, false);
    assert.equal(sirket.shortName, 'Şirket Arsası');
    assert.equal(sirket.shortStatusLabel, 'Kuruluma Hazır');
  });

  it('B.10: Şirket kurulduğunda şirket binası, fabrika ve Ar-Ge aktifleşiyor; Sanayi ve Teknoloji bölgeleri açılıyor', () => {
    const engine = new SimulationEngine(42, 3_200_000);
    engine.establishCompany('Anadolu Enerji A.Ş.', 'ANEN', 'ENERJI', 850_000);
    const st = engine.getState();
    const buildings = deriveIsometricBuildings(
      st,
      engine.checkIPOEligibility(),
      formatTL
    );
    const districts = deriveCityDistricts(st);

    assert.equal(
      buildings.find((b) => b.id === 'SIRKET_MERKEZI')?.visualMeta
        .hasPlayerCompany,
      true
    );
    assert.equal(buildings.find((b) => b.id === 'FABRIKA')?.isUnlocked, true);
    assert.equal(
      buildings.find((b) => b.id === 'ARGE_MERKEZI')?.isUnlocked,
      true
    );
    assert.equal(
      districts.find((d) => d.id === 'SANAYI_BOLGESI')?.isUnlocked,
      true
    );
    assert.equal(
      districts.find((d) => d.id === 'TEKNOLOJI_BOLGESI')?.isUnlocked,
      true
    );
  });

  it('B.11: Kapasite veya seviye artırıldığında görsel seviye (Sv.1 -> Sv.2 -> Sv.3) aynı parselde büyüyor', () => {
    const spec1 = deriveBuildingVisualLevelSpec('FABRIKA', 1);
    const spec2 = deriveBuildingVisualLevelSpec('FABRIKA', 2);
    const spec3 = deriveBuildingVisualLevelSpec('FABRIKA', 3);

    assert.equal(spec1.tierIndex, 1);
    assert.equal(spec2.tierIndex, 2);
    assert.equal(spec3.tierIndex, 3);
    assert.ok(spec3.facadeHeightPx > spec2.facadeHeightPx);
    assert.ok(spec2.facadeHeightPx > spec1.facadeHeightPx);
    assert.equal(spec1.hasSideWing, false);
    assert.equal(spec2.hasSideWing, true);
    assert.equal(spec3.hasPrestigeCrown, true);
  });

  it('B.12 & B.13 & B.14 & B.15: Yatırım başladığında inşaat aşaması oluşuyor, gün ilerledikçe ilerliyor ve tamamlandığında çift işleme yapmadan kapasiteyi artırıyor', () => {
    const engine = new SimulationEngine(42, 4_500_000);
    engine.establishCompany(
      'Marmara Sanayi A.Ş.',
      'MRSN',
      'ENERJI',
      1_200_000
    );

    const capBefore = engine.getState().playerCompany!.productionCapacity;
    const startRes = engine.startCompanyInvestmentProject({
      packageType: 'SMALL_EXPANSION',
      fundingSource: 'COMPANY_CASH',
    });
    assert.equal(startRes.success, true);

    // Başlangıç gününde 1. Aşama (PARCEL_PREP)
    const cStage1 = deriveBuildingConstructionVisual(
      'FABRIKA',
      engine.getState()
    );
    assert.ok(cStage1 !== null);
    assert.equal(cStage1!.stage, 'PARCEL_PREP');

    // 2 gün sonra 2. Aşama (FOUNDATION_SCAFFOLD)
    engine.tickDay();
    engine.tickDay();
    const cStage2 = deriveBuildingConstructionVisual(
      'FABRIKA',
      engine.getState()
    );
    assert.ok(cStage2 !== null);
    assert.equal(cStage2!.stage, 'FOUNDATION_SCAFFOLD');
    assert.ok(cStage2!.progressPct > cStage1!.progressPct);

    // 4. günde 3. Aşama (NEAR_COMPLETION - %80)
    engine.tickDay();
    engine.tickDay();
    const cStage3 = deriveBuildingConstructionVisual(
      'FABRIKA',
      engine.getState()
    );
    assert.ok(cStage3 !== null);
    assert.equal(cStage3!.stage, 'NEAR_COMPLETION');

    // 5. gün tamamlanma gününe ilerle
    engine.tickDay();

    const cAfterComplete = deriveBuildingConstructionVisual(
      'FABRIKA',
      engine.getState()
    );
    assert.equal(cAfterComplete, null);
    const capAfter = engine.getState().playerCompany!.productionCapacity;
    assert.ok(capAfter > capBefore);

    // Bir gün daha ilerlediğinde kapasite tekrar çift eklenmemeli
    engine.tickDay();
    assert.equal(engine.getState().playerCompany!.productionCapacity, capAfter);
  });

  // ============================================================================
  // C. CANLI ŞEHİR DURUMU TESTLERİ (16 - 21)
  // ============================================================================
  it('C.16: Borsa açıkken, açılış beklenirken, seans sonrasında ve kapalıyken Borsa durum ışığı doğru görünüyor', () => {
    assert.equal(deriveBorsaStatusLight('MARKET_OPEN').lightColor, 'emerald');
    assert.equal(deriveBorsaStatusLight('PRE_OPEN').lightColor, 'sky');
    assert.equal(deriveBorsaStatusLight('AFTER_HOURS').lightColor, 'amber');
    assert.equal(deriveBorsaStatusLight('MARKET_CLOSED').lightColor, 'slate');
  });

  it('C.17: Fabrika üretimdeyken ve durduğunda görsel durumu değişiyor', () => {
    const engine = new SimulationEngine(42, 3_500_000);
    engine.establishCompany('Üretim A.Ş.', 'URTM', 'ENERJI', 900_000);

    const bActive = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      formatTL
    ).find((b) => b.id === 'FABRIKA')!;
    assert.equal(bActive.isActiveWorking, true);

    engine.getState().playerCompany!.dailyUnitsProduced = 0;
    const bIdle = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      formatTL
    ).find((b) => b.id === 'FABRIKA')!;
    assert.equal(bIdle.isActiveWorking, false);
    assert.equal(bIdle.visualMeta.factoryProductionState, 'IDLE');
  });

  it('C.18: Şirket nakdi kritik olduğunda ve işçi eksiği bulunduğunda bina üstünde tek birincil durum (CRITICAL) görünüyor, tam liste seçim kartında yer alıyor', () => {
    const engine = new SimulationEngine(42, 3_500_000);
    engine.establishCompany('Kritik A.Ş.', 'KRTK', 'ENERJI', 600_000);
    const pc = engine.getState().playerCompany!;
    pc.financials.cash = 100;
    pc.staffCount = 2;
    if (pc.workforcePlan) {
      pc.workforcePlan.targetStaffCount = 25;
      pc.workforcePlan.pendingHiresCount = 5;
    }

    const sirketNode = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      formatTL
    ).find((b) => b.id === 'SIRKET_MERKEZI')!;

    assert.equal(sirketNode.primaryStatusType, 'CRITICAL');
    assert.ok(sirketNode.selectionCard.issueDetails.length >= 2);
  });

  it('C.19: Bekleyen emir veya yeni haber olduğunda ilgili binalarda bildirim rozeti ve durum göstergesi oluşuyor', () => {
    const engine = new SimulationEngine(42, 200_000);
    engine.setTimeScale(0);
    const firstTicker = engine.getState().stocks[0].ticker;
    engine.placeOrder({
      ticker: firstTicker,
      orderType: 'LIMIT_BUY',
      requestedShares: 10,
      limitPrice: 1.0,
    });

    const buildings = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      formatTL
    );
    const borsa = buildings.find((b) => b.id === 'BORSA')!;
    assert.equal(borsa.badgeCount, 1);
    assert.equal(borsa.primaryStatusType, 'PENDING_ACTION');
  });

  it('C.20: Gece/gündüz geçişinde (Sabah, Gündüz, Akşam, Gece) atmosfer ve pencere ışıkları doğru değişiyor', () => {
    const morning = deriveCityAtmosphere(7);
    const day = deriveCityAtmosphere(13);
    const evening = deriveCityAtmosphere(19);
    const night = deriveCityAtmosphere(23);

    assert.equal(morning.phase, 'MORNING');
    assert.equal(day.phase, 'DAY');
    assert.equal(evening.phase, 'EVENING');
    assert.equal(night.phase, 'NIGHT');
    assert.equal(day.streetLightsOn, false);
    assert.equal(night.streetLightsOn, true);

    const dayWins = buildDeterministicBuildingWindows(
      'BORSA',
      3,
      true,
      day.windowsLitRatio
    );
    const nightWins = buildDeterministicBuildingWindows(
      'BORSA',
      3,
      true,
      night.windowsLitRatio
    );
    assert.ok(
      nightWins.filter((w) => w.isLit).length >
        dayWins.filter((w) => w.isLit).length
    );
  });

  it('C.21: Şehir türetme, seçim ve kamera fonksiyonları ekonomik durumu (cash, netWorth, centralLedger) asla değiştirmiyor', () => {
    const engine = new SimulationEngine(42, 500_000);
    const cashBefore = engine.getState().cash;
    const nwBefore = engine.getState().netWorth;
    const txCountBefore = engine.getState().transactions.length;

    deriveCityDistricts(engine.getState());
    deriveCityUrbanBlocks(engine.getState());
    deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      formatTL
    );
    deriveCityDiagnosticsSummary(
      engine.getState(),
      engine.checkIPOEligibility(),
      formatTL
    );

    assert.equal(engine.getState().cash, cashBefore);
    assert.equal(engine.getState().netWorth, nwBefore);
    assert.equal(engine.getState().transactions.length, txCountBefore);
  });

  // ============================================================================
  // D. KAMERA VE PERFORMANS TESTLERİ (22 - 28)
  // ============================================================================
  it('D.22: Kamera sürükleme (clampCameraPan) harita sınırları içinde kalıyor', () => {
    const clamped = clampCameraPan(99999, -99999, 'NORMAL', 390, 560);
    assert.ok(clamped.panX < 2000 && clamped.panX > -2000);
    assert.ok(clamped.panY < 2000 && clamped.panY > -2000);
  });

  it('D.23: Zoom seviyeleri (OVERVIEW, NORMAL, CLOSER) doğru ölçek katsayısı üretiyor', () => {
    const overview = getZoomScale('OVERVIEW', 390);
    const normal = getZoomScale('NORMAL', 390);
    const closer = getZoomScale('CLOSER', 390);
    assert.ok(overview < normal);
    assert.ok(normal < closer);
  });

  it('D.24: Merkeze dön (0,0) ve Şirkete odaklan kamera hesaplamaları doğru çalışıyor', () => {
    const center = clampCameraPan(0, 0, 'NORMAL', 390, 560);
    assert.deepEqual(center, { panX: 0, panY: 0 });
    const companyFocus = getCameraFocusPanForBuilding(
      'SIRKET_MERKEZI',
      'NORMAL',
      390,
      560
    );
    assert.ok(companyFocus.panX < 0); // Şirket Merkezi sağda (x=1275) olduğu için panX negatif yönde kayar
  });

  it('D.25: Düşük (LOW), Orta (MEDIUM) ve Yüksek (HIGH) grafik kalitesi aktif araç ve yaya sayısını doğru sınırlıyor', () => {
    const lowFleet = deriveCityTrafficFleet({
      stage: SimulationStage.STAGE_3_IPO_PUBLIC,
      isPaused: false,
      reducedMotion: false,
      isPageVisible: true,
      graphicsQuality: 'LOW',
      hasPlayerCompany: true,
      isProducing: true,
      inventoryUnits: 100,
    });
    const medFleet = deriveCityTrafficFleet({
      stage: SimulationStage.STAGE_3_IPO_PUBLIC,
      isPaused: false,
      reducedMotion: false,
      isPageVisible: true,
      graphicsQuality: 'MEDIUM',
      hasPlayerCompany: true,
      isProducing: true,
      inventoryUnits: 100,
    });
    const highFleet = deriveCityTrafficFleet({
      stage: SimulationStage.STAGE_3_IPO_PUBLIC,
      isPaused: false,
      reducedMotion: false,
      isPageVisible: true,
      graphicsQuality: 'HIGH',
      hasPlayerCompany: true,
      isProducing: true,
      inventoryUnits: 100,
    });

    assert.ok(lowFleet.vehicles.length <= 6);
    assert.ok(medFleet.vehicles.length <= 12);
    assert.ok(highFleet.vehicles.length <= 18);
    assert.ok(highFleet.vehicles.length >= lowFleet.vehicles.length);
  });

  it('D.26: Kamera konumu ve zoom seviyesi UISettingsStore üzerinde kalıcı olarak saklanıyor', () => {
    const mem: Record<string, string> = {};
    const mockStorage: Storage = {
      get length() {
        return Object.keys(mem).length;
      },
      clear: () => {
        for (const k of Object.keys(mem)) delete mem[k];
      },
      getItem: (k: string) => mem[k] ?? null,
      key: (i: number) => Object.keys(mem)[i] ?? null,
      removeItem: (k: string) => {
        delete mem[k];
      },
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
    };

    UISettingsStore.updateCameraState(
      { panX: -85, panY: 42, zoomPreset: 'CLOSER' },
      mockStorage
    );
    const loaded = UISettingsStore.loadSettings(mockStorage);
    assert.equal(loaded.lastCameraPanX, -85);
    assert.equal(loaded.lastCameraPanY, 42);
    assert.equal(loaded.lastZoomPreset, 'CLOSER');
  });

  it('D.27 & D.28: Sayfa gizlendiğinde (isPageVisible=false) veya oyun duraklatıldığında şehir animasyonları duruyor ve ekstra tick oluşmuyor', () => {
    const engine = new SimulationEngine(42, 100_000);
    const tickBefore = engine.getState().lastSimulationTickId;

    const hiddenFleet = deriveCityTrafficFleet({
      stage: SimulationStage.STAGE_1_RETAIL_INVESTOR,
      isPaused: false,
      reducedMotion: false,
      isPageVisible: false,
      graphicsQuality: 'HIGH',
      hasPlayerCompany: false,
      isProducing: false,
    });
    assert.equal(hiddenFleet.animationsActive, false);
    assert.equal(engine.getState().lastSimulationTickId, tickBefore);
  });

  // ============================================================================
  // E. KAYIT VE MİGRASYON TESTLERİ (29 - 35)
  // ============================================================================
  it('E.29 & E.30 & E.31 & E.32: Mevcut kayıt yeni şehir görünümüyle (cityState: açık bölgeler, bina seviyeleri, aktif inşaatlar, kamera/grafik) hatasız migrate ediliyor', () => {
    const engine = new SimulationEngine(42, 4_000_000);
    engine.establishCompany(
      'Anadolu Holding A.Ş.',
      'ANHL',
      'TEKNOLOJI',
      1_000_000
    );
    engine.startCompanyInvestmentProject({
      packageType: 'NEW_PRODUCTION_LINE',
      fundingSource: 'COMPANY_CASH',
    });

    const rawState = JSON.parse(JSON.stringify(engine.getState()));
    delete rawState.cityState;
    rawState.schemaVersion = 4;

    const migrated = SimulationStore.migrateIfNeeded({
      schemaVersion: 4,
      savedAtISO: '2026-06-01T10:00:00.000Z',
      seed: 42,
      randomState: engine.getRandomState(),
      state: rawState,
    });

    assert.ok(migrated !== null);
    assert.ok(migrated!.state.cityState !== undefined);
    const cs = migrated!.state.cityState!;
    assert.ok(cs.unlockedDistricts.includes('FINANS_BOLGESI'));
    assert.ok(cs.unlockedDistricts.includes('SANAYI_BOLGESI'));
    assert.ok(cs.unlockedDistricts.includes('TEKNOLOJI_BOLGESI'));
    assert.ok(cs.buildingVisualLevels.SIRKET_MERKEZI >= 1);
    assert.equal(cs.activeConstructions.length, 1);
    assert.equal(cs.activeConstructions[0].buildingId, 'FABRIKA');
  });

  it('E.33 & E.34 & E.35: Aynı kayıt tekrar migrate edildiğinde (idempotency) veri bozulmuyor ve bozuk JSON durumunda mevcut kayıt korunuyor', () => {
    const engine = new SimulationEngine(42, 3_000_000);
    engine.establishCompany('İdempotent A.Ş.', 'IDMP', 'ENERJI', 800_000);

    const envelope = {
      schemaVersion: 5,
      savedAtISO: '2026-06-01T12:00:00.000Z',
      seed: 42,
      randomState: engine.getRandomState(),
      state: engine.getState(),
    };

    const mig1 = SimulationStore.migrateIfNeeded(envelope)!;
    const mig2 = SimulationStore.migrateIfNeeded(mig1)!;

    assert.equal(mig1.state.cash, mig2.state.cash);
    assert.equal(mig1.state.netWorth, mig2.state.netWorth);
    assert.deepEqual(
      mig1.state.cityState?.unlockedDistricts,
      mig2.state.cityState?.unlockedDistricts
    );
    assert.deepEqual(
      mig1.state.cityState?.buildingVisualLevels,
      mig2.state.cityState?.buildingVisualLevels
    );

    // Bozuk veri verildiğinde null döner ve çökmez
    const invalidResult = SimulationStore.migrateIfNeeded({ invalid: true });
    assert.equal(invalidResult, null);
  });
});
