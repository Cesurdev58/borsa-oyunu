/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crosshair,
  FastForward,
  Pause,
  Play,
  Sunrise,
  Timer,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { TimeScaleOption } from '../../../models/simulation';
import { CityZoomPreset } from './cityVisualTypes';

interface CityCameraControlsProps {
  zoomPreset: CityZoomPreset;
  onChangeZoomPreset: (preset: CityZoomPreset) => void;
  onResetCameraCenter: () => void;
  onFocusPlayerCompany?: () => void;
  timeScale: TimeScaleOption;
  isPaused: boolean;
  onSetTimeScale: (scale: TimeScaleOption) => void;
  onAdvanceToMarketOpen: () => void;
  onAdvanceOneHour: () => void;
  onTickDay: () => void;
  nextEventLabelTR: string;
  nextEventFormattedRemaining: string;
}

/**
 * Harita köşesinde yer alan kompakt kamera (Merkeze Dön, Şirkete Odaklan, Yakın/Normal/Genel),
 * tek satırlık sonraki olay kapsülü (dokunulunca Detaylı Zaman Paneli açılır)
 * ve sağ alt kompakt hız kapsülü (Duraklat, 1x, 2x).
 */
export const CityCameraControls: React.FC<CityCameraControlsProps> = React.memo(
  ({
    zoomPreset,
    onChangeZoomPreset,
    onResetCameraCenter,
    onFocusPlayerCompany,
    timeScale,
    isPaused,
    onSetTimeScale,
    onAdvanceToMarketOpen,
    onAdvanceOneHour,
    onTickDay,
    nextEventLabelTR,
    nextEventFormattedRemaining,
  }) => {
    const [isTimePanelOpen, setIsTimePanelOpen] = useState(false);

    const cycleZoom = (dir: 'in' | 'out') => {
      if (dir === 'in') {
        if (zoomPreset === 'OVERVIEW') onChangeZoomPreset('NORMAL');
        else if (zoomPreset === 'NORMAL') onChangeZoomPreset('CLOSER');
      } else {
        if (zoomPreset === 'CLOSER') onChangeZoomPreset('NORMAL');
        else if (zoomPreset === 'NORMAL') onChangeZoomPreset('OVERVIEW');
      }
    };

    const zoomLabelTR =
      zoomPreset === 'CLOSER'
        ? 'Yakın'
        : zoomPreset === 'OVERVIEW'
        ? 'Genel'
        : 'Normal';

    return (
      <>
        {/* Sol Üst Harita Köşesi: Tek Satırlık Sonraki Önemli Olay Kapsülü */}
        <button
          type="button"
          data-testid="city-next-event-pill"
          aria-expanded={isTimePanelOpen}
          aria-label={`${nextEventLabelTR} ${nextEventFormattedRemaining} — Detaylı zaman panelini aç`}
          onClick={() => setIsTimePanelOpen((prev) => !prev)}
          className="absolute top-2.5 left-2.5 z-20 min-h-[32px] px-2 py-1 rounded-full bg-white/95 hover:bg-white border border-slate-200/90 shadow-xs flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-700 pointer-events-auto max-w-[165px] sm:max-w-none transition-colors"
        >
          <Timer className="w-3 h-3 text-sky-600 shrink-0" />
          <span className="truncate font-medium max-w-[74px] sm:max-w-none">
            {nextEventLabelTR}
          </span>
          <strong className="font-mono text-slate-900 tabular-nums whitespace-nowrap">
            {nextEventFormattedRemaining}
          </strong>
          {isTimePanelOpen ? (
            <ChevronUp className="w-3 h-3 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
          )}
        </button>

        {/* Açılır Detaylı Zaman Paneli */}
        {isTimePanelOpen && (
          <div
            role="dialog"
            aria-label="Detaylı Zaman ve Seans Paneli"
            data-testid="detailed-time-panel"
            className="absolute top-12 left-2.5 z-30 w-[276px] sm:w-[310px] rounded-2xl bg-white/98 border border-slate-200 shadow-lg p-3 pointer-events-auto"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>Zaman & Piyasa Seansı</span>
              </div>
              <button
                type="button"
                data-testid="close-detailed-time-panel-btn"
                aria-label="Zaman panelini kapat"
                onClick={() => setIsTimePanelOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-600 mb-3">
              <div className="flex items-center justify-between">
                <span>Sonraki Olay:</span>
                <span className="font-semibold text-slate-900">
                  {nextEventLabelTR} ({nextEventFormattedRemaining})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Borsa Seansı:</span>
                <span className="font-mono text-slate-800">10:00 – 18:00</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Akış Hızı:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {isPaused ? 'Duraklatıldı (0x)' : `${timeScale}x Aktif`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                data-testid="btn-advance-market-open"
                onClick={onAdvanceToMarketOpen}
                className="col-span-3 min-h-[36px] px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[11px] font-semibold inline-flex items-center justify-center gap-1"
              >
                <Sunrise className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Açılışa İlerlet (10:00)</span>
              </button>

              <button
                type="button"
                data-testid="btn-advance-one-hour"
                onClick={onAdvanceOneHour}
                className="col-span-1 min-h-[36px] px-2 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-semibold"
              >
                +1 Saat
              </button>

              <button
                type="button"
                data-testid="btn-advance-one-day"
                onClick={onTickDay}
                className="col-span-2 min-h-[36px] px-2 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-semibold inline-flex items-center justify-center gap-1"
              >
                <FastForward className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>+1 Gün İlerlet</span>
              </button>
            </div>
          </div>
        )}

        {/* Sağ Üst Harita Köşesi: Kamera Merkeze Döndürme, Şirkete Odaklanma ve Zoom Kontrolleri */}
        <div
          role="group"
          aria-label="Harita Kamera Kontrolleri"
          className="absolute top-2.5 right-2.5 z-20 flex items-center gap-0.5 sm:gap-1 bg-white/95 border border-slate-200/90 rounded-full px-1 py-0.5 shadow-xs pointer-events-auto"
        >
          <button
            type="button"
            data-testid="camera-zoom-out-btn"
            aria-label="Haritayı Uzaklaştır"
            disabled={zoomPreset === 'OVERVIEW'}
            onClick={() => cycleZoom('out')}
            className="min-w-[28px] min-h-[28px] sm:min-w-[32px] sm:min-h-[32px] rounded-full hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center text-slate-700"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span
            data-testid="camera-zoom-label"
            className="px-1 text-[10px] font-mono font-bold text-slate-700"
          >
            {zoomLabelTR}
          </span>

          <button
            type="button"
            data-testid="camera-zoom-in-btn"
            aria-label="Haritayı Yakınlaştır"
            disabled={zoomPreset === 'CLOSER'}
            onClick={() => cycleZoom('in')}
            className="min-w-[28px] min-h-[28px] sm:min-w-[32px] sm:min-h-[32px] rounded-full hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center text-slate-700"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {onFocusPlayerCompany && (
            <button
              type="button"
              data-testid="camera-focus-company-btn"
              aria-label="Oyuncu Şirketine Odaklan"
              title="Oyuncu Şirketine Odaklan"
              onClick={onFocusPlayerCompany}
              className="min-h-[28px] sm:min-h-[32px] px-1.5 sm:px-2 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200/80 text-[10px] sm:text-[11px] font-semibold inline-flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5 text-teal-700" />
              <span className="hidden sm:inline">Şirket</span>
            </button>
          )}

          <button
            type="button"
            data-testid="camera-reset-center-btn"
            aria-label="Haritayı Merkeze Döndür"
            title="Haritayı Merkeze Döndür"
            onClick={onResetCameraCenter}
            className="min-h-[28px] sm:min-h-[32px] px-1.5 sm:px-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] sm:text-[11px] font-semibold inline-flex items-center gap-1"
          >
            <Crosshair className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">Merkez</span>
          </button>
        </div>

        {/* Sağ Alt Harita Köşesi: Kompakt Hız Kapsülü (Duraklat, 1x, 2x) */}
        <div
          role="region"
          aria-label="Oyun Zaman ve Hız Kontrolleri"
          data-testid="game-time-controls"
          className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 bg-white/95 border border-slate-200/90 rounded-full p-1 shadow-sm pointer-events-auto"
        >
          <div
            role="group"
            aria-label="Simülasyon Hızı Seçimi"
            className="flex items-center gap-1"
          >
            <button
              type="button"
              data-testid="speed-btn-pause"
              onClick={() => onSetTimeScale(0)}
              aria-pressed={isPaused}
              className={`min-h-[36px] px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center justify-center gap-1 border transition-colors ${
                isPaused
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Pause className="w-3 h-3 shrink-0" />
              <span>Duraklat</span>
            </button>

            {([1, 2] as TimeScaleOption[]).map((sc) => {
              const active = !isPaused && timeScale === sc;
              return (
                <button
                  key={`speed-scale-${sc}x`}
                  type="button"
                  data-testid={`speed-btn-${sc}x`}
                  onClick={() => onSetTimeScale(sc)}
                  aria-pressed={active}
                  className={`min-h-[36px] min-w-[38px] px-2 py-1 rounded-full text-[11px] font-mono font-bold inline-flex items-center justify-center gap-0.5 border transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Play className="w-2.5 h-2.5 shrink-0" />
                  <span>{sc}x</span>
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }
);
