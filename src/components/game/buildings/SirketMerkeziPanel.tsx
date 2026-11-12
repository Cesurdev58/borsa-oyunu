/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SIRKET_MERKEZI bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import { PROGRESSION_RULES } from '../../../engine/ProgressionRules';
import React, {
  useEffect,
  useState,
} from 'react';
import {
  Lock,
} from 'lucide-react';
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
        <div className="p-4 rounded-3xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-400 text-white shadow-lg space-y-3">
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
                className="h-full bg-gradient-to-r from-amber-300 to-yellow-400 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between tabular-nums text-[13px] font-bold">
              <span>{formatCurrency(state.netWorth)}</span>
              <span>%{progressPct}</span>
              <span>🎯 {formatCurrency(PROGRESSION_RULES.entrepreneurNetWorth)}</span>
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
              📈 Borsaya git, parayı büyüt
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!pc) {
    return (
      <div
        className="space-y-4 text-xs"
        data-testid="sheet-content-SIRKET_MERKEZI-founding"
      >
        <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-3">
          <h3 className="text-sm font-bold text-teal-950">
            🏢 Kendi şirketini kur!
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                Şirketin adı
              </label>
              <input
                type="text"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                Borsa kodu (3-4 harf)
              </label>
              <input
                type="text"
                maxLength={5}
                value={compTicker}
                onChange={(e) => setCompTicker(e.target.value.toUpperCase())}
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 tabular-nums text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                Sektör
              </label>
              <select
                value={compSector}
                onChange={(e) => setCompSector(e.target.value as SectorId)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 text-slate-900"
              >
                {(Object.keys(SECTOR_CONFIGS) as SectorId[]).map((s) => (
                  <option key={s} value={s}>
                    {SECTOR_CONFIGS[s].name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                Kasaya koyacağın para (en az 400.000 TL)
              </label>
              <input
                type="number"
                min={400_000}
                step={50_000}
                value={compCapital}
                onChange={(e) =>
                  setCompCapital(Math.max(400_000, Number(e.target.value) || 400_000))
                }
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 tabular-nums text-slate-900"
              />
            </div>
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
            className="w-full min-h-[44px] rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs"
          >
            Şirketi Kur ({formatCurrency(compCapital)})
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
      <div className="p-4 rounded-3xl bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-500 text-white shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/25 flex items-center justify-center text-2xl shrink-0">
            🏢
          </div>
          <div className="min-w-0">
            <div className="text-base font-extrabold truncate">{pc.name}</div>
            <div className="text-sm opacity-95">
              {pc.ticker} · {pc.operatingDays}. gün
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/20 p-2.5">
            <div className="text-[13px] opacity-90">Şirket değeri</div>
            <div className="font-extrabold tabular-nums">
              {formatCurrency(pc.equityValue)}
            </div>
          </div>
          <div className="rounded-2xl bg-white/20 p-2.5">
            <div className="text-[13px] opacity-90">Şirket kasası</div>
            <div className="font-extrabold tabular-nums">
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
        className="grid grid-cols-5 gap-1 p-1 rounded-2xl bg-white border border-slate-200 shadow-sm"
      >
        {(
          [
            { id: 'OZET', label: '🏠 Özet' },
            { id: 'URETIM', label: '🏭 Üretim' },
            { id: 'CALISANLAR', label: '👥 Ekip' },
            { id: 'FINANS', label: '💰 Para' },
            { id: 'GELISIM', label: '🚀 Gelişim' },
          ] as const
        ).map((tab) => (
          <button
            key={`company-subtab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={companySubTab === tab.id}
            data-testid={`company-subtab-${tab.id}`}
            onClick={() => setCompanySubTab(tab.id)}
            className={`min-h-[52px] px-0.5 py-1 rounded-xl text-[12px] leading-tight font-bold text-center transition-colors ${
              companySubTab === tab.id
                ? 'bg-gradient-to-b from-violet-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <span className="block text-lg leading-none">
              {tab.label.split(' ')[0]}
            </span>
            <span className="block mt-0.5">{tab.label.split(' ')[1]}</span>
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
              className={`p-3 rounded-2xl ${
                dailyNetProfit >= 0 ? 'bg-emerald-50' : 'bg-rose-50'
              }`}
            >
              <div className="text-[13px] text-slate-600">💵 Bugünkü kâr</div>
              <div
                className={`text-base font-extrabold ${
                  dailyNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {dailyNetProfit >= 0 ? '+' : ''}
                {formatCurrency(dailyNetProfit)}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-sky-50">
              <div className="text-[13px] text-slate-600">🏭 Bugünkü üretim</div>
              <div className="text-base font-extrabold text-slate-900">
                {actualProd.toFixed(0)} birim
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50">
              <div className="text-[13px] text-slate-600">🛍️ Bugünkü satış</div>
              <div className="text-base font-extrabold text-slate-900">
                {ops.actualSalesUnits.toFixed(0)} birim
              </div>
            </div>
            <div
              className={`p-3 rounded-2xl ${
                companyHealthLabel.startsWith('Kritik')
                  ? 'bg-rose-50'
                  : companyHealthLabel === 'Sağlıklı'
                  ? 'bg-emerald-50'
                  : 'bg-amber-50'
              }`}
            >
              <div className="text-[13px] text-slate-600">❤️ Şirket durumu</div>
              <div
                className={`text-base font-extrabold ${
                  companyHealthLabel.startsWith('Kritik')
                    ? 'text-rose-700'
                    : companyHealthLabel === 'Sağlıklı'
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }`}
              >
                {companyHealthLabel}
              </div>
            </div>
          </div>

          {/* 3 Kısa Durum Mesajı (Gerçek Veriden Üretilen) */}
          <button
            type="button"
            data-testid="company-summary-more-toggle"
            onClick={() => setShowSummaryMore((v) => !v)}
            className="w-full min-h-[44px] rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm active:scale-95"
          >
            {showSummaryMore ? '▲ Durum ve önerileri gizle' : '📋 Durum özeti ve öneriler'}
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
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[13px] shrink-0"
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
          <div className="rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-100 p-5 space-y-3">
            <div className="text-center">
              <div className="text-sm font-bold text-teal-800">🏭 Bugünkü üretim</div>
              <div className="text-5xl font-extrabold text-teal-900 tabular-nums">
                {actualProd.toFixed(0)}
                <span className="text-2xl text-teal-700"> / {installedCap}</span>
              </div>
            </div>
            <div className="h-4 rounded-full bg-white/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
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
              {mainBottleneckTR.startsWith('Darboğaz yok') ? '✅ Her şey yolunda' : `⚠️ ${mainBottleneckTR}`}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white border border-slate-200 p-3">
              <div className="text-[13px] text-slate-500">🛍️ Satılan</div>
              <div className="font-extrabold text-emerald-700 tabular-nums">
                {ops.actualSalesUnits.toFixed(0)}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 p-3">
              <div className="text-[13px] text-slate-500">📦 Stok</div>
              <div className="font-extrabold text-slate-900 tabular-nums">
                {ops.inventoryUnits.toFixed(0)}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 p-3">
              <div className="text-[13px] text-slate-500">💰 Birim fiyat</div>
              <div className="font-extrabold text-slate-900 tabular-nums">
                {formatCurrency(ops.salePrice)}
              </div>
            </div>
          </div>

          {/* Ana Aksiyon Düğmesi: "Üretimi Artır" */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-lg font-extrabold text-slate-900">
                  🚀 Daha çok üret
                </div>
              </div>
              <button
                type="button"
                data-testid="toggle-increase-production-btn"
                onClick={() => setShowProductionGuide((prev) => !prev)}
                className="min-h-[48px] px-5 rounded-2xl bg-gradient-to-b from-teal-400 to-teal-600 text-white font-extrabold shadow shrink-0 active:scale-95"
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
                          ? 'bg-slate-900 text-white'
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
                    <input
                      type="number"
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
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[13px]">
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
                    className="min-h-[38px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
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
                      className="min-h-[38px] px-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold"
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
              <input
                type="number"
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
                className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
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
                className="min-h-[40px] px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-200 text-white font-bold"
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
          <div className="rounded-3xl bg-gradient-to-br from-sky-100 to-indigo-100 p-5 text-center">
            <div
              data-testid="company-total-staff-count"
              className="text-5xl font-extrabold text-indigo-900 tabular-nums"
            >
              {pc.staffCount}
            </div>
            <div className="text-sm font-bold text-indigo-800 mt-1">
              çalışan {workersShortfall > 0 ? `· ${workersShortfall} kişi eksik ⚠️` : '· yeterli ✅'}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm font-bold">
              <div className="rounded-2xl bg-white/70 p-2">
                <div className="text-[13px] text-slate-500">💸 Günlük maaş</div>
                <div className="text-rose-700 tabular-nums">{formatCurrency(dailyTotalPayroll)}</div>
              </div>
              <div className="rounded-2xl bg-white/70 p-2">
                <div className="text-[13px] text-slate-500">😊 Memnuniyet</div>
                <div className="text-emerald-700 tabular-nums">%{workerSatisfactionPct}</div>
              </div>
            </div>
          </div>

          {/* ÇALIŞAN AL (İŞÇİ ALIMI) PANELİ */}
          <div
            className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4"
            data-testid="worker-hire-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-lg font-extrabold text-slate-900">👥 Çalışan al</h4>
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
                      ? 'bg-slate-900 text-white'
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
                className="min-h-[52px] px-2 py-1 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 font-extrabold text-sm active:scale-95"
              >
                ✨ Yeter kadar (+{Math.max(1, workersShortfall || 5)})
              </button>

              <div className="hidden">
                <label
                  htmlFor="hire-custom-count-input"
                  className="text-[13px] font-semibold text-slate-600"
                >
                  Özel sayı:
                </label>
                <input
                  id="hire-custom-count-input"
                  data-testid="hire-custom-input"
                  type="number"
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
                className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[13px] font-semibold"
              >
                💸 Şirket kasası yetmiyor. Önce "Para" sekmesinden şirkete para aktar.
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
              className="w-full min-h-[56px] rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white font-extrabold shadow active:scale-95"
            >
              ✅ Çalışan al
            </button>
          </div>

          {/* Vardiya Düzeni ve Maaş Politikası */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="text-lg font-extrabold text-slate-900">🕒 Çalışma düzeni</div>
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
                      ? 'bg-slate-900 text-white shadow'
                      : 'bg-slate-50 text-slate-800'
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

            <div className="text-sm font-bold text-slate-700">💵 Maaş</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'ECONOMY' as SalaryTier, label: '💵 Düşük' },
                  { id: 'STANDARD' as SalaryTier, label: '⚖️ Normal' },
                  { id: 'COMPETITIVE' as SalaryTier, label: '💎 Yüksek' },
                ] as const
              ).map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => onConfigureOperations({ salaryTier: tier.id })}
                  className={`min-h-[52px] rounded-2xl font-extrabold text-sm active:scale-95 ${
                    wf.salaryTier === tier.id
                      ? 'bg-teal-700 text-white shadow'
                      : 'bg-slate-100 text-slate-700'
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
          <div className="rounded-3xl bg-gradient-to-br from-amber-100 to-yellow-100 p-5 text-center">
            <div className="text-sm font-bold text-amber-800">💰 Şirket kasası</div>
            <div className="text-4xl font-extrabold text-amber-900 tabular-nums">
              {formatCurrency(pc.financials.cash)}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
            <div className="rounded-2xl bg-white border border-slate-200 p-3">
              <div className="text-[13px] text-slate-500">📈 Gelir</div>
              <div className="font-extrabold text-emerald-700">{formatCurrency(dailyRevenue)}</div>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 p-3">
              <div className="text-[13px] text-slate-500">📉 Gider</div>
              <div className="font-extrabold text-rose-700">{formatCurrency(dailyExpenses)}</div>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 p-3">
              <div className="text-[13px] text-slate-500">💳 Borç</div>
              <div className="font-extrabold text-slate-900">{formatCurrency(pc.financials.totalLiabilities)}</div>
            </div>
          </div>
          {nextCompanyLoan && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-bold text-amber-900 text-center">
              ⏰ Sıradaki ödeme: {formatCurrency(nextCompanyLoan.installmentAmount)} (Gün {nextCompanyLoan.nextPaymentGameDay})
            </div>
          )}

          {/* 4 Ana Finans İşlemi: Para Aktar, Kredi Çek, Borçları Gör, Ayrıntılı Rapor */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="finance-action-transfer-btn"
              onClick={() => setShowInlineTransferPanel((prev) => !prev)}
              className="min-h-[52px] px-3 py-2 rounded-2xl bg-gradient-to-b from-teal-400 to-teal-600 text-white font-extrabold shadow active:scale-95"
            >
              💸 Para aktar
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
              className="min-h-[52px] px-3 py-2 rounded-2xl bg-slate-900 text-white font-extrabold shadow active:scale-95"
            >
              🏦 Kredi çek
            </button>

            <button
              type="button"
              data-testid="finance-action-debts-btn"
              onClick={() => setShowCompanyLoansPanel((prev) => !prev)}
              className="min-h-[52px] px-3 py-2 rounded-2xl bg-slate-100 text-slate-800 font-extrabold active:scale-95"
            >
              📒 Borçlar ({companyLoans.length})
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
              📊 Rapor
            </button>
          </div>

          {/* Para Aktar Paneli */}
          {showInlineTransferPanel && (
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900">
                  💸 Şirkete para aktar
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
                <input
                  type="number"
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
                  className="min-h-[40px] px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold"
                >
                  Aktar ({formatCurrency(injectAmount)})
                </button>
              </div>
            </div>
          )}

          {/* Borçları Gör Paneli */}
          {showCompanyLoansPanel && (
            <div
              className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2.5"
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
                          className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-sans font-bold text-[13px]"
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
              className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3"
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
                    className="w-full min-h-[40px] rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold"
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
              className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-[13px] font-medium leading-relaxed"
            >
              ⚠️ Fabrikanın yalnızca %
              {capacityUtilizationPct.toString().replace('.', ',')}’i dolu.
              Yeni tesisten önce çalışan ekle.
            </div>
          )}

          {/* Yeni Yatırım Kartı (Tek Yatırım Merkezi) */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-extrabold text-slate-900">
                  🏗️ Büyüme yatırımı
                </h4>
              </div>
              <span className="tabular-nums text-sm font-bold text-teal-800">
                💰 {formatCurrency(invQuote.safeAvailableBudget)}
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
                  { label: '🔧 Küçük büyüme', pkg: 'SMALL_EXPANSION' as const },
                  { label: '🏗️ Orta büyüme', pkg: 'MEDIUM_EXPANSION' as const },
                  { label: '🏢 Büyük büyüme', pkg: 'LARGE_EXPANSION' as const },
                  {
                    label: '⚙️ Yeni üretim hattı',
                    pkg: 'NEW_PRODUCTION_LINE' as const,
                  },
                  { label: '🏭 Yeni fabrika', pkg: 'NEW_FACTORY' as const },
                  {
                    label: '🚚 Depo & lojistik',
                    pkg: 'CUSTOM_TARGET' as const,
                  },
                  {
                    label: '🤖 Otomasyon',
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
                      ? 'bg-slate-900 text-white'
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
                <input
                  type="number"
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
                  Kapasite Artışı
                </div>
                <div className="font-bold text-emerald-700">
                  +{invQuote.capacityGainUnits} birim/gün
                </div>
              </div>
              <div>
                <div className="font-sans text-slate-500">
                  Yatırım Maliyeti
                </div>
                <div className="font-bold text-slate-900">
                  {formatCurrency(invQuote.totalCost)}
                </div>
              </div>
              <div>
                <div className="font-sans text-slate-500">
                  Tamamlanma Süresi
                </div>
                <div className="font-bold text-amber-800">
                  {invQuote.durationDays} Gün (%
                  {invQuote.temporaryDisruptionPct} geçici kesinti)
                </div>
              </div>
              <div>
                <div className="font-sans text-slate-500">İptal Bedeli</div>
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
              className="w-full min-h-[44px] rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs"
            >
              Üretim Tesisi Yatırımını Başlat (+{invQuote.capacityGainUnits}{' '}
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
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900">
                  🔬 Ürün kalitesi (Ar-Ge)
                </h4>
              </div>
              <span className="tabular-nums font-bold text-slate-900">
                ⭐ x{pc.techQualityMultiplier.toFixed(2)}
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
                  className="min-h-[48px] px-4 rounded-2xl bg-slate-100 text-slate-800 font-extrabold active:scale-95"
                >
                  ➖ ₺5.000
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onConfigureOperations({
                      dailyRdBudget: pc.dailyRdBudget + 10_000,
                    })
                  }
                  className="min-h-[48px] px-4 rounded-2xl bg-slate-900 text-white font-extrabold shadow active:scale-95"
                >
                  ➕ ₺10.000
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
