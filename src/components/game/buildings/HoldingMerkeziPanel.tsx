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
            <div className="font-extrabold text-amber-950 text-base">
              🔒 Holding kilitli
            </div>
            <p className="text-amber-900 text-[13px] mt-0.5">
              Bir şirketin %5'ini al ya da şirketini halka arz et.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-gradient-to-br from-rose-100 to-orange-100 p-5 text-center space-y-2 tabular-nums">
        <div className="text-sm font-bold text-rose-800">🏛️ Bağlı şirketlerin</div>
        <div className="text-5xl font-extrabold text-rose-900">
          {state.controlledSubsidiaries.length}
        </div>
        <div className="text-sm font-bold text-emerald-700">
          💰 Holding geliri: {formatCurrency(state.totalSynergyEarned)}
        </div>
      </div>

      {/* Devralma İşlem Kartı */}
      {selectedTarget && (
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1">
                Hangi şirket?
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
            <div className="text-right tabular-nums">
              <div className="text-xs font-bold text-slate-900">
                💎 {formatCurrency(selectedTarget.equityValue)}
              </div>
              <div className="text-[13px] text-slate-500">
                Payın: %{selectedTarget.playerOwnershipPct.toFixed(1)}
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
              Borç alarak satın al (%60'a kadar)
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
              className="min-h-[56px] px-3 py-2 rounded-2xl bg-slate-100 text-slate-900 font-extrabold active:scale-95"
            >
              📈 %5 pay al ({selectedTarget.ticker})
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
              className="min-h-[56px] px-3 py-2 rounded-2xl bg-gradient-to-b from-rose-400 to-rose-600 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white font-extrabold shadow active:scale-95"
            >
              {selectedTarget.isControlledByPlayer
                ? '✅ Şirket senin'
                : `🏛️ Şirketi devral (${selectedTarget.ticker})`}
            </button>
          </div>
        </div>
      )}

      {/* İştirakler ve Sahiplik Tablosu */}
      <div className="space-y-1.5">
        <h3 className="font-bold text-slate-900">
          📋 Paylarım
        </h3>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {npcStocks.map((s) => (
            <div
              key={s.ticker}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
            >
              <div>
                <span className="tabular-nums font-bold text-slate-900">
                  {s.ticker}
                </span>{' '}
                <span className="text-slate-600">· {s.name}</span>
              </div>
              <div className="tabular-nums text-right shrink-0">
                <span className="font-bold text-slate-900">
                  %{s.playerOwnershipPct.toFixed(2)}
                </span>{' '}
                <span className="text-[13px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
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
