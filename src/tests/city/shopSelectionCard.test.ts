import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { deriveCityUrbanBlocks } from '../../components/game/city/cityLayout';
import { IsometricSelectionOverlay } from '../../components/game/city/IsometricSelectionOverlay';

test('Şehirde dükkân bloğu seçilince satış, kâr, raf doluluğu ve "Rafları doldur" görünür', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const state = eng.getState();
  const shopId = state.tradeState!.shops[0].shopId;

  const blocks = deriveCityUrbanBlocks(state);
  const shopBlock = blocks.find((b) => b.activeShopId === shopId);
  assert.ok(shopBlock, 'açık dükkân bir şehir bloğuna bağlanmalı');

  const html = renderToStaticMarkup(
    React.createElement(IsometricSelectionOverlay, {
      selectedBuilding: null,
      selectedUrbanBlock: shopBlock,
      shopInfo: {
        shopId,
        sales: 1200,
        profit: 300,
        fillPct: 10,
        restockCost: 5000,
        canRestock: true,
      },
      formatCurrency: (v: number) => `₺${v}`,
      onRestockShop: () => {},
      onOpenDetailSheet: () => {},
      onClearSelection: () => {},
    })
  );
  assert.ok(html.includes('selection-shop-card'));
  assert.ok(html.includes('Rafları doldur'));
  assert.ok(html.includes('Azalıyor!'), 'düşük raf uyarısı görünmeli');
});
