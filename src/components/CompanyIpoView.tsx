import React, { useState } from 'react';
import {
  PlayerCompany,
  SectorId,
  SECTOR_CONFIGS,
  InstitutionalFund,
  SimulationEngine,
  IPOEligibilityResult,
} from '../engine/SimulationEngine';
import {
  Building2,
  Rocket,
  Users,
  Cpu,
  Factory,
  Landmark,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface CompanyIpoViewProps {
  playerCompany: PlayerCompany | null;
  ipoEligibility: IPOEligibilityResult;
  cash: number;
  netWorth: number;
  institutionalFunds: InstitutionalFund[];
  onEstablishCompany: (
    name: string,
    ticker: string,
    sector: SectorId,
    initialCapital: number,
    options: {
      initialStaffCount: number;
      initialRdBudget: number;
      initialCapacity: number;
    }
  ) => void;
  onTransferCapital: (amount: number) => void;
  onConfigureOperations: (params: {
    targetStaffCount?: number;
    targetProductionCapacity?: number;
    dailyRdBudget?: number;
    borrowLoanAmount?: number;
  }) => void;
  onExecuteIPO: (
    floatRatio: number,
    discountRatio: number,
    primaryRatio: number
  ) => void;
  formatCurrency: (val: number) => string;
}

export const CompanyIpoView: React.FC<CompanyIpoViewProps> = ({
  playerCompany,
  ipoEligibility,
  cash,
  netWorth,
  institutionalFunds,
  onEstablishCompany,
  onTransferCapital,
  onConfigureOperations,
  onExecuteIPO,
  formatCurrency,
}) => {
  const [companyName, setCompanyName] = useState('Turkuaz Kuantum & Bulut A.Ş.');
  const [companyTicker, setCompanyTicker] = useState('TRKZ');
  const [selectedSector, setSelectedSector] = useState<SectorId>('TEKNOLOJI');
  const [initialCapital, setInitialCapital] = useState<number>(800_000);
  const [initialStaff, setInitialStaff] = useState<number>(20);
  const [initialCapacity, setInitialCapacity] = useState<number>(30);
  const [initialRd, setInitialRd] = useState<number>(15_000);

  const [transferAmount, setTransferAmount] = useState<number>(250_000);
  const [staffInput, setStaffInput] = useState<number>(
    playerCompany?.staffCount || 25
  );
  const [capacityInput, setCapacityInput] = useState<number>(
    playerCompany?.productionCapacity || 35
  );
  const [rdInput, setRdInput] = useState<number>(
    playerCompany?.dailyRdBudget || 20_000
  );

  React.useEffect(() => {
    if (playerCompany) {
      setStaffInput(playerCompany.staffCount);
      setCapacityInput(playerCompany.productionCapacity);
      setRdInput(playerCompany.dailyRdBudget);
    }
  }, [
    playerCompany?.ticker,
    playerCompany?.staffCount,
    playerCompany?.productionCapacity,
    playerCompany?.dailyRdBudget,
  ]);

  const [ipoFloatPct, setIpoFloatPct] = useState<number>(30);
  const [ipoDiscountPct, setIpoDiscountPct] = useState<number>(12);
  const [ipoPrimaryPct, setIpoPrimaryPct] = useState<number>(35);

  const canFoundCompany =
    netWorth >= SimulationEngine.STAGE_2_NET_WORTH_THRESHOLD;

  if (!playerCompany) {
    const progressPct = Math.min(
      100,
      (netWorth / SimulationEngine.STAGE_2_NET_WORTH_THRESHOLD) * 100
    );

    return (
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Aşama 2: Girişimci — Şirket Kuruluş Merkezi
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Toplam net varlığınız 2.000.000 TL eşiğine ulaştığında kendi şirketinizi kurabilir, çift kayıt muhasebe ile sermaye aktarabilir ve üretimi yönetebilirsiniz.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">
                Gereken Net Varlık Eşiği
              </div>
              <div className="text-sm font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                {formatCurrency(netWorth)} /{' '}
                {formatCurrency(SimulationEngine.STAGE_2_NET_WORTH_THRESHOLD)} (
                {progressPct.toFixed(1)}%)
              </div>
            </div>
          </div>

          {!canFoundCompany && (
            <div className="my-5 p-4 bg-slate-950 border border-slate-800 rounded-lg">
              <h3 className="text-xs font-semibold text-amber-400">
                Aşama 2 Kilitli: Net Varlık 2.000.000 TL Altında
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Şirket kurma kilidinin açılması için Borsa & Portföy ekranında hisse alım-satımı ve temettü gelirleriyle toplam net varlığınızı 2.000.000 TL seviyesine çıkarmanız gerekmektedir.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="founder-company-name"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Şirket Unvanı
                </label>
                <input
                  id="founder-company-name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="founder-ticker"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Borsa Kodu (Ticker)
                  </label>
                  <input
                    id="founder-ticker"
                    type="text"
                    maxLength={5}
                    value={companyTicker}
                    onChange={(e) =>
                      setCompanyTicker(e.target.value.toUpperCase())
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md font-mono text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="founder-sector"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Faaliyet Sektörü
                  </label>
                  <select
                    id="founder-sector"
                    value={selectedSector}
                    onChange={(e) =>
                      setSelectedSector(e.target.value as SectorId)
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-100"
                  >
                    {(Object.keys(SECTOR_CONFIGS) as SectorId[]).map((sec) => (
                      <option key={sec} value={sec}>
                        {sec} — {SECTOR_CONFIGS[sec].name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label
                    htmlFor="founder-capital"
                    className="text-slate-300 font-medium"
                  >
                    Başlangıç Kuruluş Sermayesi (Kişisel Nakitten Aktarım)
                  </label>
                  <span className="font-mono tabular-nums text-emerald-400">
                    {formatCurrency(initialCapital)}
                  </span>
                </div>
                <input
                  id="founder-capital"
                  type="range"
                  min={250_000}
                  max={Math.max(500_000, Math.floor(cash))}
                  step={50_000}
                  value={Math.min(
                    initialCapital,
                    Math.max(250_000, Math.floor(cash))
                  )}
                  onChange={(e) => setInitialCapital(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label
                    htmlFor="founder-staff"
                    className="block text-slate-300 mb-1"
                  >
                    İlk Personel
                  </label>
                  <input
                    id="founder-staff"
                    type="number"
                    min={5}
                    max={150}
                    value={initialStaff}
                    onChange={(e) => setInitialStaff(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="founder-capacity"
                    className="block text-slate-300 mb-1"
                  >
                    Üretim Kapasitesi
                  </label>
                  <input
                    id="founder-capacity"
                    type="number"
                    min={10}
                    max={200}
                    value={initialCapacity}
                    onChange={(e) => setInitialCapacity(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="founder-rd"
                    className="block text-slate-300 mb-1"
                  >
                    Ar-Ge (TL/Gün)
                  </label>
                  <input
                    id="founder-rd"
                    type="number"
                    min={0}
                    step={5000}
                    value={initialRd}
                    onChange={(e) => setInitialRd(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-slate-100"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={!canFoundCompany || cash < 250_000}
                onClick={() =>
                  onEstablishCompany(
                    companyName,
                    companyTicker,
                    selectedSector,
                    initialCapital,
                    {
                      initialStaffCount: initialStaff,
                      initialCapacity,
                      initialRdBudget: initialRd,
                    }
                  )
                }
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Şirketi Kur ve Operasyonları Başlat
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3 text-xs">
              <h3 className="font-semibold text-slate-200">
                Seçili Sektör Parametreleri ({SECTOR_CONFIGS[selectedSector].name})
              </h3>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-slate-400">
                    FAVÖK / F/K Değerleme Çarpanı:
                  </span>
                  <div className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                    {SECTOR_CONFIGS[selectedSector].baseEvMultiple}x EV/EBITDA ·{' '}
                    {SECTOR_CONFIGS[selectedSector].basePeMultiple}x F/K
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">
                    Birim Satış Fiyatı / Maliyet:
                  </span>
                  <div className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                    {formatCurrency(SECTOR_CONFIGS[selectedSector].unitPrice)} /{' '}
                    {formatCurrency(SECTOR_CONFIGS[selectedSector].unitCost)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">
                    Günlük Personel Maliyeti:
                  </span>
                  <div className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                    {formatCurrency(
                      SECTOR_CONFIGS[selectedSector].dailyStaffWage
                    )}{' '}
                    / kişi
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">
                    Birim Kapasite Yatırımı:
                  </span>
                  <div className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                    {formatCurrency(
                      SECTOR_CONFIGS[selectedSector].unitCapacityCost * 4
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                Çift Kayıt Muhasebe Garantisi: Şirket kurulduğunda veya sermaye aktarıldığında kişisel nakdiniz azalır, şirket özkaynağınız aynı tutarda artar; yoktan varlık üretilmez.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fin = playerCompany.financials;
  const val = playerCompany.valuation;
  const fairSharePrice = val.fairValuePerShare;
  const estimatedOfferPrice = fairSharePrice * (1 - ipoDiscountPct / 100);
  const offeredShares = Math.round(
    playerCompany.totalShares * (ipoFloatPct / 100)
  );
  const estimatedGrossProceeds = offeredShares * estimatedOfferPrice;

  return (
    <div className="space-y-6">
      {/* Şirket Üst Özet, Bilanço ve 5-Yöntemli Değerleme Kartı */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  {playerCompany.name}
                </h2>
                <span className="text-xs text-slate-400">·</span>
                <span className="font-mono text-xs text-emerald-400">
                  {playerCompany.ticker}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-300">
                  {playerCompany.isPubliclyListed
                    ? `Halka Açık (Payınız: %${playerCompany.playerOwnershipPct.toFixed(1)})`
                    : 'Özel Şirket (%100 Oyuncu Sahipliği)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sektör: {SECTOR_CONFIGS[playerCompany.sector].name} · Faaliyet Süresi:{' '}
                {playerCompany.operatingDays} gün · Yönetişim Puanı:{' '}
                {playerCompany.corporateGovernanceScore}/100 · Teknoloji Çarpanı (Q_t):{' '}
                {playerCompany.techQualityMultiplier.toFixed(3)}x
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400">
              5-Yöntem Ağırlıklı Özkaynak Değeri (Equity Value)
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-400">
              {formatCurrency(playerCompany.equityValue)}
            </div>
          </div>
        </div>

        {/* Gelir Tablosu & Bilanço Özeti (Varlıklar = Yükümlülükler + Özkaynaklar) */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 text-xs">
          <div>
            <span className="text-slate-400">Şirket Kasası Nakdi</span>
            <div className="text-sm font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
              {formatCurrency(fin.cash)}
            </div>
          </div>
          <div>
            <span className="text-slate-400">Toplam Varlıklar</span>
            <div className="text-sm font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
              {formatCurrency(fin.totalAssets)}
            </div>
          </div>
          <div>
            <span className="text-slate-400">Toplam Borç (Yükümlülük)</span>
            <div className="text-sm font-mono tabular-nums font-semibold text-rose-400 mt-0.5">
              {formatCurrency(fin.totalLiabilities)}
            </div>
          </div>
          <div>
            <span className="text-slate-400">Özkaynaklar (Defter)</span>
            <div className="text-sm font-mono tabular-nums font-semibold text-sky-400 mt-0.5">
              {formatCurrency(fin.shareholdersEquity)}
            </div>
          </div>
          <div>
            <span className="text-slate-400">Yıllıklandırılmış Ciro</span>
            <div className="text-sm font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
              {formatCurrency(fin.revenue)}
            </div>
          </div>
          <div>
            <span className="text-slate-400">Yıllık FAVÖK / Net Kâr</span>
            <div className="text-sm font-mono tabular-nums font-semibold text-emerald-400 mt-0.5">
              {formatCurrency(fin.EBITDA)} / {formatCurrency(fin.netIncome)}
            </div>
          </div>
        </div>

        {/* 5 Yöntemli Değerleme Motoru Kırılımı */}
        <div className="pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3 text-[11px]">
          <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
            <span className="text-slate-400">1. FAVÖK Çarpanı</span>
            <div className="font-mono tabular-nums text-slate-200 font-medium mt-0.5">
              {formatCurrency(val.ebitdaMultipleValue)}
            </div>
          </div>
          <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
            <span className="text-slate-400">2. F/K Yaklaşımı</span>
            <div className="font-mono tabular-nums text-slate-200 font-medium mt-0.5">
              {formatCurrency(val.peMultipleValue)}
            </div>
          </div>
          <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
            <span className="text-slate-400">3. Defter Değeri (P/B)</span>
            <div className="font-mono tabular-nums text-slate-200 font-medium mt-0.5">
              {formatCurrency(val.bookValue)}
            </div>
          </div>
          <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
            <span className="text-slate-400">4. İndirgenmiş Nakit (DCF)</span>
            <div className="font-mono tabular-nums text-slate-200 font-medium mt-0.5">
              {formatCurrency(val.dcfValue)}
            </div>
          </div>
          <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
            <span className="text-slate-400">5. Sektör Benzerleri</span>
            <div className="font-mono tabular-nums text-slate-200 font-medium mt-0.5">
              {formatCurrency(val.sectorComparableValue)}
            </div>
          </div>
        </div>
      </div>

      {/* İki Sütun: Aşama 2 Operasyon Yönetimi & Aşama 3 Halka Arz (IPO) Masası */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sol: Aşama 2 Sermaye, Personel, Üretim ve Ar-Ge Yönetimi */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Operasyon, Ar-Ge ve Çift Kayıt Sermaye Yönetimi
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Kişisel nakdinizi şirkete sermaye olarak aktarabilir, kapasite ve Ar-Ge yatırımıyla üretimi büyütebilirsiniz.
            </p>
          </div>

          {/* Sermaye Aktarımı */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-200 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                Kişisel Nakitten Şirkete Sermaye Aktar
              </span>
              <span className="text-slate-400 font-mono tabular-nums">
                Kişisel Nakit: {formatCurrency(cash)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                aria-label="Aktarılacak Sermaye Tutarı"
                min={10_000}
                step={50_000}
                value={transferAmount}
                onChange={(e) =>
                  setTransferAmount(Math.max(0, Number(e.target.value)))
                }
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs font-mono tabular-nums text-slate-100"
              />
              <button
                type="button"
                onClick={() => onTransferCapital(transferAmount)}
                disabled={
                  cash < transferAmount ||
                  transferAmount <= 0 ||
                  playerCompany.isPubliclyListed
                }
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0"
              >
                Sermaye Aktar
              </button>
            </div>
          </div>

          {/* Personel, Kapasite ve Ar-Ge Kontrolleri */}
          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <label
                  htmlFor="staff-slider"
                  className="text-slate-300 font-medium flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  Personel Sayısı (Mevcut: {playerCompany.staffCount} kişi)
                </label>
                <span className="font-mono tabular-nums text-slate-100">
                  {staffInput} kişi
                </span>
              </div>
              <input
                id="staff-slider"
                type="range"
                min={5}
                max={250}
                value={staffInput}
                onChange={(e) => setStaffInput(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label
                  htmlFor="capacity-slider"
                  className="text-slate-300 font-medium flex items-center gap-1.5"
                >
                  <Factory className="w-3.5 h-3.5 text-emerald-400" />
                  Üretim Kapasitesi (Mevcut: {playerCompany.productionCapacity}{' '}
                  birim · Satış: {fin.dailyUnitsSold} br/gün)
                </label>
                <span className="font-mono tabular-nums text-slate-100">
                  {capacityInput} birim
                </span>
              </div>
              <input
                id="capacity-slider"
                type="range"
                min={10}
                max={300}
                value={capacityInput}
                onChange={(e) => setCapacityInput(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label
                  htmlFor="rd-slider"
                  className="text-slate-300 font-medium flex items-center gap-1.5"
                >
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  Günlük Ar-Ge Bütçesi (Teknoloji Çarpanı Q_t:{' '}
                  {playerCompany.techQualityMultiplier.toFixed(3)}x)
                </label>
                <span className="font-mono tabular-nums text-slate-100">
                  {formatCurrency(rdInput)} / gün
                </span>
              </div>
              <input
                id="rd-slider"
                type="range"
                min={0}
                max={150_000}
                step={5_000}
                value={rdInput}
                onChange={(e) => setRdInput(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                onConfigureOperations({
                  targetStaffCount: staffInput,
                  targetProductionCapacity: capacityInput,
                  dailyRdBudget: rdInput,
                })
              }
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              Operasyonel Parametreleri Uygula
            </button>
          </div>
        </div>

        {/* Sağ: Aşama 3 Halka Arz (IPO) Uygunluk Denetimi ve Talep Toplama */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              <Rocket className="w-4 h-4 text-emerald-400" />
              Aşama 3: Halka Arz (IPO) Uygunluk ve Talep Toplama
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              SPK / Borsa kotasyon şartları sağlandığında birincil (bedelli sermaye artırımı) ve ikincil (ortak satışı) pay ihracıyla halka arz gerçekleştirilir.
            </p>
          </div>

          {/* IPO Uygunluk Kriterleri */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">
                1. Asgari Faaliyet Süresi ({ipoEligibility.minOperatingDaysRequired} gün):
              </span>
              <span className="font-mono tabular-nums text-slate-100">
                {ipoEligibility.currentOperatingDays} gün
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                2. Asgari Yıllık Ciro ({formatCurrency(ipoEligibility.minAnnualRevenueRequired)}):
              </span>
              <span className="font-mono tabular-nums text-slate-100">
                {formatCurrency(ipoEligibility.currentAnnualRevenue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                3. Asgari FAVÖK ({formatCurrency(ipoEligibility.minEbitdaRequired)}):
              </span>
              <span className="font-mono tabular-nums text-emerald-400">
                {formatCurrency(ipoEligibility.currentEbitda)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                4. Yönetişim Puanı (&ge;{ipoEligibility.minGovernanceScoreRequired}) & Borç/FAVÖK (&le;{ipoEligibility.maxDebtToEbitdaAllowed}x):
              </span>
              <span className="font-mono tabular-nums text-slate-100">
                {ipoEligibility.currentGovernanceScore} puan · {ipoEligibility.currentDebtToEbitda}x
              </span>
            </div>
            {!ipoEligibility.eligible && !playerCompany.isPubliclyListed && (
              <div className="pt-1.5 text-[11px] text-amber-400 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{ipoEligibility.reasons.join(' ')}</span>
              </div>
            )}
            {ipoEligibility.eligible && !playerCompany.isPubliclyListed && (
              <div className="pt-1.5 text-[11px] text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Tüm halka arz kriterleri sağlandı!</span>
              </div>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <label
                  htmlFor="ipo-float-slider"
                  className="text-slate-300 font-medium"
                >
                  Halka Açıklık Oranı (Arz Edilecek Toplam Pay)
                </label>
                <span className="font-mono tabular-nums text-slate-100">
                  %{ipoFloatPct} ({offeredShares.toLocaleString('tr-TR')} lot)
                </span>
              </div>
              <input
                id="ipo-float-slider"
                type="range"
                min={15}
                max={45}
                value={ipoFloatPct}
                onChange={(e) => setIpoFloatPct(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label
                  htmlFor="ipo-discount-slider"
                  className="text-slate-300 font-medium"
                >
                  Değerleme İskontosu (Hisse Başı Adil Değer:{' '}
                  {fairSharePrice.toFixed(2)} TL → Arz:{' '}
                  {estimatedOfferPrice.toFixed(2)} TL)
                </label>
                <span className="font-mono tabular-nums text-slate-100">
                  %{ipoDiscountPct}
                </span>
              </div>
              <input
                id="ipo-discount-slider"
                type="range"
                min={0}
                max={25}
                value={ipoDiscountPct}
                onChange={(e) => setIpoDiscountPct(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label
                  htmlFor="ipo-primary-slider"
                  className="text-slate-300 font-medium"
                >
                  Sermaye Artırımı (Şirkete Nakit) / Ortak Satışı (Oyuncuya Nakit)
                </label>
                <span className="font-mono tabular-nums text-slate-100">
                  %{ipoPrimaryPct} Şirket / %{100 - ipoPrimaryPct} Oyuncu
                </span>
              </div>
              <input
                id="ipo-primary-slider"
                type="range"
                min={15}
                max={75}
                value={ipoPrimaryPct}
                onChange={(e) => setIpoPrimaryPct(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>
          </div>

          {/* 6 NPC Kurumsal Fon Tablosu */}
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex justify-between text-[11px] font-medium text-slate-400">
              <span>6 Kurumsal NPC Yatırım Fonu</span>
              <span className="font-mono">
                Tahmini Brüt Arz: {formatCurrency(estimatedGrossProceeds)}
              </span>
            </div>
            <div className="divide-y divide-slate-800/70 text-xs max-h-40 overflow-y-auto">
              {institutionalFunds.map((f) => (
                <div
                  key={f.id}
                  className="px-3 py-1.5 flex items-center justify-between"
                >
                  <div>
                    <div className="text-slate-200 font-medium">
                      {f.name}{' '}
                      <span className="text-[11px] text-slate-400 font-mono">
                        [{f.strategyType}]
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums text-slate-300">
                    {formatCurrency(f.availableCapital)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={!ipoEligibility.eligible || playerCompany.isPubliclyListed}
            onClick={() =>
              onExecuteIPO(
                ipoFloatPct / 100,
                ipoDiscountPct / 100,
                ipoPrimaryPct / 100
              )
            }
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            {playerCompany.isPubliclyListed
              ? 'Şirketiniz Borsada İşlem Görüyor (Halka Arz Tamamlandı)'
              : ipoEligibility.eligible
              ? 'Halka Arzı (IPO) Başlat ve Borsaya Kote Ol'
              : 'Halka Arz Kriterleri Sağlandığında Açılır'}
          </button>
        </div>
      </div>
    </div>
  );
};
