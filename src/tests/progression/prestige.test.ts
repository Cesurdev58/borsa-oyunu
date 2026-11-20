import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { prestigeBonuses, startNewCity, starsEarnedFor } from '../../engine/PrestigeEngine';
import { CAREER_GOALS } from '../../engine/CareerGoals';
import { PRESTIGE_MAX_STARS } from '../../data/gameBalance';

const make = (seed: number, cash: number) => new SimulationEngine(seed, cash);

test('Prestij: 10 milyonun altında yeni şehre geçilemez', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  assert.equal(startNewCity(eng.getState(), make).success, false);
});

test('Prestij: servete göre yıldız, yeni şehirde başlangıç parası artar, eski şehir taşınmaz, kayıtta kalır', () => {
  const old = new SimulationEngine(20261104, 60_000_000);
  old.openShop({ shopType: 'BUFE' });
  old.setFastStartTempo(false);
  const r = startNewCity(old.getState(), make);
  assert.equal(r.success, true, r.message);
  assert.equal(r.starsEarned, 2);
  const st = r.engine!.getState();
  assert.deepEqual(st.prestige, { stars: 2, cities: 1, bestNetWorth: Math.round(old.getState().netWorth), pointsEarned: 2, perks: {} });
  assert.equal(st.cash, prestigeBonuses(2).startCash);
  assert.equal(st.tradeState?.shops.length ?? 0, 0, 'dükkânlar eski şehirde kalır');
  assert.equal(st.fastStartTempo, false, 'ayar taşınır');
  assert.notEqual(st.seed, old.getState().seed, 'yeni şehrin piyasası farklı');
  const back = SimulationEngine.deserializeState(r.engine!.serializeState());
  assert.equal(back.getState().prestige?.stars, 2);
});

test('Prestij: yıldızlar hedef ödülünü artırır ve toplam sınırı aşılmaz', () => {
  assert.equal(starsEarnedFor(1e13, PRESTIGE_MAX_STARS - 1), 1);
  const eng = new SimulationEngine(20261104, 100_000);
  eng.getState().prestige = { stars: 5, cities: 3, bestNetWorth: 1 };
  const cash0 = eng.getState().cash;
  assert.equal(eng.claimCareerGoal(CAREER_GOALS[0].id, { hasOpenedBorsa: true }).success, true);
  assert.equal(eng.getState().cash - cash0, Math.round((CAREER_GOALS[0].reward * prestigeBonuses(5).rewardMult) / 100) * 100);
});
