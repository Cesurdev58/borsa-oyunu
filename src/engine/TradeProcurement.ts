/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TEDARİK: tedarikçi teklifleri, sipariş, sözleşme ve sevkiyat ilerletme
 * (TradeAndShopEngine dosyasından ayrıldı; dış dünya hâlâ TradeAndShopEngine.* üzerinden erişebilir.)
 */

import {
  SimulationState,
} from '../models/simulation';
import {
  ProcurementOrder,
  PurchaseContract,
  Shipment,
  SupplierOffer,
  TradeInvoice,
} from '../models/trade';
import {
  WalletEngine,
} from './WalletEngine';
import {
  RandomEngine,
} from './RandomEngine';

import {
  RESOURCE_CATALOG,
} from '../data/tradeCatalog';
import {
  TradeInventory,
} from './TradeInventory';
import {
  TradeUniverse,
} from './TradeUniverse';
import { CompanyWallet } from './CompanyWallet';

export class TradeProcurement {
  /**
   * Mevcut oyun günü ve aktif piyasa/ticaret olaylarına göre tedarikçi tekliflerini (`SupplierOffer`) üretir.
   */
  public static getSupplierOffers(
    state: SimulationState,
    filterResourceId?: string
  ): SupplierOffer[] {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const offers: SupplierOffer[] = [];

    for (const sup of ts.suppliers) {
      for (const resId of sup.suppliedResourceIds) {
        if (filterResourceId && resId !== filterResourceId) continue;
        const resDef = RESOURCE_CATALOG[resId];
        if (!resDef) continue;

        let eventPriceMult = 1.0;
        let eventDelayAdd = 0;
        for (const ev of ts.activeTradeEvents) {
          if (
            ev.isActive &&
            (ev.affectedSector === 'ALL' ||
              ev.affectedSector === resDef.sector ||
              ev.affectedResourceId === resId)
          ) {
            eventPriceMult *= ev.priceImpactMultiplier;
            eventDelayAdd += ev.delayDaysAdded;
          }
        }

        const unitPrice = Number(
          (
            resDef.baseMarketPrice *
            sup.basePriceMultiplier *
            eventPriceMult
          ).toFixed(2)
        );
        const shippingCostPerUnit = Number(
          Math.max(
            2,
            resDef.unitWeightKg * 0.65 * (sup.deliverySpeedDays === 1 ? 1.1 : 0.9)
          ).toFixed(2)
        );

        offers.push({
          offerId: `OFFER-${sup.supplierId}-${resId}`,
          supplierId: sup.supplierId,
          supplierNameTR: sup.nameTR,
          resourceId: resId,
          resourceNameTR: resDef.nameTR,
          unitPrice,
          minOrderQuantity: resDef.minOrderQty,
          maxAvailableQuantity: sup.maxDailyCapacity,
          deliveryDays: Math.max(1, sup.deliverySpeedDays + eventDelayAdd),
          shippingCostPerUnit,
          qualityScore: sup.qualityScore,
          reliabilityScore: sup.reliabilityScore,
          paymentTermDays: sup.paymentTermDaysAllowed,
        });
      }
    }

    return offers;
  }

  /**
   * Tedarikçiden Hammadde, Ara Ürün veya Ticari Mal Siparişi Oluşturur (`placeProcurementOrder`):
   * - Sipariş verildiği anda stok ANINDA ARTMAZ!
   * - `Shipment` nesnesi `IN_TRANSIT` olarak oluşturulur ve teslimat gününde (`estimatedArrivalDay`) depoya/dükkâna girer.
   * - `idempotencyKey` ile aynı siparişin iki kez işlenmesi kesin olarak engellenir.
   * - Hedef depo veya dükkân arka deposunda yeterli boş kapasite yoksa siparişi reddeder.
   */
  public static placeProcurementOrder(
    state: SimulationState,
    params: {
      supplierId: string;
      resourceId: string;
      quantity: number;
      targetDestinationType: 'WAREHOUSE' | 'SHOP';
      targetDestinationId: string;
      paymentMethod?: 'CASH' | 'CREDIT';
      idempotencyKey?: string;
      reservedOrderCash: number;
      lockedUnitPriceOverride?: number;
    }
  ): {
    success: boolean;
    message: string;
    order: ProcurementOrder | null;
    shipment: Shipment | null;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const supplier = ts.suppliers.find(
      (s) => s.supplierId === params.supplierId
    );
    const resDef = RESOURCE_CATALOG[params.resourceId];

    if (!supplier || !resDef) {
      return {
        success: false,
        message: 'Geçersiz tedarikçi veya ürün seçimi.',
        order: null,
        shipment: null,
      };
    }

    if (!supplier.suppliedResourceIds.includes(params.resourceId)) {
      return {
        success: false,
        message: `${supplier.nameTR} bu ürünü (${resDef.nameTR}) tedarik etmiyor.`,
        order: null,
        shipment: null,
      };
    }

    const qty = Math.floor(params.quantity);
    if (!Number.isFinite(qty) || qty < resDef.minOrderQty) {
      return {
        success: false,
        message: `${resDef.nameTR} için minimum sipariş miktarı ${resDef.minOrderQty} ${resDef.unitLabel} olmalıdır.`,
        order: null,
        shipment: null,
      };
    }

    if (qty > supplier.maxDailyCapacity) {
      return {
        success: false,
        message: `${supplier.nameTR} günlük maksimum ${supplier.maxDailyCapacity} ${resDef.unitLabel} tedarik edebilir.`,
        order: null,
        shipment: null,
      };
    }

    const idemKey =
      params.idempotencyKey?.trim() ||
      `PROC-D${state.day}-M${state.totalElapsedGameMinutes}-S${ts.orderSeq + 1}`;
    if (ts.processedOrderIds.includes(idemKey)) {
      return {
        success: false,
        message: `Mükerrer satın alma siparişi engellendi (${idemKey}).`,
        order: null,
        shipment: null,
      };
    }

    // Hedef depo veya dükkân kapasite kontrolü (mevcut stok + yoldaki teslimatlar <= maxCapacity)
    let destNameTR = '';
    let freeSpace = 0;

    if (params.targetDestinationType === 'WAREHOUSE') {
      const wh = ts.warehouses.find(
        (w) => w.warehouseId === params.targetDestinationId
      );
      if (!wh) {
        return {
          success: false,
          message: 'Hedef depo bulunamadı.',
          order: null,
          shipment: null,
        };
      }
      destNameTR = wh.nameTR;
      const incomingToWh = ts.shipments
        .filter(
          (sh) =>
            sh.destinationType === 'WAREHOUSE' &&
            sh.destinationId === wh.warehouseId &&
            (sh.status === 'IN_TRANSIT' ||
              sh.status === 'LOADING' ||
              sh.status === 'DELAYED')
        )
        .reduce((s, sh) => s + sh.quantity, 0);
      freeSpace = Math.max(
        0,
        wh.maxCapacityUnits - wh.usedCapacityUnits - incomingToWh
      );
    } else {
      const shop = ts.shops.find(
        (s) => s.shopId === params.targetDestinationId
      );
      if (!shop) {
        return {
          success: false,
          message: 'Hedef dükkân bulunamadı.',
          order: null,
          shipment: null,
        };
      }
      destNameTR = shop.nameTR;
      const currentShopStock = shop.inventoryBatches.reduce(
        (s, b) => s + b.quantity,
        0
      );
      const incomingToShop = ts.shipments
        .filter(
          (sh) =>
            sh.destinationType === 'SHOP' &&
            sh.destinationId === shop.shopId &&
            (sh.status === 'IN_TRANSIT' ||
              sh.status === 'LOADING' ||
              sh.status === 'DELAYED')
        )
        .reduce((s, sh) => s + sh.quantity, 0);
      const totalCap = shop.shelfCapacity + shop.backroomCapacity;
      freeSpace = Math.max(0, totalCap - currentShopStock - incomingToShop);
    }

    if (qty > freeSpace) {
      return {
        success: false,
        message: `${destNameTR} içinde yeterli boş depolama alanı yok (İstenen: ${qty}, Boş Kapasite: ${freeSpace}).`,
        order: null,
        shipment: null,
      };
    }

    // Birim fiyat, toplu alım indirimi ve nakliye hesabı
    const offers = TradeProcurement.getSupplierOffers(state, params.resourceId);
    const matchedOffer = offers.find((o) => o.supplierId === supplier.supplierId);
    let baseUnitPrice =
      params.lockedUnitPriceOverride ??
      matchedOffer?.unitPrice ??
      Number((resDef.baseMarketPrice * supplier.basePriceMultiplier).toFixed(2));

    if (
      !params.lockedUnitPriceOverride &&
      qty >= supplier.volumeDiscountThreshold
    ) {
      baseUnitPrice = Number(
        (baseUnitPrice * (1 - supplier.volumeDiscountPct / 100)).toFixed(2)
      );
    }

    const subtotalCost = Number((qty * baseUnitPrice).toFixed(2));
    const shippingPerUnit = matchedOffer?.shippingCostPerUnit ?? 5;
    const shippingCost = Number((qty * shippingPerUnit).toFixed(2));
    const taxAmount = 0; // KDV mahsuplaşması net maliyet bazında izlenir
    const totalCost = Number((subtotalCost + shippingCost + taxAmount).toFixed(2));

    const paymentMethod = params.paymentMethod ?? 'CASH';
    if (paymentMethod === 'CREDIT' && supplier.paymentTermDaysAllowed <= 0) {
      return {
        success: false,
        message: `${supplier.nameTR} yalnızca peşin ödeme kabul etmektedir.`,
        order: null,
        shipment: null,
      };
    }

    // Ödeme veya Borç Kaydı (Tek Sefer!)
    let paidAmount = 0;
    let payableAmount = 0;
    const dueDay =
      paymentMethod === 'CREDIT'
        ? state.day + supplier.paymentTermDaysAllowed
        : state.day;

    const targetShop =
      params.targetDestinationType === 'SHOP'
        ? ts.shops.find((s) => s.shopId === params.targetDestinationId)
        : undefined;
    const useCompanyAccount = Boolean(
      state.playerCompany &&
        (params.targetDestinationType === 'WAREHOUSE' ||
          targetShop?.isCompanyBranch)
    );

    if (paymentMethod === 'CASH') {
      if (useCompanyAccount && state.playerCompany) {
        const pc = state.playerCompany;
        if (pc.financials.cash < totalCost) {
          return {
            success: false,
            message: `Sipariş tutarı (₺${totalCost.toLocaleString('tr-TR')}) şirket kasasında (₺${pc.financials.cash.toLocaleString('tr-TR')}) mevcut değil.`,
            order: null,
            shipment: null,
          };
        }
        // Şirket nakdi azalır, yoldaki stok varlığı (inventory) aynı tutarda artar -> bilanço denkliği korunur!
        CompanyWallet.spend(pc, totalCost);
        pc.capitalCash = pc.financials.cash;
        pc.financials.inventory = Number(
          (pc.financials.inventory + totalCost).toFixed(2)
        );
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
          ).toFixed(2)
        );
      } else if (targetShop && !targetShop.isCompanyBranch) {
        // Bağımsız esnaf dükkânı: önce dükkân kasasından, yetmezse kişisel kullanılabilir nakitten öde
        const shopCash = targetShop.cashAccountBalance;
        const spendablePersonal = Math.max(
          0,
          state.cash - params.reservedOrderCash
        );
        if (shopCash + spendablePersonal < totalCost) {
          return {
            success: false,
            message: `Sipariş tutarı (₺${totalCost.toLocaleString('tr-TR')}) için dükkân kasası (₺${shopCash.toLocaleString('tr-TR')}) ve kişisel nakit (₺${spendablePersonal.toLocaleString('tr-TR')}) yetersiz.`,
            order: null,
            shipment: null,
          };
        }
        const paidFromShop = Math.min(shopCash, totalCost);
        const paidFromPersonal = Number((totalCost - paidFromShop).toFixed(2));
        targetShop.cashAccountBalance = Number(
          (targetShop.cashAccountBalance - paidFromShop).toFixed(2)
        );
        if (paidFromPersonal > 0) {
          WalletEngine.spend(state, paidFromPersonal);
          targetShop.totalInvestedCapital = Number(
            (targetShop.totalInvestedCapital + paidFromPersonal).toFixed(2)
          );
        }
      } else {
        const spendablePersonal = Math.max(
          0,
          state.cash - params.reservedOrderCash
        );
        if (spendablePersonal < totalCost) {
          return {
            success: false,
            message: `Sipariş tutarı (₺${totalCost.toLocaleString('tr-TR')}) kullanılabilir nakdinizi aşıyor.`,
            order: null,
            shipment: null,
          };
        }
        WalletEngine.spend(state, totalCost);
      }
      paidAmount = totalCost;
    } else {
      // Vadeli Alım (CREDIT): Tedarikçi borcu ve fatura oluştur
      payableAmount = totalCost;
      if (useCompanyAccount && state.playerCompany) {
        const pc = state.playerCompany;
        pc.supplierPayableBalance = Number(
          ((pc.supplierPayableBalance ?? 0) + totalCost).toFixed(2)
        );
        pc.financials.inventory = Number(
          (pc.financials.inventory + totalCost).toFixed(2)
        );
        pc.financials.shortTermDebt = Number(
          (pc.financials.shortTermDebt + totalCost).toFixed(2)
        );
        pc.financials.totalLiabilities = Number(
          (pc.financials.shortTermDebt + pc.financials.longTermDebt).toFixed(2)
        );
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
          ).toFixed(2)
        );
      }
    }

    ts.orderSeq += 1;
    ts.shipmentSeq += 1;
    const orderId = `PO-D${state.day}-S${String(ts.orderSeq).padStart(6, '0')}`;
    const shipmentId = `SHP-D${state.day}-S${String(ts.shipmentSeq).padStart(6, '0')}`;
    const deliveryDays = matchedOffer?.deliveryDays ?? supplier.deliverySpeedDays;
    const estimatedArrivalDay = state.day + Math.max(1, deliveryDays);
    const effectiveUnitCost = Number((totalCost / qty).toFixed(2));

    const order: ProcurementOrder = {
      orderId,
      supplierId: supplier.supplierId,
      supplierNameTR: supplier.nameTR,
      resourceId: resDef.id,
      resourceNameTR: resDef.nameTR,
      orderedQuantity: qty,
      deliveredQuantity: 0,
      unitPrice: baseUnitPrice,
      subtotalCost,
      shippingCost,
      taxAmount,
      totalCost,
      qualityScore: supplier.qualityScore,
      paymentMethod,
      paidAmount,
      payableAmount,
      dueDay,
      createdDay: state.day,
      estimatedArrivalDay,
      actualArrivalDay: null,
      targetDestinationType: params.targetDestinationType,
      targetDestinationId: params.targetDestinationId,
      targetDestinationNameTR: destNameTR,
      status: 'IN_TRANSIT',
      shipmentId,
      idempotencyKey: idemKey,
    };

    const shipment: Shipment = {
      shipmentId,
      sourceType: 'SUPPLIER',
      sourceId: supplier.supplierId,
      sourceNameTR: supplier.nameTR,
      destinationType: params.targetDestinationType,
      destinationId: params.targetDestinationId,
      destinationNameTR: destNameTR,
      resourceId: resDef.id,
      resourceNameTR: resDef.nameTR,
      quantity: qty,
      deliveredQuantity: 0,
      damagedQuantity: 0,
      unitCostBasis: effectiveUnitCost,
      qualityScore: supplier.qualityScore,
      logisticsMode: 'EXTERNAL_LOGISTICS',
      vehicleId: null,
      shippingCost,
      dispatchedDay: state.day,
      estimatedArrivalDay,
      actualArrivalDay: null,
      status: 'IN_TRANSIT',
      relatedOrderId: orderId,
    };

    ts.processedOrderIds.push(idemKey);
    ts.procurementOrders.unshift(order);
    ts.shipments.unshift(shipment);
    ts.todaySummary.procurementSpend = Number(
      (ts.todaySummary.procurementSpend + paidAmount).toFixed(2)
    );
    ts.todaySummary.logisticsCost = Number(
      (ts.todaySummary.logisticsCost + shippingCost).toFixed(2)
    );

    if (targetShop) {
      targetShop.pendingDeliveriesCount = ts.shipments.filter(
        (sh) =>
          sh.destinationType === 'SHOP' &&
          sh.destinationId === targetShop.shopId &&
          (sh.status === 'IN_TRANSIT' || sh.status === 'DELAYED')
      ).length;
    }

    if (paymentMethod === 'CREDIT') {
      ts.invoiceSeq += 1;
      const invoice: TradeInvoice = {
        invoiceId: `INV-PAY-D${state.day}-S${String(ts.invoiceSeq).padStart(6, '0')}`,
        direction: 'PAYABLE',
        counterpartyNameTR: supplier.nameTR,
        relatedOrderId: orderId,
        relatedShopId: targetShop?.shopId,
        issueDay: state.day,
        dueDay,
        totalAmount: totalCost,
        paidAmount: 0,
        remainingAmount: totalCost,
        lateFeeAccrued: 0,
        status: 'ISSUED',
      };
      ts.invoices.unshift(invoice);
    }

    return {
      success: true,
      message: `${supplier.nameTR} firmasından ${qty} ${resDef.unitLabel} ${resDef.nameTR} sipariş edildi (Toplam: ₺${totalCost.toLocaleString('tr-TR')}, Tahmini Teslimat: Gün ${estimatedArrivalDay}).`,
      order,
      shipment,
    };
  }

  /**
   * Henüz teslim edilmemiş bir satın alma siparişini iptal eder ve ödemeyi/borcu geri alır.
   */
  public static cancelProcurementOrder(
    state: SimulationState,
    orderId: string
  ): {
    success: boolean;
    message: string;
    refundedAmount: number;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const order = ts.procurementOrders.find((o) => o.orderId === orderId);
    if (!order) {
      return {
        success: false,
        message: 'İptal edilecek sipariş bulunamadı.',
        refundedAmount: 0,
      };
    }

    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      return {
        success: false,
        message: `Bu sipariş (${order.status}) durumunda olduğu için iptal edilemez.`,
        refundedAmount: 0,
      };
    }

    order.status = 'CANCELLED';
    const shipment = ts.shipments.find((s) => s.shipmentId === order.shipmentId);
    if (shipment) {
      shipment.status = 'CANCELLED';
    }

    const targetShop =
      order.targetDestinationType === 'SHOP'
        ? ts.shops.find((s) => s.shopId === order.targetDestinationId)
        : undefined;
    const useCompanyAccount = Boolean(
      state.playerCompany &&
        (order.targetDestinationType === 'WAREHOUSE' ||
          targetShop?.isCompanyBranch)
    );

    let refundedAmount = 0;
    if (order.paymentMethod === 'CASH' && order.paidAmount > 0) {
      refundedAmount = order.paidAmount;
      if (useCompanyAccount && state.playerCompany) {
        const pc = state.playerCompany;
        CompanyWallet.earn(pc, refundedAmount);
        pc.capitalCash = pc.financials.cash;
        pc.financials.inventory = Number(
          Math.max(0, pc.financials.inventory - refundedAmount).toFixed(2)
        );
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
          ).toFixed(2)
        );
      } else if (targetShop && !targetShop.isCompanyBranch) {
        targetShop.cashAccountBalance = Number(
          (targetShop.cashAccountBalance + refundedAmount).toFixed(2)
        );
      } else {
        WalletEngine.earn(state, refundedAmount);
      }
      order.paidAmount = 0;
    } else if (order.paymentMethod === 'CREDIT' && order.payableAmount > 0) {
      const inv = ts.invoices.find(
        (i) => i.relatedOrderId === order.orderId && i.status !== 'PAID'
      );
      if (inv) {
        inv.status = 'CANCELLED';
        inv.remainingAmount = 0;
      }
      if (useCompanyAccount && state.playerCompany) {
        const pc = state.playerCompany;
        pc.supplierPayableBalance = Number(
          Math.max(
            0,
            (pc.supplierPayableBalance ?? 0) - order.payableAmount
          ).toFixed(2)
        );
        pc.financials.inventory = Number(
          Math.max(0, pc.financials.inventory - order.payableAmount).toFixed(2)
        );
        pc.financials.shortTermDebt = Number(
          Math.max(
            0,
            pc.financials.shortTermDebt - order.payableAmount
          ).toFixed(2)
        );
        pc.financials.totalLiabilities = Number(
          (pc.financials.shortTermDebt + pc.financials.longTermDebt).toFixed(2)
        );
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
          ).toFixed(2)
        );
      }
      order.payableAmount = 0;
    }

    if (targetShop) {
      targetShop.pendingDeliveriesCount = ts.shipments.filter(
        (sh) =>
          sh.destinationType === 'SHOP' &&
          sh.destinationId === targetShop.shopId &&
          (sh.status === 'IN_TRANSIT' || sh.status === 'DELAYED')
      ).length;
    }

    return {
      success: true,
      message: `${order.orderId} numaralı sipariş iptal edildi${refundedAmount > 0 ? ` ve ₺${refundedAmount.toLocaleString('tr-TR')} iade alındı` : ''}.`,
      refundedAmount,
    };
  }

  /**
   * Düzenli Tedarik Sözleşmesi (`PurchaseContract`) Oluşturur
   */
  public static createPurchaseContract(
    state: SimulationState,
    params: {
      supplierId: string;
      resourceId: string;
      targetDestinationType: 'WAREHOUSE' | 'SHOP';
      targetDestinationId: string;
      periodDays: number;
      orderQuantityPerTrigger: number;
      autoTriggerMode?: 'PERIODIC' | 'LOW_STOCK_THRESHOLD';
      lowStockThresholdUnits?: number;
      durationDays?: number;
      maxDailySpend?: number;
      minCashReserve?: number;
    }
  ): {
    success: boolean;
    message: string;
    contract: PurchaseContract | null;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const supplier = ts.suppliers.find(
      (s) => s.supplierId === params.supplierId
    );
    const resDef = RESOURCE_CATALOG[params.resourceId];
    if (!supplier || !resDef) {
      return {
        success: false,
        message: 'Geçersiz tedarikçi veya ürün.',
        contract: null,
      };
    }

    const discountPct = Math.min(14, supplier.volumeDiscountPct + 3);
    const lockedUnitPrice = Number(
      (
        resDef.baseMarketPrice *
        supplier.basePriceMultiplier *
        (1 - discountPct / 100)
      ).toFixed(2)
    );
    const duration = Math.max(7, params.durationDays ?? 60);
    const qty = Math.max(resDef.minOrderQty, Math.floor(params.orderQuantityPerTrigger));

    ts.contractSeq += 1;
    const contract: PurchaseContract = {
      contractId: `PC-D${state.day}-S${String(ts.contractSeq).padStart(5, '0')}`,
      supplierId: supplier.supplierId,
      supplierNameTR: supplier.nameTR,
      resourceId: resDef.id,
      resourceNameTR: resDef.nameTR,
      targetDestinationType: params.targetDestinationType,
      targetDestinationId: params.targetDestinationId,
      periodDays: Math.max(1, params.periodDays),
      autoTriggerMode: params.autoTriggerMode ?? 'LOW_STOCK_THRESHOLD',
      lowStockThresholdUnits: Math.max(10, params.lowStockThresholdUnits ?? qty),
      orderQuantityPerTrigger: qty,
      lockedUnitPrice,
      discountPct,
      minCommitmentUnits: qty * 3,
      earlyTerminationPenalty: Number((lockedUnitPrice * qty * 0.25).toFixed(2)),
      safetyLimits: {
        maxDailySpend: params.maxDailySpend ?? 250_000,
        minCashReserve: params.minCashReserve ?? 35_000,
        targetStockDays: 7,
        maxWarehouseFillPct: 85,
      },
      startDay: state.day,
      endDay: state.day + duration,
      lastTriggeredDay: 0,
      totalOrderedUnits: 0,
      isActive: true,
    };

    ts.purchaseContracts.unshift(contract);
    return {
      success: true,
      message: `${supplier.nameTR} ile ${resDef.nameTR} için %${discountPct} indirimli (₺${lockedUnitPrice}/birim) otomatik tedarik sözleşmesi imzalandı.`,
      contract,
    };
  }

  // ============================================================================
  // 7. SEVKİYAT VE TESLİMAT İLERLETMESİ (Çift Teslimat Korumalı)
  // ============================================================================

  public static advanceShipmentsAndDeliveries(
    state: SimulationState,
    rng?: RandomEngine
  ): {
    deliveredCount: number;
    delayedCount: number;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    let deliveredCount = 0;
    let delayedCount = 0;

    for (const sh of ts.shipments) {
      if (sh.status !== 'IN_TRANSIT' && sh.status !== 'DELAYED') continue;
      if (ts.deliveredShipmentIds.includes(sh.shipmentId)) {
        sh.status = 'DELIVERED';
        continue;
      }

      if (state.day < sh.estimatedArrivalDay) {
        continue;
      }

      // Teslimat günü geldi: Gecikme olasılığı henüz uygulanmadıysa kontrol et
      const supplier = ts.suppliers.find((s) => s.supplierId === sh.sourceId);
      const reliability = supplier ? supplier.reliabilityScore : 92;
      const delayRoll = rng ? rng.uniform() : 0.99;
      if (
        sh.status === 'IN_TRANSIT' &&
        reliability < 85 &&
        delayRoll < (85 - reliability) * 0.008
      ) {
        sh.status = 'DELAYED';
        sh.estimatedArrivalDay += 1;
        delayedCount += 1;
        continue;
      }

      // Hasar kontrolü (çok düşük oranlı)
      const damageRoll = rng ? rng.uniform() : 0.99;
      const damagedUnits =
        damageRoll < 0.03 && sh.quantity >= 20
          ? Math.max(1, Math.floor(sh.quantity * 0.02))
          : 0;
      const goodUnits = Math.max(0, sh.quantity - damagedUnits);

      const resDef = RESOURCE_CATALOG[sh.resourceId];
      if (!resDef) continue;

      // Hedefe teslim et
      let actualStored = 0;
      if (sh.destinationType === 'WAREHOUSE') {
        const wh =
          ts.warehouses.find((w) => w.warehouseId === sh.destinationId) ||
          ts.warehouses[0];
        if (wh) {
          const freeSpace = Math.max(
            0,
            wh.maxCapacityUnits - wh.usedCapacityUnits
          );
          actualStored = Math.min(goodUnits, freeSpace);
          if (actualStored > 0) {
            TradeInventory.addBatchToInventoryList(
              ts,
              wh.batches,
              {
                resourceId: resDef.id,
                resourceNameTR: resDef.nameTR,
                category: resDef.category,
                quantity: actualStored,
                unitCost: sh.unitCostBasis,
                qualityScore: sh.qualityScore,
                receivedDay: state.day,
                spoilageRateDaily: resDef.spoilageRateDaily,
                sourceOrderId: sh.relatedOrderId,
              }
            );
            wh.usedCapacityUnits = wh.batches.reduce(
              (s, b) => s + b.quantity,
              0
            );
          }
        }
      } else if (sh.destinationType === 'SHOP') {
        const shop = ts.shops.find((s) => s.shopId === sh.destinationId);
        if (shop) {
          const currentStock = shop.inventoryBatches.reduce(
            (s, b) => s + b.quantity,
            0
          );
          const maxCap = shop.shelfCapacity + shop.backroomCapacity;
          const freeSpace = Math.max(0, maxCap - currentStock);
          actualStored = Math.min(goodUnits, freeSpace);
          if (actualStored > 0) {
            TradeInventory.addBatchToInventoryList(
              ts,
              shop.inventoryBatches,
              {
                resourceId: resDef.id,
                resourceNameTR: resDef.nameTR,
                category: resDef.category,
                quantity: actualStored,
                unitCost: sh.unitCostBasis,
                qualityScore: sh.qualityScore,
                receivedDay: state.day,
                spoilageRateDaily: resDef.spoilageRateDaily,
                sourceOrderId: sh.relatedOrderId,
              }
            );
          }
        }
      } else if (sh.destinationType === 'CORPORATE_CLIENT') {
        actualStored = goodUnits;
      }

      sh.deliveredQuantity = actualStored;
      sh.damagedQuantity = damagedUnits;
      sh.actualArrivalDay = state.day;
      sh.status =
        damagedUnits > 0 && actualStored > 0
          ? 'PARTIALLY_DELIVERED'
          : 'DELIVERED';
      ts.deliveredShipmentIds.push(sh.shipmentId);

      // Eğer kendi filomuzdaki bir araç atandıysa aracı serbest bırak
      if (sh.vehicleId) {
        const veh = ts.vehicles.find((v) => v.vehicleId === sh.vehicleId);
        if (veh) {
          veh.status = 'IDLE';
          veh.assignedShipmentId = null;
          veh.conditionPct = Math.max(40, Number((veh.conditionPct - 0.8).toFixed(1)));
        }
      }

      if (sh.relatedOrderId) {
        const ord = ts.procurementOrders.find(
          (o) => o.orderId === sh.relatedOrderId
        );
        if (ord) {
          ord.deliveredQuantity = actualStored;
          ord.actualArrivalDay = state.day;
          ord.status =
            damagedUnits > 0 ? 'PARTIALLY_DELIVERED' : 'DELIVERED';
        }
      }

      deliveredCount += 1;
    }

    // Dükkânların bekleyen teslimat sayaçlarını güncelle
    for (const shop of ts.shops) {
      shop.pendingDeliveriesCount = ts.shipments.filter(
        (sh) =>
          sh.destinationType === 'SHOP' &&
          sh.destinationId === shop.shopId &&
          (sh.status === 'IN_TRANSIT' || sh.status === 'DELAYED')
      ).length;
    }

    return { deliveredCount, delayedCount };
  }
}
