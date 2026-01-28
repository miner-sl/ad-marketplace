import { Address, fromNano, toNano } from '@ton/core';
import * as dotenv from 'dotenv';
import {mockTx} from "./mockTx";
import logger from '../utils/logger';

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
}

export class TONService {
  private static providerUrl = process.env.TON_NETWORK === 'mainnet'
    ? 'https://toncenter.com/api/v2'
    : 'https://testnet.toncenter.com/api/v2';

  private static apiKey = process.env.TON_API_KEY;

  /**
   * Generate a new wallet for escrow
   */
  static async generateEscrowWallet(): Promise<EscrowWallet> {
    // Generate random mnemonic
    const { randomBytes } = await import('crypto');
    const mnemonic: string[] = [];
    // Simplified - in production use proper mnemonic generation
    // For MVP, we'll use a deterministic approach based on deal ID

    // This is a placeholder - proper implementation would use @ton/crypto mnemonic generation
    return {
      address: '', // Would be generated from mnemonic
      mnemonic: mnemonic.join(' '),
    };
  }

  /**
   * Generate escrow address for a deal
   * This address represents a wallet managed by our system where advertiser funds
   * will be held (escrowed) until the ad is published and verified.
   *
   * For MVP: Uses deterministic approach based on deal ID
   * In production: Should generate a new unique wallet per deal or use a smart contract
   *
   * The wallet is controlled by our system and funds are released to channel owner
   * only after successful ad publication and verification.
   */
  static async generateEscrowAddress(dealId: number): Promise<string> {
    // For MVP, we'll use a simplified approach
    // In production, generate a new wallet per deal or use a smart contract

    // Placeholder - would generate actual TON address
    // Using deal ID to create deterministic address for testing
    // TODO: Replace with actual wallet generation using @ton/crypto
    return `EQ${dealId.toString().padStart(44, '0')}`;
  }

  /**
   * Check balance of escrow address
   */
  static async getBalance(address: string): Promise<string> {
    try {
      // Validate address format first
      if (!this.isValidAddress(address)) {
        console.warn('Invalid address format for balance check:', address);
        return '0';
      }

      // Try to convert address to raw format if needed
      let formattedAddress = address;
      try {
        const parsedAddress = Address.parse(address);
        formattedAddress = parsedAddress.toString();
      } catch (e) {
        console.warn('Address parsing failed for balance check, using original:', address);
      }

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
      logger.error('Failed to get balance', { error: error.message, address, stack: error.stack });
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
   * Release funds from escrow to channel owner
   */
  static async releaseFunds(
    escrowAddress: string,
    recipientAddress: string,
    amount: string
  ): Promise<string> {
    // This would require signing and broadcasting a transaction
    // For MVP, we'll return a placeholder transaction hash
    // In production, use wallet to sign and send transaction

    // Placeholder implementation
    return `tx_${Date.now()}`;
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
