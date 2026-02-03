// import { useEffect } from 'react'
// import { useNavigate, useLocation } from 'react-router-dom'
// import { useTelegramUser } from '@hooks'
// import { ROUTES_NAME } from '@routes'
// import { useUserMeQuery } from "@store-new";
// import { Skeleton } from "@components";
// import {useAuth} from "@context";

interface OnboardingGuardProps {
  children: React.ReactNode
}

export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  // const navigate = useNavigate()
  // const location = useLocation()
  // const {user} = useAuth()
  // const { data: userData, isLoading } = useUserMeQuery(telegramUser?.id)

  // const isRegistered = userData?.registered ?? false
  //
  // useEffect(() => {
  //   if (isLoading || !telegramUser?.id) {
  //     return
  //   }
  //
  //   if (location.pathname === ROUTES_NAME.ONBOARDING) {
  //     return
  //   }
  //
  //   if (!isRegistered) {
  //     navigate(ROUTES_NAME.ONBOARDING, { replace: true })
  //   }
  // }, [isLoading, isRegistered, navigate, location.pathname, telegramUser?.id])
  //
  // if (isLoading || !telegramUser?.id) {
  //   return( <Skeleton />);
  // }

  // if (!isRegistered && location.pathname !== ROUTES_NAME.ONBOARDING) {
  //   return (
  //     <p>
  //       You need to register in <a href={ROUTES_NAME.ONBOARDING}>onboarding</a>
  //     </p>
  //   )
  // }

  return <>{children}</>
}
