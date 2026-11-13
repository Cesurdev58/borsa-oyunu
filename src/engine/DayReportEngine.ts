/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gün sonu raporu: 00:00'da gün kapanınca biten günün özetini çıkarır
 * (şirket, dükkânlar, borsa, temettü, vergi). Yalnızca okur, hiçbir parayı değiştirmez.
 */

import type { DayReport, DailyLogEntry, SimulationState } from '../models/simulation';

const r2 = (v: number) => Number((Number.isFinite(v) ? v : 0).toFixed(2));

export interface DayReportExtras {
  dividends: number;
  holdingIncome: number;
  /** Kapanıştan önceki gün sonu kaydı (başlangıç değerleri buradan gelir) */
  previousLog?: DailyLogEntry;
  /** Kapanıştan önceki net varlık (önceki kayıt yoksa) */
  netWorthBeforeClose: number;
  portfolioBeforeClose: number;
}

export function buildDayReport(
  state: SimulationState,
  closedDay: number,
  extras: DayReportExtras
): DayReport {
  const prev = extras.previousLog;
  const netWorthStart = prev ? prev.netWorth : extras.netWorthBeforeClose;
  const portfolioStart = prev ? prev.portfolioMarketValue : extras.portfolioBeforeClose;

  // Borsa: portföy değerindeki değişimden o gün yapılan alım-satım tutarını çıkar
  let buys = 0;
  let sells = 0;
  let trades = 0;
  for (const tx of state.transactions) {
    if (tx.day !== closedDay) continue;
    if (tx.type === 'BUY') {
      buys += tx.grossAmount;
      trades += 1;
    } else if (tx.type === 'SELL') {
      sells += tx.grossAmount;
      trades += 1;
    }
  }
  const pnl = state.portfolioValue - portfolioStart - buys + sells;

  let best: { ticker: string; pct: number } | undefined;
  let worst: { ticker: string; pct: number } | undefined;
  for (const [ticker, pos] of Object.entries(state.portfolio)) {
    if (!pos || pos.shares <= 0) continue;
    const st = state.stocks.find((s) => s.ticker === ticker);
    if (!st || st.priceHistory.length < 2) continue;
    const start = st.priceHistory[st.priceHistory.length - 2];
    if (!(start > 0)) continue;
    const pct = r2((st.price / start - 1) * 100);
    if (!best || pct > best.pct) best = { ticker, pct };
    if (!worst || pct < worst.pct) worst = { ticker, pct };
  }

  // Dükkânlar (şirket şubeleri şirketin içinde sayılır)
  const shops = (state.tradeState?.shops ?? [])
    .filter((sh) => !sh.isCompanyBranch)
    .map((sh) => ({
      shopId: sh.shopId,
      name: sh.nameTR,
      shopType: sh.shopType,
      revenue: r2(sh.todaySalesRevenue),
      profit: r2(sh.todayNetProfit),
      customers: sh.todayServedCustomers,
    }));

  // Şirket: muhasebe yıllıklaştırılmış tutar tutar (120 gün), günlüğe çevrilir
  let company: DayReport['company'];
  const pc = state.playerCompany;
  if (pc) {
    const revenue = r2(pc.financials.revenue / 120);
    const profit = r2(pc.financials.netIncome / 120);
    company = {
      name: pc.name,
      revenue,
      costs: r2(revenue - profit),
      profit,
      marketSharePct: pc.operations?.playerMarketSharePct,
    };
  }

  const wealthTax =
    state.wealthTax && state.wealthTax.lastDay === state.day
      ? r2(state.wealthTax.lastAmount)
      : 0;

  return {
    day: closedDay,
    netWorthStart: r2(netWorthStart),
    netWorthEnd: r2(state.netWorth),
    cashEnd: r2(state.cash),
    market: {
      pnl: r2(pnl),
      portfolioValue: r2(state.portfolioValue),
      trades,
      best,
      worst,
    },
    dividends: r2(extras.dividends),
    holdingIncome: r2(extras.holdingIncome),
    shops,
    shopsRevenue: r2(shops.reduce((a, s) => a + s.revenue, 0)),
    shopsProfit: r2(shops.reduce((a, s) => a + s.profit, 0)),
    company,
    wealthTax,
  };
}
