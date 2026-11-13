/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 9: HOLDİNG VE DÜŞMANCA DEVRALMA MOTORU (MergerAcquisitionEngine)
 * - 7 Kontrol Seviyesi (%5, %10, %25, %33, >%50, %67, %100)
 * - Piyasadan pay toplama likidite etkisi, kontrol primi, zorunlu çağrı (tender offer)
 * - NPC yönetim savunması (Poison Pill), rakip teklif (White Knight / Rival Bid) olasılığı
 * - Satın alma finansmanı (kredi kullanımı ve faiz maliyeti), entegrasyon maliyeti ve konsolidasyon
 * - İştirak değerinin ve nakit akışının iki kez sayılmasını önleyen konsolidasyon kuralları.
 */

import { HOLDING_PAYOUT_RATIO } from '../data/gameBalance';
import { MacroEconomyState } from '../models/economy';
import { MarketStock } from '../models/market';
import { PortfolioPosition } from '../models/player';
import { TakeoverResult } from '../models/simulation';
import { MarketEngine } from './MarketEngine';
import { RandomEngine } from './RandomEngine';

export class MergerAcquisitionEngine {
  /**
   * Arayüz için devralma bedeli tahmini (%51 için). Rakip teklif şansı hariçtir, gerçek bedel biraz yüksek çıkabilir.
   */
  public static estimateTakeover(stock: MarketStock, ownedShares: number): {
    estimatedCost: number;
    premiumPct: number;
    dailyPayout: number;
  } {
    const prevPct = (ownedShares / Math.max(1, stock.totalShares)) * 100;
    const targetShares = Math.floor(stock.totalShares * 0.51) + 1;
    const needed = Math.max(0, targetShares - ownedShares);
    const premium =
      0.2 + 0.08 * Math.max(0, stock.sentimentScore * 10) + (prevPct < 10 ? 0.06 : 0);
    const cost = needed * stock.askPrice * (1 + premium) * 1.018;
    const dailyPayout =
      Math.max(0, stock.financials.netIncome / 120) * HOLDING_PAYOUT_RATIO * 0.51;
    return {
      estimatedCost: Math.round(cost),
      premiumPct: Math.round(premium * 100),
      dailyPayout: Math.round(dailyPayout),
    };
  }

  /**
   * Rakip bir NPC şirketine çoğunluk kontrolü (>%50) veya tam sahiplik için Düşmanca Devralma
   * Çağrısı (Hostile Takeover Tender Offer) düzenler.
   */
  public static executeTakeoverTenderOffer(params: {
    stock: MarketStock;
    targetOwnershipPct?: number; // Varsayılan %51.0
    useDebtFinancing?: boolean; // Eksik nakit varsa %40'a kadar satın alma kredisi (LBO) kullan
    playerCash: number;
    playerLongTermDebt: number;
    portfolio: Record<string, PortfolioPosition>;
    controlledSubsidiaries: string[];
    macro: MacroEconomyState;
    currentDay: number;
    rng: RandomEngine;
  }): {
    result: TakeoverResult;
    newPlayerCash: number;
    newPlayerLongTermDebt: number;
  } {
    const {
      stock,
      targetOwnershipPct = 51.0,
      useDebtFinancing = false,
      playerCash,
      playerLongTermDebt,
      portfolio,
      controlledSubsidiaries,
      macro,
      currentDay,
      rng,
    } = params;

    if (!stock || stock.isPlayerCompany) {
      return {
        result: {
          success: false,
          message: 'Devralınacak geçerli bir rakip NPC şirketi seçilmelidir.',
          ticker: stock ? stock.ticker : '',
          companyName: '',
          previousOwnershipPct: 0,
          newOwnershipPct: 0,
          controlLevelBefore: 'NONE',
          controlLevelAfter: 'NONE',
          sharesAcquiredInTender: 0,
          tenderOfferPrice: 0,
          controlPremiumPct: 0,
          defenseTriggered: false,
          rivalBidOccurred: false,
          rivalBidPremiumPct: 0,
          debtFinancingUsed: 0,
          interestRateOnFinancing: 0,
          integrationCostPaid: 0,
          totalTenderCost: 0,
          estimatedDailySynergyDividend: 0,
        },
        newPlayerCash: playerCash,
        newPlayerLongTermDebt: playerLongTermDebt,
      };
    }

    const pos = portfolio[stock.ticker] || {
      ticker: stock.ticker,
      shares: 0,
      averageCost: 0,
      totalDividendCollected: 0,
      lastPurchaseDay: currentDay,
    };

    const previousOwnershipPct = Number(((pos.shares / stock.totalShares) * 100).toFixed(2));
    const controlLevelBefore = MarketEngine.computeControlLevel(previousOwnershipPct);

    if (stock.isControlledByPlayer && previousOwnershipPct >= targetOwnershipPct) {
      return {
        result: {
          success: false,
          message: `${stock.name} (${stock.ticker}) zaten %${previousOwnershipPct.toFixed(1)} oranıyla Holding kontrolünüz altındadır.`,
          ticker: stock.ticker,
          companyName: stock.name,
          previousOwnershipPct,
          newOwnershipPct: previousOwnershipPct,
          controlLevelBefore,
          controlLevelAfter: controlLevelBefore,
          sharesAcquiredInTender: 0,
          tenderOfferPrice: stock.price,
          controlPremiumPct: 0,
          defenseTriggered: false,
          rivalBidOccurred: false,
          rivalBidPremiumPct: 0,
          debtFinancingUsed: 0,
          interestRateOnFinancing: 0,
          integrationCostPaid: 0,
          totalTenderCost: 0,
          estimatedDailySynergyDividend: 0,
        },
        newPlayerCash: playerCash,
        newPlayerLongTermDebt: playerLongTermDebt,
      };
    }

    const cleanTargetPct = Math.max(51.0, Math.min(100.0, targetOwnershipPct));
    const targetShares = Math.min(
      stock.totalShares,
      Math.floor(stock.totalShares * (cleanTargetPct / 100)) + (cleanTargetPct < 100 ? 1 : 0)
    );
    const sharesNeeded = Math.max(0, targetShares - pos.shares);

    // 1. Baz Kontrol Primi + Likidite Etkisi
    const baseControlPremium = 0.2 + 0.08 * Math.max(0, stock.sentimentScore * 10);

    // 2. NPC Yönetim Savunması (Eğer oyuncunun mevcut payı %10'un altındaysa yönetim savunması maliyeti artırır)
    const defenseTriggered = previousOwnershipPct < 10.0;
    const defensePremium = defenseTriggered ? 0.06 : 0.0;
    stock.poisonPillActive = defenseTriggered;

    // 3. Rakip Teklif (White Knight / Rival Bid) Olasılığı (%25 ihtimalle rakip fon fiyat artırır)
    const rivalBidOccurred = rng.uniform() < 0.25 && previousOwnershipPct < 33.0;
    const rivalBidPremium = rivalBidOccurred ? Number((0.04 + rng.uniform() * 0.05).toFixed(4)) : 0;

    const totalPremium = Number(
      (baseControlPremium + defensePremium + rivalBidPremium).toFixed(4)
    );
    const tenderOfferPrice = Number((stock.askPrice * (1 + totalPremium)).toFixed(2));
    const sharesPurchaseCost = Number((sharesNeeded * tenderOfferPrice).toFixed(2));

    // 4. Satın Alma Sonrası Entegrasyon ve Hukuki Danışmanlık Maliyeti (%1.8)
    const integrationCostPaid = Number((sharesPurchaseCost * 0.018).toFixed(2));
    const totalTenderCost = Number((sharesPurchaseCost + integrationCostPaid).toFixed(2));

    // 5. Finansman Kontrolü (Nakit + İsteğe Bağlı LBO Kredi Finansmanı)
    const maxDebtAllowed = useDebtFinancing ? Number((totalTenderCost * 0.4).toFixed(2)) : 0;
    const maxPurchasingPower = playerCash + maxDebtAllowed;

    if (totalTenderCost > maxPurchasingPower) {
      return {
        result: {
          success: false,
          message: `${stock.ticker} devralması için ₺${totalTenderCost.toLocaleString('tr-TR')} gerekiyor (Çağrı Fiyatı: ${tenderOfferPrice.toFixed(2)} TL, Prim: %${(totalPremium * 100).toFixed(1)}, Entegrasyon: ₺${integrationCostPaid.toLocaleString('tr-TR')}). Mevcut Nakit: ₺${playerCash.toLocaleString('tr-TR')}.`,
          ticker: stock.ticker,
          companyName: stock.name,
          previousOwnershipPct,
          newOwnershipPct: previousOwnershipPct,
          controlLevelBefore,
          controlLevelAfter: controlLevelBefore,
          sharesAcquiredInTender: 0,
          tenderOfferPrice,
          controlPremiumPct: Number((totalPremium * 100).toFixed(1)),
          defenseTriggered,
          rivalBidOccurred,
          rivalBidPremiumPct: Number((rivalBidPremium * 100).toFixed(1)),
          debtFinancingUsed: 0,
          interestRateOnFinancing: Number((macro.policyInterestRate * 100).toFixed(1)),
          integrationCostPaid: 0,
          totalTenderCost,
          estimatedDailySynergyDividend: 0,
        },
        newPlayerCash: playerCash,
        newPlayerLongTermDebt: playerLongTermDebt,
      };
    }

    const debtFinancingUsed =
      totalTenderCost > playerCash
        ? Number((totalTenderCost - playerCash).toFixed(2))
        : 0;
    const cashUsed = Number((totalTenderCost - debtFinancingUsed).toFixed(2));

    const newPlayerCash = Number((playerCash - cashUsed).toFixed(2));
    const newPlayerLongTermDebt = Number(
      (playerLongTermDebt + debtFinancingUsed).toFixed(2)
    );

    // Payların Holding Portföyüne Geçirilmesi
    const prevBasis = pos.shares * pos.averageCost;
    const newTotalShares = pos.shares + sharesNeeded;
    pos.averageCost = Number(
      ((prevBasis + sharesPurchaseCost) / Math.max(1, newTotalShares)).toFixed(4)
    );
    pos.shares = newTotalShares;
    pos.lastPurchaseDay = currentDay;
    portfolio[stock.ticker] = pos;

    stock.isControlledByPlayer = true;
    stock.playerOwnershipPct = Number(
      ((newTotalShares / stock.totalShares) * 100).toFixed(2)
    );
    const controlLevelAfter = MarketEngine.computeControlLevel(stock.playerOwnershipPct);
    stock.controlLevel = controlLevelAfter;
    stock.integrationDaysRemaining = 5; // 5 günlük entegrasyon süreci

    // Çağrı sonrası piyasa fiyatı çağrı fiyatına doğru kısmen yakınsar
    stock.price = Number((stock.price * 0.75 + tenderOfferPrice * 0.25).toFixed(2));
    const halfSpread = (stock.spreadBps / 10_000) * 0.5;
    stock.bidPrice = Number((stock.price * (1 - halfSpread)).toFixed(2));
    stock.askPrice = Number((stock.price * (1 + halfSpread)).toFixed(2));
    stock.equityValue = Number((stock.price * stock.totalShares).toFixed(2));

    if (!controlledSubsidiaries.includes(stock.ticker)) {
      controlledSubsidiaries.push(stock.ticker);
    }

    const estimatedDailySynergyDividend = Number(
      (
        Math.max(0, stock.financials.netIncome / 120) *
        HOLDING_PAYOUT_RATIO *
        (stock.playerOwnershipPct / 100)
      ).toFixed(2)
    );

    return {
      result: {
        success: true,
        message: `DÜŞMANCA DEVRALMA TAMAMLANDI: ${stock.name} (${stock.ticker}) şirketinin %${stock.playerOwnershipPct.toFixed(1)} kontrol payı ele geçirildi! (Toplam Maliyet: ₺${totalTenderCost.toLocaleString('tr-TR')}, Kontrol Primi: %${(totalPremium * 100).toFixed(1)})`,
        ticker: stock.ticker,
        companyName: stock.name,
        previousOwnershipPct,
        newOwnershipPct: stock.playerOwnershipPct,
        controlLevelBefore,
        controlLevelAfter,
        sharesAcquiredInTender: sharesNeeded,
        tenderOfferPrice,
        controlPremiumPct: Number((totalPremium * 100).toFixed(1)),
        defenseTriggered,
        rivalBidOccurred,
        rivalBidPremiumPct: Number((rivalBidPremium * 100).toFixed(1)),
        debtFinancingUsed,
        interestRateOnFinancing: Number((macro.policyInterestRate * 100).toFixed(1)),
        integrationCostPaid,
        totalTenderCost,
        estimatedDailySynergyDividend,
      },
      newPlayerCash,
      newPlayerLongTermDebt,
    };
  }
}
