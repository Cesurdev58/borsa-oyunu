/**
 * Faz 3.1: haritadaki eksik üç uyarı — kredi/kira sıkıntısı, müdür gerekli, kapasite (depo) dolu.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationEngine } from '../../engine/SimulationEngine';
import {
  CITY_ISSUE_LABEL_TR,
  SHOP_ISSUE_LABEL_TR,
  SHOP_LOSS_GRACE_DAYS,
  cityHasIssue,
  cityIssueLabels,
  cityLevelIssueKinds,
  shopIssueKinds,
  shopIssueKindsInState,
} from '../../engine/CityOpeningQuote';
import { MANAGER_MIN_SHOP_LEVEL, MANAGER_NEEDED_UNMET_SHARE, WAREHOUSE_FULL_SHARE } from '../../data/gameBalance';
import { buildMapMarkers } from '../../components/game/turkeyMap/TurkeyMapScreen';
import { cityMatchesFilter } from '../../components/game/turkeyMap/mapFilters';
import { CityInfoSheet } from '../../components/game/turkeyMap/CityInfoSheet';
import { CityShopsScreen } from '../../components/game/turkeyMap/CityShopsScreen';
import { CITY_DEFINITIONS } from '../../data/cityDefinitions';
import type { LoanContract } from '../../models/finance';

const fmt = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;
const noop = () => {};

const base = {
  inventoryBatches: [{ availableQuantity: 10 }],
  pendingDeliveriesCount: 0,
  staffCount: 2,
  minStaffRequired: 2,
  ownerWorks: false,
  todayNetProfit: 500,
  openedDay: 1,
  isCompanyBranch: false,
  level: 1,
  cashAccountBalance: 5_000,
  todayPayrollCost: 800,
  todayRentAndOpex: 600,
  todayUnitsSold: 100,
  todayUnmetCustomerDemand: 0,
};
const DAY = 30;

// ---------------------------------------------------------------------------
// Kira / maaş sıkıntısı
// ---------------------------------------------------------------------------

test('Kira sıkıntısı: kasa bir günlük gideri karşılamıyor ve cep de açığı kapatamıyorsa', () => {
  const short = { ...base, cashAccountBalance: 300 }; // gider 1.400, açık 1.100
  assert.deepEqual(shopIssueKinds(short, DAY, { personalCash: 500 }), ['RENT_SHORT']);
  // Cep açığı kapatıyorsa (gider otomatik cepten ödenir) sorun yok
  assert.deepEqual(shopIssueKinds(short, DAY, { personalCash: 1_100 }), []);
  // Kasa yetiyorsa cep boş olsa da sorun yok
  assert.deepEqual(shopIssueKinds(base, DAY, { personalCash: 0 }), []);
  // Cep bilgisi verilmezse kural atlanır (eski çağrılar bozulmaz)
  assert.deepEqual(shopIssueKinds(short, DAY), []);
  // Şirket şubesi kendi kasasıyla değil şirketle ödenir
  assert.deepEqual(shopIssueKinds({ ...short, isCompanyBranch: true }, DAY, { personalCash: 0 }), []);
});

// ---------------------------------------------------------------------------
// Müdür gerekli
// ---------------------------------------------------------------------------

test('Müdür gerekli: müdürü olmayan, seviyesi yeten dükkân raf boşaldığı için satış kaçırdıysa', () => {
  const lvl = MANAGER_MIN_SHOP_LEVEL;
  const unmetAtThreshold = Math.ceil((100 * MANAGER_NEEDED_UNMET_SHARE) / (1 - MANAGER_NEEDED_UNMET_SHARE));
  const missing = { ...base, level: lvl, todayUnitsSold: 100, todayUnmetCustomerDemand: unmetAtThreshold };
  assert.deepEqual(shopIssueKinds(missing, DAY), ['MANAGER_NEEDED']);
  // Eşiğin altı
  assert.deepEqual(shopIssueKinds({ ...missing, todayUnmetCustomerDemand: 1 }, DAY), []);
  // Müdürü varsa uyarı yok
  assert.deepEqual(shopIssueKinds({ ...missing, manager: { lowCash: false } }, DAY), []);
  // Müdür tutulamayan seviyede uyarı yok
  assert.deepEqual(shopIssueKinds({ ...missing, level: lvl - 1 }, DAY), []);
  // İlk günlerde uyarı yok
  assert.deepEqual(shopIssueKinds({ ...missing, openedDay: DAY - SHOP_LOSS_GRACE_DAYS + 1 }, DAY), []);
  // Şubelere müdür tutulmaz
  assert.deepEqual(shopIssueKinds({ ...missing, isCompanyBranch: true }, DAY), []);
});

// ---------------------------------------------------------------------------
// Şehir düzeyi: geciken kredi ve dolu depo
// ---------------------------------------------------------------------------

function engineInIzmir(seed = 777301) {
  const eng = new SimulationEngine(seed, 5_000_000);
  assert.equal(eng.chooseStartCity('izmir').success, true);
  return eng;
}

function fakeLoan(status: LoanContract['status']): LoanContract {
  return {
    loanId: `L-${status}`,
    loanType: 'SHORT_TERM_WORKING_CAPITAL' as LoanContract['loanType'],
    borrowerType: 'PLAYER' as LoanContract['borrowerType'],
    borrowerId: 'PLAYER',
    principal: 100_000,
    remainingPrincipal: 80_000,
    accruedInterestUnpaid: 0,
    annualInterestRate: 0.4,
    effectiveInterestRate: 0.4,
    termInGameDays: 180,
    installmentFrequency: 30,
    nextPaymentGameDay: 10,
    installmentAmount: 15_000,
    collateralIds: [],
    originationFee: 0,
    earlyPaymentFee: 0,
    latePaymentRate: 0.1,
    gracePeriod: 3,
    status,
    missedPaymentCount: status === 'ACTIVE' ? 0 : 1,
    creditScoreAtOrigination: 700,
    purpose: 'test',
    createdGameDay: 1,
    lastInterestAccruedDay: 1,
    totalInterestPaid: 0,
    totalPrincipalPaid: 0,
  };
}

test('Geciken kredi merkez şehirde uyarı çıkarır; düzenli ödenen kredi çıkarmaz', () => {
  const eng = engineInIzmir();
  const st = eng.getState();
  st.activeLoans = [fakeLoan('ACTIVE')];
  assert.deepEqual(cityLevelIssueKinds(st, 'izmir'), []);
  st.activeLoans = [fakeLoan('DELINQUENT')];
  assert.deepEqual(cityLevelIssueKinds(st, 'izmir'), ['LOAN_OVERDUE']);
  assert.deepEqual(cityLevelIssueKinds(st, 'ankara'), [], 'yalnızca merkez şehir');
  assert.equal(cityHasIssue(st, 'izmir'), true);
  assert.ok(cityIssueLabels(st, 'izmir').includes(CITY_ISSUE_LABEL_TR.LOAN_OVERDUE));
  // Harita işareti ve "Sorunlu" süzgeci aynı kuralı kullanır
  const marker = buildMapMarkers(st).find((m) => m.cityId === 'izmir')!;
  assert.equal(marker.hasIssue, true);
  assert.equal(cityMatchesFilter(st, 'izmir', 'ISSUES'), true);
});

test('Depo kapasitesi dolu: depo kendi şehrinde, şehri yazılı olmayan depo merkez şehirde uyarı çıkarır', () => {
  const eng = engineInIzmir(777302);
  const st = eng.getState();
  const whs = st.tradeState!.warehouses;
  assert.ok(whs.length > 0, 'oyuncunun deposu var');
  for (const w of whs) w.usedCapacityUnits = 0;
  assert.deepEqual(cityLevelIssueKinds(st, 'izmir'), []);

  const w = whs[0];
  w.cityId = undefined;
  w.usedCapacityUnits = Math.ceil(w.maxCapacityUnits * WAREHOUSE_FULL_SHARE);
  assert.deepEqual(cityLevelIssueKinds(st, 'izmir'), ['WAREHOUSE_FULL'], 'şehirsiz depo = merkez');

  w.cityId = 'mersin';
  assert.deepEqual(cityLevelIssueKinds(st, 'izmir'), []);
  assert.deepEqual(cityLevelIssueKinds(st, 'mersin'), ['WAREHOUSE_FULL']);
  assert.equal(buildMapMarkers(st).find((m) => m.cityId === 'mersin')!.hasIssue, true);

  w.usedCapacityUnits = Math.floor(w.maxCapacityUnits * WAREHOUSE_FULL_SHARE) - 1;
  assert.deepEqual(cityLevelIssueKinds(st, 'mersin'), []);
});

// ---------------------------------------------------------------------------
// Gerçek oyun durumu ve arayüz
// ---------------------------------------------------------------------------

test('Gerçek dükkân: kasa ve cep boşken kira sıkıntısı haritada, panelde ve mağaza ekranında yazar', () => {
  const eng = engineInIzmir(777303);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  eng.advanceDaysWithoutPlayerDecisions(3, true);
  const st = eng.getState();
  const shop = st.tradeState!.shops[0];
  assert.equal(shop.cityId, 'izmir');
  assert.deepEqual(shopIssueKindsInState(st, shop).includes('RENT_SHORT'), false);

  // Kasa boşaldı, cepte de para yok
  shop.cashAccountBalance = 0;
  shop.todayPayrollCost = Math.max(shop.todayPayrollCost, 500);
  const savedCash = st.cash;
  (st as { cash: number }).cash = 0; // yalnızca test: sahte durum (motor yolu değil)
  try {
    assert.ok(shopIssueKindsInState(st, shop).includes('RENT_SHORT'));
    assert.equal(cityHasIssue(st, 'izmir'), true);

    const sheet = renderToStaticMarkup(
      React.createElement(CityInfoSheet, {
        city: CITY_DEFINITIONS.izmir,
        state: st,
        formatCurrency: fmt,
        onClose: noop,
        onGoToCity: noop,
        onOpenShop: noop,
      })
    );
    assert.match(sheet, /data-testid="city-info-issue-list"/);
    assert.ok(sheet.includes(SHOP_ISSUE_LABEL_TR.RENT_SHORT));

    const screen = renderToStaticMarkup(
      React.createElement(CityShopsScreen, {
        cityId: 'izmir',
        state: st,
        formatCurrency: fmt,
        onBackToMap: noop,
        onManageShop: noop,
      })
    );
    assert.ok(screen.includes(SHOP_ISSUE_LABEL_TR.RENT_SHORT));
  } finally {
    (st as { cash: number }).cash = savedCash;
  }
});
