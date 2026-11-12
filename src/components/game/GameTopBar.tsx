/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Bell,
  Clock,
  Settings,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { MarketSession, SimulationStage } from '../../models/simulation';
import { formatHudCurrencyTR } from './city/questAndHudLogic';
import { formatDateTR, getMarketSessionBadgeMeta } from './gameTypes';

interface GameTopBarProps {
  day: number;
  stage?: SimulationStage;
  dateISO: string;
  formattedTime: string;
  marketSession: MarketSession;
  cash: number;
  netWorth: number;
  unreadNotificationsCount: number;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onSwitchToDeveloperDashboard: () => void;
  formatCurrency: (val: number) => string;
}

export const GameTopBar: React.FC<GameTopBarProps> = React.memo(
  ({
    day,
    stage = 1,
    dateISO,
    formattedTime,
    marketSession,
    cash,
    netWorth,
    unreadNotificationsCount,
    onOpenNotifications,
    onOpenSettings,
  }) => {
    const sessionMeta = getMarketSessionBadgeMeta(marketSession);
    const prevCashRef = useRef(cash);
    const prevNetWorthRef = useRef(netWorth);
    const [cashDeltaDirection, setCashDeltaDirection] = useState<
      'up' | 'down' | null
    >(null);
    const [netWorthDeltaDirection, setNetWorthDeltaDirection] = useState<
      'up' | 'down' | null
    >(null);
    const [showExactCash, setShowExactCash] = useState(false);
    const [showExactNetWorth, setShowExactNetWorth] = useState(false);

    useEffect(() => {
      if (Math.abs(cash - prevCashRef.current) >= 1) {
        setCashDeltaDirection(cash > prevCashRef.current ? 'up' : 'down');
        prevCashRef.current = cash;
        const t = window.setTimeout(() => setCashDeltaDirection(null), 650);
        return () => window.clearTimeout(t);
      }
    }, [cash]);

    useEffect(() => {
      if (Math.abs(netWorth - prevNetWorthRef.current) >= 1) {
        setNetWorthDeltaDirection(
          netWorth > prevNetWorthRef.current ? 'up' : 'down'
        );
        prevNetWorthRef.current = netWorth;
        const t = window.setTimeout(
          () => setNetWorthDeltaDirection(null),
          650
        );
        return () => window.clearTimeout(t);
      }
    }, [netWorth]);

    const cashMeta = formatHudCurrencyTR(cash, 'Nakit');
    const netWorthMeta = formatHudCurrencyTR(netWorth, 'Net Varlık');

    return (
      <header
        aria-label="Oyun Üst Bilgi Çubuğu"
        className="sticky top-0 z-30 bg-gradient-to-r from-sky-600 via-sky-500 to-emerald-500 px-2 sm:px-4 pt-[max(0.35rem,env(safe-area-inset-top))] pb-2 shadow-md rounded-b-3xl"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-1 sm:gap-3">
          {/* Sol: Gün, Saat, Aşama ve Piyasa Durumu Rozeti */}
          <div className="flex flex-col min-w-0 shrink-0">
            <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-white font-mono tabular-nums">
              <span data-testid="tycoon-top-day">Gün {day}</span>
              <span className="text-slate-300 hidden md:inline" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-500 hidden md:inline">
                {formatDateTR(dateISO)}
              </span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span
                data-testid="tycoon-game-clock"
                className="inline-flex items-center gap-0.5 text-white font-bold"
              >
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white shrink-0" />
                {formattedTime}
              </span>
            </div>

            <div className="flex items-center gap-1 mt-0.5">
              <span
                data-testid="tycoon-top-stage"
                className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[9px] sm:text-[10px] font-bold"
              >
                <Award className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                <span>Aşama {stage}</span>
              </span>

              <span
                data-testid="tycoon-market-session-badge"
                className={`inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold border ${sessionMeta.bgClass} ${sessionMeta.textClass} ${sessionMeta.borderClass}`}
              >
                <span
                  aria-hidden="true"
                  className={`w-1.5 h-1.5 rounded-full ${sessionMeta.dotClass}`}
                />
                <span>{sessionMeta.shortLabel}</span>
              </span>
            </div>
          </div>

          {/* Orta: Oyuncu Nakdi ve Toplam Net Varlık (Kısaltılmış + Dokununca Tam Tutar) */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 justify-center">
            <button
              type="button"
              onClick={() => setShowExactCash((prev) => !prev)}
              aria-label={cashMeta.ariaLabel}
              title={`Tam tutar: ${cashMeta.full}`}
              className={`px-1.5 sm:px-3 py-1 rounded-xl border text-left transition-all duration-200 shrink-0 cursor-pointer ${
                cashDeltaDirection === 'up'
                  ? 'bg-emerald-50 border-emerald-300 motion-safe:scale-[1.02]'
                  : cashDeltaDirection === 'down'
                  ? 'bg-amber-50 border-amber-300 motion-safe:scale-[1.02]'
                  : 'bg-white border-white shadow-md'
              }`}
            >
              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-slate-500">
                <Wallet className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600 shrink-0" />
                <span>Nakit</span>
              </div>
              <div
                data-testid="tycoon-top-cash"
                data-full-value={cashMeta.full}
                data-abbreviated-value={cashMeta.abbreviated}
                className="text-xs sm:text-sm font-extrabold font-mono tabular-nums tracking-tight text-slate-900 whitespace-nowrap"
              >
                {showExactCash ? cashMeta.full : cashMeta.abbreviated}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setShowExactNetWorth((prev) => !prev)}
              aria-label={netWorthMeta.ariaLabel}
              title={`Tam tutar: ${netWorthMeta.full}`}
              className={`px-1.5 sm:px-3 py-1 rounded-xl border text-left transition-all duration-200 shrink-0 cursor-pointer ${
                netWorthDeltaDirection === 'up'
                  ? 'bg-emerald-50 border-emerald-300 motion-safe:scale-[1.02]'
                  : netWorthDeltaDirection === 'down'
                  ? 'bg-rose-50 border-rose-300 motion-safe:scale-[1.02]'
                  : 'bg-amber-50 border-amber-200 shadow-md'
              }`}
            >
              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-amber-800">
                <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600 shrink-0" />
                <span>Net Varlık</span>
              </div>
              <div
                data-testid="tycoon-top-networth"
                data-full-value={netWorthMeta.full}
                data-abbreviated-value={netWorthMeta.abbreviated}
                className="text-xs sm:text-sm font-extrabold font-mono tabular-nums tracking-tight text-amber-900 whitespace-nowrap"
              >
                {showExactNetWorth ? netWorthMeta.full : netWorthMeta.abbreviated}
              </div>
            </button>
          </div>

          {/* Sağ: Bildirim Simgesi ve Ayarlar */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="top-notifications-btn"
              onClick={onOpenNotifications}
              aria-label={`Bildirimler (${unreadNotificationsCount} yeni)`}
              className="relative min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] rounded-xl border border-white/40 bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span
                  data-testid="notification-badge-count"
                  className="absolute top-0.5 right-0.5 min-w-[15px] h-3.5 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold font-mono flex items-center justify-center"
                >
                  {unreadNotificationsCount > 99
                    ? '99+'
                    : unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              data-testid="top-settings-btn"
              onClick={onOpenSettings}
              aria-label="Oyun Ayarları ve Geliştirici Araçları"
              className="min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] rounded-xl border border-white/40 bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
    );
  }
);
