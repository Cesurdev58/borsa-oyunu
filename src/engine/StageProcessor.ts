/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MALİ YENİDEN HESAPLAMA VE AŞAMA GEÇİŞLERİ
 * (SimulationEngine dosyasından ayrıldı. Fonksiyonlar ilk parametre olarak motoru alır; dış dünya hâlâ SimulationEngine.* üzerinden çağırır.)
 */

import {
  AccountingEngine,
} from './AccountingEngine';
import {
  BankLoanEngine,
} from './BankLoanEngine';
import {
  CentralLedgerEngine,
} from './CentralLedgerEngine';
import {
  CompanyEngine,
} from './CompanyEngine';
import {
  MarketEngine,
} from './MarketEngine';
import {
  TradeAndShopEngine,
} from './TradeAndShopEngine';
import { ProgressionRules } from './ProgressionRules';
import type {
  SimulationEngine,
} from './SimulationEngine';

export function recalculateFinancialsAndStages(engine: SimulationEngine): void {
    engine.syncPlayerCashBuckets();

    let portfolioVal = 0;
    for (const stock of engine.state.stocks) {
      const pos = engine.state.portfolio[stock.ticker];
      const sharesOwned = pos ? pos.shares : 0;
      stock.playerOwnershipPct = Number(
        ((sharesOwned / stock.totalShares) * 100).toFixed(2)
      );
      stock.controlLevel = MarketEngine.computeControlLevel(
        stock.playerOwnershipPct
      );
      if (sharesOwned > 0) {
        portfolioVal += sharesOwned * stock.price;
      }
    }
    engine.state.portfolioValue = Number(portfolioVal.toFixed(2));

    if (engine.state.playerCompany) {
      CompanyEngine.ensureCompanyV5Fields(
        engine.state.playerCompany,
        engine.state.macro
      );
      engine.state.playerCompany.creditScore = BankLoanEngine.computeCreditScore(
        engine.state
      );
    }

    const nonIncorporatedShopEquity =
      TradeAndShopEngine.computeNonIncorporatedShopsEquity(engine.state);
    const privateCompanyEquity = Number(
      (
        (engine.state.playerCompany && !engine.state.playerCompany.isPubliclyListed
          ? engine.state.playerCompany.equityValue
          : 0) + nonIncorporatedShopEquity
      ).toFixed(2)
    );

    engine.state.totalDebt = Number(
      (engine.state.shortTermDebt + engine.state.longTermDebt).toFixed(2)
    );

    const totalPlayerAndHoldingCash = Number(
      (engine.state.cash + (engine.state.holdingCash || 0)).toFixed(2)
    );

    engine.state.netWorth = Number(
      (
        totalPlayerAndHoldingCash +
        engine.state.portfolioValue +
        privateCompanyEquity +
        engine.state.accruedDividendsReceivable -
        engine.state.totalDebt
      ).toFixed(2)
    );

    engine.state.playerFinancials = {
      cash: engine.state.cash,
      portfolioMarketValue: engine.state.portfolioValue,
      playerCompanyEquityValue: privateCompanyEquity,
      accruedDividendsReceivable: engine.state.accruedDividendsReceivable,
      shortTermDebt: engine.state.shortTermDebt,
      longTermDebt: engine.state.longTermDebt,
      totalDebt: engine.state.totalDebt,
      netWorth: engine.state.netWorth,
    };

    const benchmarkStocks = engine.state.stocks.filter((s) => !s.isPlayerCompany);
    const avgPrice =
      benchmarkStocks.reduce((sum, s) => sum + s.price, 0) /
      Math.max(1, benchmarkStocks.length);
    engine.state.marketIndex = Number(((avgPrice / 92.6375) * 1000).toFixed(2));

    if (engine.state.marketIndexHistory.length < engine.state.day) {
      engine.state.marketIndexHistory.push(engine.state.marketIndex);
      engine.state.netWorthHistory.push(engine.state.netWorth);
    } else {
      engine.state.marketIndexHistory[engine.state.marketIndexHistory.length - 1] =
        engine.state.marketIndex;
      engine.state.netWorthHistory[engine.state.netWorthHistory.length - 1] =
        engine.state.netWorth;
    }

    // Aşama kilitleri ve güncel aşama tek kural dosyasından gelir.
    ProgressionRules.applyUnlocksAndStage(engine.state);

    BankLoanEngine.syncCollateralPool(engine.state);
    const reservedCashNow = engine.getReservedCash();
    CentralLedgerEngine.syncLedgerWithState(engine.state, reservedCashNow);

    engine.state.lastIntegrityAudit =
      AccountingEngine.auditSimulationIntegrity(engine.state);
    engine.state.lastFinancialIntegrityReport =
      CentralLedgerEngine.runFinancialIntegrityAudit(
        engine.state,
        reservedCashNow
      );
  }
