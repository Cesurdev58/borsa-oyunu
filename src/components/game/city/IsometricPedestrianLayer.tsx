/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { GraphicsQualityLevel } from '../../../state/uiSettingsStore';
import { deriveActivePedestrians } from './cityLayout';

interface IsometricPedestrianLayerProps {
  isPaused: boolean;
  graphicsQuality: GraphicsQualityLevel;
}

/**
 * Yalnızca kaldırım ve meydan çevresinde yürüyen (en fazla 4) stilize yaya katmanı.
 * - Düşük grafik modunda 0 yaya
 * - Orta grafik modunda 2 yaya
 * - Yüksek grafik modunda 4 yaya
 * - Ekonomik motoru tetiklemez; sayfa gizliyken veya prefers-reduced-motion aktifken durur.
 */
export const IsometricPedestrianLayer: React.FC<IsometricPedestrianLayerProps> =
  React.memo(({ isPaused, graphicsQuality }) => {
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

    const { pedestrians, animationsActive } = deriveActivePedestrians(
      isPaused,
      reducedMotion,
      isPageVisible,
      graphicsQuality
    );

    if (pedestrians.length === 0) {
      return (
        <div
          aria-hidden="true"
          data-testid="isometric-pedestrian-layer"
          data-pedestrian-count={0}
          className="absolute inset-0 pointer-events-none select-none"
        />
      );
    }

    return (
      <div
        aria-hidden="true"
        data-testid="isometric-pedestrian-layer"
        data-pedestrian-count={pedestrians.length}
        data-animations-active={animationsActive ? 'true' : 'false'}
        className="absolute inset-0 pointer-events-none select-none"
      >
        <style>{`
          @keyframes isoPedPlazaNorth {
            0%   { transform: translate3d(640px, 425px, 0); }
            50%  { transform: translate3d(940px, 425px, 0); }
            100% { transform: translate3d(640px, 425px, 0); }
          }
          @keyframes isoPedPlazaSouth {
            0%   { transform: translate3d(935px, 735px, 0); }
            50%  { transform: translate3d(645px, 735px, 0); }
            100% { transform: translate3d(935px, 735px, 0); }
          }
          @keyframes isoPedSidewalkWest {
            0%   { transform: translate3d(545px, 440px, 0); }
            50%  { transform: translate3d(545px, 715px, 0); }
            100% { transform: translate3d(545px, 440px, 0); }
          }
          @keyframes isoPedSidewalkEast {
            0%   { transform: translate3d(1045px, 715px, 0); }
            50%  { transform: translate3d(1045px, 440px, 0); }
            100% { transform: translate3d(1045px, 715px, 0); }
          }
        `}</style>

        {pedestrians.map((ped) => {
          const animName =
            ped.walkwayId === 'PLAZA_NORTH_SIDEWALK'
              ? 'isoPedPlazaNorth'
              : ped.walkwayId === 'PLAZA_SOUTH_SIDEWALK'
              ? 'isoPedPlazaSouth'
              : ped.walkwayId === 'WEST_BOULEVARD_SIDEWALK'
              ? 'isoPedSidewalkWest'
              : 'isoPedSidewalkEast';

          return (
            <div
              key={ped.id}
              data-testid={`city-pedestrian-${ped.id}`}
              data-walkway={ped.walkwayId}
              style={
                animationsActive
                  ? {
                      animationName: animName,
                      animationDuration: `${ped.durationSec}s`,
                      animationDelay: `-${ped.delaySec}s`,
                      animationTimingFunction: 'linear',
                      animationIterationCount: 'infinite',
                    }
                  : {
                      transform: `translate3d(${ped.startX}px, ${ped.startY}px, 0)`,
                    }
              }
              className="absolute top-0 left-0 -ml-1.5 -mt-3 flex flex-col items-center"
            >
              {/* Stilize Küçük Yaya Figürü (Baş + Gövde + Gölge) */}
              <div className="w-2 h-2 rounded-full bg-amber-200 border border-slate-700" />
              <div
                className={`w-2.5 h-3 rounded-t-sm ${ped.coatColorClass} border border-white/70 -mt-0.5`}
              />
              <div className="w-3 h-1 rounded-full bg-slate-900/25 -mt-0.5" />
            </div>
          );
        })}
      </div>
    );
  });
