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
import { MergerAcquisitionEngine } from '../../../engine/MergerAcquisitionEngine';
import { MARKET_BUY_MAX_OWNERSHIP_PCT } from '../../../data/gameBalance';
import type { ControlThresholdLevel } from '../../../models/market';

import type {
  BuildingDetailContentProps,
} from './buildingTypes';

const CONTROL_LABEL_TR: Record<ControlThresholdLevel, string> = {
  NONE: '—',
  SIGNIFICANT_5: 'Ortak',
  STRATEGIC_10: 'Büyük ortak',
  MINORITY_25: 'Güçlü ortak',
  BLOCKING_33: 'Güçlü ortak',
  MAJORITY_50: 'Senin',
  SUPERMAJORITY_67: 'Senin',
  FULL_100: 'Tamamen senin',
};

export const HoldingMerkeziPanel: React.FC<BuildingDetailContentProps> = ({
  state,
  onBuyStock,
  onExecuteTakeover,
  formatCurrency,
}) => {
  const myCompany = state.playerCompany;
  // Varsayılan hedef: oyuncunun kendi sektöründeki ilk rakip (devralınca pazarı açılır)
  const defaultTarget =
    state.stocks.find(
      (s) => !s.isPlayerCompany && !s.isControlledByPlayer && myCompany && s.sector === myCompany.sector
    )?.ticker ?? 'KRGO';
  const [takeoverTargetTicker, setTakeoverTargetTicker] =
    useState<string>(defaultTarget);
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
        <div className="p-3.5 g-card-soft flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <div className="font-extrabold text-amber-950 text-base">
              Holding kilitli
            </div>
            <p className="text-amber-900 text-[13px] mt-0.5">
              Bir şirketin %5'ini al ya da şirketini halka arz et.
            </p>
          </div>
        </div>
      )}

      <div className="g-hero p-5 text-center space-y-2 tabular-nums">
        <div className="text-sm font-bold text-[#ffb4b2]">Bağlı şirketlerin</div>
        <div className="text-5xl font-extrabold g-hero-value">
          {state.controlledSubsidiaries.length}
        </div>
        <div className="text-sm font-bold text-white/65">
          Holding geliri: {formatCurrency(state.totalSynergyEarned)}
        </div>
      </div>

      {/* Devralma İşlem Kartı */}
      {selectedTarget && (
        <div className="g-card p-3.5 space-y-3">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-slate-600">
              Hangi şirket?
            </label>
            <select
              value={selectedTarget.ticker}
              onChange={(e) => setTakeoverTargetTicker(e.target.value)}
              data-testid="holding-target-select"
              className="g-input w-full min-h-[44px] font-semibold"
            >
              {npcStocks.map((s) => (
                <option key={s.ticker} value={s.ticker}>
                  {s.name}
                  {myCompany && s.sector === myCompany.sector ? ' · senin sektörün' : ''}
                  {s.isControlledByPlayer ? ' · senin' : ''}
                </option>
              ))}
            </select>
            <div className="flex justify-between text-[13px] text-[var(--g-muted)] font-semibold tabular-nums">
              <span>Şirket değeri {formatCurrency(selectedTarget.equityValue)}</span>
              <span>Payın %{selectedTarget.playerOwnershipPct.toFixed(1)}</span>
            </div>
          </div>

          {(() => {
            const owned = state.portfolio[selectedTarget.ticker]?.shares ?? 0;
            const est = MergerAcquisitionEngine.estimateTakeover(selectedTarget, owned);
            const sameSector = !!myCompany && myCompany.sector === selectedTarget.sector;
            const market = myCompany?.operations?.sectorMarketUnits ?? 0;
            const rivalUnits = selectedTarget.financials.dailyUnitsSold ?? 0;
            const rivalPct =
              sameSector && market > 0 ? Math.round((rivalUnits / market) * 100) : 0;
            // Aynı sektörde: rakibin müşterileri şirketine açılır (kapasite büyütülürse)
            const myUnits = Math.max(1, myCompany?.operations?.actualSalesUnits ?? 0);
            const myProfitPerUnit = myCompany ? Math.max(0, myCompany.financials.netIncome / 120) / myUnits : 0;
            const marketGain = sameSector ? Math.round(rivalUnits * myProfitPerUnit) : 0;
            const dailyGain = est.dailyPayout + marketGain;
            return (
              <div className="grid grid-cols-2 gap-2 tabular-nums" data-testid="holding-takeover-estimate">
                <div className="g-card-soft p-2.5">
                  <div className="text-[13px] text-[var(--g-muted)] font-semibold">Devralma bedeli (yakl.)</div>
                  <div className="g-display text-lg font-extrabold text-[var(--g-gold-dark)]">
                    {selectedTarget.isControlledByPlayer ? '—' : formatCurrency(est.estimatedCost)}
                  </div>
                </div>
                <div className="g-card-soft p-2.5">
                  <div className="text-[13px] text-[var(--g-muted)] font-semibold">Günlük ek kazanç (yakl.)</div>
                  <div className="g-display text-lg font-extrabold text-[var(--g-green-dark)]">
                    +{formatCurrency(dailyGain)}
                  </div>
                </div>
                <div className="g-tip col-span-2">
                  {sameSector
                    ? `Senin sektöründe: devralınca pazarın yaklaşık %${rivalPct}'i şirketine açılır (kapasiteni büyütürsen). Kâr payın günde ${formatCurrency(est.dailyPayout)}.`
                    : 'Başka sektörde: yalnızca kâr payı getirir, şirketinin pazarını değiştirmez.'}{' '}
                  Borsadan en fazla %{MARKET_BUY_MAX_OWNERSHIP_PCT} alınabilir; kontrol için devralma teklifi gerekir.
                </div>
              </div>
            );
          })()}

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
              className="g-btn g-btn-secondary px-3"
            >
              %5 pay al ({selectedTarget.ticker})
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
              className="g-btn g-btn-danger px-3"
            >
              {selectedTarget.isControlledByPlayer
                ? 'Şirket senin'
                : `Şirketi devral (${selectedTarget.ticker})`}
            </button>
          </div>
        </div>
      )}

      {/* İştirakler ve Sahiplik Tablosu */}
      <div className="space-y-1.5">
        <h3 className="font-bold text-slate-900">
          Paylarım
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
                  {CONTROL_LABEL_TR[s.controlLevel] ?? '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
