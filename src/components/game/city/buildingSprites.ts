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
    src: '/buildings/stock-exchange.png',
    widthPx: 215,
    aspect: 485 / 514,
  },
  BANKA: {
    src: '/buildings/bank.png',
    widthPx: 200,
    aspect: 522 / 478,
  },
};

/** Şehir blokları (IsometricDecorationLayer) için sprite eşleştirmesi. Anahtar: blok kimliği. */
export const URBAN_BLOCK_SPRITES: Record<string, BuildingSpriteSpec> = {
  'urban-ticaret-magaza-1': {
    src: '/buildings/market.png',
    widthPx: 150,
    aspect: 552 / 452,
  },
  'urban-ticaret-kafe-2': {
    src: '/buildings/cafe.png',
    widthPx: 120,
    aspect: 521 / 479,
  },
};

export function getSpriteHeightPx(spec: BuildingSpriteSpec): number {
  return Math.round(spec.widthPx / spec.aspect);
}
