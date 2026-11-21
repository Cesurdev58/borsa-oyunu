/**
 * Dükkân ve Şirket sekmelerindeki "şehir seçici" için saf kurallar (oyun durumunu değiştirmez).
 * Şehri olmayan eski dükkân merkez şehirde sayılır (engine/CityMigration.resolveNewShopCityId).
 */
import { getCityDefinition, isCityId } from '../../../data/cityDefinitions';
import { resolveNewShopCityId } from '../../../engine/CityMigration';
import type { CityId } from '../../../models/cities';
import type { SimulationState } from '../../../models/simulation';
import type { ShopInstance } from '../../../models/trade';

export interface PlayerCityEntry {
  cityId: CityId;
  nameTR: string;
  /** Kişisel dükkân sayısı (şirket şubeleri hariç). */
  shopCount: number;
  /** Şirket şubesi sayısı. */
  branchCount: number;
  isHeadquarters: boolean;
}

export function shopCityOf(state: SimulationState, shop: Pick<ShopInstance, 'cityId'>): CityId {
  return isCityId(shop.cityId) ? shop.cityId : resolveNewShopCityId(state);
}

/** Oyuncunun gösterilecek şehri: geçerli seçim varsa o, yoksa merkez (ya da başlangıç) şehri. */
export function resolveViewCity(state: SimulationState, preferred?: CityId | null): CityId {
  return isCityId(preferred) ? preferred : resolveNewShopCityId(state);
}

/** Oyuncunun varlığı olan şehirler (dükkân, şube, merkez) + gösterilen şehir. Merkez önce, sonra ada göre. */
export function listPlayerCities(state: SimulationState, current?: CityId | null): PlayerCityEntry[] {
  const map = new Map<CityId, PlayerCityEntry>();
  const entry = (id: CityId): PlayerCityEntry => {
    let e = map.get(id);
    if (!e) {
      e = { cityId: id, nameTR: getCityDefinition(id).nameTR, shopCount: 0, branchCount: 0, isHeadquarters: false };
      map.set(id, e);
    }
    return e;
  };
  for (const shop of state.tradeState?.shops ?? []) {
    const e = entry(shopCityOf(state, shop));
    if (shop.isCompanyBranch) e.branchCount += 1;
    else e.shopCount += 1;
  }
  const hq = isCityId(state.headquartersCityId) ? state.headquartersCityId : resolveNewShopCityId(state);
  entry(hq).isHeadquarters = true;
  if (isCityId(current)) entry(current);
  return [...map.values()].sort(
    (a, b) => Number(b.isHeadquarters) - Number(a.isHeadquarters) || a.nameTR.localeCompare(b.nameTR, 'tr')
  );
}

/** Seçili şehirdeki kişisel dükkânlar. */
export function personalShopsInCity(state: SimulationState, cityId: CityId): ShopInstance[] {
  return (state.tradeState?.shops ?? []).filter((s) => !s.isCompanyBranch && shopCityOf(state, s) === cityId);
}

/** Seçili şehirdeki şirket şubeleri. */
export function companyBranchesInCity(state: SimulationState, cityId: CityId): ShopInstance[] {
  return (state.tradeState?.shops ?? []).filter((s) => s.isCompanyBranch && shopCityOf(state, s) === cityId);
}

/** Şirketin genel merkezi bu şehirde mi? (Şirketin ayrı şehir verisi yok; merkez şehir = oyuncunun merkezi.) */
export function isCompanyHeadquartersCity(state: SimulationState, cityId: CityId): boolean {
  return state.playerCompany !== null && resolveNewShopCityId(state) === cityId;
}
