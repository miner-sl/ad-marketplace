import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface TelegramBackButtonProps {
  onClick?(): void
  hidden?: boolean
}

export const TelegramBackButton = ({
  hidden,
  onClick,
}: TelegramBackButtonProps) => {
  const webApp = window?.Telegram?.WebApp
  const backButton = webApp ? webApp?.BackButton : null

  const navigate = useNavigate()
  const location = useLocation()

  // Check if BackButton is supported (version >= 7.0)
  const isBackButtonSupported = () => {
    if (!webApp?.version) return false
    const majorVersion = parseInt(webApp.version.split('.')[0], 10)
    return majorVersion >= 7
  }

  const handleClick = () => {
    const closeApp = !!location?.state?.closeApp
    if (hidden || closeApp) {
      return null
    }

    if (onClick) {
      onClick()
    } else {
      const toMainPage = !!location?.state?.toMainPage

      if (toMainPage) {
        navigate('/')
        return
      }
      navigate(-1)
    }
  }

  useEffect(() => {
    if (backButton && isBackButtonSupported()) {
      backButton.show()
    }
  }, [])

  useEffect(() => {
    if (hidden) {
      if (backButton && isBackButtonSupported()) {
        backButton.hide()
      }
    }
  }, [hidden])

  useEffect(() => {
    webApp?.onEvent('backButtonClicked', handleClick)

    return () => {
      webApp?.offEvent('backButtonClicked', handleClick)
    }
  }, [handleClick])

  return null
}
