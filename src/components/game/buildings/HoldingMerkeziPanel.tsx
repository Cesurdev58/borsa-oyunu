/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HOLDING_MERKEZI bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import React, {
  useState,
} from 'react';
import {
  Lock,
} from 'lucide-react';

import type {
  BuildingDetailContentProps,
} from './buildingTypes';

export const HoldingMerkeziPanel: React.FC<BuildingDetailContentProps> = ({
  state,
  onBuyStock,
  onExecuteTakeover,
  formatCurrency,
}) => {
  const [takeoverTargetTicker, setTakeoverTargetTicker] =
    useState<string>('KRGO');
  const [useDebtForTakeover, setUseDebtForTakeover] = useState<boolean>(false);



  // 8. HOLDİNG MERKEZİ
  const npcStocks = state.stocks.filter((s) => !s.isPlayerCompany);
  const selectedTarget =
    npcStocks.find((s) => s.ticker === takeoverTargetTicker) || npcStocks[0];

  return (
    <div
      className="space-y-4 text-xs"
      data-testid="sheet-content-HOLDING_MERKEZI"
    >
      {!state.stageUnlocks.stage4Holding && (
        <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <div className="font-bold text-amber-950">
              Holding Merkezi Kilit Koşulu (Aşama 4)
            </div>
            <p className="text-amber-900 text-[11px] mt-0.5">
              Bir NPC şirketinde en az %5 stratejik pay topladığınızda veya
              şirketinizi halka arz ettiğinizde Holding Aşaması aktifleşir.
              Aşağıdan öncü pay alabilir veya devralma hedeflerini inceleyebilirsiniz.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 font-mono tabular-nums">
        <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200">
          <div className="text-[11px] text-rose-800">
            Kontrol Edilen Bağlı Ortaklıklar
          </div>
          <div className="text-base font-bold text-rose-950 mt-0.5">
            {state.controlledSubsidiaries.length} Şirket
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
          <div className="text-[11px] text-emerald-800">
            Toplam Holding Sinerji Geliri
          </div>
          <div className="text-base font-bold text-emerald-950 mt-0.5">
            {formatCurrency(state.totalSynergyEarned)}
          </div>
        </div>
      </div>

      {/* Devralma İşlem Kartı */}
      {selectedTarget && (
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Hedef Rakip Şirket Seçin
              </label>
              <select
                value={selectedTarget.ticker}
                onChange={(e) => setTakeoverTargetTicker(e.target.value)}
                className="min-h-[40px] px-3 rounded-xl bg-slate-50 border border-slate-300 font-semibold text-slate-900"
              >
                {npcStocks.map((s) => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.ticker} - {s.name} (Payınız: %
                    {s.playerOwnershipPct.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-right font-mono">
              <div className="text-xs font-bold text-slate-900">
                Piyasa Değeri: {formatCurrency(selectedTarget.equityValue)}
              </div>
              <div className="text-[11px] text-slate-500">
                Mevcut Pay: %{selectedTarget.playerOwnershipPct.toFixed(2)} (
                {selectedTarget.controlLevel})
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={useDebtForTakeover}
              onChange={(e) => setUseDebtForTakeover(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span>
              Kaldıraçlı Satın Alma (LBO Borç Finansmanı Kullan - %60’a kadar)
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                onBuyStock(
                  selectedTarget.ticker,
                  Math.max(10, Math.ceil(selectedTarget.totalShares * 0.05))
                )
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold"
            >
              %5 Stratejik Öncü Pay Satın Al ({selectedTarget.ticker})
            </button>
            <button
              type="button"
              disabled={selectedTarget.isControlledByPlayer}
              onClick={() =>
                onExecuteTakeover(selectedTarget.ticker, {
                  targetOwnershipPct: 51.0,
                  useDebtFinancing: useDebtForTakeover,
                })
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold"
            >
              {selectedTarget.isControlledByPlayer
                ? 'Çoğunluk Kontrolü Sizde (%51+)'
                : `%51+ Düşmanca Devralma Başlat (${selectedTarget.ticker})`}
            </button>
          </div>
        </div>
      )}

      {/* İştirakler ve Sahiplik Tablosu */}
      <div className="space-y-1.5">
        <h3 className="font-bold text-slate-900">
          Borsa Şirketleri Ortaklık & Kontrol Durumu
        </h3>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {npcStocks.map((s) => (
            <div
              key={s.ticker}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
            >
              <div>
                <span className="font-mono font-bold text-slate-900">
                  {s.ticker}
                </span>{' '}
                <span className="text-slate-600">· {s.name}</span>
              </div>
              <div className="font-mono text-right shrink-0">
                <span className="font-bold text-slate-900">
                  %{s.playerOwnershipPct.toFixed(2)}
                </span>{' '}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  {s.controlLevel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
