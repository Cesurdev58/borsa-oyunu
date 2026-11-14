import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_EVENT_TEMPLATES, WORLD_EVENT_DECAY, makeCountryName } from '../../data/worldEvents';
import { applyWorldEvent, createWorldEvent, stepWorldEvents } from '../../engine/WorldEventEngine';
import { worldEventShopDemandMultiplier } from '../../engine/WorldEventEffects';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import { restockShops } from '../balance/restockBot';

test('Olay şablonları aynalı: her sektörde toplam borsa etkisi sıfır, dükkân çarpanlarının ortalaması 1', () => {
  const sectorSum: Record<string, number> = {};
  const shopProd: Record<string, number> = {};
  let priceProd = 0;
  for (const t of WORLD_EVENT_TEMPLATES) {
    for (const [k, v] of Object.entries(t.sectorImpacts)) sectorSum[k] = (sectorSum[k] ?? 0) + (v as number) / WORLD_EVENT_DECAY;
    for (const [k, v] of Object.entries(t.shopDemand)) shopProd[k] = (shopProd[k] ?? 0) + ((v as number) - 1);
    priceProd += t.supplierPriceMult - 1;
    assert.ok(WORLD_EVENT_TEMPLATES.some((m) => m.kind === t.mirror && m.mirror === t.kind), `${t.kind} aynası var`);
  }
  for (const [k, v] of Object.entries(sectorSum)) assert.ok(Math.abs(v) < 1e-6, `${k} toplamı ${v}`);
  for (const [k, v] of Object.entries(shopProd)) assert.ok(Math.abs(v) < 1e-6, `${k} sapma toplamı ${v}`);
  assert.ok(Math.abs(priceProd) < 1e-6);
});

test('Ülke adları uydurma ve tutarlı; savaş haberinde iki farklı ülke geçer', () => {
  const names = new Set<string>();
  for (let i = 0; i < 200; i++) names.add(makeCountryName((i * 0.37) % 1, (i * 0.61) % 1, (i * 0.13) % 1));
  assert.ok(names.size > 50, 'çeşitli adlar');
  const warIdx = WORLD_EVENT_TEMPLATES.findIndex((t) => t.kind === 'WAR');
  const ev = createWorldEvent(123, 40, warIdx);
  assert.ok(ev.countryA && ev.countryB && ev.countryA !== ev.countryB);
  assert.ok(ev.title.includes(ev.countryA!) && ev.title.includes(ev.countryB!));
  assert.ok(!ev.title.includes('{'));
  assert.deepEqual(createWorldEvent(123, 40, warIdx), ev, 'aynı tohum ve gün aynı olayı verir');
});

test('Olay borsa haberlerine, toptancı fiyatına ve dükkân müşterisine yansır', () => {
  const eng = new SimulationEngine(777, 2_000_000);
  assert.equal(eng.openShop({ shopType: 'OTOMOBIL_GALERISI' }).success, true);
  const st = eng.getState();
  const warIdx = WORLD_EVENT_TEMPLATES.findIndex((t) => t.kind === 'WAR');
  const ev = createWorldEvent(st.seed ?? 1, st.day, warIdx);
  applyWorldEvent(st, ev);
  const evNews = st.newsFeed.filter((n) => n.worldEventId === ev.id);
  assert.ok(evNews.length >= 4, 'sektör başına son dakika haberi');
  assert.ok(evNews.every((n) => n.headline.startsWith('SON DAKİKA')));
  assert.ok(st.tradeState!.activeTradeEvents.some((t) => t.eventType === 'WORLD_EVENT' && t.priceImpactMultiplier > 1));
  assert.equal(worldEventShopDemandMultiplier(st, 'OTOMOBIL_GALERISI'), 0.8);
  assert.equal(worldEventShopDemandMultiplier(st, 'MARKET'), 1.12);
  assert.equal(worldEventShopDemandMultiplier(st, 'BUFE'), 1);
});

test('Olaylar ~3–6 haftada bir çıkar, aynı anda tek olay olur, kayıtta korunur', () => {
  const eng = new SimulationEngine(4242, 100_000);
  restockShops(eng);
  let starts = 0;
  for (let d = 0; d < 300; d++) {
    eng.advanceDaysWithoutPlayerDecisions(1, true);
    const ws = eng.getState().worldEvents!;
    assert.ok(ws.active.length <= 1);
    if (ws.active[0]?.startDay === eng.getState().day) starts++;
  }
  assert.ok(starts >= 5 && starts <= 16, `300 günde ${starts} olay`);
  const env = SimulationStore.saveToStorage(eng);
  const migrated = SimulationStore.migrateIfNeeded(JSON.parse(JSON.stringify(env)));
  assert.deepEqual(migrated?.state.worldEvents, eng.getState().worldEvents);
  const restored = new SimulationEngine(1, 100_000);
  restored.restoreFromSavedState(JSON.parse(JSON.stringify(eng.getState())));
  assert.deepEqual(restored.getState().worldEvents, eng.getState().worldEvents);
});

test('Erken günlerde ve olay sürerken yeni olay çıkmaz', () => {
  const eng = new SimulationEngine(1, 100_000);
  const st = eng.getState();
  for (let d = 1; d < 12; d++) assert.equal(stepWorldEvents(st, d), null);
});
