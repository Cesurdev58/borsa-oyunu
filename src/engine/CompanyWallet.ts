/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ŞİRKET KASASI (CompanyWallet)
 * Bir şirketin (oyuncu şirketi ya da NPC şirket) nakdi `financials.cash` YALNIZCA buradan değişir.
 * - Hiçbir başka motoru içe aktarmaz; bağımlılık döngüsü oluşturamaz.
 * - `earn` / `spend` kuruşa yuvarlar ve geçersiz (NaN/sonsuz) tutarı yok sayar.
 * - `assign` hesaplanmış bir bakiyeyi olduğu gibi yazar (yuvarlamadan); mevcut davranışı korumak içindir.
 * Oyuncunun kişisel nakdi için WalletEngine kullanılır.
 */

export interface CashHolder {
  financials: { cash: number };
}

export class CompanyWallet {
  public static balance(holder: CashHolder): number {
    return holder.financials.cash;
  }

  public static earn(holder: CashHolder, amount: number): number {
    if (!Number.isFinite(amount)) return holder.financials.cash;
    holder.financials.cash = Number((holder.financials.cash + amount).toFixed(2));
    return holder.financials.cash;
  }

  public static spend(holder: CashHolder, amount: number): number {
    if (!Number.isFinite(amount)) return holder.financials.cash;
    holder.financials.cash = Number((holder.financials.cash - amount).toFixed(2));
    return holder.financials.cash;
  }

  /** Hesaplanmış yeni bakiyeyi olduğu gibi yazar. */
  public static assign(holder: CashHolder, newBalance: number): number {
    holder.financials.cash = newBalance;
    return newBalance;
  }
}
