/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IPOEligibilityResult,
  MarketSession,
  SimulationStage,
  SimulationState,
} from '../../../models/simulation';
import {
  GraphicsQualityLevel,
  UISettingsStore,
} from '../../../state/uiSettingsStore';
import { CityBuildingId } from '../gameTypes';
import {
  BuildingConstructionVisualInfo,
  BuildingNavigationTarget,
  BuildingPrimaryStatusType,
  BuildingSelectionCardInfo,
  BuildingVisualLevelSpec,
  BuildingWindowSlot,
  CityAtmosphereTheme,
  CityCameraState,
  CityDecorationNode,
  CityDiagnosticsSummary,
  CityDistrictId,
  CityDistrictInfo,
  CityPedestrianNode,
  CityUrbanBlockNode,
  CityVehicleRouteItem,
  CityZoomPreset,
  ConstructionVisualStage,
  IsometricBuildingNode,
  TimeOfDayPhase,
} from './cityVisualTypes';

export const VIRTUAL_MAP_WIDTH = 1600;
export const VIRTUAL_MAP_HEIGHT = 1200;
export const VIRTUAL_MAP_CENTER_X = 800;
export const VIRTUAL_MAP_CENTER_Y = 600;

/**
 * 1600x1200 sanal şehir alanı üzerinde 8 ana etkileşimli binanın yerleşim koordinatları.
 * Merkezde (800, 580) açık renkli Finans Meydanı ve park yer alır.
 */
export const CITY_BUILDING_COORDINATES: Record<
  CityBuildingId,
  { x: number; y: number; width: number; height: number }
> = {
  // SOL ÜST: Haber ve Ekonomi Merkezi
  HABER_MERKEZI: { x: 350, y: 275, width: 210, height: 185 },
  // ORTA ÜST: Borsa Binası
  BORSA: { x: 795, y: 215, width: 245, height: 205 },
  // SAĞ ÜST: Merkez Bankası ve Hazine
  BANKA: { x: 1245, y: 285, width: 225, height: 190 },
  // SOL ORTA: Oyuncu / Çalışan Ofisi (Ticaret Bölgesi)
  OYUNCU_OFISI: { x: 305, y: 605, width: 205, height: 180 },
  // SAĞ ORTA: Şirket Arsası veya Şirket Genel Merkezi (Teknoloji & Kurumsal Kampüs)
  SIRKET_MERKEZI: { x: 1275, y: 595, width: 230, height: 195 },
  // SOL ALT: Oyuncu Fabrikası (Sanayi Bölgesi)
  FABRIKA: { x: 365, y: 940, width: 235, height: 195 },
  // ORTA ALT: Ar-Ge Merkezi (Teknoloji Bölgesi)
  ARGE_MERKEZI: { x: 805, y: 965, width: 220, height: 185 },
  // SAĞ ALT: Holding Merkezi
  HOLDING_MERKEZI: { x: 1255, y: 925, width: 235, height: 215 },
};

export const BUILDING_DISTRICT_MAP: Record<CityBuildingId, CityDistrictId> = {
  BORSA: 'FINANS_BOLGESI',
  BANKA: 'FINANS_BOLGESI',
  HABER_MERKEZI: 'FINANS_BOLGESI',
  HOLDING_MERKEZI: 'FINANS_BOLGESI',
  OYUNCU_OFISI: 'TICARET_BOLGESI',
  FABRIKA: 'SANAYI_BOLGESI',
  SIRKET_MERKEZI: 'TEKNOLOJI_BOLGESI',
  ARGE_MERKEZI: 'TEKNOLOJI_BOLGESI',
};

/**
 * 6 Şehir Bölgesinin (Finans, Ticaret, Sanayi, Teknoloji, Yaşam/Hizmet, Kilitli Genişleme)
 * anlık kilit ve bina sayılarını gerçek simülasyon durumuna göre türetir.
 */
export function deriveCityDistricts(
  state: SimulationState
): CityDistrictInfo[] {
  const pc = state.playerCompany;
  const hasCompany = pc !== null;
  const isStage2Unlocked = state.stageUnlocks.stage2Entrepreneur || hasCompany;
  const isStage4Unlocked = state.stageUnlocks.stage4Holding;
  const isExpansionUnlocked = Boolean(
    isStage4Unlocked ||
      state.netWorth >= 5_000_000 ||
      (pc && pc.staffCount >= 40) ||
      (pc && (pc.corporateGovernanceScore ?? 50) >= 75)
  );

  return [
    {
      id: 'FINANS_BOLGESI',
      nameTR: 'Finans Bölgesi',
      shortNameTR: 'Finans',
      descriptionTR:
        'Borsa Binası, Banka, Finans Meydanı, Holding Merkezi ve Haber Merkezi',
      isUnlocked: true,
      unlockConditionTR: 'Başlangıçtan itibaren açık',
      bounds: { x: 240, y: 90, width: 1160, height: 420 },
      buildingCount: 7,
    },
    {
      id: 'TICARET_BOLGESI',
      nameTR: 'Ticaret Bölgesi',
      shortNameTR: 'Ticaret',
      descriptionTR:
        'Oyuncu Ofisi, Mağaza, Kafe, Ticaret Merkezi, Toptancı, Küçük Otel ve Depo Bağlantısı',
      isUnlocked: true,
      unlockConditionTR: 'Başlangıçtan itibaren açık',
      bounds: { x: 70, y: 420, width: 460, height: 360 },
      buildingCount: 7,
    },
    {
      id: 'SANAYI_BOLGESI',
      nameTR: 'Sanayi Bölgesi',
      shortNameTR: 'Sanayi',
      descriptionTR:
        'Oyuncu Fabrikası, Sanayi Deposu, Lojistik Sahası, Enerji Binası ve Fabrika Parselleri',
      isUnlocked: isStage2Unlocked,
      unlockConditionTR: 'Şirket kurulumu veya 2.000.000 TL net varlık ile açılır',
      bounds: { x: 80, y: 780, width: 540, height: 360 },
      buildingCount: 5,
    },
    {
      id: 'TEKNOLOJI_BOLGESI',
      nameTR: 'Teknoloji Bölgesi',
      shortNameTR: 'Teknoloji',
      descriptionTR:
        'Şirket Genel Merkezi, Ar-Ge Merkezi, Teknoloji Ofisi, Laboratuvar, Otomasyon ve Akademi',
      isUnlocked: isStage2Unlocked,
      unlockConditionTR: 'Şirket kurulumu veya 2.000.000 TL net varlık ile açılır',
      bounds: { x: 640, y: 450, width: 880, height: 660 },
      buildingCount: 6,
    },
    {
      id: 'YASAM_HIZMET_BOLGESI',
      nameTR: 'Yaşam ve Hizmet Bölgesi',
      shortNameTR: 'Yaşam & Hizmet',
      descriptionTR:
        'Konut Apartmanları, Meydan Parkı, Kafe, Sağlık Merkezi, Belediye Hizmet Binası ve Duraklar',
      isUnlocked: true,
      unlockConditionTR: 'Başlangıçtan itibaren açık',
      bounds: { x: 540, y: 420, width: 520, height: 340 },
      buildingCount: 5,
    },
    {
      id: 'KILITLI_GENISLEME_ALANLARI',
      nameTR: 'Kilitli Genişleme Alanları',
      shortNameTR: 'Genişleme',
      descriptionTR:
        'Yeni yatırım parselleri, çevre ağaçları ve büyüyen holding ufuk silüeti',
      isUnlocked: isExpansionUnlocked,
      unlockConditionTR:
        '5.000.000 TL net varlık, 40+ çalışan, 75+ itibar veya Holding aşamasında açılır',
      bounds: { x: 40, y: 60, width: 1520, height: 1080 },
      buildingCount: 4,
    },
  ];
}

/**
 * Şehir yoğunluğunu oluşturan 22 adet 2.5D şehir bloğu ve yan bina yapısı.
 * Ana 8 etkileşimli binanın tıklama alanlarıyla (hitbox) asla çakışmaz.
 * Ticaret Bölgesi yapıları gelecekteki Ticarium tarzı ticaret kancalarını (`futureTradeHooks`) barındırır.
 */
export const STATIC_CITY_URBAN_BLOCKS: Omit<CityUrbanBlockNode, 'isUnlocked'>[] = [
  // --- 1. TİCARET BÖLGESİ BLOKLARI (Gelecekteki Ticarium Kancalarıyla) ---
  {
    id: 'urban-ticaret-magaza-1',
    districtId: 'TICARET_BOLGESI',
    nameTR: 'Anadolu Perakende Mağazası',
    shortTagTR: 'Mağaza',
    category: 'COMMERCIAL_SHOP',
    x: 135,
    y: 465,
    width: 112,
    height: 92,
    floors: 2,
    zIndex: 28,
    roofColorClass: 'bg-rose-500 border-rose-700',
    frontColorClass: 'bg-amber-50 border-rose-300',
    sideColorClass: 'bg-rose-100 border-rose-300',
    accentColorClass: 'bg-rose-400',
    linkedBuildingId: 'OYUNCU_OFISI',
    futureTradeHooks: ['RETAIL', 'CUSTOMER_DEMAND', 'SERVICE_REVENUE'],
  },
  {
    id: 'urban-ticaret-kafe-2',
    districtId: 'TICARET_BOLGESI',
    nameTR: 'Bulvar Köşe Kafe & Bistro',
    shortTagTR: 'Kafe',
    category: 'CAFE_RESTAURANT',
    x: 455,
    y: 475,
    width: 104,
    height: 86,
    floors: 2,
    zIndex: 29,
    roofColorClass: 'bg-amber-500 border-amber-700',
    frontColorClass: 'bg-white border-amber-300',
    sideColorClass: 'bg-amber-100 border-amber-300',
    accentColorClass: 'bg-orange-400',
    linkedBuildingId: 'OYUNCU_OFISI',
    futureTradeHooks: ['RETAIL', 'CUSTOMER_DEMAND', 'SERVICE_REVENUE'],
  },
  {
    id: 'urban-ticaret-merkezi-3',
    districtId: 'TICARET_BOLGESI',
    nameTR: 'Marmara Ticaret Hanı',
    shortTagTR: 'Ticaret Mrk.',
    category: 'TRADE_CENTER',
    x: 135,
    y: 605,
    width: 118,
    height: 102,
    floors: 3,
    zIndex: 34,
    roofColorClass: 'bg-sky-600 border-sky-800',
    frontColorClass: 'bg-white border-sky-300',
    sideColorClass: 'bg-sky-100 border-sky-300',
    accentColorClass: 'bg-sky-400',
    linkedBuildingId: 'OYUNCU_OFISI',
    futureTradeHooks: ['TRADE_CONTRACT', 'WHOLESALE', 'SUPPLIER'],
  },
  {
    id: 'urban-ticaret-toptanci-4',
    districtId: 'TICARET_BOLGESI',
    nameTR: 'Bölgesel Toptancı Hali',
    shortTagTR: 'Toptancı',
    category: 'WHOLESALE_DEPOT',
    x: 135,
    y: 735,
    width: 116,
    height: 94,
    floors: 2,
    zIndex: 39,
    roofColorClass: 'bg-teal-600 border-teal-800',
    frontColorClass: 'bg-stone-50 border-teal-300',
    sideColorClass: 'bg-teal-100 border-teal-300',
    accentColorClass: 'bg-teal-400',
    linkedBuildingId: 'OYUNCU_OFISI',
    futureTradeHooks: ['WHOLESALE', 'SUPPLIER', 'DELIVERY'],
  },
  {
    id: 'urban-ticaret-otel-5',
    districtId: 'TICARET_BOLGESI',
    nameTR: 'Borsa Palas Butik Otel',
    shortTagTR: 'Butik Otel',
    category: 'BOUTIQUE_HOTEL',
    x: 455,
    y: 730,
    width: 114,
    height: 104,
    floors: 3,
    zIndex: 39,
    roofColorClass: 'bg-indigo-500 border-indigo-700',
    frontColorClass: 'bg-amber-50/90 border-indigo-300',
    sideColorClass: 'bg-indigo-100 border-indigo-300',
    accentColorClass: 'bg-amber-400',
    linkedBuildingId: 'OYUNCU_OFISI',
    futureTradeHooks: ['TOURISM', 'SERVICE_REVENUE', 'CUSTOMER_DEMAND'],
  },
  {
    id: 'urban-ticaret-depo-link-6',
    districtId: 'TICARET_BOLGESI',
    nameTR: 'Ticari Aktarma ve Depo Noktası',
    shortTagTR: 'Aktarma Depo',
    category: 'WAREHOUSE_LINK',
    x: 295,
    y: 755,
    width: 110,
    height: 88,
    floors: 2,
    zIndex: 40,
    roofColorClass: 'bg-slate-600 border-slate-800',
    frontColorClass: 'bg-slate-100 border-slate-300',
    sideColorClass: 'bg-slate-200 border-slate-400',
    accentColorClass: 'bg-amber-400',
    linkedBuildingId: 'FABRIKA',
    linkedCompanySubTab: 'URETIM',
    futureTradeHooks: ['DELIVERY', 'WHOLESALE', 'SUPPLIER'],
  },

  // --- 2. FİNANS BÖLGESİ ÇEVRE BLOKLARI ---
  {
    id: 'urban-finans- clearing-7',
    districtId: 'FINANS_BOLGESI',
    nameTR: 'Takas ve Saklama Kurumu',
    shortTagTR: 'Takas Mrk.',
    category: 'TRADE_CENTER',
    x: 565,
    y: 165,
    width: 116,
    height: 98,
    floors: 3,
    zIndex: 18,
    roofColorClass: 'bg-emerald-700 border-emerald-900',
    frontColorClass: 'bg-white border-emerald-300',
    sideColorClass: 'bg-emerald-100 border-emerald-300',
    accentColorClass: 'bg-teal-400',
    linkedBuildingId: 'BORSA',
    futureTradeHooks: ['TRADE_CONTRACT', 'SERVICE_REVENUE'],
  },
  {
    id: 'urban-finans-audit-8',
    districtId: 'FINANS_BOLGESI',
    nameTR: 'Sermaye Piyasası Denetim Kulesi',
    shortTagTR: 'Finans Kule',
    category: 'TRADE_CENTER',
    x: 1025,
    y: 165,
    width: 118,
    height: 102,
    floors: 3,
    zIndex: 18,
    roofColorClass: 'bg-purple-700 border-purple-900',
    frontColorClass: 'bg-stone-50 border-purple-300',
    sideColorClass: 'bg-purple-100 border-purple-300',
    accentColorClass: 'bg-amber-400',
    linkedBuildingId: 'BANKA',
    futureTradeHooks: ['SERVICE_REVENUE'],
  },

  // --- 3. SANAYİ BÖLGESİ BLOKLARI (Stok Deposu, Lojistik Sahası, Enerji Binası) ---
  {
    id: 'urban-sanayi-depo-9',
    districtId: 'SANAYI_BOLGESI',
    nameTR: 'Merkez Mamul Stok Deposu',
    shortTagTR: 'Sanayi Depo',
    category: 'INDUSTRIAL_WAREHOUSE',
    x: 145,
    y: 935,
    width: 126,
    height: 98,
    floors: 2,
    zIndex: 47,
    roofColorClass: 'bg-slate-700 border-slate-900',
    frontColorClass: 'bg-slate-100 border-amber-400',
    sideColorClass: 'bg-slate-300 border-slate-400',
    accentColorClass: 'bg-amber-400',
    linkedBuildingId: 'SIRKET_MERKEZI',
    linkedCompanySubTab: 'URETIM',
    futureTradeHooks: ['DELIVERY', 'WHOLESALE', 'SUPPLIER'],
  },
  {
    id: 'urban-sanayi-lojistik-10',
    districtId: 'SANAYI_BOLGESI',
    nameTR: 'Ağır Nakliye ve Lojistik Sahası',
    shortTagTR: 'Lojistik Saha',
    category: 'LOGISTICS_YARD',
    x: 565,
    y: 1015,
    width: 122,
    height: 94,
    floors: 2,
    zIndex: 52,
    roofColorClass: 'bg-amber-600 border-amber-800',
    frontColorClass: 'bg-stone-100 border-amber-400',
    sideColorClass: 'bg-amber-100 border-amber-300',
    accentColorClass: 'bg-amber-400',
    linkedBuildingId: 'FABRIKA',
    linkedCompanySubTab: 'URETIM',
    futureTradeHooks: ['DELIVERY', 'SUPPLIER'],
  },
  {
    id: 'urban-sanayi-enerji-11',
    districtId: 'SANAYI_BOLGESI',
    nameTR: 'Endüstriyel Enerji ve Trafo Merkezi',
    shortTagTR: 'Enerji Mrk.',
    category: 'ENERGY_SUBSTATION',
    x: 155,
    y: 1085,
    width: 114,
    height: 88,
    floors: 2,
    zIndex: 55,
    roofColorClass: 'bg-sky-700 border-sky-900',
    frontColorClass: 'bg-slate-100 border-sky-400',
    sideColorClass: 'bg-sky-100 border-sky-300',
    accentColorClass: 'bg-amber-400',
    linkedBuildingId: 'FABRIKA',
    linkedCompanySubTab: 'URETIM',
    futureTradeHooks: ['SUPPLIER'],
  },
  {
    id: 'urban-sanayi-parsel-12',
    districtId: 'SANAYI_BOLGESI',
    nameTR: '2. Etap Fabrika Genişleme Parseli',
    shortTagTR: 'Ek Fabrika Parseli',
    category: 'FUTURE_FACTORY_PARCEL',
    x: 365,
    y: 1105,
    width: 124,
    height: 84,
    floors: 1,
    zIndex: 56,
    roofColorClass: 'bg-emerald-700 border-emerald-900',
    frontColorClass: 'bg-emerald-50 border-emerald-400',
    sideColorClass: 'bg-emerald-100 border-emerald-300',
    accentColorClass: 'bg-amber-400',
    linkedBuildingId: 'SIRKET_MERKEZI',
    linkedCompanySubTab: 'GELISIM',
    futureTradeHooks: ['SUPPLIER', 'DELIVERY'],
  },

  // --- 4. TEKNOLOJİ BÖLGESİ BLOKLARI ---
  {
    id: 'urban-tekno-ofis-13',
    districtId: 'TEKNOLOJI_BOLGESI',
    nameTR: 'Veri ve Yazılım Kampüsü',
    shortTagTR: 'Teknoloji Ofisi',
    category: 'TECH_OFFICE',
    x: 1465,
    y: 475,
    width: 116,
    height: 98,
    floors: 3,
    zIndex: 31,
    roofColorClass: 'bg-cyan-600 border-cyan-800',
    frontColorClass: 'bg-cyan-50 border-cyan-300',
    sideColorClass: 'bg-sky-100 border-cyan-300',
    accentColorClass: 'bg-cyan-400',
    linkedBuildingId: 'SIRKET_MERKEZI',
    linkedCompanySubTab: 'GELISIM',
    futureTradeHooks: ['SERVICE_REVENUE'],
  },
  {
    id: 'urban-tekno-lab-14',
    districtId: 'TEKNOLOJI_BOLGESI',
    nameTR: 'İleri Malzeme Test Laboratuvarı',
    shortTagTR: 'Test Lab.',
    category: 'INNOVATION_LAB',
    x: 1015,
    y: 985,
    width: 118,
    height: 94,
    floors: 2,
    zIndex: 51,
    roofColorClass: 'bg-sky-600 border-sky-800',
    frontColorClass: 'bg-white border-cyan-300',
    sideColorClass: 'bg-cyan-100 border-cyan-300',
    accentColorClass: 'bg-cyan-400',
    linkedBuildingId: 'ARGE_MERKEZI',
    linkedCompanySubTab: 'GELISIM',
    futureTradeHooks: ['SERVICE_REVENUE'],
  },
  {
    id: 'urban-tekno-otomasyon-15',
    districtId: 'TEKNOLOJI_BOLGESI',
    nameTR: 'Robotik ve Otomasyon Merkezi',
    shortTagTR: 'Otomasyon Mrk.',
    category: 'AUTOMATION_HUB',
    x: 1465,
    y: 735,
    width: 118,
    height: 96,
    floors: 3,
    zIndex: 41,
    roofColorClass: 'bg-teal-600 border-teal-800',
    frontColorClass: 'bg-white border-teal-300',
    sideColorClass: 'bg-teal-100 border-teal-300',
    accentColorClass: 'bg-emerald-400',
    linkedBuildingId: 'SIRKET_MERKEZI',
    linkedCompanySubTab: 'GELISIM',
    futureTradeHooks: ['SERVICE_REVENUE', 'SUPPLIER'],
  },
  {
    id: 'urban-tekno-akademi-16',
    districtId: 'TEKNOLOJI_BOLGESI',
    nameTR: 'Kurumsal Akademi ve İnovasyon Enstitüsü',
    shortTagTR: 'İnovasyon Enst.',
    category: 'TECH_ACADEMY',
    x: 805,
    y: 1115,
    width: 122,
    height: 86,
    floors: 2,
    zIndex: 57,
    roofColorClass: 'bg-indigo-600 border-indigo-800',
    frontColorClass: 'bg-white border-indigo-300',
    sideColorClass: 'bg-indigo-100 border-indigo-300',
    accentColorClass: 'bg-sky-400',
    linkedBuildingId: 'SIRKET_MERKEZI',
    linkedCompanySubTab: 'CALISANLAR',
    futureTradeHooks: ['SERVICE_REVENUE'],
  },

  // --- 5. YAŞAM VE HİZMET BÖLGESİ BLOKLARI ---
  {
    id: 'urban-yasam-konut-17',
    districtId: 'YASAM_HIZMET_BOLGESI',
    nameTR: 'Çamlıca Park Rezidans & Konutları',
    shortTagTR: 'Konut Blok A',
    category: 'RESIDENTIAL_APARTMENT',
    x: 585,
    y: 465,
    width: 106,
    height: 92,
    floors: 3,
    zIndex: 27,
    roofColorClass: 'bg-orange-500 border-orange-700',
    frontColorClass: 'bg-amber-50 border-orange-300',
    sideColorClass: 'bg-orange-100 border-orange-300',
    accentColorClass: 'bg-amber-300',
    linkedBuildingId: 'OYUNCU_OFISI',
    futureTradeHooks: ['CUSTOMER_DEMAND'],
  },
  {
    id: 'urban-yasam-konut-18',
    districtId: 'YASAM_HIZMET_BOLGESI',
    nameTR: 'Borsa Meydan Teras Evleri',
    shortTagTR: 'Konut Blok B',
    category: 'RESIDENTIAL_APARTMENT',
    x: 1005,
    y: 465,
    width: 106,
    height: 92,
    floors: 3,
    zIndex: 27,
    roofColorClass: 'bg-rose-500 border-rose-700',
    frontColorClass: 'bg-stone-50 border-rose-300',
    sideColorClass: 'bg-rose-100 border-rose-300',
    accentColorClass: 'bg-amber-300',
    linkedBuildingId: 'OYUNCU_OFISI',
    futureTradeHooks: ['CUSTOMER_DEMAND'],
  },
  {
    id: 'urban-yasam-saglik-19',
    districtId: 'YASAM_HIZMET_BOLGESI',
    nameTR: 'Şehir Polikliniği ve Sağlık Merkezi',
    shortTagTR: 'Sağlık Mrk.',
    category: 'CITY_HOSPITAL',
    x: 585,
    y: 705,
    width: 108,
    height: 90,
    floors: 2,
    zIndex: 37,
    roofColorClass: 'bg-red-500 border-red-700',
    frontColorClass: 'bg-white border-red-300',
    sideColorClass: 'bg-red-50 border-red-200',
    accentColorClass: 'bg-red-500',
    linkedBuildingId: 'HABER_MERKEZI',
    futureTradeHooks: ['SERVICE_REVENUE'],
  },
  {
    id: 'urban-yasam-belediye-20',
    districtId: 'YASAM_HIZMET_BOLGESI',
    nameTR: 'Bölge Belediyesi ve Kamu Hizmet Binası',
    shortTagTR: 'Belediye',
    category: 'MUNICIPAL_HALL',
    x: 1005,
    y: 705,
    width: 112,
    height: 92,
    floors: 2,
    zIndex: 37,
    roofColorClass: 'bg-emerald-600 border-emerald-800',
    frontColorClass: 'bg-stone-50 border-emerald-300',
    sideColorClass: 'bg-emerald-100 border-emerald-300',
    accentColorClass: 'bg-amber-400',
    linkedBuildingId: 'HABER_MERKEZI',
    futureTradeHooks: ['SERVICE_REVENUE'],
  },

  // --- 6. KİLİTLİ GENİŞLEME ALANLARI PARSELLERİ ---
  {
    id: 'urban-genisleme-kuzeybati-21',
    districtId: 'KILITLI_GENISLEME_ALANLARI',
    nameTR: 'Kuzeybatı Lojistik ve Ticaret Genişleme Parseli',
    shortTagTR: 'Kuzey Parsel',
    category: 'LOCKED_EXPANSION_PARCEL',
    x: 145,
    y: 175,
    width: 124,
    height: 88,
    floors: 2,
    zIndex: 16,
    roofColorClass: 'bg-slate-500 border-slate-700',
    frontColorClass: 'bg-slate-100 border-slate-300',
    sideColorClass: 'bg-slate-200 border-slate-400',
    accentColorClass: 'bg-amber-400',
    linkedBuildingId: 'HOLDING_MERKEZI',
    futureTradeHooks: ['TRADE_CONTRACT', 'WHOLESALE'],
  },
  {
    id: 'urban-genisleme-guneydogu-22',
    districtId: 'KILITLI_GENISLEME_ALANLARI',
    nameTR: 'Güneydoğu Holding Serbest Bölge Parseli',
    shortTagTR: 'Serbest Bölge',
    category: 'LOCKED_EXPANSION_PARCEL',
    x: 1465,
    y: 1045,
    width: 128,
    height: 92,
    floors: 2,
    zIndex: 54,
    roofColorClass: 'bg-slate-600 border-slate-800',
    frontColorClass: 'bg-slate-100 border-slate-300',
    sideColorClass: 'bg-slate-200 border-slate-400',
    accentColorClass: 'bg-amber-400',
    linkedBuildingId: 'HOLDING_MERKEZI',
    futureTradeHooks: ['TRADE_CONTRACT', 'DELIVERY'],
  },
];

export function deriveCityUrbanBlocks(
  state: SimulationState
): CityUrbanBlockNode[] {
  const districts = deriveCityDistricts(state);
  const unlockedMap = new Map<CityDistrictId, boolean>();
  for (const d of districts) {
    unlockedMap.set(d.id, d.isUnlocked);
  }

  const shops = state.tradeState?.shops ?? [];
  const warehouses = state.tradeState?.warehouses ?? [];
  const vehicles = state.tradeState?.vehicles ?? [];
  const inTransitCount =
    state.tradeState?.shipments?.filter((s) => s.status === 'IN_TRANSIT')
      .length ?? 0;
  const activeOrdersCount =
    state.tradeState?.procurementOrders?.filter(
      (o) =>
        o.status === 'APPROVED' ||
        o.status === 'PREPARING' ||
        o.status === 'IN_TRANSIT'
    ).length ?? 0;

  return STATIC_CITY_URBAN_BLOCKS.map((item) => {
    const districtUnlocked = unlockedMap.get(item.districtId) ?? true;

    if (item.id === 'urban-ticaret-magaza-1') {
      const shop = shops[0];
      const totalStock = shop
        ? shop.inventoryBatches.reduce((sum, b) => sum + b.availableQuantity, 0)
        : 0;
      return {
        ...item,
        isUnlocked: true,
        level: shop ? shop.level : 1,
        floors: shop ? Math.min(4, 1 + Math.floor(shop.level / 2)) : item.floors,
        shortTagTR: shop ? `${shop.nameTR.slice(0, 12)} Sv.${shop.level}` : 'Dükkân Aç',
        statusClassification: 'ACTIVE',
        activeShopId: shop?.shopId,
        activeShopType: shop?.shopType,
        stockWarning: shop ? totalStock <= 0 || shop.todayUnmetCustomerDemand > 0 : false,
        pendingDeliveryCount: shop ? shop.pendingDeliveriesCount : 0,
        todayRevenue: shop ? shop.todaySalesRevenue : 0,
        hasStockToSell: shop ? totalStock > 0 : false,
        statusSummaryTR: shop
          ? `Aktif Şube · Sv.${shop.level} · Stok ${totalStock} br · Kasa ₺${Math.round(shop.cashAccountBalance).toLocaleString('tr-TR')}`
          : 'İlk Dükkân Açılışına Hazır (Min. ₺35.000 Kurulum)',
      };
    }

    if (item.id === 'urban-ticaret-kafe-2') {
      const shop = shops[1];
      const totalStock = shop
        ? shop.inventoryBatches.reduce((sum, b) => sum + b.availableQuantity, 0)
        : 0;
      return {
        ...item,
        isUnlocked: true,
        level: shop ? shop.level : 1,
        floors: shop ? Math.min(4, 1 + Math.floor(shop.level / 2)) : item.floors,
        shortTagTR: shop ? `${shop.nameTR.slice(0, 12)} Sv.${shop.level}` : 'Kafe & Şube',
        statusClassification: 'ACTIVE',
        activeShopId: shop?.shopId,
        activeShopType: shop?.shopType,
        stockWarning: shop ? totalStock <= 0 || shop.todayUnmetCustomerDemand > 0 : false,
        pendingDeliveryCount: shop ? shop.pendingDeliveriesCount : 0,
        todayRevenue: shop ? shop.todaySalesRevenue : 0,
        hasStockToSell: shop ? totalStock > 0 : false,
        statusSummaryTR: shop
          ? `Aktif Şube · Sv.${shop.level} · Stok ${totalStock} br · Memnuniyet %${Math.round(shop.customerSatisfaction)}`
          : 'Yeni Şube / Kafe Açılışına Açık',
      };
    }

    if (item.id === 'urban-ticaret-merkezi-3') {
      return {
        ...item,
        isUnlocked: true,
        level: Math.min(5, 1 + Math.floor(shops.length / 2) + (state.playerCompany ? 1 : 0)),
        statusClassification: 'ACTIVE',
        pendingDeliveryCount: inTransitCount,
        statusSummaryTR: `Ticaret Merkezi · ${activeOrdersCount} Aktif Sipariş · ${inTransitCount} Sevkiyat`,
      };
    }

    if (item.id === 'urban-ticaret-toptanci-4') {
      return {
        ...item,
        isUnlocked: true,
        level: Math.min(5, 1 + (activeOrdersCount > 0 ? 1 : 0) + (shops.length >= 2 ? 1 : 0)),
        statusClassification: 'ACTIVE',
        pendingDeliveryCount: activeOrdersCount,
        statusSummaryTR: 'Tedarik Ofisi & 10 Toptancı Tedarikçi',
      };
    }

    if (item.id === 'urban-ticaret-otel-5') {
      const shop = shops[2];
      const totalStock = shop
        ? shop.inventoryBatches.reduce((sum, b) => sum + b.availableQuantity, 0)
        : 0;
      return {
        ...item,
        isUnlocked: true,
        level: shop ? shop.level : 2,
        statusClassification: 'ACTIVE',
        activeShopId: shop?.shopId,
        activeShopType: shop?.shopType,
        stockWarning: shop ? totalStock <= 0 || shop.todayUnmetCustomerDemand > 0 : false,
        pendingDeliveryCount: shop ? shop.pendingDeliveriesCount : 0,
        todayRevenue: shop ? shop.todaySalesRevenue : 0,
        hasStockToSell: shop ? totalStock > 0 : false,
        shortTagTR: shop ? `${shop.nameTR.slice(0, 12)} Sv.${shop.level}` : item.shortTagTR,
        statusSummaryTR: shop
          ? `3. Şube Aktif · Sv.${shop.level} · Stok ${totalStock} br`
          : 'Ticari Müşteri & 3. Şube Mağaza Noktası',
      };
    }

    if (item.id === 'urban-ticaret-depo-link-6' || item.id === 'urban-sanayi-depo-9') {
      const totalUsed = warehouses.reduce((s, w) => s + w.usedCapacityUnits, 0);
      const totalCap = warehouses.reduce((s, w) => s + w.maxCapacityUnits, 0);
      const isBlockUnlocked =
        item.id === 'urban-ticaret-depo-link-6' ? true : districtUnlocked;
      return {
        ...item,
        isUnlocked: isBlockUnlocked,
        level: Math.min(5, 1 + Math.floor(totalUsed / 120)),
        statusClassification: isBlockUnlocked ? 'ACTIVE' : 'LOCKED',
        pendingDeliveryCount: inTransitCount,
        statusSummaryTR: `Merkezi Depo: ${Math.round(totalUsed)}/${totalCap} br`,
        unlockConditionTR: 'Şirket kurulumu veya Esnaf Şirketleşmesi ile açılır',
        unlockStageLabelTR: 'Aşama 2 · Kurumsal Şirket',
        requiredCapitalTR: '₺350.000 İşletme Değeri veya ₺2.000.000 Net Varlık',
      };
    }

    if (item.id === 'urban-sanayi-lojistik-10') {
      const isLojistikUnlocked =
        districtUnlocked || vehicles.length > 0 || shops.length > 0;
      return {
        ...item,
        isUnlocked: isLojistikUnlocked,
        level: Math.min(5, Math.max(1, vehicles.length || 1)),
        statusClassification: isLojistikUnlocked ? 'ACTIVE' : 'LOCKED',
        pendingDeliveryCount: inTransitCount,
        statusSummaryTR: `Lojistik Saha · ${vehicles.length} Araç · ${inTransitCount} Sevkiyat`,
        unlockConditionTR: 'İlk dükkân veya şirket kurulumu ile açılır',
        unlockStageLabelTR: 'Aşama 1 · İlk Dükkân veya Aşama 2',
        requiredCapitalTR: '₺35.000+ İlk İşletme Sermayesi',
      };
    }

    if (
      item.category === 'RESIDENTIAL_APARTMENT' ||
      item.category === 'CITY_HOSPITAL' ||
      item.category === 'MUNICIPAL_HALL'
    ) {
      return {
        ...item,
        isUnlocked: districtUnlocked,
        level: 2,
        statusClassification: 'DECORATIVE',
        statusSummaryTR: 'Dekoratif Şehir Yapısı · Bölgesel Müşteri Talebi ve Yaşam Alanı',
      };
    }

    if (item.category === 'LOCKED_EXPANSION_PARCEL') {
      return {
        ...item,
        isUnlocked: districtUnlocked,
        level: districtUnlocked ? 3 : 1,
        statusClassification: districtUnlocked ? 'ACTIVE' : 'LOCKED',
        statusSummaryTR: districtUnlocked
          ? 'Holding Genişleme ve Serbest Ticaret Parseli Aktif'
          : 'Kilitli Holding ve Bölgelerarası Ticaret Parseli',
        unlockConditionTR:
          'Holding aşaması, 40+ çalışan veya 5.000.000 TL net varlık ile açılır',
        unlockStageLabelTR: 'Aşama 4 · Holding & Genişleme',
        requiredCapitalTR: '₺5.000.000 Net Varlık',
      };
    }

    return {
      ...item,
      isUnlocked: districtUnlocked,
      level: districtUnlocked ? 2 : 1,
      statusClassification: districtUnlocked ? 'ACTIVE' : 'LOCKED',
      statusSummaryTR: districtUnlocked
        ? `${item.nameTR} · Aktif Kurumsal Yapı`
        : `${item.nameTR} · Kilitli`,
      unlockConditionTR: districtUnlocked
        ? undefined
        : 'Şirket kurulumu veya 2.000.000 TL net varlık ile açılır',
      unlockStageLabelTR: 'Aşama 2 · Şirket Kurulumu',
      requiredCapitalTR: '₺2.000.000 Net Varlık veya Esnaf Şirketleşmesi',
    };
  });
}

/**
 * Oyun saatine (0..23) göre gün/gece atmosfer fazını deterministik olarak döndürür.
 * - 00:00–05:59 -> NIGHT
 * - 06:00–08:59 -> MORNING
 * - 09:00–17:59 -> DAY
 * - 18:00–20:59 -> EVENING
 * - 21:00–23:59 -> NIGHT
 */
export function deriveTimeOfDayPhase(gameHour: number): TimeOfDayPhase {
  const normalizedHour = ((Math.floor(gameHour) % 24) + 24) % 24;
  if (normalizedHour >= 0 && normalizedHour <= 5) {
    return 'NIGHT';
  }
  if (normalizedHour >= 6 && normalizedHour <= 8) {
    return 'MORNING';
  }
  if (normalizedHour >= 9 && normalizedHour <= 17) {
    return 'DAY';
  }
  if (normalizedHour >= 18 && normalizedHour <= 20) {
    return 'EVENING';
  }
  return 'NIGHT';
}

/**
 * Oyun saatine göre gökyüzü, zemin, gölge uzunluğu, sokak lambası ve pencere aydınlatma kurallarını üretir.
 */
export function deriveCityAtmosphere(gameHour: number): CityAtmosphereTheme {
  const phase = deriveTimeOfDayPhase(gameHour);
  switch (phase) {
    case 'MORNING':
      return {
        phase: 'MORNING',
        labelTR: 'Sabah · Açık Pastel Gökyüzü',
        skySurfaceClass:
          'from-sky-100 via-amber-50/70 to-emerald-50/80 text-slate-900',
        groundTintClass: 'bg-[#a3d36e]',
        plazaSurfaceClass: 'bg-amber-50/90 border-amber-200/80',
        streetLightsOn: false,
        windowsLitRatio: 0.15,
        shadowOffsetX: -18,
        shadowOffsetY: 12,
        shadowOpacity: 0.18,
      };
    case 'DAY':
      return {
        phase: 'DAY',
        labelTR: 'Gündüz · Canlı Finans Mahallesi',
        skySurfaceClass:
          'from-sky-100/90 via-slate-50 to-emerald-50/75 text-slate-900',
        groundTintClass: 'bg-[#8ac84a]',
        plazaSurfaceClass: 'bg-white/95 border-slate-200',
        streetLightsOn: false,
        windowsLitRatio: 0.0,
        shadowOffsetX: 10,
        shadowOffsetY: 10,
        shadowOpacity: 0.15,
      };
    case 'EVENING':
      return {
        phase: 'EVENING',
        labelTR: 'Akşam · Gün Batımı & Seans Sonrası',
        skySurfaceClass:
          'from-amber-100/80 via-rose-100/60 to-indigo-100/80 text-slate-900',
        groundTintClass: 'bg-[#7aa85a]',
        plazaSurfaceClass: 'bg-amber-50/85 border-amber-200/70',
        streetLightsOn: true,
        windowsLitRatio: 0.55,
        shadowOffsetX: 20,
        shadowOffsetY: 14,
        shadowOpacity: 0.22,
      };
    case 'NIGHT':
    default:
      return {
        phase: 'NIGHT',
        labelTR: 'Gece · Sokak Işıkları Açık',
        skySurfaceClass:
          'from-[#1e293b] via-[#26354d] to-[#334155] text-slate-100',
        groundTintClass: 'bg-[#2c4636]',
        plazaSurfaceClass: 'bg-slate-800/90 border-slate-600/80',
        streetLightsOn: true,
        windowsLitRatio: 0.75,
        shadowOffsetX: 8,
        shadowOffsetY: 10,
        shadowOpacity: 0.32,
      };
  }
}

/**
 * Yakınlaştırma (zoom) seviyesine ve ekran genişliğine göre ölçek katsayısını döndürür.
 */
export function getZoomScale(
  zoomPreset: CityZoomPreset,
  viewportWidth: number
): number {
  const isMobile = viewportWidth < 640;
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024;

  const baseScale = isMobile ? 0.42 : isTablet ? 0.56 : 0.68;

  switch (zoomPreset) {
    case 'CLOSER':
      return Number((baseScale * 1.24).toFixed(3));
    case 'OVERVIEW':
      return Number((baseScale * 0.84).toFixed(3));
    case 'NORMAL':
    default:
      return Number(baseScale.toFixed(3));
  }
}

/**
 * Kamera sürükleme (pan) değerlerini mahalle sınırları içinde tutar.
 * Oyuncu harita dışındaki boş alana sürükleyemez.
 */
export function clampCameraPan(
  panX: number,
  panY: number,
  zoomPreset: CityZoomPreset,
  viewportWidth: number = 390,
  viewportHeight: number = 560
): { panX: number; panY: number } {
  const scale = getZoomScale(zoomPreset, viewportWidth);
  const scaledMapW = VIRTUAL_MAP_WIDTH * scale;
  const scaledMapH = VIRTUAL_MAP_HEIGHT * scale;

  const maxPanX = Math.max(
    90,
    Math.round((scaledMapW - viewportWidth * 0.55) / 2)
  );
  const maxPanY = Math.max(
    80,
    Math.round((scaledMapH - viewportHeight * 0.55) / 2)
  );

  const clampedX = Math.max(-maxPanX, Math.min(maxPanX, Math.round(panX)));
  const clampedY = Math.max(-maxPanY, Math.min(maxPanY, Math.round(panY)));

  return { panX: clampedX, panY: clampedY };
}

/**
 * Bir binaya dokunulduğunda kameranın o binaya hafifçe odaklanması için hedef pan değerini hesaplar.
 */
export function getCameraFocusPanForBuilding(
  buildingId: CityBuildingId,
  zoomPreset: CityZoomPreset,
  viewportWidth: number = 390,
  viewportHeight: number = 560
): { panX: number; panY: number } {
  const coords = CITY_BUILDING_COORDINATES[buildingId];
  const scale = getZoomScale(zoomPreset, viewportWidth);
  const rawPanX = (VIRTUAL_MAP_CENTER_X - coords.x) * scale * 0.35;
  const rawPanY = (VIRTUAL_MAP_CENTER_Y - coords.y) * scale * 0.35;
  return clampCameraPan(
    rawPanX,
    rawPanY,
    zoomPreset,
    viewportWidth,
    viewportHeight
  );
}

/**
 * Bina pencereleri için deterministik tanım kimlikleri üretir:
 * örn. "window-borsa-floor-1-col-1"
 */
export function buildDeterministicBuildingWindows(
  buildingId: CityBuildingId,
  level: number,
  isUnlocked: boolean,
  windowsLitRatio: number
): BuildingWindowSlot[] {
  const floors = level >= 3 ? 3 : 2;
  const cols = 2;
  const total = floors * cols;
  const litThreshold = Math.round(total * windowsLitRatio);
  const slug = buildingId.toLowerCase();

  const slots: BuildingWindowSlot[] = [];
  let idx = 0;
  for (let floor = 1; floor <= floors; floor++) {
    for (let col = 1; col <= cols; col++) {
      slots.push({
        id: `window-${slug}-floor-${floor}-col-${col}`,
        floor,
        col,
        isLit: isUnlocked && idx < litThreshold,
      });
      idx += 1;
    }
  }
  return slots;
}

/**
 * Borsa binası için kompakt durum ışığı bilgisini döndürür (Bölüm 5):
 * - Yeşil ışık = Borsa açık (MARKET_OPEN)
 * - Mavi ışık = Açılış bekleniyor (PRE_OPEN)
 * - Turuncu ışık = Seans sonrası (AFTER_HOURS)
 * - Gri ışık = Kapalı (MARKET_CLOSED)
 */
export function deriveBorsaStatusLight(marketSession: MarketSession): {
  lightColor: 'emerald' | 'sky' | 'amber' | 'slate';
  shortLabelTR: string;
} {
  switch (marketSession) {
    case 'MARKET_OPEN':
      return { lightColor: 'emerald', shortLabelTR: 'Açık' };
    case 'PRE_OPEN':
      return { lightColor: 'sky', shortLabelTR: 'Açılış Bekleniyor' };
    case 'AFTER_HOURS':
      return { lightColor: 'amber', shortLabelTR: 'Seans Sonrası' };
    case 'MARKET_CLOSED':
    default:
      return { lightColor: 'slate', shortLabelTR: 'Kapalı' };
  }
}

/**
 * Her ana bina için en az 3 görsel seviye (Seviye 1: Küçük/Başlangıç, Seviye 2: Orta/Gelişmiş, Seviye 3+: Büyük/Prestijli)
 * mimari özelliklerini aynı parsel koordinatı üzerinde üretir (Bölüm 13).
 */
export function deriveBuildingVisualLevelSpec(
  buildingId: CityBuildingId,
  level: number
): BuildingVisualLevelSpec {
  const normalizedLevel = Math.max(1, Math.min(5, Math.floor(level)));
  const tierIndex: 1 | 2 | 3 =
    normalizedLevel >= 3 ? 3 : normalizedLevel === 2 ? 2 : 1;

  const baseHeight =
    buildingId === 'HOLDING_MERKEZI'
      ? 80
      : buildingId === 'BORSA'
      ? 74
      : 62;
  const facadeHeightPx =
    baseHeight + tierIndex * 11 + Math.max(0, normalizedLevel - 3) * 7;

  let rooftopFeatureType: BuildingVisualLevelSpec['rooftopFeatureType'] =
    'NONE';
  if (buildingId === 'BORSA') rooftopFeatureType = 'TICKER_DOME';
  else if (buildingId === 'BANKA') rooftopFeatureType = 'GOLD_VAULT_CREST';
  else if (buildingId === 'HABER_MERKEZI')
    rooftopFeatureType = 'SATELLITE_TOWER';
  else if (buildingId === 'SIRKET_MERKEZI')
    rooftopFeatureType = 'CORPORATE_SPIRE';
  else if (buildingId === 'FABRIKA') rooftopFeatureType = 'TWIN_CHIMNEY_SILO';
  else if (buildingId === 'ARGE_MERKEZI')
    rooftopFeatureType = 'GLASS_LAB_DOME';
  else if (buildingId === 'HOLDING_MERKEZI')
    rooftopFeatureType = 'HELIPAD_CROWN';

  const tierLabelTR =
    normalizedLevel === 5
      ? 'Bayrak Gemisi Kompleks (Sv.5)'
      : normalizedLevel === 4
      ? 'Kurumsal Merkez (Sv.4)'
      : tierIndex === 3
      ? 'Prestij Kompleksi (Sv.3+)'
      : tierIndex === 2
      ? 'Gelişmiş Yapı (Sv.2)'
      : 'Başlangıç Yapısı (Sv.1)';

  return {
    level: normalizedLevel,
    tierIndex,
    tierLabelTR,
    floors: Math.min(5, 1 + normalizedLevel),
    facadeHeightPx,
    hasSideWing: tierIndex >= 2,
    hasPrestigeCrown: tierIndex >= 3,
    hasRooftopFeature: tierIndex >= 2,
    rooftopFeatureType,
  };
}

/**
 * Aktif yatırım projelerinden (investmentProjects) binanın inşaat aşamasını türetir (Bölüm 15):
 * 1. Aşama (PARCEL_PREP): Parsel hazırlığı ve temel alanı
 * 2. Aşama (FOUNDATION_SCAFFOLD): Temel, iskele ve vinç
 * 3. Aşama (NEAR_COMPLETION): Yükselen bina gövdesi ve tamamlanmaya yakın yapı
 * Tamamlandı (COMPLETED): Tamamlanmış yeni bina veya yeni bina seviyesi
 */
export function deriveBuildingConstructionVisual(
  buildingId: CityBuildingId,
  state: SimulationState
): BuildingConstructionVisualInfo | null {
  const pc = state.playerCompany;
  if (!pc || !Array.isArray(pc.investmentProjects)) {
    return null;
  }

  const matchingProject = pc.investmentProjects.find((proj) => {
    if (proj.status !== 'IN_PROGRESS') return false;
    if (buildingId === 'ARGE_MERKEZI') {
      return proj.packageType === 'CUSTOM_TARGET';
    }
    if (buildingId === 'FABRIKA') {
      return proj.packageType !== 'CUSTOM_TARGET';
    }
    return false;
  });

  if (!matchingProject) {
    return null;
  }

  const totalDays = Math.max(
    1,
    matchingProject.estimatedEndDay - matchingProject.startDay
  );
  const elapsedDays = Math.max(0, state.day - matchingProject.startDay);
  const computedProgress = Math.round((elapsedDays / totalDays) * 100);
  const progressPct = Math.max(
    5,
    Math.min(
      95,
      matchingProject.progressPct > 0
        ? Math.round(matchingProject.progressPct)
        : computedProgress
    )
  );
  const remainingDays = Math.max(
    0,
    matchingProject.estimatedEndDay - state.day
  );

  const stage: ConstructionVisualStage =
    progressPct < 34
      ? 'PARCEL_PREP'
      : progressPct < 75
      ? 'FOUNDATION_SCAFFOLD'
      : 'NEAR_COMPLETION';

  const stageLabelTR =
    stage === 'PARCEL_PREP'
      ? '1. Aşama: Parsel Hazırlığı ve Temel'
      : stage === 'FOUNDATION_SCAFFOLD'
      ? '2. Aşama: Temel, İskele ve Vinç'
      : '3. Aşama: Yükselen Gövde ve Montaj';

  return {
    projectId: matchingProject.projectId,
    projectTitleTR: matchingProject.title,
    stage,
    stageLabelTR,
    progressPct,
    startedDay: matchingProject.startDay,
    estimatedCompletionDay: matchingProject.estimatedEndDay,
    remainingDays,
    hasCrane: stage !== 'PARCEL_PREP',
    hasSafetyBarrier: true,
  };
}

/**
 * Her şehir binasının gerçek sistem ve alt sekme yönlendirmesini belirler (Bölüm 17).
 */
export function resolveCityBuildingNavigation(
  buildingId: CityBuildingId,
  state: SimulationState
): BuildingNavigationTarget {
  const hasCompany = state.playerCompany !== null;
  switch (buildingId) {
    case 'BORSA':
      return {
        buildingId: 'BORSA',
        descriptionTR: 'Borsa, Portföy ve Emir Terminali',
      };
    case 'BANKA':
      return {
        buildingId: 'BANKA',
        bankSubTab: 'TRANSFER',
        companySubTab: 'FINANS',
        descriptionTR: 'Hesaplar, Para Transferi ve Banka Kredileri',
      };
    case 'SIRKET_MERKEZI':
      return {
        buildingId: 'SIRKET_MERKEZI',
        companySubTab: 'OZET',
        descriptionTR: hasCompany
          ? 'Şirket Yönetimi · Özet Sekmesi'
          : 'Yeni Şirket Kurulumu',
      };
    case 'FABRIKA':
      return {
        buildingId: 'FABRIKA',
        companySubTab: 'URETIM',
        descriptionTR: 'Üretim, Kapasite ve Stok Yönetimi',
      };
    case 'ARGE_MERKEZI':
      return {
        buildingId: 'ARGE_MERKEZI',
        companySubTab: 'GELISIM',
        descriptionTR: 'Gelişim ve Ar-Ge Kalite Yatırımları',
      };
    case 'OYUNCU_OFISI':
      return {
        buildingId: 'OYUNCU_OFISI',
        companySubTab: 'CALISANLAR',
        descriptionTR: 'Yatırımcı Ofisi, Portföy ve Çalışan Özeti',
      };
    case 'HOLDING_MERKEZI':
      return {
        buildingId: 'HOLDING_MERKEZI',
        descriptionTR: 'Holding ve Bağlı Şirket (M&A) Yönetimi',
      };
    case 'HABER_MERKEZI':
    default:
      return {
        buildingId: 'HABER_MERKEZI',
        descriptionTR: 'Ekonomik Haberler ve Piyasa Olayları',
      };
  }
}

/**
 * SimulationState üzerinden 8 izometrik binanın görsel seviye, inşaat, tekil birincil durum
 * ve seçim kartı bilgilerini deterministik olarak türetir.
 */
export function deriveIsometricBuildings(
  state: SimulationState,
  ipoEligibility: IPOEligibilityResult,
  formatCurrency: (val: number) => string
): IsometricBuildingNode[] {
  const activeOrdersCount = state.pendingOrders.filter(
    (o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED'
  ).length;
  const recentOrderFilled = state.pendingOrders.some(
    (o) => o.status === 'FILLED' && o.createdDay === state.day
  );
  const portfolioCount = Object.values(state.portfolio).filter(
    (p) => p.shares > 0
  ).length;
  const isMarketOpen = state.marketSession === 'MARKET_OPEN';
  const borsaLight = deriveBorsaStatusLight(state.marketSession);

  const pc = state.playerCompany;
  const hasCompany = pc !== null;
  const isStage2Unlocked = state.stageUnlocks.stage2Entrepreneur || hasCompany;
  const isStage4Unlocked = state.stageUnlocks.stage4Holding;

  const netWorthTargetStage2 = 2_000_000;
  const remainingStage2NetWorth = Math.max(
    0,
    netWorthTargetStage2 - state.netWorth
  );
  const stage2ProgressPct = Math.min(
    100,
    Math.floor((state.netWorth / netWorthTargetStage2) * 100)
  );

  const maxNpcStakePct = state.stocks
    .filter((s) => !s.isPlayerCompany)
    .reduce((max, s) => Math.max(max, s.playerOwnershipPct), 0);
  const holdingUnlockPct = isStage4Unlocked
    ? 100
    : Math.min(99, Math.floor((maxNpcStakePct / 5.0) * 100));

  const todayNewsCount = state.newsFeed.filter(
    (n) => n.day === state.day
  ).length;
  const activeLoansCount = (state.activeLoans ?? []).filter(
    (l) => l.status !== 'PAID_OFF'
  ).length;
  const hasOverdueLoan = (state.activeLoans ?? []).some(
    (l) => l.status === 'DELINQUENT' || l.status === 'DEFAULTED'
  );
  const hasDebtWarning = state.totalDebt > 0 || activeLoansCount > 0;
  const isCompanyCashCritical = Boolean(
    pc && pc.financials.cash < pc.dailyOpex * 2
  );
  const targetStaffCount = pc?.workforcePlan?.targetStaffCount ?? pc?.staffCount ?? 0;
  const isStaffShortage = Boolean(
    pc &&
      ((pc.workforcePlan?.pendingHiresCount ?? 0) > 0 ||
        pc.staffCount < targetStaffCount)
  );
  const isFactoryProducing = Boolean(
    pc && pc.dailyUnitsProduced > 0 && !state.isPaused
  );
  const isRdActive = Boolean(pc && pc.dailyRdBudget > 0 && !state.isPaused);

  const factoryConstruction = deriveBuildingConstructionVisual(
    'FABRIKA',
    state
  );
  const argeConstruction = deriveBuildingConstructionVisual(
    'ARGE_MERKEZI',
    state
  );

  const inventoryUnits =
    pc?.operations?.inventoryUnits ?? pc?.financials.inventoryUnits ?? 0;
  const factoryProductionState: IsometricBuildingNode['visualMeta']['factoryProductionState'] =
    factoryConstruction
      ? 'UNDER_CONSTRUCTION'
      : !hasCompany || pc.dailyUnitsProduced <= 0
      ? 'IDLE'
      : inventoryUnits > pc.productionCapacity * 4
      ? 'HIGH_STOCK'
      : inventoryUnits < Math.max(5, pc.productionCapacity * 0.15)
      ? 'LOW_STOCK'
      : 'PRODUCING';

  const atmosphere = deriveCityAtmosphere(state.currentGameHour);

  const activeShops = state.tradeState?.shops ?? [];
  const inTransitShipmentsCount =
    state.tradeState?.shipments?.filter((s) => s.status === 'IN_TRANSIT')
      .length ?? 0;

  const commonVisualMeta: IsometricBuildingNode['visualMeta'] = {
    hasPlayerCompany: hasCompany,
    companyTicker: pc ? pc.ticker : null,
    companyNameShort: pc ? pc.name.split(' ')[0] : null,
    isPubliclyListed: Boolean(pc?.isPubliclyListed),
    subsidiaryCount: state.controlledSubsidiaries.length,
    hasDebtWarning,
    hasFreshNews: todayNewsCount > 0,
    hasRecentOrderFill: recentOrderFilled,
    isCompanyCashCritical,
    isFactoryProducing,
    isRdActive,
    factoryProductionState,
    borsaLightColor: borsaLight.lightColor,
    activeShopsCount: activeShops.length,
    inTransitShipmentsCount,
  };

  const marketSessionLabelTR =
    state.marketSession === 'MARKET_OPEN'
      ? 'piyasa açık'
      : state.marketSession === 'PRE_OPEN'
      ? 'açılış öncesi'
      : state.marketSession === 'AFTER_HOURS'
      ? 'piyasa seans sonrası'
      : 'piyasa kapalı';

  const borsaLevel = portfolioCount >= 6 ? 5 : portfolioCount >= 4 ? 4 : portfolioCount >= 2 ? 3 : portfolioCount >= 1 ? 2 : 1;
  const maxShopLevel = activeShops.reduce((m, s) => Math.max(m, s.level), 1);
  const ofisLevel = Math.min(5, Math.max(state.stage, activeShops.length > 0 ? Math.max(2, maxShopLevel) : state.stage));
  const bankaLevel =
    activeLoansCount >= 3 ? 4 : activeLoansCount >= 2 ? 3 : state.totalDebt > 0 ? 2 : 1;
  const haberLevel = todayNewsCount >= 2 ? 3 : 2;
  const sirketLevel = hasCompany
    ? pc.isPubliclyListed
      ? 5
      : pc.staffCount >= 60 || pc.productionCapacity >= 220
      ? 4
      : pc.staffCount >= 35 || pc.productionCapacity >= 130
      ? 3
      : 2
    : 1;
  const fabrikaLevel = hasCompany
    ? pc.productionCapacity >= 240
      ? 5
      : pc.productionCapacity >= 150
      ? 4
      : pc.productionCapacity >= 110
      ? 3
      : pc.productionCapacity >= 80
      ? 2
      : 1
    : 1;
  const argeLevel = hasCompany
    ? pc.techQualityMultiplier >= 1.4
      ? 5
      : pc.techQualityMultiplier >= 1.25
      ? 4
      : pc.techQualityMultiplier >= 1.15
      ? 3
      : pc.techQualityMultiplier >= 1.08
      ? 2
      : 1
    : 1;
  const holdingLevel =
    state.stage === SimulationStage.STAGE_4_HOLDING_MONOPOLY
      ? state.controlledSubsidiaries.length >= 2
        ? 5
        : 4
      : isStage4Unlocked
      ? 2
      : 1;

  // Şirket merkezi sorun listesi (harita üstünde tek ikon gösterilir, tam liste seçim kartında yer alır)
  const companyIssues: string[] = [];
  if (hasCompany) {
    if (isCompanyCashCritical) {
      companyIssues.push('Şirket kasası günlük giderlerin 2 katının altında.');
    }
    if (isStaffShortage) {
      companyIssues.push(
        `Planlanan üretim için işçi eksiği var (${pc.staffCount}/${Math.max(targetStaffCount, pc.staffCount + (pc.workforcePlan?.pendingHiresCount ?? 0))}).`
      );
    }
    if (hasOverdueLoan) {
      companyIssues.push('Gecikmiş banka kredi taksiti bulunuyor.');
    }
  }

  const companyPrimaryStatus: BuildingPrimaryStatusType = !isStage2Unlocked
    ? 'LOCKED'
    : !hasCompany
    ? 'PENDING_ACTION'
    : isCompanyCashCritical || hasOverdueLoan
    ? 'CRITICAL'
    : isStaffShortage
    ? 'WARNING'
    : ipoEligibility.eligible && !pc.isPubliclyListed
    ? 'COMPLETED_MILESTONE'
    : 'NORMAL';

  const factoryPrimaryStatus: BuildingPrimaryStatusType = !hasCompany
    ? 'LOCKED'
    : factoryConstruction
    ? 'UNDER_CONSTRUCTION'
    : pc.dailyUnitsProduced <= 0
    ? 'WARNING'
    : 'NORMAL';

  const argePrimaryStatus: BuildingPrimaryStatusType = !hasCompany
    ? 'LOCKED'
    : argeConstruction
    ? 'UNDER_CONSTRUCTION'
    : pc.dailyRdBudget > 0
    ? 'NORMAL'
    : 'PENDING_ACTION';

  const buildSelectionCard = (params: {
    buildingId: CityBuildingId;
    districtId: CityDistrictId;
    districtNameTR: string;
    title: string;
    level: number;
    isUnlocked: boolean;
    shortStatus: string;
    primaryStatusType: BuildingPrimaryStatusType;
    keyMetricLabel: string;
    keyMetricValue: string;
    primaryActionLabel: string;
    issueDetails?: string[];
    constructionInfo?: BuildingConstructionVisualInfo | null;
  }): BuildingSelectionCardInfo => ({
    buildingId: params.buildingId,
    districtId: params.districtId,
    districtNameTR: params.districtNameTR,
    title: params.title,
    level: params.level,
    levelLabelTR: params.isUnlocked ? `Seviye ${params.level}` : 'Kilitli',
    shortStatus: params.shortStatus,
    primaryStatusType: params.primaryStatusType,
    keyMetricLabel: params.keyMetricLabel,
    keyMetricValue: params.keyMetricValue,
    primaryActionLabel: params.primaryActionLabel,
    secondaryDetailLabel: params.isUnlocked ? 'Tam Ekranı Aç' : undefined,
    navigationTarget: resolveCityBuildingNavigation(params.buildingId, state),
    issueDetails: params.issueDetails ?? [],
    constructionInfo: params.constructionInfo ?? null,
  });

  return [
    {
      id: 'BORSA',
      districtId: 'FINANS_BOLGESI',
      shortName: 'Borsa',
      fullTitle: 'Borsa Binası',
      ...CITY_BUILDING_COORDINATES.BORSA,
      zIndex: 22,
      level: borsaLevel,
      visualLevelSpec: deriveBuildingVisualLevelSpec('BORSA', borsaLevel),
      isUnlocked: true,
      isActiveWorking: isMarketOpen,
      shortStatusLabel: isMarketOpen
        ? 'Açık'
        : state.marketSession === 'PRE_OPEN'
        ? 'Hazırlık'
        : state.marketSession === 'AFTER_HOURS'
        ? 'Seans Sonu'
        : 'Kapalı',
      statusTone: isMarketOpen
        ? 'emerald'
        : state.marketSession === 'PRE_OPEN'
        ? 'amber'
        : 'slate',
      primaryStatusType:
        activeOrdersCount > 0
          ? 'PENDING_ACTION'
          : recentOrderFilled
          ? 'COMPLETED_MILESTONE'
          : 'NORMAL',
      badgeCount: activeOrdersCount > 0 ? activeOrdersCount : undefined,
      accessibleLabel: `Borsa Binası, seviye ${borsaLevel}, ${marketSessionLabelTR}, açmak için dokunun`,
      lockedOverlayInfo: null,
      constructionInfo: null,
      selectionCard: buildSelectionCard({
        buildingId: 'BORSA',
        districtId: 'FINANS_BOLGESI',
        districtNameTR: 'Finans Bölgesi',
        title: 'Borsa Binası',
        level: borsaLevel,
        isUnlocked: true,
        shortStatus: borsaLight.shortLabelTR,
        primaryStatusType:
          activeOrdersCount > 0 ? 'PENDING_ACTION' : 'NORMAL',
        keyMetricLabel: 'BIST Endeksi',
        keyMetricValue: `${state.marketIndex.toFixed(0)} Puan`,
        primaryActionLabel: 'Borsa ve Emirleri Aç',
      }),
      windows: buildDeterministicBuildingWindows(
        'BORSA',
        borsaLevel,
        true,
        atmosphere.windowsLitRatio
      ),
      visualMeta: commonVisualMeta,
    },
    {
      id: 'HABER_MERKEZI',
      districtId: 'FINANS_BOLGESI',
      shortName: 'Haber Mrk.',
      fullTitle: 'Haber Merkezi',
      ...CITY_BUILDING_COORDINATES.HABER_MERKEZI,
      zIndex: 24,
      level: haberLevel,
      visualLevelSpec: deriveBuildingVisualLevelSpec(
        'HABER_MERKEZI',
        haberLevel
      ),
      isUnlocked: true,
      isActiveWorking: todayNewsCount > 0,
      shortStatusLabel: todayNewsCount > 0 ? 'Canlı Yayın' : 'Yayında',
      statusTone: todayNewsCount > 0 ? 'amber' : 'sky',
      primaryStatusType: todayNewsCount > 0 ? 'PENDING_ACTION' : 'NORMAL',
      badgeCount: todayNewsCount > 0 ? todayNewsCount : undefined,
      accessibleLabel: `Haber Merkezi, seviye ${haberLevel}, ${todayNewsCount} yeni haber, açmak için dokunun`,
      lockedOverlayInfo: null,
      constructionInfo: null,
      selectionCard: buildSelectionCard({
        buildingId: 'HABER_MERKEZI',
        districtId: 'FINANS_BOLGESI',
        districtNameTR: 'Finans Bölgesi',
        title: 'Haber ve Ekonomi Merkezi',
        level: haberLevel,
        isUnlocked: true,
        shortStatus: todayNewsCount > 0 ? 'Canlı Yayın' : 'Yayında',
        primaryStatusType: todayNewsCount > 0 ? 'PENDING_ACTION' : 'NORMAL',
        keyMetricLabel: 'Bugünkü Haber',
        keyMetricValue: `${todayNewsCount} Başlık`,
        primaryActionLabel: 'Haber Akışını Aç',
      }),
      windows: buildDeterministicBuildingWindows(
        'HABER_MERKEZI',
        haberLevel,
        true,
        atmosphere.windowsLitRatio
      ),
      visualMeta: commonVisualMeta,
    },
    {
      id: 'BANKA',
      districtId: 'FINANS_BOLGESI',
      shortName: 'Merkez Bankası',
      fullTitle: 'Merkez Bankası ve Hazine',
      ...CITY_BUILDING_COORDINATES.BANKA,
      zIndex: 25,
      level: bankaLevel,
      visualLevelSpec: deriveBuildingVisualLevelSpec('BANKA', bankaLevel),
      isUnlocked: true,
      isActiveWorking: true,
      shortStatusLabel: hasDebtWarning ? 'Borç Kaydı' : 'Açık',
      statusTone: hasDebtWarning ? 'amber' : 'violet',
      primaryStatusType: hasOverdueLoan
        ? 'CRITICAL'
        : hasDebtWarning
        ? 'WARNING'
        : 'NORMAL',
      badgeCount: hasDebtWarning ? Math.max(1, activeLoansCount) : undefined,
      accessibleLabel: `Merkez Bankası ve Hazine, seviye ${bankaLevel}, ${
        hasDebtWarning ? 'aktif borç uyarısı var' : 'bilanço dengeli'
      }, açmak için dokunun`,
      lockedOverlayInfo: null,
      constructionInfo: null,
      selectionCard: buildSelectionCard({
        buildingId: 'BANKA',
        districtId: 'FINANS_BOLGESI',
        districtNameTR: 'Finans Bölgesi',
        title: 'Merkez Bankası ve Hazine',
        level: bankaLevel,
        isUnlocked: true,
        shortStatus: hasDebtWarning ? 'Aktif Kredi Var' : 'Hesaplar Dengeli',
        primaryStatusType: hasOverdueLoan
          ? 'CRITICAL'
          : hasDebtWarning
          ? 'WARNING'
          : 'NORMAL',
        keyMetricLabel: 'Toplam Borç',
        keyMetricValue: formatCurrency(state.totalDebt),
        primaryActionLabel: 'Banka ve Transferi Aç',
        issueDetails: hasOverdueLoan
          ? ['Vadesi geçmiş banka kredi taksiti bulunuyor.']
          : [],
      }),
      windows: buildDeterministicBuildingWindows(
        'BANKA',
        bankaLevel,
        true,
        atmosphere.windowsLitRatio
      ),
      visualMeta: commonVisualMeta,
    },
    {
      id: 'OYUNCU_OFISI',
      districtId: 'TICARET_BOLGESI',
      shortName: 'Oyuncu Ofisi',
      fullTitle: 'Oyuncu Ofisi',
      ...CITY_BUILDING_COORDINATES.OYUNCU_OFISI,
      zIndex: 35,
      level: ofisLevel,
      visualLevelSpec: deriveBuildingVisualLevelSpec('OYUNCU_OFISI', ofisLevel),
      isUnlocked: true,
      isActiveWorking: !state.isPaused,
      shortStatusLabel: `Aşama ${state.stage}`,
      statusTone: 'sky',
      primaryStatusType: 'NORMAL',
      badgeCount: portfolioCount > 0 ? portfolioCount : undefined,
      accessibleLabel: `Oyuncu Ofisi, seviye ${ofisLevel}, Aşama ${state.stage} aktif, açmak için dokunun`,
      lockedOverlayInfo: null,
      constructionInfo: null,
      selectionCard: buildSelectionCard({
        buildingId: 'OYUNCU_OFISI',
        districtId: 'TICARET_BOLGESI',
        districtNameTR: 'Ticaret Bölgesi',
        title:
          activeShops.length > 0
            ? `Esnaf & Yatırım Merkezi (${activeShops.length} Şube)`
            : 'Oyuncu, Esnaf ve Yatırım Ofisi',
        level: ofisLevel,
        isUnlocked: true,
        shortStatus:
          activeShops.length > 0
            ? `${activeShops.length} Aktif Dükkân · Aşama ${state.stage}`
            : `Aşama ${state.stage} Aktif · İlk Dükkânı Aç`,
        primaryStatusType: 'NORMAL',
        keyMetricLabel:
          activeShops.length > 0 ? 'Bugünkü Mağaza Cirosu' : 'Portföy Değeri',
        keyMetricValue:
          activeShops.length > 0
            ? formatCurrency(
                activeShops.reduce((s, sh) => s + sh.todaySalesRevenue, 0)
              )
            : formatCurrency(state.portfolioValue),
        primaryActionLabel:
          activeShops.length > 0
            ? 'Dükkân & Ticaret Yönetimini Aç'
            : 'Dükkân Aç & Portföyü Yönet',
      }),
      windows: buildDeterministicBuildingWindows(
        'OYUNCU_OFISI',
        ofisLevel,
        true,
        atmosphere.windowsLitRatio
      ),
      visualMeta: commonVisualMeta,
    },
    {
      id: 'SIRKET_MERKEZI',
      districtId: 'TEKNOLOJI_BOLGESI',
      shortName: hasCompany ? `${pc.ticker} Merkez` : 'Şirket Arsası',
      fullTitle: hasCompany ? `${pc.name} Genel Merkezi` : 'Şirket Arsası',
      ...CITY_BUILDING_COORDINATES.SIRKET_MERKEZI,
      zIndex: 36,
      level: sirketLevel,
      visualLevelSpec: deriveBuildingVisualLevelSpec(
        'SIRKET_MERKEZI',
        sirketLevel
      ),
      isUnlocked: isStage2Unlocked,
      isActiveWorking: hasCompany && !state.isPaused,
      shortStatusLabel: hasCompany
        ? isCompanyCashCritical
          ? 'Nakit Kritik'
          : ipoEligibility.eligible && !pc.isPubliclyListed
          ? 'IPO Hazır'
          : 'Aktif'
        : isStage2Unlocked
        ? 'Kuruluma Hazır'
        : 'Kilitli',
      statusTone: hasCompany
        ? isCompanyCashCritical
          ? 'amber'
          : 'emerald'
        : isStage2Unlocked
        ? 'sky'
        : 'slate',
      primaryStatusType: companyPrimaryStatus,
      accessibleLabel: isStage2Unlocked
        ? `${
            hasCompany ? pc.name : 'Şirket Arsası'
          }, seviye ${sirketLevel}, ${
            hasCompany ? 'faaliyette' : 'şirket kurulumuna açık'
          }, açmak için dokunun`
        : `Şirket Arsası, kilitli, 2.000.000 TL net varlıkta açılır, kalan ${formatCurrency(
            remainingStage2NetWorth
          )}, açmak için dokunun`,
      lockedOverlayInfo: isStage2Unlocked
        ? null
        : {
            buildingId: 'SIRKET_MERKEZI',
            title: 'Şirket Merkezi',
            conditionText: '2.000.000 TL net varlıkta açılır.',
            remainingText: `Kalan: ${formatCurrency(remainingStage2NetWorth)}`,
            progressPct: stage2ProgressPct,
          },
      constructionInfo: null,
      selectionCard: buildSelectionCard({
        buildingId: 'SIRKET_MERKEZI',
        districtId: 'TEKNOLOJI_BOLGESI',
        districtNameTR: 'Teknoloji Bölgesi',
        title: hasCompany ? `${pc.name} Genel Merkezi` : 'Şirket Arsası',
        level: sirketLevel,
        isUnlocked: isStage2Unlocked,
        shortStatus: hasCompany
          ? isCompanyCashCritical
            ? 'Nakit Kritik'
            : 'Aktif'
          : isStage2Unlocked
          ? 'Kuruluma Hazır'
          : 'Kilitli',
        primaryStatusType: companyPrimaryStatus,
        keyMetricLabel: hasCompany ? 'Şirket Kasası' : 'Açılış Koşulu',
        keyMetricValue: hasCompany
          ? formatCurrency(pc.financials.cash)
          : formatCurrency(netWorthTargetStage2),
        primaryActionLabel: hasCompany
          ? 'Şirket Özetini Aç'
          : 'Yeni Şirket Kur',
        issueDetails: companyIssues,
      }),
      windows: buildDeterministicBuildingWindows(
        'SIRKET_MERKEZI',
        sirketLevel,
        isStage2Unlocked,
        atmosphere.windowsLitRatio
      ),
      visualMeta: commonVisualMeta,
    },
    {
      id: 'FABRIKA',
      districtId: 'SANAYI_BOLGESI',
      shortName: 'Fabrika',
      fullTitle: 'Fabrika Bölgesi',
      ...CITY_BUILDING_COORDINATES.FABRIKA,
      zIndex: 48,
      level: fabrikaLevel,
      visualLevelSpec: deriveBuildingVisualLevelSpec('FABRIKA', fabrikaLevel),
      isUnlocked: hasCompany,
      isActiveWorking: isFactoryProducing,
      shortStatusLabel: hasCompany
        ? factoryConstruction
          ? `İnşaat %${factoryConstruction.progressPct}`
          : pc.dailyUnitsProduced > 0
          ? 'Üretimde'
          : 'Hazır'
        : 'Kilitli',
      statusTone: hasCompany ? 'amber' : 'slate',
      primaryStatusType: factoryPrimaryStatus,
      accessibleLabel: hasCompany
        ? `Fabrika Bölgesi, seviye ${fabrikaLevel}, üretim aktif, açmak için dokunun`
        : 'Fabrika Bölgesi, kilitli, Aşama 2 şirket kurulumu ile açılır, açmak için dokunun',
      lockedOverlayInfo: hasCompany
        ? null
        : {
            buildingId: 'FABRIKA',
            title: 'Fabrika Bölgesi',
            conditionText: 'Kendi şirketinizi kurduğunuzda üretime açılır.',
            remainingText: isStage2Unlocked
              ? 'Şirket Arsası üzerinden şirket kurun'
              : `Kalan Net Varlık: ${formatCurrency(remainingStage2NetWorth)}`,
            progressPct: stage2ProgressPct,
          },
      constructionInfo: factoryConstruction,
      selectionCard: buildSelectionCard({
        buildingId: 'FABRIKA',
        districtId: 'SANAYI_BOLGESI',
        districtNameTR: 'Sanayi Bölgesi',
        title: 'Oyuncu Fabrikası ve Üretim Tesisi',
        level: fabrikaLevel,
        isUnlocked: hasCompany,
        shortStatus: hasCompany
          ? factoryConstruction
            ? factoryConstruction.stageLabelTR
            : pc.dailyUnitsProduced > 0
            ? 'Üretim Aktif'
            : 'Üretim Durdu'
          : 'Kilitli',
        primaryStatusType: factoryPrimaryStatus,
        keyMetricLabel: 'Günlük Üretim / Stok',
        keyMetricValue: hasCompany
          ? `${pc.dailyUnitsProduced} br / Stok: ${inventoryUnits} br`
          : 'Şirket Gerekli',
        primaryActionLabel: 'Üretim Ekranını Aç',
        constructionInfo: factoryConstruction,
      }),
      windows: buildDeterministicBuildingWindows(
        'FABRIKA',
        fabrikaLevel,
        hasCompany,
        atmosphere.windowsLitRatio
      ),
      visualMeta: commonVisualMeta,
    },
    {
      id: 'ARGE_MERKEZI',
      districtId: 'TEKNOLOJI_BOLGESI',
      shortName: 'Ar-Ge Mrk.',
      fullTitle: 'Ar-Ge Merkezi',
      ...CITY_BUILDING_COORDINATES.ARGE_MERKEZI,
      zIndex: 50,
      level: argeLevel,
      visualLevelSpec: deriveBuildingVisualLevelSpec('ARGE_MERKEZI', argeLevel),
      isUnlocked: hasCompany,
      isActiveWorking: isRdActive,
      shortStatusLabel: hasCompany
        ? argeConstruction
          ? `Gelişim %${argeConstruction.progressPct}`
          : pc.dailyRdBudget > 0
          ? 'Araştırma'
          : 'Hazır'
        : 'Kilitli',
      statusTone: hasCompany ? 'sky' : 'slate',
      primaryStatusType: argePrimaryStatus,
      accessibleLabel: hasCompany
        ? `Ar-Ge Merkezi, seviye ${argeLevel}, laboratuvar aktif, açmak için dokunun`
        : 'Ar-Ge Merkezi, kilitli, Aşama 2 şirket kurulumu ile açılır, açmak için dokunun',
      lockedOverlayInfo: hasCompany
        ? null
        : {
            buildingId: 'ARGE_MERKEZI',
            title: 'Ar-Ge Merkezi',
            conditionText: 'Kendi şirketinizi kurduğunuzda inovasyona açılır.',
            remainingText: isStage2Unlocked
              ? 'Şirket Arsası üzerinden şirket kurun'
              : `Kalan Net Varlık: ${formatCurrency(remainingStage2NetWorth)}`,
            progressPct: stage2ProgressPct,
          },
      constructionInfo: argeConstruction,
      selectionCard: buildSelectionCard({
        buildingId: 'ARGE_MERKEZI',
        districtId: 'TEKNOLOJI_BOLGESI',
        districtNameTR: 'Teknoloji Bölgesi',
        title: 'Ar-Ge ve Teknoloji Merkezi',
        level: argeLevel,
        isUnlocked: hasCompany,
        shortStatus: hasCompany
          ? argeConstruction
            ? argeConstruction.stageLabelTR
            : pc.dailyRdBudget > 0
            ? 'Araştırma Aktif'
            : 'Hazır'
          : 'Kilitli',
        primaryStatusType: argePrimaryStatus,
        keyMetricLabel: 'Teknoloji Çarpanı',
        keyMetricValue: hasCompany
          ? `${pc.techQualityMultiplier.toFixed(2)}x`
          : '1.00x',
        primaryActionLabel: 'Gelişim ve Ar-Ge Aç',
        constructionInfo: argeConstruction,
      }),
      windows: buildDeterministicBuildingWindows(
        'ARGE_MERKEZI',
        argeLevel,
        hasCompany,
        atmosphere.windowsLitRatio
      ),
      visualMeta: commonVisualMeta,
    },
    {
      id: 'HOLDING_MERKEZI',
      districtId: 'FINANS_BOLGESI',
      shortName: 'Holding',
      fullTitle: 'Holding Merkezi',
      ...CITY_BUILDING_COORDINATES.HOLDING_MERKEZI,
      zIndex: 49,
      level: holdingLevel,
      visualLevelSpec: deriveBuildingVisualLevelSpec(
        'HOLDING_MERKEZI',
        holdingLevel
      ),
      isUnlocked: isStage4Unlocked,
      isActiveWorking:
        state.controlledSubsidiaries.length > 0 && !state.isPaused,
      shortStatusLabel:
        state.controlledSubsidiaries.length > 0
          ? `${state.controlledSubsidiaries.length} İştirak`
          : isStage4Unlocked
          ? 'Açık'
          : 'Kilitli',
      statusTone: isStage4Unlocked ? 'rose' : 'slate',
      primaryStatusType: !isStage4Unlocked
        ? 'LOCKED'
        : state.controlledSubsidiaries.length > 0
        ? 'COMPLETED_MILESTONE'
        : 'NORMAL',
      badgeCount:
        state.controlledSubsidiaries.length > 0
          ? state.controlledSubsidiaries.length
          : undefined,
      accessibleLabel: isStage4Unlocked
        ? `Holding Merkezi, seviye ${holdingLevel}, devralma işlemlerine açık, açmak için dokunun`
        : `Holding Merkezi, kilitli, bir şirkette %5 stratejik pay veya halka arz ile açılır, en yüksek pay %${maxNpcStakePct.toFixed(
            2
          )}, açmak için dokunun`,
      lockedOverlayInfo: isStage4Unlocked
        ? null
        : {
            buildingId: 'HOLDING_MERKEZI',
            title: 'Holding Merkezi',
            conditionText:
              '%5+ stratejik hisse payı veya Halka Arz (IPO) ile açılır.',
            remainingText: `Mevcut En Yüksek Pay: %${maxNpcStakePct.toFixed(
              2
            )} / %5.00`,
            progressPct: holdingUnlockPct,
          },
      constructionInfo: null,
      selectionCard: buildSelectionCard({
        buildingId: 'HOLDING_MERKEZI',
        districtId: 'FINANS_BOLGESI',
        districtNameTR: 'Finans Bölgesi',
        title: 'Holding Kuleleri ve Bağlı Ortaklıklar',
        level: holdingLevel,
        isUnlocked: isStage4Unlocked,
        shortStatus: isStage4Unlocked
          ? `${state.controlledSubsidiaries.length} Bağlı Şirket`
          : 'Kilitli',
        primaryStatusType: !isStage4Unlocked ? 'LOCKED' : 'NORMAL',
        keyMetricLabel: 'Kontrol Edilen İştirak',
        keyMetricValue: `${state.controlledSubsidiaries.length} Şirket`,
        primaryActionLabel: 'Holding Yönetimini Aç',
      }),
      windows: buildDeterministicBuildingWindows(
        'HOLDING_MERKEZI',
        holdingLevel,
        isStage4Unlocked,
        atmosphere.windowsLitRatio
      ),
      visualMeta: commonVisualMeta,
    },
  ];
}

/**
 * Oyun aşamasına göre mahalledeki çevre dekorasyonlarını döndürür.
 * Deterministik tanım ID'leri kullanılır (tree-finance-square-north-1, lamp-main-road-east-2 vb.).
 * Ekonomik state değiştiğinde yeniden hesaplanmaz.
 */
export const STATIC_CITY_DECORATIONS: CityDecorationNode[] = [
  // 1. Merkez Finans Meydanı Anıtı / Çeşmesi (1 adet)
  {
    id: 'monument-finance-square-center-1',
    kind: 'PLAZA_FOUNTAIN',
    x: 795,
    y: 580,
    minStage: 1,
  },

  // 2. Ağaçlar (11 adet deterministik ID'li)
  {
    id: 'tree-finance-square-north-1',
    kind: 'TREE',
    x: 655,
    y: 515,
    minStage: 1,
  },
  {
    id: 'tree-finance-square-north-2',
    kind: 'TREE',
    x: 935,
    y: 515,
    minStage: 1,
  },
  {
    id: 'tree-finance-square-south-1',
    kind: 'PINE_TREE',
    x: 655,
    y: 655,
    minStage: 1,
  },
  {
    id: 'tree-finance-square-south-2',
    kind: 'PINE_TREE',
    x: 935,
    y: 655,
    minStage: 1,
  },
  {
    id: 'tree-west-boulevard-1',
    kind: 'TREE',
    x: 225,
    y: 350,
    minStage: 1,
  },
  {
    id: 'tree-west-boulevard-2',
    kind: 'PINE_TREE',
    x: 475,
    y: 255,
    minStage: 1,
  },
  {
    id: 'tree-east-boulevard-1',
    kind: 'TREE',
    x: 1125,
    y: 255,
    minStage: 1,
  },
  {
    id: 'tree-east-boulevard-2',
    kind: 'PINE_TREE',
    x: 1415,
    y: 250,
    minStage: 1,
  },
  {
    id: 'tree-west-park-1',
    kind: 'TREE',
    x: 455,
    y: 585,
    minStage: 1,
  },
  {
    id: 'tree-south-industrial-1',
    kind: 'TREE',
    x: 565,
    y: 865,
    minStage: 1,
  },
  {
    id: 'tree-east-campus-1',
    kind: 'TREE',
    x: 1440,
    y: 595,
    minStage: 2,
  },

  // 3. Sokak Lambaları (8 adet deterministik ID'li)
  {
    id: 'lamp-main-road-west-1',
    kind: 'STREET_LAMP',
    x: 545,
    y: 375,
    minStage: 1,
  },
  {
    id: 'lamp-main-road-east-1',
    kind: 'STREET_LAMP',
    x: 1035,
    y: 375,
    minStage: 1,
  },
  {
    id: 'lamp-main-road-west-2',
    kind: 'STREET_LAMP',
    x: 545,
    y: 765,
    minStage: 1,
  },
  {
    id: 'lamp-main-road-east-2',
    kind: 'STREET_LAMP',
    x: 1045,
    y: 765,
    minStage: 1,
  },
  {
    id: 'lamp-finance-square-north-1',
    kind: 'STREET_LAMP',
    x: 795,
    y: 430,
    minStage: 1,
  },
  {
    id: 'lamp-finance-square-south-1',
    kind: 'STREET_LAMP',
    x: 795,
    y: 735,
    minStage: 1,
  },
  {
    id: 'lamp-industrial-road-west-1',
    kind: 'STREET_LAMP',
    x: 615,
    y: 875,
    minStage: 1,
  },
  {
    id: 'lamp-industrial-road-east-1',
    kind: 'STREET_LAMP',
    x: 995,
    y: 875,
    minStage: 1,
  },

  // 4. Park Bankları (4 adet)
  {
    id: 'bench-finance-square-west-1',
    kind: 'PARK_BENCH',
    x: 695,
    y: 565,
    minStage: 1,
  },
  {
    id: 'bench-finance-square-east-1',
    kind: 'PARK_BENCH',
    x: 895,
    y: 565,
    minStage: 1,
  },
  {
    id: 'bench-finance-square-north-1',
    kind: 'PARK_BENCH',
    x: 755,
    y: 505,
    minStage: 1,
  },
  {
    id: 'bench-finance-square-south-1',
    kind: 'PARK_BENCH',
    x: 835,
    y: 660,
    minStage: 1,
  },

  // 5. Otobüs Durağı ve Taksi Noktası (2 adet)
  {
    id: 'transit-bus-stop-north-1',
    kind: 'BUS_STOP',
    x: 635,
    y: 355,
    minStage: 1,
    label: 'Borsa Durağı',
  },
  {
    id: 'transit-taxi-stand-south-1',
    kind: 'TAXI_STAND',
    x: 955,
    y: 805,
    minStage: 1,
    label: 'Taksi',
  },

  // 6. Küçük Kafe / Büfe (1 adet)
  {
    id: 'kiosk-plaza-cafe-1',
    kind: 'CAFE_KIOSK',
    x: 645,
    y: 580,
    minStage: 1,
    label: 'Borsa Kafe',
  },

  // 7. Küçük Otopark Alanları (2 adet)
  {
    id: 'parking-office-west-1',
    kind: 'PARKING_LOT',
    x: 455,
    y: 650,
    minStage: 1,
  },
  {
    id: 'parking-company-east-2',
    kind: 'PARKING_LOT',
    x: 1135,
    y: 645,
    minStage: 1,
  },

  // 8. Çiçeklikler (4 adet)
  {
    id: 'flowerbed-plaza-nw-1',
    kind: 'FLOWER_BED',
    x: 735,
    y: 545,
    minStage: 1,
  },
  {
    id: 'flowerbed-plaza-ne-2',
    kind: 'FLOWER_BED',
    x: 855,
    y: 545,
    minStage: 1,
  },
  {
    id: 'flowerbed-plaza-sw-3',
    kind: 'FLOWER_BED',
    x: 735,
    y: 615,
    minStage: 1,
  },
  {
    id: 'flowerbed-plaza-se-4',
    kind: 'FLOWER_BED',
    x: 855,
    y: 615,
    minStage: 1,
  },

  // 9. Yaya Geçitleri (4 adet)
  {
    id: 'crosswalk-plaza-north-1',
    kind: 'CROSSWALK',
    x: 795,
    y: 380,
    minStage: 1,
  },
  {
    id: 'crosswalk-plaza-south-2',
    kind: 'CROSSWALK',
    x: 795,
    y: 780,
    minStage: 1,
  },
  {
    id: 'crosswalk-plaza-west-3',
    kind: 'CROSSWALK',
    x: 510,
    y: 595,
    minStage: 1,
  },
  {
    id: 'crosswalk-plaza-east-4',
    kind: 'CROSSWALK',
    x: 1090,
    y: 595,
    minStage: 1,
  },

  // 10. Şirket ve Sanayi Bölgesi Yön Levhaları (2 adet)
  {
    id: 'sign-finance-square-1',
    kind: 'DIRECTION_SIGN',
    x: 685,
    y: 465,
    minStage: 1,
    label: 'Borsa · Meydan',
  },
  {
    id: 'sign-company-industrial-2',
    kind: 'DIRECTION_SIGN',
    x: 925,
    y: 755,
    minStage: 1,
    label: 'Şirket · Sanayi · Ar-Ge',
  },

  // Aşama 3 IPO Meydan Bayrakları
  {
    id: 'flag-st3-west-1',
    kind: 'STAGE3_FLAG',
    x: 730,
    y: 400,
    minStage: 3,
    label: 'HALKA ARZ',
  },
  {
    id: 'flag-st3-east-2',
    kind: 'STAGE3_FLAG',
    x: 860,
    y: 400,
    minStage: 3,
    label: 'BIST IPO',
  },

  // Aşama 4 Holding Prestij Anıtı
  {
    id: 'monument-st4-holding-1',
    kind: 'STAGE4_MONUMENT',
    x: 1085,
    y: 855,
    minStage: 4,
    label: 'HOLDİNG',
  },
];

/**
 * Oyun aşamasına, grafik kalitesi seviyesine ve şirket üretim durumuna göre ana araç listesini döndürür.
 * - Düşük grafik modunda en fazla 1 araç
 * - Orta grafik modunda en fazla 2 araç
 * - Yüksek grafik modunda en fazla 3 araç
 * - Şirket yokken fabrika kamyonu (DELIVERY_TRUCK) asla görünmez.
 * - Üretim aktifken kamyon rotası (SANAYI_SIRKET_ROTASI üzerinde DELIVERY_TRUCK) etkinleşir.
 */
export function deriveActiveVehicles(
  stage: SimulationStage,
  isPaused: boolean,
  reducedMotion: boolean,
  isPageVisible: boolean,
  graphicsQuality?: GraphicsQualityLevel,
  hasPlayerCompany: boolean = false,
  isProducing: boolean = false
): {
  vehicles: CityVehicleRouteItem[];
  animationsActive: boolean;
} {
  const animationsActive = !isPaused && !reducedMotion && isPageVisible;

  const maxVehicles = graphicsQuality
    ? UISettingsStore.getGraphicsProfile(graphicsQuality).maxVehicles
    : stage >= SimulationStage.STAGE_2_ENTREPRENEUR
    ? 3
    : 2;

  const showFactoryTruck = Boolean(hasPlayerCompany && isProducing);

  const cityCar: CityVehicleRouteItem = {
    id: 'veh-city-car-1',
    vehicleType: 'CITY_CAR',
    routeId: 'FINANS_MEYDANI_ROTASI',
    label: 'Şehir Otomobili',
    colorClass: 'bg-sky-600 border-sky-200',
    durationSec: 18,
    delaySec: 0,
    isFactoryTruck: false,
  };

  const taxiVehicle: CityVehicleRouteItem = {
    id: 'veh-taxi-2',
    vehicleType: 'TAXI',
    routeId: 'FINANS_MEYDANI_ROTASI',
    label: 'Ticari Taksi',
    colorClass: 'bg-amber-400 border-amber-200',
    durationSec: 20,
    delaySec: 6,
    isFactoryTruck: false,
  };

  const shuttleVehicle: CityVehicleRouteItem = {
    id: 'veh-shuttle-3',
    vehicleType: 'COMPANY_SHUTTLE',
    routeId: 'FINANS_MEYDANI_ROTASI',
    label: 'Şirket Servisi',
    colorClass: 'bg-emerald-600 border-emerald-200',
    durationSec: 22,
    delaySec: 11,
    isFactoryTruck: false,
  };

  const factoryTruck: CityVehicleRouteItem = {
    id: 'veh-factory-truck',
    vehicleType: 'DELIVERY_TRUCK',
    routeId: 'SANAYI_SIRKET_ROTASI',
    label: 'Fabrika Lojistik Kamyonu',
    colorClass: 'bg-amber-600 border-amber-300',
    durationSec: 20,
    delaySec: 2,
    isFactoryTruck: true,
  };

  let pool: CityVehicleRouteItem[];
  if (showFactoryTruck) {
    if (maxVehicles === 1) {
      pool = [factoryTruck];
    } else if (maxVehicles === 2) {
      pool = [cityCar, factoryTruck];
    } else {
      pool = [cityCar, taxiVehicle, factoryTruck];
    }
  } else {
    pool = [cityCar, taxiVehicle, shuttleVehicle].slice(0, maxVehicles);
  }

  return {
    vehicles: pool.slice(0, maxVehicles),
    animationsActive,
  };
}

/**
 * Genişletilmiş Çok Rotalı Şehir Trafik Filosu (Bölüm 20):
 * - Araç türleri: Normal araba (CITY_CAR), Taksi (TAXI), Otobüs (BUS), Ticari kamyonet (DELIVERY_VAN),
 *   Sanayi/Üretim kamyonu (DELIVERY_TRUCK), Hizmet aracı (SERVICE_VEHICLE).
 * - Grafik kalitesi limitleri: Düşük = en fazla 6 araç, Orta = en fazla 12 araç, Yüksek = en fazla 18 araç.
 * - Fabrika üretimi veya stok sevkiyatı arttığında sanayi kamyonları ve ticari kamyonetler otomatik artar.
 */
export function deriveCityTrafficFleet(params: {
  stage: SimulationStage;
  isPaused: boolean;
  reducedMotion: boolean;
  isPageVisible: boolean;
  graphicsQuality: GraphicsQualityLevel;
  hasPlayerCompany: boolean;
  isProducing: boolean;
  inventoryUnits?: number;
  inTransitShipmentsCount?: number;
}): {
  vehicles: CityVehicleRouteItem[];
  animationsActive: boolean;
  maxAllowed: number;
} {
  const profile = UISettingsStore.getGraphicsProfile(params.graphicsQuality);
  const animationsActive =
    !params.isPaused && !params.reducedMotion && params.isPageVisible;
  const maxAllowed = profile.maxCityTrafficVehicles; // 6 | 12 | 18
  const hasActiveShipment =
    (params.inTransitShipmentsCount ?? 0) > 0 || params.isProducing;

  const baseVehicles: CityVehicleRouteItem[] = [
    {
      id: 'veh-city-car-1',
      vehicleType: 'CITY_CAR',
      routeId: 'FINANS_MEYDANI_ROTASI',
      label: 'Şehir Otomobili',
      colorClass: 'bg-sky-600 border-sky-200',
      durationSec: 18,
      delaySec: 0,
      isFactoryTruck: false,
    },
    {
      id: 'veh-taxi-2',
      vehicleType: 'TAXI',
      routeId: 'FINANS_MEYDANI_ROTASI',
      label: 'Ticari Taksi',
      colorClass: 'bg-amber-400 border-amber-200',
      durationSec: 20,
      delaySec: 5,
      isFactoryTruck: false,
    },
    {
      id: 'veh-bus-3',
      vehicleType: 'BUS',
      routeId: 'KUZEY_GUNEY_ANAYOL_ROTASI',
      label: 'Şehir İçi Otobüs',
      colorClass: 'bg-emerald-600 border-emerald-200',
      durationSec: 26,
      delaySec: 2,
      isFactoryTruck: false,
    },
    ...(hasActiveShipment
      ? [
          {
            id: 'veh-van-4',
            vehicleType: 'DELIVERY_VAN' as const,
            routeId: 'TICARET_BULVARI_ROTASI' as const,
            label: 'Ticari Dağıtım Kamyoneti',
            colorClass: 'bg-indigo-600 border-indigo-200',
            durationSec: 21,
            delaySec: 4,
            isFactoryTruck: false,
          },
        ]
      : []),
    {
      id: 'veh-service-5',
      vehicleType: 'SERVICE_VEHICLE',
      routeId: 'FINANS_MEYDANI_ROTASI',
      label: 'Belediye & Hizmet Aracı',
      colorClass: 'bg-teal-600 border-teal-200',
      durationSec: 24,
      delaySec: 9,
      isFactoryTruck: false,
    },
    {
      id: 'veh-city-car-6',
      vehicleType: 'CITY_CAR',
      routeId: 'TICARET_BULVARI_ROTASI',
      label: 'Kurumsal Sedan',
      colorClass: 'bg-rose-600 border-rose-200',
      durationSec: 19,
      delaySec: 11,
      isFactoryTruck: false,
    },
    {
      id: 'veh-taxi-7',
      vehicleType: 'TAXI',
      routeId: 'KUZEY_GUNEY_ANAYOL_ROTASI',
      label: 'Meydan Taksi',
      colorClass: 'bg-amber-400 border-amber-200',
      durationSec: 22,
      delaySec: 13,
      isFactoryTruck: false,
    },
    {
      id: 'veh-shuttle-8',
      vehicleType: 'COMPANY_SHUTTLE',
      routeId: 'FINANS_MEYDANI_ROTASI',
      label: 'Personel Servisi',
      colorClass: 'bg-cyan-600 border-cyan-200',
      durationSec: 23,
      delaySec: 15,
      isFactoryTruck: false,
    },
  ];

  const industrialVehicles: CityVehicleRouteItem[] = [];
  if (params.hasPlayerCompany && params.isProducing) {
    industrialVehicles.push({
      id: 'veh-factory-truck',
      vehicleType: 'DELIVERY_TRUCK',
      routeId: 'SANAYI_SIRKET_ROTASI',
      label: 'Fabrika Lojistik Kamyonu #1',
      colorClass: 'bg-amber-600 border-amber-300',
      durationSec: 20,
      delaySec: 2,
      isFactoryTruck: true,
    });
    if ((params.inventoryUnits ?? 0) > 20 || params.stage >= 2) {
      industrialVehicles.push({
        id: 'veh-factory-truck-2',
        vehicleType: 'DELIVERY_TRUCK',
        routeId: 'SANAYI_SIRKET_ROTASI',
        label: 'Fabrika Sevkiyat Kamyonu #2',
        colorClass: 'bg-orange-600 border-orange-300',
        durationSec: 22,
        delaySec: 11,
        isFactoryTruck: true,
      });
    }
  }

  const combined =
    industrialVehicles.length > 0
      ? [
          baseVehicles[0],
          industrialVehicles[0],
          ...baseVehicles.slice(1, 4),
          ...industrialVehicles.slice(1),
          ...baseVehicles.slice(4),
        ]
      : baseVehicles;

  return {
    vehicles: combined.slice(0, maxAllowed),
    animationsActive,
    maxAllowed,
  };
}

/**
 * Grafik kalitesine göre kaldırım ve meydan çevresindeki stilize yayaları döndürür.
 * - Düşük: 0 yaya
 * - Orta: 2 yaya
 * - Yüksek: 4 yaya
 */
export function deriveActivePedestrians(
  isPaused: boolean,
  reducedMotion: boolean,
  isPageVisible: boolean,
  graphicsQuality: GraphicsQualityLevel = 'MEDIUM'
): {
  pedestrians: CityPedestrianNode[];
  animationsActive: boolean;
} {
  const profile = UISettingsStore.getGraphicsProfile(graphicsQuality);
  const animationsActive =
    !isPaused &&
    !reducedMotion &&
    isPageVisible &&
    profile.maxPedestrians > 0;

  const allPedestrians: CityPedestrianNode[] = [
    {
      id: 'ped-plaza-north-1',
      walkwayId: 'PLAZA_NORTH_SIDEWALK',
      label: 'Yatırımcı Yaya',
      coatColorClass: 'bg-sky-700',
      startX: 640,
      startY: 425,
      endX: 940,
      endY: 425,
      durationSec: 24,
      delaySec: 0,
    },
    {
      id: 'ped-plaza-south-2',
      walkwayId: 'PLAZA_SOUTH_SIDEWALK',
      label: 'Finans Çalışanı',
      coatColorClass: 'bg-emerald-700',
      startX: 935,
      startY: 735,
      endX: 645,
      endY: 735,
      durationSec: 26,
      delaySec: 5,
    },
    {
      id: 'ped-sidewalk-west-3',
      walkwayId: 'WEST_BOULEVARD_SIDEWALK',
      label: 'Ofis Ziyaretçisi',
      coatColorClass: 'bg-indigo-700',
      startX: 545,
      startY: 440,
      endX: 545,
      endY: 715,
      durationSec: 22,
      delaySec: 3,
    },
    {
      id: 'ped-sidewalk-east-4',
      walkwayId: 'EAST_BOULEVARD_SIDEWALK',
      label: 'Kurumsal Uzman',
      coatColorClass: 'bg-amber-700',
      startX: 1045,
      startY: 715,
      endX: 1045,
      endY: 440,
      durationSec: 25,
      delaySec: 8,
    },
  ];

  return {
    pedestrians: allPedestrians.slice(0, profile.maxPedestrians),
    animationsActive,
  };
}

/**
 * Geliştirici Görünümü (MathAndSimulationLabView) için şehir tanılama özetini üretir (Bölüm 30).
 */
export function deriveCityDiagnosticsSummary(
  state: SimulationState,
  ipoEligibility: IPOEligibilityResult,
  formatCurrency: (val: number) => string,
  graphicsQuality: GraphicsQualityLevel = 'MEDIUM',
  camera: CityCameraState = { panX: 0, panY: 0, zoomPreset: 'NORMAL' }
): CityDiagnosticsSummary {
  const coreBuildings = deriveIsometricBuildings(
    state,
    ipoEligibility,
    formatCurrency
  );
  const urbanBlocks = deriveCityUrbanBlocks(state);
  const districts = deriveCityDistricts(state);
  const fleet = deriveCityTrafficFleet({
    stage: state.stage,
    isPaused: state.isPaused,
    reducedMotion: false,
    isPageVisible: true,
    graphicsQuality,
    hasPlayerCompany: Boolean(state.playerCompany),
    isProducing: Boolean(
      state.playerCompany && state.playerCompany.dailyUnitsProduced > 0
    ),
    inventoryUnits:
      state.playerCompany?.operations?.inventoryUnits ??
      state.playerCompany?.financials.inventoryUnits ??
      0,
  });
  const pedestrians = deriveActivePedestrians(
    state.isPaused,
    false,
    true,
    graphicsQuality
  );

  const activeConstructionsCount = coreBuildings.filter(
    (b) => b.constructionInfo !== null
  ).length;

  return {
    totalBuildingsCount: coreBuildings.length + urbanBlocks.length,
    coreInteractiveBuildingsCount: coreBuildings.length,
    urbanBlockStructuresCount: urbanBlocks.length,
    unlockedDistrictsCount: districts.filter((d) => d.isUnlocked).length,
    totalDistrictsCount: districts.length,
    activeConstructionsCount,
    activeVehiclesCount: fleet.vehicles.length,
    activePedestriansCount: pedestrians.pedestrians.length,
    graphicsQuality,
    timeOfDayPhase: deriveTimeOfDayPhase(state.currentGameHour),
    cameraState: camera,
    districtStatuses: districts,
    buildingLevels: coreBuildings.map((b) => ({
      id: b.id,
      name: b.fullTitle,
      districtId: b.districtId,
      level: b.level,
      tierIndex: b.visualLevelSpec.tierIndex,
      isUnlocked: b.isUnlocked,
      primaryStatusType: b.primaryStatusType,
      shortStatusLabel: b.shortStatusLabel,
      targetScreen: b.selectionCard.navigationTarget.descriptionTR,
    })),
  };
}
