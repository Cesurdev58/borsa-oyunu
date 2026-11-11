/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { SimulationStage } from '../../../models/simulation';
import { GraphicsQualityLevel } from '../../../state/uiSettingsStore';
import { deriveActiveVehicles, deriveCityTrafficFleet } from './cityLayout';
import { CityAtmosphereTheme, CityTrafficRouteId } from './cityVisualTypes';

interface IsometricVehicleLayerProps {
  stage: SimulationStage;
  isPaused: boolean;
  atmosphere: CityAtmosphereTheme;
  graphicsQuality?: GraphicsQualityLevel;
  hasPlayerCompany?: boolean;
  isProducing?: boolean;
  inventoryUnits?: number;
  inTransitShipmentsCount?: number;
  useExpandedCityTraffic?: boolean;
}

/**
 * Tanımlı bulvar rotalarında (Finans Meydanı, Sanayi/Şirket, Ticaret Bulvarı ve Kuzey-Güney Anayolu)
 * stilize 2.5D araçları (Normal otomobil, Taksi, Otobüs, Ticari kamyonet, Fabrika kamyonu, Hizmet aracı)
 * grafik kalitesi seviyesine göre hareket ettirir.
 */
export const IsometricVehicleLayer: React.FC<IsometricVehicleLayerProps> =
  React.memo(
    ({
      stage,
      isPaused,
      atmosphere,
      graphicsQuality = 'MEDIUM',
      hasPlayerCompany = false,
      isProducing = false,
      inventoryUnits = 0,
      inTransitShipmentsCount = 0,
      useExpandedCityTraffic = true,
    }) => {
      const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      });

      const [isPageVisible, setIsPageVisible] = useState<boolean>(() => {
        if (typeof document === 'undefined') return true;
        return !document.hidden;
      });

      useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
      }, []);

      useEffect(() => {
        if (typeof document === 'undefined') return;
        const onVisChange = () => setIsPageVisible(!document.hidden);
        document.addEventListener('visibilitychange', onVisChange);
        return () =>
          document.removeEventListener('visibilitychange', onVisChange);
      }, []);

      const fleetResult = useExpandedCityTraffic
        ? deriveCityTrafficFleet({
            stage,
            isPaused,
            reducedMotion,
            isPageVisible,
            graphicsQuality,
            hasPlayerCompany,
            isProducing,
            inventoryUnits,
            inTransitShipmentsCount,
          })
        : deriveActiveVehicles(
            stage,
            isPaused,
            reducedMotion,
            isPageVisible,
            graphicsQuality,
            hasPlayerCompany,
            isProducing
          );

      const { vehicles, animationsActive } = fleetResult;
      const headlightsOn = atmosphere.streetLightsOn;

      const getRouteAnimationName = (routeId: CityTrafficRouteId): string => {
        switch (routeId) {
          case 'SANAYI_SIRKET_ROTASI':
            return 'isoRouteIndustryLoop';
          case 'TICARET_BULVARI_ROTASI':
            return 'isoRouteCommerceLoop';
          case 'KUZEY_GUNEY_ANAYOL_ROTASI':
            return 'isoRouteNorthSouthLoop';
          case 'FINANS_MEYDANI_ROTASI':
          default:
            return 'isoRoutePlazaLoop';
        }
      };

      const getStaticCoordinates = (
        routeId: CityTrafficRouteId,
        idx: number
      ): { x: number; y: number } => {
        switch (routeId) {
          case 'SANAYI_SIRKET_ROTASI':
            return { x: 460 + (idx % 3) * 210, y: 895 };
          case 'TICARET_BULVARI_ROTASI':
            return { x: 215, y: 460 + (idx % 3) * 140 };
          case 'KUZEY_GUNEY_ANAYOL_ROTASI':
            return { x: 795, y: 310 + (idx % 3) * 180 };
          case 'FINANS_MEYDANI_ROTASI':
          default:
            return { x: 560 + (idx % 3) * 165, y: 380 };
        }
      };

      return (
        <div
          aria-hidden="true"
          data-testid="isometric-vehicle-layer"
          data-vehicle-count={vehicles.length}
          data-animations-active={animationsActive ? 'true' : 'false'}
          className="absolute inset-0 pointer-events-none select-none"
        >
          <style>{`
            @keyframes isoRoutePlazaLoop {
              0%   { transform: translate3d(520px, 380px, 0); }
              25%  { transform: translate3d(1070px, 380px, 0); }
              50%  { transform: translate3d(1070px, 770px, 0); }
              75%  { transform: translate3d(520px, 770px, 0); }
              100% { transform: translate3d(520px, 380px, 0); }
            }
            @keyframes isoRouteIndustryLoop {
              0%   { transform: translate3d(240px, 895px, 0); }
              50%  { transform: translate3d(1340px, 895px, 0); }
              100% { transform: translate3d(240px, 895px, 0); }
            }
            @keyframes isoRouteCommerceLoop {
              0%   { transform: translate3d(215px, 385px, 0); }
              35%  { transform: translate3d(215px, 885px, 0); }
              65%  { transform: translate3d(510px, 605px, 0); }
              100% { transform: translate3d(215px, 385px, 0); }
            }
            @keyframes isoRouteNorthSouthLoop {
              0%   { transform: translate3d(380px, 380px, 0); }
              50%  { transform: translate3d(1220px, 380px, 0); }
              100% { transform: translate3d(380px, 380px, 0); }
            }
          `}</style>

          {vehicles.map((veh, idx) => {
            const staticPos = getStaticCoordinates(veh.routeId, idx);

            return (
              <div
                key={veh.id}
                data-testid={`city-vehicle-${veh.id}`}
                data-vehicle-type={veh.vehicleType}
                data-route={veh.routeId}
                style={
                  animationsActive
                    ? {
                        animationName: getRouteAnimationName(veh.routeId),
                        animationDuration: `${veh.durationSec}s`,
                        animationDelay: `-${veh.delaySec}s`,
                        animationTimingFunction: 'linear',
                        animationIterationCount: 'infinite',
                      }
                    : {
                        transform: `translate3d(${staticPos.x}px, ${staticPos.y}px, 0)`,
                      }
                }
                className="absolute top-0 left-0 -ml-3 -mt-2 flex items-center"
              >
                {veh.isFactoryTruck ? (
                  /* Üretim & Sanayi Kamyonu (Kabin + Kasa) */
                  <div className="relative flex items-center shadow-2xs">
                    <div className="w-5 h-4 rounded-l-xs bg-slate-100 border border-amber-500 flex items-center justify-center">
                      <span className="w-3 h-1.5 bg-amber-500 rounded-2xs" />
                    </div>
                    <div className="w-3 h-3.5 rounded-r-xs bg-amber-600 border-y border-r border-amber-300" />
                    {headlightsOn && (
                      <div className="absolute -right-2.5 top-0.5 w-2.5 h-2 rounded-r-full bg-amber-200/80" />
                    )}
                  </div>
                ) : veh.vehicleType === 'BUS' ? (
                  /* Şehir Otobüsü */
                  <div
                    className={`relative w-8 h-4 rounded-xs border shadow-2xs ${veh.colorClass} flex items-center justify-around px-0.5`}
                  >
                    <span className="w-1.5 h-2 rounded-2xs bg-white/90" />
                    <span className="w-1.5 h-2 rounded-2xs bg-white/90" />
                    <span className="w-1.5 h-2 rounded-2xs bg-white/90" />
                    {headlightsOn && (
                      <div className="absolute -right-2.5 top-0.5 w-2.5 h-2 rounded-r-full bg-amber-200/75" />
                    )}
                  </div>
                ) : (
                  /* 2.5D Stilize Şehir Otomobili / Taksi / Kamyonet / Servis */
                  <div
                    className={`relative w-6 h-3.5 rounded-xs border shadow-2xs ${veh.colorClass} flex items-center justify-center`}
                  >
                    <div className="w-3 h-2 rounded-2xs bg-white/90" />
                    {veh.vehicleType === 'TAXI' && (
                      <span className="absolute -top-1 w-2 h-1 rounded-2xs bg-slate-900" />
                    )}
                    {headlightsOn && (
                      <div className="absolute -right-2.5 top-0.5 w-2.5 h-2 rounded-r-full bg-amber-200/75" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
  );
