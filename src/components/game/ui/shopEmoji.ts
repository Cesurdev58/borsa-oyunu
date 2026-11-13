/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dükkân türlerinin "ürün resmi" emojisi (tek kaynak).
 */
import type { ShopType } from '../../../models/trade';

export const SHOP_EMOJI: Record<ShopType, string> = {
  BUFE: '🥪',
  MANAV: '🥦',
  KAFE: '☕',
  GIYIM_MAGAZASI: '👗',
  ELEKTRONIK_MAGAZASI: '📱',
  MOBILYA_MAGAZASI: '🛋️',
  MARKET: '🛒',
  OTOMOBIL_GALERISI: '🚗',
};
