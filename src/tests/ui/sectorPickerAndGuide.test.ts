import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SECTOR_CONFIGS } from '../../data/sectors';
import { SECTOR_GUIDE, SECTOR_GUIDE_ORDER } from '../../data/sectorGuide';
import { HowToPlayModal } from '../../components/game/HowToPlayModal';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { growCompanyGreedy } from '../balance/companyBot';
import { FIRST_SHOP_MIN_NET_WORTH } from '../../data/gameBalance';

test('Her sektörün tanıtımı var ve seçim ekranında hepsi bir kez listelenir', () => {
  const ids = Object.keys(SECTOR_CONFIGS).sort();
  assert.deepEqual([...SECTOR_GUIDE_ORDER].sort(), ids);
  for (const id of ids) {
    const g = SECTOR_GUIDE[id as keyof typeof SECTOR_GUIDE];
    assert.ok(g.pitchTR && g.plusTR && g.minusTR, id);
    assert.ok([1, 2, 3].includes(g.growth) && [1, 2, 3].includes(g.ceiling) && [1, 2, 3].includes(g.rivalEase));
  }
});

test('Perakende şirketi artık zarar sarmalına girmez, zamanla kâra geçer', () => {
  const eng = new SimulationEngine(20261104, 2_500_000);
  eng.establishCompany('Pera A.Ş.', 'PERA', 'PERAKENDE', 1_000_000, {
    initialStaffCount: 25,
    initialCapacity: 40,
    initialRdBudget: 15_000,
  });
  for (let d = 1; d <= 600; d++) {
    growCompanyGreedy(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
  }
  const pc = eng.getState().playerCompany!;
  assert.ok(pc.financials.netIncome / 120 > 5_000, `günlük kâr ${Math.round(pc.financials.netIncome / 120)}`);
});

test('"Nasıl oynanır?" rehberi açılınca bölüm sekmelerini ve oyunun gerçek eşiklerini gösterir', () => {
  const props = {
    open: true,
    onClose: () => {},
    onGoTab: () => {},
    onOpenBuilding: () => {},
    formatCurrency: (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`,
  };
  const html = renderToStaticMarkup(React.createElement(HowToPlayModal, props));
  for (const id of ['start', 'market', 'shop', 'company', 'holding', 'money', 'tips']) {
    assert.ok(html.includes(`how-to-play-tab-${id}`), id);
  }
  assert.ok(html.includes(`₺${FIRST_SHOP_MIN_NET_WORTH.toLocaleString('tr-TR')}`));
  assert.equal(renderToStaticMarkup(React.createElement(HowToPlayModal, { ...props, open: false })), '');
});
