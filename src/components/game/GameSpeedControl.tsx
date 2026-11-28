/**
 * Hız kapsülü: 1x ↔ 2x geçişi ve Duraklat / Devam düğmesi.
 * Üst çubukta, gün/saatin yanında küçük çift düğme olarak durur (`variant="inline"`).
 * Başlangıç şehri seçimi ya da eski kayıt göçü beklenirken pasif görünür.
 */
import React from 'react';
import { Pause, Play } from 'lucide-react';
import type { TimeScaleOption } from '../../models/simulation';

/** 1x → 2x, 2x → 1x; duraklatılmışken 1x'e döner. */
export function nextSpeedScale(current: TimeScaleOption): TimeScaleOption {
  return current === 1 ? 2 : 1;
}

/** Çalışırken duraklatır; duraklatılmışken son hıza (yoksa 1x) döner. */
export function nextPauseScale(current: TimeScaleOption, lastRunning: TimeScaleOption): TimeScaleOption {
  if (current > 0) return 0;
  return lastRunning > 0 ? lastRunning : 1;
}

export interface GameSpeedControlProps {
  timeScale: TimeScaleOption;
  /** Duraklatmadan önceki hız (devam edince buna dönülür). */
  lastRunningScale: TimeScaleOption;
  disabled?: boolean;
  onSetTimeScale: (scale: TimeScaleOption) => void;
  /** 'inline': üst çubukta küçük çift düğme (varsayılan); 'floating': eski sağ alt kapsül */
  variant?: 'inline' | 'floating';
}

export const GameSpeedControl: React.FC<GameSpeedControlProps> = ({
  timeScale,
  lastRunningScale,
  disabled = false,
  onSetTimeScale,
  variant = 'inline',
}) => {
  const paused = timeScale === 0;
  const inline = variant === 'inline';
  const btn = inline
    ? "relative min-h-[32px] min-w-[30px] rounded-full before:content-[''] before:absolute before:-inset-1.5"
    : 'min-h-[44px] min-w-[44px] rounded-full';
  return (
    <div
      role="group"
      aria-label="Oyun hızı"
      data-testid="game-speed-control"
      data-disabled={disabled ? 'true' : 'false'}
      className={`${
        inline ? 'flex items-center gap-0.5 shrink-0' : 'fixed right-3 bottom-[148px] z-40 flex items-center gap-1 rounded-full bg-[var(--g-navy-800)] p-1 shadow-lg'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        data-testid="game-speed-toggle"
        disabled={disabled || paused}
        aria-label={timeScale === 2 ? 'Hızı 1 kata düşür' : 'Zamanı 2 kat hızlandır'}
        onClick={() => onSetTimeScale(nextSpeedScale(timeScale))}
        className={`${btn} bg-white/15 px-1.5 text-[13px] font-extrabold tabular-nums text-white disabled:opacity-60`}
      >
        {timeScale === 2 ? '2x' : '1x'}
      </button>
      <button
        type="button"
        data-testid="game-pause-toggle"
        disabled={disabled}
        aria-pressed={paused}
        aria-label={paused ? 'Oyunu devam ettir' : 'Oyunu duraklat'}
        onClick={() => onSetTimeScale(nextPauseScale(timeScale, lastRunningScale))}
        className={`${btn} px-1.5 text-white flex items-center justify-center ${
          paused ? 'bg-[var(--g-gold)] text-[#3b2a00]' : 'bg-white/15'
        }`}
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </button>
    </div>
  );
};
