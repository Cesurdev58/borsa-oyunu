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

test('Şirket dönemi: aynı sektördeki rakip kurucu kart çıkarır, "karşılık ver" şirket satışını geçici artırır', () => {
  const eng = new SimulationEngine(20261104, 2_500_000);
  const r = eng.establishCompany('Deneme A.Ş.', 'DNME', 'TEKNOLOJI', 2_000_000, {
    initialStaffCount: 40,
    initialCapacity: 100,
    initialRdBudget: 10_000,
  });
  assert.equal(r.success, true, r.message);
  let seen: string | null = null;
  for (let d = 0; d < 80 && !seen; d++) {
    const p = eng.getState().decisionEvents?.pending;
    if (p && p.templateId.startsWith('co-rival-')) {
      seen = p.titleTR;
      const choiceA = p.choices.find((c) => c.id === 'A')!;
      assert.equal(eng.resolveDecisionEvent('A').success, true);
      if (choiceA.effects.some((e) => e.kind === 'COMPANY_DEMAND')) {
        const b = eng.getState().playerCompany!.demandBoost;
        assert.ok(b && b.multiplier > 1 && b.untilOperatingDay > eng.getState().playerCompany!.operatingDays);
      }
    } else if (p) {
      eng.resolveDecisionEvent('B');
    }
    eng.advanceDaysWithoutPlayerDecisions(1, true);
  }
  assert.ok(seen, '80 günde en az bir şirket rakip kartı çıkmalı');
  const founders = eng.getState().stocks.filter((s) => s.sector === 'TEKNOLOJI').map((s) => s.ticker);
  assert.ok(founders.length > 0);
});
