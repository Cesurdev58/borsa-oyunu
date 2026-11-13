/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Briefcase, Building2, CandlestickChart, Newspaper, Store } from 'lucide-react';
import { GameBottomTab } from './gameTypes';

interface GameBottomNavigationProps {
  activeTab: GameBottomTab;
  onSelectTab: (tab: GameBottomTab) => void;
  openOrdersCount: number;
  portfolioPositionsCount: number;
  hasPlayerCompany: boolean;
}

export const GameBottomNavigation: React.FC<GameBottomNavigationProps> =
  React.memo(
    ({
      activeTab,
      onSelectTab,
      openOrdersCount,
      portfolioPositionsCount,
      hasPlayerCompany,
    }) => {
      const tabs: Array<{
        id: GameBottomTab;
        label: string;
        Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
        badge?: number;
        dot?: boolean;
      }> = [
        { id: 'city', label: 'Şehir', Icon: Building2 },
        {
          id: 'market',
          label: 'Borsa',
          Icon: CandlestickChart,
          badge: openOrdersCount > 0 ? openOrdersCount : undefined,
        },
        { id: 'portfolio', label: 'Dükkân', Icon: Store, badge: portfolioPositionsCount > 0 ? portfolioPositionsCount : undefined },
        { id: 'company', label: 'Şirket', Icon: Briefcase, dot: hasPlayerCompany },
        { id: 'news', label: 'Haberler', Icon: Newspaper },
      ];

      return (
        <nav
          aria-label="Oyun Alt Navigasyon Çubuğu"
          data-testid="game-bottom-nav"
          className="sticky bottom-0 z-30 px-2 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]"
          style={{
            background: 'linear-gradient(180deg, var(--g-navy-800), var(--g-navy-900))',
            boxShadow: '0 -8px 24px -12px rgba(18,28,68,.55)',
          }}
        >
          <div className="max-w-5xl mx-auto grid grid-cols-5 gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const { Icon } = tab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`bottom-nav-${tab.id}`}
                  onClick={() => onSelectTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative min-h-[58px] min-w-[44px] py-1 flex flex-col items-center justify-center"
                >
                  <span
                    className={`w-11 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
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
                  <span
                    className={`text-[13px] leading-tight mt-1 truncate max-w-full ${
                      isActive ? 'text-white font-extrabold' : 'text-white/60 font-bold'
                    }`}
                  >
                    {tab.label}
                  </span>

                  {tab.badge !== undefined && (
                    <span className="absolute top-0.5 right-[18%] px-1.5 min-w-[20px] h-5 rounded-full bg-[var(--g-red)] text-white text-[13px] leading-none font-extrabold tabular-nums flex items-center justify-center ring-2 ring-[var(--g-navy-800)]">
                      {tab.badge}
                    </span>
                  )}
                  {tab.dot && tab.badge === undefined && (
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
