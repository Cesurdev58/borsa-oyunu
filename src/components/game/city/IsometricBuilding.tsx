/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Factory,
  FlaskConical,
  HardHat,
  Landmark,
  Lock,
  Radio,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { CityBuildingId } from '../gameTypes';
import {
  CityAtmosphereTheme,
  IsometricBuildingNode,
} from './cityVisualTypes';
import { CityVisualEventPulse } from './questAndHudLogic';
import { CORE_BUILDING_SPRITES, getSpriteHeightPx } from './buildingSprites';

interface IsometricBuildingProps {
  building: IsometricBuildingNode;
  atmosphere: CityAtmosphereTheme;
  isSelected: boolean;
  onSelectBuilding: (id: CityBuildingId) => void;
  activePulses?: CityVisualEventPulse[];
  reducedShadows?: boolean;
}

interface StructurePalette {
  roofTopClass: string;
  roofEdgeClass: string;
  frontFacadeClass: string;
  sideFacadeClass: string;
  wingFacadeClass: string;
  trimClass: string;
  doorClass: string;
  canopyClass: string;
  windowDayClass: string;
  windowFrameClass: string;
  signBorderClass: string;
}

/**
 * Tüm binalar için tutarlı 2.5D izometrik sanat dili ve kontrollü vurgu renkleri:
 * - Borsa: yeşil ve turkuaz
 * - Oyuncu Ofisi: açık mavi
 * - Banka ve Hazine: mor ve altın
 * - Haber Merkezi: turuncu
 * - Şirket Merkezi: şirket rengi veya turkuaz
 * - Fabrika: gri, mavi ve sarı uyarı detayları
 * - Ar-Ge Merkezi: cam mavisi ve cyan
 * - Holding Merkezi: lacivert, beyaz ve altın
 */
function getStructurePalette(
  id: CityBuildingId,
  isUnlocked: boolean
): StructurePalette {
  if (!isUnlocked) {
    return {
      roofTopClass: 'bg-slate-300 border-slate-400',
      roofEdgeClass: 'bg-slate-400',
      frontFacadeClass: 'bg-slate-200 border-slate-400',
      sideFacadeClass: 'bg-slate-300 border-slate-400',
      wingFacadeClass: 'bg-slate-200 border-slate-400',
      trimClass: 'bg-amber-500',
      doorClass: 'bg-slate-600',
      canopyClass: 'bg-slate-500',
      windowDayClass: 'bg-slate-300 border-slate-400',
      windowFrameClass: 'border-slate-400',
      signBorderClass: 'border-slate-300',
    };
  }

  switch (id) {
    case 'BORSA':
      return {
        roofTopClass: 'bg-emerald-600 border-emerald-800',
        roofEdgeClass: 'bg-teal-800',
        frontFacadeClass: 'bg-white border-emerald-300',
        sideFacadeClass: 'bg-teal-100 border-teal-300',
        wingFacadeClass: 'bg-emerald-50 border-emerald-300',
        trimClass: 'bg-teal-400',
        doorClass: 'bg-emerald-900',
        canopyClass: 'bg-emerald-600',
        windowDayClass: 'bg-teal-50 border-emerald-300',
        windowFrameClass: 'border-teal-400',
        signBorderClass: 'border-emerald-300',
      };
    case 'OYUNCU_OFISI':
      return {
        roofTopClass: 'bg-sky-500 border-sky-700',
        roofEdgeClass: 'bg-sky-800',
        frontFacadeClass: 'bg-white border-sky-300',
        sideFacadeClass: 'bg-sky-100 border-sky-300',
        wingFacadeClass: 'bg-sky-50 border-sky-300',
        trimClass: 'bg-sky-400',
        doorClass: 'bg-sky-900',
        canopyClass: 'bg-sky-600',
        windowDayClass: 'bg-sky-50 border-sky-300',
        windowFrameClass: 'border-sky-300',
        signBorderClass: 'border-sky-300',
      };
    case 'BANKA':
      return {
        roofTopClass: 'bg-purple-800 border-purple-950',
        roofEdgeClass: 'bg-amber-600',
        frontFacadeClass: 'bg-stone-50 border-purple-300',
        sideFacadeClass: 'bg-purple-100 border-purple-300',
        wingFacadeClass: 'bg-amber-50 border-purple-300',
        trimClass: 'bg-amber-400',
        doorClass: 'bg-amber-700',
        canopyClass: 'bg-purple-800',
        windowDayClass: 'bg-purple-50 border-amber-400',
        windowFrameClass: 'border-amber-400',
        signBorderClass: 'border-purple-300',
      };
    case 'HABER_MERKEZI':
      return {
        roofTopClass: 'bg-orange-500 border-orange-700',
        roofEdgeClass: 'bg-orange-800',
        frontFacadeClass: 'bg-white border-orange-300',
        sideFacadeClass: 'bg-orange-100 border-orange-300',
        wingFacadeClass: 'bg-orange-50 border-orange-300',
        trimClass: 'bg-amber-400',
        doorClass: 'bg-orange-900',
        canopyClass: 'bg-orange-600',
        windowDayClass: 'bg-orange-50 border-orange-300',
        windowFrameClass: 'border-orange-300',
        signBorderClass: 'border-orange-300',
      };
    case 'SIRKET_MERKEZI':
      return {
        roofTopClass: 'bg-teal-600 border-teal-800',
        roofEdgeClass: 'bg-teal-900',
        frontFacadeClass: 'bg-white border-teal-300',
        sideFacadeClass: 'bg-teal-100 border-teal-300',
        wingFacadeClass: 'bg-teal-50 border-teal-300',
        trimClass: 'bg-teal-400',
        doorClass: 'bg-teal-900',
        canopyClass: 'bg-teal-600',
        windowDayClass: 'bg-teal-50 border-teal-300',
        windowFrameClass: 'border-teal-300',
        signBorderClass: 'border-teal-300',
      };
    case 'FABRIKA':
      return {
        roofTopClass: 'bg-slate-600 border-slate-800',
        roofEdgeClass: 'bg-amber-500',
        frontFacadeClass: 'bg-slate-100 border-sky-300',
        sideFacadeClass: 'bg-slate-300 border-slate-400',
        wingFacadeClass: 'bg-slate-200 border-amber-400',
        trimClass: 'bg-amber-400',
        doorClass: 'bg-slate-800',
        canopyClass: 'bg-sky-700',
        windowDayClass: 'bg-sky-100 border-sky-400',
        windowFrameClass: 'border-slate-400',
        signBorderClass: 'border-amber-400',
      };
    case 'ARGE_MERKEZI':
      return {
        roofTopClass: 'bg-cyan-600 border-cyan-800',
        roofEdgeClass: 'bg-sky-800',
        frontFacadeClass: 'bg-cyan-50/95 border-cyan-300',
        sideFacadeClass: 'bg-sky-100 border-cyan-400',
        wingFacadeClass: 'bg-cyan-100/80 border-cyan-300',
        trimClass: 'bg-cyan-400',
        doorClass: 'bg-cyan-900',
        canopyClass: 'bg-cyan-600',
        windowDayClass: 'bg-cyan-100 border-cyan-400',
        windowFrameClass: 'border-cyan-400',
        signBorderClass: 'border-cyan-300',
      };
    case 'HOLDING_MERKEZI':
    default:
      return {
        roofTopClass: 'bg-slate-900 border-amber-400',
        roofEdgeClass: 'bg-amber-500',
        frontFacadeClass: 'bg-white border-slate-300',
        sideFacadeClass: 'bg-slate-200 border-slate-400',
        wingFacadeClass: 'bg-amber-50 border-amber-400',
        trimClass: 'bg-amber-400',
        doorClass: 'bg-slate-950',
        canopyClass: 'bg-slate-900',
        windowDayClass: 'bg-sky-50 border-amber-400/80',
        windowFrameClass: 'border-amber-400',
        signBorderClass: 'border-amber-400',
      };
  }
}

function getStatusDotClass(
  tone: IsometricBuildingNode['statusTone'],
  isActiveWorking: boolean
): string {
  switch (tone) {
    case 'emerald':
      return `bg-emerald-500 ${
        isActiveWorking ? 'motion-safe:animate-pulse' : ''
      }`;
    case 'amber':
      return `bg-amber-500 ${
        isActiveWorking ? 'motion-safe:animate-pulse' : ''
      }`;
    case 'sky':
      return 'bg-sky-500';
    case 'violet':
      return 'bg-purple-500';
    case 'rose':
      return 'bg-amber-500';
    case 'slate':
    default:
      return 'bg-slate-400';
  }
}

function getBorsaEntranceLightClass(
  color: IsometricBuildingNode['visualMeta']['borsaLightColor']
): string {
  switch (color) {
    case 'emerald':
      return 'bg-emerald-400 motion-safe:animate-ping';
    case 'sky':
      return 'bg-sky-400';
    case 'amber':
      return 'bg-amber-400';
    case 'slate':
    default:
      return 'bg-slate-400';
  }
}

function renderStructureIcon(
  id: CityBuildingId,
  isUnlocked: boolean,
  hasCompany: boolean
) {
  if (!isUnlocked) {
    return <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />;
  }
  switch (id) {
    case 'BORSA':
      return <TrendingUp className="w-3.5 h-3.5 text-emerald-700 shrink-0" />;
    case 'BANKA':
      return <Landmark className="w-3.5 h-3.5 text-purple-800 shrink-0" />;
    case 'HABER_MERKEZI':
      return <Radio className="w-3.5 h-3.5 text-orange-600 shrink-0" />;
    case 'OYUNCU_OFISI':
      return <Building2 className="w-3.5 h-3.5 text-sky-700 shrink-0" />;
    case 'SIRKET_MERKEZI':
      return hasCompany ? (
        <Building2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
      ) : (
        <HardHat className="w-3.5 h-3.5 text-amber-700 shrink-0" />
      );
    case 'FABRIKA':
      return <Factory className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
    case 'ARGE_MERKEZI':
      return <FlaskConical className="w-3.5 h-3.5 text-cyan-700 shrink-0" />;
    case 'HOLDING_MERKEZI':
      return <ShieldCheck className="w-3.5 h-3.5 text-slate-900 shrink-0" />;
  }
}

/**
 * 2.5D İzometrik Bina Bileşeni.
 * - Her ana bina için 3 farklı görsel seviye (Seviye 1: Başlangıç, Seviye 2: Yan kanatlı gelişmiş, Seviye 3+: Prestij taçlı kompleks)
 * - Aktif yatırım projeleri için 3 aşamalı inşaat sahnesi (PARCEL_PREP, FOUNDATION_SCAFFOLD, NEAR_COMPLETION)
 * - Bina üzerinde en fazla 1 birincil durum göstergesi
 * - Borsa binasında kompakt durum ışığı (Yeşil=Açık, Mavi=Açılış Bekleniyor, Turuncu=Seans Sonrası, Gri=Kapalı)
 */
export const IsometricBuilding: React.FC<IsometricBuildingProps> = React.memo(
  ({
    building,
    atmosphere,
    isSelected,
    onSelectBuilding,
    activePulses = [],
    reducedShadows = false,
  }) => {
    const palette = getStructurePalette(building.id, building.isUnlocked);
    const sprite = CORE_BUILDING_SPRITES[building.id];
    const [spriteFailed, setSpriteFailed] = React.useState(false);
    const useSprite = Boolean(sprite) && !spriteFailed;
    const isEmptyCompanyPlot =
      building.id === 'SIRKET_MERKEZI' && !building.visualMeta.hasPlayerCompany;

    const spec = building.visualLevelSpec;
    const facadeHeightPx = spec.facadeHeightPx;
    const construction = building.constructionInfo;

    const hasOrderFillFlash = activePulses.some(
      (p) => p.buildingId === building.id && p.kind === 'ORDER_FILLED_PULSE'
    );
    const hasMarketOpenPulse = activePulses.some(
      (p) => p.buildingId === building.id && p.kind === 'MARKET_OPENED_PULSE'
    );
    const hasNewsPulse = activePulses.some(
      (p) => p.buildingId === building.id && p.kind === 'NEW_NEWS_PULSE'
    );
    const hasIpoCelebration = activePulses.some(
      (p) => p.kind === 'IPO_CELEBRATION_PULSE'
    );
    const hasHoldingUnlockPulse = activePulses.some(
      (p) => p.buildingId === building.id && p.kind === 'HOLDING_UNLOCK_PULSE'
    );

    return (
      <button
        type="button"
        data-testid={`city-building-${building.id}`}
        data-building-type="isometric-structure"
        data-district={building.districtId}
        data-visual-level={building.level}
        data-visual-tier={spec.tierIndex}
        data-primary-status={building.primaryStatusType}
        data-unlocked={building.isUnlocked ? 'true' : 'false'}
        data-working={building.isActiveWorking ? 'true' : 'false'}
        aria-label={building.accessibleLabel}
        onClick={(e) => {
          e.stopPropagation();
          onSelectBuilding(building.id);
        }}
        style={{
          left: `${building.x}px`,
          top: `${building.y}px`,
          width: `${
            useSprite && sprite
              ? Math.max(building.width, sprite.widthPx + 16)
              : building.width
          }px`,
          height: `${
            useSprite && sprite
              ? Math.max(building.height, getSpriteHeightPx(sprite) + 44)
              : building.height
          }px`,
          zIndex: isSelected ? 60 : building.zIndex,
        }}
        className={`group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-end p-2 rounded-3xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-500 transition-transform duration-200 cursor-pointer select-none ${
          isSelected
            ? 'scale-105 ring-3 ring-sky-400/90 bg-sky-400/10'
            : 'hover:scale-[1.03] active:scale-95'
        } ${!building.isUnlocked ? 'saturate-[0.45]' : ''}`}
      >
        {/* 1. ZEMİNE OTURAN YUMUŞAK GÖLGE (PNG sprite kendi zemin parseliyle gelir) */}
        {!useSprite && <div
          aria-hidden="true"
          data-part="ground-shadow"
          style={{
            transform: `translate3d(${atmosphere.shadowOffsetX}px, ${atmosphere.shadowOffsetY}px, 0)`,
            opacity: reducedShadows
              ? atmosphere.shadowOpacity * 0.55
              : atmosphere.shadowOpacity,
          }}
          className="absolute bottom-5 w-40 h-13 rounded-full bg-slate-950 pointer-events-none"
        />}

        {/* PİYASA AÇILIŞI VEYA EMİR GERÇEKLEŞME HALKASI (BORSA) */}
        {building.id === 'BORSA' &&
          (building.isActiveWorking || hasMarketOpenPulse || hasOrderFillFlash) && (
            <div
              aria-hidden="true"
              data-testid="borsa-working-visual"
              data-active={building.isActiveWorking ? 'true' : 'false'}
              data-order-flash={hasOrderFillFlash ? 'true' : 'false'}
              className={`absolute bottom-6 w-44 h-16 rounded-full border-2 pointer-events-none ${
                hasOrderFillFlash
                  ? 'border-amber-400 bg-amber-300/25 motion-safe:animate-ping'
                  : 'border-emerald-400/75 bg-emerald-400/10'
              }`}
            />
          )}

        {/* IPO KUTLAMA EFEKTİ */}
        {hasIpoCelebration &&
          (building.id === 'BORSA' || building.id === 'SIRKET_MERKEZI') && (
            <div
              aria-hidden="true"
              data-testid={`ipo-celebration-${building.id}`}
              className="absolute -top-3 inset-x-4 flex items-center justify-around pointer-events-none z-30"
            >
              <Sparkles className="w-4 h-4 text-amber-400 motion-safe:animate-bounce" />
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[8px] font-bold shadow-xs">
                IPO KUTLAMASI
              </span>
              <Sparkles className="w-4 h-4 text-emerald-400 motion-safe:animate-bounce" />
            </div>
          )}

        {/* AKTİF İNŞAAT / KAPASİTE GELİŞTİRME VİNÇ VE İSKELE ROZETİ (Bölüm 15) */}
        {construction && (
          <div
            data-testid={`building-construction-${building.id}`}
            data-construction-stage={construction.stage}
            className="absolute -top-1.5 right-1 z-30 flex items-center gap-1 px-2 py-0.5 rounded-xl bg-amber-400 text-slate-950 border border-slate-900 text-[9px] font-mono font-bold shadow-sm"
          >
            <HardHat className="w-3 h-3 text-slate-950 shrink-0" />
            <span>
              {construction.stage === 'PARCEL_PREP'
                ? 'Temel'
                : construction.stage === 'FOUNDATION_SCAFFOLD'
                ? 'Vinç & İskele'
                : 'Yükselen Gövde'}{' '}
              %{construction.progressPct}
            </span>
          </div>
        )}

        {/* 2. İZOMETRİK 2.5D MİMARİ GÖVDE */}
        {isEmptyCompanyPlot ? (
          /* ŞİRKET KURULMAMIŞSA: 1. Aşama İnşaat Perdesi, Güvenlik Bariyeri ve Proje Tabelası */
          <div
            aria-hidden="true"
            data-testid="company-empty-plot-visual"
            className="relative w-42 h-26 mb-1 flex flex-col items-center justify-end"
          >
            <div className="w-38 h-18 rounded-xl bg-amber-100/95 border-2 border-dashed border-amber-600 -skew-x-12 flex flex-col justify-between p-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="w-10 h-6 rounded-xs bg-teal-700/80 border border-teal-900 flex items-center justify-center text-[7px] font-mono text-white font-bold">
                  İSKELE
                </div>
                <div className="flex flex-col items-center -mt-4">
                  <div className="px-2 py-0.5 rounded bg-teal-800 text-white text-[8px] font-bold border border-white shadow-2xs flex items-center gap-1">
                    {!building.isUnlocked && <Lock className="w-2.5 h-2.5" />}
                    <span>PROJE ARSASI</span>
                  </div>
                  <div className="w-1 h-2.5 bg-slate-700" />
                </div>
              </div>
              <div
                data-part="safety-barrier"
                className="w-full h-2 rounded-xs bg-amber-400 border border-slate-900 flex items-center justify-around overflow-hidden"
              >
                <span className="w-2 h-full bg-slate-900 -skew-x-12" />
                <span className="w-2 h-full bg-slate-900 -skew-x-12" />
                <span className="w-2 h-full bg-slate-900 -skew-x-12" />
                <span className="w-2 h-full bg-slate-900 -skew-x-12" />
              </div>
            </div>
          </div>
        ) : useSprite && sprite ? (
          /* HAZIR PNG BİNA GÖRSELİ: bu bina için CSS gövde çizilmez */
          <div
            aria-hidden="true"
            data-testid={`building-sprite-${building.id}`}
            className={`relative flex flex-col items-center justify-end mb-1 pointer-events-none ${
              hasHoldingUnlockPulse ? 'motion-safe:animate-bounce' : ''
            }`}
          >
            <img
              src={sprite.src}
              alt=""
              draggable={false}
              decoding="async"
              onError={() => setSpriteFailed(true)}
              style={{
                width: `${sprite.widthPx}px`,
                height: `${getSpriteHeightPx(sprite)}px`,
              }}
              className={`block max-w-none object-contain drop-shadow-[0_10px_10px_rgba(2,6,23,0.35)] ${
                building.isUnlocked ? '' : 'opacity-60'
              }`}
            />
            {building.id === 'BORSA' && (
              <span
                data-testid="borsa-entrance-light"
                data-light-color={building.visualMeta.borsaLightColor}
                className={`hidden ${getBorsaEntranceLightClass(
                  building.visualMeta.borsaLightColor
                )}`}
              />
            )}
            {!building.isUnlocked && (
              <span
                data-testid={`locked-construction-cover-${building.id}`}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/85 border-2 border-amber-400 flex items-center justify-center"
              >
                <Lock className="w-4 h-4 text-amber-300" />
              </span>
            )}
          </div>
        ) : (
          /* GERÇEK 2.5D BİNA YAPISI (Seviye 1 / Seviye 2 Yan Kanat / Seviye 3+ Prestij Kule) */
          <div
            aria-hidden="true"
            className={`relative flex flex-col items-center justify-end mb-1 ${
              hasHoldingUnlockPulse ? 'motion-safe:animate-bounce' : ''
            }`}
          >
            {/* ÜST ÖZEL MİMARİ DETAYLAR */}
            {building.id === 'BORSA' && (
              <div
                data-testid="borsa-ticker-strip"
                className="mb-0.5 px-2 py-0.5 rounded-t-md bg-slate-900 text-[9px] font-mono font-bold text-emerald-400 border border-teal-400/70 flex items-center gap-1.5 shadow-2xs"
              >
                <span
                  data-testid="borsa-entrance-light"
                  data-light-color={building.visualMeta.borsaLightColor}
                  className={`w-2 h-2 rounded-full ${getBorsaEntranceLightClass(
                    building.visualMeta.borsaLightColor
                  )}`}
                />
                <span>
                  {building.visualMeta.borsaLightColor === 'emerald'
                    ? 'BIST AÇIK'
                    : building.visualMeta.borsaLightColor === 'sky'
                    ? 'AÇILIŞ BEKLENİYOR'
                    : building.visualMeta.borsaLightColor === 'amber'
                    ? 'SEANS SONRASI'
                    : 'KAPALI'}
                </span>
              </div>
            )}

            {building.id === 'HABER_MERKEZI' && (
              <div
                data-testid="news-antenna-visual"
                data-pulse={
                  hasNewsPulse || building.visualMeta.hasFreshNews
                    ? 'true'
                    : 'false'
                }
                className="relative flex flex-col items-center -mb-1"
              >
                {(hasNewsPulse || building.visualMeta.hasFreshNews) && (
                  <span className="absolute -top-2 w-5 h-5 rounded-full border-2 border-orange-400 motion-safe:animate-ping" />
                )}
                <div className="w-3.5 h-3.5 rounded-full bg-orange-500 border border-white shadow-2xs" />
                <div className="w-1 h-3.5 bg-slate-700" />
              </div>
            )}

            {building.id === 'FABRIKA' && (
              <div className="self-end mr-4 -mb-1 flex items-end gap-1.5">
                <div className="w-3.5 h-5 bg-slate-700 border border-slate-900 rounded-t-xs relative">
                  <div className="w-full h-1 bg-amber-400 mt-0.5" />
                  {building.isActiveWorking && (
                    <span className="absolute -top-2.5 left-0.5 w-2.5 h-2.5 rounded-full bg-slate-300/90 motion-safe:animate-pulse" />
                  )}
                </div>
                <div className="w-3 h-4 bg-slate-800 border border-slate-950 rounded-t-xs" />
                {spec.tierIndex >= 3 && (
                  <div
                    data-part="tier3-silo"
                    className="w-4 h-6 bg-amber-500 border border-slate-900 rounded-t-full"
                  />
                )}
              </div>
            )}

            {building.id === 'ARGE_MERKEZI' && (
              <div
                data-testid="arge-lab-glow"
                data-active={building.visualMeta.isRdActive ? 'true' : 'false'}
                className={`w-16 h-5 rounded-t-full border-2 -mb-1 transition-colors ${
                  building.visualMeta.isRdActive
                    ? 'bg-cyan-300/95 border-white shadow-sm motion-safe:animate-pulse'
                    : 'bg-cyan-500/75 border-cyan-200'
                }`}
              />
            )}

            {building.id === 'HOLDING_MERKEZI' && (
              <div className="flex items-end gap-1 -mb-1">
                {building.visualMeta.subsidiaryCount > 0 && (
                  <div className="px-1.5 py-0.5 rounded-t bg-amber-400 text-slate-950 font-mono font-bold text-[8px] border border-white">
                    +{building.visualMeta.subsidiaryCount} İŞTİRAK
                  </div>
                )}
                <div className="w-9 h-3.5 rounded-t bg-slate-900 border border-amber-400 flex items-center justify-center text-[8px] font-mono text-amber-300 font-bold">
                  {spec.tierIndex >= 3 ? 'HELİPAD' : 'HOLDİNG'}
                </div>
              </div>
            )}

            {/* SEVİYE 3+ PRESTİJ ÇATI TACI + SEVİYE 4-5 GÜNEŞ PANELİ / BAYRAK KULESİ */}
            {spec.hasPrestigeCrown && (
              <div className="flex flex-col items-center -mb-0.5">
                {spec.level >= 5 && (
                  <div
                    data-part="level5-flagship-spire"
                    className="w-10 h-2.5 rounded-t-full bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 border border-white shadow-2xs flex items-center justify-center text-[6px] font-mono font-extrabold text-slate-950"
                  >
                    SV.5
                  </div>
                )}
                <div
                  data-part="prestige-crown"
                  className="w-24 h-2.5 rounded-t-lg bg-amber-400/90 border-x border-t border-white shadow-2xs flex items-center justify-around px-1"
                >
                  {spec.level >= 4 && (
                    <>
                      <span className="w-4 h-1 rounded-2xs bg-sky-900/80 border border-sky-300/60" />
                      <span className="w-4 h-1 rounded-2xs bg-sky-900/80 border border-sky-300/60" />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 3. GERÇEKÇİ ÇATI KALINLIĞI VE PARAPET KATMANI */}
            <div data-part="roof" className="flex flex-col items-center">
              <div
                className={`w-38 h-5 rounded-t-xl border-2 ${palette.roofTopClass} -skew-x-12 flex items-center justify-between px-2.5 shadow-2xs`}
              >
                <div
                  className={`w-12 h-1.5 rounded-full ${palette.trimClass}`}
                />
                {building.id === 'SIRKET_MERKEZI' &&
                  building.visualMeta.companyTicker && (
                    <span className="px-1.5 py-0.2 rounded bg-white text-teal-900 font-mono font-bold text-[9px]">
                      {building.visualMeta.companyTicker}
                    </span>
                  )}
                {building.id === 'OYUNCU_OFISI' &&
                  (building.visualMeta.activeShopsCount ?? 0) > 0 && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-300 text-slate-950 font-mono font-bold text-[8px]">
                      {building.visualMeta.activeShopsCount} ŞUBE
                    </span>
                  )}
              </div>
              <div
                className={`w-38 h-1.5 ${palette.roofEdgeClass} border-x-2 border-b border-slate-900/25`}
              />
            </div>

            {/* 4. ÖN CEPHE, YAN KANAT (Sv.2+) VE BELİRGİN YAN CEPHE (2.5D Derinlikli Gövde) */}
            <div
              style={{ height: `${facadeHeightPx}px` }}
              className="relative flex items-stretch shadow-md rounded-b-xl overflow-hidden"
            >
              {/* Seviye 2+ Ek Mimari Yan Kanat */}
              {spec.hasSideWing && (
                <div
                  data-part="side-wing"
                  className={`w-5 border-y-2 border-l-2 ${palette.wingFacadeClass} flex flex-col justify-around items-center py-1.5`}
                >
                  <span className="w-2.5 h-2.5 rounded-2xs bg-sky-200/80 border border-slate-400" />
                  <span className="w-2.5 h-2.5 rounded-2xs bg-sky-200/80 border border-slate-400" />
                  {spec.level >= 4 && (
                    <span className="w-2.5 h-2.5 rounded-2xs bg-amber-200/90 border border-amber-500" />
                  )}
                </div>
              )}

              {/* Ön Cephe (Front Facade) */}
              <div
                data-part="front-facade"
                className={`w-27 border-2 ${palette.frontFacadeClass} p-1.5 flex flex-col justify-between relative`}
              >
                {/* Kilitli Yapılar İçin İnşaat Perdesi & Proje Tabelası Katmanı */}
                {!building.isUnlocked && (
                  <div
                    data-testid={`locked-construction-cover-${building.id}`}
                    className="absolute inset-0 bg-slate-800/35 flex flex-col items-center justify-between p-1 z-10"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-slate-900/90 text-amber-300 text-[8px] font-bold border border-amber-400/80 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      <span>PROJE SAHASI</span>
                    </span>
                    <div className="w-full h-2 rounded-2xs bg-amber-400 border border-slate-950 flex items-center justify-around">
                      <span className="w-1.5 h-full bg-slate-950" />
                      <span className="w-1.5 h-full bg-slate-950" />
                      <span className="w-1.5 h-full bg-slate-950" />
                    </div>
                  </div>
                )}

                {/* Aktif Yatırım Projesi İskele ve Vinç Katmanı (Bölüm 15) */}
                {construction && building.isUnlocked && (
                  <div
                    data-part="active-construction-scaffold"
                    className="absolute inset-x-0 bottom-0 h-5 bg-amber-400/85 border-t border-slate-900 flex items-center justify-between px-1.5 z-10"
                  >
                    <span className="text-[7px] font-mono font-extrabold text-slate-950">
                      İNŞAAT %{construction.progressPct}
                    </span>
                    <span className="text-[7px] font-mono font-bold text-slate-900">
                      G.{construction.estimatedCompletionDay}
                    </span>
                  </div>
                )}

                {/* Derinlikli Pencereler (Deterministik ID: window-borsa-floor-1-col-1) */}
                <div
                  data-part="windows"
                  className="grid grid-cols-2 gap-1 px-0.5"
                >
                  {building.windows.map((win) => (
                    <div
                      key={win.id}
                      data-window-id={win.id}
                      data-window-lit={win.isLit ? 'true' : 'false'}
                      className={`h-3.5 rounded-2xs border-t-2 border-l-2 border-r border-b transition-colors ${
                        win.isLit
                          ? 'bg-amber-300 border-amber-500 shadow-2xs'
                          : `${palette.windowDayClass} ${palette.windowFrameClass}`
                      }`}
                    />
                  ))}
                </div>

                {/* Banka Altın Sütunları + ATM Kabini veya Oyuncu Ofisi Esnaf Vitrin Tentesi */}
                {building.id === 'BANKA' && (
                  <div className="flex items-end justify-around px-1">
                    <span className="w-1.5 h-3.5 bg-amber-300 border border-amber-600 rounded-2xs" />
                    <span className="px-1 py-0.2 rounded-2xs bg-sky-600 text-white text-[6px] font-mono font-bold border border-amber-300">
                      ATM
                    </span>
                    <span className="w-1.5 h-3.5 bg-amber-300 border border-amber-600 rounded-2xs" />
                  </div>
                )}

                {building.id === 'OYUNCU_OFISI' &&
                  (building.visualMeta.activeShopsCount ?? 0) > 0 && (
                    <div className="w-full h-1.5 rounded-t-xs bg-rose-500 border border-rose-700 flex items-center justify-around overflow-hidden">
                      <span className="w-1.5 h-full bg-white/90" />
                      <span className="w-1.5 h-full bg-white/90" />
                      <span className="w-1.5 h-full bg-white/90" />
                    </div>
                  )}

                {building.id === 'FABRIKA' && (
                  <div
                    data-testid="factory-loading-bay"
                    data-producing={
                      building.visualMeta.isFactoryProducing ? 'true' : 'false'
                    }
                    className="flex flex-col items-center"
                  >
                    <div className="w-14 h-1 bg-amber-400 border border-slate-800" />
                    <div className="flex items-end gap-1">
                      <div
                        className={`w-12 h-3.5 rounded-t-xs border border-slate-700 flex items-center justify-center text-[7px] font-mono font-bold ${
                          building.visualMeta.isFactoryProducing
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-400 text-slate-900'
                        }`}
                      >
                        {building.visualMeta.isFactoryProducing
                          ? 'SEVKİYAT AÇIK'
                          : 'KAPALI'}
                      </div>
                      <span className="w-2.5 h-2 bg-amber-600 border border-amber-900 rounded-2xs" />
                    </div>
                  </div>
                )}

                {/* Giriş Kapısı + Sundurma + Merdiven */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-1 rounded-t-xs ${palette.canopyClass}`}
                  />
                  <div
                    data-part="entrance-door"
                    className={`w-6 h-4 rounded-t-sm border border-white/70 ${palette.doorClass} flex items-center justify-center`}
                  >
                    <span
                      className={`w-1.5 h-2 rounded-full ${
                        building.isActiveWorking
                          ? 'bg-emerald-300'
                          : 'bg-white/40'
                      }`}
                    />
                  </div>
                  <div className="w-10 h-1 bg-slate-400 rounded-full" />
                </div>
              </div>

              {/* Belirgin Yan Cephe (Side Extruded Facade - 2.5D Derinlik) */}
              <div
                data-part="side-facade"
                className={`w-11 border-y-2 border-r-2 ${palette.sideFacadeClass} flex flex-col justify-around items-center py-2 relative`}
              >
                <div
                  className={`w-3.5 h-3 rounded-2xs border-t-2 border-l-2 border-r border-b ${
                    building.isUnlocked && atmosphere.windowsLitRatio > 0.3
                      ? 'bg-amber-200 border-amber-500'
                      : palette.windowDayClass
                  }`}
                />
                <div
                  className={`w-3.5 h-3 rounded-2xs border-t-2 border-l-2 border-r border-b ${palette.windowDayClass}`}
                />
                <div className="w-4 h-1 rounded-full bg-slate-500/40" />
              </div>
            </div>
          </div>
        )}

        {/* TEK BİRİNCİL DURUM ROZETİ (Bölüm 14: Bina üstünde aynı anda en fazla 1 ana durum ikonu) */}
        {building.id === 'SIRKET_MERKEZI' &&
          building.visualMeta.isCompanyCashCritical && (
            <div
              data-testid="company-critical-cash-badge"
              className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded-lg bg-amber-100 border border-amber-400 text-amber-950 text-[9px] font-bold flex items-center gap-1 shadow-xs"
            >
              <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
              <span>Kasa Kritik</span>
            </div>
          )}

        {building.primaryStatusType === 'COMPLETED_MILESTONE' &&
          !building.visualMeta.isCompanyCashCritical && (
            <div
              data-testid={`building-milestone-badge-${building.id}`}
              className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded-lg bg-emerald-100 border border-emerald-400 text-emerald-950 text-[9px] font-bold flex items-center gap-1 shadow-xs"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
              <span>Hazır</span>
            </div>
          )}

        {/* 5. YÜKSEK KONTRASTLI KOMPAKT BİNA TABELASI */}
        <div
          data-part="building-signboard"
          className={`relative z-10 px-2.5 py-1 rounded-xl bg-white/95 border ${palette.signBorderClass} shadow-sm flex items-center gap-1.5 max-w-full`}
        >
          {renderStructureIcon(
            building.id,
            building.isUnlocked,
            building.visualMeta.hasPlayerCompany
          )}

          <span className="text-[11px] font-bold text-slate-900 truncate max-w-[92px]">
            {building.shortName}
          </span>

          <span className="px-1 py-0.5 rounded bg-slate-100 text-[9px] font-mono font-bold text-slate-700 shrink-0">
            {building.isUnlocked ? `Sv.${building.level}` : '🔒'}
          </span>

          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 shrink-0">
            <span
              data-part="status-light"
              className={`w-2 h-2 rounded-full ${getStatusDotClass(
                building.statusTone,
                building.isActiveWorking
              )}`}
            />
            <span>{building.shortStatusLabel}</span>
          </span>
        </div>

        {/* 6. BİLDİRİM ROZETİ */}
        {typeof building.badgeCount === 'number' && building.badgeCount > 0 && (
          <span
            data-testid={`building-badge-${building.id}`}
            className={`absolute top-2 right-3 min-w-[20px] h-5 px-1.5 rounded-full text-white text-[10px] font-mono font-bold flex items-center justify-center shadow-sm border border-white ${
              building.id === 'HABER_MERKEZI'
                ? 'bg-orange-500'
                : 'bg-emerald-600'
            }`}
          >
            {building.badgeCount}
          </span>
        )}
      </button>
    );
  }
);
