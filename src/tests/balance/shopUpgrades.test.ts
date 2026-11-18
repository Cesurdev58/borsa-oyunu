import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { listShopUpgrades, shopUpgradeMultipliers } from '../../engine/ShopUpgrades';
import { restockShops } from './restockBot';

test('Küçük yükseltme: seviye kapısı, ödeme, tekrar alınamaz, kayıtta kalır', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  const shop = eng.getState().tradeState!.shops[0];
  const cash0 = eng.getState().cash + shop.cashAccountBalance;
  const tabela = listShopUpgrades(shop).find((u) => u.def.id === 'tabela')!;
  assert.equal(tabela.status, 'AVAILABLE');
  const r = eng.buyShopUpgrade(shop.shopId, 'tabela');
  assert.equal(r.success, true, r.message);
  const after = eng.getState().cash + eng.getState().tradeState!.shops[0].cashAccountBalance;
  assert.ok(Math.abs(cash0 - after - tabela.cost) < 0.01);
  assert.equal(eng.buyShopUpgrade(shop.shopId, 'tabela').success, false, 'iki kez alınamaz');
  assert.equal(eng.buyShopUpgrade(shop.shopId, 'kasa').success, false, '2. seviye ister');
  const back = SimulationEngine.deserializeState(eng.serializeState());
  assert.deepEqual(back.getState().tradeState!.shops[0].upgrades, ['tabela']);
  assert.ok(shopUpgradeMultipliers(back.getState().tradeState!.shops[0]).customers > 1);
});

test('Küçük yükseltmeler dükkân kârını artırır (aynı tohumla karşılaştırma)', () => {
  const run = (buy: boolean) => {
    const eng = new SimulationEngine(20261104, 1_000_000);
    eng.openShop({ shopType: 'MANAV' });
    const id = eng.getState().tradeState!.shops[0].shopId;
    if (buy) {
      eng.buyShopUpgrade(id, 'tabela');
      eng.buyShopUpgrade(id, 'vitrin');
    }
    let sum = 0;
    for (let d = 1; d <= 40; d++) {
      restockShops(eng);
      eng.advanceDaysWithoutPlayerDecisions(1, true);
      if (d > 10) sum += eng.getState().tradeState!.shops[0].todaySalesRevenue;
    }
    return sum;
  };
  assert.ok(run(true) > run(false) * 1.03);
});
