/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SIRKET_MERKEZI bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import { NumberInput } from '../ui/NumberInput';
import { HelpTip } from '../ui/HelpTip';
import { SectorIcon, sectorLabel } from '../ui/SectorIcon';
import { SECTOR_GUIDE, SECTOR_GUIDE_ORDER } from '../../../data/sectorGuide';
import { effectiveCorporateTaxRate } from '../../../engine/TaxRules';
import { PROGRESSION_RULES } from '../../../engine/ProgressionRules';
import React, {
  useEffect,
  useState,
} from 'react';
import {
  Lock, Briefcase } from 'lucide-react';
import {
  SECTOR_CONFIGS,
} from '../../../data/sectors';
import {
  SectorId,
} from '../../../models/market';
import {
  deriveDeterministicIpoReasonItems,
} from '../city/questAndHudLogic';

import {
  InvestmentPackageType,
  SalaryTier,
} from '../../../models/finance';
import {
  TRANSFER_CATEGORY_LABELS_TR,
} from '../../../engine/CentralLedgerEngine';
import {
  LOAN_TYPE_CATALOG,
} from '../../../engine/BankLoanEngine';
import {
  CompanyEngine,
  INVESTMENT_PACKAGE_CATALOG,
} from '../../../engine/CompanyEngine';
import type {
  BuildingDetailContentProps,
} from './buildingTypes';

export const SirketMerkeziPanel: React.FC<BuildingDetailContentProps> = ({
  buildingId,
  state,
  initialCompanySubTab,
  onEstablishCompany,
  onTransferCapital,
  onConfigureOperations,
  onExecuteIPO,
  onPayLoanInstallment,
  onStartInvestmentProject,
  onCancelInvestmentProject,
  onLiquidateInventory,
  ipoEligibility,
  formatCurrency,
  onOpenBuilding,
}) => {
  const [showSummaryMore, setShowSummaryMore] = useState(false);
  const [compName, setCompName] = useState('Anadolu Kuantum Teknoloji A.Ş.');
  const [compTicker, setCompTicker] = useState('ANKT');
  const [compSector, setCompSector] = useState<SectorId>('TEKNOLOJI');
  const [compCapital, setCompCapital] = useState<number>(800_000);
  const [injectAmount, setInjectAmount] = useState<number>(200_000);
  const [companySubTab, setCompanySubTab] = useState<
    'OZET' | 'URETIM' | 'CALISANLAR' | 'FINANS' | 'GELISIM'
  >(initialCompanySubTab || 'OZET');

  useEffect(() => {
    if (initialCompanySubTab) {
      setCompanySubTab(initialCompanySubTab);
    }
  }, [initialCompanySubTab, buildingId]);

  // Üretim artırma rehberi state
  const [showProductionGuide, setShowProductionGuide] = useState<boolean>(false);
  const [prodGuideTargetMode, setProdGuideTargetMode] = useState<
    '50K' | '100K' | '250K' | 'CAP_25' | 'CAP_50' | 'CUSTOM'
  >('CAP_50');
  const [prodGuideCustomUnits, setProdGuideCustomUnits] = useState<number>(100);

  // Çalışan alımı (İşçi alımı) state
  const [hireCountInput, setHireCountInput] = useState<number>(10);
  const [hireFeedback, setHireFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Finans sekmesi daraltılabilir paneller (Ayrıntılı Rapor varsayılan kapalı)
  const [showDetailedFinanceReport, setShowDetailedFinanceReport] =
    useState<boolean>(false);
  const [showCompanyLoansPanel, setShowCompanyLoansPanel] =
    useState<boolean>(false);
  const [showInlineTransferPanel, setShowInlineTransferPanel] =
    useState<boolean>(false);

  // Finans Merkezi (Para Transferi & Kredi) state
  const [customSalePrice, setCustomSalePrice] = useState<number>(0);
  const [selectedInvPkg, setSelectedInvPkg] =
    useState<InvestmentPackageType>('SMALL_EXPANSION');
  const [customCapDelta, setCustomCapDelta] = useState<number>(25);
  const [invFundingSource, setInvFundingSource] = useState<
    'COMPANY_CASH' | 'BANK_LOAN'
  >('COMPANY_CASH');

  // Takeover state

  const isStage2Unlocked =
    state.stageUnlocks.stage2Entrepreneur || state.playerCompany !== null;
  const pc = state.playerCompany;

  if (!isStage2Unlocked && !pc) {
    const progressPct = Math.min(
      100,
      Math.floor((state.netWorth / PROGRESSION_RULES.entrepreneurNetWorth) * 100)
    );
    const remainingNeeded = Math.max(0, PROGRESSION_RULES.entrepreneurNetWorth - state.netWorth);
    return (
      <div
        className="space-y-4 text-xs"
        data-testid="sheet-content-SIRKET_MERKEZI-locked"
      >
        <div className="g-hero p-4 shadow-lg space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/25 flex items-center justify-center text-2xl shrink-0">
              🔒
            </div>
            <div>
              <h3 className="text-sm font-extrabold">Şirket kurmak için büyü!</h3>
              <p className="opacity-95">
                Toplam varlığın {formatCurrency(PROGRESSION_RULES.entrepreneurNetWorth)} olunca kendi şirketini kurabilirsin.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xl px-2">
            <span title="Borsa">📈</span>
            <span className="opacity-60">➜</span>
            <span title="Dükkân">🏪</span>
            <span className="opacity-60">➜</span>
            <span title="Şirket">🏢</span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-4 bg-white/30 rounded-full overflow-hidden">
              <div
                className="g-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between tabular-nums text-[13px] font-bold">
              <span>{formatCurrency(state.netWorth)}</span>
              <span>%{progressPct}</span>
              <span>{formatCurrency(PROGRESSION_RULES.entrepreneurNetWorth)}</span>
            </div>
            <div className="text-[13px] opacity-95">
              Kalan: <strong className="tabular-nums">{formatCurrency(remainingNeeded)}</strong>
            </div>
          </div>

          {onOpenBuilding && (
            <button
              type="button"
              onClick={() => onOpenBuilding('BORSA')}
              className="w-full min-h-[48px] rounded-2xl bg-white text-violet-700 font-extrabold text-sm shadow-md active:scale-95"
            >
              Borsaya git, parayı büyüt
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!pc) {
    const guide = SECTOR_GUIDE[compSector];
    const dots = (n: number, color: string) => (
      <span className="flex gap-1" aria-label={`${n}/3`}>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-3 h-3 rounded-full"
            style={{ background: i <= n ? color : 'rgba(17,26,51,.12)' }}
          />
        ))}
      </span>
    );
    const difficultyColor = (d: string) =>
      d === 'Kolay'
        ? 'bg-[var(--g-green)] text-white'
        : d === 'Orta'
        ? 'bg-[var(--g-gold)] text-[#3a2600]'
        : 'bg-[var(--g-red)] text-white';
    return (
      <div
        className="space-y-4 text-xs"
        data-testid="sheet-content-SIRKET_MERKEZI-founding"
      >
        <div className="g-hero p-5 space-y-1">
          <div className="g-hero-label">Kendi şirketini kur</div>
          <div className="g-display text-2xl font-extrabold text-white">1. Sektörünü seç</div>
          <p className="text-[13px] text-white/75 font-semibold">
            Sektör, şirketinin ne kadar hızlı büyüyeceğini, ne kadar kazanabileceğini ve rakiplerini belirler.
            Sonradan değiştirilemez.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2" data-testid="company-sector-picker">
          {SECTOR_GUIDE_ORDER.map((sid) => {
            const g = SECTOR_GUIDE[sid];
            const active = sid === compSector;
            return (
              <button
                key={sid}
                type="button"
                data-testid={`company-sector-choice-${sid}`}
                data-active={active ? 'true' : 'false'}
                onClick={() => setCompSector(sid)}
                className="g-choice p-3 text-left flex items-center gap-2.5 min-h-[64px]"
              >
                <SectorIcon sector={sid} size="md" />
                <span className="min-w-0">
                  <span className="block font-extrabold text-[var(--g-ink)] text-sm truncate">
                    {sectorLabel(sid)}
                  </span>
                  <span
                    className={`inline-block mt-0.5 px-2 rounded-full text-[13px] font-extrabold ${difficultyColor(g.difficulty)}`}
                  >
                    {g.difficulty}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="g-card p-4 space-y-3" data-testid="company-sector-detail">
          <div className="flex items-center gap-2.5">
            <SectorIcon sector={compSector} size="lg" />
            <div>
              <div className="g-display text-lg font-extrabold text-[var(--g-ink)]">
                {sectorLabel(compSector)}
              </div>
              <div className="text-[13px] text-[var(--g-muted)] font-semibold">
                {SECTOR_CONFIGS[compSector].name}
              </div>
            </div>
          </div>
          <p className="text-sm text-[var(--g-ink)]">{guide.pitchTR}</p>
          <div className="space-y-2 text-sm font-bold text-[var(--g-ink)]">
            <div className="flex items-center justify-between">
              <span>Büyüme hızı</span>
              {dots(guide.growth, 'var(--g-green)')}
            </div>
            <div className="flex items-center justify-between">
              <span>Kâr tavanı</span>
              {dots(guide.ceiling, 'var(--g-gold)')}
            </div>
            <div className="flex items-center justify-between">
              <span>Rakip almak kolay</span>
              {dots(guide.rivalEase, 'var(--g-navy-600)')}
            </div>
          </div>
          <div className="rounded-xl p-3 bg-[rgba(39,174,96,.10)] text-sm">
            <span className="font-extrabold text-[var(--g-green-dark)]">Artısı: </span>
            {guide.plusTR}
          </div>
          <div className="rounded-xl p-3 bg-[rgba(231,76,60,.10)] text-sm">
            <span className="font-extrabold text-[var(--g-red)]">Dikkat: </span>
            {guide.minusTR}
          </div>
        </div>

        <div className="g-card p-4 space-y-3">
          <div className="g-section-title">2. Adını ve sermayesini belirle</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[13px] font-semibold text-[var(--g-muted)] mb-1">
                Şirketin adı
              </label>
              <input
                type="text"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                className="g-input w-full min-h-[48px]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[var(--g-muted)] mb-1">
                Borsa kodu (3-4 harf)
              </label>
              <input
                type="text"
                maxLength={5}
                value={compTicker}
                onChange={(e) => setCompTicker(e.target.value.toUpperCase())}
                className="g-input w-full min-h-[48px] tabular-nums"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[13px] font-semibold text-[var(--g-muted)] mb-1">
                Kasaya koyacağın para (en az 400.000 TL)
              </label>
              <NumberInput
                min={400_000}
                step={50_000}
                value={compCapital}
                onChange={(e) =>
                  setCompCapital(Math.max(400_000, Number(e.target.value) || 400_000))
                }
                className="g-input w-full min-h-[48px] tabular-nums"
              />
            </div>
          </div>
          <div className="g-tip">
            Kasaya koyduğun para fabrikayı büyütmeye ve maaşlara gider. Fazlasını sonra temettüyle geri çekebilirsin.
          </div>

          <button
            type="button"
            data-testid="tycoon-establish-company-btn"
            onClick={() =>
              onEstablishCompany(
                compName,
                compTicker,
                compSector,
                compCapital,
                {
                  initialStaffCount: 25,
                  initialCapacity: 40,
                  initialRdBudget: 15_000,
                }
              )
            }
            className="g-btn g-btn-primary w-full min-h-[56px]"
          >
            {sectorLabel(compSector)} şirketini kur ({formatCurrency(compCapital)})
          </button>
        </div>
      </div>
    );
  }

  if (!pc.operations || !pc.workforcePlan) {
    CompanyEngine.ensureCompanyV5Fields(pc, state.macro);
  }
  const ops = pc.operations!;
  const inc = pc.incomeBreakdown;
  const wf = pc.workforcePlan!;
  const sectorCfg = SECTOR_CONFIGS[pc.sector];

  const installedCap = Math.max(1, ops.installedCapacity);
  const effectiveCap = ops.effectiveCapacity;
  const actualProd = ops.actualProduction;
  const capacityUtilizationPct = Number(
    Math.min(100, (actualProd / installedCap) * 100).toFixed(1)
  );
  const storageFillPct = Math.min(
    100,
    Math.round(
      (ops.inventoryUnits / Math.max(1, ops.maximumStorageUnits)) * 100
    )
  );

  const laborCap = Math.max(
    1,
    Math.round(pc.staffCount * 2.5 * ops.workforceEfficiency)
  );
  const requiredWorkersForFullCap = Math.max(
    5,
    Math.ceil(installedCap / Math.max(0.5, 2.5 * ops.workforceEfficiency))
  );
  const workersShortfall = Math.max(0, requiredWorkersForFullCap - pc.staffCount);

  const dailyRevenue = Number(
    ((inc ? inc.totalRevenue : pc.financials.revenue) / 120).toFixed(2)
  );
  const dailyExpenses = Number(
    (
      (inc
        ? inc.totalCogs +
          inc.totalOpex +
          inc.totalFinancingExpense +
          inc.taxExpense
        : pc.financials.costOfGoodsSold + pc.financials.operatingExpenses) / 120
    ).toFixed(2)
  );
  const dailyNetProfit = Number(
    ((inc ? inc.netProfit : pc.financials.netIncome) / 120).toFixed(2)
  );
  const runwayDays = Math.max(
    0,
    Math.floor(pc.financials.cash / Math.max(1, dailyExpenses))
  );

  const companyLoans = (state.activeLoans ?? []).filter(
    (l) => l.status !== 'PAID_OFF' && l.borrowerType === 'COMPANY'
  );
  const nextCompanyLoan = companyLoans
    .slice()
    .sort((a, b) => a.nextPaymentGameDay - b.nextPaymentGameDay)[0];

  // Açık Türkçe Ana Darboğaz Tespiti
  const mainBottleneckTR =
    pc.financials.cash < dailyExpenses * 2
      ? 'İşletme sermayesi yetersiz'
      : storageFillPct >= 95
      ? 'Depo dolu'
      : laborCap < effectiveCap - 0.5
      ? 'Çalışan eksik'
      : Math.min(ops.rawMaterialAvailability, ops.energyOperationalCapacity) <
        0.88
      ? 'Hammadde eksik'
      : ops.machineAvailability < 0.85
      ? 'Makine bakımı gerekiyor'
      : ops.marketDemand < actualProd * 0.85
      ? 'Talep düşük'
      : 'Darboğaz yok (Dengeli üretim)';

  // Şirket Durumu Özeti
  const companyHealthLabel =
    pc.financials.cash < dailyExpenses * 2
      ? 'Kritik (Nakit Sıkışıklığı)'
      : dailyNetProfit < 0 || mainBottleneckTR !== 'Darboğaz yok (Dengeli üretim)'
      ? 'İyileştirilebilir'
      : 'Sağlıklı';

  // Gerçek Veriden Üretilen 3 Kısa Durum Mesajı (Bölüm 1: Özet)
  const statusProductionMsg =
    laborCap < effectiveCap - 0.5
      ? `Üretim yavaş: Çalışan sayısı yetersiz (${pc.staffCount} / ${requiredWorkersForFullCap} kişi).`
      : storageFillPct >= 90
      ? `Depo dolmak üzere (%${storageFillPct}): Satış fiyatını düşürün veya stok eritin.`
      : ops.machineAvailability < 0.85
      ? `Üretim yavaş: Makine durumu %${(ops.machineAvailability * 100).toFixed(0)} seviyesinde.`
      : capacityUtilizationPct < 70
      ? `Kapasite kullanımı düşük: En fazla üretimin yalnızca %${capacityUtilizationPct.toString().replace('.', ',')}’i kullanılıyor.`
      : 'Üretim dengeli: Mevcut çalışan ve makine düzeni uyumlu çalışıyor.';

  const statusFinanceMsg =
    runwayDays < 7
      ? `Nakit kritik: Şirket kasası tahmini ${runwayDays} günlük gideri karşılayabilir.`
      : companyLoans.length > 0 && nextCompanyLoan
      ? `Nakit yeterli (${runwayDays} gün), sıradaki kredi ödemesi Gün ${nextCompanyLoan.nextPaymentGameDay} (${formatCurrency(nextCompanyLoan.installmentAmount)}).`
      : `Nakit yeterli: Tahmini ${Math.min(365, runwayDays)} günlük gider karşılanabilir.`;

  const statusGrowthMsg =
    ops.marketDemand > actualProd + 1
      ? `Satışlar iyi: Satış fırsatı (${ops.marketDemand.toFixed(0)} birim) mevcut üretimden (${actualProd.toFixed(0)} birim) yüksek.`
      : pc.techQualityMultiplier < 1.25
      ? 'Büyüme fırsatı: Gelişim bölümünden Ar-Ge bütçesini artırarak ürün kalitesini yükseltebilirsiniz.'
      : 'Pazar konumu güçlü: Ürün kalitesi ve satış hızı dengeli seyrediyor.';

  // Önerilen İşlemler (En fazla 3 öneri — ilgili sekmeye yönlendirir, işlemi Özet'te tekrar etmez!)
  const recommendedNavActions: Array<{
    id: string;
    title: string;
    reason: string;
    targetTab: 'URETIM' | 'CALISANLAR' | 'FINANS' | 'GELISIM';
    ctaLabel: string;
  }> = [];

  if (laborCap < effectiveCap - 0.5 || workersShortfall > 0) {
    recommendedNavActions.push({
      id: 'rec-hire',
      title: `Çalışan Eksikliğini Gider (+${Math.max(5, workersShortfall)} kişi)`,
      reason:
        'Mevcut üretim tesisini tam kapasite çalıştırmak için yeni çalışan gerekiyor.',
      targetTab: 'CALISANLAR',
      ctaLabel: 'Çalışanlar Bölümüne Git',
    });
  }
  if (capacityUtilizationPct < 70 || storageFillPct >= 75) {
    recommendedNavActions.push({
      id: 'rec-prod',
      title:
        storageFillPct >= 75
          ? 'Stok ve Satış Fiyatını Düzenle'
          : 'Mevcut Üretim Kapasitesini Etkinleştir',
      reason:
        storageFillPct >= 75
          ? 'Depo doluluğu yükseldi; satış fiyatını güncelleyerek stokları eritebilirsiniz.'
          : `Tesis kapasitesinin %${capacityUtilizationPct.toString().replace('.', ',')}’i kullanılıyor; yeni yatırım yerine üretimi artırın.`,
      targetTab: 'URETIM',
      ctaLabel: 'Üretim Bölümüne Git',
    });
  }
  if (runwayDays < 14 || companyLoans.length > 0) {
    recommendedNavActions.push({
      id: 'rec-fin',
      title: 'Nakit Akışı ve Borç Planını Kontrol Et',
      reason:
        'Şirket kasasını ve yaklaşan kredi ödemelerini Finans bölümünden yönetin.',
      targetTab: 'FINANS',
      ctaLabel: 'Finans Bölümüne Git',
    });
  }
  // Kapasite kullanımı %70'in altındaysa yeni kapasite yatırımı önerilmez!
  if (
    capacityUtilizationPct >= 70 &&
    ops.marketDemand > installedCap &&
    recommendedNavActions.length < 3
  ) {
    recommendedNavActions.push({
      id: 'rec-inv',
      title: 'Üretim Tesisi Yatırımı Planla',
      reason:
        'Mevcut tesis yüksek kapasitede çalışıyor ve satış fırsatı üretimi aşıyor.',
      targetTab: 'GELISIM',
      ctaLabel: 'Gelişim Bölümüne Git',
    });
  }
  if (recommendedNavActions.length === 0) {
    recommendedNavActions.push({
      id: 'rec-default-prod',
      title: 'Üretim ve Satış Planını İncele',
      reason: 'Günlük üretim hedefini ve ürün fiyatını gözden geçirin.',
      targetTab: 'URETIM',
      ctaLabel: 'Üretim Bölümüne Git',
    });
  }

  // Üretimi Artır Rehberi Hesaplamaları (Bölüm 2: Üretim)
  const guideTargetUnits =
    prodGuideTargetMode === '50K'
      ? 50_000
      : prodGuideTargetMode === '100K'
      ? 100_000
      : prodGuideTargetMode === '250K'
      ? 250_000
      : prodGuideTargetMode === 'CAP_25'
      ? Math.max(1, Math.round(installedCap * 0.25))
      : prodGuideTargetMode === 'CAP_50'
      ? Math.max(1, Math.round(installedCap * 0.5))
      : Math.max(1, Math.round(prodGuideCustomUnits));

  const guideBoundedUnits = Math.min(installedCap, guideTargetUnits);
  const guideTotalWorkersNeeded = Math.ceil(
    guideTargetUnits / Math.max(0.5, 2.5 * ops.workforceEfficiency)
  );
  const guideNewWorkersNeeded = Math.max(
    0,
    guideTotalWorkersNeeded - pc.staffCount
  );
  const dailyWagePerWorker = Number(
    (
      sectorCfg.dailyStaffWage *
      (wf.salaryTier === 'ECONOMY'
        ? 0.85
        : wf.salaryTier === 'STANDARD'
        ? 1.0
        : 1.22) *
      (wf.shifts === 1 ? 1.0 : wf.shifts === 2 ? 1.18 : 1.38)
    ).toFixed(2)
  );
  const dailyTotalPayroll = Number(
    (pc.staffCount * dailyWagePerWorker).toFixed(2)
  );
  const workerSatisfactionPct = Math.round(
    Math.min(
      100,
      Math.max(
        35,
        (wf.salaryTier === 'ECONOMY'
          ? 64
          : wf.salaryTier === 'STANDARD'
          ? 82
          : 95) -
          (wf.shifts === 3 ? 8 : wf.shifts === 2 ? 3 : 0)
      )
    )
  );

  const guideDailyExtraCost = Number(
    (
      guideNewWorkersNeeded * dailyWagePerWorker +
      Math.max(0, guideBoundedUnits - actualProd) * ops.unitProductionCost
    ).toFixed(2)
  );
  const guideRequiredRawMaterial = guideBoundedUnits;
  const guideEstimatedSales = Math.min(
    ops.marketDemand,
    ops.inventoryUnits + guideBoundedUnits
  );
  const guideStockRiskLabel =
    guideBoundedUnits > ops.marketDemand * 1.25 ||
    ops.inventoryUnits + guideBoundedUnits - guideEstimatedSales >
      ops.maximumStorageUnits * 0.85
      ? 'Yüksek (Depo dolabilir)'
      : guideBoundedUnits > ops.marketDemand
      ? 'Orta (Stok birikebilir)'
      : 'Düşük (Satış talebi karşılıyor)';

  // Çalışan Alımı (İşçi Alımı) Hesaplamaları (Bölüm 3: Çalışanlar)
  const cleanHireCount = Math.max(0, Math.round(hireCountInput));
  const hireOnboardingCost = Number(
    (cleanHireCount * sectorCfg.dailyStaffWage * 0.8).toFixed(2)
  );
  const hireDailyExtraWage = Number(
    (cleanHireCount * dailyWagePerWorker).toFixed(2)
  );
  const newLaborCapAfterHire = Math.max(
    1,
    Math.round((pc.staffCount + cleanHireCount) * 2.5 * ops.workforceEfficiency)
  );
  const currentLaborBoundedProd = Math.min(
    installedCap,
    effectiveCap,
    laborCap
  );
  const afterHireLaborBoundedProd = Math.min(
    installedCap,
    effectiveCap,
    newLaborCapAfterHire
  );
  const estimatedProdGainFromHire = Math.max(
    0,
    Number((afterHireLaborBoundedProd - currentLaborBoundedProd).toFixed(1))
  );
  const cashAfterHire = Number(
    (pc.financials.cash - hireOnboardingCost).toFixed(2)
  );
  const canAffordHire =
    cleanHireCount > 0 && hireOnboardingCost <= pc.financials.cash;

  // Yatırım Paketi Teklifi (Bölüm 5: Gelişim)
  const invQuote = CompanyEngine.computeInvestmentProjectQuote(
    pc,
    selectedInvPkg,
    {
      customCapacityGain:
        selectedInvPkg === 'CUSTOM_TARGET' ? customCapDelta : undefined,
      budgetMaxMode: selectedInvPkg === 'BUDGET_MAX',
    }
  );

  const companyLedgerTxs = (state.centralLedger?.transactions ?? []).filter(
    (tx) =>
      tx.relatedCompanyId === pc.ticker ||
      tx.sourceAccountId.includes(pc.ticker) ||
      tx.destinationAccountId.includes(pc.ticker)
  );

  return (
    <div
      className="space-y-3.5 text-xs"
      data-testid="sheet-content-SIRKET_MERKEZI-active"
    >
      {/* Şirket Başlık Özeti */}
      <div className="g-hero p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(180deg,#ffe08a,var(--g-gold))', boxShadow: '0 3px 0 var(--g-gold-dark)' }}
          >
            <Briefcase className="w-6 h-6 text-[#6b4500]" strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <div className="g-display text-lg font-extrabold leading-tight truncate">{pc.name}</div>
            <div className="text-[13px] font-semibold text-white/65">
              {pc.ticker} · {pc.operatingDays}. gün
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="g-hero-tile p-2.5">
            <div className="text-[13px] font-bold text-white/60">Şirket değeri</div>
            <div className="g-display text-lg font-extrabold tabular-nums text-[var(--g-gold)]">
              {formatCurrency(pc.equityValue)}
            </div>
          </div>
          <div className="g-hero-tile p-2.5">
            <div className="text-[13px] font-bold text-white/60">Şirket kasası</div>
            <div className="g-display text-lg font-extrabold tabular-nums text-white">
              {formatCurrency(pc.financials.cash)}
            </div>
          </div>
        </div>
      </div>

      {/* 5 Ana Bölümlü Mobil Öncelikli Navigasyon (Özet · Üretim · Çalışanlar · Finans · Gelişim) */}
      <div
        role="tablist"
        aria-label="Şirket Yönetimi Bölümleri"
        data-testid="company-5-section-nav"
        className="g-card grid grid-cols-5 gap-1 p-1"
      >
        {(
          [
            { id: 'OZET', label: 'Özet' },
            { id: 'URETIM', label: 'Üretim' },
            { id: 'CALISANLAR', label: 'Ekip' },
            { id: 'FINANS', label: 'Para' },
            { id: 'GELISIM', label: 'Gelişim' },
          ] as const
        ).map((tab) => (
          <button
            key={`company-subtab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={companySubTab === tab.id}
            data-testid={`company-subtab-${tab.id}`}
            onClick={() => setCompanySubTab(tab.id)}
            className={`min-h-[44px] px-0.5 py-1 rounded-xl text-[13px] leading-tight font-extrabold text-center transition-colors ${
              companySubTab === tab.id
                ? 'bg-[var(--g-navy-800)] text-white shadow-md'
                : 'text-[var(--g-muted)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* =====================================================================
          BÖLÜM 1: ÖZET (En Fazla 5 Ana Bilgi Kartı + 3 Durum Mesajı + Önerilen İşlemler)
         ===================================================================== */}
      {companySubTab === 'OZET' && (
        <div className="space-y-3" data-testid="company-section-OZET">
          {/* 4 renkli ana kart (şirket kasası üstteki başlıkta zaten var) */}
          <div
            className="grid grid-cols-2 gap-2 tabular-nums"
            data-testid="company-summary-5-cards"
          >
            <div
              className="g-card p-3"
            >
              <div className="text-[13px] font-bold text-[var(--g-muted)]">Bugünkü kâr</div>
              <div
                className={`g-display text-xl font-extrabold ${
                  dailyNetProfit >= 0 ? 'text-[var(--g-green-dark)]' : 'text-[var(--g-red)]'
                }`}
              >
                {dailyNetProfit >= 0 ? '+' : ''}
                {formatCurrency(dailyNetProfit)}
              </div>
            </div>
            <div className="g-card p-3">
              <div className="text-[13px] font-bold text-[var(--g-muted)]">Bugünkü üretim</div>
              <div className="g-display text-xl font-extrabold text-slate-900">
                {actualProd.toFixed(0)} birim
              </div>
            </div>
            <div className="g-card p-3">
              <div className="text-[13px] font-bold text-[var(--g-muted)]">Bugünkü satış</div>
              <div className="g-display text-xl font-extrabold text-slate-900">
                {ops.actualSalesUnits.toFixed(0)} birim
              </div>
            </div>
            <div
              className="g-card p-3"
            >
              <div className="text-[13px] font-bold text-[var(--g-muted)]">Şirket durumu</div>
              <div
                className={`g-display text-xl font-extrabold ${
                  companyHealthLabel.startsWith('Kritik')
                    ? 'text-[var(--g-red)]'
                    : companyHealthLabel === 'Sağlıklı'
                    ? 'text-[var(--g-green-dark)]'
                    : 'text-[var(--g-gold-dark)]'
                }`}
              >
                {companyHealthLabel}
              </div>
            </div>
          </div>

          {/* Sektör pazarı: oyuncunun payı, rakipler ve boş alan */}
          {(() => {
            const market = Math.max(1, ops.sectorMarketUnits ?? 0);
            if (!ops.sectorMarketUnits) return null;
            const myPct = Math.min(100, (ops.actualSalesUnits / market) * 100);
            const rivals = state.stocks.filter(
              (s) => !s.isPlayerCompany && s.sector === pc.sector
            );
            const rivalPct = Math.min(
              100 - myPct,
              ((ops.rivalUnitsInMarket ?? 0) / market) * 100
            );
            const preTaxDaily = pc.financials.preTaxIncome / 120;
            const taxPct = Math.round(
              effectiveCorporateTaxRate(preTaxDaily, state.macro.corporateTaxRate) * 100
            );
            return (
              <div className="g-card p-4 space-y-3" data-testid="company-market-card">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-bold text-[var(--g-muted)] flex items-center gap-1">
                      Pazardaki payın
                      <HelpTip text="Her sektörün günlük satış pazarı sınırlıdır. Rakiplerin tuttuğu müşteriye satamazsın; rakip devralınca o müşteriler sana açılır." />
                    </div>
                    <div className="g-display text-3xl font-extrabold text-[var(--g-navy-800)] tabular-nums">
                      %{myPct.toFixed(0)}
                    </div>
                  </div>
                  <div className="text-right text-[13px] text-[var(--g-muted)] tabular-nums">
                    Pazar: {Math.round(market).toLocaleString('tr-TR')} birim/gün
                    <div>Kâr vergisi: ort. %{taxPct}</div>
                  </div>
                </div>
                <div className="g-track h-3.5 flex overflow-hidden" aria-label="Pazar dağılımı">
                  <div className="g-fill" style={{ width: `${myPct}%` }} />
                  <div
                    className="h-full bg-[var(--g-red)] opacity-70"
                    style={{ width: `${rivalPct}%` }}
                  />
                </div>
                <div className="text-[13px] text-[var(--g-muted)] font-semibold">
                  Yeşil: sen · Kırmızı: rakipler · Gri: boş pazar
                </div>
                <div className="flex flex-wrap gap-1.5 text-[13px]">
                  {rivals.map((r) => (
                    <span
                      key={r.ticker}
                      className="g-pill"
                      data-testid={`company-rival-${r.ticker}`}
                    >
                      {r.isControlledByPlayer ? 'Senin: ' : ''}
                      {r.name.split(' ')[0]} %
                      {Math.round(((r.financials.dailyUnitsSold ?? 0) / market) * 100)}
                    </span>
                  ))}
                </div>
                {ops.marketSaturated && (
                  <>
                    <div className="g-tip" data-testid="company-market-full-tip">
                      Pazar doldu: fazla üretim satılmıyor. Daha çok satmak için bir rakibi devral
                      ya da fiyat, kalite ve pazarlamayla payını büyüt. Fazla personeli azaltmak kârı korur.
                    </div>
                    <button
                      type="button"
                      data-testid="company-market-takeover-btn"
                      onClick={() => onOpenBuilding?.(state.stageUnlocks.stage4Holding ? 'HOLDING_MERKEZI' : 'BORSA')}
                      className="g-btn g-btn-navy w-full"
                    >
                      Rakipleri gör
                    </button>
                  </>
                )}
              </div>
            );
          })()}

          {/* 3 Kısa Durum Mesajı (Gerçek Veriden Üretilen) */}
          <button
            type="button"
            data-testid="company-summary-more-toggle"
            onClick={() => setShowSummaryMore((v) => !v)}
            className="g-btn g-btn-secondary w-full"
          >
            {showSummaryMore ? '▲ Durum ve önerileri gizle' : 'Durum özeti ve öneriler'}
          </button>
          <div
            className={`p-3 rounded-2xl bg-white border border-slate-200 space-y-2 ${showSummaryMore ? '' : 'hidden'}`}
            data-testid="company-summary-status-messages"
          >
            <div className="font-bold text-slate-900">
              Şirket Durum Özeti
            </div>
            <div className="space-y-1.5 text-[13px]">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2">
                <span className="font-bold text-slate-700 shrink-0">
                  Üretim:
                </span>
                <span className="text-slate-700">{statusProductionMsg}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2">
                <span className="font-bold text-slate-700 shrink-0">
                  Finans:
                </span>
                <span className="text-slate-700">{statusFinanceMsg}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2">
                <span className="font-bold text-slate-700 shrink-0">
                  Fırsat:
                </span>
                <span className="text-slate-700">{statusGrowthMsg}</span>
              </div>
            </div>
          </div>

          {/* Önerilen İşlemler (En fazla 3 öneri — ilgili bölüme yönlendirir) */}
          <div
            className={`p-3 rounded-2xl bg-white border border-slate-200 space-y-2 ${showSummaryMore ? '' : 'hidden'}`}
            data-testid="company-recommended-actions"
          >
            <div className="font-bold text-slate-900">
              Önerilen İşlemler ({recommendedNavActions.slice(0, 3).length})
            </div>
            <div className="space-y-2">
              {recommendedNavActions.slice(0, 3).map((rec) => (
                <div
                  key={rec.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900">{rec.title}</div>
                    <div className="text-[13px] text-slate-600">
                      {rec.reason}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid={`recommended-nav-${rec.targetTab}`}
                    onClick={() => setCompanySubTab(rec.targetTab)}
                    className="g-btn g-btn-navy px-3 shrink-0"
                  >
                    {rec.ctaLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          BÖLÜM 2: ÜRETİM (Sadeleştirilmiş Üretim, Kapasite, Darboğaz ve "Üretimi Artır")
         ===================================================================== */}
      {companySubTab === 'URETIM' && (
        <div className="space-y-3" data-testid="company-section-URETIM">
          <div className="g-hero p-5 space-y-3">
            <div className="text-center">
              <div className="text-sm font-bold text-white/65">Bugünkü üretim</div>
              <div className="text-5xl font-extrabold tabular-nums g-hero-value">
                {actualProd.toFixed(0)}
                <span className="text-2xl text-white/65"> / {installedCap}</span>
              </div>
            </div>
            <div className="g-track h-3">
              <div
                className="g-fill"
                style={{ width: `${Math.min(100, Number(capacityUtilizationPct) || 0)}%` }}
              />
            </div>
            <div
              data-testid="production-main-bottleneck"
              className={`text-center text-sm font-extrabold ${
                mainBottleneckTR.startsWith('Darboğaz yok')
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }`}
            >
              {mainBottleneckTR.startsWith('Darboğaz yok') ? 'Her şey yolunda' : `${mainBottleneckTR}`}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="g-card p-3">
              <div className="text-[13px] text-slate-500">Satılan</div>
              <div className="font-extrabold text-emerald-700 tabular-nums">
                {ops.actualSalesUnits.toFixed(0)}
              </div>
            </div>
            <div className="g-card p-3">
              <div className="text-[13px] text-slate-500">Stok</div>
              <div className="font-extrabold text-slate-900 tabular-nums">
                {ops.inventoryUnits.toFixed(0)}
              </div>
            </div>
            <div className="g-card p-3">
              <div className="text-[13px] text-slate-500">Birim fiyat</div>
              <div className="font-extrabold text-slate-900 tabular-nums">
                {formatCurrency(ops.salePrice)}
              </div>
            </div>
          </div>

          {/* Ana Aksiyon Düğmesi: "Üretimi Artır" */}
          <div className="g-card p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="g-section-title">
                  Daha çok üret
                </div>
              </div>
              <button
                type="button"
                data-testid="toggle-increase-production-btn"
                onClick={() => setShowProductionGuide((prev) => !prev)}
                className="g-btn g-btn-primary px-5 shrink-0"
              >
                Başla
              </button>
            </div>

            {showProductionGuide && (
              <div
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                data-testid="production-increase-guide-panel"
              >
                <div className="font-semibold text-slate-800">
                  Hedef Üretim Seçin
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: '50K', label: '50.000' },
                      { id: '100K', label: '100.000' },
                      { id: '250K', label: '250.000' },
                      { id: 'CAP_25', label: 'Kapasitenin %25’i' },
                      { id: 'CAP_50', label: 'Kapasitenin %50’si' },
                      { id: 'CUSTOM', label: 'Özel hedef' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setProdGuideTargetMode(opt.id)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[13px] font-semibold ${
                        prodGuideTargetMode === opt.id
                          ? 'g-choice is-active'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {prodGuideTargetMode === 'CUSTOM' && (
                  <div className="flex items-center gap-2">
                    <label className="text-[13px] font-semibold text-slate-700">
                      Özel Hedef (birim/gün):
                    </label>
                    <NumberInput
                      
                      min={1}
                      step={10}
                      value={prodGuideCustomUnits}
                      onChange={(e) =>
                        setProdGuideCustomUnits(
                          Math.max(1, Number(e.target.value) || 1)
                        )
                      }
                      className="min-h-[38px] px-3 rounded-xl bg-white border border-slate-300 tabular-nums text-slate-900"
                    />
                  </div>
                )}

                {/* Seçilen hedef için 5 zorunlu gösterge */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 tabular-nums text-[13px]">
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <div className="font-sans text-slate-500">
                      Gerekli yeni çalışan
                    </div>
                    <div className="font-bold text-slate-900">
                      +{guideNewWorkersNeeded} kişi
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <div className="font-sans text-slate-500">
                      Günlük ek maliyet
                    </div>
                    <div className="font-bold text-rose-700">
                      {formatCurrency(guideDailyExtraCost)}/gün
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <div className="font-sans text-slate-500">
                      Gerekli hammadde
                    </div>
                    <div className="font-bold text-slate-900">
                      {guideRequiredRawMaterial.toLocaleString('tr-TR')} br
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <div className="font-sans text-slate-500">
                      Tahmini satış
                    </div>
                    <div className="font-bold text-emerald-700">
                      {guideEstimatedSales.toFixed(0)} br/gün
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200 col-span-2 sm:col-span-1">
                    <div className="font-sans text-slate-500">
                      Tahmini stok riski
                    </div>
                    <div className="font-sans font-bold text-amber-800">
                      {guideStockRiskLabel}
                    </div>
                  </div>
                </div>

                {capacityUtilizationPct < 70 && (
                  <div className="g-tip">
                    Mevcut En Fazla Üretim kapasitenizin yalnızca %
                    {capacityUtilizationPct.toString().replace('.', ',')}’i
                    kullanılıyor. Yeni tesis yatırımı yerine önce mevcut
                    kapasiteyi ve çalışan sayısını tamamlamanız önerilir.
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onConfigureOperations({
                        plannedProductionUnits: guideBoundedUnits,
                      })
                    }
                    className="g-btn g-btn-navy px-3.5"
                  >
                    Üretim Hedefini Uygula ({guideBoundedUnits} birim/gün)
                  </button>
                  {guideNewWorkersNeeded > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setHireCountInput(guideNewWorkersNeeded);
                        setCompanySubTab('CALISANLAR');
                      }}
                      className="g-btn g-btn-primary px-3.5"
                    >
                      Gerekli Çalışanı Almak İçin Çalışanlar’a Git (+
                      {guideNewWorkersNeeded})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Ürün Fiyatlandırma ve Stok Eritme */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
              <NumberInput
                
                min={20}
                step={10}
                placeholder="Yeni birim satış fiyatı"
                value={customSalePrice || ops.salePrice}
                onChange={(e) =>
                  setCustomSalePrice(Math.max(10, Number(e.target.value) || 10))
                }
                className="min-h-[40px] px-3 rounded-xl bg-slate-50 border border-slate-300 tabular-nums text-slate-900"
              />
              <button
                type="button"
                onClick={() =>
                  onConfigureOperations({
                    unitSalePrice: customSalePrice || ops.salePrice,
                  })
                }
                className="g-btn g-btn-navy px-3.5"
              >
                Satış Fiyatını Güncelle
              </button>
              <button
                type="button"
                disabled={ops.inventoryUnits <= 0}
                onClick={() =>
                  onLiquidateInventory &&
                  onLiquidateInventory(
                    Math.max(1, Math.floor(ops.inventoryUnits * 0.5)),
                    0.2
                  )
                }
                className="g-btn g-btn-gold px-3.5"
              >
                Stoğun %50’sini İndirimli Sat (%20 İndirim)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          BÖLÜM 3: ÇALIŞANLAR (İşçi Alımı Düzeltmesi, Önizleme, Onay ve Vardiya)
         ===================================================================== */}
      {companySubTab === 'CALISANLAR' && (
        <div className="space-y-3" data-testid="company-section-CALISANLAR">
          <div className="g-hero p-5 text-center">
            <div
              data-testid="company-total-staff-count"
              className="text-5xl font-extrabold tabular-nums g-hero-value"
            >
              {pc.staffCount}
            </div>
            <div className="text-sm font-bold text-white/65 mt-1">
              çalışan {workersShortfall > 0 ? `· ${workersShortfall} kişi eksik` : '· yeterli'}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm font-bold">
              <div className="rounded-2xl g-hero-tile p-2">
                <div className="text-[13px] text-white/65">Günlük maaş</div>
                <div className="text-[#ffb4b2] tabular-nums">{formatCurrency(dailyTotalPayroll)}</div>
              </div>
              <div className="rounded-2xl g-hero-tile p-2">
                <div className="text-[13px] text-white/65">Memnuniyet</div>
                <div className="text-white/65 tabular-nums">%{workerSatisfactionPct}</div>
              </div>
            </div>
          </div>

          {/* ÇALIŞAN AL (İŞÇİ ALIMI) PANELİ */}
          <div
            className="g-card p-4 space-y-4"
            data-testid="worker-hire-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="g-section-title">Çalışan al</h4>
              </div>
              <span className="tabular-nums text-[13px] text-slate-700">
                Kasa: <strong>{formatCurrency(pc.financials.cash)}</strong>
              </span>
            </div>

            {/* Hızlı İşe Alım Seçenekleri: +10, +100, +500, +1.000, İhtiyaç kadar, Özel sayı */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '+10', count: 10, testId: 'hire-preset-10' },
                { label: '+100', count: 100, testId: 'hire-preset-100' },
                { label: '+500', count: 500, testId: 'hire-preset-500' },
                { label: '+1.000', count: 1000, testId: 'hire-preset-1000' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  data-testid={preset.testId}
                  onClick={() => {
                    setHireCountInput(preset.count);
                    setHireFeedback(null);
                  }}
                  className={`min-h-[52px] px-3 py-1 rounded-2xl tabular-nums font-extrabold text-base active:scale-95 ${
                    hireCountInput === preset.count
                      ? 'g-choice is-active'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              <button
                type="button"
                data-testid="hire-preset-needed"
                onClick={() => {
                  setHireCountInput(Math.max(1, workersShortfall || 5));
                  setHireFeedback(null);
                }}
                className="min-h-[52px] px-2 py-1 g-card-soft text-teal-900 font-extrabold text-sm active:scale-95"
              >
                Yeter kadar (+{Math.max(1, workersShortfall || 5)})
              </button>

              <div className="hidden">
                <label
                  htmlFor="hire-custom-count-input"
                  className="text-[13px] font-semibold text-slate-600"
                >
                  Özel sayı:
                </label>
                <NumberInput
                  id="hire-custom-count-input"
                  data-testid="hire-custom-input"
                  
                  min={1}
                  max={50000}
                  step={1}
                  value={hireCountInput}
                  onChange={(e) => {
                    setHireCountInput(
                      Math.max(0, Math.floor(Number(e.target.value) || 0))
                    );
                    setHireFeedback(null);
                  }}
                  className="w-24 min-h-[36px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 tabular-nums text-slate-900"
                />
              </div>
            </div>

            <div
              className="rounded-3xl bg-slate-50 p-4 text-center space-y-1 tabular-nums"
              data-testid="hire-preview-box"
            >
              <div className="text-3xl font-extrabold text-slate-900">+{cleanHireCount} kişi</div>
              <div className="text-sm font-bold text-rose-700">
                Şimdi {formatCurrency(hireOnboardingCost)} · her gün +{formatCurrency(hireDailyExtraWage)}
              </div>
              <div className="text-sm font-bold text-emerald-700">
                Üretim +{estimatedProdGainFromHire.toFixed(0)} birim/gün
              </div>
              <div className={`text-[13px] font-semibold ${cashAfterHire >= 0 ? 'text-slate-500' : 'text-rose-700'}`}>
                Sonra kasada: {formatCurrency(cashAfterHire)}
              </div>
            </div>

            {!canAffordHire && cleanHireCount > 0 && (
              <div
                data-testid="hire-insufficient-cash-warning"
                className="p-2.5 g-card-soft text-rose-800 text-[13px] font-semibold"
              >
                Şirket kasası yetmiyor. Önce "Para" sekmesinden şirkete para aktar.
              </div>
            )}

            {hireFeedback && (
              <div
                data-testid="hire-feedback-banner"
                className={`p-2.5 rounded-xl border text-[13px] font-semibold ${
                  hireFeedback.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {hireFeedback.text}
              </div>
            )}

            <button
              type="button"
              data-testid="confirm-hire-workers-btn"
              disabled={!canAffordHire}
              onClick={() => {
                if (cleanHireCount <= 0) {
                  setHireFeedback({
                    ok: false,
                    text: 'İşe alınacak çalışan sayısı 0’dan büyük olmalıdır.',
                  });
                  return;
                }
                if (hireOnboardingCost > pc.financials.cash) {
                  setHireFeedback({
                    ok: false,
                    text: 'Şirket kasası yetersiz olduğu için işe alım reddedildi.',
                  });
                  return;
                }
                const targetTotal = pc.staffCount + cleanHireCount;
                onConfigureOperations({ targetStaffCount: targetTotal });
                setHireFeedback({
                  ok: true,
                  text: `+${cleanHireCount} yeni çalışan işe alındı. Toplam çalışan: ${targetTotal} kişi.`,
                });
              }}
              className="g-btn g-btn-primary w-full"
            >
              Çalışan al
            </button>
          </div>

          {/* Vardiya Düzeni ve Maaş Politikası */}
          <div className="g-card p-4 space-y-4">
            <div className="g-section-title">Çalışma düzeni</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { sh: 1 as const, emoji: '☀️', title: 'Tek vardiya', desc: 'Normal' },
                  { sh: 2 as const, emoji: '🌤️', title: 'İki vardiya', desc: '%65 daha çok üretim' },
                  { sh: 3 as const, emoji: '🌙', title: 'Üç vardiya', desc: '2 kattan fazla üretim' },
                ] as const
              ).map((item) => (
                <button
                  key={item.sh}
                  type="button"
                  data-testid={`shift-select-${item.sh}`}
                  onClick={() => onConfigureOperations({ shiftCount: item.sh })}
                  className={`p-3 rounded-3xl text-center active:scale-95 ${
                    wf.shifts === item.sh
                      ? 'g-choice is-active'
                      : 'g-choice'
                  }`}
                >
                  <div className="text-3xl">{item.emoji}</div>
                  <div className="font-extrabold text-sm mt-1">{item.title}</div>
                  <div className={`text-[13px] mt-0.5 ${wf.shifts === item.sh ? 'text-slate-300' : 'text-slate-500'}`}>
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>

            <div className="text-sm font-bold text-slate-700">Maaş</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'ECONOMY' as SalaryTier, label: 'Düşük' },
                  { id: 'STANDARD' as SalaryTier, label: 'Normal' },
                  { id: 'COMPETITIVE' as SalaryTier, label: 'Yüksek' },
                ] as const
              ).map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => onConfigureOperations({ salaryTier: tier.id })}
                  className={`min-h-[52px] rounded-2xl font-extrabold text-sm active:scale-95 ${
                    wf.salaryTier === tier.id
                      ? 'g-choice is-active'
                      : 'g-choice'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
            <div className="text-[13px] text-slate-500 text-center">
              Yüksek maaş = mutlu çalışan, daha çok üretim.
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          BÖLÜM 4: FİNANS (Sade Özet + 4 Ana Aksiyon + Daraltılabilir Ayrıntılı Rapor)
         ===================================================================== */}
      {companySubTab === 'FINANS' && (
        <div className="space-y-3" data-testid="company-section-FINANS">
          <div className="g-hero p-5 text-center">
            <div className="text-sm font-bold text-white/65">Şirket kasası</div>
            <div className="text-4xl font-extrabold tabular-nums g-hero-value">
              {formatCurrency(pc.financials.cash)}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
            <div className="g-card p-3">
              <div className="text-[13px] text-slate-500">Gelir</div>
              <div className="font-extrabold text-emerald-700">{formatCurrency(dailyRevenue)}</div>
            </div>
            <div className="g-card p-3">
              <div className="text-[13px] text-slate-500">Gider</div>
              <div className="font-extrabold text-rose-700">{formatCurrency(dailyExpenses)}</div>
            </div>
            <div className="g-card p-3">
              <div className="text-[13px] text-slate-500">Borç</div>
              <div className="font-extrabold text-slate-900">{formatCurrency(pc.financials.totalLiabilities)}</div>
            </div>
          </div>
          {nextCompanyLoan && (
            <div className="g-card-soft px-3 py-2 text-sm font-bold text-amber-900 text-center">
              Sıradaki ödeme: {formatCurrency(nextCompanyLoan.installmentAmount)} (Gün {nextCompanyLoan.nextPaymentGameDay})
            </div>
          )}

          {/* 4 Ana Finans İşlemi: Para Aktar, Kredi Çek, Borçları Gör, Ayrıntılı Rapor */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="finance-action-transfer-btn"
              onClick={() => setShowInlineTransferPanel((prev) => !prev)}
              className="g-btn g-btn-primary px-3"
            >
              Para aktar
            </button>

            <button
              type="button"
              data-testid="finance-action-loan-btn"
              onClick={() => {
                if (onOpenBuilding) {
                  onOpenBuilding('BANKA');
                } else {
                  setShowCompanyLoansPanel(true);
                }
              }}
              className="g-btn g-btn-navy px-3"
            >
              Kredi çek
            </button>

            <button
              type="button"
              data-testid="finance-action-debts-btn"
              onClick={() => setShowCompanyLoansPanel((prev) => !prev)}
              className="g-btn g-btn-secondary px-3"
            >
              Borçlar ({companyLoans.length})
            </button>

            <button
              type="button"
              data-testid="toggle-detailed-finance-report-btn"
              aria-expanded={showDetailedFinanceReport}
              onClick={() => setShowDetailedFinanceReport((prev) => !prev)}
              className={`min-h-[52px] px-3 py-2 rounded-2xl font-extrabold border active:scale-95 ${
                showDetailedFinanceReport
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
              }`}
            >
              Rapor
            </button>
          </div>

          {/* Para Aktar Paneli */}
          {showInlineTransferPanel && (
            <div className="g-card p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900">
                  Şirkete para aktar
                </div>
                {onOpenBuilding && (
                  <button
                    type="button"
                    onClick={() => onOpenBuilding('BANKA')}
                    className="text-[13px] font-bold text-teal-700 hover:underline"
                  >
                    Banka →
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <NumberInput
                  
                  min={50_000}
                  step={50_000}
                  value={injectAmount}
                  onChange={(e) =>
                    setInjectAmount(
                      Math.max(10_000, Number(e.target.value) || 10_000)
                    )
                  }
                  className="flex-1 min-h-[40px] px-3 rounded-xl bg-slate-50 border border-slate-300 tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => onTransferCapital(injectAmount)}
                  className="g-btn g-btn-primary px-4"
                >
                  Aktar ({formatCurrency(injectAmount)})
                </button>
              </div>
            </div>
          )}

          {/* Borçları Gör Paneli */}
          {showCompanyLoansPanel && (
            <div
              className="g-card p-3.5 space-y-2.5"
              data-testid="company-debts-panel"
            >
              <div className="font-bold text-slate-900">
                Şirket Borç Dökümü ({companyLoans.length} Aktif Kredi)
              </div>
              <div className="grid grid-cols-3 gap-2 tabular-nums text-[13px]">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-sans text-slate-500">
                    Kısa Vadeli Borç
                  </div>
                  <div className="font-bold text-slate-900">
                    {formatCurrency(pc.financials.shortTermDebt)}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-sans text-slate-500">
                    Uzun Vadeli Borç
                  </div>
                  <div className="font-bold text-slate-900">
                    {formatCurrency(pc.financials.longTermDebt)}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-sans text-slate-500">Toplam Borç</div>
                  <div className="font-bold text-rose-700">
                    {formatCurrency(pc.financials.totalLiabilities)}
                  </div>
                </div>
              </div>
              {companyLoans.length > 0 && (
                <div className="space-y-1.5">
                  {companyLoans.map((ln) => (
                    <div
                      key={ln.loanId}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 tabular-nums text-[13px]"
                    >
                      <div>
                        <div className="font-sans font-bold text-slate-900">
                          {LOAN_TYPE_CATALOG[ln.loanType]?.labelTR ??
                            ln.loanType}
                        </div>
                        <div className="text-[13px] text-slate-500">
                          Kalan Anapara:{' '}
                          {formatCurrency(ln.remainingPrincipal)} · Taksit:{' '}
                          {formatCurrency(ln.installmentAmount)} (Gün{' '}
                          {ln.nextPaymentGameDay})
                        </div>
                      </div>
                      {onPayLoanInstallment && (
                        <button
                          type="button"
                          onClick={() => onPayLoanInstallment(ln.loanId)}
                          className="g-btn g-btn-navy px-2.5"
                        >
                          Taksit Öde
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ayrıntılı Rapor (Varsayılan olarak kapalıdır!) */}
          {showDetailedFinanceReport && inc && (
            <div
              className="g-card p-3.5 space-y-3"
              data-testid="detailed-finance-report-panel"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900">
                  Ayrıntılı Finans Raporu ve Hesap Hareketleri
                </h4>
                <span className="text-[13px] font-semibold text-emerald-700">
                  Finans Kontrolü: Doğrulandı
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 tabular-nums text-[13px]">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-sans text-slate-500">Yıllık Ciro</div>
                  <div className="font-bold text-slate-900">
                    {formatCurrency(inc.totalRevenue)}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-sans text-slate-500">
                    Faaliyet Kârı
                  </div>
                  <div className="font-bold text-emerald-700">
                    {formatCurrency(inc.operatingProfit)}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-sans text-slate-500">
                    FAVÖK (Faiz, Amortisman, Vergi Öncesi)
                  </div>
                  <div className="font-bold text-emerald-700">
                    {formatCurrency(inc.EBITDA)} (%{inc.ebitdaMarginPct})
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-sans text-slate-500">Net Kâr</div>
                  <div className="font-bold text-slate-900">
                    {formatCurrency(inc.netProfit)}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-sans text-slate-500">
                    Serbest Nakit Akışı
                  </div>
                  <div className="font-bold text-slate-900">
                    {formatCurrency(inc.freeCashFlow)}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-sans text-slate-500">
                    Borç / Özsermaye
                  </div>
                  <div className="font-bold text-slate-900">
                    {inc.debtToEquityRatio}x · Özsermaye Karlılığı: %
                    {inc.returnOnEquityPct}
                  </div>
                </div>
              </div>

              {/* Hesap Hareketleri */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <div className="font-bold text-slate-900">
                  Hesap Hareketleri ({companyLedgerTxs.length})
                </div>
                {companyLedgerTxs.length === 0 ? (
                  <div className="p-2.5 rounded-xl bg-slate-50 text-slate-500 text-center">
                    Henüz kaydedilmiş şirket hesap hareketi bulunmuyor.
                  </div>
                ) : (
                  <div
                    className="space-y-1.5 max-h-48 overflow-y-auto"
                    data-testid="company-ledger-transactions-list"
                  >
                    {companyLedgerTxs.slice(0, 20).map((ltx) => (
                      <div
                        key={ltx.transactionId}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 tabular-nums text-[13px]"
                      >
                        <div className="min-w-0">
                          <div className="font-sans font-bold text-slate-900 truncate">
                            {ltx.description}
                          </div>
                          <div className="text-[13px] text-slate-500">
                            Gün {ltx.gameDay} ·{' '}
                            {TRANSFER_CATEGORY_LABELS_TR[ltx.category] ??
                              ltx.category}
                          </div>
                        </div>
                        <span className="font-bold text-slate-900 shrink-0">
                          {formatCurrency(ltx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Halka Arz (IPO) Uygunluk Kartı */}
              {!pc.isPubliclyListed && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      Halka Arz (IPO) Durumu
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded tabular-nums font-bold text-[13px] ${
                        ipoEligibility.eligible
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ipoEligibility.eligible ? 'UYGUN' : 'HAZIRLANIYOR'}
                    </span>
                  </div>
                  {!ipoEligibility.eligible &&
                    ipoEligibility.reasons.length > 0 && (
                      <ul className="text-[13px] text-slate-600 space-y-0.5">
                        {deriveDeterministicIpoReasonItems(
                          ipoEligibility.reasons
                        ).map((item) => (
                          <li key={item.id}>• {item.text}</li>
                        ))}
                      </ul>
                    )}
                  <button
                    type="button"
                    disabled={!ipoEligibility.eligible}
                    onClick={() => onExecuteIPO(0.3, 0.12, 0.35)}
                    className="g-btn g-btn-navy w-full"
                  >
                    Şirketi Halka Arz Et (%30 Halka Açıklık · %12 İskonto)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          BÖLÜM 5: GELİŞİM (TEK YATIRIM MERKEZİ: Tesis, Hat, Fabrika, Depo, Otomasyon, Ar-Ge, Lojistik)
         ===================================================================== */}
      {companySubTab === 'GELISIM' && (
        <div className="space-y-3" data-testid="company-section-GELISIM">
          {/* Düşük kapasite kullanımı uyarısı (%70'in altındaysa) */}
          {capacityUtilizationPct < 70 && (
            <div
              data-testid="low-capacity-utilization-warning"
              className="g-tip"
            >
              Fabrikanın yalnızca %
              {capacityUtilizationPct.toString().replace('.', ',')}’i dolu.
              Yeni tesisten önce çalışan ekle.
            </div>
          )}

          {/* Yeni Yatırım Kartı (Tek Yatırım Merkezi) */}
          <div className="g-card p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="g-section-title">
                  Büyüme yatırımı
                </h4>
              </div>
              <span className="tabular-nums text-sm font-bold text-teal-800">
                {formatCurrency(invQuote.safeAvailableBudget)}
              </span>
            </div>

            <div className="hidden">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                  Yatırım Türü Seçin
                </label>
                <select
                  data-testid="company-inv-package-select"
                  value={selectedInvPkg}
                  onChange={(e) =>
                    setSelectedInvPkg(e.target.value as InvestmentPackageType)
                  }
                  className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-semibold"
                >
                  {(
                    Object.keys(
                      INVESTMENT_PACKAGE_CATALOG
                    ) as InvestmentPackageType[]
                  ).map((pk) => (
                    <option key={pk} value={pk}>
                      {INVESTMENT_PACKAGE_CATALOG[pk].titleTR}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                  Finansman Kaynağı
                </label>
                <select
                  value={invFundingSource}
                  onChange={(e) =>
                    setInvFundingSource(
                      e.target.value as 'COMPANY_CASH' | 'BANK_LOAN'
                    )
                  }
                  className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-semibold"
                >
                  <option value="COMPANY_CASH">
                    Şirket Kasası (Özsermaye)
                  </option>
                  <option value="BANK_LOAN">
                    Banka Yatırım Kredisi Destekli
                  </option>
                </select>
              </div>
            </div>

            {/* Yatırım Seçenekleri (Sadece Gelişim Sekmesinde Tek Yerde!) */}
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { label: 'Küçük büyüme', pkg: 'SMALL_EXPANSION' as const },
                  { label: 'Orta büyüme', pkg: 'MEDIUM_EXPANSION' as const },
                  { label: 'Büyük büyüme', pkg: 'LARGE_EXPANSION' as const },
                  {
                    label: 'Yeni üretim hattı',
                    pkg: 'NEW_PRODUCTION_LINE' as const,
                  },
                  { label: 'Yeni fabrika', pkg: 'NEW_FACTORY' as const },
                  {
                    label: 'Depo & lojistik',
                    pkg: 'CUSTOM_TARGET' as const,
                  },
                  {
                    label: 'Otomasyon',
                    pkg: 'BUDGET_MAX' as const,
                  },
                ] as const
              ).map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setSelectedInvPkg(b.pkg)}
                  className={`min-h-[52px] px-2 py-1 rounded-2xl text-sm font-extrabold active:scale-95 ${
                    selectedInvPkg === b.pkg
                      ? 'g-choice is-active'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            {selectedInvPkg === 'CUSTOM_TARGET' && (
              <div className="flex items-center gap-2">
                <label className="text-[13px] font-semibold text-slate-700">
                  Hedef Ek Kapasite (birim/gün):
                </label>
                <NumberInput
                  
                  min={5}
                  max={10000}
                  value={customCapDelta}
                  onChange={(e) =>
                    setCustomCapDelta(Math.max(5, Number(e.target.value) || 5))
                  }
                  className="w-32 min-h-[38px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 tabular-nums text-xs"
                />
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums text-[13px]">
              <div>
                <div className="font-sans text-slate-500">
                  Kapasite
                </div>
                <div className="font-bold text-emerald-700">
                  +{invQuote.capacityGainUnits} birim/gün
                </div>
              </div>
              <div>
                <div className="font-sans text-slate-500">
                  Maliyet
                </div>
                <div className="font-bold text-slate-900">
                  {formatCurrency(invQuote.totalCost)}
                </div>
              </div>
              <div>
                <div className="font-sans text-slate-500">
                  Süre
                </div>
                <div className="font-bold text-amber-800">
                  {invQuote.durationDays} Gün (%
                  {invQuote.temporaryDisruptionPct} geçici kesinti)
                </div>
              </div>
              <div>
                <div className="font-sans text-slate-500">Vazgeçersen kesinti</div>
                <div className="font-bold text-rose-700">
                  {formatCurrency(invQuote.cancellationCost)}
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="start-investment-project-btn"
              onClick={() => {
                if (onStartInvestmentProject) {
                  onStartInvestmentProject({
                    packageType: selectedInvPkg,
                    customCapacityGain:
                      selectedInvPkg === 'CUSTOM_TARGET'
                        ? customCapDelta
                        : undefined,
                    budgetMaxMode: selectedInvPkg === 'BUDGET_MAX',
                    fundingSource: invFundingSource,
                  });
                } else {
                  onConfigureOperations({
                    targetProductionCapacity:
                      pc.productionCapacity + invQuote.capacityGainUnits,
                  });
                }
              }}
              className="g-btn g-btn-primary w-full"
            >
              Yatırımı başlat (+{invQuote.capacityGainUnits}{' '}
              birim/gün · {formatCurrency(invQuote.totalCost)})
            </button>

            {/* Devam Eden Yatırımlar */}
            {(pc.investmentProjects ?? []).length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <div className="font-bold text-slate-900">
                  Yatırım Geçmişi ve Devam Eden Projeler (
                  {pc.investmentProjects?.length})
                </div>
                {(pc.investmentProjects ?? []).slice(0, 5).map((prj) => (
                  <div
                    key={prj.projectId}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {prj.title} (+{prj.capacityGainUnits} birim/gün)
                      </div>
                      <div className="text-[13px] tabular-nums text-slate-500">
                        Durum: {prj.status} · İlerleme: %
                        {prj.progressPct.toFixed(0)} · Bitiş: Gün{' '}
                        {prj.estimatedEndDay}
                      </div>
                    </div>
                    {prj.status === 'IN_PROGRESS' &&
                      onCancelInvestmentProject && (
                        <button
                          type="button"
                          onClick={() =>
                            onCancelInvestmentProject(prj.projectId)
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[13px]"
                        >
                          İptal Et
                        </button>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ar-Ge ve Teknoloji Geliştirme Kartı */}
          <div className="g-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900">
                  Ürün kalitesi (Ar-Ge)
                </h4>
              </div>
              <span className="tabular-nums font-bold text-slate-900">
                x{pc.techQualityMultiplier.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="tabular-nums text-slate-700">
                Her gün:{' '}
                <strong>{formatCurrency(pc.dailyRdBudget)}/gün</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onConfigureOperations({
                      dailyRdBudget: Math.max(0, pc.dailyRdBudget - 5_000),
                    })
                  }
                  className="g-btn g-btn-secondary px-4"
                >
                  − ₺5.000
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onConfigureOperations({
                      dailyRdBudget: pc.dailyRdBudget + 10_000,
                    })
                  }
                  className="g-btn g-btn-navy px-4"
                >
                  + ₺10.000
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
