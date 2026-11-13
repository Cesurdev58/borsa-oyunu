/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Yeni oyuncu için kısa açılış rehberi (4 adım). Yalnızca oyunun ilk gününde,
 * bir kez gösterilir; "Atla" ya da bitirme sonrası tarayıcıya işaretlenir.
 */

import React, { useState } from 'react';
import { FIRST_SHOP_MIN_NET_WORTH } from '../../data/gameBalance';

const GUIDE_DONE_KEY = 'first_run_guide_done_v1';

function readDone(): boolean {
  try {
    // Sunucu tarafında (testler) ya da depolama kapalıysa rehberi gösterme.
    if (typeof window === 'undefined' || !window.localStorage) return true;
    return window.localStorage.getItem(GUIDE_DONE_KEY) === '1';
  } catch {
    return true;
  }
}

function markDone(): void {
  try {
    window.localStorage.setItem(GUIDE_DONE_KEY, '1');
  } catch {
    /* depolama kapalıysa sessizce geç */
  }
}

interface FirstRunGuideProps {
  day: number;
  formatCurrency: (v: number) => string;
  onGoToMarket: () => void;
}

export const FirstRunGuide: React.FC<FirstRunGuideProps> = ({
  day,
  formatCurrency,
  onGoToMarket,
}) => {
  const [done, setDone] = useState<boolean>(() => day > 1 || readDone());
  const [step, setStep] = useState(0);
  if (done) return null;

  const steps = [
    {
      emoji: '👋',
      title: 'Hoş geldin!',
      text: 'Cebinde ₺100.000 var. Önce borsada para kazanacak, sonra dükkân açacak, en sonunda kendi şirketini kuracaksın.',
    },
    {
      emoji: '📈',
      title: 'Borsada ucuza al, pahalıya sat',
      text: 'Alt menüden Borsa\'ya gir, bir hisse seç ve yeşil AL düğmesine bas. Fiyat yükselince kırmızı SAT ile kârı cebine koy. Haberler fiyatları oynatır!',
    },
    {
      emoji: '🏪',
      title: 'İlk dükkânını aç',
      text: `Toplam varlığın ${formatCurrency(FIRST_SHOP_MIN_NET_WORTH)} olunca dükkân kurabilirsin. Dükkân ekranında ilerlemeni görürsün.`,
    },
    {
      emoji: '🛒',
      title: 'Rafları dolu tut',
      text: 'Dükkânda "Rafları doldur" düğmesine basman yeter. Raflar boşalırsa satış durur. Takılırsan alt menüdeki Rehber\'e bak. Hazırsan başlayalım!',
    },
  ];
  const last = step === steps.length - 1;
  const s = steps[step];

  const finish = (goMarket: boolean) => {
    markDone();
    setDone(true);
    if (goMarket) onGoToMarket();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Oyuna başlangıç rehberi"
      data-testid="first-run-guide"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 p-4"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4 text-center">
        <div className="text-6xl">{s.emoji}</div>
        <h2 className="text-xl font-extrabold text-slate-900">{s.title}</h2>
        <p className="text-base text-slate-600">{s.text}</p>

        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-emerald-500' : 'w-2 bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="first-run-skip"
            onClick={() => finish(false)}
            className="g-btn g-btn-secondary"
          >
            Atla
          </button>
          <button
            type="button"
            data-testid="first-run-next"
            onClick={() => (last ? finish(true) : setStep(step + 1))}
            className="g-btn g-btn-primary"
          >
            {last ? 'Borsaya git' : 'İleri'}
          </button>
        </div>
      </div>
    </div>
  );
};
