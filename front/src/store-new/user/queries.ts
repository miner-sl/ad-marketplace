import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TANSTACK_GC_TIME, TANSTACK_KEYS, TANSTACK_TTL } from '@utils'
import { userAPI, type UserMeResponse } from './api'
import type {LedgerTransactionDTO, LedgerTransactionRow, RegisterUserRequest} from '@types'
import {buildTonscanTxLink} from "../marketplace";

export const useUserMeQuery = (telegramId: number | undefined) => {
  return useQuery<UserMeResponse>({
    queryKey: [...TANSTACK_KEYS.USER_ME(telegramId || 0)],
    queryFn: () => userAPI.getUser(telegramId!),
    enabled: !!telegramId,
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.USER_ME || 60000,
  })
}

export const useUserTransactionsQuery = () => {
  return useQuery({
    queryKey: TANSTACK_KEYS.USER_TRANSACTIONS,
    queryFn: () => userAPI.getTransactions(),
    select: (data) => {

      return data.map((tx: LedgerTransactionRow): LedgerTransactionDTO => {
        return  ({
          ...tx,
          txLink: tx.tx_hash ? buildTonscanTxLink(tx.tx_hash) : undefined,
        })
      })
    },
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.USER_TRANSACTIONS || 60000,
  })
}

export const useUserTransactionAnalyticsQuery = (params?: { since?: string }) => {
  return useQuery({
    queryKey: [...TANSTACK_KEYS.USER_TRANSACTIONS_ANALYTICS(params?.since)],
    queryFn: () => userAPI.getTransactionAnalytics(params),
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.USER_TRANSACTIONS_ANALYTICS || 60000,
  })
}

export const useRegisterUserMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: RegisterUserRequest) => userAPI.registerUser(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: TANSTACK_KEYS.USER_ME(variables.user_id),
      })
    },
  })
}
