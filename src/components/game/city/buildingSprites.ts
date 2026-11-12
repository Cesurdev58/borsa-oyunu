/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CityBuildingId } from '../gameTypes';

/**
 * Şehir binaları için hazır PNG sprite eşleştirmesi.
 *
 * Dosyalar `public/buildings/` altında durur ve kök yoldan (`/buildings/...`) servis edilir.
 * Burada tanımı olan bina, CSS ile çizilen eski gövde yerine PNG ile gösterilir.
 * Tanımı olmayan bina eski çizimini kullanmaya devam eder.
 *
 * Yeni bina eklemek için:
 *   1. PNG dosyasını `public/buildings/` klasörüne koy (şeffaf arka plan, kenara kırpılmış).
 *   2. Aşağıdaki haritalardan uygun olana bir satır ekle.
 *   3. `aspect` = PNG genişliği / PNG yüksekliği.
 */
// Sitenin alt klasörde (ör. GitHub Pages) yayınlanması için taban yol.
const BASE: string = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

export interface BuildingSpriteSpec {
  /** Kök yoldan servis edilen dosya yolu. */
  src: string;
  /** Sanal 1600x1200 harita biriminde görünür genişlik. */
  widthPx: number;
  /** Genişlik / yükseklik oranı (PNG'nin gerçek piksel boyutlarından). */
  aspect: number;
}

/** 8 ana bina (IsometricBuilding) için sprite eşleştirmesi. */
export const CORE_BUILDING_SPRITES: Partial<
  Record<CityBuildingId, BuildingSpriteSpec>
> = {
  BORSA: {
    src: `${BASE}buildings/stock-exchange.png`,
    widthPx: 215,
    aspect: 485 / 514,
  },
  BANKA: {
    src: `${BASE}buildings/bank.png`,
    widthPx: 200,
    aspect: 522 / 478,
  },
};

/** Şehir blokları (IsometricDecorationLayer) için sprite eşleştirmesi. Anahtar: blok kimliği. */
export const URBAN_BLOCK_SPRITES: Record<string, BuildingSpriteSpec> = {
  'urban-ticaret-magaza-1': {
    src: `${BASE}buildings/market.png`,
    widthPx: 150,
    aspect: 552 / 452,
  },
  'urban-ticaret-kafe-2': {
    src: `${BASE}buildings/cafe.png`,
    widthPx: 120,
    aspect: 521 / 479,
  },
};

/**
 * Dükkân türüne göre görseller. Anahtar: `ShopType` değeri.
 * Burada olmayan tür (BUFE, MANAV, GIYIM_MAGAZASI, ELEKTRONIK_MAGAZASI, MOBILYA_MAGAZASI,
 * OTOMOBIL_GALERISI) eski CSS kutu çizimiyle gösterilir. Yeni tür görseli eklemek için buraya satır ekle.
 */
export const SHOP_TYPE_SPRITES: Record<string, BuildingSpriteSpec> = {
  MARKET: URBAN_BLOCK_SPRITES['urban-ticaret-magaza-1'],
  KAFE: URBAN_BLOCK_SPRITES['urban-ticaret-kafe-2'],
};

/** Dükkânların oturduğu şehir blokları (sırayla 1., 2. ve 3. dükkân). */
const SHOP_SLOT_BLOCK_IDS = new Set([
  'urban-ticaret-magaza-1',
  'urban-ticaret-kafe-2',
  'urban-ticaret-otel-5',
]);

/**
 * Bir şehir bloğunun görselini seçer.
 * - Blokta açık bir dükkân varsa görsel dükkânın TÜRÜNDEN gelir (sıradan değil).
 *   Türün görseli yoksa `undefined` döner ve eski çizim kullanılır.
 * - Blokta dükkân yoksa (boş arsa) bloğun kendi varsayılan görseli kullanılır.
 */
export function getUrbanBlockSprite(
  blockId: string,
  activeShopType?: string
): BuildingSpriteSpec | undefined {
  if (SHOP_SLOT_BLOCK_IDS.has(blockId) && activeShopType) {
    return SHOP_TYPE_SPRITES[activeShopType];
  }
  return URBAN_BLOCK_SPRITES[blockId];
}

export function getSpriteHeightPx(spec: BuildingSpriteSpec): number {
  return Math.round(spec.widthPx / spec.aspect);
}
