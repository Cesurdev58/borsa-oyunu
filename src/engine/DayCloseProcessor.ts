/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GÜN KAPANIŞI VE ÇEVRİMDIŞI İLERLEME
 * (SimulationEngine dosyasından ayrıldı. Fonksiyonlar ilk parametre olarak motoru alır; dış dünya hâlâ SimulationEngine.* üzerinden çağırır.)
 */

import * as DecisionEventEngine from './DecisionEventEngine';
import {
  DailyLogEntry,
  OfflineProgressSummary,
} from '../models/simulation';
import {
  AccountingEngine,
} from './AccountingEngine';
import {
  BankLoanEngine,
} from './BankLoanEngine';
import {
  ACCOUNT_IDS,
  CentralLedgerEngine,
} from './CentralLedgerEngine';
import {
  CompanyEngine,
} from './CompanyEngine';
import {
  EconomyEngine,
} from './EconomyEngine';
import {
  GameClockEngine,
} from './GameClockEngine';
import {
  MarketEngine,
} from './MarketEngine';
import {
  NewsEngine,
} from './NewsEngine';
import {
  NPCFundEngine,
} from './NPCFundEngine';
import {
  TradeAndShopEngine,
} from './TradeAndShopEngine';
import {
  WalletEngine,
} from './WalletEngine';
import {
  ValuationEngine,
} from './ValuationEngine';
import type {
  SimulationEngine,
} from './SimulationEngine';
import { CompanyWallet } from './CompanyWallet';

export function closeCurrentDay(engine: SimulationEngine, expectedDayToClose?: number): DailyLogEntry {
    if (
      typeof expectedDayToClose === 'number' &&
      engine.state.day !== expectedDayToClose
    ) {
      return engine.state.dailyLogs[engine.state.dailyLogs.length - 1];
    }

    const hadIntradaySteps =
      engine.state.intradayStepsProcessedToday > 0 ||
      engine.state.intradayMarketStepsCompletedToday > 0;

    // Eğer gün içinde piyasa seansı henüz tamamlanmadıysa açık emirleri seans başlangıcında değerlendir
    if (
      engine.state.intradayMarketStepsCompletedToday <
        GameClockEngine.MARKET_OPEN_SUBSTEPS_PER_DAY &&
      engine.state.pendingOrders.length > 0
    ) {
      const prevSession = engine.state.marketSession;
      engine.state.marketSession = 'MARKET_OPEN';
      engine.processPendingOrders();
      engine.state.marketSession = prevSession;
    }

    // 1. Yeni Gün Başlangıcı ve Saat Sıfırlaması (00:00)
    engine.state.day += 1;
    const currentDay = engine.state.day;
    engine.state.dateISO = engine.computeDateISO(currentDay);
    engine.state.minutesIntoCurrentDay = 0;
    engine.state.currentGameHour = 0;
    engine.state.currentGameMinute = 0;
    engine.state.marketSession = GameClockEngine.getMarketSession(0);

    let dividendsReceivedToday = 0;
    let holdingSynergyReceivedToday = 0;

    // Önceki günden tahakkuk etmiş temettü alacağı varsa nakde tahsil et
    if (engine.state.accruedDividendsReceivable > 0) {
      const collected = engine.state.accruedDividendsReceivable;
      WalletEngine.earn(engine.state, collected);
      engine.state.accruedDividendsReceivable = 0;
      dividendsReceivedToday = Number(
        (dividendsReceivedToday + collected).toFixed(2)
      );
    }

    // 2. Makroekonomik Göstergeleri Güncelle
    engine.state.macro = EconomyEngine.updateMacroIndicators(
      engine.state.macro,
      currentDay,
      engine.rng
    );

    // 3. Yeni Haberleri Üret ve 4. Mevcut Haberlerin Etkisini Azalt
    const decayedFeed = NewsEngine.decayExistingNews(
      engine.state.newsFeed,
      currentDay
    );
    const newNewsEvent = NewsEngine.generateDailyNews(
      currentDay,
      engine.state.stocks,
      engine.rng
    );
    engine.state.newsFeed = [newNewsEvent, ...decayedFeed.slice(0, 39)];
    engine.intradayTracking.newsGenerated += 1;
    NewsEngine.updateStockSentimentsFromNews(
      engine.state.stocks,
      engine.state.newsFeed,
      currentDay
    );

    // 5. Oyuncu Şirketi Operasyonlarını Tamamla (Çift sayımı önleyerek!)
    if (engine.state.playerCompany) {
      const pc = engine.state.playerCompany;
      const sectorStocks = engine.state.stocks.filter(
        (s) => s.sector === pc.sector
      );
      const avgSectorSentiment =
        sectorStocks.reduce((acc, s) => acc + s.sentimentScore, 0) /
        Math.max(1, sectorStocks.length);

      if (!hadIntradaySteps) {
        CompanyEngine.stepPlayerCompanyOneDay(
          pc,
          engine.state.macro,
          avgSectorSentiment,
          currentDay,
          engine.state.totalElapsedGameMinutes
        );
        engine.intradayTracking.productionCompleted += pc.dailyUnitsProduced;
        engine.intradayTracking.revenueGenerated += pc.dailyRevenue;
        engine.intradayTracking.expensesPaid += pc.dailyOpex;
      } else {
        const remainingSubsteps = Math.max(
          0,
          GameClockEngine.SUBSTEPS_PER_DAY -
            engine.state.intradayStepsProcessedToday
        );
        if (remainingSubsteps > 0) {
          const remFraction =
            remainingSubsteps / GameClockEngine.SUBSTEPS_PER_DAY;
          const stepDelta = CompanyEngine.stepPlayerCompanyIntraday(
            pc,
            engine.state.macro,
            avgSectorSentiment,
            remFraction,
            engine.state.totalElapsedGameMinutes
          );
          engine.intradayTracking.productionCompleted +=
            stepDelta.unitsProducedDelta;
          engine.intradayTracking.revenueGenerated += stepDelta.revenueDelta;
          engine.intradayTracking.expensesPaid += stepDelta.expensesDelta;
          engine.intradayTracking.researchProgress += stepDelta.rdIncrement;
        }
        pc.operatingDays += 1;
        if (pc.financials.EBITDA > 0) {
          pc.corporateGovernanceScore = Number(
            Math.min(98, pc.corporateGovernanceScore + 0.6).toFixed(1)
          );
        }
        pc.revenueHistory.push(pc.annualizedRevenue);
        pc.ebitdaHistory.push(pc.annualizedEbitda);
        pc.valuationHistory.push(pc.equityValue);
        if (pc.revenueHistory.length > 90) {
          pc.revenueHistory.shift();
          pc.ebitdaHistory.shift();
          pc.valuationHistory.shift();
        }
        if (currentDay % 30 === 0) {
          pc.quarterlyReports.push(
            AccountingEngine.createQuarterlyReport(
              pc.financials,
              currentDay,
              engine.state.macro.corporateTaxRate
            )
          );
        }
      }

      if (pc.isPubliclyListed) {
        const listedStock = engine.state.stocks.find(
          (s) => s.ticker === pc.ticker
        );
        if (listedStock) {
          listedStock.financials = pc.financials;
          listedStock.valuation = pc.valuation;
          listedStock.ebitdaAnnual = pc.annualizedEbitda;
          listedStock.fundamentalPrice = pc.valuation.fairValuePerShare;
        }
      }

      // Günlük şirket faaliyet gelir ve giderlerini Merkezi Muhasebe Defterine (idempotent olarak) işle
      const compBankId = ACCOUNT_IDS.companyBank(pc.ticker);
      if (pc.dailyRevenue > 0) {
        CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
          idempotencyKey: `COMP-REV-${pc.ticker}-D${currentDay}`,
          sourceAccountId: ACCOUNT_IDS.OPERATING_REVENUE,
          destinationAccountId: compBankId,
          amount: pc.dailyRevenue,
          category: 'OPERATING_REVENUE_RECEIPT',
          description: `${pc.ticker} Gün ${currentDay} ürün satış cirosu tahsilatı`,
          relatedCompanyId: pc.ticker,
          reservedOrderCash: engine.getReservedCash(),
        });
      }
      const inc = pc.incomeBreakdown;
      const dailyPayroll = inc
        ? Number(((inc.salariesExpense + inc.socialBenefitsExpense) / 252).toFixed(2))
        : Number((pc.dailyOpex * 0.35).toFixed(2));
      if (dailyPayroll > 0) {
        CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
          idempotencyKey: `COMP-PAYROLL-${pc.ticker}-D${currentDay}`,
          sourceAccountId: compBankId,
          destinationAccountId: ACCOUNT_IDS.PAYROLL_EXPENSE,
          amount: dailyPayroll,
          category: 'PAYROLL_PAYMENT',
          description: `${pc.ticker} Gün ${currentDay} personel ve maaş bordro ödemesi`,
          relatedCompanyId: pc.ticker,
          reservedOrderCash: engine.getReservedCash(),
        });
      }
      const dailyOpsAndRd = Math.max(0, Number((pc.dailyOpex - dailyPayroll).toFixed(2)));
      if (dailyOpsAndRd > 0) {
        CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
          idempotencyKey: `COMP-OPEX-${pc.ticker}-D${currentDay}`,
          sourceAccountId: compBankId,
          destinationAccountId: ACCOUNT_IDS.OPERATING_EXPENSE,
          amount: dailyOpsAndRd,
          category: 'OPERATING_EXPENSE_PAYMENT',
          description: `${pc.ticker} Gün ${currentDay} üretim, stok depolama ve Ar-Ge gideri`,
          relatedCompanyId: pc.ticker,
          reservedOrderCash: engine.getReservedCash(),
        });
      }
      const dailyTax = inc ? Number((inc.taxExpense / 252).toFixed(2)) : 0;
      if (dailyTax > 0) {
        CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
          idempotencyKey: `COMP-TAX-${pc.ticker}-D${currentDay}`,
          sourceAccountId: compBankId,
          destinationAccountId: ACCOUNT_IDS.TAX_LIABILITY,
          amount: dailyTax,
          category: 'TAX_PAYMENT',
          description: `${pc.ticker} Gün ${currentDay} kurumlar vergisi karşılığı`,
          relatedCompanyId: pc.ticker,
          reservedOrderCash: engine.getReservedCash(),
        });
      }
    }

    // 5B. Esnaf Dükkânları, Ticaret Evreni, Sevkiyatlar, Mağaza Satışları ve Sözleşmeleri İşle
    TradeAndShopEngine.stepDailyTradeAndShops(
      engine.state,
      engine.rng,
      engine.getReservedCash()
    );
    // 5C. Karar kartları: ertelenmiş ödemeler, süresi geçen kart, yeni olay
    for (const msg of DecisionEventEngine.onDayClosed(engine.state, engine.getReservedCash())) {
      engine.pendingDailyActions.push(`[Karar] ${msg}`);
    }

    const todayTradeSummary = engine.state.tradeState?.todaySummary;
    if (todayTradeSummary) {
      engine.intradayTracking.revenueGenerated +=
        todayTradeSummary.shopSalesRevenue +
        todayTradeSummary.wholesaleAndContractRevenue;
      engine.intradayTracking.expensesPaid +=
        todayTradeSummary.shopOpex + todayTradeSummary.logisticsCost;
    }

    // 6. NPC Şirket Kararlarını ve Günlük Bilanço/Değerlemelerini İşle
    for (const stock of engine.state.stocks) {
      if (stock.isPlayerCompany) continue;

      stock.financials = AccountingEngine.stepCompanyFinancialsOneDay(
        stock.financials,
        stock.sector,
        engine.state.macro,
        stock.sentimentScore,
        1.0
      );
      stock.ebitdaAnnual = stock.financials.EBITDA;
      stock.valuation = ValuationEngine.computeCompanyValuation(
        stock.financials,
        stock.sector,
        engine.state.macro,
        1.0
      );
      stock.fundamentalPrice = stock.valuation.fairValuePerShare;

      if (stock.integrationDaysRemaining > 0) {
        stock.integrationDaysRemaining -= 1;
      }
    }

    // 7. NPC Fon Emirlerini Üret (İkincil Piyasa İşlemleri)
    NPCFundEngine.stepSecondaryMarketFundTrading(
      engine.state.institutionalFunds,
      engine.state.stocks,
      engine.state.macro,
      currentDay,
      engine.rng
    );

    // 8. Banka Kredileri (Günlük Tekil Faiz Tahakkuku ve Taksit Tahsilatı) + Kalan Oyuncu Borçları
    const loanDaySummary = BankLoanEngine.stepDailyLoansAndInterest(
      engine.state,
      engine.getReservedCash()
    );
    if (
      loanDaySummary.installmentsPaidCount > 0 ||
      loanDaySummary.delinquentLoansCount > 0
    ) {
      engine.pendingDailyActions.push(
        `Banka Kredi Özeti: ${loanDaySummary.installmentsPaidCount} taksit ödendi, ${loanDaySummary.delinquentLoansCount} gecikme, ${loanDaySummary.totalInterestAccruedToday.toLocaleString('tr-TR')} TL günlük faiz tahakkuk etti.`
      );
    }

    const activePlayerBankLoanDebt = (engine.state.activeLoans || [])
      .filter(
        (l) =>
          (l.status === 'ACTIVE' || l.status === 'DELINQUENT') &&
          (l.borrowerType === 'PLAYER' || l.borrowerType === 'HOLDING')
      )
      .reduce(
        (sum, l) => sum + l.remainingPrincipal + l.accruedInterestUnpaid,
        0
      );
    const nonBankPlayerDebt = Math.max(
      0,
      engine.state.totalDebt - activePlayerBankLoanDebt
    );

    if (nonBankPlayerDebt > 0) {
      const dailyDebtInterest = Number(
        (
          (nonBankPlayerDebt *
            Math.max(0.1, engine.state.macro.policyInterestRate * 0.65)) /
          252
        ).toFixed(2)
      );
      if (engine.state.cash >= dailyDebtInterest) {
        WalletEngine.spend(engine.state, dailyDebtInterest);
      } else {
        engine.state.shortTermDebt = Number(
          (engine.state.shortTermDebt + dailyDebtInterest).toFixed(2)
        );
      }
    }

    // 9. Piyasa Fiyatlarını Güncelle (Gün içinde 96 adım tamamlandıysa iki kez çalıştırma!)
    if (!hadIntradaySteps) {
      MarketEngine.stepMarketPricesOneDay(
        engine.state.stocks,
        engine.state.macro,
        engine.rng
      );
      if (engine.state.pendingOrders.length > 0) {
        const prevSession = engine.state.marketSession;
        engine.state.marketSession = 'MARKET_OPEN';
        engine.processPendingOrders();
        engine.state.marketSession = prevSession;
      }
    } else {
      const remainingMarketSubsteps = Math.max(
        0,
        GameClockEngine.MARKET_OPEN_SUBSTEPS_PER_DAY -
          engine.state.intradayMarketStepsCompletedToday
      );
      if (remainingMarketSubsteps > 0) {
        MarketEngine.stepMarketPricesIntraday(
          engine.state.stocks,
          engine.state.macro,
          engine.rng,
          remainingMarketSubsteps /
            GameClockEngine.MARKET_OPEN_SUBSTEPS_PER_DAY
        );
        if (engine.state.pendingOrders.length > 0) {
          const prevSession = engine.state.marketSession;
          engine.state.marketSession = 'MARKET_OPEN';
          engine.processPendingOrders();
          engine.state.marketSession = prevSession;
        }
      }
      // Gün sonu kapanış fiyatını priceHistory'e kaydet ve yeni gün için previousPrice güncelle
      for (const stock of engine.state.stocks) {
        stock.priceHistory.push(stock.price);
        if (stock.priceHistory.length > 120) {
          stock.priceHistory.shift();
        }
        stock.previousPrice = stock.price;
        stock.netOrderFlowLots = 0;
      }
    }

    // Gün içi sayaçları sıfırla
    engine.state.intradayStepsProcessedToday = 0;
    engine.state.intradayMarketStepsCompletedToday = 0;

    // Süresi dolan (expired) bekleyen emirlerin rezervlerini serbest bırak
    engine.expireOutdatedOrders(currentDay);

    // 10. Temettü ve Holding Sinerjilerini Dağıt
    for (const stock of engine.state.stocks) {
      if (currentDay % stock.dividendPeriodDays === 0) {
        stock.lastExDividendDay = currentDay;
        const pos = engine.state.portfolio[stock.ticker];
        if (pos && pos.shares > 0 && pos.lastPurchaseDay < currentDay) {
          const periodYield =
            stock.dividendYieldAnnual / (252 / stock.dividendPeriodDays);
          const dividendPerShare = Math.min(
            stock.price * periodYield,
            Math.max(0, stock.financials.cash * 0.25) / stock.totalShares
          );
          const totalCompanyDividend = Number(
            (dividendPerShare * stock.totalShares).toFixed(2)
          );
          const playerPayout = Number(
            (pos.shares * dividendPerShare).toFixed(2)
          );

          if (
            playerPayout > 0 &&
            stock.financials.cash >= totalCompanyDividend
          ) {
            CompanyWallet.spend(stock, totalCompanyDividend);
            stock.financials.totalAssets = Number(
              (stock.financials.totalAssets - totalCompanyDividend).toFixed(2)
            );
            stock.financials.retainedEarnings = Number(
              (
                stock.financials.retainedEarnings - totalCompanyDividend
              ).toFixed(2)
            );
            stock.financials.shareholdersEquity = Number(
              (
                stock.financials.totalAssets - stock.financials.totalLiabilities
              ).toFixed(2)
            );

            WalletEngine.earn(engine.state, playerPayout);
            pos.totalDividendCollected = Number(
              (pos.totalDividendCollected + playerPayout).toFixed(2)
            );
            dividendsReceivedToday = Number(
              (dividendsReceivedToday + playerPayout).toFixed(2)
            );
            engine.state.totalDividendsEarned = Number(
              (engine.state.totalDividendsEarned + playerPayout).toFixed(2)
            );
            engine.intradayTracking.dividendsCollected = Number(
              (
                engine.intradayTracking.dividendsCollected + playerPayout
              ).toFixed(2)
            );

            engine.recordTransaction({
              type: 'DIVIDEND',
              ticker: stock.ticker,
              shares: pos.shares,
              executionPrice: Number(dividendPerShare.toFixed(4)),
              grossAmount: playerPayout,
              commission: 0,
              slippageBps: 0,
              cashDelta: playerPayout,
              description: `${stock.ticker} dönemsel temettü ödemesi (+${engine.formatCurrency(playerPayout)})`,
            });

            CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
              idempotencyKey: `MKT-DIV-${stock.ticker}-D${currentDay}`,
              sourceAccountId: ACCOUNT_IDS.DIVIDEND_PAYABLE,
              destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
              amount: playerPayout,
              category: 'LEGAL_DIVIDEND',
              description: `${stock.ticker} dönemsel temettü tahsilatı`,
              relatedCompanyId: stock.ticker,
              reservedOrderCash: engine.getReservedCash(),
            });
          }
        }
      }

      if (
        stock.isControlledByPlayer &&
        !stock.isPlayerCompany &&
        stock.integrationDaysRemaining === 0
      ) {
        const dailyPositiveEbitda = Math.max(0, stock.financials.EBITDA / 252);
        const synergyPayout = Number(
          (
            dailyPositiveEbitda *
            0.12 *
            (stock.playerOwnershipPct / 100)
          ).toFixed(2)
        );
        if (synergyPayout > 0 && stock.financials.cash > synergyPayout * 3) {
          CompanyWallet.spend(stock, synergyPayout);
          stock.financials.totalAssets = Number(
            (stock.financials.totalAssets - synergyPayout).toFixed(2)
          );
          stock.financials.retainedEarnings = Number(
            (stock.financials.retainedEarnings - synergyPayout).toFixed(2)
          );
          stock.financials.shareholdersEquity = Number(
            (
              stock.financials.totalAssets - stock.financials.totalLiabilities
            ).toFixed(2)
          );

          WalletEngine.earn(engine.state, synergyPayout);
          holdingSynergyReceivedToday = Number(
            (holdingSynergyReceivedToday + synergyPayout).toFixed(2)
          );
          engine.state.totalSynergyEarned = Number(
            (engine.state.totalSynergyEarned + synergyPayout).toFixed(2)
          );

          CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
            idempotencyKey: `HOLD-SYNERGY-${stock.ticker}-D${currentDay}`,
            sourceAccountId: ACCOUNT_IDS.HOLDING_MAIN,
            destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
            amount: synergyPayout,
            category: 'HOLDING_CAPITAL_TRANSFER',
            description: `${stock.ticker} bağlı ortaklık sinerji nakit akışı`,
            relatedCompanyId: stock.ticker,
            reservedOrderCash: engine.getReservedCash(),
          });
        }
      }
    }

    // 11. Ay / Çeyrek Kapanışlarını Yap
    if (currentDay % 30 === 0) {
      for (const stock of engine.state.stocks) {
        if (!stock.isPlayerCompany) {
          stock.quarterlyReports.push(
            AccountingEngine.createQuarterlyReport(
              stock.financials,
              currentDay,
              engine.state.macro.corporateTaxRate
            )
          );
          if (stock.quarterlyReports.length > 16) {
            stock.quarterlyReports.shift();
          }
        }
      }
    }

    engine.state.lastProcessedDayClose = currentDay;
    engine.state.lastProcessedGameMinuteTotal = engine.state.totalElapsedGameMinutes;
    engine.state.lastSimulationTickId = `TICK-D${currentDay}-M${engine.state.totalElapsedGameMinutes}`;

    // 12. Oyuncu Net Varlığını Hesapla ve 13. Aşama Kilitlerini Kontrol Et
    engine.recalculateFinancialsAndStages();
    CentralLedgerEngine.recordBalanceSnapshot(engine.state);

    // 14. Muhasebe Bütünlüğünü Doğrula
    const audit = AccountingEngine.auditSimulationIntegrity(engine.state);
    engine.state.lastIntegrityAudit = audit;
    engine.state.randomState = engine.rng.getState();

    // 15. Gün Sonu Snapshot Oluştur
    const logActions = [...engine.pendingDailyActions];
    if (dividendsReceivedToday > 0) {
      logActions.push(
        `Temettü tahsilatı: +${engine.formatCurrency(dividendsReceivedToday)}`
      );
    }
    if (holdingSynergyReceivedToday > 0) {
      logActions.push(
        `Holding bağlı ortaklık sinerji nakit akışı: +${engine.formatCurrency(holdingSynergyReceivedToday)}`
      );
    }
    if (logActions.length === 0) {
      logActions.push(
        'Piyasa fiyatlaması, bilançolar ve portföy değerlemesi güncellendi.'
      );
    }
    engine.pendingDailyActions = [];

    const privateEquityVal = Number(
      (
        (engine.state.playerCompany && !engine.state.playerCompany.isPubliclyListed
          ? engine.state.playerCompany.equityValue
          : 0) + TradeAndShopEngine.computeNonIncorporatedShopsEquity(engine.state)
      ).toFixed(2)
    );

    const entry: DailyLogEntry = {
      day: currentDay,
      dateISO: engine.state.dateISO,
      stage: engine.state.stage,
      cash: engine.state.cash,
      portfolioMarketValue: engine.state.portfolioValue,
      privateCompanyEquityValue: privateEquityVal,
      accruedDividends: engine.state.accruedDividendsReceivable,
      totalDebt: engine.state.totalDebt,
      netWorth: engine.state.netWorth,
      marketIndexValue: engine.state.marketIndex,
      dividendsReceivedToday,
      holdingSynergyReceivedToday,
      headlineNews: newNewsEvent.headline,
      actionsTaken: logActions,
      integrityValid: audit.valid,
    };

    engine.state.dailyLogs.push(entry);
    if (engine.state.dailyLogs.length > 400) {
      engine.state.dailyLogs.shift();
    }

    return entry;
  }

export function processOfflineProgress(engine: SimulationEngine, lastTimestampISO?: string,
    currentTimestampISO?: string): OfflineProgressSummary {
    const startNetWorth = engine.state.netWorth;
    const warnings: string[] = [];

    const effectiveLastISO =
      lastTimestampISO || engine.state.lastRealTimestampISO;
    const effectiveCurrentISO =
      currentTimestampISO || new Date().toISOString();

    const parsedDiff = GameClockEngine.parseAndValidateTimestampDiff(
      effectiveLastISO,
      effectiveCurrentISO
    );

    if (!parsedDiff.valid) {
      if (parsedDiff.warning) warnings.push(parsedDiff.warning);
      const emptySummary: OfflineProgressSummary = {
        realSecondsElapsed: 0,
        gameMinutesAdvanced: 0,
        gameDaysAdvanced: 0,
        ordersExecuted: 0,
        ordersExpired: 0,
        productionCompleted: 0,
        revenueGenerated: 0,
        expensesPaid: 0,
        researchProgress: 0,
        dividendsCollected: 0,
        newsGenerated: 0,
        startNetWorth,
        endNetWorth: engine.state.netWorth,
        warnings,
      };
      engine.state.lastOfflineSummary = emptySummary;
      return emptySummary;
    }

    const currentMs = Date.parse(effectiveCurrentISO);
    const lastMs = Date.parse(effectiveLastISO);

    // Aynı zaman aralığının iki kez işlenmesini engelle
    if (
      engine.maxProcessedOfflineTimestampMs > 0 &&
      currentMs <= engine.maxProcessedOfflineTimestampMs
    ) {
      warnings.push(
        'Bu çevrimdışı zaman aralığı daha önce işlendi; mükerrer ilerleme engellendi.'
      );
      const duplicateSummary: OfflineProgressSummary = {
        realSecondsElapsed: 0,
        gameMinutesAdvanced: 0,
        gameDaysAdvanced: 0,
        ordersExecuted: 0,
        ordersExpired: 0,
        productionCompleted: 0,
        revenueGenerated: 0,
        expensesPaid: 0,
        researchProgress: 0,
        dividendsCollected: 0,
        newsGenerated: 0,
        startNetWorth,
        endNetWorth: engine.state.netWorth,
        warnings,
      };
      engine.state.lastOfflineSummary = duplicateSummary;
      return duplicateSummary;
    }

    const effectiveStartMs =
      engine.maxProcessedOfflineTimestampMs > lastMs
        ? engine.maxProcessedOfflineTimestampMs
        : lastMs;
    const effectiveRealSeconds = Math.max(
      0,
      (currentMs - effectiveStartMs) / 1000
    );

    const { cappedGameMinutes, wasCapped } =
      GameClockEngine.computeCappedOfflineGameMinutes(
        effectiveRealSeconds,
        engine.state.realMinutesPerGameDay,
        GameClockEngine.MAX_OFFLINE_GAME_DAYS
      );

    if (wasCapped) {
      warnings.push(
        `Çevrimdışı ilerleme maksimum ${GameClockEngine.MAX_OFFLINE_GAME_DAYS} oyun günü (${GameClockEngine.MAX_OFFLINE_GAME_MINUTES} oyun dakikası) ile sınırlandırıldı.`
      );
    }

    // İzleme sayaçlarını sıfırla
    engine.intradayTracking = {
      ordersExecuted: 0,
      ordersExpired: 0,
      productionCompleted: 0,
      revenueGenerated: 0,
      expensesPaid: 0,
      researchProgress: 0,
      dividendsCollected: 0,
      newsGenerated: 0,
    };

    const advanceRes =
      cappedGameMinutes > 0
        ? engine.advanceGameMinutes(cappedGameMinutes)
        : { gameMinutesAdvanced: 0, daysClosed: 0 };

    engine.maxProcessedOfflineTimestampMs = currentMs;
    engine.state.lastRealTimestampISO = effectiveCurrentISO;
    engine.state.lastOfflineProcessedTimestampISO = effectiveCurrentISO;

    const summary: OfflineProgressSummary = {
      realSecondsElapsed: Number(effectiveRealSeconds.toFixed(2)),
      gameMinutesAdvanced: advanceRes.gameMinutesAdvanced,
      gameDaysAdvanced: advanceRes.daysClosed,
      ordersExecuted: engine.intradayTracking.ordersExecuted,
      ordersExpired: engine.intradayTracking.ordersExpired,
      productionCompleted: Number(
        engine.intradayTracking.productionCompleted.toFixed(2)
      ),
      revenueGenerated: Number(
        engine.intradayTracking.revenueGenerated.toFixed(2)
      ),
      expensesPaid: Number(engine.intradayTracking.expensesPaid.toFixed(2)),
      researchProgress: Number(
        engine.intradayTracking.researchProgress.toFixed(4)
      ),
      dividendsCollected: Number(
        engine.intradayTracking.dividendsCollected.toFixed(2)
      ),
      newsGenerated: engine.intradayTracking.newsGenerated,
      startNetWorth,
      endNetWorth: engine.state.netWorth,
      warnings,
    };

    engine.state.lastOfflineSummary = summary;
    engine.state.lastOfflineSummaryDismissed = advanceRes.gameMinutesAdvanced === 0;
    return summary;
  }
