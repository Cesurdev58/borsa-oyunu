import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import { ACCOUNT_IDS } from '../../engine/CentralLedgerEngine';
import { BankLoanEngine } from '../../engine/BankLoanEngine';
import { CompanyEngine } from '../../engine/CompanyEngine';
import { GameClockEngine } from '../../engine/GameClockEngine';

test('A.1 - A.8: Merkezi Muhasebe Defteri, Transfer Kuralları, Bloke Bakiye, Idempotency ve FinancialIntegrityAudit Testleri', () => {
  const engine = new SimulationEngine(20261105, 3_500_000);
  const est = engine.establishCompany(
    'Anadolu Hassas Makine A.Ş.',
    'AHMK',
    'TEKNOLOJI',
    1_500_000,
    {
      initialStaffCount: 30,
      initialCapacity: 80,
      initialRdBudget: 12_000,
    }
  );
  assert.equal(est.success, true);

  // چند gün çalıştırarak şirketin pozitif kâr üretmesini sağla
  for (let i = 0; i < 6; i++) {
    engine.tickDay();
  }

  const stateBefore = engine.getState();
  const totalCashBefore =
    (stateBefore.personalCash ?? 0) +
    (stateBefore.investmentCash ?? 0) +
    (stateBefore.holdingCash ?? 0) +
    (stateBefore.playerCompany?.financials.cash ?? 0);

  // 1. Kişisel nakitten yatırım hesabına ve yatırım hesabından şirkete sermaye artırımı transferinde para korunumu
  const xfer1 = engine.executeMoneyTransfer({
    sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    destinationAccountId: ACCOUNT_IDS.PLAYER_PERSONAL,
    amount: 250_000,
    category: 'INVESTMENT_TO_PERSONAL',
    description: 'Yatırım hesabından kişisel hesaba aktarım',
    idempotencyKey: 'TEST-IDEM-XFER-001',
  });
  assert.equal(xfer1.success, true);

  const stateAfterXfer1 = engine.getState();
  const totalCashAfterXfer1 =
    (stateAfterXfer1.personalCash ?? 0) +
    (stateAfterXfer1.investmentCash ?? 0) +
    (stateAfterXfer1.holdingCash ?? 0) +
    (stateAfterXfer1.playerCompany?.financials.cash ?? 0);
  assert.ok(
    Math.abs(totalCashAfterXfer1 - totalCashBefore) < 0.05,
    'Hesaplar arası transferde toplam para arzı korunmalıdır (karşılıksız para oluşmamalıdır)'
  );

  // 6. Aynı idempotencyKey iki kez uygulanamaz
  const duplicateXfer = engine.executeMoneyTransfer({
    sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    destinationAccountId: ACCOUNT_IDS.PLAYER_PERSONAL,
    amount: 250_000,
    category: 'INVESTMENT_TO_PERSONAL',
    description: 'Tekrarlanan transfer denemesi',
    idempotencyKey: 'TEST-IDEM-XFER-001',
  });
  assert.equal(duplicateXfer.success, false);
  assert.equal(
    engine.getState().personalCash,
    stateAfterXfer1.personalCash,
    'Duplicate idempotencyKey bakiyeyi değiştirmemelidir'
  );
  assert.ok(
    (engine.getState().centralLedger?.duplicateIdempotencyAttempts ?? 0) >= 1
  );

  // 2 & 3. Başarısız transfer (yetersiz bakiye veya negatif tutar) bakiyeyi değiştirmez ve negatif bakiye oluşturmaz
  const personalBeforeFail = engine.getState().personalCash ?? 0;
  const failXfer = engine.executeMoneyTransfer({
    sourceAccountId: ACCOUNT_IDS.PLAYER_PERSONAL,
    destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    amount: personalBeforeFail + 9_000_000,
    category: 'PERSONAL_TO_INVESTMENT',
    description: 'Bakiye aşımı denemesi',
  });
  assert.equal(failXfer.success, false);
  assert.equal(engine.getState().personalCash, personalBeforeFail);
  assert.ok((engine.getState().personalCash ?? 0) >= 0);

  // 4. Bloke bakiye (bekleyen alış emri için ayrılan nakit) transfer edilemez
  const targetStock = engine.getState().stocks[0];
  const orderRes = engine.placeOrder({
    ticker: targetStock.ticker,
    orderType: 'LIMIT_BUY',
    requestedShares: 500,
    limitPrice: Number((targetStock.price * 0.7).toFixed(2)), // Piyasa fiyatının %30 altında limit alış emri -> PENDING kalır ve nakit bloke eder
  });
  assert.equal(orderRes.success, true);
  assert.equal(orderRes.order?.status, 'PENDING');
  const reservedCash = engine.getReservedCash();
  assert.ok(reservedCash > 0, 'Bekleyen alış emri nakit bloke etmelidir');

  const safeCheck = engine.getMaxSafeTransferAmount(
    ACCOUNT_IDS.PLAYER_INVESTMENT
  );
  assert.equal(safeCheck.reservedAmount, reservedCash);
  assert.ok(
    safeCheck.maxSafeTransferable <=
      safeCheck.rawBalance - safeCheck.reservedAmount + 0.01
  );

  const blockedAttempt = engine.executeMoneyTransfer({
    sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
    destinationAccountId: ACCOUNT_IDS.PLAYER_PERSONAL,
    amount: safeCheck.rawBalance, // Bloke nakdi de içeren tam bakiyeyi çekmeye çalış
    category: 'INVESTMENT_TO_PERSONAL',
    description: 'Bloke nakit çekim denemesi',
  });
  assert.equal(
    blockedAttempt.success,
    false,
    'Bloke edilmiş emir nakdi transfer edilememelidir'
  );

  // Bekleyen emri iptal et
  if (orderRes.order) {
    engine.cancelOrder(orderRes.order.id);
  }

  // 5. Şirket kasası geçerli kurumsal kategori olmadan kişisel hesaba çekilemez
  const companyBankId = ACCOUNT_IDS.companyBank('AHMK');
  const illegalWithdrawal = engine.executeMoneyTransfer({
    sourceAccountId: companyBankId,
    destinationAccountId: ACCOUNT_IDS.PLAYER_PERSONAL,
    amount: 50_000,
    category: 'PERSONAL_TO_INVESTMENT', // Şirketten kişisel hesaba geçersiz kategori!
    description: 'Serbest para çekme denemesi',
  });
  assert.equal(
    illegalWithdrawal.success,
    false,
    'Şirket kasasından geçersiz kategoriyle kişisel hesaba para çekilememelidir'
  );

  // Geçerli kategori (EXECUTIVE_SALARY) ile tavan dahilinde ve gelir vergisi kesilerek aktarım
  const legalSalary = engine.executeMoneyTransfer({
    sourceAccountId: companyBankId,
    destinationAccountId: ACCOUNT_IDS.PLAYER_PERSONAL,
    amount: 15_000,
    category: 'EXECUTIVE_SALARY',
    description: 'Aylık yönetici maaşı ödemesi',
  });
  assert.equal(legalSalary.success, true);
  assert.ok(legalSalary.taxWithheld > 0, 'Yönetici maaşından vergi kesilmelidir');
  assert.equal(
    Number((legalSalary.netAmountTransferred + legalSalary.taxWithheld).toFixed(2)),
    15_000
  );

  // 7 & 8. Defter kayıtları ve FinancialIntegrityAudit doğrulaması
  const nonMutatingAudit = engine.runFinancialIntegrityAuditNonMutating();
  assert.equal(nonMutatingAudit.accountingAudit.valid, true);
  assert.equal(nonMutatingAudit.financialIntegrityReport.valid, true);
  assert.equal(
    nonMutatingAudit.financialIntegrityReport.unbackedLoanErrors.length,
    0
  );
  assert.equal(
    nonMutatingAudit.financialIntegrityReport.negativeAccounts.length,
    0
  );
});

test('B.1 - B.8: Üretim Kapasite Tavanı, Eski 7.48x Çarpan Migrasyonu, Talep=0, Depo Doluluğu, Fiyat Elastikiyeti ve 1x/2x Hız Eşdeğerliği', () => {
  // B.3: Eski kayıttaki 7.48x teknoloji çarpanının güvenli [1.00, 2.50] aralığına deterministik migrasyonu
  const migrated = CompanyEngine.migrateLegacyTechMultiplier(7.48);
  assert.equal(migrated.wasMigrated, true);
  assert.equal(migrated.originalValue, 7.48);
  assert.ok(
    migrated.safeMultiplier >= 1.0 && migrated.safeMultiplier <= 2.5,
    `Migrate edilen çarpan (${migrated.safeMultiplier}) [1.00, 2.50] aralığında olmalıdır`
  );

  // Eski v4 kaydını (Gün 486, Kapasite 16.360, Üretim 67.288, Teknoloji 7.48x) SimulationStore üzerinden migrate et
  const engineForSave = new SimulationEngine(486001, 5_000_000);
  engineForSave.establishCompany(
    'Bozuk Çarpan Sanayi A.Ş.',
    'BZKS',
    'TEKNOLOJI',
    2_500_000,
    {
      initialStaffCount: 150,
      initialCapacity: 16_360,
      initialRdBudget: 50_000,
    }
  );
  const rawLegacyState = JSON.parse(engineForSave.serializeState());
  rawLegacyState.schemaVersion = 4;
  rawLegacyState.day = 486;
  rawLegacyState.playerCompany.techQualityMultiplier = 7.48;
  rawLegacyState.playerCompany.productionCapacity = 16_360;
  rawLegacyState.playerCompany.dailyUnitsProduced = 67_288;
  rawLegacyState.playerCompany.financials.productionCapacityUnits = 16_360;
  rawLegacyState.playerCompany.financials.dailyUnitsProduced = 67_288;
  delete rawLegacyState.playerCompany.operations;
  delete rawLegacyState.centralLedger;

  const migratedEnvelope = SimulationStore.migrateIfNeeded({
    schemaVersion: 4,
    savedAtISO: '2026-11-05T10:00:00.000Z',
    seed: rawLegacyState.seed,
    randomState: rawLegacyState.randomState,
    state: rawLegacyState,
  });
  assert.ok(
    migratedEnvelope,
    'Eski v4 kaydı başarıyla yüklenip v5 şemasına migrate edilmelidir'
  );
  const loadedMig = migratedEnvelope.state;
  assert.equal(loadedMig.schemaVersion, 5);
  assert.ok(loadedMig.playerCompany);
  assert.ok(loadedMig.playerCompany.techQualityMultiplier <= 2.5);
  assert.ok(
    loadedMig.playerCompany.dailyUnitsProduced <=
      loadedMig.playerCompany.productionCapacity,
    'Migrate edilen kayıtta günlük üretim kurulu kapasiteyi aşamaz'
  );
  assert.equal(
    loadedMig.playerCompany.operations?.migratedLegacyTechMultiplier,
    7.48
  );

  // B.1 & B.2: actualProduction <= effectiveCapacity <= installedCapacity ve technologyMultiplier <= 2.50
  const engine = new SimulationEngine(20261106, 4_000_000);
  engine.establishCompany(
    'Marmara Endüstri A.Ş.',
    'MREN',
    'SAVUNMA',
    1_800_000,
    {
      initialStaffCount: 60,
      initialCapacity: 100,
      initialRdBudget: 100_000, // Çok yüksek Ar-Ge bütçesiyle dahi 2.50x tavanı aşılmamalı
    }
  );

  for (let d = 0; d < 40; d++) {
    engine.tickDay();
    const pc = engine.getState().playerCompany!;
    const ops = pc.operations!;
    assert.ok(
      ops.technologyMultiplier >= 1.0 && ops.technologyMultiplier <= 2.5,
      'Teknoloji çarpanı [1.00, 2.50] sınırını aşamaz'
    );
    assert.ok(
      ops.effectiveCapacity <= ops.installedCapacity,
      `Etkin kapasite (${ops.effectiveCapacity}) kurulu kapasiteyi (${ops.installedCapacity}) aşamaz`
    );
    assert.ok(
      ops.actualProduction <= ops.effectiveCapacity + 0.01 &&
        ops.actualProduction <= ops.installedCapacity + 0.01,
      `Fiili üretim (${ops.actualProduction}) etkin/kurulu kapasiteyi aşamaz`
    );
  }

  // B.4 & B.7: marketDemand = 0 iken satış 0 olur, üretilen ürün stoğa gider ve stok satılmadan nakit yaratmaz
  const demandZeroEngine = new SimulationEngine(20261107, 3_000_000);
  demandZeroEngine.establishCompany(
    'Sıfır Talep Test A.Ş.',
    'STTA',
    'PERAKENDE',
    1_200_000,
    {
      initialStaffCount: 35,
      initialCapacity: 80,
      initialRdBudget: 5_000,
    }
  );
  const pcZero = demandZeroEngine.getState().playerCompany!;
  const invBeforeZero = pcZero.financials.inventoryUnits;
  const cashBeforeZero = pcZero.financials.cash;
  pcZero.operations!.marketDemand = 0;

  CompanyEngine.stepPlayerCompanyOneDay(pcZero, demandZeroEngine.getState().macro, 0, 0);
  assert.equal(
    pcZero.operations!.actualSalesUnits,
    0,
    'marketDemand = 0 iken satış 0 olmalıdır'
  );
  assert.equal(pcZero.financials.revenue, 0, 'Satış 0 iken ciro 0 olmalıdır');
  assert.ok(
    pcZero.financials.inventoryUnits > invBeforeZero,
    'Satılamayan üretim stoğa eklenmelidir'
  );
  assert.ok(
    pcZero.financials.cash <= cashBeforeZero,
    'Stok satılmadan nakit yaratmamalıdır'
  );

  // B.5: Depo doluysa üretim durur
  pcZero.financials.inventoryUnits = pcZero.operations!.maximumStorageUnits;
  pcZero.operations!.inventoryUnits = pcZero.operations!.maximumStorageUnits;
  CompanyEngine.stepPlayerCompanyOneDay(pcZero, demandZeroEngine.getState().macro, 0, 0);
  assert.equal(
    pcZero.operations!.actualProduction,
    0,
    'Depo tamamen doluyken fiili üretim 0 olmalıdır'
  );

  // B.6: Aşırı pahalı ürünün (rakip fiyatının 3 katı) satışı normal fiyatlı ürüne göre ciddi biçimde düşer
  const normalPriceEngine = new SimulationEngine(20261108, 3_000_000);
  normalPriceEngine.establishCompany('Normal Fiyat A.Ş.', 'NRML', 'ENERJI', 1_200_000, {
    initialStaffCount: 40,
    initialCapacity: 100,
    initialRdBudget: 5_000,
  });
  const highPriceEngine = SimulationEngine.deserializeState(
    normalPriceEngine.serializeState()
  );

  normalPriceEngine.tickDay();
  const normalSales =
    normalPriceEngine.getState().playerCompany!.operations!.actualSalesUnits;

  highPriceEngine.configureCompanyOperations({
    unitSalePrice:
      highPriceEngine.getState().playerCompany!.operations!.competitorAveragePrice * 3.0,
  });
  highPriceEngine.tickDay();
  const highPriceSales =
    highPriceEngine.getState().playerCompany!.operations!.actualSalesUnits;

  assert.ok(
    highPriceSales < normalSales * 0.35,
    `3x fahiş fiyatlı ürün satışı (${highPriceSales}) normal satışın (${normalSales}) çok altında olmalıdır`
  );

  // B.7 (ikinci kısım): Aynı oyun dakikası iki kez üretim oluşturmaz
  const pcSameMin = normalPriceEngine.getState().playerCompany!;
  const step1 = CompanyEngine.stepPlayerCompanyIntraday(
    pcSameMin,
    normalPriceEngine.getState().macro,
    0,
    5 / 1440,
    2500
  );
  assert.ok(step1.unitsProducedDelta > 0);
  const step2DuplicateMinute = CompanyEngine.stepPlayerCompanyIntraday(
    pcSameMin,
    normalPriceEngine.getState().macro,
    0,
    5 / 1440,
    2500 // Aynı totalElapsedGameMinutes!
  );
  assert.equal(
    step2DuplicateMinute.unitsProducedDelta,
    0,
    'Aynı oyun dakikası iki kez üretim oluşturmamalıdır'
  );

  // B.8: 1x ve 2x hızlarda 1 tam oyun günü ilerletildiğinde ekonomik sonuçlar eşdeğerdir
  const baseSpeedEngine = new SimulationEngine(20261109, 3_000_000);
  baseSpeedEngine.establishCompany('Hız Eşdeğerlik A.Ş.', 'HZES', 'LOJISTIK', 1_200_000, {
    initialStaffCount: 35,
    initialCapacity: 80,
    initialRdBudget: 8_000,
  });

  const engine1x = SimulationEngine.deserializeState(baseSpeedEngine.serializeState());
  const engine2x = SimulationEngine.deserializeState(baseSpeedEngine.serializeState());

  engine1x.setTimeScale(1);
  engine2x.setTimeScale(2);

  const realSecondsFor1DayAt1x =
    engine1x.getState().realMinutesPerGameDay * 60;
  engine1x.advanceRealSeconds(realSecondsFor1DayAt1x);
  engine2x.advanceRealSeconds(realSecondsFor1DayAt1x / 2);

  assert.equal(engine1x.getState().day, 2);
  assert.equal(engine2x.getState().day, 2);

  assert.equal(
    engine1x.getState().playerCompany!.financials.revenue,
    engine2x.getState().playerCompany!.financials.revenue
  );
  assert.equal(
    engine1x.getState().playerCompany!.financials.EBITDA,
    engine2x.getState().playerCompany!.financials.EBITDA
  );
});

test('C.1 - C.10: Banka ve Kredi Altyapısı, Tekil Günlük Faiz, Teminat Kilidi, Gecikme ve Grup İçi Skor Koruması', () => {
  const engine = new SimulationEngine(20261110, 3_500_000);
  engine.establishCompany(
    'Kredi Test Sanayi A.Ş.',
    'KRTS',
    'TEKNOLOJI',
    1_500_000,
    {
      initialStaffCount: 35,
      initialCapacity: 90,
      initialRdBudget: 10_000,
    }
  );

  // Birkaç lot hisse al ki teminat havuzunda hisse pozisyonu da bulunsun
  const sampleStock = engine.getState().stocks[0];
  engine.buyStock(sampleStock.ticker, 200);

  const stateBeforeLoan = engine.getState();
  const companyCashBefore = stateBeforeLoan.playerCompany!.financials.cash;
  const companyDebtBefore = stateBeforeLoan.playerCompany!.financials.totalLiabilities;
  const companyRevenueBefore = stateBeforeLoan.playerCompany!.financials.revenue;
  const companyEbitdaBefore = stateBeforeLoan.playerCompany!.financials.EBITDA;
  const companyEquityBefore =
    stateBeforeLoan.playerCompany!.financials.shareholdersEquity;

  // C.10: Grup içi para dolaşımıyla yapay kredi skoru üretilemez
  const scoreBeforeTransfers = engine.getState().playerCompany!.creditScore;
  for (let i = 0; i < 5; i++) {
    engine.executeMoneyTransfer({
      sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      destinationAccountId: ACCOUNT_IDS.PLAYER_PERSONAL,
      amount: 50_000,
      category: 'INVESTMENT_TO_PERSONAL',
      description: `İç transfer ${i}`,
    });
    engine.executeMoneyTransfer({
      sourceAccountId: ACCOUNT_IDS.PLAYER_PERSONAL,
      destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      amount: 50_000,
      category: 'PERSONAL_TO_INVESTMENT',
      description: `İç transfer geri ${i}`,
    });
  }
  const scoreAfterTransfers = engine.getState().playerCompany!.creditScore;
  assert.equal(
    scoreAfterTransfers,
    scoreBeforeTransfers,
    'Grup içi para transferleri kredi skorunu yapay olarak artırmamalıdır'
  );

  // C.1, C.2, C.3: Kredi nakit ve borcu eşit artırır (masraf düşülür), gelir/FAVÖK sayılmaz
  const stockColId = `COL-STOCK-${sampleStock.ticker}`;
  const loanPrincipal = 300_000;
  const loanRes = engine.takeOutBankLoan({
    loanType: 'MACHINE_EQUIPMENT',
    principal: loanPrincipal,
    termInGameDays: 90,
    collateralIds: [stockColId],
    idempotencyKey: 'LOAN-TEST-001',
  });
  assert.equal(loanRes.success, true);
  assert.ok(loanRes.loan);

  const stateAfterLoan = engine.getState();
  const originationFee = loanRes.loan.originationFee;
  assert.ok(originationFee > 0, 'Dosya masrafı sıfırdan büyük olmalıdır');

  assert.equal(
    Number(
      (
        stateAfterLoan.playerCompany!.financials.cash - companyCashBefore
      ).toFixed(2)
    ),
    Number((loanPrincipal - originationFee).toFixed(2)),
    'Şirket kasası anapara eksi dosya masrafı kadar artmalıdır'
  );
  assert.equal(
    Number(
      (
        stateAfterLoan.playerCompany!.financials.totalLiabilities -
        companyDebtBefore
      ).toFixed(2)
    ),
    loanPrincipal,
    'Şirket borcu tam olarak kredi anaparası kadar artmalıdır'
  );
  assert.equal(
    stateAfterLoan.playerCompany!.financials.revenue,
    companyRevenueBefore,
    'Alınan kredi ciro (revenue) olarak yazılamaz'
  );
  assert.equal(
    stateAfterLoan.playerCompany!.financials.EBITDA,
    companyEbitdaBefore,
    'Alınan kredi FAVÖK olarak yazılamaz'
  );
  assert.equal(
    Number(
      (
        companyEquityBefore -
        stateAfterLoan.playerCompany!.financials.shareholdersEquity
      ).toFixed(2)
    ),
    originationFee,
    'Kredi kullanımı özkaynağı artırmaz; yalnızca dosya masrafı kadar azaltır'
  );

  // C.9: Aynı teminat iki kredide kullanılamaz ve teminatlı hisse kredi kapanmadan satılamaz
  const secondLoanSameCollateral = engine.takeOutBankLoan({
    loanType: 'COMMERCIAL_VEHICLE_LOGISTICS',
    principal: 100_000,
    termInGameDays: 90,
    collateralIds: [stockColId],
  });
  assert.equal(
    secondLoanSameCollateral.success,
    false,
    'Aynı teminat aynı anda iki krediye bağlanamaz'
  );

  const sellPledgedStock = engine.sellStock(sampleStock.ticker, 50);
  assert.equal(
    sellPledgedStock.success,
    false,
    'Teminat olarak rehinli hisse senedi kredi kapanmadan satılamaz'
  );

  // C.4: Günlük faiz aynı oyun gününde yalnızca bir kez işler
  engine.tickDay();
  const loanAfterDay1 = (engine.getState().activeLoans ?? []).find(
    (l) => l.loanId === loanRes.loan!.loanId
  )!;
  const accruedDay1 = loanAfterDay1.accruedInterestUnpaid;
  assert.ok(accruedDay1 > 0, '1 gün sonra günlük faiz tahakkuk etmelidir');

  // Aynı oyun gününde stepDailyLoansAndInterest tekrar çağrılırsa faiz ikinci kez işlememeli
  BankLoanEngine.stepDailyLoansAndInterest(
    engine.getState(),
    engine.getReservedCash()
  );
  const loanAfterDuplicateClose = (engine.getState().activeLoans ?? []).find(
    (l) => l.loanId === loanRes.loan!.loanId
  )!;
  assert.equal(
    loanAfterDuplicateClose.accruedInterestUnpaid,
    accruedDay1,
    'Aynı oyun gününde faiz iki kez tahakkuk etmemelidir'
  );

  // C.5: Taksit ödemesi anapara ve faizi düşürür
  const payInst = engine.payLoanInstallment(loanRes.loan.loanId);
  assert.equal(payInst.success, true);
  assert.ok(payInst.principalReduced > 0);
  assert.ok(payInst.interestPaid > 0);

  // C.6 & C.7: Erken ödeme borcu kapatır, teminatı serbest bırakır ve kapanmış krediden tekrar tahsilat yapılmaz
  const earlyPayoff = engine.payOffLoanEarly(loanRes.loan.loanId);
  assert.equal(earlyPayoff.success, true);
  const closedLoan = (engine.getState().activeLoans ?? []).find(
    (l) => l.loanId === loanRes.loan!.loanId
  )!;
  assert.equal(closedLoan.status, 'PAID_OFF');
  assert.equal(closedLoan.remainingPrincipal, 0);

  // Teminat serbest kaldığı için hisse artık satılabilir
  const sellReleasedStock = engine.sellStock(sampleStock.ticker, 50);
  assert.equal(
    sellReleasedStock.success,
    true,
    'Kredi kapandıktan sonra serbest kalan teminat hissesi satılabilmelidir'
  );

  // Kapanmış krediden tekrar tahsilat yapılamaz
  const chargeClosedLoan = engine.payLoanInstallment(loanRes.loan.loanId);
  assert.equal(
    chargeClosedLoan.success,
    false,
    'Kapanmış krediden tekrar tahsilat yapılamaz'
  );

  // C.8: Yetersiz bakiyede gecikme oluşur ve kredi notu düşer
  const delinqLoanRes = engine.takeOutBankLoan({
    loanType: 'WORKING_CAPITAL',
    principal: 200_000,
    termInGameDays: 90,
  });
  assert.equal(delinqLoanRes.success, true);
  const scoreBeforeDelinq = engine.getState().playerCompany!.creditScore ?? 75;

  // Şirket kasasını sıfıra yaklaştırarak taksit ödeyememesini simüle et
  engine.getState().playerCompany!.financials.cash = 100;
  engine.getState().playerCompany!.capitalCash = 100;
  const failedInstallment = engine.payLoanInstallment(
    delinqLoanRes.loan!.loanId
  );
  assert.equal(failedInstallment.success, false);
  const delinqLoan = (engine.getState().activeLoans ?? []).find(
    (l) => l.loanId === delinqLoanRes.loan!.loanId
  )!;
  assert.equal(delinqLoan.status, 'DELINQUENT');
  assert.ok(
    (engine.getState().playerCompany!.creditScore ?? 75) < scoreBeforeDelinq,
    'Taksit gecikmesinde kredi notu düşmelidir'
  );
});

test('D.1 - D.6: Ölçeklenebilir Yatırım Paketleri, İnşaat Süresi, Bütçe Tamponu, İptal İadesi ve Personel/Vardiya Sistemi', () => {
  const engine = new SimulationEngine(20261111, 5_000_000);
  engine.establishCompany(
    'Yatırım ve Ölçek A.Ş.',
    'YTOL',
    'BIYOTEKNOLOJI',
    2_200_000,
    {
      initialStaffCount: 40,
      initialCapacity: 80,
      initialRdBudget: 15_000,
    }
  );

  // D.2: Maliyet şirket büyüdükçe doğrusal olmayan (non-linear) şekilde artar
  const quoteAtSmallScale = engine.getInvestmentProjectQuote({
    packageType: 'CUSTOM_TARGET',
    customCapacityGain: 50,
  })!;
  const unitCostAtSmallScale =
    quoteAtSmallScale.totalCost / quoteAtSmallScale.capacityGainUnits;

  // Kapasiteyi 500'e çıkarıp aynı +50 birimlik yatırımın birim maliyetini ölç
  engine.getState().playerCompany!.productionCapacity = 500;
  const quoteAtLargeScale = engine.getInvestmentProjectQuote({
    packageType: 'CUSTOM_TARGET',
    customCapacityGain: 50,
  })!;
  const unitCostAtLargeScale =
    quoteAtLargeScale.totalCost / quoteAtLargeScale.capacityGainUnits;

  assert.ok(
    unitCostAtLargeScale > unitCostAtSmallScale,
    `Büyük ölçekteki birim yatırım maliyeti (${unitCostAtLargeScale}) küçük ölçektekinden (${unitCostAtSmallScale}) yüksek olmalıdır`
  );
  engine.getState().playerCompany!.productionCapacity = 80;

  // D.3: Bütçeye göre maksimum seçeneği şirketi zorunlu ödemeler için nakitsiz bırakmaz
  const budgetMaxRes = engine.startCompanyInvestmentProject({
    packageType: 'BUDGET_MAX',
    budgetMaxMode: true,
  });
  assert.equal(budgetMaxRes.success, true);
  assert.ok(
    engine.getState().playerCompany!.financials.cash >= 25_000,
    'BUDGET_MAX yatırımından sonra şirket kasasında zorunlu işletme sermayesi tamponu kalmalıdır'
  );

  // D.4: Yatırım iptali doğru geri ödeme yapar (bedava para üretmez, iptal cezası kesilir)
  const cashBeforeCancel = engine.getState().playerCompany!.financials.cash;
  const projectCost = budgetMaxRes.project!.paidAmount;
  const cancelRes = engine.cancelCompanyInvestmentProject(
    budgetMaxRes.project!.projectId
  );
  assert.equal(cancelRes.success, true);
  assert.ok(cancelRes.cancellationPenalty > 0);
  assert.equal(
    Number((cancelRes.refundedAmount + cancelRes.cancellationPenalty).toFixed(2)),
    projectCost,
    'İptal iadesi + ceza tam olarak ödenen proje bedeline eşit olmalıdır (bedava para üretilemez)'
  );
  assert.equal(
    Number(
      (
        engine.getState().playerCompany!.financials.cash - cashBeforeCancel
      ).toFixed(2)
    ),
    cancelRes.refundedAmount
  );

  // D.1: Yatırım inşaat bitmeden kapasite eklemez; inşaat tamamlandığında ekler
  const capBeforeProj = engine.getState().playerCompany!.productionCapacity;
  const startSmall = engine.startCompanyInvestmentProject({
    packageType: 'SMALL_EXPANSION',
  });
  assert.equal(startSmall.success, true);
  const gainExpected = startSmall.project!.capacityGainUnits;
  assert.equal(
    engine.getState().playerCompany!.productionCapacity,
    capBeforeProj,
    'İnşaat başlamasıyla aynı gün kapasite hemen artmamalıdır'
  );

  // 2 gün ilerlet (SMALL_EXPANSION 5 gün sürer)
  engine.tickDay();
  engine.tickDay();
  assert.equal(
    engine.getState().playerCompany!.productionCapacity,
    capBeforeProj,
    'İnşaat devam ederken kapasite henüz eklenmemelidir'
  );

  // Kalan 3 günü tamamla
  for (let i = 0; i < 4; i++) {
    engine.tickDay();
  }
  assert.equal(
    engine.getState().playerCompany!.productionCapacity,
    capBeforeProj + gainExpected,
    'İnşaat %100 tamamlandığında kurulu kapasite artmalıdır'
  );

  // D.5 & D.6: Personel alımı maaş giderini artırır ve verimlilik sınırları çalışır
  const personnelExpBefore =
    engine.getState().playerCompany!.financials.personnelExpenses;
  const hireRes = engine.configureCompanyOperations({
    targetStaffCount: 65,
    shiftCount: 2,
  });
  assert.equal(hireRes.success, true);
  engine.tickDay();
  const personnelExpAfter =
    engine.getState().playerCompany!.financials.personnelExpenses;
  assert.ok(
    personnelExpAfter > personnelExpBefore,
    'Personel sayısı ve vardiya arttığında maaş gideri artmalıdır'
  );
  const wf = engine.getState().playerCompany!.workforcePlan!;
  assert.ok(wf.workforceEfficiency >= 0.4 && wf.workforceEfficiency <= 1.15);
});

test('E. Uzun Simülasyon Testleri: 3 Şirket Profili (Muhafazakâr, Agresif Kredili, Kötü Yönetilen Aşırı Üretim) x 30, 180, 365 ve 1.095 Oyun Günü', () => {
  const horizons = [30, 180, 365, 1095] as const;

  const runProfileSimulation = (
    profileName: 'CONSERVATIVE' | 'AGGRESSIVE_DEBT' | 'POOR_OVERPRODUCING'
  ) => {
    const engine = new SimulationEngine(20261112, 3_500_000);
    engine.establishCompany(
      `${profileName} Sanayi A.Ş.`,
      profileName.slice(0, 4),
      'ENERJI',
      1_600_000,
      {
        initialStaffCount: 35,
        initialCapacity: 90,
        initialRdBudget: 8_000,
      }
    );

    if (profileName === 'AGGRESSIVE_DEBT') {
      engine.takeOutBankLoan({
        loanType: 'MACHINE_EQUIPMENT',
        principal: 350_000,
        termInGameDays: 180,
      });
      engine.startCompanyInvestmentProject({
        packageType: 'MEDIUM_EXPANSION',
      });
    } else if (profileName === 'POOR_OVERPRODUCING') {
      // Rakip fiyatının 2.6 katı fiyat koyup 3 vardiya aşırı üretim ve yüksek personel yükü oluştur
      const compPrice =
        engine.getState().playerCompany!.operations!.competitorAveragePrice;
      engine.configureCompanyOperations({
        unitSalePrice: compPrice * 2.6,
        shiftCount: 3,
        targetStaffCount: 70,
      });
    }

    const snapshots: Record<
      number,
      {
        cash: number;
        debt: number;
        inventoryUnits: number;
        revenue: number;
        ebitda: number;
        netIncome: number;
        evMultiple: number;
      }
    > = {};

    for (let day = 1; day <= 1095; day++) {
      engine.tickDay();

      // Agresif profilde her 120 günde bir küçük kapasite yatırımı dene
      if (profileName === 'AGGRESSIVE_DEBT' && day % 120 === 0) {
        engine.startCompanyInvestmentProject({
          packageType: 'SMALL_EXPANSION',
        });
      }

      if ((horizons as readonly number[]).includes(day)) {
        const st = engine.getState();
        const pc = st.playerCompany!;
        const ops = pc.operations!;

        assert.ok(Number.isFinite(pc.financials.cash));
        assert.ok(pc.financials.cash >= 0, 'Şirket kasası negatif olamaz');
        assert.ok(
          ops.actualProduction <= ops.installedCapacity + 0.01,
          '1095 gün boyunca üretim hiçbir zaman kurulu kapasiteyi aşamaz'
        );
        assert.ok(
          ops.technologyMultiplier <= 2.5,
          '1095 gün boyunca teknoloji çarpanı 2.50x sınırını aşamaz'
        );
        assert.equal(st.lastIntegrityAudit.valid, true);
        assert.equal(st.lastFinancialIntegrityReport?.valid, true);

        const evMult =
          pc.financials.EBITDA > 0
            ? Number((pc.enterpriseValue / pc.financials.EBITDA).toFixed(2))
            : 0;

        snapshots[day] = {
          cash: pc.financials.cash,
          debt: pc.financials.totalLiabilities,
          inventoryUnits: pc.financials.inventoryUnits,
          revenue: pc.financials.revenue,
          ebitda: pc.financials.EBITDA,
          netIncome: pc.financials.netIncome,
          evMultiple: evMult,
        };
      }
    }

    return snapshots;
  };

  const conservativeRes = runProfileSimulation('CONSERVATIVE');
  const aggressiveRes = runProfileSimulation('AGGRESSIVE_DEBT');
  const poorRes = runProfileSimulation('POOR_OVERPRODUCING');

  // Muhafazakâr şirket pozitif nakit ve sağlıklı FAVÖK üretmeli
  assert.ok(conservativeRes[365].ebitda > 0);
  assert.ok(conservativeRes[1095].cash > 0);
  assert.ok(
    conservativeRes[1095].evMultiple <= 15,
    'Değerleme çarpanı gerçekçi sınırlar içinde kalmalıdır'
  );

  // Agresif şirket yatırım yaptığı için daha yüksek kapasite/ciroya ulaşmalı
  assert.ok(aggressiveRes[365].revenue > conservativeRes[365].revenue);

  // Kötü yönetilen aşırı pahalı şirket stok biriktirmeli ve muhafazakâr şirketten daha düşük ciro/kâr elde etmeli
  assert.ok(
    poorRes[30].inventoryUnits > conservativeRes[30].inventoryUnits,
    'Aşırı pahalı fiyat koyan şirketin satılamayan ürünleri stokta birikmelidir'
  );
  assert.ok(
    poorRes[180].ebitda < conservativeRes[180].ebitda,
    'Kötü yönetilen şirket sağlıklı şirketten daha düşük FAVÖK üretmelidir'
  );
});

test('F. V4 -> V5 Migration ve Kayıt Güvenliği: Toplam Para Korunumu, Hesap Bakiyeleri, Şirket Kasası, Portföy, Gün/Saat, Açık Emirler ve Idempotent Migration', () => {
  const baseEngine = new SimulationEngine(20261199, 4_200_000);
  baseEngine.establishCompany(
    'Marmara Çelik ve Teknoloji A.Ş.',
    'MCTK',
    'TEKNOLOJI',
    1_800_000,
    {
      initialStaffCount: 45,
      initialCapacity: 110,
      initialRdBudget: 15_000,
    }
  );
  const s0 = baseEngine.getState().stocks[0];
  const s1 = baseEngine.getState().stocks[1];
  baseEngine.buyStock(s0.ticker, 120);
  baseEngine.placeOrder({
    ticker: s1.ticker,
    orderType: 'LIMIT_BUY',
    requestedShares: 80,
    limitPrice: Number((s1.price * 0.7).toFixed(2)),
  });
  baseEngine.advanceGameMinutes(635); // Saat 10:35

  const rawV5State = JSON.parse(baseEngine.serializeState());

  // V4 formatında eski bir kayıt zarfı simüle et (yüksek legacy teknoloji çarpanı 7.48x ile)
  const v4State = {
    ...rawV5State,
    schemaVersion: 4,
    personalCash: undefined,
    investmentCash: undefined,
    holdingCash: undefined,
    centralLedger: undefined,
    activeLoans: undefined,
    collaterals: undefined,
    playerCompany: {
      ...rawV5State.playerCompany,
      techQualityMultiplier: 7.48,
      dailyUnitsProduced: 67_288,
      productionCapacity: 16_360,
      operations: undefined,
      incomeBreakdown: undefined,
    },
  };

  const v4Envelope = {
    schemaVersion: 4,
    savedAtISO: '2026-11-05T10:35:00.000Z',
    seed: rawV5State.seed,
    randomState: rawV5State.randomState,
    state: v4State,
  };

  const migratedOnce = SimulationStore.migrateIfNeeded(v4Envelope);
  assert.ok(migratedOnce, 'V4 kaydı V5 şemasına başarıyla migrate edilmelidir');
  const mState = migratedOnce!.state;

  // 1. Migration sürümü = 5
  assert.equal(migratedOnce!.schemaVersion, 5);
  assert.equal(mState.schemaVersion, 5);

  // 2. Toplam para korunumu & Oyuncu kişisel / yatırım hesapları
  assert.equal(
    mState.cash,
    rawV5State.cash,
    'Migration oyuncunun toplam nakdini değiştirmemelidir'
  );
  assert.ok((mState.personalCash ?? 0) >= 0);
  assert.ok((mState.investmentCash ?? 0) >= 0);
  assert.ok(
    Math.abs((mState.personalCash ?? 0) + (mState.investmentCash ?? 0) - mState.cash) < 0.05,
    'Kişisel nakit + yatırım nakdi toplam oyuncu nakdine eşit olmalıdır'
  );

  // 3. Şirket kasası ve şirket kimliği korunumu
  assert.equal(mState.playerCompany?.ticker, 'MCTK');
  assert.equal(mState.playerCompany?.name, 'Marmara Çelik ve Teknoloji A.Ş.');
  assert.equal(
    mState.playerCompany?.financials.cash,
    rawV5State.playerCompany.financials.cash,
    'Migration şirket kasasını sıfırlamamalı veya değiştirmemelidir'
  );

  // 4. Eski 7.48x teknoloji çarpanı güvenli 1.00..2.50 aralığına dönüştürülmeli ve üretim kapasiteyi aşmamalı
  assert.ok(
    mState.playerCompany!.techQualityMultiplier <= 2.5,
    'Eski 7.48x teknoloji çarpanı 2.50x tavanına indirilmelidir'
  );
  assert.ok(
    mState.playerCompany!.dailyUnitsProduced <=
      mState.playerCompany!.productionCapacity,
    'Migrate edilen şirketin üretimi kurulu kapasiteyi (16.360) aşamaz'
  );

  // 5. Merkezi muhasebe defteri hesap bakiyeleri oluşturulmuş olmalı
  assert.ok(mState.centralLedger, 'Merkezi muhasebe defteri oluşturulmalıdır');
  assert.equal(
    mState.centralLedger!.accounts[
      ACCOUNT_IDS.companyBank('MCTK')
    ].balance +
      mState.centralLedger!.accounts[
        ACCOUNT_IDS.companyTreasury('MCTK')
      ].balance,
    mState.playerCompany!.financials.cash
  );

  // 6. Borç, Portföy, Gün/Saat ve Açık Emirler korunmalı
  assert.equal(mState.totalDebt, rawV5State.totalDebt);
  assert.equal(mState.portfolio[s0.ticker]?.shares, 120);
  assert.equal(mState.day, rawV5State.day);
  assert.equal(mState.minutesIntoCurrentDay, rawV5State.minutesIntoCurrentDay);
  assert.equal(mState.pendingOrders.length, rawV5State.pendingOrders.length);
  assert.equal(mState.pendingOrders[0].ticker, s1.ticker);

  // 7. İkinci kez migrate edildiğinde (Idempotency) hiçbir değer değişmemeli
  const migratedTwice = SimulationStore.migrateIfNeeded(migratedOnce);
  assert.ok(migratedTwice);
  assert.equal(migratedTwice!.state.cash, mState.cash);
  assert.equal(
    migratedTwice!.state.playerCompany?.financials.cash,
    mState.playerCompany?.financials.cash
  );
  assert.equal(
    migratedTwice!.state.playerCompany?.techQualityMultiplier,
    mState.playerCompany?.techQualityMultiplier
  );
});

// ============================================================================
// TEST G: ÇALIŞAN ALIMI (İŞÇİ ALIMI) KURALLARI, DARBOĞAZ ETKİSİ VE DEFTER KAYDI
// ============================================================================
test('Test G: Çalışan alımı (+10, +100, özel sayı), yetersiz kasa reddi, kişisel nakit koruması, darboğaz etkisi, hesap hareketleri ve kayıt kalıcılığı', () => {
  const engine = new SimulationEngine(950095, 3_500_000);
  const est = engine.establishCompany(
    'Trakya Otomasyon Sanayi A.Ş.',
    'TROTS',
    'TEKNOLOJI',
    1_200_000,
    {
      initialStaffCount: 15,
      initialCapacity: 200,
      initialRdBudget: 10_000,
    }
  );
  assert.equal(est.success, true);

  const pc = engine.getState().playerCompany!;

  // Çalışan darboğazı oluşturmak için kurulu kapasiteyi 200 br/gün, çalışanı 10 kişi yapalım
  pc.productionCapacity = 200;
  pc.financials.productionCapacityUnits = 200;
  pc.operations!.installedCapacity = 200;
  pc.operations!.plannedProduction = 200;
  pc.staffCount = 10;
  pc.financials.staffCount = 10;
  engine.configureCompanyOperations({ shiftCount: 2 });

  const installedBefore = pc.productionCapacity;
  const prodBeforeHire = pc.operations!.actualProduction;
  const companyCashBefore = pc.financials.cash;
  const personalCashBefore = engine.getState().personalCash;

  // 1. 0 veya negatif çalışan sayısı reddedilmeli
  const zeroRes = engine.configureCompanyOperations({ targetStaffCount: 0 });
  assert.equal(
    zeroRes.success,
    false,
    '0 çalışan hedefi ile yapılan işlem reddedilmelidir'
  );

  // 2. +10 çalışan işe alımı (10 -> 20)
  const hire10Res = engine.configureCompanyOperations({
    targetStaffCount: pc.staffCount + 10,
  });
  assert.equal(hire10Res.success, true, '+10 çalışan alımı başarılı olmalıdır');
  assert.ok(hire10Res.capitalSpent > 0, 'İşe alım gideri sıfırdan büyük olmalıdır');
  assert.equal(pc.staffCount, 20);
  assert.equal(pc.financials.staffCount, 20);
  assert.equal(pc.workforcePlan?.targetStaffCount, 20);
  assert.equal(
    pc.workforcePlan!.departments.production +
      pc.workforcePlan!.departments.rd +
      pc.workforcePlan!.departments.sales +
      pc.workforcePlan!.departments.management,
    20,
    'Departman çalışan toplamı yeni toplam çalışan sayısına eşit olmalıdır'
  );

  // 3. Kurulu kapasite artmamalı, ancak çalışan darboğazı azaldığı için üretim artmalı
  assert.equal(
    pc.productionCapacity,
    installedBefore,
    'İşe alım kurulu kapasiteyi (En Fazla Üretim) artırmamalıdır'
  );
  assert.ok(
    pc.operations!.actualProduction > prodBeforeHire,
    'Çalışan darboğazı varken işe alım fiili üretimi anında artırmalıdır'
  );

  // 4. Kişisel nakitten otomatik çekim yapılmamalı, yalnızca şirket kasasından düşülmeli
  assert.equal(
    engine.getState().personalCash,
    personalCashBefore,
    'İşe alımda oyuncunun kişisel nakdinden çekim yapılmamalıdır'
  );
  assert.equal(
    Number((companyCashBefore - pc.financials.cash).toFixed(2)),
    hire10Res.capitalSpent,
    'Şirket kasası tam olarak işe alım gideri kadar azalmalıdır'
  );

  // 5. İşlem Hesap Hareketleri'nde (CentralLedger) görünmeli
  const payrollLedgerTx = engine
    .getState()
    .centralLedger!.transactions.find(
      (tx) =>
        tx.category === 'PAYROLL_PAYMENT' &&
        tx.amount === hire10Res.capitalSpent &&
        tx.description.includes('+10 yeni çalışan')
    );
  assert.ok(
    payrollLedgerTx,
    'İşe alım işlemi Hesap Hareketleri (centralLedger.transactions) listesinde yer almalıdır'
  );

  // 6. +100 ve özel sayı (+15) çalışan alımı
  const hire100Res = engine.configureCompanyOperations({
    targetStaffCount: pc.staffCount + 100,
  });
  assert.equal(hire100Res.success, true);
  assert.equal(pc.staffCount, 120);

  const hireCustomRes = engine.configureCompanyOperations({
    targetStaffCount: pc.staffCount + 15,
  });
  assert.equal(hireCustomRes.success, true);
  assert.equal(pc.staffCount, 135);

  // 7. Şirket kasası yetersizse işlem reddedilmeli ve çalışan sayısı değişmemeli
  const staffBeforeFail = pc.staffCount;
  const cashBeforeFail = pc.financials.cash;
  const excessiveHire = engine.configureCompanyOperations({
    targetStaffCount: pc.staffCount + 50_000,
  });
  assert.equal(
    excessiveHire.success,
    false,
    'Şirket kasası yetersizken yüksek çalışan alımı reddedilmelidir'
  );
  assert.equal(pc.staffCount, staffBeforeFail);
  assert.equal(pc.financials.cash, cashBeforeFail);
  assert.equal(engine.getState().personalCash, personalCashBefore);

  // 8. Kayıt ve geri yükleme (Sayfa yenilenmesi simülasyonu) sonrasında çalışan sayısı korunmalı
  const rawEnvelope = {
    schemaVersion: 5,
    savedAtISO: new Date().toISOString(),
    seed: engine.getState().seed,
    randomState: engine.getState().randomState,
    state: JSON.parse(JSON.stringify(engine.getState())),
  };
  const reloaded = SimulationStore.migrateIfNeeded(rawEnvelope);
  assert.ok(reloaded);
  assert.equal(
    reloaded!.state.playerCompany?.staffCount,
    135,
    'Sayfa yenilendiğinde (save/load) yeni çalışan sayısı korunmalıdır'
  );
  assert.equal(
    reloaded!.state.playerCompany?.financials.staffCount,
    135
  );
});


