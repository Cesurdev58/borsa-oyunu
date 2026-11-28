/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Prestij penceresi: "Yeni şehirde başla" (motor: engine/PrestigeEngine.ts).
 * Geri dönüşü olmayan bir işlem olduğu için iki adımlı onay ister.
 */
import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import {
  PRESTIGE_CUSTOMER_PCT_PER_STAR,
  PRESTIGE_MAX_STARS,
  PRESTIGE_MIN_NET_WORTH,
  PRESTIGE_REWARD_PCT_PER_STAR,
} from '../../data/gameBalance';
import { canStartNewCity, getPrestige, prestigeBonuses, starsEarnedFor } from '../../engine/PrestigeEngine';
import type { SimulationState } from '../../models/simulation';

export const PrestigeModal: React.FC<{
  open: boolean;
  state: SimulationState;
  formatCurrency: (v: number) => string;
  onStartNewCity?: () => void;
  onClose: () => void;
}> = ({ open, state, formatCurrency, onStartNewCity, onClose }) => {
  const [confirming, setConfirming] = useState(false);
  if (!open) return null;
  const p = getPrestige(state);
  const earn = starsEarnedFor(state.netWorth, p.stars);
  const ready = canStartNewCity(state);
  const now = prestigeBonuses(p.stars);
  const after = prestigeBonuses(p.stars + earn);
  const fc = (v: number) => formatCurrency(v).replace(/,00$/, '');
  const close = () => {
    setConfirming(false);
    onClose();
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Yeni şehirde başla"
      data-testid="prestige-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.55)] p-3 sm:p-4"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="g-rise w-full max-w-md max-h-[88vh] bg-[var(--g-surface)] rounded-[24px] shadow-2xl flex flex-col overflow-hidden text-sm"
      >
        <div className="g-hero rounded-none px-4 py-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="g-display text-lg font-extrabold text-white leading-tight">Yeni şehirde başla</h2>
            <button
              type="button"
              aria-label="Kapat"
              data-testid="prestige-close-btn"
              onClick={close}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-1" data-testid="prestige-stars" aria-label={`${p.stars} yıldız`}>
            {Array.from({ length: PRESTIGE_MAX_STARS }).map((_, i) => (
              <Star
                key={i}
                className={`w-6 h-6 ${
                  i < p.stars
                    ? 'text-[var(--g-gold)] fill-[var(--g-gold)]'
                    : i < p.stars + earn
                    ? 'text-[var(--g-gold)]'
                    : 'text-white/20'
                }`}
              />
            ))}
          </div>
          <p className="text-[13px] font-semibold text-white/75">
            İmparatorluğunu bu şehirde bırak, yeni bir şehirde sıfırdan başla. Bıraktığın servet kadar kalıcı yıldız kazanırsın; yıldızlar her yeni şehirde seni hızlandırır.
          </p>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="g-card-soft p-3 text-center">
            <div className="text-[13px] font-bold text-[var(--g-muted)]">Şimdi geçersen kazanacağın</div>
            <div data-testid="prestige-earn" className="g-display text-3xl font-extrabold text-[var(--g-gold-dark)]">
              +{earn} yıldız
            </div>
            {!ready && (
              <div className="text-[13px] font-bold text-[var(--g-red)]">
                Toplam varlığın en az {fc(PRESTIGE_MIN_NET_WORTH)} olmalı
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center" data-testid="prestige-bonuses">
            <div className="g-card-soft p-2.5">
              <div className="text-[13px] text-[var(--g-muted)] font-bold">Başlangıç</div>
              <div className="font-extrabold tabular-nums">{fc(after.startCash)}</div>
              <div className="text-[13px] text-[var(--g-muted)] tabular-nums">şimdi {fc(now.startCash)}</div>
            </div>
            <div className="g-card-soft p-2.5">
              <div className="text-[13px] text-[var(--g-muted)] font-bold">Müşteri</div>
              <div className="font-extrabold tabular-nums text-[var(--g-green-dark)]">
                +%{Math.round((after.customerMult - 1) * 100)}
              </div>
              <div className="text-[13px] text-[var(--g-muted)]">yıldız başı %{PRESTIGE_CUSTOMER_PCT_PER_STAR}</div>
            </div>
            <div className="g-card-soft p-2.5">
              <div className="text-[13px] text-[var(--g-muted)] font-bold">Hedef ödülü</div>
              <div className="font-extrabold tabular-nums text-[var(--g-green-dark)]">
                +%{Math.round((after.rewardMult - 1) * 100)}
              </div>
              <div className="text-[13px] text-[var(--g-muted)]">yıldız başı %{PRESTIGE_REWARD_PCT_PER_STAR}</div>
            </div>
          </div>
          {!confirming ? (
            <button
              type="button"
              data-testid="prestige-start-btn"
              disabled={!ready || !onStartNewCity}
              onClick={() => setConfirming(true)}
              className="g-btn g-btn-gold w-full"
            >
              Yeni şehirde başla
            </button>
          ) : (
            <div className="space-y-2" data-testid="prestige-confirm">
              <p className="text-[13px] font-bold text-[var(--g-red)] text-center">
                Emin misin? Dükkânların, şirketin ve hisselerin bu şehirde kalır. Bu işlem geri alınamaz.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirming(false)} className="g-btn g-btn-secondary">
                  Vazgeç
                </button>
                <button
                  type="button"
                  data-testid="prestige-confirm-btn"
                  onClick={() => {
                    setConfirming(false);
                    onStartNewCity?.();
                    onClose();
                  }}
                  className="g-btn g-btn-danger"
                >
                  Evet, başla
                </button>
              </div>
            </div>
          )}
          {p.cities > 0 && (
            <p className="text-[13px] text-[var(--g-muted)] text-center">
              {p.cities}. şehrindesin · bıraktığın en büyük servet {fc(p.bestNetWorth)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
