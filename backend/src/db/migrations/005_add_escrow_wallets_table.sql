-- Migration: Add escrow_wallets table
-- Date: 2026-01-29
-- Description: Stores escrow wallet addresses and encrypted secret keys for deals

-- Create escrow_wallets table
CREATE TABLE IF NOT EXISTS escrow_wallets (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL UNIQUE,
    mnemonic_encrypted TEXT NOT NULL, -- Encrypted mnemonic phrase (24 words)
    secret_key_encrypted TEXT NOT NULL, -- Encrypted secret key (private key)
    public_key VARCHAR(255) NOT NULL, -- Public key for verification
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on deal_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_escrow_wallets_deal_id ON escrow_wallets(deal_id);

-- Create index on address for balance checks
CREATE INDEX IF NOT EXISTS idx_escrow_wallets_address ON escrow_wallets(address);

