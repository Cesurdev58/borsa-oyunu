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

export interface SelectedShopInfo {
  shopId: string;
  sales: number;
  profit: number;
  fillPct: number;
  restockCost: number;
  canRestock: boolean;
}

interface IsometricSelectionOverlayProps {
  shopInfo?: SelectedShopInfo | null;
  onRestockShop?: (shopId: string) => void;
  formatCurrency?: (v: number) => string;
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
      shopInfo = null,
      onRestockShop,
      formatCurrency,
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
                    <span className="font-extrabold text-base text-slate-900 truncate">
                      {selectedUrbanBlock.nameTR}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[13px] font-mono font-bold text-slate-700 shrink-0">
                      Sv.{selectedUrbanBlock.level ?? 1}
                    </span>
                  </div>
                  <div className="text-[13px] text-slate-600 truncate">
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
                className="mt-2 space-y-1.5 rounded-xl bg-amber-50/90 border border-amber-200 p-2.5 text-[13px]"
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
            ) : shopInfo && formatCurrency ? (
              <div data-testid="selection-shop-card" className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-2">
                    <div className="text-[13px] text-slate-500">Bugünkü satış</div>
                    <div className="text-sm font-extrabold text-slate-900 tabular-nums">
                      {formatCurrency(shopInfo.sales)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <div className="text-[13px] text-slate-500">Bugünkü kâr</div>
                    <div
                      className={`text-sm font-extrabold tabular-nums ${
                        shopInfo.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {shopInfo.profit >= 0 ? '+' : ''}
                      {formatCurrency(shopInfo.profit)}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[13px] font-semibold text-slate-700">
                    <span>📦 Raflar</span>
                    <span className={shopInfo.fillPct < 25 ? 'text-rose-600' : ''}>
                      %{shopInfo.fillPct}
                      {shopInfo.fillPct < 25 ? ' · Azalıyor!' : ''}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        shopInfo.fillPct < 25 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${shopInfo.fillPct}%` }}
                    />
                  </div>
                </div>
                {onRestockShop && (
                  <button
                    type="button"
                    data-testid="selection-shop-restock-btn"
                    disabled={!shopInfo.canRestock}
                    onClick={() => onRestockShop(shopInfo.shopId)}
                    className="w-full min-h-[44px] rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white font-extrabold text-sm shadow active:scale-95"
                  >
                    🛒 Rafları doldur
                    {shopInfo.canRestock
                      ? ` · ${formatCurrency(shopInfo.restockCost)}`
                      : ''}
                  </button>
                )}
              </div>
            ) : (
              <div
                data-testid="selection-card-key-metric"
                className="mt-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
              >
                <span className="text-[13px] text-slate-600">Durum Özeti:</span>
                <strong className="font-mono text-[13px] font-bold text-slate-900 tabular-nums truncate">
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
                  className="flex-1 min-h-[44px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                >
                  <span>Yönet</span>
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
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[13px] font-mono font-bold text-slate-700 shrink-0">
                    {card.levelLabelTR}
                  </span>
                </div>
                <div className="text-[13px] text-slate-600 truncate">
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
            <span className="text-[13px] text-slate-600">
              {card.keyMetricLabel}:
            </span>
            <strong className="font-mono text-[13px] font-bold text-slate-900 tabular-nums">
              {card.keyMetricValue}
            </strong>
          </div>

          {/* Aktif İnşaat İlerleme Bilgisi (Varsa) */}
          {construction && (
            <div
              data-testid="selection-card-construction-info"
              className="mt-2 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-950 flex items-center justify-between gap-2"
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
                  className="flex items-center gap-1.5 text-[13px] font-medium text-amber-900"
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
                className="font-mono font-bold text-[13px] text-amber-900"
              >
                {lockedInfo.remainingText}
              </span>
              <span
                data-testid="locked-building-status-pill"
                className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-bold border border-slate-200"
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
                className="flex-1 min-h-[44px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
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
