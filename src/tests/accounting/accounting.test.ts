import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SimulationEngine,
  AccountingEngine,
} from '../../engine/SimulationEngine';

test('Muhasebe eşitliği (Varlıklar === Yükümlülükler + Özkaynaklar) her 16 NPC şirketi ve oyuncu şirketi için korunur', () => {
  // Test fixture: 2.500.000 TL başlangıç sermayesi ile şirket kurulumu ve muhasebe invariant testi
  const engine = new SimulationEngine(20261104, 2_500_000);
  const foundRes = engine.establishCompany(
    'Anadolu İleri Teknoloji A.Ş.',
    'ANTK',
    'TEKNOLOJI',
    800_000
  );
  assert.equal(foundRes.success, true);

  for (let i = 0; i < 45; i++) {
    engine.tickDay();
    const audit = AccountingEngine.auditSimulationIntegrity(engine.getState());
    assert.equal(
      audit.valid,
      true,
      `Gün ${engine.getState().day} muhasebe hatası: ${audit.errors.join(', ')}`
    );
  }
});

test('Şirket kuruluşu ve kişisel nakitten şirkete sermaye aktarımı yoktan para üretmez (Net Varlık Korunumu)', () => {
  const engine = new SimulationEngine(20261104, 2_500_000);
  const netWorthBeforeFounding = engine.getState().netWorth;

  const foundRes = engine.establishCompany(
    'Merkez Sanayi Girişimi A.Ş.',
    'MRKZ',
    'ENERJI',
    1_000_000
  );
  assert.equal(foundRes.success, true);

  // 1.000.000 TL kişisel nakitten şirkete geçtiğinde:
  // Kişisel nakit = 1.500.000 TL, Şirket özkaynak değeri = 1.000.000 TL, Toplam Net Varlık = 2.500.000 TL!
  assert.equal(engine.getState().cash, 1_500_000);
  assert.equal(engine.getState().playerCompany?.equityValue, 1_000_000);
  assert.equal(engine.getState().netWorth, netWorthBeforeFounding);

  // Ek 300.000 TL sermaye aktarımı yapıldığında da toplam net varlık değişmemeli!
  const netWorthBeforeInjection = engine.getState().netWorth;
  const injectRes = engine.transferCapitalToCompany(300_000);
  assert.equal(injectRes.success, true);
  assert.equal(engine.getState().cash, 1_200_000);
  assert.equal(engine.getState().playerCompany?.equityValue, 1_300_000);
  assert.equal(engine.getState().netWorth, netWorthBeforeInjection);
});
