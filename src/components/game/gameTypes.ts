/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IPOEligibilityResult,
  MarketSession,
  SimulationStage,
  SimulationState,
} from '../../models/simulation';

export type AppViewMode = 'PLAYER_GAME' | 'DEVELOPER_DASHBOARD';

export type GameBottomTab =
  | 'city'
  | 'market'
  | 'company'
  | 'news'
  | 'portfolio';

export type CityBuildingId =
  | 'BORSA'
  | 'BANKA'
  | 'HABER_MERKEZI'
  | 'OYUNCU_OFISI'
  | 'SIRKET_MERKEZI'
  | 'FABRIKA'
  | 'ARGE_MERKEZI'
  | 'HOLDING_MERKEZI';

export type GameNotificationCategory =
  | 'ORDER_FILLED'
  | 'ORDER_PARTIAL'
  | 'ORDER_CANCELLED'
  | 'ORDER_EXPIRED'
  | 'DIVIDEND_RECEIVED'
  | 'NEW_NEWS'
  | 'MARKET_OPENED'
  | 'MARKET_CLOSED'
  | 'NEW_DAY'
  | 'STAGE_UNLOCKED'
  | 'COMPANY_LOW_CASH'
  | 'ACCOUNTING_WARNING';

export interface GameNotificationItem {
  id: string;
  category: GameNotificationCategory;
  title: string;
  message: string;
  day: number;
  gameTime: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  important: boolean;
  read: boolean;
}

export interface CityBuildingViewModel {
  id: CityBuildingId;
  title: string;
  shortTag: string;
  districtLabel: string;
  level: number;
  isUnlocked: boolean;
  isActiveWorking: boolean;
  statusText: string;
  metricPrimary: string;
  metricSecondary: string;
  unlockRequirementText: string;
  unlockProgressPct: number;
  accentTheme:
    | 'emerald'
    | 'sky'
    | 'amber'
    | 'indigo'
    | 'violet'
    | 'teal'
    | 'rose'
    | 'slate';
  badgeCount?: number;
}

export function formatDateTR(dateISO: string): string {
  const parts = dateISO.split('-');
  if (parts.length !== 3) return dateISO;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function getMarketSessionBadgeMeta(session: MarketSession): {
  shortLabel: string;
  fullLabel: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
} {
  switch (session) {
    case 'MARKET_OPEN':
      return {
        shortLabel: 'Açık',
        fullLabel: 'Piyasa Açık (10:00–17:59)',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-800',
        borderClass: 'border-emerald-300',
        dotClass: 'bg-emerald-500',
      };
    case 'PRE_OPEN':
      return {
        shortLabel: 'Açılış Öncesi',
        fullLabel: 'Açılış Öncesi (09:00–09:59)',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-800',
        borderClass: 'border-amber-300',
        dotClass: 'bg-amber-500',
      };
    case 'AFTER_HOURS':
      return {
        shortLabel: 'Seans Sonrası',
        fullLabel: 'Seans Sonrası (18:00–23:59)',
        bgClass: 'bg-sky-50',
        textClass: 'text-sky-800',
        borderClass: 'border-sky-300',
        dotClass: 'bg-sky-500',
      };
    case 'MARKET_CLOSED':
    default:
      return {
        shortLabel: 'Kapalı',
        fullLabel: 'Piyasa Kapalı (00:00–08:59)',
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-700',
        borderClass: 'border-slate-300',
        dotClass: 'bg-slate-400',
      };
  }
}

/**
 * SimulationState üzerinden 8 şehir binasının görsel ve kilit durumlarını deterministik olarak türetir.
 * İçeride hiçbir ekonomik formül yeniden hesaplanmaz; doğrudan engine state değerleri kullanılır.
 */
export function deriveCityBuildingsFromState(
  state: SimulationState,
  ipoEligibility: IPOEligibilityResult,
  formatCurrency: (v: number) => string
): CityBuildingViewModel[] {
  const activeOrdersCount = state.pendingOrders.filter(
    (o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED'
  ).length;
  const portfolioCount = Object.values(state.portfolio).filter(
    (p) => p.shares > 0
  ).length;
  const isMarketOpen = state.marketSession === 'MARKET_OPEN';
  const stage2ProgressPct = Math.min(
    100,
    Math.floor((state.netWorth / 2_000_000) * 100)
  );

  const pc = state.playerCompany;
  const hasCompany = pc !== null;
  const isStage2Unlocked = state.stageUnlocks.stage2Entrepreneur || hasCompany;
  const isStage4Unlocked = state.stageUnlocks.stage4Holding;

  const maxNpcStakePct = state.stocks
    .filter((s) => !s.isPlayerCompany)
    .reduce((max, s) => Math.max(max, s.playerOwnershipPct), 0);
  const holdingUnlockPct = isStage4Unlocked
    ? 100
    : Math.min(99, Math.floor((maxNpcStakePct / 5.0) * 100));

  return [
    {
      id: 'BORSA',
      title: 'Borsa Binası',
      shortTag: 'BIST · 16 Şirket',
      districtLabel: 'Finans Meydanı',
      level: portfolioCount >= 4 ? 3 : portfolioCount >= 1 ? 2 : 1,
      isUnlocked: true,
      isActiveWorking: isMarketOpen,
      statusText: isMarketOpen ? 'Seans Açık · Canlı İşlem' : 'Seans Bekleniyor',
      metricPrimary: `Endeks ${state.marketIndex.toFixed(1)}`,
      metricSecondary:
        activeOrdersCount > 0
          ? `${activeOrdersCount} Bekleyen Emir`
          : `${portfolioCount} Portföy Hissesi`,
      unlockRequirementText: 'Başlangıçtan itibaren açık.',
      unlockProgressPct: 100,
      accentTheme: 'emerald',
      badgeCount: activeOrdersCount > 0 ? activeOrdersCount : undefined,
    },
    {
      id: 'OYUNCU_OFISI',
      title: 'Oyuncu Ofisi',
      shortTag: `Aşama ${state.stage}/4`,
      districtLabel: 'Merkez Plaza',
      level: state.stage,
      isUnlocked: true,
      isActiveWorking: !state.isPaused,
      statusText: `Aşama ${state.stage} Aktif`,
      metricPrimary: formatCurrency(state.netWorth),
      metricSecondary: `Portföy: ${formatCurrency(state.portfolioValue)}`,
      unlockRequirementText: 'Başlangıçtan itibaren açık.',
      unlockProgressPct: 100,
      accentTheme: 'sky',
    },
    {
      id: 'BANKA',
      title: 'Merkez Bankası & Hazine',
      shortTag: `Faiz %${(state.macro.policyInterestRate * 100).toFixed(0)}`,
      districtLabel: 'Bankalar Caddesi',
      level: state.totalDebt > 0 ? 2 : 1,
      isUnlocked: true,
      isActiveWorking: true,
      statusText:
        state.totalDebt > 0
          ? `Borç: ${formatCurrency(state.totalDebt)}`
          : 'Borçsuz Bilanço',
      metricPrimary: formatCurrency(state.cash),
      metricSecondary: `Enflasyon %${(state.macro.inflationRate * 100).toFixed(0)}`,
      unlockRequirementText: 'Başlangıçtan itibaren açık.',
      unlockProgressPct: 100,
      accentTheme: 'indigo',
    },
    {
      id: 'HABER_MERKEZI',
      title: 'Haber Merkezi',
      shortTag: `${state.newsFeed.length} Bülten`,
      districtLabel: 'Medya Kulesi',
      level: 2,
      isUnlocked: true,
      isActiveWorking: state.newsFeed.length > 0,
      statusText: state.newsFeed[0]?.sector
        ? `Son: ${state.newsFeed[0].sector}`
        : 'Canlı Akış',
      metricPrimary: `Gün ${state.day} Manşeti`,
      metricSecondary: state.newsFeed[0]
        ? `${state.newsFeed[0].sentimentImpact >= 0 ? '+' : ''}${(
            state.newsFeed[0].sentimentImpact * 100
          ).toFixed(2)}% Etki`
        : 'Dengeli',
      unlockRequirementText: 'Başlangıçtan itibaren açık.',
      unlockProgressPct: 100,
      accentTheme: 'amber',
      badgeCount: state.newsFeed.filter((n) => n.day === state.day).length,
    },
    {
      id: 'SIRKET_MERKEZI',
      title: hasCompany ? pc.name.split(' ')[0] + ' Genel Merkez' : 'Şirket Arsası',
      shortTag: hasCompany
        ? pc.isPubliclyListed
          ? `${pc.ticker} · Halka Açık`
          : `${pc.ticker} · Özel A.Ş.`
        : 'Aşama 2 · Girişim',
      districtLabel: 'Kurumsal Kampüs',
      level: hasCompany ? (pc.isPubliclyListed ? 4 : 2) : 1,
      isUnlocked: isStage2Unlocked,
      isActiveWorking: hasCompany && !state.isPaused,
      statusText: hasCompany
        ? `${pc.staffCount} Personel · ${
            ipoEligibility.eligible && !pc.isPubliclyListed
              ? 'IPO Hazır!'
              : 'Faaliyette'
          }`
        : isStage2Unlocked
        ? 'Şirket Kurulumuna Hazır!'
        : 'Kilitli · 2.000.000 TL Net Varlık Gerekli',
      metricPrimary: hasCompany
        ? formatCurrency(pc.equityValue)
        : `İlerleme: %${stage2ProgressPct}`,
      metricSecondary: hasCompany
        ? `Yıllık Ciro: ${formatCurrency(pc.annualizedRevenue)}`
        : `Hedef: ${formatCurrency(2_000_000)}`,
      unlockRequirementText:
        'Toplam Net Varlığınız 2.000.000 TL seviyesine ulaştığında Şirket Arsası açılır ve kendi şirketinizi kurabilirsiniz.',
      unlockProgressPct: isStage2Unlocked ? 100 : stage2ProgressPct,
      accentTheme: 'teal',
    },
    {
      id: 'FABRIKA',
      title: 'Fabrika Bölgesi',
      shortTag: hasCompany
        ? `Kapasite: ${pc.productionCapacity} br/gün`
        : 'Üretim Tesisi',
      districtLabel: 'Organize Sanayi',
      level: hasCompany
        ? pc.productionCapacity >= 150
          ? 3
          : pc.productionCapacity >= 80
          ? 2
          : 1
        : 1,
      isUnlocked: hasCompany,
      isActiveWorking: hasCompany && pc.dailyUnitsProduced > 0 && !state.isPaused,
      statusText: hasCompany
        ? `Günlük Üretim: ${pc.dailyUnitsProduced.toFixed(0)} br`
        : 'Kilitli · Önce Şirket Kurun',
      metricPrimary: hasCompany
        ? `Ciro/Gün: ${formatCurrency(pc.dailyRevenue)}`
        : 'Üretim Bandı Kapalı',
      metricSecondary: hasCompany
        ? `Maliyet/Gün: ${formatCurrency(pc.dailyOpex)}`
        : 'Aşama 2 Şirket Kurulumu Bekleniyor',
      unlockRequirementText:
        'Fabrika Bölgesi, Aşama 2’de kendi şirketinizi kurduğunuzda üretime başlar.',
      unlockProgressPct: hasCompany ? 100 : stage2ProgressPct,
      accentTheme: 'amber',
    },
    {
      id: 'ARGE_MERKEZI',
      title: 'Ar-Ge Merkezi',
      shortTag: hasCompany
        ? `Teknoloji x${pc.techQualityMultiplier.toFixed(2)}`
        : 'İnovasyon Lab',
      districtLabel: 'Teknokent',
      level: hasCompany
        ? pc.techQualityMultiplier >= 1.25
          ? 3
          : pc.techQualityMultiplier >= 1.08
          ? 2
          : 1
        : 1,
      isUnlocked: hasCompany,
      isActiveWorking: hasCompany && pc.dailyRdBudget > 0 && !state.isPaused,
      statusText: hasCompany
        ? `Kalite Çarpanı: x${pc.techQualityMultiplier.toFixed(3)}`
        : 'Kilitli · Önce Şirket Kurun',
      metricPrimary: hasCompany
        ? `Bütçe: ${formatCurrency(pc.dailyRdBudget)}/gün`
        : 'Laboratuvar Kapalı',
      metricSecondary: hasCompany
        ? `Yönetişim: ${pc.corporateGovernanceScore.toFixed(1)}/100`
        : 'Aşama 2 Şirket Kurulumu Bekleniyor',
      unlockRequirementText:
        'Ar-Ge Merkezi, şirketiniz kurulduğunda ürün kalitesi ve fiyatlama gücünü artırmak için açılır.',
      unlockProgressPct: hasCompany ? 100 : stage2ProgressPct,
      accentTheme: 'violet',
    },
    {
      id: 'HOLDING_MERKEZI',
      title: 'Holding Merkezi',
      shortTag:
        state.controlledSubsidiaries.length > 0
          ? `${state.controlledSubsidiaries.length} Bağlı Ortaklık`
          : 'Aşama 4 · Devralma',
      districtLabel: 'Holding Kuleleri',
      level:
        state.stage === SimulationStage.STAGE_4_HOLDING_MONOPOLY
          ? 4
          : isStage4Unlocked
          ? 2
          : 1,
      isUnlocked: isStage4Unlocked,
      isActiveWorking:
        state.controlledSubsidiaries.length > 0 && !state.isPaused,
      statusText:
        state.controlledSubsidiaries.length > 0
          ? `Kontrol: ${state.controlledSubsidiaries.join(', ')}`
          : isStage4Unlocked
          ? 'Devralma (Takeover) Açık'
          : 'Kilitli · %5+ Stratejik Pay veya IPO Gerekli',
      metricPrimary:
        state.controlledSubsidiaries.length > 0
          ? `Sinerji: ${formatCurrency(state.totalSynergyEarned)}`
          : `En Yüksek Pay: %${maxNpcStakePct.toFixed(2)}`,
      metricSecondary:
        state.controlledSubsidiaries.length > 0
          ? `${state.controlledSubsidiaries.length} Şirket Konsolide`
          : 'Hedef: %51+ Çoğunluk Payı',
      unlockRequirementText:
        'Holding Merkezi; bir NPC şirketinde en az %5 stratejik pay topladığınızda, şirketinizi halka arz ettiğinizde veya bir şirketi devraldığınızda açılır.',
      unlockProgressPct: holdingUnlockPct,
      accentTheme: 'rose',
    },
  ];
}
