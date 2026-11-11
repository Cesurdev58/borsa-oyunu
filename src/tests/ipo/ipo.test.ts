import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';

test('IPO uygunluk koşulları sağlanmadan halka arz yapılamaz; koşullar sağlandığında para ve payları doğru dağıtır ve şirket değerini iki kez saymaz', () => {
  const engine = new SimulationEngine(20261104, 3_000_000);
  engine.establishCompany(
    'Boğaziçi Biyoteknoloji A.Ş.',
    'BGBI',
    'BIYOTEKNOLOJI',
    1_200_000,
    {
      initialStaffCount: 45,
      initialCapacity: 60,
      initialRdBudget: 25_000,
    }
  );

  // Henüz 0. faaliyet gününde olduğu için IPO reddedilmeli
  const earlyIpo = engine.executeIPO(0.3, 0.12, 0.35);
  assert.equal(earlyIpo.success, false);

  // 8 gün operasyon çalıştırarak asgari faaliyet süresi ve ciro şartlarını sağla
  for (let i = 0; i < 8; i++) {
    engine.tickDay();
  }

  const eligibility = engine.checkIPOEligibility();
  assert.equal(eligibility.eligible, true);

  // Farklı iskonto oranlarının farklı talep çarpanı ürettiğini doğrula (sabit 4.25x değil)
  const cloneLowDiscount = SimulationEngine.deserializeState(
    engine.serializeState()
  );
  const cloneHighDiscount = SimulationEngine.deserializeState(
    engine.serializeState()
  );

  const ipoLow = cloneLowDiscount.executeIPO(0.3, 0.02, 0.35);
  const ipoHigh = cloneHighDiscount.executeIPO(0.3, 0.22, 0.35);
  assert.equal(ipoLow.success, true);
  assert.equal(ipoHigh.success, true);
  assert.ok(
    ipoHigh.oversubscriptionMultiple > ipoLow.oversubscriptionMultiple,
    'Yüksek iskonto daha yüksek kurumsal ve bireysel talep üretmelidir'
  );

  // Ana motorda IPO çalıştır ve çift sayım (double-counting) olmadığını doğrula
  const ipoRes = engine.executeIPO(0.3, 0.12, 0.4);
  assert.equal(ipoRes.success, true);

  const postIpoState = engine.getState();
  assert.equal(postIpoState.playerCompany?.isPubliclyListed, true);
  // Şirket halka arz edildikten sonra playerFinancials.playerCompanyEquityValue 0 olmalı
  // çünkü oyuncunun kalan hisseleri artık borsa portföyünde (portfolioMarketValue) sayılır!
  assert.equal(postIpoState.playerFinancials.playerCompanyEquityValue, 0);
  assert.ok(postIpoState.portfolio['BGBI'].shares > 0);
  assert.equal(postIpoState.lastIntegrityAudit.valid, true);
});
