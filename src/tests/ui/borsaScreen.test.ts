import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { BorsaPanel } from '../../components/game/buildings/BorsaPanel';
import { OyuncuOfisiPanel } from '../../components/game/buildings/OyuncuOfisiPanel';

const fc = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;

function props(engine: SimulationEngine, ticker: string) {
  return {
    state: engine.getState(),
    selectedTicker: ticker,
    onSelectTicker: () => {},
    onPlaceOrder: () => {},
    onCancelOrder: () => {},
    onBuyStock: () => {},
    onSellStock: () => {},
    spendableCash: engine.getSpendableCash(),
    reservedCash: engine.getReservedCash(),
    getReservedShares: (t: string) => engine.getReservedShares(t),
    formattedTime: engine.getFormattedGameTime(),
    formatCurrency: fc,
  } as any;
}

test('Borsa ekranında Varlıklarım, İşlem geçmişi ve Hedef emir kutuları var; içerikleri DOM\'da hazır', () => {
  const engine = new SimulationEngine(20261113, 100_000);
  const ticker = engine.getState().stocks[0].ticker;
  engine.buyStock(ticker, 10);
  const html = renderToStaticMarkup(React.createElement(BorsaPanel, props(engine, ticker)));
  for (const id of [
    'borsa-tools-strip',
    'assets-toggle',
    'borsa-history-toggle',
    'tycoon-advanced-toggle',
    'borsa-assets-section',
    'borsa-history-section',
    'borsa-orders-section',
    `portfolio-pos-${ticker}`,
    'tycoon-limit-price-input',
    'tycoon-place-buy-order-btn',
    'tycoon-place-sell-order-btn',
  ]) {
    assert.ok(html.includes(`data-testid="${id}"`), id);
  }
});

test('Lot kutuları tek sırada: 10, 50, 100, Hepsini al, Hepsini sat aynı boyda', () => {
  const engine = new SimulationEngine(20261113, 100_000);
  const ticker = engine.getState().stocks[0].ticker;
  const html = renderToStaticMarkup(React.createElement(BorsaPanel, props(engine, ticker)));
  const start = html.indexOf('data-testid="tycoon-lot-presets"');
  assert.ok(start > 0);
  const row = html.slice(start, html.indexOf('data-testid="tycoon-quick-buy-btn"'));
  for (const id of ['tycoon-lot-preset-10', 'tycoon-lot-preset-50', 'tycoon-lot-preset-100', 'tycoon-lot-max-buy-btn', 'tycoon-lot-max-sell-btn']) {
    assert.ok(row.includes(id), id);
  }
  // Eski kocaman kırmızı "Hepsini sat" düğmesi yok: hepsi aynı küçük kutu sınıfını kullanır.
  assert.equal((row.match(/g-choice min-h-\[48px\]/g) || []).length, 5);
  assert.ok(!row.includes('bg-rose-100'));
});

test('Dükkân ekranında artık Varlıklarım bölümü yok', () => {
  const engine = new SimulationEngine(20261113, 100_000);
  const html = renderToStaticMarkup(
    React.createElement(OyuncuOfisiPanel, props(engine, engine.getState().stocks[0].ticker))
  );
  assert.ok(!html.includes('data-testid="assets-toggle"'));
  assert.ok(!html.includes('İşlem Geçmişi'));
});
