/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Clock, Sparkles, X } from 'lucide-react';
import { play } from './ui/feedback';
import { OfflineProgressSummary } from '../../models/simulation';
import { deriveDeterministicOfflineWarningItems } from './city/questAndHudLogic';

interface OfflineProgressModalProps {
  summary: OfflineProgressSummary | null;
  isOpen: boolean;
  onDismiss: () => void;
  formatCurrency: (val: number) => string;
}

export const OfflineProgressModal: React.FC<OfflineProgressModalProps> =
  React.memo(({ summary, isOpen, onDismiss, formatCurrency }) => {
    useEffect(() => {
      if (!isOpen) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onDismiss();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onDismiss]);

    if (!summary || !isOpen) return null;

    const realMinutes = Math.floor(summary.realSecondsElapsed / 60);
    const realSecondsRem = Math.round(summary.realSecondsElapsed % 60);
    const gameHours = Math.floor(summary.gameMinutesAdvanced / 60);
    const gameMinsRem = summary.gameMinutesAdvanced % 60;
    const awayDays = Math.floor(summary.gameMinutesAdvanced / 1440);
    const awayHours = Math.floor((summary.gameMinutesAdvanced % 1440) / 60);
    const awayText =
      [awayDays > 0 ? `${awayDays} gün` : '', awayHours > 0 ? `${awayHours} saat` : '']
        .filter(Boolean)
        .join(' ') || `${gameMinsRem} dakika`;
    const netWorthDelta = Number(
      (summary.endNetWorth - summary.startNetWorth).toFixed(2)
    );

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Çevrimdışı İlerleme Özeti"
        data-testid="offline-progress-modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,28,68,.6)] p-4"
        onClick={onDismiss}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="celebration-in w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] rounded-[26px] bg-white shadow-2xl"
        >
          <div className="g-hero rounded-none px-5 pt-6 pb-5 text-center">
            <button
              type="button"
              aria-label="Çevrimdışı Özetini Kapat"
              onClick={onDismiss}
              className="absolute right-3 top-3 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div
              className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(180deg,#ffe08a,var(--g-gold))', boxShadow: '0 4px 0 var(--g-gold-dark)' }}
            >
              <Clock className="w-7 h-7 text-[#6b4500]" strokeWidth={2.4} />
            </div>
            <h2 className="g-display mt-3 text-2xl font-extrabold text-white">Tekrar hoş geldin!</h2>
            <p className="text-[13px] font-semibold text-white/65">
              Sen yokken {awayText} geçti
              <span className="sr-only">
                {realMinutes > 0 ? `${realMinutes} dk ${realSecondsRem} sn` : `${realSecondsRem} sn`}
              </span>
            </p>
            <div className="mt-4 g-hero-label">Toplam varlığın</div>
            <div
              className={`g-display text-[40px] font-extrabold leading-none tabular-nums ${
                netWorthDelta >= 0 ? 'text-[var(--g-gold)]' : 'text-[#ffb4b2]'
              }`}
            >
              {netWorthDelta >= 0 ? '+' : '−'}
              {formatCurrency(Math.abs(netWorthDelta))}
            </div>
            <div className="text-[13px] font-bold text-white/60 tabular-nums mt-1">
              {formatCurrency(summary.startNetWorth)} → {formatCurrency(summary.endNetWorth)}
            </div>
          </div>

          <div className="p-4 overflow-y-auto space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
              <div className="g-card-soft p-2.5">
                <div className="text-[13px] font-bold text-[var(--g-muted)]">Gelir</div>
                <div className="font-extrabold text-[var(--g-green-dark)]">{formatCurrency(summary.revenueGenerated)}</div>
              </div>
              <div className="g-card-soft p-2.5">
                <div className="text-[13px] font-bold text-[var(--g-muted)]">Gider</div>
                <div className="font-extrabold text-[var(--g-red)]">{formatCurrency(summary.expensesPaid)}</div>
              </div>
              <div className="g-card-soft p-2.5">
                <div className="text-[13px] font-bold text-[var(--g-muted)]">Temettü</div>
                <div className="font-extrabold text-[var(--g-gold-dark)]">{formatCurrency(summary.dividendsCollected)}</div>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 text-[13px] font-bold text-[var(--g-muted)]">
              {summary.ordersExecuted > 0 && <span className="g-pill bg-[var(--g-surface-2)]">{summary.ordersExecuted} emir gerçekleşti</span>}
              {summary.productionCompleted > 0 && <span className="g-pill bg-[var(--g-surface-2)]">{summary.productionCompleted.toFixed(0)} birim üretildi</span>}
              {summary.newsGenerated > 0 && <span className="g-pill bg-[var(--g-surface-2)]">{summary.newsGenerated} yeni haber</span>}
              {summary.ordersExpired > 0 && <span className="g-pill bg-[#ffe9e8] text-[var(--g-red-dark)]">{summary.ordersExpired} emrin süresi doldu</span>}
            </div>
            {summary.warnings.length > 0 && (
              <div className="g-tip flex-col !gap-1">
                {deriveDeterministicOfflineWarningItems(
                  summary.warnings,
                  summary.gameDaysAdvanced,
                  summary.gameMinutesAdvanced
                ).map((item) => (
                  <div key={item.id}>{item.text}</div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 pb-4">
            <button
              type="button"
              data-testid="offline-modal-continue-btn"
              onClick={onDismiss}
              className="g-btn g-btn-gold w-full"
            >
              <Sparkles className="w-4 h-4" />
              <span>Topla ve devam et</span>
            </button>
          </div>
        </div>
      </div>
    );
  });
