/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞİRKET OPERASYON AYARLARI: üretim, personel, fiyat ve envanter tasfiyesi
 * (CompanyEngine dosyasından ayrıldı; dış dünya hâlâ CompanyEngine.* üzerinden erişebilir.)
 */

import { CAPEX_UNIT_MULTIPLIER } from '../data/gameBalance';
import {
  SECTOR_CONFIGS,
} from '../data/sectors';
import {
  PlayerCompany,
} from '../models/company';
import {
  SalaryTier,
} from '../models/finance';
import {
  CompanyCapacity,
} from './CompanyCapacity';
import {
  CompanyInvestmentProjects,
} from './CompanyInvestmentProjects';
import { CompanyWallet } from './CompanyWallet';

export class CompanyOperations {
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

    // Tasfiye pazarın dışında, toptan ve zararına yapılır: fiyat üretim maliyetinin altındadır.
    // (Aksi hâlde pazar dolunca fazla üretimi tasfiyeyle satmak sınırsız kâr kapısı olurdu.)
    const cleanDiscount = Math.max(0.1, Math.min(0.6, discountRatio));
    const liquidationPrice = Number(
      (
        Math.min(
          company.financials.unitSellingPrice,
          company.financials.unitProductionCost
        ) *
        (1 - cleanDiscount)
      ).toFixed(2)
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
    CompanyWallet.earn(company, cashProceeds);
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
      CompanyWallet.earn(company, loan);
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
          const prjRes = CompanyInvestmentProjects.startInvestmentProject(company, {
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
            (deltaCap * sectorCfg.unitCapacityCost * CAPEX_UNIT_MULTIPLIER * scaleFactor).toFixed(2)
          );
          if (capexCost > company.financials.cash) {
            return {
              success: false,
              message: `Kapasite yatırımı (CAPEX) için şirket kasasında ₺${capexCost.toLocaleString('tr-TR')} nakit gerekiyor.`,
              capitalSpent: 0,
            };
          }
          CompanyWallet.spend(company, capexCost);
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
        CompanyWallet.spend(company, onboardingFee);
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
      const effectiveCapacity = CompanyCapacity.computeEffectiveCapacity({
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
}
