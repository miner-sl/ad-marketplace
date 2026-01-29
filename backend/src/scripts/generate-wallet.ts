#!/usr/bin/env tsx
/**
 * Script to generate TON wallets
 * Usage:
 *   npm run wallet:generate
 *   npm run wallet:generate -- --count 5
 *   npm run wallet:generate -- --save
 *   npm run wallet:generate -- --network testnet
 */

import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import * as fs from 'fs';
import * as path from 'path';

interface WalletInfo {
  address: string;
  mnemonic: string;
  publicKey: string;
  workchain: number;
  network: 'mainnet' | 'testnet';
  createdAt: string;
}

/**
 * Generate a single TON wallet
 */
async function generateWallet(network: 'mainnet' | 'testnet' = 'testnet'): Promise<WalletInfo> {
  // Generate mnemonic (24 words for TON)
  const mnemonicArray = await mnemonicNew(24);
  
  // Convert mnemonic to wallet key
  const walletKey = await mnemonicToWalletKey(mnemonicArray);
  
  // Create wallet contract (V4 is the latest standard)
  const wallet = WalletContractV4.create({ 
    publicKey: walletKey.publicKey, 
    workchain: 0 
  });
  
  // Get address in different formats
  const address = wallet.address.toString({ 
    bounceable: false, 
    urlSafe: true 
  });
  
  return {
    address,
    mnemonic: mnemonicArray.join(' '),
    publicKey: walletKey.publicKey.toString('hex'),
    workchain: 0,
    network,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Format wallet info for display
 */
function formatWallet(wallet: WalletInfo, index?: number): string {
  const prefix = index !== undefined ? `\n${'='.repeat(60)}\nWallet #${index + 1}\n${'='.repeat(60)}\n` : '';
  
  return `${prefix}
📧 Address: ${wallet.address}
🔑 Public Key: ${wallet.publicKey}
🌐 Network: ${wallet.network}
⛓️  Workchain: ${wallet.workchain}
📅 Created: ${wallet.createdAt}

💬 Mnemonic (24 words):
${wallet.mnemonic}

⚠️  IMPORTANT: Keep this mnemonic phrase secure and private!
   Anyone with access to it can control the wallet.
`;
}

/**
 * Save wallets to JSON file
 */
function saveWallets(wallets: WalletInfo[], filename?: string): void {
  const outputDir = path.join(process.cwd(), 'wallets');
  
  // Create wallets directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filepath = path.join(
    outputDir, 
    filename || `wallets-${timestamp}.json`
  );
  
  // Save wallets (without mnemonic for security - only addresses)
  const safeWallets = wallets.map(w => ({
    address: w.address,
    publicKey: w.publicKey,
    workchain: w.workchain,
    network: w.network,
    createdAt: w.createdAt,
  }));
  
  fs.writeFileSync(filepath, JSON.stringify(safeWallets, null, 2));
  console.log(`\n✅ Wallets saved to: ${filepath}`);
  console.log(`⚠️  Note: Mnemonics are NOT saved to file for security reasons.`);
  console.log(`   Make sure to save the mnemonics displayed above separately!\n`);
  
  // Save mnemonics separately in a secure file
  const mnemonicFilepath = path.join(
    outputDir,
    filename ? filename.replace('.json', '-mnemonics.txt') : `mnemonics-${timestamp}.txt`
  );
  
  const mnemonicContent = wallets.map((w, i) => 
    `Wallet #${i + 1}\nAddress: ${w.address}\nMnemonic: ${w.mnemonic}\n${'='.repeat(60)}\n`
  ).join('\n');
  
  fs.writeFileSync(mnemonicFilepath, mnemonicContent);
  console.log(`🔐 Mnemonics saved to: ${mnemonicFilepath}`);
  console.log(`⚠️  SECURITY WARNING: This file contains sensitive information!`);
  console.log(`   Delete it after securely storing the mnemonics!\n`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const count = parseInt(args.find(arg => arg.startsWith('--count='))?.split('=')[1] || '1');
  const save = args.includes('--save');
  const network = args.includes('--mainnet') ? 'mainnet' : 'testnet';
  const help = args.includes('--help') || args.includes('-h');
  
  if (help) {
    console.log(`
TON Wallet Generator

Usage:
  npm run wallet:generate [options]

Options:
  --count=N          Generate N wallets (default: 1)
  --save             Save wallets to file
  --mainnet          Generate for mainnet (default: testnet)
  --testnet          Generate for testnet (default)
  --help, -h         Show this help message

Examples:
  npm run wallet:generate
  npm run wallet:generate -- --count=5
  npm run wallet:generate -- --save
  npm run wallet:generate -- --count=3 --save --mainnet
`);
    process.exit(0);
  }
  
  if (count < 1 || count > 100) {
    console.error('❌ Error: Count must be between 1 and 100');
    process.exit(1);
  }
  
  console.log(`\n🚀 Generating ${count} TON wallet(s) for ${network}...\n`);
  
  try {
    const wallets: WalletInfo[] = [];
    
    for (let i = 0; i < count; i++) {
      const wallet = await generateWallet(network);
      wallets.push(wallet);
      console.log(formatWallet(wallet, count > 1 ? i : undefined));
    }
    
    if (save) {
      saveWallets(wallets);
    } else {
      console.log('\n💡 Tip: Use --save flag to save wallets to file');
    }
    
    console.log(`\n✅ Successfully generated ${count} wallet(s)!\n`);
    
  } catch (error: any) {
    console.error('❌ Error generating wallet:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { generateWallet, WalletInfo };
