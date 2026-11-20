/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BAŞARIMLAR VE HAFTALIK HEDEFLER
 * - 18 tek seferlik başarım: her gün kapanışında mevcut sistemlerden (dükkân, kredi, şirket, borsa, prestij)
 *   okunur; bazıları için küçük sayaçlar tutulur (`counters`). Ödül para DEĞİLDİR: eğitim bileti,
 *   dekorasyon parçası ya da prestij puanı.
 * - Her 7 oyun gününde (hafta = floor((gün−1)/7)) tohum + haftadan 3 rastgele hedef seçilir; biter bitmez
 *   ödül otomatik verilir. Seçim motorun sayı üretecine dokunmaz (aynı kayıt aynı hedefleri üretir).
 * Kayıtta `state.achievements` (eski kayıtta yok = boş). Ödül alanları: `trainingTickets`, `decorations`, prestij puanı.
 * Yalnızca modeller ve PrestigeEngine'i içe aktarır.
 */
import type { SimulationState } from '../models/simulation';
import { SimulationStage } from '../models/simulation';
import { addPrestigePoints, getPrestige } from './PrestigeEngine';

export type RewardKind = 'TICKET' | 'DECOR' | 'POINT';
export interface Reward {
  kind: RewardKind;
  amount: number;
}

export interface AchievementCounters {
  /** Dükkân varken üst üste zarar etmeden geçen gün */
  noLossStreak: number;
  bestNoLossStreak: number;
  /** Aynı anda en çok kaç kişisel dükkân işletildi */
  maxShops: number;
  /** Toplam hizmet verilen müşteri */
  customers: number;
  /** Kârlı geçen gün sayısı */
  profitDays: number;
}

export interface WeeklyGoal {
  id: string;
  title: string;
  target: number;
  progress: number;
  done: boolean;
  reward: Reward;
  /** İlerleme gün sayısı mı (adet), para mı, yüzde mi: arayüz yazısı için */
  unit: 'gün' | '₺' | 'müşteri' | '%';
}

export interface WeeklyState {
  week: number;
  goals: WeeklyGoal[];
  /** Hafta başı net varlık (artış hedefi için) */
  startNetWorth: number;
  /** Tamamlanan toplam haftalık hedef */
  totalDone: number;
}

export interface AchievementsState {
  /** Başarım kimliği → açıldığı gün */
  unlocked: Record<string, number>;
  counters: AchievementCounters;
  weekly?: WeeklyState;
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  reward: Reward;
  check: (s: SimulationState, c: AchievementCounters) => boolean;
}

const personalShops = (s: SimulationState) => (s.tradeState?.shops ?? []).filter((x) => !x.isCompanyBranch);
const heldStocks = (s: SimulationState) => Object.values(s.portfolio ?? {}).filter((p) => p.shares > 0).length;

export const ACHIEVEMENTS: ReadonlyArray<AchievementDef> = [
  { id: 'first-profit', title: 'İlk kâr günü', desc: 'Dükkânlarınla bir günü kârla kapat.', reward: { kind: 'TICKET', amount: 1 }, check: (_s, c) => c.profitDays >= 1 },
  { id: 'streak-30', title: '30 gün zarar yok', desc: '30 gün üst üste zarar etmeden çalış.', reward: { kind: 'POINT', amount: 1 }, check: (_s, c) => c.bestNoLossStreak >= 30 },
  { id: 'three-shops', title: 'Üç dükkân birden', desc: 'Aynı anda 3 dükkân işlet.', reward: { kind: 'DECOR', amount: 1 }, check: (_s, c) => c.maxShops >= 3 },
  { id: 'five-shops', title: 'Esnaf imparatoru', desc: 'Aynı anda 5 dükkân işlet.', reward: { kind: 'POINT', amount: 1 }, check: (_s, c) => c.maxShops >= 5 },
  {
    id: 'loan-clean',
    title: 'Dürüst borçlu',
    desc: 'Bir krediyi hiç geciktirmeden kapat.',
    reward: { kind: 'TICKET', amount: 1 },
    check: (s) => (s.activeLoans ?? []).some((l) => l.status === 'PAID_OFF' && l.missedPaymentCount === 0),
  },
  { id: 'nw-1m', title: 'İlk milyon', desc: 'Toplam varlığın 1 milyon ₺ olsun.', reward: { kind: 'DECOR', amount: 1 }, check: (s) => s.netWorth >= 1_000_000 },
  { id: 'nw-10m', title: 'On milyonluk patron', desc: 'Toplam varlığın 10 milyon ₺ olsun.', reward: { kind: 'POINT', amount: 1 }, check: (s) => s.netWorth >= 10_000_000 },
  { id: 'nw-100m', title: 'Yüz milyon kulübü', desc: 'Toplam varlığın 100 milyon ₺ olsun.', reward: { kind: 'POINT', amount: 2 }, check: (s) => s.netWorth >= 100_000_000 },
  { id: 'manager', title: 'İşi devret', desc: 'Bir dükkâna müdür ata.', reward: { kind: 'TICKET', amount: 1 }, check: (s) => personalShops(s).some((x) => Boolean(x.manager)) },
  { id: 'level-3', title: 'Büyük dükkân', desc: 'Bir dükkânı 3. seviyeye çıkar.', reward: { kind: 'DECOR', amount: 1 }, check: (s) => personalShops(s).some((x) => x.level >= 3) },
  {
    id: 'trained',
    title: 'Eğitimli ekip',
    desc: 'Bir dükkânın bütün çalışanlarını eğit.',
    reward: { kind: 'DECOR', amount: 1 },
    check: (s) => personalShops(s).some((x) => x.staffCount > 0 && (x.trainedStaff ?? 0) >= x.staffCount),
  },
  { id: 'upgrades', title: 'Tam donanım', desc: 'Bir dükkâna 6 küçük yükseltmenin hepsini yap.', reward: { kind: 'POINT', amount: 1 }, check: (s) => personalShops(s).some((x) => (x.upgrades?.length ?? 0) >= 6) },
  { id: 'customers-1000', title: 'Bin müşteri', desc: 'Toplam 1.000 müşteriye hizmet ver.', reward: { kind: 'TICKET', amount: 1 }, check: (_s, c) => c.customers >= 1000 },
  { id: 'diversified', title: 'Dağıtılmış portföy', desc: 'Aynı anda 8 farklı hisse tut.', reward: { kind: 'DECOR', amount: 1 }, check: (s) => heldStocks(s) >= 8 },
  { id: 'company', title: 'Şirket sahibi', desc: 'Kendi şirketini kur.', reward: { kind: 'POINT', amount: 1 }, check: (s) => Boolean(s.playerCompany) },
  { id: 'ipo', title: 'Borsada şirketim', desc: 'Şirketini halka arz et.', reward: { kind: 'POINT', amount: 2 }, check: (s) => (s.stage ?? 1) >= SimulationStage.STAGE_3_IPO_PUBLIC },
  { id: 'luxury', title: 'Gösteriş zamanı', desc: 'İlk lüks eşyanı satın al.', reward: { kind: 'DECOR', amount: 1 }, check: (s) => (s.lifestyle?.owned.length ?? 0) >= 1 },
  { id: 'prestige', title: 'Yeni şehir, yeni ben', desc: 'Prestij ile yeni bir şehirde başla.', reward: { kind: 'POINT', amount: 1 }, check: (s) => getPrestige(s).cities >= 1 },
];

export const MAX_DECORATIONS = 10;
export const DECORATION_CUSTOMER_PCT = 0.5;
export const WEEK_DAYS = 7;

export function emptyAchievements(): AchievementsState {
  return { unlocked: {}, counters: { noLossStreak: 0, bestNoLossStreak: 0, maxShops: 0, customers: 0, profitDays: 0 } };
}

export function getAchievements(state: Pick<SimulationState, 'achievements'>): AchievementsState {
  return state.achievements ?? emptyAchievements();
}

/** Dekorasyon parçalarının dükkân müşterisine çarpanı (en çok 10 parça = +%5). */
export function decorationMultiplier(state: Pick<SimulationState, 'decorations'>): number {
  const n = Math.max(0, Math.min(MAX_DECORATIONS, Math.floor(state.decorations ?? 0)));
  return 1 + (n * DECORATION_CUSTOMER_PCT) / 100;
}

export function rewardText(r: Reward): string {
  if (r.kind === 'TICKET') return `${r.amount} eğitim bileti`;
  if (r.kind === 'DECOR') return `${r.amount} dekorasyon parçası`;
  return `${r.amount} prestij puanı`;
}

export function grantReward(state: SimulationState, r: Reward): void {
  if (r.kind === 'TICKET') state.trainingTickets = Math.min(50, (state.trainingTickets ?? 0) + r.amount);
  else if (r.kind === 'DECOR') state.decorations = Math.min(MAX_DECORATIONS, (state.decorations ?? 0) + r.amount);
  else addPrestigePoints(state, r.amount);
}

// ---------------------------------------------------------------------------
// Haftalık hedefler
// ---------------------------------------------------------------------------

interface WeeklyTemplate {
  id: string;
  needsShops: boolean;
  unit: WeeklyGoal['unit'];
  title: (target: number) => string;
  target: (shops: number) => number;
}

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

export const WEEKLY_TEMPLATES: ReadonlyArray<WeeklyTemplate> = [
  { id: 'w-profit', needsShops: true, unit: '₺', title: (t) => `Bu hafta dükkânlardan ${fmt(t)} ₺ kâr et`, target: (n) => 6_000 * n },
  { id: 'w-noloss', needsShops: true, unit: 'gün', title: (t) => `${t} gün zarar etmeden çalış`, target: () => 5 },
  { id: 'w-customers', needsShops: true, unit: 'müşteri', title: (t) => `${fmt(t)} müşteriye hizmet ver`, target: (n) => 150 * n },
  { id: 'w-networth', needsShops: false, unit: '%', title: (t) => `Toplam varlığını %${t} artır`, target: () => 3 },
  { id: 'w-cash', needsShops: false, unit: 'gün', title: (t) => `${t} gün boyunca cebinde en az 50.000 ₺ tut`, target: () => 5 },
  { id: 'w-stocks', needsShops: false, unit: 'gün', title: (t) => `${t} gün boyunca en az 3 farklı hisse tut`, target: () => 5 },
];

function hash(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function weekOf(day: number): number {
  return Math.floor((Math.max(1, day) - 1) / WEEK_DAYS);
}

/** Verilen hafta için 3 hedef seçer (uygun olanlar arasından, tekrarsız). */
export function pickWeeklyGoals(state: SimulationState, week: number): WeeklyGoal[] {
  const shops = personalShops(state).length;
  const pool = WEEKLY_TEMPLATES.filter((t) => !t.needsShops || shops > 0);
  const chosen: WeeklyTemplate[] = [];
  const left = [...pool];
  let h = hash(state.seed ?? 1, week + 1);
  while (chosen.length < 3 && left.length > 0) {
    const i = h % left.length;
    chosen.push(left.splice(i, 1)[0]);
    h = hash(h, chosen.length + 7);
  }
  return chosen.map((t, idx) => {
    const r = hash(state.seed ?? 1, week * 31 + idx + 3) % 8;
    // Ödül dağılımı: 3/8 bilet, 3/8 dekorasyon, 2/8 prestij puanı
    const reward: Reward = r < 3 ? { kind: 'TICKET', amount: 1 } : r < 6 ? { kind: 'DECOR', amount: 1 } : { kind: 'POINT', amount: 1 };
    const target = t.target(Math.max(1, shops));
    return { id: t.id, title: t.title(target), target, progress: 0, done: false, reward, unit: t.unit };
  });
}

// ---------------------------------------------------------------------------
// Gün kapanışı
// ---------------------------------------------------------------------------

/**
 * Gün kapanışında çağrılır (`DayCloseProcessor`, ticaret adımından sonra). `state.day` kapanmakta olan gündür.
 * Bildirim metinleri döner.
 */
export function stepAchievementsDayClose(state: SimulationState): string[] {
  const msgs: string[] = [];
  const a = (state.achievements = state.achievements ?? emptyAchievements());
  const c = a.counters;
  const shops = personalShops(state);

  // Sayaçlar
  if (shops.length > 0) {
    const profit = shops.reduce((x, sh) => x + (sh.todayNetProfit ?? 0), 0);
    if (profit >= 0) c.noLossStreak += 1;
    else c.noLossStreak = 0;
    if (profit > 0) c.profitDays += 1;
    c.bestNoLossStreak = Math.max(c.bestNoLossStreak, c.noLossStreak);
    c.customers += shops.reduce((x, sh) => x + (sh.todayServedCustomers ?? 0), 0);
  }
  c.maxShops = Math.max(c.maxShops, shops.length);

  // Başarımlar
  for (const def of ACHIEVEMENTS) {
    if (a.unlocked[def.id] !== undefined) continue;
    if (def.check(state, c)) {
      a.unlocked[def.id] = state.day;
      grantReward(state, def.reward);
      msgs.push(`Başarım: ${def.title}! Ödül: ${rewardText(def.reward)}.`);
    }
  }

  // Haftalık hedefler
  const week = weekOf(state.day);
  if (!a.weekly || a.weekly.week !== week) {
    a.weekly = { week, goals: pickWeeklyGoals(state, week), startNetWorth: state.netWorth, totalDone: a.weekly?.totalDone ?? 0 };
    msgs.push('Yeni haftalık hedefler geldi!');
  }
  const w = a.weekly;
  const cash = state.cash;
  for (const g of w.goals) {
    if (g.done) continue;
    switch (g.id) {
      case 'w-profit':
        g.progress += Math.max(0, shops.reduce((x, sh) => x + (sh.todayNetProfit ?? 0), 0));
        break;
      case 'w-noloss':
        if (shops.length > 0 && shops.every((sh) => (sh.todayNetProfit ?? 0) >= 0) ) g.progress += 1;
        break;
      case 'w-customers':
        g.progress += shops.reduce((x, sh) => x + (sh.todayServedCustomers ?? 0), 0);
        break;
      case 'w-networth':
        g.progress = Math.max(0, ((state.netWorth - w.startNetWorth) / Math.max(1, w.startNetWorth)) * 100);
        break;
      case 'w-cash':
        if (cash >= 50_000) g.progress += 1;
        break;
      case 'w-stocks':
        if (heldStocks(state) >= 3) g.progress += 1;
        break;
    }
    if (g.progress >= g.target) {
      g.done = true;
      g.progress = g.target;
      w.totalDone += 1;
      grantReward(state, g.reward);
      msgs.push(`Haftalık hedef tamam: ${g.title}. Ödül: ${rewardText(g.reward)}.`);
    }
  }
  return msgs;
}

/** Eski/bozuk kayıt temizliği: yalnızca beklenen biçimi alır. */
export function sanitizeAchievements(raw: unknown): AchievementsState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Partial<AchievementsState>;
  const base = emptyAchievements();
  const unlocked: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.unlocked ?? {})) {
    if (ACHIEVEMENTS.some((d) => d.id === k) && Number.isFinite(v)) unlocked[k] = Number(v);
  }
  const c = { ...base.counters, ...(r.counters ?? {}) };
  for (const k of Object.keys(c) as (keyof AchievementCounters)[]) if (!Number.isFinite(c[k]) || c[k] < 0) c[k] = 0;
  const out: AchievementsState = { unlocked, counters: c };
  if (r.weekly && Array.isArray(r.weekly.goals) && Number.isFinite(r.weekly.week)) out.weekly = r.weekly;
  return out;
}
