/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCountUp } from './ui/useCountUp';
import React, { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, Coins, Settings, Star } from 'lucide-react';
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
    const animatedCash = useCountUp(cash);
    const shownCash = formatHudCurrencyTR(animatedCash, 'Nakit').abbreviated;

    const [infoOpen, setInfoOpen] = useState(false);

    return (
      <header
        aria-label="Oyun Üst Bilgi Çubuğu"
        className="sticky top-0 z-30 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2.5"
        style={{
          background: 'linear-gradient(180deg, var(--g-navy-800), var(--g-navy-900))',
          boxShadow: '0 8px 24px -14px rgba(18,28,68,.8)',
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          {/* Sol: Gün ve saat */}
          <div className="flex flex-col shrink-0 text-white leading-tight">
            <span data-testid="tycoon-top-day" className="g-display text-lg font-extrabold leading-none">
              Gün {day}
            </span>
            <span
              data-testid="tycoon-game-clock"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold tabular-nums text-white/70 mt-1"
            >
              <span aria-hidden="true" className={`w-2 h-2 rounded-full ${sessionMeta.dotClass}`} />
              {formattedTime}
            </span>
          </div>

          {/* Orta: para kutusu; dokununca ayrıntı kartı açılır */}
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-label={cashMeta.ariaLabel}
            aria-expanded={infoOpen}
            className={`relative flex-1 min-w-0 max-w-[210px] h-11 pl-1 pr-3 rounded-full flex items-center gap-1.5 cursor-pointer transition-transform ${
              cashDeltaDirection ? 'motion-safe:scale-[1.04]' : ''
            }`}
            style={{
              background: 'rgba(0,0,0,.28)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.08)',
            }}
          >
            <span
              aria-hidden="true"
              className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(180deg,#ffe08a,var(--g-gold))', boxShadow: '0 2px 0 var(--g-gold-dark)' }}
            >
              <Coins className="w-[18px] h-[18px] text-[#7a4f00]" strokeWidth={2.4} />
            </span>
            <span
              data-testid="tycoon-top-cash"
              data-full-value={cashMeta.full}
              data-abbreviated-value={cashMeta.abbreviated}
              className={`g-display flex-1 min-w-0 text-left text-[17px] font-extrabold tabular-nums whitespace-nowrap truncate leading-none pt-0.5 ${
                cashDeltaDirection === 'up'
                  ? 'text-[#7dffbc]'
                  : cashDeltaDirection === 'down'
                  ? 'text-[#ffb4b2]'
                  : 'text-white'
              }`}
            >
              {shownCash}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`hidden min-[400px]:block w-4 h-4 shrink-0 text-white/60 transition-transform ${infoOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {floatDelta && (
            <span
              key={floatDelta.id}
              aria-hidden="true"
              data-testid="cash-float-delta"
              className={`g-display pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 px-3 py-1 rounded-full text-sm font-extrabold shadow-lg float-up ${
                floatDelta.amount > 0 ? 'bg-[var(--g-green)] text-white' : 'bg-[var(--g-red)] text-white'
              }`}
            >
              {floatDelta.amount > 0 ? '+' : '−'}
              {formatHudCurrencyTR(Math.abs(floatDelta.amount), 'Nakit').abbreviated}
            </span>
          )}

          {/* Sağ: seviye, bildirim, ayarlar */}
          <div className="flex items-center gap-1 shrink-0">
            <span
              data-testid="tycoon-top-stage"
              className="relative w-9 h-9 flex items-center justify-center"
              title={`Aşama ${stage}`}
            >
              <Star className="absolute inset-0 w-9 h-9 fill-[var(--g-gold)] text-[var(--g-gold-dark)]" strokeWidth={1.5} aria-hidden="true" />
              <span className="g-display relative text-[15px] font-extrabold text-[#5a3a00] pt-0.5">{stage}</span>
            </span>
            <button
              type="button"
              data-testid="top-notifications-btn"
              onClick={onOpenNotifications}
              aria-label={`Bildirimler (${unreadNotificationsCount} yeni)`}
              className="relative w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span
                  data-testid="notification-badge-count"
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--g-red)] text-white text-[12px] leading-none font-extrabold flex items-center justify-center ring-2 ring-[var(--g-navy-800)]"
                >
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              data-testid="top-settings-btn"
              onClick={onOpenSettings}
              aria-label="Oyun Ayarları ve Geliştirici Araçları"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {infoOpen && (
          <div className="g-rise max-w-5xl mx-auto mt-2.5 rounded-2xl p-3 grid grid-cols-2 gap-2 text-sm bg-white/[0.06] border border-white/10 text-white">
            <div className="rounded-xl bg-white/[0.06] p-2.5">
              <div className="text-[13px] text-white/60 font-bold">Toplam varlık</div>
              <div
                data-testid="tycoon-top-networth"
                data-full-value={netWorthMeta.full}
                data-abbreviated-value={netWorthMeta.abbreviated}
                className="g-display font-extrabold tabular-nums text-[var(--g-gold)] text-base"
              >
                {netWorthMeta.full}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.06] p-2.5">
              <div className="text-[13px] text-white/60 font-bold">Nakit</div>
              <div className="g-display font-extrabold tabular-nums text-base">{cashMeta.full}</div>
            </div>
            <div className="rounded-xl bg-white/[0.06] p-2.5">
              <div className="text-[13px] text-white/60 font-bold">Aşama</div>
              <div className="g-display font-extrabold text-base">{stage}. aşama</div>
            </div>
            <div data-testid="tycoon-market-session-badge" className="rounded-xl bg-white/[0.06] p-2.5">
              <div className="text-[13px] text-white/60 font-bold">Borsa</div>
              <div className="g-display font-extrabold text-base">{sessionMeta.shortLabel}</div>
            </div>
            <div className="col-span-2 text-[13px] text-white/50 text-center font-semibold">{formatDateTR(dateISO)}</div>
          </div>
        )}
      </header>
    );
  }
);
