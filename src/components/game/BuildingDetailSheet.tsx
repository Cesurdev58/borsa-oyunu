/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Factory,
  FlaskConical,
  Landmark,
  Lock,
  Newspaper,
  Rocket,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';
import { SECTOR_CONFIGS } from '../../data/sectors';
import { SectorId } from '../../models/market';
import {
  IPOEligibilityResult,
  SimulationStage,
  SimulationState,
} from '../../models/simulation';
import { PendingOrderType } from '../../models/transactions';
import {
  CityBuildingId,
  getMarketSessionBadgeMeta,
} from './gameTypes';
import { deriveDeterministicIpoReasonItems } from './city/questAndHudLogic';

import {
  AccountId,
  BankLoanType,
  InvestmentPackageType,
  SalaryTier,
  TransactionCategory,
} from '../../models/finance';
import {
  ACCOUNT_IDS,
  CentralLedgerEngine,
  TRANSFER_CATEGORY_LABELS_TR,
} from '../../engine/CentralLedgerEngine';
import {
  BankLoanEngine,
  LOAN_TYPE_CATALOG,
} from '../../engine/BankLoanEngine';
import {
  CompanyEngine,
  INVESTMENT_PACKAGE_CATALOG,
} from '../../engine/CompanyEngine';
import { TradeAndShopEngine } from '../../engine/TradeAndShopEngine';
import {
  EsnafAndTradeActionsProps,
  EsnafAndTradePanel,
} from './EsnafAndTradePanel';

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

interface BuildingDetailContentProps extends BuildingDetailActions {
  buildingId: CityBuildingId;
  state: SimulationState;
  initialCompanySubTab?: 'OZET' | 'URETIM' | 'CALISANLAR' | 'FINANS' | 'GELISIM';
  onOpenBuilding?: (id: CityBuildingId) => void;
}

export const BuildingDetailContent: React.FC<BuildingDetailContentProps> = ({
  buildingId,
  state,
  initialCompanySubTab,
  selectedTicker,
  onSelectTicker,
  onPlaceOrder,
  onCancelOrder,
  onBuyStock,
  onSellStock,
  onEstablishCompany,
  onTransferCapital,
  onConfigureOperations,
  onExecuteIPO,
  onExecuteTakeover,
  onExecuteMoneyTransfer,
  onTakeOutBankLoan,
  onPayLoanInstallment,
  onPayOffLoanEarly,
  onStartInvestmentProject,
  onCancelInvestmentProject,
  onLiquidateInventory,
  spendableCash,
  reservedCash,
  getReservedShares,
  ipoEligibility,
  formattedTime,
  formatCurrency,
  onOpenBuilding,
  onOpenShop,
  onUpgradeShopLevel,
  onTransferShopCash,
  onConfigureShop,
  onPlaceProcurementOrder,
  onCancelProcurementOrder,
  onCreatePurchaseContract,
  onExecuteRecipeProduction,
  onPurchaseLogisticsVehicle,
  onDispatchWarehouseToShop,
  onAcceptCommercialContract,
  onDeliverCommercialContract,
  onIncorporateShopsIntoCompany,
}) => {
  // Borsa emir state
  const [sectorFilter, setSectorFilter] = useState<SectorId | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [lotAmount, setLotAmount] = useState<number>(50);
  const [orderMode, setOrderMode] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [limitPriceInput, setLimitPriceInput] = useState<number>(124.5);

  // Şirket kurma ve 5 alt sekme state
  const [compName, setCompName] = useState('Anadolu Kuantum Teknoloji A.Ş.');
  const [compTicker, setCompTicker] = useState('ANKT');
  const [compSector, setCompSector] = useState<SectorId>('TEKNOLOJI');
  const [compCapital, setCompCapital] = useState<number>(800_000);
  const [injectAmount, setInjectAmount] = useState<number>(200_000);
  const [companySubTab, setCompanySubTab] = useState<
    'OZET' | 'URETIM' | 'CALISANLAR' | 'FINANS' | 'GELISIM'
  >(initialCompanySubTab || 'OZET');

  useEffect(() => {
    if (initialCompanySubTab) {
      setCompanySubTab(initialCompanySubTab);
    }
  }, [initialCompanySubTab, buildingId]);

  // Üretim artırma rehberi state
  const [showProductionGuide, setShowProductionGuide] = useState<boolean>(false);
  const [prodGuideTargetMode, setProdGuideTargetMode] = useState<
    '50K' | '100K' | '250K' | 'CAP_25' | 'CAP_50' | 'CUSTOM'
  >('CAP_50');
  const [prodGuideCustomUnits, setProdGuideCustomUnits] = useState<number>(100);

  // Çalışan alımı (İşçi alımı) state
  const [hireCountInput, setHireCountInput] = useState<number>(10);
  const [hireFeedback, setHireFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Finans sekmesi daraltılabilir paneller (Ayrıntılı Rapor varsayılan kapalı)
  const [showDetailedFinanceReport, setShowDetailedFinanceReport] =
    useState<boolean>(false);
  const [showCompanyLoansPanel, setShowCompanyLoansPanel] =
    useState<boolean>(false);
  const [showInlineTransferPanel, setShowInlineTransferPanel] =
    useState<boolean>(false);

  // Finans Merkezi (Para Transferi & Kredi) state
  const [bankTab, setBankTab] = useState<'TRANSFER' | 'LOANS' | 'LEDGER'>('TRANSFER');
  const [xferSource, setXferSource] = useState<AccountId>(
    ACCOUNT_IDS.PLAYER_INVESTMENT
  );
  const [xferDest, setXferDest] = useState<AccountId>(
    ACCOUNT_IDS.PLAYER_PERSONAL
  );
  const [xferCategory, setXferCategory] = useState<TransactionCategory>(
    'INVESTMENT_TO_PERSONAL'
  );
  const [xferAmount, setXferAmount] = useState<number>(25_000);
  const [xferDesc, setXferDesc] = useState<string>(
    'Finans Merkezi hesaplar arası transfer'
  );

  // Banka Kredi Masası state
  const [selectedLoanType, setSelectedLoanType] =
    useState<BankLoanType>('WORKING_CAPITAL');
  const [loanPrincipalInput, setLoanPrincipalInput] =
    useState<number>(250_000);
  const [loanTermDaysInput, setLoanTermDaysInput] = useState<number>(90);

  // Şirket Operasyon, Fiyat, Yatırım state
  const [customSalePrice, setCustomSalePrice] = useState<number>(0);
  const [selectedInvPkg, setSelectedInvPkg] =
    useState<InvestmentPackageType>('SMALL_EXPANSION');
  const [customCapDelta, setCustomCapDelta] = useState<number>(25);
  const [invFundingSource, setInvFundingSource] = useState<
    'COMPANY_CASH' | 'BANK_LOAN'
  >('COMPANY_CASH');

  // Takeover state
  const [takeoverTargetTicker, setTakeoverTargetTicker] =
    useState<string>('KRGO');
  const [useDebtForTakeover, setUseDebtForTakeover] = useState<boolean>(false);

  const selectedStock =
    state.stocks.find((s) => s.ticker === selectedTicker) || state.stocks[0];

  useEffect(() => {
    if (selectedStock) {
      setLimitPriceInput(Number(selectedStock.askPrice.toFixed(2)));
    }
  }, [selectedStock?.ticker]);

  const sessionMeta = getMarketSessionBadgeMeta(state.marketSession);

  // 1. BORSA BİNASI
  if (buildingId === 'BORSA') {
    const filteredStocks = state.stocks.filter((s) => {
      const matchSector =
        sectorFilter === 'ALL' || s.sector === sectorFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.ticker.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q);
      return matchSector && matchSearch;
    });

    const ownedShares = state.portfolio[selectedStock.ticker]?.shares || 0;
    const reservedShares = getReservedShares(selectedStock.ticker);
    const availableSharesToSell = Math.max(0, ownedShares - reservedShares);
    const maxAffordableLots = Math.max(
      0,
      Math.floor(
        spendableCash /
          ((orderMode === 'LIMIT' && limitPriceInput > 0
            ? limitPriceInput
            : selectedStock.askPrice) *
            1.002)
      )
    );

    return (
      <div className="space-y-4 text-xs" data-testid="sheet-content-BORSA">
        {/* Piyasa Seansı ve Bakiye Özeti */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-md border font-semibold ${sessionMeta.bgClass} ${sessionMeta.textClass} ${sessionMeta.borderClass}`}
            >
              {sessionMeta.fullLabel}
            </span>
            <span className="font-mono text-slate-600">
              Saat: {formattedTime}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span className="text-slate-600">
              Kullanılabilir:{' '}
              <strong className="text-emerald-700">
                {formatCurrency(spendableCash)}
              </strong>
            </span>
            <span className="text-slate-600">
              Bloke Rezerv:{' '}
              <strong className="text-amber-700">
                {formatCurrency(reservedCash)}
              </strong>
            </span>
          </div>
        </div>

        {/* Seçili Hisse Emir Verme Kartı */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {selectedStock.ticker}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold">
                  {selectedStock.sector}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 truncate">
                {selectedStock.name}
              </div>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-sm font-bold text-slate-900">
                {selectedStock.price.toFixed(2)} TL
              </div>
              <div className="text-[10px] text-slate-500">
                Alış: {selectedStock.bidPrice.toFixed(2)} · Satış:{' '}
                {selectedStock.askPrice.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Emir Modu Seçimi (Limit vs Piyasa) */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-white rounded-xl border border-slate-200">
            <button
              type="button"
              data-testid="tycoon-order-mode-limit"
              onClick={() => setOrderMode('LIMIT')}
              className={`min-h-[40px] rounded-lg font-semibold transition-colors ${
                orderMode === 'LIMIT'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Limit Emir
            </button>
            <button
              type="button"
              data-testid="tycoon-order-mode-market"
              onClick={() => setOrderMode('MARKET')}
              className={`min-h-[40px] rounded-lg font-semibold transition-colors ${
                orderMode === 'MARKET'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Piyasa Emri
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="tycoon-lot-input"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Miktar (Lot) · Maks: {maxAffordableLots}
              </label>
              <input
                id="tycoon-lot-input"
                data-testid="tycoon-lot-input"
                type="number"
                min={1}
                step={1}
                value={lotAmount}
                onChange={(e) =>
                  setLotAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                }
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 font-mono text-slate-900 text-xs"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {[10, 50, 100, 250].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLotAmount(preset)}
                    className="min-h-[32px] px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700 hover:bg-slate-100"
                  >
                    {preset} Lot
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setLotAmount(Math.max(1, maxAffordableLots))
                  }
                  className="min-h-[32px] px-2 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-semibold"
                >
                  Maks Al
                </button>
              </div>
            </div>

            {orderMode === 'LIMIT' ? (
              <div>
                <label
                  htmlFor="tycoon-limit-price-input"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Limit Fiyatı (TL)
                </label>
                <input
                  id="tycoon-limit-price-input"
                  data-testid="tycoon-limit-price-input"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={limitPriceInput}
                  onChange={(e) =>
                    setLimitPriceInput(
                      Math.max(0.1, Number(e.target.value) || 0.1)
                    )
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 font-mono text-slate-900 text-xs"
                />
                <div className="text-[10px] text-slate-500 mt-1.5">
                  Portföyde kullanılabilir: {availableSharesToSell} lot (Bloke:{' '}
                  {reservedShares})
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-center p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600">
                <div>
                  Piyasa açıkken anında aktif fiyattan gerçekleşir; kapalıyken saat
                  10:00 açılışını bekler.
                </div>
                <div className="mt-1 font-mono text-slate-800">
                  Mevcut Lot: {availableSharesToSell} lot
                </div>
              </div>
            )}
          </div>

          {/* Emir Aksiyon Butonları */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="tycoon-place-buy-order-btn"
              onClick={() =>
                onPlaceOrder({
                  ticker: selectedStock.ticker,
                  orderType:
                    orderMode === 'LIMIT' ? 'LIMIT_BUY' : 'MARKET_BUY',
                  requestedShares: lotAmount,
                  limitPrice:
                    orderMode === 'LIMIT' ? limitPriceInput : undefined,
                })
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
            >
              {orderMode === 'LIMIT' ? 'Limit Alış Emri Ver' : 'Piyasa Alış Emri Ver'} (
              {selectedStock.ticker})
            </button>

            <button
              type="button"
              data-testid="tycoon-place-sell-order-btn"
              disabled={availableSharesToSell <= 0}
              onClick={() =>
                onPlaceOrder({
                  ticker: selectedStock.ticker,
                  orderType:
                    orderMode === 'LIMIT' ? 'LIMIT_SELL' : 'MARKET_SELL',
                  requestedShares: Math.min(lotAmount, availableSharesToSell),
                  limitPrice:
                    orderMode === 'LIMIT' ? limitPriceInput : undefined,
                })
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition-colors"
            >
              {orderMode === 'LIMIT'
                ? 'Limit Satış Emri Ver'
                : 'Piyasa Satış Emri Ver'}{' '}
              ({selectedStock.ticker})
            </button>
          </div>

          {/* Hızlı Doğrudan Al / Sat Butonları */}
          <div className="pt-2 border-t border-emerald-200/70 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-600">
              Anında Doğrudan İşlem:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onBuyStock(selectedStock.ticker, lotAmount)}
                className="min-h-[38px] px-3 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-[11px]"
              >
                Anında Al ({lotAmount} Lot)
              </button>
              <button
                type="button"
                disabled={availableSharesToSell <= 0}
                onClick={() =>
                  onSellStock(
                    selectedStock.ticker,
                    Math.min(lotAmount, availableSharesToSell)
                  )
                }
                className="min-h-[38px] px-3 py-1 rounded-lg bg-white hover:bg-rose-50 disabled:opacity-50 text-rose-800 border border-rose-300 font-semibold text-[11px]"
              >
                Anında Sat
              </button>
            </div>
          </div>
        </div>

        {/* Açık ve Gerçekleşen Emirler Listesi */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">
              Emir Defteri ({state.pendingOrders.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Bloke Nakit: {formatCurrency(reservedCash)}
            </span>
          </div>

          {state.pendingOrders.length === 0 ? (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-center">
              Henüz oluşturulmuş bir emir bulunmuyor.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {state.pendingOrders.slice(0, 15).map((ord) => (
                <div
                  key={ord.id}
                  data-testid={`tycoon-order-row-${ord.id}`}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900">
                        {ord.ticker}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                        {ord.orderType}
                      </span>
                      <span
                        data-testid={`tycoon-order-status-${ord.id}`}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          ord.status === 'FILLED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.status === 'PENDING' ||
                              ord.status === 'PARTIALLY_FILLED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                      {ord.requestedShares} lot
                      {ord.limitPrice
                        ? ` · Limit: ${ord.limitPrice.toFixed(2)} TL`
                        : ''}
                      {ord.averageExecutionPrice > 0
                        ? ` · Gerç: ${ord.averageExecutionPrice.toFixed(2)} TL`
                        : ''}
                      {ord.reservedCash > 0
                        ? ` · Rezerv: ${formatCurrency(ord.reservedCash)}`
                        : ''}
                    </div>
                  </div>

                  {(ord.status === 'PENDING' ||
                    ord.status === 'PARTIALLY_FILLED') && (
                    <button
                      type="button"
                      onClick={() => onCancelOrder(ord.id)}
                      className="min-h-[38px] px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[11px] shrink-0"
                    >
                      İptal Et
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hisse Senedi Listesi (Mobil Kart Düzeni - Yatay Taşmasız) */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-900">
              Borsa Şirketleri ({filteredStocks.length})
            </h3>
            <input
              type="search"
              placeholder="Hisse veya şirket ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-[38px] px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSectorFilter('ALL')}
              className={`min-h-[36px] px-2.5 py-1 rounded-xl text-[11px] font-semibold shrink-0 ${
                sectorFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              Tümü ({state.stocks.length})
            </button>
            {(Object.keys(SECTOR_CONFIGS) as SectorId[]).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setSectorFilter(sec)}
                className={`min-h-[36px] px-2.5 py-1 rounded-xl text-[11px] font-semibold shrink-0 ${
                  sectorFilter === sec
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {SECTOR_CONFIGS[sec].name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredStocks.map((st) => {
              const dailyPct =
                st.previousPrice > 0
                  ? ((st.price - st.previousPrice) / st.previousPrice) * 100
                  : 0;
              const isSelected = st.ticker === selectedStock.ticker;
              const myLots = state.portfolio[st.ticker]?.shares || 0;

              return (
                <button
                  key={st.ticker}
                  type="button"
                  onClick={() => onSelectTicker(st.ticker)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 min-h-[64px] ${
                    isSelected
                      ? 'bg-emerald-50/80 border-emerald-400 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {st.ticker}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        · {st.sector}
                      </span>
                      {myLots > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-mono font-semibold">
                          {myLots} lot
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">
                      {st.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Adil Değer: {st.fundamentalPrice.toFixed(2)} TL · Pay: %
                      {st.playerOwnershipPct.toFixed(2)}
                    </div>
                  </div>

                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-xs font-bold text-slate-900">
                      {st.price.toFixed(2)} TL
                    </div>
                    <div
                      className={`text-[11px] font-semibold ${
                        dailyPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {dailyPct >= 0 ? '+' : ''}
                      {dailyPct.toFixed(2)}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 2. BANKA & FİNANS MERKEZİ BİNASI (Aşama 2, 3 ve 7)
  if (buildingId === 'BANKA') {
    const pc = state.playerCompany;
    const ledgerAccounts = state.centralLedger
      ? Object.values(state.centralLedger.accounts).filter(
          (a) =>
            a.ownerType === 'PLAYER' ||
            a.ownerType === 'COMPANY' ||
            a.ownerType === 'HOLDING'
        )
      : [];

    const safeMaxInfo = CentralLedgerEngine.computeMaxSafeTransferAmount(
      state,
      xferSource,
      reservedCash
    );
    const estTaxRate =
      xferCategory === 'LEGAL_DIVIDEND'
        ? 0.1
        : xferCategory === 'EXECUTIVE_SALARY' || xferCategory === 'BOARD_FEE'
        ? 0.15
        : xferCategory === 'CAPITAL_REDUCTION'
        ? 0.05
        : 0;
    const estTaxAmount = Number((xferAmount * estTaxRate).toFixed(2));
    const estNetAmount = Number((xferAmount - estTaxAmount).toFixed(2));

    const loanQuote = BankLoanEngine.computeLoanOfferQuote(state, {
      loanType: selectedLoanType,
      requestedPrincipal: loanPrincipalInput,
      customTermDays: loanTermDaysInput,
    });

    const activeLoansList = (state.activeLoans ?? []).filter(
      (l) => l.status !== 'PAID_OFF'
    );

    return (
      <div className="space-y-4 text-xs" data-testid="sheet-content-BANKA">
        {/* Hesap Bakiyeleri Üst Özeti */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums">
          <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="text-[10px] text-emerald-800 font-sans font-semibold">
              Yatırım Hesabı (Serbest)
            </div>
            <div className="text-sm font-bold text-emerald-950 mt-0.5">
              {formatCurrency(spendableCash)}
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">
              Bloke: {formatCurrency(reservedCash)}
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-sky-50/70 border border-sky-200">
            <div className="text-[10px] text-sky-800 font-sans font-semibold">
              Kişisel Nakit Hesabı
            </div>
            <div className="text-sm font-bold text-sky-950 mt-0.5">
              {formatCurrency(state.personalCash || 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Holding: {formatCurrency(state.holdingCash || 0)}
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-teal-50/70 border border-teal-200">
            <div className="text-[10px] text-teal-800 font-sans font-semibold">
              Şirket Banka + Kasa
            </div>
            <div className="text-sm font-bold text-teal-950 mt-0.5">
              {formatCurrency(pc ? pc.financials.cash : 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {pc ? pc.ticker : 'Şirket Yok'}
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-rose-50/70 border border-rose-200">
            <div className="text-[10px] text-rose-800 font-sans font-semibold">
              Toplam Borç & Kredi Notu
            </div>
            <div className="text-sm font-bold text-rose-950 mt-0.5">
              {formatCurrency(
                state.totalDebt + (pc ? pc.financials.totalLiabilities : 0)
              )}
            </div>
            <div className="text-[10px] text-slate-700 mt-0.5">
              Kredi Notu: <strong>{loanQuote.creditScore}</strong> / 900
            </div>
          </div>
        </div>

        {/* Finans Merkezi Alt Sekmeleri */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          {(
            [
              { id: 'TRANSFER', label: 'Finans Merkezi (Para Transferi)' },
              {
                id: 'LOANS',
                label: `Banka Kredileri (${activeLoansList.length} Aktif)`,
              },
              { id: 'LEDGER', label: 'Hesaplar & Makro Faiz' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`bank-tab-${t.id}`}
              onClick={() => setBankTab(t.id)}
              className={`flex-1 min-h-[38px] px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors ${
                bankTab === t.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 1. PARA TRANSFERİ EKRANI (Aşama 3) */}
        {bankTab === 'TRANSFER' && (
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                Çift Kayıtlı Para Transfer Merkezi
              </h3>
              <span className="text-[11px] font-mono text-emerald-700">
                Güvenli Maks: {formatCurrency(safeMaxInfo.maxSafeTransferable)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Kaynak Hesap
                </label>
                <select
                  data-testid="xfer-source-select"
                  value={xferSource}
                  onChange={(e) => setXferSource(e.target.value)}
                  className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-semibold"
                >
                  {ledgerAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Hedef Hesap
                </label>
                <select
                  data-testid="xfer-dest-select"
                  value={xferDest}
                  onChange={(e) => setXferDest(e.target.value)}
                  className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-semibold"
                >
                  {ledgerAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  İşlem Kategorisi (Hukuki & Muhasebe Nedeni)
                </label>
                <select
                  data-testid="xfer-category-select"
                  value={xferCategory}
                  onChange={(e) =>
                    setXferCategory(e.target.value as TransactionCategory)
                  }
                  className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900"
                >
                  {(
                    Object.keys(
                      TRANSFER_CATEGORY_LABELS_TR
                    ) as TransactionCategory[]
                  ).map((cat) => (
                    <option key={cat} value={cat}>
                      {TRANSFER_CATEGORY_LABELS_TR[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Transfer Tutarı (TL)
                </label>
                <input
                  data-testid="xfer-amount-input"
                  type="number"
                  min={100}
                  step={5_000}
                  value={xferAmount}
                  onChange={(e) =>
                    setXferAmount(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 border border-slate-300 font-mono text-slate-900"
                />
              </div>
            </div>

            {/* Hızlı Tutar Yüzde Butonları (%10, %25, %50, %75, Maksimum) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500 mr-1">
                Güvenli Oran:
              </span>
              {[
                { label: '%10', ratio: 0.1 },
                { label: '%25', ratio: 0.25 },
                { label: '%50', ratio: 0.5 },
                { label: '%75', ratio: 0.75 },
                { label: 'Maksimum', ratio: 1.0 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() =>
                    setXferAmount(
                      Math.max(
                        0,
                        Math.floor(safeMaxInfo.maxSafeTransferable * btn.ratio)
                      )
                    )
                  }
                  className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-[11px] font-semibold"
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Vergi, Tampon ve İşlem Sonrası Bakiye Önizlemesi */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div>
                <div className="text-slate-500">Kaynak Ham Bakiye</div>
                <div className="font-bold text-slate-900">
                  {formatCurrency(safeMaxInfo.rawBalance)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Korunan Tampon/Bloke</div>
                <div className="font-bold text-amber-800">
                  {formatCurrency(
                    safeMaxInfo.reservedAmount +
                      safeMaxInfo.minWorkingCapitalBuffer +
                      safeMaxInfo.upcomingLoanInstallment
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Vergi / Stopaj Kesintisi</div>
                <div className="font-bold text-rose-700">
                  {formatCurrency(estTaxAmount)} (%{(estTaxRate * 100).toFixed(0)})
                </div>
              </div>
              <div>
                <div className="text-slate-500">Hedefe Geçecek Net</div>
                <div className="font-bold text-emerald-700">
                  {formatCurrency(estNetAmount)}
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="execute-money-transfer-btn"
              onClick={() => {
                if (onExecuteMoneyTransfer) {
                  onExecuteMoneyTransfer({
                    sourceAccountId: xferSource,
                    destinationAccountId: xferDest,
                    amount: xferAmount,
                    category: xferCategory,
                    description: xferDesc,
                  });
                } else if (
                  xferCategory === 'CAPITAL_INCREASE' &&
                  pc
                ) {
                  onTransferCapital(xferAmount);
                }
              }}
              className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Transferi Onayla ({formatCurrency(xferAmount)})
            </button>
          </div>
        )}

        {/* 2. BANKA VE KREDİ MASASI EKRANI (Aşama 7) */}
        {bankTab === 'LOANS' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">
                  Kurumsal & Yatırım Kredisi Başvurusu
                </h3>
                <span
                  className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                    loanQuote.approved
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {loanQuote.approved ? 'ONAYLANABİLİR' : 'LİMİT / KOŞUL DIŞI'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Kredi Türü (6 Ürün)
                  </label>
                  <select
                    data-testid="loan-type-select"
                    value={selectedLoanType}
                    onChange={(e) =>
                      setSelectedLoanType(e.target.value as BankLoanType)
                    }
                    className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-semibold"
                  >
                    {(Object.keys(LOAN_TYPE_CATALOG) as BankLoanType[]).map(
                      (lt) => (
                        <option key={lt} value={lt}>
                          {LOAN_TYPE_CATALOG[lt].labelTR}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Talep Edilen Anapara (Maks:{' '}
                    {formatCurrency(loanQuote.maxEligibleAmount)})
                  </label>
                  <input
                    data-testid="loan-principal-input"
                    type="number"
                    min={25_000}
                    step={25_000}
                    value={loanPrincipalInput}
                    onChange={(e) =>
                      setLoanPrincipalInput(
                        Math.max(10_000, Number(e.target.value) || 10_000)
                      )
                    }
                    className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 border border-slate-300 font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Vade (Oyun Günü)
                  </label>
                  <select
                    value={loanTermDaysInput}
                    onChange={(e) =>
                      setLoanTermDaysInput(Number(e.target.value))
                    }
                    className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono text-slate-900"
                  >
                    {[60, 90, 120, 180, 360].map((d) => (
                      <option key={d} value={d}>
                        {d} İş Günü
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div>
                  <div className="text-slate-500">Yıllık / Efektif Faiz</div>
                  <div className="font-bold text-slate-900">
                    %{(loanQuote.annualInterestRate * 100).toFixed(1)} / %
                    {(loanQuote.effectiveInterestRate * 100).toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">
                    Taksit ({loanQuote.installmentFrequency} günde bir)
                  </div>
                  <div className="font-bold text-slate-900">
                    {formatCurrency(loanQuote.installmentAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">
                    Toplam Geri Ödeme & Masraf
                  </div>
                  <div className="font-bold text-rose-800">
                    {formatCurrency(loanQuote.totalRepayment)} (Masraf:{' '}
                    {formatCurrency(loanQuote.originationFee)})
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">
                    Borç/Özkaynak & Risk
                  </div>
                  <div className="font-bold text-indigo-900">
                    {loanQuote.postLoanDebtToEquity}x · {loanQuote.riskLevel}
                  </div>
                </div>
              </div>

              {!loanQuote.approved && loanQuote.rejectionReason && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                  {loanQuote.rejectionReason}
                </div>
              )}

              <button
                type="button"
                data-testid="take-out-loan-btn"
                disabled={!loanQuote.approved}
                onClick={() => {
                  if (onTakeOutBankLoan) {
                    onTakeOutBankLoan({
                      loanType: selectedLoanType,
                      principal: loanPrincipalInput,
                      termInGameDays: loanTermDaysInput,
                    });
                  }
                }}
                className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs"
              >
                Kredi Sözleşmesini Onayla ve Nakdi Hesaba Aktar (
                {formatCurrency(loanPrincipalInput)})
              </button>
            </div>

            {/* Aktif Krediler ve Ödeme Yönetimi */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">
                Aktif Banka Kredi Sözleşmeleri ({activeLoansList.length})
              </h4>
              {activeLoansList.length === 0 ? (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-center">
                  Aktif banka krediniz bulunmuyor.
                </div>
              ) : (
                activeLoansList.map((loan) => (
                  <div
                    key={loan.loanId}
                    data-testid={`active-loan-row-${loan.loanId}`}
                    className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-slate-900">
                          {loan.loanId}
                        </span>{' '}
                        <span className="text-slate-600">
                          · {LOAN_TYPE_CATALOG[loan.loanType].labelTR}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          loan.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {loan.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-500">Kalan Anapara:</span>{' '}
                        <strong>{formatCurrency(loan.remainingPrincipal)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Biriken Faiz:</span>{' '}
                        <strong>
                          {formatCurrency(loan.accruedInterestUnpaid)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Taksit Tutarı:</span>{' '}
                        <strong>{formatCurrency(loan.installmentAmount)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Sıradaki Ödeme:</span>{' '}
                        <strong>Gün {loan.nextPaymentGameDay}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onPayLoanInstallment &&
                          onPayLoanInstallment(loan.loanId)
                        }
                        className="flex-1 min-h-[38px] px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                      >
                        Taksit Öde ({formatCurrency(loan.installmentAmount)})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onPayOffLoanEarly && onPayOffLoanEarly(loan.loanId)
                        }
                        className="flex-1 min-h-[38px] px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px]"
                      >
                        Erken Kapat (Teminatı Çöz)
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. HESAPLAR VE MAKRO GÖSTERGELER */}
        {bankTab === 'LEDGER' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900">
                Makroekonomik Gösterge Paneli
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                <div>
                  <span className="text-slate-500 text-[11px]">
                    Politika Faizi
                  </span>
                  <div className="font-bold text-slate-900">
                    %{(state.macro.policyInterestRate * 100).toFixed(1)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">
                    Yıllık Enflasyon
                  </span>
                  <div className="font-bold text-slate-900">
                    %{(state.macro.inflationRate * 100).toFixed(1)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">GSYH Büyüme</span>
                  <div className="font-bold text-emerald-700">
                    %{(state.macro.gdpGrowthRate * 100).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Konjonktür</span>
                  <div className="font-bold text-indigo-700">
                    {state.macro.cyclePhase}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="font-bold text-slate-900">
                Merkezi Muhasebe Hesap Bakiyeleri ({ledgerAccounts.length})
              </h4>
              {ledgerAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between font-mono text-[11px]"
                >
                  <div>
                    <div className="font-bold text-slate-900 font-sans">
                      {acc.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {acc.id} · {acc.ownerType}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">
                      {formatCurrency(acc.balance)}
                    </div>
                    {acc.reservedBalance > 0 && (
                      <div className="text-[10px] text-amber-700">
                        Bloke: {formatCurrency(acc.reservedBalance)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. HABER MERKEZİ
  if (buildingId === 'HABER_MERKEZI') {
    return (
      <div
        className="space-y-3 text-xs"
        data-testid="sheet-content-HABER_MERKEZI"
      >
        <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-amber-950">
              Dinamik Haber Akışı & Duyarlılık Sönümlenmesi
            </div>
            <div className="text-[11px] text-amber-800">
              Her haberin fiyat etkisi yaşlandıkça üstel olarak azalır: I(yaş) =
              I₀ · e^(-λ·yaş)
            </div>
          </div>
          <span className="font-mono font-bold text-amber-900 shrink-0">
            {state.newsFeed.length} Haber
          </span>
        </div>

        <div className="space-y-2">
          {state.newsFeed.map((news) => {
            const ageDays = Math.max(0, state.day - news.day);
            const currentImpactPct = news.sentimentImpact * 100;
            const initialImpactPct = news.initialImpact * 100;
            return (
              <div
                key={news.id}
                className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-bold text-slate-900">
                      Gün {news.day}
                    </span>
                    <span>·</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                      Sektör: {news.sector}
                    </span>
                    {news.targetTicker && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 font-bold">
                        {news.targetTicker}
                      </span>
                    )}
                    <span>·</span>
                    <span className="text-slate-500">Yaş: {ageDays} gün</span>
                  </div>

                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded ${
                      currentImpactPct >= 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    Güncel Etki: {currentImpactPct >= 0 ? '+' : ''}
                    {currentImpactPct.toFixed(2)}% (İlk:{' '}
                    {initialImpactPct >= 0 ? '+' : ''}
                    {initialImpactPct.toFixed(2)}%)
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 text-xs">
                  {news.headline}
                </h4>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {news.summary}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 4. OYUNCU OFİSİ, ESNAF DÜKKÂNLARI, TİCARET MERKEZİ VE PORTFÖY SEKMESİ
  if (buildingId === 'OYUNCU_OFISI') {
    const positions = Object.values(state.portfolio).filter(
      (p) => p.shares > 0
    );
    const nonIncorpShopEquity =
      TradeAndShopEngine.computeNonIncorporatedShopsEquity(state);
    const privateCompanyEquity = Number(
      (
        (state.playerCompany && !state.playerCompany.isPubliclyListed
          ? state.playerCompany.equityValue
          : 0) + nonIncorpShopEquity
      ).toFixed(2)
    );

    return (
      <div
        className="space-y-4 text-xs"
        data-testid="sheet-content-OYUNCU_OFISI"
      >
        {/* Esnaf, Dükkânlar, Ticaret Merkezi ve Şirketleşme Paneli */}
        {onOpenShop &&
          onUpgradeShopLevel &&
          onTransferShopCash &&
          onConfigureShop &&
          onPlaceProcurementOrder &&
          onCancelProcurementOrder &&
          onCreatePurchaseContract &&
          onExecuteRecipeProduction &&
          onPurchaseLogisticsVehicle &&
          onDispatchWarehouseToShop &&
          onAcceptCommercialContract &&
          onDeliverCommercialContract &&
          onIncorporateShopsIntoCompany && (
            <EsnafAndTradePanel
              state={state}
              spendableCash={spendableCash}
              formatCurrency={formatCurrency}
              initialSection="SHOPS"
              onOpenShop={onOpenShop}
              onUpgradeShopLevel={onUpgradeShopLevel}
              onTransferShopCash={onTransferShopCash}
              onConfigureShop={onConfigureShop}
              onPlaceProcurementOrder={onPlaceProcurementOrder}
              onCancelProcurementOrder={onCancelProcurementOrder}
              onCreatePurchaseContract={onCreatePurchaseContract}
              onExecuteRecipeProduction={onExecuteRecipeProduction}
              onPurchaseLogisticsVehicle={onPurchaseLogisticsVehicle}
              onDispatchWarehouseToShop={onDispatchWarehouseToShop}
              onAcceptCommercialContract={onAcceptCommercialContract}
              onDeliverCommercialContract={onDeliverCommercialContract}
              onIncorporateShopsIntoCompany={onIncorporateShopsIntoCompany}
            />
          )}

        {/* Net Varlık Denklemi Özeti */}
        <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sky-950">
              Toplam Net Varlık Bilançosu
            </span>
            <span className="text-base font-bold font-mono tabular-nums text-emerald-700">
              {formatCurrency(state.netWorth)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-mono tabular-nums">
            <div className="p-2 rounded-xl bg-white border border-slate-200">
              <div className="text-slate-500">Nakit</div>
              <div className="font-bold text-slate-900">
                {formatCurrency(state.cash)}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-white border border-slate-200">
              <div className="text-slate-500">Portföy Değeri</div>
              <div className="font-bold text-sky-700">
                {formatCurrency(state.portfolioValue)}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-white border border-slate-200">
              <div className="text-slate-500">İşletme & Şirket</div>
              <div className="font-bold text-teal-700">
                {formatCurrency(privateCompanyEquity)}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-white border border-slate-200">
              <div className="text-slate-500">Temettü + Sinerji</div>
              <div className="font-bold text-amber-700">
                {formatCurrency(
                  state.totalDividendsEarned + state.totalSynergyEarned
                )}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-white border border-slate-200 col-span-2 sm:col-span-1">
              <div className="text-slate-500">Toplam Borç (-)</div>
              <div className="font-bold text-rose-700">
                {formatCurrency(state.totalDebt)}
              </div>
            </div>
          </div>
        </div>

        {/* 4 Aşama İlerleme Kartları */}
        <div className="space-y-1.5">
          <h3 className="font-bold text-slate-900">
            Simülasyon Aşama İlerlemesi (Mevcut: Aşama {state.stage})
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                stage: SimulationStage.STAGE_1_RETAIL_INVESTOR,
                title: '1. Bireysel Yatırımcı',
                unlocked: state.stageUnlocks.stage1Retail,
                req: '100.000 TL Başlangıç',
              },
              {
                stage: SimulationStage.STAGE_2_ENTREPRENEUR,
                title: '2. Girişimci',
                unlocked: state.stageUnlocks.stage2Entrepreneur,
                req: '2.000.000 TL Net Varlık',
              },
              {
                stage: SimulationStage.STAGE_3_IPO_PUBLIC,
                title: '3. Halka Arz (IPO)',
                unlocked: state.stageUnlocks.stage3Ipo,
                req: 'Şirket Ciro & Yönetişim Şartı',
              },
              {
                stage: SimulationStage.STAGE_4_HOLDING_MONOPOLY,
                title: '4. Holding & Tekel',
                unlocked: state.stageUnlocks.stage4Holding,
                req: '%5+ Pay veya %51+ Devralma',
              },
            ].map((item) => (
              <div
                key={item.stage}
                className={`p-2.5 rounded-xl border ${
                  item.unlocked
                    ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>{item.title}</span>
                  <span className="text-[10px] font-mono">
                    {item.unlocked ? 'AÇIK' : 'KİLİTLİ'}
                  </span>
                </div>
                <div className="text-[10px] mt-0.5 opacity-80">{item.req}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Açık Portföy Pozisyonları */}
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900">
            Hisse Senedi Portföyü ({positions.length} Pozisyon)
          </h3>
          {positions.length === 0 ? (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-center">
              Portföyünüzde henüz hisse senedi bulunmuyor.
            </div>
          ) : (
            <div className="space-y-2">
              {positions.map((pos) => {
                const st = state.stocks.find((s) => s.ticker === pos.ticker);
                const curPrice = st ? st.price : pos.averageCost;
                const mktVal = pos.shares * curPrice;
                const costVal = pos.shares * pos.averageCost;
                const pnl = mktVal - costVal;
                return (
                  <div
                    key={pos.ticker}
                    data-testid={`portfolio-pos-${pos.ticker}`}
                    className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900">
                        {pos.ticker} · {pos.shares} Lot
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Ort. Maliyet: {pos.averageCost.toFixed(2)} TL · Güncel:{' '}
                        {curPrice.toFixed(2)} TL
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-bold text-slate-900">
                        {formatCurrency(mktVal)}
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {pnl >= 0 ? '+' : ''}
                        {formatCurrency(pnl)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Son İşlem Geçmişi */}
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900">
            Son İşlem Geçmişi ({state.transactions.length})
          </h3>
          {state.transactions.length === 0 ? (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-center">
              Henüz gerçekleşmiş işlem bulunmuyor.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {state.transactions.slice(0, 20).map((tx) => (
                <div
                  key={tx.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {tx.description}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      Gün {tx.day} · {tx.type}
                    </div>
                  </div>
                  <span
                    className={`font-mono font-bold shrink-0 ${
                      tx.cashDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {tx.cashDelta >= 0 ? '+' : ''}
                    {formatCurrency(tx.cashDelta)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. ŞİRKET ARSASI / ŞİRKET MERKEZİ
  if (buildingId === 'SIRKET_MERKEZI') {
    const isStage2Unlocked =
      state.stageUnlocks.stage2Entrepreneur || state.playerCompany !== null;
    const pc = state.playerCompany;

    if (!isStage2Unlocked && !pc) {
      const progressPct = Math.min(
        100,
        Math.floor((state.netWorth / 2_000_000) * 100)
      );
      const remainingNeeded = Math.max(0, 2_000_000 - state.netWorth);
      return (
        <div
          className="space-y-4 text-xs"
          data-testid="sheet-content-SIRKET_MERKEZI-locked"
        >
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Şirket Arsası Kilitli (Aşama 2: Girişimci)
                </h3>
                <p className="text-slate-600">
                  Açılma Koşulu: Toplam Net Varlık ≥ ₺2.000.000
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[11px]">
                <span>Mevcut: {formatCurrency(state.netWorth)}</span>
                <span>Hedef: ₺2.000.000 (%{progressPct})</span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-600">
                Kalan Gereksinim:{' '}
                <strong className="font-mono text-slate-900">
                  {formatCurrency(remainingNeeded)}
                </strong>
              </div>
            </div>

            {onOpenBuilding && (
              <button
                type="button"
                onClick={() => onOpenBuilding('BORSA')}
                className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Borsa Binasına Git ve Portföyünü Büyüt
              </button>
            )}
          </div>
        </div>
      );
    }

    if (!pc) {
      return (
        <div
          className="space-y-4 text-xs"
          data-testid="sheet-content-SIRKET_MERKEZI-founding"
        >
          <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-3">
            <h3 className="text-sm font-bold text-teal-950">
              Yeni Şirket Kurulumu (Çift Kayıt Sermaye Enjeksiyonu)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Şirket Unvanı
                </label>
                <input
                  type="text"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Borsa Kodu (Ticker)
                </label>
                <input
                  type="text"
                  maxLength={5}
                  value={compTicker}
                  onChange={(e) => setCompTicker(e.target.value.toUpperCase())}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 font-mono text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Sektör
                </label>
                <select
                  value={compSector}
                  onChange={(e) => setCompSector(e.target.value as SectorId)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 text-slate-900"
                >
                  {(Object.keys(SECTOR_CONFIGS) as SectorId[]).map((s) => (
                    <option key={s} value={s}>
                      {SECTOR_CONFIGS[s].name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Başlangıç Sermayesi (Min 400.000 TL)
                </label>
                <input
                  type="number"
                  min={400_000}
                  step={50_000}
                  value={compCapital}
                  onChange={(e) =>
                    setCompCapital(Math.max(400_000, Number(e.target.value) || 400_000))
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 font-mono text-slate-900"
                />
              </div>
            </div>

            <button
              type="button"
              data-testid="tycoon-establish-company-btn"
              onClick={() =>
                onEstablishCompany(
                  compName,
                  compTicker,
                  compSector,
                  compCapital,
                  {
                    initialStaffCount: 25,
                    initialCapacity: 40,
                    initialRdBudget: 15_000,
                  }
                )
              }
              className="w-full min-h-[44px] rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs"
            >
              Şirketi Kur ({formatCurrency(compCapital)})
            </button>
          </div>
        </div>
      );
    }

    if (!pc.operations || !pc.workforcePlan) {
      CompanyEngine.ensureCompanyV5Fields(pc, state.macro);
    }
    const ops = pc.operations!;
    const inc = pc.incomeBreakdown;
    const wf = pc.workforcePlan!;
    const sectorCfg = SECTOR_CONFIGS[pc.sector];

    const installedCap = Math.max(1, ops.installedCapacity);
    const effectiveCap = ops.effectiveCapacity;
    const actualProd = ops.actualProduction;
    const capacityUtilizationPct = Number(
      Math.min(100, (actualProd / installedCap) * 100).toFixed(1)
    );
    const storageFillPct = Math.min(
      100,
      Math.round(
        (ops.inventoryUnits / Math.max(1, ops.maximumStorageUnits)) * 100
      )
    );

    const laborCap = Math.max(
      1,
      Math.round(pc.staffCount * 2.5 * ops.workforceEfficiency)
    );
    const requiredWorkersForFullCap = Math.max(
      5,
      Math.ceil(installedCap / Math.max(0.5, 2.5 * ops.workforceEfficiency))
    );
    const workersShortfall = Math.max(0, requiredWorkersForFullCap - pc.staffCount);

    const dailyRevenue = Number(
      ((inc ? inc.totalRevenue : pc.financials.revenue) / 120).toFixed(2)
    );
    const dailyExpenses = Number(
      (
        (inc
          ? inc.totalCogs +
            inc.totalOpex +
            inc.totalFinancingExpense +
            inc.taxExpense
          : pc.financials.costOfGoodsSold + pc.financials.operatingExpenses) / 120
      ).toFixed(2)
    );
    const dailyNetProfit = Number(
      ((inc ? inc.netProfit : pc.financials.netIncome) / 120).toFixed(2)
    );
    const runwayDays = Math.max(
      0,
      Math.floor(pc.financials.cash / Math.max(1, dailyExpenses))
    );

    const companyLoans = (state.activeLoans ?? []).filter(
      (l) => l.status !== 'PAID_OFF' && l.borrowerType === 'COMPANY'
    );
    const nextCompanyLoan = companyLoans
      .slice()
      .sort((a, b) => a.nextPaymentGameDay - b.nextPaymentGameDay)[0];

    // Açık Türkçe Ana Darboğaz Tespiti
    const mainBottleneckTR =
      pc.financials.cash < dailyExpenses * 2
        ? 'İşletme sermayesi yetersiz'
        : storageFillPct >= 95
        ? 'Depo dolu'
        : laborCap < effectiveCap - 0.5
        ? 'Çalışan eksik'
        : Math.min(ops.rawMaterialAvailability, ops.energyOperationalCapacity) <
          0.88
        ? 'Hammadde eksik'
        : ops.machineAvailability < 0.85
        ? 'Makine bakımı gerekiyor'
        : ops.marketDemand < actualProd * 0.85
        ? 'Talep düşük'
        : 'Darboğaz yok (Dengeli üretim)';

    // Şirket Durumu Özeti
    const companyHealthLabel =
      pc.financials.cash < dailyExpenses * 2
        ? 'Kritik (Nakit Sıkışıklığı)'
        : dailyNetProfit < 0 || mainBottleneckTR !== 'Darboğaz yok (Dengeli üretim)'
        ? 'İyileştirilebilir'
        : 'Sağlıklı';

    // Gerçek Veriden Üretilen 3 Kısa Durum Mesajı (Bölüm 1: Özet)
    const statusProductionMsg =
      laborCap < effectiveCap - 0.5
        ? `Üretim yavaş: Çalışan sayısı yetersiz (${pc.staffCount} / ${requiredWorkersForFullCap} kişi).`
        : storageFillPct >= 90
        ? `Depo dolmak üzere (%${storageFillPct}): Satış fiyatını düşürün veya stok eritin.`
        : ops.machineAvailability < 0.85
        ? `Üretim yavaş: Makine durumu %${(ops.machineAvailability * 100).toFixed(0)} seviyesinde.`
        : capacityUtilizationPct < 70
        ? `Kapasite kullanımı düşük: En fazla üretimin yalnızca %${capacityUtilizationPct.toString().replace('.', ',')}’i kullanılıyor.`
        : 'Üretim dengeli: Mevcut çalışan ve makine düzeni uyumlu çalışıyor.';

    const statusFinanceMsg =
      runwayDays < 7
        ? `Nakit kritik: Şirket kasası tahmini ${runwayDays} günlük gideri karşılayabilir.`
        : companyLoans.length > 0 && nextCompanyLoan
        ? `Nakit yeterli (${runwayDays} gün), sıradaki kredi ödemesi Gün ${nextCompanyLoan.nextPaymentGameDay} (${formatCurrency(nextCompanyLoan.installmentAmount)}).`
        : `Nakit yeterli: Tahmini ${Math.min(365, runwayDays)} günlük gider karşılanabilir.`;

    const statusGrowthMsg =
      ops.marketDemand > actualProd + 1
        ? `Satışlar iyi: Satış fırsatı (${ops.marketDemand.toFixed(0)} birim) mevcut üretimden (${actualProd.toFixed(0)} birim) yüksek.`
        : pc.techQualityMultiplier < 1.25
        ? 'Büyüme fırsatı: Gelişim bölümünden Ar-Ge bütçesini artırarak ürün kalitesini yükseltebilirsiniz.'
        : 'Pazar konumu güçlü: Ürün kalitesi ve satış hızı dengeli seyrediyor.';

    // Önerilen İşlemler (En fazla 3 öneri — ilgili sekmeye yönlendirir, işlemi Özet'te tekrar etmez!)
    const recommendedNavActions: Array<{
      id: string;
      title: string;
      reason: string;
      targetTab: 'URETIM' | 'CALISANLAR' | 'FINANS' | 'GELISIM';
      ctaLabel: string;
    }> = [];

    if (laborCap < effectiveCap - 0.5 || workersShortfall > 0) {
      recommendedNavActions.push({
        id: 'rec-hire',
        title: `Çalışan Eksikliğini Gider (+${Math.max(5, workersShortfall)} kişi)`,
        reason:
          'Mevcut üretim tesisini tam kapasite çalıştırmak için yeni çalışan gerekiyor.',
        targetTab: 'CALISANLAR',
        ctaLabel: 'Çalışanlar Bölümüne Git',
      });
    }
    if (capacityUtilizationPct < 70 || storageFillPct >= 75) {
      recommendedNavActions.push({
        id: 'rec-prod',
        title:
          storageFillPct >= 75
            ? 'Stok ve Satış Fiyatını Düzenle'
            : 'Mevcut Üretim Kapasitesini Etkinleştir',
        reason:
          storageFillPct >= 75
            ? 'Depo doluluğu yükseldi; satış fiyatını güncelleyerek stokları eritebilirsiniz.'
            : `Tesis kapasitesinin %${capacityUtilizationPct.toString().replace('.', ',')}’i kullanılıyor; yeni yatırım yerine üretimi artırın.`,
        targetTab: 'URETIM',
        ctaLabel: 'Üretim Bölümüne Git',
      });
    }
    if (runwayDays < 14 || companyLoans.length > 0) {
      recommendedNavActions.push({
        id: 'rec-fin',
        title: 'Nakit Akışı ve Borç Planını Kontrol Et',
        reason:
          'Şirket kasasını ve yaklaşan kredi ödemelerini Finans bölümünden yönetin.',
        targetTab: 'FINANS',
        ctaLabel: 'Finans Bölümüne Git',
      });
    }
    // Kapasite kullanımı %70'in altındaysa yeni kapasite yatırımı önerilmez!
    if (
      capacityUtilizationPct >= 70 &&
      ops.marketDemand > installedCap &&
      recommendedNavActions.length < 3
    ) {
      recommendedNavActions.push({
        id: 'rec-inv',
        title: 'Üretim Tesisi Yatırımı Planla',
        reason:
          'Mevcut tesis yüksek kapasitede çalışıyor ve satış fırsatı üretimi aşıyor.',
        targetTab: 'GELISIM',
        ctaLabel: 'Gelişim Bölümüne Git',
      });
    }
    if (recommendedNavActions.length === 0) {
      recommendedNavActions.push({
        id: 'rec-default-prod',
        title: 'Üretim ve Satış Planını İncele',
        reason: 'Günlük üretim hedefini ve ürün fiyatını gözden geçirin.',
        targetTab: 'URETIM',
        ctaLabel: 'Üretim Bölümüne Git',
      });
    }

    // Üretimi Artır Rehberi Hesaplamaları (Bölüm 2: Üretim)
    const guideTargetUnits =
      prodGuideTargetMode === '50K'
        ? 50_000
        : prodGuideTargetMode === '100K'
        ? 100_000
        : prodGuideTargetMode === '250K'
        ? 250_000
        : prodGuideTargetMode === 'CAP_25'
        ? Math.max(1, Math.round(installedCap * 0.25))
        : prodGuideTargetMode === 'CAP_50'
        ? Math.max(1, Math.round(installedCap * 0.5))
        : Math.max(1, Math.round(prodGuideCustomUnits));

    const guideBoundedUnits = Math.min(installedCap, guideTargetUnits);
    const guideTotalWorkersNeeded = Math.ceil(
      guideTargetUnits / Math.max(0.5, 2.5 * ops.workforceEfficiency)
    );
    const guideNewWorkersNeeded = Math.max(
      0,
      guideTotalWorkersNeeded - pc.staffCount
    );
    const dailyWagePerWorker = Number(
      (
        sectorCfg.dailyStaffWage *
        (wf.salaryTier === 'ECONOMY'
          ? 0.85
          : wf.salaryTier === 'STANDARD'
          ? 1.0
          : 1.22) *
        (wf.shifts === 1 ? 1.0 : wf.shifts === 2 ? 1.18 : 1.38)
      ).toFixed(2)
    );
    const dailyTotalPayroll = Number(
      (pc.staffCount * dailyWagePerWorker).toFixed(2)
    );
    const workerSatisfactionPct = Math.round(
      Math.min(
        100,
        Math.max(
          35,
          (wf.salaryTier === 'ECONOMY'
            ? 64
            : wf.salaryTier === 'STANDARD'
            ? 82
            : 95) -
            (wf.shifts === 3 ? 8 : wf.shifts === 2 ? 3 : 0)
        )
      )
    );

    const guideDailyExtraCost = Number(
      (
        guideNewWorkersNeeded * dailyWagePerWorker +
        Math.max(0, guideBoundedUnits - actualProd) * ops.unitProductionCost
      ).toFixed(2)
    );
    const guideRequiredRawMaterial = guideBoundedUnits;
    const guideEstimatedSales = Math.min(
      ops.marketDemand,
      ops.inventoryUnits + guideBoundedUnits
    );
    const guideStockRiskLabel =
      guideBoundedUnits > ops.marketDemand * 1.25 ||
      ops.inventoryUnits + guideBoundedUnits - guideEstimatedSales >
        ops.maximumStorageUnits * 0.85
        ? 'Yüksek (Depo dolabilir)'
        : guideBoundedUnits > ops.marketDemand
        ? 'Orta (Stok birikebilir)'
        : 'Düşük (Satış talebi karşılıyor)';

    // Çalışan Alımı (İşçi Alımı) Hesaplamaları (Bölüm 3: Çalışanlar)
    const cleanHireCount = Math.max(0, Math.round(hireCountInput));
    const hireOnboardingCost = Number(
      (cleanHireCount * sectorCfg.dailyStaffWage * 0.8).toFixed(2)
    );
    const hireDailyExtraWage = Number(
      (cleanHireCount * dailyWagePerWorker).toFixed(2)
    );
    const newLaborCapAfterHire = Math.max(
      1,
      Math.round((pc.staffCount + cleanHireCount) * 2.5 * ops.workforceEfficiency)
    );
    const currentLaborBoundedProd = Math.min(
      installedCap,
      effectiveCap,
      laborCap
    );
    const afterHireLaborBoundedProd = Math.min(
      installedCap,
      effectiveCap,
      newLaborCapAfterHire
    );
    const estimatedProdGainFromHire = Math.max(
      0,
      Number((afterHireLaborBoundedProd - currentLaborBoundedProd).toFixed(1))
    );
    const cashAfterHire = Number(
      (pc.financials.cash - hireOnboardingCost).toFixed(2)
    );
    const canAffordHire =
      cleanHireCount > 0 && hireOnboardingCost <= pc.financials.cash;

    // Yatırım Paketi Teklifi (Bölüm 5: Gelişim)
    const invQuote = CompanyEngine.computeInvestmentProjectQuote(
      pc,
      selectedInvPkg,
      {
        customCapacityGain:
          selectedInvPkg === 'CUSTOM_TARGET' ? customCapDelta : undefined,
        budgetMaxMode: selectedInvPkg === 'BUDGET_MAX',
      }
    );

    const companyLedgerTxs = (state.centralLedger?.transactions ?? []).filter(
      (tx) =>
        tx.relatedCompanyId === pc.ticker ||
        tx.sourceAccountId.includes(pc.ticker) ||
        tx.destinationAccountId.includes(pc.ticker)
    );

    return (
      <div
        className="space-y-3.5 text-xs"
        data-testid="sheet-content-SIRKET_MERKEZI-active"
      >
        {/* Şirket Başlık Özeti */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-slate-900">
              {pc.name} ({pc.ticker})
            </div>
            <div className="text-[11px] text-slate-600">
              Sektör: {pc.sector} · Gün: {pc.operatingDays} · Kredi Notu:{' '}
              <strong className="text-slate-900">{pc.creditScore ?? 680}</strong>
            </div>
          </div>
          <div className="text-right font-mono tabular-nums">
            <div className="text-xs font-bold text-slate-900">
              Şirket Değeri: {formatCurrency(pc.equityValue)}
            </div>
            <div className="text-[11px] text-slate-600">
              Şirket Kasası: {formatCurrency(pc.financials.cash)}
            </div>
          </div>
        </div>

        {/* 5 Ana Bölümlü Mobil Öncelikli Navigasyon (Özet · Üretim · Çalışanlar · Finans · Gelişim) */}
        <div
          role="tablist"
          aria-label="Şirket Yönetimi Bölümleri"
          data-testid="company-5-section-nav"
          className="grid grid-cols-5 gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200"
        >
          {(
            [
              { id: 'OZET', label: 'Özet' },
              { id: 'URETIM', label: 'Üretim' },
              { id: 'CALISANLAR', label: 'Çalışanlar' },
              { id: 'FINANS', label: 'Finans' },
              { id: 'GELISIM', label: 'Gelişim' },
            ] as const
          ).map((tab) => (
            <button
              key={`company-subtab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={companySubTab === tab.id}
              data-testid={`company-subtab-${tab.id}`}
              onClick={() => setCompanySubTab(tab.id)}
              className={`min-h-[38px] px-1.5 py-1 rounded-xl text-[11px] font-bold text-center transition-colors ${
                companySubTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* =====================================================================
            BÖLÜM 1: ÖZET (En Fazla 5 Ana Bilgi Kartı + 3 Durum Mesajı + Önerilen İşlemler)
           ===================================================================== */}
        {companySubTab === 'OZET' && (
          <div className="space-y-3" data-testid="company-section-OZET">
            {/* En fazla 5 ana bilgi kartı */}
            <div
              className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono tabular-nums"
              data-testid="company-summary-5-cards"
            >
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  1. Şirket Kasası
                </div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">
                  {formatCurrency(pc.financials.cash)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  2. Bugünkü Kâr / Zarar
                </div>
                <div
                  className={`text-xs font-bold mt-0.5 ${
                    dailyNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {dailyNetProfit >= 0 ? '+' : ''}
                  {formatCurrency(dailyNetProfit)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  3. Bugünkü Üretim
                </div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">
                  {actualProd.toFixed(0)} birim
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  4. Bugünkü Satış
                </div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">
                  {ops.actualSalesUnits.toFixed(0)} birim
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-sans text-slate-500">
                  5. Şirket Durumu
                </div>
                <div
                  className={`text-xs font-sans font-bold mt-0.5 ${
                    companyHealthLabel.startsWith('Kritik')
                      ? 'text-rose-700'
                      : companyHealthLabel === 'Sağlıklı'
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {companyHealthLabel}
                </div>
              </div>
            </div>

            {/* 3 Kısa Durum Mesajı (Gerçek Veriden Üretilen) */}
            <div
              className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2"
              data-testid="company-summary-status-messages"
            >
              <div className="font-bold text-slate-900">
                Şirket Durum Özeti
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2">
                  <span className="font-bold text-slate-700 shrink-0">
                    Üretim:
                  </span>
                  <span className="text-slate-700">{statusProductionMsg}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2">
                  <span className="font-bold text-slate-700 shrink-0">
                    Finans:
                  </span>
                  <span className="text-slate-700">{statusFinanceMsg}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2">
                  <span className="font-bold text-slate-700 shrink-0">
                    Fırsat:
                  </span>
                  <span className="text-slate-700">{statusGrowthMsg}</span>
                </div>
              </div>
            </div>

            {/* Önerilen İşlemler (En fazla 3 öneri — ilgili bölüme yönlendirir) */}
            <div
              className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2"
              data-testid="company-recommended-actions"
            >
              <div className="font-bold text-slate-900">
                Önerilen İşlemler ({recommendedNavActions.slice(0, 3).length})
              </div>
              <div className="space-y-2">
                {recommendedNavActions.slice(0, 3).map((rec) => (
                  <div
                    key={rec.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900">{rec.title}</div>
                      <div className="text-[11px] text-slate-600">
                        {rec.reason}
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid={`recommended-nav-${rec.targetTab}`}
                      onClick={() => setCompanySubTab(rec.targetTab)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] shrink-0"
                    >
                      {rec.ctaLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            BÖLÜM 2: ÜRETİM (Sadeleştirilmiş Üretim, Kapasite, Darboğaz ve "Üretimi Artır")
           ===================================================================== */}
        {companySubTab === 'URETIM' && (
          <div className="space-y-3" data-testid="company-section-URETIM">
            {/* İlk bakışta yalnızca 4 anlamlı kutu (6 renkli kart yerine!) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1">
                <div className="text-[11px] text-slate-500">
                  Bugünkü Üretim & Kapasite
                </div>
                <div className="text-sm font-bold font-mono text-slate-900">
                  Üretim: {actualProd.toFixed(0)} / {installedCap} birim
                </div>
                <div className="text-[11px] text-slate-600 font-mono">
                  Kapasite kullanımı: %
                  {capacityUtilizationPct.toString().replace('.', ',')} ·
                  Kullanılabilir Kapasite: {effectiveCap.toFixed(0)} birim
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1">
                <div className="text-[11px] text-slate-500">
                  Ana Darboğaz Durumu
                </div>
                <div
                  data-testid="production-main-bottleneck"
                  className={`text-sm font-bold ${
                    mainBottleneckTR.startsWith('Darboğaz yok')
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {mainBottleneckTR}
                </div>
                <div className="text-[11px] text-slate-600">
                  Çalışan Verimi: x{ops.workforceEfficiency.toFixed(2)} · Makine
                  Durumu: %{(ops.machineAvailability * 100).toFixed(0)} · Vardiya
                  Düzeni: {wf.shifts} vardiya
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1">
                <div className="text-[11px] text-slate-500">
                  Bugünkü Satış & Satış Fırsatı
                </div>
                <div className="text-sm font-bold font-mono text-emerald-700">
                  {ops.actualSalesUnits.toFixed(0)} birim satıldı
                </div>
                <div className="text-[11px] text-slate-600 font-mono">
                  Satış Fırsatı: {ops.marketDemand.toFixed(0)} birim/gün · Birim
                  Fiyat: {formatCurrency(ops.salePrice)}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1">
                <div className="text-[11px] text-slate-500">Stok Durumu</div>
                <div className="text-sm font-bold font-mono text-slate-900">
                  {ops.inventoryUnits.toFixed(0)} /{' '}
                  {ops.maximumStorageUnits.toFixed(0)} birim
                </div>
                <div className="text-[11px] text-slate-600 font-mono">
                  Depo doluluğu: %{storageFillPct} · Birim maliyet:{' '}
                  {formatCurrency(ops.unitProductionCost)}
                </div>
              </div>
            </div>

            {/* Ana Aksiyon Düğmesi: "Üretimi Artır" */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900">
                    Üretim Hedefi ve Kapasite Kullanımı
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Üretimi artırmak için hedef miktar seçin ve gereken kaynakları
                    görün.
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="toggle-increase-production-btn"
                  onClick={() => setShowProductionGuide((prev) => !prev)}
                  className="min-h-[40px] px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shrink-0"
                >
                  Üretimi Artır
                </button>
              </div>

              {showProductionGuide && (
                <div
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                  data-testid="production-increase-guide-panel"
                >
                  <div className="font-semibold text-slate-800">
                    Hedef Üretim Seçin
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: '50K', label: '50.000' },
                        { id: '100K', label: '100.000' },
                        { id: '250K', label: '250.000' },
                        { id: 'CAP_25', label: 'Kapasitenin %25’i' },
                        { id: 'CAP_50', label: 'Kapasitenin %50’si' },
                        { id: 'CUSTOM', label: 'Özel hedef' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setProdGuideTargetMode(opt.id)}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                          prodGuideTargetMode === opt.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {prodGuideTargetMode === 'CUSTOM' && (
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-semibold text-slate-700">
                        Özel Hedef (birim/gün):
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={10}
                        value={prodGuideCustomUnits}
                        onChange={(e) =>
                          setProdGuideCustomUnits(
                            Math.max(1, Number(e.target.value) || 1)
                          )
                        }
                        className="min-h-[38px] px-3 rounded-xl bg-white border border-slate-300 font-mono text-slate-900"
                      />
                    </div>
                  )}

                  {/* Seçilen hedef için 5 zorunlu gösterge */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[11px]">
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <div className="font-sans text-slate-500">
                        Gerekli yeni çalışan
                      </div>
                      <div className="font-bold text-slate-900">
                        +{guideNewWorkersNeeded} kişi
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <div className="font-sans text-slate-500">
                        Günlük ek maliyet
                      </div>
                      <div className="font-bold text-rose-700">
                        {formatCurrency(guideDailyExtraCost)}/gün
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <div className="font-sans text-slate-500">
                        Gerekli hammadde
                      </div>
                      <div className="font-bold text-slate-900">
                        {guideRequiredRawMaterial.toLocaleString('tr-TR')} br
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <div className="font-sans text-slate-500">
                        Tahmini satış
                      </div>
                      <div className="font-bold text-emerald-700">
                        {guideEstimatedSales.toFixed(0)} br/gün
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200 col-span-2 sm:col-span-1">
                      <div className="font-sans text-slate-500">
                        Tahmini stok riski
                      </div>
                      <div className="font-sans font-bold text-amber-800">
                        {guideStockRiskLabel}
                      </div>
                    </div>
                  </div>

                  {capacityUtilizationPct < 70 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                      Mevcut En Fazla Üretim kapasitenizin yalnızca %
                      {capacityUtilizationPct.toString().replace('.', ',')}’i
                      kullanılıyor. Yeni tesis yatırımı yerine önce mevcut
                      kapasiteyi ve çalışan sayısını tamamlamanız önerilir.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onConfigureOperations({
                          plannedProductionUnits: guideBoundedUnits,
                        })
                      }
                      className="min-h-[38px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                    >
                      Üretim Hedefini Uygula ({guideBoundedUnits} birim/gün)
                    </button>
                    {guideNewWorkersNeeded > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setHireCountInput(guideNewWorkersNeeded);
                          setCompanySubTab('CALISANLAR');
                        }}
                        className="min-h-[38px] px-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold"
                      >
                        Gerekli Çalışanı Almak İçin Çalışanlar’a Git (+
                        {guideNewWorkersNeeded})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Ürün Fiyatlandırma ve Stok Eritme */}
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={20}
                  step={10}
                  placeholder="Yeni birim satış fiyatı"
                  value={customSalePrice || ops.salePrice}
                  onChange={(e) =>
                    setCustomSalePrice(Math.max(10, Number(e.target.value) || 10))
                  }
                  className="min-h-[40px] px-3 rounded-xl bg-slate-50 border border-slate-300 font-mono text-slate-900"
                />
                <button
                  type="button"
                  onClick={() =>
                    onConfigureOperations({
                      unitSalePrice: customSalePrice || ops.salePrice,
                    })
                  }
                  className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  Satış Fiyatını Güncelle
                </button>
                <button
                  type="button"
                  disabled={ops.inventoryUnits <= 0}
                  onClick={() =>
                    onLiquidateInventory &&
                    onLiquidateInventory(
                      Math.max(1, Math.floor(ops.inventoryUnits * 0.5)),
                      0.2
                    )
                  }
                  className="min-h-[40px] px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-200 text-white font-bold"
                >
                  Stoğun %50’sini İndirimli Sat (%20 İndirim)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            BÖLÜM 3: ÇALIŞANLAR (İşçi Alımı Düzeltmesi, Önizleme, Onay ve Vardiya)
           ===================================================================== */}
        {companySubTab === 'CALISANLAR' && (
          <div className="space-y-3" data-testid="company-section-CALISANLAR">
            {/* 7 Temel Çalışan Metriği */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  Toplam Çalışan
                </div>
                <div
                  data-testid="company-total-staff-count"
                  className="text-sm font-bold text-slate-900 mt-0.5"
                >
                  {pc.staffCount} kişi
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  Üretimde Çalışan
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {wf.departments.production} kişi
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  Yönetim Çalışanı
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {wf.departments.management} kişi{' '}
                  <span className="text-[10px] text-slate-500 font-normal">
                    (Ar-Ge: {wf.departments.rd}, Satış: {wf.departments.sales})
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  Gerekli Çalışan (Tam Kapasite)
                </div>
                <div
                  className={`text-sm font-bold mt-0.5 ${
                    workersShortfall > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {requiredWorkersForFullCap} kişi
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  Ortalama Maaş
                </div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">
                  {formatCurrency(dailyWagePerWorker)}/gün
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  Günlük Personel Gideri
                </div>
                <div className="text-xs font-bold text-rose-700 mt-0.5">
                  {formatCurrency(dailyTotalPayroll)}/gün
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200 col-span-2">
                <div className="text-[10px] font-sans text-slate-500">
                  Çalışan Memnuniyeti & Verim
                </div>
                <div className="text-xs font-bold text-emerald-700 mt-0.5">
                  %{workerSatisfactionPct} Memnuniyet · Çalışan Verimi: x
                  {ops.workforceEfficiency.toFixed(2)}
                </div>
              </div>
            </div>

            {/* ÇALIŞAN AL (İŞÇİ ALIMI) PANELİ */}
            <div
              className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3"
              data-testid="worker-hire-panel"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900">Çalışan Al</h4>
                  <p className="text-[11px] text-slate-600">
                    İşe alım yalnızca çalışan kaynaklı üretim darboğazını azaltır;
                    En Fazla Üretim kapasitesini artırmaz.
                  </p>
                </div>
                <span className="font-mono text-[11px] text-slate-700">
                  Kasa: <strong>{formatCurrency(pc.financials.cash)}</strong>
                </span>
              </div>

              {/* Hızlı İşe Alım Seçenekleri: +10, +100, +500, +1.000, İhtiyaç kadar, Özel sayı */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: '+10', count: 10, testId: 'hire-preset-10' },
                  { label: '+100', count: 100, testId: 'hire-preset-100' },
                  { label: '+500', count: 500, testId: 'hire-preset-500' },
                  { label: '+1.000', count: 1000, testId: 'hire-preset-1000' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    data-testid={preset.testId}
                    onClick={() => {
                      setHireCountInput(preset.count);
                      setHireFeedback(null);
                    }}
                    className={`min-h-[36px] px-3 py-1 rounded-xl font-mono font-bold text-xs ${
                      hireCountInput === preset.count
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}

                <button
                  type="button"
                  data-testid="hire-preset-needed"
                  onClick={() => {
                    setHireCountInput(Math.max(1, workersShortfall || 5));
                    setHireFeedback(null);
                  }}
                  className="min-h-[36px] px-3 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 font-bold text-xs"
                >
                  İhtiyaç kadar (+{Math.max(1, workersShortfall || 5)})
                </button>

                <div className="flex items-center gap-1.5 ml-auto">
                  <label
                    htmlFor="hire-custom-count-input"
                    className="text-[11px] font-semibold text-slate-600"
                  >
                    Özel sayı:
                  </label>
                  <input
                    id="hire-custom-count-input"
                    data-testid="hire-custom-input"
                    type="number"
                    min={1}
                    max={50000}
                    step={1}
                    value={hireCountInput}
                    onChange={(e) => {
                      setHireCountInput(
                        Math.max(0, Math.floor(Number(e.target.value) || 0))
                      );
                      setHireFeedback(null);
                    }}
                    className="w-24 min-h-[36px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono text-slate-900"
                  />
                </div>
              </div>

              {/* İşe Alım Onay Öncesi Önizleme (5 Zorunlu Alan) */}
              <div
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[11px]"
                data-testid="hire-preview-box"
              >
                <div>
                  <div className="font-sans text-slate-500">
                    İşe alınacak çalışan
                  </div>
                  <div className="font-bold text-slate-900">
                    +{cleanHireCount} kişi
                  </div>
                </div>
                <div>
                  <div className="font-sans text-slate-500">
                    Tek seferlik işe alım gideri
                  </div>
                  <div className="font-bold text-rose-700">
                    {formatCurrency(hireOnboardingCost)}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-slate-500">
                    Günlük ek maaş gideri
                  </div>
                  <div className="font-bold text-rose-700">
                    +{formatCurrency(hireDailyExtraWage)}/gün
                  </div>
                </div>
                <div>
                  <div className="font-sans text-slate-500">
                    Tahmini üretim artışı
                  </div>
                  <div className="font-bold text-emerald-700">
                    +{estimatedProdGainFromHire.toFixed(0)} birim/gün
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="font-sans text-slate-500">
                    İşlem sonrası şirket kasası
                  </div>
                  <div
                    className={`font-bold ${
                      cashAfterHire >= 0 ? 'text-slate-900' : 'text-rose-700'
                    }`}
                  >
                    {formatCurrency(cashAfterHire)}
                  </div>
                </div>
              </div>

              {!canAffordHire && cleanHireCount > 0 && (
                <div
                  data-testid="hire-insufficient-cash-warning"
                  className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold"
                >
                  Şirket kasası bu işe alım için yetersiz (Gereken:{' '}
                  {formatCurrency(hireOnboardingCost)}, Mevcut Şirket Kasası:{' '}
                  {formatCurrency(pc.financials.cash)}). Kişisel nakitten otomatik
                  çekim yapılmaz; önce Finans bölümünden şirkete para
                  aktarabilirsiniz.
                </div>
              )}

              {hireFeedback && (
                <div
                  data-testid="hire-feedback-banner"
                  className={`p-2.5 rounded-xl border text-[11px] font-semibold ${
                    hireFeedback.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {hireFeedback.text}
                </div>
              )}

              <button
                type="button"
                data-testid="confirm-hire-workers-btn"
                disabled={!canAffordHire}
                onClick={() => {
                  if (cleanHireCount <= 0) {
                    setHireFeedback({
                      ok: false,
                      text: 'İşe alınacak çalışan sayısı 0’dan büyük olmalıdır.',
                    });
                    return;
                  }
                  if (hireOnboardingCost > pc.financials.cash) {
                    setHireFeedback({
                      ok: false,
                      text: 'Şirket kasası yetersiz olduğu için işe alım reddedildi.',
                    });
                    return;
                  }
                  const targetTotal = pc.staffCount + cleanHireCount;
                  onConfigureOperations({ targetStaffCount: targetTotal });
                  setHireFeedback({
                    ok: true,
                    text: `+${cleanHireCount} yeni çalışan işe alındı. Toplam çalışan: ${targetTotal} kişi.`,
                  });
                }}
                className="w-full min-h-[44px] rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs"
              >
                Çalışan Al (+{cleanHireCount} Kişi ·{' '}
                {formatCurrency(hireOnboardingCost)})
              </button>
            </div>

            {/* Vardiya Düzeni ve Maaş Politikası */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2.5">
              <div className="font-bold text-slate-900">
                Vardiya Düzeni ve Maaş Seviyesi
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    {
                      sh: 1 as const,
                      title: 'Tek vardiya',
                      desc: 'Standart maaş · Düşük makine yıpranması · x1,00 kapasite',
                    },
                    {
                      sh: 2 as const,
                      title: 'İki vardiya',
                      desc: '+%18 vardiya maaş farkı · Orta bakım · x1,65 kapasite',
                    },
                    {
                      sh: 3 as const,
                      title: 'Üç vardiya',
                      desc: '+%38 vardiya maaş farkı · Yüksek bakım · x2,25 kapasite',
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.sh}
                    type="button"
                    data-testid={`shift-select-${item.sh}`}
                    onClick={() =>
                      onConfigureOperations({ shiftCount: item.sh })
                    }
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      wf.shifts === item.sh
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-xs">{item.title}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        wf.shifts === item.sh
                          ? 'text-slate-300'
                          : 'text-slate-500'
                      }`}
                    >
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {(
                  [
                    { id: 'ECONOMY' as SalaryTier, label: 'Ekonomik Maaş' },
                    { id: 'STANDARD' as SalaryTier, label: 'Standart Maaş' },
                    { id: 'COMPETITIVE' as SalaryTier, label: 'Rekabetçi Maaş' },
                  ] as const
                ).map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() =>
                      onConfigureOperations({ salaryTier: tier.id })
                    }
                    className={`min-h-[36px] px-3 rounded-xl font-bold text-[11px] ${
                      wf.salaryTier === tier.id
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            BÖLÜM 4: FİNANS (Sade Özet + 4 Ana Aksiyon + Daraltılabilir Ayrıntılı Rapor)
           ===================================================================== */}
        {companySubTab === 'FINANS' && (
          <div className="space-y-3" data-testid="company-section-FINANS">
            {/* İlk bakışta yalnızca 5 finansal gösterge */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono tabular-nums">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  Şirket Kasası
                </div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">
                  {formatCurrency(pc.financials.cash)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  Bugünkü Gelir
                </div>
                <div className="text-xs font-bold text-emerald-700 mt-0.5">
                  {formatCurrency(dailyRevenue)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  Bugünkü Gider
                </div>
                <div className="text-xs font-bold text-rose-700 mt-0.5">
                  {formatCurrency(dailyExpenses)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="text-[10px] font-sans text-slate-500">
                  Toplam Borç
                </div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">
                  {formatCurrency(pc.financials.totalLiabilities)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-sans text-slate-500">
                  Sıradaki Ödeme
                </div>
                <div className="text-xs font-bold text-amber-800 mt-0.5">
                  {nextCompanyLoan
                    ? `${formatCurrency(nextCompanyLoan.installmentAmount)} (Gün ${nextCompanyLoan.nextPaymentGameDay})`
                    : 'Yok'}
                </div>
              </div>
            </div>

            {/* 4 Ana Finans İşlemi: Para Aktar, Kredi Çek, Borçları Gör, Ayrıntılı Rapor */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                data-testid="finance-action-transfer-btn"
                onClick={() => setShowInlineTransferPanel((prev) => !prev)}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold"
              >
                Para Aktar
              </button>

              <button
                type="button"
                data-testid="finance-action-loan-btn"
                onClick={() => {
                  if (onOpenBuilding) {
                    onOpenBuilding('BANKA');
                  } else {
                    setShowCompanyLoansPanel(true);
                  }
                }}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                Kredi Çek
              </button>

              <button
                type="button"
                data-testid="finance-action-debts-btn"
                onClick={() => setShowCompanyLoansPanel((prev) => !prev)}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
              >
                Borçları Gör ({companyLoans.length})
              </button>

              <button
                type="button"
                data-testid="toggle-detailed-finance-report-btn"
                aria-expanded={showDetailedFinanceReport}
                onClick={() => setShowDetailedFinanceReport((prev) => !prev)}
                className={`min-h-[42px] px-3 py-2 rounded-xl font-bold border ${
                  showDetailedFinanceReport
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                }`}
              >
                Ayrıntılı Rapor
              </button>
            </div>

            {/* Para Aktar Paneli */}
            {showInlineTransferPanel && (
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900">
                    Şirket Kasasına Sermaye Aktarımı
                  </div>
                  {onOpenBuilding && (
                    <button
                      type="button"
                      onClick={() => onOpenBuilding('BANKA')}
                      className="text-[11px] font-bold text-teal-700 hover:underline"
                    >
                      Tüm Hesap Transferleri (Banka) →
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={50_000}
                    step={50_000}
                    value={injectAmount}
                    onChange={(e) =>
                      setInjectAmount(
                        Math.max(10_000, Number(e.target.value) || 10_000)
                      )
                    }
                    className="flex-1 min-h-[40px] px-3 rounded-xl bg-slate-50 border border-slate-300 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => onTransferCapital(injectAmount)}
                    className="min-h-[40px] px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold"
                  >
                    Aktar ({formatCurrency(injectAmount)})
                  </button>
                </div>
              </div>
            )}

            {/* Borçları Gör Paneli */}
            {showCompanyLoansPanel && (
              <div
                className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2.5"
                data-testid="company-debts-panel"
              >
                <div className="font-bold text-slate-900">
                  Şirket Borç Dökümü ({companyLoans.length} Aktif Kredi)
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-sans text-slate-500">
                      Kısa Vadeli Borç
                    </div>
                    <div className="font-bold text-slate-900">
                      {formatCurrency(pc.financials.shortTermDebt)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-sans text-slate-500">
                      Uzun Vadeli Borç
                    </div>
                    <div className="font-bold text-slate-900">
                      {formatCurrency(pc.financials.longTermDebt)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-sans text-slate-500">Toplam Borç</div>
                    <div className="font-bold text-rose-700">
                      {formatCurrency(pc.financials.totalLiabilities)}
                    </div>
                  </div>
                </div>
                {companyLoans.length > 0 && (
                  <div className="space-y-1.5">
                    {companyLoans.map((ln) => (
                      <div
                        key={ln.loanId}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 font-mono text-[11px]"
                      >
                        <div>
                          <div className="font-sans font-bold text-slate-900">
                            {LOAN_TYPE_CATALOG[ln.loanType]?.labelTR ??
                              ln.loanType}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Kalan Anapara:{' '}
                            {formatCurrency(ln.remainingPrincipal)} · Taksit:{' '}
                            {formatCurrency(ln.installmentAmount)} (Gün{' '}
                            {ln.nextPaymentGameDay})
                          </div>
                        </div>
                        {onPayLoanInstallment && (
                          <button
                            type="button"
                            onClick={() => onPayLoanInstallment(ln.loanId)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-sans font-bold text-[10px]"
                          >
                            Taksit Öde
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ayrıntılı Rapor (Varsayılan olarak kapalıdır!) */}
            {showDetailedFinanceReport && inc && (
              <div
                className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3"
                data-testid="detailed-finance-report-panel"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">
                    Ayrıntılı Finans Raporu ve Hesap Hareketleri
                  </h4>
                  <span className="text-[10px] font-semibold text-emerald-700">
                    Finans Kontrolü: Doğrulandı
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-sans text-slate-500">Yıllık Ciro</div>
                    <div className="font-bold text-slate-900">
                      {formatCurrency(inc.totalRevenue)}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-sans text-slate-500">
                      Faaliyet Kârı
                    </div>
                    <div className="font-bold text-emerald-700">
                      {formatCurrency(inc.operatingProfit)}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-sans text-slate-500">
                      FAVÖK (Faiz, Amortisman, Vergi Öncesi)
                    </div>
                    <div className="font-bold text-emerald-700">
                      {formatCurrency(inc.EBITDA)} (%{inc.ebitdaMarginPct})
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-sans text-slate-500">Net Kâr</div>
                    <div className="font-bold text-slate-900">
                      {formatCurrency(inc.netProfit)}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-sans text-slate-500">
                      Serbest Nakit Akışı
                    </div>
                    <div className="font-bold text-slate-900">
                      {formatCurrency(inc.freeCashFlow)}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-sans text-slate-500">
                      Borç / Özsermaye
                    </div>
                    <div className="font-bold text-slate-900">
                      {inc.debtToEquityRatio}x · Özsermaye Karlılığı: %
                      {inc.returnOnEquityPct}
                    </div>
                  </div>
                </div>

                {/* Hesap Hareketleri */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <div className="font-bold text-slate-900">
                    Hesap Hareketleri ({companyLedgerTxs.length})
                  </div>
                  {companyLedgerTxs.length === 0 ? (
                    <div className="p-2.5 rounded-xl bg-slate-50 text-slate-500 text-center">
                      Henüz kaydedilmiş şirket hesap hareketi bulunmuyor.
                    </div>
                  ) : (
                    <div
                      className="space-y-1.5 max-h-48 overflow-y-auto"
                      data-testid="company-ledger-transactions-list"
                    >
                      {companyLedgerTxs.slice(0, 20).map((ltx) => (
                        <div
                          key={ltx.transactionId}
                          className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 font-mono text-[11px]"
                        >
                          <div className="min-w-0">
                            <div className="font-sans font-bold text-slate-900 truncate">
                              {ltx.description}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Gün {ltx.gameDay} ·{' '}
                              {TRANSFER_CATEGORY_LABELS_TR[ltx.category] ??
                                ltx.category}
                            </div>
                          </div>
                          <span className="font-bold text-slate-900 shrink-0">
                            {formatCurrency(ltx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Halka Arz (IPO) Uygunluk Kartı */}
                {!pc.isPubliclyListed && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        Halka Arz (IPO) Durumu
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          ipoEligibility.eligible
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ipoEligibility.eligible ? 'UYGUN' : 'HAZIRLANIYOR'}
                      </span>
                    </div>
                    {!ipoEligibility.eligible &&
                      ipoEligibility.reasons.length > 0 && (
                        <ul className="text-[11px] text-slate-600 space-y-0.5">
                          {deriveDeterministicIpoReasonItems(
                            ipoEligibility.reasons
                          ).map((item) => (
                            <li key={item.id}>• {item.text}</li>
                          ))}
                        </ul>
                      )}
                    <button
                      type="button"
                      disabled={!ipoEligibility.eligible}
                      onClick={() => onExecuteIPO(0.3, 0.12, 0.35)}
                      className="w-full min-h-[40px] rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold"
                    >
                      Şirketi Halka Arz Et (%30 Halka Açıklık · %12 İskonto)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            BÖLÜM 5: GELİŞİM (TEK YATIRIM MERKEZİ: Tesis, Hat, Fabrika, Depo, Otomasyon, Ar-Ge, Lojistik)
           ===================================================================== */}
        {companySubTab === 'GELISIM' && (
          <div className="space-y-3" data-testid="company-section-GELISIM">
            {/* Düşük kapasite kullanımı uyarısı (%70'in altındaysa) */}
            {capacityUtilizationPct < 70 && (
              <div
                data-testid="low-capacity-utilization-warning"
                className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] font-medium leading-relaxed"
              >
                Mevcut kapasitenin yalnızca %
                {capacityUtilizationPct.toString().replace('.', ',')}’i
                kullanılıyor. Yeni tesis yerine çalışan ve üretim planını
                iyileştirmek daha mantıklı olabilir.
              </div>
            )}

            {/* Yeni Yatırım Kartı (Tek Yatırım Merkezi) */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">
                    Yeni Yatırım & Üretim Tesisi Yatırımı
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Kapasite, yeni üretim hattı, yeni fabrika, depo, otomasyon ve
                    lojistik yatırımlarını buradan başlatın.
                  </p>
                </div>
                <span className="font-mono text-[11px] text-teal-800">
                  Güvenli Bütçe: {formatCurrency(invQuote.safeAvailableBudget)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Yatırım Türü Seçin
                  </label>
                  <select
                    data-testid="company-inv-package-select"
                    value={selectedInvPkg}
                    onChange={(e) =>
                      setSelectedInvPkg(e.target.value as InvestmentPackageType)
                    }
                    className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-semibold"
                  >
                    {(
                      Object.keys(
                        INVESTMENT_PACKAGE_CATALOG
                      ) as InvestmentPackageType[]
                    ).map((pk) => (
                      <option key={pk} value={pk}>
                        {INVESTMENT_PACKAGE_CATALOG[pk].titleTR}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Finansman Kaynağı
                  </label>
                  <select
                    value={invFundingSource}
                    onChange={(e) =>
                      setInvFundingSource(
                        e.target.value as 'COMPANY_CASH' | 'BANK_LOAN'
                      )
                    }
                    className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-semibold"
                  >
                    <option value="COMPANY_CASH">
                      Şirket Kasası (Özsermaye)
                    </option>
                    <option value="BANK_LOAN">
                      Banka Yatırım Kredisi Destekli
                    </option>
                  </select>
                </div>
              </div>

              {/* Yatırım Seçenekleri (Sadece Gelişim Sekmesinde Tek Yerde!) */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { label: '+%5 Tesis', pkg: 'SMALL_EXPANSION' as const },
                    { label: '+%15 Tesis', pkg: 'MEDIUM_EXPANSION' as const },
                    { label: '+%35 Tesis', pkg: 'LARGE_EXPANSION' as const },
                    {
                      label: 'Yeni Üretim Hattı',
                      pkg: 'NEW_PRODUCTION_LINE' as const,
                    },
                    { label: 'Yeni Fabrika', pkg: 'NEW_FACTORY' as const },
                    {
                      label: 'Depo & Lojistik (Özel)',
                      pkg: 'CUSTOM_TARGET' as const,
                    },
                    {
                      label: 'Otomasyon (Maks Bütçe)',
                      pkg: 'BUDGET_MAX' as const,
                    },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => setSelectedInvPkg(b.pkg)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                      selectedInvPkg === b.pkg
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {selectedInvPkg === 'CUSTOM_TARGET' && (
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Hedef Ek Kapasite (birim/gün):
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={10000}
                    value={customCapDelta}
                    onChange={(e) =>
                      setCustomCapDelta(Math.max(5, Number(e.target.value) || 5))
                    }
                    className="w-32 min-h-[38px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 font-mono text-xs"
                  />
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div>
                  <div className="font-sans text-slate-500">
                    Kapasite Artışı
                  </div>
                  <div className="font-bold text-emerald-700">
                    +{invQuote.capacityGainUnits} birim/gün
                  </div>
                </div>
                <div>
                  <div className="font-sans text-slate-500">
                    Yatırım Maliyeti
                  </div>
                  <div className="font-bold text-slate-900">
                    {formatCurrency(invQuote.totalCost)}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-slate-500">
                    Tamamlanma Süresi
                  </div>
                  <div className="font-bold text-amber-800">
                    {invQuote.durationDays} Gün (%
                    {invQuote.temporaryDisruptionPct} geçici kesinti)
                  </div>
                </div>
                <div>
                  <div className="font-sans text-slate-500">İptal Bedeli</div>
                  <div className="font-bold text-rose-700">
                    {formatCurrency(invQuote.cancellationCost)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid="start-investment-project-btn"
                onClick={() => {
                  if (onStartInvestmentProject) {
                    onStartInvestmentProject({
                      packageType: selectedInvPkg,
                      customCapacityGain:
                        selectedInvPkg === 'CUSTOM_TARGET'
                          ? customCapDelta
                          : undefined,
                      budgetMaxMode: selectedInvPkg === 'BUDGET_MAX',
                      fundingSource: invFundingSource,
                    });
                  } else {
                    onConfigureOperations({
                      targetProductionCapacity:
                        pc.productionCapacity + invQuote.capacityGainUnits,
                    });
                  }
                }}
                className="w-full min-h-[44px] rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs"
              >
                Üretim Tesisi Yatırımını Başlat (+{invQuote.capacityGainUnits}{' '}
                birim/gün · {formatCurrency(invQuote.totalCost)})
              </button>

              {/* Devam Eden Yatırımlar */}
              {(pc.investmentProjects ?? []).length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <div className="font-bold text-slate-900">
                    Yatırım Geçmişi ve Devam Eden Projeler (
                    {pc.investmentProjects?.length})
                  </div>
                  {(pc.investmentProjects ?? []).slice(0, 5).map((prj) => (
                    <div
                      key={prj.projectId}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {prj.title} (+{prj.capacityGainUnits} birim/gün)
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          Durum: {prj.status} · İlerleme: %
                          {prj.progressPct.toFixed(0)} · Bitiş: Gün{' '}
                          {prj.estimatedEndDay}
                        </div>
                      </div>
                      {prj.status === 'IN_PROGRESS' &&
                        onCancelInvestmentProject && (
                          <button
                            type="button"
                            onClick={() =>
                              onCancelInvestmentProject(prj.projectId)
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10px]"
                          >
                            İptal Et
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ar-Ge ve Teknoloji Geliştirme Kartı */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">
                    Ar-Ge ve Ürün Kalitesi Geliştirme
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Günlük Ar-Ge bütçesi ürün kalitesini ve satış fırsatını
                    artırır.
                  </p>
                </div>
                <span className="font-mono font-bold text-slate-900">
                  Kalite Çarpanı: x{pc.techQualityMultiplier.toFixed(3)}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-slate-700">
                  Günlük Ar-Ge Bütçesi:{' '}
                  <strong>{formatCurrency(pc.dailyRdBudget)}/gün</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onConfigureOperations({
                        dailyRdBudget: Math.max(0, pc.dailyRdBudget - 5_000),
                      })
                    }
                    className="min-h-[36px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold"
                  >
                    -₺5.000
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onConfigureOperations({
                        dailyRdBudget: pc.dailyRdBudget + 10_000,
                      })
                    }
                    className="min-h-[36px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                  >
                    +₺10.000 Artır
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 6. FABRİKA BÖLGESİ (Sadeleştirilmiş Üretim Özeti — Tekrarlayan Yatırım Düğmeleri Kaldırıldı!)
  if (buildingId === 'FABRIKA') {
    const pc = state.playerCompany;
    if (!pc) {
      return (
        <div
          className="space-y-3 text-xs"
          data-testid="sheet-content-FABRIKA-locked"
        >
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Fabrika Bölgesi Kilitli
              </h3>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Fabrika üretim bantlarını çalıştırmak için önce Aşama 2’de (Net
              Varlık ≥ ₺2.000.000) kendi şirketinizi kurmanız gerekmektedir.
            </p>
            {onOpenBuilding && (
              <button
                type="button"
                onClick={() => onOpenBuilding('SIRKET_MERKEZI')}
                className="min-h-[44px] px-4 rounded-xl bg-teal-600 text-white font-bold"
              >
                Şirket Arsası Durumunu Gör
              </button>
            )}
          </div>
        </div>
      );
    }

    if (!pc.operations || !pc.workforcePlan) {
      CompanyEngine.ensureCompanyV5Fields(pc, state.macro);
    }
    const ops = pc.operations!;
    const installedCap = Math.max(1, ops.installedCapacity);
    const actualProd = ops.actualProduction;
    const capUtilPct = Number(
      Math.min(100, (actualProd / installedCap) * 100).toFixed(1)
    );
    const intradayPct = Math.min(
      100,
      Math.round((state.intradayStepsProcessedToday / 288) * 100)
    );

    return (
      <div
        className="space-y-4 text-xs"
        data-testid="sheet-content-FABRIKA-active"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums">
          <div className="p-3 rounded-2xl bg-white border border-slate-200">
            <div className="text-[10px] font-sans text-slate-500">
              Bugünkü Üretim / En Fazla Üretim
            </div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {actualProd.toFixed(0)} / {installedCap} birim
            </div>
            <div className="text-[10px] font-sans text-slate-500">
              Kapasite kullanımı: %{capUtilPct.toString().replace('.', ',')}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-slate-200">
            <div className="text-[10px] font-sans text-slate-500">
              Kullanılabilir Kapasite
            </div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {ops.effectiveCapacity.toFixed(0)} birim/gün
            </div>
            <div className="text-[10px] font-sans text-slate-500">
              Makine Durumu: %{(ops.machineAvailability * 100).toFixed(0)}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-slate-200">
            <div className="text-[10px] font-sans text-slate-500">
              Bugünkü Satış & Satış Fırsatı
            </div>
            <div className="text-sm font-bold text-emerald-700 mt-0.5">
              {ops.actualSalesUnits.toFixed(0)} birim
            </div>
            <div className="text-[10px] font-sans text-slate-500">
              Satış Fırsatı: {ops.marketDemand.toFixed(0)} birim
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-slate-200">
            <div className="text-[10px] font-sans text-slate-500">
              Depo Stok Durumu
            </div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {ops.inventoryUnits.toFixed(0)} /{' '}
              {ops.maximumStorageUnits.toFixed(0)} birim
            </div>
            <div className="text-[10px] font-sans text-slate-500">
              Çalışan: {pc.staffCount} kişi
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2">
          <div className="flex justify-between font-semibold text-slate-800">
            <span>Gün İçi Vardiya Üretim İlerlemesi</span>
            <span className="font-mono">%{intradayPct}</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${intradayPct}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-600 font-mono">
            Birim Satış Fiyatı: {formatCurrency(ops.salePrice)} · Birim Üretim
            Maliyeti: {formatCurrency(ops.unitProductionCost)}
          </div>
        </div>

        {/* Merkezi Depolar, Reçete Üretimi, Lojistik Filo ve Tedarik Zinciri */}
        {onOpenShop &&
          onUpgradeShopLevel &&
          onTransferShopCash &&
          onConfigureShop &&
          onPlaceProcurementOrder &&
          onCancelProcurementOrder &&
          onCreatePurchaseContract &&
          onExecuteRecipeProduction &&
          onPurchaseLogisticsVehicle &&
          onDispatchWarehouseToShop &&
          onAcceptCommercialContract &&
          onDeliverCommercialContract &&
          onIncorporateShopsIntoCompany && (
            <EsnafAndTradePanel
              state={state}
              spendableCash={spendableCash}
              formatCurrency={formatCurrency}
              initialSection="TRADE_CENTER"
              onOpenShop={onOpenShop}
              onUpgradeShopLevel={onUpgradeShopLevel}
              onTransferShopCash={onTransferShopCash}
              onConfigureShop={onConfigureShop}
              onPlaceProcurementOrder={onPlaceProcurementOrder}
              onCancelProcurementOrder={onCancelProcurementOrder}
              onCreatePurchaseContract={onCreatePurchaseContract}
              onExecuteRecipeProduction={onExecuteRecipeProduction}
              onPurchaseLogisticsVehicle={onPurchaseLogisticsVehicle}
              onDispatchWarehouseToShop={onDispatchWarehouseToShop}
              onAcceptCommercialContract={onAcceptCommercialContract}
              onDeliverCommercialContract={onDeliverCommercialContract}
              onIncorporateShopsIntoCompany={onIncorporateShopsIntoCompany}
            />
          )}

        {/* Fabrika ekranında tekrarlayan yatırım düğmeleri yerine Şirket Merkezi'ne yönlendirme */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-bold text-slate-900">
              Üretim Planı, Çalışan Alımı ve Tesis Yatırımları
            </div>
            <div className="text-[11px] text-slate-600">
              Çalışan alımı, üretim hedefi ve yeni tesis yatırımları Şirket
              Merkezi’nde tek yerden yönetilir.
            </div>
          </div>
          {onOpenBuilding && (
            <button
              type="button"
              onClick={() => onOpenBuilding('SIRKET_MERKEZI')}
              className="min-h-[40px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
            >
              Şirket Merkezi’ni Aç
            </button>
          )}
        </div>
      </div>
    );
  }

  // 7. AR-GE MERKEZİ
  if (buildingId === 'ARGE_MERKEZI') {
    const pc = state.playerCompany;
    if (!pc) {
      return (
        <div
          className="space-y-3 text-xs"
          data-testid="sheet-content-ARGE_MERKEZI-locked"
        >
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-violet-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Ar-Ge Merkezi Kilitli
              </h3>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Teknoloji kalitesi ve patent çarpanı geliştirmek için önce Aşama
              2’de kendi şirketinizi kurmanız gerekmektedir.
            </p>
          </div>
        </div>
      );
    }

    const qualityProgressPct = Math.min(
      100,
      Math.round(((pc.techQualityMultiplier - 1.0) / 1.5) * 100)
    );

    return (
      <div
        className="space-y-4 text-xs"
        data-testid="sheet-content-ARGE_MERKEZI-active"
      >
        <div className="grid grid-cols-2 gap-2.5 font-mono tabular-nums">
          <div className="p-3 rounded-2xl bg-violet-50/70 border border-violet-200">
            <div className="text-violet-800 text-[11px]">
              Günlük Ar-Ge Bütçesi
            </div>
            <div className="text-base font-bold text-violet-950 mt-0.5">
              {formatCurrency(pc.dailyRdBudget)}/gün
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="text-emerald-800 text-[11px]">
              Teknoloji Kalite Çarpanı
            </div>
            <div className="text-base font-bold text-emerald-950 mt-0.5">
              x{pc.techQualityMultiplier.toFixed(4)}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2">
          <div className="flex justify-between font-semibold text-slate-800">
            <span>İnovasyon & Ürün Kalite Seviyesi (Maks x2.50)</span>
            <span className="font-mono">%{qualityProgressPct}</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-600 rounded-full transition-all"
              style={{ width: `${qualityProgressPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              onConfigureOperations({
                dailyRdBudget: pc.dailyRdBudget + 10_000,
              })
            }
            className="min-h-[44px] px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold"
          >
            Ar-Ge Bütçesini +₺10.000 Artır
          </button>
          <button
            type="button"
            onClick={() =>
              onConfigureOperations({
                dailyRdBudget: Math.max(0, pc.dailyRdBudget - 5_000),
              })
            }
            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold"
          >
            Ar-Ge Bütçesini -₺5.000 Azalt
          </button>
        </div>
      </div>
    );
  }

  // 8. HOLDİNG MERKEZİ
  const npcStocks = state.stocks.filter((s) => !s.isPlayerCompany);
  const selectedTarget =
    npcStocks.find((s) => s.ticker === takeoverTargetTicker) || npcStocks[0];

  return (
    <div
      className="space-y-4 text-xs"
      data-testid="sheet-content-HOLDING_MERKEZI"
    >
      {!state.stageUnlocks.stage4Holding && (
        <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <div className="font-bold text-amber-950">
              Holding Merkezi Kilit Koşulu (Aşama 4)
            </div>
            <p className="text-amber-900 text-[11px] mt-0.5">
              Bir NPC şirketinde en az %5 stratejik pay topladığınızda veya
              şirketinizi halka arz ettiğinizde Holding Aşaması aktifleşir.
              Aşağıdan öncü pay alabilir veya devralma hedeflerini inceleyebilirsiniz.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 font-mono tabular-nums">
        <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200">
          <div className="text-[11px] text-rose-800">
            Kontrol Edilen Bağlı Ortaklıklar
          </div>
          <div className="text-base font-bold text-rose-950 mt-0.5">
            {state.controlledSubsidiaries.length} Şirket
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
          <div className="text-[11px] text-emerald-800">
            Toplam Holding Sinerji Geliri
          </div>
          <div className="text-base font-bold text-emerald-950 mt-0.5">
            {formatCurrency(state.totalSynergyEarned)}
          </div>
        </div>
      </div>

      {/* Devralma İşlem Kartı */}
      {selectedTarget && (
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Hedef Rakip Şirket Seçin
              </label>
              <select
                value={selectedTarget.ticker}
                onChange={(e) => setTakeoverTargetTicker(e.target.value)}
                className="min-h-[40px] px-3 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900"
              >
                {npcStocks.map((s) => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.ticker} - {s.name} (Payınız: %
                    {s.playerOwnershipPct.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-right font-mono">
              <div className="text-xs font-bold text-slate-900">
                Piyasa Değeri: {formatCurrency(selectedTarget.equityValue)}
              </div>
              <div className="text-[11px] text-slate-500">
                Mevcut Pay: %{selectedTarget.playerOwnershipPct.toFixed(2)} (
                {selectedTarget.controlLevel})
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={useDebtForTakeover}
              onChange={(e) => setUseDebtForTakeover(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span>
              Kaldıraçlı Satın Alma (LBO Borç Finansmanı Kullan - %60’a kadar)
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                onBuyStock(
                  selectedTarget.ticker,
                  Math.max(10, Math.ceil(selectedTarget.totalShares * 0.05))
                )
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold"
            >
              %5 Stratejik Öncü Pay Satın Al ({selectedTarget.ticker})
            </button>
            <button
              type="button"
              disabled={selectedTarget.isControlledByPlayer}
              onClick={() =>
                onExecuteTakeover(selectedTarget.ticker, {
                  targetOwnershipPct: 51.0,
                  useDebtFinancing: useDebtForTakeover,
                })
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold"
            >
              {selectedTarget.isControlledByPlayer
                ? 'Çoğunluk Kontrolü Sizde (%51+)'
                : `%51+ Düşmanca Devralma Başlat (${selectedTarget.ticker})`}
            </button>
          </div>
        </div>
      )}

      {/* İştirakler ve Sahiplik Tablosu */}
      <div className="space-y-1.5">
        <h3 className="font-bold text-slate-900">
          Borsa Şirketleri Ortaklık & Kontrol Durumu
        </h3>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {npcStocks.map((s) => (
            <div
              key={s.ticker}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
            >
              <div>
                <span className="font-mono font-bold text-slate-900">
                  {s.ticker}
                </span>{' '}
                <span className="text-slate-600">· {s.name}</span>
              </div>
              <div className="font-mono text-right shrink-0">
                <span className="font-bold text-slate-900">
                  %{s.playerOwnershipPct.toFixed(2)}
                </span>{' '}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  {s.controlLevel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface BuildingDetailSheetProps extends BuildingDetailActions {
  buildingId: CityBuildingId | null;
  state: SimulationState;
  initialCompanySubTab?: 'OZET' | 'URETIM' | 'CALISANLAR' | 'FINANS' | 'GELISIM';
  onClose: () => void;
  onOpenBuilding: (id: CityBuildingId) => void;
}

const BUILDING_SHEET_HEADERS: Record<
  CityBuildingId,
  {
    title: string;
    subtitle: string;
    Icon: React.ComponentType<{ className?: string }>;
    accentClass: string;
    iconBoxClass: string;
  }
> = {
  BORSA: {
    title: 'Borsa Binası & Emir Terminali',
    subtitle: 'Canlı hisse senedi alım-satımı, limit emirler ve emir defteri',
    Icon: TrendingUp,
    accentClass: 'border-t-4 border-t-emerald-600 bg-emerald-50/40',
    iconBoxClass: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  },
  BANKA: {
    title: 'Merkez Bankası & Hazine',
    subtitle: 'Nakit rezervleri, borç yükümlülükleri ve makroekonomik faizler',
    Icon: Landmark,
    accentClass: 'border-t-4 border-t-amber-500 bg-amber-50/40',
    iconBoxClass: 'bg-amber-100 border-amber-300 text-amber-800',
  },
  HABER_MERKEZI: {
    title: 'Haber Merkezi & Sektör Bülteni',
    subtitle: 'Gerçek zamanlı piyasa haberleri ve duyarlılık sönümlenmesi',
    Icon: Newspaper,
    accentClass: 'border-t-4 border-t-orange-500 bg-orange-50/40',
    iconBoxClass: 'bg-orange-100 border-orange-300 text-orange-800',
  },
  OYUNCU_OFISI: {
    title: 'Oyuncu Ofisi & Portföy Yönetimi',
    subtitle: 'Net varlık denklemi, portföy pozisyonları ve işlem geçmişi',
    Icon: Building2,
    accentClass: 'border-t-4 border-t-sky-600 bg-sky-50/40',
    iconBoxClass: 'bg-sky-100 border-sky-300 text-sky-800',
  },
  SIRKET_MERKEZI: {
    title: 'Şirket Arsası & Kurumsal Merkez',
    subtitle: 'Aşama 2 şirket kurulumu, sermaye aktarımı ve Halka Arz (IPO)',
    Icon: Rocket,
    accentClass: 'border-t-4 border-t-teal-600 bg-teal-50/40',
    iconBoxClass: 'bg-teal-100 border-teal-300 text-teal-800',
  },
  FABRIKA: {
    title: 'Organize Sanayi Fabrika Bölgesi',
    subtitle: 'Gün içi üretim kapasitesi, stok ve maliyet yönetimi',
    Icon: Factory,
    accentClass: 'border-t-4 border-t-amber-600 bg-amber-50/40',
    iconBoxClass: 'bg-amber-100 border-amber-300 text-amber-900',
  },
  ARGE_MERKEZI: {
    title: 'Teknokent Ar-Ge & İnovasyon Merkezi',
    subtitle: 'Günlük Ar-Ge bütçesi ve teknoloji kalite çarpanı',
    Icon: FlaskConical,
    accentClass: 'border-t-4 border-t-violet-600 bg-violet-50/40',
    iconBoxClass: 'bg-violet-100 border-violet-300 text-violet-800',
  },
  HOLDING_MERKEZI: {
    title: 'Holding Kuleleri & Devralma (M&A)',
    subtitle: 'Kontrol edilen bağlı ortaklıklar, sinerji ve %51+ devralma',
    Icon: ShieldCheck,
    accentClass: 'border-t-4 border-t-rose-700 bg-rose-50/40',
    iconBoxClass: 'bg-rose-100 border-rose-300 text-rose-900',
  },
};

export const BuildingDetailSheet: React.FC<BuildingDetailSheetProps> =
  React.memo((props) => {
    const { buildingId, onClose } = props;
    const [dragOffsetY, setDragOffsetY] = useState(0);
    const [dragStartY, setDragStartY] = useState<number | null>(null);

    useEffect(() => {
      if (!buildingId) {
        setDragOffsetY(0);
        setDragStartY(null);
        return;
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
          if (e.key === 'Backspace' && (activeTag === 'INPUT' || activeTag === 'TEXTAREA')) {
            return;
          }
          onClose();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [buildingId, onClose]);

    if (!buildingId) return null;

    const header = BUILDING_SHEET_HEADERS[buildingId];
    const HeaderIcon = header.Icon;

    const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
      setDragStartY(e.clientY);
    };

    const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragStartY === null) return;
      const deltaY = Math.max(0, e.clientY - dragStartY);
      setDragOffsetY(deltaY);
    };

    const handleDragEnd = () => {
      if (dragOffsetY > 60) {
        setDragOffsetY(0);
        setDragStartY(null);
        onClose();
      } else {
        setDragOffsetY(0);
        setDragStartY(null);
      }
    };

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={header.title}
        data-testid={`building-detail-sheet-${buildingId}`}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/35 p-0 sm:p-4"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: dragOffsetY > 0 ? `translate3d(0, ${dragOffsetY}px, 0)` : undefined,
          }}
          className={`w-full max-w-3xl max-h-[76vh] sm:max-h-[84vh] bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-transform duration-150 ${header.accentClass}`}
        >
          {/* Aşağı Sürüklenebilir Bottom Sheet Tutamağı ve Başlık Çubuğu */}
          <div
            data-testid="sheet-drag-handle"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            className="touch-none select-none cursor-grab active:cursor-grabbing bg-white/95 sticky top-0 z-10"
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 sm:hidden" />

            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-2xl border flex items-center justify-center shrink-0 ${header.iconBoxClass}`}
                >
                  <HeaderIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {header.title}
                  </h2>
                  <p className="text-[11px] text-slate-500 truncate">
                    {header.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="close-building-sheet-btn"
                aria-label="Bina Detay Penceresini Kapat"
                onClick={onClose}
                className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* İçerik */}
          <div className="p-4 overflow-y-auto flex-1">
            <BuildingDetailContent {...props} buildingId={buildingId} />
          </div>
        </div>
      </div>
    );
  });
