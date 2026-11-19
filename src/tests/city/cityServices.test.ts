import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { restockShops } from '../balance/restockBot';
import {
  secondHandStockLines,
  solarDailySaving,
  solarPanelCost,
  usedUpgradeOffers,
  cityProjectCustomerMultiplier,
} from '../../engine/CityServices';
import { CITY_PROJECTS, SECONDHAND_SELL_RATE, USED_UPGRADE_DAYS } from '../../data/cityServices';
import { shopUpgradeMultipliers } from '../../engine/ShopUpgrades';
import { deriveCityUrbanBlocks } from '../../components/game/city/cityLayout';

function withShop() {
  const eng = new SimulationEngine(20261104, 2_000_000);
  assert.equal(eng.openShop({ shopType: 'MANAV' }).success, true);
  return eng;
}

test('Şehir hizmeti binaları ilk dükkânla açılır', () => {
  const eng = new SimulationEngine(20261104, 2_000_000);
  const svc = () => deriveCityUrbanBlocks(eng.getState()).filter((b) => b.cityService);
  assert.equal(svc().length, 6);
  assert.ok(svc().every((b) => !b.isUnlocked), 'dükkân yokken kapalı');
  eng.openShop({ shopType: 'BUFE' });
  assert.ok(svc().every((b) => b.isUnlocked), 'dükkânla açık');
  assert.ok(svc().some((b) => b.nameTR === 'İkinci El Pazarı'));
});

test('İkinci el pazarı: mal alış maliyetinin altında satılır, para dükkân kasasına girer', () => {
  const eng = withShop();
  const shop = () => eng.getState().tradeState!.shops[0];
  for (let d = 0; d < 6 && secondHandStockLines(shop()).length === 0; d++) {
    restockShops(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
  }
  const lines = secondHandStockLines(shop());
  assert.ok(lines.length > 0, 'rafta mal olmalı');
  const l = lines[0];
  assert.ok(l.payout < l.costValue, 'hep zararına');
  assert.equal(l.payout, Math.floor(l.costValue * SECONDHAND_SELL_RATE));
  const cash0 = shop().cashAccountBalance;
  const r = eng.sellStockSecondHand(shop().shopId, l.resourceId);
  assert.equal(r.success, true, r.message);
  assert.ok(Math.abs(shop().cashAccountBalance - (cash0 + l.payout)) < 1);
  assert.equal(secondHandStockLines(shop()).find((x) => x.resourceId === l.resourceId), undefined, 'mal raftan kalktı');
  assert.equal(eng.sellStockSecondHand(shop().shopId, l.resourceId).success, false);
});

test('İkinci el eşya: yarı fiyatına, etkisi var, süresi bitince kalkar; yenisi alınınca ikinci el atılır', () => {
  const eng = withShop();
  const offers = usedUpgradeOffers(eng.getState());
  assert.ok(offers.length > 0 && offers.length <= 3);
  assert.deepEqual(usedUpgradeOffers(eng.getState()).map((o) => o.key), offers.map((o) => o.key), 'aynı gün aynı ilanlar');
  const o = offers[0];
  assert.ok(o.price < o.newPrice);
  const shop = () => eng.getState().tradeState!.shops[0];
  const before = shopUpgradeMultipliers(shop());
  const r = eng.buyUsedUpgrade(o.key);
  assert.equal(r.success, true, r.message);
  const after = shopUpgradeMultipliers(shop());
  assert.ok(after.customers * after.basket > before.customers * before.basket, 'etkisi olmalı');
  const after2 = usedUpgradeOffers(eng.getState());
  assert.equal(after2.find((x) => x.key === o.key)?.sold, true, 'alınan ilan "satıldı" olur');
  assert.equal(after2.length, offers.length, 'yerine yeni ilan gelmez');
  assert.equal(eng.buyUsedUpgrade(o.key).success, false);
  // Kayıttan yükleyince kalır
  const back = SimulationEngine.deserializeState(eng.serializeState());
  assert.ok(back.getState().tradeState!.shops[0].usedUpgrades?.[o.def.id]);
  // Süresi bitince kalkar
  eng.advanceDaysWithoutPlayerDecisions(USED_UPGRADE_DAYS + 1, true);
  assert.equal(shop().usedUpgrades?.[o.def.id], undefined, 'eskidi');
});

test('Belediye: projeler sırayla, nakitten ödenir, bütün dükkânlara müşteri ve itibar verir', () => {
  const eng = withShop();
  const [p1, p2] = CITY_PROJECTS;
  assert.equal(eng.fundCityProject(p2.id).success, false, 'sırayla');
  const cash0 = eng.getState().cash;
  const rep0 = eng.getState().tradeState!.tradeReputationScore;
  const r = eng.fundCityProject(p1.id);
  assert.equal(r.success, true, r.message);
  assert.equal(eng.getState().cash, cash0 - p1.price);
  assert.equal(eng.getState().tradeState!.tradeReputationScore, rep0 + p1.reputation);
  assert.equal(eng.fundCityProject(p1.id).success, false, 'iki kez olmaz');
  assert.ok(cityProjectCustomerMultiplier(eng.getState().tradeState!.cityProjects) > 1);
});

test('Trafo: güneş paneli kira + işletme giderini düşürür, bir kez alınır', () => {
  const eng = withShop();
  const shop = () => eng.getState().tradeState!.shops[0];
  const cost = solarPanelCost(shop());
  const saving = solarDailySaving(shop());
  assert.ok(cost > 0 && saving > 0);
  eng.advanceDaysWithoutPlayerDecisions(1, true);
  const opex0 = shop().todayRentAndOpex;
  assert.equal(eng.buySolarPanel(shop().shopId).success, true);
  assert.equal(eng.buySolarPanel(shop().shopId).success, false);
  eng.advanceDaysWithoutPlayerDecisions(1, true);
  assert.ok(Math.abs(opex0 - shop().todayRentAndOpex - saving) < 2, `${opex0} → ${shop().todayRentAndOpex}`);
});
