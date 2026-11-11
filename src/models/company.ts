/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SectorId } from './market';
import {
  CompanyOperationsState,
  DetailedIncomeBreakdown,
  InvestmentProject,
  WorkforcePlan,
} from './finance';

export interface FinancialStatement {
  // Gelir Tablosu (Yıllıklandırılmış / Dönemsel TL)
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  researchAndDevelopment: number;
  personnelExpenses: number;
  depreciation: number;
  EBITDA: number;
  EBIT: number;
  interestExpense: number;
  preTaxIncome: number;
  taxExpense: number;
  netIncome: number;

  // Bilanço — Varlıklar (Assets)
  cash: number;
  inventory: number;
  receivables: number;
  fixedAssets: number;
  totalAssets: number;

  // Bilanço — Yükümlülükler (Liabilities)
  shortTermDebt: number;
  longTermDebt: number;
  totalLiabilities: number;

  // Bilanço — Özkaynaklar (Shareholders' Equity)
  paidInCapital: number;
  retainedEarnings: number;
  shareholdersEquity: number;

  // Pay ve Nakit Akışı Kalemleri
  sharesOutstanding: number;
  dividendPerShare: number;
  dividendPayoutRatio: number;
  capitalExpenditures: number;
  changeInWorkingCapital: number;

  // Operasyonel Kapasite ve Birim Ekonomi
  productionCapacityUnits: number;
  dailyUnitsProduced: number;
  dailyUnitsSold: number;
  inventoryUnits: number;
  unitSellingPrice: number;
  unitProductionCost: number;
  staffCount: number;
}

export interface ValuationBreakdown {
  ebitdaMultipleValue: number;
  peMultipleValue: number;
  bookValue: number;
  dcfValue: number;
  sectorComparableValue: number;
  enterpriseValue: number;
  equityValue: number;
  fairValuePerShare: number;
  methodWeights: {
    ebitda: number;
    pe: number;
    book: number;
    dcf: number;
    sector: number;
  };
}

export interface QuarterlyFinancialReport {
  year: number;
  quarter: number;
  day: number;
  revenue: number;
  EBITDA: number;
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  shareholdersEquity: number;
  freeCashFlow: number;
}

export interface PlayerCompany {
  name: string;
  ticker: string;
  sector: SectorId;
  foundedDay: number;
  operatingDays: number;
  corporateGovernanceScore: number; // 0 - 100 arası kurumsal yönetişim puanı

  // Operasyonel Parametreler
  capitalCash: number;
  staffCount: number;
  productionCapacity: number;
  dailyRdBudget: number;
  dailyMarketingBudget: number;
  techQualityMultiplier: number;
  dailyUnitsProduced: number;
  dailyRevenue: number;
  dailyOpex: number;
  dailyEbitda: number;
  annualizedRevenue: number;
  annualizedEbitda: number;

  // Tam Muhasebe Bilançosu ve Çoklu Değerleme
  financials: FinancialStatement;
  valuation: ValuationBreakdown;
  enterpriseValue: number;
  equityValue: number;

  // Ortaklık ve Halka Arz (IPO) Durumu
  totalShares: number;
  playerOwnedShares: number;
  playerOwnershipPct: number;
  isPubliclyListed: boolean;
  ipoOfferPrice: number | null;
  ipoProceedsRaised: number;
  ipoDay: number | null;

  // Tarihçe
  revenueHistory: number[];
  ebitdaHistory: number[];
  valuationHistory: number[];
  quarterlyReports: QuarterlyFinancialReport[];

  // v5 Genişletilmiş Talep/Stok, Detaylı Gelir/Gider, Yatırım Projeleri, İK ve Kredi Alanları
  operations?: CompanyOperationsState;
  incomeBreakdown?: DetailedIncomeBreakdown;
  investmentProjects?: InvestmentProject[];
  workforcePlan?: WorkforcePlan;
  shareholderLoanBalance?: number;
  supplierPayableBalance?: number;
  unpaidTaxBalance?: number;
  unpaidPayrollBalance?: number;
  creditScore?: number;
  isBankrupt?: boolean;
  defaultedLoanCount?: number;
  cashFlowHistory365?: number[];
}

