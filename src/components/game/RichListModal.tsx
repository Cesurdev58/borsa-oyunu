/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Zenginler listesi penceresi (veri: engine/RichListEngine.ts). Kişiler uydurmadır.
 * Oyuncunun satırı vurgulanır, bir üstündeki kişiye ne kadar kaldığı yazar.
 */
import React, { useEffect, useRef } from 'react';
import { Star, Trophy, X } from 'lucide-react';
import { buildRichList } from '../../engine/RichListEngine';
import type { SimulationState } from '../../models/simulation';
import { formatHudCurrencyTR } from './ui/questAndHudLogic';

export const RichListModal: React.FC<{
  open: boolean;
  state: SimulationState;
  onClose: () => void;
  /** Prestij penceresini aç (yeni şehirde başla) */
  onOpenPrestige?: () => void;
}> = ({ open, state, onClose, onOpenPrestige }) => {
  const playerRowRef = useRef<HTMLLIElement | null>(null);
  // Açılınca listeyi oyuncunun satırına kaydır (yeni oyuncu en altta başlar)
  useEffect(() => {
    if (open) playerRowRef.current?.scrollIntoView?.({ block: 'center' });
  }, [open]);
  if (!open) return null;
  const list = buildRichList(state);
  const short = (v: number) => formatHudCurrencyTR(v).compactText.replace(' TL', ' ₺');
  const gap = list.nextAbove ? list.nextAbove.netWorth - state.netWorth : 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Zenginler listesi"
      data-testid="rich-list-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.55)] p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="g-rise w-full max-w-md max-h-[85vh] bg-[var(--g-surface)] rounded-[24px] shadow-2xl flex flex-col overflow-hidden text-sm"
      >
        <div className="g-hero rounded-none px-4 py-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-[var(--g-gold)]" />
              <h2 className="g-display text-lg font-extrabold text-white leading-tight">Zenginler listesi</h2>
            </div>
            <button
              type="button"
              aria-label="Kapat"
              data-testid="rich-list-close-btn"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="g-hero-label">Senin sıran</div>
              <div data-testid="rich-list-player-rank" className="g-hero-value text-5xl tabular-nums">
                {list.playerRank}.
              </div>
            </div>
            <div className="text-right text-[13px] font-bold text-white/75 pb-1" data-testid="rich-list-next">
              {list.nextAbove ? (
                <>
                  Sıradaki: {list.nextAbove.name}
                  <div className="text-[var(--g-gold)] text-base tabular-nums">+{short(gap)} kaldı</div>
                </>
              ) : (
                <span className="text-[var(--g-gold)] text-base">Şehrin en zengini sensin!</span>
              )}
            </div>
          </div>
        </div>
        <ol className="p-3 overflow-y-auto space-y-1.5 flex-1">
          {list.entries.map((e, i) => (
            <li
              key={e.id}
              ref={e.isPlayer ? playerRowRef : undefined}
              data-testid={e.isPlayer ? 'rich-list-row-player' : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-2xl ${
                e.isPlayer
                  ? 'bg-[var(--g-navy-800)] text-white'
                  : 'bg-[var(--g-surface-2)] text-[var(--g-ink)]'
              }`}
            >
              <span
                className={`w-8 text-center g-display font-extrabold tabular-nums ${
                  i < 3 ? 'text-[var(--g-gold-dark)]' : e.isPlayer ? 'text-[var(--g-gold)]' : 'text-[var(--g-muted)]'
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold truncate">{e.name}</div>
                <div className={`text-[13px] truncate ${e.isPlayer ? 'text-white/70' : 'text-[var(--g-muted)]'}`}>{e.title}</div>
              </div>
              <span className={`tabular-nums font-extrabold ${e.isPlayer ? 'text-[var(--g-gold)]' : ''}`}>{short(e.netWorth)}</span>
            </li>
          ))}
        </ol>
        {onOpenPrestige && (
          <div className="px-3 pt-2 shrink-0 border-t border-[var(--g-line)]">
            <button
              type="button"
              data-testid="rich-list-prestige-btn"
              onClick={onOpenPrestige}
              className="g-btn g-btn-navy w-full"
            >
              <Star className="w-4 h-4 text-[var(--g-gold)]" />
              Yeni şehirde başla
              {(state.prestige?.stars ?? 0) > 0 && (
                <span className="tabular-nums text-[var(--g-gold)]">· {state.prestige!.stars} yıldız</span>
              )}
            </button>
          </div>
        )}
        <p className="px-4 py-2 text-[13px] text-[var(--g-muted)] shrink-0 border-t border-[var(--g-line)]">Listedeki kişiler ve servetleri uydurmadır. Kurucuların serveti şirketlerinin hisse fiyatıyla değişir.</p>
      </div>
    </div>
  );
};
