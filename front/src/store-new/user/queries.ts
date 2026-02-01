import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TANSTACK_GC_TIME, TANSTACK_KEYS, TANSTACK_TTL } from '@utils'
import { userAPI, type UserMeResponse } from './api'
import type { RegisterUserRequest } from '@types'

export const useUserMeQuery = (telegramId: number | undefined) => {
  return useQuery<UserMeResponse>({
    queryKey: [...TANSTACK_KEYS.USER_ME(telegramId || 0)],
    queryFn: () => userAPI.getUser(telegramId!),
    enabled: !!telegramId,
    gcTime: TANSTACK_GC_TIME,
    staleTime: TANSTACK_TTL.USER_ME || 60000,
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
