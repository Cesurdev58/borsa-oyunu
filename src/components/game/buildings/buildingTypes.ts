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
  /** Dükkân/Şirket sekmelerindeki şehir seçicinin seçili şehri (yoksa merkez şehir). */
  viewCityId?: import('../../../models/cities').CityId | null;
  onChangeViewCity?: (cityId: import('../../../models/cities').CityId) => void;
  /** "Ek geliştirmeler" bölümünden bir şehir hizmeti penceresini açar. */
  onOpenCityService?: (id: import('../../../data/cityServices').CityServiceId) => void;
  /** Portföy yöneticisi (borsa otomasyonu, engine/AutoInvestEngine.ts) */
  onHirePortfolioManager?: () => void;
  onConfigureAutoInvest?: (params: { enabled?: boolean; reserve?: number }) => void;
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
  /** İşletme harcamaları için nakit (rezerve emir düşülmüş; kısıtlı işletme kredisi dahil) */
  spendableCash: number;
  /** Genel amaçlı harcamalar (hisse, lüks, şirkete aktarım) için nakit; kısıtlı işletme kredisi düşülmüştür. Yoksa spendableCash. */
  freeSpendableCash?: number;
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
  /** Şehir Mağazaları ekranından gelen "şu dükkânı şu bölümle aç" isteği (nonce her istekte değişir). */
  manageRequest?: { shopId: string; tab?: 'ORDER_PRODUCT' | 'EDIT_PRICES' | 'MANAGE_STAFF' | 'UPGRADE_SHOP'; nonce: number } | null;
  onOpenBuilding?: (id: CityBuildingId) => void;
}
