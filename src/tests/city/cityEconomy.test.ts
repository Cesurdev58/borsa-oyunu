import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { WalletEngine } from '../../engine/WalletEngine';
import {
  cityDemandLayers,
  cityRentFactor,
  cityWageFactor,
  computeLogisticsRoute,
  citySeasonFactor,
  distanceFactor,
  distanceKind,
  effectiveDailyRent,
  safeMultiplier,
} from '../../engine/CityEconomy';
import { getCityExpansionQuote, milestoneDiscountsAvailable, syncMilestoneDiscounts } from '../../engine/CityExpansionQuote';
import { CityInfoSheet } from '../../components/game/turkeyMap/CityInfoSheet';
import { CITY_DEFINITIONS, CITY_IDS, getDetailedCityDefinitions } from '../../data/cityDefinitions';
import { CITY_MULTIPLIER_MAX, CITY_MULTIPLIER_MIN } from '../../data/cityBalance';
import { restockShops } from '../balance/restockBot';
import { liveShopToday } from '../../engine/ShopSales';
import type { Warehouse } from '../../models/trade';
import type { CityId } from '../../models/cities';

function rich(seed: number, cash = 20_000_000) {
  const e = new SimulationEngine(seed, cash);
  e.chooseStartCity('ankara');
  return e;
}

function ledgerOpenSum(e: SimulationEngine, day: number, seq: number): number {
  return (e.getState().centralLedger?.transactions ?? [])
    .filter((t) => (t.idempotencyKey ?? '').startsWith('SHOP-OPEN-') && (t.idempotencyKey ?? '').endsWith(`-D${day}-S${seq}`))
    .reduce((s, t) => s + t.amount, 0);
}

// ---------------------------------------------------------------------------
// Faz 8: çarpanlar tek yerde, korumalı
// ---------------------------------------------------------------------------

test('Çarpan koruması: NaN, sonsuz, negatif ve sıfır 1 olur; büyük sayı sınıra kesilir', () => {
  for (const bad of [NaN, Infinity, -Infinity, -3, 0, undefined, null, 'x']) assert.equal(safeMultiplier(bad as never), 1);
  assert.equal(safeMultiplier(50), CITY_MULTIPLIER_MAX);
  assert.equal(safeMultiplier(0.01), CITY_MULTIPLIER_MIN);
});

test('81 ilin bütün şehir çarpanları ve talep katmanları sonlu ve pozitif', () => {
  for (const id of CITY_IDS) {
    for (const f of [cityRentFactor(id), cityWageFactor(id)]) assert.ok(Number.isFinite(f) && f > 0, id);
    for (const v of Object.values(cityDemandLayers(id, 'KAFE', 123))) assert.ok(Number.isFinite(v) && v > 0, id);
  }
});

test('Ankara referanstır (çarpanlar 1,00); şehri bilinmeyen dükkân tarafsızdır', () => {
  assert.equal(cityRentFactor('ankara'), 1);
  assert.equal(cityWageFactor('ankara'), 1);
  assert.deepEqual(cityDemandLayers('ankara', 'ELEKTRONIK_MAGAZASI', 50).customers, 1);
  assert.equal(cityRentFactor(undefined), 1);
  assert.equal(cityRentFactor('olmayan-sehir'), 1);
  assert.equal(cityDemandLayers(undefined, 'BUFE', 1).customers, 1);
});

test('Şehirler gerçekten farklı: İstanbul pahalı ve yoğun, Konya ucuz', () => {
  assert.ok(cityRentFactor('istanbul') > cityRentFactor('konya'));
  assert.ok(cityWageFactor('istanbul') > cityWageFactor('konya'));
  assert.ok(cityDemandLayers('istanbul', 'BUFE', 10).customers > cityDemandLayers('konya', 'BUFE', 10).customers);
});

test('Mevsim: Antalya yazın yüksek, kışın düşük; bir yılın ortalaması 1 civarı; Ankara düz', () => {
  const summer = citySeasonFactor('antalya', 'KAFE', 200);
  const winter = citySeasonFactor('antalya', 'KAFE', 18);
  assert.ok(summer > 1.2 && winter < 0.8, `${summer} / ${winter}`);
  let sum = 0;
  for (let d = 0; d < 365; d++) sum += citySeasonFactor('antalya', 'KAFE', d);
  assert.ok(Math.abs(sum / 365 - 1) < 0.01);
  assert.equal(citySeasonFactor('ankara', 'KAFE', 200), 1);
});

test('Şehir kirası ve maaşı gerçek günlük gideri değiştirir (aynı tohum, farklı şehir)', () => {
  const run = (city: string) => {
    const e = rich(2024);
    e.openShop({ shopType: 'BUFE', cityId: 'ankara' }); // 1. dükkân merkez
    const shop = e.openShop({ shopType: 'MANAV', cityId: city }).shop!;
    restockShops(e);
    e.advanceDaysWithoutPlayerDecisions(2, true);
    const s = e.getState().tradeState!.shops.find((x) => x.shopId === shop.shopId)!;
    return s;
  };
  const ist = run('istanbul');
  const kon = run('konya');
  assert.ok(ist.todayRentAndOpex > kon.todayRentAndOpex);
  assert.ok(ist.todayPayrollCost > kon.todayPayrollCost);
  // gider formülü: (şehir kirası + seviye×120) — motorun yazdığı değerle aynı
  const expectedIst = (effectiveDailyRent(ist) + ist.level * 120);
  assert.ok(Math.abs(ist.todayRentAndOpex - expectedIst) < 0.02);
});

test('Canlı gün ile hızlı ilerletilen gün şehirli dükkânda kuruşu kuruşuna aynı (çevrimiçi = çevrimdışı)', () => {
  const make = () => {
    const e = rich(31337);
    e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
    e.openShop({ shopType: 'KAFE', cityId: 'antalya' });
    e.openShop({ shopType: 'BUFE', cityId: 'istanbul' });
    restockShops(e);
    e.advanceDaysWithoutPlayerDecisions(2, true);
    restockShops(e);
    return e;
  };
  const a = make();
  const b = make();
  a.advanceGameMinutes(2 * 1440 - a.getState().minutesIntoCurrentDay);
  b.advanceDaysWithoutPlayerDecisions(2, true);
  const sa = a.getState().tradeState!.shops;
  const sb = b.getState().tradeState!.shops;
  for (let i = 0; i < sa.length; i++) {
    assert.equal(sa[i].cumulativeRevenue, sb[i].cumulativeRevenue, sa[i].cityId);
    assert.equal(sa[i].cashAccountBalance, sb[i].cashAccountBalance, sa[i].cityId);
    assert.equal(sa[i].todayRentAndOpex, sb[i].todayRentAndOpex, sa[i].cityId);
    assert.equal(sa[i].todayPayrollCost, sb[i].todayPayrollCost, sa[i].cityId);
  }
});

test('Çevrimdışı ilerleme de aynı şehir ekonomisini kullanır: İstanbul dükkânının satışı ve giderleri gün gün ilerlemeyle aynı', () => {
  const make = () => {
    const e = rich(4242);
    e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
    e.openShop({ shopType: 'MANAV', cityId: 'istanbul' });
    restockShops(e);
    return e;
  };
  const a = make();
  const b = make();
  const minPerDay = a.getEffectiveMinutesPerGameDay();
  const t0 = Date.parse(a.getState().lastRealTimestampISO);
  const t1 = new Date(t0 + 3 * minPerDay * 60_000).toISOString();
  a.processOfflineProgress(new Date(t0).toISOString(), t1);
  b.advanceDaysWithoutPlayerDecisions(a.getState().day - b.getState().day, true);
  assert.equal(a.getState().day, b.getState().day);
  // Şehirli dükkânın (İstanbul manavı) satışı iki yolda birebir aynı: şehir çarpanları iki yolda da aynı fonksiyondan gelir.
  // (İlk büfenin çevrimdışı satışı bu testin konusu değil; şehir katmanından bağımsız, eskiden beri farklı.)
  const ia = a.getState().tradeState!.shops.find((s) => s.cityId === 'istanbul')!;
  const ib = b.getState().tradeState!.shops.find((s) => s.cityId === 'istanbul')!;
  assert.ok(ia.cumulativeRevenue > 0);
  assert.equal(ia.cumulativeRevenue, ib.cumulativeRevenue);
  assert.equal(ia.todayRentAndOpex, ib.todayRentAndOpex);
  assert.equal(ia.todayPayrollCost, ib.todayPayrollCost);
});

test('Canlı kâr tahmini (liveShopToday) şehir kirasını ve maaşını kullanır', () => {
  const e = rich(55);
  e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  const ist = e.openShop({ shopType: 'MANAV', cityId: 'istanbul' }).shop!;
  const kon = e.openShop({ shopType: 'MANAV', cityId: 'konya' }).shop!;
  const day = e.getState().day;
  const li = liveShopToday(ist, day, 1440).profit;
  const lk = liveShopToday(kon, day, 1440).profit;
  assert.ok(li < lk, 'satış yokken İstanbul (pahalı gider) Konya’dan daha çok zarar gösterir');
});

// ---------------------------------------------------------------------------
// Faz 9: lojistik ve mesafe
// ---------------------------------------------------------------------------

test('Mesafe: aynı şehir 1,00 · aynı bölge 1,10 · komşu bölge 1,25 · uzak bölge 1,50', () => {
  assert.equal(distanceFactor('ankara', 'ankara'), 1);
  assert.equal(distanceFactor('ankara', 'konya'), 1.1);
  assert.equal(distanceFactor('ankara', 'istanbul'), 1.25);
  assert.equal(distanceFactor('istanbul', 'diyarbakir'), 1.5);
  assert.equal(distanceKind('istanbul', 'diyarbakir'), 'FAR_REGION');
  assert.equal(distanceKind(undefined, 'konya'), 'SAME_CITY');
});

test('Liman %15, şehir deposu %20 toplanır; iki depo ya da tekrar hesap indirimi büyütmez; kapasite dolunca depo indirimi yok', () => {
  const e = rich(66);
  const st = e.getState();
  const port = computeLogisticsRoute(st, 'izmir', {});
  assert.ok(port.port && !port.depot);
  assert.ok(Math.abs(port.discount - 0.15) < 1e-9);
  const depot = (id: string, used: number): Warehouse => ({
    warehouseId: id, nameTR: id, type: 'DISTRIBUTION', level: 1, maxCapacityUnits: 4000, usedCapacityUnits: used,
    dailyOperatingCost: 0, dailyStorageCostPerUnit: 1, spoilageProtectionFactor: 1, batches: [], cityId: 'izmir',
  });
  st.tradeState!.warehouses.push(depot('A', 0), depot('B', 0));
  const both = computeLogisticsRoute(st, 'izmir', {});
  assert.ok(both.depot);
  assert.ok(Math.abs(both.discount - 0.35) < 1e-9, 'iki depo olsa da depo indirimi bir kez');
  assert.ok(Math.abs(computeLogisticsRoute(st, 'izmir', {}).multiplier - both.multiplier) < 1e-12, 'aynı rota her hesapta aynı');
  st.tradeState!.warehouses.forEach((w) => { if (w.cityId === 'izmir') w.usedCapacityUnits = 3990; });
  assert.equal(computeLogisticsRoute(st, 'izmir', { quantity: 100 }).depot, false, 'kapasite aşılacaksa indirim yok');
  assert.equal(computeLogisticsRoute(st, 'izmir', { quantity: 5 }).depot, true);
  // şehri olmayan (eski) merkez depoları indirim vermez
  const plain = rich(67).getState();
  assert.equal(computeLogisticsRoute(plain, 'ankara', {}).depot, false);
});

test('Sipariş nakliyesi şehir ve mesafe çarpanıyla hesaplanır; defterde ayrı Lojistik satırı olur; teklifle aynı tutar', () => {
  const e = rich(77);
  e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  const near = e.openShop({ shopType: 'MANAV', cityId: 'ankara' }).shop!;
  const far = e.openShop({ shopType: 'KAFE', cityId: 'diyarbakir' }).shop!;
  const resId = e.getSupplierOffers()[0].resourceId;
  const offerNear = e.getSupplierOffers(resId, near)[0];
  const offerFar = e.getSupplierOffers(resId, far)[0];
  assert.ok(offerFar.shippingCostPerUnit > offerNear.shippingCostPerUnit, 'teklifte de uzak şehir daha pahalı');
  const qty = Math.max(offerNear.minOrderQuantity, 20);
  const place = (shopId: string) =>
    e.placeProcurementOrder({ supplierId: offerNear.supplierId, resourceId: resId, quantity: qty, destinationType: 'SHOP', destinationId: shopId, paymentTermType: 'CASH' });
  const o1 = place(near.shopId).order!;
  const o2 = place(far.shopId).order!;
  assert.ok(Math.abs(o1.shippingCost - qty * offerNear.shippingCostPerUnit) < 0.05 * qty, 'sipariş tutarı gösterilen teklifle aynı');
  assert.ok(Math.abs(o2.shippingCost - qty * offerFar.shippingCostPerUnit) < 0.05 * qty);
  assert.ok((o2.logisticsSurcharge ?? 0) > (o1.logisticsSurcharge ?? 0));
  const tx = (e.getState().centralLedger?.transactions ?? []).filter((t) => (t.idempotencyKey ?? '') === `LOGISTICS-${o2.orderId}`);
  assert.equal(tx.length, 1);
  assert.ok(Math.abs(tx[0].amount - o2.shippingCost) < 0.01);
});

test('Uzak şehre mal daha pahalı: aynı sipariş uzak şehirde daha çok nakliye öder (ama yasak değil)', () => {
  const e = rich(88);
  e.chooseStartCity;
  const st = e.getState();
  const hub = computeLogisticsRoute(st, 'ankara', {}).multiplier;
  const farthest = computeLogisticsRoute({ ...st, headquartersCityId: 'istanbul' as CityId }, 'diyarbakir', {}).multiplier;
  assert.ok(farthest > hub);
});

// ---------------------------------------------------------------------------
// Faz 7: açılış teklifi
// ---------------------------------------------------------------------------

test("Teklif: Ankara'dan Konya ile İstanbul'a açılış farklı maliyet; bileşenler toplamı tutar", () => {
  const e = rich(100);
  e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  const k = e.getCityExpansionQuote('konya', 'MANAV');
  const i = e.getCityExpansionQuote('istanbul', 'MANAV');
  assert.notEqual(k.totalUpfrontCost, i.totalUpfrontCost);
  assert.ok(k.distanceKind === 'SAME_REGION' && i.distanceKind === 'NEIGHBOR_REGION');
  for (const q of [k, i]) {
    const sum = q.baseSetupCost + q.cityRentDeposit + q.regionalPermitCost + q.initialLogisticsCost - q.prestigeDiscount - q.milestoneDiscount + q.workingCash;
    assert.ok(Math.abs(sum - q.totalUpfrontCost) < 0.02);
    assert.ok(q.recommendedReserve > 0 && q.estimatedDeliveryDays >= 1);
  }
  assert.ok(i.cityRentDeposit > k.cityRentDeposit, 'İstanbul kirası pahalı: depozito de yüksek');
  assert.equal(e.getCityExpansionQuote('ankara', 'MANAV').regionalPermitCost, 0, 'merkez şehirde ruhsat yok');
});

test('Teklif = gerçek tahsilat: cepten düşen para ve defter toplamı tekliften sapmaz (12 şehir)', () => {
  for (const c of getDetailedCityDefinitions()) {
    const e = rich(200);
    e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
    const st = e.getState();
    const q = e.getCityExpansionQuote(c.id, 'KAFE');
    const cash0 = st.cash;
    const seq = st.tradeState!.shopSeq + 1;
    const day = st.day;
    const r = e.openShop({ shopType: 'KAFE', cityId: c.id });
    assert.ok(r.success, r.message);
    assert.ok(Math.abs(cash0 - e.getState().cash - q.totalUpfrontCost) < 0.01, `${c.id} nakit`);
    assert.ok(Math.abs(ledgerOpenSum(e, day, seq) - q.totalUpfrontCost) < 0.01, `${c.id} defter`);
    assert.equal(r.quote?.totalUpfrontCost, q.totalUpfrontCost);
  }
});

test('Aynı açılış isteği iki kez gelirse çift dükkân ve çift tahsilat olmaz', () => {
  const e = rich(300);
  e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  const a = e.openShop({ shopType: 'MANAV', cityId: 'konya', requestId: 'x1' });
  const cash1 = e.getState().cash;
  const b = e.openShop({ shopType: 'MANAV', cityId: 'konya', requestId: 'x1' });
  assert.ok(a.success && b.success && b.duplicate);
  assert.equal(e.getState().tradeState!.shops.length, 2);
  assert.equal(e.getState().cash, cash1);
  assert.equal(b.shop?.shopId, a.shop?.shopId);
  // farklı kimlik gerçekten yeni dükkân açar
  assert.ok(e.openShop({ shopType: 'KAFE', cityId: 'konya', requestId: 'x2' }).success);
  assert.equal(e.getState().tradeState!.shops.length, 3);
});

test('İndirim: ilk dükkânda prestij %20; sonraki uygun dükkânda kilometre taşı %10; ikisi birleşmez; kullanılmayan hak korunur', () => {
  const e = new SimulationEngine(401, 20_000_000);
  e.chooseStartCity('ankara');
  const st = e.getState();
  st.prestige = { stars: 2, cities: 1, bestNetWorth: 0 };
  // 20 Mn net değer: 4 kilometre taşı kazanılmış
  assert.ok(milestoneDiscountsAvailable(st) >= 3);
  const q1 = e.getCityExpansionQuote('ankara', 'BUFE');
  assert.equal(q1.discountKind, 'PRESTIGE');
  assert.ok(Math.abs(q1.prestigeDiscount - q1.costBeforeDiscount * 0.2) < 0.02);
  assert.equal(q1.milestoneDiscount, 0, 'iki indirim aynı dükkânda birleşmez');
  const before = milestoneDiscountsAvailable(st);
  assert.ok(e.openShop({ shopType: 'BUFE', cityId: 'ankara' }).success);
  assert.equal(milestoneDiscountsAvailable(e.getState()), before, 'prestij kullanılınca kilometre taşı hakkı harcanmaz');
  const q2 = e.getCityExpansionQuote('konya', 'MANAV');
  assert.equal(q2.discountKind, 'MILESTONE');
  assert.ok(Math.abs(q2.milestoneDiscount - q2.costBeforeDiscount * 0.1) < 0.02);
  assert.equal(q2.prestigeDiscount, 0);
  const cash0 = e.getState().cash;
  assert.ok(e.openShop({ shopType: 'MANAV', cityId: 'konya' }).success);
  assert.ok(Math.abs(cash0 - e.getState().cash - q2.totalUpfrontCost) < 0.01, 'indirimli tutar birebir tahsil edilir');
  assert.equal(milestoneDiscountsAvailable(e.getState()), before - 1, 'kilometre taşı hakkı tam bir kez harcanır');
});

test('Kilometre taşı hakkı net değer sonradan düşse bile kaybolmaz', () => {
  const e = new SimulationEngine(402, 20_000_000);
  const st = e.getState();
  syncMilestoneDiscounts(st);
  const earned = st.cityExpansion!.milestonesEarned;
  assert.ok(earned >= 1);
  st.netWorth = 1_000; // sonradan batma
  assert.equal(milestoneDiscountsAvailable(st), earned);
  // eski kayıt (alan yok): şimdiki net değerden hesaplanır, hata vermez
  const old = new SimulationEngine(403, 100_000).getState();
  assert.equal(old.cityExpansion, undefined);
  assert.equal(milestoneDiscountsAvailable(old), 0);
});

test('Rezerv uyarısı: yetersiz nakitte engel, dar nakitte sarı/kırmızı/kritik ve ikinci onay (engel yok)', () => {
  const e = rich(500);
  e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  const base = e.getCityExpansionQuote('konya', 'MANAV', 4_000);
  const ample = e.getCityExpansionQuote('konya', 'MANAV');
  assert.equal(ample.warningLevel, 'NONE');
  assert.equal(ample.needsSecondConfirmation, false);
  WalletEngine.setBalance(e.getState(), base.totalUpfrontCost + 2_000);
  const tight = e.getCityExpansionQuote('konya', 'MANAV', 4_000);
  assert.ok(tight.affordable && tight.needsSecondConfirmation && tight.warningLevel !== 'NONE');
  assert.ok(tight.warningsTR.length > 0);
  assert.ok(e.openShop({ shopType: 'MANAV', cityId: 'konya', initialCashFloat: 4_000 }).success, 'motor engellemez');
  // gerçekten yetersiz nakit
  const poor = rich(501);
  poor.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  WalletEngine.setBalance(poor.getState(), 1_000);
  const pq = poor.getCityExpansionQuote('istanbul', 'MARKET');
  assert.equal(pq.affordable, false);
  const res = poor.openShop({ shopType: 'MARKET', cityId: 'istanbul' });
  assert.equal(res.success, false);
  assert.equal(poor.getState().tradeState!.shops.length, 1);
});

test('Uzak şehir yasak değil: İstanbul merkezden Diyarbakır açılır, daha pahalı ve uyarılıdır', () => {
  const e = new SimulationEngine(600, 20_000_000);
  e.chooseStartCity('istanbul');
  e.openShop({ shopType: 'BUFE', cityId: 'istanbul' });
  const q = e.getCityExpansionQuote('diyarbakir', 'MANAV');
  const near = e.getCityExpansionQuote('bursa', 'MANAV');
  assert.equal(q.distanceKind, 'FAR_REGION');
  assert.equal(q.distanceFactor, 1.5);
  assert.ok(q.regionalPermitCost > near.regionalPermitCost);
  assert.ok(q.warningsTR.some((w) => w.includes('Uzak bölge')));
  assert.ok(e.openShop({ shopType: 'MANAV', cityId: 'diyarbakir' }).success);
});

test('İlk dükkânda kira depozitosu yok; sonraki dükkânlarda şehir kirasına göre alınır', () => {
  const e = rich(650);
  assert.equal(e.getCityExpansionQuote('istanbul', 'BUFE').cityRentDeposit, 0);
  e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  assert.ok(e.getCityExpansionQuote('istanbul', 'BUFE').cityRentDeposit > e.getCityExpansionQuote('konya', 'BUFE').cityRentDeposit);
});

test('Başlangıç şehri seçiminde (merkez yokken) mesafe ücreti yok: kendi şehrin merkez sayılır', () => {
  const e = new SimulationEngine(700, 100_000);
  const q = e.getCityExpansionQuote('konya', 'BUFE');
  assert.equal(q.distanceKind, 'SAME_CITY');
  assert.equal(q.regionalPermitCost, 0);
});

// ---------------------------------------------------------------------------
// Arayüz
// ---------------------------------------------------------------------------

test('Harita paneli: merkezi teklifin bileşenlerini, rezervi ve lojistik açıklamasını gösterir', () => {
  const e = rich(800);
  e.openShop({ shopType: 'BUFE', cityId: 'ankara' });
  const city = CITY_DEFINITIONS.izmir;
  const html = renderToStaticMarkup(
    React.createElement(CityInfoSheet, {
      city,
      state: e.getState(),
      formatCurrency: (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`,
      reservedCash: 0,
      onClose: () => {},
      onGoToCity: () => {},
      onOpenShop: () => {},
    })
  );
  const q = e.getCityExpansionQuote('izmir', 'BUFE');
  assert.ok(html.includes('city-info-quote-deposit'));
  assert.ok(html.includes('city-info-quote-permit'), 'komşu bölgede ruhsat satırı');
  assert.ok(html.includes('city-info-quote-reserve'));
  assert.ok(html.includes(`₺${Math.round(q.totalUpfrontCost).toLocaleString('tr-TR')}`));
  assert.ok(html.includes('city-info-logistics-notes') && html.includes('limanı var'), 'liman avantajı yazıyla açıklanır');
});

test('Kayıt: kilometre taşı hakkı, depo şehri ve sipariş lojistik farkı kaydet-yükle sonrası korunur; eski kayıt bozulmaz', () => {
  const e = new SimulationEngine(900, 20_000_000);
  e.chooseStartCity('ankara');
  syncMilestoneDiscounts(e.getState());
  e.getState().cityExpansion!.milestonesUsed = 1;
  e.getState().tradeState!.warehouses.push({
    warehouseId: 'WH_CITY_IZMIR', nameTR: 'İzmir Deposu', type: 'DISTRIBUTION', level: 1, maxCapacityUnits: 4000, usedCapacityUnits: 0,
    dailyOperatingCost: 0, dailyStorageCostPerUnit: 1, spoilageProtectionFactor: 1, batches: [], cityId: 'izmir',
  });
  const again = new SimulationEngine(1, 100_000);
  again.restoreFromSavedState(JSON.parse(JSON.stringify(e.getState())));
  assert.deepEqual(again.getState().cityExpansion, e.getState().cityExpansion);
  assert.ok(again.getState().tradeState!.warehouses.some((w) => w.cityId === 'izmir'));
  assert.equal(computeLogisticsRoute(again.getState(), 'izmir', {}).depot, true);
  // alanları olmayan eski kayıt
  const old = JSON.parse(JSON.stringify(new SimulationEngine(901, 100_000).getState()));
  delete old.cityExpansion;
  const legacy = new SimulationEngine(2, 100_000);
  legacy.restoreFromSavedState(old);
  assert.ok(legacy.getCityExpansionQuote('konya', 'BUFE').totalUpfrontCost > 0);
});
