/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ESNAF, DÜKKÂN, TİCARET MERKEZİ, TEDARİK ZİNCİRİ VE ŞİRKETLEŞME PANELİ
 * - 1. Geniş kapsam (8 dükkân türü, 23 kaynak/ürün, 12 üretim reçetesi, 10 tedarikçi, 3 depo, 4 araç türü, kurumsal sözleşmeler)
 * - 2. Temiz arayüz (Dükkân ekranında 8 net özet metrik + 5 net işlem; Ticaret Merkezinde 4 sekme: Tedarik, Teslimatlar, Satış Kanalları, Sözleşmeler)
 * - 3. Mantıklı ve tutarlı sistem (Borsa -> Esnaf -> Çok Şubeli Ticaret -> Şirketleşme -> Fabrika & Holding kariyer döngüsü)
 */

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
import { SHOP_EMOJI } from './buildings/ShopDashboard';
import { planShopRestock } from '../../engine/ShopRestockPlanner';
import { FIRST_SHOP_MIN_NET_WORTH } from '../../data/gameBalance';
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
}) => {
  const trade = useMemo(
    () => TradeAndShopEngine.ensureTradeUniverseState(state),
    [state]
  );
  const incorporationEligibility = useMemo(
    () => TradeAndShopEngine.checkIncorporationEligibility(state),
    [state]
  );

  const [mainMode, setMainMode] = useState<'SHOPS' | 'TRADE_CENTER'>(
    initialSection
  );
  const [selectedShopId, setSelectedShopId] = useState<string>(
    () => initialShopId ?? trade.shops[0]?.shopId ?? ''
  );
  const [shopActionTab, setShopActionTab] = useState<ShopActionTab>(() =>
    trade.shops.length === 0 || startWithOpenBranch
      ? 'OPEN_BRANCH'
      : 'ORDER_PRODUCT'
  );
  const [tradeTab, setTradeTab] = useState<TradeCenterTab>('TEDARIK');
  const [showAdvancedOrder, setShowAdvancedOrder] = useState(false);

  // Yeni şube açılış formu
  const [newShopType, setNewShopType] = useState<ShopType>('BUFE');
  const [newShopCustomName, setNewShopCustomName] = useState<string>('');
  const [newShopCashFloat, setNewShopCashFloat] = useState<number>(8_000);

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

  const supplierOffers = useMemo(
    () => TradeAndShopEngine.getSupplierOffers(state, selectedResourceId),
    [state, selectedResourceId]
  );

  const activeOffer =
    supplierOffers.find((o) => o.supplierId === selectedSupplierId) ??
    supplierOffers[0] ??
    null;

  const activeShopUsedUnits = activeShop
    ? activeShop.inventoryBatches.reduce((sum, b) => sum + b.quantity, 0)
    : 0;
  const restockPlan = useMemo(
    () =>
      activeShop
        ? planShopRestock(
            state,
            activeShop.shopId,
            spendableCash + activeShop.cashAccountBalance
          )
        : { orders: [], totalCost: 0 },
    [state, activeShop, spendableCash]
  );
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
  const activeShopTotalCap = activeShop
    ? activeShop.shelfCapacity + activeShop.backroomCapacity
    : 1;

  return (
    <div
      data-testid="esnaf-and-trade-panel"
      className="space-y-4 text-slate-900"
    >
      {/* 1. KARİYER İLERLEME BARI & ANA MOD SEÇİCİ */}
      <div className="rounded-2xl flex flex-wrap items-center justify-between gap-2">
        <div className="hidden">
          <div className="text-[13px] font-bold uppercase tracking-wider text-amber-800">
            🚀 Kariyerin
          </div>
          <div
            data-testid="career-stage-badge"
            className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5"
          >
            <Award className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {CAREER_STAGE_LABELS[trade.careerStage] || trade.careerStage}
            </span>
            <span className="text-xs tabular-nums font-semibold text-slate-600">
              · Ticari İtibar: {trade.tradeReputationScore.toFixed(0)}/100
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 w-full bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            data-testid="mode-esnaf-shops-btn"
            onClick={() => setMainMode('SHOPS')}
            className={`min-h-[44px] px-3 py-1.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              mainMode === 'SHOPS'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>🏪 Dükkânlarım ({trade.shops.length})</span>
          </button>
          <button
            type="button"
            data-testid="mode-trade-center-btn"
            onClick={() => setMainMode('TRADE_CENTER')}
            className={`min-h-[44px] px-3 py-1.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              mainMode === 'TRADE_CENTER'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>🏭 Toptan & Üretim</span>
          </button>
        </div>
      </div>

      {mainMode === 'SHOPS' ? (
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
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Şube / İlk Dükkân Aç</span>
            </button>
          </div>

          {activeShop && (
            <div className="p-3 rounded-3xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-md flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-extrabold text-sm">🛒 Rafları doldur</div>
                <div className="text-[13px] opacity-95">
                  {restockPlan.orders.length === 0
                    ? 'Raflar zaten dolu ya da paran yetmiyor.'
                    : `En ucuz toptancıdan ${restockPlan.orders.length} ürün · yaklaşık ${formatCurrency(restockPlan.totalCost)}`}
                </div>
              </div>
              <button
                type="button"
                data-testid="shop-restock-all-btn"
                disabled={restockPlan.orders.length === 0}
                onClick={() => {
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
                }}
                className="min-h-[44px] px-4 rounded-2xl bg-white text-emerald-700 font-extrabold text-sm shadow disabled:opacity-50 active:scale-95 shrink-0"
              >
                Doldur
              </button>
            </div>
          )}

          {/* SEÇİLİ DÜKKÂN: Ticarium mantığı — Mal al → raf → satış → kasa */}
          {activeShop ? (
            <div
              data-testid="active-shop-summary-card"
              className="rounded-3xl bg-white border border-slate-200 shadow-md overflow-hidden"
            >
              <div className="p-3 bg-gradient-to-r from-orange-400 to-rose-400 text-white flex items-center gap-3">
                <span className="text-4xl">{SHOP_EMOJI[activeShop.shopType] ?? '🏪'}</span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-extrabold truncate">
                    {activeShop.nameTR}
                  </h4>
                  <div className="text-sm opacity-95">
                    {activeShopTemplate?.nameTR || activeShop.shopType} · Seviye{' '}
                    {activeShop.level}/5
                    {activeShop.isCompanyBranch ? ' · Şirket şubesi' : ''}
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-3">
                {/* 3 büyük sayı: Kasa / Raf / Yolda */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-sky-50 p-2.5">
                    <div className="text-[13px] text-sky-800 font-semibold">💰 Kasa</div>
                    <div
                      data-testid="shop-metric-cash"
                      className="text-sm tabular-nums font-extrabold text-slate-900"
                    >
                      {formatCurrency(activeShop.cashAccountBalance)}
                    </div>
                  </div>
                  <div
                    className={`rounded-2xl p-2.5 ${
                      activeShopUsedUnits <= 0
                        ? 'bg-rose-50'
                        : activeShopUsedUnits < activeShop.shelfCapacity * 0.25
                        ? 'bg-amber-50'
                        : 'bg-emerald-50'
                    }`}
                  >
                    <div className="text-[13px] text-slate-700 font-semibold">📦 Raf</div>
                    <div
                      data-testid="shop-metric-critical-stock"
                      className={`text-sm tabular-nums font-extrabold ${
                        activeShopUsedUnits <= 0
                          ? 'text-rose-700'
                          : activeShopUsedUnits < activeShop.shelfCapacity * 0.25
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {activeShopUsedUnits.toFixed(0)}/{activeShopTotalCap}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-indigo-50 p-2.5">
                    <div className="text-[13px] text-indigo-800 font-semibold">🚚 Yolda</div>
                    <div
                      data-testid="shop-metric-pending-deliveries"
                      className="text-sm tabular-nums font-extrabold text-slate-900"
                    >
                      {activeShop.pendingDeliveriesCount} sipariş
                    </div>
                  </div>
                </div>

                {/* Kasaya para koy / kâr al — her zaman görünür */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="shop-cash-deposit-btn"
                    onClick={() =>
                      onTransferShopCash({
                        shopId: activeShop.shopId,
                        direction: 'TO_SHOP',
                        amount: shopTransferAmount,
                      })
                    }
                    className="flex-1 min-h-[48px] rounded-2xl bg-sky-100 text-sky-900 text-sm font-extrabold active:scale-95"
                  >
                    ⬇️ Kasaya {formatCurrency(shopTransferAmount)} koy
                  </button>
                  <button
                    type="button"
                    data-testid="shop-cash-withdraw-btn"
                    onClick={() =>
                      onTransferShopCash({
                        shopId: activeShop.shopId,
                        direction: 'FROM_SHOP',
                        amount: shopTransferAmount,
                      })
                    }
                    className="flex-1 min-h-[48px] rounded-2xl bg-amber-100 text-amber-900 text-sm font-extrabold active:scale-95"
                  >
                    ⬆️ Kâr al
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 text-[13px] text-slate-500">
                  <span>
                    Aktarma tutarı
                    <HelpTip text="Kişisel paranla dükkân kasası ayrıdır. Mal almak için dükkân kasasında para olmalı; kazandığın kârı da kasadan kendi cebine çekebilirsin." />
                  </span>
                  <div className="flex items-center gap-1">
                    {[5_000, 25_000, 100_000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setShopTransferAmount(amt)}
                        className={`min-h-[36px] px-2.5 rounded-xl text-[13px] font-bold ${
                          shopTransferAmount === amt
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {amt >= 1000 ? `${amt / 1000}B` : amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Yoldaki siparişler: kuytuda kalmasın */}
                <div
                  data-testid="shop-inbound-strip"
                  className="rounded-2xl bg-indigo-50 border border-indigo-100 p-2.5 space-y-1.5"
                >
                  <div className="text-sm font-extrabold text-indigo-900">
                    🚚 Yoldaki siparişler
                    <HelpTip text="Sipariş verdiğin mallar toptancıdan dükkâna yola çıkar. Vardığında otomatik olarak rafa dizilir ve satışa başlar." />
                  </div>
                  {inboundShipments.length === 0 ? (
                    <div className="text-[13px] text-indigo-800">
                      Şu an yolda sipariş yok.
                    </div>
                  ) : (
                    inboundShipments.slice(0, 4).map((sh) => (
                      <div
                        key={sh.shipmentId}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="font-bold text-slate-900 truncate">
                          {sh.resourceNameTR} · {sh.quantity} adet
                        </span>
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-white text-indigo-800 font-bold">
                          {sh.estimatedArrivalDay <= state.day
                            ? 'Bugün gelir'
                            : `${sh.estimatedArrivalDay - state.day} gün sonra`}
                        </span>
                      </div>
                    ))
                  )}
                  {recentDeliveredShipments.length > 0 && (
                    <div className="pt-1 text-[13px] text-emerald-800 font-semibold">
                      ✅ Son gelen:{' '}
                      {recentDeliveredShipments
                        .map((sh) => `${sh.resourceNameTR} (${sh.quantity})`)
                        .join(', ')}
                    </div>
                  )}
                </div>

                {/* Bugünün özeti */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-slate-50 p-2.5">
                    <div className="text-[13px] text-slate-500">Bugünkü satış</div>
                    <div
                      data-testid="shop-metric-daily-revenue"
                      className="text-sm tabular-nums font-extrabold text-slate-900"
                    >
                      {formatCurrency(activeShop.todaySalesRevenue)}
                      <span className="text-[13px] font-semibold text-slate-500">
                        {' '}
                        ({activeShop.todayUnitsSold} adet)
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-2.5">
                    <div className="text-[13px] text-slate-500">
                      Bugünkü kâr
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

                <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-700">
                    😊 Müşteri memnuniyeti
                    <HelpTip text="Müşteriler raflar doluysa, fiyatlar makulse ve dükkân gelişmişse memnun olur. Memnuniyet yüksekse daha çok müşteri gelir." />
                  </span>
                  <strong
                    data-testid="shop-metric-satisfaction"
                    className="tabular-nums text-slate-900"
                  >
                    %{activeShop.customerSatisfaction.toFixed(0)}
                    <span className="hidden"> · İtibar {activeShop.reputationScore.toFixed(0)}</span>
                  </strong>
                </div>

                {/* İpucu: ana sorun + önerilen işlem tek kutuda */}
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 space-y-1">
                  <div className="text-sm font-extrabold text-amber-900">💡 İpucu</div>
                  <div
                    data-testid="shop-metric-main-issue"
                    className="text-[13px] font-semibold text-slate-800"
                  >
                    {activeShop.mainIssueTR}
                  </div>
                  <div
                    data-testid="shop-metric-recommended-action"
                    className="text-[13px] text-slate-700"
                  >
                    {activeShop.recommendedActionTR}
                  </div>
                </div>

                {/* 5 net işlem düğmesi: numarasız, kesilmeyen yazılarla */}
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'ORDER_PRODUCT', label: '🛒 Mal al' },
                      { id: 'EDIT_PRICES', label: '🏷️ Fiyatlar' },
                      { id: 'MANAGE_STAFF', label: '👥 Çalışanlar' },
                      { id: 'UPGRADE_SHOP', label: '⬆️ Geliştir' },
                      { id: 'OPEN_BRANCH', label: '➕ Yeni şube' },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      data-testid={`shop-action-tab-${btn.id}`}
                      onClick={() => setShopActionTab(btn.id)}
                      className={`min-h-[48px] px-2.5 rounded-2xl text-sm font-extrabold border-2 active:scale-95 ${
                        btn.id === 'ORDER_PRODUCT' ? 'col-span-2' : ''
                      } ${
                        shopActionTab === btn.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-800 border-slate-200'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div
              data-testid="first-shop-progress"
              className="p-4 rounded-3xl bg-gradient-to-br from-amber-300 via-orange-300 to-rose-300 text-amber-950 shadow-md space-y-2"
            >
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <span className="text-2xl">🏪</span>
                {state.netWorth >= FIRST_SHOP_MIN_NET_WORTH
                  ? 'Hazırsın! İlk dükkânını aç'
                  : 'İlk dükkânına ne kadar kaldı?'}
              </div>
              <div className="w-full h-4 bg-white/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.floor((state.netWorth / FIRST_SHOP_MIN_NET_WORTH) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[13px] font-bold tabular-nums">
                <span>{formatCurrency(state.netWorth)}</span>
                <span>🎯 {formatCurrency(FIRST_SHOP_MIN_NET_WORTH)}</span>
              </div>
              {state.netWorth < FIRST_SHOP_MIN_NET_WORTH && (
                <p className="text-[13px] font-semibold">
                  Borsada hisse al-sat, parayı büyüt. Hedefe ulaşınca dükkân kurabilirsin!
                </p>
              )}
            </div>
          )}

          {/* SEÇİLİ İŞLEM SEKMESİ İÇERİĞİ */}
          {shopActionTab === 'ORDER_PRODUCT' && activeShop && (
            <div
              data-testid="shop-order-product-box"
              className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  🛒 Mal al — {activeShop.nameTR}
                </h5>
                <span className="text-[13px] tabular-nums text-slate-600">
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
                  const best = TradeAndShopEngine.getSupplierOffers(state, prodId)
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
                      className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 truncate">
                          {resDef?.nameTR || prodId}
                        </div>
                        <div className="text-[13px] text-slate-600">
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
                                className="min-h-[52px] rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white font-extrabold text-sm shadow active:scale-95 leading-tight"
                              >
                                +{q}
                                <span className="block text-[13px] font-semibold opacity-95">
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
                className="w-full min-h-[44px] rounded-2xl bg-slate-100 text-slate-700 text-sm font-bold"
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
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">
                          {resDef?.nameTR || prodId}
                        </div>
                        <div className="text-[13px] tabular-nums text-slate-600 mt-0.5">
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
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">
                    Tedarikçi Seçimi
                  </label>
                  <select
                    data-testid="shop-order-supplier-select"
                    value={activeOffer?.supplierId ?? ''}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900"
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
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">
                    Sipariş Miktarı (Birim)
                  </label>
                  <input
                    data-testid="shop-order-quantity-input"
                    type="number"
                    min={5}
                    max={500}
                    step={5}
                    value={orderQuantity}
                    onChange={(e) =>
                      setOrderQuantity(
                        Math.max(1, Number(e.target.value) || 10)
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs tabular-nums font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">
                    Ödeme Şekli
                  </label>
                  <select
                    data-testid="shop-order-payment-select"
                    value={orderPaymentTerm}
                    onChange={(e) =>
                      setOrderPaymentTerm(e.target.value as PaymentTermType)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900"
                  >
                    <option value="CASH">Peşin Ödeme</option>
                    <option value="CREDIT">Vadeli Tedarikçi Faturası</option>
                  </select>
                </div>
              </div>


              {activeOffer && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-600">Tahmini Toplam: </span>
                    <strong className="tabular-nums text-slate-900">
                      {formatCurrency(
                        orderQuantity *
                          (activeOffer.unitPrice +
                            activeOffer.shippingCostPerUnit)
                      )}
                    </strong>
                    <span className="text-slate-500 ml-2">
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
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                  >
                    Siparişi Onayla ve Sevk Et
                  </button>
                </div>
              )}
              </div>
            </div>
          )}

          {shopActionTab === 'EDIT_PRICES' && activeShop && (
            <div
              data-testid="shop-edit-prices-box"
              className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3"
            >
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Mağaza Satış Fiyatı Politikası ({activeShop.nameTR})
              </h5>
              <div className="space-y-2">
                {(activeShopTemplate?.allowedResourceIds ?? []).map(
                  (prodId) => {
                    const resDef = RESOURCE_CATALOG[prodId];
                    const fairPrice = Number(
                      (
                        (resDef?.baseMarketPrice ?? 100) *
                        (1 +
                          (activeShopTemplate?.defaultGrossMarginPct ?? 30) /
                            100)
                      ).toFixed(2)
                    );
                    const currentSellPrice =
                      activeShop.sellingPrices[prodId] ?? fairPrice;
                    const currentMult = currentSellPrice / Math.max(1, fairPrice);
                    return (
                      <div
                        key={prodId}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {resDef?.nameTR || prodId}
                          </div>
                          <div className="text-[13px] tabular-nums text-slate-600">
                            Etiket Fiyatı: {formatCurrency(currentSellPrice)}{' '}
                            (Çarpan: {currentMult.toFixed(2)}x)
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {[
                            { label: 'İndirimli (0.90x)', val: 0.9 },
                            { label: 'Dengeli (1.00x)', val: 1.0 },
                            { label: 'Yüksek Marj (1.18x)', val: 1.18 },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                onConfigureShop({
                                  shopId: activeShop.shopId,
                                  priceMultipliers: { [prodId]: preset.val },
                                })
                              }
                              className={`px-2.5 py-1 rounded-lg text-[13px] font-bold border cursor-pointer ${
                                Math.abs(currentMult - preset.val) < 0.04
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {shopActionTab === 'MANAGE_STAFF' && activeShop && (
            <div
              data-testid="shop-manage-staff-box"
              className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Dükkân Çalışanları ve Kasa Aktarımı
                  </h5>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Mevcut Çalışan: <strong>{activeShop.staffCount}</strong> /
                    Minimum Gereken:{' '}
                    <strong>{activeShop.minStaffRequired}</strong> kişi
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="shop-hire-1-btn"
                    onClick={() =>
                      onConfigureShop({
                        shopId: activeShop.shopId,
                        staffDelta: 1,
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    +1 Çalışan Al
                  </button>
                  <button
                    type="button"
                    data-testid="shop-hire-3-btn"
                    onClick={() =>
                      onConfigureShop({
                        shopId: activeShop.shopId,
                        staffDelta: 3,
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                  >
                    +3 Çalışan Al
                  </button>
                  <button
                    type="button"
                    data-testid="shop-fire-1-btn"
                    onClick={() =>
                      onConfigureShop({
                        shopId: activeShop.shopId,
                        staffDelta: -1,
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
                  >
                    -1 Azalt
                  </button>
                </div>
              </div>

            </div>
          )}

          {shopActionTab === 'UPGRADE_SHOP' && activeShop && (
            <div
              data-testid="shop-upgrade-box"
              className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Dükkân Fiziksel ve Ticari Seviye Geliştirme (Seviye{' '}
                  {activeShop.level} → {Math.min(5, activeShop.level + 1)})
                </h5>
                <p className="text-xs text-slate-600 mt-1">
                  Her seviye artışında şehirdeki dükkân binası fiziksel olarak
                  büyür, raf/depo kapasitesi ve günlük müşteri trafiği +%45
                  artar.
                </p>
              </div>
              <button
                type="button"
                data-testid="shop-upgrade-confirm-btn"
                disabled={activeShop.level >= 5}
                onClick={() => onUpgradeShopLevel(activeShop.shopId)}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300 text-white text-xs font-bold cursor-pointer"
              >
                {activeShop.level >= 5
                  ? 'Maksimum Seviye (Sv.5)'
                  : `Seviye ${activeShop.level + 1}'e Yükselt`}
              </button>
            </div>
          )}

          {shopActionTab === 'OPEN_BRANCH' && (
            <div
              data-testid="shop-open-branch-box"
              className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  8 Farklı Esnaf ve Mağaza Türünden Yeni İşletme Aç
                </h5>
                <span className="text-xs tabular-nums font-bold text-emerald-700">
                  Kullanılabilir Nakit: {formatCurrency(spendableCash)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        selected
                          ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/50'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-slate-900">
                        {tpl.nameTR}
                      </div>
                      <div className="text-[13px] tabular-nums text-amber-800 font-bold mt-0.5">
                        Kurulum:{' '}
                        {formatCurrency(tpl.openingCost + tpl.decorationCost)}
                      </div>
                      <div className="text-[13px] text-slate-600 mt-0.5">
                        Kira: {formatCurrency(tpl.dailyRentBase)}/g · Marj %
                        {Math.round(tpl.defaultGrossMarginPct)}
                      </div>
                      <div className="text-[13px] text-slate-500 mt-0.5 line-clamp-1">
                        {tpl.specificMechanicTitleTR} · Min.
                        {tpl.minStaffRequired} çalışan
                      </div>
                      <div className="sr-only">{totalCost}</div>
                    </button>
                  );
                })}
              </div>

              {/* Seçili Mağaza Türü Detayı ve Açılış Butonu */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">
                      {selectedShopTemplateForNew.nameTR} —{' '}
                      {selectedShopTemplateForNew.specificMechanicDescriptionTR}
                    </div>
                    <div className="text-[13px] text-slate-600 mt-0.5">
                      Başlangıç Sermayesi:{' '}
                      <strong>
                        {formatCurrency(selectedShopTemplateForNew.openingCost)}
                      </strong>{' '}
                      + Dekorasyon:{' '}
                      <strong>
                        {formatCurrency(
                          selectedShopTemplateForNew.decorationCost
                        )}
                      </strong>{' '}
                      + Kasa Harçlığı:{' '}
                      <strong>{formatCurrency(newShopCashFloat)}</strong> ={' '}
                      <strong className="text-amber-800">
                        {formatCurrency(
                          selectedShopTemplateForNew.openingCost +
                            selectedShopTemplateForNew.decorationCost +
                            newShopCashFloat
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    data-testid="new-shop-name-input"
                    type="text"
                    placeholder={`Örn: Merkez ${selectedShopTemplateForNew.nameTR}`}
                    value={newShopCustomName}
                    onChange={(e) => setNewShopCustomName(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold"
                  />
                  <input
                    data-testid="new-shop-cash-float-input"
                    type="number"
                    min={0}
                    max={500000}
                    step={2000}
                    value={newShopCashFloat}
                    onChange={(e) =>
                      setNewShopCashFloat(
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    }
                    className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs tabular-nums font-bold"
                  />
                  <button
                    type="button"
                    data-testid="confirm-open-shop-btn"
                    onClick={() =>
                      onOpenShop({
                        shopType: newShopType,
                        customName: newShopCustomName.trim() || undefined,
                        initialCashFloat: newShopCashFloat,
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shadow-2xs"
                  >
                    {selectedShopTemplateForNew.nameTR} Aç
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BÖLÜM 8: ESNAFTAN ŞİRKETE GEÇİŞ (ŞİRKETLEŞME KARTI) */}
          {!state.playerCompany && (
            <div
              data-testid="incorporation-transition-card"
              className="p-4 rounded-2xl bg-gradient-to-br from-teal-50 via-white to-emerald-50 border border-teal-300 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-[13px] font-bold uppercase tracking-wider text-teal-800">
                    Kariyer Dönüşümü · Esnaftan Kurumsal Şirkete Geçiş
                  </span>
                  <h5 className="text-sm font-extrabold text-slate-900">
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
                        : 'bg-white border-slate-200 text-slate-600'
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
                  className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold"
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
                  className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs tabular-nums font-bold"
                  placeholder="Borsa Kodu"
                />
                <input
                  data-testid="incorporate-extra-cash-input"
                  type="number"
                  min={0}
                  step={25000}
                  value={incorpExtraCash}
                  onChange={(e) =>
                    setIncorpExtraCash(
                      Math.max(0, Number(e.target.value) || 0)
                    )
                  }
                  className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs tabular-nums font-bold"
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
                  className="px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:bg-slate-300 text-white text-xs font-bold cursor-pointer"
                >
                  İşletmeni Kurumsal Şirkete Dönüştür
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TİCARET MERKEZİ & TEDARİK ZİNCİRİ (4 TEMİZ SEKME: TEDARİK / TESLİMATLAR / SATIŞ KANALLARI / SÖZLEŞMELER) */
        <div className="space-y-4">
          <div
            data-testid="trade-center-intro"
            className="rounded-2xl bg-sky-50 border border-sky-200 p-3 text-[13px] text-sky-900"
          >
            <strong>Burası ileri seviye.</strong> Tek dükkân işletiyorsan buraya
            girmen gerekmez; mal almak için "Dükkânlarım" ekranındaki{' '}
            <strong>🛒 Mal al</strong> düğmesi yeter. Toptan ticaret, depo ve
            fabrika işleri şirket kurunca işine yarar.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            {(
              [
                { id: 'TEDARIK', label: 'Toptan Alım & Depo', icon: Package },
                {
                  id: 'TESLIMATLAR',
                  label: 'Kargolar & Araçlar',
                  icon: Truck,
                },
                {
                  id: 'SATIS_KANALLARI',
                  label: 'Üretim (Fabrika)',
                  icon: Factory,
                },
                {
                  id: 'SOZLESMELER',
                  label: 'Toptan Anlaşmalar',
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
                  className={`min-h-[48px] py-2 px-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    tradeTab === tb.id
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="leading-tight text-center">{tb.label}</span>
                </button>
              );
            })}
          </div>

          {tradeTab === 'TEDARIK' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-[13px] text-amber-900">
                💡 Depo: Malları toptan sakladığın yer. Dükkânlara buradan mal dağıtabilir, fabrikaya buradan hammadde verebilirsin.
              </div>
              {/* 3 Depo Stok Özeti (Hammadde / Mamul / Dağıtım) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {trade.warehouses.map((wh) => (
                  <div
                    key={wh.warehouseId}
                    data-testid={`warehouse-card-${wh.warehouseId}`}
                    className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {wh.nameTR}
                      </span>
                      <span className="text-[13px] tabular-nums font-bold text-sky-700">
                        {wh.usedCapacityUnits.toFixed(0)}/{wh.maxCapacityUnits}{' '}
                        br
                      </span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {wh.batches.length === 0 ? (
                        <div className="text-[13px] text-slate-400">
                          Depo boş
                        </div>
                      ) : (
                        wh.batches.map((b) => {
                          const rDef = RESOURCE_CATALOG[b.resourceId];
                          return (
                            <div
                              key={b.batchId}
                              className="flex items-center justify-between text-[13px] bg-slate-50 px-2 py-0.5 rounded"
                            >
                              <span className="font-medium text-slate-700 truncate">
                                {rDef?.nameTR || b.resourceNameTR}
                              </span>
                              <span className="tabular-nums font-bold text-slate-900">
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
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Hammadde, Ara Ürün veya Mamul Satın Alma Emri
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
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold"
                  >
                    {ALL_RESOURCES.map((r) => (
                      <option key={r.id} value={r.id}>
                        [{r.category}] {r.nameTR} (
                        {formatCurrency(r.baseMarketPrice)})
                      </option>
                    ))}
                  </select>

                  <select
                    data-testid="trade-supplier-select"
                    value={activeOffer?.supplierId ?? ''}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold"
                  >
                    {supplierOffers.map((o) => (
                      <option key={o.supplierId} value={o.supplierId}>
                        {o.supplierNameTR} ({formatCurrency(o.unitPrice)}/br ·{' '}
                        {o.deliveryDays}g)
                      </option>
                    ))}
                  </select>

                  <input
                    data-testid="trade-order-qty-input"
                    type="number"
                    min={10}
                    max={1000}
                    step={10}
                    value={orderQuantity}
                    onChange={(e) =>
                      setOrderQuantity(
                        Math.max(5, Number(e.target.value) || 20)
                      )
                    }
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs tabular-nums font-bold"
                  />

                  <select
                    data-testid="trade-dest-warehouse-select"
                    value={orderWarehouseId}
                    onChange={(e) => {
                      setOrderDestType('WAREHOUSE');
                      setOrderWarehouseId(e.target.value);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold"
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
                    <div className="text-xs text-slate-600">
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
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                      >
                        Spot Sipariş Ver
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
                        className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold cursor-pointer"
                      >
                        30 Günlük Tedarik Sözleşmesi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tradeTab === 'TESLIMATLAR' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-[13px] text-amber-900">
                💡 Verdiğin siparişlerin kargo durumu. Araç (filo) sahibi olursan malı kendi araçlarınla, daha ucuza taşırsın.
              </div>
              {/* Lojistik Filo & Araç Satın Alma */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Kendi Lojistik Araç Filosu ({trade.vehicles.length} Araç)
                  </h5>
                  <span className="text-[13px] text-slate-500">
                    Kendi filonuz dış lojistik maliyetini düşürür
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_VEHICLES.map(([vehType, spec]) => (
                    <button
                      key={vehType}
                      type="button"
                      data-testid={`buy-vehicle-${vehType}`}
                      onClick={() => onPurchaseLogisticsVehicle(vehType)}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 text-left cursor-pointer"
                    >
                      <div className="text-xs font-bold text-slate-900">
                        {spec.nameTR}
                      </div>
                      <div className="text-[13px] tabular-nums text-amber-800 font-bold">
                        {formatCurrency(spec.purchaseCost)}
                      </div>
                      <div className="text-[13px] text-slate-500">
                        Kapasite: {spec.capacityUnits} br
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Depodan Şubeye Sevkiyat */}
              {trade.shops.length > 0 && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Merkezi Depodan Mağaza Şubesine Ürün Sevk Et
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <select
                      value={dispatchWarehouseId}
                      onChange={(e) => setDispatchWarehouseId(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold"
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
                      className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold"
                    >
                      {ALL_RESOURCES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nameTR}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={5}
                      max={300}
                      value={dispatchQty}
                      onChange={(e) =>
                        setDispatchQty(
                          Math.max(1, Number(e.target.value) || 20)
                        )
                      }
                      className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs tabular-nums font-bold"
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
                      className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Şubeye Sevk Et
                    </button>
                  </div>
                </div>
              )}

              {/* Aktif Sevkiyatlar Listesi */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Yoldaki ve Tamamlanan Teslimatlar ({trade.shipments.length})
                </h5>
                {trade.shipments.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Henüz kayıtlı sevkiyat bulunmuyor.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {trade.shipments.slice(0, 12).map((sh) => (
                      <div
                        key={sh.shipmentId}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">
                            {sh.resourceNameTR} ({sh.quantity} br)
                          </span>
                          <span className="text-slate-500 ml-2">
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
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-[13px] text-amber-900">
                💡 Üretim: Hammaddeyi işleyip daha pahalı ürüne çevirmek. Örneğin un ve şekerden bisküvi yapmak. Reçete, hangi malzemeden ne üretileceğini söyler.
              </div>
              {/* Reçeteli Üretim Zinciri */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  🏭 Üretim: hammaddeden ürüne
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    data-testid="recipe-select"
                    value={selectedRecipeId}
                    onChange={(e) => setSelectedRecipeId(e.target.value)}
                    className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold"
                  >
                    {ALL_RECIPES.map((rec) => (
                      <option key={rec.recipeId} value={rec.recipeId}>
                        {rec.nameTR} (Çıktı: {rec.outputQuantity} br · Enerji:{' '}
                        {formatCurrency(rec.energyCostPerBatch)})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      data-testid="recipe-batches-input"
                      type="number"
                      min={1}
                      max={100}
                      value={recipeBatches}
                      onChange={(e) =>
                        setRecipeBatches(
                          Math.max(1, Number(e.target.value) || 1)
                        )
                      }
                      className="w-20 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs tabular-nums font-bold"
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
                      className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
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
                    className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {ch.nameTR}
                      </div>
                      <div className="text-[13px] text-slate-500">
                        Tahsilat Vadesi: {ch.paymentTermDays} gün · Marj Çarpanı{' '}
                        {ch.marginMultiplier}x
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
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-[13px] text-amber-900">
                💡 Toptan anlaşma: Bir müşteri firmayla belli miktarda mal satmak için önceden yaptığın anlaşma. Fiyat baştan bellidir, teslimat geciktirirsen ceza ödersin.
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Kurumsal ve Kamu Tedarik Sözleşmeleri (
                  {trade.commercialContracts.length})
                </h5>
                <div className="space-y-2">
                  {trade.commercialContracts.map((ct) => (
                    <div
                      key={ct.contractId}
                      data-testid={`commercial-contract-${ct.contractId}`}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">
                          {ct.buyerNameTR} — {ct.resourceNameTR}
                        </div>
                        <div className="text-[13px] text-slate-600 tabular-nums">
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
                            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
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
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
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
