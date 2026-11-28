/**
 * Mantık düzeltmeleri, mobil tamamlama ve Tycoon arayüzü: hız kapsülü, geri tuşu, kalıcı ayar,
 * şehir deposu özeti, Toptan sekmesi gizleme, pencere başlıkları ve bildirim zili.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameSpeedControl, nextPauseScale, nextSpeedScale } from '../../components/game/GameSpeedControl';
import { UISettingsStore } from '../../state/uiSettingsStore';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { CityDepotCard } from '../../components/game/turkeyMap/CityDepotCard';
import { getCityDepotPlan } from '../../engine/CityDepot';
import { BACK_PRIORITY, createExitGuard, dispatchBack, registerBackHandler } from '../../nativeBackButton';
import { restockShops } from '../balance/restockBot';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
const fmt = (v: number) => `₺${Math.round(v).toLocaleString('tr-TR')}`;

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

test('Hız kontrolü: 1x ↔ 2x geçişi ve duraklat/devam', () => {
  assert.equal(nextSpeedScale(1), 2);
  assert.equal(nextSpeedScale(2), 1);
  assert.equal(nextSpeedScale(0), 1);
  assert.equal(nextPauseScale(2, 2), 0);
  assert.equal(nextPauseScale(0, 2), 2, 'devam edince son hıza döner');
  assert.equal(nextPauseScale(0, 0), 1);
  const html = renderToStaticMarkup(
    React.createElement(GameSpeedControl, { timeScale: 1, lastRunningScale: 1, onSetTimeScale: () => {} })
  );
  assert.match(html, /data-testid="game-speed-toggle"/);
  assert.match(html, /data-testid="game-pause-toggle"/);
  assert.match(html, /data-disabled="false"/);
  const locked = renderToStaticMarkup(
    React.createElement(GameSpeedControl, { timeScale: 1, lastRunningScale: 1, disabled: true, onSetTimeScale: () => {} })
  );
  assert.match(locked, /data-disabled="true"/);
  assert.match(locked, /disabled=""/);
  const view = read('src/components/game/TycoonGameView.tsx');
  assert.match(view, /<GameSpeedControl/);
  assert.match(read('src/components/game/HowToPlayModal.tsx'), /hız kapsülünde/);
});

test('Ayarlar: otomatik duraklat kalıcıdır, numaralı başlık yoktur', () => {
  const storage = new MemoryStorage();
  assert.equal(UISettingsStore.loadSettings(storage).autoPauseOnSheetOpen, false);
  UISettingsStore.saveSettings({ ...UISettingsStore.loadSettings(storage), autoPauseOnSheetOpen: true }, storage);
  assert.equal(UISettingsStore.loadSettings(storage).autoPauseOnSheetOpen, true);
  const view = read('src/components/game/TycoonGameView.tsx');
  assert.doesNotMatch(view, /useState\(false\);\s*\n\s*const prevScaleBeforeSheetRef/);
  for (const t of ['Oyun Hızı ve Süre', 'Raporlar ve Bildirimler', 'Ses ve Titreşim', 'Kayıt ve Veri']) {
    assert.ok(view.includes(t), t);
  }
  assert.doesNotMatch(view, /[1-4]\) (Oyun Hızı|Raporlar|Ses ve|Kayıt ve)/);
  // X düğmesi sıfırlama onayını da kapatır
  assert.match(view, /aria-label="Ayarları Kapat"\s*\n\s*onClick=\{\(\) => \{\s*\n\s*setResetConfirmOpen\(false\)/);
});

test('Geri tuşu: öncelik sırası ve çıkış için iki basış', () => {
  const calls: string[] = [];
  const offs = [
    registerBackHandler(BACK_PRIORITY.tab, () => { calls.push('tab'); return true; }),
    registerBackHandler(BACK_PRIORITY.overlay, () => { calls.push('overlay'); return false; }),
    registerBackHandler(BACK_PRIORITY.map, () => { calls.push('map'); return true; }),
  ];
  assert.equal(dispatchBack(), true);
  assert.deepEqual(calls, ['overlay', 'map'], 'pencere önce denenir, harita işi üstlenince sekmeye inmez');
  offs.forEach((o) => o());
  assert.equal(dispatchBack(), false);

  let t = 1000;
  const guard = createExitGuard(() => t, 2000);
  assert.equal(guard.press(), 'warn');
  t += 1500;
  assert.equal(guard.press(), 'exit');
  t += 5000;
  assert.equal(guard.press(), 'warn');
  t += 2500;
  assert.equal(guard.press(), 'warn', '2 sn geçince yeniden uyarır');

  const native = read('src/nativeBackButton.ts');
  assert.match(native, /Capacitor\.isNativePlatform\(\)/);
  assert.match(read('src/main.tsx'), /setupNativeBackButton\(\)/);
  assert.match(read('src/components/game/TycoonGameView.tsx'), /Çıkmak için tekrar bas/);
});

test('Şehir deposu: kurulu kart sıfır doluluk yerine indirim, dükkân ve tasarruf gösterir', () => {
  const eng = new SimulationEngine(880401, 3_000_000);
  assert.equal(eng.chooseStartCity('ankara').success, true);
  assert.equal(eng.openShop({ shopType: 'BUFE', cityId: 'ankara' }).success, true);
  assert.equal(eng.openShop({ shopType: 'MANAV', cityId: 'samsun' }).success, true);
  for (let d = 0; d < 6; d++) {
    restockShops(eng);
    eng.advanceDaysWithoutPlayerDecisions(1, true);
  }
  assert.equal(eng.buildCityDepot('samsun').success, true);
  const plan = getCityDepotPlan(eng.getState(), 'samsun');
  assert.equal(plan.exists, true);
  assert.ok(plan.activeSaving30Days >= 0);
  const html = renderToStaticMarkup(
    React.createElement(CityDepotCard, { cityId: 'samsun', state: eng.getState(), formatCurrency: fmt })
  );
  assert.match(html, /data-testid="city-depot-status"/);
  assert.match(html, /data-testid="city-depot-active-discount"/);
  assert.match(html, /data-testid="city-depot-covered-shops"/);
  assert.match(html, /data-testid="city-depot-active-saving"/);
  assert.doesNotMatch(html, /Doluluk/);
  assert.doesNotMatch(html, /0 \/ 4\.000 birim/);
  assert.doesNotMatch(read('src/engine/CityDepot.ts'), /zaten deponun var/);
  assert.match(read('src/engine/CityDepot.ts'), /zaten depon var/);
});

test('Dükkân yönetimi: Toptan & Üretim sekmesi tek dükkânda gizli, başlıklar güncel, vitrin öğeleri var', () => {
  const panel = read('src/components/game/EsnafAndTradePanel.tsx');
  assert.match(panel, /canSeeTradeCenter = trade\.shops\.length >= 2 \|\| state\.playerCompany !== null/);
  assert.match(panel, /\{canSeeTradeCenter && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*data-testid="mode-trade-center-btn"/);
  for (const id of ['shop-shelf-bar', 'shop-collect-profit-btn', 'shop-level-badge', 'shop-group-tab-', "id: 'TEZGAH'", "id: 'EKIP'", "id: 'BUYUME'", 'shop-restock-all-btn']) {
    assert.ok(panel.includes(id), id);
  }
  for (const id of ['ORDER_PRODUCT', 'EDIT_PRICES', 'MANAGE_STAFF', 'UPGRADE_SHOP', 'OPEN_BRANCH']) {
    assert.ok(panel.includes(`'${id}'`), id);
  }
  const sheet = read('src/components/game/BuildingDetailSheet.tsx');
  assert.match(sheet, /Dükkânlarım & İşletme Yönetimi/);
  assert.match(sheet, /Stok, ekip, fiyatlandırma ve şube büyümesi/);
  assert.match(sheet, /· Seviye \$\{managedShop\.level\}\/5/);
  assert.doesNotMatch(sheet, /Oyuncu Ofisi & Portföy Yönetimi/);
  assert.match(read('src/components/game/gameTypes.ts'), /title: 'Dükkân Yönetimi'/);
});

test('Bildirim zili: gün dönümü ve seans geçişi zili doldurmaz', () => {
  const app = read('src/App.tsx');
  const sync = app.slice(app.indexOf('const syncEngineEventsToNotifications'), app.indexOf('// 4. Temettü'));
  assert.doesNotMatch(sync, /addItem\(\s*'NEW_DAY'/);
  assert.doesNotMatch(sync, /addItem\(\s*'MARKET_OPENED'/);
  assert.doesNotMatch(sync, /addItem\(\s*'MARKET_CLOSED'/);
  assert.match(sync, /addItem\(\s*'ORDER_FILLED'/);
});

test('Harita ve kabuk: yükseklik gözlemcisi ve göreli ikon yolları', () => {
  assert.match(read('src/components/game/turkeyMap/TurkeyMapScreen.tsx'), /new ResizeObserver/);
  const html = read('index.html');
  assert.match(html, /href="\.\/favicon\.svg"/);
  assert.match(html, /href="\.\/manifest\.webmanifest"/);
});
