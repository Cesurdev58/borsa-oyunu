/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
        emoji: string;
        color: string;
        badge?: number | string;
      }> = [
        {
          id: 'city',
          label: 'Şehir',
          emoji: '🏙️',
          color: 'from-sky-400 to-sky-600',
        },
        {
          id: 'market',
          label: 'Borsa',
          emoji: '📈',
          color: 'from-emerald-400 to-emerald-600',
          badge: openOrdersCount > 0 ? openOrdersCount : undefined,
        },
        {
          id: 'company',
          label: 'Şirket',
          emoji: '🏢',
          color: 'from-violet-400 to-violet-600',
          badge: hasPlayerCompany ? 'Aktif' : undefined,
        },
        {
          id: 'news',
          label: 'Haberler',
          emoji: '📰',
          color: 'from-amber-400 to-orange-500',
        },
        {
          id: 'portfolio',
          label: 'Dükkânım',
          emoji: '🏪',
          color: 'from-rose-400 to-pink-600',
          badge:
            portfolioPositionsCount > 0 ? portfolioPositionsCount : undefined,
        },
      ];

      return (
        <nav
          aria-label="Oyun Alt Navigasyon Çubuğu"
          data-testid="game-bottom-nav"
          className="sticky bottom-0 z-30 bg-white border-t-2 border-slate-100 px-2 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-xs"
        >
          <div className="max-w-5xl mx-auto grid grid-cols-5 gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`bottom-nav-${tab.id}`}
                  onClick={() => onSelectTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative min-h-[56px] min-w-[44px] py-1 px-1 rounded-xl flex flex-col items-center justify-center transition-colors ${
                    isActive
                      ? 'text-slate-900 font-extrabold'
                      : 'text-slate-500 font-semibold'
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center text-lg transition-transform ${
                      isActive
                        ? `bg-gradient-to-b ${tab.color} shadow-md -translate-y-1 scale-110`
                        : 'bg-slate-100'
                    }`}
                  >
                    {tab.emoji}
                  </span>
                  <span className="text-[11px] leading-tight mt-0.5 truncate max-w-full">
                    {tab.label}
                  </span>

                  {tab.badge !== undefined && (
                    <span className="absolute top-0 right-2 px-1 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold font-mono flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      );
    }
  );
