/**
 * Harita akışı: Türkiye Haritası ↔ Şehir Mağazaları, geri tuşu ve çıkış onayı (Faz 6).
 * Kamera (pan/zoom) ve seçili şehir oyun durumunda tutulduğu için "Haritaya Dön" kaldığın yere döndürür.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CityId, TurkeyMapViewState } from '../../../models/cities';
import type { SimulationState } from '../../../models/simulation';
import type { ShopType } from '../../../models/trade';
import { TurkeyMapScreen } from './TurkeyMapScreen';
import { DEFAULT_MAP_FILTER, type MapFilterId } from './mapFilters';
import { CityShopsScreen, type ShopManageTab } from './CityShopsScreen';
import { attachMapBackHandler } from './mapBackController';
import { MAP_ROOT, goToCity, resolveBack, type MapNavState } from './mapNavigation';

export interface TurkeyMapFlowProps {
  state: SimulationState;
  formatCurrency: (v: number) => string;
  reservedCash?: number;
  onSetMapView: (view: TurkeyMapViewState) => void;
  onSelectMapCity: (cityId: CityId | undefined) => void;
  onOpenShopInCity: (cityId: CityId, shopType: ShopType) => void;
  onManageShop: (shopId: string, tab?: ShopManageTab) => void;
  /** Şehir deposu kur (Şehir Mağazaları ekranındaki depo kartı). */
  onBuildCityDepot?: (cityId: CityId) => void;
  /** Mağaza detay paneli (yönetim) açık mı? Açıkken geri tuşunu o panel karşılar. */
  detailOpen?: boolean;
  fixedSize?: { width: number; height: number };
}

export const TurkeyMapFlow: React.FC<TurkeyMapFlowProps> = (props) => {
  const { state, detailOpen = false, onSelectMapCity } = props;
  const [nav, setNav] = useState<MapNavState>(MAP_ROOT);
  // Filtre burada tutulur: Şehir Mağazaları'na gidip dönünce seçili filtre korunur.
  const [filter, setFilter] = useState<MapFilterId>(DEFAULT_MAP_FILTER);
  const sheetOpen = Boolean(state.selectedMapCityId);

  // Şehir mağazaları açıkken o şehirde dükkân kalmadıysa (bozuk durum) ekran boş durumu gösterir; gezinme bozulmaz.
  const navRef = useRef(nav);
  navRef.current = nav;
  const sheetRef = useRef(sheetOpen);
  sheetRef.current = sheetOpen;
  const detailRef = useRef(detailOpen);
  detailRef.current = detailOpen;

  /** Hem "Haritaya Dön" düğmesi hem geri tuşu aynı kuralı çalıştırır. */
  const runBack = useCallback((): 'handled' | 'exit-confirm' => {
    // Harita ana ekranındayken geri tuşu bir şey yapmaz (sayfadan çıkmaz).
    const out = resolveBack({ nav: navRef.current, detailOpen: detailRef.current, sheetOpen: sheetRef.current });
    if (out.kind === 'TO_MAP') { setNav(out.nav); return 'handled'; }
    if (out.kind === 'CLOSE_SHEET') { onSelectMapCity(undefined); return 'handled'; }
    if (out.kind === 'EXIT_CONFIRM') return 'exit-confirm';
    return 'handled'; // CLOSE_DETAIL: panelin kendi geri tuşu kapatır
  }, [onSelectMapCity]);

  // Tarayıcı geçmişi / Android geri tuşu (kural `mapBackController` + `resolveBack`).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    return attachMapBackHandler(window, runBack);
  }, [runBack]);

  return (
    <div className="relative" data-testid="turkey-map-flow" data-screen={nav.screen}>
      {nav.screen === 'CITY_SHOPS' && nav.cityId ? (
        <CityShopsScreen
          cityId={nav.cityId}
          state={state}
          formatCurrency={props.formatCurrency}
          onBackToMap={runBack}
          onManageShop={props.onManageShop}
          reservedCash={props.reservedCash}
          onBuildDepot={props.onBuildCityDepot}
        />
      ) : (
        <TurkeyMapScreen
          state={state}
          formatCurrency={props.formatCurrency}
          reservedCash={props.reservedCash}
          onSetMapView={props.onSetMapView}
          onSelectMapCity={onSelectMapCity}
          onOpenShopInCity={props.onOpenShopInCity}
          onGoToCity={(id) => setNav((n) => goToCity(n, state, id))}
          filter={filter}
          onFilterChange={setFilter}
          fixedSize={props.fixedSize}
        />
      )}
    </div>
  );
};
