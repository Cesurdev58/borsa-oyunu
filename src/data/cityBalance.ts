/**
 * Şehir sistemi denge ve ayar sabitleri (Türkiye haritası geçişi).
 * Şehirle ilgili sayısal sabitler yalnızca burada durur; arayüz ve motor buradan okur.
 */
import type { CityEconomicProfile, CityId } from '../models/cities';

/** Çarpan alt/üst sınırları. Faz 8'de tüm şehir çarpanları bu aralığa sıkıştırılır (`clampCityMultiplier`). */
export const CITY_MULTIPLIER_MIN = 0.5;
export const CITY_MULTIPLIER_MAX = 2.0;

/** Sektör/dükkân türü bonuslarının sınırları (0,10 = +%10). */
export const CITY_BONUS_MIN = -0.25;
export const CITY_BONUS_MAX = 0.35;

/**
 * Elle ayarlanmamış 69 ilin dengeli varsayılan profili: hiçbir çarpan ülke ortalamasından sapmaz.
 * Bu "gelecekte açılacak" bir kilit değildir; il tıklanabilir ve normal şehir gibi davranır.
 */
export const DEFAULT_CITY_PROFILE: CityEconomicProfile = {
  demandMultiplier: 1,
  rentMultiplier: 1,
  wageMultiplier: 1,
  logisticsMultiplier: 1,
  competitionMultiplier: 1,
  purchasingPowerMultiplier: 1,
};

export const DEFAULT_CITY_PLAY_STYLE_TR =
  'Dengeli ve öngörülebilir bir pazar; hız yerine istikrar arayanlara göre.';
export const DEFAULT_CITY_ADVANTAGES_TR: readonly string[] = [
  'Maliyetler ülke ortalamasında',
  'Rekabet seviyesi ortalama',
];
export const DEFAULT_CITY_DISADVANTAGES_TR: readonly string[] = [
  'Belirgin bir yerel avantajı yok',
  'Sektör ve mağaza türü bonusu yok',
];

/**
 * Harita sahnesi: genişlik 1000 birim, yükseklik coğrafi oranla hesaplanır.
 * `mapPosition` değerleri enlem/boylamdan bu sabitlerle türetilir; Faz 3'te seçilen SVG
 * varlığı bu sınırlara göre kalibre edilir (kalibrasyon yalnızca bu sabitleri değiştirir).
 */
export const MAP_WIDTH = 1000;
export const MAP_LONGITUDE_MIN = 25.5;
export const MAP_LONGITUDE_MAX = 44.9;
export const MAP_LATITUDE_MIN = 35.6;
export const MAP_LATITUDE_MAX = 42.3;
/** Türkiye enleminde (~39°) boylam derecesinin enlem derecesine oranı (cos 39° ≈ 0,777). */
export const MAP_LONGITUDE_SQUEEZE = 0.777;

/** Merkez şehir seçilmeden önce zorunlu bir geri dönüş gerekirse kullanılacak şehir (Faz 2: seçim tercih edilir). */
export const CITY_FALLBACK_ID: CityId = 'ankara';

/** Şehir geçişi (migration) sürümü; migration mantığı değişirse artırılır. */
export const CITY_MIGRATION_VERSION = 1;

/** Eski kaydın migration öncesi yedeği için localStorage anahtarı. */
export const CITY_MIGRATION_BACKUP_KEY =
  'borsa_holding_simulator_save_pre_city_migration_backup';

/** Dengeli ilk 12 şehir sayısı (city-audit ve testler için). */
export const DETAILED_CITY_COUNT = 12;

// ---------------------------------------------------------------------------
// FAZ 7–9: ŞEHİR EKONOMİSİ, AÇILIŞ MALİYETİ VE LOJİSTİK
// ---------------------------------------------------------------------------

/**
 * Oyunun bütün eski dengesi (dükkân geri dönüş süreleri, kariyer hızı) ANKARA'da ölçüldü.
 * Bu yüzden şehir çarpanları Ankara'ya oranlanır: Ankara'da kira/ücret/talep çarpanı tam 1,0 olur,
 * diğer şehirler Ankara'dan ne kadar farklıysa o kadar farklı davranır (İstanbul pahalı, Konya ucuz…).
 */
export const CITY_REFERENCE_ID: CityId = 'ankara';

/** Rekabetin müşteri sayısına etkisi: talep ÷ rekabet^bu. (0 = rekabet etkisiz, 1 = tam etkili) */
export const CITY_COMPETITION_EXPONENT = 0.5;
/** Satın alma gücünün sepet tutarına etkisi: sepet × güç^bu. */
export const CITY_PURCHASING_POWER_EXPONENT = 0.5;
/** Perakende sektör bonusu bütün kişisel dükkânlara bu oranda yansır. */
export const CITY_RETAIL_BONUS_SHARE = 1;

/** Mevsimsellik: şehir başına genlik (0,25 = ±%25). Yıl 365 oyun günüdür, tepe noktası yaz ortası. */
export const CITY_SEASON_DAYS = 365;
export const CITY_SEASON_PEAK_DAY = 200;
export const CITY_SEASON_AMPLITUDE: Readonly<Partial<Record<CityId, number>>> = {
  antalya: 0.25,
  mugla: 0.2,
  trabzon: 0.08,
  izmir: 0.06,
};
/** Mevsimin kafe ve giyim dükkânlarına etkisi daha güçlüdür (turizm). */
export const CITY_SEASON_SHOP_WEIGHT: Readonly<Partial<Record<string, number>>> = {
  KAFE: 1.5,
  GIYIM_MAGAZASI: 1.25,
};

/** Komşu bölgeler (karayolu ile bitişik). Simetriktir. */
export const REGION_NEIGHBORS: Readonly<Record<string, readonly string[]>> = {
  MARMARA: ['EGE', 'KARADENIZ', 'IC_ANADOLU'],
  EGE: ['MARMARA', 'AKDENIZ', 'IC_ANADOLU'],
  AKDENIZ: ['EGE', 'IC_ANADOLU', 'GUNEYDOGU_ANADOLU', 'DOGU_ANADOLU'],
  IC_ANADOLU: ['MARMARA', 'EGE', 'AKDENIZ', 'KARADENIZ', 'DOGU_ANADOLU', 'GUNEYDOGU_ANADOLU'],
  KARADENIZ: ['MARMARA', 'IC_ANADOLU', 'DOGU_ANADOLU'],
  DOGU_ANADOLU: ['KARADENIZ', 'IC_ANADOLU', 'AKDENIZ', 'GUNEYDOGU_ANADOLU'],
  GUNEYDOGU_ANADOLU: ['AKDENIZ', 'IC_ANADOLU', 'DOGU_ANADOLU'],
};

/** Mesafe çarpanları (aynı şehir / aynı bölge / komşu bölge / uzak bölge). */
export const DISTANCE_FACTOR_SAME_CITY = 1.0;
export const DISTANCE_FACTOR_SAME_REGION = 1.1;
export const DISTANCE_FACTOR_NEIGHBOR_REGION = 1.25;
export const DISTANCE_FACTOR_FAR_REGION = 1.5;

/** Lojistik indirimleri (toplanır, en çok LOGISTICS_DISCOUNT_CAP; her rota için YALNIZCA BİR KEZ uygulanır). */
export const LOGISTICS_PORT_DISCOUNT = 0.15;
export const LOGISTICS_DEPOT_DISCOUNT = 0.2;
export const LOGISTICS_HIGHWAY_DISCOUNT = 0.1;
export const LOGISTICS_DISCOUNT_CAP = 0.35;

/** Limanı olan iller (liman indirimi). */
export const PORT_CITY_IDS: ReadonlySet<string> = new Set([
  'istanbul', 'izmir', 'mersin', 'samsun', 'trabzon', 'antalya', 'kocaeli', 'hatay', 'tekirdag',
  'zonguldak', 'ordu', 'rize', 'giresun', 'sinop', 'canakkale', 'mugla', 'balikesir', 'yalova', 'bartin', 'aydin',
]);

/**
 * Şehir depo kurma bedeli ve kapasitesi.
 * Bedel ölçüldü (Faz 3.2, 35 gün, merkez Ankara): uzak şehirde 2 dükkân (manav + market, Samsun/İzmir)
 * ayda ~10–11 bin ₺, galeri + market (Diyarbakır) ~27 bin ₺ nakliye tasarrufu. Eski 450 bin ₺ ile depo
 * kendini 500–1.270 günde çıkarıyordu (hiç değmezdi); 60 bin ₺ ile 2 dükkânda ~70–170 gün (belediye
 * projeleriyle aynı aralık), tek küçük dükkânda daha uzun. Arayüz gerçek geri dönüş süresini gösterir.
 */
export const CITY_DEPOT_COST = 60_000;
export const CITY_DEPOT_CAPACITY_UNITS = 4000;

/** Açılış teklifi bileşenleri. */
export const OPENING_RENT_DEPOSIT_DAYS = 3; // şehirdeki günlük kira × gün = peşin kira depozitosu
export const OPENING_PERMIT_RATE = 0.12; // ruhsat: kurulum × oran × (mesafe çarpanı−1)/0,5
export const OPENING_LOGISTICS_SETUP_RATE = 0.15; // hat kurulumu: ilk stok × oran × (lojistik çarpanı−1), alt sınır 0
export const OPENING_RESERVE_DAYS = 7; // önerilen güvenlik rezervi: günlük sabit gider × gün
export const PRESTIGE_OPENING_DISCOUNT = 0.2; // ilk dükkânda, yıldızı olan oyuncuya
export const MILESTONE_OPENING_DISCOUNT = 0.1; // sonraki uygun dükkânda, kilometre taşı kazanılmışsa
/** Kilometre taşı indirimi kazandıran net varlık eşikleri (her eşik bir hak). */
export const MILESTONE_NET_WORTH_THRESHOLDS: readonly number[] = [500_000, 2_000_000, 10_000_000, 50_000_000];

/** Denge hedefi: en güçlü ve en zayıf başlangıç şehrinin 10. saat net varlık farkı (yüzde, en güçlüye göre). */
export const CITY_BALANCE_TARGET_BAND: readonly [number, number] = [20, 35];
