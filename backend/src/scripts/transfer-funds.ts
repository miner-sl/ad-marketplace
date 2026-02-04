/**
 * Script to transfer funds from escrow wallet to recipient address
 *
 * Usage:
 *   npm run wallet:transfer -- --deal-id=123 --recipient=EQD...xyz --amount=10.5
 *   npm run wallet:transfer -- --deal-id=123 --user-id=456 --amount=10.5
 */

import * as dotenv from 'dotenv';
import { TONService } from '../services/ton.service';
import db from '../db/connection';
import { UserModel } from '../repositories/user.repository';

dotenv.config();

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  // const dealIdArg = args.find(arg => arg.startsWith('--deal-id='))?.split('=')[1];
  // const recipientArg = args.find(arg => arg.startsWith('--recipient='))?.split('=')[1];
  // const userIdArg = args.find(arg => arg.startsWith('--user-id='))?.split('=')[1];
  // const amountArg = args.find(arg => arg.startsWith('--amount='))?.split('=')[1];
  const dealIdArg = '1';
  const recipientArg = '0QBLNA2hN1mShvj57OnEqFKbHaW5TGssz7pbdXVFZHDhnfIM';
  const amountArg = '0.01';
  const userIdArg = undefined;
  // const commentArg = `args.find(arg => arg.startsWith('--comment='))?.split('=')[1];`
  const commentArg = undefined;
  const help = args.includes('--help') || args.includes('-h');
  const isMainnet = process.env.TON_NETWORK === 'mainnet';

  if (help) {
    console.log(`
Transfer Funds from Escrow Wallet

Usage:
  npm run wallet:transfer -- --deal-id=N --recipient=ADDRESS --amount=AMOUNT [options]
  npm run wallet:transfer -- --deal-id=N --user-id=USER_ID --amount=AMOUNT [options]

Options:
  --deal-id=N       Deal ID (required)
  --recipient=ADDR  Recipient TON address (required if --user-id not provided)
  --user-id=ID      User ID - will use user's wallet_address (required if --recipient not provided)
  --amount=AMOUNT   Amount in TON (required, e.g., "10.5")
  --comment=TEXT    Optional transaction comment
  --help, -h        Show this help message

Examples:
  npm run wallet:transfer -- --deal-id=123 --recipient=EQD...xyz --amount=25.5
  npm run wallet:transfer -- --deal-id=123 --user-id=456 --amount=25.5
  npm run wallet:transfer -- --deal-id=123 --user-id=456 --amount=25.5 --comment="Payment for Deal #123"
`);
    process.exit(0);
  }

  if (!dealIdArg) {
    console.error('❌ Error: --deal-id is required');
    console.error('   Usage: npm run wallet:transfer -- --deal-id=123 --recipient=EQD...xyz --amount=10.5');
    process.exit(1);
  }

  if (!amountArg) {
    console.error('❌ Error: --amount is required');
    process.exit(1);
  }

  const dealId = parseInt(dealIdArg);
  if (isNaN(dealId) || dealId < 1) {
    console.error('❌ Error: Deal ID must be a positive number');
    process.exit(1);
  }

  const amount = parseFloat(amountArg);
  if (isNaN(amount) || amount <= 0) {
    console.error('❌ Error: Amount must be a positive number');
    process.exit(1);
  }

  let recipientAddress: string;

  if (recipientArg) {
    recipientAddress = recipientArg;
  } else if (userIdArg) {
    const userId = parseInt(userIdArg);
    if (isNaN(userId) || userId < 1) {
      console.error('❌ Error: User ID must be a positive number');
      process.exit(1);
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      console.error(`❌ Error: User #${userId} not found`);
      process.exit(1);
    }

    if (!user.wallet_address) {
      console.error(`❌ Error: User #${userId} does not have a wallet_address set`);
      process.exit(1);
    }

    recipientAddress = user.wallet_address;
    console.log(`\n📧 Using wallet address for User #${userId}: ${recipientAddress}\n`);
  } else {
    console.error('❌ Error: Either --recipient or --user-id must be provided');
    process.exit(1);
  }

  // Validate recipient address
  if (!TONService.isValidAddress(recipientAddress)) {
    console.error(`❌ Error: Invalid recipient address: ${recipientAddress}`);
    process.exit(1);
  }

  console.log(`\n🚀 Transferring funds from escrow wallet...\n`);
  console.log(`   Deal ID: ${dealId}`);
  console.log(`   Recipient: ${recipientAddress}`);
  console.log(`   Amount: ${amount} TON`);
  if (commentArg) {
    console.log(`   Comment: ${commentArg}`);
  }
  console.log('');

  try {
    const escrowWallet = await TONService.getEscrowWallet(dealId);
    if (!escrowWallet) {
      console.error(`❌ Error: Escrow wallet not found for Deal #${dealId}`);
      console.error('   Make sure the deal has an escrow wallet generated.');
      console.error(`   Run: npm run wallet:escrow -- --deal-id=${dealId}`);
      process.exit(1);
    }

    console.log(escrowWallet)
    console.log(`📧 Escrow wallet address: ${escrowWallet.address}`);

    // Check balance before transfer
    const balance = await TONService.getBalance(escrowWallet.address);
    const balanceNano = BigInt(balance);
    const amountNano = BigInt(Math.floor(parseFloat(amountArg) * 1e9));

    const balanceTON = Number(balance) / 1e9;
    console.log(`💰 Escrow wallet balance: ${balanceTON} TON`);

    if (balanceNano < amountNano) {
      console.error(`\n❌ Error: Insufficient balance`);
      console.error(`   Required: ${amount} TON (${amountNano.toString()} nanoTON)`);
      console.error(`   Available: ${balanceTON} TON (${balance.toString()} nanoTON)`);
      console.error(`   Shortfall: ${(amount - balanceTON).toFixed(9)} TON\n`);
      process.exit(1);
    }

    console.log(`\n📤 Initiating transfer...`);
    console.log(`   From: ${escrowWallet.address}`);
    console.log(`   To: ${recipientAddress}`);
    console.log(`   Amount: ${amount} TON\n`);

    // Transfer funds using TONService.transferTon
    const txHash = await TONService.transferTon(
      escrowWallet.address,
      recipientAddress,
      amountArg,
      commentArg || `Transfer from escrow wallet for Deal #${dealId}`,
      escrowWallet.mnemonic
    );

    console.log(`\n✅ Funds transferred successfully!`);
    console.log(`   Transaction Hash: ${txHash}`);
    console.log(`   Amount: ${amount} TON`);
    console.log(`   From: ${escrowWallet.address}`);
    console.log(`   To: ${recipientAddress}\n`);

    const network = isMainnet ? 'mainnet' : 'testnet';
    const tonscanBase = network === 'mainnet'
      ? 'https://tonscan.org'
      : 'https://testnet.tonscan.org';

    console.log(`🔗 View transaction: ${tonscanBase}/tx/${txHash}`);
    console.log(`🔗 View escrow wallet: ${tonscanBase}/address/${escrowWallet.address}`);
    console.log(`🔗 View recipient wallet: ${tonscanBase}/address/${recipientAddress}\n`);

  } catch (error: any) {
    console.error('\n❌ Error transferring funds:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}


void main();
