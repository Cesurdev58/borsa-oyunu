/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BORSA bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import { NumberInput } from '../ui/NumberInput';
import { MarketEngine } from '../../../engine/MarketEngine';
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
import { SectorIcon, sectorLabel } from '../ui/SectorIcon';
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
  const [advanced, setAdvanced] = useState(false);
  const [tradeNote, setTradeNote] = useState<string | null>(null);

  const selectedStock =
    state.stocks.find((s) => s.ticker === selectedTicker) || state.stocks[0];

  useEffect(() => {
    if (selectedStock) {
      setLimitPriceInput(Number(selectedStock.askPrice.toFixed(2)));
    }
  }, [selectedStock?.ticker]);

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
  const maxAffordableLots = Math.min(
    MarketEngine.maxMarketBuyableShares(selectedStock, ownedShares),
    Math.max(
      0,
      Math.floor(
        spendableCash /
          ((orderMode === 'LIMIT' && limitPriceInput > 0
            ? limitPriceInput
            : selectedStock.askPrice) *
            1.002)
      )
    )
  );

  const portfolioValue = state.stocks.reduce(
    (sum, st) => sum + (state.portfolio[st.ticker]?.shares || 0) * st.price,
    0
  );

  const quickTrade = (side: 'BUY' | 'SELL') => {
    const open = state.marketSession === 'MARKET_OPEN';
    const lots = side === 'BUY' ? lotAmount : Math.min(lotAmount, availableSharesToSell);
    if (lots <= 0) return;
    if (open) {
      if (side === 'BUY') onBuyStock(selectedStock.ticker, lots);
      else onSellStock(selectedStock.ticker, lots);
      setTradeNote(null);
    } else {
      onPlaceOrder({
        ticker: selectedStock.ticker,
        orderType: side === 'BUY' ? 'MARKET_BUY' : 'MARKET_SELL',
        requestedShares: lots,
      });
      setTradeNote('Borsa kapalı: emrin sıraya alındı, açılışta işleme girer.');
    }
  };

  return (
    <div className="space-y-4 text-xs" data-testid="sheet-content-BORSA">
      {/* Üst kart: nakit + piyasa durumu */}
      <div className="g-hero p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="g-hero-label whitespace-nowrap">Toplam paran</div>
          <span
            className={`px-2.5 py-1 rounded-full text-[13px] font-bold ${
              state.marketSession === 'MARKET_OPEN'
                ? 'bg-[var(--g-green)] text-white'
                : 'bg-white/10 text-white/80'
            }`}
          >
            {state.marketSession === 'MARKET_OPEN'
              ? 'Açık'
              : 'Kapalı · 10:00\'da açılır'}
          </span>
        </div>
        <div className="g-hero-value text-[34px] mt-1">
          {formatCurrency(spendableCash + portfolioValue)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="g-hero-tile p-2.5">
            <div className="text-[13px] font-bold text-white/60">Cebimdeki para</div>
            <div className="text-base font-extrabold tabular-nums tabular-nums">
              {formatCurrency(spendableCash)}
            </div>
          </div>
          <div className="g-hero-tile p-2.5">
            <div className="text-[13px] font-bold text-white/60">Hisselerimin değeri</div>
            <div className="text-base font-extrabold tabular-nums tabular-nums">
              {formatCurrency(portfolioValue)}
            </div>
          </div>
        </div>

      </div>

      {/* Hızlı al/sat kartı */}
      <div className="g-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <SectorIcon sector={selectedStock.sector} size="lg" />
            <div className="min-w-0">
              <div className="font-extrabold text-slate-900 text-sm">
                {selectedStock.ticker}
              </div>
              <div className="text-[13px] text-slate-500 truncate">
                {selectedStock.name}
              </div>
            </div>
          </div>
          <div className="text-right tabular-nums tabular-nums">
            <div className="g-section-title">
              <span className="whitespace-nowrap">{selectedStock.price.toFixed(2)} ₺</span>
            </div>
            <div className="text-[13px] text-slate-500">
              {ownedShares > 0 ? `Sende ${ownedShares} lot var` : 'Sende yok'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 p-2">
          <button
            type="button"
            aria-label="Azalt"
            onClick={() => setLotAmount((v) => Math.max(1, v - (v > 50 ? 50 : v > 10 ? 10 : 1)))}
            className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-xl font-extrabold text-slate-700 active:scale-95"
          >
            −
          </button>
          <div className="text-center">
            <NumberInput
              data-testid="tycoon-lot-quick-input"
              aria-label="Kaç lot?"
              min={1}
              step={1}
              value={lotAmount}
              onChange={(e) =>
                setLotAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))
              }
              className="w-28 text-center text-2xl font-extrabold tabular-nums text-slate-900 bg-white rounded-xl border border-slate-200 min-h-[44px]"
            />
            <div className="text-[13px] text-slate-500">
              lot · yaklaşık {formatCurrency(lotAmount * selectedStock.askPrice)}
            </div>
          </div>
          <button
            type="button"
            aria-label="Artır"
            onClick={() => setLotAmount((v) => v + (v >= 50 ? 50 : v >= 10 ? 10 : 1))}
            className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-xl font-extrabold text-slate-700 active:scale-95"
          >
            +
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[10, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setLotAmount(n)}
              className="g-btn g-btn-secondary flex-1"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            data-testid="tycoon-lot-max-buy-btn"
            onClick={() => setLotAmount(Math.max(1, maxAffordableLots))}
            className="flex-[1_1_45%] min-h-[48px] rounded-xl bg-emerald-100 text-emerald-800 text-sm font-extrabold active:scale-95"
          >
            Hepsini al
          </button>
          <button
            type="button"
            data-testid="tycoon-lot-max-sell-btn"
            disabled={availableSharesToSell <= 0}
            onClick={() => setLotAmount(Math.max(1, availableSharesToSell))}
            className="flex-[1_1_45%] min-h-[48px] rounded-xl bg-rose-100 text-rose-800 disabled:bg-slate-100 disabled:text-slate-400 text-sm font-extrabold active:scale-95"
          >
            Hepsini sat
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="tycoon-quick-buy-btn"
            onClick={() => quickTrade('BUY')}
            className="g-btn g-btn-primary"
          >
            AL
          </button>
          <button
            type="button"
            data-testid="tycoon-quick-sell-btn"
            disabled={availableSharesToSell <= 0}
            onClick={() => quickTrade('SELL')}
            className="g-btn g-btn-danger"
          >
            SAT
          </button>
        </div>
        {tradeNote && (
          <div className="text-[13px] text-center text-slate-600">{tradeNote}</div>
        )}
      </div>

      {/* Hisse kartları */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-slate-900">Hisseler</h3>
          <input
            type="search"
            placeholder="Ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-h-[36px] w-32 px-3 rounded-full bg-slate-100 text-xs text-slate-900"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSectorFilter('ALL')}
            className={`min-h-[36px] px-3 rounded-full text-[13px] font-bold shrink-0 ${
              sectorFilter === 'ALL' ? 'bg-emerald-500 text-white' : 'g-choice'
            }`}
          >
            Hepsi
          </button>
          {(Object.keys(SECTOR_CONFIGS) as SectorId[]).map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setSectorFilter(sec)}
              className={`min-h-[36px] px-3 rounded-full text-[13px] font-bold shrink-0 ${
                sectorFilter === sec ? 'bg-emerald-500 text-white' : 'g-choice'
              }`}
            >
              {sectorLabel(sec)}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filteredStocks.map((st) => {
            const dailyPct =
              st.previousPrice > 0
                ? ((st.price - st.previousPrice) / st.previousPrice) * 100
                : 0;
            const isSelected = st.ticker === selectedStock.ticker;
            const myLots = state.portfolio[st.ticker]?.shares || 0;
            const up = dailyPct >= 0;
            return (
              <button
                key={st.ticker}
                type="button"
                onClick={() => onSelectTicker(st.ticker)}
                className={`w-full p-3 rounded-2xl border-2 text-left flex items-center gap-3 min-h-[64px] active:scale-[0.99] ${
                  isSelected
                    ? 'bg-white border-[var(--g-navy-400)] shadow-md'
                    : 'bg-white border-[var(--g-line)] shadow-sm'
                }`}
              >
                <SectorIcon sector={st.sector} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-slate-900 text-sm">{st.ticker}</span>
                    {myLots > 0 && (
                      <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                        {myLots} lot
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-slate-500 truncate">{st.name}</div>
                </div>
                <div className="text-right tabular-nums tabular-nums shrink-0">
                  <div className="text-sm font-extrabold text-slate-900">{st.price.toFixed(2)} ₺</div>
                  <div
                    className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[13px] font-bold ${
                      up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {up ? '▲' : '▼'} {Math.abs(dailyPct).toFixed(2)}%
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        data-testid="tycoon-advanced-toggle"
        onClick={() => setAdvanced((v) => !v)}
        className="g-btn g-btn-secondary w-full"
      >
        {advanced ? '▲ Gelişmiş emirleri gizle' : '▼ Gelişmiş emirler (limit emri, emir defteri)'}
      </button>
      {advanced && (
        <div className="space-y-4">
      {/* Seçili Hisse Emir Verme Kartı */}
      <div className="p-3.5 g-card-soft space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                {selectedStock.ticker}
              </span>
              <span className="text-[13px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold">
                {selectedStock.sector}
              </span>
            </div>
            <div className="text-[13px] text-slate-600 truncate">
              {selectedStock.name}
            </div>
          </div>
          <div className="text-right tabular-nums tabular-nums">
            <div className="text-sm font-bold text-slate-900">
              {selectedStock.price.toFixed(2)} TL
            </div>
            <div className="text-[13px] text-slate-500">
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
                ? 'g-choice is-active'
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
                ? 'g-choice is-active'
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
              className="block text-[13px] font-semibold text-slate-700 mb-1"
            >
              Miktar (Lot) · Maks: {maxAffordableLots}
            </label>
            <NumberInput
              id="tycoon-lot-input"
              data-testid="tycoon-lot-input"
              
              min={1}
              step={1}
              value={lotAmount}
              onChange={(e) =>
                setLotAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))
              }
              className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 tabular-nums text-slate-900 text-xs"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {[10, 50, 100, 250].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLotAmount(preset)}
                  className="min-h-[32px] px-2 py-1 rounded-lg bg-white border border-slate-200 text-[13px] tabular-nums text-slate-700 hover:bg-slate-100"
                >
                  {preset} Lot
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setLotAmount(Math.max(1, maxAffordableLots))
                }
                className="min-h-[32px] px-2 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-[13px] font-semibold"
              >
                Maks Al
              </button>
            </div>
          </div>

          {orderMode === 'LIMIT' ? (
            <div>
              <label
                htmlFor="tycoon-limit-price-input"
                className="block text-[13px] font-semibold text-slate-700 mb-1"
              >
                Limit Fiyatı (TL)
              </label>
              <NumberInput
                id="tycoon-limit-price-input"
                data-testid="tycoon-limit-price-input"
                
                min={0.1}
                step={0.1}
                value={limitPriceInput}
                onChange={(e) =>
                  setLimitPriceInput(
                    Math.max(0.1, Number(e.target.value) || 0.1)
                  )
                }
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 tabular-nums text-slate-900 text-xs"
              />
              <div className="text-[13px] text-slate-500 mt-1.5">
                Portföyde kullanılabilir: {availableSharesToSell} lot (Bloke:{' '}
                {reservedShares})
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center p-2.5 rounded-xl bg-white border border-slate-200 text-[13px] text-slate-600">
              <div>
                Piyasa açıkken anında aktif fiyattan gerçekleşir; kapalıyken saat
                10:00 açılışını bekler.
              </div>
              <div className="mt-1 tabular-nums text-slate-800">
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
            className="g-btn g-btn-primary px-3"
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
            className="g-btn g-btn-danger px-3"
          >
            {orderMode === 'LIMIT'
              ? 'Limit Satış Emri Ver'
              : 'Piyasa Satış Emri Ver'}{' '}
            ({selectedStock.ticker})
          </button>
        </div>

        {/* Hızlı Doğrudan Al / Sat Butonları */}
        <div className="pt-2 border-t border-emerald-200/70 flex items-center justify-between gap-2">
          <span className="text-[13px] text-slate-600">
            Anında Doğrudan İşlem:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onBuyStock(selectedStock.ticker, lotAmount)}
              className="min-h-[38px] px-3 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-[13px]"
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
              className="min-h-[38px] px-3 py-1 rounded-lg bg-white hover:bg-rose-50 disabled:opacity-50 text-rose-800 border border-rose-300 font-semibold text-[13px]"
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
          <span className="text-[13px] tabular-nums text-slate-500">
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
                    <span className="tabular-nums font-bold text-slate-900">
                      {ord.ticker}
                    </span>
                    <span className="text-[13px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 tabular-nums">
                      {ord.orderType}
                    </span>
                    <span
                      data-testid={`tycoon-order-status-${ord.id}`}
                      className={`text-[13px] font-bold px-1.5 py-0.5 rounded ${
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
                  <div className="text-[13px] text-slate-600 tabular-nums mt-0.5">
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
                    className="min-h-[38px] px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[13px] shrink-0"
                  >
                    İptal Et
                  </button>
                )}
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
