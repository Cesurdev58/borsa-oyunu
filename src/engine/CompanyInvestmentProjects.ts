/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * YATIRIM PROJELERİ: teklif, başlatma, iptal ve günlük ilerleme
 * (CompanyEngine dosyasından ayrıldı; dış dünya hâlâ CompanyEngine.* üzerinden erişebilir.)
 */

import {
  SECTOR_CONFIGS,
} from '../data/sectors';
import {
  PlayerCompany,
} from '../models/company';
import {
  InvestmentPackageType,
  InvestmentProject,
} from '../models/finance';
import {
  INVESTMENT_PACKAGE_CATALOG,
} from '../data/companyCatalog';

export class CompanyInvestmentProjects {
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
    const quote = CompanyInvestmentProjects.computeInvestmentProjectQuote(
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
}
