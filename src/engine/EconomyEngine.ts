/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 3 & 10: MAKROEKONOMİ MOTORU (EconomyEngine)
 * Faiz, enflasyon, GSYH büyümesi ve piyasa risk iştahını yönetir.
 */

import { SECTOR_CONFIGS } from '../data/sectors';
import { EconomicCyclePhase, MacroEconomyState } from '../models/economy';
import { SectorId } from '../models/market';
import { RandomEngine } from './RandomEngine';

export class EconomyEngine {
  public static createInitialMacroState(): MacroEconomyState {
    return {
      policyInterestRate: 0.36, // %36 politika faizi
      inflationRate: 0.31, // %31 yıllık enflasyon
      gdpGrowthRate: 0.042, // %4.2 reel büyüme
      marketRiskAppetite: 0.62, // 0.62 pozitif-nötr risk iştahı
      corporateTaxRate: 0.25, // %25 kurumlar vergisi
      sovereignRiskSpread: 0.026, // 260 bps ülke risk primi
      cyclePhase: 'EXPANSION',
    };
  }

  /**
   * Günlük makroekonomik göstergeleri ortalamaya dönüşlü (Ornstein-Uhlenbeck) süreçle günceller.
   */
  public static updateMacroIndicators(
    macro: MacroEconomyState,
    day: number,
    rng: RandomEngine
  ): MacroEconomyState {
    const rateShock = rng.normal() * 0.0008;
    const inflationShock = rng.normal() * 0.0007;
    const growthShock = rng.normal() * 0.0004;
    const riskShock = rng.normal() * 0.012;

    const targetRate = 0.34;
    const targetInflation = 0.28;
    const targetGrowth = 0.04;
    const targetRisk = 0.6;

    const policyInterestRate = Number(
      Math.max(
        0.12,
        Math.min(0.55, macro.policyInterestRate + 0.03 * (targetRate - macro.policyInterestRate) + rateShock)
      ).toFixed(4)
    );

    const inflationRate = Number(
      Math.max(
        0.08,
        Math.min(0.65, macro.inflationRate + 0.025 * (targetInflation - macro.inflationRate) + inflationShock)
      ).toFixed(4)
    );

    const gdpGrowthRate = Number(
      Math.max(
        -0.02,
        Math.min(0.09, macro.gdpGrowthRate + 0.03 * (targetGrowth - macro.gdpGrowthRate) + growthShock)
      ).toFixed(4)
    );

    const marketRiskAppetite = Number(
      Math.max(
        0.15,
        Math.min(0.95, macro.marketRiskAppetite + 0.06 * (targetRisk - macro.marketRiskAppetite) + riskShock)
      ).toFixed(4)
    );

    let cyclePhase: EconomicCyclePhase = macro.cyclePhase;
    if (gdpGrowthRate >= 0.045 && marketRiskAppetite >= 0.65) {
      cyclePhase = 'PEAK';
    } else if (gdpGrowthRate >= 0.028) {
      cyclePhase = 'EXPANSION';
    } else if (gdpGrowthRate >= 0.005) {
      cyclePhase = 'CONTRACTION';
    } else {
      cyclePhase = 'TROUGH';
    }

    // Her 30 günde bir Para Politikası Kurulu faiz ayarlaması
    let adjustedPolicyRate = policyInterestRate;
    if (day % 30 === 0) {
      const inflationGap = inflationRate - adjustedPolicyRate;
      adjustedPolicyRate = Number(
        Math.max(0.12, Math.min(0.55, adjustedPolicyRate + inflationGap * 0.1)).toFixed(4)
      );
    }

    return {
      ...macro,
      policyInterestRate: adjustedPolicyRate,
      inflationRate,
      gdpGrowthRate,
      marketRiskAppetite,
      cyclePhase,
    };
  }

  /**
   * Makroekonomik durumun belirli bir sektör üzerindeki günlük logaritmik getiri etkisini hesaplar.
   */
  public static computeDailyMacroReturnEffect(
    macro: MacroEconomyState,
    sector: SectorId
  ): number {
    const sectorMeta = SECTOR_CONFIGS[sector];
    const realRate = macro.policyInterestRate - macro.inflationRate;
    const growthPremium = (macro.gdpGrowthRate - 0.035) * 0.08;
    const riskAppetiteTerm = (macro.marketRiskAppetite - 0.55) * 0.0045;
    const rateDrag = Math.max(-0.002, Math.min(0.002, (0.04 - realRate) * 0.015));

    const rawEffect = (growthPremium / 252 + riskAppetiteTerm + rateDrag) * sectorMeta.macroBeta;
    return Math.max(-0.006, Math.min(0.006, rawEffect));
  }
}
