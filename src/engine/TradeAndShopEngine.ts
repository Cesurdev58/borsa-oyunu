/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TİCARET EVRENİ, TEDARİK ZİNCİRİ, DEPO, LOJİSTİK, ESNAF DÜKKÂNLARI VE KARİYER MOTORU (TradeAndShopEngine - v7)
 * - Borsa Yatırımcısı -> İlk Dükkân (Esnaf) -> Çok Şubeli Ticaret -> Şirketleşme -> Fabrika & Dağıtım -> Halka Arz & Holding
 * - Uçtan uca gerçek ticaret zinciri:
 *   Hammadde -> Tedarikçi -> Satın Alma -> Sevkiyat -> Depo -> Üretim -> Mamul Deposu -> Dağıtım -> Mağaza / Kurumsal Müşteri -> Satış -> Tahsilat
 */

import { SHOP_SAME_TYPE_CROWDING } from '../data/gameBalance';
import { MANAGER_PROFIT_SHARE } from '../data/gameBalance';
import {
  SimulationState,
} from '../models/simulation';
import {
  PurchaseContract,
  TradeEvent,
  TradeInvoice,
} from '../models/trade';
import {
  WalletEngine,
} from './WalletEngine';
import {
  ShopEquity,
} from './ShopEquity';
import {
  RandomEngine,
} from './RandomEngine';

import {
  TradeUniverse,
} from './TradeUniverse';
import {
  TradeInventory,
} from './TradeInventory';
import {
  ShopOperations,
} from './ShopOperations';
import {
  TradeProcurement,
} from './TradeProcurement';
import {
  TradeProduction,
} from './TradeProduction';
import {
  ShopIncorporation,
} from './ShopIncorporation';
import {
  TradeAudit,
} from './TradeAudit';
import { finishShopDay } from './ShopSales';
import {
  RESOURCE_CATALOG,
  RECIPE_CATALOG,
  SUPPLIER_CATALOG,
  SHOP_TEMPLATES,
  VEHICLE_CATALOG,
  DEFAULT_ROUTES,
} from '../data/tradeCatalog';

export {
  RESOURCE_CATALOG,
  RECIPE_CATALOG,
  SUPPLIER_CATALOG,
  SHOP_TEMPLATES,
  VEHICLE_CATALOG,
  DEFAULT_ROUTES,
} from '../data/tradeCatalog';
import { CompanyWallet } from './CompanyWallet';

/**
 * Ticaret motoru ön yüzü (facade).
 * Asıl işler alt modüllerde durur: TradeUniverse, TradeInventory, ShopOperations,
 * TradeProcurement, TradeProduction, ShopIncorporation, TradeAudit.
 * Günlük döngü (`stepDailyTradeAndShops`) burada kalır; geri kalan her şey eski adıyla buradan da çağrılabilir.
 */
export class TradeAndShopEngine {
  public static readonly TRADE_SCHEMA_VERSION = TradeUniverse.TRADE_SCHEMA_VERSION;
  public static readonly createInitialTradeUniverseState = TradeUniverse.createInitialTradeUniverseState;
  public static readonly ensureTradeUniverseState = TradeUniverse.ensureTradeUniverseState;
  public static readonly getDefaultProductForSector = TradeUniverse.getDefaultProductForSector;
  public static readonly getDefaultRawMaterialForSector = TradeUniverse.getDefaultRawMaterialForSector;
  public static readonly getDefaultRecipeForSector = TradeUniverse.getDefaultRecipeForSector;
  public static readonly updateCareerStage = TradeUniverse.updateCareerStage;
  public static readonly addBatchToInventoryList = TradeInventory.addBatchToInventoryList;
  public static readonly consumeFromInventoryBatches = TradeInventory.consumeFromInventoryBatches;
  public static readonly getAvailableResourceUnits = TradeInventory.getAvailableResourceUnits;
  public static readonly openShop = ShopOperations.openShop;
  public static readonly upgradeShopLevel = ShopOperations.upgradeShopLevel;
  public static readonly transferBetweenPersonalAndShopCash = ShopOperations.transferBetweenPersonalAndShopCash;
  public static readonly configureShopParameters = ShopOperations.configureShopParameters;
  public static readonly getSupplierOffers = TradeProcurement.getSupplierOffers;
  public static readonly placeProcurementOrder = TradeProcurement.placeProcurementOrder;
  public static readonly cancelProcurementOrder = TradeProcurement.cancelProcurementOrder;
  public static readonly createPurchaseContract = TradeProcurement.createPurchaseContract;
  public static readonly advanceShipmentsAndDeliveries = TradeProcurement.advanceShipmentsAndDeliveries;
  public static readonly executeRecipeProduction = TradeProduction.executeRecipeProduction;
  public static readonly purchaseLogisticsVehicle = TradeProduction.purchaseLogisticsVehicle;
  public static readonly dispatchWarehouseToShopShipment = TradeProduction.dispatchWarehouseToShopShipment;
  public static readonly acceptCommercialContract = TradeProduction.acceptCommercialContract;
  public static readonly deliverToCommercialContract = TradeProduction.deliverToCommercialContract;
  public static readonly MIN_BRANCHES_FOR_INCORPORATION = ShopIncorporation.MIN_BRANCHES_FOR_INCORPORATION;
  public static readonly MIN_STAFF_FOR_INCORPORATION = ShopIncorporation.MIN_STAFF_FOR_INCORPORATION;
  public static readonly MIN_BUSINESS_VALUE_FOR_INCORPORATION = ShopIncorporation.MIN_BUSINESS_VALUE_FOR_INCORPORATION;
  public static readonly MIN_REPUTATION_FOR_INCORPORATION = ShopIncorporation.MIN_REPUTATION_FOR_INCORPORATION;
  public static readonly checkIncorporationEligibility = ShopIncorporation.checkIncorporationEligibility;
  public static readonly incorporateShopsIntoCompany = ShopIncorporation.incorporateShopsIntoCompany;
  public static readonly runTradeIntegrityAudit = TradeAudit.runTradeIntegrityAudit;

  /**
   * Şirketleşmemiş (esnaf aşamasındaki) dükkânların ve bağımsız depoların toplam özkaynak değerini hesaplar:
   * - Dükkân kasası (`cashAccountBalance`)
   * - Dükkân sabit yatırımı (`totalInvestedCapital`)
   * - Dükkân içindeki stokların gerçek maliyet değeri
   * - Yoldaki peşin ödenmiş esnaf siparişlerinin değeri
   * - Eksi: Esnafın ödenmemiş vadeli tedarikçi faturaları
   * Not: Dükkân `isCompanyBranch === true` olduğunda varlıkları şirket bilançosuna dahil edildiği için burada 0 döner (çift sayım önlenir!).
   */
  public static computeNonIncorporatedShopsEquity(
    state: SimulationState
  ): number {
    return ShopEquity.compute(state);
  }

  // ============================================================================
  // 5. ESNAF DÜKKÂNI AÇMA, SEVİYE YÜKSELTME, ÇALIŞAN VE FİYAT YÖNETİMİ
  // ============================================================================

  public static stepDailyTradeAndShops(
    state: SimulationState,
    rng: RandomEngine,
    reservedOrderCash: number
  ): void {
    const ts = TradeUniverse.ensureTradeUniverseState(state);

    // Günlük özet sayaçlarını sıfırla
    ts.todaySummary = {
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
    };

    // 1. Ticari Olayları (TradeEvent) Güncelle
    for (const ev of ts.activeTradeEvents) {
      if (state.day > ev.endDay) {
        ev.isActive = false;
      }
    }
    ts.activeTradeEvents = ts.activeTradeEvents.filter((e) => e.isActive);

    if (state.day % 9 === 0 && ts.activeTradeEvents.length < 2) {
      const evRoll = rng.uniform();
      if (evRoll < 0.35) {
        ts.activeTradeEvents.push({
          eventId: `TEV-D${state.day}`,
          eventType: 'DEMAND_BOOM',
          titleTR: 'Perakende Alışveriş Festivali Başladı',
          descriptionTR:
            'Şehir genelinde mağaza ve dükkânlarda müşteri talebi 4 gün boyunca %18 arttı.',
          affectedSector: 'ALL',
          priceImpactMultiplier: 1.0,
          demandImpactMultiplier: 1.18,
          delayDaysAdded: 0,
          startDay: state.day,
          endDay: state.day + 4,
          isActive: true,
        });
      } else if (evRoll < 0.65) {
        ts.activeTradeEvents.push({
          eventId: `TEV-D${state.day}`,
          eventType: 'RAW_MATERIAL_SURGE',
          titleTR: 'Küresel Hammadde ve Navlun Artışı',
          descriptionTR:
            'İthal hammadde ve elektronik bileşen fiyatlarında geçici %10 artış yaşandı.',
          affectedSector: 'ELEKTRONIK',
          priceImpactMultiplier: 1.1,
          demandImpactMultiplier: 1.0,
          delayDaysAdded: 0,
          startDay: state.day,
          endDay: state.day + 4,
          isActive: true,
        });
      }
    }

    // 2. Yoldaki Sevkiyatları İlerlet ve Varanları Teslim Et
    TradeProcurement.advanceShipmentsAndDeliveries(state, rng);

    // 3. Otomatik Tedarik Sözleşmelerini (`PurchaseContract`) Güvenlik Limitleriyle Çalıştır
    for (const pc of ts.purchaseContracts) {
      if (!pc.isActive) continue;
      if (state.day > pc.endDay) {
        pc.isActive = false;
        continue;
      }

      const daysSinceLast = state.day - pc.lastTriggeredDay;
      if (daysSinceLast < Math.max(1, pc.periodDays)) continue;

      // Güvenlik sınırı kontrolü: Mevcut nakit rezervi ve depo doluluk oranı
      const availableCash = state.playerCompany
        ? state.playerCompany.financials.cash
        : Math.max(0, state.cash - reservedOrderCash);
      const estimatedOrderCost =
        pc.orderQuantityPerTrigger * pc.lockedUnitPrice * 1.08;

      if (
        availableCash - estimatedOrderCost <
        pc.safetyLimits.minCashReserve
      ) {
        continue;
      }
      if (
        ts.todaySummary.procurementSpend + estimatedOrderCost >
        pc.safetyLimits.maxDailySpend
      ) {
        continue;
      }

      // Düşük stok eşiği kontrolü
      if (pc.autoTriggerMode === 'LOW_STOCK_THRESHOLD') {
        let currentStock = 0;
        if (pc.targetDestinationType === 'WAREHOUSE') {
          const wh = ts.warehouses.find(
            (w) => w.warehouseId === pc.targetDestinationId
          );
          if (wh) {
            const fillPct =
              (wh.usedCapacityUnits / Math.max(1, wh.maxCapacityUnits)) * 100;
            if (fillPct >= pc.safetyLimits.maxWarehouseFillPct) continue;
            currentStock = TradeInventory.getAvailableResourceUnits(
              wh.batches,
              pc.resourceId
            );
          }
        } else {
          const shop = ts.shops.find(
            (s) => s.shopId === pc.targetDestinationId
          );
          if (shop) {
            currentStock = TradeInventory.getAvailableResourceUnits(
              shop.inventoryBatches,
              pc.resourceId
            );
          }
        }
        if (currentStock > pc.lowStockThresholdUnits) {
          continue;
        }
      }

      const ordRes = TradeProcurement.placeProcurementOrder(state, {
        supplierId: pc.supplierId,
        resourceId: pc.resourceId,
        quantity: pc.orderQuantityPerTrigger,
        targetDestinationType: pc.targetDestinationType,
        targetDestinationId: pc.targetDestinationId,
        paymentMethod: 'CASH',
        reservedOrderCash,
        lockedUnitPriceOverride: pc.lockedUnitPrice,
        idempotencyKey: `AUTO-PC-${pc.contractId}-D${state.day}`,
      });

      if (ordRes.success) {
        pc.lastTriggeredDay = state.day;
        pc.totalOrderedUnits += pc.orderQuantityPerTrigger;
      }
    }

    // 4. Her Bir Esnaf Dükkânı / Mağaza Şubesi İçin Günlük Operasyon, Fire, Müşteri Talebi ve Gerçek Stoktan Satış
    for (const shop of ts.shops) {
      const tpl = SHOP_TEMPLATES[shop.shopType];
      shop.todayWalkInCustomers = 0;
      shop.todayServedCustomers = 0;
      shop.todayUnmetCustomerDemand = 0;
      shop.todayUnitsSold = 0;
      shop.todaySalesRevenue = 0;
      shop.todayCogs = 0;
      shop.todaySpoilageUnits = 0;
      shop.todaySpoilageCost = 0;

      // 4a. Eğer şirket şubesiyse ve merkez mamul deposunda uygun ürün varsa otomatik raf beslemesi yap
      if (shop.autoReplenishEnabled && state.playerCompany) {
        const finWh = ts.warehouses.find((w) => w.type === 'FINISHED_GOODS');
        if (finWh) {
          for (const resId of tpl.allowedResourceIds) {
            const shopQty = TradeInventory.getAvailableResourceUnits(
              shop.inventoryBatches,
              resId
            );
            if (shopQty < Math.round(shop.shelfCapacity * 0.25)) {
              const whAvail = TradeInventory.getAvailableResourceUnits(
                finWh.batches,
                resId
              );
              if (whAvail > 0) {
                const transferQty = Math.min(
                  whAvail,
                  Math.max(5, Math.round(shop.shelfCapacity * 0.35))
                );
                TradeProduction.dispatchWarehouseToShopShipment(state, {
                  warehouseId: finWh.warehouseId,
                  shopId: shop.shopId,
                  resourceId: resId,
                  quantity: transferQty,
                });
              }
            }
          }
        }
      }

      // 4b. Bozulabilir ürün firesi (özellikle Manav, Kafe, Taze Gıda)
      for (const batch of shop.inventoryBatches) {
        const resDef = RESOURCE_CATALOG[batch.resourceId];
        if (!resDef || resDef.spoilageRateDaily <= 0 || batch.quantity <= 0) {
          continue;
        }
        const effectiveSpoilageRate =
          resDef.spoilageRateDaily *
          (shop.specificState.spoilageRateMultiplier || 1.0);
        const spoiled =
          batch.quantity >= 8
            ? Math.floor(batch.quantity * effectiveSpoilageRate)
            : 0;
        if (spoiled > 0) {
          const actualSpoiled = Math.min(batch.availableQuantity, spoiled);
          batch.quantity -= actualSpoiled;
          batch.availableQuantity = Math.max(
            0,
            batch.quantity - batch.reservedQuantity
          );
          batch.totalValue = Number(
            (batch.quantity * batch.unitCost).toFixed(2)
          );
          const spoilCost = Number(
            (actualSpoiled * batch.unitCost).toFixed(2)
          );
          shop.todaySpoilageUnits += actualSpoiled;
          shop.todaySpoilageCost = Number(
            (shop.todaySpoilageCost + spoilCost).toFixed(2)
          );
        }
      }
      shop.inventoryBatches = shop.inventoryBatches.filter(
        (b) => b.quantity > 0
      );

      // 4c–4d. Satış gün içinde açık saatlere yayılarak yapıldı (ShopSales.stepShopsIntraday);
      // burada günün kalan kısmı tamamlanır ve toplam alınır. Hızlı ilerletmede bütün gün burada satılır.
      const dayTotals = finishShopDay(state, ts, shop, state.day - 1);
      shop.todayWalkInCustomers = dayTotals.walkIn;
      shop.todayServedCustomers = dayTotals.served;
      shop.todayUnmetCustomerDemand = dayTotals.unmet;
      shop.todayUnitsSold = dayTotals.units;
      shop.todaySalesRevenue = dayTotals.revenue;
      shop.todayCogs = dayTotals.cogs;
      if (shop.todayUnitsSold === 0 && shop.todayUnmetCustomerDemand > 0 && shop.inventoryBatches.every((bt) => bt.availableQuantity <= 0)) {
        shop.customerSatisfaction = Number(
          Math.max(35, shop.customerSatisfaction - 1.5).toFixed(1)
        );
      } else if (shop.todayUnmetCustomerDemand === 0 && shop.todayUnitsSold > 0) {
        shop.customerSatisfaction = Number(
          Math.min(98, shop.customerSatisfaction + 0.8).toFixed(1)
        );
      } else if (shop.todayUnmetCustomerDemand > shop.todayUnitsSold) {
        shop.customerSatisfaction = Number(
          Math.max(40, shop.customerSatisfaction - 1.0).toFixed(1)
        );
      }

      // 4e. Günlük kira, personel ve işletme giderleri
      shop.todayPayrollCost = Number(
        (
          shop.staffCount * shop.staffDailyWagePerPerson +
          (shop.manager ? shop.manager.dailyWage : 0)
        ).toFixed(2)
      );
      shop.todayRentAndOpex = Number(
        (shop.dailyRent + shop.level * 120).toFixed(2)
      );
      // Müdür primi: müdürden önceki günlük kârın bir payı (zarar günlerinde prim yok)
      if (shop.manager) {
        const preManagerProfit =
          shop.todaySalesRevenue -
          shop.todayCogs -
          shop.todayPayrollCost -
          shop.todayRentAndOpex -
          shop.todaySpoilageCost;
        const bonus = Math.max(0, preManagerProfit) * MANAGER_PROFIT_SHARE;
        shop.manager.todayBonus = Number(bonus.toFixed(2));
        shop.todayPayrollCost = Number((shop.todayPayrollCost + bonus).toFixed(2));
      }
      const totalDailyExpenses = Number(
        (shop.todayPayrollCost + shop.todayRentAndOpex).toFixed(2)
      );

      shop.todayNetProfit = Number(
        (
          shop.todaySalesRevenue -
          shop.todayCogs -
          totalDailyExpenses -
          shop.todaySpoilageCost
        ).toFixed(2)
      );
      shop.cumulativeRevenue = Number(
        (shop.cumulativeRevenue + shop.todaySalesRevenue).toFixed(2)
      );
      shop.cumulativeNetProfit = Number(
        (shop.cumulativeNetProfit + shop.todayNetProfit).toFixed(2)
      );
      shop.dailyProfitHistory30.push(shop.todayNetProfit);
      if (shop.dailyProfitHistory30.length > 30) {
        shop.dailyProfitHistory30.shift();
      }

      // 4f. Nakit ve Bilanço Yansıması (gün içinde kasaya giren satış tekrar yazılmaz)
      const netCashFlowToday = Number(
        (dayTotals.uncreditedRevenue - totalDailyExpenses).toFixed(2)
      );
      const inventoryReductionTotal = Number(
        (shop.todayCogs + shop.todaySpoilageCost).toFixed(2)
      );

      if (shop.isCompanyBranch && state.playerCompany) {
        const pc = state.playerCompany;
        pc.financials.inventory = Number(
          Math.max(0, pc.financials.inventory - inventoryReductionTotal).toFixed(2)
        );
        CompanyWallet.assign(pc, Number(
          Math.max(0, pc.financials.cash + netCashFlowToday).toFixed(2)
        ));
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
        if (shop.cashAccountBalance + netCashFlowToday >= 0) {
          shop.cashAccountBalance = Number(
            (shop.cashAccountBalance + netCashFlowToday).toFixed(2)
          );
        } else {
          // Dükkân kasası yetmezse kalan gideri kişisel nakitten, o da yetmezse kısa vadeli borçtan karşıla
          const shortfall = Number(
            (-(shop.cashAccountBalance + netCashFlowToday)).toFixed(2)
          );
          shop.cashAccountBalance = 0;
          const spendable = Math.max(0, state.cash - reservedOrderCash);
          if (spendable >= shortfall) {
            WalletEngine.spend(state, shortfall);
            shop.totalInvestedCapital = Number(
              Math.max(5_000, shop.totalInvestedCapital - shortfall).toFixed(2)
            );
          } else {
            state.shortTermDebt = Number(
              (state.shortTermDebt + shortfall).toFixed(2)
            );
            state.totalDebt = Number(
              (state.shortTermDebt + state.longTermDebt).toFixed(2)
            );
          }
        }
      }

      // 4g. Ana sorun ve önerilen işlem metni (Temiz oyuncu arayüzü için)
      const totalUnitsLeft = shop.inventoryBatches.reduce(
        (s, b) => s + b.availableQuantity,
        0
      );
      if (totalUnitsLeft === 0) {
        shop.mainIssueTR =
          shop.pendingDeliveriesCount > 0
            ? `Stok bitti · ${shop.pendingDeliveriesCount} sevkiyat yolda.`
            : 'Raflarda ürün kalmadı — satış durdu.';
        shop.recommendedActionTR =
          shop.pendingDeliveriesCount > 0
            ? 'Yoldaki teslimatın ulaşmasını bekleyin.'
            : 'Hemen tedarikçiden ürün sipariş edin.';
      } else if (totalUnitsLeft < Math.round(shop.shelfCapacity * 0.2)) {
        shop.mainIssueTR = `Kritik stok seviyesi (${totalUnitsLeft} birim kaldı).`;
        shop.recommendedActionTR = 'Stok bitmeden yeni ürün siparişi verin.';
      } else if (shop.staffCount < shop.minStaffRequired) {
        shop.mainIssueTR = `Çalışan sayısı yetersiz (${shop.staffCount}/${shop.minStaffRequired}).`;
        shop.recommendedActionTR = 'Müşteri kaçırmamak için yeni çalışan alın.';
      } else if (shop.todayNetProfit < 0) {
        shop.mainIssueTR = 'Bugün giderler satış kârını aştı.';
        shop.recommendedActionTR =
          'Satış fiyatlarını veya ürün çeşitliliğini gözden geçirin.';
      } else {
        shop.mainIssueTR = 'Sorun yok — satışlar ve stok dengeli.';
        shop.recommendedActionTR =
          shop.level < 5
            ? `Kapasiteyi büyütmek için Seviye ${shop.level + 1} geliştirmesini değerlendirin.`
            : 'Yeni şube açarak ticaret ağınızı büyütün.';
      }

      ts.todaySummary.shopSalesRevenue = Number(
        (ts.todaySummary.shopSalesRevenue + shop.todaySalesRevenue).toFixed(2)
      );
      ts.todaySummary.shopCogs = Number(
        (ts.todaySummary.shopCogs + shop.todayCogs).toFixed(2)
      );
      ts.todaySummary.shopOpex = Number(
        (ts.todaySummary.shopOpex + totalDailyExpenses).toFixed(2)
      );
      ts.todaySummary.shopSpoilageCost = Number(
        (ts.todaySummary.shopSpoilageCost + shop.todaySpoilageCost).toFixed(2)
      );
      ts.todaySummary.shopNetProfit = Number(
        (ts.todaySummary.shopNetProfit + shop.todayNetProfit).toFixed(2)
      );
    }

    const ownShopsChannel = ts.salesChannels.find(
      (c) => c.channelType === 'OWN_SHOPS'
    );
    if (ownShopsChannel) {
      ownShopsChannel.todayUnitsSold = ts.shops.reduce(
        (s, sh) => s + sh.todayUnitsSold,
        0
      );
      ownShopsChannel.todayRevenue = ts.todaySummary.shopSalesRevenue;
    }

    // 5. Vadesi Gelen Alacak ve Borç Faturalarını (`TradeInvoice`) İşle
    for (const inv of ts.invoices) {
      if (inv.status === 'PAID' || inv.status === 'CANCELLED') continue;
      if (state.day < inv.dueDay) continue;

      if (inv.direction === 'RECEIVABLE') {
        const collected = inv.remainingAmount;
        inv.paidAmount = inv.totalAmount;
        inv.remainingAmount = 0;
        inv.status = 'PAID';

        if (state.playerCompany) {
          const pc = state.playerCompany;
          pc.financials.receivables = Number(
            Math.max(0, pc.financials.receivables - collected).toFixed(2)
          );
          CompanyWallet.earn(pc, collected);
          pc.capitalCash = pc.financials.cash;
          pc.financials.totalAssets = Number(
            (
              pc.financials.cash +
              pc.financials.inventory +
              pc.financials.receivables +
              pc.financials.fixedAssets
            ).toFixed(2)
          );
        } else {
          WalletEngine.earn(state, collected);
        }

        ts.todaySummary.receivablesCollected = Number(
          (ts.todaySummary.receivablesCollected + collected).toFixed(2)
        );
        ts.payments.unshift({
          paymentId: `PAY-IN-D${state.day}-${inv.invoiceId}`,
          invoiceId: inv.invoiceId,
          day: state.day,
          amount: collected,
          direction: 'INFLOW',
          description: `${inv.counterpartyNameTR} vadeli satış faturası tahsilatı`,
        });
      } else if (inv.direction === 'PAYABLE') {
        const toPay = inv.remainingAmount;
        if (state.playerCompany) {
          const pc = state.playerCompany;
          if (pc.financials.cash >= toPay) {
            CompanyWallet.spend(pc, toPay);
            pc.capitalCash = pc.financials.cash;
            pc.supplierPayableBalance = Number(
              Math.max(0, (pc.supplierPayableBalance ?? 0) - toPay).toFixed(2)
            );
            pc.financials.shortTermDebt = Number(
              Math.max(0, pc.financials.shortTermDebt - toPay).toFixed(2)
            );
            pc.financials.totalLiabilities = Number(
              (
                pc.financials.shortTermDebt + pc.financials.longTermDebt
              ).toFixed(2)
            );
            pc.financials.totalAssets = Number(
              (
                pc.financials.cash +
                pc.financials.inventory +
                pc.financials.receivables +
                pc.financials.fixedAssets
              ).toFixed(2)
            );
            inv.paidAmount = inv.totalAmount;
            inv.remainingAmount = 0;
            inv.status = 'PAID';
            ts.todaySummary.payablesPaid = Number(
              (ts.todaySummary.payablesPaid + toPay).toFixed(2)
            );
          } else {
            inv.status = 'OVERDUE';
          }
        } else {
          const spendable = Math.max(0, state.cash - reservedOrderCash);
          if (spendable >= toPay) {
            WalletEngine.spend(state, toPay);
            inv.paidAmount = inv.totalAmount;
            inv.remainingAmount = 0;
            inv.status = 'PAID';
            ts.todaySummary.payablesPaid = Number(
              (ts.todaySummary.payablesPaid + toPay).toFixed(2)
            );
          } else {
            inv.status = 'OVERDUE';
          }
        }
      }
    }

    // 6. Vadesi Geçen Kurumsal Sözleşmelerin Ceza ve İtibar Kontrolü
    for (const cc of ts.commercialContracts) {
      if (cc.status !== 'ACTIVE') continue;
      if (state.day > cc.dueDay && cc.remainingUnits > 0) {
        const penalty = Number(
          (cc.remainingUnits * cc.latePenaltyPerUnit).toFixed(2)
        );
        cc.status = 'DEFAULTED';
        ts.tradeReputationScore = Math.max(
          15,
          ts.tradeReputationScore - cc.reputationPenalty
        );
        ts.deliveryPunctualityScore = Math.max(
          20,
          ts.deliveryPunctualityScore - 8
        );
        ts.todaySummary.overduePenaltiesPaid = Number(
          (ts.todaySummary.overduePenaltiesPaid + penalty).toFixed(2)
        );

        if (state.playerCompany) {
          const pc = state.playerCompany;
          const paidPenalty = Math.min(pc.financials.cash, penalty);
          CompanyWallet.spend(pc, paidPenalty);
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
        }
      }
    }

    TradeUniverse.updateCareerStage(state);
    ts.lastTradeAuditReport = TradeAudit.runTradeIntegrityAudit(state);
  }

  // ============================================================================
  // 13. STOK, TİCARET VE MUHASEBE TUTARLILIK DENETİMİ (`runTradeIntegrityAudit`)
  // ============================================================================

}
