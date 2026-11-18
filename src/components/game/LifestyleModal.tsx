/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gösteriş harcamaları penceresi (veri: data/lifestyle.ts, motor: engine/LifestyleEngine.ts).
 * Üstte ticari itibar; altında her lüks alım: fiyat, verdiği itibar, "Satın al" ya da "Senin".
 */
import React from 'react';
import { Check, Crown, X } from 'lucide-react';
import { LIFESTYLE_ITEMS, REPUTATION_MAX } from '../../data/lifestyle';
import { ownedLifestyle } from '../../engine/LifestyleEngine';
import type { SimulationState } from '../../models/simulation';

export const LifestyleModal: React.FC<{
  open: boolean;
  state: SimulationState;
  spendableCash: number;
  formatCurrency: (v: number) => string;
  onBuy?: (itemId: string) => void;
  onClose: () => void;
}> = ({ open, state, spendableCash, formatCurrency, onBuy, onClose }) => {
  if (!open) return null;
  const owned = new Set(ownedLifestyle(state));
  const rep = state.tradeState?.tradeReputationScore ?? 58;
  const fc = (v: number) => formatCurrency(v).replace(/,00$/, '');
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lüks alışveriş"
      data-testid="lifestyle-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.55)] p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="g-rise w-full max-w-md max-h-[85vh] bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden text-sm"
      >
        <div className="g-hero rounded-none px-4 py-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-[var(--g-gold)]" />
              <h2 className="g-display text-lg font-extrabold text-white leading-tight">Lüks alışveriş</h2>
            </div>
            <button
              type="button"
              aria-label="Kapat"
              data-testid="lifestyle-close-btn"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div>
            <div className="g-hero-label">Ticari itibarın</div>
            <div className="flex items-baseline gap-2">
              <span data-testid="lifestyle-reputation" className="g-hero-value text-5xl tabular-nums">
                {Math.round(rep)}
              </span>
              <span className="text-white/60 font-bold">/ {REPUTATION_MAX}</span>
            </div>
            <div className="g-track h-2.5 mt-2">
              <div className="g-fill" style={{ width: `${Math.min(100, rep)}%` }} />
            </div>
            <p className="text-[13px] font-semibold text-white/70 mt-2">
              İtibar arttıkça dükkânlarına daha çok müşteri gelir. Şirketleşmek için en az 60 gerekir.
            </p>
          </div>
        </div>
        <ul className="p-3 overflow-y-auto space-y-2 flex-1">
          {LIFESTYLE_ITEMS.map((it) => {
            const mine = owned.has(it.id);
            const canPay = spendableCash >= it.price;
            return (
              <li
                key={it.id}
                data-testid={`lifestyle-item-${it.id}`}
                data-owned={mine ? 'true' : 'false'}
                className={`flex items-center gap-3 p-3 rounded-2xl ${mine ? 'bg-[#ecfaf3]' : 'bg-[var(--g-surface-2)]'}`}
              >
                <span className="w-12 h-12 shrink-0 rounded-2xl bg-white flex items-center justify-center text-[26px]">
                  {it.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-[var(--g-ink)] leading-tight">{it.name}</div>
                  <div className="text-[13px] font-bold text-[var(--g-green-dark)]">+{it.reputation} itibar</div>
                </div>
                {mine ? (
                  <span className="g-pill bg-white text-[var(--g-green-dark)] shrink-0">
                    <Check size={14} strokeWidth={3} /> Senin
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid={`lifestyle-buy-${it.id}`}
                    disabled={!canPay || !onBuy}
                    onClick={() => onBuy?.(it.id)}
                    className="g-btn g-btn-gold g-btn-sm shrink-0 px-3 tabular-nums"
                  >
                    {fc(it.price)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="px-4 py-2 text-[13px] text-[var(--g-muted)] shrink-0 border-t border-[var(--g-line)]">
          Lüks alımlar toplam varlığına sayılmaz: zenginler listesinde biraz geriye düşebilirsin.
        </p>
      </div>
    </div>
  );
};
