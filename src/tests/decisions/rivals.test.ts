import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { DECISION_TEMPLATES } from '../../engine/DecisionEventEngine';
import { buildRichList } from '../../engine/RichListEngine';
import { restockShops } from '../balance/restockBot';

test('Rakip hamleleri: dükkân sahibi oyuncuya isimli rakip kartları çıkar', () => {
  const ids = DECISION_TEMPLATES.map((t) => t.id);
  for (const id of ['rival-next-door', 'rival-poach', 'rival-price-war']) assert.ok(ids.includes(id), id);
  const eng = new SimulationEngine(20261104, 1_000_000);
  eng.openShop({ shopType: 'BUFE' });
  eng.openShop({ shopType: 'MANAV' }); // rakipler en az 2 dükkânı olan oyuncuyu fark eder
  const seen: string[] = [];
  for (let d = 0; d < 120 && seen.length < 2; d++) {
    restockShops(eng);
    const p = eng.getState().decisionEvents?.pending;
    if (p && p.templateId.startsWith('rival-')) {
      seen.push(p.titleTR);
      eng.resolveDecisionEvent('A');
    } else if (p) {
      eng.resolveDecisionEvent('B');
    }
    eng.advanceDaysWithoutPlayerDecisions(1, true);
  }
  assert.ok(seen.length >= 1, '120 günde en az bir rakip kartı çıkmalı');
  const localNames = buildRichList(eng.getState()).entries.filter((e) => e.id.startsWith('local-')).map((e) => e.name);
  assert.ok(seen.every((t) => localNames.some((n) => t.startsWith(n))), `rakip adı zenginler listesinden: ${seen.join(' | ')}`);
});

test('Zenginler listesi: şirketin varsa aynı sektördeki kurucular "Rakibin" diye işaretlenir', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const st = eng.getState();
  const sector = st.stocks[0].sector;
  const list = buildRichList({ ...st, playerCompany: { sector } as never });
  const rivals = list.entries.filter((e) => e.title.startsWith('Rakibin'));
  assert.ok(rivals.length >= 1);
  assert.ok(rivals.every((e) => st.stocks.find((s) => s.ticker === e.ticker)?.sector === sector));
});
