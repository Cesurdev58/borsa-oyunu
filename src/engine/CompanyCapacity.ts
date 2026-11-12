/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞİRKET KAPASİTE MATEMATİĞİ: çarpan sınırları, etkin kapasite ve detaylı gelir hesabı
 * (CompanyEngine dosyasından ayrıldı; dış dünya hâlâ CompanyEngine.* üzerinden erişebilir.)
 */

import {
  PlayerCompany,
} from '../models/company';
import {
  MacroEconomyState,
} from '../models/economy';
import {
  DetailedIncomeBreakdown,
} from '../models/finance';

export class CompanyCapacity {
  // Güvenli Çarpan Sınırları (Aşama 4)
  public static readonly MIN_TECH_MULTIPLIER = 1.0;

  public static readonly MAX_TECH_MULTIPLIER = 2.5;

  public static readonly MIN_WORKFORCE_EFFICIENCY = 0.4;

  public static readonly MAX_WORKFORCE_EFFICIENCY = 1.15;

  public static readonly MIN_MACHINE_AVAILABILITY = 0.5;

  public static readonly MAX_MACHINE_AVAILABILITY = 1.0;

  public static readonly MIN_SHIFT_MULTIPLIER = 1.0;

  public static readonly MAX_SHIFT_MULTIPLIER = 2.6;

  /**
   * Eski kayıtlarda 7.48 gibi aşırı değerlere ulaşmış teknoloji çarpanını silmeden
   * deterministik logaritmik ölçekle [1.00, 2.50] güvenli aralığına dönüştürür.
   */
  public static migrateLegacyTechMultiplier(rawMultiplier: number): {
    safeMultiplier: number;
    wasMigrated: boolean;
    originalValue: number;
  } {
    const cleanOrig = Number.isFinite(rawMultiplier) ? rawMultiplier : 1.0;
    if (cleanOrig <= CompanyCapacity.MAX_TECH_MULTIPLIER) {
      return {
        safeMultiplier: Number(
          Math.max(CompanyCapacity.MIN_TECH_MULTIPLIER, cleanOrig).toFixed(4)
        ),
        wasMigrated: false,
        originalValue: cleanOrig,
      };
    }

    const logScaled =
      1.75 + 0.32 * Math.log(1 + (cleanOrig - CompanyCapacity.MAX_TECH_MULTIPLIER));
    const safeMultiplier = Number(
      Math.max(
        CompanyCapacity.MIN_TECH_MULTIPLIER,
        Math.min(CompanyCapacity.MAX_TECH_MULTIPLIER, logScaled)
      ).toFixed(4)
    );
    return {
      safeMultiplier,
      wasMigrated: true,
      originalValue: cleanOrig,
    };
  }

  public static clampMultipliers(params: {
    technologyMultiplier: number;
    workforceEfficiency: number;
    machineAvailability: number;
    shiftMultiplier: number;
    productQuality: number;
    customerSatisfaction: number;
    distributionCoverage: number;
  }) {
    return {
      technologyMultiplier: Number(
        Math.max(
          CompanyCapacity.MIN_TECH_MULTIPLIER,
          Math.min(CompanyCapacity.MAX_TECH_MULTIPLIER, params.technologyMultiplier)
        ).toFixed(4)
      ),
      workforceEfficiency: Number(
        Math.max(
          CompanyCapacity.MIN_WORKFORCE_EFFICIENCY,
          Math.min(
            CompanyCapacity.MAX_WORKFORCE_EFFICIENCY,
            params.workforceEfficiency
          )
        ).toFixed(4)
      ),
      machineAvailability: Number(
        Math.max(
          CompanyCapacity.MIN_MACHINE_AVAILABILITY,
          Math.min(
            CompanyCapacity.MAX_MACHINE_AVAILABILITY,
            params.machineAvailability
          )
        ).toFixed(4)
      ),
      shiftMultiplier: Number(
        Math.max(
          CompanyCapacity.MIN_SHIFT_MULTIPLIER,
          Math.min(CompanyCapacity.MAX_SHIFT_MULTIPLIER, params.shiftMultiplier)
        ).toFixed(4)
      ),
      productQuality: Number(
        Math.max(0, Math.min(100, params.productQuality)).toFixed(1)
      ),
      customerSatisfaction: Number(
        Math.max(0, Math.min(100, params.customerSatisfaction)).toFixed(1)
      ),
      distributionCoverage: Number(
        Math.max(0.05, Math.min(1.0, params.distributionCoverage)).toFixed(4)
      ),
    };
  }

  /**
   * Etkin Kapasite Hesabı:
   * effectiveCapacity = min(installedCapacity, round(installedCapacity * techFactor * workforceEfficiency * machineAvailability * shiftFactor * (1 - disruption)))
   * Böylece etkin kapasite hiçbir zaman kurulu fiziksel kapasiteyi aşmaz ve tüm çarpanlar güvenli aralıktadır.
   */
  public static computeEffectiveCapacity(params: {
    installedCapacity: number;
    technologyMultiplier: number;
    workforceEfficiency: number;
    machineAvailability: number;
    shiftMultiplier: number;
    disruptionPct: number;
  }): number {
    const installed = Math.max(1, Math.round(params.installedCapacity));
    const tech = Math.max(
      CompanyCapacity.MIN_TECH_MULTIPLIER,
      Math.min(CompanyCapacity.MAX_TECH_MULTIPLIER, params.technologyMultiplier)
    );
    const wf = Math.max(
      CompanyCapacity.MIN_WORKFORCE_EFFICIENCY,
      Math.min(CompanyCapacity.MAX_WORKFORCE_EFFICIENCY, params.workforceEfficiency)
    );
    const mach = Math.max(
      CompanyCapacity.MIN_MACHINE_AVAILABILITY,
      Math.min(CompanyCapacity.MAX_MACHINE_AVAILABILITY, params.machineAvailability)
    );
    const shift = Math.max(
      CompanyCapacity.MIN_SHIFT_MULTIPLIER,
      Math.min(CompanyCapacity.MAX_SHIFT_MULTIPLIER, params.shiftMultiplier)
    );
    const disruptionFactor = Math.max(
      0.5,
      1 - Math.max(0, Math.min(40, params.disruptionPct)) / 100
    );

    // Baz çarpan (tech=1, wf=0.88, mach=0.92, shift=1 -> ~%81 kurulu kapasite kullanımı;
    // vardiya ve teknoloji arttıkça %100 kurulu kapasite tavanına ulaşır)
    const rawUtilization =
      (0.82 + (tech - 1) * 0.14) *
      wf *
      mach *
      (0.95 + (shift - 1) * 0.25) *
      disruptionFactor;

    const effective = Math.max(
      1,
      Math.min(installed, Math.round(installed * Math.min(1.0, rawUtilization)))
    );
    return effective;
  }

  public static computeDetailedIncomeBreakdown(
    company: PlayerCompany,
    macro: MacroEconomyState,
    todayCashInflow: number,
    todayCashOutflow: number
  ): DetailedIncomeBreakdown {
    const fin = company.financials;
    const ops = company.operations!;

    const totalRevenue = fin.revenue;
    const productSalesRevenue = Number((totalRevenue * 0.92).toFixed(2));
    const serviceRevenue = Number((totalRevenue * 0.05).toFixed(2));
    const licenseRevenue = Number(
      (
        totalRevenue *
        (ops.technologyMultiplier > 1.25 ? 0.02 : 0.01)
      ).toFixed(2)
    );
    const otherOperatingRevenue = Number(
      Math.max(
        0,
        totalRevenue - productSalesRevenue - serviceRevenue - licenseRevenue
      ).toFixed(2)
    );

    const totalCogs = fin.costOfGoodsSold;
    const rawMaterialsCost = Number((totalCogs * 0.54).toFixed(2));
    const directLaborCost = Number((totalCogs * 0.2).toFixed(2));
    const energyCost = Number((totalCogs * 0.11).toFixed(2));
    const productionMaintenanceCost = Number((totalCogs * 0.07).toFixed(2));
    const packagingCost = Number((totalCogs * 0.05).toFixed(2));
    const scrapAndObsoleteCost = Number(
      Math.max(
        0,
        totalCogs -
          rawMaterialsCost -
          directLaborCost -
          energyCost -
          productionMaintenanceCost -
          packagingCost
      ).toFixed(2)
    );

    const salariesExpense = Number((fin.personnelExpenses * 0.78).toFixed(2));
    const socialBenefitsExpense = Number(
      (fin.personnelExpenses - salariesExpense).toFixed(2)
    );
    const rdExpense = fin.researchAndDevelopment;

    const generalOpexPool = fin.operatingExpenses;
    const marketingExpense = Number(
      Math.min(generalOpexPool * 0.35, company.dailyMarketingBudget * 120).toFixed(2)
    );
    const storageExpense = Number(
      Math.min(
        generalOpexPool * 0.25,
        ops.inventoryUnits * ops.unitStorageCost * 120
      ).toFixed(2)
    );
    const remOpex = Math.max(
      0,
      generalOpexPool - marketingExpense - storageExpense
    );
    const rentExpense = Number((remOpex * 0.22).toFixed(2));
    const logisticsExpense = Number((remOpex * 0.24).toFixed(2));
    const generalAdminExpense = Number((remOpex * 0.16).toFixed(2));
    const itSystemsExpense = Number((remOpex * 0.1).toFixed(2));
    const insuranceExpense = Number((remOpex * 0.08).toFixed(2));
    const facilityMaintenanceExpense = Number((remOpex * 0.1).toFixed(2));
    const licensesAndPermitsExpense = Number((remOpex * 0.05).toFixed(2));
    const consultingExpense = Number(
      Math.max(
        0,
        remOpex -
          rentExpense -
          logisticsExpense -
          generalAdminExpense -
          itSystemsExpense -
          insuranceExpense -
          facilityMaintenanceExpense -
          licensesAndPermitsExpense
      ).toFixed(2)
    );

    const totalOpex = Number(
      (fin.personnelExpenses + rdExpense + generalOpexPool).toFixed(2)
    );

    const loanInterestExpense = Number((fin.interestExpense * 0.9).toFixed(2));
    const latePaymentInterestExpense = Number(
      (
        (company.defaultedLoanCount ?? 0) > 0 ? fin.interestExpense * 0.08 : 0
      ).toFixed(2)
    );
    const fxAndRiskExpense = Number(
      Math.max(
        0,
        fin.interestExpense - loanInterestExpense - latePaymentInterestExpense
      ).toFixed(2)
    );

    const grossProfit = fin.grossProfit;
    const grossMarginPct =
      totalRevenue > 0
        ? Number(((grossProfit / totalRevenue) * 100).toFixed(2))
        : 0;
    const EBITDA = fin.EBITDA;
    const ebitdaMarginPct =
      totalRevenue > 0 ? Number(((EBITDA / totalRevenue) * 100).toFixed(2)) : 0;
    const operatingProfit = fin.EBIT;
    const preTaxProfit = fin.preTaxIncome;
    const netProfit = fin.netIncome;

    const freeCashFlow = Number(
      (
        operatingProfit * (1 - macro.corporateTaxRate) +
        fin.depreciation -
        fin.capitalExpenditures -
        fin.changeInWorkingCapital
      ).toFixed(2)
    );
    const workingCapital = Number(
      (
        fin.cash +
        fin.inventory +
        fin.receivables -
        fin.shortTermDebt
      ).toFixed(2)
    );
    const debtToEquityRatio = Number(
      (
        fin.totalLiabilities / Math.max(1, fin.shareholdersEquity)
      ).toFixed(2)
    );
    const interestCoverageRatio =
      fin.interestExpense > 0
        ? Number((operatingProfit / fin.interestExpense).toFixed(2))
        : 99;
    const inventoryTurnover =
      fin.inventory > 0
        ? Number((totalCogs / fin.inventory).toFixed(2))
        : ops.inventoryTurnoverRatio;
    const returnOnAssetsPct = Number(
      ((netProfit / Math.max(1, fin.totalAssets)) * 100).toFixed(2)
    );
    const returnOnEquityPct = Number(
      ((netProfit / Math.max(1, fin.shareholdersEquity)) * 100).toFixed(2)
    );

    return {
      productSalesRevenue,
      serviceRevenue,
      licenseRevenue,
      otherOperatingRevenue,
      totalRevenue,
      rawMaterialsCost,
      directLaborCost,
      energyCost,
      productionMaintenanceCost,
      packagingCost,
      scrapAndObsoleteCost,
      totalCogs,
      salariesExpense,
      socialBenefitsExpense,
      rentExpense,
      logisticsExpense,
      storageExpense,
      marketingExpense,
      rdExpense,
      generalAdminExpense,
      itSystemsExpense,
      insuranceExpense,
      facilityMaintenanceExpense,
      licensesAndPermitsExpense,
      consultingExpense,
      totalOpex,
      loanInterestExpense,
      latePaymentInterestExpense,
      fxAndRiskExpense,
      totalFinancingExpense: fin.interestExpense,
      taxExpense: fin.taxExpense,
      depreciationExpense: fin.depreciation,
      capexSpend: fin.capitalExpenditures,
      dividendsPaid: Number(
        (fin.dividendPerShare * fin.sharesOutstanding).toFixed(2)
      ),
      grossProfit,
      grossMarginPct,
      EBITDA,
      ebitdaMarginPct,
      operatingProfit,
      preTaxProfit,
      netProfit,
      freeCashFlow,
      workingCapital,
      debtToEquityRatio,
      interestCoverageRatio,
      inventoryTurnover,
      returnOnAssetsPct,
      returnOnEquityPct,
      todayCashInflow: Number(todayCashInflow.toFixed(2)),
      todayCashOutflow: Number(todayCashOutflow.toFixed(2)),
      todayNetCashChange: Number((todayCashInflow - todayCashOutflow).toFixed(2)),
    };
  }
}
