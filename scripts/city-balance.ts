/**
 * 12 şehir dengesi. Çalıştırmak için:  npm run city-balance
 *
 * 12 detaylı şehir × en az 10 tohum × ilk 10 gerçek saat (hızlı başlangıçta gün = 2 dk → 300 oyun günü):
 *  - aynı dükkân türünün şehirler arası günlük EBITDA'sı (satış − mal − maaş − kira; tam bir yıl, mevsimler dengelensin)
 *  - başlangıç farkı: en güçlü ile en zayıf şehrin ekonomik güç endeksi farkı (hedef bant: %20–35); ayrıca 3/5/10. saat net varlıkları
 *  - zarar riski (net varlığı başlangıcın altında biten oyun oranı, zararla biten gün oranı)
 *  - ilk yükseltmeden sonra nakit rezervi, 2. dükkân zamanı, ilk 1 milyon ve şirket kapısı zamanı
 * Ortam değişkenleri: SEEDS=10 (tohum sayısı), DAYS=300 (oyun günü), EBITDA_SEEDS=3.
 * Gerçek oyuncu robottan farklı oynar; bu rakamlar şehirleri KIYASLAMAK içindir, kesin süre vaadi değildir.
 */
import { getDetailedCityDefinitions } from '../src/data/cityDefinitions';
import { runCityCareer, measureShopEbitda, SHOP_ORDER, type CityCareerResult } from '../src/tests/balance/cityBot';
import { CITY_BALANCE_TARGET_BAND } from '../src/data/cityBalance';

const SEEDS = Number(process.env.SEEDS ?? 10);
const DAYS = Number(process.env.DAYS ?? 300);
const EBITDA_SEEDS = Number(process.env.EBITDA_SEEDS ?? 3);
const MIN_PER_DAY = 2; // hızlı başlangıç: şirket kurulana kadar oyun günü 2 gerçek dakika
const seedList = Array.from({ length: SEEDS }, (_, i) => 20261104 + i * 7919);

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const money = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString('tr-TR') : '—');
const hours = (day: number | null | undefined) => (day === null || day === undefined || !Number.isFinite(day) ? '—' : `${((day * MIN_PER_DAY) / 60).toFixed(1).replace('.', ',')} sa`);
const pad = (s: string, n: number) => s.padEnd(n, ' ');
const padL = (s: string, n: number) => s.padStart(n, ' ');

const cities = getDetailedCityDefinitions();
console.log(`=== ŞEHİR DENGESİ: ${cities.length} şehir × ${SEEDS} tohum × ${DAYS} oyun günü (≈ ${(DAYS * MIN_PER_DAY / 60).toFixed(0)} gerçek saat) ===\n`);

const careers = new Map<string, CityCareerResult[]>();
for (const c of cities) {
  careers.set(c.id, seedList.map((s) => runCityCareer(c.id, s, DAYS)));
}

console.log('--- 1) KARİYER (robot oyuncu, her şehirde sıfırdan) ---');
console.log(`${pad('Şehir', 12)}${padL('Net varlık', 14)}${padL('1. dükkân', 11)}${padL('2. dükkân', 11)}${padL('1. yüks.', 10)}${padL('Yüks. sonrası nakit', 21)}${padL('1 milyon', 16)}${padL('Şirket kapısı', 17)}${padL('Zarar günü', 12)}${padL('Zarar riski', 12)}`);
for (const c of cities) {
  const rs = careers.get(c.id)!;
  const med = (f: (r: CityCareerResult) => number | null) => {
    const v = rs.map(f).filter((x): x is number => x !== null);
    return v.length ? mean(v) : NaN;
  };
  const nw = mean(rs.map((r) => r.finalNetWorth));
  const risk = rs.filter((r) => r.finalNetWorth < r.startNetWorth || r.minCash < 0).length / rs.length;
  const reach = (f: (r: CityCareerResult) => number | null) => rs.filter((r) => f(r) !== null).length;
  console.log(
    `${pad(c.nameTR, 12)}${padL(money(nw), 14)}${padL(hours(med((r) => r.firstShopDay)), 11)}${padL(hours(med((r) => r.secondShopDay)), 11)}${padL(hours(med((r) => r.firstUpgradeDay)), 10)}${padL(money(med((r) => r.cashAfterFirstUpgrade)), 21)}${padL(`${hours(med((r) => r.millionDay))} (${reach((r) => r.millionDay)}/${rs.length})`, 16)}${padL(`${hours(med((r) => r.companyGateDay))} (${reach((r) => r.companyGateDay)}/${rs.length})`, 17)}${padL(`%${(mean(rs.map((r) => r.lossDayShare)) * 100).toFixed(1)}`, 12)}${padL(`%${(risk * 100).toFixed(0)}`, 12)}`
  );
}
// Erken kıyas: 3. saat (90. oyun günü) net varlığı. Daha sonra büyüme bileşik işlediği için fark 10. saatte çok açılır.
const at = (day: number) => cities.map((c) => ({ name: c.nameTR, v: mean(careers.get(c.id)!.map((r) => r.netWorthAt[day])) })).sort((a, b) => b.v - a.v);
const [lo, hi] = CITY_BALANCE_TARGET_BAND;
for (const day of [90, 150, 300]) {
  const list = at(day);
  const bst = list[0];
  const wst = list[list.length - 1];
  console.log(`${(day * MIN_PER_DAY / 60).toFixed(0).padStart(2)}. saatte net varlık: en yüksek ${bst.name} ₺${money(bst.v)} · en düşük ${wst.name} ₺${money(wst.v)} · fark %${(((bst.v - wst.v) / bst.v) * 100).toFixed(0)}`);
}
console.log('(Fark zamanla bileşik büyüdüğü için uzun vadede açılır; bant ölçüsü aşağıdaki EBITDA endeksidir.)');

console.log('\n--- 2) AYNI DÜKKÂN TÜRÜNÜN ŞEHİRLER ARASI GÜNLÜK EBITDA\'sı (₺/gün, ortalama) ---');
const ebitda: Record<string, Record<string, number>> = {};
for (const c of cities) {
  ebitda[c.id] = {};
  for (const t of SHOP_ORDER) {
    const vals: number[] = [];
    for (let i = 0; i < EBITDA_SEEDS; i++) vals.push(measureShopEbitda(c.id, t, seedList[i], { days: 365 }).ebitdaPerDay);
    ebitda[c.id][t] = mean(vals);
  }
}
console.log(pad('Tür', 22) + cities.map((c) => padL(c.nameTR.slice(0, 7), 9)).join('') + padL('En iyi', 12) + padL('Fark', 8));
const bestCount: Record<string, number> = {};
for (const t of SHOP_ORDER) {
  const vals = cities.map((c) => ebitda[c.id][t]);
  const bi = vals.indexOf(Math.max(...vals));
  const wi = vals.indexOf(Math.min(...vals));
  bestCount[cities[bi].id] = (bestCount[cities[bi].id] ?? 0) + 1;
  const spread = vals[wi] > 0 ? (vals[bi] / vals[wi] - 1) * 100 : NaN;
  console.log(pad(t, 22) + vals.map((v) => padL(money(v), 9)).join('') + padL(cities[bi].nameTR.slice(0, 10), 12) + padL(Number.isFinite(spread) ? `%${spread.toFixed(0)}` : '—', 8));
}
// Ekonomik güç endeksi: her şehrin 8 dükkân türündeki EBITDA'sının Ankara'ya oranlarının ortalaması
const ankara = ebitda['ankara'];
const index = cities.map((c) => ({ name: c.nameTR, v: mean(SHOP_ORDER.map((t) => ebitda[c.id][t] / ankara[t])) })).sort((a, b) => b.v - a.v);
console.log('\nEkonomik güç endeksi (Ankara = 1,00): ' + index.map((x) => `${x.name} ${x.v.toFixed(2).replace('.', ',')}`).join(' · '));
const spread = ((index[0].v - index[index.length - 1].v) / index[0].v) * 100;
console.log(`En güçlü ${index[0].name} · en zayıf ${index[index.length - 1].name} · fark %${spread.toFixed(1)} (hedef bant %${lo}–${hi}) → ${spread >= lo && spread <= hi ? 'BANDIN İÇİNDE' : spread < lo ? 'BANDIN ALTINDA (şehirler fazla benzer)' : 'BANDIN ÜSTÜNDE (şehirler fazla farklı)'}`);
const dominant = Object.entries(bestCount).filter(([, n]) => n === SHOP_ORDER.length);
console.log(`\nHer dükkân türünde en iyi olan şehir: ${dominant.length ? dominant.map(([id]) => id).join(', ') + '  ← SORUN' : 'yok (iyi)'}`);
console.log('Tür başına en iyi şehir sayısı: ' + Object.entries(bestCount).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${cities.find((c) => c.id === id)!.nameTR} ${n}`).join(', '));

// ---------------------------------------------------------------------------
// 3) ŞİRKET: genel merkez şehrinin sektör bonusu (Faz 3.3)
// ---------------------------------------------------------------------------
{
  const { SimulationEngine } = await import('../src/engine/SimulationEngine');
  const { growCompanyGreedy } = await import('../src/tests/balance/companyBot');
  const { companyCitySectorMultiplier } = await import('../src/engine/CityEconomy');
  const COMPANY_DAYS = Number(process.env.COMPANY_DAYS ?? 600);
  const COMPANY_SEEDS = Number(process.env.COMPANY_SEEDS ?? 4);
  const NEUTRAL_CITY = 'eskisehir'; // bonusu olmayan il: eski ölçümlerle aynı
  const SECTORS = ['TEKNOLOJI', 'SAVUNMA', 'FINANS', 'LOJISTIK', 'ENERJI', 'MADENCILIK', 'BIYOTEKNOLOJI', 'PERAKENDE'] as const;
  const runCompany = (cityId: string, sector: (typeof SECTORS)[number], seed: number) => {
    const eng = new SimulationEngine(seed, 2_500_000);
    eng.chooseStartCity(cityId);
    eng.establishCompany('Ölçüm A.Ş.', 'OLCM', sector, 2_000_000, { initialStaffCount: 40, initialCapacity: 100, initialRdBudget: 10_000 });
    // Ölçü: dönem boyunca ortalama günlük net kâr (yatırım zamanlamasının oynaklığını yumuşatır) ve son gün kârı
    let sum = 0;
    let last = 0;
    for (let d = 1; d <= COMPANY_DAYS; d++) {
      growCompanyGreedy(eng);
      eng.advanceDaysWithoutPlayerDecisions(1, true);
      last = eng.getState().playerCompany!.financials.netIncome / 120;
      sum += last;
    }
    return { avg: sum / COMPANY_DAYS, last };
  };
  console.log(`\n--- 3) ŞİRKET: GENEL MERKEZİN SEKTÖR BONUSU (${COMPANY_SEEDS} tohum × ${COMPANY_DAYS} gün, hep büyüyen robot) ---`);
  console.log('Kıyas: bonusu olmayan il (Eskişehir) ile en yüksek ve en düşük bonuslu şehir. "Ort. kâr" = dönem boyunca ortalama günlük net kâr; fark buna göre.');
  console.log(`${pad('Sektör', 15)}${pad('Şehir', 12)}${padL('Çarpan', 8)}${padL('Ort. kâr', 13)}${padL(`${COMPANY_DAYS}. gün kâr`, 15)}${padL('Fark', 8)}`);
  for (const sector of SECTORS) {
    const ranked = cities
      .map((c) => ({ id: c.id, name: c.nameTR, m: companyCitySectorMultiplier(c.id, sector) }))
      .sort((a, b) => b.m - a.m);
    const picks = [{ id: NEUTRAL_CITY, name: 'Eskişehir', m: 1 }];
    if (ranked[0].m !== 1) picks.push(ranked[0]);
    if (ranked[ranked.length - 1].m !== 1) picks.push(ranked[ranked.length - 1]);
    let base = NaN;
    for (const p of picks) {
      const rs = seedList.slice(0, COMPANY_SEEDS).map((s) => runCompany(p.id, sector, s));
      const avg = mean(rs.map((r) => r.avg));
      const late = mean(rs.map((r) => r.last));
      if (p.id === NEUTRAL_CITY) base = avg;
      const diff = p.id === NEUTRAL_CITY || !(base > 0) ? '' : `%${(((avg - base) / base) * 100).toFixed(0)}`;
      console.log(`${pad(sector, 15)}${pad(p.name, 12)}${padL(p.m.toFixed(2).replace('.', ','), 8)}${padL(money(avg), 13)}${padL(money(late), 15)}${padL(diff, 8)}`);
    }
  }
}
