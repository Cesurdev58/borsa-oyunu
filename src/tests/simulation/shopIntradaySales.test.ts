import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { restockShops } from '../balance/restockBot';
import { liveShopToday, openFractionElapsed } from '../../engine/ShopSales';

function prepared() {
  const e = new SimulationEngine(4242, 2_000_000);
  assert.equal(e.openShop({ shopType: 'BUFE' }).success, true);
  restockShops(e);
  e.advanceDaysWithoutPlayerDecisions(3, true);
  restockShops(e);
  return e;
}

test('Açık saat oranı: büfe 07–23 arası doğrusal artar', () => {
  assert.equal(openFractionElapsed('BUFE', 6 * 60), 0);
  assert.equal(openFractionElapsed('BUFE', 15 * 60), 0.5);
  assert.equal(openFractionElapsed('BUFE', 23 * 60), 1);
});

test('Dükkân gün içinde parça parça satar, para kasaya hemen girer; kapalıyken satış yok', () => {
  const e = prepared();
  const st = e.getState();
  const shop = () => st.tradeState!.shops[0];
  e.advanceGameMinutes(6 * 60);
  assert.equal(liveShopToday(shop(), st.day, st.minutesIntoCurrentDay).revenue, 0, 'büfe 07:00 öncesi kapalı');
  const cash0 = shop().cashAccountBalance;
  e.advanceGameMinutes(6 * 60); // 12:00
  const noon = liveShopToday(shop(), st.day, st.minutesIntoCurrentDay).revenue;
  assert.ok(noon > 0, 'öğlene kadar satış oldu');
  assert.ok(Math.abs(shop().cashAccountBalance - cash0 - noon) < 0.05, 'satış parası kasaya girdi');
  e.advanceGameMinutes(6 * 60); // 18:00
  assert.ok(liveShopToday(shop(), st.day, st.minutesIntoCurrentDay).revenue > noon, 'akşama doğru arttı');
});

test('Gün içinde satılan toplam, hızlı ilerletmeyle birebir aynı (denge değişmez)', () => {
  const a = prepared();
  const b = prepared();
  a.advanceGameMinutes(1441 - a.getState().minutesIntoCurrentDay);
  b.advanceDaysWithoutPlayerDecisions(1, true);
  const sa = a.getState().tradeState!.shops[0];
  const sb = b.getState().tradeState!.shops[0];
  assert.equal(sa.todaySalesRevenue, sb.todaySalesRevenue);
  assert.equal(sa.todayNetProfit, sb.todayNetProfit);
  assert.equal(sa.cashAccountBalance, sb.cashAccountBalance);
  // Yeni gün başladı: canlı sayaç sıfırdan başlar
  assert.equal(liveShopToday(sa, a.getState().day, a.getState().minutesIntoCurrentDay).revenue, 0);
});
