/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Olağanüstü olay motoru. Gün kapanışında (haberler üretildikten hemen sonra) çalışır:
 * - Süresi dolan olayları kapatır.
 * - Gerekirse yeni olay başlatır (tohum + günden hesaplanır; motorun sayı üretecine dokunmaz).
 * - Yeni olayın borsa etkisini, sektör başına "SON DAKİKA" haberi olarak haber akışına ekler
 *   (normal haber mekanizmasıyla fiyatlara yansır, yavaşça söner).
 * - Toptancı fiyatı etkisini ticari olay (`WORLD_EVENT`) olarak ekler; dükkân müşteri etkisini
 *   `WorldEventEffects.worldEventShopDemandMultiplier` okur (ShopSales).
 */
import {
  makeCountryName,
  WORLD_EVENT_DAILY_CHANCE,
  WORLD_EVENT_DECAY,
  WORLD_EVENT_FIRST_DAY,
  WORLD_EVENT_MIN_GAP_DAYS,
  WORLD_EVENT_SHOP_DAYS,
  WORLD_EVENT_TEMPLATES,
} from '../data/worldEvents';
import type { NewsEvent } from '../models/news';
import type { SimulationState } from '../models/simulation';
import type { WorldEvent, WorldEventState } from '../models/worldEvents';

/** Tohum + gün + tuzdan 0..1 arası sabit sayı (xorshift). */
function wHash(seed: number, day: number, salt: number): number {
  let x = ((seed | 0) ^ Math.imul(day + 11, 2246822519) ^ Math.imul(salt + 3, 2654435761)) >>> 0;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  x = Math.imul(x ^ (x >>> 15), 3266489917) >>> 0;
  return x / 4294967296;
}

export function ensureWorldEventState(state: SimulationState): WorldEventState {
  if (!state.worldEvents) {
    state.worldEvents = { active: [], history: [], lastStartDay: -999 };
  }
  return state.worldEvents;
}

/** Belirli bir gün ve tohum için olay oluşturur (testler ve geliştirici aracı da kullanır). */
export function createWorldEvent(
  seed: number,
  day: number,
  kindIndex?: number
): WorldEvent {
  const idx =
    kindIndex ?? Math.floor(wHash(seed, day, 2) * WORLD_EVENT_TEMPLATES.length) % WORLD_EVENT_TEMPLATES.length;
  const tpl = WORLD_EVENT_TEMPLATES[idx];
  const a = makeCountryName(wHash(seed, day, 3), wHash(seed, day, 4), wHash(seed, day, 5));
  let b = makeCountryName(wHash(seed, day, 6), wHash(seed, day, 7), wHash(seed, day, 8));
  if (b === a) b = makeCountryName(wHash(seed, day, 9), wHash(seed, day, 10), 0.99);
  const fill = (t: string) => t.replaceAll('{A}', a).replaceAll('{B}', b);
  return {
    id: `WEV-D${day}-${tpl.kind}`,
    kind: tpl.kind,
    title: fill(tpl.title),
    body: fill(tpl.body),
    ...(tpl.needsCountries >= 1 ? { countryA: a } : {}),
    ...(tpl.needsCountries >= 2 ? { countryB: b } : {}),
    startDay: day,
    endDay: day + WORLD_EVENT_SHOP_DAYS - 1,
    sectorImpacts: { ...tpl.sectorImpacts },
    shopDemand: { ...tpl.shopDemand },
    supplierPriceMult: tpl.supplierPriceMult,
  };
}

/** Olayı oyuna uygular: haber akışına sektör haberleri, ticarete toptancı fiyat etkisi. */
export function applyWorldEvent(state: SimulationState, ev: WorldEvent): void {
  const ws = ensureWorldEventState(state);
  ws.active.push(ev);
  ws.history = [ev, ...ws.history].slice(0, 12);
  ws.lastStartDay = ev.startDay;

  const news: NewsEvent[] = Object.entries(ev.sectorImpacts).map(([sector, impact]) => ({
    id: `${ev.id}-${sector}`,
    day: ev.startDay,
    headline: `SON DAKİKA: ${ev.title}`,
    summary: ev.body,
    sector: sector as NewsEvent['sector'],
    initialImpact: impact as number,
    sentimentImpact: impact as number,
    expectedImpact: impact as number,
    decayRate: WORLD_EVENT_DECAY,
    worldEventId: ev.id,
  }));
  state.newsFeed = [...news, ...state.newsFeed].slice(0, 48);

  if (state.tradeState && ev.supplierPriceMult !== 1) {
    state.tradeState.activeTradeEvents.push({
      eventId: ev.id,
      eventType: 'WORLD_EVENT',
      titleTR: ev.title,
      descriptionTR: ev.body,
      affectedSector: 'ALL',
      priceImpactMultiplier: ev.supplierPriceMult,
      demandImpactMultiplier: 1,
      delayDaysAdded: 0,
      startDay: ev.startDay,
      endDay: ev.endDay,
      isActive: true,
    });
  }
}

/**
 * Gün kapanışı adımı. `day` yeni başlayan gündür. Yeni olay başlarsa onu döndürür.
 */
export function stepWorldEvents(state: SimulationState, day: number): WorldEvent | null {
  const ws = ensureWorldEventState(state);
  ws.active = ws.active.filter((e) => e.endDay >= day);
  if (ws.active.length > 0) return null;
  if (day < WORLD_EVENT_FIRST_DAY) return null;
  if (day - ws.lastStartDay < WORLD_EVENT_MIN_GAP_DAYS) return null;
  const seed = state.seed ?? 1;
  if (wHash(seed, day, 1) >= WORLD_EVENT_DAILY_CHANCE) return null;
  const ev = createWorldEvent(seed, day);
  applyWorldEvent(state, ev);
  return ev;
}
