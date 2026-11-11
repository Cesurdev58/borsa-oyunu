import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';

test('Takeover için gerekli nakit veya finansman olmadan işlem tamamlanmaz; yeterli sermaye ile çoğunluk kontrolü ve konsolidasyon doğru çalışır', () => {
  // 100.000 TL nakitle hiçbir NPC şirketinin %51 çoğunluk payı devralınamaz
  const poorEngine = new SimulationEngine(20261104, 100_000);
  const failedTakeover = poorEngine.executeHostileTakeover('KRGO');
  assert.equal(failedTakeover.success, false);
  assert.equal(poorEngine.getState().controlledSubsidiaries.length, 0);
  assert.equal(poorEngine.getState().cash, 100_000);

  // Yeterli sermayeye sahip Holding test fixture
  const holdingEngine = new SimulationEngine(20261104, 5_000_000);
  // Önce %10 stratejik pay topla
  const krgo = holdingEngine.getState().stocks.find((s) => s.ticker === 'KRGO')!;
  const tenPctLots = Math.ceil(krgo.totalShares * 0.1);
  const buyStake = holdingEngine.buyStock('KRGO', tenPctLots);
  assert.equal(buyStake.success, true);
  assert.equal(krgo.controlLevel, 'STRATEGIC_10');

  // Şimdi %51+ çoğunluk devralma çağrısı yap
  const takeoverRes = holdingEngine.executeHostileTakeover('KRGO', {
    targetOwnershipPct: 51.0,
    useDebtFinancing: false,
  });
  assert.equal(takeoverRes.success, true);
  assert.ok(takeoverRes.newOwnershipPct > 50.0);
  assert.equal(krgo.isControlledByPlayer, true);
  assert.equal(holdingEngine.getState().controlledSubsidiaries.includes('KRGO'), true);
  assert.equal(holdingEngine.getState().lastIntegrityAudit.valid, true);
});
