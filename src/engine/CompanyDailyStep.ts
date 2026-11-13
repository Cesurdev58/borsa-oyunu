/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞİRKET GÜNLÜK / GÜN İÇİ SİMÜLASYON ADIMI
 * (CompanyEngine dosyasından ayrıldı; dış dünya hâlâ CompanyEngine.* üzerinden erişebilir.)
 */

import {
  SECTOR_CONFIGS,
} from '../data/sectors';
import {
  PlayerCompany,
} from '../models/company';
import {
  MacroEconomyState,
} from '../models/economy';
import {
  AccountingEngine,
} from './AccountingEngine';
import {
  ValuationEngine,
} from './ValuationEngine';
import {
  CompanyCapacity,
} from './CompanyCapacity';
import {
  CompanyFounding,
} from './CompanyFounding';
import {
  CompanyInvestmentProjects,
} from './CompanyInvestmentProjects';
import { readMarketContext, saturatedPlayerDemand } from './SectorMarket';
import { progressiveCorporateTax } from './TaxRules';

export class CompanyDailyStep {
  /**
   * Oyuncu Şirketi Birleşik İlerleme Motoru (`stepPlayerCompanyFraction`):
   * - Hem tam gün (`dayFraction = 1.0`) hem de gün içi alt adımlar (`dayFraction = 5/1440`) için
   *   birebir aynı matematiksel modeli çalıştırır; böylece 1x, 2x ve 4x hızlarda ekonomik sonuçlar eşdeğerdir!
   * - `totalElapsedGameMinutes` kontrolü ile aynı oyun dakikasının iki kez üretim oluşturmasını engeller.
   */
  public static stepPlayerCompanyFraction(
    company: PlayerCompany,
    macro: MacroEconomyState,
    sectorSentiment: number,
    dayFraction: number,
    totalElapsedGameMinutes?: number
  ): {
    unitsProducedDelta: number;
    revenueDelta: number;
    expensesDelta: number;
    rdIncrement: number;
  } {
    CompanyFounding.ensureCompanyV5Fields(company, macro);
    const ops = company.operations!;
    const wf = company.workforcePlan!;
    const fin = company.financials;
    const sectorCfg = SECTOR_CONFIGS[company.sector];

    const cleanFraction = Math.max(0, Math.min(1, dayFraction));
    if (cleanFraction <= 0) {
      return {
        unitsProducedDelta: 0,
        revenueDelta: 0,
        expensesDelta: 0,
        rdIncrement: 0,
      };
    }

    // Aynı oyun dakikasında ikinci kez üretim yapılmasını engelle (Test B.7)
    if (
      typeof totalElapsedGameMinutes === 'number' &&
      totalElapsedGameMinutes > 0 &&
      ops.lastProcessedTotalMinute === totalElapsedGameMinutes
    ) {
      return {
        unitsProducedDelta: 0,
        revenueDelta: 0,
        expensesDelta: 0,
        rdIncrement: 0,
      };
    }
    if (typeof totalElapsedGameMinutes === 'number' && totalElapsedGameMinutes > 0) {
      ops.lastProcessedTotalMinute = totalElapsedGameMinutes;
    }

    // 1. Yatırım Projelerini İlerlet
    const prjStep = CompanyInvestmentProjects.stepInvestmentProjects(company, cleanFraction);

    // 2. Ar-Ge İlerlemesi ve Güvenli Teknoloji Çarpanı [1.00, 2.50]
    const effectiveRd = Math.min(
      company.dailyRdBudget,
      Math.max(0, fin.cash * 0.25)
    );
    const fullDayRdIncrement =
      company.techQualityMultiplier < CompanyCapacity.MAX_TECH_MULTIPLIER
        ? 0.012 *
          Math.log(1 + effectiveRd / 15_000) *
          Math.max(
            0.05,
            (CompanyCapacity.MAX_TECH_MULTIPLIER - company.techQualityMultiplier) /
              1.5
          )
        : 0;
    const rdIncrement = fullDayRdIncrement * cleanFraction;
    company.techQualityMultiplier = Number(
      Math.max(
        CompanyCapacity.MIN_TECH_MULTIPLIER,
        Math.min(
          CompanyCapacity.MAX_TECH_MULTIPLIER,
          company.techQualityMultiplier + rdIncrement
        )
      ).toFixed(6)
    );

    const clamped = CompanyCapacity.clampMultipliers({
      technologyMultiplier: company.techQualityMultiplier,
      workforceEfficiency: wf.workforceEfficiency,
      machineAvailability: ops.machineAvailability,
      shiftMultiplier: ops.shiftMultiplier,
      productQuality: Math.min(
        100,
        55 + (company.techQualityMultiplier - 1) * 30
      ),
      customerSatisfaction: ops.customerSatisfaction,
      distributionCoverage: Math.min(
        1.0,
        0.25 + company.productionCapacity / 750 + company.dailyMarketingBudget / 200_000
      ),
    });

    ops.technologyMultiplier = clamped.technologyMultiplier;
    ops.workforceEfficiency = clamped.workforceEfficiency;
    ops.machineAvailability = clamped.machineAvailability;
    ops.shiftMultiplier = clamped.shiftMultiplier;
    ops.productQuality = clamped.productQuality;
    ops.distributionCoverage = clamped.distributionCoverage;

    // 3. Kapasite ve Fiili Üretim Sınırları (Kapasiteyi ve Depo Boş Alanını ASLA Aşamaz!)
    const installedCapacity = Math.max(1, Math.round(company.productionCapacity));
    ops.installedCapacity = installedCapacity;
    ops.maximumStorageUnits = Math.max(60, installedCapacity * 15);

    const effectiveCapacity = CompanyCapacity.computeEffectiveCapacity({
      installedCapacity,
      technologyMultiplier: ops.technologyMultiplier,
      workforceEfficiency: ops.workforceEfficiency,
      machineAvailability: ops.machineAvailability,
      shiftMultiplier: ops.shiftMultiplier,
      disruptionPct: prjStep.activeDisruptionPct,
    });
    ops.effectiveCapacity = effectiveCapacity;

    const laborCapacity = Math.max(
      1,
      Math.round(fin.staffCount * 2.5 * ops.workforceEfficiency)
    );
    const materialEnergyLimit = Math.round(
      installedCapacity *
        Math.min(ops.rawMaterialAvailability, ops.energyOperationalCapacity)
    );
    const plannedDailyUnits =
      ops.plannedProduction > 0
        ? Math.min(installedCapacity, ops.plannedProduction)
        : effectiveCapacity;

    const fullDayBoundedOutput = Math.max(
      0,
      Math.min(
        installedCapacity,
        effectiveCapacity,
        plannedDailyUnits,
        laborCapacity,
        materialEnergyLimit
      )
    );

    const freeStorageBeforeProd = Math.max(
      0,
      ops.maximumStorageUnits - fin.inventoryUnits
    );
    const stepProducedUnits = Number(
      Math.min(
        freeStorageBeforeProd,
        fullDayBoundedOutput * cleanFraction
      ).toFixed(4)
    );

    const annualizedDailyRateProduced = Number(
      Math.min(
        effectiveCapacity,
        installedCapacity,
        stepProducedUnits / cleanFraction
      ).toFixed(2)
    );
    ops.actualProduction = annualizedDailyRateProduced;

    // 4. Bağımsız Pazar Talebi, Fiyat Elastikiyeti ve Stoktan Satış
    ops.competitorAveragePrice = sectorCfg.unitPrice;
    const defaultPrice = Number(
      (
        sectorCfg.unitPrice *
        (1 + (ops.technologyMultiplier - 1) * 0.08)
      ).toFixed(2)
    );
    const salePrice = ops.salePrice > 0 ? ops.salePrice : defaultPrice;
    ops.salePrice = salePrice;

    const priceRatio = salePrice / Math.max(1, ops.competitorAveragePrice);
    const qualityBrandSupport =
      1 +
      ((ops.productQuality - 50) / 100) * 0.25 +
      ((ops.brandStrength - 50) / 100) * 0.15;

    // Fiyat rakip ortalamasından çok yüksekse ve kalite/marka karşılamıyorsa satış hızla düşer
    const priceDemandFactor =
      priceRatio <= qualityBrandSupport
        ? Math.min(1.2, 1 + (qualityBrandSupport - priceRatio) * 0.5)
        : Math.max(0.02, Math.pow(qualityBrandSupport / priceRatio, 2.8));

    const macroFactor = Math.max(
      0.5,
      Math.min(
        1.3,
        0.95 +
          sectorSentiment * 1.4 +
          (macro.gdpGrowthRate - 0.03) * 1.2 +
          (macro.marketRiskAppetite - 0.5) * 0.15
      )
    );

    const marketingBoost = Math.min(
      1.25,
      1 + Math.log10(1 + company.dailyMarketingBudget / 2_000) * 0.08
    );

    // Eğer dışarıdan test veya kriz nedeniyle marketDemand = 0 ayarlandıysa satış = 0 olur!
    const totalSectorMarketDemand =
      ops.marketDemand === 0
        ? 0
        : Math.max(
            0,
            Math.round(installedCapacity * 4.2 * macroFactor)
          );
    ops.marketDemand = totalSectorMarketDemand;

    const demandShare =
      totalSectorMarketDemand <= 0
        ? 0
        : Number(
            Math.max(
              0.01,
              Math.min(
                0.65,
                0.22 *
                  priceDemandFactor *
                  marketingBoost *
                  (0.75 + ops.distributionCoverage * 0.35)
              )
            ).toFixed(4)
          );
    ops.companyDemandShare = demandShare;

    const rawPotentialSales =
      totalSectorMarketDemand <= 0
        ? 0
        : Math.max(
            0,
            Math.round(totalSectorMarketDemand * demandShare)
          );
    // Sektör pazarı sınırlıdır: rakiplerin bıraktığı boşluk dolarken satış tavana yaklaşır
    const marketCtx = readMarketContext(company.sector, ops);
    const saturated = saturatedPlayerDemand({
      rawDemand: rawPotentialSales,
      demandShare,
      macroFactor,
      context: marketCtx,
    });
    const fullDayPotentialSales = rawPotentialSales <= 0 ? 0 : saturated.units;
    ops.potentialSalesUnits = fullDayPotentialSales;
    ops.sectorMarketUnits = marketCtx.marketUnits;
    ops.rivalUnitsInMarket = Math.round(marketCtx.uncontrolledRivalUnits);
    ops.controlledRivalUnits = Math.round(marketCtx.controlledRivalUnits);
    ops.marketSaturated =
      rawPotentialSales > 0 && fullDayPotentialSales < rawPotentialSales * 0.85;

    const stepDesiredSales = Number(
      (fullDayPotentialSales * cleanFraction).toFixed(4)
    );
    const availableToSellNow = Math.max(0, fin.inventoryUnits + stepProducedUnits);
    const stepSoldUnits = Number(
      Math.min(availableToSellNow, stepDesiredSales).toFixed(4)
    );

    ops.actualSalesUnits = Number((stepSoldUnits / cleanFraction).toFixed(2));
    ops.playerMarketSharePct = Number(
      ((ops.actualSalesUnits / Math.max(1, saturated.marketUnits)) * 100).toFixed(1)
    );
    ops.unmetDemand = Number(
      Math.max(0, fullDayPotentialSales - ops.actualSalesUnits).toFixed(2)
    );

    // Satılamayan ürün stokta kalır; depoda fire/eskime oluşur
    const rawInventoryAfterSale = Math.max(
      0,
      availableToSellNow - stepSoldUnits
    );
    const stepObsoleteUnits =
      rawInventoryAfterSale > installedCapacity * 5
        ? Number((rawInventoryAfterSale * 0.006 * cleanFraction).toFixed(4))
        : 0;
    const newInventoryUnits = Number(
      Math.min(
        ops.maximumStorageUnits,
        Math.max(0, rawInventoryAfterSale - stepObsoleteUnits)
      ).toFixed(2)
    );

    ops.inventoryUnits = newInventoryUnits;
    ops.damagedOrObsoleteInventory = Number(
      (ops.damagedOrObsoleteInventory + stepObsoleteUnits).toFixed(2)
    );
    ops.productionReductionRecommended =
      newInventoryUnits >= ops.maximumStorageUnits * 0.75;

    // 5. Gerçekçi Gelir ve Gider Kalemleri (Aşama 5)
    const unitProductionCost = sectorCfg.unitCost;
    const unitStorageCost = Number((unitProductionCost * 0.015).toFixed(2));
    const unitLogisticsCost = Number((unitProductionCost * 0.04).toFixed(2));
    ops.unitProductionCost = unitProductionCost;
    ops.unitStorageCost = unitStorageCost;
    ops.unitLogisticsCost = unitLogisticsCost;

    const salaryTierMult =
      wf.salaryTier === 'ECONOMY'
        ? 0.85
        : wf.salaryTier === 'STANDARD'
        ? 1.0
        : 1.2;

    const fullDayRevenue = ops.actualSalesUnits * salePrice;
    const fullDayCogs =
      ops.actualSalesUnits * (unitProductionCost + unitLogisticsCost) +
      (stepObsoleteUnits / cleanFraction) * unitProductionCost;
    const fullDayGrossProfit = fullDayRevenue - fullDayCogs;

    const fullDayPersonnel =
      fin.staffCount *
      (sectorCfg.dailyStaffWage * 0.048) *
      salaryTierMult *
      (1 + (wf.shifts - 1) * 0.35);
    const fullDayStorageCost = newInventoryUnits * unitStorageCost;
    const fullDayRd = Math.min(
      effectiveRd * 0.12,
      Math.max(effectiveRd * 0.05, fullDayRevenue * 0.14)
    );
    const fullDayMarketing = Math.min(
      company.dailyMarketingBudget * 0.25,
      Math.max(company.dailyMarketingBudget * 0.08, fullDayRevenue * 0.12)
    );
    const fullDayFixedOverhead =
      installedCapacity * 1.5 +
      fullDayRevenue * 0.04 +
      fullDayStorageCost +
      fullDayMarketing;

    const fullDayEbitda =
      fullDayGrossProfit - fullDayFixedOverhead - fullDayPersonnel - fullDayRd;
    const fullDayDepreciation = (fin.fixedAssets * 0.08) / 252;
    const fullDayEbit = fullDayEbitda - fullDayDepreciation;
    const effectiveInterestRate = Math.max(0.1, macro.policyInterestRate * 0.6);
    const fullDayInterest = (fin.totalLiabilities * effectiveInterestRate) / 252;
    const fullDayPreTax = fullDayEbit - fullDayInterest;
    // Kademeli kurumlar vergisi: büyük kârın üst dilimi daha yüksek oranla vergilenir
    const fullDayTax = progressiveCorporateTax(fullDayPreTax, macro.corporateTaxRate);
    const fullDayNetIncome = fullDayPreTax - fullDayTax;

    // 6. Bilanço ve Nakit Güncellemesi (Stok para değildir; satış olmadan nakde dönüşmez!)
    const stepNetIncome = fullDayNetIncome * cleanFraction;
    const stepDepreciation = fullDayDepreciation * cleanFraction;

    const oldInventoryValue = fin.inventory;
    const newInventoryValue = Number(
      (newInventoryUnits * unitProductionCost).toFixed(2)
    );
    const inventoryDelta = newInventoryValue - oldInventoryValue;

    const newFixedAssets = Number(
      Math.max(25_000, fin.fixedAssets - stepDepreciation).toFixed(2)
    );
    const fixedAssetsDelta = newFixedAssets - fin.fixedAssets;

    const targetReceivables = Number((fullDayRevenue * 8).toFixed(2));
    const receivablesDelta =
      (targetReceivables - fin.receivables) * 0.15 * cleanFraction;
    const newReceivables = Number(
      Math.max(0, fin.receivables + receivablesDelta).toFixed(2)
    );
    const actualReceivablesDelta = newReceivables - fin.receivables;

    // ΔCash = stepNetIncome - ΔInventory - ΔReceivables - ΔFixedAssets
    const cashDelta =
      stepNetIncome -
      inventoryDelta -
      actualReceivablesDelta -
      fixedAssetsDelta;

    let newCash = Number((fin.cash + cashDelta).toFixed(2));
    let newShortTermDebt = fin.shortTermDebt;

    if (newCash < 0) {
      const unpaidShortfall = Number((-newCash).toFixed(2));
      newCash = 0;
      newShortTermDebt = Number((newShortTermDebt + unpaidShortfall).toFixed(2));
      company.unpaidPayrollBalance = Number(
        ((company.unpaidPayrollBalance ?? 0) + unpaidShortfall * 0.5).toFixed(2)
      );
      company.supplierPayableBalance = Number(
        ((company.supplierPayableBalance ?? 0) + unpaidShortfall * 0.5).toFixed(2)
      );
    }

    const newTotalLiabilities = Number(
      (newShortTermDebt + fin.longTermDebt).toFixed(2)
    );
    const newTotalAssets = Number(
      (newCash + newInventoryValue + newReceivables + newFixedAssets).toFixed(2)
    );
    const newShareholdersEquity = Number(
      (newTotalAssets - newTotalLiabilities).toFixed(2)
    );
    const newRetainedEarnings = Number(
      (newShareholdersEquity - fin.paidInCapital).toFixed(2)
    );

    if (newShareholdersEquity < -company.financials.paidInCapital * 0.5) {
      company.isBankrupt = true;
    }

    const annualizationFactor = 120;
    fin.revenue = Number((fullDayRevenue * annualizationFactor).toFixed(2));
    fin.costOfGoodsSold = Number((fullDayCogs * annualizationFactor).toFixed(2));
    fin.grossProfit = Number((fin.revenue - fin.costOfGoodsSold).toFixed(2));
    fin.operatingExpenses = Number(
      (fullDayFixedOverhead * annualizationFactor).toFixed(2)
    );
    fin.researchAndDevelopment = Number(
      (fullDayRd * annualizationFactor).toFixed(2)
    );
    fin.personnelExpenses = Number(
      (fullDayPersonnel * annualizationFactor).toFixed(2)
    );
    fin.EBITDA = Number(
      (
        fin.grossProfit -
        fin.operatingExpenses -
        fin.personnelExpenses -
        fin.researchAndDevelopment
      ).toFixed(2)
    );
    fin.depreciation = Number(
      (fullDayDepreciation * annualizationFactor).toFixed(2)
    );
    fin.EBIT = Number((fin.EBITDA - fin.depreciation).toFixed(2));
    fin.interestExpense = Number(
      (fullDayInterest * annualizationFactor).toFixed(2)
    );
    fin.preTaxIncome = Number((fin.EBIT - fin.interestExpense).toFixed(2));
    fin.taxExpense = Number((fullDayTax * annualizationFactor).toFixed(2));
    fin.netIncome = Number((fin.preTaxIncome - fin.taxExpense).toFixed(2));

    fin.cash = newCash;
    fin.inventory = newInventoryValue;
    fin.inventoryUnits = newInventoryUnits;
    fin.receivables = newReceivables;
    fin.fixedAssets = newFixedAssets;
    fin.totalAssets = newTotalAssets;
    fin.shortTermDebt = newShortTermDebt;
    fin.totalLiabilities = newTotalLiabilities;
    fin.retainedEarnings = newRetainedEarnings;
    fin.shareholdersEquity = newShareholdersEquity;
    fin.dailyUnitsProduced = ops.actualProduction;
    fin.dailyUnitsSold = ops.actualSalesUnits;
    fin.unitSellingPrice = salePrice;
    fin.unitProductionCost = unitProductionCost;

    company.capitalCash = fin.cash;
    company.dailyUnitsProduced = ops.actualProduction;
    company.dailyRevenue = Number((fin.revenue / annualizationFactor).toFixed(2));
    company.dailyOpex = Number(
      (
        (fin.operatingExpenses +
          fin.personnelExpenses +
          fin.researchAndDevelopment) /
        annualizationFactor
      ).toFixed(2)
    );
    company.dailyEbitda = Number((fin.EBITDA / annualizationFactor).toFixed(2));
    company.annualizedRevenue = fin.revenue;
    company.annualizedEbitda = fin.EBITDA;

    ops.inventoryTurnoverRatio = Number(
      (
        (ops.actualSalesUnits * annualizationFactor) /
        Math.max(1, newInventoryUnits || 1)
      ).toFixed(2)
    );

    company.incomeBreakdown = CompanyCapacity.computeDetailedIncomeBreakdown(
      company,
      macro,
      Math.max(0, fullDayRevenue - actualReceivablesDelta / cleanFraction),
      fullDayCogs + fullDayFixedOverhead + fullDayPersonnel + fullDayRd + fullDayInterest + fullDayTax
    );

    company.valuation = ValuationEngine.computeCompanyValuation(
      fin,
      company.sector,
      macro,
      company.techQualityMultiplier,
      {
        operatingDays: company.operatingDays,
        isPubliclyListed: company.isPubliclyListed,
        operations: ops,
      }
    );
    company.equityValue = company.valuation.equityValue;
    company.enterpriseValue = company.valuation.enterpriseValue;

    return {
      unitsProducedDelta: Number(stepProducedUnits.toFixed(2)),
      revenueDelta: Number((fullDayRevenue * cleanFraction).toFixed(2)),
      expensesDelta: Number(
        (
          (fullDayCogs +
            fullDayPersonnel +
            fullDayRd +
            fullDayFixedOverhead) *
          cleanFraction
        ).toFixed(2)
      ),
      rdIncrement,
    };
  }

  /**
   * Oyuncu şirketinin 1 günlük zaman ilerlemesini çalıştırır.
   */
  public static stepPlayerCompanyOneDay(
    company: PlayerCompany,
    macro: MacroEconomyState,
    sectorSentiment: number,
    currentDay: number,
    totalElapsedGameMinutes?: number
  ): void {
    CompanyDailyStep.stepPlayerCompanyFraction(
      company,
      macro,
      sectorSentiment,
      1.0,
      totalElapsedGameMinutes
    );

    company.operatingDays += 1;
    if (company.financials.EBITDA > 0) {
      company.corporateGovernanceScore = Number(
        Math.min(98, company.corporateGovernanceScore + 0.5).toFixed(1)
      );
    }

    if (!company.cashFlowHistory365) {
      company.cashFlowHistory365 = [];
    }
    company.cashFlowHistory365.push(
      Number((company.dailyEbitda * 0.75).toFixed(2))
    );
    if (company.cashFlowHistory365.length > 365) {
      company.cashFlowHistory365.shift();
    }

    company.revenueHistory.push(company.annualizedRevenue);
    company.ebitdaHistory.push(company.annualizedEbitda);
    company.valuationHistory.push(company.equityValue);
    if (company.revenueHistory.length > 90) {
      company.revenueHistory.shift();
      company.ebitdaHistory.shift();
      company.valuationHistory.shift();
    }

    if (currentDay % 30 === 0) {
      company.quarterlyReports.push(
        AccountingEngine.createQuarterlyReport(
          company.financials,
          currentDay,
          macro.corporateTaxRate
        )
      );
    }
  }

  /**
   * Oyuncu şirketinin gün içi (intraday) orantılı ilerlemesini çalıştırır.
   */
  public static stepPlayerCompanyIntraday(
    company: PlayerCompany,
    macro: MacroEconomyState,
    sectorSentiment: number,
    dayFraction: number,
    totalElapsedGameMinutes?: number
  ): {
    unitsProducedDelta: number;
    revenueDelta: number;
    expensesDelta: number;
    rdIncrement: number;
  } {
    return CompanyDailyStep.stepPlayerCompanyFraction(
      company,
      macro,
      sectorSentiment,
      dayFraction,
      totalElapsedGameMinutes
    );
  }
}
