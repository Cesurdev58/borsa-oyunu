/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞİRKETLEŞME: uygunluk kontrolü ve dükkânları şirkete dönüştürme
 * (TradeAndShopEngine dosyasından ayrıldı; dış dünya hâlâ TradeAndShopEngine.* üzerinden erişebilir.)
 */

import {
  PlayerCompany,
} from '../models/company';
import {
  SectorId,
} from '../models/market';
import {
  SimulationStage,
  SimulationState,
} from '../models/simulation';
import {
  IncorporationEligibilityResult,
} from '../models/trade';
import {
  AccountingEngine,
} from './AccountingEngine';
import {
  WalletEngine,
} from './WalletEngine';
import {
  ShopEquity,
} from './ShopEquity';
import {
  CompanyEngine,
} from './CompanyEngine';
import {
  ValuationEngine,
} from './ValuationEngine';

import {
  TradeUniverse,
} from './TradeUniverse';

export class ShopIncorporation {
  // Şirketleşme (Esnaftan Kurumsal Şirkete Geçiş) Eşik Değerleri
  public static readonly MIN_BRANCHES_FOR_INCORPORATION = 2;

  public static readonly MIN_STAFF_FOR_INCORPORATION = 10;

  public static readonly MIN_BUSINESS_VALUE_FOR_INCORPORATION = 350_000;

  public static readonly MIN_REPUTATION_FOR_INCORPORATION = 60;

  /**
   * Esnaftan Kurumsal Şirkete Geçiş Koşullarını Denetler (Bölüm 4):
   * - En az 2 aktif şube
   * - Son 30 oyun gününde pozitif faaliyet kârı
   * - En az 10 çalışan
   * - Yeterli işletme değeri (>= 350.000 TL)
   * - Vadesi geçmiş borç bulunmaması
   * - Yeterli ticari itibar (>= 60)
   */
  public static checkIncorporationEligibility(
    state: SimulationState
  ): IncorporationEligibilityResult {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const alreadyIncorporated = state.playerCompany !== null;
    const activeShopBranchesCount = ts.shops.length;
    const totalShopStaffCount = ts.shops.reduce(
      (sum, s) => sum + s.staffCount,
      0
    );

    const last30DaysOperatingProfit = Number(
      ts.shops
        .reduce((sum, s) => {
          const histSum = s.dailyProfitHistory30.reduce((a, b) => a + b, 0);
          return sum + (s.dailyProfitHistory30.length > 0 ? histSum : s.cumulativeNetProfit);
        }, 0)
        .toFixed(2)
    );

    const shopsEquity = ShopEquity.compute(state);
    const totalBusinessValue = Number(
      (
        shopsEquity +
        (state.playerCompany?.equityValue ?? 0)
      ).toFixed(2)
    );

    const hasOverdueLoan = (state.activeLoans ?? []).some(
      (l) => l.status === 'DELINQUENT' || l.status === 'DEFAULTED'
    );
    const hasOverdueInvoice = ts.invoices.some(
      (inv) => inv.direction === 'PAYABLE' && inv.status === 'OVERDUE'
    );
    const hasOverdueDebt = hasOverdueLoan || hasOverdueInvoice;

    const reasons: string[] = [];
    if (alreadyIncorporated) {
      reasons.push('İşletmeniz zaten kurumsal anonim şirkete dönüştürülmüş durumda.');
    }
    if (activeShopBranchesCount < ShopIncorporation.MIN_BRANCHES_FOR_INCORPORATION) {
      reasons.push(
        `En az ${ShopIncorporation.MIN_BRANCHES_FOR_INCORPORATION} aktif dükkân/şube gereklidir (Mevcut: ${activeShopBranchesCount}).`
      );
    }
    if (last30DaysOperatingProfit <= 0) {
      reasons.push(
        `Son 30 oyun gününde pozitif faaliyet kârı gereklidir (Mevcut: ₺${last30DaysOperatingProfit.toLocaleString('tr-TR')}).`
      );
    }
    if (totalShopStaffCount < ShopIncorporation.MIN_STAFF_FOR_INCORPORATION) {
      reasons.push(
        `Toplam en az ${ShopIncorporation.MIN_STAFF_FOR_INCORPORATION} çalışan gereklidir (Mevcut: ${totalShopStaffCount}).`
      );
    }
    if (totalBusinessValue < ShopIncorporation.MIN_BUSINESS_VALUE_FOR_INCORPORATION) {
      reasons.push(
        `Toplam işletme değeri en az ₺${ShopIncorporation.MIN_BUSINESS_VALUE_FOR_INCORPORATION.toLocaleString('tr-TR')} olmalıdır (Mevcut: ₺${totalBusinessValue.toLocaleString('tr-TR')}).`
      );
    }
    if (hasOverdueDebt) {
      reasons.push(
        'Vadesi geçmiş kredi taksiti veya gecikmiş tedarikçi faturası bulunmamalıdır.'
      );
    }
    if (ts.tradeReputationScore < ShopIncorporation.MIN_REPUTATION_FOR_INCORPORATION) {
      reasons.push(
        `Ticari itibar puanı en az ${ShopIncorporation.MIN_REPUTATION_FOR_INCORPORATION} olmalıdır (Mevcut: ${ts.tradeReputationScore}).`
      );
    }

    return {
      eligible: !alreadyIncorporated && reasons.length === 0,
      alreadyIncorporated,
      activeShopBranchesCount,
      minBranchesRequired: ShopIncorporation.MIN_BRANCHES_FOR_INCORPORATION,
      last30DaysOperatingProfit,
      totalShopStaffCount,
      minStaffRequired: ShopIncorporation.MIN_STAFF_FOR_INCORPORATION,
      totalBusinessValue,
      minBusinessValueRequired:
        ShopIncorporation.MIN_BUSINESS_VALUE_FOR_INCORPORATION,
      hasOverdueDebt,
      tradeReputationScore: ts.tradeReputationScore,
      minReputationRequired:
        ShopIncorporation.MIN_REPUTATION_FOR_INCORPORATION,
      reasons,
    };
  }

  /**
   * Esnaf İşletmelerini Kurumsal Anonim Şirkete Dönüştürür (`incorporateShopsIntoCompany`):
   * - Mevcut dükkânları, stokları, siparişleri, çalışanları ve satış geçmişini SİLMEZ!
   * - Mevcut dükkânları yeni kurulan şirketin şubelerine (`isCompanyBranch = true`) dönüştürür.
   * - Şirket hazinesi, merkezi muhasebe, kurumsal kredi, merkezi depo, fabrika ve halka arz hazırlığını açar.
   */
  public static incorporateShopsIntoCompany(
    state: SimulationState,
    params: {
      companyName: string;
      ticker: string;
      sector: SectorId;
      additionalCashFromPlayer?: number;
      reservedOrderCash: number;
    }
  ): {
    success: boolean;
    message: string;
    company?: PlayerCompany;
  } {
    const eligibility = ShopIncorporation.checkIncorporationEligibility(state);
    if (!eligibility.eligible) {
      return {
        success: false,
        message: `Şirketleşme koşulları henüz tamamlanmadı: ${eligibility.reasons.join(' ')}`,
      };
    }

    const ts = state.tradeState!;
    const spendablePlayerCash = Math.max(
      0,
      state.cash - params.reservedOrderCash
    );
    const additionalCash = Number(
      Math.min(
        spendablePlayerCash,
        Math.max(0, params.additionalCashFromPlayer ?? 0)
      ).toFixed(2)
    );

    // Mevcut esnaf dükkânlarının nakit, stok ve sabit yatırım değerlerini topla
    let shopsCashTotal = 0;
    let shopsFixedTotal = 0;
    let shopsInventoryValue = 0;
    let shopsInventoryUnits = 0;
    let totalStaff = 0;

    for (const shop of ts.shops) {
      shopsCashTotal += shop.cashAccountBalance;
      shopsFixedTotal += shop.totalInvestedCapital;
      for (const b of shop.inventoryBatches) {
        shopsInventoryValue += b.quantity * b.unitCost;
        shopsInventoryUnits += b.quantity;
      }
      totalStaff += shop.staffCount;
    }

    for (const wh of ts.warehouses) {
      for (const b of wh.batches) {
        shopsInventoryValue += b.quantity * b.unitCost;
        shopsInventoryUnits += b.quantity;
      }
    }

    for (const v of ts.vehicles) {
      shopsFixedTotal += v.purchaseCost;
    }

    // Yoldaki peşin ödenmiş siparişler
    let inTransitPrepaid = 0;
    for (const ord of ts.procurementOrders) {
      if (
        ord.status === 'IN_TRANSIT' ||
        ord.status === 'PREPARING' ||
        ord.status === 'DELAYED' ||
        ord.status === 'APPROVED'
      ) {
        inTransitPrepaid += ord.paidAmount;
      }
    }

    const totalCapital = Number(
      (
        shopsCashTotal +
        shopsFixedTotal +
        shopsInventoryValue +
        inTransitPrepaid +
        additionalCash
      ).toFixed(2)
    );

    const cleanName =
      params.companyName.trim() || 'Anadolu Ticaret ve Perakende A.Ş.';
    let cleanTicker = params.ticker
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 5);
    if (!cleanTicker) cleanTicker = 'ATPR';
    if (state.stocks.some((s) => s.ticker === cleanTicker)) {
      cleanTicker = `${cleanTicker.slice(0, 3)}A`;
    }

    if (additionalCash > 0) {
      WalletEngine.spend(state, additionalCash);
    }

    // Tüm dükkânları kurumsal şubeye dönüştür (hiçbir dükkân, stok veya geçmiş silinmez!)
    for (const shop of ts.shops) {
      shop.isCompanyBranch = true;
      shop.cashAccountBalance = 0; // Şube nakitleri şirket ana hazinesinde birleştirildi
    }

    const totalShares = 100_000;
    const productionCapacity = Math.max(25, ts.shops.length * 15);
    const financials = AccountingEngine.createInitialFinancialStatement({
      sector: params.sector,
      initialEquityCapital: totalCapital,
      debtRatio: 0,
      sharesOutstanding: totalShares,
      staffCount: Math.max(10, totalStaff),
      productionCapacityUnits: productionCapacity,
      dividendYieldAnnual: 0,
      sharePrice: totalCapital / totalShares,
      corporateTaxRate: state.macro.corporateTaxRate,
      policyInterestRate: state.macro.policyInterestRate,
    });

    financials.cash = Number((shopsCashTotal + additionalCash).toFixed(2));
    financials.inventory = Number(
      (shopsInventoryValue + inTransitPrepaid).toFixed(2)
    );
    financials.inventoryUnits = Math.max(10, shopsInventoryUnits);
    financials.receivables = 0;
    financials.fixedAssets = Number(Math.max(25_000, shopsFixedTotal).toFixed(2));
    financials.totalAssets = Number(
      (
        financials.cash +
        financials.inventory +
        financials.receivables +
        financials.fixedAssets
      ).toFixed(2)
    );
    financials.shortTermDebt = 0;
    financials.longTermDebt = 0;
    financials.totalLiabilities = 0;
    financials.paidInCapital = financials.totalAssets;
    financials.retainedEarnings = 0;
    financials.shareholdersEquity = financials.totalAssets;

    const valuation = ValuationEngine.computeCompanyValuation(
      financials,
      params.sector,
      state.macro,
      1.0
    );

    const company: PlayerCompany = {
      name: cleanName,
      ticker: cleanTicker,
      sector: params.sector,
      foundedDay: state.day,
      operatingDays: Math.max(
        1,
        state.day - (ts.shops[0]?.openedDay ?? state.day)
      ),
      corporateGovernanceScore: Math.max(74, ts.tradeReputationScore),
      capitalCash: financials.cash,
      staffCount: Math.max(10, totalStaff),
      productionCapacity,
      dailyRdBudget: 5_000,
      dailyMarketingBudget: 3_500,
      techQualityMultiplier: 1.02,
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
        equityValue: financials.shareholdersEquity,
        enterpriseValue: Number(
          (financials.shareholdersEquity - financials.cash).toFixed(2)
        ),
        fairValuePerShare: Number(
          (financials.shareholdersEquity / totalShares).toFixed(2)
        ),
      },
      enterpriseValue: financials.shareholdersEquity,
      equityValue: financials.shareholdersEquity,
      totalShares,
      playerOwnedShares: totalShares,
      playerOwnershipPct: 100,
      isPubliclyListed: false,
      ipoOfferPrice: null,
      ipoProceedsRaised: 0,
      ipoDay: null,
      revenueHistory: [financials.revenue],
      ebitdaHistory: [financials.EBITDA],
      valuationHistory: [financials.shareholdersEquity],
      quarterlyReports: [
        AccountingEngine.createQuarterlyReport(
          financials,
          state.day,
          state.macro.corporateTaxRate
        ),
      ],
    };

    CompanyEngine.ensureCompanyV5Fields(company, state.macro);
    company.equityValue = financials.shareholdersEquity;
    company.enterpriseValue = financials.shareholdersEquity;
    company.valuation.equityValue = financials.shareholdersEquity;

    state.playerCompany = company;
    state.stageUnlocks.stage2Entrepreneur = true;
    if (state.stage === SimulationStage.STAGE_1_RETAIL_INVESTOR) {
      state.stage = SimulationStage.STAGE_2_ENTREPRENEUR;
    }

    // Satış kanallarını aç
    for (const ch of ts.salesChannels) {
      if (
        ch.channelType === 'REGIONAL_DISTRIBUTOR' ||
        ch.channelType === 'CORPORATE_CONTRACT'
      ) {
        ch.isUnlocked = true;
      }
    }

    TradeUniverse.updateCareerStage(state);

    return {
      success: true,
      message: `Tebrikler! ${ts.shops.length} şubeli esnaf işletmeniz "${cleanName} (${cleanTicker})" adıyla kurumsal anonim şirkete dönüştürüldü. Tüm dükkânlarınız, stoklarınız ve çalışanlarınız korundu; Merkezi Depo, Fabrika ve Kurumsal Sözleşmeler açıldı!`,
      company,
    };
  }

  // ============================================================================
  // 12. GÜNLÜK TİCARET, DÜKKÂN SATIŞ, SÖZLEŞME VE FATURA DÖNGÜSÜ (`stepDailyTradeAndShops`)
  // ============================================================================
}
