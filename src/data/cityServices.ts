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
