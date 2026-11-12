/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * İLERLEME KURALLARI (ProgressionRules)
 * "Hangi aşamadayım, neyi açtım?" sorusunun TEK cevap yeri.
 * Eskiden bu eşikler ana döngüde, kayıt/yükleme dosyasında ve şehir verisinde ayrı ayrı yazılıydı.
 *
 * Aşamalar:
 *  1. Borsa yatırımcısı   (başlangıç)
 *  2. Girişimci           (şirket kurulunca, net değer eşiğine ulaşınca ya da şirketleşme şartları tamamlanınca)
 *  3. Halka açık şirket   (şirket borsada işlem görüyorsa)
 *  4. Holding             (bağlı ortaklık varsa; kilit ise %5+ hisse ya da halka açık şirketle açılır)
 */

import { FIRST_SHOP_MIN_NET_WORTH } from '../data/gameBalance';
import { SimulationStage } from '../models/simulation';
import type { SimulationState } from '../models/simulation';
import { CompanyEngine } from './CompanyEngine';
import { IPOEngine } from './IPOEngine';
import { TradeAndShopEngine } from './TradeAndShopEngine';

export const PROGRESSION_RULES = {
  /** Bu net değere ulaşan oyuncu girişimci aşamasını açar (TL). */
  entrepreneurNetWorth: CompanyEngine.STAGE_2_NET_WORTH_THRESHOLD,
  /** Başka bir şirkette bu oranda (%) hisse, holding aşamasını açar. */
  holdingStakeOwnershipPct: 5.0,
  /** Kilitli genişleme bölgelerini açan eşikler (herhangi biri yeterli). */
  expansionDistrictNetWorth: 5_000_000,
  expansionDistrictStaff: 40,
  expansionDistrictGovernanceScore: 75,
  /** İlk dükkânı (esnaflığı) açmak için gereken net değer (TL). */
  firstShopNetWorth: FIRST_SHOP_MIN_NET_WORTH,
  /** Net değer kayıtta yoksa varsayılan. */
  defaultNetWorth: 100_000,
} as const;

type PartialState = Partial<SimulationState>;

export class ProgressionRules {
  /**
   * Kayıt/şehir verisi için: girişimci aşaması açık mı?
   * (Şirketleşme şartları ticaret verisi gerektirdiği için burada yoktur; motor onu ayrıca ekler.)
   */
  public static hasEntrepreneurAccess(st: PartialState): boolean {
    const netWorth =
      typeof st.netWorth === 'number' ? st.netWorth : PROGRESSION_RULES.defaultNetWorth;
    return Boolean(
      st.stageUnlocks?.stage2Entrepreneur ||
        st.playerCompany ||
        netWorth >= PROGRESSION_RULES.entrepreneurNetWorth
    );
  }

  /** Holding aşaması açık mı? */
  public static isHoldingStage(st: PartialState): boolean {
    return Boolean(
      st.stageUnlocks?.stage4Holding ||
        (st.stage ?? SimulationStage.STAGE_1_RETAIL_INVESTOR) >=
          SimulationStage.STAGE_4_HOLDING_MONOPOLY
    );
  }

  /** Kilitli genişleme bölgeleri (holding bölgeleri) açılmalı mı? */
  public static qualifiesForExpansionDistricts(st: PartialState): boolean {
    const netWorth =
      typeof st.netWorth === 'number' ? st.netWorth : PROGRESSION_RULES.defaultNetWorth;
    const pc = st.playerCompany ?? null;
    return Boolean(
      ProgressionRules.isHoldingStage(st) ||
        netWorth >= PROGRESSION_RULES.expansionDistrictNetWorth ||
        (pc && pc.staffCount >= PROGRESSION_RULES.expansionDistrictStaff) ||
        (pc &&
          (pc.corporateGovernanceScore ?? 50) >=
            PROGRESSION_RULES.expansionDistrictGovernanceScore)
    );
  }

  /**
   * Oyun motorunun her yeniden hesaplamada çağırdığı tek giriş:
   * aşama kilitlerini açar (açılan kilit bir daha kapanmaz) ve güncel aşamayı belirler.
   */
  public static applyUnlocksAndStage(state: SimulationState): void {
    const incorpCheck = TradeAndShopEngine.checkIncorporationEligibility(state);
    if (
      state.netWorth >= PROGRESSION_RULES.entrepreneurNetWorth ||
      state.playerCompany !== null ||
      incorpCheck.eligible
    ) {
      state.stageUnlocks.stage2Entrepreneur = true;
    }

    TradeAndShopEngine.ensureTradeUniverseState(state);

    const ipoCheck = IPOEngine.checkEligibility(state.playerCompany);
    if (ipoCheck.eligible || (state.playerCompany && state.playerCompany.isPubliclyListed)) {
      state.stageUnlocks.stage3Ipo = true;
    }

    const hasSignificantStakeOrControl =
      state.controlledSubsidiaries.length > 0 ||
      state.stocks.some(
        (s) =>
          !s.isPlayerCompany &&
          s.playerOwnershipPct >= PROGRESSION_RULES.holdingStakeOwnershipPct
      ) ||
      (state.playerCompany !== null && state.playerCompany.isPubliclyListed);
    if (hasSignificantStakeOrControl) {
      state.stageUnlocks.stage4Holding = true;
    }

    if (state.controlledSubsidiaries.length > 0) {
      state.stage = SimulationStage.STAGE_4_HOLDING_MONOPOLY;
    } else if (state.playerCompany && state.playerCompany.isPubliclyListed) {
      state.stage = SimulationStage.STAGE_3_IPO_PUBLIC;
    } else if (state.stageUnlocks.stage2Entrepreneur || state.playerCompany !== null) {
      state.stage = SimulationStage.STAGE_2_ENTREPRENEUR;
    } else {
      state.stage = SimulationStage.STAGE_1_RETAIL_INVESTOR;
    }
  }
}
