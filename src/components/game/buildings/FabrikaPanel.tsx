/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FABRIKA bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import React, { useState } from 'react';
import {
  Lock,
} from 'lucide-react';

import {
  CompanyEngine,
} from '../../../engine/CompanyEngine';
import {
  EsnafAndTradePanel,
} from '../EsnafAndTradePanel';
import type {
  BuildingDetailContentProps,
} from './buildingTypes';

export const FabrikaPanel: React.FC<BuildingDetailContentProps> = ({
  state,
  spendableCash,
  formatCurrency,
  onOpenBuilding,
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
}) => {
  const [showTrade, setShowTrade] = useState(false);
  const pc = state.playerCompany;
  if (!pc) {
    return (
      <div
        className="space-y-3 text-xs"
        data-testid="sheet-content-FABRIKA-locked"
      >
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Fabrika Bölgesi Kilitli
            </h3>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Fabrika üretim bantlarını çalıştırmak için önce Aşama 2’de (Net
            Varlık ≥ ₺2.000.000) kendi şirketinizi kurmanız gerekmektedir.
          </p>
          {onOpenBuilding && (
            <button
              type="button"
              onClick={() => onOpenBuilding('SIRKET_MERKEZI')}
              className="g-btn g-btn-primary px-4"
            >
              Şirket Arsası Durumunu Gör
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!pc.operations || !pc.workforcePlan) {
    CompanyEngine.ensureCompanyV5Fields(pc, state.macro);
  }
  const ops = pc.operations!;
  const installedCap = Math.max(1, ops.installedCapacity);
  const actualProd = ops.actualProduction;
  const capUtilPct = Number(
    Math.min(100, (actualProd / installedCap) * 100).toFixed(1)
  );
  const intradayPct = Math.min(
    100,
    Math.round((state.intradayStepsProcessedToday / 288) * 100)
  );

  return (
    <div
      className="space-y-4 text-xs"
      data-testid="sheet-content-FABRIKA-active"
    >
      <div className="g-hero p-5 text-center space-y-2">
        <div className="text-sm font-bold text-white/65">Bugünkü üretim</div>
        <div className="text-5xl font-extrabold tabular-nums g-hero-value">
          {actualProd.toFixed(0)}
          <span className="text-2xl text-white/65"> / {installedCap}</span>
        </div>
        <div className="g-track h-3">
          <div
            className="g-fill"
            style={{ width: `${Math.min(100, capUtilPct)}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
        <div className="g-card p-3">
          <div className="text-[13px] text-slate-500">Satılan</div>
          <div className="font-extrabold text-emerald-700">{ops.actualSalesUnits.toFixed(0)}</div>
        </div>
        <div className="g-card p-3">
          <div className="text-[13px] text-slate-500">Stok</div>
          <div className="font-extrabold text-slate-900">{ops.inventoryUnits.toFixed(0)}</div>
        </div>
        <div className="g-card p-3">
          <div className="text-[13px] text-slate-500">Çalışan</div>
          <div className="font-extrabold text-slate-900">{pc.staffCount}</div>
        </div>
      </div>
      <div className="hidden">
        %{intradayPct} · {formatCurrency(ops.salePrice)} · {formatCurrency(ops.unitProductionCost)}
      </div>

      <button
        type="button"
        data-testid="factory-trade-toggle"
        onClick={() => setShowTrade((v) => !v)}
        className="g-btn g-btn-secondary w-full"
      >
        {showTrade ? '▲ Depoyu gizle' : 'Depo, toptan alım ve üretim'}
      </button>

      {/* Merkezi Depolar, Reçete Üretimi, Lojistik Filo ve Tedarik Zinciri */}
      <div className={showTrade ? 'block' : 'hidden'}>
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
            initialSection="TRADE_CENTER"
            onOpenShop={onOpenShop}
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
          />
        )}
      </div>

      {/* Fabrika ekranında tekrarlayan yatırım düğmeleri yerine Şirket Merkezi'ne yönlendirme */}
      {onOpenBuilding && (
        <button
          type="button"
          onClick={() => onOpenBuilding('SIRKET_MERKEZI')}
          className="g-btn g-btn-navy w-full"
        >
          Çalışan ve yatırım: Şirket Merkezi
        </button>
      )}
    </div>
  );
};
