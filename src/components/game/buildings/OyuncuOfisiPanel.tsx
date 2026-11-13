/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OYUNCU_OFISI bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import React, { useState } from 'react';
import {
  EsnafAndTradePanel,
} from '../EsnafAndTradePanel';
import type {
  BuildingDetailContentProps,
} from './buildingTypes';
import { ShopDashboard } from './ShopDashboard';

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
  onFireShopManager,
  onSetShopManagerSweep,
}) => {
  const [managing, setManaging] = useState<{ shopId: string | null } | null>(
    null
  );

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
            onFireShopManager={onFireShopManager}
            onSetShopManagerSweep={onSetShopManagerSweep}
          />
        )}

        </div>
      ) : (
        <ShopDashboard
          state={state}
          spendableCash={spendableCash}
          formatCurrency={formatCurrency}
          onPlaceProcurementOrder={onPlaceProcurementOrder!}
          onManage={(shopId) => setManaging({ shopId })}
        />
      )}

    </div>
  );
};
