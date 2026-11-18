/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ZENGİNLER LİSTESİ (RichListEngine)
 * Oyuncunun tırmandığı uydurma bir "şehrin en zenginleri" listesi. Kayıt tutmaz; her an oyun durumundan
 * türetilir (tohum + gün), motorun sayı üretecine dokunmaz.
 *  - Mahalle zenginleri: küçük servetler, yılda ~%25 büyür. Oyuncunun ilk saatlerde geçeceği basamaklar.
 *  - Şirket kurucuları: borsadaki her şirketin uydurma kurucusu. Serveti = kurucu payı × şirketin borsa
 *    değeri; hisse fiyatı oynadıkça servet de oynar. Oyuncu bir şirketi devralınca kurucusu listeden çıkar.
 * Bütün kişiler ve isimler uydurmadır.
 * Yalnızca modelleri içe aktarır (döngü oluşmaz).
 */
import type { SimulationState } from '../models/simulation';

export interface RichListEntry {
  id: string;
  name: string;
  /** Kısa tanım: "Novex Bulut kurucusu", "Galerici" … */
  title: string;
  netWorth: number;
  isPlayer: boolean;
  /** Kurucuysa şirketin borsa kodu */
  ticker?: string;
}

export interface RichListModel {
  entries: RichListEntry[];
  playerRank: number;
  total: number;
  /** Bir üst sıradaki kişi (oyuncu 1. değilse) */
  nextAbove: RichListEntry | null;
}

/** Mahalle zenginleri: [ad, tanım, 1. gündeki servet] */
const LOCAL_RICH: ReadonlyArray<readonly [string, string, number]> = [
  ['Rıza Tezgâhçı', 'Pazarın en eski esnafı', 140_000],
  ['Nermin Çaycıoğlu', 'Üç çay ocağının sahibi', 220_000],
  ['Hüsnü Kantarcı', 'Toptan sebze hali', 340_000],
  ['Gülten Dikişçi', 'Terzi zinciri', 520_000],
  ['Ferit Rafçıoğlu', 'Mahalle marketleri', 800_000],
  ['Saadet Kumaşçı', 'Kumaş toptancısı', 1_250_000],
  ['Cemil Yedekparça', 'Oto yedek parça', 1_900_000],
  ['Leman Kiralıkçı', 'Kiralık daireler', 3_000_000],
  ['Orhan Vitrinli', 'Alışveriş pasajı sahibi', 4_800_000],
  ['Pakize Gemicioğlu', 'Liman lokantaları', 7_500_000],
  ['Bülent Arsacı', 'Arsa ve inşaat', 12_000_000],
  ['Meral Otelci', 'Sahil otelleri', 19_000_000],
];

/** Kurucu ad listesi (şirket sırasına göre dağıtılır). */
const FOUNDER_NAMES: readonly string[] = [
  'Tarık Bulutay',
  'Selin Kriptaş',
  'Güneş Alkanoğlu',
  'Rüzgâr Demirhan',
  'Avni Katılımcı',
  'Ece Ödemeli',
  'Doruk Genoğlu',
  'Aslı Hücreli',
  'Kaan Radarcı',
  'Mert Rokettaş',
  'Zehra Raflı',
  'Can Trendoğlu',
  'Deniz Limancı',
  'Ufuk Kargocu',
  'Lale Lityumoğlu',
  'Erol Madenci',
];

/** Yerel zenginlerin yıllık büyümesi */
const LOCAL_ANNUAL_GROWTH = 0.25;

function hash(seed: number, a: number, b: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (a + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (b + 0x165667b1), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

type RichInput = Pick<SimulationState, 'seed' | 'day' | 'stocks' | 'netWorth'>;

export function buildRichList(state: RichInput): RichListModel {
  const seed = state.seed ?? 1;
  const day = Math.max(1, state.day ?? 1);
  const out: RichListEntry[] = [];

  LOCAL_RICH.forEach(([name, title, base], i) => {
    const growth = Math.pow(1 + LOCAL_ANNUAL_GROWTH, (day - 1) / 365);
    // Haftalık küçük dalga (±%4), kişiye göre farklı
    const wobble = 1 + (hash(seed, i, Math.floor(day / 7)) - 0.5) * 0.08;
    out.push({ id: `local-${i}`, name, title, netWorth: base * growth * wobble, isPlayer: false });
  });

  state.stocks.forEach((s, i) => {
    if (s.isPlayerCompany || s.isControlledByPlayer) return; // devralındıysa listeden çıkar
    const stake = 0.28 + hash(seed, 100 + i, 0) * 0.24; // %28–52 kurucu payı
    const marketValue = s.price * (s.totalShares ?? 0);
    const shortName = s.name.split(' ')[0];
    out.push({
      id: `founder-${s.ticker}`,
      name: FOUNDER_NAMES[i % FOUNDER_NAMES.length],
      title: `${shortName} kurucusu`,
      netWorth: stake * marketValue,
      isPlayer: false,
      ticker: s.ticker,
    });
  });

  out.push({ id: 'player', name: 'Sen', title: 'Yükselen patron', netWorth: state.netWorth, isPlayer: true });
  out.sort((a, b) => b.netWorth - a.netWorth);
  const idx = out.findIndex((e) => e.isPlayer);
  return {
    entries: out,
    playerRank: idx + 1,
    total: out.length,
    nextAbove: idx > 0 ? out[idx - 1] : null,
  };
}
