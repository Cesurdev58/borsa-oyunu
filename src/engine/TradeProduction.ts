/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ÜRETİM VE LOJİSTİK: reçete üretimi, araç, depo-dükkân sevkiyatı, ticari sözleşmeler
 * (TradeAndShopEngine dosyasından ayrıldı; dış dünya hâlâ TradeAndShopEngine.* üzerinden erişebilir.)
 */

import {
  SimulationState,
} from '../models/simulation';
import {
  LogisticsMode,
  LogisticsVehicle,
  LogisticsVehicleType,
  ProductionOrder,
  Shipment,
  TradeInvoice,
} from '../models/trade';
import {
  WalletEngine,
} from './WalletEngine';

import {
  RESOURCE_CATALOG,
  RECIPE_CATALOG,
  VEHICLE_CATALOG,
} from '../data/tradeCatalog';
import {
  TradeInventory,
} from './TradeInventory';
import {
  TradeUniverse,
} from './TradeUniverse';
import { CompanyWallet } from './CompanyWallet';

export class TradeProduction {
  /**
   * Hammadde deposundaki (`WH_RAW_MAIN`) girdileri kullanarak reçeteli üretim yapar:
   * - Gerekli hammaddeler yoksa üretim durur veya mevcut hammadde miktarıyla sınırlandırılır.
   * - Hammadde tüketildiği anda aynı anda iki farklı üretimde kullanılamaz.
   * - Fire oranı (`wasteRatePct`), işçilik ve enerji maliyetini birim üretim maliyetine yansıtır.
   * - Üretilen mamul `WH_FIN_MAIN` deposuna eklenir.
   */
  public static executeRecipeProduction(
    state: SimulationState,
    params: {
      recipeId: string;
      requestedBatches: number;
    }
  ): {
    success: boolean;
    message: string;
    productionOrder: ProductionOrder | null;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const recipe = RECIPE_CATALOG[params.recipeId];
    if (!recipe) {
      return {
        success: false,
        message: 'Geçersiz üretim reçetesi.',
        productionOrder: null,
      };
    }

    const rawWh =
      ts.warehouses.find((w) => w.type === 'RAW_MATERIAL') || ts.warehouses[0];
    const finWh =
      ts.warehouses.find((w) => w.type === 'FINISHED_GOODS') || ts.warehouses[1];

    const requested = Math.max(1, Math.floor(params.requestedBatches));

    // 1. Hammadde uygunluğunu kontrol et
    let maxPossibleByInputs = requested;
    let bottleneckReasonTR: string | undefined;

    for (const inp of recipe.inputs) {
      const avail = TradeInventory.getAvailableResourceUnits(
        rawWh.batches,
        inp.resourceId
      );
      const possible = Math.floor(avail / inp.quantityPerUnit);
      if (possible < maxPossibleByInputs) {
        maxPossibleByInputs = possible;
        const inpName = RESOURCE_CATALOG[inp.resourceId]?.nameTR || inp.resourceId;
        bottleneckReasonTR = `Yetersiz ${inpName} stoğu (Mevcut: ${avail}, Gereken/Birim: ${inp.quantityPerUnit})`;
      }
    }

    // 2. Mamul deposu boş alan kontrolü
    const finFreeSpace = Math.max(
      0,
      finWh.maxCapacityUnits - finWh.usedCapacityUnits
    );
    if (finFreeSpace < maxPossibleByInputs) {
      maxPossibleByInputs = finFreeSpace;
      bottleneckReasonTR = `Mamul deposu (${finWh.nameTR}) dolu (Boş alan: ${finFreeSpace})`;
    }

    // 3. Fabrika kapasitesi kontrolü (eğer şirket varsa)
    if (state.playerCompany) {
      const capLimit = Math.max(
        5,
        state.playerCompany.operations?.effectiveCapacity ??
          state.playerCompany.productionCapacity
      );
      if (maxPossibleByInputs > capLimit) {
        maxPossibleByInputs = capLimit;
        bottleneckReasonTR = `Günlük etkin fabrika kapasitesi sınırı (${capLimit} birim)`;
      }
    }

    const outputResDef = RESOURCE_CATALOG[recipe.outputResourceId];
    ts.productionSeq += 1;
    const prodId = `PRD-D${state.day}-S${String(ts.productionSeq).padStart(6, '0')}`;

    if (maxPossibleByInputs <= 0) {
      const blockedOrder: ProductionOrder = {
        productionOrderId: prodId,
        recipeId: recipe.recipeId,
        recipeNameTR: recipe.nameTR,
        outputResourceId: recipe.outputResourceId,
        outputResourceNameTR: outputResDef.nameTR,
        requestedUnits: requested,
        actualProducedUnits: 0,
        wastedUnits: 0,
        rawMaterialCostTotal: 0,
        laborCostTotal: 0,
        energyCostTotal: 0,
        totalProductionCost: 0,
        unitProductionCost: 0,
        outputQualityScore: 0,
        createdDay: state.day,
        status: 'BLOCKED_NO_INPUT',
        bottleneckReasonTR:
          bottleneckReasonTR || 'Hammadde stoğu bulunmadığı için üretim durdu.',
      };
      ts.productionOrders.unshift(blockedOrder);
      return {
        success: false,
        message: `Üretim yapılamadı: ${blockedOrder.bottleneckReasonTR}`,
        productionOrder: blockedOrder,
      };
    }

    // Hammaddeleri atomik olarak tüket
    let rawMaterialCostTotal = 0;
    let inputQualitySum = 0;
    for (const inp of recipe.inputs) {
      const neededQty = Math.ceil(maxPossibleByInputs * inp.quantityPerUnit);
      const consumed = TradeInventory.consumeFromInventoryBatches(
        rawWh.batches,
        inp.resourceId,
        neededQty
      );
      rawMaterialCostTotal += consumed.totalCostBasis;
      inputQualitySum += consumed.averageQuality;
    }
    rawWh.usedCapacityUnits = rawWh.batches.reduce(
      (s, b) => s + b.quantity,
      0
    );

    const avgInputQuality = inputQualitySum / Math.max(1, recipe.inputs.length);
    const wastedUnits =
      maxPossibleByInputs >= 10
        ? Math.floor((maxPossibleByInputs * recipe.wasteRatePct) / 100)
        : 0;
    const actualProducedUnits = Math.max(1, maxPossibleByInputs - wastedUnits);

    const energyCostTotal = Number(
      (maxPossibleByInputs * recipe.energyCostPerBatch).toFixed(2)
    );
    const laborCostTotal = Number(
      (maxPossibleByInputs * recipe.workerCountRequired * 18).toFixed(2)
    );
    const operatingCashCost = Number(
      (energyCostTotal + laborCostTotal).toFixed(2)
    );

    // Enerji + işçilik giderini şirket veya oyuncu kasasından düş, mamul değerine ekle
    if (state.playerCompany) {
      const pc = state.playerCompany;
      const cashPaid = Math.min(pc.financials.cash, operatingCashCost);
      CompanyWallet.spend(pc, cashPaid);
      pc.capitalCash = pc.financials.cash;
      pc.financials.inventory = Number(
        (pc.financials.inventory + cashPaid).toFixed(2)
      );
      pc.financials.totalAssets = Number(
        (
          pc.financials.cash +
          pc.financials.inventory +
          pc.financials.receivables +
          pc.financials.fixedAssets
        ).toFixed(2)
      );
    } else {
      const cashPaid = Math.min(state.cash, operatingCashCost);
      WalletEngine.spend(state, cashPaid);
    }

    const totalProductionCost = Number(
      (rawMaterialCostTotal + operatingCashCost).toFixed(2)
    );
    const unitProductionCost = Number(
      (totalProductionCost / actualProducedUnits).toFixed(2)
    );
    const techMult = state.playerCompany?.techQualityMultiplier ?? 1.0;
    const outputQualityScore = Number(
      Math.min(
        99,
        avgInputQuality * recipe.qualityMultiplierEffect * (1 + (techMult - 1) * 0.08)
      ).toFixed(1)
    );

    // Mamul veya ara ürün deposuna ekle
    const targetWh =
      outputResDef.category === 'INTERMEDIATE_GOOD' ? rawWh : finWh;
    TradeInventory.addBatchToInventoryList(ts, targetWh.batches, {
      resourceId: outputResDef.id,
      resourceNameTR: outputResDef.nameTR,
      category: outputResDef.category,
      quantity: actualProducedUnits,
      unitCost: unitProductionCost,
      qualityScore: outputQualityScore,
      receivedDay: state.day,
      spoilageRateDaily: outputResDef.spoilageRateDaily,
    });
    targetWh.usedCapacityUnits = targetWh.batches.reduce(
      (s, b) => s + b.quantity,
      0
    );

    const prodOrder: ProductionOrder = {
      productionOrderId: prodId,
      recipeId: recipe.recipeId,
      recipeNameTR: recipe.nameTR,
      outputResourceId: outputResDef.id,
      outputResourceNameTR: outputResDef.nameTR,
      requestedUnits: requested,
      actualProducedUnits,
      wastedUnits,
      rawMaterialCostTotal: Number(rawMaterialCostTotal.toFixed(2)),
      laborCostTotal,
      energyCostTotal,
      totalProductionCost,
      unitProductionCost,
      outputQualityScore,
      createdDay: state.day,
      status:
        maxPossibleByInputs < requested ? 'PARTIAL_BOTTLENECK' : 'COMPLETED',
      bottleneckReasonTR,
    };

    ts.productionOrders.unshift(prodOrder);
    ts.todaySummary.productionUnits += actualProducedUnits;
    ts.todaySummary.productionCost = Number(
      (ts.todaySummary.productionCost + totalProductionCost).toFixed(2)
    );

    return {
      success: true,
      message: `${recipe.nameTR}: ${actualProducedUnits} ${outputResDef.unitLabel} ${outputResDef.nameTR} üretildi (Birim Maliyet: ₺${unitProductionCost.toLocaleString('tr-TR')}, Kalite: ${outputQualityScore}).`,
      productionOrder: prodOrder,
    };
  }

  // ============================================================================
  // 9. LOJİSTİK FİLOSU VE DEPO -> DÜKKÂN / KURUMSAL MÜŞTERİ SEVKİYATI
  // ============================================================================

  public static purchaseLogisticsVehicle(
    state: SimulationState,
    vehicleType: LogisticsVehicleType,
    reservedOrderCash: number
  ): {
    success: boolean;
    message: string;
    vehicle: LogisticsVehicle | null;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const spec = VEHICLE_CATALOG[vehicleType];
    if (!spec) {
      return {
        success: false,
        message: 'Geçersiz araç tipi.',
        vehicle: null,
      };
    }

    if (state.playerCompany) {
      const pc = state.playerCompany;
      if (pc.financials.cash < spec.purchaseCost) {
        return {
          success: false,
          message: `${spec.nameTR} alımı için gereken ₺${spec.purchaseCost.toLocaleString('tr-TR')} şirket kasasında yok.`,
          vehicle: null,
        };
      }
      CompanyWallet.spend(pc, spec.purchaseCost);
      pc.capitalCash = pc.financials.cash;
      pc.financials.fixedAssets = Number(
        (pc.financials.fixedAssets + spec.purchaseCost).toFixed(2)
      );
      pc.financials.totalAssets = Number(
        (
          pc.financials.cash +
          pc.financials.inventory +
          pc.financials.receivables +
          pc.financials.fixedAssets
        ).toFixed(2)
      );
    } else {
      const spendable = Math.max(0, state.cash - reservedOrderCash);
      if (spendable < spec.purchaseCost) {
        return {
          success: false,
          message: `${spec.nameTR} alımı için gereken ₺${spec.purchaseCost.toLocaleString('tr-TR')} kullanılabilir nakitte yok.`,
          vehicle: null,
        };
      }
      WalletEngine.spend(state, spec.purchaseCost);
    }

    ts.vehicleSeq += 1;
    const vehicle: LogisticsVehicle = {
      vehicleId: `VEH-${vehicleType}-${String(ts.vehicleSeq).padStart(3, '0')}`,
      nameTR: `${spec.nameTR} #${ts.vehicleSeq}`,
      vehicleType,
      capacityUnits: spec.capacityUnits,
      speedMultiplier: spec.speedMultiplier,
      purchaseCost: spec.purchaseCost,
      dailyMaintenanceCost: spec.dailyMaintenanceCost,
      fuelCostPerTrip: spec.fuelCostPerTrip,
      driverDailyWage: spec.driverDailyWage,
      conditionPct: 100,
      status: 'IDLE',
      assignedShipmentId: null,
    };

    ts.vehicles.push(vehicle);
    ts.logisticsMode = 'OWN_FLEET';

    return {
      success: true,
      message: `${vehicle.nameTR} filoya katıldı (Kapasite: ${vehicle.capacityUnits} birim).`,
      vehicle,
    };
  }

  /**
   * Merkez Depodan (`WH_FIN_MAIN` veya `WH_DIST_MAIN`) bir Dükkâna (`SHOP`) ürün sevk eder.
   */
  public static dispatchWarehouseToShopShipment(
    state: SimulationState,
    params: {
      warehouseId: string;
      shopId: string;
      resourceId: string;
      quantity: number;
    }
  ): {
    success: boolean;
    message: string;
    shipment: Shipment | null;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const wh = ts.warehouses.find((w) => w.warehouseId === params.warehouseId);
    const shop = ts.shops.find((s) => s.shopId === params.shopId);
    const resDef = RESOURCE_CATALOG[params.resourceId];

    if (!wh || !shop || !resDef) {
      return {
        success: false,
        message: 'Depo, dükkân veya ürün bulunamadı.',
        shipment: null,
      };
    }

    const availInWh = TradeInventory.getAvailableResourceUnits(
      wh.batches,
      params.resourceId
    );
    const qty = Math.min(Math.floor(params.quantity), availInWh);
    if (qty <= 0) {
      return {
        success: false,
        message: `${wh.nameTR} içinde sevk edilebilir ${resDef.nameTR} stoğu bulunmuyor.`,
        shipment: null,
      };
    }

    const currentShopStock = shop.inventoryBatches.reduce(
      (s, b) => s + b.quantity,
      0
    );
    const maxShopCap = shop.shelfCapacity + shop.backroomCapacity;
    const shopFree = Math.max(0, maxShopCap - currentShopStock);
    const finalQty = Math.min(qty, shopFree);

    if (finalQty <= 0) {
      return {
        success: false,
        message: `${shop.nameTR} raf ve arka deposu tamamen dolu.`,
        shipment: null,
      };
    }

    const consumed = TradeInventory.consumeFromInventoryBatches(
      wh.batches,
      params.resourceId,
      finalQty
    );
    wh.usedCapacityUnits = wh.batches.reduce((s, b) => s + b.quantity, 0);

    // Kendi filomuzda boş araç var mı?
    const idleVehicle = ts.vehicles.find((v) => v.status === 'IDLE');
    const logisticsMode: LogisticsMode = idleVehicle
      ? 'OWN_FLEET'
      : 'EXTERNAL_LOGISTICS';
    const shippingCost = idleVehicle
      ? idleVehicle.fuelCostPerTrip
      : Number((finalQty * 4.5).toFixed(2));

    // Şehir içi aynı gün veya ertesi gün teslimat
    ts.shipmentSeq += 1;
    const shipmentId = `SHP-INT-D${state.day}-S${String(ts.shipmentSeq).padStart(6, '0')}`;

    // İç sevkiyatta aynı şehir içindeyse hemen mağaza rafına ulaştır
    TradeInventory.addBatchToInventoryList(ts, shop.inventoryBatches, {
      resourceId: resDef.id,
      resourceNameTR: resDef.nameTR,
      category: resDef.category,
      quantity: consumed.consumedUnits,
      unitCost: consumed.averageUnitCost,
      qualityScore: consumed.averageQuality,
      receivedDay: state.day,
      spoilageRateDaily: resDef.spoilageRateDaily,
    });

    const shipment: Shipment = {
      shipmentId,
      sourceType: 'WAREHOUSE',
      sourceId: wh.warehouseId,
      sourceNameTR: wh.nameTR,
      destinationType: 'SHOP',
      destinationId: shop.shopId,
      destinationNameTR: shop.nameTR,
      resourceId: resDef.id,
      resourceNameTR: resDef.nameTR,
      quantity: consumed.consumedUnits,
      deliveredQuantity: consumed.consumedUnits,
      damagedQuantity: 0,
      unitCostBasis: consumed.averageUnitCost,
      qualityScore: consumed.averageQuality,
      logisticsMode,
      vehicleId: idleVehicle?.vehicleId ?? null,
      shippingCost,
      dispatchedDay: state.day,
      estimatedArrivalDay: state.day,
      actualArrivalDay: state.day,
      status: 'DELIVERED',
    };

    ts.deliveredShipmentIds.push(shipmentId);
    ts.shipments.unshift(shipment);

    return {
      success: true,
      message: `${wh.nameTR} -> ${shop.nameTR}: ${consumed.consumedUnits} ${resDef.unitLabel} ${resDef.nameTR} (${logisticsMode === 'OWN_FLEET' ? 'Kendi Filomuz' : 'Dış Lojistik'}) ile mağaza raflarına sevk edildi.`,
      shipment,
    };
  }

  // ============================================================================
  // 10. KURUMSAL SÖZLEŞME KABULÜ VE TESLİMATI (`acceptCommercialContract` & `deliverToCommercialContract`)
  // ============================================================================

  public static acceptCommercialContract(
    state: SimulationState,
    contractId: string
  ): {
    success: boolean;
    message: string;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const contract = ts.commercialContracts.find(
      (c) => c.contractId === contractId
    );
    if (!contract || contract.status !== 'OFFERED') {
      return {
        success: false,
        message: 'Kabul edilecek kurumsal sözleşme teklifi bulunamadı.',
      };
    }

    contract.status = 'ACTIVE';
    contract.startDay = state.day;
    contract.dueDay = state.day + 12;

    return {
      success: true,
      message: `${contract.buyerNameTR} ile ${contract.totalRequiredUnits} birim ${contract.resourceNameTR} kurumsal satış sözleşmesi imzalandı (Vade: Gün ${contract.dueDay}).`,
    };
  }

  public static deliverToCommercialContract(
    state: SimulationState,
    contractId: string,
    unitsToDeliver?: number
  ): {
    success: boolean;
    message: string;
    deliveredUnits: number;
    revenueBooked: number;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const contract = ts.commercialContracts.find(
      (c) => c.contractId === contractId
    );
    if (!contract || contract.status !== 'ACTIVE') {
      return {
        success: false,
        message: 'Aktif kurumsal sözleşme bulunamadı.',
        deliveredUnits: 0,
        revenueBooked: 0,
      };
    }

    const finWh =
      ts.warehouses.find((w) => w.type === 'FINISHED_GOODS') || ts.warehouses[1];
    const avail = TradeInventory.getAvailableResourceUnits(
      finWh.batches,
      contract.resourceId
    );
    const needed = contract.remainingUnits;
    const requested = Math.min(needed, unitsToDeliver ?? needed, avail);

    if (requested <= 0) {
      return {
        success: false,
        message: `Merkez Mamul Deposunda teslim edilecek ${contract.resourceNameTR} stoğu bulunmuyor.`,
        deliveredUnits: 0,
        revenueBooked: 0,
      };
    }

    const consumed = TradeInventory.consumeFromInventoryBatches(
      finWh.batches,
      contract.resourceId,
      requested
    );
    finWh.usedCapacityUnits = finWh.batches.reduce((s, b) => s + b.quantity, 0);

    const grossRevenue = Number(
      (consumed.consumedUnits * contract.unitSalePrice).toFixed(2)
    );
    contract.deliveredUnits += consumed.consumedUnits;
    contract.remainingUnits = Math.max(
      0,
      contract.totalRequiredUnits - contract.deliveredUnits
    );

    if (contract.remainingUnits === 0) {
      contract.status = 'COMPLETED';
      ts.tradeReputationScore = Math.min(
        100,
        ts.tradeReputationScore + contract.reputationReward
      );
      ts.deliveryPunctualityScore = Math.min(
        100,
        ts.deliveryPunctualityScore + 2
      );
    }

    // Vadeli alacak faturası veya peşin tahsilat
    if (contract.paymentTermDays > 0) {
      ts.invoiceSeq += 1;
      const inv: TradeInvoice = {
        invoiceId: `INV-REC-D${state.day}-S${String(ts.invoiceSeq).padStart(6, '0')}`,
        direction: 'RECEIVABLE',
        counterpartyNameTR: contract.buyerNameTR,
        relatedContractId: contract.contractId,
        issueDay: state.day,
        dueDay: state.day + contract.paymentTermDays,
        totalAmount: grossRevenue,
        paidAmount: 0,
        remainingAmount: grossRevenue,
        lateFeeAccrued: 0,
        status: 'ISSUED',
      };
      ts.invoices.unshift(inv);

      if (state.playerCompany) {
        const pc = state.playerCompany;
        const netGain = Number(
          (grossRevenue - consumed.totalCostBasis).toFixed(2)
        );
        pc.financials.inventory = Number(
          Math.max(0, pc.financials.inventory - consumed.totalCostBasis).toFixed(2)
        );
        pc.financials.receivables = Number(
          (pc.financials.receivables + grossRevenue).toFixed(2)
        );
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
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
        pc.dailyRevenue = Number((pc.dailyRevenue + grossRevenue).toFixed(2));
        pc.dailyEbitda = Number((pc.dailyEbitda + netGain).toFixed(2));
      }
    } else {
      if (state.playerCompany) {
        const pc = state.playerCompany;
        pc.financials.inventory = Number(
          Math.max(0, pc.financials.inventory - consumed.totalCostBasis).toFixed(2)
        );
        CompanyWallet.earn(pc, grossRevenue);
        pc.capitalCash = pc.financials.cash;
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
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
      } else {
        WalletEngine.earn(state, grossRevenue);
      }
    }

    ts.todaySummary.wholesaleAndContractRevenue = Number(
      (ts.todaySummary.wholesaleAndContractRevenue + grossRevenue).toFixed(2)
    );
    ts.todaySummary.wholesaleAndContractCogs = Number(
      (
        ts.todaySummary.wholesaleAndContractCogs + consumed.totalCostBasis
      ).toFixed(2)
    );

    return {
      success: true,
      message: `${contract.buyerNameTR} sözleşmesine ${consumed.consumedUnits} birim ${contract.resourceNameTR} teslim edildi (Tutar: ₺${grossRevenue.toLocaleString('tr-TR')}).`,
      deliveredUnits: consumed.consumedUnits,
      revenueBooked: grossRevenue,
    };
  }

  // ============================================================================
  // 11. ESNAFTAN ŞİRKETE GEÇİŞ (ŞİRKETLEŞME - INCORPORATION)
  // ============================================================================
}
