/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BANKA bina paneli (BuildingDetailSheet.tsx dosyasından ayrıldı).
 */

import React, {
  useState,
} from 'react';

import {
  AccountId,
  BankLoanType,
  TransactionCategory,
} from '../../../models/finance';
import {
  ACCOUNT_IDS,
  CentralLedgerEngine,
  TRANSFER_CATEGORY_LABELS_TR,
} from '../../../engine/CentralLedgerEngine';
import {
  BankLoanEngine,
  LOAN_TYPE_CATALOG,
} from '../../../engine/BankLoanEngine';
import type {
  BuildingDetailContentProps,
} from './buildingTypes';

export const BankaPanel: React.FC<BuildingDetailContentProps> = ({
  state,
  onTransferCapital,
  onExecuteMoneyTransfer,
  onTakeOutBankLoan,
  onPayLoanInstallment,
  onPayOffLoanEarly,
  spendableCash,
  reservedCash,
  formatCurrency,
}) => {
  const [bankTab, setBankTab] = useState<'TRANSFER' | 'LOANS' | 'LEDGER'>('TRANSFER');
  const [xferSource, setXferSource] = useState<AccountId>(
    ACCOUNT_IDS.PLAYER_INVESTMENT
  );
  const [xferDest, setXferDest] = useState<AccountId>(
    ACCOUNT_IDS.PLAYER_PERSONAL
  );
  const [xferCategory, setXferCategory] = useState<TransactionCategory>(
    'INVESTMENT_TO_PERSONAL'
  );
  const [xferAmount, setXferAmount] = useState<number>(25_000);
  const [xferDesc, setXferDesc] = useState<string>(
    'Finans Merkezi hesaplar arası transfer'
  );

  // Banka Kredi Masası state
  const [selectedLoanType, setSelectedLoanType] =
    useState<BankLoanType>('WORKING_CAPITAL');
  const [loanPrincipalInput, setLoanPrincipalInput] =
    useState<number>(250_000);
  const [loanTermDaysInput, setLoanTermDaysInput] = useState<number>(90);

  // Şirket Operasyon, Fiyat, Yatırım state

  const pc = state.playerCompany;
  const ledgerAccounts = state.centralLedger
    ? Object.values(state.centralLedger.accounts).filter(
        (a) =>
          a.ownerType === 'PLAYER' ||
          a.ownerType === 'COMPANY' ||
          a.ownerType === 'HOLDING'
      )
    : [];

  const safeMaxInfo = CentralLedgerEngine.computeMaxSafeTransferAmount(
    state,
    xferSource,
    reservedCash
  );
  const estTaxRate =
    xferCategory === 'LEGAL_DIVIDEND'
      ? 0.1
      : xferCategory === 'EXECUTIVE_SALARY' || xferCategory === 'BOARD_FEE'
      ? 0.15
      : xferCategory === 'CAPITAL_REDUCTION'
      ? 0.05
      : 0;
  const estTaxAmount = Number((xferAmount * estTaxRate).toFixed(2));
  const estNetAmount = Number((xferAmount - estTaxAmount).toFixed(2));

  const loanQuote = BankLoanEngine.computeLoanOfferQuote(state, {
    loanType: selectedLoanType,
    requestedPrincipal: loanPrincipalInput,
    customTermDays: loanTermDaysInput,
  });

  const activeLoansList = (state.activeLoans ?? []).filter(
    (l) => l.status !== 'PAID_OFF'
  );

  return (
    <div className="space-y-4 text-xs" data-testid="sheet-content-BANKA">
      {/* Hesap Bakiyeleri Üst Özeti */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums tabular-nums">
        <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
          <div className="text-[13px] text-emerald-800 font-sans font-semibold">
            Yatırım Hesabı (Serbest)
          </div>
          <div className="text-sm font-bold text-emerald-950 mt-0.5">
            {formatCurrency(spendableCash)}
          </div>
          <div className="text-[13px] text-amber-700 mt-0.5">
            Bloke: {formatCurrency(reservedCash)}
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-sky-50/70 border border-sky-200">
          <div className="text-[13px] text-sky-800 font-sans font-semibold">
            Kişisel Nakit Hesabı
          </div>
          <div className="text-sm font-bold text-sky-950 mt-0.5">
            {formatCurrency(state.personalCash || 0)}
          </div>
          <div className="text-[13px] text-slate-500 mt-0.5">
            Holding: {formatCurrency(state.holdingCash || 0)}
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-teal-50/70 border border-teal-200">
          <div className="text-[13px] text-teal-800 font-sans font-semibold">
            Şirket Banka + Kasa
          </div>
          <div className="text-sm font-bold text-teal-950 mt-0.5">
            {formatCurrency(pc ? pc.financials.cash : 0)}
          </div>
          <div className="text-[13px] text-slate-500 mt-0.5">
            {pc ? pc.ticker : 'Şirket Yok'}
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-rose-50/70 border border-rose-200">
          <div className="text-[13px] text-rose-800 font-sans font-semibold">
            Toplam Borç & Kredi Notu
          </div>
          <div className="text-sm font-bold text-rose-950 mt-0.5">
            {formatCurrency(
              state.totalDebt + (pc ? pc.financials.totalLiabilities : 0)
            )}
          </div>
          <div className="text-[13px] text-slate-700 mt-0.5">
            Kredi Notu: <strong>{loanQuote.creditScore}</strong> / 900
          </div>
        </div>
      </div>

      {/* Finans Merkezi Alt Sekmeleri */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
        {(
          [
            { id: 'TRANSFER', label: 'Finans Merkezi (Para Transferi)' },
            {
              id: 'LOANS',
              label: `Banka Kredileri (${activeLoansList.length} Aktif)`,
            },
            { id: 'LEDGER', label: 'Hesaplar & Makro Faiz' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`bank-tab-${t.id}`}
            onClick={() => setBankTab(t.id)}
            className={`flex-1 min-h-[38px] px-2.5 py-1 rounded-xl text-[13px] font-bold transition-colors ${
              bankTab === t.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. PARA TRANSFERİ EKRANI (Aşama 3) */}
      {bankTab === 'TRANSFER' && (
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">
              Çift Kayıtlı Para Transfer Merkezi
            </h3>
            <span className="text-[13px] tabular-nums text-emerald-700">
              Güvenli Maks: {formatCurrency(safeMaxInfo.maxSafeTransferable)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                Kaynak Hesap
              </label>
              <select
                data-testid="xfer-source-select"
                value={xferSource}
                onChange={(e) => setXferSource(e.target.value)}
                className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-semibold"
              >
                {ledgerAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                Hedef Hesap
              </label>
              <select
                data-testid="xfer-dest-select"
                value={xferDest}
                onChange={(e) => setXferDest(e.target.value)}
                className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-semibold"
              >
                {ledgerAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                İşlem Kategorisi (Hukuki & Muhasebe Nedeni)
              </label>
              <select
                data-testid="xfer-category-select"
                value={xferCategory}
                onChange={(e) =>
                  setXferCategory(e.target.value as TransactionCategory)
                }
                className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900"
              >
                {(
                  Object.keys(
                    TRANSFER_CATEGORY_LABELS_TR
                  ) as TransactionCategory[]
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {TRANSFER_CATEGORY_LABELS_TR[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                Transfer Tutarı (TL)
              </label>
              <input
                data-testid="xfer-amount-input"
                type="number"
                min={100}
                step={5_000}
                value={xferAmount}
                onChange={(e) =>
                  setXferAmount(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 border border-slate-300 tabular-nums text-slate-900"
              />
            </div>
          </div>

          {/* Hızlı Tutar Yüzde Butonları (%10, %25, %50, %75, Maksimum) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] text-slate-500 mr-1">
              Güvenli Oran:
            </span>
            {[
              { label: '%10', ratio: 0.1 },
              { label: '%25', ratio: 0.25 },
              { label: '%50', ratio: 0.5 },
              { label: '%75', ratio: 0.75 },
              { label: 'Maksimum', ratio: 1.0 },
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={() =>
                  setXferAmount(
                    Math.max(
                      0,
                      Math.floor(safeMaxInfo.maxSafeTransferable * btn.ratio)
                    )
                  )
                }
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 tabular-nums text-[13px] font-semibold"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Vergi, Tampon ve İşlem Sonrası Bakiye Önizlemesi */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums text-[13px]">
            <div>
              <div className="text-slate-500">Kaynak Ham Bakiye</div>
              <div className="font-bold text-slate-900">
                {formatCurrency(safeMaxInfo.rawBalance)}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Korunan Tampon/Bloke</div>
              <div className="font-bold text-amber-800">
                {formatCurrency(
                  safeMaxInfo.reservedAmount +
                    safeMaxInfo.minWorkingCapitalBuffer +
                    safeMaxInfo.upcomingLoanInstallment
                )}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Vergi / Stopaj Kesintisi</div>
              <div className="font-bold text-rose-700">
                {formatCurrency(estTaxAmount)} (%{(estTaxRate * 100).toFixed(0)})
              </div>
            </div>
            <div>
              <div className="text-slate-500">Hedefe Geçecek Net</div>
              <div className="font-bold text-emerald-700">
                {formatCurrency(estNetAmount)}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="execute-money-transfer-btn"
            onClick={() => {
              if (onExecuteMoneyTransfer) {
                onExecuteMoneyTransfer({
                  sourceAccountId: xferSource,
                  destinationAccountId: xferDest,
                  amount: xferAmount,
                  category: xferCategory,
                  description: xferDesc,
                });
              } else if (
                xferCategory === 'CAPITAL_INCREASE' &&
                pc
              ) {
                onTransferCapital(xferAmount);
              }
            }}
            className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          >
            Transferi Onayla ({formatCurrency(xferAmount)})
          </button>
        </div>
      )}

      {/* 2. BANKA VE KREDİ MASASI EKRANI (Aşama 7) */}
      {bankTab === 'LOANS' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                Kurumsal & Yatırım Kredisi Başvurusu
              </h3>
              <span
                className={`px-2 py-0.5 rounded tabular-nums font-bold text-[13px] ${
                  loanQuote.approved
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {loanQuote.approved ? 'ONAYLANABİLİR' : 'LİMİT / KOŞUL DIŞI'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                  Kredi Türü (6 Ürün)
                </label>
                <select
                  data-testid="loan-type-select"
                  value={selectedLoanType}
                  onChange={(e) =>
                    setSelectedLoanType(e.target.value as BankLoanType)
                  }
                  className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-semibold"
                >
                  {(Object.keys(LOAN_TYPE_CATALOG) as BankLoanType[]).map(
                    (lt) => (
                      <option key={lt} value={lt}>
                        {LOAN_TYPE_CATALOG[lt].labelTR}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                  Talep Edilen Anapara (Maks:{' '}
                  {formatCurrency(loanQuote.maxEligibleAmount)})
                </label>
                <input
                  data-testid="loan-principal-input"
                  type="number"
                  min={25_000}
                  step={25_000}
                  value={loanPrincipalInput}
                  onChange={(e) =>
                    setLoanPrincipalInput(
                      Math.max(10_000, Number(e.target.value) || 10_000)
                    )
                  }
                  className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 border border-slate-300 tabular-nums text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                  Vade (Oyun Günü)
                </label>
                <select
                  value={loanTermDaysInput}
                  onChange={(e) =>
                    setLoanTermDaysInput(Number(e.target.value))
                  }
                  className="w-full min-h-[42px] px-2.5 rounded-xl bg-slate-50 border border-slate-300 tabular-nums text-slate-900"
                >
                  {[60, 90, 120, 180, 360].map((d) => (
                    <option key={d} value={d}>
                      {d} İş Günü
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums text-[13px]">
              <div>
                <div className="text-slate-500">Yıllık / Efektif Faiz</div>
                <div className="font-bold text-slate-900">
                  %{(loanQuote.annualInterestRate * 100).toFixed(1)} / %
                  {(loanQuote.effectiveInterestRate * 100).toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">
                  Taksit ({loanQuote.installmentFrequency} günde bir)
                </div>
                <div className="font-bold text-slate-900">
                  {formatCurrency(loanQuote.installmentAmount)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">
                  Toplam Geri Ödeme & Masraf
                </div>
                <div className="font-bold text-rose-800">
                  {formatCurrency(loanQuote.totalRepayment)} (Masraf:{' '}
                  {formatCurrency(loanQuote.originationFee)})
                </div>
              </div>
              <div>
                <div className="text-slate-500">
                  Borç/Özkaynak & Risk
                </div>
                <div className="font-bold text-indigo-900">
                  {loanQuote.postLoanDebtToEquity}x · {loanQuote.riskLevel}
                </div>
              </div>
            </div>

            {!loanQuote.approved && loanQuote.rejectionReason && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[13px]">
                {loanQuote.rejectionReason}
              </div>
            )}

            <button
              type="button"
              data-testid="take-out-loan-btn"
              disabled={!loanQuote.approved}
              onClick={() => {
                if (onTakeOutBankLoan) {
                  onTakeOutBankLoan({
                    loanType: selectedLoanType,
                    principal: loanPrincipalInput,
                    termInGameDays: loanTermDaysInput,
                  });
                }
              }}
              className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs"
            >
              Kredi Sözleşmesini Onayla ve Nakdi Hesaba Aktar (
              {formatCurrency(loanPrincipalInput)})
            </button>
          </div>

          {/* Aktif Krediler ve Ödeme Yönetimi */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900">
              Aktif Banka Kredi Sözleşmeleri ({activeLoansList.length})
            </h4>
            {activeLoansList.length === 0 ? (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-center">
                Aktif banka krediniz bulunmuyor.
              </div>
            ) : (
              activeLoansList.map((loan) => (
                <div
                  key={loan.loanId}
                  data-testid={`active-loan-row-${loan.loanId}`}
                  className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="tabular-nums font-bold text-slate-900">
                        {loan.loanId}
                      </span>{' '}
                      <span className="text-slate-600">
                        · {LOAN_TYPE_CATALOG[loan.loanType].labelTR}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded tabular-nums font-bold text-[13px] ${
                        loan.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {loan.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums text-[13px]">
                    <div>
                      <span className="text-slate-500">Kalan Anapara:</span>{' '}
                      <strong>{formatCurrency(loan.remainingPrincipal)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Biriken Faiz:</span>{' '}
                      <strong>
                        {formatCurrency(loan.accruedInterestUnpaid)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Taksit Tutarı:</span>{' '}
                      <strong>{formatCurrency(loan.installmentAmount)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Sıradaki Ödeme:</span>{' '}
                      <strong>Gün {loan.nextPaymentGameDay}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        onPayLoanInstallment &&
                        onPayLoanInstallment(loan.loanId)
                      }
                      className="flex-1 min-h-[38px] px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[13px]"
                    >
                      Taksit Öde ({formatCurrency(loan.installmentAmount)})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onPayOffLoanEarly && onPayOffLoanEarly(loan.loanId)
                      }
                      className="flex-1 min-h-[38px] px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[13px]"
                    >
                      Erken Kapat (Teminatı Çöz)
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. HESAPLAR VE MAKRO GÖSTERGELER */}
      {bankTab === 'LEDGER' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900">
              Makroekonomik Gösterge Paneli
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums">
              <div>
                <span className="text-slate-500 text-[13px]">
                  Politika Faizi
                </span>
                <div className="font-bold text-slate-900">
                  %{(state.macro.policyInterestRate * 100).toFixed(1)}
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-[13px]">
                  Yıllık Enflasyon
                </span>
                <div className="font-bold text-slate-900">
                  %{(state.macro.inflationRate * 100).toFixed(1)}
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-[13px]">GSYH Büyüme</span>
                <div className="font-bold text-emerald-700">
                  %{(state.macro.gdpGrowthRate * 100).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-[13px]">Konjonktür</span>
                <div className="font-bold text-indigo-700">
                  {state.macro.cyclePhase}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900">
              Merkezi Muhasebe Hesap Bakiyeleri ({ledgerAccounts.length})
            </h4>
            {ledgerAccounts.map((acc) => (
              <div
                key={acc.id}
                className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between tabular-nums text-[13px]"
              >
                <div>
                  <div className="font-bold text-slate-900 font-sans">
                    {acc.name}
                  </div>
                  <div className="text-[13px] text-slate-500">
                    {acc.id} · {acc.ownerType}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">
                    {formatCurrency(acc.balance)}
                  </div>
                  {acc.reservedBalance > 0 && (
                    <div className="text-[13px] text-amber-700">
                      Bloke: {formatCurrency(acc.reservedBalance)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
