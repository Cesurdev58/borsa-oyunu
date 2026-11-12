/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BORSA bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import React, {
  useEffect,
  useState,
} from 'react';
import {
  SECTOR_CONFIGS,
} from '../../../data/sectors';
import {
  SectorId,
} from '../../../models/market';
import {
  getMarketSessionBadgeMeta,
} from '../gameTypes';

import type {
  BuildingDetailContentProps,
} from './buildingTypes';

export const BorsaPanel: React.FC<BuildingDetailContentProps> = ({
  state,
  selectedTicker,
  onSelectTicker,
  onPlaceOrder,
  onCancelOrder,
  onBuyStock,
  onSellStock,
  spendableCash,
  reservedCash,
  getReservedShares,
  formattedTime,
  formatCurrency,
}) => {
  const [sectorFilter, setSectorFilter] = useState<SectorId | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [lotAmount, setLotAmount] = useState<number>(50);
  const [orderMode, setOrderMode] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [limitPriceInput, setLimitPriceInput] = useState<number>(124.5);

  const selectedStock =
    state.stocks.find((s) => s.ticker === selectedTicker) || state.stocks[0];

  useEffect(() => {
    if (selectedStock) {
      setLimitPriceInput(Number(selectedStock.askPrice.toFixed(2)));
    }
  }, [selectedStock?.ticker]);

  const sessionMeta = getMarketSessionBadgeMeta(state.marketSession);

  // 1. BORSA BİNASI

  const filteredStocks = state.stocks.filter((s) => {
    const matchSector =
      sectorFilter === 'ALL' || s.sector === sectorFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      s.ticker.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q);
    return matchSector && matchSearch;
  });

  const ownedShares = state.portfolio[selectedStock.ticker]?.shares || 0;
  const reservedShares = getReservedShares(selectedStock.ticker);
  const availableSharesToSell = Math.max(0, ownedShares - reservedShares);
  const maxAffordableLots = Math.max(
    0,
    Math.floor(
      spendableCash /
        ((orderMode === 'LIMIT' && limitPriceInput > 0
          ? limitPriceInput
          : selectedStock.askPrice) *
          1.002)
    )
  );

  return (
    <div className="space-y-4 text-xs" data-testid="sheet-content-BORSA">
      {/* Piyasa Seansı ve Bakiye Özeti */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-md border font-semibold ${sessionMeta.bgClass} ${sessionMeta.textClass} ${sessionMeta.borderClass}`}
          >
            {sessionMeta.fullLabel}
          </span>
          <span className="font-mono text-slate-600">
            Saat: {formattedTime}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono tabular-nums">
          <span className="text-slate-600">
            Kullanılabilir:{' '}
            <strong className="text-emerald-700">
              {formatCurrency(spendableCash)}
            </strong>
          </span>
          <span className="text-slate-600">
            Bloke Rezerv:{' '}
            <strong className="text-amber-700">
              {formatCurrency(reservedCash)}
            </strong>
          </span>
        </div>
      </div>

      {/* Seçili Hisse Emir Verme Kartı */}
      <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-900 font-mono">
                {selectedStock.ticker}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold">
                {selectedStock.sector}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 truncate">
              {selectedStock.name}
            </div>
          </div>
          <div className="text-right font-mono tabular-nums">
            <div className="text-sm font-bold text-slate-900">
              {selectedStock.price.toFixed(2)} TL
            </div>
            <div className="text-[10px] text-slate-500">
              Alış: {selectedStock.bidPrice.toFixed(2)} · Satış:{' '}
              {selectedStock.askPrice.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Emir Modu Seçimi (Limit vs Piyasa) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-white rounded-xl border border-slate-200">
          <button
            type="button"
            data-testid="tycoon-order-mode-limit"
            onClick={() => setOrderMode('LIMIT')}
            className={`min-h-[40px] rounded-lg font-semibold transition-colors ${
              orderMode === 'LIMIT'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Limit Emir
          </button>
          <button
            type="button"
            data-testid="tycoon-order-mode-market"
            onClick={() => setOrderMode('MARKET')}
            className={`min-h-[40px] rounded-lg font-semibold transition-colors ${
              orderMode === 'MARKET'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Piyasa Emri
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label
              htmlFor="tycoon-lot-input"
              className="block text-[11px] font-semibold text-slate-700 mb-1"
            >
              Miktar (Lot) · Maks: {maxAffordableLots}
            </label>
            <input
              id="tycoon-lot-input"
              data-testid="tycoon-lot-input"
              type="number"
              min={1}
              step={1}
              value={lotAmount}
              onChange={(e) =>
                setLotAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))
              }
              className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 font-mono text-slate-900 text-xs"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {[10, 50, 100, 250].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLotAmount(preset)}
                  className="min-h-[32px] px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700 hover:bg-slate-100"
                >
                  {preset} Lot
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setLotAmount(Math.max(1, maxAffordableLots))
                }
                className="min-h-[32px] px-2 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-semibold"
              >
                Maks Al
              </button>
            </div>
          </div>

          {orderMode === 'LIMIT' ? (
            <div>
              <label
                htmlFor="tycoon-limit-price-input"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Limit Fiyatı (TL)
              </label>
              <input
                id="tycoon-limit-price-input"
                data-testid="tycoon-limit-price-input"
                type="number"
                min={0.1}
                step={0.1}
                value={limitPriceInput}
                onChange={(e) =>
                  setLimitPriceInput(
                    Math.max(0.1, Number(e.target.value) || 0.1)
                  )
                }
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 font-mono text-slate-900 text-xs"
              />
              <div className="text-[10px] text-slate-500 mt-1.5">
                Portföyde kullanılabilir: {availableSharesToSell} lot (Bloke:{' '}
                {reservedShares})
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600">
              <div>
                Piyasa açıkken anında aktif fiyattan gerçekleşir; kapalıyken saat
                10:00 açılışını bekler.
              </div>
              <div className="mt-1 font-mono text-slate-800">
                Mevcut Lot: {availableSharesToSell} lot
              </div>
            </div>
          )}
        </div>

        {/* Emir Aksiyon Butonları */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="tycoon-place-buy-order-btn"
            onClick={() =>
              onPlaceOrder({
                ticker: selectedStock.ticker,
                orderType:
                  orderMode === 'LIMIT' ? 'LIMIT_BUY' : 'MARKET_BUY',
                requestedShares: lotAmount,
                limitPrice:
                  orderMode === 'LIMIT' ? limitPriceInput : undefined,
              })
            }
            className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
          >
            {orderMode === 'LIMIT' ? 'Limit Alış Emri Ver' : 'Piyasa Alış Emri Ver'} (
            {selectedStock.ticker})
          </button>

          <button
            type="button"
            data-testid="tycoon-place-sell-order-btn"
            disabled={availableSharesToSell <= 0}
            onClick={() =>
              onPlaceOrder({
                ticker: selectedStock.ticker,
                orderType:
                  orderMode === 'LIMIT' ? 'LIMIT_SELL' : 'MARKET_SELL',
                requestedShares: Math.min(lotAmount, availableSharesToSell),
                limitPrice:
                  orderMode === 'LIMIT' ? limitPriceInput : undefined,
              })
            }
            className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition-colors"
          >
            {orderMode === 'LIMIT'
              ? 'Limit Satış Emri Ver'
              : 'Piyasa Satış Emri Ver'}{' '}
            ({selectedStock.ticker})
          </button>
        </div>

        {/* Hızlı Doğrudan Al / Sat Butonları */}
        <div className="pt-2 border-t border-emerald-200/70 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-600">
            Anında Doğrudan İşlem:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onBuyStock(selectedStock.ticker, lotAmount)}
              className="min-h-[38px] px-3 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-[11px]"
            >
              Anında Al ({lotAmount} Lot)
            </button>
            <button
              type="button"
              disabled={availableSharesToSell <= 0}
              onClick={() =>
                onSellStock(
                  selectedStock.ticker,
                  Math.min(lotAmount, availableSharesToSell)
                )
              }
              className="min-h-[38px] px-3 py-1 rounded-lg bg-white hover:bg-rose-50 disabled:opacity-50 text-rose-800 border border-rose-300 font-semibold text-[11px]"
            >
              Anında Sat
            </button>
          </div>
        </div>
      </div>

      {/* Açık ve Gerçekleşen Emirler Listesi */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900">
            Emir Defteri ({state.pendingOrders.length})
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Bloke Nakit: {formatCurrency(reservedCash)}
          </span>
        </div>

        {state.pendingOrders.length === 0 ? (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-center">
            Henüz oluşturulmuş bir emir bulunmuyor.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {state.pendingOrders.slice(0, 15).map((ord) => (
              <div
                key={ord.id}
                data-testid={`tycoon-order-row-${ord.id}`}
                className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900">
                      {ord.ticker}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                      {ord.orderType}
                    </span>
                    <span
                      data-testid={`tycoon-order-status-${ord.id}`}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        ord.status === 'FILLED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ord.status === 'PENDING' ||
                            ord.status === 'PARTIALLY_FILLED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                    {ord.requestedShares} lot
                    {ord.limitPrice
                      ? ` · Limit: ${ord.limitPrice.toFixed(2)} TL`
                      : ''}
                    {ord.averageExecutionPrice > 0
                      ? ` · Gerç: ${ord.averageExecutionPrice.toFixed(2)} TL`
                      : ''}
                    {ord.reservedCash > 0
                      ? ` · Rezerv: ${formatCurrency(ord.reservedCash)}`
                      : ''}
                  </div>
                </div>

                {(ord.status === 'PENDING' ||
                  ord.status === 'PARTIALLY_FILLED') && (
                  <button
                    type="button"
                    onClick={() => onCancelOrder(ord.id)}
                    className="min-h-[38px] px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[11px] shrink-0"
                  >
                    İptal Et
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hisse Senedi Listesi (Mobil Kart Düzeni - Yatay Taşmasız) */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-900">
            Borsa Şirketleri ({filteredStocks.length})
          </h3>
          <input
            type="search"
            placeholder="Hisse veya şirket ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-h-[38px] px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSectorFilter('ALL')}
            className={`min-h-[36px] px-2.5 py-1 rounded-xl text-[11px] font-semibold shrink-0 ${
              sectorFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Tümü ({state.stocks.length})
          </button>
          {(Object.keys(SECTOR_CONFIGS) as SectorId[]).map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setSectorFilter(sec)}
              className={`min-h-[36px] px-2.5 py-1 rounded-xl text-[11px] font-semibold shrink-0 ${
                sectorFilter === sec
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {SECTOR_CONFIGS[sec].name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredStocks.map((st) => {
            const dailyPct =
              st.previousPrice > 0
                ? ((st.price - st.previousPrice) / st.previousPrice) * 100
                : 0;
            const isSelected = st.ticker === selectedStock.ticker;
            const myLots = state.portfolio[st.ticker]?.shares || 0;

            return (
              <button
                key={st.ticker}
                type="button"
                onClick={() => onSelectTicker(st.ticker)}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 min-h-[64px] ${
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-400 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {st.ticker}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      · {st.sector}
                    </span>
                    {myLots > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-mono font-semibold">
                        {myLots} lot
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    {st.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Adil Değer: {st.fundamentalPrice.toFixed(2)} TL · Pay: %
                    {st.playerOwnershipPct.toFixed(2)}
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="text-xs font-bold text-slate-900">
                    {st.price.toFixed(2)} TL
                  </div>
                  <div
                    className={`text-[11px] font-semibold ${
                      dailyPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {dailyPct >= 0 ? '+' : ''}
                    {dailyPct.toFixed(2)}%
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
