/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 8: NPC KURUMSAL FONLAR VE PİYASA TALEBİ MOTORU (NPCFundEngine)
 * 6 farklı NPC fon tipi (VALUE, GROWTH, DIVIDEND, INDEX, MOMENTUM, VENTURE)
 * kendi strateji kriterlerine, maksimum pozisyon sınırlarına ve değerleme çarpanlarına göre
 * ikincil piyasada alım-satım emirleri üretir.
 */

import { MacroEconomyState } from '../models/economy';
import { MarketStock } from '../models/market';
import { InstitutionalFund } from '../models/player';
import { RandomEngine } from './RandomEngine';

export class NPCFundEngine {
  /**
   * Her gün NPC fonların ikincil piyasada makul sıklıkta alım-satım yapmasını sağlar.
   */
  public static stepSecondaryMarketFundTrading(
    funds: InstitutionalFund[],
    stocks: MarketStock[],
    macro: MacroEconomyState,
    currentDay: number,
    rng: RandomEngine
  ): void {
    for (const fund of funds) {
      // Performans ve gerçekçilik için her fon ortalama 2-3 günde bir portföy yeniden dengeler
      if (rng.uniform() > 0.45) continue;

      const totalHoldingsValue = stocks.reduce((sum, s) => {
        const lots = fund.holdings[s.ticker] || 0;
        return sum + lots * s.price;
      }, 0);
      const totalFundNav = fund.availableCapital + totalHoldingsValue;

      // Stratejiye göre en cazip hisseyi ve en pahalı hisseyi bul
      const candidateStocks = stocks.filter((s) =>
        fund.preferredSectors.includes(s.sector)
      );
      if (candidateStocks.length === 0) continue;

      const stock = rng.choose(candidateStocks);
      const currentLots = fund.holdings[stock.ticker] || 0;
      const currentPosValue = currentLots * stock.price;
      const posWeight = totalFundNav > 0 ? currentPosValue / totalFundNav : 0;

      const peRatio =
        stock.financials.netIncome > 0
          ? stock.equityValue / stock.financials.netIncome
          : 99;
      const priceToFairRatio = stock.price / Math.max(1, stock.fundamentalPrice);

      let signal = 0; // Pozitif: Alım, Negatif: Satış
      switch (fund.strategyType) {
        case 'VALUE':
          if (priceToFairRatio < 0.94 && peRatio <= fund.targetPeMax) signal = 1;
          else if (priceToFairRatio > 1.12) signal = -1;
          break;
        case 'GROWTH':
          if (stock.sentimentScore > 0 && stock.muBase >= 0.2) signal = 1;
          else if (stock.sentimentScore < -0.015) signal = -1;
          break;
        case 'DIVIDEND':
          if (stock.dividendYieldAnnual >= fund.minDividendYield && priceToFairRatio <= 1.05) {
            signal = 1;
          } else if (stock.dividendYieldAnnual < 0.02) {
            signal = -1;
          }
          break;
        case 'INDEX':
          if (posWeight < 0.06) signal = 1;
          else if (posWeight > fund.maxPositionPct) signal = -1;
          break;
        case 'MOMENTUM':
          if (stock.dailyChangePct > 0.8 && stock.sentimentScore > 0) signal = 1;
          else if (stock.dailyChangePct < -1.2) signal = -1;
          break;
        case 'VENTURE':
          if (stock.isPlayerCompany || stock.sigma >= 0.3) {
            signal = macro.marketRiskAppetite > 0.5 ? 1 : -1;
          }
          break;
      }

      if (signal > 0 && posWeight < fund.maxPositionPct && fund.availableCapital > stock.price * 100) {
        const budget = Math.min(fund.availableCapital * 0.04, totalFundNav * 0.03);
        const lotsToBuy = Math.min(
          Math.floor(stock.liquidityDepthLots * 0.04),
          Math.floor(budget / stock.askPrice)
        );
        if (lotsToBuy >= 10) {
          const cost = Number((lotsToBuy * stock.askPrice).toFixed(2));
          fund.availableCapital = Number((fund.availableCapital - cost).toFixed(2));
          fund.holdings[stock.ticker] = currentLots + lotsToBuy;
          fund.lastTradeDay = currentDay;
          fund.totalVolumeTraded = Number((fund.totalVolumeTraded + cost).toFixed(2));
          stock.netOrderFlowLots += lotsToBuy;
        }
      } else if (signal < 0 && currentLots >= 50) {
        const lotsToSell = Math.min(
          currentLots,
          Math.max(20, Math.floor(currentLots * 0.25))
        );
        const proceeds = Number((lotsToSell * stock.bidPrice).toFixed(2));
        fund.availableCapital = Number((fund.availableCapital + proceeds).toFixed(2));
        fund.holdings[stock.ticker] = currentLots - lotsToSell;
        if (fund.holdings[stock.ticker] <= 0) {
          delete fund.holdings[stock.ticker];
        }
        fund.lastTradeDay = currentDay;
        fund.totalVolumeTraded = Number((fund.totalVolumeTraded + proceeds).toFixed(2));
        stock.netOrderFlowLots -= lotsToSell;
      }
    }
  }
}
