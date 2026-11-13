import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import { DayReportCard, DayReportView } from '../../components/game/DayReportCard';
import { restockShops } from '../balance/restockBot';

const fc = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;

function playedEngine(days = 4) {
  const eng = new SimulationEngine(20261113, 3_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const ticker = eng.getState().stocks[0].ticker;
  eng.buyStock(ticker, 2000);
  eng.establishCompany('Rapor A.Ş.', 'RAPR', 'TEKNOLOJI', 1_000_000, {
    initialStaffCount: 20,
    initialCapacity: 30,
    initialRdBudget: 10_000,
  });
  for (let d = 0; d < days; d++) {
    restockShops(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
  }
  return { eng, ticker };
}

test('Gün dönünce biten günün raporu oluşur: şirket, dükkân ve borsa rakamları dolu', () => {
  const { eng, ticker } = playedEngine();
  const st = eng.getState();
  const r = st.lastDayReport!;
  assert.ok(r, 'rapor var');
  assert.equal(r.day, st.day - 1, 'rapor biten günün');
  assert.equal(r.netWorthEnd, Number(st.netWorth.toFixed(2)));
  const prevLog = st.dailyLogs[st.dailyLogs.length - 2];
  assert.equal(r.netWorthStart, Number(prevLog.netWorth.toFixed(2)), 'başlangıç bir önceki gün sonu');
  assert.equal(r.shops.length, 1);
  assert.ok(r.shops[0].revenue > 0, 'dükkân satış yaptı');
  assert.ok(r.company && r.company.revenue > 0, 'şirket satış yaptı');
  assert.ok(Math.abs(r.company!.revenue - r.company!.costs - r.company!.profit) < 0.05);
  // Borsa kârı, hissenin o günkü değişimiyle uyuşur (alım-satım yapılmadı)
  const s = st.stocks.find((x) => x.ticker === ticker)!;
  const start = s.priceHistory[s.priceHistory.length - 2];
  const expected = st.portfolio[ticker].shares * (s.price - start);
  assert.ok(Math.abs(r.market.pnl - expected) < Math.max(5, Math.abs(expected) * 0.02), `${r.market.pnl} ~ ${expected}`);
});

test('Rapor yalnızca gösterim içindir: raporlu ve raporsuz iki oyun aynı sonuca çıkar', () => {
  const a = playedEngine(3).eng.getState();
  const b = playedEngine(3).eng.getState();
  assert.equal(a.netWorth, b.netWorth);
  assert.equal(a.cash, b.cash);
});

test('Gün raporu kayıttan yüklenince korunur', () => {
  const { eng } = playedEngine(2);
  const env = SimulationStore.saveToStorage(eng);
  const migrated = SimulationStore.migrateIfNeeded(JSON.parse(JSON.stringify(env)));
  assert.deepEqual(migrated?.state.lastDayReport, eng.getState().lastDayReport);
  const restored = new SimulationEngine(1, 100_000);
  restored.restoreFromSavedState(JSON.parse(JSON.stringify(eng.getState())));
  assert.deepEqual(restored.getState().lastDayReport, eng.getState().lastDayReport);
});

test('Rapor kartı açılınca toplam değişimi ve bölümleri gösterir; kayıt açılışında kapsül çıkmaz', () => {
  const { eng } = playedEngine(2);
  const report = eng.getState().lastDayReport!;
  const html = renderToStaticMarkup(
    React.createElement(DayReportView, { report, formatCurrency: fc, onClose: () => {} })
  );
  for (const id of ['day-report-card', 'day-report-delta', 'day-report-company', 'day-report-shops', 'day-report-market', 'day-report-close-btn']) {
    assert.ok(html.includes(`data-testid="${id}"`), id);
  }
  assert.ok(html.includes(`${report.day}. gün bitti`));
  // Kayıt yeni açıldığında eldeki rapor "görülmüş" sayılır
  const capsule = renderToStaticMarkup(
    React.createElement(DayReportCard, { report, enabled: true, formatCurrency: fc })
  );
  assert.equal(capsule, '');
});
