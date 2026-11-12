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
