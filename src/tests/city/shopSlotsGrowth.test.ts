import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { deriveCityUrbanBlocks, SHOP_SLOT_ORDER } from '../../components/game/city/cityLayout';

test('Şehir büyür: 4. dükkândan sonra başka bloklar sırayla oyuncunun dükkânına dönüşür, sıradaki yer "Dükkân aç" arsasıdır', () => {
  const eng = new SimulationEngine(20261104, 3_000_000);
  for (const t of ['BUFE', 'MANAV', 'KAFE', 'GIYIM_MAGAZASI', 'ELEKTRONIK_MAGAZASI']) {
    assert.equal(eng.openShop({ shopType: t as never }).success, true, t);
  }
  const shops = eng.getState().tradeState!.shops;
  const blocks = deriveCityUrbanBlocks(eng.getState());
  const byId = new Map(blocks.map((b) => [b.id, b]));
  shops.forEach((sh, i) => {
    const b = byId.get(SHOP_SLOT_ORDER[i])!;
    assert.equal(b.activeShopId, sh.shopId, `${i + 1}. dükkân ${SHOP_SLOT_ORDER[i]} bloğunda`);
    assert.equal(b.activeShopType, sh.shopType);
    assert.equal(b.isUnlocked, true);
  });
  const next = byId.get(SHOP_SLOT_ORDER[shops.length])!;
  assert.equal(next.shopLot, true);
  assert.equal(next.activeShopId, undefined);
  // Daha sonraki yerler henüz eski binası olarak kalır
  const later = byId.get(SHOP_SLOT_ORDER[shops.length + 1])!;
  assert.ok(!later.shopLot && !later.activeShopId);
});

test('Şehir: 3 dükkândan azken eski yerleşim aynen korunur', () => {
  const eng = new SimulationEngine(20261104, 3_000_000);
  eng.openShop({ shopType: 'BUFE' as never });
  const blocks = deriveCityUrbanBlocks(eng.getState());
  assert.ok(!blocks.some((b) => b.shopLot));
  assert.equal(blocks.find((b) => b.id === 'urban-ticaret-magaza-1')?.activeShopType, 'BUFE');
});
