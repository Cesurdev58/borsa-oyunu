/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Prestij puanıyla alınan kalıcı avantajlar (yeni şehirlerde de geçerli).
 */
export interface PrestigePerk {
  id: string;
  name: string;
  /** Kısa, teknik olmayan açıklama */
  desc: string;
  /** Seviye başına puan */
  cost: number;
  maxLevel: number;
}

export const PRESTIGE_PERKS: ReadonlyArray<PrestigePerk> = [
  { id: 'cash', name: 'Dolgun cüzdan', desc: 'Yeni şehirde her seviye başlangıç parasına +25.000 ₺ ekler.', cost: 1, maxLevel: 4 },
  { id: 'ticket', name: 'Eğitim bileti', desc: 'Her seviye yeni şehirde bir bedava çalışan eğitimi hakkı verir.', cost: 1, maxLevel: 3 },
  { id: 'decor', name: 'Gösterişli vitrin', desc: 'Her seviye dükkân müşterisine kalıcı +%1 ekler.', cost: 2, maxLevel: 3 },
];

export const PERK_START_CASH_PER_LEVEL = 25_000;
export const PERK_CUSTOMER_PCT_PER_LEVEL = 1;
