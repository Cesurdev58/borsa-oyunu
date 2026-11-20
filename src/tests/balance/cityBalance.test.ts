/**
 * Faz 13 (DENGE 32–34): 12 şehir için çok tohumlu kariyer testi.
 * Hızlı sürüm (~10 sn): ilk 150 oyun günü, 3 tohum. Tam ölçüm için `npm run city-balance`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getDetailedCityDefinitions } from '../../data/cityDefinitions';
import { runCityCareer, type CityCareerResult } from './cityBot';

const SEEDS = [20261104, 20269023, 20276942];
const DAYS = 150;
const cities = getDetailedCityDefinitions();
const careers = new Map<string, CityCareerResult[]>();
for (const c of cities) careers.set(c.id, SEEDS.map((s) => runCityCareer(c.id, s, DAYS)));

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

test('Denge 32: 12 şehrin hepsinde çok tohumlu kariyer tamamlanır, sayılar sonlu', () => {
  assert.equal(cities.length, 12);
  for (const c of cities) {
    const rs = careers.get(c.id)!;
    assert.equal(rs.length, SEEDS.length);
    for (const r of rs) {
      assert.ok(Number.isFinite(r.finalNetWorth) && Number.isFinite(r.minCash), `${c.id} sonlu`);
      assert.ok(r.shops >= 1, `${c.id}: robot en az bir dükkân açtı`);
    }
  }
});

test('Denge 32: hiçbir şehirde iflas yok (net varlık başlangıcın üstünde, nakit eksiye düşmez)', () => {
  for (const c of cities) {
    for (const r of careers.get(c.id)!) {
      assert.ok(r.finalNetWorth > r.startNetWorth, `${c.id}/${r.seed}: net varlık başlangıcın altında`);
      assert.ok(r.minCash >= 0, `${c.id}/${r.seed}: nakit eksiye düştü`);
      assert.ok(r.lossDayShare < 0.25, `${c.id}/${r.seed}: zararla biten gün oranı çok yüksek`);
    }
  }
});

test('Denge 33: en iyi ve en zayıf şehir farkı hesaplanır ve makul bantta kalır', () => {
  const at = (day: number) =>
    cities.map((c) => ({ id: c.id, v: mean(careers.get(c.id)!.map((r) => r.netWorthAt[day])) })).sort((a, b) => b.v - a.v);
  const list = at(90);
  assert.ok(list.every((x) => Number.isFinite(x.v) && x.v > 0));
  const best = list[0];
  const worst = list[list.length - 1];
  const spread = (best.v - worst.v) / best.v;
  console.log(`  [denge] 3. saat net varlık farkı: ${best.id} en iyi, ${worst.id} en zayıf, fark %${(spread * 100).toFixed(0)}`);
  assert.ok(spread > 0.02, 'şehirler gerçekten farklı olmalı');
  assert.ok(spread < 0.6, 'fark aşırı açılmamalı');
});

test('Denge 34: ilk dükkân ve ilk seviye yükseltmesi her şehirde hedef bantta', () => {
  for (const c of cities) {
    for (const r of careers.get(c.id)!) {
      assert.ok(r.firstShopDay !== null && r.firstShopDay <= 5, `${c.id}: ilk dükkân ≤ 5. gün (≈10 gerçek dk)`);
      assert.ok(r.firstUpgradeDay !== null && r.firstUpgradeDay <= 90, `${c.id}/${r.seed}: ilk yükseltme ≤ 90. gün (≈3 gerçek saat)`);
    }
  }
});
