/**
 * Oyun dengesi ölçüm aracı. Çalıştırmak için:  npm run balans
 *
 * 1) Her dükkân türü için: düzenli mal siparişi veren bir oyuncuyla günlük ciro, net kâr ve
 *    kurulum maliyetinin kaç günde geri döndüğü.
 * 2) Borsa: 5 farklı sayı üreteciyle 1 yıllık endeks ve hisse getirileri.
 * Hedef geri dönüş süreleri aşağıdaki HEDEF_GERI_DONUS tablosundadır; dengeyi değiştirince bu aracı tekrar çalıştır.
 */
import { SimulationEngine } from '../src/engine/SimulationEngine';
import { SHOP_TEMPLATES } from '../src/engine/TradeAndShopEngine';
import { restockShops } from '../src/tests/balance/restockBot';

const HEDEF_GERI_DONUS: Record<string, number> = {
  BUFE: 45,
  MANAV: 60,
  KAFE: 80,
  GIYIM_MAGAZASI: 100,
  ELEKTRONIK_MAGAZASI: 130,
  MOBILYA_MAGAZASI: 130,
  MARKET: 120,
  OTOMOBIL_GALERISI: 180,
};
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

console.log('=== DÜKKÂNLAR (90 gün, düzenli sipariş) ===');
for (const type of Object.keys(SHOP_TEMPLATES)) {
  const tpl = SHOP_TEMPLATES[type as keyof typeof SHOP_TEMPLATES];
  const eng = new SimulationEngine(20261104, 8_000_000);
  const r = eng.openShop({ shopType: type as never });
  if (!r.success) {
    console.log(type.padEnd(20), 'AÇILAMADI:', r.message);
    continue;
  }
  const profits: number[] = [];
  const revenues: number[] = [];
  for (let d = 1; d <= 90; d++) {
    restockShops(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
    const shop = eng.getState().tradeState!.shops[0];
    if (d > 20) {
      profits.push(shop.todayNetProfit);
      revenues.push(shop.todaySalesRevenue);
    }
  }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const setup = (tpl.openingCost + tpl.decorationCost) * 1.25;
  const payback = avg(profits) > 0 ? Math.round(setup / avg(profits)) : 'zarar';
  console.log(
    type.padEnd(20),
    'ciro/gün', fmt(avg(revenues)).padStart(8),
    'kâr/gün', fmt(avg(profits)).padStart(8),
    'geri dönüş', String(payback).padStart(5), 'gün',
    '(hedef', HEDEF_GERI_DONUS[type] + ')'
  );
}

console.log('\n=== MÜDÜR (2. seviye dükkân, 90 gün): elle yönetim vs müdür ===');
for (const type of Object.keys(SHOP_TEMPLATES)) {
  const run = (withManager: boolean) => {
    const eng = new SimulationEngine(20261104, 8_000_000);
    const r = eng.openShop({ shopType: type as never });
    if (!r.success) return null;
    const shopId = eng.getState().tradeState!.shops[0].shopId;
    eng.upgradeShopLevel(shopId);
    if (withManager) {
      const h = eng.hireShopManager(shopId);
      if (!h.success) return null;
      eng.setShopManagerSweep(shopId, false); // ölçümde kâr kasada kalsın
    }
    const profits: number[] = [];
    for (let d = 1; d <= 90; d++) {
      if (!withManager) restockShops(eng);
      eng.advanceDaysWithoutPlayerDecisions(1, true);
      const shop = eng.getState().tradeState!.shops[0];
      if (d > 20) profits.push(shop.todayNetProfit);
    }
    return profits.reduce((a, b) => a + b, 0) / profits.length;
  };
  const manual = run(false);
  const managed = run(true);
  if (manual === null || managed === null) {
    console.log(type.padEnd(20), 'ölçülemedi');
    continue;
  }
  const ratio = manual > 0 ? Math.round((managed / manual) * 100) : 0;
  console.log(
    type.padEnd(20),
    'elle kâr/gün', fmt(manual).padStart(8),
    'müdürlü kâr/gün', fmt(managed).padStart(8),
    `oran %${ratio}`,
    '(hedef %70–85)'
  );
}

console.log('\n=== BORSA (365 gün, oyuncu işlem yapmadan) ===');
for (const seed of [20261104, 1, 2, 3, 4]) {
  const eng = new SimulationEngine(seed, 100_000);
  const start: Record<string, number> = {};
  eng.getState().stocks.filter((s) => !s.isPlayerCompany).forEach((s) => (start[s.ticker] = s.price));
  const idx0 = eng.getState().marketIndex;
  eng.advanceDaysWithoutPlayerDecisions(365, true);
  const end = eng.getState();
  const ch = end.stocks.filter((s) => !s.isPlayerCompany).map((s) => ({ t: s.ticker, c: (s.price / start[s.ticker] - 1) * 100 }));
  ch.sort((a, b) => b.c - a.c);
  const avg = ch.reduce((a, b) => a + b.c, 0) / ch.length;
  console.log(
    `seed ${seed}: endeks %${((end.marketIndex / idx0 - 1) * 100).toFixed(0)} | hisse ort. %${avg.toFixed(0)} | en iyi ${ch[0].t} %${ch[0].c.toFixed(0)} | en kötü ${ch[ch.length - 1].t} %${ch[ch.length - 1].c.toFixed(0)}`
  );
}
