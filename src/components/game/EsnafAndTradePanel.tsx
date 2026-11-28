/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ESNAF, DÜKKÂN, TİCARET MERKEZİ, TEDARİK ZİNCİRİ VE ŞİRKETLEŞME PANELİ
 * - 1. Geniş kapsam (8 dükkân türü, 23 kaynak/ürün, 12 üretim reçetesi, 10 tedarikçi, 3 depo, 4 araç türü, kurumsal sözleşmeler)
 * - 2. Temiz arayüz (Dükkân ekranında 8 net özet metrik + 5 net işlem; Ticaret Merkezinde 4 sekme: Tedarik, Teslimatlar, Satış Kanalları, Sözleşmeler)
 * - 3. Mantıklı ve tutarlı sistem (Borsa -> Esnaf -> Çok Şubeli Ticaret -> Şirketleşme -> Fabrika & Holding kariyer döngüsü)
 */

import { insuranceDailyPremium, trainedStaffCount } from '../../engine/CityServices';
import { shopHoursLabel, shopOpenStatus } from '../../data/shopHours';
import { getManagerQuote } from '../../engine/ShopManager';
import { getFirstEmployeeQuote, getOpeningAdvice } from '../../engine/ShopOnboarding';
import { FIRST_EMPLOYEE_HIRE_FEE_BUFE, OWNER_STAFF_CAPACITY, SHOP_CASH_KEEP, SHOP_COLLECT_MIN } from '../../data/gameBalance';
import { MANAGER_MIN_SHOP_LEVEL, MANAGER_PROFIT_SHARE } from '../../data/gameBalance';
import { NumberInput } from './ui/NumberInput';
import { ShopStorefront } from './ui/ShopStorefront';
import { ShopReviewsSheet, StarRow, REVIEW_ACTION_LABEL_TR, type ReviewActionHint } from './ShopReviewsSheet';
import { priceRatioScore, shopStars } from '../../engine/ShopRatingEngine';
import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Award,
  CheckCircle2,
  Factory,
  FileText,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Users,
  Lock,
  UserCog,
  Check,
  Info,
} from 'lucide-react';
import {
  RECIPE_CATALOG,
  RESOURCE_CATALOG,
  SHOP_TEMPLATES,
  SUPPLIER_CATALOG,
  TradeAndShopEngine,
  VEHICLE_CATALOG,
} from '../../engine/TradeAndShopEngine';
import { SectorId } from '../../models/market';
import { SimulationState } from '../../models/simulation';
import { HelpTip } from './ui/HelpTip';
import { SHOP_EMOJI } from './ui/shopEmoji';
import { planShopRestock } from '../../engine/ShopRestockPlanner';
import { liveShopToday } from '../../engine/ShopSales';
import { FirstShopGateCard } from './ui/FirstShopGateCard';
import { listShopUpgrades } from '../../engine/ShopUpgrades';
import {
  LogisticsVehicleType,
  PaymentTermType,
  ShopType,
  VehicleTypeId,
} from '../../models/trade';

export interface EsnafAndTradeActionsProps {
  onOpenShop: (params: {
    shopType: ShopType;
    customName?: string;
    districtLabel?: string;
    initialCashFloat?: number;
  }) => void;
  onUpgradeShopLevel: (shopId: string) => void;
  onHireShopManager?: (shopId: string) => void;
  /** İlk dükkânda (BUFE) kendin çalışırken ilk çalışanı ücretle işe al (engine/ShopOnboarding.ts) */
  onHireFirstEmployee?: (shopId: string) => void;
  /** Dükkâna küçük yükseltme al (engine/ShopUpgrades.ts) */
  onBuyShopUpgrade?: (shopId: string, upgradeId: string) => void;
  onFireShopManager?: (shopId: string) => void;
  onSetShopManagerSweep?: (shopId: string, on: boolean) => void;
  onTransferShopCash: (params: {
    shopId: string;
    direction: 'TO_SHOP' | 'FROM_SHOP';
    amount: number;
  }) => void;
  onConfigureShop: (params: {
    shopId: string;
    staffDelta?: number;
    priceMultipliers?: Record<string, number>;
    marketingBudgetDaily?: number;
  }) => void;
  onPlaceProcurementOrder: (params: {
    supplierId: string;
    resourceId: string;
    quantity: number;
    destinationType: 'WAREHOUSE' | 'SHOP';
    destinationId: string;
    paymentTermType: PaymentTermType;
  }) => void;
  onCancelProcurementOrder: (orderId: string) => void;
  onCreatePurchaseContract: (params: {
    supplierId: string;
    resourceId: string;
    dailyQuantity: number;
    durationDays: number;
    destinationType: 'WAREHOUSE' | 'SHOP';
    destinationId: string;
  }) => void;
  onExecuteRecipeProduction: (params: {
    recipeId: string;
    batchesCount: number;
  }) => void;
  onPurchaseLogisticsVehicle: (vehicleType: VehicleTypeId) => void;
  onDispatchWarehouseToShop: (params: {
    sourceWarehouseId: string;
    destinationShopId: string;
    resourceId: string;
    quantity: number;
    useOwnFleet?: boolean;
  }) => void;
  onAcceptCommercialContract: (contractId: string) => void;
  onDeliverCommercialContract: (params: {
    contractId: string;
    quantity: number;
    sourceType: 'WAREHOUSE' | 'SHOP';
    sourceId: string;
  }) => void;
  onIncorporateShopsIntoCompany: (params: {
    companyName: string;
    ticker: string;
    sector: SectorId;
    additionalCashCapital?: number;
  }) => void;
}

interface EsnafAndTradePanelProps extends EsnafAndTradeActionsProps {
  state: SimulationState;
  spendableCash: number;
  formatCurrency: (v: number) => string;
  initialSection?: 'SHOPS' | 'TRADE_CENTER';
  /** Açılışta seçili dükkân; boş bırakılırsa ilk dükkân. */
  initialShopId?: string | null;
  /** true ise açılışta "yeni dükkân aç" sekmesi görünür. */
  startWithOpenBranch?: boolean;
  /** Açılışta hangi alt ekran (testler ve kısayollar için); verilmezse dükkân yoksa "Yeni dükkân", varsa "Mal al". */
  initialActionTab?: ShopActionTab;
}

type ShopActionTab =
  | 'ORDER_PRODUCT'
  | 'EDIT_PRICES'
  | 'MANAGE_STAFF'
  | 'UPGRADE_SHOP'
  | 'OPEN_BRANCH';

type TradeCenterTab =
  | 'TEDARIK'
  | 'TESLIMATLAR'
  | 'SATIS_KANALLARI'
  | 'SOZLESMELER';

const CAREER_STAGE_LABELS: Record<string, string> = {
  STOCK_INVESTOR: '1. Borsa Yatırımcısı',
  SMALL_MERCHANT: '2. Esnaf & İlk Dükkân',
  MULTI_BRANCH_MERCHANT: '3. Çok Şubeli Ticaret',
  INCORPORATED_COMPANY: '4. Kurumsal Şirket & Fabrika',
  HOLDING_LEADER: '5. Holding Lideri',
};

const ALL_RESOURCES = Object.values(RESOURCE_CATALOG);
const ALL_RECIPES = Object.values(RECIPE_CATALOG);
const ALL_SHOP_TEMPLATES = Object.values(SHOP_TEMPLATES);
const ALL_VEHICLES = Object.entries(VEHICLE_CATALOG) as Array<
  [
    LogisticsVehicleType,
    (typeof VEHICLE_CATALOG)[LogisticsVehicleType],
  ]
>;

export const EsnafAndTradePanel: React.FC<EsnafAndTradePanelProps> = ({
  state,
  spendableCash,
  formatCurrency,
  initialSection = 'SHOPS',
  onOpenShop,
  onUpgradeShopLevel,
  onHireShopManager,
  onHireFirstEmployee,
  onBuyShopUpgrade,
  onFireShopManager,
  onSetShopManagerSweep,
  onTransferShopCash,
  onConfigureShop,
  onPlaceProcurementOrder,
  onCreatePurchaseContract,
  onExecuteRecipeProduction,
  onPurchaseLogisticsVehicle,
  onDispatchWarehouseToShop,
  onAcceptCommercialContract,
  onDeliverCommercialContract,
  onIncorporateShopsIntoCompany,
  initialShopId,
  startWithOpenBranch,
  initialActionTab,
}) => {
  const trade = TradeAndShopEngine.ensureTradeUniverseState(state);
  const incorporationEligibility = TradeAndShopEngine.checkIncorporationEligibility(state);

  const [mainMode, setMainMode] = useState<'SHOPS' | 'TRADE_CENTER'>(
    initialSection
  );
  const [selectedShopId, setSelectedShopId] = useState<string>(
    () => initialShopId ?? trade.shops[0]?.shopId ?? ''
  );
  const [shopActionTab, setShopActionTab] = useState<ShopActionTab>(() =>
    initialActionTab ??
    (trade.shops.length === 0 || startWithOpenBranch
      ? 'OPEN_BRANCH'
      : 'ORDER_PRODUCT')
  );
  const [tradeTab, setTradeTab] = useState<TradeCenterTab>('TEDARIK');
  // Toptan & Üretim: ilk dükkânlı esnafa karmaşık formlar gösterilmez (2 dükkân ya da şirket olunca açılır)
  const canSeeTradeCenter = trade.shops.length >= 2 || state.playerCompany !== null;
  const [showTransferTools, setShowTransferTools] = useState(false);
  const [showAdvancedOrder, setShowAdvancedOrder] = useState(false);
  const [showSummaryDetails, setShowSummaryDetails] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  // Fiyat kaydırıcısı: sürüklerken taslak, bırakınca kaydedilir
  const [priceDrafts, setPriceDrafts] = useState<Record<string, number>>({});
  const [showIncorp, setShowIncorp] = useState(false);

  // Yeni şube açılış formu
  const [newShopType, setNewShopType] = useState<ShopType>('BUFE');
  const [newShopCustomName, setNewShopCustomName] = useState<string>('');
  const [newShopCashFloat, setNewShopCashFloat] = useState<number>(8_000);
  // Düşük sermayeyle açılışta ikinci onay: ilk basışta uyarı çıkar, aynı seçimle ikinci basışta dükkân açılır
  const [lowCashArmedKey, setLowCashArmedKey] = useState<string | null>(null);

  // Tedarik sipariş formu
  const [selectedResourceId, setSelectedResourceId] = useState<string>(
    'FIN_PACKAGED_FOOD'
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    SUPPLIER_CATALOG[0]?.supplierId ?? 'SUP_ANADOLU_GIDA'
  );
  const [orderQuantity, setOrderQuantity] = useState<number>(30);
  const [orderPaymentTerm, setOrderPaymentTerm] =
    useState<PaymentTermType>('CASH');
  const [orderDestType, setOrderDestType] = useState<'SHOP' | 'WAREHOUSE'>(
    () => (trade.shops.length > 0 ? 'SHOP' : 'WAREHOUSE')
  );
  const [orderWarehouseId, setOrderWarehouseId] =
    useState<string>('WH_RAW_MAIN');

  // Kasa transferi
  const [shopTransferAmount, setShopTransferAmount] = useState<number>(10_000);

  // Şirketleşme formu
  const [incorpName, setIncorpName] = useState<string>(
    'Anadolu Ticaret ve Sanayi A.Ş.'
  );
  const [incorpTicker, setIncorpTicker] = useState<string>('ATSN');
  const [incorpSector] = useState<SectorId>('PERAKENDE');
  const [incorpExtraCash, setIncorpExtraCash] = useState<number>(50_000);

  // Reçete üretim formu
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(
    ALL_RECIPES[0]?.recipeId ?? 'REC_INT_FLOUR'
  );
  const [recipeBatches, setRecipeBatches] = useState<number>(5);

  // Depodan şubeye sevkiyat formu
  const [dispatchWarehouseId, setDispatchWarehouseId] =
    useState<string>('WH_FIN_MAIN');
  const [dispatchResourceId, setDispatchResourceId] = useState<string>(
    'FIN_PACKAGED_FOOD'
  );
  const [dispatchQty, setDispatchQty] = useState<number>(20);

  const activeShop =
    trade.shops.find((s) => s.shopId === selectedShopId) ??
    trade.shops[0] ??
    null;

  const activeShopTemplate = useMemo(
    () => (activeShop ? SHOP_TEMPLATES[activeShop.shopType] ?? null : null),
    [activeShop]
  );

  const selectedShopTemplateForNew = useMemo(
    () => SHOP_TEMPLATES[newShopType] ?? SHOP_TEMPLATES.BUFE,
    [newShopType]
  );

  // Kişisel nakitten rezerve edilen kısım (bekleyen emirler) kullanılabilir paradan farkıdır
  const reservedForAdvice = Math.max(0, state.cash - spendableCash);
  const openingAdvice = getOpeningAdvice(state, newShopType, newShopCashFloat, reservedForAdvice);
  const openingKey = `${newShopType}|${newShopCashFloat}`;
  const lowCashArmed = lowCashArmedKey === openingKey;
  const firstEmployeeQuote = (activeShop && activeShop.ownerWorks ? getFirstEmployeeQuote(state, activeShop, reservedForAdvice) : null);

  const supplierOffers = TradeAndShopEngine.getSupplierOffers(state, selectedResourceId, activeShop);

  const activeOffer =
    supplierOffers.find((o) => o.supplierId === selectedSupplierId) ??
    supplierOffers[0] ??
    null;

  const activeShopUsedUnits = activeShop
    ? activeShop.inventoryBatches.reduce((sum, b) => sum + b.quantity, 0)
    : 0;
  const restockPlan = activeShop
    ? planShopRestock(state, activeShop.shopId, spendableCash + activeShop.cashAccountBalance)
    : { orders: [], totalCost: 0, maxDeliveryDays: 0 };
  const inboundShipments = trade.shipments.filter(
    (sh) =>
      activeShop &&
      sh.destinationId === activeShop.shopId &&
      !['DELIVERED', 'CANCELLED', 'DAMAGED'].includes(sh.status)
  );
  const recentDeliveredShipments = trade.shipments
    .filter(
      (sh) =>
        activeShop &&
        sh.destinationId === activeShop.shopId &&
        sh.status === 'DELIVERED' &&
        (sh.actualArrivalDay ?? 0) >= state.day - 1
    )
    .slice(0, 3);
  const activeLive = activeShop ? liveShopToday(activeShop, state.day, state.minutesIntoCurrentDay ?? 0) : null;
  const activeCollectable = activeShop ? Math.max(0, Math.floor(activeShop.cashAccountBalance - SHOP_CASH_KEEP)) : 0;
  const activeGroup: 'TEZGAH' | 'EKIP' | 'BUYUME' =
    shopActionTab === 'ORDER_PRODUCT' || shopActionTab === 'EDIT_PRICES'
      ? 'TEZGAH'
      : shopActionTab === 'OPEN_BRANCH' || shopActionTab === 'UPGRADE_SHOP'
      ? 'BUYUME'
      : 'EKIP';
  const placeRestock = () => {
    if (!activeShop) return;
    for (const o of restockPlan.orders) {
      onPlaceProcurementOrder({
        supplierId: o.supplierId,
        resourceId: o.resourceId,
        quantity: o.quantity,
        destinationType: 'SHOP',
        destinationId: activeShop.shopId,
        paymentTermType: 'CASH',
      });
    }
  };
  const handleReviewAction = (hint: ReviewActionHint) => {
    setReviewsOpen(false);
    if (hint === 'RESTOCK') {
      placeRestock();
      setShopActionTab('ORDER_PRODUCT');
    } else if (hint === 'PRICE') {
      setShopActionTab('ORDER_PRODUCT');
    } else {
      setShopActionTab('MANAGE_STAFF');
    }
  };
  const activeShopTotalCap = activeShop
    ? activeShop.shelfCapacity + activeShop.backroomCapacity
    : 1;

  return (
    <div
      data-testid="esnaf-and-trade-panel"
      className="space-y-4 text-[var(--g-ink)]"
    >
      {reviewsOpen && activeShop && (
        <ShopReviewsSheet shop={activeShop} onClose={() => setReviewsOpen(false)} onAction={handleReviewAction} />
      )}
      {/* 1. KARİYER İLERLEME BARI & ANA MOD SEÇİCİ */}
      <div className="rounded-2xl flex flex-wrap items-center justify-between gap-2">
        <div className="hidden">
          <div className="text-[13px] font-bold uppercase tracking-wider text-amber-800">
            Kariyerin
          </div>
          <div
            data-testid="career-stage-badge"
            className="text-sm font-extrabold text-[var(--g-ink)] flex items-center gap-1.5 mt-0.5"
          >
            <Award className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {CAREER_STAGE_LABELS[trade.careerStage] || trade.careerStage}
            </span>
            <span className="text-xs tabular-nums font-semibold text-[var(--g-muted)]">
              · Ticari İtibar: {trade.tradeReputationScore.toFixed(0)}/100
            </span>
          </div>
        </div>

        <div className={`grid ${canSeeTradeCenter ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5 w-full bg-[var(--g-surface-2)] p-1 rounded-2xl border border-[var(--g-line)]`}>
          <button
            type="button"
            data-testid="mode-esnaf-shops-btn"
            onClick={() => setMainMode('SHOPS')}
            className={`min-h-[44px] px-3 py-1.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              mainMode === 'SHOPS'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-[var(--g-ink)] hover:bg-white'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Dükkânlarım ({trade.shops.length})</span>
          </button>
          {canSeeTradeCenter && (
          <button
            type="button"
            data-testid="mode-trade-center-btn"
            onClick={() => setMainMode('TRADE_CENTER')}
            className={`min-h-[44px] px-3 py-1.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              mainMode === 'TRADE_CENTER'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-[var(--g-ink)] hover:bg-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Toptan & Üretim</span>
          </button>
          )}
        </div>
      </div>

      {mainMode === 'SHOPS' || !canSeeTradeCenter ? (
        <div className="space-y-4">
          {/* ŞUBE SEÇİCİ + YENİ ŞUBE KISA YOLU */}
          <div
            className={`items-center justify-between gap-2 flex-wrap ${
              trade.shops.length > 1 ? 'flex' : 'hidden'
            }`}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              {trade.shops.map((sh) => (
                <button
                  key={sh.shopId}
                  type="button"
                  data-testid={`select-shop-${sh.shopId}`}
                  onClick={() => {
                    setSelectedShopId(sh.shopId);
                    if (shopActionTab === 'OPEN_BRANCH') {
                      setShopActionTab('ORDER_PRODUCT');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors flex items-center gap-1.5 ${
                    activeShop?.shopId === sh.shopId
                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                      : 'bg-[var(--g-surface)] text-[var(--g-ink)] border-[var(--g-line)] hover:bg-slate-50'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>{sh.nameTR}</span>
                  <span className="px-1.5 py-0.2 rounded bg-black/15 text-[13px] tabular-nums">
                    Sv.{sh.level}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              data-testid="shop-action-open-branch-shortcut"
              onClick={() => setShopActionTab('OPEN_BRANCH')}
              className="g-btn g-btn-primary px-3 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Şube / İlk Dükkân Aç</span>
            </button>
          </div>

          {/* SEÇİLİ DÜKKÂN: vitrin → durum şeridi → kasa → 3 sekme */}
          {activeShop ? (
            <div data-testid="active-shop-summary-card" className="g-card overflow-hidden p-2.5 space-y-3">
              {(() => {
                const st = shopOpenStatus(activeShop.shopType, state.minutesIntoCurrentDay ?? 0);
                return (
                  <ShopStorefront
                    shopType={activeShop.shopType}
                    name={activeShop.nameTR}
                    typeLabel={activeShopTemplate?.nameTR}
                    level={activeShop.level}
                    fillRatio={activeShopUsedUnits / Math.max(1, activeShopTotalCap)}
                    open={st.open}
                    openLabel={`${st.label} · ${shopHoursLabel(activeShop.shopType)}`}
                    stars={shopStars(activeShop)}
                    liveProfit={activeLive?.profit}
                    formatCurrency={formatCurrency}
                    onOpenRating={() => setReviewsOpen(true)}
                  />
                );
              })()}

              <div className="px-1 space-y-3">
                {/* Tek satır durum şeridi: kasa · raf · yolda (raf sayısı yalnızca burada yazılır) */}
                <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--g-muted)]" data-testid="shop-status-strip">
                  <span>
                    Kasa{' '}
                    <b data-testid="shop-metric-cash" className="g-display text-[15px] text-[var(--g-gold-dark)] tabular-nums">
                      {formatCurrency(activeShop.cashAccountBalance)}
                    </b>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Raf{' '}
                    <b
                      data-testid="shop-metric-critical-stock"
                      className={`tabular-nums ${
                        activeShopUsedUnits <= 0
                          ? 'text-[var(--g-red)]'
                          : activeShopUsedUnits < activeShop.shelfCapacity * 0.25
                          ? 'text-[var(--g-gold-dark)]'
                          : 'text-[var(--g-green-dark)]'
                      }`}
                    >
                      {activeShopUsedUnits.toFixed(0)}/{activeShopTotalCap}
                    </b>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Yolda <b data-testid="shop-metric-pending-deliveries" className="tabular-nums text-[var(--g-ink)]">{activeShop.pendingDeliveriesCount}</b>
                  </span>
                  <button
                    type="button"
                    data-testid="shop-summary-details-toggle"
                    aria-label={showSummaryDetails ? 'Dünkü özeti gizle' : 'Dünkü özeti göster'}
                    aria-expanded={showSummaryDetails}
                    onClick={() => setShowSummaryDetails((v) => !v)}
                    className="ml-auto relative w-9 h-9 shrink-0 rounded-full bg-[var(--g-surface-2)] text-[var(--g-ink)] flex items-center justify-center before:content-[''] before:absolute before:-inset-1"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
                <div data-testid="shop-shelf-bar" className="g-track h-2.5" aria-hidden="true">
                  <div
                    className={
                      activeShopUsedUnits < activeShop.shelfCapacity * 0.1
                        ? 'g-fill g-fill-danger'
                        : 'g-fill'
                    }
                    style={{
                      width: `${Math.min(100, (activeShopUsedUnits / Math.max(1, activeShopTotalCap)) * 100)}%`,
                      ...(activeShopUsedUnits >= activeShop.shelfCapacity * 0.1 && activeShopUsedUnits < activeShop.shelfCapacity * 0.25
                        ? { background: 'var(--g-gold)' }
                        : {}),
                    }}
                  />
                </div>

                <div className={showSummaryDetails ? 'space-y-3' : 'hidden'} data-testid="shop-summary-details">
                {/* Bugünün özeti */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-[var(--g-surface-2)] p-2.5">
                    <div className="text-[13px] text-[var(--g-muted)]">Dünkü satış</div>
                    <div
                      data-testid="shop-metric-daily-revenue"
                      className="text-sm tabular-nums font-extrabold text-[var(--g-ink)]"
                    >
                      {formatCurrency(activeShop.todaySalesRevenue)}
                      <span className="text-[13px] font-semibold text-[var(--g-muted)]">
                        {' '}
                        ({activeShop.todayUnitsSold} adet)
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[var(--g-surface-2)] p-2.5">
                    <div className="text-[13px] text-[var(--g-muted)]">
                      Dünkü kâr
                      <HelpTip text="Satıştan elde edilen para eksi malın maliyeti, personel ve kira giderleri." />
                    </div>
                    <div
                      data-testid="shop-metric-daily-profit"
                      className={`text-sm tabular-nums font-extrabold ${
                        activeShop.todayNetProfit >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {activeShop.todayNetProfit >= 0 ? '+' : ''}
                      {formatCurrency(activeShop.todayNetProfit)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--g-surface-2)] px-3 py-2 text-sm">
                  <span className="font-semibold text-[var(--g-ink)]">
                    Müşteri memnuniyeti
                    <HelpTip text="Müşteriler raflar doluysa, fiyatlar makulse ve dükkân gelişmişse memnun olur. Memnuniyet yüksekse daha çok müşteri gelir." />
                  </span>
                  <strong
                    data-testid="shop-metric-satisfaction"
                    className="tabular-nums text-[var(--g-ink)]"
                  >
                    %{activeShop.customerSatisfaction.toFixed(0)}
                    <span className="hidden"> · İtibar {activeShop.reputationScore.toFixed(0)}</span>
                  </strong>
                </div>

                {/* İpucu: ana sorun + önerilen işlem tek kutuda */}
                <div className="g-card-soft p-3 space-y-1">
                  <div className="text-sm font-extrabold text-amber-900">İpucu</div>
                  <div
                    data-testid="shop-metric-main-issue"
                    className="text-[13px] font-semibold text-[var(--g-ink)]"
                  >
                    {activeShop.mainIssueTR}
                  </div>
                  <div
                    data-testid="shop-metric-recommended-action"
                    className="text-[13px] text-[var(--g-ink)]"
                  >
                    {activeShop.recommendedActionTR}
                  </div>
                </div>

                </div>

                {/* Kasa: Kârı Topla + küçük "+Aktar" */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="shop-collect-profit-btn"
                    disabled={activeCollectable < SHOP_COLLECT_MIN}
                    onClick={() =>
                      onTransferShopCash({
                        shopId: activeShop.shopId,
                        direction: 'FROM_SHOP',
                        amount: activeCollectable,
                      })
                    }
                    className="g-btn g-btn-gold flex-1 min-h-[52px] !px-2"
                  >
                    Kârı Topla · {formatCurrency(activeCollectable)}
                  </button>
                  <button
                    type="button"
                    data-testid="shop-transfer-open-btn"
                    aria-expanded={showTransferTools}
                    onClick={() => setShowTransferTools((v) => !v)}
                    className="g-btn g-btn-secondary min-h-[52px] !px-3 shrink-0"
                  >
                    +Aktar
                  </button>
                  <HelpTip text="Kişisel paranla dükkân kasası ayrıdır. Mal almak için kasada para olmalı; kârı da kasadan cebine çekersin." />
                </div>
                {showTransferTools && (
                  <div className="grid grid-cols-4 gap-1.5" data-testid="shop-transfer-amounts">
                    {[5_000, 10_000, 25_000, 100_000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        data-testid={`shop-transfer-amount-${amt}`}
                        onClick={() => {
                          onTransferShopCash({ shopId: activeShop.shopId, direction: 'TO_SHOP', amount: amt });
                          setShowTransferTools(false);
                        }}
                        className="g-choice min-h-[44px] text-[13px] tabular-nums"
                      >
                        +{amt / 1000}B
                      </button>
                    ))}
                  </div>
                )}

                {/* 3 ana sekme (iç içe ikinci sekme çubuğu yok) */}
                <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[var(--g-surface-2)] p-1" role="tablist" aria-label="Dükkân bölümleri">
                  {(
                    [
                      { id: 'TEZGAH', label: 'Tezgâh', first: 'ORDER_PRODUCT' },
                      { id: 'EKIP', label: 'Ekip & Geliştir', first: 'MANAGE_STAFF' },
                      { id: 'BUYUME', label: 'Büyüme', first: 'UPGRADE_SHOP' },
                    ] as const
                  ).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      role="tab"
                      aria-selected={activeGroup === g.id}
                      data-testid={`shop-group-tab-${g.id}`}
                      onClick={() => {
                        if (activeGroup !== g.id) setShopActionTab(g.first);
                      }}
                      className={`min-h-[48px] rounded-xl px-1 text-[13px] font-extrabold leading-tight ${
                        activeGroup === g.id
                          ? 'bg-[var(--g-navy-800)] text-white shadow-[0_3px_0_var(--g-navy-900)]'
                          : 'text-[var(--g-muted)]'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                {/* Eski alt işlem kimlikleri (testler ve kısayollar için DOM'da gizli durur) */}
                <div className="hidden">
                  {(['ORDER_PRODUCT', 'EDIT_PRICES', 'MANAGE_STAFF', 'UPGRADE_SHOP', 'OPEN_BRANCH'] as const).map((id) => (
                    <button key={id} type="button" data-testid={`shop-action-tab-${id}`} onClick={() => setShopActionTab(id)}>
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <FirstShopGateCard state={state} />
          )}

          {/* TEZGÂH: son yorum, rafları doldur, yoldakiler */}
          {activeGroup === 'TEZGAH' && activeShop && (() => {
            const latest = activeShop.recentReviews?.[0];
            const allowedIds = activeShopTemplate?.allowedResourceIds ?? [];
            const missingKinds = allowedIds.filter(
              (id) =>
                !activeShop.inventoryBatches.some((b) => b.resourceId === id && b.availableQuantity > 0) &&
                !inboundShipments.some((sh) => sh.resourceId === id)
            );
            return (
              <div className="space-y-3">
                {latest && (
                  <div data-testid="shop-latest-review" className="g-card p-3 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setReviewsOpen(true)}
                      className="min-w-0 flex-1 text-left"
                      aria-label="Bütün yorumları aç"
                    >
                      <div className="flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--g-ink)]">
                        {latest.authorName} <StarRow stars={latest.stars} size="w-3.5 h-3.5" />
                      </div>
                      <div className="text-[13px] text-[var(--g-muted)] truncate">“{latest.textTR}”</div>
                    </button>
                    {latest.actionHint && (
                      <button
                        type="button"
                        data-testid="shop-latest-review-action"
                        onClick={() => handleReviewAction(latest.actionHint as ReviewActionHint)}
                        className="g-btn g-btn-secondary g-btn-sm shrink-0"
                      >
                        {REVIEW_ACTION_LABEL_TR[latest.actionHint]}
                      </button>
                    )}
                  </div>
                )}

                <div data-testid="shop-restock-card" className="g-card p-3 space-y-2" style={{ background: 'var(--g-soft-green)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="g-display text-lg font-extrabold text-[var(--g-ink)]">Rafları Doldur</div>
                      <div className="text-[13px] font-semibold text-[var(--g-muted)]">
                        {restockPlan.orders.length === 0
                          ? 'Raflar zaten dolu ya da paran yetmiyor.'
                          : `${restockPlan.orders.length} ürün · ${formatCurrency(restockPlan.totalCost)} · ${
                              restockPlan.maxDeliveryDays <= 1 ? 'yarın gelir' : `en geç ${restockPlan.maxDeliveryDays} günde gelir`
                            }`}
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid="shop-restock-all-btn"
                      disabled={restockPlan.orders.length === 0}
                      onClick={placeRestock}
                      className="g-btn g-btn-primary min-h-[52px] px-5 shrink-0"
                    >
                      Doldur
                    </button>
                  </div>
                  {missingKinds.length > 0 && (
                    <div data-testid="shop-restock-missing" className="text-[13px] font-bold text-[var(--g-red)]">
                      Rafta yok: {missingKinds.map((id) => RESOURCE_CATALOG[id]?.nameTR ?? id).join(', ')}
                    </div>
                  )}
                </div>

                {inboundShipments.length > 0 && (
                  <div data-testid="shop-inbound-strip" className="g-card-soft p-2.5 space-y-1.5">
                    <div className="text-[13px] font-extrabold text-[var(--g-ink)]">Yoldaki siparişler</div>
                    {inboundShipments.slice(0, 4).map((sh) => (
                      <div key={sh.shipmentId} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="font-bold text-[var(--g-ink)] truncate">
                          {sh.resourceNameTR} · {sh.quantity} adet
                        </span>
                        <span className="g-pill shrink-0 bg-[var(--g-surface)] text-[var(--g-ink)]">
                          {sh.estimatedArrivalDay <= state.day ? 'Bugün' : `${sh.estimatedArrivalDay - state.day} gün`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* SEÇİLİ İŞLEM SEKMESİ İÇERİĞİ */}
          {activeGroup === 'TEZGAH' && activeShop && (
            <div
              data-testid="shop-order-product-box"
              className="g-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h5 className="g-section-title">Mal al</h5>
                <span className="text-[13px] tabular-nums text-[var(--g-muted)]">
                  Kasa: {formatCurrency(activeShop.cashAccountBalance)} · Cebin:{' '}
                  {formatCurrency(spendableCash)}
                </span>
              </div>

              {/* Hızlı "Mal al": her ürün için en ucuz toptancıdan tek dokunuşla sipariş */}
              <div className="space-y-2" data-testid="shop-quick-order-list">
                {(activeShopTemplate?.allowedResourceIds ?? []).map((prodId) => {
                  const resDef = RESOURCE_CATALOG[prodId];
                  const batch = activeShop.inventoryBatches.find(
                    (b) => b.resourceId === prodId
                  );
                  const qty = batch ? batch.quantity : 0;
                  const best = TradeAndShopEngine.getSupplierOffers(state, prodId, activeShop)
                    .filter((o) => o.maxAvailableQuantity >= o.minOrderQuantity)
                    .sort(
                      (x, y) =>
                        x.unitPrice + x.shippingCostPerUnit -
                        (y.unitPrice + y.shippingCostPerUnit)
                    )[0];
                  const unit = best ? best.unitPrice + best.shippingCostPerUnit : 0;
                  return (
                    <div
                      key={prodId}
                      className="g-card-soft p-3 space-y-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-[var(--g-ink)] truncate">
                          {resDef?.nameTR || prodId}
                        </div>
                        <div className="text-[13px] text-[var(--g-muted)]">
                          Rafta:{' '}
                          <strong
                            className={qty <= 5 ? 'text-rose-600' : 'text-emerald-700'}
                          >
                            {qty.toFixed(0)} adet
                          </strong>
                          {best && (
                            <>
                              {' '}
                              · {formatCurrency(unit)}/adet · {best.deliveryDays} günde gelir
                            </>
                          )}
                        </div>
                      </div>
                      {(() => {
                        const fairP = Number(((resDef?.baseMarketPrice ?? 100) * (1 + (activeShopTemplate?.defaultGrossMarginPct ?? 30) / 100)).toFixed(2));
                        const saved = (activeShop.sellingPrices[prodId] ?? fairP) / Math.max(1, fairP);
                        const mult = priceDrafts[prodId] ?? saved;
                        const price = fairP * mult;
                        const margin = unit > 0 ? Math.round(((price - unit) / Math.max(1, price)) * 100) : null;
                        const fairScore = priceRatioScore(mult);
                        const commit = () => {
                          const v = priceDrafts[prodId];
                          if (v === undefined) return;
                          onConfigureShop({ shopId: activeShop.shopId, priceMultipliers: { [prodId]: v } });
                          setPriceDrafts((d) => {
                            const n = { ...d };
                            delete n[prodId];
                            return n;
                          });
                        };
                        return (
                          <div className="space-y-1" data-testid={`shop-price-slider-box-${prodId}`}>
                            <div className="flex items-center justify-between text-[13px] font-bold">
                              <span className="text-[var(--g-muted)]">Satış fiyatı</span>
                              <span className="tabular-nums text-[var(--g-ink)]">
                                {formatCurrency(price)}
                                {margin !== null && <span className="text-[var(--g-muted)]"> · kâr %{margin}</span>}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.8}
                              max={1.6}
                              step={0.01}
                              value={mult}
                              data-testid={`shop-price-slider-${prodId}`}
                              aria-label={`${resDef?.nameTR ?? prodId} satış fiyatı`}
                              onChange={(e) => setPriceDrafts((d) => ({ ...d, [prodId]: Number(e.target.value) }))}
                              onPointerUp={commit}
                              onKeyUp={commit}
                              onBlur={commit}
                              className="w-full accent-[var(--g-gold)]"
                            />
                            <div
                              className={`text-[13px] font-bold ${
                                fairScore >= 85 ? 'text-[var(--g-green-dark)]' : fairScore >= 65 ? 'text-[var(--g-gold-dark)]' : 'text-[var(--g-red)]'
                              }`}
                            >
                              {fairScore >= 85 ? 'Adil fiyat' : fairScore >= 65 ? 'Biraz pahalı' : fairScore >= 35 ? 'Pahalı: müşteri kaçar' : 'Aşırı pahalı'}
                            </div>
                          </div>
                        );
                      })()}
                      {best ? (
                        <div className="grid grid-cols-3 gap-2">
                          {[10, 50, 100].map((n) => {
                            const q = Math.min(
                              best.maxAvailableQuantity,
                              Math.max(best.minOrderQuantity, n)
                            );
                            return (
                              <button
                                key={n}
                                type="button"
                                data-testid={`shop-quick-order-${prodId}-${n}`}
                                onClick={() =>
                                  onPlaceProcurementOrder({
                                    supplierId: best.supplierId,
                                    resourceId: prodId,
                                    quantity: q,
                                    destinationType: 'SHOP',
                                    destinationId: activeShop.shopId,
                                    paymentTermType: 'CASH',
                                  })
                                }
                                className="g-btn g-btn-primary flex-col !gap-0 !px-1 min-h-[56px]"
                              >
                                <span className="g-display text-lg leading-none">+{q}</span>
                                <span className="block text-[12px] font-bold opacity-90 tabular-nums">
                                  {formatCurrency(q * unit)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[13px] text-rose-700 font-semibold">
                          Şu an bu ürünü satan toptancı yok.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="shop-advanced-order-toggle"
                onClick={() => setShowAdvancedOrder((v) => !v)}
                className="g-btn g-btn-secondary w-full"
              >
                {showAdvancedOrder
                  ? '▲ Gelişmiş siparişi gizle'
                  : '▼ Gelişmiş sipariş (tedarikçi ve ödeme seç)'}
              </button>

              <div className={showAdvancedOrder ? 'space-y-3' : 'hidden'}>
              {/* Mevcut Raf Stokları */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(activeShopTemplate?.allowedResourceIds ?? []).map(
                  (prodId) => {
                    const resDef = RESOURCE_CATALOG[prodId];
                    const batch = activeShop.inventoryBatches.find(
                      (b) => b.resourceId === prodId
                    );
                    const qty = batch ? batch.quantity : 0;
                    return (
                      <button
                        key={prodId}
                        type="button"
                        onClick={() => {
                          setSelectedResourceId(prodId);
                          const matchingSup = trade.suppliers.find((s) =>
                            s.suppliedResourceIds.includes(prodId)
                          );
                          if (matchingSup) {
                            setSelectedSupplierId(matchingSup.supplierId);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                          selectedResourceId === prodId
                            ? 'bg-sky-50 border-sky-400'
                            : 'bg-[var(--g-surface-2)] border-[var(--g-line)] hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-bold text-[var(--g-ink)]">
                          {resDef?.nameTR || prodId}
                        </div>
                        <div className="text-[13px] tabular-nums text-[var(--g-muted)] mt-0.5">
                          Raf Stoku:{' '}
                          <strong
                            className={
                              qty <= 5 ? 'text-rose-600' : 'text-emerald-700'
                            }
                          >
                            {qty.toFixed(0)} br
                          </strong>{' '}
                          · Maliyet:{' '}
                          {batch
                            ? formatCurrency(batch.unitCost)
                            : formatCurrency(resDef?.baseMarketPrice ?? 0)}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>

              {/* Tedarikçi Teklifleri ve Sipariş Butonu */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="block text-[13px] font-semibold text-[var(--g-muted)] mb-1">
                    Tedarikçi Seçimi
                  </label>
                  <select
                    data-testid="shop-order-supplier-select"
                    value={activeOffer?.supplierId ?? ''}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--g-surface-2)] border border-[var(--g-line)] text-xs font-semibold text-[var(--g-ink)]"
                  >
                    {supplierOffers.map((off) => (
                      <option key={off.supplierId} value={off.supplierId}>
                        {off.supplierNameTR} ({formatCurrency(off.unitPrice)}/br
                        · {off.deliveryDays}g teslim)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[var(--g-muted)] mb-1">
                    Sipariş Miktarı (Birim)
                  </label>
                  <NumberInput
                    data-testid="shop-order-quantity-input"
                    
                    min={5}
                    max={500}
                    step={5}
                    value={orderQuantity}
                    onChange={(e) =>
                      setOrderQuantity(
                        Math.max(1, Number(e.target.value) || 10)
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[var(--g-surface-2)] border border-[var(--g-line)] text-xs tabular-nums font-bold text-[var(--g-ink)]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[var(--g-muted)] mb-1">
                    Ödeme Şekli
                  </label>
                  <select
                    data-testid="shop-order-payment-select"
                    value={orderPaymentTerm}
                    onChange={(e) =>
                      setOrderPaymentTerm(e.target.value as PaymentTermType)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[var(--g-surface-2)] border border-[var(--g-line)] text-xs font-semibold text-[var(--g-ink)]"
                  >
                    <option value="CASH">Peşin Ödeme</option>
                    <option value="CREDIT">Vadeli Tedarikçi Faturası</option>
                  </select>
                </div>
              </div>


              {activeOffer && (
                <div className="p-3 rounded-xl bg-[var(--g-surface-2)] border border-[var(--g-line)] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-[var(--g-muted)]">Tahmini Toplam: </span>
                    <strong className="tabular-nums text-[var(--g-ink)]">
                      {formatCurrency(
                        orderQuantity *
                          (activeOffer.unitPrice +
                            activeOffer.shippingCostPerUnit)
                      )}
                    </strong>
                    <span className="text-[var(--g-muted)] ml-2">
                      (Teslim Süresi: {activeOffer.deliveryDays} oyun günü ·
                      Kalite {activeOffer.qualityScore}/100)
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="shop-place-order-submit-btn"
                    onClick={() =>
                      onPlaceProcurementOrder({
                        supplierId: activeOffer.supplierId,
                        resourceId: selectedResourceId,
                        quantity: orderQuantity,
                        destinationType: 'SHOP',
                        destinationId: activeShop.shopId,
                        paymentTermType: orderPaymentTerm,
                      })
                    }
                    className="g-btn g-btn-gold px-4"
                  >
                    Siparişi Onayla ve Sevk Et
                  </button>
                </div>
              )}
              </div>
            </div>
          )}

          {activeGroup === 'EKIP' && activeShop && !activeShop.isCompanyBranch && (() => {
            const mq = getManagerQuote(state, activeShop, Math.max(0, state.cash - spendableCash));
            const mgr = activeShop.manager;
            return (
              <div data-testid="shop-manager-box" className="g-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="g-section-title flex items-center gap-2">
                    <UserCog className="w-5 h-5 text-[var(--g-navy-600)]" /> Müdür
                  </div>
                  {mgr ? (
                    <span className="g-pill bg-[#ecfaf3] text-[var(--g-green-dark)]">Çalışıyor</span>
                  ) : activeShop.level < MANAGER_MIN_SHOP_LEVEL ? (
                    <span className="g-pill bg-[var(--g-surface-2)] text-[var(--g-muted)]">
                      <Lock className="w-3.5 h-3.5" /> Seviye {MANAGER_MIN_SHOP_LEVEL}
                    </span>
                  ) : null}
                </div>

                {mgr ? (
                  <>
                    <div className="g-hero p-4 space-y-2">
                      <div className="g-hero-label">Müdürün sana gönderdiği kâr</div>
                      <div className="g-hero-value text-[32px]">{formatCurrency(mgr.totalSweptToPlayer)}</div>
                      <div className="text-[13px] font-bold text-white/70">Son gün: {mgr.lastActionTR}</div>
                    </div>
                    {mgr.lowCash && (
                      <div className="g-tip">Kasa boş, müdür mal alamıyor. Kasaya para koy.</div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-center tabular-nums">
                      <div className="g-card-soft p-2.5">
                        <div className="text-[13px] font-bold text-[var(--g-muted)]">Sabit maaş</div>
                        <div className="font-extrabold">{formatCurrency(mgr.dailyWage)}/gün</div>
                      </div>
                      <div className="g-card-soft p-2.5">
                        <div className="text-[13px] font-bold text-[var(--g-muted)]">Bugünkü prim</div>
                        <div className="font-extrabold">{formatCurrency(mgr.todayBonus ?? 0)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        data-testid="shop-manager-sweep-toggle"
                        data-active={mgr.sweepProfits ? 'true' : 'false'}
                        onClick={() => onSetShopManagerSweep?.(activeShop.shopId, !mgr.sweepProfits)}
                        className="g-choice px-2 text-sm"
                      >
                        {mgr.sweepProfits ? 'Kârı bana gönderiyor' : 'Kâr kasada birikiyor'}
                      </button>
                      <button
                        type="button"
                        data-testid="shop-manager-fire-btn"
                        onClick={() => onFireShopManager?.(activeShop.shopId)}
                        className="g-btn g-btn-secondary text-sm"
                      >
                        Görevden al
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-[var(--g-muted)] leading-snug">
                      Müdür rafları dükkân kasasıyla kendisi doldurur, biriken kârı sana gönderir. Sen uğraşmazsın, biraz daha az kazanırsın.
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                      <div className="g-card-soft p-2.5">
                        <div className="text-[13px] font-bold text-[var(--g-muted)]">Maaş</div>
                        <div className="font-extrabold text-sm">{formatCurrency(mq.dailyWage)}/gün</div>
                      </div>
                      <div className="g-card-soft p-2.5">
                        <div className="text-[13px] font-bold text-[var(--g-muted)]">Prim</div>
                        <div className="font-extrabold text-sm">Kârın %{Math.round(MANAGER_PROFIT_SHARE * 100)}'i</div>
                      </div>
                      <div className="g-card-soft p-2.5">
                        <div className="text-[13px] font-bold text-[var(--g-muted)]">Başlarken</div>
                        <div className="font-extrabold text-sm">{formatCurrency(mq.hireFee + mq.topUp)}</div>
                      </div>
                    </div>
                    {mq.topUp > 0 && (
                      <div className="text-[13px] font-semibold text-[var(--g-muted)] text-center">
                        İşe alma {formatCurrency(mq.hireFee)} + kasaya işletme parası {formatCurrency(mq.topUp)}
                      </div>
                    )}
                    {activeShop.level < MANAGER_MIN_SHOP_LEVEL ? (
                      <button
                        type="button"
                        onClick={() => setShopActionTab('UPGRADE_SHOP')}
                        className="g-btn g-btn-navy w-full"
                      >
                        Önce dükkânı {MANAGER_MIN_SHOP_LEVEL}. seviyeye yükselt
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-testid="shop-manager-hire-btn"
                        disabled={!mq.allowed || !onHireShopManager}
                        onClick={() => onHireShopManager?.(activeShop.shopId)}
                        className="g-btn g-btn-gold w-full"
                      >
                        {mq.allowed ? 'Müdür tut' : mq.reasonTR}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {activeGroup === 'EKIP' && activeShop && (
            <div
              data-testid="shop-manage-staff-box"
              className="g-card p-4 space-y-4"
            >
              <div className="g-section-title">
                Çalışanlar
              </div>
              <div className="g-hero p-5 text-center">
                <div className="text-5xl font-extrabold tabular-nums g-hero-value">
                  {activeShop.staffCount}
                </div>
                <div className="text-sm font-bold text-white/65 mt-1">
                  {activeShop.ownerWorks && activeShop.staffCount <= 0
                    ? 'çalışan · dükkânı sen yürütüyorsun'
                    : `çalışan · en az ${activeShop.minStaffRequired} gerekli`}
                </div>
              </div>
              {firstEmployeeQuote && activeShop.staffCount <= 0 && (
                <div data-testid="shop-first-hire-card" className="g-card-soft p-4 space-y-3 text-center">
                  <div className="font-extrabold text-[var(--g-ink)]">İlk çalışanını işe al</div>
                  <div className="text-sm text-[var(--g-ink)]">
                    Şu an dükkân kapasitenin %{Math.round(OWNER_STAFF_CAPACITY * 100)}'ı ile çalışıyor. Çalışan alınca müşteri
                    sayısı tam kapasiteye çıkar.
                  </div>
                  <div className="text-sm font-bold tabular-nums text-[var(--g-ink)]">
                    İşe alma {formatCurrency(firstEmployeeQuote.fee)} · sonra günde {formatCurrency(firstEmployeeQuote.dailyWage)} maaş
                  </div>
                  <button
                    type="button"
                    data-testid="shop-first-hire-btn"
                    disabled={!firstEmployeeQuote.allowed || !onHireFirstEmployee}
                    onClick={() => onHireFirstEmployee?.(activeShop.shopId)}
                    className="g-btn g-btn-primary w-full"
                  >
                    İlk çalışanını işe al
                  </button>
                  {!firstEmployeeQuote.allowed && (
                    <div className="text-[13px] font-semibold text-rose-700">{firstEmployeeQuote.reasonTR}</div>
                  )}
                </div>
              )}
              <div
                data-testid="shop-staff-wage-card"
                className="g-card-soft p-4 text-center tabular-nums"
              >
                <div className="text-sm font-bold text-rose-800">Günlük maaş</div>
                <div className="text-3xl font-extrabold text-rose-700">
                  {formatCurrency(activeShop.staffCount * activeShop.staffDailyWagePerPerson)}
                </div>
                <div className="text-[13px] text-rose-700 mt-1">
                  kişi başı {formatCurrency(activeShop.staffDailyWagePerPerson)} · her gün kasadan otomatik ödenir
                </div>
                <div data-testid="shop-staff-city-services" className="text-[13px] font-bold text-rose-800 mt-1">
                  Eğitimli {trainedStaffCount(activeShop)}/{activeShop.staffCount} ·{' '}
                  {activeShop.staffInsurance
                    ? `Sigortalı (günde ${formatCurrency(insuranceDailyPremium(activeShop))} prim)`
                    : 'Sigortasız'}
                </div>
              </div>
              <div className={activeShop.ownerWorks && activeShop.staffCount <= 0 ? 'hidden' : 'grid grid-cols-2 gap-3'}>
                <button
                  type="button"
                  data-testid="shop-hire-1-btn"
                  onClick={() =>
                    onConfigureShop({ shopId: activeShop.shopId, staffDelta: 1 })
                  }
                  className="g-btn g-btn-primary"
                >
                  1 kişi al
                </button>
                <button
                  type="button"
                  data-testid="shop-hire-3-btn"
                  onClick={() =>
                    onConfigureShop({ shopId: activeShop.shopId, staffDelta: 3 })
                  }
                  className="g-btn g-btn-navy"
                >
                  3 kişi al
                </button>
              </div>
              <button
                type="button"
                data-testid="shop-fire-1-btn"
                onClick={() =>
                  onConfigureShop({ shopId: activeShop.shopId, staffDelta: -1 })
                }
                className="g-btn g-btn-secondary w-full"
              >
                1 kişiyi çıkar
              </button>
              <div className="text-[13px] text-[var(--g-muted)] text-center">
                Çok çalışan = hızlı satış, ama maaş gideri de artar.
              </div>
            </div>
          )}

          {(activeGroup === 'EKIP' || activeGroup === 'BUYUME') && activeShop && (
            <div
              data-testid="shop-upgrade-box"
              className="g-card p-4 space-y-4"
            >
              {activeGroup === 'BUYUME' && (
              <>
              <div className="g-section-title">
                Dükkân seviyesi
              </div>
              <div className="g-hero p-5 text-center">
                <div className="text-4xl font-extrabold g-hero-value">
                  Seviye {activeShop.level}
                  {activeShop.level < 5 && (
                    <span className="text-white/65"> → {activeShop.level + 1}</span>
                  )}
                </div>
                <div className="text-sm font-bold text-white/65 mt-2">
                  Daha büyük raf, %45 daha çok müşteri
                </div>
              </div>
              <button
                type="button"
                data-testid="shop-upgrade-confirm-btn"
                disabled={activeShop.level >= 5}
                onClick={() => onUpgradeShopLevel(activeShop.shopId)}
                className="g-btn g-btn-gold w-full"
              >
                {activeShop.level >= 5
                  ? 'En üst seviye'
                  : `Seviye ${activeShop.level + 1}'e yükselt`}
              </button>
              </>
              )}

              {activeGroup === 'EKIP' && !activeShop.isCompanyBranch && (
                <div data-testid="shop-small-upgrades" className="space-y-2 pt-1">
                  <div className="g-section-title">Küçük yükseltmeler</div>
                  <div className="grid grid-cols-2 gap-2">
                  {listShopUpgrades(activeShop).map((u) => {
                    const canPay = spendableCash + activeShop.cashAccountBalance >= u.cost;
                    return (
                      <div
                        key={u.def.id}
                        data-testid={`shop-small-upgrade-${u.def.id}`}
                        data-status={u.status}
                        className={`flex flex-col justify-between gap-2 p-3 rounded-2xl border ${
                          u.status === 'OWNED'
                            ? 'border-[var(--g-green)] bg-[var(--g-soft-green)]'
                            : 'border-[var(--g-line)] bg-[var(--g-surface-2)] shadow-[0_3px_0_var(--g-line-strong)]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-extrabold text-[var(--g-ink)] leading-tight">{u.def.name}</div>
                          <div className="text-[13px] font-bold text-[var(--g-green-dark)]">{u.def.effectLabel}</div>
                          {u.usedUntilDay !== undefined && (
                            <div data-testid={`shop-small-upgrade-used-${u.def.id}`} className="text-[13px] font-bold text-[var(--g-gold-dark,#b7791f)]">
                              İkinci el · {Math.max(0, u.usedUntilDay - state.day + 1)} gün kaldı
                            </div>
                          )}
                        </div>
                        {u.status === 'OWNED' ? (
                          <span className="g-pill self-start bg-[var(--g-surface)] text-[var(--g-green-dark)] shrink-0">
                            <Check size={14} strokeWidth={3} /> Var
                          </span>
                        ) : u.status === 'LOCKED' ? (
                          <span className="text-[13px] font-bold text-[var(--g-muted)] shrink-0">
                            Seviye {u.def.minLevel} gerekir
                          </span>
                        ) : (
                          <button
                            type="button"
                            data-testid={`shop-small-upgrade-buy-${u.def.id}`}
                            disabled={!canPay || !onBuyShopUpgrade}
                            onClick={() => onBuyShopUpgrade?.(activeShop.shopId, u.def.id)}
                            className="g-btn g-btn-primary g-btn-sm w-full px-3 tabular-nums"
                          >
                            {formatCurrency(u.cost).replace(/,00$/, '')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeGroup === 'BUYUME' && (
            <div
              data-testid="shop-open-branch-box"
              className="g-card p-4 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="g-section-title">
                  Yeni dükkân
                </div>
                <span className="text-sm tabular-nums font-bold text-emerald-700">
                  {formatCurrency(spendableCash)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {ALL_SHOP_TEMPLATES.map((tpl) => {
                  const totalCost =
                    tpl.openingCost + tpl.decorationCost + newShopCashFloat;
                  const selected = newShopType === tpl.shopType;
                  return (
                    <button
                      key={tpl.shopType}
                      type="button"
                      data-testid={`shop-type-card-${tpl.shopType}`}
                      onClick={() => setNewShopType(tpl.shopType)}
                      className={`p-3 rounded-3xl border-2 text-center cursor-pointer active:scale-95 ${
                        selected
                          ? 'bg-amber-50 border-amber-500 shadow'
                          : 'g-choice'
                      }`}
                    >
                      <div className="text-4xl">{SHOP_EMOJI[tpl.shopType] ?? '🏪'}</div>
                      <div className="text-sm font-extrabold text-[var(--g-ink)] mt-1">
                        {tpl.nameTR}
                      </div>
                      <div className="text-sm tabular-nums text-amber-800 font-bold mt-0.5">
                        {formatCurrency(tpl.openingCost + tpl.decorationCost)}
                      </div>
                      <div
                        data-testid={`shop-type-hours-${tpl.shopType}`}
                        className="text-[13px] tabular-nums text-[var(--g-muted)] font-semibold"
                      >
                        {shopHoursLabel(tpl.shopType)}
                      </div>
                      <div className="sr-only">
                        Kira: {formatCurrency(tpl.dailyRentBase)}/g · Marj %
                        {Math.round(tpl.defaultGrossMarginPct)} ·{' '}
                        {tpl.specificMechanicTitleTR} · Min.{tpl.minStaffRequired}{' '}
                        çalışan {totalCost}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-3xl bg-[var(--g-surface-2)] p-4 space-y-3">
                <div className="font-extrabold text-[var(--g-ink)] text-base">
                  {SHOP_EMOJI[selectedShopTemplateForNew.shopType] ?? '🏪'}{' '}
                  {selectedShopTemplateForNew.nameTR}
                </div>
                <div className="text-sm text-[var(--g-ink)]">
                  {selectedShopTemplateForNew.specificMechanicDescriptionTR}
                </div>
                <div className="text-sm text-[var(--g-ink)]">
                  Açık saatler: <b className="tabular-nums">{shopHoursLabel(selectedShopTemplateForNew.shopType)}</b>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Toplam</span>
                  <span className="tabular-nums text-amber-800">
                    {formatCurrency(
                      selectedShopTemplateForNew.openingCost +
                        selectedShopTemplateForNew.decorationCost +
                        newShopCashFloat
                    )}
                  </span>
                </div>
                <input
                  data-testid="new-shop-name-input"
                  type="text"
                  placeholder={`Dükkân adı (örn: Merkez ${selectedShopTemplateForNew.nameTR})`}
                  value={newShopCustomName}
                  onChange={(e) => setNewShopCustomName(e.target.value)}
                  className="w-full g-input text-sm"
                />
                <label className="block text-[13px] font-semibold text-[var(--g-muted)]">
                  Kasaya başlangıç parası
                  <NumberInput
                    data-testid="new-shop-cash-float-input"
                    
                    min={0}
                    max={500000}
                    step={2000}
                    value={newShopCashFloat}
                    onChange={(e) =>
                      setNewShopCashFloat(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="g-card mt-1 w-full min-h-[48px] px-3 text-sm tabular-nums font-bold"
                  />
                </label>
                <div data-testid="shop-opening-advice" className="g-card-soft p-3 space-y-1 text-sm text-[var(--g-ink)]">
                  <div className="flex justify-between font-bold">
                    <span>Önerilen işletme sermayesi</span>
                    <span data-testid="shop-opening-recommended" className="tabular-nums text-amber-800">
                      {formatCurrency(openingAdvice.recommendedWorkingCapital)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Açılıştan sonra elinde (kasa + cep)</span>
                    <span data-testid="shop-opening-liquid" className="tabular-nums font-bold">
                      {formatCurrency(openingAdvice.liquidAfterOpening)}
                    </span>
                  </div>
                  <div data-testid="shop-opening-runway" className="text-[13px] font-semibold text-[var(--g-muted)]">
                    İlk stok (~{formatCurrency(openingAdvice.firstStockCost)}), kira ve maaş düşünce yaklaşık{' '}
                    {openingAdvice.runwayDays} gün dayanır.
                  </div>
                  {openingAdvice.ownerWorks && (
                    <div data-testid="shop-opening-owner-note" className="text-[13px] font-semibold text-[var(--g-muted)]">
                      İlk dükkânda sen çalışırsın (kapasite %{Math.round(OWNER_STAFF_CAPACITY * 100)}). Çalışanı sonradan{' '}
                      {formatCurrency(FIRST_EMPLOYEE_HIRE_FEE_BUFE)} ile işe alırsın.
                    </div>
                  )}
                </div>
                {openingAdvice.belowRecommended && lowCashArmed && (
                  <div
                    data-testid="shop-opening-low-cash-warning"
                    className="rounded-2xl bg-rose-50 border-2 border-rose-400 p-3 text-sm font-bold text-rose-800"
                  >
                    Dikkat: açılıştan sonra elinde önerilenin altında para kalacak. Stok alamazsan satış başlamaz ve kira
                    kasayı eritir. Yine de açmak istiyorsan düğmeye bir kez daha bas.
                  </div>
                )}
                <button
                  type="button"
                  data-testid="confirm-open-shop-btn"
                  onClick={() => {
                    if (openingAdvice.belowRecommended && !lowCashArmed) {
                      setLowCashArmedKey(openingKey);
                      return;
                    }
                    setLowCashArmedKey(null);
                    onOpenShop({
                      shopType: newShopType,
                      customName: newShopCustomName.trim() || undefined,
                      initialCashFloat: newShopCashFloat,
                    });
                  }}
                  className={`g-btn w-full ${openingAdvice.belowRecommended && lowCashArmed ? 'g-btn-danger' : 'g-btn-primary'}`}
                >
                  {openingAdvice.belowRecommended && lowCashArmed
                    ? 'Yine de aç'
                    : `${selectedShopTemplateForNew.nameTR} aç`}
                </button>
              </div>
            </div>
          )}

          {/* BÖLÜM 8: ESNAFTAN ŞİRKETE GEÇİŞ (ŞİRKETLEŞME KARTI) — Büyüme sekmesinde */}
          {!state.playerCompany && (activeGroup === 'BUYUME' || !activeShop) && (
            <div
              data-testid="incorporation-transition-card"
              className="p-3 rounded-3xl bg-[var(--g-surface-2)] border border-teal-300 space-y-3"
            >
              <button
                type="button"
                data-testid="incorporation-toggle"
                onClick={() => setShowIncorp((v) => !v)}
                className="w-full min-h-[48px] flex items-center justify-between gap-2 text-left font-extrabold text-[var(--g-ink)]"
              >
                <span>Şirket kur</span>
                <span className="text-sm text-teal-700">
                  {incorporationEligibility.eligible ? 'Hazırsın!' : 'Koşullar var'}{' '}
                  {showIncorp ? '▲' : '▼'}
                </span>
              </button>
              <div className={showIncorp ? 'space-y-3' : 'hidden'}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-[13px] font-bold uppercase tracking-wider text-teal-800">
                    Esnaftan şirkete geçiş
                  </span>
                  <h5 className="text-sm font-extrabold text-[var(--g-ink)]">
                    İşletmeni Kurumsal Şirkete Dönüştür
                  </h5>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    incorporationEligibility.eligible
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {incorporationEligibility.eligible
                    ? 'Şirketleşmeye Hazır!'
                    : 'Koşullar Tamamlanıyor'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[13px]">
                {[
                  {
                    ok:
                      incorporationEligibility.activeShopBranchesCount >=
                      incorporationEligibility.minBranchesRequired,
                    text: `En az ${incorporationEligibility.minBranchesRequired} aktif şube (${incorporationEligibility.activeShopBranchesCount}/${incorporationEligibility.minBranchesRequired})`,
                  },
                  {
                    ok: incorporationEligibility.last30DaysOperatingProfit > 0,
                    text: `Son 30g pozitif faaliyet kârı (${formatCurrency(
                      incorporationEligibility.last30DaysOperatingProfit
                    )})`,
                  },
                  {
                    ok:
                      incorporationEligibility.totalShopStaffCount >=
                      incorporationEligibility.minStaffRequired,
                    text: `En az ${incorporationEligibility.minStaffRequired} çalışan (${incorporationEligibility.totalShopStaffCount}/${incorporationEligibility.minStaffRequired})`,
                  },
                  {
                    ok:
                      incorporationEligibility.totalBusinessValue >=
                      incorporationEligibility.minBusinessValueRequired,
                    text: `İşletme değeri >= 350B TL (${formatCurrency(
                      incorporationEligibility.totalBusinessValue
                    )})`,
                  },
                  {
                    ok: !incorporationEligibility.hasOverdueDebt,
                    text: 'Vadesi geçmiş borç bulunmaması',
                  },
                  {
                    ok:
                      incorporationEligibility.tradeReputationScore >=
                      incorporationEligibility.minReputationRequired,
                    text: `Ticari itibar >= ${incorporationEligibility.minReputationRequired} (${incorporationEligibility.tradeReputationScore.toFixed(
                      0
                    )}/${incorporationEligibility.minReputationRequired})`,
                  },
                ].map((c) => (
                  <div
                    key={c.text}
                    className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                      c.ok
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                        : 'bg-[var(--g-surface)] border-[var(--g-line)] text-[var(--g-muted)]'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        c.ok ? 'text-emerald-600' : 'text-slate-300'
                      }`}
                    />
                    <span className="font-medium">{c.text}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                <input
                  data-testid="incorporate-company-name-input"
                  type="text"
                  value={incorpName}
                  onChange={(e) => setIncorpName(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[var(--g-surface)] border border-[var(--g-line)] text-xs font-semibold"
                  placeholder="Şirket Adı"
                />
                <input
                  data-testid="incorporate-company-ticker-input"
                  type="text"
                  maxLength={5}
                  value={incorpTicker}
                  onChange={(e) =>
                    setIncorpTicker(e.target.value.toUpperCase())
                  }
                  className="px-3 py-2 rounded-xl bg-[var(--g-surface)] border border-[var(--g-line)] text-xs tabular-nums font-bold"
                  placeholder="Borsa Kodu"
                />
                <NumberInput
                  data-testid="incorporate-extra-cash-input"
                  
                  min={0}
                  step={25000}
                  value={incorpExtraCash}
                  onChange={(e) =>
                    setIncorpExtraCash(
                      Math.max(0, Number(e.target.value) || 0)
                    )
                  }
                  className="px-3 py-2 rounded-xl bg-[var(--g-surface)] border border-[var(--g-line)] text-xs tabular-nums font-bold"
                  placeholder="Ek Nakit Sermaye"
                />
                <button
                  type="button"
                  data-testid="incorporate-shops-submit-btn"
                  disabled={!incorporationEligibility.eligible}
                  onClick={() =>
                    onIncorporateShopsIntoCompany({
                      companyName: incorpName,
                      ticker: incorpTicker,
                      sector: incorpSector,
                      additionalCashCapital: incorpExtraCash,
                    })
                  }
                  className="g-btn g-btn-primary px-3"
                >
                  İşletmeni Kurumsal Şirkete Dönüştür
                </button>
              </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TİCARET MERKEZİ & TEDARİK ZİNCİRİ (4 TEMİZ SEKME: TEDARİK / TESLİMATLAR / SATIŞ KANALLARI / SÖZLEŞMELER) */
        <div className="space-y-4">
          <div
            data-testid="trade-center-intro"
            className="g-card-soft p-3 text-[13px] text-sky-900"
          >
            <strong>İleri seviye.</strong> Tek dükkânda buraya girmen gerekmez,
            <strong> Mal al</strong> yeter.
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'TEDARIK', label: 'Depo ve alım', icon: Package },
                {
                  id: 'TESLIMATLAR',
                  label: 'Kargo ve araç',
                  icon: Truck,
                },
                {
                  id: 'SATIS_KANALLARI',
                  label: 'Üretim',
                  icon: Factory,
                },
                {
                  id: 'SOZLESMELER',
                  label: 'Anlaşmalar',
                  icon: FileText,
                },
              ] as const
            ).map((tb) => {
              const Icon = tb.icon;
              return (
                <button
                  key={tb.id}
                  type="button"
                  data-testid={`trade-center-tab-${tb.id}`}
                  onClick={() => setTradeTab(tb.id)}
                  className={`min-h-[56px] py-2 px-2.5 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                    tradeTab === tb.id
                      ? 'g-choice is-active'
                      : 'g-choice'
                  }`}
                >
                  <Icon className="hidden" />
                  <span className="leading-tight text-center">{tb.label}</span>
                </button>
              );
            })}
          </div>

          {tradeTab === 'TEDARIK' && (
            <div className="space-y-3">
              <div className="g-tip">
                Depo: toptan mal sakladığın yer.
              </div>
              {/* 3 Depo Stok Özeti (Hammadde / Mamul / Dağıtım) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {trade.warehouses.map((wh) => (
                  <div
                    key={wh.warehouseId}
                    data-testid={`warehouse-card-${wh.warehouseId}`}
                    className="g-card p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--g-ink)]">
                        {wh.nameTR}
                      </span>
                      <span className="text-[13px] tabular-nums font-bold text-sky-700">
                        {wh.usedCapacityUnits.toFixed(0)}/{wh.maxCapacityUnits}{' '}
                        br
                      </span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {wh.batches.length === 0 ? (
                        <div className="text-[13px] text-[var(--g-muted)]">
                          Depo boş
                        </div>
                      ) : (
                        wh.batches.map((b) => {
                          const rDef = RESOURCE_CATALOG[b.resourceId];
                          return (
                            <div
                              key={b.batchId}
                              className="flex items-center justify-between text-[13px] bg-[var(--g-surface-2)] px-2 py-0.5 rounded"
                            >
                              <span className="font-medium text-[var(--g-ink)] truncate">
                                {rDef?.nameTR || b.resourceNameTR}
                              </span>
                              <span className="tabular-nums font-bold text-[var(--g-ink)]">
                                {b.quantity.toFixed(0)} br (K.{b.qualityScore})
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tedarikçi Sipariş ve Düzenli Alım Sözleşmesi */}
              <div className="g-card p-4 space-y-3">
                <h5 className="text-base font-extrabold text-[var(--g-ink)]">
                  Toptan sipariş ver
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <select
                    data-testid="trade-resource-select"
                    value={selectedResourceId}
                    onChange={(e) => {
                      const rId = e.target.value;
                      setSelectedResourceId(rId);
                      const firstSup = trade.suppliers.find((s) =>
                        s.suppliedResourceIds.includes(rId)
                      );
                      if (firstSup) setSelectedSupplierId(firstSup.supplierId);
                    }}
                    className="g-input text-sm font-semibold"
                  >
                    {ALL_RESOURCES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.category === 'RAW_MATERIAL' ? 'Hammadde' : r.category === 'INTERMEDIATE_GOOD' ? 'Ara ürün' : 'Hazır ürün'} · {r.nameTR} (
                        {formatCurrency(r.baseMarketPrice)})
                      </option>
                    ))}
                  </select>

                  <select
                    data-testid="trade-supplier-select"
                    value={activeOffer?.supplierId ?? ''}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="g-input text-sm font-semibold"
                  >
                    {supplierOffers.map((o) => (
                      <option key={o.supplierId} value={o.supplierId}>
                        {o.supplierNameTR} ({formatCurrency(o.unitPrice)}/br ·{' '}
                        {o.deliveryDays}g)
                      </option>
                    ))}
                  </select>

                  <NumberInput
                    data-testid="trade-order-qty-input"
                    
                    min={10}
                    max={1000}
                    step={10}
                    value={orderQuantity}
                    onChange={(e) =>
                      setOrderQuantity(
                        Math.max(5, Number(e.target.value) || 20)
                      )
                    }
                    className="g-input text-sm tabular-nums font-bold"
                  />

                  <select
                    data-testid="trade-dest-warehouse-select"
                    value={orderWarehouseId}
                    onChange={(e) => {
                      setOrderDestType('WAREHOUSE');
                      setOrderWarehouseId(e.target.value);
                    }}
                    className="g-input text-sm font-semibold"
                  >
                    {trade.warehouses.map((w) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        Hedef: {w.nameTR}
                      </option>
                    ))}
                  </select>
                </div>

                {activeOffer && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="text-xs text-[var(--g-muted)]">
                      Birim:{' '}
                      <strong>{formatCurrency(activeOffer.unitPrice)}</strong> ·
                      Nakliye/br:{' '}
                      <strong>
                        {formatCurrency(activeOffer.shippingCostPerUnit)}
                      </strong>{' '}
                      · Teslimat: <strong>{activeOffer.deliveryDays} Gün</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid="trade-place-spot-order-btn"
                        onClick={() =>
                          onPlaceProcurementOrder({
                            supplierId: activeOffer.supplierId,
                            resourceId: selectedResourceId,
                            quantity: orderQuantity,
                            destinationType: orderDestType,
                            destinationId:
                              orderDestType === 'SHOP' && activeShop
                                ? activeShop.shopId
                                : orderWarehouseId,
                            paymentTermType: orderPaymentTerm,
                          })
                        }
                        className="g-btn g-btn-navy px-4"
                      >
                        Şimdi sipariş ver
                      </button>
                      <button
                        type="button"
                        data-testid="trade-create-contract-btn"
                        onClick={() =>
                          onCreatePurchaseContract({
                            supplierId: activeOffer.supplierId,
                            resourceId: selectedResourceId,
                            dailyQuantity: orderQuantity,
                            durationDays: 30,
                            destinationType: 'WAREHOUSE',
                            destinationId: orderWarehouseId,
                          })
                        }
                        className="g-btn g-btn-primary px-4"
                      >
                        30 gün düzenli al
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tradeTab === 'TESLIMATLAR' && (
            <div className="space-y-3">
              <div className="g-tip">
                Siparişlerin kargo durumu.
              </div>
              {/* Lojistik Filo & Araç Satın Alma */}
              <div className="g-card p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-base font-extrabold text-[var(--g-ink)]">
                    Araçların ({trade.vehicles.length} Araç)
                  </h5>
                  <span className="text-[13px] text-[var(--g-muted)]">
                    Kargo masrafını düşürür
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_VEHICLES.map(([vehType, spec]) => (
                    <button
                      key={vehType}
                      type="button"
                      data-testid={`buy-vehicle-${vehType}`}
                      onClick={() => onPurchaseLogisticsVehicle(vehType)}
                      className="p-2.5 rounded-xl bg-[var(--g-surface-2)] hover:bg-amber-50 border border-[var(--g-line)] text-left cursor-pointer"
                    >
                      <div className="text-xs font-bold text-[var(--g-ink)]">
                        {spec.nameTR}
                      </div>
                      <div className="text-[13px] tabular-nums text-amber-800 font-bold">
                        {formatCurrency(spec.purchaseCost)}
                      </div>
                      <div className="text-[13px] text-[var(--g-muted)]">
                        Kapasite: {spec.capacityUnits} br
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Depodan Şubeye Sevkiyat */}
              {trade.shops.length > 0 && (
                <div className="g-card p-4 space-y-2.5">
                  <h5 className="text-base font-extrabold text-[var(--g-ink)]">
                    Depodan dükkâna mal gönder
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <select
                      value={dispatchWarehouseId}
                      onChange={(e) => setDispatchWarehouseId(e.target.value)}
                      className="g-input text-sm font-semibold"
                    >
                      {trade.warehouses.map((w) => (
                        <option key={w.warehouseId} value={w.warehouseId}>
                          Kaynak: {w.nameTR}
                        </option>
                      ))}
                    </select>
                    <select
                      value={dispatchResourceId}
                      onChange={(e) => setDispatchResourceId(e.target.value)}
                      className="g-input text-sm font-semibold"
                    >
                      {ALL_RESOURCES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nameTR}
                        </option>
                      ))}
                    </select>
                    <NumberInput
                      
                      min={5}
                      max={300}
                      value={dispatchQty}
                      onChange={(e) =>
                        setDispatchQty(
                          Math.max(1, Number(e.target.value) || 20)
                        )
                      }
                      className="g-input text-sm tabular-nums font-bold"
                    />
                    <button
                      type="button"
                      data-testid="dispatch-warehouse-to-shop-btn"
                      onClick={() => {
                        if (activeShop) {
                          onDispatchWarehouseToShop({
                            sourceWarehouseId: dispatchWarehouseId,
                            destinationShopId: activeShop.shopId,
                            resourceId: dispatchResourceId,
                            quantity: dispatchQty,
                            useOwnFleet: trade.vehicles.length > 0,
                          });
                        }
                      }}
                      className="g-btn g-btn-primary w-full"
                    >
                      Dükkâna gönder
                    </button>
                  </div>
                </div>
              )}

              {/* Aktif Sevkiyatlar Listesi */}
              <div className="g-card p-4 space-y-2">
                <h5 className="text-base font-extrabold text-[var(--g-ink)]">
                  Teslimatlar ({trade.shipments.length})
                </h5>
                {trade.shipments.length === 0 ? (
                  <p className="text-xs text-[var(--g-muted)]">
                    Henüz kayıtlı sevkiyat bulunmuyor.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {trade.shipments.slice(0, 12).map((sh) => (
                      <div
                        key={sh.shipmentId}
                        className="p-2.5 rounded-xl bg-[var(--g-surface-2)] border border-[var(--g-line)] flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-[var(--g-ink)]">
                            {sh.resourceNameTR} ({sh.quantity} br)
                          </span>
                          <span className="text-[var(--g-muted)] ml-2">
                            {sh.sourceNameTR} → {sh.destinationNameTR}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[13px] font-bold ${
                            sh.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {sh.status === 'DELIVERED'
                            ? 'Teslim Edildi'
                            : `Yolda (Varış G.${sh.estimatedArrivalDay})`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tradeTab === 'SATIS_KANALLARI' && (
            <div className="space-y-3">
              <div className="g-tip">
                Üretim: hammaddeyi daha pahalı ürüne çevirir.
              </div>
              {/* Reçeteli Üretim Zinciri */}
              <div className="g-card p-4 space-y-3">
                <h5 className="text-base font-extrabold text-[var(--g-ink)]">
                  Üretim: hammaddeden ürüne
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    data-testid="recipe-select"
                    value={selectedRecipeId}
                    onChange={(e) => setSelectedRecipeId(e.target.value)}
                    className="sm:col-span-2 g-input text-sm font-semibold"
                  >
                    {ALL_RECIPES.map((rec) => (
                      <option key={rec.recipeId} value={rec.recipeId}>
                        {rec.nameTR} (Çıktı: {rec.outputQuantity} br · Enerji:{' '}
                        {formatCurrency(rec.energyCostPerBatch)})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <NumberInput
                      data-testid="recipe-batches-input"
                      
                      min={1}
                      max={100}
                      value={recipeBatches}
                      onChange={(e) =>
                        setRecipeBatches(
                          Math.max(1, Number(e.target.value) || 1)
                        )
                      }
                      className="w-20 g-input text-sm tabular-nums font-bold"
                    />
                    <button
                      type="button"
                      data-testid="execute-recipe-btn"
                      onClick={() =>
                        onExecuteRecipeProduction({
                          recipeId: selectedRecipeId,
                          batchesCount: recipeBatches,
                        })
                      }
                      className="g-btn g-btn-primary flex-1 px-3"
                    >
                      Üretimi Başlat
                    </button>
                  </div>
                </div>
              </div>

              {/* Satış Kanalları Özeti */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {trade.salesChannels.map((ch) => (
                  <div
                    key={ch.channelId}
                    className="g-card p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-extrabold text-[var(--g-ink)]">
                        {ch.nameTR}
                      </div>
                      <div className="text-[13px] text-[var(--g-muted)]">
                        {ch.paymentTermDays === 0
                          ? 'Parası hemen gelir'
                          : `Parası ${ch.paymentTermDays} günde gelir`}
                      </div>
                    </div>
                    <div className="text-right tabular-nums text-xs font-bold text-emerald-700">
                      {formatCurrency(ch.todayRevenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tradeTab === 'SOZLESMELER' && (
            <div className="space-y-3">
              <div className="g-tip">
                Toptan anlaşma: önceden sabit fiyatla mal satma sözü.
              </div>
              <div className="g-card p-4 space-y-2.5">
                <h5 className="text-base font-extrabold text-[var(--g-ink)]">
                  Kurumsal ve Kamu Tedarik Sözleşmeleri (
                  {trade.commercialContracts.length})
                </h5>
                <div className="space-y-2">
                  {trade.commercialContracts.map((ct) => (
                    <div
                      key={ct.contractId}
                      data-testid={`commercial-contract-${ct.contractId}`}
                      className="p-3 rounded-xl bg-[var(--g-surface-2)] border border-[var(--g-line)] flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-extrabold text-[var(--g-ink)]">
                          {ct.buyerNameTR} — {ct.resourceNameTR}
                        </div>
                        <div className="text-[13px] text-[var(--g-muted)] tabular-nums">
                          Teslim: {ct.deliveredUnits}/{ct.totalRequiredUnits} br
                          · Birim Fiyat: {formatCurrency(ct.unitSalePrice)} ·
                          Vade: G.{ct.dueDay}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {ct.status === 'OFFERED' && (
                          <button
                            type="button"
                            data-testid={`accept-contract-${ct.contractId}`}
                            onClick={() =>
                              onAcceptCommercialContract(ct.contractId)
                            }
                            className="g-btn g-btn-navy g-btn-sm"
                          >
                            Sözleşmeyi Kabul Et
                          </button>
                        )}
                        {ct.status === 'ACTIVE' && ct.remainingUnits > 0 && (
                          <button
                            type="button"
                            data-testid={`deliver-contract-${ct.contractId}`}
                            onClick={() =>
                              onDeliverCommercialContract({
                                contractId: ct.contractId,
                                quantity: ct.remainingUnits,
                                sourceType: 'WAREHOUSE',
                                sourceId: 'WH_FIN_MAIN',
                              })
                            }
                            className="g-btn g-btn-primary px-3"
                          >
                            Depodan Teslim Et ({ct.remainingUnits} br)
                          </button>
                        )}
                        {ct.status === 'COMPLETED' && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[13px] font-bold">
                            Tamamlandı
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
