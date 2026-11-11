/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Clock, Sparkles, TrendingUp, X } from 'lucide-react';
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
    const netWorthDelta = Number(
      (summary.endNetWorth - summary.startNetWorth).toFixed(2)
    );

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Çevrimdışı İlerleme Özeti"
        data-testid="offline-progress-modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4"
        onClick={onDismiss}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Başlık */}
          <div className="px-5 py-4 bg-gradient-to-r from-sky-50 to-emerald-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs">
                <Clock className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Çevrimdışı İlerleme Raporu
                </h2>
                <p className="text-xs text-slate-600">
                  Siz yokken finans şehrinde gerçekleşen işlemler
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Çevrimdışı Özetini Kapat"
              onClick={onDismiss}
              className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-white/80 flex items-center justify-center text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* İçerik */}
          <div className="p-5 overflow-y-auto space-y-4 text-xs">
            {/* Geçen Süre Özeti */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Geçen Gerçek Süre</div>
                <div className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  {realMinutes > 0
                    ? `${realMinutes} dk ${realSecondsRem} sn`
                    : `${realSecondsRem} sn`}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200/80">
                <div className="text-sky-800">İlerleyen Oyun Süresi</div>
                <div className="text-sm font-bold font-mono tabular-nums text-sky-950 mt-0.5">
                  {summary.gameDaysAdvanced} Gün ({gameHours} sa {gameMinsRem}{' '}
                  dk)
                </div>
              </div>
            </div>

            {/* Net Varlık Değişimi */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
              <div className="flex items-center justify-between text-emerald-900 font-semibold">
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  Net Varlık Değişimi
                </span>
                <span
                  className={`font-mono font-bold ${
                    netWorthDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {netWorthDelta >= 0 ? '+' : ''}
                  {formatCurrency(netWorthDelta)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-700">
                <span>Başlangıç: {formatCurrency(summary.startNetWorth)}</span>
                <span>→</span>
                <span className="font-bold text-slate-900">
                  Bitiş: {formatCurrency(summary.endNetWorth)}
                </span>
              </div>
            </div>

            {/* Operasyonel & Piyasa Detayları */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Gerçekleşen Emir:</span>
                <strong className="font-mono text-slate-900">
                  {summary.ordersExecuted}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Süresi Dolan Emir:</span>
                <strong className="font-mono text-slate-900">
                  {summary.ordersExpired}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Üretim Miktarı:</span>
                <strong className="font-mono text-slate-900">
                  {summary.productionCompleted.toFixed(0)} br
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Şirket Geliri:</span>
                <strong className="font-mono text-emerald-700">
                  {formatCurrency(summary.revenueGenerated)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Şirket Gideri:</span>
                <strong className="font-mono text-rose-700">
                  {formatCurrency(summary.expensesPaid)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Ar-Ge İlerlemesi:</span>
                <strong className="font-mono text-violet-700">
                  +{summary.researchProgress.toFixed(4)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Tahsil Edilen Temettü:</span>
                <strong className="font-mono text-amber-700">
                  {formatCurrency(summary.dividendsCollected)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Yeni Haberler:</span>
                <strong className="font-mono text-slate-900">
                  {summary.newsGenerated} Bülten
                </strong>
              </div>
            </div>

            {summary.warnings.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                {deriveDeterministicOfflineWarningItems(
                  summary.warnings,
                  summary.gameDaysAdvanced,
                  summary.gameMinutesAdvanced
                ).map((item) => (
                  <div key={item.id}>• {item.text}</div>
                ))}
              </div>
            )}
          </div>

          {/* Alt Aksiyon */}
          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              data-testid="offline-modal-continue-btn"
              onClick={onDismiss}
              className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Devam Et</span>
            </button>
          </div>
        </div>
      </div>
    );
  });
