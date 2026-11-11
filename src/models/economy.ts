/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EconomicCyclePhase = 'EXPANSION' | 'PEAK' | 'CONTRACTION' | 'TROUGH';

export interface MacroEconomyState {
  policyInterestRate: number; // Yıllık politika faizi (örn. 0.36 = %36)
  inflationRate: number; // Yıllık enflasyon oranı (örn. 0.30 = %30)
  gdpGrowthRate: number; // Yıllık reel GSYH büyümesi (örn. 0.042 = %4.2)
  marketRiskAppetite: number; // Piyasa risk iştahı (0.10 - 1.00)
  corporateTaxRate: number; // Kurumlar vergisi oranı (örn. 0.25 = %25)
  sovereignRiskSpread: number; // CDS / Ülke risk primi (örn. 0.028 = 280 bps)
  cyclePhase: EconomicCyclePhase;
}
