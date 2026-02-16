import { useEffect, useRef } from 'react'
import { useTonWallet } from '@tonconnect/ui-react'

import { MarketplaceService } from '@services'
import { getToken } from '@utils'
import {useAuth} from "@context";

export function useUpdateWalletAddress() {
  const wallet = useTonWallet()
  const lastSyncedAddress = useRef<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      return;
    }
    const address = wallet?.account?.address;
    if (!address || !getToken()) {
      if (!address) lastSyncedAddress.current = null
      return
    }
    if (lastSyncedAddress.current === address) return

    lastSyncedAddress.current = address
    MarketplaceService.updateWalletAddress(address)
      .then((res) => {
        if (!res.ok) lastSyncedAddress.current = null
      })
      .catch(() => {
        lastSyncedAddress.current = null
      })
  }, [wallet?.account?.address, user])
}
