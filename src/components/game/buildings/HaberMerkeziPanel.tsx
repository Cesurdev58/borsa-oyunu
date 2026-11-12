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

export const HaberMerkeziPanel: React.FC<BuildingDetailContentProps> = ({
  state,
}) => {
  return (
    <div
      className="space-y-3 text-xs"
      data-testid="sheet-content-HABER_MERKEZI"
    >
      <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-2">
        <div>
          <div className="font-bold text-amber-950">
            Dinamik Haber Akışı & Duyarlılık Sönümlenmesi
          </div>
          <div className="text-[11px] text-amber-800">
            Her haberin fiyat etkisi yaşlandıkça üstel olarak azalır: I(yaş) =
            I₀ · e^(-λ·yaş)
          </div>
        </div>
        <span className="font-mono font-bold text-amber-900 shrink-0">
          {state.newsFeed.length} Haber
        </span>
      </div>

      <div className="space-y-2">
        {state.newsFeed.map((news) => {
          const ageDays = Math.max(0, state.day - news.day);
          const currentImpactPct = news.sentimentImpact * 100;
          const initialImpactPct = news.initialImpact * 100;
          return (
            <div
              key={news.id}
              className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-slate-900">
                    Gün {news.day}
                  </span>
                  <span>·</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                    Sektör: {news.sector}
                  </span>
                  {news.targetTicker && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 font-bold">
                      {news.targetTicker}
                    </span>
                  )}
                  <span>·</span>
                  <span className="text-slate-500">Yaş: {ageDays} gün</span>
                </div>

                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded ${
                    currentImpactPct >= 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  Güncel Etki: {currentImpactPct >= 0 ? '+' : ''}
                  {currentImpactPct.toFixed(2)}% (İlk:{' '}
                  {initialImpactPct >= 0 ? '+' : ''}
                  {initialImpactPct.toFixed(2)}%)
                </span>
              </div>

              <h4 className="font-bold text-slate-900 text-xs">
                {news.headline}
              </h4>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                {news.summary}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
