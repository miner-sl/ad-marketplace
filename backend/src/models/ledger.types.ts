export type LedgerDirection = 'in' | 'out';

export type LedgerEntryType =
  | 'payment_to_escrow'
  | 'release_to_owner'
  | 'refund_to_advertiser'
  | 'platform_fee';

export type LedgerEntryStatus = 'pending' | 'confirmed' | 'failed' | 'reversed';

export interface LedgerEntry {
  id: number;
  deal_id: number | null;
  from_address: string | null;
  to_address: string | null;
  amount_ton: string; // numeric from pg
  direction: LedgerDirection;
  entry_type: LedgerEntryType;
  tx_hash: string | null;
  confirmations: number;
  status: LedgerEntryStatus;
  created_at: Date;
  confirmed_at: Date | null;
  metadata: Record<string, unknown> | null;
}

export interface CreateLedgerEntryInput {
  deal_id?: number | null;
  from_address?: string | null;
  to_address?: string | null;
  amount_ton: number | string;
  direction: LedgerDirection;
  entry_type: LedgerEntryType;
  tx_hash?: string | null;
  confirmations?: number;
  status?: LedgerEntryStatus;
  metadata?: Record<string, unknown> | null;
}

export interface LedgerListFilters {
  deal_id?: number;
  from_address?: string;
  to_address?: string;
  entry_type?: LedgerEntryType;
  status?: LedgerEntryStatus;
  direction?: LedgerDirection;
  created_after?: Date | string;
  created_before?: Date | string;
  limit?: number;
  offset?: number;
}

/** Single row from findTransactionsByUserId (incoming + outgoing unified) */
export interface LedgerTransactionRow {
  type: 'Incoming' | 'Outgoing';
  from: string | null;
  to: string | null;
  amount: string; // numeric; negative for outgoing
  entry_type: LedgerEntryType;
  tx_hash: string | null;
  confirmed_at: Date | null;
  deal_id: number | null;
}

/** Result of findAnalyticsByUserId */
export interface LedgerAnalyticsByUser {
  total_received: string;
  total_sent: string;
  net_balance_change: string;
  transaction_count: string;
}
