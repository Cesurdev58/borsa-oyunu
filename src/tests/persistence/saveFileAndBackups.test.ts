/** Kayıt dosyası (SHA-256) ve 5 yuvalı dönen otomatik yedek. */
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../../engine/SimulationEngine';
import { SimulationStore } from '../../state/simulationStore';
import { exportSaveFile, importSaveFile, SaveFileError } from '../../state/SaveFile';
import {
  AUTO_BACKUP_INTERVAL_MS,
  BACKUP_SLOT_COUNT,
  BACKUP_SLOT_KEY_PREFIX,
  SaveBackups,
} from '../../state/SaveBackups';
import { sha256Hex } from '../../engine/SimulationPersistence';

class FakeStorage {
  data = new Map<string, string>();
  /** Bu kadar baytı aşan yazma kota hatası verir (0 = sınırsız) */
  quota = 0;
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) {
    const total = [...this.data.entries()].filter(([key]) => key !== k).reduce((a, [, x]) => a + x.length, 0) + v.length;
    if (this.quota && total > this.quota) throw new DOMException('quota', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) { this.data.delete(k); }
}
let ls: FakeStorage;
beforeEach(() => {
  ls = new FakeStorage();
  (globalThis as { window?: unknown }).window = { localStorage: ls };
});

function game(day = 1) {
  const eng = new SimulationEngine(20261120, 1_000_000);
  assert.equal(eng.openShop({ shopType: 'BUFE' }).success, true);
  eng.getState().day = day;
  return eng;
}
async function rejectsWith(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof SaveFileError && e.code === code && e.message.length > 20);
}

test('SHA-256 bilinen değerle uyuşur', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('Dışa aktar → içe aktar: oyun durumu aynen geri gelir', async () => {
  const eng = game(5);
  eng.getState().milestones!.customerBonusPct = 2;
  const { fileName, text } = await exportSaveFile(eng, '2026-11-20T10:00:00.000Z');
  assert.match(fileName, /^borsa-oyunu-gun-5-2026-11-20\.json$/);
  const back = await importSaveFile(text);
  assert.equal(back.getState().day, 5);
  assert.equal(back.getState().seed, eng.getState().seed);
  assert.equal(back.getState().tradeState!.shops.length, 1);
  assert.equal(back.getState().milestones!.customerBonusPct, 2);
  assert.equal(Math.round(back.getState().cash), Math.round(eng.getState().cash));
});

test('Bozuk dosyalar anlaşılır Türkçe hata verir ve hiçbir şeyi değiştirmez', async () => {
  const { text } = await exportSaveFile(game());
  await rejectsWith(importSaveFile(''), 'EMPTY');
  await rejectsWith(importSaveFile('{ yarım json'), 'NOT_JSON');
  await rejectsWith(importSaveFile(JSON.stringify({ merhaba: 1 })), 'NOT_A_SAVE');
  await rejectsWith(importSaveFile(JSON.stringify({ format: 'borsa-holding-save', fileVersion: 1 })), 'MISSING_PARTS');
  await rejectsWith(importSaveFile(JSON.stringify({ ...JSON.parse(text), fileVersion: 99 })), 'NEWER_FILE_VERSION');
  // Yarım inmiş dosya
  await rejectsWith(importSaveFile(text.slice(0, Math.floor(text.length / 2))), 'NOT_JSON');
});

test('Elle değiştirilmiş kayıt kontrol kodundan geçemez', async () => {
  const { text } = await exportSaveFile(game());
  const f = JSON.parse(text);
  // Paradan bir sıfır eklemeye çalış (içerik değişir, kod aynı kalır)
  f.payload = f.payload.replace(/"cash":(\d+)/, (_m: string, n: string) => `"cash":${n}0`);
  assert.notEqual(f.payload, JSON.parse(text).payload, 'test düzeneği: içerik gerçekten değişmeli');
  await rejectsWith(importSaveFile(JSON.stringify(f)), 'CHECKSUM_MISMATCH');
  // Kod da uydurulursa (içerik doğru, kod yanlış) yine reddedilir
  const g = JSON.parse(text);
  g.checksum = 'a'.repeat(64);
  await rejectsWith(importSaveFile(JSON.stringify(g)), 'CHECKSUM_MISMATCH');
});

test('Sağlam kodlu ama içeriği oyun kaydı olmayan dosya anlaşılır hata verir', async () => {
  const payload = JSON.stringify({ schemaVersion: 5, nothing: true });
  const f = { format: 'borsa-holding-save', fileVersion: 1, exportedAtISO: 'x', schemaVersion: 5, day: 1, checksum: await sha256Hex(payload), payload };
  await rejectsWith(importSaveFile(JSON.stringify(f)), 'PAYLOAD_UNREADABLE');
});

test('Yedek: 5 yuva döner, en eski üzerine yazılır, liste en yeni başta', () => {
  const eng = game();
  const t0 = Date.UTC(2026, 10, 20, 10, 0, 0);
  for (let i = 0; i < 7; i++) {
    eng.getState().day = 10 + i;
    assert.ok(SaveBackups.take(eng, 'before-prestige', t0 + i * 120_000), `yedek ${i}`);
  }
  const list = SaveBackups.list();
  assert.equal(list.length, BACKUP_SLOT_COUNT);
  assert.deepEqual(list.map((b) => b.day), [16, 15, 14, 13, 12], 'son 5 yedek, yeniden eskiye');
  assert.equal(new Set(list.map((b) => b.slot)).size, BACKUP_SLOT_COUNT);
  assert.equal([...ls.data.keys()].filter((k) => k.startsWith(BACKUP_SLOT_KEY_PREFIX)).length, BACKUP_SLOT_COUNT);
});

test('Otomatik yedek 7 dakikada bir; kritik yedek sıklığa takılmaz', () => {
  const eng = game();
  const t0 = Date.UTC(2026, 10, 20, 10, 0, 0);
  assert.equal(SaveBackups.isAutoBackupDue(t0), true);
  assert.ok(SaveBackups.take(eng, 'auto', t0));
  assert.equal(SaveBackups.isAutoBackupDue(t0 + 60_000), false);
  assert.equal(SaveBackups.take(eng, 'auto', t0 + 60_000), null, 'süre dolmadan otomatik yedek yok');
  assert.ok(SaveBackups.take(eng, 'before-ipo', t0 + 61_000), 'kritik işlem yedeği hemen alınır');
  assert.equal(SaveBackups.isAutoBackupDue(t0 + AUTO_BACKUP_INTERVAL_MS), true);
  assert.ok(SaveBackups.take(eng, 'auto', t0 + AUTO_BACKUP_INTERVAL_MS));
  assert.ok(AUTO_BACKUP_INTERVAL_MS >= 5 * 60_000 && AUTO_BACKUP_INTERVAL_MS <= 10 * 60_000);
});

test('Aynı kritik işlem art arda denenirse yuvalar dolmaz', () => {
  const eng = game();
  const t0 = Date.UTC(2026, 10, 20, 10, 0, 0);
  SaveBackups.take(eng, 'before-ipo', t0);
  SaveBackups.take(eng, 'before-ipo', t0 + 5_000);
  SaveBackups.take(eng, 'before-ipo', t0 + 10_000);
  assert.equal(SaveBackups.list().length, 1);
});

test('Yedekten geri dönüş oyunu yedek anındaki hâline getirir; bozuk yuva hata verir', () => {
  const eng = game(7);
  const info = SaveBackups.take(eng, 'before-company')!;
  eng.getState().day = 99;
  const { engine: back, error } = SaveBackups.load(info.slot);
  assert.equal(error, undefined);
  assert.equal(back!.getState().day, 7);
  ls.data.set(BACKUP_SLOT_KEY_PREFIX + info.slot, '{bozuk');
  assert.equal(SaveBackups.load(info.slot).engine, null);
  assert.ok(SaveBackups.load(info.slot).error);
  assert.equal(SaveBackups.load(3).engine, null);
});

test('Depolama dolunca en eski yedekler silinip yenisi yazılır; yazılamıyorsa oyun durmaz', () => {
  const eng = game();
  const t0 = Date.UTC(2026, 10, 20, 10, 0, 0);
  const one = JSON.stringify(SimulationStore.buildEnvelope(eng)).length;
  ls.quota = Math.round(one * 2.6); // en çok 2 yedek sığar
  for (let i = 0; i < 4; i++) eng.getState().day = 20 + i, assert.ok(SaveBackups.take(eng, 'before-takeover', t0 + i * 120_000), `yedek ${i}`);
  const list = SaveBackups.list();
  assert.ok(list.length >= 1 && list.length <= 2);
  assert.equal(list[0].day, 23, 'en yeni yedek korunur');
  ls.quota = 10; // hiçbir şey sığmaz
  assert.equal(SaveBackups.take(eng, 'before-ipo', t0 + 999_999_999), null);
});

test('Kritik işlemler (şirket kurma, şirketleşme, halka arz, devralma) yedeği işlemden ÖNCE tetikler', () => {
  const eng = game(3);
  SaveBackups.attach(eng);
  const seen: Array<{ reason: string; shopsAtBackup: number }> = [];
  const original = eng.criticalActionHook!;
  eng.criticalActionHook = (reason) => {
    seen.push({ reason, shopsAtBackup: eng.getState().tradeState!.shops.length });
    original(reason);
  };
  eng.establishCompany('Deneme AŞ', 'DNM', 'TEKNOLOJI' as never, 500_000);
  eng.incorporateShopsIntoCompany({ companyName: 'Deneme', ticker: 'DNX', sector: 'TEKNOLOJI' as never });
  eng.executeIPO();
  eng.executeHostileTakeover('NVEX');
  assert.deepEqual(
    seen.map((s) => s.reason),
    ['before-company', 'before-incorporation', 'before-ipo', 'before-takeover']
  );
  const reasons = SaveBackups.list().map((b) => b.reason);
  for (const r of ['before-company', 'before-incorporation', 'before-ipo', 'before-takeover']) assert.ok(reasons.includes(r as never), r);
  // İlk yedek, işlem öncesi durumu taşır (dükkân hâlâ ayrı)
  const first = SaveBackups.list().find((b) => b.reason === 'before-company')!;
  assert.equal(SaveBackups.load(first.slot).engine!.getState().playerCompany, null);
});

test('Ayarlar bölümü: dışa/içe aktar düğmeleri ve yedek listesi çizilir', async () => {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SaveManagementSection } = await import('../../components/game/SaveManagementSection');
  const eng = game(4);
  SaveBackups.take(eng, 'before-ipo');
  const html = renderToStaticMarkup(
    React.createElement(SaveManagementSection, {
      onExport: async () => ({ ok: true, message: '' }),
      onImport: async () => ({ ok: true, message: '' }),
      listBackups: () => SaveBackups.list(),
      onRestoreBackup: () => ({ ok: true, message: '' }),
    })
  );
  for (const id of ['save-export-btn', 'save-import-btn', 'save-import-input', 'save-backups-list', 'save-backup-restore-']) {
    assert.ok(html.includes(id), id);
  }
  assert.ok(html.includes('Halka arzdan önce'));
});
