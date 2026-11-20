import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { CAREER_GOALS, buildCareerGoals } from '../../engine/CareerGoals';
import { buildRichList } from '../../engine/RichListEngine';

test('Hedef ödülü gerçek paradır, yalnızca sıradaki ve tamamlanmış hedef alınır, iki kez alınamaz', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const cash0 = eng.getState().cash;
  // Sırası gelmemiş hedef alınamaz
  assert.equal(eng.claimCareerGoal('quest-05-open-first-shop').success, false);
  // Tamamlanmamış hedef alınamaz
  assert.equal(eng.claimCareerGoal('quest-01-open-borsa', { hasOpenedBorsa: false }).success, false);
  const r = eng.claimCareerGoal('quest-01-open-borsa', { hasOpenedBorsa: true });
  assert.equal(r.success, true, r.message);
  assert.equal(eng.getState().cash, cash0 + CAREER_GOALS[0].reward);
  assert.equal(eng.claimCareerGoal('quest-01-open-borsa', { hasOpenedBorsa: true }).success, false);
  assert.equal(eng.getState().careerGoals?.totalRewards, CAREER_GOALS[0].reward);
  // Kayıt/yüklemede alınan ödüller korunur
  const back = SimulationEngine.deserializeState(eng.serializeState());
  assert.deepEqual(back.getState().careerGoals?.claimed, ['quest-01-open-borsa']);
});

test('Borsa görevleri bitince sırayla ödül alınır ve ilk dükkân açılır', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const st = eng.getState().stocks;
  const a = st[0];
  const b = st.find((s) => s.sector !== a.sector)!;
  eng.buyStock(a.ticker, 20);
  eng.buyStock(b.ticker, 20);
  eng.sellStock(a.ticker, 5);
  eng.advanceDaysWithoutPlayerDecisions(1, true); // "Piyasayı bir gün izle" adımı
  for (const id of ['quest-01-open-borsa', 'quest-02-first-order', 'quest-03-two-sectors', 'quest-04-first-shop-gate']) {
    const r = eng.claimCareerGoal(id, { hasOpenedBorsa: true });
    assert.equal(r.success, true, `${id}: ${r.message}`);
  }
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  assert.equal(eng.claimCareerGoal('quest-05-open-first-shop').success, true);
});

test('Eski kayıt: zaten tamamlanmış hedefler ödülsüz alınmış sayılır (bedava para yok)', () => {
  const eng = new SimulationEngine(20261104, 3_000_000);
  eng.openShop({ shopType: 'BUFE' });
  const raw = JSON.parse(eng.serializeState());
  delete raw.careerGoals;
  const back = SimulationEngine.deserializeState(JSON.stringify(raw));
  const gs = back.getState().careerGoals!;
  assert.ok(gs.claimed.includes('quest-05-open-first-shop'));
  assert.equal(gs.totalRewards, 0);
  const model = buildCareerGoals(back.getState(), {});
  assert.ok(model.active && !model.active.claimed);
});

test('Zenginler listesi: yeni oyuncu en altta başlar, net varlık artınca sırası yükselir; kişiler uydurma', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const l0 = buildRichList(eng.getState());
  assert.equal(l0.playerRank, l0.total);
  assert.ok(l0.total >= 25);
  const rich = buildRichList({ ...eng.getState(), netWorth: 2_000_000 });
  assert.ok(rich.playerRank < l0.playerRank);
  assert.ok(rich.nextAbove && rich.nextAbove.netWorth > 2_000_000);
  const top = buildRichList({ ...eng.getState(), netWorth: 1e12 });
  assert.equal(top.playerRank, 1);
  assert.equal(top.nextAbove, null);
});
