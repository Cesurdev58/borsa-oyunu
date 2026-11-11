/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationStage } from '../../../models/simulation';
import {
  getGraphicsQualityProfile,
  GraphicsQualityLevel,
} from '../../../state/uiSettingsStore';
import { CityBuildingId } from '../gameTypes';
import {
  clampCameraPan,
  getZoomScale,
  VIRTUAL_MAP_HEIGHT,
  VIRTUAL_MAP_WIDTH,
} from './cityLayout';
import {
  CityAtmosphereTheme,
  CityCameraState,
  CityUrbanBlockNode,
  IsometricBuildingNode,
} from './cityVisualTypes';
import { IsometricBuilding } from './IsometricBuilding';
import { IsometricDecorationLayer } from './IsometricDecorationLayer';
import { IsometricPedestrianLayer } from './IsometricPedestrianLayer';
import { IsometricRoadLayer } from './IsometricRoadLayer';
import { IsometricVehicleLayer } from './IsometricVehicleLayer';
import { CityVisualEventPulse } from './questAndHudLogic';

interface IsometricMapProps {
  buildings: IsometricBuildingNode[];
  urbanBlocks?: CityUrbanBlockNode[];
  stage: SimulationStage;
  isPaused: boolean;
  atmosphere: CityAtmosphereTheme;
  camera: CityCameraState;
  selectedBuildingId: CityBuildingId | null;
  graphicsQuality?: GraphicsQualityLevel;
  hasPlayerCompany?: boolean;
  isProducing?: boolean;
  inventoryUnits?: number;
  inTransitShipmentsCount?: number;
  activePulses?: CityVisualEventPulse[];
  onUpdateCameraPan: (panX: number, panY: number) => void;
  onSelectBuilding: (id: CityBuildingId) => void;
  onSelectUrbanBlock?: (block: CityUrbanBlockNode) => void;
  onClearSelection: () => void;
}

/**
 * 1600x1200 sanal finans ve sanayi şehrini tek parmakla sınırlı sürüklenebilir
 * ve kontrollü yakınlaştırılabilir (Yakın / Normal / Genel) bir 2.5D sahne içinde gösterir.
 */
export const IsometricMap: React.FC<IsometricMapProps> = React.memo(
  ({
    buildings,
    urbanBlocks = [],
    stage,
    isPaused,
    atmosphere,
    camera,
    selectedBuildingId,
    graphicsQuality = 'MEDIUM',
    hasPlayerCompany = false,
    isProducing = false,
    inventoryUnits = 0,
    inTransitShipmentsCount = 0,
    activePulses = [],
    onUpdateCameraPan,
    onSelectBuilding,
    onSelectUrbanBlock,
    onClearSelection,
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({
      w: typeof window !== 'undefined' ? window.innerWidth : 390,
      h: 560,
    });

    const dragRef = useRef<{
      active: boolean;
      startX: number;
      startY: number;
      originPanX: number;
      originPanY: number;
      moved: boolean;
    }>({
      active: false,
      startX: 0,
      startY: 0,
      originPanX: 0,
      originPanY: 0,
      moved: false,
    });

    useEffect(() => {
      const updateDims = () => {
        if (containerRef.current) {
          setViewportSize({
            w: containerRef.current.clientWidth || window.innerWidth,
            h: containerRef.current.clientHeight || 560,
          });
        }
      };
      updateDims();
      window.addEventListener('resize', updateDims);
      return () => window.removeEventListener('resize', updateDims);
    }, []);

    const scale = getZoomScale(camera.zoomPreset, viewportSize.w);
    const clampedPan = clampCameraPan(
      camera.panX,
      camera.panY,
      camera.zoomPreset,
      viewportSize.w,
      viewportSize.h
    );
    const qualityProfile = getGraphicsQualityProfile(graphicsQuality);
    const isIpoCelebrationActive = activePulses.some(
      (p) => p.kind === 'IPO_CELEBRATION_PULSE'
    );

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button')) return;

        dragRef.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          originPanX: clampedPan.panX,
          originPanY: clampedPan.panY,
          moved: false,
        };
      },
      [clampedPan.panX, clampedPan.panY]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current.active) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          dragRef.current.moved = true;
        }
        const next = clampCameraPan(
          dragRef.current.originPanX + dx,
          dragRef.current.originPanY + dy,
          camera.zoomPreset,
          viewportSize.w,
          viewportSize.h
        );
        onUpdateCameraPan(next.panX, next.panY);
      },
      [camera.zoomPreset, onUpdateCameraPan, viewportSize.h, viewportSize.w]
    );

    const handlePointerUp = useCallback(() => {
      if (!dragRef.current.active) return;
      const wasMoved = dragRef.current.moved;
      dragRef.current.active = false;
      if (!wasMoved && selectedBuildingId) {
        onClearSelection();
      }
    }, [onClearSelection, selectedBuildingId]);

    return (
      <div
        ref={containerRef}
        data-testid="isometric-map-viewport"
        data-pan-x={clampedPan.panX}
        data-pan-y={clampedPan.panY}
        data-zoom-preset={camera.zoomPreset}
        data-graphics-quality={graphicsQuality}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-full h-[540px] sm:h-[600px] lg:h-[640px] overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b ${atmosphere.skySurfaceClass} select-none touch-none cursor-grab active:cursor-grabbing`}
      >
        {/* Sanal 1600x1200 İzometrik Şehir Sahnesi */}
        <div
          data-testid="isometric-virtual-canvas"
          style={{
            width: `${VIRTUAL_MAP_WIDTH}px`,
            height: `${VIRTUAL_MAP_HEIGHT}px`,
            left: '50%',
            top: '50%',
            transform: `translate3d(calc(-50% + ${clampedPan.panX}px), calc(-50% + ${clampedPan.panY}px), 0) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          className={`absolute rounded-[48px] shadow-xl transition-transform duration-150 ease-out ${atmosphere.groundTintClass}`}
        >
          {/* 1. Yollar, Kaldırımlar, Şehir Blok Adaları ve Finans Meydanı Katmanı */}
          <IsometricRoadLayer stage={stage} atmosphere={atmosphere} />

          {/* 2. 22 Şehir Bloğu Binası + Ağaçlar, Sokak Lambaları, Banklar, Duraklar, Otopark Katmanı */}
          <IsometricDecorationLayer
            stage={stage}
            atmosphere={atmosphere}
            animationsActive={!isPaused && qualityProfile.particlesEnabled}
            urbanBlocks={urbanBlocks}
            onSelectUrbanBlock={onSelectUrbanBlock}
            onSelectBuilding={onSelectBuilding}
          />

          {/* 3. Kaldırım ve Meydan Üzerindeki Yaya Figürleri Katmanı */}
          <IsometricPedestrianLayer
            isPaused={isPaused}
            graphicsQuality={graphicsQuality}
          />

          {/* 4. Bulvar ve Teslimat Rotaları Üzerindeki Stilize Araçlar Katmanı */}
          <IsometricVehicleLayer
            stage={stage}
            isPaused={isPaused}
            atmosphere={atmosphere}
            graphicsQuality={graphicsQuality}
            hasPlayerCompany={hasPlayerCompany}
            isProducing={isProducing}
            inventoryUnits={inventoryUnits}
            inTransitShipmentsCount={inTransitShipmentsCount}
          />

          {/* 5. 8 Dokunulabilir Ana 2.5D İzometrik Bina Yapısı */}
          {buildings.map((b) => (
            <IsometricBuilding
              key={b.id}
              building={b}
              atmosphere={atmosphere}
              isSelected={selectedBuildingId === b.id}
              activePulses={activePulses}
              reducedShadows={qualityProfile.reducedShadows}
              onSelectBuilding={onSelectBuilding}
            />
          ))}

          {/* Tek Seferlik Halka Arz (IPO) Meydan Kutlama Efekti */}
          {isIpoCelebrationActive && qualityProfile.particlesEnabled && (
            <div
              data-testid="plaza-ipo-celebration"
              aria-hidden="true"
              style={{ left: '50%', top: '48%' }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center"
            >
              <div className="px-4 py-1.5 rounded-full bg-amber-500 text-white text-xs font-extrabold tracking-wide shadow-lg border-2 border-amber-200">
                HALKA ARZ TAMAMLANDI!
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);
