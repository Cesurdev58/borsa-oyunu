/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OYUN DENGESİ: tek yerde toplanan, oynanışı doğrudan etkileyen sayılar.
 * Yalnızca sabit içerir; hiçbir motoru içe aktarmaz (döngü oluşturmaz).
 */

/**
 * İLK DÜKKÂN KAPISI
 * Eskiden ilk dükkân için net değerin 120.000 TL olması gerekiyordu; borsa yılda ~%80 getirdiği için
 * bu, oyunun ilk 130–180 gününü (15 dk/gün ile 32–44 gerçek saat) yalnızca beklemekle geçirtiyordu.
 * Şimdi kapı "borsayı öğren" görevleridir (engine/FirstShopGate.ts): bir hisse al, ikinci bir sektörden
 * hisse al, bir hisse sat. Üçü bitince ilk dükkân açılır (normalde ilk 3–5 gerçek dakika).
 * Bu sayı yalnızca "zaten zengin" kısayoludur: net değeri bunu geçen oyuncu (ör. testler, çok parayla
 * başlayan oyun) görevleri yapmadan da dükkân açabilir.
 */
export const FIRST_SHOP_MIN_NET_WORTH = 120_000;

/**
 * OYUN TEMPOSU (hızlı başlangıç)
 * Tycoon oyunlarında başta her şey hızlı olur, imparatorluk büyüdükçe yavaşlar.
 * Oyuncunun seçtiği gün uzunluğu (15/30/45/60 dk) üst sınırdır; kariyerin başında gün daha kısadır:
 *  - şirket kurulana kadar (borsa + dükkân dönemi): bir oyun günü en fazla TEMPO_EARLY_MINUTES gerçek dakika
 *  - şirket kurulduktan sonra, halka arza kadar: en fazla TEMPO_COMPANY_MINUTES
 *  - halka arz / holding: oyuncunun seçtiği gün uzunluğu
 * Ayarlardan "Hızlı başlangıç" kapatılırsa her zaman seçilen gün uzunluğu geçerlidir.
 * Ölçüm: `npm run kariyer` (scripts/kariyer-hizi.ts) her önemli anın kaç gerçek dakikada geldiğini yazar.
 */
export const TEMPO_EARLY_MINUTES = 2;
export const TEMPO_COMPANY_MINUTES = 5;
/** Çevrimdışı ilerleme gerçek süreyle sınırlıdır (dakika); gün sayısı gün uzunluğundan hesaplanır. */
export const OFFLINE_MAX_REAL_MINUTES = 120;
export const OFFLINE_MAX_GAME_DAYS_CAP = 60;

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
