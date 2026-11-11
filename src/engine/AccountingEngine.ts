/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 4, 5 & 12: MUHASEBE, TALEP/STOK VE BİLANÇO MOTORU (AccountingEngine)
 * - 16 NPC şirketi ve Oyuncu Şirketi için tam gelir tablosu ve bilanço yönetimi
 * - Muhasebe temel eşitliği: Varlıklar (totalAssets) === Yükümlülükler (totalLiabilities) + Özkaynaklar (shareholdersEquity)
 * - Kurulu ve etkin kapasitenin üzerinde üretim yapılmasını kesin olarak engeller.
 * - Üretilen her ürünün otomatik satılmasını kaldırır; talep, fiyat elastikiyeti ve depo kapasitesi uygular.
 */

import { SECTOR_CONFIGS } from '../data/sectors';
import { FinancialStatement, QuarterlyFinancialReport } from '../models/company';
import { MacroEconomyState } from '../models/economy';
import { SectorId } from '../models/market';
import { AccountingAuditResult, SimulationState } from '../models/simulation';
import { TradeAndShopEngine } from './TradeAndShopEngine';
import { ValuationEngine } from './ValuationEngine';

export class AccountingEngine {
  /**
   * Yeni kurulan veya başlangıçtaki bir NPC / Oyuncu şirketi için muhasebe eşitliğini
   * (%100 Varlıklar = Yükümlülükler + Özkaynaklar) sağlayan tam bilanço ve gelir tablosu üretir.
   */
  public static createInitialFinancialStatement(params: {
    sector: SectorId;
    initialEquityCapital: number;
    debtRatio: number;
    sharesOutstanding: number;
    staffCount: number;
    productionCapacityUnits: number;
    dividendYieldAnnual: number;
    sharePrice: number;
    corporateTaxRate: number;
    policyInterestRate: number;
  }): FinancialStatement {
    const sectorCfg = SECTOR_CONFIGS[params.sector];
    const equity = Number(Math.max(100_000, params.initialEquityCapital).toFixed(2));
    const totalLiabilities = Number((equity * params.debtRatio).toFixed(2));
    const shortTermDebt = Number((totalLiabilities * 0.4).toFixed(2));
    const longTermDebt = Number((totalLiabilities - shortTermDebt).toFixed(2));
    const totalAssets = Number((equity + totalLiabilities).toFixed(2));

    // Varlık dağılımı: Nakit (%22), Stok (%14), Alacaklar (%16), Duran Varlıklar (%48)
    const cash = Number((totalAssets * 0.22).toFixed(2));
    const inventory = Number((totalAssets * 0.14).toFixed(2));
    const receivables = Number((totalAssets * 0.16).toFixed(2));
    const fixedAssets = Number((totalAssets - cash - inventory - receivables).toFixed(2));

    const paidInCapital = Number((equity * 0.75).toFixed(2));
    const retainedEarnings = Number((equity - paidInCapital).toFixed(2));

    // Operasyonel üretim ve satış (kesinlikle kurulu kapasite ile sınırlı!)
    const installedCap = Math.max(5, Math.round(params.productionCapacityUnits));
    const laborCap = Math.max(5, Math.round(params.staffCount * 2.2));
    const dailyUnitsProduced = Math.max(
      1,
      Math.min(installedCap, laborCap, Math.round(installedCap * 0.82))
    );
    const inventoryUnits = Math.max(10, Math.round(dailyUnitsProduced * 4));
    const dailyUnitsSold = Math.max(1, Math.round(dailyUnitsProduced * 0.92));

    const annualizationFactor = 120;
    const annualUnitsSold = dailyUnitsSold * annualizationFactor;
    const revenue = Number((annualUnitsSold * sectorCfg.unitPrice).toFixed(2));
    const costOfGoodsSold = Number((annualUnitsSold * sectorCfg.unitCost).toFixed(2));
    const grossProfit = Number((revenue - costOfGoodsSold).toFixed(2));

    const personnelExpenses = Number(
      (params.staffCount * sectorCfg.dailyStaffWage * 0.048 * annualizationFactor).toFixed(2)
    );
    const researchAndDevelopment = Number((revenue * 0.05).toFixed(2));
    const operatingExpenses = Number((revenue * 0.08).toFixed(2));

    const EBITDA = Number(
      (grossProfit - operatingExpenses - personnelExpenses - researchAndDevelopment).toFixed(2)
    );
    const depreciation = Number((fixedAssets * 0.08).toFixed(2));
    const EBIT = Number((EBITDA - depreciation).toFixed(2));
    const interestExpense = Number(
      (totalLiabilities * Math.max(0.08, params.policyInterestRate * 0.55)).toFixed(2)
    );
    const preTaxIncome = Number((EBIT - interestExpense).toFixed(2));
    const taxExpense =
      preTaxIncome > 0
        ? Number((preTaxIncome * params.corporateTaxRate).toFixed(2))
        : 0;
    const netIncome = Number((preTaxIncome - taxExpense).toFixed(2));

    const dividendPerShare = Number(
      (params.sharePrice * params.dividendYieldAnnual).toFixed(4)
    );
    const dividendPayoutRatio =
      netIncome > 0
        ? Number(
            Math.min(0.8, (dividendPerShare * params.sharesOutstanding) / netIncome).toFixed(4)
          )
        : 0;

    return {
      revenue,
      costOfGoodsSold,
      grossProfit,
      operatingExpenses,
      researchAndDevelopment,
      personnelExpenses,
      depreciation,
      EBITDA,
      EBIT,
      interestExpense,
      preTaxIncome,
      taxExpense,
      netIncome,
      cash,
      inventory,
      receivables,
      fixedAssets,
      totalAssets,
      shortTermDebt,
      longTermDebt,
      totalLiabilities,
      paidInCapital,
      retainedEarnings,
      shareholdersEquity: equity,
      sharesOutstanding: params.sharesOutstanding,
      dividendPerShare,
      dividendPayoutRatio,
      capitalExpenditures: Number((depreciation * 1.1).toFixed(2)),
      changeInWorkingCapital: Number((revenue * 0.012).toFixed(2)),
      productionCapacityUnits: installedCap,
      dailyUnitsProduced,
      dailyUnitsSold,
      inventoryUnits,
      unitSellingPrice: sectorCfg.unitPrice,
      unitProductionCost: sectorCfg.unitCost,
      staffCount: params.staffCount,
    };
  }

  /**
   * Bir NPC şirketinin günlük operasyonlarını çalıştırır, stok-kapasite-talep dengesini kurar
   * ve muhasebe eşitliğini (Varlıklar = Yükümlülükler + Özkaynaklar) kesin olarak korur.
   */
  public static stepCompanyFinancialsOneDay(
    fin: FinancialStatement,
    sector: SectorId,
    macro: MacroEconomyState,
    sentimentScore: number,
    techQualityMultiplier: number = 1.0,
    customDailyRd?: number,
    customDailyMarketing: number = 0
  ): FinancialStatement {
    const sectorCfg = SECTOR_CONFIGS[sector];
    const safeTech = ValuationEngine.clampTechMultiplier(techQualityMultiplier);

    // 1. Günlük Üretim (Kesinlikle kurulu kapasiteyi ve depo boş alanını aşamaz!)
    const installedCapacity = Math.max(1, Math.round(fin.productionCapacityUnits));
    const effectiveCapacity = Math.max(
      1,
      Math.min(
        installedCapacity,
        Math.round(installedCapacity * Math.min(1.0, 0.72 + (safeTech - 1) * 0.22))
      )
    );
    const laborCapacity = Math.max(
      1,
      Math.round(fin.staffCount * 2.4 * Math.min(1.15, 0.8 + (safeTech - 1) * 0.15))
    );
    const maxStorageUnits = Math.max(50, installedCapacity * 18);
    const freeStorageSpace = Math.max(0, maxStorageUnits - fin.inventoryUnits);

    const dailyUnitsProduced = Math.max(
      0,
      Math.min(installedCapacity, effectiveCapacity, laborCapacity, freeStorageSpace)
    );

    // 2. Bağımsız Pazar Talebi ve Fiyat Elastikiyeti (Üretilen her ürün otomatik satılmaz!)
    const competitorAvgPrice = sectorCfg.unitPrice;
    const unitSellingPrice =
      fin.unitSellingPrice > 0
        ? fin.unitSellingPrice
        : Number((sectorCfg.unitPrice * (1 + (safeTech - 1) * 0.08)).toFixed(2));
    const priceRatio = unitSellingPrice / Math.max(1, competitorAvgPrice);
    const qualityJustification = 1 + (safeTech - 1) * 0.12;
    const priceElasticityFactor =
      priceRatio <= qualityJustification
        ? Math.min(1.15, 1 + (qualityJustification - priceRatio) * 0.4)
        : Math.max(0.05, Math.pow(qualityJustification / priceRatio, 2.4));

    const macroDemandFactor = Math.max(
      0.55,
      Math.min(
        1.25,
        0.92 +
          sentimentScore * 1.5 +
          (macro.gdpGrowthRate - 0.03) * 1.2 +
          (macro.marketRiskAppetite - 0.5) * 0.15
      )
    );

    const baseMarketDemandForCompany = Math.round(
      installedCapacity * 0.84 * macroDemandFactor * priceElasticityFactor
    );
    const availableUnitsToSell = Math.max(0, fin.inventoryUnits + dailyUnitsProduced);
    const dailyUnitsSold = Math.max(
      0,
      Math.min(availableUnitsToSell, baseMarketDemandForCompany)
    );

    const rawRemainingInventory = Math.max(0, availableUnitsToSell - dailyUnitsSold);
    const obsoleteUnits =
      rawRemainingInventory > installedCapacity * 6
        ? Math.floor(rawRemainingInventory * 0.01)
        : 0;
    const newInventoryUnits = Math.max(0, rawRemainingInventory - obsoleteUnits);

    // 3. Birim Maliyet ve Gerçekçi Gelir/Gider Hesabı
    const unitProductionCost = sectorCfg.unitCost;
    const unitStorageCost = Number((unitProductionCost * 0.015).toFixed(2));
    const unitLogisticsCost = Number((unitProductionCost * 0.04).toFixed(2));

    const dailyRevenue = dailyUnitsSold * unitSellingPrice;
    const dailyCogs =
      dailyUnitsSold * (unitProductionCost + unitLogisticsCost) +
      obsoleteUnits * unitProductionCost;
    const dailyGrossProfit = dailyRevenue - dailyCogs;

    const dailyPersonnel = fin.staffCount * (sectorCfg.dailyStaffWage * 0.048);
    const dailyStorageExpense = newInventoryUnits * unitStorageCost;
    const dailyRd =
      typeof customDailyRd === 'number'
        ? Math.min(customDailyRd * 0.12, Math.max(customDailyRd * 0.05, dailyRevenue * 0.14))
        : dailyRevenue * 0.045;
    const dailyOpex =
      dailyRevenue * 0.05 +
      installedCapacity * 1.5 +
      dailyStorageExpense +
      customDailyMarketing * 0.25;

    const dailyEbitda = dailyGrossProfit - dailyOpex - dailyPersonnel - dailyRd;
    const dailyDepreciation = (fin.fixedAssets * 0.08) / 252;
    const dailyEbit = dailyEbitda - dailyDepreciation;

    const effectiveInterestRate = Math.max(0.1, macro.policyInterestRate * 0.6);
    const dailyInterest = (fin.totalLiabilities * effectiveInterestRate) / 252;
    const dailyPreTax = dailyEbit - dailyInterest;
    const dailyTax = dailyPreTax > 0 ? dailyPreTax * macro.corporateTaxRate : 0;
    const dailyNetIncome = dailyPreTax - dailyTax;

    // 4. Bilanço Güncellemesi (Çift Kayıt Muhasebe Kuralı)
    const oldInventoryValue = fin.inventory;
    const newInventoryValue = Number((newInventoryUnits * unitProductionCost).toFixed(2));
    const inventoryDelta = newInventoryValue - oldInventoryValue;

    const newFixedAssets = Number(
      Math.max(25_000, fin.fixedAssets - dailyDepreciation).toFixed(2)
    );
    const fixedAssetsDelta = newFixedAssets - fin.fixedAssets;

    const targetReceivables = Number((dailyRevenue * 10).toFixed(2));
    const receivablesDelta = (targetReceivables - fin.receivables) * 0.15;
    const newReceivables = Number(Math.max(0, fin.receivables + receivablesDelta).toFixed(2));
    const actualReceivablesDelta = newReceivables - fin.receivables;

    const cashDelta =
      dailyNetIncome - inventoryDelta - actualReceivablesDelta - fixedAssetsDelta;

    let newCash = Number((fin.cash + cashDelta).toFixed(2));
    let newShortTermDebt = fin.shortTermDebt;

    // Negatif nakit koruması: kasa sıfırın altına inerse ödenemeyen gider kısa vadeli ticari borca (shortTermDebt) yazılır
    if (newCash < 0) {
      const unpaidShortfall = Number((-newCash).toFixed(2));
      newCash = 0;
      newShortTermDebt = Number((newShortTermDebt + unpaidShortfall).toFixed(2));
    }

    const newTotalLiabilities = Number((newShortTermDebt + fin.longTermDebt).toFixed(2));
    const newTotalAssets = Number(
      (newCash + newInventoryValue + newReceivables + newFixedAssets).toFixed(2)
    );
    const newShareholdersEquity = Number((newTotalAssets - newTotalLiabilities).toFixed(2));
    const newRetainedEarnings = Number(
      (newShareholdersEquity - fin.paidInCapital).toFixed(2)
    );

    const annualizationFactor = 120;
    const revenue = Number((dailyRevenue * annualizationFactor).toFixed(2));
    const costOfGoodsSold = Number((dailyCogs * annualizationFactor).toFixed(2));
    const grossProfit = Number((revenue - costOfGoodsSold).toFixed(2));
    const operatingExpenses = Number((dailyOpex * annualizationFactor).toFixed(2));
    const researchAndDevelopment = Number((dailyRd * annualizationFactor).toFixed(2));
    const personnelExpenses = Number((dailyPersonnel * annualizationFactor).toFixed(2));
    const EBITDA = Number(
      (grossProfit - operatingExpenses - personnelExpenses - researchAndDevelopment).toFixed(2)
    );
    const depreciation = Number((dailyDepreciation * annualizationFactor).toFixed(2));
    const EBIT = Number((EBITDA - depreciation).toFixed(2));
    const interestExpense = Number((dailyInterest * annualizationFactor).toFixed(2));
    const preTaxIncome = Number((EBIT - interestExpense).toFixed(2));
    const taxExpense =
      preTaxIncome > 0 ? Number((preTaxIncome * macro.corporateTaxRate).toFixed(2)) : 0;
    const netIncome = Number((preTaxIncome - taxExpense).toFixed(2));

    return {
      ...fin,
      revenue,
      costOfGoodsSold,
      grossProfit,
      operatingExpenses,
      researchAndDevelopment,
      personnelExpenses,
      depreciation,
      EBITDA,
      EBIT,
      interestExpense,
      preTaxIncome,
      taxExpense,
      netIncome,
      cash: newCash,
      inventory: newInventoryValue,
      receivables: newReceivables,
      fixedAssets: newFixedAssets,
      totalAssets: newTotalAssets,
      shortTermDebt: newShortTermDebt,
      totalLiabilities: newTotalLiabilities,
      retainedEarnings: newRetainedEarnings,
      shareholdersEquity: newShareholdersEquity,
      dailyUnitsProduced,
      dailyUnitsSold,
      inventoryUnits: newInventoryUnits,
      unitSellingPrice,
      unitProductionCost,
      capitalExpenditures: Number((depreciation * 1.05).toFixed(2)),
      changeInWorkingCapital: Number(((inventoryDelta + actualReceivablesDelta) * 30).toFixed(2)),
    };
  }

  public static createQuarterlyReport(
    fin: FinancialStatement,
    day: number,
    taxRate: number
  ): QuarterlyFinancialReport {
    const year = Math.floor((day - 1) / 252) + 1;
    const quarter = (Math.floor((day - 1) / 63) % 4) + 1;
    const fcff = Number(
      (
        fin.EBIT * (1 - taxRate) +
        fin.depreciation -
        fin.capitalExpenditures -
        fin.changeInWorkingCapital
      ).toFixed(2)
    );
    return {
      year,
      quarter,
      day,
      revenue: fin.revenue,
      EBITDA: fin.EBITDA,
      netIncome: fin.netIncome,
      totalAssets: fin.totalAssets,
      totalLiabilities: fin.totalLiabilities,
      shareholdersEquity: fin.shareholdersEquity,
      freeCashFlow: fcff,
    };
  }

  /**
   * Muhasebe Eşitliği ve Oyuncu Net Varlık Denklemi Bütünlük Denetimi:
   * 1. toplamNetVarlik = nakit + portföyPiyasaDegeri + oyuncuSirketDegeri + temettuAlacagi - borclar
   * 2. Her şirket için: totalAssets === totalLiabilities + shareholdersEquity (tolerans <= 0.5 TL)
   * 3. Hiçbir fiyat negatif, NaN veya Infinity olamaz.
   */
  public static auditSimulationIntegrity(state: SimulationState): AccountingAuditResult {
    const errors: string[] = [];

    const nonIncorporatedShopEquity =
      TradeAndShopEngine.computeNonIncorporatedShopsEquity(state);
    const expectedPrivateCompanyEquity = Number(
      (
        (state.playerCompany && !state.playerCompany.isPubliclyListed
          ? state.playerCompany.equityValue
          : 0) + nonIncorporatedShopEquity
      ).toFixed(2)
    );

    const expectedPortfolioValue = state.stocks.reduce((sum, stock) => {
      const pos = state.portfolio[stock.ticker];
      return sum + (pos && pos.shares > 0 ? pos.shares * stock.price : 0);
    }, 0);

    const expectedNetWorth = Number(
      (
        state.cash +
        (state.holdingCash ?? 0) +
        expectedPortfolioValue +
        expectedPrivateCompanyEquity +
        state.accruedDividendsReceivable -
        state.totalDebt
      ).toFixed(2)
    );

    const netWorthDiff = Math.abs(state.netWorth - expectedNetWorth);
    const playerNetWorthEquationValid = netWorthDiff <= 1.0;
    if (!playerNetWorthEquationValid) {
      errors.push(
        `Net Varlık Denklemi Hatası: Mevcut=${state.netWorth}, Beklenen=${expectedNetWorth}`
      );
    }

    let companyBalanceSheetsValid = true;
    for (const stock of state.stocks) {
      const f = stock.financials;
      const lhs = f.totalAssets;
      const rhs = f.totalLiabilities + f.shareholdersEquity;
      if (Math.abs(lhs - rhs) > 0.5 || Number.isNaN(lhs) || Number.isNaN(rhs)) {
        companyBalanceSheetsValid = false;
        errors.push(
          `${stock.ticker} bilanço eşitliği bozuldu: Varlıklar=${lhs}, Yükümlülük+Özkaynak=${rhs}`
        );
      }
    }

    if (state.playerCompany) {
      const f = state.playerCompany.financials;
      const lhs = f.totalAssets;
      const rhs = f.totalLiabilities + f.shareholdersEquity;
      if (Math.abs(lhs - rhs) > 0.5 || Number.isNaN(lhs) || Number.isNaN(rhs)) {
        companyBalanceSheetsValid = false;
        errors.push(
          `Oyuncu Şirketi (${state.playerCompany.ticker}) bilanço eşitliği bozuldu: Varlıklar=${lhs}, Yükümlülük+Özkaynak=${rhs}`
        );
      }
    }

    let pricesValid = true;
    for (const stock of state.stocks) {
      if (
        !Number.isFinite(stock.price) ||
        stock.price <= 0 ||
        Number.isNaN(stock.price)
      ) {
        pricesValid = false;
        errors.push(`${stock.ticker} geçersiz fiyat: ${stock.price}`);
      }
    }

    return {
      valid: playerNetWorthEquationValid && companyBalanceSheetsValid && pricesValid,
      checkedDay: state.day,
      playerNetWorthEquationValid,
      companyBalanceSheetsValid,
      pricesValid,
      errors,
    };
  }
}
