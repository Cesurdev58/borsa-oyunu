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

/**
 * DÜKKÂN MÜDÜRÜ
 * Müdür, dükkânı oyuncu yerine yönetir: rafları dükkân kasasından doldurur ve kasada biriken
 * fazla kârı oyuncunun cebine aktarır. Karşılığında günlük maaş alır.
 * Denge hedefi (`npm run balans`, "MÜDÜR" bölümü): müdürlü dükkân, her gün elle yönetilen dükkânın
 * kârının yaklaşık %70–85'ini kazanır. Yani müdür zahmeti alır ama elle yönetmek hâlâ biraz daha kârlıdır.
 */
export const MANAGER_MIN_SHOP_LEVEL = 2;
/** Müdürün sabit günlük maaşı = dükkân türünün çalışan maaşı × bu katsayı */
export const MANAGER_WAGE_MULTIPLIER = 0.2;
/** Müdür primi: müdürden önceki günlük kârın bu payı (yalnızca kârlı günlerde) */
export const MANAGER_PROFIT_SHARE = 0.15;
/** İşe alma ücreti = sabit günlük maaş × bu katsayı (bir kez) */
export const MANAGER_HIRE_FEE_DAYS = 30;
/** Müdür kasada en az bu kadar günlük gideri bırakır */
export const MANAGER_CASH_RESERVE_DAYS = 3;
/** Kasa, ayrılan payın bu katını geçince fazlası oyuncuya aktarılır */
export const MANAGER_SWEEP_TRIGGER_MULT = 3;
