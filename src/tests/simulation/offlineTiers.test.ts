import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { offlineCredit, offlineDanger } from '../../engine/OfflineProgress';

test('kademeli verim: 2/4/8/12 saat sınırları', () => {
  const h = (x: number) => offlineCredit(x * 3600);
  assert.equal(h(1).effectiveMinutes, 60);
  assert.equal(h(2).effectiveMinutes, 120);
  assert.equal(h(4).effectiveMinutes, 120 + 120 * 0.75);
  assert.equal(h(8).effectiveMinutes, 120 + 90 + 240 * 0.5);
  assert.equal(h(12).effectiveMinutes, 120 + 90 + 120 + 240 * 0.25);
  assert.equal(h(12).overLimit, false);
  const long = h(30);
  assert.equal(long.effectiveMinutes, h(12).effectiveMinutes);
  assert.equal(long.overLimit, true);
  assert.equal(offlineCredit(-5).effectiveMinutes, 0);
});

test('çevrimdışıyken nakit eksiye düşmüşse faaliyetler durur, oyun duraklar', () => {
  const engine = new SimulationEngine(777);
  engine.setFastStartTempo(false);
  (engine.getState() as { cash: number }).cash = -100;
  assert.ok(offlineDanger(engine.getState()));
  const day = engine.getState().day;
  const sum = engine.processOfflineProgress('2026-01-02T00:00:00.000Z', '2026-01-02T03:00:00.000Z');
  assert.ok(sum.pause);
  assert.equal(sum.pause?.kind, 'CASH');
  assert.equal(engine.getState().day, day);
  assert.equal(sum.gameDaysAdvanced, 0);
  assert.equal(engine.getState().isPaused, true);
  assert.equal(engine.getState().lastOfflineSummaryDismissed, false);
});

test('risk yoksa iflas durdurması çıkmaz', () => {
  const engine = new SimulationEngine(778);
  engine.setFastStartTempo(false);
  assert.equal(offlineDanger(engine.getState()), null);
  const sum = engine.processOfflineProgress('2026-01-02T00:00:00.000Z', '2026-01-02T01:00:00.000Z');
  assert.equal(sum.pause, undefined);
  assert.equal(sum.gameDaysAdvanced, 4);
});
