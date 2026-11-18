/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Önemli bir başarıda (rakip devralma, yeni aşama, yeni dükkân, zenginler listesinde yükselme)
 * ekranda kısa süre beliren kutlama.
 * Yalnızca görsel; oyun durumuna dokunmaz.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { play } from './ui/feedback';

const CONFETTI_COLORS = ['#ffc23d', '#22b573', '#5b70d6', '#ef4f4c', '#ffffff', '#36d48b'];

interface CelebrationOverlayProps {
  shopCount: number;
  stage: number;
  /** Zenginler listesindeki sıra; oturumda en iyi sıra geçilince kutlanır */
  richRank?: number;
  /** Devralınan rakipler (kurucu adıyla); sayı artınca kutlanır */
  takeovers?: { ticker: string; company: string; founder: string }[];
}


export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
  shopCount,
  stage,
  richRank,
  takeovers,
}) => {
  const prev = useRef({ shopCount, stage });
  const prevTakeovers = useRef(takeovers?.length ?? 0);
  // Sıra hisse fiyatlarıyla bir aşağı bir yukarı oynayabilir; yalnızca oturumdaki en iyi sıra geçilince kutla
  const bestRank = useRef<number | undefined>(richRank);
  const [message, setMessage] = useState<{ title: string; sub: string } | null>(
    null
  );

  useEffect(() => {
    const before = prev.current;
    prev.current = { shopCount, stage };
    let next: { title: string; sub: string } | null = null;
    const tk = takeovers?.length ?? 0;
    if (tk > prevTakeovers.current && takeovers) {
      const last = takeovers[takeovers.length - 1];
      next = { title: `${last.company} artık senin!`, sub: `Kurucusu ${last.founder} şirketini sana devretti.` };
    }
    prevTakeovers.current = tk;
    // Devralma kutlaması diğerlerinden önce gelir
    if (!next && stage > before.stage) {
      next = { title: 'Yeni aşama!', sub: `Aşama ${stage} açıldı. Büyümeye devam!` };
    } else if (!next && shopCount > before.shopCount) {
      next =
        before.shopCount === 0
          ? { title: 'İlk dükkânın açıldı!', sub: 'Şimdi rafları doldur, satış başlasın.' }
          : { title: 'Yeni dükkân!', sub: 'İmparatorluğun büyüyor.' };
    }
    if (!next && richRank !== undefined) {
      if (bestRank.current === undefined) bestRank.current = richRank;
      else if (richRank < bestRank.current) {
        bestRank.current = richRank;
        next =
          richRank === 1
            ? { title: 'Şehrin en zengini sensin!', sub: 'Zenginler listesinde 1. sıradasın.' }
            : { title: `Zenginler listesinde ${richRank}. sıra!`, sub: 'Bir zengini daha geride bıraktın.' };
      }
    }
    if (!next) return;
    setMessage(next);
    play('levelup');
    const t = window.setTimeout(() => setMessage(null), 2800);
    return () => window.clearTimeout(t);
  }, [shopCount, stage, richRank, takeovers?.length]);

  if (!message) return null;

  return (
    <div
      aria-live="polite"
      data-testid="celebration-overlay"
      className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center"
    >
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="confetti-piece absolute top-0 rounded-[2px]"
          style={{
            left: `${(i * 37) % 100}%`,
            width: i % 3 === 0 ? 8 : 6,
            height: i % 3 === 0 ? 14 : 10,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 7) * 0.1}s`,
          }}
        />
      ))}
      <div className="celebration-pop g-hero px-7 py-6 text-center min-w-[260px]">
        <div
          className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(180deg,#ffe08a,var(--g-gold))', boxShadow: '0 4px 0 var(--g-gold-dark)' }}
        >
          <Trophy className="w-8 h-8 text-[#6b4500]" strokeWidth={2.4} />
        </div>
        <div className="g-display mt-3 text-2xl font-extrabold text-white">{message.title}</div>
        <div className="text-sm font-semibold text-white/75 mt-0.5">{message.sub}</div>
      </div>
    </div>
  );
};
