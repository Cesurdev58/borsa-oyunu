/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dükkân çalışma saatleri (dükkân türüne göre, oyun saatiyle).
 *
 * Dükkân satışları gün kapanışında o günün toplamı olarak hesaplanır; saatler bu toplamı
 * açık saatlere yayar. Bu yüzden saatler günlük ciroyu değiştirmez (denge aynı kalır),
 * yalnızca dükkânın ne zaman açık olduğunu gösterir. Şirket şubeleri de aynı saatleri izler.
 */
import type { ShopType } from '../models/trade';

export interface ShopHours {
  /** Açılış saati (0–23) */
  open: number;
  /** Kapanış saati (1–24; 24 = gece yarısı) */
  close: number;
}

export const SHOP_HOURS: Record<ShopType, ShopHours> = {
  BUFE: { open: 7, close: 23 },
  MANAV: { open: 7, close: 21 },
  KAFE: { open: 8, close: 24 },
  GIYIM_MAGAZASI: { open: 10, close: 22 },
  ELEKTRONIK_MAGAZASI: { open: 10, close: 22 },
  MOBILYA_MAGAZASI: { open: 10, close: 20 },
  MARKET: { open: 8, close: 23 },
  OTOMOBIL_GALERISI: { open: 9, close: 19 },
};

const DEFAULT_HOURS: ShopHours = { open: 9, close: 21 };

export function shopHoursFor(type: ShopType | string): ShopHours {
  return SHOP_HOURS[type as ShopType] ?? DEFAULT_HOURS;
}

const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

/** "07:00–23:00" */
export function shopHoursLabel(type: ShopType | string): string {
  const h = shopHoursFor(type);
  return `${hh(h.open)}–${h.close === 24 ? '24:00' : hh(h.close)}`;
}

export interface ShopOpenStatus {
  open: boolean;
  /** Kısa yazı: "Açık · 23:00'e kadar" ya da "Kapalı · 07:00'de açılır" */
  label: string;
}

// Türkçe saat ekleri, saatin okunuşunun son kelimesine göre (bir, iki, üç … on, yirmi).
const LOC_BY_DIGIT = ['', 'de', 'de', 'te', 'te', 'te', 'da', 'de', 'de', 'da'];
const DAT_BY_DIGIT = ['', 'e', 'ye', 'e', 'e', 'e', 'ya', 'ye', 'e', 'a'];

/** 07:00'de, 10:00'da, 13:00'te … */
export function atHour(h: number): string {
  const d = h % 10;
  const suf = d === 0 ? (h === 10 ? 'da' : 'de') : LOC_BY_DIGIT[d];
  return `${hh(h)}'${suf}`;
}

/** 21:00'e, 22:00'ye, 19:00'a … ("kadar" ile kullanılır) */
export function toHour(h: number): string {
  const d = h % 10;
  const suf = d === 0 ? (h === 10 ? 'a' : 'ye') : DAT_BY_DIGIT[d];
  return `${hh(h)}'${suf}`;
}

/** Dükkân şu an (gün içi dakika) açık mı? */
export function shopOpenStatus(type: ShopType | string, minutesIntoDay: number): ShopOpenStatus {
  const h = shopHoursFor(type);
  const hourNow = Math.floor(((minutesIntoDay % 1440) + 1440) % 1440 / 60);
  const open = hourNow >= h.open && hourNow < h.close;
  if (open) {
    const until = h.close === 24 ? 'gece yarısına' : toHour(h.close);
    return { open, label: `Açık · ${until} kadar` };
  }
  return { open, label: `Kapalı · ${atHour(h.open)} açılır` };
}
