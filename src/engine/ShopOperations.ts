/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DÜKKÂN İŞLEMLERİ: açma, seviye yükseltme, kasa aktarımı ve ayarlar
 * (TradeAndShopEngine dosyasından ayrıldı; dış dünya hâlâ TradeAndShopEngine.* üzerinden erişebilir.)
 */

import { FIRST_SHOP_MIN_NET_WORTH } from '../data/gameBalance';
import {
  SimulationState,
} from '../models/simulation';
import {
  ShopInstance,
  ShopType,
} from '../models/trade';
import {
  ACCOUNT_IDS,
  CentralLedgerEngine,
} from './CentralLedgerEngine';
import {
  WalletEngine,
} from './WalletEngine';

import {
  RESOURCE_CATALOG,
  SHOP_TEMPLATES,
} from '../data/tradeCatalog';
import {
  TradeUniverse,
} from './TradeUniverse';
import { CompanyWallet } from './CompanyWallet';

export class ShopOperations {
  /**
   * Yeni bir Esnaf Dükkânı / Mağaza Şubesi açar (`openShop`):
   * - Kuruluş + dekorasyon + başlangıç kasa sermayesini tek seferde düşer.
   * - Dükkân için ayrı işletme kasası (`cashAccountBalance`) oluşturur ve başlangıç stoğu hediye etmez;
   *   ancak isteğe bağlı başlangıç kasa nakdi (`initialShopCash`) ile hemen sipariş verilebilir.
   */
  public static openShop(
    state: SimulationState,
    params: {
      shopType: ShopType;
      customNameTR?: string;
      cityBlockId?: string;
      initialWorkingCash?: number;
      reservedOrderCash: number;
    }
  ): {
    success: boolean;
    message: string;
    shop: ShopInstance | null;
    totalCapitalSpent: number;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const tpl = SHOP_TEMPLATES[params.shopType];
    if (!tpl) {
      return {
        success: false,
        message: 'Geçersiz dükkân türü seçildi.',
        shop: null,
        totalCapitalSpent: 0,
      };
    }

    // İlk dükkân kapısı: borsada yeterli birikim yapılmadan esnaflığa geçilemez (şirket şubeleri hariç).
    if (
      ts.shops.length === 0 &&
      state.playerCompany === null &&
      state.netWorth < FIRST_SHOP_MIN_NET_WORTH
    ) {
      return {
        success: false,
        message: `İlk dükkânı açmak için net değerin en az ₺${FIRST_SHOP_MIN_NET_WORTH.toLocaleString('tr-TR')} olması gerekir (şu an ₺${Math.round(state.netWorth).toLocaleString('tr-TR')}). Önce borsada birikim yap.`,
        shop: null,
        totalCapitalSpent: 0,
      };
    }

    const setupCost = Number((tpl.openingCost + tpl.decorationCost).toFixed(2));
    const initialWorkingCash = Number(
      Math.max(0, params.initialWorkingCash ?? Math.round(setupCost * 0.25)).toFixed(2)
    );
    const totalNeeded = Number((setupCost + initialWorkingCash).toFixed(2));

    const isCompanyBranch = state.playerCompany !== null;
    const spendablePlayerCash = Number(
      Math.max(0, state.cash - params.reservedOrderCash).toFixed(2)
    );

    if (isCompanyBranch && state.playerCompany) {
      const pc = state.playerCompany;
      if (pc.financials.cash < totalNeeded) {
        return {
          success: false,
          message: `${tpl.nameTR} şubesi açmak için gereken ₺${totalNeeded.toLocaleString('tr-TR')} (Kurulum: ₺${setupCost.toLocaleString('tr-TR')} + İşletme Kasası: ₺${initialWorkingCash.toLocaleString('tr-TR')}) şirket kasasında mevcut değil.`,
          shop: null,
          totalCapitalSpent: 0,
        };
      }
      // Şirket şubesi açılışı: Nakit azalır, sabit kıymet (fixedAssets) setupCost kadar artar, şube kasası initialWorkingCash tutar
      CompanyWallet.spend(pc, setupCost);
      pc.capitalCash = pc.financials.cash;
      pc.financials.fixedAssets = Number(
        (pc.financials.fixedAssets + setupCost).toFixed(2)
      );
      pc.financials.totalAssets = Number(
        (
          pc.financials.cash +
          pc.financials.inventory +
          pc.financials.receivables +
          pc.financials.fixedAssets
        ).toFixed(2)
      );
      CentralLedgerEngine.recordPostedAccountingEntry(state, {
        idempotencyKey: `SHOP-OPEN-COMP-D${state.day}-S${ts.shopSeq + 1}`,
        sourceAccountId: ACCOUNT_IDS.companyBank(pc.ticker),
        destinationAccountId: ACCOUNT_IDS.FIXED_ASSET,
        amount: setupCost,
        category: 'CAPEX_INVESTMENT',
        description: `${tpl.nameTR} yeni mağaza şubesi açılış ve dekorasyon yatırımı`,
        relatedCompanyId: pc.ticker,
        reservedOrderCash: params.reservedOrderCash,
      });
    } else {
      if (spendablePlayerCash < totalNeeded) {
        return {
          success: false,
          message: `${tpl.nameTR} açmak için gereken ₺${totalNeeded.toLocaleString('tr-TR')} (Kurulum & Dekorasyon: ₺${setupCost.toLocaleString('tr-TR')} + Dükkân Kasası: ₺${initialWorkingCash.toLocaleString('tr-TR')}) kullanılabilir nakdinizi (₺${spendablePlayerCash.toLocaleString('tr-TR')}) aşıyor.`,
          shop: null,
          totalCapitalSpent: 0,
        };
      }
      WalletEngine.spend(state, totalNeeded);
      CentralLedgerEngine.recordPostedAccountingEntry(state, {
        idempotencyKey: `SHOP-OPEN-PLAYER-D${state.day}-S${ts.shopSeq + 1}`,
        sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
        destinationAccountId: ACCOUNT_IDS.FIXED_ASSET,
        amount: totalNeeded,
        category: 'CAPEX_INVESTMENT',
        description: `${tpl.nameTR} esnaf dükkânı açılış ve işletme kasası tahsisi`,
        reservedOrderCash: params.reservedOrderCash,
      });
    }

    ts.shopSeq += 1;
    const branchNumber =
      ts.shops.filter((s) => s.shopType === params.shopType).length + 1;
    const shopId = `SHOP-${params.shopType}-${String(ts.shopSeq).padStart(4, '0')}`;
    const defaultSellingPrices: Record<string, number> = {};
    for (const resId of tpl.allowedResourceIds) {
      const resDef = RESOURCE_CATALOG[resId];
      if (resDef) {
        defaultSellingPrices[resId] = Number(
          (
            resDef.baseMarketPrice *
            (1 + tpl.defaultGrossMarginPct / 100)
          ).toFixed(2)
        );
      }
    }

    const newShop: ShopInstance = {
      shopId,
      shopType: params.shopType,
      nameTR:
        params.customNameTR?.trim() ||
        `${tpl.nameTR} #${branchNumber}`,
      cityBlockId: params.cityBlockId || tpl.defaultCityBlockId,
      level: 1,
      openedDay: state.day,
      isCompanyBranch,
      cashAccountBalance: isCompanyBranch ? 0 : initialWorkingCash,
      totalInvestedCapital: setupCost,
      dailyRent: tpl.dailyRentBase,
      staffCount: tpl.minStaffRequired,
      minStaffRequired: tpl.minStaffRequired,
      staffDailyWagePerPerson: tpl.staffDailyWagePerPerson,
      maxCustomerCapacity: tpl.baseCustomerCapacity,
      shelfCapacity: tpl.baseShelfCapacity,
      backroomCapacity: tpl.baseBackroomCapacity,
      inventoryBatches: [],
      sellingPrices: defaultSellingPrices,
      autoReplenishEnabled: true,
      customerSatisfaction: 78,
      reputationScore: 70,
      todayWalkInCustomers: 0,
      todayServedCustomers: 0,
      todayUnmetCustomerDemand: 0,
      todayUnitsSold: 0,
      todaySalesRevenue: 0,
      todayCogs: 0,
      todayRentAndOpex: 0,
      todayPayrollCost: 0,
      todaySpoilageUnits: 0,
      todaySpoilageCost: 0,
      todayNetProfit: 0,
      cumulativeRevenue: 0,
      cumulativeNetProfit: 0,
      dailyProfitHistory30: [],
      pendingDeliveriesCount: 0,
      mainIssueTR: 'Raflarda ürün yok — satış başlaması için ürün sipariş edin.',
      recommendedActionTR: 'Tedarikçiden ilk ürün siparişini verin.',
      specificState: {
        spoilageRateMultiplier: 1.0,
        tableCount: params.shopType === 'KAFE' ? 12 : 0,
        seasonalCollectionActive: params.shopType === 'GIYIM_MAGAZASI',
        warrantySatisfactionBonus:
          params.shopType === 'ELEKTRONIK_MAGAZASI' ? 8 : 0,
        deliveryServiceCapacity:
          params.shopType === 'MOBILYA_MAGAZASI' ? 10 : 0,
        activeCategoryCount: 0,
        showroomSlots: params.shopType === 'OTOMOBIL_GALERISI' ? 6 : 0,
      },
    };

    ts.shops.push(newShop);
    TradeUniverse.updateCareerStage(state);

    return {
      success: true,
      message: `${newShop.nameTR} başarıyla açıldı! Satışa başlamak için tedarikçiden ürün sipariş edebilirsiniz.`,
      shop: newShop,
      totalCapitalSpent: totalNeeded,
    };
  }

  /**
   * Dükkân Seviyesini Yükseltir (Seviye 1 -> 2 -> 3 -> 4 -> 5):
   * - Raf, arka depo ve müşteri kapasitesini artırır.
   * - Kira ve personel ihtiyacını gerçekçi biçimde büyütür.
   * - Şehirdeki bina görselini büyütür.
   */
  public static upgradeShopLevel(
    state: SimulationState,
    shopId: string,
    reservedOrderCash: number
  ): {
    success: boolean;
    message: string;
    newLevel: number;
    costPaid: number;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const shop = ts.shops.find((s) => s.shopId === shopId);
    if (!shop) {
      return {
        success: false,
        message: 'Geliştirilecek dükkân bulunamadı.',
        newLevel: 1,
        costPaid: 0,
      };
    }

    if (shop.level >= 5) {
      return {
        success: false,
        message: `${shop.nameTR} zaten maksimum seviyede (Seviye 5 - Prestij Mağaza).`,
        newLevel: shop.level,
        costPaid: 0,
      };
    }

    const tpl = SHOP_TEMPLATES[shop.shopType];
    const upgradeCost = tpl.levelUpgradeCosts[shop.level - 1];

    if (shop.isCompanyBranch && state.playerCompany) {
      const pc = state.playerCompany;
      if (pc.financials.cash < upgradeCost) {
        return {
          success: false,
          message: `Şube geliştirme maliyeti (₺${upgradeCost.toLocaleString('tr-TR')}) şirket kasasında mevcut değil.`,
          newLevel: shop.level,
          costPaid: 0,
        };
      }
      CompanyWallet.spend(pc, upgradeCost);
      pc.capitalCash = pc.financials.cash;
      pc.financials.fixedAssets = Number(
        (pc.financials.fixedAssets + upgradeCost).toFixed(2)
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
      // Önce dükkân kasasından, yetmezse oyuncu nakdinden karşıla
      const availableShopCash = shop.cashAccountBalance;
      const spendablePlayerCash = Math.max(0, state.cash - reservedOrderCash);
      if (availableShopCash + spendablePlayerCash < upgradeCost) {
        return {
          success: false,
          message: `${shop.nameTR} Seviye ${shop.level + 1} geliştirme maliyeti (₺${upgradeCost.toLocaleString('tr-TR')}) için yeterli bakiye yok.`,
          newLevel: shop.level,
          costPaid: 0,
        };
      }
      const fromShop = Math.min(availableShopCash, upgradeCost);
      const fromPlayer = Number((upgradeCost - fromShop).toFixed(2));
      shop.cashAccountBalance = Number(
        (shop.cashAccountBalance - fromShop).toFixed(2)
      );
      if (fromPlayer > 0) {
        WalletEngine.spend(state, fromPlayer);
      }
    }

    shop.level = (shop.level + 1) as 1 | 2 | 3 | 4 | 5;
    shop.totalInvestedCapital = Number(
      (shop.totalInvestedCapital + upgradeCost).toFixed(2)
    );
    const levelMult = 1 + (shop.level - 1) * 0.45;
    shop.maxCustomerCapacity = Math.round(tpl.baseCustomerCapacity * levelMult);
    shop.shelfCapacity = Math.round(tpl.baseShelfCapacity * levelMult);
    shop.backroomCapacity = Math.round(tpl.baseBackroomCapacity * levelMult);
    shop.minStaffRequired =
      tpl.minStaffRequired + Math.floor((shop.level - 1) * 1.5);
    shop.staffCount = Math.max(shop.staffCount, shop.minStaffRequired);
    shop.dailyRent = Math.round(tpl.dailyRentBase * (1 + (shop.level - 1) * 0.35));
    shop.customerSatisfaction = Number(
      Math.min(98, shop.customerSatisfaction + 3).toFixed(1)
    );
    shop.reputationScore = Number(
      Math.min(98, shop.reputationScore + 4).toFixed(1)
    );

    if (shop.shopType === 'MANAV') {
      shop.specificState.spoilageRateMultiplier = Math.max(
        0.4,
        1 - (shop.level - 1) * 0.14
      );
    } else if (shop.shopType === 'KAFE') {
      shop.specificState.tableCount = 12 + (shop.level - 1) * 8;
    } else if (shop.shopType === 'MOBILYA_MAGAZASI') {
      shop.specificState.deliveryServiceCapacity = 10 + (shop.level - 1) * 6;
    } else if (shop.shopType === 'OTOMOBIL_GALERISI') {
      shop.specificState.showroomSlots = 6 + (shop.level - 1) * 4;
    }

    return {
      success: true,
      message: `${shop.nameTR} Seviye ${shop.level} kademesine yükseltildi! Raf kapasitesi: ${shop.shelfCapacity}, Müşteri kapasitesi: ${shop.maxCustomerCapacity}/gün.`,
      newLevel: shop.level,
      costPaid: upgradeCost,
    };
  }

  /**
   * Kişisel Nakit ile Dükkân Kasası Arasında Kontrollü Para Transferi
   */
  public static transferBetweenPersonalAndShopCash(
    state: SimulationState,
    params: {
      shopId: string;
      amount: number;
      direction: 'PERSONAL_TO_SHOP' | 'SHOP_TO_PERSONAL';
      reservedOrderCash: number;
    }
  ): {
    success: boolean;
    message: string;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const shop = ts.shops.find((s) => s.shopId === params.shopId);
    if (!shop) {
      return { success: false, message: 'Dükkân bulunamadı.' };
    }
    if (shop.isCompanyBranch) {
      return {
        success: false,
        message:
          'Bu şube kurumsal şirkete bağlıdır; şirket para transferlerini Banka / Finans sekmesinden yapabilirsiniz.',
      };
    }

    const cleanAmount = Number(
      (Number.isFinite(params.amount) ? params.amount : 0).toFixed(2)
    );
    if (cleanAmount <= 0) {
      return {
        success: false,
        message: 'Transfer tutarı sıfırdan büyük olmalıdır.',
      };
    }

    if (params.direction === 'PERSONAL_TO_SHOP') {
      const spendable = Math.max(0, state.cash - params.reservedOrderCash);
      if (cleanAmount > spendable) {
        return {
          success: false,
          message: `Kişisel kullanılabilir nakit (₺${spendable.toLocaleString('tr-TR')}) yetersiz.`,
        };
      }
      WalletEngine.spend(state, cleanAmount);
      shop.cashAccountBalance = Number(
        (shop.cashAccountBalance + cleanAmount).toFixed(2)
      );
      return {
        success: true,
        message: `${shop.nameTR} kasasına ₺${cleanAmount.toLocaleString('tr-TR')} işletme nakdi aktarıldı.`,
      };
    } else {
      if (cleanAmount > shop.cashAccountBalance) {
        return {
          success: false,
          message: `${shop.nameTR} kasasında çekilebilir en fazla ₺${shop.cashAccountBalance.toLocaleString('tr-TR')} bulunuyor.`,
        };
      }
      shop.cashAccountBalance = Number(
        (shop.cashAccountBalance - cleanAmount).toFixed(2)
      );
      WalletEngine.earn(state, cleanAmount);
      return {
        success: true,
        message: `${shop.nameTR} kasasından kişisel hesaba ₺${cleanAmount.toLocaleString('tr-TR')} kâr/nakit çekildi.`,
      };
    }
  }

  public static configureShopParameters(
    state: SimulationState,
    params: {
      shopId: string;
      targetStaffCount?: number;
      resourceIdForPrice?: string;
      newSellingPrice?: number;
      autoReplenishEnabled?: boolean;
    }
  ): {
    success: boolean;
    message: string;
  } {
    const ts = TradeUniverse.ensureTradeUniverseState(state);
    const shop = ts.shops.find((s) => s.shopId === params.shopId);
    if (!shop) {
      return { success: false, message: 'Dükkân bulunamadı.' };
    }

    const messages: string[] = [];

    if (typeof params.targetStaffCount === 'number') {
      const nextStaff = Math.max(
        1,
        Math.min(40, Math.round(params.targetStaffCount))
      );
      shop.staffCount = nextStaff;
      if (shop.isCompanyBranch && state.playerCompany) {
        // Şirket toplam çalışan sayısını da senkron tut
        const totalBranchStaff = ts.shops
          .filter((s) => s.isCompanyBranch)
          .reduce((sum, s) => sum + s.staffCount, 0);
        if (state.playerCompany.staffCount < totalBranchStaff) {
          state.playerCompany.staffCount = totalBranchStaff;
          state.playerCompany.financials.staffCount = totalBranchStaff;
        }
      }
      messages.push(`Çalışan sayısı ${nextStaff} kişi olarak güncellendi.`);
    }

    if (
      params.resourceIdForPrice &&
      typeof params.newSellingPrice === 'number' &&
      params.newSellingPrice > 0
    ) {
      const cleanPrice = Number(params.newSellingPrice.toFixed(2));
      shop.sellingPrices[params.resourceIdForPrice] = cleanPrice;
      const resName =
        RESOURCE_CATALOG[params.resourceIdForPrice]?.nameTR ||
        params.resourceIdForPrice;
      messages.push(`${resName} satış fiyatı ₺${cleanPrice.toLocaleString('tr-TR')} yapıldı.`);
    }

    if (typeof params.autoReplenishEnabled === 'boolean') {
      shop.autoReplenishEnabled = params.autoReplenishEnabled;
      messages.push(
        `Otomatik stok ikmali ${params.autoReplenishEnabled ? 'açıldı' : 'kapatıldı'}.`
      );
    }

    return {
      success: true,
      message:
        messages.join(' ') || `${shop.nameTR} ayarları güncellendi.`,
    };
  }

  // ============================================================================
  // 6. TEDARİKÇİ TEKLİFLERİ, SATIN ALMA SİPARİŞLERİ VE TEDARİK SÖZLEŞMELERİ
  // ============================================================================
}
