/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DÜKKÂN KÜÇÜK YÜKSELTMELERİ
 * Her dükkânda seviye yükseltmesinin yanında 6 küçük yükseltme vardır. Tycoon oyunlarındaki gibi
 * sık, ucuz ve etkisi açıkça yazan alımlar: "+%6 müşteri", "+%5 sepet".
 *  - customersPct: günlük müşteri sayısına eklenen yüzde
 *  - basketPct: müşteri başına harcamaya (sepet) eklenen yüzde
 *  - costShare: dükkânın kurulum maliyetinin (açılış + dekor) bu kadarı × türün katsayısı
 *    (`SHOP_UPGRADE_COST_MULTIPLIER`, 500 ₺'ye yuvarlanır)
 *  - minLevel: yükseltmenin açılması için gereken dükkân seviyesi
 * Etkiler çarpılarak birleşir. Denge `npm run balans` "YÜKSELTMELER" bölümünde ölçülür
 * (her yükseltmenin kaç günde kendini çıkardığı). Yalnızca sabit içerir.
 */

export interface ShopUpgradeDef {
  id: string;
  name: string;
  /** Kısa etki yazısı (ekranda gösterilir) */
  effectLabel: string;
  customersPct: number;
  basketPct: number;
  costShare: number;
  minLevel: number;
}

export const SHOP_UPGRADES: readonly ShopUpgradeDef[] = [
  { id: 'tabela', name: 'Işıklı tabela', effectLabel: '+%3 müşteri', customersPct: 3, basketPct: 0, costShare: 0.15, minLevel: 1 },
  { id: 'vitrin', name: 'Vitrin düzeni', effectLabel: '+%3 sepet', customersPct: 0, basketPct: 3, costShare: 0.2, minLevel: 1 },
  { id: 'kasa', name: 'İkinci kasa', effectLabel: '+%4 müşteri', customersPct: 4, basketPct: 0, costShare: 0.3, minLevel: 2 },
  { id: 'reklam', name: 'Sosyal medya reklamı', effectLabel: '+%5 müşteri', customersPct: 5, basketPct: 0, costShare: 0.4, minLevel: 2 },
  { id: 'sadakat', name: 'Sadakat kartı', effectLabel: '+%4 sepet', customersPct: 0, basketPct: 4, costShare: 0.55, minLevel: 3 },
  { id: 'yenileme', name: 'İç mekân yenileme', effectLabel: '+%3 müşteri, +%2 sepet', customersPct: 3, basketPct: 2, costShare: 0.7, minLevel: 3 },
];

/**
 * Dükkân türüne göre yükseltme fiyat katsayısı. Dükkân türlerinin kârlılığı farklı olduğu için
 * yalnızca kurulum maliyetine bağlı fiyat bazı türlerde çok ucuz (kafe), bazılarında çok pahalı
 * (elektronik) kalıyordu. Katsayılar, 6 yükseltmenin hepsinin dükkânın kendi hedef geri dönüş
 * süresinin ~%80'inde kendini çıkaracağı şekilde ölçülerek verildi (`npm run balans`).
 */
export const SHOP_UPGRADE_COST_MULTIPLIER: Record<string, number> = {
  BUFE: 0.92,
  MANAV: 1.28,
  KAFE: 2.07,
  GIYIM_MAGAZASI: 1.08,
  ELEKTRONIK_MAGAZASI: 0.96,
  MOBILYA_MAGAZASI: 0.87,
  MARKET: 1.43,
  OTOMOBIL_GALERISI: 1.04,
};
