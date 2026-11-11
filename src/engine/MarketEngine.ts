/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 3: PİYASA VE FİYAT MOTORU (MarketEngine)
 * Günlük logaritmik getiri bileşenleri:
 * r_t = (mu - 0.5 * sigma^2) * dt
 *     + sigma * sqrt(dt) * epsilon
 *     + haberEtkisi
 *     + temelDegerEtkisi
 *     + sektorEtkisi
 *     + makroEkonomiEtkisi
 *     + arzTalepEtkisi
 *     + likiditeEtkisi
 * Yeni Fiyat: S_{t+1} = max(minimumFiyat, S_t * exp(r_t)), dt = 1 / 252
 */

import { NPC_COMPANY_BLUEPRINTS } from '../data/npcCompanies';
import { SECTOR_CONFIGS } from '../data/sectors';
import { MacroEconomyState } from '../models/economy';
import { ControlThresholdLevel, MarketStock } from '../models/market';
import { PortfolioPosition } from '../models/player';
import { OrderExecutionResult } from '../models/transactions';
import { AccountingEngine } from './AccountingEngine';
import { EconomyEngine } from './EconomyEngine';
import { RandomEngine } from './RandomEngine';
import { ValuationEngine } from './ValuationEngine';

export class MarketEngine {
  public static readonly DT = 1 / 252;
  public static readonly MINIMUM_STOCK_PRICE = 1.0;
  public static readonly DAILY_MAX_LOG_RETURN = 0.18; // Günlük tavan/taban marj sınırı (~%20)
  public static readonly COMMISSION_RATE = 0.0015; // %0.15 borsa komisyonu

  /**
   * Pay sahipliği oranına göre Aşama 9 kontrol eşiğini belirler.
   */
  public static computeControlLevel(ownershipPct: number): ControlThresholdLevel {
    if (ownershipPct >= 99.9) return 'FULL_100';
    if (ownershipPct >= 67.0) return 'SUPERMAJORITY_67';
    if (ownershipPct > 50.0) return 'MAJORITY_50';
    if (ownershipPct >= 33.0) return 'BLOCKING_33';
    if (ownershipPct >= 25.0) return 'MINORITY_25';
    if (ownershipPct >= 10.0) return 'STRATEGIC_10';
    if (ownershipPct >= 5.0) return 'SIGNIFICANT_5';
    return 'NONE';
  }

  /**
   * 16 kurgusal NPC şirketini tam muhasebe bilançosu ve 5-yöntemli değerlemeyle oluşturur.
   */
  public static createInitialMarketStocks(macro: MacroEconomyState): MarketStock[] {
    return NPC_COMPANY_BLUEPRINTS.map((bp) => {
      const sectorCfg = SECTOR_CONFIGS[bp.sector];
      const marketCap = bp.initialPrice * bp.totalShares;
      const initialEquityCapital = Number((marketCap / (sectorCfg.basePbMultiple * 0.72)).toFixed(2));

      const financials = AccountingEngine.createInitialFinancialStatement({
        sector: bp.sector,
        initialEquityCapital,
        debtRatio: bp.debtRatio,
        sharesOutstanding: bp.totalShares,
        staffCount: bp.staffCount,
        productionCapacityUnits: bp.productionCapacityUnits,
        dividendYieldAnnual: bp.dividendYieldAnnual,
        sharePrice: bp.initialPrice,
        corporateTaxRate: macro.corporateTaxRate,
        policyInterestRate: macro.policyInterestRate,
      });

      const valuation = ValuationEngine.computeCompanyValuation(
        financials,
        bp.sector,
        macro,
        1.0
      );

      const halfSpread = (bp.spreadBps / 10_000) * 0.5;
      const bidPrice = Number((bp.initialPrice * (1 - halfSpread)).toFixed(2));
      const askPrice = Number((bp.initialPrice * (1 + halfSpread)).toFixed(2));

      return {
        ticker: bp.ticker,
        name: bp.name,
        sector: bp.sector,
        price: bp.initialPrice,
        bidPrice,
        askPrice,
        spreadBps: bp.spreadBps,
        previousPrice: bp.initialPrice,
        dailyChangePct: 0,
        priceHistory: [bp.initialPrice],
        muBase: sectorCfg.baseDrift,
        sigma: sectorCfg.baseVolatility,
        newsSensitivity: bp.newsSensitivity,
        sentimentScore: 0.001,
        sentimentDecay: 0.3,
        liquidityDepthLots: bp.liquidityDepthLots,
        netOrderFlowLots: 0,
        dividendYieldAnnual: bp.dividendYieldAnnual,
        dividendPeriodDays: 10,
        lastExDividendDay: 0,
        totalShares: bp.totalShares,
        freeFloatRatio: bp.freeFloatRatio,
        ebitdaAnnual: financials.EBITDA,
        enterpriseValue: Number((bp.initialPrice * bp.totalShares + financials.totalLiabilities - financials.cash).toFixed(2)),
        equityValue: Number((bp.initialPrice * bp.totalShares).toFixed(2)),
        fundamentalPrice: valuation.fairValuePerShare,
        financials,
        valuation,
        quarterlyReports: [
          AccountingEngine.createQuarterlyReport(financials, 1, macro.corporateTaxRate),
        ],
        isPlayerCompany: false,
        isControlledByPlayer: false,
        playerOwnershipPct: 0,
        controlLevel: 'NONE',
        poisonPillActive: false,
        integrationDaysRemaining: 0,
      };
    });
  }

  /**
   * Her hisse için çok bileşenli günlük logaritmik getiriyi hesaplar ve fiyatları günceller.
   */
  public static stepMarketPricesOneDay(
    stocks: MarketStock[],
    macro: MacroEconomyState,
    rng: RandomEngine
  ): void {
    const dt = MarketEngine.DT;

    // Sektör bazlı ortak şokları üret
    const sectorShocks: Record<string, number> = {};
    for (const secKey of Object.keys(SECTOR_CONFIGS)) {
      sectorShocks[secKey] = rng.normal() * 0.0035;
    }

    for (const stock of stocks) {
      stock.previousPrice = stock.price;
      const epsilon = rng.normal();

      // 1. GBM baz terimleri: (mu - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * epsilon
      const driftTerm = (stock.muBase - 0.5 * stock.sigma * stock.sigma) * dt;
      const diffusionTerm = stock.sigma * Math.sqrt(dt) * epsilon;

      // 2. Haber Etkisi (şirketin duyarlılığı ile ağırlıklandırılmış)
      const haberEtkisi = Math.max(-0.035, Math.min(0.035, stock.sentimentScore * 0.65));

      // 3. Temel Değer Etkisi (Fiyatın şirketin 5-yöntemli adil değerine yakınsama eğilimi)
      const fundamentalPrice = Math.max(1.0, stock.valuation.fairValuePerShare);
      stock.fundamentalPrice = fundamentalPrice;
      const valuationGap = Math.log(fundamentalPrice / Math.max(1.0, stock.price));
      const temelDegerEtkisi = Math.max(-0.012, Math.min(0.012, valuationGap * 0.035));

      // 4. Sektör Etkisi
      const sektorEtkisi = sectorShocks[stock.sector] || 0;

      // 5. Makroekonomi Etkisi
      const makroEkonomiEtkisi = EconomyEngine.computeDailyMacroReturnEffect(
        macro,
        stock.sector
      );

      // 6. Arz-Talep Etkisi (Günlük net emir akışı / tahta derinliği)
      const depth = Math.max(1000, stock.liquidityDepthLots);
      const orderImbalance = stock.netOrderFlowLots / depth;
      const arzTalepEtkisi = Math.max(-0.025, Math.min(0.025, orderImbalance * 0.04));

      // 7. Likidite Etkisi (Düşük halka açıklık veya yüksek hacim sıkışması)
      const illiquidityFactor = (1 - stock.freeFloatRatio) * 0.001 * Math.sign(orderImbalance);
      const likiditeEtkisi = Math.max(-0.005, Math.min(0.005, illiquidityFactor));

      const rawLogReturn =
        driftTerm +
        diffusionTerm +
        haberEtkisi +
        temelDegerEtkisi +
        sektorEtkisi +
        makroEkonomiEtkisi +
        arzTalepEtkisi +
        likiditeEtkisi;

      const boundedLogReturn = Math.max(
        -MarketEngine.DAILY_MAX_LOG_RETURN,
        Math.min(MarketEngine.DAILY_MAX_LOG_RETURN, rawLogReturn)
      );

      const nextPriceRaw = stock.price * Math.exp(boundedLogReturn);
      const safePrice = Number.isFinite(nextPriceRaw)
        ? Math.max(MarketEngine.MINIMUM_STOCK_PRICE, nextPriceRaw)
        : stock.previousPrice;

      stock.price = Number(safePrice.toFixed(2));
      const halfSpread = (stock.spreadBps / 10_000) * 0.5;
      stock.bidPrice = Number(Math.max(0.5, stock.price * (1 - halfSpread)).toFixed(2));
      stock.askPrice = Number(Math.max(stock.bidPrice + 0.01, stock.price * (1 + halfSpread)).toFixed(2));

      stock.dailyChangePct = Number(
        (((stock.price - stock.previousPrice) / Math.max(0.01, stock.previousPrice)) * 100).toFixed(2)
      );
      stock.priceHistory.push(stock.price);
      if (stock.priceHistory.length > 120) {
        stock.priceHistory.shift();
      }

      stock.equityValue = Number((stock.price * stock.totalShares).toFixed(2));
      stock.enterpriseValue = Number(
        Math.max(
          stock.equityValue * 0.5,
          stock.equityValue + stock.financials.totalLiabilities - stock.financials.cash
        ).toFixed(2)
      );

      // Gün sonu emir akışını sıfırla
      stock.netOrderFlowLots = 0;
    }
  }

  /**
   * Gün İçi (Intraday) Fiyat İlerletme:
   * - Yalnızca piyasa açıkken (MARKET_OPEN: 10:00–17:59, toplam 96 adet 5-dakikalık alt adım) çağrılır.
   * - `tradingDayFraction` (ör. 1/96) ile dt = (1/252) * tradingDayFraction ölçeklenir.
   * - Drift ve deterministik faktörler `tradingDayFraction` ile doğrusal,
   *   stokastik difüzyon terimi ise `sqrt(tradingDayFraction)` ile ölçeklenir;
   *   böylece 96 alt adımın toplam teorik varyansı tam 1 günlük teorik risk ölçeğine eşittir.
   */
  public static stepMarketPricesIntraday(
    stocks: MarketStock[],
    macro: MacroEconomyState,
    rng: RandomEngine,
    tradingDayFraction: number = 1 / 96
  ): void {
    const cleanFraction = Math.max(0.0001, Math.min(1.0, tradingDayFraction));
    const dtSub = MarketEngine.DT * cleanFraction;
    const sqrtFraction = Math.sqrt(cleanFraction);

    const sectorShocks: Record<string, number> = {};
    for (const secKey of Object.keys(SECTOR_CONFIGS)) {
      sectorShocks[secKey] = rng.normal() * 0.0035 * sqrtFraction;
    }

    for (const stock of stocks) {
      const epsilon = rng.normal();

      const driftTerm = (stock.muBase - 0.5 * stock.sigma * stock.sigma) * dtSub;
      const diffusionTerm = stock.sigma * Math.sqrt(dtSub) * epsilon;

      const haberEtkisi =
        Math.max(-0.035, Math.min(0.035, stock.sentimentScore * 0.65)) *
        cleanFraction;

      const fundamentalPrice = Math.max(1.0, stock.valuation.fairValuePerShare);
      stock.fundamentalPrice = fundamentalPrice;
      const valuationGap = Math.log(
        fundamentalPrice / Math.max(1.0, stock.price)
      );
      const temelDegerEtkisi =
        Math.max(-0.012, Math.min(0.012, valuationGap * 0.035)) * cleanFraction;

      const sektorEtkisi = sectorShocks[stock.sector] || 0;

      const makroEkonomiEtkisi =
        EconomyEngine.computeDailyMacroReturnEffect(macro, stock.sector) *
        cleanFraction;

      const depth = Math.max(1000, stock.liquidityDepthLots);
      const orderImbalance = stock.netOrderFlowLots / depth;
      const arzTalepEtkisi =
        Math.max(-0.025, Math.min(0.025, orderImbalance * 0.04)) *
        cleanFraction;

      const illiquidityFactor =
        (1 - stock.freeFloatRatio) * 0.001 * Math.sign(orderImbalance);
      const likiditeEtkisi =
        Math.max(-0.005, Math.min(0.005, illiquidityFactor)) * cleanFraction;

      const rawLogReturn =
        driftTerm +
        diffusionTerm +
        haberEtkisi +
        temelDegerEtkisi +
        sektorEtkisi +
        makroEkonomiEtkisi +
        arzTalepEtkisi +
        likiditeEtkisi;

      const maxSubstepReturn = MarketEngine.DAILY_MAX_LOG_RETURN * Math.max(0.15, sqrtFraction * 1.5);
      const boundedLogReturn = Math.max(
        -maxSubstepReturn,
        Math.min(maxSubstepReturn, rawLogReturn)
      );

      const nextPriceRaw = stock.price * Math.exp(boundedLogReturn);
      const safePrice = Number.isFinite(nextPriceRaw)
        ? Math.max(MarketEngine.MINIMUM_STOCK_PRICE, nextPriceRaw)
        : stock.price;

      stock.price = Number(safePrice.toFixed(2));
      const halfSpread = (stock.spreadBps / 10_000) * 0.5;
      stock.bidPrice = Number(
        Math.max(0.5, stock.price * (1 - halfSpread)).toFixed(2)
      );
      stock.askPrice = Number(
        Math.max(stock.bidPrice + 0.01, stock.price * (1 + halfSpread)).toFixed(2)
      );

      stock.dailyChangePct = Number(
        (
          ((stock.price - stock.previousPrice) /
            Math.max(0.01, stock.previousPrice)) *
          100
        ).toFixed(2)
      );

      stock.equityValue = Number((stock.price * stock.totalShares).toFixed(2));
      stock.enterpriseValue = Number(
        Math.max(
          stock.equityValue * 0.5,
          stock.equityValue +
            stock.financials.totalLiabilities -
            stock.financials.cash
        ).toFixed(2)
      );

      // Gün içi emir akışı sönümlenmesi
      stock.netOrderFlowLots = Math.round(stock.netOrderFlowLots * 0.85);
    }
  }

  /**
   * Bekleyen alış emri (MARKET_BUY veya LIMIT_BUY) için rezerve edilmesi gereken
   * toplam nakit tutarını (komisyon ve piyasa emri kayma payı dahil) hesaplar.
   */
  public static estimateBuyOrderReservation(
    stock: MarketStock,
    sharesToBuy: number,
    limitPrice?: number
  ): number {
    if (!Number.isFinite(sharesToBuy) || sharesToBuy <= 0) return 0;
    const depth = Math.max(1000, stock.liquidityDepthLots);
    const orderDepthRatio = sharesToBuy / depth;
    const slippageFraction =
      typeof limitPrice === 'number'
        ? 0
        : orderDepthRatio <= 0.02
        ? 0
        : Math.min(0.08, Math.pow(orderDepthRatio - 0.02, 1.25) * 0.06);

    const basePrice =
      typeof limitPrice === 'number' && limitPrice > 0
        ? limitPrice
        : stock.askPrice;
    const executionPrice = Number(
      (basePrice * (1 + slippageFraction)).toFixed(4)
    );
    const grossAmount = Number((sharesToBuy * executionPrice).toFixed(2));
    const commission = Number(
      (grossAmount * MarketEngine.COMMISSION_RATE).toFixed(2)
    );
    return Number((grossAmount + commission).toFixed(2));
  }

  /**
   * Atomik Hisse Alım İşlemi:
   * - Nakit, lot, pozitif tam sayı ve tahta derinliği kontrolü işlem öncesinde yapılır.
   * - Küçük emirlerde (<%1 derinlik) fiyat kayması (slippage) ihmal edilebilir düzeydedir.
   * - Büyük emirlerde likiditeye bağlı fiyat kayması ve ask spread uygulanır.
   * - Başarısız işlemde state hiçbir şekilde kısmen değişmez.
   */
  public static executeBuyOrder(params: {
    stock: MarketStock;
    sharesToBuy: number;
    availableCash: number;
    portfolio: Record<string, PortfolioPosition>;
    currentDay: number;
    maxLimitPrice?: number;
  }): {
    result: OrderExecutionResult;
    newCash: number;
  } {
    const {
      stock,
      sharesToBuy,
      availableCash,
      portfolio,
      currentDay,
      maxLimitPrice,
    } = params;

    if (!Number.isFinite(sharesToBuy) || Math.floor(sharesToBuy) !== sharesToBuy || sharesToBuy <= 0) {
      return {
        result: {
          success: false,
          message: 'Alınacak lot miktarı pozitif bir tam sayı olmalıdır.',
          ticker: stock ? stock.ticker : '',
          sharesExecuted: 0,
          executionPrice: 0,
          grossAmount: 0,
          commission: 0,
          slippageBps: 0,
          totalCost: 0,
          netProceeds: 0,
          realizedPnL: 0,
        },
        newCash: availableCash,
      };
    }

    const currentPos = portfolio[stock.ticker];
    const currentOwned = currentPos ? currentPos.shares : 0;
    const maxBuyableLots = Math.max(0, stock.totalShares - currentOwned);

    if (sharesToBuy > maxBuyableLots) {
      return {
        result: {
          success: false,
          message: `Piyasada alınabilir maksimum ${maxBuyableLots.toLocaleString('tr-TR')} lot bulunmaktadır.`,
          ticker: stock.ticker,
          sharesExecuted: 0,
          executionPrice: 0,
          grossAmount: 0,
          commission: 0,
          slippageBps: 0,
          totalCost: 0,
          netProceeds: 0,
          realizedPnL: 0,
        },
        newCash: availableCash,
      };
    }

    // Spread ve Likidite Kayması (Slippage) Hesabı
    const depth = Math.max(1000, stock.liquidityDepthLots);
    const orderDepthRatio = sharesToBuy / depth;
    // Küçük emirlerde (<%2 derinlik) ekstra kayma 0, büyük emirlerde kuadratik likidite kayması
    const slippageFraction =
      orderDepthRatio <= 0.02
        ? 0
        : Math.min(0.08, Math.pow(orderDepthRatio - 0.02, 1.25) * 0.06);
    const slippageBps = Math.round(slippageFraction * 10_000);

    const rawExecutionPrice = Number(
      (stock.askPrice * (1 + slippageFraction)).toFixed(4)
    );
    const executionPrice =
      typeof maxLimitPrice === 'number' && maxLimitPrice > 0
        ? Number(Math.min(maxLimitPrice, rawExecutionPrice).toFixed(4))
        : rawExecutionPrice;
    const grossAmount = Number((sharesToBuy * executionPrice).toFixed(2));
    const commission = Number((grossAmount * MarketEngine.COMMISSION_RATE).toFixed(2));
    const totalCost = Number((grossAmount + commission).toFixed(2));

    if (totalCost > availableCash) {
      return {
        result: {
          success: false,
          message: `Yetersiz nakit bakiye. Gereken: ₺${totalCost.toLocaleString('tr-TR')}, Mevcut: ₺${availableCash.toLocaleString('tr-TR')}`,
          ticker: stock.ticker,
          sharesExecuted: 0,
          executionPrice,
          grossAmount: 0,
          commission: 0,
          slippageBps,
          totalCost: 0,
          netProceeds: 0,
          realizedPnL: 0,
        },
        newCash: availableCash,
      };
    }

    // Atomik State Güncellemesi
    const newCash = Number((availableCash - totalCost).toFixed(2));
    const existingPos = portfolio[stock.ticker] || {
      ticker: stock.ticker,
      shares: 0,
      averageCost: 0,
      totalDividendCollected: 0,
      lastPurchaseDay: currentDay,
    };

    const prevCostBasis = existingPos.shares * existingPos.averageCost;
    const newShares = existingPos.shares + sharesToBuy;
    existingPos.averageCost = Number(((prevCostBasis + totalCost) / newShares).toFixed(4));
    existingPos.shares = newShares;
    existingPos.lastPurchaseDay = currentDay;
    portfolio[stock.ticker] = existingPos;

    // Büyük emirlerde anlık tahta fiyatına sınırlı likidite etkisi
    stock.netOrderFlowLots += sharesToBuy;
    if (orderDepthRatio > 0.05) {
      const immediateImpact = Math.min(0.04, orderDepthRatio * 0.025);
      stock.price = Number((stock.price * (1 + immediateImpact)).toFixed(2));
      const halfSpread = (stock.spreadBps / 10_000) * 0.5;
      stock.bidPrice = Number((stock.price * (1 - halfSpread)).toFixed(2));
      stock.askPrice = Number((stock.price * (1 + halfSpread)).toFixed(2));
    }

    stock.playerOwnershipPct = Number(((newShares / stock.totalShares) * 100).toFixed(2));
    stock.controlLevel = MarketEngine.computeControlLevel(stock.playerOwnershipPct);

    return {
      result: {
        success: true,
        message: `${stock.ticker} hissesinden ${sharesToBuy.toLocaleString('tr-TR')} lot @ ${executionPrice.toFixed(2)} TL alındı (Toplam: ₺${totalCost.toLocaleString('tr-TR')}).`,
        ticker: stock.ticker,
        sharesExecuted: sharesToBuy,
        executionPrice,
        grossAmount,
        commission,
        slippageBps,
        totalCost,
        netProceeds: 0,
        realizedPnL: 0,
      },
      newCash,
    };
  }

  /**
   * Atomik Hisse Satış İşlemi:
   * - Sahip olunmayan veya negatif/sıfır lot satışı engellenir.
   * - Bid fiyatı, büyük emir kayması ve komisyon düşülerek net nakit girişi hesaplanır.
   */
  public static executeSellOrder(params: {
    stock: MarketStock;
    sharesToSell: number;
    availableCash: number;
    portfolio: Record<string, PortfolioPosition>;
    minLimitPrice?: number;
  }): {
    result: OrderExecutionResult;
    newCash: number;
  } {
    const {
      stock,
      sharesToSell,
      availableCash,
      portfolio,
      minLimitPrice,
    } = params;

    if (!Number.isFinite(sharesToSell) || Math.floor(sharesToSell) !== sharesToSell || sharesToSell <= 0) {
      return {
        result: {
          success: false,
          message: 'Satılacak lot miktarı pozitif bir tam sayı olmalıdır.',
          ticker: stock ? stock.ticker : '',
          sharesExecuted: 0,
          executionPrice: 0,
          grossAmount: 0,
          commission: 0,
          slippageBps: 0,
          totalCost: 0,
          netProceeds: 0,
          realizedPnL: 0,
        },
        newCash: availableCash,
      };
    }

    const existingPos = portfolio[stock.ticker];
    if (!existingPos || existingPos.shares < sharesToSell) {
      return {
        result: {
          success: false,
          message: `Portföyde yeterli ${stock.ticker} hissesi bulunmuyor.`,
          ticker: stock.ticker,
          sharesExecuted: 0,
          executionPrice: 0,
          grossAmount: 0,
          commission: 0,
          slippageBps: 0,
          totalCost: 0,
          netProceeds: 0,
          realizedPnL: 0,
        },
        newCash: availableCash,
      };
    }

    const depth = Math.max(1000, stock.liquidityDepthLots);
    const orderDepthRatio = sharesToSell / depth;
    const slippageFraction =
      orderDepthRatio <= 0.02
        ? 0
        : Math.min(0.08, Math.pow(orderDepthRatio - 0.02, 1.25) * 0.06);
    const slippageBps = Math.round(slippageFraction * 10_000);

    const rawExecutionPrice = Number(
      Math.max(0.5, stock.bidPrice * (1 - slippageFraction)).toFixed(4)
    );
    const executionPrice =
      typeof minLimitPrice === 'number' && minLimitPrice > 0
        ? Number(Math.max(minLimitPrice, rawExecutionPrice).toFixed(4))
        : rawExecutionPrice;
    const grossAmount = Number((sharesToSell * executionPrice).toFixed(2));
    const commission = Number((grossAmount * MarketEngine.COMMISSION_RATE).toFixed(2));
    const netProceeds = Number((grossAmount - commission).toFixed(2));
    const costBasis = Number((sharesToSell * existingPos.averageCost).toFixed(2));
    const realizedPnL = Number((netProceeds - costBasis).toFixed(2));

    const newCash = Number((availableCash + netProceeds).toFixed(2));
    existingPos.shares -= sharesToSell;

    if (existingPos.shares === 0) {
      delete portfolio[stock.ticker];
    }

    stock.netOrderFlowLots -= sharesToSell;
    if (orderDepthRatio > 0.05) {
      const immediateImpact = Math.min(0.04, orderDepthRatio * 0.025);
      stock.price = Number(Math.max(1.0, stock.price * (1 - immediateImpact)).toFixed(2));
      const halfSpread = (stock.spreadBps / 10_000) * 0.5;
      stock.bidPrice = Number((stock.price * (1 - halfSpread)).toFixed(2));
      stock.askPrice = Number((stock.price * (1 + halfSpread)).toFixed(2));
    }

    const remainingShares = portfolio[stock.ticker]?.shares || 0;
    stock.playerOwnershipPct = Number(((remainingShares / stock.totalShares) * 100).toFixed(2));
    stock.controlLevel = MarketEngine.computeControlLevel(stock.playerOwnershipPct);
    if (stock.playerOwnershipPct <= 50.0 && !stock.isPlayerCompany) {
      stock.isControlledByPlayer = false;
    }

    return {
      result: {
        success: true,
        message: `${stock.ticker} hissesinden ${sharesToSell.toLocaleString('tr-TR')} lot @ ${executionPrice.toFixed(2)} TL satıldı (Net: ₺${netProceeds.toLocaleString('tr-TR')}, K/Z: ₺${realizedPnL.toLocaleString('tr-TR')}).`,
        ticker: stock.ticker,
        sharesExecuted: sharesToSell,
        executionPrice,
        grossAmount,
        commission,
        slippageBps,
        totalCost: 0,
        netProceeds,
        realizedPnL,
      },
      newCash,
    };
  }
}
