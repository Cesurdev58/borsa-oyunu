/**
 * "Ek geliştirmeler": eski şehir binalarının işleri (İkinci El Pazarı, Belediye, Trafo, Akademi, Sağlık, Lojistik)
 * artık Dükkân sekmesindeki bu bölümden açılır. İlk kişisel dükkânla kullanılabilir.
 */
import React, { useState } from 'react';
import { GraduationCap, HeartPulse, Landmark, Recycle, Sparkles, Sun, Truck } from 'lucide-react';
import type { CityServiceId } from '../../../data/cityServices';
import { cityServicesOpen } from '../../../engine/CityServices';
import type { SimulationState } from '../../../models/simulation';

export const EXTRA_UPGRADE_ITEMS: ReadonlyArray<{
  id: CityServiceId;
  title: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'IKINCI_EL', title: 'İkinci El Pazarı', hint: 'Fazla malı sat, ucuz eşya al', Icon: Recycle },
  { id: 'BELEDIYE', title: 'Belediye', hint: 'Mahalle projeleri: daha çok müşteri', Icon: Landmark },
  { id: 'ENERJI', title: 'Güneş paneli', hint: 'Günlük gider azalır', Icon: Sun },
  { id: 'AKADEMI', title: 'Akademi', hint: 'Çalışanını eğit', Icon: GraduationCap },
  { id: 'SAGLIK', title: 'Sağlık sigortası', hint: 'Çalışanını sigortala', Icon: HeartPulse },
  { id: 'LOJISTIK', title: 'Lojistik', hint: 'Kargo anlaşması: ucuz nakliye', Icon: Truck },
];

interface ExtraUpgradesProps {
  state: SimulationState;
  onOpenService?: (id: CityServiceId) => void;
}

export const ExtraUpgrades: React.FC<ExtraUpgradesProps> = ({ state, onOpenService }) => {
  const [open, setOpen] = useState(false);
  const unlocked = cityServicesOpen(state);
  return (
    <div className="space-y-2" data-testid="extra-upgrades">
      <button
        type="button"
        data-testid="extra-upgrades-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="g-btn g-btn-secondary w-full"
      >
        <Sparkles className="w-5 h-5" /> Ek geliştirmeler
      </button>
      {open && (
        <div className="g-card p-2 grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="extra-upgrades-list">
          {!unlocked && (
            <div className="sm:col-span-2 g-tip" data-testid="extra-upgrades-locked">
              İlk dükkânını açınca kullanılır.
            </div>
          )}
          {EXTRA_UPGRADE_ITEMS.map(({ id, title, hint, Icon }) => (
            <button
              key={id}
              type="button"
              data-testid={`extra-upgrade-${id}`}
              disabled={!unlocked}
              onClick={() => onOpenService?.(id)}
              className="g-choice flex items-center gap-3 min-h-[56px] px-3 text-left disabled:opacity-50"
            >
              <Icon className="w-6 h-6 shrink-0 text-[var(--g-navy-600)]" />
              <span className="min-w-0">
                <span className="block font-extrabold">{title}</span>
                <span className="block text-[13px] font-semibold text-[var(--g-muted)]">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
