/** Banka binası ilk dükkâna kadar kilitli; dükkân (ya da kredi/şirket) olunca açılır. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { deriveIsometricBuildings } from '../../components/game/city/cityLayout';

const bank = (eng: SimulationEngine) =>
  deriveIsometricBuildings(eng.getState(), eng.checkIPOEligibility(), (v) => `₺${v}`).find((b) => b.id === 'BANKA')!;

test('Yeni oyunda Banka kilitli ve açılma koşulunu söyler', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const b = bank(eng);
  assert.equal(b.isUnlocked, false);
  assert.ok(b.lockedOverlayInfo?.conditionText.includes('dükkân'));
});

test('İlk dükkân açılınca Banka açılır', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const b = bank(eng);
  assert.equal(b.isUnlocked, true);
  assert.equal(b.lockedOverlayInfo, null);
});
