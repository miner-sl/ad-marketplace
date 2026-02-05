import { useTonConnectUI } from '@tonconnect/ui-react'
import { useToast } from '@components'

/**
 * Hook for handling TON transfers using TON Connect
 */
export function useTonTransfer() {
  const [tonConnectUI] = useTonConnectUI()
  const { showToast } = useToast()

  /**
   * Transfer TON to a specified address
   * @param toAddress - The recipient address (bounceable or non-bounceable)
   * @param amountTon - The amount in TON (will be converted to nanotons)
   * @param comment - Optional comment for the transaction
   * @returns Promise that resolves when transaction is sent
   */
  const transferTon = async (
    toAddress: string,
    amountTon: number,
    comment?: string
  ): Promise<void> => {
    try {
      // Check if wallet is connected
      if (!tonConnectUI.account) {
        showToast({
          type: 'error',
          message: 'Please connect your wallet first',
        })
        return
      }

      // Convert TON to nanotons (1 TON = 1,000,000,000 nanotons)
      const amountNanotons = (amountTon * 1_000_000_000).toString()

      // Create transaction
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes validity
        messages: [
          {
            address: toAddress,
            amount: amountNanotons,
            // Note: Comments require base64-encoded payload, 
            // which is typically handled by smart contracts
            // For simple transfers, we omit payload
          },
        ],
      }

      // Send transaction
      const result = await tonConnectUI.sendTransaction(transaction)

      showToast({
        type: 'success',
        message: `Transaction sent! Hash: ${result.boc.slice(0, 10)}...`,
      })

      return Promise.resolve()
    } catch (error: any) {
      console.error('TON transfer error:', error)
      
      // Handle user rejection
      if (error?.message?.includes('User rejected') || error?.code === 300) {
        showToast({
          type: 'error',
          message: 'Transaction cancelled by user',
        })
      } else {
        showToast({
          type: 'error',
          message: error?.message || 'Failed to send transaction',
        })
      }
      
      return Promise.reject(error)
    }
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
