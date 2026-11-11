import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SimulationEngine,
  GameClockEngine,
} from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';

test('1-6. Oyun Saati: 00:00 başlangıç, 45 dk varsayılan gün, 1x/2x hız dönüşümleri ve duraklatma', () => {
  const engine = new SimulationEngine(20261104);
  const st0 = engine.getState();

  // 1. Yeni oyun 00.00 saatinde başlıyor
  assert.equal(st0.currentGameHour, 0);
  assert.equal(st0.currentGameMinute, 0);
  assert.equal(st0.minutesIntoCurrentDay, 0);
  assert.equal(engine.getFormattedGameTime(), '00:00');
  assert.equal(st0.marketSession, 'MARKET_CLOSED');

  // 2. Varsayılan oyun günü 45 gerçek dakika
  assert.equal(st0.realMinutesPerGameDay, 45);

  // 3. 45 gerçek dakika (2700 sn) tam olarak 1 oyun günü (1440 oyun dk) ilerletiyor
  const resFullDay = engine.advanceRealSeconds(45 * 60);
  assert.equal(resFullDay.gameMinutesAdvanced, 1440);
  assert.equal(resFullDay.daysClosed, 1);
  assert.equal(engine.getState().day, 2);
  assert.equal(engine.getFormattedGameTime(), '00:00');

  // 4. 22,5 gerçek dakika (1350 sn) 1x hızda yarım oyun günü (720 oyun dk -> 12:00) ilerletiyor
  const resHalfDay = engine.advanceRealSeconds(22.5 * 60);
  assert.equal(resHalfDay.gameMinutesAdvanced, 720);
  assert.equal(resHalfDay.daysClosed, 0);
  assert.equal(engine.getState().minutesIntoCurrentDay, 720);
  assert.equal(engine.getFormattedGameTime(), '12:00');
  assert.equal(engine.getState().marketSession, 'MARKET_OPEN');

  // 5. 2x hız doğru miktarda oyun zamanı ilerletiyor (11,25 gerçek dk @ 2x = 720 oyun dk -> gün sonu)
  engine.setTimeScale(2);
  const res2x = engine.advanceRealSeconds(11.25 * 60);
  assert.equal(res2x.gameMinutesAdvanced, 720);
  assert.equal(res2x.daysClosed, 1);
  assert.equal(engine.getState().day, 3);
  assert.equal(engine.getFormattedGameTime(), '00:00');

  // 6. Duraklatılmış oyun zaman ilerletmiyor
  engine.pauseSimulation();
  assert.equal(engine.getState().isPaused, true);
  const resPaused = engine.advanceRealSeconds(3600);
  assert.equal(resPaused.gameMinutesAdvanced, 0);
  assert.equal(resPaused.daysClosed, 0);
  assert.equal(engine.getState().day, 3);
  assert.equal(engine.getState().minutesIntoCurrentDay, 0);
});

test('7. Gün sonu işlemleri (closeCurrentDay) gün sınırı geçildiğinde yalnızca bir kez çalışır', () => {
  const engine = new SimulationEngine(20261104);
  assert.equal(engine.getState().dailyLogs.length, 1);

  // Parçalı olarak 1440 dakika ilerlet
  engine.advanceGameMinutes(600); // 10:00
  assert.equal(engine.getState().day, 1);
  assert.equal(engine.getState().dailyLogs.length, 1);

  engine.advanceGameMinutes(480); // 18:00
  assert.equal(engine.getState().day, 1);
  assert.equal(engine.getState().dailyLogs.length, 1);

  const finalPart = engine.advanceGameMinutes(360); // 24:00 -> Gün 2 00:00
  assert.equal(finalPart.daysClosed, 1);
  assert.equal(engine.getState().day, 2);
  assert.equal(engine.getState().dailyLogs.length, 2);
  assert.equal(engine.getState().lastIntegrityAudit.valid, true);
});

test('8-9. Piyasa emri kapalı piyasada bekler ve piyasa açılınca (10:00) otomatik işlenir', () => {
  const engine = new SimulationEngine(20261104);
  assert.equal(engine.getState().marketSession, 'MARKET_CLOSED');

  const orderRes = engine.placeOrder({
    ticker: 'NVEX',
    orderType: 'MARKET_BUY',
    requestedShares: 50,
  });

  assert.equal(orderRes.success, true);
  assert.ok(orderRes.order);
  assert.equal(orderRes.order.status, 'PENDING');
  assert.ok(engine.getReservedCash() > 0);
  assert.equal(engine.getState().portfolio['NVEX'], undefined);

  // 09:30 (PRE_OPEN) -> hâlâ beklemeli
  engine.advanceGameMinutes(9 * 60 + 30);
  assert.equal(engine.getState().marketSession, 'PRE_OPEN');
  assert.equal(orderRes.order.status, 'PENDING');

  // 10:00 (MARKET_OPEN) -> hemen gerçekleşmeli ve rezerv sıfırlanmalı
  engine.advanceGameMinutes(30);
  assert.equal(engine.getState().marketSession, 'MARKET_OPEN');
  assert.equal(orderRes.order.status, 'FILLED');
  assert.equal(engine.getReservedCash(), 0);
  assert.equal(engine.getState().portfolio['NVEX']?.shares, 50);
  assert.equal(engine.getState().lastIntegrityAudit.valid, true);
});

test('10-11. Limit alış ve limit satış emirleri yalnızca doğru fiyat koşulunda çalışır', () => {
  const engine = new SimulationEngine(20261104);
  // Piyasayı 10:00 açık seansa getir
  engine.advanceGameMinutes(600);
  assert.equal(engine.getState().marketSession, 'MARKET_OPEN');

  const nvex = engine.getState().stocks.find((s) => s.ticker === 'NVEX')!;
  const currentPrice = nvex.price;

  // Piyasa fiyatının çok altında bir LIMIT_BUY ver -> hemen çalışmamalı, PENDING kalmalı
  const lowLimitBuy = engine.placeOrder({
    ticker: 'NVEX',
    orderType: 'LIMIT_BUY',
    requestedShares: 40,
    limitPrice: Number((currentPrice * 0.7).toFixed(2)),
  });
  assert.equal(lowLimitBuy.success, true);
  assert.equal(lowLimitBuy.order?.status, 'PENDING');

  // Fiyat koşulunu karşılayan bir LIMIT_BUY ver -> hemen FILLED olmalı
  const marketableLimitBuy = engine.placeOrder({
    ticker: 'NVEX',
    orderType: 'LIMIT_BUY',
    requestedShares: 60,
    limitPrice: Number(( nvex.askPrice * 1.02 ).toFixed(2)),
  });
  assert.equal(marketableLimitBuy.success, true);
  assert.equal(marketableLimitBuy.order?.status, 'FILLED');
  assert.equal(engine.getState().portfolio['NVEX']?.shares, 60);

  // Piyasa fiyatının çok üstünde bir LIMIT_SELL ver -> PENDING kalmalı
  const highLimitSell = engine.placeOrder({
    ticker: 'NVEX',
    orderType: 'LIMIT_SELL',
    requestedShares: 25,
    limitPrice: Number((nvex.price * 1.4).toFixed(2)),
  });
  assert.equal(highLimitSell.success, true);
  assert.equal(highLimitSell.order?.status, 'PENDING');
  assert.equal(engine.getReservedShares('NVEX'), 25);

  // Fiyat yukarı çıktığında (veya uygun limit fiyatlı satışta) LIMIT_SELL gerçekleşmeli
  nvex.price = Number((nvex.price * 1.45).toFixed(2));
  nvex.bidPrice = Number((nvex.price * 0.999).toFixed(2));
  nvex.askPrice = Number((nvex.price * 1.001).toFixed(2));
  engine.processPendingOrders();

  assert.equal(highLimitSell.order?.status, 'FILLED');
  assert.equal(engine.getReservedShares('NVEX'), 0);
  assert.equal(engine.getState().portfolio['NVEX']?.shares, 35);
});

test('12-15. Emir iptali rezervi serbest bırakır; aynı nakit/hisse iki emirde kullanılamaz; geçersiz emir state değiştirmez', () => {
  const engine = new SimulationEngine(20261104); // 00:00 MARKET_CLOSED, 100.000 TL nakit

  // 13. İlk emir nakdin büyük kısmını (~87.000 TL) rezerve eder
  const order1 = engine.placeOrder({
    ticker: 'NVEX',
    orderType: 'LIMIT_BUY',
    requestedShares: 700,
    limitPrice: 124.5,
  });
  assert.equal(order1.success, true);
  assert.ok(engine.getReservedCash() > 85_000);

  // Aynı nakdi kullanmaya çalışan ikinci büyük emir reddedilmelidir
  const order2 = engine.placeOrder({
    ticker: 'SOLR',
    orderType: 'LIMIT_BUY',
    requestedShares: 500,
    limitPrice: 64.2,
  });
  assert.equal(order2.success, false);
  assert.equal(order2.order, null);

  // 12. İlk emir iptal edildiğinde nakit rezervi serbest kalır ve ikinci emir verilebilir
  const cancelRes = engine.cancelOrder(order1.order!.id);
  assert.equal(cancelRes.success, true);
  assert.equal(engine.getReservedCash(), 0);
  assert.equal(engine.getSpendableCash(), 100_000);

  // 14. Aynı hisse iki satış emrinde rezerve edilemez
  engine.buyStock('SOLR', 100);
  const sell1 = engine.placeOrder({
    ticker: 'SOLR',
    orderType: 'LIMIT_SELL',
    requestedShares: 70,
    limitPrice: 80.0,
  });
  assert.equal(sell1.success, true);
  assert.equal(engine.getReservedShares('SOLR'), 70);

  const sell2 = engine.placeOrder({
    ticker: 'SOLR',
    orderType: 'LIMIT_SELL',
    requestedShares: 50,
    limitPrice: 82.0,
  });
  assert.equal(sell2.success, false);
  assert.equal(engine.getReservedShares('SOLR'), 70);

  // 15. Geçersiz emir state'i değiştirmez
  const snapshotBefore = engine.serializeState();
  const invalid1 = engine.placeOrder({
    ticker: 'SOLR',
    orderType: 'MARKET_BUY',
    requestedShares: -20,
  });
  const invalid2 = engine.placeOrder({
    ticker: 'SOLR',
    orderType: 'LIMIT_BUY',
    requestedShares: 10,
    limitPrice: -5,
  });
  const invalid3 = engine.placeOrder({
    ticker: 'YOKHISSE',
    orderType: 'MARKET_BUY',
    requestedShares: 10,
  });
  assert.equal(invalid1.success, false);
  assert.equal(invalid2.success, false);
  assert.equal(invalid3.success, false);
  assert.equal(engine.serializeState(), snapshotBefore);
});

test('16-18. Çevrimdışı İlerleme: 3 oyun günü sınırını aşmaz, negatif zamanı reddeder ve aynı aralığı iki kez işlemez', () => {
  const engine = new SimulationEngine(20261104);

  // 17. Negatif gerçek zaman farkı ilerleme oluşturmaz
  const negSummary = engine.processOfflineProgress(
    '2026-01-02T12:00:00.000Z',
    '2026-01-02T10:00:00.000Z'
  );
  assert.equal(negSummary.gameMinutesAdvanced, 0);
  assert.equal(negSummary.gameDaysAdvanced, 0);
  assert.equal(engine.getState().day, 1);

  // 16. 10 oyun gününe karşılık gelen süre (10 * 45 dk = 450 gerçek dk) verildiğinde maksimum 3 oyun günü (4320 dk) ilerler
  const startISO = '2026-01-02T00:00:00.000Z';
  const tenGameDaysLaterISO = new Date(
    Date.parse(startISO) + 10 * 45 * 60 * 1000
  ).toISOString();

  const cappedSummary = engine.processOfflineProgress(
    startISO,
    tenGameDaysLaterISO
  );
  assert.equal(
    cappedSummary.gameMinutesAdvanced,
    GameClockEngine.MAX_OFFLINE_GAME_MINUTES
  );
  assert.equal(cappedSummary.gameDaysAdvanced, 3);
  assert.equal(engine.getState().day, 4);

  // 18. Aynı çevrimdışı süre iki kez işlenmez
  const dayAfterFirstOffline = engine.getState().day;
  const netWorthAfterFirstOffline = engine.getState().netWorth;
  const duplicateSummary = engine.processOfflineProgress(
    startISO,
    tenGameDaysLaterISO
  );
  assert.equal(duplicateSummary.gameMinutesAdvanced, 0);
  assert.equal(duplicateSummary.gameDaysAdvanced, 0);
  assert.equal(engine.getState().day, dayAfterFirstOffline);
  assert.equal(engine.getState().netWorth, netWorthAfterFirstOffline);
});

test('19-20. Eski v2 kayıt yeni v3 şemasına taşınır ve nakit/portföy/PRNG değişmez', () => {
  const engine = new SimulationEngine(20261104);
  engine.buyStock('NVEX', 120);
  engine.tickDay();

  const cashBefore = engine.getState().cash;
  const sharesBefore = engine.getState().portfolio['NVEX']?.shares;
  const randomStateBefore = engine.getRandomState();

  // Eski v2 formatında (zaman ve pendingOrders alanları olmadan) bir kayıt zarfı simüle et
  const rawState = JSON.parse(engine.serializeState()) as Record<
    string,
    unknown
  >;
  delete rawState.currentGameMinute;
  delete rawState.currentGameHour;
  delete rawState.minutesIntoCurrentDay;
  delete rawState.totalElapsedGameMinutes;
  delete rawState.realMinutesPerGameDay;
  delete rawState.timeScale;
  delete rawState.isPaused;
  delete rawState.marketSession;
  delete rawState.pendingOrders;
  rawState.schemaVersion = 2;

  const v2Envelope = {
    schemaVersion: 2,
    savedAtISO: '2026-01-05T08:00:00.000Z',
    seed: 20261104,
    randomState: randomStateBefore,
    state: rawState,
  };

  const migrated = SimulationStore.migrateIfNeeded(v2Envelope);
  assert.ok(migrated);
  assert.equal(migrated.schemaVersion, SimulationStore.CURRENT_SCHEMA_VERSION);
  assert.equal(
    migrated.state.schemaVersion,
    SimulationStore.CURRENT_SCHEMA_VERSION
  );
  assert.equal(migrated.state.cash, cashBefore);
  assert.equal(migrated.state.portfolio['NVEX']?.shares, sharesBefore);
  assert.equal(migrated.state.randomState, randomStateBefore);
  assert.equal(migrated.state.currentGameHour, 0);
  assert.equal(migrated.state.currentGameMinute, 0);
  assert.equal(migrated.state.realMinutesPerGameDay, 45);
  assert.ok(Array.isArray(migrated.state.pendingOrders));
});

test('21. Deterministiklik: Aynı seed ve aynı emirler tamamen aynı sonucu verir', () => {
  const engineA = new SimulationEngine(998877);
  const engineB = new SimulationEngine(998877);

  engineA.placeOrder({
    ticker: 'NVEX',
    orderType: 'MARKET_BUY',
    requestedShares: 80,
  });
  engineB.placeOrder({
    ticker: 'NVEX',
    orderType: 'MARKET_BUY',
    requestedShares: 80,
  });

  engineA.advanceGameMinutes(1440 * 3);
  engineB.advanceGameMinutes(1440 * 3);

  assert.equal(engineA.getState().netWorth, engineB.getState().netWorth);
  assert.equal(engineA.getState().cash, engineB.getState().cash);
  assert.equal(engineA.getRandomState(), engineB.getRandomState());
});

test('22-24. Normal zaman ilerletme oyuncu adına otomatik şirket kurmaz, IPO yapmaz ve takeover başlatmaz', () => {
  // Yüksek sermaye (5.000.000 TL) ile başlat
  const engine = new SimulationEngine(20261104, 5_000_000);

  // 22. Normal ilerletmede otomatik şirket kurulmamalı
  engine.advanceDaysWithoutPlayerDecisions(10, true);
  assert.equal(engine.getState().playerCompany, null);

  // Oyuncu kendi iradesiyle şirket kursun ve IPO koşullarını sağlasın
  engine.establishCompany(
    'Anadolu BiyoTek A.Ş.',
    'ANBT',
    'BIYOTEKNOLOJI',
    1_500_000,
    {
      initialStaffCount: 45,
      initialCapacity: 60,
      initialRdBudget: 25_000,
    }
  );

  // 23 & 24. Normal ilerletmede oyuncu adına otomatik IPO veya takeover yapılmamalı
  engine.advanceDaysWithoutPlayerDecisions(15, true);
  assert.equal(engine.getState().playerCompany?.isPubliclyListed, false);
  assert.equal(engine.getState().controlledSubsidiaries.length, 0);
});

test('25. 365 oyun günü stres testi sıfır bütünlük hatası üretir', () => {
  const engine = new SimulationEngine(20261104, 100_000);
  const res = engine.runAutomatedStressScenario(365, true);
  assert.equal(res.summary.integrityErrors.length, 0);
  assert.equal(res.finalState.lastIntegrityAudit.valid, true);
});
