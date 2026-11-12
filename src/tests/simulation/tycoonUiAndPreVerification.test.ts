import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SimulationEngine,
  GameClockEngine,
  SimulationStage,
} from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import {
  deriveCityBuildingsFromState,
  formatDateTR,
  getMarketSessionBadgeMeta,
} from '../../components/game/gameTypes';

test('ÖNCE DOĞRULAMA 1: 1435. oyun dakikasından 10 dakika ilerletildiğinde yalnızca bir gün kapanır', () => {
  const engine = new SimulationEngine(20261104, 100_000);
  // 00:00 -> 23:55 (1435. dakika)
  const step1 = engine.advanceGameMinutes(1435);
  assert.equal(step1.daysClosed, 0);
  assert.equal(engine.getState().day, 1);
  assert.equal(engine.getState().minutesIntoCurrentDay, 1435);
  assert.equal(engine.getFormattedGameTime(), '23:55');

  // 1435. dakikadan +10 dakika ilerlet -> Gün 2 Saat 00:05 olmalı ve yalnızca 1 gün kapanmalı
  const step2 = engine.advanceGameMinutes(10);
  assert.equal(step2.gameMinutesAdvanced, 10);
  assert.equal(step2.daysClosed, 1);
  assert.equal(engine.getState().day, 2);
  assert.equal(engine.getState().minutesIntoCurrentDay, 5);
  assert.equal(engine.getFormattedGameTime(), '00:05');
  assert.equal(engine.getState().dailyLogs.length, 2);
});

test('ÖNCE DOĞRULAMA 2 & 3: tickDay() ve closeCurrentDay() aynı günü iki kez kapatmaz; gün sonu üretim, gelir, gider ve fiyat hareketleri iki kez uygulanmaz', () => {
  const engineIntraday = new SimulationEngine(20261104, 2_500_000);
  engineIntraday.establishCompany(
    'Anadolu Üretim A.Ş.',
    'ANUR',
    'TEKNOLOJI',
    1_000_000,
    {
      initialStaffCount: 30,
      initialCapacity: 50,
      initialRdBudget: 15_000,
    }
  );

  // 1440 dakika boyunca tüm gün içi adımlar (288 şirket adımı, 96 açık piyasa adımı) işlenir ve Gün 1 kapanır
  const res = engineIntraday.advanceGameMinutes(1440);
  assert.equal(res.daysClosed, 1);
  assert.equal(engineIntraday.getState().day, 2);
  assert.equal(engineIntraday.getState().playerCompany?.operatingDays, 1);

  const cashAfterDay1 = engineIntraday.getState().playerCompany?.financials.cash;
  const priceHistoryLenAfterDay1 =
    engineIntraday.getState().stocks[0].priceHistory.length;

  // Gün 1 zaten kapandığı için closeCurrentDay(1) çağrılırsa aynı günü tekrar kapatmaz
  const duplicateCloseLog = engineIntraday.closeCurrentDay(1);
  assert.equal(duplicateCloseLog.day, 2);
  assert.equal(engineIntraday.getState().day, 2);
  assert.equal(
    engineIntraday.getState().playerCompany?.financials.cash,
    cashAfterDay1
  );
  assert.equal(
    engineIntraday.getState().stocks[0].priceHistory.length,
    priceHistoryLenAfterDay1
  );
});

test('ÖNCE DOĞRULAMA 4: 15 gerçek dakika (900 sn) tam olarak 1 oyun günü (1440 oyun dk) ilerletir', () => {
  const engine = new SimulationEngine(20261104, 100_000);
  assert.equal(engine.getState().realMinutesPerGameDay, 15);
  const res = engine.advanceRealSeconds(15 * 60);
  assert.equal(res.gameMinutesAdvanced, 1440);
  assert.equal(res.daysClosed, 1);
  assert.equal(engine.getState().day, 2);
  assert.equal(engine.getFormattedGameTime(), '00:00');
});

test('ÖNCE DOĞRULAMA 5: Sayfa yenilendiğinde (serialize/deserialize) aynı çevrimdışı zaman aralığı yeniden işlenmez ve çevrimdışı özet yalnızca bir kez gösterilir', () => {
  const engine = new SimulationEngine(20261104, 100_000);
  const tStart = '2026-01-02T08:00:00.000Z';
  const tEnd = '2026-01-02T08:15:00.000Z'; // 15 gerçek dk = 1 oyun günü

  const firstSummary = engine.processOfflineProgress(tStart, tEnd);
  assert.equal(firstSummary.gameMinutesAdvanced, 1440);
  assert.equal(firstSummary.gameDaysAdvanced, 1);
  assert.equal(engine.getState().lastOfflineSummaryDismissed, false);

  // Oyuncu "Devam Et" düğmesine bastığında özet onaylanır
  engine.acknowledgeOfflineSummary();
  assert.equal(engine.getState().lastOfflineSummaryDismissed, true);
  assert.equal(engine.getState().lastOfflineSummary, null);

  // Sayfa yenilenmesini (kayıt ve geri yükleme) simüle et
  const savedJson = engine.serializeState();
  const reloadedEngine = SimulationEngine.deserializeState(savedJson);

  // Yenilenen motorda özet tekrar açık olmamalı
  assert.equal(reloadedEngine.getState().lastOfflineSummaryDismissed, true);
  assert.equal(reloadedEngine.getState().lastOfflineSummary, null);

  // Aynı [tStart, tEnd] çevrimdışı zaman aralığı yeniden gönderildiğinde asla tekrar işlenmemeli
  const secondSummaryAfterReload = reloadedEngine.processOfflineProgress(
    tStart,
    tEnd
  );
  assert.equal(secondSummaryAfterReload.gameMinutesAdvanced, 0);
  assert.equal(secondSummaryAfterReload.gameDaysAdvanced, 0);
  assert.equal(reloadedEngine.getState().day, 2);
});

test('ÖNCE DOĞRULAMA 6 & UI Test 9-10: Tekil (Singleton) SimulationEngine örneği korunur; görünüm geçişleri ikinci engine oluşturmaz ve state sıfırlamaz', () => {
  const firstRef = SimulationStore.resetSharedEngine();
  assert.equal(SimulationStore.getSharedEngineCreationCount(), 1);

  // Oyuncu işlem yapar ve saati ilerletir
  firstRef.placeOrder({
    ticker: 'NVEX',
    orderType: 'LIMIT_BUY',
    requestedShares: 30,
    limitPrice: 120.0,
  });
  firstRef.advanceGameMinutes(120); // Saat 02:00

  // Geliştirici paneline geçiş ve geri dönüş aynı paylaşılan örneği alır
  const secondRef = SimulationStore.getSharedEngine();
  assert.strictEqual(firstRef, secondRef);
  assert.equal(SimulationStore.getSharedEngineCreationCount(), 1);
  assert.equal(secondRef.getFormattedGameTime(), '02:00');
  assert.equal(secondRef.getState().pendingOrders.length, 1);
});

test('UI Test 1-3 & 11-12: Tycoon şehir binaları başlangıçta doğru kilit durumundadır ve aşamalar açıldıkça bina durumları güncellenir', () => {
  const engine = new SimulationEngine(20261104, 100_000);
  const st1 = engine.getState();

  assert.equal(st1.cash, 100_000);
  assert.equal(st1.netWorth, 100_000);
  assert.equal(formatDateTR(st1.dateISO), '01.01.2026');
  assert.equal(
    getMarketSessionBadgeMeta(st1.marketSession).shortLabel,
    'Kapalı'
  );

  const buildingsInitial = deriveCityBuildingsFromState(
    st1,
    engine.checkIPOEligibility(),
    (v) => engine.formatCurrency(v)
  );
  assert.equal(buildingsInitial.length, 8);

  const byId = Object.fromEntries(buildingsInitial.map((b) => [b.id, b]));
  assert.equal(byId.BORSA.isUnlocked, true);
  assert.equal(byId.BANKA.isUnlocked, true);
  assert.equal(byId.HABER_MERKEZI.isUnlocked, true);
  assert.equal(byId.OYUNCU_OFISI.isUnlocked, true);
  // Başlangıçta (100.000 TL < 2.000.000 TL) Şirket, Fabrika, Ar-Ge ve Holding kilitli olmalı ve açılma koşulu bulunmalı
  assert.equal(byId.SIRKET_MERKEZI.isUnlocked, false);
  assert.ok(byId.SIRKET_MERKEZI.unlockRequirementText.includes('2.000.000 TL'));
  assert.equal(byId.FABRIKA.isUnlocked, false);
  assert.equal(byId.ARGE_MERKEZI.isUnlocked, false);
  assert.equal(byId.HOLDING_MERKEZI.isUnlocked, false);

  // Aşama 2 ve şirket kurulduğunda Şirket Merkezi, Fabrika ve Ar-Ge açılmalı
  const richEngine = new SimulationEngine(20261104, 3_000_000);
  richEngine.establishCompany(
    'Turkuaz Robotik A.Ş.',
    'TRKR',
    'TEKNOLOJI',
    1_000_000
  );
  const buildingsStage2 = deriveCityBuildingsFromState(
    richEngine.getState(),
    richEngine.checkIPOEligibility(),
    (v) => richEngine.formatCurrency(v)
  );
  const byIdStage2 = Object.fromEntries(buildingsStage2.map((b) => [b.id, b]));
  assert.equal(byIdStage2.SIRKET_MERKEZI.isUnlocked, true);
  assert.equal(byIdStage2.FABRIKA.isUnlocked, true);
  assert.equal(byIdStage2.ARGE_MERKEZI.isUnlocked, true);

  // %5+ stratejik pay alındığında Holding Merkezi kilidi açılmalı
  const krgo = richEngine
    .getState()
    .stocks.find((s) => s.ticker === 'KRGO')!;
  richEngine.buyStock('KRGO', Math.ceil(krgo.totalShares * 0.06));
  assert.equal(richEngine.getState().stageUnlocks.stage4Holding, true);

  const buildingsStage4 = deriveCityBuildingsFromState(
    richEngine.getState(),
    richEngine.checkIPOEligibility(),
    (v) => richEngine.formatCurrency(v)
  );
  const byIdStage4 = Object.fromEntries(buildingsStage4.map((b) => [b.id, b]));
  assert.equal(byIdStage4.HOLDING_MERKEZI.isUnlocked, true);
});
