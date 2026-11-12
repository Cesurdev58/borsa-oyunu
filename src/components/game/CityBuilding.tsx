/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Factory,
  FlaskConical,
  Landmark,
  Lock,
  Newspaper,
  Rocket,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { CityBuildingId, CityBuildingViewModel } from './gameTypes';

interface CityBuildingProps {
  building: CityBuildingViewModel;
  onSelectBuilding: (id: CityBuildingId) => void;
}

function getBuildingThemePalette(
  theme: CityBuildingViewModel['accentTheme'],
  isUnlocked: boolean
) {
  if (!isUnlocked) {
    return {
      roofBg: 'bg-slate-200',
      roofBorder: 'border-slate-300',
      facadeBg: 'bg-slate-100/90',
      facadeBorder: 'border-slate-300 border-dashed',
      signBg: 'bg-slate-200 text-slate-600',
      windowLit: 'bg-slate-200 border-slate-300',
      doorBg: 'bg-slate-300',
      iconColor: 'text-slate-500',
      accentBar: 'bg-slate-400',
      statusColor: 'text-slate-600',
    };
  }

  switch (theme) {
    case 'emerald':
      return {
        roofBg: 'bg-emerald-600',
        roofBorder: 'border-emerald-700',
        facadeBg: 'bg-white',
        facadeBorder: 'border-emerald-200',
        signBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
        windowLit: 'bg-emerald-100/80 border-emerald-300',
        doorBg: 'bg-emerald-700',
        iconColor: 'text-emerald-600',
        accentBar: 'bg-emerald-500',
        statusColor: 'text-emerald-700',
      };
    case 'sky':
      return {
        roofBg: 'bg-sky-600',
        roofBorder: 'border-sky-700',
        facadeBg: 'bg-white',
        facadeBorder: 'border-sky-200',
        signBg: 'bg-sky-50 text-sky-900 border-sky-200',
        windowLit: 'bg-sky-100/80 border-sky-300',
        doorBg: 'bg-sky-700',
        iconColor: 'text-sky-600',
        accentBar: 'bg-sky-500',
        statusColor: 'text-sky-700',
      };
    case 'indigo':
      return {
        roofBg: 'bg-indigo-600',
        roofBorder: 'border-indigo-700',
        facadeBg: 'bg-white',
        facadeBorder: 'border-indigo-200',
        signBg: 'bg-indigo-50 text-indigo-900 border-indigo-200',
        windowLit: 'bg-indigo-100/80 border-indigo-300',
        doorBg: 'bg-indigo-700',
        iconColor: 'text-indigo-600',
        accentBar: 'bg-indigo-500',
        statusColor: 'text-indigo-700',
      };
    case 'amber':
      return {
        roofBg: 'bg-amber-500',
        roofBorder: 'border-amber-600',
        facadeBg: 'bg-white',
        facadeBorder: 'border-amber-200',
        signBg: 'bg-amber-50 text-amber-900 border-amber-200',
        windowLit: 'bg-amber-100/80 border-amber-300',
        doorBg: 'bg-amber-700',
        iconColor: 'text-amber-600',
        accentBar: 'bg-amber-500',
        statusColor: 'text-amber-800',
      };
    case 'teal':
      return {
        roofBg: 'bg-teal-600',
        roofBorder: 'border-teal-700',
        facadeBg: 'bg-white',
        facadeBorder: 'border-teal-200',
        signBg: 'bg-teal-50 text-teal-900 border-teal-200',
        windowLit: 'bg-teal-100/80 border-teal-300',
        doorBg: 'bg-teal-700',
        iconColor: 'text-teal-600',
        accentBar: 'bg-teal-500',
        statusColor: 'text-teal-700',
      };
    case 'violet':
      return {
        roofBg: 'bg-violet-600',
        roofBorder: 'border-violet-700',
        facadeBg: 'bg-white',
        facadeBorder: 'border-violet-200',
        signBg: 'bg-violet-50 text-violet-900 border-violet-200',
        windowLit: 'bg-violet-100/80 border-violet-300',
        doorBg: 'bg-violet-700',
        iconColor: 'text-violet-600',
        accentBar: 'bg-violet-500',
        statusColor: 'text-violet-700',
      };
    case 'rose':
    default:
      return {
        roofBg: 'bg-rose-600',
        roofBorder: 'border-rose-700',
        facadeBg: 'bg-white',
        facadeBorder: 'border-rose-200',
        signBg: 'bg-rose-50 text-rose-900 border-rose-200',
        windowLit: 'bg-rose-100/80 border-rose-300',
        doorBg: 'bg-rose-700',
        iconColor: 'text-rose-600',
        accentBar: 'bg-rose-500',
        statusColor: 'text-rose-700',
      };
  }
}

function renderBuildingIcon(id: CityBuildingId, className: string) {
  switch (id) {
    case 'BORSA':
      return <TrendingUp className={className} />;
    case 'BANKA':
      return <Landmark className={className} />;
    case 'HABER_MERKEZI':
      return <Newspaper className={className} />;
    case 'OYUNCU_OFISI':
      return <Building2 className={className} />;
    case 'SIRKET_MERKEZI':
      return <Rocket className={className} />;
    case 'FABRIKA':
      return <Factory className={className} />;
    case 'ARGE_MERKEZI':
      return <FlaskConical className={className} />;
    case 'HOLDING_MERKEZI':
      return <ShieldCheck className={className} />;
  }
}

export const CityBuilding: React.FC<CityBuildingProps> = React.memo(
  ({ building, onSelectBuilding }) => {
    const palette = getBuildingThemePalette(
      building.accentTheme,
      building.isUnlocked
    );
    const prevUnlockedRef = useRef(building.isUnlocked);
    const [justUnlocked, setJustUnlocked] = useState(false);

    useEffect(() => {
      if (!prevUnlockedRef.current && building.isUnlocked) {
        setJustUnlocked(true);
        const timer = window.setTimeout(() => setJustUnlocked(false), 1200);
        prevUnlockedRef.current = building.isUnlocked;
        return () => window.clearTimeout(timer);
      }
      prevUnlockedRef.current = building.isUnlocked;
    }, [building.isUnlocked]);

    const windowCount = building.level >= 3 ? 6 : 4;

    return (
      <button
        type="button"
        data-testid={`city-building-${building.id}`}
        onClick={() => onSelectBuilding(building.id)}
        aria-label={`${building.title} (${
          building.isUnlocked ? 'Açık' : 'Kilitli'
        }) - ${building.statusText}`}
        className={`group relative w-full text-left rounded-2xl border p-2.5 sm:p-3 transition-all duration-200 motion-safe:active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 min-h-[152px] flex flex-col justify-between ${
          justUnlocked ? 'motion-safe:scale-[1.03] ring-2 ring-emerald-400' : ''
        } ${
          building.isUnlocked
            ? `${palette.facadeBg} ${palette.facadeBorder} shadow-sm hover:shadow-md motion-safe:hover:-translate-y-0.5`
            : `${palette.facadeBg} ${palette.facadeBorder} opacity-85 hover:opacity-100`
        }`}
      >
        {/* Üst Çatı ve Kule Silüeti (Tycoon Mimari Katmanı) */}
        <div className="relative w-full">
          {/* Fabrika Bacası Dekorasyonu */}
          {building.id === 'FABRIKA' && building.isUnlocked && (
            <div
              aria-hidden="true"
              className="absolute -top-2 right-3 flex items-end gap-1"
            >
              <div className="w-2 h-3 bg-amber-700 rounded-t-xs" />
              {building.isActiveWorking && (
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300/90 -mt-2 motion-safe:animate-pulse" />
              )}
            </div>
          )}

          {building.id === 'BORSA' &&
            building.isUnlocked &&
            building.isActiveWorking && (
              <div
                aria-hidden="true"
                className="mb-1.5 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 tabular-nums text-[13px] flex items-center justify-between overflow-hidden"
              >
                <span>CANLI SEANS</span>
                <span className="font-bold text-emerald-400 motion-safe:animate-pulse">
                  ▲ AÇIK
                </span>
              </div>
            )}

          {/* Çatı Alınlığı (Pediment) */}
          <div
            aria-hidden="true"
            className={`h-2.5 w-11/12 mx-auto rounded-t-lg border-b ${palette.roofBg} ${palette.roofBorder} flex items-center justify-center`}
          >
            <div className="w-1/3 h-0.5 bg-white/50 rounded-full" />
          </div>

          {/* Tabela ve Bina Başlığı */}
          <div
            className={`mt-1 px-2 py-1.5 rounded-xl border flex items-center justify-between gap-1.5 ${palette.signBg}`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-white/90 border border-slate-200/80 flex items-center justify-center shrink-0">
                {building.isUnlocked ? (
                  renderBuildingIcon(
                    building.id,
                    `w-3.5 h-3.5 ${palette.iconColor}`
                  )
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight truncate">
                  {building.title}
                </div>
                <div className="text-[13px] opacity-80 truncate">
                  {building.districtLabel} · {building.shortTag}
                </div>
              </div>
            </div>

            <span className="text-[13px] tabular-nums font-bold px-1.5 py-0.5 rounded bg-white/80 text-slate-700 shrink-0">
              {building.isUnlocked ? `Sv.${building.level}` : 'Kilitli'}
            </span>
          </div>
        </div>

        {/* Orta Cephe: Mimari Pencereler ve Kapı */}
        <div
          aria-hidden="true"
          className="my-2 px-2 py-1.5 rounded-lg bg-slate-50/90 border border-slate-200/70 flex items-center justify-between gap-2"
        >
          <div className="grid grid-cols-3 gap-1 flex-1">
            {Array.from({ length: windowCount }).map((_, idx) => {
              const floor = Math.floor(idx / 3) + 1;
              const col = (idx % 3) + 1;
              return (
                <div
                  key={`window-${building.id.toLowerCase()}-floor-${floor}-col-${col}`}
                  className={`h-2.5 rounded-xs border ${palette.windowLit}`}
                />
              );
            })}
          </div>
          {/* Giriş Kapısı */}
          <div className="flex flex-col items-center shrink-0">
            <div
              className={`w-4 h-5 rounded-t-md ${palette.doorBg} border border-white/40`}
            />
            <div className="w-6 h-0.5 bg-slate-300 rounded-full" />
          </div>
        </div>

        {/* Alt Bilgi: Metrikler, Çalışma Durumu veya Kilit İlerlemesi */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1 text-[13px]">
            <span className="font-bold tabular-nums tabular-nums text-slate-900 truncate">
              {building.metricPrimary}
            </span>
            <span className="text-[13px] tabular-nums tabular-nums text-slate-500 truncate">
              {building.metricSecondary}
            </span>
          </div>

          {!building.isUnlocked ? (
            <div className="space-y-1 pt-0.5">
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all"
                  style={{ width: `${building.unlockProgressPct}%` }}
                />
              </div>
              <div className="text-[13px] font-medium text-slate-600 truncate">
                {building.statusText}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1 pt-0.5">
              <span
                className={`text-[13px] font-semibold truncate ${palette.statusColor}`}
              >
                {building.statusText}
              </span>
              <span className="text-[13px] font-semibold text-sky-700 group-hover:underline shrink-0">
                Aç →
              </span>
            </div>
          )}
        </div>

        {typeof building.badgeCount === 'number' && building.badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[13px] font-bold tabular-nums flex items-center justify-center shadow-xs">
            {building.badgeCount}
          </span>
        )}
      </button>
    );
  }
);
