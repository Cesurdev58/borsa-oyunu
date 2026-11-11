/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TRANSACTION SEQUENCE, KİMLİK BENZERSİZLİĞİ VE ŞEMA v4 MİGRATION TESTLERİ
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SimulationEngine,
  SimulationState,
  TransactionRecord,
} from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import { BuildingDetailSheet } from '../../components/game/BuildingDetailSheet';
import { EventNotificationPanel } from '../../components/game/EventNotificationPanel';
import { GameNotificationItem } from '../../components/game/gameTypes';

const formatCurrencyTR = (v: number) =>
  `₺${Math.round(v).toLocaleString('tr-TR')}`;

test('1 & 2. 1.000 ardışık transaction benzersiz ID üretir ve 250 kayıt sınırından sonra yeni ID asla tekrar etmez', () => {
  const engine = new SimulationEngine(20261104, 50_000_000);
  const allGeneratedIds: string[] = [];

  for (let i = 0; i < 1000; i++) {
    const isBuy = i % 2 === 0;
    if (isBuy) {
      const res = engine.buyStock('NVEX', 2);
      assert.equal(res.success, true);
    } else {
      const res = engine.sellStock('NVEX', 1);
      assert.equal(res.success, true);
    }
    const latestTx = engine.getState().transactions[0];
    assert.ok(latestTx);
    allGeneratedIds.push(latestTx.id);
  }

  // Üretilen 1.000 işlemin tamamı benzersiz olmalı
  assert.equal(allGeneratedIds.length, 1000);
  assert.equal(new Set(allGeneratedIds).size, 1000);

  // Liste 250 kayıtla sınırlandırılmış olmalı ve listedeki 250 ID benzersiz olmalı
  const state = engine.getState();
  assert.equal(state.transactions.length, 250);
  assert.equal(state.transactionSequence, 1000);

  const idsInState = state.transactions.map((tx) => tx.id);
  assert.equal(new Set(idsInState).size, idsInState.length);
  assert.equal(idsInState[0], 'TX-D1-S00001000');
  assert.equal(idsInState[249], 'TX-D1-S00000751');
});

test('3 & 4. Aynı oyun gününde 500 işlem ve gün değişiminde işlemler benzersiz ID üretir', () => {
  const engine = new SimulationEngine(20261104, 25_000_000);
  const seenAcrossDays = new Set<string>();

  // Gün 1 içinde 500 işlem
  for (let i = 0; i < 500; i++) {
    engine.buyStock('SOLR', 1);
    const topId = engine.getState().transactions[0].id;
    assert.equal(seenAcrossDays.has(topId), false, `Çakışan ID: ${topId}`);
    seenAcrossDays.add(topId);
  }
  assert.equal(seenAcrossDays.size, 500);
  assert.equal(engine.getState().transactionSequence, 500);

  // Gün değişimi (Gün 2 ve Gün 3)
  engine.tickDay();
  for (let i = 0; i < 150; i++) {
    engine.buyStock('NVEX', 1);
    const topId = engine.getState().transactions[0].id;
    assert.equal(seenAcrossDays.has(topId), false);
    seenAcrossDays.add(topId);
  }

  engine.tickDay();
  for (let i = 0; i < 150; i++) {
    engine.sellStock('NVEX', 1);
    const topId = engine.getState().transactions[0].id;
    assert.equal(seenAcrossDays.has(topId), false);
    seenAcrossDays.add(topId);
  }

  const ids = engine.getState().transactions.map((tx) => tx.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(engine.getState().transactionSequence >= 800);
});

test('5. Kaydet ve yükle (serialize/deserialize & SimulationStore) sonrasında transactionSequence kaldığı yerden devam eder', () => {
  const engine = new SimulationEngine(20261104, 10_000_000);
  for (let i = 0; i < 260; i++) {
    engine.buyStock('NVEX', 1);
  }
  assert.equal(engine.getState().transactions.length, 250);
  assert.equal(engine.getState().transactionSequence, 260);

  const envelope = SimulationStore.saveToStorage(engine);
  assert.ok(envelope);
  const migrated = SimulationStore.migrateIfNeeded(envelope);
  assert.ok(migrated);
  assert.equal(migrated.state.transactionSequence, 260);

  const restoredEngine = new SimulationEngine(migrated.seed);
  restoredEngine.restoreFromSavedState(migrated.state);
  assert.equal(restoredEngine.getState().transactionSequence, 260);

  // Yükleme sonrası yeni işlem 261. sıradan devam etmeli
  restoredEngine.buyStock('SOLR', 5);
  assert.equal(restoredEngine.getState().transactionSequence, 261);
  assert.equal(
    restoredEngine.getState().transactions[0].id,
    'TX-D1-S00000261'
  );

  const ids = restoredEngine.getState().transactions.map((tx) => tx.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('6, 7, 8, 14, 15. Gün 486 v3 kaydı ve duplicate TX-D480-251 içeren eski kayıt veri kaybı olmadan idempotent biçimde v4 şemasına migrate edilir', () => {
  const engine = new SimulationEngine(20261104, 3_500_000);
  engine.establishCompany(
    'Anadolu Kuantum Teknoloji A.Ş.',
    'AKNT',
    'TEKNOLOJI',
    1_200_000
  );
  engine.buyStock('NVEX', 100);
  engine.placeOrder({
    ticker: 'SOLR',
    orderType: 'LIMIT_BUY',
    requestedShares: 40,
    limitPrice: 55.0,
  });

  // Gün 486 (01.05.2027, Saat 11:06, Nakit ~41.555 TL, Net Varlık ~7.641.143 TL) senaryosunu hazırla
  const baseState = JSON.parse(engine.serializeState()) as SimulationState;
  baseState.day = 486;
  baseState.dateISO = '2027-05-01';
  baseState.minutesIntoCurrentDay = 11 * 60 + 6; // 11:06
  baseState.currentGameHour = 11;
  baseState.currentGameMinute = 6;
  baseState.marketSession = 'MARKET_OPEN';
  baseState.cash = 41555.42;
  baseState.netWorth = 7641143.18;

  // Eski v3 hatasını birebir simüle et: 250 işlem kaydı ve çok sayıda tekrarlanan "TX-D480-251" ID'si
  const legacyCorruptedTransactions: TransactionRecord[] = [];
  for (let i = 0; i < 250; i++) {
    const isDuplicateDay480 = i < 45; // 45 adet aynı "TX-D480-251" duplicate kaydı
    legacyCorruptedTransactions.push({
      id: isDuplicateDay480 ? 'TX-D480-251' : `TX-D${479 - Math.floor(i / 10)}-${250 - i}`,
      day: isDuplicateDay480 ? 480 : 479 - Math.floor(i / 10),
      type: i % 3 === 0 ? 'DIVIDEND' : 'BUY',
      ticker: 'NVEX',
      shares: 10 + i,
      executionPrice: 120.5,
      grossAmount: 1205,
      commission: 1.2,
      slippageBps: 2,
      cashDelta: -1206.2,
      netWorthBefore: 7640000 + i,
      netWorthAfter: 7641143.18,
      description: `İşlem kaydı #${i + 1}`,
    });
  }
  baseState.transactions = legacyCorruptedTransactions;

  // v3 kaydında transactionSequence alanı yoktu
  const rawV3State = baseState as unknown as Record<string, unknown>;
  delete rawV3State.transactionSequence;
  delete rawV3State.orderSequence;
  rawV3State.schemaVersion = 3;

  const v3Envelope = {
    schemaVersion: 3,
    savedAtISO: '2027-05-01T11:06:00.000Z',
    seed: baseState.seed,
    randomState: baseState.randomState,
    state: rawV3State,
  };

  // 1. Migration çalıştır
  const migrated1 = SimulationStore.migrateIfNeeded(v3Envelope);
  assert.ok(migrated1);
  assert.equal(migrated1.schemaVersion, SimulationStore.CURRENT_SCHEMA_VERSION);
  assert.equal(
    migrated1.state.schemaVersion,
    SimulationStore.CURRENT_SCHEMA_VERSION
  );

  const stats = SimulationStore.getLastMigrationStats();
  assert.ok(stats);
  assert.equal(stats.migratedFromVersion, 3);
  assert.equal(stats.migratedToVersion, SimulationStore.CURRENT_SCHEMA_VERSION);
  assert.equal(stats.duplicateTransactionsFixedCount, 44); // 45 tane 'TX-D480-251' içinden 44 tekrar düzeltildi

  // 6 & 7. Hiçbir kayıt silinmedi, sıra korundu ve tüm ID'ler benzersiz oldu
  assert.equal(migrated1.state.transactions.length, 250);
  assert.equal(
    migrated1.state.transactions[0].description,
    'İşlem kaydı #1'
  );
  assert.equal(
    migrated1.state.transactions[249].description,
    'İşlem kaydı #250'
  );

  const migratedIds1 = migrated1.state.transactions.map((tx) => tx.id);
  assert.equal(new Set(migratedIds1).size, migratedIds1.length);
  assert.ok(migrated1.state.transactionSequence >= 251);

  // 14 & 15. Gün 486 ekonomik değerleri, saat, şirket, portföy ve randomState değişmedi
  assert.equal(migrated1.state.day, 486);
  assert.equal(migrated1.state.dateISO, '2027-05-01');
  assert.equal(migrated1.state.currentGameHour, 11);
  assert.equal(migrated1.state.currentGameMinute, 6);
  assert.equal(migrated1.state.cash, 41555.42);
  assert.equal(migrated1.state.netWorth, 7641143.18);
  assert.equal(migrated1.state.portfolio['NVEX']?.shares, 100);
  assert.equal(migrated1.state.playerCompany?.ticker, 'AKNT');
  assert.equal(migrated1.state.pendingOrders.length, 1);
  assert.equal(migrated1.state.randomState, baseState.randomState);

  // 8. İkinci kez migration çalıştığında (Idempotency) ID'ler ve transactionSequence tekrar değişmez
  const migrated2 = SimulationStore.migrateIfNeeded(migrated1);
  assert.ok(migrated2);
  const migratedIds2 = migrated2.state.transactions.map((tx) => tx.id);
  assert.deepEqual(migratedIds2, migratedIds1);
  assert.equal(
    migrated2.state.transactionSequence,
    migrated1.state.transactionSequence
  );
  assert.equal(
    SimulationStore.getLastMigrationStats()?.duplicateTransactionsFixedCount,
    0
  );
});

test('9 & 10. 365 günlük stres testinde ve 5 yıllık (1260 iş günü) hızlı simülasyonda duplicate transaction ID oluşmaz', () => {
  // 9. 365 günlük otomatik stres senaryosu
  const stressEngine = new SimulationEngine(101010, 100_000);
  const res365 = stressEngine.run30DaySimulation(true, 365, true);
  const txIds365 = res365.finalState.transactions.map((tx) => tx.id);
  assert.equal(new Set(txIds365).size, txIds365.length);
  assert.ok(res365.finalState.transactionSequence >= txIds365.length);

  // 10. 5 yıllık (1260 iş günü) hızlı simülasyon
  const fiveYearEngine = new SimulationEngine(202020, 500_000);
  fiveYearEngine.buyStock('NVEX', 250);
  fiveYearEngine.buyStock('SOLR', 250);
  for (let d = 0; d < 1260; d++) {
    fiveYearEngine.tickDay();
  }
  const st5Y = fiveYearEngine.getState();
  const txIds5Y = st5Y.transactions.map((tx) => tx.id);
  assert.equal(new Set(txIds5Y).size, txIds5Y.length);

  const newsIds5Y = st5Y.newsFeed.map((n) => n.id);
  assert.equal(new Set(newsIds5Y).size, newsIds5Y.length);

  const logDays5Y = st5Y.dailyLogs.map((l) => l.day);
  assert.equal(new Set(logDays5Y).size, logDays5Y.length);
});

test('11, 12, 13. Pending order ID\'leri ve Notification ID\'leri benzersiz kalır; React transaction listesi duplicate key uyarısı üretmez', () => {
  const engine = new SimulationEngine(20261104, 15_000_000);

  // 11. Çok sayıda bekleyen emir oluştur, iptal et ve gerçekleştir
  for (let i = 0; i < 60; i++) {
    const res = engine.placeOrder({
      ticker: 'NVEX',
      orderType: 'LIMIT_BUY',
      requestedShares: 5,
      limitPrice: 90.0,
    });
    assert.equal(res.success, true);
    if (i % 2 === 0 && res.order) {
      engine.cancelOrder(res.order.id);
    }
  }
  const orderIds = engine.getState().pendingOrders.map((o) => o.id);
  assert.equal(new Set(orderIds).size, orderIds.length);

  // 300 işlem üret (250 sınırını aşarak)
  for (let i = 0; i < 300; i++) {
    engine.buyStock('SOLR', 1);
  }
  const txIds = engine.getState().transactions.map((tx) => tx.id);
  assert.equal(txIds.length, 250);
  assert.equal(new Set(txIds).size, 250);

  // 12 & 13. React SSR sırasında console.error'u dinleyerek "Encountered two children with the same key" uyarısı olmadığını doğrula
  const capturedConsoleErrors: string[] = [];
  const origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    capturedConsoleErrors.push(args.map(String).join(' '));
  };

  try {
    const state = engine.getState();
    const sheetHtml = renderToStaticMarkup(
      React.createElement(BuildingDetailSheet, {
        buildingId: 'OYUNCU_OFISI',
        state,
        onClose: () => {},
        onOpenBuilding: () => {},
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
        getReservedShares: (t: string) => engine.getReservedShares(t),
        ipoEligibility: engine.checkIPOEligibility(),
        formattedTime: engine.getFormattedGameTime(),
        formatCurrency: formatCurrencyTR,
      })
    );
    assert.ok(sheetHtml.includes('Son İşlem Geçmişi'));

    const mockNotifications: GameNotificationItem[] = Array.from(
      { length: 30 },
      (_, idx) => ({
        id: `EVT-D1-M0-S${String(idx + 1).padStart(8, '0')}`,
        category: 'ORDER_FILLED',
        title: `Emir #${idx + 1}`,
        message: 'Emir gerçekleşti.',
        day: 1,
        gameTime: '10:00',
        severity: 'success',
        important: true,
        read: false,
      })
    );
    const notifIds = mockNotifications.map((n) => n.id);
    assert.equal(new Set(notifIds).size, notifIds.length);

    const notifHtml = renderToStaticMarkup(
      React.createElement(EventNotificationPanel, {
        notifications: mockNotifications,
        isDrawerOpen: true,
        onOpenDrawer: () => {},
        onCloseDrawer: () => {},
        onMarkAllRead: () => {},
      })
    );
    assert.ok(notifHtml.includes('data-testid="active-event-banner"'));
    assert.ok(notifHtml.includes('Emir #1'));
  } finally {
    console.error = origConsoleError;
  }

  const duplicateKeyErrors = capturedConsoleErrors.filter((msg) =>
    msg.includes('Encountered two children with the same key')
  );
  assert.equal(duplicateKeyErrors.length, 0);
});
