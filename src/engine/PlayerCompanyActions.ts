/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OYUNCU ŞİRKETİ EYLEMLERİ: kuruluş, sermaye, yatırım projesi, halka arz, devralma
 * (SimulationEngine dosyasından ayrıldı. Fonksiyonlar ilk parametre olarak motoru alır; dış dünya hâlâ SimulationEngine.* üzerinden çağırır.)
 */

import {
  PlayerCompany,
} from '../models/company';
import {
  SectorId,
} from '../models/market';
import {
  IPOExecutionResult,
  TakeoverResult,
} from '../models/simulation';
import {
  AccountId,
  InvestmentPackageType,
  InvestmentProject,
  LedgerTransaction,
  MoneyTransfer,
  TransactionCategory,
} from '../models/finance';
import {
  ACCOUNT_IDS,
  CentralLedgerEngine,
} from './CentralLedgerEngine';
import {
  CompanyEngine,
} from './CompanyEngine';
import {
  IPOEngine,
} from './IPOEngine';
import {
  MergerAcquisitionEngine,
} from './MergerAcquisitionEngine';
import {
  WalletEngine,
} from './WalletEngine';
import type {
  SimulationEngine,
} from './SimulationEngine';

export function establishCompany(engine: SimulationEngine, name: string,
    ticker: string,
    sector: SectorId,
    initialCapital: number,
    options?: {
      initialStaffCount?: number;
      initialRdBudget?: number;
      initialCapacity?: number;
    }): { success: boolean; message: string; company?: PlayerCompany } {
    if (engine.state.playerCompany) {
      return {
        success: false,
        message: 'Zaten kurulmuş bir şirketiniz bulunuyor.',
      };
    }

    const reservedCash = engine.getReservedCash();
    const spendableCash = engine.getSpendableCash();
    const netWorthBefore = engine.state.netWorth;
    const res = CompanyEngine.establishPlayerCompany({
      input: {
        name,
        ticker,
        sector,
        initialCapital,
        initialStaffCount: options?.initialStaffCount,
        initialRdBudget: options?.initialRdBudget,
        initialCapacity: options?.initialCapacity,
      },
      playerCash: spendableCash,
      playerNetWorth: engine.state.netWorth,
      currentDay: engine.state.day,
      existingTickers: engine.state.stocks.map((s) => s.ticker),
      macro: engine.state.macro,
    });

    if (!res.success || !res.company) {
      return { success: false, message: res.message };
    }

    WalletEngine.setBalance(engine.state, res.newPlayerCash + reservedCash);
    engine.state.playerCompany = res.company;
    engine.recalculateFinancialsAndStages();
    engine.pendingDailyActions.push(res.message);

    const foundTxId = engine.recordTransaction({
      type: 'COMPANY_FOUNDING',
      ticker: res.company.ticker,
      grossAmount: initialCapital,
      commission: 0,
      slippageBps: 0,
      cashDelta: -(netWorthBefore - engine.state.cash),
      netWorthBefore,
      netWorthAfter: engine.state.netWorth,
      description: res.message,
    });
    CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
      idempotencyKey: `FOUND-COMPANY-${res.company.ticker}-${foundTxId}`,
      sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      destinationAccountId: ACCOUNT_IDS.companyBank(res.company.ticker),
      amount: initialCapital,
      category: 'CAPITAL_INJECTION',
      description: `${res.company.name} kuruluş sermayesi aktarımı`,
      relatedCompanyId: res.company.ticker,
      reservedOrderCash: engine.getReservedCash(),
    });

    return {
      success: true,
      message: res.message,
      company: res.company,
    };
  }

export function transferCapitalToCompany(engine: SimulationEngine, amount: number): {
    success: boolean;
    message: string;
  } {
    if (!engine.state.playerCompany) {
      return {
        success: false,
        message: 'Aktif bir oyuncu şirketi bulunmuyor.',
      };
    }

    if (engine.state.playerCompany.isPubliclyListed) {
      return {
        success: false,
        message:
          'Halka açık şirketlere doğrudan kişisel sermaye aktarımı yapılamaz; borsadan pay alabilirsiniz.',
      };
    }

    const reservedCash = engine.getReservedCash();
    const spendableCash = engine.getSpendableCash();
    const netWorthBefore = engine.state.netWorth;
    const res = CompanyEngine.injectCapital({
      company: engine.state.playerCompany,
      amount,
      playerCash: spendableCash,
    });

    if (!res.success) {
      return { success: false, message: res.message };
    }

    WalletEngine.setBalance(engine.state, res.newPlayerCash + reservedCash);
    engine.recalculateFinancialsAndStages();
    engine.pendingDailyActions.push(res.message);

    const capTxId = engine.recordTransaction({
      type: 'CAPITAL_INJECTION',
      ticker: engine.state.playerCompany.ticker,
      grossAmount: amount,
      commission: 0,
      slippageBps: 0,
      cashDelta: -amount,
      netWorthBefore,
      netWorthAfter: engine.state.netWorth,
      description: res.message,
    });
    CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
      idempotencyKey: `CAP-INJ-${engine.state.playerCompany.ticker}-${capTxId}`,
      sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      destinationAccountId: ACCOUNT_IDS.companyBank(
        engine.state.playerCompany.ticker
      ),
      amount,
      category: 'CAPITAL_INJECTION',
      description: res.message,
      relatedCompanyId: engine.state.playerCompany.ticker,
      reservedOrderCash: engine.getReservedCash(),
    });

    return { success: true, message: res.message };
  }

export function configureCompanyOperations(engine: SimulationEngine, params: {
    targetStaffCount?: number;
    targetProductionCapacity?: number;
    dailyRdBudget?: number;
    dailyMarketingBudget?: number;
    borrowLoanAmount?: number;
    unitSalePrice?: number;
    unitSellingPrice?: number;
    plannedProductionUnits?: number;
    qualityTarget?: number;
    shiftCount?: 1 | 2 | 3;
    shifts?: 1 | 2 | 3;
    salaryTier?: 'ECONOMY' | 'STANDARD' | 'COMPETITIVE';
    overtimeEnabled?: boolean;
    salaryPolicyMultiplier?: number;
    autoHireEnabled?: boolean;
    maxStorageUnits?: number;
  }): { success: boolean; message: string; capitalSpent: number } {
    if (!engine.state.playerCompany) {
      return {
        success: false,
        message: 'Yönetilecek şirket bulunamadı.',
        capitalSpent: 0,
      };
    }

    const pc = engine.state.playerCompany;
    CompanyEngine.ensureCompanyV5Fields(pc, engine.state.macro);
    const staffBefore = pc.staffCount;
    const capBefore = pc.productionCapacity;
    const netWorthBefore = engine.state.netWorth;

    const res = CompanyEngine.configureOperations(pc, params);
    if (!res.success) {
      return res;
    }

    engine.recalculateFinancialsAndStages();

    const hiredCount = Math.max(0, pc.staffCount - staffBefore);
    const capGain = Math.max(0, pc.productionCapacity - capBefore);

    if (res.capitalSpent > 0) {
      const txDesc =
        hiredCount > 0
          ? `${pc.name}: +${hiredCount} yeni çalışan işe alındı (Toplam: ${pc.staffCount} çalışan)`
          : capGain > 0
          ? `${pc.name}: +${capGain} br/gün üretim tesisi yatırımı`
          : res.message;

      const opsTxId = engine.recordTransaction({
        type: 'CAPITAL_INJECTION',
        ticker: pc.ticker,
        grossAmount: res.capitalSpent,
        commission: 0,
        slippageBps: 0,
        cashDelta: 0,
        netWorthBefore,
        netWorthAfter: engine.state.netWorth,
        description: txDesc,
      });

      CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
        idempotencyKey: `OPS-CFG-${pc.ticker}-${opsTxId}`,
        sourceAccountId: ACCOUNT_IDS.companyBank(pc.ticker),
        destinationAccountId:
          hiredCount > 0 ? ACCOUNT_IDS.PAYROLL_EXPENSE : ACCOUNT_IDS.FIXED_ASSET,
        amount: res.capitalSpent,
        category: hiredCount > 0 ? 'PAYROLL_PAYMENT' : 'CAPEX_INVESTMENT',
        description: txDesc,
        relatedCompanyId: pc.ticker,
        reservedOrderCash: engine.getReservedCash(),
      });
    }

    engine.pendingDailyActions.push(res.message);
    return res;
  }

export function executeMoneyTransfer(engine: SimulationEngine, params: {
    sourceAccountId: AccountId;
    destinationAccountId: AccountId;
    amount: number;
    category: TransactionCategory;
    description: string;
    idempotencyKey?: string;
  }): {
    success: boolean;
    message: string;
    transaction: LedgerTransaction | null;
    rejectedTransfer?: MoneyTransfer;
    netAmountTransferred: number;
    taxWithheld: number;
  } {
    const netWorthBefore = engine.state.netWorth;
    const res = CentralLedgerEngine.executeTransfer(
      engine.state,
      {
        idempotencyKey:
          params.idempotencyKey ||
          `XFER-D${engine.state.day}-M${engine.state.totalElapsedGameMinutes}-${params.sourceAccountId}-${params.destinationAccountId}-${params.amount.toFixed(2)}`,
        sourceAccountId: params.sourceAccountId,
        destinationAccountId: params.destinationAccountId,
        amount: params.amount,
        category: params.category,
        description: params.description,
        relatedCompanyId: engine.state.playerCompany?.ticker,
      },
      engine.getReservedCash()
    );

    engine.recalculateFinancialsAndStages();

    if (res.success && res.transaction) {
      engine.pendingDailyActions.push(res.message);
      engine.recordTransaction({
        type: 'CAPITAL_INJECTION',
        ticker: engine.state.playerCompany?.ticker || 'FINANS',
        grossAmount: params.amount,
        commission: res.taxWithheld,
        slippageBps: 0,
        cashDelta:
          params.destinationAccountId === 'PLAYER_PERSONAL_CASH' ||
          params.destinationAccountId === 'PLAYER_INVESTMENT_CASH'
            ? res.netAmountTransferred
            : params.sourceAccountId === 'PLAYER_PERSONAL_CASH' ||
              params.sourceAccountId === 'PLAYER_INVESTMENT_CASH'
            ? -params.amount
            : 0,
        netWorthBefore,
        netWorthAfter: engine.state.netWorth,
        description: res.message,
      });
    }

    return res;
  }

export function startCompanyInvestmentProject(engine: SimulationEngine, params: {
    packageType: InvestmentPackageType;
    customCapacityGain?: number;
    budgetMaxMode?: boolean;
    fundingSource?: 'COMPANY_CASH' | 'BANK_LOAN';
    facilityLocation?: string;
  }): {
    success: boolean;
    message: string;
    project: InvestmentProject | null;
  } {
    if (!engine.state.playerCompany) {
      return {
        success: false,
        message: 'Yatırım başlatmak için aktif bir şirketiniz olmalıdır.',
        project: null,
      };
    }

    const upcomingLoanInstallments = (engine.state.activeLoans || [])
      .filter(
        (l) =>
          (l.status === 'ACTIVE' || l.status === 'DELINQUENT') &&
          l.borrowerType === 'COMPANY' &&
          l.nextPaymentGameDay - engine.state.day <= 15
      )
      .reduce((sum, l) => sum + l.installmentAmount, 0);

    const nextProjSeq = (engine.state.projectSequence || 0) + 1;

    if (params.fundingSource === 'BANK_LOAN') {
      const quote = CompanyEngine.computeInvestmentProjectQuote(
        engine.state.playerCompany,
        params.packageType,
        {
          customCapacityGain: params.customCapacityGain,
          budgetMaxMode: params.budgetMaxMode,
          upcomingLoanInstallments,
        }
      );
      if (quote.totalCost > engine.state.playerCompany.financials.cash) {
        const neededLoan = Math.ceil(
          quote.totalCost -
            engine.state.playerCompany.financials.cash +
            25_000
        );
        const loanRes = engine.takeOutBankLoan({
          loanType:
            params.packageType === 'NEW_FACTORY'
              ? 'FACTORY_INVESTMENT'
              : 'MACHINE_EQUIPMENT',
          principal: neededLoan,
          termInGameDays: 90,
          idempotencyKey: `INV-LOAN-D${engine.state.day}-P${nextProjSeq}`,
        });
        if (!loanRes.success) {
          return {
            success: false,
            message: `Yatırım kredisi onaylanmadı: ${loanRes.message}`,
            project: null,
          };
        }
      }
    }

    const res = CompanyEngine.startInvestmentProject(engine.state.playerCompany, {
      packageType: params.packageType,
      currentDay: engine.state.day,
      projectSeq: nextProjSeq,
      customCapacityGain: params.customCapacityGain,
      budgetMaxMode: params.budgetMaxMode,
      upcomingLoanInstallments,
      facilityLocation: params.facilityLocation,
    });

    if (res.success && res.project) {
      engine.state.projectSequence = nextProjSeq;
      engine.recalculateFinancialsAndStages();
      engine.pendingDailyActions.push(res.message);
      CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
        idempotencyKey: `CAPEX-${res.project.projectId}`,
        sourceAccountId: ACCOUNT_IDS.companyBank(
          engine.state.playerCompany.ticker
        ),
        destinationAccountId: ACCOUNT_IDS.FIXED_ASSET,
        amount: res.project.totalCost,
        category: 'CAPEX_INVESTMENT',
        description: `${res.project.title} yatırım projesi ödemesi`,
        relatedCompanyId: engine.state.playerCompany.ticker,
        relatedContractId: res.project.projectId,
        reservedOrderCash: engine.getReservedCash(),
      });
    }

    return res;
  }

export function liquidateCompanyInventory(engine: SimulationEngine, unitsToLiquidate: number,
    discountRatio: number = 0.25): {
    success: boolean;
    message: string;
    unitsSold: number;
    cashProceeds: number;
    cashGenerated: number;
  } {
    if (!engine.state.playerCompany) {
      return {
        success: false,
        message: 'Aktif şirket bulunamadı.',
        unitsSold: 0,
        cashProceeds: 0,
        cashGenerated: 0,
      };
    }
    const res = CompanyEngine.liquidateExcessInventory(
      engine.state.playerCompany,
      unitsToLiquidate,
      discountRatio
    );
    if (res.success) {
      engine.recalculateFinancialsAndStages();
      engine.pendingDailyActions.push(res.message);
      CentralLedgerEngine.recordPostedAccountingEntry(engine.state, {
        idempotencyKey: `INV-LIQ-${engine.state.playerCompany.ticker}-D${engine.state.day}-M${engine.state.totalElapsedGameMinutes}-${res.unitsSold}`,
        sourceAccountId: ACCOUNT_IDS.INVENTORY_ASSET,
        destinationAccountId: ACCOUNT_IDS.companyBank(
          engine.state.playerCompany.ticker
        ),
        amount: res.cashProceeds,
        category: 'OPERATING_REVENUE_RECEIPT',
        description: res.message,
        relatedCompanyId: engine.state.playerCompany.ticker,
        reservedOrderCash: engine.getReservedCash(),
      });
    }
    return {
      ...res,
      cashGenerated: res.cashProceeds,
    };
  }

export function executeIPO(engine: SimulationEngine, publicFloatRatio: number = 0.3,
    discountRatio: number = 0.12,
    primaryShareIssueRatio: number = 0.35): IPOExecutionResult {
    if (!engine.state.playerCompany) {
      return {
        success: false,
        message: 'Halka arz edilecek bir şirketiniz bulunmuyor.',
        ticker: '',
        offerPrice: 0,
        priceRangeMin: 0,
        priceRangeMax: 0,
        fairPricePerShare: 0,
        primaryNewSharesIssued: 0,
        secondaryExistingSharesSold: 0,
        offeredShares: 0,
        subscribedShares: 0,
        institutionalDemandShares: 0,
        retailDemandShares: 0,
        oversubscriptionMultiple: 0,
        grossProceeds: 0,
        underwritingFee: 0,
        netProceedsToPlayerCash: 0,
        netProceedsToCompanyTreasury: 0,
        newTotalShares: 0,
        remainingPlayerOwnershipPct: 0,
        firstDayClosingPrice: 0,
        fundParticipations: [],
      };
    }

    const netWorthBefore = engine.state.netWorth;
    const { result, newPlayerCash } = IPOEngine.executeCompanyIPO({
      company: engine.state.playerCompany,
      publicFloatRatio,
      discountRatio,
      primaryShareIssueRatio,
      macro: engine.state.macro,
      stocks: engine.state.stocks,
      funds: engine.state.institutionalFunds,
      portfolio: engine.state.portfolio,
      playerCash: engine.state.cash,
      currentDay: engine.state.day,
    });

    if (!result.success) {
      return result;
    }

    WalletEngine.setBalance(engine.state, newPlayerCash);
    engine.recalculateFinancialsAndStages();
    engine.pendingDailyActions.push(result.message);

    engine.recordTransaction({
      type: 'IPO_PROCEEDS',
      ticker: result.ticker,
      shares: result.subscribedShares,
      executionPrice: result.offerPrice,
      grossAmount: result.grossProceeds,
      commission: result.underwritingFee,
      slippageBps: 0,
      cashDelta: result.netProceedsToPlayerCash,
      netWorthBefore,
      netWorthAfter: engine.state.netWorth,
      description: result.message,
    });

    return result;
  }

export function executeHostileTakeover(engine: SimulationEngine, ticker: string,
    options?: { targetOwnershipPct?: number; useDebtFinancing?: boolean }): TakeoverResult {
    const stock = engine.state.stocks.find((s) => s.ticker === ticker);
    if (!stock) {
      return {
        success: false,
        message: `${ticker} kodlu şirket bulunamadı.`,
        ticker,
        companyName: '',
        previousOwnershipPct: 0,
        newOwnershipPct: 0,
        controlLevelBefore: 'NONE',
        controlLevelAfter: 'NONE',
        sharesAcquiredInTender: 0,
        tenderOfferPrice: 0,
        controlPremiumPct: 0,
        defenseTriggered: false,
        rivalBidOccurred: false,
        rivalBidPremiumPct: 0,
        debtFinancingUsed: 0,
        interestRateOnFinancing: 0,
        integrationCostPaid: 0,
        totalTenderCost: 0,
        estimatedDailySynergyDividend: 0,
      };
    }

    const reservedCash = engine.getReservedCash();
    const spendableCash = engine.getSpendableCash();
    const netWorthBefore = engine.state.netWorth;
    const { result, newPlayerCash, newPlayerLongTermDebt } =
      MergerAcquisitionEngine.executeTakeoverTenderOffer({
        stock,
        targetOwnershipPct: options?.targetOwnershipPct ?? 51.0,
        useDebtFinancing: options?.useDebtFinancing ?? false,
        playerCash: spendableCash,
        playerLongTermDebt: engine.state.longTermDebt,
        portfolio: engine.state.portfolio,
        controlledSubsidiaries: engine.state.controlledSubsidiaries,
        macro: engine.state.macro,
        currentDay: engine.state.day,
        rng: engine.rng,
      });

    if (!result.success) {
      return result;
    }

    WalletEngine.setBalance(engine.state, newPlayerCash + reservedCash);
    engine.state.longTermDebt = newPlayerLongTermDebt;
    engine.recalculateFinancialsAndStages();
    engine.pendingDailyActions.push(result.message);

    engine.recordTransaction({
      type: 'TAKEOVER_TENDER',
      ticker,
      shares: result.sharesAcquiredInTender,
      executionPrice: result.tenderOfferPrice,
      grossAmount: result.totalTenderCost,
      commission: result.integrationCostPaid,
      slippageBps: 0,
      cashDelta: -(result.totalTenderCost - result.debtFinancingUsed),
      netWorthBefore,
      netWorthAfter: engine.state.netWorth,
      description: result.message,
    });

    return result;
  }
