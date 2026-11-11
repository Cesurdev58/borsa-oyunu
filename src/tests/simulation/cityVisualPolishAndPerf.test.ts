/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStage } from '../../models/simulation';
import {
  buildDeterministicBuildingWindows,
  CITY_BUILDING_COORDINATES,
  clampCameraPan,
  deriveActivePedestrians,
  deriveActiveVehicles,
  deriveIsometricBuildings,
  STATIC_CITY_DECORATIONS,
} from '../../components/game/city/cityLayout';
import {
  consumeNewCityVisualPulses,
  createInitialCityVisualTracker,
  deriveCityQuestStripModel,
  deriveDeterministicIpoReasonItems,
  deriveDeterministicOfflineWarningItems,
  formatHudCurrencyTR,
} from '../../components/game/city/questAndHudLogic';
import {
  getGraphicsQualityProfile,
  UISettingsStore,
} from '../../state/uiSettingsStore';
import { CityBuildingId } from '../../components/game/gameTypes';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

describe('İzometrik Şehir Görsel Kalite, HUD, Görev Şeridi ve Performans Testleri (20 Test)', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('1. 8 binanın tamamı haritada benzersiz koordinatlarla render edilir', () => {
    const engine = new SimulationEngine(2026);
    const buildings = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    );

    assert.equal(buildings.length, 8);
    const ids = new Set(buildings.map((b) => b.id));
    assert.equal(ids.size, 8);

    const coordKeys = new Set(buildings.map((b) => `${b.x}:${b.y}`));
    assert.equal(coordKeys.size, 8);
  });

  it('2. Hiçbir iki bina hitbox alanı çakışmaz', () => {
    const allIds = Object.keys(CITY_BUILDING_COORDINATES) as CityBuildingId[];
    for (let i = 0; i < allIds.length; i++) {
      for (let j = i + 1; j < allIds.length; j++) {
        const a = CITY_BUILDING_COORDINATES[allIds[i]];
        const b = CITY_BUILDING_COORDINATES[allIds[j]];
        const horizOverlap = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
        const vertOverlap = Math.abs(a.y - b.y) < (a.height + b.height) / 2;
        assert.equal(
          horizOverlap && vertOverlap,
          false,
          `${allIds[i]} ile ${allIds[j]} hitbox alanları çakışmamalıdır`
        );
      }
    }
  });

  it('3. Kilitli binalar şantiye / kilitli görünüm bilgisi üretir', () => {
    const engine = new SimulationEngine(2026);
    const buildings = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    );

    const lockedIds: CityBuildingId[] = [
      'SIRKET_MERKEZI',
      'FABRIKA',
      'ARGE_MERKEZI',
      'HOLDING_MERKEZI',
    ];

    for (const id of lockedIds) {
      const node = buildings.find((b) => b.id === id);
      assert.ok(node);
      assert.equal(node.isUnlocked, false);
      assert.equal(node.isActiveWorking, false);
      assert.equal(node.shortStatusLabel, 'Kilitli');
      assert.ok(node.lockedOverlayInfo !== null);
    }
  });

  it('4. Kilitli binaya dokunulunca kilit koşulu gösterilir', () => {
    const engine = new SimulationEngine(2026);
    const buildings = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    );

    const sirket = buildings.find((b) => b.id === 'SIRKET_MERKEZI')!;
    const fabrika = buildings.find((b) => b.id === 'FABRIKA')!;
    const arge = buildings.find((b) => b.id === 'ARGE_MERKEZI')!;
    const holding = buildings.find((b) => b.id === 'HOLDING_MERKEZI')!;

    assert.match(sirket.lockedOverlayInfo!.conditionText, /2\.000\.000/);
    assert.match(fabrika.lockedOverlayInfo!.conditionText, /şirketinizi kurduğunuzda/);
    assert.match(arge.lockedOverlayInfo!.conditionText, /şirketinizi kurduğunuzda/);
    assert.match(holding.lockedOverlayInfo!.conditionText, /%5/);
  });

  it('5. Açık binaya dokunulunca doğru yönetim paneli açılır', () => {
    const engine = new SimulationEngine(2026);
    const buildings = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    );

    const unlockedIds: CityBuildingId[] = [
      'BORSA',
      'BANKA',
      'HABER_MERKEZI',
      'OYUNCU_OFISI',
    ];

    for (const id of unlockedIds) {
      const node = buildings.find((b) => b.id === id);
      assert.ok(node);
      assert.equal(node.isUnlocked, true);
      assert.equal(node.id, id);
      assert.ok(node.shortName.length >= 4);
      assert.ok(node.fullTitle.length >= 5);
      assert.equal(node.lockedOverlayInfo, null);
    }
  });

  it('6. Borsa açıkken Borsa Binası aktif görsel durum üretir', () => {
    const engine = new SimulationEngine(2026);
    engine.advanceGameMinutes(600); // Saat 10:00 -> MARKET_OPEN

    const buildings = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    );
    const borsa = buildings.find((b) => b.id === 'BORSA')!;

    assert.equal(engine.getState().marketSession, 'MARKET_OPEN');
    assert.equal(borsa.isActiveWorking, true);
    assert.equal(borsa.shortStatusLabel, 'Açık');
  });

  it('7. Borsa kapalıyken Borsa Binası kapalı görsel durum üretir', () => {
    const engine = new SimulationEngine(2026); // Başlangıç 00:00 -> MARKET_CLOSED
    const buildings = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    );
    const borsa = buildings.find((b) => b.id === 'BORSA')!;

    assert.equal(engine.getState().marketSession, 'MARKET_CLOSED');
    assert.equal(borsa.isActiveWorking, false);
    assert.equal(borsa.shortStatusLabel, 'Kapalı');
  });

  it('8. Yeni haber geldiğinde Haber Merkezi bildirim durumu üretir', () => {
    const engine = new SimulationEngine(2026);
    const tracker = createInitialCityVisualTracker(engine.getState());

    // Yeni güne ilerleyerek yeni haber üretilmesini sağla
    engine.tickDay();
    const pulses = consumeNewCityVisualPulses(tracker, engine.getState());

    const newsPulse = pulses.find((p) => p.kind === 'NEW_NEWS_PULSE');
    assert.ok(newsPulse);
    assert.equal(newsPulse.buildingId, 'HABER_MERKEZI');

    // Aynı state ile tekrar çağrıldığında tekrar tetiklenmemelidir
    const repeat = consumeNewCityVisualPulses(tracker, engine.getState());
    assert.equal(
      repeat.filter((p) => p.kind === 'NEW_NEWS_PULSE').length,
      0
    );
  });

  it('9. Oyuncu şirketi kurulduğunda Şirket Arsası kurumsal merkez durumuna geçer', () => {
    const engine = new SimulationEngine(20260101, 2_500_000);

    const beforeFounding = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    ).find((b) => b.id === 'SIRKET_MERKEZI')!;

    assert.equal(beforeFounding.isUnlocked, true);
    assert.equal(beforeFounding.shortName, 'Şirket Arsası');
    assert.equal(beforeFounding.visualMeta.hasPlayerCompany, false);

    const res = engine.establishCompany(
      'Anadolu Kuantum Teknoloji A.Ş.',
      'ANKT',
      'TEKNOLOJI',
      800_000,
      { initialStaffCount: 25, initialCapacity: 40, initialRdBudget: 15_000 }
    );
    assert.equal(res.success, true);

    const afterFounding = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    ).find((b) => b.id === 'SIRKET_MERKEZI')!;

    assert.equal(afterFounding.isUnlocked, true);
    assert.equal(afterFounding.shortName, 'ANKT Merkez');
    assert.equal(afterFounding.visualMeta.hasPlayerCompany, true);
    assert.equal(afterFounding.visualMeta.companyTicker, 'ANKT');
    assert.equal(afterFounding.level, 2);
  });

  it('10. Fabrika üretim yaparken aktif üretim görsel durumu üretir', () => {
    const engine = new SimulationEngine(20260101, 2_500_000);

    engine.establishCompany(
      'Anadolu Üretim Sanayi A.Ş.',
      'ANUR',
      'ENERJI',
      900_000,
      { initialStaffCount: 30, initialCapacity: 50, initialRdBudget: 10_000 }
    );

    const buildings = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    );
    const fabrika = buildings.find((b) => b.id === 'FABRIKA')!;

    assert.equal(fabrika.isUnlocked, true);
    assert.equal(fabrika.isActiveWorking, true);
    assert.equal(fabrika.visualMeta.isFactoryProducing, true);

    // Teslimat aracı (DELIVERY_TRUCK) yüksek grafik modunda aktif olur
    const vehiclesHigh = deriveActiveVehicles(
      2,
      false,
      false,
      true,
      'HIGH',
      true,
      true
    );
    assert.equal(vehiclesHigh.vehicles.length, 3);
    assert.ok(
      vehiclesHigh.vehicles.some((v) => v.vehicleType === 'DELIVERY_TRUCK')
    );
  });

  it('11. Ar-Ge bütçesi aktifken Ar-Ge Merkezi aktif görsel durumu üretir', () => {
    const engine = new SimulationEngine(20260101, 2_500_000);

    engine.establishCompany(
      'Anadolu Biyoteknoloji A.Ş.',
      'ANBT',
      'BIYOTEKNOLOJI',
      900_000,
      { initialStaffCount: 25, initialCapacity: 40, initialRdBudget: 20_000 }
    );

    const argeActive = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    ).find((b) => b.id === 'ARGE_MERKEZI')!;

    assert.equal(argeActive.isUnlocked, true);
    assert.equal(argeActive.isActiveWorking, true);
    assert.equal(argeActive.visualMeta.isRdActive, true);

    // Ar-Ge bütçesi 0 yapıldığında aktif laboratuvar parıltısı kapanır
    engine.configureCompanyOperations({ dailyRdBudget: 0 });
    const argeIdle = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    ).find((b) => b.id === 'ARGE_MERKEZI')!;

    assert.equal(argeIdle.visualMeta.isRdActive, false);
  });

  it('12. Holding aşaması açıldığında Holding Kulesi aktif görsel duruma geçer', () => {
    const engine = new SimulationEngine(20260101, 3_500_000);
    const tracker = createInitialCityVisualTracker(engine.getState());

    const krgo = engine.getState().stocks.find((s) => s.ticker === 'KRGO')!;
    const buyRes = engine.buyStock('KRGO', Math.ceil(krgo.totalShares * 0.06));
    assert.equal(buyRes.success, true);

    const holdingNode = deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    ).find((b) => b.id === 'HOLDING_MERKEZI')!;

    assert.equal(holdingNode.isUnlocked, true);
    assert.equal(holdingNode.shortStatusLabel, 'Açık');

    const pulses = consumeNewCityVisualPulses(tracker, engine.getState());
    assert.ok(pulses.some((p) => p.kind === 'HOLDING_UNLOCK_PULSE'));
  });

  it('13. Kamera sürükleme sınırları harita dışına taşmaz', () => {
    const farRightBottom = clampCameraPan(99999, 99999, 'NORMAL', 390, 560);
    const farLeftTop = clampCameraPan(-99999, -99999, 'NORMAL', 390, 560);

    assert.ok(farRightBottom.panX <= 600);
    assert.ok(farRightBottom.panY <= 450);
    assert.ok(farLeftTop.panX >= -600);
    assert.ok(farLeftTop.panY >= -450);
  });

  it('14. Merkeze dön butonu kamerayı varsayılan konuma döndürür', () => {
    const centered = clampCameraPan(0, 0, 'NORMAL', 390, 560);
    assert.equal(centered.panX, 0);
    assert.equal(centered.panY, 0);
  });

  it('15. Üst HUD büyük para değerlerini kısaltılmış biçimde ve tam değer erişimiyle gösterir', () => {
    const c1 = formatHudCurrencyTR(106_328, 'Nakit');
    assert.equal(c1.abbreviated, '106.328 TL');
    assert.equal(c1.full, '106.328 TL');

    const c2 = formatHudCurrencyTR(7_641_143, 'Net Varlık');
    assert.equal(c2.abbreviated, '7,64 Mn TL');
    assert.equal(c2.full, '7.641.143 TL');
    assert.match(c2.ariaLabel, /7\.641\.143/);

    const c3 = formatHudCurrencyTR(33_240_000, 'Nakit');
    assert.equal(c3.abbreviated, '33,24 Mn TL');
    assert.equal(c3.full, '33.240.000 TL');

    const c4 = formatHudCurrencyTR(1_200_000_000, 'Net Varlık');
    assert.equal(c4.abbreviated, '1,20 Mr TL');
    assert.equal(c4.full, '1.200.000.000 TL');
  });

  it('16. İlk görev şeridi aynı anda yalnızca 1 aktif görev gösterir', () => {
    const engine = new SimulationEngine(2026);
    const questModel0 = deriveCityQuestStripModel(engine.getState(), false);

    // Yalnızca tek bir activeQuest nesnesi döner ve ilk görev "Borsa Binasını aç"tır
    assert.ok(questModel0.activeQuest);
    assert.equal(questModel0.activeQuest.id, 'quest-01-open-borsa');
    assert.equal(questModel0.activeQuest.title, 'Borsa Binasını aç');
    assert.equal(questModel0.allQuests.length, 8);

    // Borsa binası açıldığında sıradaki tek aktif görev "İlk hisse emrini oluştur" olur
    const questModel1 = deriveCityQuestStripModel(engine.getState(), true);
    assert.equal(questModel1.activeQuest.id, 'quest-02-first-order');
    assert.equal(
      questModel1.activeQuest.title,
      'İlk hisse emrini oluştur'
    );
  });

  it('17. Grafik kalitesi Düşük / Orta / Yüksek seçimi kaydedilir ve uygulanır', () => {
    const def = UISettingsStore.loadSettings(storage);
    assert.equal(def.graphicsQuality, 'MEDIUM');

    UISettingsStore.setGraphicsQuality('LOW', storage);
    const afterLow = UISettingsStore.loadSettings(storage);
    assert.equal(afterLow.graphicsQuality, 'LOW');
    const lowProfile = getGraphicsQualityProfile(afterLow.graphicsQuality);
    assert.equal(lowProfile.maxVehicles, 1);
    assert.equal(lowProfile.maxPedestrians, 0);
    assert.equal(lowProfile.reducedShadows, true);
    assert.equal(lowProfile.particlesEnabled, false);

    UISettingsStore.setGraphicsQuality('HIGH', storage);
    const afterHigh = UISettingsStore.loadSettings(storage);
    assert.equal(afterHigh.graphicsQuality, 'HIGH');
    const highProfile = getGraphicsQualityProfile(afterHigh.graphicsQuality);
    assert.equal(highProfile.maxVehicles, 3);
    assert.equal(highProfile.maxPedestrians, 4);
    assert.equal(highProfile.reducedShadows, false);
    assert.equal(highProfile.particlesEnabled, true);
  });

  it('18. Ses ayarları kaydedilir ve geri yüklenir', () => {
    const initial = UISettingsStore.loadSettings(storage);
    assert.equal(initial.audio.isMuted, false);
    assert.equal(initial.audio.masterVolume, 75);

    UISettingsStore.updateAudio(
      {
        masterVolume: 40,
        effectsVolume: 55,
        musicVolume: 25,
        isMuted: true,
      },
      storage
    );

    const reloaded = UISettingsStore.loadSettings(storage);
    assert.equal(reloaded.audio.masterVolume, 40);
    assert.equal(reloaded.audio.effectsVolume, 55);
    assert.equal(reloaded.audio.musicVolume, 25);
    assert.equal(reloaded.audio.isMuted, true);
  });

  it('19. Yeni eklenen dekoratif öğeler ve pencereler benzersiz kimlik üretir', () => {
    // Dekorasyon kimlikleri
    const decIds = STATIC_CITY_DECORATIONS.map((d) => d.id);
    const uniqueDecIds = new Set(decIds);
    assert.equal(uniqueDecIds.size, decIds.length);
    assert.ok(decIds.includes('tree-finance-square-north-1'));
    assert.ok(decIds.includes('lamp-main-road-east-2'));

    // Bina pencere kimlikleri
    const borsaWindows = buildDeterministicBuildingWindows('BORSA', 3, true, 0.5);
    assert.equal(borsaWindows.length, 6);
    assert.equal(borsaWindows[0].id, 'window-borsa-floor-1-col-1');
    const winIds = new Set(borsaWindows.map((w) => w.id));
    assert.equal(winIds.size, borsaWindows.length);

    // IPO nedenleri ve Çevrimdışı uyarıları deterministik kimlik üretir
    const ipoReasons = deriveDeterministicIpoReasonItems([
      'Yıllık ciro yetersiz',
      'Faaliyet günü yetersiz',
    ]);
    assert.equal(new Set(ipoReasons.map((r) => r.id)).size, 2);

    const offlineWarnings = deriveDeterministicOfflineWarningItems(
      ['Test uyarısı 1', 'Test uyarısı 2'],
      1,
      2
    );
    assert.equal(new Set(offlineWarnings.map((w) => w.id)).size, 2);
  });

  it('20. Bina animasyonları ve araç hareketleri ekonomik state\'i değiştirmez', () => {
    const engine = new SimulationEngine(2026);
    const snapshotBefore = JSON.stringify(engine.getState());

    const tracker = createInitialCityVisualTracker(engine.getState());
    consumeNewCityVisualPulses(tracker, engine.getState());
    deriveIsometricBuildings(
      engine.getState(),
      engine.checkIPOEligibility(),
      (v) => engine.formatCurrency(v)
    );
    deriveActiveVehicles(2, false, false, true, 'HIGH', true, true);
    deriveActivePedestrians(false, false, true, 'HIGH');
    deriveCityQuestStripModel(engine.getState(), true);

    const snapshotAfter = JSON.stringify(engine.getState());
    assert.equal(snapshotAfter, snapshotBefore);
  });
});
