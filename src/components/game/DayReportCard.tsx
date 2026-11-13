/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gün sonu raporu: gün 00:00'da dönünce sol altta altın "Gün raporu" kapsülü çıkar,
 * dokununca biten günün özeti açılır (toplam değişim, şirket, dükkânlar, borsa).
 * Kendiliğinden açılmaz; oyunu bölmez. Ayarlardan kapatılabilir.
 */
import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Building2, CandlestickChart, Store, X } from 'lucide-react';
import type { DayReport } from '../../models/simulation';
import { SHOP_EMOJI } from './ui/shopEmoji';
import { play } from './ui/feedback';

interface DayReportCardProps {
  report?: DayReport;
  enabled: boolean;
  formatCurrency: (v: number) => string;
}

const signed = (fc: (v: number) => string, v: number) =>
  `${v >= 0 ? '+' : '−'}${fc(Math.abs(v))}`;

const tone = (v: number) =>
  v > 0 ? 'text-[var(--g-green-dark)]' : v < 0 ? 'text-[var(--g-red)]' : 'text-[var(--g-muted)]';

export const DayReportView: React.FC<{
  report: DayReport;
  formatCurrency: (v: number) => string;
  onClose: () => void;
}> = ({ report, formatCurrency: fc, onClose }) => {
  const delta = report.netWorthEnd - report.netWorthStart;
  const extras = report.dividends + report.holdingIncome;
  // Kutulardaki kalemler dışında kalan değişim (şirket/dükkân değerindeki artış, faiz, kira vb.)
  const other =
    delta -
    (report.company?.profit ?? 0) -
    report.shopsProfit -
    report.market.pnl -
    extras +
    report.wealthTax;
  const showOther = Math.abs(other) >= 1;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${report.day}. gün raporu`}
      data-testid="day-report-card"
      className="fixed inset-0 z-[52] flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.55)] p-3"
      onClick={onClose}
    >
      <div
        className="celebration-in w-full max-w-sm max-h-[88dvh] overflow-y-auto rounded-[26px] bg-[var(--g-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="g-hero rounded-none px-5 pt-4 pb-5">
          <div className="flex items-center justify-between">
            <span className="g-hero-label">{report.day}. gün bitti</span>
            <button
              type="button"
              aria-label="Kapat"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-[13px] font-bold text-white/60 mt-1">Bugün varlığın</div>
          <div
            data-testid="day-report-delta"
            className={`g-display text-[40px] leading-tight font-extrabold tabular-nums ${
              delta >= 0 ? 'text-[var(--g-gold)]' : 'text-[#ff8a87]'
            }`}
          >
            {signed(fc, delta)}
          </div>
          <div className="text-[13px] text-white/70 tabular-nums">
            Toplam varlık: {fc(report.netWorthEnd)}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Şirket', v: report.company?.profit, show: !!report.company },
              { label: 'Dükkânlar', v: report.shopsProfit, show: report.shops.length > 0 },
              { label: 'Borsa', v: report.market.pnl, show: true },
            ].map((t) => (
              <div key={t.label} className="g-hero-tile p-2 text-center">
                <div className="text-[13px] font-bold text-white/60">{t.label}</div>
                <div
                  className={`text-[15px] font-extrabold tabular-nums ${
                    !t.show ? 'text-white/40' : (t.v ?? 0) >= 0 ? 'text-[#5ee6a5]' : 'text-[#ff8a87]'
                  }`}
                >
                  {t.show ? signed(fc, t.v ?? 0) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 space-y-3">
          {report.company && (
            <section className="g-card p-3.5" data-testid="day-report-company">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-[var(--g-navy-600)]" />
                <h3 className="g-section-title truncate">{report.company.name}</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                <div className="g-card-soft p-2">
                  <div className="text-[13px] text-[var(--g-muted)] font-bold">Satış</div>
                  <div className="font-extrabold">{fc(report.company.revenue)}</div>
                </div>
                <div className="g-card-soft p-2">
                  <div className="text-[13px] text-[var(--g-muted)] font-bold">Gider</div>
                  <div className="font-extrabold">{fc(report.company.costs)}</div>
                </div>
                <div className="g-card-soft p-2">
                  <div className="text-[13px] text-[var(--g-muted)] font-bold">Kâr</div>
                  <div className={`font-extrabold ${tone(report.company.profit)}`}>
                    {signed(fc, report.company.profit)}
                  </div>
                </div>
              </div>
              {typeof report.company.marketSharePct === 'number' && (
                <div className="mt-2 text-[13px] text-[var(--g-muted)]">
                  Pazar payın: <b>%{report.company.marketSharePct.toFixed(1)}</b>
                </div>
              )}
            </section>
          )}

          {report.shops.length > 0 && (
            <section className="g-card p-3.5" data-testid="day-report-shops">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-[var(--g-navy-600)]" />
                  <h3 className="g-section-title">Dükkânlar</h3>
                </div>
                <span className="text-[13px] text-[var(--g-muted)] tabular-nums">
                  Satış {fc(report.shopsRevenue)}
                </span>
              </div>
              <div className="space-y-1.5">
                {report.shops.map((sh) => (
                  <div
                    key={sh.shopId}
                    className="g-card-soft p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl leading-none">
                        {SHOP_EMOJI[sh.shopType as keyof typeof SHOP_EMOJI] ?? '🏪'}
                      </span>
                      <div className="min-w-0">
                        <div className="font-extrabold truncate">{sh.name}</div>
                        <div className="text-[13px] text-[var(--g-muted)] tabular-nums">
                          {sh.customers} müşteri · satış {fc(sh.revenue)}
                        </div>
                      </div>
                    </div>
                    <span className={`font-extrabold tabular-nums shrink-0 ${tone(sh.profit)}`}>
                      {signed(fc, sh.profit)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="g-card p-3.5" data-testid="day-report-market">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <CandlestickChart className="w-5 h-5 text-[var(--g-navy-600)]" />
                <h3 className="g-section-title">Borsa</h3>
              </div>
              <span className={`font-extrabold tabular-nums ${tone(report.market.pnl)}`}>
                {signed(fc, report.market.pnl)}
              </span>
            </div>
            {report.market.portfolioValue > 0 ? (
              <div className="space-y-1 text-[13px] text-[var(--g-muted)] tabular-nums">
                <div>
                  Hisselerinin değeri: <b className="text-[var(--g-ink)]">{fc(report.market.portfolioValue)}</b>
                  {report.market.trades > 0 ? ` · ${report.market.trades} alım-satım` : ''}
                </div>
                {report.market.best && report.market.best.pct > 0 && (
                  <div>
                    En çok kazandıran: <b className="text-[var(--g-green-dark)]">{report.market.best.ticker} +%{report.market.best.pct.toFixed(1)}</b>
                  </div>
                )}
                {report.market.worst && report.market.worst.pct < 0 && (
                  <div>
                    En çok düşen: <b className="text-[var(--g-red)]">{report.market.worst.ticker} −%{Math.abs(report.market.worst.pct).toFixed(1)}</b>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[13px] text-[var(--g-muted)]">Elinde hisse yok.</div>
            )}
          </section>

          {(extras > 0 || report.wealthTax > 0 || showOther) && (
            <section className="g-card p-3.5 space-y-1 text-[13px] tabular-nums" data-testid="day-report-extras">
              {report.dividends > 0 && (
                <div className="flex justify-between">
                  <span>Temettü</span>
                  <b className="text-[var(--g-green-dark)]">+{fc(report.dividends)}</b>
                </div>
              )}
              {report.holdingIncome > 0 && (
                <div className="flex justify-between">
                  <span>Holding kazancı</span>
                  <b className="text-[var(--g-green-dark)]">+{fc(report.holdingIncome)}</b>
                </div>
              )}
              {showOther && (
                <div className="flex justify-between gap-2" data-testid="day-report-other">
                  <span>Diğer (şirket değeri, faiz, kira…)</span>
                  <b className={tone(other)}>{signed(fc, other)}</b>
                </div>
              )}
              {report.wealthTax > 0 && (
                <div className="flex justify-between">
                  <span>Servet vergisi</span>
                  <b className="text-[var(--g-red)]">−{fc(report.wealthTax)}</b>
                </div>
              )}
            </section>
          )}

          <button
            type="button"
            data-testid="day-report-close-btn"
            onClick={onClose}
            className="g-btn g-btn-gold w-full"
          >
            Devam et
          </button>
        </div>
      </div>
    </div>
  );
};

export const DayReportCard: React.FC<DayReportCardProps> = ({ report, enabled, formatCurrency }) => {
  // İlk açılışta (kayıt yüklenince) var olan rapor "görülmüş" sayılır; yalnızca oyun
  // açıkken dönen günler kapsül çıkarır.
  const seenDayRef = useRef<number>(report?.day ?? 0);
  const [readyDay, setReadyDay] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!report || report.day <= seenDayRef.current) return;
    seenDayRef.current = report.day;
    if (!enabled) return;
    setReadyDay(report.day);
    play('coin');
  }, [report?.day, enabled]);

  if (!enabled || !report) return null;

  if (open) {
    return (
      <DayReportView
        report={report}
        formatCurrency={formatCurrency}
        onClose={() => {
          setOpen(false);
          setReadyDay(null);
        }}
      />
    );
  }

  if (readyDay === null) return null;
  const delta = report.netWorthEnd - report.netWorthStart;
  return (
    <button
      type="button"
      data-testid="day-report-capsule"
      onClick={() => setOpen(true)}
      className="g-btn g-btn-gold g-btn-sm fixed left-3 bottom-[92px] z-40 shadow-lg g-rise"
    >
      <BarChart3 className="w-4 h-4" />
      <span>{report.day}. gün raporu</span>
      <span className="tabular-nums">{delta >= 0 ? '+' : '−'}{formatCurrency(Math.abs(delta))}</span>
    </button>
  );
};
