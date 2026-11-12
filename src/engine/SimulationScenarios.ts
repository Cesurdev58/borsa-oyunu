/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OTOMATİK SENARYOLAR: 30 günlük simülasyon ve stres testi
 * (SimulationEngine dosyasından ayrıldı. Fonksiyonlar ilk parametre olarak motoru alır; dış dünya hâlâ SimulationEngine.* üzerinden çağırır.)
 */

import {
  BatchSimulationSummary,
  DailyLogEntry,
  SimulationState,
} from '../models/simulation';
import {
  CompanyEngine,
} from './CompanyEngine';
import type {
  SimulationEngine,
} from './SimulationEngine';

export function runAutomatedStressScenario(engine: SimulationEngine, days: number = 30,
    silentConsole: boolean = false): {
    logs: DailyLogEntry[];
    consoleLines: string[];
    summary: BatchSimulationSummary;
    finalState: SimulationState;
  } {
    return engine.run30DaySimulation(true, days, silentConsole);
  }

export function run30DaySimulation(engine: SimulationEngine, enableStrategyAutomation: boolean = true,
    daysToRun: number = 30,
    silentConsole: boolean = false): {
    logs: DailyLogEntry[];
    consoleLines: string[];
    summary: BatchSimulationSummary;
    finalState: SimulationState;
  } {
    const consoleLines: string[] = [];
    const printLine = (line: string) => {
      consoleLines.push(line);
      if (!silentConsole) {
        console.log(line);
      }
    };

    const startDay = engine.state.day;
    const startNetWorth = engine.state.netWorth;
    const startCash = engine.state.cash;
    const startPortfolioValue = engine.state.portfolioValue;
    const startTxSequence = engine.state.transactionSequence;
    const startDividends = engine.state.totalDividendsEarned;
    const startSynergy = engine.state.totalSynergyEarned;
    const startCompanyRev = engine.state.playerCompany?.annualizedRevenue || 0;
    const startCompanyEbitda = engine.state.playerCompany?.annualizedEbitda || 0;

    const initialStockPrices: Record<string, number> = {};
    for (const s of engine.state.stocks) {
      initialStockPrices[s.ticker] = s.price;
    }

    const ipoEvents: string[] = [];
    const takeoverEvents: string[] = [];
    const integrityErrors: string[] = [];

    printLine(
      '================================================================================'
    );
    printLine(
      `  BORSA VE HOLDİNG SİMÜLATÖRÜ - ${daysToRun} GÜNLÜK ${enableStrategyAutomation ? 'OTOMATİK STRES SENARYOSU' : 'SAF ZAMAN İLERLETMESİ'}`
    );
    printLine(
      '================================================================================'
    );
    printLine(
      `[BAŞLANGIÇ GÜN ${String(startDay).padStart(2, '0')}] Aşama: ${engine.state.stage} | Nakit: ${engine.formatCurrency(engine.state.cash)} | Portföy: ${engine.formatCurrency(engine.state.portfolioValue)} | Net Varlık: ${engine.formatCurrency(engine.state.netWorth)}`
    );

    for (let step = 1; step <= daysToRun; step++) {
      if (enableStrategyAutomation) {
        for (const pos of Object.values(engine.state.portfolio)) {
          const st = engine.state.stocks.find((s) => s.ticker === pos.ticker);
          if (
            st &&
            !st.isPlayerCompany &&
            !st.isControlledByPlayer &&
            st.bidPrice > pos.averageCost * 1.07 &&
            pos.shares >= 20
          ) {
            engine.sellStock(
              st.ticker,
              Math.max(10, Math.floor(pos.shares * 0.4))
            );
          }
        }

        if (engine.getSpendableCash() > 12_000) {
          const candidates = [...engine.state.stocks]
            .filter((s) => !s.isPlayerCompany)
            .sort((a, b) => {
              const scoreA =
                a.fundamentalPrice / a.price + a.sentimentScore * 8;
              const scoreB =
                b.fundamentalPrice / b.price + b.sentimentScore * 8;
              return scoreB - scoreA;
            });

          const topPick = candidates[0];
          if (topPick) {
            const budget = engine.getSpendableCash() * 0.35;
            const lots = Math.min(
              500,
              Math.floor(budget / (topPick.askPrice * 1.002))
            );
            if (lots >= 10) {
              engine.buyStock(topPick.ticker, lots);
            }
          }
        }

        if (
          !engine.state.playerCompany &&
          engine.state.netWorth >= CompanyEngine.STAGE_2_NET_WORTH_THRESHOLD &&
          engine.getSpendableCash() >= 400_000
        ) {
          engine.establishCompany(
            'Turkuaz Kuantum & Bulut Sistemleri A.Ş.',
            'TRKZ',
            'TEKNOLOJI',
            Math.min(engine.getSpendableCash() * 0.65, 1_200_000)
          );
        } else if (
          engine.state.playerCompany &&
          !engine.state.playerCompany.isPubliclyListed
        ) {
          const pc = engine.state.playerCompany;
          if (pc.financials.cash > 300_000) {
            engine.configureCompanyOperations({
              targetStaffCount: Math.min(180, pc.staffCount + 6),
              targetProductionCapacity: Math.min(
                220,
                pc.productionCapacity + 8
              ),
              dailyRdBudget: Math.min(75_000, pc.dailyRdBudget + 5_000),
            });
          }

          const ipoEligibility = engine.checkIPOEligibility();
          if (ipoEligibility.eligible) {
            const ipoRes = engine.executeIPO(0.3, 0.12, 0.35);
            if (ipoRes.success) {
              ipoEvents.push(ipoRes.message);
            }
          }
        }

        if (
          engine.state.playerCompany?.isPubliclyListed &&
          engine.state.controlledSubsidiaries.length === 0
        ) {
          const smallestNpc = [...engine.state.stocks]
            .filter((s) => !s.isPlayerCompany && !s.isControlledByPlayer)
            .sort((a, b) => a.equityValue - b.equityValue)[0];
          if (
            smallestNpc &&
            engine.getSpendableCash() > smallestNpc.equityValue * 0.68
          ) {
            const toRes = engine.executeHostileTakeover(smallestNpc.ticker);
            if (toRes.success) {
              takeoverEvents.push(toRes.message);
            }
          }
        }
      }

      const log = engine.tickDay();
      if (!log.integrityValid) {
        integrityErrors.push(
          `Gün ${log.day}: ${engine.state.lastIntegrityAudit.errors.join(', ')}`
        );
      }

      printLine(
        `[GÜN ${String(log.day).padStart(2, '0')} | ${log.dateISO}] Aşama ${log.stage} | Nakit: ${engine.formatCurrency(log.cash)} | Portföy: ${engine.formatCurrency(log.portfolioMarketValue)} | Net Varlık: ${engine.formatCurrency(log.netWorth)} | Endeks: ${log.marketIndexValue.toFixed(1)}`
      );
      printLine(`   Haber: "${log.headlineNews}"`);
      for (const act of log.actionsTaken) {
        printLine(`   -> ${act}`);
      }
    }

    const endNetWorth = engine.state.netWorth;
    const netWorthChange = Number((endNetWorth - startNetWorth).toFixed(2));
    const netWorthChangePct = Number(
      ((netWorthChange / Math.max(1, startNetWorth)) * 100).toFixed(2)
    );

    const stockPerformances = engine.state.stocks.map((s) => {
      const baseP = initialStockPrices[s.ticker] || s.previousPrice || s.price;
      const returnPct = Number((((s.price - baseP) / baseP) * 100).toFixed(2));
      return { ticker: s.ticker, name: s.name, returnPct };
    });

    const sortedByReturn = [...stockPerformances].sort(
      (a, b) => b.returnPct - a.returnPct
    );

    const summary: BatchSimulationSummary = {
      daysSimulated: daysToRun,
      startDay,
      endDay: engine.state.day,
      startNetWorth,
      endNetWorth,
      netWorthChange,
      netWorthChangePct,
      startCash,
      endCash: engine.state.cash,
      cashChange: Number((engine.state.cash - startCash).toFixed(2)),
      startPortfolioValue,
      endPortfolioValue: engine.state.portfolioValue,
      portfolioChange: Number(
        (engine.state.portfolioValue - startPortfolioValue).toFixed(2)
      ),
      totalDividendsCollected: Number(
        (engine.state.totalDividendsEarned - startDividends).toFixed(2)
      ),
      totalSynergyCollected: Number(
        (engine.state.totalSynergyEarned - startSynergy).toFixed(2)
      ),
      executedTransactionsCount: Math.max(
        0,
        engine.state.transactionSequence - startTxSequence
      ),
      bestPerformingStocks: sortedByReturn.slice(0, 3),
      worstPerformingStocks: [...sortedByReturn].reverse().slice(0, 3),
      generatedNewsCount: daysToRun,
      ipoEvents,
      takeoverEvents,
      companyRevenueDelta: Number(
        (
          (engine.state.playerCompany?.annualizedRevenue || 0) - startCompanyRev
        ).toFixed(2)
      ),
      companyEbitdaDelta: Number(
        (
          (engine.state.playerCompany?.annualizedEbitda || 0) - startCompanyEbitda
        ).toFixed(2)
      ),
      integrityErrors,
    };

    engine.state.lastBatchSummary = summary;

    printLine(
      '================================================================================'
    );
    printLine(
      `  ${daysToRun} GÜNLÜK SİMÜLASYON ÖZETİ: Başlangıç Net Varlık: ${engine.formatCurrency(startNetWorth)} -> Bitiş Net Varlık: ${engine.formatCurrency(endNetWorth)} (${netWorthChange >= 0 ? '+' : ''}${netWorthChangePct}%) | Bütünlük Hatası: ${integrityErrors.length}`
    );
    printLine(
      '================================================================================'
    );

    return {
      logs: engine.state.dailyLogs,
      consoleLines,
      summary,
      finalState: engine.state,
    };
  }
