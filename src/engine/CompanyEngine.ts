/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 4, 5 & 6: OYUNCU ŞİRKETİ, TALEP/STOK, DETAYLI GELİR TABLOSU VE ÖLÇEKLENEBİLİR YATIRIM MOTORU (CompanyEngine)
 */

import {
  CompanyCapacity,
} from './CompanyCapacity';
import {
  CompanyFounding,
} from './CompanyFounding';
import {
  CompanyInvestmentProjects,
} from './CompanyInvestmentProjects';
import {
  CompanyOperations,
} from './CompanyOperations';
import {
  CompanyDailyStep,
} from './CompanyDailyStep';
import {
  INVESTMENT_PACKAGE_CATALOG,
  EstablishCompanyParams,
} from '../data/companyCatalog';

export { INVESTMENT_PACKAGE_CATALOG };
export type { EstablishCompanyParams };

/**
 * Şirket motoru ön yüzü (facade). Asıl işler alt modüllerde durur:
 * CompanyCapacity, CompanyFounding, CompanyInvestmentProjects, CompanyOperations, CompanyDailyStep.
 * Eski adlarla (CompanyEngine.xxx) çağırmaya devam edilir.
 */
export class CompanyEngine {
  public static readonly MIN_TECH_MULTIPLIER = CompanyCapacity.MIN_TECH_MULTIPLIER;
  public static readonly MAX_TECH_MULTIPLIER = CompanyCapacity.MAX_TECH_MULTIPLIER;
  public static readonly MIN_WORKFORCE_EFFICIENCY = CompanyCapacity.MIN_WORKFORCE_EFFICIENCY;
  public static readonly MAX_WORKFORCE_EFFICIENCY = CompanyCapacity.MAX_WORKFORCE_EFFICIENCY;
  public static readonly MIN_MACHINE_AVAILABILITY = CompanyCapacity.MIN_MACHINE_AVAILABILITY;
  public static readonly MAX_MACHINE_AVAILABILITY = CompanyCapacity.MAX_MACHINE_AVAILABILITY;
  public static readonly MIN_SHIFT_MULTIPLIER = CompanyCapacity.MIN_SHIFT_MULTIPLIER;
  public static readonly MAX_SHIFT_MULTIPLIER = CompanyCapacity.MAX_SHIFT_MULTIPLIER;
  public static readonly migrateLegacyTechMultiplier = CompanyCapacity.migrateLegacyTechMultiplier;
  public static readonly clampMultipliers = CompanyCapacity.clampMultipliers;
  public static readonly computeEffectiveCapacity = CompanyCapacity.computeEffectiveCapacity;
  public static readonly computeDetailedIncomeBreakdown = CompanyCapacity.computeDetailedIncomeBreakdown;
  public static readonly STAGE_2_NET_WORTH_THRESHOLD = CompanyFounding.STAGE_2_NET_WORTH_THRESHOLD;
  public static readonly MIN_FOUNDING_CAPITAL = CompanyFounding.MIN_FOUNDING_CAPITAL;
  public static readonly ensureCompanyV5Fields = CompanyFounding.ensureCompanyV5Fields;
  public static readonly establishPlayerCompany = CompanyFounding.establishPlayerCompany;
  public static readonly injectCapital = CompanyFounding.injectCapital;
  public static readonly computeInvestmentProjectQuote = CompanyInvestmentProjects.computeInvestmentProjectQuote;
  public static readonly startInvestmentProject = CompanyInvestmentProjects.startInvestmentProject;
  public static readonly cancelInvestmentProject = CompanyInvestmentProjects.cancelInvestmentProject;
  public static readonly stepInvestmentProjects = CompanyInvestmentProjects.stepInvestmentProjects;
  public static readonly liquidateExcessInventory = CompanyOperations.liquidateExcessInventory;
  public static readonly configureOperations = CompanyOperations.configureOperations;
  public static readonly stepPlayerCompanyFraction = CompanyDailyStep.stepPlayerCompanyFraction;
  public static readonly stepPlayerCompanyOneDay = CompanyDailyStep.stepPlayerCompanyOneDay;
  public static readonly stepPlayerCompanyIntraday = CompanyDailyStep.stepPlayerCompanyIntraday;
}
