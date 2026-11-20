/**
 * İlk dükkân kapısı kartı: "borsayı tanı" görevleri bitince ilk dükkân açılır
 * (engine/FirstShopGate.ts). Dükkân ekranında ve dükkân yönetiminde aynı kart görünür.
 */
import { Check } from 'lucide-react';
import React from 'react';
import { firstShopGateStatus } from '../../../engine/FirstShopGate';
import type { SimulationState } from '../../../models/simulation';

export const FirstShopGateCard: React.FC<{
  state: SimulationState;
  onOpenShopPicker?: () => void;
}> = ({ state, onOpenShopPicker }) => {
  const gate = firstShopGateStatus(state);
  return (
    <div data-testid="first-shop-progress" className="g-hero p-5 space-y-3">
      <div className="g-display flex items-center gap-3 font-extrabold text-xl leading-tight">
        <span className="w-12 h-12 shrink-0 rounded-2xl bg-white/10 flex items-center justify-center text-[28px]">🏪</span>
        {gate.open ? 'Hazırsın! İlk dükkânını aç' : `İlk dükkânın için ${gate.steps.length} adım`}
      </div>
      <div className="g-track h-4">
        <div className="g-fill" style={{ width: `${gate.pct}%` }} />
      </div>
      <ul className="space-y-2" data-testid="first-shop-gate-steps">
        {gate.steps.map((s) => (
          <li
            key={s.id}
            data-testid={`first-shop-gate-step-${s.id}`}
            data-done={s.done ? 'true' : 'false'}
            className="flex items-center gap-3 text-sm font-bold"
          >
            <span
              className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${
                s.done ? 'bg-[var(--g-green)] text-white' : 'bg-white/10 text-white/50'
              }`}
            >
              {s.done ? <Check size={16} strokeWidth={3} /> : null}
            </span>
            <span className={s.done ? 'text-white/60 line-through' : 'text-white'}>{s.label}</span>
          </li>
        ))}
      </ul>
      {gate.open ? (
        onOpenShopPicker ? (
          <button type="button" onClick={onOpenShopPicker} className="g-btn g-btn-gold w-full">
            Dükkân türünü seç
          </button>
        ) : null
      ) : (
        <p className="text-sm font-semibold text-white/70">
          Borsa ekranından hisse al ve sat, sonra piyasayı bir gün izle. Adımlar bitince dükkân kurabilirsin!
        </p>
      )}
    </div>
  );
};
