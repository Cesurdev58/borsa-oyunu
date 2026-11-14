/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Olağanüstü olayların dükkân müşterisine etkisi (yalnızca okur; bağımlılığı yok).
 */
import type { SimulationState } from '../models/simulation';

export function worldEventShopDemandMultiplier(state: SimulationState, shopType: string): number {
  const ws = state.worldEvents;
  if (!ws || ws.active.length === 0) return 1;
  let m = 1;
  for (const ev of ws.active) {
    if (state.day < ev.startDay || state.day > ev.endDay) continue;
    const v = (ev.shopDemand as Record<string, number | undefined>)[shopType];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) m *= v;
  }
  return m;
}
