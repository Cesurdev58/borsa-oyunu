/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TİCARET EVRENİ, TEDARİK ZİNCİRİ, DEPO, LOJİSTİK, ESNAF DÜKKÂNLARI VE KARİYER MOTORU (TradeAndShopEngine - v7)
 * - Borsa Yatırımcısı -> İlk Dükkân (Esnaf) -> Çok Şubeli Ticaret -> Şirketleşme -> Fabrika & Dağıtım -> Halka Arz & Holding
 * - Uçtan uca gerçek ticaret zinciri:
 *   Hammadde -> Tedarikçi -> Satın Alma -> Sevkiyat -> Depo -> Üretim -> Mamul Deposu -> Dağıtım -> Mağaza / Kurumsal Müşteri -> Satış -> Tahsilat
 */

import { SECTOR_CONFIGS } from '../data/sectors';
import { PlayerCompany } from '../models/company';
import { SectorId } from '../models/market';
import { SimulationStage, SimulationState } from '../models/simulation';
import {
  CareerStage,
  CommercialContract,
  IncorporationEligibilityResult,
  InventoryBatch,
  LogisticsMode,
  LogisticsRoute,
  LogisticsVehicle,
  LogisticsVehicleType,
  ProcurementOrder,
  ProductionOrder,
  PurchaseContract,
  RecipeDefinition,
  ResourceDefinition,
  SalesChannel,
  Shipment,
  ShopInstance,
  ShopTemplate,
  ShopType,
  Supplier,
  SupplierOffer,
  TradeEvent,
  TradeIntegrityAuditReport,
  TradeInvoice,
  TradePayment,
  TradeSectorId,
  TradeUniverseState,
  Warehouse,
} from '../models/trade';
import { AccountingEngine } from './AccountingEngine';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';
import { CompanyEngine } from './CompanyEngine';
import { RandomEngine } from './RandomEngine';
import { ValuationEngine } from './ValuationEngine';

// ============================================================================
// 1. HAMMADDE, ARA ÜRÜN VE NİHAİ ÜRÜN KATALOĞU (23 Kalem)
// ============================================================================

export const RESOURCE_CATALOG: Record<string, ResourceDefinition> = {
  // --- HAMMADDELER (10 Kalem) ---
  RAW_WHEAT: {
    id: 'RAW_WHEAT',
    nameTR: 'Anadolu Durum Buğdayı',
    category: 'RAW_MATERIAL',
    sector: 'GIDA',
    unitLabel: 'Çuval',
    baseMarketPrice: 120,
    unitWeightKg: 25,
    spoilageRateDaily: 0.005,
    defaultQuality: 78,
    minOrderQty: 10,
  },
  RAW_COFFEE_BEANS: {
    id: 'RAW_COFFEE_BEANS',
    nameTR: 'Kavrulmuş Kahve Çekirdeği & Süt',
    category: 'RAW_MATERIAL',
    sector: 'GIDA',
    unitLabel: 'Paket',
    baseMarketPrice: 240,
    unitWeightKg: 5,
    spoilageRateDaily: 0.015,
    defaultQuality: 84,
    minOrderQty: 10,
  },
  RAW_FRESH_PRODUCE: {
    id: 'RAW_FRESH_PRODUCE',
    nameTR: 'Hal Çıkışlı Taze Meyve & Sebze',
    category: 'RAW_MATERIAL',
    sector: 'GIDA',
    unitLabel: 'Kasa',
    baseMarketPrice: 95,
    unitWeightKg: 15,
    spoilageRateDaily: 0.06,
    defaultQuality: 82,
    minOrderQty: 15,
  },
  RAW_COTTON: {
    id: 'RAW_COTTON',
    nameTR: 'Ege Organik Pamuk Balyası',
    category: 'RAW_MATERIAL',
    sector: 'TEKSTIL',
    unitLabel: 'Balya',
    baseMarketPrice: 310,
    unitWeightKg: 30,
    spoilageRateDaily: 0.001,
    defaultQuality: 80,
    minOrderQty: 10,
  },
  RAW_METAL: {
    id: 'RAW_METAL',
    nameTR: 'Endüstriyel Ham Çelik & Alüminyum',
    category: 'RAW_MATERIAL',
    sector: 'OTOMOTIV',
    unitLabel: 'Blok',
    baseMarketPrice: 680,
    unitWeightKg: 50,
    spoilageRateDaily: 0,
    defaultQuality: 82,
    minOrderQty: 8,
  },
  RAW_ELEC_COMP: {
    id: 'RAW_ELEC_COMP',
    nameTR: 'Yarı İletken & Elektronik Bileşen',
    category: 'RAW_MATERIAL',
    sector: 'ELEKTRONIK',
    unitLabel: 'Kutu',
    baseMarketPrice: 920,
    unitWeightKg: 4,
    spoilageRateDaily: 0.002,
    defaultQuality: 86,
    minOrderQty: 5,
  },
  RAW_PLASTIC: {
    id: 'RAW_PLASTIC',
    nameTR: 'Polimer Granül Plastik',
    category: 'RAW_MATERIAL',
    sector: 'PERAKENDE_GENEL',
    unitLabel: 'Varil',
    baseMarketPrice: 175,
    unitWeightKg: 20,
    spoilageRateDaily: 0,
    defaultQuality: 75,
    minOrderQty: 10,
  },
  RAW_TIMBER: {
    id: 'RAW_TIMBER',
    nameTR: 'Fırınlanmış Kayın & Meşe Kereste',
    category: 'RAW_MATERIAL',
    sector: 'MOBILYA',
    unitLabel: 'Blok',
    baseMarketPrice: 460,
    unitWeightKg: 40,
    spoilageRateDaily: 0.001,
    defaultQuality: 83,
    minOrderQty: 8,
  },
  RAW_PACKAGING: {
    id: 'RAW_PACKAGING',
    nameTR: 'Oluklu Mukavva & Ambalaj Seti',
    category: 'RAW_MATERIAL',
    sector: 'PERAKENDE_GENEL',
    unitLabel: 'Paket',
    baseMarketPrice: 65,
    unitWeightKg: 8,
    spoilageRateDaily: 0,
    defaultQuality: 76,
    minOrderQty: 20,
  },
  RAW_AUTO_PARTS: {
    id: 'RAW_AUTO_PARTS',
    nameTR: 'Motor & Aktarma Organları Kiti',
    category: 'RAW_MATERIAL',
    sector: 'OTOMOTIV',
    unitLabel: 'Set',
    baseMarketPrice: 4_800,
    unitWeightKg: 120,
    spoilageRateDaily: 0,
    defaultQuality: 88,
    minOrderQty: 2,
  },

  // --- ARA ÜRÜNLER (5 Kalem) ---
  INT_FLOUR: {
    id: 'INT_FLOUR',
    nameTR: 'Rafine Un & Fırın Karışımı',
    category: 'INTERMEDIATE_GOOD',
    sector: 'GIDA',
    unitLabel: 'Çuval',
    baseMarketPrice: 195,
    unitWeightKg: 20,
    spoilageRateDaily: 0.004,
    defaultQuality: 82,
    minOrderQty: 10,
  },
  INT_FABRIC: {
    id: 'INT_FABRIC',
    nameTR: 'Dokuma Kumaş Topu',
    category: 'INTERMEDIATE_GOOD',
    sector: 'TEKSTIL',
    unitLabel: 'Top',
    baseMarketPrice: 520,
    unitWeightKg: 18,
    spoilageRateDaily: 0.001,
    defaultQuality: 84,
    minOrderQty: 8,
  },
  INT_PROCESSED_METAL: {
    id: 'INT_PROCESSED_METAL',
    nameTR: 'İşlenmiş Şasi & Metal Profil',
    category: 'INTERMEDIATE_GOOD',
    sector: 'OTOMOTIV',
    unitLabel: 'Adet',
    baseMarketPrice: 1_180,
    unitWeightKg: 45,
    spoilageRateDaily: 0,
    defaultQuality: 85,
    minOrderQty: 5,
  },
  INT_FURNITURE_FRAME: {
    id: 'INT_FURNITURE_FRAME',
    nameTR: 'Ahşap Mobilya İskeleti',
    category: 'INTERMEDIATE_GOOD',
    sector: 'MOBILYA',
    unitLabel: 'Adet',
    baseMarketPrice: 890,
    unitWeightKg: 32,
    spoilageRateDaily: 0.001,
    defaultQuality: 85,
    minOrderQty: 5,
  },
  INT_CIRCUIT_BOARD: {
    id: 'INT_CIRCUIT_BOARD',
    nameTR: 'Dizgili Anakart & PCB Modülü',
    category: 'INTERMEDIATE_GOOD',
    sector: 'ELEKTRONIK',
    unitLabel: 'Adet',
    baseMarketPrice: 1_650,
    unitWeightKg: 2,
    spoilageRateDaily: 0.001,
    defaultQuality: 88,
    minOrderQty: 5,
  },

  // --- NİHAİ PERAKENDE & TOPTAN ÜRÜNLER (8 Kalem) ---
  FIN_PACKAGED_FOOD: {
    id: 'FIN_PACKAGED_FOOD',
    nameTR: 'Paketli Gıda & Atıştırmalık Kolisi',
    category: 'FINISHED_PRODUCT',
    sector: 'GIDA',
    unitLabel: 'Koli',
    baseMarketPrice: 340,
    unitWeightKg: 12,
    spoilageRateDaily: 0.003,
    defaultQuality: 82,
    minOrderQty: 10,
  },
  FIN_FRESH_GROCERY: {
    id: 'FIN_FRESH_GROCERY',
    nameTR: 'Seçme Taze Manav Paketi',
    category: 'FINISHED_PRODUCT',
    sector: 'GIDA',
    unitLabel: 'Kasa',
    baseMarketPrice: 185,
    unitWeightKg: 14,
    spoilageRateDaily: 0.055,
    defaultQuality: 85,
    minOrderQty: 10,
  },
  FIN_ARTISAN_COFFEE: {
    id: 'FIN_ARTISAN_COFFEE',
    nameTR: 'Gurme Kahve & Taze Kruvasan Menü',
    category: 'FINISHED_PRODUCT',
    sector: 'GIDA',
    unitLabel: 'Tepsi',
    baseMarketPrice: 460,
    unitWeightKg: 6,
    spoilageRateDaily: 0.035,
    defaultQuality: 88,
    minOrderQty: 8,
  },
  FIN_APPAREL_SET: {
    id: 'FIN_APPAREL_SET',
    nameTR: 'Sezonluk Hazır Giyim Kreasyonu',
    category: 'FINISHED_PRODUCT',
    sector: 'TEKSTIL',
    unitLabel: 'Askı Seti',
    baseMarketPrice: 980,
    unitWeightKg: 8,
    spoilageRateDaily: 0.001,
    defaultQuality: 86,
    minOrderQty: 6,
  },
  FIN_SMART_DEVICE: {
    id: 'FIN_SMART_DEVICE',
    nameTR: 'Akıllı Telefon & Tablet Seti',
    category: 'FINISHED_PRODUCT',
    sector: 'ELEKTRONIK',
    unitLabel: 'Adet',
    baseMarketPrice: 3_400,
    unitWeightKg: 3,
    spoilageRateDaily: 0.001,
    defaultQuality: 90,
    minOrderQty: 4,
  },
  FIN_HOME_FURNITURE: {
    id: 'FIN_HOME_FURNITURE',
    nameTR: 'Modüler Salon & Ofis Mobilya Takımı',
    category: 'FINISHED_PRODUCT',
    sector: 'MOBILYA',
    unitLabel: 'Takım',
    baseMarketPrice: 2_650,
    unitWeightKg: 65,
    spoilageRateDaily: 0.001,
    defaultQuality: 87,
    minOrderQty: 3,
  },
  FIN_HOUSEHOLD_ESSENTIALS: {
    id: 'FIN_HOUSEHOLD_ESSENTIALS',
    nameTR: 'Market Temizlik & Ev İhtiyaç Paketi',
    category: 'FINISHED_PRODUCT',
    sector: 'PERAKENDE_GENEL',
    unitLabel: 'Koli',
    baseMarketPrice: 420,
    unitWeightKg: 15,
    spoilageRateDaily: 0.001,
    defaultQuality: 80,
    minOrderQty: 10,
  },
  FIN_PASSENGER_CAR: {
    id: 'FIN_PASSENGER_CAR',
    nameTR: 'Şehir İçi Hibrit Binek Otomobil',
    category: 'FINISHED_PRODUCT',
    sector: 'OTOMOTIV',
    unitLabel: 'Araç',
    baseMarketPrice: 14_500,
    unitWeightKg: 1_100,
    spoilageRateDaily: 0,
    defaultQuality: 91,
    minOrderQty: 1,
  },
};

// ============================================================================
// 2. ÇOK ADIMLI ÜRETİM REÇETELERİ (12 Reçete)
// ============================================================================

export const RECIPE_CATALOG: Record<string, RecipeDefinition> = {
  // Ara Ürün Reçeteleri
  REC_INT_FLOUR: {
    recipeId: 'REC_INT_FLOUR',
    nameTR: 'Buğdaydan Rafine Un Üretimi',
    sector: 'GIDA',
    inputs: [{ resourceId: 'RAW_WHEAT', quantityPerUnit: 1.2 }],
    outputResourceId: 'INT_FLOUR',
    outputQuantity: 1,
    machineHoursPerBatch: 1,
    workerCountRequired: 4,
    energyCostPerBatch: 15,
    wasteRatePct: 2,
    qualityMultiplierEffect: 1.04,
  },
  REC_INT_FABRIC: {
    recipeId: 'REC_INT_FABRIC',
    nameTR: 'Pamuktan Dokuma Kumaş Üretimi',
    sector: 'TEKSTIL',
    inputs: [{ resourceId: 'RAW_COTTON', quantityPerUnit: 1.25 }],
    outputResourceId: 'INT_FABRIC',
    outputQuantity: 1,
    machineHoursPerBatch: 1.5,
    workerCountRequired: 6,
    energyCostPerBatch: 28,
    wasteRatePct: 3,
    qualityMultiplierEffect: 1.05,
  },
  REC_INT_PROCESSED_METAL: {
    recipeId: 'REC_INT_PROCESSED_METAL',
    nameTR: 'Ham Metalden İşlenmiş Şasi Üretimi',
    sector: 'OTOMOTIV',
    inputs: [{ resourceId: 'RAW_METAL', quantityPerUnit: 1.3 }],
    outputResourceId: 'INT_PROCESSED_METAL',
    outputQuantity: 1,
    machineHoursPerBatch: 2,
    workerCountRequired: 8,
    energyCostPerBatch: 55,
    wasteRatePct: 3,
    qualityMultiplierEffect: 1.06,
  },
  REC_INT_FURNITURE_FRAME: {
    recipeId: 'REC_INT_FURNITURE_FRAME',
    nameTR: 'Keresteden Ahşap Mobilya İskeleti',
    sector: 'MOBILYA',
    inputs: [{ resourceId: 'RAW_TIMBER', quantityPerUnit: 1.35 }],
    outputResourceId: 'INT_FURNITURE_FRAME',
    outputQuantity: 1,
    machineHoursPerBatch: 1.8,
    workerCountRequired: 6,
    energyCostPerBatch: 35,
    wasteRatePct: 4,
    qualityMultiplierEffect: 1.05,
  },
  REC_INT_CIRCUIT_BOARD: {
    recipeId: 'REC_INT_CIRCUIT_BOARD',
    nameTR: 'Elektronik Bileşenden Anakart (PCB) Dizgisi',
    sector: 'ELEKTRONIK',
    inputs: [
      { resourceId: 'RAW_ELEC_COMP', quantityPerUnit: 1.2 },
      { resourceId: 'RAW_PLASTIC', quantityPerUnit: 0.5 },
    ],
    outputResourceId: 'INT_CIRCUIT_BOARD',
    outputQuantity: 1,
    machineHoursPerBatch: 2.2,
    workerCountRequired: 8,
    energyCostPerBatch: 65,
    wasteRatePct: 3,
    qualityMultiplierEffect: 1.08,
  },

  // Nihai Ürün Reçeteleri
  REC_FIN_PACKAGED_FOOD: {
    recipeId: 'REC_FIN_PACKAGED_FOOD',
    nameTR: 'Paketli Gıda & Bisküvi Kolisi Üretimi',
    sector: 'GIDA',
    inputs: [
      { resourceId: 'RAW_WHEAT', quantityPerUnit: 1.2 },
      { resourceId: 'RAW_PACKAGING', quantityPerUnit: 1.0 },
    ],
    outputResourceId: 'FIN_PACKAGED_FOOD',
    outputQuantity: 1,
    machineHoursPerBatch: 1.2,
    workerCountRequired: 5,
    energyCostPerBatch: 22,
    wasteRatePct: 2,
    qualityMultiplierEffect: 1.06,
  },
  REC_FIN_FRESH_GROCERY: {
    recipeId: 'REC_FIN_FRESH_GROCERY',
    nameTR: 'Seçme Yıkanmış & Paketli Manav Kasası',
    sector: 'GIDA',
    inputs: [
      { resourceId: 'RAW_FRESH_PRODUCE', quantityPerUnit: 1.15 },
      { resourceId: 'RAW_PACKAGING', quantityPerUnit: 0.5 },
    ],
    outputResourceId: 'FIN_FRESH_GROCERY',
    outputQuantity: 1,
    machineHoursPerBatch: 0.8,
    workerCountRequired: 4,
    energyCostPerBatch: 14,
    wasteRatePct: 4,
    qualityMultiplierEffect: 1.05,
  },
  REC_FIN_ARTISAN_COFFEE: {
    recipeId: 'REC_FIN_ARTISAN_COFFEE',
    nameTR: 'Gurme Kahve & Unlu Mamul Seti Üretimi',
    sector: 'GIDA',
    inputs: [
      { resourceId: 'RAW_COFFEE_BEANS', quantityPerUnit: 1.0 },
      { resourceId: 'RAW_WHEAT', quantityPerUnit: 0.8 },
    ],
    outputResourceId: 'FIN_ARTISAN_COFFEE',
    outputQuantity: 1,
    machineHoursPerBatch: 1.0,
    workerCountRequired: 4,
    energyCostPerBatch: 18,
    wasteRatePct: 2.5,
    qualityMultiplierEffect: 1.07,
  },
  REC_FIN_APPAREL_SET: {
    recipeId: 'REC_FIN_APPAREL_SET',
    nameTR: 'Sezonluk Hazır Giyim Koleksiyonu Dikimi',
    sector: 'TEKSTIL',
    inputs: [
      { resourceId: 'RAW_COTTON', quantityPerUnit: 1.6 },
      { resourceId: 'RAW_PACKAGING', quantityPerUnit: 1.0 },
    ],
    outputResourceId: 'FIN_APPAREL_SET',
    outputQuantity: 1,
    machineHoursPerBatch: 1.8,
    workerCountRequired: 8,
    energyCostPerBatch: 36,
    wasteRatePct: 3,
    qualityMultiplierEffect: 1.08,
  },
  REC_FIN_SMART_DEVICE: {
    recipeId: 'REC_FIN_SMART_DEVICE',
    nameTR: 'Akıllı Cihaz Montaj ve Kalite Test Hattı',
    sector: 'ELEKTRONIK',
    inputs: [
      { resourceId: 'RAW_ELEC_COMP', quantityPerUnit: 1.8 },
      { resourceId: 'RAW_METAL', quantityPerUnit: 0.6 },
      { resourceId: 'RAW_PACKAGING', quantityPerUnit: 1.0 },
    ],
    outputResourceId: 'FIN_SMART_DEVICE',
    outputQuantity: 1,
    machineHoursPerBatch: 2.8,
    workerCountRequired: 10,
    energyCostPerBatch: 95,
    wasteRatePct: 2.5,
    qualityMultiplierEffect: 1.12,
  },
  REC_FIN_HOME_FURNITURE: {
    recipeId: 'REC_FIN_HOME_FURNITURE',
    nameTR: 'Modüler Mobilya Takımı Üretimi',
    sector: 'MOBILYA',
    inputs: [
      { resourceId: 'RAW_TIMBER', quantityPerUnit: 2.2 },
      { resourceId: 'RAW_METAL', quantityPerUnit: 0.8 },
      { resourceId: 'RAW_COTTON', quantityPerUnit: 0.8 },
    ],
    outputResourceId: 'FIN_HOME_FURNITURE',
    outputQuantity: 1,
    machineHoursPerBatch: 2.5,
    workerCountRequired: 9,
    energyCostPerBatch: 75,
    wasteRatePct: 3.5,
    qualityMultiplierEffect: 1.09,
  },
  REC_FIN_HOUSEHOLD_ESSENTIALS: {
    recipeId: 'REC_FIN_HOUSEHOLD_ESSENTIALS',
    nameTR: 'Market Temizlik & Ev İhtiyaç Kolisi Üretimi',
    sector: 'PERAKENDE_GENEL',
    inputs: [
      { resourceId: 'RAW_PLASTIC', quantityPerUnit: 1.3 },
      { resourceId: 'RAW_PACKAGING', quantityPerUnit: 1.0 },
    ],
    outputResourceId: 'FIN_HOUSEHOLD_ESSENTIALS',
    outputQuantity: 1,
    machineHoursPerBatch: 1.1,
    workerCountRequired: 5,
    energyCostPerBatch: 24,
    wasteRatePct: 1.5,
    qualityMultiplierEffect: 1.05,
  },
  REC_FIN_PASSENGER_CAR: {
    recipeId: 'REC_FIN_PASSENGER_CAR',
    nameTR: 'Binek Otomobil Şasi, Motor ve Elektronik Montajı',
    sector: 'OTOMOTIV',
    inputs: [
      { resourceId: 'RAW_AUTO_PARTS', quantityPerUnit: 1.2 },
      { resourceId: 'RAW_METAL', quantityPerUnit: 3.0 },
      { resourceId: 'RAW_ELEC_COMP', quantityPerUnit: 2.0 },
    ],
    outputResourceId: 'FIN_PASSENGER_CAR',
    outputQuantity: 1,
    machineHoursPerBatch: 4.5,
    workerCountRequired: 16,
    energyCostPerBatch: 380,
    wasteRatePct: 2.0,
    qualityMultiplierEffect: 1.15,
  },
};

// ============================================================================
// 3. 10 FARKLI TEDARİKÇİ (6 Arketip)
// ============================================================================

export const SUPPLIER_CATALOG: Supplier[] = [
  {
    supplierId: 'SUP_TRAKYA_TARIM',
    nameTR: 'Trakya Bereket Tarım & Hal A.Ş.',
    cityTR: 'Tekirdağ',
    archetype: 'LOCAL_FAST',
    archetypeLabelTR: 'Yerel ve Hızlı',
    sectorFocus: ['GIDA', 'PERAKENDE_GENEL'],
    suppliedResourceIds: [
      'RAW_WHEAT',
      'RAW_FRESH_PRODUCE',
      'INT_FLOUR',
      'FIN_FRESH_GROCERY',
      'FIN_PACKAGED_FOOD',
    ],
    reliabilityScore: 91,
    qualityScore: 84,
    deliverySpeedDays: 1,
    basePriceMultiplier: 0.98,
    volumeDiscountThreshold: 50,
    volumeDiscountPct: 6,
    paymentTermDaysAllowed: 7,
    maxDailyCapacity: 500,
    stockOutProbability: 0.03,
    priceVolatility: 0.04,
  },
  {
    supplierId: 'SUP_MARMARA_TOPTAN',
    nameTR: 'Marmara Mega Toptancı Hali',
    cityTR: 'İstanbul',
    archetype: 'EXPENSIVE_RELIABLE',
    archetypeLabelTR: 'Pahalı ama Güvenilir',
    sectorFocus: ['GIDA', 'PERAKENDE_GENEL', 'TEKSTIL'],
    suppliedResourceIds: [
      'FIN_PACKAGED_FOOD',
      'FIN_FRESH_GROCERY',
      'FIN_ARTISAN_COFFEE',
      'FIN_HOUSEHOLD_ESSENTIALS',
      'FIN_APPAREL_SET',
      'RAW_PACKAGING',
    ],
    reliabilityScore: 98,
    qualityScore: 88,
    deliverySpeedDays: 1,
    basePriceMultiplier: 1.07,
    volumeDiscountThreshold: 60,
    volumeDiscountPct: 8,
    paymentTermDaysAllowed: 15,
    maxDailyCapacity: 800,
    stockOutProbability: 0.01,
    priceVolatility: 0.02,
  },
  {
    supplierId: 'SUP_BOGAZICI_KAHVE',
    nameTR: 'Boğaziçi Gurme Kahve & Gıda İthalat',
    cityTR: 'İstanbul',
    archetype: 'HIGH_QUALITY',
    archetypeLabelTR: 'Yüksek Kaliteli',
    sectorFocus: ['GIDA'],
    suppliedResourceIds: [
      'RAW_COFFEE_BEANS',
      'INT_FLOUR',
      'FIN_ARTISAN_COFFEE',
      'FIN_PACKAGED_FOOD',
    ],
    reliabilityScore: 94,
    qualityScore: 95,
    deliverySpeedDays: 1,
    basePriceMultiplier: 1.09,
    volumeDiscountThreshold: 40,
    volumeDiscountPct: 7,
    paymentTermDaysAllowed: 15,
    maxDailyCapacity: 350,
    stockOutProbability: 0.02,
    priceVolatility: 0.03,
  },
  {
    supplierId: 'SUP_EGE_DOKUMA',
    nameTR: 'Ege Pamuklu Dokuma & Moda Sanayi',
    cityTR: 'İzmir',
    archetype: 'HIGH_QUALITY',
    archetypeLabelTR: 'Yüksek Kaliteli',
    sectorFocus: ['TEKSTIL'],
    suppliedResourceIds: ['RAW_COTTON', 'INT_FABRIC', 'FIN_APPAREL_SET'],
    reliabilityScore: 92,
    qualityScore: 93,
    deliverySpeedDays: 2,
    basePriceMultiplier: 1.04,
    volumeDiscountThreshold: 40,
    volumeDiscountPct: 8,
    paymentTermDaysAllowed: 15,
    maxDailyCapacity: 400,
    stockOutProbability: 0.02,
    priceVolatility: 0.04,
  },
  {
    supplierId: 'SUP_ASYA_MIKRO',
    nameTR: 'Avrasya Yarı İletken & Elektronik İthalat',
    cityTR: 'Kocaeli Liman',
    archetype: 'IMPORTER',
    archetypeLabelTR: 'İthalatçı',
    sectorFocus: ['ELEKTRONIK', 'OTOMOTIV'],
    suppliedResourceIds: [
      'RAW_ELEC_COMP',
      'INT_CIRCUIT_BOARD',
      'FIN_SMART_DEVICE',
    ],
    reliabilityScore: 85,
    qualityScore: 91,
    deliverySpeedDays: 3,
    basePriceMultiplier: 0.91,
    volumeDiscountThreshold: 30,
    volumeDiscountPct: 10,
    paymentTermDaysAllowed: 30,
    maxDailyCapacity: 450,
    stockOutProbability: 0.05,
    priceVolatility: 0.07,
  },
  {
    supplierId: 'SUP_ANADOLU_METAL',
    nameTR: 'Anadolu Ağır Metal & Çelik Haddehane',
    cityTR: 'Karabük',
    archetype: 'HIGH_VOLUME',
    archetypeLabelTR: 'Yüksek Hacimli',
    sectorFocus: ['OTOMOTIV', 'MOBILYA', 'ELEKTRONIK'],
    suppliedResourceIds: ['RAW_METAL', 'INT_PROCESSED_METAL', 'RAW_AUTO_PARTS'],
    reliabilityScore: 90,
    qualityScore: 85,
    deliverySpeedDays: 2,
    basePriceMultiplier: 0.93,
    volumeDiscountThreshold: 50,
    volumeDiscountPct: 11,
    paymentTermDaysAllowed: 30,
    maxDailyCapacity: 900,
    stockOutProbability: 0.02,
    priceVolatility: 0.05,
  },
  {
    supplierId: 'SUP_KARADENIZ_ORMAN',
    nameTR: 'Karadeniz Entegre Kereste & Mobilya',
    cityTR: 'Bolu',
    archetype: 'CHEAP_SLOW',
    archetypeLabelTR: 'Ucuz ama Yavaş',
    sectorFocus: ['MOBILYA'],
    suppliedResourceIds: [
      'RAW_TIMBER',
      'INT_FURNITURE_FRAME',
      'FIN_HOME_FURNITURE',
    ],
    reliabilityScore: 80,
    qualityScore: 79,
    deliverySpeedDays: 3,
    basePriceMultiplier: 0.85,
    volumeDiscountThreshold: 35,
    volumeDiscountPct: 9,
    paymentTermDaysAllowed: 15,
    maxDailyCapacity: 380,
    stockOutProbability: 0.06,
    priceVolatility: 0.05,
  },
  {
    supplierId: 'SUP_TOROS_PLASTIK',
    nameTR: 'Toros Kimya, Plastik ve Ambalaj A.Ş.',
    cityTR: 'Adana',
    archetype: 'CHEAP_SLOW',
    archetypeLabelTR: 'Ucuz ama Yavaş',
    sectorFocus: ['PERAKENDE_GENEL', 'GIDA'],
    suppliedResourceIds: [
      'RAW_PLASTIC',
      'RAW_PACKAGING',
      'FIN_HOUSEHOLD_ESSENTIALS',
    ],
    reliabilityScore: 82,
    qualityScore: 78,
    deliverySpeedDays: 2,
    basePriceMultiplier: 0.84,
    volumeDiscountThreshold: 80,
    volumeDiscountPct: 10,
    paymentTermDaysAllowed: 15,
    maxDailyCapacity: 700,
    stockOutProbability: 0.04,
    priceVolatility: 0.04,
  },
  {
    supplierId: 'SUP_BURSA_OTOMOTIV',
    nameTR: 'Bursa Otomotiv Ana Sanayi & Distribütörlük',
    cityTR: 'Bursa',
    archetype: 'EXPENSIVE_RELIABLE',
    archetypeLabelTR: 'Pahalı ama Güvenilir',
    sectorFocus: ['OTOMOTIV'],
    suppliedResourceIds: [
      'RAW_AUTO_PARTS',
      'INT_PROCESSED_METAL',
      'FIN_PASSENGER_CAR',
    ],
    reliabilityScore: 96,
    qualityScore: 94,
    deliverySpeedDays: 2,
    basePriceMultiplier: 1.05,
    volumeDiscountThreshold: 5,
    volumeDiscountPct: 6,
    paymentTermDaysAllowed: 30,
    maxDailyCapacity: 80,
    stockOutProbability: 0.01,
    priceVolatility: 0.03,
  },
  {
    supplierId: 'SUP_IZMIR_LIMAN_ITHALAT',
    nameTR: 'Ege Serbest Bölge Dış Ticaret Lojistik',
    cityTR: 'İzmir Liman',
    archetype: 'IMPORTER',
    archetypeLabelTR: 'İthalatçı',
    sectorFocus: ['ELEKTRONIK', 'MOBILYA', 'TEKSTIL', 'PERAKENDE_GENEL'],
    suppliedResourceIds: [
      'FIN_SMART_DEVICE',
      'FIN_HOME_FURNITURE',
      'FIN_APPAREL_SET',
      'FIN_HOUSEHOLD_ESSENTIALS',
      'RAW_ELEC_COMP',
      'RAW_COTTON',
    ],
    reliabilityScore: 87,
    qualityScore: 88,
    deliverySpeedDays: 2,
    basePriceMultiplier: 0.92,
    volumeDiscountThreshold: 40,
    volumeDiscountPct: 9,
    paymentTermDaysAllowed: 30,
    maxDailyCapacity: 600,
    stockOutProbability: 0.04,
    priceVolatility: 0.06,
  },
];

// ============================================================================
// 4. 8 FARKLI ESNAF / DÜKKÂN / MAĞAZA TÜRÜ (Gerçek Ekonomik ve Mekanik Farklarla)
// ============================================================================

export const SHOP_TEMPLATES: Record<ShopType, ShopTemplate> = {
  BUFE: {
    shopType: 'BUFE',
    nameTR: 'Köşe Büfe & Hızlı Atıştırmalık',
    shortTagTR: 'Büfe',
    defaultCityBlockId: 'urban-ticaret-magaza-1',
    openingCost: 25_000,
    decorationCost: 10_000,
    dailyRentBase: 450,
    minStaffRequired: 1,
    staffDailyWagePerPerson: 380,
    baseCustomerCapacity: 85,
    baseShelfCapacity: 140,
    baseBackroomCapacity: 180,
    allowedResourceIds: [
      'FIN_PACKAGED_FOOD',
      'FIN_ARTISAN_COFFEE',
      'FIN_HOUSEHOLD_ESSENTIALS',
    ],
    defaultGrossMarginPct: 28,
    customerSegment: 'PRICE_SENSITIVE',
    demandVolatility: 0.08,
    specificMechanicKey: 'FAST_TURNOVER_IMPULSE',
    specificMechanicTitleTR: 'Yüksek Sirkülasyon & Ayaküstü Satış',
    specificMechanicDescriptionTR:
      'Düşük sermaye ile açılır, yaya trafiğinden hızlı nakit akışı üretir; raf boş kalırsa müşteri anında rakibe gider.',
    levelUpgradeCosts: [18_000, 35_000, 65_000, 110_000],
  },
  MANAV: {
    shopType: 'MANAV',
    nameTR: 'Mahalle Taze Manavı',
    shortTagTR: 'Manav',
    defaultCityBlockId: 'urban-ticaret-toptanci-4',
    openingCost: 35_000,
    decorationCost: 12_000,
    dailyRentBase: 600,
    minStaffRequired: 2,
    staffDailyWagePerPerson: 400,
    baseCustomerCapacity: 75,
    baseShelfCapacity: 160,
    baseBackroomCapacity: 200,
    allowedResourceIds: ['FIN_FRESH_GROCERY', 'RAW_FRESH_PRODUCE'],
    defaultGrossMarginPct: 36,
    customerSegment: 'STANDARD_CONSUMER',
    demandVolatility: 0.1,
    specificMechanicKey: 'DAILY_SPOILAGE_FRESHNESS',
    specificMechanicTitleTR: 'Günlük Tazelik & Fire (Bozulma) Riski',
    specificMechanicDescriptionTR:
      'Taze meyve ve sebzeler yüksek talep görür ancak satılmayan stok her gün %5-%6 fire verir; soğutma geliştirildikçe fire düşer.',
    levelUpgradeCosts: [24_000, 48_000, 85_000, 145_000],
  },
  KAFE: {
    shopType: 'KAFE',
    nameTR: 'Bulvar Köşe Kafe & Bistro',
    shortTagTR: 'Kafe',
    defaultCityBlockId: 'urban-ticaret-kafe-2',
    openingCost: 65_000,
    decorationCost: 25_000,
    dailyRentBase: 1_100,
    minStaffRequired: 3,
    staffDailyWagePerPerson: 460,
    baseCustomerCapacity: 65,
    baseShelfCapacity: 120,
    baseBackroomCapacity: 160,
    allowedResourceIds: [
      'FIN_ARTISAN_COFFEE',
      'FIN_PACKAGED_FOOD',
      'RAW_COFFEE_BEANS',
    ],
    defaultGrossMarginPct: 48,
    customerSegment: 'QUALITY_FOCUSED',
    demandVolatility: 0.12,
    specificMechanicKey: 'RECIPE_TABLE_SERVICE',
    specificMechanicTitleTR: 'Masa Kapasitesi & Barista Servis Kalitesi',
    specificMechanicDescriptionTR:
      'Kâr marjı yüksektir; satış hacmi masa sayısı ve servis çalışanlarının hızıyla doğrudan ölçeklenir.',
    levelUpgradeCosts: [45_000, 85_000, 150_000, 260_000],
  },
  GIYIM_MAGAZASI: {
    shopType: 'GIYIM_MAGAZASI',
    nameTR: 'Anadolu Moda & Giyim Mağazası',
    shortTagTR: 'Giyim Mağazası',
    defaultCityBlockId: 'urban-ticaret-magaza-1',
    openingCost: 110_000,
    decorationCost: 40_000,
    dailyRentBase: 1_800,
    minStaffRequired: 3,
    staffDailyWagePerPerson: 490,
    baseCustomerCapacity: 50,
    baseShelfCapacity: 180,
    baseBackroomCapacity: 260,
    allowedResourceIds: ['FIN_APPAREL_SET', 'INT_FABRIC'],
    defaultGrossMarginPct: 52,
    customerSegment: 'QUALITY_FOCUSED',
    demandVolatility: 0.16,
    specificMechanicKey: 'SEASONAL_FASHION_COLLECTION',
    specificMechanicTitleTR: 'Sezonluk Kreasyon & Vitrin Çekiciliği',
    specificMechanicDescriptionTR:
      'Vitrin kalitesi ve sezonluk moda dönemlerinde yüksek marjlı satış yapar; aşırı fiyat artışına karşı duyarlıdır.',
    levelUpgradeCosts: [75_000, 140_000, 250_000, 420_000],
  },
  ELEKTRONIK_MAGAZASI: {
    shopType: 'ELEKTRONIK_MAGAZASI',
    nameTR: 'TeknoVizyon Elektronik Mağazası',
    shortTagTR: 'Elektronik Mğz.',
    defaultCityBlockId: 'urban-tekno-ofis-13',
    openingCost: 190_000,
    decorationCost: 60_000,
    dailyRentBase: 2_600,
    minStaffRequired: 4,
    staffDailyWagePerPerson: 580,
    baseCustomerCapacity: 38,
    baseShelfCapacity: 110,
    baseBackroomCapacity: 180,
    allowedResourceIds: ['FIN_SMART_DEVICE', 'INT_CIRCUIT_BOARD'],
    defaultGrossMarginPct: 38,
    customerSegment: 'QUALITY_FOCUSED',
    demandVolatility: 0.15,
    specificMechanicKey: 'HIGH_TICKET_WARRANTY_INSTALLMENT',
    specificMechanicTitleTR: 'Yüksek Sepet Tutarı, Garanti & Taksit Desteği',
    specificMechanicDescriptionTR:
      'Birim ürün değeri yüksektir; uzman satış danışmanları ve garanti hizmeti müşteri memnuniyetini ve dönüşümü artırır.',
    levelUpgradeCosts: [120_000, 230_000, 390_000, 640_000],
  },
  MOBILYA_MAGAZASI: {
    shopType: 'MOBILYA_MAGAZASI',
    nameTR: 'Marmara Ev & Ofis Mobilya Showroom',
    shortTagTR: 'Mobilya Mğz.',
    defaultCityBlockId: 'urban-ticaret-depo-link-6',
    openingCost: 220_000,
    decorationCost: 70_000,
    dailyRentBase: 2_900,
    minStaffRequired: 4,
    staffDailyWagePerPerson: 560,
    baseCustomerCapacity: 28,
    baseShelfCapacity: 80,
    baseBackroomCapacity: 240,
    allowedResourceIds: ['FIN_HOME_FURNITURE', 'INT_FURNITURE_FRAME'],
    defaultGrossMarginPct: 44,
    customerSegment: 'STANDARD_CONSUMER',
    demandVolatility: 0.14,
    specificMechanicKey: 'LARGE_STORAGE_HOME_DELIVERY',
    specificMechanicTitleTR: 'Geniş Depo Alanı & Eve Teslimat Montaj Hizmeti',
    specificMechanicDescriptionTR:
      'Hacimli ürünler geniş teşhir ve arka depo alanı gerektirir; teslimat kapasitesi yüksek olduğunda kurumsal ve bireysel siparişler artar.',
    levelUpgradeCosts: [135_000, 260_000, 440_000, 720_000],
  },
  MARKET: {
    shopType: 'MARKET',
    nameTR: 'Bölgesel Süpermarket & Hipermarket',
    shortTagTR: 'Süpermarket',
    defaultCityBlockId: 'urban-ticaret-merkezi-3',
    openingCost: 280_000,
    decorationCost: 80_000,
    dailyRentBase: 3_500,
    minStaffRequired: 6,
    staffDailyWagePerPerson: 450,
    baseCustomerCapacity: 140,
    baseShelfCapacity: 420,
    baseBackroomCapacity: 600,
    allowedResourceIds: [
      'FIN_PACKAGED_FOOD',
      'FIN_FRESH_GROCERY',
      'FIN_HOUSEHOLD_ESSENTIALS',
      'FIN_ARTISAN_COFFEE',
      'FIN_APPAREL_SET',
    ],
    defaultGrossMarginPct: 32,
    customerSegment: 'HIGH_VOLUME_CHAIN',
    demandVolatility: 0.06,
    specificMechanicKey: 'MULTI_CATEGORY_SHELF_BASKET',
    specificMechanicTitleTR: 'Çoklu Kategori Raf Çeşitliliği & Sepet Büyüklüğü',
    specificMechanicDescriptionTR:
      'Aynı anda ne kadar çok farklı ürün kategorisinde stok bulundurulursa müşteri başına sepet büyüklüğü o kadar yükselir.',
    levelUpgradeCosts: [160_000, 310_000, 520_000, 880_000],
  },
  OTOMOBIL_GALERISI: {
    shopType: 'OTOMOBIL_GALERISI',
    nameTR: 'Prestij Otomobil & Ticari Araç Galerisi',
    shortTagTR: 'Oto Galeri',
    defaultCityBlockId: 'urban-ticaret-otel-5',
    openingCost: 650_000,
    decorationCost: 150_000,
    dailyRentBase: 5_500,
    minStaffRequired: 5,
    staffDailyWagePerPerson: 750,
    baseCustomerCapacity: 14,
    baseShelfCapacity: 24,
    baseBackroomCapacity: 45,
    allowedResourceIds: ['FIN_PASSENGER_CAR'],
    defaultGrossMarginPct: 26,
    customerSegment: 'CORPORATE_BUYER',
    demandVolatility: 0.18,
    specificMechanicKey: 'HIGH_CAPITAL_VEHICLE_SHOWROOM',
    specificMechanicTitleTR: 'Yüksek Sermaye Showroom & Yüksek Birim Kâr',
    specificMechanicDescriptionTR:
      'Az adette fakat çok yüksek tutarlı araç satışı yapar; showroom kapasitesi ve ticari itibar satış hızını belirler.',
    levelUpgradeCosts: [320_000, 620_000, 1_100_000, 1_850_000],
  },
};

export const VEHICLE_CATALOG: Record<
  LogisticsVehicleType,
  {
    nameTR: string;
    capacityUnits: number;
    speedMultiplier: number;
    purchaseCost: number;
    dailyMaintenanceCost: number;
    fuelCostPerTrip: number;
    driverDailyWage: number;
  }
> = {
  SMALL_VAN: {
    nameTR: 'Hafif Ticari Panelvan (Şehir İçi Dağıtım)',
    capacityUnits: 80,
    speedMultiplier: 1.2,
    purchaseCost: 95_000,
    dailyMaintenanceCost: 180,
    fuelCostPerTrip: 220,
    driverDailyWage: 450,
  },
  MEDIUM_TRUCK: {
    nameTR: 'Orta Tonajlı Kamyon (Bölgesel Sevkiyat)',
    capacityUnits: 240,
    speedMultiplier: 1.0,
    purchaseCost: 240_000,
    dailyMaintenanceCost: 390,
    fuelCostPerTrip: 480,
    driverDailyWage: 580,
  },
  HEAVY_TRUCK: {
    nameTR: 'Ağır Nakliye Tırı (Toptan & Fabrika Lojistiği)',
    capacityUnits: 600,
    speedMultiplier: 0.9,
    purchaseCost: 520_000,
    dailyMaintenanceCost: 750,
    fuelCostPerTrip: 950,
    driverDailyWage: 760,
  },
  SPECIAL_CARGO: {
    nameTR: 'Soğutuculu & Özel Kargo Aracı (Sıfır Fire)',
    capacityUnits: 320,
    speedMultiplier: 1.05,
    purchaseCost: 380_000,
    dailyMaintenanceCost: 540,
    fuelCostPerTrip: 640,
    driverDailyWage: 680,
  },
};

export const DEFAULT_ROUTES: LogisticsRoute[] = [
  {
    routeId: 'ROUTE_LOCAL_CITY',
    originNameTR: 'Bölgesel Toptancı / Depo',
    destinationNameTR: 'Ticaret Bölgesi Dükkânları',
    distanceKm: 28,
    baseTransitDays: 1,
    baseExternalCostPerUnit: 8,
    delayRiskPct: 4,
    damageRiskPct: 1,
  },
  {
    routeId: 'ROUTE_REGIONAL_HIGHWAY',
    originNameTR: 'Anadolu / Marmara Üretim Havzası',
    destinationNameTR: 'Sanayi Bölgesi Ana Depo',
    distanceKm: 185,
    baseTransitDays: 2,
    baseExternalCostPerUnit: 16,
    delayRiskPct: 8,
    damageRiskPct: 2,
  },
  {
    routeId: 'ROUTE_IMPORT_PORT',
    originNameTR: 'İthalat Limanı & Serbest Bölge',
    destinationNameTR: 'Sanayi & Teknoloji Depoları',
    distanceKm: 420,
    baseTransitDays: 3,
    baseExternalCostPerUnit: 26,
    delayRiskPct: 12,
    damageRiskPct: 2.5,
  },
];

export class TradeAndShopEngine {
  public static readonly TRADE_SCHEMA_VERSION = 7;

  // Şirketleşme (Esnaftan Kurumsal Şirkete Geçiş) Eşik Değerleri
  public static readonly MIN_BRANCHES_FOR_INCORPORATION = 2;
  public static readonly MIN_STAFF_FOR_INCORPORATION = 10;
  public static readonly MIN_BUSINESS_VALUE_FOR_INCORPORATION = 350_000;
  public static readonly MIN_REPUTATION_FOR_INCORPORATION = 60;

  /**
   * Başlangıç veya mevcut bir SimulationState için deterministik ve idempotent TradeUniverseState oluşturur.
   */
  public static createInitialTradeUniverseState(
    state?: Partial<SimulationState>
  ): TradeUniverseState {
    const hasCompany = Boolean(state?.playerCompany);
    const pc = state?.playerCompany;
    const isHolding = Boolean(
      state?.stage === SimulationStage.STAGE_4_HOLDING_MONOPOLY ||
        state?.stageUnlocks?.stage4Holding
    );

    const careerStage: CareerStage = isHolding
      ? 'HOLDING_LEADER'
      : hasCompany
      ? 'INCORPORATED_COMPANY'
      : 'STOCK_INVESTOR';

    const rawWarehouseCap = hasCompany
      ? Math.max(300, (pc?.productionCapacity ?? 25) * 12)
      : 250;
    const finWarehouseCap = hasCompany
      ? Math.max(400, (pc?.productionCapacity ?? 25) * 15)
      : 300;
    const distWarehouseCap = hasCompany
      ? Math.max(350, (pc?.productionCapacity ?? 25) * 12)
      : 250;

    // Eğer oyuncunun zaten kurulu bir şirketi varsa mevcut stokunu Mamul Deposu partisine (batch) yansıt
    const existingFinUnits = Math.max(
      0,
      Math.round(
        pc?.operations?.inventoryUnits ?? pc?.financials?.inventoryUnits ?? 0
      )
    );
    const defaultCompanyProductId = TradeAndShopEngine.getDefaultProductForSector(
      pc?.sector ?? 'TEKNOLOJI'
    );
    const defaultResDef = RESOURCE_CATALOG[defaultCompanyProductId];
    const unitCost =
      pc?.operations?.unitProductionCost ??
      pc?.financials?.unitProductionCost ??
      defaultResDef.baseMarketPrice * 0.65;

    const initialFinBatches: InventoryBatch[] =
      existingFinUnits > 0
        ? [
            {
              batchId: 'BATCH-INIT-FIN-0001',
              resourceId: defaultCompanyProductId,
              resourceNameTR: defaultResDef.nameTR,
              category: 'FINISHED_PRODUCT',
              quantity: existingFinUnits,
              reservedQuantity: 0,
              availableQuantity: existingFinUnits,
              unitCost: Number(unitCost.toFixed(2)),
              totalValue: Number((existingFinUnits * unitCost).toFixed(2)),
              qualityScore: 84,
              receivedDay: state?.day ?? 1,
              expirationDay: null,
            },
          ]
        : [];

    const warehouses: Warehouse[] = [
      {
        warehouseId: 'WH_RAW_MAIN',
        nameTR: 'Merkez Hammadde Deposu',
        type: 'RAW_MATERIAL',
        level: 1,
        maxCapacityUnits: rawWarehouseCap,
        usedCapacityUnits: 0,
        dailyOperatingCost: hasCompany ? 350 : 0,
        dailyStorageCostPerUnit: 1.2,
        spoilageProtectionFactor: 0.85,
        batches: [],
      },
      {
        warehouseId: 'WH_FIN_MAIN',
        nameTR: 'Merkez Mamul Ürün Deposu',
        type: 'FINISHED_GOODS',
        level: 1,
        maxCapacityUnits: finWarehouseCap,
        usedCapacityUnits: existingFinUnits,
        dailyOperatingCost: hasCompany ? 420 : 0,
        dailyStorageCostPerUnit: 1.5,
        spoilageProtectionFactor: 0.8,
        batches: initialFinBatches,
      },
      {
        warehouseId: 'WH_DIST_MAIN',
        nameTR: 'Ticari Dağıtım ve Sevkiyat Deposu',
        type: 'DISTRIBUTION',
        level: 1,
        maxCapacityUnits: distWarehouseCap,
        usedCapacityUnits: 0,
        dailyOperatingCost: hasCompany ? 300 : 0,
        dailyStorageCostPerUnit: 1.1,
        spoilageProtectionFactor: 0.75,
        batches: [],
      },
    ];

    const salesChannels: SalesChannel[] = [
      {
        channelId: 'CH_OWN_SHOPS',
        channelType: 'OWN_SHOPS',
        nameTR: 'Kendi Perakende Dükkânları & Şubeleri',
        descriptionTR:
          'Şehirdeki esnaf dükkânlarınız ve mağaza şubeleriniz üzerinden doğrudan tüketiciye yüksek marjlı satış.',
        isUnlocked: true,
        unlockRequirementTR: 'İlk dükkân açıldığında aktif olur',
        demandMultiplier: 1.0,
        marginMultiplier: 1.25,
        paymentTermDays: 0,
        logisticsCostShare: 0.03,
        returnRiskPct: 1.5,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
      {
        channelId: 'CH_WHOLESALE',
        channelType: 'WHOLESALE_MARKET',
        nameTR: 'Toptancı Hali & Spot Piyasa',
        descriptionTR:
          'Daha düşük marjla fakat yüksek hacimli ve peşin tahsilatlı toptan satış kanalı.',
        isUnlocked: true,
        unlockRequirementTR: 'Başlangıçtan itibaren açık',
        demandMultiplier: 1.35,
        marginMultiplier: 0.88,
        paymentTermDays: 0,
        logisticsCostShare: 0.05,
        returnRiskPct: 1.0,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
      {
        channelId: 'CH_REGIONAL_DIST',
        channelType: 'REGIONAL_DISTRIBUTOR',
        nameTR: 'Bölgesel Bayi ve Dağıtım Ağı',
        descriptionTR:
          'Düzenli haftalık alım yapan bölgesel bayilere 7 gün vadeli orta marjlı satış.',
        isUnlocked: hasCompany,
        unlockRequirementTR: 'Şirketleşme aşamasında açılır',
        demandMultiplier: 1.2,
        marginMultiplier: 1.02,
        paymentTermDays: 7,
        logisticsCostShare: 0.06,
        returnRiskPct: 2.0,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
      {
        channelId: 'CH_CORPORATE_CONTRACT',
        channelType: 'CORPORATE_CONTRACT',
        nameTR: 'Kurumsal Tedarik Sözleşmeleri (B2B)',
        descriptionTR:
          'Büyük kurumsal alıcılarla sabit fiyat ve taahhütlü teslimat sözleşmeleri.',
        isUnlocked: hasCompany,
        unlockRequirementTR: 'Şirketleşme aşamasında açılır',
        demandMultiplier: 1.4,
        marginMultiplier: 1.08,
        paymentTermDays: 14,
        logisticsCostShare: 0.05,
        returnRiskPct: 1.2,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
      {
        channelId: 'CH_EXPORT',
        channelType: 'EXPORT_CHANNEL',
        nameTR: 'Uluslararası İhracat Kanalı',
        descriptionTR:
          'Yüksek kalite puanı (82+) gerektiren döviz endeksli yüksek hacimli ihracat pazarı.',
        isUnlocked: Boolean(hasCompany && (pc?.corporateGovernanceScore ?? 0) >= 75),
        unlockRequirementTR: 'Şirket + 75 Kurumsal İtibar ile açılır',
        demandMultiplier: 1.5,
        marginMultiplier: 1.18,
        paymentTermDays: 15,
        logisticsCostShare: 0.09,
        returnRiskPct: 2.5,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
      {
        channelId: 'CH_HOLDING_INTERNAL',
        channelType: 'HOLDING_INTERNAL',
        nameTR: 'Holding İçi Şirketler Arası Tedarik',
        descriptionTR:
          'Üretim şirketinden perakende zincirine iç transfer fiyatlamasıyla tedarik (konsolide ciroda çift sayılmaz).',
        isUnlocked: isHolding,
        unlockRequirementTR: 'Holding aşamasında açılır',
        demandMultiplier: 1.25,
        marginMultiplier: 1.0,
        paymentTermDays: 0,
        logisticsCostShare: 0.02,
        returnRiskPct: 0,
        todayUnitsSold: 0,
        todayRevenue: 0,
      },
    ];

    const initialContracts: CommercialContract[] = [
      {
        contractId: 'CC-OFFER-0001',
        buyerNameTR: 'Marmara Kurumsal Marketler Zinciri',
        buyerSegment: 'HIGH_VOLUME_CHAIN',
        resourceId: 'FIN_PACKAGED_FOOD',
        resourceNameTR: RESOURCE_CATALOG.FIN_PACKAGED_FOOD.nameTR,
        totalRequiredUnits: 60,
        deliveredUnits: 0,
        remainingUnits: 60,
        dailyDeliveryTarget: 10,
        unitSalePrice: 445,
        paymentTermDays: 7,
        latePenaltyPerUnit: 45,
        minQualityRequired: 75,
        reputationReward: 4,
        reputationPenalty: 6,
        startDay: state?.day ?? 1,
        dueDay: (state?.day ?? 1) + 12,
        status: 'OFFERED',
      },
      {
        contractId: 'CC-OFFER-0002',
        buyerNameTR: 'Anadolu Tekstil İhracat Konsorsiyumu',
        buyerSegment: 'CORPORATE_BUYER',
        resourceId: 'FIN_APPAREL_SET',
        resourceNameTR: RESOURCE_CATALOG.FIN_APPAREL_SET.nameTR,
        totalRequiredUnits: 35,
        deliveredUnits: 0,
        remainingUnits: 35,
        dailyDeliveryTarget: 5,
        unitSalePrice: 1_320,
        paymentTermDays: 10,
        latePenaltyPerUnit: 120,
        minQualityRequired: 80,
        reputationReward: 5,
        reputationPenalty: 7,
        startDay: state?.day ?? 1,
        dueDay: (state?.day ?? 1) + 14,
        status: 'OFFERED',
      },
      {
        contractId: 'CC-OFFER-0003',
        buyerNameTR: 'TeknoPark Kurumsal Donanım Tedariği',
        buyerSegment: 'CORPORATE_BUYER',
        resourceId: 'FIN_SMART_DEVICE',
        resourceNameTR: RESOURCE_CATALOG.FIN_SMART_DEVICE.nameTR,
        totalRequiredUnits: 20,
        deliveredUnits: 0,
        remainingUnits: 20,
        dailyDeliveryTarget: 4,
        unitSalePrice: 4_450,
        paymentTermDays: 14,
        latePenaltyPerUnit: 350,
        minQualityRequired: 85,
        reputationReward: 6,
        reputationPenalty: 8,
        startDay: state?.day ?? 1,
        dueDay: (state?.day ?? 1) + 15,
        status: 'OFFERED',
      },
    ];

    return {
      schemaVersion: TradeAndShopEngine.TRADE_SCHEMA_VERSION,
      careerStage,
      tradeReputationScore: hasCompany ? 72 : 58,
      supplierReliabilityScore: 88,
      deliveryPunctualityScore: 92,
      customerSatisfactionScore: 78,
      logisticsMode: 'EXTERNAL_LOGISTICS',
      autoProcurementEnabled: false,
      autoShopReplenishEnabled: true,
      shops: [],
      warehouses,
      suppliers: JSON.parse(JSON.stringify(SUPPLIER_CATALOG)),
      procurementOrders: [],
      purchaseContracts: [],
      productionOrders: [],
      shipments: [],
      vehicles: [],
      routes: JSON.parse(JSON.stringify(DEFAULT_ROUTES)),
      salesChannels,
      commercialContracts: initialContracts,
      invoices: [],
      payments: [],
      activeTradeEvents: [],
      processedOrderIds: [],
      deliveredShipmentIds: [],
      orderSeq: 0,
      shipmentSeq: 0,
      batchSeq: initialFinBatches.length,
      contractSeq: initialContracts.length,
      invoiceSeq: 0,
      productionSeq: 0,
      shopSeq: 0,
      vehicleSeq: 0,
      todaySummary: {
        procurementSpend: 0,
        productionUnits: 0,
        productionCost: 0,
        logisticsCost: 0,
        shopSalesRevenue: 0,
        shopCogs: 0,
        shopOpex: 0,
        shopSpoilageCost: 0,
        shopNetProfit: 0,
        wholesaleAndContractRevenue: 0,
        wholesaleAndContractCogs: 0,
        intercompanyEliminatedRevenue: 0,
        receivablesCollected: 0,
        payablesPaid: 0,
        overduePenaltiesPaid: 0,
      },
      lastTradeAuditReport: null,
    };
  }

  /**
   * Mevcut bir SimulationState üzerinde tradeState alanının varlığını ve tutarlılığını idempotent olarak garanti eder.
   * Eski kayıtlarda mükerrer stok, mükerrer para veya nakit değişimi oluşturmaz!
   */
  public static ensureTradeUniverseState(state: SimulationState): TradeUniverseState {
    if (!state.tradeState || typeof state.tradeState !== 'object') {
      state.tradeState = TradeAndShopEngine.createInitialTradeUniverseState(state);
      return state.tradeState;
    }

    const ts = state.tradeState;
    ts.schemaVersion = TradeAndShopEngine.TRADE_SCHEMA_VERSION;
    if (!Array.isArray(ts.shops)) ts.shops = [];
    if (!Array.isArray(ts.warehouses) || ts.warehouses.length === 0) {
      ts.warehouses = TradeAndShopEngine.createInitialTradeUniverseState(state).warehouses;
    }
    if (!Array.isArray(ts.suppliers) || ts.suppliers.length === 0) {
      ts.suppliers = JSON.parse(JSON.stringify(SUPPLIER_CATALOG));
    }
    if (!Array.isArray(ts.procurementOrders)) ts.procurementOrders = [];
    if (!Array.isArray(ts.purchaseContracts)) ts.purchaseContracts = [];
    if (!Array.isArray(ts.productionOrders)) ts.productionOrders = [];
    if (!Array.isArray(ts.shipments)) ts.shipments = [];
    if (!Array.isArray(ts.vehicles)) ts.vehicles = [];
    if (!Array.isArray(ts.routes) || ts.routes.length === 0) {
      ts.routes = JSON.parse(JSON.stringify(DEFAULT_ROUTES));
    }
    if (!Array.isArray(ts.salesChannels) || ts.salesChannels.length === 0) {
      ts.salesChannels = TradeAndShopEngine.createInitialTradeUniverseState(state).salesChannels;
    }
    if (!Array.isArray(ts.commercialContracts)) ts.commercialContracts = [];
    if (!Array.isArray(ts.invoices)) ts.invoices = [];
    if (!Array.isArray(ts.payments)) ts.payments = [];
    if (!Array.isArray(ts.activeTradeEvents)) ts.activeTradeEvents = [];
    if (!Array.isArray(ts.processedOrderIds)) ts.processedOrderIds = [];
    if (!Array.isArray(ts.deliveredShipmentIds)) ts.deliveredShipmentIds = [];

    TradeAndShopEngine.updateCareerStage(state);
    return ts;
  }

  public static getDefaultProductForSector(sector: SectorId): string {
    switch (sector) {
      case 'TEKNOLOJI':
      case 'SAVUNMA':
        return 'FIN_SMART_DEVICE';
      case 'PERAKENDE':
        return 'FIN_PACKAGED_FOOD';
      case 'ENERJI':
      case 'MADENCILIK':
      case 'LOJISTIK':
        return 'FIN_PASSENGER_CAR';
      case 'BIYOTEKNOLOJI':
      case 'FINANS':
      default:
        return 'FIN_HOUSEHOLD_ESSENTIALS';
    }
  }

  public static getDefaultRawMaterialForSector(sector: SectorId): string {
    switch (sector) {
      case 'TEKNOLOJI':
      case 'SAVUNMA':
        return 'RAW_ELEC_COMP';
      case 'PERAKENDE':
        return 'RAW_WHEAT';
      case 'ENERJI':
      case 'MADENCILIK':
      case 'LOJISTIK':
        return 'RAW_METAL';
      default:
        return 'RAW_PLASTIC';
    }
  }

  public static getDefaultRecipeForSector(sector: SectorId): string {
    switch (sector) {
      case 'TEKNOLOJI':
      case 'SAVUNMA':
        return 'REC_FIN_SMART_DEVICE';
      case 'PERAKENDE':
        return 'REC_FIN_PACKAGED_FOOD';
      case 'ENERJI':
      case 'MADENCILIK':
      case 'LOJISTIK':
        return 'REC_FIN_PASSENGER_CAR';
      default:
        return 'REC_FIN_HOUSEHOLD_ESSENTIALS';
    }
  }

  /**
   * Oyuncunun kariyer aşamasını (`careerStage`) mevcut dükkân, şirket ve holding durumuna göre günceller.
   */
  public static updateCareerStage(state: SimulationState): CareerStage {
    const ts = state.tradeState;
    if (!ts) return 'STOCK_INVESTOR';

    if (
      state.stage === SimulationStage.STAGE_4_HOLDING_MONOPOLY ||
      state.stageUnlocks.stage4Holding ||
      state.controlledSubsidiaries.length > 0
    ) {
      ts.careerStage = 'HOLDING_LEADER';
    } else if (state.playerCompany !== null) {
      ts.careerStage = 'INCORPORATED_COMPANY';
    } else if (ts.shops.length >= 2) {
      ts.careerStage = 'MULTI_BRANCH_MERCHANT';
    } else if (ts.shops.length === 1) {
      ts.careerStage = 'SMALL_MERCHANT';
    } else {
      ts.careerStage = 'STOCK_INVESTOR';
    }
    return ts.careerStage;
  }

  /**
   * Şirketleşmemiş (esnaf aşamasındaki) dükkânların ve bağımsız depoların toplam özkaynak değerini hesaplar:
   * - Dükkân kasası (`cashAccountBalance`)
   * - Dükkân sabit yatırımı (`totalInvestedCapital`)
   * - Dükkân içindeki stokların gerçek maliyet değeri
   * - Yoldaki peşin ödenmiş esnaf siparişlerinin değeri
   * - Eksi: Esnafın ödenmemiş vadeli tedarikçi faturaları
   * Not: Dükkân `isCompanyBranch === true` olduğunda varlıkları şirket bilançosuna dahil edildiği için burada 0 döner (çift sayım önlenir!).
   */
  public static computeNonIncorporatedShopsEquity(
    state: SimulationState
  ): number {
    const ts = state.tradeState;
    if (!ts) return 0;

    // Eğer oyuncu şirketi kurulmuşsa ve tüm dükkânlar şirket şubesiyse ek esnaf özkaynağı yoktur
    const independentShops = ts.shops.filter((s) => !s.isCompanyBranch);
    if (independentShops.length === 0 && state.playerCompany !== null) {
      return 0;
    }

    let total = 0;
    for (const shop of independentShops) {
      const invVal = shop.inventoryBatches.reduce(
        (sum, b) => sum + b.quantity * b.unitCost,
        0
      );
      total += shop.cashAccountBalance + shop.totalInvestedCapital + invVal;
    }

    // Eğer henüz şirket kurulmamışsa fakat bağımsız depolarda veya yolda peşin ödenmiş esnaf malı varsa onları da ekle
    if (!state.playerCompany) {
      for (const wh of ts.warehouses) {
        for (const b of wh.batches) {
          total += b.quantity * b.unitCost;
        }
      }
      for (const v of ts.vehicles) {
        total += v.purchaseCost;
      }
      for (const ord of ts.procurementOrders) {
        if (
          ord.status === 'PREPARING' ||
          ord.status === 'IN_TRANSIT' ||
          ord.status === 'DELAYED' ||
          ord.status === 'APPROVED'
        ) {
          // Yoldaki malın peşin ödenmiş kısmı varlık olarak korunur
          total += ord.paidAmount;
        }
      }
      for (const inv of ts.invoices) {
        if (inv.status !== 'PAID' && inv.status !== 'CANCELLED') {
          if (inv.direction === 'RECEIVABLE') {
            total += inv.remainingAmount;
          } else if (inv.direction === 'PAYABLE') {
            total -= inv.remainingAmount;
          }
        }
      }
    } else {
      // Şirket kurulmuş olsa bile bağımsız esnaf dükkânına giden yoldaki peşin siparişleri koru
      const independentShopIds = new Set(independentShops.map((s) => s.shopId));
      for (const ord of ts.procurementOrders) {
        if (
          ord.targetDestinationType === 'SHOP' &&
          independentShopIds.has(ord.targetDestinationId) &&
          (ord.status === 'PREPARING' ||
            ord.status === 'IN_TRANSIT' ||
            ord.status === 'DELAYED' ||
            ord.status === 'APPROVED')
        ) {
          total += ord.paidAmount;
        }
      }
    }

    return Number(Math.max(0, total).toFixed(2));
  }

  // ============================================================================
  // 5. ESNAF DÜKKÂNI AÇMA, SEVİYE YÜKSELTME, ÇALIŞAN VE FİYAT YÖNETİMİ
  // ============================================================================

  /**
   * Yeni bir Esnaf Dükkânı / Mağaza Şubesi açar (`openShop`):
   * - Kuruluş + dekorasyon + başlangıç kasa sermayesini tek seferde düşer.
   * - Dükkân için ayrı işletme kasası (`cashAccountBalance`) oluşturur ve başlangıç stoğu hediye etmez;
   *   ancak isteğe bağlı başlangıç kasa nakdi (`initialShopCash`) ile hemen sipariş verilebilir.
   */
  public static openShop(
    state: SimulationState,
    params: {
      shopType: ShopType;
      customNameTR?: string;
      cityBlockId?: string;
      initialWorkingCash?: number;
      reservedOrderCash: number;
    }
  ): {
    success: boolean;
    message: string;
    shop: ShopInstance | null;
    totalCapitalSpent: number;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const tpl = SHOP_TEMPLATES[params.shopType];
    if (!tpl) {
      return {
        success: false,
        message: 'Geçersiz dükkân türü seçildi.',
        shop: null,
        totalCapitalSpent: 0,
      };
    }

    const setupCost = Number((tpl.openingCost + tpl.decorationCost).toFixed(2));
    const initialWorkingCash = Number(
      Math.max(0, params.initialWorkingCash ?? Math.round(setupCost * 0.25)).toFixed(2)
    );
    const totalNeeded = Number((setupCost + initialWorkingCash).toFixed(2));

    const isCompanyBranch = state.playerCompany !== null;
    const spendablePlayerCash = Number(
      Math.max(0, state.cash - params.reservedOrderCash).toFixed(2)
    );

    if (isCompanyBranch && state.playerCompany) {
      const pc = state.playerCompany;
      if (pc.financials.cash < totalNeeded) {
        return {
          success: false,
          message: `${tpl.nameTR} şubesi açmak için gereken ₺${totalNeeded.toLocaleString('tr-TR')} (Kurulum: ₺${setupCost.toLocaleString('tr-TR')} + İşletme Kasası: ₺${initialWorkingCash.toLocaleString('tr-TR')}) şirket kasasında mevcut değil.`,
          shop: null,
          totalCapitalSpent: 0,
        };
      }
      // Şirket şubesi açılışı: Nakit azalır, sabit kıymet (fixedAssets) setupCost kadar artar, şube kasası initialWorkingCash tutar
      pc.financials.cash = Number(
        (pc.financials.cash - setupCost).toFixed(2)
      );
      pc.capitalCash = pc.financials.cash;
      pc.financials.fixedAssets = Number(
        (pc.financials.fixedAssets + setupCost).toFixed(2)
      );
      pc.financials.totalAssets = Number(
        (
          pc.financials.cash +
          pc.financials.inventory +
          pc.financials.receivables +
          pc.financials.fixedAssets
        ).toFixed(2)
      );
      CentralLedgerEngine.recordPostedAccountingEntry(state, {
        idempotencyKey: `SHOP-OPEN-COMP-D${state.day}-S${ts.shopSeq + 1}`,
        sourceAccountId: ACCOUNT_IDS.companyBank(pc.ticker),
        destinationAccountId: ACCOUNT_IDS.FIXED_ASSET,
        amount: setupCost,
        category: 'CAPEX_INVESTMENT',
        description: `${tpl.nameTR} yeni mağaza şubesi açılış ve dekorasyon yatırımı`,
        relatedCompanyId: pc.ticker,
        reservedOrderCash: params.reservedOrderCash,
      });
    } else {
      if (spendablePlayerCash < totalNeeded) {
        return {
          success: false,
          message: `${tpl.nameTR} açmak için gereken ₺${totalNeeded.toLocaleString('tr-TR')} (Kurulum & Dekorasyon: ₺${setupCost.toLocaleString('tr-TR')} + Dükkân Kasası: ₺${initialWorkingCash.toLocaleString('tr-TR')}) kullanılabilir nakdinizi (₺${spendablePlayerCash.toLocaleString('tr-TR')}) aşıyor.`,
          shop: null,
          totalCapitalSpent: 0,
        };
      }
      state.cash = Number((state.cash - totalNeeded).toFixed(2));
      CentralLedgerEngine.recordPostedAccountingEntry(state, {
        idempotencyKey: `SHOP-OPEN-PLAYER-D${state.day}-S${ts.shopSeq + 1}`,
        sourceAccountId: ACCOUNT_IDS.PLAYER_INVESTMENT,
        destinationAccountId: ACCOUNT_IDS.FIXED_ASSET,
        amount: totalNeeded,
        category: 'CAPEX_INVESTMENT',
        description: `${tpl.nameTR} esnaf dükkânı açılış ve işletme kasası tahsisi`,
        reservedOrderCash: params.reservedOrderCash,
      });
    }

    ts.shopSeq += 1;
    const branchNumber =
      ts.shops.filter((s) => s.shopType === params.shopType).length + 1;
    const shopId = `SHOP-${params.shopType}-${String(ts.shopSeq).padStart(4, '0')}`;
    const defaultSellingPrices: Record<string, number> = {};
    for (const resId of tpl.allowedResourceIds) {
      const resDef = RESOURCE_CATALOG[resId];
      if (resDef) {
        defaultSellingPrices[resId] = Number(
          (
            resDef.baseMarketPrice *
            (1 + tpl.defaultGrossMarginPct / 100)
          ).toFixed(2)
        );
      }
    }

    const newShop: ShopInstance = {
      shopId,
      shopType: params.shopType,
      nameTR:
        params.customNameTR?.trim() ||
        `${tpl.nameTR} #${branchNumber}`,
      cityBlockId: params.cityBlockId || tpl.defaultCityBlockId,
      level: 1,
      openedDay: state.day,
      isCompanyBranch,
      cashAccountBalance: isCompanyBranch ? 0 : initialWorkingCash,
      totalInvestedCapital: setupCost,
      dailyRent: tpl.dailyRentBase,
      staffCount: tpl.minStaffRequired,
      minStaffRequired: tpl.minStaffRequired,
      staffDailyWagePerPerson: tpl.staffDailyWagePerPerson,
      maxCustomerCapacity: tpl.baseCustomerCapacity,
      shelfCapacity: tpl.baseShelfCapacity,
      backroomCapacity: tpl.baseBackroomCapacity,
      inventoryBatches: [],
      sellingPrices: defaultSellingPrices,
      autoReplenishEnabled: true,
      customerSatisfaction: 78,
      reputationScore: 70,
      todayWalkInCustomers: 0,
      todayServedCustomers: 0,
      todayUnmetCustomerDemand: 0,
      todayUnitsSold: 0,
      todaySalesRevenue: 0,
      todayCogs: 0,
      todayRentAndOpex: 0,
      todayPayrollCost: 0,
      todaySpoilageUnits: 0,
      todaySpoilageCost: 0,
      todayNetProfit: 0,
      cumulativeRevenue: 0,
      cumulativeNetProfit: 0,
      dailyProfitHistory30: [],
      pendingDeliveriesCount: 0,
      mainIssueTR: 'Raflarda ürün yok — satış başlaması için ürün sipariş edin.',
      recommendedActionTR: 'Tedarikçiden ilk ürün siparişini verin.',
      specificState: {
        spoilageRateMultiplier: 1.0,
        tableCount: params.shopType === 'KAFE' ? 12 : 0,
        seasonalCollectionActive: params.shopType === 'GIYIM_MAGAZASI',
        warrantySatisfactionBonus:
          params.shopType === 'ELEKTRONIK_MAGAZASI' ? 8 : 0,
        deliveryServiceCapacity:
          params.shopType === 'MOBILYA_MAGAZASI' ? 10 : 0,
        activeCategoryCount: 0,
        showroomSlots: params.shopType === 'OTOMOBIL_GALERISI' ? 6 : 0,
      },
    };

    ts.shops.push(newShop);
    TradeAndShopEngine.updateCareerStage(state);

    return {
      success: true,
      message: `${newShop.nameTR} başarıyla açıldı! Satışa başlamak için tedarikçiden ürün sipariş edebilirsiniz.`,
      shop: newShop,
      totalCapitalSpent: totalNeeded,
    };
  }

  /**
   * Dükkân Seviyesini Yükseltir (Seviye 1 -> 2 -> 3 -> 4 -> 5):
   * - Raf, arka depo ve müşteri kapasitesini artırır.
   * - Kira ve personel ihtiyacını gerçekçi biçimde büyütür.
   * - Şehirdeki bina görselini büyütür.
   */
  public static upgradeShopLevel(
    state: SimulationState,
    shopId: string,
    reservedOrderCash: number
  ): {
    success: boolean;
    message: string;
    newLevel: number;
    costPaid: number;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const shop = ts.shops.find((s) => s.shopId === shopId);
    if (!shop) {
      return {
        success: false,
        message: 'Geliştirilecek dükkân bulunamadı.',
        newLevel: 1,
        costPaid: 0,
      };
    }

    if (shop.level >= 5) {
      return {
        success: false,
        message: `${shop.nameTR} zaten maksimum seviyede (Seviye 5 - Prestij Mağaza).`,
        newLevel: shop.level,
        costPaid: 0,
      };
    }

    const tpl = SHOP_TEMPLATES[shop.shopType];
    const upgradeCost = tpl.levelUpgradeCosts[shop.level - 1];

    if (shop.isCompanyBranch && state.playerCompany) {
      const pc = state.playerCompany;
      if (pc.financials.cash < upgradeCost) {
        return {
          success: false,
          message: `Şube geliştirme maliyeti (₺${upgradeCost.toLocaleString('tr-TR')}) şirket kasasında mevcut değil.`,
          newLevel: shop.level,
          costPaid: 0,
        };
      }
      pc.financials.cash = Number((pc.financials.cash - upgradeCost).toFixed(2));
      pc.capitalCash = pc.financials.cash;
      pc.financials.fixedAssets = Number(
        (pc.financials.fixedAssets + upgradeCost).toFixed(2)
      );
      pc.financials.totalAssets = Number(
        (
          pc.financials.cash +
          pc.financials.inventory +
          pc.financials.receivables +
          pc.financials.fixedAssets
        ).toFixed(2)
      );
    } else {
      // Önce dükkân kasasından, yetmezse oyuncu nakdinden karşıla
      const availableShopCash = shop.cashAccountBalance;
      const spendablePlayerCash = Math.max(0, state.cash - reservedOrderCash);
      if (availableShopCash + spendablePlayerCash < upgradeCost) {
        return {
          success: false,
          message: `${shop.nameTR} Seviye ${shop.level + 1} geliştirme maliyeti (₺${upgradeCost.toLocaleString('tr-TR')}) için yeterli bakiye yok.`,
          newLevel: shop.level,
          costPaid: 0,
        };
      }
      const fromShop = Math.min(availableShopCash, upgradeCost);
      const fromPlayer = Number((upgradeCost - fromShop).toFixed(2));
      shop.cashAccountBalance = Number(
        (shop.cashAccountBalance - fromShop).toFixed(2)
      );
      if (fromPlayer > 0) {
        state.cash = Number((state.cash - fromPlayer).toFixed(2));
      }
    }

    shop.level = (shop.level + 1) as 1 | 2 | 3 | 4 | 5;
    shop.totalInvestedCapital = Number(
      (shop.totalInvestedCapital + upgradeCost).toFixed(2)
    );
    const levelMult = 1 + (shop.level - 1) * 0.45;
    shop.maxCustomerCapacity = Math.round(tpl.baseCustomerCapacity * levelMult);
    shop.shelfCapacity = Math.round(tpl.baseShelfCapacity * levelMult);
    shop.backroomCapacity = Math.round(tpl.baseBackroomCapacity * levelMult);
    shop.minStaffRequired =
      tpl.minStaffRequired + Math.floor((shop.level - 1) * 1.5);
    shop.staffCount = Math.max(shop.staffCount, shop.minStaffRequired);
    shop.dailyRent = Math.round(tpl.dailyRentBase * (1 + (shop.level - 1) * 0.35));
    shop.customerSatisfaction = Number(
      Math.min(98, shop.customerSatisfaction + 3).toFixed(1)
    );
    shop.reputationScore = Number(
      Math.min(98, shop.reputationScore + 4).toFixed(1)
    );

    if (shop.shopType === 'MANAV') {
      shop.specificState.spoilageRateMultiplier = Math.max(
        0.4,
        1 - (shop.level - 1) * 0.14
      );
    } else if (shop.shopType === 'KAFE') {
      shop.specificState.tableCount = 12 + (shop.level - 1) * 8;
    } else if (shop.shopType === 'MOBILYA_MAGAZASI') {
      shop.specificState.deliveryServiceCapacity = 10 + (shop.level - 1) * 6;
    } else if (shop.shopType === 'OTOMOBIL_GALERISI') {
      shop.specificState.showroomSlots = 6 + (shop.level - 1) * 4;
    }

    return {
      success: true,
      message: `${shop.nameTR} Seviye ${shop.level} kademesine yükseltildi! Raf kapasitesi: ${shop.shelfCapacity}, Müşteri kapasitesi: ${shop.maxCustomerCapacity}/gün.`,
      newLevel: shop.level,
      costPaid: upgradeCost,
    };
  }

  /**
   * Kişisel Nakit ile Dükkân Kasası Arasında Kontrollü Para Transferi
   */
  public static transferBetweenPersonalAndShopCash(
    state: SimulationState,
    params: {
      shopId: string;
      amount: number;
      direction: 'PERSONAL_TO_SHOP' | 'SHOP_TO_PERSONAL';
      reservedOrderCash: number;
    }
  ): {
    success: boolean;
    message: string;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const shop = ts.shops.find((s) => s.shopId === params.shopId);
    if (!shop) {
      return { success: false, message: 'Dükkân bulunamadı.' };
    }
    if (shop.isCompanyBranch) {
      return {
        success: false,
        message:
          'Bu şube kurumsal şirkete bağlıdır; şirket para transferlerini Banka / Finans sekmesinden yapabilirsiniz.',
      };
    }

    const cleanAmount = Number(
      (Number.isFinite(params.amount) ? params.amount : 0).toFixed(2)
    );
    if (cleanAmount <= 0) {
      return {
        success: false,
        message: 'Transfer tutarı sıfırdan büyük olmalıdır.',
      };
    }

    if (params.direction === 'PERSONAL_TO_SHOP') {
      const spendable = Math.max(0, state.cash - params.reservedOrderCash);
      if (cleanAmount > spendable) {
        return {
          success: false,
          message: `Kişisel kullanılabilir nakit (₺${spendable.toLocaleString('tr-TR')}) yetersiz.`,
        };
      }
      state.cash = Number((state.cash - cleanAmount).toFixed(2));
      shop.cashAccountBalance = Number(
        (shop.cashAccountBalance + cleanAmount).toFixed(2)
      );
      return {
        success: true,
        message: `${shop.nameTR} kasasına ₺${cleanAmount.toLocaleString('tr-TR')} işletme nakdi aktarıldı.`,
      };
    } else {
      if (cleanAmount > shop.cashAccountBalance) {
        return {
          success: false,
          message: `${shop.nameTR} kasasında çekilebilir en fazla ₺${shop.cashAccountBalance.toLocaleString('tr-TR')} bulunuyor.`,
        };
      }
      shop.cashAccountBalance = Number(
        (shop.cashAccountBalance - cleanAmount).toFixed(2)
      );
      state.cash = Number((state.cash + cleanAmount).toFixed(2));
      return {
        success: true,
        message: `${shop.nameTR} kasasından kişisel hesaba ₺${cleanAmount.toLocaleString('tr-TR')} kâr/nakit çekildi.`,
      };
    }
  }

  public static configureShopParameters(
    state: SimulationState,
    params: {
      shopId: string;
      targetStaffCount?: number;
      resourceIdForPrice?: string;
      newSellingPrice?: number;
      autoReplenishEnabled?: boolean;
    }
  ): {
    success: boolean;
    message: string;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const shop = ts.shops.find((s) => s.shopId === params.shopId);
    if (!shop) {
      return { success: false, message: 'Dükkân bulunamadı.' };
    }

    const messages: string[] = [];

    if (typeof params.targetStaffCount === 'number') {
      const nextStaff = Math.max(
        1,
        Math.min(40, Math.round(params.targetStaffCount))
      );
      shop.staffCount = nextStaff;
      if (shop.isCompanyBranch && state.playerCompany) {
        // Şirket toplam çalışan sayısını da senkron tut
        const totalBranchStaff = ts.shops
          .filter((s) => s.isCompanyBranch)
          .reduce((sum, s) => sum + s.staffCount, 0);
        if (state.playerCompany.staffCount < totalBranchStaff) {
          state.playerCompany.staffCount = totalBranchStaff;
          state.playerCompany.financials.staffCount = totalBranchStaff;
        }
      }
      messages.push(`Çalışan sayısı ${nextStaff} kişi olarak güncellendi.`);
    }

    if (
      params.resourceIdForPrice &&
      typeof params.newSellingPrice === 'number' &&
      params.newSellingPrice > 0
    ) {
      const cleanPrice = Number(params.newSellingPrice.toFixed(2));
      shop.sellingPrices[params.resourceIdForPrice] = cleanPrice;
      const resName =
        RESOURCE_CATALOG[params.resourceIdForPrice]?.nameTR ||
        params.resourceIdForPrice;
      messages.push(`${resName} satış fiyatı ₺${cleanPrice.toLocaleString('tr-TR')} yapıldı.`);
    }

    if (typeof params.autoReplenishEnabled === 'boolean') {
      shop.autoReplenishEnabled = params.autoReplenishEnabled;
      messages.push(
        `Otomatik stok ikmali ${params.autoReplenishEnabled ? 'açıldı' : 'kapatıldı'}.`
      );
    }

    return {
      success: true,
      message:
        messages.join(' ') || `${shop.nameTR} ayarları güncellendi.`,
    };
  }

  // ============================================================================
  // 6. TEDARİKÇİ TEKLİFLERİ, SATIN ALMA SİPARİŞLERİ VE TEDARİK SÖZLEŞMELERİ
  // ============================================================================

  /**
   * Mevcut oyun günü ve aktif piyasa/ticaret olaylarına göre tedarikçi tekliflerini (`SupplierOffer`) üretir.
   */
  public static getSupplierOffers(
    state: SimulationState,
    filterResourceId?: string
  ): SupplierOffer[] {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const offers: SupplierOffer[] = [];

    for (const sup of ts.suppliers) {
      for (const resId of sup.suppliedResourceIds) {
        if (filterResourceId && resId !== filterResourceId) continue;
        const resDef = RESOURCE_CATALOG[resId];
        if (!resDef) continue;

        let eventPriceMult = 1.0;
        let eventDelayAdd = 0;
        for (const ev of ts.activeTradeEvents) {
          if (
            ev.isActive &&
            (ev.affectedSector === 'ALL' ||
              ev.affectedSector === resDef.sector ||
              ev.affectedResourceId === resId)
          ) {
            eventPriceMult *= ev.priceImpactMultiplier;
            eventDelayAdd += ev.delayDaysAdded;
          }
        }

        const unitPrice = Number(
          (
            resDef.baseMarketPrice *
            sup.basePriceMultiplier *
            eventPriceMult
          ).toFixed(2)
        );
        const shippingCostPerUnit = Number(
          Math.max(
            2,
            resDef.unitWeightKg * 0.65 * (sup.deliverySpeedDays === 1 ? 1.1 : 0.9)
          ).toFixed(2)
        );

        offers.push({
          offerId: `OFFER-${sup.supplierId}-${resId}`,
          supplierId: sup.supplierId,
          supplierNameTR: sup.nameTR,
          resourceId: resId,
          resourceNameTR: resDef.nameTR,
          unitPrice,
          minOrderQuantity: resDef.minOrderQty,
          maxAvailableQuantity: sup.maxDailyCapacity,
          deliveryDays: Math.max(1, sup.deliverySpeedDays + eventDelayAdd),
          shippingCostPerUnit,
          qualityScore: sup.qualityScore,
          reliabilityScore: sup.reliabilityScore,
          paymentTermDays: sup.paymentTermDaysAllowed,
        });
      }
    }

    return offers;
  }

  /**
   * Tedarikçiden Hammadde, Ara Ürün veya Ticari Mal Siparişi Oluşturur (`placeProcurementOrder`):
   * - Sipariş verildiği anda stok ANINDA ARTMAZ!
   * - `Shipment` nesnesi `IN_TRANSIT` olarak oluşturulur ve teslimat gününde (`estimatedArrivalDay`) depoya/dükkâna girer.
   * - `idempotencyKey` ile aynı siparişin iki kez işlenmesi kesin olarak engellenir.
   * - Hedef depo veya dükkân arka deposunda yeterli boş kapasite yoksa siparişi reddeder.
   */
  public static placeProcurementOrder(
    state: SimulationState,
    params: {
      supplierId: string;
      resourceId: string;
      quantity: number;
      targetDestinationType: 'WAREHOUSE' | 'SHOP';
      targetDestinationId: string;
      paymentMethod?: 'CASH' | 'CREDIT';
      idempotencyKey?: string;
      reservedOrderCash: number;
      lockedUnitPriceOverride?: number;
    }
  ): {
    success: boolean;
    message: string;
    order: ProcurementOrder | null;
    shipment: Shipment | null;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const supplier = ts.suppliers.find(
      (s) => s.supplierId === params.supplierId
    );
    const resDef = RESOURCE_CATALOG[params.resourceId];

    if (!supplier || !resDef) {
      return {
        success: false,
        message: 'Geçersiz tedarikçi veya ürün seçimi.',
        order: null,
        shipment: null,
      };
    }

    if (!supplier.suppliedResourceIds.includes(params.resourceId)) {
      return {
        success: false,
        message: `${supplier.nameTR} bu ürünü (${resDef.nameTR}) tedarik etmiyor.`,
        order: null,
        shipment: null,
      };
    }

    const qty = Math.floor(params.quantity);
    if (!Number.isFinite(qty) || qty < resDef.minOrderQty) {
      return {
        success: false,
        message: `${resDef.nameTR} için minimum sipariş miktarı ${resDef.minOrderQty} ${resDef.unitLabel} olmalıdır.`,
        order: null,
        shipment: null,
      };
    }

    if (qty > supplier.maxDailyCapacity) {
      return {
        success: false,
        message: `${supplier.nameTR} günlük maksimum ${supplier.maxDailyCapacity} ${resDef.unitLabel} tedarik edebilir.`,
        order: null,
        shipment: null,
      };
    }

    const idemKey =
      params.idempotencyKey?.trim() ||
      `PROC-D${state.day}-M${state.totalElapsedGameMinutes}-S${ts.orderSeq + 1}`;
    if (ts.processedOrderIds.includes(idemKey)) {
      return {
        success: false,
        message: `Mükerrer satın alma siparişi engellendi (${idemKey}).`,
        order: null,
        shipment: null,
      };
    }

    // Hedef depo veya dükkân kapasite kontrolü (mevcut stok + yoldaki teslimatlar <= maxCapacity)
    let destNameTR = '';
    let freeSpace = 0;

    if (params.targetDestinationType === 'WAREHOUSE') {
      const wh = ts.warehouses.find(
        (w) => w.warehouseId === params.targetDestinationId
      );
      if (!wh) {
        return {
          success: false,
          message: 'Hedef depo bulunamadı.',
          order: null,
          shipment: null,
        };
      }
      destNameTR = wh.nameTR;
      const incomingToWh = ts.shipments
        .filter(
          (sh) =>
            sh.destinationType === 'WAREHOUSE' &&
            sh.destinationId === wh.warehouseId &&
            (sh.status === 'IN_TRANSIT' ||
              sh.status === 'LOADING' ||
              sh.status === 'DELAYED')
        )
        .reduce((s, sh) => s + sh.quantity, 0);
      freeSpace = Math.max(
        0,
        wh.maxCapacityUnits - wh.usedCapacityUnits - incomingToWh
      );
    } else {
      const shop = ts.shops.find(
        (s) => s.shopId === params.targetDestinationId
      );
      if (!shop) {
        return {
          success: false,
          message: 'Hedef dükkân bulunamadı.',
          order: null,
          shipment: null,
        };
      }
      destNameTR = shop.nameTR;
      const currentShopStock = shop.inventoryBatches.reduce(
        (s, b) => s + b.quantity,
        0
      );
      const incomingToShop = ts.shipments
        .filter(
          (sh) =>
            sh.destinationType === 'SHOP' &&
            sh.destinationId === shop.shopId &&
            (sh.status === 'IN_TRANSIT' ||
              sh.status === 'LOADING' ||
              sh.status === 'DELAYED')
        )
        .reduce((s, sh) => s + sh.quantity, 0);
      const totalCap = shop.shelfCapacity + shop.backroomCapacity;
      freeSpace = Math.max(0, totalCap - currentShopStock - incomingToShop);
    }

    if (qty > freeSpace) {
      return {
        success: false,
        message: `${destNameTR} içinde yeterli boş depolama alanı yok (İstenen: ${qty}, Boş Kapasite: ${freeSpace}).`,
        order: null,
        shipment: null,
      };
    }

    // Birim fiyat, toplu alım indirimi ve nakliye hesabı
    const offers = TradeAndShopEngine.getSupplierOffers(state, params.resourceId);
    const matchedOffer = offers.find((o) => o.supplierId === supplier.supplierId);
    let baseUnitPrice =
      params.lockedUnitPriceOverride ??
      matchedOffer?.unitPrice ??
      Number((resDef.baseMarketPrice * supplier.basePriceMultiplier).toFixed(2));

    if (
      !params.lockedUnitPriceOverride &&
      qty >= supplier.volumeDiscountThreshold
    ) {
      baseUnitPrice = Number(
        (baseUnitPrice * (1 - supplier.volumeDiscountPct / 100)).toFixed(2)
      );
    }

    const subtotalCost = Number((qty * baseUnitPrice).toFixed(2));
    const shippingPerUnit = matchedOffer?.shippingCostPerUnit ?? 5;
    const shippingCost = Number((qty * shippingPerUnit).toFixed(2));
    const taxAmount = 0; // KDV mahsuplaşması net maliyet bazında izlenir
    const totalCost = Number((subtotalCost + shippingCost + taxAmount).toFixed(2));

    const paymentMethod = params.paymentMethod ?? 'CASH';
    if (paymentMethod === 'CREDIT' && supplier.paymentTermDaysAllowed <= 0) {
      return {
        success: false,
        message: `${supplier.nameTR} yalnızca peşin ödeme kabul etmektedir.`,
        order: null,
        shipment: null,
      };
    }

    // Ödeme veya Borç Kaydı (Tek Sefer!)
    let paidAmount = 0;
    let payableAmount = 0;
    const dueDay =
      paymentMethod === 'CREDIT'
        ? state.day + supplier.paymentTermDaysAllowed
        : state.day;

    const targetShop =
      params.targetDestinationType === 'SHOP'
        ? ts.shops.find((s) => s.shopId === params.targetDestinationId)
        : undefined;
    const useCompanyAccount = Boolean(
      state.playerCompany &&
        (params.targetDestinationType === 'WAREHOUSE' ||
          targetShop?.isCompanyBranch)
    );

    if (paymentMethod === 'CASH') {
      if (useCompanyAccount && state.playerCompany) {
        const pc = state.playerCompany;
        if (pc.financials.cash < totalCost) {
          return {
            success: false,
            message: `Sipariş tutarı (₺${totalCost.toLocaleString('tr-TR')}) şirket kasasında (₺${pc.financials.cash.toLocaleString('tr-TR')}) mevcut değil.`,
            order: null,
            shipment: null,
          };
        }
        // Şirket nakdi azalır, yoldaki stok varlığı (inventory) aynı tutarda artar -> bilanço denkliği korunur!
        pc.financials.cash = Number((pc.financials.cash - totalCost).toFixed(2));
        pc.capitalCash = pc.financials.cash;
        pc.financials.inventory = Number(
          (pc.financials.inventory + totalCost).toFixed(2)
        );
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
          ).toFixed(2)
        );
      } else if (targetShop && !targetShop.isCompanyBranch) {
        // Bağımsız esnaf dükkânı: önce dükkân kasasından, yetmezse kişisel kullanılabilir nakitten öde
        const shopCash = targetShop.cashAccountBalance;
        const spendablePersonal = Math.max(
          0,
          state.cash - params.reservedOrderCash
        );
        if (shopCash + spendablePersonal < totalCost) {
          return {
            success: false,
            message: `Sipariş tutarı (₺${totalCost.toLocaleString('tr-TR')}) için dükkân kasası (₺${shopCash.toLocaleString('tr-TR')}) ve kişisel nakit (₺${spendablePersonal.toLocaleString('tr-TR')}) yetersiz.`,
            order: null,
            shipment: null,
          };
        }
        const paidFromShop = Math.min(shopCash, totalCost);
        const paidFromPersonal = Number((totalCost - paidFromShop).toFixed(2));
        targetShop.cashAccountBalance = Number(
          (targetShop.cashAccountBalance - paidFromShop).toFixed(2)
        );
        if (paidFromPersonal > 0) {
          state.cash = Number((state.cash - paidFromPersonal).toFixed(2));
          targetShop.totalInvestedCapital = Number(
            (targetShop.totalInvestedCapital + paidFromPersonal).toFixed(2)
          );
        }
      } else {
        const spendablePersonal = Math.max(
          0,
          state.cash - params.reservedOrderCash
        );
        if (spendablePersonal < totalCost) {
          return {
            success: false,
            message: `Sipariş tutarı (₺${totalCost.toLocaleString('tr-TR')}) kullanılabilir nakdinizi aşıyor.`,
            order: null,
            shipment: null,
          };
        }
        state.cash = Number((state.cash - totalCost).toFixed(2));
      }
      paidAmount = totalCost;
    } else {
      // Vadeli Alım (CREDIT): Tedarikçi borcu ve fatura oluştur
      payableAmount = totalCost;
      if (useCompanyAccount && state.playerCompany) {
        const pc = state.playerCompany;
        pc.supplierPayableBalance = Number(
          ((pc.supplierPayableBalance ?? 0) + totalCost).toFixed(2)
        );
        pc.financials.inventory = Number(
          (pc.financials.inventory + totalCost).toFixed(2)
        );
        pc.financials.shortTermDebt = Number(
          (pc.financials.shortTermDebt + totalCost).toFixed(2)
        );
        pc.financials.totalLiabilities = Number(
          (pc.financials.shortTermDebt + pc.financials.longTermDebt).toFixed(2)
        );
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
          ).toFixed(2)
        );
      }
    }

    ts.orderSeq += 1;
    ts.shipmentSeq += 1;
    const orderId = `PO-D${state.day}-S${String(ts.orderSeq).padStart(6, '0')}`;
    const shipmentId = `SHP-D${state.day}-S${String(ts.shipmentSeq).padStart(6, '0')}`;
    const deliveryDays = matchedOffer?.deliveryDays ?? supplier.deliverySpeedDays;
    const estimatedArrivalDay = state.day + Math.max(1, deliveryDays);
    const effectiveUnitCost = Number((totalCost / qty).toFixed(2));

    const order: ProcurementOrder = {
      orderId,
      supplierId: supplier.supplierId,
      supplierNameTR: supplier.nameTR,
      resourceId: resDef.id,
      resourceNameTR: resDef.nameTR,
      orderedQuantity: qty,
      deliveredQuantity: 0,
      unitPrice: baseUnitPrice,
      subtotalCost,
      shippingCost,
      taxAmount,
      totalCost,
      qualityScore: supplier.qualityScore,
      paymentMethod,
      paidAmount,
      payableAmount,
      dueDay,
      createdDay: state.day,
      estimatedArrivalDay,
      actualArrivalDay: null,
      targetDestinationType: params.targetDestinationType,
      targetDestinationId: params.targetDestinationId,
      targetDestinationNameTR: destNameTR,
      status: 'IN_TRANSIT',
      shipmentId,
      idempotencyKey: idemKey,
    };

    const shipment: Shipment = {
      shipmentId,
      sourceType: 'SUPPLIER',
      sourceId: supplier.supplierId,
      sourceNameTR: supplier.nameTR,
      destinationType: params.targetDestinationType,
      destinationId: params.targetDestinationId,
      destinationNameTR: destNameTR,
      resourceId: resDef.id,
      resourceNameTR: resDef.nameTR,
      quantity: qty,
      deliveredQuantity: 0,
      damagedQuantity: 0,
      unitCostBasis: effectiveUnitCost,
      qualityScore: supplier.qualityScore,
      logisticsMode: 'EXTERNAL_LOGISTICS',
      vehicleId: null,
      shippingCost,
      dispatchedDay: state.day,
      estimatedArrivalDay,
      actualArrivalDay: null,
      status: 'IN_TRANSIT',
      relatedOrderId: orderId,
    };

    ts.processedOrderIds.push(idemKey);
    ts.procurementOrders.unshift(order);
    ts.shipments.unshift(shipment);
    ts.todaySummary.procurementSpend = Number(
      (ts.todaySummary.procurementSpend + paidAmount).toFixed(2)
    );
    ts.todaySummary.logisticsCost = Number(
      (ts.todaySummary.logisticsCost + shippingCost).toFixed(2)
    );

    if (targetShop) {
      targetShop.pendingDeliveriesCount = ts.shipments.filter(
        (sh) =>
          sh.destinationType === 'SHOP' &&
          sh.destinationId === targetShop.shopId &&
          (sh.status === 'IN_TRANSIT' || sh.status === 'DELAYED')
      ).length;
    }

    if (paymentMethod === 'CREDIT') {
      ts.invoiceSeq += 1;
      const invoice: TradeInvoice = {
        invoiceId: `INV-PAY-D${state.day}-S${String(ts.invoiceSeq).padStart(6, '0')}`,
        direction: 'PAYABLE',
        counterpartyNameTR: supplier.nameTR,
        relatedOrderId: orderId,
        relatedShopId: targetShop?.shopId,
        issueDay: state.day,
        dueDay,
        totalAmount: totalCost,
        paidAmount: 0,
        remainingAmount: totalCost,
        lateFeeAccrued: 0,
        status: 'ISSUED',
      };
      ts.invoices.unshift(invoice);
    }

    return {
      success: true,
      message: `${supplier.nameTR} firmasından ${qty} ${resDef.unitLabel} ${resDef.nameTR} sipariş edildi (Toplam: ₺${totalCost.toLocaleString('tr-TR')}, Tahmini Teslimat: Gün ${estimatedArrivalDay}).`,
      order,
      shipment,
    };
  }

  /**
   * Henüz teslim edilmemiş bir satın alma siparişini iptal eder ve ödemeyi/borcu geri alır.
   */
  public static cancelProcurementOrder(
    state: SimulationState,
    orderId: string
  ): {
    success: boolean;
    message: string;
    refundedAmount: number;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const order = ts.procurementOrders.find((o) => o.orderId === orderId);
    if (!order) {
      return {
        success: false,
        message: 'İptal edilecek sipariş bulunamadı.',
        refundedAmount: 0,
      };
    }

    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      return {
        success: false,
        message: `Bu sipariş (${order.status}) durumunda olduğu için iptal edilemez.`,
        refundedAmount: 0,
      };
    }

    order.status = 'CANCELLED';
    const shipment = ts.shipments.find((s) => s.shipmentId === order.shipmentId);
    if (shipment) {
      shipment.status = 'CANCELLED';
    }

    const targetShop =
      order.targetDestinationType === 'SHOP'
        ? ts.shops.find((s) => s.shopId === order.targetDestinationId)
        : undefined;
    const useCompanyAccount = Boolean(
      state.playerCompany &&
        (order.targetDestinationType === 'WAREHOUSE' ||
          targetShop?.isCompanyBranch)
    );

    let refundedAmount = 0;
    if (order.paymentMethod === 'CASH' && order.paidAmount > 0) {
      refundedAmount = order.paidAmount;
      if (useCompanyAccount && state.playerCompany) {
        const pc = state.playerCompany;
        pc.financials.cash = Number(
          (pc.financials.cash + refundedAmount).toFixed(2)
        );
        pc.capitalCash = pc.financials.cash;
        pc.financials.inventory = Number(
          Math.max(0, pc.financials.inventory - refundedAmount).toFixed(2)
        );
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
          ).toFixed(2)
        );
      } else if (targetShop && !targetShop.isCompanyBranch) {
        targetShop.cashAccountBalance = Number(
          (targetShop.cashAccountBalance + refundedAmount).toFixed(2)
        );
      } else {
        state.cash = Number((state.cash + refundedAmount).toFixed(2));
      }
      order.paidAmount = 0;
    } else if (order.paymentMethod === 'CREDIT' && order.payableAmount > 0) {
      const inv = ts.invoices.find(
        (i) => i.relatedOrderId === order.orderId && i.status !== 'PAID'
      );
      if (inv) {
        inv.status = 'CANCELLED';
        inv.remainingAmount = 0;
      }
      if (useCompanyAccount && state.playerCompany) {
        const pc = state.playerCompany;
        pc.supplierPayableBalance = Number(
          Math.max(
            0,
            (pc.supplierPayableBalance ?? 0) - order.payableAmount
          ).toFixed(2)
        );
        pc.financials.inventory = Number(
          Math.max(0, pc.financials.inventory - order.payableAmount).toFixed(2)
        );
        pc.financials.shortTermDebt = Number(
          Math.max(
            0,
            pc.financials.shortTermDebt - order.payableAmount
          ).toFixed(2)
        );
        pc.financials.totalLiabilities = Number(
          (pc.financials.shortTermDebt + pc.financials.longTermDebt).toFixed(2)
        );
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
          ).toFixed(2)
        );
      }
      order.payableAmount = 0;
    }

    if (targetShop) {
      targetShop.pendingDeliveriesCount = ts.shipments.filter(
        (sh) =>
          sh.destinationType === 'SHOP' &&
          sh.destinationId === targetShop.shopId &&
          (sh.status === 'IN_TRANSIT' || sh.status === 'DELAYED')
      ).length;
    }

    return {
      success: true,
      message: `${order.orderId} numaralı sipariş iptal edildi${refundedAmount > 0 ? ` ve ₺${refundedAmount.toLocaleString('tr-TR')} iade alındı` : ''}.`,
      refundedAmount,
    };
  }

  /**
   * Düzenli Tedarik Sözleşmesi (`PurchaseContract`) Oluşturur
   */
  public static createPurchaseContract(
    state: SimulationState,
    params: {
      supplierId: string;
      resourceId: string;
      targetDestinationType: 'WAREHOUSE' | 'SHOP';
      targetDestinationId: string;
      periodDays: number;
      orderQuantityPerTrigger: number;
      autoTriggerMode?: 'PERIODIC' | 'LOW_STOCK_THRESHOLD';
      lowStockThresholdUnits?: number;
      durationDays?: number;
      maxDailySpend?: number;
      minCashReserve?: number;
    }
  ): {
    success: boolean;
    message: string;
    contract: PurchaseContract | null;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const supplier = ts.suppliers.find(
      (s) => s.supplierId === params.supplierId
    );
    const resDef = RESOURCE_CATALOG[params.resourceId];
    if (!supplier || !resDef) {
      return {
        success: false,
        message: 'Geçersiz tedarikçi veya ürün.',
        contract: null,
      };
    }

    const discountPct = Math.min(14, supplier.volumeDiscountPct + 3);
    const lockedUnitPrice = Number(
      (
        resDef.baseMarketPrice *
        supplier.basePriceMultiplier *
        (1 - discountPct / 100)
      ).toFixed(2)
    );
    const duration = Math.max(7, params.durationDays ?? 60);
    const qty = Math.max(resDef.minOrderQty, Math.floor(params.orderQuantityPerTrigger));

    ts.contractSeq += 1;
    const contract: PurchaseContract = {
      contractId: `PC-D${state.day}-S${String(ts.contractSeq).padStart(5, '0')}`,
      supplierId: supplier.supplierId,
      supplierNameTR: supplier.nameTR,
      resourceId: resDef.id,
      resourceNameTR: resDef.nameTR,
      targetDestinationType: params.targetDestinationType,
      targetDestinationId: params.targetDestinationId,
      periodDays: Math.max(1, params.periodDays),
      autoTriggerMode: params.autoTriggerMode ?? 'LOW_STOCK_THRESHOLD',
      lowStockThresholdUnits: Math.max(10, params.lowStockThresholdUnits ?? qty),
      orderQuantityPerTrigger: qty,
      lockedUnitPrice,
      discountPct,
      minCommitmentUnits: qty * 3,
      earlyTerminationPenalty: Number((lockedUnitPrice * qty * 0.25).toFixed(2)),
      safetyLimits: {
        maxDailySpend: params.maxDailySpend ?? 250_000,
        minCashReserve: params.minCashReserve ?? 35_000,
        targetStockDays: 7,
        maxWarehouseFillPct: 85,
      },
      startDay: state.day,
      endDay: state.day + duration,
      lastTriggeredDay: 0,
      totalOrderedUnits: 0,
      isActive: true,
    };

    ts.purchaseContracts.unshift(contract);
    return {
      success: true,
      message: `${supplier.nameTR} ile ${resDef.nameTR} için %${discountPct} indirimli (₺${lockedUnitPrice}/birim) otomatik tedarik sözleşmesi imzalandı.`,
      contract,
    };
  }

  // ============================================================================
  // 7. SEVKİYAT VE TESLİMAT İLERLETMESİ (Çift Teslimat Korumalı)
  // ============================================================================

  public static advanceShipmentsAndDeliveries(
    state: SimulationState,
    rng?: RandomEngine
  ): {
    deliveredCount: number;
    delayedCount: number;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    let deliveredCount = 0;
    let delayedCount = 0;

    for (const sh of ts.shipments) {
      if (sh.status !== 'IN_TRANSIT' && sh.status !== 'DELAYED') continue;
      if (ts.deliveredShipmentIds.includes(sh.shipmentId)) {
        sh.status = 'DELIVERED';
        continue;
      }

      if (state.day < sh.estimatedArrivalDay) {
        continue;
      }

      // Teslimat günü geldi: Gecikme olasılığı henüz uygulanmadıysa kontrol et
      const supplier = ts.suppliers.find((s) => s.supplierId === sh.sourceId);
      const reliability = supplier ? supplier.reliabilityScore : 92;
      const delayRoll = rng ? rng.uniform() : 0.99;
      if (
        sh.status === 'IN_TRANSIT' &&
        reliability < 85 &&
        delayRoll < (85 - reliability) * 0.008
      ) {
        sh.status = 'DELAYED';
        sh.estimatedArrivalDay += 1;
        delayedCount += 1;
        continue;
      }

      // Hasar kontrolü (çok düşük oranlı)
      const damageRoll = rng ? rng.uniform() : 0.99;
      const damagedUnits =
        damageRoll < 0.03 && sh.quantity >= 20
          ? Math.max(1, Math.floor(sh.quantity * 0.02))
          : 0;
      const goodUnits = Math.max(0, sh.quantity - damagedUnits);

      const resDef = RESOURCE_CATALOG[sh.resourceId];
      if (!resDef) continue;

      // Hedefe teslim et
      let actualStored = 0;
      if (sh.destinationType === 'WAREHOUSE') {
        const wh =
          ts.warehouses.find((w) => w.warehouseId === sh.destinationId) ||
          ts.warehouses[0];
        if (wh) {
          const freeSpace = Math.max(
            0,
            wh.maxCapacityUnits - wh.usedCapacityUnits
          );
          actualStored = Math.min(goodUnits, freeSpace);
          if (actualStored > 0) {
            TradeAndShopEngine.addBatchToInventoryList(
              ts,
              wh.batches,
              {
                resourceId: resDef.id,
                resourceNameTR: resDef.nameTR,
                category: resDef.category,
                quantity: actualStored,
                unitCost: sh.unitCostBasis,
                qualityScore: sh.qualityScore,
                receivedDay: state.day,
                spoilageRateDaily: resDef.spoilageRateDaily,
                sourceOrderId: sh.relatedOrderId,
              }
            );
            wh.usedCapacityUnits = wh.batches.reduce(
              (s, b) => s + b.quantity,
              0
            );
          }
        }
      } else if (sh.destinationType === 'SHOP') {
        const shop = ts.shops.find((s) => s.shopId === sh.destinationId);
        if (shop) {
          const currentStock = shop.inventoryBatches.reduce(
            (s, b) => s + b.quantity,
            0
          );
          const maxCap = shop.shelfCapacity + shop.backroomCapacity;
          const freeSpace = Math.max(0, maxCap - currentStock);
          actualStored = Math.min(goodUnits, freeSpace);
          if (actualStored > 0) {
            TradeAndShopEngine.addBatchToInventoryList(
              ts,
              shop.inventoryBatches,
              {
                resourceId: resDef.id,
                resourceNameTR: resDef.nameTR,
                category: resDef.category,
                quantity: actualStored,
                unitCost: sh.unitCostBasis,
                qualityScore: sh.qualityScore,
                receivedDay: state.day,
                spoilageRateDaily: resDef.spoilageRateDaily,
                sourceOrderId: sh.relatedOrderId,
              }
            );
          }
        }
      } else if (sh.destinationType === 'CORPORATE_CLIENT') {
        actualStored = goodUnits;
      }

      sh.deliveredQuantity = actualStored;
      sh.damagedQuantity = damagedUnits;
      sh.actualArrivalDay = state.day;
      sh.status =
        damagedUnits > 0 && actualStored > 0
          ? 'PARTIALLY_DELIVERED'
          : 'DELIVERED';
      ts.deliveredShipmentIds.push(sh.shipmentId);

      // Eğer kendi filomuzdaki bir araç atandıysa aracı serbest bırak
      if (sh.vehicleId) {
        const veh = ts.vehicles.find((v) => v.vehicleId === sh.vehicleId);
        if (veh) {
          veh.status = 'IDLE';
          veh.assignedShipmentId = null;
          veh.conditionPct = Math.max(40, Number((veh.conditionPct - 0.8).toFixed(1)));
        }
      }

      if (sh.relatedOrderId) {
        const ord = ts.procurementOrders.find(
          (o) => o.orderId === sh.relatedOrderId
        );
        if (ord) {
          ord.deliveredQuantity = actualStored;
          ord.actualArrivalDay = state.day;
          ord.status =
            damagedUnits > 0 ? 'PARTIALLY_DELIVERED' : 'DELIVERED';
        }
      }

      deliveredCount += 1;
    }

    // Dükkânların bekleyen teslimat sayaçlarını güncelle
    for (const shop of ts.shops) {
      shop.pendingDeliveriesCount = ts.shipments.filter(
        (sh) =>
          sh.destinationType === 'SHOP' &&
          sh.destinationId === shop.shopId &&
          (sh.status === 'IN_TRANSIT' || sh.status === 'DELAYED')
      ).length;
    }

    return { deliveredCount, delayedCount };
  }

  /**
   * Bir stok listesine (Depo veya Dükkân) yeni mal partisini (InventoryBatch) ekler
   * veya aynı ürün ve yakın maliyetli partiyi ağırlıklı ortalama maliyetle birleştirir.
   */
  public static addBatchToInventoryList(
    ts: TradeUniverseState,
    batches: InventoryBatch[],
    params: {
      resourceId: string;
      resourceNameTR: string;
      category: ResourceDefinition['category'];
      quantity: number;
      unitCost: number;
      qualityScore: number;
      receivedDay: number;
      spoilageRateDaily: number;
      sourceOrderId?: string;
    }
  ): void {
    if (params.quantity <= 0) return;

    const existing = batches.find(
      (b) => b.resourceId === params.resourceId && b.reservedQuantity === 0
    );
    if (existing) {
      const totalQty = existing.quantity + params.quantity;
      const weightedCost =
        (existing.quantity * existing.unitCost +
          params.quantity * params.unitCost) /
        totalQty;
      const weightedQuality =
        (existing.quantity * existing.qualityScore +
          params.quantity * params.qualityScore) /
        totalQty;
      existing.quantity = totalQty;
      existing.availableQuantity = Math.max(
        0,
        totalQty - existing.reservedQuantity
      );
      existing.unitCost = Number(weightedCost.toFixed(2));
      existing.totalValue = Number((totalQty * existing.unitCost).toFixed(2));
      existing.qualityScore = Number(weightedQuality.toFixed(1));
      return;
    }

    ts.batchSeq += 1;
    const expirationDay =
      params.spoilageRateDaily >= 0.03
        ? params.receivedDay + Math.max(4, Math.round(1 / params.spoilageRateDaily))
        : null;

    batches.push({
      batchId: `BATCH-D${params.receivedDay}-S${String(ts.batchSeq).padStart(6, '0')}`,
      resourceId: params.resourceId,
      resourceNameTR: params.resourceNameTR,
      category: params.category,
      quantity: params.quantity,
      reservedQuantity: 0,
      availableQuantity: params.quantity,
      unitCost: Number(params.unitCost.toFixed(2)),
      totalValue: Number((params.quantity * params.unitCost).toFixed(2)),
      qualityScore: Number(params.qualityScore.toFixed(1)),
      receivedDay: params.receivedDay,
      expirationDay,
      sourceOrderId: params.sourceOrderId,
    });
  }

  /**
   * Stok listesinden FIFO sırasıyla mal tüketir ve gerçek birim maliyeti (COGS) hesaplar.
   * Negatif stok oluşmasını kesin olarak engeller (`actualConsumed <= available`).
   */
  public static consumeFromInventoryBatches(
    batches: InventoryBatch[],
    resourceId: string,
    requestedUnits: number
  ): {
    consumedUnits: number;
    totalCostBasis: number;
    averageUnitCost: number;
    averageQuality: number;
  } {
    let remainingToConsume = Math.max(0, Math.floor(requestedUnits));
    let consumedUnits = 0;
    let totalCostBasis = 0;
    let weightedQualitySum = 0;

    for (const batch of batches) {
      if (remainingToConsume <= 0) break;
      if (batch.resourceId !== resourceId || batch.availableQuantity <= 0) {
        continue;
      }

      const take = Math.min(batch.availableQuantity, remainingToConsume);
      batch.quantity -= take;
      batch.availableQuantity = Math.max(
        0,
        batch.quantity - batch.reservedQuantity
      );
      batch.totalValue = Number((batch.quantity * batch.unitCost).toFixed(2));

      remainingToConsume -= take;
      consumedUnits += take;
      totalCostBasis += take * batch.unitCost;
      weightedQualitySum += take * batch.qualityScore;
    }

    // Miktarı 0 olan partileri temizle
    for (let i = batches.length - 1; i >= 0; i--) {
      if (batches[i].quantity <= 0) {
        batches.splice(i, 1);
      }
    }

    const cleanTotalCost = Number(totalCostBasis.toFixed(2));
    const averageUnitCost =
      consumedUnits > 0
        ? Number((cleanTotalCost / consumedUnits).toFixed(2))
        : 0;
    const averageQuality =
      consumedUnits > 0
        ? Number((weightedQualitySum / consumedUnits).toFixed(1))
        : 80;

    return {
      consumedUnits,
      totalCostBasis: cleanTotalCost,
      averageUnitCost,
      averageQuality,
    };
  }

  public static getAvailableResourceUnits(
    batches: InventoryBatch[],
    resourceId: string
  ): number {
    return batches
      .filter((b) => b.resourceId === resourceId)
      .reduce((sum, b) => sum + b.availableQuantity, 0);
  }

  // ============================================================================
  // 8. GERÇEK REÇETELİ ÜRETİM ZİNCİRİ (`executeRecipeProduction`)
  // ============================================================================

  /**
   * Hammadde deposundaki (`WH_RAW_MAIN`) girdileri kullanarak reçeteli üretim yapar:
   * - Gerekli hammaddeler yoksa üretim durur veya mevcut hammadde miktarıyla sınırlandırılır.
   * - Hammadde tüketildiği anda aynı anda iki farklı üretimde kullanılamaz.
   * - Fire oranı (`wasteRatePct`), işçilik ve enerji maliyetini birim üretim maliyetine yansıtır.
   * - Üretilen mamul `WH_FIN_MAIN` deposuna eklenir.
   */
  public static executeRecipeProduction(
    state: SimulationState,
    params: {
      recipeId: string;
      requestedBatches: number;
    }
  ): {
    success: boolean;
    message: string;
    productionOrder: ProductionOrder | null;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const recipe = RECIPE_CATALOG[params.recipeId];
    if (!recipe) {
      return {
        success: false,
        message: 'Geçersiz üretim reçetesi.',
        productionOrder: null,
      };
    }

    const rawWh =
      ts.warehouses.find((w) => w.type === 'RAW_MATERIAL') || ts.warehouses[0];
    const finWh =
      ts.warehouses.find((w) => w.type === 'FINISHED_GOODS') || ts.warehouses[1];

    const requested = Math.max(1, Math.floor(params.requestedBatches));

    // 1. Hammadde uygunluğunu kontrol et
    let maxPossibleByInputs = requested;
    let bottleneckReasonTR: string | undefined;

    for (const inp of recipe.inputs) {
      const avail = TradeAndShopEngine.getAvailableResourceUnits(
        rawWh.batches,
        inp.resourceId
      );
      const possible = Math.floor(avail / inp.quantityPerUnit);
      if (possible < maxPossibleByInputs) {
        maxPossibleByInputs = possible;
        const inpName = RESOURCE_CATALOG[inp.resourceId]?.nameTR || inp.resourceId;
        bottleneckReasonTR = `Yetersiz ${inpName} stoğu (Mevcut: ${avail}, Gereken/Birim: ${inp.quantityPerUnit})`;
      }
    }

    // 2. Mamul deposu boş alan kontrolü
    const finFreeSpace = Math.max(
      0,
      finWh.maxCapacityUnits - finWh.usedCapacityUnits
    );
    if (finFreeSpace < maxPossibleByInputs) {
      maxPossibleByInputs = finFreeSpace;
      bottleneckReasonTR = `Mamul deposu (${finWh.nameTR}) dolu (Boş alan: ${finFreeSpace})`;
    }

    // 3. Fabrika kapasitesi kontrolü (eğer şirket varsa)
    if (state.playerCompany) {
      const capLimit = Math.max(
        5,
        state.playerCompany.operations?.effectiveCapacity ??
          state.playerCompany.productionCapacity
      );
      if (maxPossibleByInputs > capLimit) {
        maxPossibleByInputs = capLimit;
        bottleneckReasonTR = `Günlük etkin fabrika kapasitesi sınırı (${capLimit} birim)`;
      }
    }

    const outputResDef = RESOURCE_CATALOG[recipe.outputResourceId];
    ts.productionSeq += 1;
    const prodId = `PRD-D${state.day}-S${String(ts.productionSeq).padStart(6, '0')}`;

    if (maxPossibleByInputs <= 0) {
      const blockedOrder: ProductionOrder = {
        productionOrderId: prodId,
        recipeId: recipe.recipeId,
        recipeNameTR: recipe.nameTR,
        outputResourceId: recipe.outputResourceId,
        outputResourceNameTR: outputResDef.nameTR,
        requestedUnits: requested,
        actualProducedUnits: 0,
        wastedUnits: 0,
        rawMaterialCostTotal: 0,
        laborCostTotal: 0,
        energyCostTotal: 0,
        totalProductionCost: 0,
        unitProductionCost: 0,
        outputQualityScore: 0,
        createdDay: state.day,
        status: 'BLOCKED_NO_INPUT',
        bottleneckReasonTR:
          bottleneckReasonTR || 'Hammadde stoğu bulunmadığı için üretim durdu.',
      };
      ts.productionOrders.unshift(blockedOrder);
      return {
        success: false,
        message: `Üretim yapılamadı: ${blockedOrder.bottleneckReasonTR}`,
        productionOrder: blockedOrder,
      };
    }

    // Hammaddeleri atomik olarak tüket
    let rawMaterialCostTotal = 0;
    let inputQualitySum = 0;
    for (const inp of recipe.inputs) {
      const neededQty = Math.ceil(maxPossibleByInputs * inp.quantityPerUnit);
      const consumed = TradeAndShopEngine.consumeFromInventoryBatches(
        rawWh.batches,
        inp.resourceId,
        neededQty
      );
      rawMaterialCostTotal += consumed.totalCostBasis;
      inputQualitySum += consumed.averageQuality;
    }
    rawWh.usedCapacityUnits = rawWh.batches.reduce(
      (s, b) => s + b.quantity,
      0
    );

    const avgInputQuality = inputQualitySum / Math.max(1, recipe.inputs.length);
    const wastedUnits =
      maxPossibleByInputs >= 10
        ? Math.floor((maxPossibleByInputs * recipe.wasteRatePct) / 100)
        : 0;
    const actualProducedUnits = Math.max(1, maxPossibleByInputs - wastedUnits);

    const energyCostTotal = Number(
      (maxPossibleByInputs * recipe.energyCostPerBatch).toFixed(2)
    );
    const laborCostTotal = Number(
      (maxPossibleByInputs * recipe.workerCountRequired * 18).toFixed(2)
    );
    const operatingCashCost = Number(
      (energyCostTotal + laborCostTotal).toFixed(2)
    );

    // Enerji + işçilik giderini şirket veya oyuncu kasasından düş, mamul değerine ekle
    if (state.playerCompany) {
      const pc = state.playerCompany;
      const cashPaid = Math.min(pc.financials.cash, operatingCashCost);
      pc.financials.cash = Number((pc.financials.cash - cashPaid).toFixed(2));
      pc.capitalCash = pc.financials.cash;
      pc.financials.inventory = Number(
        (pc.financials.inventory + cashPaid).toFixed(2)
      );
      pc.financials.totalAssets = Number(
        (
          pc.financials.cash +
          pc.financials.inventory +
          pc.financials.receivables +
          pc.financials.fixedAssets
        ).toFixed(2)
      );
    } else {
      const cashPaid = Math.min(state.cash, operatingCashCost);
      state.cash = Number((state.cash - cashPaid).toFixed(2));
    }

    const totalProductionCost = Number(
      (rawMaterialCostTotal + operatingCashCost).toFixed(2)
    );
    const unitProductionCost = Number(
      (totalProductionCost / actualProducedUnits).toFixed(2)
    );
    const techMult = state.playerCompany?.techQualityMultiplier ?? 1.0;
    const outputQualityScore = Number(
      Math.min(
        99,
        avgInputQuality * recipe.qualityMultiplierEffect * (1 + (techMult - 1) * 0.08)
      ).toFixed(1)
    );

    // Mamul veya ara ürün deposuna ekle
    const targetWh =
      outputResDef.category === 'INTERMEDIATE_GOOD' ? rawWh : finWh;
    TradeAndShopEngine.addBatchToInventoryList(ts, targetWh.batches, {
      resourceId: outputResDef.id,
      resourceNameTR: outputResDef.nameTR,
      category: outputResDef.category,
      quantity: actualProducedUnits,
      unitCost: unitProductionCost,
      qualityScore: outputQualityScore,
      receivedDay: state.day,
      spoilageRateDaily: outputResDef.spoilageRateDaily,
    });
    targetWh.usedCapacityUnits = targetWh.batches.reduce(
      (s, b) => s + b.quantity,
      0
    );

    const prodOrder: ProductionOrder = {
      productionOrderId: prodId,
      recipeId: recipe.recipeId,
      recipeNameTR: recipe.nameTR,
      outputResourceId: outputResDef.id,
      outputResourceNameTR: outputResDef.nameTR,
      requestedUnits: requested,
      actualProducedUnits,
      wastedUnits,
      rawMaterialCostTotal: Number(rawMaterialCostTotal.toFixed(2)),
      laborCostTotal,
      energyCostTotal,
      totalProductionCost,
      unitProductionCost,
      outputQualityScore,
      createdDay: state.day,
      status:
        maxPossibleByInputs < requested ? 'PARTIAL_BOTTLENECK' : 'COMPLETED',
      bottleneckReasonTR,
    };

    ts.productionOrders.unshift(prodOrder);
    ts.todaySummary.productionUnits += actualProducedUnits;
    ts.todaySummary.productionCost = Number(
      (ts.todaySummary.productionCost + totalProductionCost).toFixed(2)
    );

    return {
      success: true,
      message: `${recipe.nameTR}: ${actualProducedUnits} ${outputResDef.unitLabel} ${outputResDef.nameTR} üretildi (Birim Maliyet: ₺${unitProductionCost.toLocaleString('tr-TR')}, Kalite: ${outputQualityScore}).`,
      productionOrder: prodOrder,
    };
  }

  // ============================================================================
  // 9. LOJİSTİK FİLOSU VE DEPO -> DÜKKÂN / KURUMSAL MÜŞTERİ SEVKİYATI
  // ============================================================================

  public static purchaseLogisticsVehicle(
    state: SimulationState,
    vehicleType: LogisticsVehicleType,
    reservedOrderCash: number
  ): {
    success: boolean;
    message: string;
    vehicle: LogisticsVehicle | null;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const spec = VEHICLE_CATALOG[vehicleType];
    if (!spec) {
      return {
        success: false,
        message: 'Geçersiz araç tipi.',
        vehicle: null,
      };
    }

    if (state.playerCompany) {
      const pc = state.playerCompany;
      if (pc.financials.cash < spec.purchaseCost) {
        return {
          success: false,
          message: `${spec.nameTR} alımı için gereken ₺${spec.purchaseCost.toLocaleString('tr-TR')} şirket kasasında yok.`,
          vehicle: null,
        };
      }
      pc.financials.cash = Number(
        (pc.financials.cash - spec.purchaseCost).toFixed(2)
      );
      pc.capitalCash = pc.financials.cash;
      pc.financials.fixedAssets = Number(
        (pc.financials.fixedAssets + spec.purchaseCost).toFixed(2)
      );
      pc.financials.totalAssets = Number(
        (
          pc.financials.cash +
          pc.financials.inventory +
          pc.financials.receivables +
          pc.financials.fixedAssets
        ).toFixed(2)
      );
    } else {
      const spendable = Math.max(0, state.cash - reservedOrderCash);
      if (spendable < spec.purchaseCost) {
        return {
          success: false,
          message: `${spec.nameTR} alımı için gereken ₺${spec.purchaseCost.toLocaleString('tr-TR')} kullanılabilir nakitte yok.`,
          vehicle: null,
        };
      }
      state.cash = Number((state.cash - spec.purchaseCost).toFixed(2));
    }

    ts.vehicleSeq += 1;
    const vehicle: LogisticsVehicle = {
      vehicleId: `VEH-${vehicleType}-${String(ts.vehicleSeq).padStart(3, '0')}`,
      nameTR: `${spec.nameTR} #${ts.vehicleSeq}`,
      vehicleType,
      capacityUnits: spec.capacityUnits,
      speedMultiplier: spec.speedMultiplier,
      purchaseCost: spec.purchaseCost,
      dailyMaintenanceCost: spec.dailyMaintenanceCost,
      fuelCostPerTrip: spec.fuelCostPerTrip,
      driverDailyWage: spec.driverDailyWage,
      conditionPct: 100,
      status: 'IDLE',
      assignedShipmentId: null,
    };

    ts.vehicles.push(vehicle);
    ts.logisticsMode = 'OWN_FLEET';

    return {
      success: true,
      message: `${vehicle.nameTR} filoya katıldı (Kapasite: ${vehicle.capacityUnits} birim).`,
      vehicle,
    };
  }

  /**
   * Merkez Depodan (`WH_FIN_MAIN` veya `WH_DIST_MAIN`) bir Dükkâna (`SHOP`) ürün sevk eder.
   */
  public static dispatchWarehouseToShopShipment(
    state: SimulationState,
    params: {
      warehouseId: string;
      shopId: string;
      resourceId: string;
      quantity: number;
    }
  ): {
    success: boolean;
    message: string;
    shipment: Shipment | null;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const wh = ts.warehouses.find((w) => w.warehouseId === params.warehouseId);
    const shop = ts.shops.find((s) => s.shopId === params.shopId);
    const resDef = RESOURCE_CATALOG[params.resourceId];

    if (!wh || !shop || !resDef) {
      return {
        success: false,
        message: 'Depo, dükkân veya ürün bulunamadı.',
        shipment: null,
      };
    }

    const availInWh = TradeAndShopEngine.getAvailableResourceUnits(
      wh.batches,
      params.resourceId
    );
    const qty = Math.min(Math.floor(params.quantity), availInWh);
    if (qty <= 0) {
      return {
        success: false,
        message: `${wh.nameTR} içinde sevk edilebilir ${resDef.nameTR} stoğu bulunmuyor.`,
        shipment: null,
      };
    }

    const currentShopStock = shop.inventoryBatches.reduce(
      (s, b) => s + b.quantity,
      0
    );
    const maxShopCap = shop.shelfCapacity + shop.backroomCapacity;
    const shopFree = Math.max(0, maxShopCap - currentShopStock);
    const finalQty = Math.min(qty, shopFree);

    if (finalQty <= 0) {
      return {
        success: false,
        message: `${shop.nameTR} raf ve arka deposu tamamen dolu.`,
        shipment: null,
      };
    }

    const consumed = TradeAndShopEngine.consumeFromInventoryBatches(
      wh.batches,
      params.resourceId,
      finalQty
    );
    wh.usedCapacityUnits = wh.batches.reduce((s, b) => s + b.quantity, 0);

    // Kendi filomuzda boş araç var mı?
    const idleVehicle = ts.vehicles.find((v) => v.status === 'IDLE');
    const logisticsMode: LogisticsMode = idleVehicle
      ? 'OWN_FLEET'
      : 'EXTERNAL_LOGISTICS';
    const shippingCost = idleVehicle
      ? idleVehicle.fuelCostPerTrip
      : Number((finalQty * 4.5).toFixed(2));

    // Şehir içi aynı gün veya ertesi gün teslimat
    ts.shipmentSeq += 1;
    const shipmentId = `SHP-INT-D${state.day}-S${String(ts.shipmentSeq).padStart(6, '0')}`;

    // İç sevkiyatta aynı şehir içindeyse hemen mağaza rafına ulaştır
    TradeAndShopEngine.addBatchToInventoryList(ts, shop.inventoryBatches, {
      resourceId: resDef.id,
      resourceNameTR: resDef.nameTR,
      category: resDef.category,
      quantity: consumed.consumedUnits,
      unitCost: consumed.averageUnitCost,
      qualityScore: consumed.averageQuality,
      receivedDay: state.day,
      spoilageRateDaily: resDef.spoilageRateDaily,
    });

    const shipment: Shipment = {
      shipmentId,
      sourceType: 'WAREHOUSE',
      sourceId: wh.warehouseId,
      sourceNameTR: wh.nameTR,
      destinationType: 'SHOP',
      destinationId: shop.shopId,
      destinationNameTR: shop.nameTR,
      resourceId: resDef.id,
      resourceNameTR: resDef.nameTR,
      quantity: consumed.consumedUnits,
      deliveredQuantity: consumed.consumedUnits,
      damagedQuantity: 0,
      unitCostBasis: consumed.averageUnitCost,
      qualityScore: consumed.averageQuality,
      logisticsMode,
      vehicleId: idleVehicle?.vehicleId ?? null,
      shippingCost,
      dispatchedDay: state.day,
      estimatedArrivalDay: state.day,
      actualArrivalDay: state.day,
      status: 'DELIVERED',
    };

    ts.deliveredShipmentIds.push(shipmentId);
    ts.shipments.unshift(shipment);

    return {
      success: true,
      message: `${wh.nameTR} -> ${shop.nameTR}: ${consumed.consumedUnits} ${resDef.unitLabel} ${resDef.nameTR} (${logisticsMode === 'OWN_FLEET' ? 'Kendi Filomuz' : 'Dış Lojistik'}) ile mağaza raflarına sevk edildi.`,
      shipment,
    };
  }

  // ============================================================================
  // 10. KURUMSAL SÖZLEŞME KABULÜ VE TESLİMATI (`acceptCommercialContract` & `deliverToCommercialContract`)
  // ============================================================================

  public static acceptCommercialContract(
    state: SimulationState,
    contractId: string
  ): {
    success: boolean;
    message: string;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const contract = ts.commercialContracts.find(
      (c) => c.contractId === contractId
    );
    if (!contract || contract.status !== 'OFFERED') {
      return {
        success: false,
        message: 'Kabul edilecek kurumsal sözleşme teklifi bulunamadı.',
      };
    }

    contract.status = 'ACTIVE';
    contract.startDay = state.day;
    contract.dueDay = state.day + 12;

    return {
      success: true,
      message: `${contract.buyerNameTR} ile ${contract.totalRequiredUnits} birim ${contract.resourceNameTR} kurumsal satış sözleşmesi imzalandı (Vade: Gün ${contract.dueDay}).`,
    };
  }

  public static deliverToCommercialContract(
    state: SimulationState,
    contractId: string,
    unitsToDeliver?: number
  ): {
    success: boolean;
    message: string;
    deliveredUnits: number;
    revenueBooked: number;
  } {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const contract = ts.commercialContracts.find(
      (c) => c.contractId === contractId
    );
    if (!contract || contract.status !== 'ACTIVE') {
      return {
        success: false,
        message: 'Aktif kurumsal sözleşme bulunamadı.',
        deliveredUnits: 0,
        revenueBooked: 0,
      };
    }

    const finWh =
      ts.warehouses.find((w) => w.type === 'FINISHED_GOODS') || ts.warehouses[1];
    const avail = TradeAndShopEngine.getAvailableResourceUnits(
      finWh.batches,
      contract.resourceId
    );
    const needed = contract.remainingUnits;
    const requested = Math.min(needed, unitsToDeliver ?? needed, avail);

    if (requested <= 0) {
      return {
        success: false,
        message: `Merkez Mamul Deposunda teslim edilecek ${contract.resourceNameTR} stoğu bulunmuyor.`,
        deliveredUnits: 0,
        revenueBooked: 0,
      };
    }

    const consumed = TradeAndShopEngine.consumeFromInventoryBatches(
      finWh.batches,
      contract.resourceId,
      requested
    );
    finWh.usedCapacityUnits = finWh.batches.reduce((s, b) => s + b.quantity, 0);

    const grossRevenue = Number(
      (consumed.consumedUnits * contract.unitSalePrice).toFixed(2)
    );
    contract.deliveredUnits += consumed.consumedUnits;
    contract.remainingUnits = Math.max(
      0,
      contract.totalRequiredUnits - contract.deliveredUnits
    );

    if (contract.remainingUnits === 0) {
      contract.status = 'COMPLETED';
      ts.tradeReputationScore = Math.min(
        100,
        ts.tradeReputationScore + contract.reputationReward
      );
      ts.deliveryPunctualityScore = Math.min(
        100,
        ts.deliveryPunctualityScore + 2
      );
    }

    // Vadeli alacak faturası veya peşin tahsilat
    if (contract.paymentTermDays > 0) {
      ts.invoiceSeq += 1;
      const inv: TradeInvoice = {
        invoiceId: `INV-REC-D${state.day}-S${String(ts.invoiceSeq).padStart(6, '0')}`,
        direction: 'RECEIVABLE',
        counterpartyNameTR: contract.buyerNameTR,
        relatedContractId: contract.contractId,
        issueDay: state.day,
        dueDay: state.day + contract.paymentTermDays,
        totalAmount: grossRevenue,
        paidAmount: 0,
        remainingAmount: grossRevenue,
        lateFeeAccrued: 0,
        status: 'ISSUED',
      };
      ts.invoices.unshift(inv);

      if (state.playerCompany) {
        const pc = state.playerCompany;
        const netGain = Number(
          (grossRevenue - consumed.totalCostBasis).toFixed(2)
        );
        pc.financials.inventory = Number(
          Math.max(0, pc.financials.inventory - consumed.totalCostBasis).toFixed(2)
        );
        pc.financials.receivables = Number(
          (pc.financials.receivables + grossRevenue).toFixed(2)
        );
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
          ).toFixed(2)
        );
        pc.financials.shareholdersEquity = Number(
          (
            pc.financials.totalAssets - pc.financials.totalLiabilities
          ).toFixed(2)
        );
        pc.financials.retainedEarnings = Number(
          (
            pc.financials.shareholdersEquity - pc.financials.paidInCapital
          ).toFixed(2)
        );
        pc.dailyRevenue = Number((pc.dailyRevenue + grossRevenue).toFixed(2));
        pc.dailyEbitda = Number((pc.dailyEbitda + netGain).toFixed(2));
      }
    } else {
      if (state.playerCompany) {
        const pc = state.playerCompany;
        pc.financials.inventory = Number(
          Math.max(0, pc.financials.inventory - consumed.totalCostBasis).toFixed(2)
        );
        pc.financials.cash = Number(
          (pc.financials.cash + grossRevenue).toFixed(2)
        );
        pc.capitalCash = pc.financials.cash;
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
          ).toFixed(2)
        );
        pc.financials.shareholdersEquity = Number(
          (
            pc.financials.totalAssets - pc.financials.totalLiabilities
          ).toFixed(2)
        );
        pc.financials.retainedEarnings = Number(
          (
            pc.financials.shareholdersEquity - pc.financials.paidInCapital
          ).toFixed(2)
        );
      } else {
        state.cash = Number((state.cash + grossRevenue).toFixed(2));
      }
    }

    ts.todaySummary.wholesaleAndContractRevenue = Number(
      (ts.todaySummary.wholesaleAndContractRevenue + grossRevenue).toFixed(2)
    );
    ts.todaySummary.wholesaleAndContractCogs = Number(
      (
        ts.todaySummary.wholesaleAndContractCogs + consumed.totalCostBasis
      ).toFixed(2)
    );

    return {
      success: true,
      message: `${contract.buyerNameTR} sözleşmesine ${consumed.consumedUnits} birim ${contract.resourceNameTR} teslim edildi (Tutar: ₺${grossRevenue.toLocaleString('tr-TR')}).`,
      deliveredUnits: consumed.consumedUnits,
      revenueBooked: grossRevenue,
    };
  }

  // ============================================================================
  // 11. ESNAFTAN ŞİRKETE GEÇİŞ (ŞİRKETLEŞME - INCORPORATION)
  // ============================================================================

  /**
   * Esnaftan Kurumsal Şirkete Geçiş Koşullarını Denetler (Bölüm 4):
   * - En az 2 aktif şube
   * - Son 30 oyun gününde pozitif faaliyet kârı
   * - En az 10 çalışan
   * - Yeterli işletme değeri (>= 350.000 TL)
   * - Vadesi geçmiş borç bulunmaması
   * - Yeterli ticari itibar (>= 60)
   */
  public static checkIncorporationEligibility(
    state: SimulationState
  ): IncorporationEligibilityResult {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const alreadyIncorporated = state.playerCompany !== null;
    const activeShopBranchesCount = ts.shops.length;
    const totalShopStaffCount = ts.shops.reduce(
      (sum, s) => sum + s.staffCount,
      0
    );

    const last30DaysOperatingProfit = Number(
      ts.shops
        .reduce((sum, s) => {
          const histSum = s.dailyProfitHistory30.reduce((a, b) => a + b, 0);
          return sum + (s.dailyProfitHistory30.length > 0 ? histSum : s.cumulativeNetProfit);
        }, 0)
        .toFixed(2)
    );

    const shopsEquity = TradeAndShopEngine.computeNonIncorporatedShopsEquity(state);
    const totalBusinessValue = Number(
      (
        shopsEquity +
        (state.playerCompany?.equityValue ?? 0)
      ).toFixed(2)
    );

    const hasOverdueLoan = (state.activeLoans ?? []).some(
      (l) => l.status === 'DELINQUENT' || l.status === 'DEFAULTED'
    );
    const hasOverdueInvoice = ts.invoices.some(
      (inv) => inv.direction === 'PAYABLE' && inv.status === 'OVERDUE'
    );
    const hasOverdueDebt = hasOverdueLoan || hasOverdueInvoice;

    const reasons: string[] = [];
    if (alreadyIncorporated) {
      reasons.push('İşletmeniz zaten kurumsal anonim şirkete dönüştürülmüş durumda.');
    }
    if (activeShopBranchesCount < TradeAndShopEngine.MIN_BRANCHES_FOR_INCORPORATION) {
      reasons.push(
        `En az ${TradeAndShopEngine.MIN_BRANCHES_FOR_INCORPORATION} aktif dükkân/şube gereklidir (Mevcut: ${activeShopBranchesCount}).`
      );
    }
    if (last30DaysOperatingProfit <= 0) {
      reasons.push(
        `Son 30 oyun gününde pozitif faaliyet kârı gereklidir (Mevcut: ₺${last30DaysOperatingProfit.toLocaleString('tr-TR')}).`
      );
    }
    if (totalShopStaffCount < TradeAndShopEngine.MIN_STAFF_FOR_INCORPORATION) {
      reasons.push(
        `Toplam en az ${TradeAndShopEngine.MIN_STAFF_FOR_INCORPORATION} çalışan gereklidir (Mevcut: ${totalShopStaffCount}).`
      );
    }
    if (totalBusinessValue < TradeAndShopEngine.MIN_BUSINESS_VALUE_FOR_INCORPORATION) {
      reasons.push(
        `Toplam işletme değeri en az ₺${TradeAndShopEngine.MIN_BUSINESS_VALUE_FOR_INCORPORATION.toLocaleString('tr-TR')} olmalıdır (Mevcut: ₺${totalBusinessValue.toLocaleString('tr-TR')}).`
      );
    }
    if (hasOverdueDebt) {
      reasons.push(
        'Vadesi geçmiş kredi taksiti veya gecikmiş tedarikçi faturası bulunmamalıdır.'
      );
    }
    if (ts.tradeReputationScore < TradeAndShopEngine.MIN_REPUTATION_FOR_INCORPORATION) {
      reasons.push(
        `Ticari itibar puanı en az ${TradeAndShopEngine.MIN_REPUTATION_FOR_INCORPORATION} olmalıdır (Mevcut: ${ts.tradeReputationScore}).`
      );
    }

    return {
      eligible: !alreadyIncorporated && reasons.length === 0,
      alreadyIncorporated,
      activeShopBranchesCount,
      minBranchesRequired: TradeAndShopEngine.MIN_BRANCHES_FOR_INCORPORATION,
      last30DaysOperatingProfit,
      totalShopStaffCount,
      minStaffRequired: TradeAndShopEngine.MIN_STAFF_FOR_INCORPORATION,
      totalBusinessValue,
      minBusinessValueRequired:
        TradeAndShopEngine.MIN_BUSINESS_VALUE_FOR_INCORPORATION,
      hasOverdueDebt,
      tradeReputationScore: ts.tradeReputationScore,
      minReputationRequired:
        TradeAndShopEngine.MIN_REPUTATION_FOR_INCORPORATION,
      reasons,
    };
  }

  /**
   * Esnaf İşletmelerini Kurumsal Anonim Şirkete Dönüştürür (`incorporateShopsIntoCompany`):
   * - Mevcut dükkânları, stokları, siparişleri, çalışanları ve satış geçmişini SİLMEZ!
   * - Mevcut dükkânları yeni kurulan şirketin şubelerine (`isCompanyBranch = true`) dönüştürür.
   * - Şirket hazinesi, merkezi muhasebe, kurumsal kredi, merkezi depo, fabrika ve halka arz hazırlığını açar.
   */
  public static incorporateShopsIntoCompany(
    state: SimulationState,
    params: {
      companyName: string;
      ticker: string;
      sector: SectorId;
      additionalCashFromPlayer?: number;
      reservedOrderCash: number;
    }
  ): {
    success: boolean;
    message: string;
    company?: PlayerCompany;
  } {
    const eligibility = TradeAndShopEngine.checkIncorporationEligibility(state);
    if (!eligibility.eligible) {
      return {
        success: false,
        message: `Şirketleşme koşulları henüz tamamlanmadı: ${eligibility.reasons.join(' ')}`,
      };
    }

    const ts = state.tradeState!;
    const spendablePlayerCash = Math.max(
      0,
      state.cash - params.reservedOrderCash
    );
    const additionalCash = Number(
      Math.min(
        spendablePlayerCash,
        Math.max(0, params.additionalCashFromPlayer ?? 0)
      ).toFixed(2)
    );

    // Mevcut esnaf dükkânlarının nakit, stok ve sabit yatırım değerlerini topla
    let shopsCashTotal = 0;
    let shopsFixedTotal = 0;
    let shopsInventoryValue = 0;
    let shopsInventoryUnits = 0;
    let totalStaff = 0;

    for (const shop of ts.shops) {
      shopsCashTotal += shop.cashAccountBalance;
      shopsFixedTotal += shop.totalInvestedCapital;
      for (const b of shop.inventoryBatches) {
        shopsInventoryValue += b.quantity * b.unitCost;
        shopsInventoryUnits += b.quantity;
      }
      totalStaff += shop.staffCount;
    }

    for (const wh of ts.warehouses) {
      for (const b of wh.batches) {
        shopsInventoryValue += b.quantity * b.unitCost;
        shopsInventoryUnits += b.quantity;
      }
    }

    for (const v of ts.vehicles) {
      shopsFixedTotal += v.purchaseCost;
    }

    // Yoldaki peşin ödenmiş siparişler
    let inTransitPrepaid = 0;
    for (const ord of ts.procurementOrders) {
      if (
        ord.status === 'IN_TRANSIT' ||
        ord.status === 'PREPARING' ||
        ord.status === 'DELAYED' ||
        ord.status === 'APPROVED'
      ) {
        inTransitPrepaid += ord.paidAmount;
      }
    }

    const totalCapital = Number(
      (
        shopsCashTotal +
        shopsFixedTotal +
        shopsInventoryValue +
        inTransitPrepaid +
        additionalCash
      ).toFixed(2)
    );

    const cleanName =
      params.companyName.trim() || 'Anadolu Ticaret ve Perakende A.Ş.';
    let cleanTicker = params.ticker
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 5);
    if (!cleanTicker) cleanTicker = 'ATPR';
    if (state.stocks.some((s) => s.ticker === cleanTicker)) {
      cleanTicker = `${cleanTicker.slice(0, 3)}A`;
    }

    if (additionalCash > 0) {
      state.cash = Number((state.cash - additionalCash).toFixed(2));
    }

    // Tüm dükkânları kurumsal şubeye dönüştür (hiçbir dükkân, stok veya geçmiş silinmez!)
    for (const shop of ts.shops) {
      shop.isCompanyBranch = true;
      shop.cashAccountBalance = 0; // Şube nakitleri şirket ana hazinesinde birleştirildi
    }

    const totalShares = 100_000;
    const productionCapacity = Math.max(25, ts.shops.length * 15);
    const financials = AccountingEngine.createInitialFinancialStatement({
      sector: params.sector,
      initialEquityCapital: totalCapital,
      debtRatio: 0,
      sharesOutstanding: totalShares,
      staffCount: Math.max(10, totalStaff),
      productionCapacityUnits: productionCapacity,
      dividendYieldAnnual: 0,
      sharePrice: totalCapital / totalShares,
      corporateTaxRate: state.macro.corporateTaxRate,
      policyInterestRate: state.macro.policyInterestRate,
    });

    financials.cash = Number((shopsCashTotal + additionalCash).toFixed(2));
    financials.inventory = Number(
      (shopsInventoryValue + inTransitPrepaid).toFixed(2)
    );
    financials.inventoryUnits = Math.max(10, shopsInventoryUnits);
    financials.receivables = 0;
    financials.fixedAssets = Number(Math.max(25_000, shopsFixedTotal).toFixed(2));
    financials.totalAssets = Number(
      (
        financials.cash +
        financials.inventory +
        financials.receivables +
        financials.fixedAssets
      ).toFixed(2)
    );
    financials.shortTermDebt = 0;
    financials.longTermDebt = 0;
    financials.totalLiabilities = 0;
    financials.paidInCapital = financials.totalAssets;
    financials.retainedEarnings = 0;
    financials.shareholdersEquity = financials.totalAssets;

    const valuation = ValuationEngine.computeCompanyValuation(
      financials,
      params.sector,
      state.macro,
      1.0
    );

    const company: PlayerCompany = {
      name: cleanName,
      ticker: cleanTicker,
      sector: params.sector,
      foundedDay: state.day,
      operatingDays: Math.max(
        1,
        state.day - (ts.shops[0]?.openedDay ?? state.day)
      ),
      corporateGovernanceScore: Math.max(74, ts.tradeReputationScore),
      capitalCash: financials.cash,
      staffCount: Math.max(10, totalStaff),
      productionCapacity,
      dailyRdBudget: 5_000,
      dailyMarketingBudget: 3_500,
      techQualityMultiplier: 1.02,
      dailyUnitsProduced: financials.dailyUnitsProduced,
      dailyRevenue: Number((financials.revenue / 120).toFixed(2)),
      dailyOpex: Number(
        (
          (financials.operatingExpenses +
            financials.personnelExpenses +
            financials.researchAndDevelopment) /
          120
        ).toFixed(2)
      ),
      dailyEbitda: Number((financials.EBITDA / 120).toFixed(2)),
      annualizedRevenue: financials.revenue,
      annualizedEbitda: financials.EBITDA,
      financials,
      valuation: {
        ...valuation,
        equityValue: financials.shareholdersEquity,
        enterpriseValue: Number(
          (financials.shareholdersEquity - financials.cash).toFixed(2)
        ),
        fairValuePerShare: Number(
          (financials.shareholdersEquity / totalShares).toFixed(2)
        ),
      },
      enterpriseValue: financials.shareholdersEquity,
      equityValue: financials.shareholdersEquity,
      totalShares,
      playerOwnedShares: totalShares,
      playerOwnershipPct: 100,
      isPubliclyListed: false,
      ipoOfferPrice: null,
      ipoProceedsRaised: 0,
      ipoDay: null,
      revenueHistory: [financials.revenue],
      ebitdaHistory: [financials.EBITDA],
      valuationHistory: [financials.shareholdersEquity],
      quarterlyReports: [
        AccountingEngine.createQuarterlyReport(
          financials,
          state.day,
          state.macro.corporateTaxRate
        ),
      ],
    };

    CompanyEngine.ensureCompanyV5Fields(company, state.macro);
    company.equityValue = financials.shareholdersEquity;
    company.enterpriseValue = financials.shareholdersEquity;
    company.valuation.equityValue = financials.shareholdersEquity;

    state.playerCompany = company;
    state.stageUnlocks.stage2Entrepreneur = true;
    if (state.stage === SimulationStage.STAGE_1_RETAIL_INVESTOR) {
      state.stage = SimulationStage.STAGE_2_ENTREPRENEUR;
    }

    // Satış kanallarını aç
    for (const ch of ts.salesChannels) {
      if (
        ch.channelType === 'REGIONAL_DISTRIBUTOR' ||
        ch.channelType === 'CORPORATE_CONTRACT'
      ) {
        ch.isUnlocked = true;
      }
    }

    TradeAndShopEngine.updateCareerStage(state);

    return {
      success: true,
      message: `Tebrikler! ${ts.shops.length} şubeli esnaf işletmeniz "${cleanName} (${cleanTicker})" adıyla kurumsal anonim şirkete dönüştürüldü. Tüm dükkânlarınız, stoklarınız ve çalışanlarınız korundu; Merkezi Depo, Fabrika ve Kurumsal Sözleşmeler açıldı!`,
      company,
    };
  }

  // ============================================================================
  // 12. GÜNLÜK TİCARET, DÜKKÂN SATIŞ, SÖZLEŞME VE FATURA DÖNGÜSÜ (`stepDailyTradeAndShops`)
  // ============================================================================

  public static stepDailyTradeAndShops(
    state: SimulationState,
    rng: RandomEngine,
    reservedOrderCash: number
  ): void {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);

    // Günlük özet sayaçlarını sıfırla
    ts.todaySummary = {
      procurementSpend: 0,
      productionUnits: 0,
      productionCost: 0,
      logisticsCost: 0,
      shopSalesRevenue: 0,
      shopCogs: 0,
      shopOpex: 0,
      shopSpoilageCost: 0,
      shopNetProfit: 0,
      wholesaleAndContractRevenue: 0,
      wholesaleAndContractCogs: 0,
      intercompanyEliminatedRevenue: 0,
      receivablesCollected: 0,
      payablesPaid: 0,
      overduePenaltiesPaid: 0,
    };

    // 1. Ticari Olayları (TradeEvent) Güncelle
    for (const ev of ts.activeTradeEvents) {
      if (state.day > ev.endDay) {
        ev.isActive = false;
      }
    }
    ts.activeTradeEvents = ts.activeTradeEvents.filter((e) => e.isActive);

    if (state.day % 9 === 0 && ts.activeTradeEvents.length < 2) {
      const evRoll = rng.uniform();
      if (evRoll < 0.35) {
        ts.activeTradeEvents.push({
          eventId: `TEV-D${state.day}`,
          eventType: 'DEMAND_BOOM',
          titleTR: 'Perakende Alışveriş Festivali Başladı',
          descriptionTR:
            'Şehir genelinde mağaza ve dükkânlarda müşteri talebi 4 gün boyunca %18 arttı.',
          affectedSector: 'ALL',
          priceImpactMultiplier: 1.0,
          demandImpactMultiplier: 1.18,
          delayDaysAdded: 0,
          startDay: state.day,
          endDay: state.day + 4,
          isActive: true,
        });
      } else if (evRoll < 0.65) {
        ts.activeTradeEvents.push({
          eventId: `TEV-D${state.day}`,
          eventType: 'RAW_MATERIAL_SURGE',
          titleTR: 'Küresel Hammadde ve Navlun Artışı',
          descriptionTR:
            'İthal hammadde ve elektronik bileşen fiyatlarında geçici %10 artış yaşandı.',
          affectedSector: 'ELEKTRONIK',
          priceImpactMultiplier: 1.1,
          demandImpactMultiplier: 1.0,
          delayDaysAdded: 0,
          startDay: state.day,
          endDay: state.day + 4,
          isActive: true,
        });
      }
    }

    // 2. Yoldaki Sevkiyatları İlerlet ve Varanları Teslim Et
    TradeAndShopEngine.advanceShipmentsAndDeliveries(state, rng);

    // 3. Otomatik Tedarik Sözleşmelerini (`PurchaseContract`) Güvenlik Limitleriyle Çalıştır
    for (const pc of ts.purchaseContracts) {
      if (!pc.isActive) continue;
      if (state.day > pc.endDay) {
        pc.isActive = false;
        continue;
      }

      const daysSinceLast = state.day - pc.lastTriggeredDay;
      if (daysSinceLast < Math.max(1, pc.periodDays)) continue;

      // Güvenlik sınırı kontrolü: Mevcut nakit rezervi ve depo doluluk oranı
      const availableCash = state.playerCompany
        ? state.playerCompany.financials.cash
        : Math.max(0, state.cash - reservedOrderCash);
      const estimatedOrderCost =
        pc.orderQuantityPerTrigger * pc.lockedUnitPrice * 1.08;

      if (
        availableCash - estimatedOrderCost <
        pc.safetyLimits.minCashReserve
      ) {
        continue;
      }
      if (
        ts.todaySummary.procurementSpend + estimatedOrderCost >
        pc.safetyLimits.maxDailySpend
      ) {
        continue;
      }

      // Düşük stok eşiği kontrolü
      if (pc.autoTriggerMode === 'LOW_STOCK_THRESHOLD') {
        let currentStock = 0;
        if (pc.targetDestinationType === 'WAREHOUSE') {
          const wh = ts.warehouses.find(
            (w) => w.warehouseId === pc.targetDestinationId
          );
          if (wh) {
            const fillPct =
              (wh.usedCapacityUnits / Math.max(1, wh.maxCapacityUnits)) * 100;
            if (fillPct >= pc.safetyLimits.maxWarehouseFillPct) continue;
            currentStock = TradeAndShopEngine.getAvailableResourceUnits(
              wh.batches,
              pc.resourceId
            );
          }
        } else {
          const shop = ts.shops.find(
            (s) => s.shopId === pc.targetDestinationId
          );
          if (shop) {
            currentStock = TradeAndShopEngine.getAvailableResourceUnits(
              shop.inventoryBatches,
              pc.resourceId
            );
          }
        }
        if (currentStock > pc.lowStockThresholdUnits) {
          continue;
        }
      }

      const ordRes = TradeAndShopEngine.placeProcurementOrder(state, {
        supplierId: pc.supplierId,
        resourceId: pc.resourceId,
        quantity: pc.orderQuantityPerTrigger,
        targetDestinationType: pc.targetDestinationType,
        targetDestinationId: pc.targetDestinationId,
        paymentMethod: 'CASH',
        reservedOrderCash,
        lockedUnitPriceOverride: pc.lockedUnitPrice,
        idempotencyKey: `AUTO-PC-${pc.contractId}-D${state.day}`,
      });

      if (ordRes.success) {
        pc.lastTriggeredDay = state.day;
        pc.totalOrderedUnits += pc.orderQuantityPerTrigger;
      }
    }

    // 4. Her Bir Esnaf Dükkânı / Mağaza Şubesi İçin Günlük Operasyon, Fire, Müşteri Talebi ve Gerçek Stoktan Satış
    for (const shop of ts.shops) {
      const tpl = SHOP_TEMPLATES[shop.shopType];
      shop.todayWalkInCustomers = 0;
      shop.todayServedCustomers = 0;
      shop.todayUnmetCustomerDemand = 0;
      shop.todayUnitsSold = 0;
      shop.todaySalesRevenue = 0;
      shop.todayCogs = 0;
      shop.todaySpoilageUnits = 0;
      shop.todaySpoilageCost = 0;

      // 4a. Eğer şirket şubesiyse ve merkez mamul deposunda uygun ürün varsa otomatik raf beslemesi yap
      if (shop.autoReplenishEnabled && state.playerCompany) {
        const finWh = ts.warehouses.find((w) => w.type === 'FINISHED_GOODS');
        if (finWh) {
          for (const resId of tpl.allowedResourceIds) {
            const shopQty = TradeAndShopEngine.getAvailableResourceUnits(
              shop.inventoryBatches,
              resId
            );
            if (shopQty < Math.round(shop.shelfCapacity * 0.25)) {
              const whAvail = TradeAndShopEngine.getAvailableResourceUnits(
                finWh.batches,
                resId
              );
              if (whAvail > 0) {
                const transferQty = Math.min(
                  whAvail,
                  Math.max(5, Math.round(shop.shelfCapacity * 0.35))
                );
                TradeAndShopEngine.dispatchWarehouseToShopShipment(state, {
                  warehouseId: finWh.warehouseId,
                  shopId: shop.shopId,
                  resourceId: resId,
                  quantity: transferQty,
                });
              }
            }
          }
        }
      }

      // 4b. Bozulabilir ürün firesi (özellikle Manav, Kafe, Taze Gıda)
      for (const batch of shop.inventoryBatches) {
        const resDef = RESOURCE_CATALOG[batch.resourceId];
        if (!resDef || resDef.spoilageRateDaily <= 0 || batch.quantity <= 0) {
          continue;
        }
        const effectiveSpoilageRate =
          resDef.spoilageRateDaily *
          (shop.specificState.spoilageRateMultiplier || 1.0);
        const spoiled =
          batch.quantity >= 8
            ? Math.floor(batch.quantity * effectiveSpoilageRate)
            : 0;
        if (spoiled > 0) {
          const actualSpoiled = Math.min(batch.availableQuantity, spoiled);
          batch.quantity -= actualSpoiled;
          batch.availableQuantity = Math.max(
            0,
            batch.quantity - batch.reservedQuantity
          );
          batch.totalValue = Number(
            (batch.quantity * batch.unitCost).toFixed(2)
          );
          const spoilCost = Number(
            (actualSpoiled * batch.unitCost).toFixed(2)
          );
          shop.todaySpoilageUnits += actualSpoiled;
          shop.todaySpoilageCost = Number(
            (shop.todaySpoilageCost + spoilCost).toFixed(2)
          );
        }
      }
      shop.inventoryBatches = shop.inventoryBatches.filter(
        (b) => b.quantity > 0
      );

      // 4c. Kategori çeşitliliği ve türe özgü talep çarpanı
      const stockedResourceIds = Array.from(
        new Set(
          shop.inventoryBatches
            .filter((b) => b.availableQuantity > 0)
            .map((b) => b.resourceId)
        )
      );
      shop.specificState.activeCategoryCount = stockedResourceIds.length;

      const staffAdequacyRatio = Math.min(
        1.25,
        shop.staffCount / Math.max(1, shop.minStaffRequired)
      );
      const satisfactionFactor = 0.65 + (shop.customerSatisfaction / 100) * 0.55;
      const reputationFactor = 0.75 + (ts.tradeReputationScore / 100) * 0.45;
      const macroFactor = Math.max(
        0.75,
        Math.min(1.25, 0.95 + (state.macro.gdpGrowthRate - 0.025) * 1.5)
      );

      let eventDemandMult = 1.0;
      for (const ev of ts.activeTradeEvents) {
        if (ev.isActive) {
          eventDemandMult *= ev.demandImpactMultiplier;
        }
      }

      // Türe özgü mekanik bonusu
      let mechanicDemandMultiplier = 1.0;
      if (shop.shopType === 'MARKET') {
        // Çoklu kategori bonusu
        mechanicDemandMultiplier =
          0.85 + Math.min(5, stockedResourceIds.length) * 0.12;
      } else if (shop.shopType === 'KAFE') {
        const tableFactor = Math.min(
          1.6,
          (shop.specificState.tableCount || 12) / 12
        );
        mechanicDemandMultiplier = 0.9 * tableFactor;
      } else if (shop.shopType === 'GIYIM_MAGAZASI') {
        // Sezonluk dalgalanma
        const isHighSeason = state.day % 14 < 8;
        shop.specificState.seasonalCollectionActive = isHighSeason;
        mechanicDemandMultiplier = isHighSeason ? 1.22 : 0.92;
      } else if (shop.shopType === 'ELEKTRONIK_MAGAZASI') {
        mechanicDemandMultiplier =
          1.0 + (shop.specificState.warrantySatisfactionBonus || 8) * 0.015;
      } else if (shop.shopType === 'MOBILYA_MAGAZASI') {
        mechanicDemandMultiplier =
          0.95 + (shop.specificState.deliveryServiceCapacity || 10) * 0.02;
      } else if (shop.shopType === 'OTOMOBIL_GALERISI') {
        mechanicDemandMultiplier =
          0.85 + (shop.specificState.showroomSlots || 6) * 0.04;
      }

      const rawDailyCustomers = Math.max(
        1,
        Math.round(
          shop.maxCustomerCapacity *
            0.68 *
            staffAdequacyRatio *
            satisfactionFactor *
            reputationFactor *
            macroFactor *
            eventDemandMultiplier(eventDemandMult) *
            mechanicDemandMultiplier
        )
      );
      shop.todayWalkInCustomers = rawDailyCustomers;

      // 4d. Stoktaki her ürün için fiyat elastikiyeti ve gerçek stoktan satış (`actualSold <= availableStock`)
      if (stockedResourceIds.length === 0) {
        shop.todayUnmetCustomerDemand = rawDailyCustomers;
        shop.customerSatisfaction = Number(
          Math.max(35, shop.customerSatisfaction - 1.5).toFixed(1)
        );
      } else {
        for (const resId of stockedResourceIds) {
          const resDef = RESOURCE_CATALOG[resId];
          if (!resDef) continue;

          const fairRetailPrice = Number(
            (
              resDef.baseMarketPrice *
              (1 + tpl.defaultGrossMarginPct / 100)
            ).toFixed(2)
          );
          const actualSellPrice =
            shop.sellingPrices[resId] ?? fairRetailPrice;
          const priceRatio = actualSellPrice / Math.max(1, fairRetailPrice);

          // Fiyat elastikiyeti: aşırı pahalı fiyat talebi hızla düşürür
          const priceElasticity =
            priceRatio <= 1.0
              ? Math.min(1.35, 1 + (1 - priceRatio) * 0.8)
              : Math.max(0.08, Math.pow(1 / priceRatio, 2.3));

          const shareOfCustomers = 1 / Math.max(1, stockedResourceIds.length);
          const unitsPerCustomer =
            shop.shopType === 'OTOMOBIL_GALERISI'
              ? 0.25
              : shop.shopType === 'MOBILYA_MAGAZASI' ||
                shop.shopType === 'ELEKTRONIK_MAGAZASI'
              ? 0.45
              : 1.1;

          const demandedUnits = Math.max(
            1,
            Math.round(
              rawDailyCustomers *
                shareOfCustomers *
                unitsPerCustomer *
                priceElasticity
            )
          );

          const availUnits = TradeAndShopEngine.getAvailableResourceUnits(
            shop.inventoryBatches,
            resId
          );
          const actualSold = Math.min(availUnits, demandedUnits);
          const unmet = Math.max(0, demandedUnits - actualSold);
          shop.todayUnmetCustomerDemand += unmet;

          if (actualSold > 0) {
            const consumed = TradeAndShopEngine.consumeFromInventoryBatches(
              shop.inventoryBatches,
              resId,
              actualSold
            );
            const salesRev = Number(
              (consumed.consumedUnits * actualSellPrice).toFixed(2)
            );
            shop.todayUnitsSold += consumed.consumedUnits;
            shop.todayServedCustomers += Math.min(
              rawDailyCustomers,
              consumed.consumedUnits
            );
            shop.todaySalesRevenue = Number(
              (shop.todaySalesRevenue + salesRev).toFixed(2)
            );
            shop.todayCogs = Number(
              (shop.todayCogs + consumed.totalCostBasis).toFixed(2)
            );
          }
        }

        if (shop.todayUnmetCustomerDemand === 0 && shop.todayUnitsSold > 0) {
          shop.customerSatisfaction = Number(
            Math.min(98, shop.customerSatisfaction + 0.8).toFixed(1)
          );
        } else if (shop.todayUnmetCustomerDemand > shop.todayUnitsSold) {
          shop.customerSatisfaction = Number(
            Math.max(40, shop.customerSatisfaction - 1.0).toFixed(1)
          );
        }
      }

      // 4e. Günlük kira, personel ve işletme giderleri
      shop.todayPayrollCost = Number(
        (shop.staffCount * shop.staffDailyWagePerPerson).toFixed(2)
      );
      shop.todayRentAndOpex = Number(
        (shop.dailyRent + shop.level * 120).toFixed(2)
      );
      const totalDailyExpenses = Number(
        (shop.todayPayrollCost + shop.todayRentAndOpex).toFixed(2)
      );

      shop.todayNetProfit = Number(
        (
          shop.todaySalesRevenue -
          shop.todayCogs -
          totalDailyExpenses -
          shop.todaySpoilageCost
        ).toFixed(2)
      );
      shop.cumulativeRevenue = Number(
        (shop.cumulativeRevenue + shop.todaySalesRevenue).toFixed(2)
      );
      shop.cumulativeNetProfit = Number(
        (shop.cumulativeNetProfit + shop.todayNetProfit).toFixed(2)
      );
      shop.dailyProfitHistory30.push(shop.todayNetProfit);
      if (shop.dailyProfitHistory30.length > 30) {
        shop.dailyProfitHistory30.shift();
      }

      // 4f. Nakit ve Bilanço Yansıması
      const netCashFlowToday = Number(
        (shop.todaySalesRevenue - totalDailyExpenses).toFixed(2)
      );
      const inventoryReductionTotal = Number(
        (shop.todayCogs + shop.todaySpoilageCost).toFixed(2)
      );

      if (shop.isCompanyBranch && state.playerCompany) {
        const pc = state.playerCompany;
        pc.financials.inventory = Number(
          Math.max(0, pc.financials.inventory - inventoryReductionTotal).toFixed(2)
        );
        pc.financials.cash = Number(
          Math.max(0, pc.financials.cash + netCashFlowToday).toFixed(2)
        );
        pc.capitalCash = pc.financials.cash;
        pc.financials.totalAssets = Number(
          (
            pc.financials.cash +
            pc.financials.inventory +
            pc.financials.receivables +
            pc.financials.fixedAssets
          ).toFixed(2)
        );
        pc.financials.shareholdersEquity = Number(
          (
            pc.financials.totalAssets - pc.financials.totalLiabilities
          ).toFixed(2)
        );
        pc.financials.retainedEarnings = Number(
          (
            pc.financials.shareholdersEquity - pc.financials.paidInCapital
          ).toFixed(2)
        );
      } else {
        if (shop.cashAccountBalance + netCashFlowToday >= 0) {
          shop.cashAccountBalance = Number(
            (shop.cashAccountBalance + netCashFlowToday).toFixed(2)
          );
        } else {
          // Dükkân kasası yetmezse kalan gideri kişisel nakitten, o da yetmezse kısa vadeli borçtan karşıla
          const shortfall = Number(
            (-(shop.cashAccountBalance + netCashFlowToday)).toFixed(2)
          );
          shop.cashAccountBalance = 0;
          const spendable = Math.max(0, state.cash - reservedOrderCash);
          if (spendable >= shortfall) {
            state.cash = Number((state.cash - shortfall).toFixed(2));
            shop.totalInvestedCapital = Number(
              Math.max(5_000, shop.totalInvestedCapital - shortfall).toFixed(2)
            );
          } else {
            state.shortTermDebt = Number(
              (state.shortTermDebt + shortfall).toFixed(2)
            );
            state.totalDebt = Number(
              (state.shortTermDebt + state.longTermDebt).toFixed(2)
            );
          }
        }
      }

      // 4g. Ana sorun ve önerilen işlem metni (Temiz oyuncu arayüzü için)
      const totalUnitsLeft = shop.inventoryBatches.reduce(
        (s, b) => s + b.availableQuantity,
        0
      );
      if (totalUnitsLeft === 0) {
        shop.mainIssueTR =
          shop.pendingDeliveriesCount > 0
            ? `Stok bitti · ${shop.pendingDeliveriesCount} sevkiyat yolda.`
            : 'Raflarda ürün kalmadı — satış durdu.';
        shop.recommendedActionTR =
          shop.pendingDeliveriesCount > 0
            ? 'Yoldaki teslimatın ulaşmasını bekleyin.'
            : 'Hemen tedarikçiden ürün sipariş edin.';
      } else if (totalUnitsLeft < Math.round(shop.shelfCapacity * 0.2)) {
        shop.mainIssueTR = `Kritik stok seviyesi (${totalUnitsLeft} birim kaldı).`;
        shop.recommendedActionTR = 'Stok bitmeden yeni ürün siparişi verin.';
      } else if (shop.staffCount < shop.minStaffRequired) {
        shop.mainIssueTR = `Çalışan sayısı yetersiz (${shop.staffCount}/${shop.minStaffRequired}).`;
        shop.recommendedActionTR = 'Müşteri kaçırmamak için yeni çalışan alın.';
      } else if (shop.todayNetProfit < 0) {
        shop.mainIssueTR = 'Bugün giderler satış kârını aştı.';
        shop.recommendedActionTR =
          'Satış fiyatlarını veya ürün çeşitliliğini gözden geçirin.';
      } else {
        shop.mainIssueTR = 'Sorun yok — satışlar ve stok dengeli.';
        shop.recommendedActionTR =
          shop.level < 5
            ? `Kapasiteyi büyütmek için Seviye ${shop.level + 1} geliştirmesini değerlendirin.`
            : 'Yeni şube açarak ticaret ağınızı büyütün.';
      }

      ts.todaySummary.shopSalesRevenue = Number(
        (ts.todaySummary.shopSalesRevenue + shop.todaySalesRevenue).toFixed(2)
      );
      ts.todaySummary.shopCogs = Number(
        (ts.todaySummary.shopCogs + shop.todayCogs).toFixed(2)
      );
      ts.todaySummary.shopOpex = Number(
        (ts.todaySummary.shopOpex + totalDailyExpenses).toFixed(2)
      );
      ts.todaySummary.shopSpoilageCost = Number(
        (ts.todaySummary.shopSpoilageCost + shop.todaySpoilageCost).toFixed(2)
      );
      ts.todaySummary.shopNetProfit = Number(
        (ts.todaySummary.shopNetProfit + shop.todayNetProfit).toFixed(2)
      );
    }

    const ownShopsChannel = ts.salesChannels.find(
      (c) => c.channelType === 'OWN_SHOPS'
    );
    if (ownShopsChannel) {
      ownShopsChannel.todayUnitsSold = ts.shops.reduce(
        (s, sh) => s + sh.todayUnitsSold,
        0
      );
      ownShopsChannel.todayRevenue = ts.todaySummary.shopSalesRevenue;
    }

    // 5. Vadesi Gelen Alacak ve Borç Faturalarını (`TradeInvoice`) İşle
    for (const inv of ts.invoices) {
      if (inv.status === 'PAID' || inv.status === 'CANCELLED') continue;
      if (state.day < inv.dueDay) continue;

      if (inv.direction === 'RECEIVABLE') {
        const collected = inv.remainingAmount;
        inv.paidAmount = inv.totalAmount;
        inv.remainingAmount = 0;
        inv.status = 'PAID';

        if (state.playerCompany) {
          const pc = state.playerCompany;
          pc.financials.receivables = Number(
            Math.max(0, pc.financials.receivables - collected).toFixed(2)
          );
          pc.financials.cash = Number(
            (pc.financials.cash + collected).toFixed(2)
          );
          pc.capitalCash = pc.financials.cash;
          pc.financials.totalAssets = Number(
            (
              pc.financials.cash +
              pc.financials.inventory +
              pc.financials.receivables +
              pc.financials.fixedAssets
            ).toFixed(2)
          );
        } else {
          state.cash = Number((state.cash + collected).toFixed(2));
        }

        ts.todaySummary.receivablesCollected = Number(
          (ts.todaySummary.receivablesCollected + collected).toFixed(2)
        );
        ts.payments.unshift({
          paymentId: `PAY-IN-D${state.day}-${inv.invoiceId}`,
          invoiceId: inv.invoiceId,
          day: state.day,
          amount: collected,
          direction: 'INFLOW',
          description: `${inv.counterpartyNameTR} vadeli satış faturası tahsilatı`,
        });
      } else if (inv.direction === 'PAYABLE') {
        const toPay = inv.remainingAmount;
        if (state.playerCompany) {
          const pc = state.playerCompany;
          if (pc.financials.cash >= toPay) {
            pc.financials.cash = Number(
              (pc.financials.cash - toPay).toFixed(2)
            );
            pc.capitalCash = pc.financials.cash;
            pc.supplierPayableBalance = Number(
              Math.max(0, (pc.supplierPayableBalance ?? 0) - toPay).toFixed(2)
            );
            pc.financials.shortTermDebt = Number(
              Math.max(0, pc.financials.shortTermDebt - toPay).toFixed(2)
            );
            pc.financials.totalLiabilities = Number(
              (
                pc.financials.shortTermDebt + pc.financials.longTermDebt
              ).toFixed(2)
            );
            pc.financials.totalAssets = Number(
              (
                pc.financials.cash +
                pc.financials.inventory +
                pc.financials.receivables +
                pc.financials.fixedAssets
              ).toFixed(2)
            );
            inv.paidAmount = inv.totalAmount;
            inv.remainingAmount = 0;
            inv.status = 'PAID';
            ts.todaySummary.payablesPaid = Number(
              (ts.todaySummary.payablesPaid + toPay).toFixed(2)
            );
          } else {
            inv.status = 'OVERDUE';
          }
        } else {
          const spendable = Math.max(0, state.cash - reservedOrderCash);
          if (spendable >= toPay) {
            state.cash = Number((state.cash - toPay).toFixed(2));
            inv.paidAmount = inv.totalAmount;
            inv.remainingAmount = 0;
            inv.status = 'PAID';
            ts.todaySummary.payablesPaid = Number(
              (ts.todaySummary.payablesPaid + toPay).toFixed(2)
            );
          } else {
            inv.status = 'OVERDUE';
          }
        }
      }
    }

    // 6. Vadesi Geçen Kurumsal Sözleşmelerin Ceza ve İtibar Kontrolü
    for (const cc of ts.commercialContracts) {
      if (cc.status !== 'ACTIVE') continue;
      if (state.day > cc.dueDay && cc.remainingUnits > 0) {
        const penalty = Number(
          (cc.remainingUnits * cc.latePenaltyPerUnit).toFixed(2)
        );
        cc.status = 'DEFAULTED';
        ts.tradeReputationScore = Math.max(
          15,
          ts.tradeReputationScore - cc.reputationPenalty
        );
        ts.deliveryPunctualityScore = Math.max(
          20,
          ts.deliveryPunctualityScore - 8
        );
        ts.todaySummary.overduePenaltiesPaid = Number(
          (ts.todaySummary.overduePenaltiesPaid + penalty).toFixed(2)
        );

        if (state.playerCompany) {
          const pc = state.playerCompany;
          const paidPenalty = Math.min(pc.financials.cash, penalty);
          pc.financials.cash = Number(
            (pc.financials.cash - paidPenalty).toFixed(2)
          );
          pc.capitalCash = pc.financials.cash;
          pc.financials.totalAssets = Number(
            (
              pc.financials.cash +
              pc.financials.inventory +
              pc.financials.receivables +
              pc.financials.fixedAssets
            ).toFixed(2)
          );
          pc.financials.shareholdersEquity = Number(
            (
              pc.financials.totalAssets - pc.financials.totalLiabilities
            ).toFixed(2)
          );
          pc.financials.retainedEarnings = Number(
            (
              pc.financials.shareholdersEquity - pc.financials.paidInCapital
            ).toFixed(2)
          );
        }
      }
    }

    TradeAndShopEngine.updateCareerStage(state);
    ts.lastTradeAuditReport = TradeAndShopEngine.runTradeIntegrityAudit(state);
  }

  // ============================================================================
  // 13. STOK, TİCARET VE MUHASEBE TUTARLILIK DENETİMİ (`runTradeIntegrityAudit`)
  // ============================================================================

  public static runTradeIntegrityAudit(
    state: SimulationState
  ): TradeIntegrityAuditReport {
    const ts = TradeAndShopEngine.ensureTradeUniverseState(state);
    const errors: string[] = [];
    let negativeStockBatchesCount = 0;
    let exceededWarehouseCount = 0;
    let duplicateOrderCount = 0;
    let duplicateShipmentDeliveryCount = 0;
    let imaginarySalesCount = 0;

    // 1. Depo kapasitesi ve negatif parti kontrolü
    for (const wh of ts.warehouses) {
      let sumQty = 0;
      for (const b of wh.batches) {
        if (
          b.quantity < 0 ||
          b.availableQuantity < 0 ||
          !Number.isFinite(b.quantity) ||
          !Number.isFinite(b.unitCost)
        ) {
          negativeStockBatchesCount += 1;
          errors.push(`Depo (${wh.nameTR}) negatif veya geçersiz parti: ${b.batchId}`);
        }
        sumQty += b.quantity;
      }
      wh.usedCapacityUnits = sumQty;
      if (sumQty > wh.maxCapacityUnits + 0.01) {
        exceededWarehouseCount += 1;
        errors.push(
          `Depo (${wh.nameTR}) kapasite aşımı: ${sumQty} > ${wh.maxCapacityUnits}`
        );
      }
    }

    // 2. Dükkân stok partileri kontrolü
    for (const shop of ts.shops) {
      let sumShopQty = 0;
      for (const b of shop.inventoryBatches) {
        if (
          b.quantity < 0 ||
          b.availableQuantity < 0 ||
          !Number.isFinite(b.quantity)
        ) {
          negativeStockBatchesCount += 1;
          errors.push(`Dükkân (${shop.nameTR}) negatif parti: ${b.batchId}`);
        }
        sumShopQty += b.quantity;
      }
      const maxShopCap = shop.shelfCapacity + shop.backroomCapacity;
      if (sumShopQty > maxShopCap + 0.01) {
        exceededWarehouseCount += 1;
        errors.push(
          `Dükkân (${shop.nameTR}) kapasite aşımı: ${sumShopQty} > ${maxShopCap}`
        );
      }
      if (shop.todayUnitsSold > 0 && shop.todaySalesRevenue <= 0) {
        imaginarySalesCount += 1;
        errors.push(`Dükkân (${shop.nameTR}) tutarsız satış cirosu`);
      }
    }

    // 3. Mükerrer sipariş veya mükerrer teslimat kimliği kontrolü
    const seenOrders = new Set<string>();
    for (const o of ts.procurementOrders) {
      if (seenOrders.has(o.orderId)) {
        duplicateOrderCount += 1;
        errors.push(`Mükerrer satın alma siparişi: ${o.orderId}`);
      }
      seenOrders.add(o.orderId);
    }

    const seenDelivered = new Set<string>();
    for (const shId of ts.deliveredShipmentIds) {
      if (seenDelivered.has(shId)) {
        duplicateShipmentDeliveryCount += 1;
        errors.push(`Mükerrer teslim edilen sevkiyat: ${shId}`);
      }
      seenDelivered.add(shId);
    }

    return {
      valid: errors.length === 0,
      checkedDay: state.day,
      negativeStockBatchesCount,
      exceededWarehouseCount,
      duplicateOrderCount,
      duplicateShipmentDeliveryCount,
      imaginarySalesCount,
      unexplainedCashDelta: 0,
      unexplainedStockDelta: 0,
      errors,
    };
  }
}

function eventDemandMultiplier(val: number): number {
  return Number.isFinite(val) && val > 0 ? val : 1.0;
}
