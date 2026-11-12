/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Dükkânım" ekranının sade ana görünümü: her dükkân için tek bir renkli kart.
 * Ayrıntılı yönetim (sipariş, fiyat, personel...) "Yönet" ile eski panelde açılır.
 */

import React, { useMemo } from 'react';
import type { SimulationState } from '../../../models/simulation';
import type { ShopType } from '../../../models/trade';
import { SHOP_TEMPLATES, TradeAndShopEngine } from '../../../engine/TradeAndShopEngine';
import { planShopRestock } from '../../../engine/ShopRestockPlanner';
import { FIRST_SHOP_MIN_NET_WORTH } from '../../../data/gameBalance';
import type { EsnafAndTradeActionsProps } from '../EsnafAndTradePanel';

export const SHOP_EMOJI: Record<ShopType, string> = {
  BUFE: '🥪',
  MANAV: '🥦',
  KAFE: '☕',
  GIYIM_MAGAZASI: '👗',
  ELEKTRONIK_MAGAZASI: '📱',
  MOBILYA_MAGAZASI: '🛋️',
  MARKET: '🛒',
  OTOMOBIL_GALERISI: '🚗',
};

const CARD_TONES = [
  'from-orange-400 to-rose-400',
  'from-sky-400 to-indigo-400',
  'from-emerald-400 to-teal-500',
  'from-fuchsia-400 to-purple-500',
];

interface ShopDashboardProps {
  state: SimulationState;
  spendableCash: number;
  formatCurrency: (v: number) => string;
  onPlaceProcurementOrder: EsnafAndTradeActionsProps['onPlaceProcurementOrder'];
  onManage: (shopId: string | null) => void;
}

export const ShopDashboard: React.FC<ShopDashboardProps> = ({
  state,
  spendableCash,
  formatCurrency,
  onPlaceProcurementOrder,
  onManage,
}) => {
  const trade = useMemo(
    () => TradeAndShopEngine.ensureTradeUniverseState(state),
    [state]
  );

  if (trade.shops.length === 0) {
    const pct = Math.min(
      100,
      Math.floor((state.netWorth / FIRST_SHOP_MIN_NET_WORTH) * 100)
    );
    const ready = state.netWorth >= FIRST_SHOP_MIN_NET_WORTH;
    return (
      <div
        data-testid="first-shop-progress"
        className="p-4 rounded-3xl bg-gradient-to-br from-amber-300 via-orange-300 to-rose-300 text-amber-950 shadow-md space-y-3"
      >
        <div className="flex items-center gap-2 font-extrabold text-base">
          <span className="text-3xl">🏪</span>
          {ready ? 'Hazırsın! İlk dükkânını aç' : 'İlk dükkânına ne kadar kaldı?'}
        </div>
        <div className="w-full h-4 bg-white/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-sm font-bold tabular-nums">
          <span>{formatCurrency(state.netWorth)}</span>
          <span>🎯 {formatCurrency(FIRST_SHOP_MIN_NET_WORTH)}</span>
        </div>
        {ready ? (
          <button
            type="button"
            onClick={() => onManage(null)}
            className="w-full min-h-[48px] rounded-2xl bg-white text-orange-700 font-extrabold shadow active:scale-95"
          >
            🏪 Dükkân türünü seç
          </button>
        ) : (
          <p className="text-sm font-semibold">
            Borsada hisse al-sat, parayı büyüt. Hedefe ulaşınca dükkân kurabilirsin!
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="shop-dashboard">
      {trade.shops.map((shop, i) => {
        const tpl = SHOP_TEMPLATES[shop.shopType];
        const used = shop.inventoryBatches.reduce((s, b) => s + b.quantity, 0);
        const fillPct = Math.min(
          100,
          Math.round((used / Math.max(1, shop.shelfCapacity)) * 100)
        );
        const low = fillPct < 25;
        const plan = planShopRestock(
          state,
          shop.shopId,
          spendableCash + shop.cashAccountBalance
        );
        const profit = shop.todayNetProfit;
        return (
          <div
            key={shop.shopId}
            data-testid={`shop-card-${shop.shopId}`}
            className="rounded-3xl overflow-hidden shadow-md bg-white border border-slate-100"
          >
            <div
              className={`p-3 bg-gradient-to-r ${CARD_TONES[i % CARD_TONES.length]} text-white flex items-center gap-3`}
            >
              <span className="text-4xl">{SHOP_EMOJI[shop.shopType] ?? '🏪'}</span>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-base truncate">{shop.nameTR}</div>
                <div className="text-sm opacity-95">
                  {tpl?.nameTR ?? shop.shopType} · Seviye {shop.level}
                </div>
              </div>
            </div>

            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-slate-50 p-2.5">
                  <div className="text-[13px] text-slate-500">Bugünkü satış</div>
                  <div className="font-extrabold text-slate-900 tabular-nums">
                    {formatCurrency(shop.todaySalesRevenue)}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-2.5">
                  <div className="text-[13px] text-slate-500">Bugünkü kâr</div>
                  <div
                    className={`font-extrabold tabular-nums ${
                      profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {profit >= 0 ? '+' : ''}
                    {formatCurrency(profit)}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm font-semibold text-slate-700">
                  <span>📦 Raf doluluğu</span>
                  <span className={low ? 'text-rose-600' : ''}>
                    %{fillPct}
                    {low ? ' · Azalıyor!' : ''}
                  </span>
                </div>
                <div className="mt-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      low
                        ? 'bg-gradient-to-r from-rose-400 to-rose-500'
                        : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                    }`}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid={`shop-card-restock-${shop.shopId}`}
                  disabled={plan.orders.length === 0}
                  onClick={() => {
                    for (const o of plan.orders) {
                      onPlaceProcurementOrder({
                        supplierId: o.supplierId,
                        resourceId: o.resourceId,
                        quantity: o.quantity,
                        destinationType: 'SHOP',
                        destinationId: shop.shopId,
                        paymentTermType: 'CASH',
                      });
                    }
                  }}
                  className="min-h-[48px] rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white font-extrabold shadow active:scale-95"
                >
                  🛒 Rafları doldur
                </button>
                <button
                  type="button"
                  data-testid={`shop-card-manage-${shop.shopId}`}
                  onClick={() => onManage(shop.shopId)}
                  className="min-h-[48px] rounded-2xl bg-slate-100 text-slate-800 font-extrabold active:scale-95"
                >
                  ⚙️ Yönet
                </button>
              </div>
              {plan.orders.length > 0 && (
                <div className="text-[13px] text-slate-500 text-center">
                  Yaklaşık {formatCurrency(plan.totalCost)}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        data-testid="shop-dashboard-add"
        onClick={() => onManage(null)}
        className="w-full min-h-[52px] rounded-3xl border-2 border-dashed border-emerald-400 bg-emerald-50 text-emerald-700 font-extrabold active:scale-95"
      >
        ➕ Yeni dükkân aç
      </button>
    </div>
  );
};
