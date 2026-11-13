/**
 * Şirket aşaması ölçüm robotu: "hep büyüyen" açgözlü oyuncuyu taklit eder.
 * Her gün: devam eden yatırım yoksa güvenli bütçeyle en büyük kapasite yatırımını başlatır,
 * kapasiteye yetecek kadar personel tutar. Denge ölçümü ve testler aynı robotu kullanır.
 */
import type { SimulationEngine } from '../../engine/SimulationEngine';

export function growCompanyGreedy(eng: SimulationEngine): void {
  const pc = eng.getState().playerCompany;
  if (!pc || pc.isBankrupt) return;
  const busy = (pc.investmentProjects ?? []).some(
    (p) => p.status === 'IN_PROGRESS'
  );
  // Akıllı oyuncu: pazar dolduysa (kapasitenin çoğu satılmıyor) fabrika büyütmeyi bırakır
  const saturated = pc.operations?.marketSaturated === true;
  if (!busy && !saturated) {
    const q = eng.getInvestmentProjectQuote({ packageType: 'BUDGET_MAX', budgetMaxMode: true });
    // Kasa tamponundan sonra en az %10 büyüme yapılabiliyorsa yatır
    if (q && q.affordable && q.capacityGainUnits >= Math.max(5, pc.productionCapacity * 0.1)) {
      eng.startCompanyInvestmentProject({ packageType: 'BUDGET_MAX', budgetMaxMode: true });
    }
  }
  // Satılabilecek kadar üret: pazar doluysa fazla personel tutma
  const sellable = Math.max(
    pc.operations?.potentialSalesUnits ?? pc.productionCapacity,
    pc.operations?.actualSalesUnits ?? 0
  );
  const targetUnits = Math.min(pc.productionCapacity, Math.ceil(sellable * 1.1));
  const neededStaff = Math.max(5, Math.ceil(targetUnits / 2.3));
  if (Math.abs(neededStaff - pc.staffCount) > Math.max(3, pc.staffCount * 0.05)) {
    eng.configureCompanyOperations({ targetStaffCount: neededStaff });
  }
}

/**
 * Holding robotu: pazar dolduğunda şirket kârını temettüyle çeker ve aynı sektördeki en ucuz rakibi devralmaya çalışır.
 * Döndürdüğü metin, o gün gerçekleşen devralmayı anlatır (yoksa null).
 */
export function expandByTakeover(eng: SimulationEngine): string | null {
  const st = eng.getState();
  const pc = st.playerCompany;
  if (!pc || !pc.operations?.marketSaturated) return null;
  const bankId = `ACC-COMPANY-BANK-${pc.ticker.toUpperCase()}`;
  const safe = eng.getMaxSafeTransferAmount(bankId as never).maxSafeTransferable;
  const dividend = Math.min(safe * 0.8, Math.max(0, pc.financials.retainedEarnings));
  if (dividend > 1_000_000) {
    eng.executeMoneyTransfer({
      sourceAccountId: bankId as never,
      destinationAccountId: 'ACC-PLAYER-INVESTMENT' as never,
      amount: Math.floor(dividend),
      category: 'LEGAL_DIVIDEND',
      description: 'Bot temettü',
    });
  }
  const rivals = st.stocks
    .filter((s) => !s.isPlayerCompany && !s.isControlledByPlayer && s.sector === pc.sector)
    .sort((a, b) => a.equityValue - b.equityValue);
  for (const r of rivals) {
    if (eng.getSpendableCash() < r.equityValue * 0.75) continue;
    const res = eng.executeHostileTakeover(r.ticker, { targetOwnershipPct: 51, useDebtFinancing: false });
    if (res.success) return `${r.ticker} devralındı (₺${Math.round(res.totalTenderCost).toLocaleString('tr-TR')})`;
  }
  return null;
}
