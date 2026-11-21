/**
 * Prestij süresi ölçümü. Çalıştırmak için:  npm run prestij-sure
 *
 * Mevcut kariyer robotunu (scripts/kariyer-hizi.ts) PRESTIJ_YILDIZ=0, 1 ve 5 ile çalıştırır ve
 * önemli kilometre taşlarına kaç GERÇEK dakikada ulaşıldığını (3 tohumun ortancası) karşılaştırır.
 * Ekonomi hesabı burada yapılmaz; yalnızca mevcut motorun çıktısı okunur.
 * Çıkış kodu 1: bir kilometre taşı hiç gelmezse, NaN/Infinity çıkarsa ya da robot hata verirse.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./kariyer-hizi.ts', import.meta.url));
const STARS = [0, 1, 5];
const MILESTONES = ['1 milyon', 'Şirket kapısı', 'Şirketleşme şartı'] as const;

function parseMinutes(text: string): string {
  // "≈ 4 dk" veya "≈ 6,8 sa"
  const m = text.match(/≈\s*([\d.,]+)\s*(dk|sa)/);
  if (!m) return 'NaN';
  const v = Number(m[1].replace(',', '.'));
  return String(m[2] === 'sa' ? v * 60 : v);
}

const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
let failed = false;
const results: Record<number, Record<string, number | null>> = {};

for (const stars of STARS) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', SCRIPT], {
    env: { ...process.env, PRESTIJ_YILDIZ: String(stars) },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error(`HATA: ${stars} yıldız koşusu başarısız (çıkış ${r.status})\n${r.stderr}`);
    process.exit(1);
  }
  // Yalnızca tohum bölümleri (hedef ödülü bölümünden önce)
  const seedPart = r.stdout.split('=== HEDEF ÖDÜLLERİ')[0];
  results[stars] = {};
  for (const key of MILESTONES) {
    const vals: number[] = [];
    for (const line of seedPart.split('\n')) {
      if (!line.includes(key)) continue;
      if (line.includes('gün+') || /\d+\+ gün/.test(line)) {
        failed = true;
        console.error(`HATA: ${stars} yıldız, "${key}" hiç gelmedi: ${line.trim()}`);
        continue;
      }
      const min = Number(parseMinutes(line));
      if (!Number.isFinite(min)) {
        failed = true;
        console.error(`HATA: ${stars} yıldız, "${key}" sayı değil: ${line.trim()}`);
        continue;
      }
      vals.push(min);
    }
    results[stars][key] = vals.length ? median(vals) : null;
  }
}

const fmt = (min: number | null) => (min === null ? 'yok' : min < 60 ? `${Math.round(min)} dk` : `${(min / 60).toFixed(1).replace('.', ',')} sa`);
console.log('=== PRESTİJ SÜRESİ (1x hız, gerçek süre, 3 tohum ortancası) ===');
console.log('  ' + 'Kilometre taşı'.padEnd(22) + STARS.map((s) => `${s} yıldız`.padStart(11)).join(''));
for (const key of MILESTONES) {
  console.log('  ' + key.padEnd(22) + STARS.map((s) => fmt(results[s][key]).padStart(11)).join(''));
}
if (failed) process.exit(1);
