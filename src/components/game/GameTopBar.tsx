/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Bell, Settings, Star } from 'lucide-react';
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

    const [floatDelta, setFloatDelta] = useState<{ id: number; amount: number } | null>(null);

    useEffect(() => {
      const diff = cash - prevCashRef.current;
      if (Math.abs(diff) >= 1) {
        setCashDeltaDirection(diff > 0 ? 'up' : 'down');
        prevCashRef.current = cash;
        // Çok küçük hareketlerde (günlük faiz kırıntıları gibi) yazı çıkarma
        if (Math.abs(diff) >= 100) {
          setFloatDelta({ id: Date.now(), amount: diff });
        }
        const t = window.setTimeout(() => setCashDeltaDirection(null), 650);
        const t2 = window.setTimeout(() => setFloatDelta(null), 1400);
        return () => {
          window.clearTimeout(t);
          window.clearTimeout(t2);
        };
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

    const [infoOpen, setInfoOpen] = useState(false);

    return (
      <header
        aria-label="Oyun Üst Bilgi Çubuğu"
        className="sticky top-0 z-30 bg-gradient-to-r from-sky-600 via-sky-500 to-emerald-500 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2.5 shadow-md rounded-b-3xl"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          {/* Sol: Gün ve saat */}
          <div className="flex flex-col shrink-0 text-white leading-tight">
            <span
              data-testid="tycoon-top-day"
              className="text-base font-extrabold"
            >
              Gün {day}
            </span>
            <span
              data-testid="tycoon-game-clock"
              className="inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums"
            >
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full ${sessionMeta.dotClass}`}
              />
              {formattedTime}
            </span>
          </div>

          {/* Orta: tek büyük para kutusu; dokununca ayrıntı kartı açılır */}
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-label={cashMeta.ariaLabel}
            aria-expanded={infoOpen}
            className={`flex-1 min-w-0 max-w-[190px] min-h-[48px] px-3 rounded-2xl text-center shadow-md transition-all duration-200 cursor-pointer active:scale-95 ${
              cashDeltaDirection === 'up'
                ? 'bg-emerald-100 motion-safe:scale-[1.03]'
                : cashDeltaDirection === 'down'
                ? 'bg-amber-100 motion-safe:scale-[1.03]'
                : 'bg-white'
            }`}
          >
            <div
              data-testid="tycoon-top-cash"
              data-full-value={cashMeta.full}
              data-abbreviated-value={cashMeta.abbreviated}
              className="text-lg font-extrabold tabular-nums text-slate-900 whitespace-nowrap leading-tight"
            >
              💰 {cashMeta.abbreviated}
            </div>
            <div className="text-[13px] text-slate-500 leading-tight">
              {infoOpen ? 'Kapat ▲' : 'Detay ▼'}
            </div>
          </button>

          {floatDelta && (
            <span
              key={floatDelta.id}
              aria-hidden="true"
              data-testid="cash-float-delta"
              className={`pointer-events-none absolute left-1/2 top-12 -translate-x-1/2 px-3 py-1 rounded-full text-sm font-extrabold shadow-lg float-up ${
                floatDelta.amount > 0
                  ? 'bg-emerald-500 text-white'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {floatDelta.amount > 0 ? '+' : '−'}
              {formatHudCurrencyTR(Math.abs(floatDelta.amount), 'Nakit').abbreviated}
            </span>
          )}

          {/* Sağ: seviye, bildirim, ayarlar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              data-testid="tycoon-top-stage"
              className="min-w-[44px] min-h-[44px] rounded-2xl bg-amber-300 text-amber-950 font-extrabold text-sm flex flex-col items-center justify-center leading-none shadow"
              title={`Aşama ${stage}`}
            >
              <Star className="w-4 h-4 fill-amber-600 text-amber-700" aria-hidden="true" />
              <span>{stage}</span>
            </span>
            <button
              type="button"
              data-testid="top-notifications-btn"
              onClick={onOpenNotifications}
              aria-label={`Bildirimler (${unreadNotificationsCount} yeni)`}
              className="relative min-w-[44px] min-h-[44px] rounded-2xl bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center shadow"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span
                  data-testid="notification-badge-count"
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[13px] font-bold flex items-center justify-center"
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
              className="min-w-[44px] min-h-[44px] rounded-2xl bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center shadow"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {infoOpen && (
          <div className="max-w-5xl mx-auto mt-2 rounded-2xl bg-white p-3 shadow-lg grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-amber-50 p-2.5">
              <div className="text-[13px] text-amber-800">📈 Toplam varlığın</div>
              <div
                data-testid="tycoon-top-networth"
                data-full-value={netWorthMeta.full}
                data-abbreviated-value={netWorthMeta.abbreviated}
                className="font-extrabold text-slate-900 tabular-nums"
              >
                {netWorthMeta.full}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5">
              <div className="text-[13px] text-emerald-800">💰 Tam nakit</div>
              <div className="font-extrabold text-slate-900 tabular-nums">
                {cashMeta.full}
              </div>
            </div>
            <div className="rounded-xl bg-indigo-50 p-2.5">
              <div className="text-[13px] text-indigo-800">⭐ Aşama</div>
              <div className="font-extrabold text-slate-900">Aşama {stage}</div>
            </div>
            <div
              data-testid="tycoon-market-session-badge"
              className="rounded-xl bg-slate-50 p-2.5"
            >
              <div className="text-[13px] text-slate-600">🏛️ Borsa</div>
              <div className="font-extrabold text-slate-900">
                {sessionMeta.shortLabel}
              </div>
            </div>
            <div className="col-span-2 text-[13px] text-slate-500 text-center">
              {formatDateTR(dateISO)}
            </div>
          </div>
        )}
      </header>
    );
  }
);
