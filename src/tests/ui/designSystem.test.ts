import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { deriveCityQuestStripModel } from '../../components/game/city/questAndHudLogic';
import { play, setFeedbackSettings, vibrate } from '../../components/game/ui/feedback';
import { FIRST_SHOP_MIN_NET_WORTH } from '../../data/gameBalance';

test('Hedef zinciri gerçek kariyer yolunu izler (gizli limit emri hedefi yok)', () => {
  const eng = new SimulationEngine(20261113, 100_000);
  const model = deriveCityQuestStripModel(eng.getState(), true);
  const ids = model.allQuests.map((q) => q.id);
  assert.equal(ids.length, 8);
  assert.ok(!ids.some((id) => id.includes('limit')), 'limit emri hedefi kaldırılmış olmalı');
  assert.ok(ids.includes('quest-05-open-first-shop'));
  assert.ok(ids.includes('quest-06-first-shop-profit'));
  const gate = model.allQuests.find((q) => q.id === 'quest-04-first-shop-gate');
  assert.ok(gate && gate.title.includes(String(FIRST_SHOP_MIN_NET_WORTH / 1000)));
});

test('İlk dükkân açılınca "İlk dükkânını aç" hedefi tamamlanır', () => {
  const eng = new SimulationEngine(20261113, 1_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const model = deriveCityQuestStripModel(eng.getState(), true);
  assert.equal(model.allQuests.find((q) => q.id === 'quest-05-open-first-shop')?.completed, true);
});

test('Ses ve titreşim sunucu tarafında / testte hata vermez', () => {
  setFeedbackSettings({ masterVolume: 80, effectsVolume: 80, isMuted: false });
  assert.doesNotThrow(() => {
    play('tap');
    play('coin');
    play('success');
    play('levelup');
    play('error');
    vibrate(10);
  });
});
