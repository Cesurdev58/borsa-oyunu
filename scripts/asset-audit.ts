/**
 * `npm run asset-audit` — 3D şehir modellerinin denetimi.
 * Oyunun istediği her model dosyası (ve onun çağırdığı .bin / doku dosyaları) gerçekten var mı, bozuk mu,
 * sınır kutuları sıfır/NaN mı? Sorun varsa TAM dosya yolunu yazar ve çıkış kodu 1 döner.
 * `--json` ile makine okur çıktı verir.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditAssets, type AuditFs } from '../src/components/game/city3d/assetAudit';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

const fs: AuditFs = {
  exists: (p) => existsSync(p) && statSync(p).isFile(),
  read: (p) => new Uint8Array(readFileSync(p)),
};

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

const report = auditAssets(publicDir, fs, { listFiles });

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\n3D MODEL DENETİMİ — ${report.checked} model, ${report.ok} sağlam, ${report.failed} sorunlu\n`);
  const byPack = new Map<string, { ok: number; bad: number }>();
  for (const r of report.results) {
    const pack = r.file.split('/models/')[1]?.split('/')[0] ?? '?';
    const e = byPack.get(pack) ?? { ok: 0, bad: 0 };
    if (r.ok) e.ok++;
    else e.bad++;
    byPack.set(pack, e);
  }
  for (const [pack, e] of byPack) console.log(`  ${pack.padEnd(20)} ${String(e.ok).padStart(3)} sağlam  ${String(e.bad).padStart(3)} sorunlu`);
  const sized = report.results.filter((r) => r.size);
  if (sized.length) {
    const min = (f: (s: NonNullable<typeof sized[number]['size']>) => number) => Math.min(...sized.map((r) => f(r.size!)));
    console.log(`\n  En küçük sınır kutusu: ${min((s) => s.x).toFixed(3)} × ${min((s) => s.y).toFixed(3)} × ${min((s) => s.z).toFixed(3)} (hepsi sıfırdan büyük olmalı)`);
  }
  if (report.issues.length) {
    console.log('\nSORUNLAR (tam dosya yoluyla):');
    for (const i of report.issues) console.log(`  ✗ [${i.kind}] ${i.file}\n      ${i.name}: ${i.message}`);
  }
  if (report.orphanFiles.length) {
    console.log(`\nBilgi: hiçbir model tarafından kullanılmayan ${report.orphanFiles.length} dosya (hata değil):`);
    for (const f of report.orphanFiles.slice(0, 12)) console.log(`  · ${f}`);
    if (report.orphanFiles.length > 12) console.log(`  · … ve ${report.orphanFiles.length - 12} dosya daha`);
  }
  console.log(report.failed === 0 ? '\nSONUÇ: TEMİZ — bütün modeller var ve geçerli.\n' : `\nSONUÇ: BAŞARISIZ — ${report.failed} model sorunlu; oyun bunların yerine yedek model gösterir.\n`);
}
process.exit(report.failed === 0 ? 0 : 1);
