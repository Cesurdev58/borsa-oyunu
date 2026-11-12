import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { ShopDashboard } from '../../components/game/buildings/ShopDashboard';

function render(eng: SimulationEngine) {
  return renderToStaticMarkup(
    React.createElement(ShopDashboard, {
      state: eng.getState(),
      spendableCash: 1_000_000,
      formatCurrency: (v: number) => `₺${v}`,
      onPlaceProcurementOrder: () => {},
      onManage: () => {},
    })
  );
}

test('Dükkân varken "Bugünün görevleri" kartı görünür ve boş raf görevi tamamlanmamış sayılır', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const html = render(eng);
  assert.ok(html.includes('daily-tasks-card'));
  assert.ok(html.includes('Bugünün görevleri'));
  assert.ok(/data-testid="daily-task-profit"[^>]*data-done="false"/.test(html));
});

test('Dükkân yokken görev kartı yerine ilk dükkân ilerlemesi görünür', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  const html = render(eng);
  assert.ok(html.includes('first-shop-progress'));
  assert.ok(!html.includes('daily-tasks-card'));
});
