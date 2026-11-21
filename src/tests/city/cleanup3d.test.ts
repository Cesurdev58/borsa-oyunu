/**
 * PR6 (Faz 12): 3D sistemin güvenli kaldırılması. Silinenler geri gelmesin, 2D görseller yerinde kalsın.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulationStore } from '../../state/simulationStore';
import { TycoonGameView } from '../../components/game/TycoonGameView';

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('3D kaldırıldı: city3d klasörü ve hazır model dosyaları yok', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'src/components/game/city3d')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'public/models')), false);
});

test('Three.js bağımlılığı package.json içinde yok ve hiçbir kaynak dosya onu içe aktarmıyor', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.equal('three' in all, false);
  assert.equal('@types/three' in all, false);
  const offenders = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'scripts'))].filter((f) =>
    /from\s+['"]three(\/|['"])|require\(['"]three|city3d/.test(fs.readFileSync(f, 'utf8')) && !f.endsWith('cleanup3d.test.ts')
  );
  assert.deepEqual(offenders, []);
});

test('Klasik (2D izometrik) şehir tamamen silindi: klasör, görseller ve bayrak dosyası yok', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'src/components/game/city')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'public/buildings')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'src/data/featureFlags.ts')), false);
  const offenders = walk(path.join(ROOT, 'src')).filter(
    (f) =>
      /game\/city\/|Isometric|cityLayout|buildingSprites|featureFlags/.test(fs.readFileSync(f, 'utf8')) &&
      !f.endsWith('cleanup3d.test.ts')
  );
  assert.deepEqual(offenders, []);
});

test('Harita bağlantısı yoksa oyun çökmeden uyarı gösterir', () => {
  const engine = SimulationStore.resetSharedEngine();
  const noop = () => {};
  const html = renderToStaticMarkup(
    React.createElement(TycoonGameView, {
      state: engine.getState(),
      ipoEligibility: engine.checkIPOEligibility(),
      nextEvent: engine.getNextScheduledEvent(),
      notifications: [],
      onMarkNotificationsRead: noop,
      onSetTimeScale: noop,
      onSetRealMinutesPerDay: noop,
      onAdvanceToMarketOpen: noop,
      onAdvanceOneHour: noop,
      onTickDay: noop,
      onSimulateOfflineProgress: noop,
      onManualSave: noop,
      onResetSimulation: noop,
      onDismissOfflineModal: noop,
      onSwitchToDeveloperDashboard: noop,
      selectedTicker: 'NVEX',
      onSelectTicker: noop,
      onPlaceOrder: noop,
      onCancelOrder: noop,
      onBuyStock: noop,
      onSellStock: noop,
      onEstablishCompany: noop,
      onTransferCapital: noop,
      onConfigureOperations: noop,
      onExecuteIPO: noop,
      onExecuteTakeover: noop,
      spendableCash: engine.getSpendableCash(),
      reservedCash: engine.getReservedCash(),
      getReservedShares: () => 0,
      formattedTime: engine.getFormattedGameTime(),
      formatCurrency: (v: number) => `₺${Math.round(v)}`,
    } as never)
  );
  assert.ok(html.includes('data-testid="tycoon-game-view"'));
  assert.equal(html.includes('turkey-map-flow'), false);
  assert.ok(html.includes('turkey-map-unavailable'));
});
