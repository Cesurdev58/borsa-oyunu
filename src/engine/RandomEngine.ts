/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AŞAMA 2: DETERMİNİSTİK RASTGELELİK MOTORU (RandomEngine)
 * Mulberry32 32-bit PRNG + Box-Muller Standart Normal Dağılım.
 * Hiçbir simülasyon modülünde Math.random() doğrudan kullanılmaz.
 */

export class RandomEngine {
  private state: number;
  private readonly initialSeed: number;

  constructor(seed: number = 20261104) {
    const cleanSeed = (Math.floor(Math.abs(seed)) || 20261104) >>> 0;
    this.initialSeed = cleanSeed;
    this.state = cleanSeed;
  }

  /**
   * [0, 1) aralığında tekdüze (uniform) deterministik float döndürür.
   */
  public uniform(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Box-Muller dönüşümü ile N(0, 1) standart normal dağılım üretir.
   */
  public normal(): number {
    let u1 = 0;
    let u2 = 0;
    while (u1 <= 1e-7) {
      u1 = this.uniform();
    }
    u2 = this.uniform();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * [min, max] kapalı aralığında deterministik tam sayı döndürür.
   */
  public integer(min: number, max: number): number {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    if (lo === hi) return lo;
    return lo + Math.floor(this.uniform() * (hi - lo + 1));
  }

  /**
   * Diziden deterministik olarak rastgele bir eleman seçer.
   */
  public choose<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('RandomEngine.choose: Boş diziden seçim yapılamaz.');
    }
    const idx = this.integer(0, items.length - 1);
    return items[idx];
  }

  /**
   * Ağırlıklı olasılık dağılımına göre diziden deterministik eleman seçer.
   */
  public weightedChoice<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0 || items.length !== weights.length) {
      throw new Error('RandomEngine.weightedChoice: Geçersiz dizi veya ağırlık uzunluğu.');
    }
    let totalWeight = 0;
    for (const w of weights) {
      totalWeight += Math.max(0, w);
    }
    if (totalWeight <= 0) {
      return this.choose(items);
    }
    let threshold = this.uniform() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      const w = Math.max(0, weights[i]);
      if (threshold < w) {
        return items[i];
      }
      threshold -= w;
    }
    return items[items.length - 1];
  }

  public getSeed(): number {
    return this.initialSeed;
  }

  public getState(): number {
    return this.state >>> 0;
  }

  public restoreState(savedState: number): void {
    this.state = (Math.floor(Math.abs(savedState)) || this.initialSeed) >>> 0;
  }
}
