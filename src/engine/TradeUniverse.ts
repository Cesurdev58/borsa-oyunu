/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TİCARET EVRENİ DURUMU: başlangıç durumu, doğrulama/onarım ve kariyer aşaması
 * (TradeAndShopEngine dosyasından ayrıldı; dış dünya hâlâ TradeAndShopEngine.* üzerinden erişebilir.)
 */

import {
  SectorId,
} from '../models/market';
import {
  SimulationStage,
  SimulationState,
} from '../models/simulation';
import {
  CareerStage,
  CommercialContract,
  InventoryBatch,
  SalesChannel,
  TradeUniverseState,
  Warehouse,
} from '../models/trade';

import {
  RESOURCE_CATALOG,
  SUPPLIER_CATALOG,
  DEFAULT_ROUTES,
} from '../data/tradeCatalog';

export class TradeUniverse {
  public static readonly TRADE_SCHEMA_VERSION = 7;

  /**
   * Başlangıç veya mevcut bir SimulationState için deterministik ve idempotent TradeUniverseState oluşturur.
   */
  public static createInitialTradeUniverseState(
    state?: Partial<SimulationState>
  ): TradeUniverseState {
    const hasCompany = Boolean(state?.playerCompany);
    const pc = state?.playerCompany;
    const isHolding = Boolean(
      state?.stage === SimulationStage.STAGE_4_HOLDING_MONOPOLY ||
        state?.stageUnlocks?.stage4Holding
    );

    const careerStage: CareerStage = isHolding
      ? 'HOLDING_LEADER'
      : hasCompany
      ? 'INCORPORATED_COMPANY'
      : 'STOCK_INVESTOR';

    const rawWarehouseCap = hasCompany
      ? Math.max(300, (pc?.productionCapacity ?? 25) * 12)
      : 250;
    const finWarehouseCap = hasCompany
      ? Math.max(400, (pc?.productionCapacity ?? 25) * 15)
      : 300;
    const distWarehouseCap = hasCompany
      ? Math.max(350, (pc?.productionCapacity ?? 25) * 12)
      : 250;

    // Eğer oyuncunun zaten kurulu bir şirketi varsa mevcut stokunu Mamul Deposu partisine (batch) yansıt
    const existingFinUnits = Math.max(
      0,
      Math.round(
        pc?.operations?.inventoryUnits ?? pc?.financials?.inventoryUnits ?? 0
      )
    );
    const defaultCompanyProductId = TradeUniverse.getDefaultProductForSector(
      pc?.sector ?? 'TEKNOLOJI'
    );
    const defaultResDef = RESOURCE_CATALOG[defaultCompanyProductId];
    const unitCost =
      pc?.operations?.unitProductionCost ??
      pc?.financials?.unitProductionCost ??
      defaultResDef.baseMarketPrice * 0.65;

    const initialFinBatches: InventoryBatch[] =
      existingFinUnits > 0
        ? [
            {
              batchId: 'BATCH-INIT-FIN-0001',
              resourceId: defaultCompanyProductId,
              resourceNameTR: defaultResDef.nameTR,
              category: 'FINISHED_PRODUCT',
              quantity: existingFinUnits,
              reservedQuantity: 0,
              availableQuantity: existingFinUnits,
              unitCost: Number(unitCost.toFixed(2)),
              totalValue: Number((existingFinUnits * unitCost).toFixed(2)),
              qualityScore: 84,
              receivedDay: state?.day ?? 1,
              expirationDay: null,
            },
          ]
        : [];

    const warehouses: Warehouse[] = [
      {
        warehouseId: 'WH_RAW_MAIN',
        nameTR: 'Merkez Hammadde Deposu',
        type: 'RAW_MATERIAL',
        level: 1,
        maxCapacityUnits: rawWarehouseCap,
        usedCapacityUnits: 0,
        dailyOperatingCost: hasCompany ? 350 : 0,
        dailyStorageCostPerUnit: 1.2,
        spoilageProtectionFactor: 0.85,
        batches: [],
      },
      {
        warehouseId: 'WH_FIN_MAIN',
        nameTR: 'Merkez Mamul Ürün Deposu',
        type: 'FINISHED_GOODS',
        level: 1,
        maxCapacityUnits: finWarehouseCap,
        usedCapacityUnits: existingFinUnits,
        dailyOperatingCost: hasCompany ? 420 : 0,
        dailyStorageCostPerUnit: 1.5,
        spoilageProtectionFactor: 0.8,
        batches: initialFinBatches,
      },
      {
        warehouseId: 'WH_DIST_MAIN',
        nameTR: 'Ticari Dağıtım ve Sevkiyat Deposu',
        type: 'DISTRIBUTION',
        level: 1,
        maxCapacityUnits: distWarehouseCap,
        usedCapacityUnits: 0,
        dailyOperatingCost: hasCompany ? 300 : 0,
        dailyStorageCostPerUnit: 1.1,
        spoilageProtectionFactor: 0.75,
        batches: [],
      },
    ];

    const salesChannels: SalesChannel[] = [
      {
        channelId: 'CH_OWN_SHOPS',
        channelType: 'OWN_SHOPS',
        nameTR: 'Kendi Perakende Dükkânları & Şubeleri',
        descriptionTR:
          'Şehirdeki esnaf dükkânlarınız ve mağaza şubeleriniz üzerinden doğrudan tüketiciye yüksek marjlı satış.',
        isUnlocked: true,
        unlockRequirementTR: 'İlk dükkân açıldığında aktif olur',
        demandMultiplier: 1.0,
        marginMultiplier: 1.25,
        paymentTermDays: 0,
        logisticsCostShare: 0.03,
        returnRiskPct: 1.5,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
      {
        channelId: 'CH_WHOLESALE',
        channelType: 'WHOLESALE_MARKET',
        nameTR: 'Toptancı Hali & Spot Piyasa',
        descriptionTR:
          'Daha düşük marjla fakat yüksek hacimli ve peşin tahsilatlı toptan satış kanalı.',
        isUnlocked: true,
        unlockRequirementTR: 'Başlangıçtan itibaren açık',
        demandMultiplier: 1.35,
        marginMultiplier: 0.88,
        paymentTermDays: 0,
        logisticsCostShare: 0.05,
        returnRiskPct: 1.0,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
      {
        channelId: 'CH_REGIONAL_DIST',
        channelType: 'REGIONAL_DISTRIBUTOR',
        nameTR: 'Bölgesel Bayi ve Dağıtım Ağı',
        descriptionTR:
          'Düzenli haftalık alım yapan bölgesel bayilere 7 gün vadeli orta marjlı satış.',
        isUnlocked: hasCompany,
        unlockRequirementTR: 'Şirketleşme aşamasında açılır',
        demandMultiplier: 1.2,
        marginMultiplier: 1.02,
        paymentTermDays: 7,
        logisticsCostShare: 0.06,
        returnRiskPct: 2.0,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
      {
        channelId: 'CH_CORPORATE_CONTRACT',
        channelType: 'CORPORATE_CONTRACT',
        nameTR: 'Kurumsal Tedarik Sözleşmeleri (B2B)',
        descriptionTR:
          'Büyük kurumsal alıcılarla sabit fiyat ve taahhütlü teslimat sözleşmeleri.',
        isUnlocked: hasCompany,
        unlockRequirementTR: 'Şirketleşme aşamasında açılır',
        demandMultiplier: 1.4,
        marginMultiplier: 1.08,
        paymentTermDays: 14,
        logisticsCostShare: 0.05,
        returnRiskPct: 1.2,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
      {
        channelId: 'CH_EXPORT',
        channelType: 'EXPORT_CHANNEL',
        nameTR: 'Uluslararası İhracat Kanalı',
        descriptionTR:
          'Yüksek kalite puanı (82+) gerektiren döviz endeksli yüksek hacimli ihracat pazarı.',
        isUnlocked: Boolean(hasCompany && (pc?.corporateGovernanceScore ?? 0) >= 75),
        unlockRequirementTR: 'Şirket + 75 Kurumsal İtibar ile açılır',
        demandMultiplier: 1.5,
        marginMultiplier: 1.18,
        paymentTermDays: 15,
        logisticsCostShare: 0.09,
        returnRiskPct: 2.5,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
      {
        channelId: 'CH_HOLDING_INTERNAL',
        channelType: 'HOLDING_INTERNAL',
        nameTR: 'Holding İçi Şirketler Arası Tedarik',
        descriptionTR:
          'Üretim şirketinden perakende zincirine iç transfer fiyatlamasıyla tedarik (konsolide ciroda çift sayılmaz).',
        isUnlocked: isHolding,
        unlockRequirementTR: 'Holding aşamasında açılır',
        demandMultiplier: 1.25,
        marginMultiplier: 1.0,
        paymentTermDays: 0,
        logisticsCostShare: 0.02,
        returnRiskPct: 0,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
    ];

    const initialContracts: CommercialContract[] = [
      {
        contractId: 'CC-OFFER-0001',
        buyerNameTR: 'Marmara Kurumsal Marketler Zinciri',
        buyerSegment: 'HIGH_VOLUME_CHAIN',
        resourceId: 'FIN_PACKAGED_FOOD',
        resourceNameTR: RESOURCE_CATALOG.FIN_PACKAGED_FOOD.nameTR,
        totalRequiredUnits: 60,
        deliveredUnits: 0,
        remainingUnits: 60,
        dailyDeliveryTarget: 10,
        unitSalePrice: 445,
        paymentTermDays: 7,
        latePenaltyPerUnit: 45,
        minQualityRequired: 75,
        reputationReward: 4,
        reputationPenalty: 6,
        startDay: state?.day ?? 1,
        dueDay: (state?.day ?? 1) + 12,
        status: 'OFFERED',
      },
      {
        contractId: 'CC-OFFER-0002',
        buyerNameTR: 'Anadolu Tekstil İhracat Konsorsiyumu',
        buyerSegment: 'CORPORATE_BUYER',
        resourceId: 'FIN_APPAREL_SET',
        resourceNameTR: RESOURCE_CATALOG.FIN_APPAREL_SET.nameTR,
        totalRequiredUnits: 35,
        deliveredUnits: 0,
        remainingUnits: 35,
        dailyDeliveryTarget: 5,
        unitSalePrice: 1_320,
        paymentTermDays: 10,
        latePenaltyPerUnit: 120,
        minQualityRequired: 80,
        reputationReward: 5,
        reputationPenalty: 7,
        startDay: state?.day ?? 1,
        dueDay: (state?.day ?? 1) + 14,
        status: 'OFFERED',
      },
      {
        contractId: 'CC-OFFER-0003',
        buyerNameTR: 'TeknoPark Kurumsal Donanım Tedariği',
        buyerSegment: 'CORPORATE_BUYER',
        resourceId: 'FIN_SMART_DEVICE',
        resourceNameTR: RESOURCE_CATALOG.FIN_SMART_DEVICE.nameTR,
        totalRequiredUnits: 20,
        deliveredUnits: 0,
        remainingUnits: 20,
        dailyDeliveryTarget: 4,
        unitSalePrice: 4_450,
        paymentTermDays: 14,
        latePenaltyPerUnit: 350,
        minQualityRequired: 85,
        reputationReward: 6,
        reputationPenalty: 8,
        startDay: state?.day ?? 1,
        dueDay: (state?.day ?? 1) + 15,
        status: 'OFFERED',
      },
    ];

    return {
      schemaVersion: TradeUniverse.TRADE_SCHEMA_VERSION,
      careerStage,
      tradeReputationScore: hasCompany ? 72 : 58,
      supplierReliabilityScore: 88,
      deliveryPunctualityScore: 92,
      customerSatisfactionScore: 78,
      logisticsMode: 'EXTERNAL_LOGISTICS',
      autoProcurementEnabled: false,
      autoShopReplenishEnabled: true,
      shops: [],
      warehouses,
      suppliers: JSON.parse(JSON.stringify(SUPPLIER_CATALOG)),
      procurementOrders: [],
      purchaseContracts: [],
      productionOrders: [],
      shipments: [],
      vehicles: [],
      routes: JSON.parse(JSON.stringify(DEFAULT_ROUTES)),
      salesChannels,
      commercialContracts: initialContracts,
      invoices: [],
      payments: [],
      activeTradeEvents: [],
      processedOrderIds: [],
      deliveredShipmentIds: [],
      orderSeq: 0,
      shipmentSeq: 0,
      batchSeq: initialFinBatches.length,
      contractSeq: initialContracts.length,
      invoiceSeq: 0,
      productionSeq: 0,
      shopSeq: 0,
      vehicleSeq: 0,
      todaySummary: {
        procurementSpend: 0,
        productionUnits: 0,
        productionCost: 0,
        logisticsCost: 0,
        shopSalesRevenue: 0,
        shopCogs: 0,
        shopOpex: 0,
        shopSpoilageCost: 0,
        shopNetProfit: 0,
        wholesaleAndContractRevenue: 0,
        wholesaleAndContractCogs: 0,
        intercompanyEliminatedRevenue: 0,
        receivablesCollected: 0,
        payablesPaid: 0,
        overduePenaltiesPaid: 0,
      },
      lastTradeAuditReport: null,
    };
  }

  /**
   * Mevcut bir SimulationState üzerinde tradeState alanının varlığını ve tutarlılığını idempotent olarak garanti eder.
   * Eski kayıtlarda mükerrer stok, mükerrer para veya nakit değişimi oluşturmaz!
   */
  public static ensureTradeUniverseState(state: SimulationState): TradeUniverseState {
    if (!state.tradeState || typeof state.tradeState !== 'object') {
      state.tradeState = TradeUniverse.createInitialTradeUniverseState(state);
      return state.tradeState;
    }

    const ts = state.tradeState;
    ts.schemaVersion = TradeUniverse.TRADE_SCHEMA_VERSION;
    if (!Array.isArray(ts.shops)) ts.shops = [];
    if (!Array.isArray(ts.warehouses) || ts.warehouses.length === 0) {
      ts.warehouses = TradeUniverse.createInitialTradeUniverseState(state).warehouses;
    }
    if (!Array.isArray(ts.suppliers) || ts.suppliers.length === 0) {
      ts.suppliers = JSON.parse(JSON.stringify(SUPPLIER_CATALOG));
    }
    if (!Array.isArray(ts.procurementOrders)) ts.procurementOrders = [];
    if (!Array.isArray(ts.purchaseContracts)) ts.purchaseContracts = [];
    if (!Array.isArray(ts.productionOrders)) ts.productionOrders = [];
    if (!Array.isArray(ts.shipments)) ts.shipments = [];
    if (!Array.isArray(ts.vehicles)) ts.vehicles = [];
    if (!Array.isArray(ts.routes) || ts.routes.length === 0) {
      ts.routes = JSON.parse(JSON.stringify(DEFAULT_ROUTES));
    }
    if (!Array.isArray(ts.salesChannels) || ts.salesChannels.length === 0) {
      ts.salesChannels = TradeUniverse.createInitialTradeUniverseState(state).salesChannels;
    }
    if (!Array.isArray(ts.commercialContracts)) ts.commercialContracts = [];
    if (!Array.isArray(ts.invoices)) ts.invoices = [];
    if (!Array.isArray(ts.payments)) ts.payments = [];
    if (!Array.isArray(ts.activeTradeEvents)) ts.activeTradeEvents = [];
    if (!Array.isArray(ts.processedOrderIds)) ts.processedOrderIds = [];
    if (!Array.isArray(ts.deliveredShipmentIds)) ts.deliveredShipmentIds = [];

    TradeUniverse.updateCareerStage(state);
    return ts;
  }

  public static getDefaultProductForSector(sector: SectorId): string {
    switch (sector) {
      case 'TEKNOLOJI':
      case 'SAVUNMA':
        return 'FIN_SMART_DEVICE';
      case 'PERAKENDE':
        return 'FIN_PACKAGED_FOOD';
      case 'ENERJI':
      case 'MADENCILIK':
      case 'LOJISTIK':
        return 'FIN_PASSENGER_CAR';
      case 'BIYOTEKNOLOJI':
      case 'FINANS':
      default:
        return 'FIN_HOUSEHOLD_ESSENTIALS';
    }
  }

  public static getDefaultRawMaterialForSector(sector: SectorId): string {
    switch (sector) {
      case 'TEKNOLOJI':
      case 'SAVUNMA':
        return 'RAW_ELEC_COMP';
      case 'PERAKENDE':
        return 'RAW_WHEAT';
      case 'ENERJI':
      case 'MADENCILIK':
      case 'LOJISTIK':
        return 'RAW_METAL';
      default:
        return 'RAW_PLASTIC';
    }
  }

  public static getDefaultRecipeForSector(sector: SectorId): string {
    switch (sector) {
      case 'TEKNOLOJI':
      case 'SAVUNMA':
        return 'REC_FIN_SMART_DEVICE';
      case 'PERAKENDE':
        return 'REC_FIN_PACKAGED_FOOD';
      case 'ENERJI':
      case 'MADENCILIK':
      case 'LOJISTIK':
        return 'REC_FIN_PASSENGER_CAR';
      default:
        return 'REC_FIN_HOUSEHOLD_ESSENTIALS';
    }
  }

  /**
   * Oyuncunun kariyer aşamasını (`careerStage`) mevcut dükkân, şirket ve holding durumuna göre günceller.
   */
  public static updateCareerStage(state: SimulationState): CareerStage {
    const ts = state.tradeState;
    if (!ts) return 'STOCK_INVESTOR';

    if (
      state.stage === SimulationStage.STAGE_4_HOLDING_MONOPOLY ||
      state.stageUnlocks.stage4Holding ||
      state.controlledSubsidiaries.length > 0
    ) {
      ts.careerStage = 'HOLDING_LEADER';
    } else if (state.playerCompany !== null) {
      ts.careerStage = 'INCORPORATED_COMPANY';
    } else if (ts.shops.length >= 2) {
      ts.careerStage = 'MULTI_BRANCH_MERCHANT';
    } else if (ts.shops.length === 1) {
      ts.careerStage = 'SMALL_MERCHANT';
    } else {
      ts.careerStage = 'STOCK_INVESTOR';
    }
    return ts.careerStage;
  }
}
