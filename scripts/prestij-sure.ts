/**
 * PRESTİJ SÜRE ÖLÇÜMÜ: şirket aşamasında net varlığın hangi gerçek saatte hangi eşiği geçtiğini yazar.
 * Gün uzunluğu motorun kendi hız kuralından (hızlı başlangıç) okunur; şirket öncesi kariyer süresi
 * `npm run kariyer` ölçümünden (şirket kapısı ~5 saat) KARIYER_SAAT olarak eklenir.
 * Kullanım: npm run prestij-sure
 */
import { SimulationEngine } from '../src/engine/SimulationEngine';
import { PRESTIGE_STAR_THRESHOLDS } from '../src/data/gameBalance';
import { growCompanyGreedy, expandByTakeover } from '../src/tests/balance/companyBot';
import { answerDecisionSensibly } from '../src/tests/balance/decisionBot';

const KARIYER_SAAT = Number(process.env.KARIYER_SAAT ?? 5.1);
const MAX_DAYS = Number(process.env.MAX_DAYS ?? 3000);
const fmtH = (h: number) => `${h.toFixed(1)} sa`;
const thresholds = [...PRESTIGE_STAR_THRESHOLDS];

console.log(`Şirket öncesi kariyer: ${KARIYER_SAAT} sa (kariyer ölçümü). Aşağıda toplam gerçek saat.`);
for (const sector of ['TEKNOLOJI', 'SAVUNMA', 'ENERJI'] as const) {
  const eng = new SimulationEngine(20261104, 2_500_000);
  eng.establishCompany('Ölçüm A.Ş.', 'OLCM', sector, 2_000_000, { initialStaffCount: 40, initialCapacity: 100, initialRdBudget: 10_000 });
  let hours = KARIYER_SAAT;
  const hit = new Map<number, string>();
  for (let d = 1; d <= MAX_DAYS; d++) {
    growCompanyGreedy(eng);
    expandByTakeover(eng);
    answerDecisionSensibly(eng);
    hours += eng.getEffectiveMinutesPerGameDay() / 60;
    eng.advanceDaysWithoutPlayerDecisions(1, true);
    const nw = eng.getState().netWorth;
    for (const [min, star] of thresholds) {
      if (!hit.has(star) && nw >= min) hit.set(star, `${fmtH(hours)} (gün ${d})`);
    }
    if (hit.size === thresholds.length) break;
  }
  console.log(sector.padEnd(10), thresholds.map(([, s]) => `${s}★: ${hit.get(s) ?? '—'}`).join(' · '));
}
