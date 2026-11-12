import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESSION_RULES, ProgressionRules } from '../../engine/ProgressionRules';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStage } from '../../models/simulation';

test('İlerleme: girişimci aşaması net değer eşiğinde açılır (eşiğin hemen altında kapalı)', () => {
  const t = PROGRESSION_RULES.entrepreneurNetWorth;
  assert.equal(ProgressionRules.hasEntrepreneurAccess({ netWorth: t - 1 }), false);
  assert.equal(ProgressionRules.hasEntrepreneurAccess({ netWorth: t }), true);
  assert.equal(ProgressionRules.hasEntrepreneurAccess({}), false, 'net değer yoksa varsayılan 100.000 TL');
});

test('İlerleme: holding aşaması kilit ya da aşama numarasından anlaşılır', () => {
  assert.equal(ProgressionRules.isHoldingStage({}), false);
  assert.equal(ProgressionRules.isHoldingStage({ stage: SimulationStage.STAGE_3_IPO_PUBLIC }), false);
  assert.equal(ProgressionRules.isHoldingStage({ stage: SimulationStage.STAGE_4_HOLDING_MONOPOLY }), true);
});

test('İlerleme: genişleme bölgeleri 5 milyon TL net değerde açılır', () => {
  const t = PROGRESSION_RULES.expansionDistrictNetWorth;
  assert.equal(ProgressionRules.qualifiesForExpansionDistricts({ netWorth: t - 1 }), false);
  assert.equal(ProgressionRules.qualifiesForExpansionDistricts({ netWorth: t }), true);
});

test('İlerleme: 100.000 TL ile başlayan oyuncu 1. aşamadadır, aşama kilitleri kapalıdır', () => {
  const st = new SimulationEngine(20261104, 100_000).getState();
  assert.equal(st.stage, SimulationStage.STAGE_1_RETAIL_INVESTOR);
  assert.equal(st.stageUnlocks.stage2Entrepreneur, false);
  assert.equal(st.stageUnlocks.stage3Ipo, false);
  assert.equal(st.stageUnlocks.stage4Holding, false);
});

test('İlerleme: yeterli sermayeyle başlayan oyuncu girişimci aşamasında başlar ve kilit geri kapanmaz', () => {
  const engine = new SimulationEngine(20261104, 3_000_000);
  const st = engine.getState();
  assert.equal(st.stageUnlocks.stage2Entrepreneur, true);
  ProgressionRules.applyUnlocksAndStage(st);
  ProgressionRules.applyUnlocksAndStage(st);
  assert.equal(st.stage, SimulationStage.STAGE_2_ENTREPRENEUR);
  assert.equal(st.stageUnlocks.stage2Entrepreneur, true);
});
