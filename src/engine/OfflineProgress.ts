/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * KADEMELİ ÇEVRİMDIŞI İLERLEME
 *  - Verim: ilk 2 gerçek saat %100, 2–4 sa %75, 4–8 sa %50, 8–12 sa %25; 12 saatten fazlası sayılmaz
 *    (`OFFLINE_TIERS`). Oyun günü sayısı "verimli dakika"dan hesaplanır.
 *  - Satışlar zaten stoğa bağlıdır (stok bitince satış olmaz; kişisel dükkânda otomatik mal ikmali yoktur);
 *    maaş, kira ve kredi taksiti normal işler.
 *  - İflas koruması: oyuncu yokken kimse iflas ettirilmez. Her oyun gününden ÖNCE `offlineDanger` bakılır;
 *    risk varsa faaliyetler orada durur (`state.offlinePause`), oyun duraklatılır ve oyuncu dönünce karar verir.
 * Yalnızca modelleri ve denge sabitlerini içe aktarır (döngü oluşmaz).
 */
import { OFFLINE_SAFETY_RUNWAY_DAYS, OFFLINE_TIERS } from '../data/gameBalance';
import type { SimulationState } from '../models/simulation';

export interface OfflineTierSlice {
  fromHours: number;
  toHours: number;
  /** Bu dilimde çevrimdışı geçen gerçek dakika */
  realMinutes: number;
  efficiency: number;
}

export interface OfflineCredit {
  /** Oyuna sayılan "verimli" gerçek dakika */
  effectiveMinutes: number;
  /** Çevrimdışı geçen toplam gerçek dakika (en çok 12 sa'ya kadar sayılır) */
  countedRealMinutes: number;
  slices: OfflineTierSlice[];
  /** 12 saati aştı mı */
  overLimit: boolean;
  /** Ortalama verim, 0–1 */
  averageEfficiency: number;
}

export const OFFLINE_MAX_COUNTED_HOURS = OFFLINE_TIERS[OFFLINE_TIERS.length - 1][0];

/** Gerçek çevrimdışı süreyi (saniye) kademeli verimle "verimli dakika"ya çevirir. */
export function offlineCredit(realSeconds: number): OfflineCredit {
  const empty: OfflineCredit = { effectiveMinutes: 0, countedRealMinutes: 0, slices: [], overLimit: false, averageEfficiency: 0 };
  if (!Number.isFinite(realSeconds) || realSeconds <= 0) return empty;
  const hours = realSeconds / 3600;
  const slices: OfflineTierSlice[] = [];
  let from = 0;
  let effective = 0;
  for (const [to, eff] of OFFLINE_TIERS) {
    if (hours <= from) break;
    const spent = Math.min(hours, to) - from;
    slices.push({ fromHours: from, toHours: from + spent, realMinutes: spent * 60, efficiency: eff });
    effective += spent * 60 * eff;
    from = to;
  }
  const counted = Math.min(hours, OFFLINE_MAX_COUNTED_HOURS) * 60;
  return {
    effectiveMinutes: effective,
    countedRealMinutes: counted,
    slices,
    overLimit: hours > OFFLINE_MAX_COUNTED_HOURS,
    averageEfficiency: counted > 0 ? effective / counted : 0,
  };
}

export type OfflineDangerKind = 'CASH' | 'LOAN' | 'SHOP' | 'COMPANY';

export interface OfflinePause {
  kind: OfflineDangerKind;
  /** Oyuncuya gösterilen açıklama */
  message: string;
  /** Önerilen ilk adım */
  advice: string;
  /** Faaliyetlerin durduğu oyun günü */
  day: number;
  /** Kaç oyun dakikası işlenmeden kaldı (kaybolur; yalnızca bilgi) */
  skippedGameMinutes: number;
}

const personalShops = (s: SimulationState) => (s.tradeState?.shops ?? []).filter((x) => !x.isCompanyBranch);

/**
 * Bir sonraki oyun gününe girmeden önce "iflas sınırı" kontrolü. Risk yoksa null.
 * Kurallar kasıtlı olarak ihtiyatlıdır: gerçek iflas ya da temerrüt olmadan DURUR.
 */
export function offlineDanger(state: SimulationState): Omit<OfflinePause, 'day' | 'skippedGameMinutes'> | null {
  if (state.cash < 0) {
    return { kind: 'CASH', message: 'Cebindeki para eksiye düştü.', advice: 'Hisse sat ya da dükkân kasasından para çek.' };
  }
  // Kredi: yarın ya da bugün vadesi gelen taksit için nakit yetmiyorsa
  for (const loan of state.activeLoans ?? []) {
    if (loan.status !== 'ACTIVE' && loan.status !== 'DELINQUENT') continue;
    if (loan.nextPaymentGameDay <= state.day + 1 && state.cash < loan.installmentAmount) {
      return {
        kind: 'LOAN',
        message: 'Yaklaşan kredi taksiti için cebinde yeterli para yok; ödeme kaçarsa kredin batabilirdi.',
        advice: 'Taksit için nakit hazırla (hisse sat ya da dükkân kâr al), sonra devam et.',
      };
    }
  }
  // Dükkânlar: kira + maaş için birkaç günlük karşılık
  const shops = personalShops(state);
  if (shops.length > 0) {
    const daily = shops.reduce((a, sh) => a + (sh.dailyRent ?? 0) + (sh.staffCount ?? 0) * (sh.staffDailyWagePerPerson ?? 0), 0);
    const cover = shops.reduce((a, sh) => a + Math.max(0, sh.cashAccountBalance ?? 0), 0) + Math.max(0, state.cash);
    if (daily > 0 && cover < daily * OFFLINE_SAFETY_RUNWAY_DAYS) {
      return {
        kind: 'SHOP',
        message: 'Dükkânlarının kira ve maaşını karşılayacak para bitmek üzere; devam etseydi dükkânlar zarara batardı.',
        advice: 'Dükkân kasasına para koy ya da kâr getiren dükkânlardan nakit topla.',
      };
    }
  }
  const pc = state.playerCompany;
  if (pc && (pc.isBankrupt || (pc.financials?.cash ?? 0) < 0)) {
    return {
      kind: 'COMPANY',
      message: 'Şirket kasası tükendi; devam etseydi şirket iflas edebilirdi.',
      advice: 'Şirkete sermaye koy ya da giderleri (personel, yatırım) azalt.',
    };
  }
  return null;
}
