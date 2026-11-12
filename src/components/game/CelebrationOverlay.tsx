/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Önemli bir başarıda (yeni dükkân, yeni aşama) ekranda kısa süre beliren kutlama.
 * Yalnızca görsel; oyun durumuna dokunmaz.
 */

import React, { useEffect, useRef, useState } from 'react';

interface CelebrationOverlayProps {
  shopCount: number;
  stage: number;
}

const CONFETTI = ['🎉', '✨', '🪙', '⭐', '🎊', '💰'];

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
  shopCount,
  stage,
}) => {
  const prev = useRef({ shopCount, stage });
  const [message, setMessage] = useState<{ title: string; sub: string } | null>(
    null
  );

  useEffect(() => {
    const before = prev.current;
    prev.current = { shopCount, stage };
    let next: { title: string; sub: string } | null = null;
    if (stage > before.stage) {
      next = { title: 'Yeni aşama!', sub: `Aşama ${stage} açıldı. Büyümeye devam!` };
    } else if (shopCount > before.shopCount) {
      next =
        before.shopCount === 0
          ? { title: 'İlk dükkânın açıldı!', sub: 'Şimdi rafları doldur, satış başlasın.' }
          : { title: 'Yeni dükkân!', sub: 'İmparatorluğun büyüyor.' };
    }
    if (!next) return;
    setMessage(next);
    const t = window.setTimeout(() => setMessage(null), 2800);
    return () => window.clearTimeout(t);
  }, [shopCount, stage]);

  if (!message) return null;

  return (
    <div
      aria-live="polite"
      data-testid="celebration-overlay"
      className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center"
    >
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="confetti-piece absolute top-0 text-2xl"
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 6) * 0.12}s`,
          }}
        >
          {CONFETTI[i % CONFETTI.length]}
        </span>
      ))}
      <div className="celebration-pop rounded-3xl bg-white px-6 py-5 text-center shadow-2xl border-2 border-amber-300">
        <div className="text-5xl">🏆</div>
        <div className="mt-1 text-xl font-extrabold text-slate-900">
          {message.title}
        </div>
        <div className="text-sm text-slate-600">{message.sub}</div>
      </div>
    </div>
  );
};
