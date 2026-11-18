/**
 * Kariyer hızı ölçümü. Çalıştırmak için:  npm run kariyer
 *
 * Sıfırdan başlayan "makul oyuncu" robotu bütün kariyeri oynar ve her önemli anın
 * kaçıncı oyun gününde ve kaç GERÇEK dakikada geldiğini yazar:
 *  - Başta parasını bütün hisselere eşit böler, bekler.
 *  - İlk dükkân kapısı açılınca hisselerini satar, en ucuz dükkânı açar.
 *  - Her gün rafları doldurur, karar kartlarına makul cevap verir.
 *  - Parası yetince yeni türde dükkân açar, açacak tür kalmayınca dükkân yükseltir.
 *  - Dükkân açacak para birikene kadar artan nakdi hisseye yatırmaz (dükkân daha kârlı).
 * Prestij yıldızıyla ölçmek için: PRESTIJ_YILDIZ=2 npm run kariyer
 * Gerçek oyuncu haberleri okuyarak borsada daha hızlı gidebilir; bu robot alt sınıra yakın bir ölçüdür.
 */
import { SimulationEngine } from '../src/engine/SimulationEngine';
import { SHOP_TEMPLATES } from '../src/engine/TradeAndShopEngine';
import { firstShopGateStatus } from '../src/engine/FirstShopGate';
import { buildCareerGoals } from '../src/engine/CareerGoals';
import { listShopUpgrades } from '../src/engine/ShopUpgrades';
import { prestigeBonuses } from '../src/engine/PrestigeEngine';
import { PROGRESSION_RULES } from '../src/engine/ProgressionRules';
import { restockShops } from '../src/tests/balance/restockBot';
import { answerDecisionSensibly } from '../src/tests/balance/decisionBot';

const SEEDS = [20261104, 1, 2];
const MAX_DAYS = 400;
const SHOP_ORDER = ['BUFE', 'MANAV', 'KAFE', 'GIYIM_MAGAZASI', 'ELEKTRONIK_MAGAZASI', 'MOBILYA_MAGAZASI', 'MARKET', 'OTOMOBIL_GALERISI'] as const;

type Milestones = Record<string, { day: number; min: number } | null>;

function runCareer(seed: number): {
  ms: Milestones;
  finalNetWorth: number;
  shops: number;
  goalTimes: { title: string; min: number; reward: number }[];
} {
  const stars = Number(process.env.PRESTIJ_YILDIZ ?? 0);
  const eng = new SimulationEngine(seed, prestigeBonuses(stars).startCash);
  if (stars > 0) eng.getState().prestige = { stars, cities: 1, bestNetWorth: 0 };
  const ms: Milestones = {
    'İlk dükkân': null,
    'İlk yükseltme': null,
    '2. dükkân': null,
    '250 bin': null,
    '3. dükkân': null,
    '500 bin': null,
    '1 milyon': null,
    'Şirket kapısı': null,
    'Şirketleşme şartı': null,
  };
  let realMin = 0;
  const goalTimes: { title: string; min: number; reward: number }[] = [];
  const mark = (k: string, d: number) => {
    if (ms[k] === null) ms[k] = { day: d, min: realMin };
  };

  // Başlangıç: parayı bütün hisselere eşit böl.
  const buyBasket = (budget: number) => {
    const stocks = eng.getState().stocks;
    const per = budget / stocks.length;
    for (const s of stocks) {
      const sh = Math.floor(per / (s.price * 1.01));
      if (sh > 0) eng.buyStock(s.ticker, sh);
    }
  };
  buyBasket(eng.getSpendableCash() * 0.95);
  // "Bir hisseni sat" görevi: en küçük pozisyondan biraz sat
  {
    const first = Object.entries(eng.getState().portfolio).find(([, p]) => p.shares > 1);
    if (first) eng.sellStock(first[0], 1);
  }

  let upgrades = 0;
  for (let d = 1; d <= MAX_DAYS; d++) {
    const st = eng.getState();
    const shops = st.tradeState?.shops ?? [];

    if (shops.length === 0 && firstShopGateStatus(st).open) {
      for (const [t, p] of Object.entries(st.portfolio)) if (p.shares > 0) eng.sellStock(t, p.shares);
    }

    // Dükkân kasalarındaki fazlayı cebe al ("Kâr al"), kasada birkaç günlük işletme parası bırak
    for (const sh of shops) {
      const keep = 25_000;
      const extra = Math.floor(sh.cashAccountBalance - keep);
      if (extra > 1_000) eng.transferBetweenPersonalAndShopCash({ shopId: sh.shopId, direction: 'FROM_SHOP', amount: extra });
    }

    // Yeni dükkân ya da yükseltme
    for (let guard = 0; guard < 3; guard++) {
      const s2 = eng.getState();
      const owned = new Set((s2.tradeState?.shops ?? []).map((x) => x.shopType));
      const next = SHOP_ORDER.find((t) => !owned.has(t));
      const cash = eng.getSpendableCash();
      if (next) {
        const tpl = SHOP_TEMPLATES[next];
        const need = (tpl.openingCost + tpl.decorationCost) * 1.15 + 8_000;
        if (cash < need) break;
        const r = eng.openShop({ shopType: next });
        if (!r.success) break;
        continue;
      }
      // Bütün türler açık: en düşük seviyeli dükkânı yükselt
      const list = [...(s2.tradeState?.shops ?? [])].sort((a, b) => a.level - b.level);
      const target = list[0];
      if (!target) break;
      const tpl = SHOP_TEMPLATES[target.shopType];
      const cost = tpl.levelUpgradeCosts[target.level - 1];
      if (cost === undefined || cash < cost * 1.15 + 8_000) break;
      const r = eng.upgradeShopLevel(target.shopId);
      if (!r.success) break;
      upgrades++;
    }
    // Yeni türler açıldıysa da ucuz yükseltmeleri dene (ilk yükseltme anı için)
    {
      const s3 = eng.getState();
      for (const sh of s3.tradeState?.shops ?? []) {
        const tpl = SHOP_TEMPLATES[sh.shopType];
        const cost = tpl.levelUpgradeCosts[sh.level - 1];
        if (cost !== undefined && sh.level === 1 && eng.getSpendableCash() > cost * 2.5 + 30_000) {
          if (eng.upgradeShopLevel(sh.shopId).success) upgrades++;
        }
      }
    }

    // Hazır hedef ödüllerini al
    for (let k = 0; k < 5; k++) {
      const m = buildCareerGoals(eng.getState(), { hasOpenedBorsa: true, companyNetWorth: PROGRESSION_RULES.entrepreneurNetWorth });
      if (!m.active || !m.active.progress.done) break;
      const r = eng.claimCareerGoal(m.active.def.id, { hasOpenedBorsa: true });
      if (!r.success) break;
      goalTimes.push({ title: m.active.def.title, min: realMin, reward: r.reward });
    }
    // Hedef şeridi yükseltme istiyorsa en iyi dükkânı yükselt (gerçek oyuncu şeridi takip eder)
    {
      const m = buildCareerGoals(eng.getState(), { hasOpenedBorsa: true, companyNetWorth: PROGRESSION_RULES.entrepreneurNetWorth });
      const want = m.active?.def.id === 'goal-shop-level-2' ? 1 : m.active?.def.id === 'goal-shop-level-3' ? 2 : 0;
      if (want) {
        const cand = (eng.getState().tradeState?.shops ?? []).filter((x) => x.level === want);
        for (const sh of cand) {
          const cost = SHOP_TEMPLATES[sh.shopType].levelUpgradeCosts[sh.level - 1];
          if (cost !== undefined && eng.getSpendableCash() >= cost * 1.1 + 8_000 && eng.upgradeShopLevel(sh.shopId).success) {
            upgrades++;
            break;
          }
        }
      }
    }
    // Küçük yükseltmeler: hedef isterse en ucuzunu al; ayrıca nakdin %20'sinden ucuz olanları al
    {
      const m = buildCareerGoals(eng.getState(), { hasOpenedBorsa: true, companyNetWorth: PROGRESSION_RULES.entrepreneurNetWorth });
      const goalWants = m.active?.def.id === 'goal-first-upgrade' || m.active?.def.id === 'goal-six-upgrades';
      const offers = (eng.getState().tradeState?.shops ?? [])
        .flatMap((sh) => listShopUpgrades(sh).filter((u) => u.status === 'AVAILABLE').map((u) => ({ sh, u })))
        .sort((a, b) => a.u.cost - b.u.cost);
      for (const { sh, u } of offers) {
        const cash = eng.getSpendableCash();
        if ((goalWants && cash >= u.cost + 8_000) || u.cost < cash * 0.2) {
          eng.buyShopUpgrade(sh.shopId, u.def.id);
          if (goalWants) break;
        }
      }
    }
    // Lüks alım ve portföy yöneticisi hedefleri (gerçek oyuncu şeridi takip eder)
    {
      const m = buildCareerGoals(eng.getState(), { hasOpenedBorsa: true, companyNetWorth: PROGRESSION_RULES.entrepreneurNetWorth });
      if (m.active?.def.id === 'goal-first-luxury' && eng.getSpendableCash() > 150_000 + 20_000) eng.buyLifestyleItem('daire');
      if (m.active?.def.id === 'goal-portfolio-manager' && eng.getSpendableCash() > 50_000 + 60_000) {
        eng.hirePortfolioManager();
        eng.configureAutoInvest({ enabled: false });
      }
    }
    // 2. seviye dükkâna müdür tut (hedef zinciri bunu ister; gerçek oyuncu da yapar)
    for (const sh of eng.getState().tradeState?.shops ?? []) {
      if (sh.level >= 2 && !sh.manager && !(eng.getState().tradeState?.shops ?? []).some((x) => x.manager)) {
        eng.hireShopManager(sh.shopId);
      }
    }

    restockShops(eng);
    answerDecisionSensibly(eng);
    realMin += eng.getEffectiveMinutesPerGameDay();
    eng.advanceDaysWithoutPlayerDecisions(1, true);

    const after = eng.getState();
    const n = after.tradeState?.shops.length ?? 0;
    if (n >= 1) mark('İlk dükkân', d);
    if (n >= 2) mark('2. dükkân', d);
    if (n >= 3) mark('3. dükkân', d);
    if ((after.tradeState?.shops ?? []).some((x) => x.level >= 2)) mark('İlk yükseltme', d);
    if (after.netWorth >= 250_000) mark('250 bin', d);
    if (after.netWorth >= 500_000) mark('500 bin', d);
    if (after.netWorth >= 1_000_000) mark('1 milyon', d);
    if (after.netWorth >= PROGRESSION_RULES.entrepreneurNetWorth) mark('Şirket kapısı', d);
    const inc = eng.checkIncorporationEligibility();
    if (inc.eligible) mark('Şirketleşme şartı', d);
    if (d % 50 === 0 && process.env.KARIYER_DEBUG) console.log('  [gün', d, ']', inc.reasons?.join(' | '));
    if (ms['Şirket kapısı'] !== null && ms['Şirketleşme şartı'] !== null) break;
  }
  const fin = eng.getState();
  return { ms, finalNetWorth: fin.netWorth, shops: fin.tradeState?.shops.length ?? 0, goalTimes };
}

const fmtTime = (min: number) =>
  min < 60 ? `${Math.round(min)} dk` : `${(min / 60).toFixed(1).replace('.', ',')} sa`;

console.log('=== KARİYER HIZI (1x hız, gerçek süre) ===');
const all: Milestones[] = [];
for (const seed of SEEDS) {
  const r = runCareer(seed);
  all.push(r.ms);
  console.log(`\nseed ${seed} (bitiş net varlık ${Math.round(r.finalNetWorth).toLocaleString('tr-TR')}, ${r.shops} dükkân)`);
  for (const [k, d] of Object.entries(r.ms)) {
    console.log('  ' + k.padEnd(18), d === null ? `${MAX_DAYS}+ gün` : `gün ${String(d.day).padStart(3)}  ≈ ${fmtTime(d.min)}`);
  }
}

console.log('\n=== HEDEF ÖDÜLLERİ (ilk tohum): hangi dakikada alındı ===');
{
  const r = runCareer(SEEDS[0]);
  let prev = 0;
  let total = 0;
  for (const g of r.goalTimes) {
    total += g.reward;
    console.log('  ' + fmtTime(g.min).padStart(7), ` (+${fmtTime(g.min - prev)})`.padEnd(11), g.title.padEnd(38), '+₺' + g.reward.toLocaleString('tr-TR'));
    prev = g.min;
  }
  console.log('  toplam ödül ₺' + total.toLocaleString('tr-TR'));
}
