/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 7: HALKA ARZ (IPO) MOTORU (IPOEngine)
 * - Çoklu uygunluk denetimi (asgari faaliyet süresi, ciro, FAVÖK, özkaynak, kurumsal yönetişim puanı, borç/FAVÖK sınırı)
 * - Dinamik talep çarpanı:
 *   demandMultiplier = baseDemand * marketRiskFactor * sectorAttractiveness * companyQuality * valuationDiscountFactor * sizeAdjustment
 * - Birincil (Sermaye Artırımı - şirkete nakit) ve İkincil (Ortak Satışı - oyuncuya nakit) pay ayrımı
 * - Çift sayım (double-counting) engeli: Şirket borsaya kote olduğunda özel şirket özkaynağı sıfırlanır ve
 *   oyuncunun elinde kalan paylar borsa portföyünden değerlenir.
 */

import { SECTOR_CONFIGS } from '../data/sectors';
import { PlayerCompany } from '../models/company';
import { MacroEconomyState } from '../models/economy';
import { MarketStock } from '../models/market';
import { InstitutionalFund, PortfolioPosition } from '../models/player';
import { IPOEligibilityResult, IPOExecutionResult } from '../models/simulation';
import { MarketEngine } from './MarketEngine';
import { CompanyWallet } from './CompanyWallet';

export class IPOEngine {
  public static readonly MIN_OPERATING_DAYS = 5;
  public static readonly MIN_ANNUAL_REVENUE = 1_500_000;
  public static readonly MIN_EBITDA = 150_000;
  public static readonly MIN_EQUITY = 750_000;
  public static readonly MIN_GOVERNANCE_SCORE = 70;
  public static readonly MAX_DEBT_TO_EBITDA = 4.0;

  /**
   * Şirketin Halka Arz (IPO) koşullarını sağlayıp sağlamadığını kontrol eder.
   */
  public static checkEligibility(company: PlayerCompany | null): IPOEligibilityResult {
    if (!company) {
      return {
        eligible: false,
        minOperatingDaysRequired: IPOEngine.MIN_OPERATING_DAYS,
        currentOperatingDays: 0,
        minAnnualRevenueRequired: IPOEngine.MIN_ANNUAL_REVENUE,
        currentAnnualRevenue: 0,
        minEbitdaRequired: IPOEngine.MIN_EBITDA,
        currentEbitda: 0,
        minEquityRequired: IPOEngine.MIN_EQUITY,
        currentEquity: 0,
        minGovernanceScoreRequired: IPOEngine.MIN_GOVERNANCE_SCORE,
        currentGovernanceScore: 0,
        maxDebtToEbitdaAllowed: IPOEngine.MAX_DEBT_TO_EBITDA,
        currentDebtToEbitda: 0,
        reasons: ['Henüz kurulmuş bir şirketiniz bulunmuyor.'],
      };
    }

    const reasons: string[] = [];
    if (company.isPubliclyListed) {
      reasons.push('Şirket zaten halka açık olarak borsada işlem görüyor.');
    }
    if (company.operatingDays < IPOEngine.MIN_OPERATING_DAYS) {
      reasons.push(
        `Asgari faaliyet süresi (${IPOEngine.MIN_OPERATING_DAYS} gün) tamamlanmadı (Mevcut: ${company.operatingDays} gün).`
      );
    }
    if (company.annualizedRevenue < IPOEngine.MIN_ANNUAL_REVENUE) {
      reasons.push(
        `Yıllıklandırılmış ciro en az ₺${IPOEngine.MIN_ANNUAL_REVENUE.toLocaleString('tr-TR')} olmalıdır.`
      );
    }
    if (company.annualizedEbitda < IPOEngine.MIN_EBITDA) {
      reasons.push(
        `Yıllıklandırılmış FAVÖK en az ₺${IPOEngine.MIN_EBITDA.toLocaleString('tr-TR')} olmalıdır.`
      );
    }
    if (company.financials.shareholdersEquity < IPOEngine.MIN_EQUITY) {
      reasons.push(
        `Şirket özkaynakları en az ₺${IPOEngine.MIN_EQUITY.toLocaleString('tr-TR')} olmalıdır.`
      );
    }
    if (company.corporateGovernanceScore < IPOEngine.MIN_GOVERNANCE_SCORE) {
      reasons.push(
        `Kurumsal yönetişim puanı en az ${IPOEngine.MIN_GOVERNANCE_SCORE} olmalıdır.`
      );
    }

    const debtToEbitda =
      company.annualizedEbitda > 0
        ? Number((company.financials.totalLiabilities / company.annualizedEbitda).toFixed(2))
        : 99;

    if (debtToEbitda > IPOEngine.MAX_DEBT_TO_EBITDA) {
      reasons.push(
        `Net Borç / FAVÖK oranı maksimum ${IPOEngine.MAX_DEBT_TO_EBITDA}x sınırını aşıyor (${debtToEbitda}x).`
      );
    }

    return {
      eligible: reasons.length === 0,
      minOperatingDaysRequired: IPOEngine.MIN_OPERATING_DAYS,
      currentOperatingDays: company.operatingDays,
      minAnnualRevenueRequired: IPOEngine.MIN_ANNUAL_REVENUE,
      currentAnnualRevenue: company.annualizedRevenue,
      minEbitdaRequired: IPOEngine.MIN_EBITDA,
      currentEbitda: company.annualizedEbitda,
      minEquityRequired: IPOEngine.MIN_EQUITY,
      currentEquity: company.financials.shareholdersEquity,
      minGovernanceScoreRequired: IPOEngine.MIN_GOVERNANCE_SCORE,
      currentGovernanceScore: company.corporateGovernanceScore,
      maxDebtToEbitdaAllowed: IPOEngine.MAX_DEBT_TO_EBITDA,
      currentDebtToEbitda: debtToEbitda,
      reasons,
    };
  }

  /**
   * Halka Arz (IPO) Talep Toplama ve Kote Olma Sürecini Çalıştırır.
   * - `publicFloatRatio`: Toplam halka arz oranı (%15 - %45)
   * - `discountRatio`: Adil değere göre halka arz iskontosu (%-5 ile %30 arası)
   * - `primaryShareIssueRatio`: Arz edilen payların ne kadarının yeni pay (bedelli sermaye artırımı - şirkete nakit)
   *   ve ne kadarının mevcut ortak satışı (oyuncuya nakit) olduğu (varsayılan 0.40 yeni pay, 0.60 ortak satışı).
   */
  public static executeCompanyIPO(params: {
    company: PlayerCompany;
    publicFloatRatio: number;
    discountRatio: number;
    primaryShareIssueRatio?: number;
    macro: MacroEconomyState;
    stocks: MarketStock[];
    funds: InstitutionalFund[];
    portfolio: Record<string, PortfolioPosition>;
    playerCash: number;
    currentDay: number;
  }): {
    result: IPOExecutionResult;
    newPlayerCash: number;
  } {
    const {
      company,
      publicFloatRatio,
      discountRatio,
      primaryShareIssueRatio = 0.35,
      macro,
      stocks,
      funds,
      portfolio,
      playerCash,
      currentDay,
    } = params;

    const eligibility = IPOEngine.checkEligibility(company);
    if (!eligibility.eligible) {
      return {
        result: {
          success: false,
          message: `Halka arz koşulları sağlanmadı: ${eligibility.reasons.join(' ')}`,
          ticker: company.ticker,
          offerPrice: 0,
          priceRangeMin: 0,
          priceRangeMax: 0,
          fairPricePerShare: 0,
          primaryNewSharesIssued: 0,
          secondaryExistingSharesSold: 0,
          offeredShares: 0,
          subscribedShares: 0,
          institutionalDemandShares: 0,
          retailDemandShares: 0,
          oversubscriptionMultiple: 0,
          grossProceeds: 0,
          underwritingFee: 0,
          netProceedsToPlayerCash: 0,
          netProceedsToCompanyTreasury: 0,
          newTotalShares: company.totalShares,
          remainingPlayerOwnershipPct: 100,
          firstDayClosingPrice: 0,
          fundParticipations: [],
        },
        newPlayerCash: playerCash,
      };
    }

    const cleanFloat = Math.max(0.15, Math.min(0.45, publicFloatRatio));
    const cleanDiscount = Math.max(-0.05, Math.min(0.3, discountRatio));
    const cleanPrimaryRatio = Math.max(0.1, Math.min(0.8, primaryShareIssueRatio));

    const preIpoShares = company.totalShares;
    const fairPricePerShare = Number((company.equityValue / preIpoShares).toFixed(2));
    const offerPrice = Number(Math.max(2.0, fairPricePerShare * (1 - cleanDiscount)).toFixed(2));
    const priceRangeMin = Number((offerPrice * 0.94).toFixed(2));
    const priceRangeMax = Number((offerPrice * 1.08).toFixed(2));

    const totalOfferedShares = Math.round(preIpoShares * cleanFloat);
    const primaryNewShares = Math.round(totalOfferedShares * cleanPrimaryRatio);
    const secondaryShares = Math.max(0, totalOfferedShares - primaryNewShares);

    // Dinamik Talep Çarpanı Formülü:
    // demandMultiplier = baseDemand * marketRiskFactor * sectorAttractiveness * companyQuality * valuationDiscountFactor * sizeAdjustment
    const baseDemand = 1.15;
    const marketRiskFactor = Math.max(0.6, 0.7 + macro.marketRiskAppetite * 0.65);

    const sectorStocks = stocks.filter((s) => s.sector === company.sector);
    const avgSectorSentiment =
      sectorStocks.reduce((acc, s) => acc + s.sentimentScore, 0) /
      Math.max(1, sectorStocks.length);
    const sectorAttractiveness = Math.max(0.75, Math.min(1.4, 1.0 + avgSectorSentiment * 8.0));

    const ebitdaMargin =
      company.annualizedRevenue > 0
        ? company.annualizedEbitda / company.annualizedRevenue
        : 0.15;
    const companyQuality = Math.max(
      0.8,
      Math.min(
        1.55,
        0.75 +
          ebitdaMargin * 1.1 +
          (company.techQualityMultiplier - 1) * 0.6 +
          (company.corporateGovernanceScore - 70) * 0.005
      )
    );

    // İskonto ne kadar yüksekse kurumsal ve bireysel talep o kadar artar (sabit 4.25x DEĞİLDİR!)
    const valuationDiscountFactor = Math.max(0.45, Math.exp(cleanDiscount * 3.2));
    const offeringGrossTarget = totalOfferedShares * offerPrice;
    const sizeAdjustment = Math.max(
      0.65,
      Math.min(1.25, 1.18 - offeringGrossTarget / 85_000_000)
    );

    const demandMultiplier = Number(
      (
        baseDemand *
        marketRiskFactor *
        sectorAttractiveness *
        companyQuality *
        valuationDiscountFactor *
        sizeAdjustment
      ).toFixed(2)
    );

    // Kurumsal NPC Fon Talebi ve Tahsisatı
    const rawFundRequests: Array<{ fund: InstitutionalFund; desiredShares: number }> = [];
    let totalInstDemandShares = 0;

    for (const fund of funds) {
      const sectorMatch = fund.preferredSectors.includes(company.sector) ? 1.25 : 0.65;
      const riskFit = 0.6 + fund.riskAppetite * 0.6;
      const fundSpecificMultiplier = demandMultiplier * sectorMatch * riskFit * 0.22;
      const maxFundTicket = fund.availableCapital * Math.min(0.28, fund.maxPositionPct);
      const desiredCapital = Math.min(
        maxFundTicket,
        offeringGrossTarget * fundSpecificMultiplier
      );
      const desiredShares = Math.max(0, Math.floor(desiredCapital / offerPrice));
      totalInstDemandShares += desiredShares;
      rawFundRequests.push({ fund, desiredShares });
    }

    // Bireysel Yatırımcı Talebi (%35 pay dilimi)
    const retailDemandShares = Math.round(totalOfferedShares * 0.35 * demandMultiplier);
    const totalDemandShares = totalInstDemandShares + retailDemandShares;
    const oversubscriptionMultiple = Number(
      Math.max(0.35, totalDemandShares / Math.max(1, totalOfferedShares)).toFixed(2)
    );

    const subscribedShares = Math.min(
      totalOfferedShares,
      Math.max(Math.round(totalOfferedShares * Math.min(1.0, oversubscriptionMultiple)), 1)
    );

    // Satılan payların birincil (yeni ihraç) ve ikincil (ortak satışı) dağılımı
    const actualPrimarySold = Math.min(
      subscribedShares,
      Math.round(subscribedShares * cleanPrimaryRatio)
    );
    const actualSecondarySold = Math.max(0, subscribedShares - actualPrimarySold);

    // NPC Fonlara Pro-Rata Dağıtım
    const instAllocationPool = Math.round(subscribedShares * 0.7);
    let remainingInstToAllocate = instAllocationPool;
    const fundParticipations: IPOExecutionResult['fundParticipations'] = [];

    for (let i = 0; i < rawFundRequests.length; i++) {
      const item = rawFundRequests[i];
      const weight =
        totalInstDemandShares > 0
          ? item.desiredShares / totalInstDemandShares
          : 1 / rawFundRequests.length;
      const allocated =
        i === rawFundRequests.length - 1
          ? Math.max(0, remainingInstToAllocate)
          : Math.min(remainingInstToAllocate, Math.round(instAllocationPool * weight));

      const maxAffordable = Math.floor(item.fund.availableCapital / offerPrice);
      const finalAllocated = Math.max(0, Math.min(allocated, maxAffordable));
      const committed = Number((finalAllocated * offerPrice).toFixed(2));

      if (finalAllocated > 0) {
        item.fund.availableCapital = Number(
          (item.fund.availableCapital - committed).toFixed(2)
        );
        item.fund.holdings[company.ticker] =
          (item.fund.holdings[company.ticker] || 0) + finalAllocated;
        remainingInstToAllocate -= finalAllocated;
      }

      fundParticipations.push({
        fundName: item.fund.name,
        strategyType: item.fund.strategyType,
        sharesAllocated: finalAllocated,
        capitalCommitted: committed,
      });
    }

    const grossProceeds = Number((subscribedShares * offerPrice).toFixed(2));
    const underwritingFeeRate = 0.025; // %2.5 aracılık komisyonu
    const underwritingFee = Number((grossProceeds * underwritingFeeRate).toFixed(2));
    const netProceedsTotal = Number((grossProceeds - underwritingFee).toFixed(2));

    const netProceedsToCompanyTreasury = Number(
      (actualPrimarySold * offerPrice * (1 - underwritingFeeRate)).toFixed(2)
    );
    const netProceedsToPlayerCash = Number(
      Math.max(0, netProceedsTotal - netProceedsToCompanyTreasury).toFixed(2)
    );

    // 1. Oyuncunun kişisel nakdine ortak satışı gelirini ekle
    const newPlayerCash = Number((playerCash + netProceedsToPlayerCash).toFixed(2));

    // 2. Şirket bilançosuna yeni pay ihracı (sermaye artırımı) nakdini ekle (Çift Kayıt Muhasebe!)
    const newTotalShares = preIpoShares + actualPrimarySold;
    CompanyWallet.earn(company, netProceedsToCompanyTreasury);
    company.capitalCash = company.financials.cash;
    company.financials.totalAssets = Number(
      (company.financials.totalAssets + netProceedsToCompanyTreasury).toFixed(2)
    );
    company.financials.paidInCapital = Number(
      (company.financials.paidInCapital + netProceedsToCompanyTreasury).toFixed(2)
    );
    company.financials.shareholdersEquity = Number(
      (company.financials.totalAssets - company.financials.totalLiabilities).toFixed(2)
    );
    company.financials.sharesOutstanding = newTotalShares;

    company.totalShares = newTotalShares;
    company.playerOwnedShares = Math.max(0, preIpoShares - actualSecondarySold);
    company.playerOwnershipPct = Number(
      ((company.playerOwnedShares / newTotalShares) * 100).toFixed(2)
    );
    company.isPubliclyListed = true;
    company.ipoOfferPrice = offerPrice;
    company.ipoProceedsRaised = netProceedsTotal;
    company.ipoDay = currentDay;

    // İlk işlem günü kapanış fiyatı (talep çarpanına göre dengeli açılış)
    const firstDayPop = Math.max(
      -0.04,
      Math.min(0.12, (oversubscriptionMultiple - 1.0) * 0.045)
    );
    const firstDayClosingPrice = Number((offerPrice * (1 + firstDayPop)).toFixed(2));

    company.equityValue = Number((firstDayClosingPrice * newTotalShares).toFixed(2));
    company.enterpriseValue = Number(
      Math.max(
        company.equityValue * 0.5,
        company.equityValue + company.financials.totalLiabilities - company.financials.cash
      ).toFixed(2)
    );

    const sectorCfg = SECTOR_CONFIGS[company.sector];
    const halfSpread = 0.0009;
    const listedStock: MarketStock = {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      price: firstDayClosingPrice,
      bidPrice: Number((firstDayClosingPrice * (1 - halfSpread)).toFixed(2)),
      askPrice: Number((firstDayClosingPrice * (1 + halfSpread)).toFixed(2)),
      spreadBps: 18,
      previousPrice: offerPrice,
      dailyChangePct: Number(
        (((firstDayClosingPrice - offerPrice) / offerPrice) * 100).toFixed(2)
      ),
      priceHistory: [offerPrice, firstDayClosingPrice],
      muBase: sectorCfg.baseDrift,
      sigma: sectorCfg.baseVolatility,
      newsSensitivity: 1.15,
      sentimentScore: 0.008,
      sentimentDecay: 0.28,
      liquidityDepthLots: Math.max(12_000, Math.round(subscribedShares * 0.6)),
      netOrderFlowLots: 0,
      dividendYieldAnnual: 0.025,
      dividendPeriodDays: 10,
      lastExDividendDay: currentDay,
      totalShares: newTotalShares,
      freeFloatRatio: Number((subscribedShares / newTotalShares).toFixed(4)),
      ebitdaAnnual: company.annualizedEbitda,
      enterpriseValue: company.enterpriseValue,
      equityValue: company.equityValue,
      fundamentalPrice: Number(
        ((company.valuation.equityValue + netProceedsToCompanyTreasury) / newTotalShares).toFixed(2)
      ),
      financials: company.financials,
      valuation: company.valuation,
      quarterlyReports: company.quarterlyReports,
      isPlayerCompany: true,
      isControlledByPlayer: company.playerOwnershipPct > 50,
      playerOwnershipPct: company.playerOwnershipPct,
      controlLevel: MarketEngine.computeControlLevel(company.playerOwnershipPct),
      poisonPillActive: false,
      integrationDaysRemaining: 0,
    };

    stocks.unshift(listedStock);
    portfolio[company.ticker] = {
      ticker: company.ticker,
      shares: company.playerOwnedShares,
      averageCost: Number((company.financials.paidInCapital / newTotalShares).toFixed(4)),
      totalDividendCollected: 0,
      lastPurchaseDay: currentDay,
    };

    return {
      result: {
        success: true,
        message: `${company.name} (${company.ticker}) ${offerPrice.toFixed(2)} TL fiyattan (${oversubscriptionMultiple}x talep) halka arz edildi! Ortak Satışı Nakit Girişi: +₺${netProceedsToPlayerCash.toLocaleString('tr-TR')}, Şirket Hazinesi Nakit Girişi: +₺${netProceedsToCompanyTreasury.toLocaleString('tr-TR')}.`,
        ticker: company.ticker,
        offerPrice,
        priceRangeMin,
        priceRangeMax,
        fairPricePerShare,
        primaryNewSharesIssued: actualPrimarySold,
        secondaryExistingSharesSold: actualSecondarySold,
        offeredShares: totalOfferedShares,
        subscribedShares,
        institutionalDemandShares: totalInstDemandShares,
        retailDemandShares,
        oversubscriptionMultiple,
        grossProceeds,
        underwritingFee,
        netProceedsToPlayerCash,
        netProceedsToCompanyTreasury,
        newTotalShares,
        remainingPlayerOwnershipPct: company.playerOwnershipPct,
        firstDayClosingPrice,
        fundParticipations,
      },
      newPlayerCash,
    };
  }
}
