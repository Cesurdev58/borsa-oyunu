/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
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
      };
    case 'warning':
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-900',
        badge: 'bg-amber-600 text-white',
        Icon: AlertTriangle,
        iconColor: 'text-amber-600',
      };
    case 'error':
      return {
        bg: 'bg-rose-50 border-rose-200 text-rose-900',
        badge: 'bg-rose-600 text-white',
        Icon: XCircle,
        iconColor: 'text-rose-600',
      };
    case 'info':
    default:
      return {
        bg: 'bg-sky-50/90 border-sky-200 text-slate-800',
        badge: 'bg-sky-600 text-white',
        Icon: Info,
        iconColor: 'text-sky-600',
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

      return (
        <>
          {/* Aktif Olay / Bildirim Şeridi */}
          <section
            aria-label="Aktif Olay ve Bildirim Alanı"
            data-testid="active-event-banner"
            className={`rounded-2xl border px-3 py-2 flex items-center justify-between gap-2 shadow-2xs transition-colors duration-200 ${latestStyle.bg}`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <LatestIcon
                className={`w-4 h-4 shrink-0 ${latestStyle.iconColor}`}
              />
              <div className="min-w-0 flex-1 text-xs">
                {latest ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold">{latest.title}:</span>
                    <span className="font-medium truncate">
                      {latest.message}
                    </span>
                    <span className="text-[13px] tabular-nums opacity-75 shrink-0">
                      (Gün {latest.day} · {latest.gameTime})
                    </span>
                  </div>
                ) : (
                  <span className="font-medium text-slate-700">
                    Finans şehri aktif. Binalara dokunarak işlem yapabilirsiniz.
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenDrawer}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white/90 hover:bg-white border border-slate-200/90 text-[13px] font-semibold text-slate-800 shrink-0 transition-colors"
            >
              Geçmiş ({notifications.length})
            </button>
          </section>

          {/* Bildirim Merkezi Modal / Drawer */}
          {isDrawerOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Oyun Bildirim Merkezi"
              data-testid="notification-center-modal"
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4"
              onClick={onCloseDrawer}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg max-h-[82vh] bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-xl flex flex-col overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-sky-600" />
                    <h2 className="text-sm font-bold text-slate-900">
                      Oyun Olayları & Bildirim Merkezi
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="min-h-[44px] px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50 rounded-xl"
                    >
                      Tümünü Okundu İşaretle
                    </button>
                    <button
                      type="button"
                      aria-label="Bildirim Merkezini Kapat"
                      onClick={onCloseDrawer}
                      className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8">
                      Henüz kayıtlı bir bildirim bulunmuyor.
                    </p>
                  ) : (
                    notifications.map((item) => {
                      const st = getSeverityStyle(item.severity);
                      const ItemIcon = st.Icon;
                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${st.bg}`}
                        >
                          <ItemIcon
                            className={`w-4 h-4 mt-0.5 shrink-0 ${st.iconColor}`}
                          />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold">{item.title}</span>
                              <span className="text-[13px] tabular-nums opacity-80 shrink-0">
                                Gün {item.day} · {item.gameTime}
                              </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed">
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
