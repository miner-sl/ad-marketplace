/**
 * Script to transfer funds from escrow wallet to recipient address
 *
 * Usage:
 *   npm run wallet:transfer -- --deal-id=123 --recipient=EQD...xyz --amount=10.5
 *   npm run wallet:transfer -- --deal-id=123 --user-id=456 --amount=10.5
 */

import * as dotenv from 'dotenv';
import { TONService } from '../services/ton';
import db from '../db/connection';
import { UserModel } from '../models/User';
import { Address, toNano, fromNano, internal, beginCell } from '@ton/core';
import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient } from '@ton/ton';
import logger from '../utils/logger';

dotenv.config();

/**
 * Retry function with exponential backoff for rate limiting (429 errors)
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  initialDelayMs: number = 2000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error (429) or network error
      const isRateLimit = error.response?.status === 429 ||
                         error.status === 429 ||
                         error.message?.includes('429') ||
                         error.message?.includes('rate limit') ||
                         error.message?.includes('Too Many Requests');

      // For rate limit errors, use longer delays
      if (isRateLimit && attempt < maxRetries - 1) {
        const waitTime = initialDelayMs * Math.pow(backoffMultiplier, attempt);
        logger.warn(`Rate limit hit, retrying after ${waitTime}ms`, {
          attempt: attempt + 1,
          maxRetries,
          waitTime,
          error: error.message,
        });
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // For other errors, use shorter delays
      if (attempt < maxRetries - 1) {
        const waitTime = initialDelayMs * Math.pow(backoffMultiplier, attempt);
        logger.warn(`Request failed, retrying after ${waitTime}ms`, {
          attempt: attempt + 1,
          maxRetries,
          waitTime,
          error: error.message,
        });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error('Retry failed after all attempts');
}

/**
 * Transfer TON from one address to another using mnemonic key
 * @param fromAddress Source wallet address
 * @param toAddress Destination wallet address
 * @param amount Amount in TON (e.g., "10.5")
 * @param comment Optional transaction comment
 * @param fromMnemonicKey Mnemonic phrase (24 words) for the source wallet
 * @returns Transaction hash
 */
async function transferTon(
  fromAddress: string,
  toAddress: string,
  amount: string,
  comment: string | undefined,
  fromMnemonicKey: string
): Promise<string> {
  try {
    if (!TONService.isValidAddress(fromAddress)) {
      throw new Error(`Invalid from address: ${fromAddress}`);
    }

    if (!TONService.isValidAddress(toAddress)) {
      throw new Error(`Invalid to address: ${toAddress}`);
    }

    const toAddr = Address.parse(toAddress);

    const amountNano = toNano(amount);

    const mnemonicArray = fromMnemonicKey.trim().split(/\s+/);
    if (mnemonicArray.length !== 24) {
      throw new Error('Mnemonic must be 24 words');
    }

    const walletKey = await mnemonicToWalletKey(mnemonicArray);

    const isMainnet = process.env.TON_NETWORK === 'mainnet';
    const endpoint = isMainnet
      ? process.env.TON_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC'
      : process.env.TON_RPC_URL || 'https://testnet.toncenter.com/api/v2/jsonRPC';

    logger.info(`Initializing TonClient`, {
      endpoint,
      hasApiKey: !!process.env.TON_API_KEY,
      network: isMainnet ? 'mainnet' : 'testnet',
    });

    const client = new TonClient({
      endpoint,
      apiKey: process.env.TON_API_KEY,
    });

    const wallet = WalletContractV4.create({
      publicKey: walletKey.publicKey,
      workchain: 0,
    });

    const walletAddress = wallet.address.toString({ bounceable: false, urlSafe: true });
    if (walletAddress !== fromAddress) {
      throw new Error(
        `Wallet address mismatch. Expected: ${fromAddress}, ` +
        `Got: ${walletAddress}. Mnemonic may be incorrect.`
      );
    }

    const walletContract = client.open(wallet);

    logger.info(`Connecting to wallet`, {
      address: fromAddress,
      network: isMainnet ? 'mainnet' : 'testnet',
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    const balance = await retryWithBackoff(
      () => walletContract.getBalance(),
      5, // max retries
      2000, // initial delay 2 seconds
      2 // backoff multiplier
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    const seqno = await retryWithBackoff(
      () => walletContract.getSeqno(),
      5, // max retries
      2000, // initial delay 2 seconds
      2 // backoff multiplier
    );

    logger.info(`Wallet state`, {
      address: fromAddress,
      balance: balance.toString(),
      balanceTON: fromNano(balance),
      seqno,
    });

    if (balance < amountNano) {
      throw new Error(
        `Insufficient balance. Required: ${amount} TON (${amountNano.toString()} nanoTON), ` +
        `Available: ${fromNano(balance)} TON (${balance.toString()} nanoTON)`
      );
    }

    const transfer = walletContract.createTransfer({
      secretKey: walletKey.secretKey,
      messages: [
        internal({
          to: toAddr,
          value: amountNano,
          body: comment ? beginCell().storeUint(0, 32).storeStringTail(comment).endCell() : undefined,
          bounce: false,
        }),
      ],
      seqno: seqno,
    });

    // Send transaction to blockchain
    logger.info(`Sending transaction`, {
      from: fromAddress,
      to: toAddress,
      amount: amount,
      amountNano: amountNano.toString(),
      seqno,
    });

    // Send the transfer transaction with retry logic
    await retryWithBackoff(
      () => walletContract.send(transfer),
      3, // max retries for send
      3000, // initial delay 3 seconds
      2 // backoff multiplier
    );

    logger.info(`Transaction sent successfully`, {
      fromAddress,
      toAddress,
      amount,
      amountNano: amountNano.toString(),
      seqno,
    });

    // Wait a bit for transaction to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to get the transaction hash from recent transactions
    let txHash: string;
    try {
      const transactions = await TONService.getTransactions(fromAddress, 1);
      if (transactions && transactions.length > 0 && transactions[0].transaction_id?.hash) {
        txHash = transactions[0].transaction_id.hash;
        logger.info(`Found transaction hash`, { txHash });
      } else {
        // Fallback: generate a reference hash based on timestamp
        txHash = `tx_${Date.now()}`;
        logger.warn(`Could not retrieve transaction hash, using reference`, { txHash });
      }
    } catch (error: any) {
      // Fallback if transaction lookup fails
      txHash = `tx_${Date.now()}`;
      logger.warn(`Transaction hash lookup failed, using reference`, {
        txHash,
        error: error.message,
      });
    }

    logger.info(`Transfer completed`, {
      fromAddress,
      toAddress,
      amount,
      amountNano: amountNano.toString(),
      txHash,
    });

    return txHash;
  } catch (error: any) {
    logger.error(`Failed to transfer TON`, {
      fromAddress,
      toAddress,
      amount,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to transfer TON: ${error.message}`);
  }
}

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
  const commentArg = `args.find(arg => arg.startsWith('--comment='))?.split('=')[1];`
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

    const txHash = await transferTon(
      escrowWallet.address,  // fromAddress
      recipientAddress,  // toAddress
      amountArg,       // amount in TON
      'Payment for deal', // optional comment
      escrowWallet.mnemonic// mnemonic phrase
    );
    // // Transfer funds from escrow wallet to recipient address
    // const txHash = await TONService.releaseFunds(
    //   dealId,
    //   recipientAddress,
    //   amountArg,
    //   commentArg || `Transfer from escrow wallet for Deal #${dealId}`
    // );

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


main();
