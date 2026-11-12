/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TEK CÜZDAN (WalletEngine)
 * Oyuncunun kişisel nakdi (`state.cash`) YALNIZCA bu dosya üzerinden değişir.
 * - Hiçbir başka motoru içe aktarmaz; bu yüzden bağımlılık döngüsü oluşturamaz.
 * - Her değişiklik kuruşa (2 hane) yuvarlanır; NaN / sonsuz değer cüzdana asla yazılmaz.
 * - Tüm para girişi/çıkışı tek kapıdan geçtiği için "para nereden geldi" sorusu tek yerde aranır.
 */

export interface WalletHolder {
  cash: number;
}

export class WalletEngine {
  public static round2(value: number): number {
    return Number(value.toFixed(2));
  }

  /** Cüzdandaki güncel nakit. */
  public static balance(state: WalletHolder): number {
    return state.cash;
  }

  /** Cüzdana para girer (satış geliri, temettü, iade, tahsilat...). */
  public static earn(state: WalletHolder, amount: number): number {
    if (!Number.isFinite(amount)) return state.cash;
    state.cash = WalletEngine.round2(state.cash + amount);
    return state.cash;
  }

  /** Cüzdandan para çıkar (alım, ödeme, sermaye aktarımı...). */
  public static spend(state: WalletHolder, amount: number): number {
    if (!Number.isFinite(amount)) return state.cash;
    state.cash = WalletEngine.round2(state.cash - amount);
    return state.cash;
  }

  /**
   * Cüzdanı doğrudan belirli bir bakiyeye eşitler.
   * Yalnızca defterle uzlaştırma, kayıt yükleme ve motorun hesapladığı "yeni bakiye"
   * durumlarında kullanılır; normal para hareketi için `earn` / `spend` tercih edilir.
   */
  public static setBalance(state: WalletHolder, newBalance: number): number {
    if (!Number.isFinite(newBalance)) return state.cash;
    state.cash = WalletEngine.round2(newBalance);
    return state.cash;
  }
}
