/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IPOEligibilityResult,
  SimulationState,
  TimeScaleOption,
} from '../../../models/simulation';
import { GraphicsQualityLevel } from '../../../state/uiSettingsStore';
import { CityBuildingId } from '../gameTypes';
import { CityCameraControls } from './CityCameraControls';
import {
  clampCameraPan,
  deriveCityAtmosphere,
  deriveCityUrbanBlocks,
  deriveIsometricBuildings,
  getCameraFocusPanForBuilding,
} from './cityLayout';
import {
  CityCameraState,
  CityUrbanBlockNode,
  CityZoomPreset,
  CompanySubTabRoute,
} from './cityVisualTypes';
import { IsometricMap } from './IsometricMap';
import { IsometricSelectionOverlay } from './IsometricSelectionOverlay';
import {
  CityVisualEventPulse,
  CityVisualEventTrackerState,
  consumeNewCityVisualPulses,
  createInitialCityVisualTracker,
} from './questAndHudLogic';

interface IsometricNeighborhoodViewProps {
  state: SimulationState;
  ipoEligibility: IPOEligibilityResult;
  formatCurrency: (val: number) => string;
  camera: CityCameraState;
  onChangeCamera: (next: CityCameraState) => void;
  selectedBuildingId: CityBuildingId | null;
  activeHighlightedBuildingId: CityBuildingId | null;
  graphicsQuality?: GraphicsQualityLevel;
  onSelectBuildingOnMap: (
    id: CityBuildingId,
    companySubTab?: CompanySubTabRoute
  ) => void;
  onOpenBuildingDetailSheet: (
    id: CityBuildingId,
    companySubTab?: CompanySubTabRoute
  ) => void;
  onClearHighlightedBuilding: () => void;
  onSetTimeScale: (scale: TimeScaleOption) => void;
  onAdvanceToMarketOpen: () => void;
  onAdvanceOneHour: () => void;
  onTickDay: () => void;
  nextEventLabelTR: string;
  nextEventFormattedRemaining: string;
}

/**
 * İzometrik 2.5D Tycoon Şehri Ana Görünümü.
 * 6 bölgeyi, 22 şehir bloğu yapısını, 8 ana etkileşimli binayı ve iki aşamalı seçim/yönlendirme sistemini yönetir.
 */
export const IsometricNeighborhoodView: React.FC<IsometricNeighborhoodViewProps> =
  React.memo(
    ({
      state,
      ipoEligibility,
      formatCurrency,
      camera,
      onChangeCamera,
      selectedBuildingId,
      activeHighlightedBuildingId,
      graphicsQuality = 'MEDIUM',
      onSelectBuildingOnMap,
      onOpenBuildingDetailSheet,
      onClearHighlightedBuilding,
      onSetTimeScale,
      onAdvanceToMarketOpen,
      onAdvanceOneHour,
      onTickDay,
      nextEventLabelTR,
      nextEventFormattedRemaining,
    }) => {
      const visualTrackerRef = useRef<CityVisualEventTrackerState | null>(null);
      if (!visualTrackerRef.current) {
        visualTrackerRef.current = createInitialCityVisualTracker(state);
      }

      const [activePulses, setActivePulses] = useState<CityVisualEventPulse[]>(
        []
      );

      useEffect(() => {
        if (!visualTrackerRef.current) {
          visualTrackerRef.current = createInitialCityVisualTracker(state);
          return;
        }
        const pulses = consumeNewCityVisualPulses(
          visualTrackerRef.current,
          state
        );
        if (pulses.length > 0) {
          const eventIds = new Set(pulses.map((p) => p.eventId));
          setActivePulses((prev) => [...prev, ...pulses]);
          const timerId = window.setTimeout(() => {
            setActivePulses((prev) =>
              prev.filter((item) => !eventIds.has(item.eventId))
            );
          }, 2600);
          return () => window.clearTimeout(timerId);
        }
      }, [
        state.pendingOrders,
        state.newsFeed,
        state.playerCompany?.isPubliclyListed,
        state.stage,
        state.stageUnlocks.stage4Holding,
      ]);

      const atmosphere = useMemo(
        () => deriveCityAtmosphere(state.currentGameHour),
        [state.currentGameHour]
      );

      const buildings = useMemo(
        () =>
          deriveIsometricBuildings(state, ipoEligibility, formatCurrency),
        [
          state.day,
          state.stage,
          state.stageUnlocks.stage2Entrepreneur,
          state.stageUnlocks.stage3Ipo,
          state.stageUnlocks.stage4Holding,
          state.marketSession,
          state.isPaused,
          state.cash,
          state.netWorth,
          state.totalDebt,
          state.activeLoans,
          state.pendingOrders,
          state.portfolio,
          state.playerCompany,
          state.controlledSubsidiaries,
          state.newsFeed,
          state.tradeState,
          ipoEligibility,
          formatCurrency,
        ]
      );

      const urbanBlocks = useMemo(
        () => deriveCityUrbanBlocks(state),
        [
          state.stage,
          state.stageUnlocks.stage2Entrepreneur,
          state.stageUnlocks.stage4Holding,
          state.netWorth,
          state.playerCompany,
          state.tradeState,
        ]
      );

      const [selectedUrbanBlockId, setSelectedUrbanBlockId] = useState<
        string | null
      >(null);

      const highlightedBuilding = useMemo(
        () =>
          buildings.find((b) => b.id === activeHighlightedBuildingId) || null,
        [buildings, activeHighlightedBuildingId]
      );

      const selectedUrbanBlock = useMemo(
        () =>
          selectedUrbanBlockId
            ? urbanBlocks.find((b) => b.id === selectedUrbanBlockId) || null
            : null,
        [urbanBlocks, selectedUrbanBlockId]
      );

      const hasPlayerCompany = Boolean(state.playerCompany);
      const isProducing = Boolean(
        state.playerCompany && state.playerCompany.dailyUnitsProduced > 0
      );
      const inventoryUnits =
        state.playerCompany?.operations?.inventoryUnits ??
        state.playerCompany?.financials.inventoryUnits ??
        0;
      const inTransitShipmentsCount =
        state.tradeState?.shipments?.filter((s) => s.status === 'IN_TRANSIT')
          .length ?? 0;

      const handleUpdatePan = useCallback(
        (panX: number, panY: number) => {
          const clamped = clampCameraPan(panX, panY, camera.zoomPreset);
          onChangeCamera({
            ...camera,
            panX: clamped.panX,
            panY: clamped.panY,
          });
        },
        [camera, onChangeCamera]
      );

      const handleChangeZoomPreset = useCallback(
        (zoomPreset: CityZoomPreset) => {
          const clamped = clampCameraPan(camera.panX, camera.panY, zoomPreset);
          onChangeCamera({
            panX: clamped.panX,
            panY: clamped.panY,
            zoomPreset,
          });
        },
        [camera.panX, camera.panY, onChangeCamera]
      );

      const handleResetCenter = useCallback(() => {
        onChangeCamera({
          ...camera,
          panX: 0,
          panY: 0,
        });
      }, [camera, onChangeCamera]);

      const handleFocusPlayerCompany = useCallback(() => {
        setSelectedUrbanBlockId(null);
        const focusPan = getCameraFocusPanForBuilding(
          'SIRKET_MERKEZI',
          camera.zoomPreset
        );
        onChangeCamera({
          ...camera,
          panX: focusPan.panX,
          panY: focusPan.panY,
        });
        onSelectBuildingOnMap('SIRKET_MERKEZI', 'OZET');
      }, [camera, onChangeCamera, onSelectBuildingOnMap]);

      const handleBuildingTap = useCallback(
        (id: CityBuildingId) => {
          setSelectedUrbanBlockId(null);
          const focusPan = getCameraFocusPanForBuilding(id, camera.zoomPreset);
          onChangeCamera({
            ...camera,
            panX: focusPan.panX,
            panY: focusPan.panY,
          });
          const targetBuilding = buildings.find((b) => b.id === id);
          onSelectBuildingOnMap(
            id,
            targetBuilding?.selectionCard.navigationTarget.companySubTab
          );
        },
        [buildings, camera, onChangeCamera, onSelectBuildingOnMap]
      );

      const handleUrbanBlockTap = useCallback(
        (block: CityUrbanBlockNode) => {
          setSelectedUrbanBlockId(block.id);
          const focusPan = getCameraFocusPanForBuilding(
            block.linkedBuildingId,
            camera.zoomPreset
          );
          onChangeCamera({
            ...camera,
            panX: focusPan.panX,
            panY: focusPan.panY,
          });
          onSelectBuildingOnMap(
            block.linkedBuildingId,
            block.linkedCompanySubTab
          );
          if (
            block.isUnlocked &&
            block.statusClassification === 'ACTIVE' &&
            (block.districtId === 'TICARET_BOLGESI' ||
              block.districtId === 'SANAYI_BOLGESI')
          ) {
            onOpenBuildingDetailSheet(
              block.linkedBuildingId,
              block.linkedCompanySubTab
            );
          }
        },
        [
          camera,
          onChangeCamera,
          onSelectBuildingOnMap,
          onOpenBuildingDetailSheet,
        ]
      );

      const handleClearOverlaySelection = useCallback(() => {
        setSelectedUrbanBlockId(null);
        onClearHighlightedBuilding();
      }, [onClearHighlightedBuilding]);

      return (
        <section
          aria-label="İzometrik Finans Mahallesi"
          data-testid="isometric-neighborhood-view"
          data-atmosphere-phase={atmosphere.phase}
          className="relative w-full"
        >
          {/* 2.5D İzometrik Harita Sahnesi */}
          <IsometricMap
            buildings={buildings}
            urbanBlocks={urbanBlocks}
            stage={state.stage}
            isPaused={state.isPaused}
            atmosphere={atmosphere}
            camera={camera}
            selectedBuildingId={selectedBuildingId || activeHighlightedBuildingId}
            graphicsQuality={graphicsQuality}
            hasPlayerCompany={hasPlayerCompany}
            isProducing={isProducing}
            inventoryUnits={inventoryUnits}
            inTransitShipmentsCount={inTransitShipmentsCount}
            activePulses={activePulses}
            onUpdateCameraPan={handleUpdatePan}
            onSelectBuilding={handleBuildingTap}
            onSelectUrbanBlock={handleUrbanBlockTap}
            onClearSelection={handleClearOverlaySelection}
          />

          {/* Seçili veya Kilitli Bina / Şehir Bloğu Kısa Bilgi Balonu */}
          <IsometricSelectionOverlay
            selectedBuilding={highlightedBuilding}
            selectedUrbanBlock={selectedUrbanBlock}
            onOpenDetailSheet={onOpenBuildingDetailSheet}
            onClearSelection={handleClearOverlaySelection}
          />

          {/* Harita Köşesi Kamera ve Hız Kontrolleri */}
          <CityCameraControls
            zoomPreset={camera.zoomPreset}
            onChangeZoomPreset={handleChangeZoomPreset}
            onResetCameraCenter={handleResetCenter}
            onFocusPlayerCompany={handleFocusPlayerCompany}
            timeScale={state.timeScale}
            isPaused={state.isPaused}
            onSetTimeScale={onSetTimeScale}
            onAdvanceToMarketOpen={onAdvanceToMarketOpen}
            onAdvanceOneHour={onAdvanceOneHour}
            onTickDay={onTickDay}
            nextEventLabelTR={nextEventLabelTR}
            nextEventFormattedRemaining={nextEventFormattedRemaining}
          />
        </section>
      );
    }
  );
