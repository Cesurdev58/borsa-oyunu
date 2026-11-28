/**
 * Harita ekranı: harita + filtre çubuğu + "Haritayı Ortala" + alt panel. Oyun durumundan işaretleri türetir.
 * Kamera ve seçili şehir `state.turkeyMapView` / `state.selectedMapCityId` içinde saklanır (kayıtla birlikte).
 */
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { DEFAULT_MAP_FILTER, MAP_FILTERS, cityMatchesFilter, mapFilterCounts, type MapFilterId } from './mapFilters';
import type { CityId, TurkeyMapViewState } from '../../../models/cities';
import type { SimulationState } from '../../../models/simulation';
import type { ShopType } from '../../../models/trade';
import { CITY_DEFINITIONS, getAllCityDefinitions, isCityId } from '../../../data/cityDefinitions';
import { getCityPresence } from '../../../engine/CityMigration';
import { cityHasIssue } from '../../../engine/CityOpeningQuote';
import { TurkeyMap } from './TurkeyMap';
import { CityInfoSheet } from './CityInfoSheet';
import { DEFAULT_MAP_VIEW, clampMapView, type MapMarkerModel } from './mapView';

export function buildMapMarkers(state: SimulationState, filter: MapFilterId = DEFAULT_MAP_FILTER): MapMarkerModel[] {
  return getAllCityDefinitions().map((c) => {
    const p = getCityPresence(state, c.id);
    return {
      cityId: c.id,
      nameTR: c.nameTR,
      x: c.mapPosition.x,
      y: c.mapPosition.y,
      markerState: p.markerState,
      // Dükkân sorunları + şehir düzeyindeki sorunlar (merkezde geciken kredi, dolu depo)
      hasIssue: cityHasIssue(state, c.id),
      shopCount: p.shopCount,
      dimmed: !cityMatchesFilter(state, c.id, filter),
    };
  });
}

export interface TurkeyMapScreenProps {
  state: SimulationState;
  formatCurrency: (v: number) => string;
  reservedCash?: number;
  onSetMapView: (view: TurkeyMapViewState) => void;
  onSelectMapCity: (cityId: CityId | undefined) => void;
  onOpenShopInCity: (cityId: CityId, shopType: ShopType) => void;
  onGoToCity: (cityId: CityId) => void;
  /** Etkin filtre (verilmezse ekran kendi içinde tutar). Filtre kamerayı ve seçimi değiştirmez. */
  filter?: MapFilterId;
  onFilterChange?: (f: MapFilterId) => void;
  /** Test/sunucu için sabit harita ölçüsü. */
  fixedSize?: { width: number; height: number };
}

export const TurkeyMapScreen: React.FC<TurkeyMapScreenProps> = ({
  state,
  formatCurrency,
  reservedCash,
  onSetMapView,
  onSelectMapCity,
  onOpenShopInCity,
  onGoToCity,
  filter: filterProp,
  onFilterChange,
  fixedSize,
}) => {
  const [localFilter, setLocalFilter] = useState<MapFilterId>(DEFAULT_MAP_FILTER);
  const filter = filterProp ?? localFilter;
  const changeFilter = (f: MapFilterId) => {
    setLocalFilter(f);
    onFilterChange?.(f);
  };
  const markers = buildMapMarkers(state, filter);
  const counts = mapFilterCounts(state, markers.map((m) => m.cityId));
  const aspect = fixedSize ? fixedSize.height / fixedSize.width : 560 / 390;
  const view = clampMapView(state.turkeyMapView, aspect);
  const [revision, setRevision] = useState(0);
  // Harita, üstündeki şeritlerden alt menünün üstüne kadar kalan yüksekliği doldurur (alt menü kesilmesin).
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = rootRef.current;
      if (!el) return;
      const nav = document.querySelector('[data-testid="game-bottom-nav"]');
      const navHeight = nav instanceof HTMLElement ? nav.offsetHeight : 64;
      const top = el.getBoundingClientRect().top;
      const next = Math.floor(window.innerHeight - top - navHeight - 8);
      setAvailableHeight(next > 0 ? next : null);
    };
    measure();
    window.addEventListener('resize', measure);
    // Üst çubuk, hedef şeridi ve alt menü yüksekliği değişince (para kutusu açılır, şerit değişir) yeniden ölç.
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measure());
      const targets = [
        document.querySelector('header[aria-label="Oyun Üst Bilgi Çubuğu"]'),
        document.querySelector('[data-testid="city-quest-strip"]'),
        document.querySelector('[data-testid="game-bottom-nav"]'),
        document.body,
      ];
      targets.forEach((t) => {
        if (t) observer?.observe(t);
      });
    }
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);
  const selectedId = isCityId(state.selectedMapCityId) ? state.selectedMapCityId : undefined;
  const selectedCity = selectedId ? CITY_DEFINITIONS[selectedId] : undefined;

  const recenter = useCallback(() => {
    onSetMapView(DEFAULT_MAP_VIEW);
    setRevision((r) => r + 1);
  }, [onSetMapView]);

  return (
    <div
      ref={rootRef}
      className="relative h-[calc(100dvh-236px)] min-h-[320px] w-full overflow-hidden"
      style={availableHeight !== null ? { height: Math.max(320, availableHeight) } : undefined}
      data-testid="turkey-map-screen"
    >
      <TurkeyMap
        markers={markers}
        view={view}
        selectedCityId={selectedId}
        onViewCommit={onSetMapView}
        onSelectCity={onSelectMapCity}
        fixedSize={fixedSize}
        viewRevision={revision}
      />
      <div
        className="absolute inset-x-0 top-0 z-10 flex gap-2 overflow-x-auto px-3 py-2"
        data-testid="map-filter-bar"
        role="group"
        aria-label="Harita filtreleri"
      >
        {MAP_FILTERS.map((f) => {
          const active = f.id === filter;
          const isIssues = f.id === 'ISSUES';
          return (
            <button
              key={f.id}
              type="button"
              data-testid={`map-filter-${f.id}`}
              data-count={counts[f.id]}
              aria-pressed={active}
              onClick={() => changeFilter(f.id)}
              className={`g-pill min-h-[44px] shrink-0 whitespace-nowrap px-3 text-[14px] font-bold ${
                active ? 'bg-[var(--g-gold)] text-[#3b2a00]' : 'bg-white/90 text-[var(--g-navy-800,#0b1f36)]'
              }`}
            >
              {f.labelTR}
              {f.id !== 'ALL' && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 text-[13px] ${
                    isIssues && counts[f.id] > 0 ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {counts[f.id]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute left-3 top-[64px] flex flex-col gap-2">
        <button
          type="button"
          data-testid="turkey-map-recenter-btn"
          onClick={recenter}
          className="g-btn g-btn-navy pointer-events-auto min-h-[44px] min-w-[44px] px-3 text-[14px]"
        >
          <Crosshair size={18} /> Haritayı Ortala
        </button>
      </div>
      {selectedCity && (
        <CityInfoSheet
          key={selectedCity.id}
          city={selectedCity}
          state={state}
          formatCurrency={formatCurrency}
          reservedCash={reservedCash}
          onClose={() => onSelectMapCity(undefined)}
          onGoToCity={onGoToCity}
          onOpenShop={onOpenShopInCity}
        />
      )}
    </div>
  );
};
