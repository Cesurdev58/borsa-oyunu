/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OYUNCU_OFISI bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import React, { useState } from 'react';
import {
  SimulationStage,
} from '../../../models/simulation';

import {
  TradeAndShopEngine,
} from '../../../engine/TradeAndShopEngine';
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
  const [showAssets, setShowAssets] = useState(false);
  const positions = Object.values(state.portfolio).filter(
    (p) => p.shares > 0
  );
  const nonIncorpShopEquity =
    TradeAndShopEngine.computeNonIncorporatedShopsEquity(state);
  const privateCompanyEquity = Number(
    (
      (state.playerCompany && !state.playerCompany.isPubliclyListed
        ? state.playerCompany.equityValue
        : 0) + nonIncorpShopEquity
    ).toFixed(2)
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

      <button
        type="button"
        data-testid="assets-toggle"
        onClick={() => setShowAssets((v) => !v)}
        className="g-btn g-btn-ghost w-full"
      >
        {showAssets ? '▲ Varlıklarımı gizle' : 'Varlıklarım ve işlem geçmişi'}
      </button>
      {(
        <div className={showAssets ? 'space-y-4' : 'hidden'}>
      {/* Net Varlık Denklemi Özeti */}
      <div className="g-card p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-[var(--g-ink)]">
            Toplam Net Varlık Bilançosu
          </span>
          <span className="text-base font-bold tabular-nums tabular-nums text-emerald-700">
            {formatCurrency(state.netWorth)}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[13px] tabular-nums tabular-nums">
          <div className="g-card-soft p-2">
            <div className="text-slate-500">Nakit</div>
            <div className="font-bold text-slate-900">
              {formatCurrency(state.cash)}
            </div>
          </div>
          <div className="g-card-soft p-2">
            <div className="text-slate-500">Portföy Değeri</div>
            <div className="font-bold text-sky-700">
              {formatCurrency(state.portfolioValue)}
            </div>
          </div>
          <div className="g-card-soft p-2">
            <div className="text-slate-500">İşletme & Şirket</div>
            <div className="font-bold text-teal-700">
              {formatCurrency(privateCompanyEquity)}
            </div>
          </div>
          <div className="g-card-soft p-2">
            <div className="text-slate-500">Temettü + Sinerji</div>
            <div className="font-bold text-amber-700">
              {formatCurrency(
                state.totalDividendsEarned + state.totalSynergyEarned
              )}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-white border border-slate-200 col-span-2 sm:col-span-1">
            <div className="text-slate-500">Toplam Borç (-)</div>
            <div className="font-bold text-rose-700">
              {formatCurrency(state.totalDebt)}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Aşama İlerleme Kartları */}
      <div className="space-y-1.5">
        <h3 className="font-bold text-slate-900">
          Simülasyon Aşama İlerlemesi (Mevcut: Aşama {state.stage})
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              stage: SimulationStage.STAGE_1_RETAIL_INVESTOR,
              title: '1. Bireysel Yatırımcı',
              unlocked: state.stageUnlocks.stage1Retail,
              req: '100.000 TL Başlangıç',
            },
            {
              stage: SimulationStage.STAGE_2_ENTREPRENEUR,
              title: '2. Girişimci',
              unlocked: state.stageUnlocks.stage2Entrepreneur,
              req: '2.000.000 TL Net Varlık',
            },
            {
              stage: SimulationStage.STAGE_3_IPO_PUBLIC,
              title: '3. Halka Arz (IPO)',
              unlocked: state.stageUnlocks.stage3Ipo,
              req: 'Şirket Ciro & Yönetişim Şartı',
            },
            {
              stage: SimulationStage.STAGE_4_HOLDING_MONOPOLY,
              title: '4. Holding & Tekel',
              unlocked: state.stageUnlocks.stage4Holding,
              req: '%5+ Pay veya %51+ Devralma',
            },
          ].map((item) => (
            <div
              key={item.stage}
              className={`p-2.5 rounded-xl border ${
                item.unlocked
                  ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>{item.title}</span>
                <span className="text-[13px] tabular-nums">
                  {item.unlocked ? 'AÇIK' : 'KİLİTLİ'}
                </span>
              </div>
              <div className="text-[13px] mt-0.5 opacity-80">{item.req}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Açık Portföy Pozisyonları */}
      <div className="space-y-2">
        <h3 className="font-bold text-slate-900">
          Hisse Senedi Portföyü ({positions.length} Pozisyon)
        </h3>
        {positions.length === 0 ? (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-center">
            Portföyünüzde henüz hisse senedi bulunmuyor.
          </div>
        ) : (
          <div className="space-y-2">
            {positions.map((pos) => {
              const st = state.stocks.find((s) => s.ticker === pos.ticker);
              const curPrice = st ? st.price : pos.averageCost;
              const mktVal = pos.shares * curPrice;
              const costVal = pos.shares * pos.averageCost;
              const pnl = mktVal - costVal;
              return (
                <div
                  key={pos.ticker}
                  data-testid={`portfolio-pos-${pos.ticker}`}
                  className="g-card p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="tabular-nums font-bold text-slate-900">
                      {pos.ticker} · {pos.shares} Lot
                    </div>
                    <div className="text-[13px] text-slate-500 tabular-nums">
                      Ort. Maliyet: {pos.averageCost.toFixed(2)} TL · Güncel:{' '}
                      {curPrice.toFixed(2)} TL
                    </div>
                  </div>
                  <div className="text-right tabular-nums tabular-nums">
                    <div className="font-bold text-slate-900">
                      {formatCurrency(mktVal)}
                    </div>
                    <div
                      className={`text-[13px] font-semibold ${
                        pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {pnl >= 0 ? '+' : ''}
                      {formatCurrency(pnl)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Son İşlem Geçmişi */}
      <div className="space-y-2">
        <h3 className="font-bold text-slate-900">
          Son İşlem Geçmişi ({state.transactions.length})
        </h3>
        {state.transactions.length === 0 ? (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-center">
            Henüz gerçekleşmiş işlem bulunmuyor.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {state.transactions.slice(0, 20).map((tx) => (
              <div
                key={tx.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">
                    {tx.description}
                  </div>
                  <div className="text-[13px] tabular-nums text-slate-500">
                    Gün {tx.day} · {tx.type}
                  </div>
                </div>
                <span
                  className={`tabular-nums font-bold shrink-0 ${
                    tx.cashDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {tx.cashDelta >= 0 ? '+' : ''}
                  {formatCurrency(tx.cashDelta)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
};
