/**
 * Dükkân vitrini: türüne göre renkli tente, raflar gerçek stok oranına göre dolar (boşsa boş görünür).
 * Saf SVG (ağ isteği yok). Üstünde Açık/Kapalı rozeti, dokunulabilir yıldız rozeti ve bugünkü canlı kâr hapı durur.
 */
import React from 'react';
import { Star } from 'lucide-react';
import type { ShopType } from '../../../models/trade';
import { getShopStarTier } from '../../../engine/ShopRatingEngine';

interface StorefrontPalette {
  awningA: string;
  awningB: string;
  frame: string;
  wall: string;
  goods: string[];
}

export const STOREFRONT_PALETTES: Record<ShopType, StorefrontPalette> = {
  BUFE: { awningA: '#dc2626', awningB: '#fbbf24', frame: '#7c2d12', wall: '#fde68a', goods: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'] },
  MANAV: { awningA: '#15803d', awningB: '#f8fafc', frame: '#14532d', wall: '#dcfce7', goods: ['#ef4444', '#f97316', '#84cc16', '#facc15'] },
  KAFE: { awningA: '#78350f', awningB: '#f5e6d3', frame: '#451a03', wall: '#fef3c7', goods: ['#92400e', '#d97706', '#fde68a', '#a16207'] },
  GIYIM_MAGAZASI: { awningA: '#7e22ce', awningB: '#f3e8ff', frame: '#4c1d95', wall: '#faf5ff', goods: ['#a855f7', '#ec4899', '#6366f1', '#f472b6'] },
  ELEKTRONIK_MAGAZASI: { awningA: '#1d4ed8', awningB: '#dbeafe', frame: '#1e3a8a', wall: '#eff6ff', goods: ['#0f172a', '#334155', '#38bdf8', '#64748b'] },
  MOBILYA_MAGAZASI: { awningA: '#a16207', awningB: '#fef3c7', frame: '#713f12', wall: '#fefce8', goods: ['#b45309', '#92400e', '#d6d3d1', '#78716c'] },
  MARKET: { awningA: '#0d9488', awningB: '#ccfbf1', frame: '#134e4a', wall: '#f0fdfa', goods: ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6'] },
  OTOMOBIL_GALERISI: { awningA: '#1e293b', awningB: '#cbd5e1', frame: '#0f172a', wall: '#f1f5f9', goods: ['#dc2626', '#2563eb', '#e2e8f0', '#111827'] },
};

export interface ShopStorefrontProps {
  shopType: ShopType;
  name: string;
  typeLabel?: string;
  level: number;
  /** Raf doluluğu 0–1 (gerçek stok / kapasite) */
  fillRatio: number;
  open: boolean;
  openLabel: string;
  stars: number;
  /** Bugünkü canlı kâr (yoksa hap çizilmez) */
  liveProfit?: number;
  formatCurrency: (v: number) => string;
  onOpenRating?: () => void;
}

const SLOTS_PER_SHELF = 8;
const SHELVES = 3;

export const ShopStorefront: React.FC<ShopStorefrontProps> = ({
  shopType,
  name,
  typeLabel,
  level,
  fillRatio,
  open,
  openLabel,
  stars,
  liveProfit,
  formatCurrency,
  onOpenRating,
}) => {
  const p = STOREFRONT_PALETTES[shopType] ?? STOREFRONT_PALETTES.BUFE;
  const ratio = Math.max(0, Math.min(1, Number.isFinite(fillRatio) ? fillRatio : 0));
  const filled = Math.round(ratio * SLOTS_PER_SHELF * SHELVES);
  const tier = getShopStarTier(stars);
  const stripes = 9;
  const stripeW = 360 / stripes;
  const isCar = shopType === 'OTOMOBIL_GALERISI';

  return (
    <div className="relative overflow-hidden rounded-3xl" data-testid="shop-storefront" data-fill={ratio.toFixed(2)}>
      <svg viewBox="0 0 360 170" className="block w-full h-auto" role="img" aria-label={`${name} vitrini, raflar %${Math.round(ratio * 100)} dolu`}>
        <defs>
          <linearGradient id={`sky-${shopType}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--g-navy-800)" />
            <stop offset="1" stopColor="var(--g-navy-900)" />
          </linearGradient>
        </defs>
        <rect width="360" height="170" fill={`url(#sky-${shopType})`} />
        {/* duvar */}
        <rect x="18" y="38" width="324" height="124" rx="10" fill={p.wall} />
        {/* tente */}
        {Array.from({ length: stripes }).map((_, i) => (
          <path
            key={i}
            d={`M${i * stripeW} 14 h${stripeW} v26 q${-stripeW / 2} 14 ${-stripeW} 0 z`}
            fill={i % 2 === 0 ? p.awningA : p.awningB}
          />
        ))}
        <rect x="0" y="10" width="360" height="6" fill={p.frame} />
        {/* vitrin camı */}
        <rect x="34" y="58" width="220" height="96" rx="8" fill="#e0f2fe" stroke={p.frame} strokeWidth="4" />
        {Array.from({ length: SHELVES }).map((_, s) => {
          const y = 84 + s * 26;
          return (
            <g key={s}>
              <rect x="40" y={y} width="208" height="4" rx="2" fill={p.frame} opacity="0.7" />
              {Array.from({ length: SLOTS_PER_SHELF }).map((__, k) => {
                const idx = s * SLOTS_PER_SHELF + k;
                if (idx >= filled) return null;
                const color = p.goods[(idx + s) % p.goods.length];
                const x = 46 + k * 25.5;
                return isCar ? (
                  <g key={k}>
                    <rect x={x} y={y - 12} width="20" height="9" rx="4" fill={color} />
                    <circle cx={x + 5} cy={y - 2} r="2.6" fill="#111827" />
                    <circle cx={x + 15} cy={y - 2} r="2.6" fill="#111827" />
                  </g>
                ) : (
                  <rect key={k} x={x} y={y - 16} width="16" height="16" rx="3" fill={color} />
                );
              })}
            </g>
          );
        })}
        {/* kapı */}
        <rect x="270" y="70" width="56" height="88" rx="6" fill={p.frame} />
        <rect x="277" y="78" width="42" height="44" rx="4" fill="#bae6fd" opacity="0.85" />
        <circle cx="314" cy="128" r="3" fill="#fbbf24" />
        {/* tabela */}
        <rect x="96" y="40" width="168" height="16" rx="5" fill={p.frame} />
      </svg>

      {/* Tabela yazısı */}
      <div className="pointer-events-none absolute left-1/2 top-[23.5%] -translate-x-1/2 w-[44%] text-center text-[11px] sm:text-[13px] font-extrabold text-white truncate leading-none">
        {name}
      </div>

      {/* Sol üst: Açık / Kapalı */}
      <span
        data-testid="active-shop-hours"
        className={`absolute left-2.5 top-2.5 g-pill shadow ${open ? 'bg-[var(--g-green)] text-white' : 'bg-black/55 text-white/85'}`}
      >
        <span className={`w-2 h-2 rounded-full ${open ? 'bg-[var(--g-surface)]' : 'bg-white/50'}`} />
        {openLabel}
      </span>

      {/* Sağ üst: yıldız rozeti (karne penceresini açar) */}
      <button
        type="button"
        data-testid="shop-star-badge"
        onClick={onOpenRating}
        aria-label={`Dükkân yıldızı ${stars.toFixed(1)}, ${tier.labelTR}. Karneyi aç`}
        className="absolute right-2.5 top-2.5 g-pill min-h-[36px] bg-[var(--g-gold)] text-[#3a2600] shadow-[0_3px_0_var(--g-gold-dark)] active:translate-y-[2px]"
      >
        <Star className="w-4 h-4 fill-current" />
        <span className="tabular-nums">{stars.toFixed(1)}</span>
        <span className="hidden min-[380px]:inline">· {tier.labelTR}</span>
      </button>

      {/* Alt: seviye + canlı kâr */}
      <div className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-2">
        <span
          data-testid="shop-level-badge"
          className="g-pill bg-white/90 text-[var(--g-navy-900)] shadow"
          title={typeLabel}
        >
          Seviye {level}/5
        </span>
        {liveProfit !== undefined && (
          <span
            data-testid="shop-live-profit"
            className={`g-pill g-display text-[15px] shadow ${liveProfit >= 0 ? 'bg-[var(--g-green)] text-white' : 'bg-[var(--g-red)] text-white'}`}
          >
            {liveProfit >= 0 ? '+' : ''}
            {formatCurrency(liveProfit)}
            <span className="font-bold text-[12px] opacity-85">bugün</span>
          </span>
        )}
      </div>
    </div>
  );
};
