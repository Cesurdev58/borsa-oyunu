/**
 * Harita akışı: Türkiye Haritası ↔ Şehir Mağazaları, geri tuşu ve çıkış onayı (Faz 6).
 * Kamera (pan/zoom) ve seçili şehir oyun durumunda tutulduğu için "Haritaya Dön" kaldığın yere döndürür.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CityId, TurkeyMapViewState } from '../../../models/cities';
import type { SimulationState } from '../../../models/simulation';
import type { ShopType } from '../../../models/trade';
import { TurkeyMapScreen } from './TurkeyMapScreen';
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
  /** Mağaza detay paneli (yönetim) açık mı? Açıkken geri tuşunu o panel karşılar. */
  detailOpen?: boolean;
  /** Çıkış onayında "Çık" seçilirse (3D şehre döner). */
  onExit: () => void;
  fixedSize?: { width: number; height: number };
}

export const TurkeyMapFlow: React.FC<TurkeyMapFlowProps> = (props) => {
  const { state, detailOpen = false, onSelectMapCity, onExit } = props;
  const [nav, setNav] = useState<MapNavState>(MAP_ROOT);
  const [exitConfirm, setExitConfirm] = useState(false);
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
    const out = resolveBack({ nav: navRef.current, detailOpen: detailRef.current, sheetOpen: sheetRef.current });
    if (out.kind === 'TO_MAP') { setNav(out.nav); return 'handled'; }
    if (out.kind === 'CLOSE_SHEET') { onSelectMapCity(undefined); return 'handled'; }
    if (out.kind === 'EXIT_CONFIRM') { setExitConfirm(true); return 'exit-confirm'; }
    return 'handled'; // CLOSE_DETAIL: panelin kendi geri tuşu kapatır
  }, [onSelectMapCity]);

  // Tarayıcı geçmişi / Android geri tuşu (kural `mapBackController` + `resolveBack`).
  const allowExitRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    return attachMapBackHandler(window, runBack, () => allowExitRef.current);
  }, [runBack]);

  const confirmExit = () => {
    allowExitRef.current = true;
    setExitConfirm(false);
    onExit();
  };

  return (
    <div className="relative" data-testid="turkey-map-flow" data-screen={nav.screen}>
      {nav.screen === 'CITY_SHOPS' && nav.cityId ? (
        <CityShopsScreen
          cityId={nav.cityId}
          state={state}
          formatCurrency={props.formatCurrency}
          onBackToMap={runBack}
          onManageShop={props.onManageShop}
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
          onExit={onExit}
          fixedSize={props.fixedSize}
        />
      )}
      {exitConfirm && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-6" role="alertdialog" aria-label="Çıkış onayı" data-testid="map-exit-confirm">
          <div className="g-card w-full max-w-sm space-y-3 p-4 text-center">
            <div className="g-display text-xl font-extrabold">Haritadan çıkmak istiyor musun?</div>
            <p className="text-[14px] text-slate-500">3D şehir görünümüne dönersin. İlerlemen kayıtlı.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="g-btn g-btn-secondary min-h-[48px]" data-testid="map-exit-stay-btn" onClick={() => setExitConfirm(false)}>Kal</button>
              <button type="button" className="g-btn g-btn-primary min-h-[48px]" data-testid="map-exit-confirm-btn" onClick={confirmExit}>Çık</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
