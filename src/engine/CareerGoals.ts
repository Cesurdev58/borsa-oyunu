/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * KARİYER HEDEFLERİ (CareerGoals)
 * Oyunun başından sonuna kadar uzanan sıralı hedef zinciri ve gerçek para ödülleri.
 * Eskiden 8 hedef vardı, şirket kurulunca bitiyordu ve ödüller yalnızca yazıydı ("+100 İtibar").
 * Şimdi 32 hedef halka arz, holding, devralma ve zenginler listesine kadar gider; her hedefin
 * "Ödülü al" düğmesiyle alınan bir para ödülü vardır.
 *
 * Kurallar:
 *  - Hedefin tamamlanıp tamamlanmadığı her an oyun durumundan hesaplanır (kayıt tutmaz).
 *  - Yalnızca alınan ödüller kaydedilir: `state.careerGoals.claimed` (eski kayıtlarda yoktur).
 *  - Sıra önemlidir: o an gösterilen hedef, ödülü alınmamış ilk hedeftir.
 *  - Eski kayıt ilk açılışta, o an zaten tamamlanmış hedefleri ödülsüz "alınmış" sayar (bedava para olmasın).
 * Ödül tutarları kariyer hızına göre ayarlandı (`npm run kariyer`, robot ödülleri de alır).
 * Yalnızca modelleri, denge sabitlerini ve alt motorları içe aktarır (döngü oluşmaz).
 */
import type { SimulationState } from '../models/simulation';
import { SimulationStage } from '../models/simulation';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';
import { firstShopGateStatus } from './FirstShopGate';
import { WalletEngine } from './WalletEngine';
import { buildRichList } from './RichListEngine';
import { prestigeBonuses } from './PrestigeEngine';

/** Hedefin "Git" düğmesinin açacağı bina (arayüzdeki CityBuildingId ile aynı adlar). */
export type GoalTarget = 'BORSA' | 'OYUNCU_OFISI' | 'SIRKET_MERKEZI' | 'HOLDING_MERKEZI' | 'LUKS';

export interface GoalContext {
  /** Oyuncu Borsa ekranını en az bir kez açtı mı (arayüz bilgisi) */
  hasOpenedBorsa?: boolean;
  /** Şirket kurma eşiği (PROGRESSION_RULES.entrepreneurNetWorth); döngü olmasın diye dışarıdan verilir */
  companyNetWorth?: number;
}

export interface GoalProgress {
  done: boolean;
  /** 0–100 */
  pct: number;
  text: string;
}

export interface CareerGoalDef {
  id: string;
  title: string;
  reward: number;
  target: GoalTarget;
  progress: (state: SimulationState, ctx: GoalContext) => GoalProgress;
}

export interface CareerGoalsState {
  claimed: string[];
  totalRewards: number;
}

const DEFAULT_COMPANY_NET_WORTH = 2_000_000;

const shops = (s: SimulationState) => s.tradeState?.shops ?? [];
const count = (n: number, of: number): GoalProgress => ({
  done: n >= of,
  pct: Math.min(100, Math.floor((n / of) * 100)),
  text: `${Math.min(n, of)} / ${of}`,
});
const flag = (done: boolean): GoalProgress => ({ done, pct: done ? 100 : 0, text: done ? '1 / 1' : '0 / 1' });
const money = (v: number, target: number): GoalProgress => ({
  done: v >= target,
  pct: Math.min(100, Math.max(0, Math.floor((v / target) * 100))),
  text: `%${Math.min(100, Math.max(0, Math.floor((v / target) * 100)))}`,
});
const hasCompany = (s: SimulationState) => s.playerCompany !== null && s.playerCompany !== undefined;
const isPublic = (s: SimulationState) =>
  Boolean(s.playerCompany?.isPubliclyListed) || (s.stage ?? 1) >= SimulationStage.STAGE_3_IPO_PUBLIC;
const marketShare = (s: SimulationState) => s.playerCompany?.operations?.playerMarketSharePct ?? 0;
const boughtAnyStock = (s: SimulationState) =>
  s.pendingOrders.length > 0 || s.transactions.some((t) => t.type === 'BUY');
const distinctSectorsHeld = (s: SimulationState) => {
  const set = new Set<string>();
  for (const p of Object.values(s.portfolio)) {
    if (p.shares <= 0) continue;
    const st = s.stocks.find((x) => x.ticker === p.ticker);
    if (st) set.add(st.sector);
  }
  return set.size;
};
const rivalStakeMaxPct = (s: SimulationState) =>
  Math.max(0, ...s.stocks.filter((x) => !x.isPlayerCompany).map((x) => x.playerOwnershipPct ?? 0));
const controlledRivals = (s: SimulationState) =>
  s.stocks.filter((x) => !x.isPlayerCompany && x.isControlledByPlayer).length;
const upgradeCount = (s: SimulationState) => shops(s).reduce((a, sh) => a + (sh.upgrades?.length ?? 0), 0);
const pastShopPhase = (s: SimulationState) => shops(s).length > 0 || hasCompany(s);
/** Kişisel dükkânların bugüne kadarki toplam net kârı */
const totalShopProfit = (s: SimulationState) =>
  shops(s).reduce((a, sh) => a + Math.max(0, sh.cumulativeNetProfit ?? 0), 0);
const profitGoal = (s: SimulationState, target: number): GoalProgress =>
  hasCompany(s) ? money(1, 1) : money(totalShopProfit(s), target);

export const CAREER_GOALS: readonly CareerGoalDef[] = [
  // --- Borsa ---
  {
    id: 'quest-01-open-borsa',
    title: 'Borsa binasını aç',
    reward: 1_000,
    target: 'BORSA',
    progress: (s, c) => flag(Boolean(c.hasOpenedBorsa) || boughtAnyStock(s) || pastShopPhase(s)),
  },
  {
    id: 'quest-02-first-order',
    title: 'İlk hisseni al',
    reward: 1_000,
    target: 'BORSA',
    progress: (s) => flag(boughtAnyStock(s) || pastShopPhase(s)),
  },
  {
    id: 'quest-03-two-sectors',
    title: 'İki farklı sektörden hisse al',
    reward: 2_000,
    target: 'BORSA',
    progress: (s) =>
      firstShopGateStatus(s).steps.find((x) => x.id === 'two-sectors')?.done || pastShopPhase(s)
        ? count(2, 2)
        : count(distinctSectorsHeld(s), 2),
  },
  {
    id: 'quest-04-first-shop-gate',
    title: 'Bir hisseni sat (dükkân izni)',
    reward: 3_000,
    target: 'BORSA',
    progress: (s) => {
      const g = firstShopGateStatus(s);
      return { done: g.open, pct: g.pct, text: `${g.doneCount} / ${g.steps.length}` };
    },
  },
  // --- Dükkân ---
  {
    id: 'quest-05-open-first-shop',
    title: 'İlk dükkânını aç',
    reward: 5_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => flag(pastShopPhase(s)),
  },
  {
    id: 'quest-06-first-shop-profit',
    title: 'Dükkânından ilk kârını al',
    reward: 5_000,
    target: 'OYUNCU_OFISI',
    progress: (s) =>
      flag(
        hasCompany(s) ||
          shops(s).some((sh) => (sh.cumulativeNetProfit ?? 0) > 0 || (sh.todayNetProfit ?? 0) > 0)
      ),
  },
  {
    id: 'goal-first-upgrade',
    title: 'Dükkânına ilk küçük yükseltmeyi al',
    reward: 3_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => (hasCompany(s) ? count(1, 1) : count(upgradeCount(s), 1)),
  },
  {
    id: 'goal-first-employee',
    title: 'Dükkânına ilk çalışanını işe al',
    reward: 2_000,
    target: 'OYUNCU_OFISI',
    // İlk dükkân BUFE'de oyuncu kendisi çalışır (ownerWorks); çalışan alınınca ya da seviye yükselince biter.
    progress: (s) => flag(hasCompany(s) || shops(s).some((sh) => !sh.ownerWorks && sh.staffCount >= 1)),
  },
  {
    id: 'goal-shop-profit-10k',
    title: 'Dükkânlarından toplam 10 bin ₺ kâr et',
    reward: 5_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => profitGoal(s, 10_000),
  },
  {
    id: 'goal-second-shop',
    title: 'İkinci dükkânını aç',
    reward: 10_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => (hasCompany(s) ? count(2, 2) : count(shops(s).length, 2)),
  },
  {
    id: 'goal-shop-profit-50k',
    title: 'Dükkânlarından toplam 50 bin ₺ kâr et',
    reward: 10_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => profitGoal(s, 50_000),
  },
  {
    id: 'goal-shop-level-2',
    title: 'Bir dükkânı 2. seviyeye yükselt',
    reward: 10_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => flag(hasCompany(s) || shops(s).some((sh) => sh.level >= 2)),
  },
  {
    id: 'goal-first-manager',
    title: 'Bir dükkâna müdür tut',
    reward: 10_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => flag(hasCompany(s) || shops(s).some((sh) => Boolean(sh.manager))),
  },
  {
    id: 'quest-07-networth-250k',
    title: 'Toplam varlığını 250 bin ₺ yap',
    reward: 15_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => money(s.netWorth, 250_000),
  },
  {
    id: 'goal-six-upgrades',
    title: 'Dükkânlarına toplam 6 küçük yükseltme al',
    reward: 15_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => (hasCompany(s) ? count(6, 6) : count(upgradeCount(s), 6)),
  },
  {
    id: 'goal-three-shops',
    title: '3 dükkân sahibi ol',
    reward: 20_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => (hasCompany(s) ? count(3, 3) : count(shops(s).length, 3)),
  },
  {
    id: 'goal-networth-500k',
    title: 'Toplam varlığını 500 bin ₺ yap',
    reward: 25_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => money(s.netWorth, 500_000),
  },
  {
    id: 'goal-four-shops',
    title: '4 dükkân sahibi ol',
    reward: 30_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => (hasCompany(s) ? count(4, 4) : count(shops(s).length, 4)),
  },
  {
    id: 'goal-shop-profit-250k',
    title: 'Dükkânlarından toplam 250 bin ₺ kâr et',
    reward: 30_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => profitGoal(s, 250_000),
  },
  {
    id: 'goal-shop-level-3',
    title: 'Bir dükkânı 3. seviyeye yükselt',
    reward: 25_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => flag(hasCompany(s) || shops(s).some((sh) => sh.level >= 3)),
  },
  {
    id: 'goal-five-shops',
    title: '5 dükkân sahibi ol',
    reward: 40_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => (hasCompany(s) ? count(5, 5) : count(shops(s).length, 5)),
  },
  {
    id: 'goal-networth-1m',
    title: 'Toplam varlığını 1 milyon ₺ yap',
    reward: 50_000,
    target: 'OYUNCU_OFISI',
    progress: (s) => money(s.netWorth, 1_000_000),
  },
  {
    id: 'goal-first-luxury',
    title: 'İlk lüks alımını yap (itibar)',
    reward: 20_000,
    target: 'LUKS',
    progress: (s) => flag((s.lifestyle?.owned.length ?? 0) > 0),
  },
  {
    id: 'goal-portfolio-manager',
    title: 'Borsada portföy yöneticisi tut',
    reward: 25_000,
    target: 'BORSA',
    progress: (s) => flag(Boolean(s.autoInvest?.hired)),
  },
  // --- Şirket ---
  {
    id: 'quest-08-company-2m',
    title: 'Kendi şirketini kur',
    reward: 100_000,
    target: 'SIRKET_MERKEZI',
    progress: (s, c) => {
      if (hasCompany(s)) return flag(true);
      const p = money(s.netWorth, c.companyNetWorth ?? DEFAULT_COMPANY_NET_WORTH);
      return { done: false, pct: Math.min(99, p.pct), text: p.pct >= 100 ? 'Kur!' : p.text };
    },
  },
  {
    id: 'goal-market-share-5',
    title: 'Sektöründe %5 pazar payına ulaş',
    reward: 250_000,
    target: 'SIRKET_MERKEZI',
    progress: (s) => ({ ...money(marketShare(s), 5), done: marketShare(s) >= 5 || isPublic(s) }),
  },
  {
    id: 'goal-ipo',
    title: 'Şirketini halka arz et',
    reward: 1_000_000,
    target: 'SIRKET_MERKEZI',
    progress: (s) => flag(isPublic(s)),
  },
  {
    id: 'goal-rival-stake-5',
    title: 'Bir rakip şirketin %5 hissesini al',
    reward: 1_000_000,
    target: 'HOLDING_MERKEZI',
    progress: (s) => {
      const v = Math.max(rivalStakeMaxPct(s), controlledRivals(s) > 0 ? 5 : 0);
      return { ...money(v, 5), done: v >= 5 };
    },
  },
  {
    id: 'goal-first-takeover',
    title: 'İlk rakibini devral',
    reward: 5_000_000,
    target: 'HOLDING_MERKEZI',
    progress: (s) => flag(controlledRivals(s) >= 1),
  },
  {
    id: 'goal-market-share-25',
    title: 'Sektöründe %25 pazar payına ulaş',
    reward: 10_000_000,
    target: 'SIRKET_MERKEZI',
    progress: (s) => ({ ...money(marketShare(s), 25), done: marketShare(s) >= 25 }),
  },
  {
    id: 'goal-rich-top-3',
    title: 'Zenginler listesinde ilk 3’e gir',
    reward: 20_000_000,
    target: 'HOLDING_MERKEZI',
    progress: (s) => {
      const r = buildRichList(s).playerRank;
      return { done: r <= 3, pct: r <= 3 ? 100 : Math.max(0, Math.floor(((30 - r) / 27) * 100)), text: `${r}. sıra` };
    },
  },
  {
    id: 'goal-rich-top-1',
    title: 'Şehrin en zengini ol',
    reward: 50_000_000,
    target: 'HOLDING_MERKEZI',
    progress: (s) => {
      const r = buildRichList(s).playerRank;
      return { done: r === 1, pct: r === 1 ? 100 : Math.max(0, Math.floor(((30 - r) / 29) * 100)), text: `${r}. sıra` };
    },
  },
];

/** Hedef ödülü (prestij yıldızlarıyla artar, 100 ₺'ye yuvarlanır). */
export function goalReward(state: Pick<SimulationState, 'prestige'>, def: CareerGoalDef): number {
  const mult = prestigeBonuses(state.prestige?.stars ?? 0).rewardMult;
  return Math.round((def.reward * mult) / 100) * 100;
}

export function ensureCareerGoalsState(state: SimulationState): CareerGoalsState {
  if (!state.careerGoals) state.careerGoals = { claimed: [], totalRewards: 0 };
  return state.careerGoals;
}

/**
 * Eski kayıt göçü: alanı olmayan kayıtta, o an zaten tamamlanmış hedefler ödülsüz alınmış sayılır.
 * (Sıradan başlayarak ilk tamamlanmamış hedefe kadar.)
 */
export function migrateCareerGoalsForLegacySave(state: SimulationState, ctx: GoalContext): void {
  if (state.careerGoals) {
    // Sonradan eklenen hedef (ilk çalışan): zincirde ondan sonraki hedef zaten alınmışsa ödülsüz alınmış sayılır
    const cg = state.careerGoals;
    if (!cg.claimed.includes('goal-first-employee') && cg.claimed.includes('goal-shop-profit-10k')) {
      cg.claimed.push('goal-first-employee');
    }
    return;
  }
  const claimed: string[] = [];
  for (const g of CAREER_GOALS) {
    if (!g.progress(state, { ...ctx, hasOpenedBorsa: true }).done) break;
    claimed.push(g.id);
  }
  state.careerGoals = { claimed, totalRewards: 0 };
}

export interface CareerGoalView {
  def: CareerGoalDef;
  stepNumber: number;
  progress: GoalProgress;
  claimed: boolean;
}

export interface CareerGoalsModel {
  goals: CareerGoalView[];
  /** Ödülü alınmamış ilk hedef (hepsi bittiyse null) */
  active: CareerGoalView | null;
  claimedCount: number;
  total: number;
  totalRewards: number;
}

export function buildCareerGoals(state: SimulationState, ctx: GoalContext): CareerGoalsModel {
  const claimedSet = new Set(state.careerGoals?.claimed ?? []);
  const goals = CAREER_GOALS.map((def, i) => {
    const claimed = claimedSet.has(def.id);
    const progress = claimed ? { done: true, pct: 100, text: '✓' } : def.progress(state, ctx);
    return { def, stepNumber: i + 1, progress, claimed };
  });
  return {
    goals,
    active: goals.find((g) => !g.claimed) ?? null,
    claimedCount: goals.filter((g) => g.claimed).length,
    total: goals.length,
    totalRewards: state.careerGoals?.totalRewards ?? 0,
  };
}

/**
 * Sıradaki hedefin ödülünü verir. Yalnızca o an gösterilen (ödülü alınmamış ilk) hedef ve
 * tamamlanmışsa çalışır. Para tek cüzdan kuralına uygun olarak WalletEngine + merkezi defterle girer.
 */
export function claimCareerGoal(
  state: SimulationState,
  goalId: string,
  ctx: GoalContext,
  reservedCash: number
): { success: boolean; message: string; reward: number } {
  const model = buildCareerGoals(state, ctx);
  const active = model.active;
  if (!active || active.def.id !== goalId) {
    return { success: false, message: 'Bu hedefin sırası henüz gelmedi.', reward: 0 };
  }
  if (!active.progress.done) {
    return { success: false, message: 'Bu hedef henüz tamamlanmadı.', reward: 0 };
  }
  const gs = ensureCareerGoalsState(state);
  const reward = goalReward(state, active.def);
  if (reward > 0) {
    WalletEngine.earn(state, reward);
    CentralLedgerEngine.recordPostedAccountingEntry(state, {
      idempotencyKey: `CAREER-GOAL-${goalId}`,
      sourceAccountId: ACCOUNT_IDS.OPERATING_REVENUE,
      destinationAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
      amount: reward,
      category: 'OPERATING_REVENUE_RECEIPT',
      description: `Hedef ödülü: ${active.def.title}`,
      reservedOrderCash: reservedCash,
    });
  }
  gs.claimed.push(goalId);
  gs.totalRewards = Math.round((gs.totalRewards + reward) * 100) / 100;
  return { success: true, message: `Hedef tamam: ${active.def.title}. Ödül +₺${reward.toLocaleString('tr-TR')}`, reward };
}
