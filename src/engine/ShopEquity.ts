/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞİRKETLEŞMEMİŞ DÜKKÂN ÖZKAYNAĞI (ShopEquity)
 * Muhasebe, ticaret ve şirket motorlarının ortak ihtiyacı olan bu hesap ayrı bir dosyada durur.
 * Böylece AccountingEngine ↔ TradeAndShopEngine ↔ CompanyEngine bağımlılık döngüsü oluşmaz.
 * Yalnızca model tiplerini içe aktarır; hiçbir motoru çağırmaz.
 */

import { SimulationState } from '../models/simulation';

export class ShopEquity {
  /**
   * Şirketleşmemiş (esnaf aşamasındaki) dükkânların ve bağımsız depoların toplam özkaynak değerini hesaplar:
   * - Dükkân kasası (`cashAccountBalance`)
   * - Dükkân sabit yatırımı (`totalInvestedCapital`)
   * - Dükkân içindeki stokların gerçek maliyet değeri
   * - Yoldaki peşin ödenmiş esnaf siparişlerinin değeri
   * - Eksi: Esnafın ödenmemiş vadeli tedarikçi faturaları
   * Not: Dükkân `isCompanyBranch === true` olduğunda varlıkları şirket bilançosuna dahil edildiği için burada 0 döner (çift sayım önlenir!).
   */
  public static compute(
    state: SimulationState
  ): number {
    const ts = state.tradeState;
    if (!ts) return 0;

    // Eğer oyuncu şirketi kurulmuşsa ve tüm dükkânlar şirket şubesiyse ek esnaf özkaynağı yoktur
    const independentShops = ts.shops.filter((s) => !s.isCompanyBranch);
    if (independentShops.length === 0 && state.playerCompany !== null) {
      return 0;
    }

    let total = 0;
    for (const shop of independentShops) {
      const invVal = shop.inventoryBatches.reduce(
        (sum, b) => sum + b.quantity * b.unitCost,
        0
      );
      total += shop.cashAccountBalance + shop.totalInvestedCapital + invVal;
    }

    // Eğer henüz şirket kurulmamışsa fakat bağımsız depolarda veya yolda peşin ödenmiş esnaf malı varsa onları da ekle
    if (!state.playerCompany) {
      for (const wh of ts.warehouses) {
        for (const b of wh.batches) {
          total += b.quantity * b.unitCost;
        }
      }
      for (const v of ts.vehicles) {
        total += v.purchaseCost;
      }
      for (const ord of ts.procurementOrders) {
        if (
          ord.status === 'PREPARING' ||
          ord.status === 'IN_TRANSIT' ||
          ord.status === 'DELAYED' ||
          ord.status === 'APPROVED'
        ) {
          // Yoldaki malın peşin ödenmiş kısmı varlık olarak korunur
          total += ord.paidAmount;
        }
      }
      for (const inv of ts.invoices) {
        if (inv.status !== 'PAID' && inv.status !== 'CANCELLED') {
          if (inv.direction === 'RECEIVABLE') {
            total += inv.remainingAmount;
          } else if (inv.direction === 'PAYABLE') {
            total -= inv.remainingAmount;
          }
        }
      }
    } else {
      // Şirket kurulmuş olsa bile bağımsız esnaf dükkânına giden yoldaki peşin siparişleri koru
      const independentShopIds = new Set(independentShops.map((s) => s.shopId));
      for (const ord of ts.procurementOrders) {
        if (
          ord.targetDestinationType === 'SHOP' &&
          independentShopIds.has(ord.targetDestinationId) &&
          (ord.status === 'PREPARING' ||
            ord.status === 'IN_TRANSIT' ||
            ord.status === 'DELAYED' ||
            ord.status === 'APPROVED')
        ) {
          total += ord.paidAmount;
        }
      }
    }

    return Number(Math.max(0, total).toFixed(2));
  }
}
