/**
 * Şehir geçişi (Türkiye haritası, Faz 2): eski kayıtlardaki dükkânlara `cityId` kazandırır.
 *
 * Kurallar:
 * - Hiçbir işlem para, borç, stok, çalışan, müdür, yükseltme, geçmiş vb. alanlara dokunmaz;
 *   yalnızca `cityId` ve şehir alanları yazılır.
 * - `cityId` eksik ya da bilinmeyen dükkân varsa ve merkez şehir daha seçilmemişse durum `PENDING` olur;
 *   oyuncu merkez şehri seçene kadar oyun günü ve çevrimdışı ilerleme durur (`isCitySelectionPending`).
 * - Dükkânı olmayan eski kayıtta seçim gerekmez; durum doğrudan `COMPLETED` olur.
 * - Bütün fonksiyonlar tekrar çağrılabilir (idempotent): ikinci çağrı hiçbir şeyi değiştirmez.
 * - Bu dosya yalnızca modelleri ve verileri içe aktarır (motor ön yüzünü değil).
 */
import {
  CITY_FALLBACK_ID,
  CITY_MIGRATION_VERSION,
} from '../data/cityBalance';
import { isCityId } from '../data/cityDefinitions';
import type {
  CityId,
  CityMarkerState,
  CityMigrationState,
  CityPresenceStatus,
} from '../models/cities';
import type { SimulationState } from '../models/simulation';
import type { ShopInstance } from '../models/trade';

/** Şehri eksik (alan yok) ya da bozuk (bilinmeyen kimlik) dükkânlar. */
export function getShopsNeedingCity(state: SimulationState): ShopInstance[] {
  const shops = state.tradeState?.shops;
  if (!Array.isArray(shops)) return [];
  return shops.filter((s) => !isCityId(s?.cityId));
}

/** Oyuncu merkez şehri seçene kadar zaman ilerlemesi durmalıdır. */
export function isCitySelectionPending(state: SimulationState): boolean {
  return state.cityMigration?.status === 'PENDING';
}

function makeState(
  status: CityMigrationState['status'],
  assigned: number,
  repaired: number,
  completedAtISO?: string
): CityMigrationState {
  return {
    version: CITY_MIGRATION_VERSION,
    status,
    assignedShopCount: assigned,
    repairedShopCount: repaired,
    ...(completedAtISO ? { completedAtISO } : {}),
  };
}

function countBroken(shops: ShopInstance[]): number {
  // Alan hiç yoksa eski kayıttır (bozuk sayılmaz); alan var ama geçersizse (null, yanlış tip, bilinmeyen il) bozuktur.
  return shops.filter((s) => s.cityId !== undefined && !isCityId(s.cityId)).length;
}

/**
 * Yükleme sırasında bir kez değerlendirilir (tekrar çağrılması zararsızdır).
 * Dönüş: durum bu çağrıda değiştiyse true.
 */
export function prepareCityMigration(state: SimulationState): boolean {
  const missing = getShopsNeedingCity(state);
  const existing = state.cityMigration;

  // Seçim zaten bekliyor: dokunma (oyuncu ekranı kapatıp tekrar açtığında yine sorulur).
  if (existing?.status === 'PENDING') {
    if (missing.length > 0) return false;
    // Bekleyen dükkân kalmadıysa (ör. elle onarılmış kayıt) bekleme gereksizdir.
    state.cityMigration = makeState('COMPLETED', existing.assignedShopCount, existing.repairedShopCount);
    return true;
  }

  if (missing.length === 0) {
    if (existing) return false;
    // Dükkânı olmayan (ya da hepsi şehirli) kayıt: seçim ekranı gerekmez.
    state.cityMigration = makeState('COMPLETED', 0, 0);
    return true;
  }

  // Merkez şehir zaten geçerliyse (ör. şehri bozulmuş yeni kayıt) sormadan onar.
  if (isCityId(state.headquartersCityId)) {
    const hq = state.headquartersCityId;
    const repaired = countBroken(missing);
    for (const shop of missing) shop.cityId = hq;
    state.cityMigration = makeState(
      'COMPLETED',
      (existing?.assignedShopCount ?? 0) + missing.length,
      (existing?.repairedShopCount ?? 0) + repaired
    );
    return true;
  }

  state.cityMigration = makeState('PENDING', 0, countBroken(missing));
  return true;
}

export interface HeadquartersSelectionResult {
  success: boolean;
  message: string;
  assignedShopCount: number;
}

/**
 * Oyuncunun seçtiği şehri merkez yapar ve şehri eksik tüm dükkânları ona atar.
 * Yalnızca `PENDING` durumunda çalışır; ikinci çağrı hiçbir şeyi değiştirmez.
 * @param nowISO Zaman damgaları bu ana çekilir; böylece beklerken geçen süre çevrimdışı ilerleme olarak işlenmez.
 */
export function applyHeadquartersSelection(
  state: SimulationState,
  cityId: unknown,
  nowISO: string = new Date().toISOString()
): HeadquartersSelectionResult {
  if (!isCitySelectionPending(state)) {
    return {
      success: false,
      message: 'Merkez şehir seçimi zaten tamamlanmış ya da gerekmiyor.',
      assignedShopCount: 0,
    };
  }
  if (!isCityId(cityId)) {
    return { success: false, message: 'Geçersiz şehir.', assignedShopCount: 0 };
  }

  const missing = getShopsNeedingCity(state);
  for (const shop of missing) shop.cityId = cityId;

  const prev = state.cityMigration!;
  state.headquartersCityId = cityId;
  if (!isCityId(state.playerStartCityId)) state.playerStartCityId = cityId;
  if (!isCityId(state.selectedMapCityId)) state.selectedMapCityId = cityId;
  state.cityMigration = makeState(
    'COMPLETED',
    prev.assignedShopCount + missing.length,
    prev.repairedShopCount,
    nowISO
  );

  // Seçim beklerken geçen gerçek süre çevrimdışı kazanç sayılmasın.
  state.lastRealTimestampISO = nowISO;
  state.lastOfflineProcessedTimestampISO = nowISO;
  state.lastAutosaveTimestampISO = nowISO;

  return {
    success: true,
    message: `Merkez şehir seçildi; ${missing.length} dükkân bu şehre taşındı.`,
    assignedShopCount: missing.length,
  };
}

/** Yeni açılan dükkânın şehri: merkez → başlangıç şehri → Ankara (Faz 5/7 gerçek seçimi getirir). */
export function resolveNewShopCityId(state: SimulationState): CityId {
  if (isCityId(state.headquartersCityId)) return state.headquartersCityId;
  if (isCityId(state.playerStartCityId)) return state.playerStartCityId;
  return CITY_FALLBACK_ID;
}

/** Bir şehirdeki oyuncu varlığı; harita işaretinin rengi buradan türetilir (kayıtta tutulmaz). */
export function getCityPresence(
  state: SimulationState,
  cityId: CityId
): CityPresenceStatus {
  const shopCount = (state.tradeState?.shops ?? []).filter(
    (s) => s.cityId === cityId
  ).length;
  const isHeadquarters = state.headquartersCityId === cityId;
  const markerState: CityMarkerState = isHeadquarters
    ? 'HEADQUARTERS'
    : shopCount > 0
    ? 'OWNED'
    : 'EMPTY';
  return { cityId, shopCount, isHeadquarters, markerState };
}
