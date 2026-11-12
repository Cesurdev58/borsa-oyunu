/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞİRKET KATALOĞU: şirket kuruluş parametreleri ve yatırım paketleri (yalnızca veri).
 */

import {
  InvestmentPackageType,
} from '../models/finance';
import {
  SectorId,
} from '../models/market';

export interface EstablishCompanyParams {
  name: string;
  ticker: string;
  sector: SectorId;
  initialCapital: number;
  initialStaffCount?: number;
  initialRdBudget?: number;
  initialCapacity?: number;
}

export const INVESTMENT_PACKAGE_CATALOG: Record<
  InvestmentPackageType,
  {
    titleTR: string;
    capacityGainRatio: number;
    minCapacityGain: number;
    durationDays: number;
    temporaryDisruptionPct: number;
    delayRiskPct: number;
    cancellationPenaltyRatio: number;
    complexityMultiplier: number;
    fixedDailyOverheadAddRatio: number;
  }
> = {
  SMALL_EXPANSION: {
    titleTR: 'Küçük Kapasite Genişletme (~%5)',
    capacityGainRatio: 0.05,
    minCapacityGain: 5,
    durationDays: 5,
    temporaryDisruptionPct: 2,
    delayRiskPct: 5,
    cancellationPenaltyRatio: 0.15,
    complexityMultiplier: 1.0,
    fixedDailyOverheadAddRatio: 0.02,
  },
  MEDIUM_EXPANSION: {
    titleTR: 'Orta Kapasite Genişletme (~%15)',
    capacityGainRatio: 0.15,
    minCapacityGain: 15,
    durationDays: 12,
    temporaryDisruptionPct: 5,
    delayRiskPct: 10,
    cancellationPenaltyRatio: 0.2,
    complexityMultiplier: 1.12,
    fixedDailyOverheadAddRatio: 0.05,
  },
  LARGE_EXPANSION: {
    titleTR: 'Büyük Kapasite Genişletme (~%35)',
    capacityGainRatio: 0.35,
    minCapacityGain: 35,
    durationDays: 24,
    temporaryDisruptionPct: 10,
    delayRiskPct: 18,
    cancellationPenaltyRatio: 0.25,
    complexityMultiplier: 1.28,
    fixedDailyOverheadAddRatio: 0.1,
  },
  NEW_PRODUCTION_LINE: {
    titleTR: 'Yeni Otomasyon Üretim Hattı (~%60)',
    capacityGainRatio: 0.6,
    minCapacityGain: 50,
    durationDays: 18,
    temporaryDisruptionPct: 6,
    delayRiskPct: 12,
    cancellationPenaltyRatio: 0.22,
    complexityMultiplier: 1.22,
    fixedDailyOverheadAddRatio: 0.14,
  },
  NEW_FACTORY: {
    titleTR: 'Yeni Organize Sanayi Fabrikası (~%120)',
    capacityGainRatio: 1.2,
    minCapacityGain: 120,
    durationDays: 35,
    temporaryDisruptionPct: 3,
    delayRiskPct: 22,
    cancellationPenaltyRatio: 0.3,
    complexityMultiplier: 1.45,
    fixedDailyOverheadAddRatio: 0.25,
  },
  CUSTOM_TARGET: {
    titleTR: 'Özel Hedef Kapasite Projesi',
    capacityGainRatio: 0.1,
    minCapacityGain: 5,
    durationDays: 10,
    temporaryDisruptionPct: 4,
    delayRiskPct: 8,
    cancellationPenaltyRatio: 0.2,
    complexityMultiplier: 1.15,
    fixedDailyOverheadAddRatio: 0.06,
  },
  BUDGET_MAX: {
    titleTR: 'Bütçeye Göre Maksimum Güvenli Kapasite Yatırımı',
    capacityGainRatio: 0.25,
    minCapacityGain: 1,
    durationDays: 12,
    temporaryDisruptionPct: 5,
    delayRiskPct: 10,
    cancellationPenaltyRatio: 0.2,
    complexityMultiplier: 1.15,
    fixedDailyOverheadAddRatio: 0.06,
  },
};
