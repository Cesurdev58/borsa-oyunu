/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * İLK DÜKKÂN KAPISI (FirstShopGate)
 * İlk dükkân, oyuncu borsanın temelini öğrenince açılır: bir hisse al, ikinci bir sektörden hisse al,
 * bir hisse sat. Eskiden kapı "net değer 120.000 TL" idi ve oyunun ilk 30–40 gerçek saatini bekletiyordu.
 * Net değeri FIRST_SHOP_MIN_NET_WORTH'u geçen oyuncu (testler, çok parayla başlayan oyun) görev yapmadan geçer.
 * Bir kez dükkân açılınca ya da şirket kurulunca kapı hep açıktır.
 * Yalnızca modelleri ve denge sabitlerini içe aktarır (döngü oluşmaz).
 */
import { FIRST_SHOP_MIN_NET_WORTH } from '../data/gameBalance';
import type { SimulationState } from '../models/simulation';

export interface FirstShopGateStep {
  id: 'buy' | 'two-sectors' | 'sell';
  label: string;
  done: boolean;
}

export interface FirstShopGateStatus {
  open: boolean;
  steps: FirstShopGateStep[];
  doneCount: number;
  /** 0–100 */
  pct: number;
}

type GateInput = Pick<SimulationState, 'transactions' | 'stocks' | 'netWorth' | 'playerCompany'> &
  Partial<Pick<SimulationState, 'tradeState'>>;

export function firstShopGateStatus(state: GateInput): FirstShopGateStatus {
  const sectorOf = new Map(state.stocks.map((s) => [s.ticker, s.sector] as const));
  const boughtSectors = new Set<string>();
  let bought = false;
  let sold = false;
  for (const t of state.transactions ?? []) {
    if (t.type === 'BUY') {
      bought = true;
      const sec = t.ticker ? sectorOf.get(t.ticker) : undefined;
      if (sec) boughtSectors.add(sec);
    } else if (t.type === 'SELL') {
      sold = true;
    }
  }
  const steps: FirstShopGateStep[] = [
    { id: 'buy', label: 'Borsadan bir hisse al', done: bought },
    { id: 'two-sectors', label: 'Başka bir sektörden de hisse al', done: boughtSectors.size >= 2 },
    { id: 'sell', label: 'Bir hisseni sat', done: sold },
  ];
  const alreadyPast =
    (state.tradeState?.shops.length ?? 0) > 0 ||
    state.playerCompany !== null ||
    state.netWorth >= FIRST_SHOP_MIN_NET_WORTH;
  const doneCount = steps.filter((s) => s.done).length;
  const open = alreadyPast || doneCount === steps.length;
  if (alreadyPast) for (const s of steps) s.done = true;
  const finalDone = alreadyPast ? steps.length : doneCount;
  return { open, steps, doneCount: finalDone, pct: Math.round((finalDone / steps.length) * 100) };
}
