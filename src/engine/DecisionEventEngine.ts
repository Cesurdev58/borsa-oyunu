/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * KARAR KARTLARI
 * - Gün kapanışında, en az 2 günde bir ve yaklaşık %50 olasılıkla oyuncunun önüne iki seçenekli
 *   küçük bir olay çıkar ("Mahallede festival var, stant kuralım mı?").
 * - Olay seçimi rastgele görünür ama kaydın tohumu (seed) ve günden türetilir: aynı kayıt aynı olayları üretir,
 *   motorun asıl sayı üretecine (rng) dokunulmaz; borsa ve dükkân simülasyonu değişmez.
 * - Tutarlar oyuncunun büyüklüğüne göre ölçeklenir (dükkânın günlük cirosu ya da net varlık).
 * - Para hareketleri WalletEngine + merkezi defter kaydıyla yapılır (tek cüzdan kuralı).
 * - Eski kayıtlarda alan yoktur; `ensureDecisionState` gerektiğinde oluşturur.
 */

import type { SimulationState } from '../models/simulation';
import type {
  DecisionChoice,
  DecisionEffect,
  DecisionEventsState,
  PendingDecision,
} from '../models/decisions';
import type { ShopInstance } from '../models/trade';
import { WalletEngine } from './WalletEngine';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';

/** İki olay arasında en az kaç gün geçer */
export const DECISION_MIN_GAP_DAYS = 2;
/** Uygun günde olay çıkma olasılığı */
export const DECISION_CHANCE = 0.5;
/** Kart kaç gün açık kalır; sonra kendiliğinden "geçildi" sayılır */
export const DECISION_LIFETIME_DAYS = 2;
/** İlk olay en erken bu günde çıkar (ilk gün rehber var) */
export const DECISION_FIRST_DAY = 3;

/** Tohum + gün + tuzdan 0..1 arası sabit sayı üretir (xorshift). */
export function decisionHash(seed: number, day: number, salt: number): number {
  let x = ((seed | 0) ^ Math.imul(day + 1, 2654435761) ^ Math.imul(salt + 7, 40503)) >>> 0;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  return x / 4294967296;
}

function round100(v: number): number {
  return Math.max(100, Math.round(v / 100) * 100);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function tl(v: number): string {
  return `₺${Math.round(Math.abs(v)).toLocaleString('tr-TR')}`;
}

export function ensureDecisionState(state: SimulationState): DecisionEventsState {
  const cur = state.decisionEvents;
  if (!cur || typeof cur !== 'object') {
    state.decisionEvents = { pending: null, lastEventDay: 0, history: [], scheduledPayouts: [] };
    return state.decisionEvents;
  }
  if (!Array.isArray(cur.history)) cur.history = [];
  if (!Array.isArray(cur.scheduledPayouts)) cur.scheduledPayouts = [];
  if (typeof cur.lastEventDay !== 'number') cur.lastEventDay = 0;
  if (cur.pending === undefined) cur.pending = null;
  return cur;
}

// ---------------------------------------------------------------------------
// Olay şablonları
// ---------------------------------------------------------------------------

interface TemplateContext {
  state: SimulationState;
  shop: ShopInstance | null;
  /** Dükkân olayları için ölçek (günlük cironun ~%30'u) */
  S: number;
  /** Kişisel olaylar için ölçek (net varlığın ~%2'si) */
  P: number;
}

interface DecisionTemplate {
  id: string;
  needsShop: boolean;
  build: (ctx: TemplateContext) => Omit<PendingDecision, 'eventId' | 'templateId' | 'day' | 'expiresDay' | 'shopId'>;
}

function hint(effects: DecisionEffect[]): string {
  const parts: string[] = [];
  for (const e of effects) {
    if (e.kind === 'CASH') parts.push(`${e.amount >= 0 ? '+' : '−'}${tl(e.amount)}`);
    if (e.kind === 'SATISFACTION') parts.push(`Memnuniyet ${e.delta >= 0 ? '+' : '−'}${Math.abs(e.delta)}`);
    if (e.kind === 'DEMAND_BOOST') {
      const pct = Math.round((e.multiplier - 1) * 100);
      parts.push(`${e.days} gün ${pct >= 0 ? '+' : '−'}%${Math.abs(pct)} müşteri`);
    }
    if (e.kind === 'DELAYED_CASH') {
      const chance = e.chancePct >= 100 ? '' : ` (%${e.chancePct} şans)`;
      parts.push(`${e.inDays} gün sonra ${e.amount >= 0 ? '+' : '−'}${tl(e.amount)}${chance}`);
    }
  }
  return parts.length ? parts.join(' · ') : 'Bir şey değişmez';
}

function choice(id: 'A' | 'B', labelTR: string, effects: DecisionEffect[]): DecisionChoice {
  return { id, labelTR, effects, hintTR: hint(effects) };
}

export const DECISION_TEMPLATES: DecisionTemplate[] = [
  {
    id: 'festival',
    needsShop: true,
    build: ({ shop, S }) => ({
      emoji: '🎪',
      titleTR: 'Mahallede festival var',
      bodyTR: `${shop!.nameTR} önüne bir stant kurarsan birkaç gün kalabalık gelir.`,
      choices: [
        choice('A', 'Stant kur', [{ kind: 'CASH', amount: -S }, { kind: 'DEMAND_BOOST', multiplier: 1.25, days: 4 }]),
        choice('B', 'Bu sefer geç', []),
      ],
    }),
  },
  {
    id: 'bad-review',
    needsShop: true,
    build: ({ shop, S }) => ({
      emoji: '📱',
      titleTR: 'Kötü bir yorum geldi',
      bodyTR: `Bir müşteri ${shop!.nameTR} için internete kötü yorum yazdı.`,
      choices: [
        choice('A', 'Özür dile, kupon ver', [{ kind: 'CASH', amount: -round100(S * 0.6) }, { kind: 'SATISFACTION', delta: 8 }]),
        choice('B', 'Görmezden gel', [{ kind: 'SATISFACTION', delta: -6 }]),
      ],
    }),
  },
  {
    id: 'staff-raise',
    needsShop: true,
    build: ({ shop, S }) => ({
      emoji: '🙋',
      titleTR: 'Çalışanın zam istiyor',
      bodyTR: `${shop!.nameTR} çalışanları biraz daha maaş istiyor.`,
      choices: [
        choice('A', 'Prim ver', [
          { kind: 'CASH', amount: -round100(S * 0.5) },
          { kind: 'SATISFACTION', delta: 4 },
          { kind: 'DEMAND_BOOST', multiplier: 1.08, days: 5 },
        ]),
        choice('B', 'Şimdilik hayır', [
          { kind: 'SATISFACTION', delta: -3 },
          { kind: 'DEMAND_BOOST', multiplier: 0.92, days: 3 },
        ]),
      ],
    }),
  },
  {
    id: 'inspection',
    needsShop: true,
    build: ({ shop, S }) => ({
      emoji: '📋',
      titleTR: 'Belediye denetimi',
      bodyTR: `Denetçi ${shop!.nameTR} için küçük eksikler buldu.`,
      choices: [
        choice('A', 'Hemen düzelt', [{ kind: 'CASH', amount: -round100(S * 0.8) }]),
        choice('B', 'Riske gir', [{ kind: 'DELAYED_CASH', amount: -round100(S * 2), inDays: 1, chancePct: 50 }]),
      ],
    }),
  },
  {
    id: 'pipe-burst',
    needsShop: true,
    build: ({ shop, S }) => ({
      emoji: '🔧',
      titleTR: 'Su borusu patladı',
      bodyTR: `${shop!.nameTR} içinde su sızıyor, müşteriler rahatsız.`,
      choices: [
        choice('A', 'Usta çağır', [{ kind: 'CASH', amount: -S }]),
        choice('B', 'Kendin uğraş', [{ kind: 'DEMAND_BOOST', multiplier: 0.6, days: 2 }]),
      ],
    }),
  },
  {
    id: 'newspaper',
    needsShop: true,
    build: ({ shop }) => ({
      emoji: '📰',
      titleTR: 'Gazete röportaj istiyor',
      bodyTR: `Yerel gazete ${shop!.nameTR} hakkında yazı yazmak istiyor.`,
      choices: [
        choice('A', 'Röportaj ver', [{ kind: 'DEMAND_BOOST', multiplier: 1.15, days: 5 }, { kind: 'SATISFACTION', delta: 2 }]),
        choice('B', 'Vaktim yok', []),
      ],
    }),
  },
  {
    id: 'bulk-order',
    needsShop: true,
    build: ({ shop, S }) => ({
      emoji: '🏫',
      titleTR: 'Toplu sipariş teklifi',
      bodyTR: `Yakındaki bir okul ${shop!.nameTR}'dan toplu alışveriş yapmak istiyor ama raflar zorlanacak.`,
      choices: [
        choice('A', 'Kabul et', [{ kind: 'CASH', amount: round100(S * 1.2) }, { kind: 'SATISFACTION', delta: -3 }]),
        choice('B', 'Kibarca reddet', []),
      ],
    }),
  },
  {
    id: 'cousin-partner',
    needsShop: false,
    build: ({ P }) => ({
      emoji: '🤝',
      titleTR: 'Kuzenin ortaklık teklif ediyor',
      bodyTR: 'Kuzenin küçük bir işe ortak olmanı istiyor. Çoğu zaman kazandırır ama garanti yok.',
      choices: [
        choice('A', 'Ortak ol', [
          { kind: 'CASH', amount: -P },
          { kind: 'DELAYED_CASH', amount: round100(P * 1.35), inDays: 6, chancePct: 75 },
        ]),
        choice('B', 'Kalsın', []),
      ],
    }),
  },
  {
    id: 'old-debt',
    needsShop: false,
    build: ({ P }) => ({
      emoji: '💌',
      titleTR: 'Eski bir borç geri geldi',
      bodyTR: 'Yıllar önce borç verdiğin arkadaşın ödemek istiyor. Hemen mi alırsın, faiziyle sonra mı?',
      choices: [
        choice('A', 'Hemen al', [{ kind: 'CASH', amount: round100(P * 0.4) }]),
        choice('B', 'Faiziyle sonra', [{ kind: 'DELAYED_CASH', amount: round100(P * 0.6), inDays: 5, chancePct: 100 }]),
      ],
    }),
  },
];

// ---------------------------------------------------------------------------
// Para hareketi (tek cüzdan + defter)
// ---------------------------------------------------------------------------

function spendableCash(state: SimulationState, reservedCash: number): number {
  return Math.max(0, (state.investmentCash ?? state.cash) - reservedCash);
}

function moveCash(state: SimulationState, amount: number, key: string, descTR: string, reservedCash: number) {
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.01) return;
  if (amount > 0) {
    WalletEngine.earn(state, amount);
    CentralLedgerEngine.recordPostedAccountingEntry(state, {
      idempotencyKey: key,
      sourceAccountId: ACCOUNT_IDS.OPERATING_REVENUE,
      destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      amount,
      category: 'OPERATING_REVENUE_RECEIPT',
      description: descTR,
      reservedOrderCash: reservedCash,
    });
  } else {
    const pay = Math.min(-amount, spendableCash(state, reservedCash));
    if (pay <= 0) return;
    WalletEngine.spend(state, pay);
    CentralLedgerEngine.recordPostedAccountingEntry(state, {
      idempotencyKey: key,
      sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      destinationAccountId: ACCOUNT_IDS.OPERATING_EXPENSE,
      amount: pay,
      category: 'OPERATING_EXPENSE_PAYMENT',
      description: descTR,
      reservedOrderCash: reservedCash,
    });
  }
}

// ---------------------------------------------------------------------------
// Gün kapanışı ve karar verme
// ---------------------------------------------------------------------------

function pickShop(state: SimulationState, salt: number): ShopInstance | null {
  const shops = state.tradeState?.shops ?? [];
  if (shops.length === 0) return null;
  const idx = Math.floor(decisionHash(state.seed ?? 1, state.day, salt) * shops.length);
  return shops[Math.min(shops.length - 1, idx)];
}

function scales(state: SimulationState, shop: ShopInstance | null): { S: number; P: number } {
  const base = shop ? (shop.todaySalesRevenue > 0 ? shop.todaySalesRevenue : shop.dailyRent * 3) : 0;
  const S = round100(clamp(base * 0.3, 800, 30_000));
  const P = round100(clamp((state.netWorth || state.cash) * 0.02, 1_000, 40_000));
  return { S, P };
}

/**
 * Gün kapanışında çağrılır. Bildirim olarak gösterilecek kısa mesajları döndürür.
 */
export function onDayClosed(state: SimulationState, reservedCash: number): string[] {
  const ds = ensureDecisionState(state);
  const messages: string[] = [];
  const day = state.day;

  // 1. Zamanı gelen ertelenmiş ödemeler
  const due = ds.scheduledPayouts.filter((p) => p.payDay <= day);
  ds.scheduledPayouts = ds.scheduledPayouts.filter((p) => p.payDay > day);
  for (const p of due) {
    if (p.willPay) {
      moveCash(state, p.amount, `DEC-PAY-${p.id}`, p.labelTR, reservedCash);
      messages.push(
        p.amount >= 0
          ? `${p.labelTR}: ${tl(p.amount)} hesabına geçti.`
          : `${p.labelTR}: ${tl(p.amount)} ödedin.`
      );
    } else {
      messages.push(p.amount >= 0 ? `${p.labelTR}: maalesef para gelmedi.` : `${p.labelTR}: şanslıydın, bir şey ödemedin.`);
    }
  }

  // 2. Süresi geçen kart: karar verilmezse ikinci (pasif) seçenek kendiliğinden uygulanır.
  //    Böylece günleri hızlı ilerletmek kötü olaylardan kaçmanın yolu olmaz.
  if (ds.pending && day > ds.pending.expiresDay) {
    const pending = ds.pending;
    const fallback = pending.choices.find((c) => c.id === 'B');
    let resultTR = 'Karar verilmedi';
    if (fallback && fallback.effects.length > 0) {
      const applied = applyEffects(state, pending, fallback, reservedCash);
      resultTR = `Karar verilmedi, "${fallback.labelTR}" sayıldı${applied ? `: ${applied}` : ''}`;
      messages.push(`${pending.titleTR}: ${resultTR}`);
    }
    ds.history.push({
      eventId: pending.eventId,
      templateId: pending.templateId,
      day,
      choiceId: 'EXPIRED',
      resultTR,
    });
    ds.pending = null;
  }

  // 3. Yeni kart
  if (!ds.pending && day >= DECISION_FIRST_DAY && day - ds.lastEventDay >= DECISION_MIN_GAP_DAYS) {
    const seed = state.seed ?? 1;
    if (decisionHash(seed, day, 1) < DECISION_CHANCE) {
      const hasShop = (state.tradeState?.shops.length ?? 0) > 0;
      const recent = new Set(ds.history.slice(-3).map((h) => h.templateId));
      const pool = DECISION_TEMPLATES.filter((t) => (!t.needsShop || hasShop) && !recent.has(t.id));
      const list = pool.length ? pool : DECISION_TEMPLATES.filter((t) => !t.needsShop || hasShop);
      if (list.length) {
        const tpl = list[Math.floor(decisionHash(seed, day, 2) * list.length) % list.length];
        const shop = tpl.needsShop ? pickShop(state, 3) : null;
        const { S, P } = scales(state, shop);
        const built = tpl.build({ state, shop, S, P });
        ds.pending = {
          ...built,
          eventId: `DEC-D${day}-${tpl.id}`,
          templateId: tpl.id,
          day,
          expiresDay: day + DECISION_LIFETIME_DAYS,
          shopId: shop?.shopId,
        };
        ds.snoozed = false;
        ds.lastEventDay = day;
      }
    }
  }

  if (ds.history.length > 40) ds.history = ds.history.slice(-40);
  return messages;
}

/** Bir seçeneğin parası yetiyor mu? (yalnızca şimdi ödenecek tutar) */
export function canAffordChoice(state: SimulationState, choiceDef: DecisionChoice, reservedCash: number): boolean {
  const cost = choiceDef.effects
    .filter((e): e is Extract<DecisionEffect, { kind: 'CASH' }> => e.kind === 'CASH' && e.amount < 0)
    .reduce((a, e) => a + -e.amount, 0);
  return cost <= spendableCash(state, reservedCash) + 0.01;
}

function applyEffects(
  state: SimulationState,
  pending: PendingDecision,
  ch: DecisionChoice,
  reservedCash: number
): string {
  const ds = ensureDecisionState(state);
  const shop = pending.shopId ? state.tradeState?.shops.find((s) => s.shopId === pending.shopId) ?? null : null;
  ch.effects.forEach((e, i) => {
    if (e.kind === 'CASH') {
      moveCash(state, e.amount, `DEC-${pending.eventId}-${ch.id}-${i}`, `Karar: ${pending.titleTR}`, reservedCash);
    } else if (e.kind === 'SATISFACTION' && shop) {
      shop.customerSatisfaction = Number(clamp(shop.customerSatisfaction + e.delta, 0, 100).toFixed(1));
    } else if (e.kind === 'DEMAND_BOOST' && shop) {
      shop.demandBoost = { multiplier: e.multiplier, untilDay: state.day + e.days };
    } else if (e.kind === 'DELAYED_CASH') {
      const willPay = e.chancePct >= 100 || decisionHash(state.seed ?? 1, pending.day, 50 + i) * 100 < e.chancePct;
      ds.scheduledPayouts.push({
        id: `${pending.eventId}-${ch.id}-${i}`,
        payDay: state.day + e.inDays,
        amount: e.amount,
        willPay,
        labelTR: pending.titleTR,
      });
    }
  });
  return ch.hintTR;
}

export function resolveDecision(
  state: SimulationState,
  choiceId: 'A' | 'B',
  reservedCash: number
): { success: boolean; message: string } {
  const ds = ensureDecisionState(state);
  const pending = ds.pending;
  if (!pending) return { success: false, message: 'Bekleyen bir karar yok.' };
  const ch = pending.choices.find((c) => c.id === choiceId);
  if (!ch) return { success: false, message: 'Geçersiz seçim.' };
  if (!canAffordChoice(state, ch, reservedCash)) {
    return { success: false, message: 'Bunun için yeterli paran yok.' };
  }
  applyEffects(state, pending, ch, reservedCash);

  ds.history.push({
    eventId: pending.eventId,
    templateId: pending.templateId,
    day: state.day,
    choiceId,
    resultTR: `${ch.labelTR} · ${ch.hintTR}`,
  });
  ds.pending = null;
  ds.snoozed = false;
  return { success: true, message: `${ch.labelTR}: ${ch.hintTR}` };
}
