/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 2–7: MERKEZİ MUHASEBE, PARA AKTARIMI, TALEP/STOK, YATIRIM VE BANKA/KREDİ MODELLERİ
 */

export type AccountType =
  | 'PLAYER_PERSONAL_CASH' // 1. Oyuncu kişisel nakit hesabı
  | 'PLAYER_INVESTMENT_CASH' // 2. Oyuncu yatırım hesabı
  | 'COMPANY_BANK' // 3. Her şirket için ayrı şirket banka hesabı
  | 'COMPANY_TREASURY' // 4. Her şirket için işletme kasası
  | 'HOLDING_MAIN' // 5. Holding ana hesabı
  | 'LOAN_LIABILITY' // 6. Kredi borç hesabı
  | 'INTEREST_EXPENSE' // 7. Faiz gideri hesabı
  | 'TAX_LIABILITY' // 8. Vergi borcu hesabı
  | 'SUPPLIER_PAYABLE' // 9. Tedarikçi borcu hesabı
  | 'PAYROLL_EXPENSE' // 10. Personel ve maaş gideri hesabı
  | 'INVENTORY_ASSET' // 11. Stok varlık hesabı
  | 'FIXED_ASSET' // 12. Sabit kıymet hesabı
  | 'EQUITY_CAPITAL' // 13. Sermaye hesabı
  | 'DIVIDEND_PAYABLE' // 14. Temettü borcu hesabı
  | 'OPERATING_REVENUE' // Faaliyet geliri karşı hesabı
  | 'OPERATING_EXPENSE'; // Faaliyet gideri karşı hesabı

export type AccountOwnerType =
  | 'PLAYER'
  | 'COMPANY'
  | 'HOLDING'
  | 'BANK'
  | 'STATE'
  | 'SYSTEM';

export type AccountId = string;
export type LedgerAccountId = string;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  ownerType: AccountOwnerType;
  ownerId: string;
  balance: number;
  reservedBalance: number;
  currency: 'TRY';
  createdAtDay: number;
  updatedAtDay: number;
}

export type TransactionCategory =
  | 'PERSONAL_TO_INVESTMENT' // 1. Kişisel hesaptan yatırım hesabına para aktarma
  | 'INVESTMENT_TO_PERSONAL' // 2. Yatırım hesabından kişisel hesaba para aktarma
  | 'CAPITAL_INJECTION' // 3. Oyuncunun şirkete sermaye koyması
  | 'CAPITAL_INCREASE' // Sermaye artırımı eş anlamlısı
  | 'SHAREHOLDER_LOAN_GIVE' // 4. Oyuncunun şirkete ortak borcu vermesi
  | 'SHAREHOLDER_LOAN_REPAY' // 5. Şirketin ortak borcunu oyuncuya geri ödemesi
  | 'LEGAL_DIVIDEND' // 6. Şirketin yasal temettü dağıtması
  | 'HOLDING_CAPITAL_TRANSFER' // 7. Holdingin bağlı şirkete sermaye aktarması
  | 'HOLDING_INTRAGROUP_LOAN' // 8. Holdingin bağlı şirkete grup içi borç vermesi
  | 'INTERCOMPANY_TRADE' // 9. Şirketler arası gerçek ticari ödeme
  | 'LOAN_DISBURSEMENT' // 10. Kredi tutarının ilgili hesaba yatırılması
  | 'LOAN_INSTALLMENT_PAYMENT' // 11. Kredi taksitinin ödenmesi
  | 'LOAN_EARLY_PAYOFF' // Erken kredi kapatma
  | 'TAX_PAYMENT' // 12. Vergi ödemesi
  | 'SUPPLIER_PAYMENT' // 13. Tedarikçi ödemesi
  | 'PAYROLL_PAYMENT' // 14. Maaş ödemesi
  | 'EXECUTIVE_SALARY' // Şirketten oyuncuya yönetici maaşı
  | 'BOARD_FEE' // Şirketten oyuncuya yönetim kurulu huzur hakkı
  | 'CAPITAL_REDUCTION' // Yasal sermaye azaltımı
  | 'STOCK_SALE_PROCEEDS' // Hisse satışı nakit girişi
  | 'STOCK_PURCHASE_COST' // Hisse alımı nakit çıkışı
  | 'CAPEX_INVESTMENT' // Kapasite / fabrika yatırım ödemesi
  | 'OPERATING_REVENUE_RECEIPT' // Satış geliri tahsilatı
  | 'OPERATING_EXPENSE_PAYMENT' // Operasyonel gider ödemesi
  | 'UNAUTHORIZED_COMPANY_WITHDRAWAL'; // Engellenen izinsiz çekim girişimi

export type LedgerTransactionCategory = TransactionCategory;

export type TransactionStatus = 'COMPLETED' | 'REJECTED' | 'FAILED';

export interface TransactionParty {
  accountId: string;
  ownerType: AccountOwnerType;
  ownerId: string;
  name: string;
}

export interface LedgerEntry {
  entryId: string;
  transactionId: string;
  accountId: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  gameDay: number;
  gameMinute: number;
}

export interface MoneyTransfer {
  transactionId: string;
  idempotencyKey: string;
  gameDay: number;
  gameMinute: number;
  createdAtISO: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: 'TRY';
  category: TransactionCategory;
  description: string;
  relatedCompanyId?: string;
  relatedLoanId?: string;
  relatedContractId?: string;
  status: TransactionStatus;
  failureReason?: string;
  taxEffect: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface LedgerTransaction extends MoneyTransfer {
  entries: LedgerEntry[];
}

export interface FinancialPeriod {
  periodId: string;
  year: number;
  quarter: number;
  startDay: number;
  endDay: number;
  isClosed: boolean;
}

export interface BalanceSnapshot {
  snapshotId: string;
  gameDay: number;
  gameMinute: number;
  accountBalances: Record<string, number>;
  totalMoneySupply: number;
  totalPlayerCash: number;
  totalCompanyCash: number;
  totalLoanPrincipal: number;
}

export interface FinancialIntegrityAuditReport {
  valid: boolean;
  checkedDay: number;
  checkedMinute: number;
  negativeAccounts: string[];
  unauthorizedTransfers: string[];
  duplicateTransactionIds: string[];
  duplicateIdempotencyAttempts: number;
  ledgerBalanceMismatches: string[];
  unbackedDebtErrors: string[];
  unbackedLoanErrors: string[];
  duplicateDividends: string[];
  duplicateDailyInterest: string[];
  unexplainedCompanyWithdrawals: string[];
  reservedCashViolations: string[];
  totalMoneySupply: number;
  errors: string[];
}

export interface CentralLedgerState {
  accounts: Record<string, Account>;
  transactions: LedgerTransaction[];
  failedTransfers: MoneyTransfer[];
  processedIdempotencyKeys: string[];
  duplicateIdempotencyAttempts: number;
  ledgerSequence: number;
  paidDividendKeys: string[]; // `${companyId}-D${day}`
  chargedInterestKeys: string[]; // `${loanId}-D${day}`
  /** Şirketten yönetici maaşı/huzur hakkı olarak bugün çekilen tutar (eski kayıtlarda yoktur) */
  executivePayToday?: { day: number; amount: number };
  balanceSnapshots: BalanceSnapshot[];
  lastIntegrityReport: FinancialIntegrityAuditReport;
}

// ============================================================================
// AŞAMA 4: TALEP, SATIŞ VE STOK SİSTEMİ MODELLERİ
// ============================================================================

export interface CompanyOperationsState {
  installedCapacity: number;
  effectiveCapacity: number;
  plannedProduction: number;
  actualProduction: number;
  inventoryUnits: number;
  maximumStorageUnits: number;
  damagedOrObsoleteInventory: number;
  marketDemand: number;
  companyDemandShare: number;
  potentialSalesUnits: number;
  actualSalesUnits: number;
  unmetDemand: number;
  /** Sektör pazarı (eski kayıtlarda yoktur): bugünkü toplam pazar, rakiplerin sattığı ve oyuncunun payı */
  sectorMarketUnits?: number;
  rivalUnitsInMarket?: number;
  controlledRivalUnits?: number;
  playerMarketSharePct?: number;
  /** Pazar doldu mu: kapasitenin önemli kısmı satılamıyor */
  marketSaturated?: boolean;
  unitProductionCost: number;
  unitStorageCost: number;
  unitLogisticsCost: number;
  unitMarketingCost: number;
  salePrice: number;
  competitorAveragePrice: number;
  productQuality: number; // 0..100
  brandStrength: number; // 0..100
  distributionCoverage: number; // 0..1
  customerSatisfaction: number; // 0..100
  marketSaturation: number; // 0..1
  technologyMultiplier: number; // 1.00..2.50
  workforceEfficiency: number; // 0.40..1.15
  machineAvailability: number; // 0.50..1.00
  shiftMultiplier: number; // 1.00..2.60
  rawMaterialAvailability: number; // 0..1
  energyOperationalCapacity: number; // 0..1
  inventoryTurnoverRatio: number;
  productionReductionRecommended: boolean;
  lastProcessedTotalMinute: number;
  migratedLegacyTechMultiplier?: number;
}

// ============================================================================
// AŞAMA 5: DETAYLI GELİR, GİDER VE KÂRLILIK TABLOSU
// ============================================================================

export interface DetailedIncomeBreakdown {
  // Gelir Kalemleri (Yıllıklandırılmış TL)
  productSalesRevenue: number;
  serviceRevenue: number;
  licenseRevenue: number;
  otherOperatingRevenue: number;
  totalRevenue: number;

  // Satışların Maliyeti (COGS)
  rawMaterialsCost: number;
  directLaborCost: number;
  energyCost: number;
  productionMaintenanceCost: number;
  packagingCost: number;
  scrapAndObsoleteCost: number;
  totalCogs: number;

  // Operasyon Giderleri (OPEX)
  salariesExpense: number;
  socialBenefitsExpense: number;
  rentExpense: number;
  logisticsExpense: number;
  storageExpense: number;
  marketingExpense: number;
  rdExpense: number;
  generalAdminExpense: number;
  itSystemsExpense: number;
  insuranceExpense: number;
  facilityMaintenanceExpense: number;
  licensesAndPermitsExpense: number;
  consultingExpense: number;
  totalOpex: number;

  // Finansman Giderleri
  loanInterestExpense: number;
  latePaymentInterestExpense: number;
  fxAndRiskExpense: number;
  totalFinancingExpense: number;

  // Vergi ve Yatırım
  taxExpense: number;
  depreciationExpense: number;
  capexSpend: number;
  dividendsPaid: number;

  // Finansal Metrikler ve Oranlar
  grossProfit: number;
  grossMarginPct: number;
  EBITDA: number;
  ebitdaMarginPct: number;
  operatingProfit: number; // EBIT
  preTaxProfit: number; // EBT
  netProfit: number;
  freeCashFlow: number;
  workingCapital: number;
  debtToEquityRatio: number;
  interestCoverageRatio: number;
  inventoryTurnover: number;
  returnOnAssetsPct: number;
  returnOnEquityPct: number;

  // Günlük Gerçek Nakit Özeti
  todayCashInflow: number;
  todayCashOutflow: number;
  todayNetCashChange: number;
}

// ============================================================================
// AŞAMA 6: ÖLÇEKLENEBİLİR YATIRIM VE PERSONEL SİSTEMİ MODELLERİ
// ============================================================================

export type InvestmentPackageType =
  | 'SMALL_EXPANSION' // 1. Küçük genişletme (~%5 kapasite)
  | 'MEDIUM_EXPANSION' // 2. Orta genişletme (~%15 kapasite)
  | 'LARGE_EXPANSION' // 3. Büyük genişletme (~%35 kapasite)
  | 'NEW_PRODUCTION_LINE' // 4. Yeni üretim hattı
  | 'NEW_FACTORY' // 5. Yeni fabrika
  | 'CUSTOM_TARGET' // Oyuncu özel hedef kapasite
  | 'BUDGET_MAX'; // Bütçeye göre maksimum güvenli kapasite

export interface InvestmentProject {
  projectId: string;
  packageType: InvestmentPackageType;
  title: string;
  startDay: number;
  estimatedEndDay: number;
  totalCost: number;
  paidAmount: number;
  remainingAmount: number;
  progressPct: number;
  capacityGainUnits: number;
  temporaryDisruptionPct: number;
  delayRiskPct: number;
  cancellationCost: number;
  fundingSource: 'COMPANY_CASH' | 'BANK_LOAN';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  facilityLocation?: string;
  fixedDailyOverheadAdd: number;
}

export type SalaryTier = 'ECONOMY' | 'STANDARD' | 'COMPETITIVE';

export interface WorkforcePlan {
  targetStaffCount: number;
  departments: {
    production: number;
    rd: number;
    sales: number;
    management: number;
  };
  shifts: 1 | 2 | 3;
  salaryTier: SalaryTier;
  hiringDaysRemaining: number;
  pendingHiresCount: number;
  trainingDaysRemaining: number;
  workforceEfficiency: number;
  turnoverRateAnnual: number;
  autoHireEnabled: boolean;
  maxPersonnelDailyBudget: number;
}

// ============================================================================
// AŞAMA 7: BANKA VE KREDİ ALTYAPISI MODELLERİ
// ============================================================================

export type BankLoanType =
  | 'WORKING_CAPITAL' // 1. İşletme sermayesi kredisi
  | 'MACHINE_EQUIPMENT' // 2. Makine ve ekipman kredisi
  | 'FACTORY_INVESTMENT' // 3. Fabrika yatırım kredisi
  | 'COMMERCIAL_VEHICLE_LOGISTICS' // 4. Ticari taşıt ve lojistik kredisi
  | 'REVOLVING_CREDIT' // 5. Rotatif kredi
  | 'COLLATERALIZED_HOLDING'; // 6. Teminatlı holding kredisi

export type LoanBorrowerType = 'PLAYER' | 'COMPANY' | 'HOLDING';
export type BankLoanBorrower = LoanBorrowerType;
export type CollateralAssetType =
  | 'STOCK_POSITION'
  | 'FIXED_ASSET'
  | 'INVENTORY'
  | 'SUBSIDIARY';

export type LoanStatus = 'ACTIVE' | 'DELINQUENT' | 'DEFAULTED' | 'PAID_OFF';

export interface CollateralItem {
  collateralId: string;
  ownerType: LoanBorrowerType;
  ownerId: string;
  assetType: 'STOCK_POSITION' | 'FIXED_ASSET' | 'INVENTORY' | 'SUBSIDIARY';
  assetRef: string;
  label: string;
  marketValue: number;
  haircutFactor: number; // örn. 0.70 (%70 teminat sayılır)
  pledgedLoanId: string | null;
}

export interface LoanContract {
  loanId: string;
  loanType: BankLoanType;
  borrowerType: LoanBorrowerType;
  borrowerId: string;
  principal: number;
  remainingPrincipal: number;
  accruedInterestUnpaid: number;
  annualInterestRate: number;
  effectiveInterestRate: number;
  termInGameDays: number;
  installmentFrequency: number; // kaç günde bir taksit (örn. 15 veya 30 gün)
  nextPaymentGameDay: number;
  installmentAmount: number;
  collateralIds: string[];
  originationFee: number;
  earlyPaymentFee: number;
  latePaymentRate: number;
  gracePeriod: number;
  status: LoanStatus;
  missedPaymentCount: number;
  creditScoreAtOrigination: number;
  purpose: string;
  createdGameDay: number;
  lastInterestAccruedDay: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
}

export interface LoanOfferQuote {
  loanType: BankLoanType;
  labelTR: string;
  borrowerType: LoanBorrowerType;
  maxEligibleAmount: number;
  requestedPrincipal: number;
  approved: boolean;
  rejectionReason?: string;
  annualInterestRate: number;
  effectiveInterestRate: number;
  termInGameDays: number;
  installmentFrequency: number;
  installmentAmount: number;
  totalRepayment: number;
  firstPaymentGameDay: number;
  originationFee: number;
  earlyPaymentFeeRate: number;
  latePaymentRate: number;
  gracePeriodDays: number;
  requiredCollateralValue: number;
  availableCollateralIds: string[];
  postLoanDebtToEquity: number;
  postLoanInterestCoverage: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedCashRunwayDays: number;
  delinquencyConsequencesTR: string;
  creditScore: number;
}
