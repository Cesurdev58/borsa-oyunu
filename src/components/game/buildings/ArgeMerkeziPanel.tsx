/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ARGE_MERKEZI bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import React from 'react';
import {
  Lock,
} from 'lucide-react';

import type {
  BuildingDetailContentProps,
} from './buildingTypes';

export const ArgeMerkeziPanel: React.FC<BuildingDetailContentProps> = ({
  state,
  onConfigureOperations,
  formatCurrency,
}) => {
  const pc = state.playerCompany;
  if (!pc) {
    return (
      <div
        className="space-y-3 text-xs"
        data-testid="sheet-content-ARGE_MERKEZI-locked"
      >
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-violet-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Ar-Ge Merkezi Kilitli
            </h3>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Teknoloji kalitesi ve patent çarpanı geliştirmek için önce Aşama
            2’de kendi şirketinizi kurmanız gerekmektedir.
          </p>
        </div>
      </div>
    );
  }

  const qualityProgressPct = Math.min(
    100,
    Math.round(((pc.techQualityMultiplier - 1.0) / 1.5) * 100)
  );

  return (
    <div
      className="space-y-4 text-xs"
      data-testid="sheet-content-ARGE_MERKEZI-active"
    >
      <div className="grid grid-cols-2 gap-2.5 tabular-nums tabular-nums">
        <div className="p-3 rounded-2xl bg-violet-50/70 border border-violet-200">
          <div className="text-violet-800 text-[13px]">
            Günlük Ar-Ge Bütçesi
          </div>
          <div className="text-base font-bold text-violet-950 mt-0.5">
            {formatCurrency(pc.dailyRdBudget)}/gün
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
          <div className="text-emerald-800 text-[13px]">
            Teknoloji Kalite Çarpanı
          </div>
          <div className="text-base font-bold text-emerald-950 mt-0.5">
            x{pc.techQualityMultiplier.toFixed(4)}
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2">
        <div className="flex justify-between font-semibold text-slate-800">
          <span>İnovasyon & Ürün Kalite Seviyesi (Maks x2.50)</span>
          <span className="tabular-nums">%{qualityProgressPct}</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-600 rounded-full transition-all"
            style={{ width: `${qualityProgressPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            onConfigureOperations({
              dailyRdBudget: pc.dailyRdBudget + 10_000,
            })
          }
          className="min-h-[44px] px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold"
        >
          Ar-Ge Bütçesini +₺10.000 Artır
        </button>
        <button
          type="button"
          onClick={() =>
            onConfigureOperations({
              dailyRdBudget: Math.max(0, pc.dailyRdBudget - 5_000),
            })
          }
          className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold"
        >
          Ar-Ge Bütçesini -₺5.000 Azalt
        </button>
      </div>
    </div>
  );
};
