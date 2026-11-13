/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Borsa ekranının alt bölümleri: Varlıklarım, İşlem geçmişi ve Bekleyen emirler
 * (fiyat hedefli / limit emri). Eskiden varlıklar Dükkân ekranında, limit emri
 * "Gelişmiş" düğmesinin arkasındaydı.
 */

import React, { useEffect, useState } from 'react';
import { NumberInput } from '../ui/NumberInput';
import { MarketEngine } from '../../../engine/MarketEngine';
import { TradeAndShopEngine } from '../../../engine/TradeAndShopEngine';
import { PROGRESSION_RULES } from '../../../engine/ProgressionRules';
import { SimulationStage } from '../../../models/simulation';
import type {
  PendingOrderStatus,
  PendingOrderType,
  TransactionType,
} from '../../../models/transactions';
import { SectorIcon } from '../ui/SectorIcon';
import type { BuildingDetailContentProps } from './buildingTypes';

type Props = Pick<
  BuildingDetailContentProps,
  | 'state'
  | 'formatCurrency'
  | 'onSelectTicker'
  | 'onPlaceOrder'
  | 'onCancelOrder'
  | 'spendableCash'
  | 'reservedCash'
  | 'getReservedShares'
>;

const TX_LABEL: Record<TransactionType, string> = {
  BUY: 'Hisse aldın',
  SELL: 'Hisse sattın',
  DIVIDEND: 'Temettü geldi',
  CAPITAL_INJECTION: 'Şirkete para koydun',
  COMPANY_FOUNDING: 'Şirket kurdun',
  COMPANY_LOAN: 'Şirkete borç',
  IPO_PROCEEDS: 'Halka arz geliri',
  TAKEOVER_TENDER: 'Şirket devraldın',
  HOLDING_SYNERGY: 'Holding kazancı',
};

const ORDER_LABEL: Record<PendingOrderType, string> = {
  MARKET_BUY: 'Açılışta al',
  MARKET_SELL: 'Açılışta sat',
  LIMIT_BUY: 'Hedef fiyattan al',
  LIMIT_SELL: 'Hedef fiyattan sat',
};

const STATUS_LABEL: Record<PendingOrderStatus, string> = {
  PENDING: 'Bekliyor',
  PARTIALLY_FILLED: 'Bir kısmı oldu',
  FILLED: 'Gerçekleşti',
  CANCELLED: 'İptal',
  EXPIRED: 'Süresi doldu',
  REJECTED: 'Olmadı',
};

const isOpenOrder = (s: PendingOrderStatus) =>
  s === 'PENDING' || s === 'PARTIALLY_FILLED';

/* ------------------------------------------------------------------ */
/* Varlıklarım                                                         */
/* ------------------------------------------------------------------ */

export const AssetsSection: React.FC<
  Pick<Props, 'state' | 'formatCurrency' | 'onSelectTicker'>
> = ({ state, formatCurrency, onSelectTicker }) => {
  const positions = Object.values(state.portfolio).filter((p) => p.shares > 0);
  const nonIncorpShopEquity =
    TradeAndShopEngine.computeNonIncorporatedShopsEquity(state);
  const businessEquity =
    (state.playerCompany && !state.playerCompany.isPubliclyListed
      ? state.playerCompany.equityValue
      : 0) + nonIncorpShopEquity;

  let totalPnl = 0;
  const rows = positions.map((pos) => {
    const st = state.stocks.find((s) => s.ticker === pos.ticker);
    const price = st ? st.price : pos.averageCost;
    const value = pos.shares * price;
    const pnl = value - pos.shares * pos.averageCost;
    totalPnl += pnl;
    const pct = pos.averageCost > 0 ? (price / pos.averageCost - 1) * 100 : 0;
    return { pos, st, price, value, pnl, pct };
  });
  rows.sort((a, b) => b.value - a.value);

  const stages = [
    {
      stage: SimulationStage.STAGE_1_RETAIL_INVESTOR,
      title: 'Yatırımcı',
      unlocked: state.stageUnlocks.stage1Retail,
      req: 'Başlangıç',
    },
    {
      stage: SimulationStage.STAGE_2_ENTREPRENEUR,
      title: 'Girişimci',
      unlocked: state.stageUnlocks.stage2Entrepreneur,
      req: `${formatCurrency(PROGRESSION_RULES.entrepreneurNetWorth)} varlık`,
    },
    {
      stage: SimulationStage.STAGE_3_IPO_PUBLIC,
      title: 'Halka arz',
      unlocked: state.stageUnlocks.stage3Ipo,
      req: 'Büyük ve düzenli şirket',
    },
    {
      stage: SimulationStage.STAGE_4_HOLDING_MONOPOLY,
      title: 'Holding',
      unlocked: state.stageUnlocks.stage4Holding,
      req: `Rakipte %${PROGRESSION_RULES.holdingStakeOwnershipPct}+ pay`,
    },
  ];

  return (
    <div className="space-y-3" data-testid="borsa-assets-section">
      <div className="g-card p-4">
        <div className="text-[13px] font-bold text-[var(--g-muted)]">
          Toplam varlığım
        </div>
        <div className="g-display text-[30px] leading-tight font-extrabold text-[var(--g-ink)] tabular-nums">
          {formatCurrency(state.netWorth)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] tabular-nums">
          <div className="g-card-soft p-2.5">
            <div className="text-[var(--g-muted)] font-bold">Nakit</div>
            <div className="text-sm font-extrabold">{formatCurrency(state.cash)}</div>
          </div>
          <div className="g-card-soft p-2.5">
            <div className="text-[var(--g-muted)] font-bold">Hisselerim</div>
            <div className="text-sm font-extrabold">
              {formatCurrency(state.portfolioValue)}
            </div>
          </div>
          <div className="g-card-soft p-2.5">
            <div className="text-[var(--g-muted)] font-bold">Dükkân ve şirket</div>
            <div className="text-sm font-extrabold">
              {formatCurrency(businessEquity)}
            </div>
          </div>
          <div className="g-card-soft p-2.5">
            <div className="text-[var(--g-muted)] font-bold">Borcum</div>
            <div
              className={`text-sm font-extrabold ${
                state.totalDebt > 0 ? 'text-[var(--g-red)]' : ''
              }`}
            >
              {formatCurrency(state.totalDebt)}
            </div>
          </div>
        </div>
        {state.totalDividendsEarned + state.totalSynergyEarned > 0 && (
          <div className="mt-2 text-[13px] text-[var(--g-muted)]">
            Bugüne kadar gelen temettü ve holding kazancı:{' '}
            <b className="text-[var(--g-green-dark)]">
              {formatCurrency(
                state.totalDividendsEarned + state.totalSynergyEarned
              )}
            </b>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="g-section-title">Hisselerim ({rows.length})</h3>
          {rows.length > 0 && (
            <span
              className={`text-[13px] font-extrabold tabular-nums ${
                totalPnl >= 0 ? 'text-[var(--g-green-dark)]' : 'text-[var(--g-red)]'
              }`}
            >
              {totalPnl >= 0 ? '+' : ''}
              {formatCurrency(totalPnl)}
            </span>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="g-card-soft p-3 text-center text-[var(--g-muted)]">
            Henüz hissen yok. Aşağıdan bir hisse seçip AL'a bas.
          </div>
        ) : (
          rows.map(({ pos, st, price, value, pnl, pct }) => (
            <button
              key={pos.ticker}
              type="button"
              data-testid={`portfolio-pos-${pos.ticker}`}
              onClick={() => onSelectTicker(pos.ticker)}
              className="g-card w-full p-3 flex items-center gap-3 text-left active:scale-[0.99]"
            >
              {st && <SectorIcon sector={st.sector} />}
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-sm text-[var(--g-ink)]">
                  {pos.ticker} · {pos.shares} lot
                </div>
                <div className="text-[13px] text-[var(--g-muted)] tabular-nums">
                  Aldığın {pos.averageCost.toFixed(2)} ₺ · şimdi {price.toFixed(2)} ₺
                </div>
              </div>
              <div className="text-right tabular-nums shrink-0">
                <div className="text-sm font-extrabold">{formatCurrency(value)}</div>
                <div
                  className={`text-[13px] font-bold ${
                    pnl >= 0 ? 'text-[var(--g-green-dark)]' : 'text-[var(--g-red)]'
                  }`}
                >
                  {pnl >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(pnl))} (
                  {Math.abs(pct).toFixed(1)}%)
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="space-y-2">
        <h3 className="g-section-title">Kariyerim</h3>
        <div className="grid grid-cols-2 gap-2">
          {stages.map((s) => (
            <div
              key={s.stage}
              className={`p-2.5 rounded-xl border text-[13px] ${
                s.unlocked
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'g-card-soft text-[var(--g-muted)]'
              }`}
            >
              <div className="flex items-center justify-between font-extrabold">
                <span>{s.title}</span>
                <span>{s.unlocked ? 'Açık' : 'Kilitli'}</span>
              </div>
              <div className="mt-0.5 opacity-80">{s.req}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* İşlem geçmişi                                                       */
/* ------------------------------------------------------------------ */

export const HistorySection: React.FC<Pick<Props, 'state' | 'formatCurrency'>> = ({
  state,
  formatCurrency,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'TRADE' | 'OTHER'>('ALL');
  const [limit, setLimit] = useState(20);
  const all = state.transactions;
  const list = all.filter((tx) =>
    filter === 'ALL'
      ? true
      : filter === 'TRADE'
      ? tx.type === 'BUY' || tx.type === 'SELL'
      : tx.type !== 'BUY' && tx.type !== 'SELL'
  );

  return (
    <div className="space-y-2" data-testid="borsa-history-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="g-section-title">İşlem geçmişim ({all.length})</h3>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            ['ALL', 'Hepsi'],
            ['TRADE', 'Alış-satış'],
            ['OTHER', 'Diğer'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-testid={`history-filter-${id}`}
            onClick={() => setFilter(id)}
            className={`g-choice min-h-[40px] text-[13px] font-bold ${
              filter === id ? 'is-active' : ''
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="g-card-soft p-3 text-center text-[var(--g-muted)]">
          Henüz işlem yok.
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.slice(0, limit).map((tx) => {
            const isTrade = (tx.type === 'BUY' || tx.type === 'SELL') && tx.ticker;
            return (
              <div
                key={tx.id}
                className="g-card p-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-extrabold text-[var(--g-ink)] truncate">
                    {TX_LABEL[tx.type] ?? tx.description}
                    {isTrade ? ` · ${tx.ticker}` : ''}
                  </div>
                  <div className="text-[13px] text-[var(--g-muted)] tabular-nums truncate">
                    {tx.day}. gün
                    {isTrade && tx.shares
                      ? ` · ${tx.shares} lot × ${(tx.executionPrice ?? 0).toFixed(2)} ₺`
                      : ` · ${tx.description}`}
                  </div>
                </div>
                <span
                  className={`tabular-nums font-extrabold shrink-0 ${
                    tx.cashDelta >= 0 ? 'text-[var(--g-green-dark)]' : 'text-[var(--g-red)]'
                  }`}
                >
                  {tx.cashDelta >= 0 ? '+' : ''}
                  {formatCurrency(tx.cashDelta)}
                </span>
              </div>
            );
          })}
          {list.length > limit && (
            <button
              type="button"
              data-testid="history-more-btn"
              onClick={() => setLimit((l) => l + 30)}
              className="g-btn g-btn-ghost w-full"
            >
              Daha eski işlemler
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Bekleyen emirler (fiyat hedefli emir)                               */
/* ------------------------------------------------------------------ */

export const OrdersSection: React.FC<
  Props & { ticker: string }
> = ({
  state,
  ticker,
  formatCurrency,
  onPlaceOrder,
  onCancelOrder,
  spendableCash,
  reservedCash,
  getReservedShares,
}) => {
  const stock = state.stocks.find((s) => s.ticker === ticker) || state.stocks[0];
  const [lots, setLots] = useState(50);
  const [target, setTarget] = useState<number>(Number(stock.price.toFixed(2)));
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    setTarget(Number(stock.price.toFixed(2)));
  }, [stock.ticker]);

  const owned = state.portfolio[stock.ticker]?.shares || 0;
  const sellable = Math.max(0, owned - getReservedShares(stock.ticker));
  const maxBuy = Math.min(
    MarketEngine.maxMarketBuyableShares(stock, owned),
    Math.max(0, Math.floor(spendableCash / (Math.max(0.1, target) * 1.002)))
  );

  const openOrders = state.pendingOrders.filter((o) => isOpenOrder(o.status));
  const doneOrders = state.pendingOrders.filter((o) => !isOpenOrder(o.status));

  const nudge = (pct: number) =>
    setTarget(Number(Math.max(0.1, stock.price * (1 + pct / 100)).toFixed(2)));

  const orderRow = (ord: (typeof state.pendingOrders)[number]) => (
    <div
      key={ord.id}
      data-testid={`tycoon-order-row-${ord.id}`}
      className="g-card p-2.5 flex items-center justify-between gap-2"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-extrabold text-[var(--g-ink)]">{ord.ticker}</span>
          <span
            className={`text-[13px] font-bold ${
              ord.side === 'BUY' ? 'text-[var(--g-green-dark)]' : 'text-[var(--g-red)]'
            }`}
          >
            {ORDER_LABEL[ord.orderType]}
          </span>
          <span
            data-testid={`tycoon-order-status-${ord.id}`}
            className={`g-pill text-[13px] ${
              ord.status === 'FILLED'
                ? 'bg-emerald-100 text-emerald-800'
                : isOpenOrder(ord.status)
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {STATUS_LABEL[ord.status]}
          </span>
        </div>
        <div className="text-[13px] text-[var(--g-muted)] tabular-nums mt-0.5">
          {ord.executedShares > 0 && ord.executedShares < ord.requestedShares
            ? `${ord.executedShares}/${ord.requestedShares} lot`
            : `${ord.requestedShares} lot`}
          {ord.limitPrice ? ` · hedef ${ord.limitPrice.toFixed(2)} ₺` : ''}
          {ord.averageExecutionPrice > 0
            ? ` · ${ord.averageExecutionPrice.toFixed(2)} ₺'dan oldu`
            : ''}
          {isOpenOrder(ord.status) && ord.reservedCash > 0
            ? ` · ayrılan ${formatCurrency(ord.reservedCash)}`
            : ''}
        </div>
      </div>
      {isOpenOrder(ord.status) && (
        <button
          type="button"
          onClick={() => onCancelOrder(ord.id)}
          className="g-btn g-btn-secondary g-btn-sm shrink-0 text-[var(--g-red)]"
        >
          İptal
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-3" data-testid="borsa-orders-section">
      <div className="g-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="g-section-title">Hedef fiyatla emir</h3>
          <span className="text-[13px] font-bold text-[var(--g-muted)] tabular-nums">
            {stock.ticker} şimdi {stock.price.toFixed(2)} ₺
          </span>
        </div>
        <div className="g-tip">
          Fiyat yazdığın yere gelince hisse kendiliğinden alınır ya da satılır.
          Sen oyunda olmasan da çalışır.
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-[13px] font-bold text-[var(--g-muted)] mb-1">
              Kaç lot?
            </span>
            <NumberInput
              id="tycoon-lot-input"
              data-testid="tycoon-lot-input"
              min={1}
              step={1}
              value={lots}
              onChange={(e) =>
                setLots(Math.max(1, Math.floor(Number(e.target.value) || 1)))
              }
              className="g-input w-full text-center text-lg font-extrabold tabular-nums"
            />
          </label>
          <label className="block">
            <span className="block text-[13px] font-bold text-[var(--g-muted)] mb-1">
              Hedef fiyat (₺)
            </span>
            <NumberInput
              id="tycoon-limit-price-input"
              data-testid="tycoon-limit-price-input"
              min={0.1}
              step={0.1}
              value={target}
              onChange={(e) => setTarget(Math.max(0.1, Number(e.target.value) || 0.1))}
              className="g-input w-full text-center text-lg font-extrabold tabular-nums"
            />
          </label>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {[-5, -2, 0, 2, 5].map((p) => (
            <button
              key={p}
              type="button"
              data-testid={`limit-nudge-${p}`}
              onClick={() => nudge(p)}
              className="g-choice min-h-[40px] text-[13px] font-bold tabular-nums"
            >
              {p === 0 ? 'Şimdi' : `${p > 0 ? '+' : '−'}%${Math.abs(p)}`}
            </button>
          ))}
        </div>
        <div className="text-[13px] text-[var(--g-muted)] tabular-nums">
          Alabileceğin en çok: {maxBuy} lot · satabileceğin: {sellable} lot
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="tycoon-place-buy-order-btn"
            disabled={lots > maxBuy || maxBuy <= 0}
            onClick={() =>
              onPlaceOrder({
                ticker: stock.ticker,
                orderType: 'LIMIT_BUY',
                requestedShares: lots,
                limitPrice: target,
              })
            }
            className="g-btn g-btn-primary"
          >
            Bu fiyata inince AL
          </button>
          <button
            type="button"
            data-testid="tycoon-place-sell-order-btn"
            disabled={sellable <= 0}
            onClick={() =>
              onPlaceOrder({
                ticker: stock.ticker,
                orderType: 'LIMIT_SELL',
                requestedShares: Math.min(lots, sellable),
                limitPrice: target,
              })
            }
            className="g-btn g-btn-danger"
          >
            Bu fiyata çıkınca SAT
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="g-section-title">Bekleyen emirlerim ({openOrders.length})</h3>
          {reservedCash > 0 && (
            <span className="text-[13px] text-[var(--g-muted)] tabular-nums">
              Ayrılan para: {formatCurrency(reservedCash)}
            </span>
          )}
        </div>
        {openOrders.length === 0 ? (
          <div className="g-card-soft p-3 text-center text-[var(--g-muted)]">
            Bekleyen emrin yok.
          </div>
        ) : (
          <div className="space-y-1.5">{openOrders.map(orderRow)}</div>
        )}
        {doneOrders.length > 0 && (
          <>
            <button
              type="button"
              data-testid="orders-done-toggle"
              onClick={() => setShowDone((v) => !v)}
              className="g-btn g-btn-ghost w-full"
            >
              {showDone
                ? 'Sonuçlanan emirleri gizle'
                : `Sonuçlanan emirler (${doneOrders.length})`}
            </button>
            <div className={showDone ? 'space-y-1.5' : 'hidden'}>
              {doneOrders.slice(0, 15).map(orderRow)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
