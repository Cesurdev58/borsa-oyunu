/**
 * Harita ekranı: harita + üstte iki düğme + alt panel. Oyun durumundan işaretleri türetir.
 * Kamera ve seçili şehir `state.turkeyMapView` / `state.selectedMapCityId` içinde saklanır (kayıtla birlikte).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Crosshair, Store } from 'lucide-react';
import type { CityId, TurkeyMapViewState } from '../../../models/cities';
import type { SimulationState } from '../../../models/simulation';
import type { ShopType } from '../../../models/trade';
import { CITY_DEFINITIONS, getAllCityDefinitions, isCityId } from '../../../data/cityDefinitions';
import { getCityPresence } from '../../../engine/CityMigration';
import { cityHasIssue } from '../../../engine/CityOpeningQuote';
import { TurkeyMap } from './TurkeyMap';
import { CityInfoSheet } from './CityInfoSheet';
import { DEFAULT_MAP_VIEW, clampMapView, fitViewToPoints, type MapMarkerModel } from './mapView';

export function buildMapMarkers(state: SimulationState): MapMarkerModel[] {
  return getAllCityDefinitions().map((c) => {
    const p = getCityPresence(state, c.id);
    return {
      cityId: c.id,
      nameTR: c.nameTR,
      x: c.mapPosition.x,
      y: c.mapPosition.y,
      markerState: p.markerState,
      hasIssue: p.shopCount > 0 && cityHasIssue(state, c.id),
      shopCount: p.shopCount,
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
  /** 3D şehre dönüş (verilmezse düğme çıkmaz). */
  onExit?: () => void;
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
  onExit,
  fixedSize,
}) => {
  const markers = useMemo(() => buildMapMarkers(state), [state, state.tradeState?.shops, state.headquartersCityId]);
  const aspect = fixedSize ? fixedSize.height / fixedSize.width : 560 / 390;
  const view = clampMapView(state.turkeyMapView, aspect);
  const [revision, setRevision] = useState(0);
  const selectedId = isCityId(state.selectedMapCityId) ? state.selectedMapCityId : undefined;
  const selectedCity = selectedId ? CITY_DEFINITIONS[selectedId] : undefined;
  const owned = markers.filter((m) => m.shopCount > 0);

  const recenter = useCallback(() => {
    onSetMapView(DEFAULT_MAP_VIEW);
    setRevision((r) => r + 1);
  }, [onSetMapView]);

  const goMine = useCallback(() => {
    onSetMapView(fitViewToPoints(owned.map((m) => ({ x: m.x, y: m.y })), aspect));
    setRevision((r) => r + 1);
  }, [onSetMapView, owned, aspect]);

  return (
    <div className="relative h-[calc(100dvh-236px)] min-h-[360px] w-full overflow-hidden" data-testid="turkey-map-screen">
      <TurkeyMap
        markers={markers}
        view={view}
        selectedCityId={selectedId}
        onViewCommit={onSetMapView}
        onSelectCity={onSelectMapCity}
        fixedSize={fixedSize}
        viewRevision={revision}
      />
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
        <button
          type="button"
          data-testid="turkey-map-recenter-btn"
          onClick={recenter}
          className="g-btn g-btn-navy pointer-events-auto min-h-[44px] min-w-[44px] px-3 text-[14px]"
        >
          <Crosshair size={18} /> Haritayı Ortala
        </button>
        {onExit && (
          <button type="button" data-testid="turkey-map-exit-btn" onClick={onExit} className="g-btn g-btn-secondary pointer-events-auto min-h-[44px] min-w-[44px] px-3 text-[14px]">
            3D Şehre Dön
          </button>
        )}
        {owned.length > 0 && (
          <button
            type="button"
            data-testid="turkey-map-mine-btn"
            onClick={goMine}
            className="g-btn g-btn-gold pointer-events-auto min-h-[44px] min-w-[44px] px-3 text-[14px]"
          >
            <Store size={18} /> Mağazalarıma Git
          </button>
        )}
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
