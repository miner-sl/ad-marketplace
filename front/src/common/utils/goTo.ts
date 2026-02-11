import { openTelegramLink, openLink } from '@tma.js/sdk-react'

export const goTo = (link: string) => {
  if (link.includes('t.me')) {
    openTelegramLink(link)
  } else {
    openLink(link, {tryInstantView: false})
  }
}

