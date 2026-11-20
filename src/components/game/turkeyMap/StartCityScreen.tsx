/**
 * Yeni kariyer: başlangıç şehrini haritadan seç (Faz 5).
 * Şehre kilit yok; Ankara önerilir ama kendiliğinden seçilmez. Seçimden önce risk/maliyet özeti ve onay gelir.
 */
import React, { useMemo, useState } from 'react';
import type { CityId, TurkeyMapViewState } from '../../../models/cities';
import type { SimulationState } from '../../../models/simulation';
import { CITY_DEFINITIONS } from '../../../data/cityDefinitions';
import { getStartCitySummary } from '../../../engine/CityStartSelection';
import { TurkeyMap } from './TurkeyMap';
import { CityInfoSheet } from './CityInfoSheet';
import { buildMapMarkers } from './TurkeyMapScreen';
import { DEFAULT_MAP_VIEW } from './mapView';

const DIFFICULTY_TR = { EASY: 'Kolay', MEDIUM: 'Orta', HARD: 'Zor' } as const;

export interface StartCityScreenProps {
  state: SimulationState;
  formatCurrency: (v: number) => string;
  reservedCash?: number;
  onConfirm: (cityId: CityId) => void;
  fixedSize?: { width: number; height: number };
  /** Test için: açılışta seçili şehir ve onay adımı. */
  initialCityId?: CityId;
  initialConfirm?: boolean;
}

export const StartCityScreen: React.FC<StartCityScreenProps> = ({
  state, formatCurrency, reservedCash = 0, onConfirm, fixedSize, initialCityId, initialConfirm = false,
}) => {
  const [selected, setSelected] = useState<CityId | undefined>(initialCityId);
  const [confirming, setConfirming] = useState<boolean>(initialConfirm);
  const [done, setDone] = useState(false);
  const [view, setView] = useState<TurkeyMapViewState>(DEFAULT_MAP_VIEW);
  const markers = useMemo(() => buildMapMarkers(state), [state]);
  const city = selected ? CITY_DEFINITIONS[selected] : undefined;
  const summary = selected ? getStartCitySummary(state, selected, reservedCash) : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b1f36]" data-testid="start-city-screen" role="dialog" aria-label="Başlangıç şehrini seç">
      <div className="g-hero rounded-none px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        <div className="g-display text-2xl font-extrabold text-white" data-testid="start-city-title">Nereden başlayacaksın?</div>
        <div className="text-[14px] text-white/70">Haritada istediğin şehre dokun. Hiçbir şehir kilitli değil; Ankara dengeli bir başlangıç olarak önerilir.</div>
      </div>
      <div className="relative min-h-0 flex-1">
        <TurkeyMap
          markers={markers}
          view={view}
          selectedCityId={selected}
          onViewCommit={setView}
          onSelectCity={(id) => { setSelected(id); setConfirming(false); }}
          fixedSize={fixedSize}
        />
        {city && !confirming && (
          <CityInfoSheet
            key={city.id}
            city={city}
            state={state}
            formatCurrency={formatCurrency}
            reservedCash={reservedCash}
            onClose={() => setSelected(undefined)}
            onGoToCity={() => {}}
            onOpenShop={() => {}}
            onStartHere={() => setConfirming(true)}
          />
        )}
        {city && summary && confirming && (
          <div className="absolute inset-x-0 bottom-0 z-40 max-h-[85%] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] g-rise" data-testid="start-city-confirm" role="alertdialog" aria-label={`${city.nameTR} başlangıç onayı`}>
            <div className="g-display text-2xl font-extrabold" data-testid="start-city-confirm-name">{city.nameTR} şehrinde başla</div>
            <div className="text-[14px] text-slate-500">Zorluk: <b data-testid="start-city-confirm-difficulty">{DIFFICULTY_TR[summary.difficulty]}</b> · Önerilen ilk dükkân: <b>{summary.recommendedShopNameTR}</b></div>
            {summary.warningTR && (
              <div className="mt-2 rounded-xl bg-red-50 p-3 text-[14px] font-semibold text-red-800" data-testid="start-city-hard-warning">{summary.warningTR}</div>
            )}
            <div className="mt-3 space-y-1 text-[15px]" data-testid="start-city-costs">
              <div className="flex justify-between"><span>İlk dükkân kurulumu</span><b data-testid="start-city-setup">{formatCurrency(summary.quote.setupCost)}</b></div>
              <div className="flex justify-between"><span>Kira depozitosu ({city.nameTR} kirası)</span><span data-testid="start-city-deposit">{formatCurrency(summary.quote.expansion.cityRentDeposit)}</span></div>
              <div className="flex justify-between"><span>Dükkân kasasına konan para</span><b>{formatCurrency(summary.quote.workingCash)}</b></div>
              <div className="flex justify-between"><span>İlk 7 günün sabit gideri</span><b data-testid="start-city-seven-day">{formatCurrency(summary.sevenDayRunningCost)}</b></div>
              <div className="flex justify-between border-t border-slate-200 pt-1"><span className="font-bold">Açılıştan sonra elinde kalan</span><b data-testid="start-city-cash-after">{formatCurrency(summary.cashAfterOpening)}</b></div>
            </div>
            <p className="mt-2 text-[13px] text-slate-500">Kira ve çalışan maaşı şehre göre değişir; tutarlar gerçek açılış bedelidir. Şehri seçince merkezin burası olur; sonra başka şehirlerde de dükkân açabilirsin.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="g-btn g-btn-secondary min-h-[52px]" data-testid="start-city-cancel-btn" onClick={() => setConfirming(false)}>Vazgeç</button>
              <button
                type="button"
                className="g-btn g-btn-primary min-h-[52px]"
                data-testid="start-city-confirm-btn"
                onClick={() => { if (done) return; setDone(true); onConfirm(city.id); }}
              >
                Başla
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
