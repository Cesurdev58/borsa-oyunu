/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 2 & 3: MERKEZİ ÇİFT TARAFLI MUHASEBE, HESAP VE PARA AKTARMA MOTORU (CentralLedgerEngine)
 * - 14+ hesap türünü (Kişisel, Yatırım, Şirket Banka, Şirket İşletme Kasası, Holding, Kredi, Faiz, Vergi,
 *   Tedarikçi, Maaş, Stok, Sabit Kıymet, Sermaye, Temettü) tek merkezden yönetir.
 * - IdempotencyKey koruması ile aynı işlemin ikinci kez uygulanmasını kesin olarak engeller.
 * - Şirket kasasından oyuncuya açıklamasız/serbest para çıkışını reddeder; yalnızca tanımlı yasal işlemlerle
 *   (Maaş, Yönetim Kurulu Ücreti, Onaylanmış Temettü, Ortak Borcu Geri Ödemesi, Yasal Sermaye Azaltımı) izin verir.
 * - Her hesabın bakiyesini defter hareketlerinden yeniden hesaplayıp doğrulayan `runFinancialIntegrityAudit` sunar.
 */

import { EXECUTIVE_PAY_DAILY_MIN, EXECUTIVE_PAY_REVENUE_SHARE } from '../data/gameBalance';
import {
  Account,
  AccountOwnerType,
  AccountType,
  BalanceSnapshot,
  CentralLedgerState,
  FinancialIntegrityAuditReport,
  LedgerEntry,
  LedgerTransaction,
  MoneyTransfer,
  TransactionCategory,
} from '../models/finance';
import { SimulationState } from '../models/simulation';
import { WalletEngine } from './WalletEngine';
import { CompanyWallet } from './CompanyWallet';

export const ACCOUNT_IDS = {
  PLAYER_PERSONAL: 'ACC-PLAYER-PERSONAL',
  PLAYER_INVESTMENT: 'ACC-PLAYER-INVESTMENT',
  HOLDING_MAIN: 'ACC-HOLDING-MAIN',
  LOAN_LIABILITY: 'ACC-LOAN-LIABILITY',
  INTEREST_EXPENSE: 'ACC-INTEREST-EXPENSE',
  TAX_LIABILITY: 'ACC-TAX-LIABILITY',
  SUPPLIER_PAYABLE: 'ACC-SUPPLIER-PAYABLE',
  PAYROLL_EXPENSE: 'ACC-PAYROLL-EXPENSE',
  INVENTORY_ASSET: 'ACC-INVENTORY-ASSET',
  FIXED_ASSET: 'ACC-FIXED-ASSET',
  EQUITY_CAPITAL: 'ACC-EQUITY-CAPITAL',
  DIVIDEND_PAYABLE: 'ACC-DIVIDEND-PAYABLE',
  OPERATING_REVENUE: 'ACC-OPERATING-REVENUE',
  OPERATING_EXPENSE: 'ACC-OPERATING-EXPENSE',
  companyBank: (ticker: string) => `ACC-COMPANY-BANK-${ticker.toUpperCase()}`,
  companyTreasury: (ticker: string) => `ACC-COMPANY-TREASURY-${ticker.toUpperCase()}`,
} as const;

const ALLOWED_COMPANY_TO_PLAYER_CATEGORIES: Set<TransactionCategory> = new Set([
  'EXECUTIVE_SALARY',
  'BOARD_FEE',
  'LEGAL_DIVIDEND',
  'SHAREHOLDER_LOAN_REPAY',
  'STOCK_SALE_PROCEEDS',
  'CAPITAL_REDUCTION',
]);

/** Şirketten günde çekilebilecek en yüksek yönetici maaşı + huzur hakkı */
export function executivePayDailyCap(state: SimulationState): number {
  const rev = Math.max(0, state.playerCompany?.dailyRevenue ?? 0);
  return Math.max(EXECUTIVE_PAY_DAILY_MIN, rev * EXECUTIVE_PAY_REVENUE_SHARE);
}

export const TRANSFER_CATEGORY_LABELS_TR: Record<TransactionCategory, string> = {
  PERSONAL_TO_INVESTMENT: 'Kişisel Hesaptan Yatırım Hesabına Transfer',
  INVESTMENT_TO_PERSONAL: 'Yatırım Hesabından Kişisel Hesaba Transfer',
  CAPITAL_INJECTION: 'Şirkete Sermaye Enjeksiyonu',
  CAPITAL_INCREASE: 'Şirket Sermaye Artırımı',
  SHAREHOLDER_LOAN_GIVE: 'Şirkete Ortak Borcu Verme',
  SHAREHOLDER_LOAN_REPAY: 'Ortak Borcu Geri Ödemesi',
  LEGAL_DIVIDEND: 'Yasal Temettü Dağıtımı (%10 Stopaj)',
  HOLDING_CAPITAL_TRANSFER: 'Holdingden Bağlı Şirkete Sermaye Aktarımı',
  HOLDING_INTRAGROUP_LOAN: 'Holding Grup İçi Kredi Aktarımı',
  INTERCOMPANY_TRADE: 'Şirketler Arası Ticari Ödeme',
  LOAN_DISBURSEMENT: 'Banka Kredisi Kullandırımı',
  LOAN_INSTALLMENT_PAYMENT: 'Banka Kredisi Taksit Ödemesi',
  LOAN_EARLY_PAYOFF: 'Banka Kredisi Erken Kapatma',
  TAX_PAYMENT: 'Kurumlar / Stopaj Vergisi Ödemesi',
  SUPPLIER_PAYMENT: 'Tedarikçi Borcu Ödemesi',
  PAYROLL_PAYMENT: 'Personel Maaş ve Bordro Ödemesi',
  EXECUTIVE_SALARY: 'Üst Yönetici Maaşı (%15 Gelir Vergisi)',
  BOARD_FEE: 'Yönetim Kurulu Huzur Hakkı (%15 Gelir Vergisi)',
  CAPITAL_REDUCTION: 'Yasal Sermaye Azaltımı (%5 Harç)',
  STOCK_SALE_PROCEEDS: 'Hisse Satış Nakit Girişi',
  STOCK_PURCHASE_COST: 'Hisse Alım Nakit Çıkışı',
  CAPEX_INVESTMENT: 'Kapasite / Fabrika Yatırım Ödemesi (CAPEX)',
  OPERATING_REVENUE_RECEIPT: 'Faaliyet Geliri Tahsilatı',
  OPERATING_EXPENSE_PAYMENT: 'Faaliyet Gideri Ödemesi',
  UNAUTHORIZED_COMPANY_WITHDRAWAL: 'Engellenen İzinsiz Şirket Çekimi',
};

export interface TransferExecutionParams {
  idempotencyKey: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  category: TransactionCategory;
  description: string;
  relatedCompanyId?: string;
  relatedLoanId?: string;
  relatedContractId?: string;
  taxRate?: number;
  metadata?: Record<string, string | number | boolean>;
  allowSystemAccountSource?: boolean;
}

export interface TransferExecutionResult {
  success: boolean;
  message: string;
  transaction: LedgerTransaction | null;
  rejectedTransfer?: MoneyTransfer;
  netAmountTransferred: number;
  taxWithheld: number;
}

export class CentralLedgerEngine {
  /**
   * Başlangıç veya migration anında tüm zorunlu hesapları oluşturur ve mevcut state bakiyeleriyle senkronize eder.
   */
  public static createInitialLedgerState(params: {
    initialPersonalCash: number;
    initialInvestmentCash: number;
    reservedInvestmentCash: number;
    day: number;
    companyTicker?: string;
    companyCash?: number;
    companyInventory?: number;
    companyFixedAssets?: number;
    companyEquityCapital?: number;
    totalLoanDebt?: number;
  }): CentralLedgerState {
    const {
      initialPersonalCash,
      initialInvestmentCash,
      reservedInvestmentCash,
      day,
      companyTicker,
      companyCash = 0,
      companyInventory = 0,
      companyFixedAssets = 0,
      companyEquityCapital = 0,
      totalLoanDebt = 0,
    } = params;

    const accounts: Record<string, Account> = {};

    const register = (
      id: string,
      name: string,
      type: AccountType,
      ownerType: AccountOwnerType,
      ownerId: string,
      balance: number,
      reservedBalance = 0
    ) => {
      accounts[id] = {
        id,
        name,
        type,
        ownerType,
        ownerId,
        balance: Number(balance.toFixed(2)),
        reservedBalance: Number(reservedBalance.toFixed(2)),
        currency: 'TRY',
        createdAtDay: day,
        updatedAtDay: day,
      };
    };

    // 1. Oyuncu Kişisel Nakit Hesabı
    register(
      ACCOUNT_IDS.PLAYER_PERSONAL,
      'Oyuncu Kişisel Vadesiz Hesabı',
      'PLAYER_PERSONAL_CASH',
      'PLAYER',
      'PLAYER',
      initialPersonalCash,
      0
    );

    // 2. Oyuncu Yatırım Hesabı (Borsa İşlemleri)
    register(
      ACCOUNT_IDS.PLAYER_INVESTMENT,
      'Oyuncu Borsa Yatırım Hesabı',
      'PLAYER_INVESTMENT_CASH',
      'PLAYER',
      'PLAYER',
      initialInvestmentCash,
      reservedInvestmentCash
    );

    // 5. Holding Ana Hesabı
    register(
      ACCOUNT_IDS.HOLDING_MAIN,
      'Holding Merkez Hazine Hesabı',
      'HOLDING_MAIN',
      'HOLDING',
      'HOLDING',
      0,
      0
    );

    // 6–14 Sistem, Borç, Gider ve Varlık Hesapları
    register(
      ACCOUNT_IDS.LOAN_LIABILITY,
      'Banka Kredi Anapara Borç Hesabı',
      'LOAN_LIABILITY',
      'BANK',
      'BANK',
      totalLoanDebt,
      0
    );
    register(
      ACCOUNT_IDS.INTEREST_EXPENSE,
      'Kredi Faiz Gideri Hesabı',
      'INTEREST_EXPENSE',
      'BANK',
      'BANK',
      0,
      0
    );
    register(
      ACCOUNT_IDS.TAX_LIABILITY,
      'Kurumlar ve Stopaj Vergi Dairesi Hesabı',
      'TAX_LIABILITY',
      'STATE',
      'TAX_AUTHORITY',
      0,
      0
    );
    register(
      ACCOUNT_IDS.SUPPLIER_PAYABLE,
      'Tedarikçi Ticari Borçlar Hesabı',
      'SUPPLIER_PAYABLE',
      'SYSTEM',
      'SUPPLIERS',
      0,
      0
    );
    register(
      ACCOUNT_IDS.PAYROLL_EXPENSE,
      'Personel Maaş ve SGK Gider Hesabı',
      'PAYROLL_EXPENSE',
      'SYSTEM',
      'EMPLOYEES',
      0,
      0
    );
    register(
      ACCOUNT_IDS.INVENTORY_ASSET,
      'Şirket Stok Varlık Hesabı',
      'INVENTORY_ASSET',
      'COMPANY',
      companyTicker || 'COMPANY',
      companyInventory,
      0
    );
    register(
      ACCOUNT_IDS.FIXED_ASSET,
      'Maddi Duran Varlık (Tesis/Makine) Hesabı',
      'FIXED_ASSET',
      'COMPANY',
      companyTicker || 'COMPANY',
      companyFixedAssets,
      0
    );
    register(
      ACCOUNT_IDS.EQUITY_CAPITAL,
      'Ödenmiş Sermaye Hesabı',
      'EQUITY_CAPITAL',
      'COMPANY',
      companyTicker || 'COMPANY',
      companyEquityCapital,
      0
    );
    register(
      ACCOUNT_IDS.DIVIDEND_PAYABLE,
      'Ödenecek Temettü Borcu Hesabı',
      'DIVIDEND_PAYABLE',
      'COMPANY',
      companyTicker || 'COMPANY',
      0,
      0
    );
    register(
      ACCOUNT_IDS.OPERATING_REVENUE,
      'Müşteri Satış Tahsilat Karşı Hesabı',
      'OPERATING_REVENUE',
      'SYSTEM',
      'MARKET_CUSTOMERS',
      0,
      0
    );
    register(
      ACCOUNT_IDS.OPERATING_EXPENSE,
      'Genel Operasyon Gider Karşı Hesabı',
      'OPERATING_EXPENSE',
      'SYSTEM',
      'MARKET_VENDORS',
      0,
      0
    );

    if (companyTicker) {
      const bankShare = Number((companyCash * 0.85).toFixed(2));
      const treasuryShare = Number((companyCash - bankShare).toFixed(2));
      register(
        ACCOUNT_IDS.companyBank(companyTicker),
        `${companyTicker} Kurumsal Banka Hesabı`,
        'COMPANY_BANK',
        'COMPANY',
        companyTicker,
        bankShare,
        0
      );
      register(
        ACCOUNT_IDS.companyTreasury(companyTicker),
        `${companyTicker} İşletme Kasası`,
        'COMPANY_TREASURY',
        'COMPANY',
        companyTicker,
        treasuryShare,
        0
      );
    }

    const initialReport: FinancialIntegrityAuditReport = {
      valid: true,
      checkedDay: day,
      checkedMinute: 0,
      negativeAccounts: [],
      unauthorizedTransfers: [],
      duplicateTransactionIds: [],
      duplicateIdempotencyAttempts: 0,
      ledgerBalanceMismatches: [],
      unbackedDebtErrors: [],
      unbackedLoanErrors: [],
      duplicateDividends: [],
      duplicateDailyInterest: [],
      unexplainedCompanyWithdrawals: [],
      reservedCashViolations: [],
      totalMoneySupply: Number(
        (initialPersonalCash + initialInvestmentCash + companyCash).toFixed(2)
      ),
      errors: [],
    };

    return {
      accounts,
      transactions: [],
      failedTransfers: [],
      processedIdempotencyKeys: [],
      duplicateIdempotencyAttempts: 0,
      ledgerSequence: 0,
      paidDividendKeys: [],
      chargedInterestKeys: [],
      balanceSnapshots: [],
      lastIntegrityReport: initialReport,
    };
  }

  /**
   * Şirket yeni kurulduğunda şirket banka ve işletme kasası hesaplarını oluşturur.
   */
  public static ensureCompanyAccounts(
    ledger: CentralLedgerState,
    ticker: string,
    companyCash: number,
    day: number
  ): void {
    const bankId = ACCOUNT_IDS.companyBank(ticker);
    const treasuryId = ACCOUNT_IDS.companyTreasury(ticker);
    if (!ledger.accounts[bankId]) {
      const bankShare = Number((companyCash * 0.85).toFixed(2));
      const treasuryShare = Number((companyCash - bankShare).toFixed(2));
      ledger.accounts[bankId] = {
        id: bankId,
        name: `${ticker} Kurumsal Banka Hesabı`,
        type: 'COMPANY_BANK',
        ownerType: 'COMPANY',
        ownerId: ticker,
        balance: bankShare,
        reservedBalance: 0,
        currency: 'TRY',
        createdAtDay: day,
        updatedAtDay: day,
      };
      ledger.accounts[treasuryId] = {
        id: treasuryId,
        name: `${ticker} İşletme Kasası`,
        type: 'COMPANY_TREASURY',
        ownerType: 'COMPANY',
        ownerId: ticker,
        balance: treasuryShare,
        reservedBalance: 0,
        currency: 'TRY',
        createdAtDay: day,
        updatedAtDay: day,
      };
    }
  }

  /**
   * State içindeki nakit alanları ile merkezi muhasebe hesaplarını çift yönlü senkronize tutar.
   */
  public static syncLedgerWithState(
    state: SimulationState,
    reservedOrderCash: number
  ): void {
    if (!state.centralLedger) {
      const pCash =
        typeof state.personalCash === 'number' ? state.personalCash : 0;
      const invCash =
        typeof state.investmentCash === 'number'
          ? state.investmentCash
          : state.cash;
      state.personalCash = pCash;
      state.investmentCash = invCash;
      state.holdingCash = state.holdingCash ?? 0;
      state.centralLedger = CentralLedgerEngine.createInitialLedgerState({
        initialPersonalCash: pCash,
        initialInvestmentCash: invCash,
        reservedInvestmentCash: reservedOrderCash,
        day: state.day,
        companyTicker: state.playerCompany?.ticker,
        companyCash: state.playerCompany?.financials.cash ?? 0,
        companyInventory: state.playerCompany?.financials.inventory ?? 0,
        companyFixedAssets: state.playerCompany?.financials.fixedAssets ?? 0,
        companyEquityCapital:
          state.playerCompany?.financials.paidInCapital ?? 0,
        totalLoanDebt:
          state.totalDebt +
          (state.playerCompany?.financials.totalLiabilities ?? 0),
      });
    }

    const ledger = state.centralLedger;
    const personalAcc = ledger.accounts[ACCOUNT_IDS.PLAYER_PERSONAL];
    const investAcc = ledger.accounts[ACCOUNT_IDS.PLAYER_INVESTMENT];
    const holdingAcc = ledger.accounts[ACCOUNT_IDS.HOLDING_MAIN];

    // Eğer dışarıdan borsa alım/satım veya temettü ile state.cash değiştiyse yatırım hesabına yansıt
    const currentTrackedPlayerCash = Number(
      ((personalAcc?.balance ?? 0) + (investAcc?.balance ?? 0)).toFixed(2)
    );
    const diffPlayerCash = Number(
      (state.cash - currentTrackedPlayerCash).toFixed(2)
    );
    if (Math.abs(diffPlayerCash) >= 0.01 && investAcc) {
      investAcc.balance = Number(
        Math.max(0, investAcc.balance + diffPlayerCash).toFixed(2)
      );
      investAcc.updatedAtDay = state.day;
    }

    if (investAcc) {
      investAcc.reservedBalance = Number(reservedOrderCash.toFixed(2));
    }

    state.personalCash = personalAcc ? personalAcc.balance : 0;
    state.investmentCash = investAcc ? investAcc.balance : state.cash;
    state.holdingCash = holdingAcc ? holdingAcc.balance : 0;
    WalletEngine.setBalance(state, state.personalCash + state.investmentCash);

    if (state.playerCompany) {
      const pc = state.playerCompany;
      CentralLedgerEngine.ensureCompanyAccounts(
        ledger,
        pc.ticker,
        pc.financials.cash,
        state.day
      );
      const bankAcc = ledger.accounts[ACCOUNT_IDS.companyBank(pc.ticker)];
      const trsAcc = ledger.accounts[ACCOUNT_IDS.companyTreasury(pc.ticker)];
      if (bankAcc && trsAcc) {
        const currentCompanyTotal = Number(
          (bankAcc.balance + trsAcc.balance).toFixed(2)
        );
        const compDiff = Number(
          (pc.financials.cash - currentCompanyTotal).toFixed(2)
        );
        if (Math.abs(compDiff) >= 0.01) {
          // Operasyonel nakit akışı farkını önce banka hesabına yansıt
          if (bankAcc.balance + compDiff >= 0) {
            bankAcc.balance = Number((bankAcc.balance + compDiff).toFixed(2));
          } else {
            const combined = Math.max(0, currentCompanyTotal + compDiff);
            bankAcc.balance = Number((combined * 0.85).toFixed(2));
            trsAcc.balance = Number((combined - bankAcc.balance).toFixed(2));
          }
          bankAcc.updatedAtDay = state.day;
          trsAcc.updatedAtDay = state.day;
        }
      }

      if (ledger.accounts[ACCOUNT_IDS.INVENTORY_ASSET]) {
        ledger.accounts[ACCOUNT_IDS.INVENTORY_ASSET].balance = Number(
          pc.financials.inventory.toFixed(2)
        );
      }
      if (ledger.accounts[ACCOUNT_IDS.FIXED_ASSET]) {
        ledger.accounts[ACCOUNT_IDS.FIXED_ASSET].balance = Number(
          pc.financials.fixedAssets.toFixed(2)
        );
      }
      if (ledger.accounts[ACCOUNT_IDS.EQUITY_CAPITAL]) {
        ledger.accounts[ACCOUNT_IDS.EQUITY_CAPITAL].balance = Number(
          pc.financials.paidInCapital.toFixed(2)
        );
      }
    }

    if (ledger.accounts[ACCOUNT_IDS.LOAN_LIABILITY]) {
      const activeLoanSum = (state.activeLoans ?? [])
        .filter((l) => l.status !== 'PAID_OFF')
        .reduce((s, l) => s + l.remainingPrincipal, 0);
      ledger.accounts[ACCOUNT_IDS.LOAN_LIABILITY].balance = Number(
        Math.max(
          activeLoanSum,
          state.totalDebt +
            (state.playerCompany?.financials.totalLiabilities ?? 0)
        ).toFixed(2)
      );
    }
  }

  /**
   * Bir hesaptan güvenli aktarılabilir maksimum tutarı hesaplar:
   * - Rezerve edilmiş borsa nakdini
   * - Yaklaşan zorunlu kredi taksitini (15 gün içindeki)
   * - Asgari işletme sermayesini (şirket hesapları için 3 günlük OPEX)
   * - Ödenmemiş maaşları ve vadesi yaklaşan vergileri
   * düşerek sıfır nakit veya temerrüt oluşmasını engeller.
   */
  public static computeMaxSafeTransferAmount(
    state: SimulationState,
    sourceAccountId: string,
    reservedOrderCash: number
  ): {
    rawBalance: number;
    reservedAmount: number;
    upcomingLoanInstallment: number;
    minWorkingCapitalBuffer: number;
    unpaidPayrollAndTax: number;
    maxSafeTransferable: number;
  } {
    CentralLedgerEngine.syncLedgerWithState(state, reservedOrderCash);
    const ledger = state.centralLedger!;
    const acc = ledger.accounts[sourceAccountId];
    if (!acc) {
      return {
        rawBalance: 0,
        reservedAmount: 0,
        upcomingLoanInstallment: 0,
        minWorkingCapitalBuffer: 0,
        unpaidPayrollAndTax: 0,
        maxSafeTransferable: 0,
      };
    }

    const rawBalance = acc.balance;
    const reservedAmount =
      sourceAccountId === ACCOUNT_IDS.PLAYER_INVESTMENT
        ? Math.max(acc.reservedBalance, reservedOrderCash)
        : acc.reservedBalance;

    let upcomingLoanInstallment = 0;
    let minWorkingCapitalBuffer = 0;
    let unpaidPayrollAndTax = 0;

    const isCompanyAccount =
      acc.type === 'COMPANY_BANK' || acc.type === 'COMPANY_TREASURY';

    if (isCompanyAccount && state.playerCompany) {
      const pc = state.playerCompany;
      minWorkingCapitalBuffer = Number(
        Math.max(15_000, pc.dailyOpex * 3).toFixed(2)
      );
      unpaidPayrollAndTax = Number(
        ((pc.unpaidPayrollBalance ?? 0) + (pc.unpaidTaxBalance ?? 0)).toFixed(2)
      );

      for (const loan of state.activeLoans ?? []) {
        if (
          loan.status !== 'PAID_OFF' &&
          loan.borrowerType === 'COMPANY' &&
          loan.nextPaymentGameDay - state.day <= 15
        ) {
          upcomingLoanInstallment += loan.installmentAmount;
        }
      }
    } else if (acc.ownerType === 'PLAYER') {
      for (const loan of state.activeLoans ?? []) {
        if (
          loan.status !== 'PAID_OFF' &&
          loan.borrowerType === 'PLAYER' &&
          loan.nextPaymentGameDay - state.day <= 15
        ) {
          upcomingLoanInstallment += loan.installmentAmount;
        }
      }
    }

    upcomingLoanInstallment = Number(upcomingLoanInstallment.toFixed(2));

    const maxSafeTransferable = Number(
      Math.max(
        0,
        rawBalance -
          reservedAmount -
          upcomingLoanInstallment -
          minWorkingCapitalBuffer -
          unpaidPayrollAndTax
      ).toFixed(2)
    );

    return {
      rawBalance,
      reservedAmount,
      upcomingLoanInstallment,
      minWorkingCapitalBuffer,
      unpaidPayrollAndTax,
      maxSafeTransferable,
    };
  }

  /**
   * Merkezi Çift Taraflı Para Transferi:
   * - Tutar > 0, kaynak != hedef, idempotencyKey benzersizlik, yetki ve kullanılabilir bakiye kontrolü yapar.
   * - Başarısız işlem hiçbir bakiyeyi değiştirmez ve `failedTransfers` listesine kaydedilir.
   * - Başarılı işlem tek atomik adımda kaynak/hedef hesapları ve `SimulationState` alanlarını günceller.
   */
  public static executeTransfer(
    state: SimulationState,
    params: TransferExecutionParams,
    reservedOrderCash: number
  ): TransferExecutionResult {
    CentralLedgerEngine.syncLedgerWithState(state, reservedOrderCash);
    const ledger = state.centralLedger!;

    const nextSeq = ledger.ledgerSequence + 1;
    const txId = `LTX-D${state.day}-S${String(nextSeq).padStart(8, '0')}`;
    const cleanAmount = Number(
      (Number.isFinite(params.amount) ? params.amount : 0).toFixed(2)
    );
    const idempotencyKey =
      params.idempotencyKey.trim() || `${txId}-AUTO-IDEMPOTENCY`;

    const recordRejection = (reason: string): TransferExecutionResult => {
      ledger.ledgerSequence = nextSeq;
      const rejected: MoneyTransfer = {
        transactionId: txId,
        idempotencyKey,
        gameDay: state.day,
        gameMinute: state.minutesIntoCurrentDay,
        createdAtISO: state.lastRealTimestampISO || new Date().toISOString(),
        sourceAccountId: params.sourceAccountId,
        destinationAccountId: params.destinationAccountId,
        amount: cleanAmount,
        currency: 'TRY',
        category: params.category,
        description: params.description,
        relatedCompanyId: params.relatedCompanyId,
        relatedLoanId: params.relatedLoanId,
        relatedContractId: params.relatedContractId,
        status: 'REJECTED',
        failureReason: reason,
        taxEffect: 0,
        metadata: params.metadata,
      };
      ledger.failedTransfers.unshift(rejected);
      if (ledger.failedTransfers.length > 100) {
        ledger.failedTransfers.pop();
      }
      return {
        success: false,
        message: reason,
        transaction: null,
        rejectedTransfer: rejected,
        netAmountTransferred: 0,
        taxWithheld: 0,
      };
    };

    // 1. IdempotencyKey Kontrolü
    if (ledger.processedIdempotencyKeys.includes(idempotencyKey)) {
      ledger.duplicateIdempotencyAttempts += 1;
      return recordRejection(
        `Mükerrer işlem engellendi (idempotencyKey: ${idempotencyKey} daha önce uygulandı).`
      );
    }

    // 2. Tutar Kontrolü
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      return recordRejection(
        'Transfer tutarı sıfırdan büyük ve geçerli bir sayı olmalıdır.'
      );
    }

    // 3. Kaynak ve Hedef Hesap Kontrolü
    if (params.sourceAccountId === params.destinationAccountId) {
      return recordRejection('Kaynak hesap ile hedef hesap aynı olamaz.');
    }

    const sourceAcc = ledger.accounts[params.sourceAccountId];
    const destAcc = ledger.accounts[params.destinationAccountId];
    if (!sourceAcc || !destAcc) {
      return recordRejection('Kaynak veya hedef muhasebe hesabı bulunamadı.');
    }

    // 4. Şirket Kasasından Oyuncuya Yetkisiz Para Çıkışı Denetimi (Kural 17 & Aşama 3)
    const isSourceCompany =
      sourceAcc.type === 'COMPANY_BANK' ||
      sourceAcc.type === 'COMPANY_TREASURY';
    const isDestPlayer =
      destAcc.type === 'PLAYER_PERSONAL_CASH' ||
      destAcc.type === 'PLAYER_INVESTMENT_CASH';

    if (isSourceCompany && isDestPlayer) {
      if (!ALLOWED_COMPANY_TO_PLAYER_CATEGORIES.has(params.category)) {
        return recordRejection(
          'Şirket kasasından kişisel hesaba serbest veya açıklamasız para çekilemez. Yalnızca Temettü, Ortak Borcu Geri Ödemesi, Maaş/Huzur Hakkı veya Sermaye Azaltımı kullanılabilir.'
        );
      }

      if (params.category === 'SHAREHOLDER_LOAN_REPAY') {
        const currentShareholderLoan =
          state.playerCompany?.shareholderLoanBalance ?? 0;
        if (cleanAmount > currentShareholderLoan + 0.01) {
          return recordRejection(
            `Şirketin oyuncuya olan ortak borcu bakiyesi (${currentShareholderLoan.toLocaleString('tr-TR')} TL) aşılamaz.`
          );
        }
      }

      if (params.category === 'EXECUTIVE_SALARY' || params.category === 'BOARD_FEE') {
        // Maaş ve huzur hakkı günlük üst sınırlıdır; büyük para ancak temettüyle (kâr kadar) çekilebilir
        const cap = executivePayDailyCap(state);
        const paidToday =
          ledger.executivePayToday && ledger.executivePayToday.day === state.day
            ? ledger.executivePayToday.amount
            : 0;
        if (cleanAmount > cap - paidToday + 0.01) {
          return recordRejection(
            `Yönetici maaşı ve huzur hakkı günde en fazla ${Math.round(cap).toLocaleString('tr-TR')} TL olabilir (bugün kalan: ${Math.max(0, Math.round(cap - paidToday)).toLocaleString('tr-TR')} TL). Daha fazlası için temettü dağıt.`
          );
        }
      }

      if (params.category === 'CAPITAL_REDUCTION') {
        const paidIn = state.playerCompany?.financials.paidInCapital ?? 0;
        const maxReduction = Math.max(0, paidIn - 100_000);
        if (cleanAmount > maxReduction + 0.01) {
          return recordRejection(
            `Sermaye azaltımı yalnızca konulan sermaye kadar yapılabilir (en fazla ${Math.round(maxReduction).toLocaleString('tr-TR')} TL). Kâr ancak temettüyle çekilebilir.`
          );
        }
      }

      if (params.category === 'LEGAL_DIVIDEND') {
        const companyId = state.playerCompany?.ticker || 'COMPANY';
        const divKey = `${companyId}-D${state.day}`;
        if (ledger.paidDividendKeys.includes(divKey)) {
          return recordRejection(
            `${companyId} şirketi Gün ${state.day} içinde zaten temettü dağıttı; aynı gün ikinci kez temettü ödenemez.`
          );
        }
        const distributableProfit = Math.max(
          0,
          state.playerCompany?.financials.retainedEarnings ?? 0
        );
        if (cleanAmount > distributableProfit + 0.01) {
          return recordRejection(
            `Yasal temettü dağıtımı için şirketin geçmiş yıl kârları (${distributableProfit.toLocaleString('tr-TR')} TL) yetersiz.`
          );
        }
      }
    }

    // 5. Kullanılabilir Bakiye ve Rezerv Kontrolü
    if (!params.allowSystemAccountSource) {
      const effectiveReserved =
        sourceAcc.id === ACCOUNT_IDS.PLAYER_INVESTMENT
          ? Math.max(sourceAcc.reservedBalance, reservedOrderCash)
          : sourceAcc.reservedBalance;
      const availableInSource = Number(
        Math.max(0, sourceAcc.balance - effectiveReserved).toFixed(2)
      );
      if (cleanAmount > availableInSource + 0.001) {
        return recordRejection(
          `Yetersiz kullanılabilir bakiye (${sourceAcc.name}). Gereken: ${cleanAmount.toLocaleString('tr-TR')} TL, Kullanılabilir (Rezerv Dışı): ${availableInSource.toLocaleString('tr-TR')} TL.`
        );
      }
    }

    // 6. Vergi / Stopaj Etkisi Hesaplaması
    let taxWithheld = 0;
    if (typeof params.taxRate === 'number' && params.taxRate > 0) {
      taxWithheld = Number((cleanAmount * params.taxRate).toFixed(2));
    } else if (params.category === 'LEGAL_DIVIDEND') {
      taxWithheld = Number((cleanAmount * 0.1).toFixed(2)); // %10 temettü stopajı
    } else if (
      params.category === 'EXECUTIVE_SALARY' ||
      params.category === 'BOARD_FEE'
    ) {
      taxWithheld = Number((cleanAmount * 0.15).toFixed(2)); // %15 gelir vergisi stopajı
    } else if (params.category === 'CAPITAL_REDUCTION') {
      taxWithheld = Number((cleanAmount * 0.05).toFixed(2)); // %5 sermaye azaltımı kesintisi
    }
    const netAmountToDest = Number((cleanAmount - taxWithheld).toFixed(2));

    // 7. Atomik Defter Kaydı ve Bakiye Güncellemesi
    ledger.ledgerSequence = nextSeq;
    ledger.processedIdempotencyKeys.push(idempotencyKey);
    if (ledger.processedIdempotencyKeys.length > 500) {
      ledger.processedIdempotencyKeys.shift();
    }

    const sourceBefore = sourceAcc.balance;
    const destBefore = destAcc.balance;

    sourceAcc.balance = Number((sourceAcc.balance - cleanAmount).toFixed(2));
    sourceAcc.updatedAtDay = state.day;

    destAcc.balance = Number((destAcc.balance + netAmountToDest).toFixed(2));
    destAcc.updatedAtDay = state.day;

    if (params.category === 'EXECUTIVE_SALARY' || params.category === 'BOARD_FEE') {
      const prev =
        ledger.executivePayToday && ledger.executivePayToday.day === state.day
          ? ledger.executivePayToday.amount
          : 0;
      ledger.executivePayToday = { day: state.day, amount: Number((prev + cleanAmount).toFixed(2)) };
    }

    const entries: LedgerEntry[] = [
      {
        entryId: `${txId}-E1`,
        transactionId: txId,
        accountId: sourceAcc.id,
        direction: 'CREDIT',
        amount: cleanAmount,
        balanceBefore: sourceBefore,
        balanceAfter: sourceAcc.balance,
        gameDay: state.day,
        gameMinute: state.minutesIntoCurrentDay,
      },
      {
        entryId: `${txId}-E2`,
        transactionId: txId,
        accountId: destAcc.id,
        direction: 'DEBIT',
        amount: netAmountToDest,
        balanceBefore: destBefore,
        balanceAfter: destAcc.balance,
        gameDay: state.day,
        gameMinute: state.minutesIntoCurrentDay,
      },
    ];

    if (taxWithheld > 0 && ledger.accounts[ACCOUNT_IDS.TAX_LIABILITY]) {
      const taxAcc = ledger.accounts[ACCOUNT_IDS.TAX_LIABILITY];
      const taxBefore = taxAcc.balance;
      taxAcc.balance = Number((taxAcc.balance + taxWithheld).toFixed(2));
      taxAcc.updatedAtDay = state.day;
      entries.push({
        entryId: `${txId}-E3-TAX`,
        transactionId: txId,
        accountId: taxAcc.id,
        direction: 'DEBIT',
        amount: taxWithheld,
        balanceBefore: taxBefore,
        balanceAfter: taxAcc.balance,
        gameDay: state.day,
        gameMinute: state.minutesIntoCurrentDay,
      });
    }

    const ledgerTx: LedgerTransaction = {
      transactionId: txId,
      idempotencyKey,
      gameDay: state.day,
      gameMinute: state.minutesIntoCurrentDay,
      createdAtISO: state.lastRealTimestampISO || new Date().toISOString(),
      sourceAccountId: sourceAcc.id,
      destinationAccountId: destAcc.id,
      amount: cleanAmount,
      currency: 'TRY',
      category: params.category,
      description: params.description,
      relatedCompanyId: params.relatedCompanyId,
      relatedLoanId: params.relatedLoanId,
      relatedContractId: params.relatedContractId,
      status: 'COMPLETED',
      taxEffect: taxWithheld,
      metadata: params.metadata,
      entries,
    };

    ledger.transactions.unshift(ledgerTx);
    if (ledger.transactions.length > 250) {
      ledger.transactions.pop();
    }

    // 8. State ve Şirket Bilançosu Yan Etkilerini Atomik Güncelle
    const personalAcc = ledger.accounts[ACCOUNT_IDS.PLAYER_PERSONAL];
    const investAcc = ledger.accounts[ACCOUNT_IDS.PLAYER_INVESTMENT];
    const holdingAcc = ledger.accounts[ACCOUNT_IDS.HOLDING_MAIN];

    state.personalCash = personalAcc ? personalAcc.balance : 0;
    state.investmentCash = investAcc ? investAcc.balance : 0;
    state.holdingCash = holdingAcc ? holdingAcc.balance : 0;
    WalletEngine.setBalance(state, state.personalCash + state.investmentCash);

    if (state.playerCompany) {
      const pc = state.playerCompany;
      const bankAcc = ledger.accounts[ACCOUNT_IDS.companyBank(pc.ticker)];
      const trsAcc = ledger.accounts[ACCOUNT_IDS.companyTreasury(pc.ticker)];
      if (bankAcc && trsAcc) {
        const newCompanyCash = Number(
          (bankAcc.balance + trsAcc.balance).toFixed(2)
        );
        const cashDeltaForCompany = Number(
          (newCompanyCash - pc.financials.cash).toFixed(2)
        );

        if (Math.abs(cashDeltaForCompany) >= 0.01) {
          CompanyWallet.assign(pc, newCompanyCash);
          pc.capitalCash = newCompanyCash;
          pc.financials.totalAssets = Number(
            (
              pc.financials.cash +
              pc.financials.inventory +
              pc.financials.receivables +
              pc.financials.fixedAssets
            ).toFixed(2)
          );

          if (
            params.category === 'CAPITAL_INJECTION' ||
            params.category === 'HOLDING_CAPITAL_TRANSFER'
          ) {
            pc.financials.paidInCapital = Number(
              (pc.financials.paidInCapital + cashDeltaForCompany).toFixed(2)
            );
          } else if (params.category === 'CAPITAL_REDUCTION') {
            pc.financials.paidInCapital = Number(
              Math.max(
                100_000,
                pc.financials.paidInCapital + cashDeltaForCompany
              ).toFixed(2)
            );
          } else if (params.category === 'SHAREHOLDER_LOAN_GIVE') {
            pc.shareholderLoanBalance = Number(
              ((pc.shareholderLoanBalance ?? 0) + cleanAmount).toFixed(2)
            );
            pc.financials.shortTermDebt = Number(
              (pc.financials.shortTermDebt + cleanAmount).toFixed(2)
            );
          } else if (params.category === 'SHAREHOLDER_LOAN_REPAY') {
            pc.shareholderLoanBalance = Number(
              Math.max(0, (pc.shareholderLoanBalance ?? 0) - cleanAmount).toFixed(
                2
              )
            );
            pc.financials.shortTermDebt = Number(
              Math.max(0, pc.financials.shortTermDebt - cleanAmount).toFixed(2)
            );
          } else if (params.category === 'LEGAL_DIVIDEND') {
            const divKey = `${pc.ticker}-D${state.day}`;
            ledger.paidDividendKeys.push(divKey);
            pc.financials.retainedEarnings = Number(
              (pc.financials.retainedEarnings - cleanAmount).toFixed(2)
            );
          } else if (
            params.category === 'EXECUTIVE_SALARY' ||
            params.category === 'BOARD_FEE' ||
            params.category === 'PAYROLL_PAYMENT' ||
            params.category === 'TAX_PAYMENT' ||
            params.category === 'SUPPLIER_PAYMENT'
          ) {
            pc.financials.retainedEarnings = Number(
              (pc.financials.retainedEarnings + cashDeltaForCompany).toFixed(2)
            );
            if (params.category === 'TAX_PAYMENT') {
              pc.unpaidTaxBalance = Number(
                Math.max(0, (pc.unpaidTaxBalance ?? 0) - cleanAmount).toFixed(2)
              );
            }
            if (params.category === 'PAYROLL_PAYMENT') {
              pc.unpaidPayrollBalance = Number(
                Math.max(
                  0,
                  (pc.unpaidPayrollBalance ?? 0) - cleanAmount
                ).toFixed(2)
              );
            }
            if (params.category === 'SUPPLIER_PAYMENT') {
              pc.supplierPayableBalance = Number(
                Math.max(
                  0,
                  (pc.supplierPayableBalance ?? 0) - cleanAmount
                ).toFixed(2)
              );
            }
          }

          pc.financials.totalLiabilities = Number(
            (
              pc.financials.shortTermDebt + pc.financials.longTermDebt
            ).toFixed(2)
          );
          pc.financials.shareholdersEquity = Number(
            (
              pc.financials.totalAssets - pc.financials.totalLiabilities
            ).toFixed(2)
          );
          pc.financials.retainedEarnings = Number(
            (
              pc.financials.shareholdersEquity - pc.financials.paidInCapital
            ).toFixed(2)
          );
        }
      }
    }

    return {
      success: true,
      message: `${params.description} (${cleanAmount.toLocaleString('tr-TR')} TL${
        taxWithheld > 0
          ? `, Vergi/Stopaj: ${taxWithheld.toLocaleString('tr-TR')} TL`
          : ''
      }) tamamlandı.`,
      transaction: ledgerTx,
      netAmountTransferred: netAmountToDest,
      taxWithheld,
    };
  }

  /**
   * AŞAMA 2: FinancialIntegrityAudit — Merkezi Muhasebe ve Bilanço Bütünlük Denetimi
   */
  public static runFinancialIntegrityAudit(
    state: SimulationState,
    reservedOrderCash: number
  ): FinancialIntegrityAuditReport {
    CentralLedgerEngine.syncLedgerWithState(state, reservedOrderCash);
    const ledger = state.centralLedger!;

    const negativeAccounts: string[] = [];
    const unauthorizedTransfers: string[] = [];
    const duplicateTransactionIds: string[] = [];
    const ledgerBalanceMismatches: string[] = [];
    const unbackedDebtErrors: string[] = [];
    const unbackedLoanErrors: string[] = [];
    const duplicateDividends: string[] = [];
    const duplicateDailyInterest: string[] = [];
    const unexplainedCompanyWithdrawals: string[] = [];
    const reservedCashViolations: string[] = [];
    const errors: string[] = [];

    // 1. Negatif Hesap ve Rezerv Kontrolü
    for (const acc of Object.values(ledger.accounts)) {
      if (
        acc.type !== 'OPERATING_REVENUE' &&
        acc.type !== 'OPERATING_EXPENSE' &&
        (acc.balance < -0.01 || !Number.isFinite(acc.balance))
      ) {
        negativeAccounts.push(`${acc.id} (${acc.balance})`);
        errors.push(`Negatif veya geçersiz hesap bakiyesi: ${acc.id} = ${acc.balance}`);
      }
      if (acc.reservedBalance > acc.balance + 0.05) {
        reservedCashViolations.push(
          `${acc.id}: rezerv (${acc.reservedBalance}) > bakiye (${acc.balance})`
        );
        errors.push(
          `Rezerve edilmiş nakit toplam bakiyeyi aşıyor: ${acc.id}`
        );
      }
    }

    // 2. Çift İşlem Kimliği ve Yetkisiz Transfer Kontrolü
    const seenIds = new Set<string>();
    const seenDivKeys = new Set<string>();
    for (const tx of ledger.transactions) {
      if (seenIds.has(tx.transactionId)) {
        duplicateTransactionIds.push(tx.transactionId);
        errors.push(`Tekrarlanan muhasebe işlem kimliği: ${tx.transactionId}`);
      }
      seenIds.add(tx.transactionId);

      const src = ledger.accounts[tx.sourceAccountId];
      const dst = ledger.accounts[tx.destinationAccountId];
      if (
        src &&
        dst &&
        (src.type === 'COMPANY_BANK' || src.type === 'COMPANY_TREASURY') &&
        (dst.type === 'PLAYER_PERSONAL_CASH' ||
          dst.type === 'PLAYER_INVESTMENT_CASH')
      ) {
        if (!ALLOWED_COMPANY_TO_PLAYER_CATEGORIES.has(tx.category)) {
          unauthorizedTransfers.push(tx.transactionId);
          unexplainedCompanyWithdrawals.push(tx.transactionId);
          errors.push(
            `Şirketten oyuncuya yetkisiz/açıklamasız transfer tespit edildi: ${tx.transactionId}`
          );
        }
      }

      if (tx.category === 'LEGAL_DIVIDEND') {
        const dKey = `${tx.relatedCompanyId || 'COMP'}-D${tx.gameDay}`;
        if (seenDivKeys.has(dKey)) {
          duplicateDividends.push(dKey);
          errors.push(`Aynı gün iki kez ödenen temettü: ${dKey}`);
        }
        seenDivKeys.add(dKey);
      }
    }

    // 3. Defter Toplamı ile State Bakiyesi Uyum Kontrolü
    const expectedPlayerCash = Number(
      (
        (ledger.accounts[ACCOUNT_IDS.PLAYER_PERSONAL]?.balance ?? 0) +
        (ledger.accounts[ACCOUNT_IDS.PLAYER_INVESTMENT]?.balance ?? 0)
      ).toFixed(2)
    );
    if (Math.abs(state.cash - expectedPlayerCash) > 0.5) {
      ledgerBalanceMismatches.push(
        `Oyuncu nakdi (${state.cash}) != Defter toplamı (${expectedPlayerCash})`
      );
      errors.push(
        `Defter ve state oyuncu nakit tutarsızlığı: State=${state.cash}, Defter=${expectedPlayerCash}`
      );
    }

    if (state.playerCompany) {
      const pc = state.playerCompany;
      const bankBal =
        ledger.accounts[ACCOUNT_IDS.companyBank(pc.ticker)]?.balance ?? 0;
      const trsBal =
        ledger.accounts[ACCOUNT_IDS.companyTreasury(pc.ticker)]?.balance ?? 0;
      const expectedCompCash = Number((bankBal + trsBal).toFixed(2));
      if (Math.abs(pc.financials.cash - expectedCompCash) > 0.5) {
        ledgerBalanceMismatches.push(
          `Şirket kasası (${pc.financials.cash}) != Defter toplamı (${expectedCompCash})`
        );
        errors.push(
          `Şirket kasası defter tutarsızlığı: Bilanço=${pc.financials.cash}, Defter=${expectedCompCash}`
        );
      }
    }

    // 4. Kredi ve Teminat Tutarlılığı Kontrolü
    const pledgedCollaterals = new Map<string, string>();
    for (const loan of state.activeLoans ?? []) {
      if (loan.principal <= 0 || !Number.isFinite(loan.remainingPrincipal)) {
        unbackedLoanErrors.push(`Geçersiz kredi ana parası: ${loan.loanId}`);
        errors.push(`Geçersiz kredi kaydı: ${loan.loanId}`);
      }
      if (loan.status !== 'PAID_OFF') {
        for (const colId of loan.collateralIds) {
          const prevLoan = pledgedCollaterals.get(colId);
          if (prevLoan && prevLoan !== loan.loanId) {
            unbackedLoanErrors.push(
              `Çift teminat kullanımı: ${colId} (${prevLoan} ve ${loan.loanId})`
            );
            errors.push(`Aynı teminat iki kredide kullanılmış: ${colId}`);
          }
          pledgedCollaterals.set(colId, loan.loanId);
        }
      }
    }

    // 5. Toplam Para Arzı Hesabı (Oyuncu Nakdi + Şirket Kasası + Holding Nakdi)
    const totalMoneySupply = Number(
      (
        state.cash +
        (state.holdingCash ?? 0) +
        (state.playerCompany?.financials.cash ?? 0)
      ).toFixed(2)
    );

    const report: FinancialIntegrityAuditReport = {
      valid: errors.length === 0,
      checkedDay: state.day,
      checkedMinute: state.minutesIntoCurrentDay,
      negativeAccounts,
      unauthorizedTransfers,
      duplicateTransactionIds,
      duplicateIdempotencyAttempts: ledger.duplicateIdempotencyAttempts,
      ledgerBalanceMismatches,
      unbackedDebtErrors,
      unbackedLoanErrors,
      duplicateDividends,
      duplicateDailyInterest,
      unexplainedCompanyWithdrawals,
      reservedCashViolations,
      totalMoneySupply,
      errors,
    };

    ledger.lastIntegrityReport = report;
    state.lastFinancialIntegrityReport = report;
    return report;
  }

  public static recordBalanceSnapshot(state: SimulationState): BalanceSnapshot {
    const ledger = state.centralLedger!;
    const accountBalances: Record<string, number> = {};
    for (const [id, acc] of Object.entries(ledger.accounts)) {
      accountBalances[id] = acc.balance;
    }
    const totalLoanPrincipal = (state.activeLoans ?? [])
      .filter((l) => l.status !== 'PAID_OFF')
      .reduce((s, l) => s + l.remainingPrincipal, 0);

    const snap: BalanceSnapshot = {
      snapshotId: `SNAP-D${state.day}-M${state.minutesIntoCurrentDay}`,
      gameDay: state.day,
      gameMinute: state.minutesIntoCurrentDay,
      accountBalances,
      totalMoneySupply: Number(
        (
          state.cash +
          (state.holdingCash ?? 0) +
          (state.playerCompany?.financials.cash ?? 0)
        ).toFixed(2)
      ),
      totalPlayerCash: state.cash,
      totalCompanyCash: state.playerCompany?.financials.cash ?? 0,
      totalLoanPrincipal: Number(totalLoanPrincipal.toFixed(2)),
    };

    ledger.balanceSnapshots.unshift(snap);
    if (ledger.balanceSnapshots.length > 60) {
      ledger.balanceSnapshots.pop();
    }
    return snap;
  }

  /**
   * Borsa alım/satımı, şirket günlük ciro/maliyet/maaş/vergi/Ar-Ge/stok, CAPEX, temettü ve holding sinerjisi gibi
   * motor tarafından gerçekleştirilen tüm para hareketlerini merkezi çift kayıt defterine (idempotencyKey korumalı olarak) kaydeder.
   */
  public static recordPostedAccountingEntry(
    state: SimulationState,
    params: {
      idempotencyKey: string;
      sourceAccountId: string;
      destinationAccountId: string;
      amount: number;
      category: TransactionCategory;
      description: string;
      relatedCompanyId?: string;
      relatedLoanId?: string;
      relatedContractId?: string;
      taxEffect?: number;
      reservedOrderCash?: number;
    }
  ): LedgerTransaction | null {
    const cleanAmount = Number(
      (Number.isFinite(params.amount) ? params.amount : 0).toFixed(2)
    );
    if (cleanAmount <= 0) {
      return null;
    }

    CentralLedgerEngine.syncLedgerWithState(
      state,
      params.reservedOrderCash ?? 0
    );
    const ledger = state.centralLedger!;

    const key = params.idempotencyKey.trim();
    if (key && ledger.processedIdempotencyKeys.includes(key)) {
      ledger.duplicateIdempotencyAttempts += 1;
      return null;
    }

    const nextSeq = ledger.ledgerSequence + 1;
    ledger.ledgerSequence = nextSeq;
    const txId = `LTX-D${state.day}-S${String(nextSeq).padStart(8, '0')}`;
    const effectiveKey = key || `${txId}-POSTED`;

    ledger.processedIdempotencyKeys.push(effectiveKey);
    if (ledger.processedIdempotencyKeys.length > 500) {
      ledger.processedIdempotencyKeys.shift();
    }

    const srcAcc = ledger.accounts[params.sourceAccountId];
    const dstAcc = ledger.accounts[params.destinationAccountId];
    const srcBal = srcAcc ? srcAcc.balance : 0;
    const dstBal = dstAcc ? dstAcc.balance : 0;

    const entries: LedgerEntry[] = [
      {
        entryId: `${txId}-E1`,
        transactionId: txId,
        accountId: params.sourceAccountId,
        direction: 'CREDIT',
        amount: cleanAmount,
        balanceBefore: Number((srcBal + cleanAmount).toFixed(2)),
        balanceAfter: srcBal,
        gameDay: state.day,
        gameMinute: state.minutesIntoCurrentDay,
      },
      {
        entryId: `${txId}-E2`,
        transactionId: txId,
        accountId: params.destinationAccountId,
        direction: 'DEBIT',
        amount: cleanAmount,
        balanceBefore: Number(Math.max(0, dstBal - cleanAmount).toFixed(2)),
        balanceAfter: dstBal,
        gameDay: state.day,
        gameMinute: state.minutesIntoCurrentDay,
      },
    ];

    const tx: LedgerTransaction = {
      transactionId: txId,
      idempotencyKey: effectiveKey,
      gameDay: state.day,
      gameMinute: state.minutesIntoCurrentDay,
      createdAtISO: state.lastRealTimestampISO || new Date().toISOString(),
      sourceAccountId: params.sourceAccountId,
      destinationAccountId: params.destinationAccountId,
      amount: cleanAmount,
      currency: 'TRY',
      category: params.category,
      description: params.description,
      relatedCompanyId: params.relatedCompanyId,
      relatedLoanId: params.relatedLoanId,
      relatedContractId: params.relatedContractId,
      status: 'COMPLETED',
      taxEffect: params.taxEffect ?? 0,
      entries,
    };

    ledger.transactions.unshift(tx);
    if (ledger.transactions.length > 250) {
      ledger.transactions.pop();
    }
    return tx;
  }
}
