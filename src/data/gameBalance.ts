/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OYUN DENGESİ: tek yerde toplanan, oynanışı doğrudan etkileyen sayılar.
 * Yalnızca sabit içerir; hiçbir motoru içe aktarmaz (döngü oluşturmaz).
 */

/**
 * İlk dükkânı açabilmek için gereken en düşük net değer (TL).
 * Oyuncu 100.000 TL ile başlar: ilk dükkân için borsada en az %20 kazanması gerekir.
 * Dükkân ekonomisi borsadan çok daha kârlı olduğu için bu kapı olmadan borsa aşaması atlanıyordu.
 * Daha kolay/zor bir başlangıç için yalnızca bu sayıyı değiştirmek yeterlidir.
 */
export const FIRST_SHOP_MIN_NET_WORTH = 120_000;
