/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FABRIKA bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import React from 'react';
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
              className="min-h-[44px] px-4 rounded-xl bg-teal-600 text-white font-bold"
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums tabular-nums">
        <div className="p-3 rounded-2xl bg-white border border-slate-200">
          <div className="text-[13px] font-sans text-slate-500">
            Bugünkü Üretim / En Fazla Üretim
          </div>
          <div className="text-sm font-bold text-slate-900 mt-0.5">
            {actualProd.toFixed(0)} / {installedCap} birim
          </div>
          <div className="text-[13px] font-sans text-slate-500">
            Kapasite kullanımı: %{capUtilPct.toString().replace('.', ',')}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-200">
          <div className="text-[13px] font-sans text-slate-500">
            Kullanılabilir Kapasite
          </div>
          <div className="text-sm font-bold text-slate-900 mt-0.5">
            {ops.effectiveCapacity.toFixed(0)} birim/gün
          </div>
          <div className="text-[13px] font-sans text-slate-500">
            Makine Durumu: %{(ops.machineAvailability * 100).toFixed(0)}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-200">
          <div className="text-[13px] font-sans text-slate-500">
            Bugünkü Satış & Satış Fırsatı
          </div>
          <div className="text-sm font-bold text-emerald-700 mt-0.5">
            {ops.actualSalesUnits.toFixed(0)} birim
          </div>
          <div className="text-[13px] font-sans text-slate-500">
            Satış Fırsatı: {ops.marketDemand.toFixed(0)} birim
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-200">
          <div className="text-[13px] font-sans text-slate-500">
            Depo Stok Durumu
          </div>
          <div className="text-sm font-bold text-slate-900 mt-0.5">
            {ops.inventoryUnits.toFixed(0)} /{' '}
            {ops.maximumStorageUnits.toFixed(0)} birim
          </div>
          <div className="text-[13px] font-sans text-slate-500">
            Çalışan: {pc.staffCount} kişi
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2">
        <div className="flex justify-between font-semibold text-slate-800">
          <span>Gün İçi Vardiya Üretim İlerlemesi</span>
          <span className="tabular-nums">%{intradayPct}</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${intradayPct}%` }}
          />
        </div>
        <div className="text-[13px] text-slate-600 tabular-nums">
          Birim Satış Fiyatı: {formatCurrency(ops.salePrice)} · Birim Üretim
          Maliyeti: {formatCurrency(ops.unitProductionCost)}
        </div>
      </div>

      {/* Merkezi Depolar, Reçete Üretimi, Lojistik Filo ve Tedarik Zinciri */}
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

      {/* Fabrika ekranında tekrarlayan yatırım düğmeleri yerine Şirket Merkezi'ne yönlendirme */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold text-slate-900">
            Üretim Planı, Çalışan Alımı ve Tesis Yatırımları
          </div>
          <div className="text-[13px] text-slate-600">
            Çalışan alımı, üretim hedefi ve yeni tesis yatırımları Şirket
            Merkezi’nde tek yerden yönetilir.
          </div>
        </div>
        {onOpenBuilding && (
          <button
            type="button"
            onClick={() => onOpenBuilding('SIRKET_MERKEZI')}
            className="min-h-[40px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
          >
            Şirket Merkezi’ni Aç
          </button>
        )}
      </div>
    </div>
  );
};
