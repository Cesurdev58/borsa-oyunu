/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DÜKKÂN KÜÇÜK YÜKSELTMELERİ (ShopUpgrades)
 * Veri `data/shopUpgrades.ts`. Alınan yükseltmeler `ShopInstance.upgrades` (kimlik listesi; eski kayıtlarda yoktur).
 * Etkileri `ShopSales.computeShopDailyDemand` okur (müşteri ve sepet çarpanı).
 * Ödeme seviye yükseltmesiyle aynıdır: önce dükkân kasası, yetmezse kişisel nakit.
 * Şirket şubelerinde yoktur. Yalnızca veri, modeller ve WalletEngine'i içe aktarır (döngü oluşmaz).
 */
import { SHOP_UPGRADE_COST_MULTIPLIER, SHOP_UPGRADES, type ShopUpgradeDef } from '../data/shopUpgrades';
import { SHOP_TEMPLATES } from '../data/tradeCatalog';
import type { SimulationState } from '../models/simulation';
import type { ShopInstance } from '../models/trade';
import { WalletEngine } from './WalletEngine';

export function shopUpgradeCost(shop: Pick<ShopInstance, 'shopType'>, def: ShopUpgradeDef): number {
  const tpl = SHOP_TEMPLATES[shop.shopType];
  const setup = tpl.openingCost + tpl.decorationCost;
  const k = SHOP_UPGRADE_COST_MULTIPLIER[shop.shopType] ?? 1;
  return Math.max(500, Math.round((setup * def.costShare * k) / 500) * 500);
}

/** Dükkânın yükseltmelerden gelen müşteri ve sepet çarpanları (yükseltme yoksa 1). */
export function shopUpgradeMultipliers(shop: Pick<ShopInstance, 'upgrades' | 'usedUpgrades'>): { customers: number; basket: number } {
  let customers = 1;
  let basket = 1;
  // Kalıcı yükseltmeler + ikinci el pazarından alınan süreli eşyalar (süresi bitince gün kapanışında silinir)
  const ids = new Set([...(shop.upgrades ?? []), ...Object.keys(shop.usedUpgrades ?? {})]);
  for (const id of ids) {
    const def = SHOP_UPGRADES.find((u) => u.id === id);
    if (!def) continue;
    customers *= 1 + def.customersPct / 100;
    basket *= 1 + def.basketPct / 100;
  }
  return { customers, basket };
}

export type ShopUpgradeStatus = 'OWNED' | 'AVAILABLE' | 'LOCKED';

export interface ShopUpgradeView {
  def: ShopUpgradeDef;
  cost: number;
  status: ShopUpgradeStatus;
  /** İkinci el olarak varsa son geçerli gün (yenisi alınabilir) */
  usedUntilDay?: number;
}

export function listShopUpgrades(shop: ShopInstance): ShopUpgradeView[] {
  const owned = new Set(shop.upgrades ?? []);
  return SHOP_UPGRADES.map((def) => ({
    def,
    cost: shopUpgradeCost(shop, def),
    status: owned.has(def.id) ? 'OWNED' : shop.level >= def.minLevel ? 'AVAILABLE' : 'LOCKED',
    usedUntilDay: owned.has(def.id) ? undefined : shop.usedUpgrades?.[def.id],
  }));
}

export function buyShopUpgrade(
  state: SimulationState,
  shopId: string,
  upgradeId: string,
  reservedOrderCash: number
): { success: boolean; message: string; cost: number } {
  const shop = state.tradeState?.shops.find((s) => s.shopId === shopId);
  if (!shop) return { success: false, message: 'Dükkân bulunamadı.', cost: 0 };
  if (shop.isCompanyBranch) return { success: false, message: 'Şirket şubelerine bu yükseltmeler yapılmaz.', cost: 0 };
  const def = SHOP_UPGRADES.find((u) => u.id === upgradeId);
  if (!def) return { success: false, message: 'Böyle bir yükseltme yok.', cost: 0 };
  if ((shop.upgrades ?? []).includes(def.id)) return { success: false, message: `${def.name} zaten var.`, cost: 0 };
  if (shop.level < def.minLevel) {
    return { success: false, message: `${def.name} için dükkân en az ${def.minLevel}. seviye olmalı.`, cost: 0 };
  }
  const cost = shopUpgradeCost(shop, def);
  const spendablePlayer = Math.max(0, state.cash - reservedOrderCash);
  if (shop.cashAccountBalance + spendablePlayer < cost) {
    return { success: false, message: `${def.name} için ₺${cost.toLocaleString('tr-TR')} gerekiyor.`, cost: 0 };
  }
  const fromShop = Math.min(shop.cashAccountBalance, cost);
  const fromPlayer = Math.round((cost - fromShop) * 100) / 100;
  shop.cashAccountBalance = Math.round((shop.cashAccountBalance - fromShop) * 100) / 100;
  if (fromPlayer > 0) WalletEngine.spendBusiness(state, fromPlayer);
  shop.totalInvestedCapital = Math.round((shop.totalInvestedCapital + cost) * 100) / 100;
  shop.upgrades = [...(shop.upgrades ?? []), def.id];
  // Yenisi gelince ikinci el olan atılır
  if (shop.usedUpgrades?.[def.id] !== undefined) {
    const rest = { ...shop.usedUpgrades };
    delete rest[def.id];
    shop.usedUpgrades = rest;
  }
  return { success: true, message: `${shop.nameTR}: ${def.name} kuruldu (${def.effectLabel}).`, cost };
}
