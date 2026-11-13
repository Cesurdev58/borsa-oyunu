/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, ChevronRight, X } from 'lucide-react';
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

    // Bütün hedefler bittiyse şerit yer kaplamasın; listeye ayarlardan/rozetten ulaşılır.
    const allDone = completedCount >= totalCount;

    const handleBuildingClick = (buildingId: CityBuildingId) => {
      if (onFocusBuilding) onFocusBuilding(buildingId);
      else if (onOpenBuilding) onOpenBuilding(buildingId);
    };

    return (
      <>
        <section
          aria-label="Aktif Ana Hedef Şeridi"
          data-testid="city-quest-strip"
          className={`g-card px-3 py-2.5 items-center gap-3 ${allDone ? 'hidden' : 'flex'}`}
        >
          <div
            data-testid="active-quest-item"
            data-quest-id={activeQuest.id}
            className="flex items-center gap-3 min-w-0 flex-1"
          >
            <button
              type="button"
              data-testid="open-quest-panel-btn"
              onClick={() => setIsPanelOpen(true)}
              aria-label="Görevler ve İtibar Panelini Aç"
              className="relative w-11 h-11 shrink-0 rounded-full flex items-center justify-center"
              style={{
                background: `conic-gradient(var(--g-green) ${(completedCount / Math.max(1, totalCount)) * 360}deg, #e3e7f0 0deg)`,
              }}
            >
              <span className="absolute inset-[4px] rounded-full bg-white flex items-center justify-center g-display text-[13px] font-extrabold text-[var(--g-navy-800)] leading-none">
                {completedCount}/{totalCount}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-extrabold uppercase tracking-wide text-[var(--g-navy-400)] leading-none">
                Sıradaki hedef
              </div>
              <div className="text-[15px] font-extrabold text-[var(--g-ink)] leading-snug line-clamp-2 mt-0.5">
                {activeQuest.title}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="g-track h-1.5 flex-1">
                  <div className="g-fill" style={{ width: `${activeQuest.completed ? 100 : activeQuest.progressPct}%` }} />
                </div>
                <span
                  data-testid="active-quest-progress"
                  className="tabular-nums font-extrabold text-[13px] text-[var(--g-green-dark)] shrink-0"
                >
                  {activeQuest.progressText}
                </span>
              </div>
            </div>
          </div>
          {completedCount >= totalCount ? (
            <span className="g-pill bg-[#ecfaf3] text-[var(--g-green-dark)] shrink-0">
              <CheckCircle2 className="w-4 h-4" /> Hepsi tamam
            </span>
          ) : (
          <button
            type="button"
            onClick={() =>
              onOpenBuilding
                ? onOpenBuilding(activeQuest.targetBuildingId)
                : handleBuildingClick(activeQuest.targetBuildingId)
            }
            aria-label={`Hedefe git: ${activeQuest.title}`}
            className="g-btn g-btn-primary g-btn-sm shrink-0 px-3.5"
          >
            Git
            <ChevronRight className="w-4 h-4 -mr-1" strokeWidth={3} />
          </button>
          )}
        </section>

        {/* Görevler ve Kozmetik/İtibar Ödülleri Modalı */}
        {isPanelOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Finans Şehri Görev ve İtibar Paneli"
            data-testid="quest-list-modal"
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.55)] p-3 sm:p-4"
            onClick={() => setIsPanelOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="g-rise w-full max-w-md max-h-[82vh] bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden text-sm"
            >
              <div className="g-hero rounded-none px-4 py-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Award className="w-6 h-6 text-[var(--g-gold)]" />
                  <div>
                    <h2 className="g-display text-lg font-extrabold text-white leading-tight">
                      Hedefler
                    </h2>
                    <p className="text-[13px] text-white/70 font-semibold">
                      {completedCount}/{totalCount} tamam · İtibar:{' '}
                      <strong className="tabular-nums text-[var(--g-gold)]">
                        {earnedReputationPoints} Puan
                      </strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Görev Panelini Kapat"
                  onClick={() => setIsPanelOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-2 flex-1">
                {allQuests.map((q) => {
                  const isCurrent = q.id === activeQuest.id && !q.completed;
                  return (
                    <div
                      key={q.id}
                      data-testid={`quest-modal-row-${q.id}`}
                      className={`p-3 rounded-2xl border-[1.5px] flex items-center justify-between gap-2.5 ${
                        q.completed
                          ? 'bg-[#ecfaf3] border-transparent text-[var(--g-ink)]'
                          : isCurrent
                          ? 'bg-white border-[var(--g-navy-400)] text-[var(--g-ink)] shadow-sm'
                          : 'bg-[var(--g-surface-2)] border-transparent text-[var(--g-muted)]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2
                            className={`w-5 h-5 shrink-0 ${
                              q.completed
                                ? 'text-[var(--g-green)]'
                                : isCurrent
                                ? 'text-[var(--g-navy-400)]'
                                : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate">
                            {q.stepNumber}. {q.title}
                          </span>
                        </div>
                        <div className="text-[13px] text-[var(--g-muted)] mt-0.5 pl-7">
                          {q.rewardLabel}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="tabular-nums font-bold text-[13px]">
                          {q.completed ? '✓' : q.progressText}
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
