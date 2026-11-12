/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Clock,
  FastForward,
  Pause,
  Play,
  Sunrise,
  Timer,
} from 'lucide-react';
import { MarketSession, TimeScaleOption } from '../../models/simulation';
import { getMarketSessionBadgeMeta } from './gameTypes';

interface GameTimeControlsProps {
  formattedTime: string;
  marketSession: MarketSession;
  timeScale: TimeScaleOption;
  isPaused: boolean;
  nextEventLabelTR: string;
  nextEventFormattedRemaining: string;
  activePendingOrdersCount: number;
  nearestOrderExpiryDays: number | null;
  onSetTimeScale: (scale: TimeScaleOption) => void;
  onAdvanceToMarketOpen: () => void;
  onAdvanceOneHour: () => void;
  onTickDay: () => void;
}

export const GameTimeControls: React.FC<GameTimeControlsProps> = React.memo(
  ({
    formattedTime,
    marketSession,
    timeScale,
    isPaused,
    nextEventLabelTR,
    nextEventFormattedRemaining,
    activePendingOrdersCount,
    nearestOrderExpiryDays,
    onSetTimeScale,
    onAdvanceToMarketOpen,
    onAdvanceOneHour,
    onTickDay,
  }) => {
    const sessionMeta = getMarketSessionBadgeMeta(marketSession);

    return (
      <section
        aria-label="Oyun Zaman ve Hız Kontrolleri"
        data-testid="game-time-controls"
        className="rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-2xs space-y-2.5"
      >
        {/* Üst Satır: Oyun Saati, Piyasa Durumu ve Sonraki Önemli Olay */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 tabular-nums font-bold text-slate-900 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              Saat: <span data-testid="controls-game-time">{formattedTime}</span>
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span
              className={`px-2 py-0.5 rounded-md border text-[13px] font-semibold ${sessionMeta.bgClass} ${sessionMeta.textClass} ${sessionMeta.borderClass}`}
            >
              {sessionMeta.fullLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-600 font-medium">
            <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-lg tabular-nums tabular-nums">
              <Timer className="w-3 h-3 text-indigo-600" />
              <span>{nextEventLabelTR}:</span>
              <strong className="text-slate-900">
                {nextEventFormattedRemaining}
              </strong>
            </span>
            {activePendingOrdersCount > 0 && nearestOrderExpiryDays !== null && (
              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-amber-900 tabular-nums tabular-nums">
                <span>
                  {activePendingOrdersCount} Açık Emir (Vade: {nearestOrderExpiryDays} gün)
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Alt Satır: Hız Seçenekleri (Duraklat, 1x, 2x) ve Hızlı Zaman Adımları */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Simülasyon Hızı Seçimi"
            className="grid grid-cols-4 gap-1.5 flex-1 sm:flex-initial"
          >
            <button
              type="button"
              data-testid="speed-btn-pause"
              onClick={() => onSetTimeScale(0)}
              aria-pressed={isPaused}
              className={`min-h-[44px] min-w-[64px] px-2.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1 border transition-colors ${
                isPaused
                  ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Pause className="w-3.5 h-3.5 shrink-0" />
              <span>Duraklat</span>
            </button>

            {([1, 2] as TimeScaleOption[]).map((sc) => {
              const active = !isPaused && timeScale === sc;
              return (
                <button
                  key={sc}
                  type="button"
                  data-testid={`speed-btn-${sc}x`}
                  onClick={() => onSetTimeScale(sc)}
                  aria-pressed={active}
                  className={`min-h-[44px] min-w-[48px] px-3 py-1.5 rounded-xl text-xs tabular-nums font-bold inline-flex items-center justify-center gap-1 border transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Play className="w-3 h-3 shrink-0" />
                  <span>{sc}x</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              data-testid="btn-advance-market-open"
              onClick={onAdvanceToMarketOpen}
              className="min-h-[44px] px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors flex-1 sm:flex-initial"
            >
              <Sunrise className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Açılışa İlerlet (10:00)</span>
            </button>

            <button
              type="button"
              data-testid="btn-advance-one-hour"
              onClick={onAdvanceOneHour}
              className="min-h-[44px] px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors"
            >
              <span>+1 Saat</span>
            </button>

            <button
              type="button"
              data-testid="btn-advance-one-day"
              onClick={onTickDay}
              className="min-h-[44px] px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors"
            >
              <FastForward className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>+1 Gün</span>
            </button>
          </div>
        </div>
      </section>
    );
  }
);
