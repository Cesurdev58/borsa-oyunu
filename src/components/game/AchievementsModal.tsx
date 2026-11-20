/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Başarımlar, haftalık hedefler ve prestij puanı avantajları (motor: engine/Achievements.ts, PrestigeEngine.ts).
 */
import React, { useState } from 'react';
import { Award, Check, Lock, X } from 'lucide-react';
import { ACHIEVEMENTS, getAchievements, rewardText } from '../../engine/Achievements';
import { getPrestige, perkLevel, pointsAvailable } from '../../engine/PrestigeEngine';
import { PRESTIGE_PERKS } from '../../data/prestigePerks';
import type { SimulationState } from '../../models/simulation';

type Tab = 'weekly' | 'achievements' | 'perks';

export const AchievementsModal: React.FC<{
  open: boolean;
  state: SimulationState;
  onBuyPerk?: (perkId: string) => void;
  onClose: () => void;
}> = ({ open, state, onBuyPerk, onClose }) => {
  const [tab, setTab] = useState<Tab>('weekly');
  if (!open) return null;
  const a = getAchievements(state);
  const unlockedCount = Object.keys(a.unlocked).length;
  const prestige = getPrestige(state);
  const points = pointsAvailable(prestige);
  const tabs: [Tab, string][] = [['weekly', 'Haftalık'], ['achievements', 'Başarımlar'], ['perks', 'Prestij']];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Başarımlar ve hedefler"
      data-testid="achievements-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.55)] p-3 sm:p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="g-rise w-full max-w-md max-h-[85vh] bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden text-sm">
        <div className="g-hero rounded-none px-4 py-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-6 h-6 text-[var(--g-gold)]" />
              <h2 className="g-display text-lg font-extrabold text-white">Başarımlar</h2>
            </div>
            <button type="button" aria-label="Kapat" data-testid="achievements-close-btn" onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-testid={`achievements-tab-${id}`}
                onClick={() => setTab(id)}
                className={`g-btn ${tab === id ? 'g-btn-gold' : 'g-btn-navy'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 overflow-y-auto space-y-2">
          <div className="g-tip" data-testid="achievements-rewards-note">
            Eğitim bileti: {state.trainingTickets ?? 0} · Dekorasyon: {state.decorations ?? 0} · Prestij puanı: {points}
          </div>
          {tab === 'weekly' && (
            <>
              {(a.weekly?.goals ?? []).length === 0 && <div className="text-[var(--g-muted)]">Hedefler ilk gün kapanışında gelir.</div>}
              {(a.weekly?.goals ?? []).map((g) => (
                <div key={g.id} data-testid={`weekly-goal-${g.id}`} className="g-card-soft p-3 space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="font-extrabold">{g.title}</span>
                    {g.done && <Check className="w-5 h-5 text-[var(--g-green)] shrink-0" />}
                  </div>
                  <div className="g-track"><div className="g-fill" style={{ width: `${Math.min(100, (g.progress / g.target) * 100)}%` }} /></div>
                  <div className="text-[13px] text-[var(--g-muted)]">Ödül: {rewardText(g.reward)}</div>
                </div>
              ))}
            </>
          )}
          {tab === 'achievements' && (
            <>
              <div className="font-extrabold" data-testid="achievements-count">{unlockedCount} / {ACHIEVEMENTS.length} başarım</div>
              {ACHIEVEMENTS.map((d) => {
                const done = a.unlocked[d.id] !== undefined;
                return (
                  <div key={d.id} data-testid={`achievement-${d.id}`} data-done={done} className={`g-card-soft p-3 flex items-start gap-2 ${done ? '' : 'opacity-70'}`}>
                    {done ? <Check className="w-5 h-5 text-[var(--g-green)] shrink-0" /> : <Lock className="w-5 h-5 text-[var(--g-muted)] shrink-0" />}
                    <div>
                      <div className="font-extrabold">{d.title}</div>
                      <div className="text-[13px] text-[var(--g-muted)]">{d.desc} · Ödül: {rewardText(d.reward)}</div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {tab === 'perks' && (
            <>
              <div className="font-extrabold" data-testid="perk-points">Harcanabilir prestij puanı: {points}</div>
              {PRESTIGE_PERKS.map((p) => {
                const lv = perkLevel(prestige, p.id);
                const maxed = lv >= p.maxLevel;
                return (
                  <div key={p.id} data-testid={`perk-${p.id}`} className="g-card-soft p-3 space-y-1.5">
                    <div className="font-extrabold">{p.name} · seviye {lv}/{p.maxLevel}</div>
                    <div className="text-[13px] text-[var(--g-muted)]">{p.desc}</div>
                    <button
                      type="button"
                      data-testid={`perk-buy-${p.id}`}
                      disabled={maxed || points < p.cost}
                      onClick={() => onBuyPerk?.(p.id)}
                      className="g-btn g-btn-primary w-full disabled:opacity-50"
                    >
                      {maxed ? 'En üst seviye' : `${p.cost} puana al`}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
