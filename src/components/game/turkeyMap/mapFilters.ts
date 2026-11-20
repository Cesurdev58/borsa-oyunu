/**
 * Harita filtreleri (Faz 10) — saf kurallar, arayüzden bağımsız.
 *
 * Filtre YALNIZCA görünümü etkiler (eşleşmeyen şehir soluk çizilir, yine de dokunulabilir):
 * kamera (`state.turkeyMapView`) ve seçili şehir (`state.selectedMapCityId`) hiç değişmez.
 * Hiçbir filtre sahte veri üretmez; hepsi oyun durumundan türetilir.
 */
import type { CityId } from '../../../models/cities';
import type { SimulationState } from '../../../models/simulation';
import { isCityId } from '../../../data/cityDefinitions';
import { cityHasIssue } from '../../../engine/CityOpeningQuote';

export type MapFilterId = 'ALL' | 'SHOPS' | 'FACTORIES' | 'WAREHOUSES' | 'HQ' | 'ISSUES';

export const MAP_FILTERS: ReadonlyArray<{ id: MapFilterId; labelTR: string }> = [
  { id: 'ALL', labelTR: 'Tüm şehirler' },
  { id: 'SHOPS', labelTR: 'Mağazalarım' },
  { id: 'FACTORIES', labelTR: 'Fabrikalarım' },
  { id: 'WAREHOUSES', labelTR: 'Depolarım' },
  { id: 'HQ', labelTR: 'Merkezim' },
  { id: 'ISSUES', labelTR: 'Sorunlu işletmeler' },
];

export const DEFAULT_MAP_FILTER: MapFilterId = 'ALL';

/**
 * Oyuncunun şirketinin fabrikası şirket merkezinin şehrindedir: oyunda fabrikaya ayrı şehir verisi yoktur,
 * bu yüzden başka şehre fabrika çizilmez. Şirket yoksa ya da üretim kapasitesi sıfırsa fabrika yok sayılır.
 */
export function factoryCityIds(state: SimulationState): CityId[] {
  const hq = state.headquartersCityId;
  const c = state.playerCompany;
  if (!c || !(c.productionCapacity > 0) || !isCityId(hq)) return [];
  return [hq];
}

/** Depolar: `cityId`'si olan depo kendi şehrinde; `cityId`'si olmayan depo merkez depodur (merkez şehirde). */
export function warehouseCityIds(state: SimulationState): CityId[] {
  const hq = state.headquartersCityId;
  const out = new Set<CityId>();
  for (const w of state.tradeState?.warehouses ?? []) {
    if (isCityId(w.cityId)) out.add(w.cityId);
    else if (isCityId(hq)) out.add(hq);
  }
  return [...out];
}

export function shopCityIds(state: SimulationState): CityId[] {
  const out = new Set<CityId>();
  for (const s of state.tradeState?.shops ?? []) if (isCityId(s.cityId)) out.add(s.cityId);
  return [...out];
}

export function cityMatchesFilter(state: SimulationState, cityId: CityId, filter: MapFilterId): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'SHOPS':
      return shopCityIds(state).includes(cityId);
    case 'FACTORIES':
      return factoryCityIds(state).includes(cityId);
    case 'WAREHOUSES':
      return warehouseCityIds(state).includes(cityId);
    case 'HQ':
      return state.headquartersCityId === cityId;
    case 'ISSUES':
      return cityHasIssue(state, cityId);
    default:
      return true;
  }
}

/** Her filtrede kaç şehir eşleşiyor (düğmelerdeki sayı rozeti). */
export function mapFilterCounts(state: SimulationState, cityIds: readonly CityId[]): Record<MapFilterId, number> {
  const counts = {} as Record<MapFilterId, number>;
  for (const f of MAP_FILTERS) counts[f.id] = cityIds.filter((id) => cityMatchesFilter(state, id, f.id)).length;
  return counts;
}
