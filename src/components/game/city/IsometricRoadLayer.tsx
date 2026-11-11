/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SimulationStage } from '../../../models/simulation';
import { CityAtmosphereTheme } from './cityVisualTypes';

interface IsometricRoadLayerProps {
  stage: SimulationStage;
  atmosphere: CityAtmosphereTheme;
}

/**
 * CitySim esinli yoğun şehir blokları, bölgelere göre farklılaşan yol genişlikleri,
 * kaldırımlar, kavşaklar, yaya geçitleri ve ufuk silüeti katmanı.
 */
export const IsometricRoadLayer: React.FC<IsometricRoadLayerProps> = React.memo(
  ({ stage, atmosphere }) => {
    const isNight = atmosphere.phase === 'NIGHT';
    const isStage2Plus = stage >= SimulationStage.STAGE_2_ENTREPRENEUR;

    const roadFill = isNight ? '#334155' : '#cbd5e1';
    const industrialRoadFill = isNight ? '#3b4252' : '#bcc6d4';
    const roadStroke = isNight ? '#475569' : '#94a3b8';
    const sidewalkFill = isNight ? '#475569' : '#e2e8f0';
    const laneMarking = isNight ? '#94a3b8' : '#f8fafc';

    return (
      <div
        aria-hidden="true"
        data-testid="isometric-road-layer"
        className="absolute inset-0 pointer-events-none select-none overflow-hidden"
      >
        <svg
          viewBox="0 0 1600 1200"
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id="iso-ground-grid"
              width="80"
              height="46"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 80 23 L 40 46 L 0 23 Z"
                fill="none"
                stroke={
                  isNight ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.045)'
                }
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* Tüm Zemin İzometrik Karo Deseni */}
          <rect width="1600" height="1200" fill="url(#iso-ground-grid)" />

          {/* UZAK UFUK SİLÜETİ (Kuzey Ufuk Çizgisi) */}
          <g opacity={isNight ? '0.38' : '0.28'}>
            <rect x="80" y="18" width="55" height="60" rx="4" fill="#64748b" />
            <rect x="145" y="30" width="42" height="48" rx="4" fill="#94a3b8" />
            <rect x="440" y="14" width="64" height="64" rx="4" fill="#64748b" />
            <rect x="512" y="26" width="48" height="52" rx="4" fill="#94a3b8" />
            <rect x="1040" y="16" width="60" height="62" rx="4" fill="#64748b" />
            <rect x="1110" y="28" width="46" height="50" rx="4" fill="#94a3b8" />
            <rect x="1410" y="20" width="58" height="58" rx="4" fill="#64748b" />
          </g>

          {/* 6 BÖLGE PARSEL ZEMİN BLOKLARI (Düzenli Şehir Adaları) */}
          {/* 1. Finans Bölgesi Kuzey Adası */}
          <rect
            x="220"
            y="105"
            width="1150"
            height="245"
            rx="32"
            fill={isNight ? '#1e293b' : '#f1f5f9'}
            stroke={isNight ? '#334155' : '#cbd5e1'}
            strokeWidth="2"
            opacity="0.82"
          />

          {/* 2. Ticaret Bölgesi Batı Adası */}
          <rect
            x="70"
            y="410"
            width="415"
            height="375"
            rx="28"
            fill={isNight ? '#1f2937' : '#fef3c7'}
            stroke={isNight ? '#374151' : '#fde68a'}
            strokeWidth="2"
            opacity="0.65"
          />

          {/* 3. Teknoloji & Kurumsal Kampüs Doğu Adası */}
          <rect
            x="1115"
            y="410"
            width="420"
            height="375"
            rx="28"
            fill={isNight ? '#172554' : '#e0f2fe'}
            stroke={isNight ? '#1e3a8a' : '#bae6fd'}
            strokeWidth="2"
            opacity="0.68"
          />

          {/* 4. Sanayi Bölgesi Güneybatı Adası (Geniş Lojistik Zemini) */}
          <rect
            x="75"
            y="825"
            width="545"
            height="325"
            rx="28"
            fill={isNight ? '#1e293b' : '#e2e8f0'}
            stroke={isNight ? '#475569' : '#cbd5e1'}
            strokeWidth="2.5"
            opacity="0.85"
          />

          {/* 5. Ar-Ge & Holding Güneydoğu Adası */}
          <rect
            x="665"
            y="825"
            width="865"
            height="325"
            rx="28"
            fill={isNight ? '#1e1b4b' : '#ecfeff'}
            stroke={isNight ? '#312e81' : '#a5f3fc'}
            strokeWidth="2"
            opacity="0.72"
          />

          {/* 6. Kuzeybatı & Kuzeydoğu Genişleme Parselleri */}
          <rect
            x="65"
            y="115"
            width="135"
            height="230"
            rx="22"
            fill={isNight ? '#1e293b' : '#dcfce7'}
            stroke={isNight ? '#334155' : '#86efac'}
            strokeDasharray="8 6"
            strokeWidth="2"
            opacity="0.6"
          />
          <rect
            x="1395"
            y="115"
            width="140"
            height="230"
            rx="22"
            fill={isNight ? '#1e293b' : '#dcfce7'}
            stroke={isNight ? '#334155' : '#86efac'}
            strokeDasharray="8 6"
            strokeWidth="2"
            opacity="0.6"
          />

          {/* Yeşil Park ve Bahçe Parselleri */}
          <polygon
            points="800,455 965,540 800,625 635,540"
            fill={isNight ? '#1e3a2f' : '#d1fae5'}
            stroke={isNight ? '#065f46' : '#a7f3d0'}
            strokeWidth="3"
          />

          {/* 1. ANA BULVAR HALKA YOLU (Finans & Yaşam Meydanı Çevresi: 510..1090 x 380..780) */}
          <rect
            x="510"
            y="380"
            width="580"
            height="400"
            rx="44"
            fill="none"
            stroke={sidewalkFill}
            strokeWidth="56"
          />
          <rect
            x="510"
            y="380"
            width="580"
            height="400"
            rx="44"
            fill="none"
            stroke={roadFill}
            strokeWidth="40"
          />
          <rect
            x="510"
            y="380"
            width="580"
            height="400"
            rx="44"
            fill="none"
            stroke={laneMarking}
            strokeWidth="2"
            strokeDasharray="14 14"
          />

          {/* 2. KUZEY FİNANS BAĞLANTI YOLLARI (Haber Merkezi, Borsa, Merkez Bankası) */}
          <line
            x1="210"
            y1="380"
            x2="1390"
            y2="380"
            stroke={sidewalkFill}
            strokeWidth="44"
            strokeLinecap="round"
          />
          <line
            x1="210"
            y1="380"
            x2="1390"
            y2="380"
            stroke={roadFill}
            strokeWidth="30"
            strokeLinecap="round"
          />
          <line
            x1="230"
            y1="380"
            x2="1370"
            y2="380"
            stroke={laneMarking}
            strokeWidth="2"
            strokeDasharray="12 12"
          />

          {/* Borsa Meydan Girişi */}
          <line
            x1="795"
            y1="250"
            x2="795"
            y2="380"
            stroke={sidewalkFill}
            strokeWidth="48"
            strokeLinecap="round"
          />
          <line
            x1="795"
            y1="250"
            x2="795"
            y2="380"
            stroke={roadFill}
            strokeWidth="32"
            strokeLinecap="round"
          />

          {/* Sol Üst Çapraz Bağlantı: Haber Merkezi -> Meydan */}
          <path
            d="M 355 320 L 535 415"
            stroke={sidewalkFill}
            strokeWidth="42"
            strokeLinecap="round"
          />
          <path
            d="M 355 320 L 535 415"
            stroke={roadFill}
            strokeWidth="28"
            strokeLinecap="round"
          />
          <path
            d="M 355 320 L 535 415"
            stroke={laneMarking}
            strokeWidth="2"
            strokeDasharray="10 10"
          />

          {/* Sağ Üst Çapraz Bağlantı: Merkez Bankası -> Meydan */}
          <path
            d="M 1240 330 L 1065 415"
            stroke={sidewalkFill}
            strokeWidth="42"
            strokeLinecap="round"
          />
          <path
            d="M 1240 330 L 1065 415"
            stroke={roadFill}
            strokeWidth="28"
            strokeLinecap="round"
          />
          <path
            d="M 1240 330 L 1065 415"
            stroke={laneMarking}
            strokeWidth="2"
            strokeDasharray="10 10"
          />

          {/* 3. BATI TİCARET SOKAK AĞI VE DOĞU TEKNOLOJİ KAMPÜS YOLU */}
          <line
            x1="215"
            y1="380"
            x2="215"
            y2="895"
            stroke={sidewalkFill}
            strokeWidth="38"
            strokeLinecap="round"
          />
          <line
            x1="215"
            y1="380"
            x2="215"
            y2="895"
            stroke={roadFill}
            strokeWidth="26"
            strokeLinecap="round"
          />
          <line
            x1="215"
            y1="395"
            x2="215"
            y2="880"
            stroke={laneMarking}
            strokeWidth="1.5"
            strokeDasharray="10 10"
          />

          <line
            x1="135"
            y1="605"
            x2="510"
            y2="605"
            stroke={sidewalkFill}
            strokeWidth="42"
            strokeLinecap="round"
          />
          <line
            x1="135"
            y1="605"
            x2="510"
            y2="605"
            stroke={roadFill}
            strokeWidth="28"
            strokeLinecap="round"
          />

          <line
            x1="1090"
            y1="595"
            x2="1465"
            y2="595"
            stroke={sidewalkFill}
            strokeWidth="42"
            strokeLinecap="round"
          />
          <line
            x1="1090"
            y1="595"
            x2="1465"
            y2="595"
            stroke={roadFill}
            strokeWidth="28"
            strokeLinecap="round"
          />

          <line
            x1="1375"
            y1="380"
            x2="1375"
            y2="895"
            stroke={sidewalkFill}
            strokeWidth="38"
            strokeLinecap="round"
          />
          <line
            x1="1375"
            y1="380"
            x2="1375"
            y2="895"
            stroke={roadFill}
            strokeWidth="26"
            strokeLinecap="round"
          />

          {/* 4. GÜNEY SANAYİ, LOJİSTİK, AR-GE VE HOLDİNG GENİŞ BULVARI */}
          <path
            d="M 145 895 L 1465 895 M 365 895 L 530 780 M 805 1100 L 805 780 M 1255 885 L 1070 780"
            stroke={sidewalkFill}
            strokeWidth="48"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={isStage2Plus ? 1 : 0.78}
          />
          <path
            d="M 145 895 L 1465 895 M 365 895 L 530 780 M 805 1100 L 805 780 M 1255 885 L 1070 780"
            stroke={industrialRoadFill}
            strokeWidth="34"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={isStage2Plus ? 1 : 0.78}
          />
          <path
            d="M 165 895 L 1445 895"
            stroke={laneMarking}
            strokeWidth="2.5"
            strokeDasharray="14 12"
            opacity={isStage2Plus ? 0.95 : 0.55}
          />

          {/* 5. MERKEZ FİNANS MEYDANI VE YAŞAM PARKI (İzometrik Elmas Meydan) */}
          <polygon
            points="795,435 1015,580 795,725 575,580"
            fill={isNight ? '#1e293b' : '#f8fafc'}
            stroke={roadStroke}
            strokeWidth="3"
          />
          <polygon
            points="795,470 960,580 795,690 630,580"
            fill={isNight ? '#0f172a' : '#ecfdf5'}
            stroke={isNight ? '#334155' : '#bbf7d0'}
            strokeWidth="2"
          />
          {/* Meydan Köşegen Yaya Yolları */}
          <line
            x1="630"
            y1="580"
            x2="960"
            y2="580"
            stroke={isNight ? '#334155' : '#e2e8f0'}
            strokeWidth="12"
          />
          <line
            x1="795"
            y1="470"
            x2="795"
            y2="690"
            stroke={isNight ? '#334155' : '#e2e8f0'}
            strokeWidth="12"
          />
        </svg>
      </div>
    );
  }
);
