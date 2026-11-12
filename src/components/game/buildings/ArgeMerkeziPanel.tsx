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
import { HelpTip } from '../ui/HelpTip';

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
              🔒 Ar-Ge Merkezi kilitli
            </h3>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Ürünlerini daha kaliteli yapmak için önce kendi şirketini kurmalısın.
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
      <div className="rounded-3xl bg-gradient-to-br from-violet-100 to-fuchsia-100 p-5 text-center space-y-2">
        <div className="text-sm font-bold text-violet-800">⭐ Ürün kalitesi</div>
        <div className="text-5xl font-extrabold text-violet-900 tabular-nums">
          x{pc.techQualityMultiplier.toFixed(2)}
        </div>
        <div className="h-4 rounded-full bg-white/70 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-500"
            style={{ width: `${qualityProgressPct}%` }}
          />
        </div>
        <div className="text-sm font-bold text-violet-800 tabular-nums">
          🔬 Her gün {formatCurrency(pc.dailyRdBudget)}
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[13px] text-amber-900">
        <span>💡</span>
        <span>
          Ar-Ge'ye her gün para ayırırsan ürünlerin zamanla daha kaliteli olur
          ve daha pahalıya satılır.
        </span>
        <HelpTip text="Ar-Ge parası şirket kasandan her gün düşer. Kalite yükselince ürün fiyatın artar ama ilk günlerde kasan biraz azalır." />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            onConfigureOperations({
              dailyRdBudget: pc.dailyRdBudget + 10_000,
            })
          }
          className="min-h-[52px] px-3 py-2 rounded-2xl bg-gradient-to-b from-violet-400 to-violet-600 text-white font-extrabold shadow active:scale-95"
        >
          ➕ Ar-Ge parasını artır (+₺10.000)
        </button>
        <button
          type="button"
          onClick={() =>
            onConfigureOperations({
              dailyRdBudget: Math.max(0, pc.dailyRdBudget - 5_000),
            })
          }
          className="min-h-[52px] px-3 py-2 rounded-2xl bg-slate-100 text-slate-800 font-extrabold active:scale-95"
        >
          ➖ Azalt (−₺5.000)
        </button>
      </div>
    </div>
  );
};
