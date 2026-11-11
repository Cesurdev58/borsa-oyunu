/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 5: ÇOKLU YÖNTEM VE RİSK DENGELİ DEĞERLEME MOTORU (ValuationEngine)
 * Şirket değerlemesini doğrudan ve sınırsız bir ciro çarpanı ile hesaplamaz.
 * Değerleme şu unsurları dikkate alır ve çarpanları güvenli aralıklarla sınırlar:
 * - Normalize FAVÖK
 * - Net borç (Kredi ve yükümlülükler düşülür)
 * - Sektör riski
 * - Büyüme oranı ve kâr istikrarı
 * - Marka değeri ve pazar payı
 * - Serbest nakit akışı (FCFF)
 * - Şirket yaşı ve halka açıklık
 * - Ekonomik dönem (EXPANSION, PEAK, CONTRACTION, TROUGH)
 * Şirket değeri asla şirket kasasına veya oyuncu nakit hesabına eklenmez!
 */

import { SECTOR_CONFIGS } from '../data/sectors';
import { FinancialStatement, ValuationBreakdown } from '../models/company';
import { MacroEconomyState } from '../models/economy';
import { CompanyOperationsState } from '../models/finance';
import { SectorId } from '../models/market';

export interface ValuationContextOptions {
  operatingDays?: number;
  isPubliclyListed?: boolean;
  operations?: CompanyOperationsState;
}

export class ValuationEngine {
  public static readonly MIN_TECH_MULTIPLIER = 1.0;
  public static readonly MAX_TECH_MULTIPLIER = 2.5;

  public static clampTechMultiplier(raw: number): number {
    if (!Number.isFinite(raw)) return 1.0;
    return Number(
      Math.max(
        ValuationEngine.MIN_TECH_MULTIPLIER,
        Math.min(ValuationEngine.MAX_TECH_MULTIPLIER, raw)
      ).toFixed(4)
    );
  }

  public static computeCompanyValuation(
    fin: FinancialStatement,
    sector: SectorId,
    macro: MacroEconomyState,
    techQualityMultiplier: number = 1.0,
    options?: ValuationContextOptions
  ): ValuationBreakdown {
    const sectorCfg = SECTOR_CONFIGS[sector];
    const safeTech = ValuationEngine.clampTechMultiplier(techQualityMultiplier);

    // 1. Ekonomik Dönem, Yaş, Halka Açıklık, Marka ve Pazar Payı Çarpanları (Güvenli Sınırlar: 0.65x .. 1.35x)
    const cycleFactor =
      macro.cyclePhase === 'EXPANSION'
        ? 1.08
        : macro.cyclePhase === 'PEAK'
        ? 1.03
        : macro.cyclePhase === 'CONTRACTION'
        ? 0.88
        : 0.82;

    const operatingDays = options?.operatingDays ?? 60;
    const ageStabilityFactor = Math.min(
      1.12,
      0.85 + Math.log10(Math.max(10, operatingDays)) * 0.1
    );
    const listingLiquidityFactor = options?.isPubliclyListed ? 1.06 : 0.92;
    const brandAndShareFactor = options?.operations
      ? Math.max(
          0.85,
          Math.min(
            1.2,
            0.88 +
              (options.operations.brandStrength / 100) * 0.18 +
              options.operations.companyDemandShare * 0.25
          )
        )
      : 1.0;

    const qualityFactor = Math.max(
      0.8,
      Math.min(
        1.35,
        (1 + 0.12 * (safeTech - 1)) *
          cycleFactor *
          ageStabilityFactor *
          listingLiquidityFactor *
          brandAndShareFactor
      )
    );

    const totalDebt = Math.max(0, fin.totalLiabilities);
    const netDebt = totalDebt - fin.cash;
    const netCash = -netDebt; // fin.cash - totalDebt

    // Asgari tasfiye tabanı (Borçlu veya zarar eden şirkette özsermaye ile uyumlu gerçekçi taban)
    const liquidationValue = Math.max(
      25_000,
      fin.cash +
        fin.inventory * 0.55 +
        fin.receivables * 0.7 +
        fin.fixedAssets * 0.6 -
        totalDebt
    );
    const assetFloor = Number(
      Math.max(25_000, Math.min(fin.shareholdersEquity * 0.85, liquidationValue)).toFixed(2)
    );

    // Güvenli EV/FAVÖK çarpan sınırı (4.0x ile 11.5x arası)
    const boundedEvMultiple = Math.max(
      4.0,
      Math.min(11.5, sectorCfg.baseEvMultiple * 0.75 * qualityFactor)
    );

    // 1. Yöntem: Normalize FAVÖK Çarpanı (EV/EBITDA)
    const normalizedEbitda = Math.max(0, fin.EBITDA);
    const ebitdaEv = normalizedEbitda * boundedEvMultiple;
    const ebitdaMultipleValue = Number(
      Math.max(assetFloor, ebitdaEv + netCash).toFixed(2)
    );

    // 2. Yöntem: F/K Yaklaşımı (P/E Multiple - Güvenli 5.0x ile 15.0x sınırı)
    const boundedPeMultiple = Math.max(
      5.0,
      Math.min(15.0, sectorCfg.basePeMultiple * 0.72 * qualityFactor)
    );
    const positiveNetIncome = Math.max(0, fin.netIncome);
    const peMultipleValue = Number(
      Math.max(
        assetFloor,
        positiveNetIncome > 0
          ? positiveNetIncome * boundedPeMultiple
          : Math.max(assetFloor, fin.shareholdersEquity * 0.8)
      ).toFixed(2)
    );

    // 3. Yöntem: Defter Değeri Yaklaşımı (Book Value / P/B - Güvenli 0.8x ile 2.0x sınırı)
    const positiveEquity = Math.max(25_000, fin.shareholdersEquity);
    const boundedPbMultiple = Math.max(
      0.8,
      Math.min(2.0, sectorCfg.basePbMultiple * 0.65 * qualityFactor)
    );
    const bookValue = Number(
      Math.max(assetFloor, positiveEquity * boundedPbMultiple).toFixed(2)
    );

    // 4. Yöntem: İndirgenmiş Nakit Akımı (DCF - Gerçek FCFF, yapay ciro tabanı YOK!)
    const fcff =
      fin.EBIT * (1 - macro.corporateTaxRate) +
      fin.depreciation -
      fin.capitalExpenditures -
      fin.changeInWorkingCapital;

    const sectorRiskPremium = sectorCfg.baseVolatility * 0.18;
    const wacc = Math.max(
      0.16,
      macro.policyInterestRate * 0.55 + 0.045 + sectorRiskPremium
    );
    const terminalGrowth = Math.min(
      wacc - 0.07,
      Math.max(0.02, macro.gdpGrowthRate * 0.85)
    );
    const effectiveFcff = Math.max(0, fcff);
    const dcfEnterpriseValue =
      effectiveFcff > 0
        ? (effectiveFcff * (1 + terminalGrowth)) /
          Math.max(0.08, wacc - terminalGrowth)
        : Math.max(0, fin.fixedAssets * 0.7 + fin.inventory * 0.5);
    const dcfValue = Number(
      Math.max(assetFloor, dcfEnterpriseValue + netCash).toFixed(2)
    );

    // 5. Yöntem: Sektör Karşılaştırması (Kârlılık düzeltmeli EV/Sales, en fazla 1.6x Ciro)
    const ebitdaMargin =
      fin.revenue > 0 ? Math.max(-0.5, fin.EBITDA / fin.revenue) : 0;
    const marginAdjustedSalesMultiple = Math.max(
      0.25,
      Math.min(1.6, sectorCfg.baseEvMultiple * 0.1 * Math.max(0.2, 0.5 + ebitdaMargin * 2))
    );
    const sectorCompEv = fin.revenue * marginAdjustedSalesMultiple;
    const sectorComparableValue = Number(
      Math.max(assetFloor, sectorCompEv + netCash).toFixed(2)
    );

    let wEbitda = 0.3;
    let wPe = 0.2;
    let wBook = 0.25;
    let wDcf = 0.15;
    let wSector = 0.1;

    if (fin.EBITDA <= 0 || fin.netIncome <= 0) {
      wEbitda = 0.05;
      wPe = 0.05;
      wBook = 0.65;
      wDcf = 0.15;
      wSector = 0.1;
    }

    const weightedEquity =
      ebitdaMultipleValue * wEbitda +
      peMultipleValue * wPe +
      bookValue * wBook +
      dcfValue * wDcf +
      sectorComparableValue * wSector;

    // Aşırı değerleme tavanı: Özkaynağın ve normalize FAVÖK'ün makul katını aşamaz
    const sanityCap = Math.max(
      positiveEquity * 3.2,
      normalizedEbitda * 12.0 + Math.max(0, netCash),
      assetFloor
    );

    const equityValue = Number(
      Math.max(assetFloor, Math.min(sanityCap, weightedEquity)).toFixed(2)
    );
    const enterpriseValue = Number(
      Math.max(assetFloor, equityValue + netDebt).toFixed(2)
    );
    const fairValuePerShare = Number(
      Math.max(0.5, equityValue / Math.max(1, fin.sharesOutstanding)).toFixed(2)
    );

    return {
      ebitdaMultipleValue,
      peMultipleValue,
      bookValue,
      dcfValue,
      sectorComparableValue,
      enterpriseValue,
      equityValue,
      fairValuePerShare,
      methodWeights: {
        ebitda: wEbitda,
        pe: wPe,
        book: wBook,
        dcf: wDcf,
        sector: wSector,
      },
    };
  }
}
