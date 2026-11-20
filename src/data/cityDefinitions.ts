/**
 * Şehirlerin tek veri kaynağı (Türkiye haritası geçişi, Faz 1).
 * - 81 ilin hepsi tanımlıdır ve tıklanabilir/oynanabilir sayılır (kilit yok).
 * - İlk 12 şehir elle ayarlanmış (`DETAILED`) profile sahiptir; diğer 69 il dengeli varsayılan profili kullanır.
 * - Çarpanlar kesin sayılar değildir; Faz 8'de simülasyonla yeniden ayarlanır.
 * - Arayüz ve motor ekonomik katsayıyı buradan okur; başka yerde sabit yazılmaz.
 */
import type {
  CityDefinition,
  CityDifficulty,
  CityEconomicProfile,
  CityId,
  CityMapPosition,
  CityProfileKind,
  TurkeyRegion,
} from '../models/cities';
import type { SectorId } from '../models/market';
import type { ShopType } from '../models/trade';
import {
  CITY_BONUS_MAX,
  CITY_BONUS_MIN,
  CITY_MULTIPLIER_MAX,
  CITY_MULTIPLIER_MIN,
  DEFAULT_CITY_ADVANTAGES_TR,
  DEFAULT_CITY_DISADVANTAGES_TR,
  DEFAULT_CITY_PLAY_STYLE_TR,
  DEFAULT_CITY_PROFILE,
  MAP_LATITUDE_MAX,
  MAP_LATITUDE_MIN,
  MAP_LONGITUDE_MAX,
  MAP_LONGITUDE_MIN,
  MAP_LONGITUDE_SQUEEZE,
  MAP_WIDTH,
} from './cityBalance';

// ---------------------------------------------------------------------------
// Harita izdüşümü (enlem/boylam → sanal sahne)
// ---------------------------------------------------------------------------

const MAP_SCALE =
  MAP_WIDTH / ((MAP_LONGITUDE_MAX - MAP_LONGITUDE_MIN) * MAP_LONGITUDE_SQUEEZE);

/** Sanal sahnenin yüksekliği (genişlik 1000 iken). */
export const MAP_HEIGHT = Math.round(
  (MAP_LATITUDE_MAX - MAP_LATITUDE_MIN) * MAP_SCALE
);

/** Yuvarlanmamış izdüşüm: harita çizimi (kıyı çizgisi) şehir noktalarıyla aynı formülü kullanır. */
export function projectToMapPrecise(latitude: number, longitude: number): CityMapPosition {
  return {
    x: (longitude - MAP_LONGITUDE_MIN) * MAP_LONGITUDE_SQUEEZE * MAP_SCALE,
    y: (MAP_LATITUDE_MAX - latitude) * MAP_SCALE,
  };
}

export function projectToMap(latitude: number, longitude: number): CityMapPosition {
  const p = projectToMapPrecise(latitude, longitude);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

// ---------------------------------------------------------------------------
// Ham il tablosu: [ad, plaka, bölge, enlem, boylam] — anahtar kümesi CityId ile birebir eşleşmek zorundadır
// ---------------------------------------------------------------------------

type RawCity = readonly [string, number, TurkeyRegion, number, number];

const RAW_CITIES: Record<CityId, RawCity> = {
  adana: ['Adana', 1, 'AKDENIZ', 37.0, 35.32],
  adiyaman: ['Adıyaman', 2, 'GUNEYDOGU_ANADOLU', 37.76, 38.28],
  afyonkarahisar: ['Afyonkarahisar', 3, 'EGE', 38.76, 30.54],
  agri: ['Ağrı', 4, 'DOGU_ANADOLU', 39.72, 43.05],
  amasya: ['Amasya', 5, 'KARADENIZ', 40.65, 35.83],
  ankara: ['Ankara', 6, 'IC_ANADOLU', 39.93, 32.86],
  antalya: ['Antalya', 7, 'AKDENIZ', 36.9, 30.7],
  artvin: ['Artvin', 8, 'KARADENIZ', 41.18, 41.82],
  aydin: ['Aydın', 9, 'EGE', 37.85, 27.84],
  balikesir: ['Balıkesir', 10, 'MARMARA', 39.65, 27.89],
  bilecik: ['Bilecik', 11, 'MARMARA', 40.14, 29.98],
  bingol: ['Bingöl', 12, 'DOGU_ANADOLU', 38.88, 40.5],
  bitlis: ['Bitlis', 13, 'DOGU_ANADOLU', 38.4, 42.11],
  bolu: ['Bolu', 14, 'KARADENIZ', 40.73, 31.61],
  burdur: ['Burdur', 15, 'AKDENIZ', 37.72, 30.29],
  bursa: ['Bursa', 16, 'MARMARA', 40.18, 29.06],
  canakkale: ['Çanakkale', 17, 'MARMARA', 40.15, 26.41],
  cankiri: ['Çankırı', 18, 'IC_ANADOLU', 40.6, 33.62],
  corum: ['Çorum', 19, 'KARADENIZ', 40.55, 34.95],
  denizli: ['Denizli', 20, 'EGE', 37.78, 29.09],
  diyarbakir: ['Diyarbakır', 21, 'GUNEYDOGU_ANADOLU', 37.91, 40.24],
  edirne: ['Edirne', 22, 'MARMARA', 41.68, 26.56],
  elazig: ['Elazığ', 23, 'DOGU_ANADOLU', 38.67, 39.22],
  erzincan: ['Erzincan', 24, 'DOGU_ANADOLU', 39.75, 39.49],
  erzurum: ['Erzurum', 25, 'DOGU_ANADOLU', 39.9, 41.27],
  eskisehir: ['Eskişehir', 26, 'IC_ANADOLU', 39.78, 30.52],
  gaziantep: ['Gaziantep', 27, 'GUNEYDOGU_ANADOLU', 37.07, 37.38],
  giresun: ['Giresun', 28, 'KARADENIZ', 40.91, 38.39],
  gumushane: ['Gümüşhane', 29, 'KARADENIZ', 40.46, 39.48],
  hakkari: ['Hakkâri', 30, 'DOGU_ANADOLU', 37.57, 43.74],
  hatay: ['Hatay', 31, 'AKDENIZ', 36.4, 36.35],
  isparta: ['Isparta', 32, 'AKDENIZ', 37.76, 30.55],
  mersin: ['Mersin', 33, 'AKDENIZ', 36.8, 34.64],
  istanbul: ['İstanbul', 34, 'MARMARA', 41.01, 28.98],
  izmir: ['İzmir', 35, 'EGE', 38.42, 27.14],
  kars: ['Kars', 36, 'DOGU_ANADOLU', 40.6, 43.1],
  kastamonu: ['Kastamonu', 37, 'KARADENIZ', 41.38, 33.78],
  kayseri: ['Kayseri', 38, 'IC_ANADOLU', 38.72, 35.49],
  kirklareli: ['Kırklareli', 39, 'MARMARA', 41.73, 27.22],
  kirsehir: ['Kırşehir', 40, 'IC_ANADOLU', 39.15, 34.17],
  kocaeli: ['Kocaeli', 41, 'MARMARA', 40.77, 29.94],
  konya: ['Konya', 42, 'IC_ANADOLU', 37.87, 32.48],
  kutahya: ['Kütahya', 43, 'EGE', 39.42, 29.98],
  malatya: ['Malatya', 44, 'DOGU_ANADOLU', 38.35, 38.31],
  manisa: ['Manisa', 45, 'EGE', 38.61, 27.43],
  kahramanmaras: ['Kahramanmaraş', 46, 'AKDENIZ', 37.58, 36.94],
  mardin: ['Mardin', 47, 'GUNEYDOGU_ANADOLU', 37.31, 40.74],
  mugla: ['Muğla', 48, 'EGE', 37.22, 28.36],
  mus: ['Muş', 49, 'DOGU_ANADOLU', 38.74, 41.49],
  nevsehir: ['Nevşehir', 50, 'IC_ANADOLU', 38.62, 34.71],
  nigde: ['Niğde', 51, 'IC_ANADOLU', 37.97, 34.68],
  ordu: ['Ordu', 52, 'KARADENIZ', 40.98, 37.88],
  rize: ['Rize', 53, 'KARADENIZ', 41.02, 40.52],
  sakarya: ['Sakarya', 54, 'MARMARA', 40.76, 30.4],
  samsun: ['Samsun', 55, 'KARADENIZ', 41.29, 36.33],
  siirt: ['Siirt', 56, 'GUNEYDOGU_ANADOLU', 37.93, 41.94],
  sinop: ['Sinop', 57, 'KARADENIZ', 42.03, 35.15],
  sivas: ['Sivas', 58, 'IC_ANADOLU', 39.75, 37.02],
  tekirdag: ['Tekirdağ', 59, 'MARMARA', 40.98, 27.51],
  tokat: ['Tokat', 60, 'KARADENIZ', 40.31, 36.55],
  trabzon: ['Trabzon', 61, 'KARADENIZ', 41.0, 39.72],
  tunceli: ['Tunceli', 62, 'DOGU_ANADOLU', 39.11, 39.55],
  sanliurfa: ['Şanlıurfa', 63, 'GUNEYDOGU_ANADOLU', 37.16, 38.79],
  usak: ['Uşak', 64, 'EGE', 38.68, 29.41],
  van: ['Van', 65, 'DOGU_ANADOLU', 38.49, 43.38],
  yozgat: ['Yozgat', 66, 'IC_ANADOLU', 39.82, 34.81],
  zonguldak: ['Zonguldak', 67, 'KARADENIZ', 41.46, 31.8],
  aksaray: ['Aksaray', 68, 'IC_ANADOLU', 38.37, 34.03],
  bayburt: ['Bayburt', 69, 'KARADENIZ', 40.26, 40.22],
  karaman: ['Karaman', 70, 'IC_ANADOLU', 37.18, 33.22],
  kirikkale: ['Kırıkkale', 71, 'IC_ANADOLU', 39.85, 33.52],
  batman: ['Batman', 72, 'GUNEYDOGU_ANADOLU', 37.88, 41.13],
  sirnak: ['Şırnak', 73, 'GUNEYDOGU_ANADOLU', 37.52, 42.46],
  bartin: ['Bartın', 74, 'KARADENIZ', 41.64, 32.34],
  ardahan: ['Ardahan', 75, 'DOGU_ANADOLU', 41.11, 42.7],
  igdir: ['Iğdır', 76, 'DOGU_ANADOLU', 39.92, 44.04],
  yalova: ['Yalova', 77, 'MARMARA', 40.65, 29.27],
  karabuk: ['Karabük', 78, 'KARADENIZ', 41.2, 32.62],
  kilis: ['Kilis', 79, 'GUNEYDOGU_ANADOLU', 36.72, 37.12],
  osmaniye: ['Osmaniye', 80, 'AKDENIZ', 37.07, 36.25],
  duzce: ['Düzce', 81, 'KARADENIZ', 40.84, 31.16],
};

// ---------------------------------------------------------------------------
// Elle ayarlanmış ilk 12 şehir
// ---------------------------------------------------------------------------

interface DetailedCityProfile extends CityEconomicProfile {
  sectorBonuses: Partial<Record<SectorId, number>>;
  shopBonuses: Partial<Record<ShopType, number>>;
  difficulty: CityDifficulty;
  playStyleTR: string;
  advantagesTR: string[];
  disadvantagesTR: string[];
}

/** Sıra, şartnamedeki ilk şehir setiyle aynıdır. */
export const DETAILED_CITY_IDS = [
  'istanbul',
  'ankara',
  'izmir',
  'bursa',
  'antalya',
  'konya',
  'gaziantep',
  'mersin',
  'samsun',
  'kayseri',
  'trabzon',
  'diyarbakir',
] as const satisfies readonly CityId[];

export type DetailedCityId = (typeof DETAILED_CITY_IDS)[number];

const DETAILED_PROFILES: Record<DetailedCityId, DetailedCityProfile> = {
  istanbul: {
    demandMultiplier: 1.35,
    rentMultiplier: 1.45,
    wageMultiplier: 1.25,
    logisticsMultiplier: 1.05,
    competitionMultiplier: 1.35,
    purchasingPowerMultiplier: 1.15,
    sectorBonuses: { FINANS: 0.1, LOJISTIK: 0.08, PERAKENDE: 0.08, TEKNOLOJI: 0.06, MADENCILIK: -0.1 },
    shopBonuses: { ELEKTRONIK_MAGAZASI: 0.08, GIYIM_MAGAZASI: 0.08, KAFE: 0.05, OTOMOBIL_GALERISI: 0.05 },
    difficulty: 'HARD',
    playStyleTR: 'Dev müşteri kitlesi, dev giderler: hata payı dar, kazanç potansiyeli yüksek.',
    advantagesTR: ['En yüksek müşteri talebi', 'Güçlü satın alma gücü', 'Finans ve perakendede yerel bonus'],
    disadvantagesTR: ['En yüksek kira ve ücretler', 'Çok sert rekabet', 'Trafik yüzünden lojistik biraz pahalı'],
  },
  ankara: {
    demandMultiplier: 1.08,
    rentMultiplier: 1.05,
    wageMultiplier: 1.05,
    logisticsMultiplier: 1.0,
    competitionMultiplier: 1.0,
    purchasingPowerMultiplier: 1.08,
    sectorBonuses: { SAVUNMA: 0.15, TEKNOLOJI: 0.1, FINANS: 0.05 },
    shopBonuses: { ELEKTRONIK_MAGAZASI: 0.05, MARKET: 0.03 },
    difficulty: 'EASY',
    playStyleTR: 'Dengeli ve güvenli: ilk kez oynayanlar için en az sürprizli başlangıç.',
    advantagesTR: ['Maliyetler ve talep dengeli', 'Savunma ve teknolojide yerel bonus', 'Rekabet ortalamada'],
    disadvantagesTR: ['Hiçbir alanda uçuk avantaj yok', 'Turizm ve liman geliri yok'],
  },
  izmir: {
    demandMultiplier: 1.12,
    rentMultiplier: 1.15,
    wageMultiplier: 1.1,
    logisticsMultiplier: 0.92,
    competitionMultiplier: 1.12,
    purchasingPowerMultiplier: 1.08,
    sectorBonuses: { LOJISTIK: 0.1, PERAKENDE: 0.06, ENERJI: 0.03 },
    shopBonuses: { KAFE: 0.06, GIYIM_MAGAZASI: 0.05, MANAV: 0.04 },
    difficulty: 'MEDIUM',
    playStyleTR: 'Ticaret, turizm ve liman: hareketli bir pazar, orta maliyet.',
    advantagesTR: ['Liman sayesinde ucuz lojistik', 'Kafe ve giyimde güçlü talep', 'İyi satın alma gücü'],
    disadvantagesTR: ['Kira ve ücretler ortalamanın üstünde', 'Yoğun rekabet'],
  },
  bursa: {
    demandMultiplier: 1.05,
    rentMultiplier: 1.0,
    wageMultiplier: 1.02,
    logisticsMultiplier: 0.97,
    competitionMultiplier: 1.1,
    purchasingPowerMultiplier: 1.05,
    sectorBonuses: { SAVUNMA: 0.05, ENERJI: 0.04, LOJISTIK: 0.03 },
    shopBonuses: { GIYIM_MAGAZASI: 0.1, MOBILYA_MAGAZASI: 0.1, OTOMOBIL_GALERISI: 0.1 },
    difficulty: 'MEDIUM',
    playStyleTR: 'Sanayi, otomotiv ve tekstil: üretim odaklı oyuncuya göre.',
    advantagesTR: ['Otomotiv, tekstil ve mobilyada yerel bonus', 'Makul kira ve ücret', 'İyi sanayi altyapısı'],
    disadvantagesTR: ['Sanayi şehri olduğu için rekabet sert', 'Turizm talebi yok'],
  },
  antalya: {
    demandMultiplier: 1.15,
    rentMultiplier: 1.2,
    wageMultiplier: 1.05,
    logisticsMultiplier: 1.08,
    competitionMultiplier: 1.15,
    purchasingPowerMultiplier: 1.0,
    sectorBonuses: { PERAKENDE: 0.1, ENERJI: -0.04, MADENCILIK: -0.05 },
    shopBonuses: { KAFE: 0.15, GIYIM_MAGAZASI: 0.08, MANAV: 0.05 },
    difficulty: 'HARD',
    playStyleTR: 'Sezonluk turizm patlaması: yazın kazandırır, kışın nakit yönetimi ister.',
    advantagesTR: ['Turizm sezonunda çok yüksek talep', 'Kafe ve giyimde güçlü bonus', 'Hareketli perakende'],
    disadvantagesTR: ['Yüksek kira', 'Sezon dışında düşüş riski', 'Sanayi sektörlerinde zayıf'],
  },
  konya: {
    demandMultiplier: 0.95,
    rentMultiplier: 0.8,
    wageMultiplier: 0.88,
    logisticsMultiplier: 1.05,
    competitionMultiplier: 0.85,
    purchasingPowerMultiplier: 0.92,
    sectorBonuses: { SAVUNMA: 0.06, PERAKENDE: 0.03 },
    shopBonuses: { MANAV: 0.1, MARKET: 0.04 },
    difficulty: 'EASY',
    playStyleTR: 'Ucuz arazi, tarım ve makine: düşük riskle sağlam büyüme.',
    advantagesTR: ['Düşük kira ve ücret', 'Az rekabet', 'Manav ve markette yerel bonus'],
    disadvantagesTR: ['Müşteri talebi ortalamanın altında', 'Denizden uzak, lojistik biraz pahalı'],
  },
  gaziantep: {
    demandMultiplier: 0.98,
    rentMultiplier: 0.82,
    wageMultiplier: 0.78,
    logisticsMultiplier: 1.0,
    competitionMultiplier: 0.95,
    purchasingPowerMultiplier: 0.9,
    sectorBonuses: { PERAKENDE: 0.08, LOJISTIK: 0.06 },
    shopBonuses: { MARKET: 0.06, MANAV: 0.05, KAFE: 0.06, MOBILYA_MAGAZASI: 0.05 },
    difficulty: 'EASY',
    playStyleTR: 'Düşük maliyetli üretim ve ihracat kapısı; mutfak ve ticaret kültürü güçlü.',
    advantagesTR: ['En düşük ücretlerden biri', 'Kira ucuz', 'Kafe, market ve mobilyada bonus'],
    disadvantagesTR: ['Satın alma gücü ortalamanın altında', 'Talep büyük şehirlere göre sınırlı'],
  },
  mersin: {
    demandMultiplier: 0.97,
    rentMultiplier: 0.9,
    wageMultiplier: 0.92,
    logisticsMultiplier: 0.85,
    competitionMultiplier: 1.0,
    purchasingPowerMultiplier: 0.93,
    sectorBonuses: { LOJISTIK: 0.15, MADENCILIK: 0.05, ENERJI: 0.05 },
    shopBonuses: { MANAV: 0.08, MARKET: 0.03 },
    difficulty: 'MEDIUM',
    playStyleTR: 'Liman, depo ve lojistik: stok ve sevkiyatla oynayanların şehri.',
    advantagesTR: ['En ucuz lojistik', 'Lojistik ve enerjide güçlü bonus', 'Ucuz kira ve ücret'],
    disadvantagesTR: ['Yerel talep orta', 'Perakendede belirgin avantaj yok'],
  },
  samsun: {
    demandMultiplier: 0.95,
    rentMultiplier: 0.85,
    wageMultiplier: 0.88,
    logisticsMultiplier: 0.93,
    competitionMultiplier: 0.92,
    purchasingPowerMultiplier: 0.92,
    sectorBonuses: { LOJISTIK: 0.1, ENERJI: 0.04 },
    shopBonuses: { MARKET: 0.05, MANAV: 0.04 },
    difficulty: 'MEDIUM',
    playStyleTR: 'Karadeniz lojistik merkezi: sakin pazar, iyi sevkiyat bağlantısı.',
    advantagesTR: ['Düşük kira ve ücret', 'Karadeniz limanı sayesinde ucuz lojistik', 'Az rekabet'],
    disadvantagesTR: ['Talep ve satın alma gücü ortalamanın altında', 'Turizm avantajı yok'],
  },
  kayseri: {
    demandMultiplier: 0.98,
    rentMultiplier: 0.9,
    wageMultiplier: 0.92,
    logisticsMultiplier: 1.03,
    competitionMultiplier: 0.97,
    purchasingPowerMultiplier: 0.98,
    sectorBonuses: { PERAKENDE: 0.06, SAVUNMA: 0.04, MADENCILIK: 0.03 },
    shopBonuses: { MOBILYA_MAGAZASI: 0.1, ELEKTRONIK_MAGAZASI: 0.04 },
    difficulty: 'EASY',
    playStyleTR: 'Üretim ve ticaret dengesi: ticaretle uğraşan, çalışkan bir şehir.',
    advantagesTR: ['Mobilyada güçlü bonus', 'Düşük kira ve ücret', 'Satın alma gücü sağlam'],
    disadvantagesTR: ['Talep ortalamanın biraz altında', 'Liman yok, lojistik biraz pahalı'],
  },
  trabzon: {
    demandMultiplier: 1.0,
    rentMultiplier: 0.95,
    wageMultiplier: 0.92,
    logisticsMultiplier: 1.1,
    competitionMultiplier: 1.0,
    purchasingPowerMultiplier: 0.95,
    sectorBonuses: { PERAKENDE: 0.05, LOJISTIK: 0.04 },
    shopBonuses: { KAFE: 0.06, GIYIM_MAGAZASI: 0.04, BUFE: 0.04 },
    difficulty: 'MEDIUM',
    playStyleTR: 'Bölgesel ticaret ve turizm: küçük ama canlı bir pazar.',
    advantagesTR: ['Kafe ve büfede yerel bonus', 'Bölgesel ticaret merkezi', 'Orta kira'],
    disadvantagesTR: ['Dağlık coğrafya yüzünden lojistik pahalı', 'Talep büyük şehirlerin gerisinde'],
  },
  diyarbakir: {
    demandMultiplier: 0.9,
    rentMultiplier: 0.72,
    wageMultiplier: 0.75,
    logisticsMultiplier: 1.12,
    competitionMultiplier: 0.8,
    purchasingPowerMultiplier: 0.78,
    sectorBonuses: { PERAKENDE: 0.04 },
    shopBonuses: { MARKET: 0.06, BUFE: 0.05, MANAV: 0.04, ELEKTRONIK_MAGAZASI: -0.05 },
    difficulty: 'HARD',
    playStyleTR: 'Düşük kurulum maliyeti, gelişen pazar: ucuza girip büyümeye bahis.',
    advantagesTR: ['En düşük kira ve ücret', 'Az rekabet', 'Büfe ve markette bonus'],
    disadvantagesTR: ['Düşük satın alma gücü', 'Uzak bölge: pahalı lojistik', 'Elektronikte zayıf talep'],
  },
};

// ---------------------------------------------------------------------------
// Birleşik tanım tablosu
// ---------------------------------------------------------------------------

function isDetailedId(id: CityId): id is DetailedCityId {
  return (DETAILED_CITY_IDS as readonly string[]).includes(id);
}

function buildDefinition(id: CityId): CityDefinition {
  const [nameTR, plateCode, region, latitude, longitude] = RAW_CITIES[id];
  const base = {
    id,
    nameTR,
    plateCode,
    region,
    coordinates: { latitude, longitude },
    mapPosition: projectToMap(latitude, longitude),
  };
  if (isDetailedId(id)) {
    const p = DETAILED_PROFILES[id];
    return {
      ...base,
      profileKind: 'DETAILED' satisfies CityProfileKind,
      demandMultiplier: p.demandMultiplier,
      rentMultiplier: p.rentMultiplier,
      wageMultiplier: p.wageMultiplier,
      logisticsMultiplier: p.logisticsMultiplier,
      competitionMultiplier: p.competitionMultiplier,
      purchasingPowerMultiplier: p.purchasingPowerMultiplier,
      sectorBonuses: { ...p.sectorBonuses },
      shopBonuses: { ...p.shopBonuses },
      difficulty: p.difficulty,
      playStyleTR: p.playStyleTR,
      advantagesTR: [...p.advantagesTR],
      disadvantagesTR: [...p.disadvantagesTR],
    };
  }
  return {
    ...base,
    profileKind: 'DEFAULT' satisfies CityProfileKind,
    ...DEFAULT_CITY_PROFILE,
    sectorBonuses: {},
    shopBonuses: {},
    difficulty: 'MEDIUM',
    playStyleTR: DEFAULT_CITY_PLAY_STYLE_TR,
    advantagesTR: [...DEFAULT_CITY_ADVANTAGES_TR],
    disadvantagesTR: [...DEFAULT_CITY_DISADVANTAGES_TR],
  };
}

/** Plaka sırasıyla 81 il kimliği. */
export const CITY_IDS: readonly CityId[] = (Object.keys(RAW_CITIES) as CityId[]).sort(
  (a, b) => RAW_CITIES[a][1] - RAW_CITIES[b][1]
);

/** Bütün şehir tanımları; `Record<CityId, …>` olduğu için eksik/fazla kimlik derleme hatası verir. */
export const CITY_DEFINITIONS: Readonly<Record<CityId, CityDefinition>> = Object.freeze(
  Object.fromEntries(CITY_IDS.map((id) => [id, Object.freeze(buildDefinition(id))])) as Record<
    CityId,
    CityDefinition
  >
);

export const CITY_COUNT = CITY_IDS.length;

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

const CITY_ID_SET: ReadonlySet<string> = new Set(CITY_IDS);

/** Bilinmeyen/bozuk değerleri (ör. eski kayıttan gelen) güvenle eler. */
export function isCityId(value: unknown): value is CityId {
  return typeof value === 'string' && CITY_ID_SET.has(value);
}

export function getCityDefinition(id: CityId): CityDefinition {
  return CITY_DEFINITIONS[id];
}

export function getAllCityDefinitions(): CityDefinition[] {
  return CITY_IDS.map((id) => CITY_DEFINITIONS[id]);
}

export function getDetailedCityDefinitions(): CityDefinition[] {
  return DETAILED_CITY_IDS.map((id) => CITY_DEFINITIONS[id]);
}

/**
 * Faz 8'de tüm şehir çarpanları buradan geçer: NaN/Infinity/negatif değer 1'e (nötr) döner,
 * geçerli değer [MIN, MAX] aralığına sıkıştırılır.
 */
export function clampCityMultiplier(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.min(CITY_MULTIPLIER_MAX, Math.max(CITY_MULTIPLIER_MIN, value));
}

/** Bonus değerleri için aynı koruma (nötr değer 0). */
export function clampCityBonus(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(CITY_BONUS_MAX, Math.max(CITY_BONUS_MIN, value));
}

/** Bilinen bir kimliği kaçırdığımızı derleme zamanında yakalamak için kullanılır (`switch` default kolu). */
export function assertNeverCityId(value: never): never {
  throw new Error(`Bilinmeyen şehir kimliği: ${String(value)}`);
}
