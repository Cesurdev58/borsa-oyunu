/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Olağanüstü olaylar (savaş, salgın, faiz kararı, petrol krizi…): borsayı ve dükkânları birlikte etkiler.
 */
import type { SectorId } from './market';
import type { ShopType } from './trade';

export type WorldEventKind =
  | 'WAR'
  | 'PEACE'
  | 'PANDEMIC'
  | 'VACCINE'
  | 'RATE_CUT'
  | 'RATE_HIKE'
  | 'CYBER_ATTACK'
  | 'TECH_BREAKTHROUGH'
  | 'OIL_CRISIS'
  | 'OIL_GLUT';

export interface WorldEvent {
  id: string;
  kind: WorldEventKind;
  title: string;
  body: string;
  countryA?: string;
  countryB?: string;
  startDay: number;
  /** Dükkân ve toptancı etkisinin bittiği gün (borsa etkisi haber gibi yavaşça söner) */
  endDay: number;
  sectorImpacts: Partial<Record<SectorId | 'GENEL', number>>;
  shopDemand: Partial<Record<ShopType, number>>;
  supplierPriceMult: number;
}

export interface WorldEventState {
  active: WorldEvent[];
  /** Son olaylar (yeniden eskiye, en çok 12) */
  history: WorldEvent[];
  lastStartDay: number;
}
