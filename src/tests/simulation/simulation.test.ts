import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SimulationEngine,
  SimulationStage,
} from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';

test('Yeni oyun tam olarak 100.000 TL net varlıkla başlar ve Girişimci/IPO/Holding aşamaları kilitlidir', () => {
  const engine = new SimulationEngine(20261104);
  const state = engine.getState();

  assert.equal(state.cash, 100_000);
  assert.equal(state.portfolioValue, 0);
  assert.equal(state.playerCompany, null);
  assert.equal(state.totalDebt, 0);
  assert.equal(state.accruedDividendsReceivable, 0);
  assert.equal(state.netWorth, 100_000);
  assert.equal(state.stage, SimulationStage.STAGE_1_RETAIL_INVESTOR);
  assert.equal(state.stageUnlocks.stage1Retail, true);
  assert.equal(state.stageUnlocks.stage2Entrepreneur, false);
  assert.equal(state.stageUnlocks.stage3Ipo, false);
  assert.equal(state.stageUnlocks.stage4Holding, false);
});

test('Aynı seed ve aynı işlemler tamamen aynı 30 günlük sonucu üretir; farklı seed farklı fakat geçerli sonuç üretir', () => {
  const engineA = new SimulationEngine(777888, 100_000);
  const engineB = new SimulationEngine(777888, 100_000);
  const engineC = new SimulationEngine(999111, 100_000);

  const resA = engineA.run30DaySimulation(true, 30, true);
  const resB = engineB.run30DaySimulation(true, 30, true);
  const resC = engineC.run30DaySimulation(true, 30, true);

  assert.equal(resA.finalState.netWorth, resB.finalState.netWorth);
  assert.equal(resA.finalState.cash, resB.finalState.cash);
  assert.equal(resA.finalState.marketIndex, resB.finalState.marketIndex);
  assert.equal(resA.finalState.randomState, resB.finalState.randomState);

  assert.notEqual(resA.finalState.marketIndex, resC.finalState.marketIndex);
  assert.equal(resC.finalState.lastIntegrityAudit.valid, true);
});

test('Kayıt ve yükleme (serialize / deserialize & SimulationStore) sonrasında state ve PRNG değişmez', () => {
  const engine = new SimulationEngine(20261104, 100_000);
  engine.buyStock('NVEX', 120);
  engine.tickDay();
  engine.tickDay();

  const serialized = engine.serializeState();
  const restored = SimulationEngine.deserializeState(serialized);

  assert.equal(restored.getState().day, engine.getState().day);
  assert.equal(restored.getState().cash, engine.getState().cash);
  assert.equal(restored.getState().netWorth, engine.getState().netWorth);
  assert.equal(restored.getRandomState(), engine.getRandomState());

  const envelope = SimulationStore.saveToStorage(engine);
  assert.ok(envelope !== null);
  const migrated = SimulationStore.migrateIfNeeded(envelope);
  assert.ok(migrated !== null);
  assert.equal(migrated?.state.netWorth, engine.getState().netWorth);

  // Kayıttan yüklenen motor bir sonraki günde orijinal motorla birebir aynı sonucu üretmeli
  const nextOriginal = engine.tickDay();
  const nextRestored = restored.tickDay();
  assert.equal(nextOriginal.netWorth, nextRestored.netWorth);
  assert.equal(nextOriginal.marketIndexValue, nextRestored.marketIndexValue);
});

test('365 günlük stres testi ve 5 yıllık (1260 iş günü) hızlı simülasyon testi state bozulmadan çalışır', () => {
  const engine1Year = new SimulationEngine(101010, 100_000);
  const res1Y = engine1Year.run30DaySimulation(true, 365, true);
  assert.equal(res1Y.finalState.day, 366);
  assert.equal(res1Y.finalState.lastIntegrityAudit.valid, true);
  assert.equal(res1Y.summary.integrityErrors.length, 0);

  // 5 yıllık (5 * 252 = 1260 iş günü) hızlı simülasyon testi
  const engine5Years = new SimulationEngine(202020, 100_000);
  for (let d = 0; d < 1260; d++) {
    engine5Years.tickDay();
  }
  const final5Y = engine5Years.getState();
  assert.equal(final5Y.day, 1261);
  assert.equal(final5Y.lastIntegrityAudit.valid, true);
  for (const s of final5Y.stocks) {
    assert.ok(Number.isFinite(s.price) && s.price >= 1.0);
  }
});
