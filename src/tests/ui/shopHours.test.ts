import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SHOP_HOURS, shopHoursLabel, shopOpenStatus } from '../../data/shopHours';
import { SHOP_TEMPLATES } from '../../engine/TradeAndShopEngine';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { ShopDashboard } from '../../components/game/buildings/ShopDashboard';

test('Her dükkân türünün çalışma saati var ve mantıklı', () => {
  for (const type of Object.keys(SHOP_TEMPLATES)) {
    const h = SHOP_HOURS[type as keyof typeof SHOP_HOURS];
    assert.ok(h, type);
    assert.ok(h.open >= 0 && h.open < h.close && h.close <= 24, type);
    assert.ok(h.close - h.open >= 8, `${type} en az 8 saat açık`);
  }
});

test('Açık/kapalı durumu ve Türkçe saat yazısı doğru', () => {
  assert.deepEqual(shopOpenStatus('BUFE', 12 * 60), { open: true, label: "Açık · 23:00'e kadar" });
  assert.deepEqual(shopOpenStatus('BUFE', 23 * 60 + 30), { open: false, label: "Kapalı · 07:00'de açılır" });
  assert.equal(shopOpenStatus('GIYIM_MAGAZASI', 9 * 60).label, "Kapalı · 10:00'da açılır");
  assert.equal(shopOpenStatus('GIYIM_MAGAZASI', 15 * 60).label, "Açık · 22:00'ye kadar");
  assert.equal(shopOpenStatus('OTOMOBIL_GALERISI', 15 * 60).label, "Açık · 19:00'a kadar");
  assert.equal(shopOpenStatus('KAFE', 23 * 60 + 59).label, 'Açık · gece yarısına kadar');
  assert.equal(shopOpenStatus('KAFE', 0).open, false);
  assert.equal(shopHoursLabel('KAFE'), '08:00–24:00');
});

test('Dükkân kartında açık/kapalı yazısı ve "Dünkü satış" görünür', () => {
  const eng = new SimulationEngine(20261113, 3_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const st = eng.getState();
  const shop = st.tradeState!.shops[0];
  const html = renderToStaticMarkup(
    React.createElement(ShopDashboard, {
      state: st,
      spendableCash: eng.getSpendableCash(),
      formatCurrency: (v: number) => `₺${Math.round(v)}`,
      onPlaceProcurementOrder: () => ({ success: true, message: '' }),
      onManage: () => {},
    } as any)
  );
  assert.ok(html.includes(`data-testid="shop-card-hours-${shop.shopId}"`));
  assert.ok(html.includes(shopOpenStatus('BUFE', st.minutesIntoCurrentDay).label.replace("'", '&#x27;')));
  assert.ok(html.includes('Dünkü satış'));
});
