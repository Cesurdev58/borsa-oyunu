/**
 * Faz 3.4: canlı oynanan gün ile hızlı ilerletilen gün (çevrimdışı ilerleme, "gün atla") aynı sonucu verir.
 *
 * Kök neden (düzeltildi): hızlı ilerletmede günün satışı gün kapanışının ortasında, ertesi günün koşullarıyla
 * (makro, ticari olaylar, mevsim), ertesi gün gelecek mal rafa konduktan ve gün sonu firesi düşüldükten
 * SONRA ve tek parça halinde yapılıyordu. Canlı oyunda ise gün boyunca 5 dakikalık dilimlerle satılıyor,
 * mal gün kapanınca geliyordu. Manav ve markette bu, günde %2–10 fark yapıyordu.
 * Şimdi gün kapanmadan önce kalan satış canlı oyunla aynı dilimlerle tamamlanır (`ShopSales.completeShopsDay`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { restockShops } from '../balance/restockBot';
import type { ShopType } from '../../models/trade';

function clone(e: SimulationEngine): SimulationEngine {
  return SimulationEngine.deserializeState(e.serializeState());
}

function snapshot(e: SimulationEngine) {
  const st = e.getState();
  return st.tradeState!.shops.map((s) => ({
    revenue: s.todaySalesRevenue,
    units: s.todayUnitsSold,
    unmet: s.todayUnmetCustomerDemand,
    spoilage: s.todaySpoilageUnits,
    profit: s.todayNetProfit,
    till: s.cashAccountBalance,
    // Not: gün sonu stoğu karşılaştırılmaz; teslim edilen malın hasarı sayı üretecine bağlıdır ve canlı
    // oyunda borsanın gün içi fiyat adımları üreteci farklı ilerletir (dükkân satışıyla ilgisi yok).
  }));
}

function compareDays(types: ShopType[], seed: number, days: number) {
  let base = new SimulationEngine(seed, 4_000_000);
  for (const t of types) assert.equal(base.openShop({ shopType: t }).success, true, t);
  let checkedStockOut = false;
  for (let d = 0; d < days; d++) {
    // Rafları yalnızca 3 günde bir doldur: gün içinde ürün bitme durumları da denensin
    if (d % 3 === 0) restockShops(base);
    const live = clone(base);
    const fast = clone(base);
    live.advanceGameMinutes(1440 - live.getState().minutesIntoCurrentDay);
    fast.advanceDaysWithoutPlayerDecisions(1, true);
    assert.equal(live.getState().day, fast.getState().day);
    const a = snapshot(live);
    const b = snapshot(fast);
    assert.deepEqual(a, b, `gün ${base.getState().day}: canlı ve hızlı gün farklı`);
    if (a.some((x) => x.unmet > 0 && x.units > 0)) checkedStockOut = true;
    base = fast;
  }
  return { checkedStockOut };
}

test('Manav ve market: canlı gün ile hızlı ilerletilen gün kuruşu kuruşuna aynı (10 gün, stok bitmeleri dahil)', () => {
  const r = compareDays(['MANAV', 'MARKET'], 20261125, 10);
  assert.equal(r.checkedStockOut, true, 'gün içinde ürün bitme durumu denendi');
});

test('Büfe, kafe ve galeri: canlı gün ile hızlı ilerletilen gün aynı', () => {
  compareDays(['BUFE', 'KAFE', 'OTOMOBIL_GALERISI'], 20261126, 6);
});

test('Gün ortasından hızlı ilerletme: kalan saatler canlı oyunla aynı dilimlerle satılır', () => {
  const base = new SimulationEngine(20261127, 4_000_000);
  assert.equal(base.openShop({ shopType: 'MANAV' }).success, true);
  restockShops(base);
  base.advanceDaysWithoutPlayerDecisions(2, true);
  restockShops(base);
  base.advanceGameMinutes(13 * 60 + 2); // 13:02 — 5 dakikalık sınırın arasında
  const live = clone(base);
  const fast = clone(base);
  live.advanceGameMinutes(1440 - live.getState().minutesIntoCurrentDay);
  fast.advanceDaysWithoutPlayerDecisions(1, true);
  assert.deepEqual(snapshot(live), snapshot(fast));
});
