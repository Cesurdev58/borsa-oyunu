/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Olağanüstü olay ("SON DAKİKA") kartı ve etki listesi.
 * Oyun açıkken yeni bir olay başlayınca bir kez açılır; kayıt yeni açıldığında eldeki olay görülmüş sayılır.
 * Etki listesi (`WorldEventEffectsList`) Haberler ekranında da kullanılır.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Siren, TrendingDown, TrendingUp, X } from 'lucide-react';
import type { WorldEvent, WorldEventState } from '../../models/worldEvents';
import { sectorLabel } from './ui/SectorIcon';
import { SHOP_EMOJI } from './ui/shopEmoji';
import { play } from './ui/feedback';

const SHOP_SHORT: Record<string, string> = {
  BUFE: 'Büfe',
  MANAV: 'Manav',
  KAFE: 'Kafe',
  GIYIM_MAGAZASI: 'Giyim',
  ELEKTRONIK_MAGAZASI: 'Elektronik',
  MOBILYA_MAGAZASI: 'Mobilya',
  MARKET: 'Market',
  OTOMOBIL_GALERISI: 'Galeri',
};

const strength = (v: number) => (Math.abs(v) >= 0.025 ? 'Çok' : Math.abs(v) >= 0.015 ? '' : 'Biraz');

export const WorldEventEffectsList: React.FC<{ ev: WorldEvent; day: number }> = ({ ev, day }) => {
  const sectors = Object.entries(ev.sectorImpacts).sort((a, b) => (b[1] as number) - (a[1] as number));
  const shops = Object.entries(ev.shopDemand);
  const daysLeft = Math.max(0, ev.endDay - day + 1);
  return (
    <div className="space-y-2.5" data-testid="world-event-effects">
      <div>
        <div className="text-[13px] font-extrabold text-[var(--g-muted)] mb-1">Borsa</div>
        <div className="flex flex-wrap gap-1.5">
          {sectors.map(([sec, v]) => {
            const up = (v as number) > 0;
            return (
              <span
                key={sec}
                data-testid={`world-event-sector-${sec}`}
                className={`g-pill inline-flex items-center gap-1 text-[13px] font-bold ${
                  up ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                }`}
              >
                {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {sec === 'GENEL' ? 'Bütün borsa' : sectorLabel(sec)}
                <span className="opacity-70 font-semibold">
                  {strength(v as number)} {up ? 'yükselir' : 'düşer'}
                </span>
              </span>
            );
          })}
        </div>
      </div>
      {(shops.length > 0 || ev.supplierPriceMult !== 1) && (
        <div>
          <div className="text-[13px] font-extrabold text-[var(--g-muted)] mb-1">
            Dükkânlar · {daysLeft} gün sürer
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shops.map(([type, m]) => {
              const pct = Math.round(((m as number) - 1) * 100);
              return (
                <span
                  key={type}
                  data-testid={`world-event-shop-${type}`}
                  className={`g-pill text-[13px] font-bold ${
                    pct >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                  }`}
                >
                  {SHOP_EMOJI[type as keyof typeof SHOP_EMOJI] ?? '🏪'} {SHOP_SHORT[type] ?? type} müşteri{' '}
                  {pct >= 0 ? '+' : '−'}%{Math.abs(pct)}
                </span>
              );
            })}
            {ev.supplierPriceMult !== 1 && (
              <span
                data-testid="world-event-supplier"
                className={`g-pill text-[13px] font-bold ${
                  ev.supplierPriceMult > 1 ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'
                }`}
              >
                Toptan fiyatlar {ev.supplierPriceMult > 1 ? '+' : '−'}%
                {Math.abs(Math.round((ev.supplierPriceMult - 1) * 100))}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface WorldEventCardProps {
  worldEvents?: WorldEventState;
  day: number;
  onOpenNews: () => void;
}

export const WorldEventCard: React.FC<WorldEventCardProps> = ({ worldEvents, day, onOpenNews }) => {
  const latest = worldEvents?.history[0];
  // Kayıt açıldığında var olan olay görülmüş sayılır; yalnızca oyun açıkken başlayan olay kart açar.
  const seenRef = useRef<string>(latest?.id ?? '');
  const [shown, setShown] = useState<WorldEvent | null>(null);

  useEffect(() => {
    if (!latest || latest.id === seenRef.current) return;
    seenRef.current = latest.id;
    setShown(latest);
    play('error');
  }, [latest?.id]);

  if (!shown) return null;
  const close = () => setShown(null);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Son dakika"
      data-testid="world-event-card"
      className="fixed inset-0 z-[53] flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.55)] p-3"
      onClick={close}
    >
      <div
        className="celebration-in w-full max-w-sm max-h-[88dvh] overflow-y-auto rounded-[26px] bg-[var(--g-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-t-[26px] bg-[var(--g-red)] px-5 pt-4 pb-4 text-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[13px] font-extrabold tracking-wider">
              <Siren className="w-5 h-5 animate-pulse" /> SON DAKİKA
            </span>
            <button
              type="button"
              aria-label="Kapat"
              onClick={close}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <h2 data-testid="world-event-title" className="g-display text-[24px] leading-tight font-extrabold mt-2">
            {shown.title}
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-[var(--g-ink)] leading-relaxed">{shown.body}</p>
          <div className="g-card p-3.5">
            <WorldEventEffectsList ev={shown} day={day} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={close} className="g-btn g-btn-secondary">
              Anladım
            </button>
            <button
              type="button"
              data-testid="world-event-news-btn"
              onClick={() => {
                close();
                onOpenNews();
              }}
              className="g-btn g-btn-navy"
            >
              Haberlere git
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
