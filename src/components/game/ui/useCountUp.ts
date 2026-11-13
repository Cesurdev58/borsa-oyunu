/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sayıyı eski değerinden yeni değerine yumuşakça sayarak gösterir
 * (para artınca kasa sayacı gibi döner). Hareket azaltma tercihi açıksa hemen atlar.
 */
import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, durationMs = 600): number {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  const shownRef = useRef(target);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      setShown(target);
      return;
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || Math.abs(target - shownRef.current) < 1) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    fromRef.current = shownRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = fromRef.current + (target - fromRef.current) * eased;
      shownRef.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return shown;
}
