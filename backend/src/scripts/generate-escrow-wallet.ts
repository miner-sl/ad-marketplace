#!/usr/bin/env tsx
/**
 * Script to generate escrow wallet for a specific deal
 * This uses the same logic as TONService.generateEscrowAddress()
 *
 * Usage:
 *   npm run wallet:escrow -- --deal-id 123
 *   npm run wallet:escrow -- --deal-id 123 --save
 */

import * as dotenv from 'dotenv';
import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import db from '../db/connection';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface EscrowWalletInfo {
  dealId: number;
  address: string;
  mnemonic: string;
  publicKey: string;
  secretKey: string;
  network: 'mainnet' | 'testnet';
  createdAt: string;
}

/**
 * Encryption key for storing secret keys
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ESCROW_ENCRYPTION_KEY || process.env.SECRET_KEY || 'default-key-change-in-production';
  if (key === 'default-key-change-in-production') {
    console.warn('⚠️  Warning: Using default encryption key! Change ESCROW_ENCRYPTION_KEY in production!');
  }
  const hash = crypto.createHash('sha256').update(key).digest();
  return Buffer.from(hash.slice(0, 32));
}

/**
 * Encrypt secret key for storage
 */
function encryptSecretKey(secretKey: Buffer): string {
  const algorithm = 'aes-256-cbc';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(secretKey);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Get network from environment variable (same as TONService)
 */
function getNetwork(): 'mainnet' | 'testnet' {
  return  'testnet';
  // return process.env.TON_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

/**
 * Generate escrow wallet for a deal
 */
async function generateEscrowWallet(dealId: number): Promise<EscrowWalletInfo> {
  const network = getNetwork();

  // Check if wallet already exists
  const existing = await db.query(
    'SELECT address FROM escrow_wallets WHERE deal_id = $1',
    [dealId]
  );

  if (existing.rows.length > 0) {
    console.log(`\n⚠️  Wallet already exists for Deal #${dealId}`);
    console.log(`   Address: ${existing.rows[0].address}\n`);

    // Retrieve and decrypt
    const walletData = await db.query(
      'SELECT address, mnemonic_encrypted, secret_key_encrypted, public_key FROM escrow_wallets WHERE deal_id = $1',
      [dealId]
    );

    const row = walletData.rows[0];
    const mnemonicBuffer = decryptSecretKey(row.mnemonic_encrypted);
    const mnemonic = mnemonicBuffer.toString('utf8');
    const secretKey = decryptSecretKey(row.secret_key_encrypted);

    return {
      dealId,
      address: row.address,
      mnemonic,
      publicKey: row.public_key,
      secretKey: secretKey.toString('hex'),
      network,
      createdAt: new Date().toISOString(),
    };
  }

  // Generate new wallet
  const mnemonicArray = await mnemonicNew(24);
  const walletKey = await mnemonicToWalletKey(mnemonicArray);
  const wallet = WalletContractV4.create({ publicKey: walletKey.publicKey, workchain: 0 });
  const address = wallet.address.toString({ bounceable: false, urlSafe: true });

  // Encrypt for storage
  const encryptedMnemonic = encryptSecretKey(Buffer.from(mnemonicArray.join(' '), 'utf8'));
  const encryptedSecretKey = encryptSecretKey(walletKey.secretKey);

  // Store in database
  await db.query(
    `INSERT INTO escrow_wallets (deal_id, address, mnemonic_encrypted, secret_key_encrypted, public_key)
     VALUES ($1, $2, $3, $4, $5)`,
    [dealId, address, encryptedMnemonic, encryptedSecretKey, walletKey.publicKey.toString('hex')]
  );

  return {
    dealId,
    address,
    mnemonic: mnemonicArray.join(' '),
    publicKey: walletKey.publicKey.toString('hex'),
    secretKey: walletKey.secretKey.toString('hex'),
    network,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Decrypt secret key from storage
 */
function decryptSecretKey(encrypted: string): Buffer {
  const algorithm = 'aes-256-cbc';
  const key = getEncryptionKey();

  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = Buffer.from(parts[1], 'hex');

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted;
}

/**
 * Get TONScan URL for wallet address
 */
function getTonscanUrl(address: string, network: 'mainnet' | 'testnet'): string {
  const baseUrl = network === 'mainnet'
    ? 'https://tonscan.org/address'
    : 'https://testnet.tonscan.org/address';
  return `${baseUrl}/${address}`;
}

/**
 * Format wallet info for display
 */
function formatEscrowWallet(wallet: EscrowWalletInfo): string {
  const tonscanUrl = getTonscanUrl(wallet.address, wallet.network);
  console.log(tonscanUrl, wallet)
  const networkLabel = wallet.network === 'mainnet' ? '🌐 Mainnet (Production)' : '🧪 Testnet';

  return `
${'='.repeat(60)}
Escrow Wallet for Deal #${wallet.dealId}
${'='.repeat(60)}

📧 Address: ${wallet.address}
🔗 TONScan: ${tonscanUrl}
${networkLabel}
🔑 Public Key: ${wallet.publicKey}
🔐 Secret Key: ${wallet.secretKey.substring(0, 32)}... (truncated)
📅 Created: ${wallet.createdAt}

💬 Mnemonic (24 words):
${wallet.mnemonic}

⚠️  SECURITY WARNING:
   - This wallet is stored encrypted in the database
   - Keep the mnemonic phrase secure and private
   - Anyone with access to it can control the wallet
   - This wallet is used for escrow transactions
`;
}

/**
 * Save wallet to file
 */
function saveEscrowWallet(wallet: EscrowWalletInfo): void {
  const outputDir = path.join(process.cwd(), 'wallets');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `escrow-deal-${wallet.dealId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(outputDir, filename);

  // Save full wallet info
  fs.writeFileSync(filepath, JSON.stringify(wallet, null, 2));
  console.log(`\n✅ Wallet saved to: ${filepath}`);
  console.log(`⚠️  SECURITY WARNING: This file contains sensitive information!`);
  console.log(`   Delete it after securely storing the mnemonic!\n`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  const dealIdArg = args.find(arg => arg.startsWith('--deal-id='))?.split('=')[1];
  const save = args.includes('--save');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Escrow Wallet Generator

Usage:
  npm run wallet:escrow -- --deal-id=N [options]

Options:
  --deal-id=N       Deal ID to generate escrow wallet for (required)
  --save            Save wallet to file
  --help, -h        Show this help message

Examples:
  npm run wallet:escrow -- --deal-id=123
  npm run wallet:escrow -- --deal-id=123 --save
`);
    process.exit(0);
  }

  if (!dealIdArg) {
    console.error('❌ Error: --deal-id is required');
    console.error('   Usage: npm run wallet:escrow -- --deal-id=123');
    process.exit(1);
  }

  const dealId = parseInt(dealIdArg);
  if (isNaN(dealId) || dealId < 1) {
    console.error('❌ Error: Deal ID must be a positive number');
    process.exit(1);
  }

  console.log(`\n🚀 Generating escrow wallet for Deal #${dealId}...\n`);

  try {
    const wallet = await generateEscrowWallet(dealId);
    console.log(formatEscrowWallet(wallet));

    if (save) {
      saveEscrowWallet(wallet);
    } else {
      console.log('\n💡 Tip: Use --save flag to save wallet to file');
    }

    console.log(`\n✅ Successfully generated escrow wallet!\n`);

  } catch (error: any) {
    console.error('❌ Error generating escrow wallet:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { generateEscrowWallet, EscrowWalletInfo };
