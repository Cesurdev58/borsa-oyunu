/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * KAYIT TEMİZLEME VE GÖÇ: işlem/emir kayıtlarını doğrulama ve onarma
 * (SimulationEngine dosyasından ayrıldı. Fonksiyonlar ilk parametre olarak motoru alır; dış dünya hâlâ SimulationEngine.* üzerinden çağırır.)
 */

import {
  NewsEvent,
} from '../models/news';
import {
  SimulationState,
} from '../models/simulation';
import {
  PendingOrder,
  TransactionRecord,
} from '../models/transactions';

export function sanitizeAndMigrateTransactionsAndOrders(
    state: Partial<SimulationState>
  ): {
    transactions: TransactionRecord[];
    transactionSequence: number;
    pendingOrders: PendingOrder[];
    orderSequence: number;
    newsFeed: NewsEvent[];
    duplicateTransactionsFixedCount: number;
    duplicateOrdersFixedCount: number;
  } {
    const rawTransactions: TransactionRecord[] = Array.isArray(state.transactions)
      ? state.transactions
      : [];
    const seenTxIds = new Set<string>();
    let duplicateTransactionsFixedCount = 0;
    let maxExtractedTxSeq = 0;
    let allTxCanonical = true;

    for (const tx of rawTransactions) {
      const idStr = typeof tx?.id === 'string' ? tx.id : '';
      if (!idStr || seenTxIds.has(idStr)) {
        duplicateTransactionsFixedCount += 1;
      } else {
        seenTxIds.add(idStr);
      }

      const canonicalMatch = /^TX-D\d+-S(\d+)$/.exec(idStr);
      if (canonicalMatch) {
        const seqVal = Number(canonicalMatch[1]);
        if (Number.isFinite(seqVal) && seqVal > maxExtractedTxSeq) {
          maxExtractedTxSeq = seqVal;
        }
      } else {
        allTxCanonical = false;
        const legacyMatch =
          /^TX-D\d+-(\d+)$/.exec(idStr) || /^TX-(\d+)$/.exec(idStr);
        if (legacyMatch) {
          const legVal = Number(legacyMatch[1]);
          if (Number.isFinite(legVal) && legVal > maxExtractedTxSeq) {
            maxExtractedTxSeq = legVal;
          }
        }
      }
    }

    const hasValidTxSeq =
      typeof state.transactionSequence === 'number' &&
      Number.isFinite(state.transactionSequence) &&
      state.transactionSequence >= 0;

    const existingTxSeq = hasValidTxSeq
      ? Math.floor(state.transactionSequence!)
      : 0;

    const txCount = rawTransactions.length;
    const needsTxMigration =
      !hasValidTxSeq ||
      duplicateTransactionsFixedCount > 0 ||
      !allTxCanonical;

    let migratedTransactions: TransactionRecord[];
    let nextTransactionSequence: number;

    if (needsTxMigration) {
      // Oluşum sırasına (en eski kayıt index = txCount - 1 -> 1, en yeni kayıt index = 0 -> txCount) göre yeniden kimliklendir
      migratedTransactions = rawTransactions.map((tx, idx) => {
        const formationSeq = txCount - idx;
        const txDay =
          typeof tx.day === 'number' && Number.isFinite(tx.day) && tx.day >= 1
            ? Math.floor(tx.day)
            : 1;
        return {
          ...tx,
          id: `TX-D${txDay}-S${String(formationSeq).padStart(8, '0')}`,
        };
      });
      nextTransactionSequence = Math.max(
        existingTxSeq,
        maxExtractedTxSeq,
        txCount
      );
    } else {
      migratedTransactions = rawTransactions.map((tx) => ({ ...tx }));
      nextTransactionSequence = Math.max(
        existingTxSeq,
        maxExtractedTxSeq,
        txCount
      );
    }

    // PendingOrders için aynı deterministik ve idempotent benzersizlik denetimi
    const rawOrders: PendingOrder[] = Array.isArray(state.pendingOrders)
      ? state.pendingOrders
      : [];
    const seenOrderIds = new Set<string>();
    let duplicateOrdersFixedCount = 0;
    let maxExtractedOrderSeq = 0;
    let allOrdersCanonical = true;

    for (const ord of rawOrders) {
      const idStr = typeof ord?.id === 'string' ? ord.id : '';
      if (!idStr || seenOrderIds.has(idStr)) {
        duplicateOrdersFixedCount += 1;
      } else {
        seenOrderIds.add(idStr);
      }

      const canonicalOrdMatch = /^ORD-D\d+-S(\d+)$/.exec(idStr);
      if (canonicalOrdMatch) {
        const seqVal = Number(canonicalOrdMatch[1]);
        if (Number.isFinite(seqVal) && seqVal > maxExtractedOrderSeq) {
          maxExtractedOrderSeq = seqVal;
        }
      } else {
        allOrdersCanonical = false;
        const legacyOrdMatch =
          /^ORD-D\d+-(\d+)$/.exec(idStr) || /^ORD-(\d+)$/.exec(idStr);
        if (legacyOrdMatch) {
          const legVal = Number(legacyOrdMatch[1]);
          if (Number.isFinite(legVal) && legVal > maxExtractedOrderSeq) {
            maxExtractedOrderSeq = legVal;
          }
        }
      }
    }

    const hasValidOrderSeq =
      typeof state.orderSequence === 'number' &&
      Number.isFinite(state.orderSequence) &&
      state.orderSequence >= 0;
    const existingOrderSeq = hasValidOrderSeq
      ? Math.floor(state.orderSequence!)
      : 0;
    const orderCount = rawOrders.length;
    const needsOrderMigration =
      !hasValidOrderSeq ||
      duplicateOrdersFixedCount > 0 ||
      !allOrdersCanonical;

    let migratedOrders: PendingOrder[];
    let nextOrderSequence: number;

    if (needsOrderMigration) {
      migratedOrders = rawOrders.map((ord, idx) => {
        const formationSeq = orderCount - idx;
        const ordDay =
          typeof ord.createdDay === 'number' &&
          Number.isFinite(ord.createdDay) &&
          ord.createdDay >= 1
            ? Math.floor(ord.createdDay)
            : 1;
        return {
          ...ord,
          id: `ORD-D${ordDay}-S${String(formationSeq).padStart(8, '0')}`,
        };
      });
      nextOrderSequence = Math.max(
        existingOrderSeq,
        maxExtractedOrderSeq,
        orderCount
      );
    } else {
      migratedOrders = rawOrders.map((ord) => ({ ...ord }));
      nextOrderSequence = Math.max(
        existingOrderSeq,
        maxExtractedOrderSeq,
        orderCount
      );
    }

    // NewsFeed içinde olası çakışmaları da idempotent biçimde denetle
    const rawNews: NewsEvent[] = Array.isArray(state.newsFeed)
      ? state.newsFeed
      : [];
    const seenNewsIds = new Set<string>();
    const migratedNews: NewsEvent[] = rawNews.map((n, idx) => {
      const baseId =
        typeof n?.id === 'string' && n.id
          ? n.id
          : `NEWS-D${n?.day ?? 1}-S${String(rawNews.length - idx).padStart(4, '0')}`;
      if (!seenNewsIds.has(baseId)) {
        seenNewsIds.add(baseId);
        return { ...n, id: baseId };
      }
      const dedupId = `${baseId}-S${String(rawNews.length - idx).padStart(4, '0')}`;
      seenNewsIds.add(dedupId);
      return { ...n, id: dedupId };
    });

    return {
      transactions: migratedTransactions,
      transactionSequence: nextTransactionSequence,
      pendingOrders: migratedOrders,
      orderSequence: nextOrderSequence,
      newsFeed: migratedNews,
      duplicateTransactionsFixedCount,
      duplicateOrdersFixedCount,
    };
  }

// ---------------------------------------------------------------------------
// KAYIT DOSYASI (dışa / içe aktarma) — SHA-256 kontrol kodlu JSON
// ---------------------------------------------------------------------------
// Dosya biçimi: { format, fileVersion, exportedAtISO, schemaVersion, day, checksum, payload }
//  - `payload`: kayıt zarfının JSON METNİ (nesne değil). Kontrol kodu bu metnin SHA-256'sıdır; böylece
//    dosya elle düzenlenirse ya da yarım inerse bayt bayt farkı yakalanır (JSON biçimlendirmesine bağlı kalmaz).
//  - Hata mesajları oyuncuya gösterilir: Türkçe ve teknik terimsiz.

export const SAVE_FILE_FORMAT = 'borsa-holding-save';
export const SAVE_FILE_VERSION = 1;
/** Bu boyutun üstündeki dosya kayıt sayılmaz (yanlış dosya seçilmiş olabilir) */
export const SAVE_FILE_MAX_BYTES = 25 * 1024 * 1024;

export interface SaveFileEnvelopeLike {
  schemaVersion: number;
  seed: number;
  state: { day?: number };
}

export interface SaveFile {
  format: typeof SAVE_FILE_FORMAT;
  fileVersion: number;
  exportedAtISO: string;
  schemaVersion: number;
  day: number;
  checksum: string;
  payload: string;
}

export type SaveFileErrorCode =
  | 'EMPTY'
  | 'TOO_LARGE'
  | 'NOT_JSON'
  | 'NOT_A_SAVE'
  | 'NEWER_FILE_VERSION'
  | 'MISSING_PARTS'
  | 'CHECKSUM_MISMATCH'
  | 'PAYLOAD_UNREADABLE'
  | 'NO_CRYPTO';

export class SaveFileError extends Error {
  constructor(public readonly code: SaveFileErrorCode, message: string) {
    super(message);
    this.name = 'SaveFileError';
  }
}

/** Metnin SHA-256 özeti (küçük harf onaltılık). Tarayıcıda ve Node'da aynı WebCrypto kullanılır. */
export async function sha256Hex(text: string): Promise<string> {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) {
    throw new SaveFileError(
      'NO_CRYPTO',
      'Bu tarayıcı dosya doğrulamasını desteklemiyor (güvenli bağlantı gerekebilir). Kaydı dışa aktaramıyoruz.'
    );
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Kayıt zarfından indirilecek dosya metnini üretir. */
export async function buildSaveFileText(envelope: SaveFileEnvelopeLike, nowISO: string): Promise<string> {
  const payload = JSON.stringify(envelope);
  const file: SaveFile = {
    format: SAVE_FILE_FORMAT,
    fileVersion: SAVE_FILE_VERSION,
    exportedAtISO: nowISO,
    schemaVersion: envelope.schemaVersion,
    day: Math.floor(Number(envelope.state?.day ?? 1)),
    checksum: await sha256Hex(payload),
    payload,
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Dosya metnini doğrular ve kayıt zarfını döner. Sorun varsa anlaşılır Türkçe mesajlı `SaveFileError` fırlatır.
 * Zarfın oyun içi içeriği (şema göçü, alan onarımı) bu fonksiyonun işi değildir: çağıran `SimulationStore.migrateIfNeeded` kullanır.
 */
export async function parseSaveFileText(text: string): Promise<{ envelope: unknown; file: SaveFile }> {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new SaveFileError('EMPTY', 'Seçtiğin dosya boş. Oyundan dışa aktardığın kayıt dosyasını seç.');
  }
  if (text.length > SAVE_FILE_MAX_BYTES) {
    throw new SaveFileError('TOO_LARGE', 'Bu dosya bir oyun kaydı olamayacak kadar büyük. Doğru dosyayı seçtiğinden emin ol.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SaveFileError(
      'NOT_JSON',
      'Dosya okunamadı: kayıt dosyası değil ya da yarım inmiş. Oyundan dışa aktardığın dosyayı yeniden dene.'
    );
  }
  const f = parsed as Partial<SaveFile> | null;
  if (!f || typeof f !== 'object' || f.format !== SAVE_FILE_FORMAT) {
    throw new SaveFileError('NOT_A_SAVE', 'Bu dosya Borsa & Holding oyununun kayıt dosyası değil.');
  }
  if (typeof f.fileVersion !== 'number' || f.fileVersion > SAVE_FILE_VERSION) {
    throw new SaveFileError(
      'NEWER_FILE_VERSION',
      'Bu kayıt oyunun daha yeni bir sürümünden alınmış. Oyunu güncelleyip tekrar dene.'
    );
  }
  if (typeof f.payload !== 'string' || typeof f.checksum !== 'string' || f.payload.length === 0 || f.checksum.length === 0) {
    throw new SaveFileError('MISSING_PARTS', 'Kayıt dosyasının bir kısmı eksik. Dosya bozulmuş olabilir; yedekten dönmeyi dene.');
  }
  const actual = await sha256Hex(f.payload);
  if (actual !== f.checksum.toLowerCase()) {
    throw new SaveFileError(
      'CHECKSUM_MISMATCH',
      'Kayıt dosyası bozulmuş ya da elle değiştirilmiş (kontrol kodu uyuşmuyor). Mevcut oyunun değişmedi.'
    );
  }
  let envelope: unknown;
  try {
    envelope = JSON.parse(f.payload);
  } catch {
    throw new SaveFileError('PAYLOAD_UNREADABLE', 'Kayıt içeriği okunamadı. Mevcut oyunun değişmedi.');
  }
  return { envelope, file: f as SaveFile };
}

/** İndirilen dosyanın önerilen adı: borsa-oyunu-gun-42-2026-11-20.json */
export function saveFileName(day: number, nowISO: string): string {
  return `borsa-oyunu-gun-${Math.max(1, Math.floor(day))}-${nowISO.slice(0, 10)}.json`;
}
