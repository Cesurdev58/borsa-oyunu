/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * EMİR DEFTERİ VE BORSA İŞLEMLERİ: emir verme/iptal/işleme, hisse alım-satım
 * (SimulationEngine dosyasından ayrıldı. Fonksiyonlar ilk parametre olarak motoru alır; dış dünya hâlâ SimulationEngine.* üzerinden çağırır.)
 */

import {
  PendingOrder,
  PendingOrderSide,
  PendingOrderType,
} from '../models/transactions';
import {
  BankLoanEngine,
} from './BankLoanEngine';
import {
  ACCOUNT_IDS,
  CentralLedgerEngine,
} from './CentralLedgerEngine';
import {
  GameClockEngine,
} from './GameClockEngine';
import {
  MarketEngine,
} from './MarketEngine';
import {
  WalletEngine,
} from './WalletEngine';
import type {
  SimulationEngine,
} from './SimulationEngine';

export function placeOrder(engine: SimulationEngine, params: {
    ticker: string;
    orderType: PendingOrderType;
    requestedShares: number;
    limitPrice?: number;
    expiresInDays?: number;
  }): {
    success: boolean;
    message: string;
    order: PendingOrder | null;
  } {
    const { ticker, orderType, requestedShares, limitPrice, expiresInDays } =
      params;

    const stock = engine.state.stocks.find((s) => s.ticker === ticker);
    if (!stock) {
      return {
        success: false,
        message: `${ticker} kodlu hisse bulunamadı.`,
        order: null,
      };
    }

    if (
      !Number.isFinite(requestedShares) ||
      Math.floor(requestedShares) !== requestedShares ||
      requestedShares <= 0
    ) {
      return {
        success: false,
        message: 'Emir lot miktarı pozitif bir tam sayı olmalıdır.',
        order: null,
      };
    }

    const isLimit = orderType === 'LIMIT_BUY' || orderType === 'LIMIT_SELL';
    if (
      isLimit &&
      (typeof limitPrice !== 'number' ||
        !Number.isFinite(limitPrice) ||
        limitPrice <= 0)
    ) {
      return {
        success: false,
        message: 'Limit emirler için geçerli ve pozitif bir limit fiyat girilmelidir.',
        order: null,
      };
    }

    const side: PendingOrderSide =
      orderType === 'MARKET_BUY' || orderType === 'LIMIT_BUY' ? 'BUY' : 'SELL';

    let reservedCash = 0;
    let reservedShares = 0;

    if (side === 'BUY') {
      const currentOwned = engine.state.portfolio[ticker]?.shares || 0;
      const maxBuyable = MarketEngine.maxMarketBuyableShares(stock, currentOwned);
      if (requestedShares > maxBuyable) {
        return {
          success: false,
          message: MarketEngine.marketBuyLimitMessage(stock, maxBuyable),
          order: null,
        };
      }

      reservedCash = MarketEngine.estimateBuyOrderReservation(
        stock,
        requestedShares,
        isLimit ? limitPrice : undefined
      );
      const spendableCash = engine.getSpendableCash();
      if (reservedCash > spendableCash) {
        return {
          success: false,
          message: `Yetersiz kullanılabilir nakit. Gereken Rezerv: ${engine.formatCurrency(reservedCash)}, Kullanılabilir (Rezerv Dışı) Nakit: ${engine.formatCurrency(spendableCash)}`,
          order: null,
        };
      }
    } else {
      if (BankLoanEngine.isStockPledgedAsCollateral(engine.state, ticker)) {
        return {
          success: false,
          message: `${ticker} hissesi aktif bir banka kredisinde teminat olarak kilitlidir; satabilmek için önce ilgili krediyi kapatmalısınız.`,
          order: null,
        };
      }
      const availableShares = engine.getAvailableShares(ticker);
      if (requestedShares > availableShares) {
        return {
          success: false,
          message: `Yetersiz kullanılabilir hisse. İstenen: ${requestedShares} lot, Kullanılabilir (Rezerv Dışı): ${availableShares} lot.`,
          order: null,
        };
      }
      reservedShares = requestedShares;
    }

    const ttlDays =
      typeof expiresInDays === 'number' && Number.isFinite(expiresInDays)
        ? Math.max(1, Math.floor(expiresInDays))
        : 5;

    const nextOrderSeq =
      (typeof engine.state.orderSequence === 'number' &&
      Number.isFinite(engine.state.orderSequence) &&
      engine.state.orderSequence >= 0
        ? Math.floor(engine.state.orderSequence)
        : engine.state.pendingOrders.length) + 1;
    engine.state.orderSequence = nextOrderSeq;

    const order: PendingOrder = {
      id: `ORD-D${engine.state.day}-S${String(nextOrderSeq).padStart(8, '0')}`,
      createdDay: engine.state.day,
      createdGameMinute: engine.state.minutesIntoCurrentDay,
      ticker,
      orderType,
      side,
      requestedShares,
      remainingShares: requestedShares,
      limitPrice: isLimit ? Number(limitPrice!.toFixed(2)) : undefined,
      status: 'PENDING',
      executedShares: 0,
      averageExecutionPrice: 0,
      reservedCash,
      reservedShares,
      expiresAtDay: engine.state.day + ttlDays,
      transactionIds: [],
    };

    engine.state.pendingOrders.unshift(order);
    CentralLedgerEngine.syncLedgerWithState(engine.state, engine.getReservedCash());

    // Eğer piyasa şu anda açıksa uygun emirleri hemen çalıştır
    if (engine.state.marketSession === 'MARKET_OPEN') {
      engine.processPendingOrders();
    }

    const statusText =
      order.status === 'FILLED'
        ? `hemen gerçekleşti (@ ${order.averageExecutionPrice.toFixed(2)} TL)`
        : `kuyruğa alındı (${GameClockEngine.getMarketSessionLabelTR(engine.state.marketSession)})`;

    return {
      success: true,
      message: `${ticker} için ${requestedShares.toLocaleString('tr-TR')} lot ${orderType} emri ${statusText}.`,
      order,
    };
  }

export function cancelOrder(engine: SimulationEngine, orderId: string): {
    success: boolean;
    message: string;
    order: PendingOrder | null;
  } {
    const order = engine.state.pendingOrders.find((o) => o.id === orderId);
    if (!order) {
      return {
        success: false,
        message: `${orderId} numaralı emir bulunamadı.`,
        order: null,
      };
    }

    if (order.status !== 'PENDING' && order.status !== 'PARTIALLY_FILLED') {
      return {
        success: false,
        message: `${orderId} emri zaten ${order.status} durumunda olduğu için iptal edilemez.`,
        order,
      };
    }

    order.status = 'CANCELLED';
    order.reservedCash = 0;
    order.reservedShares = 0;
    CentralLedgerEngine.syncLedgerWithState(engine.state, engine.getReservedCash());

    return {
      success: true,
      message: `${order.ticker} (${order.orderType}) emri iptal edildi ve rezervler serbest bırakıldı.`,
      order,
    };
  }

export function processPendingOrders(engine: SimulationEngine): {
    executedOrdersCount: number;
    executedOrderIds: string[];
  } {
    if (engine.state.marketSession !== 'MARKET_OPEN') {
      return { executedOrdersCount: 0, executedOrderIds: [] };
    }

    let executedOrdersCount = 0;
    const executedOrderIds: string[] = [];

    // Emirleri oluşturulma sırasına göre (eskiden yeniye) işle
    const activeOrders = [...engine.state.pendingOrders]
      .filter((o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED')
      .reverse();

    for (const order of activeOrders) {
      const stock = engine.state.stocks.find((s) => s.ticker === order.ticker);
      if (!stock || order.remainingShares <= 0) continue;

      let canExecute = false;
      if (order.orderType === 'MARKET_BUY' || order.orderType === 'MARKET_SELL') {
        canExecute = true;
      } else if (
        order.orderType === 'LIMIT_BUY' &&
        typeof order.limitPrice === 'number'
      ) {
        canExecute =
          stock.price <= order.limitPrice || stock.askPrice <= order.limitPrice;
      } else if (
        order.orderType === 'LIMIT_SELL' &&
        typeof order.limitPrice === 'number'
      ) {
        canExecute =
          stock.price >= order.limitPrice || stock.bidPrice >= order.limitPrice;
      }

      if (!canExecute) continue;

      const netWorthBefore = engine.state.netWorth;

      if (order.side === 'BUY') {
        const otherReservedCash = Math.max(
          0,
          engine.getReservedCash() - order.reservedCash
        );
        const availableForThisOrder = Number(
          Math.max(0, engine.state.cash - otherReservedCash).toFixed(2)
        );

        const { result, newCash } = MarketEngine.executeBuyOrder({
          stock,
          sharesToBuy: order.remainingShares,
          availableCash: availableForThisOrder,
          portfolio: engine.state.portfolio,
          currentDay: engine.state.day,
          maxLimitPrice:
            order.orderType === 'LIMIT_BUY' ? order.limitPrice : undefined,
        });

        if (result.success) {
          WalletEngine.setBalance(engine.state, newCash + otherReservedCash);
          order.executedShares += result.sharesExecuted;
          order.remainingShares = 0;
          order.averageExecutionPrice = result.executionPrice;
          order.status = 'FILLED';
          order.reservedCash = 0;

          if (
            engine.state.playerCompany &&
            engine.state.playerCompany.ticker === stock.ticker
          ) {
            engine.state.playerCompany.playerOwnedShares =
              engine.state.portfolio[stock.ticker]?.shares || 0;
            engine.state.playerCompany.playerOwnershipPct =
              stock.playerOwnershipPct;
          }

          engine.recalculateFinancialsAndStages();
          const txId = engine.recordTransaction({
            type: 'BUY',
            ticker: stock.ticker,
            shares: result.sharesExecuted,
            executionPrice: result.executionPrice,
            grossAmount: result.grossAmount,
            commission: result.commission,
            slippageBps: result.slippageBps,
            cashDelta: -result.totalCost,
            netWorthBefore,
            netWorthAfter: engine.state.netWorth,
            description: `[${order.orderType}] ${result.message}`,
          });
          order.transactionIds.push(txId);
          CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
            idempotencyKey: `ORD-BUY-${order.id}-${txId}`,
            sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
            destinationAccountId: ACCOUNT_IDS.EQUITY_CAPITAL,
            amount: result.totalCost,
            category: 'STOCK_PURCHASE_COST',
            description: `[${order.orderType}] ${result.message}`,
            relatedCompanyId: stock.ticker,
            reservedOrderCash: engine.getReservedCash(),
          });
          engine.pendingDailyActions.push(`[${order.orderType}] ${result.message}`);
          executedOrdersCount += 1;
          executedOrderIds.push(order.id);
          engine.intradayTracking.ordersExecuted += 1;
        }
      } else {
        const { result, newCash } = MarketEngine.executeSellOrder({
          stock,
          sharesToSell: order.remainingShares,
          availableCash: engine.state.cash,
          portfolio: engine.state.portfolio,
          minLimitPrice:
            order.orderType === 'LIMIT_SELL' ? order.limitPrice : undefined,
        });

        if (result.success) {
          WalletEngine.setBalance(engine.state, newCash);
          order.executedShares += result.sharesExecuted;
          order.remainingShares = 0;
          order.averageExecutionPrice = result.executionPrice;
          order.status = 'FILLED';
          order.reservedShares = 0;

          if (
            engine.state.playerCompany &&
            engine.state.playerCompany.ticker === stock.ticker
          ) {
            engine.state.playerCompany.playerOwnedShares =
              engine.state.portfolio[stock.ticker]?.shares || 0;
            engine.state.playerCompany.playerOwnershipPct =
              stock.playerOwnershipPct;
          }

          engine.recalculateFinancialsAndStages();
          const txId = engine.recordTransaction({
            type: 'SELL',
            ticker: stock.ticker,
            shares: result.sharesExecuted,
            executionPrice: result.executionPrice,
            grossAmount: result.grossAmount,
            commission: result.commission,
            slippageBps: result.slippageBps,
            cashDelta: result.netProceeds,
            netWorthBefore,
            netWorthAfter: engine.state.netWorth,
            description: `[${order.orderType}] ${result.message}`,
          });
          order.transactionIds.push(txId);
          CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
            idempotencyKey: `ORD-SELL-${order.id}-${txId}`,
            sourceAccountId: ACCOUNT_IDS.EQUITY_CAPITAL,
            destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
            amount: result.netProceeds,
            category: 'STOCK_SALE_PROCEEDS',
            description: `[${order.orderType}] ${result.message}`,
            relatedCompanyId: stock.ticker,
            reservedOrderCash: engine.getReservedCash(),
          });
          engine.pendingDailyActions.push(`[${order.orderType}] ${result.message}`);
          executedOrdersCount += 1;
          executedOrderIds.push(order.id);
          engine.intradayTracking.ordersExecuted += 1;
        }
      }
    }

    return { executedOrdersCount, executedOrderIds };
  }

export function expireOutdatedOrders(engine: SimulationEngine, currentDay: number): void {
    for (const order of engine.state.pendingOrders) {
      if (
        (order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED') &&
        currentDay >= order.expiresAtDay
      ) {
        order.status = 'EXPIRED';
        order.reservedCash = 0;
        order.reservedShares = 0;
        engine.intradayTracking.ordersExpired += 1;
      }
    }
  }

export function buyStock(engine: SimulationEngine, ticker: string,
    sharesToBuy: number): {
    success: boolean;
    message: string;
    totalCost: number;
    executionPrice?: number;
    commission?: number;
    slippageBps?: number;
  } {
    const stock = engine.state.stocks.find((s) => s.ticker === ticker);
    if (!stock) {
      return {
        success: false,
        message: `${ticker} kodlu hisse bulunamadı.`,
        totalCost: 0,
      };
    }

    const reservedCash = engine.getReservedCash();
    const spendableCash = engine.getSpendableCash();
    const netWorthBefore = engine.state.netWorth;
    const { result, newCash } = MarketEngine.executeBuyOrder({
      stock,
      sharesToBuy,
      availableCash: spendableCash,
      portfolio: engine.state.portfolio,
      currentDay: engine.state.day,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.message,
        totalCost: 0,
      };
    }

    WalletEngine.setBalance(engine.state, newCash + reservedCash);
    if (
      engine.state.playerCompany &&
      engine.state.playerCompany.ticker === ticker
    ) {
      engine.state.playerCompany.playerOwnedShares =
        engine.state.portfolio[ticker]?.shares || 0;
      engine.state.playerCompany.playerOwnershipPct = stock.playerOwnershipPct;
    }

    engine.recalculateFinancialsAndStages();
    engine.pendingDailyActions.push(result.message);
    const buyTxId = engine.recordTransaction({
      type: 'BUY',
      ticker,
      shares: result.sharesExecuted,
      executionPrice: result.executionPrice,
      grossAmount: result.grossAmount,
      commission: result.commission,
      slippageBps: result.slippageBps,
      cashDelta: -result.totalCost,
      netWorthBefore,
      netWorthAfter: engine.state.netWorth,
      description: result.message,
    });
    CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
      idempotencyKey: `DIRECT-BUY-${buyTxId}`,
      sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      destinationAccountId: ACCOUNT_IDS.EQUITY_CAPITAL,
      amount: result.totalCost,
      category: 'STOCK_PURCHASE_COST',
      description: result.message,
      relatedCompanyId: ticker,
      reservedOrderCash: engine.getReservedCash(),
    });

    return {
      success: true,
      message: result.message,
      totalCost: result.totalCost,
      executionPrice: result.executionPrice,
      commission: result.commission,
      slippageBps: result.slippageBps,
    };
  }

export function sellStock(engine: SimulationEngine, ticker: string,
    sharesToSell: number): {
    success: boolean;
    message: string;
    netProceeds: number;
    realizedPnL: number;
    executionPrice?: number;
    commission?: number;
  } {
    const stock = engine.state.stocks.find((s) => s.ticker === ticker);
    if (!stock) {
      return {
        success: false,
        message: `${ticker} kodlu hisse bulunamadı.`,
        netProceeds: 0,
        realizedPnL: 0,
      };
    }

    if (BankLoanEngine.isStockPledgedAsCollateral(engine.state, ticker)) {
      return {
        success: false,
        message: `${ticker} hissesi aktif bir banka kredisinde teminat olarak kilitlidir; satabilmek için önce ilgili krediyi kapatmalısınız.`,
        netProceeds: 0,
        realizedPnL: 0,
      };
    }

    const availableUnreservedShares = engine.getAvailableShares(ticker);
    if (sharesToSell > availableUnreservedShares) {
      return {
        success: false,
        message: `Portföyde satılabilir (rezerv dışı) yeterli ${ticker} hissesi bulunmuyor (Kullanılabilir: ${availableUnreservedShares} lot).`,
        netProceeds: 0,
        realizedPnL: 0,
      };
    }

    const netWorthBefore = engine.state.netWorth;
    const { result, newCash } = MarketEngine.executeSellOrder({
      stock,
      sharesToSell,
      availableCash: engine.state.cash,
      portfolio: engine.state.portfolio,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.message,
        netProceeds: 0,
        realizedPnL: 0,
      };
    }

    WalletEngine.setBalance(engine.state, newCash);
    if (
      engine.state.playerCompany &&
      engine.state.playerCompany.ticker === ticker
    ) {
      engine.state.playerCompany.playerOwnedShares =
        engine.state.portfolio[ticker]?.shares || 0;
      engine.state.playerCompany.playerOwnershipPct = stock.playerOwnershipPct;
    }

    engine.recalculateFinancialsAndStages();
    engine.pendingDailyActions.push(result.message);
    const sellTxId = engine.recordTransaction({
      type: 'SELL',
      ticker,
      shares: result.sharesExecuted,
      executionPrice: result.executionPrice,
      grossAmount: result.grossAmount,
      commission: result.commission,
      slippageBps: result.slippageBps,
      cashDelta: result.netProceeds,
      netWorthBefore,
      netWorthAfter: engine.state.netWorth,
      description: result.message,
    });
    CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
      idempotencyKey: `DIRECT-SELL-${sellTxId}`,
      sourceAccountId: ACCOUNT_IDS.EQUITY_CAPITAL,
      destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      amount: result.netProceeds,
      category: 'STOCK_SALE_PROCEEDS',
      description: result.message,
      relatedCompanyId: ticker,
      reservedOrderCash: engine.getReservedCash(),
    });

    return {
      success: true,
      message: result.message,
      netProceeds: result.netProceeds,
      realizedPnL: result.realizedPnL,
      executionPrice: result.executionPrice,
      commission: result.commission,
    };
  }
