/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * "Rafları doldur" planlayıcısı: bir dükkânın raflarını en ucuz tedarikçiden,
 * yoldaki siparişleri de sayarak, eldeki bütçeyi aşmadan doldurmak için
 * verilecek siparişlerin listesini üretir. Hiçbir şeyi kendisi değiştirmez.
 * Arayüzdeki tek dokunuşluk düğme ve test ölçüm robotu aynı planı kullanır.
 */
import { SHOP_TEMPLATES, TradeAndShopEngine } from './TradeAndShopEngine';
import type { SimulationState } from '../models/simulation';

const INBOUND_STATUSES = ['PREPARING', 'IN_TRANSIT', 'DELAYED', 'APPROVED'];

/** Raf hedefi: kapasitenin bu kadarı (kalanı tezgâh payı olarak boş kalır). */
const SHELF_FILL_TARGET = 0.9;

export interface PlannedRestockOrder {
  supplierId: string;
  resourceId: string;
  quantity: number;
  estimatedCost: number;
}

export interface ShopRestockPlan {
  orders: PlannedRestockOrder[];
  totalCost: number;
}

export function planShopRestock(
  state: SimulationState,
  shopId: string,
  budget: number
): ShopRestockPlan {
  const ts = state.tradeState;
  const shop = ts?.shops.find((s) => s.shopId === shopId);
  if (!ts || !shop) return { orders: [], totalCost: 0 };

  const tpl = SHOP_TEMPLATES[shop.shopType];
  const perResource = Math.floor(
    (shop.shelfCapacity * SHELF_FILL_TARGET) / tpl.allowedResourceIds.length
  );

  const orders: PlannedRestockOrder[] = [];
  let remaining = budget;

  for (const rid of tpl.allowedResourceIds) {
    const have = shop.inventoryBatches
      .filter((b) => b.resourceId === rid)
      .reduce((sum, b) => sum + b.quantity, 0);
    const inbound = ts.procurementOrders
      .filter(
        (o) =>
          o.targetDestinationId === shop.shopId &&
          o.resourceId === rid &&
          INBOUND_STATUSES.includes(o.status)
      )
      .reduce((sum, o) => sum + Math.max(0, o.orderedQuantity - o.deliveredQuantity), 0);
    const need = perResource - have - inbound;
    if (need < 5) continue;

    const offer = TradeAndShopEngine.getSupplierOffers(state, rid)
      .filter((o) => o.maxAvailableQuantity >= o.minOrderQuantity)
      .sort(
        (a, b) =>
          a.unitPrice + a.shippingCostPerUnit - (b.unitPrice + b.shippingCostPerUnit)
      )[0];
    if (!offer) continue;

    const unit = offer.unitPrice + offer.shippingCostPerUnit;
    const wanted = Math.max(
      offer.minOrderQuantity,
      Math.min(need, offer.maxAvailableQuantity)
    );
    // Bütçe yetmiyorsa sığdığı kadarını al (en az asgari sipariş kadar).
    const affordable = Math.floor(remaining / unit);
    const quantity = Math.min(wanted, affordable);
    if (quantity < offer.minOrderQuantity) continue;

    const estimatedCost = quantity * unit;
    remaining -= estimatedCost;
    orders.push({
      supplierId: offer.supplierId,
      resourceId: rid,
      quantity,
      estimatedCost,
    });
  }

  return {
    orders,
    totalCost: orders.reduce((sum, o) => sum + o.estimatedCost, 0),
  };
}
