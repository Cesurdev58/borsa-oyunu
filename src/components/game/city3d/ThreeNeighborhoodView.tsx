/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CityBuildingId } from '../gameTypes';
import { CityCameraControls } from '../city/CityCameraControls';
import {
  deriveCityAtmosphere,
  deriveCityUrbanBlocks,
  deriveIsometricBuildings,
} from '../city/cityLayout';
import { CityUrbanBlockNode, CityZoomPreset } from '../city/cityVisualTypes';
import { IsometricNeighborhoodView } from '../city/IsometricNeighborhoodView';
import {
  IsometricSelectionOverlay,
  type SelectedShopInfo,
} from '../city/IsometricSelectionOverlay';
import { planShopRestock } from '../../../engine/ShopRestockPlanner';
import { ThreeCityScene } from './ThreeCityScene';

export type CityViewProps = React.ComponentProps<typeof IsometricNeighborhoodView>;
type ViewProps = CityViewProps;

export interface ThreeViewProps extends ViewProps {
  onSwitchClassic?: () => void;
}

/**
 * Şehrin gerçek 3D görünümü. Oyun verisini eski izometrik görünümle aynı fonksiyonlardan alır;
 * bina, blok ve araçlar 3D sahnede çizilir, tıklamalar eski görünümdeki aynı geri çağrılara gider.
 */
export const ThreeNeighborhoodView: React.FC<ThreeViewProps> = React.memo(
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
    onSwitchClassic,
    onRestockShop,
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<ThreeCityScene | null>(null);
    const [selectedUrbanBlockId, setSelectedUrbanBlockId] = useState<string | null>(null);

    const atmosphere = useMemo(() => deriveCityAtmosphere(state.currentGameHour), [state.currentGameHour]);

    const buildings = useMemo(
      () => deriveIsometricBuildings(state, ipoEligibility, formatCurrency),
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        state.stage,
        state.stageUnlocks.stage2Entrepreneur,
        state.stageUnlocks.stage4Holding,
        state.netWorth,
        state.playerCompany,
        state.tradeState,
      ]
    );

    const highlightedBuilding = useMemo(
      () => buildings.find((b) => b.id === activeHighlightedBuildingId) || null,
      [buildings, activeHighlightedBuildingId]
    );
    const selectedUrbanBlock = useMemo(
      () => (selectedUrbanBlockId ? urbanBlocks.find((b) => b.id === selectedUrbanBlockId) || null : null),
      [urbanBlocks, selectedUrbanBlockId]
    );

    const selectedShopInfo = useMemo<SelectedShopInfo | null>(() => {
      const shopId = selectedUrbanBlock?.activeShopId;
      const shop = shopId
        ? state.tradeState?.shops.find((sh) => sh.shopId === shopId)
        : undefined;
      if (!shop) return null;
      const used = shop.inventoryBatches.reduce((sum, b) => sum + b.quantity, 0);
      const plan = planShopRestock(
        state,
        shop.shopId,
        state.cash + shop.cashAccountBalance
      );
      return {
        shopId: shop.shopId,
        sales: shop.todaySalesRevenue,
        profit: shop.todayNetProfit,
        fillPct: Math.min(
          100,
          Math.round((used / Math.max(1, shop.shelfCapacity)) * 100)
        ),
        restockCost: plan.totalCost,
        canRestock: plan.orders.length > 0,
      };
    }, [state, selectedUrbanBlock]);


    const hasPlayerCompany = Boolean(state.playerCompany);
    const isProducing = Boolean(state.playerCompany && state.playerCompany.dailyUnitsProduced > 0);
    const inventoryUnits =
      state.playerCompany?.operations?.inventoryUnits ?? state.playerCompany?.financials.inventoryUnits ?? 0;
    const inTransitShipmentsCount =
      state.tradeState?.shipments?.filter((s) => s.status === 'IN_TRANSIT').length ?? 0;

    const handleBuildingTap = useCallback(
      (id: CityBuildingId) => {
        setSelectedUrbanBlockId(null);
        const node = buildings.find((b) => b.id === id);
        if (node) sceneRef.current?.focusMap(node.x, node.y);
        onSelectBuildingOnMap(id, node?.selectionCard.navigationTarget.companySubTab);
      },
      [buildings, onSelectBuildingOnMap]
    );

    const handleBlockTap = useCallback(
      (blockId: string) => {
        const block: CityUrbanBlockNode | undefined = urbanBlocks.find((b) => b.id === blockId);
        if (!block) return;
        setSelectedUrbanBlockId(block.id);
        sceneRef.current?.focusMap(block.x, block.y);
        onSelectBuildingOnMap(block.linkedBuildingId, block.linkedCompanySubTab);
        if (
          block.isUnlocked &&
          block.statusClassification === 'ACTIVE' &&
          !block.activeShopId &&
          (block.districtId === 'TICARET_BOLGESI' || block.districtId === 'SANAYI_BOLGESI')
        ) {
          onOpenBuildingDetailSheet(block.linkedBuildingId, block.linkedCompanySubTab);
        }
      },
      [urbanBlocks, onSelectBuildingOnMap, onOpenBuildingDetailSheet]
    );

    const handleClearSelection = useCallback(() => {
      setSelectedUrbanBlockId(null);
      onClearHighlightedBuilding();
    }, [onClearHighlightedBuilding]);

    // Sahne tıklamaları her zaman en güncel geri çağrıları kullanır.
    const handlersRef = useRef({ handleBuildingTap, handleBlockTap, handleClearSelection });
    handlersRef.current = { handleBuildingTap, handleBlockTap, handleClearSelection };

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const scene = new ThreeCityScene(container, {
        onPickBuilding: (id) => handlersRef.current.handleBuildingTap(id),
        onPickBlock: (id) => handlersRef.current.handleBlockTap(id),
        onPickNothing: () => handlersRef.current.handleClearSelection(),
      });
      sceneRef.current = scene;
      return () => {
        scene.dispose();
        sceneRef.current = null;
      };
    }, []);

    useEffect(() => {
      sceneRef.current?.update({
        buildings,
        blocks: urbanBlocks,
        atmosphere,
        stage: state.stage,
        isPaused: state.isPaused,
        graphicsQuality,
        hasPlayerCompany,
        isProducing,
        inventoryUnits,
        inTransitShipmentsCount,
        selectedBuildingId: selectedBuildingId || activeHighlightedBuildingId,
        selectedBlockId: selectedUrbanBlockId,
      });
    }, [
      buildings,
      urbanBlocks,
      atmosphere,
      state.stage,
      state.isPaused,
      graphicsQuality,
      hasPlayerCompany,
      isProducing,
      inventoryUnits,
      inTransitShipmentsCount,
      selectedBuildingId,
      activeHighlightedBuildingId,
      selectedUrbanBlockId,
    ]);

    useEffect(() => {
      sceneRef.current?.setZoomPreset(camera.zoomPreset);
    }, [camera.zoomPreset]);

    const handleChangeZoomPreset = useCallback(
      (zoomPreset: CityZoomPreset) => onChangeCamera({ panX: 0, panY: 0, zoomPreset }),
      [onChangeCamera]
    );
    const handleResetCenter = useCallback(
      () => sceneRef.current?.resetView(camera.zoomPreset),
      [camera.zoomPreset]
    );
    const handleFocusPlayerCompany = useCallback(() => {
      handleBuildingTap('SIRKET_MERKEZI');
    }, [handleBuildingTap]);

    return (
      <section
        aria-label="3D Finans Mahallesi"
        data-testid="city3d-view"
        data-atmosphere-phase={atmosphere.phase}
        className="relative w-full"
      >
        <div
          ref={containerRef}
          data-testid="city3d-viewport"
          className="relative isolate w-full h-[540px] sm:h-[600px] lg:h-[640px] overflow-hidden rounded-3xl border border-slate-200/90 select-none cursor-grab active:cursor-grabbing"
        />

        {/* Klavye ve ekran okuyucu kullanıcıları için 8 ana bina düğmesi */}
        <div className="sr-only">
          {buildings.map((b) => (
            <button
              key={b.id}
              type="button"
              data-testid={`city-building-${b.id}`}
              aria-label={b.accessibleLabel}
              onClick={() => handleBuildingTap(b.id)}
            >
              {b.fullTitle}
            </button>
          ))}
        </div>

        <IsometricSelectionOverlay
          selectedBuilding={highlightedBuilding}
          selectedUrbanBlock={selectedUrbanBlock}
          shopInfo={selectedShopInfo}
          onRestockShop={onRestockShop}
          formatCurrency={formatCurrency}
          onOpenDetailSheet={onOpenBuildingDetailSheet}
          onClearSelection={handleClearSelection}
        />

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

        {onSwitchClassic && (
          <button
            type="button"
            data-testid="city-switch-classic"
            onClick={onSwitchClassic}
            className="absolute bottom-3 left-3 z-40 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-md border border-slate-200 hover:bg-white"
          >
            Klasik görünüme geç
          </button>
        )}
      </section>
    );
  }
);

export default ThreeNeighborhoodView;
