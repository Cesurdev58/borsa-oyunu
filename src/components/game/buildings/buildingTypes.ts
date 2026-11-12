/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SectorId,
} from '../../../models/market';
import {
  IPOEligibilityResult,
  SimulationState,
} from '../../../models/simulation';
import {
  PendingOrderType,
} from '../../../models/transactions';
import {
  CityBuildingId,
} from '../gameTypes';

import {
  AccountId,
  BankLoanType,
  InvestmentPackageType,
  SalaryTier,
  TransactionCategory,
} from '../../../models/finance';
import {
  EsnafAndTradeActionsProps,
} from '../EsnafAndTradePanel';

export interface BuildingDetailActions extends Partial<EsnafAndTradeActionsProps> {
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  onPlaceOrder: (params: {
    ticker: string;
    orderType: PendingOrderType;
    requestedShares: number;
    limitPrice?: number;
  }) => void;
  onCancelOrder: (orderId: string) => void;
  onBuyStock: (ticker: string, shares: number) => void;
  onSellStock: (ticker: string, shares: number) => void;
  onEstablishCompany: (
    name: string,
    ticker: string,
    sector: SectorId,
    initialCapital: number,
    options: {
      initialStaffCount: number;
      initialRdBudget: number;
      initialCapacity: number;
    }
  ) => void;
  onTransferCapital: (amount: number) => void;
  onConfigureOperations: (params: {
    targetStaffCount?: number;
    targetProductionCapacity?: number;
    dailyRdBudget?: number;
    dailyMarketingBudget?: number;
    borrowLoanAmount?: number;
    unitSalePrice?: number;
    unitSellingPrice?: number;
    plannedProductionUnits?: number;
    shiftCount?: 1 | 2 | 3;
    shifts?: 1 | 2 | 3;
    salaryTier?: SalaryTier;
    autoHireEnabled?: boolean;
  }) => void;
  onExecuteIPO: (
    floatRatio: number,
    discountRatio: number,
    primaryRatio: number
  ) => void;
  onExecuteTakeover: (
    ticker: string,
    options: { targetOwnershipPct: number; useDebtFinancing: boolean }
  ) => void;
  onExecuteMoneyTransfer?: (params: {
    sourceAccountId: AccountId;
    destinationAccountId: AccountId;
    amount: number;
    category: TransactionCategory;
    description: string;
  }) => void;
  onTakeOutBankLoan?: (params: {
    loanType: BankLoanType;
    principal: number;
    termInGameDays?: number;
    collateralIds?: string[];
  }) => void;
  onPayLoanInstallment?: (loanId: string) => void;
  onPayOffLoanEarly?: (loanId: string) => void;
  onStartInvestmentProject?: (params: {
    packageType: InvestmentPackageType;
    customCapacityGain?: number;
    budgetMaxMode?: boolean;
    fundingSource?: 'COMPANY_CASH' | 'BANK_LOAN';
  }) => void;
  onCancelInvestmentProject?: (projectId: string) => void;
  onLiquidateInventory?: (units: number, discountRatio: number) => void;
  spendableCash: number;
  reservedCash: number;
  getReservedShares: (ticker: string) => number;
  ipoEligibility: IPOEligibilityResult;
  formattedTime: string;
  formatCurrency: (val: number) => string;
}

export interface BuildingDetailContentProps extends BuildingDetailActions {
  buildingId: CityBuildingId;
  state: SimulationState;
  initialCompanySubTab?: 'OZET' | 'URETIM' | 'CALISANLAR' | 'FINANS' | 'GELISIM';
  onOpenBuilding?: (id: CityBuildingId) => void;
}
