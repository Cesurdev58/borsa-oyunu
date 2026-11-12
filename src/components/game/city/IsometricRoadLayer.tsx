/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SimulationStage } from '../../../models/simulation';
import { CityAtmosphereTheme } from './cityVisualTypes';

/** Haritanın dört kenarındaki ağaç kuşağı. Sabit sayı üreteciyle bir kez hesaplanır. */
const TREE_BELT: { x: number; y: number; r: number }[] = (() => {
  let seed = 20240607;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const trees: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 110; i++) {
    trees.push({ x: rnd() * 1600, y: rnd() * 62, r: 14 + rnd() * 10 });
    trees.push({ x: rnd() * 1600, y: 1140 + rnd() * 60, r: 14 + rnd() * 10 });
  }
  for (let i = 0; i < 46; i++) {
    trees.push({ x: rnd() * 34, y: 60 + rnd() * 1080, r: 14 + rnd() * 10 });
    trees.push({ x: 1566 + rnd() * 34, y: 60 + rnd() * 1080, r: 14 + rnd() * 10 });
  }
  return trees.sort((a, b) => a.y - b.y);
})();

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

    const roadFill = isNight ? '#2b3340' : '#4b5563';
    const industrialRoadFill = isNight ? '#2f3744' : '#454e5c';
    const roadStroke = isNight ? '#556070' : '#cbd5e1';
    const sidewalkFill = isNight ? '#5b6676' : '#d6d3cb';
    const laneMarking = isNight ? '#cbd5e1' : '#ffffff';

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
            <pattern
              id="iso-grass-texture"
              width="44"
              height="44"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="9" cy="12" r="1.6" fill={isNight ? '#3f6a4e' : '#6fa63a'} opacity="0.55" />
              <circle cx="31" cy="30" r="1.6" fill={isNight ? '#27402f' : '#b7e07a'} opacity="0.6" />
              <circle cx="38" cy="8" r="1.2" fill={isNight ? '#27402f' : '#b7e07a'} opacity="0.5" />
            </pattern>
          </defs>

          {/* Canlı çimen zemin dokusu */}
          <rect width="1600" height="1200" fill="url(#iso-grass-texture)" />

          {/* HARİTA KENARLARINDA AĞAÇ KUŞAĞI (orman) */}
          <g>
            {TREE_BELT.map((t, i) => (
              <g key={`belt-${i}`}>
                <circle cx={t.x} cy={t.y + 3} r={t.r} fill="rgba(0,0,0,0.18)" />
                <circle cx={t.x} cy={t.y} r={t.r} fill={isNight ? '#173a27' : '#2f6b2a'} />
                <circle cx={t.x - t.r * 0.25} cy={t.y - t.r * 0.28} r={t.r * 0.62} fill={isNight ? '#1f4d34' : '#4f9a3c'} />
              </g>
            ))}
          </g>

          {/* 6 BÖLGE PARSEL ZEMİN BLOKLARI (Düzenli Şehir Adaları) */}
          {/* 1. Finans Bölgesi Kuzey Adası */}
          <rect
            x="220"
            y="105"
            width="1150"
            height="245"
            rx="32"
            fill={isNight ? '#3a463f' : '#dedbd0'}
            stroke={isNight ? '#51604f' : '#f8fafc'}
            strokeWidth="4"
            opacity="0.9"
          />

          {/* 2. Ticaret Bölgesi Batı Adası */}
          <rect
            x="70"
            y="410"
            width="415"
            height="375"
            rx="28"
            fill={isNight ? '#433f3a' : '#d8cdb8'}
            stroke={isNight ? '#5b564f' : '#f8fafc'}
            strokeWidth="4"
            opacity="0.88"
          />

          {/* 3. Teknoloji & Kurumsal Kampüs Doğu Adası */}
          <rect
            x="1115"
            y="410"
            width="420"
            height="375"
            rx="28"
            fill={isNight ? '#2c4a3a' : '#a9d98f'}
            stroke={isNight ? '#456a55' : '#f8fafc'}
            strokeWidth="4"
            opacity="0.85"
          />

          {/* 4. Sanayi Bölgesi Güneybatı Adası (Geniş Lojistik Zemini) */}
          <rect
            x="75"
            y="825"
            width="545"
            height="325"
            rx="28"
            fill={isNight ? '#443f39' : '#c2b6a4'}
            stroke={isNight ? '#5f5850' : '#f8fafc'}
            strokeWidth="4"
            opacity="0.9"
          />

          {/* 5. Ar-Ge & Holding Güneydoğu Adası */}
          <rect
            x="665"
            y="825"
            width="865"
            height="325"
            rx="28"
            fill={isNight ? '#33503f' : '#c4e3a0'}
            stroke={isNight ? '#4f7059' : '#f8fafc'}
            strokeWidth="4"
            opacity="0.88"
          />

          {/* 6. Kuzeybatı & Kuzeydoğu Genişleme Parselleri */}
          <rect
            x="65"
            y="115"
            width="135"
            height="230"
            rx="22"
            fill={isNight ? '#2a4a35' : '#9fd36a'}
            stroke={isNight ? '#4f7059' : '#e7f5d0'}
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
            fill={isNight ? '#2a4a35' : '#9fd36a'}
            stroke={isNight ? '#4f7059' : '#e7f5d0'}
            strokeDasharray="8 6"
            strokeWidth="2"
            opacity="0.6"
          />

          {/* Yeşil Park ve Bahçe Parselleri */}
          <polygon
            points="800,455 965,540 800,625 635,540"
            fill={isNight ? '#2a4a35' : '#8fcd57'}
            stroke={isNight ? '#4f7059' : '#e7f5d0'}
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
            fill={isNight ? '#4a5260' : '#e7e5de'}
            stroke={roadStroke}
            strokeWidth="3"
          />
          <polygon
            points="795,470 960,580 795,690 630,580"
            fill={isNight ? '#2a4a35' : '#86c94a'}
            stroke={isNight ? '#4f7059' : '#e7f5d0'}
            strokeWidth="2"
          />
          {/* Meydan Köşegen Yaya Yolları */}
          <line
            x1="630"
            y1="580"
            x2="960"
            y2="580"
            stroke={isNight ? '#5b6676' : '#e7e5de'}
            strokeWidth="12"
          />
          <line
            x1="795"
            y1="470"
            x2="795"
            y2="690"
            stroke={isNight ? '#5b6676' : '#e7e5de'}
            strokeWidth="12"
          />
          {/* Meydan göleti */}
          <ellipse cx="795" cy="580" rx="58" ry="32" fill={isNight ? '#245068' : '#5bbcf0'} stroke="#f8fafc" strokeWidth="4" />
          <ellipse cx="785" cy="572" rx="26" ry="9" fill="rgba(255,255,255,0.35)" />
        </svg>
      </div>
    );
  }
);
