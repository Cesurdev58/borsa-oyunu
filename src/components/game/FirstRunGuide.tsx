/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Görev tabanlı açılış rehberi (plan Bölüm 4-D/E/F).
 * - İlerleme oyun kaydındadır (`state.onboarding`); yeni kariyerde rehber yeniden çalışır.
 * - Adımlar gerçek ekran öğelerini vurgular; öğe bulunamazsa normal adım kartı gösterilir.
 * - İlk adım (karşılama) küçük bir penceredir ve açıkken oyun duraklatılır; sonraki adımlar
 *   oyunu engellemeyen kartlardır. "Atla" her zaman vardır; Rehber penceresinden yeniden başlatılır.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { SimulationState, TimeScaleOption } from '../../models/simulation';
import type { OnboardingState } from '../../engine/OnboardingRules';
import { firstShopGateStatus } from '../../engine/FirstShopGate';
import type { GameBottomTab } from './gameTypes';

export type OnboardingAction =
  | { type: 'complete'; stepId: string }
  | { type: 'dismiss' }
  | { type: 'restart' }
  | { type: 'marketUpdateSeen' };

interface GuideContext {
  state: SimulationState;
  activeTab: GameBottomTab;
  gate: ReturnType<typeof firstShopGateStatus>;
}

export interface GuideStep {
  id: string;
  title: string;
  text: (ctx: GuideContext & { cash: string }) => string;
  /** Vurgulanacak gerçek öğe (CSS seçici); bulunamazsa yalnızca kart gösterilir */
  target?: string | ((ctx: GuideContext) => string | undefined);
  /** Karşılama penceresi mi (oyunu duraklatır) */
  modal?: boolean;
  /** Durumdan anlaşılan tamamlanma; yoksa "İleri" düğmesiyle geçilir */
  done?: (ctx: GuideContext) => boolean;
  /** Şimdi gösterilebilir mi (değilse rehber bekler) */
  available?: (ctx: GuideContext) => boolean;
}

const personalShops = (s: SimulationState) => (s.tradeState?.shops ?? []).filter((x) => !x.isCompanyBranch);

/** Oyuncunun başlangıç şehri (altın halkalı merkez): rehber halkası haritada bu noktaya oturur. */
const startCityId = (s: SimulationState) => s.headquartersCityId ?? s.playerStartCityId;

/** Seçili hedef bu ctx için seçiciye çevrilir (fonksiyon olabilir). */
export function resolveGuideTarget(step: GuideStep, ctx: GuideContext): string | undefined {
  return typeof step.target === 'function' ? step.target(ctx) : step.target;
}

/** Rehber adımları (sıra önemlidir). Metinler gerçek kurallarla uyumludur (ilk dükkân kapısı 4 adım). */
export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: 'Hoş geldin!',
    modal: true,
    text: ({ cash }) =>
      `Cebinde ${cash} var. Borsanın temel işlemlerini tamamla: iki farklı sektörden hisse al, bir pozisyon sat ve ilk fiyat güncellemesini gör. Ardından Türkiye haritasında şehrine dokunup ilk dükkânını açarsın.`,
  },
  {
    id: 'open-market',
    title: 'Borsa\'ya gir',
    target: '[data-testid="bottom-nav-market"]',
    text: () => 'Alt menüden Borsa\'ya dokun.',
    done: ({ activeTab }) => activeTab === 'market',
  },
  {
    id: 'pick-stock',
    title: 'Bir hisse seç',
    target: '[data-guide="stock-card"]',
    text: () => 'Listeden bir hisse kartına dokun. Fiyatını ve hangi sektörde olduğunu gör.',
    available: ({ activeTab }) => activeTab === 'market',
  },
  {
    id: 'buy',
    title: 'İlk hisseni al',
    target: '[data-testid="tycoon-quick-buy-btn"]',
    text: () => 'Yeşil AL düğmesine bas. Borsa kapalıysa emrin açılışta işlenir.',
    done: ({ gate }) => gate.steps.find((s) => s.id === 'buy')?.done === true,
    available: ({ activeTab }) => activeTab === 'market',
  },
  {
    id: 'sectors',
    title: 'Başka bir sektörden de al',
    target: '[data-testid="borsa-sector-filter"]',
    text: () => 'Sektör düğmeleriyle başka bir sektöre bak ve oradan da bir hisse al. Haberler sektörleri farklı etkiler.',
    done: ({ gate }) => gate.steps.find((s) => s.id === 'two-sectors')?.done === true,
    available: ({ activeTab }) => activeTab === 'market',
  },
  {
    id: 'sell',
    title: 'Bir hisseni sat',
    target: '[data-testid="tycoon-quick-sell-btn"]',
    text: () => 'Elindeki bir hisseyi kırmızı SAT düğmesiyle sat. Kâr etmek şart değil; amaç işlemi öğrenmek.',
    done: ({ gate }) => gate.steps.find((s) => s.id === 'sell')?.done === true,
    available: ({ activeTab }) => activeTab === 'market',
  },
  {
    id: 'market-day',
    title: 'Piyasayı bir gün izle',
    text: () => 'Fiyatlar gün boyunca oynar. Bir oyun günü geçince ilk dükkân kapısı açılır.',
    done: ({ gate }) => gate.open,
  },
  {
    id: 'city-tab',
    title: 'Harita',
    target: '[data-testid="bottom-nav-city"]',
    text: () => 'İlk dükkân kapısı açıldı. Harita sekmesine dokun: Türkiye haritası açılır, ilk dükkânını orada kuracaksın.',
    done: ({ activeTab, state }) => activeTab === 'city' || personalShops(state).length > 0,
    available: ({ gate }) => gate.open,
  },
  {
    id: 'map-pick-city',
    title: 'Şehrine dokun',
    target: ({ state, activeTab }) => {
      const id = startCityId(state);
      return activeTab === 'city' && id ? `[data-testid="turkey-city-marker-${id}"]` : '[data-testid="bottom-nav-city"]';
    },
    text: ({ activeTab }) =>
      activeTab === 'city'
        ? 'Altın halkalı nokta başlangıç şehrin. Dokununca şehir bilgisi ve ilk dükkânın maliyeti açılır.'
        : 'Önce Harita sekmesine dön, sonra haritada altın halkalı şehrine dokun.',
    done: ({ state }) => state.selectedMapCityId === startCityId(state) || personalShops(state).length > 0,
    available: ({ gate, state }) => gate.open && personalShops(state).length === 0,
  },
  {
    id: 'opening-capital',
    title: 'İlk dükkânını aç',
    target: ({ state, activeTab }) =>
      activeTab === 'city' && state.selectedMapCityId
        ? '[data-testid="city-open-first-shop-btn"]'
        : activeTab === 'city' && startCityId(state)
        ? `[data-testid="turkey-city-marker-${startCityId(state)}"]`
        : '[data-testid="bottom-nav-city"]',
    text: ({ activeTab, state }) =>
      activeTab !== 'city'
        ? 'Harita sekmesine dön; şehrinin bilgi kartında "İlk Mağazanı Aç" düğmesi var.'
        : !state.selectedMapCityId
        ? 'Şehrine yeniden dokun ki bilgi kartı açılsın.'
        : 'Kartta kurulum bedelini ve cebinde kalacak işletme parasını gör: ilk mal, kira ve maaş buradan çıkar. Hazırsan "İlk Mağazanı Aç" düğmesine bas.',
    done: ({ state }) => personalShops(state).length > 0,
    available: ({ gate, state }) => gate.open && personalShops(state).length === 0,
  },
  {
    id: 'first-order',
    title: 'İlk mal siparişi',
    target: ({ activeTab }) =>
      activeTab === 'portfolio' ? '[data-testid="shop-restock-all-btn"]' : '[data-testid="bottom-nav-portfolio"]',
    text: ({ activeTab }) =>
      activeTab === 'portfolio'
        ? '"Rafları doldur" ile ilk malını sipariş et. Raflar boşalırsa satış durur.'
        : 'Dükkân sekmesine dokun; orada "Rafları doldur" ile ilk malını sipariş edebilirsin.',
    done: ({ state }) =>
      personalShops(state).some(
        (s) =>
          (s.pendingDeliveriesCount ?? 0) > 0 || s.inventoryBatches.some((b) => b.availableQuantity > 0)
      ),
    available: ({ state }) => personalShops(state).length > 0,
  },
  {
    id: 'first-hire',
    title: 'İlk çalışanın',
    target: '[data-testid="shop-first-hire-btn"]',
    text: () => 'Dükkânı başta sen yürütürsün. Yönet → Çalışanlar\'dan ilk çalışanını işe alınca satışlar artar.',
    done: ({ state }) => personalShops(state).length > 0 && !personalShops(state).some((s) => s.ownerWorks),
    available: ({ state }) => personalShops(state).length > 0,
  },
];

/** Sıradaki gösterilecek adım (tamamlanmamış ilk adım); hepsi bittiyse null. Saf, test edilir. */
export function currentGuideStep(onboarding: OnboardingState): GuideStep | null {
  if (onboarding.dismissed) return null;
  return GUIDE_STEPS.find((s) => !onboarding.completedSteps.includes(s.id)) ?? null;
}

interface FirstRunGuideProps {
  state: SimulationState;
  activeTab: GameBottomTab;
  onboarding: OnboardingState | undefined;
  formatCurrency: (v: number) => string;
  /** Başka bir pencere açıkken (çevrimdışı özet, ayarlar…) rehber bekler */
  blocked: boolean;
  onAction: (a: OnboardingAction) => void;
  onSelectTab: (tab: GameBottomTab) => void;
  timeScale: TimeScaleOption;
  onSetTimeScale: (scale: TimeScaleOption) => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const FirstRunGuide: React.FC<FirstRunGuideProps> = ({
  state,
  activeTab,
  onboarding,
  formatCurrency,
  blocked,
  onAction,
  onSelectTab,
  timeScale,
  onSetTimeScale,
}) => {
  const gate = firstShopGateStatus(state);
  const ctx: GuideContext = { state, activeTab, gate };
  const step = onboarding ? currentGuideStep(onboarding) : null;
  const [rect, setRect] = useState<Rect | null>(null);
  const pausedByGuide = useRef<TimeScaleOption | null>(null);

  // Durumdan anlaşılan adımlar kendiliğinden tamamlanır
  useEffect(() => {
    if (!step || !step.done) return;
    if (step.done(ctx)) {
      onAction({ type: 'complete', stepId: step.id });
      if (step.id === 'market-day') onAction({ type: 'marketUpdateSeen' });
    }
  });

  const available = step ? (step.available ? step.available(ctx) : true) : false;
  const showModal = Boolean(step?.modal) && available && !blocked;
  const showCard = Boolean(step) && !step?.modal && available && !blocked;

  // Karşılama penceresi açıkken oyun duraklar, kapanınca eski hıza döner
  useEffect(() => {
    if (showModal) {
      if (pausedByGuide.current === null && timeScale > 0) {
        pausedByGuide.current = timeScale;
        onSetTimeScale(0);
      }
    } else if (pausedByGuide.current !== null) {
      onSetTimeScale(pausedByGuide.current);
      pausedByGuide.current = null;
    }
  }, [showModal, timeScale, onSetTimeScale]);

  // Hedef öğeyi bul ve vurgula; bulunamazsa rect null kalır (kart yine görünür, uygulama kilitlenmez)
  useEffect(() => {
    const targetSel = step ? resolveGuideTarget(step, ctx) : undefined;
    if (!showCard || !targetSel) {
      setRect(null);
      return;
    }
    let scrolledFor: Element | null = null;
    const measure = () => {
      try {
        const el = document.querySelector(targetSel);
        if (!el) return setRect(null);
        if (scrolledFor !== el) {
          scrolledFor = el;
          (el as HTMLElement).scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        }
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return setRect(null);
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } catch {
        setRect(null);
      }
    };
    measure();
    const id = window.setInterval(measure, 400);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [showCard, step, state.selectedMapCityId, activeTab]);

  if (!step || !onboarding || (!showModal && !showCard)) return null;

  const text = step.text({ ...ctx, cash: formatCurrency(state.cash) });
  const index = GUIDE_STEPS.findIndex((s) => s.id === step.id);
  const manual = !step.done;
  // Harita adımlarında alt bilgi kartı (açılış düğmesi altta) rehber kartının altında kalmasın: kart üste alınır.
  const cardAtTop = activeTab === 'city' && step.id === 'opening-capital';
  const next = () => {
    onAction({ type: 'complete', stepId: step.id });
    if (step.id === 'welcome') onSelectTab('market');
  };

  if (showModal) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Oyuna başlangıç rehberi"
        data-testid="first-run-guide"
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4 text-center">
          <h2 className="g-display text-xl font-extrabold text-slate-900">{step.title}</h2>
          <p data-testid="first-run-text" className="text-base text-slate-600">{text}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" data-testid="first-run-skip" onClick={() => onAction({ type: 'dismiss' })} className="g-btn g-btn-secondary min-h-[48px]">
              Atla
            </button>
            <button type="button" data-testid="first-run-next" onClick={next} className="g-btn g-btn-primary min-h-[48px]">
              Borsaya git
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {rect && (
        <div
          aria-hidden="true"
          data-testid="guide-highlight"
          className="pointer-events-none fixed z-[55] rounded-2xl ring-4 ring-[var(--g-gold)] animate-pulse"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(15,23,42,.35)',
          }}
        />
      )}
      <div
        role="region"
        aria-label="Rehber adımı"
        data-testid="guide-step-card"
        data-step={step.id}
        className={`fixed left-3 right-3 z-[56] mx-auto max-w-md rounded-2xl bg-white p-3 shadow-2xl space-y-2 ${cardAtTop ? 'top-[calc(128px+env(safe-area-inset-top,0px))]' : 'bottom-[calc(84px+env(safe-area-inset-bottom))]'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="g-section-title">{step.title}</h3>
          <span className="text-[13px] font-bold text-[var(--g-muted)] tabular-nums">
            {index + 1}/{GUIDE_STEPS.length}
          </span>
        </div>
        <p className="text-sm text-slate-600">{text}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" data-testid="guide-skip" onClick={() => onAction({ type: 'dismiss' })} className="g-btn g-btn-secondary min-h-[48px]">
            Atla
          </button>
          {manual ? (
            <button type="button" data-testid="guide-next" onClick={next} className="g-btn g-btn-primary min-h-[48px]">
              İleri
            </button>
          ) : (
            <span className="flex items-center justify-center text-[13px] font-bold text-[var(--g-muted)]">Yaparak ilerle</span>
          )}
        </div>
      </div>
    </>
  );
};
