/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Compass,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Moon,
} from 'lucide-react';
import { MarketSession, SimulationStage } from '../../models/simulation';
import { CityBuilding } from './CityBuilding';
import { CityBuildingId, CityBuildingViewModel } from './gameTypes';

interface CityWorldViewProps {
  buildings: CityBuildingViewModel[];
  day: number;
  dateISO: string;
  currentGameHour: number;
  marketSession: MarketSession;
  stage: SimulationStage;
  isPaused: boolean;
  headlineNews: string;
  onSelectBuilding: (id: CityBuildingId) => void;
}

function getSkyAtmosphere(hour: number) {
  if (hour >= 6 && hour < 10) {
    return {
      gradient: 'from-sky-50 via-amber-50/40 to-emerald-50/30',
      label: 'Sabah Seansı Hazırlığı',
      Icon: Sunrise,
      iconColor: 'text-amber-500',
    };
  }
  if (hour >= 10 && hour < 18) {
    return {
      gradient: 'from-sky-100/70 via-white to-emerald-50/40',
      label: 'Gündüz · Borsa Seansı',
      Icon: Sun,
      iconColor: 'text-amber-500',
    };
  }
  if (hour >= 18 && hour < 21) {
    return {
      gradient: 'from-indigo-50/60 via-amber-50/30 to-slate-50',
      label: 'Akşam · Seans Sonrası',
      Icon: Sunset,
      iconColor: 'text-orange-500',
    };
  }
  return {
    gradient: 'from-slate-100 via-sky-50/30 to-slate-50',
    label: 'Gece · Piyasa Kapalı',
    Icon: Moon,
    iconColor: 'text-indigo-500',
  };
}

export const CityWorldView: React.FC<CityWorldViewProps> = React.memo(
  ({
    buildings,
    day,
    dateISO,
    currentGameHour,
    marketSession,
    stage,
    isPaused,
    headlineNews,
    onSelectBuilding,
  }) => {
    const prevDayRef = useRef(day);
    const [showNewDayBanner, setShowNewDayBanner] = useState(false);

    useEffect(() => {
      if (day !== prevDayRef.current) {
        prevDayRef.current = day;
        setShowNewDayBanner(true);
        const timer = window.setTimeout(() => setShowNewDayBanner(false), 1800);
        return () => window.clearTimeout(timer);
      }
    }, [day]);

    const sky = getSkyAtmosphere(currentGameHour);
    const SkyIcon = sky.Icon;

    const coreBuildings = buildings.slice(0, 4);
    const expansionBuildings = buildings.slice(4, 8);

    return (
      <section
        aria-label="Finans Şehri Ana Görünümü"
        data-testid="city-world-view"
        className={`relative rounded-3xl border border-slate-200 bg-gradient-to-b ${sky.gradient} p-3 sm:p-4 shadow-xs overflow-hidden`}
      >
        {/* Yeni Gün Geçiş Bandı */}
        {showNewDayBanner && (
          <div className="mb-3 px-3 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-sm transition-all duration-200">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Yeni İş Günü Başladı: Gün {day} ({dateISO})
            </span>
            <span className="tabular-nums text-[13px]">Saat 00:00</span>
          </div>
        )}

        {/* Şehir Atmosfer Başlığı */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs shrink-0">
              <Compass className="w-4 h-4 text-sky-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                Finans & Holding Şehri
              </h1>
              <p className="text-[13px] text-slate-600 truncate">
                Binalara dokunarak borsa, şirket, üretim ve devralma işlemlerini yönetin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[13px] font-medium text-slate-700 bg-white/85 border border-slate-200/90 px-2.5 py-1 rounded-xl shrink-0">
            <SkyIcon className={`w-3.5 h-3.5 ${sky.iconColor}`} />
            <span>{sky.label}</span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="font-semibold text-emerald-700">
              Aşama {stage}/4
            </span>
          </div>
        </div>

        {/* 1. Bölge: Finans Meydanı (Başlangıçta Açık 4 Ana Bina) */}
        <div className="mb-2 flex items-center justify-between px-1 text-[13px] font-semibold text-slate-600">
          <span>Finans Meydanı & Merkez Binalar</span>
          <span className="text-emerald-700">4/4 Bina Aktif</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {coreBuildings.map((b) => (
            <CityBuilding
              key={b.id}
              building={b}
              onSelectBuilding={onSelectBuilding}
            />
          ))}
        </div>

        {/* Şehir Bulvarı & Hareketli Mini Araçlar (Dekoratif Cadde) */}
        <div
          aria-hidden="true"
          className="my-3 relative h-7 rounded-xl bg-slate-200/80 border border-slate-300/80 flex items-center overflow-hidden px-3"
        >
          {/* Kesikli Şerit Çizgisi */}
          <div className="w-full border-t-2 border-dashed border-slate-400/60" />

          {/* Şehir Bulvarı Etiketi */}
          <span className="absolute left-3 px-2 py-0.5 rounded bg-white/90 text-[13px] font-semibold text-slate-600 border border-slate-200">
            Borsa Bulvarı
          </span>

          {!isPaused && (
            <div className="absolute inset-x-32 flex items-center justify-around pointer-events-none">
              <span
                className={`w-3.5 h-1.5 rounded-xs ${
                  marketSession === 'MARKET_OPEN'
                    ? 'bg-emerald-600 motion-safe:animate-pulse'
                    : 'bg-sky-600'
                }`}
              />
              <span className="w-3.5 h-1.5 rounded-xs bg-amber-500 hidden sm:inline-block" />
            </div>
          )}

          <span className="absolute right-3 px-2 py-0.5 rounded bg-white/90 text-[13px] tabular-nums text-slate-600 border border-slate-200">
            Sanayi & Holding Bulvarı
          </span>
        </div>

        {/* 2. Bölge: Sanayi, Ar-Ge ve Holding Kampüsü (Aşama 2-4 Binaları) */}
        <div className="mb-2 flex items-center justify-between px-1 text-[13px] font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            Girişim, Sanayi, Ar-Ge & Holding Kampüsü
          </span>
          <span className="text-slate-500">
            {expansionBuildings.filter((b) => b.isUnlocked).length}/4 Bina Açık
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {expansionBuildings.map((b) => (
            <CityBuilding
              key={b.id}
              building={b}
              onSelectBuilding={onSelectBuilding}
            />
          ))}
        </div>

        {/* Şehir Alt Bilgi / Günün Haber Manşeti Şeridi */}
        <div className="mt-3 px-3 py-2 rounded-2xl bg-white/90 border border-slate-200/90 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[13px] shrink-0">
              GÜNÜN MANŞETİ
            </span>
            <span className="text-slate-700 font-medium truncate">
              {headlineNews}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectBuilding('HABER_MERKEZI')}
            className="text-[13px] font-semibold text-sky-700 hover:underline shrink-0 min-h-[32px] px-1"
          >
            Tümü →
          </button>
        </div>
      </section>
    );
  }
);
