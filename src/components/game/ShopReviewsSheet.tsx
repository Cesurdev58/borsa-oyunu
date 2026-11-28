/**
 * Dükkân Yıldızı & Müşteri Karnesi penceresi: vitrindeki ★ rozetine dokununca açılır.
 * Üstte yıldız, unvan, etkin bonuslar ve sonraki kademeye kalan çubuk; ortada 4 sütun; altta son yorumlar.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { Star, X } from 'lucide-react';
import type { ShopCustomerReview, ShopInstance, ShopRatingPillar } from '../../models/trade';
import {
  PILLAR_LABEL_TR,
  computeShopRating,
  getShopStarTier,
  nextStarTier,
  pillarSummaryTR,
  shopStars,
  starTierBonusLabelsTR,
} from '../../engine/ShopRatingEngine';

export type ReviewActionHint = NonNullable<ShopCustomerReview['actionHint']>;

export const REVIEW_ACTION_LABEL_TR: Record<ReviewActionHint, string> = {
  RESTOCK: 'Rafları doldur',
  PRICE: 'Fiyatlara bak',
  STAFF: 'Çalışan al',
  UPGRADE: 'Yükseltmeler',
};

export function StarRow({ stars, size = 'w-4 h-4' }: { stars: number; size?: string }) {
  return (
    <span className="inline-flex items-center" aria-label={`${stars} yıldız`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${size} ${i <= Math.round(stars) ? 'fill-[var(--g-gold)] text-[var(--g-gold)]' : 'text-[var(--g-line-strong)]'}`}
        />
      ))}
    </span>
  );
}

export interface ShopReviewsSheetProps {
  shop: ShopInstance;
  onClose: () => void;
  onAction?: (hint: ReviewActionHint) => void;
}

const ORDER: ShopRatingPillar[] = ['VARIETY', 'PRICE', 'STOCK', 'SERVICE'];

export const ShopReviewsSheet: React.FC<ShopReviewsSheetProps> = ({ shop, onClose, onAction }) => {
  const stars = shopStars(shop);
  const tier = getShopStarTier(stars);
  const next = nextStarTier(stars);
  const rating = computeShopRating(shop);
  const bonuses = starTierBonusLabelsTR(stars);
  const reviews = shop.recentReviews ?? [];
  const progress = next
    ? Math.max(0, Math.min(100, ((stars - tier.minStars) / Math.max(0.1, next.tier.minStars - tier.minStars)) * 100))
    : 100;

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dükkân yıldızı ve müşteri karnesi"
      data-testid="shop-reviews-modal"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[var(--g-overlay)] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="g-rise w-full max-w-md max-h-[86vh] overflow-y-auto rounded-t-[26px] sm:rounded-[26px] bg-[var(--g-bg)] p-4 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="g-section-title">Müşteri Karnesi</h2>
          <button
            type="button"
            aria-label="Karneyi kapat"
            data-testid="shop-reviews-close-btn"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[var(--g-surface-2)] flex items-center justify-center text-[var(--g-muted)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="g-hero p-4 text-center space-y-2">
          <div className="g-hero-label">{shop.nameTR}</div>
          <div className="g-hero-value text-5xl" data-testid="shop-reviews-stars">
            ★ {stars.toFixed(1)}
          </div>
          <div className="g-display text-lg font-extrabold text-white" data-testid="shop-reviews-tier">
            {tier.labelTR}
          </div>
          {bonuses.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5" data-testid="shop-reviews-bonuses">
              {bonuses.map((b) => (
                <span key={b} className="g-pill bg-white/15 text-white">
                  {b}
                </span>
              ))}
            </div>
          )}
          {next ? (
            <div className="pt-1 space-y-1">
              <div className="g-track h-2.5">
                <div className="g-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-[13px] font-bold text-white/70">
                {next.tier.labelTR} için {next.starsNeeded.toFixed(1)} ★ daha
              </div>
            </div>
          ) : (
            <div className="text-[13px] font-bold text-white/70">En üst kademedesin!</div>
          )}
        </div>

        <div className="g-card p-3 space-y-3" data-testid="shop-reviews-pillars">
          <div className="font-extrabold text-[var(--g-ink)]">4 Sütun Karnesi</div>
          {ORDER.map((p) => {
            const v = rating.pillars[p];
            return (
              <div key={p} data-testid={`shop-pillar-${p}`}>
                <div className="flex justify-between text-sm font-bold text-[var(--g-ink)]">
                  <span>{PILLAR_LABEL_TR[p]}</span>
                  <span className="tabular-nums">{v}</span>
                </div>
                <div className="g-track h-2.5 mt-1">
                  <div
                    className={v < 45 ? 'g-fill g-fill-danger' : v < 70 ? 'g-fill' : 'g-fill'}
                    style={{ width: `${v}%`, ...(v >= 45 && v < 70 ? { background: 'var(--g-gold)' } : {}) }}
                  />
                </div>
                <div className="text-[13px] text-[var(--g-muted)] mt-0.5">{pillarSummaryTR(p, v)}</div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2" data-testid="shop-reviews-list">
          <div className="font-extrabold text-[var(--g-ink)]">Son Müşteri Yorumları</div>
          {reviews.length === 0 ? (
            <div className="g-card-soft p-3 text-[13px] text-[var(--g-muted)]">Henüz yorum yok. Gün bitince müşteriler yazar.</div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="g-card p-3 space-y-1.5" data-testid="shop-review-item">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[var(--g-ink)] text-sm">{r.authorName}</span>
                  <span className="flex items-center gap-1.5">
                    <StarRow stars={r.stars} />
                    <span className="text-[13px] text-[var(--g-muted)]">Gün {r.day}</span>
                  </span>
                </div>
                <p className="text-sm text-[var(--g-ink)]">“{r.textTR}”</p>
                {r.actionHint && onAction && (
                  <button
                    type="button"
                    data-testid={`shop-review-action-${r.actionHint}`}
                    onClick={() => onAction(r.actionHint as ReviewActionHint)}
                    className="g-btn g-btn-secondary g-btn-sm"
                  >
                    {REVIEW_ACTION_LABEL_TR[r.actionHint]}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
  // Üst kapsayıcılardaki animasyon `fixed` konumu bozmasın: tarayıcıda sayfanın en üstüne çizilir.
  return typeof document !== 'undefined' && document.body ? createPortal(sheet, document.body) : sheet;
};
