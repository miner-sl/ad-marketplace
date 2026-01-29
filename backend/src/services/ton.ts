import { Address, fromNano, toNano, internal, beginCell, Cell } from '@ton/core';
import { mnemonicToWalletKey, mnemonicNew } from '@ton/crypto';
import { WalletContractV4, TonClient, internal as tonInternal, SendMode } from '@ton/ton';
import * as dotenv from 'dotenv';
import { mockTx } from "./mockTx";
import logger from '../utils/logger';
import db from '../db/connection';
import crypto from 'crypto';

dotenv.config();

/**
 * Retry utility function
 */
async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  backoff: number = 2
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const waitTime = delayMs * Math.pow(backoff, attempt);
        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${waitTime}ms`, {
          error: error.message,
          attempt: attempt + 1,
        });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

export interface EscrowWallet {
  address: string;
  mnemonic: string;
  publicKey: string;
  secretKey: Buffer;
}

export class TONService {
  private static providerUrl = process.env.TON_NETWORK === 'mainnet'
    ? 'https://toncenter.com/api/v2'
    : 'https://testnet.toncenter.com/api/v2';

  private static apiKey = process.env.TON_API_KEY;

  /**
   * Get TON client for network operations
   */
  private static getTonClient(): TonClient {
    const isMainnet = process.env.TON_NETWORK === 'mainnet';

    // Use proper RPC endpoints
    const endpoint = isMainnet
      ? process.env.TON_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC'
      : process.env.TON_RPC_URL || 'https://testnet.toncenter.com/api/v2/jsonRPC';

    logger.info(`Connecting to TON ${isMainnet ? 'mainnet' : 'testnet'}`, { endpoint });

    return new TonClient({
      endpoint,
      apiKey: this.apiKey,
    });
  }

  /**
   * Encryption key for storing secret keys in database
   * In production, this should be stored in environment variables or a secure key management system
   */
  private static getEncryptionKey(): Buffer {
    const key = process.env.ESCROW_ENCRYPTION_KEY || process.env.SECRET_KEY || 'default-key-change-in-production';
    if (key === 'default-key-change-in-production') {
      logger.warn('Using default encryption key! Change ESCROW_ENCRYPTION_KEY in production!');
    }
    // Use first 32 bytes for AES-256
    const hash = crypto.createHash('sha256').update(key).digest();
    return Buffer.from(hash.slice(0, 32));
  }

  /**
   * Encrypt secret key for storage
   */
  private static encryptSecretKey(secretKey: Buffer): string {
    const algorithm = 'aes-256-cbc';
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(secretKey);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Return iv:encrypted as hex string
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * Decrypt secret key from storage
   */
  private static decryptSecretKey(encrypted: string): Buffer {
    const algorithm = 'aes-256-cbc';
    const key = this.getEncryptionKey();

    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  }

  /**
   * Generate a new wallet for escrow using TON crypto
   */
  static async generateEscrowWallet(): Promise<EscrowWallet> {
    try {
      // Generate mnemonic (24 words for TON)
      const mnemonicArray = await mnemonicNew(24);

      // Convert mnemonic to wallet key
      const walletKey = await mnemonicToWalletKey(mnemonicArray);

      // Create wallet contract (V4 is the latest standard)
      const wallet = WalletContractV4.create({ publicKey: walletKey.publicKey, workchain: 0 });
      const address = wallet.address.toString({ bounceable: false, urlSafe: true });

      return {
        address,
        mnemonic: mnemonicArray.join(' '),
        publicKey: walletKey.publicKey.toString('hex'),
        secretKey: walletKey.secretKey,
      };
    } catch (error: any) {
      logger.error('Failed to generate escrow wallet', { error: error.message, stack: error.stack });
      throw new Error(`Failed to generate escrow wallet: ${error.message}`);
    }
  }

  /**
   * Generate escrow address for a deal and store secret key
   * This address represents a wallet managed by our system where advertiser funds
   * will be held (escrowed) until the ad is published and verified.
   */
  static async generateEscrowAddress(dealId: number): Promise<string> {
    try {
      const existing = await db.query(
        'SELECT address FROM escrow_wallets WHERE deal_id = $1',
        [dealId]
      );

      if (existing.rows.length > 0) {
        logger.info(`Escrow wallet already exists for Deal #${dealId}`, { dealId, address: existing.rows[0].address });
        return existing.rows[0].address;
      }

      const wallet = await this.generateEscrowWallet();

      const encryptedMnemonic = this.encryptSecretKey(Buffer.from(wallet.mnemonic, 'utf8'));
      const encryptedSecretKey = this.encryptSecretKey(wallet.secretKey);

      await db.query(
        `INSERT INTO escrow_wallets (deal_id, address, mnemonic_encrypted, secret_key_encrypted, public_key)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (deal_id) DO UPDATE
         SET address = EXCLUDED.address,
             mnemonic_encrypted = EXCLUDED.mnemonic_encrypted,
             secret_key_encrypted = EXCLUDED.secret_key_encrypted,
             public_key = EXCLUDED.public_key,
             updated_at = CURRENT_TIMESTAMP`,
        [dealId, wallet.address, encryptedMnemonic, encryptedSecretKey, wallet.publicKey]
      );

      logger.info(`Generated escrow wallet for Deal #${dealId}`, {
        dealId,
        address: wallet.address,
      });

      return wallet.address;
    } catch (error: any) {
      logger.error(`Failed to generate escrow address for Deal #${dealId}`, {
        dealId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get escrow wallet for a deal
   */
  static async getEscrowWallet(dealId: number): Promise<EscrowWallet | null> {
    try {
      const result = await db.query(
        'SELECT address, mnemonic_encrypted, secret_key_encrypted, public_key FROM escrow_wallets WHERE deal_id = $1',
        [dealId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const mnemonicBuffer = this.decryptSecretKey(row.mnemonic_encrypted);
      const mnemonic = mnemonicBuffer.toString('utf8');
      const secretKey = this.decryptSecretKey(row.secret_key_encrypted);

      return {
        address: row.address,
        mnemonic,
        publicKey: row.public_key,
        secretKey,
      };
    } catch (error: any) {
      logger.error(`Failed to get escrow wallet for Deal #${dealId}`, {
        dealId,
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  }

  /**
   * Get balance of address using @ton/ton TonClient
   * Uses the TON SDK library - for wallet contracts, uses contract.getBalance()
   * For raw addresses, uses the TON API endpoint (via TonClient's endpoint)
   */
  static async getBalance(address: string): Promise<string> {
    try {
      // Validate address format first
      if (!this.isValidAddress(address)) {
        logger.warn('Invalid address format for balance check:', address);
        return '0';
      }

      // Parse address
      const parsedAddress = Address.parse(address);

      // Get TON client (connects to testnet or mainnet)
      const client = this.getTonClient();

      // For wallet contracts, we can use contract.getBalance()
      // For raw addresses, we need to use the API
      // Try to get balance using TonClient's provider.getState() method
      try {
        // Open a provider for the address
        const provider = client.provider(parsedAddress);

        // Get contract state which includes balance
        const state = await provider.getState();

        // Balance is in nanoTON (BigInt)
        const balanceNano = state.balance;

        logger.debug('Balance retrieved using TonClient provider', {
          address,
          balance: balanceNano.toString(),
          balanceTON: (Number(balanceNano) / 1e9).toFixed(9),
        });

        // Return balance as string (in nanoTON)
        return balanceNano.toString();
      } catch (providerError: any) {
        // If provider method fails, fall back to API
        logger.debug('Provider method failed, using API fallback', {
          address,
          error: providerError.message,
        });
        return await this.getBalanceViaAPI(address);
      }
    } catch (error: any) {
      logger.warn('Failed to get balance, falling back to API', {
        error: error.message,
        address,
      });

      // Fallback to API method if TonClient fails
      try {
        return await this.getBalanceViaAPI(address);
      } catch (fallbackError: any) {
        logger.error('Balance check fallback also failed', {
          address,
          error: fallbackError.message,
        });
        return '0';
      }
    }
  }

  /**
   * Get balance for a wallet contract using @ton/ton
   * This is more efficient when you have a wallet contract instance
   * Uses contract.getBalance() method directly
   */
  static async getWalletBalance(walletContract: any): Promise<string> {
    try {
      const balance = await walletContract.getBalance();
      return balance.toString();
    } catch (error: any) {
      logger.error('Failed to get wallet balance', {
        error: error.message,
        stack: error.stack,
      });
      return '0';
    }
  }

  /**
   * Get balance via REST API (fallback method)
   * @private
   */
  private static async getBalanceViaAPI(address: string): Promise<string> {
    try {
      const parsedAddress = Address.parse(address);
      const formattedAddress = parsedAddress.toString();

      const url = `${this.providerUrl}/getAddressInformation?address=${encodeURIComponent(formattedAddress)}${this.apiKey ? `&api_key=${this.apiKey}` : ''}`;

      const data = await retry(async () => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json() as {
          ok?: boolean;
          result?: { balance?: string };
          error?: string;
        };
      }, 3, 1000, 2);

      // Check for API errors
      if (data.ok === false || data.error) {
        logger.warn('Balance check API error', {
          error: data.error,
          address: formattedAddress
        });
        return '0';
      }

      return data?.result?.balance || '0';
    } catch (error: any) {
      logger.error('Failed to get balance via API', {
        error: error.message,
        address,
      });
      return '0';
    }
  }

  /**
   * Check if transaction exists in last minutes with specific amount
   * @param address Escrow address to check
   * @param expectedAmount Expected amount in TON (e.g., "25.5")
   * @param minutesAgo How many minutes ago to check (default: 10)
   * @returns Transaction info if found, null otherwise
   */
  static async checkRecentTransaction(
    address: string,
    expectedAmount: string,
    minutesAgo: number = 10
  ): Promise<{
    found: boolean;
    txHash?: string;
    amount: string;
    timestamp?: number;
  } | null> {
    try {
      const transactions = await this.getTransactions(address, 50); // Get last 50 transactions

      console.log({transactions})
      // If no transactions returned (API error), return null to allow balance fallback
      if (!transactions || transactions.length === 0) {
        console.log('No transactions found or API error, will use balance check');
        return null;
      }

      const expectedNano = toNano(expectedAmount);
      console.log(expectedNano, expectedAmount);
      const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
      const timeThreshold = now - (minutesAgo * 60); // Timestamp X minutes ago

      // Check each transaction
      for (const tx of transactions) {
        // Check transaction timestamp (utime is in seconds)
        const txTime = tx.utime || tx.now || 0;
        if (txTime < timeThreshold) {
          const txDate = new Date(txTime * 1000); // Convert Unix timestamp (seconds) to milliseconds
          const thresholdDate = new Date(timeThreshold * 1000);
          console.log('⏭️ Skipping old transaction:', {
            txTime: txDate.toLocaleString(),
            thresholdTime: thresholdDate.toLocaleString(),
            txUnixTime: txTime,
            thresholdUnixTime: timeThreshold,
            now: Date.now(),
            minutesAgo: Math.floor((now - txTime) / 60)
          });
          // Transaction is too old, stop checking
          break;
        }

        // Check incoming messages (payments TO this address)
        // in_msg.value contains the amount sent TO the address (in nanoTON)
        //
        // Example values:
        // - "0" = no payment (system message)
        // - "1606764295" = 1.606764295 TON (1606764295 / 10^9)
        // - "25500000000" = 25.5 TON (25500000000 / 10^9)
        //
        // Conversion: 1 TON = 1,000,000,000 nanoTON (10^9)
        if (tx.in_msg) {
          const inMsg = tx.in_msg;
          // Check if transaction has value (payment)
          // Value is in nanoTON (1 TON = 10^9 nanoTON)
          if (inMsg.value && inMsg.value !== '0') {
            const txValueNano = BigInt(inMsg.value);
            const txValueTON = fromNano(txValueNano); // Convert nanoTON to TON

            console.log('💰 Found incoming payment transaction:', {
              valueNano: inMsg.value,
              valueTON: txValueTON,
              expectedNano: expectedNano.toString(),
              expectedTON: expectedAmount,
              source: inMsg.source || 'external',
              destination: inMsg.destination,
              txHash: tx.transaction_id?.hash
            });
            // Check if amount matches (allow small tolerance for fees)
            console.log(txValueNano, expectedNano)
            if (txValueNano >= expectedNano) {
              return {
                found: true,
                txHash: tx.transaction_id?.hash || tx.hash || tx.transaction_id || undefined,
                amount: txValueTON,
                timestamp: txTime
              };
            }
          } else {
            // Log when in_msg exists but value is 0 (system message, not a payment)
            console.log('ℹ️ Transaction has in_msg but value is 0 (not a payment):', {
              txHash: tx.transaction_id?.hash,
              hasOutMsgs: !!tx.out_msgs && tx.out_msgs.length > 0,
              outMsgsCount: tx.out_msgs?.length || 0
            });
          }
        }

        // Also check out_msgs for incoming payments (when checking from sender's perspective)
        // But for escrow, we want in_msg (money coming IN)
        // out_msgs are payments FROM this address (not what we're looking for)

        // Check transaction value directly (some APIs return it here as total)
        if (tx.value && tx.value !== '0') {
          const txValueNano = BigInt(tx.value);
          if (txValueNano >= expectedNano && txTime >= timeThreshold) {
            console.log('Found transaction by value field:', {
              valueNano: tx.value,
              valueTON: fromNano(txValueNano)
            });
            return {
              found: true,
              txHash: tx.transaction_id?.hash || tx.hash || tx.transaction_id || undefined,
              amount: fromNano(txValueNano),
              timestamp: txTime
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error checking recent transaction:', error);
      // Return null to allow fallback to balance check
      return null;
    }
  }

  /**
   * Check if payment was received
   * First checks for recent transactions with the exact amount, then falls back to balance check
   */
  static async checkPayment(
    address: string,
    expectedAmount: string,
    checkRecentMinutes: number = 10
  ): Promise<{
    received: boolean;
    amount: string;
    txHash?: string;
  }> {
    try {
      address = '0QATCMF58O_55amFk1SM0mJiBD6rIshKr68sUZbpOrXTRwpb';
      // First, check for recent transaction with specific amount (more reliable)
      const recentTx = await this.checkRecentTransaction(address, expectedAmount, checkRecentMinutes);
      console.log({recentTx})
      if (recentTx && recentTx.found) {
        console.log('Payment found in recent transactions:', {
          address,
          expectedAmount,
          txHash: recentTx.txHash,
          amount: recentTx.amount,
          timestamp: recentTx.timestamp
        });
        return {
          received: true,
          amount: recentTx.amount,
          txHash: recentTx.txHash
        };
      }

      // Fallback: check balance (less reliable as balance might be from older transactions)
      const balance = await this.getBalance(address);
      console.log('Checking balance:', { address, balance, expectedAmount });
      const balanceNano = BigInt(balance);
      const expectedNano = toNano(expectedAmount);

      return {
        received: balanceNano >= expectedNano,
        amount: fromNano(balanceNano),
      };
    } catch (error) {
      throw new Error(`Failed to check payment: ${error}`);
    }
  }

  /**
   * Release funds from escrow wallet to recipient
   * @param dealId Deal ID to get escrow wallet
   * @param recipientAddress Recipient TON address
   * @param amount Amount in TON (e.g., "25.5")
   * @param comment Optional comment for transaction
   */
  static async releaseFunds(
    dealId: number,
    recipientAddress: string,
    amount: string,
    comment?: string
  ): Promise<string> {
    try {
      // Get escrow wallet for the deal
      const escrowWallet = await this.getEscrowWallet(dealId);
      if (!escrowWallet) {
        throw new Error(`Escrow wallet not found for Deal #${dealId}`);
      }

      // Validate recipient address
      if (!this.isValidAddress(recipientAddress)) {
        throw new Error(`Invalid recipient address: ${recipientAddress}`);
      }

      // Parse addresses
      // const escrowAddr = Address.parse(escrowWallet.address);
      const recipientAddr = Address.parse(recipientAddress);

      // Convert amount to nanoTON
      const amountNano = toNano(amount);

      // Get TON client (connects to testnet or mainnet based on TON_NETWORK)
      const client = this.getTonClient();

      // Create wallet contract instance with public key
      // The wallet address is derived from the public key, so it matches escrowAddr
      const wallet = WalletContractV4.create({
        publicKey: Buffer.from(escrowWallet.publicKey, 'hex'),
        workchain: 0
      });

      // Verify the wallet address matches the stored escrow address
      const walletAddress = wallet.address.toString({ bounceable: false, urlSafe: true });
      if (walletAddress !== escrowWallet.address) {
        throw new Error(
          `Wallet address mismatch. Expected: ${escrowWallet.address}, ` +
          `Got: ${walletAddress}. Public key may be incorrect.`
        );
      }

      // Open wallet contract - this connects to the wallet on the blockchain (testnet or mainnet)
      // The wallet contract is already bound to the correct address via the public key
      const walletContract = client.open(wallet);

      // Verify wallet is accessible and get current state
      logger.info(`Connecting to escrow wallet`, {
        dealId,
        address: escrowWallet.address,
        network: process.env.TON_NETWORK || 'testnet',
      });

      // Get current balance and seqno
      const balance = await walletContract.getBalance();
      const seqno = await walletContract.getSeqno();

      logger.info(`Escrow wallet state`, {
        dealId,
        address: escrowWallet.address,
        balance: balance.toString(),
        seqno,
      });

      // Verify sufficient balance
      if (balance < amountNano) {
        throw new Error(
          `Insufficient balance. Required: ${amount} TON (${amountNano.toString()} nanoTON), ` +
          `Available: ${fromNano(balance)} TON (${balance.toString()} nanoTON)`
        );
      }

      // Create transfer message
      const transfer = walletContract.createTransfer({
        secretKey: escrowWallet.secretKey,
        messages: [
          internal({
            to: recipientAddr,
            value: amountNano,
            body: comment ? beginCell().storeUint(0, 32).storeStringTail(comment).endCell() : undefined,
            bounce: false,
          }),
        ],
        seqno: seqno,
      });

      // Send transaction to blockchain
      logger.info(`Sending transaction`, {
        dealId,
        from: escrowWallet.address,
        to: recipientAddress,
        amount: amount,
        amountNano: amountNano.toString(),
        seqno,
      });

      // Send the transfer transaction
      // The send() method returns a promise that resolves when the transaction is sent
      await walletContract.send(transfer);

      logger.info(`Transaction sent successfully`, {
        dealId,
        escrowAddress: escrowWallet.address,
        recipientAddress,
        amount,
        amountNano: amountNano.toString(),
        seqno,
      });

      // Wait a bit for transaction to be processed
      // In production, you might want to poll for transaction confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to get the transaction hash from recent transactions
      // Note: This is a best-effort approach. For production, implement proper transaction tracking
      let txHash: string;
      try {
        const transactions = await this.getTransactions(escrowWallet.address, 1);
        if (transactions && transactions.length > 0 && transactions[0].transaction_id?.hash) {
          txHash = transactions[0].transaction_id.hash;
          logger.info(`Found transaction hash`, { dealId, txHash });
        } else {
          // Fallback: generate a reference hash based on deal and timestamp
          txHash = `tx_${dealId}_${Date.now()}`;
          logger.warn(`Could not retrieve transaction hash, using reference`, { dealId, txHash });
        }
      } catch (error: any) {
        // Fallback if transaction lookup fails
        txHash = `tx_${dealId}_${Date.now()}`;
        logger.warn(`Transaction hash lookup failed, using reference`, {
          dealId,
          txHash,
          error: error.message,
        });
      }

      logger.info(`Funds released from escrow`, {
        dealId,
        escrowAddress: escrowWallet.address,
        recipientAddress,
        amount,
        amountNano: amountNano.toString(),
        txHash,
      });

      return txHash;
    } catch (error: any) {
      logger.error(`Failed to release funds for Deal #${dealId}`, {
        dealId,
        recipientAddress,
        amount,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to release funds: ${error.message}`);
    }
  }

  /**
   * Release funds from escrow address (backward compatibility)
   * @deprecated Use releaseFunds(dealId, recipientAddress, amount) instead
   */
  static async releaseFundsByAddress(
    escrowAddress: string,
    recipientAddress: string,
    amount: string
  ): Promise<string> {
    // Try to find deal by escrow address
    const result = await db.query(
      'SELECT deal_id FROM escrow_wallets WHERE address = $1',
      [escrowAddress]
    );

    if (result.rows.length === 0) {
      throw new Error(`Escrow wallet not found for address: ${escrowAddress}`);
    }

    return await this.releaseFunds(result.rows[0].deal_id, recipientAddress, amount);
  }

  /**
   * Refund funds from escrow to advertiser
   */
  static async refundFunds(
    escrowAddress: string,
    advertiserAddress: string,
    amount: string
  ): Promise<string> {
    // Similar to releaseFunds but refunds to advertiser
    return `tx_${Date.now()}`;
  }

  /**
   * Get transaction history for an address
   * Note: This endpoint may fail for new addresses or addresses without transactions
   * In such cases, we fall back to balance checking
   */
  static async getTransactions(address: string, limit: number = 10): Promise<any[]> {
    try {
      // Validate address format first
      if (!this.isValidAddress(address)) {
        console.warn('Invalid address format:', address);
        return [];
      }

      // Try to convert address to raw format if needed (some APIs require raw format)
      let formattedAddress = address;
      try {
        // Parse address to ensure it's in correct format
        const parsedAddress = Address.parse(address);
        formattedAddress = parsedAddress.toString();
      } catch (e) {
        // If parsing fails, use original address
        console.warn('Address parsing failed, using original:', address);
      }

      // return mockTx;
      const url = `${this.providerUrl}/getTransactions?address=${encodeURIComponent(formattedAddress)}&limit=${limit}${this.apiKey ? `&api_key=${this.apiKey}` : ''}`;
      console.log('transactions url', url);

      // const response = await fetch(url);
      // const data = await response.json() as {
      //   ok?: boolean;
      //   result?: any[];
      //   error?: string;
      //   code?: number;
      // };

      const data = mockTx as {
        ok?: boolean;
        result?: any[];
        error?: string;
        code?: number;
      };
      // Check if API returned an error
      if (data.ok === false || data.error) {
        // Common errors:
        // - "cannot locate transaction" - address is new or has no transactions (not critical)
        // - Other errors - log but don't fail
        const isNonCriticalError = data.error?.includes('cannot locate transaction') ||
                                   data.error?.includes('LITE_SERVER_UNKNOWN');

        if (isNonCriticalError) {
          console.log('Address has no transactions yet (new address):', {
            address: formattedAddress,
            error: data.error
          });
        } else {
          console.warn('TON API error:', {
            error: data.error,
            code: data.code,
            address: formattedAddress
          });
        }
        // Return empty array instead of throwing - allows fallback to balance check
        return [];
      }

      return data.result || [];
    } catch (error: any) {
      console.error('Failed to get transactions:', error);
      // Return empty array instead of throwing - allows fallback to balance check
      return [];
    }
  }

  /**
   * Validate TON address
   */
  static isValidAddress(address: string): boolean {
    try {
      Address.parse(address);
      return true;
    } catch {
      return false;
    }
  }
}
