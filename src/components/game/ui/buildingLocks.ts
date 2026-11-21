/**
 * Bina panellerinin açılma kuralı (eskiden klasik şehir görünümünden türetiliyordu).
 * Kilitli bina paneli açılmaz; rehber ve hedef şeridi düğmeleri de bu kurala uyar.
 */
import type { SimulationState } from '../../../models/simulation';
import type { CityBuildingId } from '../gameTypes';

export function isBuildingUnlocked(state: SimulationState, id: CityBuildingId): boolean {
  const hasCompany = state.playerCompany !== null;
  switch (id) {
    case 'SIRKET_MERKEZI':
      return state.stageUnlocks.stage2Entrepreneur || hasCompany;
    case 'FABRIKA':
    case 'ARGE_MERKEZI':
      return hasCompany;
    case 'HOLDING_MERKEZI':
      return state.stageUnlocks.stage4Holding;
    default:
      return true;
  }
}
