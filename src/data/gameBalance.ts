/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OYUN DENGESİ: tek yerde toplanan, oynanışı doğrudan etkileyen sayılar.
 * Yalnızca sabit içerir; hiçbir motoru içe aktarmaz (döngü oluşturmaz).
 */

/**
 * İlk dükkânı açabilmek için gereken en düşük net değer (TL).
 * Oyuncu 100.000 TL ile başlar: ilk dükkân için borsada en az %20 kazanması gerekir.
 * Dükkân ekonomisi borsadan çok daha kârlı olduğu için bu kapı olmadan borsa aşaması atlanıyordu.
 * Daha kolay/zor bir başlangıç için yalnızca bu sayıyı değiştirmek yeterlidir.
 */
export const FIRST_SHOP_MIN_NET_WORTH = 120_000;

/**
 * DÜKKÂN MÜDÜRÜ
 * Müdür, dükkânı oyuncu yerine yönetir: rafları dükkân kasasından doldurur ve kasada biriken
 * fazla kârı oyuncunun cebine aktarır. Karşılığında günlük maaş alır.
 * Denge hedefi (`npm run balans`, "MÜDÜR" bölümü): müdürlü dükkân, her gün elle yönetilen dükkânın
 * kârının yaklaşık %70–85'ini kazanır. Yani müdür zahmeti alır ama elle yönetmek hâlâ biraz daha kârlıdır.
 */
export const MANAGER_MIN_SHOP_LEVEL = 2;
/** Müdürün sabit günlük maaşı = dükkân türünün çalışan maaşı × bu katsayı */
export const MANAGER_WAGE_MULTIPLIER = 0.2;
/** Müdür primi: müdürden önceki günlük kârın bu payı (yalnızca kârlı günlerde) */
export const MANAGER_PROFIT_SHARE = 0.15;
/** İşe alma ücreti = sabit günlük maaş × bu katsayı (bir kez) */
export const MANAGER_HIRE_FEE_DAYS = 30;
/** Müdür kasada en az bu kadar günlük gideri bırakır */
export const MANAGER_CASH_RESERVE_DAYS = 3;
/** Kasa, ayrılan payın bu katını geçince fazlası oyuncuya aktarılır */
export const MANAGER_SWEEP_TRIGGER_MULT = 3;

/**
 * GEÇ OYUN DENGESİ (şirket ve holding aşaması)
 * Ölçüm: `npm run balans` → "ŞİRKET" bölümü (hep en çok yatırım yapan oyuncu, 900 gün).
 * Eskiden şirket satışı yalnızca kendi kapasitesine bağlıydı: fabrikayı büyüttükçe sınırsız satılıyordu
 * ve şirket ~90 günde bir ikiye katlanıyordu. Artık her sektörün sınırlı bir pazarı var.
 */

/** Rakip (NPC) şirketlerin büyüklük katsayısı: hisse sayısı, kapasite, personel ve bilanço bu katla büyütülür.
 *  Hisse fiyatı değişmez (borsa aşaması aynı kalır), yalnızca şirketin toplam değeri ve devralma bedeli büyür. */
export const NPC_SCALE = 50;
/** Oyun başında adı bilinen rakiplerin, kendi sektör pazarındaki toplam payı */
export const RIVAL_START_SHARE = 0.45;
/** Oyuncunun pazar payı %P iken rakiplerin müşterisi P × bu oran kadar azalır */
export const RIVAL_PRESSURE = 0.5;
/** Oyuncunun boş pazardan alabileceği pay: taban + şirketin çekiciliği (fiyat, kalite, pazarlama) */
export const MARKET_REACH_BASE = 0.55;

/** Fabrika kapasite yatırımının birim maliyet katsayısı (sektörün birim kapasite maliyeti × bu sayı). Eskiden 4. */
export const CAPEX_UNIT_MULTIPLIER = 9;

/** Şirket kurumlar vergisi dilimleri (günlük vergi öncesi kâr). İlk dilim ekonomideki temel orandır (%25). */
export const CORPORATE_TAX_BRACKETS: { upToDaily: number; extraRate: number }[] = [
  { upToDaily: 150_000, extraRate: 0 },
  { upToDaily: 600_000, extraRate: 0.07 },
  { upToDaily: Infinity, extraRate: 0.15 },
];

/** Servet vergisi: her 30 günde bir, (nakit + hisse − borç) bu eşiği aşan kısmından yıllık oranın 1/12'si */
export const WEALTH_TAX_FREE_AMOUNT = 20_000_000;
export const WEALTH_TAX_ANNUAL_RATE = 0.03;
export const WEALTH_TAX_PERIOD_DAYS = 30;

/** Borsadan normal alımla bir rakibin en fazla bu yüzdesine sahip olunabilir; fazlası için devralma teklifi gerekir */
export const MARKET_BUY_MAX_OWNERSHIP_PCT = 30;

/** Şirketten "yönetici maaşı / huzur hakkı" olarak çekilebilecek günlük üst sınır: max(taban, günlük cironun payı) */
export const EXECUTIVE_PAY_DAILY_MIN = 25_000;
export const EXECUTIVE_PAY_REVENUE_SHARE = 0.03;

/** Şirketi olmayan oyuncunun bireysel kredisine eklenen faiz (yıllık). Borsa getirisiyle ucuz kredi arbitrajını önler. */
export const PERSONAL_LOAN_EXTRA_SPREAD = 0.2;

/** Aynı türden her ek dükkân, o türdeki bütün dükkânların müşterisini paylaştırır: 1 / (1 + bu sayı × (adet − 1)) */
export const SHOP_SAME_TYPE_CROWDING = 0.15;

/** Kontrol edilen (devralınan) rakibin günlük net kârından, sahiplik payı oranında oyuncuya aktarılan kısım */
export const HOLDING_PAYOUT_RATIO = 0.6;
