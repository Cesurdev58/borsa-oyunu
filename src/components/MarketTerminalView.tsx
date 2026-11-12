import { NumberInput } from './game/ui/NumberInput';
import React, { useState, useMemo, useEffect } from 'react';
import {
  MarketStock,
  PortfolioPosition,
  NewsEvent,
  SectorId,
  SECTOR_CONFIGS,
  MacroEconomyState,
  PendingOrder,
  PendingOrderType,
  MarketSession,
  GameClockEngine,
} from '../engine/SimulationEngine';
import {
  TrendingUp,
  TrendingDown,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  XCircle,
} from 'lucide-react';

interface MarketTerminalViewProps {
  stocks: MarketStock[];
  portfolio: Record<string, PortfolioPosition>;
  pendingOrders: PendingOrder[];
  cash: number;
  spendableCash: number;
  reservedCash: number;
  marketSession: MarketSession;
  formattedGameTime: string;
  macro: MacroEconomyState;
  newsFeed: NewsEvent[];
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  onBuyStock: (ticker: string, shares: number) => void;
  onSellStock: (ticker: string, shares: number) => void;
  onPlaceOrder: (params: {
    ticker: string;
    orderType: PendingOrderType;
    requestedShares: number;
    limitPrice?: number;
  }) => void;
  onCancelOrder: (orderId: string) => void;
  getReservedShares: (ticker: string) => number;
  formatCurrency: (val: number) => string;
}

export const MarketTerminalView: React.FC<MarketTerminalViewProps> = ({
  stocks,
  portfolio,
  pendingOrders,
  cash,
  spendableCash,
  reservedCash,
  marketSession,
  formattedGameTime,
  macro,
  newsFeed,
  selectedTicker,
  onSelectTicker,
  onBuyStock,
  onSellStock,
  onPlaceOrder,
  onCancelOrder,
  getReservedShares,
  formatCurrency,
}) => {
  const [sectorFilter, setSectorFilter] = useState<SectorId | 'TUMU'>('TUMU');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderLots, setOrderLots] = useState<number>(100);
  const [orderMode, setOrderMode] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [limitPriceInput, setLimitPriceInput] = useState<number>(124.5);

  const filteredStocks = useMemo(() => {
    return stocks.filter((s) => {
      const matchesSector =
        sectorFilter === 'TUMU' || s.sector === sectorFilter;
      const matchesQuery =
        searchQuery.trim() === '' ||
        s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSector && matchesQuery;
    });
  }, [stocks, sectorFilter, searchQuery]);

  const activeStock = useMemo(() => {
    return stocks.find((s) => s.ticker === selectedTicker) || stocks[0];
  }, [stocks, selectedTicker]);

  useEffect(() => {
    if (activeStock) {
      setLimitPriceInput(Number(activeStock.price.toFixed(2)));
    }
  }, [activeStock?.ticker]);

  const activePosition = portfolio[activeStock.ticker];
  const reservedSharesForActive = getReservedShares(activeStock.ticker);
  const availableSharesToSell = Math.max(
    0,
    (activePosition?.shares || 0) - reservedSharesForActive
  );

  const maxAffordableLots = Math.max(
    0,
    Math.floor(spendableCash / (activeStock.askPrice * 1.0015))
  );

  const chartPoints = useMemo(() => {
    const history = activeStock.priceHistory;
    if (history.length < 2) {
      return {
        polyline: '0,60 460,60',
        min: activeStock.price * 0.95,
        max: activeStock.price * 1.05,
      };
    }
    const min = Math.min(...history) * 0.98;
    const max = Math.max(...history) * 1.02;
    const range = Math.max(0.01, max - min);
    const pts = history
      .map((p, idx) => {
        const x = (idx / (history.length - 1)) * 460;
        const y = 125 - ((p - min) / range) * 105;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return { polyline: pts, min, max };
  }, [activeStock]);

  const portfolioList = Object.values(portfolio).filter((p) => p.shares > 0);
  const isMarketOpen = marketSession === 'MARKET_OPEN';

  return (
    <div className="space-y-6">
      {/* Makroekonomik Göstergeler ve Sektör Filtre Çubuğu */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2.5 border-b border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-300 font-mono tabular-nums">
            <span>
              Politika Faizi:{' '}
              <strong className="text-slate-100">
                %{(macro.policyInterestRate * 100).toFixed(1)}
              </strong>
            </span>
            <span>·</span>
            <span>
              Enflasyon:{' '}
              <strong className="text-slate-100">
                %{(macro.inflationRate * 100).toFixed(1)}
              </strong>
            </span>
            <span>·</span>
            <span>
              GSYH Büyüme:{' '}
              <strong className="text-emerald-400">
                %{(macro.gdpGrowthRate * 100).toFixed(2)}
              </strong>
            </span>
            <span>·</span>
            <span>
              Risk İştahı:{' '}
              <strong className="text-sky-400">
                %{(macro.marketRiskAppetite * 100).toFixed(0)}
              </strong>
            </span>
            <span>·</span>
            <span>
              Konjonktür:{' '}
              <strong className="text-amber-400">{macro.cyclePhase}</strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Kurumlar Vergisi: %{(macro.corporateTaxRate * 100).toFixed(0)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            className="flex flex-wrap items-center gap-1"
            role="tablist"
            aria-label="Sektör Filtresi"
          >
            <button
              type="button"
              onClick={() => setSectorFilter('TUMU')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                sectorFilter === 'TUMU'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              Tüm Sektörler ({stocks.length})
            </button>
            {(Object.keys(SECTOR_CONFIGS) as SectorId[]).map((secId) => (
              <button
                key={secId}
                type="button"
                onClick={() => setSectorFilter(secId)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  sectorFilter === secId
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                {secId}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Hisse Kodu veya Şirket Ara"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hisse kodu veya şirket ara..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Ana İki Sütunlu Borsa Terminali */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sol Sütun: 16 NPC (+ Halka Açık Oyuncu Şirketi) Tablosu */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Piyasa Tahtası (Çok Faktörlü GBM Fiyat Motoru & 5-Yöntemli Temel Değer)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Alış/Satış makası (Bid/Ask), 5-yöntemli adil değer (Fair Value), haber duyarlılığı ve ortaklık paylarını inceleyin.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              Gösterilen: {filteredStocks.length} / {stocks.length} Şirket
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950/60">
                  <th className="py-2.5 px-3">Kod / Şirket</th>
                  <th className="py-2.5 px-3">Sektör</th>
                  <th className="py-2.5 px-3 text-right">Fiyat (TL)</th>
                  <th className="py-2.5 px-3 text-right">Adil Değer</th>
                  <th className="py-2.5 px-3 text-right">Günlük %</th>
                  <th className="py-2.5 px-3 text-right">Duyarlılık</th>
                  <th className="py-2.5 px-3 text-right">Payınız %</th>
                  <th className="py-2.5 px-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {filteredStocks.map((stock) => {
                  const isSelected = stock.ticker === activeStock.ticker;
                  const isPositive = stock.dailyChangePct >= 0;
                  return (
                    <tr
                      key={stock.ticker}
                      onClick={() => onSelectTicker(stock.ticker)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-emerald-950/30 hover:bg-emerald-950/40'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-100">
                            {stock.ticker}
                          </span>
                          <span className="text-slate-400 truncate max-w-[165px]">
                            {stock.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {stock.isPlayerCompany
                            ? 'Oyuncu Şirketi (Halka Açık)'
                            : stock.isControlledByPlayer
                            ? 'Holding Bağlı Ortaklığı'
                            : `Borsa NPC · Derinlik: ${stock.liquidityDepthLots.toLocaleString('tr-TR')} lot`}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {stock.sector}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-100">
                        {stock.price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {stock.fundamentalPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <span
                          className={`inline-flex items-center gap-0.5 ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          {isPositive ? '+' : ''}
                          {stock.dailyChangePct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <span
                          className={
                            stock.sentimentScore >= 0
                              ? 'text-sky-400'
                              : 'text-amber-400'
                          }
                        >
                          {stock.sentimentScore >= 0 ? '+' : ''}
                          {(stock.sentimentScore * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {stock.playerOwnershipPct.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTicker(stock.ticker);
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          Seç
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sağ Sütun: Seçili Hisse GBM Grafiği, Bilanço Özeti ve Emir Paneli */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold font-mono text-slate-100">
                    {activeStock.ticker}
                  </h3>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-400">
                    {activeStock.sector}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {activeStock.name}
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold font-mono tabular-nums text-slate-100">
                  {activeStock.price.toFixed(2)} TL
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400">
                  Alış (Bid): {activeStock.bidPrice.toFixed(2)} · Satış (Ask):{' '}
                  {activeStock.askPrice.toFixed(2)}
                </div>
              </div>
            </div>

            {/* SVG Fiyat Grafiği */}
            <div className="my-3 bg-slate-950 border border-slate-800/80 rounded p-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums mb-1">
                <span>
                  Son {activeStock.priceHistory.length} Günlük Fiyat Yolu
                </span>
                <span>
                  Adil Değer: {activeStock.fundamentalPrice.toFixed(2)} TL
                </span>
              </div>
              <svg
                viewBox="0 0 460 135"
                className="w-full h-24 overflow-visible"
                role="img"
                aria-label={`${activeStock.ticker} fiyat grafiği`}
              >
                <line
                  x1="0"
                  y1="30"
                  x2="460"
                  y2="30"
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                />
                <line
                  x1="0"
                  y1="75"
                  x2="460"
                  y2="75"
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                />
                <line
                  x1="0"
                  y1="120"
                  x2="460"
                  y2="120"
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                />
                <polyline
                  fill="none"
                  stroke={
                    activeStock.dailyChangePct >= 0 ? '#10b981' : '#f43f5e'
                  }
                  strokeWidth="2.5"
                  points={chartPoints.polyline}
                />
              </svg>
            </div>

            {/* Şirket Bilanço ve Değerleme Özeti */}
            <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-800 text-[11px]">
              <div>
                <div className="text-slate-400">Yıllık Ciro</div>
                <div className="font-mono tabular-nums text-slate-200 mt-0.5">
                  {formatCurrency(activeStock.financials.revenue)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">FAVÖK / Net Kâr</div>
                <div className="font-mono tabular-nums text-emerald-400 mt-0.5">
                  {formatCurrency(activeStock.financials.EBITDA)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Özkaynak (Defter)</div>
                <div className="font-mono tabular-nums text-sky-400 mt-0.5">
                  {formatCurrency(activeStock.financials.shareholdersEquity)}
                </div>
              </div>
            </div>

            {/* Emir Giriş Formu */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="order-lots-input"
                  className="text-slate-300 font-medium"
                >
                  Emir Miktarı (Lot)
                </label>
                <span className="text-slate-400 font-mono tabular-nums">
                  Alınabilir Maks: {maxAffordableLots.toLocaleString('tr-TR')} lot
                </span>
              </div>

              <NumberInput
                id="order-lots-input"
                
                min={1}
                max={activeStock.totalShares}
                value={orderLots}
                onChange={(e) =>
                  setOrderLots(
                    Math.max(1, Math.floor(Number(e.target.value) || 1))
                  )
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md font-mono tabular-nums text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />

              <div className="flex items-center gap-1.5">
                {[50, 200, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setOrderLots(preset)}
                    className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono tabular-nums transition-colors whitespace-nowrap shrink-0"
                  >
                    {preset} Lot
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOrderLots(Math.max(1, maxAffordableLots))}
                  className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  Maks Al
                </button>
              </div>

              {/* Bekleyen / Limit / Piyasa Emir Seçenekleri */}
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-md space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">
                    Emir Tipi (Seans: {formattedGameTime})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOrderMode('LIMIT')}
                      className={`px-2 py-1 rounded text-[11px] font-medium ${
                        orderMode === 'LIMIT'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Limit Emir
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderMode('MARKET')}
                      className={`px-2 py-1 rounded text-[11px] font-medium ${
                        orderMode === 'MARKET'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Piyasa Emri
                    </button>
                  </div>
                </div>

                {orderMode === 'LIMIT' && (
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="limit-price-input"
                      className="text-slate-400"
                    >
                      Limit Fiyatı (TL):
                    </label>
                    <NumberInput
                      id="limit-price-input"
                      aria-label="Limit Fiyatı (TL)"
                      
                      step="0.1"
                      min="1"
                      value={limitPriceInput}
                      onChange={(e) =>
                        setLimitPriceInput(
                          Math.max(0.5, Number(e.target.value) || 1)
                        )
                      }
                      className="w-32 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded font-mono tabular-nums text-right text-slate-100"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onPlaceOrder({
                        ticker: activeStock.ticker,
                        orderType:
                          orderMode === 'LIMIT' ? 'LIMIT_BUY' : 'MARKET_BUY',
                        requestedShares: orderLots,
                        limitPrice:
                          orderMode === 'LIMIT' ? limitPriceInput : undefined,
                      })
                    }
                    className="py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded transition-colors whitespace-nowrap"
                  >
                    {orderMode === 'LIMIT'
                      ? `Limit Alış Emri Ver (${activeStock.ticker})`
                      : `Piyasa Alış Emri Ver (${activeStock.ticker})`}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onPlaceOrder({
                        ticker: activeStock.ticker,
                        orderType:
                          orderMode === 'LIMIT' ? 'LIMIT_SELL' : 'MARKET_SELL',
                        requestedShares: orderLots,
                        limitPrice:
                          orderMode === 'LIMIT' ? limitPriceInput : undefined,
                      })
                    }
                    disabled={availableSharesToSell <= 0}
                    className="py-2 px-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs rounded transition-colors whitespace-nowrap"
                  >
                    {orderMode === 'LIMIT'
                      ? `Limit Satış Emri Ver (${activeStock.ticker})`
                      : `Piyasa Satış Emri Ver (${activeStock.ticker})`}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded p-2.5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Tahmini Alış Tutarı (Ask + %0.15 Komisyon):
                  </span>
                  <span className="font-mono tabular-nums text-slate-100 font-medium">
                    {formatCurrency(orderLots * activeStock.askPrice * 1.0015)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Kullanılabilir / Rezerve Nakit:
                  </span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {formatCurrency(spendableCash)} / Rezerv:{' '}
                    {formatCurrency(reservedCash)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Portföydeki Mevcut Lotunuz:
                  </span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {(activePosition?.shares || 0).toLocaleString('tr-TR')} lot
                    {reservedSharesForActive > 0
                      ? ` (${reservedSharesForActive} lot emirde rezerve)`
                      : ''}{' '}
                    (Ort: {(activePosition?.averageCost || 0).toFixed(2)} TL)
                  </span>
                </div>
              </div>

              {/* Geliştirici / Anlık İşlem Butonları (Geriye Uyumluluk) */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onBuyStock(activeStock.ticker, orderLots)}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Hisse Al ({activeStock.ticker})
                </button>
                <button
                  type="button"
                  onClick={() => onSellStock(activeStock.ticker, orderLots)}
                  disabled={availableSharesToSell <= 0}
                  className="py-2 px-4 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Hisse Sat ({activeStock.ticker})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bekleyen Borsa Emirleri Tablosu (Pending Orders & Rezervasyonlar) */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Borsa Emir Defteri (Bekleyen & Gerçekleşen Emirler)
            </h3>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400 flex items-center gap-4">
            <span>
              Seans:{' '}
              <strong
                className={
                  isMarketOpen ? 'text-emerald-400' : 'text-amber-400'
                }
              >
                {GameClockEngine.getMarketSessionLabelTR(marketSession)}
              </strong>
            </span>
            <span>·</span>
            <span>
              Toplam Bloke Nakit Rezervi:{' '}
              <strong className="text-sky-400">
                {formatCurrency(reservedCash)}
              </strong>
            </span>
          </div>
        </div>

        {pendingOrders.length === 0 ? (
          <div className="p-5 text-center text-xs text-slate-400">
            Henüz oluşturulmuş bir piyasa veya limit emri bulunmuyor. Piyasa kapalıyken verilen emirler açılışı (10:00) bekler.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950/60">
                  <th className="py-2 px-3">Emir No / Gün</th>
                  <th className="py-2 px-3">Hisse</th>
                  <th className="py-2 px-3">Tür</th>
                  <th className="py-2 px-3 text-right">Miktar (Kalan)</th>
                  <th className="py-2 px-3 text-right">Limit / Gerçekleşen</th>
                  <th className="py-2 px-3 text-right">Bloke Rezerv</th>
                  <th className="py-2 px-3">Durum</th>
                  <th className="py-2 px-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {pendingOrders.slice(0, 15).map((ord) => {
                  const isActive =
                    ord.status === 'PENDING' ||
                    ord.status === 'PARTIALLY_FILLED';
                  return (
                    <tr key={ord.id} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-mono text-slate-300">
                        {ord.id} · Gün {ord.createdDay}
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-100">
                        {ord.ticker}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-200">
                        {ord.orderType}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-200">
                        {ord.requestedShares.toLocaleString('tr-TR')} (
                        {ord.remainingShares.toLocaleString('tr-TR')})
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-200">
                        {typeof ord.limitPrice === 'number'
                          ? `Limit: ${ord.limitPrice.toFixed(2)} TL`
                          : 'Piyasa'}{' '}
                        {ord.executedShares > 0
                          ? `· Gerç: ${ord.averageExecutionPrice.toFixed(2)} TL`
                          : ''}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-sky-400">
                        {ord.reservedCash > 0
                          ? formatCurrency(ord.reservedCash)
                          : ord.reservedShares > 0
                          ? `${ord.reservedShares} lot`
                          : '—'}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <span
                          className={
                            ord.status === 'FILLED'
                              ? 'text-emerald-400 font-semibold'
                              : isActive
                              ? 'text-amber-400 font-semibold'
                              : 'text-slate-500'
                          }
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {isActive && (
                          <button
                            type="button"
                            onClick={() => onCancelOrder(ord.id)}
                            className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/60 text-rose-200 rounded text-[11px] inline-flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            İptal Et
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alt Bölüm: Portföy Pozisyonları ve Dinamik Haber Akışı */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Portföy Tablosu */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Açık Portföy Pozisyonları & Temettü Getirileri
            </h3>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {portfolioList.length} Aktif Pozisyon
            </span>
          </div>

          {portfolioList.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-xs text-slate-400">
                Portföyünüzde henüz hisse senedi bulunmuyor. Sağ üstteki emir panelinden hisse satın alarak başlayabilirsiniz.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950/60">
                    <th className="py-2 px-3">Hisse</th>
                    <th className="py-2 px-3 text-right">Adet (Lot)</th>
                    <th className="py-2 px-3 text-right">Ort. Maliyet</th>
                    <th className="py-2 px-3 text-right">Güncel Fiyat</th>
                    <th className="py-2 px-3 text-right">Piyasa Değeri</th>
                    <th className="py-2 px-3 text-right">Net K/Z</th>
                    <th className="py-2 px-3 text-right">
                      Tahsil Edilen Temettü
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {portfolioList.map((pos) => {
                    const st = stocks.find((s) => s.ticker === pos.ticker);
                    const currentPrice = st ? st.price : pos.averageCost;
                    const marketVal = pos.shares * currentPrice;
                    const pnl = marketVal - pos.shares * pos.averageCost;
                    return (
                      <tr key={pos.ticker} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-100">
                          {pos.ticker}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">
                          {pos.shares.toLocaleString('tr-TR')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                          {pos.averageCost.toFixed(2)} TL
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-100">
                          {currentPrice.toFixed(2)} TL
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-100">
                          {formatCurrency(marketVal)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                            pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {pnl >= 0 ? '+' : ''}
                          {formatCurrency(pnl)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-sky-400">
                          {formatCurrency(pos.totalDividendCollected)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Dinamik Haber Akışı ve Duyarlılık Sönümlenmesi */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Dinamik Haber Akışı (Sentiment Decay)
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              I(age) = I_0 · e^(-λ·age)
            </span>
          </div>
          <div className="divide-y divide-slate-800 max-h-72 overflow-y-auto">
            {newsFeed.slice(0, 8).map((news) => {
              const isPos = news.sentimentImpact >= 0;
              return (
                <div
                  key={news.id}
                  className="p-3.5 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>
                      Gün {news.day} · Sektör: {news.sector}
                      {news.targetTicker ? ` (${news.targetTicker})` : ''} · λ:{' '}
                      {news.decayRate}
                    </span>
                    <span
                      className={`font-mono tabular-nums font-medium ${
                        isPos ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPos ? (
                        <TrendingUp className="w-3 h-3 inline mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 inline mr-1" />
                      )}
                      Güncel Etki: {isPos ? '+' : ''}
                      {(news.sentimentImpact * 100).toFixed(2)}%
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-100">
                    {news.headline}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {news.summary}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
