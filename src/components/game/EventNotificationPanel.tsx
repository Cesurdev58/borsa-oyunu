/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { play } from './ui/feedback';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';
import { GameNotificationItem } from './gameTypes';

interface EventNotificationPanelProps {
  notifications: GameNotificationItem[];
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onMarkAllRead: () => void;
}

function getSeverityStyle(severity: GameNotificationItem['severity']) {
  switch (severity) {
    case 'success':
      return {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        badge: 'bg-emerald-600 text-white',
        Icon: CheckCircle2,
        iconColor: 'text-emerald-600',
        chip: 'bg-[var(--g-green)] text-white',
      };
    case 'warning':
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-900',
        badge: 'bg-amber-600 text-white',
        Icon: AlertTriangle,
        iconColor: 'text-amber-600',
        chip: 'bg-[var(--g-gold)] text-[#5a3a00]',
      };
    case 'error':
      return {
        bg: 'bg-rose-50 border-rose-200 text-rose-900',
        badge: 'bg-rose-600 text-white',
        Icon: XCircle,
        iconColor: 'text-rose-600',
        chip: 'bg-[var(--g-red)] text-white',
      };
    case 'info':
    default:
      return {
        bg: 'bg-sky-50/90 border-sky-200 text-slate-800',
        badge: 'bg-sky-600 text-white',
        Icon: Info,
        iconColor: 'text-sky-600',
        chip: 'bg-[var(--g-navy-400)] text-white',
      };
  }
}

export const EventNotificationPanel: React.FC<EventNotificationPanelProps> =
  React.memo(
    ({
      notifications,
      isDrawerOpen,
      onOpenDrawer,
      onCloseDrawer,
      onMarkAllRead,
    }) => {
      const latest = notifications[0] || null;

      // Yeni bildirim gelince altta birkaç saniyelik bir "toast" belirir, sonra kaybolur.
      const [toastId, setToastId] = useState<string | null>(null);
      const seenRef = useRef<string | null>(latest?.id ?? null);
      useEffect(() => {
        if (!latest || latest.id === seenRef.current) return;
        seenRef.current = latest.id;
        setToastId(latest.id);
        if (latest.severity === 'error') play('error');
        else if (latest.severity === 'success' && latest.important) play('success');
        const t = window.setTimeout(() => setToastId(null), 4200);
        return () => window.clearTimeout(t);
      }, [latest]);

      useEffect(() => {
        if (!isDrawerOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            onCloseDrawer();
          }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, [isDrawerOpen, onCloseDrawer]);

      const latestStyle = latest
        ? getSeverityStyle(latest.severity)
        : getSeverityStyle('info');
      const LatestIcon = latestStyle.Icon;
      const toastVisible = !!latest && toastId === latest.id;

      return (
        <>
          {/* Yeni olay bildirimi (geçici) */}
          <section
            aria-label="Aktif Olay ve Bildirim Alanı"
            aria-live="polite"
            data-testid="active-event-banner"
            onClick={() => {
              setToastId(null);
              onOpenDrawer();
            }}
            className={`${
              toastVisible ? 'g-toast-in' : 'hidden'
            } fixed left-1/2 -translate-x-1/2 bottom-[88px] z-40 w-[min(92vw,420px)] rounded-2xl px-3 py-2.5 flex items-center gap-3 cursor-pointer text-white`}
            style={{ background: 'rgba(18,28,68,.94)', boxShadow: '0 12px 30px -10px rgba(18,28,68,.7)' }}
          >
            <span className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center ${latestStyle.chip}`}>
              <LatestIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              {latest && (
                <>
                  <div className="text-sm font-extrabold leading-tight truncate">{latest.title}</div>
                  <div className="text-[13px] text-white/75 leading-snug line-clamp-2">{latest.message}</div>
                </>
              )}
            </div>
          </section>

          {/* Bildirim Merkezi Modal / Drawer */}
          {isDrawerOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Oyun Bildirim Merkezi"
              data-testid="notification-center-modal"
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(18,28,68,.55)] p-0 sm:p-4"
              onClick={onCloseDrawer}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="g-rise w-full max-w-lg max-h-[82vh] bg-[var(--g-bg)] rounded-t-[24px] sm:rounded-[24px] shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="g-hero rounded-none px-4 py-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-[var(--g-gold)]" />
                    <h2 className="g-display text-lg font-extrabold text-white">
                      Bildirimler
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="min-h-[40px] px-3 text-[13px] font-extrabold text-white/80 bg-white/10 rounded-full"
                    >
                      Tümü okundu
                    </button>
                    <button
                      type="button"
                      aria-label="Bildirim Merkezini Kapat"
                      onClick={onCloseDrawer}
                      className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8">
                      Henüz bildirim yok.
                    </p>
                  ) : (
                    notifications.map((item) => {
                      const st = getSeverityStyle(item.severity);
                      const ItemIcon = st.Icon;
                      return (
                        <div
                          key={item.id}
                          className="g-card p-3 text-sm flex items-start gap-3"
                        >
                          <span className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${st.chip}`}>
                            <ItemIcon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-[var(--g-ink)]">{item.title}</span>
                              <span className="text-[13px] tabular-nums text-[var(--g-muted)] font-bold shrink-0">
                                Gün {item.day} · {item.gameTime}
                              </span>
                            </div>
                            <p className="text-[var(--g-muted)] leading-snug text-[13px] font-semibold">
                              {item.message}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      );
    }
  );
