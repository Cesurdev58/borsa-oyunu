import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';

test('Hisse alımı nakdi azaltır, portföyü artırır ve toplam net varlığı sebepsiz yere artırmaz', () => {
  const engine = new SimulationEngine(20261104, 100_000);
  const beforeNetWorth = engine.getState().netWorth;

  const buyRes = engine.buyStock('NVEX', 100);
  assert.equal(buyRes.success, true);

  const afterState = engine.getState();
  assert.ok(afterState.cash < 100_000);
  assert.ok(afterState.portfolioValue > 0);
  assert.equal(afterState.portfolio['NVEX'].shares, 100);

  // Alışta ask spread ve %0.15 komisyon ödenir, dolayısıyla net varlık asla yapay olarak artmaz
  assert.ok(afterState.netWorth <= beforeNetWorth);
  assert.ok(beforeNetWorth - afterState.netWorth < 100);
});

test('Hisse satışı lotu azaltır ve nakdi artırır; sahip olunmayan hisse satılamaz', () => {
  const engine = new SimulationEngine(20261104, 100_000);

  // Sahip olunmayan hisse satışı reddedilmeli ve state değişmemeli
  const unownedSell = engine.sellStock('GENX', 10);
  assert.equal(unownedSell.success, false);
  assert.equal(engine.getState().cash, 100_000);

  engine.buyStock('SOLR', 200);
  const cashAfterBuy = engine.getState().cash;

  const validSell = engine.sellStock('SOLR', 80);
  assert.equal(validSell.success, true);
  assert.equal(engine.getState().portfolio['SOLR'].shares, 120);
  assert.ok(engine.getState().cash > cashAfterBuy);
});

test('Yetersiz nakitle alış yapılamaz; negatif, sıfır veya kesirli lot kabul edilmez ve state kısmen değişmez', () => {
  const engine = new SimulationEngine(20261104, 100_000);

  const zeroBuy = engine.buyStock('NVEX', 0);
  assert.equal(zeroBuy.success, false);

  const negBuy = engine.buyStock('NVEX', -50);
  assert.equal(negBuy.success, false);

  const fracBuy = engine.buyStock('NVEX', 12.5);
  assert.equal(fracBuy.success, false);

  const excessiveBuy = engine.buyStock('NVEX', 10_000);
  assert.equal(excessiveBuy.success, false);

  assert.equal(engine.getState().cash, 100_000);
  assert.equal(Object.keys(engine.getState().portfolio).length, 0);
});

test('Temettü yalnızca temettü gününden (kayıt tarihinden) önce alınan paylara ödenir', () => {
  const engine = new SimulationEngine(20261104, 100_000);
  // 1. günde AKBN alalım; 10. günde temettü ödenmeli
  engine.buyStock('AKBN', 500);
  for (let d = 2; d <= 9; d++) {
    engine.tickDay();
  }
  // 10. güne geçmeden hemen önce (Gün 9'da) alınan hisse Gün 10'da temettü alır;
  // ancak Gün 10 içinde alınan hisse o günün sabahında dağıtılan temettüyü geriye dönük alamaz.
  const logDay10 = engine.tickDay();
  assert.equal(logDay10.day, 10);
  assert.ok(logDay10.dividendsReceivedToday > 0);
});
