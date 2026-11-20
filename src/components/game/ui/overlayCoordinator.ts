/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pencere/panel koordinasyonu (plan Bölüm 4-H): rehber, çevrimdışı özet, bina paneli, ayarlar,
 * bildirim çekmecesi ve diğer pencereler aynı anda üst üste açılmaz. Saf kurallar burada;
 * TycoonGameView yalnızca bunları uygular.
 */
export type OverlayId =
  | 'guide'
  | 'settings'
  | 'notifications'
  | 'building'
  | 'richList'
  | 'lifestyle'
  | 'cityService'
  | 'prestige';

export const ALL_OVERLAYS: OverlayId[] = [
  'guide',
  'settings',
  'notifications',
  'building',
  'richList',
  'lifestyle',
  'cityService',
  'prestige',
];

/** Biri açılırken kapatılması gereken diğer pencereler. */
export function overlaysToClose(opening: OverlayId): OverlayId[] {
  return ALL_OVERLAYS.filter((o) => o !== opening);
}

export type OverlayFlags = Record<OverlayId, boolean>;

/** Herhangi bir pencere açık mı (geri tuşu ve duraklatma kararı için). */
export function anyOverlayOpen(flags: OverlayFlags): boolean {
  return ALL_OVERLAYS.some((o) => flags[o]);
}

/**
 * Açılış rehberinin giriş penceresi yalnızca başka hiçbir pencere açık değilken
 * (çevrimdışı özet dahil) gösterilir; aksi hâlde sıra bekler.
 */
export function welcomeGuideMayShow(flags: OverlayFlags, offlineModalOpen: boolean): boolean {
  return !offlineModalOpen && !anyOverlayOpen(flags);
}
