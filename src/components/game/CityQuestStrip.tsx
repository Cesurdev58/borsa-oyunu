/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, ChevronRight, Target, X } from 'lucide-react';
import { SimulationState } from '../../models/simulation';
import { CityBuildingId } from './gameTypes';
import {
  CityQuestStripModel,
  deriveCityQuestStripModel,
} from './city/questAndHudLogic';

interface CityQuestStripProps {
  questModel?: CityQuestStripModel;
  state?: SimulationState;
  hasOpenedBorsaBuilding?: boolean;
  onFocusBuilding?: (buildingId: CityBuildingId) => void;
  onOpenBuilding?: (buildingId: CityBuildingId) => void;
}

/**
 * Ana şehir görünümünde oyuncunun sıradaki TEK ana hedefini gösteren kompakt görev şeridi.
 * - Aynı anda yalnızca 1 aktif görev gösterir.
 * - Ödüller yalnızca itibar puanı, profil rozeti ve kozmetik şehir unvanıdır; ekonomik nakit dengesini bozmaz.
 */
export const CityQuestStrip: React.FC<CityQuestStripProps> = React.memo(
  ({
    questModel,
    state,
    hasOpenedBorsaBuilding = false,
    onFocusBuilding,
    onOpenBuilding,
  }) => {
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const resolvedModel = useMemo(() => {
      if (questModel) return questModel;
      if (state) {
        return deriveCityQuestStripModel(state, hasOpenedBorsaBuilding);
      }
      return null;
    }, [questModel, state, hasOpenedBorsaBuilding]);

    if (!resolvedModel) return null;

    const {
      activeQuest,
      allQuests,
      completedCount,
      totalCount,
      earnedReputationPoints,
    } = resolvedModel;

    const handleBuildingClick = (buildingId: CityBuildingId) => {
      if (onFocusBuilding) onFocusBuilding(buildingId);
      else if (onOpenBuilding) onOpenBuilding(buildingId);
    };

    return (
      <>
        <section
          aria-label="Aktif Ana Hedef Şeridi"
          data-testid="city-quest-strip"
          className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-emerald-50 px-3 py-2 shadow-md flex items-center justify-between gap-2"
        >
          {/* Tek Ana Hedef Satırı */}
          <div
            data-testid="active-quest-item"
            data-quest-id={activeQuest.id}
            className="flex items-center gap-2 min-w-0 flex-1"
          >
            <button
              type="button"
              onClick={() => handleBuildingClick(activeQuest.targetBuildingId)}
              aria-label={`Hedef binaya odaklan: ${activeQuest.title}`}
              className="w-7 h-7 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 hover:bg-emerald-100 transition-colors"
            >
              <Target className="w-3.5 h-3.5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-900 truncate">
                  Hedef {activeQuest.stepNumber}: {activeQuest.title}
                </span>
                <span
                  data-testid="active-quest-progress"
                  className="font-mono font-bold text-[10px] text-emerald-700 shrink-0"
                >
                  ({activeQuest.progressText})
                </span>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="truncate">Ödül: {activeQuest.rewardLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-amber-700 font-semibold shrink-0">
                  İtibar: {earnedReputationPoints}P
                </span>
              </div>
            </div>
          </div>

          {/* Görev Panelini Aç Düğmesi */}
          <button
            type="button"
            data-testid="open-quest-panel-btn"
            onClick={() => setIsPanelOpen(true)}
            aria-label="Görevler ve İtibar Panelini Aç"
            className="min-h-[36px] px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
          >
            <span>
              Görevler ({completedCount}/{totalCount})
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </section>

        {/* Görevler ve Kozmetik/İtibar Ödülleri Modalı */}
        {isPanelOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Finans Şehri Görev ve İtibar Paneli"
            data-testid="quest-list-modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
            onClick={() => setIsPanelOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[80vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-xs"
            >
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-emerald-50/50">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-700" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Şehir Hedefleri & İtibar Rozetleri
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      Tamamlanan: {completedCount}/{totalCount} · Toplam İtibar:{' '}
                      <strong className="font-mono text-emerald-800">
                        {earnedReputationPoints} Puan
                      </strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Görev Panelini Kapat"
                  onClick={() => setIsPanelOpen(false)}
                  className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white flex items-center justify-center text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-2 flex-1">
                {allQuests.map((q) => {
                  const isCurrent = q.id === activeQuest.id && !q.completed;
                  return (
                    <div
                      key={q.id}
                      data-testid={`quest-modal-row-${q.id}`}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 ${
                        q.completed
                          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                          : isCurrent
                          ? 'bg-sky-50/70 border-sky-300 text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 ${
                              q.completed
                                ? 'text-emerald-600'
                                : isCurrent
                                ? 'text-sky-600'
                                : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate">
                            {q.stepNumber}. {q.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 pl-5">
                          Ödül: {q.rewardLabel}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-[11px]">
                          {q.completed ? 'TAMAM' : q.progressText}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
);
