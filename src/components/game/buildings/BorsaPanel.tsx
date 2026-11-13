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
import { History, ListChecks, Wallet } from 'lucide-react';
import { AssetsSection, HistorySection, OrdersSection } from './InvestorSections';
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
  formatCurrency,
}) => {
  const [sectorFilter, setSectorFilter] = useState<SectorId | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [lotAmount, setLotAmount] = useState<number>(50);
  const [section, setSection] = useState<'NONE' | 'ASSETS' | 'HISTORY' | 'ORDERS'>('NONE');
  const [tradeNote, setTradeNote] = useState<string | null>(null);

  const selectedStock =
    state.stocks.find((s) => s.ticker === selectedTicker) || state.stocks[0];

  useEffect(() => {
    setTradeNote(null);
  }, [selectedStock?.ticker]);

  const toggleSection = (id: 'ASSETS' | 'HISTORY' | 'ORDERS') =>
    setSection((cur) => (cur === id ? 'NONE' : id));
  const openOrderCount = state.pendingOrders.filter(
    (o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED'
  ).length;

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
      Math.floor(spendableCash / (selectedStock.askPrice * 1.002))
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

      {/* Varlıklarım · İşlem geçmişi · Bekleyen emirler */}
      <div className="grid grid-cols-3 gap-2" data-testid="borsa-tools-strip">
        {(
          [
            {
              id: 'ASSETS',
              testId: 'assets-toggle',
              icon: Wallet,
              label: 'Varlıklarım',
              sub: formatCurrency(state.netWorth),
            },
            {
              id: 'HISTORY',
              testId: 'borsa-history-toggle',
              icon: History,
              label: 'İşlemlerim',
              sub: `${state.transactions.length} işlem`,
            },
            {
              id: 'ORDERS',
              testId: 'tycoon-advanced-toggle',
              icon: ListChecks,
              label: 'Hedef emir',
              sub: openOrderCount > 0 ? `${openOrderCount} bekliyor` : 'Fiyat belirle',
            },
          ] as const
        ).map((t) => {
          const active = section === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              data-testid={t.testId}
              data-active={active ? 'true' : 'false'}
              onClick={() => toggleSection(t.id)}
              className={`relative g-card p-2.5 min-h-[84px] flex flex-col items-center justify-center gap-1 text-center active:scale-[0.98] border-2 ${
                active ? 'border-[var(--g-navy-400)] bg-[#eef1fb]' : 'border-transparent'
              }`}
            >
              <Icon size={22} className="text-[var(--g-navy-600)]" />
              <span className="text-[13px] font-extrabold text-[var(--g-ink)] leading-tight">
                {t.label}
              </span>
              <span className="text-[13px] text-[var(--g-muted)] leading-tight tabular-nums truncate max-w-full">
                {t.sub}
              </span>
              {t.id === 'ORDERS' && openOrderCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[var(--g-gold)] text-[#3a2600] text-[13px] font-extrabold flex items-center justify-center">
                  {openOrderCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={section === 'ASSETS' ? 'g-rise' : 'hidden'}>
        <AssetsSection
          state={state}
          formatCurrency={formatCurrency}
          onSelectTicker={(t) => {
            onSelectTicker(t);
            setSection('NONE');
          }}
        />
      </div>
      <div className={section === 'HISTORY' ? 'g-rise' : 'hidden'}>
        <HistorySection state={state} formatCurrency={formatCurrency} />
      </div>
      <div className={section === 'ORDERS' ? 'g-rise' : 'hidden'}>
        <OrdersSection
          state={state}
          ticker={selectedStock.ticker}
          formatCurrency={formatCurrency}
          onSelectTicker={onSelectTicker}
          onPlaceOrder={onPlaceOrder}
          onCancelOrder={onCancelOrder}
          spendableCash={spendableCash}
          reservedCash={reservedCash}
          getReservedShares={getReservedShares}
        />
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
              {ownedShares > 0 ? `Sende ${ownedShares} lot` : 'Sende yok'}
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

        <div className="grid grid-cols-5 gap-1.5" data-testid="tycoon-lot-presets">
          {[10, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              data-testid={`tycoon-lot-preset-${n}`}
              onClick={() => setLotAmount(n)}
              className={`g-choice min-h-[48px] text-sm font-extrabold tabular-nums ${
                lotAmount === n ? 'is-active' : ''
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            data-testid="tycoon-lot-max-buy-btn"
            disabled={maxAffordableLots <= 0}
            onClick={() => setLotAmount(Math.max(1, maxAffordableLots))}
            className={`g-choice min-h-[48px] px-1 text-[13px] font-extrabold leading-tight text-[var(--g-green-dark)] disabled:opacity-40 ${
              maxAffordableLots > 0 && lotAmount === maxAffordableLots ? 'is-active' : ''
            }`}
          >
            Hepsini al
          </button>
          <button
            type="button"
            data-testid="tycoon-lot-max-sell-btn"
            disabled={availableSharesToSell <= 0}
            onClick={() => setLotAmount(Math.max(1, availableSharesToSell))}
            className={`g-choice min-h-[48px] px-1 text-[13px] font-extrabold leading-tight text-[var(--g-red)] disabled:opacity-40 ${
              availableSharesToSell > 0 && lotAmount === availableSharesToSell ? 'is-active' : ''
            }`}
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

    </div>
  );
};
