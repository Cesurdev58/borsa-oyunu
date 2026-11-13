/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞİRKET KURARKEN SEKTÖR TANITIMI
 * Puanlar ölçümle belirlendi: aynı "hep büyüyen" robot her sektörde 1 Mn sermayeyle 3000 gün oynatıldı
 * (`src/tests/balance/companyBot.ts`). Denge değişirse sayıları yeniden ölçüp burayı güncelle.
 *   Büyüme hızı = 600. gündeki günlük kâr, Kâr tavanı = pazar dolunca ulaşılan günlük kâr,
 *   Rakip almak = aynı sektördeki rakiplerin devralma bedeli (ucuz = kolay).
 * Ölçüm (günlük kâr, 600. gün → tavan): Savunma 194 bin → 1,9 Mn; Biyoteknoloji 188 bin → 1,2 Mn;
 * Teknoloji 169 bin → 0,9 Mn; Finans 36 bin → 0,7 Mn; Madencilik 25 bin → 0,8 Mn; Enerji 17 bin → 0,7 Mn;
 * Perakende 15 bin → 0,5 Mn; Lojistik 8 bin → 0,4 Mn.
 */

import { SectorId } from '../models/market';

export type SectorDifficulty = 'Kolay' | 'Orta' | 'Zor';

export interface SectorGuideEntry {
  difficulty: SectorDifficulty;
  /** 1–3: ne kadar çabuk kâra geçip büyür */
  growth: 1 | 2 | 3;
  /** 1–3: pazar dolunca ulaşılan kâr */
  ceiling: 1 | 2 | 3;
  /** 1–3: rakipleri devralmak ne kadar kolay (3 = ucuz) */
  rivalEase: 1 | 2 | 3;
  pitchTR: string;
  plusTR: string;
  minusTR: string;
}

export const SECTOR_GUIDE: Record<SectorId, SectorGuideEntry> = {
  SAVUNMA: {
    difficulty: 'Kolay',
    growth: 3,
    ceiling: 3,
    rivalEase: 1,
    pitchTR: 'Uçak, radar ve savunma sistemleri üretirsin. Ürünler pahalı ve çok kârlı.',
    plusTR: 'En yüksek kâr tavanı ve hızlı büyüme.',
    minusTR: 'Fabrika büyütmek en pahalısı; rakipleri devralmak çok pahalı (yaklaşık 2 milyar).',
  },
  BIYOTEKNOLOJI: {
    difficulty: 'Kolay',
    growth: 3,
    ceiling: 3,
    rivalEase: 1,
    pitchTR: 'İlaç ve biyoteknoloji ürünleri üretirsin. Birim başına kâr yüksek.',
    plusTR: 'Hızlı büyür, kâr tavanı yüksek.',
    minusTR: 'Pazarı en küçük sektör; rakipleri pahalı ve hisseleri borsada en çok dalgalanan.',
  },
  TEKNOLOJI: {
    difficulty: 'Kolay',
    growth: 3,
    ceiling: 2,
    rivalEase: 2,
    pitchTR: 'Yazılım ve bulut hizmetleri satarsın. Başlaması en kolay sektörlerden.',
    plusTR: 'Hızlı büyür; fabrika büyütmek görece ucuz.',
    minusTR: 'Pazarı küçük, çabuk dolar; ekonomi kötüleşince sarsılır.',
  },
  FINANS: {
    difficulty: 'Orta',
    growth: 2,
    ceiling: 2,
    rivalEase: 3,
    pitchTR: 'Banka ve ödeme hizmetleri sunarsın.',
    plusTR: 'Pazarı büyük; rakipleri ucuz (yaklaşık 250 milyon), holdinge erken geçersin.',
    minusTR: 'Başta yavaş büyür; ekonomi kötüleşince en çok sarsılan sektör.',
  },
  MADENCILIK: {
    difficulty: 'Orta',
    growth: 2,
    ceiling: 2,
    rivalEase: 2,
    pitchTR: 'Nadir maden ve metal çıkarıp satarsın.',
    plusTR: 'Yavaş başlar ama sonunda iyi bir kâr tavanına çıkar.',
    minusTR: 'Fabrika pahalı; hisseleri dalgalı.',
  },
  ENERJI: {
    difficulty: 'Orta',
    growth: 1,
    ceiling: 2,
    rivalEase: 2,
    pitchTR: 'Güneş ve rüzgâr enerjisi üretip satarsın.',
    plusTR: 'Hisseleri sakin, ekonomik krizlerden az etkilenir; uzun vadede iyi kâr.',
    minusTR: 'Çok yavaş başlar, fabrika pahalı. Sabırlı oyuncu için.',
  },
  PERAKENDE: {
    difficulty: 'Zor',
    growth: 1,
    ceiling: 1,
    rivalEase: 3,
    pitchTR: 'Mağazacılık ve internetten satış yaparsın. Çok satar, az kazanırsın.',
    plusTR: 'En büyük pazar, en sakin hisseler, en ucuz fabrika; rakipleri ucuz.',
    minusTR: 'Ürün başına kâr çok düşük: yavaş büyür, kâr tavanı düşük.',
  },
  LOJISTIK: {
    difficulty: 'Zor',
    growth: 1,
    ceiling: 1,
    rivalEase: 3,
    pitchTR: 'Deniz ve hava kargo taşımacılığı yaparsın.',
    plusTR: 'Rakipleri ucuz (yaklaşık 300 milyon); holding kurmak kolay.',
    minusTR: 'En yavaş büyüyen sektör, kâr tavanı en düşük.',
  },
};

/** Ekranda gösterim sırası: kolaydan zora */
export const SECTOR_GUIDE_ORDER: SectorId[] = [
  'SAVUNMA',
  'BIYOTEKNOLOJI',
  'TEKNOLOJI',
  'FINANS',
  'MADENCILIK',
  'ENERJI',
  'PERAKENDE',
  'LOJISTIK',
];
