/**
 * Dükkân ve Şirket sekmelerinin üstündeki şehir düğmesi: bulunduğun şehrin adını gösterir,
 * dokununca varlığın olan şehirleri listeler; seçilen şehrin dükkân ve şirketleri görünür.
 */
import React, { useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import type { CityId } from '../../../models/cities';
import type { SimulationState } from '../../../models/simulation';
import { getCityDefinition } from '../../../data/cityDefinitions';
import { listPlayerCities, resolveViewCity } from './cityViewLogic';

interface CitySwitcherProps {
  state: SimulationState;
  /** Seçili şehir (verilmezse merkez şehir). */
  value?: CityId | null;
  onChange?: (cityId: CityId) => void;
  /** Test kimliklerinin ön eki: dükkân sekmesi `shops`, şirket sekmesi `company`. */
  scope: 'shops' | 'company';
}

export const CitySwitcher: React.FC<CitySwitcherProps> = ({ state, value, onChange, scope }) => {
  const [open, setOpen] = useState(false);
  const current = resolveViewCity(state, value);
  const cities = listPlayerCities(state, current);
  const name = getCityDefinition(current).nameTR;

  return (
    <div className="space-y-2" data-testid={`city-switcher-${scope}`}>
      <button
        type="button"
        data-testid={`city-switcher-btn-${scope}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="g-btn g-btn-navy w-full justify-between"
      >
        <span className="inline-flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          <span data-testid={`city-switcher-name-${scope}`}>{name}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold opacity-80">
          Şehri değiştir
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="g-card p-2 space-y-1" data-testid={`city-switcher-list-${scope}`}>
          {cities.map((c) => (
            <button
              key={c.cityId}
              type="button"
              data-testid={`city-switcher-option-${scope}-${c.cityId}`}
              data-active={c.cityId === current ? 'true' : 'false'}
              onClick={() => {
                onChange?.(c.cityId);
                setOpen(false);
              }}
              className="g-choice w-full flex items-center justify-between min-h-[48px] px-3 text-left"
            >
              <span className="font-extrabold">
                {c.nameTR}
                {c.isHeadquarters ? ' · Merkez' : ''}
              </span>
              <span className="text-[13px] font-semibold text-[var(--g-muted)]">
                {c.shopCount} dükkân{c.branchCount > 0 ? ` · ${c.branchCount} şube` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
