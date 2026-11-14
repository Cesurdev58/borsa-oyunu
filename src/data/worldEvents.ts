/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Olağanüstü olay şablonları. Her olayın bir "aynası" vardır (savaş ↔ barış, salgın ↔ aşı …):
 * ayna olayın borsa etkileri tam tersidir, dükkân/toptancı çarpanları 1'in öbür yanına aynı uzaklıktadır (0,8 ↔ 1,2).
 * Olaylar eşit olasılıkla seçildiği için uzun vadede hiçbir sektörü tek yöne itmez.
 * Yeni olay eklerken aynasıyla birlikte ekle: src/tests/market/worldEvents.test.ts bunu denetler.
 *
 * Borsa etkisi `sectorImpacts` (haber etkisi gibi; normal haber ±0,01–0,02) ve `WORLD_EVENT_DECAY`
 * ile günden güne söner. Dükkân etkisi `shopDemand` (müşteri çarpanı) ve `supplierPriceMult`
 * (toptancı fiyatı) `WORLD_EVENT_SHOP_DAYS` gün sürer.
 */
import type { SectorId } from '../models/market';
import type { ShopType } from '../models/trade';
import type { WorldEventKind } from '../models/worldEvents';

/** Olağanüstü olay haberlerinin sönme hızı (normal haber ~0,3; bu daha uzun sürer) */
export const WORLD_EVENT_DECAY = 0.12;
/** Dükkân ve toptancı etkisi kaç gün sürer */
export const WORLD_EVENT_SHOP_DAYS = 7;
/** İlk olay en erken bu günde çıkar */
export const WORLD_EVENT_FIRST_DAY = 12;
/** İki olay arasında en az bu kadar gün olur */
export const WORLD_EVENT_MIN_GAP_DAYS = 18;
/** Aralık dolduktan sonra her gün olay çıkma olasılığı (ortalama ~30 günde bir olay) */
export const WORLD_EVENT_DAILY_CHANCE = 1 / 12;

export interface WorldEventTemplate {
  kind: WorldEventKind;
  mirror: WorldEventKind;
  /** {A} ve {B} rastgele ülke adlarıyla doldurulur */
  title: string;
  body: string;
  needsCountries: 0 | 1 | 2;
  sectorImpacts: Partial<Record<SectorId | 'GENEL', number>>;
  shopDemand: Partial<Record<ShopType, number>>;
  supplierPriceMult: number;
}

const inv = (o: Partial<Record<string, number>>, f: (v: number) => number) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(f(v as number).toFixed(6))]));

const BASE: Array<Omit<WorldEventTemplate, 'mirror'> & { mirrorKind: WorldEventKind; mirrorTitle: string; mirrorBody: string; mirrorCountries: 0 | 1 | 2 }> = [
  {
    kind: 'WAR',
    title: '{A} ile {B} arasında savaş çıktı',
    body: 'Bölgede çatışma başladı. Savunma ve enerji hisseleri yükseliyor; taşımacılık ve tüketim zorlanıyor. Toptancılar fiyat artırdı, insanlar pahalı alışverişi erteliyor.',
    needsCountries: 2,
    sectorImpacts: { SAVUNMA: 0.03, ENERJI: 0.02, LOJISTIK: -0.02, PERAKENDE: -0.015, GENEL: -0.012 },
    shopDemand: { OTOMOBIL_GALERISI: 0.8, ELEKTRONIK_MAGAZASI: 0.88, MOBILYA_MAGAZASI: 0.88, MARKET: 1.12, MANAV: 1.05 },
    supplierPriceMult: 1.12,
    mirrorKind: 'PEACE',
    mirrorTitle: '{A} ile {B} barış anlaşması imzaladı',
    mirrorBody: 'Savaş tehlikesi geride kaldı. Taşımacılık ve tüketim canlanıyor, savunma ve enerji hisseleri geriliyor. Toptan fiyatlar düştü.',
    mirrorCountries: 2,
  },
  {
    kind: 'PANDEMIC',
    title: '{A} kaynaklı yeni salgın dünyaya yayılıyor',
    body: 'İnsanlar evde kalıyor. İlaç ve biyoteknoloji şirketleri yükseliyor; mağazalar, kafeler ve taşımacılık zorlanıyor. Market ve manava talep arttı.',
    needsCountries: 1,
    sectorImpacts: { BIYOTEKNOLOJI: 0.03, PERAKENDE: -0.02, LOJISTIK: -0.015, GENEL: -0.01 },
    shopDemand: { KAFE: 0.75, GIYIM_MAGAZASI: 0.85, OTOMOBIL_GALERISI: 0.85, MARKET: 1.15, MANAV: 1.08 },
    supplierPriceMult: 1.06,
    mirrorKind: 'VACCINE',
    mirrorTitle: 'Salgına karşı aşı onaylandı, hayat normale dönüyor',
    mirrorBody: 'Kafeler ve mağazalar yeniden doluyor, taşımacılık canlandı. Biyoteknoloji hisselerinde kâr satışı var.',
    mirrorCountries: 0,
  },
  {
    kind: 'RATE_CUT',
    title: 'Merkez Bankası sürpriz faiz indirimi yaptı',
    body: 'Kredi ucuzladı. Bankalar ve bütün borsa yükseliyor; araba, mobilya ve elektronik gibi taksitli alışverişler arttı.',
    needsCountries: 0,
    sectorImpacts: { FINANS: 0.025, GENEL: 0.012 },
    shopDemand: { OTOMOBIL_GALERISI: 1.15, MOBILYA_MAGAZASI: 1.1, ELEKTRONIK_MAGAZASI: 1.08 },
    supplierPriceMult: 1.0,
    mirrorKind: 'RATE_HIKE',
    mirrorTitle: 'Merkez Bankası sert faiz artışı yaptı',
    mirrorBody: 'Kredi pahalandı. Bankalar ve borsa geriliyor; taksitli büyük alışverişler (araba, mobilya, elektronik) azaldı.',
    mirrorCountries: 0,
  },
  {
    kind: 'CYBER_ATTACK',
    title: '{A} kaynaklı dev siber saldırı bankaları vurdu',
    body: 'Teknoloji ve banka hisseleri düşüyor, güvenlik harcamaları artacağı için savunma şirketleri yükseliyor. Elektronik alışverişi temkinli.',
    needsCountries: 1,
    sectorImpacts: { TEKNOLOJI: -0.025, FINANS: -0.012, SAVUNMA: 0.015 },
    shopDemand: { ELEKTRONIK_MAGAZASI: 0.9 },
    supplierPriceMult: 1.0,
    mirrorKind: 'TECH_BREAKTHROUGH',
    mirrorTitle: 'Yerli yapay zekâ atılımı dünya basınında',
    mirrorBody: 'Teknoloji ve bankacılık hisseleri yükseliyor; devlet kaynağı savunmadan teknolojiye kayacak. Elektroniğe ilgi arttı.',
    mirrorCountries: 0,
  },
  {
    kind: 'OIL_CRISIS',
    title: '{A} petrol boru hattını kapattı, petrol fırladı',
    body: 'Enerji ve maden hisseleri yükseliyor; taşımacılık ve perakende maliyet baskısında. Toptancılar nakliye zammı yaptı, araba satışları düştü.',
    needsCountries: 1,
    sectorImpacts: { ENERJI: 0.03, MADENCILIK: 0.01, LOJISTIK: -0.025, PERAKENDE: -0.01 },
    shopDemand: { OTOMOBIL_GALERISI: 0.85 },
    supplierPriceMult: 1.15,
    mirrorKind: 'OIL_GLUT',
    mirrorTitle: '{A} ve {B} üretimi artırdı, petrol fiyatı çöktü',
    mirrorBody: 'Nakliye ucuzladı: taşımacılık ve perakende yükseliyor, enerji ve maden hisseleri düşüyor. Toptan fiyatlar indi.',
    mirrorCountries: 2,
  },
];

export const WORLD_EVENT_TEMPLATES: WorldEventTemplate[] = BASE.flatMap((b) => [
  {
    kind: b.kind,
    mirror: b.mirrorKind,
    title: b.title,
    body: b.body,
    needsCountries: b.needsCountries,
    sectorImpacts: b.sectorImpacts,
    shopDemand: b.shopDemand,
    supplierPriceMult: b.supplierPriceMult,
  },
  {
    kind: b.mirrorKind,
    mirror: b.kind,
    title: b.mirrorTitle,
    body: b.mirrorBody,
    needsCountries: b.mirrorCountries,
    sectorImpacts: inv(b.sectorImpacts, (v) => -v),
    // Dükkân ve toptancı çarpanları eşit uzaklıkta aynalanır (0,8 ↔ 1,2): ortalaması tam 1 olur
    shopDemand: inv(b.shopDemand, (v) => 2 - v),
    supplierPriceMult: Number((2 - b.supplierPriceMult).toFixed(6)),
  },
]);

// --- Rastgele (uydurma) ülke adları ---
const HEADS = ['Var', 'Kal', 'Dor', 'Mel', 'Tes', 'Ral', 'Zen', 'Bor', 'Nal', 'Ves', 'Kor', 'Lum', 'Tor', 'Ber', 'Fal', 'Gor', 'Hal', 'Lir', 'Ost', 'Ner', 'Pel', 'Sil', 'Tam', 'Vel'];
const TAILS = ['nia', 'dis', 'ova', 'ria', 'ania', 'oria', 'eria', 'etia', 'ovia', 'ara', 'esh', 'ond', 'umar', 'eya', 'avor', 'ion'];
const PREFIXES = ['Kuzey ', 'Güney ', 'Doğu ', 'Batı ', '', '', '', '', ''];
/** Gerçek bir yere benzeyen birleşimler kullanılmaz */
const BLOCKED = new Set(['Torria', 'Hallion', 'Valeria', 'Tamara', 'Kalara']);

/** 0..1 arası sayılardan uydurma bir ülke adı üretir. */
export function makeCountryName(r1: number, r2: number, r3: number): string {
  const pick = <T,>(arr: T[], r: number) => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
  let root = pick(HEADS, r1) + pick(TAILS, r2);
  if (BLOCKED.has(root)) root = pick(HEADS, (r1 + 0.5) % 1) + 'ond';
  return pick(PREFIXES, r3) + root;
}
