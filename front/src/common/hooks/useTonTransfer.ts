import { useTonConnectUI } from '@tonconnect/ui-react'
import { useToast } from '@components'
import type {TonConnectUI} from "@tonconnect/ui";

export const transferTonCall = async (
  tonConnectUI: TonConnectUI,
  toAddress: string,
  amountUSDT: number,
  comment?: string
): Promise<any> => {
  try {
    console.log('Sending USDT...', comment);
    // TODO implement with TON connect
    // Check if wallet is connected
    if (!tonConnectUI.account) {
      return {
        type: 'error',
        message: 'Please connect your wallet first',
      }
    }

    // Convert TON to nanotons (1 TON = 1,000,000,000 nanotons)
    const amountNanotons = (amountUSDT).toString()

    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes validity
      messages: [
        {
          address: toAddress,
          amount: amountNanotons,
          payload: comment,
          // Note: Comments require base64-encoded payload,
          // which is typically handled by smart contracts
          // For simple transfers, we omit payload
        },
      ],
    }

    const result = await tonConnectUI.sendTransaction(transaction)

    return result;
    // return {
    //   type: 'success',
    //   message: `Transaction sent! Hash: ${result.boc.slice(0, 10)}...`,
    // }
  } catch (error: any) {
    console.error('USDT transfer error:', error)

    // Handle user rejection
    if (error?.message?.includes('User rejected') || error?.code === 300) {
      return {
        type: 'error',
        message: 'Transaction cancelled by user',
      };
    } else {
      return{
        type: 'error',
        message: error?.message || 'Failed to send transaction',
      }
    }

    return Promise.reject(error)
  }
}

/**
 * Hook for handling USDT transfers using TON Connect
 */
export function useTonTransfer() {
  const [tonConnectUI] = useTonConnectUI()
  const { showToast } = useToast()

  /**
   * Transfer USDT to a specified address
   * @param toAddress - The recipient address (bounceable or non-bounceable)
   * @param amountUSDT - The amount in TON (will be converted to nanotons)
   * @param comment - Optional comment for the transaction
   * @returns Promise that resolves when transaction is sent
   */
  const transferTon = async (
    toAddress: string,
    amountUSDT: number,
    comment?: string
  ): Promise<void> => {
    const result = await transferTonCall(tonConnectUI, toAddress, amountUSDT, comment)
    showToast(result);
  }

  /**
   * Check if wallet is connected
   */
  const isConnected = !!tonConnectUI.account

  /**
   * Get connected wallet address
   */
  const walletAddress = tonConnectUI.account?.address

  return {
    transferTon,
    isConnected,
    walletAddress,
    tonConnectUI,
  }
}
