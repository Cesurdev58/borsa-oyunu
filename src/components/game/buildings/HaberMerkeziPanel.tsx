/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HABER_MERKEZI bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import React from 'react';

import type {
  BuildingDetailContentProps,
} from './buildingTypes';
import { HelpTip } from '../ui/HelpTip';
import { Siren } from 'lucide-react';
import { WorldEventEffectsList } from '../WorldEventCard';

export const HaberMerkeziPanel: React.FC<BuildingDetailContentProps> = ({
  state,
}) => {
  // Olağanüstü olayların sektör haberleri tek kartta toplanır, listede tekrar gösterilmez
  const recentEvents = (state.worldEvents?.history ?? []).filter((e) => state.day - e.startDay <= 14);
  const normalNews = state.newsFeed.filter((n) => !n.worldEventId);
  return (
    <div
      className="space-y-3 text-xs"
      data-testid="sheet-content-HABER_MERKEZI"
    >
      <div className="g-tip items-center">
        <span className="flex-1">Yeşil haber genelde yükseltir, kırmızı düşürür. Ama piyasa bazen haberi zaten bekliyordur ya da ters tepki verir.</span>
        <span className="tabular-nums font-extrabold shrink-0 flex items-center gap-1">
          {normalNews.length} haber
          <HelpTip text="Haber ilk gün yalnızca beklentidir. Ertesi gün piyasanın gerçek tepkisi görünür; etki günler geçtikçe zayıflar." />
        </span>
      </div>

      {recentEvents.map((ev) => {
        const active = ev.endDay >= state.day;
        return (
          <div
            key={ev.id}
            data-testid={`news-world-event-${ev.id}`}
            className="g-card overflow-hidden border-2 border-[var(--g-red)]"
          >
            <div className="bg-[var(--g-red)] text-white px-3 py-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold tracking-wide">
                <Siren className="w-4 h-4" /> {active ? 'SÜREN OLAY' : 'GEÇEN OLAY'}
              </span>
              <span className="text-[13px] font-bold tabular-nums opacity-90">
                Gün {ev.startDay}
              </span>
            </div>
            <div className="p-3 space-y-2">
              <h4 className="font-extrabold text-[var(--g-ink)] text-sm leading-snug">{ev.title}</h4>
              <p className="text-[var(--g-muted)] text-[13px] leading-relaxed">{ev.body}</p>
              {active ? (
                <WorldEventEffectsList ev={ev} day={state.day} />
              ) : (
                <div className="text-[13px] text-[var(--g-muted)]">
                  Dükkân etkisi bitti; borsadaki etkisi yavaş yavaş sönüyor.
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="space-y-2">
        {normalNews.map((news) => {
          const ageDays = Math.max(0, state.day - news.day);
          // İlk gün yalnızca beklenti görünür; ertesi gün piyasanın gerçek tepkisi
          const showExpectation = ageDays === 0 && typeof news.expectedImpact === 'number';
          const currentImpactPct = (showExpectation ? news.expectedImpact! : news.sentimentImpact) * 100;
          const initialImpactPct = news.initialImpact * 100;
          return (
            <div
              key={news.id}
              className="g-card p-3 space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-[13px]">
                <div className="flex items-center gap-1.5 tabular-nums">
                  <span className="font-bold text-[var(--g-ink)]">
                    Gün {news.day}
                  </span>
                  <span>·</span>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--g-surface-2)] text-[var(--g-ink)] font-semibold">
                    {news.sector}
                  </span>
                  {news.targetTicker && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 font-bold">
                      {news.targetTicker}
                    </span>
                  )}
                  <span>·</span>
                  <span className="text-[var(--g-muted)]">{ageDays === 0 ? 'Bugün' : `${ageDays} gün önce`}</span>
                </div>

                <span
                  className={`tabular-nums font-bold px-2 py-0.5 rounded ${
                    currentImpactPct >= 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {showExpectation ? 'Beklenti: ' : ''}
                  {currentImpactPct >= 0 ? 'Yükseltir' : 'Düşürür'}{' '}
                  {currentImpactPct >= 0 ? '+' : ''}
                  {currentImpactPct.toFixed(1)}%
                </span>
              </div>

              <h4 className="font-bold text-[var(--g-ink)] text-xs">
                {news.headline}
              </h4>
              <p className="text-[var(--g-muted)] text-[13px] leading-relaxed">
                {news.summary}
              </p>
              {!showExpectation && news.reaction && (
                <p
                  data-testid={`news-reaction-${news.id}`}
                  className="text-[13px] font-bold text-amber-700"
                >
                  {news.reaction === 'PRICED_IN'
                    ? 'Piyasa bunu zaten bekliyordu, etkisi küçük kaldı.'
                    : 'Piyasa beklenenin tersine tepki verdi.'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
