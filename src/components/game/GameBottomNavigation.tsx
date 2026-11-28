/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Briefcase, Landmark, Map as MapIcon, CandlestickChart, Lock, Store } from 'lucide-react';
import type { NavTabId, NavTabStatus, ShopTabIndicators } from '../../engine/OnboardingRules';
import { GameBottomTab } from './gameTypes';

interface GameBottomNavigationProps {
  activeTab: GameBottomTab;
  onSelectTab: (tab: GameBottomTab) => void;
  openOrdersCount: number;
  /** Her sekmenin durumu (açık / kilitli önizleme / gizli); engine/OnboardingRules.ts */
  tabStatuses: Record<NavTabId, NavTabStatus>;
  /** Dükkân sekmesi rozeti verisi (hisse pozisyon sayısı DEĞİL) */
  shopIndicators: ShopTabIndicators;
  hasPlayerCompany: boolean;
  /** Eski çağrılarla uyum için duruyor: Rehber artık üst çubukta (`top-guide-btn`). */
  onOpenGuide?: () => void;
}

export const GameBottomNavigation: React.FC<GameBottomNavigationProps> =
  React.memo(
    ({
      activeTab,
      onSelectTab,
      openOrdersCount,
      tabStatuses,
      shopIndicators,
      hasPlayerCompany,
    }) => {
      const tabs: Array<{
        id: GameBottomTab;
        label: string;
        Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
        badge?: number;
        dot?: boolean;
      }> = [
        { id: 'city', label: 'Harita', Icon: MapIcon },
        {
          id: 'market',
          label: 'Borsa',
          Icon: CandlestickChart,
          badge: openOrdersCount > 0 ? openOrdersCount : undefined,
        },
        {
          id: 'portfolio',
          label: 'Dükkân',
          Icon: Store,
          badge: shopIndicators.emptyShopCount > 0 ? shopIndicators.emptyShopCount : undefined,
          dot: shopIndicators.ownedShopCount > 0 && shopIndicators.hasCollectable,
        },
        { id: 'company', label: 'Şirket', Icon: Briefcase, dot: hasPlayerCompany },
        { id: 'bank', label: 'Banka', Icon: Landmark },
      ];
      // Ferah 5'li alt menü: Haberler ve Rehber üst çubuktadır.
      const visibleTabs = tabs.filter((t) => tabStatuses[t.id].mode !== 'hidden');
      const colCount = Math.max(1, visibleTabs.length);

      // Kilitli sekmeye dokununca kısa açıklama (boş panel açılmaz)
      const [lockedHint, setLockedHint] = useState<string | null>(null);
      useEffect(() => {
        if (!lockedHint) return;
        const t = window.setTimeout(() => setLockedHint(null), 3200);
        return () => window.clearTimeout(t);
      }, [lockedHint]);

      return (
        <nav
          aria-label="Oyun Alt Navigasyon Çubuğu"
          data-testid="game-bottom-nav"
          className="sticky bottom-0 z-30 px-0.5 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]"
          style={{
            background: 'linear-gradient(180deg, var(--g-navy-800), var(--g-navy-900))',
            boxShadow: '0 -8px 24px -12px rgba(18,28,68,.55)',
          }}
        >
          {lockedHint && (
            <div
              role="status"
              data-testid="bottom-nav-locked-hint"
              className="absolute bottom-full left-3 right-3 mb-2 max-w-md mx-auto g-tip shadow-lg"
            >
              {lockedHint}
            </div>
          )}
          <div
            className="max-w-5xl mx-auto grid gap-0"
            style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
          >
            {visibleTabs.map((tab) => {
              const locked = tabStatuses[tab.id].mode === 'locked';
              const isActive = activeTab === tab.id && !locked;
              const { Icon } = tab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`bottom-nav-${tab.id}`}
                  onClick={() =>
                    locked ? setLockedHint(tabStatuses[tab.id].hint ?? 'Şimdilik kilitli.') : onSelectTab(tab.id)
                  }
                  aria-current={isActive ? 'page' : undefined}
                  aria-disabled={locked || undefined}
                  aria-label={locked ? `${tab.label} (kilitli)` : tab.label}
                  className={`relative min-h-[60px] min-w-[56px] py-1.5 flex flex-col items-center justify-center ${
                    locked ? 'opacity-50' : ''
                  }`}
                >
                  <span
                    className={`w-14 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isActive ? '-translate-y-0.5' : ''
                    }`}
                    style={
                      isActive
                        ? {
                            background: 'linear-gradient(180deg,#ffd56b,var(--g-gold))',
                            boxShadow: '0 3px 0 var(--g-gold-dark)',
                            color: '#3a2600',
                          }
                        : { color: 'rgba(255,255,255,.6)' }
                    }
                  >
                    <Icon className="w-5 h-5" strokeWidth={isActive ? 2.6 : 2.1} />
                  </span>
                  {locked && (
                    <Lock
                      aria-hidden="true"
                      data-testid={`bottom-nav-lock-${tab.id}`}
                      className="absolute top-1 right-[22%] w-3.5 h-3.5 text-white"
                    />
                  )}
                  <span
                    className={`text-[13px] leading-tight mt-1 truncate max-w-full ${
                      isActive ? 'text-white font-extrabold' : 'text-white/60 font-bold'
                    }`}
                  >
                    {tab.label}
                  </span>

                  {!locked && tab.badge !== undefined && (
                    <span className="absolute top-0.5 right-[18%] px-1.5 min-w-[20px] h-5 rounded-full bg-[var(--g-red)] text-white text-[13px] leading-none font-extrabold tabular-nums flex items-center justify-center ring-2 ring-[var(--g-navy-800)]">
                      {tab.badge}
                    </span>
                  )}
                  {!locked && tab.dot && tab.badge === undefined && (
                    <span className="absolute top-1.5 right-[26%] w-2.5 h-2.5 rounded-full bg-[var(--g-green)] ring-2 ring-[var(--g-navy-800)]" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      );
    }
  );
