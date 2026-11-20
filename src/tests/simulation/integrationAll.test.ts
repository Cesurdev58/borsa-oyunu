import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { startNewCity, buyPerk, firstShopCostMultiplier } from '../../engine/PrestigeEngine';
import { stepAchievementsDayClose, getAchievements } from '../../engine/Achievements';

const make = (seed: number, cash: number) => new SimulationEngine(seed, cash);

test('Birleşik: prestij + başarım + kilometre taşı alanları kayıttan geçer, indirimler birbirini ezmez', () => {
  const old = new SimulationEngine(20261104, 60_000_000);
  const r = startNewCity(old.getState(), make);
  const eng = r.engine!;
  const st = eng.getState();
  assert.equal(buyPerk(st, 'ticket').success, true);
  // İlk dükkân: prestij indirimi %20; ikinci dükkân: prestij indirimi yok
  assert.ok(Math.abs(firstShopCostMultiplier(st) - 0.8) < 1e-9);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  assert.equal(firstShopCostMultiplier(st), 1);
  st.day += 1;
  stepAchievementsDayClose(st);
  const back = SimulationEngine.deserializeState(eng.serializeState()).getState();
  assert.equal(back.prestige?.perks?.ticket, 1);
  assert.deepEqual(Object.keys(getAchievements(back).unlocked).sort(), Object.keys(getAchievements(st).unlocked).sort());
  assert.ok(back.milestones, 'kilometre taşı durumu kayıtta kalır');
  // Çevrimdışı: normal durumda ilerler, risk yoksa durmaz
  const sum = back.lastOfflineSummary;
  assert.ok(sum === undefined || sum === null || !sum.pause);
});
