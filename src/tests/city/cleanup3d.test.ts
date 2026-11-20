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
import { CORE_BUILDING_SPRITES, URBAN_BLOCK_SPRITES } from '../../components/game/city/buildingSprites';

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

test('2D bina ve dükkân görselleri korundu: her tanımlı PNG dosyası gerçekten var', () => {
  const specs = [...Object.values(CORE_BUILDING_SPRITES), ...Object.values(URBAN_BLOCK_SPRITES)];
  assert.ok(specs.length >= 4);
  for (const s of specs) {
    assert.ok(s && s.src, 'sprite tanımı');
    const file = path.join(ROOT, 'public', s.src.replace(/^\/?/, '').replace(/^.*?buildings\//, 'buildings/'));
    assert.ok(fs.existsSync(file), `eksik görsel: ${s.src}`);
    assert.ok(fs.statSync(file).size > 1000, `boş görsel: ${s.src}`);
  }
});

test('Acil durum yedeği: harita bağlantısı yoksa klasik 2D şehir çizilir, çökmez', () => {
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
});
