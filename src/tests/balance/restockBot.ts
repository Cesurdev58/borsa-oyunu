/**
 * Test ve ölçüm yardımcısı: oyuncu adına dükkân raflarını düzenli sipariş vererek doldurur.
 * (Kişisel dükkânlarda otomatik ikmal yoktur; gerçek oyuncu da elle sipariş verir.)
 */
import type { SimulationEngine } from '../../engine/SimulationEngine';
import { SHOP_TEMPLATES } from '../../engine/TradeAndShopEngine';

const INBOUND = ['PREPARING', 'IN_TRANSIT', 'DELAYED', 'APPROVED'];

export function restockShops(eng: SimulationEngine): void {
  const st = eng.getState();
  const ts = st.tradeState;
  if (!ts) return;
  for (const shop of ts.shops) {
    const tpl = SHOP_TEMPLATES[shop.shopType];
    const perResource = Math.floor((shop.shelfCapacity * 0.9) / tpl.allowedResourceIds.length);
    for (const rid of tpl.allowedResourceIds) {
      const have = shop.inventoryBatches
        .filter((b) => b.resourceId === rid)
        .reduce((s, b) => s + b.quantity, 0);
      const inbound = ts.procurementOrders
        .filter((o) => o.targetDestinationId === shop.shopId && o.resourceId === rid && INBOUND.includes(o.status))
        .reduce((s, o) => s + Math.max(0, o.orderedQuantity - o.deliveredQuantity), 0);
      const need = perResource - have - inbound;
      if (need < 5) continue;
      const offers = eng
        .getSupplierOffers(rid)
        .filter((o) => o.maxAvailableQuantity >= o.minOrderQuantity)
        .sort((a, b) => a.unitPrice + a.shippingCostPerUnit - (b.unitPrice + b.shippingCostPerUnit));
      const offer = offers[0];
      if (!offer) continue;
      const qty = Math.max(offer.minOrderQuantity, Math.min(need, offer.maxAvailableQuantity));
      if (qty * (offer.unitPrice + offer.shippingCostPerUnit) > eng.getSpendableCash() + shop.cashAccountBalance) continue;
      eng.placeProcurementOrder({
        supplierId: offer.supplierId,
        resourceId: rid,
        quantity: qty,
        destinationType: 'SHOP',
        destinationId: shop.shopId,
        paymentTermType: 'CASH',
      });
    }
  }
}
