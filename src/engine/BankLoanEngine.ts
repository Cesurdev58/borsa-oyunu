/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 7: BANKA VE KREDİ ALTYAPISI MOTORU (BankLoanEngine)
 * - 6 kredi türünü (İşletme Sermayesi, Makine/Ekipman, Fabrika Yatırım, Ticari Taşıt/Lojistik,
 *   Rotatif Kredi, Teminatlı Holding Kredisi) destekler.
 * - Kredi uygunluğunu son 30/90/365 gün gerçek operasyonel nakit akışı, borç/özkaynak oranı,
 *   faiz karşılama oranı, serbest teminat değeri, ödeme geçmişi ve politika faiziyle değerlendirir.
 * - Kredi ana parası nakit ve borcu aynı anda oluşturur; gelir veya FAVÖK sayılmaz, net varlığı şişirmez.
 * - Aynı teminatın iki kredide kullanılmasını ve grup içi para dolaşımıyla yapay kredi skoru üretilmesini engeller.
 */

import { SECTOR_CONFIGS } from '../data/sectors';
import {
  BankLoanType,
  CollateralItem,
  LoanBorrowerType,
  LoanContract,
  LoanOfferQuote,
} from '../models/finance';
import { SimulationState } from '../models/simulation';
import { ACCOUNT_IDS, CentralLedgerEngine } from './CentralLedgerEngine';

export const LOAN_TYPE_CATALOG: Record<
  BankLoanType,
  {
    labelTR: string;
    defaultBorrower: LoanBorrowerType;
    spreadOverPolicyRate: number;
    defaultTermDays: number;
    installmentFrequencyDays: number;
    originationFeeRate: number;
    earlyPaymentFeeRate: number;
    lateSpread: number;
    gracePeriodDays: number;
    requiresCollateral: boolean;
    maxDebtToEquityMultiple: number;
    purposeTR: string;
  }
> = {
  WORKING_CAPITAL: {
    labelTR: 'İşletme Sermayesi Kredisi',
    defaultBorrower: 'COMPANY',
    spreadOverPolicyRate: 0.04,
    defaultTermDays: 90,
    installmentFrequencyDays: 30,
    originationFeeRate: 0.01,
    earlyPaymentFeeRate: 0.01,
    lateSpread: 0.12,
    gracePeriodDays: 5,
    requiresCollateral: false,
    maxDebtToEquityMultiple: 1.2,
    purposeTR: 'Hammadde, maaş ve kısa vadeli işletme giderleri finansmanı',
  },
  MACHINE_EQUIPMENT: {
    labelTR: 'Makine ve Ekipman Kredisi',
    defaultBorrower: 'COMPANY',
    spreadOverPolicyRate: 0.025,
    defaultTermDays: 180,
    installmentFrequencyDays: 30,
    originationFeeRate: 0.012,
    earlyPaymentFeeRate: 0.015,
    lateSpread: 0.1,
    gracePeriodDays: 7,
    requiresCollateral: true,
    maxDebtToEquityMultiple: 1.6,
    purposeTR: 'Üretim hattı ve makine kapasite modernizasyonu',
  },
  FACTORY_INVESTMENT: {
    labelTR: 'Fabrika Yatırım Kredisi',
    defaultBorrower: 'COMPANY',
    spreadOverPolicyRate: 0.02,
    defaultTermDays: 360,
    installmentFrequencyDays: 30,
    originationFeeRate: 0.015,
    earlyPaymentFeeRate: 0.02,
    lateSpread: 0.1,
    gracePeriodDays: 10,
    requiresCollateral: true,
    maxDebtToEquityMultiple: 2.0,
    purposeTR: 'Yeni fabrika inşası ve büyük ölçekli tesis yatırımı',
  },
  COMMERCIAL_VEHICLE_LOGISTICS: {
    labelTR: 'Ticari Taşıt ve Lojistik Kredisi',
    defaultBorrower: 'COMPANY',
    spreadOverPolicyRate: 0.03,
    defaultTermDays: 120,
    installmentFrequencyDays: 30,
    originationFeeRate: 0.01,
    earlyPaymentFeeRate: 0.01,
    lateSpread: 0.11,
    gracePeriodDays: 5,
    requiresCollateral: true,
    maxDebtToEquityMultiple: 1.4,
    purposeTR: 'Dağıtım filosu ve depo lojistik altyapısı genişletme',
  },
  REVOLVING_CREDIT: {
    labelTR: 'Rotatif Kısa Vadeli Kredi',
    defaultBorrower: 'COMPANY',
    spreadOverPolicyRate: 0.055,
    defaultTermDays: 60,
    installmentFrequencyDays: 15,
    originationFeeRate: 0.008,
    earlyPaymentFeeRate: 0.005,
    lateSpread: 0.14,
    gracePeriodDays: 3,
    requiresCollateral: false,
    maxDebtToEquityMultiple: 0.9,
    purposeTR: 'Nakit akışı dalgalanmalarında esnek kısa vadeli likidite',
  },
  COLLATERALIZED_HOLDING: {
    labelTR: 'Teminatlı Holding & Yatırım Kredisi',
    defaultBorrower: 'HOLDING',
    spreadOverPolicyRate: 0.035,
    defaultTermDays: 180,
    installmentFrequencyDays: 30,
    originationFeeRate: 0.015,
    earlyPaymentFeeRate: 0.015,
    lateSpread: 0.12,
    gracePeriodDays: 7,
    requiresCollateral: true,
    maxDebtToEquityMultiple: 1.5,
    purposeTR: 'Holding iştirak yatırımları ve stratejik pay alımı finansmanı',
  },
};

export class BankLoanEngine {
  /**
   * Mevcut varlıklardan teminat havuzunu (`state.collaterals`) günceller.
   * Satılmış varlıkları teminat olmaktan çıkarır; zaten rehinli olan (`pledgedLoanId !== null`)
   * teminatların kilidini korur.
   */
  public static syncCollateralPool(state: SimulationState): CollateralItem[] {
    const existing = state.collaterals ?? [];
    const existingPledgeMap = new Map<string, string | null>();
    for (const c of existing) {
      if (c.pledgedLoanId) {
        // Kredi kapanmışsa rehini kaldır
        const activeLoan = (state.activeLoans ?? []).find(
          (l) => l.loanId === c.pledgedLoanId && l.status !== 'PAID_OFF'
        );
        existingPledgeMap.set(
          c.collateralId,
          activeLoan ? c.pledgedLoanId : null
        );
      }
    }

    const updated: CollateralItem[] = [];

    // 1. Şirket Duran Varlıkları ve Stokları
    if (state.playerCompany) {
      const pc = state.playerCompany;
      const fixedColId = `COL-COMP-FIXED-${pc.ticker}`;
      if (pc.financials.fixedAssets > 10_000) {
        updated.push({
          collateralId: fixedColId,
          ownerType: 'COMPANY',
          ownerId: pc.ticker,
          assetType: 'FIXED_ASSET',
          assetRef: pc.ticker,
          label: `${pc.ticker} Fabrika & Makine Sabit Kıymetleri`,
          marketValue: Number(pc.financials.fixedAssets.toFixed(2)),
          haircutFactor: 0.75,
          pledgedLoanId: existingPledgeMap.get(fixedColId) ?? null,
        });
      }

      const invColId = `COL-COMP-INV-${pc.ticker}`;
      if (pc.financials.inventory > 10_000) {
        updated.push({
          collateralId: invColId,
          ownerType: 'COMPANY',
          ownerId: pc.ticker,
          assetType: 'INVENTORY',
          assetRef: pc.ticker,
          label: `${pc.ticker} Ticari Ürün Stoğu`,
          marketValue: Number(pc.financials.inventory.toFixed(2)),
          haircutFactor: 0.55,
          pledgedLoanId: existingPledgeMap.get(invColId) ?? null,
        });
      }
    }

    // 2. Borsa Portföy Hisseleri (Satılmış olanlar otomatik elenir, rehinli olanlar satılamaz)
    for (const [ticker, pos] of Object.entries(state.portfolio)) {
      const colId = `COL-STOCK-${ticker}`;
      const pledged = existingPledgeMap.get(colId) ?? null;
      if (pos.shares > 0 || pledged) {
        const stock = state.stocks.find((s) => s.ticker === ticker);
        const price = stock ? stock.price : pos.averageCost;
        const mktVal = Number((Math.max(0, pos.shares) * price).toFixed(2));
        if (mktVal > 0 || pledged) {
          updated.push({
            collateralId: colId,
            ownerType: state.controlledSubsidiaries.includes(ticker)
              ? 'HOLDING'
              : 'PLAYER',
            ownerId: ticker,
            assetType: state.controlledSubsidiaries.includes(ticker)
              ? 'SUBSIDIARY'
              : 'STOCK_POSITION',
            assetRef: ticker,
            label: `${ticker} Pay Senedi Paketi (${pos.shares} Lot)`,
            marketValue: mktVal,
            haircutFactor: 0.7,
            pledgedLoanId: pledged,
          });
        }
      }
    }

    state.collaterals = updated;
    return updated;
  }

  /**
   * Bir hisse senedinin kredi teminatı olarak rehinli olup olmadığını kontrol eder.
   * Teminatlı varlık kredi kapanmadan serbestçe satılamaz/devredilemez!
   */
  public static isStockPledgedAsCollateral(
    state: SimulationState,
    ticker: string
  ): boolean {
    BankLoanEngine.syncCollateralPool(state);
    const colId = `COL-STOCK-${ticker}`;
    const col = (state.collaterals ?? []).find((c) => c.collateralId === colId);
    return Boolean(col && col.pledgedLoanId !== null);
  }

  /**
   * Gerçek operasyonel nakit akışına ve ödeme geçmişine dayalı Kredi Skoru (300 - 900) hesaplar.
   * Grup içi para dolaşımı veya yeni alınan krediler bu skoru yapay olarak YÜKSELTMEZ!
   */
  public static computeCreditScore(state: SimulationState): number {
    const pc = state.playerCompany;
    let score = 680;

    if (pc) {
      // Sadece gerçek ürün satışlarından doğan operasyonel FAVÖK / nakit akışı dikkate alınır
      const cfHistory = pc.cashFlowHistory365 ?? [];
      const last30 = cfHistory.slice(-30);
      const last90 = cfHistory.slice(-90);
      const sum30 = last30.reduce((a, b) => a + b, 0);
      const sum90 = last90.reduce((a, b) => a + b, 0);

      if (sum30 > 0) score += 35;
      else if (sum30 < 0) score -= 45;

      if (sum90 > 0) score += 25;
      else if (sum90 < 0) score -= 30;

      const equity = Math.max(1, pc.financials.shareholdersEquity);
      const debtToEquity = pc.financials.totalLiabilities / equity;
      if (debtToEquity < 0.4) score += 40;
      else if (debtToEquity > 1.5) score -= 75;
      else if (debtToEquity > 1.0) score -= 35;

      score += Math.round((pc.corporateGovernanceScore - 70) * 1.2);
    }

    for (const loan of state.activeLoans ?? []) {
      if (loan.status === 'PAID_OFF' && loan.missedPaymentCount === 0) {
        score += 15;
      }
      if (loan.missedPaymentCount > 0) {
        score -= loan.missedPaymentCount * 45;
      }
      if (loan.status === 'DEFAULTED') {
        score -= 160;
      }
    }

    const clamped = Math.max(300, Math.min(900, Math.round(score)));
    if (pc) {
      pc.creditScore = clamped;
    }
    return clamped;
  }

  /**
   * Kredi teklifi ve uygunluk analizi üretir.
   * Şirket değerlemesini doğrudan kredi limiti olarak KULLANMAZ; gerçek özkaynak,
   * operasyonel nakit akışı ve serbest teminat değerini baz alır.
   */
  public static computeLoanOfferQuote(
    state: SimulationState,
    params: {
      loanType: BankLoanType;
      requestedPrincipal?: number;
      customTermDays?: number;
      selectedCollateralIds?: string[];
    }
  ): LoanOfferQuote {
    BankLoanEngine.syncCollateralPool(state);
    const cfg = LOAN_TYPE_CATALOG[params.loanType];
    const pc = state.playerCompany;
    const creditScore = BankLoanEngine.computeCreditScore(state);

    const borrowerType: LoanBorrowerType =
      params.loanType === 'COLLATERALIZED_HOLDING'
        ? 'HOLDING'
        : pc
        ? 'COMPANY'
        : 'PLAYER';

    // Serbest (başka kredide rehinli olmayan) teminatlar
    const freeCollaterals = (state.collaterals ?? []).filter(
      (c) => c.pledgedLoanId === null && c.marketValue > 0
    );
    const chosenCollaterals =
      params.selectedCollateralIds && params.selectedCollateralIds.length > 0
        ? freeCollaterals.filter((c) =>
            params.selectedCollateralIds!.includes(c.collateralId)
          )
        : freeCollaterals;

    const totalFreeCollateralCapacity = Number(
      chosenCollaterals
        .reduce((sum, c) => sum + c.marketValue * c.haircutFactor, 0)
        .toFixed(2)
    );

    // Gerçek ödeme kapasitesi: Şirket özkaynağı + son 90 gün operasyonel nakit akışı (değerleme değil!)
    const baseEquity = pc
      ? Math.max(0, pc.financials.shareholdersEquity)
      : Math.max(0, state.cash + state.portfolioValue * 0.6 - state.totalDebt);

    const currentDebt = pc
      ? pc.financials.totalLiabilities + state.totalDebt
      : state.totalDebt;

    const cfHistory = pc?.cashFlowHistory365 ?? [];
    const avgDailyOpCashFlow =
      cfHistory.length > 0
        ? cfHistory.slice(-90).reduce((a, b) => a + b, 0) /
          Math.min(90, cfHistory.length)
        : pc
        ? Math.max(0, pc.dailyEbitda * 0.7)
        : 2_500;

    const sectorRiskPenalty = pc
      ? SECTOR_CONFIGS[pc.sector].baseVolatility * 0.15
      : 0.04;
    const scoreRiskSpread = Math.max(0, (750 - creditScore) * 0.00025);

    const annualInterestRate = Number(
      Math.max(
        0.12,
        state.macro.policyInterestRate * 0.65 +
          cfg.spreadOverPolicyRate +
          sectorRiskPenalty +
          scoreRiskSpread
      ).toFixed(4)
    );

    const termInGameDays = Math.max(
      30,
      Math.min(360, params.customTermDays ?? cfg.defaultTermDays)
    );
    const installmentFrequency = cfg.installmentFrequencyDays;
    const installmentCount = Math.max(
      1,
      Math.floor(termInGameDays / installmentFrequency)
    );

    // Maksimum kredi limiti: Özkaynak borç sınırı ve operasyonel nakit akışı karşılama kapasitesi
    const maxByEquity = Math.max(
      0,
      baseEquity * cfg.maxDebtToEquityMultiple - currentDebt
    );
    const cashFlowServiceCapacity = Math.max(
      150_000,
      avgDailyOpCashFlow * termInGameDays * 1.4
    );

    let maxEligibleAmount = Math.min(
      maxByEquity,
      Math.max(baseEquity * 0.65, cashFlowServiceCapacity)
    );

    if (cfg.requiresCollateral) {
      maxEligibleAmount = Math.min(
        maxEligibleAmount,
        Math.max(totalFreeCollateralCapacity, baseEquity * 0.45)
      );
    }

    if (creditScore < 420) {
      maxEligibleAmount = 0;
    }

    maxEligibleAmount = Number(Math.max(0, maxEligibleAmount).toFixed(2));

    const requestedPrincipal = Number(
      (typeof params.requestedPrincipal === 'number' &&
      params.requestedPrincipal > 0
        ? params.requestedPrincipal
        : Math.min(
            maxEligibleAmount > 0 ? maxEligibleAmount * 0.5 : 250_000,
            1_000_000
          )
      ).toFixed(2)
    );

    const periodRate = annualInterestRate * (installmentFrequency / 365);
    const totalInterestOverTerm = Number(
      (requestedPrincipal * periodRate * installmentCount).toFixed(2)
    );
    const originationFee = Number(
      (requestedPrincipal * cfg.originationFeeRate).toFixed(2)
    );
    const totalRepayment = Number(
      (requestedPrincipal + totalInterestOverTerm + originationFee).toFixed(2)
    );
    const installmentAmount = Number(
      ((requestedPrincipal + totalInterestOverTerm) / installmentCount).toFixed(
        2
      )
    );

    const effectiveInterestRate = Number(
      (
        ((totalInterestOverTerm + originationFee) /
          Math.max(1, requestedPrincipal)) *
        (365 / termInGameDays)
      ).toFixed(4)
    );

    const postLoanDebt = currentDebt + requestedPrincipal;
    const postLoanDebtToEquity = Number(
      (postLoanDebt / Math.max(1, baseEquity)).toFixed(2)
    );
    const dailyInterestAfterLoan =
      (postLoanDebt * annualInterestRate) / 365;
    const postLoanInterestCoverage = Number(
      (
        Math.max(0, avgDailyOpCashFlow) /
        Math.max(1, dailyInterestAfterLoan)
      ).toFixed(2)
    );

    const dailyBurn = pc
      ? Math.max(0, pc.dailyOpex - pc.dailyRevenue) + dailyInterestAfterLoan
      : dailyInterestAfterLoan;
    const totalCashAfterLoan =
      (pc ? pc.financials.cash : state.cash) +
      requestedPrincipal -
      originationFee;
    const estimatedCashRunwayDays =
      dailyBurn > 10
        ? Math.min(999, Math.floor(totalCashAfterLoan / dailyBurn))
        : 999;

    let approved = true;
    let rejectionReason: string | undefined;

    if (!pc && borrowerType === 'COMPANY') {
      approved = false;
      rejectionReason =
        'Kurumsal kredi kullanabilmek için aktif bir oyuncu şirketiniz olmalıdır.';
    } else if (creditScore < 420) {
      approved = false;
      rejectionReason = `Kredi notunuz (${creditScore}) banka asgari eşiğinin (420) altında.`;
    } else if (requestedPrincipal <= 0) {
      approved = false;
      rejectionReason = 'Kredi talep tutarı sıfırdan büyük olmalıdır.';
    } else if (requestedPrincipal > maxEligibleAmount + 1) {
      approved = false;
      rejectionReason = `Talep edilen tutar (${requestedPrincipal.toLocaleString('tr-TR')} TL) ödeme kapasitenize göre hesaplanan maksimum limiti (${maxEligibleAmount.toLocaleString('tr-TR')} TL) aşıyor.`;
    } else if (
      cfg.requiresCollateral &&
      totalFreeCollateralCapacity < requestedPrincipal * 0.5 &&
      chosenCollaterals.length === 0
    ) {
      approved = false;
      rejectionReason =
        'Bu kredi türü için yeterli serbest (rehinli olmayan) teminat varlığı bulunmuyor.';
    }

    const riskLevel: LoanOfferQuote['riskLevel'] =
      postLoanDebtToEquity > 1.6 || creditScore < 500
        ? 'CRITICAL'
        : postLoanDebtToEquity > 1.1 || creditScore < 600
        ? 'HIGH'
        : postLoanDebtToEquity > 0.6
        ? 'MEDIUM'
        : 'LOW';

    return {
      loanType: params.loanType,
      labelTR: cfg.labelTR,
      borrowerType,
      maxEligibleAmount,
      requestedPrincipal,
      approved,
      rejectionReason,
      annualInterestRate,
      effectiveInterestRate,
      termInGameDays,
      installmentFrequency,
      installmentAmount,
      totalRepayment,
      firstPaymentGameDay: state.day + installmentFrequency,
      originationFee,
      earlyPaymentFeeRate: cfg.earlyPaymentFeeRate,
      latePaymentRate: Number((annualInterestRate + cfg.lateSpread).toFixed(4)),
      gracePeriodDays: cfg.gracePeriodDays,
      requiredCollateralValue: cfg.requiresCollateral
        ? Number((requestedPrincipal * 0.7).toFixed(2))
        : 0,
      availableCollateralIds: chosenCollaterals.map((c) => c.collateralId),
      postLoanDebtToEquity,
      postLoanInterestCoverage,
      riskLevel,
      estimatedCashRunwayDays,
      delinquencyConsequencesTR:
        'Taksit gecikmesinde gecikme faizi işler ve kredi notu 45 puan düşer. 3 ardışık gecikmede temerrüt oluşur ve teminat varlıkları borca mahsup edilir.',
      creditScore,
    };
  }

  /**
   * Kredi Sözleşmesi Oluşturur ve Kullandırır:
   * - Kredi ana parası ilgili banka hesabına nakit girişi oluşturur; aynı tutar bilançoya borç yazılır.
   * - Dosya masrafı (`originationFee`) düşülür.
   * - Kredi gelir veya FAVÖK oluşturmaz; net varlığı ana para kadar artırmaz.
   * - Seçilen teminatları kilitler (`pledgedLoanId = loanId`); zaten rehinli bir teminat seçildiyse reddeder.
   */
  public static takeOutBankLoan(
    state: SimulationState,
    params: {
      loanType: BankLoanType;
      principal: number;
      termInGameDays?: number;
      collateralIds?: string[];
      idempotencyKey?: string;
    },
    reservedOrderCash: number
  ): {
    success: boolean;
    message: string;
    loan: LoanContract | null;
  } {
    BankLoanEngine.syncCollateralPool(state);

    // Çift teminat kontrolü (Açık kuralı: Aynı teminat aynı anda iki kredide kullanılamaz)
    if (params.collateralIds && params.collateralIds.length > 0) {
      for (const colId of params.collateralIds) {
        const colItem = (state.collaterals ?? []).find(
          (c) => c.collateralId === colId
        );
        if (!colItem) {
          return {
            success: false,
            message: `Seçilen teminat varlığı (${colId}) mevcut değil veya satılmış.`,
            loan: null,
          };
        }
        if (colItem.pledgedLoanId !== null) {
          return {
            success: false,
            message: `${colItem.label} zaten ${colItem.pledgedLoanId} numaralı kredide teminat olarak rehinli; aynı teminat iki krediye bağlanamaz.`,
            loan: null,
          };
        }
      }
    }

    const quote = BankLoanEngine.computeLoanOfferQuote(state, {
      loanType: params.loanType,
      requestedPrincipal: params.principal,
      customTermDays: params.termInGameDays,
      selectedCollateralIds: params.collateralIds,
    });

    if (!quote.approved) {
      return {
        success: false,
        message: quote.rejectionReason || 'Kredi başvurusu banka tarafından reddedildi.',
        loan: null,
      };
    }

    const nextLoanSeq = (state.loanSequence ?? 0) + 1;
    state.loanSequence = nextLoanSeq;
    const loanId = `LOAN-D${state.day}-S${String(nextLoanSeq).padStart(6, '0')}`;

    const cfg = LOAN_TYPE_CATALOG[params.loanType];
    const pc = state.playerCompany;

    // Teminatları kilitle
    const lockedCollateralIds: string[] = [];
    const targetColIds =
      params.collateralIds && params.collateralIds.length > 0
        ? params.collateralIds
        : cfg.requiresCollateral
        ? quote.availableCollateralIds.slice(0, 1)
        : [];

    for (const colId of targetColIds) {
      const colItem = (state.collaterals ?? []).find(
        (c) => c.collateralId === colId && c.pledgedLoanId === null
      );
      if (colItem) {
        colItem.pledgedLoanId = loanId;
        lockedCollateralIds.push(colItem.collateralId);
      }
    }

    const destAccountId =
      quote.borrowerType === 'COMPANY' && pc
        ? ACCOUNT_IDS.companyBank(pc.ticker)
        : quote.borrowerType === 'HOLDING'
        ? ACCOUNT_IDS.HOLDING_MAIN
        : ACCOUNT_IDS.PLAYER_INVESTMENT;

    const netDisbursement = Number(
      (quote.requestedPrincipal - quote.originationFee).toFixed(2)
    );

    // Merkezi Muhasebe Defterine Kredi Kullandırım Kaydı
    const transferRes = CentralLedgerEngine.executeTransfer(
      state,
      {
        idempotencyKey:
          params.idempotencyKey || `IDEM-LOAN-DISBURSE-${loanId}`,
        sourceAccountId: ACCOUNT_IDS.LOAN_LIABILITY,
        destinationAccountId: destAccountId,
        amount: netDisbursement,
        category: 'LOAN_DISBURSEMENT',
        description: `${quote.labelTR} kullandırımı (${loanId}, Masraf: ${quote.originationFee.toLocaleString('tr-TR')} TL)`,
        relatedCompanyId: pc?.ticker,
        relatedLoanId: loanId,
        allowSystemAccountSource: true,
      },
      reservedOrderCash
    );

    if (!transferRes.success) {
      // Hata durumunda teminat kilidini geri al
      for (const colId of lockedCollateralIds) {
        const c = (state.collaterals ?? []).find(
          (item) => item.collateralId === colId
        );
        if (c) c.pledgedLoanId = null;
      }
      return {
        success: false,
        message: transferRes.message,
        loan: null,
      };
    }

    // Bilanço Yükümlülük Güncellemesi (Nakit +netDisbursement arttı, Borç +principal arttı -> Özkaynak sadece -originationFee değişti!)
    if (quote.borrowerType === 'COMPANY' && pc) {
      if (quote.termInGameDays <= 90) {
        pc.financials.shortTermDebt = Number(
          (pc.financials.shortTermDebt + quote.requestedPrincipal).toFixed(2)
        );
      } else {
        pc.financials.longTermDebt = Number(
          (pc.financials.longTermDebt + quote.requestedPrincipal).toFixed(2)
        );
      }
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
      pc.financials.shareholdersEquity = Number(
        (pc.financials.totalAssets - pc.financials.totalLiabilities).toFixed(2)
      );
      pc.financials.retainedEarnings = Number(
        (
          pc.financials.shareholdersEquity - pc.financials.paidInCapital
        ).toFixed(2)
      );
    } else {
      if (quote.termInGameDays <= 90) {
        state.shortTermDebt = Number(
          (state.shortTermDebt + quote.requestedPrincipal).toFixed(2)
        );
      } else {
        state.longTermDebt = Number(
          (state.longTermDebt + quote.requestedPrincipal).toFixed(2)
        );
      }
      state.totalDebt = Number(
        (state.shortTermDebt + state.longTermDebt).toFixed(2)
      );
    }

    const loanContract: LoanContract = {
      loanId,
      loanType: params.loanType,
      borrowerType: quote.borrowerType,
      borrowerId:
        quote.borrowerType === 'COMPANY' && pc ? pc.ticker : quote.borrowerType,
      principal: quote.requestedPrincipal,
      remainingPrincipal: quote.requestedPrincipal,
      accruedInterestUnpaid: 0,
      annualInterestRate: quote.annualInterestRate,
      effectiveInterestRate: quote.effectiveInterestRate,
      termInGameDays: quote.termInGameDays,
      installmentFrequency: quote.installmentFrequency,
      nextPaymentGameDay: quote.firstPaymentGameDay,
      installmentAmount: quote.installmentAmount,
      collateralIds: lockedCollateralIds,
      originationFee: quote.originationFee,
      earlyPaymentFee: cfg.earlyPaymentFeeRate,
      latePaymentRate: quote.latePaymentRate,
      gracePeriod: quote.gracePeriodDays,
      status: 'ACTIVE',
      missedPaymentCount: 0,
      creditScoreAtOrigination: quote.creditScore,
      purpose: cfg.purposeTR,
      createdGameDay: state.day,
      lastInterestAccruedDay: state.day,
      totalInterestPaid: 0,
      totalPrincipalPaid: 0,
    };

    if (!state.activeLoans) {
      state.activeLoans = [];
    }
    state.activeLoans.unshift(loanContract);
    CentralLedgerEngine.syncLedgerWithState(state, reservedOrderCash);

    return {
      success: true,
      message: `${quote.labelTR} (${loanId}) onaylandı: +${netDisbursement.toLocaleString('tr-TR')} TL net nakit hesaba aktarıldı, ${quote.requestedPrincipal.toLocaleString('tr-TR')} TL kredi borcu bilançoya kaydedildi.`,
      loan: loanContract,
    };
  }

  /**
   * Kredi Taksiti Ödeme (`payLoanInstallment`):
   * - Kapanmış (`PAID_OFF`) krediden tekrar tahsilat yapmaz.
   * - Anapara ve faiz ayrımını yapar; borcu azaltır.
   * - Yetersiz bakiyede gecikme (`DELINQUENT`) oluşturur ve kredi notunu düşürür.
   */
  public static payLoanInstallment(
    state: SimulationState,
    loanId: string,
    reservedOrderCash: number,
    idempotencyKey?: string
  ): {
    success: boolean;
    message: string;
    principalReduced: number;
    interestPaid: number;
  } {
    const loan = (state.activeLoans ?? []).find((l) => l.loanId === loanId);
    if (!loan) {
      return {
        success: false,
        message: `${loanId} numaralı kredi sözleşmesi bulunamadı.`,
        principalReduced: 0,
        interestPaid: 0,
      };
    }

    if (loan.status === 'PAID_OFF') {
      return {
        success: false,
        message: `${loanId} numaralı kredi zaten tamamen kapatılmış; tekrar tahsilat yapılamaz.`,
        principalReduced: 0,
        interestPaid: 0,
      };
    }

    const pc = state.playerCompany;
    const sourceAccountId =
      loan.borrowerType === 'COMPANY' && pc
        ? ACCOUNT_IDS.companyBank(pc.ticker)
        : loan.borrowerType === 'HOLDING'
        ? ACCOUNT_IDS.HOLDING_MAIN
        : ACCOUNT_IDS.PLAYER_INVESTMENT;

    const totalDueNow = Number(
      Math.min(
        loan.remainingPrincipal + loan.accruedInterestUnpaid,
        loan.installmentAmount + loan.accruedInterestUnpaid
      ).toFixed(2)
    );

    if (totalDueNow <= 0) {
      loan.status = 'PAID_OFF';
      BankLoanEngine.releaseLoanCollaterals(state, loan.loanId);
      return {
        success: true,
        message: `${loanId} kredisi kapatıldı.`,
        principalReduced: 0,
        interestPaid: 0,
      };
    }

    const transferRes = CentralLedgerEngine.executeTransfer(
      state,
      {
        idempotencyKey:
          idempotencyKey ||
          `IDEM-INSTALLMENT-${loan.loanId}-D${state.day}-P${loan.totalPrincipalPaid.toFixed(0)}`,
        sourceAccountId,
        destinationAccountId: ACCOUNT_IDS.LOAN_LIABILITY,
        amount: totalDueNow,
        category: 'LOAN_INSTALLMENT_PAYMENT',
        description: `${loan.loanId} kredi taksit ödemesi`,
        relatedCompanyId: pc?.ticker,
        relatedLoanId: loan.loanId,
      },
      reservedOrderCash
    );

    if (!transferRes.success) {
      // Yetersiz bakiye -> Gecikme ve kredi notu düşüşü
      loan.missedPaymentCount += 1;
      loan.status = loan.missedPaymentCount >= 3 ? 'DEFAULTED' : 'DELINQUENT';
      if (loan.status === 'DEFAULTED') {
        BankLoanEngine.enforceDefaultedLoanCollateral(state, loan);
      }
      BankLoanEngine.computeCreditScore(state);
      return {
        success: false,
        message: `${loan.loanId} taksit ödemesi için bakiye yetersiz (${totalDueNow.toLocaleString('tr-TR')} TL). Kredi durumu: ${loan.status}.`,
        principalReduced: 0,
        interestPaid: 0,
      };
    }

    const interestPortion = Number(
      Math.min(
        totalDueNow,
        loan.accruedInterestUnpaid > 0
          ? loan.accruedInterestUnpaid
          : loan.remainingPrincipal *
              loan.annualInterestRate *
              (loan.installmentFrequency / 365)
      ).toFixed(2)
    );
    const principalPortion = Number(
      Math.min(loan.remainingPrincipal, totalDueNow - interestPortion).toFixed(
        2
      )
    );

    loan.accruedInterestUnpaid = Number(
      Math.max(0, loan.accruedInterestUnpaid - interestPortion).toFixed(2)
    );
    loan.remainingPrincipal = Number(
      Math.max(0, loan.remainingPrincipal - principalPortion).toFixed(2)
    );
    loan.totalInterestPaid = Number(
      (loan.totalInterestPaid + interestPortion).toFixed(2)
    );
    loan.totalPrincipalPaid = Number(
      (loan.totalPrincipalPaid + principalPortion).toFixed(2)
    );
    loan.nextPaymentGameDay = state.day + loan.installmentFrequency;

    // Bilançodan anapara borcunu düş, faiz kısmını geçmiş yıl kârlarından düş
    BankLoanEngine.reduceBalanceSheetDebt(
      state,
      loan.borrowerType,
      principalPortion,
      interestPortion
    );

    if (loan.remainingPrincipal <= 0.5) {
      loan.remainingPrincipal = 0;
      loan.accruedInterestUnpaid = 0;
      loan.status = 'PAID_OFF';
      BankLoanEngine.releaseLoanCollaterals(state, loan.loanId);
    } else {
      loan.status = 'ACTIVE';
    }

    BankLoanEngine.computeCreditScore(state);
    CentralLedgerEngine.syncLedgerWithState(state, reservedOrderCash);

    return {
      success: true,
      message: `${loan.loanId} taksiti ödendi (Anapara: ${principalPortion.toLocaleString('tr-TR')} TL, Faiz: ${interestPortion.toLocaleString('tr-TR')} TL). Kalan Anapara: ${loan.remainingPrincipal.toLocaleString('tr-TR')} TL.`,
      principalReduced: principalPortion,
      interestPaid: interestPortion,
    };
  }

  /**
   * Krediyi Erken Kapatma (`payOffLoanEarly`):
   * - Kalan anapara + tahakkuk etmiş faiz + erken kapama komisyonu (`earlyPaymentFee`) tahsil edilir.
   * - Teminatlar serbest bırakılır ve kredi `PAID_OFF` olur.
   */
  public static payOffLoanEarly(
    state: SimulationState,
    loanId: string,
    reservedOrderCash: number,
    idempotencyKey?: string
  ): {
    success: boolean;
    message: string;
    totalPaid: number;
    earlyFeePaid: number;
  } {
    const loan = (state.activeLoans ?? []).find((l) => l.loanId === loanId);
    if (!loan) {
      return {
        success: false,
        message: `${loanId} numaralı kredi bulunamadı.`,
        totalPaid: 0,
        earlyFeePaid: 0,
      };
    }

    if (loan.status === 'PAID_OFF') {
      return {
        success: false,
        message: `${loanId} kredisi zaten kapatılmış.`,
        totalPaid: 0,
        earlyFeePaid: 0,
      };
    }

    const pc = state.playerCompany;
    const sourceAccountId =
      loan.borrowerType === 'COMPANY' && pc
        ? ACCOUNT_IDS.companyBank(pc.ticker)
        : loan.borrowerType === 'HOLDING'
        ? ACCOUNT_IDS.HOLDING_MAIN
        : ACCOUNT_IDS.PLAYER_INVESTMENT;

    const earlyFeePaid = Number(
      (loan.remainingPrincipal * loan.earlyPaymentFee).toFixed(2)
    );
    const totalPayoffAmount = Number(
      (
        loan.remainingPrincipal +
        loan.accruedInterestUnpaid +
        earlyFeePaid
      ).toFixed(2)
    );

    const transferRes = CentralLedgerEngine.executeTransfer(
      state,
      {
        idempotencyKey:
          idempotencyKey || `IDEM-EARLY-PAYOFF-${loan.loanId}-D${state.day}`,
        sourceAccountId,
        destinationAccountId: ACCOUNT_IDS.LOAN_LIABILITY,
        amount: totalPayoffAmount,
        category: 'LOAN_EARLY_PAYOFF',
        description: `${loan.loanId} erken kredi kapama (Erken kapama ücreti: ${earlyFeePaid.toLocaleString('tr-TR')} TL)`,
        relatedCompanyId: pc?.ticker,
        relatedLoanId: loan.loanId,
      },
      reservedOrderCash
    );

    if (!transferRes.success) {
      return {
        success: false,
        message: transferRes.message,
        totalPaid: 0,
        earlyFeePaid: 0,
      };
    }

    const principalCleared = loan.remainingPrincipal;
    const interestAndFee = Number(
      (loan.accruedInterestUnpaid + earlyFeePaid).toFixed(2)
    );

    loan.totalPrincipalPaid = Number(
      (loan.totalPrincipalPaid + principalCleared).toFixed(2)
    );
    loan.totalInterestPaid = Number(
      (loan.totalInterestPaid + interestAndFee).toFixed(2)
    );
    loan.remainingPrincipal = 0;
    loan.accruedInterestUnpaid = 0;
    loan.status = 'PAID_OFF';

    BankLoanEngine.reduceBalanceSheetDebt(
      state,
      loan.borrowerType,
      principalCleared,
      interestAndFee
    );
    BankLoanEngine.releaseLoanCollaterals(state, loan.loanId);
    BankLoanEngine.computeCreditScore(state);
    CentralLedgerEngine.syncLedgerWithState(state, reservedOrderCash);

    return {
      success: true,
      message: `${loan.loanId} kredisi ${totalPayoffAmount.toLocaleString('tr-TR')} TL ödenerek erken kapatıldı ve teminatlar serbest bırakıldı.`,
      totalPaid: totalPayoffAmount,
      earlyFeePaid,
    };
  }

  /**
   * Gün Sonu Faiz Tahakkuku ve Vadesi Gelen Taksitlerin İşlenmesi:
   * - Aynı oyun günü içinde faiz YALNIZCA BİR KEZ tahakkuk eder (`lastInterestAccruedDay === state.day`).
   */
  public static stepDailyLoansAndInterest(
    state: SimulationState,
    reservedOrderCash: number
  ): {
    totalInterestAccruedToday: number;
    installmentsPaidCount: number;
    delinquentLoansCount: number;
  } {
    CentralLedgerEngine.syncLedgerWithState(state, reservedOrderCash);
    const ledger = state.centralLedger!;
    let totalInterestAccruedToday = 0;
    let installmentsPaidCount = 0;
    let delinquentLoansCount = 0;

    for (const loan of state.activeLoans ?? []) {
      if (loan.status === 'PAID_OFF') continue;

      const interestKey = `${loan.loanId}-D${state.day}`;
      if (
        loan.lastInterestAccruedDay < state.day &&
        !ledger.chargedInterestKeys.includes(interestKey)
      ) {
        const activeRate =
          loan.status === 'DELINQUENT' || loan.status === 'DEFAULTED'
            ? loan.latePaymentRate
            : loan.annualInterestRate;
        const dailyInterest = Number(
          ((loan.remainingPrincipal * activeRate) / 365).toFixed(2)
        );

        if (dailyInterest > 0) {
          loan.accruedInterestUnpaid = Number(
            (loan.accruedInterestUnpaid + dailyInterest).toFixed(2)
          );
          totalInterestAccruedToday = Number(
            (totalInterestAccruedToday + dailyInterest).toFixed(2)
          );
        }
        loan.lastInterestAccruedDay = state.day;
        ledger.chargedInterestKeys.push(interestKey);
        if (ledger.chargedInterestKeys.length > 500) {
          ledger.chargedInterestKeys.shift();
        }
      }

      // Vadesi gelen taksit kontrolü
      if (state.day >= loan.nextPaymentGameDay) {
        const payRes = BankLoanEngine.payLoanInstallment(
          state,
          loan.loanId,
          reservedOrderCash,
          `AUTO-INST-${loan.loanId}-D${state.day}`
        );
        if (payRes.success) {
          installmentsPaidCount += 1;
        } else {
          delinquentLoansCount += 1;
          loan.nextPaymentGameDay = state.day + Math.max(5, loan.gracePeriod);
        }
      }
    }

    return {
      totalInterestAccruedToday,
      installmentsPaidCount,
      delinquentLoansCount,
    };
  }

  private static reduceBalanceSheetDebt(
    state: SimulationState,
    borrowerType: LoanBorrowerType,
    principalPortion: number,
    interestPortion: number
  ): void {
    const pc = state.playerCompany;
    if (borrowerType === 'COMPANY' && pc) {
      let remPrin = principalPortion;
      const fromShort = Math.min(pc.financials.shortTermDebt, remPrin);
      pc.financials.shortTermDebt = Number(
        (pc.financials.shortTermDebt - fromShort).toFixed(2)
      );
      remPrin = Number((remPrin - fromShort).toFixed(2));
      if (remPrin > 0) {
        pc.financials.longTermDebt = Number(
          Math.max(0, pc.financials.longTermDebt - remPrin).toFixed(2)
        );
      }
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
      pc.financials.shareholdersEquity = Number(
        (pc.financials.totalAssets - pc.financials.totalLiabilities).toFixed(2)
      );
      pc.financials.retainedEarnings = Number(
        (
          pc.financials.shareholdersEquity - pc.financials.paidInCapital
        ).toFixed(2)
      );
    } else {
      let remPrin = principalPortion;
      const fromShort = Math.min(state.shortTermDebt, remPrin);
      state.shortTermDebt = Number((state.shortTermDebt - fromShort).toFixed(2));
      remPrin = Number((remPrin - fromShort).toFixed(2));
      if (remPrin > 0) {
        state.longTermDebt = Number(
          Math.max(0, state.longTermDebt - remPrin).toFixed(2)
        );
      }
      state.totalDebt = Number(
        (state.shortTermDebt + state.longTermDebt).toFixed(2)
      );
      void interestPortion;
    }
  }

  private static releaseLoanCollaterals(
    state: SimulationState,
    loanId: string
  ): void {
    for (const col of state.collaterals ?? []) {
      if (col.pledgedLoanId === loanId) {
        col.pledgedLoanId = null;
      }
    }
  }

  private static enforceDefaultedLoanCollateral(
    state: SimulationState,
    loan: LoanContract
  ): void {
    const pc = state.playerCompany;
    if (pc && loan.borrowerType === 'COMPANY') {
      pc.defaultedLoanCount = (pc.defaultedLoanCount ?? 0) + 1;
      const writeDown = Math.min(
        pc.financials.fixedAssets * 0.35,
        loan.remainingPrincipal
      );
      if (writeDown > 0) {
        pc.financials.fixedAssets = Number(
          Math.max(10_000, pc.financials.fixedAssets - writeDown).toFixed(2)
        );
        loan.remainingPrincipal = Number(
          Math.max(0, loan.remainingPrincipal - writeDown).toFixed(2)
        );
        BankLoanEngine.reduceBalanceSheetDebt(
          state,
          'COMPANY',
          writeDown,
          0
        );
      }
    }
    BankLoanEngine.releaseLoanCollaterals(state, loan.loanId);
  }
}
