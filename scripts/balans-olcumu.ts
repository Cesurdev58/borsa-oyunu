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
import { answerDecisionSensibly } from '../src/tests/balance/decisionBot';
import { expandByTakeover, growCompanyGreedy } from '../src/tests/balance/companyBot';
import { SHOP_UPGRADES } from '../src/data/shopUpgrades';

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
/** Dükkânı açar; ilk dükkân BUFE'de oyuncu kendisi çalıştığı için (kapasite %65) ölçüm normal personelle olsun diye ilk çalışanı da alır. */
const openStaffed = (eng: SimulationEngine, type: string) => {
  const r = eng.openShop({ shopType: type as never });
  if (r.success && r.shop?.ownerWorks) eng.hireFirstEmployee(r.shop.shopId);
  return r;
};
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

console.log('=== DÜKKÂNLAR (90 gün, düzenli sipariş) ===');
for (const type of Object.keys(SHOP_TEMPLATES)) {
  const tpl = SHOP_TEMPLATES[type as keyof typeof SHOP_TEMPLATES];
  const eng = new SimulationEngine(20261104, 8_000_000);
  const r = openStaffed(eng, type);
  if (!r.success) {
    console.log(type.padEnd(20), 'AÇILAMADI:', r.message);
    continue;
  }
  const profits: number[] = [];
  const revenues: number[] = [];
  for (let d = 1; d <= 90; d++) {
    restockShops(eng);
    answerDecisionSensibly(eng);
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
    const r = openStaffed(eng, type);
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
      answerDecisionSensibly(eng);
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

console.log('\n=== YÜKSELTMELER (3. seviye dükkân, 90 gün): yükseltmesiz vs 6 yükseltmenin hepsi ===');
console.log('Hedef: 6 yükseltmenin hepsi, dükkânın hedef geri dönüş süresinin ~%80\'inde kendini çıkarsın (küçük ama sık alım).');
for (const type of Object.keys(SHOP_TEMPLATES)) {
  const run = (withUpgrades: boolean) => {
    const eng = new SimulationEngine(20261104, 8_000_000);
    if (!openStaffed(eng, type).success) return null;
    const shopId = eng.getState().tradeState!.shops[0].shopId;
    eng.upgradeShopLevel(shopId);
    eng.upgradeShopLevel(shopId);
    let cost = 0;
    if (withUpgrades) {
      for (const u of SHOP_UPGRADES) {
        const r = eng.buyShopUpgrade(shopId, u.id);
        if (r.success) cost += r.cost;
      }
    }
    const profits: number[] = [];
    for (let d = 1; d <= 90; d++) {
      restockShops(eng);
      answerDecisionSensibly(eng);
      eng.advanceDaysWithoutPlayerDecisions(1, true);
      if (d > 20) profits.push(eng.getState().tradeState!.shops[0].todayNetProfit);
    }
    return { profit: profits.reduce((a, b) => a + b, 0) / profits.length, cost };
  };
  const a = run(false);
  const b = run(true);
  if (!a || !b) continue;
  const gain = b.profit - a.profit;
  const payback = gain > 0 ? Math.round(b.cost / gain) : 'zarar';
  console.log(
    type.padEnd(20),
    'kâr/gün', fmt(a.profit).padStart(8), '→', fmt(b.profit).padStart(8),
    `(+%${Math.round((gain / Math.max(1, a.profit)) * 100)})`.padStart(7),
    'maliyet', fmt(b.cost).padStart(9),
    'geri dönüş', String(payback).padStart(5), 'gün',
    `(hedef ~${Math.round(HEDEF_GERI_DONUS[type] * 0.8)})`
  );
}

console.log('\n=== AKADEMİ, SAĞLIK VE LOJİSTİK (2. seviye dükkân, 120 gün, 8 tohum ortalaması) ===');
console.log('Eğitim: bir kez ödenir, hedef geri dönüş ~%80 (yükseltmelerle aynı). Sigorta: günlük prim, kârı artırmalı ama az.');
{
  const CS = await import('../src/engine/CityServices');
  for (const type of Object.keys(SHOP_TEMPLATES)) {
    const runSeed = (mode: 'yok' | 'egitim' | 'sigorta' | 'kargo', seed: number) => {
      const eng = new SimulationEngine(seed, 8_000_000);
      if (!openStaffed(eng, type).success) return null;
      const shopId = eng.getState().tradeState!.shops[0].shopId;
      eng.upgradeShopLevel(shopId);
      let cost = 0;
      const shop0 = eng.getState().tradeState!.shops[0];
      if (mode === 'egitim') {
        cost = CS.untrainedStaffCount(shop0) * CS.trainingCostPerPerson(shop0);
        eng.trainShopStaff(shopId);
      }
      if (mode === 'sigorta') eng.setStaffInsurance(shopId, true);
      if (mode === 'kargo') eng.setCargoContract(shopId, true);
      const profits: number[] = [];
      let premium = 0;
      for (let d = 1; d <= 120; d++) {
        restockShops(eng);
        answerDecisionSensibly(eng);
        eng.advanceDaysWithoutPlayerDecisions(1, true);
        const sh = eng.getState().tradeState!.shops[0];
        if (d > 20) {
          profits.push(sh.todayNetProfit);
          premium += CS.activeInsurancePremium(sh);
        }
      }
      return { profit: profits.reduce((a, b) => a + b, 0) / profits.length, cost, premium: premium / profits.length };
    };
    // Tek tohumda karar kartlarının sırası değiştiği için oynama büyük; 8 tohumun ortalaması alınır
    const SEEDS = [20261104, 11, 22, 33, 44, 55, 66, 77];
    const run = (mode: 'yok' | 'egitim' | 'sigorta' | 'kargo') => {
      const rs = SEEDS.map((sd) => runSeed(mode, sd));
      if (rs.some((x) => !x)) return null;
      const avg = (f: (x: NonNullable<(typeof rs)[number]>) => number) => rs.reduce((t, x) => t + f(x!), 0) / rs.length;
      return { profit: avg((x) => x.profit), cost: avg((x) => x.cost), premium: avg((x) => x.premium) };
    };
    const a = run('yok');
    const e = run('egitim');
    const g = run('sigorta');
    const k = run('kargo');
    if (!a || !e || !g || !k) continue;
    const eg = e.profit - a.profit;
    const sg = g.profit - a.profit;
    console.log(
      type.padEnd(20),
      'kâr/gün', fmt(a.profit).padStart(8),
      '| eğitim', fmt(e.cost).padStart(8), '→ +', fmt(eg).padStart(6), '/gün, geri dönüş', String(eg > 0 ? Math.round(e.cost / eg) : 'zarar').padStart(5),
      `(hedef ~${Math.round(HEDEF_GERI_DONUS[type] * 0.8)})`,
      '| sigorta prim', fmt(g.premium).padStart(6), '→ net', `${sg >= 0 ? '+' : ''}${fmt(sg)}`.padStart(7), '/gün',
      `(%${Math.round((sg / Math.max(1, a.profit)) * 100)})`,
      '| kargo ücret', fmt(CS.cargoDailyFee({ shopType: type as never })).padStart(4),
      '→ net', `${k.profit - a.profit >= 0 ? '+' : ''}${fmt(k.profit - a.profit)}`.padStart(6), '/gün',
      `(ücretsiz kazanç ${fmt(k.profit - a.profit + CS.cargoDailyFee({ shopType: type as never }))})`
    );
  }
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

console.log('\n=== ŞİRKET (hep büyüyen oyuncu: pazar dolunca temettü çekip rakip devralır) ===');
console.log('Hedef: şirket önce hızlı büyür, sektör pazarı dolunca kâr düzleşir; daha fazlası için rakip devralmak gerekir.');
console.log('(Karar kartlarına dikkatli oyuncu gibi cevap verir; şirket dönemi rakip kartları da dahil.)');
for (const sector of ['TEKNOLOJI', 'SAVUNMA', 'ENERJI'] as const) {
  const eng = new SimulationEngine(20261104, 2_500_000);
  eng.establishCompany('Ölçüm A.Ş.', 'OLCM', sector, 2_000_000, {
    initialStaffCount: 40,
    initialCapacity: 100,
    initialRdBudget: 10_000,
  });
  const notes: string[] = [];
  const rows: string[] = [];
  for (let d = 1; d <= 2100; d++) {
    growCompanyGreedy(eng);
    const t = expandByTakeover(eng);
    if (t) notes.push(`gün ${d}: ${t}`);
    answerDecisionSensibly(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
    if (d % 300 === 0) {
      const st = eng.getState();
      const c = st.playerCompany!;
      rows.push(
        `  gün ${String(d).padEnd(5)} şirket kârı/gün ${fmt(c.financials.netIncome / 120).padStart(11)}` +
          ` · pazar payı %${String(c.operations?.playerMarketSharePct ?? 0).padEnd(5)}` +
          ` · net varlık ${fmt(st.netWorth).padStart(15)} · ödenen servet vergisi ${fmt(st.wealthTax?.totalPaid ?? 0)}`
      );
    }
  }
  console.log(sector);
  rows.forEach((r) => console.log(r));
  notes.forEach((n) => console.log('  ' + n));
}

console.log('\n=== ŞEHİR HİZMETLERİ (Belediye projeleri, 4 dükkânlı oyuncu, 120 gün) ===');
{
  const { CITY_PROJECTS } = await import('../src/data/cityServices');
  const run = (projects: string[]) => {
    const eng = new SimulationEngine(20261104, 8_000_000);
    for (const t of ['BUFE', 'MANAV', 'KAFE', 'GIYIM_MAGAZASI']) openStaffed(eng, t);
    eng.getState().tradeState!.cityProjects = projects;
    let total = 0;
    for (let d = 1; d <= 120; d++) {
      restockShops(eng);
      answerDecisionSensibly(eng);
      eng.advanceDaysWithoutPlayerDecisions(1, true);
      if (d > 20) total += eng.getState().tradeState!.shops.reduce((s, x) => s + x.todayNetProfit, 0);
    }
    return total / 100;
  };
  const base = run([]);
  console.log('  projesiz dükkân kârı/gün', fmt(base));
  const done: string[] = [];
  let prev = base;
  for (const p of CITY_PROJECTS) {
    done.push(p.id);
    const v = run([...done]);
    const gain = v - prev;
    console.log(
      `  ${p.name.padEnd(20)} ₺${fmt(p.price).padStart(10)} → +₺${fmt(gain).padStart(7)}/gün · geri dönüş ${gain > 0 ? Math.round(p.price / gain) : '∞'} gün`
    );
    prev = v;
  }
}
