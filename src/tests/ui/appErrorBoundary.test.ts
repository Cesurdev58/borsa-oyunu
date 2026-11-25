import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AppErrorBoundary,
  AppErrorBoundaryState,
  buildErrorReport,
} from '../../components/AppErrorBoundary';
import { SimulationStore } from '../../state/simulationStore';

type FakeWindow = {
  localStorage: {
    store: Map<string, string>;
    getItem: (k: string) => string | null;
    setItem: (k: string, v: string) => void;
    removeItem: (k: string) => void;
  };
  location: { reloads: number; reload: () => void };
};

function installFakeWindow(saveJson: string | null): FakeWindow {
  const store = new Map<string, string>();
  if (saveJson !== null) store.set(SimulationStore.STORAGE_KEY, saveJson);
  const fake: FakeWindow = {
    localStorage: {
      store,
      getItem: (k) => (store.has(k) ? store.get(k)! : null),
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    },
    location: {
      reloads: 0,
      reload() {
        fake.location.reloads += 1;
      },
    },
  };
  (globalThis as { window?: unknown }).window = fake;
  return fake;
}

function removeFakeWindow() {
  delete (globalThis as { window?: unknown }).window;
}

/** Bağlanmamış (mount edilmemiş) sınıf örneğinde setState'i doğrudan uygular. */
function boundaryWithState(partial: Partial<AppErrorBoundaryState>) {
  const b = new AppErrorBoundary({});
  b.state = { ...b.state, ...partial };
  const apply = (u: Partial<AppErrorBoundaryState>) => {
    b.state = { ...b.state, ...u };
  };
  b.setState = apply as typeof b.setState;
  return b;
}

test('Hata yokken ErrorBoundary çocukları olduğu gibi çizer', () => {
  const html = renderToStaticMarkup(
    React.createElement(AppErrorBoundary, null, React.createElement('p', null, 'oyun ekranı'))
  );
  assert.equal(html, '<p>oyun ekranı</p>');
});

test('Hata yakalanınca durum hata moduna geçer ve kurtarma ekranı çizilir', () => {
  const err = new Error('eski kayıt bozuk');
  const derived = AppErrorBoundary.getDerivedStateFromError(err);
  assert.equal(derived.hasError, true);
  assert.equal(derived.error, err);

  const b = boundaryWithState(derived);
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, b.render()));
  assert.match(html, /data-testid="app-error-boundary"/);
  assert.match(html, /eski kayıt bozuk/);
  assert.match(html, /Sayfayı Yenile/);
  assert.match(html, /Hata Detayını Kopyala/);
  assert.match(html, /Kaydı Yedekle ve Sıfırla/);
  // Sıfırlama ilk ekranda doğrudan yapılmaz (iki adım)
  assert.doesNotMatch(html, /app-error-reset-confirm-btn/);
});

test('Sıfırlama ikinci adımda: yedek alınmadan sil düğmesi kapalı, kayıt silinmez', () => {
  const fake = installFakeWindow('{"kayit":1}');
  try {
    const b = boundaryWithState({ hasError: true, error: new Error('x'), resetStep: 'confirm' });
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, b.render()));
    assert.match(html, /data-testid="app-error-reset-confirm-btn"[^>]*disabled=""/);

    b['handleConfirmReset']();
    assert.equal(fake.localStorage.store.has(SimulationStore.STORAGE_KEY), true, 'kayıt duruyor');
    assert.equal(fake.location.reloads, 0);

    // Yedek alındıktan sonra silme ve yeniden yükleme çalışır
    b.setState({ backupTaken: true });
    b['handleConfirmReset']();
    assert.equal(fake.localStorage.store.has(SimulationStore.STORAGE_KEY), false, 'kayıt silindi');
    assert.equal(fake.location.reloads, 1);
  } finally {
    removeFakeWindow();
  }
});

test('Hata raporu mesajı ve kısa yığın özetini içerir', () => {
  const err = new Error('patladı');
  err.stack = ['Error: patladı', ...Array.from({ length: 20 }, (_, i) => `    at f${i} (a.ts:${i})`)].join('\n');
  const report = buildErrorReport(err, '\n    at Panel\n    at App', '2026-11-25T00:00:00.000Z');
  assert.match(report, /Error: patladı/);
  assert.match(report, /at f0/);
  assert.doesNotMatch(report, /at f10/, 'yığın kısaltılır');
  assert.match(report, /at Panel/);
  assert.equal(buildErrorReport('düz metin').includes('Hata: düz metin'), true);
});
