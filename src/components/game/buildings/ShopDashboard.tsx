/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Dükkânım" ekranının sade ana görünümü: her dükkân için tek bir renkli kart.
 * Ayrıntılı yönetim (sipariş, fiyat, personel...) "Yönet" ile eski panelde açılır.
 */

import { liveShopToday } from '../../../engine/ShopSales';
import { shopOpenStatus } from '../../../data/shopHours';
import { Plus, UserCog } from 'lucide-react';
import React, { useMemo } from 'react';
import type { SimulationState } from '../../../models/simulation';
import type { CityId } from '../../../models/cities';
import type { ShopType } from '../../../models/trade';
import { TradeAndShopEngine } from '../../../engine/TradeAndShopEngine';
import { planShopRestock } from '../../../engine/ShopRestockPlanner';
import { FirstShopGateCard } from '../ui/FirstShopGateCard';
import type { EsnafAndTradeActionsProps } from '../EsnafAndTradePanel';
import { SHOP_EMOJI } from '../ui/shopEmoji';
export { SHOP_EMOJI };


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
  /** Seçili şehir (Dükkân sekmesindeki şehir butonu); verilmezse ya da 'ALL' ise bütün dükkânlar. */
  cityFilter?: CityId | 'ALL';
}

export const ShopDashboard: React.FC<ShopDashboardProps> = ({
  state,
  spendableCash,
  formatCurrency,
  onPlaceProcurementOrder,
  onManage,
  cityFilter,
}) => {
  const trade = useMemo(
    () => TradeAndShopEngine.ensureTradeUniverseState(state),
    [state]
  );

  if (trade.shops.length === 0) {
    return <FirstShopGateCard state={state} onOpenShopPicker={() => onManage(null)} />;
  }

  const nowMin = state.minutesIntoCurrentDay ?? 0;
  // Şehir filtresi (Dükkân sekmesindeki şehir butonu): şehri olmayan eski dükkân merkez şehirde sayılır.
  const shops = cityFilter && cityFilter !== 'ALL'
    ? trade.shops.filter((sh) => (sh.cityId ?? state.headquartersCityId) === cityFilter)
    : trade.shops;

  return (
    <div className="space-y-3" data-testid="shop-dashboard">
      {shops.length === 0 && (
        <div data-testid="shop-dashboard-city-empty" className="g-card p-4 text-center text-sm font-bold text-[var(--g-muted)]">
          Bu şehirde henüz dükkânın yok.
        </div>
      )}

      {shops.map((shop, i) => {
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
        const today = liveShopToday(shop, state.day, nowMin);
        const profit = today.profit;
        const openNow = shopOpenStatus(shop.shopType, state.minutesIntoCurrentDay ?? 0);
        return (
          <div
            key={shop.shopId}
            data-testid={`shop-card-${shop.shopId}`}
            className="g-card overflow-hidden"
          >
            <div
              className="g-hero rounded-none rounded-t-[17px] p-3 flex items-center gap-3"
            >
              <span className="w-12 h-12 shrink-0 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-[28px]">{SHOP_EMOJI[shop.shopType] ?? '🏪'}</span>
              <div className="min-w-0 flex-1">
                <div className="g-display font-extrabold text-[17px] leading-tight truncate">{shop.nameTR}</div>
                <div className="text-[13px] font-semibold text-white/65 flex items-center gap-1.5 flex-wrap">
                  <span>Seviye {shop.level}</span>
                  <span aria-hidden>·</span>
                  <span
                    data-testid={`shop-card-hours-${shop.shopId}`}
                    className={`inline-flex items-center gap-1 ${openNow.open ? 'text-[#5ee6a5]' : 'text-white/60'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${openNow.open ? 'bg-[#5ee6a5]' : 'bg-white/40'}`} />
                    {openNow.label}
                  </span>
                </div>
              </div>
              {shop.manager && (
                <span
                  data-testid={`shop-card-manager-badge-${shop.shopId}`}
                  className="g-pill shrink-0 bg-[var(--g-gold)] text-[#5a3a00]"
                >
                  <UserCog className="w-3.5 h-3.5" /> Müdür
                </span>
              )}
            </div>

            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="g-card-soft p-2.5">
                  <div className="text-[13px] text-slate-500">Bugünkü satış</div>
                  <div
                    data-testid={`shop-card-live-revenue-${shop.shopId}`}
                    className="font-extrabold text-slate-900 tabular-nums"
                  >
                    {formatCurrency(today.revenue)}
                  </div>
                </div>
                <div className="g-card-soft p-2.5">
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
              <div
                data-testid={`shop-card-yesterday-${shop.shopId}`}
                className="-mt-1 text-[13px] text-slate-500 tabular-nums"
              >
                Dün: {formatCurrency(shop.todaySalesRevenue)} satış ·{' '}
                <span className={shop.todayNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {shop.todayNetProfit >= 0 ? '+' : ''}
                  {formatCurrency(shop.todayNetProfit)} kâr
                </span>
              </div>

              <div>
                <div className="flex justify-between text-sm font-semibold text-slate-700">
                  <span>Raf doluluğu</span>
                  <span className={low ? 'text-rose-600' : ''}>
                    %{fillPct}
                    {low ? ' · Azalıyor!' : ''}
                  </span>
                </div>
                <div className="mt-1.5 g-track h-3">
                  <div
                    className={low ? 'g-fill g-fill-danger' : 'g-fill'}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </div>

              {shop.manager && (
                <div
                  className={`rounded-xl px-3 py-2 text-[13px] font-bold ${
                    shop.manager.lowCash
                      ? 'bg-[#ffe9e8] text-[var(--g-red-dark)]'
                      : 'bg-[var(--g-surface-2)] text-[var(--g-muted)]'
                  }`}
                >
                  {shop.manager.lowCash
                    ? 'Kasa boş, müdür mal alamıyor. Kasaya para koy.'
                    : `Müdür: ${shop.manager.lastActionTR}`}
                </div>
              )}

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
                  className="g-btn g-btn-primary"
                >
                  Rafları doldur
                </button>
                <button
                  type="button"
                  data-testid={`shop-card-manage-${shop.shopId}`}
                  onClick={() => onManage(shop.shopId)}
                  className="g-btn g-btn-secondary"
                >
                  Yönet
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
        className="w-full min-h-[56px] rounded-[18px] border-2 border-dashed border-[#c8cfdf] bg-white/60 text-[var(--g-navy-600)] font-extrabold active:scale-[.98] inline-flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" strokeWidth={3} /> Yeni dükkân aç
      </button>
    </div>
  );
};
