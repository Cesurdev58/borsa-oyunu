import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { NPC_COMPANY_BLUEPRINTS } from '../../data/npcCompanies';
import {
  MARKET_BUY_MAX_OWNERSHIP_PCT,
  NPC_SCALE,
  WEALTH_TAX_ANNUAL_RATE,
  WEALTH_TAX_FREE_AMOUNT,
} from '../../data/gameBalance';
import { progressiveCorporateTax } from '../../engine/TaxRules';
import { refreshPlayerMarketContext } from '../../engine/SectorMarket';
import { ACCOUNT_IDS } from '../../engine/CentralLedgerEngine';
import { DECISION_TEMPLATES, ensureDecisionState } from '../../engine/DecisionEventEngine';
import { growCompanyGreedy } from './companyBot';

test('Şirket pazarı sınırlıdır: hep yatırım yapan şirketin kârı düzleşir, sınırsız katlanmaz', () => {
  const eng = new SimulationEngine(20261104, 2_500_000);
  eng.establishCompany('Test A.Ş.', 'TSTA', 'TEKNOLOJI', 2_000_000, {
    initialStaffCount: 40,
    initialCapacity: 100,
    initialRdBudget: 10_000,
  });
  let profitDay300 = 0;
  for (let d = 1; d <= 1300; d++) {
    growCompanyGreedy(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
    if (d === 300) profitDay300 = eng.getState().playerCompany!.financials.netIncome / 120;
  }
  const pc = eng.getState().playerCompany!;
  const profit = pc.financials.netIncome / 120;
  assert.ok(profitDay300 > 0, 'şirket ilk yıl kâr etmeli');
  assert.ok(profit > profitDay300 * 3, 'şirket büyümeli');
  // Eski dengede bu noktada günlük kâr 12 milyonu geçiyordu
  assert.ok(profit < 2_500_000, `kâr düzleşmeli (şu an ${Math.round(profit)})`);
  assert.equal(pc.operations!.marketSaturated, true);
  assert.ok((pc.operations!.playerMarketSharePct ?? 0) <= 70);
  assert.equal(eng.getState().lastIntegrityAudit.valid, true);
});

test('Rakipler gerçek büyüklükte: hisse fiyatı aynı, şirket değeri ve kapasitesi büyük', () => {
  const eng = new SimulationEngine(20261104, 100_000);
  for (const bp of NPC_COMPANY_BLUEPRINTS) {
    const s = eng.getState().stocks.find((x) => x.ticker === bp.ticker)!;
    assert.equal(s.price, bp.initialPrice);
    assert.equal(s.totalShares, bp.totalShares * NPC_SCALE);
    assert.ok(s.equityValue >= 80_000_000, `${s.ticker} değeri ${s.equityValue}`);
    assert.equal(s.financials.productionCapacityUnits, bp.productionCapacityUnits * NPC_SCALE);
  }
});

test('Aynı sektördeki rakip devralınınca oyuncunun satabileceği pazar büyür', () => {
  const eng = new SimulationEngine(20261104, 400_000_000);
  eng.establishCompany('Test A.Ş.', 'TSTB', 'LOJISTIK', 2_000_000);
  const st = eng.getState();
  refreshPlayerMarketContext(st);
  const before = st.playerCompany!.operations!.rivalUnitsInMarket!;
  const res = eng.executeHostileTakeover('KRGO', { targetOwnershipPct: 51, useDebtFinancing: false });
  assert.equal(res.success, true, res.message);
  refreshPlayerMarketContext(st);
  const after = st.playerCompany!.operations!.rivalUnitsInMarket!;
  assert.ok(after < before * 0.7, `rakip birimi ${before} → ${after}`);
  assert.ok(st.playerCompany!.operations!.controlledRivalUnits! > 0);
  assert.ok(res.estimatedDailySynergyDividend > 0);
});

test('Kademeli kurumlar vergisi: üst dilimler daha yüksek oranla vergilenir', () => {
  assert.equal(progressiveCorporateTax(-5, 0.25), 0);
  assert.equal(progressiveCorporateTax(100_000, 0.25), 25_000);
  const tax = progressiveCorporateTax(1_000_000, 0.25);
  const expected = 150_000 * 0.25 + 450_000 * 0.32 + 400_000 * 0.4;
  assert.ok(Math.abs(tax - expected) < 0.01, `${tax} ≠ ${expected}`);
});

test('Servet vergisi 30 günde bir, eşiğin üstündeki nakit ve hisseden alınır', () => {
  const eng = new SimulationEngine(20261104, 100_000_000);
  const cash0 = eng.getState().cash;
  eng.advanceDaysWithoutPlayerDecisions(30, true);
  const st = eng.getState();
  const expected = (100_000_000 - WEALTH_TAX_FREE_AMOUNT) * WEALTH_TAX_ANNUAL_RATE * (30 / 360);
  assert.ok(st.wealthTax, 'servet vergisi kaydı olmalı');
  assert.ok(Math.abs(st.wealthTax!.totalPaid - expected) < expected * 0.05, `${st.wealthTax!.totalPaid} ≈ ${expected}`);
  assert.ok(st.cash < cash0);
  assert.equal(st.lastIntegrityAudit.valid, true);

  // Küçük oyuncu vergi ödemez
  const small = new SimulationEngine(20261104, 1_000_000);
  small.advanceDaysWithoutPlayerDecisions(30, true);
  assert.equal(small.getState().wealthTax?.totalPaid ?? 0, 0);
});

test('Şirketten sınırsız para çekilemez: maaş günlük sınırlı, sermaye azaltımı konulan sermaye kadar', () => {
  const eng = new SimulationEngine(20261104, 10_000_000);
  eng.establishCompany('Kasa A.Ş.', 'KASA', 'TEKNOLOJI', 5_000_000);
  const bank = ACCOUNT_IDS.companyBank('KASA');
  const big = eng.executeMoneyTransfer({
    sourceAccountId: bank,
    destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    amount: 3_000_000,
    category: 'EXECUTIVE_SALARY',
    description: 'test',
  });
  assert.equal(big.success, false);
  const small = eng.executeMoneyTransfer({
    sourceAccountId: bank,
    destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    amount: 20_000,
    category: 'EXECUTIVE_SALARY',
    description: 'test',
  });
  assert.equal(small.success, true, small.message);
  const again = eng.executeMoneyTransfer({
    sourceAccountId: bank,
    destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    amount: 20_000,
    category: 'BOARD_FEE',
    description: 'test',
  });
  assert.equal(again.success, false, 'aynı gün sınır aşılmamalı');

  const paidIn = eng.getState().playerCompany!.financials.paidInCapital;
  const tooMuch = eng.executeMoneyTransfer({
    sourceAccountId: bank,
    destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    amount: paidIn,
    category: 'CAPITAL_REDUCTION',
    description: 'test',
  });
  assert.equal(tooMuch.success, false);
});

test('Borsadan bir rakibin en fazla %30u alınabilir; kontrol için devralma gerekir', () => {
  const eng = new SimulationEngine(20261104, 80_000_000);
  const krgo = eng.getState().stocks.find((s) => s.ticker === 'KRGO')!;
  const over = eng.buyStock('KRGO', Math.ceil(krgo.totalShares * 0.31));
  assert.equal(over.success, false);
  assert.ok(over.message.includes(`%${MARKET_BUY_MAX_OWNERSHIP_PCT}`));
  const ok = eng.buyStock('KRGO', Math.floor(krgo.totalShares * 0.2));
  assert.equal(ok.success, true, ok.message);
  assert.equal(krgo.isControlledByPlayer, false);
});

test('Şirketi olmayan oyuncunun bireysel kredisi şirket kredisinden pahalıdır', () => {
  const personal = new SimulationEngine(20261104, 3_000_000);
  const company = new SimulationEngine(20261104, 3_000_000);
  company.establishCompany('Kredi A.Ş.', 'KRDT', 'TEKNOLOJI', 2_000_000);
  const qp = personal.getLoanOfferQuote({ loanType: 'WORKING_CAPITAL', requestedPrincipal: 200_000 });
  const qc = company.getLoanOfferQuote({ loanType: 'WORKING_CAPITAL', requestedPrincipal: 200_000 });
  assert.ok(qp.annualInterestRate > qc.annualInterestRate + 0.1, `${qp.annualInterestRate} vs ${qc.annualInterestRate}`);
});

test('Aynı türden çok dükkân müşteriyi paylaşır', () => {
  const one = new SimulationEngine(20261104, 5_000_000);
  one.openShop({ shopType: 'BUFE' });
  const many = new SimulationEngine(20261104, 5_000_000);
  for (let i = 0; i < 4; i++) many.openShop({ shopType: 'BUFE' });
  for (let d = 0; d < 3; d++) {
    one.advanceDaysWithoutPlayerDecisions(1, true);
    many.advanceDaysWithoutPlayerDecisions(1, true);
  }
  const single = one.getState().tradeState!.shops[0].todayWalkInCustomers;
  const crowded = many.getState().tradeState!.shops[0].todayWalkInCustomers;
  assert.ok(crowded < single * 0.75, `${crowded} < ${single}`);
});

test('Cevapsız karar kartı süresi dolunca ikinci seçenek kendiliğinden uygulanır', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  eng.openShop({ shopType: 'KAFE' });
  const state = eng.getState();
  const shop = state.tradeState!.shops[0];
  const ds = ensureDecisionState(state);
  const tpl = DECISION_TEMPLATES.find((t) => t.id === 'pipe-burst')!;
  const built = tpl.build({ state, shop, S: 1000, P: 1000 });
  ds.pending = { ...built, eventId: 'T-EXP', templateId: tpl.id, day: state.day, expiresDay: state.day, shopId: shop.shopId };
  ds.lastEventDay = state.day + 100; // yeni kart çıkmasın
  eng.tickDay();
  const h = ds.history[ds.history.length - 1];
  assert.equal(h.choiceId, 'EXPIRED');
  assert.ok(h.resultTR.includes('sayıldı'), h.resultTR);
  assert.equal(shop.demandBoost?.multiplier, 0.6);
});

test('Eski kayıt yeni dengeye taşınır: rakipler büyür, eldeki hissenin değeri değişmez, ucuza devralınan rakip iade edilir', () => {
  const eng = new SimulationEngine(20261104, 20_000_000);
  eng.buyStock('NVEX', 1000);
  const old = JSON.parse(JSON.stringify(eng.getState()));
  // Eski kayıt gibi: rakipleri küçült, sürüm alanını sil
  for (const s of old.stocks) {
    if (s.isPlayerCompany) continue;
    s.totalShares = s.totalShares / NPC_SCALE;
    for (const k of Object.keys(s.financials)) {
      if (typeof s.financials[k] === 'number' && !['dividendPerShare', 'dividendPayoutRatio', 'unitSellingPrice', 'unitProductionCost'].includes(k)) {
        s.financials[k] = s.financials[k] / NPC_SCALE;
      }
    }
  }
  delete old.balanceVersion;
  // KRGO eskiden ucuza devralınmış olsun
  const krgo = old.stocks.find((s: { ticker: string }) => s.ticker === 'KRGO');
  krgo.isControlledByPlayer = true;
  old.controlledSubsidiaries = ['KRGO'];
  old.portfolio.KRGO = { ticker: 'KRGO', shares: Math.ceil(krgo.totalShares * 0.51), averageCost: 50, totalDividendCollected: 0, lastPurchaseDay: 1 };
  const nvexValueBefore = old.portfolio.NVEX.shares * old.stocks.find((s: { ticker: string }) => s.ticker === 'NVEX').price;

  const restored = new SimulationEngine(1, 100_000);
  const cashBefore = old.cash;
  restored.restoreFromSavedState(old);
  const st = restored.getState();
  assert.equal(st.balanceVersion, 2);
  const nvex = st.stocks.find((s) => s.ticker === 'NVEX')!;
  assert.equal(nvex.totalShares, 50_000 * NPC_SCALE);
  assert.equal(st.portfolio.NVEX.shares * nvex.price, nvexValueBefore);
  const k2 = st.stocks.find((s) => s.ticker === 'KRGO')!;
  assert.equal(k2.isControlledByPlayer, false);
  assert.equal(st.controlledSubsidiaries.includes('KRGO'), false);
  assert.ok(st.cash > cashBefore, 'devralma bedeli iade edilmeli');
  assert.ok(restored.consumeMigrationNotices().length > 0);

  // İkinci yükleme tekrar büyütmez
  const again = new SimulationEngine(1, 100_000);
  again.restoreFromSavedState(JSON.parse(JSON.stringify(st)));
  assert.equal(again.getState().stocks.find((s) => s.ticker === 'NVEX')!.totalShares, 50_000 * NPC_SCALE);
});

test('Eski dengede dev olmuş şirket yüklenince pazara göre küçültülür ve zarar etmez', () => {
  const eng = new SimulationEngine(20261104, 5_000_000);
  eng.establishCompany('Dev A.Ş.', 'DEVA', 'TEKNOLOJI', 3_000_000);
  const old = JSON.parse(JSON.stringify(eng.getState()));
  const pc = old.playerCompany;
  pc.productionCapacity = 120_000;
  pc.staffCount = 30_000;
  pc.financials.staffCount = 30_000;
  pc.operations.actualProduction = 50_000;
  pc.operations.actualSalesUnits = 50_000;
  pc.financials.cash = 200_000_000;
  delete old.balanceVersion;
  const restored = new SimulationEngine(1, 100_000);
  restored.restoreFromSavedState(old);
  const after = restored.getState().playerCompany!;
  assert.ok(after.staffCount < 10_000, `personel ${after.staffCount}`);
  assert.ok(restored.consumeMigrationNotices().some((m) => m.includes('indirildi')));
});
