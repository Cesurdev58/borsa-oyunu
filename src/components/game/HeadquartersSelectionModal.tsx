/**
 * Eski kayıtlar için bir defalık "Merkez Şehrini Seç" penceresi (Türkiye haritası geçişi, Faz 2).
 * Oyuncu seçene kadar oyun durur; pencere kapatılamaz ama veri kaybolmaz (bir sonraki açılışta yine sorulur).
 * Faz 3'te harita ekranı gelince seçim haritadan da yapılabilecek; bu pencere eski kayıtlar için kalır.
 */
import React, { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  getAllCityDefinitions,
  getDetailedCityDefinitions,
  isCityId,
} from '../../data/cityDefinitions';
import { CITY_FALLBACK_ID } from '../../data/cityBalance';
import type { CityDifficulty, CityId } from '../../models/cities';

const DIFFICULTY_LABEL_TR: Record<CityDifficulty, string> = {
  EASY: 'Kolay',
  MEDIUM: 'Orta',
  HARD: 'Zor',
};

interface HeadquartersSelectionModalProps {
  /** Seçilen şehre taşınacak dükkân sayısı */
  shopCount: number;
  onConfirm: (cityId: CityId) => void;
}

export const HeadquartersSelectionModal: React.FC<HeadquartersSelectionModalProps> = ({
  shopCount,
  onConfirm,
}) => {
  const [selected, setSelected] = useState<CityId | null>(null);
  const detailed = useMemo(() => getDetailedCityDefinitions(), []);
  const others = useMemo(
    () =>
      getAllCityDefinitions()
        .filter((c) => c.profileKind === 'DEFAULT')
        .sort((a, b) => a.nameTR.localeCompare(b.nameTR, 'tr')),
    []
  );
  const selectedIsOther = selected !== null && others.some((c) => c.id === selected);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Merkez şehrini seç"
      data-testid="hq-selection-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(18,28,68,.72)] p-4"
    >
      <div className="w-full max-w-md max-h-[92vh] overflow-hidden flex flex-col rounded-[26px] bg-[var(--g-surface)] shadow-2xl">
        <div className="g-hero rounded-none px-5 pt-5 pb-4 text-center">
          <div
            className="mx-auto w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(180deg,#ffe08a,var(--g-gold))', boxShadow: '0 4px 0 var(--g-gold-dark)' }}
          >
            <MapPin className="w-6 h-6 text-[#6b4500]" strokeWidth={2.4} />
          </div>
          <h2 className="g-display mt-2 text-2xl font-extrabold text-white">Merkez şehrini seç</h2>
          <p className="text-[13px] font-semibold text-white/70 mt-1">
            {shopCount > 0
              ? `Mevcut ${shopCount} dükkânın bu şehre taşınacak. Paran, stoğun ve ilerlemen aynı kalır.`
              : 'Şirket merkezin bu şehirde olacak. Paran ve ilerlemen aynı kalır.'}
          </p>
        </div>

        <div className="p-4 overflow-y-auto space-y-2" role="radiogroup" aria-label="Şehirler">
          {detailed.map((city) => {
            const active = selected === city.id;
            return (
              <button
                key={city.id}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`hq-city-option-${city.id}`}
                data-active={active ? 'true' : 'false'}
                onClick={() => setSelected(city.id)}
                className="g-choice w-full text-left px-3 py-2.5 min-h-[56px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[var(--g-ink)]">
                    {city.nameTR}
                    {city.id === CITY_FALLBACK_ID && (
                      <span className="ml-2 g-pill text-[13px]">Önerilen</span>
                    )}
                  </span>
                  <span className="text-[13px] font-bold text-[var(--g-muted)]">
                    {DIFFICULTY_LABEL_TR[city.difficulty]}
                  </span>
                </div>
                <div className="text-[13px] font-semibold text-[var(--g-muted)] mt-0.5">{city.playStyleTR}</div>
              </button>
            );
          })}

          <label className="block pt-2">
            <span className="text-[13px] font-bold text-[var(--g-muted)]">Diğer iller</span>
            <select
              data-testid="hq-city-other-select"
              className="g-input w-full mt-1"
              value={selectedIsOther ? selected! : ''}
              onChange={(e) => {
                const v = e.target.value;
                if (isCityId(v)) setSelected(v);
              }}
            >
              <option value="">İl seç…</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameTR}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="p-4 border-t border-[var(--g-line)]">
          <button
            type="button"
            data-testid="hq-confirm-btn"
            disabled={selected === null}
            onClick={() => selected && onConfirm(selected)}
            className="g-btn g-btn-primary w-full min-h-[52px] text-base font-extrabold disabled:opacity-50"
          >
            Bu şehri merkez yap
          </button>
        </div>
      </div>
    </div>
  );
};
