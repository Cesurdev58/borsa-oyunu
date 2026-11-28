/**
 * Mobil/Android düzeltmeleri: aynı `state` nesnesi yerinde güncellenirken menü donmamalı,
 * sticky çubukları bozan overflow olmamalı, durum çubuğu yalnızca native'de ayarlanmalı.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { navTabStatuses } from '../../engine/OnboardingRules';
import { setupNativeStatusBar } from '../../nativeStatusBar';

test('aynı state referansı güncellenince menü sekmeleri açılır (yeniden bağlanmadan)', () => {
  const eng = new SimulationEngine();
  const state = eng.getState();
  const before = navTabStatuses(state);
  assert.equal(before.news.mode, 'hidden');
  const a = state.stocks[0];
  const b = state.stocks.find((s) => s.sector !== a.sector)!;
  assert.equal(eng.buyStock(a.ticker, 10).success, true);
  assert.equal(eng.buyStock(b.ticker, 10).success, true);
  assert.equal(eng.sellStock(a.ticker, 5).success, true);
  eng.advanceDaysWithoutPlayerDecisions(1, true);
  assert.equal(eng.getState(), state, 'durum nesnesi aynı referans kalmalı');
  const after = navTabStatuses(state);
  assert.equal(after.news.mode, 'active');
  assert.equal(after.bank.mode, 'active');
  assert.notEqual(after.portfolio.mode, 'hidden');
  assert.notEqual(after.company.mode, 'hidden');
});

test('state bağımlı useMemo önbelleği kalmadı', () => {
  for (const f of [
    'game/TycoonGameView.tsx',
    'game/FirstRunGuide.tsx',
    'game/EsnafAndTradePanel.tsx',
    'game/buildings/ShopDashboard.tsx',
    'game/turkeyMap/StartCityScreen.tsx',
    'game/turkeyMap/TurkeyMapScreen.tsx',
  ]) {
    const src = fs.readFileSync(`src/components/${f}`, 'utf8');
    assert.doesNotMatch(src, /useMemo\([\s\S]{0,300}\[[^\]]*\bstate\b/, f);
  }
});

test('ana kapsayıcı overflow-x-hidden kullanmaz (sticky çubuklar için)', () => {
  const src = fs.readFileSync('src/components/game/TycoonGameView.tsx', 'utf8');
  assert.doesNotMatch(src, /overflow-x-hidden/);
  assert.match(src, /overflow-x-clip/);
});

test('durum çubuğu kurulumu tarayıcıda sessizce geçer', async () => {
  await assert.doesNotReject(setupNativeStatusBar());
});
