import db from '../db/connection';
import type {
  LedgerEntry,
  CreateLedgerEntryInput,
  LedgerListFilters,
  LedgerEntryStatus,
  LedgerTransactionRow,
  LedgerAnalyticsByUser,
} from '../models/ledger.types';

export class LedgerRepository {
  /**
   * Insert a new ledger entry.
   */
  static async create(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    const result = await db.query(
      `INSERT INTO ledger_entries (
        deal_id, from_address, to_address, amount_ton, direction, entry_type,
        tx_hash, confirmations, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        input.deal_id ?? null,
        input.from_address ?? null,
        input.to_address ?? null,
        input.amount_ton,
        input.direction,
        input.entry_type,
        input.tx_hash ?? null,
        input.confirmations ?? 0,
        input.status ?? 'pending',
        input.metadata != null ? JSON.stringify(input.metadata) : null,
      ]
    );
    return result.rows[0] as LedgerEntry;
  }

  /**
   * Find ledger entry by id.
   */
  static async findById(id: number): Promise<LedgerEntry | null> {
    const result = await db.query(
      'SELECT * FROM ledger_entries WHERE id = $1',
      [id]
    );
    return (result.rows[0] as LedgerEntry) ?? null;
  }

  /**
   * Find entries by deal id, newest first.
   */
  static async findByDealId(dealId: number, limit = 50): Promise<LedgerEntry[]> {
    const result = await db.query(
      `SELECT * FROM ledger_entries
       WHERE deal_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [dealId, limit]
    );
    return result.rows as LedgerEntry[];
  }

  /**
   * Find entry by transaction hash (e.g. to avoid duplicates or check confirmation).
   */
  static async findByTxHash(txHash: string): Promise<LedgerEntry | null> {
    const result = await db.query(
      'SELECT * FROM ledger_entries WHERE tx_hash = $1',
      [txHash]
    );
    return (result.rows[0] as LedgerEntry) ?? null;
  }

  /**
   * Find entries where the address is from_address or to_address (incoming/outgoing for a wallet).
   * direction 'in' = to_address = address; 'out' = from_address = address.
   */
  static async findByAddress(
    address: string,
    options: { limit?: number; offset?: number; direction?: 'in' | 'out' } = {}
  ): Promise<LedgerEntry[]> {
    const { limit = 50, offset = 0, direction } = options;
    let whereClause: string;
    if (direction === 'in') {
      whereClause = 'to_address = $1';
    } else if (direction === 'out') {
      whereClause = 'from_address = $1';
    } else {
      whereClause = '(from_address = $1 OR to_address = $1)';
    }
    const result = await db.query(
      `SELECT * FROM ledger_entries
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [address, limit, offset]
    );
    return result.rows as LedgerEntry[];
  }

  /**
   * List ledger entries with optional filters.
   */
  static async list(filters: LedgerListFilters = {}): Promise<LedgerEntry[]> {
    const {
      deal_id,
      from_address,
      to_address,
      entry_type,
      status,
      direction,
      created_after,
      created_before,
      limit = 50,
      offset = 0,
    } = filters;

    const conditions: string[] = ['1=1'];
    const params: (string | number | Date)[] = [];
    let paramIndex = 1;

    if (deal_id != null) {
      conditions.push(`deal_id = $${paramIndex++}`);
      params.push(deal_id);
    }
    if (from_address != null && from_address !== '') {
      conditions.push(`from_address = $${paramIndex++}`);
      params.push(from_address);
    }
    if (to_address != null && to_address !== '') {
      conditions.push(`to_address = $${paramIndex++}`);
      params.push(to_address);
    }
    if (entry_type != null) {
      conditions.push(`entry_type = $${paramIndex++}`);
      params.push(entry_type);
    }
    if (status != null) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (direction != null) {
      conditions.push(`direction = $${paramIndex++}`);
      params.push(direction);
    }
    if (created_after != null) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(created_after instanceof Date ? created_after : new Date(created_after));
    }
    if (created_before != null) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(created_before instanceof Date ? created_before : new Date(created_before));
    }

    params.push(limit, offset);
    const result = await db.query(
      `SELECT * FROM ledger_entries
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    return result.rows as LedgerEntry[];
  }

  /**
   * Update status (and optionally confirmed_at) for an entry.
   */
  static async updateStatus(
    id: number,
    status: LedgerEntryStatus,
    confirmedAt?: Date | null
  ): Promise<LedgerEntry | null> {
    const result = await db.query(
      `UPDATE ledger_entries
       SET status = $1, confirmed_at = COALESCE($2, confirmed_at)
       WHERE id = $3
       RETURNING *`,
      [status, confirmedAt ?? null, id]
    );
    return (result.rows[0] as LedgerEntry) ?? null;
  }

  /**
   * Update confirmations count (e.g. after blockchain confirmation).
   */
  static async updateConfirmations(id: number, confirmations: number): Promise<LedgerEntry | null> {
    const result = await db.query(
      `UPDATE ledger_entries SET confirmations = $1 WHERE id = $2 RETURNING *`,
      [confirmations, id]
    );
    return (result.rows[0] as LedgerEntry) ?? null;
  }

  /**
   * Find all confirmed transactions for a user (incoming and outgoing by wallet_address).
   * Returns unified rows with type 'Incoming' | 'Outgoing'; amount is negative for outgoing.
   */
  static async findTransactionsByUserId(userId: number): Promise<LedgerTransactionRow[]> {
    const result = await db.query(
      `SELECT
          'Incoming' AS type,
          from_address AS "from",
          NULL::varchar AS "to",
          amount,
          entry_type,
          tx_hash,
          confirmed_at,
          deal_id
       FROM ledger_entries
       WHERE to_address = (SELECT wallet_address FROM users WHERE id = $1)
         AND status = 'confirmed'

       UNION ALL

       SELECT
          'Outgoing' AS type,
          NULL::varchar AS "from",
          to_address AS "to",
          amount * -1 AS amount,
          entry_type,
          tx_hash,
          confirmed_at,
          deal_id
       FROM ledger_entries
       WHERE from_address = (SELECT wallet_address FROM users WHERE id = $1)
         AND status = 'confirmed'

       ORDER BY confirmed_at DESC NULLS LAST`,
      [userId]
    );
    return result.rows as LedgerTransactionRow[];
  }

  /**
   * Aggregate analytics for a user's confirmed ledger activity (by wallet_address).
   */
  static async findAnalyticsByUserId(
    userId: number,
    options?: { since?: Date }
  ): Promise<LedgerAnalyticsByUser | null> {
    let dateFilter = '';
    const params: (number | Date)[] = [userId];
    if (options?.since) {
      dateFilter = `AND le.confirmed_at >= $2`;
      params.push(options.since);
    }
    const result = await db.query(
      `SELECT
          COALESCE(SUM(CASE WHEN le.to_address = u.wallet_address THEN le.amount ELSE 0 END), 0)::text AS total_received,
          COALESCE(SUM(CASE WHEN le.from_address = u.wallet_address THEN le.amount ELSE 0 END), 0)::text AS total_sent,
          COALESCE(SUM(
              CASE WHEN le.to_address = u.wallet_address THEN le.amount
                   WHEN le.from_address = u.wallet_address THEN -le.amount
                   ELSE 0 END
          ), 0)::text AS net_balance_change,
          COUNT(*)::text AS transaction_count
       FROM ledger_entries le
       JOIN users u ON u.wallet_address IN (le.from_address, le.to_address)
       WHERE u.id = $1
         AND le.status = 'confirmed'
         ${dateFilter}`,
      params
    );
    const row = result.rows[0];
    if (!row) return null;
    return row as LedgerAnalyticsByUser;
  }
}
