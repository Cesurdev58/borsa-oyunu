/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GÖSTERİŞ HARCAMALARI (lüks alımlar)
 * Paranın "daha çok para" dışında gidebileceği yer. Her alım bir kez yapılır, kişisel nakitten ödenir,
 * net varlığa sayılmaz (zenginler listesinde sıra kaybettirir; bilinçli ödünleşim) ve ticari itibar verir.
 * Ticari itibar (0–100) dükkânlara gelen müşteriyi artırır (`ShopSales`, itibar çarpanı) ve
 * şirketleşme şartlarından biridir (en az 60). Oyuncu 58 itibarla başlar.
 * Yalnızca sabit içerir.
 */

export interface LifestyleItemDef {
  id: string;
  name: string;
  /** Ürün resmi (emoji yalnızca ürün resmi olarak kullanılır) */
  emoji: string;
  price: number;
  reputation: number;
}

export const LIFESTYLE_ITEMS: readonly LifestyleItemDef[] = [
  { id: 'daire', name: 'Şehir dairesi', emoji: '🏢', price: 150_000, reputation: 3 },
  { id: 'araba', name: 'Lüks araba', emoji: '🚗', price: 400_000, reputation: 4 },
  { id: 'villa', name: 'Deniz manzaralı villa', emoji: '🏡', price: 2_500_000, reputation: 6 },
  { id: 'yat', name: 'Yat', emoji: '🛥️', price: 12_000_000, reputation: 8 },
  { id: 'jet', name: 'Özel jet', emoji: '✈️', price: 60_000_000, reputation: 10 },
  { id: 'ada', name: 'Özel ada', emoji: '🏝️', price: 300_000_000, reputation: 12 },
];

/** Ticari itibarın üst sınırı */
export const REPUTATION_MAX = 100;
