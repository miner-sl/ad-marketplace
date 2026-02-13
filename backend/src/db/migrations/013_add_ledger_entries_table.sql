-- Ledger: store all financial transaction history
CREATE TABLE IF NOT EXISTS ledger_entries (
    id                  BIGSERIAL PRIMARY KEY,
    deal_id             INTEGER REFERENCES deals(id) ON DELETE SET NULL,
    from_address        VARCHAR(255),
    to_address          VARCHAR(255),
    amount          NUMERIC(20,9) NOT NULL CHECK (amount > 0),
    direction           VARCHAR(20) NOT NULL CHECK (direction IN ('in', 'out')),
    entry_type          VARCHAR(50) NOT NULL CHECK (entry_type IN (
        'payment_to_escrow',
        'release_to_owner',
        'refund_to_advertiser',
        'platform_fee',
    )),
    tx_hash             VARCHAR(255),
    confirmations       INTEGER DEFAULT 0,
    status              VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'failed', 'reversed'
    )),
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    confirmed_at        TIMESTAMPTZ,
    metadata            JSONB
);

CREATE INDEX IF NOT EXISTS idx_ledger_deal_id ON ledger_entries(deal_id);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_hash ON ledger_entries(tx_hash);
CREATE INDEX IF NOT EXISTS idx_ledger_from_address ON ledger_entries(from_address);
CREATE INDEX IF NOT EXISTS idx_ledger_to_address ON ledger_entries(to_address);
CREATE INDEX IF NOT EXISTS idx_ledger_entry_type ON ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_status ON ledger_entries(status);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries(created_at);
