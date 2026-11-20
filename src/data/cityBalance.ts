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
