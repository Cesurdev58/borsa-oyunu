import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SimulationEngine,
  SimulationStage,
  runThirtyDayConsoleSimulation,
} from './SimulationEngine';

test('Başlangıç durumu: 100.000 TL nakit, 0 TL portföy, 0 TL borç, 100.000 TL net varlık ve kilitli aşamalar', () => {
  const engine = new SimulationEngine(12345, 100_000);
  const state = engine.getState();

  assert.equal(state.cash, 100_000);
  assert.equal(state.portfolioValue, 0);
  assert.equal(state.totalDebt, 0);
  assert.equal(state.netWorth, 100_000);
  assert.equal(state.stage, SimulationStage.STAGE_1_RETAIL_INVESTOR);
  assert.equal(state.stageUnlocks.stage2Entrepreneur, false);
  assert.equal(state.stageUnlocks.stage3Ipo, false);
  assert.equal(state.stageUnlocks.stage4Holding, false);
  assert.equal(state.stocks.length, 16);
});

test('30 günlük gerçek simülasyon sahte nakit eklemeden ve sıfır bütünlük hatasıyla çalışır', () => {
  const result = runThirtyDayConsoleSimulation(20261104);
  const finalState = result.finalState;

  assert.equal(finalState.day, 31);
  assert.equal(result.summary.integrityErrors.length, 0);
  assert.equal(finalState.lastIntegrityAudit.valid, true);
  assert.ok(finalState.netWorth > 0);
});
