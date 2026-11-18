import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { LIFESTYLE_ITEMS } from '../../data/lifestyle';

test('Lüks alım: nakitten düşer, itibar artar, net varlığa sayılmaz, iki kez alınamaz, kayıtta kalır', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  eng.openShop({ shopType: 'BUFE' });
  const rep0 = eng.getState().tradeState!.tradeReputationScore;
  const cash0 = eng.getState().cash;
  const nw0 = eng.getState().netWorth;
  const daire = LIFESTYLE_ITEMS.find((x) => x.id === 'daire')!;
  const r = eng.buyLifestyleItem('daire');
  assert.equal(r.success, true, r.message);
  assert.equal(eng.getState().cash, cash0 - daire.price);
  assert.equal(eng.getState().tradeState!.tradeReputationScore, rep0 + daire.reputation);
  assert.ok(eng.getState().netWorth < nw0 - daire.price * 0.99, 'net varlık düşmeli');
  assert.equal(eng.buyLifestyleItem('daire').success, false);
  assert.equal(eng.buyLifestyleItem('ada').success, false, 'parası yetmez');
  const back = SimulationEngine.deserializeState(eng.serializeState());
  assert.deepEqual(back.getState().lifestyle?.owned, ['daire']);
});
