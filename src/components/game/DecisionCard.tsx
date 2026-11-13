/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Karar kartı: arada bir çıkan iki seçenekli olay. "Sonra" denirse küçük bir altın
 * kapsüle dönüşür ve dokununca yeniden açılır.
 */
import React, { useEffect, useState } from 'react';
import { Clock3, Sparkles } from 'lucide-react';
import type { SimulationState } from '../../models/simulation';
import { canAffordChoice } from '../../engine/DecisionEventEngine';
import { play } from './ui/feedback';

interface DecisionCardProps {
  state: SimulationState;
  reservedCash: number;
  onResolve?: (choiceId: 'A' | 'B') => void;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({ state, reservedCash, onResolve }) => {
  const pending = state.decisionEvents?.pending ?? null;
  const [minimizedId, setMinimizedId] = useState<string | null>(null);

  useEffect(() => {
    if (pending && pending.eventId !== minimizedId) play('success');
    // yalnızca yeni kart geldiğinde
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.eventId]);

  if (!pending || !onResolve) return null;
  const daysLeft = Math.max(0, pending.expiresDay - state.day);

  if (minimizedId === pending.eventId) {
    return (
      <button
        type="button"
        data-testid="decision-reopen-btn"
        onClick={() => setMinimizedId(null)}
        className="g-btn g-btn-gold g-btn-sm fixed right-3 bottom-[92px] z-40 shadow-lg"
      >
        <span className="text-lg leading-none">{pending.emoji}</span>
        Karar bekliyor
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={pending.titleTR}
      data-testid="decision-card"
      className="fixed inset-0 z-[52] flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.55)] p-3"
    >
      <div className="celebration-in w-full max-w-sm rounded-[26px] bg-white shadow-2xl overflow-hidden">
        <div className="g-hero rounded-none px-5 pt-5 pb-5 text-center">
          <div className="flex items-center justify-between text-[13px] font-extrabold text-white/60">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-[var(--g-gold)]" /> Karar zamanı
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="w-4 h-4" />
              {daysLeft > 0 ? `${daysLeft} gün süren var` : 'Bugün son gün'}
            </span>
          </div>
          <div className="mx-auto mt-3 w-16 h-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-[34px]">
            {pending.emoji}
          </div>
          <h2 className="g-display mt-3 text-2xl font-extrabold text-white leading-tight">{pending.titleTR}</h2>
          <p className="mt-1 text-sm font-semibold text-white/70 leading-snug">{pending.bodyTR}</p>
        </div>

        <div className="p-4 space-y-3">
          {pending.choices.map((ch, i) => {
            const ok = canAffordChoice(state, ch, reservedCash);
            return (
              <button
                key={ch.id}
                type="button"
                data-testid={`decision-choice-${ch.id}`}
                disabled={!ok}
                onClick={() => onResolve(ch.id)}
                className={`g-btn w-full flex-col !gap-0.5 min-h-[64px] py-2 ${i === 0 ? 'g-btn-primary' : 'g-btn-secondary'}`}
              >
                <span className="text-base">{ch.labelTR}</span>
                <span className={`text-[13px] font-bold ${i === 0 ? 'text-white/85' : 'text-[var(--g-muted)]'}`}>
                  {ok ? ch.hintTR : 'Paran yetmiyor'}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            data-testid="decision-later-btn"
            onClick={() => setMinimizedId(pending.eventId)}
            className="w-full min-h-[44px] text-[13px] font-extrabold text-[var(--g-muted)]"
          >
            Sonra karar ver
          </button>
        </div>
      </div>
    </div>
  );
};
