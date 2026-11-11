import React, { useState } from 'react';
import {
  MarketStock,
  PortfolioPosition,
  ControlThresholdLevel,
} from '../engine/SimulationEngine';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

interface TakeoverHoldingViewProps {
  stocks: MarketStock[];
  portfolio: Record<string, PortfolioPosition>;
  cash: number;
  totalDebt: number;
  controlledSubsidiaries: string[];
  totalSynergyEarned: number;
  onExecuteTakeover: (
    ticker: string,
    options: { targetOwnershipPct: number; useDebtFinancing: boolean }
  ) => void;
  onBuyToeholdStake: (ticker: string, shares: number) => void;
  formatCurrency: (val: number) => string;
}

const CONTROL_LABELS: Record<ControlThresholdLevel, string> = {
  NONE: '<%5 Pay Yok',
  SIGNIFICANT_5: '%5 Önemli Pay Bildirimi',
  STRATEGIC_10: '%10 Stratejik Yatırımcı',
  MINORITY_25: '%25 Önemli Azınlık',
  BLOCKING_33: '%33 Bloke Edici Pay',
  MAJORITY_50: '>%50 Çoğunluk Kontrolü',
  SUPERMAJORITY_67: '%67 Güçlendirilmiş Kontrol',
  FULL_100: '%100 Tam Sahiplik',
};

export const TakeoverHoldingView: React.FC<TakeoverHoldingViewProps> = ({
  stocks,
  portfolio,
  cash,
  totalDebt,
  controlledSubsidiaries,
  totalSynergyEarned,
  onExecuteTakeover,
  onBuyToeholdStake,
  formatCurrency,
}) => {
  const [useDebtFinancing, setUseDebtFinancing] = useState<boolean>(false);
  const npcStocks = stocks.filter((s) => !s.isPlayerCompany);

  return (
    <div className="space-y-6">
      {/* Holding Özeti ve Kontrol Seviyeleri Rehberi */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold text-slate-100">
              Aşama 4: Tekel & Holding — Düşmanca Devralma (Hostile Takeover) Masası
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Rakip NPC şirketlerinin hisselerini piyasadan toplayarak veya zorunlu çağrı (tender offer) ile %51+ çoğunluk kontrolünü ele geçirin. %10 altı paylarda NPC yönetim savunması (Poison Pill) ek maliyet doğurur.
            </p>
          </div>

          <div className="flex items-center gap-6 text-right shrink-0">
            <div>
              <div className="text-xs text-slate-400">Bağlı Ortaklık Sayısı</div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-400">
                {controlledSubsidiaries.length} / {npcStocks.length} Şirket
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Holding Borcu</div>
              <div className="text-lg font-bold font-mono tabular-nums text-rose-400">
                {formatCurrency(totalDebt)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">
                Toplam Holding Sinerji Geliri
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-sky-400">
                {formatCurrency(totalSynergyEarned)}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="text-slate-400">
            Kontrol Eşikleri: %5 Bildirim · %10 Stratejik · %25 Azınlık · %33 Bloke Edici · &gt;%50 Kontrol · %67 Güçlendirilmiş · %100 Tam Sahiplik
          </div>
          <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={useDebtFinancing}
              onChange={(e) => setUseDebtFinancing(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-emerald-500"
            />
            <span>
              Satın Alma Kredisi (LBO Finansmanı — Çağrı Maliyetinin %40&apos;ına Kadar Borç Kullan)
            </span>
          </label>
        </div>
      </div>

      {/* Devralma Hedefleri Tablosu */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">
            Rakip NPC Şirketleri, Kontrol Seviyesi ve Çağrı (Tender Offer) Maliyetleri
          </h3>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            Kullanılabilir Nakit: {formatCurrency(cash)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950/60">
                <th className="py-2.5 px-3">Şirket</th>
                <th className="py-2.5 px-3">Kontrol Seviyesi</th>
                <th className="py-2.5 px-3 text-right">Özkaynak Değeri</th>
                <th className="py-2.5 px-3 text-right">Mevcut Payınız</th>
                <th className="py-2.5 px-3 text-right">Baz Çağrı Primi</th>
                <th className="py-2.5 px-3 text-right">%51 İçin Tahmini Maliyet</th>
                <th className="py-2.5 px-3 text-right">Günlük Sinerji</th>
                <th className="py-2.5 px-3 text-right">Aksiyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {npcStocks.map((stock) => {
                const ownedShares = portfolio[stock.ticker]?.shares || 0;
                const targetShares = Math.floor(stock.totalShares * 0.51) + 1;
                const neededShares = Math.max(0, targetShares - ownedShares);
                const defensePenalty = stock.playerOwnershipPct < 10 ? 0.06 : 0;
                const basePremium =
                  0.2 +
                  0.08 * Math.max(0, stock.sentimentScore * 10) +
                  defensePenalty;
                const tenderPrice = stock.askPrice * (1 + basePremium);
                const sharesCost = neededShares * tenderPrice;
                const integrationFee = sharesCost * 0.018;
                const tenderCost = sharesCost + integrationFee;
                const dailySynergy =
                  Math.max(0, stock.financials.EBITDA / 252) * 0.12 * 0.51;
                const maxPurchasingPower = useDebtFinancing
                  ? cash + tenderCost * 0.4
                  : cash;
                const canAffordTakeover = maxPurchasingPower >= tenderCost;
                const fivePctLots = Math.max(
                  10,
                  Math.floor(stock.totalShares * 0.05)
                );

                return (
                  <tr key={stock.ticker} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3">
                      <div className="font-mono font-semibold text-slate-100">
                        {stock.ticker}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {stock.name} ({stock.sector})
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      <div>{CONTROL_LABELS[stock.controlLevel]}</div>
                      {stock.playerOwnershipPct < 10 &&
                        !stock.isControlledByPlayer && (
                          <div className="text-[10px] text-amber-400">
                            Yönetim Savunması Aktif (+%6 Prim)
                          </div>
                        )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                      {formatCurrency(stock.equityValue)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-100">
                      %{stock.playerOwnershipPct.toFixed(2)} (
                      {ownedShares.toLocaleString('tr-TR')} lot)
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-400">
                      +{(basePremium * 100).toFixed(1)}% (
                      {tenderPrice.toFixed(2)} TL)
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-100">
                      {stock.isControlledByPlayer
                        ? '0 TL'
                        : formatCurrency(tenderCost)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400">
                      +{formatCurrency(dailySynergy)} / gün
                    </td>
                    <td className="py-3 px-3 text-right">
                      {stock.isControlledByPlayer ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium whitespace-nowrap shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Holding Kontrolünde
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onBuyToeholdStake(stock.ticker, fivePctLots)
                            }
                            disabled={
                              cash < fivePctLots * stock.askPrice * 1.002
                            }
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded text-xs whitespace-nowrap shrink-0 transition-colors"
                          >
                            +%5 Pay Topla
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onExecuteTakeover(stock.ticker, {
                                targetOwnershipPct: 51.0,
                                useDebtFinancing,
                              })
                            }
                            disabled={!canAffordTakeover}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium rounded text-xs whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Devral (%51+)
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
