/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CityBuildingId } from '../gameTypes';
import { GraphicsQualityLevel } from '../../../state/uiSettingsStore';

export type { GraphicsQualityLevel };

export type TimeOfDayPhase = 'NIGHT' | 'MORNING' | 'DAY' | 'EVENING';

export type CityZoomPreset = 'CLOSER' | 'NORMAL' | 'OVERVIEW';

export interface CityCameraState {
  panX: number;
  panY: number;
  zoomPreset: CityZoomPreset;
}

export type CityDistrictId =
  | 'FINANS_BOLGESI'
  | 'TICARET_BOLGESI'
  | 'SANAYI_BOLGESI'
  | 'TEKNOLOJI_BOLGESI'
  | 'YASAM_HIZMET_BOLGESI'
  | 'KILITLI_GENISLEME_ALANLARI';

export type FutureTradeHook =
  | 'SUPPLIER'
  | 'WHOLESALE'
  | 'RETAIL'
  | 'CUSTOMER_DEMAND'
  | 'TRADE_CONTRACT'
  | 'DELIVERY'
  | 'TOURISM'
  | 'SERVICE_REVENUE';

export interface CityDistrictInfo {
  id: CityDistrictId;
  nameTR: string;
  shortNameTR: string;
  descriptionTR: string;
  isUnlocked: boolean;
  unlockConditionTR: string;
  bounds: { x: number; y: number; width: number; height: number };
  buildingCount: number;
}

export type BuildingPrimaryStatusType =
  | 'NORMAL'
  | 'PENDING_ACTION'
  | 'WARNING'
  | 'CRITICAL'
  | 'COMPLETED_MILESTONE'
  | 'UNDER_CONSTRUCTION'
  | 'LOCKED';

export type ConstructionVisualStage =
  | 'PARCEL_PREP'
  | 'FOUNDATION_SCAFFOLD'
  | 'NEAR_COMPLETION'
  | 'COMPLETED';

export interface BuildingConstructionVisualInfo {
  projectId: string;
  projectTitleTR: string;
  stage: ConstructionVisualStage;
  stageLabelTR: string;
  progressPct: number;
  startedDay: number;
  estimatedCompletionDay: number;
  remainingDays: number;
  hasCrane: boolean;
  hasSafetyBarrier: boolean;
}

export type CompanySubTabRoute =
  | 'OZET'
  | 'URETIM'
  | 'CALISANLAR'
  | 'FINANS'
  | 'GELISIM';

export interface BuildingNavigationTarget {
  buildingId: CityBuildingId;
  companySubTab?: CompanySubTabRoute;
  bankSubTab?: 'TRANSFER' | 'LOANS' | 'LEDGER';
  descriptionTR: string;
}

export interface BuildingSelectionCardInfo {
  buildingId: CityBuildingId;
  districtId: CityDistrictId;
  districtNameTR: string;
  title: string;
  level: number;
  levelLabelTR: string;
  shortStatus: string;
  primaryStatusType: BuildingPrimaryStatusType;
  keyMetricLabel: string;
  keyMetricValue: string;
  primaryActionLabel: string;
  secondaryDetailLabel?: string;
  navigationTarget: BuildingNavigationTarget;
  issueDetails: string[];
  constructionInfo: BuildingConstructionVisualInfo | null;
}

export interface LockedBuildingOverlayInfo {
  buildingId: CityBuildingId;
  title: string;
  conditionText: string;
  remainingText: string;
  progressPct: number;
}

export interface BuildingWindowSlot {
  /** Deterministik pencere tanım kimliği: örn. window-borsa-floor-1-col-1 */
  id: string;
  floor: number;
  col: number;
  isLit: boolean;
}

export interface BuildingVisualLevelSpec {
  level: number;
  tierIndex: 1 | 2 | 3; // 1 = Küçük/Başlangıç, 2 = Orta/Gelişmiş, 3 = Büyük/Prestijli
  tierLabelTR: string;
  floors: number;
  facadeHeightPx: number;
  hasSideWing: boolean;
  hasPrestigeCrown: boolean;
  hasRooftopFeature: boolean;
  rooftopFeatureType:
    | 'NONE'
    | 'TICKER_DOME'
    | 'GOLD_VAULT_CREST'
    | 'SATELLITE_TOWER'
    | 'CORPORATE_SPIRE'
    | 'TWIN_CHIMNEY_SILO'
    | 'GLASS_LAB_DOME'
    | 'HELIPAD_CROWN';
}

export interface IsometricBuildingNode {
  id: CityBuildingId;
  districtId: CityDistrictId;
  shortName: string;
  fullTitle: string;
  /** Sanal 1600x1200 harita üzerindeki merkez X koordinatı */
  x: number;
  /** Sanal 1600x1200 harita üzerindeki merkez Y koordinatı */
  y: number;
  /** İzometrik yapı genişliği (tasarım birimi) */
  width: number;
  /** İzometrik yapı yüksekliği (tasarım birimi) */
  height: number;
  /** Derinlik sıralaması (Y koordinatına göre) */
  zIndex: number;
  level: number;
  visualLevelSpec: BuildingVisualLevelSpec;
  isUnlocked: boolean;
  isActiveWorking: boolean;
  /** Harita üzerinde gösterilecek tek kısa durum metni (örn. "Açık", "Kapalı", "Aktif", "Kilitli") */
  shortStatusLabel: string;
  /** Durum ışığı rengi */
  statusTone: 'emerald' | 'amber' | 'sky' | 'slate' | 'rose' | 'violet';
  /** Tek birincil görsel durum tipi */
  primaryStatusType: BuildingPrimaryStatusType;
  /** Bildirim veya uyarı rozeti sayısı */
  badgeCount?: number;
  /** Erişilebilirlik (aria-label) tam açıklaması */
  accessibleLabel: string;
  /** Kilitli binaya dokunulduğunda küçük bilgi balonunda gösterilecek özet */
  lockedOverlayInfo: LockedBuildingOverlayInfo | null;
  /** Seçim bilgi kartı ve gerçek sistem yönlendirme bilgisi */
  selectionCard: BuildingSelectionCardInfo;
  /** Aktif inşaat/kapasite geliştirme aşaması */
  constructionInfo: BuildingConstructionVisualInfo | null;
  /** Deterministik pencere listesi (React key güvenliği için) */
  windows: BuildingWindowSlot[];
  /** Görsel aşama/durum varyant bilgileri */
  visualMeta: {
    hasPlayerCompany: boolean;
    companyTicker: string | null;
    companyNameShort: string | null;
    isPubliclyListed: boolean;
    subsidiaryCount: number;
    hasDebtWarning: boolean;
    hasFreshNews: boolean;
    hasRecentOrderFill: boolean;
    isCompanyCashCritical: boolean;
    isFactoryProducing: boolean;
    isRdActive: boolean;
    factoryProductionState: 'IDLE' | 'PRODUCING' | 'LOW_STOCK' | 'HIGH_STOCK' | 'UNDER_CONSTRUCTION';
    borsaLightColor: 'emerald' | 'sky' | 'amber' | 'slate';
    activeShopsCount?: number;
    inTransitShipmentsCount?: number;
  };
}

export type CityBlockStatusClassification = 'ACTIVE' | 'LOCKED' | 'DECORATIVE';

export interface CityUrbanBlockNode {
  id: string;
  districtId: CityDistrictId;
  nameTR: string;
  shortTagTR: string;
  category:
    | 'COMMERCIAL_SHOP'
    | 'CAFE_RESTAURANT'
    | 'TRADE_CENTER'
    | 'WHOLESALE_DEPOT'
    | 'BOUTIQUE_HOTEL'
    | 'WAREHOUSE_LINK'
    | 'INDUSTRIAL_WAREHOUSE'
    | 'LOGISTICS_YARD'
    | 'ENERGY_SUBSTATION'
    | 'FUTURE_FACTORY_PARCEL'
    | 'TECH_OFFICE'
    | 'INNOVATION_LAB'
    | 'AUTOMATION_HUB'
    | 'TECH_ACADEMY'
    | 'RESIDENTIAL_APARTMENT'
    | 'CITY_HOSPITAL'
    | 'MUNICIPAL_HALL'
    | 'LOCKED_EXPANSION_PARCEL';
  x: number;
  y: number;
  width: number;
  height: number;
  floors: number;
  zIndex: number;
  roofColorClass: string;
  frontColorClass: string;
  sideColorClass: string;
  accentColorClass: string;
  isUnlocked: boolean;
  linkedBuildingId: CityBuildingId;
  linkedCompanySubTab?: CompanySubTabRoute;
  futureTradeHooks: FutureTradeHook[];
  level?: number;
  statusClassification?: CityBlockStatusClassification;
  activeShopId?: string;
  activeShopType?: string;
  statusSummaryTR?: string;
  unlockConditionTR?: string;
  unlockStageLabelTR?: string;
  requiredCapitalTR?: string;
  stockWarning?: boolean;
  pendingDeliveryCount?: number;
  todayRevenue?: number;
  hasStockToSell?: boolean;
}

export interface CityAtmosphereTheme {
  phase: TimeOfDayPhase;
  labelTR: string;
  skySurfaceClass: string;
  groundTintClass: string;
  plazaSurfaceClass: string;
  streetLightsOn: boolean;
  windowsLitRatio: number; // 0..1
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
}

export type CityVehicleType =
  | 'CITY_CAR'
  | 'TAXI'
  | 'COMPANY_SHUTTLE'
  | 'DELIVERY_TRUCK'
  | 'BUS'
  | 'DELIVERY_VAN'
  | 'SERVICE_VEHICLE';

export type CityTrafficRouteId =
  | 'FINANS_MEYDANI_ROTASI'
  | 'SANAYI_SIRKET_ROTASI'
  | 'TICARET_BULVARI_ROTASI'
  | 'KUZEY_GUNEY_ANAYOL_ROTASI';

export interface CityVehicleRouteItem {
  id: string;
  vehicleType: CityVehicleType;
  routeId: CityTrafficRouteId;
  label: string;
  colorClass: string;
  durationSec: number;
  delaySec: number;
  isFactoryTruck: boolean;
}

export interface CityPedestrianNode {
  /** Deterministik yaya kimliği: örn. ped-plaza-north-1 */
  id: string;
  walkwayId:
    | 'PLAZA_NORTH_SIDEWALK'
    | 'PLAZA_SOUTH_SIDEWALK'
    | 'WEST_BOULEVARD_SIDEWALK'
    | 'EAST_BOULEVARD_SIDEWALK';
  label: string;
  coatColorClass: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationSec: number;
  delaySec: number;
}

export interface CityDecorationNode {
  /** Deterministik dekorasyon kimliği: örn. tree-finance-square-north-1, lamp-main-road-east-2 */
  id: string;
  kind:
    | 'TREE'
    | 'PINE_TREE'
    | 'STREET_LAMP'
    | 'PARK_BENCH'
    | 'DIRECTION_SIGN'
    | 'PARKING_LOT'
    | 'PLAZA_FOUNTAIN'
    | 'BUSH'
    | 'STAGE3_FLAG'
    | 'STAGE4_MONUMENT'
    | 'BUS_STOP'
    | 'TAXI_STAND'
    | 'CAFE_KIOSK'
    | 'FLOWER_BED'
    | 'CROSSWALK';
  x: number;
  y: number;
  minStage: number;
  scale?: number;
  label?: string;
}

export interface CityVisualPulseEvent {
  kind:
    | 'MARKET_OPENED_PULSE'
    | 'MARKET_CLOSED_PULSE'
    | 'ORDER_FILLED_FLASH'
    | 'NEW_NEWS_PULSE'
    | 'IPO_CELEBRATION_PULSE'
    | 'HOLDING_UNLOCK_PULSE';
  buildingId: CityBuildingId;
}

export interface CityDiagnosticsSummary {
  totalBuildingsCount: number;
  coreInteractiveBuildingsCount: number;
  urbanBlockStructuresCount: number;
  unlockedDistrictsCount: number;
  totalDistrictsCount: number;
  activeConstructionsCount: number;
  activeVehiclesCount: number;
  activePedestriansCount: number;
  graphicsQuality: GraphicsQualityLevel;
  timeOfDayPhase: TimeOfDayPhase;
  cameraState: CityCameraState;
  districtStatuses: CityDistrictInfo[];
  buildingLevels: Array<{
    id: CityBuildingId;
    name: string;
    districtId: CityDistrictId;
    level: number;
    tierIndex: number;
    isUnlocked: boolean;
    primaryStatusType: BuildingPrimaryStatusType;
    shortStatusLabel: string;
    targetScreen: string;
  }>;
}
