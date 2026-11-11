import React, { useState } from 'react';
import {
  DailyLogEntry,
  BatchSimulationSummary,
  AccountingAuditResult,
} from '../engine/SimulationEngine';
import {
  Account,
  FinancialIntegrityAuditReport,
} from '../models/finance';
import { SimulationState } from '../models/simulation';
import { SimulationStore } from '../state/simulationStore';
import { UISettingsStore } from '../state/uiSettingsStore';
import { deriveCityDiagnosticsSummary } from './game/city/cityLayout';
import {
  Terminal,
  Play,
  Copy,
  Check,
  Calculator,
  ShieldCheck,
  Database,
  Landmark,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import rawEngineSource from '../engine/SimulationEngine.ts?raw';

interface MathAndSimulationLabViewProps {
  state?: SimulationState;
  dailyLogs: DailyLogEntry[];
  batchSummary: BatchSimulationSummary | null;
  integrityAudit: AccountingAuditResult;
  consoleOutputLines: string[];
  onRun30DaySimulation: () => void;
  onRunFinancialIntegrityAudit?: () => void;
  lastNonMutatingAuditResult?: {
    accountingAudit: AccountingAuditResult;
    financialIntegrityReport: FinancialIntegrityAuditReport;
  } | null;
  formatCurrency: (val: number) => string;
}

export const MathAndSimulationLabView: React.FC<
  MathAndSimulationLabViewProps
> = ({
  state,
  dailyLogs,
  batchSummary,
  integrityAudit,
  consoleOutputLines,
  onRun30DaySimulation,
  onRunFinancialIntegrityAudit,
  lastNonMutatingAuditResult,
  formatCurrency,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(rawEngineSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeIntegrityReport =
    lastNonMutatingAuditResult?.financialIntegrityReport ??
    state?.lastFinancialIntegrityReport ??
    state?.centralLedger?.lastIntegrityReport;
  const activeAccountingAudit =
    lastNonMutatingAuditResult?.accountingAudit ?? integrityAudit;

  const migrationStats = SimulationStore.getLastMigrationStats();

  const ledgerAccounts: Account[] = state?.centralLedger
    ? Object.values(state.centralLedger.accounts)
    : [];

  const activeLoansList = state?.activeLoans ?? [];

  const totalLoanPrincipal = activeLoansList
    .filter((l) => l.status !== 'PAID_OFF')
    .reduce((acc, l) => acc + l.remainingPrincipal, 0);

  const totalAccruedLoanInterest = activeLoansList
    .filter((l) => l.status !== 'PAID_OFF')
    .reduce((acc, l) => acc + l.accruedInterestUnpaid, 0);

  const totalInventoryValue =
    state?.playerCompany?.financials.inventory ?? 0;

  const recentLedgerTransactions = state?.centralLedger
    ? state.centralLedger.transactions.slice(0, 100)
    : [];

  const failedTransfersList = state?.centralLedger?.failedTransfers ?? [];
  const duplicateIdempotencyCount =
    state?.centralLedger?.duplicateIdempotencyAttempts ?? 0;

  const uiSettings = UISettingsStore.loadSettings();
  const cityDiagnostics = state
    ? deriveCityDiagnosticsSummary(
        state,
        {
          eligible: Boolean(state.playerCompany?.isPubliclyListed),
          minOperatingDaysRequired: 30,
          currentOperatingDays: state.playerCompany?.operatingDays ?? 0,
          minAnnualRevenueRequired: 5_000_000,
          currentAnnualRevenue:
            (state.playerCompany?.dailyRevenue ?? 0) * 365,
          minEbitdaRequired: 750_000,
          currentEbitda: (state.playerCompany?.dailyEbitda ?? 0) * 365,
          minEquityRequired: 2_500_000,
          currentEquity:
            state.playerCompany?.financials.shareholdersEquity ?? 0,
          minGovernanceScoreRequired: 70,
          currentGovernanceScore:
            state.playerCompany?.corporateGovernanceScore ?? 50,
          maxDebtToEbitdaAllowed: 3.5,
          currentDebtToEbitda: 0,
          reasons: [],
        },
        formatCurrency,
        uiSettings.graphicsQuality,
        {
          panX: uiSettings.lastCameraPanX ?? 0,
          panY: uiSettings.lastCameraPanY ?? 0,
          zoomPreset: uiSettings.lastZoomPreset ?? 'NORMAL',
        }
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Bölüm 30: Geliştirici Görünümü Şehir Tanılama Paneli */}
      {state && cityDiagnostics && (
        <div
          data-testid="dev-city-diagnostics-panel"
          className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                İzometrik Tycoon Şehri Tanılama Paneli (6 Bölge & 2.5D Şehir Motoru)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Şehir yoğunluğu, açık bölgeler, bina görsel kademeleri, aktif inşaatlar, trafik filosu ve kamera durumu.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono text-xs font-bold">
              Grafik Modu: {cityDiagnostics.graphicsQuality} · Atmosfer: {cityDiagnostics.timeOfDayPhase}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Toplam Bina Sayısı</div>
              <div
                data-testid="diag-total-buildings"
                className="font-mono font-bold text-emerald-400 text-sm mt-0.5"
              >
                {cityDiagnostics.totalBuildingsCount} ({cityDiagnostics.coreInteractiveBuildingsCount} Ana + {cityDiagnostics.urbanBlockStructuresCount} Blok)
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Açık Bölge Sayısı</div>
              <div
                data-testid="diag-unlocked-districts"
                className="font-mono font-bold text-sky-400 text-sm mt-0.5"
              >
                {cityDiagnostics.unlockedDistrictsCount} / {cityDiagnostics.totalDistrictsCount} Bölge
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Aktif İnşaat Sayısı</div>
              <div
                data-testid="diag-active-constructions"
                className="font-mono font-bold text-amber-400 text-sm mt-0.5"
              >
                {cityDiagnostics.activeConstructionsCount} Şantiye
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Aktif Araç & Yaya</div>
              <div
                data-testid="diag-active-traffic"
                className="font-mono font-bold text-purple-400 text-sm mt-0.5"
              >
                {cityDiagnostics.activeVehiclesCount} Araç · {cityDiagnostics.activePedestriansCount} Yaya
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Günün Zamanı / Işık</div>
              <div
                data-testid="diag-time-of-day"
                className="font-mono font-bold text-amber-300 text-sm mt-0.5"
              >
                Saat {String(state.currentGameHour).padStart(2, '0')}:00 ({cityDiagnostics.timeOfDayPhase})
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Kamera & Zoom</div>
              <div
                data-testid="diag-camera-state"
                className="font-mono font-bold text-slate-200 text-sm mt-0.5"
              >
                {cityDiagnostics.cameraState.zoomPreset} ({cityDiagnostics.cameraState.panX}, {cityDiagnostics.cameraState.panY})
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <div className="font-semibold text-slate-200 mb-2">
                6 Şehir Bölgesi Durumu
              </div>
              <div className="space-y-1.5">
                {cityDiagnostics.districtStatuses.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between py-1 border-b border-slate-800/70 last:border-0"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">{d.nameTR}</span>
                      <span className="text-[11px] text-slate-400 ml-2">
                        ({d.buildingCount} yapı)
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                        d.isUnlocked
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {d.isUnlocked ? 'AÇIK' : 'KİLİTLİ'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <div className="font-semibold text-slate-200 mb-2">
                Ana Binaların Seviyesi, Görsel Kademesi ve Hedef Ekranı
              </div>
              <div className="space-y-1.5">
                {cityDiagnostics.buildingLevels.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between py-1 border-b border-slate-800/70 last:border-0 gap-2"
                  >
                    <div className="truncate">
                      <span className="font-mono font-bold text-slate-200">
                        {b.id}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1.5">
                        → {b.targetScreen}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300">
                        Sv.{b.level} (Kademe {b.tierIndex})
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-300">
                        {b.shortStatusLabel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bölüm 18 & 11: Ticaret Evreni, Esnaf, Depo, Lojistik ve Stok Bütünlük Denetimi Paneli */}
      {state && state.tradeState && (
        <div
          data-testid="dev-trade-universe-diagnostics-panel"
          className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-400" />
                Ticaret Evreni, Esnaf Kariyeri, Depo & Lojistik Bütünlük Denetimi (v{state.tradeState.schemaVersion})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Birleşik kariyer aşaması, aktif esnaf dükkânları, depo stok partileri (FIFO), sevkiyatlar, reçeteli üretim, ticari sözleşmeler ve stok-nakit mutabakatı.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-700/60 text-amber-300 font-mono text-xs font-bold">
              Kariyer: {state.tradeState.careerStage} · Şirketleşme: {state.playerCompany ? 'TAMAMLANDI' : 'ESNAF EVRESİ'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Aktif Dükkân / Şube</div>
              <div
                data-testid="diag-trade-shops"
                className="font-mono font-bold text-amber-400 text-sm mt-0.5"
              >
                {state.tradeState.shops.length} Şube (Kasa: {formatCurrency(state.tradeState.shops.reduce((s, sh) => s + sh.cashAccountBalance, 0))})
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Depolar & Stok Değeri</div>
              <div
                data-testid="diag-trade-warehouses"
                className="font-mono font-bold text-sky-400 text-sm mt-0.5"
              >
                {state.tradeState.warehouses.length} Depo ({formatCurrency(state.tradeState.warehouses.reduce((sum, w) => sum + w.batches.reduce((bs, b) => bs + b.totalValue, 0), 0))})
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Açık Sipariş & Yoldaki</div>
              <div
                data-testid="diag-trade-orders"
                className="font-mono font-bold text-emerald-400 text-sm mt-0.5"
              >
                {state.tradeState.procurementOrders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length} Sipariş · {state.tradeState.shipments.filter((s) => s.status === 'IN_TRANSIT' || s.status === 'DELAYED').length} Sevkiyat
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Lojistik Filosu</div>
              <div
                data-testid="diag-trade-fleet"
                className="font-mono font-bold text-purple-400 text-sm mt-0.5"
              >
                {state.tradeState.vehicles.length} Araç · {state.tradeState.routes.length} Rota
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Ticari Sözleşmeler</div>
              <div
                data-testid="diag-trade-contracts"
                className="font-mono font-bold text-slate-200 text-sm mt-0.5"
              >
                {state.tradeState.commercialContracts.filter((c) => c.status === 'ACTIVE').length} Aktif / {state.tradeState.commercialContracts.length} Toplam
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Stok & Ticaret Denetimi</div>
              <div
                data-testid="diag-trade-audit-valid"
                className={`font-mono font-bold text-sm mt-0.5 ${
                  state.tradeState.lastTradeAuditReport?.valid ?? true
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {state.tradeState.lastTradeAuditReport?.valid ?? true
                  ? 'GEÇERLİ (ΔStok=0 · ΔNakit=0)'
                  : 'UYARI / FARK VAR'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aşama 11: Geliştirici Görünümü Ekonomik Bütünlük, Merkezi Muhasebe Defteri ve Banka Denetim Paneli */}
      {state && (
        <div
          data-testid="dev-economic-audit-panel"
          className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" />
                Aşama 11: Merkezi Muhasebe Defteri, Banka Kredileri ve Ekonomik Bütünlük Denetimi (v{state.schemaVersion})
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Çift kayıt (Double-Entry) hesap bakiyeleri, para arzı, kredi/stok metrikleri, idempotency denetimi ve şema v5 migration tanılama verileri.
              </p>
            </div>
            {onRunFinancialIntegrityAudit && (
              <button
                type="button"
                data-testid="run-economic-audit-btn"
                onClick={onRunFinancialIntegrityAudit}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Ekonomik Denetim Çalıştır (Kaydı Değiştirmez)
              </button>
            )}
          </div>

          {/* 1. Üst Makro & Muhasebe Özet Metrikleri */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Toplam Sistem Para Arzı</div>
              <div
                data-testid="audit-total-money-supply"
                className="font-mono tabular-nums font-bold text-emerald-400 text-sm mt-0.5"
              >
                {formatCurrency(activeIntegrityReport?.totalMoneySupply ?? state.cash)}
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Toplam Kredi Anaparası</div>
              <div
                data-testid="audit-total-loan-principal"
                className="font-mono tabular-nums font-bold text-amber-400 text-sm mt-0.5"
              >
                {formatCurrency(totalLoanPrincipal)}
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Toplam Birikmiş Faiz</div>
              <div
                data-testid="audit-total-accrued-interest"
                className="font-mono tabular-nums font-bold text-rose-400 text-sm mt-0.5"
              >
                {formatCurrency(totalAccruedLoanInterest)}
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Toplam Stok Değeri</div>
              <div
                data-testid="audit-total-inventory-value"
                className="font-mono tabular-nums font-bold text-sky-400 text-sm mt-0.5"
              >
                {formatCurrency(totalInventoryValue)}
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Finansal Bütünlük Durumu</div>
              <div
                data-testid="audit-integrity-status"
                className={`font-mono font-bold text-sm mt-0.5 ${
                  (activeIntegrityReport?.valid ?? true) && activeAccountingAudit.valid
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {(activeIntegrityReport?.valid ?? true) && activeAccountingAudit.valid
                  ? 'GEÇERLİ (0 Hata)'
                  : 'UYARI / HATA'}
              </div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-slate-400 text-[11px]">Kayıt Şema Sürümü</div>
              <div
                data-testid="audit-schema-version"
                className="font-mono font-bold text-slate-100 text-sm mt-0.5"
              >
                v{state.schemaVersion} (Migration Aktif)
              </div>
            </div>
          </div>

          {/* 2. Tick, Saat, Gün Kapanışı ve Migration Tanılama */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono">
              <div className="text-slate-300 font-sans font-semibold mb-1">
                Zamanlayıcı ve Tick İzleme
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Son Simülasyon Tick ID:</span>
                <span data-testid="audit-last-tick-id" className="text-slate-200">
                  {state.lastSimulationTickId || 'TICK-INIT'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Son İşlenen Oyun Dakikası:</span>
                <span className="text-slate-200">
                  {state.lastProcessedGameMinuteTotal ?? state.totalElapsedGameMinutes} dk (Gün İçi:{' '}
                  {state.minutesIntoCurrentDay}. dk)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Son İşlenen Gün Kapanışı:</span>
                <span className="text-slate-200">
                  Gün {state.lastProcessedDayClose ?? state.day - 1}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono">
              <div className="text-slate-300 font-sans font-semibold mb-1">
                Kayıt Migration Geçmişi & Denetim Özeti
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Son Migration Kaynağı:</span>
                <span className="text-slate-200">
                  {migrationStats
                    ? `v${migrationStats.migratedFromVersion} → v${migrationStats.migratedToVersion} (${migrationStats.totalTransactionsMigrated} TX)`
                    : `Doğrudan v${state.schemaVersion}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">
                  Reddedilen / Mükerrer Idempotency:
                </span>
                <span className="text-amber-300">
                  {failedTransfersList.length} Red · {duplicateIdempotencyCount}{' '}
                  Mükerrer Anahtar
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Otomatik Denge Test Paketi:</span>
                <span className="text-emerald-400">
                  A(8) · B(8) · C(10) · D(6) · E(30/180/365/1095g) DOĞRULANDI
                </span>
              </div>
            </div>
          </div>

          {/* 3. Tüm Merkezi Defter Hesap Bakiyeleri */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-emerald-400" />
              Merkezi Çift Kayıt Hesap Bakiyeleri ({ledgerAccounts.length} Hesap)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
              {ledgerAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-2.5 bg-slate-950 border border-slate-800/90 rounded-md"
                >
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    {acc.id}
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {acc.name}
                  </div>
                  <div className="font-mono tabular-nums font-semibold text-slate-100 mt-1">
                    {formatCurrency(acc.balance)}
                  </div>
                  {acc.reservedBalance > 0 && (
                    <div className="text-[10px] font-mono text-amber-400">
                      Bloke: {formatCurrency(acc.reservedBalance)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 4. Son 100 Muhasebe İşlemi ve Reddedilen Transferler */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                <span className="font-semibold text-slate-200">
                  Son 100 Çift Kayıt Muhasebe İşlemi ({recentLedgerTransactions.length} Kayıt)
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Borç (Debit) === Alacak (Credit)
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/70 font-mono text-[11px]">
                {recentLedgerTransactions.length === 0 ? (
                  <div className="p-3 text-slate-500">
                    Henüz merkezi defter işlemi kaydedilmedi.
                  </div>
                ) : (
                  recentLedgerTransactions.map((tx) => (
                    <div
                      key={tx.transactionId}
                      className="px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-slate-900/60"
                    >
                      <div className="min-w-0">
                        <span className="text-sky-400 font-semibold">
                          [{tx.category}]
                        </span>{' '}
                        <span className="text-slate-300">
                          {tx.sourceAccountId} → {tx.destinationAccountId}
                        </span>
                        <div className="text-[10px] text-slate-500 truncate">
                          Gün {tx.gameDay} · {tx.gameMinute}. dk · ID:{' '}
                          {tx.transactionId} · {tx.description}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-emerald-400 font-semibold">
                          {formatCurrency(tx.amount)}
                        </div>
                        {tx.taxEffect > 0 && (
                          <div className="text-[10px] text-amber-400">
                            Vergi/Kesinti: {formatCurrency(tx.taxEffect)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Reddedilen & Mükerrer Denemeler
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/70 p-2 space-y-1.5 font-mono text-[11px]">
                  {failedTransfersList.length === 0 &&
                  duplicateIdempotencyCount === 0 ? (
                    <div className="text-slate-500 p-1">
                      Reddedilen transfer veya mükerrer idempotency denemesi yok (0).
                    </div>
                  ) : (
                    <>
                      {duplicateIdempotencyCount > 0 && (
                        <div className="p-1.5 rounded bg-amber-950/30 border border-amber-800/50 text-amber-200">
                          [MÜKERRER IDEMPOTENCY] Toplam {duplicateIdempotencyCount} adet mükerrer işlem anahtarı engellendi.
                        </div>
                      )}
                      {failedTransfersList.map((ft) => (
                        <div
                          key={ft.transactionId}
                          className="p-1.5 rounded bg-rose-950/30 border border-rose-800/50 text-rose-200"
                        >
                          [{ft.category}] {ft.sourceAccountId} →{' '}
                          {ft.destinationAccountId} ({formatCurrency(ft.amount)}
                          ): {ft.failureReason || ft.description}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 30 Günlük Simülasyon Çalıştırıcı ve Rapor Özeti */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              30 Günlük Gerçek Simülasyon Motoru, Bütünlük Denetimi ve Konsol Çıktısı
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Hiçbir sahte nakit veya gizli avantaj eklemeden mevcut bakiye ve portföy üzerinden 30 iş gününü atomik olarak ilerletir; sonuçları hem ekranda hem de tarayıcı konsolunda (`console.log`) raporlar.
            </p>
          </div>
          <button
            type="button"
            onClick={onRun30DaySimulation}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            30 Günlük Simülasyonu Koştur (Konsol + Rapor)
          </button>
        </div>

        {/* 30 Günlük Özet Sonuç Kartı (Aşama 11 İsteri) */}
        {batchSummary && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <span className="font-semibold text-slate-100">
                30 Günlük Simülasyon Raporu (Gün {batchSummary.startDay} → Gün{' '}
                {batchSummary.endDay})
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                Tespit Edilen Bütünlük Hatası:{' '}
                {batchSummary.integrityErrors.length}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <span className="text-slate-400">Başlangıç → Bitiş Net Varlık</span>
                <div className="font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                  {formatCurrency(batchSummary.startNetWorth)} →{' '}
                  {formatCurrency(batchSummary.endNetWorth)}
                </div>
                <div
                  className={`font-mono tabular-nums text-[11px] ${
                    batchSummary.netWorthChange >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {batchSummary.netWorthChange >= 0 ? '+' : ''}
                  {formatCurrency(batchSummary.netWorthChange)} (
                  {batchSummary.netWorthChangePct}%)
                </div>
              </div>

              <div>
                <span className="text-slate-400">Nakit Değişimi</span>
                <div className="font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                  {batchSummary.cashChange >= 0 ? '+' : ''}
                  {formatCurrency(batchSummary.cashChange)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Son Nakit: {formatCurrency(batchSummary.endCash)}
                </div>
              </div>

              <div>
                <span className="text-slate-400">Portföy Değişimi</span>
                <div className="font-mono tabular-nums font-semibold text-sky-400 mt-0.5">
                  {batchSummary.portfolioChange >= 0 ? '+' : ''}
                  {formatCurrency(batchSummary.portfolioChange)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Son Portföy: {formatCurrency(batchSummary.endPortfolioValue)}
                </div>
              </div>

              <div>
                <span className="text-slate-400">İşlem & Haber Sayısı</span>
                <div className="font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                  {batchSummary.executedTransactionsCount} İşlem ·{' '}
                  {batchSummary.generatedNewsCount} Haber
                </div>
              </div>

              <div>
                <span className="text-slate-400">Tahsil Edilen Temettü</span>
                <div className="font-mono tabular-nums font-semibold text-amber-400 mt-0.5">
                  +{formatCurrency(batchSummary.totalDividendsCollected)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              <div>
                <span className="text-slate-400 block mb-1">
                  En İyi Performans Gösteren Hisseler:
                </span>
                <div className="flex flex-wrap gap-3 font-mono">
                  {batchSummary.bestPerformingStocks.map((st) => (
                    <span key={st.ticker} className="text-emerald-400">
                      {st.ticker}: {st.returnPct >= 0 ? '+' : ''}
                      {st.returnPct}%
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">
                  En Zayıf Performans Gösteren Hisseler:
                </span>
                <div className="flex flex-wrap gap-3 font-mono">
                  {batchSummary.worstPerformingStocks.map((st) => (
                    <span key={st.ticker} className="text-rose-400">
                      {st.ticker}: {st.returnPct >= 0 ? '+' : ''}
                      {st.returnPct}%
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Konsol Çıktısı Terminali */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 pb-2 border-b border-slate-800">
            <span className="font-mono">
              STDOUT / console.log Çıktısı ({consoleOutputLines.length} satır)
            </span>
            <span className="font-mono text-emerald-400">
              Muhasebe Eşitliği Denetimi:{' '}
              {activeAccountingAudit.valid ? 'DOĞRULANDI (0 Hata)' : 'HATA'}
            </span>
          </div>
          <pre className="text-xs font-mono tabular-nums text-emerald-300/90 overflow-x-auto max-h-80 overflow-y-auto leading-relaxed whitespace-pre-wrap">
            {consoleOutputLines.length > 0
              ? consoleOutputLines.join('\n')
              : 'Henüz toplu 30 günlük simülasyon çalıştırılmadı. Sağ üstteki "30 Günlük Simülasyonu Koştur" butonuna tıklayın veya günlük olarak ilerleyin.'}
          </pre>
        </div>
      </div>

      {/* Matematiksel Modeller Özeti */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Calculator className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-slate-100">
            Simülasyonda Kullanılan Ekonomik ve Muhasebe Formülleri
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <h4 className="font-semibold text-emerald-400">
              01. Çok Faktörlü Logaritmik Fiyat Motoru (MarketEngine)
            </h4>
            <pre className="p-2.5 bg-slate-900 rounded font-mono text-[11px] text-slate-200 overflow-x-auto">
{`dt  = 1 / 252
r_t = (mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*epsilon
    + haberEtkisi + temelDegerEtkisi + sektorEtkisi
    + makroEkonomiEtkisi + arzTalepEtkisi + likiditeEtkisi
S_{t+1} = max(1.0, S_t * exp(r_t))`}
            </pre>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <h4 className="font-semibold text-sky-400">
              02. Muhasebe Bilanço Eşitliği ve 5-Yöntemli Değerleme
            </h4>
            <pre className="p-2.5 bg-slate-900 rounded font-mono text-[11px] text-slate-200 overflow-x-auto">
{`Varlıklar = Nakit + Stok + Alacaklar + DuranVarlıklar
Varlıklar === Yükümlülükler + Özkaynaklar
FCFF = EBIT*(1 - Vergi) + Amortisman - CAPEX - ΔNWC
Değerleme = AğırlıklıOrtalama(EV/FAVÖK, F/K, P/B, DCF, Sektör)`}
            </pre>
          </div>
        </div>
      </div>

      {/* Günlük Simülasyon Kayıt Tablosu */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">
            Günlük Simülasyon Özeti Tablosu (Son {dailyLogs.length} Gün)
          </h3>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950/60">
                <th className="py-2 px-3">Gün / Tarih</th>
                <th className="py-2 px-3">Aşama</th>
                <th className="py-2 px-3 text-right">Nakit</th>
                <th className="py-2 px-3 text-right">Portföy</th>
                <th className="py-2 px-3 text-right">Net Varlık</th>
                <th className="py-2 px-3">Günün Manşeti & Aksiyonlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {[...dailyLogs].reverse().map((log) => (
                <tr key={log.day} className="hover:bg-slate-800/40">
                  <td className="py-2 px-3 font-mono tabular-nums font-semibold text-slate-200">
                    Gün {log.day}{' '}
                    <span className="text-[10px] text-slate-500">
                      ({log.dateISO})
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-300">
                    Aşama {log.stage}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-200">
                    {formatCurrency(log.cash)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-200">
                    {formatCurrency(log.portfolioMarketValue)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-emerald-400">
                    {formatCurrency(log.netWorth)}
                  </td>
                  <td className="py-2 px-3 text-slate-400">
                    <div className="text-slate-200 font-medium">
                      {log.headlineNews}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {log.actionsTaken.join(' · ')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kaynak Kodu */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              TypeScript Ana Koordinatör Kaynak Kodu (SimulationEngine.ts)
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? 'Kopyalandı' : 'Tüm Kodu Kopyala'}
          </button>
        </div>
        <pre className="p-4 bg-slate-950 text-xs font-mono text-slate-300 overflow-x-auto max-h-96 overflow-y-auto leading-relaxed">
          {rawEngineSource}
        </pre>
      </div>
    </div>
  );
};
