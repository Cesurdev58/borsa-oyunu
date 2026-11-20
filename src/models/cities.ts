/**
 * Şehir (il) veri modeli — Türkiye haritası geçişi, Faz 1.
 * Bu dosya yalnızca tip tanımlarını içerir; veriler `data/cityDefinitions.ts`,
 * denge sabitleri `data/cityBalance.ts` içindedir.
 */
import type { SectorId } from './market';
import type { ShopType } from './trade';

/** Türkiye'nin 7 coğrafi bölgesi. */
export type TurkeyRegion =
  | 'MARMARA'
  | 'EGE'
  | 'AKDENIZ'
  | 'IC_ANADOLU'
  | 'KARADENIZ'
  | 'DOGU_ANADOLU'
  | 'GUNEYDOGU_ANADOLU';

/** 81 ilin kimliği (ASCII, küçük harf). Gerçek liste `data/cityDefinitions.ts` içindeki `CITY_IDS`. */
export type CityId =
  | 'adana' | 'adiyaman' | 'afyonkarahisar' | 'agri' | 'amasya' | 'ankara'
  | 'antalya' | 'artvin' | 'aydin' | 'balikesir' | 'bilecik' | 'bingol'
  | 'bitlis' | 'bolu' | 'burdur' | 'bursa' | 'canakkale' | 'cankiri'
  | 'corum' | 'denizli' | 'diyarbakir' | 'edirne' | 'elazig' | 'erzincan'
  | 'erzurum' | 'eskisehir' | 'gaziantep' | 'giresun' | 'gumushane' | 'hakkari'
  | 'hatay' | 'isparta' | 'mersin' | 'istanbul' | 'izmir' | 'kars'
  | 'kastamonu' | 'kayseri' | 'kirklareli' | 'kirsehir' | 'kocaeli' | 'konya'
  | 'kutahya' | 'malatya' | 'manisa' | 'kahramanmaras' | 'mardin' | 'mugla'
  | 'mus' | 'nevsehir' | 'nigde' | 'ordu' | 'rize' | 'sakarya'
  | 'samsun' | 'siirt' | 'sinop' | 'sivas' | 'tekirdag' | 'tokat'
  | 'trabzon' | 'tunceli' | 'sanliurfa' | 'usak' | 'van' | 'yozgat'
  | 'zonguldak' | 'aksaray' | 'bayburt' | 'karaman' | 'kirikkale' | 'batman'
  | 'sirnak' | 'bartin' | 'ardahan' | 'igdir' | 'yalova' | 'karabuk'
  | 'kilis' | 'osmaniye' | 'duzce';

/** Coğrafi koordinat (derece). */
export interface CityCoordinates {
  latitude: number;
  longitude: number;
}

/** Haritadaki konum: 1000 genişlikli sanal sahnede (x: 0–1000, y: 0–MAP_HEIGHT). */
export interface CityMapPosition {
  x: number;
  y: number;
}

export type CityDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

/**
 * Şehrin altı ekonomik çarpanı. 1,00 = ülke ortalaması.
 * Talep ve satın alma gücü yükseldikçe oyuncu lehine; kira, ücret, lojistik ve rekabet
 * yükseldikçe oyuncu aleyhinedir. Sınırlar `data/cityBalance.ts` içinde.
 */
export interface CityEconomicProfile {
  demandMultiplier: number;
  rentMultiplier: number;
  wageMultiplier: number;
  logisticsMultiplier: number;
  competitionMultiplier: number;
  purchasingPowerMultiplier: number;
}

/**
 * `DETAILED`: elle ayarlanmış ilk 12 şehir. `DEFAULT`: dengeli varsayılan profil kullanan diğer iller.
 */
export type CityProfileKind = 'DETAILED' | 'DEFAULT';

export interface CityDefinition extends CityEconomicProfile {
  id: CityId;
  nameTR: string;
  plateCode: number;
  region: TurkeyRegion;
  coordinates: CityCoordinates;
  /** coordinates alanından türetilir (data/cityDefinitions.ts `projectToMap`). */
  mapPosition: CityMapPosition;
  profileKind: CityProfileKind;

  /** Sektör başına talep bonusu; 0,10 = +%10, −0,05 = −%5. */
  sectorBonuses: Partial<Record<SectorId, number>>;
  /** Dükkân türü başına talep bonusu; aynı ölçek. */
  shopBonuses: Partial<Record<ShopType, number>>;

  difficulty: CityDifficulty;
  playStyleTR: string;
  advantagesTR: string[];
  disadvantagesTR: string[];
}

/** Haritada bir şehir işaretinin görünümü (Faz 3'te çizilir). Gri/beyaz/altın anlamları ürün kararıdır. */
export type CityMarkerState =
  | 'EMPTY' // gri: oyuncunun mağazası yok (tıklanabilir!)
  | 'OWNED' // beyaz: en az bir mağaza var
  | 'HEADQUARTERS'; // beyaz + altın çerçeve: şirket merkezi

/** Oyuncunun bir şehirdeki varlığı (mağaza sayısından türetilir, kayıtta tutulmaz). */
export interface CityPresenceStatus {
  cityId: CityId;
  shopCount: number;
  isHeadquarters: boolean;
  markerState: CityMarkerState;
}

/** Yeni mağaza açılış teklifi (Faz 7'de motor fonksiyonu üretir; burada yalnızca sözleşme). */
export interface CityExpansionQuote {
  cityId: CityId;
  shopType: ShopType;
  baseSetupCost: number;
  cityRentDeposit: number;
  regionalPermitCost: number;
  initialStockCost: number;
  initialLogisticsCost: number;
  prestigeDiscount: number;
  milestoneDiscount: number;
  totalUpfrontCost: number;
  recommendedReserve: number;
  estimatedDeliveryDays: number;
  warningsTR: string[];
}

/**
 * Eski kayıtların şehir geçişi durumu (kayıtta `state.cityMigration`).
 * - `PENDING`: oyuncu merkez şehri henüz seçmedi; gün ilerlemesi ve çevrimdışı ilerleme durur.
 * - `COMPLETED`: tüm mağazaların şehri belli.
 * Alan yoksa (yeni kayıt ya da şehir sistemi öncesi) geçiş gerekmiyor demektir.
 */
export interface CityMigrationState {
  version: number;
  status: 'PENDING' | 'COMPLETED';
  /** Seçimde şehre atanan mağaza sayısı (rapor/test için). */
  assignedShopCount: number;
  /** Bilinmeyen/bozuk cityId yüzünden yeniden sıraya alınan mağaza sayısı. */
  repairedShopCount: number;
  completedAtISO?: string;
}

/** Haritanın kamera durumu; Faz 3'te kullanılır, alan şimdiden kayıtta yer alır. */
export interface TurkeyMapViewState {
  panX: number;
  panY: number;
  zoom: number;
}
