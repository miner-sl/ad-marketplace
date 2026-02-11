import { useEffect, memo } from 'react'
import { useLocation } from 'react-router-dom'

import { mainButton } from '@tma.js/sdk-react'

import { isProd } from '../../common/config'

interface MainButtonProps {
  text: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  color?: string
  textColor?: string
  isVisible?: boolean
}

export const TelegramMainButton = memo(
  ({
    text,
    onClick,
    disabled = false,
    loading = false,
    color,
    textColor,
    isVisible = true,
  }: MainButtonProps) => {
    const location = useLocation()

    useEffect(() => {
      mainButton.setParams({
        text: text || 'Continue',
        ...(color && { bgColor: color as `#${string}` }),
        ...(textColor && { textColor: textColor as `#${string}` }),
        isEnabled: !disabled && !loading,
        isLoaderVisible: loading,
      })

      if (isVisible && text) {
        mainButton.show()
      } else {
        mainButton.hide()
      }

      const offClick = mainButton.onClick(onClick)

      return () => {
        offClick()
        mainButton.hide()
      }
    }, [
      location.pathname,
      text,
      onClick,
      disabled,
      loading,
      color,
      textColor,
      isVisible,
    ])

    if (
      false
      // !isProd
      // && isVisible
    ) {
      return (
        <button
          onClick={onClick}
          style={{
            width: '100%',
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10000000000000000,
            height: '56px',
          }}
          disabled={disabled}
        >
          {text}
        </button>
      )
    }

    return null
  }
)
