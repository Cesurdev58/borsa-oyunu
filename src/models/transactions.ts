/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'CAPITAL_INJECTION'
  | 'COMPANY_FOUNDING'
  | 'COMPANY_LOAN'
  | 'IPO_PROCEEDS'
  | 'TAKEOVER_TENDER'
  | 'HOLDING_SYNERGY';

export type PendingOrderType =
  | 'MARKET_BUY'
  | 'MARKET_SELL'
  | 'LIMIT_BUY'
  | 'LIMIT_SELL';

export type PendingOrderSide = 'BUY' | 'SELL';

export type PendingOrderStatus =
  | 'PENDING'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED';

export interface PendingOrder {
  id: string;
  createdDay: number;
  createdGameMinute: number;
  ticker: string;
  orderType: PendingOrderType;
  side: PendingOrderSide;
  requestedShares: number;
  remainingShares: number;
  limitPrice?: number;
  status: PendingOrderStatus;
  executedShares: number;
  averageExecutionPrice: number;
  reservedCash: number;
  reservedShares: number;
  expiresAtDay: number;
  transactionIds: string[];
  rejectionReason?: string;
}

export interface TransactionRecord {
  id: string;
  day: number;
  type: TransactionType;
  ticker?: string;
  shares?: number;
  executionPrice?: number;
  grossAmount: number;
  commission: number;
  slippageBps: number;
  cashDelta: number;
  netWorthBefore: number;
  netWorthAfter: number;
  description: string;
}

export interface OrderExecutionResult {
  success: boolean;
  message: string;
  ticker: string;
  sharesExecuted: number;
  executionPrice: number;
  grossAmount: number;
  commission: number;
  slippageBps: number;
  totalCost: number;
  netProceeds: number;
  realizedPnL: number;
}
