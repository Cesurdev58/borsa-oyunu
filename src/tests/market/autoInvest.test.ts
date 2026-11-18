import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { AUTO_INVEST_HIRE_FEE } from '../../data/gameBalance';

test('Portföy yöneticisi: ücretle işe alınır, gün sonunda kenardaki paranın fazlasını eşit sepete yatırır', () => {
  const eng = new SimulationEngine(20261104, 1_000_000);
  assert.equal(eng.configureAutoInvest({ enabled: true }).success, false, 'işe almadan ayarlanamaz');
  const cash0 = eng.getState().cash;
  assert.equal(eng.hirePortfolioManager().success, true);
  assert.equal(eng.getState().cash, cash0 - AUTO_INVEST_HIRE_FEE);
  assert.equal(eng.hirePortfolioManager().success, false, 'iki kez tutulmaz');
  eng.configureAutoInvest({ reserve: 200_000 });
  eng.advanceDaysWithoutPlayerDecisions(1, true);
  const st = eng.getState();
  const held = Object.values(st.portfolio).filter((p) => p.shares > 0).length;
  assert.ok(held >= st.stocks.length - 1, `sepet dağıtılmalı (${held})`);
  assert.ok(eng.getSpendableCash() >= 190_000 && eng.getSpendableCash() < 260_000, `kenarda ~200 bin kalmalı: ${eng.getSpendableCash()}`);
  // Kapatılınca yatırım yapmaz; kayıtta kalır
  eng.configureAutoInvest({ enabled: false });
  const back = SimulationEngine.deserializeState(eng.serializeState());
  assert.equal(back.getState().autoInvest?.enabled, false);
  assert.equal(back.getState().autoInvest?.reserve, 200_000);
});
