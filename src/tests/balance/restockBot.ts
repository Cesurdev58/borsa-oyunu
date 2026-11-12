/**
 * Test ve ölçüm yardımcısı: oyuncu adına dükkân raflarını düzenli sipariş vererek doldurur.
 * Oyuncunun "Rafları doldur" düğmesiyle aynı planı kullanır (engine/ShopRestockPlanner).
 */
import type { SimulationEngine } from '../../engine/SimulationEngine';
import { planShopRestock } from '../../engine/ShopRestockPlanner';

export function restockShops(eng: SimulationEngine): void {
  const ts = eng.getState().tradeState;
  if (!ts) return;
  for (const shop of ts.shops) {
    const budget = eng.getSpendableCash() + shop.cashAccountBalance;
    const plan = planShopRestock(eng.getState(), shop.shopId, budget);
    for (const o of plan.orders) {
      eng.placeProcurementOrder({
        supplierId: o.supplierId,
        resourceId: o.resourceId,
        quantity: o.quantity,
        destinationType: 'SHOP',
        destinationId: shop.shopId,
        paymentTermType: 'CASH',
      });
    }
  }
}
