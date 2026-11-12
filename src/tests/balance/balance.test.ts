import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_SHOP_MIN_NET_WORTH } from '../../data/gameBalance';
import { NEWS_TEMPLATES } from '../../engine/NewsEngine';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { restockShops } from './restockBot';

test('Denge: her sektörde olumlu ve olumsuz haberin toplam etkisi dengelidir (borsa tek yönlü yükselmez)', () => {
  const bySector = new Map<string, { net: number; pos: number; neg: number }>();
  for (const t of NEWS_TEMPLATES) {
    const e = bySector.get(t.sector) ?? { net: 0, pos: 0, neg: 0 };
    e.net += t.baseImpact / t.decayRate;
    if (t.baseImpact > 0) e.pos++;
    else e.neg++;
    bySector.set(t.sector, e);
  }
  for (const [sector, e] of bySector) {
    assert.ok(e.pos > 0 && e.neg > 0, `${sector}: hem olumlu hem olumsuz haber şablonu olmalı`);
    assert.ok(Math.abs(e.net) < 0.0008, `${sector}: haber etkisi dengesiz (${e.net.toFixed(5)})`);
  }
});

test('Denge: 100.000 TL ile başlayan oyuncu birikim yapmadan ilk dükkânı açamaz, nakdi değişmez', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const before = eng.getState().cash;
  const r = eng.openShop({ shopType: 'BUFE' });
  assert.equal(r.success, false);
  assert.match(r.message, /net değer/i);
  assert.equal(eng.getState().cash, before);
  assert.equal(eng.getState().tradeState?.shops.length ?? 0, 0);
});

test('Denge: eşik kadar net değeri olan oyuncu ilk dükkânı açabilir', () => {
  const eng = new SimulationEngine(20261104, FIRST_SHOP_MIN_NET_WORTH + 1);
  const r = eng.openShop({ shopType: 'BUFE' });
  assert.equal(r.success, true, r.message);
});

test('Denge: düzenli sipariş veren oyuncuda büfe kendini 25-90 günde çıkarır (eskiden ~5 gündü)', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const profits: number[] = [];
  for (let d = 1; d <= 50; d++) {
    restockShops(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
    if (d > 20) profits.push(eng.getState().tradeState!.shops[0].todayNetProfit);
  }
  const avg = profits.reduce((a, b) => a + b, 0) / profits.length;
  const payback = (35_000 * 1.25) / avg;
  assert.ok(avg > 0, 'büfe kâr etmeli');
  assert.ok(payback >= 25 && payback <= 90, `geri dönüş süresi ${payback.toFixed(0)} gün`);
});
