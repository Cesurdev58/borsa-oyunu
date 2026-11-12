import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WalletEngine } from '../../engine/WalletEngine';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'tests') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

test('Cüzdan: girişler ve çıkışlar kuruşa yuvarlanır, geçersiz değer yazılmaz', () => {
  const w = { cash: 100 };
  WalletEngine.earn(w, 0.126);
  WalletEngine.spend(w, 10.004);
  assert.equal(w.cash, 90.13);
  WalletEngine.earn(w, Number.NaN);
  WalletEngine.spend(w, Number.POSITIVE_INFINITY);
  WalletEngine.setBalance(w, Number.NaN);
  assert.equal(w.cash, 90.13);
  WalletEngine.setBalance(w, 250.456);
  assert.equal(w.cash, 250.46);
});

test('Tek cüzdan kuralı: oyuncu nakdi (state.cash) yalnızca WalletEngine içinde yazılır', () => {
  const offenders: string[] = [];
  const writeRe = /\b(?:this\.)?state\.cash\s*(?:=(?!=)|\+=|-=)/;
  for (const file of walk('src')) {
    if (file.endsWith('WalletEngine.ts')) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (writeRe.test(line)) offenders.push(`${file}:${i + 1}`);
      });
  }
  assert.deepEqual(offenders, [], `Doğrudan nakit yazımı bulundu: ${offenders.join(', ')}`);
});
