/**
 * Özellik bayrakları (Faz 11).
 *
 * `turkeyMapEnabled`: Şehir sekmesi doğrudan Türkiye haritasını açar. Varsayılan AÇIK.
 * Acil durum çıkışı: tarayıcıda `localStorage.turkey_map_enabled = 'false'` yapılırsa bir sürüm daha
 * eski 3D şehir açılır. Harita çökerse ya da oyuncu 3D'ye dönerse sayaç artar (`turkey_map_fallback_count`),
 * hata konsola yazılır (sunucu/telemetri yok; sayaç yalnızca bu tarayıcıda durur).
 */
export const TURKEY_MAP_ENABLED_DEFAULT = true;
export const TURKEY_MAP_FLAG_KEY = 'turkey_map_enabled';
export const TURKEY_MAP_FALLBACK_COUNT_KEY = 'turkey_map_fallback_count';

function readStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Bayrak: açıkça 'false' yazılmadıkça açık (sunucu tarafında/testte de varsayılan değer). */
export function isTurkeyMapEnabled(): boolean {
  const v = readStorage(TURKEY_MAP_FLAG_KEY);
  if (v === 'false') return false;
  if (v === 'true') return true;
  return TURKEY_MAP_ENABLED_DEFAULT;
}

export function getMapFallbackCount(): number {
  const n = Number(readStorage(TURKEY_MAP_FALLBACK_COUNT_KEY));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Haritadan 3D'ye düşüşü sayar; hata varsa konsola da yazar. */
export function recordMapFallback(reason: 'error' | 'player-exit', error?: unknown): number {
  const next = getMapFallbackCount() + 1;
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(TURKEY_MAP_FALLBACK_COUNT_KEY, String(next));
  } catch {
    /* yok say */
  }
  if (reason === 'error') console.error('[Türkiye haritası] hata, 3D şehre dönüldü', error);
  return next;
}
