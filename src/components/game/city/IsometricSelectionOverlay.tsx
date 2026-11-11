/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building,
  HardHat,
  Lock,
  Sparkles,
  X,
} from 'lucide-react';
import { CityBuildingId } from '../gameTypes';
import {
  CityUrbanBlockNode,
  CompanySubTabRoute,
  IsometricBuildingNode,
} from './cityVisualTypes';

interface IsometricSelectionOverlayProps {
  selectedBuilding: IsometricBuildingNode | null;
  selectedUrbanBlock?: CityUrbanBlockNode | null;
  onOpenDetailSheet: (
    id: CityBuildingId,
    companySubTab?: CompanySubTabRoute
  ) => void;
  onClearSelection: () => void;
}

/**
 * Seçili veya kilitli bir binaya / şehir bloğuna dokunulduğunda harita üzerinde sol üstte gösterilen
 * sade seçim bilgi kartı (Bölüm 7 & 16):
 * - Bina adı, seviyesi ve bölgesi
 * - Aktif / Kilitli / Dekoratif sınıflandırması
 * - Kilitli binalarda: neden kilitli olduğu, hangi seviyede/aşamada açılacağı ve ne kadar sermaye gerektiği
 * - Açık binalarda: 1 ana metrik ve doğrudan gerçek yönetim ekranını açan 1 işlem düğmesi
 */
export const IsometricSelectionOverlay: React.FC<IsometricSelectionOverlayProps> =
  React.memo(
    ({
      selectedBuilding,
      selectedUrbanBlock = null,
      onOpenDetailSheet,
      onClearSelection,
    }) => {
      if (selectedUrbanBlock) {
        const classification =
          selectedUrbanBlock.statusClassification || 'ACTIVE';
        const isLocked =
          classification === 'LOCKED' || !selectedUrbanBlock.isUnlocked;
        const isDecorative = classification === 'DECORATIVE';

        return (
          <div
            role="status"
            aria-live="polite"
            data-testid="isometric-selection-overlay"
            data-selected-urban-block={selectedUrbanBlock.id}
            data-block-classification={classification}
            data-building-unlocked={
              selectedUrbanBlock.isUnlocked ? 'true' : 'false'
            }
            className="absolute top-13 left-2.5 right-2.5 sm:right-auto sm:w-88 z-30 rounded-2xl bg-white/96 border border-slate-200 shadow-lg p-3 text-xs text-slate-900 pointer-events-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isLocked
                      ? 'bg-amber-100 text-amber-800'
                      : isDecorative
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {isLocked ? (
                    <Lock className="w-4 h-4" />
                  ) : isDecorative ? (
                    <Building className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 truncate">
                      {selectedUrbanBlock.nameTR}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-bold text-slate-700 shrink-0">
                      Sv.{selectedUrbanBlock.level ?? 1}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    {isLocked
                      ? 'Kilitli Yapı · Açılma Koşulu Mevcut'
                      : isDecorative
                      ? 'Dekoratif Yapı · Şehir Yaşam ve Talep Alanı'
                      : 'Aktif ve Çalışan Ticari/Sanayi Yapısı'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid="close-selection-overlay-btn"
                aria-label="Seçim Balonunu Kapat"
                onClick={onClearSelection}
                className="min-w-[32px] min-h-[32px] rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLocked ? (
              <div
                data-testid="urban-block-locked-details"
                className="mt-2 space-y-1.5 rounded-xl bg-amber-50/90 border border-amber-200 p-2.5 text-[11px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">Neden Kilitli:</span>
                  <strong className="text-slate-900 text-right">
                    {selectedUrbanBlock.unlockConditionTR ||
                      'Şirketleşme veya üst aşama gereklidir'}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">Açılacağı Seviye:</span>
                  <strong className="font-mono text-amber-900">
                    {selectedUrbanBlock.unlockStageLabelTR ||
                      'Aşama 2 · Kurumsal Şirket'}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">Gerekli Sermaye:</span>
                  <strong className="font-mono text-slate-900 tabular-nums">
                    {selectedUrbanBlock.requiredCapitalTR ||
                      '₺2.000.000 Net Varlık'}
                  </strong>
                </div>
              </div>
            ) : (
              <div
                data-testid="selection-card-key-metric"
                className="mt-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
              >
                <span className="text-[11px] text-slate-600">Durum Özeti:</span>
                <strong className="font-mono text-[11px] font-bold text-slate-900 tabular-nums truncate">
                  {selectedUrbanBlock.statusSummaryTR ||
                    selectedUrbanBlock.shortTagTR}
                </strong>
              </div>
            )}

            {!isLocked && !isDecorative && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  data-testid="selection-card-primary-action-btn"
                  onClick={() =>
                    onOpenDetailSheet(
                      selectedUrbanBlock.linkedBuildingId,
                      selectedUrbanBlock.linkedCompanySubTab
                    )
                  }
                  className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                >
                  <span>Yönetim Ekranını Aç</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      }

      if (!selectedBuilding) return null;

      const lockedInfo = selectedBuilding.lockedOverlayInfo;
      const card = selectedBuilding.selectionCard;
      const construction = selectedBuilding.constructionInfo;

      return (
        <div
          role="status"
          aria-live="polite"
          data-testid="isometric-selection-overlay"
          data-selected-building={selectedBuilding.id}
          data-building-unlocked={selectedBuilding.isUnlocked ? 'true' : 'false'}
          className="absolute top-13 left-2.5 right-2.5 sm:right-auto sm:w-84 z-30 rounded-2xl bg-white/96 border border-slate-200 shadow-lg p-3 text-xs text-slate-900 pointer-events-auto"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  lockedInfo
                    ? 'bg-amber-100 text-amber-800'
                    : construction
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {lockedInfo ? (
                  <Lock className="w-4 h-4" />
                ) : construction ? (
                  <HardHat className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 truncate">
                    {lockedInfo ? lockedInfo.title : card.title}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-bold text-slate-700 shrink-0">
                    {card.levelLabelTR}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 truncate">
                  {lockedInfo
                    ? lockedInfo.conditionText
                    : `${card.districtNameTR} · ${card.shortStatus}`}
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="close-selection-overlay-btn"
              aria-label="Seçim Balonunu Kapat"
              onClick={onClearSelection}
              className="min-w-[32px] min-h-[32px] rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 1 Ana Metrik Satırı */}
          <div
            data-testid="selection-card-key-metric"
            className="mt-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
          >
            <span className="text-[11px] text-slate-600">
              {card.keyMetricLabel}:
            </span>
            <strong className="font-mono text-[11px] font-bold text-slate-900 tabular-nums">
              {card.keyMetricValue}
            </strong>
          </div>

          {/* Aktif İnşaat İlerleme Bilgisi (Varsa) */}
          {construction && (
            <div
              data-testid="selection-card-construction-info"
              className="mt-2 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 flex items-center justify-between gap-2"
            >
              <span className="font-semibold truncate">
                {construction.stageLabelTR}
              </span>
              <span className="font-mono font-bold shrink-0">
                %{construction.progressPct} · Gün{' '}
                {construction.estimatedCompletionDay}
              </span>
            </div>
          )}

          {/* Tam Sorun Listesi (Harita üstünde tek ikon gösterilir, detay burada listelenir) */}
          {card.issueDetails.length > 0 && (
            <div
              data-testid="selection-card-issues"
              className="mt-2 px-2.5 py-1.5 rounded-xl bg-amber-50/90 border border-amber-200/90 space-y-1"
            >
              {card.issueDetails.map((issue, i) => (
                <div
                  key={`issue-${i}`}
                  className="flex items-center gap-1.5 text-[10px] font-medium text-amber-900"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          )}

          {/* Alt Aksiyon Alanı: Kilitli ise açılma koşulu, açık ise 1 Ana İşlem Düğmesi */}
          {lockedInfo ? (
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <span
                data-testid="locked-overlay-remaining"
                className="font-mono font-bold text-[11px] text-amber-900"
              >
                {lockedInfo.remainingText}
              </span>
              <span
                data-testid="locked-building-status-pill"
                className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200"
              >
                🔒 Kilitli (%{lockedInfo.progressPct})
              </span>
            </div>
          ) : (
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                data-testid="selection-card-primary-action-btn"
                onClick={() =>
                  onOpenDetailSheet(
                    selectedBuilding.id,
                    card.navigationTarget.companySubTab
                  )
                }
                className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
              >
                <span>{card.primaryActionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      );
    }
  );
