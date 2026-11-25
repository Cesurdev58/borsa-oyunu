/**
 * Faz 3.3: genel merkez şehrinin sektör bonusu oyuncu şirketine bağlandı.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { companyCitySectorMultiplier } from '../../engine/CityEconomy';
import { getDetailedCityDefinitions, CITY_IDS } from '../../data/cityDefinitions';
import { SECTOR_CONFIGS } from '../../data/sectors';
import { COMPANY_CITY_COST_SHARE } from '../../data/cityBalance';
import { CompanyCityCard } from '../../components/game/ui/CompanyCityCard';
import { growCompanyGreedy } from '../balance/companyBot';
import type { SectorId } from '../../models/market';

const fmt = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;

test('Şehir çarpanı: haritadaki bonus aynen; bonusu olmayan şehir ve şehirsiz oyuncu 1', () => {
  assert.equal(companyCitySectorMultiplier('ankara', 'SAVUNMA'), 1.15);
  assert.equal(companyCitySectorMultiplier('istanbul', 'MADENCILIK'), 0.9);
  assert.equal(companyCitySectorMultiplier('eskisehir', 'SAVUNMA'), 1);
  assert.equal(companyCitySectorMultiplier(undefined, 'SAVUNMA'), 1);
  assert.equal(companyCitySectorMultiplier('olmayan-il', 'SAVUNMA'), 1);
  for (const id of CITY_IDS) {
    for (const s of Object.keys(SECTOR_CONFIGS) as SectorId[]) {
      const m = companyCitySectorMultiplier(id, s);
      assert.ok(Number.isFinite(m) && m >= 0.5 && m <= 2, `${id}/${s}`);
    }
  }
  // Her bonusu olan sektör en az bir şehirde 1'den farklı
  const detailed = getDetailedCityDefinitions();
  for (const s of ['TEKNOLOJI', 'SAVUNMA', 'FINANS', 'LOJISTIK', 'ENERJI', 'MADENCILIK', 'PERAKENDE'] as SectorId[]) {
    assert.ok(detailed.some((c) => companyCitySectorMultiplier(c.id, s) !== 1), s);
  }
});

function runCompany(cityId: string | null, sector: SectorId, days: number) {
  const eng = new SimulationEngine(20261125, 2_500_000);
  if (cityId) assert.equal(eng.chooseStartCity(cityId).success, true);
  const res = eng.establishCompany('Ölçüm A.Ş.', 'OLCM', sector, 2_000_000, {
    initialStaffCount: 40,
    initialCapacity: 100,
    initialRdBudget: 10_000,
  });
  assert.equal(res.success, true, res.message);
  let sum = 0;
  for (let d = 0; d < days; d++) {
    growCompanyGreedy(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
    sum += eng.getState().playerCompany!.financials.netIncome;
  }
  return { eng, avgNetIncome: sum / days };
}

test('Bonusu olmayan şehirde şirket şehirsiz (eski ölçüm) ile kuruşu kuruşuna aynı', () => {
  const a = runCompany(null, 'SAVUNMA', 60);
  const b = runCompany('eskisehir', 'SAVUNMA', 60);
  assert.equal(b.eng.getState().playerCompany!.operations!.citySectorMultiplier, 1);
  assert.equal(a.avgNetIncome, b.avgNetIncome);
  assert.equal(a.eng.getState().playerCompany!.financials.cash, b.eng.getState().playerCompany!.financials.cash);
});

test('Savunmada güçlü Ankara: çarpan yazılır, üretim ucuzlar, ortalama kâr artar', () => {
  const base = runCompany('eskisehir', 'SAVUNMA', 120);
  const ank = runCompany('ankara', 'SAVUNMA', 120);
  const ops = ank.eng.getState().playerCompany!.operations!;
  assert.equal(ops.citySectorMultiplier, 1.15);
  const expectedCost = Number((SECTOR_CONFIGS.SAVUNMA.unitCost / (1 + 0.15 * COMPANY_CITY_COST_SHARE)).toFixed(2));
  assert.equal(ops.unitProductionCost, expectedCost);
  assert.ok(ank.avgNetIncome > base.avgNetIncome, `${ank.avgNetIncome} > ${base.avgNetIncome}`);
});

test('Madencilikte zayıf İstanbul: ortalama kâr düşer', () => {
  const base = runCompany('eskisehir', 'MADENCILIK', 120);
  const ist = runCompany('istanbul', 'MADENCILIK', 120);
  assert.equal(ist.eng.getState().playerCompany!.operations!.citySectorMultiplier, 0.9);
  assert.ok(ist.avgNetIncome < base.avgNetIncome);
});

test('Şirket sekmesindeki şehir kartı genel merkezin sektör bonusunu yazar', () => {
  const { eng } = runCompany('ankara', 'SAVUNMA', 2);
  const html = renderToStaticMarkup(
    React.createElement(CompanyCityCard, { state: eng.getState(), cityId: 'ankara', formatCurrency: fmt })
  );
  assert.match(html, /data-testid="company-city-sector-bonus"/);
  assert.match(html, /pazar \+%15/);

  const neutral = runCompany('eskisehir', 'SAVUNMA', 2).eng;
  const html2 = renderToStaticMarkup(
    React.createElement(CompanyCityCard, { state: neutral.getState(), cityId: 'eskisehir', formatCurrency: fmt })
  );
  assert.doesNotMatch(html2, /company-city-sector-bonus/);
});
