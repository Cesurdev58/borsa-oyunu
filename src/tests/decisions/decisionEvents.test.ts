import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import {
  DECISION_TEMPLATES,
  canAffordChoice,
  ensureDecisionState,
  onDayClosed,
} from '../../engine/DecisionEventEngine';

function runUntilDecision(eng: SimulationEngine, maxDays = 25) {
  for (let i = 0; i < maxDays; i++) {
    eng.tickDay();
    if (eng.getState().decisionEvents?.pending) return eng.getState().decisionEvents!.pending!;
  }
  return null;
}

test('Birkaç gün içinde karar kartı çıkar ve aynı tohum aynı kartı üretir', () => {
  const a = new SimulationEngine(424242, 1_000_000);
  const b = new SimulationEngine(424242, 1_000_000);
  const pa = runUntilDecision(a);
  const pb = runUntilDecision(b);
  assert.ok(pa, 'karar kartı çıkmalı');
  assert.equal(pa!.eventId, pb!.eventId);
  assert.equal(pa!.choices.length, 2);
});

test('Dükkân yokken yalnızca dükkân gerektirmeyen olaylar çıkar', () => {
  const eng = new SimulationEngine(777, 100_000);
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    eng.tickDay();
    const p = eng.getState().decisionEvents?.pending;
    if (p) {
      seen.add(p.templateId);
      eng.resolveDecisionEvent('B');
    }
  }
  assert.ok(seen.size > 0);
  const shopOnly = new Set(DECISION_TEMPLATES.filter((t) => t.needsShop).map((t) => t.id));
  for (const id of seen) assert.ok(!shopOnly.has(id), `dükkânsız oyunda ${id} çıkmamalı`);
});

test('Para harcayan seçim nakdi tam o kadar düşürür ve kart kapanır', () => {
  const eng = new SimulationEngine(99, 1_000_000);
  eng.openShop({ shopType: 'BUFE' });
  let p = null;
  for (let i = 0; i < 40 && !p; i++) {
    eng.tickDay();
    const cur = eng.getState().decisionEvents?.pending ?? null;
    if (cur && cur.choices[0].effects.some((e) => e.kind === 'CASH' && e.amount < 0)) p = cur;
    else if (cur) eng.resolveDecisionEvent('B');
  }
  assert.ok(p, 'harcama gerektiren bir kart çıkmalı');
  const cost = p!.choices[0].effects
    .filter((e) => e.kind === 'CASH')
    .reduce((a, e) => a + (e as { amount: number }).amount, 0);
  const before = eng.getState().cash;
  const res = eng.resolveDecisionEvent('A');
  assert.equal(res.success, true);
  assert.ok(Math.abs(eng.getState().cash - (before + cost)) < 0.02, 'nakit değişimi seçim tutarına eşit olmalı');
  assert.equal(eng.getState().decisionEvents?.pending, null);
  assert.equal(eng.resolveDecisionEvent('A').success, false, 'aynı kart iki kez seçilemez');
});

test('Parası yetmeyen seçim yapılamaz', () => {
  const eng = new SimulationEngine(5, 1_000_000);
  const state = eng.getState();
  const ds = ensureDecisionState(state);
  const tpl = DECISION_TEMPLATES.find((t) => t.id === 'cousin-partner')!;
  const built = tpl.build({ state, shop: null, S: 1000, P: 50_000_000 });
  ds.pending = { ...built, eventId: 'T', templateId: tpl.id, day: state.day, expiresDay: state.day + 2 };
  assert.equal(canAffordChoice(state, ds.pending.choices[0], eng.getReservedCash()), false);
  assert.equal(eng.resolveDecisionEvent('A').success, false);
});

test('Ertelenmiş ödeme zamanı gelince hesaba geçer', () => {
  const eng = new SimulationEngine(5, 1_000_000);
  const state = eng.getState();
  const ds = ensureDecisionState(state);
  const tpl = DECISION_TEMPLATES.find((t) => t.id === 'old-debt')!;
  const built = tpl.build({ state, shop: null, S: 1000, P: 10_000 });
  ds.pending = { ...built, eventId: 'T2', templateId: tpl.id, day: state.day, expiresDay: state.day + 2 };
  assert.equal(eng.resolveDecisionEvent('B').success, true);
  const payout = ds.scheduledPayouts[0];
  assert.ok(payout && payout.willPay);
  const before = state.cash;
  state.day = payout.payDay;
  ds.pending = null;
  ds.lastEventDay = state.day; // yeni kart çıkmasın
  onDayClosed(state, eng.getReservedCash());
  assert.ok(Math.abs(state.cash - (before + payout.amount)) < 0.02);
});

test('Karar kartı kayıt ve yüklemede korunur; eski kayıtta alan yoksa oluşturulur', () => {
  const eng = new SimulationEngine(424242, 1_000_000);
  const p = runUntilDecision(eng);
  assert.ok(p);
  const env = SimulationStore.saveToStorage(eng);
  const migrated = SimulationStore.migrateIfNeeded(JSON.parse(JSON.stringify(env)));
  assert.equal(migrated?.state.decisionEvents?.pending?.eventId, p!.eventId);

  const old = JSON.parse(JSON.stringify(env));
  delete old.state.decisionEvents;
  const migratedOld = SimulationStore.migrateIfNeeded(old);
  assert.ok(migratedOld?.state.decisionEvents);
  assert.equal(migratedOld?.state.decisionEvents?.pending, null);
});
