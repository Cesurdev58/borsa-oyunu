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
  /**
   * `cash` içindeki KISITLI işletme kredisi bakiyesi (yalnızca işletme harcamalarında kullanılır).
   * Alan yoksa 0 sayılır (eski kayıtlar).
   */
  businessLoanFund?: number;
}

export class WalletEngine {
  public static round2(value: number): number {
    return Number(value.toFixed(2));
  }

  /** Cüzdandaki güncel nakit. */
  public static balance(state: WalletHolder): number {
    return state.cash;
  }

  /** Kısıtlı işletme kredisi bakiyesi; hiçbir zaman nakitten büyük ya da negatif olamaz. */
  public static restrictedFund(state: WalletHolder): number {
    const fund = state.businessLoanFund;
    if (typeof fund !== 'number' || !Number.isFinite(fund) || fund <= 0) return 0;
    return WalletEngine.round2(Math.min(fund, Math.max(0, state.cash)));
  }

  /** Serbest nakit: kısıtlı işletme kredisi bakiyesi DÜŞÜLMÜŞ nakit (hisse, lüks, şirket aktarımı bunu kullanır). */
  public static freeCash(state: WalletHolder): number {
    return WalletEngine.round2(Math.max(0, state.cash - WalletEngine.restrictedFund(state)));
  }

  /** Kısıtlı bakiyeyi nakdi aşmayacak şekilde sınırlar (zorunlu ödemeler nakdi eritince kısıtlı kısım da erir). */
  private static capRestricted(state: WalletHolder): void {
    if (typeof state.businessLoanFund !== 'number') return;
    state.businessLoanFund = WalletEngine.restrictedFund(state);
  }

  /** Kredi kullandırımıyla gelen nakdin bir kısmını işletme harcamasına kısıtlar (nakit zaten `cash` içindedir). */
  public static restrictToBusiness(state: WalletHolder, amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) return WalletEngine.restrictedFund(state);
    state.businessLoanFund = WalletEngine.round2((state.businessLoanFund ?? 0) + amount);
    WalletEngine.capRestricted(state);
    return state.businessLoanFund ?? 0;
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
    WalletEngine.capRestricted(state);
    return state.cash;
  }

  /**
   * İşletme harcaması (stok, kira, personel, dekorasyon, lojistik, dükkân yükseltmesi):
   * önce kısıtlı işletme kredisi bakiyesinden, kalanı serbest nakitten düşer.
   */
  public static spendBusiness(state: WalletHolder, amount: number): number {
    if (!Number.isFinite(amount)) return state.cash;
    const used = Math.min(WalletEngine.restrictedFund(state), Math.max(0, amount));
    if (used > 0) state.businessLoanFund = WalletEngine.round2((state.businessLoanFund ?? 0) - used);
    state.cash = WalletEngine.round2(state.cash - amount);
    WalletEngine.capRestricted(state);
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
    WalletEngine.capRestricted(state);
    return state.cash;
  }
}
