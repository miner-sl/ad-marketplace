import React, { useState, useEffect } from 'react'
import { miniApp, retrieveLaunchParams } from '@tma.js/sdk-react'

import { ThemeContext } from './ThemeContext'

interface Props {
  children?: React.ReactNode
}

export const ThemeProvider = ({ children }: Props) => {
  const launchParams = retrieveLaunchParams()
  const lightTgTheme = launchParams?.tgWebAppThemeParams?.colorScheme === 'light'

  const [darkTheme, setDarkTheme] = useState(lightTgTheme);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      darkTheme ? 'dark' : 'light'
    )

    if (darkTheme) {
      window.document.documentElement.style.backgroundColor = '#1c1c1e'
      // miniApp.setBackgroundColor('#1c1c1e')
      miniApp.setHeaderColor('#1c1c1e')
      miniApp.setBottomBarColor('#1c1c1e')
    } else {
      window.document.documentElement.style.backgroundColor = '#EFEFF4'
      // miniApp.setBackgroundColor('#EFEFF4')
      miniApp.setHeaderColor('#EFEFF4')
      miniApp.setBottomBarColor('#EFEFF4')
    }

    // const { isMobile } = checkIsMobile()

    // if (!isMobile) return

    // miniApp.requestFullscreen()
    // miniApp.lockOrientation()
    // miniApp.disableVerticalSwipes()
  }, [darkTheme])

  const toggleThemeHandler = () => {
    setDarkTheme((prevState) => !prevState)
  }

  return (
    <ThemeContext.Provider
      value={{
        darkTheme: darkTheme,
        toggleTheme: toggleThemeHandler,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
