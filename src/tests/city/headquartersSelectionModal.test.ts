import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeadquartersSelectionModal } from '../../components/game/HeadquartersSelectionModal';
import { DETAILED_CITY_IDS } from '../../data/cityDefinitions';

test('Merkez şehri seçme penceresi: 12 şehir kartı, 69 il listede, seçim yapılana kadar onay düğmesi kapalı', () => {
  const html = renderToStaticMarkup(
    React.createElement(HeadquartersSelectionModal, { shopCount: 3, onConfirm: () => {} })
  );
  assert.ok(html.includes('data-testid="hq-selection-modal"'));
  assert.ok(html.includes('role="dialog"') && html.includes('aria-modal="true"'));
  for (const id of DETAILED_CITY_IDS) {
    assert.ok(html.includes(`data-testid="hq-city-option-${id}"`), `${id} kartı eksik`);
  }
  assert.equal((html.match(/<option value="[a-z]+"/g) ?? []).length, 69, 'Kalan 69 il seçilebilir olmalı');
  assert.ok(html.includes('Mevcut 3 dükkânın bu şehre taşınacak'));
  assert.ok(/data-testid="hq-confirm-btn"[^>]*disabled/.test(html) || /disabled[^>]*data-testid="hq-confirm-btn"/.test(html));
  // Ankara önerilir ama otomatik seçili değildir
  assert.ok(html.includes('Önerilen'));
  assert.ok(!html.includes('data-active="true"'));
  // Hiçbir şehir kilitli/pasif görünmez
  assert.ok(!html.includes('aria-disabled'));
});

test('Dükkânı olmayan kayıt için metin dükkân taşımadan söz etmez', () => {
  const html = renderToStaticMarkup(
    React.createElement(HeadquartersSelectionModal, { shopCount: 0, onConfirm: () => {} })
  );
  assert.ok(!html.includes('dükkânın bu şehre taşınacak'));
  assert.ok(html.includes('Şirket merkezin bu şehirde olacak'));
});
