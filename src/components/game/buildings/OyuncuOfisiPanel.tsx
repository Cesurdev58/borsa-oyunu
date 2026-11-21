/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OYUNCU_OFISI bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import React, { useEffect, useState } from 'react';
import {
  EsnafAndTradePanel,
} from '../EsnafAndTradePanel';
import type {
  BuildingDetailContentProps,
} from './buildingTypes';
import { ShopDashboard } from './ShopDashboard';
import { CitySwitcher } from '../ui/CitySwitcher';
import { ExtraUpgrades } from '../ui/ExtraUpgrades';
import { resolveViewCity } from '../ui/cityViewLogic';

export const OyuncuOfisiPanel: React.FC<BuildingDetailContentProps> = ({
  state,
  spendableCash,
  formatCurrency,
  onOpenShop,
  onUpgradeShopLevel,
  onTransferShopCash,
  onConfigureShop,
  onPlaceProcurementOrder,
  onCancelProcurementOrder,
  onCreatePurchaseContract,
  onExecuteRecipeProduction,
  onPurchaseLogisticsVehicle,
  onDispatchWarehouseToShop,
  onAcceptCommercialContract,
  onDeliverCommercialContract,
  onIncorporateShopsIntoCompany,
  onHireShopManager,
  onHireFirstEmployee,
  onBuyShopUpgrade,
  onFireShopManager,
  onSetShopManagerSweep,
  manageRequest,
  viewCityId,
  onChangeViewCity,
  onOpenCityService,
}) => {
  const [managing, setManaging] = useState<{ shopId: string | null; tab?: NonNullable<typeof manageRequest>['tab'] } | null>(
    manageRequest ? { shopId: manageRequest.shopId, tab: manageRequest.tab } : null
  );
  useEffect(() => {
    if (manageRequest) setManaging({ shopId: manageRequest.shopId, tab: manageRequest.tab });
  }, [manageRequest?.nonce]);

  return (
    <div
      className="space-y-4 text-xs"
      data-testid="sheet-content-OYUNCU_OFISI"
    >
      {managing ? (
        <div className="space-y-3">
          <button
            type="button"
            data-testid="shop-manage-back"
            onClick={() => setManaging(null)}
            className="g-btn g-btn-secondary px-4"
          >
            ← Dükkânlarıma dön
          </button>
      {/* Esnaf, Dükkânlar, Ticaret Merkezi ve Şirketleşme Paneli */}
      {onOpenShop &&
        onUpgradeShopLevel &&
        onTransferShopCash &&
        onConfigureShop &&
        onPlaceProcurementOrder &&
        onCancelProcurementOrder &&
        onCreatePurchaseContract &&
        onExecuteRecipeProduction &&
        onPurchaseLogisticsVehicle &&
        onDispatchWarehouseToShop &&
        onAcceptCommercialContract &&
        onDeliverCommercialContract &&
        onIncorporateShopsIntoCompany && (
          <EsnafAndTradePanel
            state={state}
            spendableCash={spendableCash}
            formatCurrency={formatCurrency}
            initialSection="SHOPS"
            initialShopId={managing.shopId}
            initialActionTab={managing.tab}
            startWithOpenBranch={managing.shopId === null}
            onOpenShop={(params) => {
              onOpenShop(params);
              setManaging(null);
            }}
            onUpgradeShopLevel={onUpgradeShopLevel}
            onTransferShopCash={onTransferShopCash}
            onConfigureShop={onConfigureShop}
            onPlaceProcurementOrder={onPlaceProcurementOrder}
            onCancelProcurementOrder={onCancelProcurementOrder}
            onCreatePurchaseContract={onCreatePurchaseContract}
            onExecuteRecipeProduction={onExecuteRecipeProduction}
            onPurchaseLogisticsVehicle={onPurchaseLogisticsVehicle}
            onDispatchWarehouseToShop={onDispatchWarehouseToShop}
            onAcceptCommercialContract={onAcceptCommercialContract}
            onDeliverCommercialContract={onDeliverCommercialContract}
            onIncorporateShopsIntoCompany={onIncorporateShopsIntoCompany}
            onHireShopManager={onHireShopManager}
            onHireFirstEmployee={onHireFirstEmployee}
            onBuyShopUpgrade={onBuyShopUpgrade}
            onFireShopManager={onFireShopManager}
            onSetShopManagerSweep={onSetShopManagerSweep}
          />
        )}

        </div>
      ) : (
        <div className="space-y-3">
          {(state.tradeState?.shops.length ?? 0) > 0 && (
            <CitySwitcher state={state} scope="shops" value={viewCityId} onChange={onChangeViewCity} />
          )}
          <ShopDashboard
            state={state}
            spendableCash={spendableCash}
            formatCurrency={formatCurrency}
            onPlaceProcurementOrder={onPlaceProcurementOrder!}
            onManage={(shopId) => setManaging({ shopId })}
            cityFilter={resolveViewCity(state, viewCityId)}
          />
          {(state.tradeState?.shops.length ?? 0) > 0 && (
            <ExtraUpgrades state={state} onOpenService={onOpenCityService} />
          )}
        </div>
      )}

    </div>
  );
};
