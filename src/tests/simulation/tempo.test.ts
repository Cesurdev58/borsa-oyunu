import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { effectiveRealMinutesPerGameDay, maxOfflineGameDays, tempoPhase } from '../../engine/TempoRules';
import { TEMPO_COMPANY_MINUTES, TEMPO_EARLY_MINUTES } from '../../data/gameBalance';
import { SimulationStage } from '../../models/simulation';

test('Tempo: yeni oyunda hızlı başlangıç açık, şirket yokken bir gün 2 gerçek dakika', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  assert.equal(eng.getState().fastStartTempo, true);
  assert.equal(eng.getEffectiveMinutesPerGameDay(), TEMPO_EARLY_MINUTES);
  const res = eng.advanceRealSeconds(TEMPO_EARLY_MINUTES * 60);
  assert.equal(res.gameMinutesAdvanced, 1440);
  assert.equal(eng.getState().day, 2);
});

test('Tempo: şirket kurulunca 5 dk, halka arz sonrası seçilen uzunluk; kapatılınca hep seçilen uzunluk', () => {
  const base = { realMinutesPerGameDay: 15 as const, stage: SimulationStage.STAGE_1_RETAIL_INVESTOR, playerCompany: null };
  assert.equal(tempoPhase(base), 'EARLY');
  const withCo = { ...base, stage: SimulationStage.STAGE_2_ENTREPRENEUR, playerCompany: {} as never };
  assert.equal(effectiveRealMinutesPerGameDay(withCo), TEMPO_COMPANY_MINUTES);
  const ipo = { ...withCo, stage: SimulationStage.STAGE_3_IPO_PUBLIC };
  assert.equal(effectiveRealMinutesPerGameDay(ipo), 15);
  assert.equal(effectiveRealMinutesPerGameDay({ ...base, fastStartTempo: false }), 15);
  // Eski kayıtta alan yoksa açık sayılır
  assert.equal(effectiveRealMinutesPerGameDay(base), TEMPO_EARLY_MINUTES);
});

test('Tempo: çevrimdışı sınırı yaklaşık 2 gerçek saattir (kısa günlerde daha çok gün)', () => {
  const base = { realMinutesPerGameDay: 15 as const, stage: SimulationStage.STAGE_1_RETAIL_INVESTOR, playerCompany: null };
  assert.equal(maxOfflineGameDays({ ...base, fastStartTempo: false }), 8);
  assert.equal(maxOfflineGameDays(base), 60);
});

test('Tempo: ayar kayıt/yüklemede korunur', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  eng.setFastStartTempo(false);
  const back = SimulationEngine.deserializeState(eng.serializeState());
  assert.equal(back.getState().fastStartTempo, false);
  assert.equal(back.getEffectiveMinutesPerGameDay(), 15);
});
