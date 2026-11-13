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
              Ar-Ge Merkezi kilitli
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
      <div className="g-hero p-5 text-center space-y-2">
        <div className="text-sm font-bold text-white/65">Ürün kalitesi</div>
        <div className="text-5xl font-extrabold tabular-nums g-hero-value">
          x{pc.techQualityMultiplier.toFixed(2)}
        </div>
        <div className="g-track h-3">
          <div
            className="g-fill"
            style={{ width: `${qualityProgressPct}%` }}
          />
        </div>
        <div className="text-sm font-bold text-white/65 tabular-nums">
          Her gün {formatCurrency(pc.dailyRdBudget)}
        </div>
      </div>

      <div className="g-tip">
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
          className="g-btn g-btn-navy px-3"
        >
          Ar-Ge parasını artır (+₺10.000)
        </button>
        <button
          type="button"
          onClick={() =>
            onConfigureOperations({
              dailyRdBudget: Math.max(0, pc.dailyRdBudget - 5_000),
            })
          }
          className="g-btn g-btn-secondary px-3"
        >
          Azalt (−₺5.000)
        </button>
      </div>
    </div>
  );
};
