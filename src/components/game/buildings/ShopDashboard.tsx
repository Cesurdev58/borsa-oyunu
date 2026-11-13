/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Dükkânım" ekranının sade ana görünümü: her dükkân için tek bir renkli kart.
 * Ayrıntılı yönetim (sipariş, fiyat, personel...) "Yönet" ile eski panelde açılır.
 */

import { Check, Plus, UserCog } from 'lucide-react';
import React, { useMemo } from 'react';
import type { SimulationState } from '../../../models/simulation';
import type { ShopType } from '../../../models/trade';
import { SHOP_TEMPLATES, TradeAndShopEngine } from '../../../engine/TradeAndShopEngine';
import { planShopRestock } from '../../../engine/ShopRestockPlanner';
import { FIRST_SHOP_MIN_NET_WORTH } from '../../../data/gameBalance';
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
        className="g-hero p-5 space-y-3"
      >
        <div className="g-display flex items-center gap-3 font-extrabold text-xl leading-tight">
          <span className="w-12 h-12 shrink-0 rounded-2xl bg-white/10 flex items-center justify-center text-[28px]">🏪</span>
          {ready ? 'Hazırsın! İlk dükkânını aç' : 'İlk dükkânına ne kadar kaldı?'}
        </div>
        <div className="g-track h-4">
          <div
            className="g-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-sm font-bold tabular-nums text-white/70">
          <span className="text-[var(--g-gold)]">{formatCurrency(state.netWorth)}</span>
          <span>{formatCurrency(FIRST_SHOP_MIN_NET_WORTH)}</span>
        </div>
        {ready ? (
          <button
            type="button"
            onClick={() => onManage(null)}
            className="g-btn g-btn-gold w-full"
          >
            Dükkân türünü seç
          </button>
        ) : (
          <p className="text-sm font-semibold text-white/70">
            Borsada hisse al-sat, parayı büyüt. Hedefe ulaşınca dükkân kurabilirsin!
          </p>
        )}
      </div>
    );
  }

  // Bugünün görevleri: kayıt tutmadan, dükkânların anlık durumundan türetilir.
  // Müdürlü dükkânların rafını müdür doldurur; görev yalnızca oyuncunun yönettiği dükkânlara bakar.
  const fills = trade.shops.filter((sh) => !sh.manager).map((sh) => {
    const used = sh.inventoryBatches.reduce((a, b) => a + b.quantity, 0);
    return used / Math.max(1, sh.shelfCapacity);
  });
  const shelvesOk = fills.every((f) => f >= 0.5);
  const lowCount = fills.filter((f) => f < 0.5).length;
  const profitOk = trade.shops.some((sh) => sh.todayNetProfit > 0);
  const dailyTasks = [
    {
      id: 'shelves',
      done: shelvesOk,
      text: shelvesOk
        ? 'Raflar yarıdan fazla dolu'
        : `${lowCount} dükkânın rafı yarıdan az dolu — mal al`,
      emoji: '📦',
    },
    {
      id: 'profit',
      done: profitOk,
      text: profitOk ? 'Bugün kâr ettin' : 'Bugün ilk kârını yap — raflar dolu olsun, satış gelsin',
      emoji: '💰',
    },
  ];
  const doneCount = dailyTasks.filter((t) => t.done).length;

  return (
    <div className="space-y-3" data-testid="shop-dashboard">
      <div
        data-testid="daily-tasks-card"
        className="g-card p-3 space-y-2"
      >
        <div className="flex items-center justify-between">
          <span className="g-section-title text-base">Bugünün görevleri</span>
          <span className="g-pill bg-[#e8ecfb] text-[var(--g-navy-600)] tabular-nums">
            {doneCount}/{dailyTasks.length}
          </span>
        </div>
        {dailyTasks.map((t) => (
          <div
            key={t.id}
            data-testid={`daily-task-${t.id}`}
            data-done={t.done ? 'true' : 'false'}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold ${
              t.done ? 'bg-[#ecfaf3] text-[var(--g-green-dark)]' : 'bg-[var(--g-surface-2)] text-[var(--g-ink)]'
            }`}
          >
            <span
              className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${
                t.done ? 'bg-[var(--g-green)] text-white' : 'border-2 border-[#c8cfdf]'
              }`}
            >
              {t.done && <Check className="w-4 h-4" strokeWidth={3.2} />}
            </span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>

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
            className="g-card overflow-hidden"
          >
            <div
              className="g-hero rounded-none rounded-t-[17px] p-3 flex items-center gap-3"
            >
              <span className="w-12 h-12 shrink-0 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-[28px]">{SHOP_EMOJI[shop.shopType] ?? '🏪'}</span>
              <div className="min-w-0 flex-1">
                <div className="g-display font-extrabold text-[17px] leading-tight truncate">{shop.nameTR}</div>
                <div className="text-[13px] font-semibold text-white/65">
                  {tpl?.nameTR ?? shop.shopType} · Seviye {shop.level}
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
                  <div className="font-extrabold text-slate-900 tabular-nums">
                    {formatCurrency(shop.todaySalesRevenue)}
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
