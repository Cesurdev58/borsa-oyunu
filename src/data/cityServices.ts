/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞEHİR HİZMETLERİ (şehirdeki binaların kendi işleri)
 * Motor `engine/CityServices.ts`. Üç bina iş görür:
 *  - İkinci El Pazarı (eski "Takas" bloğu): fazla malı hızlıca zararına satmak, ucuz ama süreli ikinci el eşya almak
 *  - Belediye: mahalle projelerine katkı → bütün dükkânlara kalıcı müşteri + itibar
 *  - Trafo (enerji merkezi): dükkâna güneş paneli → günlük kira/işletme giderinin bir kısmı düşer
 * Hepsi ilk dükkân açılınca kullanılabilir. Yalnızca sabit içerir.
 */
import type { ShopType } from '../models/trade';

/** Fazla mal ikinci el pazarına alış maliyetinin bu kadarına satılır (hep zararına: kâr kapısı olmasın). */
export const SECONDHAND_SELL_RATE = 0.6;
/** İkinci el eşya, yenisinin bu kadarı fiyatına satılır */
export const USED_UPGRADE_PRICE_SHARE = 0.5;
/** İkinci el eşya bu kadar oyun günü dayanır, sonra eskiyip biter */
export const USED_UPGRADE_DAYS = 60;
/** Pazarda her gün bu kadar ikinci el eşya ilanı çıkar */
export const USED_OFFERS_PER_DAY = 3;

export interface CityProjectDef {
  id: string;
  name: string;
  /** Ürün resmi (emoji yalnızca resim olarak) */
  emoji: string;
  price: number;
  /** Bütün kişisel dükkânlara eklenen kalıcı müşteri yüzdesi */
  customersPct: number;
  /** Ticari itibara eklenen puan */
  reputation: number;
}

/**
 * Belediye projeleri: sırayla açılır (bir öncekini yapmadan sonrakine katkı verilmez).
 * Fiyatlar `npm run balans` "ŞEHİR HİZMETLERİ" bölümüyle ölçüldü (4 dükkânlı oyuncu): park ~95 gün,
 * otopark ~215 gün, aydınlatma ~310 gün (itibarı en çok o verir: şirketleşme için en az 60 gerekir). Dükkânlar müşteri tavanına (kapasite) yaklaştıkça
 * ek müşteri daha az kazandırır; dükkânı çok ve büyük olan daha hızlı çıkarır (bilinçli).
 */
export const CITY_PROJECTS: readonly CityProjectDef[] = [
  { id: 'park', name: 'Mahalle parkı', emoji: '🌳', price: 60_000, customersPct: 2, reputation: 2 },
  { id: 'otopark', name: 'Ücretsiz otopark', emoji: '🅿️', price: 150_000, customersPct: 3, reputation: 3 },
  { id: 'aydinlatma', name: 'Çarşı aydınlatması', emoji: '💡', price: 180_000, customersPct: 3, reputation: 4 },
];

/** Güneş paneli dükkânın günlük kira + işletme giderinin bu kadarını düşürür */
export const SOLAR_OPEX_CUT = 0.2;
/**
 * Güneş paneli fiyatı = günlük tasarruf × bu gün sayısı (dükkânın hedef geri dönüş süresinin ~%80'i,
 * küçük yükseltmelerle aynı ölçü).
 */
export const SOLAR_PAYBACK_DAYS: Record<ShopType, number> = {
  BUFE: 36,
  MANAV: 48,
  KAFE: 64,
  GIYIM_MAGAZASI: 80,
  ELEKTRONIK_MAGAZASI: 104,
  MOBILYA_MAGAZASI: 104,
  MARKET: 96,
  OTOMOBIL_GALERISI: 144,
};

// ---------------------------------------------------------------------------
// AKADEMİ — çalışan eğitimi
// ---------------------------------------------------------------------------

/** Bütün çalışanları eğitimli dükkânda müşteri başına harcama (sepet) bu kadar artar (eğitimli oranıyla) */
export const TRAINING_BASKET_PCT = 6;
/**
 * Eğitim fiyatı: dükkânın en az çalışan sayısının tamamını eğitmek = kurulum maliyeti (açılış + dekor) × bu pay;
 * kişi başı ücret bunun en az çalışan sayısına bölümü. Paylar `npm run balans` "AKADEMİ VE SAĞLIK" bölümüyle
 * (8 tohum) ölçülerek verildi: tam eğitim dükkânın hedef geri dönüş süresinin ~%80'inde kendini çıkarır
 * (küçük yükseltmelerle aynı ölçü).
 */
export const TRAINING_COST_SHARE: Record<ShopType, number> = {
  BUFE: 0.14,
  MANAV: 0.29,
  KAFE: 0.45,
  GIYIM_MAGAZASI: 0.16,
  ELEKTRONIK_MAGAZASI: 0.32,
  MOBILYA_MAGAZASI: 0.16,
  MARKET: 0.27,
  OTOMOBIL_GALERISI: 0.33,
};

// ---------------------------------------------------------------------------
// SAĞLIK MERKEZİ — çalışan sigortası
// ---------------------------------------------------------------------------

/** Sigortalı dükkânın çalışanları daha istekli çalışır: günlük müşteri bu kadar artar */
export const INSURANCE_CUSTOMERS_PCT = 4;
/**
 * Sigorta primi: her gün çalışan maaşlarının bu kadarı (maaşla birlikte dükkân kasasından düşer).
 * Ölçüm (8 tohum, 2. seviye): primsiz sigorta kârı türüne göre %3–9 artırıyor; %6 primle net kazanç
 * giyimde ~0, diğerlerinde günde +20…+380 ₺ (kârın %1–6'sı). Küçük ama hep artı: oyuncu karar verir.
 */
export const INSURANCE_PREMIUM_RATE = 0.06;
/** Sigortalı dükkânda bu karar kartları çıkmaz (çalışan memnun: zam istemez, rakibe gitmez) */
export const INSURANCE_BLOCKED_DECISIONS: readonly string[] = ['staff-raise', 'rival-poach'];

// ---------------------------------------------------------------------------
// LOJİSTİK — kargo anlaşması
// ---------------------------------------------------------------------------

/** Anlaşmalı dükkâna gelen siparişlerin nakliye ücreti bu kadar düşer */
export const CARGO_SHIPPING_CUT = 0.5;
/** Anlaşmalı dükkâna gelen siparişler bu kadar gün erken gelir (en az 1 gün) */
export const CARGO_DAYS_FASTER = 1;
/**
 * Kargo anlaşmasının günlük ücreti (dükkân kasasından, kira ve işletme gideriyle birlikte düşer).
 * `npm run balans` "LOJİSTİK" bölümüyle (8 tohum, 2. seviye) ölçülerek verildi: anlaşma nakliyenin yarısını ve
 * erken gelen malla raf boşluğunu kurtarır. Ücretsiz kazanç türe göre çok farklı (günde büfe ~110, manav ~730 (çabuk
 * bozulan mal), market ~840, galeri ~2.700 (pahalı mal erken gelir); giyim ve elektronikte neredeyse yok); ücret bu
 * kazancın ~%55'i. Giyimde anlaşma değmez (net ~−40), elektronikte az kazandırır: oyuncu hangi dükkâna değdiğini seçer.
 */
export const CARGO_DAILY_FEE: Record<ShopType, number> = {
  BUFE: 60,
  MANAV: 400,
  KAFE: 120,
  GIYIM_MAGAZASI: 40,
  ELEKTRONIK_MAGAZASI: 50,
  MOBILYA_MAGAZASI: 180,
  MARKET: 450,
  OTOMOBIL_GALERISI: 1450,
};
