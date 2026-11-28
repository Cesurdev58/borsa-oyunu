/**
 * Hız kapsülü: 1x ↔ 2x geçişi ve Duraklat / Devam düğmesi.
 * Ekranın sağ altında, alt menünün hemen üstünde durur (karar kartı ve gün raporu kapsülüyle çakışmaz).
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
}

export const GameSpeedControl: React.FC<GameSpeedControlProps> = ({
  timeScale,
  lastRunningScale,
  disabled = false,
  onSetTimeScale,
}) => {
  const paused = timeScale === 0;
  return (
    <div
      role="group"
      aria-label="Oyun hızı"
      data-testid="game-speed-control"
      data-disabled={disabled ? 'true' : 'false'}
      className={`fixed right-3 bottom-[148px] z-40 flex items-center gap-1 rounded-full bg-[var(--g-navy-800)] p-1 shadow-lg ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <button
        type="button"
        data-testid="game-speed-toggle"
        disabled={disabled || paused}
        aria-label={timeScale === 2 ? 'Hızı 1 kata düşür' : 'Zamanı 2 kat hızlandır'}
        onClick={() => onSetTimeScale(nextSpeedScale(timeScale))}
        className="min-h-[44px] min-w-[44px] rounded-full bg-white/15 px-3 text-[15px] font-extrabold tabular-nums text-white disabled:opacity-60"
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
        className={`min-h-[44px] min-w-[44px] rounded-full px-3 text-white flex items-center justify-center ${
          paused ? 'bg-[var(--g-gold)] text-[#3b2a00]' : 'bg-white/15'
        }`}
      >
        {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
      </button>
    </div>
  );
};
