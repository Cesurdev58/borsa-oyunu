/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { SimulationStage } from '../../../models/simulation';
import { CityBuildingId } from '../gameTypes';
import { STATIC_CITY_DECORATIONS } from './cityLayout';
import { getUrbanBlockSprite, getSpriteHeightPx } from './buildingSprites';
import {
  CityAtmosphereTheme,
  CityDecorationNode,
  CityUrbanBlockNode,
} from './cityVisualTypes';

interface IsometricDecorationLayerProps {
  stage: SimulationStage;
  atmosphere: CityAtmosphereTheme;
  animationsActive: boolean;
  urbanBlocks?: CityUrbanBlockNode[];
  onSelectUrbanBlock?: (block: CityUrbanBlockNode) => void;
  onSelectBuilding?: (id: CityBuildingId) => void;
}

/**
 * Şehir bloklarını dolduran 22 adet 2.5D yan bina (Ticaret, Sanayi Deposu, Lojistik, Teknoloji,
 * Yaşam Konutları, Sağlık, Belediye, Genişleme Parselleri) ve çevre dekorasyonlarını (ağaçlar,
 * sokak lambaları, park bankları, duraklar, otoparklar, yaya geçitleri) çizen katman.
 */
export const IsometricDecorationLayer: React.FC<IsometricDecorationLayerProps> =
  React.memo(
    ({
      stage,
      atmosphere,
      animationsActive,
      urbanBlocks = [],
      onSelectUrbanBlock,
    }) => {
      const visibleDecorations = useMemo(
        () => STATIC_CITY_DECORATIONS.filter((d) => stage >= d.minStage),
        [stage]
      );

      const renderGroundFloorShopFeature = (block: CityUrbanBlockNode) => {
        const shopType = block.activeShopType;
        if (shopType === 'MANAV') {
          return (
            <div data-part="shop-feature-manav" className="flex flex-col items-center w-full mt-0.5">
              {/* Yeşil-Beyaz Manav Tentesi */}
              <div className="w-full h-1.5 rounded-t-xs bg-emerald-600 border border-emerald-800 flex items-center justify-around overflow-hidden">
                <span className="w-1.5 h-full bg-white/90" />
                <span className="w-1.5 h-full bg-white/90" />
                <span className="w-1.5 h-full bg-white/90" />
              </div>
              {/* Dış Meyve-Sebze Ürün Sergileme Kasaları */}
              <div className="w-full flex items-end justify-between px-0.5 pt-0.5">
                <span className="w-4 h-2.5 rounded-2xs bg-lime-500 border border-emerald-800 flex items-center justify-around p-0.2">
                  <span className="w-1 h-1 rounded-full bg-red-500" />
                  <span className="w-1 h-1 rounded-full bg-amber-300" />
                </span>
                <span className="w-3 h-3 rounded-t-2xs bg-amber-900 border border-amber-200" />
                <span className="w-4 h-2.5 rounded-2xs bg-orange-400 border border-amber-800 flex items-center justify-around p-0.2">
                  <span className="w-1 h-1 rounded-full bg-emerald-600" />
                  <span className="w-1 h-1 rounded-full bg-yellow-200" />
                </span>
              </div>
            </div>
          );
        }

        if (shopType === 'KAFE' || block.category === 'CAFE_RESTAURANT') {
          return (
            <div data-part="shop-feature-kafe" className="flex flex-col items-center w-full mt-0.5">
              {/* Sıcak Kafe Tentesi */}
              <div className="w-full h-1.5 rounded-t-xs bg-amber-600 border border-amber-900 flex items-center justify-around overflow-hidden">
                <span className="w-1.5 h-full bg-amber-100" />
                <span className="w-1.5 h-full bg-amber-100" />
                <span className="w-1.5 h-full bg-amber-100" />
              </div>
              {/* Dış Masa Alanı, Şemsiye ve Servis Bölgesi */}
              <div className="w-full flex items-end justify-between px-0.5 pt-0.5">
                <span className="w-3.5 h-2.5 rounded-full bg-rose-400 border border-white shadow-2xs" />
                <span className="w-3.5 h-3 rounded-t-2xs bg-amber-950 border border-amber-300" />
                <span className="w-3.5 h-2.5 rounded-full bg-amber-400 border border-white shadow-2xs" />
              </div>
            </div>
          );
        }

        if (shopType === 'MARKET') {
          return (
            <div data-part="shop-feature-market" className="flex flex-col items-center w-full mt-0.5">
              {/* Ürün Afiş Alanı */}
              <div className="w-full h-2 rounded-2xs bg-emerald-600 border border-emerald-800 flex items-center justify-center text-[5px] font-mono font-extrabold text-white tracking-tight">
                MARKET · İNDİRİM
              </div>
              {/* Geniş Vitrin ve Çift Kanatlı Müşteri Girişi */}
              <div className="w-full flex items-end justify-between px-0.5 pt-0.5">
                <span className="w-4 h-2.5 rounded-2xs bg-sky-200 border border-sky-500" />
                <span className="w-4 h-3 rounded-t-2xs bg-sky-900 border border-sky-300 flex items-center justify-around">
                  <span className="w-0.5 h-full bg-sky-200/70" />
                </span>
                <span className="w-4 h-2.5 rounded-2xs bg-sky-200 border border-sky-500" />
              </div>
            </div>
          );
        }

        if (shopType === 'GIYIM_MAGAZASI') {
          return (
            <div data-part="shop-feature-giyim" className="flex flex-col items-center w-full mt-0.5">
              <div className="w-full h-1.5 rounded-t-xs bg-fuchsia-700 border border-fuchsia-950" />
              {/* Geniş Moda Vitrini */}
              <div className="w-full flex items-end justify-between px-0.5 pt-0.5">
                <span className="w-4.5 h-3 rounded-2xs bg-rose-100 border border-fuchsia-400 flex items-center justify-center">
                  <span className="w-1.5 h-2 rounded-t-full bg-fuchsia-500" />
                </span>
                <span className="w-3 h-3 rounded-t-2xs bg-slate-900 border border-fuchsia-200" />
                <span className="w-4.5 h-3 rounded-2xs bg-rose-100 border border-fuchsia-400 flex items-center justify-center">
                  <span className="w-1.5 h-2 rounded-t-full bg-rose-500" />
                </span>
              </div>
            </div>
          );
        }

        if (shopType === 'ELEKTRONIK_MAGAZASI') {
          return (
            <div data-part="shop-feature-elektronik" className="flex flex-col items-center w-full mt-0.5">
              {/* Modern Cam Cephe & LED Şerit */}
              <div className="w-full h-1.5 rounded-2xs bg-slate-900 border border-cyan-400 flex items-center justify-center text-[5px] font-mono font-bold text-cyan-300">
                TEKNO CAM CEPHE
              </div>
              <div className="w-full flex items-end justify-between px-0.5 pt-0.5">
                <span className="w-4.5 h-3 rounded-2xs bg-cyan-200/90 border border-cyan-500" />
                <span className="w-3 h-3 rounded-t-2xs bg-slate-950 border border-cyan-400" />
                <span className="w-4.5 h-3 rounded-2xs bg-cyan-200/90 border border-cyan-500" />
              </div>
            </div>
          );
        }

        if (shopType === 'MOBILYA_MAGAZASI') {
          return (
            <div data-part="shop-feature-mobilya" className="flex flex-col items-center w-full mt-0.5">
              <div className="w-full h-1.5 rounded-t-xs bg-amber-800 border border-amber-950" />
              {/* Büyük Mobilya Teşhir Alanı */}
              <div className="w-full flex items-end justify-between px-0.5 pt-0.5">
                <span className="w-8 h-3 rounded-2xs bg-amber-100 border border-amber-600 flex items-center justify-around px-0.5">
                  <span className="w-2.5 h-1.5 rounded-2xs bg-amber-700" />
                  <span className="w-2 h-1.5 rounded-2xs bg-emerald-700" />
                </span>
                <span className="w-3.5 h-3 rounded-t-2xs bg-amber-950 border border-amber-400" />
              </div>
            </div>
          );
        }

        if (shopType === 'OTOMOBIL_GALERISI') {
          return (
            <div data-part="shop-feature-galeri" className="flex flex-col items-center w-full mt-0.5">
              <div className="w-full h-1.5 rounded-2xs bg-slate-950 border border-amber-400 flex items-center justify-center text-[5px] font-mono font-bold text-amber-300">
                OTO SHOWROOM
              </div>
              {/* Araç Sergileme Alanı */}
              <div className="w-full flex items-end justify-between px-0.5 pt-0.5">
                <span className="w-8 h-3 rounded-2xs bg-sky-100 border border-slate-500 flex items-center justify-center">
                  <span className="w-5 h-1.5 rounded-xs bg-red-600 border border-white" />
                </span>
                <span className="w-3.5 h-3 rounded-t-2xs bg-slate-900 border border-amber-300" />
              </div>
            </div>
          );
        }

        /* Varsayılan Büfe / Perakende Dükkân Vitrini */
        return (
          <div data-part="shop-feature-bufe" className="flex flex-col items-center w-full mt-0.5">
            <div className="w-full h-1.5 rounded-t-xs bg-rose-500 border border-rose-700 flex items-center justify-around overflow-hidden">
              <span className="w-1.5 h-full bg-white/90" />
              <span className="w-1.5 h-full bg-white/90" />
              <span className="w-1.5 h-full bg-white/90" />
            </div>
            <div className="w-full flex items-end justify-between px-0.5 pt-0.5">
              <span className="w-4 h-2.5 rounded-2xs bg-sky-200/90 border border-amber-500/80" />
              <span className="w-3 h-3 rounded-t-2xs bg-amber-900 border border-amber-200" />
              <span className="w-3.5 h-2 rounded-2xs bg-emerald-500/85 border border-emerald-700" />
            </div>
          </div>
        );
      };

      const [failedSprites, setFailedSprites] = useState<
        Record<string, boolean>
      >({});

      const renderUrbanBlock = (block: CityUrbanBlockNode) => {
        const blockLevel = block.level ?? 1;
        const facadeHeight = 26 + block.floors * 11 + Math.max(0, blockLevel - 1) * 5;
        const windowsLit = atmosphere.windowsLitRatio > 0.3 && block.isUnlocked;
        const isCommercialStore =
          block.category === 'COMMERCIAL_SHOP' ||
          block.category === 'CAFE_RESTAURANT' ||
          block.category === 'BOUTIQUE_HOTEL';
        const isWarehouse =
          block.category === 'WHOLESALE_DEPOT' ||
          block.category === 'WAREHOUSE_LINK' ||
          block.category === 'INDUSTRIAL_WAREHOUSE';
        const isLogisticsYard = block.category === 'LOGISTICS_YARD';
        const isTradeCenter = block.category === 'TRADE_CENTER';
        const sprite = failedSprites[block.id]
          ? undefined
          : getUrbanBlockSprite(block.id, block.activeShopType);

        if (sprite) {
          const spriteHeight = getSpriteHeightPx(sprite);
          return (
            <button
              key={block.id}
              type="button"
              data-testid={`city-urban-block-${block.id}`}
              data-district={block.districtId}
              data-category={block.category}
              data-unlocked={block.isUnlocked ? 'true' : 'false'}
              data-status-classification={block.statusClassification || 'ACTIVE'}
              data-visual-level={blockLevel}
              data-shop-type={block.activeShopType || 'NONE'}
              data-sprite="true"
              title={block.statusSummaryTR || `${block.nameTR} (${block.shortTagTR})`}
              aria-label={`${block.nameTR} (${block.shortTagTR})`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectUrbanBlock) {
                  onSelectUrbanBlock(block);
                }
              }}
              style={{
                left: `${block.x}px`,
                top: `${block.y}px`,
                width: `${sprite.widthPx + 8}px`,
                height: `${spriteHeight + 22}px`,
                zIndex: block.zIndex,
              }}
              className={`group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-end rounded-2xl pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-105 ${
                !block.isUnlocked ? 'opacity-70 saturate-50' : ''
              }`}
            >
              {block.isUnlocked && (block.pendingDeliveryCount ?? 0) > 0 && (
                <div
                  data-testid={`block-delivery-badge-${block.id}`}
                  className="absolute top-0 px-1.5 py-0.2 rounded-full bg-sky-600 text-white text-[7px] font-mono font-bold border border-white shadow-2xs z-20"
                >
                  Sevkiyat ({block.pendingDeliveryCount})
                </div>
              )}
              {block.isUnlocked &&
                (block.pendingDeliveryCount ?? 0) === 0 &&
                block.stockWarning && (
                  <div
                    data-testid={`block-stock-warning-${block.id}`}
                    className="absolute top-0 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[7px] font-mono font-bold border border-white shadow-2xs z-20"
                  >
                    Stok Kritik
                  </div>
                )}
              <img
                src={sprite.src}
                alt=""
                aria-hidden="true"
                draggable={false}
                decoding="async"
                onError={() =>
                  setFailedSprites((prev) => ({ ...prev, [block.id]: true }))
                }
                style={{
                  width: `${sprite.widthPx}px`,
                  height: `${spriteHeight}px`,
                }}
                className="block max-w-none object-contain pointer-events-none drop-shadow-[0_6px_6px_rgba(2,6,23,0.3)]"
              />
              <span className="-mt-1 px-1.5 py-0.2 rounded-md bg-white/95 border border-slate-200/90 text-[8px] font-bold text-slate-800 truncate max-w-[112px] shadow-2xs flex items-center gap-1 relative z-10">
                {!block.isUnlocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                {block.activeShopId && block.hasStockToSell && (
                  <span
                    data-testid={`shop-active-sales-indicator-${block.id}`}
                    className="text-[7px] font-mono font-extrabold text-emerald-700 shrink-0"
                  >
                    +₺
                  </span>
                )}
                <span className="truncate">{block.shortTagTR}</span>
              </span>
            </button>
          );
        }

        return (
          <button
            key={block.id}
            type="button"
            data-testid={`city-urban-block-${block.id}`}
            data-district={block.districtId}
            data-category={block.category}
            data-unlocked={block.isUnlocked ? 'true' : 'false'}
            data-status-classification={block.statusClassification || 'ACTIVE'}
            data-visual-level={blockLevel}
            data-shop-type={block.activeShopType || 'NONE'}
            title={block.statusSummaryTR || `${block.nameTR} (${block.shortTagTR})`}
            aria-label={`${block.nameTR} (${block.shortTagTR})`}
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectUrbanBlock) {
                onSelectUrbanBlock(block);
              }
            }}
            style={{
              left: `${block.x}px`,
              top: `${block.y}px`,
              width: `${block.width}px`,
              height: `${block.height}px`,
              zIndex: block.zIndex,
            }}
            className={`group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-end p-1 rounded-2xl pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-105 ${
              !block.isUnlocked ? 'opacity-70 saturate-50' : ''
            }`}
          >
            {/* Zemine Oturan Yumuşak 3D Gölge */}
            <div
              aria-hidden="true"
              className="absolute bottom-2 w-26 h-6 rounded-full bg-slate-950/20 pointer-events-none"
            />

            {/* EKONOMİK OLAY BAĞLANTILI ÜST MİKRO ROZETLER (Sevkiyat Yolda / Stok Uyarısı) */}
            {block.isUnlocked && (block.pendingDeliveryCount ?? 0) > 0 && (
              <div
                data-testid={`block-delivery-badge-${block.id}`}
                className="mb-0.5 px-1.5 py-0.2 rounded-full bg-sky-600 text-white text-[6.5px] font-mono font-bold border border-white shadow-2xs z-20"
              >
                Sevkiyat ({block.pendingDeliveryCount})
              </div>
            )}

            {block.isUnlocked &&
              (block.pendingDeliveryCount ?? 0) === 0 &&
              block.stockWarning && (
                <div
                  data-testid={`block-stock-warning-${block.id}`}
                  className="mb-0.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[6.5px] font-mono font-bold border border-white shadow-2xs z-20"
                >
                  Stok Kritik
                </div>
              )}

            {/* Seviye 3+ Çatı Üstü Klima / Güneş Paneli / Tabela Tacı */}
            {blockLevel >= 3 && block.isUnlocked && (
              <div className="flex items-center gap-1 -mb-0.5 z-10">
                <span className="w-6 h-1.5 rounded-t-xs bg-slate-700 border border-slate-400" />
                {blockLevel >= 4 && (
                  <span className="px-1 py-0.1 rounded-t bg-amber-400 text-slate-950 font-mono font-bold text-[6px] border border-white">
                    {blockLevel >= 5 ? 'AMİRAL SV.5' : `SV.${blockLevel}`}
                  </span>
                )}
              </div>
            )}

            {/* 2.5D Şehir Bloğu Çatısı + Parapet Derinliği */}
            <div className="flex flex-col items-center">
              <div
                className={`w-24 h-3.5 rounded-t-lg border ${block.roofColorClass} -skew-x-12 flex items-center justify-between px-1.5 shadow-2xs`}
              >
                <span
                  className={`w-7 h-1 rounded-full ${block.accentColorClass}`}
                />
                {!block.isUnlocked ? (
                  <Lock className="w-2.5 h-2.5 text-amber-200" />
                ) : block.activeShopId ? (
                  <span className="px-1 rounded bg-white/90 text-slate-900 font-mono font-extrabold text-[6px]">
                    SV.{blockLevel}
                  </span>
                ) : null}
              </div>
              <div className="w-24 h-1 bg-slate-800/35 border-x border-slate-700/30" />
            </div>

            {/* 2.5D Ön Cephe + Yan Kanat (Sv.2+) + Yan Cephe */}
            <div
              style={{ height: `${facadeHeight}px` }}
              className="flex items-stretch shadow-xs rounded-b-lg overflow-hidden"
            >
              {blockLevel >= 2 && (
                <div
                  data-part="urban-side-wing"
                  className={`w-3.5 border-y border-l ${block.sideColorClass} flex flex-col justify-around items-center py-1`}
                >
                  <span className="w-1.5 h-2 rounded-2xs bg-sky-200/80 border border-slate-400/60" />
                  {blockLevel >= 4 && (
                    <span className="w-1.5 h-2 rounded-2xs bg-amber-200/90 border border-amber-500/70" />
                  )}
                </div>
              )}

              <div
                className={`w-16 border ${block.frontColorClass} p-1 flex flex-col justify-between relative`}
              >
                {/* Üst Kat Pencereleri */}
                <div className="grid grid-cols-2 gap-0.5">
                  {Array.from({ length: block.floors * 2 }).map((_, i) => (
                    <span
                      key={`${block.id}-win-${i}`}
                      className={`h-2 rounded-2xs border ${
                        windowsLit && i % 2 === 0
                          ? 'bg-amber-300 border-amber-500'
                          : 'bg-sky-100/90 border-slate-300'
                      }`}
                    />
                  ))}
                </div>

                {/* Zemin Kat Mimari İşlev Detayı (Bölüm 8 & 9) */}
                {isCommercialStore ? (
                  renderGroundFloorShopFeature(block)
                ) : isWarehouse ? (
                  /* Depoda Yükleme Kapısı, Palet ve Kamyon Alanı */
                  <div data-part="warehouse-loading-dock" className="flex flex-col items-center w-full mt-0.5">
                    <div className="w-13 h-1 bg-amber-400 border border-slate-800" />
                    <div className="w-full flex items-end justify-between px-0.5 pt-0.5">
                      <span className="w-3 h-2 bg-amber-600 border border-amber-900 rounded-2xs" title="Palet Alanı" />
                      <span className="w-6 h-3.5 rounded-t-2xs bg-slate-700 border border-slate-900 flex flex-col justify-around p-0.5">
                        <span className="w-full h-0.5 bg-slate-300" />
                        <span className="w-full h-0.5 bg-slate-300" />
                      </span>
                      <span className="w-3 h-2.5 bg-sky-700 border border-slate-900 rounded-2xs" title="Kamyon Rampası" />
                    </div>
                  </div>
                ) : isLogisticsYard ? (
                  /* Lojistik Merkezinde Sevkiyat Noktaları ve Araç Parkı */
                  <div data-part="logistics-yard-bays" className="flex flex-col items-center w-full mt-0.5">
                    <div className="w-full h-1.5 rounded-2xs bg-amber-500 border border-amber-800 flex items-center justify-center text-[5px] font-mono font-extrabold text-slate-950">
                      LOJİSTİK FİLO
                    </div>
                    <div className="w-full flex items-end justify-around pt-0.5">
                      <span className="w-4 h-2.5 rounded-2xs bg-indigo-600 border border-white" />
                      <span className="w-4 h-2.5 rounded-2xs bg-amber-600 border border-white" />
                      <span className="w-4 h-2.5 rounded-2xs bg-emerald-600 border border-white" />
                    </div>
                  </div>
                ) : isTradeCenter ? (
                  <div className="flex flex-col items-center w-full mt-0.5">
                    <div className="w-12 h-1 rounded-t-xs bg-sky-600" />
                    <div className="w-8 h-3 rounded-t-2xs bg-sky-900 border border-sky-300 flex items-center justify-center">
                      <span className="w-2 h-2 bg-cyan-300 rounded-2xs" />
                    </div>
                  </div>
                ) : (
                  <div className="w-4 h-2.5 mx-auto rounded-t-2xs bg-slate-700" />
                )}
              </div>

              {/* 3D Yan Cephe Derinliği */}
              <div
                className={`w-6 border-y border-r ${block.sideColorClass} flex flex-col justify-around items-center py-1`}
              >
                <span className="w-2 h-2 rounded-2xs bg-slate-400/45 border border-slate-500/30" />
                <span className="w-2 h-2 rounded-2xs bg-slate-400/45 border border-slate-500/30" />
              </div>
            </div>

            {/* Kompakt Yapı Etiketi + Müşteri/Satış Hareketi Göstergesi (Yalnızca açık ve stoğu olan dükkânda!) */}
            <span className="mt-0.5 px-1.5 py-0.2 rounded-md bg-white/95 border border-slate-200/90 text-[8px] font-bold text-slate-800 truncate max-w-[112px] shadow-2xs flex items-center gap-1">
              {block.activeShopId && block.hasStockToSell && (
                <span
                  data-testid={`shop-active-sales-indicator-${block.id}`}
                  className="text-[7px] font-mono font-extrabold text-emerald-700 shrink-0"
                >
                  +₺
                </span>
              )}
              <span className="truncate">{block.shortTagTR}</span>
            </span>
          </button>
        );
      };

      const renderDecoration = (node: CityDecorationNode) => {
        switch (node.kind) {
          case 'PLAZA_FOUNTAIN':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="w-22 h-13 rounded-full bg-sky-200/90 border-4 border-slate-300 shadow-xs flex items-center justify-center relative">
                  <div
                    className={`w-13 h-8 rounded-full bg-sky-400/80 border border-sky-100 flex items-center justify-center ${
                      animationsActive ? 'motion-safe:animate-pulse' : ''
                    }`}
                  >
                    <div className="w-4 h-5 rounded-t-full bg-amber-400 border-2 border-amber-200 shadow-2xs -mt-1.5" />
                  </div>
                </div>
                <span className="mt-1 px-2 py-0.5 rounded-full bg-white/90 text-[9px] font-bold text-slate-700 border border-slate-200/90 shadow-2xs">
                  Finans Meydanı
                </span>
              </div>
            );

          case 'TREE':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-emerald-600 shadow-2xs relative">
                  <div className="w-3 h-3 rounded-full bg-emerald-300/75 absolute top-0.5 left-1" />
                </div>
                <div className="w-2 h-2.5 bg-amber-800 -mt-0.5 rounded-xs" />
                <div className="w-6 h-2 rounded-full bg-slate-900/15 -mt-0.5" />
              </div>
            );

          case 'PINE_TREE':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent border-b-teal-600" />
                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-b-[18px] border-l-transparent border-r-transparent border-b-teal-700 -mt-2" />
                <div className="w-2 h-2.5 bg-amber-900" />
                <div className="w-6 h-1.5 rounded-full bg-slate-900/15" />
              </div>
            );

          case 'BUSH':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-end gap-0.5 pointer-events-none"
              >
                <div className="w-4 h-3 rounded-full bg-emerald-500 border border-emerald-700" />
                <div className="w-5 h-3.5 rounded-full bg-emerald-600 border border-emerald-800 -ml-1.5" />
              </div>
            );

          case 'FLOWER_BED':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-4 rounded-full bg-emerald-600/90 border-2 border-stone-300 flex items-center justify-around px-1 shadow-2xs pointer-events-none"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                <span className="w-1.5 h-1.5 rounded-full bg-sky-300" />
              </div>
            );

          case 'CROSSWALK':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 px-1 py-0.5 opacity-80 pointer-events-none"
              >
                <span className="w-2.5 h-1 rounded-2xs bg-white/90" />
                <span className="w-2.5 h-1 rounded-2xs bg-white/90" />
                <span className="w-2.5 h-1 rounded-2xs bg-white/90" />
                <span className="w-2.5 h-1 rounded-2xs bg-white/90" />
              </div>
            );

          case 'STREET_LAMP':
            return (
              <div
                key={node.id}
                data-testid={`street-lamp-${node.id}`}
                data-lit={atmosphere.streetLightsOn ? 'true' : 'false'}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="relative flex items-center justify-center">
                  {atmosphere.streetLightsOn && (
                    <div className="absolute w-10 h-10 rounded-full bg-amber-300/35 pointer-events-none" />
                  )}
                  <div
                    className={`w-3 h-2 rounded-t-full border ${
                      atmosphere.streetLightsOn
                        ? 'bg-amber-300 border-amber-400'
                        : 'bg-slate-400 border-slate-500'
                    }`}
                  />
                </div>
                <div className="w-1 h-6 bg-slate-600" />
                <div className="w-3 h-1 rounded-full bg-slate-700" />
              </div>
            );

          case 'PARK_BENCH':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="w-7 h-2.5 rounded-xs bg-amber-700 border border-amber-900 shadow-2xs" />
                <div className="w-6 flex justify-between px-0.5">
                  <span className="w-1 h-1.5 bg-slate-700" />
                  <span className="w-1 h-1.5 bg-slate-700" />
                </div>
              </div>
            );

          case 'BUS_STOP':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="w-11 h-5 rounded-t-md bg-sky-600/90 border border-white/80 flex items-center justify-center text-[7px] font-bold text-white shadow-2xs">
                  DURAK
                </div>
                <div className="w-10 h-3 bg-sky-100/80 border-x border-b border-sky-300 flex items-center justify-around">
                  <span className="w-3 h-1 bg-slate-400 rounded-xs" />
                </div>
              </div>
            );

          case 'TAXI_STAND':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[7px] font-bold border border-amber-600 shadow-2xs">
                  TAKSİ
                </div>
                <div className="w-0.5 h-3.5 bg-slate-700" />
              </div>
            );

          case 'CAFE_KIOSK':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="w-12 h-3 rounded-t-md bg-rose-500 border border-white flex items-center justify-around overflow-hidden">
                  <span className="w-2 h-full bg-white/85" />
                  <span className="w-2 h-full bg-white/85" />
                </div>
                <div className="w-10 h-5 bg-amber-50 border border-amber-300 rounded-b-sm flex items-center justify-center text-[7px] font-bold text-amber-900">
                  KAFE
                </div>
              </div>
            );

          case 'DIRECTION_SIGN':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="px-1.5 py-0.5 rounded bg-sky-700 text-white text-[8px] font-bold border border-white/80 whitespace-nowrap shadow-2xs">
                  {node.label || 'Merkez'}
                </div>
                <div className="w-1 h-3.5 bg-slate-500" />
              </div>
            );

          case 'PARKING_LOT':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-10 rounded-md bg-slate-300/90 border border-slate-400 p-1 flex items-center justify-around -skew-x-12 pointer-events-none"
              >
                <div className="w-4 h-6 border border-dashed border-white/80 rounded-xs flex items-center justify-center">
                  <div className="w-3 h-4 rounded-xs bg-sky-600" />
                </div>
                <div className="w-4 h-6 border border-dashed border-white/80 rounded-xs flex items-center justify-center">
                  {stage >= SimulationStage.STAGE_2_ENTREPRENEUR && (
                    <div className="w-3 h-4 rounded-xs bg-emerald-600" />
                  )}
                </div>
              </div>
            );

          case 'STAGE3_FLAG':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="px-1.5 py-0.5 rounded-r bg-emerald-600 text-white text-[8px] font-bold border border-emerald-300">
                  {node.label}
                </div>
                <div className="w-0.5 h-5 bg-slate-600 self-start" />
              </div>
            );

          case 'STAGE4_MONUMENT':
            return (
              <div
                key={node.id}
                data-testid={`city-decoration-${node.id}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
              >
                <div className="w-5 h-5 rotate-45 bg-indigo-900 border-2 border-amber-400 shadow-xs" />
                <div className="w-7 h-3 bg-slate-700 rounded-xs -mt-1 border border-slate-500" />
              </div>
            );
        }
      };

      return (
        <div
          aria-hidden="true"
          data-testid="isometric-decoration-layer"
          data-decoration-count={visibleDecorations.length}
          data-urban-block-count={urbanBlocks.length}
          className="absolute inset-0 pointer-events-none select-none"
        >
          {urbanBlocks.map(renderUrbanBlock)}
          {visibleDecorations.map(renderDecoration)}
        </div>
      );
    }
  );
