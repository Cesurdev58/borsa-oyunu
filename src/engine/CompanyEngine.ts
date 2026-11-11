/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 4, 5 & 6: OYUNCU ŞİRKETİ, TALEP/STOK, DETAYLI GELİR TABLOSU VE ÖLÇEKLENEBİLİR YATIRIM MOTORU (CompanyEngine)
 */

import { SECTOR_CONFIGS } from '../data/sectors';
import { PlayerCompany } from '../models/company';
import { MacroEconomyState } from '../models/economy';
import {
  CompanyOperationsState,
  DetailedIncomeBreakdown,
  InvestmentPackageType,
  InvestmentProject,
  SalaryTier,
  WorkforcePlan,
} from '../models/finance';
import { SectorId } from '../models/market';
import { AccountingEngine } from './AccountingEngine';
import { ValuationEngine } from './ValuationEngine';

export interface EstablishCompanyParams {
  name: string;
  ticker: string;
  sector: SectorId;
  initialCapital: number;
  initialStaffCount?: number;
  initialRdBudget?: number;
  initialCapacity?: number;
}

export const INVESTMENT_PACKAGE_CATALOG: Record<
  InvestmentPackageType,
  {
    titleTR: string;
    capacityGainRatio: number;
    minCapacityGain: number;
    durationDays: number;
    temporaryDisruptionPct: number;
    delayRiskPct: number;
    cancellationPenaltyRatio: number;
    complexityMultiplier: number;
    fixedDailyOverheadAddRatio: number;
  }
> = {
  SMALL_EXPANSION: {
    titleTR: 'Küçük Kapasite Genişletme (~%5)',
    capacityGainRatio: 0.05,
    minCapacityGain: 5,
    durationDays: 5,
    temporaryDisruptionPct: 2,
    delayRiskPct: 5,
    cancellationPenaltyRatio: 0.15,
    complexityMultiplier: 1.0,
    fixedDailyOverheadAddRatio: 0.02,
  },
  MEDIUM_EXPANSION: {
    titleTR: 'Orta Kapasite Genişletme (~%15)',
    capacityGainRatio: 0.15,
    minCapacityGain: 15,
    durationDays: 12,
    temporaryDisruptionPct: 5,
    delayRiskPct: 10,
    cancellationPenaltyRatio: 0.2,
    complexityMultiplier: 1.12,
    fixedDailyOverheadAddRatio: 0.05,
  },
  LARGE_EXPANSION: {
    titleTR: 'Büyük Kapasite Genişletme (~%35)',
    capacityGainRatio: 0.35,
    minCapacityGain: 35,
    durationDays: 24,
    temporaryDisruptionPct: 10,
    delayRiskPct: 18,
    cancellationPenaltyRatio: 0.25,
    complexityMultiplier: 1.28,
    fixedDailyOverheadAddRatio: 0.1,
  },
  NEW_PRODUCTION_LINE: {
    titleTR: 'Yeni Otomasyon Üretim Hattı (~%60)',
    capacityGainRatio: 0.6,
    minCapacityGain: 50,
    durationDays: 18,
    temporaryDisruptionPct: 6,
    delayRiskPct: 12,
    cancellationPenaltyRatio: 0.22,
    complexityMultiplier: 1.22,
    fixedDailyOverheadAddRatio: 0.14,
  },
  NEW_FACTORY: {
    titleTR: 'Yeni Organize Sanayi Fabrikası (~%120)',
    capacityGainRatio: 1.2,
    minCapacityGain: 120,
    durationDays: 35,
    temporaryDisruptionPct: 3,
    delayRiskPct: 22,
    cancellationPenaltyRatio: 0.3,
    complexityMultiplier: 1.45,
    fixedDailyOverheadAddRatio: 0.25,
  },
  CUSTOM_TARGET: {
    titleTR: 'Özel Hedef Kapasite Projesi',
    capacityGainRatio: 0.1,
    minCapacityGain: 5,
    durationDays: 10,
    temporaryDisruptionPct: 4,
    delayRiskPct: 8,
    cancellationPenaltyRatio: 0.2,
    complexityMultiplier: 1.15,
    fixedDailyOverheadAddRatio: 0.06,
  },
  BUDGET_MAX: {
    titleTR: 'Bütçeye Göre Maksimum Güvenli Kapasite Yatırımı',
    capacityGainRatio: 0.25,
    minCapacityGain: 1,
    durationDays: 12,
    temporaryDisruptionPct: 5,
    delayRiskPct: 10,
    cancellationPenaltyRatio: 0.2,
    complexityMultiplier: 1.15,
    fixedDailyOverheadAddRatio: 0.06,
  },
};

export class CompanyEngine {
  public static readonly STAGE_2_NET_WORTH_THRESHOLD = 2_000_000;
  public static readonly MIN_FOUNDING_CAPITAL = 250_000;

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
    if (cleanOrig <= CompanyEngine.MAX_TECH_MULTIPLIER) {
      return {
        safeMultiplier: Number(
          Math.max(CompanyEngine.MIN_TECH_MULTIPLIER, cleanOrig).toFixed(4)
        ),
        wasMigrated: false,
        originalValue: cleanOrig,
      };
    }

    const logScaled =
      1.75 + 0.32 * Math.log(1 + (cleanOrig - CompanyEngine.MAX_TECH_MULTIPLIER));
    const safeMultiplier = Number(
      Math.max(
        CompanyEngine.MIN_TECH_MULTIPLIER,
        Math.min(CompanyEngine.MAX_TECH_MULTIPLIER, logScaled)
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
          CompanyEngine.MIN_TECH_MULTIPLIER,
          Math.min(CompanyEngine.MAX_TECH_MULTIPLIER, params.technologyMultiplier)
        ).toFixed(4)
      ),
      workforceEfficiency: Number(
        Math.max(
          CompanyEngine.MIN_WORKFORCE_EFFICIENCY,
          Math.min(
            CompanyEngine.MAX_WORKFORCE_EFFICIENCY,
            params.workforceEfficiency
          )
        ).toFixed(4)
      ),
      machineAvailability: Number(
        Math.max(
          CompanyEngine.MIN_MACHINE_AVAILABILITY,
          Math.min(
            CompanyEngine.MAX_MACHINE_AVAILABILITY,
            params.machineAvailability
          )
        ).toFixed(4)
      ),
      shiftMultiplier: Number(
        Math.max(
          CompanyEngine.MIN_SHIFT_MULTIPLIER,
          Math.min(CompanyEngine.MAX_SHIFT_MULTIPLIER, params.shiftMultiplier)
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
   * Mevcut veya eski bir `PlayerCompany` nesnesinde v5 alanlarının (`operations`,
   * `incomeBreakdown`, `investmentProjects`, `workforcePlan`, `creditScore`)
   * eksiksiz ve tutarlı olmasını sağlar.
   */
  public static ensureCompanyV5Fields(
    company: PlayerCompany,
    macro: MacroEconomyState
  ): void {
    const sectorCfg = SECTOR_CONFIGS[company.sector];
    const migTech = CompanyEngine.migrateLegacyTechMultiplier(
      company.techQualityMultiplier
    );
    company.techQualityMultiplier = migTech.safeMultiplier;

    const installedCap = Math.max(
      5,
      Math.round(
        company.productionCapacity || company.financials.productionCapacityUnits || 25
      )
    );
    company.productionCapacity = installedCap;
    company.financials.productionCapacityUnits = installedCap;

    if (!company.workforcePlan) {
      const staff = Math.max(5, Math.round(company.staffCount || 18));
      const prodStaff = Math.max(3, Math.round(staff * 0.6));
      const rdStaff = Math.max(1, Math.round(staff * 0.15));
      const salesStaff = Math.max(1, Math.round(staff * 0.15));
      const mgmtStaff = Math.max(1, staff - prodStaff - rdStaff - salesStaff);
      company.workforcePlan = {
        targetStaffCount: staff,
        departments: {
          production: prodStaff,
          rd: rdStaff,
          sales: salesStaff,
          management: mgmtStaff,
        },
        shifts: 1,
        salaryTier: 'STANDARD',
        hiringDaysRemaining: 0,
        pendingHiresCount: 0,
        trainingDaysRemaining: 0,
        workforceEfficiency: 0.88,
        turnoverRateAnnual: 0.08,
        autoHireEnabled: false,
        maxPersonnelDailyBudget: Number(
          (staff * sectorCfg.dailyStaffWage * 0.35).toFixed(2)
        ),
      };
    }

    if (!company.investmentProjects) {
      company.investmentProjects = [];
    }

    if (typeof company.shareholderLoanBalance !== 'number') {
      company.shareholderLoanBalance = 0;
    }
    if (typeof company.supplierPayableBalance !== 'number') {
      company.supplierPayableBalance = 0;
    }
    if (typeof company.unpaidTaxBalance !== 'number') {
      company.unpaidTaxBalance = 0;
    }
    if (typeof company.unpaidPayrollBalance !== 'number') {
      company.unpaidPayrollBalance = 0;
    }
    if (typeof company.creditScore !== 'number') {
      company.creditScore = 695;
    }
    if (typeof company.isBankrupt !== 'boolean') {
      company.isBankrupt = false;
    }
    if (typeof company.defaultedLoanCount !== 'number') {
      company.defaultedLoanCount = 0;
    }
    if (!Array.isArray(company.cashFlowHistory365)) {
      company.cashFlowHistory365 = [
        Number((company.dailyEbitda * 0.7).toFixed(2)),
      ];
    }

    const maxStorage = Math.max(60, installedCap * 15);
    const rawInvUnits = company.financials.inventoryUnits ?? 0;
    const currentInvUnits = Number(
      Math.min(maxStorage, Math.max(0, rawInvUnits)).toFixed(2)
    );
    if (Math.abs(currentInvUnits - rawInvUnits) > 0.001 || !company.operations) {
      company.financials.inventoryUnits = currentInvUnits;
      company.financials.inventory = Number(
        (currentInvUnits * sectorCfg.unitCost).toFixed(2)
      );
      company.financials.totalAssets = Number(
        (
          company.financials.cash +
          company.financials.inventory +
          company.financials.receivables +
          company.financials.fixedAssets
        ).toFixed(2)
      );
      company.financials.shareholdersEquity = Number(
        (
          company.financials.totalAssets - company.financials.totalLiabilities
        ).toFixed(2)
      );
      company.financials.retainedEarnings = Number(
        (
          company.financials.shareholdersEquity -
          company.financials.paidInCapital
        ).toFixed(2)
      );
    }

    if (!company.operations) {
      const clamped = CompanyEngine.clampMultipliers({
        technologyMultiplier: company.techQualityMultiplier,
        workforceEfficiency: company.workforcePlan.workforceEfficiency,
        machineAvailability: 0.92,
        shiftMultiplier: 1.0,
        productQuality: 55 + (company.techQualityMultiplier - 1) * 28,
        customerSatisfaction: 72,
        distributionCoverage: Math.min(0.95, 0.25 + installedCap / 800),
      });

      const effectiveCap = CompanyEngine.computeEffectiveCapacity({
        installedCapacity: installedCap,
        technologyMultiplier: clamped.technologyMultiplier,
        workforceEfficiency: clamped.workforceEfficiency,
        machineAvailability: clamped.machineAvailability,
        shiftMultiplier: clamped.shiftMultiplier,
        disruptionPct: 0,
      });

      const safeActualProd = Math.min(
        installedCap,
        effectiveCap,
        Math.max(1, Math.round(effectiveCap * 0.85))
      );

      company.operations = {
        installedCapacity: installedCap,
        effectiveCapacity: effectiveCap,
        plannedProduction: effectiveCap,
        actualProduction: safeActualProd,
        inventoryUnits: currentInvUnits,
        maximumStorageUnits: maxStorage,
        damagedOrObsoleteInventory: 0,
        marketDemand: Math.max(20, Math.round(installedCap * 4.5)),
        companyDemandShare: 0.2,
        potentialSalesUnits: safeActualProd,
        actualSalesUnits: safeActualProd,
        unmetDemand: 0,
        unitProductionCost: sectorCfg.unitCost,
        unitStorageCost: Number((sectorCfg.unitCost * 0.015).toFixed(2)),
        unitLogisticsCost: Number((sectorCfg.unitCost * 0.04).toFixed(2)),
        unitMarketingCost: Number(
          (
            company.dailyMarketingBudget / Math.max(1, safeActualProd)
          ).toFixed(2)
        ),
        salePrice: Number(
          (
            sectorCfg.unitPrice *
            (1 + (clamped.technologyMultiplier - 1) * 0.08)
          ).toFixed(2)
        ),
        competitorAveragePrice: sectorCfg.unitPrice,
        productQuality: clamped.productQuality,
        brandStrength: Math.min(95, 48 + Math.log10(1 + company.dailyMarketingBudget) * 7),
        distributionCoverage: clamped.distributionCoverage,
        customerSatisfaction: clamped.customerSatisfaction,
        marketSaturation: 0.35,
        technologyMultiplier: clamped.technologyMultiplier,
        workforceEfficiency: clamped.workforceEfficiency,
        machineAvailability: clamped.machineAvailability,
        shiftMultiplier: clamped.shiftMultiplier,
        rawMaterialAvailability: 1.0,
        energyOperationalCapacity: 1.0,
        inventoryTurnoverRatio: Number(
          ((safeActualProd * 120) / Math.max(1, currentInvUnits || safeActualProd)).toFixed(2)
        ),
        productionReductionRecommended: currentInvUnits > maxStorage * 0.75,
        lastProcessedTotalMinute: -1,
        migratedLegacyTechMultiplier: migTech.wasMigrated
          ? migTech.originalValue
          : undefined,
      };
    } else if (migTech.wasMigrated && !company.operations.migratedLegacyTechMultiplier) {
      company.operations.migratedLegacyTechMultiplier = migTech.originalValue;
      company.operations.technologyMultiplier = migTech.safeMultiplier;
    }

    // Eğer eski kayıtta dailyUnitsProduced kapasitenin üzerindeyse hemen normalize et
    if (company.dailyUnitsProduced > company.operations.effectiveCapacity) {
      company.dailyUnitsProduced = company.operations.effectiveCapacity;
      company.financials.dailyUnitsProduced = company.operations.effectiveCapacity;
      company.financials.dailyUnitsSold = Math.min(
        company.financials.dailyUnitsSold,
        company.operations.effectiveCapacity
      );
    }

    if (!company.incomeBreakdown) {
      company.incomeBreakdown = CompanyEngine.computeDetailedIncomeBreakdown(
        company,
        macro,
        0,
        0
      );
    }
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
      CompanyEngine.MIN_TECH_MULTIPLIER,
      Math.min(CompanyEngine.MAX_TECH_MULTIPLIER, params.technologyMultiplier)
    );
    const wf = Math.max(
      CompanyEngine.MIN_WORKFORCE_EFFICIENCY,
      Math.min(CompanyEngine.MAX_WORKFORCE_EFFICIENCY, params.workforceEfficiency)
    );
    const mach = Math.max(
      CompanyEngine.MIN_MACHINE_AVAILABILITY,
      Math.min(CompanyEngine.MAX_MACHINE_AVAILABILITY, params.machineAvailability)
    );
    const shift = Math.max(
      CompanyEngine.MIN_SHIFT_MULTIPLIER,
      Math.min(CompanyEngine.MAX_SHIFT_MULTIPLIER, params.shiftMultiplier)
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

  /**
   * Yeni oyuncu şirketi kurar.
   */
  public static establishPlayerCompany(params: {
    input: EstablishCompanyParams;
    playerCash: number;
    playerNetWorth: number;
    currentDay: number;
    existingTickers: string[];
    macro: MacroEconomyState;
  }): {
    success: boolean;
    message: string;
    company?: PlayerCompany;
    newPlayerCash: number;
  } {
    const { input, playerCash, playerNetWorth, currentDay, existingTickers, macro } = params;

    if (playerNetWorth < CompanyEngine.STAGE_2_NET_WORTH_THRESHOLD) {
      return {
        success: false,
        message: `Aşama 2 şirket kurulumu için gereken minimum Net Varlık: ₺${CompanyEngine.STAGE_2_NET_WORTH_THRESHOLD.toLocaleString('tr-TR')}. Mevcut Net Varlık: ₺${playerNetWorth.toLocaleString('tr-TR')}`,
        newPlayerCash: playerCash,
      };
    }

    const capital = Number(input.initialCapital.toFixed(2));
    if (!Number.isFinite(capital) || capital < CompanyEngine.MIN_FOUNDING_CAPITAL) {
      return {
        success: false,
        message: `Şirket kuruluşu için en az ₺${CompanyEngine.MIN_FOUNDING_CAPITAL.toLocaleString('tr-TR')} başlangıç sermayesi gereklidir.`,
        newPlayerCash: playerCash,
      };
    }

    if (capital > playerCash) {
      return {
        success: false,
        message: `Yetersiz kişisel nakit. Gereken: ₺${capital.toLocaleString('tr-TR')}, Mevcut Nakit: ₺${playerCash.toLocaleString('tr-TR')}`,
        newPlayerCash: playerCash,
      };
    }

    const cleanName = input.name.trim() || 'Anadolu İnovasyon Girişimi A.Ş.';
    let cleanTicker = input.ticker
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 5);
    if (!cleanTicker) cleanTicker = 'HOLD';
    if (existingTickers.includes(cleanTicker)) {
      cleanTicker = `${cleanTicker.slice(0, 3)}X`;
    }

    const staffCount = Math.max(5, Math.min(200, Math.round(input.initialStaffCount ?? 18)));
    const productionCapacity = Math.max(10, Math.min(250, Math.round(input.initialCapacity ?? 25)));
    const dailyRdBudget = Math.max(0, Math.min(150_000, Math.round(input.initialRdBudget ?? 10_000)));
    const totalShares = 100_000;

    const sectorCfg = SECTOR_CONFIGS[input.sector];
    const fixedAssets = Number(
      Math.min(capital * 0.45, productionCapacity * sectorCfg.unitCapacityCost * 3.0).toFixed(2)
    );
    const inventoryUnits = Math.round(productionCapacity * 3);
    const inventory = Number(
      Math.min(capital * 0.15, inventoryUnits * sectorCfg.unitCost).toFixed(2)
    );
    const actualInitialInvUnits = Math.round(inventory / sectorCfg.unitCost);
    const receivables = 0;
    const cash = Number((capital - fixedAssets - inventory).toFixed(2));

    const financials = AccountingEngine.createInitialFinancialStatement({
      sector: input.sector,
      initialEquityCapital: capital,
      debtRatio: 0,
      sharesOutstanding: totalShares,
      staffCount,
      productionCapacityUnits: productionCapacity,
      dividendYieldAnnual: 0,
      sharePrice: capital / totalShares,
      corporateTaxRate: macro.corporateTaxRate,
      policyInterestRate: macro.policyInterestRate,
    });

    financials.cash = cash;
    financials.inventory = Number((actualInitialInvUnits * sectorCfg.unitCost).toFixed(2));
    financials.inventoryUnits = actualInitialInvUnits;
    financials.receivables = receivables;
    financials.fixedAssets = fixedAssets;
    financials.totalAssets = Number(
      (financials.cash + financials.inventory + financials.receivables + financials.fixedAssets).toFixed(2)
    );
    // Kuruş farkını nakde ekle
    const roundingDiff = Number((capital - financials.totalAssets).toFixed(2));
    financials.cash = Number((financials.cash + roundingDiff).toFixed(2));
    financials.totalAssets = capital;
    financials.shortTermDebt = 0;
    financials.longTermDebt = 0;
    financials.totalLiabilities = 0;
    financials.paidInCapital = capital;
    financials.retainedEarnings = 0;
    financials.shareholdersEquity = capital;

    const valuation = ValuationEngine.computeCompanyValuation(
      financials,
      input.sector,
      macro,
      1.0
    );

    const newPlayerCash = Number((playerCash - capital).toFixed(2));

    const company: PlayerCompany = {
      name: cleanName,
      ticker: cleanTicker,
      sector: input.sector,
      foundedDay: currentDay,
      operatingDays: 0,
      corporateGovernanceScore: 72,
      capitalCash: financials.cash,
      staffCount,
      productionCapacity,
      dailyRdBudget,
      dailyMarketingBudget: 3_500,
      techQualityMultiplier: 1.0,
      dailyUnitsProduced: financials.dailyUnitsProduced,
      dailyRevenue: Number((financials.revenue / 120).toFixed(2)),
      dailyOpex: Number(
        (
          (financials.operatingExpenses +
            financials.personnelExpenses +
            financials.researchAndDevelopment) /
          120
        ).toFixed(2)
      ),
      dailyEbitda: Number((financials.EBITDA / 120).toFixed(2)),
      annualizedRevenue: financials.revenue,
      annualizedEbitda: financials.EBITDA,
      financials,
      valuation: {
        ...valuation,
        equityValue: capital,
        enterpriseValue: Number((capital - financials.cash).toFixed(2)),
        fairValuePerShare: Number((capital / totalShares).toFixed(2)),
      },
      enterpriseValue: capital,
      equityValue: capital,
      totalShares,
      playerOwnedShares: totalShares,
      playerOwnershipPct: 100,
      isPubliclyListed: false,
      ipoOfferPrice: null,
      ipoProceedsRaised: 0,
      ipoDay: null,
      revenueHistory: [financials.revenue],
      ebitdaHistory: [financials.EBITDA],
      valuationHistory: [capital],
      quarterlyReports: [
        AccountingEngine.createQuarterlyReport(financials, currentDay, macro.corporateTaxRate),
      ],
    };

    CompanyEngine.ensureCompanyV5Fields(company, macro);
    // Kuruluş anında özkaynak değerini yatırılan sermayeye sabitle (net varlık zıplamasın)
    company.equityValue = capital;
    company.enterpriseValue = capital;
    company.valuation.equityValue = capital;
    company.valuation.fairValuePerShare = Number((capital / totalShares).toFixed(2));

    return {
      success: true,
      message: `${cleanName} (${cleanTicker}) ₺${capital.toLocaleString('tr-TR')} ödenmiş sermaye ile kuruldu.`,
      company,
      newPlayerCash,
    };
  }

  /**
   * Çift Kayıt Sermaye Aktarımı (Capital Injection)
   */
  public static injectCapital(params: {
    company: PlayerCompany;
    amount: number;
    playerCash: number;
  }): {
    success: boolean;
    message: string;
    newPlayerCash: number;
  } {
    const { company, amount, playerCash } = params;
    const cleanAmount = Number(amount.toFixed(2));

    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      return {
        success: false,
        message: 'Aktarılacak sermaye tutarı pozitif olmalıdır.',
        newPlayerCash: playerCash,
      };
    }

    if (cleanAmount > playerCash) {
      return {
        success: false,
        message: 'Aktarılacak tutar kullanılabilir kişisel nakdinizi aşamaz.',
        newPlayerCash: playerCash,
      };
    }

    const newPlayerCash = Number((playerCash - cleanAmount).toFixed(2));
    company.capitalCash = Number((company.capitalCash + cleanAmount).toFixed(2));
    company.financials.cash = Number((company.financials.cash + cleanAmount).toFixed(2));
    company.financials.totalAssets = Number(
      (company.financials.totalAssets + cleanAmount).toFixed(2)
    );
    company.financials.paidInCapital = Number(
      (company.financials.paidInCapital + cleanAmount).toFixed(2)
    );
    company.financials.shareholdersEquity = Number(
      (company.financials.shareholdersEquity + cleanAmount).toFixed(2)
    );

    company.equityValue = Number((company.equityValue + cleanAmount).toFixed(2));
    company.enterpriseValue = company.equityValue;
    company.valuation.equityValue = company.equityValue;
    company.valuation.fairValuePerShare = Number(
      (company.equityValue / company.totalShares).toFixed(2)
    );

    return {
      success: true,
      message: `Şirket hazinesine çift kayıt muhasebe ile ₺${cleanAmount.toLocaleString('tr-TR')} sermaye aktarıldı.`,
      newPlayerCash,
    };
  }

  /**
   * AŞAMA 6: Ölçeklenebilir Yatırım Projesi Maliyet ve Kapasite Hesaplayıcısı
   * Şirket büyüdükçe arazi, makine, entegrasyon, inşaat ve çevresel uyum maliyetleri doğrusal olmayan (non-linear) şekilde artar.
   */
  public static computeInvestmentProjectQuote(
    company: PlayerCompany,
    packageType: InvestmentPackageType,
    options?: {
      customCapacityGain?: number;
      budgetMaxMode?: boolean;
      upcomingLoanInstallments?: number;
    }
  ): {
    packageType: InvestmentPackageType;
    title: string;
    capacityGainUnits: number;
    durationDays: number;
    totalCost: number;
    temporaryDisruptionPct: number;
    delayRiskPct: number;
    cancellationCost: number;
    fixedDailyOverheadAdd: number;
    safeAvailableBudget: number;
    affordable: boolean;
  } {
    const sectorCfg = SECTOR_CONFIGS[company.sector];
    const pkg = INVESTMENT_PACKAGE_CATALOG[packageType];
    const currentCap = Math.max(10, company.productionCapacity);

    // Zorunlu işletme sermayesi tamponu: 3 günlük OPEX + yaklaşan kredi taksiti + ödenmemiş maaş/vergi
    const mandatoryReserve = Number(
      Math.max(
        25_000,
        company.dailyOpex * 3 +
          (options?.upcomingLoanInstallments ?? 0) +
          (company.unpaidPayrollBalance ?? 0) +
          (company.unpaidTaxBalance ?? 0)
      ).toFixed(2)
    );
    const safeAvailableBudget = Number(
      Math.max(0, company.financials.cash - mandatoryReserve).toFixed(2)
    );

    // Ölçek büyüdükçe artan birim yatırım maliyeti (Non-linear scale factor)
    const scaleComplexityFactor =
      pkg.complexityMultiplier * (1 + Math.pow(currentCap / 250, 0.32) * 0.45);
    const unitCapexCost = Number(
      (sectorCfg.unitCapacityCost * 4.0 * scaleComplexityFactor).toFixed(2)
    );

    let capacityGainUnits: number;
    if (options?.budgetMaxMode || packageType === 'BUDGET_MAX') {
      capacityGainUnits = Math.max(
        0,
        Math.floor(safeAvailableBudget / Math.max(1, unitCapexCost))
      );
    } else if (
      typeof options?.customCapacityGain === 'number' &&
      options.customCapacityGain > 0
    ) {
      capacityGainUnits = Math.max(1, Math.round(options.customCapacityGain));
    } else {
      capacityGainUnits = Math.max(
        pkg.minCapacityGain,
        Math.round(currentCap * pkg.capacityGainRatio)
      );
    }

    const totalCost = Number((capacityGainUnits * unitCapexCost).toFixed(2));
    const cancellationCost = Number(
      (totalCost * pkg.cancellationPenaltyRatio).toFixed(2)
    );
    const fixedDailyOverheadAdd = Number(
      (
        capacityGainUnits *
        sectorCfg.unitCost *
        pkg.fixedDailyOverheadAddRatio
      ).toFixed(2)
    );

    return {
      packageType,
      title: pkg.titleTR,
      capacityGainUnits,
      durationDays: pkg.durationDays,
      totalCost,
      temporaryDisruptionPct: pkg.temporaryDisruptionPct,
      delayRiskPct: pkg.delayRiskPct,
      cancellationCost,
      fixedDailyOverheadAdd,
      safeAvailableBudget,
      affordable:
        capacityGainUnits > 0 &&
        totalCost <= safeAvailableBudget + 0.01 &&
        totalCost <= company.financials.cash,
    };
  }

  /**
   * AŞAMA 6: Yeni Ölçeklenebilir Yatırım Projesi Başlatır (`startInvestmentProject`).
   * - Yatırım anında tamamlanmaz; inşaat süresi (`durationDays`) boyunca ilerler.
   * - Proje tamamlanmadan kurulu kapasiteye eklenmez!
   * - Bütçeye göre maksimum seçeneği şirketi zorunlu ödemeler için nakitsiz bırakmaz.
   */
  public static startInvestmentProject(
    company: PlayerCompany,
    params: {
      packageType: InvestmentPackageType;
      currentDay: number;
      projectSeq: number;
      customCapacityGain?: number;
      budgetMaxMode?: boolean;
      upcomingLoanInstallments?: number;
      facilityLocation?: string;
    }
  ): {
    success: boolean;
    message: string;
    project: InvestmentProject | null;
    capitalSpent: number;
  } {
    const quote = CompanyEngine.computeInvestmentProjectQuote(
      company,
      params.packageType,
      {
        customCapacityGain: params.customCapacityGain,
        budgetMaxMode: params.budgetMaxMode,
        upcomingLoanInstallments: params.upcomingLoanInstallments,
      }
    );

    if (quote.capacityGainUnits <= 0) {
      return {
        success: false,
        message:
          'Zorunlu işletme sermayesi ve ödeme tamponu ayrıldıktan sonra kapasite yatırımı için yeterli serbest nakit bulunmuyor.',
        project: null,
        capitalSpent: 0,
      };
    }

    if (params.budgetMaxMode && quote.totalCost > quote.safeAvailableBudget) {
      return {
        success: false,
        message: 'Bütçeye göre maksimum yatırım için güvenli nakit tamponu yetersiz.',
        project: null,
        capitalSpent: 0,
      };
    }

    if (quote.totalCost > company.financials.cash) {
      return {
        success: false,
        message: `${quote.title} için gereken ₺${quote.totalCost.toLocaleString('tr-TR')} şirket kasasında mevcut değil (Kasa: ₺${company.financials.cash.toLocaleString('tr-TR')}).`,
        project: null,
        capitalSpent: 0,
      };
    }

    // Nakit azalır, Yapılmakta Olan Yatırımlar (Fixed Assets) aynı tutarda artar -> Bilanço denkliği korunur!
    company.financials.cash = Number(
      (company.financials.cash - quote.totalCost).toFixed(2)
    );
    company.financials.fixedAssets = Number(
      (company.financials.fixedAssets + quote.totalCost).toFixed(2)
    );
    company.financials.totalAssets = Number(
      (
        company.financials.cash +
        company.financials.inventory +
        company.financials.receivables +
        company.financials.fixedAssets
      ).toFixed(2)
    );
    company.capitalCash = company.financials.cash;

    const projectId = `PRJ-D${params.currentDay}-S${String(params.projectSeq).padStart(5, '0')}`;
    const project: InvestmentProject = {
      projectId,
      packageType: params.packageType,
      title: quote.title,
      startDay: params.currentDay,
      estimatedEndDay: params.currentDay + quote.durationDays,
      totalCost: quote.totalCost,
      paidAmount: quote.totalCost,
      remainingAmount: 0,
      progressPct: 0,
      capacityGainUnits: quote.capacityGainUnits,
      temporaryDisruptionPct: quote.temporaryDisruptionPct,
      delayRiskPct: quote.delayRiskPct,
      cancellationCost: quote.cancellationCost,
      fundingSource: 'COMPANY_CASH',
      status: 'IN_PROGRESS',
      facilityLocation: params.facilityLocation || 'Organize Sanayi Bölgesi',
      fixedDailyOverheadAdd: quote.fixedDailyOverheadAdd,
    };

    if (!company.investmentProjects) {
      company.investmentProjects = [];
    }
    company.investmentProjects.unshift(project);

    return {
      success: true,
      message: `${quote.title} (+${quote.capacityGainUnits} br/gün) başlatıldı. Tahmini tamamlanma: Gün ${project.estimatedEndDay} (${quote.durationDays} iş günü).`,
      project,
      capitalSpent: quote.totalCost,
    };
  }

  /**
   * Devam eden bir yatırım projesini iptal eder:
   * - Yalnızca `(paidAmount - cancellationCost)` kadar tutar nakde iade edilir ve duran varlıktan düşülür.
   * - İptal edilen proje belirlenen ceza dışında asla yoktan para oluşturmaz!
   */
  public static cancelInvestmentProject(
    company: PlayerCompany,
    projectId: string
  ): {
    success: boolean;
    message: string;
    refundedAmount: number;
    penaltyPaid: number;
  } {
    const project = (company.investmentProjects ?? []).find(
      (p) => p.projectId === projectId
    );
    if (!project || project.status !== 'IN_PROGRESS') {
      return {
        success: false,
        message: `${projectId} numaralı devam eden yatırım projesi bulunamadı.`,
        refundedAmount: 0,
        penaltyPaid: 0,
      };
    }

    const penaltyPaid = Number(
      Math.min(project.paidAmount, project.cancellationCost).toFixed(2)
    );
    const refundedAmount = Number(
      Math.max(0, project.paidAmount - penaltyPaid).toFixed(2)
    );

    project.status = 'CANCELLED';

    // Duran varlıktan ödenen proje bedelinin tamamı çıkar, kasaya sadece iade kısmı girer, ceza geçmiş yıl kârından düşer
    company.financials.fixedAssets = Number(
      Math.max(25_000, company.financials.fixedAssets - project.paidAmount).toFixed(2)
    );
    company.financials.cash = Number(
      (company.financials.cash + refundedAmount).toFixed(2)
    );
    company.capitalCash = company.financials.cash;
    company.financials.totalAssets = Number(
      (
        company.financials.cash +
        company.financials.inventory +
        company.financials.receivables +
        company.financials.fixedAssets
      ).toFixed(2)
    );
    company.financials.shareholdersEquity = Number(
      (
        company.financials.totalAssets - company.financials.totalLiabilities
      ).toFixed(2)
    );
    company.financials.retainedEarnings = Number(
      (
        company.financials.shareholdersEquity - company.financials.paidInCapital
      ).toFixed(2)
    );

    return {
      success: true,
      message: `${project.title} (${projectId}) iptal edildi. İptal cezası: ₺${penaltyPaid.toLocaleString('tr-TR')}, Kasaya İade: ₺${refundedAmount.toLocaleString('tr-TR')}.`,
      refundedAmount,
      penaltyPaid,
    };
  }

  /**
   * Yatırım projelerinin zaman içinde ilerlemesini (`dayFraction`) işler.
   * Proje `%100` tamamlandığında kurulu kapasiteye (`productionCapacity`) eklenir.
   */
  public static stepInvestmentProjects(
    company: PlayerCompany,
    dayFraction: number
  ): {
    completedProjectsCount: number;
    capacityAddedToday: number;
    activeDisruptionPct: number;
  } {
    let completedProjectsCount = 0;
    let capacityAddedToday = 0;
    let activeDisruptionPct = 0;

    for (const prj of company.investmentProjects ?? []) {
      if (prj.status !== 'IN_PROGRESS') continue;

      const totalDays = Math.max(1, prj.estimatedEndDay - prj.startDay);
      const progressDelta = (dayFraction / totalDays) * 100;
      prj.progressPct = Number(
        Math.min(100, prj.progressPct + progressDelta).toFixed(2)
      );

      if (prj.progressPct >= 99.99) {
        prj.progressPct = 100;
        prj.status = 'COMPLETED';
        company.productionCapacity += prj.capacityGainUnits;
        company.financials.productionCapacityUnits = company.productionCapacity;
        if (company.operations) {
          company.operations.installedCapacity = company.productionCapacity;
          company.operations.maximumStorageUnits = Math.max(
            60,
            company.productionCapacity * 15
          );
          company.operations.plannedProduction = Math.min(
            company.productionCapacity,
            company.operations.plannedProduction + prj.capacityGainUnits
          );
        }
        completedProjectsCount += 1;
        capacityAddedToday += prj.capacityGainUnits;
      } else {
        activeDisruptionPct = Math.max(
          activeDisruptionPct,
          prj.temporaryDisruptionPct
        );
      }
    }

    return {
      completedProjectsCount,
      capacityAddedToday,
      activeDisruptionPct,
    };
  }

  /**
   * Stoku İndirimli Tasfiye Et (`liquidateExcessInventory`)
   */
  public static liquidateExcessInventory(
    company: PlayerCompany,
    unitsToLiquidate: number,
    discountRatio: number = 0.25
  ): {
    success: boolean;
    message: string;
    unitsSold: number;
    cashProceeds: number;
  } {
    const cleanUnits = Math.min(
      Math.floor(company.financials.inventoryUnits),
      Math.max(0, Math.floor(unitsToLiquidate))
    );
    if (cleanUnits <= 0) {
      return {
        success: false,
        message: 'Tasfiye edilecek stok birimi bulunmuyor.',
        unitsSold: 0,
        cashProceeds: 0,
      };
    }

    const cleanDiscount = Math.max(0.1, Math.min(0.6, discountRatio));
    const liquidationPrice = Number(
      (company.financials.unitSellingPrice * (1 - cleanDiscount)).toFixed(2)
    );
    const cashProceeds = Number((cleanUnits * liquidationPrice).toFixed(2));
    const costRemoved = Number(
      (cleanUnits * company.financials.unitProductionCost).toFixed(2)
    );

    company.financials.inventoryUnits -= cleanUnits;
    if (company.operations) {
      company.operations.inventoryUnits = company.financials.inventoryUnits;
    }
    company.financials.inventory = Number(
      (
        company.financials.inventoryUnits * company.financials.unitProductionCost
      ).toFixed(2)
    );
    company.financials.cash = Number(
      (company.financials.cash + cashProceeds).toFixed(2)
    );
    company.capitalCash = company.financials.cash;
    company.financials.totalAssets = Number(
      (
        company.financials.cash +
        company.financials.inventory +
        company.financials.receivables +
        company.financials.fixedAssets
      ).toFixed(2)
    );
    company.financials.shareholdersEquity = Number(
      (
        company.financials.totalAssets - company.financials.totalLiabilities
      ).toFixed(2)
    );
    company.financials.retainedEarnings = Number(
      (
        company.financials.shareholdersEquity - company.financials.paidInCapital
      ).toFixed(2)
    );
    void costRemoved;

    return {
      success: true,
      message: `${cleanUnits} birim stok %${Math.round(cleanDiscount * 100)} indirimle tasfiye edildi (+₺${cashProceeds.toLocaleString('tr-TR')} nakit girişi).`,
      unitsSold: cleanUnits,
      cashProceeds,
    };
  }

  /**
   * Oyuncu şirketinin operasyonel parametrelerini (personel, kapasite, satış fiyatı, üretim planı, Ar-Ge, pazarlama) günceller.
   */
  public static configureOperations(
    company: PlayerCompany,
    params: {
      targetStaffCount?: number;
      targetProductionCapacity?: number;
      dailyRdBudget?: number;
      dailyMarketingBudget?: number;
      borrowLoanAmount?: number;
      unitSellingPrice?: number;
      unitSalePrice?: number;
      plannedProductionUnits?: number;
      shifts?: 1 | 2 | 3;
      shiftCount?: 1 | 2 | 3;
      salaryTier?: SalaryTier;
      autoHireEnabled?: boolean;
      instantCapacityForLegacyCompat?: boolean;
      currentDay?: number;
      projectSeq?: number;
    }
  ): {
    success: boolean;
    message: string;
    capitalSpent: number;
  } {
    const sectorCfg = SECTOR_CONFIGS[company.sector];
    let capitalSpent = 0;

    // Kurumsal Kredi Kullanımı (Eski çağrılarla geriye uyumluluk)
    if (typeof params.borrowLoanAmount === 'number' && params.borrowLoanAmount > 0) {
      const loan = Number(params.borrowLoanAmount.toFixed(2));
      company.financials.cash = Number((company.financials.cash + loan).toFixed(2));
      company.capitalCash = company.financials.cash;
      company.financials.longTermDebt = Number(
        (company.financials.longTermDebt + loan).toFixed(2)
      );
      company.financials.totalLiabilities = Number(
        (company.financials.shortTermDebt + company.financials.longTermDebt).toFixed(2)
      );
      company.financials.totalAssets = Number(
        (
          company.financials.cash +
          company.financials.inventory +
          company.financials.receivables +
          company.financials.fixedAssets
        ).toFixed(2)
      );
    }

    if (typeof params.targetProductionCapacity === 'number') {
      const targetCap = Math.max(5, Math.round(params.targetProductionCapacity));
      const deltaCap = targetCap - company.productionCapacity;
      if (deltaCap > 0) {
        if (params.instantCapacityForLegacyCompat === false) {
          const prjRes = CompanyEngine.startInvestmentProject(company, {
            packageType: 'CUSTOM_TARGET',
            currentDay: params.currentDay ?? 1,
            projectSeq: params.projectSeq ?? 1,
            customCapacityGain: deltaCap,
          });
          if (!prjRes.success) {
            return {
              success: false,
              message: prjRes.message,
              capitalSpent: 0,
            };
          }
          capitalSpent += prjRes.capitalSpent;
        } else {
          // Ölçek büyüdükçe doğrusal olmayan (non-linear) CAPEX maliyeti
          const scaleFactor =
            1 + Math.pow(company.productionCapacity / 250, 0.32) * 0.45;
          const capexCost = Number(
            (deltaCap * sectorCfg.unitCapacityCost * 4.0 * scaleFactor).toFixed(2)
          );
          if (capexCost > company.financials.cash) {
            return {
              success: false,
              message: `Kapasite yatırımı (CAPEX) için şirket kasasında ₺${capexCost.toLocaleString('tr-TR')} nakit gerekiyor.`,
              capitalSpent: 0,
            };
          }
          company.financials.cash = Number(
            (company.financials.cash - capexCost).toFixed(2)
          );
          company.financials.fixedAssets = Number(
            (company.financials.fixedAssets + capexCost).toFixed(2)
          );
          company.capitalCash = company.financials.cash;
          capitalSpent += capexCost;

          // Eşzamanlı tamamlanmış proje kaydı oluştur (anında uygulanan kapasitenin ikinci kez eklenmesini önler)
          if (!company.investmentProjects) {
            company.investmentProjects = [];
          }
          const projSeq = company.investmentProjects.length + 1;
          company.investmentProjects.unshift({
            projectId: `PRJ-CAP-D${params.currentDay ?? 1}-S${projSeq}-${deltaCap}`,
            packageType: 'CUSTOM_TARGET',
            title: `Kapasite Artırımı (+${deltaCap} br/gün)`,
            startDay: params.currentDay ?? 1,
            estimatedEndDay: params.currentDay ?? 1,
            totalCost: capexCost,
            paidAmount: capexCost,
            remainingAmount: 0,
            progressPct: 100,
            capacityGainUnits: deltaCap,
            temporaryDisruptionPct: 0,
            delayRiskPct: 0,
            cancellationCost: 0,
            fundingSource: 'COMPANY_CASH',
            status: 'COMPLETED',
            fixedDailyOverheadAdd: Number((deltaCap * 2.5).toFixed(2)),
          });

          company.productionCapacity = targetCap;
          company.financials.productionCapacityUnits = targetCap;
          if (company.operations) {
            company.operations.installedCapacity = targetCap;
            company.operations.maximumStorageUnits = Math.max(
              60,
              targetCap * 15
            );
            company.operations.plannedProduction = targetCap;
          }
        }
      }
    }

    if (typeof params.targetStaffCount === 'number') {
      if (!Number.isFinite(params.targetStaffCount) || params.targetStaffCount <= 0) {
        return {
          success: false,
          message: 'Çalışan sayısı 0’dan büyük olmalıdır.',
          capitalSpent: 0,
        };
      }
      const targetStaff = Math.max(5, Math.round(params.targetStaffCount));
      const deltaStaff = targetStaff - company.staffCount;
      if (deltaStaff > 0) {
        const onboardingFee = Number(
          (deltaStaff * sectorCfg.dailyStaffWage * 0.8).toFixed(2)
        );
        if (onboardingFee > company.financials.cash) {
          return {
            success: false,
            message: `Yeni çalışan işe alımı için şirket kasasında ₺${onboardingFee.toLocaleString('tr-TR')} nakit gerekiyor.`,
            capitalSpent: 0,
          };
        }
        company.financials.cash = Number(
          (company.financials.cash - onboardingFee).toFixed(2)
        );
        company.financials.totalAssets = Number(
          (company.financials.totalAssets - onboardingFee).toFixed(2)
        );
        company.financials.retainedEarnings = Number(
          (company.financials.retainedEarnings - onboardingFee).toFixed(2)
        );
        company.financials.shareholdersEquity = Number(
          (
            company.financials.totalAssets - company.financials.totalLiabilities
          ).toFixed(2)
        );
        company.capitalCash = company.financials.cash;
        capitalSpent += onboardingFee;
      }
      company.staffCount = targetStaff;
      company.financials.staffCount = targetStaff;
      if (company.workforcePlan) {
        company.workforcePlan.targetStaffCount = targetStaff;
        const prod = Math.max(3, Math.round(targetStaff * 0.6));
        const rd = Math.max(1, Math.round(targetStaff * 0.15));
        const sales = Math.max(1, Math.round(targetStaff * 0.15));
        const mgmt = Math.max(1, targetStaff - prod - rd - sales);
        company.workforcePlan.departments = {
          production: prod,
          rd,
          sales,
          management: mgmt,
        };
      }
    }

    if (typeof params.dailyRdBudget === 'number') {
      company.dailyRdBudget = Math.max(0, Math.round(params.dailyRdBudget));
    }

    if (typeof params.dailyMarketingBudget === 'number') {
      company.dailyMarketingBudget = Math.max(
        0,
        Math.round(params.dailyMarketingBudget)
      );
    }

    const effectivePrice =
      typeof params.unitSellingPrice === 'number'
        ? params.unitSellingPrice
        : params.unitSalePrice;
    if (typeof effectivePrice === 'number' && company.operations) {
      const cleanPrice = Number(Math.max(10, effectivePrice).toFixed(2));
      company.operations.salePrice = cleanPrice;
      company.financials.unitSellingPrice = cleanPrice;
    }

    if (
      typeof params.plannedProductionUnits === 'number' &&
      company.operations
    ) {
      company.operations.plannedProduction = Math.max(
        0,
        Math.min(
          company.productionCapacity,
          Math.round(params.plannedProductionUnits)
        )
      );
    }

    const effectiveShifts =
      typeof params.shifts === 'number' ? params.shifts : params.shiftCount;
    if (
      typeof effectiveShifts === 'number' &&
      company.workforcePlan &&
      company.operations
    ) {
      company.workforcePlan.shifts = effectiveShifts;
      company.operations.shiftMultiplier =
        effectiveShifts === 1 ? 1.0 : effectiveShifts === 2 ? 1.65 : 2.25;
    }

    if (params.salaryTier && company.workforcePlan && company.operations) {
      company.workforcePlan.salaryTier = params.salaryTier;
      const eff =
        params.salaryTier === 'ECONOMY'
          ? 0.72
          : params.salaryTier === 'STANDARD'
          ? 0.9
          : 1.08;
      company.workforcePlan.workforceEfficiency = eff;
      company.operations.workforceEfficiency = eff;
    }

    if (typeof params.autoHireEnabled === 'boolean' && company.workforcePlan) {
      company.workforcePlan.autoHireEnabled = params.autoHireEnabled;
    }

    // İşe alım, vardiya veya üretim hedefi değiştiğinde etkin kapasite ve fiili üretimi anında güncelle (kurulu kapasiteyi artırmadan darboğazı yeniden hesapla)
    if (company.operations) {
      const ops = company.operations;
      const installedCapacity = Math.max(
        1,
        Math.round(company.productionCapacity)
      );
      ops.installedCapacity = installedCapacity;
      const activeDisruptionPct = (company.investmentProjects ?? [])
        .filter((p) => p.status === 'IN_PROGRESS')
        .reduce((acc, p) => acc + p.temporaryDisruptionPct, 0);
      const effectiveCapacity = CompanyEngine.computeEffectiveCapacity({
        installedCapacity,
        technologyMultiplier: ops.technologyMultiplier,
        workforceEfficiency: ops.workforceEfficiency,
        machineAvailability: ops.machineAvailability,
        shiftMultiplier: ops.shiftMultiplier,
        disruptionPct: Math.min(35, activeDisruptionPct),
      });
      ops.effectiveCapacity = effectiveCapacity;

      const laborCapacity = Math.max(
        1,
        Math.round(company.financials.staffCount * 2.5 * ops.workforceEfficiency)
      );
      const materialEnergyLimit = Math.round(
        installedCapacity *
          Math.min(ops.rawMaterialAvailability, ops.energyOperationalCapacity)
      );
      const plannedDailyUnits =
        ops.plannedProduction > 0
          ? Math.min(installedCapacity, ops.plannedProduction)
          : effectiveCapacity;
      const freeStorage = Math.max(
        0,
        ops.maximumStorageUnits - company.financials.inventoryUnits
      );
      const boundedOutput = Math.max(
        0,
        Math.min(
          installedCapacity,
          effectiveCapacity,
          plannedDailyUnits,
          laborCapacity,
          materialEnergyLimit,
          freeStorage > 0 ? installedCapacity : 0
        )
      );
      ops.actualProduction = Number(boundedOutput.toFixed(2));
      company.dailyUnitsProduced = ops.actualProduction;
    }

    return {
      success: true,
      message: `Şirket operasyonları güncellendi: ${company.staffCount} çalışan, ${company.productionCapacity} kapasite birimi, ₺${company.dailyRdBudget.toLocaleString('tr-TR')}/gün Ar-Ge.`,
      capitalSpent,
    };
  }

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
    CompanyEngine.ensureCompanyV5Fields(company, macro);
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
    const prjStep = CompanyEngine.stepInvestmentProjects(company, cleanFraction);

    // 2. Ar-Ge İlerlemesi ve Güvenli Teknoloji Çarpanı [1.00, 2.50]
    const effectiveRd = Math.min(
      company.dailyRdBudget,
      Math.max(0, fin.cash * 0.25)
    );
    const fullDayRdIncrement =
      company.techQualityMultiplier < CompanyEngine.MAX_TECH_MULTIPLIER
        ? 0.012 *
          Math.log(1 + effectiveRd / 15_000) *
          Math.max(
            0.05,
            (CompanyEngine.MAX_TECH_MULTIPLIER - company.techQualityMultiplier) /
              1.5
          )
        : 0;
    const rdIncrement = fullDayRdIncrement * cleanFraction;
    company.techQualityMultiplier = Number(
      Math.max(
        CompanyEngine.MIN_TECH_MULTIPLIER,
        Math.min(
          CompanyEngine.MAX_TECH_MULTIPLIER,
          company.techQualityMultiplier + rdIncrement
        )
      ).toFixed(6)
    );

    const clamped = CompanyEngine.clampMultipliers({
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

    const effectiveCapacity = CompanyEngine.computeEffectiveCapacity({
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

    const fullDayPotentialSales =
      totalSectorMarketDemand <= 0
        ? 0
        : Math.max(
            0,
            Math.round(totalSectorMarketDemand * demandShare)
          );
    ops.potentialSalesUnits = fullDayPotentialSales;

    const stepDesiredSales = Number(
      (fullDayPotentialSales * cleanFraction).toFixed(4)
    );
    const availableToSellNow = Math.max(0, fin.inventoryUnits + stepProducedUnits);
    const stepSoldUnits = Number(
      Math.min(availableToSellNow, stepDesiredSales).toFixed(4)
    );

    ops.actualSalesUnits = Number((stepSoldUnits / cleanFraction).toFixed(2));
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
    const fullDayTax =
      fullDayPreTax > 0 ? fullDayPreTax * macro.corporateTaxRate : 0;
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
    fin.taxExpense =
      fin.preTaxIncome > 0
        ? Number((fin.preTaxIncome * macro.corporateTaxRate).toFixed(2))
        : 0;
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

    company.incomeBreakdown = CompanyEngine.computeDetailedIncomeBreakdown(
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
    CompanyEngine.stepPlayerCompanyFraction(
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
    return CompanyEngine.stepPlayerCompanyFraction(
      company,
      macro,
      sectorSentiment,
      dayFraction,
      totalElapsedGameMinutes
    );
  }
}
