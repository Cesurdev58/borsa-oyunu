/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Briefcase,
  Building2,
  Compass,
  Newspaper,
  TrendingUp,
} from 'lucide-react';
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
        Icon: React.ComponentType<{ className?: string }>;
        badge?: number | string;
      }> = [
        {
          id: 'city',
          label: 'Şehir',
          Icon: Compass,
        },
        {
          id: 'market',
          label: 'Borsa',
          Icon: TrendingUp,
          badge: openOrdersCount > 0 ? openOrdersCount : undefined,
        },
        {
          id: 'company',
          label: 'Şirket',
          Icon: Building2,
          badge: hasPlayerCompany ? 'Aktif' : undefined,
        },
        {
          id: 'news',
          label: 'Haberler',
          Icon: Newspaper,
        },
        {
          id: 'portfolio',
          label: 'Portföy',
          Icon: Briefcase,
          badge:
            portfolioPositionsCount > 0 ? portfolioPositionsCount : undefined,
        },
      ];

      return (
        <nav
          aria-label="Oyun Alt Navigasyon Çubuğu"
          data-testid="game-bottom-nav"
          className="sticky bottom-0 z-30 bg-white/95 border-t border-slate-200 px-2 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-xs"
        >
          <div className="max-w-5xl mx-auto grid grid-cols-5 gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const TabIcon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`bottom-nav-${tab.id}`}
                  onClick={() => onSelectTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative min-h-[48px] min-w-[44px] py-1 px-1 rounded-xl flex flex-col items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <TabIcon
                    className={`w-4 h-4 ${
                      isActive ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  />
                  <span className="text-[11px] leading-tight mt-1 truncate max-w-full">
                    {tab.label}
                  </span>

                  {tab.badge !== undefined && (
                    <span className="absolute top-1 right-1.5 px-1 min-w-[16px] h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold font-mono flex items-center justify-center">
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
