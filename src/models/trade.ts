/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TİCARET EVRENİ, TEDARİK ZİNCİRİ, DEPO, LOJİSTİK, ESNAF DÜKKÂNLARI VE KARİYER MODELLERİ (v7)
 * Ticarium benzeri uçtan uca gerçek ticaret zinciri:
 * Hammadde -> Tedarikçi -> Satın Alma -> Sevkiyat -> Depo -> Üretim -> Mamul Deposu -> Dağıtım -> Mağaza / Kurumsal Müşteri -> Satış -> Tahsilat
 */

export type TradeSectorId =
  | 'GIDA'
  | 'TEKSTIL'
  | 'ELEKTRONIK'
  | 'MOBILYA'
  | 'PERAKENDE_GENEL'
  | 'OTOMOTIV';

export type CareerStage =
  | 'STOCK_INVESTOR'
  | 'SMALL_MERCHANT'
  | 'MULTI_BRANCH_MERCHANT'
  | 'INCORPORATED_COMPANY'
  | 'HOLDING_LEADER';

export type ResourceCategory =
  | 'RAW_MATERIAL'
  | 'INTERMEDIATE_GOOD'
  | 'FINISHED_PRODUCT';

export interface ResourceDefinition {
  id: string;
  nameTR: string;
  category: ResourceCategory;
  sector: TradeSectorId;
  unitLabel: string;
  baseMarketPrice: number;
  unitWeightKg: number;
  spoilageRateDaily: number; // 0.00 - 0.12 arası (özellikle taze gıda için)
  defaultQuality: number; // 0 - 100
  minOrderQty: number;
}

export type ProductDefinition = ResourceDefinition;
export type ResourceId = string;
export type RecipeId = string;
export type PaymentTermType = 'CASH' | 'CREDIT';
export type VehicleTypeId = LogisticsVehicleType;
export type ShopTypeId = ShopType;

export interface RecipeInputItem {
  resourceId: string;
  quantityPerUnit: number;
}

export interface RecipeDefinition {
  recipeId: string;
  nameTR: string;
  sector: TradeSectorId;
  inputs: RecipeInputItem[];
  outputResourceId: string;
  outputQuantity: number;
  machineHoursPerBatch: number;
  workerCountRequired: number;
  energyCostPerBatch: number;
  wasteRatePct: number;
  qualityMultiplierEffect: number;
}

export type SupplierArchetype =
  | 'CHEAP_SLOW'
  | 'EXPENSIVE_RELIABLE'
  | 'HIGH_QUALITY'
  | 'HIGH_VOLUME'
  | 'LOCAL_FAST'
  | 'IMPORTER';

export interface Supplier {
  supplierId: string;
  nameTR: string;
  cityTR: string;
  archetype: SupplierArchetype;
  archetypeLabelTR: string;
  sectorFocus: TradeSectorId[];
  suppliedResourceIds: string[];
  reliabilityScore: number; // 0 - 100
  qualityScore: number; // 0 - 100
  deliverySpeedDays: number; // 1 - 6 oyun günü
  basePriceMultiplier: number; // 0.82 - 1.22
  volumeDiscountThreshold: number;
  volumeDiscountPct: number;
  paymentTermDaysAllowed: number; // 0 (peşin), 7, 15, 30
  maxDailyCapacity: number;
  stockOutProbability: number;
  priceVolatility: number;
}

export interface SupplierOffer {
  offerId: string;
  supplierId: string;
  supplierNameTR: string;
  resourceId: string;
  resourceNameTR: string;
  unitPrice: number;
  minOrderQuantity: number;
  maxAvailableQuantity: number;
  deliveryDays: number;
  shippingCostPerUnit: number;
  qualityScore: number;
  reliabilityScore: number;
  paymentTermDays: number;
}

export type ProcurementOrderStatus =
  | 'DRAFT'
  | 'APPROVED'
  | 'PREPARING'
  | 'IN_TRANSIT'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED'
  | 'DELAYED'
  | 'CANCELLED'
  | 'DISPUTED';

export interface ProcurementOrder {
  orderId: string;
  supplierId: string;
  supplierNameTR: string;
  resourceId: string;
  resourceNameTR: string;
  orderedQuantity: number;
  deliveredQuantity: number;
  unitPrice: number;
  subtotalCost: number;
  shippingCost: number;
  taxAmount: number;
  totalCost: number;
  qualityScore: number;
  paymentMethod: 'CASH' | 'CREDIT';
  paidAmount: number;
  payableAmount: number;
  dueDay: number;
  createdDay: number;
  estimatedArrivalDay: number;
  actualArrivalDay: number | null;
  targetDestinationType: 'WAREHOUSE' | 'SHOP';
  targetDestinationId: string;
  targetDestinationNameTR: string;
  status: ProcurementOrderStatus;
  shipmentId: string;
  idempotencyKey: string;
}

export interface PurchaseContractSafetyLimits {
  maxDailySpend: number;
  minCashReserve: number;
  targetStockDays: number;
  maxWarehouseFillPct: number;
}

export interface PurchaseContract {
  contractId: string;
  supplierId: string;
  supplierNameTR: string;
  resourceId: string;
  resourceNameTR: string;
  targetDestinationType: 'WAREHOUSE' | 'SHOP';
  targetDestinationId: string;
  periodDays: number; // 1 = günlük, 7 = haftalık
  autoTriggerMode: 'PERIODIC' | 'LOW_STOCK_THRESHOLD';
  lowStockThresholdUnits: number;
  orderQuantityPerTrigger: number;
  lockedUnitPrice: number;
  discountPct: number;
  minCommitmentUnits: number;
  earlyTerminationPenalty: number;
  safetyLimits: PurchaseContractSafetyLimits;
  startDay: number;
  endDay: number;
  lastTriggeredDay: number;
  totalOrderedUnits: number;
  isActive: boolean;
}

export type WarehouseType =
  | 'RAW_MATERIAL'
  | 'FINISHED_GOODS'
  | 'DISTRIBUTION'
  | 'SHOP_BACKROOM';

export interface InventoryBatch {
  batchId: string;
  resourceId: string;
  resourceNameTR: string;
  category: ResourceCategory;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  unitCost: number;
  totalValue: number;
  qualityScore: number;
  receivedDay: number;
  expirationDay: number | null;
  sourceOrderId?: string;
}

export interface Warehouse {
  warehouseId: string;
  nameTR: string;
  type: WarehouseType;
  level: number;
  maxCapacityUnits: number;
  usedCapacityUnits: number;
  dailyOperatingCost: number;
  dailyStorageCostPerUnit: number;
  spoilageProtectionFactor: number; // 1.0 = normal, 0.5 = soğuk hava deposu (%50 daha az fire)
  batches: InventoryBatch[];
}

export interface ProductionOrder {
  productionOrderId: string;
  recipeId: string;
  recipeNameTR: string;
  outputResourceId: string;
  outputResourceNameTR: string;
  requestedUnits: number;
  actualProducedUnits: number;
  wastedUnits: number;
  rawMaterialCostTotal: number;
  laborCostTotal: number;
  energyCostTotal: number;
  totalProductionCost: number;
  unitProductionCost: number;
  outputQualityScore: number;
  createdDay: number;
  status: 'COMPLETED' | 'PARTIAL_BOTTLENECK' | 'BLOCKED_NO_INPUT';
  bottleneckReasonTR?: string;
}

export type LogisticsVehicleType =
  | 'SMALL_VAN'
  | 'MEDIUM_TRUCK'
  | 'HEAVY_TRUCK'
  | 'SPECIAL_CARGO';

export type LogisticsMode = 'EXTERNAL_LOGISTICS' | 'OWN_FLEET';

export interface LogisticsVehicle {
  vehicleId: string;
  nameTR: string;
  vehicleType: LogisticsVehicleType;
  capacityUnits: number;
  speedMultiplier: number;
  purchaseCost: number;
  dailyMaintenanceCost: number;
  fuelCostPerTrip: number;
  driverDailyWage: number;
  conditionPct: number;
  status: 'IDLE' | 'IN_TRANSIT' | 'MAINTENANCE';
  assignedShipmentId: string | null;
}

export interface LogisticsRoute {
  routeId: string;
  originNameTR: string;
  destinationNameTR: string;
  distanceKm: number;
  baseTransitDays: number;
  baseExternalCostPerUnit: number;
  delayRiskPct: number;
  damageRiskPct: number;
}

export type ShipmentStatus =
  | 'PLANNED'
  | 'LOADING'
  | 'IN_TRANSIT'
  | 'DELAYED'
  | 'DELIVERED'
  | 'PARTIALLY_DELIVERED'
  | 'CANCELLED'
  | 'DAMAGED';

export interface Shipment {
  shipmentId: string;
  sourceType: 'SUPPLIER' | 'WAREHOUSE' | 'FACTORY';
  sourceId: string;
  sourceNameTR: string;
  destinationType: 'WAREHOUSE' | 'SHOP' | 'CORPORATE_CLIENT';
  destinationId: string;
  destinationNameTR: string;
  resourceId: string;
  resourceNameTR: string;
  quantity: number;
  deliveredQuantity: number;
  damagedQuantity: number;
  unitCostBasis: number;
  qualityScore: number;
  logisticsMode: LogisticsMode;
  vehicleId: string | null;
  shippingCost: number;
  dispatchedDay: number;
  estimatedArrivalDay: number;
  actualArrivalDay: number | null;
  status: ShipmentStatus;
  relatedOrderId?: string;
  relatedContractId?: string;
}

export type ShopType =
  | 'BUFE'
  | 'MANAV'
  | 'KAFE'
  | 'GIYIM_MAGAZASI'
  | 'ELEKTRONIK_MAGAZASI'
  | 'MOBILYA_MAGAZASI'
  | 'MARKET'
  | 'OTOMOBIL_GALERISI';

export type CustomerSegment =
  | 'PRICE_SENSITIVE'
  | 'STANDARD_CONSUMER'
  | 'QUALITY_FOCUSED'
  | 'CORPORATE_BUYER'
  | 'WHOLESALE_DEALER'
  | 'HIGH_VOLUME_CHAIN';

export interface ShopTemplate {
  shopType: ShopType;
  nameTR: string;
  shortTagTR: string;
  defaultCityBlockId: string;
  openingCost: number;
  decorationCost: number;
  dailyRentBase: number;
  minStaffRequired: number;
  staffDailyWagePerPerson: number;
  baseCustomerCapacity: number;
  /** Müşteri başına ortalama sepet tutarı (TL, satış fiyatıyla). Günlük ciro ≈ müşteri sayısı × bu değer. */
  avgBasketValueTL: number;
  baseShelfCapacity: number;
  baseBackroomCapacity: number;
  allowedResourceIds: string[];
  defaultGrossMarginPct: number;
  customerSegment: CustomerSegment;
  demandVolatility: number;
  specificMechanicKey:
    | 'FAST_TURNOVER_IMPULSE'
    | 'DAILY_SPOILAGE_FRESHNESS'
    | 'RECIPE_TABLE_SERVICE'
    | 'SEASONAL_FASHION_COLLECTION'
    | 'HIGH_TICKET_WARRANTY_INSTALLMENT'
    | 'LARGE_STORAGE_HOME_DELIVERY'
    | 'MULTI_CATEGORY_SHELF_BASKET'
    | 'HIGH_CAPITAL_VEHICLE_SHOWROOM';
  specificMechanicTitleTR: string;
  specificMechanicDescriptionTR: string;
  levelUpgradeCosts: [number, number, number, number]; // Lv1->2, Lv2->3, Lv3->4, Lv4->5
}

export interface ShopInstance {
  shopId: string;
  shopType: ShopType;
  nameTR: string;
  cityBlockId: string;
  level: 1 | 2 | 3 | 4 | 5;
  openedDay: number;
  isCompanyBranch: boolean;
  cashAccountBalance: number;
  totalInvestedCapital: number;
  dailyRent: number;
  staffCount: number;
  minStaffRequired: number;
  staffDailyWagePerPerson: number;
  maxCustomerCapacity: number;
  shelfCapacity: number;
  backroomCapacity: number;
  inventoryBatches: InventoryBatch[];
  sellingPrices: Record<string, number>;
  autoReplenishEnabled: boolean;
  customerSatisfaction: number; // 0 - 100
  reputationScore: number; // 0 - 100
  /** Karar kartından gelen geçici müşteri çarpanı (eski kayıtlarda yoktur) */
  demandBoost?: { multiplier: number; untilDay: number };
  todayWalkInCustomers: number;
  todayServedCustomers: number;
  todayUnmetCustomerDemand: number;
  todayUnitsSold: number;
  todaySalesRevenue: number;
  todayCogs: number;
  todayRentAndOpex: number;
  todayPayrollCost: number;
  todaySpoilageUnits: number;
  todaySpoilageCost: number;
  todayNetProfit: number;
  cumulativeRevenue: number;
  cumulativeNetProfit: number;
  dailyProfitHistory30: number[];
  pendingDeliveriesCount: number;
  mainIssueTR: string;
  recommendedActionTR: string;
  specificState: {
    spoilageRateMultiplier: number;
    tableCount: number;
    seasonalCollectionActive: boolean;
    warrantySatisfactionBonus: number;
    deliveryServiceCapacity: number;
    activeCategoryCount: number;
    showroomSlots: number;
  };
}

export type RetailLocation = ShopInstance;

export type SalesChannelType =
  | 'OWN_SHOPS'
  | 'WHOLESALE_MARKET'
  | 'REGIONAL_DISTRIBUTOR'
  | 'CORPORATE_CONTRACT'
  | 'EXPORT_CHANNEL'
  | 'HOLDING_INTERNAL';

export interface SalesChannel {
  channelId: string;
  channelType: SalesChannelType;
  nameTR: string;
  descriptionTR: string;
  isUnlocked: boolean;
  unlockRequirementTR: string;
  demandMultiplier: number;
  marginMultiplier: number;
  paymentTermDays: number;
  logisticsCostShare: number;
  returnRiskPct: number;
  todayUnitsSold: number;
  todayRevenue: number;
}

export type CommercialContractStatus =
  | 'OFFERED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'DEFAULTED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface CommercialContract {
  contractId: string;
  buyerNameTR: string;
  buyerSegment: CustomerSegment;
  resourceId: string;
  resourceNameTR: string;
  totalRequiredUnits: number;
  deliveredUnits: number;
  remainingUnits: number;
  dailyDeliveryTarget: number;
  unitSalePrice: number;
  paymentTermDays: number;
  latePenaltyPerUnit: number;
  minQualityRequired: number;
  reputationReward: number;
  reputationPenalty: number;
  startDay: number;
  dueDay: number;
  status: CommercialContractStatus;
}

export type TradeInvoiceStatus =
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'UNCOLLECTIBLE';

export interface TradeInvoice {
  invoiceId: string;
  direction: 'RECEIVABLE' | 'PAYABLE';
  counterpartyNameTR: string;
  relatedOrderId?: string;
  relatedContractId?: string;
  relatedShopId?: string;
  issueDay: number;
  dueDay: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  lateFeeAccrued: number;
  status: TradeInvoiceStatus;
}

export interface TradePayment {
  paymentId: string;
  invoiceId: string;
  day: number;
  amount: number;
  direction: 'INFLOW' | 'OUTFLOW';
  description: string;
}

export type TradeEventType =
  | 'RAW_MATERIAL_SURGE'
  | 'SUPPLIER_DELAY'
  | 'PORT_CONGESTION'
  | 'DEMAND_BOOM'
  | 'ENERGY_HIKE'
  | 'QUALITY_INSPECTION'
  | 'COMPETITOR_DISCOUNT'
  | 'BULK_CONTRACT_OFFER';

export interface TradeEvent {
  eventId: string;
  eventType: TradeEventType;
  titleTR: string;
  descriptionTR: string;
  affectedSector: TradeSectorId | 'ALL';
  affectedResourceId?: string;
  priceImpactMultiplier: number;
  demandImpactMultiplier: number;
  delayDaysAdded: number;
  startDay: number;
  endDay: number;
  isActive: boolean;
}

export interface IncorporationEligibilityResult {
  eligible: boolean;
  alreadyIncorporated: boolean;
  activeShopBranchesCount: number;
  minBranchesRequired: number;
  last30DaysOperatingProfit: number;
  totalShopStaffCount: number;
  minStaffRequired: number;
  totalBusinessValue: number;
  minBusinessValueRequired: number;
  hasOverdueDebt: boolean;
  tradeReputationScore: number;
  minReputationRequired: number;
  reasons: string[];
}

export interface TradeIntegrityAuditReport {
  valid: boolean;
  checkedDay: number;
  negativeStockBatchesCount: number;
  exceededWarehouseCount: number;
  duplicateOrderCount: number;
  duplicateShipmentDeliveryCount: number;
  imaginarySalesCount: number;
  unexplainedCashDelta: number;
  unexplainedStockDelta: number;
  errors: string[];
}

export interface TradeUniverseState {
  schemaVersion: number;
  careerStage: CareerStage;
  tradeReputationScore: number; // 0 - 100
  supplierReliabilityScore: number; // 0 - 100
  deliveryPunctualityScore: number; // 0 - 100
  customerSatisfactionScore: number; // 0 - 100
  logisticsMode: LogisticsMode;
  autoProcurementEnabled: boolean;
  autoShopReplenishEnabled: boolean;
  shops: ShopInstance[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  procurementOrders: ProcurementOrder[];
  purchaseContracts: PurchaseContract[];
  productionOrders: ProductionOrder[];
  shipments: Shipment[];
  vehicles: LogisticsVehicle[];
  routes: LogisticsRoute[];
  salesChannels: SalesChannel[];
  commercialContracts: CommercialContract[];
  invoices: TradeInvoice[];
  payments: TradePayment[];
  activeTradeEvents: TradeEvent[];
  processedOrderIds: string[];
  deliveredShipmentIds: string[];
  orderSeq: number;
  shipmentSeq: number;
  batchSeq: number;
  contractSeq: number;
  invoiceSeq: number;
  productionSeq: number;
  shopSeq: number;
  vehicleSeq: number;
  todaySummary: {
    procurementSpend: number;
    productionUnits: number;
    productionCost: number;
    logisticsCost: number;
    shopSalesRevenue: number;
    shopCogs: number;
    shopOpex: number;
    shopSpoilageCost: number;
    shopNetProfit: number;
    wholesaleAndContractRevenue: number;
    wholesaleAndContractCogs: number;
    intercompanyEliminatedRevenue: number;
    receivablesCollected: number;
    payablesPaid: number;
    overduePenaltiesPaid: number;
  };
  lastTradeAuditReport: TradeIntegrityAuditReport | null;
}
