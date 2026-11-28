/**
 * Dükkân Yıldızı (1.0 ★ – 5.0 ★) ve Müşteri Yorumları: 4 sütun, kademe bonusları, yorum üretimi, eski kayıt uyumu,
 * ayrıca görünüm temasının kalıcı kaydı.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import {
  computeShopRating,
  generateDailyShopReviews,
  getShopStarTier,
  scoreToStars,
  shopStars,
  starBasketMultiplier,
  starCustomerMultiplier,
} from '../../engine/ShopRatingEngine';
import { computeShopDailyDemand } from '../../engine/ShopSales';
import { SHOP_TEMPLATES, RESOURCE_CATALOG } from '../../data/tradeCatalog';
import { SHOP_UPGRADES } from '../../data/shopUpgrades';
import { UISettingsStore } from '../../state/uiSettingsStore';
import { restockShops } from '../balance/restockBot';
import type { ShopInstance } from '../../models/trade';

function engineWithShop(type: 'BUFE' | 'MARKET' | 'OTOMOBIL_GALERISI' = 'BUFE', days = 6) {
  const eng = new SimulationEngine(20261128, 6_000_000);
  assert.equal(eng.chooseStartCity('ankara').success, true);
  const r = eng.openShop({ shopType: type, cityId: 'ankara' });
  assert.equal(r.success, true, r.message);
  if (r.shop?.ownerWorks) eng.hireFirstEmployee(r.shop.shopId);
  for (let d = 0; d < days; d++) {
    restockShops(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
  }
  restockShops(eng);
  return eng;
}
const shopOf = (eng: SimulationEngine): ShopInstance => eng.getState().tradeState!.shops[0];
const fair = (shop: ShopInstance, resId: string) =>
  RESOURCE_CATALOG[resId].baseMarketPrice * (1 + SHOP_TEMPLATES[shop.shopType].defaultGrossMarginPct / 100);

test('Yıldız: puan 1.0–5.0 aralığına çevrilir, kademeler doğru', () => {
  assert.equal(scoreToStars(0), 1);
  assert.equal(scoreToStars(100), 5);
  assert.equal(scoreToStars(50), 3);
  assert.equal(getShopStarTier(2.4).id, 'BAD');
  assert.equal(getShopStarTier(2.5).id, 'STANDARD');
  assert.equal(getShopStarTier(3.5).id, 'LOVED');
  assert.equal(getShopStarTier(4.3).id, 'FAVORITE');
  assert.equal(getShopStarTier(4.8).id, 'LEGEND');
  // Yumuşak geçiş: yıldız arttıkça çarpan azalmaz
  let prev = 0;
  for (let s = 1; s <= 5.0001; s += 0.1) {
    const m = starCustomerMultiplier(s);
    assert.ok(m >= prev - 1e-9);
    prev = m;
  }
  assert.ok(starBasketMultiplier(4.9) > starBasketMultiplier(4.0));
});

test('4 sütun: eksik çeşit ve aşırı fiyat puanı düşürür; tam çeşit + adil fiyat + yükseltmeler 4.5+ yapar', () => {
  const eng = engineWithShop('BUFE');
  const shop = shopOf(eng);
  const base = computeShopRating(shop);
  assert.ok(base.pillars.VARIETY >= 90, `çeşit ${base.pillars.VARIETY}`);

  // Bir ürünü raftan kaldır → çeşit düşer
  const allowed = SHOP_TEMPLATES.BUFE.allowedResourceIds;
  const saved = shop.inventoryBatches.map((b) => ({ ...b }));
  for (const b of shop.inventoryBatches) if (b.resourceId === allowed[0]) b.availableQuantity = 0;
  assert.ok(computeShopRating(shop).pillars.VARIETY < base.pillars.VARIETY);
  shop.inventoryBatches = saved;

  // Aşırı fiyat → fiyat adaleti düşer
  const prices = { ...shop.sellingPrices };
  for (const id of allowed) shop.sellingPrices[id] = fair(shop, id) * 1.8;
  assert.ok(computeShopRating(shop).pillars.PRICE < 35);
  shop.sellingPrices = prices;

  // Tam donanım: bütün yükseltmeler, eğitim, sigorta, adil fiyat
  shop.upgrades = SHOP_UPGRADES.map((u) => u.id);
  shop.trainedStaff = shop.staffCount;
  shop.staffInsurance = true;
  shop.todayUnmetCustomerDemand = 0;
  const full = computeShopRating(shop);
  assert.ok(full.stars >= 4.5, `yıldız ${full.stars}`);
});

test('Tek ürünlü galeri çeşitlilikten ceza yemez', () => {
  const eng = engineWithShop('OTOMOBIL_GALERISI', 3);
  const shop = shopOf(eng);
  assert.equal(SHOP_TEMPLATES.OTOMOBIL_GALERISI.allowedResourceIds.length, 1);
  const r = computeShopRating(shop);
  if (shop.inventoryBatches.some((b) => b.availableQuantity > 0)) assert.ok(r.pillars.VARIETY >= 75, `çeşit ${r.pillars.VARIETY}`);
});

test('Kademe bonusları satış hesabına yansır: yüksek yıldız daha çok müşteri ve sepet', () => {
  const eng = engineWithShop('MARKET');
  const st = eng.getState();
  const shop = shopOf(eng);
  shop.customerSatisfaction = 30; // 2.2 ★ Kötü Şöhret
  const low = computeShopDailyDemand(st, st.tradeState!, shop);
  shop.customerSatisfaction = 97; // 4.9 ★ Efsane
  const high = computeShopDailyDemand(st, st.tradeState!, shop);
  assert.ok(high.customers > low.customers * 1.5, `${high.customers} vs ${low.customers}`);
  const unitsPerCust = (d: typeof low) => d.items.reduce((a, b) => a + b.units, 0) / Math.max(1, d.customers);
  assert.ok(unitsPerCust(high) > unitsPerCust(low) * 1.03, 'sepet bonusu');
  assert.equal(getShopStarTier(shopStars(shop)).id, 'LEGEND');
});

test('Müşteri yorumu gerçek soruna göre üretilir (eksik ürün adıyla, pahalı fiyat)', () => {
  const eng = engineWithShop('BUFE');
  const shop = shopOf(eng);
  const allowed = SHOP_TEMPLATES.BUFE.allowedResourceIds;
  for (const b of shop.inventoryBatches) if (b.resourceId === allowed[0]) b.availableQuantity = 0;
  shop.todayUnitsSold = 20;
  shop.todayUnmetCustomerDemand = 30;
  const r1 = generateDailyShopReviews(shop, 50, { VARIETY: 40, PRICE: 90, STOCK: 45, SERVICE: 80 });
  assert.ok(r1.length >= 1);
  assert.equal(r1[0].actionHint, 'RESTOCK');
  assert.ok(r1[0].textTR.includes(RESOURCE_CATALOG[allowed[0]].nameTR), r1[0].textTR);
  assert.ok(r1[0].stars <= 2);

  const r2 = generateDailyShopReviews(shop, 51, { VARIETY: 95, PRICE: 20, STOCK: 95, SERVICE: 90 });
  assert.equal(r2[0].actionHint, 'PRICE');
  assert.match(r2[0].textTR, /pahalı/);

  // Aynı gün aynı yorum (motor sayı üretecine dokunmaz, tekrarlanabilir)
  assert.deepEqual(
    generateDailyShopReviews(shop, 51, { VARIETY: 95, PRICE: 20, STOCK: 95, SERVICE: 90 }),
    r2
  );

  // Satış ve dönen müşteri yoksa yorum yok
  shop.todayUnitsSold = 0;
  shop.todayUnmetCustomerDemand = 0;
  assert.equal(generateDailyShopReviews(shop, 52, { VARIETY: 95, PRICE: 95, STOCK: 95, SERVICE: 95 }).length, 0);
});

test('Gün kapanışı yorum ekler (en çok 10); eski kayıt recentReviews olmadan sorunsuz yüklenir', () => {
  const eng = engineWithShop('BUFE', 14);
  const reviews = shopOf(eng).recentReviews ?? [];
  assert.ok(reviews.length > 0 && reviews.length <= 10, `${reviews.length} yorum`);

  const raw = JSON.parse(eng.serializeState()) as { state?: { tradeState?: { shops?: Array<Record<string, unknown>> } } } & Record<string, unknown>;
  const shops = raw.state?.tradeState?.shops ?? (raw as { tradeState?: { shops?: Array<Record<string, unknown>> } }).tradeState?.shops;
  assert.ok(shops && shops.length > 0, 'kayıtta dükkân var');
  for (const s of shops) delete s.recentReviews;
  const back = SimulationEngine.deserializeState(JSON.stringify(raw));
  assert.equal(shopOf(back).recentReviews, undefined);
  restockShops(back);
  back.advanceDaysWithoutPlayerDecisions(2, true);
  assert.ok((shopOf(back).recentReviews ?? []).length > 0);
  const stars = shopStars(shopOf(back));
  assert.ok(stars >= 1 && stars <= 5);
});

test('Görünüm teması (warm / night) kalıcı kaydedilir; eski ayarda yoksa Sıcak Tycoon', () => {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
  assert.equal(UISettingsStore.loadSettings(storage).theme, 'warm');
  UISettingsStore.saveSettings({ ...UISettingsStore.loadSettings(storage), theme: 'night' }, storage);
  assert.equal(UISettingsStore.loadSettings(storage).theme, 'night');
  storage.setItem(UISettingsStore.STORAGE_KEY, JSON.stringify({ audio: {}, theme: 'neon' }));
  assert.equal(UISettingsStore.loadSettings(storage).theme, 'warm');
});
