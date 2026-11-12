/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * STOK PARTİLERİ: parti ekleme, tüketme ve mevcut miktar hesabı
 * (TradeAndShopEngine dosyasından ayrıldı; dış dünya hâlâ TradeAndShopEngine.* üzerinden erişebilir.)
 */

import {
  InventoryBatch,
  ResourceDefinition,
  TradeUniverseState,
} from '../models/trade';


export class TradeInventory {
  /**
   * Bir stok listesine (Depo veya Dükkân) yeni mal partisini (InventoryBatch) ekler
   * veya aynı ürün ve yakın maliyetli partiyi ağırlıklı ortalama maliyetle birleştirir.
   */
  public static addBatchToInventoryList(
    ts: TradeUniverseState,
    batches: InventoryBatch[],
    params: {
      resourceId: string;
      resourceNameTR: string;
      category: ResourceDefinition['category'];
      quantity: number;
      unitCost: number;
      qualityScore: number;
      receivedDay: number;
      spoilageRateDaily: number;
      sourceOrderId?: string;
    }
  ): void {
    if (params.quantity <= 0) return;

    const existing = batches.find(
      (b) => b.resourceId === params.resourceId && b.reservedQuantity === 0
    );
    if (existing) {
      const totalQty = existing.quantity + params.quantity;
      const weightedCost =
        (existing.quantity * existing.unitCost +
          params.quantity * params.unitCost) /
        totalQty;
      const weightedQuality =
        (existing.quantity * existing.qualityScore +
          params.quantity * params.qualityScore) /
        totalQty;
      existing.quantity = totalQty;
      existing.availableQuantity = Math.max(
        0,
        totalQty - existing.reservedQuantity
      );
      existing.unitCost = Number(weightedCost.toFixed(2));
      existing.totalValue = Number((totalQty * existing.unitCost).toFixed(2));
      existing.qualityScore = Number(weightedQuality.toFixed(1));
      return;
    }

    ts.batchSeq += 1;
    const expirationDay =
      params.spoilageRateDaily >= 0.03
        ? params.receivedDay + Math.max(4, Math.round(1 / params.spoilageRateDaily))
        : null;

    batches.push({
      batchId: `BATCH-D${params.receivedDay}-S${String(ts.batchSeq).padStart(6, '0')}`,
      resourceId: params.resourceId,
      resourceNameTR: params.resourceNameTR,
      category: params.category,
      quantity: params.quantity,
      reservedQuantity: 0,
      availableQuantity: params.quantity,
      unitCost: Number(params.unitCost.toFixed(2)),
      totalValue: Number((params.quantity * params.unitCost).toFixed(2)),
      qualityScore: Number(params.qualityScore.toFixed(1)),
      receivedDay: params.receivedDay,
      expirationDay,
      sourceOrderId: params.sourceOrderId,
    });
  }

  /**
   * Stok listesinden FIFO sırasıyla mal tüketir ve gerçek birim maliyeti (COGS) hesaplar.
   * Negatif stok oluşmasını kesin olarak engeller (`actualConsumed <= available`).
   */
  public static consumeFromInventoryBatches(
    batches: InventoryBatch[],
    resourceId: string,
    requestedUnits: number
  ): {
    consumedUnits: number;
    totalCostBasis: number;
    averageUnitCost: number;
    averageQuality: number;
  } {
    let remainingToConsume = Math.max(0, Math.floor(requestedUnits));
    let consumedUnits = 0;
    let totalCostBasis = 0;
    let weightedQualitySum = 0;

    for (const batch of batches) {
      if (remainingToConsume <= 0) break;
      if (batch.resourceId !== resourceId || batch.availableQuantity <= 0) {
        continue;
      }

      const take = Math.min(batch.availableQuantity, remainingToConsume);
      batch.quantity -= take;
      batch.availableQuantity = Math.max(
        0,
        batch.quantity - batch.reservedQuantity
      );
      batch.totalValue = Number((batch.quantity * batch.unitCost).toFixed(2));

      remainingToConsume -= take;
      consumedUnits += take;
      totalCostBasis += take * batch.unitCost;
      weightedQualitySum += take * batch.qualityScore;
    }

    // Miktarı 0 olan partileri temizle
    for (let i = batches.length - 1; i >= 0; i--) {
      if (batches[i].quantity <= 0) {
        batches.splice(i, 1);
      }
    }

    const cleanTotalCost = Number(totalCostBasis.toFixed(2));
    const averageUnitCost =
      consumedUnits > 0
        ? Number((cleanTotalCost / consumedUnits).toFixed(2))
        : 0;
    const averageQuality =
      consumedUnits > 0
        ? Number((weightedQualitySum / consumedUnits).toFixed(1))
        : 80;

    return {
      consumedUnits,
      totalCostBasis: cleanTotalCost,
      averageUnitCost,
      averageQuality,
    };
  }

  public static getAvailableResourceUnits(
    batches: InventoryBatch[],
    resourceId: string
  ): number {
    return batches
      .filter((b) => b.resourceId === resourceId)
      .reduce((sum, b) => sum + b.availableQuantity, 0);
  }

  // ============================================================================
  // 8. GERÇEK REÇETELİ ÜRETİM ZİNCİRİ (`executeRecipeProduction`)
  // ============================================================================
}
