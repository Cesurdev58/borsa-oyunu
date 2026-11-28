/**
 * Dükkân vitrini, sadeleştirilmiş 3 sekme ve Müşteri Karnesi penceresi (Faz 3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { EsnafAndTradePanel } from '../../components/game/EsnafAndTradePanel';
import { ShopReviewsSheet } from '../../components/game/ShopReviewsSheet';
import { ShopStorefront, STOREFRONT_PALETTES } from '../../components/game/ui/ShopStorefront';
import { SHOP_TEMPLATES } from '../../data/tradeCatalog';
import { restockShops } from '../balance/restockBot';
import type { ShopType } from '../../models/trade';

const noop = () => {};
const fmt = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;

function engineWithShop(days = 4) {
  const eng = new SimulationEngine(20261128, 4_000_000);
  assert.equal(eng.chooseStartCity('ankara').success, true);
  const r = eng.openShop({ shopType: 'KAFE', cityId: 'ankara' });
  assert.equal(r.success, true, r.message);
  for (let d = 0; d < days; d++) {
    restockShops(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
  }
  return eng;
}

function renderPanel(eng: SimulationEngine, extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    React.createElement(EsnafAndTradePanel, {
      state: eng.getState(),
      spendableCash: eng.getSpendableCash(),
      formatCurrency: fmt,
      onOpenShop: noop,
      onUpgradeShopLevel: noop,
      onTransferShopCash: noop,
      onConfigureShop: noop,
      onPlaceProcurementOrder: noop,
      onCancelProcurementOrder: noop,
      onCreatePurchaseContract: noop,
      onExecuteRecipeProduction: noop,
      onPurchaseLogisticsVehicle: noop,
      onDispatchWarehouseToShop: noop,
      onAcceptCommercialContract: noop,
      onDeliverCommercialContract: noop,
      onIncorporateShopsIntoCompany: noop,
      onHireFirstEmployee: noop,
      ...extra,
    } as never)
  );
}

test('Vitrin: 8 türün her birinin kendi tente rengi var; raf doluluğu stok oranını izler', () => {
  const types = Object.keys(SHOP_TEMPLATES) as ShopType[];
  assert.equal(types.length, 8);
  const colors = new Set(types.map((t) => STOREFRONT_PALETTES[t].awningA));
  assert.equal(colors.size, 8, 'her türün tentesi farklı');
  const draw = (fill: number) =>
    renderToStaticMarkup(
      React.createElement(ShopStorefront, {
        shopType: 'MANAV', name: 'Test', level: 2, fillRatio: fill, open: true, openLabel: 'Açık',
        stars: 4.6, liveProfit: 656, formatCurrency: fmt,
      })
    );
  const empty = draw(0);
  const full = draw(1);
  const count = (h: string) => (h.match(/<rect x="[\d.]+" y="[\d.-]+" width="16" height="16"/g) ?? []).length;
  assert.equal(count(empty), 0, 'boş rafta ürün çizilmez');
  assert.ok(count(full) >= 20, 'dolu rafta ürünler görünür');
  assert.match(full, /data-testid="shop-star-badge"/);
  assert.match(full, /4\.6/);
  assert.match(full, /Semtin Gözdesi/);
  assert.match(full, /data-testid="shop-live-profit"/);
  assert.match(full, /\+₺656/);
});

test('Dükkân ekranı sade: iç içe sekme yok, tekrar eden kutular yok, Tezgâh içeriği tek akışta', () => {
  const eng = engineWithShop();
  const html = renderPanel(eng);
  assert.match(html, /data-testid="shop-storefront"/);
  assert.match(html, /data-testid="shop-status-strip"/);
  // Eski kalabalık: büyük "Bugünün özeti" düğmesi, "Diğer aktarma seçenekleri", boş "yolda sipariş yok" kutusu
  assert.doesNotMatch(html, /Bugünün özeti ve ipucu/);
  assert.doesNotMatch(html, /Diğer aktarma seçenekleri/);
  assert.doesNotMatch(html, /Şu an yolda sipariş yok/);
  // Raf sayısı bir kez yazılır
  const shop = eng.getState().tradeState!.shops[0];
  const used = shop.inventoryBatches.reduce((a, b) => a + b.availableQuantity, 0).toFixed(0);
  const shelfText = `${used}/${shop.shelfCapacity + shop.backroomCapacity}`;
  assert.equal(html.split(shelfText).length - 1, 1, 'raf sayısı yalnızca bir kez');
  // Görünür ikinci sekme çubuğu yok: eski alt sekme kimlikleri gizli kapta
  const tabsIdx = html.indexOf('data-testid="shop-action-tab-ORDER_PRODUCT"');
  const hiddenIdx = html.lastIndexOf('<div class="hidden">', tabsIdx);
  assert.ok(hiddenIdx > 0 && tabsIdx - hiddenIdx < 200, 'alt sekmeler gizli');
  // Tezgâh: rafları doldur + ürün kartında fiyat kaydırıcısı, ayrı "Fiyatlar" kutusu yok
  assert.match(html, /data-testid="shop-restock-all-btn"/);
  assert.match(html, /data-testid="shop-price-slider-/);
  assert.doesNotMatch(html, /data-testid="shop-edit-prices-box"/);
  assert.match(html, /data-testid="shop-latest-review"/);
  assert.match(html, /data-testid="mode-esnaf-shops-btn"/);
  assert.doesNotMatch(html, /data-testid="mode-trade-center-btn"/, 'tek dükkânda Toptan & Üretim gizli');
});

test('Ekip & Geliştir ve Büyüme sekmeleri doğru kartları gösterir', () => {
  const eng = engineWithShop(2);
  const ekip = renderPanel(eng, { initialActionTab: 'MANAGE_STAFF' });
  assert.match(ekip, /data-testid="shop-small-upgrades"/);
  assert.doesNotMatch(ekip, /data-testid="shop-upgrade-confirm-btn"/);
  const buyume = renderPanel(eng, { initialActionTab: 'UPGRADE_SHOP' });
  assert.match(buyume, /data-testid="shop-upgrade-confirm-btn"/);
  assert.match(buyume, /data-testid="shop-open-branch-box"/);
  assert.doesNotMatch(buyume, /data-testid="shop-small-upgrades"/);
});

test('Müşteri Karnesi: yıldız, unvan, bonuslar, 4 sütun ve yorumlar', () => {
  const eng = engineWithShop(6);
  const shop = eng.getState().tradeState!.shops[0];
  const html = renderToStaticMarkup(React.createElement(ShopReviewsSheet, { shop, onClose: noop, onAction: noop }));
  assert.match(html, /data-testid="shop-reviews-modal"/);
  assert.match(html, /data-testid="shop-reviews-stars"/);
  assert.match(html, /data-testid="shop-reviews-tier"/);
  for (const p of ['VARIETY', 'PRICE', 'STOCK', 'SERVICE']) assert.match(html, new RegExp(`data-testid="shop-pillar-${p}"`));
  for (const t of ['Ürün Dengesi', 'Fiyat Adaleti', 'Raf Sürekliliği', 'Hizmet &amp; Ortam']) assert.ok(html.includes(t), t);
  assert.ok((shop.recentReviews ?? []).length > 0);
  assert.match(html, /data-testid="shop-review-item"/);
});
