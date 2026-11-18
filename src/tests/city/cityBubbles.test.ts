import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { deriveCityUrbanBlocks, SHOP_CASH_KEEP } from '../../components/game/city/cityLayout';

test('Şehir baloncukları: kasada fazla para varsa toplanabilir tutar, raf boşsa "boş raf" işareti', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const shop = eng.getState().tradeState!.shops[0];
  // Raflar boş, yolda mal yok → boş raf
  let b = deriveCityUrbanBlocks(eng.getState()).find((x) => x.activeShopId === shop.shopId)!;
  assert.equal(b.shelvesEmpty, true);
  // Kasaya para koy → toplanabilir tutar = kasa − işletme payı
  eng.transferBetweenPersonalAndShopCash({ shopId: shop.shopId, direction: 'TO_SHOP', amount: 20_000 });
  const cash = eng.getState().tradeState!.shops[0].cashAccountBalance;
  b = deriveCityUrbanBlocks(eng.getState()).find((x) => x.activeShopId === shop.shopId)!;
  assert.equal(b.collectableCash, Math.floor(cash - SHOP_CASH_KEEP));
  // Toplayınca kasada işletme payı kalır, baloncuk kaybolur
  eng.transferBetweenPersonalAndShopCash({ shopId: shop.shopId, direction: 'FROM_SHOP', amount: b.collectableCash! });
  b = deriveCityUrbanBlocks(eng.getState()).find((x) => x.activeShopId === shop.shopId)!;
  assert.equal(b.collectableCash, 0);
});
