/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞİRKET KURULUŞU: v5 alan onarımı, şirket kurma ve sermaye ekleme
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
  EstablishCompanyParams,
} from '../data/companyCatalog';
import {
  CompanyCapacity,
} from './CompanyCapacity';

export class CompanyFounding {
  public static readonly STAGE_2_NET_WORTH_THRESHOLD = 2_000_000;

  public static readonly MIN_FOUNDING_CAPITAL = 250_000;

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
    const migTech = CompanyCapacity.migrateLegacyTechMultiplier(
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
      const clamped = CompanyCapacity.clampMultipliers({
        technologyMultiplier: company.techQualityMultiplier,
        workforceEfficiency: company.workforcePlan.workforceEfficiency,
        machineAvailability: 0.92,
        shiftMultiplier: 1.0,
        productQuality: 55 + (company.techQualityMultiplier - 1) * 28,
        customerSatisfaction: 72,
        distributionCoverage: Math.min(0.95, 0.25 + installedCap / 800),
      });

      const effectiveCap = CompanyCapacity.computeEffectiveCapacity({
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
      company.incomeBreakdown = CompanyCapacity.computeDetailedIncomeBreakdown(
        company,
        macro,
        0,
        0
      );
    }
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

    if (playerNetWorth < CompanyFounding.STAGE_2_NET_WORTH_THRESHOLD) {
      return {
        success: false,
        message: `Aşama 2 şirket kurulumu için gereken minimum Net Varlık: ₺${CompanyFounding.STAGE_2_NET_WORTH_THRESHOLD.toLocaleString('tr-TR')}. Mevcut Net Varlık: ₺${playerNetWorth.toLocaleString('tr-TR')}`,
        newPlayerCash: playerCash,
      };
    }

    const capital = Number(input.initialCapital.toFixed(2));
    if (!Number.isFinite(capital) || capital < CompanyFounding.MIN_FOUNDING_CAPITAL) {
      return {
        success: false,
        message: `Şirket kuruluşu için en az ₺${CompanyFounding.MIN_FOUNDING_CAPITAL.toLocaleString('tr-TR')} başlangıç sermayesi gereklidir.`,
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

    CompanyFounding.ensureCompanyV5Fields(company, macro);
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
}
