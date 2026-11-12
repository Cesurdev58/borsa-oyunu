/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TİCARET BÜTÜNLÜK DENETİMİ
 * (TradeAndShopEngine dosyasından ayrıldı; dış dünya hâlâ TradeAndShopEngine.* üzerinden erişebilir.)
 */

import {
  SimulationState,
} from '../models/simulation';
import {
  TradeIntegrityAuditReport,
} from '../models/trade';

import {
  TradeUniverse,
} from './TradeUniverse';

export class TradeAudit {
  public static runTradeIntegrityAudit(
    state: SimulationState
  ): TradeIntegrityAuditReport {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const errors: string[] = [];
    let negativeStockBatchesCount = 0;
    let exceededWarehouseCount = 0;
    let duplicateOrderCount = 0;
    let duplicateShipmentDeliveryCount = 0;
    let imaginarySalesCount = 0;

    // 1. Depo kapasitesi ve negatif parti kontrolü
    for (const wh of ts.warehouses) {
      let sumQty = 0;
      for (const b of wh.batches) {
        if (
          b.quantity < 0 ||
          b.availableQuantity < 0 ||
          !Number.isFinite(b.quantity) ||
          !Number.isFinite(b.unitCost)
        ) {
          negativeStockBatchesCount += 1;
          errors.push(`Depo (${wh.nameTR}) negatif veya geçersiz parti: ${b.batchId}`);
        }
        sumQty += b.quantity;
      }
      wh.usedCapacityUnits = sumQty;
      if (sumQty > wh.maxCapacityUnits + 0.01) {
        exceededWarehouseCount += 1;
        errors.push(
          `Depo (${wh.nameTR}) kapasite aşımı: ${sumQty} > ${wh.maxCapacityUnits}`
        );
      }
    }

    // 2. Dükkân stok partileri kontrolü
    for (const shop of ts.shops) {
      let sumShopQty = 0;
      for (const b of shop.inventoryBatches) {
        if (
          b.quantity < 0 ||
          b.availableQuantity < 0 ||
          !Number.isFinite(b.quantity)
        ) {
          negativeStockBatchesCount += 1;
          errors.push(`Dükkân (${shop.nameTR}) negatif parti: ${b.batchId}`);
        }
        sumShopQty += b.quantity;
      }
      const maxShopCap = shop.shelfCapacity + shop.backroomCapacity;
      if (sumShopQty > maxShopCap + 0.01) {
        exceededWarehouseCount += 1;
        errors.push(
          `Dükkân (${shop.nameTR}) kapasite aşımı: ${sumShopQty} > ${maxShopCap}`
        );
      }
      if (shop.todayUnitsSold > 0 && shop.todaySalesRevenue <= 0) {
        imaginarySalesCount += 1;
        errors.push(`Dükkân (${shop.nameTR}) tutarsız satış cirosu`);
      }
    }

    // 3. Mükerrer sipariş veya mükerrer teslimat kimliği kontrolü
    const seenOrders = new Set<string>();
    for (const o of ts.procurementOrders) {
      if (seenOrders.has(o.orderId)) {
        duplicateOrderCount += 1;
        errors.push(`Mükerrer satın alma siparişi: ${o.orderId}`);
      }
      seenOrders.add(o.orderId);
    }

    const seenDelivered = new Set<string>();
    for (const shId of ts.deliveredShipmentIds) {
      if (seenDelivered.has(shId)) {
        duplicateShipmentDeliveryCount += 1;
        errors.push(`Mükerrer teslim edilen sevkiyat: ${shId}`);
      }
      seenDelivered.add(shId);
    }

    return {
      valid: errors.length === 0,
      checkedDay: state.day,
      negativeStockBatchesCount,
      exceededWarehouseCount,
      duplicateOrderCount,
      duplicateShipmentDeliveryCount,
      imaginarySalesCount,
      unexplainedCashDelta: 0,
      unexplainedStockDelta: 0,
      errors,
    };
  }
}

function eventDemandMultiplier(val: number): number {
  return Number.isFinite(val) && val > 0 ? val : 1.0;
}
