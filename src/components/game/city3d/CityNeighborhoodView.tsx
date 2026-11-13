/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { IsometricNeighborhoodView } from '../city/IsometricNeighborhoodView';
import type { CityViewProps } from './ThreeNeighborhoodView';
import { webglAvailable } from './webgl';

// 3D kütüphanesi büyük olduğu için yalnızca şehir ekranı açılınca yüklenir.
const ThreeNeighborhoodView = React.lazy(() => import('./ThreeNeighborhoodView'));

const MODE_KEY = 'city_view_mode';

/**
 * Şehir ekranı: tarayıcı 3D'yi (WebGL) destekliyorsa gerçek 3D, desteklemiyorsa
 * (ya da kullanıcı isterse) eski izometrik görünüm gösterilir.
 */
export const CityNeighborhoodView: React.FC<CityViewProps> = (props) => {
  const canUse3D = useMemo(() => webglAvailable(), []);
  const [classic, setClassic] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(MODE_KEY) === 'klasik';
    } catch {
      return false;
    }
  });

  const choose = useCallback((next: boolean) => {
    setClassic(next);
    try {
      window.localStorage.setItem(MODE_KEY, next ? 'klasik' : '3d');
    } catch {
      /* depolama kapalıysa seçim yalnızca bu oturumda kalır */
    }
  }, []);

  if (!canUse3D || classic) {
    return (
      <div className="relative w-full">
        <IsometricNeighborhoodView {...props} />
        {canUse3D && (
          <button
            type="button"
            data-testid="city-switch-3d"
            onClick={() => choose(false)}
            className="absolute bottom-3 left-3 z-40 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:bg-emerald-700"
          >
            3D görünüme geç
          </button>
        )}
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div
          data-testid="city3d-loading"
          className="flex w-full h-[calc(100dvh-236px)] min-h-[440px] max-h-[860px] items-center justify-center rounded-3xl border border-slate-200 bg-emerald-50 text-sm font-semibold text-emerald-800"
        >
          Şehir yükleniyor…
        </div>
      }
    >
      <ThreeNeighborhoodView {...props} onSwitchClassic={() => choose(true)} />
    </Suspense>
  );
};
